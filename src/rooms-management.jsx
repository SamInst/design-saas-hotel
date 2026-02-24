// import React, { useState } from 'react';
// import {
//   BedDouble, Sun, Moon, Shield, Check, Users, AlertTriangle,
//   Calendar, ChevronDown, Info, Wrench, User, KeyRound, Clock,
//   Sparkles, X, Plus, Edit, DollarSign, Search,
// } from 'lucide-react';

// function formatRoomNumber(num) {
//   return num < 10 ? `0${num}` : `${num}`;
// }

// const OCUPACAO_TIPOS = [
//   'Individual', 'Casal', 'Duplo', 'Triplo', 'Quádruplo', 'Quíntuplo', 'Sêxtuplo',
// ];

// export default function RoomsManagement() {
//   const [isDark, setIsDark]                               = useState(true);
//   const [selectedCategory, setSelectedCategory]           = useState('all');
//   const [selectedStatusFilter, setSelectedStatusFilter]   = useState('all');
//   const [searchTerm, setSearchTerm]                       = useState('');
//   const [showPermissionsModal, setShowPermissionsModal]   = useState(false);
//   const [showDetailsModal, setShowDetailsModal]           = useState(false);
//   const [showAddCategoryModal, setShowAddCategoryModal]   = useState(false);
//   const [showAddRoomModal, setShowAddRoomModal]           = useState(false);
//   const [selectedRoom, setSelectedRoom]                   = useState(null);
//   const [notification, setNotification]                   = useState(null);
//   const [collapsedCategories, setCollapsedCategories]     = useState({});
//   const [showAssignModal, setShowAssignModal]             = useState(false);
//   const [assignContext, setAssignContext]                 = useState(null);

//   const [permissions, setPermissions] = useState({
//     adicionarQuarto: true,
//     editarQuarto: true,
//     dashboard: true,
//     acionarLimpeza: true,
//     acionarManutencao: true,
//     alterarStatus: true,
//   });

//   const funcionarios = [
//     { id: 1, nome: 'Ana Paula (Camareira)' },
//     { id: 2, nome: 'Carlos Oliveira (Manutenção)' },
//     { id: 3, nome: 'João Silva (Camareira)' },
//     { id: 4, nome: 'Marcos Souza (Manutenção)' },
//   ];

//   const showNotification = (message, type = 'info') => {
//     setNotification({ message, type });
//     setTimeout(() => setNotification(null), 3000);
//   };

//   const togglePermission = (key) => setPermissions((p) => ({ ...p, [key]: !p[key] }));
//   const toggleCategoryCollapse = (id) => setCollapsedCategories((p) => ({ ...p, [id]: !p[id] }));

//   const categories = [
//     { id: 1, nome: 'Standard', descricao: 'Quartos simples, confortáveis para estadias curtas.', icone: '🛏️' },
//     { id: 2, nome: 'Luxo',     descricao: 'Quartos amplos com mais conforto e comodidades.',     icone: '✨' },
//     { id: 3, nome: 'Suíte',   descricao: 'Suítes completas com sala de estar e serviços extras.',icone: '👑' },
//   ];

//   const STATUS = {
//     DISPONIVEL:     'DISPONÍVEL',
//     OCUPADO:        'OCUPADO',
//     RESERVADO:      'RESERVADO',
//     LIMPEZA:        'LIMPEZA',
//     MANUTENCAO:     'MANUTENÇÃO',
//     FORA_DE_SERVICO:'FORA DE SERVIÇO',
//   };

//   const baseRooms = [
//     { numero: 1,  categoriaId: 1, descricao: 'Quarto Standard com cama de casal.',          tipoOcupacao: 'Casal',      camas: { casal:1, solteiro:0, beliche:0, rede:0 }, status: STATUS.DISPONIVEL,      estoqueItens: { toalhas:4,  travesseiros:2, amenities:3 } },
//     { numero: 2,  categoriaId: 1, descricao: 'Quarto Standard com duas camas de solteiro.',  tipoOcupacao: 'Duplo',      camas: { casal:0, solteiro:2, beliche:0, rede:0 }, status: STATUS.DISPONIVEL,      estoqueItens: { toalhas:2,  travesseiros:2, amenities:1 } },
//     { numero: 3,  categoriaId: 1, descricao: 'Quarto Standard econômico.',                   tipoOcupacao: 'Individual',  camas: { casal:0, solteiro:1, beliche:0, rede:0 }, status: STATUS.OCUPADO,         estoqueItens: { toalhas:1,  travesseiros:1, amenities:1 }, hospede: { nome:'João Silva', checkin:'15/02/2026 14:00', checkout:'17/02/2026 12:00', categoriaReserva:'Standard' } },
//     { numero: 4,  categoriaId: 1, descricao: 'Quarto Standard com beliche.',                 tipoOcupacao: 'Triplo',     camas: { casal:0, solteiro:1, beliche:1, rede:0 }, status: STATUS.RESERVADO,       estoqueItens: { toalhas:3,  travesseiros:3, amenities:2 }, hospede: { nome:'Maria Santos', checkin:'18/02/2026 15:00', checkout:'20/02/2026 11:00', categoriaReserva:'Standard' } },
//     { numero: 5,  categoriaId: 1, descricao: 'Quarto Standard aguardando limpeza.',          tipoOcupacao: 'Casal',      camas: { casal:1, solteiro:0, beliche:0, rede:0 }, status: STATUS.LIMPEZA,         estoqueItens: { toalhas:0,  travesseiros:1, amenities:0 }, limpeza: { funcionario:'Ana Paula', inicio:'16/02/2026 10:30' } },
//     { numero: 6,  categoriaId: 1, descricao: 'Quarto Standard em manutenção elétrica.',      tipoOcupacao: 'Casal',      camas: { casal:1, solteiro:0, beliche:0, rede:0 }, status: STATUS.MANUTENCAO,      estoqueItens: { toalhas:2,  travesseiros:2, amenities:2 }, manutencao: { responsavel:'Carlos Oliveira', descricao:'Troca de lâmpadas e revisão de tomadas.', inicio:'16/02/2026 09:00', fim:'17/02/2026 17:00' } },
//     { numero: 7,  categoriaId: 1, descricao: 'Quarto Standard com rede adicional.',          tipoOcupacao: 'Triplo',     camas: { casal:1, solteiro:0, beliche:0, rede:1 }, status: STATUS.DISPONIVEL,      estoqueItens: { toalhas:3,  travesseiros:3, amenities:3 } },
//     { numero: 8,  categoriaId: 1, descricao: 'Quarto Standard com vista interna.',           tipoOcupacao: 'Casal',      camas: { casal:1, solteiro:0, beliche:0, rede:0 }, status: STATUS.DISPONIVEL,      estoqueItens: { toalhas:2,  travesseiros:2, amenities:1 } },
//     { numero: 9,  categoriaId: 2, descricao: 'Quarto Luxo com varanda e cama king.',         tipoOcupacao: 'Casal',      camas: { casal:1, solteiro:0, beliche:0, rede:0 }, status: STATUS.OCUPADO,         estoqueItens: { toalhas:4,  travesseiros:4, amenities:4 }, hospede: { nome:'Carlos Mendes', checkin:'14/02/2026 16:00', checkout:'19/02/2026 12:00', categoriaReserva:'Luxo' } },
//     { numero: 10, categoriaId: 2, descricao: 'Quarto Luxo com hidromassagem.',               tipoOcupacao: 'Casal',      camas: { casal:1, solteiro:0, beliche:0, rede:0 }, status: STATUS.RESERVADO,       estoqueItens: { toalhas:4,  travesseiros:4, amenities:4 }, hospede: { nome:'Fernanda Costa', checkin:'20/02/2026 13:00', checkout:'22/02/2026 11:00', categoriaReserva:'Luxo' } },
//     { numero: 11, categoriaId: 2, descricao: 'Quarto Luxo com duas camas queen.',            tipoOcupacao: 'Triplo',     camas: { casal:0, solteiro:0, beliche:0, rede:0 }, status: STATUS.DISPONIVEL,      estoqueItens: { toalhas:4,  travesseiros:4, amenities:3 } },
//     { numero: 12, categoriaId: 2, descricao: 'Quarto Luxo aguardando limpeza.',              tipoOcupacao: 'Casal',      camas: { casal:1, solteiro:0, beliche:0, rede:0 }, status: STATUS.LIMPEZA,         estoqueItens: { toalhas:1,  travesseiros:2, amenities:1 }, limpeza: { funcionario:'Joana Lima', inicio:'16/02/2026 09:45' } },
//     { numero: 13, categoriaId: 2, descricao: 'Quarto Luxo em manutenção de ar condicionado.',tipoOcupacao: 'Casal',      camas: { casal:1, solteiro:0, beliche:0, rede:0 }, status: STATUS.MANUTENCAO,      estoqueItens: { toalhas:2,  travesseiros:2, amenities:2 }, manutencao: { responsavel:'Marcos Souza', descricao:'Reparo no ar condicionado.', inicio:'17/02/2026 08:00', fim:'18/02/2026 18:00' } },
//     { numero: 14, categoriaId: 2, descricao: 'Quarto Luxo com rede e vista piscina.',        tipoOcupacao: 'Triplo',     camas: { casal:1, solteiro:0, beliche:0, rede:1 }, status: STATUS.DISPONIVEL,      estoqueItens: { toalhas:3,  travesseiros:3, amenities:3 } },
//     { numero: 15, categoriaId: 2, descricao: 'Quarto Luxo desativado temporariamente.',      tipoOcupacao: 'Casal',      camas: { casal:1, solteiro:0, beliche:0, rede:0 }, status: STATUS.FORA_DE_SERVICO, estoqueItens: { toalhas:0,  travesseiros:0, amenities:0 }, manutencao: { responsavel:'Equipe Técnica', descricao:'Reforma geral do banheiro.', inicio:'15/02/2026 07:00', fim:'25/02/2026 18:00' } },
//     { numero: 16, categoriaId: 3, descricao: 'Suíte Master com sala de estar.',              tipoOcupacao: 'Quádruplo',  camas: { casal:1, solteiro:2, beliche:0, rede:0 }, status: STATUS.OCUPADO,         estoqueItens: { toalhas:6,  travesseiros:6, amenities:6 }, hospede: { nome:'Família Oliveira', checkin:'13/02/2026 15:00', checkout:'18/02/2026 11:00', categoriaReserva:'Suíte Master' } },
//     { numero: 17, categoriaId: 3, descricao: 'Suíte com hidromassagem e varanda.',           tipoOcupacao: 'Casal',      camas: { casal:1, solteiro:0, beliche:0, rede:0 }, status: STATUS.RESERVADO,       estoqueItens: { toalhas:4,  travesseiros:4, amenities:4 }, hospede: { nome:'Lucas Pereira', checkin:'21/02/2026 14:00', checkout:'24/02/2026 12:00', categoriaReserva:'Suíte Luxo' } },
//     { numero: 18, categoriaId: 3, descricao: 'Suíte com beliche e rede.',                   tipoOcupacao: 'Quádruplo',  camas: { casal:1, solteiro:0, beliche:1, rede:1 }, status: STATUS.DISPONIVEL,      estoqueItens: { toalhas:4,  travesseiros:4, amenities:2 } },
//     { numero: 19, categoriaId: 3, descricao: 'Suíte em limpeza pesada.',                    tipoOcupacao: 'Triplo',     camas: { casal:1, solteiro:1, beliche:0, rede:0 }, status: STATUS.LIMPEZA,         estoqueItens: { toalhas:1,  travesseiros:2, amenities:1 }, limpeza: { funcionario:'Pedro Lima', inicio:'16/02/2026 08:30' } },
//     { numero: 20, categoriaId: 3, descricao: 'Suíte em manutenção hidráulica.',             tipoOcupacao: 'Triplo',     camas: { casal:1, solteiro:1, beliche:0, rede:0 }, status: STATUS.MANUTENCAO,      estoqueItens: { toalhas:2,  travesseiros:2, amenities:2 }, manutencao: { responsavel:'José Almeida', descricao:'Reparo no box e torneiras.', inicio:'16/02/2026 10:00', fim:'20/02/2026 16:00' } },
//     { numero: 21, categoriaId: 3, descricao: 'Suíte com vista mar.',                        tipoOcupacao: 'Casal',      camas: { casal:1, solteiro:0, beliche:0, rede:0 }, status: STATUS.DISPONIVEL,      estoqueItens: { toalhas:4,  travesseiros:4, amenities:4 } },
//     { numero: 22, categoriaId: 3, descricao: 'Suíte familiar com dois ambientes.',          tipoOcupacao: 'Quádruplo',  camas: { casal:1, solteiro:2, beliche:0, rede:0 }, status: STATUS.DISPONIVEL,      estoqueItens: { toalhas:5,  travesseiros:5, amenities:3 } },
//   ];

//   const rooms = baseRooms;
//   const lowStockThreshold = 2;
//   const hasLowStock = (e) => e && Object.values(e).some((v) => v !== null && v !== undefined && v < lowStockThreshold);

//   const statusTheme = (s) => ({
//     [STATUS.DISPONIVEL]:     { bg:'bg-emerald-500/10', border:'border-emerald-500/20', icon:'text-emerald-400', number:'text-emerald-300' },
//     [STATUS.OCUPADO]:        { bg:'bg-rose-500/10',    border:'border-rose-500/20',    icon:'text-rose-400',    number:'text-rose-300'    },
//     [STATUS.RESERVADO]:      { bg:'bg-amber-500/10',   border:'border-amber-500/20',   icon:'text-amber-400',   number:'text-amber-300'   },
//     [STATUS.LIMPEZA]:        { bg:'bg-sky-500/10',     border:'border-sky-500/20',     icon:'text-sky-400',     number:'text-sky-300'     },
//     [STATUS.MANUTENCAO]:     { bg:'bg-indigo-500/10',  border:'border-indigo-500/20',  icon:'text-indigo-400',  number:'text-indigo-300'  },
//     [STATUS.FORA_DE_SERVICO]:{ bg:'bg-slate-500/10',   border:'border-slate-500/20',   icon:'text-slate-300',   number:'text-slate-300'   },
//   }[s] || { bg:'bg-slate-500/10', border:'border-slate-500/20', icon:'text-slate-300', number:'text-slate-300' });

//   const statusPillColor = (s) => ({
//     [STATUS.DISPONIVEL]:     'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
//     [STATUS.OCUPADO]:        'bg-rose-500/15 text-rose-400 border border-rose-500/30',
//     [STATUS.RESERVADO]:      'bg-amber-500/15 text-amber-400 border border-amber-500/30',
//     [STATUS.LIMPEZA]:        'bg-sky-500/15 text-sky-400 border border-sky-500/30',
//     [STATUS.MANUTENCAO]:     'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30',
//     [STATUS.FORA_DE_SERVICO]:'bg-slate-500/20 text-slate-300 border border-slate-500/40',
//   }[s] || 'bg-slate-500/20 text-slate-300 border border-slate-500/40');

//   const canChangeStatus = (room, newStatus) => {
//     if (!permissions.alterarStatus) return false;
//     if (room.status === STATUS.OCUPADO || room.status === STATUS.RESERVADO) return false;
//     if (room.status === STATUS.LIMPEZA || room.status === STATUS.MANUTENCAO) return newStatus === STATUS.DISPONIVEL;
//     if (room.status === STATUS.DISPONIVEL) return true;
//     if (room.status === STATUS.FORA_DE_SERVICO) return newStatus === STATUS.MANUTENCAO || newStatus === STATUS.DISPONIVEL;
//     return false;
//   };

//   const handleChangeStatus = (room, newStatus) => {
//     if (!canChangeStatus(room, newStatus)) { showNotification('Transição de status não permitida.', 'error'); return; }
//     showNotification(`Quarto ${formatRoomNumber(room.numero)} → ${newStatus}.`, 'success');
//   };

//   const handleCallCleaning    = (room) => { if (!permissions.acionarLimpeza)    { showNotification('Sem permissão.', 'error'); return; } setAssignContext({ type: 'LIMPEZA',    room }); setShowAssignModal(true); };
//   const handleCallMaintenance = (room) => { if (!permissions.acionarManutencao) { showNotification('Sem permissão.', 'error'); return; } setAssignContext({ type: 'MANUTENCAO', room }); setShowAssignModal(true); };

//   const handleAssignFuncionario = (funcId) => {
//     const func = funcionarios.find((f) => f.id === funcId);
//     if (!func || !assignContext) return;
//     showNotification(`${assignContext.type === 'LIMPEZA' ? 'Limpeza' : 'Manutenção'} do Q.${formatRoomNumber(assignContext.room.numero)} atribuída a ${func.nome}.`, 'success');
//     setShowAssignModal(false);
//     setAssignContext(null);
//   };

//   // ─── Theme ───────────────────────────────────────────────────────────────────
//   const theme = {
//     bg:            isDark ? 'bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950' : 'bg-gradient-to-br from-slate-100 via-slate-50 to-slate-200',
//     bgOverlay:     isDark ? 'bg-[radial-gradient(circle_at_50%_120%,rgba(120,119,198,0.15),transparent)]' : 'bg-[radial-gradient(circle_at_50%_120%,rgba(120,119,198,0.08),transparent)]',
//     text:          isDark ? 'text-white'          : 'text-slate-900',
//     textSecondary: isDark ? 'text-slate-400'      : 'text-slate-600',
//     card:          isDark ? 'bg-white/5 border-white/10'      : 'bg-white border-slate-200',
//     cardHover:     isDark ? 'hover:bg-white/10'   : 'hover:bg-slate-50',
//     input:         isDark ? 'bg-slate-800 border-white/15 text-white placeholder-slate-500' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400',
//     divider:       isDark ? 'border-white/10'     : 'border-slate-200',
//     button:        isDark ? 'bg-white/10 hover:bg-white/20 border-white/10' : 'bg-slate-100 hover:bg-slate-200 border-slate-300',
//     selectBg:      isDark ? 'bg-slate-800'        : 'bg-white',
//   };

//   const inputCls   = `w-full px-3 py-2 ${theme.input} rounded-lg text-sm border focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent`;
//   const selectOpt  = isDark ? '#1e293b' : '#ffffff';

//   // ─── Stats ───────────────────────────────────────────────────────────────────
//   const stats = {
//     total:      rooms.length,
//     disponiveis:rooms.filter((r) => r.status === STATUS.DISPONIVEL).length,
//     ocupados:   rooms.filter((r) => r.status === STATUS.OCUPADO).length,
//     reservados: rooms.filter((r) => r.status === STATUS.RESERVADO).length,
//     limpeza:    rooms.filter((r) => r.status === STATUS.LIMPEZA).length,
//     manutencao: rooms.filter((r) => r.status === STATUS.MANUTENCAO).length,
//   };

//   const filteredRooms = rooms.filter((r) => {
//     const catOk    = selectedCategory === 'all' || r.categoriaId === selectedCategory;
//     const statusOk = selectedStatusFilter === 'all' || r.status === selectedStatusFilter;
//     const searchOk = !searchTerm || String(r.numero).includes(searchTerm) || r.descricao.toLowerCase().includes(searchTerm.toLowerCase()) || r.tipoOcupacao.toLowerCase().includes(searchTerm.toLowerCase());
//     return catOk && statusOk && searchOk;
//   });

//   const roomsByCategory = categories.map((cat) => ({
//     ...cat,
//     rooms:       filteredRooms.filter((r) => r.categoriaId === cat.id),
//     totalRooms:  rooms.filter((r) => r.categoriaId === cat.id).length,
//     disponiveis: rooms.filter((r) => r.categoriaId === cat.id && r.status === STATUS.DISPONIVEL).length,
//     ocupados:    rooms.filter((r) => r.categoriaId === cat.id && r.status === STATUS.OCUPADO).length,
//     emServico:   rooms.filter((r) => r.categoriaId === cat.id && [STATUS.LIMPEZA, STATUS.MANUTENCAO, STATUS.FORA_DE_SERVICO].includes(r.status)).length,
//   }));

//   // ─── Card content por status ─────────────────────────────────────────────────
//   const renderRoomCardContent = (room) => {
//     if (room.status === STATUS.DISPONIVEL) return (
//       <div className="flex flex-wrap gap-1 mt-2">
//         {room.camas.casal    > 0 && <span className="px-1.5 py-0.5 rounded-full bg-violet-500/15 text-violet-300 border border-violet-500/30 text-[9px]">Casal×{room.camas.casal}</span>}
//         {room.camas.solteiro > 0 && <span className="px-1.5 py-0.5 rounded-full bg-sky-500/15 text-sky-300 border border-sky-500/30 text-[9px]">Solteiro×{room.camas.solteiro}</span>}
//         {room.camas.beliche  > 0 && <span className="px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[9px]">Beliche×{room.camas.beliche}</span>}
//         {room.camas.rede     > 0 && <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[9px]">Rede×{room.camas.rede}</span>}
//       </div>
//     );
//     if (room.status === STATUS.OCUPADO || room.status === STATUS.RESERVADO) return room.hospede ? (
//       <div className="mt-2 space-y-1">
//         <div className="flex items-center gap-1.5"><User className="w-3 h-3 text-violet-400" /><span className="text-[11px] text-white font-medium truncate">{room.hospede.nome}</span></div>
//         <div className="flex items-center gap-1.5"><Clock className="w-3 h-3 text-rose-400" /><span className="text-[9px] text-slate-400">Out: {room.hospede.checkout}</span></div>
//       </div>
//     ) : null;
//     if (room.status === STATUS.LIMPEZA) return (
//       <div className="flex items-center gap-1.5 mt-2">
//         <Sparkles className="w-3 h-3 text-sky-400 flex-shrink-0" />
//         <span className="text-[10px] text-slate-400 truncate">{room.limpeza?.funcionario || 'Não atribuído'}</span>
//       </div>
//     );
//     if (room.status === STATUS.MANUTENCAO || room.status === STATUS.FORA_DE_SERVICO) return (
//       <div className="mt-2 space-y-1">
//         <div className="flex items-center gap-1.5">
//           <Wrench className="w-3 h-3 text-indigo-400 flex-shrink-0" />
//           <span className="text-[10px] text-slate-400 truncate">{room.manutencao?.responsavel || 'Não atribuído'}</span>
//         </div>
//         {room.manutencao?.fim && (
//           <div className="flex items-center gap-1.5">
//             <Clock className="w-3 h-3 text-amber-400 flex-shrink-0" />
//             <span className="text-[9px] text-amber-300">Previsto: {room.manutencao.fim}</span>
//           </div>
//         )}
//       </div>
//     );
//     return null;
//   };

//   const openDetails = (room) => { setSelectedRoom(room); setShowDetailsModal(true); };

//   // ─── Render ──────────────────────────────────────────────────────────────────
//   return (
//     <div className={`min-h-screen relative ${theme.bg}`}>
//       <div className={`fixed inset-0 ${theme.bgOverlay} pointer-events-none`} />

//       <div className="relative max-w-[1600px] mx-auto p-4 sm:p-8">

//         {/* Header */}
//         <header className="mb-6 pt-6 flex items-center justify-between">
//           <div>
//             <h1 className={`text-3xl font-bold ${theme.text} mb-1 tracking-tight`}>Quartos</h1>
//             <p className={`${theme.textSecondary} text-sm flex items-center gap-2`}>
//               <BedDouble className="w-3.5 h-3.5" /> Gerenciamento de Quartos e Ocupação
//             </p>
//           </div>
//           <div className="flex gap-2">
//             {[
//               { label: 'Permissões', icon: <Shield className="w-4 h-4" />, action: () => setShowPermissionsModal(true) },
//               { label: isDark ? 'Light' : 'Dark', icon: isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />, action: () => setIsDark(!isDark) },
//             ].map(({ label, icon, action }) => (
//               <button key={label} onClick={action}
//                 className={`px-4 py-2 ${theme.button} ${theme.text} rounded-lg border text-sm font-medium flex items-center gap-2 hover:scale-105 active:scale-95 transition-all`}>
//                 {icon} {label}
//               </button>
//             ))}
//           </div>
//         </header>

//         {/* Dashboard */}
//         {permissions.dashboard && (
//           <div className={`${theme.card} rounded-xl p-4 mb-6 border shadow-xl`}>
//             <div className="flex items-center gap-2 mb-4">
//               <Calendar className="w-4 h-4 text-violet-500" />
//               <h2 className={`text-sm font-bold ${theme.text} uppercase tracking-wider`}>Filtros rápidos de status</h2>
//             </div>
//             <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
//               {[
//                 { label:'TODOS',       value:stats.total,       sub:'Todos os quartos',   filter:'all',              gradient:'from-slate-600 to-slate-700',   Icon:BedDouble },
//                 { label:'DISPONÍVEIS', value:stats.disponiveis, sub:'Prontos para ocupar',filter:STATUS.DISPONIVEL,  gradient:'from-emerald-600 to-teal-700',  Icon:BedDouble },
//                 { label:'OCUPADOS',    value:stats.ocupados,    sub:'Hóspedes no hotel',  filter:STATUS.OCUPADO,     gradient:'from-rose-600 to-red-700',      Icon:Users     },
//                 { label:'RESERVADOS',  value:stats.reservados,  sub:'Próximas chegadas',  filter:STATUS.RESERVADO,   gradient:'from-amber-600 to-yellow-600',  Icon:BedDouble },
//                 { label:'LIMPEZA',     value:stats.limpeza,     sub:'Em limpeza',         filter:STATUS.LIMPEZA,     gradient:'from-sky-600 to-blue-700',      Icon:Sparkles  },
//                 { label:'MANUTENÇÃO',  value:stats.manutencao,  sub:'Em manutenção',      filter:STATUS.MANUTENCAO,  gradient:'from-indigo-600 to-purple-700', Icon:Wrench    },
//               ].map(({ label, value, sub, filter, gradient, Icon }) => (
//                 <button key={label} onClick={() => setSelectedStatusFilter(filter)}
//                   className={`rounded-lg p-4 text-left transition-all bg-gradient-to-br ${gradient} ${selectedStatusFilter === filter ? 'ring-2 ring-white/60 scale-105' : 'hover:scale-105'}`}>
//                   <div className="flex items-center gap-2 mb-2"><Icon className="w-4 h-4 text-white" /><span className="text-white font-bold text-xs">{label}</span></div>
//                   <p className="text-3xl font-bold text-white">{value}</p>
//                   <p className="text-white/80 text-xs mt-1">{sub}</p>
//                 </button>
//               ))}
//             </div>
//           </div>
//         )}

//         {/* Quartos por Categoria */}
//         <div className={`${theme.card} rounded-xl border shadow-xl overflow-hidden mb-6`}>
//           {/* Header da seção com pesquisa + filtros + botões */}
//           <div className={`px-4 py-3 border-b ${theme.divider} flex flex-col sm:flex-row gap-3 sm:items-center justify-between`}>
//             <div>
//               <h2 className={`text-lg font-bold ${theme.text}`}>Quartos por Categoria</h2>
//               <p className={`${theme.textSecondary} text-xs`}>Cada categoria agrupa quartos vinculados, status e ocupação.</p>
//             </div>
//             <div className="flex flex-wrap gap-2">
//               {/* Busca */}
//               <div className="relative">
//                 <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 ${theme.textSecondary}`} />
//                 <input
//                   type="text" placeholder="Buscar quarto..."
//                   value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
//                   className={`pl-9 pr-3 py-2 w-44 ${theme.input} rounded-lg text-sm border focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent`}
//                 />
//               </div>
//               {/* Filtro por ocupação */}
//               <select
//                 value={selectedCategory}
//                 onChange={(e) => setSelectedCategory(e.target.value === 'all' ? 'all' : parseInt(e.target.value, 10))}
//                 className={`px-3 py-2 ${theme.input} rounded-lg text-sm border focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent`}
//               >
//                 <option value="all">Todas as categorias</option>
//                 {categories.map((c) => <option key={c.id} value={c.id}>{c.icone} {c.nome}</option>)}
//               </select>
              
//               {/* Novo Quarto */}
//               {permissions.adicionarQuarto && (
//                 <button onClick={() => setShowAddRoomModal(true)}
//                   className="px-3 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-medium flex items-center gap-2 hover:scale-105 active:scale-95 transition-all">
//                   <Plus className="w-4 h-4" /> Novo Quarto
//                 </button>
//               )}
//             </div>
//           </div>

//           <div className="divide-y divide-slate-700/40">
//             {roomsByCategory.map((cat) => {
//               const isCollapsed = collapsedCategories[cat.id];
//               return (
//                 <div key={cat.id}>
//                   <div onClick={() => toggleCategoryCollapse(cat.id)}
//                     className={`px-4 py-3 flex items-center justify-between cursor-pointer ${theme.cardHover} transition-colors`}>
//                     <div className="flex items-center gap-3">
//                       <ChevronDown className={`w-4 h-4 text-violet-400 transition-transform duration-200 ${isCollapsed ? '-rotate-90' : ''}`} />
//                       <div>
//                         <div className="flex items-center gap-2">
//                           <span className="text-2xl">{cat.icone}</span>
//                           <span className={`${theme.text} font-semibold text-sm`}>{cat.nome}</span>
//                           <span className="text-[11px] px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-300 border border-violet-500/30">
//                             {cat.rooms.length} {cat.rooms.length === 1 ? 'quarto' : 'quartos'}
//                           </span>
//                         </div>
//                         <p className={`${theme.textSecondary} text-xs mt-0.5`}>{cat.descricao}</p>
//                       </div>
//                     </div>
//                     <div className="hidden sm:flex items-center gap-4 text-xs">
//                       <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /><span className={theme.textSecondary}>{cat.disponiveis} disponíveis</span></div>
//                       <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-rose-500 inline-block" /><span className={theme.textSecondary}>{cat.ocupados} ocupados</span></div>
//                       <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-indigo-400 inline-block" /><span className={theme.textSecondary}>{cat.emServico} em serviço</span></div>
//                     </div>
//                   </div>

//                   {!isCollapsed && (
//                     <div className="px-4 pb-4 pt-2">
//                       <div className="flex items-center gap-2 mb-3">
//                         <BedDouble className="w-4 h-4 text-sky-400" />
//                         <span className={`${theme.text} text-xs font-semibold uppercase`}>Quartos</span>
//                       </div>
//                       {cat.rooms.length === 0 ? (
//                         <p className={`${theme.textSecondary} text-xs`}>Nenhum quarto com os filtros atuais.</p>
//                       ) : (
//                         <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2">
//                           {cat.rooms.map((room) => {
//                             const lowStock = hasLowStock(room.estoqueItens);
//                             const st = statusTheme(room.status);
//                             return (
//                               <div key={room.numero} onClick={() => openDetails(room)}
//                                 className={`relative rounded-xl border p-3 cursor-pointer transition-all duration-200 hover:scale-[1.03] ${st.bg} ${st.border}`}>
//                                 <div className="flex items-center justify-between mb-1">
//                                   <BedDouble className={`w-3.5 h-3.5 ${st.icon}`} />
//                                   {lowStock && <AlertTriangle className="w-3 h-3 text-amber-400" title="Poucos itens" />}
//                                 </div>
//                                 <span className={`block text-2xl font-extrabold leading-none mb-1 ${st.number}`}>{formatRoomNumber(room.numero)}</span>
//                                 <div className="flex items-center gap-1 flex-wrap mb-0.5">
//                                   <span className={`inline-flex px-1.5 py-0.5 rounded-full text-[9px] font-semibold ${statusPillColor(room.status)}`}>{room.status}</span>
//                                   <span className="inline-flex px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-slate-500/20 text-slate-300 border border-slate-500/30">{room.tipoOcupacao}</span>
//                                 </div>
//                                 {renderRoomCardContent(room)}
//                               </div>
//                             );
//                           })}
//                         </div>
//                       )}
//                     </div>
//                   )}
//                 </div>
//               );
//             })}
//           </div>
//         </div>
//       </div>

//       {/* ── Modal Detalhes do Quarto ── */}
//       {showDetailsModal && selectedRoom && (
//         <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
//           <div className={`${theme.card} rounded-xl border shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto`}>
//             <div className={`p-4 border-b ${theme.divider} flex items-center justify-between`}>
//               <div className="flex items-center gap-3">
//                 <div className="w-12 h-12 rounded-xl bg-violet-500/20 flex items-center justify-center">
//                   <span className="text-2xl font-extrabold text-violet-400">{formatRoomNumber(selectedRoom.numero)}</span>
//                 </div>
//                 <div>
//                   <h3 className={`text-lg font-bold ${theme.text}`}>Quarto {formatRoomNumber(selectedRoom.numero)}</h3>
//                   <p className={`text-xs ${theme.textSecondary}`}>{categories.find((c) => c.id === selectedRoom.categoriaId)?.nome}</p>
//                 </div>
//               </div>
//               <button onClick={() => setShowDetailsModal(false)} className={`${theme.textSecondary} hover:scale-110 active:scale-90 transition-transform`}><X className="w-5 h-5" /></button>
//             </div>

//             <div className="p-6 space-y-5">
//               {/* Status + ações */}
//               <div className="flex items-center justify-between flex-wrap gap-2">
//                 <span className={`inline-flex items-center px-3 py-1 rounded-full text-[11px] font-semibold ${statusPillColor(selectedRoom.status)}`}>{selectedRoom.status}</span>
//                 <div className="flex flex-wrap gap-2">
//                   {permissions.acionarLimpeza && (
//                     <button onClick={() => handleCallCleaning(selectedRoom)}
//                       className={`px-3 py-1.5 text-xs rounded-lg border ${theme.button} ${theme.text} flex items-center gap-1.5 hover:scale-105 active:scale-95 transition-all`}>
//                       <Sparkles className="w-3.5 h-3.5" /> Acionar Limpeza
//                     </button>
//                   )}
//                   {permissions.acionarManutencao && (
//                     <button onClick={() => handleCallMaintenance(selectedRoom)}
//                       className={`px-3 py-1.5 text-xs rounded-lg border ${theme.button} ${theme.text} flex items-center gap-1.5 hover:scale-105 active:scale-95 transition-all`}>
//                       <Wrench className="w-3.5 h-3.5" /> Acionar Manutenção
//                     </button>
//                   )}
//                   {permissions.editarQuarto && (
//                     <button onClick={() => showNotification('Editar quarto.', 'info')}
//                       className={`px-3 py-1.5 text-xs rounded-lg border ${theme.button} ${theme.text} flex items-center gap-1.5 hover:scale-105 active:scale-95 transition-all`}>
//                       <Edit className="w-3.5 h-3.5" /> Editar Quarto
//                     </button>
//                   )}
//                 </div>
//               </div>

//               <div>
//                 <span className={`text-xs ${theme.textSecondary} uppercase tracking-wide block mb-1`}>Descrição</span>
//                 <p className={`${theme.textSecondary} text-sm`}>{selectedRoom.descricao}</p>
//               </div>

//               <div className="grid grid-cols-2 gap-4">
//                 <div>
//                   <span className={`text-xs ${theme.textSecondary} uppercase tracking-wide block mb-1`}>Capacidade</span>
//                   <span className={`${theme.text} font-bold`}>{selectedRoom.tipoOcupacao}</span>
//                 </div>
//                 <div>
//                   <span className={`text-xs ${theme.textSecondary} uppercase tracking-wide block mb-1`}>Camas</span>
//                   <ul className={`text-xs ${theme.text} space-y-0.5`}>
//                     {selectedRoom.camas.casal    > 0 && <li>• Casal × {selectedRoom.camas.casal}</li>}
//                     {selectedRoom.camas.solteiro > 0 && <li>• Solteiro × {selectedRoom.camas.solteiro}</li>}
//                     {selectedRoom.camas.beliche  > 0 && <li>• Beliche × {selectedRoom.camas.beliche}</li>}
//                     {selectedRoom.camas.rede     > 0 && <li>• Rede × {selectedRoom.camas.rede}</li>}
//                   </ul>
//                 </div>
//               </div>

//               <div className={`p-3 rounded-lg ${theme.card} border`}>
//                 <span className={`text-xs ${theme.textSecondary} uppercase tracking-wide block mb-2`}>Estoque do quarto</span>
//                 {selectedRoom.estoqueItens ? (
//                   <ul className={`text-xs ${theme.text} space-y-1`}>
//                     <li>• Toalhas: {selectedRoom.estoqueItens.toalhas}</li>
//                     <li>• Travesseiros: {selectedRoom.estoqueItens.travesseiros}</li>
//                     <li>• Amenities: {selectedRoom.estoqueItens.amenities}</li>
//                   </ul>
//                 ) : <span className={`${theme.textSecondary} text-xs`}>Sem itens cadastrados.</span>}
//               </div>

//               {(selectedRoom.status === STATUS.OCUPADO || selectedRoom.status === STATUS.RESERVADO) && selectedRoom.hospede && (
//                 <div className={`p-3 rounded-lg ${theme.card} border space-y-2`}>
//                   <span className={`text-xs ${theme.textSecondary} uppercase tracking-wide block`}>Hóspede</span>
//                   <div className="flex items-center gap-2"><User className="w-4 h-4 text-violet-400" /><span className={`${theme.text} font-semibold text-sm`}>{selectedRoom.hospede.nome}</span></div>
//                   <div className="grid grid-cols-2 gap-3 text-xs">
//                     <div className="flex items-center gap-2"><Clock className="w-3.5 h-3.5 text-emerald-400" /><div><div className={theme.textSecondary}>Check-in</div><div className={theme.text}>{selectedRoom.hospede.checkin}</div></div></div>
//                     <div className="flex items-center gap-2"><Clock className="w-3.5 h-3.5 text-rose-400" /><div><div className={theme.textSecondary}>Check-out</div><div className={theme.text}>{selectedRoom.hospede.checkout}</div></div></div>
//                   </div>
//                 </div>
//               )}

//               {selectedRoom.status === STATUS.LIMPEZA && (
//                 <div className={`p-3 rounded-lg ${theme.card} border space-y-2`}>
//                   <span className={`text-xs ${theme.textSecondary} uppercase tracking-wide block`}>Em Limpeza</span>
//                   <div className="flex items-center gap-2"><Sparkles className="w-4 h-4 text-sky-400" /><span className={`${theme.text} font-semibold text-sm`}>{selectedRoom.limpeza?.funcionario || 'Não atribuído'}</span></div>
//                   {selectedRoom.limpeza?.inicio && <div className="flex items-center gap-2 text-xs"><Clock className="w-3.5 h-3.5 text-slate-400" /><span className={theme.textSecondary}>Início: {selectedRoom.limpeza.inicio}</span></div>}
//                 </div>
//               )}

//               {(selectedRoom.status === STATUS.MANUTENCAO || selectedRoom.status === STATUS.FORA_DE_SERVICO) && selectedRoom.manutencao && (
//                 <div className={`p-3 rounded-lg ${theme.card} border space-y-2`}>
//                   <span className={`text-xs ${theme.textSecondary} uppercase tracking-wide block`}>Em Manutenção</span>
//                   <div className="flex items-center gap-2"><Wrench className="w-4 h-4 text-indigo-400" /><span className={`${theme.text} font-semibold text-sm`}>{selectedRoom.manutencao.responsavel}</span></div>
//                   <div className="flex items-start gap-2 text-xs"><Info className="w-3.5 h-3.5 text-slate-400 mt-0.5" /><span className={theme.textSecondary}>{selectedRoom.manutencao.descricao}</span></div>
//                   <div className="grid grid-cols-2 gap-3 text-xs">
//                     {selectedRoom.manutencao.inicio && (
//                       <div className="flex items-center gap-2"><Clock className="w-3.5 h-3.5 text-emerald-400" /><div><div className={theme.textSecondary}>Início</div><div className={`${theme.text} font-medium`}>{selectedRoom.manutencao.inicio}</div></div></div>
//                     )}
//                     {selectedRoom.manutencao.fim && (
//                       <div className="flex items-center gap-2"><Clock className="w-3.5 h-3.5 text-amber-400" /><div><div className={theme.textSecondary}>Previsão de Término</div><div className="text-amber-300 font-semibold">{selectedRoom.manutencao.fim}</div></div></div>
//                     )}
//                   </div>
//                 </div>
//               )}

//               {permissions.alterarStatus && (
//                 <div>
//                   <span className={`text-xs ${theme.textSecondary} uppercase tracking-wide block mb-2`}>Alterar status</span>
//                   <select onChange={(e) => { const s = e.target.value; if (!s) return; handleChangeStatus(selectedRoom, s); e.target.value = ''; }} defaultValue=""
//                     className={`px-3 py-2 ${theme.input} rounded-lg text-sm border focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent`}>
//                     <option value="">Selecione um status...</option>
//                     {Object.values(STATUS).map((s) => <option key={s} value={s}>{s}</option>)}
//                   </select>
//                 </div>
//               )}
//             </div>

//             <div className={`p-4 border-t ${theme.divider} flex justify-end`}>
//               <button onClick={() => setShowDetailsModal(false)}
//                 className={`px-4 py-2 ${theme.button} ${theme.text} rounded-lg border text-sm font-medium hover:scale-105 active:scale-95 transition-all`}>
//                 Fechar
//               </button>
//             </div>
//           </div>
//         </div>
//       )}

//       {/* ── Modal Designar (Limpeza / Manutenção) ── */}
//       {showAssignModal && assignContext && (
//         <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
//           <div className={`${theme.card} rounded-xl border shadow-2xl max-w-md w-full`}>
//             <div className={`p-4 border-b ${theme.divider} flex items-center justify-between`}>
//               <div className="flex items-center gap-2">
//                 {assignContext.type === 'LIMPEZA' ? <Sparkles className="w-5 h-5 text-sky-400" /> : <Wrench className="w-5 h-5 text-indigo-400" />}
//                 <h3 className={`text-lg font-bold ${theme.text}`}>{assignContext.type === 'LIMPEZA' ? 'Designar Limpeza' : 'Designar Manutenção'}</h3>
//               </div>
//               <button onClick={() => { setShowAssignModal(false); setAssignContext(null); }} className={`${theme.textSecondary} hover:scale-110 active:scale-90 transition-transform`}><X className="w-5 h-5" /></button>
//             </div>

//             <div className="p-6 space-y-4">
//               <div className={`p-3 rounded-lg ${theme.card} border`}>
//                 <p className={`${theme.textSecondary} text-xs mb-1`}>Quarto</p>
//                 <p className={`${theme.text} font-bold`}>Quarto {formatRoomNumber(assignContext.room.numero)}</p>
//               </div>

//               {/* Funcionário */}
//               <div>
//                 <label className={`block text-sm font-medium ${theme.text} mb-1.5`}>Responsável *</label>
//                 <select className={inputCls}>
//                   <option value="">Selecione o funcionário...</option>
//                   {funcionarios.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
//                 </select>
//               </div>

//               {/* Campos extras para manutenção */}
//               {assignContext.type === 'MANUTENCAO' && (
//                 <>
//                   <div>
//                     <label className={`block text-sm font-medium ${theme.text} mb-1.5`}>Descrição do serviço *</label>
//                     <textarea rows={2} placeholder="Descreva o problema ou serviço a realizar..." className={`${inputCls} resize-none`} />
//                   </div>
//                   <div className="grid grid-cols-2 gap-3">
//                     <div>
//                       <label className={`block text-sm font-medium ${theme.text} mb-1.5`}>Data/Hora de Início *</label>
//                       <input type="datetime-local" className={inputCls} />
//                     </div>
//                     <div>
//                       <label className={`block text-sm font-medium ${theme.text} mb-1.5`}>Previsão de Término *</label>
//                       <input type="datetime-local" className={inputCls} />
//                     </div>
//                   </div>
//                 </>
//               )}

//               {assignContext.type === 'LIMPEZA' && (
//                 <div>
//                   <label className={`block text-sm font-medium ${theme.text} mb-1.5`}>Observações <span className={theme.textSecondary}>(opcional)</span></label>
//                   <textarea rows={2} placeholder="Ex: Limpeza pesada, trocar toda a roupa de cama..." className={`${inputCls} resize-none`} />
//                 </div>
//               )}

//               <div className="flex gap-2 pt-2">
//                 <button onClick={() => { setShowAssignModal(false); setAssignContext(null); }}
//                   className={`flex-1 px-4 py-2 ${theme.button} ${theme.text} rounded-lg border text-sm font-medium hover:scale-105 active:scale-95 transition-all`}>
//                   Cancelar
//                 </button>
//                 <button onClick={() => handleAssignFuncionario(1)}
//                   className={`flex-1 px-4 py-2 ${assignContext.type === 'LIMPEZA' ? 'bg-sky-600 hover:bg-sky-700' : 'bg-indigo-600 hover:bg-indigo-700'} text-white rounded-lg text-sm font-medium hover:scale-105 active:scale-95 transition-all`}>
//                   {assignContext.type === 'LIMPEZA' ? 'Confirmar Limpeza' : 'Confirmar Manutenção'}
//                 </button>
//               </div>
//             </div>
//           </div>
//         </div>
//       )}

//       {/* ── Modal Novo Quarto ── */}
//       {showAddRoomModal && (
//         <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
//           <div className={`${theme.card} rounded-xl border shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto`}>
//             <div className={`p-4 border-b ${theme.divider} flex items-center justify-between sticky top-0 ${theme.card} z-10`}>
//               <div className="flex items-center gap-2"><BedDouble className="w-5 h-5 text-violet-500" /><h3 className={`text-lg font-bold ${theme.text}`}>Novo Quarto</h3></div>
//               <button onClick={() => setShowAddRoomModal(false)} className={`${theme.textSecondary} hover:scale-110 active:scale-90 transition-transform`}><X className="w-5 h-5" /></button>
//             </div>
//             <div className="p-6 space-y-4">
//               <div className="grid grid-cols-2 gap-4">
//                 <div><label className={`block text-sm font-medium ${theme.text} mb-1.5`}>Número do Quarto *</label><input type="number" placeholder="Ex: 23" className={inputCls} /></div>
//                 <div>
//                   <label className={`block text-sm font-medium ${theme.text} mb-1.5`}>Categoria *</label>
//                   <select className={inputCls}>
//                     <option value="">Selecione...</option>
//                     {categories.map((c) => <option key={c.id} value={c.id}>{c.icone} {c.nome}</option>)}
//                   </select>
//                 </div>
//               </div>
              
//               <div><label className={`block text-sm font-medium ${theme.text} mb-1.5`}>Descrição</label><textarea rows={2} placeholder="Descreva o quarto..." className={`${inputCls} resize-none`} /></div>
//               <div>
//                 <label className={`block text-sm font-medium ${theme.text} mb-2`}>Camas</label>
//                 <div className="grid grid-cols-2 gap-3">
//                   {['Casal','Solteiro','Beliche','Rede'].map((tipo) => (
//                     <div key={tipo}><label className={`text-xs ${theme.textSecondary} mb-1 block`}>{tipo}</label><input type="number" placeholder="0" min="0" className={inputCls} /></div>
//                   ))}
//                 </div>
//               </div>
//               <div className="flex gap-2 pt-2">
//                 <button onClick={() => setShowAddRoomModal(false)} className={`flex-1 px-4 py-2 ${theme.button} ${theme.text} rounded-lg border text-sm font-medium hover:scale-105 active:scale-95 transition-all`}>Cancelar</button>
//                 <button onClick={() => { showNotification('Quarto cadastrado!', 'success'); setShowAddRoomModal(false); }} className="flex-1 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-medium hover:scale-105 active:scale-95 transition-all">Cadastrar Quarto</button>
//               </div>
//             </div>
//           </div>
//         </div>
//       )}

//       {/* ── Modal Permissões ── */}
//       {showPermissionsModal && (
//         <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
//           <div className={`${theme.card} rounded-xl border shadow-2xl max-w-md w-full`}>
//             <div className={`p-4 border-b ${theme.divider} flex items-center justify-between`}>
//               <div className="flex items-center gap-2"><Shield className="w-5 h-5 text-violet-500" /><h3 className={`text-lg font-bold ${theme.text}`}>Permissões de Quartos</h3></div>
//               <button onClick={() => setShowPermissionsModal(false)} className={`${theme.textSecondary} hover:scale-110 active:scale-90 transition-transform`}><X className="w-5 h-5" /></button>
//             </div>
//             <div className="p-6 space-y-2">
//               {[
//                 { key:'dashboard',          label:'📊 Dashboard',          desc:'Ver resumo geral dos quartos'      },
//                 { key:'adicionarQuarto',     label:'➕ Adicionar Quarto',   desc:'Cadastrar novos quartos'           },
//                 { key:'editarQuarto',        label:'✏️ Editar Quarto',      desc:'Alterar dados do quarto'           },
//                 { key:'acionarLimpeza',      label:'🧹 Acionar Limpeza',    desc:'Direcionar funcionário p/ limpeza' },
//                 { key:'acionarManutencao',   label:'🛠️ Acionar Manutenção', desc:'Abrir manutenção para o quarto'   },
//                 { key:'alterarStatus',       label:'🔁 Alterar Status',     desc:'Mudar status dos quartos'          },
//               ].map(({ key, label, desc }) => (
//                 <label key={key} className={`flex items-center gap-3 cursor-pointer p-2.5 rounded-lg ${theme.cardHover} transition-colors`}>
//                   <input type="checkbox" checked={permissions[key]} onChange={() => togglePermission(key)} className="w-4 h-4 rounded accent-violet-500 cursor-pointer" />
//                   <div className="flex-1">
//                     <span className={`${theme.text} font-medium text-sm block`}>{label}</span>
//                     <span className={`${theme.textSecondary} text-xs`}>{desc}</span>
//                   </div>
//                   {permissions[key] && <Check className="w-4 h-4 text-emerald-400" />}
//                 </label>
//               ))}
//             </div>
//             <div className={`p-4 border-t ${theme.divider}`}>
//               <button onClick={() => setShowPermissionsModal(false)} className="w-full px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-medium hover:scale-105 active:scale-95 transition-all">Confirmar</button>
//             </div>
//           </div>
//         </div>
//       )}

//       {/* Notificação */}
//       {notification && (
//         <div className="fixed top-4 right-4 z-[110] animate-slideIn">
//           <div className={`${notification.type === 'success' ? 'bg-emerald-500' : notification.type === 'error' ? 'bg-rose-500' : notification.type === 'warning' ? 'bg-amber-500' : 'bg-slate-700'} text-white px-6 py-3 rounded-lg flex items-center gap-3`}>
//             <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
//             <span className="font-medium text-sm">{notification.message}</span>
//           </div>
//         </div>
//       )}

//       <style jsx>{`
//         @keyframes slideIn { from { opacity:0; transform:translateX(100%); } to { opacity:1; transform:translateX(0); } }
//         .animate-slideIn   { animation: slideIn 0.3s ease-out; }
//         select option      { background: ${isDark ? '#1e293b' : '#ffffff'}; color: ${isDark ? 'white' : '#0f172a'}; }
//         input[type="datetime-local"]::-webkit-calendar-picker-indicator { filter: ${isDark ? 'invert(1)' : 'none'}; }
//       `}</style>
//     </div>
//   );
// }
