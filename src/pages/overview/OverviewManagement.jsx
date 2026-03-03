import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Building2, Plus, Search, BedDouble, BedSingle, Layers, Waves,
  Clock, User, CreditCard, ChevronDown, Wrench, Sparkles,
  CheckCircle, XCircle, DollarSign, Calendar, Square, Loader2,
  AlertTriangle, ShoppingCart, Package, Trash2, Phone, Mail,
  RefreshCw, ArrowLeftRight, Minus, RotateCcw, Users, X,
  Percent, Tag,
} from 'lucide-react';
import { Modal }                    from '../../components/ui/Modal';
import { Button }                   from '../../components/ui/Button';
import { Input, Select, FormField } from '../../components/ui/Input';
import { DatePicker }               from '../../components/ui/DatePicker';
import { TimeInput }                from '../../components/ui/TimeInput';
import { Notification }             from '../../components/ui/Notification';
import {
  overviewApi,
  ROOM_STATUS, PERNOITE_STATUS, DAYUSE_STATUS,
  OVERVIEW_CATEGORIES, TIPOS_OCUPACAO, FORMAS_PAGAMENTO,
  HOSPEDES_CADASTRADOS, DAY_USE_PRICING, STAY_PRICING,
  calcPrecoDiaria, diffDays, CATEGORIAS_CONSUMO, OVERVIEW_ROOMS_CATS,
} from './overviewMocks';
import styles from './OverviewManagement.module.css';

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmtBRL = (v) =>
  v == null ? 'R$ 0,00' :
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const maskBRL = (v) => {
  const digits = String(v ?? '').replace(/\D/g, '');
  if (!digits) return '';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
    .format(parseInt(digits, 10) / 100);
};
const parseBRL = (v) =>
  parseFloat(String(v ?? '').replace(/[R$\s.]/g, '').replace(',', '.')) || 0;

const todayStr  = () => new Date().toISOString().slice(0, 10);
const nowTime   = () => new Date().toTimeString().slice(0, 5);
const todayDisplay = () => {
  const d = new Date();
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
};
const dateToDisplay = (d) => {
  if (!d) return '';
  const dt = d instanceof Date ? d : new Date(d);
  return `${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}/${dt.getFullYear()}`;
};
const displayToDate = (s) => {
  if (!s) return null;
  const [dd, mm, yyyy] = s.split('/');
  return new Date(+yyyy, +mm - 1, +dd);
};

function calcElapsedSeconds(dataUso, horaEntrada, horaSaida = null) {
  if (!dataUso || !horaEntrada) return 0;
  const [d, m, y] = dataUso.split('/');
  const [h, min]  = horaEntrada.split(':');
  const start     = new Date(+y, +m - 1, +d, +h, +min, 0);
  const end = horaSaida
    ? (() => { const [hh, mm2] = horaSaida.split(':'); const e = new Date(+y, +m - 1, +d, +hh, +mm2, 0); return e < start ? new Date(e.getTime() + 86400000) : e; })()
    : new Date();
  return Math.max(0, Math.floor((end - start) / 1000));
}
const calcElapsedMinutes = (dataUso, ent, sai) => Math.floor(calcElapsedSeconds(dataUso, ent, sai) / 60);

function calcValorDayUse(precoBase, precoAdicional, horasBase, elapsedMin) {
  if (!precoBase) return 0;
  const base = (horasBase || 2) * 60;
  if (elapsedMin <= base) return precoBase;
  return precoBase + Math.ceil((elapsedMin - base) / 60) * (precoAdicional || 0);
}

function fmtElapsed(min) {
  if (min <= 0) return '0min';
  const h = Math.floor(min / 60), m = min % 60;
  return h === 0 ? `${m}min` : `${h}h ${String(m).padStart(2, '0')}min`;
}
function fmtClock(sec) {
  if (sec <= 0) return '00:00';
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
    : `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

// ── Status key → CSS ──────────────────────────────────────────────────────────
function roomStatusKey(status) {
  switch (status) {
    case ROOM_STATUS.DISPONIVEL:      return 'disponivel';
    case ROOM_STATUS.OCUPADO:         return 'ocupado';
    case ROOM_STATUS.RESERVADO:       return 'reservado';
    case ROOM_STATUS.LIMPEZA:         return 'limpeza';
    case ROOM_STATUS.MANUTENCAO:      return 'manutencao';
    case ROOM_STATUS.FORA_DE_SERVICO: return 'fora';
    default: return 'outro';
  }
}

const FILTER_OPTIONS = [
  { id: 'todos',     label: 'Todos'           },
  { id: 'disponivel',label: 'Disponível'      },
  { id: 'ocupado',   label: 'Ocupado'         },
  { id: 'reservado', label: 'Reservado'       },
  { id: 'limpeza',   label: 'Limpeza'         },
  { id: 'servico',   label: 'Manutenção/Fora' },
];

// ── Blank forms ───────────────────────────────────────────────────────────────
const blankNpForm  = () => ({ chegadaDate: new Date(), chegadaHora: '14:00', saidaDate: null, saidaHora: '12:00', tipoAcomodacao: 'Casal', hospedes: [], hospedeSearch: '' });
const blankNduForm = () => ({ horaEntrada: nowTime(), hospedes: [], hospedeSearch: '' });
const blankPagForm = () => ({ descricao: '', formaPagamento: 'PIX', valor: '' });
const blankSvcForm = () => ({ responsavel: '', descricao: '', previsaoFim: '', dataHoraInicio: '', dataHoraFim: '' });

// ── Main component ────────────────────────────────────────────────────────────
export default function OverviewManagement() {
  const [quartos, setQuartos]           = useState([]);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [collapsed, setCollapsed]       = useState({});
  const [tick, setTick]                 = useState(0);
  const [notif, setNotif]               = useState(null);

  // Filters 2
  const [filterTipoOcupacao, setFilterTipoOcupacao] = useState('');
  const [filterDateStart, setFilterDateStart]       = useState(null);
  const [filterDateEnd, setFilterDateEnd]           = useState(null);
  const [dateGroupCollapsed, setDateGroupCollapsed] = useState({});

  // Desconto modal
  const [showDescontoModal, setShowDescontoModal]   = useState(false);
  const [descontoScope, setDescontoScope]           = useState('global'); // 'global' | 'diaria'
  const [descontoTipo, setDescontoTipo]             = useState('percentual'); // 'percentual' | 'fixo'
  const [descontoValor, setDescontoValor]           = useState('');
  const [descontoDescricao, setDescontoDescricao]   = useState('');
  const [descontoSaving, setDescontoSaving]         = useState(false);

  // Add Quarto
  const [showAddQuarto, setShowAddQuarto] = useState(false);

  // Detail modal
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [detailTab, setDetailTab]       = useState('dados');

  // Pernoite detail — diária navigation
  const [detailDiariaIdx, setDetailDiariaIdx] = useState(0);
  const [diariaTab, setDiariaTab]             = useState('detalhes');

  // Novo Pernoite / Day Use
  const [novoModal, setNovoModal]       = useState(null); // 'pernoite' | 'dayuse' | null
  const [novoRoom, setNovoRoom]         = useState(null);
  const [npForm, setNpForm]             = useState(blankNpForm());
  const [nduForm, setNduForm]           = useState(blankNduForm());

  // Nova Hospedagem (full 5-section pernoite create modal)
  const [nhHospedes, setNhHospedes]         = useState([]);
  const [nhHospedeSearch, setNhHospedeSearch] = useState('');
  const [nhCheckinDate, setNhCheckinDate]   = useState(null);
  const [nhCheckinHora, setNhCheckinHora]   = useState('14:00');
  const [nhCheckoutDate, setNhCheckoutDate] = useState(null);
  const [nhCheckoutHora, setNhCheckoutHora] = useState('12:00');
  const [nhPagamentos, setNhPagamentos]     = useState([]);
  const [nhPagDesc, setNhPagDesc]           = useState('');
  const [nhPagForma, setNhPagForma]         = useState('PIX');
  const [nhPagValor, setNhPagValor]         = useState('');
  const [savingNh, setSavingNh]             = useState(false);
  // Nova Hospedagem step (0=hospedes, 1=periodo, 2=pagamentos)
  const [nhStep, setNhStep]                 = useState(0);

  // Detail — Add Hóspede (pernoite/dayuse existing)
  const [showDetailAddHospede, setShowDetailAddHospede]     = useState(false);
  const [detailHospedeSearch, setDetailHospedeSearch]       = useState('');
  const [detailHospedeSelected, setDetailHospedeSelected]   = useState(null);

  // Detail — Add Consumo (pernoite/dayuse existing)
  const [detailConsumoCat, setDetailConsumoCat]             = useState('');
  const [detailConsumoProd, setDetailConsumoProd]           = useState('');
  const [detailConsumoQty, setDetailConsumoQty]             = useState(1);
  const [detailConsumoForma, setDetailConsumoForma]         = useState('');

  // Detail — Add Pagamento (pernoite/dayuse existing)
  const [showDetailAddPag, setShowDetailAddPag]             = useState(false);
  const [detailPagDesc, setDetailPagDesc]                   = useState('');
  const [detailPagForma, setDetailPagForma]                 = useState('');
  const [detailPagValor, setDetailPagValor]                 = useState('');

  // Unified payment modal
  const [payModal, setPayModal]                     = useState(false); // { context } - context info string
  const [payNomePagador, setPayNomePagador]         = useState('');
  const [payAutoFill, setPayAutoFill]               = useState(false);
  const [payDescricao, setPayDescricao]             = useState('');
  const [payValor, setPayValor]                     = useState('');
  const [payTipo, setPayTipo]                       = useState('');
  const [payOnConfirm, setPayOnConfirm]             = useState(null); // callback(pagamento)

  // Add payment (old pagModal - kept for backward compat)
  const [pagModal, setPagModal]         = useState(false);
  const [pagForm, setPagForm]           = useState(blankPagForm());

  // Service actions (limpeza/manutencao/fora)
  const [serviceModal, setServiceModal] = useState(null); // { type, room }
  const [svcForm, setSvcForm]           = useState(blankSvcForm());

  // Minibar add item modal (quarto disponível only)
  const [showAddMinibar, setShowAddMinibar]       = useState(false);
  const [minibarCat, setMinibarCat]               = useState('');
  const [minibarProd, setMinibarProd]             = useState('');
  const [minibarQtyAdd, setMinibarQtyAdd]         = useState(1);
  const [savingMinibar, setSavingMinibar]         = useState(false);

  // Unified add consumo modal (pernoite / dayuse)
  const [showAddConsumoModal, setShowAddConsumoModal] = useState(false);
  const [consumoSaving, setConsumoSaving]             = useState(false);

  // Gerenciar Diárias modal
  const [showGerenciarDiarias, setShowGerenciarDiarias] = useState(false);
  const [gdDataInicio, setGdDataInicio]                 = useState(null);
  const [gdHoraInicio, setGdHoraInicio]                 = useState('14:00');
  const [gdDataFim, setGdDataFim]                       = useState(null);
  const [gdHoraFim, setGdHoraFim]                       = useState('12:00');
  const [gdValor, setGdValor]                           = useState('');
  const [savingGd, setSavingGd]                         = useState(false);

  // Trocar Quarto modal
  const [showTrocarQuarto, setShowTrocarQuarto]   = useState(false);
  const [tqNovoQuartoId, setTqNovoQuartoId]       = useState(null);
  const [tqDiariasIdxs, setTqDiariasIdxs]         = useState([]);
  const [savingTq, setSavingTq]                   = useState(false);

  // Encerrar day use
  const [encerrarModal, setEncerrarModal] = useState(false);

  // Confirm (finalizar / cancelar)
  const [confirmModal, setConfirmModal] = useState(null); // { action: 'finalizar'|'cancelar' }

  // Saving
  const [saving, setSaving] = useState(false);

  // ── Notify ───────────────────────────────────────────────────────────────────
  const notify = (message, type = 'success') => {
    setNotif({ message, type });
    setTimeout(() => setNotif(null), 3500);
  };

  // ── Load ─────────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try { setQuartos(await overviewApi.listar()); }
    catch (e) { notify('Erro ao carregar: ' + e.message, 'error'); }
    finally   { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── 1-second tick for active Day Uses ────────────────────────────────────────
  useEffect(() => {
    const hasActive = quartos.some((q) => q.servico?.tipo === 'dayuse' && q.servico.status === DAYUSE_STATUS.ATIVO);
    if (!hasActive) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [quartos]);

  // ── Nova Hospedagem computed ──────────────────────────────────────────────────
  const nhPessoas = nhHospedes.length || 1;
  const nhPrecoDiaria = useMemo(() =>
    novoRoom ? calcPrecoDiaria(novoRoom.categoria, nhPessoas) : 0,
    [novoRoom, nhPessoas]
  );
  const nhTotalDias = useMemo(() =>
    diffDays(nhCheckinDate, nhCheckoutDate),
    [nhCheckinDate, nhCheckoutDate]
  );
  const nhTotalHosp  = nhPrecoDiaria * nhTotalDias;
  const nhTotalPago  = nhPagamentos.reduce((s, p) => s + p.valor, 0);
  const nhPendente   = Math.max(0, nhTotalHosp - nhTotalPago);

  const nhPersonResults = useMemo(() => {
    const selectedIds = new Set(nhHospedes.map((h) => h.id));
    const term = nhHospedeSearch.toLowerCase();
    return HOSPEDES_CADASTRADOS.filter((h) => !selectedIds.has(h.id) && (!term || h.nome.toLowerCase().includes(term) || h.cpf.includes(term)));
  }, [nhHospedes, nhHospedeSearch]);

  // ── Detail add consumo computed ───────────────────────────────────────────────
  const detailConsumoCatSel  = CATEGORIAS_CONSUMO.find((c) => c.id === parseInt(detailConsumoCat));
  const detailConsumoProdSel = detailConsumoCatSel?.produtos.find((p) => p.id === parseInt(detailConsumoProd));
  const detailHospResults    = useMemo(() =>
    HOSPEDES_CADASTRADOS.filter((h) => !detailHospedeSearch || h.nome.toLowerCase().includes(detailHospedeSearch.toLowerCase())),
    [detailHospedeSearch]
  );

  // ── Derived data ──────────────────────────────────────────────────────────────
  const filteredQuartos = quartos.filter((q) => {
    const sk = roomStatusKey(q.status);
    const matchFilter =
      statusFilter === 'todos'     ||
      (statusFilter === 'disponivel' && sk === 'disponivel') ||
      (statusFilter === 'ocupado'    && (sk === 'ocupado')) ||
      (statusFilter === 'reservado'  && sk === 'reservado') ||
      (statusFilter === 'limpeza'    && sk === 'limpeza') ||
      (statusFilter === 'servico'    && (sk === 'manutencao' || sk === 'fora'));
    const term    = search.toLowerCase();
    const matchSearch = !search || q.numero.includes(search) || (q.servico?.titularNome || '').toLowerCase().includes(term);
    const matchTipo = !filterTipoOcupacao || q.tipoOcupacao === filterTipoOcupacao;
    // Period filter: match pernoite rooms overlapping with selected date range
    let matchPeriod = true;
    if (filterDateStart && q.servico?.tipo === 'pernoite') {
      const chegada = displayToDate(q.servico.chegadaPrevista?.split(' ')[0]);
      const saida   = displayToDate(q.servico.saidaPrevista?.split(' ')[0]);
      if (chegada && saida) {
        const fEnd = filterDateEnd || filterDateStart;
        matchPeriod = chegada <= fEnd && saida >= filterDateStart;
      }
    }
    return matchFilter && matchSearch && matchTipo && matchPeriod;
  });

  const byCategory = OVERVIEW_CATEGORIES.map((cat) => ({
    ...cat,
    rooms:       filteredQuartos.filter((q) => q.categoriaId === cat.id),
    total:       quartos.filter((q) => q.categoriaId === cat.id).length,
    disponiveis: quartos.filter((q) => q.categoriaId === cat.id && q.status === ROOM_STATUS.DISPONIVEL).length,
    ocupados:    quartos.filter((q) => q.categoriaId === cat.id && [ROOM_STATUS.OCUPADO, ROOM_STATUS.RESERVADO].includes(q.status)).length,
    emServico:   quartos.filter((q) => q.categoriaId === cat.id && [ROOM_STATUS.LIMPEZA, ROOM_STATUS.MANUTENCAO, ROOM_STATUS.FORA_DE_SERVICO].includes(q.status)).length,
  }));

  const isDateFilterActive = !!(filterDateStart);

  // Date-sorted groups (shown when date range filter is active)
  const dateGroups = useMemo(() => {
    if (!isDateFilterActive) return [];
    const pernoiteRooms = filteredQuartos.filter((q) => q.servico?.tipo === 'pernoite');
    const byDate = {};
    pernoiteRooms.forEach((r) => {
      const dateStr = r.servico.chegadaPrevista?.split(' ')[0] || 'Sem data';
      if (!byDate[dateStr]) byDate[dateStr] = [];
      byDate[dateStr].push(r);
    });
    return Object.entries(byDate)
      .sort(([a], [b]) => {
        if (a === 'Sem data') return 1;
        if (b === 'Sem data') return -1;
        const [da, ma, ya] = a.split('/'); const [db, mb, yb] = b.split('/');
        return new Date(+ya, +ma - 1, +da) - new Date(+yb, +mb - 1, +db);
      })
      .map(([date, rooms]) => ({ date, rooms }));
  }, [filteredQuartos, isDateFilterActive]);

  const toggleDateGroup = (date) =>
    setDateGroupCollapsed((p) => ({ ...p, [date]: p[date] !== false ? false : true }));
  const isDateGroupCollapsed = (date) => dateGroupCollapsed[date] !== false;

  const filterCounts = {
    todos:      quartos.length,
    disponivel: quartos.filter((q) => q.status === ROOM_STATUS.DISPONIVEL).length,
    ocupado:    quartos.filter((q) => q.status === ROOM_STATUS.OCUPADO).length,
    reservado:  quartos.filter((q) => q.status === ROOM_STATUS.RESERVADO).length,
    limpeza:    quartos.filter((q) => q.status === ROOM_STATUS.LIMPEZA).length,
    servico:    quartos.filter((q) => [ROOM_STATUS.MANUTENCAO, ROOM_STATUS.FORA_DE_SERVICO].includes(q.status)).length,
  };

  const hasActiveFilters = statusFilter !== 'todos' || !!filterTipoOcupacao || !!filterDateStart || !!search.trim();

  const clearAllFilters = () => {
    setStatusFilter('todos');
    setFilterTipoOcupacao('');
    setFilterDateStart(null);
    setFilterDateEnd(null);
    setDateGroupCollapsed({});
    setSearch('');
  };

  // ── Total hospedados across all occupied rooms ────────────────────────────────
  const totalHospedados = quartos.reduce((sum, q) => sum + (q.servico?.hospedes?.length || 0), 0);
  const quartosOcupados = quartos.filter((q) => [ROOM_STATUS.OCUPADO, ROOM_STATUS.RESERVADO].includes(q.status)).length;

  // ── Elapsed for selected room (dayuse) ────────────────────────────────────────
  const selElapsedSec = useMemo(() => {
    if (!selectedRoom?.servico || selectedRoom.servico.tipo !== 'dayuse' || selectedRoom.servico.status !== DAYUSE_STATUS.ATIVO) return 0;
    return calcElapsedSeconds(selectedRoom.servico.dataUso, selectedRoom.servico.horaEntrada, null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRoom, tick]);

  const selElapsedMin = useMemo(() => {
    if (!selectedRoom?.servico || selectedRoom.servico.tipo !== 'dayuse') return 0;
    return calcElapsedMinutes(selectedRoom.servico.dataUso, selectedRoom.servico.horaEntrada, selectedRoom.servico.horaSaida || null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRoom, tick]);

  const selValorAtual = selectedRoom?.servico?.tipo === 'dayuse'
    ? calcValorDayUse(selectedRoom.servico.precoBase, selectedRoom.servico.precoAdicional, selectedRoom.servico.horasBase,
        selectedRoom.servico.status === DAYUSE_STATUS.ATIVO ? Math.floor(selElapsedSec / 60) : selElapsedMin)
    : 0;

  const selConsumoTotal = useMemo(() => {
    if (!selectedRoom?.servico?.consumos) return 0;
    return selectedRoom.servico.consumos.reduce((sum, c) => sum + (c.valorTotal || c.valor || 0), 0);
  }, [selectedRoom]);

  // ── Sync selectedRoom when quartos update ─────────────────────────────────────
  useEffect(() => {
    if (!selectedRoom) return;
    const fresh = quartos.find((q) => q.id === selectedRoom.id);
    if (fresh) setSelectedRoom(fresh);
  }, [quartos]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const toggleCollapse = (id) => setCollapsed((p) => ({ ...p, [id]: !p[id] }));

  const openDetail = (room) => {
    setSelectedRoom(room);
    setDetailTab('dados');
    setDetailDiariaIdx(Math.max(0, (room.servico?.diariaAtual || 1) - 1));
    setDiariaTab('detalhes');
  };

  const closeDetail = () => setSelectedRoom(null);

  const openNovoServico = (tipo, room) => {
    setNovoRoom(room);
    if (tipo === 'pernoite') {
      // Full Nova Hospedagem modal
      setNhHospedes([]); setNhHospedeSearch('');
      setNhCheckinDate(new Date()); setNhCheckinHora('14:00');
      setNhCheckoutDate(null); setNhCheckoutHora('12:00');
      setNhPagamentos([]); setNhPagDesc(''); setNhPagForma('PIX'); setNhPagValor('');
      setNhStep(0);
    } else {
      setNduForm(blankNduForm());
    }
    setNovoModal(tipo);
    setSelectedRoom(null);
  };

  const openService = (type, room) => {
    setServiceModal({ type, room });
    setSvcForm(blankSvcForm());
    setSelectedRoom(null);
  };

  const handleMarcarDisponivel = async (room) => {
    try {
      setSaving(true);
      const updated = await overviewApi.marcarDisponivel(room.id);
      setQuartos((prev) => prev.map((q) => q.id === updated.id ? updated : q));
      notify(`Quarto ${room.numero} marcado como Disponível.`);
      closeDetail();
    } catch (e) { notify('Erro: ' + e.message, 'error'); }
    finally { setSaving(false); }
  };

  const handleService = async () => {
    if (!serviceModal) return;
    const { type, room } = serviceModal;
    setSaving(true);
    try {
      let updated;
      if (type === 'limpeza')     updated = await overviewApi.marcarLimpeza(room.id, svcForm);
      else if (type === 'manutencao') updated = await overviewApi.marcarManutencao(room.id, svcForm);
      else                         updated = await overviewApi.marcarForaDeServico(room.id, svcForm);
      setQuartos((prev) => prev.map((q) => q.id === updated.id ? updated : q));
      notify(`Quarto ${room.numero} → ${updated.status}.`);
      setServiceModal(null);
    } catch (e) { notify('Erro: ' + e.message, 'error'); }
    finally { setSaving(false); }
  };

  // Hóspede helpers for forms
  const npHosp = useMemo(() => {
    const q = npForm.hospedeSearch.trim().toLowerCase();
    return q.length < 2 ? [] : HOSPEDES_CADASTRADOS.filter((h) => h.nome.toLowerCase().includes(q) && !npForm.hospedes.find((x) => x.id === h.id));
  }, [npForm.hospedeSearch, npForm.hospedes]);

  const nduHosp = useMemo(() => {
    const q = nduForm.hospedeSearch.trim().toLowerCase();
    return q.length < 2 ? [] : HOSPEDES_CADASTRADOS.filter((h) => h.nome.toLowerCase().includes(q) && !nduForm.hospedes.find((x) => x.id === h.id));
  }, [nduForm.hospedeSearch, nduForm.hospedes]);

  const addNpHospede  = (h) => { setNpForm((f)  => ({ ...f, hospedes: [...f.hospedes, h],  hospedeSearch: '' })); };
  const remNpHospede  = (id) => { setNpForm((f) => ({ ...f, hospedes: f.hospedes.filter((h) => h.id !== id) })); };
  const addNduHospede = (h) => { setNduForm((f) => ({ ...f, hospedes: [...f.hospedes, h], hospedeSearch: '' })); };
  const remNduHospede = (id) => { setNduForm((f) => ({ ...f, hospedes: f.hospedes.filter((h) => h.id !== id) })); };

  // ── Criar Pernoite (Nova Hospedagem) ─────────────────────────────────────────
  const handleCriarPernoite = async () => {
    if (!novoRoom || !nhCheckinDate || !nhCheckoutDate) { notify('Preencha as datas de chegada e saída.', 'error'); return; }
    setSavingNh(true);
    try {
      const chegada  = `${dateToDisplay(nhCheckinDate)} ${nhCheckinHora}`;
      const saida    = `${dateToDisplay(nhCheckoutDate)} ${nhCheckoutHora}`;
      const dias     = Math.max(1, diffDays(nhCheckinDate, nhCheckoutDate));
      const valorDiaria = calcPrecoDiaria(novoRoom.categoria, nhHospedes.length || 1);
      const valorTotal  = valorDiaria * dias;
      const totalPago   = nhPagamentos.reduce((s, p) => s + p.valor, 0);
      const titular = nhHospedes[0]?.nome || 'Hóspede';
      const servico = {
        titularNome: titular, tipoAcomodacao: novoRoom.tipoOcupacao,
        periodo: `${dateToDisplay(nhCheckinDate)} - ${dateToDisplay(nhCheckoutDate)}`,
        chegadaPrevista: chegada, saidaPrevista: saida,
        status: PERNOITE_STATUS.ATIVO, totalDiarias: dias, diariaAtual: 1,
        valorTotal, totalPago, pagamentoPendente: Math.max(0, valorTotal - totalPago),
        hospedes: nhHospedes, consumos: [], pagamentos: nhPagamentos, diarias: [],
      };
      const updated = await overviewApi.criarPernoite(novoRoom.id, servico);
      setQuartos((prev) => prev.map((q) => q.id === updated.id ? updated : q));
      notify(`Pernoite criado! ${titular} — Apt. ${novoRoom.numero}.`);
      setNovoModal(null);
    } catch (e) { notify('Erro: ' + e.message, 'error'); }
    finally { setSavingNh(false); }
  };

  // ── Criar Day Use ─────────────────────────────────────────────────────────────
  const handleCriarDayUse = async () => {
    if (!novoRoom || !nduForm.horaEntrada) { notify('Informe a hora de entrada.', 'error'); return; }
    setSaving(true);
    try {
      const pricing  = DAY_USE_PRICING[novoRoom.categoria] || { horasBase: 2, precoBase: 90, precoAdicional: 15 };
      const titular  = nduForm.hospedes[0]?.nome || null;
      const servico  = {
        titularNome: titular, dataUso: todayDisplay(),
        horaEntrada: nduForm.horaEntrada, horaSaida: null,
        status: DAYUSE_STATUS.ATIVO,
        horasBase: pricing.horasBase, precoBase: pricing.precoBase, precoAdicional: pricing.precoAdicional,
        valorTotal: 0, totalPago: 0, pagamentoPendente: 0,
        hospedes: nduForm.hospedes, consumos: [], pagamentos: [],
      };
      const updated = await overviewApi.criarDayUse(novoRoom.id, servico);
      setQuartos((prev) => prev.map((q) => q.id === updated.id ? updated : q));
      notify(`Day Use iniciado! ${titular || 'Sem titular'} — Apt. ${novoRoom.numero}.`);
      setNovoModal(null);
    } catch (e) { notify('Erro: ' + e.message, 'error'); }
    finally { setSaving(false); }
  };

  // ── Encerrar Day Use ─────────────────────────────────────────────────────────
  const handleEncerrar = async () => {
    if (!selectedRoom) return;
    setSaving(true);
    try {
      const horaSaida = nowTime();
      const min       = calcElapsedMinutes(selectedRoom.servico.dataUso, selectedRoom.servico.horaEntrada, horaSaida);
      const vt        = calcValorDayUse(selectedRoom.servico.precoBase, selectedRoom.servico.precoAdicional, selectedRoom.servico.horasBase, min);
      const updated   = await overviewApi.encerrarDayUse(selectedRoom.id, { horaSaida, valorTotal: vt, pagamentoPendente: vt });
      setQuartos((prev) => prev.map((q) => q.id === updated.id ? updated : q));
      notify(`Day Use encerrado — ${fmtBRL(vt)}`);
      setEncerrarModal(false);
    } catch (e) { notify('Erro: ' + e.message, 'error'); }
    finally { setSaving(false); }
  };

  // ── Finalizar / Cancelar ──────────────────────────────────────────────────────
  const handleFinalizar = async () => {
    if (!selectedRoom) return;
    setSaving(true);
    try {
      const updated = await overviewApi.finalizarServico(selectedRoom.id);
      setQuartos((prev) => prev.map((q) => q.id === updated.id ? updated : q));
      notify('Serviço finalizado — quarto encaminhado para limpeza.');
      setConfirmModal(null);
    } catch (e) { notify('Erro: ' + e.message, 'error'); }
    finally { setSaving(false); }
  };

  const handleCancelar = async () => {
    if (!selectedRoom) return;
    setSaving(true);
    try {
      const updated = await overviewApi.cancelarServico(selectedRoom.id);
      setQuartos((prev) => prev.map((q) => q.id === updated.id ? updated : q));
      notify('Serviço cancelado.');
      setConfirmModal(null);
    } catch (e) { notify('Erro: ' + e.message, 'error'); }
    finally { setSaving(false); }
  };

  // ── Open unified payment modal ────────────────────────────────────────────────
  const openPayModal = (onConfirmCb, titularNome = '') => {
    setPayNomePagador(titularNome || '');
    setPayAutoFill(!!titularNome);
    setPayDescricao('');
    setPayValor('');
    setPayTipo('PIX');
    setPayOnConfirm(() => onConfirmCb);
    setPayModal(true);
  };

  const handlePayConfirm = async () => {
    const valor = parseBRL(payValor);
    if (!valor || valor <= 0) { notify('Informe um valor válido.', 'error'); return; }
    if (!payDescricao.trim()) { notify('Informe uma descrição.', 'error'); return; }
    if (!payNomePagador.trim()) { notify('Informe o nome do pagador.', 'error'); return; }
    const now = new Date();
    const dataStr = `${dateToDisplay(now)} ${now.toTimeString().slice(0,5)}`;
    const pagamento = { descricao: payDescricao, nomePagador: payNomePagador, formaPagamento: payTipo, valor, data: dataStr };
    if (payOnConfirm) {
      await payOnConfirm(pagamento);
    }
    setPayModal(false);
  };

  // ── Minibar handlers ──────────────────────────────────────────────────────────
  const handleMinibarConsumir = async (produtoId) => {
    if (!selectedRoom) return;
    try {
      const updated = await overviewApi.updateMinibarItem(selectedRoom.id, produtoId, -1);
      setQuartos((prev) => prev.map((q) => q.id === updated.id ? updated : q));
    } catch (e) { notify('Erro: ' + e.message, 'error'); }
  };

  const handleMinibarRepor = async (produtoId) => {
    if (!selectedRoom) return;
    const item = selectedRoom.minibar?.find((m) => m.produtoId === produtoId);
    if (!item) return;
    const delta = item.qtdBase - item.qtdAtual;
    if (delta <= 0) { notify('Item já está na quantidade base.', 'info'); return; }
    try {
      const updated = await overviewApi.updateMinibarItem(selectedRoom.id, produtoId, delta);
      setQuartos((prev) => prev.map((q) => q.id === updated.id ? updated : q));
      notify(`${item.nome} reposto para ${item.qtdBase} unidade(s).`);
    } catch (e) { notify('Erro: ' + e.message, 'error'); }
  };

  const handleMinibarReporTudo = async () => {
    if (!selectedRoom) return;
    try {
      const updated = await overviewApi.reporMinibar(selectedRoom.id);
      setQuartos((prev) => prev.map((q) => q.id === updated.id ? updated : q));
      notify('Minibar reposto completamente.');
    } catch (e) { notify('Erro: ' + e.message, 'error'); }
  };

  const handleAddMinibarItem = async () => {
    if (!selectedRoom || !minibarProd) return;
    const cat = CATEGORIAS_CONSUMO.find((c) => c.id === parseInt(minibarCat));
    const prod = cat?.produtos.find((p) => p.id === parseInt(minibarProd));
    if (!prod) return;
    setSavingMinibar(true);
    try {
      const updated = await overviewApi.adicionarMinibarItem(selectedRoom.id, { produtoId: prod.id, nome: prod.nome, quantidade: minibarQtyAdd });
      setQuartos((prev) => prev.map((q) => q.id === updated.id ? updated : q));
      notify(`${prod.nome} adicionado ao minibar.`);
      setShowAddMinibar(false);
    } catch (e) { notify('Erro: ' + e.message, 'error'); }
    finally { setSavingMinibar(false); }
  };

  // ── Consumo interno (minibar item → consumo list) ─────────────────────────────
  const handleConsumoInterno = async (item) => {
    if (!selectedRoom) return;
    setConsumoSaving(true);
    try {
      // Look up price from CATEGORIAS_CONSUMO by produtoId
      let preco = 0;
      for (const cat of CATEGORIAS_CONSUMO) {
        const prod = cat.produtos.find((p) => p.id === item.produtoId);
        if (prod) { preco = prod.preco; break; }
      }
      const consumo = {
        item: item.nome, categoria: 'Minibar',
        quantidade: 1, valorUnitario: preco, valorTotal: preco,
        tipo: 'interno', produtoId: item.produtoId,
      };
      const updated = await overviewApi.adicionarConsumo(selectedRoom.id, consumo);
      setQuartos((prev) => prev.map((q) => q.id === updated.id ? updated : q));
      notify(`${item.nome} consumido.`);
    } catch (e) { notify('Erro: ' + e.message, 'error'); }
    finally { setConsumoSaving(false); }
  };

  // ── Consumo externo (form → consumo list) ─────────────────────────────────────
  const handleConsumoExterno = async () => {
    if (!selectedRoom || !detailConsumoProdSel) { notify('Selecione um produto.', 'error'); return; }
    setConsumoSaving(true);
    try {
      const consumo = {
        item: detailConsumoProdSel.nome,
        categoria: detailConsumoCatSel?.nome || '',
        quantidade: detailConsumoQty,
        valorUnitario: detailConsumoProdSel.preco,
        valorTotal: detailConsumoProdSel.preco * detailConsumoQty,
        formaPagamento: detailConsumoForma,
        tipo: 'externo',
      };
      const updated = await overviewApi.adicionarConsumo(selectedRoom.id, consumo);
      setQuartos((prev) => prev.map((q) => q.id === updated.id ? updated : q));
      notify(`${consumo.item} adicionado ao consumo.`);
      setDetailConsumoCat(''); setDetailConsumoProd(''); setDetailConsumoQty(1); setDetailConsumoForma('');
    } catch (e) { notify('Erro: ' + e.message, 'error'); }
    finally { setConsumoSaving(false); }
  };

  // ── Gerenciar Diárias handlers ────────────────────────────────────────────────
  const openGerenciarDiarias = () => {
    setGdDataInicio(null); setGdHoraInicio('14:00');
    setGdDataFim(null); setGdHoraFim('12:00'); setGdValor('');
    setShowGerenciarDiarias(true);
  };

  const handleAdicionarDiaria = async () => {
    if (!selectedRoom || !gdDataInicio || !gdDataFim) { notify('Preencha as datas da nova diária.', 'error'); return; }
    const valor = parseBRL(gdValor);
    if (!valor || valor <= 0) { notify('Informe o valor da diária.', 'error'); return; }
    setSavingGd(true);
    try {
      const novaDiaria = {
        dataInicio: `${dateToDisplay(gdDataInicio)} ${gdHoraInicio}`,
        dataFim: `${dateToDisplay(gdDataFim)} ${gdHoraFim}`,
        valor, hospedes: selectedRoom.servico?.hospedes || [], consumos: [], pagamentos: [],
      };
      const updated = await overviewApi.adicionarDiaria(selectedRoom.id, novaDiaria);
      setQuartos((prev) => prev.map((q) => q.id === updated.id ? updated : q));
      notify('Diária adicionada.');
      setGdDataInicio(null); setGdDataFim(null); setGdValor('');
    } catch (e) { notify('Erro: ' + e.message, 'error'); }
    finally { setSavingGd(false); }
  };

  const handleRemoverDiaria = async (diariaIdx) => {
    if (!selectedRoom) return;
    const diaria = selectedRoom.servico?.diarias?.[diariaIdx];
    const atual = selectedRoom.servico?.diariaAtual || 1;
    if (!diaria) return;
    if (diaria.num < atual) { notify('Não é possível remover uma diária já encerrada.', 'error'); return; }
    setSavingGd(true);
    try {
      const updated = await overviewApi.removerDiaria(selectedRoom.id, diariaIdx);
      setQuartos((prev) => prev.map((q) => q.id === updated.id ? updated : q));
      notify(`Diária ${diaria.num} removida.`);
    } catch (e) { notify('Erro: ' + e.message, 'error'); }
    finally { setSavingGd(false); }
  };

  // ── Trocar Quarto handlers ─────────────────────────────────────────────────────
  const openTrocarQuarto = () => {
    const diarias = selectedRoom?.servico?.diarias || [];
    const atual   = selectedRoom?.servico?.diariaAtual || 1;
    // Pre-select all diárias from current forward
    setTqDiariasIdxs(diarias.filter((d) => d.num >= atual).map((d) => d.idx));
    setTqNovoQuartoId(null);
    setShowTrocarQuarto(true);
  };

  const handleTrocarQuarto = async () => {
    if (!selectedRoom || !tqNovoQuartoId) { notify('Selecione o quarto destino.', 'error'); return; }
    setSavingTq(true);
    try {
      const updated = await overviewApi.trocarQuarto(selectedRoom.id, tqNovoQuartoId, tqDiariasIdxs);
      setQuartos((prev) => prev.map((q) => q.id === updated.id ? updated : q));
      notify('Quarto alterado com sucesso.');
      setShowTrocarQuarto(false);
    } catch (e) { notify('Erro: ' + e.message, 'error'); }
    finally { setSavingTq(false); }
  };

  // ── Aplicar Desconto ─────────────────────────────────────────────────────────
  const handleAplicarDesconto = async () => {
    const valor = parseBRL(descontoValor) || parseFloat(descontoValor) || 0;
    if (!valor || valor <= 0) { notify('Informe um valor de desconto válido.', 'error'); return; }
    if (!descontoDescricao.trim()) { notify('Informe uma descrição para o desconto.', 'error'); return; }
    setDescontoSaving(true);
    try {
      const desconto = { tipo: descontoTipo, valor, descricao: descontoDescricao, scope: descontoScope };
      const updatedRooms = quartos.map((q) => {
        if (q.id !== selectedRoom?.id) return q;
        return { ...q, servico: { ...q.servico, desconto } };
      });
      setQuartos(updatedRooms);
      const label = descontoTipo === 'percentual' ? `${valor}%` : fmtBRL(valor);
      notify(`Desconto de ${label} aplicado — ${descontoDescricao}.`);
      setShowDescontoModal(false);
    } catch (e) { notify('Erro: ' + e.message, 'error'); }
    finally { setDescontoSaving(false); }
  };

  // ── Adicionar Pagamento ───────────────────────────────────────────────────────
  const handleAddPagamento = async () => {
    const valor = parseBRL(pagForm.valor);
    if (!valor || valor <= 0) { notify('Informe um valor válido.', 'error'); return; }
    if (!pagForm.descricao.trim()) { notify('Informe uma descrição.', 'error'); return; }
    setSaving(true);
    try {
      const now     = new Date();
      const dataStr = `${dateToDisplay(now)} ${now.toTimeString().slice(0,5)}`;
      const updated = await overviewApi.adicionarPagamento(selectedRoom.id, { descricao: pagForm.descricao, formaPagamento: pagForm.formaPagamento, valor, data: dataStr });
      setQuartos((prev) => prev.map((q) => q.id === updated.id ? updated : q));
      notify(`Pagamento de ${fmtBRL(valor)} registrado.`);
      setPagModal(false);
      setPagForm(blankPagForm());
    } catch (e) { notify('Erro: ' + e.message, 'error'); }
    finally { setSaving(false); }
  };


  // ── Render helpers ─────────────────────────────────────────────────────────────
  const BedsRow = ({ camas }) => (
    <div className={styles.bedsRow}>
      <span className={styles.bedItem}><BedDouble size={11} /> Cama Casal: {camas.casal || 0}</span>
      <span className={styles.bedItem}><BedSingle size={11} /> Solteiro: {camas.solteiro || 0}</span>
      <span className={styles.bedItem}><Layers size={11} /> Beliche: {camas.beliche || 0}</span>
      <span className={styles.bedItem}><Waves size={11} /> Rede: {camas.rede || 0}</span>
    </div>
  );

  const BedsDetailGrid = ({ camas }) => (
    <div className={styles.bedsDetailGrid}>
      {[
        { key: 'casal',    label: 'Cama Casal',   Icon: BedDouble },
        { key: 'solteiro', label: 'Cama Solteiro', Icon: BedSingle },
        { key: 'beliche',  label: 'Beliches',      Icon: Layers    },
        { key: 'rede',     label: 'Rede',          Icon: Waves     },
      ].map(({ key, label, Icon }) => (
        <div key={key} className={[styles.bedDetailItem, camas[key] > 0 ? styles.bedDetailItemActive : ''].join(' ')}>
          <Icon size={18} className={styles.bedDetailIcon} />
          <div>
            <span className={styles.bedDetailLabel}>{label}</span>
            <span className={styles.bedDetailCount}>{camas[key] || 0}</span>
          </div>
        </div>
      ))}
    </div>
  );

  // ── Build detail modal content ─────────────────────────────────────────────
  const renderDetailContent = () => {
    if (!selectedRoom) return null;
    const s = selectedRoom;
    const sk = roomStatusKey(s.status);

    // ── Disponível ────────────────────────────────────────────────────────────
    if (s.status === ROOM_STATUS.DISPONIVEL) {
      const pricing   = DAY_USE_PRICING[s.categoria] || {};
      const stayPrice = STAY_PRICING[s.categoria] || {};
      const dispTabs  = [
        { id: 'dados',   label: 'Dados' },
        { id: 'consumo', label: 'Consumo' },
        { id: 'itens',   label: 'Detalhes do Quarto' },
        { id: 'precos',  label: 'Preços' },
      ];
      return (
        <>
          <div className={styles.detailTabs}>
            {dispTabs.map((t) => (
              <button key={t.id} className={[styles.detailTab, detailTab === t.id ? styles.detailTabActive : ''].join(' ')} onClick={() => setDetailTab(t.id)}>
                {t.label}
              </button>
            ))}
          </div>
          <div className={styles.detailTabBody}>
            {detailTab === 'dados' && (
              <div className={styles.tabContent}>
                <div className={styles.sectionTitle}><BedDouble size={13} /> Configuração de Camas</div>
                <BedsDetailGrid camas={s.camas} />
                <div className={styles.infoGrid2}>
                  <div className={styles.infoRow}><span className={styles.infoLabel}>Categoria</span><span className={styles.infoValue}>{s.categoria}</span></div>
                  <div className={styles.infoRow}><span className={styles.infoLabel}>Tipo de Ocupação</span><span className={styles.infoValue}>{s.tipoOcupacao}</span></div>
                </div>
                {s.descricao && (
                  <div className={styles.descricaoBlock}>
                    <span className={styles.infoLabel}>Descrição</span>
                    <p className={styles.descricaoText}>{s.descricao}</p>
                  </div>
                )}
                <div className={styles.pricingBlock}>
                  <div className={styles.pricingBlockTitle}>Referência de Preços</div>
                  <div className={styles.pricingCols}>
                    <div className={styles.pricingCol}>
                      <span className={styles.pricingColLabel}>Day Use</span>
                      <span className={styles.pricingColVal}>{fmtBRL(pricing.precoBase)}</span>
                      <span className={styles.pricingColSub}>{pricing.horasBase}h base + {fmtBRL(pricing.precoAdicional)}/h adicional</span>
                    </div>
                    <div className={styles.pricingColSep} />
                    <div className={styles.pricingCol}>
                      <span className={styles.pricingColLabel}>Pernoite</span>
                      {stayPrice.modeloCobranca === 'Por quarto (tarifa fixa)'
                        ? <span className={styles.pricingColVal}>{fmtBRL(stayPrice.precoFixo)}</span>
                        : <span className={styles.pricingColVal}>A partir de {fmtBRL(stayPrice.precosOcupacao?.[1])}</span>}
                      <span className={styles.pricingColSub}>{stayPrice.modeloCobranca}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {detailTab === 'consumo' && (
              <div className={styles.tabContent}>
                <div className={styles.minibarHeader}>
                  <span className={styles.minibarHeaderTitle}><ShoppingCart size={13} /> Minibar / Consumo</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <Button variant="secondary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={handleMinibarReporTudo}>
                      <RotateCcw size={12} /> Repor Tudo
                    </Button>
                    <Button variant="primary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => { setMinibarCat(''); setMinibarProd(''); setMinibarQtyAdd(1); setShowAddMinibar(true); }}>
                      <Plus size={12} /> Adicionar Item
                    </Button>
                  </div>
                </div>
                {(!s.minibar || s.minibar.length === 0) ? (
                  <div className={styles.emptyList}><Package size={24} color="var(--text-2)" /><span>Nenhum item no minibar</span></div>
                ) : (
                  <div className={styles.minibarList}>
                    {s.minibar.map((item) => {
                      const ratio = item.qtdBase > 0 ? item.qtdAtual / item.qtdBase : 1;
                      const isLow = ratio < 0.5;
                      return (
                        <div key={item.produtoId} className={[styles.minibarCard, isLow ? styles.minibarCardLow : ''].join(' ')}>
                          <div className={styles.minibarCardLeft}>
                            <span className={styles.minibarCardName}>{item.nome}</span>
                            <div className={styles.minibarQtyRow}>
                              <span className={[styles.minibarQtyCurrent, isLow ? styles.minibarQtyLow : ''].join(' ')}>{item.qtdAtual}</span>
                              <span className={styles.minibarQtySep}>/</span>
                              <span className={styles.minibarQtyBase}>{item.qtdBase} base</span>
                            </div>
                          </div>
                          <div className={styles.minibarProgressWrap}>
                            <div className={styles.minibarProgressBar}>
                              <div
                                className={[styles.minibarProgressFill, isLow ? styles.minibarProgressFillLow : ''].join(' ')}
                                style={{ width: `${Math.min(100, ratio * 100)}%` }}
                              />
                            </div>
                          </div>
                          <div className={styles.minibarCardActions}>
                            <button
                              className={[styles.minibarIconBtn, styles.minibarIconBtnGreen].join(' ')}
                              title="Repor item"
                              onClick={() => handleMinibarRepor(item.produtoId)}
                            ><RotateCcw size={13} /></button>
                            <button
                              className={[styles.minibarIconBtn, styles.minibarIconBtnRed].join(' ')}
                              title="Consumir"
                              onClick={() => handleMinibarConsumir(item.produtoId)}
                            ><Minus size={13} /></button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
            {detailTab === 'itens' && (
              <div className={styles.tabContent}>
                {(!s.itens || s.itens.length === 0)
                  ? <div className={styles.emptyList}><Package size={24} color="var(--text-2)" /><span>Nenhum item cadastrado</span></div>
                  : (
                    <div className={styles.itemsGrid}>
                      {s.itens.map((item, i) => (
                        <div key={i} className={styles.itemCard}>
                          <Package size={14} className={styles.itemCardIcon} />
                          <div>
                            <div className={styles.itemCardName}>{item.nome}</div>
                            <div className={styles.itemCardQty}>Qtd: {item.qtd}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                }
              </div>
            )}
            {detailTab === 'precos' && (() => {
              const po = s.pricingOverride;
              return (
                <div className={styles.pricingTabBlock}>
                  {/* Pernoite pricing */}
                  <div>
                    <div className={styles.sectionTitle}><BedDouble size={13} /> Pernoite {po?.pernoite ? `— ${po.pernoite.modeloCobranca}` : `— ${stayPrice.modeloCobranca}`}</div>
                    {po?.pernoite ? (
                      <div className={styles.pricingTableWrap} style={{ marginTop: 10 }}>
                        <table className={styles.pricingTable}>
                          <thead><tr><th>Ocupação</th><th>Valor / noite</th><th>Menor de Idade</th></tr></thead>
                          <tbody>
                            {po.pernoite.tiers.map((tier) => (
                              <tr key={tier.pessoas}>
                                <td>{tier.pessoas} {tier.pessoas === 1 ? 'pessoa' : 'pessoas'}</td>
                                <td><strong>{fmtBRL(tier.valor)}</strong></td>
                                <td style={{ color: 'var(--text-2)', fontSize: 12 }}>{tier.crianca?.label || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : stayPrice.modeloCobranca === 'Por quarto (tarifa fixa)' ? (
                      <div className={styles.pricingTableWrap} style={{ marginTop: 10 }}>
                        <table className={styles.pricingTable}>
                          <thead><tr><th>Tipo</th><th>Valor / noite</th></tr></thead>
                          <tbody><tr><td>Tarifa Fixa (qualquer ocupação)</td><td><strong>{fmtBRL(stayPrice.precoFixo)}</strong></td></tr></tbody>
                        </table>
                      </div>
                    ) : (
                      <div className={styles.pricingTableWrap} style={{ marginTop: 10 }}>
                        <table className={styles.pricingTable}>
                          <thead><tr><th>Ocupação</th><th>Valor / noite</th></tr></thead>
                          <tbody>
                            {Object.entries(stayPrice.precosOcupacao || {}).map(([n, v]) => (
                              <tr key={n}><td>{n} {n === '1' ? 'pessoa' : 'pessoas'}</td><td><strong>{fmtBRL(v)}</strong></td></tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                  {/* Day Use pricing */}
                  <div>
                    <div className={styles.sectionTitle}><Clock size={13} /> Day Use</div>
                    {po?.dayuse ? (
                      <div className={styles.pricingTableWrap} style={{ marginTop: 10 }}>
                        <table className={styles.pricingTable}>
                          <thead><tr><th>Ocupação</th><th>Base ({po.dayuse.tiers[0]?.horasBase}h)</th><th>+Hora extra</th><th>Menor de Idade</th></tr></thead>
                          <tbody>
                            {po.dayuse.tiers.map((tier) => (
                              <tr key={tier.pessoas}>
                                <td>{tier.pessoas} {tier.pessoas === 1 ? 'pessoa' : 'pessoas'}</td>
                                <td><strong>{fmtBRL(tier.precoBase)}</strong></td>
                                <td>{fmtBRL(tier.precoAdicional)}</td>
                                <td style={{ color: 'var(--text-2)', fontSize: 12 }}>{tier.crianca?.label || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className={styles.pricingDayUseBlock} style={{ marginTop: 10 }}>
                        <div className={styles.summaryCard}>
                          <span className={styles.summaryLabel}>Preço Base</span>
                          <span className={styles.summaryValue}>{fmtBRL(pricing.precoBase)}</span>
                          <span style={{ fontSize: 11, color: 'var(--text-2)' }}>{pricing.horasBase}h incluídas</span>
                        </div>
                        <div className={styles.summaryCard}>
                          <span className={styles.summaryLabel}>Hora Adicional</span>
                          <span className={styles.summaryValue}>{fmtBRL(pricing.precoAdicional)}</span>
                          <span style={{ fontSize: 11, color: 'var(--text-2)' }}>por hora extra</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        </>
      );
    }

    // ── Limpeza / Manutenção / Fora ───────────────────────────────────────────
    if ([ROOM_STATUS.LIMPEZA, ROOM_STATUS.MANUTENCAO, ROOM_STATUS.FORA_DE_SERVICO].includes(s.status)) {
      return (
        <div className={styles.tabContent}>
          <div className={styles.infoGrid2}>
            <div className={styles.infoRow}><span className={styles.infoLabel}>Categoria</span><span className={styles.infoValue}>{s.categoria}</span></div>
            <div className={styles.infoRow}><span className={styles.infoLabel}>Tipo de Ocupação</span><span className={styles.infoValue}>{s.tipoOcupacao}</span></div>
          </div>
          {s.status === ROOM_STATUS.LIMPEZA && s.limpeza && (
            <div className={styles.serviceBlock}>
              <Sparkles size={14} className={styles.serviceBlockIcon} />
              <div className={styles.serviceBlockInfo}>
                <span className={styles.serviceBlockLabel}>Em Limpeza</span>
                {s.limpeza.responsavel && <span className={styles.serviceBlockValue}>Responsável: {s.limpeza.responsavel}</span>}
                {s.limpeza.inicio      && <span className={styles.serviceBlockSub}>Início: {s.limpeza.inicio}</span>}
              </div>
            </div>
          )}
          {(s.status === ROOM_STATUS.MANUTENCAO || s.status === ROOM_STATUS.FORA_DE_SERVICO) && s.manutencao && (
            <div className={styles.serviceBlock}>
              <Wrench size={14} className={[styles.serviceBlockIcon, styles.serviceBlockIconAmber].join(' ')} />
              <div className={styles.serviceBlockInfo}>
                <span className={styles.serviceBlockLabel}>{s.status}</span>
                {s.manutencao.responsavel && <span className={styles.serviceBlockValue}>Responsável: {s.manutencao.responsavel}</span>}
                {s.manutencao.descricao   && <span className={styles.serviceBlockSub}>{s.manutencao.descricao}</span>}
                {s.manutencao.previsaoFim && <span className={styles.serviceBlockSub}>Previsão: {s.manutencao.previsaoFim}</span>}
              </div>
            </div>
          )}
          <BedsDetailGrid camas={s.camas} />
        </div>
      );
    }

    // ── Reservado ─────────────────────────────────────────────────────────────
    if (s.status === ROOM_STATUS.RESERVADO && s.servico?.tipo === 'reserva') {
      const r = s.servico;
      return (
        <div className={styles.tabContent}>
          <div className={styles.infoGrid2}>
            <div className={styles.infoRow}><span className={styles.infoLabel}>Hóspede</span><span className={styles.infoValue}>{r.titularNome}</span></div>
            <div className={styles.infoRow}><span className={styles.infoLabel}>Tipo de Quarto</span><span className={styles.infoValue}>{r.tipoAcomodacao || s.tipoOcupacao}</span></div>
            <div className={styles.infoRow}><span className={styles.infoLabel}>Chegada Prevista</span><span className={styles.infoValue}>{r.chegadaPrevista}</span></div>
            <div className={styles.infoRow}><span className={styles.infoLabel}>Saída Prevista</span><span className={styles.infoValue}>{r.saidaPrevista}</span></div>
            <div className={styles.infoRow}><span className={styles.infoLabel}>Diárias</span><span className={styles.infoValue}>{r.totalDiarias}</span></div>
            <div className={styles.infoRow}><span className={styles.infoLabel}>Categoria</span><span className={styles.infoValue}>{s.categoria}</span></div>
          </div>
          <BedsDetailGrid camas={s.camas} />
        </div>
      );
    }

    // ── Ocupado — Pernoite ─────────────────────────────────────────────────────
    if (s.servico?.tipo === 'pernoite') {
      const sv = s.servico;
      const diarias = sv.diarias || [];
      const curDiaria = diarias[detailDiariaIdx];
      const progressPercent = sv.valorTotal > 0 ? Math.min(100, (sv.totalPago / sv.valorTotal) * 100) : 0;
      return (
        <>
          <div className={styles.detailTabs}>
            {[['dados', 'Dados do Pernoite'], ['diarias', 'Diárias']].map(([t, label]) => (
              <button key={t} className={[styles.detailTab, detailTab === t ? styles.detailTabActive : ''].join(' ')} onClick={() => setDetailTab(t)}>
                {label}
              </button>
            ))}
          </div>

          <div className={styles.detailTabBody}>
            {detailTab === 'dados' && (
              <div className={[styles.tabContent, styles.tabBody].join(' ')}>
                <div className={styles.dataGrid2}>
                  <div className={styles.infoBox}>
                    <div className={styles.infoBoxHeader}>
                      <Calendar size={14} className={styles.infoBoxIcon} />
                      <span className={styles.infoBoxLabel}>Período</span>
                    </div>
                    <p className={styles.infoBoxValue}>{sv.periodo}</p>
                    <p className={styles.infoBoxSub}>{sv.totalDiarias} diária{sv.totalDiarias !== 1 ? 's' : ''}</p>
                  </div>
                  <div className={styles.infoBox}>
                    <div className={styles.infoBoxHeader}>
                      <Clock size={14} className={styles.infoBoxIconGreen} />
                      <span className={styles.infoBoxLabel}>Check-in / Check-out</span>
                    </div>
                    <p className={styles.infoBoxValue}>Entrada: {sv.chegadaPrevista}</p>
                    <p className={styles.infoBoxValue}>Saída: {sv.saidaPrevista}</p>
                  </div>
                </div>
                <div className={styles.financialBox}>
                  <div className={styles.infoBoxHeader}>
                    <DollarSign size={14} className={styles.infoBoxIconAmber} />
                    <span className={styles.infoBoxLabel}>Resumo Financeiro</span>
                  </div>
                  <div className={styles.financialGrid}>
                    <div className={styles.financialItem}>
                      <span className={styles.financialLabel}>Valor Total</span>
                      <span className={styles.financialValue}>{fmtBRL(sv.valorTotal)}</span>
                    </div>
                    <div className={styles.financialItem}>
                      <span className={styles.financialLabel}>Total Pago</span>
                      <span className={[styles.financialValue, styles.valueGreen].join(' ')}>{fmtBRL(sv.totalPago)}</span>
                    </div>
                    <div className={styles.financialItem}>
                      <span className={styles.financialLabel}>Pendente</span>
                      <span className={[styles.financialValue, sv.pagamentoPendente > 0 ? styles.valueAmber : styles.valueGreen].join(' ')}>{fmtBRL(sv.pagamentoPendente)}</span>
                    </div>
                  </div>
                  <div className={styles.progressWrap}>
                    <div className={styles.progressLabels}>
                      <span>Progresso de pagamento</span>
                      <span>{progressPercent.toFixed(0)}%</span>
                    </div>
                    <div className={styles.progressBar}>
                      <div className={styles.progressFill} style={{ width: `${progressPercent}%` }} />
                    </div>
                  </div>
                </div>
                <div className={styles.pernoiteActionsRow}>
                  <Button variant="secondary" size="sm" onClick={() => openService('limpeza', s)}>
                    <Sparkles size={13} /> Limpeza
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => openService('manutencao', s)}>
                    <Wrench size={13} /> Manutenção
                  </Button>
                  <Button variant="secondary" size="sm" onClick={openGerenciarDiarias}>
                    <RefreshCw size={13} /> Ger. Diárias
                  </Button>
                  <Button variant="secondary" size="sm" onClick={openTrocarQuarto}>
                    <ArrowLeftRight size={13} /> Trocar Quarto
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => {
                    setDescontoScope('global'); setDescontoTipo('percentual');
                    setDescontoValor(''); setDescontoDescricao('');
                    setShowDescontoModal(true);
                  }}>
                    <Tag size={13} /> Desconto
                  </Button>
                </div>
              </div>
            )}
            {detailTab === 'diarias' && (
              <div className={[styles.tabContent, styles.tabBody].join(' ')}>
                {diarias.length === 0 ? (
                  <div className={styles.emptyList}><Calendar size={24} color="var(--text-2)" /><span>Nenhuma diária registrada</span></div>
                ) : (
                  <>
                    <div className={styles.diariasNavBox}>
                      <div className={styles.diariasNavTop}>
                        <span className={styles.diariasNavLabel}>Selecione a diária</span>
                        <span className={styles.diariaAtualBadge}>Diária atual: {sv.diariaAtual}</span>
                      </div>
                      <div className={styles.diariasPills}>
                        {diarias.map((d, idx) => {
                          const isAtual = idx + 1 === sv.diariaAtual;
                          const isSel   = detailDiariaIdx === idx;
                          return (
                            <button key={idx} type="button"
                              onClick={() => { setDetailDiariaIdx(idx); setDiariaTab('detalhes'); }}
                              className={[styles.diariaPill, isSel ? styles.diariaPillActive : '', !isSel && isAtual ? styles.diariaPillAtual : ''].join(' ')}
                            >
                              <span>Diária {d.num}{isAtual ? ' ●' : ''}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    {curDiaria && (
                      <>
                        <div className={styles.subTabs}>
                          {[
                            ['detalhes', 'Detalhes'],
                            ['hospedes', `Hóspedes (${(curDiaria.hospedes || []).length})`],
                            ['consumos', `Consumo (${(curDiaria.consumos || []).length})`],
                            ['pagamentos', `Pagamentos (${(curDiaria.pagamentos || []).length})`],
                          ].map(([t, label]) => (
                            <button key={t} type="button" className={[styles.subTab, diariaTab === t ? styles.subTabActive : ''].join(' ')} onClick={() => setDiariaTab(t)}>
                              {label}
                            </button>
                          ))}
                        </div>
                        {diariaTab === 'detalhes' && (
                          <div className={styles.subTabContent}>
                            <div className={styles.diariaDetailsBox}>
                              {[
                                { label: 'Valor da Diária', value: fmtBRL(curDiaria.valor) },
                                { label: 'Início',          value: curDiaria.dataInicio },
                                { label: 'Fim',             value: curDiaria.dataFim },
                              ].map(({ label, value }) => (
                                <div key={label} className={styles.diariaDetailRow}>
                                  <span className={styles.diariaDetailLabel}>{label}</span>
                                  <span className={styles.diariaDetailValue}>{value}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {diariaTab === 'hospedes' && (
                          <div className={styles.subTabContent}>
                            <Button variant="primary" onClick={() => { setDetailHospedeSearch(''); setDetailHospedeSelected(null); setShowDetailAddHospede(true); }}>
                              <Plus size={14} /> Adicionar Hóspede
                            </Button>
                            {(curDiaria.hospedes || []).length === 0 ? (
                              <div className={styles.emptyList}><User size={20} color="var(--text-2)" /><span>Nenhum hóspede nesta diária.</span></div>
                            ) : (
                              <div className={styles.itemList}>
                                {(curDiaria.hospedes || []).map((h, i) => (
                                  <div key={h.id || i} className={styles.listItem}>
                                    <div className={styles.listItemLeft}>
                                      <User size={14} className={i === 0 ? styles.listItemIconGreen : styles.listItemIcon} />
                                      <div>
                                        <div className={styles.listItemName}>{h.nome} {i === 0 && <span className={styles.titularTag}>Titular</span>}</div>
                                        <div className={styles.listItemSub}>{h.telefone || '—'} · {h.email || '—'}</div>
                                      </div>
                                    </div>
                                    <div className={styles.contactActions}>
                                      {h.telefone && (
                                        <a href={`https://wa.me/55${h.telefone.replace(/\D/g,'')}`} target="_blank" rel="noreferrer"
                                          className={styles.quickBtn} title="WhatsApp" onClick={(e) => e.stopPropagation()}>
                                          <Phone size={11} />
                                        </a>
                                      )}
                                      {h.email && (
                                        <a href={`mailto:${h.email}`} target="_blank" rel="noreferrer"
                                          className={styles.quickBtn} title="E-mail" onClick={(e) => e.stopPropagation()}>
                                          <Mail size={11} />
                                        </a>
                                      )}
                                      <button type="button" className={styles.removeBtn} onClick={() => notify('Funcionalidade em desenvolvimento.', 'info')}><Trash2 size={13} /></button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                        {diariaTab === 'consumos' && (
                          <div className={styles.subTabContent}>
                            <Button variant="primary" onClick={() => { setDetailConsumoCat(''); setDetailConsumoProd(''); setDetailConsumoQty(1); setDetailConsumoForma(''); setShowAddConsumoModal(true); }}>
                              <Plus size={14} /> Adicionar Consumo
                            </Button>
                            {(sv.consumos || []).length === 0 ? (
                              <div className={styles.emptyList}><ShoppingCart size={20} color="var(--text-2)" /><span>Nenhum consumo registrado.</span></div>
                            ) : (
                              <div className={styles.itemList}>
                                {(sv.consumos || []).map((c, i) => (
                                  <div key={c.id || i} className={styles.listItem}>
                                    <div className={styles.listItemLeft}>
                                      <ShoppingCart size={14} className={c.tipo === 'interno' ? styles.listItemIconGreen : styles.listItemIcon} />
                                      <div>
                                        <div className={styles.listItemName}>{c.item}</div>
                                        <div className={styles.listItemSub}>{c.categoria} · Qtd: {c.quantidade}{c.formaPagamento ? ` · ${c.formaPagamento}` : ''}</div>
                                      </div>
                                    </div>
                                    <span className={styles.listItemValue}>{fmtBRL(c.valorTotal)}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                        {diariaTab === 'pagamentos' && (
                          <div className={styles.subTabContent}>
                            <Button variant="primary" onClick={() => openPayModal(async (pag) => {
                              const updated = await overviewApi.adicionarPagamento(selectedRoom.id, pag);
                              setQuartos((prev) => prev.map((q) => q.id === updated.id ? updated : q));
                              notify(`Pagamento de ${fmtBRL(pag.valor)} registrado.`);
                            }, s.servico?.titularNome)}>
                              <Plus size={14} /> Adicionar Pagamento
                            </Button>
                            {(curDiaria.pagamentos || []).length === 0 ? (
                              <div className={styles.emptyList}><CreditCard size={20} color="var(--text-2)" /><span>Nenhum pagamento nesta diária.</span></div>
                            ) : (
                              <div className={styles.itemList}>
                                {(curDiaria.pagamentos || []).map((p, i) => (
                                  <div key={p.id || i} className={styles.listItem}>
                                    <div className={styles.listItemLeft}>
                                      <CreditCard size={14} className={styles.listItemIconGreen} />
                                      <div>
                                        <div className={styles.listItemName}>{p.descricao}</div>
                                        <div className={styles.listItemSub}>{p.forma || p.formaPagamento} • {p.data}</div>
                                      </div>
                                    </div>
                                    <span className={[styles.listItemValue, styles.valueGreen].join(' ')}>{fmtBRL(p.valor)}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </>
      );
    }

    // ── Ocupado — Day Use ──────────────────────────────────────────────────────
    if (s.servico?.tipo === 'dayuse') {
      const sv     = s.servico;
      const isAtivo = sv.status === DAYUSE_STATUS.ATIVO;
      return (
        <>
          <div className={styles.detailTabs}>
            {[
              ['dados',      'Dados'],
              ['hospedes',   `Hóspedes (${sv.hospedes?.length || 0})`],
              ['consumos',   `Consumo (${sv.consumos?.length || 0})`],
              ['pagamentos', `Pagamentos (${sv.pagamentos?.length || 0})`],
            ].map(([t, label]) => (
              <button key={t} className={[styles.detailTab, detailTab === t ? styles.detailTabActive : ''].join(' ')} onClick={() => setDetailTab(t)}>
                {label}
              </button>
            ))}
          </div>

          <div className={styles.detailTabBody}>
            {detailTab === 'dados' && (
              <div className={styles.tabContent}>
                <div className={styles.pricingBlock}>
                  <div className={styles.pricingBlockTitle}>Day Use — {s.categoria}</div>
                  <div className={styles.pricingCols}>
                    <div className={styles.pricingCol}>
                      <span className={styles.pricingColLabel}>Referência de Preços</span>
                      <span className={styles.pricingColVal}>{fmtBRL(sv.precoBase)}</span>
                      <span className={styles.pricingColSub}>{sv.horasBase}h base · +{fmtBRL(sv.precoAdicional)}/h extra</span>
                    </div>
                    <div className={styles.pricingColSep} />
                    <div className={styles.pricingCol}>
                      <span className={styles.pricingColLabel}>{isAtivo ? 'Tempo decorrido' : 'Tempo total'}</span>
                      {isAtivo
                        ? <span className={[styles.pricingColVal, styles.clockRunning].join(' ')}>{fmtClock(selElapsedSec)}</span>
                        : <span className={styles.pricingColVal}>{fmtElapsed(selElapsedMin)}</span>
                      }
                      <span className={styles.pricingColSub}>{isAtivo ? 'em andamento' : (sv.horaEntrada + ' → ' + sv.horaSaida)}</span>
                    </div>
                  </div>
                </div>
                <div className={styles.financialBox}>
                  <div className={styles.financialGrid}>
                    <div className={styles.financialItem}>
                      <span className={styles.financialLabel}>{isAtivo ? 'Hospedagem até agora' : 'Hospedagem'}</span>
                      <span className={styles.financialValue}>{fmtBRL(isAtivo ? selValorAtual : sv.valorTotal)}</span>
                    </div>
                    <div className={styles.financialItem}>
                      <span className={styles.financialLabel}>Consumo</span>
                      <span className={styles.financialValue}>{fmtBRL(selConsumoTotal)}</span>
                    </div>
                    <div className={styles.financialItem}>
                      <span className={styles.financialLabel}>Total</span>
                      <span className={[styles.financialValue, styles.valueGreen].join(' ')}>
                        {fmtBRL((isAtivo ? selValorAtual : sv.valorTotal) + selConsumoTotal)}
                      </span>
                    </div>
                  </div>
                  {!isAtivo && (() => {
                    const duTotal = (sv.valorTotal || 0) + selConsumoTotal;
                    const duPago  = sv.totalPago || 0;
                    const duPct   = duTotal > 0 ? Math.min(100, (duPago / duTotal) * 100) : 0;
                    return (
                      <>
                        <div className={styles.financialGrid} style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                          <div className={styles.financialItem}>
                            <span className={styles.financialLabel}>Total Pago</span>
                            <span className={[styles.financialValue, styles.valueGreen].join(' ')}>{fmtBRL(sv.totalPago || 0)}</span>
                          </div>
                          <div className={styles.financialItem}>
                            <span className={styles.financialLabel}>Falta Pagar</span>
                            <span className={[styles.financialValue, (sv.pagamentoPendente || 0) > 0 ? styles.valueAmber : styles.valueGreen].join(' ')}>
                              {fmtBRL(sv.pagamentoPendente || 0)}
                            </span>
                          </div>
                          {sv.desconto?.valor > 0 && (
                            <div className={styles.financialItem}>
                              <span className={styles.financialLabel}>Desconto</span>
                              <span className={[styles.financialValue, styles.valueGreen].join(' ')}>
                                {sv.desconto.tipo === 'percentual' ? `${sv.desconto.valor}%` : fmtBRL(sv.desconto.valor)}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className={styles.progressWrap} style={{ marginTop: 10 }}>
                          <div className={styles.progressLabels}>
                            <span>Progresso de pagamento</span>
                            <span>{duPct.toFixed(0)}%</span>
                          </div>
                          <div className={styles.progressBar}>
                            <div className={styles.progressFill} style={{ width: `${duPct}%` }} />
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
                <div className={styles.infoGrid2}>
                  <div className={styles.infoRow}><span className={styles.infoLabel}>Titular</span><span className={styles.infoValue}>{sv.titularNome || <em>Sem titular</em>}</span></div>
                  <div className={styles.infoRow}><span className={styles.infoLabel}>Data de uso</span><span className={styles.infoValue}>{sv.dataUso}</span></div>
                  <div className={styles.infoRow}><span className={styles.infoLabel}>Entrada</span><span className={styles.infoValue}>{sv.horaEntrada}</span></div>
                  <div className={styles.infoRow}><span className={styles.infoLabel}>Saída</span><span className={styles.infoValue}>{sv.horaSaida || <em>Em aberto</em>}</span></div>
                  {sv.pagamentoPendente > 0 && <div className={styles.infoRow}><span className={styles.infoLabel}>Pendente</span><span className={[styles.infoValue, styles.textAmber].join(' ')}>{fmtBRL(sv.pagamentoPendente)}</span></div>}
                </div>
              </div>
            )}
            {detailTab === 'hospedes' && (
              <div className={styles.subTabContent}>
                <Button variant="primary" size="sm" onClick={() => { setDetailHospedeSearch(''); setDetailHospedeSelected(null); setShowDetailAddHospede(true); }}>
                  <Plus size={13} /> Adicionar Hóspede
                </Button>
                <div className={styles.itemList}>
                  {(sv.hospedes || []).length === 0
                    ? <div className={styles.emptyList}><User size={24} color="var(--text-2)" /><span>Nenhum hóspede registrado</span></div>
                    : (sv.hospedes || []).map((h, i) => (
                      <div key={h.id} className={styles.listItem}>
                        <div className={styles.listItemLeft}>
                          <User size={15} className={i === 0 ? styles.listItemIconGreen : styles.listItemIcon} />
                          <div>
                            <div className={styles.listItemName}>{h.nome} {i === 0 && <span className={styles.titularTag}>Titular</span>}</div>
                            <div className={styles.listItemSub}>{h.telefone || '—'} · {h.email || '—'}</div>
                          </div>
                        </div>
                        <div className={styles.contactActions}>
                          {h.telefone && (
                            <a href={`https://wa.me/55${h.telefone.replace(/\D/g,'')}`} target="_blank" rel="noreferrer"
                              className={styles.quickBtn} title="WhatsApp" onClick={(e) => e.stopPropagation()}>
                              <Phone size={11} />
                            </a>
                          )}
                          {h.email && (
                            <a href={`mailto:${h.email}`} target="_blank" rel="noreferrer"
                              className={styles.quickBtn} title="E-mail" onClick={(e) => e.stopPropagation()}>
                              <Mail size={11} />
                            </a>
                          )}
                          <button className={styles.removeBtn} onClick={() => notify('Em desenvolvimento')}><Trash2 size={13} /></button>
                        </div>
                      </div>
                    ))
                  }
                </div>
              </div>
            )}
            {detailTab === 'consumos' && (
              <div className={styles.subTabContent}>
                <Button variant="primary" size="sm" onClick={() => { setDetailConsumoCat(''); setDetailConsumoProd(''); setDetailConsumoQty(1); setDetailConsumoForma(''); setShowAddConsumoModal(true); }}>
                  <Plus size={13} /> Adicionar Consumo
                </Button>
                {(sv.consumos || []).length === 0
                  ? <div className={styles.emptyList}><ShoppingCart size={24} color="var(--text-2)" /><span>Nenhum consumo registrado</span></div>
                  : (
                    <div className={styles.itemList}>
                      {(sv.consumos || []).map((c, i) => (
                        <div key={c.id || i} className={styles.listItem}>
                          <div className={styles.listItemLeft}>
                            <ShoppingCart size={14} className={c.tipo === 'interno' ? styles.listItemIconGreen : styles.listItemIcon} />
                            <div>
                              <div className={styles.listItemName}>{c.item}</div>
                              <div className={styles.listItemSub}>{c.categoria} · Qtd: {c.quantidade}{c.formaPagamento ? ` · ${c.formaPagamento}` : ''}</div>
                            </div>
                          </div>
                          <span className={styles.listItemValue}>{fmtBRL(c.valorTotal)}</span>
                        </div>
                      ))}
                    </div>
                  )
                }
              </div>
            )}
            {detailTab === 'pagamentos' && (
              <div className={styles.subTabContent}>
                <Button variant="primary" size="sm" onClick={() => openPayModal(async (pag) => {
                  const updated = await overviewApi.adicionarPagamento(selectedRoom.id, pag);
                  setQuartos((prev) => prev.map((q) => q.id === updated.id ? updated : q));
                  notify(`Pagamento de ${fmtBRL(pag.valor)} registrado.`);
                }, s.servico?.titularNome)}>
                  <Plus size={13} /> Adicionar Pagamento
                </Button>
                <div className={styles.itemList}>
                  {(sv.pagamentos || []).length === 0
                    ? <div className={styles.emptyList}><CreditCard size={24} color="var(--text-2)" /><span>Nenhum pagamento registrado</span></div>
                    : (sv.pagamentos || []).map((p) => (
                      <div key={p.id} className={styles.listItem}>
                        <div className={styles.listItemLeft}>
                          <CreditCard size={14} className={styles.listItemIconGreen} />
                          <div>
                            <div className={styles.listItemName}>{p.descricao}</div>
                            <div className={styles.listItemSub}>{p.formaPagamento} · {p.data}</div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span className={[styles.listItemValue, styles.valueGreen].join(' ')}>{fmtBRL(p.valor)}</span>
                          <button className={styles.removeBtn} onClick={() => notify('Em desenvolvimento')}><Trash2 size={13} /></button>
                        </div>
                      </div>
                    ))
                  }
                </div>
              </div>
            )}
          </div>
        </>
      );
    }

    return null;
  };

  // ── Build detail modal footer ─────────────────────────────────────────────
  const renderDetailFooter = () => {
    if (!selectedRoom) return null;
    const s = selectedRoom;

    if (s.status === ROOM_STATUS.DISPONIVEL) {
      return (
        <div className={styles.footerBetween}>
          <div className={styles.footerLeft}>
            <Button variant="secondary" onClick={() => openService('limpeza', s)}><Sparkles size={14} /> Limpeza</Button>
            <Button variant="secondary" onClick={() => openService('manutencao', s)}><Wrench size={14} /> Manutenção</Button>
          </div>
          <div className={styles.footerRight}>
            <Button variant="secondary" className={styles.btnOrange} onClick={() => openNovoServico('pernoite', s)}>
              <BedDouble size={14} /> Novo Pernoite
            </Button>
            <Button variant="primary" onClick={() => openNovoServico('dayuse', s)}>
              <Clock size={14} /> Novo Day Use
            </Button>
          </div>
        </div>
      );
    }

    if (s.status === ROOM_STATUS.LIMPEZA) {
      return (
        <div className={styles.footerRight}>
          <Button variant="secondary" onClick={closeDetail}>Fechar</Button>
          <Button variant="primary" className={styles.btnGreen} onClick={() => handleMarcarDisponivel(s)} disabled={saving}>
            {saving && <Loader2 size={14} className={styles.spin} />}
            <BedDouble size={14} /> Marcar Disponível
          </Button>
        </div>
      );
    }

    if (s.status === ROOM_STATUS.MANUTENCAO || s.status === ROOM_STATUS.FORA_DE_SERVICO) {
      return (
        <div className={styles.footerRight}>
          <Button variant="secondary" onClick={closeDetail}>Fechar</Button>
          <Button variant="primary" className={styles.btnGreen} onClick={() => handleMarcarDisponivel(s)} disabled={saving}>
            {saving && <Loader2 size={14} className={styles.spin} />}
            <BedDouble size={14} /> Marcar Disponível
          </Button>
        </div>
      );
    }

    if (s.status === ROOM_STATUS.RESERVADO) {
      return (
        <div className={styles.footerRight}>
          <Button variant="danger" onClick={() => setConfirmModal({ action: 'cancelar' })}>
            <XCircle size={14} /> Cancelar Reserva
          </Button>
          <Button variant="primary" onClick={() => openNovoServico('pernoite', s)}>
            <BedDouble size={14} /> Iniciar Pernoite
          </Button>
        </div>
      );
    }

    if (s.servico?.tipo === 'pernoite') {
      return (
        <div className={styles.footerBetween}>
          <div className={styles.footerLeft}>
            <Button variant="danger" onClick={() => setConfirmModal({ action: 'cancelar' })}>
              <XCircle size={14} /> Cancelar
            </Button>
          </div>
          <div className={styles.footerRight}>
            <Button variant="primary" onClick={() => setConfirmModal({ action: 'finalizar' })} disabled={saving}>
              {saving && <Loader2 size={14} className={styles.spin} />}
              <CheckCircle size={14} /> Finalizar
            </Button>
          </div>
        </div>
      );
    }

    if (s.servico?.tipo === 'dayuse') {
      const sv = s.servico;
      const isAtivo     = sv.status === DAYUSE_STATUS.ATIVO;
      const isEncerrado = sv.status === DAYUSE_STATUS.ENCERRADO;
      return (
        <div className={styles.footerBetween}>
          <div className={styles.footerLeft}>
            <Button variant="danger" onClick={() => setConfirmModal({ action: 'cancelar' })}>
              <XCircle size={14} /> Cancelar
            </Button>
            {isEncerrado && (
              <Button variant="secondary" onClick={() => openService('limpeza', s)}>
                <Sparkles size={14} /> Limpeza
              </Button>
            )}
          </div>
          <div className={styles.footerRight}>
            {isAtivo && (
              <Button variant="primary" onClick={() => setEncerrarModal(true)}>
                <Square size={14} /> Encerrar tempo
              </Button>
            )}
            {isEncerrado && (
              <>
                <Button variant="secondary" onClick={() => {
                  setDescontoScope('global'); setDescontoTipo('percentual');
                  setDescontoValor(''); setDescontoDescricao('');
                  setShowDescontoModal(true);
                }}>
                  <Tag size={14} /> Desconto
                </Button>
                <Button variant="primary" onClick={() => setConfirmModal({ action: 'finalizar' })} disabled={saving}>
                  {saving && <Loader2 size={14} className={styles.spin} />}
                  <CheckCircle size={14} /> Finalizar
                </Button>
              </>
            )}
          </div>
        </div>
      );
    }

    return <div className={styles.footerRight}><Button variant="secondary" onClick={closeDetail}>Fechar</Button></div>;
  };

  // ── Detail modal title ────────────────────────────────────────────────────
  const renderDetailTitle = () => {
    if (!selectedRoom) return null;
    const s  = selectedRoom;
    const sk = roomStatusKey(s.status);
    const sv = s.servico;
    const mainLine = sv?.titularNome
      ? sv.titularNome
      : sv?.tipo === 'dayuse' ? 'Day Use em andamento'
      : `Apartamento ${s.numero}`;

    return (
      <div className={styles.detailModalTitle}>
        <div className={[styles.detailRoomBadge, styles[`detailBadge_${sk}`]].join(' ')}>
          {s.numero}
        </div>
        <div>
          <div className={[styles.detailTitular, !sv?.titularNome && sv?.tipo === 'dayuse' ? styles.detailTitularPending : ''].join(' ')}>
            {mainLine}
          </div>
          <div className={styles.detailMeta}>
            <span className={[styles.statusBadge, styles[`badge_${sk}`]].join(' ')}>{s.status}</span>
            <span className={styles.detailCategoria}>{s.categoria}</span>
            <span className={styles.detailSep}>·</span>
            <span className={styles.detailTipo}>{s.tipoOcupacao}</span>
            {sv?.periodo && <span className={styles.detailPeriodo}>{sv.periodo}</span>}
            {sv?.tipo === 'pernoite' && <span className={styles.pernoiteBadge}>Pernoite</span>}
            {sv?.tipo === 'dayuse'   && <span className={styles.dayuseBadge}>Day Use</span>}
          </div>
        </div>
      </div>
    );
  };

  // ── Room Row ──────────────────────────────────────────────────────────────
  const RoomRow = ({ room }) => {
    const sk        = roomStatusKey(room.status);
    const sv        = room.servico;
    const isDuAtivo = sv?.tipo === 'dayuse' && sv.status === DAYUSE_STATUS.ATIVO;
    const elapsed   = isDuAtivo ? calcElapsedMinutes(sv.dataUso, sv.horaEntrada, null) : 0;

    let nameNode;
    if (room.status === ROOM_STATUS.DISPONIVEL) {
      nameNode = <span className={styles.roomName}>{room.tipoOcupacao}</span>;
    } else if (room.status === ROOM_STATUS.LIMPEZA) {
      nameNode = <span className={styles.roomName}>Em Limpeza</span>;
    } else if (room.status === ROOM_STATUS.MANUTENCAO) {
      nameNode = <span className={styles.roomName}>Manutenção</span>;
    } else if (room.status === ROOM_STATUS.FORA_DE_SERVICO) {
      nameNode = <span className={styles.roomName}>Fora de Serviço</span>;
    } else if (sv?.tipo === 'dayuse') {
      const duName = sv.status === DAYUSE_STATUS.ENCERRADO   ? 'Day use encerrado'
                   : sv.status === DAYUSE_STATUS.FINALIZADO  ? 'Day use finalizado'
                   : sv.titularNome || 'Day Use em andamento';
      nameNode = <span className={sv.status === DAYUSE_STATUS.ATIVO && !sv.titularNome ? styles.roomNamePending : styles.roomName}>{duName}</span>;
    } else if (sv?.titularNome) {
      nameNode = <span className={styles.roomName}>{sv.titularNome}</span>;
    } else {
      nameNode = <span className={styles.roomNamePending}>—</span>;
    }

    const guestCount = sv?.hospedes?.length ?? 0;
    const hasDesconto = !!(sv?.desconto?.valor);

    let metaNode = null;
    if (room.status === ROOM_STATUS.DISPONIVEL) {
      metaNode = <BedsRow camas={room.camas} />;
    } else if (sv?.tipo === 'pernoite') {
      metaNode = (
        <div>
          <div className={styles.metaRow}>
            <Calendar size={12} /><span>{sv.periodo}</span>
          </div>
          <div className={styles.metaServiceBadge}>
            {guestCount > 0 && <span className={styles.guestCountBadge}><Users size={11} />{guestCount}</span>}
            {sv.totalDiarias > 0 && (
              <span className={styles.diariaBadge}><Calendar size={10} />{sv.diariaAtual}/{sv.totalDiarias}</span>
            )}
            <span className={styles.pernoiteBadge}>Pernoite</span>
            {hasDesconto && (
              <span className={styles.descontoBadge}>
                <Tag size={9} />
                {sv.desconto.tipo === 'percentual' ? `${sv.desconto.valor}%` : fmtBRL(sv.desconto.valor)}
              </span>
            )}
            {sv.pagamentoPendente > 0 && <span className={styles.metaPendente}>• {fmtBRL(sv.pagamentoPendente)}</span>}
          </div>
        </div>
      );
    } else if (sv?.tipo === 'dayuse') {
      metaNode = (
        <div>
          <div className={styles.metaRow}>
            {isDuAtivo
              ? <><Clock size={12} /><span className={styles.timerLive}>{sv.horaEntrada} · {fmtElapsed(elapsed)}</span></>
              : <><Clock size={12} /><span>{sv.horaEntrada}{sv.horaSaida ? ` → ${sv.horaSaida} (${fmtElapsed(calcElapsedMinutes(sv.dataUso, sv.horaEntrada, sv.horaSaida))})` : ''}</span></>
            }
            {sv.pagamentoPendente > 0 && <span className={styles.metaPendente}>• Pendente: {fmtBRL(sv.pagamentoPendente)}</span>}
          </div>
          <div className={styles.metaServiceBadge}>
            {guestCount > 0 && <span className={styles.guestCountBadge}><Users size={11} />{guestCount}</span>}
            <span className={styles.dayuseBadge}>Day Use</span>
            {hasDesconto && (
              <span className={styles.descontoBadge}>
                <Tag size={9} />
                {sv.desconto.tipo === 'percentual' ? `${sv.desconto.valor}%` : fmtBRL(sv.desconto.valor)}
              </span>
            )}
          </div>
        </div>
      );
    } else if (sv?.tipo === 'reserva') {
      metaNode = <div className={styles.metaRow}><Calendar size={12} /><span>{sv.chegadaPrevista}</span></div>;
    } else if (room.status === ROOM_STATUS.LIMPEZA && room.limpeza) {
      metaNode = <div className={styles.metaRow}><User size={12} /><span>{room.limpeza.responsavel || 'Sem responsável'}</span></div>;
    } else if ((room.status === ROOM_STATUS.MANUTENCAO || room.status === ROOM_STATUS.FORA_DE_SERVICO) && room.manutencao) {
      metaNode = <div className={styles.metaRow}><Wrench size={12} /><span>{room.manutencao.responsavel || '—'}</span><span className={styles.metaDesc}>{room.manutencao.descricao ? ` · ${room.manutencao.descricao.slice(0, 35)}` : ''}</span></div>;
    }

    return (
      <div className={[styles.roomRow, styles[`roomRow_${sk}`]].join(' ')} onClick={() => openDetail(room)}>
        <div className={styles.roomRowLeft}>
          <div className={[styles.roomNumBadge, styles[`numBadge_${sk}`]].join(' ')}>{room.numero}</div>
          <div className={styles.roomRowInfo}>
            {nameNode}
            {metaNode}
          </div>
        </div>
        <div className={styles.roomRowRight}>
          <span className={[styles.statusBadge, styles[`badge_${sk}`]].join(' ')}>{room.status}</span>
        </div>
      </div>
    );
  };

  // ── Hospede search result component ──────────────────────────────────────────
  const HospedeResults = ({ results, onAdd }) =>
    results.length === 0 ? null : (
      <div className={styles.hospedeResults}>
        {results.map((h) => (
          <div key={h.id} className={styles.hospedeResult} onClick={() => onAdd(h)}>
            <span className={styles.hospedeResultName}>{h.nome}</span>
            <span className={styles.hospedeResultSub}>{h.cpf} · {h.telefone}</span>
          </div>
        ))}
      </div>
    );

  // ── Main render ───────────────────────────────────────────────────────────────
  return (
    <div className={styles.page}>
      <Notification notification={notif} />

      {/* ── Stats bar ── */}
      <div className={styles.statsBar}>
        <div className={styles.statCards}>
          <div className={styles.statCard}>
            <Users size={16} className={styles.statCardIconGreen} />
            <div className={styles.statCardBody}>
              <span className={styles.statCardValue}>{totalHospedados}</span>
              <span className={styles.statCardLabel}>hospedado{totalHospedados !== 1 ? 's' : ''}</span>
            </div>
          </div>
          <div className={styles.statCard}>
            <BedDouble size={16} className={styles.statCardIconAmber} />
            <div className={styles.statCardBody}>
              <span className={styles.statCardValue}>{quartosOcupados}/{quartos.length}</span>
              <span className={styles.statCardLabel}>ocupação</span>
            </div>
          </div>
        </div>
        <div className={styles.statsBarActions}>
          <Select value={filterTipoOcupacao} onChange={(e) => setFilterTipoOcupacao(e.target.value)} className={styles.tipoSelectBar}>
            <option value="">Tipo de ocupação</option>
            {TIPOS_OCUPACAO.map((t) => <option key={t} value={t}>{t}</option>)}
          </Select>
          <div className={styles.dateRangeWrap}>
            <DatePicker
              mode="range"
              startDate={filterDateStart}
              endDate={filterDateEnd}
              onRangeChange={({ start, end }) => {
                setFilterDateStart(start);
                setFilterDateEnd(end);
                setDateGroupCollapsed({});
              }}
              placeholder="Período de check-in..."
            />
          </div>
          <Button
            variant="secondary"
            className={[styles.btnClearFilters, hasActiveFilters ? styles.btnClearFiltersActive : ''].join(' ')}
            onClick={clearAllFilters}
          >
            <X size={12} /> Limpar filtros
          </Button>
          <Button variant="primary" onClick={() => setShowAddQuarto(true)}>
            <Plus size={14} /> Adicionar Quarto
          </Button>
        </div>
      </div>

      <div className={styles.card}>
        {/* ── Header ── */}
        <div className={styles.tableHeader}>
          <div>
            <h2 className={styles.h2}>Recepção</h2>
            <p className={styles.subtitle}>
              <Building2 size={13} /> Visão geral de quartos, hóspedes e day use
            </p>
          </div>
          <div className={styles.searchWrap}>
            <Search size={13} className={styles.searchIcon} />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nº ou hóspede..." className={styles.searchInput} />
          </div>
        </div>

        {/* ── Filter tabs ── */}
        <div className={styles.filterTabs}>
          {FILTER_OPTIONS.map((f) => (
            <button
              key={f.id}
              className={[styles.filterTab, statusFilter === f.id ? styles.filterTabActive : ''].join(' ')}
              onClick={() => setStatusFilter(f.id)}
            >
              {f.label}
              {filterCounts[f.id] != null && <span className={styles.filterCount}>{filterCounts[f.id]}</span>}
            </button>
          ))}
        </div>

        {/* ── Category / Date groups ── */}
        {loading ? (
          <div className={styles.emptyState}><Loader2 size={28} className={styles.spin} /> Carregando...</div>
        ) : isDateFilterActive ? (
          /* ── Date-sorted view (when date range active) ── */
          dateGroups.length === 0
            ? <div className={styles.emptyState}>Nenhum pernoite encontrado neste período.</div>
            : dateGroups.map((group) => (
              <div key={group.date} className={styles.dateSection}>
                <button className={styles.dateGroupHeader} onClick={() => toggleDateGroup(group.date)}>
                  <div className={styles.dateGroupHeaderLeft}>
                    <ChevronDown size={14} className={[styles.catChevron, isDateGroupCollapsed(group.date) ? styles.catChevronClosed : ''].join(' ')} />
                    <Calendar size={13} style={{ color: 'var(--text-2)' }} />
                    <span className={styles.dateGroupTitle}>Check-in {group.date}</span>
                  </div>
                  <span className={styles.dateGroupCount}>{group.rooms.length} quarto{group.rooms.length !== 1 ? 's' : ''}</span>
                </button>
                {!isDateGroupCollapsed(group.date) && (
                  <div className={styles.catBody}>
                    {group.rooms.map((room) => <RoomRow key={room.id} room={room} />)}
                  </div>
                )}
              </div>
            ))
        ) : (
          /* ── Normal category view ── */
          byCategory.map((cat) => (
            <div key={cat.id} className={styles.catSection}>
              <div className={styles.catHeader} onClick={() => toggleCollapse(cat.id)}>
                <div className={styles.catHeaderLeft}>
                  <ChevronDown size={15} className={[styles.catChevron, collapsed[cat.id] ? styles.catChevronClosed : ''].join(' ')} />
                  {collapsed[cat.id] ? (
                    <span className={styles.catName} style={{ marginRight: 0 }}>{cat.nome}</span>
                  ) : (
                    <div>
                      <span className={styles.catName}>{cat.nome}</span>
                      <span className={styles.catDesc}>{cat.descricao}</span>
                    </div>
                  )}
                </div>
                {collapsed[cat.id] ? (
                  <div className={styles.catStatsMini}>
                    <span className={[styles.catStatMini, styles.catStatMiniGreen].join(' ')}>
                      <BedDouble size={12} />{cat.disponiveis}
                    </span>
                    {cat.ocupados > 0 && (
                      <span className={[styles.catStatMini, styles.catStatMiniAmber].join(' ')}>
                        <Users size={12} />{cat.ocupados}
                      </span>
                    )}
                    {cat.emServico > 0 && (
                      <span className={[styles.catStatMini, styles.catStatMiniSlate].join(' ')}>
                        <Wrench size={12} />{cat.emServico}
                      </span>
                    )}
                  </div>
                ) : (
                  <div className={styles.catStats}>
                    <span className={[styles.catStat, styles.catStatGreen].join(' ')}>{cat.disponiveis} disponíveis</span>
                    <span className={[styles.catStat, styles.catStatAmber].join(' ')}>{cat.ocupados} ocupados/reservados</span>
                    {cat.emServico > 0 && <span className={[styles.catStat, styles.catStatSlate].join(' ')}>{cat.emServico} em serviço</span>}
                    <span className={styles.catTotal}>{cat.total} quartos</span>
                  </div>
                )}
              </div>
              {!collapsed[cat.id] && (
                <div className={styles.catBody}>
                  {cat.rooms.length === 0
                    ? <div className={styles.catEmpty}>Nenhum quarto com os filtros aplicados.</div>
                    : cat.rooms.map((room) => <RoomRow key={room.id} room={room} />)
                  }
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════
          MODAL — Detalhe do Quarto
      ═══════════════════════════════════════════════════════ */}
      {selectedRoom && (
        <Modal
          open={!!selectedRoom}
          onClose={closeDetail}
          size="lg"
          title={renderDetailTitle()}
          footer={renderDetailFooter()}
        >
          {renderDetailContent()}
        </Modal>
      )}

      {/* ═══════════════════════════════════════════════════════
          MODAL — Nova Hospedagem (Novo Pernoite)
      ═══════════════════════════════════════════════════════ */}
      {novoModal === 'pernoite' && novoRoom && (
        <Modal
          open
          onClose={() => setNovoModal(null)}
          size="lg"
          title={<><BedDouble size={15} /> Nova Hospedagem — Apt. {novoRoom.numero} <span style={{ fontWeight: 400, fontSize: 12, color: 'var(--text-2)', marginLeft: 6 }}>{novoRoom.categoria} · {novoRoom.tipoOcupacao}</span></>}
          footer={
            <div className={styles.modalFooterRow}>
              {nhStep > 0 && (
                <Button variant="secondary" onClick={() => setNhStep((s) => s - 1)}>← Voltar</Button>
              )}
              <div style={{ flex: 1 }} />
              <Button variant="secondary" onClick={() => setNovoModal(null)}>Cancelar</Button>
              {nhStep < 2 ? (
                <Button variant="primary" onClick={() => setNhStep((s) => s + 1)}>
                  Próximo →
                </Button>
              ) : (
                <Button variant="primary" onClick={handleCriarPernoite} disabled={savingNh || !nhCheckinDate || !nhCheckoutDate}>
                  {savingNh && <Loader2 size={14} className={styles.spin} />}
                  Criar Hospedagem
                </Button>
              )}
            </div>
          }
          bodyStyle={{ padding: 0, gap: 0 }}
        >
          {/* ── Resumo financeiro fixo no topo ── */}
          <div className={styles.nhFinancialFixed}>
            <div className={styles.financialGrid}>
              <div className={styles.financialItem}>
                <span className={styles.financialLabel}>Total</span>
                <span className={styles.financialValue}>{fmtBRL(nhTotalHosp)}</span>
                <span style={{ fontSize: 10, color: 'var(--text-2)' }}>{nhTotalDias}d × {fmtBRL(nhPrecoDiaria)}</span>
              </div>
              <div className={styles.financialItem}>
                <span className={styles.financialLabel}>Pago</span>
                <span className={[styles.financialValue, styles.valueGreen].join(' ')}>{fmtBRL(nhTotalPago)}</span>
              </div>
              <div className={styles.financialItem}>
                <span className={styles.financialLabel}>Pendente</span>
                <span className={[styles.financialValue, nhPendente > 0 ? styles.valueAmber : styles.valueGreen].join(' ')}>{fmtBRL(nhPendente)}</span>
              </div>
            </div>
          </div>

          {/* ── Step tabs ── */}
          <div className={styles.nhStepTabs}>
            {[
              [0, 'Hóspedes'],
              [1, 'Período'],
              [2, 'Pagamentos'],
            ].map(([idx, label]) => (
              <button
                key={idx}
                className={[styles.nhStepTab, nhStep === idx ? styles.nhStepTabActive : ''].join(' ')}
                onClick={() => setNhStep(idx)}
              >
                <span className={styles.nhStepNum}>{idx + 1}</span>
                {label}
              </button>
            ))}
          </div>

          {/* ── Step 0: Hóspedes ── */}
          {nhStep === 0 && (
            <div className={styles.nhStepContent}>
              <Input value={nhHospedeSearch} onChange={(e) => setNhHospedeSearch(e.target.value)} placeholder="Buscar hóspede cadastrado..." />
              {nhPersonResults.length > 0 && (
                <div className={styles.guestList}>
                  {nhPersonResults.map((h) => (
                    <button
                      key={h.id}
                      className={[styles.guestItem, nhHospedes.some((x) => x.id === h.id) ? styles.guestItemActive : ''].join(' ')}
                      onClick={() => {
                        if (!nhHospedes.some((x) => x.id === h.id)) {
                          setNhHospedes((p) => [...p, h]);
                        }
                        setNhHospedeSearch('');
                      }}
                    >
                      <span className={styles.guestName}>{h.nome}</span>
                      <span className={styles.guestSub}>{h.cpf} · {h.telefone}</span>
                    </button>
                  ))}
                </div>
              )}
              {nhHospedes.length > 0 && (
                <div className={styles.itemList}>
                  {nhHospedes.map((h, i) => (
                    <div key={h.id} className={styles.listItem}>
                      <div className={styles.listItemLeft}>
                        <User size={14} className={i === 0 ? styles.listItemIconGreen : styles.listItemIcon} />
                        <div>
                          <div className={styles.listItemName}>{h.nome} {i === 0 && <span className={styles.titularTag}>Titular</span>}</div>
                          <div className={styles.listItemSub}>{h.cpf} · {h.telefone}</div>
                        </div>
                      </div>
                      <button className={styles.removeBtn} onClick={() => setNhHospedes((p) => p.filter((x) => x.id !== h.id))}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Step 1: Período ── */}
          {nhStep === 1 && (
            <div className={styles.nhStepContent}>
              <div className={styles.grid2}>
                <FormField label="Check-in *">
                  <DatePicker mode="single" value={nhCheckinDate} onChange={setNhCheckinDate} />
                </FormField>
                <FormField label="Hora">
                  <TimeInput value={nhCheckinHora} onChange={setNhCheckinHora} />
                </FormField>
              </div>
              <div className={styles.grid2}>
                <FormField label="Check-out *">
                  <DatePicker mode="single" value={nhCheckoutDate} onChange={setNhCheckoutDate} minDate={nhCheckinDate} />
                </FormField>
                <FormField label="Hora">
                  <TimeInput value={nhCheckoutHora} onChange={setNhCheckoutHora} />
                </FormField>
              </div>
              {nhCheckinDate && nhCheckoutDate && (
                <div className={styles.totalPreview}>
                  <span className={styles.totalPreviewLabel}>{nhTotalDias} diária{nhTotalDias !== 1 ? 's' : ''} × {fmtBRL(nhPrecoDiaria)}</span>
                  <span className={styles.totalPreviewValue}>{fmtBRL(nhTotalHosp)}</span>
                </div>
              )}
            </div>
          )}

          {/* ── Step 2: Pagamentos ── */}
          {nhStep === 2 && (
            <div className={styles.nhStepContent}>
              <div className={styles.pagamentoResume}>
                <div className={styles.pagamentoResumeRow}><span>Total da hospedagem</span><span>{fmtBRL(nhTotalHosp)}</span></div>
                <div className={[styles.pagamentoResumeRow, styles.pagamentoResumeTotal].join(' ')}>
                  <span>Pendente</span>
                  <span style={{ color: nhPendente > 0 ? '#d97706' : '#059669' }}>{fmtBRL(nhPendente)}</span>
                </div>
              </div>
              {nhPagamentos.map((p, i) => (
                <div key={i} className={styles.listItem}>
                  <div className={styles.listItemLeft}>
                    <CreditCard size={14} className={styles.listItemIconGreen} />
                    <div>
                      <div className={styles.listItemName}>{p.descricao}</div>
                      <div className={styles.listItemSub}>{p.forma}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className={[styles.listItemValue, styles.valueGreen].join(' ')}>{fmtBRL(p.valor)}</span>
                    <button className={styles.removeBtn} onClick={() => setNhPagamentos((prev) => prev.filter((_, j) => j !== i))}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
              <div className={styles.grid2} style={{ marginTop: 8 }}>
                <FormField label="Descrição">
                  <Input value={nhPagDesc} onChange={(e) => setNhPagDesc(e.target.value)} placeholder="Ex: Entrada..." />
                </FormField>
                <FormField label="Forma">
                  <Select value={nhPagForma} onChange={(e) => setNhPagForma(e.target.value)}>
                    {FORMAS_PAGAMENTO.map((f) => <option key={f} value={f}>{f}</option>)}
                  </Select>
                </FormField>
              </div>
              <div className={styles.grid2}>
                <FormField label="Valor">
                  <Input value={nhPagValor} onChange={(e) => setNhPagValor(maskBRL(e.target.value))} placeholder="R$ 0,00" />
                </FormField>
                <FormField label=" ">
                  <Button variant="secondary" onClick={() => {
                    const v = parseBRL(nhPagValor);
                    if (!v || !nhPagDesc.trim()) return;
                    setNhPagamentos((p) => [...p, { descricao: nhPagDesc, forma: nhPagForma, valor: v }]);
                    setNhPagDesc(''); setNhPagValor('');
                  }}>Adicionar</Button>
                </FormField>
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* ═══════════════════════════════════════════════════════
          MODAL — Novo Day Use
      ═══════════════════════════════════════════════════════ */}
      {novoModal === 'dayuse' && novoRoom && (
        <Modal
          open
          onClose={() => setNovoModal(null)}
          size="sm"
          title={<><Clock size={15} /> Novo Day Use — Apt. {novoRoom.numero}</>}
          footer={
            <div className={styles.footerRight}>
              <Button variant="secondary" onClick={() => setNovoModal(null)}>Cancelar</Button>
              <Button variant="primary" onClick={handleCriarDayUse} disabled={saving || !nduForm.horaEntrada}>
                {saving && <Loader2 size={14} className={styles.spin} />}
                Iniciar Day Use
              </Button>
            </div>
          }
        >
          <div className={styles.formStack}>
            {(() => { const p = DAY_USE_PRICING[novoRoom.categoria]; return (
              <div className={styles.pricingHint}>
                <span className={styles.pricingHintLabel}>{novoRoom.categoria}</span>
                <span><strong>{fmtBRL(p?.precoBase)}</strong> base ({p?.horasBase}h)</span>
                <span>+ {fmtBRL(p?.precoAdicional)}/h adicional</span>
              </div>
            ); })()}

            <FormField label="Data de uso">
              <Input value={todayDisplay()} disabled />
            </FormField>
            <FormField label="Hora de entrada *">
              <TimeInput value={nduForm.horaEntrada} onChange={(v) => setNduForm((f) => ({ ...f, horaEntrada: v }))} />
            </FormField>

            <FormField label="Hóspede (opcional)">
              <Input value={nduForm.hospedeSearch} onChange={(e) => setNduForm((f) => ({ ...f, hospedeSearch: e.target.value }))} placeholder="Buscar hóspede cadastrado..." />
              <HospedeResults results={nduHosp} onAdd={addNduHospede} />
              {nduForm.hospedes.length > 0 && (
                <div className={styles.hospedeChips}>
                  {nduForm.hospedes.map((h, i) => (
                    <span key={h.id} className={[styles.hospedeChip, i === 0 ? styles.hospedeChipTitular : ''].join(' ')}>
                      {h.nome}
                      <button className={styles.chipRemove} onClick={() => remNduHospede(h.id)}><XCircle size={12} /></button>
                    </span>
                  ))}
                </div>
              )}
            </FormField>
          </div>
        </Modal>
      )}

      {/* ═══════════════════════════════════════════════════════
          MODAL — Encerrar Day Use
      ═══════════════════════════════════════════════════════ */}
      {encerrarModal && selectedRoom?.servico?.tipo === 'dayuse' && (
        <Modal
          open
          onClose={() => setEncerrarModal(false)}
          size="sm"
          title={<><Square size={15} /> Encerrar Day Use — Apt. {selectedRoom.numero}</>}
          footer={
            <div className={styles.footerRight}>
              <Button variant="secondary" onClick={() => setEncerrarModal(false)}>Cancelar</Button>
              <Button variant="primary" onClick={handleEncerrar} disabled={saving}>
                {saving && <Loader2 size={14} className={styles.spin} />}
                Confirmar Encerramento
              </Button>
            </div>
          }
        >
          <div className={styles.encerrarSummary}>
            <div className={styles.encerrarRow}>
              <span className={styles.encerrarLabel}>Hora de saída</span>
              <span className={styles.encerrarVal}>{nowTime()}</span>
            </div>
            <div className={styles.encerrarRow}>
              <span className={styles.encerrarLabel}>Tempo decorrido</span>
              <span className={styles.encerrarVal}>{fmtClock(selElapsedSec)}</span>
            </div>
            <div className={styles.encerrarRow}>
              <span className={styles.encerrarLabel}>Valor base ({selectedRoom.servico.horasBase}h)</span>
              <span className={styles.encerrarVal}>{fmtBRL(selectedRoom.servico.precoBase)}</span>
            </div>
            {selElapsedMin > selectedRoom.servico.horasBase * 60 && (
              <div className={styles.encerrarRow}>
                <span className={styles.encerrarLabel}>Horas adicionais</span>
                <span className={styles.encerrarVal}>{fmtBRL(selValorAtual - selectedRoom.servico.precoBase)}</span>
              </div>
            )}
            <div className={styles.encerrarRow}>
              <span className={styles.encerrarLabel}>Total a cobrar</span>
              <span className={styles.encerrarValGreen}>{fmtBRL(selValorAtual)}</span>
            </div>
          </div>
        </Modal>
      )}

      {/* ═══════════════════════════════════════════════════════
          MODAL — Minibar: Adicionar Item
      ═══════════════════════════════════════════════════════ */}
      {showAddMinibar && selectedRoom && (() => {
        const minibarCatSel  = CATEGORIAS_CONSUMO.find((c) => c.id === parseInt(minibarCat));
        const minibarProdSel = minibarCatSel?.produtos.find((p) => p.id === parseInt(minibarProd));
        return (
          <Modal
            open
            onClose={() => setShowAddMinibar(false)}
            size="sm"
            title={<><Plus size={15} /> Adicionar ao Minibar — Apt. {selectedRoom.numero}</>}
            footer={
              <div className={styles.footerRight}>
                <Button variant="secondary" onClick={() => setShowAddMinibar(false)}>Cancelar</Button>
                <Button variant="primary" onClick={handleAddMinibarItem} disabled={savingMinibar || !minibarProdSel}>
                  {savingMinibar && <Loader2 size={14} className={styles.spin} />}
                  Adicionar
                </Button>
              </div>
            }
          >
            <div className={styles.formStack}>
              <FormField label="Categoria *">
                <Select value={minibarCat} onChange={(e) => { setMinibarCat(e.target.value); setMinibarProd(''); }}>
                  <option value="">Selecione...</option>
                  {CATEGORIAS_CONSUMO.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </Select>
              </FormField>
              {minibarCatSel && (
                <FormField label="Produto *">
                  <Select value={minibarProd} onChange={(e) => setMinibarProd(e.target.value)}>
                    <option value="">Selecione...</option>
                    {minibarCatSel.produtos.map((p) => <option key={p.id} value={p.id}>{p.nome} — {fmtBRL(p.preco)}</option>)}
                  </Select>
                </FormField>
              )}
              {minibarProdSel && (
                <>
                  <FormField label="Quantidade a adicionar *">
                    <Input type="number" min="1" max="50" value={minibarQtyAdd} onChange={(e) => setMinibarQtyAdd(Math.max(1, parseInt(e.target.value) || 1))} />
                  </FormField>
                  <div className={styles.totalPreview}>
                    <span className={styles.totalPreviewLabel}>{minibarQtyAdd}× {minibarProdSel.nome}</span>
                    <span className={styles.totalPreviewValue}>{fmtBRL(minibarProdSel.preco * minibarQtyAdd)}</span>
                  </div>
                </>
              )}
            </div>
          </Modal>
        );
      })()}

      {/* ═══════════════════════════════════════════════════════
          MODAL — Pagamento Unificado
      ═══════════════════════════════════════════════════════ */}
      {payModal && (
        <Modal
          open
          onClose={() => setPayModal(false)}
          size="sm"
          title={<><CreditCard size={15} /> Registrar Pagamento</>}
          footer={
            <div className={styles.footerRight}>
              <Button variant="secondary" onClick={() => setPayModal(false)}>Cancelar</Button>
              <Button variant="primary" onClick={handlePayConfirm} disabled={saving}>
                {saving && <Loader2 size={14} className={styles.spin} />}
                Confirmar
              </Button>
            </div>
          }
        >
          <div className={styles.formStack}>
            {selectedRoom?.servico?.pagamentoPendente > 0 && (
              <div className={styles.pricingHint}>
                <span className={styles.pricingHintLabel}>Pendente:</span>
                <strong className={styles.textAmber}>{fmtBRL(selectedRoom.servico.pagamentoPendente)}</strong>
              </div>
            )}
            <FormField label="Nome do pagador *">
              <Input value={payNomePagador} onChange={(e) => setPayNomePagador(e.target.value)} placeholder="Nome do responsável pelo pagamento" />
            </FormField>
            {selectedRoom?.servico?.titularNome && (
              <label className={styles.payCheckboxRow}>
                <input type="checkbox" checked={payAutoFill} onChange={(e) => {
                  setPayAutoFill(e.target.checked);
                  if (e.target.checked) setPayNomePagador(selectedRoom.servico.titularNome);
                  else setPayNomePagador('');
                }} />
                Usar nome do titular ({selectedRoom.servico.titularNome})
              </label>
            )}
            <FormField label="Descrição *">
              <Input value={payDescricao} onChange={(e) => setPayDescricao(e.target.value)} placeholder="Ex: Pagamento final, Entrada 50%..." />
            </FormField>
            <FormField label="Forma de Pagamento *">
              <Select value={payTipo} onChange={(e) => setPayTipo(e.target.value)}>
                <option value="">Selecione...</option>
                {FORMAS_PAGAMENTO.map((fp) => <option key={fp} value={fp}>{fp}</option>)}
              </Select>
            </FormField>
            <FormField label="Valor *">
              <Input value={payValor} onChange={(e) => setPayValor(maskBRL(e.target.value))} placeholder="R$ 0,00" />
            </FormField>
          </div>
        </Modal>
      )}

      {/* ═══════════════════════════════════════════════════════
          MODAL — Adicionar Pagamento
      ═══════════════════════════════════════════════════════ */}
      {pagModal && selectedRoom && (
        <Modal
          open
          onClose={() => setPagModal(false)}
          size="sm"
          title={<><CreditCard size={15} /> Registrar Pagamento</>}
          footer={
            <div className={styles.footerRight}>
              <Button variant="secondary" onClick={() => setPagModal(false)}>Cancelar</Button>
              <Button variant="primary" onClick={handleAddPagamento} disabled={saving}>
                {saving && <Loader2 size={14} className={styles.spin} />}
                Confirmar
              </Button>
            </div>
          }
        >
          <div className={styles.formStack}>
            <div className={styles.pricingHint}>
              <span className={styles.pricingHintLabel}>Pendente:</span>
              <strong className={styles.textAmber}>{fmtBRL(selectedRoom.servico?.pagamentoPendente)}</strong>
            </div>
            <FormField label="Descrição *">
              <Input value={pagForm.descricao} onChange={(e) => setPagForm((f) => ({ ...f, descricao: e.target.value }))} placeholder="Ex: Pagamento final, Entrada..." />
            </FormField>
            <FormField label="Forma de Pagamento *">
              <Select value={pagForm.formaPagamento} onChange={(e) => setPagForm((f) => ({ ...f, formaPagamento: e.target.value }))}>
                {FORMAS_PAGAMENTO.map((fp) => <option key={fp} value={fp}>{fp}</option>)}
              </Select>
            </FormField>
            <FormField label="Valor *">
              <Input value={pagForm.valor} onChange={(e) => setPagForm((f) => ({ ...f, valor: maskBRL(e.target.value) }))} placeholder="R$ 0,00" />
            </FormField>
          </div>
        </Modal>
      )}

      {/* ═══════════════════════════════════════════════════════
          MODAL — Acionar Serviço (Limpeza / Manutenção / Fora)
      ═══════════════════════════════════════════════════════ */}
      {serviceModal && (
        <Modal
          open
          onClose={() => setServiceModal(null)}
          size="sm"
          title={
            serviceModal.type === 'limpeza'
              ? <><Sparkles size={15} /> Acionar Limpeza — Apt. {serviceModal.room.numero}</>
              : serviceModal.type === 'manutencao'
              ? <><Wrench size={15} /> Acionar Manutenção — Apt. {serviceModal.room.numero}</>
              : <><AlertTriangle size={15} /> Fora de Serviço — Apt. {serviceModal.room.numero}</>
          }
          footer={
            <div className={styles.footerRight}>
              <Button variant="secondary" onClick={() => setServiceModal(null)}>Cancelar</Button>
              <Button variant="primary" onClick={handleService} disabled={saving}>
                {saving && <Loader2 size={14} className={styles.spin} />}
                Confirmar
              </Button>
            </div>
          }
        >
          <div className={styles.formStack}>
            <FormField label="Responsável">
              <Input value={svcForm.responsavel} onChange={(e) => setSvcForm((f) => ({ ...f, responsavel: e.target.value }))} placeholder="Nome do responsável (opcional)" />
            </FormField>
            <div className={styles.grid2}>
              <FormField label="Data/Hora de início">
                <Input type="datetime-local" value={svcForm.dataHoraInicio} onChange={(e) => setSvcForm((f) => ({ ...f, dataHoraInicio: e.target.value }))} />
              </FormField>
              <FormField label="Data/Hora de fim">
                <Input type="datetime-local" value={svcForm.dataHoraFim} onChange={(e) => setSvcForm((f) => ({ ...f, dataHoraFim: e.target.value }))} />
              </FormField>
            </div>
            {serviceModal.type !== 'limpeza' && (<>
              <FormField label="Descrição">
                <Input value={svcForm.descricao} onChange={(e) => setSvcForm((f) => ({ ...f, descricao: e.target.value }))} placeholder="Descreva o serviço a ser realizado" />
              </FormField>
              <FormField label="Previsão de término">
                <Input type="date" value={svcForm.previsaoFim} onChange={(e) => setSvcForm((f) => ({ ...f, previsaoFim: e.target.value }))} />
              </FormField>
            </>)}
          </div>
        </Modal>
      )}

      {/* ═══════════════════════════════════════════════════════
          MODAL — Adicionar Quarto
      ═══════════════════════════════════════════════════════ */}
      {showAddQuarto && (
        <Modal
          open
          onClose={() => setShowAddQuarto(false)}
          size="sm"
          title={<><Plus size={15} /> Adicionar Quarto</>}
          footer={
            <div className={styles.footerRight}>
              <Button variant="secondary" onClick={() => setShowAddQuarto(false)}>Cancelar</Button>
              <Button variant="primary" onClick={() => { notify('Funcionalidade em desenvolvimento.', 'info'); setShowAddQuarto(false); }}>Salvar</Button>
            </div>
          }
        >
          <div className={styles.formStack}>
            <FormField label="Número *">
              <Input placeholder="Ex: 23" />
            </FormField>
            <FormField label="Descrição">
              <Input placeholder="Descrição do quarto..." />
            </FormField>
            <FormField label="Categoria *">
              <Select>
                <option value="">Selecione...</option>
                <option>Standard</option>
                <option>Luxo</option>
                <option>Suíte</option>
              </Select>
            </FormField>
            <FormField label="Tipo de Ocupação *">
              <Select>
                <option value="">Selecione...</option>
                {TIPOS_OCUPACAO.map((t) => <option key={t}>{t}</option>)}
              </Select>
            </FormField>
            <FormField label="Qtd. máx. de pessoas">
              <Input type="number" min="1" max="10" placeholder="Ex: 2" />
            </FormField>
            <div className={styles.grid2}>
              <FormField label="Camas de casal">
                <Input type="number" min="0" placeholder="0" />
              </FormField>
              <FormField label="Camas solteiro">
                <Input type="number" min="0" placeholder="0" />
              </FormField>
            </div>
            <div className={styles.grid2}>
              <FormField label="Beliches">
                <Input type="number" min="0" placeholder="0" />
              </FormField>
              <FormField label="Redes">
                <Input type="number" min="0" placeholder="0" />
              </FormField>
            </div>
          </div>
        </Modal>
      )}

      {/* ═══════════════════════════════════════════════════════
          SUB-MODAL — Adicionar Hóspede (detail)
      ═══════════════════════════════════════════════════════ */}
      {showDetailAddHospede && (
        <Modal
          open
          onClose={() => setShowDetailAddHospede(false)}
          size="sm"
          title={<><User size={15} /> Adicionar Hóspede</>}
          footer={
            <div className={styles.footerRight}>
              <Button variant="secondary" onClick={() => setShowDetailAddHospede(false)}>Cancelar</Button>
              <Button
                variant="primary"
                disabled={!detailHospedeSelected}
                onClick={() => { notify('Em desenvolvimento'); setShowDetailAddHospede(false); }}
              >
                Adicionar
              </Button>
            </div>
          }
        >
          <div className={styles.formStack}>
            <Input
              value={detailHospedeSearch}
              onChange={(e) => { setDetailHospedeSearch(e.target.value); setDetailHospedeSelected(null); }}
              placeholder="Buscar por nome..."
            />
            {detailHospResults.length > 0 && (
              <div className={styles.guestList}>
                {detailHospResults.map((h) => (
                  <button
                    key={h.id}
                    className={[styles.guestItem, detailHospedeSelected?.id === h.id ? styles.guestItemActive : ''].join(' ')}
                    onClick={() => setDetailHospedeSelected(h)}
                  >
                    <span className={styles.guestName}>{h.nome}</span>
                    <span className={styles.guestSub}>{h.cpf} · {h.telefone}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* ═══════════════════════════════════════════════════════
          SUB-MODAL — Adicionar Consumo unificado (interno + externo)
      ═══════════════════════════════════════════════════════ */}
      {showAddConsumoModal && selectedRoom && (
        <Modal
          open
          onClose={() => setShowAddConsumoModal(false)}
          size="md"
          title={<><ShoppingCart size={15} /> Adicionar Consumo</>}
          footer={
            <div className={styles.footerRight}>
              <Button variant="secondary" onClick={() => setShowAddConsumoModal(false)}>Fechar</Button>
            </div>
          }
        >
          <div className={styles.consumoModalBody}>
            {/* ── Consumo interno (minibar) ── */}
            <div className={styles.consumoModalSection}>
              <div className={styles.consumoModalSectionTitle}><Package size={13} /> Consumo interno</div>
              {(!selectedRoom.minibar || selectedRoom.minibar.length === 0) ? (
                <div className={styles.emptyList}><Package size={20} color="var(--text-2)" /><span>Nenhum item no minibar</span></div>
              ) : (
                <div className={styles.minibarList}>
                  {selectedRoom.minibar.map((item) => {
                    const ratio   = item.qtdBase > 0 ? item.qtdAtual / item.qtdBase : 1;
                    const isLow   = ratio < 0.5;
                    const esgotado = item.qtdAtual === 0;
                    return (
                      <div key={item.produtoId} className={[styles.minibarCard, isLow ? styles.minibarCardLow : ''].join(' ')}>
                        <div className={styles.minibarCardLeft}>
                          <span className={styles.minibarCardName}>{item.nome}</span>
                          <div className={styles.minibarQtyRow}>
                            <span className={[styles.minibarQtyCurrent, isLow ? styles.minibarQtyLow : ''].join(' ')}>{item.qtdAtual}</span>
                            <span className={styles.minibarQtySep}>/</span>
                            <span className={styles.minibarQtyBase}>{item.qtdBase} disp.</span>
                          </div>
                        </div>
                        <div className={styles.minibarProgressWrap}>
                          <div className={styles.minibarProgressBar}>
                            <div className={[styles.minibarProgressFill, isLow ? styles.minibarProgressFillLow : ''].join(' ')}
                              style={{ width: `${Math.min(100, ratio * 100)}%` }} />
                          </div>
                        </div>
                        <div className={styles.minibarCardActions}>
                          <Button
                            variant="primary"
                            style={{ padding: '4px 12px', fontSize: 12 }}
                            disabled={esgotado || consumoSaving}
                            onClick={() => handleConsumoInterno(item)}
                          >
                            {consumoSaving ? <Loader2 size={12} className={styles.spin} /> : <Minus size={12} />}
                            {esgotado ? 'Esgotado' : 'Consumir'}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className={styles.consumoModalDivider} />

            {/* ── Consumo externo (form) ── */}
            <div className={styles.consumoModalSection}>
              <div className={styles.consumoModalSectionTitle}><ShoppingCart size={13} /> Consumo externo</div>
              <div className={styles.formStack}>
                <FormField label="Categoria">
                  <Select value={detailConsumoCat} onChange={(e) => { setDetailConsumoCat(e.target.value); setDetailConsumoProd(''); }}>
                    <option value="">Selecione...</option>
                    {CATEGORIAS_CONSUMO.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </Select>
                </FormField>
                {detailConsumoCatSel && (
                  <FormField label="Produto">
                    <Select value={detailConsumoProd} onChange={(e) => setDetailConsumoProd(e.target.value)}>
                      <option value="">Selecione...</option>
                      {detailConsumoCatSel.produtos.map((p) => <option key={p.id} value={p.id}>{p.nome} — {fmtBRL(p.preco)}</option>)}
                    </Select>
                  </FormField>
                )}
                {detailConsumoProdSel && (
                  <>
                    <FormField label="Quantidade">
                      <Input type="number" min="1" value={detailConsumoQty} onChange={(e) => setDetailConsumoQty(Math.max(1, parseInt(e.target.value) || 1))} />
                    </FormField>
                    <FormField label="Forma de Pagamento">
                      <Select value={detailConsumoForma} onChange={(e) => setDetailConsumoForma(e.target.value)}>
                        <option value="">Selecione...</option>
                        {FORMAS_PAGAMENTO.map((f) => <option key={f} value={f}>{f}</option>)}
                      </Select>
                    </FormField>
                    <div className={styles.totalPreview}>
                      <span className={styles.totalPreviewLabel}>{detailConsumoQty}× {detailConsumoProdSel.nome}</span>
                      <span className={styles.totalPreviewValue}>{fmtBRL(detailConsumoProdSel.preco * detailConsumoQty)}</span>
                    </div>
                    <Button variant="primary" disabled={consumoSaving} onClick={handleConsumoExterno}>
                      {consumoSaving && <Loader2 size={13} className={styles.spin} />}
                      <Plus size={13} /> Adicionar consumo externo
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* ═══════════════════════════════════════════════════════
          SUB-MODAL — Adicionar Pagamento (detail)
      ═══════════════════════════════════════════════════════ */}
      {showDetailAddPag && selectedRoom && (
        <Modal
          open
          onClose={() => setShowDetailAddPag(false)}
          size="sm"
          title={<><CreditCard size={15} /> Adicionar Pagamento</>}
          footer={
            <div className={styles.footerRight}>
              <Button variant="secondary" onClick={() => setShowDetailAddPag(false)}>Cancelar</Button>
              <Button
                variant="primary"
                disabled={!detailPagValor || !detailPagDesc.trim()}
                onClick={() => { notify('Em desenvolvimento'); setShowDetailAddPag(false); }}
              >
                Registrar
              </Button>
            </div>
          }
        >
          <div className={styles.formStack}>
            <FormField label="Descrição *">
              <Input value={detailPagDesc} onChange={(e) => setDetailPagDesc(e.target.value)} placeholder="Ex: Pagamento total..." />
            </FormField>
            <FormField label="Forma de Pagamento">
              <Select value={detailPagForma} onChange={(e) => setDetailPagForma(e.target.value)}>
                <option value="">Selecione...</option>
                {FORMAS_PAGAMENTO.map((f) => <option key={f} value={f}>{f}</option>)}
              </Select>
            </FormField>
            <FormField label="Valor *">
              <Input value={detailPagValor} onChange={(e) => setDetailPagValor(maskBRL(e.target.value))} placeholder="R$ 0,00" />
            </FormField>
            {detailPagValor && (
              <div className={styles.pagamentoResume}>
                <div className={styles.pagamentoResumeRow}>
                  <span>Valor pendente</span>
                  <span style={{ color: '#d97706' }}>{fmtBRL(selectedRoom.servico?.pagamentoPendente || 0)}</span>
                </div>
                <div className={[styles.pagamentoResumeRow, styles.pagamentoResumeTotal].join(' ')}>
                  <span>Este pagamento</span>
                  <span style={{ color: '#059669' }}>{fmtBRL(parseBRL(detailPagValor))}</span>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* ═══════════════════════════════════════════════════════
          MODAL — Gerenciar Diárias
      ═══════════════════════════════════════════════════════ */}
      {showGerenciarDiarias && selectedRoom?.servico?.tipo === 'pernoite' && (() => {
        const sv = selectedRoom.servico;
        const diarias = sv.diarias || [];
        const atualNum = sv.diariaAtual || 1;
        const novoTotal = diarias.reduce((s, d) => s + (d.valor || 0), 0) + (parseBRL(gdValor) || 0);
        return (
          <Modal
            open
            onClose={() => setShowGerenciarDiarias(false)}
            size="md"
            title={<><RefreshCw size={15} /> Gerenciar Diárias — Apt. {selectedRoom.numero}</>}
            footer={
              <div className={styles.footerRight}>
                <Button variant="secondary" onClick={() => setShowGerenciarDiarias(false)}>Fechar</Button>
              </div>
            }
          >
            <div className={styles.formStack}>
              <div className={styles.sectionTitle}><Calendar size={13} /> Diárias existentes</div>
              {diarias.length === 0
                ? <div className={styles.emptyList}><Calendar size={20} color="var(--text-2)" /><span>Nenhuma diária registrada</span></div>
                : (
                  <div className={styles.gdDiariaList}>
                    {diarias.map((d) => {
                      const isCurrent = d.num === atualNum;
                      const canRemove = d.num >= atualNum;
                      return (
                        <div key={d.idx} className={[styles.gdDiariaItem, isCurrent ? styles.gdDiariaItemCurrent : ''].join(' ')}>
                          <span className={styles.gdDiariaNum}>Diária {d.num}</span>
                          <span className={styles.gdDiariaDate}>{d.dataInicio} → {d.dataFim}</span>
                          <span className={styles.gdDiariaVal}>{fmtBRL(d.valor)}</span>
                          {isCurrent && <span className={styles.gdCurrentTag}>Atual</span>}
                          {canRemove && !isCurrent && (
                            <button className={styles.removeBtn} onClick={() => handleRemoverDiaria(d.idx)} disabled={savingGd} title="Remover diária">
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )
              }
              <div className={styles.sectionTitle} style={{ marginTop: 8 }}><Plus size={13} /> Adicionar nova diária</div>
              <div className={styles.gdAddForm}>
                <div className={styles.grid2}>
                  <FormField label="Início *"><DatePicker mode="single" value={gdDataInicio} onChange={setGdDataInicio} /></FormField>
                  <FormField label="Hora"><TimeInput value={gdHoraInicio} onChange={setGdHoraInicio} /></FormField>
                </div>
                <div className={styles.grid2}>
                  <FormField label="Fim *"><DatePicker mode="single" value={gdDataFim} onChange={setGdDataFim} minDate={gdDataInicio} /></FormField>
                  <FormField label="Hora"><TimeInput value={gdHoraFim} onChange={setGdHoraFim} /></FormField>
                </div>
                <FormField label="Valor da diária *">
                  <Input value={gdValor} onChange={(e) => setGdValor(maskBRL(e.target.value))} placeholder="R$ 0,00" />
                </FormField>
                {gdValor && (
                  <div className={styles.gdTotalPreview}>
                    <span className={styles.gdTotalLabel}>Novo total (com esta diária)</span>
                    <span className={styles.gdTotalValue}>{fmtBRL(novoTotal)}</span>
                  </div>
                )}
                <Button variant="primary" onClick={handleAdicionarDiaria} disabled={savingGd || !gdDataInicio || !gdDataFim || !gdValor}>
                  {savingGd && <Loader2 size={14} className={styles.spin} />}
                  <Plus size={14} /> Adicionar Diária
                </Button>
              </div>
            </div>
          </Modal>
        );
      })()}

      {/* ═══════════════════════════════════════════════════════
          MODAL — Trocar Quarto
      ═══════════════════════════════════════════════════════ */}
      {showTrocarQuarto && selectedRoom?.servico?.tipo === 'pernoite' && (() => {
        const sv = selectedRoom.servico;
        const diarias = sv.diarias || [];
        const atualNum = sv.diariaAtual || 1;
        const futureDiarias = diarias.filter((d) => d.num >= atualNum);
        const novoQuarto = quartos.find((q) => q.id === tqNovoQuartoId);
        return (
          <Modal
            open
            onClose={() => setShowTrocarQuarto(false)}
            size="md"
            title={<><ArrowLeftRight size={15} /> Trocar Quarto — Apt. {selectedRoom.numero}</>}
            footer={
              <div className={styles.footerRight}>
                <Button variant="secondary" onClick={() => setShowTrocarQuarto(false)}>Cancelar</Button>
                <Button variant="primary" onClick={handleTrocarQuarto} disabled={savingTq || !tqNovoQuartoId || tqDiariasIdxs.length === 0}>
                  {savingTq && <Loader2 size={14} className={styles.spin} />}
                  Confirmar Troca
                </Button>
              </div>
            }
          >
            <div className={styles.formStack}>
              <div className={styles.sectionTitle}><Calendar size={13} /> Diárias afetadas</div>
              {futureDiarias.length === 0 ? (
                <div className={styles.emptyList}><Calendar size={20} color="var(--text-2)" /><span>Nenhuma diária futura disponível</span></div>
              ) : (
                <>
                  <label className={styles.tqSelectAllRow}>
                    <input
                      type="checkbox"
                      checked={tqDiariasIdxs.length === futureDiarias.length}
                      onChange={(e) => setTqDiariasIdxs(e.target.checked ? futureDiarias.map((d) => d.idx) : [])}
                    />
                    Selecionar todas ({futureDiarias.length})
                  </label>
                  <div className={styles.tqDiariaPickerList}>
                    {futureDiarias.map((d) => {
                      const sel = tqDiariasIdxs.includes(d.idx);
                      return (
                        <div
                          key={d.idx}
                          className={[styles.tqDiariaItem, sel ? styles.tqDiariaItemSelected : ''].join(' ')}
                          onClick={() => setTqDiariasIdxs((prev) => sel ? prev.filter((x) => x !== d.idx) : [...prev, d.idx])}
                        >
                          <input type="checkbox" checked={sel} onChange={() => {}} onClick={(e) => e.stopPropagation()} />
                          <span className={styles.tqDiariaLabel}>Diária {d.num}{d.num === atualNum ? ' (atual)' : ''}</span>
                          <span className={styles.tqDiariaDate}>{d.dataInicio}</span>
                          <span style={{ color: '#059669', fontWeight: 600, fontSize: 12 }}>{fmtBRL(d.valor)}</span>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
              <div className={styles.sectionTitle} style={{ marginTop: 8 }}><BedDouble size={13} /> Novo Quarto</div>
              {OVERVIEW_ROOMS_CATS.map((cat) => (
                <div key={cat.nome} className={styles.roomPickerCat}>
                  <div className={styles.roomPickerCatName}>{cat.nome}</div>
                  <div className={styles.roomPillGroup}>
                    {cat.quartos.filter((n) => n !== selectedRoom.numero).map((n) => {
                      const q = quartos.find((r) => r.numero === n);
                      if (!q || q.status !== ROOM_STATUS.DISPONIVEL) return null;
                      return (
                        <button
                          key={n}
                          className={[styles.roomPill, tqNovoQuartoId === q.id ? styles.roomPillActive : ''].join(' ')}
                          onClick={() => setTqNovoQuartoId(q.id)}
                        >
                          {n}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              {novoQuarto && (
                <div className={styles.pricingHint} style={{ marginTop: 4 }}>
                  <span className={styles.pricingHintLabel}>Destino:</span>
                  <span>Apt. {novoQuarto.numero} — {novoQuarto.categoria} · {novoQuarto.tipoOcupacao}</span>
                </div>
              )}
            </div>
          </Modal>
        );
      })()}

      {/* ═══════════════════════════════════════════════════════
          MODAL — Desconto
      ═══════════════════════════════════════════════════════ */}
      {showDescontoModal && selectedRoom && (
        <Modal
          open
          onClose={() => setShowDescontoModal(false)}
          size="sm"
          title={<><Tag size={15} /> Aplicar Desconto — Apt. {selectedRoom.numero}</>}
          footer={
            <div className={styles.footerRight}>
              <Button variant="secondary" onClick={() => setShowDescontoModal(false)}>Cancelar</Button>
              <Button variant="primary" onClick={handleAplicarDesconto} disabled={descontoSaving}>
                {descontoSaving && <Loader2 size={14} className={styles.spin} />}
                Aplicar Desconto
              </Button>
            </div>
          }
        >
          <div className={styles.formStack}>
            {selectedRoom.servico?.tipo === 'pernoite' && (
              <FormField label="Escopo do desconto">
                <div className={styles.descontoScopeRow}>
                  {[['global', 'Global (toda a hospedagem)'], ['diaria', 'Diária atual']].map(([v, label]) => (
                    <button key={v} type="button"
                      className={[styles.descontoScopeBtn, descontoScope === v ? styles.descontoScopeBtnActive : ''].join(' ')}
                      onClick={() => setDescontoScope(v)}>{label}</button>
                  ))}
                </div>
              </FormField>
            )}
            <FormField label="Tipo de desconto">
              <div className={styles.descontoTipoRow}>
                {[['percentual', 'Porcentagem (%)'], ['fixo', 'Valor Fixo (R$)']].map(([v, label]) => (
                  <button key={v} type="button"
                    className={[styles.descontoTipoBtn, descontoTipo === v ? styles.descontoTipoBtnActive : ''].join(' ')}
                    onClick={() => setDescontoTipo(v)}>{label}</button>
                ))}
              </div>
            </FormField>
            <FormField label={descontoTipo === 'percentual' ? 'Percentual (%) *' : 'Valor (R$) *'}>
              <Input
                value={descontoValor}
                onChange={(e) => setDescontoValor(descontoTipo === 'percentual' ? e.target.value.replace(/[^\d.]/g, '') : maskBRL(e.target.value))}
                placeholder={descontoTipo === 'percentual' ? 'Ex: 10' : 'R$ 0,00'}
              />
            </FormField>
            <FormField label="Descrição *">
              <Input value={descontoDescricao} onChange={(e) => setDescontoDescricao(e.target.value)} placeholder="Ex: Fidelidade, Cortesia, Convenção..." />
            </FormField>
            {selectedRoom.servico?.desconto?.valor > 0 && (
              <div className={styles.pricingHint}>
                <span className={styles.pricingHintLabel}>Desconto atual:</span>
                <span className={styles.textAmber}>
                  {selectedRoom.servico.desconto.tipo === 'percentual'
                    ? `${selectedRoom.servico.desconto.valor}%`
                    : fmtBRL(selectedRoom.servico.desconto.valor)}
                  {' '}— {selectedRoom.servico.desconto.descricao}
                </span>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* ═══════════════════════════════════════════════════════
          MODAL — Confirmar Finalizar / Cancelar
      ═══════════════════════════════════════════════════════ */}
      {confirmModal && selectedRoom && (
        <Modal
          open
          onClose={() => setConfirmModal(null)}
          size="sm"
          title={confirmModal.action === 'finalizar' ? <><CheckCircle size={15} /> Finalizar Serviço</> : <><XCircle size={15} /> Cancelar Serviço</>}
          footer={
            <div className={styles.footerRight}>
              <Button variant="secondary" onClick={() => setConfirmModal(null)}>Voltar</Button>
              <Button
                variant={confirmModal.action === 'finalizar' ? 'primary' : 'danger'}
                onClick={confirmModal.action === 'finalizar' ? handleFinalizar : handleCancelar}
                disabled={saving}
              >
                {saving && <Loader2 size={14} className={styles.spin} />}
                {confirmModal.action === 'finalizar' ? 'Finalizar' : 'Cancelar Serviço'}
              </Button>
            </div>
          }
        >
          <p style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.6 }}>
            {confirmModal.action === 'finalizar'
              ? <>Confirma a finalização do serviço no <strong>Apt. {selectedRoom.numero}</strong>? O quarto será encaminhado para limpeza.</>
              : <>Confirma o cancelamento do serviço no <strong>Apt. {selectedRoom.numero}</strong>? O quarto ficará disponível.</>
            }
          </p>
        </Modal>
      )}
    </div>
  );
}
