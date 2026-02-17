import React, { useState } from 'react';
import {
  BedDouble,
  Calendar,
  DollarSign,
  Sun,
  Moon,
  Plus,
  Edit,
  Shield,
  ChevronDown,
  Users,
  Clock,
  X,
  Check,
  Trash2,
  AlertCircle,
  ArrowRight,
  User,
  ShoppingCart,
  CreditCard,
  RefreshCw,
  XCircle,
  CheckCircle,
  Search,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

function formatRoomNumber(num) {
  return num < 10 ? `0${num}` : `${num}`;
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
  const [showEditDadosModal, setShowEditDadosModal] = useState(false);
  const [showAddGuestModal, setShowAddGuestModal] = useState(false);
  const [showAddConsumoModal, setShowAddConsumoModal] = useState(false);
  const [showAddPagamentoModal, setShowAddPagamentoModal] = useState(false);
  const [showChangeRoomModal, setShowChangeRoomModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showFinishModal, setShowFinishModal] = useState(false);

  // Form states - Adicionar Diária
  const [novaDiariaDataInicio, setNovaDiariaDataInicio] = useState('');
  const [novaDiariaHoraInicio, setNovaDiariaHoraInicio] = useState('');
  const [novaDiariaDataFim, setNovaDiariaDataFim] = useState('');
  const [novaDiariaHoraFim, setNovaDiariaHoraFim] = useState('');
  const [novaDiariaQuarto, setNovaDiariaQuarto] = useState('');
  const [novaDiariaPessoas, setNovaDiariaPessoas] = useState([]);

  // Form states - Editar Dados
  const [editChegadaData, setEditChegadaData] = useState('');
  const [editChegadaHora, setEditChegadaHora] = useState('');
  const [editSaidaData, setEditSaidaData] = useState('');
  const [editSaidaHora, setEditSaidaHora] = useState('');

  // Form states - Trocar Quarto
  const [selectedCategoriaQuarto, setSelectedCategoriaQuarto] = useState('');
  const [selectedNovoQuarto, setSelectedNovoQuarto] = useState('');

  // Form states - Adicionar Hóspede
  const [searchGuestTerm, setSearchGuestTerm] = useState('');
  const [selectedGuest, setSelectedGuest] = useState(null);

  // Form states - Adicionar Consumo
  const [consumoCategoria, setConsumoCategoria] = useState('');
  const [consumoProduto, setConsumoProduto] = useState('');
  const [consumoQuantidade, setConsumoQuantidade] = useState(1);
  const [consumoFormaPagamento, setConsumoFormaPagamento] = useState('');

  // Form states - Adicionar Pagamento
  const [pagamentoDescricao, setPagamentoDescricao] = useState('');
  const [pagamentoFormaPagamento, setPagamentoFormaPagamento] = useState('');
  const [pagamentoValor, setPagamentoValor] = useState(0);

  const [permissions, setPermissions] = useState({
    acessoTotal: true,
    dashboard: true,
    verPernoites: true,
    editarPernoite: true,
    adicionarDiaria: true,
    trocarQuarto: true,
    gerenciarHospedes: true,
    gerenciarConsumo: true,
    gerenciarPagamentos: true,
    cancelarReserva: true,
    finalizarReserva: true,
  });

  const STATUS = {
    ATIVO: 'ATIVO',
    DIARIA_ENCERRADA: 'DIÁRIA ENCERRADA',
    FINALIZADO: 'FINALIZADO',
    CANCELADO: 'CANCELADO',
    FINALIZADO_PENDENTE: 'FINALIZADO - PAGAMENTO PENDENTE',
  };

  // Mock de categorias de quartos
  const categoriasQuartos = [
    { id: 1, nome: 'Standard', quartos: [1, 2, 3, 4, 5] },
    { id: 2, nome: 'Luxo', quartos: [6, 7, 8] },
    { id: 3, nome: 'Suíte', quartos: [9, 10] },
  ];

  // Mock de hóspedes cadastrados
  const hospedesCadastrados = [
    { id: 1, nome: 'João Silva', cpf: '123.456.789-00', telefone: '(98) 99999-9999' },
    { id: 2, nome: 'Maria Silva', cpf: '987.654.321-00', telefone: '(98) 98888-8888' },
    { id: 3, nome: 'Ana Costa', cpf: '111.222.333-44', telefone: '(98) 97777-7777' },
    { id: 4, nome: 'Carlos Mendes', cpf: '555.666.777-88', telefone: '(98) 96666-6666' },
    { id: 5, nome: 'Fernanda Souza', cpf: '999.888.777-66', telefone: '(98) 95555-5555' },
    { id: 6, nome: 'Roberto Lima', cpf: '444.333.222-11', telefone: '(98) 94444-4444' },
  ];

  // Mock de categorias e produtos
  const categoriasConsumo = [
    {
      id: 1,
      nome: 'Bebidas',
      produtos: [
        { id: 1, nome: 'Cerveja Heineken', preco: 12.0 },
        { id: 2, nome: 'Refrigerante Lata', preco: 6.0 },
        { id: 3, nome: 'Água Mineral', preco: 4.0 },
      ],
    },
    {
      id: 2,
      nome: 'Alimentação',
      produtos: [
        { id: 4, nome: 'Porção de batata frita', preco: 25.0 },
        { id: 5, nome: 'Hambúrguer', preco: 35.0 },
        { id: 6, nome: 'Pizza média', preco: 45.0 },
      ],
    },
    {
      id: 3,
      nome: 'Serviços',
      produtos: [
        { id: 7, nome: 'Lavanderia', preco: 20.0 },
        { id: 8, nome: 'Frigobar', preco: 15.0 },
      ],
    },
  ];

  const formasPagamento = [
    'Dinheiro',
    'PIX',
    'Cartão de Crédito',
    'Cartão de Débito',
    'Transferência Bancária',
  ];

  const [stays, setStays] = useState([
    {
      id: 1,
      quarto: 3,
      categoria: 'Standard',
      titularNome: 'João Silva',
      periodo: '15/02/2026 - 17/02/2026',
      status: STATUS.ATIVO,
      totalDiarias: 10,
      chegadaPrevista: '15/02/2026 14:00',
      saidaPrevista: '25/02/2026 12:00',
      valorTotal: 1600.0,
      totalPago: 800.0,
      pagamentoPendente: 800.0,
      diariaAtual: 2,
      diarias: Array.from({ length: 10 }, (_, i) => ({
        numero: i + 1,
        dataInicio: `${15 + i}/02/2026 ${i === 0 ? '14:00' : '12:00'}`,
        dataFim: `${16 + i}/02/2026 12:00`,
        quarto: 3,
        valorDiaria: 160.0,
        hospedes:
          i === 0
            ? [
                { id: 1, nome: 'João Silva', cpf: '123.456.789-00', telefone: '(98) 99999-9999' },
                { id: 2, nome: 'Maria Silva', cpf: '987.654.321-00', telefone: '(98) 98888-8888' },
              ]
            : [
                { id: 1, nome: 'João Silva', cpf: '123.456.789-00', telefone: '(98) 99999-9999' },
                { id: 2, nome: 'Maria Silva', cpf: '987.654.321-00', telefone: '(98) 98888-8888' },
              ],
        consumos:
          i === 0
            ? [
                {
                  id: 1,
                  categoria: 'Bebidas',
                  item: 'Cerveja Heineken',
                  quantidade: 2,
                  valorUnitario: 12.0,
                  valorTotal: 24.0,
                  formaPagamento: 'Cartão de Crédito',
                },
              ]
            : [],
        pagamentos:
          i === 0
            ? [
                {
                  id: 1,
                  descricao: 'Entrada (50%)',
                  formaPagamento: 'PIX',
                  valor: 800.0,
                  data: '15/02/2026 14:30',
                },
              ]
            : [],
      })),
    },
    {
      id: 2,
      quarto: 6,
      categoria: 'Luxo',
      titularNome: 'Ana Costa',
      periodo: '14/02/2026 - 16/02/2026',
      status: STATUS.DIARIA_ENCERRADA,
      totalDiarias: 2,
      chegadaPrevista: '14/02/2026 15:00',
      saidaPrevista: '16/02/2026 11:00',
      valorTotal: 560.0,
      totalPago: 560.0,
      pagamentoPendente: 0.0,
      diariaAtual: 2,
      diarias: [
        {
          numero: 1,
          dataInicio: '14/02/2026 15:00',
          dataFim: '15/02/2026 12:00',
          quarto: 6,
          valorDiaria: 280.0,
          hospedes: [
            { id: 3, nome: 'Ana Costa', cpf: '111.222.333-44', telefone: '(98) 97777-7777' },
          ],
          consumos: [],
          pagamentos: [
            {
              id: 1,
              descricao: 'Pagamento integral',
              formaPagamento: 'Cartão de Débito',
              valor: 560.0,
              data: '14/02/2026 15:15',
            },
          ],
        },
        {
          numero: 2,
          dataInicio: '15/02/2026 12:00',
          dataFim: '16/02/2026 11:00',
          quarto: 6,
          valorDiaria: 280.0,
          hospedes: [
            { id: 3, nome: 'Ana Costa', cpf: '111.222.333-44', telefone: '(98) 97777-7777' },
          ],
          consumos: [],
          pagamentos: [],
        },
      ],
    },
    {
      id: 3,
      quarto: 9,
      categoria: 'Suíte',
      titularNome: 'Carlos Mendes',
      periodo: '10/02/2026 - 13/02/2026',
      status: STATUS.FINALIZADO,
      totalDiarias: 3,
      chegadaPrevista: '10/02/2026 14:00',
      saidaPrevista: '13/02/2026 12:00',
      valorTotal: 1380.0,
      totalPago: 1380.0,
      pagamentoPendente: 0.0,
      diariaAtual: 3,
      diarias: [],
    },
    {
      id: 4,
      quarto: 2,
      categoria: 'Standard',
      titularNome: 'Fernanda Souza',
      periodo: '12/02/2026 - 14/02/2026',
      status: STATUS.CANCELADO,
      totalDiarias: 2,
      chegadaPrevista: '12/02/2026 15:00',
      saidaPrevista: '14/02/2026 12:00',
      valorTotal: 320.0,
      totalPago: 0.0,
      pagamentoPendente: 0.0,
      diariaAtual: 0,
      diarias: [],
    },
    {
      id: 5,
      quarto: 7,
      categoria: 'Luxo',
      titularNome: 'Roberto Lima',
      periodo: '08/02/2026 - 11/02/2026',
      status: STATUS.FINALIZADO_PENDENTE,
      totalDiarias: 3,
      chegadaPrevista: '08/02/2026 14:00',
      saidaPrevista: '11/02/2026 12:00',
      valorTotal: 840.0,
      totalPago: 500.0,
      pagamentoPendente: 340.0,
      diariaAtual: 3,
      diarias: [],
    },
  ]);

  const theme = {
    bg: isDark
      ? 'bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950'
      : 'bg-gradient-to-br from-slate-50 via-white to-slate-100',
    bgOverlay: isDark
      ? 'bg-[radial-gradient(circle_at_50%_120%,rgba(120,119,198,0.15),rgba(255,255,255,0))]'
      : 'bg-[radial-gradient(circle_at_50%_120%,rgba(120,119,198,0.1),rgba(255,255,255,0))]',
    text: isDark ? 'text-white' : 'text-slate-900',
    textSecondary: isDark ? 'text-slate-400' : 'text-slate-600',
    card: isDark ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200',
    cardHover: isDark ? 'hover:bg-white/10' : 'hover:bg-slate-50',
    input: isDark
      ? 'bg-white/10 border-white/20 text-white placeholder-slate-400'
      : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-500',
    divider: isDark ? 'border-white/10' : 'border-slate-200',
    button: isDark
      ? 'bg-white/10 hover:bg-white/20 border-white/10'
      : 'bg-slate-100 hover:bg-slate-200 border-slate-300',
  };

  const showNotification = (message, type = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const togglePermission = (key) => {
    setPermissions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleCategoryCollapse = (categoryName) => {
    setCollapsedCategories((prev) => ({ ...prev, [categoryName]: !prev[categoryName] }));
  };

  const getStatusColor = (status) => {
    switch (status) {
      case STATUS.ATIVO:
        return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
      case STATUS.DIARIA_ENCERRADA:
        return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
      case STATUS.FINALIZADO:
        return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
      case STATUS.CANCELADO:
        return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
      case STATUS.FINALIZADO_PENDENTE:
        return 'bg-orange-500/15 text-orange-400 border-orange-500/30';
      default:
        return 'bg-slate-500/15 text-slate-400 border-slate-500/30';
    }
  };

  const handleOpenDetails = (stay) => {
    if (!permissions.verPernoites && !permissions.acessoTotal) {
      showNotification('Você não tem permissão para ver detalhes de pernoites.', 'error');
      return;
    }
    setSelectedStay(stay);
    setDetailsTab('dados');
    setSelectedDiariaIndex(stay.diariaAtual - 1 >= 0 ? stay.diariaAtual - 1 : 0);
    setDiariaTab('detalhes');
    setShowDetailsModal(true);
  };

  const handleOpenAddDiaria = () => {
    if (!permissions.adicionarDiaria && !permissions.acessoTotal) {
      showNotification('Você não tem permissão para adicionar diária.', 'error');
      return;
    }
    // Pré-carregar com último quarto e pessoas
    if (selectedStay && selectedStay.diarias.length > 0) {
      const ultimaDiaria = selectedStay.diarias[selectedStay.diarias.length - 1];
      setNovaDiariaQuarto(ultimaDiaria.quarto);
      setNovaDiariaPessoas(ultimaDiaria.hospedes.map((h) => h.id));
    }
    setShowAddDiariaModal(true);
  };

  const handleSaveAddDiaria = () => {
    showNotification('Diária adicionada com sucesso.', 'success');
    setShowAddDiariaModal(false);
  };

  const handleOpenEditDados = () => {
    if (!permissions.editarPernoite && !permissions.acessoTotal) {
      showNotification('Você não tem permissão para editar pernoite.', 'error');
      return;
    }
    if (selectedStay) {
      const [dataC, horaC] = selectedStay.chegadaPrevista.split(' ');
      const [dataS, horaS] = selectedStay.saidaPrevista.split(' ');
      const [diaC, mesC, anoC] = dataC.split('/');
      const [diaS, mesS, anoS] = dataS.split('/');
      setEditChegadaData(`${anoC}-${mesC}-${diaC}`);
      setEditChegadaHora(horaC);
      setEditSaidaData(`${anoS}-${mesS}-${diaS}`);
      setEditSaidaHora(horaS);
    }
    setShowEditDadosModal(true);
  };

  const handleSaveEditDados = () => {
    showNotification('Dados do pernoite atualizados.', 'success');
    setShowEditDadosModal(false);
  };

  const handleOpenChangeRoom = () => {
    if (!permissions.trocarQuarto && !permissions.acessoTotal) {
      showNotification('Você não tem permissão para trocar de quarto.', 'error');
      return;
    }
    setSelectedCategoriaQuarto('');
    setSelectedNovoQuarto('');
    setShowChangeRoomModal(true);
  };

  const handleSaveChangeRoom = () => {
    showNotification('Quarto alterado com sucesso.', 'success');
    setShowChangeRoomModal(false);
  };

  const handleOpenAddGuest = () => {
    if (!permissions.gerenciarHospedes && !permissions.acessoTotal) {
      showNotification('Você não tem permissão para gerenciar hóspedes.', 'error');
      return;
    }
    setSearchGuestTerm('');
    setSelectedGuest(null);
    setShowAddGuestModal(true);
  };

  const handleSaveAddGuest = () => {
    if (!selectedGuest) {
      showNotification('Selecione um hóspede.', 'warning');
      return;
    }
    showNotification('Hóspede adicionado com sucesso.', 'success');
    setShowAddGuestModal(false);
  };

  const handleOpenAddConsumo = () => {
    if (!permissions.gerenciarConsumo && !permissions.acessoTotal) {
      showNotification('Você não tem permissão para gerenciar consumo.', 'error');
      return;
    }
    setConsumoCategoria('');
    setConsumoProduto('');
    setConsumoQuantidade(1);
    setConsumoFormaPagamento('');
    setShowAddConsumoModal(true);
  };

  const handleSaveAddConsumo = () => {
    if (!consumoCategoria || !consumoProduto || !consumoFormaPagamento) {
      showNotification('Preencha todos os campos.', 'warning');
      return;
    }
    showNotification('Consumo adicionado com sucesso.', 'success');
    setShowAddConsumoModal(false);
  };

  const handleOpenAddPagamento = () => {
    if (!permissions.gerenciarPagamentos && !permissions.acessoTotal) {
      showNotification('Você não tem permissão para gerenciar pagamentos.', 'error');
      return;
    }
    setPagamentoDescricao('');
    setPagamentoFormaPagamento('');
    setPagamentoValor(0);
    setShowAddPagamentoModal(true);
  };

  const handleSaveAddPagamento = () => {
    if (!pagamentoDescricao || !pagamentoFormaPagamento || pagamentoValor <= 0) {
      showNotification('Preencha todos os campos corretamente.', 'warning');
      return;
    }
    showNotification('Pagamento adicionado com sucesso.', 'success');
    setShowAddPagamentoModal(false);
  };

  const handleCancelStay = () => {
    if (!permissions.cancelarReserva && !permissions.acessoTotal) {
      showNotification('Você não tem permissão para cancelar reserva.', 'error');
      return;
    }
    showNotification('Reserva cancelada com sucesso.', 'success');
    setShowCancelModal(false);
    setShowDetailsModal(false);
  };

  const handleFinishStay = () => {
    if (!permissions.finalizarReserva && !permissions.acessoTotal) {
      showNotification('Você não tem permissão para finalizar reserva.', 'error');
      return;
    }
    showNotification('Reserva finalizada com sucesso.', 'success');
    setShowFinishModal(false);
    setShowDetailsModal(false);
  };

  const stats = {
    total: stays.length,
    ativos: stays.filter((s) => s.status === STATUS.ATIVO).length,
    diariaEncerrada: stays.filter((s) => s.status === STATUS.DIARIA_ENCERRADA).length,
    finalizados: stays.filter((s) => s.status === STATUS.FINALIZADO).length,
    cancelados: stays.filter((s) => s.status === STATUS.CANCELADO).length,
    finalizadosPendentes: stays.filter((s) => s.status === STATUS.FINALIZADO_PENDENTE).length,
  };

  const filteredStays = stays.filter((stay) => {
    if (selectedStatusFilter === 'all') return true;
    return stay.status === selectedStatusFilter;
  });

  const staysByCategory = categoriasQuartos.map((cat) => ({
    ...cat,
    stays: filteredStays.filter((s) => s.categoria === cat.nome),
  }));

  const currentDiaria = selectedStay?.diarias?.[selectedDiariaIndex];
  const progressPercent = selectedStay
    ? (selectedStay.totalPago / selectedStay.valorTotal) * 100
    : 0;

  const filteredGuests = hospedesCadastrados.filter((h) =>
    h.nome.toLowerCase().includes(searchGuestTerm.toLowerCase())
  );

  const categoriaConsumoSelecionada = categoriasConsumo.find((c) => c.id === parseInt(consumoCategoria));
  const produtoSelecionado = categoriaConsumoSelecionada?.produtos.find(
    (p) => p.id === parseInt(consumoProduto)
  );

  // Scroll de diárias
  const scrollDiarias = (direction) => {
    if (!selectedStay) return;
    const maxIndex = selectedStay.diarias.length - 1;
    if (direction === 'left' && selectedDiariaIndex > 0) {
      setSelectedDiariaIndex(selectedDiariaIndex - 1);
    } else if (direction === 'right' && selectedDiariaIndex < maxIndex) {
      setSelectedDiariaIndex(selectedDiariaIndex + 1);
    }
  };

  return (
    <div className={`min-h-screen ${theme.bg}`}>
      <div className={`absolute inset-0 ${theme.bgOverlay}`} />

      <div className="relative max-w-[1600px] mx-auto p-4 sm:p-8">
        {/* Header */}
        <header className="mb-6 pt-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className={`text-3xl font-bold ${theme.text} mb-1 tracking-tight`}>
                Pernoites
              </h1>
              <p className={`${theme.textSecondary} text-sm flex items-center gap-2`}>
                <BedDouble className="w-3.5 h-3.5" />
                Gestão de hospedagens e diárias
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowPermissionsModal(true)}
                className={`px-4 py-2 ${theme.button} ${theme.text} rounded-lg backdrop-blur-sm border transition-all duration-200 flex items-center gap-2 text-sm font-medium hover:scale-105 active:scale-95`}
              >
                <Shield className="w-4 h-4" />
                Permissões
              </button>
              <button
                onClick={() => setIsDark(!isDark)}
                className={`px-4 py-2 ${theme.button} ${theme.text} rounded-lg backdrop-blur-sm border transition-all duration-200 flex items-center gap-2 text-sm font-medium hover:scale-105 active:scale-95`}
              >
                {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                {isDark ? 'Light' : 'Dark'}
              </button>
            </div>
          </div>
        </header>

        {/* Dashboard */}
        {permissions.dashboard && (
          <div className={`${theme.card} backdrop-blur-xl rounded-xl p-4 mb-6 border shadow-xl`}>
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="w-4 h-4 text-violet-500" />
              <h2 className={`text-sm font-bold ${theme.text} uppercase tracking-wider`}>
                Status dos Pernoites
              </h2>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <button
                onClick={() => setSelectedStatusFilter('all')}
                className={`rounded-lg p-4 text-left transition-all ${
                  selectedStatusFilter === 'all' ? 'ring-2 ring-white/60' : ''
                } bg-gradient-to-br from-slate-500 to-slate-700`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <BedDouble className="w-5 h-5 text-white" />
                  <span className="text-white font-bold text-sm">TODOS</span>
                </div>
                <p className="text-3xl font-bold text-white">{stats.total}</p>
                <p className="text-white/80 text-xs mt-1">Todos os pernoites</p>
              </button>

              <button
                onClick={() => setSelectedStatusFilter(STATUS.ATIVO)}
                className={`rounded-lg p-4 text-left transition-all ${
                  selectedStatusFilter === STATUS.ATIVO ? 'ring-2 ring-white/60' : ''
                } bg-gradient-to-br from-emerald-500 to-teal-600`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <CheckCircle className="w-5 h-5 text-white" />
                  <span className="text-white font-bold text-sm">ATIVOS</span>
                </div>
                <p className="text-3xl font-bold text-white">{stats.ativos}</p>
                <p className="text-white/80 text-xs mt-1">Hospedagens em andamento</p>
              </button>

              <button
                onClick={() => setSelectedStatusFilter(STATUS.DIARIA_ENCERRADA)}
                className={`rounded-lg p-4 text-left transition-all ${
                  selectedStatusFilter === STATUS.DIARIA_ENCERRADA ? 'ring-2 ring-white/60' : ''
                } bg-gradient-to-br from-amber-500 to-yellow-500`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <Clock className="w-5 h-5 text-white" />
                  <span className="text-white font-bold text-sm">DIÁRIA ENCERRADA</span>
                </div>
                <p className="text-3xl font-bold text-white">{stats.diariaEncerrada}</p>
                <p className="text-white/80 text-xs mt-1">Aguardando checkout</p>
              </button>

              <button
                onClick={() => setSelectedStatusFilter(STATUS.FINALIZADO)}
                className={`rounded-lg p-4 text-left transition-all ${
                  selectedStatusFilter === STATUS.FINALIZADO ? 'ring-2 ring-white/60' : ''
                } bg-gradient-to-br from-blue-500 to-indigo-600`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <Check className="w-5 h-5 text-white" />
                  <span className="text-white font-bold text-sm">FINALIZADOS</span>
                </div>
                <p className="text-3xl font-bold text-white">{stats.finalizados}</p>
                <p className="text-white/80 text-xs mt-1">Checkout concluído</p>
              </button>

              <button
                onClick={() => setSelectedStatusFilter(STATUS.CANCELADO)}
                className={`rounded-lg p-4 text-left transition-all ${
                  selectedStatusFilter === STATUS.CANCELADO ? 'ring-2 ring-white/60' : ''
                } bg-gradient-to-br from-rose-500 to-red-600`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <XCircle className="w-5 h-5 text-white" />
                  <span className="text-white font-bold text-sm">CANCELADOS</span>
                </div>
                <p className="text-3xl font-bold text-white">{stats.cancelados}</p>
                <p className="text-white/80 text-xs mt-1">Reservas canceladas</p>
              </button>

              <button
                onClick={() => setSelectedStatusFilter(STATUS.FINALIZADO_PENDENTE)}
                className={`rounded-lg p-4 text-left transition-all ${
                  selectedStatusFilter === STATUS.FINALIZADO_PENDENTE ? 'ring-2 ring-white/60' : ''
                } bg-gradient-to-br from-orange-500 to-amber-600`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <AlertCircle className="w-5 h-5 text-white" />
                  <span className="text-white font-bold text-sm">PENDENTE</span>
                </div>
                <p className="text-3xl font-bold text-white">{stats.finalizadosPendentes}</p>
                <p className="text-white/80 text-xs mt-1">Pagamento pendente</p>
              </button>
            </div>
          </div>
        )}

        {/* Listagem de pernoites por categoria */}
        <div className={`${theme.card} rounded-xl border shadow-xl overflow-hidden`}>
          <div className="px-4 py-3 border-b flex items-center justify-between gap-3">
            <div>
              <h2 className={`text-lg font-bold ${theme.text}`}>Hospedagens por Categoria</h2>
              <p className={`${theme.textSecondary} text-xs`}>
                Clique em uma hospedagem para ver detalhes completos.
              </p>
            </div>
          </div>

          <div className="divide-y divide-slate-700/40">
            {staysByCategory.map((cat) => {
              if (cat.stays.length === 0) return null;
              const isCollapsed = collapsedCategories[cat.nome];
              return (
                <div key={cat.id}>
                  <div
                    onClick={() => toggleCategoryCollapse(cat.nome)}
                    className={`px-4 py-3 flex items-center justify-between cursor-pointer ${theme.cardHover} transition-all`}
                  >
                    <div className="flex items-center gap-3">
                      <ChevronDown
                        className={`w-4 h-4 text-violet-400 transition-transform duration-200 ${
                          isCollapsed ? '-rotate-90' : ''
                        }`}
                      />
                      <BedDouble className="w-5 h-5 text-violet-400" />
                      <div>
                        <span className={`${theme.text} font-semibold text-sm`}>{cat.nome}</span>
                        <span className={`${theme.textSecondary} text-xs ml-2`}>
                          ({cat.stays.length} hospedagem{cat.stays.length > 1 ? 'ns' : ''})
                        </span>
                      </div>
                    </div>
                  </div>

                  {!isCollapsed &&
                    cat.stays.map((stay) => (
                      <div
                        key={stay.id}
                        onClick={() => handleOpenDetails(stay)}
                        className={`px-4 py-3 ml-8 flex items-center justify-between cursor-pointer ${theme.cardHover} transition-all border-l-2 border-violet-500/30`}
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-16 h-16 rounded-xl bg-violet-500/20 flex items-center justify-center">
                            <span className="text-2xl font-extrabold text-violet-400">
                              {formatRoomNumber(stay.quarto)}
                            </span>
                          </div>
                          <div>
                            <span className={`${theme.text} font-semibold text-sm block`}>
                              {stay.titularNome}
                            </span>
                            <div className="flex items-center gap-3 mt-1">
                              <span
                                className={`${theme.textSecondary} text-xs flex items-center gap-1`}
                              >
                                <Calendar className="w-3 h-3" />
                                {stay.periodo}
                              </span>
                              <span className={`${theme.textSecondary} text-xs`}>
                                {stay.totalDiarias} diária{stay.totalDiarias > 1 ? 's' : ''}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="hidden sm:flex flex-col items-end gap-1">
                          <span
                            className={`text-[11px] px-2 py-0.5 rounded-full border ${getStatusColor(
                              stay.status
                            )}`}
                          >
                            {stay.status}
                          </span>
                          <span className={`${theme.text} font-bold text-sm`}>
                            R$ {stay.valorTotal.toFixed(2)}
                          </span>
                          {stay.pagamentoPendente > 0 && (
                            <span className="text-xs text-amber-400">
                              Pendente: R$ {stay.pagamentoPendente.toFixed(2)}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Modal Detalhes do Pernoite */}
      {showDetailsModal && selectedStay && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className={`${theme.card} rounded-xl border shadow-2xl max-w-6xl w-full my-8`}>
            <div className={`p-4 border-b ${theme.divider} flex items-center justify-between`}>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-violet-500/20 flex items-center justify-center">
                  <span className="text-2xl font-extrabold text-violet-400">
                    {formatRoomNumber(selectedStay.quarto)}
                  </span>
                </div>
                <div>
                  <h3 className={`text-lg font-bold ${theme.text}`}>
                    {selectedStay.titularNome}
                  </h3>
                  <p className={`${theme.textSecondary} text-xs`}>{selectedStay.periodo}</p>
                </div>
              </div>
              <button
                onClick={() => setShowDetailsModal(false)}
                className={`${theme.textSecondary} hover:${theme.text} transition-transform duration-200 hover:scale-110 active:scale-90`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tabs principais */}
            <div className={`px-4 py-2 border-b ${theme.divider} flex gap-2`}>
              <button
                onClick={() => setDetailsTab('dados')}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                  detailsTab === 'dados'
                    ? 'bg-violet-600 text-white'
                    : `${theme.button} ${theme.text}`
                }`}
              >
                Dados do Pernoite
              </button>
              <button
                onClick={() => setDetailsTab('diarias')}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                  detailsTab === 'diarias'
                    ? 'bg-violet-600 text-white'
                    : `${theme.button} ${theme.text}`
                }`}
              >
                Informações da Diária
              </button>
            </div>

            <div className="p-4 max-h-[70vh] overflow-y-auto">
              {detailsTab === 'dados' && (
                <div className="space-y-4">
                  {/* Informações gerais */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className={`${theme.card} rounded-lg border p-3`}>
                      <div className="flex items-center gap-2 mb-2">
                        <Calendar className="w-4 h-4 text-violet-400" />
                        <span className={`${theme.text} text-xs font-semibold uppercase`}>
                          Período
                        </span>
                      </div>
                      <p className={`${theme.text} text-sm`}>{selectedStay.periodo}</p>
                      <p className={`${theme.textSecondary} text-xs mt-1`}>
                        {selectedStay.totalDiarias} diária{selectedStay.totalDiarias > 1 ? 's' : ''}
                      </p>
                    </div>

                    <div className={`${theme.card} rounded-lg border p-3`}>
                      <div className="flex items-center gap-2 mb-2">
                        <Clock className="w-4 h-4 text-emerald-400" />
                        <span className={`${theme.text} text-xs font-semibold uppercase`}>
                          Chegada / Saída Prevista
                        </span>
                      </div>
                      <p className={`${theme.text} text-sm`}>
                        Check-in: {selectedStay.chegadaPrevista}
                      </p>
                      <p className={`${theme.text} text-sm mt-1`}>
                        Check-out: {selectedStay.saidaPrevista}
                      </p>
                    </div>
                  </div>

                  {/* Dashboard financeiro */}
                  <div className={`${theme.card} rounded-lg border p-4`}>
                    <div className="flex items-center gap-2 mb-3">
                      <DollarSign className="w-4 h-4 text-amber-400" />
                      <span className={`${theme.text} text-sm font-semibold uppercase`}>
                        Resumo Financeiro
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      <div>
                        <span className={`${theme.textSecondary} text-xs uppercase block mb-1`}>
                          Valor Total
                        </span>
                        <span className={`${theme.text} text-xl font-bold`}>
                          R$ {selectedStay.valorTotal.toFixed(2)}
                        </span>
                      </div>
                      <div>
                        <span className={`${theme.textSecondary} text-xs uppercase block mb-1`}>
                          Total Pago
                        </span>
                        <span className="text-xl font-bold text-emerald-400">
                          R$ {selectedStay.totalPago.toFixed(2)}
                        </span>
                      </div>
                      <div>
                        <span className={`${theme.textSecondary} text-xs uppercase block mb-1`}>
                          Pagamento Pendente
                        </span>
                        <span
                          className={`text-xl font-bold ${
                            selectedStay.pagamentoPendente > 0 ? 'text-amber-400' : 'text-emerald-400'
                          }`}
                        >
                          R$ {selectedStay.pagamentoPendente.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className={`${theme.textSecondary} text-xs`}>
                          Progresso de pagamento
                        </span>
                        <span className={`${theme.text} text-xs font-semibold`}>
                          {progressPercent.toFixed(0)}%
                        </span>
                      </div>
                      <div className="w-full bg-slate-700 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-emerald-500 to-teal-500 h-full transition-all duration-300"
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Botões de ação */}
                  <div className="flex flex-wrap gap-2">
                    {permissions.adicionarDiaria && (
                      <button
                        onClick={handleOpenAddDiaria}
                        className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-all duration-200 flex items-center gap-2 text-sm font-medium hover:scale-105 active:scale-95"
                      >
                        <Plus className="w-4 h-4" />
                        Adicionar Diária
                      </button>
                    )}
                    {permissions.editarPernoite && (
                      <button
                        onClick={handleOpenEditDados}
                        className={`px-4 py-2 ${theme.button} ${theme.text} rounded-lg border transition-all duration-200 flex items-center gap-2 text-sm font-medium hover:scale-105 active:scale-95`}
                      >
                        <Edit className="w-4 h-4" />
                        Editar
                      </button>
                    )}
                  </div>
                </div>
              )}

              {detailsTab === 'diarias' && (
                <div className="space-y-4">
                  {/* Informativo e navegação de diárias */}
                  <div className={`${theme.card} rounded-lg border p-3`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className={`${theme.textSecondary} text-xs uppercase`}>
                        Selecione a diária
                      </span>
                      <span className="text-xs px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                        Diária atual: {selectedStay.diariaAtual}
                      </span>
                    </div>

                    <div className="relative">
                      <button
                        onClick={() => scrollDiarias('left')}
                        disabled={selectedDiariaIndex === 0}
                        className={`absolute left-0 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full ${
                          selectedDiariaIndex === 0
                            ? 'bg-slate-700/30 text-slate-500 cursor-not-allowed'
                            : 'bg-slate-700 text-white hover:bg-slate-600'
                        } transition-all`}
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => scrollDiarias('right')}
                        disabled={selectedDiariaIndex === selectedStay.diarias.length - 1}
                        className={`absolute right-0 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full ${
                          selectedDiariaIndex === selectedStay.diarias.length - 1
                            ? 'bg-slate-700/30 text-slate-500 cursor-not-allowed'
                            : 'bg-slate-700 text-white hover:bg-slate-600'
                        } transition-all`}
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>

                      <div className="overflow-x-auto px-10">
                        <div className="flex gap-2 py-2">
                          {selectedStay.diarias.map((diaria, idx) => {
                            const isDiariaAtual = idx + 1 === selectedStay.diariaAtual;
                            return (
                              <button
                                key={idx}
                                onClick={() => setSelectedDiariaIndex(idx)}
                                className={`px-4 py-2 text-sm rounded-lg border transition-all flex-shrink-0 ${
                                  selectedDiariaIndex === idx
                                    ? 'bg-violet-600 text-white border-violet-400'
                                    : isDiariaAtual
                                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                    : `${theme.button} ${theme.text}`
                                }`}
                              >
                                <div className="font-semibold">
                                  Diária {diaria.numero}
                                  {isDiariaAtual && ' ★'}
                                </div>
                                <div className="text-[10px] opacity-80">
                                  {diaria.dataInicio.split(' ')[0]}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>

                  {currentDiaria && (
                    <>
                      {/* Botão trocar quarto */}
                      {permissions.trocarQuarto && (
                        <button
                          onClick={handleOpenChangeRoom}
                          className={`px-4 py-2 ${theme.button} ${theme.text} rounded-lg border transition-all duration-200 flex items-center gap-2 text-sm font-medium hover:scale-105 active:scale-95`}
                        >
                          <RefreshCw className="w-4 h-4" />
                          Trocar de Quarto
                        </button>
                      )}

                      {/* Sub-tabs */}
                      <div className="flex gap-2 border-b border-white/10 pb-2">
                        <button
                          onClick={() => setDiariaTab('detalhes')}
                          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                            diariaTab === 'detalhes'
                              ? 'bg-violet-600 text-white'
                              : `${theme.button} ${theme.text}`
                          }`}
                        >
                          Detalhes
                        </button>
                        <button
                          onClick={() => setDiariaTab('hospedes')}
                          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                            diariaTab === 'hospedes'
                              ? 'bg-violet-600 text-white'
                              : `${theme.button} ${theme.text}`
                          }`}
                        >
                          Hóspedes
                        </button>
                        <button
                          onClick={() => setDiariaTab('consumo')}
                          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                            diariaTab === 'consumo'
                              ? 'bg-violet-600 text-white'
                              : `${theme.button} ${theme.text}`
                          }`}
                        >
                          Consumo
                        </button>
                        <button
                          onClick={() => setDiariaTab('pagamentos')}
                          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                            diariaTab === 'pagamentos'
                              ? 'bg-violet-600 text-white'
                              : `${theme.button} ${theme.text}`
                          }`}
                        >
                          Pagamentos
                        </button>
                      </div>

                      {/* Conteúdo das sub-tabs */}
                      {diariaTab === 'detalhes' && (
                        <div className={`${theme.card} rounded-lg border p-4 space-y-3`}>
                          <div className="flex items-center justify-between">
                            <span className={`${theme.textSecondary} text-xs uppercase`}>
                              Quarto
                            </span>
                            <span className={`${theme.text} font-bold`}>
                              {formatRoomNumber(currentDiaria.quarto)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className={`${theme.textSecondary} text-xs uppercase`}>
                              Valor da Diária
                            </span>
                            <span className={`${theme.text} font-bold`}>
                              R$ {currentDiaria.valorDiaria.toFixed(2)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className={`${theme.textSecondary} text-xs uppercase`}>
                              Período
                            </span>
                            <span className={`${theme.text} text-xs`}>
                              {currentDiaria.dataInicio} → {currentDiaria.dataFim}
                            </span>
                          </div>
                        </div>
                      )}

                      {diariaTab === 'hospedes' && (
                        <div className="space-y-3">
                          {permissions.gerenciarHospedes && (
                            <button
                              onClick={handleOpenAddGuest}
                              className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-all duration-200 flex items-center gap-2 text-sm font-medium hover:scale-105 active:scale-95"
                            >
                              <Plus className="w-4 h-4" />
                              Adicionar Hóspede
                            </button>
                          )}

                          <div className="space-y-2">
                            {currentDiaria.hospedes.map((h) => (
                              <div
                                key={h.id}
                                className={`${theme.card} rounded-lg border p-3 flex items-start justify-between`}
                              >
                                <div>
                                  <div className="flex items-center gap-2">
                                    <User className="w-4 h-4 text-violet-400" />
                                    <span className={`${theme.text} font-semibold text-sm`}>
                                      {h.nome}
                                    </span>
                                  </div>
                                  <p className={`${theme.textSecondary} text-xs mt-1`}>
                                    CPF: {h.cpf}
                                  </p>
                                  <p className={`${theme.textSecondary} text-xs`}>
                                    Tel: {h.telefone}
                                  </p>
                                </div>
                                {permissions.gerenciarHospedes && (
                                  <button
                                    onClick={() =>
                                      showNotification('Remover hóspede (implementar)', 'info')
                                    }
                                    className="text-rose-400 hover:text-rose-300"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {diariaTab === 'consumo' && (
                        <div className="space-y-3">
                          {permissions.gerenciarConsumo && (
                            <button
                              onClick={handleOpenAddConsumo}
                              className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-all duration-200 flex items-center gap-2 text-sm font-medium hover:scale-105 active:scale-95"
                            >
                              <Plus className="w-4 h-4" />
                              Adicionar Consumo
                            </button>
                          )}

                          {currentDiaria.consumos.length === 0 ? (
                            <p className={`${theme.textSecondary} text-sm text-center py-8`}>
                              Nenhum consumo registrado nesta diária.
                            </p>
                          ) : (
                            <div className="space-y-2">
                              {currentDiaria.consumos.map((c) => (
                                <div
                                  key={c.id}
                                  className={`${theme.card} rounded-lg border p-3 flex items-start justify-between`}
                                >
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                      <ShoppingCart className="w-4 h-4 text-emerald-400" />
                                      <span className={`${theme.text} font-semibold text-sm`}>
                                        {c.item}
                                      </span>
                                    </div>
                                    <p className={`${theme.textSecondary} text-xs mt-1`}>
                                      Categoria: {c.categoria} • Qtd: {c.quantidade} • Unit: R${' '}
                                      {c.valorUnitario.toFixed(2)}
                                    </p>
                                    <p className={`${theme.textSecondary} text-xs`}>
                                      Forma de pagamento: {c.formaPagamento}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className={`${theme.text} font-bold`}>
                                      R$ {c.valorTotal.toFixed(2)}
                                    </span>
                                    {permissions.gerenciarConsumo && (
                                      <button
                                        onClick={() =>
                                          showNotification('Remover consumo (implementar)', 'info')
                                        }
                                        className="text-rose-400 hover:text-rose-300"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {diariaTab === 'pagamentos' && (
                        <div className="space-y-3">
                          {permissions.gerenciarPagamentos && (
                            <button
                              onClick={handleOpenAddPagamento}
                              className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-all duration-200 flex items-center gap-2 text-sm font-medium hover:scale-105 active:scale-95"
                            >
                              <Plus className="w-4 h-4" />
                              Adicionar Pagamento
                            </button>
                          )}

                          {currentDiaria.pagamentos.length === 0 ? (
                            <p className={`${theme.textSecondary} text-sm text-center py-8`}>
                              Nenhum pagamento registrado nesta diária.
                            </p>
                          ) : (
                            <div className="space-y-2">
                              {currentDiaria.pagamentos.map((p) => (
                                <div
                                  key={p.id}
                                  className={`${theme.card} rounded-lg border p-3 flex items-start justify-between`}
                                >
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                      <CreditCard className="w-4 h-4 text-emerald-400" />
                                      <span className={`${theme.text} font-semibold text-sm`}>
                                        {p.descricao}
                                      </span>
                                    </div>
                                    <p className={`${theme.textSecondary} text-xs mt-1`}>
                                      {p.formaPagamento} • {p.data}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className={`${theme.text} font-bold`}>
                                      R$ {p.valor.toFixed(2)}
                                    </span>
                                    {permissions.gerenciarPagamentos && (
                                      <button
                                        onClick={() =>
                                          showNotification('Remover pagamento (implementar)', 'info')
                                        }
                                        className="text-rose-400 hover:text-rose-300"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Rodapé com botões de ação */}
            <div className={`p-4 border-t ${theme.divider} flex gap-2 justify-end`}>
              {permissions.cancelarReserva && (
                <button
                  onClick={() => setShowCancelModal(true)}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-all duration-200 flex items-center gap-2 text-sm font-medium hover:scale-105 active:scale-95"
                >
                  <XCircle className="w-4 h-4" />
                  Cancelar Reserva
                </button>
              )}
              {permissions.finalizarReserva && (
                <button
                  onClick={() => setShowFinishModal(true)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-all duration-200 flex items-center gap-2 text-sm font-medium hover:scale-105 active:scale-95"
                >
                  <Check className="w-4 h-4" />
                  Finalizar Reserva
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Adicionar Diária */}
      {showAddDiariaModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className={`${theme.card} rounded-xl border shadow-2xl max-w-2xl w-full`}>
            <div className={`p-4 border-b ${theme.divider} flex items-center justify-between`}>
              <h3 className={`text-lg font-bold ${theme.text}`}>Adicionar Diária</h3>
              <button
                onClick={() => setShowAddDiariaModal(false)}
                className={`${theme.textSecondary} hover:${theme.text}`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block mb-1 ${theme.textSecondary}`}>Data Início</label>
                  <input
                    type="date"
                    value={novaDiariaDataInicio}
                    onChange={(e) => setNovaDiariaDataInicio(e.target.value)}
                    className={`w-full px-3 py-2 ${theme.input} rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 border-2`}
                  />
                </div>
                <div>
                  <label className={`block mb-1 ${theme.textSecondary}`}>Hora Início</label>
                  <input
                    type="time"
                    value={novaDiariaHoraInicio}
                    onChange={(e) => setNovaDiariaHoraInicio(e.target.value)}
                    className={`w-full px-3 py-2 ${theme.input} rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 border-2`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block mb-1 ${theme.textSecondary}`}>Data Fim</label>
                  <input
                    type="date"
                    value={novaDiariaDataFim}
                    onChange={(e) => setNovaDiariaDataFim(e.target.value)}
                    className={`w-full px-3 py-2 ${theme.input} rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 border-2`}
                  />
                </div>
                <div>
                  <label className={`block mb-1 ${theme.textSecondary}`}>Hora Fim</label>
                  <input
                    type="time"
                    value={novaDiariaHoraFim}
                    onChange={(e) => setNovaDiariaHoraFim(e.target.value)}
                    className={`w-full px-3 py-2 ${theme.input} rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 border-2`}
                  />
                </div>
              </div>

              <div>
                <label className={`block mb-1 ${theme.textSecondary}`}>Quarto</label>
                <select
                  value={novaDiariaQuarto}
                  onChange={(e) => setNovaDiariaQuarto(e.target.value)}
                  className={`w-full px-3 py-2 ${theme.input} rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 border-2`}
                >
                  <option value="">Selecione um quarto</option>
                  {categoriasQuartos.flatMap((cat) =>
                    cat.quartos.map((q) => (
                      <option key={q} value={q}>
                        {cat.nome} - Quarto {formatRoomNumber(q)}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label className={`block mb-1 ${theme.textSecondary}`}>
                  Hóspedes (pré-carregados)
                </label>
                <div className={`${theme.card} rounded-lg border p-3`}>
                  {novaDiariaPessoas.length === 0 ? (
                    <p className={`${theme.textSecondary} text-xs`}>
                      Nenhum hóspede pré-carregado
                    </p>
                  ) : (
                    <div className="space-y-1">
                      {novaDiariaPessoas.map((pid) => {
                        const pessoa = hospedesCadastrados.find((h) => h.id === pid);
                        return (
                          <div key={pid} className="text-xs">
                            • {pessoa?.nome}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className={`p-4 border-t ${theme.divider} flex gap-2`}>
              <button
                onClick={() => setShowAddDiariaModal(false)}
                className={`flex-1 px-4 py-2 ${theme.button} ${theme.text} rounded-lg border transition-all duration-200 text-sm font-medium hover:scale-105 active:scale-95`}
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveAddDiaria}
                className="flex-1 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-all duration-200 text-sm font-medium hover:scale-105 active:scale-95"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Editar Dados do Pernoite */}
      {showEditDadosModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className={`${theme.card} rounded-xl border shadow-2xl max-w-xl w-full`}>
            <div className={`p-4 border-b ${theme.divider} flex items-center justify-between`}>
              <h3 className={`text-lg font-bold ${theme.text}`}>Editar Dados do Pernoite</h3>
              <button
                onClick={() => setShowEditDadosModal(false)}
                className={`${theme.textSecondary} hover:${theme.text}`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block mb-1 ${theme.textSecondary}`}>
                    Data Chegada Prevista
                  </label>
                  <input
                    type="date"
                    value={editChegadaData}
                    onChange={(e) => setEditChegadaData(e.target.value)}
                    className={`w-full px-3 py-2 ${theme.input} rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 border-2`}
                  />
                </div>
                <div>
                  <label className={`block mb-1 ${theme.textSecondary}`}>
                    Hora Chegada Prevista
                  </label>
                  <input
                    type="time"
                    value={editChegadaHora}
                    onChange={(e) => setEditChegadaHora(e.target.value)}
                    className={`w-full px-3 py-2 ${theme.input} rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 border-2`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block mb-1 ${theme.textSecondary}`}>
                    Data Saída Prevista
                  </label>
                  <input
                    type="date"
                    value={editSaidaData}
                    onChange={(e) => setEditSaidaData(e.target.value)}
                    className={`w-full px-3 py-2 ${theme.input} rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-2 focus:ring-violet-500 border-2`}
                  />
                </div>
                <div>
                  <label className={`block mb-1 ${theme.textSecondary}`}>Hora Saída Prevista</label>
                  <input
                    type="time"
                    value={editSaidaHora}
                    onChange={(e) => setEditSaidaHora(e.target.value)}
                    className={`w-full px-3 py-2 ${theme.input} rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 border-2`}
                  />
                </div>
              </div>
            </div>
            <div className={`p-4 border-t ${theme.divider} flex gap-2`}>
              <button
                onClick={() => setShowEditDadosModal(false)}
                className={`flex-1 px-4 py-2 ${theme.button} ${theme.text} rounded-lg border transition-all duration-200 text-sm font-medium hover:scale-105 active:scale-95`}
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveEditDados}
                className="flex-1 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-all duration-200 text-sm font-medium hover:scale-105 active:scale-95"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Trocar Quarto */}
      {showChangeRoomModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className={`${theme.card} rounded-xl border shadow-2xl max-w-xl w-full`}>
            <div className={`p-4 border-b ${theme.divider} flex items-center justify-between`}>
              <h3 className={`text-lg font-bold ${theme.text}`}>Trocar de Quarto</h3>
              <button
                onClick={() => setShowChangeRoomModal(false)}
                className={`${theme.textSecondary} hover:${theme.text}`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4 text-sm">
              <div>
                <label className={`block mb-1 ${theme.textSecondary}`}>
                  Selecione a categoria
                </label>
                <select
                  value={selectedCategoriaQuarto}
                  onChange={(e) => {
                    setSelectedCategoriaQuarto(e.target.value);
                    setSelectedNovoQuarto('');
                  }}
                  className={`w-full px-3 py-2 ${theme.input} rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 border-2`}
                >
                  <option value="">Escolha uma categoria</option>
                  {categoriasQuartos.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.nome}
                    </option>
                  ))}
                </select>
              </div>

              {selectedCategoriaQuarto && (
                <div>
                  <label className={`block mb-1 ${theme.textSecondary}`}>
                    Selecione o quarto
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {categoriasQuartos
                      .find((c) => c.id === parseInt(selectedCategoriaQuarto))
                      ?.quartos.map((q) => (
                        <button
                          key={q}
                          onClick={() => setSelectedNovoQuarto(q)}
                          className={`px-3 py-2 text-sm rounded-lg border transition-all ${
                            selectedNovoQuarto === q
                              ? 'bg-violet-600 text-white border-violet-400'
                              : `${theme.button} ${theme.text}`
                          }`}
                        >
                          {formatRoomNumber(q)}
                        </button>
                      ))}
                  </div>
                </div>
              )}
            </div>
            <div className={`p-4 border-t ${theme.divider} flex gap-2`}>
              <button
                onClick={() => setShowChangeRoomModal(false)}
                className={`flex-1 px-4 py-2 ${theme.button} ${theme.text} rounded-lg border transition-all duration-200 text-sm font-medium hover:scale-105 active:scale-95`}
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveChangeRoom}
                className="flex-1 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-all duration-200 text-sm font-medium hover:scale-105 active:scale-95"
              >
                Confirmar Troca
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Adicionar Hóspede */}
      {showAddGuestModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className={`${theme.card} rounded-xl border shadow-2xl max-w-xl w-full`}>
            <div className={`p-4 border-b ${theme.divider} flex items-center justify-between`}>
              <h3 className={`text-lg font-bold ${theme.text}`}>Adicionar Hóspede</h3>
              <button
                onClick={() => setShowAddGuestModal(false)}
                className={`${theme.textSecondary} hover:${theme.text}`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4 text-sm">
              <div className="relative">
                <label className={`block mb-1 ${theme.textSecondary}`}>
                  Pesquisar hóspede por nome
                </label>
                <div className="relative">
                  <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${theme.textSecondary}`} />
                  <input
                    type="text"
                    placeholder="Digite o nome..."
                    value={searchGuestTerm}
                    onChange={(e) => setSearchGuestTerm(e.target.value)}
                    className={`w-full pl-10 pr-3 py-2 ${theme.input} rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 border-2`}
                  />
                </div>
              </div>

              <div className={`${theme.card} rounded-lg border p-3 max-h-64 overflow-y-auto`}>
                {filteredGuests.length === 0 ? (
                  <p className={`${theme.textSecondary} text-xs text-center py-4`}>
                    Nenhum hóspede encontrado.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {filteredGuests.map((h) => (
                      <button
                        key={h.id}
                        onClick={() => setSelectedGuest(h)}
                        className={`w-full text-left px-3 py-2 rounded-lg border transition-all ${
                          selectedGuest?.id === h.id
                            ? 'bg-violet-600 text-white border-violet-400'
                            : `${theme.button} ${theme.text}`
                        }`}
                      >
                        <div className="font-semibold text-sm">{h.nome}</div>
                        <div className="text-xs opacity-80">
                          CPF: {h.cpf} • Tel: {h.telefone}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className={`p-4 border-t ${theme.divider} flex gap-2`}>
              <button
                onClick={() => setShowAddGuestModal(false)}
                className={`flex-1 px-4 py-2 ${theme.button} ${theme.text} rounded-lg border transition-all duration-200 text-sm font-medium hover:scale-105 active:scale-95`}
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveAddGuest}
                className="flex-1 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-all duration-200 text-sm font-medium hover:scale-105 active:scale-95"
              >
                Adicionar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Adicionar Consumo */}
      {showAddConsumoModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className={`${theme.card} rounded-xl border shadow-2xl max-w-xl w-full`}>
            <div className={`p-4 border-b ${theme.divider} flex items-center justify-between`}>
              <h3 className={`text-lg font-bold ${theme.text}`}>Adicionar Consumo</h3>
              <button
                onClick={() => setShowAddConsumoModal(false)}
                className={`${theme.textSecondary} hover:${theme.text}`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4 text-sm">
              <div>
                <label className={`block mb-1 ${theme.textSecondary}`}>
                  Categoria do produto
                </label>
                <select
                  value={consumoCategoria}
                  onChange={(e) => {
                    setConsumoCategoria(e.target.value);
                    setConsumoProduto('');
                  }}
                  className={`w-full px-3 py-2 ${theme.input} rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 border-2`}
                >
                  <option value="">Selecione uma categoria</option>
                  {categoriasConsumo.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.nome}
                    </option>
                  ))}
                </select>
              </div>

              {consumoCategoria && (
                <div>
                  <label className={`block mb-1 ${theme.textSecondary}`}>Produto</label>
                  <select
                    value={consumoProduto}
                    onChange={(e) => setConsumoProduto(e.target.value)}
                    className={`w-full px-3 py-2 ${theme.input} rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 border-2`}
                  >
                    <option value="">Selecione um produto</option>
                    {categoriaConsumoSelecionada?.produtos.map((prod) => (
                      <option key={prod.id} value={prod.id}>
                        {prod.nome} - R$ {prod.preco.toFixed(2)}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className={`block mb-1 ${theme.textSecondary}`}>Quantidade</label>
                <input
                  type="number"
                  min={1}
                  value={consumoQuantidade}
                  onChange={(e) => setConsumoQuantidade(parseInt(e.target.value) || 1)}
                  className={`w-full px-3 py-2 ${theme.input} rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 border-2`}
                />
              </div>

              <div>
                <label className={`block mb-1 ${theme.textSecondary}`}>Forma de pagamento</label>
                <select
                  value={consumoFormaPagamento}
                  onChange={(e) => setConsumoFormaPagamento(e.target.value)}
                  className={`w-full px-3 py-2 ${theme.input} rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 border-2`}
                >
                  <option value="">Selecione</option>
                  {formasPagamento.map((fp) => (
                    <option key={fp} value={fp}>
                      {fp}
                    </option>
                  ))}
                </select>
              </div>

              {produtoSelecionado && (
                <div className={`${theme.card} rounded-lg border p-3`}>
                  <div className="flex justify-between items-center">
                    <span className={`${theme.textSecondary} text-xs`}>Total</span>
                    <span className={`${theme.text} font-bold text-lg`}>
                      R$ {(produtoSelecionado.preco * consumoQuantidade).toFixed(2)}
                    </span>
                  </div>
                </div>
              )}
            </div>
            <div className={`p-4 border-t ${theme.divider} flex gap-2`}>
              <button
                onClick={() => setShowAddConsumoModal(false)}
                className={`flex-1 px-4 py-2 ${theme.button} ${theme.text} rounded-lg border transition-all duration-200 text-sm font-medium hover:scale-105 active:scale-95`}
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveAddConsumo}
                className="flex-1 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-all duration-200 text-sm font-medium hover:scale-105 active:scale-95"
              >
                Adicionar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Adicionar Pagamento */}
      {showAddPagamentoModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className={`${theme.card} rounded-xl border shadow-2xl max-w-xl w-full`}>
            <div className={`p-4 border-b ${theme.divider} flex items-center justify-between`}>
              <h3 className={`text-lg font-bold ${theme.text}`}>Adicionar Pagamento</h3>
              <button
                onClick={() => setShowAddPagamentoModal(false)}
                className={`${theme.textSecondary} hover:${theme.text}`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4 text-sm">
              <div>
                <label className={`block mb-1 ${theme.textSecondary}`}>Descrição</label>
                <input
                  type="text"
                  placeholder="Ex: Entrada 50%, Sinal, Pagamento restante..."
                  value={pagamentoDescricao}
                  onChange={(e) => setPagamentoDescricao(e.target.value)}
                  className={`w-full px-3 py-2 ${theme.input} rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 border-2`}
                />
              </div>

              <div>
                <label className={`block mb-1 ${theme.textSecondary}`}>Forma de pagamento</label>
                <select
                  value={pagamentoFormaPagamento}
                  onChange={(e) => setPagamentoFormaPagamento(e.target.value)}
                  className={`w-full px-3 py-2 ${theme.input} rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 border-2`}
                >
                  <option value="">Selecione</option>
                  {formasPagamento.map((fp) => (
                    <option key={fp} value={fp}>
                      {fp}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={`block mb-1 ${theme.textSecondary}`}>Valor (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  value={pagamentoValor}
                  onChange={(e) => setPagamentoValor(parseFloat(e.target.value) || 0)}
                  className={`w-full px-3 py-2 ${theme.input} rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 border-2`}
                />
              </div>
            </div>
            <div className={`p-4 border-t ${theme.divider} flex gap-2`}>
              <button
                onClick={() => setShowAddPagamentoModal(false)}
                className={`flex-1 px-4 py-2 ${theme.button} ${theme.text} rounded-lg border transition-all duration-200 text-sm font-medium hover:scale-105 active:scale-95`}
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveAddPagamento}
                className="flex-1 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-all duration-200 text-sm font-medium hover:scale-105 active:scale-95"
              >
                Adicionar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Cancelar */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className={`${theme.card} rounded-xl border shadow-2xl max-w-md w-full`}>
            <div className={`p-4 border-b ${theme.divider}`}>
              <h3 className={`text-lg font-bold ${theme.text}`}>Cancelar Reserva?</h3>
            </div>
            <div className="p-4">
              <p className={`${theme.textSecondary} text-sm`}>
                Tem certeza que deseja cancelar esta reserva? Esta ação não pode ser desfeita.
              </p>
            </div>
            <div className={`p-4 border-t ${theme.divider} flex gap-2`}>
              <button
                onClick={() => setShowCancelModal(false)}
                className={`flex-1 px-4 py-2 ${theme.button} ${theme.text} rounded-lg border transition-all duration-200 text-sm font-medium hover:scale-105 active:scale-95`}
              >
                Voltar
              </button>
              <button
                onClick={handleCancelStay}
                className="flex-1 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-all duration-200 text-sm font-medium hover:scale-105 active:scale-95"
              >
                Confirmar Cancelamento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Finalizar */}
      {showFinishModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className={`${theme.card} rounded-xl border shadow-2xl max-w-md w-full`}>
            <div className={`p-4 border-b ${theme.divider}`}>
              <h3 className={`text-lg font-bold ${theme.text}`}>Finalizar Reserva?</h3>
            </div>
            <div className="p-4">
              <p className={`${theme.textSecondary} text-sm`}>
                Confirma a finalização desta reserva? O quarto será liberado e o checkout será
                registrado.
              </p>
            </div>
            <div className={`p-4 border-t ${theme.divider} flex gap-2`}>
              <button
                onClick={() => setShowFinishModal(false)}
                className={`flex-1 px-4 py-2 ${theme.button} ${theme.text} rounded-lg border transition-all duration-200 text-sm font-medium hover:scale-105 active:scale-95`}
              >
                Voltar
              </button>
              <button
                onClick={handleFinishStay}
                className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-all duration-200 text-sm font-medium hover:scale-105 active:scale-95"
              >
                Confirmar Finalização
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Permissões */}
      {showPermissionsModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`${theme.card} rounded-xl border shadow-2xl max-w-md w-full`}>
            <div className={`p-4 border-b ${theme.divider} flex items-center justify-between`}>
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-violet-500" />
                <h3 className={`text-lg font-bold ${theme.text}`}>Permissões de Pernoites</h3>
              </div>
              <button
                onClick={() => setShowPermissionsModal(false)}
                className={`${theme.textSecondary} hover:${theme.text} transition-transform duration-200 hover:scale-110 active:scale-90`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-3 text-sm max-h-[60vh] overflow-y-auto">
              <label className="flex items-center justify-between gap-2">
                <span className={theme.text}>Acesso total</span>
                <input
                  type="checkbox"
                  checked={permissions.acessoTotal}
                  onChange={() => togglePermission('acessoTotal')}
                  className="w-4 h-4 accent-violet-500"
                />
              </label>
              <div className={`${theme.divider} border-t my-1`} />
              {Object.keys(permissions)
                .filter((k) => k !== 'acessoTotal')
                .map((key) => (
                  <label key={key} className="flex items-center justify-between gap-2">
                    <span className={theme.text}>
                      {key
                        .replace(/([A-Z])/g, ' $1')
                        .replace(/^./, (str) => str.toUpperCase())}
                    </span>
                    <input
                      type="checkbox"
                      checked={permissions[key]}
                      onChange={() => togglePermission(key)}
                      className="w-4 h-4 accent-violet-500"
                      disabled={permissions.acessoTotal}
                    />
                  </label>
                ))}
            </div>

            <div className={`p-4 border-t ${theme.divider}`}>
              <button
                onClick={() => setShowPermissionsModal(false)}
                className="w-full px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-all duration-200 text-sm font-medium hover:scale-105 active:scale-95 hover:shadow-lg hover:shadow-violet-500/50"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notificação */}
      {notification && (
        <div className="fixed top-4 right-4 z-[110] animate-slideIn">
          <div
            className={`${
              notification.type === 'success'
                ? 'bg-emerald-500'
                : notification.type === 'error'
                ? 'bg-rose-500'
                : notification.type === 'warning'
                ? 'bg-amber-500'
                : 'bg-slate-700'
            } text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-3`}
          >
            <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
            <span className="font-medium text-sm">{notification.message}</span>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(100%);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        .animate-slideIn {
          animation: slideIn 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
