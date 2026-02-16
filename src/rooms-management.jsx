import React, { useState } from 'react';
import {
  BedDouble,
  Sun,
  Moon,
  Shield,
  Check,
  Users,
  AlertTriangle,
  Calendar,
  ChevronDown,
  Info,
  Wrench,
  User,
  KeyRound,
  Clock,
  Sparkles,
  X,
  Plus,
  Edit,
} from 'lucide-react';

function formatRoomNumber(num) {
  return num < 10 ? `0${num}` : `${num}`;
}

export default function RoomsManagement() {
  const [isDark, setIsDark] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('all');
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [notification, setNotification] = useState(null);
  const [collapsedCategories, setCollapsedCategories] = useState({});
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignContext, setAssignContext] = useState(null); // { type: 'LIMPEZA'|'MANUTENCAO', room }

  const [permissions, setPermissions] = useState({
    adicionarQuarto: true,
    editarQuarto: true,
    dashboard: true,
    acionarLimpeza: true,
    acionarManutencao: true,
    alterarStatus: true,
  });

  const funcionarios = [
    { id: 1, nome: 'Ana Paula (Camareira)' },
    { id: 2, nome: 'Carlos Oliveira (Manutenção)' },
    { id: 3, nome: 'João Silva (Camareira)' },
    { id: 4, nome: 'Marcos Souza (Manutenção)' },
  ];

  const showNotification = (message, type = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const togglePermission = (key) => {
    setPermissions((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const toggleCategoryCollapse = (categoryId) => {
    setCollapsedCategories((prev) => ({
      ...prev,
      [categoryId]: !prev[categoryId],
    }));
  };

  const categories = [
    { id: 1, nome: 'Standard', descricao: 'Quartos simples, confortáveis para estadias curtas.' },
    { id: 2, nome: 'Luxo', descricao: 'Quartos amplos com mais conforto e comodidades.' },
    { id: 3, nome: 'Suíte', descricao: 'Suítes completas com sala de estar e serviços extras.' },
  ];

  const STATUS = {
    DISPONIVEL: 'DISPONÍVEL',
    OCUPADO: 'OCUPADO',
    RESERVADO: 'RESERVADO',
    LIMPEZA: 'LIMPEZA',
    MANUTENCAO: 'MANUTENÇÃO',
    FORA_DE_SERVICO: 'FORA DE SERVIÇO',
  };

  const baseRooms = [
    // Standard
    {
      numero: 1,
      categoriaId: 1,
      descricao: 'Quarto Standard com cama de casal.',
      tipoOcupacao: 'Duplo',
      camas: { casal: 1, solteiro: 0, beliche: 0, rede: 0 },
      status: STATUS.DISPONIVEL,
      estoqueItens: { toalhas: 4, travesseiros: 2, amenities: 3 },
    },
    {
      numero: 2,
      categoriaId: 1,
      descricao: 'Quarto Standard com duas camas de solteiro.',
      tipoOcupacao: 'Duplo',
      camas: { casal: 0, solteiro: 2, beliche: 0, rede: 0 },
      status: STATUS.DISPONIVEL,
      estoqueItens: { toalhas: 2, travesseiros: 2, amenities: 1 },
    },
    {
      numero: 3,
      categoriaId: 1,
      descricao: 'Quarto Standard econômico.',
      tipoOcupacao: 'Single',
      camas: { casal: 0, solteiro: 1, beliche: 0, rede: 0 },
      status: STATUS.OCUPADO,
      estoqueItens: { toalhas: 1, travesseiros: 1, amenities: 1 },
      hospede: {
        nome: 'João Silva',
        checkin: '15/02/2026 14:00',
        checkout: '17/02/2026 12:00',
        categoriaReserva: 'Standard',
      },
    },
    {
      numero: 4,
      categoriaId: 1,
      descricao: 'Quarto Standard com beliche.',
      tipoOcupacao: 'Triplo',
      camas: { casal: 0, solteiro: 1, beliche: 1, rede: 0 },
      status: STATUS.RESERVADO,
      estoqueItens: { toalhas: 3, travesseiros: 3, amenities: 2 },
      hospede: {
        nome: 'Maria Santos',
        checkin: '18/02/2026 15:00',
        checkout: '20/02/2026 11:00',
        categoriaReserva: 'Standard',
      },
    },
    {
      numero: 5,
      categoriaId: 1,
      descricao: 'Quarto Standard aguardando limpeza.',
      tipoOcupacao: 'Duplo',
      camas: { casal: 1, solteiro: 0, beliche: 0, rede: 0 },
      status: STATUS.LIMPEZA,
      estoqueItens: { toalhas: 0, travesseiros: 1, amenities: 0 },
      limpeza: {
        funcionario: 'Ana Paula',
        inicio: '16/02/2026 10:30',
      },
    },
    {
      numero: 6,
      categoriaId: 1,
      descricao: 'Quarto Standard em manutenção elétrica.',
      tipoOcupacao: 'Duplo',
      camas: { casal: 1, solteiro: 0, beliche: 0, rede: 0 },
      status: STATUS.MANUTENCAO,
      estoqueItens: { toalhas: 2, travesseiros: 2, amenities: 2 },
      manutencao: {
        responsavel: 'Carlos Oliveira',
        descricao: 'Troca de lâmpadas e revisão de tomadas.',
      },
    },
    {
      numero: 7,
      categoriaId: 1,
      descricao: 'Quarto Standard com rede adicional.',
      tipoOcupacao: 'Triplo',
      camas: { casal: 1, solteiro: 0, beliche: 0, rede: 1 },
      status: STATUS.DISPONIVEL,
      estoqueItens: { toalhas: 3, travesseiros: 3, amenities: 3 },
    },
    {
      numero: 8,
      categoriaId: 1,
      descricao: 'Quarto Standard com vista interna.',
      tipoOcupacao: 'Duplo',
      camas: { casal: 1, solteiro: 0, beliche: 0, rede: 0 },
      status: STATUS.DISPONIVEL,
      estoqueItens: { toalhas: 2, travesseiros: 2, amenities: 1 },
    },

    // Luxo
    {
      numero: 9,
      categoriaId: 2,
      descricao: 'Quarto Luxo com varanda e cama king.',
      tipoOcupacao: 'Duplo',
      camas: { casal: 1, solteiro: 0, beliche: 0, rede: 0 },
      status: STATUS.OCUPADO,
      estoqueItens: { toalhas: 4, travesseiros: 4, amenities: 4 },
      hospede: {
        nome: 'Carlos Mendes',
        checkin: '14/02/2026 16:00',
        checkout: '19/02/2026 12:00',
        categoriaReserva: 'Luxo',
      },
    },
    {
      numero: 10,
      categoriaId: 2,
      descricao: 'Quarto Luxo com hidromassagem.',
      tipoOcupacao: 'Duplo',
      camas: { casal: 1, solteiro: 0, beliche: 0, rede: 0 },
      status: STATUS.RESERVADO,
      estoqueItens: { toalhas: 4, travesseiros: 4, amenities: 4 },
      hospede: {
        nome: 'Fernanda Costa',
        checkin: '20/02/2026 13:00',
        checkout: '22/02/2026 11:00',
        categoriaReserva: 'Luxo',
      },
    },
    {
      numero: 11,
      categoriaId: 2,
      descricao: 'Quarto Luxo com duas camas queen.',
      tipoOcupacao: 'Triplo',
      camas: { casal: 0, solteiro: 0, beliche: 0, rede: 0 },
      status: STATUS.DISPONIVEL,
      estoqueItens: { toalhas: 4, travesseiros: 4, amenities: 3 },
    },
    {
      numero: 12,
      categoriaId: 2,
      descricao: 'Quarto Luxo aguardando limpeza.',
      tipoOcupacao: 'Duplo',
      camas: { casal: 1, solteiro: 0, beliche: 0, rede: 0 },
      status: STATUS.LIMPEZA,
      estoqueItens: { toalhas: 1, travesseiros: 2, amenities: 1 },
      limpeza: {
        funcionario: 'Joana Lima',
        inicio: '16/02/2026 09:45',
      },
    },
    {
      numero: 13,
      categoriaId: 2,
      descricao: 'Quarto Luxo em manutenção de ar condicionado.',
      tipoOcupacao: 'Duplo',
      camas: { casal: 1, solteiro: 0, beliche: 0, rede: 0 },
      status: STATUS.MANUTENCAO,
      estoqueItens: { toalhas: 2, travesseiros: 2, amenities: 2 },
      manutencao: {
        responsavel: 'Marcos Souza',
        descricao: 'Reparo no ar condicionado.',
      },
    },
    {
      numero: 14,
      categoriaId: 2,
      descricao: 'Quarto Luxo com rede e vista piscina.',
      tipoOcupacao: 'Triplo',
      camas: { casal: 1, solteiro: 0, beliche: 0, rede: 1 },
      status: STATUS.DISPONIVEL,
      estoqueItens: { toalhas: 3, travesseiros: 3, amenities: 3 },
    },
    {
      numero: 15,
      categoriaId: 2,
      descricao: 'Quarto Luxo desativado temporariamente.',
      tipoOcupacao: 'Duplo',
      camas: { casal: 1, solteiro: 0, beliche: 0, rede: 0 },
      status: STATUS.FORA_DE_SERVICO,
      estoqueItens: { toalhas: 0, travesseiros: 0, amenities: 0 },
      manutencao: {
        responsavel: 'Equipe Técnica',
        descricao: 'Reforma geral do banheiro.',
      },
    },

    // Suítes
    {
      numero: 16,
      categoriaId: 3,
      descricao: 'Suíte Master com sala de estar.',
      tipoOcupacao: 'Quádruplo',
      camas: { casal: 1, solteiro: 2, beliche: 0, rede: 0 },
      status: STATUS.OCUPADO,
      estoqueItens: { toalhas: 6, travesseiros: 6, amenities: 6 },
      hospede: {
        nome: 'Família Oliveira',
        checkin: '13/02/2026 15:00',
        checkout: '18/02/2026 11:00',
        categoriaReserva: 'Suíte Master',
      },
    },
    {
      numero: 17,
      categoriaId: 3,
      descricao: 'Suíte com hidromassagem e varanda.',
      tipoOcupacao: 'Duplo',
      camas: { casal: 1, solteiro: 0, beliche: 0, rede: 0 },
      status: STATUS.RESERVADO,
      estoqueItens: { toalhas: 4, travesseiros: 4, amenities: 4 },
      hospede: {
        nome: 'Lucas Pereira',
        checkin: '21/02/2026 14:00',
        checkout: '24/02/2026 12:00',
        categoriaReserva: 'Suíte Luxo',
      },
    },
    {
      numero: 18,
      categoriaId: 3,
      descricao: 'Suíte com beliche e rede.',
      tipoOcupacao: 'Quádruplo',
      camas: { casal: 1, solteiro: 0, beliche: 1, rede: 1 },
      status: STATUS.DISPONIVEL,
      estoqueItens: { toalhas: 4, travesseiros: 4, amenities: 2 },
    },
    {
      numero: 19,
      categoriaId: 3,
      descricao: 'Suíte em limpeza pesada.',
      tipoOcupacao: 'Triplo',
      camas: { casal: 1, solteiro: 1, beliche: 0, rede: 0 },
      status: STATUS.LIMPEZA,
      estoqueItens: { toalhas: 1, travesseiros: 2, amenities: 1 },
      limpeza: {
        funcionario: 'Pedro Lima',
        inicio: '16/02/2026 08:30',
      },
    },
    {
      numero: 20,
      categoriaId: 3,
      descricao: 'Suíte em manutenção hidráulica.',
      tipoOcupacao: 'Triplo',
      camas: { casal: 1, solteiro: 1, beliche: 0, rede: 0 },
      status: STATUS.MANUTENCAO,
      estoqueItens: { toalhas: 2, travesseiros: 2, amenities: 2 },
      manutencao: {
        responsavel: 'José Almeida',
        descricao: 'Reparo no box e torneiras.',
      },
    },
    {
      numero: 21,
      categoriaId: 3,
      descricao: 'Suíte com vista mar.',
      tipoOcupacao: 'Duplo',
      camas: { casal: 1, solteiro: 0, beliche: 0, rede: 0 },
      status: STATUS.DISPONIVEL,
      estoqueItens: { toalhas: 4, travesseiros: 4, amenities: 4 },
    },
    {
      numero: 22,
      categoriaId: 3,
      descricao: 'Suíte familiar com dois ambientes.',
      tipoOcupacao: 'Quádruplo',
      camas: { casal: 1, solteiro: 2, beliche: 0, rede: 0 },
      status: STATUS.DISPONIVEL,
      estoqueItens: { toalhas: 5, travesseiros: 5, amenities: 3 },
    },
  ];

  const rooms = baseRooms;

  const lowStockThreshold = 2;
  const hasLowStock = (estoqueItens) => {
    if (!estoqueItens) return false;
    return Object.values(estoqueItens).some(
      (qtd) => qtd !== null && qtd !== undefined && qtd < lowStockThreshold,
    );
  };

  const statusTheme = (status) => {
    // cor de fundo do card por status
    switch (status) {
      case STATUS.DISPONIVEL:
        return {
          bg: 'bg-emerald-500/10',
          icon: 'text-emerald-400',
          number: 'text-emerald-300',
        };
      case STATUS.OCUPADO:
        return {
          bg: 'bg-rose-500/10',
          icon: 'text-rose-400',
          number: 'text-rose-300',
        };
      case STATUS.RESERVADO:
        return {
          bg: 'bg-amber-500/10',
          icon: 'text-amber-400',
          number: 'text-amber-300',
        };
      case STATUS.LIMPEZA:
        return {
          bg: 'bg-sky-500/10',
          icon: 'text-sky-400',
          number: 'text-sky-300',
        };
      case STATUS.MANUTENCAO:
        return {
          bg: 'bg-indigo-500/10',
          icon: 'text-indigo-400',
          number: 'text-indigo-300',
        };
      case STATUS.FORA_DE_SERVICO:
        return {
          bg: 'bg-slate-500/10',
          icon: 'text-slate-300',
          number: 'text-slate-300',
        };
      default:
        return {
          bg: 'bg-slate-500/10',
          icon: 'text-slate-300',
          number: 'text-slate-300',
        };
    }
  };

  const statusPillColor = (status) => {
    switch (status) {
      case STATUS.DISPONIVEL:
        return 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30';
      case STATUS.OCUPADO:
        return 'bg-rose-500/15 text-rose-400 border border-rose-500/30';
      case STATUS.RESERVADO:
        return 'bg-amber-500/15 text-amber-400 border border-amber-500/30';
      case STATUS.LIMPEZA:
        return 'bg-sky-500/15 text-sky-400 border border-sky-500/30';
      case STATUS.MANUTENCAO:
        return 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30';
      case STATUS.FORA_DE_SERVICO:
        return 'bg-slate-500/20 text-slate-300 border border-slate-500/40';
      default:
        return 'bg-slate-500/20 text-slate-300 border border-slate-500/40';
    }
  };

  const canChangeStatus = (room, newStatus) => {
    if (!permissions.alterarStatus) return false;

    if (room.status === STATUS.OCUPADO || room.status === STATUS.RESERVADO) {
      return false;
    }

    if (room.status === STATUS.LIMPEZA || room.status === STATUS.MANUTENCAO) {
      return newStatus === STATUS.DISPONIVEL;
    }

    if (room.status === STATUS.DISPONIVEL) {
      return true;
    }

    if (room.status === STATUS.FORA_DE_SERVICO) {
      return newStatus === STATUS.MANUTENCAO || newStatus === STATUS.DISPONIVEL;
    }

    return false;
  };

  const handleChangeStatus = (room, newStatus) => {
    if (!canChangeStatus(room, newStatus)) {
      showNotification('Transição de status não permitida para este quarto.', 'error');
      return;
    }
    showNotification(
      `Status do quarto ${formatRoomNumber(room.numero)} alterado para ${newStatus}.`,
      'success',
    );
  };

  const handleCallCleaning = (room) => {
    if (!permissions.acionarLimpeza) {
      showNotification('Você não tem permissão para acionar limpeza.', 'error');
      return;
    }
    setAssignContext({ type: 'LIMPEZA', room });
    setShowAssignModal(true);
  };

  const handleCallMaintenance = (room) => {
    if (!permissions.acionarManutencao) {
      showNotification('Você não tem permissão para acionar manutenção.', 'error');
      return;
    }
    setAssignContext({ type: 'MANUTENCAO', room });
    setShowAssignModal(true);
  };

  const handleAssignFuncionario = (funcId) => {
    const func = funcionarios.find((f) => f.id === funcId);
    if (!func || !assignContext) return;

    const tipo =
      assignContext.type === 'LIMPEZA' ? 'limpeza' : 'manutenção';

    showNotification(
      `${tipo.charAt(0).toUpperCase() + tipo.slice(1)} do quarto ${formatRoomNumber(
        assignContext.room.numero,
      )} atribuída a ${func.nome}.`,
      'success',
    );
    setShowAssignModal(false);
    setAssignContext(null);
  };

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
    button: isDark ? 'bg-white/10 hover:bg-white/20 border-white/10' : 'bg-slate-100 hover:bg-slate-200 border-slate-300',
  };

  const stats = {
    total: rooms.length,
    disponiveis: rooms.filter((r) => r.status === STATUS.DISPONIVEL).length,
    ocupados: rooms.filter((r) => r.status === STATUS.OCUPADO).length,
    reservados: rooms.filter((r) => r.status === STATUS.RESERVADO).length,
    limpeza: rooms.filter((r) => r.status === STATUS.LIMPEZA).length,
    manutencao: rooms.filter((r) => r.status === STATUS.MANUTENCAO).length,
  };
  

  const filteredRooms = rooms.filter((room) => {
    const categoryOk = selectedCategory === 'all' || room.categoriaId === selectedCategory;
    const statusOk = selectedStatusFilter === 'all' || room.status === selectedStatusFilter;
    return categoryOk && statusOk;
  });

  const roomsByCategory = categories.map((cat) => ({
    ...cat,
    rooms: filteredRooms.filter((r) => r.categoriaId === cat.id),
  }));

  const renderRoomCardContent = (room) => {
    if (room.status === STATUS.DISPONIVEL) {
      return (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs">
            <Users className="w-3.5 h-3.5 text-violet-400" />
            <span className={`${theme.text} font-semibold`}>{room.tipoOcupacao}</span>
          </div>
          <div className="flex flex-wrap gap-2 text-[11px] mt-1">
            {room.camas.casal > 0 && (
              <span className="px-2 py-1 rounded-full bg-violet-500/15 text-violet-300 border border-violet-500/30">
                Cama casal x{room.camas.casal}
              </span>
            )}
            {room.camas.solteiro > 0 && (
              <span className="px-2 py-1 rounded-full bg-sky-500/15 text-sky-300 border border-sky-500/30">
                Cama solteiro x{room.camas.solteiro}
              </span>
            )}
            {room.camas.beliche > 0 && (
              <span className="px-2 py-1 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                Beliche x{room.camas.beliche}
              </span>
            )}
            {room.camas.rede > 0 && (
              <span className="px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                Rede x{room.camas.rede}
              </span>
            )}
          </div>
        </div>
      );
    }

    if (room.status === STATUS.OCUPADO || room.status === STATUS.RESERVADO) {
      const h = room.hospede;
      if (!h) return null;
      return (
        <div className="space-y-2 text-xs">
          <div className="flex items-center gap-2">
            <User className="w-3.5 h-3.5 text-violet-400" />
            <span className={`${theme.text} font-semibold`}>{h.nome}</span>
          </div>
          <div className="flex flex-col gap-1 mt-1">
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[11px] text-emerald-300">Check-in: {h.checkin}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-rose-400" />
              <span className="text-[11px] text-rose-300">Check-out: {h.checkout}</span>
            </div>
          </div>
        </div>
      );
    }

    if (room.status === STATUS.LIMPEZA) {
      const l = room.limpeza;
      return (
        <div className="space-y-2 text-xs">
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-sky-400" />
            <span className={`${theme.textSecondary}`}>
              Em limpeza por{' '}
              <span className={theme.text}>
                {l?.funcionario || 'não atribuído'}
              </span>
            </span>
          </div>
        </div>
      );
    }

    if (room.status === STATUS.MANUTENCAO || room.status === STATUS.FORA_DE_SERVICO) {
      const m = room.manutencao;
      return (
        <div className="space-y-2 text-xs">
          <div className="flex items-center gap-2">
            <Wrench className="w-3.5 h-3.5 text-indigo-400" />
            <span className={`${theme.textSecondary}`}>
              Em manutenção por{' '}
              <span className={theme.text}>
                {m?.responsavel || 'não atribuído'}
              </span>
            </span>
          </div>
        </div>
      );
    }

    return null;
  };

  const openDetails = (room) => {
    setSelectedRoom(room);
    setShowDetailsModal(true);
  };

  return (
    <div className={`min-h-screen ${theme.bg}`}>
      <div className={`absolute inset-0 ${theme.bgOverlay}`}></div>

      <div className="relative max-w-[1600px] mx-auto p-4 sm:p-8">
        {/* Header */}
        <header className="mb-6 pt-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className={`text-3xl font-bold ${theme.text} mb-1 tracking-tight`}>Quartos</h1>
              <p className={`${theme.textSecondary} text-sm flex items-center gap-2`}>
                <BedDouble className="w-3.5 h-3.5" />
                Gerenciamento de Quartos e Ocupação
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

        {/* Modal permissons */}
      {showPermissionsModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`${theme.card} rounded-xl border shadow-2xl max-w-md w-full`}>
            <div className={`p-4 border-b ${theme.divider} flex items-center justify-between`}>
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-violet-500" />
                <h3 className={`text-lg font-bold ${theme.text}`}>Permissões de Quartos</h3>
              </div>
              <button
                onClick={() => setShowPermissionsModal(false)}
                className={`${theme.textSecondary} hover:${theme.text} transition-transform duration-200 hover:scale-110 active:scale-90`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-3 text-sm">
              <label className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-white/5">
                <input
                  type="checkbox"
                  checked={permissions.dashboard}
                  onChange={() => togglePermission('dashboard')}
                  className="w-5 h-5 rounded accent-violet-500 cursor-pointer"
                />
                <div className="flex-1">
                  <span className={`${theme.text} font-medium block`}>📊 Dashboard</span>
                  <span className={`${theme.textSecondary} text-xs`}>
                    Permite ver o resumo geral dos quartos
                  </span>
                </div>
                {permissions.dashboard && <Check className="w-4 h-4 text-emerald-400" />}
              </label>

              <label className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-white/5">
                <input
                  type="checkbox"
                  checked={permissions.adicionarQuarto}
                  onChange={() => togglePermission('adicionarQuarto')}
                  className="w-5 h-5 rounded accent-violet-500 cursor-pointer"
                />
                <div className="flex-1">
                  <span className={`${theme.text} font-medium block`}>➕ Adicionar quarto</span>
                  <span className={`${theme.textSecondary} text-xs`}>
                    Permite cadastrar novos quartos
                  </span>
                </div>
                {permissions.adicionarQuarto && <Check className="w-4 h-4 text-emerald-400" />}
              </label>

              <label className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-white/5">
                <input
                  type="checkbox"
                  checked={permissions.editarQuarto}
                  onChange={() => togglePermission('editarQuarto')}
                  className="w-5 h-5 rounded accent-violet-500 cursor-pointer"
                />
                <div className="flex-1">
                  <span className={`${theme.text} font-medium block`}>✏️ Editar quarto</span>
                  <span className={`${theme.textSecondary} text-xs`}>
                    Permite alterar dados do quarto
                  </span>
                </div>
                {permissions.editarQuarto && <Check className="w-4 h-4 text-emerald-400" />}
              </label>

              <label className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-white/5">
                <input
                  type="checkbox"
                  checked={permissions.acionarLimpeza}
                  onChange={() => togglePermission('acionarLimpeza')}
                  className="w-5 h-5 rounded accent-violet-500 cursor-pointer"
                />
                <div className="flex-1">
                  <span className={`${theme.text} font-medium block`}>🧹 Acionar limpeza</span>
                  <span className={`${theme.textSecondary} text-xs`}>
                    Permite direcionar um funcionário para limpar o quarto
                  </span>
                </div>
                {permissions.acionarLimpeza && <Check className="w-4 h-4 text-emerald-400" />}
              </label>

              <label className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-white/5">
                <input
                  type="checkbox"
                  checked={permissions.acionarManutencao}
                  onChange={() => togglePermission('acionarManutencao')}
                  className="w-5 h-5 rounded accent-violet-500 cursor-pointer"
                />
                <div className="flex-1">
                  <span className={`${theme.text} font-medium block`}>🛠️ Acionar manutenção</span>
                  <span className={`${theme.textSecondary} text-xs`}>
                    Permite abrir uma manutenção para o quarto
                  </span>
                </div>
                {permissions.acionarManutencao && <Check className="w-4 h-4 text-emerald-400" />}
              </label>

              <label className="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-white/5">
                <input
                  type="checkbox"
                  checked={permissions.alterarStatus}
                  onChange={() => togglePermission('alterarStatus')}
                  className="w-5 h-5 rounded accent-violet-500 cursor-pointer"
                />
                <div className="flex-1">
                  <span className={`${theme.text} font-medium block`}>🔁 Alterar status</span>
                  <span className={`${theme.textSecondary} text-xs`}>
                    Permite mudar o status dos quartos (respeitando as regras)
                  </span>
                </div>
                {permissions.alterarStatus && <Check className="w-4 h-4 text-emerald-400" />}
              </label>
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

        {/* Dashboard como filtro */}
        {permissions.dashboard && (
          <div className={`${theme.card} backdrop-blur-xl rounded-xl p-4 mb-6 border shadow-xl`}>
            <div className="flex items-center gap-2 mb-4 justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-violet-500" />
                <h2 className={`text-sm font-bold ${theme.text} uppercase tracking-wider`}>
                  Filtros rápidos de status
                </h2>
              </div>
              {permissions.adicionarQuarto && (
                <button
                  onClick={() => showNotification('Ação de adicionar quarto (implementar formulário).', 'info')}
                  className="px-3 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-all duration-200 flex items-center gap-2 text-sm font-medium hover:scale-105 active:scale-95 hover:shadow-lg hover:shadow-violet-500/50"
                >
                  <Plus className="w-4 h-4" />
                  Adicionar quarto
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
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
                <p className="text-white/80 text-xs mt-1">Todos os quartos</p>
              </button>

              <button
                onClick={() => setSelectedStatusFilter(STATUS.DISPONIVEL)}
                className={`rounded-lg p-4 text-left transition-all ${
                  selectedStatusFilter === STATUS.DISPONIVEL ? 'ring-2 ring-white/60' : ''
                } bg-gradient-to-br from-emerald-500 to-teal-600`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <BedDouble className="w-5 h-5 text-white" />
                  <span className="text-white font-bold text-sm">DISPONÍVEIS</span>
                </div>
                <p className="text-3xl font-bold text-white">{stats.disponiveis}</p>
                <p className="text-white/80 text-xs mt-1">Prontos para ocupar</p>
              </button>

              <button
                onClick={() => setSelectedStatusFilter(STATUS.OCUPADO)}
                className={`rounded-lg p-4 text-left transition-all ${
                  selectedStatusFilter === STATUS.OCUPADO ? 'ring-2 ring-white/60' : ''
                } bg-gradient-to-br from-rose-500 to-red-600`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <Users className="w-5 h-5 text-white" />
                  <span className="text-white font-bold text-sm">OCUPADOS</span>
                </div>
                <p className="text-3xl font-bold text-white">{stats.ocupados}</p>
                <p className="text-white/80 text-xs mt-1">Hóspedes no hotel</p>
              </button>

              <button
                onClick={() => setSelectedStatusFilter(STATUS.RESERVADO)}
                className={`rounded-lg p-4 text-left transition-all ${
                  selectedStatusFilter === STATUS.RESERVADO ? 'ring-2 ring-white/60' : ''
                } bg-gradient-to-br from-amber-500 to-yellow-500`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <BedDouble className="w-5 h-5 text-white" />
                  <span className="text-white font-bold text-sm">RESERVADOS</span>
                </div>
                <p className="text-3xl font-bold text-white">{stats.reservados}</p>
                <p className="text-white/80 text-xs mt-1">Próximas chegadas</p>
              </button>

              <button
                onClick={() => setSelectedStatusFilter(STATUS.LIMPEZA)}
                className={`rounded-lg p-4 text-left transition-all ${
                  selectedStatusFilter === STATUS.LIMPEZA ? 'ring-2 ring-white/60' : ''
                } bg-gradient-to-br from-sky-500 to-blue-500`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <Sparkles className="w-5 h-5 text-white" />
                  <span className="text-white font-bold text-sm">LIMPEZA</span>
                </div>
                <p className="text-3xl font-bold text-white">{stats.limpeza}</p>
                <p className="text-white/80 text-xs mt-1">Em limpeza</p>
              </button>

              <button
                onClick={() => setSelectedStatusFilter(STATUS.MANUTENCAO)}
                className={`rounded-lg p-4 text-left transition-all ${
                  selectedStatusFilter === STATUS.MANUTENCAO ? 'ring-2 ring-white/60' : ''
                } bg-gradient-to-br from-indigo-500 to-purple-600`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <Wrench className="w-5 h-5 text-white" />
                  <span className="text-white font-bold text-sm">MANUTENÇÃO</span>
                </div>
                <p className="text-3xl font-bold text-white">{stats.manutencao}</p>
                <p className="text-white/80 text-xs mt-1">Em manutenção</p>
              </button>
            </div>
          </div>
        )}

        {/* Filtros adicionais por categoria */}
        <div className={`${theme.card} backdrop-blur-xl rounded-xl border shadow-xl mb-6 p-4`}>
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
            <div>
              <h2 className={`text-lg font-bold ${theme.text}`}>Lista de Quartos</h2>
              <p className={`${theme.textSecondary} text-xs`}>
                Clique em um quarto para ver detalhes, estoque e ações.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <select
                value={selectedCategory}
                onChange={(e) =>
                  setSelectedCategory(e.target.value === 'all' ? 'all' : parseInt(e.target.value, 10))
                }
                className={`px-3 py-2 ${theme.input} rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 border-2`}
              >
                <option value="all">Todas categorias</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.nome}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap gap-1">
              <select
                value={selectedCategory}
                onChange={(e) =>
                  setSelectedCategory(e.target.value === 'all' ? 'all' : parseInt(e.target.value, 10))
                }
                className={`px-3 py-2 ${theme.input} rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 border-2`}
              >
                <option value="all">Tipo de ocupação</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.nome}
                  </option>
                ))}
              </select>
            </div>

          </div>
        </div>

        {/* Cards por categoria */}
        <div className="space-y-4">
          {roomsByCategory.map((cat) => (
            <div key={cat.id} className={`${theme.card} rounded-xl border shadow-xl overflow-hidden`}>
              <div
                className={`px-4 py-3 flex items-center justify-between border-b ${theme.divider} cursor-pointer ${theme.cardHover} transition-colors`}
                onClick={() => toggleCategoryCollapse(cat.id)}
              >
                <div className="flex items-center gap-3">
                  <ChevronDown
                    className={`w-4 h-4 text-violet-400 transition-transform duration-200 ${
                      collapsedCategories[cat.id] ? '-rotate-90' : ''
                    }`}
                  />
                  <span className={`${theme.text} font-bold text-sm`}>{cat.nome}</span>
                  <span className={`${theme.textSecondary} text-xs`}>
                    ({cat.rooms.length} {cat.rooms.length === 1 ? 'quarto' : 'quartos'})
                  </span>
                </div>
                <span className={`${theme.textSecondary} text-xs hidden sm:inline`}>
                  {cat.descricao}
                </span>
              </div>

              {!collapsedCategories[cat.id] && (
                <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {cat.rooms.map((room) => {
                    const lowStock = hasLowStock(room.estoqueItens);
                    const stTheme = statusTheme(room.status);
                    return (
                      <div
                        key={room.numero}
                        onClick={() => openDetails(room)}
                        className={`${theme.card} rounded-xl border p-4 cursor-pointer transition-all duration-200 hover:scale-[1.02] ${theme.cardHover} group ${stTheme.bg}`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <BedDouble className={`w-4 h-4 ${stTheme.icon}`} />
                            <span className="text-xs uppercase tracking-wide text-slate-400">
                              Quarto
                            </span>
                          </div>
                          <span
                            className={`px-3 py-1 rounded-full text-[10px] font-semibold ${statusPillColor(
                              room.status,
                            )}`}
                          >
                            {room.status}
                          </span>
                        </div>

                        <div className="mb-2">
                          <span
                            className={`block text-3xl font-extrabold drop-shadow-sm ${stTheme.number}`}
                          >
                            {formatRoomNumber(room.numero)}
                          </span>
                        </div>

                        {renderRoomCardContent(room)}

                        {room.status === STATUS.DISPONIVEL && lowStock && (
                          <div className="mt-2 flex items-center gap-2 text-[11px] text-amber-400">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>Poucos itens disponíveis neste quarto.</span>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {cat.rooms.length === 0 && (
                    <div className={`${theme.textSecondary} text-xs italic`}>
                      Nenhum quarto nesta categoria com os filtros atuais.
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Modal detalhes do quarto */}
      {showDetailsModal && selectedRoom && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`${theme.card} rounded-xl border shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto`}>
            <div className={`p-4 border-b ${theme.divider} flex items-center justify-between`}>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-violet-500/20 flex items-center justify-center">
                  <span className="text-2xl font-extrabold text-violet-400">
                    {formatRoomNumber(selectedRoom.numero)}
                  </span>
                </div>
                <div>
                  <h3 className={`text-lg font-bold ${theme.text}`}>
                    Quarto {formatRoomNumber(selectedRoom.numero)}
                  </h3>
                  <p className={`text-xs ${theme.textSecondary}`}>
                    Categoria:{' '}
                    {categories.find((c) => c.id === selectedRoom.categoriaId)?.nome || 'N/A'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowDetailsModal(false)}
                className={`${theme.textSecondary} hover:${theme.text} transition-transform duration-200 hover:scale-110 active:scale-90`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <span className={`text-xs ${theme.textSecondary} uppercase tracking-wide block mb-1`}>
                    Status atual
                  </span>
                  <span
                    className={`inline-flex items-center px-3 py-1 rounded-full text-[11px] font-semibold ${statusPillColor(
                      selectedRoom.status,
                    )}`}
                  >
                    {selectedRoom.status}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2 justify-end">
                  {permissions.acionarLimpeza && (
                    <button
                      onClick={() => handleCallCleaning(selectedRoom)}
                      className={`px-3 py-1.5 text-xs rounded-lg border ${theme.button} ${theme.text} flex items-center gap-1 hover:scale-105 active:scale-95`}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Limpeza
                    </button>
                  )}
                  {permissions.acionarManutencao && (
                    <button
                      onClick={() => handleCallMaintenance(selectedRoom)}
                      className={`px-3 py-1.5 text-xs rounded-lg border ${theme.button} ${theme.text} flex items-center gap-1 hover:scale-105 active:scale-95`}
                    >
                      <Wrench className="w-3.5 h-3.5" />
                      Manutenção
                    </button>
                  )}
                  {permissions.editarQuarto && (
                    <button
                      onClick={() =>
                        showNotification('Ação de editar quarto (implementar formulário).', 'info')
                      }
                      className={`px-3 py-1.5 text-xs rounded-lg border ${theme.button} ${theme.text} flex items-center gap-1 hover:scale-105 active:scale-95`}
                    >
                      <Edit className="w-3.5 h-3.5" />
                      Editar
                    </button>
                  )}
                </div>
              </div>

              {/* Descrição e configuração */}
              <div>
                <h4 className={`text-sm font-bold ${theme.text} mb-2`}>Descrição</h4>
                <p className={`${theme.textSecondary} text-sm`}>{selectedRoom.descricao}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className={`text-xs ${theme.textSecondary} uppercase tracking-wide block mb-1`}>
                    Tipo de ocupação
                  </span>
                  <span className={`${theme.text} font-bold`}>{selectedRoom.tipoOcupacao}</span>
                </div>
                <div>
                  <span className={`text-xs ${theme.textSecondary} uppercase tracking-wide block mb-1`}>
                    Configuração de camas
                  </span>
                  <ul className={`text-xs ${theme.text}`}>
                    {selectedRoom.camas.casal > 0 && (
                      <li>- Cama casal x{selectedRoom.camas.casal}</li>
                    )}
                    {selectedRoom.camas.solteiro > 0 && (
                      <li>- Cama solteiro x{selectedRoom.camas.solteiro}</li>
                    )}
                    {selectedRoom.camas.beliche > 0 && (
                      <li>- Beliche x{selectedRoom.camas.beliche}</li>
                    )}
                    {selectedRoom.camas.rede > 0 && (
                      <li>- Rede x{selectedRoom.camas.rede}</li>
                    )}
                  </ul>
                </div>
              </div>

              {/* Estoque em lista */}
              <div className={`p-3 rounded-lg ${theme.card} border`}>
                <span className={`text-xs ${theme.textSecondary} uppercase tracking-wide block mb-2`}>
                  Estoque de itens do quarto
                </span>
                {selectedRoom.estoqueItens ? (
                  <ul className={`text-xs ${theme.text} space-y-1`}>
                    <li>• Toalhas: {selectedRoom.estoqueItens.toalhas}</li>
                    <li>• Travesseiros: {selectedRoom.estoqueItens.travesseiros}</li>
                    <li>• Amenities: {selectedRoom.estoqueItens.amenities}</li>
                  </ul>
                ) : (
                  <span className={`${theme.textSecondary} text-xs`}>Sem itens cadastrados.</span>
                )}
              </div>

              {/* Blocos específicos por status */}
              {(selectedRoom.status === STATUS.OCUPADO ||
                selectedRoom.status === STATUS.RESERVADO) &&
                selectedRoom.hospede && (
                  <>
                    <div>
                      <h4 className={`text-sm font-bold ${theme.text} mb-2`}>Hóspede</h4>
                      <div className="flex items-center gap-2 text-sm">
                        <User className="w-4 h-4 text-violet-400" />
                        <span className={`${theme.text} font-semibold`}>
                          {selectedRoom.hospede.nome}
                        </span>
                      </div>
                      <p className={`${theme.textSecondary} text-xs mt-1`}>
                        Categoria: {selectedRoom.hospede.categoriaReserva}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div className="flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-emerald-400" />
                        <div>
                          <div className={theme.textSecondary}>Check-in</div>
                          <div className={theme.text}>{selectedRoom.hospede.checkin}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-rose-400" />
                        <div>
                          <div className={theme.textSecondary}>Check-out</div>
                          <div className={theme.text}>{selectedRoom.hospede.checkout}</div>
                        </div>
                      </div>
                    </div>
                  </>
                )}

              {selectedRoom.status === STATUS.LIMPEZA && (
                <div className="space-y-3 text-sm">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-sky-400" />
                    <span className={`${theme.text} font-semibold`}>
                      Em limpeza por{' '}
                      {selectedRoom.limpeza?.funcionario || 'não atribuído'}
                    </span>
                  </div>
                  {selectedRoom.limpeza && (
                    <div className="flex items-center gap-2 text-xs">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span className={theme.textSecondary}>
                        Início: {selectedRoom.limpeza.inicio}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {(selectedRoom.status === STATUS.MANUTENCAO ||
                selectedRoom.status === STATUS.FORA_DE_SERVICO) && (
                <div className="space-y-3 text-sm">
                  <div className="flex items-center gap-2">
                    <Wrench className="w-4 h-4 text-indigo-400" />
                    <span className={`${theme.text} font-semibold`}>
                      Em manutenção por{' '}
                      {selectedRoom.manutencao?.responsavel || 'não atribuído'}
                    </span>
                  </div>
                  {selectedRoom.manutencao && (
                    <div className="flex items-center gap-2 text-xs">
                      <Info className="w-3.5 h-3.5 text-slate-400" />
                      <span className={theme.textSecondary}>
                        {selectedRoom.manutencao.descricao}
                      </span>
                    </div>
                  )}
                </div>
              )}

                           {/* Alterar status (respeitando regras) */}
              {permissions.alterarStatus && (
                <div>
                  <span className={`text-xs ${theme.textSecondary} uppercase tracking-wide block mb-2`}>
                    Alterar status
                  </span>
                  <select
                    onChange={(e) => {
                      const newStatus = e.target.value;
                      if (!newStatus) return;
                      handleChangeStatus(selectedRoom, newStatus);
                      e.target.value = '';
                    }}
                    defaultValue=""
                    className={`px-3 py-2 ${theme.input} rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-violet-500 border-2`}
                  >
                    <option value="">Selecione um status...</option>
                    {Object.values(STATUS).map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className={`p-4 border-t ${theme.divider} flex justify-end`}>
              <button
                onClick={() => setShowDetailsModal(false)}
                className={`px-4 py-2 ${theme.button} ${theme.text} rounded-lg border transition-all duration-200 text-sm font-medium hover:scale-105 active:scale-95`}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de atribuição de funcionário (limpeza / manutenção) */}
      {showAssignModal && assignContext && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`${theme.card} rounded-xl border shadow-2xl max-w-md w-full`}>
            <div className={`p-4 border-b ${theme.divider} flex items-center justify-between`}>
              <div className="flex items-center gap-2">
                {assignContext.type === 'LIMPEZA' ? (
                  <Sparkles className="w-5 h-5 text-sky-400" />
                ) : (
                  <Wrench className="w-5 h-5 text-indigo-400" />
                )}
                <h3 className={`text-lg font-bold ${theme.text}`}>
                  {assignContext.type === 'LIMPEZA' ? 'Designar limpeza' : 'Designar manutenção'}
                </h3>
              </div>
              <button
                onClick={() => {
                  setShowAssignModal(false);
                  setAssignContext(null);
                }}
                className={`${theme.textSecondary} hover:${theme.text} transition-transform duration-200 hover:scale-110 active:scale-90`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className={`${theme.textSecondary} text-sm`}>
                Selecione o funcionário para o quarto{' '}
                <span className={theme.text}>
                  {formatRoomNumber(assignContext.room.numero)}
                </span>.
              </p>

              <ul className="space-y-2">
                {funcionarios.map((f) => (
                  <li key={f.id}>
                    <button
                      onClick={() => handleAssignFuncionario(f.id)}
                      className={`w-full text-left px-3 py-2 rounded-lg border ${theme.button} ${theme.text} flex items-center justify-between text-sm hover:scale-105 active:scale-95`}
                    >
                      <span>{f.nome}</span>
                      <Check className="w-4 h-4 text-emerald-400 opacity-70" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div className={`p-4 border-t ${theme.divider}`}>
              <button
                onClick={() => {
                  setShowAssignModal(false);
                  setAssignContext(null);
                }}
                className={`w-full px-4 py-2 ${theme.button} ${theme.text} rounded-lg border transition-all duration-200 text-sm font-medium hover:scale-105 active:scale-95`}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

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
            <div className="w-2 h-2 rounded-full bg-white animate-pulse"></div>
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

