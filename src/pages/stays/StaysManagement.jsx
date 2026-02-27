import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  BedDouble, Plus, Search, Calendar, ChevronDown,
  User, CreditCard, ShoppingCart, Edit2, X, Check,
  ArrowRight, RefreshCw, Trash2,
  CheckCircle, XCircle, DollarSign, Clock,
} from 'lucide-react';
import { Modal }                    from '../../components/ui/Modal';
import { Button }                   from '../../components/ui/Button';
import { Input, Select, FormField } from '../../components/ui/Input';
import { Notification }             from '../../components/ui/Notification';
import {
  stayApi, STATUS, FORMAS_PAGAMENTO,
  CATEGORIAS_QUARTOS, HOSPEDES_CADASTRADOS, CATEGORIAS_CONSUMO,
  getCategoriaDoQuarto, calcPrecoDiaria, diffDays, fmtNum,
} from './staysMocks';
import styles from './StaysManagement.module.css';

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmtBRL = (v) =>
  v == null ? 'R$ 0,00' :
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

function getStatusKey(status) {
  switch (status) {
    case STATUS.ATIVO:               return 'ativo';
    case STATUS.DIARIA_ENCERRADA:    return 'encerrada';
    case STATUS.FINALIZADO:          return 'finalizado';
    case STATUS.CANCELADO:           return 'cancelado';
    case STATUS.FINALIZADO_PENDENTE: return 'pendente';
    default:                         return 'outro';
  }
}

function isoToDisplay(isoDate) {
  if (!isoDate) return '';
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}

function displayToIso(dateStr) {
  if (!dateStr) return '';
  const [dp] = dateStr.split(' ');
  const [d, m, y] = dp.split('/');
  return `${y}-${m}-${d}`;
}

// "DD/MM/YYYY HH:MM" → "DD/MM HH:MM"
function fmtShort(dateTimeStr) {
  if (!dateTimeStr) return '';
  const parts = dateTimeStr.split(' ');
  if (parts.length < 2) return dateTimeStr;
  const [d, m] = parts[0].split('/');
  return `${d}/${m} ${parts[1]}`;
}

// ── Main component ────────────────────────────────────────────────────────────
export default function StaysManagement() {
  const [stays, setStays]               = useState([]);
  const [loading, setLoading]           = useState(true);
  const [notification, setNotification] = useState(null);

  // Filters
  const [search, setSearch]             = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Collapsed category groups
  const [collapsedCats, setCollapsedCats] = useState({});

  // Detail modal
  const [detailStay, setDetailStay]   = useState(null);
  const [showDetail, setShowDetail]   = useState(false);
  const [detailTab, setDetailTab]     = useState('dados');
  const [selectedDiariaIdx, setSelectedDiariaIdx] = useState(0);
  const [diariaTab, setDiariaTab]     = useState('detalhes');

  // Gerenciar diárias modal
  const [showGerenciarDiarias, setShowGerenciarDiarias] = useState(false);
  const [removingDiariaIdx, setRemovingDiariaIdx]       = useState(null);
  const [diariaDataInicio, setDiariaDataInicio] = useState('');
  const [diariaHoraInicio, setDiariaHoraInicio] = useState('14:00');
  const [diariaDataFim, setDiariaDataFim]       = useState('');
  const [diariaHoraFim, setDiariaHoraFim]       = useState('12:00');
  const [savingDiaria, setSavingDiaria]         = useState(false);

  // Edit dados modal
  const [showEditDados, setShowEditDados]     = useState(false);
  const [editCheckinData, setEditCheckinData] = useState('');
  const [editCheckinHora, setEditCheckinHora] = useState('');
  const [editCheckoutData, setEditCheckoutData] = useState('');
  const [editCheckoutHora, setEditCheckoutHora] = useState('');
  const [savingDados, setSavingDados]           = useState(false);

  // Trocar quarto modal
  const [showTrocarQuarto, setShowTrocarQuarto]     = useState(false);
  const [tqCategoria, setTqCategoria]               = useState('');
  const [tqQuarto, setTqQuarto]                     = useState('');
  const [tqDiariasAplicar, setTqDiariasAplicar]     = useState([]);
  const [savingTrocar, setSavingTrocar]             = useState(false);

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
  const [showAddPagamento, setShowAddPagamento] = useState(false);
  const [pagamentoDesc, setPagamentoDesc]       = useState('');
  const [pagamentoForma, setPagamentoForma]     = useState('');
  const [pagamentoValor, setPagamentoValor]     = useState('');
  const [savingPagamento, setSavingPagamento]   = useState(false);

  // Confirm modals
  const [showCancelar, setShowCancelar]   = useState(false);
  const [showFinalizar, setShowFinalizar] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);

  // Nova hospedagem modal
  const [showNovaHosp, setShowNovaHosp]     = useState(false);
  const [nhNome, setNhNome]                 = useState('');
  const [nhCategoria, setNhCategoria]       = useState('');
  const [nhQuarto, setNhQuarto]             = useState('');
  const [nhCheckinData, setNhCheckinData]   = useState('');
  const [nhCheckinHora, setNhCheckinHora]   = useState('14:00');
  const [nhCheckoutData, setNhCheckoutData] = useState('');
  const [nhCheckoutHora, setNhCheckoutHora] = useState('12:00');
  const [nhPessoas, setNhPessoas]           = useState(1);
  const [nhPagamentos, setNhPagamentos]     = useState([]);
  const [nhPagDesc, setNhPagDesc]           = useState('');
  const [nhPagForma, setNhPagForma]         = useState('');
  const [nhPagValor, setNhPagValor]         = useState('');
  const [savingNova, setSavingNova]         = useState(false);

  // ── Load ──────────────────────────────────────────────────────────────────
  const loadStays = useCallback(async () => {
    setLoading(true);
    try {
      const data = await stayApi.listar();
      setStays(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadStays(); }, [loadStays]);

  // ── Notification helper ───────────────────────────────────────────────────
  const notify = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // ── Computed ──────────────────────────────────────────────────────────────
  const filteredStays = useMemo(() =>
    stays.filter((s) => {
      const matchSearch = !search || s.titularNome.toLowerCase().includes(search.toLowerCase());
      const matchStatus = !filterStatus || s.status === filterStatus;
      return matchSearch && matchStatus;
    }),
    [stays, search, filterStatus]
  );

  const staysByCategory = useMemo(() =>
    CATEGORIAS_QUARTOS.map((cat) => ({
      ...cat,
      stays: filteredStays.filter((s) => s.categoria === cat.nome),
    })),
    [filteredStays]
  );

  const currentDiaria  = detailStay?.diarias?.[selectedDiariaIdx];
  const progressPercent = detailStay && detailStay.valorTotal > 0
    ? Math.min(100, (detailStay.totalPago / detailStay.valorTotal) * 100)
    : 0;

  // ── Nova Hospedagem computed ──────────────────────────────────────────────
  const nhTotalDias = useMemo(() => {
    if (!nhCheckinData || !nhCheckoutData) return 0;
    return diffDays(nhCheckinData, nhCheckoutData);
  }, [nhCheckinData, nhCheckoutData]);

  const nhCatQuarto = useMemo(() =>
    CATEGORIAS_QUARTOS.find((c) => c.id === parseInt(nhCategoria)),
    [nhCategoria]
  );

  const nhPrecoDiaria = useMemo(() => {
    if (!nhQuarto) return 0;
    return calcPrecoDiaria(nhQuarto, nhPessoas);
  }, [nhQuarto, nhPessoas]);

  const nhTotalHosp = nhPrecoDiaria * nhTotalDias;
  const nhTotalPago = nhPagamentos.reduce((s, p) => s + p.valor, 0);
  const nhPendente  = Math.max(0, nhTotalHosp - nhTotalPago);

  // ── Add diária computed ───────────────────────────────────────────────────
  const addDiariaDias = useMemo(() => {
    if (!diariaDataInicio || !diariaDataFim) return 0;
    return diffDays(diariaDataInicio, diariaDataFim);
  }, [diariaDataInicio, diariaDataFim]);

  // ── Trocar quarto computed ────────────────────────────────────────────────
  const tqCat = CATEGORIAS_QUARTOS.find((c) => c.id === parseInt(tqCategoria));

  // ── Consumo computed ──────────────────────────────────────────────────────
  const consumoCatSel     = CATEGORIAS_CONSUMO.find((c) => c.id === parseInt(consumoCategoria));
  const consumoProdutoSel = consumoCatSel?.produtos.find((p) => p.id === parseInt(consumoProduto));

  // ── Filtered hóspedes ─────────────────────────────────────────────────────
  const filteredHospedes = HOSPEDES_CADASTRADOS.filter((h) =>
    !hospedeSearch || h.nome.toLowerCase().includes(hospedeSearch.toLowerCase())
  );

  // ── Handlers: detail ─────────────────────────────────────────────────────
  const openDetail = (stay) => {
    setDetailStay(stay);
    setDetailTab('dados');
    setSelectedDiariaIdx(Math.max(0, stay.diariaAtual - 1));
    setDiariaTab('detalhes');
    setShowDetail(true);
  };
  const closeDetail = () => { setShowDetail(false); setDetailStay(null); };

  // ── Reload and sync detailStay ────────────────────────────────────────────
  const reloadAndSync = async (updatedStay) => {
    const all = await stayApi.listar();
    setStays(all);
    if (updatedStay) {
      const fresh = all.find((s) => s.id === updatedStay.id);
      if (fresh) setDetailStay(fresh);
    }
  };

  // ── Handler: gerenciar diárias ────────────────────────────────────────────
  const openGerenciarDiarias = () => {
    if (detailStay?.diarias?.length > 0) {
      const ultima = detailStay.diarias[detailStay.diarias.length - 1];
      const [dp, tp] = ultima.dataFim.split(' ');
      const [d, m, y] = dp.split('/');
      setDiariaDataInicio(`${y}-${m}-${d}`);
      setDiariaHoraInicio(tp || '12:00');
    } else {
      setDiariaDataInicio('');
      setDiariaHoraInicio('14:00');
    }
    setDiariaDataFim('');
    setDiariaHoraFim('12:00');
    setShowGerenciarDiarias(true);
  };

  const handleSaveAddDiaria = async () => {
    if (!diariaDataInicio || !diariaDataFim) { notify('Preencha as datas.', 'warning'); return; }
    setSavingDiaria(true);
    try {
      const nova = {
        quarto: detailStay.quarto,
        valorDiaria: calcPrecoDiaria(detailStay.quarto, 1),
        dataInicio: `${isoToDisplay(diariaDataInicio)} ${diariaHoraInicio}`,
        dataFim:    `${isoToDisplay(diariaDataFim)} ${diariaHoraFim}`,
        hospedes: detailStay.diarias[0]?.hospedes || [],
        consumos: [], pagamentos: [],
      };
      const updated = await stayApi.adicionarDiaria(detailStay.id, nova);
      await reloadAndSync(updated);
      notify(`Diária adicionada. Total: ${updated.totalDiarias} dia(s).`);
      // Keep modal open; pre-fill next start from the new last diária's end
      const newLast = updated.diarias?.[updated.diarias.length - 1];
      if (newLast) {
        const [dp, tp] = newLast.dataFim.split(' ');
        const [d, m, y] = dp.split('/');
        setDiariaDataInicio(`${y}-${m}-${d}`);
        setDiariaHoraInicio(tp || '12:00');
      }
      setDiariaDataFim('');
      setDiariaHoraFim('12:00');
    } finally { setSavingDiaria(false); }
  };

  // ── Handler: remover diária ───────────────────────────────────────────────
  const handleRemoveDiaria = async (diariaIdx) => {
    setRemovingDiariaIdx(diariaIdx);
    try {
      const updated = await stayApi.removerDiaria(detailStay.id, diariaIdx);
      await reloadAndSync(updated);
      if (selectedDiariaIdx >= updated.diarias.length) {
        setSelectedDiariaIdx(Math.max(0, updated.diarias.length - 1));
      }
      if (updated.diarias?.length > 0) {
        const newLast = updated.diarias[updated.diarias.length - 1];
        const [dp, tp] = newLast.dataFim.split(' ');
        const [d, m, y] = dp.split('/');
        setDiariaDataInicio(`${y}-${m}-${d}`);
        setDiariaHoraInicio(tp || '12:00');
      } else {
        setDiariaDataInicio('');
        setDiariaHoraInicio('14:00');
      }
      notify('Diária removida.');
    } catch { notify('Erro ao remover diária.', 'error'); }
    finally { setRemovingDiariaIdx(null); }
  };


  // ── Handler: editar dados ─────────────────────────────────────────────────
  const openEditDados = () => {
    if (!detailStay) return;
    const [dc, hc] = detailStay.chegadaPrevista.split(' ');
    const [ds, hs] = detailStay.saidaPrevista.split(' ');
    setEditCheckinData(displayToIso(dc));
    setEditCheckinHora(hc || '14:00');
    setEditCheckoutData(displayToIso(ds));
    setEditCheckoutHora(hs || '12:00');
    setShowEditDados(true);
  };

  const handleSaveEditDados = async () => {
    if (!editCheckinData || !editCheckoutData) { notify('Preencha as datas.', 'warning'); return; }
    setSavingDados(true);
    try {
      const chegada = `${isoToDisplay(editCheckinData)} ${editCheckinHora}`;
      const saida   = `${isoToDisplay(editCheckoutData)} ${editCheckoutHora}`;
      const updated = await stayApi.atualizar(detailStay.id, {
        chegadaPrevista: chegada, saidaPrevista: saida,
        periodo: `${isoToDisplay(editCheckinData)} - ${isoToDisplay(editCheckoutData)}`,
      });
      await reloadAndSync(updated);
      notify('Dados atualizados.');
      setShowEditDados(false);
    } finally { setSavingDados(false); }
  };

  // ── Handler: trocar quarto ────────────────────────────────────────────────
  const openTrocarQuarto = () => {
    setTqCategoria('');
    setTqQuarto('');
    const diasIds = detailStay?.diarias.map((d) => d.id) || [];
    setTqDiariasAplicar(diasIds);
    setShowTrocarQuarto(true);
  };

  const toggleTqDiaria = (id) =>
    setTqDiariasAplicar((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);

  const handleSaveTrocarQuarto = async () => {
    if (!tqQuarto) { notify('Selecione um quarto.', 'warning'); return; }
    setSavingTrocar(true);
    try {
      const novoQ = Number(tqQuarto);
      const cat   = getCategoriaDoQuarto(novoQ);
      const patch = {
        quarto: novoQ,
        categoria: cat?.nome || detailStay.categoria,
        diarias: detailStay.diarias.map((d) =>
          tqDiariasAplicar.includes(d.id) ? { ...d, quarto: novoQ } : d
        ),
      };
      const updated = await stayApi.atualizar(detailStay.id, patch);
      await reloadAndSync(updated);
      notify(`Quarto alterado para ${fmtNum(novoQ)} em ${tqDiariasAplicar.length} diária(s).`);
      setShowTrocarQuarto(false);
    } finally { setSavingTrocar(false); }
  };

  // ── Handler: adicionar hóspede ────────────────────────────────────────────
  const openAddHospede = () => {
    setHospedeSearch('');
    setHospedeSelected(null);
    setShowAddHospede(true);
  };

  const handleSaveAddHospede = async () => {
    if (!hospedeSelected) { notify('Selecione um hóspede.', 'warning'); return; }
    setSavingHospede(true);
    try {
      const updated = await stayApi.adicionarHospede(detailStay.id, selectedDiariaIdx, hospedeSelected);
      await reloadAndSync(updated);
      notify('Hóspede adicionado.');
      setShowAddHospede(false);
    } finally { setSavingHospede(false); }
  };

  const handleRemoveHospede = async (hospedeId) => {
    try {
      const updated = await stayApi.removerHospede(detailStay.id, selectedDiariaIdx, hospedeId);
      await reloadAndSync(updated);
      notify('Hóspede removido.');
    } catch { notify('Erro ao remover hóspede.', 'error'); }
  };

  // ── Handler: adicionar consumo ────────────────────────────────────────────
  const openAddConsumo = () => {
    setConsumoCategoria('');
    setConsumoProduto('');
    setConsumoQty(1);
    setConsumoForma('');
    setShowAddConsumo(true);
  };

  const handleSaveConsumo = async () => {
    if (!consumoProdutoSel || !consumoForma) { notify('Preencha todos os campos.', 'warning'); return; }
    setSavingConsumo(true);
    try {
      const novo = {
        categoria: consumoCatSel?.nome,
        item: consumoProdutoSel.nome,
        quantidade: consumoQty,
        valorUnitario: consumoProdutoSel.preco,
        valorTotal: consumoProdutoSel.preco * consumoQty,
        formaPagamento: consumoForma,
      };
      const updated = await stayApi.adicionarConsumo(detailStay.id, selectedDiariaIdx, novo);
      await reloadAndSync(updated);
      notify('Consumo adicionado.');
      setShowAddConsumo(false);
    } finally { setSavingConsumo(false); }
  };

  // ── Handler: adicionar pagamento ──────────────────────────────────────────
  const openAddPagamento = () => {
    setPagamentoDesc('');
    setPagamentoForma('');
    setPagamentoValor('');
    setShowAddPagamento(true);
  };

  const parsePagValor = () => parseFloat(String(pagamentoValor).replace(',', '.')) || 0;

  const handleSavePagamento = async () => {
    const val = parsePagValor();
    if (!pagamentoDesc || !pagamentoForma || val <= 0) {
      notify('Preencha todos os campos.', 'warning'); return;
    }
    setSavingPagamento(true);
    try {
      const novo = {
        descricao: pagamentoDesc,
        formaPagamento: pagamentoForma,
        valor: val,
        data: new Date().toLocaleString('pt-BR'),
      };
      const updated = await stayApi.adicionarPagamento(detailStay.id, selectedDiariaIdx, novo);
      await reloadAndSync(updated);
      notify('Pagamento adicionado.');
      setShowAddPagamento(false);
    } finally { setSavingPagamento(false); }
  };

  // ── Handler: cancelar / finalizar ────────────────────────────────────────
  const handleCancelar = async () => {
    setConfirmLoading(true);
    try {
      await stayApi.atualizarStatus(detailStay.id, STATUS.CANCELADO);
      await loadStays();
      notify('Reserva cancelada.');
      setShowCancelar(false);
      closeDetail();
    } finally { setConfirmLoading(false); }
  };

  const handleFinalizar = async () => {
    setConfirmLoading(true);
    try {
      const newStatus = detailStay.pagamentoPendente > 0 ? STATUS.FINALIZADO_PENDENTE : STATUS.FINALIZADO;
      await stayApi.atualizarStatus(detailStay.id, newStatus);
      await loadStays();
      notify('Reserva finalizada.');
      setShowFinalizar(false);
      closeDetail();
    } finally { setConfirmLoading(false); }
  };

  // ── Handler: nova hospedagem ──────────────────────────────────────────────
  const openNovaHosp = () => {
    setNhNome(''); setNhCategoria(''); setNhQuarto('');
    setNhCheckinData(''); setNhCheckinHora('14:00');
    setNhCheckoutData(''); setNhCheckoutHora('12:00');
    setNhPessoas(1); setNhPagamentos([]);
    setNhPagDesc(''); setNhPagForma(''); setNhPagValor('');
    setShowNovaHosp(true);
  };

  const addNhPagamento = () => {
    const val = parseFloat(String(nhPagValor).replace(',', '.'));
    if (!nhPagDesc || !nhPagForma || !val || val <= 0) { notify('Preencha o pagamento.', 'warning'); return; }
    setNhPagamentos((p) => [...p, { id: Date.now(), descricao: nhPagDesc, formaPagamento: nhPagForma, valor: val }]);
    setNhPagDesc(''); setNhPagForma(''); setNhPagValor('');
  };

  const handleSaveNovaHosp = async () => {
    if (!nhNome || !nhQuarto || !nhCheckinData || !nhCheckoutData) {
      notify('Preencha todos os campos obrigatórios.', 'warning'); return;
    }
    setSavingNova(true);
    try {
      const cat = getCategoriaDoQuarto(nhQuarto);
      const checkin  = `${isoToDisplay(nhCheckinData)} ${nhCheckinHora}`;
      const checkout = `${isoToDisplay(nhCheckoutData)} ${nhCheckoutHora}`;
      const nova = {
        quarto: Number(nhQuarto),
        categoria: cat?.nome || '',
        titularNome: nhNome,
        periodo: `${isoToDisplay(nhCheckinData)} - ${isoToDisplay(nhCheckoutData)}`,
        status: STATUS.ATIVO,
        totalDiarias: nhTotalDias,
        chegadaPrevista: checkin,
        saidaPrevista: checkout,
        valorTotal: nhTotalHosp,
        totalPago: nhTotalPago,
        pagamentoPendente: nhPendente,
        diariaAtual: 1,
        diarias: [{
          id: 1, numero: 1, quarto: Number(nhQuarto),
          valorDiaria: nhPrecoDiaria,
          dataInicio: checkin, dataFim: checkout,
          hospedes: [], consumos: [],
          pagamentos: nhPagamentos,
        }],
      };
      await stayApi.criar(nova);
      await loadStays();
      notify('Hospedagem criada com sucesso!');
      setShowNovaHosp(false);
    } finally { setSavingNova(false); }
  };

  // ── Toggle category collapse ──────────────────────────────────────────────
  const toggleCat = (nome) =>
    setCollapsedCats((p) => ({ ...p, [nome]: !p[nome] }));

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

      {/* ── Header ── */}
      <div className={styles.pageHeader}>
        <div>
          <h2 className={styles.h2}>Pernoites</h2>
          <p className={styles.subtitle}>
            <BedDouble size={13} /> Gestão de hospedagens e diárias
          </p>
        </div>
        <Button variant="primary" onClick={openNovaHosp}>
          <Plus size={15} /> Nova Hospedagem
        </Button>
      </div>

      {/* ── Main card ── */}
      <div className={styles.card}>
        {/* Toolbar */}
        <div className={styles.tableHeader}>
          <div>
            <div className={styles.tableTitle}>Hospedagens por Categoria</div>
            <div className={styles.tableSubtitle}>Clique em uma hospedagem para ver detalhes</div>
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
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              style={{ width: 200, flexShrink: 0 }}
            >
              <option value="">Todos os status</option>
              {Object.values(STATUS).map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </Select>
          </div>
        </div>

        {/* Category groups */}
        {loading ? (
          <div className={styles.emptyState}>Carregando...</div>
        ) : staysByCategory.every((cat) => cat.stays.length === 0) ? (
          <div className={styles.emptyState}>Nenhuma hospedagem encontrada.</div>
        ) : (
          staysByCategory.map((cat) => {
            if (cat.stays.length === 0) return null;
            const collapsed = collapsedCats[cat.nome];
            return (
              <div key={cat.id} className={styles.categorySection}>
                <button
                  className={styles.categoryHeader}
                  onClick={() => toggleCat(cat.nome)}
                  type="button"
                >
                  <ChevronDown
                    size={15}
                    className={[styles.categoryChevron, collapsed ? styles.collapsed : ''].join(' ')}
                  />
                  <BedDouble size={14} className={styles.catIcon} />
                  <span className={styles.categoryName}>{cat.nome}</span>
                  <span className={styles.categoryCount}>({cat.stays.length})</span>
                </button>

                {!collapsed && cat.stays.map((stay) => (
                  <div
                    key={stay.id}
                    className={styles.stayRow}
                    onClick={() => openDetail(stay)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && openDetail(stay)}
                  >
                    <div className={styles.stayLeft}>
                      <div className={styles.stayRoomBadge}>{fmtNum(stay.quarto)}</div>
                      <div>
                        <div className={styles.stayName}>{stay.titularNome}</div>
                        <div className={styles.stayMeta}>
                          <span className={styles.stayMetaItem}>
                            <Calendar size={11} />
                            {stay.periodo}
                          </span>
                          <span className={styles.stayMetaItem}>
                            {stay.totalDiarias} diária{stay.totalDiarias !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className={styles.stayRight}>
                      <span className={[styles.statusBadge, styles['status_' + getStatusKey(stay.status)]].join(' ')}>
                        {stay.status}
                      </span>
                      {stay.pagamentoPendente > 0 && (
                        <span className={styles.pendenteBadge}>{fmtBRL(stay.pagamentoPendente)}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            );
          })
        )}
      </div>

      {/* ══════════════════════════════════════════════════
          MODAL: Detalhes do Pernoite
      ══════════════════════════════════════════════════ */}
      <Modal
        open={showDetail && !!detailStay}
        onClose={closeDetail}
        size="xl"
        title={
          detailStay ? (
            <div className={styles.detailModalTitle}>
              <div className={styles.detailRoomBadge}>{fmtNum(detailStay.quarto)}</div>
              <div>
                <div className={styles.detailTitular}>{detailStay.titularNome}</div>
                <div className={styles.detailMeta}>
                  <span className={[styles.statusBadge, styles['status_' + getStatusKey(detailStay.status)]].join(' ')}>
                    {detailStay.status}
                  </span>
                  <span className={styles.detailPeriodo}>{detailStay.periodo}</span>
                </div>
              </div>
            </div>
          ) : null
        }
        footer={
          <div className={styles.detailFooter}>
            <Button variant="danger" onClick={() => setShowCancelar(true)}>
              <XCircle size={14} /> Cancelar
            </Button>
            <Button variant="primary" onClick={() => setShowFinalizar(true)}>
              <CheckCircle size={14} /> Finalizar
            </Button>
          </div>
        }
      >
        {detailStay && (
          <>
            {/* Main tabs */}
            <div className={styles.detailTabs}>
              {[['dados', 'Dados do Pernoite'], ['diarias', 'Diárias']].map(([t, label]) => (
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

            {/* ── TAB: Dados ── */}
            {detailTab === 'dados' && (
              <div className={[styles.tabContent, styles.tabBody].join(' ')}>
                <div className={styles.dataGrid2}>
                  <div className={styles.infoBox}>
                    <div className={styles.infoBoxHeader}>
                      <Calendar size={14} className={styles.infoBoxIcon} />
                      <span className={styles.infoBoxLabel}>Período</span>
                    </div>
                    <p className={styles.infoBoxValue}>{detailStay.periodo}</p>
                    <p className={styles.infoBoxSub}>
                      {detailStay.totalDiarias} diária{detailStay.totalDiarias !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className={styles.infoBox}>
                    <div className={styles.infoBoxHeader}>
                      <Clock size={14} className={styles.infoBoxIconGreen} />
                      <span className={styles.infoBoxLabel}>Check-in / Check-out</span>
                    </div>
                    <p className={styles.infoBoxValue}>Entrada: {detailStay.chegadaPrevista}</p>
                    <p className={styles.infoBoxValue}>Saída: {detailStay.saidaPrevista}</p>
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
                      <span className={styles.financialValue}>{fmtBRL(detailStay.valorTotal)}</span>
                    </div>
                    <div className={styles.financialItem}>
                      <span className={styles.financialLabel}>Total Pago</span>
                      <span className={[styles.financialValue, styles.valueGreen].join(' ')}>
                        {fmtBRL(detailStay.totalPago)}
                      </span>
                    </div>
                    <div className={styles.financialItem}>
                      <span className={styles.financialLabel}>Pendente</span>
                      <span className={[
                        styles.financialValue,
                        detailStay.pagamentoPendente > 0 ? styles.valueAmber : styles.valueGreen,
                      ].join(' ')}>
                        {fmtBRL(detailStay.pagamentoPendente)}
                      </span>
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

                <div className={styles.dadosActions}>
                  <Button variant="primary" onClick={openGerenciarDiarias}>
                    <Calendar size={14} /> Gerenciar Diárias
                  </Button>
                  <Button variant="secondary" onClick={openEditDados}>
                    <Edit2 size={14} /> Editar Dados
                  </Button>
                  <Button variant="secondary" onClick={openTrocarQuarto}>
                    <RefreshCw size={13} /> Trocar Quarto
                  </Button>
                </div>
              </div>
            )}

            {/* ── TAB: Diárias ── */}
            {detailTab === 'diarias' && (
              <div className={[styles.tabContent, styles.tabBody].join(' ')}>
                {detailStay.diarias.length === 0 ? (
                  <div className={styles.emptyState}>Nenhuma diária cadastrada.</div>
                ) : (
                  <>
                    {/* Diária selector */}
                    <div className={styles.diariasNav}>
                      <div className={styles.diariasNavTop}>
                        <span className={styles.diariasNavLabel}>Selecione a diária</span>
                        <span className={styles.diariaAtualBadge}>
                          Diária atual: {detailStay.diariaAtual}
                        </span>
                      </div>
                      <div className={styles.diariasPills}>
                        {detailStay.diarias.map((d, idx) => {
                          const isAtual = idx + 1 === detailStay.diariaAtual;
                          const isSel   = selectedDiariaIdx === idx;
                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => { setSelectedDiariaIdx(idx); setDiariaTab('detalhes'); }}
                              className={[
                                styles.diariaPill,
                                isSel ? styles.diariaPillActive : '',
                                !isSel && isAtual ? styles.diariaPillAtual : '',
                              ].join(' ')}
                            >
                              <span>Diária {d.numero}{isAtual ? ' ●' : ''}</span>
                              <span className={styles.diariaPillDate}>
                                {fmtShort(d.dataInicio)} – {fmtShort(d.dataFim)}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {currentDiaria && (
                      <>
                        {/* Sub-tabs */}
                        <div className={styles.subTabs}>
                          {[
                            ['detalhes', 'Detalhes'],
                            ['hospedes', `Hóspedes (${currentDiaria.hospedes.length})`],
                            ['consumo', `Consumo (${currentDiaria.consumos.length})`],
                            ['pagamentos', `Pagamentos (${currentDiaria.pagamentos.length})`],
                          ].map(([t, label]) => (
                            <button
                              key={t}
                              type="button"
                              className={[styles.subTab, diariaTab === t ? styles.subTabActive : ''].join(' ')}
                              onClick={() => setDiariaTab(t)}
                            >
                              {label}
                            </button>
                          ))}
                        </div>

                        {/* Sub-tab: Detalhes */}
                        {diariaTab === 'detalhes' && (
                          <div className={styles.subTabContent}>
                            <div className={styles.diariaDetailsBox}>
                              {[
                                { label: 'Quarto',         value: fmtNum(currentDiaria.quarto) },
                                { label: 'Valor da Diária', value: fmtBRL(currentDiaria.valorDiaria) },
                                { label: 'Período',        value: `${currentDiaria.dataInicio} → ${currentDiaria.dataFim}` },
                              ].map(({ label, value }) => (
                                <div key={label} className={styles.diariaDetailRow}>
                                  <span className={styles.diariaDetailLabel}>{label}</span>
                                  <span className={styles.diariaDetailValue}>{value}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Sub-tab: Hóspedes */}
                        {diariaTab === 'hospedes' && (
                          <div className={styles.subTabContent}>
                            <Button variant="primary" onClick={openAddHospede}>
                              <Plus size={14} /> Adicionar Hóspede
                            </Button>
                            {currentDiaria.hospedes.length === 0 ? (
                              <div className={styles.emptyState}>Nenhum hóspede nesta diária.</div>
                            ) : (
                              <div className={styles.itemList}>
                                {currentDiaria.hospedes.map((h) => (
                                  <div key={h.id} className={styles.listItem}>
                                    <div className={styles.listItemLeft}>
                                      <User size={14} className={styles.listItemIcon} />
                                      <div>
                                        <div className={styles.listItemName}>{h.nome}</div>
                                        <div className={styles.listItemSub}>
                                          CPF: {h.cpf} • {h.telefone}
                                        </div>
                                      </div>
                                    </div>
                                    <button
                                      type="button"
                                      className={styles.removeBtn}
                                      onClick={() => handleRemoveHospede(h.id)}
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Sub-tab: Consumo */}
                        {diariaTab === 'consumo' && (
                          <div className={styles.subTabContent}>
                            <Button variant="primary" onClick={openAddConsumo}>
                              <Plus size={14} /> Adicionar Consumo
                            </Button>
                            {currentDiaria.consumos.length === 0 ? (
                              <div className={styles.emptyState}>Nenhum consumo nesta diária.</div>
                            ) : (
                              <div className={styles.itemList}>
                                {currentDiaria.consumos.map((c) => (
                                  <div key={c.id} className={styles.listItem}>
                                    <div className={styles.listItemLeft}>
                                      <ShoppingCart size={14} className={styles.listItemIconGreen} />
                                      <div>
                                        <div className={styles.listItemName}>{c.item}</div>
                                        <div className={styles.listItemSub}>
                                          {c.categoria} • Qtd: {c.quantidade} • {fmtBRL(c.valorUnitario)}/un • {c.formaPagamento}
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

                        {/* Sub-tab: Pagamentos */}
                        {diariaTab === 'pagamentos' && (
                          <div className={styles.subTabContent}>
                            <Button variant="primary" onClick={openAddPagamento}>
                              <Plus size={14} /> Adicionar Pagamento
                            </Button>
                            {currentDiaria.pagamentos.length === 0 ? (
                              <div className={styles.emptyState}>Nenhum pagamento nesta diária.</div>
                            ) : (
                              <div className={styles.itemList}>
                                {currentDiaria.pagamentos.map((p) => (
                                  <div key={p.id} className={styles.listItem}>
                                    <div className={styles.listItemLeft}>
                                      <CreditCard size={14} className={styles.listItemIconGreen} />
                                      <div>
                                        <div className={styles.listItemName}>{p.descricao}</div>
                                        <div className={styles.listItemSub}>
                                          {p.formaPagamento} • {p.data}
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
                      </>
                    )}
                  </>
                )}
              </div>
            )}
          </>
        )}
      </Modal>

      {/* ══════════════════════════════════════════════════
          MODAL: Gerenciar Diárias
      ══════════════════════════════════════════════════ */}
      <Modal
        open={showGerenciarDiarias}
        onClose={() => setShowGerenciarDiarias(false)}
        size="md"
        title="Gerenciar Diárias"
        footer={
          <div className={styles.modalFooterRow}>
            <Button variant="secondary" onClick={() => setShowGerenciarDiarias(false)}>Fechar</Button>
            <Button
              variant="primary"
              onClick={handleSaveAddDiaria}
              disabled={savingDiaria || !diariaDataInicio || !diariaDataFim}
            >
              {savingDiaria ? 'Adicionando...' : 'Adicionar Diária'}
            </Button>
          </div>
        }
      >
        <div className={styles.formStack}>
          {detailStay?.diarias.length > 0 && (
            <div className={styles.gManageList}>
              {detailStay.diarias.map((d, idx) => (
                <div key={d.id} className={styles.gManageRow}>
                  <div className={styles.gManageLeft}>
                    <span className={styles.gManageNum}>Diária {d.numero}</span>
                    <span className={styles.gManageDate}>
                      {fmtShort(d.dataInicio)} – {fmtShort(d.dataFim)}
                    </span>
                  </div>
                  <button
                    type="button"
                    className={styles.removeBtn}
                    onClick={() => handleRemoveDiaria(idx)}
                    disabled={removingDiariaIdx === idx}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className={styles.gManageSep}>
            <Plus size={12} className={styles.formSectionIcon} /> Adicionar Nova Diária
          </div>
          <div className={styles.infoHint}>
            A data de início é pré-preenchida com o checkout da última diária.
          </div>
          <div className={styles.grid2}>
            <FormField label="Data início">
              <Input type="date" value={diariaDataInicio} onChange={(e) => setDiariaDataInicio(e.target.value)} />
            </FormField>
            <FormField label="Hora início">
              <Input type="time" value={diariaHoraInicio} onChange={(e) => setDiariaHoraInicio(e.target.value)} />
            </FormField>
            <FormField label="Data fim">
              <Input type="date" value={diariaDataFim} onChange={(e) => setDiariaDataFim(e.target.value)} />
            </FormField>
            <FormField label="Hora fim (checkout)">
              <Input type="time" value={diariaHoraFim} onChange={(e) => setDiariaHoraFim(e.target.value)} />
            </FormField>
          </div>
          {addDiariaDias > 0 && (
            <div className={styles.confirmHint}>
              <Check size={14} /> Confirmar adição de {addDiariaDias} dia(s)
            </div>
          )}
        </div>
      </Modal>

      {/* ══════════════════════════════════════════════════
          MODAL: Editar Dados
      ══════════════════════════════════════════════════ */}
      <Modal
        open={showEditDados}
        onClose={() => setShowEditDados(false)}
        size="sm"
        title="Editar Dados do Pernoite"
        footer={
          <div className={styles.modalFooterRow}>
            <Button variant="secondary" onClick={() => setShowEditDados(false)}>Cancelar</Button>
            <Button variant="primary" onClick={handleSaveEditDados} disabled={savingDados}>
              {savingDados ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        }
      >
        <div className={styles.formStack}>
          <div className={styles.grid2}>
            <FormField label="Data check-in">
              <Input type="date" value={editCheckinData} onChange={(e) => setEditCheckinData(e.target.value)} />
            </FormField>
            <FormField label="Hora check-in">
              <Input type="time" value={editCheckinHora} onChange={(e) => setEditCheckinHora(e.target.value)} />
            </FormField>
            <FormField label="Data check-out">
              <Input type="date" value={editCheckoutData} onChange={(e) => setEditCheckoutData(e.target.value)} />
            </FormField>
            <FormField label="Hora check-out">
              <Input type="time" value={editCheckoutHora} onChange={(e) => setEditCheckoutHora(e.target.value)} />
            </FormField>
          </div>
        </div>
      </Modal>

      {/* ══════════════════════════════════════════════════
          MODAL: Trocar Quarto
      ══════════════════════════════════════════════════ */}
      <Modal
        open={showTrocarQuarto}
        onClose={() => setShowTrocarQuarto(false)}
        size="md"
        title="Trocar de Quarto"
        footer={
          <div className={styles.modalFooterRow}>
            <Button variant="secondary" onClick={() => setShowTrocarQuarto(false)}>Cancelar</Button>
            <Button variant="primary" onClick={handleSaveTrocarQuarto} disabled={savingTrocar}>
              {savingTrocar ? 'Salvando...' : 'Confirmar Troca'}
            </Button>
          </div>
        }
      >
        <div className={styles.formStack}>
          <FormField label="Aplicar troca nas diárias:">
            <div className={styles.pillsRow}>
              {detailStay?.diarias.map((d) => {
                const isAtual = d.numero === detailStay.diariaAtual;
                const isSel   = tqDiariasAplicar.includes(d.id);
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => toggleTqDiaria(d.id)}
                    className={[styles.pill, isSel ? styles.pillActive : ''].join(' ')}
                  >
                    Diária {d.numero}{isAtual ? ' ★' : ''}
                  </button>
                );
              })}
            </div>
            <span className={styles.pillHint}>★ = diária atual</span>
          </FormField>

          <FormField label="Categoria">
            <Select
              value={tqCategoria}
              onChange={(e) => { setTqCategoria(e.target.value); setTqQuarto(''); }}
            >
              <option value="">Escolha uma categoria</option>
              {CATEGORIAS_QUARTOS.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </Select>
          </FormField>

          {tqCategoria && (
            <FormField label="Novo quarto">
              <div className={styles.roomGrid5}>
                {tqCat?.quartos.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setTqQuarto(q)}
                    className={[styles.roomPill, tqQuarto === q ? styles.roomPillActive : ''].join(' ')}
                  >
                    {fmtNum(q)}
                  </button>
                ))}
              </div>
            </FormField>
          )}

          {tqQuarto && detailStay && (
            <div className={styles.changeRoomPreview}>
              <ArrowRight size={14} className={styles.arrowIcon} />
              <span>
                Quarto <strong>{fmtNum(detailStay.quarto)}</strong>
                {' → '}
                <strong className={styles.newRoomNum}>{fmtNum(Number(tqQuarto))}</strong>
                {' em '}<strong>{tqDiariasAplicar.length}</strong> diária(s)
              </span>
            </div>
          )}
        </div>
      </Modal>

      {/* ══════════════════════════════════════════════════
          MODAL: Adicionar Hóspede
      ══════════════════════════════════════════════════ */}
      <Modal
        open={showAddHospede}
        onClose={() => setShowAddHospede(false)}
        size="md"
        title="Adicionar Hóspede"
        footer={
          <div className={styles.modalFooterRow}>
            <Button variant="secondary" onClick={() => setShowAddHospede(false)}>Cancelar</Button>
            <Button variant="primary" onClick={handleSaveAddHospede} disabled={savingHospede}>
              {savingHospede ? 'Adicionando...' : 'Adicionar'}
            </Button>
          </div>
        }
      >
        <div className={styles.formStack}>
          <div className={styles.searchWrap}>
            <Search size={14} className={styles.searchIcon} />
            <Input
              className={styles.searchInput}
              placeholder="Buscar por nome..."
              value={hospedeSearch}
              onChange={(e) => setHospedeSearch(e.target.value)}
            />
          </div>
          <div className={styles.guestList}>
            {filteredHospedes.map((h) => (
              <button
                key={h.id}
                type="button"
                onClick={() => setHospedeSelected(h)}
                className={[styles.guestItem, hospedeSelected?.id === h.id ? styles.guestItemActive : ''].join(' ')}
              >
                <div className={styles.guestName}>{h.nome}</div>
                <div className={styles.guestSub}>CPF: {h.cpf} • {h.telefone}</div>
              </button>
            ))}
          </div>
        </div>
      </Modal>

      {/* ══════════════════════════════════════════════════
          MODAL: Adicionar Consumo
      ══════════════════════════════════════════════════ */}
      <Modal
        open={showAddConsumo}
        onClose={() => setShowAddConsumo(false)}
        size="md"
        title="Adicionar Consumo"
        footer={
          <div className={styles.modalFooterRow}>
            <Button variant="secondary" onClick={() => setShowAddConsumo(false)}>Cancelar</Button>
            <Button variant="primary" onClick={handleSaveConsumo} disabled={savingConsumo}>
              {savingConsumo ? 'Adicionando...' : 'Adicionar'}
            </Button>
          </div>
        }
      >
        <div className={styles.formStack}>
          <FormField label="Categoria">
            <Select
              value={consumoCategoria}
              onChange={(e) => { setConsumoCategoria(e.target.value); setConsumoProduto(''); }}
            >
              <option value="">Selecione</option>
              {CATEGORIAS_CONSUMO.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </Select>
          </FormField>
          {consumoCategoria && (
            <FormField label="Produto">
              <Select value={consumoProduto} onChange={(e) => setConsumoProduto(e.target.value)}>
                <option value="">Selecione</option>
                {consumoCatSel?.produtos.map((p) => (
                  <option key={p.id} value={p.id}>{p.nome} — {fmtBRL(p.preco)}</option>
                ))}
              </Select>
            </FormField>
          )}
          <FormField label="Quantidade">
            <Input
              type="number"
              min={1}
              value={consumoQty}
              onChange={(e) => setConsumoQty(Math.max(1, parseInt(e.target.value) || 1))}
            />
          </FormField>
          <FormField label="Forma de pagamento">
            <Select value={consumoForma} onChange={(e) => setConsumoForma(e.target.value)}>
              <option value="">Selecione</option>
              {FORMAS_PAGAMENTO.map((fp) => <option key={fp}>{fp}</option>)}
            </Select>
          </FormField>
          {consumoProdutoSel && (
            <div className={styles.totalPreview}>
              <span className={styles.totalPreviewLabel}>Total</span>
              <span className={styles.totalPreviewValue}>{fmtBRL(consumoProdutoSel.preco * consumoQty)}</span>
            </div>
          )}
        </div>
      </Modal>

      {/* ══════════════════════════════════════════════════
          MODAL: Adicionar Pagamento
      ══════════════════════════════════════════════════ */}
      <Modal
        open={showAddPagamento}
        onClose={() => setShowAddPagamento(false)}
        size="sm"
        title="Adicionar Pagamento"
        footer={
          <div className={styles.modalFooterRow}>
            <Button variant="secondary" onClick={() => setShowAddPagamento(false)}>Cancelar</Button>
            <Button variant="primary" onClick={handleSavePagamento} disabled={savingPagamento}>
              {savingPagamento ? 'Adicionando...' : 'Adicionar'}
            </Button>
          </div>
        }
      >
        <div className={styles.formStack}>
          <FormField label="Descrição">
            <Input
              placeholder="Ex: Entrada 50%, Sinal..."
              value={pagamentoDesc}
              onChange={(e) => setPagamentoDesc(e.target.value)}
            />
          </FormField>
          <FormField label="Forma de pagamento">
            <Select value={pagamentoForma} onChange={(e) => setPagamentoForma(e.target.value)}>
              <option value="">Selecione</option>
              {FORMAS_PAGAMENTO.map((fp) => <option key={fp}>{fp}</option>)}
            </Select>
          </FormField>
          <FormField label="Valor (R$)">
            <Input
              type="text"
              placeholder="0,00"
              value={pagamentoValor}
              onChange={(e) => setPagamentoValor(e.target.value)}
            />
          </FormField>
          {detailStay && (
            <div className={styles.pagamentoResume}>
              <div className={styles.pagamentoResumeRow}>
                <span>Pago até agora</span>
                <span className={styles.valueGreen}>{fmtBRL(detailStay.totalPago)}</span>
              </div>
              <div className={styles.pagamentoResumeRow}>
                <span>Este pagamento</span>
                <span className={styles.valueViolet}>{fmtBRL(parsePagValor())}</span>
              </div>
              <div className={[styles.pagamentoResumeRow, styles.pagamentoResumeTotal].join(' ')}>
                <span>Pendente após</span>
                <span className={
                  Math.max(0, detailStay.pagamentoPendente - parsePagValor()) > 0
                    ? styles.valueAmber : styles.valueGreen
                }>
                  {fmtBRL(Math.max(0, detailStay.pagamentoPendente - parsePagValor()))}
                </span>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* ══════════════════════════════════════════════════
          MODAL: Confirmar Cancelar
      ══════════════════════════════════════════════════ */}
      <Modal
        open={showCancelar}
        onClose={() => setShowCancelar(false)}
        size="sm"
        title="Cancelar Reserva?"
        footer={
          <div className={styles.modalFooterRow}>
            <Button variant="secondary" onClick={() => setShowCancelar(false)}>Voltar</Button>
            <Button variant="danger" onClick={handleCancelar} disabled={confirmLoading}>
              {confirmLoading ? 'Cancelando...' : 'Confirmar'}
            </Button>
          </div>
        }
      >
        <p className={styles.confirmText}>
          Esta ação não pode ser desfeita. O pernoite será marcado como cancelado.
        </p>
      </Modal>

      {/* ══════════════════════════════════════════════════
          MODAL: Confirmar Finalizar
      ══════════════════════════════════════════════════ */}
      <Modal
        open={showFinalizar}
        onClose={() => setShowFinalizar(false)}
        size="sm"
        title="Finalizar Reserva?"
        footer={
          <div className={styles.modalFooterRow}>
            <Button variant="secondary" onClick={() => setShowFinalizar(false)}>Voltar</Button>
            <Button variant="primary" onClick={handleFinalizar} disabled={confirmLoading}>
              {confirmLoading ? 'Finalizando...' : 'Confirmar'}
            </Button>
          </div>
        }
      >
        <p className={styles.confirmText}>
          O quarto será liberado e o checkout registrado.
          {detailStay?.pagamentoPendente > 0 && (
            <>
              {' '}O status será <strong>FINALIZADO - PAGAMENTO PENDENTE</strong> pois há{' '}
              {fmtBRL(detailStay.pagamentoPendente)} em aberto.
            </>
          )}
        </p>
      </Modal>

      {/* ══════════════════════════════════════════════════
          MODAL: Nova Hospedagem
      ══════════════════════════════════════════════════ */}
      <Modal
        open={showNovaHosp}
        onClose={() => setShowNovaHosp(false)}
        size="lg"
        title="Nova Hospedagem"
        footer={
          <div className={styles.modalFooterRow}>
            <Button variant="secondary" onClick={() => setShowNovaHosp(false)}>Cancelar</Button>
            <Button variant="primary" onClick={handleSaveNovaHosp} disabled={savingNova}>
              {savingNova ? 'Criando...' : 'Criar Hospedagem'}
            </Button>
          </div>
        }
      >
        <div className={styles.formStack}>
          {/* Titular */}
          <div className={styles.formSection}>
            <div className={styles.formSectionTitle}>
              <User size={13} className={styles.formSectionIcon} /> Dados do Titular
            </div>
            <FormField label="Nome do titular *">
              <Input
                placeholder="Nome completo"
                value={nhNome}
                onChange={(e) => setNhNome(e.target.value)}
              />
            </FormField>
          </div>

          {/* Quarto */}
          <div className={styles.formSection}>
            <div className={styles.formSectionTitle}>
              <BedDouble size={13} className={styles.formSectionIconBlue} /> Quarto
            </div>
            <FormField label="Categoria">
              <Select
                value={nhCategoria}
                onChange={(e) => { setNhCategoria(e.target.value); setNhQuarto(''); }}
              >
                <option value="">Selecione uma categoria</option>
                {CATEGORIAS_QUARTOS.map((c) => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </Select>
            </FormField>
            {nhCatQuarto && (
              <FormField label="Quarto *">
                <div className={styles.pillsRow}>
                  {nhCatQuarto.quartos.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => setNhQuarto(q)}
                      className={[styles.roomPill, nhQuarto === q ? styles.roomPillActive : ''].join(' ')}
                    >
                      {fmtNum(q)}
                    </button>
                  ))}
                </div>
              </FormField>
            )}
          </div>

          {/* Datas */}
          <div className={styles.formSection}>
            <div className={styles.formSectionTitle}>
              <Calendar size={13} className={styles.formSectionIconAmber} /> Período
            </div>
            <div className={styles.grid2}>
              <FormField label="Check-in *">
                <Input type="date" value={nhCheckinData} onChange={(e) => setNhCheckinData(e.target.value)} />
              </FormField>
              <FormField label="Hora check-in">
                <Input type="time" value={nhCheckinHora} onChange={(e) => setNhCheckinHora(e.target.value)} />
              </FormField>
              <FormField label="Check-out *">
                <Input type="date" value={nhCheckoutData} onChange={(e) => setNhCheckoutData(e.target.value)} />
              </FormField>
              <FormField label="Hora check-out">
                <Input type="time" value={nhCheckoutHora} onChange={(e) => setNhCheckoutHora(e.target.value)} />
              </FormField>
            </div>
            {nhTotalDias > 0 && (
              <div className={styles.daysPreview}>
                {nhTotalDias} diária{nhTotalDias !== 1 ? 's' : ''}
              </div>
            )}
          </div>

          {/* Pessoas */}
          {nhCatQuarto && (
            <div className={styles.formSection}>
              <div className={styles.formSectionTitle}>
                <User size={13} className={styles.formSectionIconGreen} /> Hóspedes
              </div>
              {nhCatQuarto.modeloCobranca === 'Por quarto (tarifa fixa)' ? (
                <p className={styles.fixedRateNote}>
                  Tarifa fixa — {fmtBRL(nhCatQuarto.precoFixo)}/noite (independe da quantidade de pessoas)
                </p>
              ) : (
                <div className={styles.pessoasControl}>
                  <span className={styles.pessoasLabel}>Número de pessoas:</span>
                  <div className={styles.pessoasStepper}>
                    <button
                      type="button"
                      className={styles.stepperBtn}
                      onClick={() => setNhPessoas((p) => Math.max(1, p - 1))}
                    >−</button>
                    <span className={styles.stepperValue}>{nhPessoas}</span>
                    <button
                      type="button"
                      className={styles.stepperBtn}
                      onClick={() => setNhPessoas((p) => Math.min(Object.keys(nhCatQuarto.precosOcupacao || {}).length, p + 1))}
                    >+</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Resumo financeiro */}
          {nhQuarto && nhTotalDias > 0 && (
            <div className={styles.formSection}>
              <div className={styles.formSectionTitle}>
                <DollarSign size={13} className={styles.formSectionIconAmber} /> Resumo Financeiro
              </div>
              <div className={styles.financialGrid3}>
                {[
                  { label: 'Diária', value: fmtBRL(nhPrecoDiaria), cls: styles.valueViolet },
                  { label: 'Total',  value: fmtBRL(nhTotalHosp),   cls: '' },
                  { label: 'Pago',   value: fmtBRL(nhTotalPago),   cls: styles.valueGreen },
                ].map(({ label, value, cls }) => (
                  <div key={label} className={styles.financialCell}>
                    <span className={styles.financialCellLabel}>{label}</span>
                    <span className={[styles.financialCellValue, cls].join(' ')}>{value}</span>
                  </div>
                ))}
              </div>
              <div className={styles.progressBar} style={{ marginTop: 8 }}>
                <div
                  className={styles.progressFill}
                  style={{ width: `${nhTotalHosp > 0 ? Math.min(100, (nhTotalPago / nhTotalHosp) * 100) : 0}%` }}
                />
              </div>
            </div>
          )}

          {/* Pagamentos */}
          <div className={styles.formSection}>
            <div className={styles.formSectionTitle}>
              <CreditCard size={13} className={styles.formSectionIconGreen} /> Pagamentos (opcional)
            </div>
            <div className={styles.formStack}>
              <Input
                placeholder="Descrição (ex: Entrada 50%)"
                value={nhPagDesc}
                onChange={(e) => setNhPagDesc(e.target.value)}
              />
              <div className={styles.grid2}>
                <Select value={nhPagForma} onChange={(e) => setNhPagForma(e.target.value)}>
                  <option value="">Forma de pagamento</option>
                  {FORMAS_PAGAMENTO.map((fp) => <option key={fp}>{fp}</option>)}
                </Select>
                <Input
                  type="text"
                  placeholder="Valor (R$)"
                  value={nhPagValor}
                  onChange={(e) => setNhPagValor(e.target.value)}
                />
              </div>
              <Button variant="secondary" onClick={addNhPagamento}>
                <Plus size={14} /> Adicionar Pagamento
              </Button>
            </div>
            {nhPagamentos.length > 0 && (
              <div className={styles.nhPagList}>
                {nhPagamentos.map((p) => (
                  <div key={p.id} className={styles.nhPagItem}>
                    <span className={styles.nhPagDesc}>{p.descricao} • {p.formaPagamento}</span>
                    <div className={styles.nhPagRight}>
                      <span className={styles.valueGreen}>{fmtBRL(p.valor)}</span>
                      <button
                        type="button"
                        className={styles.removeBtn}
                        onClick={() => setNhPagamentos((prev) => prev.filter((x) => x.id !== p.id))}
                      >
                        <X size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
