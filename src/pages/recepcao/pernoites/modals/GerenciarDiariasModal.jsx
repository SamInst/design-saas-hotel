import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CalendarDays, DollarSign, Loader2, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { Modal }  from '../../../../components/ui/Modal';
import { Button } from '../../../../components/ui/Button';
import { Select } from '../../../../components/ui/Input';
import { DatePicker } from '../../../../components/ui/DatePicker';
import { TimeInput } from '../../../../components/ui/TimeInput';
import { computeAdjustedTotal, novoPrecoToState, describeAdjustment } from '../../../../components/ui/PriceAdjustmentModal';
import { reservaApi, hospedagemApi } from '../../../../services/api';
import { fmtBRL } from '../../shared/helpers';
import styles from '../../recepcao.module.css';

// ── Date helpers (backend: "dd/MM/yyyy HH:mm") ─────────────────────────────────
const parseBr = (s) => {
  if (!s) return null;
  const [datePart, timePart] = String(s).split(' ');
  const [dd, mm, yyyy] = datePart.split('/').map(Number);
  const [h, mi] = (timePart || '14:00').split(':').map(Number);
  if (!dd || !mm || !yyyy) return null;
  return new Date(yyyy, mm - 1, dd, h || 0, mi || 0);
};
const brDateOnly = (d) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
const dkey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const hhmm = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
const dateOnly = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const toBrDob = (dn) => {
  if (!dn) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(dn) ? dn.split('-').reverse().join('/') : dn;
};
const ageFromDob = (dn) => {
  if (!dn) return null;
  const iso = /^\d{2}\/\d{2}\/\d{4}$/.test(dn) ? dn.split('/').reverse().join('-') : dn;
  const d = new Date(iso);
  if (isNaN(d)) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
};
// Conta adultos (idade desconhecida conta como adulto) e crianças (< 18) numa diária.
const splitOccupancy = (hospedes) => {
  let adultos = 0;
  let criancas = 0;
  hospedes.forEach((h) => {
    const age = ageFromDob(h.dataNascimento);
    if (age != null && age < 18) criancas += 1;
    else adultos += 1;
  });
  return { adultos, criancas };
};

const BLOCKING = new Set(['RESERVA_ATIVA', 'PERNOITE_ATIVO', 'DAY_USE_ATIVO']);

let _rowSeq = 0;
const nextKey = () => `gd-${++_rowSeq}`;

export default function GerenciarDiariasModal({
  open, onClose, hospedagemId, roomLabel, quartos = [], onSaved, notify, totalPago = 0,
}) {
  const [loading, setLoading]   = useState(false);
  const [saving, setSaving]     = useState(false);
  const [rows, setRows]         = useState([]);
  const [hospedes, setHospedes] = useState([]); // pessoas do pernoite (usadas no cálculo de todas as diárias)
  const [novoPreco, setNovoPreco] = useState(null); // ajuste manual de preço vigente ("Gerenciar Preços")
  const [mainRoomId, setMainRoomId] = useState(null); // quarto do pernoite (calendário de disponibilidade)
  const [calcLoading, setCalcLoading] = useState(false);
  const [busyByRoom, setBusyByRoom]   = useState({});
  const [occByRoom, setOccByRoom]     = useState({}); // Map<'yyyy-MM-dd',{am,pm}> por quarto (calendário)
  const [selRowKey, setSelRowKey]     = useState(null); // diária destacada no calendário (à direita)
  const [confirmRemove, setConfirmRemove] = useState(null); // { key, num }
  const defaultRef = useRef({ roomId: null });
  const listRef = useRef(null);

  // ── Load fresh hospedagem on open ────────────────────────────────────────────
  useEffect(() => {
    if (!open || !hospedagemId) return;
    let cancelled = false;
    setLoading(true);
    setRows([]);
    hospedagemApi.buscarPorId(hospedagemId)
      .then((h) => {
        if (cancelled || !h) return;
        const pessoas = (h.pessoas ?? []).map((p) => ({
          id: p.id, nome: p.nome, dataNascimento: p.data_nascimento ?? p.dataNascimento ?? '',
        }));
        setHospedes(pessoas);
        setNovoPreco(h.novo_preco ?? null);
        const roomId = h.quarto?.id ?? (h.diarias?.[0]?.quarto?.id) ?? null;
        defaultRef.current = { roomId };
        setMainRoomId(roomId);
        const diarias = (h.diarias ?? [])
          .map((d) => {
            const ci = parseBr(d.checkin) ?? new Date();
            const co = parseBr(d.checkout) ?? new Date();
            const meia = !!d.meia_diaria;
            return {
              key: nextKey(),
              quartoId: d.quarto?.id ?? defaultRef.current.roomId,
              checkin: meia ? dateOnly(ci) : ci,
              checkout: meia ? dateOnly(ci) : co,
              horaSaida: meia ? hhmm(co) : '12:00',
              valor: d.valor ?? 0,
              isNew: false,
              meiaDiaria: meia,
            };
          })
          .sort((a, b) => a.checkin - b.checkin);
        setRows(diarias);
        // Por padrão, a diária atual (a de hoje) já vem destacada no calendário.
        const todayD = dateOnly(new Date());
        const cur = diarias.find((r) => dateOnly(r.checkin) <= todayD && todayD < dateOnly(r.checkout))
          ?? diarias.find((r) => dateOnly(r.checkin) >= todayD)
          ?? diarias[diarias.length - 1] ?? null;
        setSelRowKey(cur?.key ?? null);
      })
      .catch((e) => { if (!cancelled) notify?.('Erro ao carregar diárias: ' + (e.message || ''), 'error'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, hospedagemId]); // eslint-disable-line

  // ── Busy nights per room (best-effort, excludes this hospedagem) ──────────────
  const loadBusy = (roomId) => {
    if (!roomId || busyByRoom[roomId] !== undefined) return;
    setBusyByRoom((m) => ({ ...m, [roomId]: null })); // null = carregando (distinto de Set vazio)
    hospedagemApi.buscarPorQuarto(roomId, { periodo: 'proximas', size: 200 })
      .then((res) => {
        const list = res?.content ?? (Array.isArray(res) ? res : []);
        const set = new Set();
        // Ocupação meia-diária (espelha o calendário do "Editar Reserva"):
        // entrada à tarde (pm) / noites cheias / saída de manhã (am).
        const occ = new Map();
        const markOcc = (d, half) => {
          const k = dkey(d);
          const c = occ.get(k) || { am: false, pm: false };
          c[half] = true;
          occ.set(k, c);
        };
        list.forEach((h) => {
          if (h.id === hospedagemId || !BLOCKING.has(h.status)) return;
          const ci = parseBr(h.data_hora_checkin), co = parseBr(h.data_hora_checkout);
          if (!ci || !co) return;
          const cs = new Date(ci.getFullYear(), ci.getMonth(), ci.getDate());
          const ce = new Date(co.getFullYear(), co.getMonth(), co.getDate());
          const cur = new Date(cs);
          while (cur < ce) { set.add(dkey(cur)); cur.setDate(cur.getDate() + 1); }
          if (cs < ce) {
            markOcc(cs, 'pm');
            const c2 = new Date(cs); c2.setDate(c2.getDate() + 1);
            while (c2 < ce) { markOcc(c2, 'am'); markOcc(c2, 'pm'); c2.setDate(c2.getDate() + 1); }
            markOcc(ce, 'am');
          }
        });
        setBusyByRoom((m) => ({ ...m, [roomId]: set }));
        setOccByRoom((m) => ({ ...m, [roomId]: occ }));
      })
      .catch(() => {
        setBusyByRoom((m) => ({ ...m, [roomId]: new Set() }));
        setOccByRoom((m) => ({ ...m, [roomId]: new Map() }));
      });
  };

  useEffect(() => {
    rows.forEach((r) => loadBusy(r.quartoId));
    loadBusy(mainRoomId);
  }, [rows, mainRoomId]); // eslint-disable-line

  // Mantém a meia diária (sempre a última) na data de checkout da diária anterior.
  useEffect(() => {
    if (rows.length < 2) return;
    const lastIdx = rows.length - 1;
    const last = rows[lastIdx];
    if (!last.meiaDiaria) return;
    const desired = dateOnly(rows[lastIdx - 1].checkout);
    if (dkey(last.checkin) !== dkey(desired)) {
      setRows((prev) => prev.map((r, i) => (i === lastIdx ? { ...r, checkin: desired, checkout: desired } : r)));
    }
  }, [rows]); // eslint-disable-line

  // ── Recalculate every row's price as parameters change ───────────────────────
  const datasNascimento = useMemo(
    () => hospedes.map((h) => toBrDob(h.dataNascimento)).filter(Boolean),
    [hospedes],
  );
  const calcSig = useMemo(
    () => `${datasNascimento.join(',')}#` + rows.map((r) => `${r.quartoId}|${dkey(r.checkin)}|${dkey(r.checkout)}|${r.meiaDiaria ? 'M' : 'F'}`).join(';'),
    [rows, datasNascimento],
  );
  useEffect(() => {
    if (!open || rows.length === 0) { setCalcLoading(false); return; }
    let cancelled = false;
    setCalcLoading(true);
    const items = rows.map((r) => {
      // Meia diária: cobra 1 diária cheia (checkin → checkin+1) e divide por 2 no resultado.
      const saida = r.meiaDiaria ? new Date(dateOnly(r.checkin).getTime() + 86400000) : r.checkout;
      return {
        fk_quarto: r.quartoId,
        data_entrada: brDateOnly(r.checkin),
        data_saida: brDateOnly(saida),
        datas_nascimento: datasNascimento,
      };
    });
    reservaApi.calcularPreco(items)
      .then((res) => {
        if (cancelled) return;
        const arr = Array.isArray(res) ? res : [res];
        setRows((prev) => prev.map((r, i) => {
          const base = arr[i]?.valor_total ?? r.valor;
          return { ...r, valor: r.meiaDiaria ? base / 2 : base, calc: arr[i] ?? r.calc };
        }));
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setCalcLoading(false); });
    return () => { cancelled = true; };
  }, [calcSig, open]); // eslint-disable-line

  // Total base (soma das diárias) e total final com o ajuste de preço vigente aplicado.
  const baseTotal = rows.reduce((s, r) => s + (r.valor || 0), 0);
  const adjState = novoPreco ? novoPrecoToState(novoPreco) : null;
  const adjResult = adjState
    ? computeAdjustedTotal({ baseTotal, baseDiarias: rows.map((r) => ({ valor: r.valor || 0 })), ...adjState })
    : null;
  const total = adjResult ? adjResult.valorTotal : baseTotal;
  const adjDesc = adjState ? describeAdjustment(adjState) : null;
  // Resumo financeiro (espelha o "Editar Reserva"): Pago vem do pernoite; Pendente = total − pago.
  const pendente = Math.max(0, total - (totalPago || 0));
  const pagPct = total > 0 ? Math.min(100, Math.round((totalPago || 0) / total * 100)) : 0;
  const occupancy = useMemo(() => splitOccupancy(hospedes), [hospedes]);
  // Diárias que já passaram (checkin antes de hoje) não podem ser removidas/editadas — só viram meia.
  const today = dateOnly(new Date());
  const isPastRow = (r) => dateOnly(r.checkin) < today;
  const stayStart = rows.length ? rows.reduce((m, r) => (!m || r.checkin < m ? r.checkin : m), null) : null;
  const stayEnd = rows.length ? rows.reduce((m, r) => (!m || r.checkout > m ? r.checkout : m), null) : null;
  const mainRoomLabel = quartos.find((q) => q.id === mainRoomId)?.numero ?? roomLabel;
  // Diária destacada no calendário (à direita) e a ocupação meia-diária do seu quarto.
  const selRow = rows.find((r) => r.key === selRowKey) ?? null;
  const selRoomOcc = (selRow ? occByRoom[selRow.quartoId] : occByRoom[mainRoomId]) ?? null;
  const selRoomLabel = quartos.find((q) => q.id === (selRow?.quartoId ?? mainRoomId))?.numero ?? mainRoomLabel;
  // Disponibilidade ainda carregando (null = em carregamento) → evita adicionar em data ocupada.
  const lastRoomId = rows.length ? rows[rows.length - 1].quartoId : mainRoomId;
  const availLoading = (mainRoomId != null && busyByRoom[mainRoomId] === null)
    || (lastRoomId != null && busyByRoom[lastRoomId] === null);
  // Data em que a próxima diária começaria (dia seguinte ao último checkout).
  const nextStart = (() => {
    const lastRow = rows[rows.length - 1];
    if (!lastRow) return dateOnly(new Date());
    if (lastRow.meiaDiaria) { const d = dateOnly(lastRow.checkin); d.setDate(d.getDate() + 1); return d; }
    return dateOnly(lastRow.checkout);
  })();
  // Bloqueia "Adicionar Diária" quando a próxima data está ocupada no quarto (ou no quarto do pernoite).
  const nextBusySet = new Set([
    ...(busyByRoom[lastRoomId] instanceof Set ? busyByRoom[lastRoomId] : []),
    ...(busyByRoom[mainRoomId] instanceof Set ? busyByRoom[mainRoomId] : []),
  ]);
  const nextDateBusy = nextBusySet.has(dkey(nextStart));

  // Horários (checkin/checkout) definidos pela categoria do quarto da diária.
  const roomTimes = (quartoId) => {
    const q = quartos.find((x) => x.id === quartoId);
    return { checkin: q?.categoriaCheckin || '14:00', checkout: q?.categoriaCheckout || '12:00' };
  };

  // ── Row mutations ────────────────────────────────────────────────────────────
  const patchRow = (key, patch) => setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const removeRow = (key) => setRows((prev) => prev.filter((r) => r.key !== key));
  const toggleMeia = (key, checked) => setRows((prev) => {
    const idx = prev.findIndex((r) => r.key === key);
    if (idx < 0) return prev;
    // A meia diária ocupa a data de checkout da diária anterior (a última diária inteira).
    const base = idx > 0 ? dateOnly(prev[idx - 1].checkout) : dateOnly(prev[idx].checkin);
    return prev.map((r, i) => {
      if (i !== idx) return r;
      if (checked) {
        const hora = r.horaSaida && r.horaSaida > '12:00' ? r.horaSaida : '18:00';
        return { ...r, meiaDiaria: true, checkin: base, checkout: base, horaSaida: hora };
      }
      const co = new Date(base); co.setDate(co.getDate() + 1);
      return { ...r, meiaDiaria: false, checkin: base, checkout: co };
    });
  });
  const addRow = () => {
    setRows((prev) => {
      let list = prev;
      // Só a última diária pode ser meia: ao adicionar outra, a anterior volta a ser inteira.
      // (diárias já encerradas não são alteradas.)
      const lastIdx = prev.length - 1;
      if (prev[lastIdx]?.meiaDiaria && !isPastRow(prev[lastIdx])) {
        const ci0 = dateOnly(prev[lastIdx].checkin);
        const co0 = new Date(ci0); co0.setDate(co0.getDate() + 1);
        list = prev.map((r, i) => (i === lastIdx ? { ...r, meiaDiaria: false, checkin: ci0, checkout: co0 } : r));
      }
      const last = list[list.length - 1];
      const roomId = last ? last.quartoId : defaultRef.current.roomId;
      const ci = dateOnly(last ? new Date(last.checkout) : new Date());
      const co = new Date(ci); co.setDate(co.getDate() + 1);
      const row = {
        key: nextKey(),
        quartoId: roomId,
        checkin: ci,
        checkout: co,
        horaSaida: '12:00',
        valor: 0,
        isNew: true,
        meiaDiaria: false,
      };
      return [...list, row];
    });
    setTimeout(() => { if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight; }, 50);
  };

  const handleSave = async () => {
    if (rows.length === 0) { notify?.('Adicione ao menos uma diária.', 'error'); return; }
    const invalid = rows.find((r) =>
      !r.quartoId || !r.checkin || (!r.meiaDiaria && (!r.checkout || r.checkin >= r.checkout)),
    );
    if (invalid) { notify?.('Verifique o quarto e o período de cada diária.', 'error'); return; }
    const meiaInvalida = rows.find((r) => r.meiaDiaria && !/^\d{2}:\d{2}$/.test(r.horaSaida || ''));
    if (meiaInvalida) { notify?.('Informe a hora de saída da meia diária.', 'error'); return; }
    // A meia diária começa no checkout da categoria (fim da diária anterior); a saída precisa ser depois.
    const meiaHora = rows.find((r) => r.meiaDiaria && (r.horaSaida || '') <= roomTimes(r.quartoId).checkout);
    if (meiaHora) { notify?.(`A hora de saída da meia diária deve ser após o checkout da categoria.`, 'error'); return; }
    setSaving(true);
    try {
      const pessoas = hospedes.map((h) => h.id).filter(Boolean);
      const body = rows.map((r) => {
        const ct = roomTimes(r.quartoId);
        if (r.meiaDiaria) {
          const dia = brDateOnly(r.checkin);
          return {
            quarto_id: r.quartoId,
            // Meia diária: mesmo dia da diária anterior; começa no checkout da categoria (fim da
            // diária anterior) para não sobrepor, e o checkout recebe a hora definida no front.
            checkin: `${dia} ${ct.checkout}`,
            checkout: `${dia} ${r.horaSaida}`,
            meia_diaria: true,
            pessoas,
          };
        }
        return {
          quarto_id: r.quartoId,
          // Datas/horas das diárias inteiras definidas pelo checkin/checkout da categoria.
          checkin: `${brDateOnly(r.checkin)} ${ct.checkin}`,
          checkout: `${brDateOnly(r.checkout)} ${ct.checkout}`,
          meia_diaria: false,
          pessoas,
        };
      });
      await hospedagemApi.atualizarDiarias(hospedagemId, body);
      notify?.(`${rows.length} diária(s) salva(s).`);
      onSaved?.();
      onClose();
    } catch (e) { notify?.('Erro: ' + (e.message || ''), 'error'); }
    finally { setSaving(false); }
  };

  if (!open) return null;

  return (
    <>
    <Modal
      open
      onClose={onClose}
      size="lg"
      containerStyle={{ maxWidth: 'min(820px, 96vw)' }}
      title={<><RefreshCw size={15} /> Gerenciar Diárias — Apt. {roomLabel}</>}
      footer={
        <div className={styles.footerRight}>
          <Button variant="primary" onClick={handleSave} disabled={saving || loading || rows.length === 0}>
            {saving && <Loader2 size={14} className={styles.spin} />}
            Salvar Diárias
          </Button>
        </div>
      }
    >
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '24px 0', color: 'var(--text-2)', fontSize: 13 }}>
          <Loader2 size={15} className={styles.spin} /> Carregando diárias...
        </div>
      ) : (
        <div className={styles.formStack}>
          {/* ── Resumo Financeiro (espelhado do "Editar Reserva") ── */}
          <div className={styles.gdFinCard}>
            <div className={styles.gdFinHeader}>
              <DollarSign size={13} className={styles.gdFinIcon} />
              <span className={styles.gdFinTitle}>Resumo Financeiro</span>
              <span className={styles.gdFinDiarias}>{rows.length} diária(s)</span>
            </div>
            <div className={styles.gdFinRow}>
              <div className={styles.gdFinItem}>
                <span className={styles.gdFinLabel}>Valor Total</span>
                <span className={styles.gdFinValue}>
                  {calcLoading ? <Loader2 size={12} className={styles.spin} /> : fmtBRL(total)}
                </span>
              </div>
              <div className={styles.gdFinItem}>
                <span className={styles.gdFinLabel}>Total Pago</span>
                <span className={[styles.gdFinValue, styles.gdFinPaid].join(' ')}>{fmtBRL(totalPago || 0)}</span>
              </div>
              <div className={styles.gdFinItem}>
                <span className={styles.gdFinLabel}>Pendente</span>
                <span className={[styles.gdFinValue, pendente > 0 ? styles.gdFinPending : styles.gdFinPaid].join(' ')}>
                  {fmtBRL(pendente)}
                </span>
              </div>
            </div>
            {total > 0 && (
              <div className={styles.gdFinProgress}>
                <div className={styles.gdFinProgressMeta}>
                  <span>Progresso de pagamento</span>
                  <span>{pagPct}%</span>
                </div>
                <div className={styles.gdFinBar}>
                  <div className={styles.gdFinBarFill} style={{ width: `${pagPct}%` }} />
                </div>
              </div>
            )}
            {adjDesc && (
              <div className={styles.gdFinAdj}>Subtotal {fmtBRL(baseTotal)} · {adjDesc}</div>
            )}
          </div>

          {/* Hóspedes do pernoite (usados no cálculo de todas as diárias) */}
          {hospedes.length > 0 && (
            <div className={styles.gdHospedesInfo}>
              <span className={styles.gdFieldLabel}>Hóspedes do pernoite</span>
              <div className={styles.gdHospedesChips}>
                {hospedes.map((h) => (
                  <span key={h.id} className={styles.gdHospedeChip}>{h.nome}</span>
                ))}
              </div>
            </div>
          )}

          {/* ── Diárias (esquerda) + calendário de disponibilidade (direita) ── */}
          <div className={styles.gdSplit}>
            <div className={styles.gdSplitLeft}>
          {rows.length === 0 ? (
            <div className={styles.emptyList}><CalendarDays size={20} color="var(--text-2)" /><span>Nenhuma diária</span></div>
          ) : (
            <div className={styles.gdDiariaList} ref={listRef} style={{ gap: 12, paddingRight: 4, paddingBottom: 4 }}>
              {rows.map((r, idx) => {
                const busy = busyByRoom[r.quartoId];
                const { adultos, criancas } = occupancy;
                const past = isPastRow(r);
                // Apenas a última diária pode ter o checkbox de meia diária (nova ou já encerrada).
                const canMeia = idx === rows.length - 1;
                const sazNomes = [
                  ...new Set([
                    ...(r.calc?.sazonalidades_aplicadas ?? []).map((s) => s?.descricao).filter(Boolean),
                    ...(r.calc?.detalhes ?? []).map((d) => d?.sazonalidade?.descricao).filter(Boolean),
                  ]),
                ];
                const showBelow = (r.meiaDiaria && !canMeia) || past || sazNomes.length > 0;
                return (
                  <div key={r.key}
                    className={[styles.gdCard, r.key === selRowKey ? styles.gdCardSel : ''].join(' ')}
                    onClick={() => setSelRowKey(r.key)}
                    title="Ver disponibilidade desta diária no calendário">
                    <div className={styles.gdCardHeader}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                          <span className={styles.gdCardNum}>Diária {idx + 1}</span>
                          {canMeia && (
                            <label className={styles.gdMeiaCheck}>
                              <input
                                type="checkbox"
                                checked={!!r.meiaDiaria}
                                onChange={(e) => toggleMeia(r.key, e.target.checked)}
                              />
                              Definir como meia diária
                            </label>
                          )}
                        </div>
                        {showBelow && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            {past && <span className={styles.gdPastTag}>Encerrada</span>}
                            {r.meiaDiaria && !canMeia && <span className={styles.gdMeiaTag}>Meia diária</span>}
                            {sazNomes.map((n) => (
                              <span key={n} className={styles.nhSazChip}>{n}</span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                        <span className={styles.gdCardPeople}>
                          {adultos} adulto(s){criancas > 0 && ` + ${criancas} criança(s)`}
                        </span>
                        <span className={styles.gdCardVal}>
                          {calcLoading ? <Loader2 size={12} className={styles.spin} /> : fmtBRL(r.valor)}
                        </span>
                        {!past && (
                          <button className={styles.removeBtn} onClick={() => setConfirmRemove({ key: r.key, num: idx + 1 })} disabled={saving} title="Remover diária">
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className={styles.gdCardBody}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <div className={styles.formStack} style={{ gap: 5 }}>
                          <label className={styles.gdFieldLabel}>{r.meiaDiaria ? 'Data · Hora de saída' : 'Período'}</label>
                          {r.meiaDiaria ? (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 96px', gap: 8 }}>
                              {(idx > 0 || past) ? (
                                // Data fixa = checkout da diária anterior; só a hora é editável.
                                <div className={styles.gdReadonlyDate} title="Data definida pela diária anterior">
                                  {brDateOnly(r.checkin)}
                                </div>
                              ) : (
                                <DatePicker
                                  mode="single"
                                  value={r.checkin}
                                  disabledDates={busy && busy.size ? busy : null}
                                  onChange={(d) => d && patchRow(r.key, { checkin: dateOnly(d), checkout: dateOnly(d) })}
                                />
                              )}
                              <TimeInput value={r.horaSaida} onChange={(v) => patchRow(r.key, { horaSaida: v })} />
                            </div>
                          ) : past ? (
                            <div className={styles.gdReadonlyDate} title="Diária encerrada">
                              {brDateOnly(r.checkin)} → {brDateOnly(r.checkout)}
                            </div>
                          ) : (
                            <DatePicker
                              mode="range"
                              startDate={r.checkin}
                              endDate={r.checkout}
                              disabledDates={busy && busy.size ? busy : null}
                              onRangeChange={({ start, end }) => patchRow(r.key, { checkin: start || r.checkin, checkout: end || r.checkout })}
                            />
                          )}
                        </div>
                        <div className={styles.formStack} style={{ gap: 5 }}>
                          <label className={styles.gdFieldLabel}>Quarto</label>
                          {past ? (
                            <div className={styles.gdReadonlyDate} title="Diária encerrada">
                              Apt. {quartos.find((q) => q.id === r.quartoId)?.numero ?? r.quartoId}
                            </div>
                          ) : (
                            <Select value={r.quartoId ?? ''} onChange={(e) => patchRow(r.key, { quartoId: Number(e.target.value) })}>
                              {quartos.map((q) => (
                                <option key={q.id} value={q.id}>Apt. {q.numero} · {q.tipoOcupacao || q.categoria}</option>
                              ))}
                            </Select>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <button
            type="button"
            className={styles.gdAddBtn}
            onClick={addRow}
            disabled={saving || availLoading || nextDateBusy}
            title={nextDateBusy ? 'A próxima data está ocupada no calendário.' : undefined}
          >
            {availLoading ? <Loader2 size={14} className={styles.spin} /> : <Plus size={14} />}
            {availLoading
              ? 'Carregando disponibilidade…'
              : nextDateBusy
                ? 'Próxima data indisponível'
                : 'Adicionar Diária'}
          </button>
            </div>

            <div className={styles.gdSplitRight}>
              <span className={styles.gdFieldLabel}>
                Disponibilidade · Apt. {selRoomLabel}{selRow ? ` · Diária ${rows.indexOf(selRow) + 1}` : ''}
              </span>
              {/* Resumo do período da diária selecionada (datas editadas nos campos à esquerda). */}
              <div className={styles.gdEditCalSummary}>
                <div className={styles.gdEditCalLeg}>
                  <span className={styles.gdEditCalLegKey} style={{ color: 'var(--emerald)' }}>Check-in</span>
                  <b>{selRow ? brDateOnly(selRow.checkin) : '—'}</b>
                </div>
                <div className={styles.gdEditCalArrow}>
                  <svg viewBox="0 0 24 8" width="34" height="8" fill="none"><path d="M0 4h22m0 0l-4-3.5M22 4l-4 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
                <div className={[styles.gdEditCalLeg, styles.gdEditCalLegRight].join(' ')}>
                  <span className={styles.gdEditCalLegKey} style={{ color: '#f97316' }}>Check-out</span>
                  <b>{selRow ? brDateOnly(selRow.checkout) : '—'}</b>
                </div>
              </div>
              <DatePicker
                key={selRowKey}
                inline
                readOnly
                lockMonth
                mode="range"
                startDate={selRow ? selRow.checkin : stayStart}
                endDate={selRow ? selRow.checkout : stayEnd}
                occupancy={selRoomOcc}
                onRangeChange={() => {}}
              />
              <div className={styles.gdCalLegend}>
                <span className={styles.gdCalLegendItem}><i className={styles.gdLgSel} /> Diária</span>
                <span className={styles.gdCalLegendItem}><i className={styles.gdLgBlk} /> Ocupado</span>
                <span className={styles.gdCalLegendItem}><i className={styles.gdLgHalf} /> Entrada/saída (meio-dia)</span>
                <span className={styles.gdCalLegendItem}><i className={styles.gdLgFree} /> Disponível</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </Modal>

    {confirmRemove && (
      <Modal
        open
        onClose={() => setConfirmRemove(null)}
        size="sm"
        title={<><AlertTriangle size={15} /> Remover Diária</>}
        footer={
          <div className={styles.footerRight}>
            <Button variant="secondary" onClick={() => setConfirmRemove(null)}>Cancelar</Button>
            <Button variant="danger" onClick={() => { removeRow(confirmRemove.key); setConfirmRemove(null); }}>
              <Trash2 size={14} /> Remover
            </Button>
          </div>
        }
      >
        <p style={{ margin: 0, color: 'var(--text)', fontSize: 14, lineHeight: 1.6 }}>
          Confirma a remoção da <strong>Diária {confirmRemove.num}</strong>? A alteração só é aplicada ao salvar.
        </p>
      </Modal>
    )}
    </>
  );
}
