import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Clock, Plus, Search, User, CreditCard, ShoppingCart,
  Edit2, X, Check, Trash2, Paperclip, CheckCircle, XCircle,
  DollarSign, ChevronDown, Square,
} from 'lucide-react';
import { Modal }                    from '../../components/ui/Modal';
import { Button }                   from '../../components/ui/Button';
import { Input, Select, FormField } from '../../components/ui/Input';
import { DatePicker }               from '../../components/ui/DatePicker';
import { TimeInput }                from '../../components/ui/TimeInput';
import { Notification }             from '../../components/ui/Notification';
import {
  dayUseApi, STATUS_DU, FORMAS_PAGAMENTO, TIPOS_ACOMODACAO,
  CATEGORIAS_QUARTOS, HOSPEDES_CADASTRADOS, CATEGORIAS_CONSUMO,
  getCategoriaDoQuarto, DAY_USE_PRICING,
} from './dayUseMocks';
import styles from './DayUseManagement.module.css';

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

const parseBRL = (v) => {
  const s = String(v ?? '').replace(/[R$\s.]/g, '').replace(',', '.');
  return parseFloat(s) || 0;
};

function getStatusKey(status) {
  switch (status) {
    case STATUS_DU.ATIVO:               return 'ativo';
    case STATUS_DU.ENCERRADO:           return 'encerrado';
    case STATUS_DU.FINALIZADO:          return 'finalizado';
    case STATUS_DU.CANCELADO:           return 'cancelado';
    case STATUS_DU.FINALIZADO_PENDENTE: return 'pendente';
    default:                            return 'outro';
  }
}

function fmtNum(n) { return n < 10 ? `0${n}` : `${n}`; }

function nowTimeStr() {
  const n = new Date();
  return `${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`;
}

function todayDate() {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

function dateToDisplay(d) {
  if (!d) return '';
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function displayToDate(str) {
  if (!str) return null;
  const [d, m, y] = str.split('/');
  if (!d || !m || !y) return null;
  return new Date(+y, +m - 1, +d);
}

// Returns elapsed minutes between horaEntrada and horaSaida (or now if null)
function calcElapsedSeconds(dataUso, horaEntrada, horaSaida = null) {
  if (!dataUso || !horaEntrada) return 0;
  const [d, m, y] = dataUso.split('/');
  const [h, min] = horaEntrada.split(':');
  const start = new Date(+y, +m - 1, +d, +h, +min, 0);
  let end;
  if (horaSaida) {
    const [hh, mm] = horaSaida.split(':');
    end = new Date(+y, +m - 1, +d, +hh, +mm, 0);
    if (end < start) end = new Date(end.getTime() + 86400000);
  } else {
    end = new Date();
  }
  return Math.max(0, Math.floor((end - start) / 1000));
}

function calcElapsedMinutes(dataUso, horaEntrada, horaSaida = null) {
  return Math.floor(calcElapsedSeconds(dataUso, horaEntrada, horaSaida) / 60);
}

// Calculates the due amount based on elapsed time
function calcValorAtual(precoBase, precoAdicional, horasBase, elapsedMinutes) {
  if (!precoBase) return 0;
  const baseMinutes = (horasBase || 2) * 60;
  if (elapsedMinutes <= baseMinutes) return precoBase;
  const extraHours = Math.ceil((elapsedMinutes - baseMinutes) / 60);
  return precoBase + extraHours * (precoAdicional || 0);
}

function fmtElapsed(minutes) {
  if (minutes <= 0) return '0min';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  return `${h}h ${String(m).padStart(2, '0')}min`;
}

// HH:MM:SS clock format for running timer
function fmtClock(totalSeconds) {
  if (totalSeconds <= 0) return '00:00';
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ── Main component ────────────────────────────────────────────────────────────
export default function DayUseManagement() {
  const [dayUses, setDayUses]           = useState([]);
  const [loading, setLoading]           = useState(true);
  const [notification, setNotification] = useState(null);

  // 1-second tick to drive real-time clock for ATIVO records
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const hasActive = dayUses.some((du) => du.status === STATUS_DU.ATIVO);
    if (!hasActive) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [dayUses]);

  // Filters
  const [search, setSearch]             = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterTipo, setFilterTipo]     = useState('');

  // Collapsed category groups
  const [collapsedCats, setCollapsedCats] = useState({});

  // Detail modal
  const [detailDU, setDetailDU]     = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [detailTab, setDetailTab]   = useState('dados');

  // Encerrar modal
  const [showEncerrar, setShowEncerrar]         = useState(false);
  const [encerrarHoraSaida, setEncerrarHoraSaida] = useState('');
  const [encerrarValor, setEncerrarValor]       = useState(0);
  const [encerrarElapsed, setEncerrarElapsed]   = useState(0);

  // Edit dados modal (for ENCERRADO only)
  const [showEditDados, setShowEditDados]   = useState(false);
  const [editDate, setEditDate]             = useState(null);
  const [editEntrada, setEditEntrada]       = useState('');
  const [editSaida, setEditSaida]           = useState('');
  const [savingDados, setSavingDados]       = useState(false);

  // Add hóspede modal
  const [showAddHospede, setShowAddHospede]   = useState(false);
  const [hospedeSearch, setHospedeSearch]     = useState('');
  const [hospedeSelected, setHospedeSelected] = useState(null);
  const [savingHospede, setSavingHospede]     = useState(false);

  // Add consumo modal
  const [showAddConsumo, setShowAddConsumo]     = useState(false);
  const [consumoCategoria, setConsumoCategoria] = useState('');
  const [consumoProduto, setConsumoProduto]     = useState('');
  const [consumoQty, setConsumoQty]             = useState(1);
  const [consumoForma, setConsumoForma]         = useState('');
  const [savingConsumo, setSavingConsumo]       = useState(false);

  // Add pagamento modal
  const [showAddPagamento, setShowAddPagamento]         = useState(false);
  const [pagamentoDesc, setPagamentoDesc]               = useState('');
  const [pagamentoForma, setPagamentoForma]             = useState('');
  const [pagamentoValor, setPagamentoValor]             = useState('');
  const [pagamentoComprovante, setPagamentoComprovante] = useState(null);
  const [savingPagamento, setSavingPagamento]           = useState(false);
  const comprovanteRef = useRef(null);

  // Confirm modals
  const [showCancelar, setShowCancelar]     = useState(false);
  const [showFinalizar, setShowFinalizar]   = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);

  // Nova Day Use modal
  const [showNovaDU, setShowNovaDU]           = useState(false);
  const [duHospedes, setDuHospedes]           = useState([]);
  const [duHospedeSearch, setDuHospedeSearch] = useState('');
  const [duQuarto, setDuQuarto]               = useState('');
  const [duRoomSearch, setDuRoomSearch]       = useState('');
  const [duDate, setDuDate]                   = useState(null);
  const [duEntrada, setDuEntrada]             = useState('');
  const [duPagamentos, setDuPagamentos]       = useState([]);
  const [duPagDesc, setDuPagDesc]             = useState('');
  const [duPagForma, setDuPagForma]           = useState('');
  const [duPagValor, setDuPagValor]           = useState('');
  const [savingNova, setSavingNova]           = useState(false);

  // ── Load ──────────────────────────────────────────────────────────────────
  const loadDayUses = useCallback(async () => {
    setLoading(true);
    try { setDayUses(await dayUseApi.listar()); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { loadDayUses(); }, [loadDayUses]);

  // ── Notification helper ───────────────────────────────────────────────────
  const notify = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // ── Computed ──────────────────────────────────────────────────────────────
  const filteredDayUses = useMemo(() =>
    dayUses.filter((s) => {
      const matchSearch = !search || s.titularNome.toLowerCase().includes(search.toLowerCase());
      const matchStatus = !filterStatus || s.status === filterStatus;
      const matchTipo   = !filterTipo   || s.tipo === filterTipo;
      return matchSearch && matchStatus && matchTipo;
    }),
    [dayUses, search, filterStatus, filterTipo]
  );

  const dayUsesByCategory = useMemo(() =>
    CATEGORIAS_QUARTOS.map((cat) => ({
      ...cat,
      items: filteredDayUses.filter((s) => s.categoria === cat.nome),
    })),
    [filteredDayUses]
  );

  // Live elapsed in seconds — drives the HH:MM:SS clock for ATIVO
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const detailElapsedSec = useMemo(() => {
    if (!detailDU || detailDU.status !== STATUS_DU.ATIVO) return 0;
    return calcElapsedSeconds(detailDU.dataUso, detailDU.horaEntrada, null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailDU, tick]);

  // Minutes (for valor calculation and display of finished records)
  const detailElapsed = useMemo(() => {
    if (!detailDU) return 0;
    return calcElapsedMinutes(detailDU.dataUso, detailDU.horaEntrada, detailDU.horaSaida || null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailDU, tick]);

  const detailValorAtual = detailDU
    ? calcValorAtual(detailDU.precoBase, detailDU.precoAdicional, detailDU.horasBase,
        detailDU.status === STATUS_DU.ATIVO ? Math.floor(detailElapsedSec / 60) : detailElapsed)
    : 0;

  const progressPercent = detailDU && detailDU.valorTotal > 0
    ? Math.min(100, (detailDU.totalPago / detailDU.valorTotal) * 100)
    : 0;

  // ── Nova DU computed ──────────────────────────────────────────────────────
  const duPessoas = duHospedes.length || 1;
  const duCat     = duQuarto ? getCategoriaDoQuarto(duQuarto) : null;
  const duPricing = duCat ? DAY_USE_PRICING[duCat.nome] : null;
  const duPrecoBase = duPricing?.precoFixo || 0;
  const duPrecoAdc  = duPricing?.precoAdicional || 0;
  const duHorasBase = duPricing?.horasBase || 2;

  const duTitular = duHospedes[0] || null;
  const duPersonResults = useMemo(() => {
    const selectedIds = new Set(duHospedes.map((h) => h.id));
    const acomps = duTitular
      ? HOSPEDES_CADASTRADOS.filter(
          (h) => (duTitular.acompanhantes || []).includes(h.id) && !selectedIds.has(h.id)
        )
      : [];
    const acompIds = new Set(acomps.map((h) => h.id));
    const outros = HOSPEDES_CADASTRADOS.filter((h) => !selectedIds.has(h.id) && !acompIds.has(h.id));
    const term = duHospedeSearch.toLowerCase();
    const filterFn = (h) => !term || h.nome.toLowerCase().includes(term) || h.cpf.includes(term);
    return { acompanhantes: acomps.filter(filterFn), outros: outros.filter(filterFn) };
  }, [duHospedes, duHospedeSearch, duTitular]);

  const duRoomsFiltered = useMemo(() => {
    if (!duRoomSearch) return CATEGORIAS_QUARTOS;
    return CATEGORIAS_QUARTOS.map((cat) => ({
      ...cat, quartos: cat.quartos.filter((q) => String(q).includes(duRoomSearch)),
    })).filter((cat) => cat.quartos.length > 0);
  }, [duRoomSearch]);

  const duTotalPago = duPagamentos.reduce((s, p) => s + p.valor, 0);

  // ── Consumo computed ──────────────────────────────────────────────────────
  const consumoCatSel     = CATEGORIAS_CONSUMO.find((c) => c.id === parseInt(consumoCategoria));
  const consumoProdutoSel = consumoCatSel?.produtos.find((p) => p.id === parseInt(consumoProduto));

  // ── Filtered hóspedes for add-to-existing ────────────────────────────────
  const filteredHospedes = HOSPEDES_CADASTRADOS.filter((h) =>
    !hospedeSearch || h.nome.toLowerCase().includes(hospedeSearch.toLowerCase())
  );

  // ── Sync detailDU after mutations ─────────────────────────────────────────
  const reloadAndSync = (updated) => {
    setDayUses((prev) => prev.map((s) => s.id === updated.id ? updated : s));
    setDetailDU(updated);
  };

  // ── Handlers: detail ─────────────────────────────────────────────────────
  const openDetail = (du) => {
    setDetailDU(du);
    setDetailTab('dados');
    setShowDetail(true);
  };

  // ── Handlers: encerrar ────────────────────────────────────────────────────
  const openEncerrar = () => {
    if (!detailDU) return;
    const horaSaida = nowTimeStr();
    const elapsed = calcElapsedMinutes(detailDU.dataUso, detailDU.horaEntrada, horaSaida);
    const valor = calcValorAtual(detailDU.precoBase, detailDU.precoAdicional, detailDU.horasBase, elapsed);
    setEncerrarHoraSaida(horaSaida);
    setEncerrarValor(valor);
    setEncerrarElapsed(elapsed);
    setShowEncerrar(true);
  };

  const handleEncerrar = async () => {
    setConfirmLoading(true);
    try {
      const updated = await dayUseApi.encerrar(detailDU.id, {
        horaSaida: encerrarHoraSaida,
        valorTotal: encerrarValor,
        pagamentoPendente: Math.max(0, encerrarValor - detailDU.totalPago),
      });
      reloadAndSync(updated);
      setShowEncerrar(false);
      notify('Day Use encerrado. Valores calculados.');
    } catch {
      notify('Erro ao encerrar.', 'error');
    } finally {
      setConfirmLoading(false);
    }
  };

  // ── Handlers: edit dados (only ENCERRADO) ─────────────────────────────────
  const openEditDados = () => {
    if (!detailDU) return;
    setEditDate(displayToDate(detailDU.dataUso));
    setEditEntrada(detailDU.horaEntrada || '');
    setEditSaida(detailDU.horaSaida || '');
    setShowEditDados(true);
  };

  const handleSaveEditDados = async () => {
    if (!editDate) return;
    setSavingDados(true);
    try {
      const newElapsed = calcElapsedMinutes(
        dateToDisplay(editDate), editEntrada, editSaida || null
      );
      const newValor = calcValorAtual(
        detailDU.precoBase, detailDU.precoAdicional, detailDU.horasBase, newElapsed
      );
      const updated = await dayUseApi.atualizar(detailDU.id, {
        dataUso:          dateToDisplay(editDate),
        horaEntrada:      editEntrada,
        horaSaida:        editSaida || detailDU.horaSaida,
        valorTotal:       newValor,
        pagamentoPendente: Math.max(0, newValor - detailDU.totalPago),
      });
      reloadAndSync(updated);
      setShowEditDados(false);
      notify('Dados atualizados.');
    } catch {
      notify('Erro ao salvar.', 'error');
    } finally {
      setSavingDados(false);
    }
  };

  // ── Handlers: add hóspede ─────────────────────────────────────────────────
  const openAddHospede = () => {
    setHospedeSearch('');
    setHospedeSelected(null);
    setShowAddHospede(true);
  };

  const handleSaveHospede = async () => {
    if (!hospedeSelected) return;
    setSavingHospede(true);
    try {
      const updated = await dayUseApi.adicionarHospede(detailDU.id, hospedeSelected);
      reloadAndSync(updated);
      setShowAddHospede(false);
      notify('Hóspede adicionado.');
    } catch {
      notify('Erro ao adicionar hóspede.', 'error');
    } finally {
      setSavingHospede(false);
    }
  };

  const handleRemoveHospede = async (hospedeId) => {
    try {
      const updated = await dayUseApi.removerHospede(detailDU.id, hospedeId);
      reloadAndSync(updated);
      notify('Hóspede removido.');
    } catch {
      notify('Erro ao remover hóspede.', 'error');
    }
  };

  // ── Handlers: add consumo ─────────────────────────────────────────────────
  const openAddConsumo = () => {
    setConsumoCategoria('');
    setConsumoProduto('');
    setConsumoQty(1);
    setConsumoForma('');
    setShowAddConsumo(true);
  };

  const handleSaveConsumo = async () => {
    if (!consumoProdutoSel || !consumoForma) return;
    setSavingConsumo(true);
    try {
      const updated = await dayUseApi.adicionarConsumo(detailDU.id, {
        categoria:      consumoCatSel.nome,
        item:           consumoProdutoSel.nome,
        quantidade:     consumoQty,
        valorUnitario:  consumoProdutoSel.preco,
        valorTotal:     consumoProdutoSel.preco * consumoQty,
        formaPagamento: consumoForma,
      });
      reloadAndSync(updated);
      setShowAddConsumo(false);
      notify('Consumo adicionado.');
    } catch {
      notify('Erro ao adicionar consumo.', 'error');
    } finally {
      setSavingConsumo(false);
    }
  };

  // ── Handlers: add pagamento ───────────────────────────────────────────────
  const openAddPagamento = () => {
    setPagamentoDesc('');
    setPagamentoForma('');
    setPagamentoValor('');
    setPagamentoComprovante(null);
    if (comprovanteRef.current) comprovanteRef.current.value = '';
    setShowAddPagamento(true);
  };

  const handleSavePagamento = async () => {
    const valor = parseBRL(pagamentoValor);
    if (!pagamentoDesc || !pagamentoForma || valor <= 0) return;
    setSavingPagamento(true);
    try {
      const now = new Date();
      const updated = await dayUseApi.adicionarPagamento(detailDU.id, {
        descricao:      pagamentoDesc,
        formaPagamento: pagamentoForma,
        valor,
        data:           `${dateToDisplay(now)} ${nowTimeStr()}`,
        comprovante:    pagamentoComprovante?.name || null,
      });
      reloadAndSync(updated);
      setShowAddPagamento(false);
      notify('Pagamento registrado.');
    } catch {
      notify('Erro ao registrar pagamento.', 'error');
    } finally {
      setSavingPagamento(false);
    }
  };

  // ── Handlers: status changes ──────────────────────────────────────────────
  const handleFinalizar = async () => {
    setConfirmLoading(true);
    try {
      const newStatus = detailDU.pagamentoPendente > 0
        ? STATUS_DU.FINALIZADO_PENDENTE
        : STATUS_DU.FINALIZADO;
      const updated = await dayUseApi.atualizarStatus(detailDU.id, newStatus);
      reloadAndSync(updated);
      setShowFinalizar(false);
      notify('Day Use finalizado.');
    } catch {
      notify('Erro ao finalizar.', 'error');
    } finally {
      setConfirmLoading(false);
    }
  };

  const handleCancelar = async () => {
    setConfirmLoading(true);
    try {
      const updated = await dayUseApi.atualizarStatus(detailDU.id, STATUS_DU.CANCELADO);
      reloadAndSync(updated);
      setShowCancelar(false);
      notify('Day Use cancelado.');
    } catch {
      notify('Erro ao cancelar.', 'error');
    } finally {
      setConfirmLoading(false);
    }
  };

  // ── Handlers: nova day use ────────────────────────────────────────────────
  const openNovaDU = () => {
    setDuHospedes([]);
    setDuHospedeSearch('');
    setDuQuarto('');
    setDuRoomSearch('');
    setDuDate(todayDate());
    setDuEntrada(nowTimeStr());
    setDuPagamentos([]);
    setDuPagDesc('');
    setDuPagForma('');
    setDuPagValor('');
    setShowNovaDU(true);
  };

  const addDuPagamento = () => {
    const valor = parseBRL(duPagValor);
    if (!duPagDesc || !duPagForma || valor <= 0) return;
    setDuPagamentos((prev) => [...prev, { descricao: duPagDesc, formaPagamento: duPagForma, valor }]);
    setDuPagDesc('');
    setDuPagForma('');
    setDuPagValor('');
  };

  const handleSaveNovaDU = async () => {
    if (!duQuarto || duHospedes.length === 0 || !duDate || !duEntrada) return;
    setSavingNova(true);
    try {
      const catObj   = getCategoriaDoQuarto(duQuarto);
      const pricing  = catObj ? DAY_USE_PRICING[catObj.nome] : null;
      const titular  = duHospedes[0];
      const now      = new Date();
      const created = await dayUseApi.criar({
        quarto:         Number(duQuarto),
        categoria:      catObj?.nome || '',
        tipo:           TIPOS_ACOMODACAO[Math.min(duPessoas - 1, TIPOS_ACOMODACAO.length - 1)],
        titularNome:    titular.nome,
        dataUso:        dateToDisplay(duDate),
        horaEntrada:    duEntrada,
        horaSaida:      null,
        status:         STATUS_DU.ATIVO,
        horasBase:      pricing?.horasBase   || 2,
        precoBase:      pricing?.precoFixo   || 0,
        precoAdicional: pricing?.precoAdicional || 0,
        modo:           pricing?.modo        || 'padrao',
        valorTotal:     0,
        totalPago:      duTotalPago,
        pagamentoPendente: 0,
        hospedes:       duHospedes.map(({ id, nome, cpf, telefone }) => ({ id, nome, cpf, telefone })),
        consumos:       [],
        pagamentos:     duPagamentos.map((p, i) => ({
          ...p, id: i + 1, data: `${dateToDisplay(now)} ${nowTimeStr()}`,
        })),
      });
      setDayUses((prev) => [created, ...prev]);
      setShowNovaDU(false);
      notify('Day Use criado com sucesso!');
    } catch {
      notify('Erro ao criar Day Use.', 'error');
    } finally {
      setSavingNova(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className={styles.page}>
      {notification && (
        <Notification
          message={notification.message}
          type={notification.type}
          onClose={() => setNotification(null)}
        />
      )}

      {/* ── Main card ── */}
      <div className={styles.card}>

        {/* Toolbar (header inside card — same pattern as Pernoites) */}
        <div className={styles.tableHeader}>
          <div>
            <h2 className={styles.h2}>Day Use</h2>
            <p className={styles.subtitle}>
              <Clock size={13} /> Gerenciamento de hospedagens por período
            </p>
          </div>
          <div className={styles.tableTools}>
            <div className={styles.searchWrap}>
              <Search size={14} className={styles.searchIcon} />
              <Input
                className={styles.searchInput}
                placeholder="Buscar titular..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select
              value={filterTipo}
              onChange={(e) => setFilterTipo(e.target.value)}
              style={{ width: 148, flexShrink: 0 }}
            >
              <option value="">Tipo de acomodação</option>
              {TIPOS_ACOMODACAO.map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
            <Select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              style={{ width: 160, flexShrink: 0 }}
            >
              <option value="">Todos os status</option>
              {Object.values(STATUS_DU).map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </Select>
            <Button variant="primary" onClick={openNovaDU}>
              <Plus size={15} /> Novo Day Use
            </Button>
          </div>
        </div>

        {/* Listing */}
        {loading ? (
          <div className={styles.emptyState}>Carregando...</div>
        ) : dayUsesByCategory.every((cat) => cat.items.length === 0) ? (
          <div className={styles.emptyState}>Nenhum Day Use encontrado.</div>
        ) : (
          dayUsesByCategory.map((cat) => {
            if (cat.items.length === 0) return null;
            const isCollapsed = collapsedCats[cat.id];
            return (
              <div key={cat.id} className={styles.categorySection}>
                <button
                  type="button"
                  className={styles.categoryHeader}
                  onClick={() => setCollapsedCats((prev) => ({ ...prev, [cat.id]: !prev[cat.id] }))}
                >
                  <ChevronDown
                    size={15}
                    className={[styles.categoryChevron, isCollapsed ? styles.collapsed : ''].join(' ')}
                  />
                  <Clock size={14} className={styles.catIcon} />
                  <span className={styles.categoryName}>{cat.nome}</span>
                  <span className={styles.categoryCount}>({cat.items.length})</span>
                </button>

                {!isCollapsed && cat.items.map((du) => {
                  const sk = getStatusKey(du.status);
                  const isAtivo = du.status === STATUS_DU.ATIVO;
                  const elapsed = calcElapsedMinutes(du.dataUso, du.horaEntrada, du.horaSaida || null);
                  return (
                    <div key={du.id} className={styles.duRow} onClick={() => openDetail(du)}>
                      <div className={styles.duLeft}>
                        <div className={styles.duRoomBadge}>{fmtNum(du.quarto)}</div>
                        <div>
                          <div className={du.hospedes.length > 0 ? styles.duName : styles.duNamePending}>
                            {du.hospedes.length > 0 ? du.titularNome : 'Day Use em andamento'}
                          </div>
                          <div className={styles.duMeta}>
                            {du.hospedes.length > 0 && (
                              <span className={styles.duMetaItem}>
                                <User size={11} /> {du.hospedes.length} hóspede{du.hospedes.length !== 1 ? 's' : ''}
                              </span>
                            )}
                            <span className={styles.duMetaItem}>{du.dataUso}</span>
                            {isAtivo ? (
                              <span className={styles.timerLive}>
                                <Clock size={11} />
                                {fmtElapsed(elapsed)}
                              </span>
                            ) : du.horaSaida ? (
                              <span className={styles.timerStatic}>
                                <Clock size={11} />
                                {du.horaEntrada} → {du.horaSaida} ({fmtElapsed(elapsed)})
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      <div className={styles.duRight}>
                        <span className={[styles.statusBadge, styles[`status_${sk}`]].join(' ')}>
                          {du.status}
                        </span>
                        {du.valorTotal > 0 && (
                          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
                            {fmtBRL(du.valorTotal)}
                          </span>
                        )}
                        {du.pagamentoPendente > 0 && (
                          <span className={styles.pendenteBadge}>
                            Pendente {fmtBRL(du.pagamentoPendente)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })
        )}
      </div>

      {/* ══════════════════════════════════════════════════
          MODAL: Detail
      ══════════════════════════════════════════════════ */}
      <Modal
        open={showDetail}
        onClose={() => setShowDetail(false)}
        size="lg"
        title={
          detailDU ? (
            <div className={styles.detailModalTitle}>
              <div className={styles.detailRoomBadge}>{fmtNum(detailDU.quarto)}</div>
              <div>
                <div className={detailDU.hospedes.length > 0 ? styles.detailTitular : styles.detailTitularPending}>
                  {detailDU.hospedes.length > 0 ? detailDU.titularNome : 'Day Use em andamento'}
                </div>
                <div className={styles.detailMeta}>
                  <span className={[styles.statusBadge, styles[`status_${getStatusKey(detailDU.status)}`]].join(' ')}>
                    {detailDU.status}
                  </span>
                  <span className={styles.detailPeriodo}>
                    {detailDU.dataUso} · {detailDU.horaEntrada}
                    {detailDU.horaSaida ? ` → ${detailDU.horaSaida}` : ' · em andamento'}
                  </span>
                </div>
              </div>
            </div>
          ) : 'Day Use'
        }
        footer={
          <div className={styles.detailFooter}>
            {detailDU?.status === STATUS_DU.ATIVO && (
              <>
                <Button variant="danger" onClick={() => setShowCancelar(true)}>
                  <XCircle size={14} /> Cancelar
                </Button>
                <Button variant="primary" onClick={openEncerrar}>
                  <Square size={14} /> Encerrar
                </Button>
              </>
            )}
            {detailDU?.status === STATUS_DU.ENCERRADO && (
              <>
                <Button variant="danger" onClick={() => setShowCancelar(true)}>
                  <XCircle size={14} /> Cancelar
                </Button>
                <Button variant="secondary" onClick={() => setShowFinalizar(true)}>
                  <CheckCircle size={14} /> Finalizar
                </Button>
              </>
            )}
            <Button variant="secondary" onClick={() => setShowDetail(false)}>Fechar</Button>
          </div>
        }
      >
        {detailDU && (
          <>
            {/* Tabs */}
            <div className={styles.detailTabs}>
              {[
                ['dados',      'Dados'],
                ['hospedes',   `Hóspedes (${detailDU.hospedes.length})`],
                ['consumo',    `Consumo (${detailDU.consumos.length})`],
                ['pagamentos', `Pagamentos (${detailDU.pagamentos.length})`],
              ].map(([t, label]) => (
                <button
                  key={t}
                  type="button"
                  className={[styles.detailTab, detailTab === t ? styles.detailTabActive : ''].join(' ')}
                  onClick={() => setDetailTab(t)}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className={styles.detailTabBody}>

              {/* Tab: Dados */}
              {detailTab === 'dados' && (
                <div className={styles.tabContent}>
                  {/* 4-card summary */}
                  <div className={styles.summaryGrid}>
                    <div className={styles.summaryCard}>
                      <span className={styles.summaryLabel}>
                        Valor base ({detailDU.horasBase}h)
                      </span>
                      <span className={styles.summaryValue}>{fmtBRL(detailDU.precoBase)}</span>
                    </div>
                    <div className={styles.summaryCard}>
                      <span className={styles.summaryLabel}>Hora adicional</span>
                      <span className={styles.summaryValue}>{fmtBRL(detailDU.precoAdicional)}/h</span>
                    </div>
                    <div className={styles.summaryCard}>
                      <span className={styles.summaryLabel}>Tempo decorrido</span>
                      {detailDU.status === STATUS_DU.ATIVO ? (
                        <span className={styles.clockRunning}>
                          {fmtClock(detailElapsedSec)}
                        </span>
                      ) : (
                        <span className={styles.summaryValue}>{fmtElapsed(detailElapsed)}</span>
                      )}
                    </div>
                    <div className={styles.summaryCard}>
                      <span className={styles.summaryLabel}>
                        {detailDU.status === STATUS_DU.ATIVO ? 'Total até agora' : 'Total cobrado'}
                      </span>
                      <span className={[
                        styles.summaryValue,
                        detailDU.status !== STATUS_DU.ATIVO ? styles.summaryValueGreen : '',
                      ].join(' ')}>
                        {detailDU.status === STATUS_DU.ATIVO
                          ? fmtBRL(detailValorAtual)
                          : fmtBRL(detailDU.valorTotal)}
                      </span>
                    </div>
                  </div>

                  {/* Payment progress (only after encerrado) */}
                  {detailDU.status !== STATUS_DU.ATIVO && detailDU.valorTotal > 0 && (
                    <div className={styles.progressWrap}>
                      <div className={styles.progressLabel}>
                        <span>Progresso de pagamento</span>
                        <span>{Math.round(progressPercent)}%</span>
                      </div>
                      <div className={styles.progressBar}>
                        <div className={styles.progressFill} style={{ width: `${progressPercent}%` }} />
                      </div>
                    </div>
                  )}

                  {/* Info grid */}
                  <div className={styles.infoGrid}>
                    <div className={styles.infoRow}>
                      <span className={styles.infoLabel}>Quarto</span>
                      <span className={styles.infoValue}>{fmtNum(detailDU.quarto)} — {detailDU.categoria}</span>
                    </div>
                    <div className={styles.infoRow}>
                      <span className={styles.infoLabel}>Hóspedes</span>
                      <span className={styles.infoValue}>{detailDU.hospedes.length} pessoa{detailDU.hospedes.length !== 1 ? 's' : ''}</span>
                    </div>
                    <div className={styles.infoRow}>
                      <span className={styles.infoLabel}>Data</span>
                      <span className={styles.infoValue}>{detailDU.dataUso}</span>
                    </div>
                    <div className={styles.infoRow}>
                      <span className={styles.infoLabel}>Entrada</span>
                      <span className={styles.infoValue}>{detailDU.horaEntrada}</span>
                    </div>
                    {detailDU.horaSaida && (
                      <>
                        <div className={styles.infoRow}>
                          <span className={styles.infoLabel}>Saída</span>
                          <span className={styles.infoValue}>{detailDU.horaSaida}</span>
                        </div>
                        <div className={styles.infoRow}>
                          <span className={styles.infoLabel}>Total pago</span>
                          <span className={styles.infoValue}>{fmtBRL(detailDU.totalPago)}</span>
                        </div>
                        {detailDU.pagamentoPendente > 0 && (
                          <div className={styles.infoRow}>
                            <span className={styles.infoLabel}>Pendente</span>
                            <span className={[styles.infoValue, styles.summaryValueAmber].join(' ')}>
                              {fmtBRL(detailDU.pagamentoPendente)}
                            </span>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Actions */}
                  {detailDU.status === STATUS_DU.ENCERRADO && (
                    <div>
                      <Button variant="secondary" onClick={openEditDados}>
                        <Edit2 size={13} /> Editar Dados
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* Tab: Hóspedes */}
              {detailTab === 'hospedes' && (
                <div className={styles.tabContent}>
                  {detailDU.status === STATUS_DU.ATIVO && (
                    <Button variant="primary" onClick={openAddHospede}>
                      <Plus size={14} /> Adicionar Hóspede
                    </Button>
                  )}
                  {detailDU.hospedes.length === 0 ? (
                    <div className={styles.emptyState}>Nenhum hóspede registrado.</div>
                  ) : (
                    <div className={styles.itemList}>
                      {detailDU.hospedes.map((h) => (
                        <div key={h.id} className={styles.listItem}>
                          <div className={styles.listItemLeft}>
                            <User size={14} className={styles.listItemIcon} />
                            <div>
                              <div className={styles.listItemName}>{h.nome}</div>
                              <div className={styles.listItemSub}>CPF: {h.cpf} · {h.telefone}</div>
                            </div>
                          </div>
                          {detailDU.status === STATUS_DU.ATIVO && (
                            <button type="button" className={styles.removeBtn} onClick={() => handleRemoveHospede(h.id)}>
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Tab: Consumo */}
              {detailTab === 'consumo' && (
                <div className={styles.tabContent}>
                  {(detailDU.status === STATUS_DU.ATIVO || detailDU.status === STATUS_DU.ENCERRADO) && (
                    <Button variant="primary" onClick={openAddConsumo}>
                      <Plus size={14} /> Adicionar Consumo
                    </Button>
                  )}
                  {detailDU.consumos.length === 0 ? (
                    <div className={styles.emptyState}>Nenhum consumo registrado.</div>
                  ) : (
                    <div className={styles.itemList}>
                      {detailDU.consumos.map((c) => (
                        <div key={c.id} className={styles.listItem}>
                          <div className={styles.listItemLeft}>
                            <ShoppingCart size={14} className={styles.listItemIconGreen} />
                            <div>
                              <div className={styles.listItemName}>{c.item}</div>
                              <div className={styles.listItemSub}>
                                {c.categoria} · Qtd: {c.quantidade} · {fmtBRL(c.valorUnitario)}/un · {c.formaPagamento}
                              </div>
                            </div>
                          </div>
                          <span className={styles.listItemValue}>{fmtBRL(c.valorTotal)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Tab: Pagamentos */}
              {detailTab === 'pagamentos' && (
                <div className={styles.tabContent}>
                  {detailDU.status === STATUS_DU.ENCERRADO && (
                    <Button variant="primary" onClick={openAddPagamento}>
                      <Plus size={14} /> Adicionar Pagamento
                    </Button>
                  )}
                  {detailDU.pagamentos.length === 0 ? (
                    <div className={styles.emptyState}>Nenhum pagamento registrado.</div>
                  ) : (
                    <div className={styles.itemList}>
                      {detailDU.pagamentos.map((p) => (
                        <div key={p.id} className={styles.listItem}>
                          <div className={styles.listItemLeft}>
                            <CreditCard size={14} className={styles.listItemIconGreen} />
                            <div>
                              <div className={styles.listItemName}>{p.descricao}</div>
                              <div className={styles.listItemSub}>
                                {p.formaPagamento} · {p.data}
                                {p.comprovante && (
                                  <span className={styles.comprovanteTag}>
                                    <Paperclip size={10} /> {p.comprovante}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <span className={[styles.listItemValue, styles.valueGreen].join(' ')}>
                            {fmtBRL(p.valor)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </Modal>

      {/* ══════════════════════════════════════════════════
          MODAL: Encerrar Day Use
      ══════════════════════════════════════════════════ */}
      <Modal
        open={showEncerrar}
        onClose={() => setShowEncerrar(false)}
        size="sm"
        title="Encerrar Day Use"
        footer={
          <div className={styles.modalFooterRow}>
            <Button variant="secondary" onClick={() => setShowEncerrar(false)}>Cancelar</Button>
            <Button variant="primary" onClick={handleEncerrar} disabled={confirmLoading}>
              {confirmLoading ? 'Encerrando...' : 'Confirmar Encerramento'}
            </Button>
          </div>
        }
      >
        <div className={styles.formStack}>
          <p className={styles.confirmText}>
            Encerrar o Day Use de{' '}
            <span className={styles.confirmName}>{detailDU?.titularNome}</span>?
          </p>
          <div className={styles.encerrarSummary}>
            <div className={styles.encerrarRow}>
              <span className={styles.encerrarLabel}>Horário de saída</span>
              <span className={styles.encerrarVal}>{encerrarHoraSaida}</span>
            </div>
            <div className={styles.encerrarRow}>
              <span className={styles.encerrarLabel}>Tempo total</span>
              <span className={styles.encerrarVal}>{fmtElapsed(encerrarElapsed)}</span>
            </div>
            <div className={styles.encerrarRow}>
              <span className={styles.encerrarLabel}>Valor base ({detailDU?.horasBase}h)</span>
              <span className={styles.encerrarVal}>{fmtBRL(detailDU?.precoBase)}</span>
            </div>
            {encerrarElapsed > (detailDU?.horasBase || 2) * 60 && (
              <div className={styles.encerrarRow}>
                <span className={styles.encerrarLabel}>
                  Horas adicionais ({Math.ceil((encerrarElapsed - (detailDU?.horasBase || 2) * 60) / 60)}h × {fmtBRL(detailDU?.precoAdicional)})
                </span>
                <span className={styles.encerrarVal}>
                  {fmtBRL(encerrarValor - (detailDU?.precoBase || 0))}
                </span>
              </div>
            )}
            <div className={styles.encerrarRow}>
              <span className={styles.encerrarLabel}>Total a cobrar</span>
              <span className={styles.encerrarValGreen}>{fmtBRL(encerrarValor)}</span>
            </div>
          </div>
        </div>
      </Modal>

      {/* ══════════════════════════════════════════════════
          MODAL: Editar Dados (ENCERRADO only)
      ══════════════════════════════════════════════════ */}
      <Modal
        open={showEditDados}
        onClose={() => setShowEditDados(false)}
        size="sm"
        title="Editar Day Use"
        footer={
          <div className={styles.modalFooterRow}>
            <Button variant="secondary" onClick={() => setShowEditDados(false)}>Cancelar</Button>
            <Button variant="primary" onClick={handleSaveEditDados} disabled={savingDados || !editDate}>
              {savingDados ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        }
      >
        <div className={styles.formStack}>
          <DatePicker label="Data" value={editDate} onChange={setEditDate} />
          <div className={styles.grid2}>
            <TimeInput label="Hora entrada" value={editEntrada} onChange={setEditEntrada} />
            <TimeInput label="Hora saída"   value={editSaida}   onChange={setEditSaida} />
          </div>
        </div>
      </Modal>

      {/* ══════════════════════════════════════════════════
          MODAL: Add Hóspede
      ══════════════════════════════════════════════════ */}
      <Modal
        open={showAddHospede}
        onClose={() => setShowAddHospede(false)}
        size="sm"
        title="Adicionar Hóspede"
        footer={
          <div className={styles.modalFooterRow}>
            <Button variant="secondary" onClick={() => setShowAddHospede(false)}>Cancelar</Button>
            <Button variant="primary" onClick={handleSaveHospede} disabled={!hospedeSelected || savingHospede}>
              {savingHospede ? 'Adicionando...' : 'Adicionar'}
            </Button>
          </div>
        }
      >
        <div className={styles.formStack}>
          <Input
            placeholder="Buscar por nome..."
            value={hospedeSearch}
            onChange={(e) => { setHospedeSearch(e.target.value); setHospedeSelected(null); }}
          />
          <div className={styles.itemList}>
            {filteredHospedes.map((h) => (
              <div
                key={h.id}
                className={styles.listItem}
                style={{
                  cursor: 'pointer',
                  background: hospedeSelected?.id === h.id ? 'rgba(16,185,129,0.08)' : undefined,
                  borderColor: hospedeSelected?.id === h.id ? '#059669' : undefined,
                }}
                onClick={() => setHospedeSelected(h)}
              >
                <div className={styles.listItemLeft}>
                  <User size={14} className={styles.listItemIcon} />
                  <div>
                    <div className={styles.listItemName}>{h.nome}</div>
                    <div className={styles.listItemSub}>CPF: {h.cpf}</div>
                  </div>
                </div>
                {hospedeSelected?.id === h.id && <Check size={14} style={{ color: '#059669' }} />}
              </div>
            ))}
          </div>
        </div>
      </Modal>

      {/* ══════════════════════════════════════════════════
          MODAL: Add Consumo
      ══════════════════════════════════════════════════ */}
      <Modal
        open={showAddConsumo}
        onClose={() => setShowAddConsumo(false)}
        size="sm"
        title="Adicionar Consumo"
        footer={
          <div className={styles.modalFooterRow}>
            <Button variant="secondary" onClick={() => setShowAddConsumo(false)}>Cancelar</Button>
            <Button
              variant="primary"
              onClick={handleSaveConsumo}
              disabled={!consumoProdutoSel || !consumoForma || savingConsumo}
            >
              {savingConsumo ? 'Salvando...' : 'Adicionar'}
            </Button>
          </div>
        }
      >
        <div className={styles.formStack}>
          <FormField label="Categoria">
            <Select value={consumoCategoria} onChange={(e) => { setConsumoCategoria(e.target.value); setConsumoProduto(''); }}>
              <option value="">Selecionar categoria</option>
              {CATEGORIAS_CONSUMO.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </Select>
          </FormField>
          <FormField label="Produto">
            <Select value={consumoProduto} onChange={(e) => setConsumoProduto(e.target.value)} disabled={!consumoCategoria}>
              <option value="">Selecionar produto</option>
              {consumoCatSel?.produtos.map((p) => (
                <option key={p.id} value={p.id}>{p.nome} — {fmtBRL(p.preco)}</option>
              ))}
            </Select>
          </FormField>
          <div className={styles.grid2}>
            <FormField label="Quantidade">
              <Input
                type="number" min={1}
                value={consumoQty}
                onChange={(e) => setConsumoQty(Math.max(1, parseInt(e.target.value) || 1))}
              />
            </FormField>
            <FormField label="Forma de Pagamento">
              <Select value={consumoForma} onChange={(e) => setConsumoForma(e.target.value)}>
                <option value="">Selecionar</option>
                {FORMAS_PAGAMENTO.map((f) => <option key={f} value={f}>{f}</option>)}
              </Select>
            </FormField>
          </div>
          {consumoProdutoSel && (
            <div className={styles.confirmHint}>
              <Check size={14} /> Total: {fmtBRL(consumoProdutoSel.preco * consumoQty)}
            </div>
          )}
        </div>
      </Modal>

      {/* ══════════════════════════════════════════════════
          MODAL: Add Pagamento
      ══════════════════════════════════════════════════ */}
      <Modal
        open={showAddPagamento}
        onClose={() => setShowAddPagamento(false)}
        size="sm"
        title="Registrar Pagamento"
        footer={
          <div className={styles.modalFooterRow}>
            <Button variant="secondary" onClick={() => setShowAddPagamento(false)}>Cancelar</Button>
            <Button
              variant="primary"
              onClick={handleSavePagamento}
              disabled={!pagamentoDesc || !pagamentoForma || parseBRL(pagamentoValor) <= 0 || savingPagamento}
            >
              {savingPagamento ? 'Salvando...' : 'Registrar'}
            </Button>
          </div>
        }
      >
        <div className={styles.formStack}>
          <FormField label="Descrição">
            <Input
              placeholder="Ex: Entrada, Pagamento integral..."
              value={pagamentoDesc}
              onChange={(e) => setPagamentoDesc(e.target.value)}
            />
          </FormField>
          <div className={styles.grid2}>
            <FormField label="Forma de Pagamento">
              <Select value={pagamentoForma} onChange={(e) => setPagamentoForma(e.target.value)}>
                <option value="">Selecionar</option>
                {FORMAS_PAGAMENTO.map((f) => <option key={f} value={f}>{f}</option>)}
              </Select>
            </FormField>
            <FormField label="Valor (R$)">
              <Input
                value={pagamentoValor}
                onChange={(e) => setPagamentoValor(maskBRL(e.target.value))}
                placeholder="R$ 0,00"
              />
            </FormField>
          </div>
          <FormField label="Comprovante (opcional)">
            <label className={styles.fileInputWrap}>
              <input
                ref={comprovanteRef}
                type="file"
                accept="image/*,.pdf"
                className={styles.fileInputHidden}
                onChange={(e) => setPagamentoComprovante(e.target.files?.[0] || null)}
              />
              <Paperclip size={13} className={styles.fileInputIcon} />
              <span className={styles.fileInputName}>
                {pagamentoComprovante ? pagamentoComprovante.name : 'Nenhum arquivo selecionado'}
              </span>
              <span className={styles.fileInputBtn}>Escolher</span>
            </label>
          </FormField>
          {detailDU?.pagamentoPendente > 0 && (
            <div className={styles.infoHint}>
              Pendente: {fmtBRL(detailDU.pagamentoPendente)}
            </div>
          )}
        </div>
      </Modal>

      {/* ══════════════════════════════════════════════════
          MODAL: Finalizar
      ══════════════════════════════════════════════════ */}
      <Modal
        open={showFinalizar}
        onClose={() => setShowFinalizar(false)}
        size="sm"
        title="Finalizar Day Use"
        footer={
          <div className={styles.modalFooterRow}>
            <Button variant="secondary" onClick={() => setShowFinalizar(false)}>Cancelar</Button>
            <Button variant="primary" onClick={handleFinalizar} disabled={confirmLoading}>
              {confirmLoading ? 'Finalizando...' : 'Confirmar'}
            </Button>
          </div>
        }
      >
        <p className={styles.confirmText}>
          Finalizar o Day Use de{' '}
          <span className={styles.confirmName}>{detailDU?.titularNome}</span>?
          {detailDU?.pagamentoPendente > 0 && (
            <> Há pagamento pendente de{' '}
              <span style={{ color: '#d97706', fontWeight: 700 }}>
                {fmtBRL(detailDU.pagamentoPendente)}
              </span>.
            </>
          )}
        </p>
      </Modal>

      {/* ══════════════════════════════════════════════════
          MODAL: Cancelar
      ══════════════════════════════════════════════════ */}
      <Modal
        open={showCancelar}
        onClose={() => setShowCancelar(false)}
        size="sm"
        title="Cancelar Day Use"
        footer={
          <div className={styles.modalFooterRow}>
            <Button variant="secondary" onClick={() => setShowCancelar(false)}>Não</Button>
            <Button variant="danger" onClick={handleCancelar} disabled={confirmLoading}>
              {confirmLoading ? 'Cancelando...' : 'Cancelar Day Use'}
            </Button>
          </div>
        }
      >
        <p className={styles.confirmText}>
          Tem certeza que deseja cancelar o Day Use de{' '}
          <span className={styles.confirmName}>{detailDU?.titularNome}</span>? Esta ação não pode ser desfeita.
        </p>
      </Modal>

      {/* ══════════════════════════════════════════════════
          MODAL: Novo Day Use
      ══════════════════════════════════════════════════ */}
      <Modal
        open={showNovaDU}
        onClose={() => setShowNovaDU(false)}
        size="xl"
        title="Novo Day Use"
        footer={
          <div className={styles.modalFooterRow}>
            <Button variant="secondary" onClick={() => setShowNovaDU(false)}>Cancelar</Button>
            <Button
              variant="primary"
              onClick={handleSaveNovaDU}
              disabled={savingNova || !duQuarto || duHospedes.length === 0 || !duDate || !duEntrada}
            >
              {savingNova ? 'Iniciando...' : 'Iniciar Day Use'}
            </Button>
          </div>
        }
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          {/* Left column */}
          <div className={styles.formStack}>
            {/* Quarto */}
            <div className={styles.formSection}>
              <Clock size={12} className={styles.formSectionIcon} /> Quarto
            </div>
            <Input
              placeholder="Buscar quarto..."
              value={duRoomSearch}
              onChange={(e) => { setDuRoomSearch(e.target.value); setDuQuarto(''); }}
            />
            {duRoomsFiltered.length > 0 ? (
              <div className={styles.roomByCatWrap}>
                {duRoomsFiltered.map((cat) => (
                  <div key={cat.id} className={styles.roomCatGroup}>
                    <span className={styles.roomCatLabel}>{cat.nome}</span>
                    <div className={styles.roomGrid}>
                      {cat.quartos.map((q) => (
                        <button
                          key={q}
                          type="button"
                          className={[styles.roomBtn, String(duQuarto) === String(q) ? styles.roomBtnActive : ''].join(' ')}
                          onClick={() => setDuQuarto(String(q))}
                        >
                          {fmtNum(q)}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 12, color: 'var(--text-2)', textAlign: 'center' }}>
                Nenhum quarto encontrado.
              </div>
            )}

            {/* Pricing hint */}
            {duPricing && (
              <div className={styles.pricingHint}>
                <div className={styles.pricingHintItem}>
                  <span className={styles.pricingHintLabel}>Valor base ({duHorasBase}h)</span>
                  <span className={styles.pricingHintVal}>{fmtBRL(duPrecoBase)}</span>
                </div>
                <div className={styles.pricingHintSep} />
                <div className={styles.pricingHintItem}>
                  <span className={styles.pricingHintLabel}>Hora adicional</span>
                  <span className={styles.pricingHintVal}>{fmtBRL(duPrecoAdc)}/h</span>
                </div>
              </div>
            )}

            {/* Entrada */}
            <div className={styles.formSection} style={{ marginTop: 4 }}>
              <Clock size={12} className={styles.formSectionIcon} /> Início
            </div>
            <DatePicker label="Data" value={duDate} onChange={setDuDate} />
            <TimeInput label="Hora de entrada" value={duEntrada} onChange={setDuEntrada} />
            <div className={styles.infoHint}>
              A hora de saída será definida ao encerrar o Day Use.
            </div>
          </div>

          {/* Right column */}
          <div className={styles.formStack}>
            {/* Hóspedes */}
            <div className={styles.formSection}>
              <User size={12} className={styles.formSectionIcon} /> Hóspedes
            </div>

            {duHospedes.length > 0 && (
              <div className={styles.hospedeChips}>
                {duHospedes.map((h, idx) => (
                  <span
                    key={h.id}
                    className={[styles.hospedeChip, idx === 0 ? styles.hospedeChipTitular : ''].join(' ')}
                  >
                    <span className={styles.hospedeChipName}>
                      {h.nome}{idx === 0 ? ' (titular)' : ''}
                    </span>
                    <button
                      type="button"
                      className={styles.hospedeChipRemove}
                      onClick={() => setDuHospedes((prev) => prev.filter((x) => x.id !== h.id))}
                    >
                      <X size={11} />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <Input
              placeholder="Buscar por nome ou CPF..."
              value={duHospedeSearch}
              onChange={(e) => setDuHospedeSearch(e.target.value)}
            />

            {(duPersonResults.acompanhantes.length > 0 || duPersonResults.outros.length > 0) && (
              <div className={styles.hospedeResults}>
                {duPersonResults.acompanhantes.length > 0 && (
                  <>
                    <div className={styles.hospedeResultSection}>Acompanhantes do titular</div>
                    {duPersonResults.acompanhantes.map((h) => (
                      <div
                        key={h.id}
                        className={styles.hospedeResult}
                        onClick={() => { setDuHospedes((prev) => [...prev, h]); setDuHospedeSearch(''); }}
                      >
                        <span className={styles.hospedeResultName}>{h.nome}</span>
                        <span className={styles.hospedeResultSub}>CPF: {h.cpf} · {h.telefone}</span>
                      </div>
                    ))}
                  </>
                )}
                {duPersonResults.outros.length > 0 && (
                  <>
                    <div className={styles.hospedeResultSection}>Outros hóspedes</div>
                    {duPersonResults.outros.map((h) => (
                      <div
                        key={h.id}
                        className={styles.hospedeResult}
                        onClick={() => { setDuHospedes((prev) => [...prev, h]); setDuHospedeSearch(''); }}
                      >
                        <span className={styles.hospedeResultName}>{h.nome}</span>
                        <span className={styles.hospedeResultSub}>CPF: {h.cpf} · {h.telefone}</span>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}

            {duHospedes.length === 0 && duPersonResults.acompanhantes.length === 0 && duPersonResults.outros.length === 0 && (
              <div className={styles.hospedeResults}>
                <div className={styles.hospedeResultEmpty}>
                  {duHospedeSearch ? 'Nenhum hóspede encontrado.' : 'Digite um nome ou CPF para buscar.'}
                </div>
              </div>
            )}

            {/* Pagamentos iniciais */}
            <div className={styles.formSection} style={{ marginTop: 4 }}>
              <DollarSign size={12} className={styles.formSectionIcon} /> Pagamento inicial (opcional)
            </div>

            <div className={styles.grid2}>
              <FormField label="Descrição">
                <Input
                  placeholder="Ex: Entrada..."
                  value={duPagDesc}
                  onChange={(e) => setDuPagDesc(e.target.value)}
                />
              </FormField>
              <FormField label="Forma">
                <Select value={duPagForma} onChange={(e) => setDuPagForma(e.target.value)}>
                  <option value="">Selecionar</option>
                  {FORMAS_PAGAMENTO.map((f) => <option key={f} value={f}>{f}</option>)}
                </Select>
              </FormField>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}>
                <FormField label="Valor (R$)">
                  <Input
                    value={duPagValor}
                    onChange={(e) => setDuPagValor(maskBRL(e.target.value))}
                    placeholder="R$ 0,00"
                  />
                </FormField>
              </div>
              <Button
                variant="secondary"
                onClick={addDuPagamento}
                disabled={!duPagDesc || !duPagForma || parseBRL(duPagValor) <= 0}
              >
                <Plus size={14} />
              </Button>
            </div>

            {duPagamentos.length > 0 && (
              <div className={styles.pagList}>
                {duPagamentos.map((p, i) => (
                  <div key={i} className={styles.pagItem}>
                    <div className={styles.pagItemLeft}>
                      <span className={styles.pagItemName}>{p.descricao}</span>
                      <span className={styles.pagItemSub}>{p.formaPagamento}</span>
                    </div>
                    <div className={styles.pagItemRight}>
                      <span className={styles.pagItemVal}>{fmtBRL(p.valor)}</span>
                      <button type="button" className={styles.removeBtn} onClick={() => removeDuPagamento(i)}>
                        <X size={12} />
                      </button>
                    </div>
                  </div>
                ))}
                <div className={styles.pagTotal}>
                  <span className={styles.pagTotalLabel}>Total pago</span>
                  <span className={styles.pagTotalVal}>{fmtBRL(duTotalPago)}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );

  function removeDuPagamento(idx) {
    setDuPagamentos((prev) => prev.filter((_, i) => i !== idx));
  }
}
