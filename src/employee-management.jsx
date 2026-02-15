import React, { useState } from 'react';
import { Users, Search, Plus, X, Edit, Trash2, Sun, Moon, UserCheck, UserX, Mail, Phone, MapPin, Calendar, CreditCard, Building, Upload, Camera, Eye, EyeOff, Lock } from 'lucide-react';

export default function EmployeeManagement() {
  const [searchTerm, setSearchTerm] = useState('');
  const [isDark, setIsDark] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [notification, setNotification] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [profileImage, setProfileImage] = useState(null);

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfileImage(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddEmployee = () => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setShowAddModal(false);
      setProfileImage(null);
      showNotification('Funcionário cadastrado com sucesso!');
    }, 1500);
  };

  const handleEditEmployee = () => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setShowDetailsModal(false);
      showNotification('Funcionário atualizado com sucesso!');
    }, 1000);
  };

  const handleDeleteEmployee = () => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setShowDetailsModal(false);
      showNotification('Funcionário removido com sucesso!', 'info');
    }, 1000);
  };

  const handleEmployeeClick = (employee) => {
    setSelectedEmployee(employee);
    setShowDetailsModal(true);
  };

  const employees = [
    {
      id: 127,
      nome: 'João Silva',
      cpf: '123.456.789-00',
      rg: 'MG1234567',
      email: 'joao.silva@hotel.com',
      telefone: '(31) 98765-4321',
      dataNascimento: '1990-05-15',
      idade: 34,
      sexo: 'Masculino',
      endereco: 'Rua das Flores, 123',
      bairro: 'Centro',
      municipio: 'Belo Horizonte',
      estado: 'MG',
      cep: '30000-000',
      status: 'ATIVO',
      dataCadastro: '2026-01-20',
      cargo: 'Recepcionista'
    },
    {
      id: 128,
      nome: 'Maria Santos',
      cpf: '987.654.321-00',
      rg: 'MG7654321',
      email: 'maria.santos@hotel.com',
      telefone: '(31) 98888-7777',
      dataNascimento: '1985-08-22',
      idade: 40,
      sexo: 'Feminino',
      endereco: 'Av. Principal, 456',
      bairro: 'Savassi',
      municipio: 'Belo Horizonte',
      estado: 'MG',
      cep: '30100-000',
      status: 'ATIVO',
      dataCadastro: '2025-11-10',
      cargo: 'Gerente'
    },
    {
      id: 129,
      nome: 'Carlos Oliveira',
      cpf: '456.789.123-00',
      rg: 'MG9876543',
      email: 'carlos.oliveira@hotel.com',
      telefone: '(31) 97777-6666',
      dataNascimento: '1995-03-10',
      idade: 30,
      sexo: 'Masculino',
      endereco: 'Rua dos Trabalhadores, 789',
      bairro: 'Pampulha',
      municipio: 'Belo Horizonte',
      estado: 'MG',
      cep: '30200-000',
      status: 'INATIVO',
      dataCadastro: '2024-05-15',
      cargo: 'Camareiro'
    },
    {
      id: 130,
      nome: 'Ana Paula Costa',
      cpf: '321.654.987-00',
      rg: 'MG3216549',
      email: 'ana.costa@hotel.com',
      telefone: '(31) 96666-5555',
      dataNascimento: '1988-12-05',
      idade: 37,
      sexo: 'Feminino',
      endereco: 'Rua das Acácias, 321',
      bairro: 'Funcionários',
      municipio: 'Belo Horizonte',
      estado: 'MG',
      cep: '30300-000',
      status: 'ATIVO',
      dataCadastro: '2025-03-20',
      cargo: 'Cozinheira'
    }
  ];

  const stats = {
    total: employees.length,
    ativos: employees.filter(e => e.status === 'ATIVO').length,
    inativos: employees.filter(e => e.status === 'INATIVO').length
  };

  const filteredEmployees = employees.filter(emp => {
    const matchesSearch = emp.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         emp.cpf.includes(searchTerm) ||
                         emp.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || 
                         (filterStatus === 'active' && emp.status === 'ATIVO') ||
                         (filterStatus === 'inactive' && emp.status === 'INATIVO');
    return matchesSearch && matchesStatus;
  });

  const theme = {
    bg: isDark ? 'bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950' : 'bg-gradient-to-br from-slate-50 via-white to-slate-100',
    bgOverlay: isDark ? 'bg-[radial-gradient(circle_at_50%_120%,rgba(120,119,198,0.15),rgba(255,255,255,0))]' : 'bg-[radial-gradient(circle_at_50%_120%,rgba(120,119,198,0.1),rgba(255,255,255,0))]',
    text: isDark ? 'text-white' : 'text-slate-900',
    textSecondary: isDark ? 'text-slate-400' : 'text-slate-600',
    card: isDark ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200',
    cardHover: isDark ? 'hover:bg-white/10' : 'hover:bg-slate-50',
    input: isDark ? 'bg-white/10 border-white/20 text-white placeholder-slate-400' : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-500',
    tableHeader: isDark ? 'bg-white/5' : 'bg-slate-100',
    divider: isDark ? 'border-white/10' : 'border-slate-200',
    rowHover: isDark ? 'hover:bg-violet-500/20 hover:shadow-[0_0_20px_rgba(139,92,246,0.3)] hover:-translate-y-0.5 hover:border-l-4 hover:border-violet-500' : 'hover:bg-violet-100 hover:shadow-[0_4px_12px_rgba(139,92,246,0.2)] hover:-translate-y-0.5 hover:border-l-4 hover:border-violet-500',
    button: isDark ? 'bg-white/10 hover:bg-white/20 border-white/10' : 'bg-slate-100 hover:bg-slate-200 border-slate-300',
  };

  return (
    <div className={`min-h-screen ${theme.bg}`}>
      <div className={`absolute inset-0 ${theme.bgOverlay}`}></div>
      
      <div className="relative max-w-[1600px] mx-auto p-4 sm:p-8">
        <header className="mb-6 pt-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className={`text-3xl font-bold ${theme.text} mb-1 tracking-tight`}>
                Funcionários
              </h1>
              <p className={`${theme.textSecondary} text-sm flex items-center gap-2`}>
                <Users className="w-3.5 h-3.5" />
                Gerenciamento de Equipe
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

        <div className={`${theme.card} backdrop-blur-xl rounded-xl p-4 mb-6 border shadow-xl`}>
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-4 h-4 text-violet-500" />
            <h2 className={`text-sm font-bold ${theme.text} uppercase tracking-wider`}>Estatísticas</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-blue-500 to-cyan-600 rounded-lg p-4 shadow-lg">
              <div className="flex items-center gap-3 mb-2">
                <Users className="w-5 h-5 text-white" />
                <span className="text-white font-bold text-sm">TOTAL</span>
              </div>
              <p className="text-4xl font-bold text-white">{stats.total}</p>
              <p className="text-white/80 text-xs mt-1">Funcionários cadastrados</p>
            </div>

            <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg p-4 shadow-lg">
              <div className="flex items-center gap-3 mb-2">
                <UserCheck className="w-5 h-5 text-white" />
                <span className="text-white font-bold text-sm">ATIVOS</span>
              </div>
              <p className="text-4xl font-bold text-white">{stats.ativos}</p>
              <p className="text-white/80 text-xs mt-1">Funcionários ativos</p>
            </div>

            <div className="bg-gradient-to-br from-slate-500 to-slate-600 rounded-lg p-4 shadow-lg">
              <div className="flex items-center gap-3 mb-2">
                <UserX className="w-5 h-5 text-white" />
                <span className="text-white font-bold text-sm">INATIVOS</span>
              </div>
              <p className="text-4xl font-bold text-white">{stats.inativos}</p>
              <p className="text-white/80 text-xs mt-1">Funcionários inativos</p>
            </div>
          </div>
        </div>

        <div className={`${theme.card} backdrop-blur-xl rounded-xl border shadow-xl overflow-hidden`}>
          <div className={`p-4 border-b ${theme.divider}`}>
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
              <h2 className={`text-lg font-bold ${theme.text}`}>Lista de Funcionários</h2>
              <div className="flex gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:flex-initial">
                  <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 ${theme.textSecondary}`} />
                  <input
                    type="text"
                    placeholder="Buscar por nome, CPF ou email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className={`w-full sm:w-64 pl-9 pr-3 py-2 ${theme.input} rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent border-2`}
                  />
                </div>
                
                <button
                  onClick={() => setShowAddModal(true)}
                  className="px-3 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-all duration-200 flex items-center gap-2 text-sm font-medium hover:scale-105 active:scale-95 hover:shadow-lg hover:shadow-violet-500/50"
                >
                  <Plus className="w-4 h-4" />
                  Adicionar
                </button>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className={`border-b ${theme.divider} ${theme.tableHeader}`}>
                  <th className={`text-left p-3 ${theme.textSecondary} font-semibold text-[10px] uppercase tracking-wider`}>Nome</th>
                  <th className={`text-left p-3 ${theme.textSecondary} font-semibold text-[10px] uppercase tracking-wider`}>CPF</th>
                  <th className={`text-left p-3 ${theme.textSecondary} font-semibold text-[10px] uppercase tracking-wider`}>Email</th>
                  <th className={`text-left p-3 ${theme.textSecondary} font-semibold text-[10px] uppercase tracking-wider`}>Telefone</th>
                  <th className={`text-left p-3 ${theme.textSecondary} font-semibold text-[10px] uppercase tracking-wider`}>Cargo</th>
                  <th className={`text-center p-3 ${theme.textSecondary} font-semibold text-[10px] uppercase tracking-wider`}>Status</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${theme.divider}`}>
                {filteredEmployees.map((employee, index) => (
                  <tr 
                    key={employee.id}
                    onClick={() => handleEmployeeClick(employee)}
                    className={`${theme.rowHover} transition-all duration-200 group cursor-pointer`}
                    style={{ animationDelay: `${index * 30}ms` }}
                  >
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full ${employee.status === 'ATIVO' ? 'bg-emerald-500/20' : 'bg-slate-500/20'} flex items-center justify-center`}>
                          <span className={`font-bold ${employee.status === 'ATIVO' ? 'text-emerald-500' : 'text-slate-500'}`}>
                            {employee.nome.split(' ').map(n => n[0]).join('').substring(0, 2)}
                          </span>
                        </div>
                        <span className={`${theme.text} font-medium text-sm`}>{employee.nome}</span>
                      </div>
                    </td>
                    <td className="p-3">
                      <span className={`${theme.text} text-sm`}>{employee.cpf}</span>
                    </td>
                    <td className="p-3">
                      <span className={`${theme.textSecondary} text-sm`}>{employee.email}</span>
                    </td>
                    <td className="p-3">
                      <span className={`${theme.text} text-sm`}>{employee.telefone}</span>
                    </td>
                    <td className="p-3">
                      <span className={`${theme.text} text-sm font-medium`}>{employee.cargo}</span>
                    </td>
                    <td className="p-3">
                      <div className="flex justify-center">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          employee.status === 'ATIVO' 
                            ? 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/30' 
                            : 'bg-slate-500/20 text-slate-500 border border-slate-500/30'
                        }`}>
                          {employee.status}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredEmployees.length === 0 && (
            <div className="p-12 text-center">
              <div className={`${theme.textSecondary} text-base mb-1`}>Nenhum funcionário encontrado</div>
              <div className={`${theme.textSecondary} text-sm opacity-70`}>Tente ajustar os filtros de busca</div>
            </div>
          )}

          <div className={`p-3 border-t ${theme.divider} ${theme.tableHeader}`}>
            <div className={`flex justify-between items-center text-xs ${theme.textSecondary}`}>
              <span>Mostrando {filteredEmployees.length} de {employees.length} funcionários</span>
            </div>
          </div>
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`${theme.card} rounded-xl border shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto`}>
            <div className={`p-4 border-b ${theme.divider} flex items-center justify-between sticky top-0 ${theme.card} z-10`}>
              <h3 className={`text-lg font-bold ${theme.text}`}>Cadastrar Funcionário</h3>
              <button onClick={() => {
                setShowAddModal(false);
                setProfileImage(null);
              }} className={`${theme.textSecondary} hover:${theme.text} transition-transform duration-200 hover:scale-110 active:scale-90`}>
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Foto de Perfil */}
              <div className="flex justify-center">
                <div className="relative">
                  <div className={`w-32 h-32 rounded-full ${theme.card} border-2 ${theme.divider} flex items-center justify-center overflow-hidden`}>
                    {profileImage ? (
                      <img src={profileImage} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <Camera className={`w-12 h-12 ${theme.textSecondary}`} />
                    )}
                  </div>
                  <label className="absolute bottom-0 right-0 p-2 bg-violet-600 hover:bg-violet-700 text-white rounded-full cursor-pointer transition-all duration-200 hover:scale-110 active:scale-95 shadow-lg">
                    <Upload className="w-4 h-4" />
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleImageUpload}
                      className="hidden" 
                    />
                  </label>
                </div>
              </div>

              {/* Dados Pessoais */}
              <div>
                <h4 className={`text-sm font-bold ${theme.text} mb-3 uppercase tracking-wider flex items-center gap-2`}>
                  <CreditCard className="w-4 h-4 text-violet-500" />
                  Dados Pessoais
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className={`block text-sm font-medium ${theme.text} mb-2`}>CPF *</label>
                    <input
                      type="text"
                      placeholder="000.000.000-00"
                      className={`w-full px-3 py-2 ${theme.input} rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 border-2`}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className={`block text-sm font-medium ${theme.text} mb-2`}>Nome Completo *</label>
                    <input
                      type="text"
                      placeholder="Nome é obrigatório(a)"
                      className={`w-full px-3 py-2 ${theme.input} rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 border-2`}
                    />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium ${theme.text} mb-2`}>Sexo</label>
                    <select className={`w-full px-3 py-2 ${theme.input} rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 border-2`}>
                      <option value="">Selecione</option>
                      <option value="M">Masculino</option>
                      <option value="F">Feminino</option>
                    </select>
                  </div>
                  <div>
                    <label className={`block text-sm font-medium ${theme.text} mb-2`}>RG</label>
                    <input
                      type="text"
                      placeholder="00000000000-0"
                      className={`w-full px-3 py-2 ${theme.input} rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 border-2`}
                    />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium ${theme.text} mb-2`}>Data de Nascimento *</label>
                    <input
                      type="date"
                      placeholder="DD/MM/AAAA"
                      className={`w-full px-3 py-2 ${theme.input} rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 border-2`}
                    />
                  </div>
                  <div className="md:col-span-2"> 
                    <label className={`block text-sm font-medium ${theme.text} mb-2`}>Telefone *</label>
                    <input
                      type="tel"
                      placeholder="(00) 00000-0000"
                      className={`w-full px-3 py-2 ${theme.input} rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 border-2`}
                    />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium ${theme.text} mb-2`}>Email *</label>
                    <input
                      type="email"
                      placeholder="email@hospede.com"
                      className={`w-full px-3 py-2 ${theme.input} rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 border-2`}
                    />
                  </div>
                </div>
              </div>

              {/* Endereço */}
              <div>
                <h4 className={`text-sm font-bold ${theme.text} mb-3 uppercase tracking-wider flex items-center gap-2`}>
                  <MapPin className="w-4 h-4 text-violet-500" />
                  Endereço
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className={`block text-sm font-medium ${theme.text} mb-2`}>CEP *</label>
                    <input
                      type="text"
                      placeholder="00000-000"
                      className={`w-full px-3 py-2 ${theme.input} rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 border-2`}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className={`block text-sm font-medium ${theme.text} mb-2`}>Endereço *</label>
                    <input
                      type="text"
                      placeholder="Rua, Avenida, etc..."
                      className={`w-full px-3 py-2 ${theme.input} rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 border-2`}
                    />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium ${theme.text} mb-2`}>Bairro *</label>
                    <input
                      type="text"
                      placeholder="Nome do bairro"
                      className={`w-full px-3 py-2 ${theme.input} rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 border-2`}
                    />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium ${theme.text} mb-2`}>Número</label>
                    <input
                      type="text"
                      placeholder="Digite S/N se não houver número"
                      className={`w-full px-3 py-2 ${theme.input} rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 border-2`}
                    />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium ${theme.text} mb-2`}>Complemento</label>
                    <input
                      type="text"
                      placeholder="Complemento (opcional)"
                      className={`w-full px-3 py-2 ${theme.input} rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 border-2`}
                    />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium ${theme.text} mb-2`}>País *</label>
                    <select className={`w-full px-3 py-2 ${theme.input} rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 border-2`}>
                      <option value="">Selecione...</option>
                      <option value="BR">Brasil</option>
                    </select>
                  </div>
                  <div>
                    <label className={`block text-sm font-medium ${theme.text} mb-2`}>Estado *</label>
                    <select className={`w-full px-3 py-2 ${theme.input} rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 border-2`}>
                      <option value="">Selecione...</option>
                      <option value="MG">Minas Gerais</option>
                      <option value="SP">São Paulo</option>
                      <option value="RJ">Rio de Janeiro</option>
                    </select>
                  </div>
                  <div>
                    <label className={`block text-sm font-medium ${theme.text} mb-2`}>Cidade *</label>
                    <select className={`w-full px-3 py-2 ${theme.input} rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 border-2`}>
                      <option value="">Selecione...</option>
                      <option value="BH">Belo Horizonte</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Informações Profissionais */}
              

              {/* Criar Credenciais de Acesso */}
              <div>
                <h4 className={`text-sm font-bold ${theme.text} mb-3 uppercase tracking-wider flex items-center gap-2`}>
                  <Lock className="w-4 h-4 text-violet-500" />
                  Credenciais de Acesso
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-sm font-medium ${theme.text} mb-2`}>Nome de Usuário *</label>
                    <input
                      type="text"
                      placeholder="Digite o username ex: (joao.silva)"
                      className={`w-full px-3 py-2 ${theme.input} rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 border-2`}
                    />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium ${theme.text} mb-2`}>Cargo/Permissão *</label>
                    <select className={`w-full px-3 py-2 ${theme.input} rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 border-2`}>
                      <option value="">Selecione o cargo</option>
                      <option value="1">Gerente Geral</option>
                      <option value="2">Recepcionista</option>
                      <option value="3">Auxiliar Financeiro</option>
                      <option value="4">Camareira Responsável</option>
                      <option value="5">Segurança</option>
                    </select>
                  </div>
                  <div>
                    <label className={`block text-sm font-medium ${theme.text} mb-2`}>Senha *</label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        placeholder="Digite a senha"
                        className={`w-full px-3 py-2 pr-10 ${theme.input} rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 border-2`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className={`absolute right-3 top-1/2 -translate-y-1/2 ${theme.textSecondary} hover:${theme.text} transition-colors`}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className={`block text-sm font-medium ${theme.text} mb-2`}>Confirmar Senha *</label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="Confirme a senha"
                        className={`w-full px-3 py-2 pr-10 ${theme.input} rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 border-2`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className={`absolute right-3 top-1/2 -translate-y-1/2 ${theme.textSecondary} hover:${theme.text} transition-colors`}
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setProfileImage(null);
                  }}
                  className={`flex-1 px-4 py-2 ${theme.button} ${theme.text} rounded-lg border transition-all duration-200 text-sm font-medium hover:scale-105 active:scale-95`}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleAddEmployee}
                  className="flex-1 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-all duration-200 text-sm font-medium hover:scale-105 active:scale-95 hover:shadow-lg hover:shadow-violet-500/50"
                >
                  Cadastrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showDetailsModal && selectedEmployee && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`${theme.card} rounded-xl border shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto`}>
            <div className={`p-4 border-b ${theme.divider} flex items-center justify-between`}>
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-full ${selectedEmployee.status === 'ATIVO' ? 'bg-emerald-500/20' : 'bg-slate-500/20'} flex items-center justify-center`}>
                  <span className={`font-bold text-lg ${selectedEmployee.status === 'ATIVO' ? 'text-emerald-500' : 'text-slate-500'}`}>
                    {selectedEmployee.nome.split(' ').map(n => n[0]).join('').substring(0, 2)}
                  </span>
                </div>
                <div>
                  <h3 className={`text-lg font-bold ${theme.text}`}>{selectedEmployee.nome}</h3>
                  <p className={`text-sm ${theme.textSecondary}`}>{selectedEmployee.cargo}</p>
                </div>
              </div>
              <button onClick={() => setShowDetailsModal(false)} className={`${theme.textSecondary} hover:${theme.text} transition-transform duration-200 hover:scale-110 active:scale-90`}>
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              <div className={`p-4 rounded-lg ${selectedEmployee.status === 'ATIVO' ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-slate-500/10 border border-slate-500/20'}`}>
                <div className="flex items-center justify-between">
                  <span className={`text-sm ${theme.textSecondary}`}>Status</span>
                  <span className={`px-4 py-2 rounded-full text-sm font-bold ${
                    selectedEmployee.status === 'ATIVO' 
                      ? 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/30' 
                      : 'bg-slate-500/20 text-slate-500 border border-slate-500/30'
                  }`}>
                    {selectedEmployee.status}
                  </span>
                </div>
              </div>

              <div>
                <h4 className={`text-sm font-bold ${theme.text} mb-3 uppercase tracking-wider flex items-center gap-2`}>
                  <CreditCard className="w-4 h-4 text-violet-500" />
                  Dados Pessoais
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={`text-xs ${theme.textSecondary} uppercase tracking-wide mb-1 block`}>CPF</label>
                    <div className={`${theme.text} font-medium`}>{selectedEmployee.cpf}</div>
                  </div>
                  <div>
                    <label className={`text-xs ${theme.textSecondary} uppercase tracking-wide mb-1 block`}>RG</label>
                    <div className={`${theme.text} font-medium`}>{selectedEmployee.rg}</div>
                  </div>
                  <div>
                    <label className={`text-xs ${theme.textSecondary} uppercase tracking-wide mb-1 block`}>Data de Nascimento</label>
                    <div className={`${theme.text} font-medium flex items-center gap-2`}>
                      <Calendar className="w-4 h-4 text-violet-500" />
                      {new Date(selectedEmployee.dataNascimento).toLocaleDateString('pt-BR')} ({selectedEmployee.idade} anos)
                    </div>
                  </div>
                  <div>
                    <label className={`text-xs ${theme.textSecondary} uppercase tracking-wide mb-1 block`}>Sexo</label>
                    <div className={`${theme.text} font-medium`}>{selectedEmployee.sexo}</div>
                  </div>
                </div>
              </div>

              <div>
                <h4 className={`text-sm font-bold ${theme.text} mb-3 uppercase tracking-wider flex items-center gap-2`}>
                  <Mail className="w-4 h-4 text-violet-500" />
                  Contato
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={`text-xs ${theme.textSecondary} uppercase tracking-wide mb-1 block`}>Email</label>
                    <div className={`${theme.text} font-medium flex items-center gap-2`}>
                      <Mail className="w-4 h-4 text-violet-500" />
                      {selectedEmployee.email}
                    </div>
                  </div>
                  <div>
                    <label className={`text-xs ${theme.textSecondary} uppercase tracking-wide mb-1 block`}>Telefone</label>
                    <div className={`${theme.text} font-medium flex items-center gap-2`}>
                      <Phone className="w-4 h-4 text-violet-500" />
                      {selectedEmployee.telefone}
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h4 className={`text-sm font-bold ${theme.text} mb-3 uppercase tracking-wider flex items-center gap-2`}>
                  <MapPin className="w-4 h-4 text-violet-500" />
                  Endereço
                </h4>
                <div className="grid grid-cols-1 gap-2">
                  <div className={`${theme.text} font-medium`}>{selectedEmployee.endereco}</div>
                  <div className={`${theme.text} font-medium`}>
                    {selectedEmployee.bairro}, {selectedEmployee.municipio} - {selectedEmployee.estado}
                  </div>
                  <div className={`${theme.text} font-medium`}>CEP: {selectedEmployee.cep}</div>
                </div>
              </div>

              <div>
                <h4 className={`text-sm font-bold ${theme.text} mb-3 uppercase tracking-wider flex items-center gap-2`}>
                  <Building className="w-4 h-4 text-violet-500" />
                  Informações Profissionais
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={`text-xs ${theme.textSecondary} uppercase tracking-wide mb-1 block`}>Cargo</label>
                    <div className={`${theme.text} font-medium`}>{selectedEmployee.cargo}</div>
                  </div>
                  <div>
                    <label className={`text-xs ${theme.textSecondary} uppercase tracking-wide mb-1 block`}>Data de Cadastro</label>
                    <div className={`${theme.text} font-medium`}>
                      {new Date(selectedEmployee.dataCadastro).toLocaleDateString('pt-BR')}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className={`p-4 border-t ${theme.divider} flex gap-2`}>
              <button
                onClick={handleEditEmployee}
                className="flex-1 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-all duration-200 text-sm font-medium flex items-center justify-center gap-2 hover:scale-105 active:scale-95 hover:shadow-lg hover:shadow-violet-500/50"
              >
                <Edit className="w-4 h-4" />
                Editar
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
          <div className={`${notification.type === 'success' ? 'bg-emerald-500' : 'bg-blue-500'} text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-3`}>
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

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
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

        tbody tr {
          animation: fadeIn 0.3s ease-out forwards;
          opacity: 0;
        }

        select option {
          background: ${isDark ? '#1e293b' : '#ffffff'};
          color: ${isDark ? 'white' : '#0f172a'};
        }

        .scrollbar-thin::-webkit-scrollbar {
          height: 6px;
        }

        .scrollbar-thin::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 3px;
        }

        .scrollbar-thin::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.2);
          border-radius: 3px;
        }

        .scrollbar-thin::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.3);
        }
      `}</style>
    </div>
  );
}
