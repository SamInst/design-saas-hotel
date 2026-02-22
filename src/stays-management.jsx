import React, { useState, useMemo } from 'react';
import {
  BedDouble, Calendar, DollarSign, Sun, Moon, Plus, Edit,
  Shield, ChevronDown, Users, Clock, X, Check, Trash2,
  AlertCircle, ArrowRight, User, ShoppingCart, CreditCard,
  RefreshCw, XCircle, CheckCircle, Search, ChevronLeft,
  ChevronRight, TrendingUp, BarChart2, Home,
} from 'lucide-react';

function formatRoomNumber(n) { return n < 10 ? `0${n}` : `${n}`; }
function fmt(v) { return `R$ ${Number(v || 0).toFixed(2)}`; }

function parseDatetime(str) {
  // "DD/MM/YYYY HH:MM"
  if (!str) return null;
  const [datePart, timePart] = str.split(' ');
  const [d, m, y] = datePart.split('/');
  return new Date(`${y}-${m}-${d}T${timePart || '12:00'}:00`);
}

function toInputDate(dt) {
  if (!dt) return '';
  const d = typeof dt === 'string' ? parseDatetime(dt) : dt;
  if (!d) return '';
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function toInputTime(str) {
  if (!str) return '';
  if (str.includes('/')) { const [, t] = str.split(' '); return t || ''; }
  return str;
}

function diffDays(a, b) {
  const ms = Math.abs(new Date(b) - new Date(a));
  return Math.round(ms / 86400000);
}

const STATUS = {
  ATIVO: 'ATIVO',
  DIARIA_ENCERRADA: 'DIÁRIA ENCERRADA',
  FINALIZADO: 'FINALIZADO',
  CANCELADO: 'CANCELADO',
  FINALIZADO_PENDENTE: 'FINALIZADO - PAGAMENTO PENDENTE',
};

const FORMAS_PAGAMENTO = ['Dinheiro', 'PIX', 'Cartão de Crédito', 'Cartão de Débito', 'Transferência Bancária'];

// ── Mini bar chart simples (SVG) ──────────────────────────────────────────────
function MiniBarChart({ data, color = '#8b5cf6', height = 60 }) {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data.map((d) => d.value), 1);
  const w = 100 / data.length;
  return (
    <svg viewBox={`0 0 100 ${height}`} className="w-full" preserveAspectRatio="none">
      {data.map((d, i) => {
        const h = (d.value / max) * (height - 10);
        const x = i * w + w * 0.1;
        const barW = w * 0.8;
        return (
          <g key={i}>
            <rect x={x} y={height - h - 5} width={barW} height={h} fill={color} rx="2" opacity={d.highlight ? 1 : 0.45} />
          </g>
        );
      })}
    </svg>
  );
}

// ── Donut mini ─────────────────────────────────────────────────────────────────
function MiniDonut({ pct, color = '#10b981', size = 64 }) {
  const r = 22; const c = 2 * Math.PI * r;
  const dash = (pct / 100) * c;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64">
      <circle cx="32" cy="32" r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8" />
      <circle cx="32" cy="32" r={r} fill="none" stroke={color} strokeWidth="8"
        strokeDasharray={`${dash} ${c}`} strokeDashoffset={c / 4} strokeLinecap="round" />
      <text x="32" y="36" textAnchor="middle" fill="white" fontSize="11" fontWeight="bold">{Math.round(pct)}%</text>
    </svg>
  );
}

// ── Sparkline ──────────────────────────────────────────────────────────────────
function Sparkline({ values, color = '#8b5cf6', h = 40, w = 120 }) {
  if (!values || values.length < 2) return null;
  const max = Math.max(...values, 1);
  const step = w / (values.length - 1);
  const pts = values.map((v, i) => `${i * step},${h - (v / max) * (h - 4)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-full">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
      {values.map((v, i) => (
        <circle key={i} cx={i * step} cy={h - (v / max) * (h - 4)} r="2" fill={color} />
      ))}
    </svg>
  );
}

export default function StaysManagement() {
  const [isDark, setIsDark] = useState(true);
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('all');
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedStay, setSelectedStay] = useState(null);
  const [detailsTab, setDetailsTab] = useState('dados');
  const [selectedDiariaIndex, setSelectedDiariaIndex] = useState(0);
  const [diariaTab, setDiariaTab] = useState('detalhes');
  const [notification, setNotification] = useState(null);
  const [collapsedCategories, setCollapsedCategories] = useState({});

  // Modals
  const [showAddDiariaModal, setShowAddDiariaModal] = useState(false);
  const [showEditDiariaModal, setShowEditDiariaModal] = useState(false);
  const [showEditDadosModal, setShowEditDadosModal] = useState(false);
  const [showAddGuestModal, setShowAddGuestModal] = useState(false);
  const [showAddConsumoModal, setShowAddConsumoModal] = useState(false);
  const [showAddPagamentoModal, setShowAddPagamentoModal] = useState(false);
  const [showChangeRoomModal, setShowChangeRoomModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showFinishModal, setShowFinishModal] = useState(false);
  const [showNewStayModal, setShowNewStayModal] = useState(false);

  // ── Form: Adicionar/Editar Diária ─────────────────────────────────────────
  const [diariaDataInicio, setDiariaDataInicio] = useState('');
  const [diariaHoraInicio, setDiariaHoraInicio] = useState('');
  const [diariaDataFim, setDiariaDataFim] = useState('');
  const [diariaHoraFim, setDiariaHoraFim] = useState('');

  // ── Form: Editar Dados ────────────────────────────────────────────────────
  const [editChegadaData, setEditChegadaData] = useState('');
  const [editChegadaHora, setEditChegadaHora] = useState('');
  const [editSaidaData, setEditSaidaData] = useState('');
  const [editSaidaHora, setEditSaidaHora] = useState('');

  // ── Form: Trocar Quarto ───────────────────────────────────────────────────
  const [changeRoomCategoria, setChangeRoomCategoria] = useState('');
  const [changeRoomQuarto, setChangeRoomQuarto] = useState('');
  const [changeRoomDiariasAplicar, setChangeRoomDiariasAplicar] = useState([]);

  // ── Form: Hóspede ──────────────────────────────────────────────────────────
  const [searchGuestTerm, setSearchGuestTerm] = useState('');
  const [selectedGuest, setSelectedGuest] = useState(null);

  // ── Form: Consumo ─────────────────────────────────────────────────────────
  const [consumoCategoria, setConsumoCategoria] = useState('');
  const [consumoProduto, setConsumoProduto] = useState('');
  const [consumoQuantidade, setConsumoQuantidade] = useState(1);
  const [consumoFormaPagamento, setConsumoFormaPagamento] = useState('');

  // ── Form: Pagamento ───────────────────────────────────────────────────────
  const [pagamentoDescricao, setPagamentoDescricao] = useState('');
  const [pagamentoFormaPagamento, setPagamentoFormaPagamento] = useState('');
  const [pagamentoValor, setPagamentoValor] = useState(0);

  // ── Form: Nova Hospedagem ─────────────────────────────────────────────────
  const [newStayStep, setNewStayStep] = useState(1); // 1=dados, 2=review
  const [newStayNome, setNewStayNome] = useState('');
  const [newStayQuartoCategoria, setNewStayQuartoCategoria] = useState('');
  const [newStayQuarto, setNewStayQuarto] = useState('');
  const [newStayCheckinData, setNewStayCheckinData] = useState('');
  const [newStayCheckinHora, setNewStayCheckinHora] = useState('14:00');
  const [newStayCheckoutData, setNewStayCheckoutData] = useState('');
  const [newStayCheckoutHora, setNewStayCheckoutHora] = useState('12:00');
  const [newStayPessoas, setNewStayPessoas] = useState(1);
  const [newStayPagamentos, setNewStayPagamentos] = useState([]);
  const [newStayPagDesc, setNewStayPagDesc] = useState('');
  const [newStayPagForma, setNewStayPagForma] = useState('');
  const [newStayPagValor, setNewStayPagValor] = useState(0);

  const [permissions, setPermissions] = useState({
    acessoTotal: true, dashboard: true, verPernoites: true,
    editarPernoite: true, adicionarDiaria: true, trocarQuarto: true,
    gerenciarHospedes: true, gerenciarConsumo: true,
    gerenciarPagamentos: true, cancelarReserva: true, finalizarReserva: true,
    novaHospedagem: true,
  });

  // ── Dados mock ────────────────────────────────────────────────────────────
  const categoriasQuartos = [
    { id: 1, nome: 'Standard', modeloCobranca: 'Por ocupação', precosOcupacao: { 1: 120, 2: 160, 3: 190, 4: 210, 5: 230 }, quartos: [1, 2, 3, 4, 5] },
    { id: 2, nome: 'Luxo',     modeloCobranca: 'Por ocupação', precosOcupacao: { 1: 220, 2: 280, 3: 320, 4: 360, 5: 400 }, quartos: [6, 7, 8] },
    { id: 3, nome: 'Suíte',    modeloCobranca: 'Por quarto (tarifa fixa)', precoFixo: 450, quartos: [9, 10] },
  ];

  const hospedesCadastrados = [
    { id: 1, nome: 'João Silva',      cpf: '123.456.789-00', telefone: '(98) 99999-9999' },
    { id: 2, nome: 'Maria Silva',     cpf: '987.654.321-00', telefone: '(98) 98888-8888' },
    { id: 3, nome: 'Ana Costa',       cpf: '111.222.333-44', telefone: '(98) 97777-7777' },
    { id: 4, nome: 'Carlos Mendes',   cpf: '555.666.777-88', telefone: '(98) 96666-6666' },
    { id: 5, nome: 'Fernanda Souza',  cpf: '999.888.777-66', telefone: '(98) 95555-5555' },
    { id: 6, nome: 'Roberto Lima',    cpf: '444.333.222-11', telefone: '(98) 94444-4444' },
  ];

  const categoriasConsumo = [
    { id: 1, nome: 'Bebidas',    produtos: [{ id: 1, nome: 'Cerveja Heineken', preco: 12 }, { id: 2, nome: 'Refrigerante Lata', preco: 6 }, { id: 3, nome: 'Água Mineral', preco: 4 }] },
    { id: 2, nome: 'Alimentação', produtos: [{ id: 4, nome: 'Porção de batata frita', preco: 25 }, { id: 5, nome: 'Hambúrguer', preco: 35 }, { id: 6, nome: 'Pizza média', preco: 45 }] },
    { id: 3, nome: 'Serviços',   produtos: [{ id: 7, nome: 'Lavanderia', preco: 20 }, { id: 8, nome: 'Frigobar', preco: 15 }] },
  ];

  const makeDiarias = (qtd, inicio, checkout, quarto, valor, hosps) =>
    Array.from({ length: qtd }, (_, i) => ({
      id: i + 1, numero: i + 1, quarto, valorDiaria: valor,
      dataInicio: i === 0 ? inicio : `${String(parseInt(inicio.split('/')[0]) + i).padStart(2,'0')}/${inicio.slice(3)}`,
      dataFim:    `${String(parseInt(inicio.split('/')[0]) + i + 1).padStart(2,'0')}/${inicio.slice(3,6)}2026 ${checkout}`,
      hospedes: hosps, consumos: i === 0 ? [{ id:1, categoria:'Bebidas', item:'Cerveja Heineken', quantidade:2, valorUnitario:12, valorTotal:24, formaPagamento:'Cartão de Crédito' }] : [],
      pagamentos: i === 0 ? [{ id:1, descricao:'Entrada (50%)', formaPagamento:'PIX', valor: valor * qtd * 0.5, data: inicio + ' 14:30' }] : [],
    }));

  const [stays, setStays] = useState([
    {
      id: 1, quarto: 3, categoria: 'Standard', titularNome: 'João Silva',
      periodo: '15/02/2026 - 25/02/2026', status: STATUS.ATIVO,
      totalDiarias: 10, chegadaPrevista: '15/02/2026 14:00', saidaPrevista: '25/02/2026 12:00',
      valorTotal: 1600, totalPago: 800, pagamentoPendente: 800, diariaAtual: 2,
      diarias: makeDiarias(10, '15/02/', '12:00', 3, 160,
        [{ id:1, nome:'João Silva', cpf:'123.456.789-00', telefone:'(98) 99999-9999' },
         { id:2, nome:'Maria Silva', cpf:'987.654.321-00', telefone:'(98) 98888-8888' }]),
    },
    {
      id: 2, quarto: 6, categoria: 'Luxo', titularNome: 'Ana Costa',
      periodo: '14/02/2026 - 16/02/2026', status: STATUS.DIARIA_ENCERRADA,
      totalDiarias: 2, chegadaPrevista: '14/02/2026 15:00', saidaPrevista: '16/02/2026 11:00',
      valorTotal: 560, totalPago: 560, pagamentoPendente: 0, diariaAtual: 2,
      diarias: makeDiarias(2, '14/02/', '11:00', 6, 280, [{ id:3, nome:'Ana Costa', cpf:'111.222.333-44', telefone:'(98) 97777-7777' }]),
    },
    {
      id: 3, quarto: 9, categoria: 'Suíte', titularNome: 'Carlos Mendes',
      periodo: '10/02/2026 - 13/02/2026', status: STATUS.FINALIZADO,
      totalDiarias: 3, chegadaPrevista: '10/02/2026 14:00', saidaPrevista: '13/02/2026 12:00',
      valorTotal: 1380, totalPago: 1380, pagamentoPendente: 0, diariaAtual: 3, diarias: [],
    },
    {
      id: 4, quarto: 2, categoria: 'Standard', titularNome: 'Fernanda Souza',
      periodo: '12/02/2026 - 14/02/2026', status: STATUS.CANCELADO,
      totalDiarias: 2, chegadaPrevista: '12/02/2026 15:00', saidaPrevista: '14/02/2026 12:00',
      valorTotal: 320, totalPago: 0, pagamentoPendente: 0, diariaAtual: 0, diarias: [],
    },
    {
      id: 5, quarto: 7, categoria: 'Luxo', titularNome: 'Roberto Lima',
      periodo: '08/02/2026 - 11/02/2026', status: STATUS.FINALIZADO_PENDENTE,
      totalDiarias: 3, chegadaPrevista: '08/02/2026 14:00', saidaPrevista: '11/02/2026 12:00',
      valorTotal: 840, totalPago: 500, pagamentoPendente: 340, diariaAtual: 3, diarias: [],
    },
  ]);

  // ── Theme ─────────────────────────────────────────────────────────────────
  const theme = {
    bg:            isDark ? 'bg-slate-950' : 'bg-slate-100',
    bgGradient:    isDark ? 'bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950' : 'bg-gradient-to-br from-slate-100 via-white to-slate-200',
    overlay:       isDark ? 'rgba(120,119,198,0.12)' : 'rgba(120,119,198,0.06)',
    text:          isDark ? 'text-white'     : 'text-slate-900',
    textSecondary: isDark ? 'text-slate-400' : 'text-slate-600',
    card:          isDark ? 'bg-white/5 border-white/10'   : 'bg-white border-slate-200',
    cardInner:     isDark ? 'bg-white/[0.03] border-white/8' : 'bg-slate-50 border-slate-200',
    cardHover:     isDark ? 'hover:bg-white/10' : 'hover:bg-slate-50',
    input:         isDark ? 'bg-slate-800/80 border-white/15 text-white placeholder-slate-500' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400',
    divider:       isDark ? 'border-white/10' : 'border-slate-200',
    button:        isDark ? 'bg-white/8 hover:bg-white/15 border-white/10' : 'bg-slate-100 hover:bg-slate-200 border-slate-300',
    modal:         isDark ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-200',
    sectionBg:     isDark ? 'bg-slate-800/40 border-white/8' : 'bg-slate-50/80 border-slate-200',
  };

  const inputCls = `w-full px-3 py-2 ${theme.input} rounded-lg text-sm border focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all`;

  // ── Helpers ───────────────────────────────────────────────────────────────
  const showNotification = (message, type = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };
  const togglePermission = (k) => setPermissions((p) => ({ ...p, [k]: !p[k] }));
  const toggleCategoryCollapse = (n) => setCollapsedCategories((p) => ({ ...p, [n]: !p[n] }));

  const getStatusColor = (status) => {
    switch (status) {
      case STATUS.ATIVO:               return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
      case STATUS.DIARIA_ENCERRADA:    return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
      case STATUS.FINALIZADO:          return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
      case STATUS.CANCELADO:           return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
      case STATUS.FINALIZADO_PENDENTE: return 'bg-orange-500/15 text-orange-400 border-orange-500/30';
      default:                         return 'bg-slate-500/15 text-slate-400 border-slate-500/30';
    }
  };

  // ── Computed: categoria do quarto atual ───────────────────────────────────
  const getCategoriaDoQuarto = (quartoNum) =>
    categoriasQuartos.find((c) => c.quartos.includes(Number(quartoNum)));

  // ── Computed: preço da diária conforme categoria + pessoas ────────────────
  const calcPrecoDiaria = (quartoNum, pessoas) => {
    const cat = getCategoriaDoQuarto(quartoNum);
    if (!cat) return 0;
    if (cat.modeloCobranca === 'Por quarto (tarifa fixa)') return cat.precoFixo;
    return cat.precosOcupacao?.[pessoas] || 0;
  };

  // ── Nova Hospedagem: dados calculados ─────────────────────────────────────
  const newStayTotalDias = useMemo(() => {
    if (!newStayCheckinData || !newStayCheckoutData) return 0;
    return diffDays(newStayCheckinData, newStayCheckoutData);
  }, [newStayCheckinData, newStayCheckoutData]);

  const newStayCatQuarto = useMemo(
    () => getCategoriaDoQuarto(newStayQuarto),
    [newStayQuarto]
  );

  const newStayPrecoDiaria = useMemo(() => {
    if (!newStayQuarto) return 0;
    return calcPrecoDiaria(newStayQuarto, newStayPessoas);
  }, [newStayQuarto, newStayPessoas]);

  const newStayTotalHospedagem = newStayPrecoDiaria * newStayTotalDias;
  const newStayTotalPago = newStayPagamentos.reduce((s, p) => s + p.valor, 0);
  const newStayPendente = Math.max(0, newStayTotalHospedagem - newStayTotalPago);

  // ── Gráfico de preços para nova hospedagem ────────────────────────────────
  const newStayPriceHistory = useMemo(() => {
    if (!newStayCatQuarto) return [];
    if (newStayCatQuarto.modeloCobranca === 'Por quarto (tarifa fixa)') {
      return newStayTotalDias > 0 ? [{ label: 'Total', value: newStayCatQuarto.precoFixo * newStayTotalDias, highlight: true }] : [];
    }
    return Object.entries(newStayCatQuarto.precosOcupacao || {}).map(([p, v]) => ({
      label: `${p} pax`, value: v * (newStayTotalDias || 1),
      highlight: parseInt(p) === newStayPessoas,
    }));
  }, [newStayCatQuarto, newStayPessoas, newStayTotalDias]);

  // ── Gráfico de pagamentos ─────────────────────────────────────────────────
  const paymentSparkline = useMemo(() => {
    if (!selectedStay) return [];
    return selectedStay.diarias.map((d) =>
      d.pagamentos.reduce((s, p) => s + p.valor, 0)
    );
  }, [selectedStay]);

  // ── Handlers: detalhes ────────────────────────────────────────────────────
  const handleOpenDetails = (stay) => {
    if (!permissions.verPernoites && !permissions.acessoTotal) { showNotification('Sem permissão.', 'error'); return; }
    setSelectedStay(stay);
    setDetailsTab('dados');
    setSelectedDiariaIndex(stay.diariaAtual - 1 >= 0 ? stay.diariaAtual - 1 : 0);
    setDiariaTab('detalhes');
    setShowDetailsModal(true);
  };

  // ── Handlers: adicionar diária ────────────────────────────────────────────
  const handleOpenAddDiaria = () => {
    if (!permissions.adicionarDiaria && !permissions.acessoTotal) { showNotification('Sem permissão.', 'error'); return; }
    // Pré-preencher com data/hora do checkout da última diária
    if (selectedStay?.diarias?.length > 0) {
      const ultima = selectedStay.diarias[selectedStay.diarias.length - 1];
      const [datePart, timePart] = ultima.dataFim.split(' ');
      const [d, m, y] = datePart.split('/');
      setDiariaDataInicio(`${y}-${m}-${d}`);
      setDiariaHoraInicio(timePart || '12:00');
    } else {
      setDiariaDataInicio(''); setDiariaHoraInicio('');
    }
    setDiariaDataFim(''); setDiariaHoraFim('12:00');
    setShowAddDiariaModal(true);
  };

  const addDiariaConfirmDays = useMemo(() => {
    if (!diariaDataInicio || !diariaDataFim) return 0;
    return diffDays(diariaDataInicio, diariaDataFim);
  }, [diariaDataInicio, diariaDataFim]);

  const handleSaveAddDiaria = () => {
    if (!diariaDataInicio || !diariaDataFim) { showNotification('Preencha as datas.', 'warning'); return; }
    if (!selectedStay) return;
    const novaId = (selectedStay.diarias.length || 0) + 1;
    const nova = {
      id: novaId, numero: novaId,
      quarto: selectedStay.quarto, valorDiaria: calcPrecoDiaria(selectedStay.quarto, 1),
      dataInicio: `${diariaDataInicio.split('-').reverse().join('/')} ${diariaHoraInicio}`,
      dataFim:    `${diariaDataFim.split('-').reverse().join('/')} ${diariaHoraFim}`,
      hospedes: selectedStay.diarias[0]?.hospedes || [],
      consumos: [], pagamentos: [],
    };
    const updated = { ...selectedStay, diarias: [...selectedStay.diarias, nova], totalDiarias: novaId };
    setSelectedStay(updated);
    setStays((p) => p.map((s) => s.id === updated.id ? updated : s));
    showNotification(`Diária adicionada. Total: ${novaId} dia(s).`, 'success');
    setShowAddDiariaModal(false);
  };

  // ── Handlers: editar diária ───────────────────────────────────────────────
  const handleOpenEditDiaria = () => {
    if (!currentDiaria) return;
    const [dp, tp] = currentDiaria.dataInicio.split(' ');
    const [d1, m1, y1] = dp.split('/');
    setDiariaDataInicio(`${y1}-${m1}-${d1}`);
    setDiariaHoraInicio(tp || '12:00');
    const [df, tf] = currentDiaria.dataFim.split(' ');
    const [d2, m2, y2] = df.split('/');
    setDiariaDataFim(`${y2}-${m2}-${d2}`);
    setDiariaHoraFim(tf || '12:00');
    setShowEditDiariaModal(true);
  };

  const handleSaveEditDiaria = () => {
    if (!diariaDataInicio || !diariaDataFim || !selectedStay) return;
    const updated = {
      ...selectedStay,
      diarias: selectedStay.diarias.map((d, i) =>
        i === selectedDiariaIndex
          ? { ...d,
              dataInicio: `${diariaDataInicio.split('-').reverse().join('/')} ${diariaHoraInicio}`,
              dataFim:    `${diariaDataFim.split('-').reverse().join('/')} ${diariaHoraFim}`,
            }
          : d
      ),
    };
    setSelectedStay(updated);
    setStays((p) => p.map((s) => s.id === updated.id ? updated : s));
    showNotification(`Diária atualizada. Total: ${addDiariaConfirmDays} dia(s).`, 'success');
    setShowEditDiariaModal(false);
  };

  // ── Handlers: editar dados ────────────────────────────────────────────────
  const handleOpenEditDados = () => {
    if (!permissions.editarPernoite && !permissions.acessoTotal) { showNotification('Sem permissão.', 'error'); return; }
    if (!selectedStay) return;
    const [dc, hc] = selectedStay.chegadaPrevista.split(' ');
    const [ds, hs] = selectedStay.saidaPrevista.split(' ');
    const [dC, mC, yC] = dc.split('/');
    const [dS, mS, yS] = ds.split('/');
    setEditChegadaData(`${yC}-${mC}-${dC}`); setEditChegadaHora(hc);
    setEditSaidaData(`${yS}-${mS}-${dS}`);   setEditSaidaHora(hs);
    setShowEditDadosModal(true);
  };

  const handleSaveEditDados = () => {
    if (!selectedStay) return;
    const chegada = `${editChegadaData.split('-').reverse().join('/')} ${editChegadaHora}`;
    const saida   = `${editSaidaData.split('-').reverse().join('/')} ${editSaidaHora}`;
    const updated = { ...selectedStay, chegadaPrevista: chegada, saidaPrevista: saida };
    setSelectedStay(updated);
    setStays((p) => p.map((s) => s.id === updated.id ? updated : s));
    showNotification('Dados atualizados.', 'success');
    setShowEditDadosModal(false);
  };

  // ── Handlers: trocar quarto ───────────────────────────────────────────────
  const handleOpenChangeRoom = () => {
    if (!permissions.trocarQuarto && !permissions.acessoTotal) { showNotification('Sem permissão.', 'error'); return; }
    setChangeRoomCategoria(''); setChangeRoomQuarto('');
    // Pré-selecionar todas as diárias da diária atual em diante
    const idx = selectedDiariaIndex;
    const diasIds = selectedStay?.diarias.slice(idx).map((d) => d.id) || [];
    setChangeRoomDiariasAplicar(diasIds);
    setShowChangeRoomModal(true);
  };

  const handleSaveChangeRoom = () => {
    if (!changeRoomQuarto || !selectedStay) { showNotification('Selecione um quarto.', 'warning'); return; }
    const updated = {
      ...selectedStay,
      quarto: Number(changeRoomQuarto),
      diarias: selectedStay.diarias.map((d) =>
        changeRoomDiariasAplicar.includes(d.id) ? { ...d, quarto: Number(changeRoomQuarto) } : d
      ),
    };
    setSelectedStay(updated);
    setStays((p) => p.map((s) => s.id === updated.id ? updated : s));
    showNotification(`Quarto alterado para ${formatRoomNumber(Number(changeRoomQuarto))} em ${changeRoomDiariasAplicar.length} diária(s).`, 'success');
    setShowChangeRoomModal(false);
  };

  const toggleChangeRoomDiaria = (id) =>
    setChangeRoomDiariasAplicar((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);

  // ── Handlers: hóspede ─────────────────────────────────────────────────────
  const handleOpenAddGuest = () => { setSearchGuestTerm(''); setSelectedGuest(null); setShowAddGuestModal(true); };
  const handleSaveAddGuest = () => {
    if (!selectedGuest || !selectedStay) { showNotification('Selecione um hóspede.', 'warning'); return; }
    const diaria = selectedStay.diarias[selectedDiariaIndex];
    if (!diaria) return;
    if (diaria.hospedes.find((h) => h.id === selectedGuest.id)) { showNotification('Hóspede já adicionado.', 'warning'); return; }
    const updDiaria = { ...diaria, hospedes: [...diaria.hospedes, selectedGuest] };
    const updated = { ...selectedStay, diarias: selectedStay.diarias.map((d, i) => i === selectedDiariaIndex ? updDiaria : d) };
    setSelectedStay(updated);
    setStays((p) => p.map((s) => s.id === updated.id ? updated : s));
    showNotification('Hóspede adicionado.', 'success');
    setShowAddGuestModal(false);
  };

  // ── Handlers: consumo ─────────────────────────────────────────────────────
  const handleOpenAddConsumo = () => { setConsumoCategoria(''); setConsumoProduto(''); setConsumoQuantidade(1); setConsumoFormaPagamento(''); setShowAddConsumoModal(true); };
  const handleSaveAddConsumo = () => {
    const prod = categoriasConsumo.find((c) => c.id === parseInt(consumoCategoria))?.produtos.find((p) => p.id === parseInt(consumoProduto));
    if (!prod || !consumoFormaPagamento || !selectedStay) { showNotification('Preencha todos os campos.', 'warning'); return; }
    const diaria = selectedStay.diarias[selectedDiariaIndex];
    const newC = { id: Date.now(), categoria: categoriasConsumo.find((c) => c.id === parseInt(consumoCategoria))?.nome, item: prod.nome, quantidade: consumoQuantidade, valorUnitario: prod.preco, valorTotal: prod.preco * consumoQuantidade, formaPagamento: consumoFormaPagamento };
    const updDiaria = { ...diaria, consumos: [...diaria.consumos, newC] };
    const updated = { ...selectedStay, diarias: selectedStay.diarias.map((d, i) => i === selectedDiariaIndex ? updDiaria : d) };
    setSelectedStay(updated); setStays((p) => p.map((s) => s.id === updated.id ? updated : s));
    showNotification('Consumo adicionado.', 'success'); setShowAddConsumoModal(false);
  };

  // ── Handlers: pagamento ───────────────────────────────────────────────────
  const handleOpenAddPagamento = () => { setPagamentoDescricao(''); setPagamentoFormaPagamento(''); setPagamentoValor(0); setShowAddPagamentoModal(true); };
  const handleSaveAddPagamento = () => {
    if (!pagamentoDescricao || !pagamentoFormaPagamento || pagamentoValor <= 0 || !selectedStay) { showNotification('Preencha todos os campos.', 'warning'); return; }
    const diaria = selectedStay.diarias[selectedDiariaIndex];
    const newP = { id: Date.now(), descricao: pagamentoDescricao, formaPagamento: pagamentoFormaPagamento, valor: pagamentoValor, data: new Date().toLocaleString('pt-BR') };
    const updDiaria = { ...diaria, pagamentos: [...diaria.pagamentos, newP] };
    const novoPago = selectedStay.totalPago + pagamentoValor;
    const updated = { ...selectedStay, totalPago: novoPago, pagamentoPendente: Math.max(0, selectedStay.valorTotal - novoPago), diarias: selectedStay.diarias.map((d, i) => i === selectedDiariaIndex ? updDiaria : d) };
    setSelectedStay(updated); setStays((p) => p.map((s) => s.id === updated.id ? updated : s));
    showNotification('Pagamento adicionado.', 'success'); setShowAddPagamentoModal(false);
  };

  // ── Handlers: cancelar/finalizar ──────────────────────────────────────────
  const handleCancelStay = () => {
    setStays((p) => p.map((s) => s.id === selectedStay.id ? { ...s, status: STATUS.CANCELADO } : s));
    showNotification('Reserva cancelada.', 'success'); setShowCancelModal(false); setShowDetailsModal(false);
  };
  const handleFinishStay = () => {
    const newStatus = selectedStay.pagamentoPendente > 0 ? STATUS.FINALIZADO_PENDENTE : STATUS.FINALIZADO;
    setStays((p) => p.map((s) => s.id === selectedStay.id ? { ...s, status: newStatus } : s));
    showNotification('Reserva finalizada.', 'success'); setShowFinishModal(false); setShowDetailsModal(false);
  };

  // ── Handlers: nova hospedagem ─────────────────────────────────────────────
  const handleOpenNewStay = () => {
    setNewStayStep(1); setNewStayNome(''); setNewStayQuartoCategoria(''); setNewStayQuarto('');
    setNewStayCheckinData(''); setNewStayCheckinHora('14:00');
    setNewStayCheckoutData(''); setNewStayCheckoutHora('12:00');
    setNewStayPessoas(1); setNewStayPagamentos([]);
    setNewStayPagDesc(''); setNewStayPagForma(''); setNewStayPagValor(0);
    setShowNewStayModal(true);
  };

  const handleAddNewStayPagamento = () => {
    if (!newStayPagDesc || !newStayPagForma || newStayPagValor <= 0) { showNotification('Preencha o pagamento.', 'warning'); return; }
    setNewStayPagamentos((p) => [...p, { id: Date.now(), descricao: newStayPagDesc, formaPagamento: newStayPagForma, valor: newStayPagValor }]);
    setNewStayPagDesc(''); setNewStayPagForma(''); setNewStayPagValor(0);
  };

  const handleSaveNewStay = () => {
    if (!newStayNome || !newStayQuarto || !newStayCheckinData || !newStayCheckoutData) {
      showNotification('Preencha todos os campos obrigatórios.', 'warning'); return;
    }
    const checkin  = `${newStayCheckinData.split('-').reverse().join('/')} ${newStayCheckinHora}`;
    const checkout = `${newStayCheckoutData.split('-').reverse().join('/')} ${newStayCheckoutHora}`;
    const cat = getCategoriaDoQuarto(newStayQuarto);
    const novaStay = {
      id: Date.now(), quarto: Number(newStayQuarto), categoria: cat?.nome || '',
      titularNome: newStayNome,
      periodo: `${newStayCheckinData.split('-').reverse().join('/')} - ${newStayCheckoutData.split('-').reverse().join('/')}`,
      status: STATUS.ATIVO,
      totalDiarias: newStayTotalDias, chegadaPrevista: checkin, saidaPrevista: checkout,
      valorTotal: newStayTotalHospedagem, totalPago: newStayTotalPago,
      pagamentoPendente: newStayPendente, diariaAtual: 1,
      diarias: [{
        id: 1, numero: 1, quarto: Number(newStayQuarto), valorDiaria: newStayPrecoDiaria,
        dataInicio: checkin, dataFim: checkout,
        hospedes: hospedesCadastrados.slice(0,1), consumos: [],
        pagamentos: newStayPagamentos,
      }],
    };
    setStays((p) => [...p, novaStay]);
    showNotification('Hospedagem criada com sucesso!', 'success');
    setShowNewStayModal(false);
  };

  // ── Computed ──────────────────────────────────────────────────────────────
  const stats = {
    total: stays.length, ativos: stays.filter((s) => s.status === STATUS.ATIVO).length,
    diariaEncerrada: stays.filter((s) => s.status === STATUS.DIARIA_ENCERRADA).length,
    finalizados: stays.filter((s) => s.status === STATUS.FINALIZADO).length,
    cancelados: stays.filter((s) => s.status === STATUS.CANCELADO).length,
    finalizadosPendentes: stays.filter((s) => s.status === STATUS.FINALIZADO_PENDENTE).length,
  };

  const filteredStays = stays.filter((s) => selectedStatusFilter === 'all' || s.status === selectedStatusFilter);

  const staysByCategory = categoriasQuartos.map((cat) => ({
    ...cat, stays: filteredStays.filter((s) => s.categoria === cat.nome),
  }));

  const currentDiaria = selectedStay?.diarias?.[selectedDiariaIndex];
  const progressPercent = selectedStay ? Math.min(100, (selectedStay.totalPago / selectedStay.valorTotal) * 100) : 0;
  const filteredGuests = hospedesCadastrados.filter((h) => h.nome.toLowerCase().includes(searchGuestTerm.toLowerCase()));
  const categoriaConsumoSel = categoriasConsumo.find((c) => c.id === parseInt(consumoCategoria));
  const produtoSel = categoriaConsumoSel?.produtos.find((p) => p.id === parseInt(consumoProduto));
  const catChangeRoom = categoriasQuartos.find((c) => c.id === parseInt(changeRoomCategoria));
  const newStayQuartosCat = categoriasQuartos.find((c) => c.id === parseInt(newStayQuartoCategoria));

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className={`min-h-screen relative ${theme.bgGradient}`}>
      {/* Fundo overlay usando style em vez de className para evitar bug de tema */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{ background: `radial-gradient(circle at 50% 120%, ${theme.overlay}, transparent)` }}
      />

      <div className="relative max-w-[1600px] mx-auto p-4 sm:p-8">

        {/* ── Header ── */}
        <header className="mb-6 pt-6 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className={`text-3xl font-bold ${theme.text} mb-1 tracking-tight`}>Pernoites</h1>
            <p className={`${theme.textSecondary} text-sm flex items-center gap-2`}>
              <BedDouble className="w-3.5 h-3.5" /> Gestão de hospedagens e diárias
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {permissions.novaHospedagem && (
              <button onClick={handleOpenNewStay}
                className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-medium flex items-center gap-2 hover:scale-105 active:scale-95 transition-all">
                <Plus className="w-4 h-4" /> Nova Hospedagem
              </button>
            )}
            <button onClick={() => setShowPermissionsModal(true)}
              className={`px-4 py-2 ${theme.button} ${theme.text} rounded-lg border text-sm font-medium flex items-center gap-2 hover:scale-105 active:scale-95 transition-all`}>
              <Shield className="w-4 h-4" /> Permissões
            </button>
            <button onClick={() => setIsDark(!isDark)}
              className={`px-4 py-2 ${theme.button} ${theme.text} rounded-lg border text-sm font-medium flex items-center gap-2 hover:scale-105 active:scale-95 transition-all`}>
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              {isDark ? 'Light' : 'Dark'}
            </button>
          </div>
        </header>

        {/* ── Dashboard ── */}
        {permissions.dashboard && (
          <div className={`${theme.card} rounded-xl p-4 mb-6 border`}>
            <div className="flex items-center gap-2 mb-4">
              <BarChart2 className="w-4 h-4 text-violet-500" />
              <h2 className={`text-sm font-bold ${theme.text} uppercase tracking-wider`}>Status dos Pernoites</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { key:'all',                     label:'TODOS',     count:stats.total,                 from:'from-slate-500',   to:'to-slate-700',    Icon:BedDouble    },
                { key:STATUS.ATIVO,              label:'ATIVOS',    count:stats.ativos,                from:'from-emerald-500', to:'to-teal-600',     Icon:CheckCircle  },
                { key:STATUS.DIARIA_ENCERRADA,   label:'ENCERRADA', count:stats.diariaEncerrada,       from:'from-amber-500',   to:'to-yellow-500',   Icon:Clock        },
                { key:STATUS.FINALIZADO,         label:'FINALIZADOS',count:stats.finalizados,          from:'from-blue-500',    to:'to-indigo-600',   Icon:Check        },
                { key:STATUS.CANCELADO,          label:'CANCELADOS',count:stats.cancelados,            from:'from-rose-500',    to:'to-red-600',      Icon:XCircle      },
                { key:STATUS.FINALIZADO_PENDENTE,label:'PENDENTE',  count:stats.finalizadosPendentes,  from:'from-orange-500',  to:'to-amber-600',    Icon:AlertCircle  },
              ].map(({ key, label, count, from, to, Icon }) => (
                <button key={key} onClick={() => setSelectedStatusFilter(key)}
                  className={`rounded-xl p-3 text-left transition-all bg-gradient-to-br ${from} ${to} ${selectedStatusFilter === key ? 'ring-2 ring-white/60 scale-105' : 'opacity-90 hover:opacity-100'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className="w-4 h-4 text-white/80" />
                    <span className="text-white/90 font-bold text-[11px] uppercase">{label}</span>
                  </div>
                  <p className="text-3xl font-bold text-white">{count}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Listagem ── */}
        <div className={`${theme.card} rounded-xl border overflow-hidden`}>
          <div className={`px-4 py-3 border-b ${theme.divider} flex items-center justify-between`}>
            <div>
              <h2 className={`text-lg font-bold ${theme.text}`}>Hospedagens por Categoria</h2>
              <p className={`${theme.textSecondary} text-xs`}>Clique para ver detalhes.</p>
            </div>
          </div>
          <div className={`divide-y ${theme.divider}`}>
            {staysByCategory.map((cat) => {
              if (cat.stays.length === 0) return null;
              const isCollapsed = collapsedCategories[cat.nome];
              return (
                <div key={cat.id}>
                  <div onClick={() => toggleCategoryCollapse(cat.nome)}
                    className={`px-4 py-3 flex items-center justify-between cursor-pointer ${theme.cardHover} transition-all`}>
                    <div className="flex items-center gap-3">
                      <ChevronDown className={`w-4 h-4 text-violet-400 transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
                      <BedDouble className="w-4 h-4 text-violet-400" />
                      <span className={`${theme.text} font-semibold text-sm`}>{cat.nome}</span>
                      <span className={`${theme.textSecondary} text-xs`}>({cat.stays.length})</span>
                    </div>
                  </div>
                  {!isCollapsed && cat.stays.map((stay) => (
                    <div key={stay.id} onClick={() => handleOpenDetails(stay)}
                      className={`px-4 py-3 ml-8 flex items-center justify-between cursor-pointer ${theme.cardHover} transition-all border-l-2 border-violet-500/30`}>
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-xl bg-violet-500/20 flex items-center justify-center shrink-0">
                          <span className="text-xl font-extrabold text-violet-400">{formatRoomNumber(stay.quarto)}</span>
                        </div>
                        <div>
                          <span className={`${theme.text} font-semibold text-sm block`}>{stay.titularNome}</span>
                          <div className="flex items-center gap-3 mt-1 flex-wrap">
                            <span className={`${theme.textSecondary} text-xs flex items-center gap-1`}>
                              <Calendar className="w-3 h-3" /> {stay.periodo}
                            </span>
                            <span className={`${theme.textSecondary} text-xs`}>
                              {stay.totalDiarias} diária{stay.totalDiarias > 1 ? 's' : ''}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="hidden sm:flex flex-col items-end gap-1">
                        <span className={`text-[11px] px-2 py-0.5 rounded-full border ${getStatusColor(stay.status)}`}>{stay.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════
          MODAL: Detalhes do Pernoite
      ══════════════════════════════════════════════════ */}
      {showDetailsModal && selectedStay && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className={`${theme.modal} rounded-xl border shadow-2xl max-w-5xl w-full my-8`}>

            {/* Header modal */}
            <div className={`p-4 border-b ${theme.divider} flex items-center justify-between`}>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-violet-500/20 flex items-center justify-center">
                  <span className="text-xl font-extrabold text-violet-400">{formatRoomNumber(selectedStay.quarto)}</span>
                </div>
                <div>
                  <h3 className={`text-lg font-bold ${theme.text}`}>{selectedStay.titularNome}</h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-[11px] px-2 py-0.5 rounded-full border ${getStatusColor(selectedStay.status)}`}>{selectedStay.status}</span>
                    <span className={`${theme.textSecondary} text-xs`}>{selectedStay.periodo}</span>
                  </div>
                </div>
              </div>
              <button onClick={() => setShowDetailsModal(false)} className={`${theme.textSecondary} hover:scale-110 active:scale-90 transition-transform`}>
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tabs principais */}
            <div className={`px-4 pt-3 pb-0 border-b ${theme.divider} flex gap-2`}>
              {[['dados','Dados do Pernoite'],['diarias','Diárias']].map(([t, label]) => (
                <button key={t} onClick={() => setDetailsTab(t)}
                  className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-all border-b-2 ${detailsTab === t ? 'border-violet-500 text-violet-400 bg-violet-500/10' : 'border-transparent ' + theme.textSecondary + ' hover:text-white'}`}>
                  {label}
                </button>
              ))}
            </div>

            <div className="p-4 max-h-[72vh] overflow-y-auto">

              {/* ── TAB: Dados ── */}
              {detailsTab === 'dados' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className={`${theme.card} rounded-lg border p-3`}>
                      <div className="flex items-center gap-2 mb-2"><Calendar className="w-4 h-4 text-violet-400" /><span className={`${theme.text} text-xs font-semibold uppercase`}>Período</span></div>
                      <p className={`${theme.text} text-sm font-medium`}>{selectedStay.periodo}</p>
                      <p className={`${theme.textSecondary} text-xs mt-1`}>{selectedStay.totalDiarias} diária{selectedStay.totalDiarias > 1 ? 's' : ''}</p>
                    </div>
                    <div className={`${theme.card} rounded-lg border p-3`}>
                      <div className="flex items-center gap-2 mb-2"><Clock className="w-4 h-4 text-emerald-400" /><span className={`${theme.text} text-xs font-semibold uppercase`}>Check-in / Check-out</span></div>
                      <p className={`${theme.text} text-sm`}>Entrada: {selectedStay.chegadaPrevista}</p>
                      <p className={`${theme.text} text-sm mt-1`}>Saída: {selectedStay.saidaPrevista}</p>
                    </div>
                  </div>

                  {/* Resumo financeiro */}
                  <div className={`${theme.card} rounded-lg border p-4`}>
                    <div className="flex items-center gap-2 mb-3"><DollarSign className="w-4 h-4 text-amber-400" /><span className={`${theme.text} text-sm font-semibold uppercase`}>Resumo Financeiro</span></div>
                    <div className="grid grid-cols-3 gap-4 mb-4">
                      {[
                        { label:'Valor Total', value: fmt(selectedStay.valorTotal), cls: theme.text },
                        { label:'Total Pago',  value: fmt(selectedStay.totalPago),  cls: 'text-emerald-400' },
                        { label:'Pendente',    value: fmt(selectedStay.pagamentoPendente), cls: selectedStay.pagamentoPendente > 0 ? 'text-amber-400' : 'text-emerald-400' },
                      ].map(({ label, value, cls }) => (
                        <div key={label}>
                          <span className={`${theme.textSecondary} text-xs uppercase block mb-1`}>{label}</span>
                          <span className={`${cls} text-xl font-bold`}>{value}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <div className="flex justify-between mb-1">
                          <span className={`${theme.textSecondary} text-xs`}>Progresso</span>
                          <span className={`${theme.text} text-xs font-semibold`}>{progressPercent.toFixed(0)}%</span>
                        </div>
                        <div className={`w-full ${isDark ? 'bg-slate-700' : 'bg-slate-200'} rounded-full h-2`}>
                          <div className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all" style={{ width: `${progressPercent}%` }} />
                        </div>
                      </div>
                      <MiniDonut pct={progressPercent} color="#10b981" />
                    </div>
                    {paymentSparkline.length > 1 && (
                      <div className="mt-3 h-10"><Sparkline values={paymentSparkline} color="#8b5cf6" h={40} w={200} /></div>
                    )}
                  </div>

                  {/* Botões */}
                  <div className="flex flex-wrap gap-2">
                    {permissions.adicionarDiaria && (
                      <button onClick={handleOpenAddDiaria}
                        className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-medium flex items-center gap-2 hover:scale-105 active:scale-95 transition-all">
                        <Plus className="w-4 h-4" /> Adicionar Diária
                      </button>
                    )}
                    {permissions.editarPernoite && (
                      <button onClick={handleOpenEditDados}
                        className={`px-4 py-2 ${theme.button} ${theme.text} rounded-lg border text-sm font-medium flex items-center gap-2 hover:scale-105 active:scale-95 transition-all`}>
                        <Edit className="w-4 h-4" /> Editar Dados
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* ── TAB: Diárias ── */}
              {detailsTab === 'diarias' && (
                <div className="space-y-4">
                  {/* Navegação de diárias */}
                  <div className={`${theme.card} rounded-lg border p-3`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className={`${theme.textSecondary} text-xs uppercase`}>Selecione a diária</span>
                      <span className="text-xs px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                        Diária atual: {selectedStay.diariaAtual}
                      </span>
                    </div>
                    <div className="relative">
                      <button onClick={() => selectedDiariaIndex > 0 && setSelectedDiariaIndex(selectedDiariaIndex - 1)}
                        disabled={selectedDiariaIndex === 0}
                        className={`absolute left-0 top-1/2 -translate-y-1/2 z-10 p-1.5 rounded-full transition-all ${selectedDiariaIndex === 0 ? 'opacity-30 cursor-not-allowed bg-slate-700' : `${isDark ? 'bg-slate-700 hover:bg-slate-600' : 'bg-slate-200 hover:bg-slate-300'}`}`}>
                        <ChevronLeft className={`w-4 h-4 ${theme.text}`} />
                      </button>
                      <button onClick={() => selectedDiariaIndex < selectedStay.diarias.length - 1 && setSelectedDiariaIndex(selectedDiariaIndex + 1)}
                        disabled={selectedDiariaIndex === selectedStay.diarias.length - 1}
                        className={`absolute right-0 top-1/2 -translate-y-1/2 z-10 p-1.5 rounded-full transition-all ${selectedDiariaIndex === selectedStay.diarias.length - 1 ? 'opacity-30 cursor-not-allowed bg-slate-700' : `${isDark ? 'bg-slate-700 hover:bg-slate-600' : 'bg-slate-200 hover:bg-slate-300'}`}`}>
                        <ChevronRight className={`w-4 h-4 ${theme.text}`} />
                      </button>
                      <div className="overflow-x-auto px-10">
                        <div className="flex gap-2 py-2">
                          {selectedStay.diarias.map((diaria, idx) => {
                            const isAtual = idx + 1 === selectedStay.diariaAtual;
                            const isSel = selectedDiariaIndex === idx;
                            return (
                              <button key={idx} onClick={() => setSelectedDiariaIndex(idx)}
                                className={`px-3 py-2 text-sm rounded-lg border transition-all flex-shrink-0 relative ${isSel ? 'bg-violet-600 text-white border-violet-400' : isAtual ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40' : `${theme.button} ${theme.text}`}`}>
                                <div className="font-semibold">Diária {diaria.numero}{isAtual && !isSel && ' ●'}</div>
                                <div className="text-[10px] opacity-75">{diaria.dataInicio?.split(' ')[0]}</div>
                                {isAtual && <span className="absolute -top-1.5 -right-1.5 text-[9px] bg-emerald-500 text-white px-1 rounded-full">atual</span>}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>

                  {currentDiaria && (
                    <>
                      {/* Trocar quarto — fora das sub-tabs, separado */}
                      {permissions.trocarQuarto && (
                        <div className={`${theme.sectionBg} rounded-lg border p-3 flex items-center justify-between`}>
                          <div className="flex items-center gap-2">
                            <Home className="w-4 h-4 text-sky-400" />
                            <span className={`${theme.text} text-sm font-medium`}>
                              Quarto atual: <span className="font-bold text-sky-400">{formatRoomNumber(currentDiaria.quarto)}</span>
                            </span>
                          </div>
                          <button onClick={handleOpenChangeRoom}
                            className={`px-3 py-1.5 ${theme.button} ${theme.text} rounded-lg border text-xs font-medium flex items-center gap-1.5 hover:scale-105 active:scale-95 transition-all`}>
                            <RefreshCw className="w-3.5 h-3.5" /> Trocar de Quarto
                          </button>
                        </div>
                      )}

                      {/* Sub-tabs */}
                      <div className={`flex gap-1 border-b ${theme.divider} pb-0`}>
                        {[['detalhes','Detalhes'],['hospedes','Hóspedes'],['consumo','Consumo'],['pagamentos','Pagamentos']].map(([t, label]) => (
                          <button key={t} onClick={() => setDiariaTab(t)}
                            className={`px-3 py-2 text-xs font-medium rounded-t-lg transition-all border-b-2 ${diariaTab === t ? 'border-violet-500 text-violet-400 bg-violet-500/10' : 'border-transparent ' + theme.textSecondary}`}>
                            {label}
                          </button>
                        ))}
                      </div>

                      {/* Sub-tab: Detalhes */}
                      {diariaTab === 'detalhes' && (
                        <div className="space-y-3">
                          <div className={`${theme.card} rounded-lg border p-4 space-y-3`}>
                            {[
                              { label:'Quarto', value: formatRoomNumber(currentDiaria.quarto) },
                              { label:'Valor da Diária', value: fmt(currentDiaria.valorDiaria) },
                              { label:'Período', value: `${currentDiaria.dataInicio} → ${currentDiaria.dataFim}` },
                            ].map(({ label, value }) => (
                              <div key={label} className={`flex items-center justify-between border-b ${theme.divider} pb-2 last:border-0 last:pb-0`}>
                                <span className={`${theme.textSecondary} text-xs uppercase`}>{label}</span>
                                <span className={`${theme.text} font-semibold text-sm`}>{value}</span>
                              </div>
                            ))}
                          </div>
                          {permissions.adicionarDiaria && (
                            <button onClick={handleOpenEditDiaria}
                              className={`px-4 py-2 ${theme.button} ${theme.text} rounded-lg border text-sm font-medium flex items-center gap-2 hover:scale-105 active:scale-95 transition-all`}>
                              <Edit className="w-4 h-4" /> Editar Diária
                            </button>
                          )}
                        </div>
                      )}

                      {/* Sub-tab: Hóspedes */}
                      {diariaTab === 'hospedes' && (
                        <div className="space-y-3">
                          {permissions.gerenciarHospedes && (
                            <button onClick={handleOpenAddGuest}
                              className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-medium flex items-center gap-2 hover:scale-105 active:scale-95 transition-all">
                              <Plus className="w-4 h-4" /> Adicionar Hóspede
                            </button>
                          )}
                          <div className="space-y-2">
                            {currentDiaria.hospedes.length === 0
                              ? <p className={`${theme.textSecondary} text-sm text-center py-8`}>Nenhum hóspede.</p>
                              : currentDiaria.hospedes.map((h) => (
                                <div key={h.id} className={`${theme.card} rounded-lg border p-3 flex items-center justify-between`}>
                                  <div>
                                    <div className="flex items-center gap-2"><User className="w-4 h-4 text-violet-400" /><span className={`${theme.text} font-semibold text-sm`}>{h.nome}</span></div>
                                    <p className={`${theme.textSecondary} text-xs mt-1`}>CPF: {h.cpf} • Tel: {h.telefone}</p>
                                  </div>
                                  {permissions.gerenciarHospedes && (
                                    <button onClick={() => showNotification('Remover hóspede (implementar)', 'info')} className="text-rose-400 hover:text-rose-300"><Trash2 className="w-4 h-4" /></button>
                                  )}
                                </div>
                              ))}
                          </div>
                        </div>
                      )}

                      {/* Sub-tab: Consumo */}
                      {diariaTab === 'consumo' && (
                        <div className="space-y-3">
                          {permissions.gerenciarConsumo && (
                            <button onClick={handleOpenAddConsumo}
                              className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-medium flex items-center gap-2 hover:scale-105 active:scale-95 transition-all">
                              <Plus className="w-4 h-4" /> Adicionar Consumo
                            </button>
                          )}
                          {currentDiaria.consumos.length === 0
                            ? <p className={`${theme.textSecondary} text-sm text-center py-8`}>Nenhum consumo registrado.</p>
                            : currentDiaria.consumos.map((c) => (
                              <div key={c.id} className={`${theme.card} rounded-lg border p-3 flex items-center justify-between`}>
                                <div>
                                  <div className="flex items-center gap-2"><ShoppingCart className="w-4 h-4 text-emerald-400" /><span className={`${theme.text} font-semibold text-sm`}>{c.item}</span></div>
                                  <p className={`${theme.textSecondary} text-xs mt-1`}>{c.categoria} • Qtd: {c.quantidade} • Unit: {fmt(c.valorUnitario)} • {c.formaPagamento}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className={`${theme.text} font-bold`}>{fmt(c.valorTotal)}</span>
                                  {permissions.gerenciarConsumo && <button className="text-rose-400 hover:text-rose-300"><Trash2 className="w-4 h-4" /></button>}
                                </div>
                              </div>
                            ))}
                        </div>
                      )}

                      {/* Sub-tab: Pagamentos */}
                      {diariaTab === 'pagamentos' && (
                        <div className="space-y-3">
                          {permissions.gerenciarPagamentos && (
                            <button onClick={handleOpenAddPagamento}
                              className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-medium flex items-center gap-2 hover:scale-105 active:scale-95 transition-all">
                              <Plus className="w-4 h-4" /> Adicionar Pagamento
                            </button>
                          )}
                          {currentDiaria.pagamentos.length === 0
                            ? <p className={`${theme.textSecondary} text-sm text-center py-8`}>Nenhum pagamento registrado.</p>
                            : currentDiaria.pagamentos.map((p) => (
                              <div key={p.id} className={`${theme.card} rounded-lg border p-3 flex items-center justify-between`}>
                                <div>
                                  <div className="flex items-center gap-2"><CreditCard className="w-4 h-4 text-emerald-400" /><span className={`${theme.text} font-semibold text-sm`}>{p.descricao}</span></div>
                                  <p className={`${theme.textSecondary} text-xs mt-1`}>{p.formaPagamento} • {p.data}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-emerald-400 font-bold">{fmt(p.valor)}</span>
                                  {permissions.gerenciarPagamentos && <button className="text-rose-400 hover:text-rose-300"><Trash2 className="w-4 h-4" /></button>}
                                </div>
                              </div>
                            ))}
                        </div>
                      )}
                    </>
                  )}

                  {!currentDiaria && selectedStay.diarias.length === 0 && (
                    <p className={`${theme.textSecondary} text-sm text-center py-12`}>Nenhuma diária cadastrada para este pernoite.</p>
                  )}
                </div>
              )}
            </div>

            {/* Rodapé */}
            <div className={`p-4 border-t ${theme.divider} flex gap-2 justify-end`}>
              {permissions.cancelarReserva && (
                <button onClick={() => setShowCancelModal(true)}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-medium flex items-center gap-2 hover:scale-105 active:scale-95 transition-all">
                  <XCircle className="w-4 h-4" /> Cancelar
                </button>
              )}
              {permissions.finalizarReserva && (
                <button onClick={() => setShowFinishModal(true)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium flex items-center gap-2 hover:scale-105 active:scale-95 transition-all">
                  <Check className="w-4 h-4" /> Finalizar
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          MODAL: Adicionar Diária
      ══════════════════════════════════════════════════ */}
      {showAddDiariaModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className={`${theme.modal} rounded-xl border shadow-2xl max-w-lg w-full`}>
            <div className={`p-4 border-b ${theme.divider} flex items-center justify-between`}>
              <h3 className={`text-lg font-bold ${theme.text}`}>Adicionar Diária</h3>
              <button onClick={() => setShowAddDiariaModal(false)} className={`${theme.textSecondary} hover:scale-110 active:scale-90 transition-transform`}><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-4 text-sm">
              <div className={`rounded-lg p-3 ${isDark ? 'bg-violet-500/10 border border-violet-500/20' : 'bg-violet-50 border border-violet-200'}`}>
                <p className={`${theme.textSecondary} text-xs`}>A data de início é pré-preenchida com o checkout da última diária.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block mb-1 text-xs ${theme.textSecondary}`}>Data início</label>
                  <input type="date" value={diariaDataInicio} onChange={(e) => setDiariaDataInicio(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={`block mb-1 text-xs ${theme.textSecondary}`}>Hora início</label>
                  <input type="time" value={diariaHoraInicio} onChange={(e) => setDiariaHoraInicio(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={`block mb-1 text-xs ${theme.textSecondary}`}>Data fim</label>
                  <input type="date" value={diariaDataFim} onChange={(e) => setDiariaDataFim(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={`block mb-1 text-xs ${theme.textSecondary}`}>Hora fim (checkout)</label>
                  <input type="time" value={diariaHoraFim} onChange={(e) => setDiariaHoraFim(e.target.value)} className={inputCls} />
                </div>
              </div>
              {addDiariaConfirmDays > 0 && (
                <div className={`rounded-lg p-3 ${isDark ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-emerald-50 border border-emerald-200'} flex items-center gap-2`}>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span className={`${theme.text} text-sm font-semibold`}>Confirmar adição de {addDiariaConfirmDays} dia(s) ao pernoite</span>
                </div>
              )}
            </div>
            <div className={`p-4 border-t ${theme.divider} flex gap-2`}>
              <button onClick={() => setShowAddDiariaModal(false)} className={`flex-1 px-4 py-2 ${theme.button} ${theme.text} rounded-lg border text-sm font-medium hover:scale-105 active:scale-95 transition-all`}>Cancelar</button>
              <button onClick={handleSaveAddDiaria} className="flex-1 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-medium hover:scale-105 active:scale-95 transition-all">Salvar Diária</button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          MODAL: Editar Diária
      ══════════════════════════════════════════════════ */}
      {showEditDiariaModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className={`${theme.modal} rounded-xl border shadow-2xl max-w-lg w-full`}>
            <div className={`p-4 border-b ${theme.divider} flex items-center justify-between`}>
              <h3 className={`text-lg font-bold ${theme.text}`}>Editar Diária {currentDiaria?.numero}</h3>
              <button onClick={() => setShowEditDiariaModal(false)} className={`${theme.textSecondary} hover:scale-110 active:scale-90 transition-transform`}><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block mb-1 text-xs ${theme.textSecondary}`}>Data início</label>
                  <input type="date" value={diariaDataInicio} onChange={(e) => setDiariaDataInicio(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={`block mb-1 text-xs ${theme.textSecondary}`}>Hora início</label>
                  <input type="time" value={diariaHoraInicio} onChange={(e) => setDiariaHoraInicio(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={`block mb-1 text-xs ${theme.textSecondary}`}>Data fim</label>
                  <input type="date" value={diariaDataFim} onChange={(e) => setDiariaDataFim(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={`block mb-1 text-xs ${theme.textSecondary}`}>Hora fim (checkout)</label>
                  <input type="time" value={diariaHoraFim} onChange={(e) => setDiariaHoraFim(e.target.value)} className={inputCls} />
                </div>
              </div>
              {addDiariaConfirmDays > 0 && (
                <div className={`rounded-lg p-3 ${isDark ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-amber-50 border border-amber-200'} flex items-center gap-2`}>
                  <AlertCircle className="w-4 h-4 text-amber-400" />
                  <span className={`${theme.text} text-sm font-semibold`}>Total atualizado: {addDiariaConfirmDays} dia(s)</span>
                </div>
              )}
            </div>
            <div className={`p-4 border-t ${theme.divider} flex gap-2`}>
              <button onClick={() => setShowEditDiariaModal(false)} className={`flex-1 px-4 py-2 ${theme.button} ${theme.text} rounded-lg border text-sm font-medium hover:scale-105 active:scale-95 transition-all`}>Cancelar</button>
              <button onClick={handleSaveEditDiaria} className="flex-1 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-medium hover:scale-105 active:scale-95 transition-all">Salvar</button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          MODAL: Trocar Quarto
      ══════════════════════════════════════════════════ */}
      {showChangeRoomModal && selectedStay && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4 overflow-y-auto">
          <div className={`${theme.modal} rounded-xl border shadow-2xl max-w-lg w-full my-8`}>
            <div className={`p-4 border-b ${theme.divider} flex items-center justify-between`}>
              <h3 className={`text-lg font-bold ${theme.text}`}>Trocar de Quarto</h3>
              <button onClick={() => setShowChangeRoomModal(false)} className={`${theme.textSecondary} hover:scale-110 active:scale-90 transition-transform`}><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-4 text-sm">

              {/* Selecionar diárias a aplicar */}
              <div>
                <label className={`block mb-2 text-xs font-medium ${theme.textSecondary}`}>Aplicar troca nas diárias:</label>
                <div className="flex flex-wrap gap-2">
                  {selectedStay.diarias.map((d) => {
                    const isAtual = d.numero === selectedStay.diariaAtual;
                    const isSel = changeRoomDiariasAplicar.includes(d.id);
                    return (
                      <button key={d.id} type="button" onClick={() => toggleChangeRoomDiaria(d.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all relative ${isSel ? 'bg-violet-600 text-white border-violet-400' : `${theme.button} ${theme.text}`}`}>
                        Diária {d.numero}
                        {isAtual && <span className="ml-1 text-emerald-300">★</span>}
                      </button>
                    );
                  })}
                </div>
                <p className={`${theme.textSecondary} text-[11px] mt-1`}>★ = diária atual</p>
              </div>

              {/* Categoria */}
              <div>
                <label className={`block mb-1 text-xs font-medium ${theme.textSecondary}`}>Categoria</label>
                <select value={changeRoomCategoria} onChange={(e) => { setChangeRoomCategoria(e.target.value); setChangeRoomQuarto(''); }} className={inputCls}>
                  <option value="">Escolha uma categoria</option>
                  {categoriasQuartos.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>

              {changeRoomCategoria && (
                <div>
                  <label className={`block mb-2 text-xs font-medium ${theme.textSecondary}`}>Novo quarto</label>
                  <div className="grid grid-cols-5 gap-2">
                    {catChangeRoom?.quartos.map((q) => (
                      <button key={q} type="button" onClick={() => setChangeRoomQuarto(q)}
                        className={`px-3 py-2 text-sm rounded-lg border transition-all font-bold ${changeRoomQuarto === q ? 'bg-violet-600 text-white border-violet-400' : `${theme.button} ${theme.text}`}`}>
                        {formatRoomNumber(q)}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {changeRoomQuarto && (
                <div className={`rounded-lg p-3 ${isDark ? 'bg-sky-500/10 border border-sky-500/20' : 'bg-sky-50 border border-sky-200'} flex items-center gap-2`}>
                  <ArrowRight className="w-4 h-4 text-sky-400" />
                  <span className={`${theme.text} text-sm`}>
                    Quarto <b>{formatRoomNumber(selectedStay.quarto)}</b> → <b className="text-sky-400">{formatRoomNumber(Number(changeRoomQuarto))}</b> em <b>{changeRoomDiariasAplicar.length}</b> diária(s)
                  </span>
                </div>
              )}
            </div>
            <div className={`p-4 border-t ${theme.divider} flex gap-2`}>
              <button onClick={() => setShowChangeRoomModal(false)} className={`flex-1 px-4 py-2 ${theme.button} ${theme.text} rounded-lg border text-sm font-medium hover:scale-105 active:scale-95 transition-all`}>Cancelar</button>
              <button onClick={handleSaveChangeRoom} className="flex-1 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-medium hover:scale-105 active:scale-95 transition-all">Confirmar Troca</button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          MODAL: Editar Dados do Pernoite
      ══════════════════════════════════════════════════ */}
      {showEditDadosModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className={`${theme.modal} rounded-xl border shadow-2xl max-w-lg w-full`}>
            <div className={`p-4 border-b ${theme.divider} flex items-center justify-between`}>
              <h3 className={`text-lg font-bold ${theme.text}`}>Editar Dados do Pernoite</h3>
              <button onClick={() => setShowEditDadosModal(false)} className={`${theme.textSecondary} hover:scale-110 active:scale-90 transition-transform`}><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><label className={`block mb-1 text-xs ${theme.textSecondary}`}>Data check-in</label><input type="date" value={editChegadaData} onChange={(e) => setEditChegadaData(e.target.value)} className={inputCls} /></div>
                <div><label className={`block mb-1 text-xs ${theme.textSecondary}`}>Hora check-in</label><input type="time" value={editChegadaHora} onChange={(e) => setEditChegadaHora(e.target.value)} className={inputCls} /></div>
                <div><label className={`block mb-1 text-xs ${theme.textSecondary}`}>Data check-out</label><input type="date" value={editSaidaData} onChange={(e) => setEditSaidaData(e.target.value)} className={inputCls} /></div>
                <div><label className={`block mb-1 text-xs ${theme.textSecondary}`}>Hora check-out</label><input type="time" value={editSaidaHora} onChange={(e) => setEditSaidaHora(e.target.value)} className={inputCls} /></div>
              </div>
            </div>
            <div className={`p-4 border-t ${theme.divider} flex gap-2`}>
              <button onClick={() => setShowEditDadosModal(false)} className={`flex-1 px-4 py-2 ${theme.button} ${theme.text} rounded-lg border text-sm font-medium hover:scale-105 active:scale-95 transition-all`}>Cancelar</button>
              <button onClick={handleSaveEditDados} className="flex-1 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-medium hover:scale-105 active:scale-95 transition-all">Salvar</button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          MODAL: Adicionar Hóspede
      ══════════════════════════════════════════════════ */}
      {showAddGuestModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className={`${theme.modal} rounded-xl border shadow-2xl max-w-lg w-full`}>
            <div className={`p-4 border-b ${theme.divider} flex items-center justify-between`}>
              <h3 className={`text-lg font-bold ${theme.text}`}>Adicionar Hóspede</h3>
              <button onClick={() => setShowAddGuestModal(false)} className={`${theme.textSecondary} hover:scale-110 active:scale-90 transition-transform`}><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-4">
              <div className="relative">
                <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${theme.textSecondary}`} />
                <input type="text" placeholder="Buscar por nome..." value={searchGuestTerm} onChange={(e) => setSearchGuestTerm(e.target.value)}
                  className={`${inputCls} pl-9`} />
              </div>
              <div className={`${theme.card} rounded-lg border max-h-64 overflow-y-auto`}>
                {filteredGuests.map((h) => (
                  <button key={h.id} onClick={() => setSelectedGuest(h)}
                    className={`w-full text-left px-3 py-2 border-b last:border-0 ${theme.divider} transition-all ${selectedGuest?.id === h.id ? 'bg-violet-600 text-white' : theme.cardHover + ' ' + theme.text}`}>
                    <div className="font-semibold text-sm">{h.nome}</div>
                    <div className="text-xs opacity-70">CPF: {h.cpf} • {h.telefone}</div>
                  </button>
                ))}
              </div>
            </div>
            <div className={`p-4 border-t ${theme.divider} flex gap-2`}>
              <button onClick={() => setShowAddGuestModal(false)} className={`flex-1 px-4 py-2 ${theme.button} ${theme.text} rounded-lg border text-sm font-medium`}>Cancelar</button>
              <button onClick={handleSaveAddGuest} className="flex-1 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-medium">Adicionar</button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          MODAL: Adicionar Consumo
      ══════════════════════════════════════════════════ */}
      {showAddConsumoModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className={`${theme.modal} rounded-xl border shadow-2xl max-w-lg w-full`}>
            <div className={`p-4 border-b ${theme.divider} flex items-center justify-between`}>
              <h3 className={`text-lg font-bold ${theme.text}`}>Adicionar Consumo</h3>
              <button onClick={() => setShowAddConsumoModal(false)} className={`${theme.textSecondary} hover:scale-110 active:scale-90 transition-transform`}><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-4 text-sm">
              <div>
                <label className={`block mb-1 text-xs ${theme.textSecondary}`}>Categoria</label>
                <select value={consumoCategoria} onChange={(e) => { setConsumoCategoria(e.target.value); setConsumoProduto(''); }} className={inputCls}>
                  <option value="">Selecione</option>
                  {categoriasConsumo.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
              {consumoCategoria && (
                <div>
                  <label className={`block mb-1 text-xs ${theme.textSecondary}`}>Produto</label>
                  <select value={consumoProduto} onChange={(e) => setConsumoProduto(e.target.value)} className={inputCls}>
                    <option value="">Selecione</option>
                    {categoriaConsumoSel?.produtos.map((p) => <option key={p.id} value={p.id}>{p.nome} — {fmt(p.preco)}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className={`block mb-1 text-xs ${theme.textSecondary}`}>Quantidade</label>
                <input type="number" min={1} value={consumoQuantidade} onChange={(e) => setConsumoQuantidade(parseInt(e.target.value) || 1)} className={inputCls} />
              </div>
              <div>
                <label className={`block mb-1 text-xs ${theme.textSecondary}`}>Forma de pagamento</label>
                <select value={consumoFormaPagamento} onChange={(e) => setConsumoFormaPagamento(e.target.value)} className={inputCls}>
                  <option value="">Selecione</option>
                  {FORMAS_PAGAMENTO.map((fp) => <option key={fp}>{fp}</option>)}
                </select>
              </div>
              {produtoSel && (
                <div className={`rounded-lg p-3 ${isDark ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-emerald-50 border-emerald-200'} border flex justify-between items-center`}>
                  <span className={`${theme.textSecondary} text-xs`}>Total</span>
                  <span className="text-emerald-400 font-bold text-lg">{fmt(produtoSel.preco * consumoQuantidade)}</span>
                </div>
              )}
            </div>
            <div className={`p-4 border-t ${theme.divider} flex gap-2`}>
              <button onClick={() => setShowAddConsumoModal(false)} className={`flex-1 px-4 py-2 ${theme.button} ${theme.text} rounded-lg border text-sm font-medium`}>Cancelar</button>
              <button onClick={handleSaveAddConsumo} className="flex-1 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-medium">Adicionar</button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          MODAL: Adicionar Pagamento
      ══════════════════════════════════════════════════ */}
      {showAddPagamentoModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className={`${theme.modal} rounded-xl border shadow-2xl max-w-lg w-full`}>
            <div className={`p-4 border-b ${theme.divider} flex items-center justify-between`}>
              <h3 className={`text-lg font-bold ${theme.text}`}>Adicionar Pagamento</h3>
              <button onClick={() => setShowAddPagamentoModal(false)} className={`${theme.textSecondary} hover:scale-110 active:scale-90 transition-transform`}><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-4 text-sm">
              <div><label className={`block mb-1 text-xs ${theme.textSecondary}`}>Descrição</label><input type="text" placeholder="Ex: Entrada 50%, Sinal..." value={pagamentoDescricao} onChange={(e) => setPagamentoDescricao(e.target.value)} className={inputCls} /></div>
              <div>
                <label className={`block mb-1 text-xs ${theme.textSecondary}`}>Forma de pagamento</label>
                <select value={pagamentoFormaPagamento} onChange={(e) => setPagamentoFormaPagamento(e.target.value)} className={inputCls}>
                  <option value="">Selecione</option>
                  {FORMAS_PAGAMENTO.map((fp) => <option key={fp}>{fp}</option>)}
                </select>
              </div>
              <div><label className={`block mb-1 text-xs ${theme.textSecondary}`}>Valor (R$)</label><input type="number" step="0.01" min={0} value={pagamentoValor} onChange={(e) => setPagamentoValor(parseFloat(e.target.value) || 0)} className={inputCls} /></div>
              {selectedStay && (
                <div className={`rounded-lg p-3 ${isDark ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'} border space-y-1`}>
                  <div className="flex justify-between text-xs"><span className={theme.textSecondary}>Pago até agora</span><span className="text-emerald-400 font-semibold">{fmt(selectedStay.totalPago)}</span></div>
                  <div className="flex justify-between text-xs"><span className={theme.textSecondary}>Este pagamento</span><span className="text-violet-400 font-semibold">{fmt(pagamentoValor)}</span></div>
                  <div className={`border-t ${theme.divider} pt-1 flex justify-between text-xs`}>
                    <span className={theme.textSecondary}>Pendente após</span>
                    <span className={`font-bold ${Math.max(0, selectedStay.pagamentoPendente - pagamentoValor) > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>{fmt(Math.max(0, selectedStay.pagamentoPendente - pagamentoValor))}</span>
                  </div>
                </div>
              )}
            </div>
            <div className={`p-4 border-t ${theme.divider} flex gap-2`}>
              <button onClick={() => setShowAddPagamentoModal(false)} className={`flex-1 px-4 py-2 ${theme.button} ${theme.text} rounded-lg border text-sm font-medium`}>Cancelar</button>
              <button onClick={handleSaveAddPagamento} className="flex-1 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-medium">Adicionar</button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          MODAL: Nova Hospedagem
      ══════════════════════════════════════════════════ */}
      {showNewStayModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-start justify-center z-[60] p-4 overflow-y-auto">
          <div className={`${theme.modal} rounded-xl border shadow-2xl max-w-3xl w-full my-8`}>
            <div className={`p-4 border-b ${theme.divider} flex items-center justify-between`}>
              <h3 className={`text-lg font-bold ${theme.text}`}>Nova Hospedagem</h3>
              <button onClick={() => setShowNewStayModal(false)} className={`${theme.textSecondary} hover:scale-110 active:scale-90 transition-transform`}><X className="w-5 h-5" /></button>
            </div>

            <div className="p-4 space-y-5 text-sm max-h-[80vh] overflow-y-auto">
              {/* ── Dados básicos ── */}
              <div className={`${theme.sectionBg} rounded-xl border p-4 space-y-3`}>
                <p className={`text-xs font-bold ${theme.text} uppercase tracking-wide flex items-center gap-2`}><User className="w-3.5 h-3.5 text-violet-400" /> Dados do Titular</p>
                <input type="text" placeholder="Nome do titular *" value={newStayNome} onChange={(e) => setNewStayNome(e.target.value)} className={inputCls} />
              </div>

              {/* ── Quarto ── */}
              <div className={`${theme.sectionBg} rounded-xl border p-4 space-y-3`}>
                <p className={`text-xs font-bold ${theme.text} uppercase tracking-wide flex items-center gap-2`}><BedDouble className="w-3.5 h-3.5 text-sky-400" /> Quarto</p>
                <select value={newStayQuartoCategoria} onChange={(e) => { setNewStayQuartoCategoria(e.target.value); setNewStayQuarto(''); }} className={inputCls}>
                  <option value="">Selecione uma categoria</option>
                  {categoriasQuartos.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
                {newStayQuartosCat && (
                  <div>
                    <label className={`block mb-2 text-xs ${theme.textSecondary}`}>Quarto *</label>
                    <div className="flex flex-wrap gap-2">
                      {newStayQuartosCat.quartos.map((q) => (
                        <button key={q} type="button" onClick={() => setNewStayQuarto(q)}
                          className={`px-3 py-2 rounded-lg border font-bold text-sm transition-all ${newStayQuarto === q ? 'bg-violet-600 text-white border-violet-400' : `${theme.button} ${theme.text}`}`}>
                          {formatRoomNumber(q)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* ── Datas ── */}
              <div className={`${theme.sectionBg} rounded-xl border p-4 space-y-3`}>
                <p className={`text-xs font-bold ${theme.text} uppercase tracking-wide flex items-center gap-2`}><Calendar className="w-3.5 h-3.5 text-amber-400" /> Período</p>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className={`block mb-1 text-xs ${theme.textSecondary}`}>Check-in *</label><input type="date" value={newStayCheckinData} onChange={(e) => setNewStayCheckinData(e.target.value)} className={inputCls} /></div>
                  <div><label className={`block mb-1 text-xs ${theme.textSecondary}`}>Hora check-in</label><input type="time" value={newStayCheckinHora} onChange={(e) => setNewStayCheckinHora(e.target.value)} className={inputCls} /></div>
                  <div><label className={`block mb-1 text-xs ${theme.textSecondary}`}>Check-out *</label><input type="date" value={newStayCheckoutData} onChange={(e) => setNewStayCheckoutData(e.target.value)} className={inputCls} /></div>
                  <div><label className={`block mb-1 text-xs ${theme.textSecondary}`}>Hora check-out</label><input type="time" value={newStayCheckoutHora} onChange={(e) => setNewStayCheckoutHora(e.target.value)} className={inputCls} /></div>
                </div>
                {newStayTotalDias > 0 && (
                  <div className={`rounded-lg p-2.5 ${isDark ? 'bg-violet-500/10 border-violet-500/20' : 'bg-violet-50 border-violet-200'} border text-center`}>
                    <span className={`${theme.text} text-sm font-semibold`}>{newStayTotalDias} diária{newStayTotalDias > 1 ? 's' : ''}</span>
                  </div>
                )}
              </div>

              {/* ── Pessoas ── */}
              {newStayCatQuarto && (
                <div className={`${theme.sectionBg} rounded-xl border p-4 space-y-3`}>
                  <p className={`text-xs font-bold ${theme.text} uppercase tracking-wide flex items-center gap-2`}><Users className="w-3.5 h-3.5 text-emerald-400" /> Hóspedes</p>
                  {newStayCatQuarto.modeloCobranca === 'Por quarto (tarifa fixa)' ? (
                    <p className={`${theme.textSecondary} text-xs`}>Tarifa fixa — {fmt(newStayCatQuarto.precoFixo)}/noite (independe da quantidade de pessoas)</p>
                  ) : (
                    <>
                      <div className="flex items-center gap-3">
                        <label className={`text-xs ${theme.textSecondary}`}>Número de pessoas:</label>
                        <div className="flex items-center gap-2">
                          <button type="button" onClick={() => setNewStayPessoas(Math.max(1, newStayPessoas - 1))}
                            className={`w-8 h-8 rounded-full ${theme.button} border ${theme.text} font-bold hover:scale-110 active:scale-90 transition-all`}>−</button>
                          <span className={`${theme.text} font-bold text-lg w-8 text-center`}>{newStayPessoas}</span>
                          <button type="button" onClick={() => setNewStayPessoas(Math.min(Object.keys(newStayCatQuarto.precosOcupacao || {}).length, newStayPessoas + 1))}
                            className={`w-8 h-8 rounded-full ${theme.button} border ${theme.text} font-bold hover:scale-110 active:scale-90 transition-all`}>+</button>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Gráfico de preços */}
                  {newStayPriceHistory.length > 0 && (
                    <div>
                      <p className={`${theme.textSecondary} text-xs mb-2`}>
                        {newStayCatQuarto.modeloCobranca === 'Por quarto (tarifa fixa)'
                          ? 'Valor total da hospedagem'
                          : 'Comparativo de preços por ocupação (total)'}
                      </p>
                      <div className={`${isDark ? 'bg-white/5' : 'bg-slate-100'} rounded-lg p-3`}>
                        <div className="h-16">
                          <MiniBarChart data={newStayPriceHistory} color="#8b5cf6" height={56} />
                        </div>
                        <div className="flex justify-between mt-1">
                          {newStayPriceHistory.map((d, i) => (
                            <span key={i} className={`text-[9px] ${d.highlight ? 'text-violet-300 font-bold' : theme.textSecondary}`}>{d.label}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── Resumo financeiro live ── */}
              {newStayQuarto && newStayTotalDias > 0 && (
                <div className={`${theme.sectionBg} rounded-xl border p-4 space-y-2`}>
                  <p className={`text-xs font-bold ${theme.text} uppercase tracking-wide flex items-center gap-2`}><TrendingUp className="w-3.5 h-3.5 text-amber-400" /> Resumo Financeiro</p>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label:'Diária', value: fmt(newStayPrecoDiaria), color:'text-violet-400' },
                      { label:'Total', value: fmt(newStayTotalHospedagem), color: theme.text },
                      { label:'Pago', value: fmt(newStayTotalPago), color:'text-emerald-400' },
                    ].map(({ label, value, color }) => (
                      <div key={label} className={`${isDark ? 'bg-white/5' : 'bg-slate-100'} rounded-lg p-2.5 text-center`}>
                        <p className={`${theme.textSecondary} text-[10px] uppercase`}>{label}</p>
                        <p className={`${color} font-bold text-base`}>{value}</p>
                      </div>
                    ))}
                  </div>
                  {/* Barra de progresso dos pagamentos */}
                  <div>
                    <div className={`w-full ${isDark ? 'bg-slate-700' : 'bg-slate-200'} rounded-full h-2 mt-2`}>
                      <div className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all"
                        style={{ width: `${newStayTotalHospedagem > 0 ? Math.min(100, (newStayTotalPago / newStayTotalHospedagem) * 100) : 0}%` }} />
                    </div>
                    <div className="flex justify-between text-[10px] mt-1">
                      <span className={theme.textSecondary}>Pago: {newStayTotalHospedagem > 0 ? ((newStayTotalPago / newStayTotalHospedagem) * 100).toFixed(0) : 0}%</span>
                      <span className="text-amber-400">Pendente: {fmt(newStayPendente)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Pagamentos ── */}
              <div className={`${theme.sectionBg} rounded-xl border p-4 space-y-3`}>
                <p className={`text-xs font-bold ${theme.text} uppercase tracking-wide flex items-center gap-2`}><CreditCard className="w-3.5 h-3.5 text-emerald-400" /> Pagamentos</p>
                <div className="grid grid-cols-1 gap-2">
                  <input type="text" placeholder="Descrição (ex: Entrada 50%)" value={newStayPagDesc} onChange={(e) => setNewStayPagDesc(e.target.value)} className={inputCls} />
                  <div className="grid grid-cols-2 gap-2">
                    <select value={newStayPagForma} onChange={(e) => setNewStayPagForma(e.target.value)} className={inputCls}>
                      <option value="">Forma de pagamento</option>
                      {FORMAS_PAGAMENTO.map((fp) => <option key={fp}>{fp}</option>)}
                    </select>
                    <input type="number" step="0.01" min={0} placeholder="Valor (R$)" value={newStayPagValor || ''} onChange={(e) => setNewStayPagValor(parseFloat(e.target.value) || 0)} className={inputCls} />
                  </div>
                  <button type="button" onClick={handleAddNewStayPagamento}
                    className="w-full px-3 py-2 bg-emerald-600/80 hover:bg-emerald-600 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-all hover:scale-105 active:scale-95">
                    <Plus className="w-4 h-4" /> Adicionar Pagamento
                  </button>
                </div>
                {newStayPagamentos.length > 0 && (
                  <div className="space-y-1.5 mt-2">
                    {newStayPagamentos.map((p) => (
                      <div key={p.id} className={`flex items-center justify-between px-3 py-2 rounded-lg ${isDark ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200'} border`}>
                        <span className={`${theme.text} text-xs`}>{p.descricao} • {p.formaPagamento}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-emerald-400 font-bold text-xs">{fmt(p.valor)}</span>
                          <button type="button" onClick={() => setNewStayPagamentos((prev) => prev.filter((x) => x.id !== p.id))} className="text-rose-400 hover:text-rose-300"><X className="w-3.5 h-3.5" /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className={`p-4 border-t ${theme.divider} flex gap-2`}>
              <button onClick={() => setShowNewStayModal(false)} className={`flex-1 px-4 py-2 ${theme.button} ${theme.text} rounded-lg border text-sm font-medium hover:scale-105 active:scale-95 transition-all`}>Cancelar</button>
              <button onClick={handleSaveNewStay} className="flex-1 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-medium hover:scale-105 active:scale-95 transition-all">Criar Hospedagem</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmar cancelamento */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[70] p-4">
          <div className={`${theme.modal} rounded-xl border shadow-2xl max-w-md w-full`}>
            <div className="p-4"><h3 className={`text-lg font-bold ${theme.text} mb-2`}>Cancelar Reserva?</h3><p className={`${theme.textSecondary} text-sm`}>Esta ação não pode ser desfeita.</p></div>
            <div className={`p-4 border-t ${theme.divider} flex gap-2`}>
              <button onClick={() => setShowCancelModal(false)} className={`flex-1 px-4 py-2 ${theme.button} ${theme.text} rounded-lg border text-sm font-medium`}>Voltar</button>
              <button onClick={handleCancelStay} className="flex-1 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-medium">Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmar finalização */}
      {showFinishModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[70] p-4">
          <div className={`${theme.modal} rounded-xl border shadow-2xl max-w-md w-full`}>
            <div className="p-4"><h3 className={`text-lg font-bold ${theme.text} mb-2`}>Finalizar Reserva?</h3><p className={`${theme.textSecondary} text-sm`}>O quarto será liberado e o checkout registrado.</p></div>
            <div className={`p-4 border-t ${theme.divider} flex gap-2`}>
              <button onClick={() => setShowFinishModal(false)} className={`flex-1 px-4 py-2 ${theme.button} ${theme.text} rounded-lg border text-sm font-medium`}>Voltar</button>
              <button onClick={handleFinishStay} className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium">Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Permissões ── */}
      {showPermissionsModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`${theme.modal} rounded-xl border shadow-2xl max-w-md w-full`}>
            <div className={`p-4 border-b ${theme.divider} flex items-center justify-between`}>
              <div className="flex items-center gap-2"><Shield className="w-5 h-5 text-violet-500" /><h3 className={`text-lg font-bold ${theme.text}`}>Permissões</h3></div>
              <button onClick={() => setShowPermissionsModal(false)} className={`${theme.textSecondary} hover:scale-110 active:scale-90 transition-transform`}><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-2 text-sm max-h-[60vh] overflow-y-auto">
              {Object.keys(permissions).map((key) => {
                const active = permissions[key];
                return (
                  <button key={key} type="button" onClick={() => togglePermission(key)}
                    className={`w-full flex items-center justify-between gap-3 p-2.5 rounded-lg border transition-all text-left ${active ? `border-violet-500/40 ${isDark ? 'bg-violet-500/10' : 'bg-violet-50'}` : `border-white/8 ${theme.cardHover}`}`}>
                    <span className={`${theme.text} text-xs`}>{key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase())}</span>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${active ? 'border-violet-400 bg-violet-500' : `${isDark ? 'border-white/20' : 'border-slate-300'}`}`}>
                      {active && <Check className="w-3 h-3 text-white" />}
                    </div>
                  </button>
                );
              })}
            </div>
            <div className={`p-4 border-t ${theme.divider}`}>
              <button onClick={() => setShowPermissionsModal(false)} className="w-full px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-medium">Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* Notificação */}
      {notification && (
        <div className="fixed top-4 right-4 z-[110] animate-slideIn">
          <div className={`${notification.type === 'success' ? 'bg-emerald-500' : notification.type === 'error' ? 'bg-rose-500' : notification.type === 'warning' ? 'bg-amber-500' : 'bg-slate-700'} text-white px-5 py-3 rounded-xl shadow-xl flex items-center gap-3`}>
            <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
            <span className="font-medium text-sm">{notification.message}</span>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideIn { from { opacity:0; transform:translateX(100%) } to { opacity:1; transform:translateX(0) } }
        .animate-slideIn { animation: slideIn 0.25s ease-out; }
      `}</style>
    </div>
  );
}
