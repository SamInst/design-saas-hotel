import React, { useState } from 'react';
import { Package, Search, Plus, X, Edit, Trash2, Sun, Moon, Shield, Check, ChevronDown, Calendar, DollarSign, TrendingUp, ShoppingCart, History, Tag, Boxes, Minus } from 'lucide-react';

export default function InventoryManagement() {
  const [searchTerm, setSearchTerm] = useState('');
  const [isDark, setIsDark] = useState(true);
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [showEditCategoryModal, setShowEditCategoryModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showPriceHistoryModal, setShowPriceHistoryModal] = useState(false);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [showConsumeModal, setShowConsumeModal] = useState(false);
  const [showReplenishModal, setShowReplenishModal] = useState(false);
  const [showGenericReplenishModal, setShowGenericReplenishModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [editingCategory, setEditingCategory] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [notification, setNotification] = useState(null);
  const [collapsedCategories, setCollapsedCategories] = useState({});

  const [permissions, setPermissions] = useState({
    acessoTotal: true,
    mostrarDashboard: true,
    adicionarEditarCategoria: true,
    adicionarEditarItem: true,
    reporEstoque: true,
    verHistoricoPreco: true,
    verHistoricoReposicao: true,
    consumirItem: true
  });

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const togglePermission = (key) => {
    if (key === 'acessoTotal') {
      const newValue = !permissions.acessoTotal;
      setPermissions({
        acessoTotal: newValue,
        mostrarDashboard: newValue,
        adicionarEditarCategoria: newValue,
        adicionarEditarItem: newValue,
        reporEstoque: newValue,
        verHistoricoPreco: newValue,
        verHistoricoReposicao: newValue,
        consumirItem: newValue
      });
    } else {
      setPermissions(prev => ({
        ...prev,
        [key]: !prev[key]
      }));
    }
  };

  const toggleCategoryCollapse = (category) => {
    setCollapsedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  const handleAddItem = () => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setShowAddItemModal(false);
      showNotification('Item adicionado com sucesso!');
    }, 1500);
  };

  const handleAddCategory = () => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setShowAddCategoryModal(false);
      showNotification('Categoria criada com sucesso!');
    }, 1000);
  };

  const handleEditCategory = (category) => {
    setEditingCategory(category);
    setShowEditCategoryModal(true);
  };

  const handleUpdateCategory = () => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setShowEditCategoryModal(false);
      setEditingCategory(null);
      showNotification('Categoria atualizada com sucesso!');
    }, 1000);
  };

  const handleEditItem = () => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setShowDetailsModal(false);
      showNotification('Item atualizado com sucesso!');
    }, 1000);
  };

  const handleConsumeItem = (item) => {
    setSelectedItem(item);
    setShowConsumeModal(true);
  };

  const handleConfirmConsume = () => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setShowConsumeModal(false);
      showNotification('Item consumido com sucesso!');
    }, 1000);
  };

  const handleReplenishItem = (item) => {
    setSelectedItem(item);
    setShowReplenishModal(true);
  };

  const handleConfirmReplenish = () => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setShowReplenishModal(false);
      showNotification('Estoque reposto com sucesso!');
    }, 1000);
  };

  const handleGenericReplenish = () => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setShowGenericReplenishModal(false);
      showNotification('Estoque reposto com sucesso!');
    }, 1000);
  };

  const handleItemClick = (item) => {
    setSelectedItem(item);
    setShowDetailsModal(true);
  };

  const handleShowHistory = (item) => {
    setSelectedItem(item);
    setShowHistoryModal(true);
  };

  const handleShowPriceHistory = (item) => {
    setSelectedItem(item);
    setShowPriceHistoryModal(true);
  };

  const categories = [
    { id: 1, nome: 'Limpeza', descricao: 'Produtos de limpeza e higiene', icone: '🧹' },
    { id: 2, nome: 'Cama & Banho', descricao: 'Lençóis, toalhas e acessórios', icone: '🛏️' },
    { id: 3, nome: 'Alimentos', descricao: 'Alimentos não perecíveis', icone: '🍞' },
    { id: 4, nome: 'Bebidas', descricao: 'Bebidas e refrigerantes', icone: '🥤' },
    { id: 5, nome: 'Utensílios', descricao: 'Utensílios de cozinha e copa', icone: '🍴' },
    { id: 6, nome: 'Manutenção', descricao: 'Ferramentas e materiais de manutenção', icone: '🔧' }
  ];

  const items = [
    { id: 1, nome: 'Detergente Neutro 500ml', categoria: 'Limpeza', categoriaId: 1, quantidade: 24, valorCompra: 2.50, valorVenda: 5.00, ultimaReposicao: '10/02/2026' },
    { id: 2, nome: 'Sabão em Pó 1kg', categoria: 'Limpeza', categoriaId: 1, quantidade: 15, valorCompra: 8.90, valorVenda: 15.00, ultimaReposicao: '08/02/2026' },
    { id: 3, nome: 'Desinfetante Lavanda 2L', categoria: 'Limpeza', categoriaId: 1, quantidade: 5, valorCompra: 6.50, valorVenda: 12.00, ultimaReposicao: '05/02/2026' },
    { id: 4, nome: 'Papel Higiênico (pacote 12un)', categoria: 'Limpeza', categoriaId: 1, quantidade: 30, valorCompra: 18.00, valorVenda: 30.00, ultimaReposicao: '12/02/2026' },
    { id: 5, nome: 'Jogo de Lençol Casal Branco', categoria: 'Cama & Banho', categoriaId: 2, quantidade: 12, valorCompra: 45.00, valorVenda: 90.00, ultimaReposicao: '01/02/2026' },
    { id: 6, nome: 'Toalha de Banho Grande', categoria: 'Cama & Banho', categoriaId: 2, quantidade: 25, valorCompra: 22.00, valorVenda: 45.00, ultimaReposicao: '03/02/2026' },
    { id: 7, nome: 'Travesseiro Fibra', categoria: 'Cama & Banho', categoriaId: 2, quantidade: 8, valorCompra: 18.00, valorVenda: 35.00, ultimaReposicao: '28/01/2026' },
    { id: 8, nome: 'Toalha de Rosto', categoria: 'Cama & Banho', categoriaId: 2, quantidade: 35, valorCompra: 8.00, valorVenda: 18.00, ultimaReposicao: '05/02/2026' },
    { id: 9, nome: 'Café Torrado 500g', categoria: 'Alimentos', categoriaId: 3, quantidade: 18, valorCompra: 12.00, valorVenda: 20.00, ultimaReposicao: '11/02/2026' },
    { id: 10, nome: 'Açúcar 1kg', categoria: 'Alimentos', categoriaId: 3, quantidade: 20, valorCompra: 4.50, valorVenda: 8.00, ultimaReposicao: '09/02/2026' },
    { id: 11, nome: 'Biscoito Maisena 400g', categoria: 'Alimentos', categoriaId: 3, quantidade: 8, valorCompra: 3.80, valorVenda: 7.00, ultimaReposicao: '07/02/2026' },
    { id: 12, nome: 'Água Mineral 500ml (cx 12un)', categoria: 'Bebidas', categoriaId: 4, quantidade: 40, valorCompra: 15.00, valorVenda: 30.00, ultimaReposicao: '12/02/2026' },
    { id: 13, nome: 'Refrigerante 2L', categoria: 'Bebidas', categoriaId: 4, quantidade: 15, valorCompra: 5.50, valorVenda: 10.00, ultimaReposicao: '10/02/2026' },
    { id: 14, nome: 'Prato Fundo Branco', categoria: 'Utensílios', categoriaId: 5, quantidade: 50, valorCompra: 3.50, valorVenda: 8.00, ultimaReposicao: '20/01/2026' },
    { id: 15, nome: 'Copo de Vidro 300ml', categoria: 'Utensílios', categoriaId: 5, quantidade: 48, valorCompra: 2.00, valorVenda: 5.00, ultimaReposicao: '25/01/2026' },
    { id: 16, nome: 'Talheres Inox (jogo)', categoria: 'Utensílios', categoriaId: 5, quantidade: 20, valorCompra: 25.00, valorVenda: 50.00, ultimaReposicao: '15/01/2026' },
    { id: 17, nome: 'Lâmpada LED 9W', categoria: 'Manutenção', categoriaId: 6, quantidade: 12, valorCompra: 8.00, valorVenda: 15.00, ultimaReposicao: '30/01/2026' },
    { id: 18, nome: 'Chave Philips', categoria: 'Manutenção', categoriaId: 6, quantidade: 3, valorCompra: 12.00, valorVenda: 25.00, ultimaReposicao: '10/01/2026' }
  ];

  // Mock data para histórico de reposição
  const historyData = {
    valorTotalInvestido: 90.0,
    valorTotalVenda: 225.0,
    lucro: 135.0,
    itemReposicaoList: [
      {
        id: 78,
        dataHoraRegistro: '2026-02-18T14:02:08',
        valorCompraUnidade: 1.2,
        valorVendaUnidade: 3.0,
        fornecedor: 'Distribuidora XYZ',
        funcionarioId: 3,
        funcionarioNome: 'admin',
        qtdUnidades: 25,
        valorTotalInvestido: 30.0,
        valorTotalVenda: 75.0,
        lucro: 45.0
      },
      {
        id: 54,
        dataHoraRegistro: '2026-02-18T14:02:08',
        valorCompraUnidade: 1.2,
        valorVendaUnidade: 3.0,
        fornecedor: 'Distribuidora XYZ',
        funcionarioId: 3,
        funcionarioNome: 'admin',
        qtdUnidades: 50,
        valorTotalInvestido: 60.0,
        valorTotalVenda: 150.0,
        lucro: 90.0
      }
    ]
  };

  // Mock data para histórico de preço
  const priceHistoryData = [
    {
      id: 48,
      dataHoraRegistro: '2026-02-18T13:21:38',
      valorCompraUnidade: 1.2,
      valorVendaUnidade: 3.0,
      funcionarioId: 1,
      funcionarioNome: 'João Silva Santos'
    },
    {
      id: 24,
      dataHoraRegistro: '2026-02-18T13:21:38',
      valorCompraUnidade: 1.2,
      valorVendaUnidade: 3.0,
      funcionarioId: 1,
      funcionarioNome: 'João Silva Santos'
    }
  ];

  const filteredItems = items.filter(item => {
    const matchesSearch = item.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.categoria.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || item.categoriaId === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const itemsByCategory = categories.map(category => {
    const categoryItems = items.filter(item => item.categoriaId === category.id);
    const valorTotalInvestido = categoryItems.reduce((sum, item) => sum + (item.quantidade * item.valorCompra), 0);
    const valorTotalVenda = categoryItems.reduce((sum, item) => sum + (item.quantidade * item.valorVenda), 0);
    const lucro = valorTotalVenda - valorTotalInvestido;
    
    return {
      ...category,
      items: filteredItems.filter(item => item.categoriaId === category.id),
      totalItems: categoryItems.length,
      valorTotalInvestido,
      valorTotalVenda,
      lucro
    };
  });

  const stats = {
    totalCategorias: categories.length,
    totalItens: items.length,
    totalValorEstoque: items.reduce((sum, item) => sum + (item.quantidade * item.valorCompra), 0),
    itensAbaixoMinimo: 0
  };

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
    dateHeader: isDark ? 'bg-white/10' : 'bg-slate-100',
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
                Almoxarifado
              </h1>
              <p className={`${theme.textSecondary} text-sm flex items-center gap-2`}>
                <Package className="w-3.5 h-3.5" />
                Gerenciamento de Estoque e Inventário
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

        {permissions.mostrarDashboard && (
          <div className={`${theme.card} backdrop-blur-xl rounded-xl p-4 mb-6 border shadow-xl`}>
            <div className="flex items-center gap-2 mb-4">
              <Boxes className="w-4 h-4 text-violet-500" />
              <h2 className={`text-sm font-bold ${theme.text} uppercase tracking-wider`}>Dashboard do Estoque</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="bg-gradient-to-br from-blue-500 to-cyan-600 rounded-lg p-4 shadow-lg">
                <div className="flex items-center gap-3 mb-2">
                  <Tag className="w-5 h-5 text-white" />
                  <span className="text-white font-bold text-sm">CATEGORIAS</span>
                </div>
                <p className="text-4xl font-bold text-white">{stats.totalCategorias}</p>
                <p className="text-white/80 text-xs mt-1">Categorias cadastradas</p>
              </div>

              <div className="bg-gradient-to-br from-violet-500 to-purple-600 rounded-lg p-4 shadow-lg">
                <div className="flex items-center gap-3 mb-2">
                  <Package className="w-5 h-5 text-white" />
                  <span className="text-white font-bold text-sm">TOTAL DE ITENS</span>
                </div>
                <p className="text-4xl font-bold text-white">{stats.totalItens}</p>
                <p className="text-white/80 text-xs mt-1">Itens cadastrados</p>
              </div>

              <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg p-4 shadow-lg">
                <div className="flex items-center gap-3 mb-2">
                  <DollarSign className="w-5 h-5 text-white" />
                  <span className="text-white font-bold text-sm">VALOR ESTOQUE</span>
                </div>
                <p className="text-4xl font-bold text-white">R$ {stats.totalValorEstoque.toFixed(0)}</p>
                <p className="text-white/80 text-xs mt-1">Valor total em estoque</p>
              </div>

              <div className="bg-gradient-to-br from-rose-500 to-red-600 rounded-lg p-4 shadow-lg">
                <div className="flex items-center gap-3 mb-2">
                  <TrendingUp className="w-5 h-5 text-white" />
                  <span className="text-white font-bold text-sm">LUCRO POTENCIAL</span>
                </div>
                <p className="text-4xl font-bold text-white">R$ {(items.reduce((sum, item) => sum + (item.quantidade * item.valorVenda), 0) - stats.totalValorEstoque).toFixed(0)}</p>
                <p className="text-white/80 text-xs mt-1">Lucro estimado total</p>
              </div>
            </div>

            
          </div>
        )}

        Lista de Categorias de Estoque - Estilo Cards Expansíveis
<div className={`${theme.card} rounded-xl border shadow-xl overflow-hidden mb-6`}>
  <div className="px-4 py-3 border-b flex items-center justify-between gap-3">
    <div>
      <h2 className={`text-lg font-bold ${theme.text}`}>Categorias de Estoque</h2>
      <p className={`${theme.textSecondary} text-xs`}>Cada categoria define valores, itens e totais.</p>
    </div>
  </div>

  <div className="divide-y divide-slate-700/40">
    {itemsByCategory.map(category => {
      const isCollapsed = collapsedCategories[category.id];
      
      return (
        <div key={category.id}>
          <div 
            className={`px-4 py-3 flex items-center justify-between cursor-pointer ${theme.cardHover}`}
            onClick={() => toggleCategoryCollapse(category.id)}
          >
            <div className="flex items-center gap-3">
              <ChevronDown 
                className={`w-4 h-4 text-violet-400 transition-transform duration-200 ${isCollapsed ? '-rotate-90' : ''}`} 
              />
              
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{category.icone}</span>
                  <span className={`${theme.text} font-semibold text-sm`}>{category.nome}</span>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-300 border border-violet-500/30">
                    {category.totalItems} {category.totalItems === 1 ? 'item' : 'itens'}
                  </span>
                </div>
                <p className={`${theme.textSecondary} text-xs mt-1`}>{category.descricao}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* <div className="hidden sm:flex flex-col text-right text-xs">
                <span className={`${theme.textSecondary}`}>
                  Lucro: <span className="text-violet-500 font-semibold">R$ {category.lucro.toFixed(2)}</span>
                </span>
              </div> */}

              {permissions.adicionarEditarCategoria && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEditCategory(category);
                  }}
                  className={`px-3 py-1.5 text-xs rounded-lg border ${theme.button} ${theme.text} flex items-center gap-1 hover:scale-105 active:scale-95`}
                >
                  <Edit className="w-3.5 h-3.5" />
                  Editar
                </button>
              )}
            </div>
          </div>

          {!isCollapsed && (
            <div className="px-4 pb-4 pt-2 grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Card Resumo Financeiro */}
              <div className={`${theme.card} rounded-lg border p-3`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-violet-400" />
                    <span className={`${theme.text} text-xs font-semibold uppercase`}>Resumo Financeiro</span>
                  </div>
                </div>

                <div className="space-y-2 text-xs">

                  <div className="flex items-center justify-between">
                    <span className={theme.textSecondary}>Quantidade de Itens</span>
                    <span className="text-white font-semibold">{category.totalItems}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className={theme.textSecondary}>Investido</span>
                    <span className="text-rose-500 font-semibold">R$ {category.valorTotalInvestido.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className={theme.textSecondary}>Valor Venda</span>
                    <span className="text-emerald-500 font-semibold">R$ {category.valorTotalVenda.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-white/10">
                    <span className={theme.textSecondary}>Lucro Potencial</span>
                    <span className="text-violet-500 font-bold">R$ {category.lucro.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Card Itens */}
              <div className={`${theme.card} rounded-lg border p-3 lg:col-span-2`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-emerald-400" />
                    <span className={`${theme.text} text-xs font-semibold uppercase`}>Itens</span>
                  </div>
                  <div className="flex gap-2">
                    {permissions.adicionarEditarItem && (
                      <button
                        onClick={() => setShowAddItemModal(true)}
                        className="px-2 py-1 text-[11px] rounded-lg bg-violet-600 hover:bg-violet-700 text-white flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" />
                        Cadastrar Novo Item
                      </button>
                    )}
                  
                  </div>
                </div>

                {category.items.length === 0 ? (
                  <p className={`${theme.textSecondary} text-xs`}>Nenhum item cadastrado.</p>
                ) : (
                  <div className="space-y-1 text-xs max-h-48 overflow-y-auto">
                    {category.items.map(item => (
                      <div
                        key={item.id}
                        onClick={() => handleItemClick(item)}
                        className={`flex items-start justify-between border border-white/10 rounded-lg px-2 py-1.5 cursor-pointer hover:bg-violet-500/10 transition-colors`}
                      >
                        <div>
                          <div className={`${theme.text} font-semibold text-xs`}>{item.nome}</div>
                          <div className={`${theme.textSecondary} text-[11px] mt-0.5`}>
                            Estoque: {item.quantidade} | Compra: R$ {item.valorCompra.toFixed(2)} | Venda: R$ {item.valorVenda.toFixed(2)}
                          </div>
                        </div>
                        <div className="flex gap-1 ml-2">
                          {permissions.consumirItem && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleConsumeItem(item);
                              }}
                              className="p-1 bg-rose-600 hover:bg-rose-700 text-white rounded"
                              title="Consumir"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                          )}
                          {permissions.reporEstoque && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleReplenishItem(item);
                              }}
                              className="p-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded"
                              title="Repor"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          )}
                          {permissions.verHistoricoReposicao && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleShowHistory(item);
                              }}
                              className={`p-1 ${theme.button} border rounded`}
                              title="Histórico"
                            >
                              <History className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      );
    })}
  </div>
</div>

      </div>

      {/* Modal Adicionar Categoria */}
      {showAddCategoryModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`${theme.card} rounded-xl border shadow-2xl max-w-md w-full`}>
            <div className={`p-4 border-b ${theme.divider} flex items-center justify-between`}>
              <div className="flex items-center gap-2">
                <Tag className="w-5 h-5 text-violet-500" />
                <h3 className={`text-lg font-bold ${theme.text}`}>Nova Categoria</h3>
              </div>
              <button onClick={() => setShowAddCategoryModal(false)} className={`${theme.textSecondary} hover:${theme.text} transition-transform duration-200 hover:scale-110 active:scale-90`}>
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className={`block text-sm font-medium ${theme.text} mb-2`}>Nome da Categoria *</label>
                <input
                  type="text"
                  placeholder="Ex: Eletrônicos"
                  className={`w-full px-3 py-2 ${theme.input} rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 border-2`}
                />
              </div>

              <div>
                <label className={`block text-sm font-medium ${theme.text} mb-2`}>Descrição</label>
                <textarea
                  placeholder="Descreva a categoria..."
                  rows={3}
                  className={`w-full px-3 py-2 ${theme.input} rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 border-2 resize-none`}
                />
              </div>
              <div className="flex gap-2 pt-4">
                <button
                  onClick={() => setShowAddCategoryModal(false)}
                  className={`flex-1 px-4 py-2 ${theme.button} ${theme.text} rounded-lg border transition-all duration-200 text-sm font-medium hover:scale-105 active:scale-95`}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleAddCategory}
                  className="flex-1 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-all duration-200 text-sm font-medium hover:scale-105 active:scale-95 hover:shadow-lg hover:shadow-violet-500/50"
                >
                  Criar Categoria
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Editar Categoria */}
      {showEditCategoryModal && editingCategory && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`${theme.card} rounded-xl border shadow-2xl max-w-md w-full`}>
            <div className={`p-4 border-b ${theme.divider} flex items-center justify-between`}>
              <div className="flex items-center gap-2">
                <Edit className="w-5 h-5 text-violet-500" />
                <h3 className={`text-lg font-bold ${theme.text}`}>Editar Categoria</h3>
              </div>
              <button onClick={() => setShowEditCategoryModal(false)} className={`${theme.textSecondary} hover:${theme.text} transition-transform duration-200 hover:scale-110 active:scale-90`}>
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className={`block text-sm font-medium ${theme.text} mb-2`}>Nome da Categoria *</label>
                <input
                  type="text"
                  defaultValue={editingCategory.nome}
                  className={`w-full px-3 py-2 ${theme.input} rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 border-2`}
                />
              </div>

              <div>
                <label className={`block text-sm font-medium ${theme.text} mb-2`}>Descrição</label>
                <textarea
                  defaultValue={editingCategory.descricao}
                  rows={3}
                  className={`w-full px-3 py-2 ${theme.input} rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 border-2 resize-none`}
                />
              </div>

              <div>
                <label className={`block text-sm font-medium ${theme.text} mb-2`}>Ícone (Emoji)</label>
                <input
                  type="text"
                  defaultValue={editingCategory.icone}
                  maxLength={2}
                  className={`w-full px-3 py-2 ${theme.input} rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 border-2`}
                />
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  onClick={() => setShowEditCategoryModal(false)}
                  className={`flex-1 px-4 py-2 ${theme.button} ${theme.text} rounded-lg border transition-all duration-200 text-sm font-medium hover:scale-105 active:scale-95`}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleUpdateCategory}
                  className="flex-1 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-all duration-200 text-sm font-medium hover:scale-105 active:scale-95 hover:shadow-lg hover:shadow-violet-500/50"
                >
                  Salvar Alterações
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Adicionar Item */}
      {showAddItemModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`${theme.card} rounded-xl border shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto`}>
            <div className={`p-4 border-b ${theme.divider} flex items-center justify-between sticky top-0 ${theme.card} z-10`}>
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-violet-500" />
                <h3 className={`text-lg font-bold ${theme.text}`}>Adicionar Item ao Estoque</h3>
              </div>
              <button onClick={() => setShowAddItemModal(false)} className={`${theme.textSecondary} hover:${theme.text} transition-transform duration-200 hover:scale-110 active:scale-90`}>
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              <div>
                <h4 className={`text-sm font-bold ${theme.text} mb-3 uppercase tracking-wider flex items-center gap-2`}>
                  <Package className="w-4 h-4 text-violet-500" />
                  Informações do Item
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className={`block text-sm font-medium ${theme.text} mb-2`}>Descrição do Item *</label>
                    <input
                      type="text"
                      placeholder="Ex: Detergente Neutro 500ml"
                      className={`w-full px-3 py-2 ${theme.input} rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 border-2`}
                    />
                  </div>
                  
                  <div>
                    <label className={`block text-sm font-medium ${theme.text} mb-2`}>Categoria *</label>
                    <select className={`w-full px-3 py-2 ${theme.input} rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 border-2`}>
                      <option value="">Selecione...</option>
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.icone} {cat.nome}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <h4 className={`text-sm font-bold ${theme.text} mb-3 uppercase tracking-wider flex items-center gap-2`}>
                  <DollarSign className="w-4 h-4 text-violet-500" />
                  Valores
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-sm font-medium ${theme.text} mb-2`}>Valor de Compra (unitário) *</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      className={`w-full px-3 py-2 ${theme.input} rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 border-2`}
                    />
                  </div>

                  <div>
                    <label className={`block text-sm font-medium ${theme.text} mb-2`}>Valor de Venda (unitário) *</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      className={`w-full px-3 py-2 ${theme.input} rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 border-2`}
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  onClick={() => setShowAddItemModal(false)}
                  className={`flex-1 px-4 py-2 ${theme.button} ${theme.text} rounded-lg border transition-all duration-200 text-sm font-medium hover:scale-105 active:scale-95`}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleAddItem}
                  className="flex-1 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-all duration-200 text-sm font-medium hover:scale-105 active:scale-95 hover:shadow-lg hover:shadow-violet-500/50"
                >
                  Adicionar ao Estoque
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Consumir Item */}
      {showConsumeModal && selectedItem && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`${theme.card} rounded-xl border shadow-2xl max-w-md w-full`}>
            <div className={`p-4 border-b ${theme.divider} flex items-center justify-between`}>
              <div className="flex items-center gap-2">
                <Minus className="w-5 h-5 text-rose-500" />
                <h3 className={`text-lg font-bold ${theme.text}`}>Consumir Item</h3>
              </div>
              <button onClick={() => setShowConsumeModal(false)} className={`${theme.textSecondary} hover:${theme.text} transition-transform duration-200 hover:scale-110 active:scale-90`}>
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className={`p-3 rounded-lg ${theme.card} border`}>
                <p className={`${theme.textSecondary} text-xs mb-1`}>Item Selecionado</p>
                <p className={`${theme.text} font-bold`}>{selectedItem.nome}</p>
                <p className={`${theme.textSecondary} text-xs mt-2`}>Quantidade disponível: {selectedItem.quantidade}</p>
              </div>

              <div>
                <label className={`block text-sm font-medium ${theme.text} mb-2`}>Quantidade a Consumir *</label>
                <input
                  type="number"
                  placeholder="0"
                  min="1"
                  max={selectedItem.quantidade}
                  className={`w-full px-3 py-2 ${theme.input} rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 border-2`}
                />
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  onClick={() => setShowConsumeModal(false)}
                  className={`flex-1 px-4 py-2 ${theme.button} ${theme.text} rounded-lg border transition-all duration-200 text-sm font-medium hover:scale-105 active:scale-95`}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmConsume}
                  className="flex-1 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-all duration-200 text-sm font-medium hover:scale-105 active:scale-95 hover:shadow-lg hover:shadow-rose-500/50"
                >
                  Confirmar Consumo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Repor Estoque (Item Específico) */}
      {showReplenishModal && selectedItem && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`${theme.card} rounded-xl border shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto`}>
            <div className={`p-4 border-b ${theme.divider} flex items-center justify-between sticky top-0 ${theme.card} z-10`}>
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-emerald-500" />
                <h3 className={`text-lg font-bold ${theme.text}`}>Repor Estoque</h3>
              </div>
              <button onClick={() => setShowReplenishModal(false)} className={`${theme.textSecondary} hover:${theme.text} transition-transform duration-200 hover:scale-110 active:scale-90`}>
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className={`p-3 rounded-lg ${theme.card} border`}>
                <p className={`${theme.textSecondary} text-xs mb-1`}>Item Selecionado</p>
                <p className={`${theme.text} font-bold`}>{selectedItem.nome}</p>
                <p className={`${theme.textSecondary} text-xs mt-2`}>Quantidade atual: {selectedItem.quantidade}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium ${theme.text} mb-2`}>Quantidade *</label>
                  <input
                    type="number"
                    placeholder="0"
                    min="1"
                    className={`w-full px-3 py-2 ${theme.input} rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 border-2`}
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium ${theme.text} mb-2`}>Fornecedor *</label>
                  <input
                    type="text"
                    placeholder="Nome do fornecedor"
                    className={`w-full px-3 py-2 ${theme.input} rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 border-2`}
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium ${theme.text} mb-2`}>Valor de Compra (unidade) *</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    defaultValue={selectedItem.valorCompra}
                    className={`w-full px-3 py-2 ${theme.input} rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 border-2`}
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium ${theme.text} mb-2`}>Valor de Venda (unidade) *</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    defaultValue={selectedItem.valorVenda}
                    className={`w-full px-3 py-2 ${theme.input} rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 border-2`}
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  onClick={() => setShowReplenishModal(false)}
                  className={`flex-1 px-4 py-2 ${theme.button} ${theme.text} rounded-lg border transition-all duration-200 text-sm font-medium hover:scale-105 active:scale-95`}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmReplenish}
                  className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-all duration-200 text-sm font-medium hover:scale-105 active:scale-95 hover:shadow-lg hover:shadow-emerald-500/50"
                >
                  Confirmar Reposição
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      
      {/* Modal Detalhes do Item */}
      {showDetailsModal && selectedItem && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`${theme.card} rounded-xl border shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto`}>
            <div className={`p-4 border-b ${theme.divider} flex items-center justify-between`}>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/20">
                  <Package className="w-5 h-5 text-emerald-500" />
                </div>
                <div>
                  <h3 className={`text-lg font-bold ${theme.text}`}>{selectedItem.nome}</h3>
                  <p className={`text-sm ${theme.textSecondary}`}>{selectedItem.categoria}</p>
                </div>
              </div>
              <button onClick={() => setShowDetailsModal(false)} className={`${theme.textSecondary} hover:${theme.text} transition-transform duration-200 hover:scale-110 active:scale-90`}>
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <span className={`text-sm ${theme.textSecondary} block mb-1`}>Quantidade em Estoque</span>
                    <span className="text-3xl font-bold text-emerald-500">
                      {selectedItem.quantidade}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`text-xs ${theme.textSecondary} uppercase tracking-wide mb-1 block`}>Valor de Compra</label>
                  <div className={`${theme.text} font-bold text-lg`}>R$ {selectedItem.valorCompra.toFixed(2)}</div>
                </div>
                <div>
                  <label className={`text-xs ${theme.textSecondary} uppercase tracking-wide mb-1 block`}>Valor de Venda</label>
                  <div className="text-emerald-500 font-bold text-lg">R$ {selectedItem.valorVenda.toFixed(2)}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`text-xs ${theme.textSecondary} uppercase tracking-wide mb-1 block`}>Margem de Lucro</label>
                  <div className="text-violet-500 font-bold">
                    {((selectedItem.valorVenda - selectedItem.valorCompra) / selectedItem.valorCompra * 100).toFixed(1)}%
                  </div>
                </div>
                <div>
                  <label className={`text-xs ${theme.textSecondary} uppercase tracking-wide mb-1 block`}>Lucro Unitário</label>
                  <div className="text-violet-500 font-bold">
                    R$ {(selectedItem.valorVenda - selectedItem.valorCompra).toFixed(2)}
                  </div>
                </div>
              </div>

              <div>
                <label className={`text-xs ${theme.textSecondary} uppercase tracking-wide mb-1 block`}>Última Reposição</label>
                <div className={`${theme.text} font-medium flex items-center gap-2`}>
                  <Calendar className="w-4 h-4 text-violet-500" />
                  {selectedItem.ultimaReposicao}
                </div>
              </div>

              <div className={`p-3 rounded-lg ${theme.card} border`}>
                <label className={`text-xs ${theme.textSecondary} uppercase tracking-wide mb-2 block`}>Valor Total em Estoque</label>
                <div className={`${theme.text} font-bold text-xl`}>
                  R$ {(selectedItem.quantidade * selectedItem.valorCompra).toFixed(2)}
                </div>
              </div>
            </div>

            <div className={`p-4 border-t ${theme.divider} flex gap-2`}>
              {permissions.verHistoricoPreco && (
                <button
                  onClick={() => {
                    setShowDetailsModal(false);
                    handleShowPriceHistory(selectedItem);
                  }}
                  className={`flex-1 px-4 py-2 ${theme.button} ${theme.text} rounded-lg border transition-all duration-200 text-sm font-medium flex items-center justify-center gap-2 hover:scale-105 active:scale-95`}
                >
                  <Tag className="w-4 h-4" />
                  Histórico de Preço
                </button>
              )}
              {permissions.adicionarEditarItem && (
                <button
                  onClick={handleEditItem}
                  className="flex-1 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-all duration-200 text-sm font-medium flex items-center justify-center gap-2 hover:scale-105 active:scale-95 hover:shadow-lg hover:shadow-violet-500/50"
                >
                  <Edit className="w-4 h-4" />
                  Editar
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Histórico de Reposição */}
      {showHistoryModal && selectedItem && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`${theme.card} rounded-xl border shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto`}>
            <div className={`p-4 border-b ${theme.divider} flex items-center justify-between`}>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-violet-500/20">
                  <History className="w-5 h-5 text-violet-500" />
                </div>
                <div>
                  <h3 className={`text-lg font-bold ${theme.text}`}>Histórico de Reposição</h3>
                  <p className={`text-sm ${theme.textSecondary}`}>{selectedItem.nome}</p>
                </div>
              </div>
              <button onClick={() => setShowHistoryModal(false)} className={`${theme.textSecondary} hover:${theme.text} transition-transform duration-200 hover:scale-110 active:scale-90`}>
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6">
              <div className={`p-4 rounded-lg ${theme.card} border mb-4`}>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <span className={`text-xs ${theme.textSecondary} uppercase tracking-wide block mb-1`}>Valor Total Investido</span>
                    <span className="text-rose-500 font-bold text-lg">R$ {historyData.valorTotalInvestido.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className={`text-xs ${theme.textSecondary} uppercase tracking-wide block mb-1`}>Valor Total Venda</span>
                    <span className="text-emerald-500 font-bold text-lg">R$ {historyData.valorTotalVenda.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className={`text-xs ${theme.textSecondary} uppercase tracking-wide block mb-1`}>Lucro Total</span>
                    <span className="text-violet-500 font-bold text-lg">R$ {historyData.lucro.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <table className="w-full">
                <thead>
                  <tr className={`border-b ${theme.divider} ${theme.tableHeader}`}>
                    <th className={`text-left p-3 ${theme.textSecondary} font-semibold text-[10px] uppercase tracking-wider`}>Data</th>
                    <th className={`text-center p-3 ${theme.textSecondary} font-semibold text-[10px] uppercase tracking-wider`}>Qtd</th>
                    <th className={`text-right p-3 ${theme.textSecondary} font-semibold text-[10px] uppercase tracking-wider`}>Compra Un.</th>
                    <th className={`text-right p-3 ${theme.textSecondary} font-semibold text-[10px] uppercase tracking-wider`}>Venda Un.</th>
                    <th className={`text-right p-3 ${theme.textSecondary} font-semibold text-[10px] uppercase tracking-wider`}>Investido</th>
                    <th className={`text-right p-3 ${theme.textSecondary} font-semibold text-[10px] uppercase tracking-wider`}>Total Venda</th>
                    <th className={`text-right p-3 ${theme.textSecondary} font-semibold text-[10px] uppercase tracking-wider`}>Lucro</th>
                    <th className={`text-left p-3 ${theme.textSecondary} font-semibold text-[10px] uppercase tracking-wider`}>Fornecedor</th>
                    <th className={`text-left p-3 ${theme.textSecondary} font-semibold text-[10px] uppercase tracking-wider`}>Responsável</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${theme.divider}`}>
                  {historyData.itemReposicaoList.map((entry, index) => (
                    <tr 
                      key={entry.id}
                      className={`${theme.cardHover} transition-colors`}
                      style={{ animationDelay: `${index * 30}ms` }}
                    >
                      <td className="p-3">
                        <div className={`${theme.text} font-medium text-sm flex items-center gap-2`}>
                          <Calendar className="w-4 h-4 text-violet-500" />
                          {new Date(entry.dataHoraRegistro).toLocaleString('pt-BR')}
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-500/20 text-blue-500 border border-blue-500/30">
                          +{entry.qtdUnidades}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <span className={`${theme.text} font-medium text-sm`}>R$ {entry.valorCompraUnidade.toFixed(2)}</span>
                      </td>
                      <td className="p-3 text-right">
                        <span className="text-emerald-500 font-medium text-sm">R$ {entry.valorVendaUnidade.toFixed(2)}</span>
                      </td>
                      <td className="p-3 text-right">
                        <span className="text-rose-500 font-bold text-sm">R$ {entry.valorTotalInvestido.toFixed(2)}</span>
                      </td>
                      <td className="p-3 text-right">
                        <span className="text-emerald-500 font-bold text-sm">R$ {entry.valorTotalVenda.toFixed(2)}</span>
                      </td>
                      <td className="p-3 text-right">
                        <span className="text-violet-500 font-bold text-sm">R$ {entry.lucro.toFixed(2)}</span>
                      </td>
                      <td className="p-3">
                        <span className={`${theme.text} text-sm`}>{entry.fornecedor}</span>
                      </td>
                      <td className="p-3">
                        <span className={`${theme.textSecondary} text-sm`}>{entry.funcionarioNome}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            
          </div>
        </div>
      )}

      {/* Modal Histórico de Preço */}
      {showPriceHistoryModal && selectedItem && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`${theme.card} rounded-xl border shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto`}>
            <div className={`p-4 border-b ${theme.divider} flex items-center justify-between`}>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-violet-500/20">
                  <Tag className="w-5 h-5 text-violet-500" />
                </div>
                <div>
                  <h3 className={`text-lg font-bold ${theme.text}`}>Histórico de Preço</h3>
                  <p className={`text-sm ${theme.textSecondary}`}>{selectedItem.nome}</p>
                </div>
              </div>
              <button onClick={() => setShowPriceHistoryModal(false)} className={`${theme.textSecondary} hover:${theme.text} transition-transform duration-200 hover:scale-110 active:scale-90`}>
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6">
              <table className="w-full">
                <thead>
                  <tr className={`border-b ${theme.divider} ${theme.tableHeader}`}>
                    <th className={`text-left p-3 ${theme.textSecondary} font-semibold text-[10px] uppercase tracking-wider`}>Data</th>
                    <th className={`text-right p-3 ${theme.textSecondary} font-semibold text-[10px] uppercase tracking-wider`}>Valor Compra</th>
                    <th className={`text-right p-3 ${theme.textSecondary} font-semibold text-[10px] uppercase tracking-wider`}>Valor Venda</th>
                    <th className={`text-right p-3 ${theme.textSecondary} font-semibold text-[10px] uppercase tracking-wider`}>Margem</th>
                    <th className={`text-left p-3 ${theme.textSecondary} font-semibold text-[10px] uppercase tracking-wider`}>Funcionário</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${theme.divider}`}>
                  {priceHistoryData.map((entry, index) => (
                    <tr 
                      key={entry.id}
                      className={`${theme.cardHover} transition-colors`}
                      style={{ animationDelay: `${index * 30}ms` }}
                    >
                      <td className="p-3">
                        <div className={`${theme.text} font-medium text-sm flex items-center gap-2`}>
                          <Calendar className="w-4 h-4 text-violet-500" />
                          {new Date(entry.dataHoraRegistro).toLocaleString('pt-BR')}
                        </div>
                      </td>
                      <td className="p-3 text-right">
                        <span className={`${theme.text} font-medium text-sm`}>R$ {entry.valorCompraUnidade.toFixed(2)}</span>
                      </td>
                      <td className="p-3 text-right">
                        <span className="text-emerald-500 font-bold text-sm">R$ {entry.valorVendaUnidade.toFixed(2)}</span>
                      </td>
                      <td className="p-3 text-right">
                        <span className="text-violet-500 font-bold text-sm">
                          {((entry.valorVendaUnidade - entry.valorCompraUnidade) / entry.valorCompraUnidade * 100).toFixed(1)}%
                        </span>
                      </td>
                      <td className="p-3">
                        <span className={`${theme.textSecondary} text-sm`}>{entry.funcionarioNome}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Permissões */}
      {showPermissionsModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`${theme.card} rounded-xl border shadow-2xl max-w-md w-full`}>
            <div className={`p-4 border-b ${theme.divider} flex items-center justify-between`}>
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-violet-500" />
                <h3 className={`text-lg font-bold ${theme.text}`}>Configurar Permissões</h3>
              </div>
              <button onClick={() => setShowPermissionsModal(false)} className={`${theme.textSecondary} hover:${theme.text} transition-transform duration-200 hover:scale-110 active:scale-90`}>
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-3">
              <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg hover:bg-white/5 transition-colors">
                <input
                  type="checkbox"
                  checked={permissions.acessoTotal}
                  onChange={() => togglePermission('acessoTotal')}
                  className="w-5 h-5 rounded accent-violet-500 cursor-pointer"
                />
                <div className="flex-1">
                  <span className={`${theme.text} font-medium text-sm block`}>🔓 Acesso Total</span>
                  <span className={`text-xs ${theme.textSecondary}`}>Habilitar todas as permissões</span>
                </div>
                {permissions.acessoTotal && <Check className="w-5 h-5 text-emerald-500" />}
              </label>

              <div className={`border-t ${theme.divider} pt-3`}></div>

              <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg hover:bg-white/5 transition-colors">
                <input
                  type="checkbox"
                  checked={permissions.mostrarDashboard}
                  onChange={() => togglePermission('mostrarDashboard')}
                  className="w-5 h-5 rounded accent-violet-500 cursor-pointer"
                />
                <div className="flex-1">
                  <span className={`${theme.text} font-medium text-sm block`}>📊 Ver Dashboard</span>
                  <span className={`text-xs ${theme.textSecondary}`}>Visualizar estatísticas e resumos</span>
                </div>
                {permissions.mostrarDashboard && <Check className="w-5 h-5 text-emerald-500" />}
              </label>

              <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg hover:bg-white/5 transition-colors">
                <input
                  type="checkbox"
                  checked={permissions.adicionarEditarCategoria}
                  onChange={() => togglePermission('adicionarEditarCategoria')}
                  className="w-5 h-5 rounded accent-violet-500 cursor-pointer"
                />
                <div className="flex-1">
                  <span className={`${theme.text} font-medium text-sm block`}>🏷️ Adicionar/Editar Categoria</span>
                  <span className={`text-xs ${theme.textSecondary}`}>Criar e modificar categorias</span>
                </div>
                {permissions.adicionarEditarCategoria && <Check className="w-5 h-5 text-emerald-500" />}
              </label>

              <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg hover:bg-white/5 transition-colors">
                <input
                  type="checkbox"
                  checked={permissions.adicionarEditarItem}
                  onChange={() => togglePermission('adicionarEditarItem')}
                  className="w-5 h-5 rounded accent-violet-500 cursor-pointer"
                />
                <div className="flex-1">
                  <span className={`${theme.text} font-medium text-sm block`}>➕ Adicionar/Editar Item</span>
                  <span className={`text-xs ${theme.textSecondary}`}>Criar e modificar itens do estoque</span>
                </div>
                {permissions.adicionarEditarItem && <Check className="w-5 h-5 text-emerald-500" />}
              </label>

              <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg hover:bg-white/5 transition-colors">
                <input
                  type="checkbox"
                  checked={permissions.reporEstoque}
                  onChange={() => togglePermission('reporEstoque')}
                  className="w-5 h-5 rounded accent-violet-500 cursor-pointer"
                />
                <div className="flex-1">
                  <span className={`${theme.text} font-medium text-sm block`}>📦 Repor Estoque</span>
                  <span className={`text-xs ${theme.textSecondary}`}>Adicionar unidades ao estoque</span>
                </div>
                {permissions.reporEstoque && <Check className="w-5 h-5 text-emerald-500" />}
              </label>

              <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg hover:bg-white/5 transition-colors">
                <input
                  type="checkbox"
                  checked={permissions.verHistoricoPreco}
                  onChange={() => togglePermission('verHistoricoPreco')}
                  className="w-5 h-5 rounded accent-violet-500 cursor-pointer"
                />
                <div className="flex-1">
                  <span className={`${theme.text} font-medium text-sm block`}>💰 Ver Histórico de Preço</span>
                  <span className={`text-xs ${theme.textSecondary}`}>Visualizar mudanças de preço</span>
                </div>
                {permissions.verHistoricoPreco && <Check className="w-5 h-5 text-emerald-500" />}
              </label>

              <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg hover:bg-white/5 transition-colors">
                <input
                  type="checkbox"
                  checked={permissions.verHistoricoReposicao}
                  onChange={() => togglePermission('verHistoricoReposicao')}
                  className="w-5 h-5 rounded accent-violet-500 cursor-pointer"
                />
                <div className="flex-1">
                  <span className={`${theme.text} font-medium text-sm block`}>📋 Ver Histórico de Reposição</span>
                  <span className={`text-xs ${theme.textSecondary}`}>Visualizar reposições anteriores</span>
                </div>
                {permissions.verHistoricoReposicao && <Check className="w-5 h-5 text-emerald-500" />}
              </label>

              <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg hover:bg-white/5 transition-colors">
                <input
                  type="checkbox"
                  checked={permissions.consumirItem}
                  onChange={() => togglePermission('consumirItem')}
                  className="w-5 h-5 rounded accent-violet-500 cursor-pointer"
                />
                <div className="flex-1">
                  <span className={`${theme.text} font-medium text-sm block`}>🔻 Consumir Item</span>
                  <span className={`text-xs ${theme.textSecondary}`}>Reduzir quantidade do estoque</span>
                </div>
                {permissions.consumirItem && <Check className="w-5 h-5 text-emerald-500" />}
              </label>
            </div>

            <div className={`p-4 border-t ${theme.divider}`}>
              <button
                onClick={() => setShowPermissionsModal(false)}
                className="w-full px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-all duration-200 text-sm font-medium hover:scale-105 active:scale-95 hover:shadow-lg hover:shadow-violet-500/50"
              >
                Confirmar
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
      `}</style>
    </div>
  );
}
