import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  BedDouble, ChevronLeft, ChevronRight, Plus, Pencil, Trash2,
  ChevronDown, Loader2, X, Users, Building2, Search, CalendarDays, Bell, Check,
} from 'lucide-react';
import { Button }        from '../../components/ui/Button';
import { Modal }         from '../../components/ui/Modal';
import { FormField }     from '../../components/ui/Input';
import { DatePicker }    from '../../components/ui/DatePicker';
import { Notification }  from '../../components/ui/Notification';
import { PaymentModal }  from '../../components/ui/PaymentModal';
import { addDaysStr }    from './calendarMocks';
import { reservaApi, quartoApi, quartoCategoriApi, cadastroApi, enumApi } from '../../services/api';
import styles from './BookingCalendar.module.css';

// ─── Date helpers (backend uses "dd/MM/yyyy HH:mm", frontend uses "yyyy-MM-dd") ─
const parseBrDate = (s) => {
  if (!s) return '';
  const [dt] = s.split(' ');
  const [d, m, y] = dt.split('/');
  return `${y}-${m}-${d}`;
};
const toBrDate = (iso) => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

// ─── Status mapping (backend enums → frontend keys) ───────────────────────────
const mapStatus = (r) => {
  if (r.status) {
    const s = (r.status + '').toLowerCase();
    if (s === 'cancelado')  return 'cancelado';
    if (s === 'hospedado')  return 'hospedado';
    if (s === 'finalizado') return 'finalizado';
    if (s === 'solicitada') return 'solicitada';
    if (s === 'ativo')      return 'confirmada';
    return s;
  }
  if (r.cancelado)          return 'cancelado';
  if (r.hospedado)          return 'hospedado';
  if (r.ativa === false)    return 'finalizado';
  return 'confirmada';
};

// ─── Normalize backend Reserva → frontend shape ───────────────────────────────
// API response: pessoas[i] = { id, pessoa: {id, nome, cpf, ...}, representante }
//               pagamentos[i] = { id, pagamento: {uuid, tipo_pagamento, nome_pagador, valor, ...} }
const normalizeReserva = (r) => {
  // Unwrap nested pessoa objects
  const pessoasRaw = r.pessoas ?? [];
  const pessoas    = pessoasRaw.map((p) => p.pessoa ?? p);
  const titular    = pessoas[0];

  // Unwrap nested pagamento objects
  const pagsRaw   = r.pagamentos ?? [];
  const pags      = pagsRaw.map((p) => p.pagamento ?? p);
  const totalPago = pags.reduce((s, p) => s + (p.valor ?? 0), 0);

  return {
    id:                      r.id,
    quarto:                  r.quarto?.id ?? r.fk_quarto ?? r.quarto,
    categoria:               r.categoria?.nome ?? '',
    titularNome:             titular?.nome ?? r.titular_nome ?? 'Hóspede',
    empresaNome:             r.empresa?.razao_social ?? r.empresa_nome ?? null,
    funcionario:             r.usuario?.pessoa?.nome ?? r.usuario?.nome ?? r.funcionario?.nome ?? null,
    dataHoraRegistro:        r.data_hora_registro ?? null,
    observacao:              r.observacao ?? null,
    quantidadeAcompanhantes: Math.max(0, pessoas.length - 1),
    dataInicio:              parseBrDate(r.data_hora_entrada),
    dataFim:                 parseBrDate(r.data_hora_saida),
    chegadaPrevista:         r.data_hora_entrada ?? '',
    saidaPrevista:           r.data_hora_saida   ?? '',
    status:                  mapStatus(r),
    hospedes: pessoas.map((p) => ({
      id:       p.id,
      nome:     p.nome,
      cpf:      p.cpf ?? '',
      telefone: p.celular ?? p.telefone ?? '',
      email:    p.email ?? '',
    })),
    pagamentos: pagsRaw.map((entry) => {
      const p = entry.pagamento ?? entry;
      return {
        id:                  p.uuid ?? p.id,
        descricao:           p.descricao ?? '',
        formaPagamento:      p.tipo_pagamento?.descricao ?? p.forma_pagamento ?? '',
        nomePagador:         p.nome_pagador ?? '',
        valor:               p.valor ?? 0,
        cancelado:           p.cancelado ?? false,
        dataRegistro:        p.data_hora_registro ?? entry.data_hora_registro ?? '',
        funcionario:         p.funcionario?.nome ?? entry.funcionario?.nome ?? '',
        motivoCancelamento:  p.motivo_cancelamento?.motivo_cancelamento ?? null,
        dataMotivo:          p.motivo_cancelamento?.data_hora_registro ?? null,
        funcMotivo:          p.motivo_cancelamento?.funcionario?.nome ?? null,
      };
    }),
    valorTotal: r.valor_total ?? 0,
    totalPago,
  };
};

// ─── Constants ────────────────────────────────────────────────────────────────
const DAY_CELL_W   = 168;
const ROOM_H       = 60;
const CAT_H        = 30;
const HDR_H        = 56;
const LEFT_W       = 80;
const VISIBLE_DAYS = 31;
const HALF         = DAY_CELL_W / 2;

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtBRL = (v) =>
  Number(v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const normalizeStr = (s) =>
  (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const formatDate = (d) => {
  const y  = d.getFullYear();
  const m  = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
};

const addDays   = (s, n) => addDaysStr(s, n);
const diffDays  = (a, b) =>
  Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000);
const fmtRoom   = (n) => String(n).padStart(2, '0');
const fmtDateBR = (s) => { if (!s) return ''; const [y, m, d] = s.split('-'); return `${d}/${m}/${y}`; };
const fmtCpf = (v) => { const d = (v || '').replace(/\D/g, ''); return d.length === 11 ? `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}` : (v || ''); };
const diariasTxt = (n) => `${n} diária${n !== 1 ? 's' : ''}`;

const initials = (nome) => {
  const p = (nome || '').trim().split(/\s+/).filter(Boolean);
  if (!p.length) return '?';
  if (p.length === 1) return p[0][0].toUpperCase();
  return (p[0][0] + p[p.length - 1][0]).toUpperCase();
};

const STATUS_LABEL = {
  hospedado: 'Hospedado', confirmada: 'Confirmada',
  solicitada: 'Solicitada', finalizado: 'Finalizado', cancelado: 'Cancelado',
};

// ─── Confirm Modal ────────────────────────────────────────────────────────────
function ConfirmModal({ title, message, onConfirm, onCancel }) {
  return (
    <Modal open onClose={onCancel} size="sm" title={title}
      footer={
        <div className={styles.footerRight}>
          <Button variant="secondary" onClick={onCancel}>Cancelar</Button>
          <Button variant="primary"   onClick={onConfirm}>Confirmar</Button>
        </div>
      }
    >
      <p style={{ margin: 0, fontSize: 14, color: 'var(--text)' }}>{message}</p>
    </Modal>
  );
}

// ─── Reserva Detail Modal ─────────────────────────────────────────────────────
function ReservaModal({ reserva, onClose, onCancel, onUpdate, onNotify, categorias, tiposPagamento }) {
  // ── Edit mode ──────────────────────────────────────────────────────────────
  const [editing,      setEditing]      = useState(false);
  const [editQuarto,   setEditQuarto]   = useState([String(reserva.quarto)]);
  const [editCheckin,  setEditCheckin]  = useState(new Date(reserva.dataInicio + 'T00:00:00'));
  const [editCheckout, setEditCheckout] = useState(new Date(reserva.dataFim   + 'T00:00:00'));

  // ── Tabs ───────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('dados');

  // ── Pending ops + dirty tracking ───────────────────────────────────────────
  // Each op: { type: 'addPessoa'|'removePessoa'|'addPagamento'|'cancelPagamento', ...data }
  const [pendingOps,   setPendingOps]   = useState([]);
  const [hasChanges,   setHasChanges]   = useState(false);
  const [showDiscard,  setShowDiscard]  = useState(false);
  const [saving,       setSaving]       = useState(false);

  const addOp = (op) => {
    setPendingOps((prev) => [...prev, op]);
    setHasChanges(true);
  };

  const handleClose = () => {
    if (hasChanges) { setShowDiscard(true); return; }
    onClose();
  };

  const handleDiscard = () => {
    setShowDiscard(false);
    onClose();
  };

  // ── Pessoas ────────────────────────────────────────────────────────────────
  const [pessoas,         setPessoas]         = useState(reserva.hospedes ?? []);
  const [pessoaQuery,     setPessoaQuery]     = useState('');
  const [pessoaResults,   setPessoaResults]   = useState([]);
  const [pessoaSearching, setPessoaSearching] = useState(false);
  const [showAddPessoa,   setShowAddPessoa]   = useState(false);
  const [pendingPessoa,   setPendingPessoa]   = useState(null); // { titular, selected: Set<id> }
  const pessoaTimerRef = useRef(null);

  // ── Pagamentos ─────────────────────────────────────────────────────────────
  const [pagamentos,     setPagamentos]     = useState(reserva.pagamentos ?? []);
  const [showPayModal,   setShowPayModal]   = useState(false);
  const [cancelPagId,    setCancelPagId]    = useState(null);
  const [cancelMotivo,   setCancelMotivo]   = useState('');
  const [viewPagamento,  setViewPagamento]  = useState(null);

  // ── Derived ────────────────────────────────────────────────────────────────
  const totalPago  = pagamentos.filter((p) => !p.cancelado).reduce((s, p) => s + (p.valor ?? 0), 0);
  const pendente   = reserva.valorTotal - totalPago;
  const dias       = diffDays(reserva.dataInicio, reserva.dataFim);
  const cat        = categorias.find((c) => c.quartos.includes(reserva.quarto));
  const allRoomIds = categorias.flatMap((c) => c.quartos);

  // ── Phone display mask ─────────────────────────────────────────────────────
  const fmtPhone = (v) => {
    const d = (v || '').replace(/\D/g, '').slice(0, 11);
    if (!d) return '';
    if (d.length <= 10) return d.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3').replace(/-$/, '');
    return d.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3').replace(/-$/, '');
  };

  // ── Pessoa search ──────────────────────────────────────────────────────────
  const handlePessoaQuery = (val) => {
    setPessoaQuery(val);
    clearTimeout(pessoaTimerRef.current);
    if (val.trim().length < 2) { setPessoaResults([]); return; }
    pessoaTimerRef.current = setTimeout(() => {
      setPessoaSearching(true);
      cadastroApi.listarPessoas({ termo: val.trim(), size: 8 })
        .then((res) => {
          const list = Array.isArray(res) ? res : (res?.content ?? []);
          setPessoaResults(list.map((p) => {
            const r = p.pessoa ?? p;
            return {
              ...r,
              bloqueado: r.status === 'BLOQUEADO',
              acompanhantes: (r.acompanhantes ?? []).map((a) => ({
                id: a.id, nome: a.nome, cpf: a.cpf ?? '',
                bloqueado: a.status === 'BLOQUEADO',
                idade: a.idade ?? null,
              })),
            };
          }));
        })
        .catch(() => {})
        .finally(() => setPessoaSearching(false));
    }, 300);
  };

  // Local-only — queued for save
  const handleAddPessoa = (p) => {
    if (pessoas.find((h) => h.id === p.id)) return;
    setPessoas((prev) => [...prev, {
      id: p.id, nome: p.nome, cpf: p.cpf ?? '',
      telefone: p.celular ?? p.telefone ?? '', email: p.email ?? '',
    }]);
    addOp({ type: 'addPessoa', pessoaId: p.id });
  };

  const handlePessoaResultClick = (p) => {
    if (p.bloqueado) return;
    if (p.acompanhantes?.length > 0) {
      setPendingPessoa({ titular: p, selected: new Set() });
    } else {
      handleAddPessoa(p);
      setShowAddPessoa(false); setPessoaQuery(''); setPessoaResults([]);
    }
  };

  const togglePendingAcomp = (id) => setPendingPessoa((prev) => {
    const next = new Set(prev.selected);
    next.has(id) ? next.delete(id) : next.add(id);
    return { ...prev, selected: next };
  });

  const confirmAddPessoas = (withCompanions) => {
    const toAdd = [pendingPessoa.titular];
    if (withCompanions) {
      pendingPessoa.titular.acompanhantes
        .filter((a) => !a.bloqueado && pendingPessoa.selected.has(a.id))
        .forEach((a) => toAdd.push(a));
    }
    toAdd.forEach((p) => handleAddPessoa(p));
    setPendingPessoa(null); setShowAddPessoa(false); setPessoaQuery(''); setPessoaResults([]);
  };

  const handleRemovePessoa = (pessoaId) => {
    setPessoas((prev) => prev.filter((h) => h.id !== pessoaId));
    // If pessoa was added in this session (pending), just cancel that op
    setPendingOps((prev) => {
      const hadAdd = prev.some((o) => o.type === 'addPessoa' && o.pessoaId === pessoaId);
      if (hadAdd) return prev.filter((o) => !(o.type === 'addPessoa' && o.pessoaId === pessoaId));
      return [...prev, { type: 'removePessoa', pessoaId }];
    });
    setHasChanges(true);
  };

  // ── Pagamentos ─────────────────────────────────────────────────────────────
  // Local-only — queued for save
  const handleAddPagamento = (payment) => {
    const tp = tiposPagamento.find((t) => t.id === payment.tipo_pagamento?.id);
    const localId = `local-${Date.now()}`;
    setPagamentos((prev) => [...prev, {
      id:             localId,
      formaPagamento: tp?.descricao ?? '',
      nomePagador:    payment.nome_pagador ?? '',
      descricao:      payment.descricao ?? '',
      valor:          payment.valor ?? 0,
      cancelado:      false,
    }]);
    addOp({ type: 'addPagamento', localId, payment });
    setShowPayModal(false);
  };

  const handleConfirmCancelPagamento = () => {
    if (!cancelMotivo.trim()) return;
    // Mark cancelled locally
    setPagamentos((prev) => prev.map((p) =>
      p.id === cancelPagId
        ? { ...p, cancelado: true, motivoCancelamento: cancelMotivo.trim() }
        : p
    ));
    // If this is a locally-added payment (not yet saved), just remove both ops
    setPendingOps((prev) => {
      const hadAdd = prev.some((o) => o.type === 'addPagamento' && o.localId === cancelPagId);
      if (hadAdd) return prev.filter((o) => !(o.type === 'addPagamento' && o.localId === cancelPagId));
      return [...prev, { type: 'cancelPagamento', pagId: cancelPagId, motivo: cancelMotivo.trim() }];
    });
    setHasChanges(true);
    setCancelPagId(null);
    setCancelMotivo('');
  };

  // ── Save all pending ops ────────────────────────────────────────────────────
  const handleSaveChanges = async () => {
    setSaving(true);
    try {
      for (const op of pendingOps) {
        if (op.type === 'addPessoa')
          await reservaApi.adicionarPessoa(reserva.id, op.pessoaId);
        else if (op.type === 'removePessoa')
          await reservaApi.removerPessoa(reserva.id, op.pessoaId);
        else if (op.type === 'addPagamento')
          await reservaApi.adicionarPagamento(reserva.id, op.payment);
        else if (op.type === 'cancelPagamento')
          await reservaApi.cancelarPagamento(op.pagId, op.motivo);
      }
      setPendingOps([]);
      setHasChanges(false);
      onNotify?.('Alterações salvas!');
    } catch (e) {
      onNotify?.(e?.message ?? 'Erro ao salvar alterações.', 'error');
    } finally {
      setSaving(false);
    }
  };

  // ── Edit save (quarto/datas) ───────────────────────────────────────────────
  const [editSaving,  setEditSaving]  = useState(false);

  const handleSaveEdit = async () => {
    setEditSaving(true);
    try {
      await onUpdate({
        id:           reserva.id,
        fk_quarto:    parseInt(editQuarto[0]),
        data_entrada: toBrDate(formatDate(editCheckin)),
        data_saida:   toBrDate(formatDate(editCheckout)),
      });
      setEditing(false);
    } finally {
      setEditSaving(false);
    }
  };

  const canSave = editQuarto.length > 0 && editCheckin && editCheckout && editCheckout > editCheckin;

  const TABS = [
    { key: 'dados',      label: 'Dados da Reserva' },
    { key: 'pessoas',    label: `Pessoas (${pessoas.length})` },
    { key: 'pagamentos', label: `Pagamentos (${pagamentos.length})` },
  ];

  // ── Edit mode render ───────────────────────────────────────────────────────
  if (editing) {
    return (
      <Modal open onClose={onClose} size="md"
        title={<><Pencil size={15} /> Editar Reserva — {reserva.titularNome}</>}
        footer={
          <div className={styles.footerSpread}>
            <Button variant="secondary" onClick={() => setEditing(false)}>← Voltar</Button>
            <Button variant="primary" disabled={!canSave || editSaving} onClick={handleSaveEdit}>
              {editSaving && <Loader2 size={13} className={styles.spin} />} Salvar
            </Button>
          </div>
        }
      >
        <div className={styles.formStack}>
          <FormField label="Quarto">
            <RoomCombobox
              value={editQuarto} onChange={setEditQuarto}
              availableRooms={allRoomIds} categorias={categorias} singleSelect
            />
          </FormField>
          <FormField label="Período de estadia">
            <DatePicker
              mode="range" startDate={editCheckin} endDate={editCheckout}
              onRangeChange={({ start, end }) => { setEditCheckin(start); setEditCheckout(end); }}
              placeholder="Check-in → Check-out"
            />
          </FormField>
        </div>
      </Modal>
    );
  }

  // ── View mode render ───────────────────────────────────────────────────────
  return (
    <>
      <Modal open onClose={handleClose} size="md"
        bodyStyle={{ padding: 0, gap: 0 }}
        title={<><BedDouble size={15} /> Quarto {fmtRoom(reserva.quarto)} — {reserva.titularNome}</>}
        footer={
          <div className={styles.footerSpread}>
            <div style={{ display: 'flex', gap: 6 }}>
              <Button variant="danger" onClick={() => { onCancel(reserva.id); onClose(); }}>
                Cancelar Reserva
              </Button>
              <Button variant="secondary" onClick={() => onNotify({ type: 'info', message: 'Funcionalidade em breve.' })}>
                Mover para Pernoites
              </Button>
            </div>
            {hasChanges ? (
              <Button variant="primary" disabled={saving} onClick={handleSaveChanges}>
                {saving ? <><Loader2 size={13} className={styles.spin} /> Salvando...</> : 'Salvar'}
              </Button>
            ) : (
              <Button variant="primary" onClick={() => setEditing(true)}>
                <Pencil size={13} /> Editar
              </Button>
            )}
          </div>
        }
      >
        {/* Tab nav */}
        <div className={styles.detailTabs}>
          {TABS.map((t) => (
            <button key={t.key}
              className={[styles.detailTab, activeTab === t.key ? styles.detailTabActive : ''].join(' ')}
              onClick={() => setActiveTab(t.key)}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Fixed-height scrollable content area */}
        <div className={styles.detailTabContent}>

          {/* ── Dados da Reserva ── */}
          {activeTab === 'dados' && (
            <div className={styles.kvDetailRoot}>
              {/* minimal room + status header */}
              <div className={styles.dadosHeader}>
                <div className={styles.dadosRoomPill}>{fmtRoom(reserva.quarto)}</div>
                <span className={styles.dadosRoomCat}>{cat?.nome || reserva.categoria}</span>
                <span className={[styles.statusBadge, styles[`status_${reserva.status}`]].join(' ')}>
                  {STATUS_LABEL[reserva.status] ?? reserva.status}
                </span>
              </div>

              <div className={styles.kvList}>
                <div className={styles.kvRow}>
                  <span className={styles.kvLabel}>Check-in</span>
                  <span className={styles.kvVal}>
                    {fmtDateBR(reserva.dataInicio)}
                    {reserva.chegadaPrevista && (
                      <span className={styles.kvMeta}> · {reserva.chegadaPrevista.split(' ')[1] ?? '14:00'}</span>
                    )}
                  </span>
                </div>
                <div className={styles.kvRow}>
                  <span className={styles.kvLabel}>Check-out</span>
                  <span className={styles.kvVal}>
                    {fmtDateBR(reserva.dataFim)}
                    {reserva.saidaPrevista && (
                      <span className={styles.kvMeta}> · {reserva.saidaPrevista.split(' ')[1] ?? '12:00'}</span>
                    )}
                  </span>
                </div>
                <div className={styles.kvRow}>
                  <span className={styles.kvLabel}>Duração</span>
                  <span className={styles.kvVal}>{diariasTxt(dias)}</span>
                </div>
                {reserva.empresaNome && (
                  <div className={styles.kvRow}>
                    <span className={styles.kvLabel}>Empresa</span>
                    <span className={styles.kvVal}>{reserva.empresaNome}</span>
                  </div>
                )}
              </div>

              {reserva.observacao && (
                <div className={styles.dadosRegistrado}>
                  <span className={styles.kvLabel}>Observação</span>
                  <span className={styles.kvVal} style={{ whiteSpace: 'pre-wrap' }}>{reserva.observacao}</span>
                </div>
              )}

              {reserva.funcionario && (
                <div className={styles.dadosRegistrado}>
                  <span className={styles.kvLabel}>Registrado por</span>
                  <span className={styles.kvVal}>{reserva.funcionario}</span>
                  {reserva.dataHoraRegistro && (
                    <span className={styles.kvMeta}>{reserva.dataHoraRegistro}</span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Pessoas ── */}
          {activeTab === 'pessoas' && (
            <div className={styles.detailBody}>
              {/* Add button at top */}
              {!showAddPessoa && (
                <button className={styles.addLinkBtn} onClick={() => setShowAddPessoa(true)}>
                  <Plus size={13} /> Adicionar pessoa
                </button>
              )}

              {/* Inline search */}
              {showAddPessoa && (
                <div className={styles.addInlineBox}>
                  <div className={styles.addInlineRow}>
                    <Search size={13} />
                    <input className={styles.addInlineInput}
                      placeholder="Buscar por nome ou CPF..."
                      value={pessoaQuery}
                      onChange={(e) => handlePessoaQuery(e.target.value)}
                      autoFocus />
                    {pessoaSearching
                      ? <Loader2 size={13} className={styles.spin} />
                      : <button className={styles.removeIconBtn}
                          onClick={() => { setShowAddPessoa(false); setPessoaQuery(''); setPessoaResults([]); }}>
                          <X size={12} />
                        </button>
                    }
                  </div>
                  {(pessoaResults.length > 0 || pendingPessoa) && (
                    <div className={styles.inlineDropdown}>
                      {pendingPessoa ? (
                        <>
                          <div className={styles.companionHeader}>
                            <button className={styles.companionBack} onClick={() => setPendingPessoa(null)}><ChevronLeft size={12} /> Voltar</button>
                          </div>
                          {/* Titular */}
                          <div className={styles.companionRow}>
                            <div className={[styles.companionCheck, styles.companionChecked].join(' ')}><Check size={11} /></div>
                            <div className={styles.companionInfo}>
                              <span className={styles.companionName}>{pendingPessoa.titular.nome}</span>
                              {pendingPessoa.titular.cpf && <span className={styles.companionMeta}>{fmtCpf(pendingPessoa.titular.cpf)}</span>}
                            </div>
                            <span className={styles.titularChip}>Titular</span>
                          </div>
                          {/* Companions */}
                          {pendingPessoa.titular.acompanhantes.map((a) => (
                            <div key={a.id}
                              className={[styles.companionRow, a.bloqueado ? styles.searchResultBlocked : styles.companionRowClickable].join(' ')}
                              onClick={() => !a.bloqueado && togglePendingAcomp(a.id)}>
                              <div className={[styles.companionCheck, pendingPessoa.selected.has(a.id) ? styles.companionChecked : ''].join(' ')}>
                                {pendingPessoa.selected.has(a.id) && <Check size={11} />}
                              </div>
                              <div className={styles.companionInfo}>
                                <span className={styles.companionName}>{a.nome}</span>
                                {a.cpf && <span className={styles.companionMeta}>{fmtCpf(a.cpf)}{a.idade ? ` · ${a.idade} anos` : ''}</span>}
                              </div>
                              {a.bloqueado && <span className={styles.blockedChip}>Bloqueado</span>}
                            </div>
                          ))}
                          <div className={styles.companionActions}>
                            <button className={styles.companionBtnSecondary} onClick={() => confirmAddPessoas(false)}>Só o titular</button>
                            <button className={styles.companionBtnPrimary} onClick={() => confirmAddPessoas(true)}>Adicionar →</button>
                          </div>
                        </>
                      ) : (
                        pessoaResults.map((p) => (
                          <button key={p.id}
                            className={[styles.inlineDropdownItem, p.bloqueado ? styles.inlineDropdownItemBlocked : ''].join(' ')}
                            disabled={p.bloqueado}
                            onClick={() => handlePessoaResultClick(p)}>
                            <div className={styles.initialsCircleSm}>{initials(p.nome)}</div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 13, fontWeight: 500 }}>{p.nome}</div>
                              {p.cpf && <div style={{ fontSize: 11, color: 'var(--text-2)' }}>{fmtCpf(p.cpf)}</div>}
                            </div>
                            {p.bloqueado && <span className={styles.blockedChip}>Bloqueado</span>}
                            {p.acompanhantes?.length > 0 && !p.bloqueado && <span className={styles.companionCountChip}>{p.acompanhantes.length} acomp.</span>}
                            {!p.bloqueado && <ChevronRight size={13} style={{ color: 'var(--text-2)', flexShrink: 0 }} />}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}

              {pessoas.length === 0 && (
                <div className={styles.emptyState}>Nenhuma pessoa vinculada.</div>
              )}

              {pessoas.map((h, i) => (
                <div key={h.id} className={styles.pessoaRow}>
                  <div className={styles.pagRowTop}>
                    <span className={styles.pagRowDesc}>{h.nome}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto', flexShrink: 0 }}>
                      <span className={i === 0 ? styles.titularBadge : styles.acompanhanteBadge}>
                        {i === 0 ? 'Titular' : 'Acompanhante'}
                      </span>
                      {i > 0 && (
                        <button className={styles.removeIconBtn} title="Remover"
                          onClick={() => handleRemovePessoa(h.id)}>
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                  {h.telefone && <div className={styles.pagRowMeta}>{fmtPhone(h.telefone)}</div>}
                  {h.email && <div className={styles.pagRowMeta}>{h.email}</div>}
                </div>
              ))}

            </div>
          )}

          {/* ── Pagamentos ── */}
          {activeTab === 'pagamentos' && (
            <div className={styles.detailBody}>
              {/* Summary strip */}
              <div className={styles.finStrip}>
                <span className={styles.finStripItem}>Total <b>{fmtBRL(reserva.valorTotal)}</b></span>
                <span className={styles.finStripDivider} />
                <span className={styles.finStripItem}>Pago <b style={{ color: 'var(--emerald)' }}>{fmtBRL(totalPago)}</b></span>
                <span className={styles.finStripDivider} />
                <span className={styles.finStripItem}>Pendente <b style={{ color: pendente > 0 ? 'var(--violet)' : 'var(--emerald)' }}>{fmtBRL(Math.max(0, pendente))}</b></span>
              </div>

              <button className={styles.addLinkBtn} onClick={() => setShowPayModal(true)}>
                <Plus size={13} /> Adicionar pagamento
              </button>

              {pagamentos.length === 0 && (
                <div className={styles.emptyState}>Nenhum pagamento registrado.</div>
              )}

              {pagamentos.map((p) => (
                <div key={p.id}
                  className={[styles.pagRow, p.cancelado ? styles.pagRowCancelado : '', styles.pagCardClickable].join(' ')}
                  onClick={() => setViewPagamento(p)}>
                  <div className={styles.pagRowTop}>
                    <span className={styles.pagRowDesc}>{p.descricao || p.formaPagamento || 'Pagamento'}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto', flexShrink: 0 }}>
                      <span className={p.cancelado ? styles.pagCardValorCancelado : styles.pagRowVal}>{fmtBRL(p.valor)}</span>
                      {!p.cancelado && (
                        <button className={styles.removeIconBtn} title="Cancelar pagamento"
                          onClick={(e) => { e.stopPropagation(); setCancelPagId(p.id); setCancelMotivo(''); }}>
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className={styles.pagRowMeta}>
                    {p.dataRegistro && <span>{p.dataRegistro}</span>}
                    {p.dataRegistro && <span className={styles.pagCard2Sep}>·</span>}
                    <span>{p.formaPagamento || '—'}</span>
                  </div>
                  {p.nomePagador && <div className={styles.pagRowPagador}>{p.nomePagador}</div>}
                  {p.cancelado && <span className={styles.pagCardCanceladoBadge}>Cancelado</span>}
                </div>
              ))}

            </div>
          )}

        </div>
      </Modal>

      <PaymentModal
        open={showPayModal}
        onClose={() => setShowPayModal(false)}
        onConfirm={handleAddPagamento}
        tiposPagamento={tiposPagamento}
        isSubmitting={false}
        titularNome={reserva.titularNome}
        canAplicarDesconto={false}
      />

      <Modal open={!!viewPagamento} onClose={() => setViewPagamento(null)} size="sm"
        title="Detalhes do Pagamento"
        footer={<div className={styles.footerRight}><Button onClick={() => setViewPagamento(null)}>Fechar</Button></div>}
      >
        {viewPagamento && (
          <div className={styles.kvDetailRoot}>

            {/* ── Pagamento ── */}
            <div className={styles.kvSectionDivider}>Pagamento</div>
            <div className={styles.kvList}>
              <div className={styles.kvRow}>
                <span className={styles.kvLabel}>Forma de Pagamento</span>
                <span className={styles.kvVal}>{viewPagamento.formaPagamento || '—'}</span>
              </div>
              <div className={styles.kvRow}>
                <span className={styles.kvLabel}>Valor</span>
                <span className={[styles.kvVal, viewPagamento.cancelado ? styles.pagCardValorCancelado : styles.finPago].join(' ')}>
                  {fmtBRL(viewPagamento.valor)}
                </span>
              </div>
              <div className={styles.kvRow}>
                <span className={styles.kvLabel}>Pagador</span>
                <span className={styles.kvVal}>{viewPagamento.nomePagador || '—'}</span>
              </div>
              <div className={styles.kvRow}>
                <span className={styles.kvLabel}>Situação</span>
                <span className={viewPagamento.cancelado ? styles.pagCardCanceladoBadge : styles.pagStatusAtivo}>
                  {viewPagamento.cancelado ? 'Cancelado' : 'Ativo'}
                </span>
              </div>
              {viewPagamento.descricao && (
                <div className={[styles.kvRow, styles.kvRowFull].join(' ')}>
                  <span className={styles.kvLabel}>Descrição</span>
                  <span className={styles.kvVal}>{viewPagamento.descricao}</span>
                </div>
              )}
            </div>

            {/* ── Registro ── */}
            <div className={styles.kvSectionDivider}>Registro</div>
            <div className={styles.kvList}>
              <div className={styles.kvRow}>
                <span className={styles.kvLabel}>Registrado por</span>
                <span className={styles.kvVal}>{viewPagamento.funcionario || '—'}</span>
              </div>
              <div className={styles.kvRow}>
                <span className={styles.kvLabel}>Data</span>
                <span className={styles.kvVal}>{viewPagamento.dataRegistro || '—'}</span>
              </div>
            </div>

            {/* ── Cancelamento ── */}
            {viewPagamento.cancelado && (
              <>
                <div className={styles.kvSectionDividerCancel}>Cancelamento</div>
                <div className={styles.kvListCancel}>
                  <div className={styles.kvRow}>
                    <span className={styles.kvLabel}>Cancelado por</span>
                    <span className={styles.kvVal}>{viewPagamento.funcMotivo || '—'}</span>
                  </div>
                  <div className={styles.kvRow}>
                    <span className={styles.kvLabel}>Data</span>
                    <span className={styles.kvVal}>{viewPagamento.dataMotivo || '—'}</span>
                  </div>
                  {viewPagamento.motivoCancelamento && (
                    <div className={[styles.kvRow, styles.kvRowFull].join(' ')}>
                      <span className={styles.kvLabel}>Motivo</span>
                      <span className={styles.kvVal}>{viewPagamento.motivoCancelamento}</span>
                    </div>
                  )}
                </div>
              </>
            )}

          </div>
        )}
      </Modal>

      <Modal open={!!cancelPagId} onClose={() => setCancelPagId(null)} size="sm"
        title="Cancelar Pagamento"
        footer={
          <div className={styles.footerRight}>
            <Button variant="secondary" onClick={() => setCancelPagId(null)}>Voltar</Button>
            <Button variant="danger"
              disabled={!cancelMotivo.trim()}
              onClick={handleConfirmCancelPagamento}>
              Confirmar
            </Button>
          </div>
        }
      >
        <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--text-2)' }}>
          Informe o motivo do cancelamento deste pagamento.
        </p>
        <textarea
          className={styles.motivoTextarea}
          placeholder="Motivo do cancelamento..."
          rows={3}
          value={cancelMotivo}
          onChange={(e) => setCancelMotivo(e.target.value)}
        />
      </Modal>

      {/* ── Discard confirmation ── */}
      <Modal open={showDiscard} onClose={() => setShowDiscard(false)} size="sm"
        title="Descartar alterações?"
        footer={
          <div className={styles.footerRight}>
            <Button variant="secondary" onClick={() => setShowDiscard(false)}>Continuar editando</Button>
            <Button variant="danger" onClick={handleDiscard}>Descartar</Button>
          </div>
        }
      >
        <p style={{ margin: 0, fontSize: 14, color: 'var(--text-2)' }}>
          Há alterações não salvas em pessoas ou pagamentos. Deseja descartá-las?
        </p>
      </Modal>
    </>
  );
}

// ─── Day Modal ────────────────────────────────────────────────────────────────
function DayModal({ dateStr, reservas, onClose, onNewReserva, categorias, onSelectReserva }) {
  const dayReservas    = reservas.filter((r) => r.dataInicio <= dateStr && r.dataFim > dateStr).sort((a, b) => a.quarto - b.quarto);
  const occupiedRooms  = new Set(dayReservas.map((r) => r.quarto));
  const totalRooms     = categorias.flatMap((c) => c.quartos).length;
  const availableRooms = categorias.flatMap((c) => c.quartos).filter((r) => !occupiedRooms.has(r));
  const totalPeople    = dayReservas.reduce((s, r) => s + (r.hospedes?.length || (1 + (r.quantidadeAcompanhantes || 0))), 0);
  const dayObj  = new Date(dateStr + 'T00:00:00');
  const weekday = dayObj.toLocaleDateString('pt-BR', { weekday: 'long' });
  const cap     = weekday.charAt(0).toUpperCase() + weekday.slice(1);
  return (
    <Modal open onClose={onClose} size="lg"
      title={<><CalendarDays size={15} /> {cap}, {fmtDateBR(dateStr)}</>}
      footer={
        <div className={styles.footerSpread}>
          <span className={styles.footerInfo}>
            {availableRooms.length} quarto{availableRooms.length !== 1 ? 's' : ''} disponível{availableRooms.length !== 1 ? 'is' : ''}
          </span>
          <div className={styles.footerRight}>
            <Button variant="primary" onClick={() => { onClose(); onNewReserva(dateStr, availableRooms); }}>
              <Plus size={13} /> Nova Reserva
            </Button>
            <Button variant="secondary" onClick={onClose}>Fechar</Button>
          </div>
        </div>
      }
    >
      {/* Minimalist stats strip */}
      <div className={styles.dayStatsStrip}>
        <span className={styles.dayStatChip}><b>{occupiedRooms.size}</b>/{totalRooms} quartos ocupados</span>
        <span className={styles.dayStatDivider} />
        <span className={styles.dayStatChip}><b>{dayReservas.length}</b> reserva{dayReservas.length !== 1 ? 's' : ''} confirmada{dayReservas.length !== 1 ? 's' : ''}</span>
        <span className={styles.dayStatDivider} />
        <span className={styles.dayStatChip}><b>{totalPeople}</b> pessoa{totalPeople !== 1 ? 's' : ''}</span>
        <span className={styles.dayStatDivider} />
        <span className={styles.dayStatChip} style={{ color: 'var(--emerald)' }}><b>{availableRooms.length}</b> quartos disponíveis</span>
      </div>

      {dayReservas.length === 0 ? (
        <div className={styles.emptyState}>Nenhuma reserva para este dia.</div>
      ) : (
        <div className={styles.dayRoomList}>
          {dayReservas.map((r) => {
            const dias     = diffDays(r.dataInicio, r.dataFim);
            const nPessoas = r.hospedes?.length ?? (1 + (r.quantidadeAcompanhantes ?? 0));
            return (
              <div key={r.id} className={[styles.dayRoomRow, styles[`dayRoom_${r.status}`]].join(' ')}
                onClick={() => onSelectReserva(r)}>
                <div className={[styles.dayRoomBadge, styles[`dayRoomBadge_${r.status}`]].join(' ')}>{fmtRoom(r.quarto)}</div>
                <div className={styles.searchDropInfo}>
                  <div className={styles.searchDropName}>{r.titularNome}</div>
                  <div className={styles.searchDropDates}>{fmtDateBR(r.dataInicio)} → {fmtDateBR(r.dataFim)}</div>
                  <div className={styles.searchDropMeta}>{diariasTxt(dias)} · {nPessoas} pessoa{nPessoas !== 1 ? 's' : ''}</div>
                </div>
                <span className={[styles.statusBadgeSm, styles[`status_${r.status}`]].join(' ')}>{STATUS_LABEL[r.status]}</span>
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}

// ─── Room Modal ───────────────────────────────────────────────────────────────
function RoomModal({ room, reservas, onClose, categorias, onSelectReserva }) {
  const cat          = categorias.find((c) => c.quartos.includes(room));
  const roomReservas = [...reservas].filter((r) => r.quarto === room).sort((a, b) => a.dataInicio.localeCompare(b.dataInicio));
  const totalPessoas = roomReservas.reduce((s, r) => s + (r.hospedes?.length || (1 + (r.quantidadeAcompanhantes || 0))), 0);
  return (
    <Modal open onClose={onClose} size="md"
      title={<><BedDouble size={15} /> Quarto {fmtRoom(room)} — {cat?.nome || ''}</>}
      footer={<div className={styles.footerRight}><Button variant="secondary" onClick={onClose}>Fechar</Button></div>}
    >
      {/* Stats strip */}
      <div className={styles.dayStatsStrip}>
        <span className={styles.dayStatChip}><b>{roomReservas.length}</b> reserva{roomReservas.length !== 1 ? 's' : ''}</span>
        <span className={styles.dayStatDivider} />
        <span className={styles.dayStatChip}><b>{totalPessoas}</b> pessoa{totalPessoas !== 1 ? 's' : ''} no total</span>
        <span className={styles.dayStatDivider} />
        <span className={styles.dayStatChip}>{cat?.nome || '—'}</span>
      </div>
      {roomReservas.length === 0 ? (
        <div className={styles.emptyState}>Nenhuma reserva registrada.</div>
      ) : (
        <div className={styles.dayRoomList}>
          {roomReservas.map((r) => {
            const dias     = diffDays(r.dataInicio, r.dataFim);
            const nPessoas = r.hospedes?.length ?? (1 + (r.quantidadeAcompanhantes ?? 0));
            return (
              <div key={r.id} className={[styles.dayRoomRow, styles[`dayRoom_${r.status}`]].join(' ')}
                onClick={() => onSelectReserva(r)}>
                <div className={[styles.dayRoomBadge, styles[`dayRoomBadge_${r.status}`]].join(' ')}>{fmtRoom(r.quarto)}</div>
                <div className={styles.searchDropInfo}>
                  <div className={styles.searchDropName}>{r.titularNome}</div>
                  <div className={styles.searchDropDates}>{fmtDateBR(r.dataInicio)} → {fmtDateBR(r.dataFim)}</div>
                  <div className={styles.searchDropMeta}>{diariasTxt(dias)} · {nPessoas} pessoa{nPessoas !== 1 ? 's' : ''}</div>
                </div>
                <span className={[styles.statusBadgeSm, styles[`status_${r.status}`]].join(' ')}>{STATUS_LABEL[r.status]}</span>
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}

// ─── Solicitações Modal — list style like RoomModal ───────────────────────────
function SolicitacoesModal({ reservas, allRooms, onClose, onApprove, onReject }) {
  const [view,     setView]     = useState('list');
  const [selected, setSelected] = useState(null);
  const [sqQuarto, setSqQuarto] = useState('');
  const [sqObs,    setSqObs]    = useState('');
  const [saving,   setSaving]   = useState(false);

  const solicitadas = reservas.filter((r) => r.status === 'solicitada');

  const openDetail = (r) => {
    setSelected(r); setSqQuarto(''); setSqObs(''); setView('detail');
  };

  const handleApprove = async () => {
    if (!sqQuarto) return;
    setSaving(true);
    try { await onApprove(selected.id, parseInt(sqQuarto), sqObs); }
    finally { setSaving(false); }
  };

  const handleReject = async () => {
    setSaving(true);
    try { await onReject(selected.id); }
    finally { setSaving(false); }
  };

  if (view === 'detail' && selected) {
    const dias     = diffDays(selected.dataInicio, selected.dataFim);
    const pendente = Math.max(0, (selected.valorTotal || 0) - (selected.totalPago || 0));
    return (
      <Modal open onClose={onClose} size="md"
        title={<><Bell size={15} /> Solicitação — {selected.titularNome}</>}
        footer={
          <div className={styles.footerSpread}>
            <Button variant="secondary" onClick={() => setView('list')}>← Voltar</Button>
            <div className={styles.footerRight}>
              <Button variant="danger" disabled={saving} onClick={handleReject}>
                {saving && <Loader2 size={13} className={styles.spin} />} Rejeitar
              </Button>
              <Button variant="primary" disabled={!sqQuarto || saving} onClick={handleApprove}>
                {saving && <Loader2 size={13} className={styles.spin} />} Aprovar
              </Button>
            </div>
          </div>
        }
      >
        <div className={styles.detailBody}>
          <div className={styles.detailGrid2}>
            <div className={styles.detailBox}><span className={styles.detailLabel}>Check-in</span><span className={styles.detailValue}>{fmtDateBR(selected.dataInicio)}</span></div>
            <div className={styles.detailBox}><span className={styles.detailLabel}>Check-out</span><span className={styles.detailValue}>{fmtDateBR(selected.dataFim)}</span></div>
          </div>
          <div className={styles.detailBox}><span className={styles.detailLabel}>Período</span><span className={styles.detailValue}>{diariasTxt(dias)}</span></div>
          <div className={styles.detailBox}>
            <span className={styles.detailLabel}>Hóspedes ({selected.hospedes?.length ?? 0})</span>
            <div className={styles.hospedeList}>
              {(selected.hospedes || []).map((h) => (
                <div key={h.id} className={styles.hospedeRow}>
                  <div className={styles.hospedeAvatar}>{initials(h.nome)}</div>
                  <div><div className={styles.hospedeName}>{h.nome}</div>{h.cpf && <div className={styles.hospedeCpf}>{h.cpf}</div>}</div>
                </div>
              ))}
            </div>
          </div>
          <div className={styles.detailBox}>
            <span className={styles.detailLabel}>Financeiro</span>
            <div className={styles.finGrid}>
              <div className={styles.finBox}><span className={styles.finBoxLabel}>Total</span><span className={styles.finTotal}>{fmtBRL(selected.valorTotal)}</span></div>
              <div className={styles.finBox}><span className={styles.finBoxLabel}>Pago</span><span className={styles.finPago}>{fmtBRL(selected.totalPago)}</span></div>
              <div className={styles.finBox}><span className={styles.finBoxLabel}>Pendente</span><span className={pendente > 0 ? styles.finPendente : styles.finPago}>{fmtBRL(pendente)}</span></div>
            </div>
          </div>
          <div className={styles.detailBox}>
            <span className={styles.detailLabel}>Atribuir Quarto</span>
            <select className={styles.formSelect} value={sqQuarto} onChange={(e) => setSqQuarto(e.target.value)}>
              <option value="">Selecione um quarto...</option>
              {allRooms.map((r) => <option key={r} value={r}>Quarto {fmtRoom(r)}</option>)}
            </select>
          </div>
          <div className={styles.detailBox}>
            <span className={styles.detailLabel}>Observação (opcional)</span>
            <textarea className={styles.obsTextarea} value={sqObs} onChange={(e) => setSqObs(e.target.value)} placeholder="Mensagem para o hóspede..." rows={3} />
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open onClose={onClose} size="md"
      title={<><Bell size={15} /> Solicitações ({solicitadas.length})</>}
      footer={<div className={styles.footerRight}><Button variant="secondary" onClick={onClose}>Fechar</Button></div>}
    >
      {solicitadas.length === 0 ? (
        <div className={styles.emptyState}>Nenhuma solicitação pendente.</div>
      ) : (
        <div className={styles.roomHistoryList}>
          {solicitadas.map((r) => {
            const dias = diffDays(r.dataInicio, r.dataFim);
            return (
              <div key={r.id} className={styles.roomHistoryRow} style={{ cursor: 'pointer' }} onClick={() => openDetail(r)}>
                <div className={styles.roomHistoryLeft}>
                  <div className={styles.roomHistoryDates}>
                    <span className={styles.roomHistoryDate}>{fmtDateBR(r.dataInicio)}</span>
                    <span className={styles.roomHistoryArrow}>→</span>
                    <span className={styles.roomHistoryDate}>{fmtDateBR(r.dataFim)}</span>
                    <span className={styles.roomHistoryNights}>{diariasTxt(dias)}</span>
                  </div>
                  <div className={styles.roomHistoryTitle}>{r.titularNome}</div>
                </div>
                <div className={styles.roomHistoryHospedes}>
                  {(r.hospedes || []).slice(0, 4).map((h) => (
                    <div key={h.id} className={styles.initialsCircleSm} title={h.nome}>{initials(h.nome)}</div>
                  ))}
                  {(r.hospedes || []).length > 4 && <div className={styles.initialsCircleSm}>+{r.hospedes.length - 4}</div>}
                </div>
                <span className={[styles.statusBadgeSm, styles.status_solicitada].join(' ')}>Solicitada</span>
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}

// ─── Room Combobox (single or multi-select) ───────────────────────────────────
function RoomCombobox({ value, onChange, availableRooms, categorias, singleSelect = false, disabled = false }) {
  const [open,      setOpen]      = useState(false);
  const [filter,    setFilter]    = useState('');
  const [dropStyle, setDropStyle] = useState({});
  const triggerRef = useRef(null);
  const dropRef    = useRef(null);

  const updatePos = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const dropH = Math.min(280, 400);
    const openAbove = spaceBelow < dropH && rect.top > dropH;
    setDropStyle({
      position: 'fixed',
      zIndex: 9999,
      width: rect.width,
      left: rect.left,
      top: openAbove ? rect.top - dropH - 4 : rect.bottom + 4,
      maxHeight: openAbove ? rect.top - 8 : spaceBelow - 8,
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePos();
    window.addEventListener('scroll', updatePos, true);
    window.addEventListener('resize', updatePos);
    return () => {
      window.removeEventListener('scroll', updatePos, true);
      window.removeEventListener('resize', updatePos);
    };
  }, [open, updatePos]);

  useEffect(() => {
    const h = (e) => {
      const inTrigger = triggerRef.current && triggerRef.current.contains(e.target);
      const inDrop    = dropRef.current    && dropRef.current.contains(e.target);
      if (!inTrigger && !inDrop) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const handleSelect = (r) => {
    if (!availableRooms.includes(r)) return;
    if (singleSelect) {
      onChange([String(r)]);
      setOpen(false);
    } else {
      const rs = String(r);
      onChange(value.includes(rs) ? value.filter((x) => x !== rs) : [...value, rs]);
    }
  };

  const fl = filter.toLowerCase();
  const label = value.length === 0
    ? (singleSelect ? 'Selecione um quarto...' : 'Selecione quarto(s)...')
    : `Quarto ${fmtRoom(parseInt(value[0]))}${!singleSelect && value.length > 1 ? ` +${value.length - 1}` : ''}`;

  const dropdown = open && createPortal(
    <div ref={dropRef} className={styles.comboDropdown} style={{ ...dropStyle, overflowY: 'auto' }}>
      <div className={styles.comboSearchWrap}>
        <Search size={12} className={styles.comboSearchIcon} />
        <input
          className={styles.comboSearchInput}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filtrar quarto..."
          autoFocus
        />
      </div>
      {categorias.map((cat) => {
        const rows = cat.quartos.filter((r) =>
          !fl || fmtRoom(r).includes(fl) || cat.nome.toLowerCase().includes(fl)
        );
        if (!rows.length) return null;
        return (
          <div key={cat.id}>
            <div className={styles.comboGroupLabel}>{cat.nome}</div>
            {rows.map((r) => {
              const avail = availableRooms.includes(r);
              const sel   = value.includes(String(r));
              return (
                <div key={r}
                  className={[styles.comboItem, sel ? styles.comboItemSel : '', !avail ? styles.comboItemUnavail : ''].join(' ')}
                  onClick={() => handleSelect(r)}
                >
                  {!singleSelect && (
                    <div className={[styles.comboCheck, sel ? styles.comboCheckSel : ''].join(' ')}>{sel && '✓'}</div>
                  )}
                  <span className={styles.comboItemNum}>Quarto {fmtRoom(r)}</span>
                  <span className={styles.comboItemTipo}>{cat.nome}</span>
                  {!avail && <span className={styles.comboItemOcupado}>Ocupado</span>}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>,
    document.body
  );

  return (
    <div className={styles.comboWrap}>
      <button ref={triggerRef} type="button" className={styles.comboTrigger}
        onClick={() => { if (!disabled) { setOpen((o) => !o); setFilter(''); } }}
        disabled={disabled} style={disabled ? { opacity: 0.45, cursor: 'not-allowed' } : undefined}
      >
        <span className={value.length === 0 ? styles.comboPlaceholder : ''}>{label}</span>
        <ChevronDown size={13} style={{ flexShrink: 0, transition: 'transform 0.18s', transform: open ? 'rotate(180deg)' : '' }} />
      </button>
      {dropdown}
      {!singleSelect && value.length > 0 && (
        <div className={styles.comboChips}>
          {value.map((q) => (
            <div key={q} className={styles.hospedeChipRect}>
              <span>Quarto {fmtRoom(parseInt(q))}</span>
              <button type="button" className={styles.chipRemove} onClick={() => handleSelect(parseInt(q))}><X size={10} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Room Hospedes Picker ─────────────────────────────────────────────────────
function RoomHospedesPicker({ value = [], onChange }) {
  const [search,    setSearch]    = useState('');
  const [results,   setResults]   = useState([]);
  const [searching, setSearching] = useState(false);
  const [dropStyle, setDropStyle] = useState({});
  const [pending,   setPending]   = useState(null); // { titular, selected: Set<id> }
  const inputRef = useRef(null);

  useEffect(() => {
    if (search.trim().length < 2) { setResults([]); setPending(null); return; }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const res  = await cadastroApi.listarPessoas({ termo: search.trim(), size: 6 });
        const list = Array.isArray(res) ? res : (res.content ?? []);
        const mapPessoa = (p) => ({
          id: p.id, nome: p.nome, cpf: p.cpf ?? '',
          dataNascimento: p.data_nascimento ?? '',
          bloqueado: p.status === 'BLOQUEADO',
          acompanhantes: (p.acompanhantes ?? []).map((a) => ({
            id: a.id, nome: a.nome, cpf: a.cpf ?? '',
            dataNascimento: a.data_nascimento ?? '',
            bloqueado: a.status === 'BLOQUEADO',
            idade: a.idade ?? null,
          })),
        });
        setResults(list.map(mapPessoa));
      } catch { setResults([]); }
      finally  { setSearching(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const calcDropPos = (maxH = 260) => {
    if (!inputRef.current) return;
    const rect = inputRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - 8;
    setDropStyle({ position: 'fixed', zIndex: 99999, left: rect.left, top: rect.bottom + 4, width: rect.width, maxHeight: Math.min(maxH, spaceBelow) });
  };

  useEffect(() => { if (results.length) calcDropPos(); }, [results]);

  const addMany = (list) => {
    const existing = new Set(value.map((x) => x.id));
    const toAdd = list.filter((h) => !existing.has(h.id));
    if (toAdd.length) onChange([...value, ...toAdd]);
  };

  const handleResultClick = (h) => {
    if (h.bloqueado) return;
    if (h.acompanhantes?.length > 0) {
      setPending({ titular: h, selected: new Set() });
      calcDropPos(320);
    } else {
      addMany([h]);
      setSearch(''); setResults([]);
    }
  };

  const toggleCompanion = (id) => setPending((prev) => {
    const next = new Set(prev.selected);
    next.has(id) ? next.delete(id) : next.add(id);
    return { ...prev, selected: next };
  });

  const confirmAdd = (withCompanions) => {
    const toAdd = [pending.titular];
    if (withCompanions) {
      pending.titular.acompanhantes
        .filter((a) => !a.bloqueado && pending.selected.has(a.id))
        .forEach((a) => toAdd.push(a));
    }
    addMany(toAdd);
    setPending(null); setSearch(''); setResults([]);
  };

  const rem = (id) => onChange(value.filter((x) => x.id !== id));

  const showDrop = pending !== null || results.length > 0;
  const dropdown = showDrop && createPortal(
    <div className={styles.searchResultsList} style={{ ...dropStyle, overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,0.18)' }}>
      {pending ? (
        <>
          <div className={styles.companionHeader}>
            <button className={styles.companionBack} onClick={() => setPending(null)}><ChevronLeft size={12} /> Voltar</button>
          </div>
          {/* Titular — always included */}
          <div className={styles.companionRow}>
            <div className={[styles.companionCheck, styles.companionChecked].join(' ')}><Check size={11} /></div>
            <div className={styles.companionInfo}>
              <span className={styles.companionName}>{pending.titular.nome}</span>
              {pending.titular.cpf && <span className={styles.companionMeta}>{fmtCpf(pending.titular.cpf)}</span>}
            </div>
            <span className={styles.titularChip}>Titular</span>
          </div>
          {/* Companions */}
          {pending.titular.acompanhantes.map((a) => (
            <div key={a.id}
              className={[styles.companionRow, a.bloqueado ? styles.searchResultBlocked : styles.companionRowClickable].join(' ')}
              onClick={() => !a.bloqueado && toggleCompanion(a.id)}>
              <div className={[styles.companionCheck, pending.selected.has(a.id) ? styles.companionChecked : ''].join(' ')}>
                {pending.selected.has(a.id) && <Check size={11} />}
              </div>
              <div className={styles.companionInfo}>
                <span className={styles.companionName}>{a.nome}</span>
                <span className={styles.companionMeta}>
                  {a.cpf ? fmtCpf(a.cpf) : ''}{a.idade ? ` · ${a.idade} anos` : ''}
                </span>
              </div>
              {a.bloqueado && <span className={styles.blockedChip}>Bloqueado</span>}
            </div>
          ))}
          <div className={styles.companionActions}>
            <button className={styles.companionBtnSecondary} onClick={() => confirmAdd(false)}>Só o titular</button>
            <button className={styles.companionBtnPrimary} onClick={() => confirmAdd(true)}>Adicionar →</button>
          </div>
        </>
      ) : (
        results.map((h) => (
          <div key={h.id}
            className={[styles.searchResultItem, h.bloqueado ? styles.searchResultBlocked : ''].join(' ')}
            onClick={() => handleResultClick(h)}>
            <div className={styles.searchResultName}>{h.nome}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {h.cpf && <div className={styles.hospedeCpf}>{fmtCpf(h.cpf)}</div>}
              {h.acompanhantes?.length > 0 && !h.bloqueado && <span className={styles.companionCountChip}>{h.acompanhantes.length} acomp.</span>}
              {h.bloqueado && <span className={styles.blockedChip}>Bloqueado</span>}
            </div>
            {!h.bloqueado && <ChevronRight size={13} className={styles.addIcon} />}
          </div>
        ))
      )}
    </div>,
    document.body
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div className={styles.hospSearchWrap}>
        {searching
          ? <Loader2 size={13} className={[styles.hospSearchIcon, styles.spin].join(' ')} />
          : <Search size={13} className={styles.hospSearchIcon} />}
        <input ref={inputRef} className={styles.formInput} style={{ paddingLeft: 30 }} value={search}
          onChange={(e) => setSearch(e.target.value)} placeholder="Buscar hóspede..." />
      </div>
      {dropdown}
      {value.length > 0 && (
        <div className={styles.selectedChips}>
          {value.map((h) => (
            <div key={h.id} className={styles.hospedeChipRect}>
              <span>{h.nome}</span>
              <button type="button" className={styles.chipRemove} onClick={() => rem(h.id)}><X size={10} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Create Reservation Modal ─────────────────────────────────────────────────
function CreateModal({ initialRoom, initialStart, initialEnd, initialAvailable, reservas, onClose, onSave, onNotify, categorias, tiposPagamento }) {
  const STEPS = ['Tipo', 'Quarto, Período & Hóspedes', 'Resumo & Pagamento'];

  const [step,        setStep]        = useState(initialRoom ? 2 : 1);
  const [tipo,        setTipo]        = useState('simples');  // 'simples' | 'grupo'
  const [isOrcamento, setIsOrcamento] = useState(false);


  // Step 2: período único
  const [quartos,        setQuartos]        = useState(initialRoom ? [String(initialRoom)] : []);
  const [checkin,        setCheckin]        = useState(initialStart ? new Date(initialStart + 'T00:00:00') : null);
  const [checkout,       setCheckout]       = useState(initialEnd   ? new Date(initialEnd   + 'T00:00:00') : null);
  const [quartoHospedes, setQuartoHospedes] = useState({}); // { [quartoId]: [hospede] }

  // Step 2: múltiplos períodos
  const [periodoMode,    setPeriodoMode]    = useState('unico'); // 'unico' | 'multiplos'
  const [periodos,       setPeriodos]       = useState([]);      // [{ rooms, checkin, checkout, roomHospedes }]
  const [mpRooms,        setMpRooms]        = useState([]);
  const [mpCheckin,      setMpCheckin]      = useState(null);
  const [mpCheckout,     setMpCheckout]     = useState(null);
  const [mpRoomHospedes, setMpRoomHospedes] = useState({}); // { [quartoId]: [hospede] } for current mp form

  // Step 3: Pagamentos

  const [quartosPag,     setQuartosPag]     = useState({});         // { [quartoId]: [payment] } individual
  const [showPagModal,   setShowPagModal]   = useState(false);
  const [showPagModalRoom, setShowPagModalRoom] = useState(null);   // quartoId for individual mode
  const [quartosObs,     setQuartosObs]     = useState({}); // { [quartoId]: string }
  const [saving,      setSaving]      = useState(false);
  const [precosCalc,       setPrecosCalc]       = useState({}); // { [`${quartoId}_${periodoIdx}`]: calcResponse }
  const [calcLoading,      setCalcLoading]      = useState(false);
  const [showPriceDetails, setShowPriceDetails] = useState(false);
  const [roomPriceOpen,    setRoomPriceOpen]    = useState({}); // { [`${q}_${pi}`]: bool }

  // Derived
  const checkinStr  = checkin  ? formatDate(checkin)  : '';
  const checkoutStr = checkout ? formatDate(checkout) : '';
  const dias        = checkinStr && checkoutStr ? diffDays(checkinStr, checkoutStr) : 0;

  const allRoomIds = useMemo(() => categorias.flatMap((c) => c.quartos), [categorias]);

  const availableRooms = useMemo(() => {
    if (!checkinStr || !checkoutStr) return initialAvailable || allRoomIds;
    return allRoomIds.filter(
      (r) => !reservas.some((res) => res.quarto === r && res.dataInicio < checkoutStr && res.dataFim > checkinStr)
    );
  }, [checkinStr, checkoutStr, reservas, initialAvailable, allRoomIds]);

  const mpAvailableRooms = useMemo(() => {
    if (!mpCheckin || !mpCheckout) return allRoomIds;
    const ci = formatDate(mpCheckin);
    const co = formatDate(mpCheckout);
    const alreadyPicked = periodos.flatMap((p) => {
      const pi = formatDate(p.checkin); const po = formatDate(p.checkout);
      if (pi < co && po > ci) return p.rooms.map((r) => parseInt(r));
      return [];
    });
    return allRoomIds.filter(
      (r) => !alreadyPicked.includes(r) && !reservas.some((res) => res.quarto === r && res.dataInicio < co && res.dataFim > ci)
    );
  }, [mpCheckin, mpCheckout, periodos, reservas, allRoomIds]);


  const addPagamento = (payment) => {
    const entry = { _localId: Date.now(), _criadoEm: new Date().toLocaleString('pt-BR'), ...payment };
    if (showPagModalRoom !== null) {
      setQuartosPag((prev) => ({ ...prev, [showPagModalRoom]: [...(prev[showPagModalRoom] || []), entry] }));
    }
    setShowPagModal(false);
    setShowPagModalRoom(null);
  };

  const addPeriodo = () => {
    if (!mpRooms.length || !mpCheckin || !mpCheckout) return;
    setPeriodos((p) => [...p, { rooms: [...mpRooms], checkin: mpCheckin, checkout: mpCheckout, roomHospedes: { ...mpRoomHospedes } }]);
    setMpRooms([]); setMpCheckin(null); setMpCheckout(null); setMpRoomHospedes({});
  };

  const allSelectedRooms = periodoMode === 'multiplos'
    ? [...new Set(periodos.flatMap((p) => p.rooms))]
    : quartos;

  const canNext2 = periodoMode === 'unico'
    ? quartos.length > 0 && checkinStr && checkoutStr && dias > 0
    : periodos.length > 0;

  // Derived: all unique hospedes across all rooms/periods
  const allHospedes = useMemo(() => {
    const seen = new Set();
    const list = periodoMode === 'unico'
      ? Object.values(quartoHospedes).flat()
      : periodos.flatMap((p) => Object.values(p.roomHospedes || {}).flat());
    return list.filter((h) => { if (seen.has(h.id)) return false; seen.add(h.id); return true; });
  }, [periodoMode, quartoHospedes, periodos]);

  const isoToBr = (iso) => iso.split('-').reverse().join('/'); // "yyyy-MM-dd" → "dd/MM/yyyy"

  const runCalcPrecos = async () => {
    setCalcLoading(true);
    setPrecosCalc({});
    setShowPriceDetails(false);
    setRoomPriceOpen({});
    try {
      const displayPeriodos = periodoMode === 'unico'
        ? [{ rooms: quartos, checkin: checkinStr, checkout: checkoutStr, roomHospedes: quartoHospedes }]
        : periodos.map((p) => ({ ...p, checkin: formatDate(p.checkin), checkout: formatDate(p.checkout) }));

      const results = {};
      await Promise.all(
        displayPeriodos.flatMap((p, pi) =>
          p.rooms.map(async (quartoId) => {
            const hospedes = p.roomHospedes?.[quartoId] || [];
            const datas_nascimento = hospedes
              .filter((h) => h.dataNascimento)
              .map((h) => /^\d{4}-\d{2}-\d{2}$/.test(h.dataNascimento) ? isoToBr(h.dataNascimento) : h.dataNascimento);
            try {
              const res = await reservaApi.calcularPreco({
                fk_quarto:    parseInt(quartoId),
                data_entrada: toBrDate(p.checkin),
                data_saida:   toBrDate(p.checkout),
                datas_nascimento,
              });
              results[`${quartoId}_${pi}`] = res;
            } catch { /* silent */ }
          })
        )
      );
      setPrecosCalc(results);
    } finally {
      setCalcLoading(false);
    }
  };

  const handleGoToStep3 = async () => { setStep(3); await runCalcPrecos(); };

  const handleSave = async () => {
    if (isOrcamento) { onNotify('Orçamento gerado! (Em desenvolvimento)'); onClose(); return; }
    setSaving(true);
    try {
      const toIds = (hospedes) => (hospedes || [])
        .filter((h) => h.id && !String(h.id).startsWith('tmp-'))
        .map((h) => ({ id: h.id }));

      const cleanPags = (pags) => pags.map(({ _localId, ...pg }) => pg);
      const buildItem = (quartoId, dataEntrada, dataSaida, hospedes) => {
        const roomPags = cleanPags(quartosPag[quartoId] || []);
        return {
          fk_quarto:    parseInt(quartoId),
          data_entrada: toBrDate(dataEntrada),
          data_saida:   toBrDate(dataSaida),
          ...(hospedes?.length ? { pessoas: hospedes } : {}),
          ...(roomPags.length  ? { pagamentos: roomPags } : {}),
          ...(quartosObs[quartoId]?.trim() ? { observacao: quartosObs[quartoId].trim() } : {}),
        };
      };

      let reservasBody;
      if (periodoMode === 'multiplos') {
        reservasBody = periodos.flatMap((p) =>
          p.rooms.map((q) => buildItem(q, formatDate(p.checkin), formatDate(p.checkout), toIds(p.roomHospedes?.[q] || [])))
        );
      } else {
        reservasBody = quartos.map((q) => buildItem(q, checkinStr, checkoutStr, toIds(quartoHospedes[q] || [])));
      }
      await onSave(reservasBody);
    } finally { setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} size="lg"
      title={<><Plus size={15} /> Nova Reserva</>}
      footer={
        <div className={styles.footerSpread}>
          <div>{step > 1 && <Button variant="secondary" onClick={() => { setStep((s) => s - 1); if (step === 3) { setPrecosCalc({}); setShowPriceDetails(false); setRoomPriceOpen({}); } }}>Voltar</Button>}</div>
          <div className={styles.footerRight}>
            <Button variant="secondary" onClick={onClose}>Cancelar</Button>
            {step < 3 ? (
              <Button variant="primary" disabled={step === 2 && !canNext2} onClick={step === 2 ? handleGoToStep3 : () => setStep((s) => s + 1)}>Próximo</Button>
            ) : (
              <Button variant="primary" disabled={!canNext2 || saving} onClick={handleSave}>
                {saving && <Loader2 size={13} className={styles.spin} />}
                {isOrcamento ? 'Gerar Orçamento' : 'Criar Reserva'}
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
      {/* Step bar */}
      <div className={styles.stepBar}>
        {STEPS.map((s, i) => (
          <div key={i} className={[styles.stepItem, step === i + 1 ? styles.stepActive : '', step > i + 1 ? styles.stepDone : ''].join(' ')}>
            <div className={styles.stepDot}>{step > i + 1 ? '✓' : i + 1}</div>
            <span className={styles.stepLabel}>{s}</span>
          </div>
        ))}
      </div>

      {/* Live summary bar — hidden on step 3 (replaced by period bands below) */}
      {step !== 3 && (allSelectedRooms.length > 0 || checkinStr) && (
        <div className={styles.summaryBar}>
          {allSelectedRooms.length > 0 && (
            <span>{allSelectedRooms.length === 1 ? `Quarto ${fmtRoom(parseInt(allSelectedRooms[0]))}` : `${allSelectedRooms.length} quartos`}</span>
          )}
          {periodoMode === 'unico' && checkinStr && checkoutStr && dias > 0 && (
            <span>{fmtDateBR(checkinStr)} → {fmtDateBR(checkoutStr)} · {diariasTxt(dias)}</span>
          )}
          {periodoMode === 'multiplos' && periodos.length > 0 && (
            <span>{periodos.length} período{periodos.length !== 1 ? 's' : ''}</span>
          )}
          {isOrcamento && <span className={styles.orcamentoBadge}>Orçamento</span>}
        </div>
      )}

      {/* Period bands — shown on step 3 in place of summaryBar */}
      {step === 3 && periodoMode === 'unico' && checkinStr && checkoutStr && (
        <div className={styles.step3PeriodoBandTop}>
          <span className={styles.step3PeriodoBandDates}>{fmtDateBR(checkinStr)} → {fmtDateBR(checkoutStr)} · {diariasTxt(dias)}</span>
        </div>
      )}

      {/* ── Step content (scrollable) ── */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>

      {/* ── Step 1: Tipo ──────────────────────────────────────────────────── */}
      {step === 1 && (
        <div className={styles.formStack}>
          <FormField label="Tipo de Reserva">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div className={styles.tipoRow}>
                {[['simples', 'Reserva Simples'], ['grupo', 'Múltiplas Reservas']].map(([v, l]) => (
                  <button key={v} type="button"
                    className={[styles.tipoBtn, tipo === v ? styles.tipoBtnActive : ''].join(' ')}
                    onClick={() => { setTipo(v); if (v !== 'grupo') setQuartos((q) => q.slice(0, 1)); }}
                  >{l}</button>
                ))}
              </div>
              <label className={styles.orcamentoToggle}>
                <input type="checkbox" checked={isOrcamento} onChange={(e) => setIsOrcamento(e.target.checked)} />
                <span>Simular Orçamento</span>
              </label>
            </div>
          </FormField>
        </div>
      )}

      {/* ── Step 2: Quarto & Período ───────────────────────────────────────── */}
      {step === 2 && (
        <div className={styles.formStack}>
          {/* Período mode tabs — ocultos quando um quarto específico já foi pré-selecionado */}
          {!initialRoom && (
            <div className={styles.periodoTabs}>
              {[['unico', 'Período Único'], ['multiplos', 'Múltiplos Períodos']].map(([v, l]) => (
                <button key={v} type="button"
                  className={[styles.periodoTab, periodoMode === v ? styles.periodoTabActive : ''].join(' ')}
                  onClick={() => setPeriodoMode(v)}
                >{l}</button>
              ))}
            </div>
          )}

          {periodoMode === 'unico' && (
            <>
              <div className={styles.step2Grid}>
                <FormField label="Período de estadia">
                  <div className={styles.dateCompact}>
                    <DatePicker mode="range" startDate={checkin} endDate={checkout}
                      onRangeChange={({ start, end }) => { setCheckin(start); setCheckout(end); }}
                      placeholder="Check-in → Check-out" minDate={new Date()} />
                  </div>
                </FormField>
                <FormField label={tipo === 'grupo' ? 'Quartos (múltipla seleção)' : 'Quarto'}>
                  <RoomCombobox value={quartos}
                    onChange={(v) => { setQuartos(v); setQuartoHospedes((prev) => { const n = {}; v.forEach((q) => { n[q] = prev[q] || []; }); return n; }); }}
                    availableRooms={availableRooms}
                    categorias={categorias}
                    singleSelect={tipo !== 'grupo'}
                    disabled={!checkinStr || !checkoutStr} />
                </FormField>
              </div>
              {/* Per-room hospedes */}
              {quartos.map((q) => (
                <div key={q} style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                  <div className={styles.kvSectionDivider} style={{ margin: 0 }}>Hóspedes — Quarto {fmtRoom(parseInt(q))}</div>
                  <RoomHospedesPicker
                    value={quartoHospedes[q] || []}
                    onChange={(v) => setQuartoHospedes((prev) => ({ ...prev, [q]: v }))} />
                </div>
              ))}
            </>
          )}

          {periodoMode === 'multiplos' && (
            <>
              {periodos.length > 0 && (
                <div className={styles.periodosList}>
                  {periodos.map((p, i) => {
                    const ci = formatDate(p.checkin); const co = formatDate(p.checkout);
                    return (
                      <div key={i} className={styles.periodoItem}>
                        <div className={styles.periodoItemInfo}>
                          <span className={styles.periodoItemDates}>{fmtDateBR(ci)} → {fmtDateBR(co)} · {diariasTxt(diffDays(ci, co))}</span>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 6 }}>
                            {p.rooms.map((q) => {
                              const hosp = p.roomHospedes?.[q] || [];
                              return (
                                <div key={q} style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                  <span className={styles.periodoItemRoomNum}>#{fmtRoom(parseInt(q))}</span>
                                  {hosp.length > 0
                                    ? hosp.map((h, hi) => (
                                        <span key={h.id} style={{ fontSize: 12, color: 'var(--text)', fontWeight: 400 }}>
                                          {h.nome}{hi < hosp.length - 1 ? ',' : ''}
                                        </span>
                                      ))
                                    : <span style={{ fontSize: 11, color: 'var(--text-2)' }}>sem hóspedes</span>
                                  }
                                </div>
                              );
                            })}
                          </div>
                        </div>
                        <button type="button" className={styles.chipRemove} onClick={() => setPeriodos((ps) => ps.filter((_, j) => j !== i))}><X size={12} /></button>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className={styles.mpForm}>
                <div className={styles.step2Grid}>
                  <FormField label="Período">
                    <div className={styles.dateCompact}>
                      <DatePicker mode="range" startDate={mpCheckin} endDate={mpCheckout}
                        onRangeChange={({ start, end }) => { setMpCheckin(start); setMpCheckout(end); }}
                        placeholder="Check-in → Check-out" minDate={new Date()} />
                    </div>
                  </FormField>
                  <FormField label="Quartos para este período">
                    <RoomCombobox value={mpRooms}
                      onChange={(v) => { setMpRooms(v); setMpRoomHospedes((prev) => { const n = {}; v.forEach((q) => { n[q] = prev[q] || []; }); return n; }); }}
                      availableRooms={mpAvailableRooms} categorias={categorias}
                      disabled={!mpCheckin || !mpCheckout} />
                  </FormField>
                </div>
                {/* Per-room hospedes for this period */}
                {mpRooms.map((q) => (
                  <div key={q} style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                    <div className={styles.kvSectionDivider} style={{ margin: 0 }}>Hóspedes — Quarto {fmtRoom(parseInt(q))}</div>
                    <RoomHospedesPicker
                      value={mpRoomHospedes[q] || []}
                      onChange={(v) => setMpRoomHospedes((prev) => ({ ...prev, [q]: v }))} />
                  </div>
                ))}
                <Button variant="secondary" disabled={!mpRooms.length || !mpCheckin || !mpCheckout} onClick={addPeriodo}>
                  <Plus size={13} /> Adicionar Período
                </Button>
              </div>
            </>
          )}

        </div>
      )}

      {/* ── Step 3: Resumo & Pagamentos ───────────────────────────────────── */}
      {step === 3 && (() => {
        // Build the periods list for display
        const displayPeriodos = periodoMode === 'unico'
          ? [{ rooms: quartos, checkin, checkout, roomHospedes: quartoHospedes }]
          : periodos;


        // Financial totals
        const grandTotal   = Object.values(precosCalc).reduce((s, c) => s + (c?.valor_total ?? 0), 0);
        const totalPago    = Object.values(quartosPag).flat().reduce((s, p) => s + (p.valor ?? 0), 0);
        const pendente     = Math.max(0, grandTotal - totalPago);

        return (
          <div className={styles.step3Root}>

            {/* ── Collapsible price card ── */}
            <div className={styles.priceCard} style={{ marginBottom: 14 }}>
              <button
                className={styles.priceCardHeader}
                onClick={() => !calcLoading && setShowPriceDetails((v) => !v)}
              >
                <span className={styles.priceCardSummary}>
                  <span className={styles.finStripItem}>
                    Valor Total{' '}
                    {calcLoading
                      ? <b><Loader2 size={11} className={styles.spin} /></b>
                      : <b>{fmtBRL(grandTotal)}</b>
                    }
                  </span>
                  <span className={styles.finStripDivider} />
                  <span className={styles.finStripItem}>Pago <b style={{ color: 'var(--emerald)' }}>{fmtBRL(totalPago)}</b></span>
                  <span className={styles.finStripDivider} />
                  <span className={styles.finStripItem}>Pendente <b style={{ color: pendente > 0 ? 'var(--violet)' : 'var(--emerald)' }}>{fmtBRL(pendente)}</b></span>
                </span>
                {!calcLoading && (
                  <ChevronDown size={14} className={showPriceDetails ? styles.priceCardChevronOpen : styles.priceCardChevron} />
                )}
              </button>

              {showPriceDetails && !calcLoading && (
                <div className={styles.priceCardBody}>
                  {displayPeriodos.map((p, pi) => (
                    p.rooms.map((q) => {
                      const calc = precosCalc[`${q}_${pi}`];
                      if (!calc) return null;
                      return (
                        <div key={`${q}_${pi}`} className={styles.priceCardRoom}>
                          <div className={styles.priceCardRoomLabel}>Quarto {fmtRoom(parseInt(q))}</div>
                          {calc.detalhes?.map((d, di) => (
                            <div key={di} className={styles.priceDetailItem}>
                              <div className={styles.priceCardRow}>
                                <span className={styles.step3PriceDesc}>{d.descricao}</span>
                                <span className={styles.step3PriceVal}>{fmtBRL(d.valor_final)}</span>
                              </div>
                              {(d.acrescimo_sazonalidade > 0 || d.valor_criancas > 0) && (
                                <div className={styles.priceDetailSub}>
                                  <span>Base {fmtBRL(d.valor_base)}</span>
                                  {d.acrescimo_sazonalidade > 0 && <span>+ Saz. {fmtBRL(d.acrescimo_sazonalidade)}</span>}
                                  {d.valor_criancas > 0 && <span>+ Crianças {fmtBRL(d.valor_criancas)}</span>}
                                </div>
                              )}
                            </div>
                          ))}
                          {calc.sazonalidades_aplicadas?.length > 0 && (
                            <div className={styles.step3SazRow}>
                              {calc.sazonalidades_aplicadas.map((s) => (
                                <span key={s.id} className={styles.step3SazChip}>{s.descricao}</span>
                              ))}
                            </div>
                          )}
                          <div className={styles.step3PriceTotal}>
                            <span>Total</span>
                            <span>{fmtBRL(calc.valor_total)}</span>
                          </div>
                        </div>
                      );
                    })
                  ))}
                </div>
              )}
            </div>

            {/* ── Tipo de reserva ── */}
            <div className={styles.kvList} style={{ padding: '0 0 14px' }}>
              <div className={styles.kvRow}><span className={styles.kvLabel}>Tipo</span><span className={styles.kvVal} style={{ textTransform: 'capitalize' }}>{tipo}{isOrcamento ? ' (orçamento)' : ''}</span></div>
              <div className={styles.kvRow}><span className={styles.kvLabel}>Modo</span><span className={styles.kvVal}>{periodoMode === 'unico' ? 'Período único' : 'Múltiplos períodos'}</span></div>
            </div>

            {/* ── Períodos + quartos + hóspedes ── */}
            {displayPeriodos.map((p, pi) => {
              const ci = p.checkin ? formatDate(p.checkin) : checkinStr;
              const co = p.checkout ? formatDate(p.checkout) : checkoutStr;
              const d2 = ci && co ? diffDays(ci, co) : 0;
              return (
                <div key={pi} className={styles.step3PeriodoBlock}>
                  {periodoMode === 'multiplos' && (
                    <div className={styles.step3PeriodoBand}>
                      <span className={styles.step3PeriodoBandLabel}>Período {pi + 1}</span>
                      <span className={styles.step3PeriodoBandDates}>{fmtDateBR(ci)} → {fmtDateBR(co)} · {diariasTxt(d2)}</span>
                    </div>
                  )}
                  <div className={styles.step3PeriodoContent}>
                  {p.rooms.map((q) => {
                    const qHosp  = (p.roomHospedes || {})[q] || [];
                    const rKey   = `${q}_${pi}`;
                    const rCalc  = precosCalc[rKey];
                    const multiRoom = periodoMode === 'multiplos' || quartos.length > 1;
                    return (
                      <div key={q} className={styles.step3RoomBlock}>
                        <div className={styles.step3RoomLabel}>Quarto {fmtRoom(parseInt(q))}</div>

                        {/* Per-room price card (multi-room only) */}
                        {multiRoom && (rCalc || calcLoading) && (
                          <div className={styles.priceCard} style={{ marginBottom: 10 }}>
                            <button
                              className={styles.priceCardHeader}
                              onClick={() => !calcLoading && setRoomPriceOpen((prev) => ({ ...prev, [rKey]: !prev[rKey] }))}
                            >
                              <span className={styles.priceCardSummary}>
                                <span className={styles.finStripItem}>
                                  Valor Total{' '}
                                  {calcLoading && !rCalc
                                    ? <b><Loader2 size={11} className={styles.spin} /></b>
                                    : <b>{fmtBRL(rCalc?.valor_total ?? 0)}</b>
                                  }
                                </span>
                              </span>
                              {!calcLoading && rCalc && (
                                <ChevronDown size={14} className={roomPriceOpen[rKey] ? styles.priceCardChevronOpen : styles.priceCardChevron} />
                              )}
                            </button>
                            {roomPriceOpen[rKey] && !calcLoading && rCalc && (
                              <div className={`${styles.priceCardBody} ${styles.priceCardBodyInner}`}>
                                {rCalc.detalhes?.map((d, di) => (
                                  <div key={di} className={styles.priceDetailItem}>
                                    <div className={styles.priceCardRow}>
                                      <span className={styles.step3PriceDesc}>{d.descricao}</span>
                                      <span className={styles.step3PriceVal}>{fmtBRL(d.valor_final)}</span>
                                    </div>
                                    {(d.acrescimo_sazonalidade > 0 || d.valor_criancas > 0) && (
                                      <div className={styles.priceDetailSub}>
                                        <span>Base {fmtBRL(d.valor_base)}</span>
                                        {d.acrescimo_sazonalidade > 0 && <span>+ Saz. {fmtBRL(d.acrescimo_sazonalidade)}</span>}
                                        {d.valor_criancas > 0 && <span>+ Crianças {fmtBRL(d.valor_criancas)}</span>}
                                      </div>
                                    )}
                                  </div>
                                ))}
                                {rCalc.sazonalidades_aplicadas?.length > 0 && (
                                  <div className={styles.step3SazRow}>
                                    {rCalc.sazonalidades_aplicadas.map((s) => (
                                      <span key={s.id} className={styles.step3SazChip}>{s.descricao}</span>
                                    ))}
                                  </div>
                                )}
                                <div className={styles.step3PriceTotal}>
                                  <span>Total do quarto {fmtRoom(parseInt(q))}</span>
                                  <span>{fmtBRL(rCalc.valor_total)}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Hóspedes */}
                        <div className={styles.step3RoomSection}>
                          {qHosp.length > 0 ? (
                            <div className={styles.hospedeList}>
                              {qHosp.map((h) => (
                                <div key={h.id} className={styles.hospedeRow}>
                                  <div className={styles.hospedeAvatar}>{initials(h.nome)}</div>
                                  <div><div className={styles.hospedeName}>{h.nome}</div>{h.cpf && <div className={styles.hospedeCpf}>{fmtCpf(h.cpf)}</div>}</div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className={styles.pagEmpty}>Sem hóspedes vinculados</div>
                          )}
                        </div>

                        {/* Pagamento */}
                        {!isOrcamento && (
                          <div className={styles.step3PayArea}>
                            <div className={styles.step3PayHeader}>
                              <span className={styles.step3RoomLabel} style={{ borderBottom: 'none', paddingBottom: 0 }}>Pagamento</span>
                              <button className={styles.step3AddPagBtn}
                                onClick={() => { setShowPagModalRoom(q); setShowPagModal(true); }}>
                                <Plus size={11} /> Adicionar
                              </button>
                            </div>
                            {(quartosPag[q] || []).length === 0
                              ? <div className={styles.pagEmpty}>Nenhum pagamento adicionado</div>
                              : (quartosPag[q] || []).map((p) => {
                                  const tipDesc = tiposPagamento.find((t) => t.id === p.tipo_pagamento?.id)?.descricao ?? p.tipo_pagamento?.descricao ?? '—';
                                  return (
                                    <div key={p._localId} className={styles.step3PagRow}>
                                      <div className={styles.step3PagRowTop}>
                                        <span className={styles.step3PagDesc}>{p.descricao || tipDesc}</span>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto', flexShrink: 0 }}>
                                          <span className={styles.step3PagVal}>{fmtBRL(p.valor)}</span>
                                          <button type="button" className={styles.removeIconBtn}
                                            onClick={() => setQuartosPag((prev) => ({ ...prev, [q]: (prev[q] || []).filter((x) => x._localId !== p._localId) }))}>
                                            <Trash2 size={11} />
                                          </button>
                                        </div>
                                      </div>
                                      <div className={styles.step3PagMeta}>{p._criadoEm} · {tipDesc}</div>
                                      {p.nome_pagador && <div className={styles.step3PagMeta}>{p.nome_pagador}</div>}
                                    </div>
                                  );
                                })
                            }
                          </div>
                        )}

                        {/* Observação */}
                        <div className={styles.step3RoomSection}>
                          <textarea className={styles.obsTextarea} rows={2}
                            placeholder="Observação para este quarto (opcional)..."
                            value={quartosObs[q] || ''}
                            onChange={(e) => setQuartosObs((prev) => ({ ...prev, [q]: e.target.value }))} />
                        </div>
                      </div>
                    );
                  })}
                  </div>{/* end step3PeriodoContent */}
                </div>
              );
            })}



          </div>
        );
      })()}

      </div>{/* end scrollable step content */}
      </div>{/* end outer flex column */}

      {/* Payment modal */}
      <PaymentModal
        open={showPagModal}
        onClose={() => { setShowPagModal(false); setShowPagModalRoom(null); }}
        onConfirm={addPagamento}
        tiposPagamento={tiposPagamento}
        titularNome={
          showPagModalRoom !== null
            ? ((quartoHospedes[showPagModalRoom] || [])[0]?.nome || allHospedes[0]?.nome || null)
            : (allHospedes[0]?.nome || null)
        }
        canAplicarDesconto={false}
      />
    </Modal>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function BookingCalendar() {
  const today    = new Date(); today.setHours(0, 0, 0, 0);
  const todayStr = formatDate(today);

  const [reservas,       setReservas]       = useState([]);
  const [categorias,     setCategorias]     = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [tiposPagamento, setTiposPagamento] = useState([]);
  const [viewDate,    setViewDate]    = useState(() => { const d = new Date(today); d.setDate(d.getDate() - 1); return d; });
  const [collapsedCats,   setCollapsedCats]   = useState({});
  const [selectedReserva, setSelectedReserva] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createInit,      setCreateInit]      = useState({ room: null, start: null, end: null, available: null });
  const [searchTerm,      setSearchTerm]      = useState('');
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [showSolicitacoes,   setShowSolicitacoes]   = useState(false);
  const [dayModal,        setDayModal]        = useState(null);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [pickerYear,      setPickerYear]      = useState(() => new Date().getFullYear());
  const [roomModal, setRoomModal] = useState(null);
  const [selRoom,   setSelRoom]   = useState(null);
  const [selStart,  setSelStart]  = useState(null);
  const [selHover,  setSelHover]  = useState(null);
  const [dragState, setDragState] = useState(null);
  const [ghostDrag, setGhostDrag] = useState(null);
  const [confirmData, setConfirmData] = useState(null);
  const [notif,       setNotif]       = useState(null);

  const lastHoverRef   = useRef(null);
  const searchRef      = useRef(null);
  const monthPickerRef = useRef(null);

  const notify = useCallback((msg, type = 'success') => {
    setNotif({ message: msg, type });
    setTimeout(() => setNotif(null), 3500);
  }, []);

  useEffect(() => { enumApi.tipoPagamento().then(setTiposPagamento).catch(() => {}); }, []);

  // ── Load categories + rooms, then cross-reference ────────────────────────
  useEffect(() => {
    Promise.all([
      quartoCategoriApi.listar({ size: 900 }),
      quartoApi.listar({ size: 900 }),
    ]).then(([catRes, roomRes]) => {
      const catList  = Array.isArray(catRes)  ? catRes  : (catRes?.content  ?? []);
      const roomList = Array.isArray(roomRes) ? roomRes : (roomRes?.content ?? []);

      setCategorias(
        catList
          .map((c) => {
            // First try quartos embedded in category response
            let quartos = (c.quartos ?? []).map((q) => q.id ?? q);
            // Fall back: filter rooms list by categoriaId
            if (!quartos.length) {
              quartos = roomList
                .filter((r) => (r.categoriaId ?? r.categoria?.id) === c.id)
                .map((r) => r.id);
            }
            return { id: c.id, nome: c.nome, quartos };
          })
          .filter((c) => c.quartos.length > 0),
      );
    }).catch(() => {});
  }, []);

  // ── Reload reservations when month/year changes ───────────────────────────
  useEffect(() => {
    setLoading(true);
    const mes = viewDate.getMonth() + 1;
    const ano = viewDate.getFullYear();
    reservaApi.listarPorMesAno({ mes, ano })
      .then((data) => {
        // Response shape: [{ data: "dd/MM/yyyy", reservas: [...] }]
        // Flatten groups and deduplicate by id (a multi-day reserva appears in multiple groups)
        const groups = Array.isArray(data) ? data : [];
        const seenIds = new Set();
        const flat = [];
        for (const group of groups) {
          for (const r of (group.reservas ?? [])) {
            if (!seenIds.has(r.id)) {
              seenIds.add(r.id);
              flat.push(r);
            }
          }
        }
        setReservas(flat.map(normalizeReserva).filter((r) => r.dataInicio));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewDate.getMonth(), viewDate.getFullYear()]);

  // Close search dropdown on outside click
  useEffect(() => {
    const h = (e) => { if (searchRef.current && !searchRef.current.contains(e.target)) setShowSearchDropdown(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  // Close month picker on outside click
  useEffect(() => {
    if (!showMonthPicker) return;
    const h = (e) => { if (monthPickerRef.current && !monthPickerRef.current.contains(e.target)) setShowMonthPicker(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [showMonthPicker]);

  const days        = Array.from({ length: VISIBLE_DAYS }, (_, i) => { const d = new Date(viewDate); d.setDate(d.getDate() + i); return d; });
  const daysStr     = days.map((d) => formatDate(d));
  const firstDayStr = daysStr[0];
  const lastDayStr  = daysStr[daysStr.length - 1];

  const shiftMonth = (delta) => {
    setViewDate((d) => {
      const target = new Date(d.getFullYear(), d.getMonth() + delta, 1);
      const isCurrent = target.getFullYear() === today.getFullYear() && target.getMonth() === today.getMonth();
      if (isCurrent) { const y = new Date(today); y.setDate(y.getDate() - 1); return y; }
      return target;
    });
  };

  const goToToday = () => { const d = new Date(today); d.setDate(d.getDate() - 1); setViewDate(d); };

  const monthLabel = viewDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  const searchNorm = normalizeStr(searchTerm.trim());

  const filteredReservas = searchNorm.length >= 2
    ? reservas.filter((r) => normalizeStr(r.titularNome).includes(searchNorm) || (r.empresaNome && normalizeStr(r.empresaNome).includes(searchNorm)))
    : reservas;

  const searchResults = searchNorm.length >= 2
    ? reservas.filter((r) => normalizeStr(r.titularNome).includes(searchNorm) || (r.empresaNome && normalizeStr(r.empresaNome).includes(searchNorm))).slice(0, 8)
    : [];

  const navigateToReserva = (r) => { setSearchTerm(''); setShowSearchDropdown(false); setSelectedReserva(r); };

  const solicitadasCount = reservas.filter((r) => r.status === 'solicitada').length;
  const allRooms         = categorias.flatMap((c) => c.quartos);

  const handleApproveSolicitacao = async (id, quarto) => {
    const upd = await reservaApi.atualizar({ id, fk_quarto: quarto });
    setReservas((rs) => rs.map((r) => r.id === id ? normalizeReserva(upd) : r));
    notify('Solicitação aprovada!'); setShowSolicitacoes(false);
  };
  const handleRejectSolicitacao = async (id) => {
    await reservaApi.cancelar(id);
    setReservas((rs) => rs.filter((r) => r.id !== id));
    notify('Solicitação rejeitada.'); setShowSolicitacoes(false);
  };

  const handleCellClick = (room, dateStr) => {
    if (dragState) return;
    if (selRoom === room && selStart !== null) {
      if (dateStr === selStart) { setSelRoom(null); setSelStart(null); setSelHover(null); return; }
      const start = dateStr < selStart ? dateStr : selStart;
      const end   = dateStr < selStart ? selStart : dateStr;
      setCreateInit({ room, start, end, available: null });
      setShowCreateModal(true);
      setSelRoom(null); setSelStart(null); setSelHover(null); return;
    }
    const occupied = filteredReservas.some((r) => r.quarto === room && r.dataInicio <= dateStr && r.dataFim > dateStr);
    if (occupied) return;
    setSelRoom(room); setSelStart(dateStr); setSelHover(dateStr);
  };

  const handleRoomMouseMove = (e, room) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const idx  = Math.floor((e.clientX - rect.left) / DAY_CELL_W);
    if (idx < 0 || idx >= VISIBLE_DAYS) return;
    const dateStr = daysStr[idx];
    const key = `${room}-${dateStr}`;
    if (lastHoverRef.current === key) return;
    lastHoverRef.current = key;
    if (dragState) handleDragHover(room, dateStr);
    else if (selRoom === room) setSelHover(dateStr);
  };

  const isCellSelected = (room, dateStr) => {
    if (selRoom !== room || !selStart) return false;
    const hov = selHover || selStart;
    const lo  = selStart < hov ? selStart : hov;
    const hi  = selStart < hov ? hov : selStart;
    return dateStr >= lo && dateStr <= hi;
  };

  const handleBarMouseDown = (e, r) => {
    e.preventDefault(); e.stopPropagation(); if (e.button !== 0) return;
    setDragState({ type: 'move', id: r.id, origQuarto: r.quarto, origInicio: r.dataInicio, origFim: r.dataFim });
    setGhostDrag({ quarto: r.quarto, dataInicio: r.dataInicio, dataFim: r.dataFim });
  };
  const handleResizeMouseDown = (e, r, edge) => {
    e.preventDefault(); e.stopPropagation(); if (e.button !== 0) return;
    setDragState({ type: edge, id: r.id, origQuarto: r.quarto, origInicio: r.dataInicio, origFim: r.dataFim });
    setGhostDrag({ quarto: r.quarto, dataInicio: r.dataInicio, dataFim: r.dataFim });
  };
  const handleDragHover = (room, dateStr) => {
    if (!dragState || !ghostDrag) return;
    if (dragState.type === 'move') {
      const dur = diffDays(dragState.origInicio, dragState.origFim);
      setGhostDrag({ quarto: room, dataInicio: dateStr, dataFim: addDays(dateStr, dur) });
    } else if (dragState.type === 'resize-l') {
      if (dragState.origQuarto !== room) return;
      if (dateStr < dragState.origFim) setGhostDrag((g) => ({ ...g, dataInicio: dateStr }));
    } else if (dragState.type === 'resize-r') {
      if (dragState.origQuarto !== room) return;
      const nd = addDays(dateStr, 1);
      if (nd > dragState.origInicio) setGhostDrag((g) => ({ ...g, dataFim: nd }));
    }
  };

  const dragStateRef = useRef(dragState); const ghostDragRef = useRef(ghostDrag); const reservasRef = useRef(reservas);
  dragStateRef.current = dragState; ghostDragRef.current = ghostDrag; reservasRef.current = reservas;

  const handleGlobalMouseUp = useCallback(() => {
    const ds = dragStateRef.current; const gd = ghostDragRef.current;
    if (!ds || !gd) return;
    const r = reservasRef.current.find((x) => x.id === ds.id);
    if (!r) { setDragState(null); setGhostDrag(null); return; }
    const changed = gd.quarto !== r.quarto || gd.dataInicio !== r.dataInicio || gd.dataFim !== r.dataFim;
    if (changed) {
      const dias = diffDays(gd.dataInicio, gd.dataFim);
      const message = ds.type === 'move'
        ? gd.quarto !== r.quarto ? `Mover para Quarto ${fmtRoom(gd.quarto)}: ${gd.dataInicio} → ${gd.dataFim} (${diariasTxt(dias)})?`
          : `Alterar datas para ${gd.dataInicio} → ${gd.dataFim} (${diariasTxt(dias)})?`
        : `Ajustar período para ${gd.dataInicio} → ${gd.dataFim} (${diariasTxt(dias)})?`;
      const snapshot = { ...gd }; const resId = ds.id;
      setConfirmData({
        title: ds.type === 'move' ? 'Mover Reserva' : 'Ajustar Período', message,
        onConfirm: async () => {
          const upd = await reservaApi.atualizar({
            id:          resId,
            fk_quarto:   snapshot.quarto,
            data_entrada: toBrDate(snapshot.dataInicio),
            data_saida:   toBrDate(snapshot.dataFim),
          });
          setReservas((rs) => rs.map((x) => x.id === resId ? normalizeReserva(upd) : x));
          notify(ds.type === 'move' ? 'Reserva movida.' : 'Período ajustado.'); setConfirmData(null);
        },
      });
    }
    setDragState(null); setGhostDrag(null); lastHoverRef.current = null;
  }, [notify]);

  useEffect(() => { window.addEventListener('mouseup', handleGlobalMouseUp); return () => window.removeEventListener('mouseup', handleGlobalMouseUp); }, [handleGlobalMouseUp]);
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') { setDragState(null); setGhostDrag(null); lastHoverRef.current = null; setSelRoom(null); setSelStart(null); setSelHover(null); } };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, []);

  const handleSaveNew = async (reservasBody) => {
    try {
      const result = await reservaApi.criar({ reservas: reservasBody });
      const novas  = (Array.isArray(result) ? result : [result]).map(normalizeReserva).filter((r) => r.dataInicio);
      setReservas((rs) => [...rs, ...novas]);
      notify(novas.length > 1 ? `${novas.length} reservas criadas!` : 'Reserva criada!');
      setShowCreateModal(false);
    } catch (e) {
      notify(e.message || 'Erro ao criar reserva.', 'error');
      throw e; // re-throw so CreateModal's finally runs setSaving(false)
    }
  };
  const handleCancelReserva = async (id) => {
    await reservaApi.cancelar(id);
    setReservas((rs) => rs.filter((r) => r.id !== id));
    notify('Reserva cancelada.');
  };

  const handleUpdateReserva = async (body) => {
    try {
      const upd = await reservaApi.atualizar(body);
      setReservas((rs) => rs.map((r) => r.id === body.id ? normalizeReserva(upd) : r));
      notify('Reserva atualizada!');
    } catch (e) {
      notify(e?.message ?? 'Erro ao atualizar reserva.', 'error');
      throw e;
    }
  };

  // ── Render bars ────────────────────────────────────────────────────────────
  const renderBars = (room) => {
    const toRender = filteredReservas.filter((r) => r.quarto === room);
    const bars = [];
    for (const r of toRender) {
      const isBeingDragged = dragState?.id === r.id;
      const useGhost       = isBeingDragged && ghostDrag && ghostDrag.quarto === room;
      const displayR       = useGhost ? { ...r, ...ghostDrag } : r;
      const el = buildBar(displayR, r, { opacity: isBeingDragged && !useGhost ? 0.35 : 1, isGhost: false, isDragging: isBeingDragged });
      if (el) bars.push(el);
    }
    if (dragState && ghostDrag && ghostDrag.quarto === room) {
      const orig = reservas.find((r) => r.id === dragState.id);
      if (orig && orig.quarto !== room) {
        const el = buildBar({ ...orig, ...ghostDrag }, orig, { isGhost: true });
        if (el) bars.push(el);
      }
    }
    return bars;
  };

  const buildBar = (display, orig, { opacity = 1, isGhost = false, isDragging = false }) => {
    const { dataInicio, dataFim } = display;
    const startInView = dataInicio >= firstDayStr;
    const endInView   = dataFim   <= addDays(lastDayStr, 1);

    let left;
    if (!startInView) { left = 0; }
    else { const idx = daysStr.indexOf(dataInicio); if (idx < 0) return null; left = idx * DAY_CELL_W + HALF; }

    let right;
    if (!endInView) { right = VISIBLE_DAYS * DAY_CELL_W; }
    else {
      const idx = daysStr.indexOf(dataFim);
      if (idx < 0 && dataFim > lastDayStr) right = VISIBLE_DAYS * DAY_CELL_W;
      else if (idx < 0) return null;
      else right = idx * DAY_CELL_W + HALF;
    }

    const width = right - left;
    if (width <= 4) return null;

    const rLeft        = startInView ? 5 : 0;
    const rRight       = endInView   ? 5 : 0;
    const borderRadius = `${rLeft}px ${rRight}px ${rRight}px ${rLeft}px`;
    const dias         = diffDays(orig.dataInicio, orig.dataFim);
    const totalPeople  = 1 + (orig.quantidadeAcompanhantes || 0);
    const key          = isGhost ? `ghost-${orig.id}` : `bar-${orig.id}`;

    const currentDiaria = orig.status === 'hospedado'
      ? Math.min(dias, Math.max(1, diffDays(orig.dataInicio, todayStr) + 1)) : null;

    const isCancelado = orig.status === 'cancelado';

    return (
      <div key={key}
        className={[styles.bar, styles[`bar_${orig.status}`], isGhost ? styles.barGhost : '', isDragging ? styles.barDragging : ''].join(' ')}
        style={{ left, width, borderRadius, opacity: isCancelado ? Math.min(opacity, 0.55) : opacity }}
        onMouseDown={isGhost ? undefined : (e) => handleBarMouseDown(e, orig)}
        onClick={(e) => { e.stopPropagation(); if (!dragState) setSelectedReserva(orig); }}
        title={`${orig.titularNome} — ${diariasTxt(dias)}`}
      >
        {startInView && !isGhost && (
          <div className={styles.resizeHandle} onMouseDown={(e) => handleResizeMouseDown(e, orig, 'resize-l')} />
        )}
        <div className={styles.barContent}>
          <span className={styles.barName}>{orig.titularNome}</span>
          {isGhost ? (
            <div className={styles.barDateLabel}>{display.dataInicio} → {display.dataFim} · {diariasTxt(diffDays(display.dataInicio, display.dataFim))}</div>
          ) : (
            <div className={styles.barMeta}>
              <span className={styles.barBadge}><Users size={9} /> {totalPeople}</span>
              <span className={styles.barBadge}>
                <CalendarDays size={9} />
                {currentDiaria !== null ? `${currentDiaria}/${dias}` : diariasTxt(dias)}
              </span>
              {orig.empresaNome && <span className={styles.barBadge}><Building2 size={9} /></span>}
            </div>
          )}
        </div>
        {endInView && !isGhost && (
          <div className={[styles.resizeHandle, styles.resizeHandleRight].join(' ')} onMouseDown={(e) => handleResizeMouseDown(e, orig, 'resize-r')} />
        )}
      </div>
    );
  };

  const gridTotalW = LEFT_W + VISIBLE_DAYS * DAY_CELL_W;

  return (
    <div className={styles.page}>
      <Notification notification={notif} />
      <div className={styles.card}>

        {/* Header */}
        <div className={styles.tableHeader}>
          <div>
            <h2 className={styles.h2}>Calendário de Reservas</h2>
            <p className={styles.subtitle}>Visualize e gerencie reservas por quarto e período</p>
          </div>
          <div className={styles.tableTools}>
            <div className={styles.navGroup} style={{ position: 'relative' }} ref={monthPickerRef}>
              <button className={styles.navBtn} onClick={() => shiftMonth(-1)}><ChevronLeft size={14} /></button>
              <button className={styles.monthLabel} onClick={() => { setPickerYear(viewDate.getFullYear()); setShowMonthPicker((v) => !v); }}>
                {monthLabel}
              </button>
              <button className={styles.navBtn} onClick={() => shiftMonth(1)}><ChevronRight size={14} /></button>
              {showMonthPicker && (
                <div className={styles.monthPickerCard}>
                  <div className={styles.monthPickerYearRow}>
                    <button className={styles.monthPickerArrow} onClick={() => setPickerYear((y) => y - 1)}><ChevronLeft size={13} /></button>
                    <span className={styles.monthPickerYear}>{pickerYear}</span>
                    <button className={styles.monthPickerArrow} onClick={() => setPickerYear((y) => y + 1)}><ChevronRight size={13} /></button>
                  </div>
                  <div className={styles.monthPickerGrid}>
                    {['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'].map((m, i) => {
                      const isActive = pickerYear === viewDate.getFullYear() && i === viewDate.getMonth();
                      return (
                        <button key={i}
                          className={[styles.monthPickerCell, isActive ? styles.monthPickerCellActive : ''].join(' ')}
                          onClick={() => {
                            const d = new Date(pickerYear, i, 1);
                            setViewDate(d);
                            setShowMonthPicker(false);
                          }}>
                          {m}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            <button className={styles.todayBtn} onClick={goToToday}>Hoje</button>

            {/* Search combobox */}
            <div className={styles.searchWrap} ref={searchRef}>
              <Search size={13} className={styles.searchIcon} />
              <input className={styles.searchInput} value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setShowSearchDropdown(true); }}
                onFocus={() => searchTerm.length >= 2 && setShowSearchDropdown(true)}
                placeholder="Buscar hóspede..." />
              {searchTerm && (
                <button className={styles.clearSearch} onClick={() => { setSearchTerm(''); setShowSearchDropdown(false); }}><X size={12} /></button>
              )}
              {showSearchDropdown && searchResults.length > 0 && (
                <div className={styles.searchDropdown}>
                  {searchResults.map((r) => {
                    const dias     = diffDays(r.dataInicio, r.dataFim);
                    const nPessoas = r.hospedes?.length ?? (1 + (r.quantidadeAcompanhantes ?? 0));
                    return (
                      <div key={r.id} className={styles.searchDropItem} onClick={() => navigateToReserva(r)}>
                        <div className={styles.searchDropRoomCircle}>{fmtRoom(r.quarto)}</div>
                        <div className={styles.searchDropInfo}>
                          <div className={styles.searchDropName}>{r.titularNome}</div>
                          <div className={styles.searchDropDates}>{fmtDateBR(r.dataInicio)} → {fmtDateBR(r.dataFim)}</div>
                          <div className={styles.searchDropMeta}>{diariasTxt(dias)} · {nPessoas} pessoa{nPessoas !== 1 ? 's' : ''}</div>
                        </div>
                        <span className={[styles.statusBadgeSm, styles[`status_${r.status}`]].join(' ')}>{STATUS_LABEL[r.status]}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Solicitações */}
            <div className={styles.solBtnWrap}>
              <Button variant="secondary" onClick={() => setShowSolicitacoes(true)}><Bell size={14} /> Solicitações</Button>
              {solicitadasCount > 0 && <span className={styles.solBadge}>{solicitadasCount}</span>}
            </div>

            <Button variant="primary" onClick={() => { setCreateInit({ room: null, start: null, end: null, available: null }); setShowCreateModal(true); }}>
              <Plus size={14} /> Nova Reserva
            </Button>
          </div>
        </div>

        {/* Selection hint */}
        {selStart && (
          <div className={styles.selHint}>
            <span>Quarto <strong>{fmtRoom(selRoom)}</strong> · a partir de <strong>{selStart}</strong> — clique outra data para definir fim</span>
            <button className={styles.selHintClose} onClick={() => { setSelRoom(null); setSelStart(null); setSelHover(null); }}><X size={12} /></button>
          </div>
        )}

        {/* Grid */}
        <div className={styles.gridScroll}>
          {loading ? (
            <div className={styles.loadingRow}><Loader2 size={20} className={styles.spin} /> Carregando...</div>
          ) : (
            <>
              <div className={styles.dayHeaderRow} style={{ width: gridTotalW }}>
                <div className={styles.cornerCell} style={{ width: LEFT_W, height: HDR_H }}>
                  <BedDouble size={11} /><span>Quarto</span>
                </div>
                {days.map((day, idx) => {
                  const dStr      = daysStr[idx];
                  const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                  const isToday   = dStr === todayStr;
                  return (
                    <div key={idx}
                      className={[styles.dayHeader, isWeekend ? styles.dayHeaderWeekend : '', isToday ? styles.dayHeaderToday : ''].join(' ')}
                      style={{ width: DAY_CELL_W, height: HDR_H }}
                      onClick={() => setDayModal({ dateStr: dStr })}
                      title={`Ver reservas — ${fmtDateBR(dStr)}`}
                    >
                      <span className={[styles.dayWeekday, isWeekend ? styles.dayWeekdayRed : '', isToday ? styles.dayWeekdayToday : ''].join(' ')}>
                        {isToday ? 'HOJE' : day.toLocaleDateString('pt-BR', { weekday: 'long' })}
                      </span>
                      <span className={[styles.dayNum, isToday ? styles.dayNumToday : ''].join(' ')}>
                        {day.getDate()}
                      </span>
                    </div>
                  );
                })}
              </div>

              {categorias.map((cat) => {
                const isCollapsed = !!collapsedCats[cat.id];
                return (
                  <div key={cat.id}>
                    <div className={styles.catRow} style={{ width: gridTotalW, height: CAT_H }}
                      onClick={() => setCollapsedCats((p) => ({ ...p, [cat.id]: !p[cat.id] }))}>
                      <div className={styles.catLabel} style={{ width: LEFT_W }}>
                        <ChevronDown size={11} className={`${styles.chevronIcon}${isCollapsed ? ' ' + styles.collapsed : ''}`} />
                        <BedDouble size={11} />{cat.nome}
                      </div>
                      {days.map((_, i) => <div key={i} className={styles.catCell} style={{ width: DAY_CELL_W }} />)}
                    </div>

                    {!isCollapsed && cat.quartos.map((room) => (
                      <div key={room} className={styles.roomRow} style={{ width: gridTotalW, height: ROOM_H }}>
                        <button className={styles.roomLabel} style={{ width: LEFT_W, height: ROOM_H }}
                          onClick={() => setRoomModal({ room })} title={`Histórico quarto ${fmtRoom(room)}`}>
                          <span className={styles.roomNum}>{fmtRoom(room)}</span>
                        </button>
                        <div className={styles.roomCells} onMouseMove={(e) => handleRoomMouseMove(e, room)}>
                          {days.map((day, idx) => {
                            const dStr      = daysStr[idx];
                            const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                            const isToday   = dStr === todayStr;
                            const isSel     = isCellSelected(room, dStr);
                            return (
                              <div key={idx}
                                className={[styles.cell, isWeekend ? styles.cellWeekend : '', isToday ? styles.cellToday : '', isSel ? styles.cellSelected : '', styles.cellClickable].join(' ')}
                                style={{ width: DAY_CELL_W, height: ROOM_H, flexShrink: 0 }}
                                onClick={() => handleCellClick(room, dStr)}
                              />
                            );
                          })}
                          <div className={styles.barsLayer}>{renderBars(room)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </>
          )}
        </div>

        {/* Legend */}
        <div className={styles.legend}>
          {[
            { cls: 'legendDot_confirmada', label: 'Confirmada' },
            { cls: 'legendDot_solicitada', label: 'Solicitada' },
            { cls: 'legendDot_hospedado',  label: 'Hospedado'  },
            { cls: 'legendDot_finalizado', label: 'Finalizado' },
            { cls: 'legendDot_cancelado',  label: 'Cancelado'  },
          ].map((l) => (
            <div key={l.label} className={styles.legendItem}>
              <div className={[styles.legendDot, styles[l.cls]].join(' ')} />
              <span>{l.label}</span>
            </div>
          ))}
          <span className={styles.legendHint}>Clique dia/quarto · 2 células para criar · Arraste/borda para mover</span>
        </div>
      </div>

      {/* Modals */}
      {showCreateModal && (
        <CreateModal initialRoom={createInit.room} initialStart={createInit.start} initialEnd={createInit.end} initialAvailable={createInit.available}
          reservas={reservas} onClose={() => setShowCreateModal(false)} onSave={handleSaveNew} onNotify={notify} categorias={categorias} tiposPagamento={tiposPagamento} />
      )}
      {dayModal && (
        <DayModal dateStr={dayModal.dateStr} reservas={filteredReservas} onClose={() => setDayModal(null)} categorias={categorias}
          onNewReserva={(dateStr, available) => { setCreateInit({ room: null, start: dateStr, end: null, available }); setShowCreateModal(true); }}
          onSelectReserva={(r) => setSelectedReserva(r)} />
      )}
      {roomModal && <RoomModal room={roomModal.room} reservas={reservas} onClose={() => setRoomModal(null)} categorias={categorias} onSelectReserva={(r) => { setRoomModal(null); setSelectedReserva(r); }} />}
      {selectedReserva && <ReservaModal reserva={selectedReserva} onClose={() => setSelectedReserva(null)} onCancel={handleCancelReserva} onUpdate={handleUpdateReserva} onNotify={notify} categorias={categorias} tiposPagamento={tiposPagamento} />}
      {showSolicitacoes && (
        <SolicitacoesModal reservas={reservas} allRooms={allRooms} onClose={() => setShowSolicitacoes(false)}
          onApprove={handleApproveSolicitacao} onReject={handleRejectSolicitacao} />
      )}
      {confirmData && (
        <ConfirmModal title={confirmData.title} message={confirmData.message} onConfirm={confirmData.onConfirm} onCancel={() => setConfirmData(null)} />
      )}
    </div>
  );
}
