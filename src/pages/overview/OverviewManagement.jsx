import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Building2, Plus, Search, BedDouble, BedSingle, Layers, Waves,
  Clock, User, CreditCard, ChevronDown, Wrench, Sparkles,
  CheckCircle, XCircle, DollarSign, Calendar, Square, Loader2,
  AlertTriangle, ShoppingCart,
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
const blankSvcForm = () => ({ responsavel: '', descricao: '', previsaoFim: '' });

// ── Main component ────────────────────────────────────────────────────────────
export default function OverviewManagement() {
  const [quartos, setQuartos]           = useState([]);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [collapsed, setCollapsed]       = useState({});
  const [tick, setTick]                 = useState(0);
  const [notif, setNotif]               = useState(null);

  // Detail modal
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [detailTab, setDetailTab]       = useState('dados');

  // Novo Pernoite / Day Use
  const [novoModal, setNovoModal]       = useState(null); // 'pernoite' | 'dayuse' | null
  const [novoRoom, setNovoRoom]         = useState(null);
  const [npForm, setNpForm]             = useState(blankNpForm());
  const [nduForm, setNduForm]           = useState(blankNduForm());

  // Add payment
  const [pagModal, setPagModal]         = useState(false);
  const [pagForm, setPagForm]           = useState(blankPagForm());

  // Service actions (limpeza/manutencao/fora)
  const [serviceModal, setServiceModal] = useState(null); // { type, room }
  const [svcForm, setSvcForm]           = useState(blankSvcForm());

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
    return matchFilter && matchSearch;
  });

  const byCategory = OVERVIEW_CATEGORIES.map((cat) => ({
    ...cat,
    rooms:       filteredQuartos.filter((q) => q.categoriaId === cat.id),
    total:       quartos.filter((q) => q.categoriaId === cat.id).length,
    disponiveis: quartos.filter((q) => q.categoriaId === cat.id && q.status === ROOM_STATUS.DISPONIVEL).length,
    ocupados:    quartos.filter((q) => q.categoriaId === cat.id && [ROOM_STATUS.OCUPADO, ROOM_STATUS.RESERVADO].includes(q.status)).length,
    emServico:   quartos.filter((q) => q.categoriaId === cat.id && [ROOM_STATUS.LIMPEZA, ROOM_STATUS.MANUTENCAO, ROOM_STATUS.FORA_DE_SERVICO].includes(q.status)).length,
  }));

  const filterCounts = {
    todos:      quartos.length,
    disponivel: quartos.filter((q) => q.status === ROOM_STATUS.DISPONIVEL).length,
    ocupado:    quartos.filter((q) => q.status === ROOM_STATUS.OCUPADO).length,
    reservado:  quartos.filter((q) => q.status === ROOM_STATUS.RESERVADO).length,
    limpeza:    quartos.filter((q) => q.status === ROOM_STATUS.LIMPEZA).length,
    servico:    quartos.filter((q) => [ROOM_STATUS.MANUTENCAO, ROOM_STATUS.FORA_DE_SERVICO].includes(q.status)).length,
  };

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
  };

  const closeDetail = () => setSelectedRoom(null);

  const openNovoServico = (tipo, room) => {
    setNovoRoom(room);
    if (tipo === 'pernoite') setNpForm(blankNpForm());
    else setNduForm(blankNduForm());
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

  // ── Criar Pernoite ────────────────────────────────────────────────────────────
  const handleCriarPernoite = async () => {
    if (!novoRoom || !npForm.chegadaDate || !npForm.saidaDate) { notify('Preencha as datas de chegada e saída.', 'error'); return; }
    setSaving(true);
    try {
      const chegada = `${dateToDisplay(npForm.chegadaDate)} ${npForm.chegadaHora}`;
      const saida   = `${dateToDisplay(npForm.saidaDate)} ${npForm.saidaHora}`;
      const dias    = Math.max(1, Math.round(Math.abs(npForm.saidaDate - npForm.chegadaDate) / 86400000));
      const pricing = STAY_PRICING[novoRoom.categoria] || {};
      let valorDiaria = 0;
      if (pricing.modeloCobranca === 'Por quarto (tarifa fixa)') valorDiaria = pricing.precoFixo || 0;
      else valorDiaria = pricing.precosOcupacao?.[Math.max(1, npForm.hospedes.length)] || pricing.precosOcupacao?.[1] || 0;
      const valorTotal = valorDiaria * dias;
      const titular = npForm.hospedes[0]?.nome || 'Hóspede';
      const servico = {
        titularNome: titular, tipoAcomodacao: npForm.tipoAcomodacao,
        periodo: `${dateToDisplay(npForm.chegadaDate)} - ${dateToDisplay(npForm.saidaDate)}`,
        chegadaPrevista: chegada, saidaPrevista: saida,
        status: PERNOITE_STATUS.ATIVO, totalDiarias: dias, diariaAtual: 1,
        valorTotal, totalPago: 0, pagamentoPendente: valorTotal,
        hospedes: npForm.hospedes, consumos: [], pagamentos: [],
      };
      const updated = await overviewApi.criarPernoite(novoRoom.id, servico);
      setQuartos((prev) => prev.map((q) => q.id === updated.id ? updated : q));
      notify(`Pernoite criado! ${titular} — Apt. ${novoRoom.numero}.`);
      setNovoModal(null);
    } catch (e) { notify('Erro: ' + e.message, 'error'); }
    finally { setSaving(false); }
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
      return (
        <div className={styles.tabContent}>
          {/* Beds config */}
          <div className={styles.sectionTitle}><BedDouble size={13} /> Configuração de Camas</div>
          <BedsDetailGrid camas={s.camas} />

          {/* Info grid */}
          <div className={styles.infoGrid2}>
            <div className={styles.infoRow}><span className={styles.infoLabel}>Categoria</span><span className={styles.infoValue}>{s.categoria}</span></div>
            <div className={styles.infoRow}><span className={styles.infoLabel}>Tipo de Ocupação</span><span className={styles.infoValue}>{s.tipoOcupacao}</span></div>
            {s.descricao && <div className={styles.infoRowFull}><span className={styles.infoLabel}>Descrição</span><span className={styles.infoValue}>{s.descricao}</span></div>}
          </div>

          {/* Pricing preview */}
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
      return (
        <>
          <div className={styles.detailTabs}>
            {['dados','hospedes','consumos','pagamentos'].map((tab) => (
              <button key={tab} className={[styles.detailTab, detailTab === tab ? styles.detailTabActive : ''].join(' ')} onClick={() => setDetailTab(tab)}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                {tab === 'hospedes'   && <span className={styles.tabCount}>{sv.hospedes?.length || 0}</span>}
                {tab === 'consumos'   && <span className={styles.tabCount}>{sv.consumos?.length || 0}</span>}
                {tab === 'pagamentos' && <span className={styles.tabCount}>{sv.pagamentos?.length || 0}</span>}
              </button>
            ))}
          </div>

          <div className={styles.detailTabBody}>
            {detailTab === 'dados' && (
              <div className={styles.tabContent}>
                {/* Summary cards */}
                <div className={styles.summaryGrid4}>
                  <div className={styles.summaryCard}><span className={styles.summaryLabel}>Valor Total</span><span className={styles.summaryValue}>{fmtBRL(sv.valorTotal)}</span></div>
                  <div className={styles.summaryCard}><span className={styles.summaryLabel}>Total Pago</span><span className={[styles.summaryValue, styles.summaryValueGreen].join(' ')}>{fmtBRL(sv.totalPago)}</span></div>
                  <div className={styles.summaryCard}><span className={styles.summaryLabel}>Pendente</span><span className={[styles.summaryValue, sv.pagamentoPendente > 0 ? styles.summaryValueAmber : styles.summaryValueGreen].join(' ')}>{fmtBRL(sv.pagamentoPendente)}</span></div>
                  <div className={styles.summaryCard}><span className={styles.summaryLabel}>Diárias</span><span className={styles.summaryValue}>{sv.diariaAtual}/{sv.totalDiarias}</span></div>
                </div>
                {/* Info */}
                <div className={styles.infoGrid2}>
                  <div className={styles.infoRow}><span className={styles.infoLabel}>Titular</span><span className={styles.infoValue}>{sv.titularNome}</span></div>
                  <div className={styles.infoRow}><span className={styles.infoLabel}>Tipo</span><span className={styles.infoValue}>{sv.tipoAcomodacao || s.tipoOcupacao}</span></div>
                  <div className={styles.infoRow}><span className={styles.infoLabel}>Período</span><span className={styles.infoValue}>{sv.periodo}</span></div>
                  <div className={styles.infoRow}><span className={styles.infoLabel}>Chegada</span><span className={styles.infoValue}>{sv.chegadaPrevista}</span></div>
                  <div className={styles.infoRow}><span className={styles.infoLabel}>Saída Prevista</span><span className={styles.infoValue}>{sv.saidaPrevista}</span></div>
                  <div className={styles.infoRow}><span className={styles.infoLabel}>Status</span><span className={styles.infoValue}>{sv.status}</span></div>
                </div>
              </div>
            )}
            {detailTab === 'hospedes' && (
              <div className={styles.tabContent}>
                {(sv.hospedes || []).length === 0
                  ? <div className={styles.emptyList}><User size={24} color="var(--text-2)" /><span>Nenhum hóspede registrado</span></div>
                  : (sv.hospedes || []).map((h, i) => (
                    <div key={h.id} className={styles.listItem}>
                      <div className={styles.listItemLeft}>
                        <User size={15} className={i === 0 ? styles.listItemIconGreen : styles.listItemIcon} />
                        <div>
                          <div className={styles.listItemName}>{h.nome} {i === 0 && <span className={styles.titularTag}>Titular</span>}</div>
                          <div className={styles.listItemSub}>{h.cpf} · {h.telefone}</div>
                        </div>
                      </div>
                    </div>
                  ))
                }
              </div>
            )}
            {detailTab === 'consumos' && (
              <div className={styles.tabContent}>
                {(sv.consumos || []).length === 0
                  ? <div className={styles.emptyList}><ShoppingCart size={24} color="var(--text-2)" /><span>Nenhum consumo registrado</span></div>
                  : (sv.consumos || []).map((c) => (
                    <div key={c.id} className={styles.listItem}>
                      <div className={styles.listItemLeft}>
                        <ShoppingCart size={14} className={styles.listItemIcon} />
                        <div>
                          <div className={styles.listItemName}>{c.item}</div>
                          <div className={styles.listItemSub}>{c.categoria} · {c.quantidade}× {fmtBRL(c.valorUnitario)}</div>
                        </div>
                      </div>
                      <span className={styles.listItemValue}>{fmtBRL(c.valorTotal)}</span>
                    </div>
                  ))
                }
              </div>
            )}
            {detailTab === 'pagamentos' && (
              <div className={styles.tabContent}>
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
                      <span className={[styles.listItemValue, styles.valueGreen].join(' ')}>{fmtBRL(p.valor)}</span>
                    </div>
                  ))
                }
                {sv.pagamentoPendente > 0 && (
                  <button className={styles.addPagBtn} onClick={() => { setPagForm(blankPagForm()); setPagModal(true); }}>
                    <Plus size={13} /> Registrar Pagamento ({fmtBRL(sv.pagamentoPendente)} pendente)
                  </button>
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
            {['dados','hospedes','consumos','pagamentos'].map((tab) => (
              <button key={tab} className={[styles.detailTab, detailTab === tab ? styles.detailTabActive : ''].join(' ')} onClick={() => setDetailTab(tab)}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                {tab === 'hospedes'   && <span className={styles.tabCount}>{sv.hospedes?.length || 0}</span>}
                {tab === 'consumos'   && <span className={styles.tabCount}>{sv.consumos?.length || 0}</span>}
                {tab === 'pagamentos' && <span className={styles.tabCount}>{sv.pagamentos?.length || 0}</span>}
              </button>
            ))}
          </div>

          <div className={styles.detailTabBody}>
            {detailTab === 'dados' && (
              <div className={styles.tabContent}>
                <div className={styles.summaryGrid4}>
                  <div className={styles.summaryCard}><span className={styles.summaryLabel}>Valor Base</span><span className={styles.summaryValue}>{fmtBRL(sv.precoBase)}</span></div>
                  <div className={styles.summaryCard}><span className={styles.summaryLabel}>Hora Adicional</span><span className={styles.summaryValue}>{fmtBRL(sv.precoAdicional)}</span></div>
                  <div className={styles.summaryCard}>
                    <span className={styles.summaryLabel}>Tempo decorrido</span>
                    {isAtivo
                      ? <span className={styles.clockRunning}>{fmtClock(selElapsedSec)}</span>
                      : <span className={styles.summaryValue}>{fmtElapsed(selElapsedMin)}</span>
                    }
                  </div>
                  <div className={styles.summaryCard}><span className={styles.summaryLabel}>{isAtivo ? 'Total até agora' : 'Total cobrado'}</span><span className={[styles.summaryValue, styles.summaryValueGreen].join(' ')}>{fmtBRL(isAtivo ? selValorAtual : sv.valorTotal)}</span></div>
                </div>
                <div className={styles.infoGrid2}>
                  <div className={styles.infoRow}><span className={styles.infoLabel}>Titular</span><span className={styles.infoValue}>{sv.titularNome || <em>Sem titular</em>}</span></div>
                  <div className={styles.infoRow}><span className={styles.infoLabel}>Data de uso</span><span className={styles.infoValue}>{sv.dataUso}</span></div>
                  <div className={styles.infoRow}><span className={styles.infoLabel}>Entrada</span><span className={styles.infoValue}>{sv.horaEntrada}</span></div>
                  <div className={styles.infoRow}><span className={styles.infoLabel}>Saída</span><span className={styles.infoValue}>{sv.horaSaida || <em>Em aberto</em>}</span></div>
                  <div className={styles.infoRow}><span className={styles.infoLabel}>Status</span><span className={styles.infoValue}>{sv.status}</span></div>
                  {sv.pagamentoPendente > 0 && <div className={styles.infoRow}><span className={styles.infoLabel}>Pendente</span><span className={[styles.infoValue, styles.textAmber].join(' ')}>{fmtBRL(sv.pagamentoPendente)}</span></div>}
                </div>
              </div>
            )}
            {detailTab === 'hospedes' && (
              <div className={styles.tabContent}>
                {(sv.hospedes || []).length === 0
                  ? <div className={styles.emptyList}><User size={24} color="var(--text-2)" /><span>Nenhum hóspede registrado</span></div>
                  : (sv.hospedes || []).map((h, i) => (
                    <div key={h.id} className={styles.listItem}>
                      <div className={styles.listItemLeft}>
                        <User size={15} className={i === 0 ? styles.listItemIconGreen : styles.listItemIcon} />
                        <div>
                          <div className={styles.listItemName}>{h.nome} {i === 0 && <span className={styles.titularTag}>Titular</span>}</div>
                          <div className={styles.listItemSub}>{h.cpf} · {h.telefone}</div>
                        </div>
                      </div>
                    </div>
                  ))
                }
              </div>
            )}
            {detailTab === 'consumos' && (
              <div className={styles.tabContent}>
                {(sv.consumos || []).length === 0
                  ? <div className={styles.emptyList}><ShoppingCart size={24} color="var(--text-2)" /><span>Nenhum consumo registrado</span></div>
                  : (sv.consumos || []).map((c) => (
                    <div key={c.id} className={styles.listItem}>
                      <div className={styles.listItemLeft}>
                        <ShoppingCart size={14} className={styles.listItemIcon} />
                        <div>
                          <div className={styles.listItemName}>{c.item}</div>
                          <div className={styles.listItemSub}>{c.categoria} · {c.quantidade}× {fmtBRL(c.valorUnitario)}</div>
                        </div>
                      </div>
                      <span className={styles.listItemValue}>{fmtBRL(c.valorTotal)}</span>
                    </div>
                  ))
                }
              </div>
            )}
            {detailTab === 'pagamentos' && (
              <div className={styles.tabContent}>
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
                      <span className={[styles.listItemValue, styles.valueGreen].join(' ')}>{fmtBRL(p.valor)}</span>
                    </div>
                  ))
                }
                {sv.pagamentoPendente > 0 && (
                  <button className={styles.addPagBtn} onClick={() => { setPagForm(blankPagForm()); setPagModal(true); }}>
                    <Plus size={13} /> Registrar Pagamento ({fmtBRL(sv.pagamentoPendente)} pendente)
                  </button>
                )}
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
            <Button variant="secondary" onClick={() => openNovoServico('pernoite', s)}>
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
          <Button variant="primary" onClick={() => handleMarcarDisponivel(s)} disabled={saving}>
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
          <Button variant="primary" onClick={() => handleMarcarDisponivel(s)} disabled={saving}>
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
      const sv = s.servico;
      return (
        <div className={styles.footerBetween}>
          <Button variant="danger" onClick={() => setConfirmModal({ action: 'cancelar' })}>
            <XCircle size={14} /> Cancelar
          </Button>
          <Button variant="primary" onClick={() => setConfirmModal({ action: 'finalizar' })} disabled={saving}>
            {saving && <Loader2 size={14} className={styles.spin} />}
            <CheckCircle size={14} /> {sv.status === PERNOITE_STATUS.DIARIA_ENCERRADA ? 'Finalizar' : 'Encerrar Diária'}
          </Button>
        </div>
      );
    }

    if (s.servico?.tipo === 'dayuse') {
      const sv = s.servico;
      const isAtivo = sv.status === DAYUSE_STATUS.ATIVO;
      const isEncerrado = sv.status === DAYUSE_STATUS.ENCERRADO;
      return (
        <div className={styles.footerBetween}>
          <Button variant="danger" onClick={() => setConfirmModal({ action: 'cancelar' })}>
            <XCircle size={14} /> Cancelar
          </Button>
          <div className={styles.footerRight}>
            {isAtivo && (
              <Button variant="primary" onClick={() => setEncerrarModal(true)}>
                <Square size={14} /> Encerrar
              </Button>
            )}
            {isEncerrado && (
              <Button variant="primary" onClick={() => setConfirmModal({ action: 'finalizar' })} disabled={saving}>
                {saving && <Loader2 size={14} className={styles.spin} />}
                <CheckCircle size={14} /> Finalizar
              </Button>
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
    const nomeLine = s.status === ROOM_STATUS.DISPONIVEL
      ? `Apt. ${s.numero} — ${s.categoria}`
      : sv?.tipo === 'dayuse' ? (sv.titularNome || 'Day Use em andamento')
      : sv?.tipo === 'pernoite' ? sv.titularNome
      : sv?.tipo === 'reserva' ? sv.titularNome
      : s.status;

    return (
      <div className={styles.detailModalTitle}>
        <div className={[styles.detailRoomBadge, styles[`detailBadge_${sk}`]].join(' ')}>
          {s.numero}
        </div>
        <div>
          <div className={[styles.detailTitular, !sv?.titularNome && sv?.tipo === 'dayuse' ? styles.detailTitularPending : ''].join(' ')}>
            {nomeLine}
          </div>
          <div className={styles.detailMeta}>
            <span className={styles.detailCategoria}>{s.categoria}</span>
            <span className={styles.detailSep}>·</span>
            <span className={styles.detailTipo}>{s.tipoOcupacao}</span>
            <span className={[styles.statusBadge, styles[`badge_${sk}`]].join(' ')}>{s.status}</span>
            {sv?.tipo === 'pernoite' && <span className={styles.pernoiteBadge}>Pernoite</span>}
            {sv?.tipo === 'dayuse'   && <span className={styles.dayuseBadge}>Day Use</span>}
          </div>
        </div>
      </div>
    );
  };

  // ── Room Row ──────────────────────────────────────────────────────────────
  const RoomRow = ({ room }) => {
    const sk      = roomStatusKey(room.status);
    const sv      = room.servico;
    const isDuAtivo = sv?.tipo === 'dayuse' && sv.status === DAYUSE_STATUS.ATIVO;
    const elapsed = isDuAtivo ? calcElapsedMinutes(sv.dataUso, sv.horaEntrada, null) : 0;

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
      nameNode = <span className={sv.titularNome ? styles.roomName : styles.roomNamePending}>{sv.titularNome || 'Day Use em andamento'}</span>;
    } else if (sv?.titularNome) {
      nameNode = <span className={styles.roomName}>{sv.titularNome}</span>;
    } else {
      nameNode = <span className={styles.roomNamePending}>—</span>;
    }

    let metaNode = null;
    if (room.status === ROOM_STATUS.DISPONIVEL) {
      metaNode = <BedsRow camas={room.camas} />;
    } else if (sv?.tipo === 'pernoite') {
      metaNode = (
        <div className={styles.metaRow}>
          <Calendar size={10} /><span>{sv.periodo}</span>
          {sv.pagamentoPendente > 0 && <span className={styles.metaPendente}>• Pendente: {fmtBRL(sv.pagamentoPendente)}</span>}
        </div>
      );
    } else if (sv?.tipo === 'dayuse') {
      metaNode = (
        <div className={styles.metaRow}>
          {isDuAtivo
            ? <><Clock size={10} /><span className={styles.timerLive}>{sv.horaEntrada} · {fmtElapsed(elapsed)}</span></>
            : <><Clock size={10} /><span>{sv.horaEntrada} → {sv.horaSaida} ({fmtElapsed(calcElapsedMinutes(sv.dataUso, sv.horaEntrada, sv.horaSaida))})</span></>
          }
          {sv.pagamentoPendente > 0 && <span className={styles.metaPendente}>• Pendente: {fmtBRL(sv.pagamentoPendente)}</span>}
        </div>
      );
    } else if (sv?.tipo === 'reserva') {
      metaNode = <div className={styles.metaRow}><Calendar size={10} /><span>{sv.chegadaPrevista}</span></div>;
    } else if (room.status === ROOM_STATUS.LIMPEZA && room.limpeza) {
      metaNode = <div className={styles.metaRow}><User size={10} /><span>{room.limpeza.responsavel || 'Sem responsável'}</span></div>;
    } else if ((room.status === ROOM_STATUS.MANUTENCAO || room.status === ROOM_STATUS.FORA_DE_SERVICO) && room.manutencao) {
      metaNode = <div className={styles.metaRow}><Wrench size={10} /><span>{room.manutencao.responsavel || '—'}</span><span className={styles.metaDesc}>{room.manutencao.descricao ? ` · ${room.manutencao.descricao.slice(0, 35)}...` : ''}</span></div>;
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
          {sv?.tipo === 'pernoite' && <span className={styles.pernoiteBadge}>Pernoite</span>}
          {sv?.tipo === 'dayuse'   && <span className={styles.dayuseBadge}>Day Use</span>}
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

      <div className={styles.card}>
        {/* ── Header ── */}
        <div className={styles.tableHeader}>
          <div>
            <h2 className={styles.h2}>Recepção</h2>
            <p className={styles.subtitle}><Building2 size={13} /> Visão geral de quartos, hóspedes e day use</p>
          </div>
          <div className={styles.tableTools}>
            <div className={styles.searchWrap}>
              <Search size={13} className={styles.searchIcon} />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nº ou hóspede..." className={styles.searchInput} />
            </div>
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

        {/* ── Category groups ── */}
        {loading ? (
          <div className={styles.emptyState}><Loader2 size={28} className={styles.spin} /> Carregando...</div>
        ) : (
          byCategory.map((cat) => (
            <div key={cat.id} className={styles.catSection}>
              <div className={styles.catHeader} onClick={() => toggleCollapse(cat.id)}>
                <div className={styles.catHeaderLeft}>
                  <ChevronDown size={15} className={[styles.catChevron, collapsed[cat.id] ? styles.catChevronClosed : ''].join(' ')} />
                  <div>
                    <span className={styles.catName}>{cat.nome}</span>
                    <span className={styles.catDesc}>{cat.descricao}</span>
                  </div>
                </div>
                <div className={styles.catStats}>
                  <span className={[styles.catStat, styles.catStatGreen].join(' ')}>{cat.disponiveis} disponíveis</span>
                  <span className={[styles.catStat, styles.catStatAmber].join(' ')}>{cat.ocupados} ocupados/reservados</span>
                  {cat.emServico > 0 && <span className={[styles.catStat, styles.catStatSlate].join(' ')}>{cat.emServico} em serviço</span>}
                  <span className={styles.catTotal}>{cat.total} quartos</span>
                </div>
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
          MODAL — Novo Pernoite
      ═══════════════════════════════════════════════════════ */}
      {novoModal === 'pernoite' && novoRoom && (
        <Modal
          open
          onClose={() => setNovoModal(null)}
          size="md"
          title={<><BedDouble size={15} /> Novo Pernoite — Apt. {novoRoom.numero}</>}
          footer={
            <div className={styles.footerRight}>
              <Button variant="secondary" onClick={() => setNovoModal(null)}>Cancelar</Button>
              <Button variant="primary" onClick={handleCriarPernoite} disabled={saving || !npForm.chegadaDate || !npForm.saidaDate}>
                {saving && <Loader2 size={14} className={styles.spin} />}
                Registrar Pernoite
              </Button>
            </div>
          }
        >
          <div className={styles.formStack}>
            <div className={styles.pricingHint}>
              <span className={styles.pricingHintLabel}>Categoria:</span>
              <strong>{novoRoom.categoria}</strong>
              {(() => { const p = STAY_PRICING[novoRoom.categoria]; return p?.precoFixo ? <span>{fmtBRL(p.precoFixo)}/noite</span> : <span>A partir de {fmtBRL(p?.precosOcupacao?.[1])}/noite por ocupação</span>; })()}
            </div>

            <FormField label="Tipo de Acomodação">
              <Select value={npForm.tipoAcomodacao} onChange={(e) => setNpForm((f) => ({ ...f, tipoAcomodacao: e.target.value }))}>
                {TIPOS_OCUPACAO.map((t) => <option key={t} value={t}>{t}</option>)}
              </Select>
            </FormField>

            <div className={styles.grid2}>
              <FormField label="Data de chegada *">
                <DatePicker mode="single" value={npForm.chegadaDate} onChange={(d) => setNpForm((f) => ({ ...f, chegadaDate: d }))} />
              </FormField>
              <FormField label="Hora de chegada">
                <TimeInput value={npForm.chegadaHora} onChange={(v) => setNpForm((f) => ({ ...f, chegadaHora: v }))} />
              </FormField>
            </div>
            <div className={styles.grid2}>
              <FormField label="Data de saída *">
                <DatePicker mode="single" value={npForm.saidaDate} onChange={(d) => setNpForm((f) => ({ ...f, saidaDate: d }))} minDate={npForm.chegadaDate} />
              </FormField>
              <FormField label="Hora de saída">
                <TimeInput value={npForm.saidaHora} onChange={(v) => setNpForm((f) => ({ ...f, saidaHora: v }))} />
              </FormField>
            </div>

            <FormField label="Hóspedes">
              <Input value={npForm.hospedeSearch} onChange={(e) => setNpForm((f) => ({ ...f, hospedeSearch: e.target.value }))} placeholder="Buscar hóspede cadastrado..." />
              <HospedeResults results={npHosp} onAdd={addNpHospede} />
              {npForm.hospedes.length > 0 && (
                <div className={styles.hospedeChips}>
                  {npForm.hospedes.map((h, i) => (
                    <span key={h.id} className={[styles.hospedeChip, i === 0 ? styles.hospedeChipTitular : ''].join(' ')}>
                      {h.nome}
                      <button className={styles.chipRemove} onClick={() => remNpHospede(h.id)}><XCircle size={12} /></button>
                    </span>
                  ))}
                </div>
              )}
            </FormField>
          </div>
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
