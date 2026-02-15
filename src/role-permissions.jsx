import React, { useState } from 'react';
import { Shield, Search, Plus, X, Edit, Trash2, Sun, Moon, Eye, CheckSquare, Lock } from 'lucide-react';

export default function RolePermissions() {
  const [searchTerm, setSearchTerm] = useState('');
  const [isDark, setIsDark] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedRole, setSelectedRole] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [notification, setNotification] = useState(null);
  const [isEditingPermissions, setIsEditingPermissions] = useState(false);
  
  // Estado para o novo cargo
  const [newRole, setNewRole] = useState({
    nome: '',
    descricao: '',
    nivel: 'Operacional',
    modulos: {
      dashboard: { acessoTotal: false, visualizar: false, exportar: false },
      pernoites: { acessoTotal: false, visualizar: false, criar: false, editar: false, excluir: false },
      apartamentos: { acessoTotal: false, visualizar: false, criar: false, editar: false, excluir: false },
      dayuse: { acessoTotal: false, visualizar: false, criar: false, editar: false, excluir: false },
      reservas: { acessoTotal: false, visualizar: false, criar: false, editar: false, excluir: false },
      financeiro: { acessoTotal: false, visualizar: false, criar: false, editar: false, excluir: false },
      itens: { acessoTotal: false, visualizar: false, criar: false, editar: false, excluir: false },
      cadastros: { acessoTotal: false, visualizar: false, criar: false, editar: false, excluir: false },
      precos: { acessoTotal: false, visualizar: false, criar: false, editar: false, excluir: false },
      usuarios: { acessoTotal: false, visualizar: false, criar: false, editar: false, excluir: false }
    }
  });

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const resetNewRole = () => {
    setNewRole({
      nome: '',
      descricao: '',
      nivel: 'Operacional',
      modulos: {
        dashboard: { acessoTotal: false, visualizar: false, exportar: false },
        pernoites: { acessoTotal: false, visualizar: false, criar: false, editar: false, excluir: false },
        apartamentos: { acessoTotal: false, visualizar: false, criar: false, editar: false, excluir: false },
        dayuse: { acessoTotal: false, visualizar: false, criar: false, editar: false, excluir: false },
        reservas: { acessoTotal: false, visualizar: false, criar: false, editar: false, excluir: false },
        financeiro: { acessoTotal: false, visualizar: false, criar: false, editar: false, excluir: false },
        itens: { acessoTotal: false, visualizar: false, criar: false, editar: false, excluir: false },
        cadastros: { acessoTotal: false, visualizar: false, criar: false, editar: false, excluir: false },
        precos: { acessoTotal: false, visualizar: false, criar: false, editar: false, excluir: false },
        usuarios: { acessoTotal: false, visualizar: false, criar: false, editar: false, excluir: false }
      }
    });
  };

  const handleAddRole = () => {
    if (!newRole.nome.trim()) {
      showNotification('Por favor, informe o nome do cargo', 'error');
      return;
    }
    
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setShowAddModal(false);
      resetNewRole();
      showNotification('Cargo criado com sucesso!');
    }, 1500);
  };

  const handleEditRole = () => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setIsEditingPermissions(false);
      showNotification('Permissões atualizadas com sucesso!');
    }, 1000);
  };

  const handleDeleteRole = () => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setShowEditModal(false);
      showNotification('Cargo removido com sucesso!', 'info');
    }, 1000);
  };

  const handleRoleClick = (role) => {
    setSelectedRole(role);
    setIsEditingPermissions(false);
  };

  const toggleModulePermission = (moduleName, permissionName) => {
    setNewRole(prev => {
      const updatedModulos = { ...prev.modulos };
      const module = { ...updatedModulos[moduleName] };
      
      if (permissionName === 'acessoTotal') {
        // Se ativar acesso total, ativa todas as permissões
        const allEnabled = !module.acessoTotal;
        Object.keys(module).forEach(key => {
          module[key] = allEnabled;
        });
      } else {
        // Toggle da permissão específica
        module[permissionName] = !module[permissionName];
        
        // Se desmarcar alguma permissão, desmarca acesso total
        if (!module[permissionName]) {
          module.acessoTotal = false;
        }
        
        // Se todas as permissões (exceto acessoTotal) estiverem marcadas, marca acessoTotal
        const { acessoTotal, ...otherPermissions } = module;
        if (Object.values(otherPermissions).every(v => v)) {
          module.acessoTotal = true;
        }
      }
      
      updatedModulos[moduleName] = module;
      return { ...prev, modulos: updatedModulos };
    });
  };

  const roles = [
    {
      id: 1,
      nome: 'Gerente Geral',
      nivel: 'Administrador',
      descricao: 'Acesso total ao operações, relatórios e finanças.',
      status: 'ATUAL',
      modulos: {
        dashboard: { acessoTotal: true, visualizar: true, exportar: true },
        pernoites: { acessoTotal: true, visualizar: true, criar: true, editar: true, excluir: true },
        apartamentos: { acessoTotal: true, visualizar: true, criar: true, editar: true, excluir: true },
        dayuse: { acessoTotal: true, visualizar: true, criar: true, editar: true, excluir: true },
        reservas: { acessoTotal: true, visualizar: true, criar: true, editar: true, excluir: true },
        financeiro: { acessoTotal: true, visualizar: true, criar: true, editar: true, excluir: true },
        itens: { acessoTotal: true, visualizar: true, criar: true, editar: true, excluir: true },
        cadastros: { acessoTotal: true, visualizar: true, criar: true, editar: true, excluir: true },
        precos: { acessoTotal: true, visualizar: true, criar: true, editar: true, excluir: true },
        usuarios: { acessoTotal: true, visualizar: true, criar: true, editar: true, excluir: true }
      }
    },
    {
      id: 2,
      nome: 'Recepcionista',
      nivel: 'Operacional',
      descricao: 'Gestão de check-ins, check-outs e reservas.',
      status: 'ATIVO',
      modulos: {
        dashboard: { acessoTotal: false, visualizar: true, exportar: false },
        pernoites: { acessoTotal: false, visualizar: true, criar: true, editar: true, excluir: false },
        apartamentos: { acessoTotal: false, visualizar: true, criar: false, editar: true, excluir: false },
        dayuse: { acessoTotal: false, visualizar: true, criar: true, editar: true, excluir: false },
        reservas: { acessoTotal: false, visualizar: true, criar: true, editar: true, excluir: false },
        financeiro: { acessoTotal: false, visualizar: true, criar: false, editar: false, excluir: false },
        itens: { acessoTotal: false, visualizar: true, criar: true, editar: false, excluir: false },
        cadastros: { acessoTotal: false, visualizar: true, criar: true, editar: false, excluir: false },
        precos: { acessoTotal: false, visualizar: true, criar: false, editar: false, excluir: false },
        usuarios: { acessoTotal: false, visualizar: false, criar: false, editar: false, excluir: false }
      }
    },
    {
      id: 3,
      nome: 'Auxiliar Financeiro',
      nivel: 'Operacional',
      descricao: 'Controle de caixa, faturas e pagamentos.',
      status: 'ATIVO',
      modulos: {
        dashboard: { acessoTotal: false, visualizar: true, exportar: true },
        pernoites: { acessoTotal: false, visualizar: true, criar: false, editar: false, excluir: false },
        apartamentos: { acessoTotal: false, visualizar: true, criar: false, editar: false, excluir: false },
        dayuse: { acessoTotal: false, visualizar: true, criar: false, editar: false, excluir: false },
        reservas: { acessoTotal: false, visualizar: true, criar: false, editar: false, excluir: false },
        financeiro: { acessoTotal: true, visualizar: true, criar: true, editar: true, excluir: false },
        itens: { acessoTotal: false, visualizar: true, criar: true, editar: true, excluir: false },
        cadastros: { acessoTotal: false, visualizar: true, criar: false, editar: false, excluir: false },
        precos: { acessoTotal: false, visualizar: true, criar: false, editar: true, excluir: false },
        usuarios: { acessoTotal: false, visualizar: false, criar: false, editar: false, excluir: false }
      }
    },
    {
      id: 4,
      nome: 'Camareira Responsável',
      nivel: 'Operacional',
      descricao: 'Status de limpeza e inventário de enxoval.',
      status: 'ATIVO',
      modulos: {
        dashboard: { acessoTotal: false, visualizar: false, exportar: false },
        pernoites: { acessoTotal: false, visualizar: true, criar: false, editar: false, excluir: false },
        apartamentos: { acessoTotal: false, visualizar: true, criar: false, editar: true, excluir: false },
        dayuse: { acessoTotal: false, visualizar: true, criar: false, editar: false, excluir: false },
        reservas: { acessoTotal: false, visualizar: true, criar: false, editar: false, excluir: false },
        financeiro: { acessoTotal: false, visualizar: false, criar: false, editar: false, excluir: false },
        itens: { acessoTotal: false, visualizar: true, criar: false, editar: true, excluir: false },
        cadastros: { acessoTotal: false, visualizar: true, criar: false, editar: false, excluir: false },
        precos: { acessoTotal: false, visualizar: false, criar: false, editar: false, excluir: false },
        usuarios: { acessoTotal: false, visualizar: false, criar: false, editar: false, excluir: false }
      }
    },
    {
      id: 5,
      nome: 'Segurança',
      nivel: 'Operacional',
      descricao: 'Acesso aos logs de entrada e câmeras.',
      status: 'ATIVO',
      modulos: {
        dashboard: { acessoTotal: false, visualizar: true, exportar: false },
        pernoites: { acessoTotal: false, visualizar: true, criar: false, editar: false, excluir: false },
        apartamentos: { acessoTotal: false, visualizar: true, criar: false, editar: false, excluir: false },
        dayuse: { acessoTotal: false, visualizar: true, criar: false, editar: false, excluir: false },
        reservas: { acessoTotal: false, visualizar: true, criar: false, editar: false, excluir: false },
        financeiro: { acessoTotal: false, visualizar: false, criar: false, editar: false, excluir: false },
        itens: { acessoTotal: false, visualizar: false, criar: false, editar: false, excluir: false },
        cadastros: { acessoTotal: false, visualizar: true, criar: false, editar: false, excluir: false },
        precos: { acessoTotal: false, visualizar: false, criar: false, editar: false, excluir: false },
        usuarios: { acessoTotal: false, visualizar: false, criar: false, editar: false, excluir: false }
      }
    }
  ];

  const filteredRoles = roles.filter(role =>
    role.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    role.descricao.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const theme = {
    bg: isDark ? 'bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950' : 'bg-gradient-to-br from-slate-50 via-white to-slate-100',
    bgOverlay: isDark ? 'bg-[radial-gradient(circle_at_50%_120%,rgba(120,119,198,0.15),rgba(255,255,255,0))]' : 'bg-[radial-gradient(circle_at_50%_120%,rgba(120,119,198,0.1),rgba(255,255,255,0))]',
    text: isDark ? 'text-white' : 'text-slate-900',
    textSecondary: isDark ? 'text-slate-400' : 'text-slate-600',
    card: isDark ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200',
    cardHover: isDark ? 'hover:bg-white/10' : 'hover:bg-slate-50',
    input: isDark ? 'bg-white/10 border-white/20 text-white placeholder-slate-400' : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-500',
    divider: isDark ? 'border-white/10' : 'border-slate-200',
    button: isDark ? 'bg-white/10 hover:bg-white/20 border-white/10' : 'bg-slate-100 hover:bg-slate-200 border-slate-300',
  };

  const modulesConfig = [
    { key: 'dashboard', icon: '📊', title: 'Dashboard', description: 'Visão geral de métricas e estatísticas', permissions: ['visualizar', 'exportar'] },
    { key: 'pernoites', icon: '🛏️', title: 'Pernoites', description: 'Gestão de estadias e hospedagens', permissions: ['visualizar', 'criar', 'editar', 'excluir'] },
    { key: 'apartamentos', icon: '🏠', title: 'Apartamentos', description: 'Controle de quartos e unidades', permissions: ['visualizar', 'criar', 'editar', 'excluir'] },
    { key: 'dayuse', icon: '☀️', title: 'Day Use', description: 'Reservas por período diurno', permissions: ['visualizar', 'criar', 'editar', 'excluir'] },
    { key: 'reservas', icon: '📅', title: 'Reservas', description: 'Agendamentos e pré-reservas', permissions: ['visualizar', 'criar', 'editar', 'excluir'] },
    { key: 'financeiro', icon: '💰', title: 'Financeiro', description: 'Caixa, faturas e pagamentos', permissions: ['visualizar', 'criar', 'editar', 'excluir'] },
    { key: 'itens', icon: '📦', title: 'Itens', description: 'Produtos, serviços e estoque', permissions: ['visualizar', 'criar', 'editar', 'excluir'] },
    { key: 'cadastros', icon: '👥', title: 'Cadastros', description: 'Hóspedes, funcionários e fornecedores', permissions: ['visualizar', 'criar', 'editar', 'excluir'] },
    { key: 'precos', icon: '💵', title: 'Preços', description: 'Tabelas de valores e tarifas', permissions: ['visualizar', 'criar', 'editar', 'excluir'] },
    { key: 'usuarios', icon: '👤', title: 'Usuários', description: 'Contas de acesso ao sistema', permissions: ['visualizar', 'criar', 'editar', 'excluir'] },
  ];

  const ModuleCard = ({ icon, title, description, permissions, hasAcessoTotal, theme, isEditing }) => {
    const { acessoTotal, ...otherPermissions } = permissions;
    const allEnabled = Object.values(otherPermissions).every(v => v);
    const someEnabled = Object.values(otherPermissions).some(v => v);
    const status = allEnabled ? 'Acesso Total' : someEnabled ? 'Parcial' : 'Desabilitado';
    
    const enabledPermissions = Object.entries(otherPermissions)
      .filter(([_, value]) => value)
      .map(([key]) => key);
    
    return (
      <div className={`p-4 rounded-lg ${theme.card} border`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-violet-500/20 rounded-lg">
              <span className="text-xl">{icon}</span>
            </div>
            <div>
              <h4 className={`font-bold ${theme.text} text-sm`}>{title}</h4>
              <p className={`text-xs ${theme.textSecondary}`}>{description}</p>
            </div>
          </div>
          {!isEditing && (
            <span className={`text-xs font-bold uppercase ${acessoTotal ? 'text-emerald-500' : someEnabled ? 'text-violet-500' : 'text-slate-500'}`}>
              {status}
            </span>
          )}
        </div>
        
        {isEditing ? (
          <>
            {hasAcessoTotal && (
              <div className={`mb-3 pb-3 border-b ${theme.divider}`}>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={acessoTotal} 
                    readOnly 
                    className="w-4 h-4 rounded accent-emerald-500" 
                  />
                  <span className={`text-sm font-bold ${theme.text}`}>🔓 Acesso Total</span>
                  <span className={`text-xs ${theme.textSecondary}`}>(habilita todas as permissões)</span>
                </label>
              </div>
            )}
            
            <div className="grid grid-cols-4 gap-3">
              {Object.entries(otherPermissions).map(([key, value]) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={value} 
                    readOnly 
                    className="w-4 h-4 rounded accent-violet-500" 
                  />
                  <span className={`text-xs ${theme.text} capitalize`}>
                    {key === 'visualizar' ? 'Visualizar' : 
                     key === 'criar' ? 'Criar' : 
                     key === 'editar' ? 'Editar' : 
                     key === 'excluir' ? 'Excluir' :
                     key === 'exportar' ? 'Exportar' : key}
                  </span>
                </label>
              ))}
            </div>
          </>
        ) : (
          <div className="flex flex-wrap gap-2">
            {acessoTotal ? (
              <span className="px-3 py-1.5 bg-emerald-500/20 text-emerald-500 border border-emerald-500/30 rounded-full text-xs font-semibold flex items-center gap-1">
                🔓 Acesso Total
              </span>
            ) : enabledPermissions.length > 0 ? (
              enabledPermissions.map(permission => (
                <span 
                  key={permission}
                  className="px-3 py-1.5 bg-violet-500/20 text-violet-400 border border-violet-500/30 rounded-full text-xs font-semibold capitalize"
                >
                  {permission === 'visualizar' ? '👁️ Visualizar' : 
                   permission === 'criar' ? '➕ Criar' : 
                   permission === 'editar' ? '✏️ Editar' : 
                   permission === 'excluir' ? '🗑️ Excluir' :
                   permission === 'exportar' ? '📤 Exportar' : permission}
                </span>
              ))
            ) : (
              <span className="px-3 py-1.5 bg-slate-500/20 text-slate-500 border border-slate-500/30 rounded-full text-xs font-semibold">
                🚫 Sem Acesso
              </span>
            )}
          </div>
        )}
      </div>
    );
  };

  const ModulePermissionEditor = ({ module, moduleKey, theme }) => {
    const { acessoTotal, ...otherPermissions } = newRole.modulos[moduleKey];
    const hasAnyPermission = Object.values(otherPermissions).some(v => v);
    
    return (
      <div className={`p-4 rounded-lg ${theme.card} border`}>
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-violet-500/20 rounded-lg">
            <span className="text-xl">{module.icon}</span>
          </div>
          <div className="flex-1">
            <h4 className={`font-bold ${theme.text} text-sm`}>{module.title}</h4>
            <p className={`text-xs ${theme.textSecondary}`}>{module.description}</p>
          </div>
          <span className={`text-xs font-bold uppercase ${acessoTotal ? 'text-emerald-500' : hasAnyPermission ? 'text-violet-500' : 'text-slate-500'}`}>
            {acessoTotal ? 'Total' : hasAnyPermission ? 'Parcial' : 'Desabilitado'}
          </span>
        </div>
        
        <div className={`mb-3 pb-3 border-b ${theme.divider}`}>
          <label className="flex items-center gap-2 cursor-pointer">
            <input 
              type="checkbox" 
              checked={acessoTotal}
              onChange={() => toggleModulePermission(moduleKey, 'acessoTotal')}
              className="w-4 h-4 rounded accent-emerald-500 cursor-pointer" 
            />
            <span className={`text-sm font-bold ${theme.text}`}>🔓 Acesso Total</span>
            <span className={`text-xs ${theme.textSecondary}`}>(habilita todas as permissões)</span>
          </label>
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {module.permissions.map((permission) => (
            <label key={permission} className="flex items-center gap-2 cursor-pointer">
              <input 
                type="checkbox" 
                checked={newRole.modulos[moduleKey][permission]}
                onChange={() => toggleModulePermission(moduleKey, permission)}
                className="w-4 h-4 rounded accent-violet-500 cursor-pointer" 
              />
              <span className={`text-xs ${theme.text} capitalize`}>
                {permission === 'visualizar' ? 'Visualizar' : 
                 permission === 'criar' ? 'Criar' : 
                 permission === 'editar' ? 'Editar' : 
                 permission === 'excluir' ? 'Excluir' :
                 permission === 'exportar' ? 'Exportar' : permission}
              </span>
            </label>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className={`min-h-screen ${theme.bg}`}>
      <div className={`absolute inset-0 ${theme.bgOverlay}`}></div>
      
      <div className="relative max-w-[1600px] mx-auto p-4 sm:p-8">
        <header className="mb-6 pt-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className={`text-3xl font-bold ${theme.text} mb-1 tracking-tight`}>
                Cargos e Permissões
              </h1>
              <p className={`${theme.textSecondary} text-sm flex items-center gap-2`}>
                <Shield className="w-3.5 h-3.5" />
                Controle de Acesso ao Sistema
              </p>
            </div>
            <div className="flex gap-2">
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

        <div className="flex gap-6">
          <div className="w-80 flex-shrink-0">
            <div className={`${theme.card} backdrop-blur-xl rounded-xl border shadow-xl sticky top-8`}>
              <div className={`p-4 border-b ${theme.divider}`}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className={`text-sm font-bold ${theme.text} uppercase tracking-wider`}>Cargos</h2>
                  <button
                    onClick={() => setShowAddModal(true)}
                    className="p-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-all duration-200 hover:scale-105 active:scale-95"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <div className="relative">
                  <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 ${theme.textSecondary}`} />
                  <input
                    type="text"
                    placeholder="Buscar cargos..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className={`w-full pl-9 pr-3 py-2 ${theme.input} rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 border-2`}
                  />
                </div>
              </div>

              <div className="max-h-[600px] overflow-y-auto">
                {filteredRoles.map((role) => (
                  <div
                    key={role.id}
                    onClick={() => handleRoleClick(role)}
                    className={`p-4 border-b ${theme.divider} cursor-pointer transition-all duration-200 ${theme.cardHover} ${
                      selectedRole?.id === role.id ? 'bg-violet-500/20 border-l-4 border-l-violet-500' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h3 className={`font-bold ${theme.text} text-sm`}>{role.nome}</h3>
                      {role.status === 'ATUAL' && (
                        <span className="px-2 py-0.5 bg-violet-500/20 text-violet-400 text-[10px] font-bold rounded uppercase">
                          Atual
                        </span>
                      )}
                    </div>
                    <p className={`text-xs ${theme.textSecondary} mb-2`}>{role.descricao}</p>
                    <span className={`text-[10px] ${theme.textSecondary} uppercase tracking-wider`}>
                      Nível: {role.nivel}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex-1 min-w-0">
            {selectedRole ? (
              <div className={`${theme.card} backdrop-blur-xl rounded-xl border shadow-xl`}>
                <div className={`p-6 border-b ${theme.divider}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <h2 className={`text-2xl font-bold ${theme.text}`}>{selectedRole.nome}</h2>
                        {selectedRole.status === 'ATUAL' && (
                          <span className="px-3 py-1 bg-violet-500/20 text-violet-400 text-xs font-bold rounded-full border border-violet-500/30">
                            CARGO ATUAL
                          </span>
                        )}
                      </div>
                      <p className={`${theme.textSecondary} text-sm mb-1`}>{selectedRole.descricao}</p>
                      <span className={`text-xs ${theme.textSecondary} uppercase tracking-wider`}>
                        Nível de Acesso: <span className="font-bold">{selectedRole.nivel}</span>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-6">
                  <h3 className={`text-lg font-bold ${theme.text} mb-4 flex items-center gap-2`}>
                    <Lock className="w-5 h-5 text-violet-500" />
                    MÓDULOS DO SISTEMA
                  </h3>

                  <div className="space-y-4">
                    {modulesConfig.map((module) => (
                      <ModuleCard
                        key={module.key}
                        icon={module.icon}
                        title={module.title}
                        description={module.description}
                        permissions={selectedRole.modulos[module.key]}
                        hasAcessoTotal={true}
                        theme={theme}
                        isEditing={isEditingPermissions}
                      />
                    ))}
                  </div>
                </div>

                <div className={`p-4 border-t ${theme.divider} flex gap-2`}>
                  {isEditingPermissions ? (
                    <>
                      <button
                        onClick={() => setIsEditingPermissions(false)}
                        className={`flex-1 px-4 py-2 ${theme.button} ${theme.text} rounded-lg border transition-all duration-200 text-sm font-medium hover:scale-105 active:scale-95`}
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleEditRole}
                        className="flex-1 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-all duration-200 text-sm font-medium flex items-center justify-center gap-2 hover:scale-105 active:scale-95 hover:shadow-lg hover:shadow-violet-500/50"
                      >
                        <CheckSquare className="w-4 h-4" />
                        Salvar Permissões
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setIsEditingPermissions(true)}
                      className="flex-1 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-all duration-200 text-sm font-medium flex items-center justify-center gap-2 hover:scale-105 active:scale-95 hover:shadow-lg hover:shadow-violet-500/50"
                    >
                      <Edit className="w-4 h-4" />
                      Editar Permissões
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className={`${theme.card} backdrop-blur-xl rounded-xl border shadow-xl p-12 flex flex-col items-center justify-center`}>
                <Shield className={`w-16 h-16 ${theme.textSecondary} mb-4`} />
                <h3 className={`text-xl font-bold ${theme.text} mb-2`}>Selecione um Cargo</h3>
                <p className={`${theme.textSecondary} text-center`}>
                  Clique em um cargo na lista ao lado para visualizar e editar as permissões
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className={`${theme.card} rounded-xl border shadow-2xl max-w-4xl w-full my-8`}>
            <div className={`p-4 border-b ${theme.divider} flex items-center justify-between sticky top-0 ${theme.card} z-10`}>
              <h3 className={`text-lg font-bold ${theme.text}`}>Novo Cargo</h3>
              <button 
                onClick={() => {
                  setShowAddModal(false);
                  resetNewRole();
                }} 
                className={`${theme.textSecondary} hover:${theme.text} transition-transform duration-200 hover:scale-110 active:scale-90`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium ${theme.text} mb-2`}>Nome do Cargo *</label>
                  <input
                    type="text"
                    placeholder="Ex: Supervisor"
                    value={newRole.nome}
                    onChange={(e) => setNewRole(prev => ({ ...prev, nome: e.target.value }))}
                    className={`w-full px-3 py-2 ${theme.input} rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 border-2`}
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium ${theme.text} mb-2`}>Nível de Acesso</label>
                  <select
                    value={newRole.nivel}
                    onChange={(e) => setNewRole(prev => ({ ...prev, nivel: e.target.value }))}
                    className={`w-full px-3 py-2 ${theme.input} rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 border-2`}
                  >
                    <option value="Operacional">Operacional</option>
                    <option value="Gerencial">Gerencial</option>
                    <option value="Administrador">Administrador</option>
                  </select>
                </div>
              </div>

              <div>
                <label className={`block text-sm font-medium ${theme.text} mb-2`}>Descrição das Atribuições</label>
                <textarea
                  placeholder="Descreva as responsabilidades deste cargo..."
                  value={newRole.descricao}
                  onChange={(e) => setNewRole(prev => ({ ...prev, descricao: e.target.value }))}
                  rows={3}
                  className={`w-full px-3 py-2 ${theme.input} rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none border-2`}
                />
              </div>

              <div className={`pt-4 border-t ${theme.divider}`}>
                <h4 className={`text-base font-bold ${theme.text} mb-4 flex items-center gap-2`}>
                  <Lock className="w-4 h-4 text-violet-500" />
                  Configurar Permissões dos Módulos
                </h4>
                
                <div className="space-y-4">
                  {modulesConfig.map((module) => (
                    <ModulePermissionEditor
                      key={module.key}
                      module={module}
                      moduleKey={module.key}
                      theme={theme}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className={`p-4 border-t ${theme.divider} flex gap-2 sticky bottom-0 ${theme.card}`}>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  resetNewRole();
                }}
                className={`flex-1 px-4 py-2 ${theme.button} ${theme.text} rounded-lg border transition-all duration-200 text-sm font-medium hover:scale-105 active:scale-95`}
              >
                Cancelar
              </button>
              <button
                onClick={handleAddRole}
                className="flex-1 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-all duration-200 text-sm font-medium hover:scale-105 active:scale-95 hover:shadow-lg hover:shadow-violet-500/50"
              >
                Criar Cargo
              </button>
            </div>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100]">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 border-4 border-violet-500/30 border-t-violet-500 rounded-full animate-spin"></div>
            <p className="text-white font-medium text-sm">Processando...</p>
          </div>
        </div>
      )}

      {notification && (
        <div className="fixed top-4 right-4 z-[110] animate-slideIn">
          <div className={`${notification.type === 'success' ? 'bg-emerald-500' : notification.type === 'error' ? 'bg-red-500' : 'bg-blue-500'} text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-3`}>
            <div className="w-2 h-2 rounded-full bg-white animate-pulse"></div>
            <span className="font-medium">{notification.message}</span>
          </div>
        </div>
      )}

      <style jsx>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        
        * {
          font-family: 'Inter', sans-serif;
        }

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

        select option {
          background: ${isDark ? '#1e293b' : '#ffffff'};
          color: ${isDark ? 'white' : '#0f172a'};
        }
      `}</style>
    </div>
  );
}
