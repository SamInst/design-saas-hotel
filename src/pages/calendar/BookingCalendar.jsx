import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  BedDouble, ChevronLeft, ChevronRight, Plus, Pencil, Trash2,
  ChevronDown, Loader2, X, XCircle, Users, Search, CalendarDays, Bell, Check, FileDown, FileText, SlidersHorizontal, DollarSign, MoreVertical,
} from 'lucide-react';
import { Button }        from '../../components/ui/Button';
import { Modal }         from '../../components/ui/Modal';
import { FormField }     from '../../components/ui/Input';
import { DatePicker }    from '../../components/ui/DatePicker';
import { Notification }  from '../../components/ui/Notification';
import { PaymentModal }  from '../../components/ui/PaymentModal';
import { addDaysStr }        from './calendarMocks';
import { gerarVoucherReserva } from './gerarVoucherReserva';
import { reservaApi, quartoApi, quartoCategoriApi, cadastroApi, enumApi, userStorage, orcamentoApi, recepcaoApi, hospedagemApi } from '../../services/api';
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
    const s = (r.status + '').toUpperCase();
    // ── Novos status (enum atualizado) ──────────────────────────
    if (s === 'ORCAMENTO')                              return 'orcamento';
    if (s === 'ORCAMENTO_CANCELADO')                    return 'cancelado';
    if (s === 'RESERVA_SOLICITADA')                     return 'solicitada';
    if (s === 'RESERVA_ATIVA')                          return 'confirmada';
    if (s === 'RESERVA_CANCELADA')                      return 'cancelado';
    if (s === 'RESERVA_AUSENTE')                        return 'ausente';
    if (s === 'PERNOITE_ATIVO')                         return 'hospedado';
    if (s === 'PERNOITE_CANCELADO')                     return 'cancelado';
    if (s === 'PERNOITE_FINALIZADO')                    return 'finalizado';
    if (s === 'PERNOITE_FINALIZADO_PAGAMENTO_PENDENTE') return 'finalizado';
    if (s === 'DAY_USE_SOLICITADO')                     return 'solicitada';
    if (s === 'DAY_USE_ATIVO')                          return 'hospedado';
    if (s === 'DAY_USE_CANCELADO')                      return 'cancelado';
    if (s === 'DAY_USE_FINALIZADO')                     return 'finalizado';
    if (s === 'DAY_USE_FINALIZADO_PAGAMENTO_PENDENTE')  return 'finalizado';
    if (s === 'DAY_USE_AUSENTE')                        return 'ausente';
    // ── Legado (compatibilidade com versão anterior) ──────────
    if (s === 'CANCELADO')  return 'cancelado';
    if (s === 'HOSPEDADO')  return 'hospedado';
    if (s === 'FINALIZADO') return 'finalizado';
    if (s === 'SOLICITADA') return 'solicitada';
    if (s === 'ATIVO')      return 'confirmada';
    return s.toLowerCase();
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

  // Suporte a campos legados e novos nomes de data
  const dataEntrada   = r.data_hora_entrada   ?? r.data_hora_checkin  ?? '';
  const dataSaida     = r.data_hora_saida     ?? r.data_hora_checkout ?? '';
  // Suporte a quarto_id (orçamento) além de fk_quarto e quarto embedded
  const quartoId = r.quarto?.id ?? r.quarto_id ?? r.fk_quarto ?? (typeof r.quarto === 'number' ? r.quarto : null);

  return {
    id:                      r.id,
    quarto:                  quartoId,
    quartoId:                quartoId, // cópia explícita para uso em display
    categoria:               r.categoria?.nome ?? '',
    titularNome:             titular?.nome ?? r.orcamento_info?.nome_solicitante ?? r.nome_solicitante ?? r.titular_nome ?? 'Hóspede',
    empresaNome:             r.empresa?.razao_social ?? r.empresa_nome ?? null,
    funcionario:             r.usuario?.pessoa?.nome ?? r.usuario?.nome ?? r.funcionario?.nome ?? null,
    dataHoraRegistro:        r.data_hora_registro ?? null,
    observacao:              r.observacao ?? null,
    quantidadeAcompanhantes: Math.max(0, pessoas.length - 1),
    dataInicio:              parseBrDate(dataEntrada),
    dataFim:                 parseBrDate(dataSaida),
    chegadaPrevista:         dataEntrada,
    saidaPrevista:           dataSaida,
    status:                  mapStatus(r),
    hospedes: pessoas.map((p) => ({
      id:            p.id,
      nome:          p.nome,
      cpf:           p.cpf ?? '',
      telefone:      p.celular ?? p.telefone ?? '',
      email:         p.email ?? '',
      dataNascimento: p.data_nascimento ?? '',
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
    motivoCancelamento: r.motivo_cancelamento?.motivo_cancelamento ?? null,
    dataMotivo:         r.motivo_cancelamento?.data_hora_registro   ?? null,
    funcMotivo:         r.motivo_cancelamento?.funcionario?.nome    ?? null,
    grupo_id: r.grupo_id ?? null,
    orcamentoInfo: r.orcamento_info ?? null,
    pessoasOrcamento: (r.pessoas_orcamento ?? []).map((p) => ({
      id:             p.id,
      nome:           p.nome,
      dataNascimento: p.data_nascimento ?? '',
    })),
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
const fmtRoom   = (n) => n != null ? String(n).padStart(2, '0') : '—';
const fmtDateBR = (s) => { if (!s) return ''; const [y, m, d] = s.split('-'); return `${d}/${m}/${y}`; };
const fmtCpf = (v) => { const d = (v || '').replace(/\D/g, ''); return d.length === 11 ? `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}` : (v || ''); };
const calcAge = (dob) => {
  if (!dob) return null;
  // accepts yyyy-MM-dd or dd/MM/yyyy
  let y, m, d;
  if (dob.includes('/')) { [d, m, y] = dob.split('/'); } else { [y, m, d] = dob.split('-'); }
  const birth = new Date(+y, +m - 1, +d);
  if (isNaN(birth)) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  if (today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) age--;
  return age;
};
const diariasTxt = (n) => `${n} diária${n !== 1 ? 's' : ''}`;

/** Converts a guest list to { datas_nascimento } for /calcular-preco.
 *  One birth date per guest in dd/MM/yyyy — guests without a stored date get a default adult date (18 years ago). */
const buildGuestCalcParams = (guests) => {
  if (!guests.length) return {};
  const today = new Date();
  const defaultAdult = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear() - 18}`;
  const datas_nascimento = guests.map((h) => {
    if (!h.dataNascimento) return defaultAdult;
    // ISO yyyy-MM-dd → dd/MM/yyyy
    return /^\d{4}-\d{2}-\d{2}$/.test(h.dataNascimento)
      ? h.dataNascimento.split('-').reverse().join('/')
      : h.dataNascimento; // already dd/MM/yyyy
  });
  return { datas_nascimento };
};

const initials = (nome) => {
  const p = (nome || '').trim().split(/\s+/).filter(Boolean);
  if (!p.length) return '?';
  if (p.length === 1) return p[0][0].toUpperCase();
  return (p[0][0] + p[p.length - 1][0]).toUpperCase();
};

const STATUS_LABEL = {
  hospedado: 'Hospedado', confirmada: 'Confirmada',
  solicitada: 'Solicitada', finalizado: 'Finalizado', cancelado: 'Cancelado',
  orcamento: 'Orçamento',
};

const GRUPO_PALETTE = [
  '#b45309', '#1d4ed8', '#be185d', '#047857',
  '#6d28d9', '#c2410c', '#0e7490', '#4d7c0f',
];
const grupoColor = (grupoId) => GRUPO_PALETTE[Number(grupoId) % GRUPO_PALETTE.length];


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
function ReservaModal({ reserva, onClose, onCancel, onActivate, onMoverPernoite, onUpdate, onSync, onNotify, categorias, tiposPagamento, roomDescMap = {}, dragValues = null, onApprove, onReject }) {
  // ── Edit mode ──────────────────────────────────────────────────────────────
  // dragValues: { quarto, checkin (yyyy-MM-dd), checkout (yyyy-MM-dd) } — set when opened from drag/resize
  const [editing,      setEditing]      = useState(dragValues !== null);
  const [editQuarto,   setEditQuarto]   = useState(dragValues ? [String(dragValues.quarto)] : [String(reserva.quarto)]);
  const [editCheckin,  setEditCheckin]  = useState(dragValues ? new Date(dragValues.checkin + 'T00:00:00') : new Date(reserva.dataInicio + 'T00:00:00'));
  const [editCheckout, setEditCheckout] = useState(dragValues ? new Date(dragValues.checkout + 'T00:00:00') : new Date(reserva.dataFim + 'T00:00:00'));

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
  const [viewPagamento,      setViewPagamento]      = useState(null);
  const [confirmPernoite,    setConfirmPernoite]    = useState(false);
  const [confirmCancel,      setConfirmCancel]      = useState(false);
  const [confirmCancel2,     setConfirmCancel2]     = useState(false);
  const [cancelMotivRes,     setCancelMotivRes]     = useState('');
  const [confirmRemovePessoa, setConfirmRemovePessoa] = useState(null); // { id, nome }

  // ── Derived ────────────────────────────────────────────────────────────────
  const totalPago  = pagamentos.filter((p) => !p.cancelado).reduce((s, p) => s + (p.valor ?? 0), 0);
  const pendente   = reserva.valorTotal - totalPago;
  const dias       = diffDays(reserva.dataInicio, reserva.dataFim);
  const cat        = categorias.find((c) => c.quartos.includes(reserva.quarto));
  const allRoomIds = categorias.flatMap((c) => c.quartos);

  // ── Voucher download ───────────────────────────────────────────────────────
  const handleDownloadVoucher = () => {
    const _u = userStorage.get();
    const displayPeriodos = [{
      checkin: reserva.dataInicio,
      checkout: reserva.dataFim,
      rooms: [String(reserva.quarto)],
      roomHospedes: { [String(reserva.quarto)]: pessoas },
    }];
    const precosCalc = {
      [`${reserva.quarto}_0`]: { valor_total: reserva.valorTotal ?? 0, detalhes: [], sazonalidades_aplicadas: [] },
    };
    const quartosObs = {};
    if (reserva.observacao) quartosObs[`${reserva.quarto}_0`] = reserva.observacao;
    const solicitanteData = { nome: reserva.titularNome ?? '', cpf: pessoas[0]?.cpf ?? '' };
    const pagsAtivos = pagamentos.filter((p) => !p.cancelado);
    gerarVoucherReserva({
      tipo: 'individual',
      periodoMode: 'unico',
      displayPeriodos,
      precosCalc,
      quartosObs,
      roomDescMap,
      userName: _u?.pessoa?.nome ?? _u?.nome ?? '',
      solicitante: solicitanteData,
      pagamentos: pagsAtivos,
    });
  };

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
    const hasPessoaOps = pendingOps.some((o) => o.type === 'addPessoa' || o.type === 'removePessoa');
    try {
      // Batch pessoa additions and removals into single calls each
      const addIds    = pendingOps.filter((o) => o.type === 'addPessoa').map((o) => o.pessoaId);
      const removeIds = pendingOps.filter((o) => o.type === 'removePessoa').map((o) => o.pessoaId);
      if (addIds.length)    await hospedagemApi.adicionarPessoas(reserva.id, addIds);
      if (removeIds.length) await hospedagemApi.removerPessoas(reserva.id, removeIds);

      // Payment ops (one at a time)
      for (const op of pendingOps) {
        if (op.type === 'addPagamento')
          await hospedagemApi.adicionarPagamentos(reserva.id, op.payment);
        else if (op.type === 'cancelPagamento')
          await reservaApi.cancelarPagamento(op.pagId, op.motivo);
      }

      setPendingOps([]);
      setHasChanges(false);
      // Always re-fetch so the calendar bar reflects latest pagamentos/pessoas
      if (onSync) {
        try {
          const fresh = await reservaApi.buscarPorId(reserva.id);
          const normalized = normalizeReserva(fresh);
          onSync(normalized);
          setPessoas(normalized.hospedes ?? []);
        } catch { /* ignore sync failure */ }
      }
      onNotify?.('Alterações salvas!');
    } catch (e) {
      onNotify?.(e?.message ?? 'Erro ao salvar alterações.', 'error');
    } finally {
      setSaving(false);
    }
  };

  // ── Edit calc ─────────────────────────────────────────────────────────────
  const [editCalc,        setEditCalc]        = useState(null);
  const [editCalcLoading, setEditCalcLoading] = useState(false);
  const [origCalc,        setOrigCalc]        = useState(null);
  const [origCalcLoading, setOrigCalcLoading] = useState(false);

  // Fetch original price once when editing starts
  useEffect(() => {
    if (!editing) return;
    let cancelled = false;
    setOrigCalcLoading(true);
    setOrigCalc(null);
    reservaApi.calcularPreco([{
      fk_quarto:    parseInt(reserva.quarto),
      data_entrada: toBrDate(reserva.dataInicio),
      data_saida:   toBrDate(reserva.dataFim),
      ...buildGuestCalcParams(pessoas),
    }]).then((res) => { if (!cancelled) setOrigCalc(Array.isArray(res) ? res[0] : res); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setOrigCalcLoading(false); });
    return () => { cancelled = true; };
  }, [editing]);

  useEffect(() => {
    if (!editing || !editQuarto[0] || !editCheckin || !editCheckout) return;
    let cancelled = false;
    setEditCalcLoading(true);
    setEditCalc(null);
    const brDate = (d) => toBrDate(formatDate(d));
    reservaApi.calcularPreco([{
      fk_quarto:    parseInt(editQuarto[0]),
      data_entrada: brDate(editCheckin),
      data_saida:   brDate(editCheckout),
      ...buildGuestCalcParams(pessoas),
    }]).then((res) => { if (!cancelled) setEditCalc(Array.isArray(res) ? res[0] : res); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setEditCalcLoading(false); });
    return () => { cancelled = true; };
  }, [editing, editQuarto[0], editCheckin, editCheckout, pessoas]); // eslint-disable-line

  // ── Edit save (quarto/datas/obs) ──────────────────────────────────────────
  const [editSaving,    setEditSaving]    = useState(false);
  const [editActiveTab, setEditActiveTab] = useState('dados');
  const [editObs,       setEditObs]       = useState(reserva.observacao ?? '');

  const handleSaveEdit = async () => {
    setEditSaving(true);
    try {
      const valorTotal = editCalc?.valor_total ?? reserva.valorTotal;
      await onUpdate(reserva.id, {
        quarto_id:          parseInt(editQuarto[0]),
        status:             'RESERVA_ATIVA',
        data_hora_checkin:  `${toBrDate(formatDate(editCheckin))} 14:00`,
        data_hora_checkout: `${toBrDate(formatDate(editCheckout))} 12:00`,
        observacao:         editObs.trim(),
        ...(valorTotal != null ? { valor_total: valorTotal } : {}),
      });
      setEditing(false);
    } finally {
      setEditSaving(false);
    }
  };

  const canSave = editQuarto.length > 0 && editCheckin && editCheckout && editCheckout > editCheckin;

  const hasChangedDatesOrRoom =
    editQuarto[0] !== String(reserva.quarto) ||
    (editCheckin  ? formatDate(editCheckin)  : '') !== reserva.dataInicio ||
    (editCheckout ? formatDate(editCheckout) : '') !== reserva.dataFim;

  const hasChangedData = hasChangedDatesOrRoom || editObs !== (reserva.observacao ?? '');

  const EDIT_TABS = [
    { key: 'dados',      label: 'Dados' },
    { key: 'pessoas',    label: `Pessoas (${pessoas.length})` },
    ...(reserva.status !== 'orcamento' ? [{ key: 'pagamentos', label: `Pagamentos` }] : []),
  ];

  const goBackFromEdit = () => {
    if (hasChanges) { setShowDiscard(true); return; }
    setEditing(false); setEditActiveTab('dados');
  };

  // ── Edit mode render ───────────────────────────────────────────────────────
  if (editing) {
    // ── Inline price card (shared between comparison and single modes) ────────
    const renderEditPriceCard = () => {
      return hasChangedDatesOrRoom ? (
        /* ── Side-by-side comparison ── */
        <div className={styles.editCompareGrid}>
          {/* Anterior */}
          <div className={styles.editComparePanel}>
            <div className={styles.editCompareBand}>
              <span className={styles.editCompareBandLabel}>Anterior</span>
              <span className={styles.editCompareBandInfo}>Ap. {fmtRoom(reserva.quarto)} · {fmtDateBR(reserva.dataInicio)} → {fmtDateBR(reserva.dataFim)}</span>
            </div>
            <div className={styles.editCompareBody}>
              {origCalcLoading
                ? <div className={styles.editCompareLoading}><Loader2 size={11} className={styles.spin} /> calculando...</div>
                : origCalc && <>
                    {origCalc.detalhes?.map((d, di) => (
                      <div key={di} className={styles.editCompareRow}>
                        <span className={styles.editCompareDesc}>{d.descricao}</span>
                        <span className={styles.editCompareVal}>{fmtBRL(d.valor_final)}</span>
                      </div>
                    ))}
                    <div className={styles.editCompareTotalRow}><span>Total</span><span>{fmtBRL(origCalc.valor_total)}</span></div>
                  </>
              }
            </div>
          </div>
          {/* Novo */}
          <div className={[styles.editComparePanel, styles.editComparePanelNew].join(' ')}>
            <div className={[styles.editCompareBand, styles.editCompareBandNew].join(' ')}>
              <span className={styles.editCompareBandLabel}>Novo</span>
              <span className={styles.editCompareBandInfo}>Ap. {fmtRoom(parseInt(editQuarto[0]))} · {editCheckin ? fmtDateBR(formatDate(editCheckin)) : ''} → {editCheckout ? fmtDateBR(formatDate(editCheckout)) : ''}</span>
            </div>
            <div className={styles.editCompareBody}>
              {editCalcLoading
                ? <div className={styles.editCompareLoading}><Loader2 size={11} className={styles.spin} /> calculando...</div>
                : editCalc && <>
                    {editCalc.detalhes?.map((d, di) => (
                      <div key={di} className={styles.editCompareRow}>
                        <span className={styles.editCompareDesc}>{d.descricao}</span>
                        <span className={styles.editCompareVal}>{fmtBRL(d.valor_final)}</span>
                      </div>
                    ))}
                    <div className={styles.editCompareTotalRow}><span>Total</span><span>{fmtBRL(editCalc.valor_total)}</span></div>
                    <div className={styles.editCompareFinRow}>
                      <span className={styles.editCompareFinItem}>Pago <b style={{ color: 'var(--emerald)' }}>{fmtBRL(totalPago)}</b>{editCalc.valor_total > 0 && <span style={{ fontSize: 10, color: 'var(--text-2)', marginLeft: 3 }}>({Math.round(totalPago / editCalc.valor_total * 100)}%)</span>}</span>
                      <span className={styles.editCompareFinItem}>Pendente <b style={{ color: Math.max(0, editCalc.valor_total - totalPago) > 0 ? '#f97316' : 'var(--emerald)' }}>{fmtBRL(Math.max(0, editCalc.valor_total - totalPago))}</b>{editCalc.valor_total > 0 && <span style={{ fontSize: 10, color: 'var(--text-2)', marginLeft: 3 }}>({Math.round(Math.max(0, editCalc.valor_total - totalPago) / editCalc.valor_total * 100)}%)</span>}</span>
                    </div>
                  </>
              }
            </div>
          </div>
          {/* Diff */}
          {!editCalcLoading && !origCalcLoading && editCalc && origCalc && (() => {
            const diff = editCalc.valor_total - origCalc.valor_total;
            if (diff === 0) return null;
            return (
              <div className={[styles.editCompareDiff, diff > 0 ? styles.editCompareDiffUp : styles.editCompareDiffDown].join(' ')}>
                {diff > 0 ? '▲' : '▼'} {fmtBRL(Math.abs(diff))} {diff > 0 ? 'a mais' : 'a menos'}
              </div>
            );
          })()}
        </div>
      ) : (
        /* ── Single price card (always rendered) ── */
        (() => {
          const displayTotal = editCalc?.valor_total ?? reserva.valorTotal ?? 0;
          const displayPendente = Math.max(0, displayTotal - totalPago);
          return (
        <div className={styles.priceCard}>
            <div className={styles.priceCardHeader} style={{ cursor: 'default' }}>
              <span className={styles.priceCardSummary}>
                <span className={styles.finStripItem}>
                  Valor Total{' '}
                  {editCalcLoading
                    ? <b><Loader2 size={11} className={styles.spin} /></b>
                    : <b>{fmtBRL(displayTotal)}</b>
                  }
                </span>
                <span className={styles.finStripDivider} />
                <span className={styles.finStripItem}>
                  Pago <b style={{ color: 'var(--emerald)' }}>{fmtBRL(totalPago)}</b>
                  {displayTotal > 0 && <span style={{ fontSize: 10, color: 'var(--text-2)', marginLeft: 3 }}>({Math.round(totalPago / displayTotal * 100)}%)</span>}
                </span>
                <span className={styles.finStripDivider} />
                <span className={styles.finStripItem}>
                  Pendente <b style={{ color: displayPendente > 0 ? '#f97316' : 'var(--emerald)' }}>{fmtBRL(displayPendente)}</b>
                  {displayTotal > 0 && <span style={{ fontSize: 10, color: 'var(--text-2)', marginLeft: 3 }}>({Math.round(displayPendente / displayTotal * 100)}%)</span>}
                </span>
              </span>
            </div>
            {editCalc?.detalhes?.length > 0 && (
              <div className={`${styles.priceCardBody} ${styles.priceCardBodyInner}`}>
                {editCalc.detalhes.map((d, di) => (
                  <div key={di} className={styles.priceDetailItem}>
                    <div className={styles.priceCardRow}>
                      <span className={styles.step3PriceDesc}>{d.descricao}</span>
                      <span className={styles.step3PriceVal}>{fmtBRL(d.valor_final)}</span>
                    </div>
                    {(d.acrescimo_sazonalidade > 0 || d.valor_criancas > 0) && (
                      <div className={styles.priceDetailSub}>
                        <span>{fmtBRL((d.valor_base ?? 0) + (d.acrescimo_sazonalidade ?? 0))}</span>
                        {d.sazonalidade?.descricao && <span className={styles.step3SazChipInline}>{d.sazonalidade.descricao}</span>}
                        {d.valor_criancas > 0 && <span>+ Crianças {fmtBRL(d.valor_criancas)}</span>}
                      </div>
                    )}
                  </div>
                ))}
                <div className={styles.step3PriceTotal}><span>Total</span><span>{fmtBRL(editCalc.valor_total)}</span></div>
              </div>
            )}
          </div>
          );
        })()
      );
    };

    return (
      <>
      <Modal open onClose={goBackFromEdit} size="md"
        title={<><Pencil size={15} /> Editar — {reserva.titularNome}</>}
        bodyStyle={{ padding: 0, gap: 0 }}
        footer={
          <div className={styles.footerSpread}>
            <Button variant="secondary" onClick={goBackFromEdit}>← Voltar</Button>
            <div style={{ display: 'flex', gap: 8 }}>
              {hasChanges && (
                <Button variant="primary" disabled={saving} onClick={handleSaveChanges}>
                  {saving && <Loader2 size={13} className={styles.spin} />} Salvar
                </Button>
              )}
              {hasChangedData && (
                <Button variant="primary" disabled={!canSave || editSaving} onClick={handleSaveEdit}>
                  {editSaving && <Loader2 size={13} className={styles.spin} />} Salvar Dados
                </Button>
              )}
            </div>
          </div>
        }
      >
        {/* ── Price card — always visible above tabs ── */}
        <div className={styles.editPriceTop}>
          {renderEditPriceCard()}
        </div>

        <div className={styles.detailTabs}>
          {EDIT_TABS.map((t) => (
            <button key={t.key}
              className={[styles.detailTab, editActiveTab === t.key ? styles.detailTabActive : ''].join(' ')}
              onClick={() => setEditActiveTab(t.key)}>
              {t.label}
            </button>
          ))}
        </div>
        <div className={styles.detailTabContent}>
        {editActiveTab === 'dados' && <div className={styles.formStack}>
          <FormField label="Apartamento">
            <RoomCombobox
              value={editQuarto} onChange={setEditQuarto}
              availableRooms={allRoomIds} categorias={categorias} roomDescMap={roomDescMap} singleSelect
            />
          </FormField>
          <FormField label="Período de estadia">
            <DatePicker
              mode="range" startDate={editCheckin} endDate={editCheckout}
              onRangeChange={({ start, end }) => { setEditCheckin(start); setEditCheckout(end); }}
              placeholder="Check-in → Check-out"
            />
          </FormField>
          <FormField label="Observação">
            <textarea
              className={styles.motivoTextarea}
              placeholder="Observação sobre a reserva..."
              rows={2}
              value={editObs}
              onChange={(e) => setEditObs(e.target.value)}
            />
          </FormField>
        </div>}

        {/* ── Pessoas tab ── */}
        {editActiveTab === 'pessoas' && (
          <div className={styles.detailBody}>
            {reserva.status === 'orcamento' && (reserva.pessoasOrcamento?.length ?? 0) > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
                {reserva.pessoasOrcamento.map((p, i) => (
                  <div key={p.id} className={styles.pessoaRow}>
                    <div className={styles.pagRowTop}>
                      <span className={styles.pagRowDesc}>{p.nome}</span>
                      <span className={i === 0 ? styles.titularBadge : styles.acompanhanteBadge} style={{ marginLeft: 'auto' }}>{i === 0 ? 'Titular' : 'Acompanhante'}</span>
                    </div>
                    {p.dataNascimento && <div className={styles.pagRowMeta}>{p.dataNascimento}</div>}
                  </div>
                ))}
              </div>
            )}
            {!showAddPessoa && reserva.status !== 'hospedado' && reserva.status !== 'finalizado' && reserva.status !== 'orcamento' && reserva.status !== 'cancelado' && (
              <button className={styles.addLinkBtn} onClick={() => setShowAddPessoa(true)}><Plus size={13} /> Adicionar pessoa</button>
            )}
            {showAddPessoa && (
              <div className={styles.addInlineBox}>
                <div className={styles.addInlineRow}>
                  <Search size={13} />
                  <input className={styles.addInlineInput} placeholder="Buscar por nome ou CPF..." value={pessoaQuery} onChange={(e) => handlePessoaQuery(e.target.value)} autoFocus />
                  {pessoaSearching ? <Loader2 size={13} className={styles.spin} /> : <button className={styles.removeIconBtn} onClick={() => { setShowAddPessoa(false); setPessoaQuery(''); setPessoaResults([]); }}><X size={12} /></button>}
                </div>
                {(pessoaResults.length > 0 || pendingPessoa) && (
                  <div className={styles.inlineDropdown}>
                    {pendingPessoa ? (
                      <>
                        <div className={styles.companionHeader}><button className={styles.companionBack} onClick={() => setPendingPessoa(null)}><ChevronLeft size={12} /> Voltar</button></div>
                        <div className={styles.companionRow}>
                          <div className={[styles.companionCheck, styles.companionChecked].join(' ')}><Check size={11} /></div>
                          <div className={styles.companionInfo}><span className={styles.companionName}>{pendingPessoa.titular.nome}</span>{pendingPessoa.titular.cpf && <span className={styles.companionMeta}>{fmtCpf(pendingPessoa.titular.cpf)}</span>}</div>
                          <span className={styles.titularChip}>Titular</span>
                        </div>
                        {pendingPessoa.titular.acompanhantes.map((a) => (
                          <div key={a.id} className={[styles.companionRow, a.bloqueado ? styles.searchResultBlocked : styles.companionRowClickable].join(' ')} onClick={() => !a.bloqueado && togglePendingAcomp(a.id)}>
                            <div className={[styles.companionCheck, pendingPessoa.selected.has(a.id) ? styles.companionChecked : ''].join(' ')}>{pendingPessoa.selected.has(a.id) && <Check size={11} />}</div>
                            <div className={styles.companionInfo}><span className={styles.companionName}>{a.nome}</span>{a.cpf && <span className={styles.companionMeta}>{fmtCpf(a.cpf)}{a.idade ? ` · ${a.idade} anos` : ''}</span>}</div>
                            {a.bloqueado && <span className={styles.blockedChip}>Bloqueado</span>}
                          </div>
                        ))}
                        <div className={styles.companionActions}>
                          <button className={styles.companionBtnSecondary} onClick={() => confirmAddPessoas(false)}>Só o titular</button>
                          <button className={styles.companionBtnPrimary} onClick={() => confirmAddPessoas(true)}>Adicionar →</button>
                        </div>
                      </>
                    ) : pessoaResults.map((p) => (
                      <button key={p.id} className={[styles.inlineDropdownItem, p.bloqueado ? styles.inlineDropdownItemBlocked : ''].join(' ')} disabled={p.bloqueado} onClick={() => handlePessoaResultClick(p)}>
                        <div className={styles.initialsCircleSm}>{initials(p.nome)}</div>
                        <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 500 }}>{p.nome}</div>{p.cpf && <div style={{ fontSize: 11, color: 'var(--text-2)' }}>{fmtCpf(p.cpf)}</div>}</div>
                        {p.bloqueado && <span className={styles.blockedChip}>Bloqueado</span>}
                        {p.acompanhantes?.length > 0 && !p.bloqueado && <span className={styles.companionCountChip}>{p.acompanhantes.length} acomp.</span>}
                        {!p.bloqueado && <ChevronRight size={13} style={{ color: 'var(--text-2)', flexShrink: 0 }} />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {pessoas.length === 0 && reserva.status !== 'orcamento' && <div className={styles.emptyState}>Nenhuma pessoa vinculada.</div>}
            {pessoas.map((h, i) => (
              <div key={h.id} className={styles.pessoaRow}>
                <div className={styles.pagRowTop}>
                  <span className={styles.pagRowDesc}>{h.nome}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto', flexShrink: 0 }}>
                    <span className={i === 0 ? styles.titularBadge : styles.acompanhanteBadge}>{i === 0 ? 'Titular' : 'Acompanhante'}</span>
                    {i > 0 && reserva.status !== 'hospedado' && reserva.status !== 'finalizado' && reserva.status !== 'cancelado' && (
                      <button className={styles.removeIconBtn} title="Remover" onClick={() => setConfirmRemovePessoa({ id: h.id, nome: h.nome })}><X size={12} /></button>
                    )}
                  </div>
                </div>
                {h.telefone && <div className={styles.pagRowMeta}>{fmtPhone(h.telefone)}</div>}
                {h.email && <div className={styles.pagRowMeta}>{h.email}</div>}
              </div>
            ))}
          </div>
        )}

        {/* ── Pagamentos tab ── */}
        {editActiveTab === 'pagamentos' && (
          <div className={styles.detailBody}>
            {reserva.status !== 'hospedado' && reserva.status !== 'finalizado' && reserva.status !== 'cancelado' && (
              <button className={styles.addLinkBtn} onClick={() => setShowPayModal(true)}><Plus size={13} /> Adicionar pagamento</button>
            )}
            {pagamentos.length === 0 && <div className={styles.emptyState}>Nenhum pagamento registrado.</div>}
            {pagamentos.map((p) => (
              <div key={p.id} className={[styles.pagRow, p.cancelado ? styles.pagRowCancelado : '', styles.pagCardClickable].join(' ')} onClick={() => setViewPagamento(p)}>
                <div className={styles.pagRowTop}>
                  <span className={styles.pagRowDesc}>{p.descricao || p.formaPagamento || 'Pagamento'}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto', flexShrink: 0 }}>
                    <span className={p.cancelado ? styles.pagCardValorCancelado : styles.pagRowVal}>{fmtBRL(p.valor)}</span>
                    {!p.cancelado && reserva.status !== 'hospedado' && reserva.status !== 'finalizado' && reserva.status !== 'cancelado' && (
                      <button className={styles.removeIconBtn} title="Cancelar pagamento" onClick={(e) => { e.stopPropagation(); setCancelPagId(p.id); setCancelMotivo(''); }}><Trash2 size={12} /></button>
                    )}
                  </div>
                </div>
                <div className={styles.pagRowMeta}>{p.dataRegistro && <span>{p.dataRegistro}</span>}{p.dataRegistro && <span className={styles.pagCard2Sep}>·</span>}<span>{p.formaPagamento || '—'}</span></div>
                {p.nomePagador && <div className={styles.pagRowPagador}>{p.nomePagador}</div>}
                {p.cancelado && <span className={styles.pagCardCanceladoBadge}>Cancelado</span>}
              </div>
            ))}
          </div>
        )}
        </div>
      </Modal>

      <Modal open={!!confirmRemovePessoa} onClose={() => setConfirmRemovePessoa(null)} size="sm" title="Remover pessoa"
        footer={<div style={{ display: 'flex', gap: 8 }}><Button style={{ flex: 1 }} onClick={() => setConfirmRemovePessoa(null)}>Cancelar</Button><Button variant="danger" style={{ flex: 1 }} onClick={() => { handleRemovePessoa(confirmRemovePessoa.id); setConfirmRemovePessoa(null); }}>Remover</Button></div>}
      ><p style={{ fontSize: 13, color: 'var(--text)', margin: 0 }}>Tem certeza que deseja remover <b>{confirmRemovePessoa?.nome}</b> desta reserva?</p></Modal>

      <PaymentModal open={showPayModal} onClose={() => setShowPayModal(false)} onConfirm={handleAddPagamento} tiposPagamento={tiposPagamento} isSubmitting={false} titularNome={reserva.titularNome} lastPayerName={pagamentos.filter(p => !p.cancelado).at(-1)?.nomePagador ?? null} canAplicarDesconto={false} valorTotal={reserva.valorTotal} valorPago={totalPago} />

      <Modal open={!!cancelPagId} onClose={() => setCancelPagId(null)} size="sm" title="Cancelar Pagamento"
        footer={<div className={styles.footerRight}><Button variant="secondary" onClick={() => setCancelPagId(null)}>Voltar</Button><Button variant="danger" disabled={!cancelMotivo.trim()} onClick={handleConfirmCancelPagamento}>Confirmar</Button></div>}
      >
        <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--text-2)' }}>Informe o motivo do cancelamento deste pagamento.</p>
        <textarea className={styles.motivoTextarea} placeholder="Motivo do cancelamento..." rows={3} value={cancelMotivo} onChange={(e) => setCancelMotivo(e.target.value)} />
      </Modal>

      <Modal open={showDiscard} onClose={() => setShowDiscard(false)} size="sm" title="Descartar alterações?"
        footer={<div className={styles.footerRight}><Button variant="secondary" onClick={() => setShowDiscard(false)}>Continuar editando</Button><Button variant="danger" onClick={() => { setShowDiscard(false); setPendingOps([]); setHasChanges(false); setEditing(false); setEditActiveTab('dados'); }}>Descartar</Button></div>}
      ><p style={{ margin: 0, fontSize: 14, color: 'var(--text-2)' }}>Há alterações não salvas. Deseja descartá-las?</p></Modal>

      <Modal open={!!viewPagamento} onClose={() => setViewPagamento(null)} size="sm" title="Detalhes do Pagamento"
        footer={<div className={styles.footerRight}><Button onClick={() => setViewPagamento(null)}>Fechar</Button></div>}
      >
        {viewPagamento && (
          <div className={styles.kvDetailRoot}>
            <div className={styles.kvSectionDivider}>Pagamento</div>
            <div className={styles.kvList}>
              <div className={styles.kvRow}><span className={styles.kvLabel}>Forma</span><span className={styles.kvVal}>{viewPagamento.formaPagamento || '—'}</span></div>
              <div className={styles.kvRow}><span className={styles.kvLabel}>Valor</span><span className={[styles.kvVal, viewPagamento.cancelado ? styles.pagCardValorCancelado : styles.finPago].join(' ')}>{fmtBRL(viewPagamento.valor)}</span></div>
              <div className={styles.kvRow}><span className={styles.kvLabel}>Pagador</span><span className={styles.kvVal}>{viewPagamento.nomePagador || '—'}</span></div>
              <div className={styles.kvRow}><span className={styles.kvLabel}>Situação</span><span className={viewPagamento.cancelado ? styles.pagCardCanceladoBadge : styles.pagStatusAtivo}>{viewPagamento.cancelado ? 'Cancelado' : 'Ativo'}</span></div>
              {viewPagamento.descricao && <div className={[styles.kvRow, styles.kvRowFull].join(' ')}><span className={styles.kvLabel}>Descrição</span><span className={styles.kvVal}>{viewPagamento.descricao}</span></div>}
            </div>
            <div className={styles.kvSectionDivider}>Registro</div>
            <div className={styles.kvList}>
              <div className={styles.kvRow}><span className={styles.kvLabel}>Registrado por</span><span className={styles.kvVal}>{viewPagamento.funcionario || '—'}</span></div>
              <div className={styles.kvRow}><span className={styles.kvLabel}>Data</span><span className={styles.kvVal}>{viewPagamento.dataRegistro || '—'}</span></div>
            </div>
            {viewPagamento.cancelado && (
              <>
                <div className={styles.kvSectionDividerCancel}>Cancelamento</div>
                <div className={styles.kvListCancel}>
                  <div className={styles.kvRow}><span className={styles.kvLabel}>Cancelado por</span><span className={styles.kvVal}>{viewPagamento.funcMotivo || '—'}</span></div>
                  <div className={styles.kvRow}><span className={styles.kvLabel}>Data</span><span className={styles.kvVal}>{viewPagamento.dataMotivo || '—'}</span></div>
                  {viewPagamento.motivoCancelamento && <div className={[styles.kvRow, styles.kvRowFull].join(' ')}><span className={styles.kvLabel}>Motivo</span><span className={styles.kvVal}>{viewPagamento.motivoCancelamento}</span></div>}
                </div>
              </>
            )}
          </div>
        )}
      </Modal>
      </>
    );
  }

  // ── View mode render ───────────────────────────────────────────────────────
  const fmtDateLong = (s) => {
    if (!s) return '';
    return new Date(s + 'T00:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
  };
  const todayStr = formatDate(new Date());
  const canCheckin = reserva.dataInicio === todayStr;
  const roomDesc = roomDescMap[reserva.quarto] || roomDescMap[String(reserva.quarto)] || '';
  const catNome = cat?.nome || reserva.categoria || '';
  const roomDisplay = [roomDesc || `Ap. ${fmtRoom(reserva.quarto)}`, catNome].filter(Boolean).join(' · ');
  const displayTotal = reserva.valorTotal;
  const displayPendente = Math.max(0, displayTotal - totalPago);
  const checkinTime = reserva.chegadaPrevista?.split(' ')[1]?.slice(0, 5) || '12:00';
  const checkoutTime = reserva.saidaPrevista?.split(' ')[1]?.slice(0, 5) || '12:00';
  const RV_STATUS = {
    confirmada: 'Reserva Confirmada', solicitada: 'Solicitação Pendente',
    hospedado: 'Hospedado', finalizado: 'Reserva Finalizada',
    cancelado: 'Reserva Cancelada', orcamento: 'Orçamento',
  };
  const canEdit = reserva.status !== 'hospedado' && reserva.status !== 'finalizado' && reserva.status !== 'cancelado' && reserva.status !== 'orcamento' && reserva.status !== 'solicitada';

  return (
    <>
      <Modal open onClose={handleClose} size="lg" hideHeader bodyStyle={{ padding: 0, gap: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1, minHeight: 0 }}
        title={<><BedDouble size={15} /> Apartamento {fmtRoom(reserva.quarto)} — {reserva.titularNome}</>}
      >
        {/* ── Custom dark header ── */}
        <div className={styles.rvHeader}>
          <div className={styles.rvRoomCard}>
            <div className={styles.rvRoomCardNum}>{fmtRoom(reserva.quarto)}</div>
          </div>
          <div className={styles.rvHeaderContent}>
            <div className={styles.rvHeaderTopRow}>
              <span className={styles.rvHeaderNum}>#{reserva.id}</span>
              <span className={styles.rvHeaderDot}>·</span>
              <span className={[styles.rvHeaderStatus, styles[`rvStatus_${reserva.status}`]].join(' ')}>
                {RV_STATUS[reserva.status] ?? reserva.status}
              </span>
            </div>
            <div className={styles.rvHeaderTitle}>{reserva.titularNome}</div>
            {reserva.funcionario && <div className={styles.rvHeaderSub}>registrado por: {reserva.funcionario}</div>}
          </div>
          <button className={styles.rvCloseBtn} onClick={handleClose}><X size={16} /></button>
        </div>

        {/* ── Scrollable body ── */}
        <div className={styles.rvBody}>
          <div className={styles.rvTwoCol}>

            {/* ── Left column: obs, guests (+ dates when orcamento) ── */}
            <div className={[styles.rvLeft, reserva.status === 'orcamento' ? styles.rvLeftFull : ''].join(' ')}>

              {/* Dates shown here only for orcamento (no right column) */}
              {reserva.status === 'orcamento' && (
                <div className={styles.rvDatesRow}>
                  <div className={styles.rvDateCell}>
                    <div className={styles.rvDateLabel}>Check-in</div>
                    <div className={styles.rvDateValue}>{toBrDate(reserva.dataInicio)}</div>
                    <div className={styles.rvDateTime}>{checkinTime}h</div>
                  </div>
                  <div className={styles.rvDateArrow}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                    </svg>
                  </div>
                  <div className={[styles.rvDateCell, styles.rvDateCellRight].join(' ')}>
                    <div className={styles.rvDateLabel}>Check-out</div>
                    <div className={styles.rvDateValue}>{toBrDate(reserva.dataFim)}</div>
                    <div className={styles.rvDateTime}>{checkoutTime}h</div>
                  </div>
                  <div className={styles.rvDateCellNights}>
                    <div className={styles.rvNightsNum}>{dias}</div>
                    <div className={styles.rvNightsLabel}>Diárias</div>
                  </div>
                </div>
              )}

              {/* Cancel reason */}
              {reserva.status === 'cancelado' && reserva.motivoCancelamento && (
                <div className={styles.rvCancelBlock}>
                  <div className={styles.rvCancelHeader}><XCircle size={13} style={{flexShrink:0}}/> Cancelamento</div>
                  <div className={styles.rvCancelText}>{reserva.motivoCancelamento}</div>
                  {(reserva.funcMotivo || reserva.dataMotivo) && (
                    <div className={styles.rvCancelMeta}>{[reserva.funcMotivo, reserva.dataMotivo].filter(Boolean).join(' · ')}</div>
                  )}
                </div>
              )}

              {/* Guests */}
              {(() => {
                const renderGuestTable = (list) => {
                  const titular = list[0];
                  const acomps = list.slice(1);
                  const renderRow = (h) => (
                    <div key={h.id ?? h.nome} className={styles.rvGuestRow}>
                      <div className={styles.rvGuestAvatar}>{initials(h.nome)}</div>
                      <div className={styles.rvGuestInfo}>
                        <div className={styles.rvGuestName}>{h.nome}</div>
                        {(h.telefone || h.dataNascimento) && (
                          <div className={styles.rvGuestMeta}>{h.telefone ? fmtPhone(h.telefone) : h.dataNascimento}</div>
                        )}
                        {h.email && <div className={styles.rvGuestMeta}>{h.email}</div>}
                      </div>
                    </div>
                  );
                  return (
                    <div className={styles.rvGuestTable}>
                      <div className={styles.rvGuestSectionHeader}>Titular</div>
                      {renderRow(titular)}
                      {acomps.length > 0 && (
                        <>
                          <div className={styles.rvGuestSectionHeader}>Acompanhantes</div>
                          {acomps.map(renderRow)}
                        </>
                      )}
                    </div>
                  );
                };

                if (reserva.status === 'orcamento' && (reserva.pessoasOrcamento?.length ?? 0) > 0) {
                  return renderGuestTable(reserva.pessoasOrcamento);
                }
                if (reserva.status === 'orcamento' && reserva.orcamentoInfo && pessoas.length === 0) {
                  return renderGuestTable([{ id: 0, nome: reserva.orcamentoInfo.nome_solicitante }]);
                }
                if (pessoas.length === 0) {
                  return <div className={styles.rvEmptyState}>Nenhuma pessoa vinculada.</div>;
                }
                return renderGuestTable(pessoas);
              })()}

              {/* Observação */}
              {reserva.observacao && (
                <div className={styles.rvObsBox}>
                  <div className={styles.rvObsLabel}>Observação</div>
                  <div className={styles.rvObsText}>{reserva.observacao}</div>
                </div>
              )}
            </div>

            {/* ── Right column: period + financial summary + payments ── */}
            {reserva.status !== 'orcamento' && (
              <div className={styles.rvRight}>
                {/* Dates + nights */}
                <div className={styles.rvDatesRow}>
                  <div className={styles.rvDateCell}>
                    <div className={styles.rvDateLabel}>Check-in</div>
                    <div className={styles.rvDateValue}>{toBrDate(reserva.dataInicio)}</div>
                    <div className={styles.rvDateTime}>{checkinTime}h</div>
                  </div>
                  <div className={styles.rvDateArrow}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                    </svg>
                  </div>
                  <div className={[styles.rvDateCell, styles.rvDateCellRight].join(' ')}>
                    <div className={styles.rvDateLabel}>Check-out</div>
                    <div className={styles.rvDateValue}>{toBrDate(reserva.dataFim)}</div>
                    <div className={styles.rvDateTime}>{checkoutTime}h</div>
                  </div>
                  <div className={styles.rvDateCellNights}>
                    <div className={styles.rvNightsNum}>{dias}</div>
                    <div className={styles.rvNightsLabel}>Diárias</div>
                  </div>
                </div>
                <div className={styles.rvFinCard}>
                  <div className={styles.rvFinHeader}>
                    <DollarSign size={13} className={styles.rvFinIcon} />
                    <span className={styles.rvFinTitle}>Resumo Financeiro</span>
                  </div>
                  <div className={styles.rvFinRow}>
                    <div className={styles.rvFinItem}>
                      <span className={styles.rvFinLabel}>Valor Total</span>
                      <span className={styles.rvFinValue}>{fmtBRL(displayTotal)}</span>
                    </div>
                    <div className={styles.rvFinItem}>
                      <span className={styles.rvFinLabel}>Total Pago</span>
                      <span className={styles.rvFinValue}>{fmtBRL(totalPago)}</span>
                    </div>
                    <div className={styles.rvFinItem}>
                      <span className={styles.rvFinLabel}>Pendente</span>
                      <span className={[styles.rvFinValue, displayPendente > 0 ? styles.rvFinPending : styles.rvFinPaid].join(' ')}>
                        {fmtBRL(displayPendente)}
                      </span>
                    </div>
                  </div>
                  {displayTotal > 0 && (() => {
                    const pct = Math.min(100, Math.round(totalPago / displayTotal * 100));
                    return (
                      <div className={styles.rvFinProgress}>
                        <div className={styles.rvFinProgressMeta}>
                          <span>Progresso de pagamento</span>
                          <span>{pct}%</span>
                        </div>
                        <div className={styles.rvFinBar}>
                          <div className={styles.rvFinBarFill} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })()}
                </div>
                <div className={styles.rvPayList}>
                  {pagamentos.length === 0 && <div className={styles.rvEmptyState}>Nenhum pagamento registrado.</div>}
                  {pagamentos.map((p) => (
                    <div key={p.id} className={[styles.rvPayItem, p.cancelado ? styles.rvPayItemCancelado : ''].join(' ')} onClick={() => setViewPagamento(p)}>
                      <div className={styles.rvPayInfo}>
                        <div className={styles.rvPayDesc}>{p.descricao || p.formaPagamento || 'Pagamento'}</div>
                        {p.nomePagador && <div className={styles.rvPayPayer}>{p.nomePagador}</div>}
                        {(p.dataRegistro || p.formaPagamento) && <div className={styles.rvPayMeta}>{[p.dataRegistro, p.formaPagamento].filter(Boolean).join(' · ')}</div>}
                        {p.funcionario && <div className={styles.rvPayFunc}>registrado por {p.funcionario}</div>}
                      </div>
                      <span className={p.cancelado ? styles.rvPayAmountCancelado : styles.rvPayAmount}>{fmtBRL(p.valor)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>

        {/* ── Footer actions ── */}
        <div className={styles.rvFooter}>
          {reserva.status === 'orcamento' ? (
            <>
              <button className={[styles.rvBtn, styles.rvBtnPrimary].join(' ')} onClick={() => onActivate?.(reserva.id)}>Ativar Reserva</button>
              <button className={[styles.rvBtn, styles.rvBtnDanger, styles.rvBtnSm].join(' ')} onClick={() => { setCancelMotivRes(''); setConfirmCancel(true); }}>Cancelar</button>
            </>
          ) : reserva.status === 'solicitada' ? (
            <>
              <button className={[styles.rvBtn, styles.rvBtnPrimary].join(' ')} disabled={saving} onClick={async () => { setSaving(true); try { await onApprove?.(reserva.id, reserva.quarto); onClose(); } finally { setSaving(false); } }}>
                {saving && <Loader2 size={14} className={styles.spin}/>} Aprovar
              </button>
              <button className={[styles.rvBtn, styles.rvBtnDanger, styles.rvBtnSm].join(' ')} disabled={saving} onClick={async () => { setSaving(true); try { await onReject?.(reserva.id); onClose(); } finally { setSaving(false); } }}>
                Rejeitar
              </button>
            </>
          ) : reserva.status !== 'hospedado' && reserva.status !== 'finalizado' && reserva.status !== 'cancelado' ? (
            <>
              <button className={[styles.rvBtn, styles.rvBtnPrimary].join(' ')} disabled={!canCheckin} title={!canCheckin ? `Check-in: ${fmtDateBR(reserva.dataInicio)}` : undefined} onClick={() => setConfirmPernoite(true)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:14,height:14}}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                Hospedar
              </button>
              <button className={[styles.rvBtn, styles.rvBtnGold].join(' ')} onClick={handleDownloadVoucher}>
                <FileDown size={14}/> Voucher
              </button>
              <button className={[styles.rvBtn, styles.rvBtnGhost].join(' ')} onClick={() => setEditing(true)}>
                <Pencil size={14}/> Editar
              </button>
              <button className={[styles.rvBtn, styles.rvBtnDanger, styles.rvBtnSm].join(' ')} onClick={() => { setCancelMotivRes(''); setConfirmCancel(true); }}>
                <Trash2 size={13}/> Cancelar
              </button>
            </>
          ) : (
            <button className={[styles.rvBtn, styles.rvBtnGold].join(' ')} onClick={handleDownloadVoucher}>
              <FileDown size={14}/> Voucher
            </button>
          )}
        </div>
      </Modal>

      <Modal open={confirmPernoite} onClose={() => setConfirmPernoite(false)} size="sm"
        title="Hospedar"
        footer={
          <div style={{ display: 'flex', gap: 8 }}>
            <Button style={{ flex: 1 }} onClick={() => setConfirmPernoite(false)}>Cancelar</Button>
            <Button variant="primary" style={{ flex: 1 }} onClick={() => { setConfirmPernoite(false); onMoverPernoite?.(reserva.id); onClose(); }}>
              Confirmar
            </Button>
          </div>
        }
      >
        <p style={{ fontSize: 13, color: 'var(--text)', margin: 0 }}>
          Tem certeza que deseja mover a reserva de <b>{reserva.titularNome}</b> para pernoites?
          O status será alterado para <b>Hospedado</b> e a reserva não poderá mais ser editada por aqui.
        </p>
      </Modal>

      <Modal open={confirmCancel} onClose={() => setConfirmCancel(false)} size="sm"
        title={reserva.status === 'orcamento' ? 'Cancelar Orçamento' : 'Cancelar Reserva'}
        footer={
          <div style={{ display: 'flex', gap: 8 }}>
            <Button style={{ flex: 1 }} onClick={() => setConfirmCancel(false)}>Voltar</Button>
            <Button variant="danger" style={{ flex: 1 }} disabled={!cancelMotivRes.trim()}
              onClick={() => { setConfirmCancel(false); setConfirmCancel2(true); }}>
              Avançar
            </Button>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ fontSize: 13, color: 'var(--text)', margin: 0 }}>
            Informe o motivo do cancelamento da reserva de <b>{reserva.titularNome}</b>:
          </p>
          <textarea
            style={{
              width: '100%', boxSizing: 'border-box', minHeight: 80,
              padding: '8px 10px', borderRadius: 'var(--radius)',
              border: '1.5px solid var(--border)', background: 'var(--surface-2)',
              color: 'var(--text)', fontSize: 13, resize: 'vertical', fontFamily: 'inherit',
            }}
            placeholder="Ex: Solicitação do hóspede"
            value={cancelMotivRes}
            onChange={(e) => setCancelMotivRes(e.target.value)}
            autoFocus
          />
        </div>
      </Modal>

      <Modal open={confirmCancel2} onClose={() => setConfirmCancel2(false)} size="sm"
        title="Confirmar Cancelamento"
        footer={
          <div style={{ display: 'flex', gap: 8 }}>
            <Button style={{ flex: 1 }} onClick={() => { setConfirmCancel2(false); setConfirmCancel(true); }}>Voltar</Button>
            <Button variant="danger" style={{ flex: 1 }}
              onClick={() => {
                setConfirmCancel2(false);
                // Para orçamentos, passa o ID do orçamento (não da hospedagem) para o endpoint correto
                const orcId = reserva.status === 'orcamento' ? (reserva.orcamentoInfo?.id ?? null) : null;
                onCancel(reserva.id, cancelMotivRes.trim(), orcId);
                onClose();
              }}>
              Cancelar Definitivamente
            </Button>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <p style={{ fontSize: 13, color: 'var(--text)', margin: 0 }}>
            Tem certeza? Esta ação não pode ser desfeita.
          </p>
          <div style={{ padding: '8px 12px', borderRadius: 'var(--radius)', background: 'var(--surface-2)', border: '1px solid var(--border)', fontSize: 12, color: 'var(--text-2)' }}>
            <span style={{ fontWeight: 600, color: 'var(--text)' }}>Motivo: </span>{cancelMotivRes}
          </div>
        </div>
      </Modal>

      <Modal open={!!confirmRemovePessoa} onClose={() => setConfirmRemovePessoa(null)} size="sm"
        title="Remover pessoa"
        footer={
          <div style={{ display: 'flex', gap: 8 }}>
            <Button style={{ flex: 1 }} onClick={() => setConfirmRemovePessoa(null)}>Cancelar</Button>
            <Button variant="danger" style={{ flex: 1 }} onClick={() => { handleRemovePessoa(confirmRemovePessoa.id); setConfirmRemovePessoa(null); }}>
              Remover
            </Button>
          </div>
        }
      >
        <p style={{ fontSize: 13, color: 'var(--text)', margin: 0 }}>
          Tem certeza que deseja remover <b>{confirmRemovePessoa?.nome}</b> desta reserva?
        </p>
      </Modal>

      <PaymentModal
        open={showPayModal}
        onClose={() => setShowPayModal(false)}
        onConfirm={handleAddPagamento}
        tiposPagamento={tiposPagamento}
        isSubmitting={false}
        titularNome={reserva.titularNome}
        lastPayerName={pagamentos.filter(p => !p.cancelado).at(-1)?.nomePagador ?? null}
        canAplicarDesconto={false}
        valorTotal={reserva.valorTotal}
        valorPago={totalPago}
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
function DayModal({ dateStr, onClose, onNewReserva, categorias, onSelectReserva }) {
  const [dayList,  setDayList]  = useState([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    setLoading(true);
    hospedagemApi.buscar({ status: 'RESERVA_ATIVA', data: toBrDate(dateStr) })
      .then((data) => {
        const flat = Array.isArray(data) ? data : [];
        const seen = new Set();
        const out = [];
        for (const r of flat) {
          if (!seen.has(r.id)) { seen.add(r.id); out.push(normalizeReserva(r)); }
        }
        setDayList(out.filter((r) => r.dataInicio).sort((a, b) => a.quarto - b.quarto));
      })
      .catch(() => setDayList([]))
      .finally(() => setLoading(false));
  }, [dateStr]); // eslint-disable-line

  const dayReservas    = dayList;
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
        <div className={styles.footerRight}>
          <Button variant="primary" onClick={() => { onClose(); onNewReserva(dateStr, availableRooms); }}>
            <Plus size={13} /> Nova Reserva
          </Button>
        </div>
      }
    >
      {loading ? (
        <div className={styles.emptyState}><Loader2 size={16} className={styles.spin} style={{ marginRight: 6 }} />Carregando...</div>
      ) : (
        <>
          {/* Minimalist stats strip */}
          <div className={styles.dayStatsStrip}>
            <span className={styles.dayStatChip}><b>{occupiedRooms.size}</b>/{totalRooms} apartamentos ocupados</span>
            <span className={styles.dayStatDivider} />
            <span className={styles.dayStatChip}><b>{dayReservas.length}</b> reserva{dayReservas.length !== 1 ? 's' : ''} confirmada{dayReservas.length !== 1 ? 's' : ''}</span>
            <span className={styles.dayStatDivider} />
            <span className={styles.dayStatChip}><b>{totalPeople}</b> pessoa{totalPeople !== 1 ? 's' : ''}</span>
            <span className={styles.dayStatDivider} />
            <span className={styles.dayStatChip} style={{ color: 'var(--emerald)' }}><b>{availableRooms.length}</b> apartamentos disponíveis</span>
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
        </>
      )}
    </Modal>
  );
}

// ─── Room Modal ───────────────────────────────────────────────────────────────
function RoomModal({ room, onClose, categorias, onSelectReserva }) {
  const [roomList, setRoomList] = useState([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    setLoading(true);
    hospedagemApi.buscar({ status: 'RESERVA_ATIVA', quarto_id: room })
      .then((data) => {
        const flat = Array.isArray(data) ? data : [];
        const seen = new Set();
        const out = [];
        for (const r of flat) {
          if (!seen.has(r.id)) { seen.add(r.id); out.push(normalizeReserva(r)); }
        }
        setRoomList(out.filter((r) => r.dataInicio).sort((a, b) => a.dataInicio.localeCompare(b.dataInicio)));
      })
      .catch(() => setRoomList([]))
      .finally(() => setLoading(false));
  }, [room]); // eslint-disable-line

  const cat          = categorias.find((c) => c.quartos.includes(room));
  const roomReservas = roomList;
  const totalPessoas = roomReservas.reduce((s, r) => s + (r.hospedes?.length || (1 + (r.quantidadeAcompanhantes || 0))), 0);
  return (
    <Modal open onClose={onClose} size="md"
      title={<><BedDouble size={15} /> Apartamento {fmtRoom(room)} — {cat?.nome || ''}</>}
      footer={<div className={styles.footerRight}><Button variant="secondary" onClick={onClose}>Fechar</Button></div>}
    >
      {loading ? (
        <div className={styles.emptyState}><Loader2 size={16} className={styles.spin} style={{ marginRight: 6 }} />Carregando...</div>
      ) : (
        <>
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
        </>
      )}
    </Modal>
  );
}

// ─── Status Filter Modal ──────────────────────────────────────────────────────
const STATUS_FILTER_OPTIONS = [
  ['confirmada',          'Reserva Ativa'],
  ['hospedado',           'Hospedado'],
  ['finalizado',          'Finalizado'],
  ['cancelado',           'Cancelada'],
  ['ausente',             'Ausente'],
  ['pernoite_cancelado',  'Pernoite Cancelado'],
  ['pagamento_pendente',  'Pagamento Pendente'],
];
const STATUS_PAGE_SIZE = 10;

function StatusFilterModal({ status, label, onClose, onSelectReserva }) {
  const [page,    setPage]    = useState(1);
  const [list,    setList]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');

  const API_STATUS = {
    confirmada:         'RESERVA_ATIVA',
    hospedado:          'PERNOITE_ATIVO',
    finalizado:         'PERNOITE_FINALIZADO',
    cancelado:          'RESERVA_CANCELADA',
    ausente:            'RESERVA_AUSENTE',
    pernoite_cancelado: 'PERNOITE_CANCELADO',
    pagamento_pendente: 'PERNOITE_FINALIZADO_PAGAMENTO_PENDENTE',
  };
  useEffect(() => {
    setLoading(true);
    hospedagemApi.buscar({ status: API_STATUS[status] ?? status.toUpperCase() })
      .then((data) => {
        const flat = Array.isArray(data) ? data : [];
        const seen = new Set();
        const deduped = [];
        for (const r of flat) {
          if (!seen.has(r.id)) { seen.add(r.id); deduped.push(normalizeReserva(r)); }
        }
        setList(deduped.filter((r) => r.dataInicio));
      })
      .catch(() => setList([]))
      .finally(() => setLoading(false));
  }, [status]);

  const norm     = normalizeStr(search.trim());
  const filtered = norm.length >= 1
    ? list.filter((r) =>
        normalizeStr(r.titularNome).includes(norm) ||
        (r.empresaNome && normalizeStr(r.empresaNome).includes(norm)) ||
        (r.pessoasOrcamento ?? []).some((p) => normalizeStr(p.nome).includes(norm))
      )
    : list;

  const total = filtered.length;
  const pages = Math.max(1, Math.ceil(total / STATUS_PAGE_SIZE));
  const safePage = Math.min(page, pages);
  const slice = filtered.slice((safePage - 1) * STATUS_PAGE_SIZE, safePage * STATUS_PAGE_SIZE);

  const handleSearch = (v) => { setSearch(v); setPage(1); };

  return (
    <Modal open onClose={onClose} size="md"
      bodyStyle={{ flexShrink: 0, flexGrow: 0, flexBasis: 'clamp(200px, 48vh, 360px)' }}
      title={<><span className={[styles.statusDot, styles[`status_${status}`]].join(' ')} style={{ width: 10, height: 10, borderRadius: '50%', display: 'inline-block', marginRight: 6 }} />{label}{!loading && ` (${total})`}</>}
      footer={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{loading ? 'carregando...' : `${total} reserva${total !== 1 ? 's' : ''}`}</span>
          {!loading && pages > 1 && (
            <div style={{ display: 'flex', gap: 4 }}>
              <button className={styles.pageBtn} disabled={safePage === 1} onClick={() => setPage((p) => p - 1)}><ChevronLeft size={13} /></button>
              {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
                <button key={p} className={[styles.pageBtn, p === safePage ? styles.pageBtnActive : ''].join(' ')} onClick={() => setPage(p)}>{p}</button>
              ))}
              <button className={styles.pageBtn} disabled={safePage === pages} onClick={() => setPage((p) => p + 1)}><ChevronRight size={13} /></button>
            </div>
          )}
        </div>
      }
    >
      {/* Search field */}
      <div className={styles.statusFilterSearch}>
        <Search size={13} className={styles.statusFilterSearchIcon} />
        <input
          className={styles.statusFilterSearchInput}
          placeholder="Buscar por nome..."
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
        />
        {search && (
          <button className={styles.clearSearch} onClick={() => handleSearch('')}><X size={12} /></button>
        )}
      </div>

      {loading ? (
        <div className={styles.loadingRow}><Loader2 size={16} className={styles.spin} /> Buscando reservas...</div>
      ) : total === 0 ? (
        <div className={styles.emptyState}>{search ? `Nenhum resultado para "${search}".` : `Nenhuma reserva com status "${label}".`}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {slice.map((r) => {
            const dias     = diffDays(r.dataInicio, r.dataFim);
            const nPessoas = r.hospedes?.length ?? (1 + (r.quantidadeAcompanhantes ?? 0));
            return (
              <div key={r.id} className={styles.searchDropItem} onClick={() => { onSelectReserva(r); onClose(); }}>
                <div className={[styles.searchDropRoomCircle, styles[`dayRoomBadge_${r.status}`]].join(' ')}>{fmtRoom(r.quarto)}</div>
                <div className={styles.searchDropInfo}>
                  <div className={styles.searchDropName}>{r.titularNome}</div>
                  <div className={styles.searchDropDates}>{fmtDateBR(r.dataInicio)} → {fmtDateBR(r.dataFim)}</div>
                  <div className={styles.searchDropMeta}>{diariasTxt(dias)} · {nPessoas} pessoa{nPessoas !== 1 ? 's' : ''}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}

// ─── Orçamento Detail Modal ───────────────────────────────────────────────────
function OrcamentoDetailModal({ orcamentoId, onClose, onSelectReserva, roomDescMap }) {
  const [orc,      setOrc]      = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [priceOpen, setPriceOpen] = useState({});

  useEffect(() => {
    orcamentoApi.buscar({ orcamentoId })
      .then((data) => {
        // GET /orcamento/buscar retorna array
        const item = Array.isArray(data) ? data[0] : data;
        setOrc(item ?? null);
      })
      .catch(() => setOrc(null))
      .finally(() => setLoading(false));
  }, [orcamentoId]);

  // Suporte a `hospedagens` (novo) e `reservas` (legado)
  const reservas = useMemo(() => {
    const list = orc?.hospedagens ?? orc?.reservas ?? [];
    return list.map((h) => normalizeReserva({
      ...h,
      orcamento_info: {
        id:               orc?.id,
        nome_solicitante: orc?.nome_solicitante,
        data_hora_registro: orc?.data_hora_registro,
      },
    })).filter((r) => r.dataInicio);
  }, [orc]);
  const grandTotal = reservas.reduce((s, r) => s + (r.valorTotal ?? 0), 0);
  const totalPago  = reservas.reduce((s, r) => s + (r.totalPago  ?? 0), 0);
  const pendente   = Math.max(0, grandTotal - totalPago);

  const handleDownload = () => {
    // Group reservas by period (same checkin+checkout)
    const periodMap = new Map();
    reservas.forEach((r) => {
      const key = `${r.dataInicio}_${r.dataFim}`;
      if (!periodMap.has(key)) periodMap.set(key, { checkin: r.dataInicio, checkout: r.dataFim, rooms: [], roomHospedes: {} });
      const p = periodMap.get(key);
      p.rooms.push(String(r.quarto));
      p.roomHospedes[String(r.quarto)] = r.hospedes?.length > 0 ? r.hospedes : (r.pessoasOrcamento ?? []);
    });
    const displayPeriodos = [...periodMap.values()];
    const periodoMode = displayPeriodos.length > 1 ? 'multiplos' : 'unico';

    const precosCalc = {};
    const quartosObs = {};
    displayPeriodos.forEach((p, pi) => {
      p.rooms.forEach((quartoId) => {
        const r = reservas.find((rv) => String(rv.quarto) === quartoId && rv.dataInicio === p.checkin && rv.dataFim === p.checkout);
        precosCalc[`${quartoId}_${pi}`] = { valor_total: r?.valorTotal ?? 0, detalhes: [], sazonalidades_aplicadas: [] };
        if (r?.observacao) quartosObs[`${quartoId}_${pi}`] = r.observacao;
      });
    });
    const _u = userStorage.get();
    const titular = reservas[0]?.hospedes?.[0] ?? reservas[0]?.pessoasOrcamento?.[0] ?? null;
    const solicitanteData = {
      nome:           orc?.nome_solicitante ?? titular?.nome ?? '',
      cpf:            titular?.cpf ?? '',
      telefone:       titular?.telefone ?? '',
      email:          titular?.email ?? '',
      dataNascimento: titular?.dataNascimento ?? '',
      dataRegistro:   orc?.data_hora_registro ?? '',
    };
    gerarVoucherReserva({ tipo: 'grupo', periodoMode, displayPeriodos, precosCalc, quartosObs, roomDescMap, userName: _u?.pessoa?.nome ?? _u?.nome ?? '', solicitante: solicitanteData });
  };

  const solicitante   = orc?.nome_solicitante ?? '';
  const dataRegistro  = orc?.data_hora_registro ?? '';

  return (
    <Modal open onClose={onClose} size="md"
      title={<><FileText size={15} /> Orçamento {solicitante ? `— ${solicitante}` : ''}</>}
      footer={
        <div className={styles.footerSpread}>
          <Button variant="secondary" onClick={onClose}>← Voltar</Button>
          <button className={styles.orcDownloadBtn} onClick={handleDownload} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 12px', width: 'auto' }}>
            <FileDown size={15} /> <span style={{ fontSize: 12 }}>Baixar PDF</span>
          </button>
        </div>
      }
    >
      {loading ? (
        <div className={styles.loadingRow}><Loader2 size={16} className={styles.spin} /> Carregando...</div>
      ) : !orc ? (
        <div className={styles.emptyState}>Não foi possível carregar o orçamento.</div>
      ) : (
        <div className={styles.step3Root} style={{ padding: '14px 16px' }}>

          {/* ── Financial summary strip ── */}
          <div className={styles.priceCard} style={{ marginBottom: 14 }}>
            <div className={styles.priceCardHeader} style={{ cursor: 'default' }}>
              <span className={styles.priceCardSummary}>
                <span className={styles.finStripItem}>Valor Total <b>{fmtBRL(grandTotal)}</b></span>
                <span className={styles.finStripDivider} />
                <span className={styles.finStripItem}>Pago <b style={{ color: 'var(--emerald)' }}>{fmtBRL(totalPago)}</b>{grandTotal > 0 && <span style={{ fontSize: 10, color: 'var(--text-2)', marginLeft: 3 }}>({Math.round(totalPago / grandTotal * 100)}%)</span>}</span>
                <span className={styles.finStripDivider} />
                <span className={styles.finStripItem}>Pendente <b style={{ color: pendente > 0 ? '#f97316' : 'var(--emerald)' }}>{fmtBRL(pendente)}</b>{grandTotal > 0 && <span style={{ fontSize: 10, color: 'var(--text-2)', marginLeft: 3 }}>({Math.round(pendente / grandTotal * 100)}%)</span>}</span>
              </span>
            </div>
          </div>

          {/* ── Reservas grouped by period ── */}
          {(() => {
            // Group by period key
            const periodMap = new Map();
            reservas.forEach((r) => {
              const key = `${r.dataInicio}_${r.dataFim}`;
              if (!periodMap.has(key)) periodMap.set(key, { dataInicio: r.dataInicio, dataFim: r.dataFim, reservas: [] });
              periodMap.get(key).reservas.push(r);
            });
            const periods = [...periodMap.values()];
            const multiPeriod = periods.length > 1;

            return periods.map((period) => {
              const pDias = diffDays(period.dataInicio, period.dataFim);
              return (
                <div key={`${period.dataInicio}_${period.dataFim}`}>
                  {/* Period band — only when multiple periods */}
                  {multiPeriod && (
                    <div className={styles.step3PeriodoBand} style={{ marginBottom: 0 }}>
                      <span className={styles.step3PeriodoBandDates}>{fmtDateBR(period.dataInicio)} → {fmtDateBR(period.dataFim)} · {diariasTxt(pDias)}</span>
                    </div>
                  )}

                  {period.reservas.map((r) => {
                    const dias     = diffDays(r.dataInicio, r.dataFim);
                    const hospedes = r.pessoasOrcamento?.length > 0 ? r.pessoasOrcamento : (r.hospedes ?? []);
                    const isOpen   = !!priceOpen[r.id];
                    const valorDiaria = dias > 0 ? r.valorTotal / dias : 0;
                    return (
                      <div key={r.id} className={styles.orcRoomCard}>
                        {/* Room label */}
                        <div className={styles.orcRoomCardLabel}>
                          Apartamento {fmtRoom(r.quarto)}
                          {!multiPeriod && <span style={{ fontWeight: 400, color: 'var(--text-2)', fontSize: 12, marginLeft: 8 }}>{fmtDateBR(r.dataInicio)} → {fmtDateBR(r.dataFim)} · {diariasTxt(dias)}</span>}
                        </div>

                        <div className={styles.orcRoomCardBody}>
                          {/* Hóspedes */}
                          {hospedes.length > 0 && (
                            <div className={styles.orcHospedeList} style={{ marginTop: 0 }}>
                              {hospedes.map((h, hi) => {
                                const age = calcAge(h.dataNascimento);
                                return (
                                  <div key={h.id ?? hi} className={styles.orcHospedeRow}>
                                    <div className={styles.initialsCircleSm}>{initials(h.nome)}</div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{h.nome}</div>
                                      <div style={{ fontSize: 11, color: 'var(--text-2)' }}>
                                        {age !== null ? `${age} anos` : ''}
                                        {h.dataNascimento ? ` · ${h.dataNascimento}` : ''}
                                      </div>
                                    </div>
                                    {hi === 0 && <span className={styles.titularBadge} style={{ flexShrink: 0 }}>Titular</span>}
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* Price breakdown */}
                          {r.valorTotal > 0 && (
                            <div className={styles.step3PriceBlock}>
                              {dias > 0 && Array.from({ length: dias }).map((_, di) => {
                                const from = addDays(r.dataInicio, di);
                                const to   = addDays(r.dataInicio, di + 1);
                                return (
                                  <div key={di} className={styles.step3PriceRow}>
                                    <span className={styles.step3PriceDesc}>Diária {di + 1} &nbsp;{fmtDateBR(from)} → {fmtDateBR(to)}</span>
                                    <span className={styles.step3PriceVal}>{fmtBRL(valorDiaria)}</span>
                                  </div>
                                );
                              })}
                              <div className={styles.step3PriceTotal}>
                                <span>Total</span>
                                <span>{fmtBRL(r.valorTotal)}</span>
                              </div>
                            </div>
                          )}

                          {r.observacao && (
                            <div style={{ fontSize: 12, color: 'var(--text-2)', fontStyle: 'italic' }}>{r.observacao}</div>
                          )}

                          <div style={{ textAlign: 'right' }}>
                            <button style={{ fontSize: 11, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }} onClick={() => onSelectReserva(r)}>
                              Ver reserva →
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            });
          })()}

          {dataRegistro && (
            <div className={styles.dadosRegistrado}>
              <span className={styles.kvLabel}>Solicitado em</span>
              <span className={styles.kvVal}>{dataRegistro}</span>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

// ─── Orçamentos Modal ─────────────────────────────────────────────────────────
function OrcamentosModal({ onClose, categorias = [], tiposPagamento = [], reservas = [], roomDescMap = {}, onSave }) {
  const [search,      setSearch]      = useState('');
  const [orcamentos,  setOrcamentos]  = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [expanded,    setExpanded]    = useState(new Set()); // Set de IDs expandidos
  const [editOrc,     setEditOrc]     = useState(null);      // orçamento sendo editado
  const [editNome,    setEditNome]    = useState('');
  const [editSaving,  setEditSaving]  = useState(false);
  const [editHosp,      setEditHosp]      = useState(null);  // { orc, hosp } → editar hospedagem
  const [showCreate,    setShowCreate]    = useState(false); // abre CreateModal como Novo Orçamento
  const [cancelOrc,     setCancelOrc]     = useState(null);  // orçamento a cancelar
  const [cancelMotivo,  setCancelMotivo]  = useState('');
  const [cancelSaving,  setCancelSaving]  = useState(false);
  const [openMenuId,    setOpenMenuId]    = useState(null);  // id do orçamento com menu aberto
  const [approveSaving, setApproveSaving] = useState(false);
  const timerRef  = useRef(null);
  const menuRef   = useRef(null);

  // Fecha o menu ao clicar fora
  useEffect(() => {
    const h = (e) => { if (!menuRef.current?.contains(e.target)) setOpenMenuId(null); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const fetchOrcamentos = useCallback((nome = '') => {
    setLoading(true);
    const params = nome.trim() ? { nomeSolicitante: nome.trim() } : {};
    orcamentoApi.buscar(params)
      .then((data) => setOrcamentos(Array.isArray(data) ? data : []))
      .catch(() => setOrcamentos([]))
      .finally(() => setLoading(false));
  }, []);

  // Busca inicial
  useEffect(() => { fetchOrcamentos(); }, []); // eslint-disable-line

  const handleSearch = (val) => {
    setSearch(val);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => fetchOrcamentos(val), 400);
  };

  const toggleExpand = (id) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // ── Editar nome do orçamento ───────────────────────────────────────────────
  const openEditOrc = (e, orc) => {
    e.stopPropagation();
    setEditOrc(orc);
    setEditNome(orc.nome_solicitante ?? '');
  };

  const handleSaveEditNome = async () => {
    if (!editOrc || !editNome.trim()) return;
    setEditSaving(true);
    try {
      await orcamentoApi.editar({ id: editOrc.id, nome_solicitante: editNome.trim() });
      setOrcamentos((prev) => prev.map((o) =>
        o.id === editOrc.id ? { ...o, nome_solicitante: editNome.trim() } : o
      ));
      setEditOrc(null);
    } catch { /* silencia */ } finally {
      setEditSaving(false);
    }
  };

  // ── Gerar voucher do orçamento ─────────────────────────────────────────────
  const handleVoucher = (e, orc) => {
    e.stopPropagation();
    const _u = userStorage.get();
    const hospedagens = orc.hospedagens ?? [];
    const displayPeriodos = hospedagens.map((h) => {
      const checkin  = parseBrDate(h.data_hora_checkin);
      const checkout = parseBrDate(h.data_hora_checkout);
      const roomId   = String(h.quarto_id ?? h.quarto?.id ?? '');
      const pessoas  = (h.pessoas_orcamento ?? []).map((p) => ({ id: p.id, nome: p.nome }));
      return { checkin, checkout, rooms: [roomId], roomHospedes: { [roomId]: pessoas } };
    });
    const precosCalc = {};
    hospedagens.forEach((h, i) => {
      const roomId = String(h.quarto_id ?? h.quarto?.id ?? '');
      precosCalc[`${roomId}_${i}`] = { valor_total: h.valor_total ?? 0, detalhes: [], sazonalidades_aplicadas: [] };
    });
    gerarVoucherReserva({
      tipo: 'individual', periodoMode: 'unico',
      displayPeriodos, precosCalc, quartosObs: {}, roomDescMap: {},
      userName: _u?.pessoa?.nome ?? _u?.nome ?? '',
      solicitante: { nome: orc.nome_solicitante ?? '', cpf: '' },
      pagamentos: [],
      isOrcamento: true,
    });
  };

  // ── Aprovar orçamento ─────────────────────────────────────────────────────
  const handleApprove = async (orc) => {
    setOpenMenuId(null);
    setApproveSaving(true);
    try {
      await orcamentoApi.aprovar(orc.id);
      fetchOrcamentos(search);
    } catch { /* silencia */ } finally {
      setApproveSaving(false);
    }
  };

  // ── Cancelar orçamento ────────────────────────────────────────────────────
  const openCancelOrc = (e, orc) => {
    e.stopPropagation();
    setCancelOrc(orc);
    setCancelMotivo('');
  };

  const handleConfirmCancel = async () => {
    if (!cancelOrc || !cancelMotivo.trim()) return;
    setCancelSaving(true);
    try {
      await orcamentoApi.cancelar(cancelOrc.id, cancelMotivo.trim());
      // Atualiza status localmente — o backend não deleta, só muda para ORCAMENTO_CANCELADO
      setOrcamentos((prev) => prev.map((o) =>
        o.id === cancelOrc.id ? { ...o, status: 'ORCAMENTO_CANCELADO' } : o
      ));
      setCancelOrc(null);
      setCancelMotivo('');
    } catch { /* silencia */ } finally {
      setCancelSaving(false);
    }
  };

  return (
    <>
    {/* CreateModal como Novo Orçamento — renderizado sobre o modal de lista */}
    {showCreate && (
      <CreateModal
        forceOrcamento
        reservas={reservas}
        categorias={categorias}
        tiposPagamento={tiposPagamento}
        roomDescMap={roomDescMap}
        onClose={() => setShowCreate(false)}
        onSave={async (result) => {
          setShowCreate(false);
          fetchOrcamentos(search); // atualiza a lista após criar
          onSave?.(result);
        }}
        onNotify={() => {}}
      />
    )}

    <Modal open={!showCreate} onClose={onClose} size="md"
      title={<><FileText size={15} /> Orçamentos{!loading && ` (${orcamentos.length})`}</>}
      footer={
        <div className={styles.footerRight}>
          <Button variant="primary" onClick={() => setShowCreate(true)}>
            <Plus size={14} /> Novo Orçamento
          </Button>
        </div>
      }
    >
      {/* Campo de busca por nome */}
      <div className={styles.statusFilterSearch}>
        <Search size={13} className={styles.statusFilterSearchIcon} />
        <input
          className={styles.statusFilterSearchInput}
          placeholder="Buscar por nome do solicitante..."
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          autoFocus
        />
        {search && (
          <button className={styles.clearSearch} onClick={() => { setSearch(''); fetchOrcamentos(''); }}>
            <X size={12} />
          </button>
        )}
      </div>

      {loading ? (
        <div className={styles.loadingRow}><Loader2 size={16} className={styles.spin} /> Buscando...</div>
      ) : orcamentos.length === 0 ? (
        <div className={styles.emptyState}>
          {search ? `Nenhum orçamento encontrado para "${search}".` : 'Nenhum orçamento cadastrado.'}
        </div>
      ) : (
        <div className={styles.orcListRoot}>
          {orcamentos.map((orc) => {
            const isOpen      = expanded.has(orc.id);
            const hospedagens = orc.hospedagens ?? [];
            const grandTotal  = hospedagens.reduce((s, h) => s + (h.valor_total ?? 0), 0);

            // Cancelado: status explícito no orçamento OU todas as hospedagens canceladas
            const isCancelado = (orc.status != null
              ? (orc.status + '').toUpperCase() === 'ORCAMENTO_CANCELADO'
              : hospedagens.length > 0 && hospedagens.every((h) => mapStatus(h) === 'cancelado'));

            return (
              <div key={orc.id} className={[styles.orcListGroup, isCancelado ? styles.orcListGroupCancelado : ''].join(' ')}>

                {/* ── Linha cabeçalho ── */}
                <div className={styles.orcListRowWrap}>
                  <button className={styles.orcListRow} onClick={() => toggleExpand(orc.id)}>
                    <div className={styles.orcListInfo}>
                      <span className={styles.orcListName}>{orc.nome_solicitante}</span>
                      <span className={styles.orcListMeta}>
                        {orc.data_hora_registro}
                        {hospedagens.length > 0 && (
                          <> · <b>{hospedagens.length}</b> hospedagem{hospedagens.length !== 1 ? 's' : ''}</>
                        )}
                        {grandTotal > 0 && <> · {fmtBRL(grandTotal)}</>}
                        {isCancelado && <> · <span style={{ color: '#ef4444', fontWeight: 600 }}>Cancelado</span></>}
                      </span>
                    </div>
                    <ChevronDown size={14} style={{ flexShrink: 0, color: 'var(--text-2)', transition: 'transform 0.18s', transform: isOpen ? 'rotate(180deg)' : '' }} />
                  </button>

                  {/* FAB de ações — oculto quando cancelado */}
                  {!isCancelado && (
                    <div
                      className={styles.orcMenuWrap}
                      ref={openMenuId === orc.id ? menuRef : null}
                    >
                      <button
                        className={[styles.orcMenuTrigger, openMenuId === orc.id ? styles.orcMenuTriggerActive : ''].join(' ')}
                        title="Ações"
                        onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === orc.id ? null : orc.id); }}
                      >
                        <MoreVertical size={14} />
                      </button>

                      {openMenuId === orc.id && (
                        <div className={styles.orcMenuDrop}>
                          <button className={styles.orcMenuItem} onClick={(e) => { setOpenMenuId(null); openEditOrc(e, orc); }}>
                            <Pencil size={12} /> Editar
                          </button>
                          <button className={styles.orcMenuItem} onClick={(e) => { setOpenMenuId(null); handleVoucher(e, orc); }}>
                            <FileDown size={12} /> Gerar PDF
                          </button>
                          <button className={[styles.orcMenuItem, styles.orcMenuItemApprove].join(' ')} disabled={approveSaving} onClick={() => handleApprove(orc)}>
                            <Check size={12} /> Aprovar Orçamento
                          </button>
                          <div className={styles.orcMenuDivider} />
                          <button className={[styles.orcMenuItem, styles.orcMenuItemDanger].join(' ')} onClick={(e) => { setOpenMenuId(null); openCancelOrc(e, orc); }}>
                            <Trash2 size={12} /> Cancelar
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* ── Hospedagens expandidas ── */}
                {isOpen && (
                  <div className={styles.orcHospList}>
                    {hospedagens.map((h) => {
                      const st       = mapStatus(h);
                      const pessoas  = h.pessoas_orcamento ?? [];
                      const checkin  = parseBrDate(h.data_hora_checkin);
                      const checkout = parseBrDate(h.data_hora_checkout);
                      const dias     = checkin && checkout ? diffDays(checkin, checkout) : 0;
                      const motivo   = h.motivo_cancelamento?.motivo_cancelamento ?? null;
                      const quartoId = h.quarto_id ?? h.quarto?.id ?? null;

                      return (
                        <div
                          key={h.id}
                          className={[styles.orcHospItem, st === 'cancelado' ? styles.orcHospItemCancelado : ''].join(' ')}
                          onClick={() => setEditHosp({ orc, hosp: h })}
                          title="Clique para editar"
                        >
                          {/* ── Banda de período escura ── */}
                          <div className={styles.orcHospBand}>
                            <span className={styles.orcHospBandPeriod}>
                              {fmtDateBR(checkin)} → {fmtDateBR(checkout)}
                            </span>
                            <span className={styles.orcHospBandDiarias}>{diariasTxt(dias)}</span>
                          </div>

                          {/* Quarto */}
                          {quartoId && (
                            <div className={styles.orcHospRoomLabel}>
                              Apartamento {fmtRoom(quartoId)}
                            </div>
                          )}

                          {/* Pessoas — lista vertical sem chips */}
                          {pessoas.length > 0 && (
                            <div className={styles.orcHospPessoasList}>
                              {pessoas.map((p) => {
                                const age = calcAge(p.data_nascimento);
                                return (
                                  <div key={p.id} className={styles.orcHospPessoaRow}>
                                    <span className={styles.orcHospPessoaNome}>{p.nome}</span>
                                    {age !== null && <span className={styles.orcHospPessoaAge}>{age} anos</span>}
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* Valor total */}
                          {h.valor_total > 0 && (
                            <div className={styles.orcHospFooter}>
                              <span className={styles.orcHospValor}>Total: {fmtBRL(h.valor_total)}</span>
                            </div>
                          )}

                          {/* Observação */}
                          {h.observacao && (
                            <div className={styles.orcHospObs}>{h.observacao}</div>
                          )}

                          {/* Motivo cancelamento */}
                          {motivo && (
                            <div className={styles.orcHospCancelReason}>
                              <XCircle size={11} style={{ flexShrink: 0 }} />
                              {motivo}
                              {h.motivo_cancelamento?.data_hora_registro && (
                                <span style={{ color: 'var(--text-2)', marginLeft: 4 }}>
                                  · {h.motivo_cancelamento.data_hora_registro}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Modal>

    {/* ── Modal: editar nome do orçamento ── */}
    <Modal open={!!editOrc} onClose={() => { setEditOrc(null); setEditNome(''); }} size="sm"
      title={<><Pencil size={14} /> Editar Orçamento</>}
      footer={
        <div className={styles.footerRight}>
          <Button variant="secondary" onClick={() => { setEditOrc(null); setEditNome(''); }}>Cancelar</Button>
          <Button variant="primary" disabled={!editNome.trim() || editSaving} onClick={handleSaveEditNome}>
            {editSaving && <Loader2 size={13} className={styles.spin} />} Salvar
          </Button>
        </div>
      }
    >
      <div className={styles.formStack}>
        <FormField label="Nome do Solicitante">
          <input
            className={styles.formInput}
            value={editNome}
            onChange={(e) => setEditNome(e.target.value.toUpperCase())}
            placeholder="NOME DO SOLICITANTE"
            style={{ textTransform: 'uppercase' }}
            autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEditNome(); }}
          />
        </FormField>
      </div>
    </Modal>

    {/* ── Modal: editar hospedagem (placeholder — expande conforme necessidade) ── */}
    {editHosp && (
      <Modal open onClose={() => setEditHosp(null)} size="sm"
        title={<><Pencil size={14} /> Editar Hospedagem</>}
        footer={<div className={styles.footerRight}><Button onClick={() => setEditHosp(null)}>Fechar</Button></div>}
      >
        <div className={styles.formStack}>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-2)' }}>
            Orçamento: <b style={{ color: 'var(--text)' }}>{editHosp.orc.nome_solicitante}</b>
          </p>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-2)' }}>
            Período:{' '}
            <b style={{ color: 'var(--text)' }}>
              {fmtDateBR(parseBrDate(editHosp.hosp.data_hora_checkin))} → {fmtDateBR(parseBrDate(editHosp.hosp.data_hora_checkout))}
            </b>
          </p>
          <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--text-2)' }}>
            Edição de hospedagem em desenvolvimento.
          </p>
        </div>
      </Modal>
    )}

    {/* ── Modal: cancelar orçamento ── */}
    <Modal open={!!cancelOrc} onClose={() => { setCancelOrc(null); setCancelMotivo(''); }} size="sm"
      title={<><Trash2 size={14} /> Cancelar Orçamento</>}
      footer={
        <div className={styles.footerRight}>
          <Button variant="secondary" onClick={() => { setCancelOrc(null); setCancelMotivo(''); }}>Voltar</Button>
          <Button variant="danger" disabled={!cancelMotivo.trim() || cancelSaving} onClick={handleConfirmCancel}>
            {cancelSaving && <Loader2 size={13} className={styles.spin} />} Cancelar Definitivamente
          </Button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text)' }}>
          Informe o motivo do cancelamento do orçamento de{' '}
          <b>{cancelOrc?.nome_solicitante}</b>:
        </p>
        <textarea
          className={styles.motivoTextarea}
          placeholder="Ex.: Solicitação do cliente"
          rows={3}
          value={cancelMotivo}
          onChange={(e) => setCancelMotivo(e.target.value)}
          autoFocus
        />
      </div>
    </Modal>
    </>
  );
}



// ─── Solicitações Modal ───────────────────────────────────────────────────────
function SolicitacoesModal({ onClose, onSelectReserva }) {
  const [solicitacoes, setSolicitacoes] = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [showCreate,   setShowCreate]   = useState(false);

  const fetchSolicitacoes = useCallback(() => {
    setLoading(true);
    hospedagemApi.buscar({ status: 'RESERVA_SOLICITADA' })
      .then((data) => {
        const flat = Array.isArray(data) ? data : [];
        const seen = new Set();
        const out  = [];
        for (const r of flat) {
          if (!seen.has(r.id)) { seen.add(r.id); out.push(normalizeReserva(r)); }
        }
        setSolicitacoes(out.filter((r) => r.dataInicio));
      })
      .catch(() => setSolicitacoes([]))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line

  useEffect(() => { fetchSolicitacoes(); }, []); // eslint-disable-line

  return (
    <>
      {showCreate && (
        <CreateModal
          forceSolicitacao
          reservas={[]}
          categorias={[]}
          tiposPagamento={[]}
          roomDescMap={{}}
          onClose={() => setShowCreate(false)}
          onSave={() => { setShowCreate(false); fetchSolicitacoes(); }}
          onNotify={() => {}}
        />
      )}

      <Modal open={!showCreate} onClose={onClose} size="md"
        title={<><Bell size={15} /> Solicitações{!loading && ` (${solicitacoes.length})`}</>}
        footer={
          <div className={styles.footerRight}>
            <Button variant="primary" onClick={() => setShowCreate(true)}>
              <Plus size={14} /> Nova Solicitação
            </Button>
          </div>
        }
      >
        {loading ? (
          <div className={styles.emptyState}><Loader2 size={16} className={styles.spin} style={{ marginRight: 6 }} />Carregando...</div>
        ) : solicitacoes.length === 0 ? (
          <div className={styles.emptyState}>Nenhuma solicitação pendente.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {solicitacoes.map((r) => {
              const nomeDisplay = r.pessoasOrcamento?.[0]?.nome ?? r.titularNome;
              const dias        = diffDays(r.dataInicio, r.dataFim);
              const nPessoas    = (r.pessoasOrcamento?.length ?? 0) || (r.hospedes?.length ?? (1 + (r.quantidadeAcompanhantes ?? 0)));
              return (
                <div key={r.id} className={styles.searchDropItem} style={{ cursor: 'pointer' }} onClick={() => onSelectReserva(r)}>
                  <div className={[styles.searchDropRoomCircle, styles[`dayRoomBadge_${r.status}`]].join(' ')}>
                    {fmtRoom(r.quarto)}
                  </div>
                  <div className={styles.searchDropInfo}>
                    <div className={styles.searchDropName}>{nomeDisplay}</div>
                    <div className={styles.searchDropDates}>{fmtDateBR(r.dataInicio)} → {fmtDateBR(r.dataFim)}</div>
                    <div className={styles.searchDropMeta}>{diariasTxt(dias)} · {nPessoas} pessoa{nPessoas !== 1 ? 's' : ''}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Modal>
    </>
  );
}

// ─── Room Combobox (single or multi-select) ───────────────────────────────────
function RoomCombobox({ value, onChange, availableRooms, categorias, roomDescMap = {}, singleSelect = false, disabled = false, loading = false }) {
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
    const w    = Math.min(rect.width, window.innerWidth - 16);
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - w - 8));
    setDropStyle({
      position: 'fixed',
      zIndex: 9999,
      width: w,
      left,
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
    ? (singleSelect ? 'Selecione um apartamento...' : 'Selecione apartamento(s)...')
    : `Apartamento ${fmtRoom(parseInt(value[0]))}${!singleSelect && value.length > 1 ? ` +${value.length - 1}` : ''}`;

  const dropdown = open && createPortal(
    <div ref={dropRef} className={styles.comboDropdown} style={{ ...dropStyle, overflowY: 'auto' }}>
      <div className={styles.comboSearchWrap}>
        <Search size={12} className={styles.comboSearchIcon} />
        <input
          className={styles.comboSearchInput}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filtrar apartamento..."
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
                  <span className={styles.comboItemNum}>Apartamento {fmtRoom(r)}</span>
                  {roomDescMap[r] && <span className={styles.comboItemTipo}>{roomDescMap[r]}</span>}
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
        onClick={() => { if (!disabled && !loading) { setOpen((o) => !o); setFilter(''); } }}
        disabled={disabled || loading} style={(disabled || loading) ? { opacity: loading ? 1 : 0.45, cursor: loading ? 'wait' : 'not-allowed' } : undefined}
      >
        {loading ? (
          <span className={styles.comboPlaceholder} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Loader2 size={13} className={styles.spin} /> Verificando disponibilidade...
          </span>
        ) : !singleSelect && value.length > 0 ? (
          <div className={styles.comboChipsInline}>
            {value.map((q) => (
              <div key={q} className={styles.hospedeChipRect}>
                <span>Apartamento {fmtRoom(parseInt(q))}</span>
                <button type="button" className={styles.chipRemove} onClick={(e) => { e.stopPropagation(); handleSelect(parseInt(q)); }}><X size={10} /></button>
              </div>
            ))}
          </div>
        ) : (
          <span className={styles.comboPlaceholder}>{label}</span>
        )}
        {loading
          ? <Loader2 size={13} className={styles.spin} style={{ flexShrink: 0, opacity: 0 }} />
          : <ChevronDown size={13} style={{ flexShrink: 0, transition: 'transform 0.18s', transform: open ? 'rotate(180deg)' : '' }} />
        }
      </button>
      {dropdown}
    </div>
  );
}

// ─── Sem Cadastro Hospedes Picker (orçamento sem cadastro) ───────────────────
function SemCadastroHospedesPicker({ value = [], onChange, onDraftChange }) {
  const autoNome = (len) => `ADULTO ${len + 1}`;
  const isAutoNome = (s) => /^ADULTO \d+$/i.test(s.trim());

  const [nome,     setNome]     = useState(() => autoNome(value.length));
  const [dob,      setDob]      = useState(null);
  const [isAdulto, setIsAdulto] = useState(true);

  // Atualiza o campo automaticamente quando o tamanho da lista muda,
  // mas só se o usuário ainda está com o nome automático (ou vazio)
  useEffect(() => {
    setNome((prev) => (prev === '' || isAutoNome(prev) ? autoNome(value.length) : prev));
  }, [value.length]); // eslint-disable-line

  const canAdd   = nome.trim().length > 0 && (isAdulto || dob !== null);
  const hasDraft = !isAutoNome(nome) || dob !== null; // draft real = nome customizado ou dob preenchido

  useEffect(() => { onDraftChange?.(hasDraft); }, [hasDraft]); // eslint-disable-line

  const adulto18Date = () => {
    const t = new Date();
    return formatDate(new Date(t.getFullYear() - 18, t.getMonth(), t.getDate()));
  };

  const add = () => {
    if (!canAdd) return;
    const dataNascimento = isAdulto ? adulto18Date() : formatDate(dob);
    onChange([...value, { nome: nome.trim(), dataNascimento, _adulto: isAdulto }]);
    // próximo nome é atualizado pelo useEffect acima (value.length cresce)
    setDob(null);
  };

  const rem = (i) => onChange(value.filter((_, j) => j !== i));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div className={styles.semCadastroAddRow}>
        <input
          className={styles.formInput}
          style={{ flex: 1, minWidth: 0 }}
          type="text"
          placeholder="Nome do hóspede"
          value={nome}
          onChange={(e) => setNome(e.target.value.toUpperCase())}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
        />
        <label className={styles.empresaModeToggle}>
          <input type="checkbox" checked={isAdulto} onChange={(e) => { setIsAdulto(e.target.checked); if (e.target.checked) setDob(null); }} />
          <span>Adulto</span>
        </label>
        {!isAdulto && (
          <div style={{ width: 150, flexShrink: 0 }}>
            <DatePicker value={dob} onChange={setDob} placeholder="Nascimento" maxDate={new Date()} />
          </div>
        )}
        <button type="button" className={styles.addOrcGuestBtn} onClick={add} disabled={!canAdd}>
          <Plus size={13} /> Adicionar Hóspede
        </button>
      </div>
      {value.length > 0 && (
        <div className={styles.selectedChips}>
          {value.map((p, i) => (
            <div key={i} className={styles.hospedeChipRect}>
              <span>{p.nome}</span>
              {p._adulto
                ? <span style={{ color: 'var(--text-2)', fontSize: 11 }}>Adulto</span>
                : p.dataNascimento && <span style={{ color: 'var(--text-2)', fontSize: 11 }}>{fmtDateBR(p.dataNascimento)}</span>
              }
              <button type="button" className={styles.chipRemove} onClick={() => rem(i)}><X size={10} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Room Hospedes Picker ─────────────────────────────────────────────────────
function RoomHospedesPicker({ value = [], onChange }) {
  const [search,        setSearch]        = useState('');
  const [results,       setResults]       = useState([]);
  const [searching,     setSearching]     = useState(false);
  const [dropStyle,     setDropStyle]     = useState({});
  const [pending,       setPending]       = useState(null); // { type:'pessoa'|'empresa', ... }
  const [isEmpresaMode, setIsEmpresaMode] = useState(false);
  const inputRef = useRef(null);
  const wrapRef  = useRef(null);

  useEffect(() => {
    if (search.trim().length < 2) { setResults([]); setPending(null); return; }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        if (isEmpresaMode) {
          const res  = await cadastroApi.listarEmpresas({ termo: search.trim(), size: 15, page: 0 });
          const list = Array.isArray(res) ? res : (res.content ?? []);
          setResults(list.map((e) => ({
            id: e.id,
            nome: e.razao_social ?? e.razaoSocial ?? e.nome_fantasia ?? e.nomeFantasia ?? '',
            nomeFantasia: e.nome_fantasia ?? e.nomeFantasia ?? '',
            isEmpresa: true,
          })));
        } else {
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
        }
      } catch { setResults([]); }
      finally  { setSearching(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [search, isEmpresaMode]);

  const calcDropPos = (maxH = 260) => {
    const el = wrapRef.current ?? inputRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const spaceAbove = rect.top - 8;
    setDropStyle({ position: 'fixed', zIndex: 99999, left: rect.left, bottom: window.innerHeight - rect.top + 4, width: rect.width, maxHeight: Math.min(maxH, spaceAbove) });
  };

  useEffect(() => { if (results.length) calcDropPos(); }, [results]);

  const addMany = (list) => {
    const existing = new Set(value.map((x) => x.id));
    const toAdd = list.filter((h) => !existing.has(h.id));
    if (toAdd.length) onChange([...value, ...toAdd]);
  };

  const handleResultClick = async (h) => {
    if (h.isEmpresa) {
      setSearching(true);
      try {
        const res     = await cadastroApi.buscarEmpresaPorId(h.id);
        const empresa = res?.content?.[0] ?? res;
        const vinculados = (empresa.pessoas_vinculadas ?? empresa.pessoasVinculadas ?? []).map((p) => ({
          id: p.id, nome: p.nome, cpf: p.cpf ?? '',
          dataNascimento: p.data_nascimento ?? '',
          bloqueado: p.status === 'BLOQUEADO',
        }));
        if (vinculados.length === 0) { setSearch(''); setResults([]); return; }
        const allActive = new Set(vinculados.filter((v) => !v.bloqueado).map((v) => v.id));
        setPending({ type: 'empresa', empresa: { id: empresa.id, nome: h.nome }, vinculados, selected: allActive });
        calcDropPos(320);
      } catch { /* silent */ } finally { setSearching(false); }
      return;
    }
    if (h.bloqueado) return;
    if (h.acompanhantes?.length > 0) {
      setPending({ type: 'pessoa', titular: h, selected: new Set() });
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

  const confirmAdd = () => {
    if (pending.type === 'empresa') {
      const toAdd = pending.vinculados.filter((v) => !v.bloqueado && pending.selected.has(v.id));
      addMany(toAdd);
    } else {
      const toAdd = [pending.titular,
        ...pending.titular.acompanhantes.filter((a) => !a.bloqueado && pending.selected.has(a.id)),
      ];
      addMany(toAdd);
    }
    setPending(null); setSearch(''); setResults([]);
  };

  const confirmPessoaOnly = () => {
    addMany([pending.titular]);
    setPending(null); setSearch(''); setResults([]);
  };

  const rem = (id) => onChange(value.filter((x) => x.id !== id));

  const toggleEmpresaMode = (checked) => {
    setIsEmpresaMode(checked);
    setSearch(''); setResults([]); setPending(null);
  };

  const showDrop = pending !== null || results.length > 0;
  const dropdown = showDrop && createPortal(
    <div className={styles.searchResultsList} style={{ ...dropStyle, boxShadow: '0 8px 24px rgba(0,0,0,0.18)', display: 'flex', flexDirection: 'column', overflowY: 'hidden' }}>
      {pending ? (
        <>
          <div className={styles.companionHeader}>
            <button className={styles.companionBack} onClick={() => setPending(null)}><ChevronLeft size={12} /> Voltar</button>
            {pending.type === 'empresa' && (
              <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--text-2)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {pending.empresa.nome}
              </span>
            )}
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {pending.type === 'empresa' ? (
              pending.vinculados.map((v) => (
                <div key={v.id}
                  className={[styles.companionRow, v.bloqueado ? styles.searchResultBlocked : styles.companionRowClickable].join(' ')}
                  onClick={() => !v.bloqueado && toggleCompanion(v.id)}>
                  <div className={[styles.companionCheck, pending.selected.has(v.id) ? styles.companionChecked : ''].join(' ')}>
                    {pending.selected.has(v.id) && <Check size={11} />}
                  </div>
                  <div className={styles.companionInfo}>
                    <span className={styles.companionName}>{v.nome}</span>
                    {v.cpf && <span className={styles.companionMeta}>{fmtCpf(v.cpf)}</span>}
                  </div>
                  {v.bloqueado && <span className={styles.blockedChip}>Bloqueado</span>}
                </div>
              ))
            ) : (
              <>
                <div className={styles.companionRow}>
                  <div className={[styles.companionCheck, styles.companionChecked].join(' ')}><Check size={11} /></div>
                  <div className={styles.companionInfo}>
                    <span className={styles.companionName}>{pending.titular.nome}</span>
                    {pending.titular.cpf && <span className={styles.companionMeta}>{fmtCpf(pending.titular.cpf)}</span>}
                  </div>
                  <span className={styles.titularChip}>Titular</span>
                </div>
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
              </>
            )}
          </div>
          <div className={styles.companionActions}>
            {pending.type === 'empresa' ? (
              <>
                <button className={styles.companionBtnSecondary} onClick={() => setPending(null)}>Cancelar</button>
                <button className={styles.companionBtnPrimary} onClick={confirmAdd} disabled={pending.selected.size === 0}>
                  Adicionar{pending.selected.size > 0 ? ` (${pending.selected.size})` : ''} →
                </button>
              </>
            ) : (
              <>
                <button className={styles.companionBtnSecondary} onClick={confirmPessoaOnly}>Só o titular</button>
                <button className={styles.companionBtnPrimary} onClick={confirmAdd}>Adicionar →</button>
              </>
            )}
          </div>
        </>
      ) : (
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {results.map((h) => (
            <div key={h.id}
              className={[styles.searchResultItem, !h.isEmpresa && h.bloqueado ? styles.searchResultBlocked : ''].join(' ')}
              onClick={() => handleResultClick(h)}>
              <div className={styles.searchResultName}>{h.nome}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {!h.isEmpresa && h.cpf && <div className={styles.hospedeCpf}>{fmtCpf(h.cpf)}</div>}
                {!h.isEmpresa && h.acompanhantes?.length > 0 && !h.bloqueado && <span className={styles.companionCountChip}>{h.acompanhantes.length} acomp.</span>}
                {!h.isEmpresa && h.bloqueado && <span className={styles.blockedChip}>Bloqueado</span>}
              </div>
              <ChevronRight size={13} className={styles.addIcon} />
            </div>
          ))}
        </div>
      )}
    </div>,
    document.body
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div ref={wrapRef} className={styles.hospSearchWrap} style={{ flex: 1, minWidth: 0 }}>
          {searching
            ? <Loader2 size={13} className={[styles.hospSearchIcon, styles.spin].join(' ')} />
            : <Search size={13} className={styles.hospSearchIcon} />}
          <div className={styles.hospInputInner}>
            {value.map((h) => (
              <div key={h.id} className={styles.hospedeChipRect}>
                <span>{h.nome}</span>
                <button type="button" className={styles.chipRemove} onClick={() => rem(h.id)}><X size={10} /></button>
              </div>
            ))}
            <input ref={inputRef} className={styles.hospInlineInput} value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={value.length === 0 ? (isEmpresaMode ? 'Buscar empresa...' : 'Buscar hóspede...') : ''} />
          </div>
        </div>
        <label className={styles.empresaModeToggle}>
          <input type="checkbox" checked={isEmpresaMode} onChange={(e) => toggleEmpresaMode(e.target.checked)} />
          <span>Empresa</span>
        </label>
      </div>
      {dropdown}
    </div>
  );
}

// ─── Create Reservation Modal ─────────────────────────────────────────────────
function CreateModal({ initialRoom, initialStart, initialEnd, initialAvailable, reservas, onClose, onSave, onNotify, categorias, tiposPagamento, roomDescMap = {}, forceOrcamento = false, forceSolicitacao = false }) {
  const isSolicitacao = forceSolicitacao;
  const STEPS = isSolicitacao
    ? ['Tipo', 'Período & Hóspedes', 'Resumo']
    : ['Tipo', 'Apartamento, Período & Hóspedes', 'Resumo & Pagamento'];

  const [step,             setStep]             = useState((!isSolicitacao && initialRoom) ? 2 : 1);
  const [tipo,             setTipo]             = useState('simples'); // 'simples' | 'grupo'
  const isOrcamento = forceOrcamento; // orçamento é sempre sem cadastro quando forceOrcamento
  const [nomeSolicitante,  setNomeSolicitante]  = useState(''); // nome do solicitante para orçamentos

  // Step 2: período único
  const [quartos,        setQuartos]        = useState(initialRoom ? [String(initialRoom)] : []);
  const [checkin,        setCheckin]        = useState(initialStart ? new Date(initialStart + 'T00:00:00') : null);
  const [checkout,       setCheckout]       = useState(initialEnd   ? new Date(initialEnd   + 'T00:00:00') : null);
  const [quartoHospedes,    setQuartoHospedes]    = useState({}); // { [quartoId]: [hospede] } — registered
  const [quartoHospedesOrc, setQuartoHospedesOrc] = useState({}); // { [quartoId]: [{ nome, dataNascimento }] } — sem cadastro

  // Step 2: múltiplos períodos
  const [periodoMode,    setPeriodoMode]    = useState('unico'); // 'unico' | 'multiplos'
  const [periodos,       setPeriodos]       = useState([]);      // [{ rooms, checkin, checkout, roomHospedes, roomHospedesOrc }]
  const [mpRooms,        setMpRooms]        = useState([]);
  const [mpCheckin,      setMpCheckin]      = useState(null);
  const [mpCheckout,     setMpCheckout]     = useState(null);
  const [mpRoomHospedes,    setMpRoomHospedes]    = useState({});
  const [mpRoomHospedesOrc, setMpRoomHospedesOrc] = useState({});
  const [editingPeriodoIdx, setEditingPeriodoIdx] = useState(null); // index of period being edited

  // Step 3: Pagamentos

  const [quartosPag,     setQuartosPag]     = useState({});         // { [quartoId]: [payment] } individual
  const [pagModo,        setPagModo]        = useState('por_quarto'); // 'por_quarto' | 'unico'
  const [pagUnico,       setPagUnico]       = useState([]);           // payments for pagamento único mode
  const [showPagModal,   setShowPagModal]   = useState(false);
  const [showPagModalRoom, setShowPagModalRoom] = useState(null);   // quartoId for individual mode
  const [quartosObs,     setQuartosObs]     = useState({}); // { [quartoId]: string }
  const [saving,      setSaving]      = useState(false);
  const [precosCalc,       setPrecosCalc]       = useState({}); // { [`${quartoId}_${periodoIdx}`]: calcResponse }
  const [calcLoading,      setCalcLoading]      = useState(false);
  const [showPriceDetails, setShowPriceDetails] = useState(true);
  const [roomPriceOpen,    setRoomPriceOpen]    = useState({}); // { [`${q}_${pi}`]: bool }
  const [apiAvailability,      setApiAvailability]      = useState(null); // Set<roomId> | null
  const [mpApiAvailability,    setMpApiAvailability]    = useState(null); // Set<roomId> | null
  const [availLoading,         setAvailLoading]         = useState(false);
  const [mpAvailLoading,       setMpAvailLoading]       = useState(false);

  // Derived
  const checkinStr  = checkin  ? formatDate(checkin)  : '';
  const checkoutStr = checkout ? formatDate(checkout) : '';
  const dias        = checkinStr && checkoutStr ? diffDays(checkinStr, checkoutStr) : 0;

  const allRoomIds = useMemo(() => categorias.flatMap((c) => c.quartos), [categorias]);

  // Fetch availability from API whenever unico-mode dates change
  useEffect(() => {
    if (!checkin || !checkout || !allRoomIds.length) { setApiAvailability(null); setAvailLoading(false); return; }
    let cancelled = false;
    setAvailLoading(true);
    setApiAvailability(null);
    reservaApi.verificarDisponibilidade({
      data_entrada: toBrDate(checkinStr),
      data_saida: toBrDate(checkoutStr),
    }).then((results) => {
      if (cancelled) return;
      const avail = new Set(
        (Array.isArray(results) ? results : []).filter((r) => r.disponivel).map((r) => r.quarto_id ?? r.fk_quarto)
      );
      setApiAvailability(avail);
    }).catch(() => { if (!cancelled) setApiAvailability(null); })
      .finally(() => { if (!cancelled) setAvailLoading(false); });
    return () => { cancelled = true; };
  }, [checkinStr, checkoutStr]); // eslint-disable-line

  // Fetch availability for multiplos-mode form dates
  useEffect(() => {
    if (!mpCheckin || !mpCheckout || !allRoomIds.length) { setMpApiAvailability(null); setMpAvailLoading(false); return; }
    let cancelled = false;
    setMpAvailLoading(true);
    setMpApiAvailability(null);
    reservaApi.verificarDisponibilidade({
      data_entrada: toBrDate(formatDate(mpCheckin)),
      data_saida: toBrDate(formatDate(mpCheckout)),
    }).then((results) => {
      if (cancelled) return;
      const avail = new Set(
        (Array.isArray(results) ? results : []).filter((r) => r.disponivel).map((r) => r.quarto_id ?? r.fk_quarto)
      );
      setMpApiAvailability(avail);
    }).catch(() => { if (!cancelled) setMpApiAvailability(null); })
      .finally(() => { if (!cancelled) setMpAvailLoading(false); });
    return () => { cancelled = true; };
  }, [mpCheckin, mpCheckout]); // eslint-disable-line

  const availableRooms = useMemo(() => {
    if (!checkinStr || !checkoutStr) return initialAvailable || allRoomIds;
    if (apiAvailability) return allRoomIds.filter((r) => apiAvailability.has(r));
    return allRoomIds.filter(
      (r) => !reservas.some((res) => res.quarto === r && res.dataInicio < checkoutStr && res.dataFim > checkinStr)
    );
  }, [checkinStr, checkoutStr, reservas, initialAvailable, allRoomIds, apiAvailability]);

  const mpAvailableRooms = useMemo(() => {
    if (!mpCheckin || !mpCheckout) return allRoomIds;
    const ci = formatDate(mpCheckin);
    const co = formatDate(mpCheckout);
    const alreadyPicked = periodos.flatMap((p, idx) => {
      if (idx === editingPeriodoIdx) return [];
      const pi = formatDate(p.checkin); const po = formatDate(p.checkout);
      if (pi < co && po > ci) return p.rooms.map((r) => parseInt(r));
      return [];
    });
    const baseAvail = mpApiAvailability
      ? allRoomIds.filter((r) => mpApiAvailability.has(r))
      : allRoomIds.filter((r) => !reservas.some((res) => res.quarto === r && res.dataInicio < co && res.dataFim > ci));
    return baseAvail.filter((r) => !alreadyPicked.includes(r));
  }, [mpCheckin, mpCheckout, periodos, editingPeriodoIdx, reservas, allRoomIds, mpApiAvailability]);


  const addPagamento = (payment) => {
    const entry = { _localId: Date.now(), _criadoEm: new Date().toLocaleString('pt-BR'), ...payment };
    if (pagModo === 'unico') {
      setPagUnico((prev) => [...prev, entry]);
    } else if (showPagModalRoom !== null) {
      setQuartosPag((prev) => ({ ...prev, [showPagModalRoom]: [...(prev[showPagModalRoom] || []), entry] }));
    }
    setShowPagModal(false);
    setShowPagModalRoom(null);
  };

  // Orçamento/Solicitação é sempre sem cadastro (pessoas_orcamento com nome + data de nascimento)
  const isOrcSemCadastro = isOrcamento || isSolicitacao;

  const resetMpForm = () => {
    setMpRooms([]); setMpCheckin(null); setMpCheckout(null);
    setMpRoomHospedes({}); setMpRoomHospedesOrc({});
    setEditingPeriodoIdx(null);
  };

  const addPeriodo = () => {
    if (!mpRooms.length || !mpCheckin || !mpCheckout) return;
    const entry = {
      rooms: [...mpRooms], checkin: mpCheckin, checkout: mpCheckout,
      roomHospedes:    { ...mpRoomHospedes },
      roomHospedesOrc: { ...mpRoomHospedesOrc },
    };
    if (editingPeriodoIdx !== null) {
      setPeriodos((ps) => ps.map((p, i) => i === editingPeriodoIdx ? entry : p));
    } else {
      setPeriodos((ps) => [...ps, entry]);
    }
    resetMpForm();
  };

  const startEditPeriodo = (i) => {
    const p = periodos[i];
    setMpRooms([...p.rooms]);
    setMpCheckin(p.checkin instanceof Date ? p.checkin : new Date(p.checkin + 'T00:00:00'));
    setMpCheckout(p.checkout instanceof Date ? p.checkout : new Date(p.checkout + 'T00:00:00'));
    setMpRoomHospedes({ ...(p.roomHospedes || {}) });
    setMpRoomHospedesOrc({ ...(p.roomHospedesOrc || {}) });
    setEditingPeriodoIdx(i);
  };

  const allSelectedRooms = periodoMode === 'multiplos'
    ? [...new Set(periodos.flatMap((p) => p.rooms))]
    : quartos;

  const [semCadastroDraft, setSemCadastroDraft] = useState(false);
  const mpFormDirty = periodoMode === 'multiplos' && (mpRooms.length > 0 || !!mpCheckin || !!mpCheckout || editingPeriodoIdx !== null);

  const hasGuestsForAllRooms = periodoMode === 'unico'
    ? quartos.length > 0 && quartos.every((q) => (quartoHospedes[q]?.length || 0) + (quartoHospedesOrc[q]?.length || 0) > 0)
    : periodos.length > 0 && periodos.every((p) => p.rooms.every((r) => (p.roomHospedes?.[r]?.length || 0) + (p.roomHospedesOrc?.[r]?.length || 0) > 0));

  const canNext2 = periodoMode === 'unico'
    ? quartos.length > 0 && checkinStr && checkoutStr && dias > 0 && hasGuestsForAllRooms && !semCadastroDraft
    : periodos.length > 0 && !mpFormDirty && hasGuestsForAllRooms && !semCadastroDraft;

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
        ? [{ rooms: quartos, checkin: checkinStr, checkout: checkoutStr, roomHospedes: quartoHospedes, roomHospedesOrc: quartoHospedesOrc }]
        : periodos.map((p) => ({ ...p, checkin: formatDate(p.checkin), checkout: formatDate(p.checkout) }));

      // Build ordered list of { key, item } so we can map response[i] → key
      const indexed = [];
      displayPeriodos.forEach((p, pi) => {
        p.rooms.forEach((quartoId) => {
          const guests = isOrcSemCadastro
            ? (p.roomHospedesOrc?.[quartoId] || [])
            : (p.roomHospedes?.[quartoId]    || []);
          indexed.push({
            key:  `${quartoId}_${pi}`,
            item: {
              fk_quarto:    parseInt(quartoId),
              data_entrada: toBrDate(p.checkin),
              data_saida:   toBrDate(p.checkout),
              ...buildGuestCalcParams(guests),
            },
          });
        });
      });

      if (indexed.length === 0) return;
      // Orçamentos usam endpoint exclusivo /calcular-preco
      const calcFn = isOrcamento ? orcamentoApi.calcularPreco : reservaApi.calcularPreco;
      const resArray = await calcFn(indexed.map((x) => x.item));
      const results = {};
      (Array.isArray(resArray) ? resArray : []).forEach((r, i) => {
        if (indexed[i]) results[indexed[i].key] = r;
      });
      setPrecosCalc(results);
    } finally {
      setCalcLoading(false);
    }
  };

  const handleGoToStep3 = async () => { setStep(3); await runCalcPrecos(); };

  const handleSave = async () => {
    setSaving(true);
    try {
      const cleanPags = (pags) => pags.map(({ _localId, _criadoEm, ...pg }) => pg);

      if (isSolicitacao) {
        // ── POST /reserva/solicitar — sem PDF ─────────────────────────────────
        const isoToBrLocal = (s) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s.split('-').reverse().join('/') : s);

        const buildSolBody = (quartoId, ci, co, hospedesOrc, obs, periodoIdx) => {
          const valorTotal = precosCalc[`${quartoId}_${periodoIdx}`]?.valor_total;
          return {
            quarto_id:          parseInt(quartoId),
            status:             'RESERVA_SOLICITADA',
            data_hora_checkin:  `${toBrDate(ci)} 10:00`,
            data_hora_checkout: `${toBrDate(co)} 12:00`,
            pessoas_orcamento:  hospedesOrc.map((h) => ({
              nome: h.nome,
              ...(h.dataNascimento ? { data_nascimento: isoToBrLocal(h.dataNascimento) } : {}),
            })),
            ...(obs?.trim() ? { observacao: obs.trim() } : {}),
            ...(valorTotal !== undefined ? { valor_total: valorTotal } : {}),
          };
        };

        if (periodoMode === 'multiplos') {
          for (const [pi, p] of periodos.entries()) {
            const ci = formatDate(p.checkin);
            const co = formatDate(p.checkout);
            for (const q of p.rooms) {
              await reservaApi.solicitar(buildSolBody(q, ci, co, p.roomHospedesOrc?.[q] || [], quartosObs[q], pi));
            }
          }
        } else {
          for (const q of quartos) {
            await reservaApi.solicitar(buildSolBody(q, checkinStr, checkoutStr, quartoHospedesOrc[q] || [], quartosObs[q], 0));
          }
        }
        await onSave?.({ _isSolicitacao: true });
        return;
      }

      if (isOrcamento) {
        // ── Novo endpoint POST /orcamento ─────────────────────────────────────
        const isoToBrLocal = (s) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? s.split('-').reverse().join('/') : s);

        const buildHospedagem = (quartoId, dataEntrada, dataSaida, periodoIdx, registeredGuests = [], orcGuests = []) => {
          const valorTotal = precosCalc[`${quartoId}_${periodoIdx}`]?.valor_total ?? undefined;
          const obs = quartosObs[quartoId]?.trim();
          // Pessoas para orçamento: sem cadastro usa orcGuests, com cadastro usa nomes dos hospedes registrados
          const pessoasOrc = isOrcSemCadastro
            ? orcGuests.map((h) => ({
                nome: h.nome,
                ...(h.dataNascimento ? { data_nascimento: isoToBrLocal(h.dataNascimento) } : {}),
              }))
            : registeredGuests.map((h) => ({
                nome: h.nome,
                ...(h.dataNascimento ? { data_nascimento: isoToBrLocal(h.dataNascimento) } : {}),
              }));
          return {
            quarto_id:         parseInt(quartoId),
            status:            'ORCAMENTO',
            data_hora_checkin:  `${toBrDate(dataEntrada)} 10:00`,
            data_hora_checkout: `${toBrDate(dataSaida)} 12:00`,
            pessoas_orcamento:  pessoasOrc,
            ...(valorTotal !== undefined ? { valor_total: valorTotal } : {}),
            ...(obs ? { observacao: obs } : {}),
          };
        };

        const displayPeriodos = periodoMode === 'unico'
          ? [{ rooms: quartos, checkin: checkinStr, checkout: checkoutStr, roomHospedes: quartoHospedes, roomHospedesOrc: quartoHospedesOrc }]
          : periodos.map((p) => ({ ...p, checkin: formatDate(p.checkin), checkout: formatDate(p.checkout) }));

        let hospedagensBody;
        if (periodoMode === 'multiplos') {
          hospedagensBody = periodos.flatMap((p, pi) =>
            p.rooms.map((q) => buildHospedagem(q, formatDate(p.checkin), formatDate(p.checkout), pi, p.roomHospedes?.[q] || [], p.roomHospedesOrc?.[q] || []))
          );
        } else {
          hospedagensBody = quartos.map((q) => buildHospedagem(q, checkinStr, checkoutStr, 0, quartoHospedes[q] || [], quartoHospedesOrc[q] || []));
        }

        // Chama orcamentoApi.criar diretamente
        const result = await orcamentoApi.criar({
          nome_solicitante: nomeSolicitante.trim(),
          hospedagens:      hospedagensBody,
        });

        // Gera PDF do orçamento
        const _user = userStorage.get();
        const _userName = _user?.pessoa?.nome ?? _user?.nome ?? '';
        gerarVoucherReserva({
          tipo, periodoMode, displayPeriodos, precosCalc, quartosObs, roomDescMap,
          userName: _userName,
          solicitante: { nome: nomeSolicitante.trim() },
          isOrcamento: true,
        });

        // Notifica o componente pai para atualizar o estado com o resultado
        await onSave({ _isOrcamento: true, orcamento: result });
        return;
      }

      // ── PUT /reserva/ativar — nova reserva ativa ─────────────────────────────
      // includePagamentos=false when pagModo==='unico' and this is not the first body;
      // the backend links the first body's payment to all others via pagamentoUnico.
      const buildReservaBody = (quartoId, dataEntrada, dataSaida, hospedes, periodoIdx, includePagamentos = true) => {
        const roomPags = includePagamentos
          ? (pagModo === 'unico' ? cleanPags(pagUnico) : cleanPags(quartosPag[quartoId] || []))
          : [];
        const valorTotal = precosCalc[`${quartoId}_${periodoIdx}`]?.valor_total ?? undefined;
        const pessoasIds = (hospedes || [])
          .filter((h) => h.id && !String(h.id).startsWith('tmp-'))
          .map((h) => parseInt(h.id));
        return {
          quarto_id:          parseInt(quartoId),
          status:             'RESERVA_ATIVA',
          data_hora_checkin:  `${toBrDate(dataEntrada)} 14:00`,
          data_hora_checkout: `${toBrDate(dataSaida)} 12:00`,
          ...(valorTotal !== undefined ? { valor_total: valorTotal } : {}),
          ...(pessoasIds.length ? { pessoas: pessoasIds } : {}),
          ...(roomPags.length   ? { pagamentos: roomPags } : {}),
          ...(quartosObs[quartoId]?.trim() ? { observacao: quartosObs[quartoId].trim() } : {}),
        };
      };

      const allBodies = [];
      if (periodoMode === 'multiplos') {
        for (const [pi, p] of periodos.entries()) {
          const ci = formatDate(p.checkin);
          const co = formatDate(p.checkout);
          for (const q of p.rooms) {
            // pagamentoUnico: only the very first body globally carries pagamentos
            allBodies.push(buildReservaBody(q, ci, co, p.roomHospedes?.[q] || [], pi, pagModo !== 'unico' || allBodies.length === 0));
          }
        }
      } else {
        for (const [qi, q] of quartos.entries()) {
          allBodies.push(buildReservaBody(q, checkinStr, checkoutStr, quartoHospedes[q] || [], 0, pagModo !== 'unico' || qi === 0));
        }
      }
      const res = await reservaApi.criarAtiva(allBodies, pagModo === 'unico' ? true : null);
      const allResults = Array.isArray(res) ? res : (res ? [res] : []);
      await onSave({ _isReserva: true, results: allResults.filter(Boolean) });
    } catch (e) {
      onNotify?.(e?.message || 'Erro ao salvar reserva.', 'error');
    } finally { setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} size="lg"
      title={<><Plus size={15} /> {isSolicitacao ? 'Nova Solicitação' : forceOrcamento ? 'Novo Orçamento' : 'Nova Reserva'}</>}
      footer={
        <div className={styles.footerSpread}>
          <div>{step > 1 && <Button variant="secondary" onClick={() => { setStep((s) => s - 1); if (step === 3) { setPrecosCalc({}); setShowPriceDetails(false); setRoomPriceOpen({}); } }}>Voltar</Button>}</div>
          <div className={styles.footerRight}>
            {step < STEPS.length ? (
              <Button variant="primary"
                disabled={
                  (step === 1 && !isSolicitacao && forceOrcamento && !nomeSolicitante.trim()) ||
                  (step === 2 && !canNext2)
                }
                onClick={step === 2 ? handleGoToStep3 : () => setStep((s) => s + 1)}>
                Próximo
              </Button>
            ) : (
              <Button variant="primary" disabled={saving || calcLoading || (!isSolicitacao && !canNext2)} onClick={handleSave}>
                {saving && <Loader2 size={13} className={styles.spin} />}
                {isSolicitacao ? 'Criar Solicitação' : forceOrcamento ? 'Gerar Orçamento' : 'Criar Reserva'}
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


      {/* Period bands — shown on step 3 (or step 2 for solicitação) in place of summaryBar */}
      {step === 3 && periodoMode === 'unico' && checkinStr && checkoutStr && (
        <div className={styles.step3PeriodoBandTop}>
          <span className={styles.step3PeriodoBandDates}>{fmtDateBR(checkinStr)} → {fmtDateBR(checkoutStr)} · {diariasTxt(dias)}</span>
        </div>
      )}

      {/* ── Step content (scrollable) ── */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>

      {/* ── Step 1: Tipo ─────────────────────────────────────────────────────── */}
      {step === 1 && (
        <div className={styles.formStack}>
          <FormField label="Tipo de Reserva">
            <div className={styles.tipoRow}>
              {[['simples', 'Apartamento Único'], ['grupo', 'Vários Apartamentos']].map(([v, l]) => (
                <button key={v} type="button"
                  className={[styles.tipoBtn, tipo === v ? styles.tipoBtnActive : ''].join(' ')}
                  onClick={() => { setTipo(v); if (v !== 'grupo' && !isSolicitacao) setQuartos((q) => q.slice(0, 1)); }}
                >{l}</button>
              ))}
            </div>
          </FormField>
          {forceOrcamento && (
            <FormField label="Nome do Solicitante">
              <input
                className={styles.formInput}
                type="text"
                placeholder="Ex: JOÃO SILVA"
                value={nomeSolicitante}
                onChange={(e) => setNomeSolicitante(e.target.value.toUpperCase())}
                style={{ textTransform: 'uppercase' }}
                autoFocus
              />
            </FormField>
          )}
        </div>
      )}

      {/* ── Step 2: Período & Hóspedes (solicitação) ─────────────────────── */}
      {step === 2 && isSolicitacao && (
        <div className={styles.formStack}>
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

          {/* ── Período único ── */}
          {periodoMode === 'unico' && (
            <>
              <div className={styles.step2Grid}>
                <FormField label={<>Check-in{checkinStr && <span style={{ fontWeight: 400, color: 'var(--text-2)', marginLeft: 6 }}>{fmtDateBR(checkinStr)}</span>}</>}>
                  <div className={styles.dateCompact}>
                    <DatePicker mode="single" value={checkin}
                      onChange={(d) => {
                        setCheckin(d);
                        setQuartos([]); setQuartoHospedes({}); setQuartoHospedesOrc({});
                        if (checkout && d && checkout <= d) setCheckout(null);
                      }}
                      placeholder="Data de check-in" minDate={new Date()} />
                  </div>
                </FormField>
                <FormField label={<>Check-out{checkoutStr && <span style={{ fontWeight: 400, color: 'var(--text-2)', marginLeft: 6 }}>{fmtDateBR(checkoutStr)}</span>}{checkinStr && checkoutStr && dias > 0 && <span style={{ fontWeight: 400, color: 'var(--text-2)', marginLeft: 6 }}>· {diariasTxt(dias)}</span>}</>}>
                  <div className={styles.dateCompact}>
                    <DatePicker mode="single" value={checkout}
                      onChange={(d) => { setCheckout(d); setQuartos([]); setQuartoHospedes({}); setQuartoHospedesOrc({}); }}
                      placeholder="Data de check-out"
                      minDate={checkin ? new Date(checkin.getTime() + 86400000) : new Date(Date.now() + 86400000)}
                      markedDate={checkin} />
                  </div>
                </FormField>
              </div>
              <FormField label={tipo === 'grupo' ? 'Apartamentos (múltipla seleção)' : 'Apartamento'}>
                <RoomCombobox value={quartos}
                  onChange={(v) => { setQuartos(v); setQuartoHospedes((prev) => { const n = {}; v.forEach((q) => { n[q] = prev[q] || []; }); return n; }); }}
                  availableRooms={availableRooms}
                  categorias={categorias} roomDescMap={roomDescMap}
                  singleSelect={tipo !== 'grupo'}
                  disabled={!checkinStr || !checkoutStr}
                  loading={availLoading} />
              </FormField>
              {quartos.map((q) => (
                <div key={q} style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                  <div className={styles.kvSectionDivider} style={{ margin: 0 }}>
                    Hóspedes{quartos.length > 1 ? ` — Apartamento ${fmtRoom(parseInt(q))}` : ''}
                    <span style={{ fontWeight: 400, color: 'var(--text-2)', fontSize: 11, marginLeft: 8 }}>· 1º hóspede = solicitante</span>
                  </div>
                  <SemCadastroHospedesPicker
                    value={quartoHospedesOrc[q] || []}
                    onChange={(v) => setQuartoHospedesOrc((prev) => ({ ...prev, [q]: v }))}
                    onDraftChange={setSemCadastroDraft} />
                </div>
              ))}
            </>
          )}

          {/* ── Múltiplos períodos ── */}
          {periodoMode === 'multiplos' && (
            <>
              {periodos.length > 0 && (
                <div className={styles.periodosList}>
                  {periodos.map((p, i) => {
                    const ci = formatDate(p.checkin); const co = formatDate(p.checkout);
                    const isEditing = editingPeriodoIdx === i;
                    return (
                      <div key={i} className={[styles.periodoItem, isEditing ? styles.periodoItemEditing : ''].join(' ')}>
                        <div className={styles.periodoItemInfo}>
                          <span className={styles.periodoItemDates}>{fmtDateBR(ci)} → {fmtDateBR(co)} · {diariasTxt(diffDays(ci, co))}</span>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 6 }}>
                            {p.rooms.map((q) => {
                              const hosp = p.roomHospedesOrc?.[q] || [];
                              return (
                                <div key={q} style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                  <span className={styles.periodoItemRoomNum}>#{fmtRoom(parseInt(q))}</span>
                                  {hosp.length > 0
                                    ? hosp.map((h, hi) => (
                                        <span key={hi} style={{ fontSize: 12, color: 'var(--text)', fontWeight: 400 }}>
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
                        <div style={{ display: 'flex', gap: 4 }}>
                          {!isEditing && (
                            <button type="button" className={styles.periodoEditBtn} onClick={() => startEditPeriodo(i)}><Pencil size={11} /></button>
                          )}
                          <button type="button" className={styles.chipRemove} onClick={() => { if (isEditing) resetMpForm(); setPeriodos((ps) => ps.filter((_, j) => j !== i)); }}><X size={12} /></button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className={styles.mpForm}>
                <div className={styles.step2Grid}>
                  <FormField label="Check-in">
                    <div className={styles.dateCompact}>
                      <DatePicker mode="single" value={mpCheckin}
                        onChange={(d) => {
                          setMpCheckin(d);
                          setMpRooms([]); setMpRoomHospedes({}); setMpRoomHospedesOrc({});
                          if (mpCheckout && d && mpCheckout <= d) setMpCheckout(null);
                        }}
                        placeholder="Data de check-in" minDate={new Date()} />
                    </div>
                  </FormField>
                  <FormField label="Check-out">
                    <div className={styles.dateCompact}>
                      <DatePicker mode="single" value={mpCheckout}
                        onChange={(d) => { setMpCheckout(d); setMpRooms([]); setMpRoomHospedes({}); setMpRoomHospedesOrc({}); }}
                        placeholder="Data de check-out"
                        minDate={mpCheckin ? new Date(mpCheckin.getTime() + 86400000) : new Date(Date.now() + 86400000)}
                        markedDate={mpCheckin} />
                    </div>
                  </FormField>
                </div>
                <FormField label="Apartamentos para este período">
                  <RoomCombobox value={mpRooms}
                    onChange={(v) => { setMpRooms(v); setMpRoomHospedes((prev) => { const n = {}; v.forEach((q) => { n[q] = prev[q] || []; }); return n; }); }}
                    availableRooms={mpAvailableRooms} categorias={categorias} roomDescMap={roomDescMap}
                    disabled={!mpCheckin || !mpCheckout}
                    loading={mpAvailLoading} />
                </FormField>
                {mpRooms.map((q) => (
                  <div key={q} style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                    <div className={styles.kvSectionDivider} style={{ margin: 0 }}>
                      Hóspedes{mpRooms.length > 1 ? ` — Apartamento ${fmtRoom(parseInt(q))}` : ''}
                      <span style={{ fontWeight: 400, color: 'var(--text-2)', fontSize: 11, marginLeft: 8 }}>· 1º hóspede = solicitante</span>
                    </div>
                    <SemCadastroHospedesPicker
                      value={mpRoomHospedesOrc[q] || []}
                      onChange={(v) => setMpRoomHospedesOrc((prev) => ({ ...prev, [q]: v }))}
                      onDraftChange={setSemCadastroDraft} />
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <Button variant="primary"
                    disabled={!mpRooms.length || !mpCheckin || !mpCheckout || mpRooms.some((q) => !(mpRoomHospedesOrc[q]?.length > 0))}
                    onClick={addPeriodo}>
                    {editingPeriodoIdx !== null ? <><Check size={13} /> Salvar Alterações</> : <><Plus size={13} /> Adicionar Período</>}
                  </Button>
                  {editingPeriodoIdx !== null && (
                    <Button variant="secondary" onClick={resetMpForm}>Cancelar</Button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Step 2: Quarto & Período ───────────────────────────────────────── */}
      {step === 2 && !isSolicitacao && (
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
                <FormField label={<>Período de estadia{checkinStr && checkoutStr && dias > 0 && <span style={{ fontWeight: 400, color: 'var(--text-2)', marginLeft: 6 }}>· {diariasTxt(dias)}</span>}</>}>
                  <div className={styles.dateCompact}>
                    <DatePicker mode="range" startDate={checkin} endDate={checkout}
                      onRangeChange={({ start, end }) => { setCheckin(start); setCheckout(end); setQuartos([]); setQuartoHospedes({}); setQuartoHospedesOrc({}); }}
                      placeholder="Check-in → Check-out" minDate={new Date()} />
                  </div>
                </FormField>
                <FormField label={tipo === 'grupo' ? 'Apartamentos (múltipla seleção)' : 'Apartamento'}>
                  <RoomCombobox value={quartos}
                    onChange={(v) => { setQuartos(v); setQuartoHospedes((prev) => { const n = {}; v.forEach((q) => { n[q] = prev[q] || []; }); return n; }); }}
                    availableRooms={availableRooms}
                    categorias={categorias} roomDescMap={roomDescMap}
                    singleSelect={tipo !== 'grupo'}
                    disabled={!checkinStr || !checkoutStr}
                    loading={availLoading} />
                </FormField>
              </div>
              {/* Per-room hospedes */}
              {quartos.map((q) => (
                <div key={q} style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                  <div className={styles.kvSectionDivider} style={{ margin: 0 }}>Hóspedes — Apartamento {fmtRoom(parseInt(q))}</div>
                  {isOrcSemCadastro ? (
                    <SemCadastroHospedesPicker
                      value={quartoHospedesOrc[q] || []}
                      onChange={(v) => setQuartoHospedesOrc((prev) => ({ ...prev, [q]: v }))}
                      onDraftChange={setSemCadastroDraft} />
                  ) : (
                    <RoomHospedesPicker
                      value={quartoHospedes[q] || []}
                      onChange={(v) => setQuartoHospedes((prev) => ({ ...prev, [q]: v }))} />
                  )}
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
                    const isEditing = editingPeriodoIdx === i;
                    return (
                      <div key={i} className={[styles.periodoItem, isEditing ? styles.periodoItemEditing : ''].join(' ')}>
                        <div className={styles.periodoItemInfo}>
                          <span className={styles.periodoItemDates}>{fmtDateBR(ci)} → {fmtDateBR(co)} · {diariasTxt(diffDays(ci, co))}</span>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 6 }}>
                            {p.rooms.map((q) => {
                              const hosp = isOrcSemCadastro ? (p.roomHospedesOrc?.[q] || []) : (p.roomHospedes?.[q] || []);
                              return (
                                <div key={q} style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                  <span className={styles.periodoItemRoomNum}>#{fmtRoom(parseInt(q))}</span>
                                  {hosp.length > 0
                                    ? hosp.map((h, hi) => (
                                        <span key={isOrcSemCadastro ? hi : h.id} style={{ fontSize: 12, color: 'var(--text)', fontWeight: 400 }}>
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
                        <div style={{ display: 'flex', gap: 4 }}>
                          {!isEditing && (
                            <button type="button" className={styles.periodoEditBtn} onClick={() => startEditPeriodo(i)}><Pencil size={11} /></button>
                          )}
                          <button type="button" className={styles.chipRemove} onClick={() => { if (isEditing) resetMpForm(); setPeriodos((ps) => ps.filter((_, j) => j !== i)); }}><X size={12} /></button>
                        </div>
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
                  <FormField label="Apartamentos para este período">
                    <RoomCombobox value={mpRooms}
                      onChange={(v) => { setMpRooms(v); setMpRoomHospedes((prev) => { const n = {}; v.forEach((q) => { n[q] = prev[q] || []; }); return n; }); }}
                      availableRooms={mpAvailableRooms} categorias={categorias} roomDescMap={roomDescMap}
                      disabled={!mpCheckin || !mpCheckout}
                      loading={mpAvailLoading} />
                  </FormField>
                </div>
                {/* Per-room hospedes for this period */}
                {mpRooms.map((q) => (
                  <div key={q} style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                    <div className={styles.kvSectionDivider} style={{ margin: 0 }}>Hóspedes — Apartamento {fmtRoom(parseInt(q))}</div>
                    {isOrcSemCadastro ? (
                      <SemCadastroHospedesPicker
                        value={mpRoomHospedesOrc[q] || []}
                        onChange={(v) => setMpRoomHospedesOrc((prev) => ({ ...prev, [q]: v }))}
                        onDraftChange={setSemCadastroDraft} />
                    ) : (
                      <RoomHospedesPicker
                        value={mpRoomHospedes[q] || []}
                        onChange={(v) => setMpRoomHospedes((prev) => ({ ...prev, [q]: v }))} />
                    )}
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 8 }}>
                  <Button variant="primary" disabled={!mpRooms.length || !mpCheckin || !mpCheckout || mpRooms.some((q) => isOrcSemCadastro ? !(mpRoomHospedesOrc[q]?.length > 0) : !(mpRoomHospedes[q]?.length > 0))} onClick={addPeriodo}>
                    {editingPeriodoIdx !== null ? <><Check size={13} /> Salvar Alterações</> : <><Plus size={13} /> Adicionar Período</>}
                  </Button>
                  {editingPeriodoIdx !== null && (
                    <Button variant="secondary" onClick={resetMpForm}>Cancelar</Button>
                  )}
                </div>
              </div>
            </>
          )}

        </div>
      )}

      {/* ── Step 3: Resumo & Pagamentos ───────────────────────────────────── */}
      {step === 3 && (() => {
        // Build the periods list for display
        const displayPeriodos = periodoMode === 'unico'
          ? [{ rooms: quartos, checkin, checkout, roomHospedes: quartoHospedes, roomHospedesOrc: quartoHospedesOrc }]
          : periodos;


        // Financial totals
        const grandTotal   = Object.values(precosCalc).reduce((s, c) => s + (c?.valor_total ?? 0), 0);
        const isMultiRoom  = tipo === 'grupo' || quartos.length > 1;
        const totalPago    = pagModo === 'unico'
          ? pagUnico.reduce((s, p) => s + (p.valor ?? 0), 0)
          : Object.values(quartosPag).flat().reduce((s, p) => s + (p.valor ?? 0), 0);
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
                  {!isSolicitacao && <>
                    <span className={styles.finStripDivider} />
                    <span className={styles.finStripItem}>Pago <b style={{ color: 'var(--emerald)' }}>{fmtBRL(totalPago)}</b>{grandTotal > 0 && <span style={{ fontSize: 10, color: 'var(--text-2)', marginLeft: 3 }}>({Math.round(totalPago / grandTotal * 100)}%)</span>}</span>
                    <span className={styles.finStripDivider} />
                    <span className={styles.finStripItem}>Pendente <b style={{ color: pendente > 0 ? '#f97316' : 'var(--emerald)' }}>{fmtBRL(pendente)}</b>{grandTotal > 0 && <span style={{ fontSize: 10, color: 'var(--text-2)', marginLeft: 3 }}>({Math.round(pendente / grandTotal * 100)}%)</span>}</span>
                  </>}
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
                          <div className={styles.priceCardRoomLabel}>Apartamento {fmtRoom(parseInt(q))}</div>
                          {calc.detalhes?.map((d, di) => (
                            <div key={di} className={styles.priceDetailItem}>
                              <div className={styles.priceCardRow}>
                                <span className={styles.step3PriceDesc}>{d.descricao}</span>
                                <span className={styles.step3PriceVal}>{fmtBRL(d.valor_final)}</span>
                              </div>
                              {(d.acrescimo_sazonalidade > 0 || d.valor_criancas > 0) && (
                                <div className={styles.priceDetailSub}>
                                  <span>{fmtBRL((d.valor_base ?? 0) + (d.acrescimo_sazonalidade ?? 0))}</span>
                                  {d.sazonalidade?.descricao && <span className={styles.step3SazChipInline}>{d.sazonalidade.descricao}</span>}
                                  {d.valor_criancas > 0 && <span>+ Crianças {fmtBRL(d.valor_criancas)}</span>}
                                </div>
                              )}
                            </div>
                          ))}
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
              <div className={styles.kvRow}><span className={styles.kvLabel}>Tipo</span><span className={styles.kvVal}>{tipo === 'grupo' ? 'Vários Apartamentos' : 'Apartamento Único'}{isSolicitacao ? ' · Solicitação' : isOrcamento ? ' · Orçamento' : ''}</span></div>
              <div className={styles.kvRow}><span className={styles.kvLabel}>Modo</span><span className={styles.kvVal}>{periodoMode === 'unico' ? 'Período único' : 'Múltiplos períodos'}</span></div>
            </div>

            {/* ── Payment mode toggle (multi-room only) ── */}
            {isMultiRoom && !isSolicitacao && !isOrcamento && (
              <div className={styles.pagModoToggle}>
                <label className={`${styles.pagModoOption} ${pagModo === 'por_quarto' ? styles.pagModoOptionActive : ''}`}>
                  <input type="radio" name="pagModo" value="por_quarto" checked={pagModo === 'por_quarto'} onChange={() => setPagModo('por_quarto')} />
                  Pagamento por quarto
                </label>
                <label className={`${styles.pagModoOption} ${pagModo === 'unico' ? styles.pagModoOptionActive : ''}`}>
                  <input type="radio" name="pagModo" value="unico" checked={pagModo === 'unico'} onChange={() => setPagModo('unico')} />
                  Pagamento único
                </label>
              </div>
            )}

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
                    const qHosp    = (p.roomHospedes || {})[q] || [];
                    const qHospOrc = (p.roomHospedesOrc || {})[q] || [];
                    const rKey   = `${q}_${pi}`;
                    const rCalc  = precosCalc[rKey];
                    const multiRoom = periodoMode === 'multiplos' || quartos.length > 1;
                    return (
                      <div key={q} className={styles.step3RoomBlock}>
                        <div className={styles.step3RoomLabel}>Hóspedes{multiRoom ? ` — Apartamento ${fmtRoom(parseInt(q))}` : ''}</div>

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
                                        <span>{fmtBRL((d.valor_base ?? 0) + (d.acrescimo_sazonalidade ?? 0))}</span>
                                        {d.sazonalidade?.descricao && <span className={styles.step3SazChipInline}>{d.sazonalidade.descricao}</span>}
                                        {d.valor_criancas > 0 && <span>+ Crianças {fmtBRL(d.valor_criancas)}</span>}
                                      </div>
                                    )}
                                  </div>
                                ))}
                                <div className={styles.step3PriceTotal}>
                                  <span>Total do apartamento {fmtRoom(parseInt(q))}</span>
                                  <span>{fmtBRL(rCalc.valor_total)}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Hóspedes */}
                        <div className={styles.step3RoomSection}>
                          {isOrcSemCadastro ? (
                            qHospOrc.length > 0 ? (
                              <div className={styles.hospedeList}>
                                {qHospOrc.map((h, hi) => (
                                  <div key={hi} className={styles.hospedeRow}>
                                    <div className={styles.hospedeAvatar}>{initials(h.nome)}</div>
                                    <div>
                                      <div className={styles.hospedeName}>
                                        {h.nome}
                                        {isSolicitacao && hi === 0 && <span style={{ fontSize: 10, color: 'var(--text-2)', marginLeft: 6, fontWeight: 400 }}>· Solicitante</span>}
                                      </div>
                                      {h.dataNascimento && <div className={styles.hospedeCpf}>{calcAge(h.dataNascimento) !== null ? `${calcAge(h.dataNascimento)} anos · ` : ''}{fmtDateBR(h.dataNascimento)}</div>}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className={styles.pagEmpty}>Sem hóspedes vinculados</div>
                            )
                          ) : (
                            qHosp.length > 0 ? (
                              <div className={styles.hospedeList}>
                                {qHosp.map((h) => (
                                  <div key={h.id} className={styles.hospedeRow}>
                                    <div className={styles.hospedeAvatar}>{initials(h.nome)}</div>
                                    <div>
                                      <div className={styles.hospedeName}>{h.nome}</div>
                                      <div className={styles.hospedeCpf}>
                                        {calcAge(h.dataNascimento) !== null && <span>{calcAge(h.dataNascimento)} anos{h.cpf ? ' · ' : ''}</span>}
                                        {h.cpf && <span>{fmtCpf(h.cpf)}</span>}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className={styles.pagEmpty}>Sem hóspedes vinculados</div>
                            )
                          )}
                        </div>

                        {/* Pagamento */}
                        {!isOrcamento && !isSolicitacao && pagModo === 'por_quarto' && (
                          <div className={styles.step3PayArea}>
                            <div className={styles.step3PagLabel}>Pagamentos</div>
                            <div className={styles.step3PayHeader}>
                              <button className={styles.step3AddPagBtn}
                                onClick={() => { setShowPagModalRoom(q); setShowPagModal(true); }}>
                                <Plus size={11} /> Adicionar pagamento
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
                            placeholder="Observação para este apartamento (opcional)..."
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

            {/* ── Pagamento único section ── */}
            {!isOrcamento && !isSolicitacao && isMultiRoom && pagModo === 'unico' && (
              <div className={styles.step3PayArea} style={{ marginTop: 8 }}>
                <div className={styles.step3PagLabel}>Pagamento</div>
                <div className={styles.step3PayHeader}>
                  <button className={styles.step3AddPagBtn} onClick={() => setShowPagModal(true)}>
                    <Plus size={11} /> Adicionar pagamento
                  </button>
                </div>
                {pagUnico.length === 0
                  ? <div className={styles.pagEmpty}>Nenhum pagamento adicionado</div>
                  : pagUnico.map((p) => {
                      const tipDesc = tiposPagamento.find((t) => t.id === p.tipo_pagamento?.id)?.descricao ?? p.tipo_pagamento?.descricao ?? '—';
                      return (
                        <div key={p._localId} className={styles.step3PagRow}>
                          <div className={styles.step3PagRowTop}>
                            <span className={styles.step3PagDesc}>{p.descricao || tipDesc}</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto', flexShrink: 0 }}>
                              <span className={styles.step3PagVal}>{fmtBRL(p.valor)}</span>
                              <button type="button" className={styles.removeIconBtn}
                                onClick={() => setPagUnico((prev) => prev.filter((x) => x._localId !== p._localId))}>
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

          </div>
        );
      })()}

      </div>{/* end scrollable step content */}
      </div>{/* end outer flex column */}

      {/* Payment modal */}
      {(() => {
        const grandTotalModal = Object.values(precosCalc).reduce((s, c) => s + (c?.valor_total ?? 0), 0);
        let pagVTotal, pagVPago;
        if (pagModo === 'unico') {
          pagVTotal = grandTotalModal || null;
          pagVPago  = pagUnico.reduce((s, p) => s + (p.valor ?? 0), 0);
        } else {
          const rKey = showPagModalRoom !== null ? `${showPagModalRoom}_0` : null;
          pagVTotal = rKey ? (precosCalc[rKey]?.valor_total ?? null) : null;
          pagVPago  = showPagModalRoom !== null
            ? (quartosPag[showPagModalRoom] || []).reduce((s, p) => s + (p.valor ?? 0), 0)
            : null;
        }
        return (
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
            lastPayerName={(() => {
              const pool = pagModo === 'unico'
                ? pagUnico
                : (quartosPag[showPagModalRoom] || []);
              return pool.at(-1)?.nome_pagador ?? null;
            })()}
            canAplicarDesconto={false}
            valorTotal={pagVTotal}
            valorPago={pagVPago}
          />
        );
      })()}
    </Modal>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function BookingCalendar() {
  const today    = new Date(); today.setHours(0, 0, 0, 0);
  const todayStr = formatDate(today);

  const [reservas,       setReservas]       = useState([]);
  const [categorias,     setCategorias]     = useState([]);
  const [roomDescMap,    setRoomDescMap]    = useState({}); // { [roomId]: descricao }
  const [loading,        setLoading]        = useState(true);
  const [tiposPagamento, setTiposPagamento] = useState([]);
  const [viewDate,    setViewDate]    = useState(() => { const d = new Date(today); d.setDate(d.getDate() - 1); return d; });
  const [collapsedCats,   setCollapsedCats]   = useState({});
  const [selectedReserva, setSelectedReserva] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createInit,      setCreateInit]      = useState({ room: null, start: null, end: null, available: null });
  const [searchTerm,      setSearchTerm]      = useState('');
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [remoteSearchResults, setRemoteSearchResults] = useState([]);
  const [remoteSearchLoading, setRemoteSearchLoading] = useState(false);
  const [showSolicitacoes,   setShowSolicitacoes]   = useState(false);
  const [showOrcamentos,     setShowOrcamentos]     = useState(false);
  const [pagamentoModoAtivo,   setPagamentoModoAtivo]   = useState(false);
  const [reservasSelecionadas, setReservasSelecionadas] = useState(new Set());
  const [showPagMultiploModal, setShowPagMultiploModal] = useState(false);
  const [pagMultiploSaving,    setPagMultiploSaving]    = useState(false);
  const [groupPanel,           setGroupPanel]           = useState(null);
  const [solicitacoes,       setSolicitacoes]       = useState([]);
  const [dayModal,        setDayModal]        = useState(null);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [pickerYear,      setPickerYear]      = useState(() => new Date().getFullYear());
  const [roomModal, setRoomModal] = useState(null);
  const [selRoom,   setSelRoom]   = useState(null);
  const [selStart,  setSelStart]  = useState(null);
  const [selHover,  setSelHover]  = useState(null);
  const [dragState, setDragState] = useState(null);
  const [ghostDrag, setGhostDrag] = useState(null);
  const [notif,       setNotif]       = useState(null);

  const lastHoverRef        = useRef(null);
  const searchRef           = useRef(null);
  const monthPickerRef      = useRef(null);
  const dragJustHappenedRef = useRef(false);
  const groupPanelTimeout   = useRef(null);
  const longPressRef        = useRef(null); // { timeout, startX, startY }
  const [dragEditValues,   setDragEditValues]   = useState(null); // { quarto, checkin, checkout }

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

      const descMap = {};
      roomList.forEach((r) => { if (r.id) descMap[r.id] = r.descricao ?? ''; });
      setRoomDescMap(descMap);

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

  const flattenReservas = (data) => {
    const groups = Array.isArray(data) ? data : [];
    const seenIds = new Set();
    const flat = [];
    for (const group of groups) {
      for (const r of (group.reservas ?? [])) {
        if (!seenIds.has(r.id)) { seenIds.add(r.id); flat.push(r); }
      }
    }
    return flat.map(normalizeReserva).filter((r) => r.dataInicio);
  };

  const mergeFlat = (a, b) => {
    const seen = new Set(a.map((r) => r.id));
    return [...a, ...b.filter((r) => !seen.has(r.id))];
  };

  const flatAndNorm = (arr) => {
    const items = Array.isArray(arr) ? arr : [];
    const seen = new Set();
    const out = [];
    for (const r of items) {
      if (!seen.has(r.id)) { seen.add(r.id); out.push(normalizeReserva(r)); }
    }
    return out.filter((r) => r.dataInicio);
  };

  const loadReservas = async () => {
    const mes = viewDate.getMonth() + 1;
    const ano = viewDate.getFullYear();
    const nextMonthDate = new Date(ano, mes, 1);
    const nextMes = nextMonthDate.getMonth() + 1;
    const nextAno = nextMonthDate.getFullYear();

    setLoading(true);
    try {
      const [curr, next] = await Promise.all([
        hospedagemApi.buscar({ status: 'RESERVA_ATIVA', mes, ano }),
        hospedagemApi.buscar({ status: 'RESERVA_ATIVA', mes: nextMes, ano: nextAno }),
      ]);
      setReservas(mergeFlat(flatAndNorm(curr), flatAndNorm(next)));
    } catch (_) {
      // ignore load failures here
    } finally {
      setLoading(false);
    }

    try {
      const data = await hospedagemApi.buscar({ status: 'RESERVA_SOLICITADA' });
      const flat = Array.isArray(data) ? data : [];
      const seen = new Set();
      const deduped = [];
      for (const r of flat) {
        if (!seen.has(r.id)) { seen.add(r.id); deduped.push(normalizeReserva(r)); }
      }
      setSolicitacoes(deduped.filter((r) => r.dataInicio));
    } catch (_) {
      // ignore solicitacoes load failures here
    }
  };

  // ── Reload reservations when month/year changes ───────────────────────────
  useEffect(() => {
    const mes = viewDate.getMonth() + 1;
    const ano = viewDate.getFullYear();

    // The 31-day window almost always spans into the next month, so fetch both
    const nextMonthDate = new Date(ano, mes, 1);
    const nextMes = nextMonthDate.getMonth() + 1;
    const nextAno = nextMonthDate.getFullYear();

    // Main calendar: RESERVA_ATIVA por mês/ano
    loadReservas();
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

  // Remote search — single request without mes/ano to cover all months
  useEffect(() => {
    const term = searchTerm.trim();
    if (term.length < 2) { setRemoteSearchResults([]); setRemoteSearchLoading(false); return; }
    setRemoteSearchLoading(true);
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const data = await hospedagemApi.buscar({ status: 'RESERVA_ATIVA', nomeTitular: term });
        if (cancelled) return;
        const flat = Array.isArray(data) ? data : [];
        const seen = new Set();
        const results = [];
        for (const r of flat) {
          if (!seen.has(r.id)) { seen.add(r.id); results.push(normalizeReserva(r)); }
        }
        setRemoteSearchResults(results.filter((r) => r.dataInicio));
      } catch { /* ignore */ } finally {
        if (!cancelled) setRemoteSearchLoading(false);
      }
    }, 600);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [searchTerm]);

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

  // Calendar always shows all reservations regardless of search
  const [showStatusFilter,   setShowStatusFilter]   = useState(false);
  const [statusModalFilter,  setStatusModalFilter]  = useState(null); // { key, label }
  const statusFilterRef = useRef(null);
  const [floatExpanded,      setFloatExpanded]      = useState(false);

  useEffect(() => {
    const h = (e) => { if (statusFilterRef.current && !statusFilterRef.current.contains(e.target)) setShowStatusFilter(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const allReservas = [...reservas, ...solicitacoes];
  const filteredReservas = allReservas;

  const searchResults = searchNorm.length >= 2
    ? allReservas.filter((r) =>
        normalizeStr(r.titularNome).includes(searchNorm) ||
        (r.empresaNome && normalizeStr(r.empresaNome).includes(searchNorm)) ||
        (r.pessoasOrcamento ?? []).some((p) => normalizeStr(p.nome).includes(searchNorm))
      ).slice(0, 8)
    : [];

  // Remote results grouped by month for the dropdown separator
  const remoteSearchByMonth = (() => {
    if (!remoteSearchResults.length) return [];
    const groups = {};
    for (const r of remoteSearchResults) {
      const d = new Date(r.dataInicio + 'T00:00:00');
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
      if (!groups[key]) groups[key] = { key, label, items: [] };
      groups[key].items.push(r);
    }
    return Object.values(groups).sort((a, b) => a.key.localeCompare(b.key));
  })();

  const navigateToReserva = (r) => { setSearchTerm(''); setShowSearchDropdown(false); setRemoteSearchResults([]); setSelectedReserva(r); };

  const solicitadasCount = solicitacoes.length;
  const allRooms         = categorias.flatMap((c) => c.quartos);

  const { pagMultiploValorTotal, pagMultiploValorPago, pagMultiploLastPayer } = useMemo(() => {
    if (reservasSelecionadas.size === 0) return { pagMultiploValorTotal: 0, pagMultiploValorPago: 0, pagMultiploLastPayer: null };
    const selecionadas = allReservas.filter((r) => reservasSelecionadas.has(r.id));
    // Deduplicate payments by UUID — the same payment can be linked to multiple reservations
    const seen = new Map(); // id → { valor, nomePagador, dataRegistro }
    for (const r of selecionadas) {
      for (const p of (r.pagamentos ?? [])) {
        if (!p.cancelado && !seen.has(p.id)) seen.set(p.id, p);
      }
    }
    const uniquePags = Array.from(seen.values());
    uniquePags.sort((a, b) => (b.dataRegistro ?? '').localeCompare(a.dataRegistro ?? ''));
    return {
      pagMultiploValorTotal: selecionadas.reduce((s, r) => s + (r.valorTotal ?? 0), 0),
      pagMultiploValorPago:  uniquePags.reduce((s, p) => s + (p.valor ?? 0), 0),
      pagMultiploLastPayer:  uniquePags[0]?.nomePagador ?? null,
    };
  }, [reservasSelecionadas, allReservas]);

  const handleApproveSolicitacao = async (id, quarto) => {
    const upd = await reservaApi.atualizar({ id, fk_quarto: quarto });
    const normalized = normalizeReserva(upd);
    setSolicitacoes((rs) => rs.filter((r) => r.id !== id));
    setReservas((rs) => [...rs.filter((r) => r.id !== id), normalized]);
    notify('Solicitação aprovada!'); setShowSolicitacoes(false);
  };
  const handleRejectSolicitacao = async (id) => {
    await reservaApi.cancelar(id);
    setSolicitacoes((rs) => rs.filter((r) => r.id !== id));
    notify('Solicitação rejeitada.'); setShowSolicitacoes(false);
  };

  const handleCellClick = (room, dateStr) => {
    if (pagamentoModoAtivo) return;
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
      dragJustHappenedRef.current = true;
      setTimeout(() => { dragJustHappenedRef.current = false; }, 300);
      // Open edit modal with the ghost values pre-filled
      setDragEditValues({ quarto: gd.quarto, checkin: gd.dataInicio, checkout: gd.dataFim });
      setSelectedReserva(r);
    }
    setDragState(null); setGhostDrag(null); lastHoverRef.current = null;
  }, []);

  useEffect(() => { window.addEventListener('mouseup', handleGlobalMouseUp); return () => window.removeEventListener('mouseup', handleGlobalMouseUp); }, [handleGlobalMouseUp]);
  useEffect(() => {
    const h = (e) => {
      if (e.key === 'Escape') {
        setDragState(null); setGhostDrag(null); lastHoverRef.current = null;
        setSelRoom(null); setSelStart(null); setSelHover(null);
        setPagamentoModoAtivo(false); setReservasSelecionadas(new Set()); setShowPagMultiploModal(false);
      }
    };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, []);

  const handleSaveNew = async (bodyOrFlag) => {
    // ── Orçamento criado via orcamentoApi.criar ───────────────────────────────
    if (bodyOrFlag?._isOrcamento) {
      notify('Orçamento criado!');
      setShowCreateModal(false);
      return;
    }

    // ── Solicitação criada via reservaApi.solicitar ───────────────────────────
    if (bodyOrFlag?._isSolicitacao) {
      notify('Solicitação criada!');
      setShowCreateModal(false);
      return;
    }

    // ── Reserva ativa criada via reservaApi.criarAtiva ────────────────────────
    if (bodyOrFlag?._isReserva) {
      const novas = (bodyOrFlag.results ?? [])
        .filter(Boolean)
        .map(normalizeReserva)
        .filter((r) => r.dataInicio);
      if (novas.length > 0) {
        setReservas((rs) => [...rs, ...novas]);
      } else {
        await loadReservas();
      }
      notify(novas.length > 1 ? `${novas.length} reservas criadas!` : 'Reserva criada!');
      setShowCreateModal(false);
      return;
    }
  };
  // orcamentoId: ID do orçamento (não da hospedagem) — passado quando status === 'orcamento'
  const handleCancelReserva = async (id, motivo, orcamentoId = null) => {
    if (orcamentoId) {
      // PUT /orcamento/{orcamentoId}/cancelar — cancela todas as hospedagens do orçamento
      await orcamentoApi.cancelar(orcamentoId, motivo);
    } else {
      await reservaApi.cancelar(id, motivo);
    }
    setReservas((rs) => rs.filter((r) => r.id !== id));
    setSolicitacoes((rs) => rs.filter((r) => r.id !== id));
    notify(orcamentoId ? 'Orçamento cancelado.' : 'Reserva cancelada.');
  };

  const handleMoverPernoite = async (id) => {
    try {
      await recepcaoApi.criarPernoite({ reserva_id: id });
      const upd = await reservaApi.buscarPorId(id);
      const normalized = normalizeReserva(upd);
      setReservas((rs) => rs.map((r) => r.id === id ? normalized : r));
      setSelectedReserva(normalized);
      notify('Hospedagem iniciada!');
    } catch (e) {
      notify(e?.message ?? 'Erro ao hospedar.', 'error');
    }
  };

  const handleActivateReserva = async (id) => {
    try {
      await reservaApi.atualizarStatus([id], 'RESERVA_ATIVA');
      const upd = await reservaApi.buscarPorId(id);
      const normalized = normalizeReserva(upd);
      setReservas((rs) => [...rs.filter((r) => r.id !== id), normalized]);
      setSelectedReserva(normalized);
      notify('Reserva ativada!');
    } catch (e) {
      notify(e?.message ?? 'Erro ao ativar reserva.', 'error');
    }
  };

  const handleUpdateReserva = async (id, body) => {
    try {
      const upd = await reservaApi.editar(id, body);
      const normalized = normalizeReserva(upd ?? { ...body, id });
      setReservas((rs) => rs.map((r) => r.id === id ? normalized : r));
      setSelectedReserva((prev) => prev?.id === id ? normalized : prev);
      setDragEditValues(null);
      notify('Reserva atualizada!');
    } catch (e) {
      notify(e?.message ?? 'Erro ao atualizar reserva.', 'error');
      throw e;
    }
  };

  const handleSyncReserva = (normalized) => {
    setReservas((rs) => rs.map((r) => r.id === normalized.id ? normalized : r));
    setSelectedReserva((prev) => prev?.id === normalized.id ? normalized : prev);
  };

  const exitSelectionMode = useCallback(() => {
    setPagamentoModoAtivo(false);
    setReservasSelecionadas(new Set());
    setShowPagMultiploModal(false);
  }, []);

  const handleBarGroupEnter = useCallback((grupoId, e) => {
    clearTimeout(groupPanelTimeout.current);
    setGroupPanel({ grupoId, rect: e.currentTarget.getBoundingClientRect() });
  }, []);

  const handleBarGroupLeave = useCallback(() => {
    groupPanelTimeout.current = setTimeout(() => setGroupPanel(null), 200);
  }, []);

  const handlePagamentoMultiplo = async (payment) => {
    setPagMultiploSaving(true);
    try {
      const ids = Array.from(reservasSelecionadas);
      await hospedagemApi.adicionarPagamentoMultiplo(ids, payment);
      // Re-fetch each affected reservation so pagamentos + totalPago refresh in state
      const fetched = await Promise.all(ids.map((id) => reservaApi.buscarPorId(id)));
      const updatedMap = new Map(fetched.map((r) => [r.id, normalizeReserva(r)]));
      setReservas((rs) => rs.map((r) => updatedMap.has(r.id) ? updatedMap.get(r.id) : r));
      notify(`Pagamento adicionado a ${ids.length} reserva${ids.length !== 1 ? 's' : ''}!`);
      exitSelectionMode();
    } catch (e) {
      notify(e?.message ?? 'Erro ao adicionar pagamento.', 'error');
    } finally {
      setPagMultiploSaving(false);
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

    const isCancelado   = orig.status === 'cancelado';
    const isSelSelected = pagamentoModoAtivo && reservasSelecionadas.has(orig.id);
    const isSelDimmed   = pagamentoModoAtivo && !isSelSelected;
    const barOpacity    = isSelDimmed ? Math.min(opacity, 0.4) : isCancelado ? Math.min(opacity, 0.55) : opacity;
    const gColor        = !isGhost && orig.grupo_id != null ? grupoColor(orig.grupo_id) : null;

    return (
      <div key={key}
        className={[styles.bar, styles[`bar_${orig.status}`], isGhost ? styles.barGhost : '', isDragging ? styles.barDragging : ''].join(' ')}
        style={{
          left, width, borderRadius,
          opacity: barOpacity,
          cursor: pagamentoModoAtivo ? 'pointer' : undefined,
          ...(gColor ? { background: gColor } : {}),
          ...(isSelSelected ? { outline: '2px solid #fff', outlineOffset: '1px', filter: 'brightness(1.15)' } : {}),
        }}
        onMouseDown={isGhost || pagamentoModoAtivo ? undefined : (e) => handleBarMouseDown(e, orig)}
        onMouseEnter={gColor ? (e) => handleBarGroupEnter(orig.grupo_id, e) : undefined}
        onMouseLeave={gColor ? handleBarGroupLeave : undefined}
        onContextMenu={gColor ? (e) => e.preventDefault() : undefined}
        onTouchStart={gColor ? (e) => {
          const t = e.touches[0];
          const rect = e.currentTarget.getBoundingClientRect();
          longPressRef.current = {
            timeout: setTimeout(() => {
              setGroupPanel({ grupoId: orig.grupo_id, rect });
              longPressRef.current = null;
            }, 500),
            startX: t.clientX,
            startY: t.clientY,
          };
        } : undefined}
        onTouchMove={gColor ? (e) => {
          if (!longPressRef.current) return;
          const t = e.touches[0];
          if (Math.abs(t.clientX - longPressRef.current.startX) > 10 ||
              Math.abs(t.clientY - longPressRef.current.startY) > 10) {
            clearTimeout(longPressRef.current.timeout);
            longPressRef.current = null;
          }
        } : undefined}
        onTouchEnd={gColor ? () => {
          if (longPressRef.current) {
            clearTimeout(longPressRef.current.timeout);
            longPressRef.current = null;
          }
        } : undefined}
        onClick={(e) => {
          e.stopPropagation();
          if (pagamentoModoAtivo) {
            setReservasSelecionadas((prev) => {
              const next = new Set(prev);
              next.has(orig.id) ? next.delete(orig.id) : next.add(orig.id);
              return next;
            });
            return;
          }
          if (!dragState && !dragJustHappenedRef.current) setSelectedReserva(orig);
        }}
        title={pagamentoModoAtivo ? `${isSelSelected ? '✓ ' : ''}${orig.titularNome}` : `${orig.titularNome} — ${diariasTxt(dias)}`}
      >
        {/* Floating status label — always above the bar */}
        {!isGhost && (
          <div
            className={startInView ? styles.barStatusTag : styles.barStatusTagInline}
            style={gColor ? { background: `color-mix(in srgb, ${gColor} 70%, #000)` } : undefined}
          >
            {orig.status === 'confirmada' && <><Check size={9} strokeWidth={3} /> Reserva confirmada</>}
            {orig.status === 'solicitada' && <>Reserva solicitada</>}
            {orig.status === 'hospedado'  && <><Check size={9} strokeWidth={3} /> Hospedado</>}
            {orig.status === 'finalizado' && <>Finalizado</>}
            {orig.status === 'cancelado'  && <>Cancelado</>}
            {orig.status === 'orcamento'  && <>Orçamento</>}
          </div>
        )}

        {startInView && !isGhost && !pagamentoModoAtivo && (
          <div className={styles.resizeHandle} onMouseDown={(e) => handleResizeMouseDown(e, orig, 'resize-l')} />
        )}
        <div className={styles.barContent}>
          <span className={styles.barName}>{orig.titularNome}</span>
          {isGhost ? (
            <div className={styles.barDateLabel}>{display.dataInicio} → {display.dataFim} · {diariasTxt(diffDays(display.dataInicio, display.dataFim))}</div>
          ) : (
            <div className={styles.barMeta}>
              <span className={styles.barMetaItem}><Users size={12} /> {totalPeople} pessoa{totalPeople !== 1 ? 's' : ''}</span>
              <span className={styles.barMetaItem}>
                <CalendarDays size={12} />
                {currentDiaria !== null ? `${currentDiaria}/${dias}` : diariasTxt(dias)}
              </span>
            </div>
          )}
        </div>
        {endInView && !isGhost && !pagamentoModoAtivo && (
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
                <button className={styles.clearSearch} onClick={() => { setSearchTerm(''); setShowSearchDropdown(false); setRemoteSearchResults([]); }}><X size={12} /></button>
              )}
              {showSearchDropdown && (searchResults.length > 0 || remoteSearchResults.length > 0 || remoteSearchLoading) && (
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
                  {remoteSearchLoading && (
                    <div className={styles.searchDropLoading}><Loader2 size={12} className={styles.spin} /> buscando outros meses...</div>
                  )}
                  {!remoteSearchLoading && remoteSearchByMonth.map((group) => (
                    <div key={group.key}>
                      <div className={styles.searchDropSeparator}>{group.label}</div>
                      {group.items.map((r) => {
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
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>

        {/* Selection hint */}
        {selStart && (
          <div className={styles.selHint}>
            <span>Apartamento <strong>{fmtRoom(selRoom)}</strong> · a partir de <strong>{selStart}</strong> — clique outra data para definir fim</span>
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
                        {isToday ? `${day.toLocaleDateString('pt-BR', { weekday: 'long' })} · Hoje` : day.toLocaleDateString('pt-BR', { weekday: 'long' })}
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
          reservas={allReservas} onClose={() => setShowCreateModal(false)} onSave={handleSaveNew} onNotify={notify} categorias={categorias} tiposPagamento={tiposPagamento} roomDescMap={roomDescMap} />
      )}
      {dayModal && (
        <DayModal dateStr={dayModal.dateStr} onClose={() => setDayModal(null)} categorias={categorias}
          onNewReserva={(dateStr, available) => { setCreateInit({ room: null, start: dateStr, end: null, available }); setShowCreateModal(true); }}
          onSelectReserva={(r) => setSelectedReserva(r)} />
      )}
      {roomModal && <RoomModal room={roomModal.room} onClose={() => setRoomModal(null)} categorias={categorias} onSelectReserva={(r) => { setRoomModal(null); setSelectedReserva(r); }} />}
      {statusModalFilter && (
        <StatusFilterModal
          status={statusModalFilter.key}
          label={statusModalFilter.label}
          onClose={() => setStatusModalFilter(null)}
          onSelectReserva={(r) => setSelectedReserva(r)}
        />
      )}
      {showOrcamentos && (
        <OrcamentosModal
          onClose={() => setShowOrcamentos(false)}
          categorias={categorias}
          tiposPagamento={tiposPagamento}
          reservas={allReservas}
          roomDescMap={roomDescMap}
          onSave={handleSaveNew}
        />
      )}
      {showSolicitacoes && (
        <SolicitacoesModal onClose={() => setShowSolicitacoes(false)}
          onSelectReserva={(r) => setSelectedReserva(r)} />
      )}
      {selectedReserva && <ReservaModal reserva={selectedReserva} onClose={() => { setSelectedReserva(null); setDragEditValues(null); }} onCancel={handleCancelReserva} onActivate={handleActivateReserva} onMoverPernoite={handleMoverPernoite} onUpdate={handleUpdateReserva} onSync={handleSyncReserva} onNotify={notify} categorias={categorias} tiposPagamento={tiposPagamento} roomDescMap={roomDescMap} dragValues={dragEditValues} onApprove={handleApproveSolicitacao} onReject={handleRejectSolicitacao} />}

      {/* ── Multi-payment selection panel ── */}
      {pagamentoModoAtivo && (
        <div className={styles.selectionPanel}>
          <span className={styles.selectionCount}>
            <b>{reservasSelecionadas.size}</b>
            <span className={styles.selectionCountSub}>
              {' '}reserva{reservasSelecionadas.size !== 1 ? 's' : ''} selecionada{reservasSelecionadas.size !== 1 ? 's' : ''}
            </span>
          </span>
          <button
            className={styles.selectionBtnPrimary}
            disabled={reservasSelecionadas.size === 0 || pagMultiploSaving}
            onClick={() => setShowPagMultiploModal(true)}
          >
            <DollarSign size={13} />
            Adicionar Pagamento
          </button>
          <button className={styles.selectionBtnCancel} onClick={exitSelectionMode}>
            <X size={13} />
            Cancelar
          </button>
        </div>
      )}

      <PaymentModal
        open={showPagMultiploModal}
        onClose={() => setShowPagMultiploModal(false)}
        onConfirm={handlePagamentoMultiplo}
        tiposPagamento={tiposPagamento}
        isSubmitting={pagMultiploSaving}
        canAplicarDesconto={false}
        canDespesaPessoal={false}
        lastPayerName={pagMultiploLastPayer}
        valorTotal={pagMultiploValorTotal}
        valorPago={pagMultiploValorPago}
      />

      {/* ── Group hover panel ── */}
      {groupPanel && !selectedReserva && !pagamentoModoAtivo && (() => {
        const members = allReservas.filter((r) => r.grupo_id === groupPanel.grupoId);
        if (members.length === 0) return null;
        const color  = grupoColor(groupPanel.grupoId);
        const { rect } = groupPanel;
        const PANEL_W   = 260;
        const estHeight = members.length * 58 + 44;
        let left = rect.left - PANEL_W - 10;
        if (left < 8) left = Math.min(rect.right + 10, window.innerWidth - PANEL_W - 8);
        const top = Math.max(8, Math.min(window.innerHeight - estHeight - 8, rect.top - 8));
        return createPortal(
          <>
            {/* Backdrop — closes on outside tap (touch) or click (desktop) */}
            <div
              style={{ position: 'fixed', inset: 0, zIndex: 499 }}
              onClick={() => setGroupPanel(null)}
              onTouchStart={() => setGroupPanel(null)}
            />
            <div
              onMouseEnter={() => clearTimeout(groupPanelTimeout.current)}
              onMouseLeave={handleBarGroupLeave}
              style={{
                position: 'fixed', top, left, width: PANEL_W, zIndex: 500,
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
                overflow: 'hidden',
              }}
            >
              <div style={{ background: color, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Users size={13} style={{ color: '#fff', flexShrink: 0 }} />
                <span style={{ color: '#fff', fontSize: 12, fontWeight: 600 }}>
                  Grupo · {members.length} reserva{members.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div>
                {members.map((r, i) => (
                  <button key={r.id}
                    onClick={() => { setSelectedReserva(r); setGroupPanel(null); }}
                    style={{
                      display: 'flex', flexDirection: 'column', width: '100%', gap: 3,
                      padding: '8px 12px', border: 'none', background: 'none',
                      textAlign: 'left', cursor: 'pointer',
                      borderLeft: `3px solid ${color}`,
                      borderBottom: i < members.length - 1 ? '1px solid var(--border)' : 'none',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ background: color, color: '#fff', borderRadius: 4, padding: '1px 6px', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                        Ap. {fmtRoom(r.quarto)}
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.titularNome}
                      </span>
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--text-2)' }}>
                      {fmtDateBR(r.dataInicio)} → {fmtDateBR(r.dataFim)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </>,
          document.body
        );
      })()}

      {/* ── Floating action panel ── */}
      {!selectedReserva && !showCreateModal && !showOrcamentos && !showSolicitacoes && !dayModal && !showMonthPicker && !roomModal && !pagamentoModoAtivo && <div className={styles.floatPanel}>
        <button className={[styles.floatBtn, styles.floatBtnPrimary].join(' ')} onClick={() => { setCreateInit({ room: null, start: null, end: null, available: null }); setShowCreateModal(true); }}>
          <Plus size={15} />
          <span>Nova Reserva</span>
        </button>

        {/* Mobile-only toggle */}
        <button
          className={[styles.floatBtn, styles.floatToggleMobile, floatExpanded ? styles.floatBtnActive : ''].join(' ')}
          onClick={() => setFloatExpanded((v) => !v)}
        >
          {floatExpanded ? <X size={14} /> : <SlidersHorizontal size={14} />}
          <span>{floatExpanded ? 'Fechar' : 'Mais opções'}</span>
        </button>

        {/* Secondary buttons — always visible on desktop, toggled on mobile */}
        <div className={[styles.floatSecondary, floatExpanded ? styles.floatSecondaryOpen : ''].join(' ')}>
          <div className={styles.floatDivider} />

          <div className={styles.floatBtnWrap} ref={statusFilterRef}>
            <button
              className={[styles.floatBtn, showStatusFilter ? styles.floatBtnActive : ''].join(' ')}
              onClick={() => setShowStatusFilter((v) => !v)}
            >
              <SlidersHorizontal size={15} />
              <span>Filtrar Status</span>
            </button>
            {showStatusFilter && (
              <div className={styles.floatFilterDrop}>
                {STATUS_FILTER_OPTIONS.map(([key, label]) => (
                  <button key={key} className={styles.floatFilterRow}
                    onClick={() => { setStatusModalFilter({ key, label }); setShowStatusFilter(false); }}>
                    <span className={[styles.statusDot, styles[`status_${key}`]].join(' ')} />
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className={styles.floatDivider} />

          <div className={styles.floatBtnWrap}>
            <button className={styles.floatBtn} onClick={() => setPagamentoModoAtivo(true)}>
              <DollarSign size={15} />
              <span>Adicionar Pagamento</span>
            </button>
          </div>

          <div className={styles.floatBtnWrap}>
            <button className={styles.floatBtn} onClick={() => setShowOrcamentos(true)}>
              <FileText size={15} />
              <span>Orçamentos</span>
            </button>
          </div>

          <div className={styles.floatBtnWrap}>
            <button className={styles.floatBtn} onClick={() => setShowSolicitacoes(true)}>
              <Bell size={15} />
              <span>Solicitações</span>
              {solicitadasCount > 0 && <span className={styles.floatBadge}>{solicitadasCount}</span>}
            </button>
          </div>
        </div>
      </div>}
    </div>
  );
}
