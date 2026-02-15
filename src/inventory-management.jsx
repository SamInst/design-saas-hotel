import React, { useState } from 'react';
import { Package, Search, Plus, X, Edit, Trash2, Sun, Moon, Shield, Check, ChevronDown, Calendar, DollarSign, TrendingUp, ShoppingCart, History, Tag, Boxes } from 'lucide-react';

export default function InventoryManagement() {
  const [searchTerm, setSearchTerm] = useState('');
  const [isDark, setIsDark] = useState(true);
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [isLoading, setIsLoading] = useState(false);
  const [notification, setNotification] = useState(null);
  const [collapsedCategories, setCollapsedCategories] = useState({});

  const [permissions, setPermissions] = useState({
    mostrarDashboard: true,
    adicionarCategoria: true,
    adicionarItem: true,
    editarItem: true,
    removerItem: true
  });

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const togglePermission = (key) => {
    setPermissions(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
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

  const handleEditItem = () => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setShowDetailsModal(false);
      showNotification('Item atualizado com sucesso!');
    }, 1000);
  };

  const handleDeleteItem = () => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setShowDetailsModal(false);
      showNotification('Item removido com sucesso!', 'info');
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

  const categories = [
    { id: 1, nome: 'Limpeza', descricao: 'Produtos de limpeza e higiene', icone: '🧹' },
    { id: 2, nome: 'Cama & Banho', descricao: 'Lençóis, toalhas e acessórios', icone: '🛏️' },
    { id: 3, nome: 'Alimentos', descricao: 'Alimentos não perecíveis', icone: '🍞' },
    { id: 4, nome: 'Bebidas', descricao: 'Bebidas e refrigerantes', icone: '🥤' },
    { id: 5, nome: 'Utensílios', descricao: 'Utensílios de cozinha e copa', icone: '🍴' },
    { id: 6, nome: 'Manutenção', descricao: 'Ferramentas e materiais de manutenção', icone: '🔧' }
  ];

  const items = [
    { id: 1, nome: 'Detergente Neutro 500ml', categoria: 'Limpeza', categoriaId: 1, quantidade: 24, estoque_minimo: 10, valorCompra: 2.50, valorVenda: 5.00, ultimaReposicao: '10/02/2026', fornecedor: 'Distribuidora XYZ' },
    { id: 2, nome: 'Sabão em Pó 1kg', categoria: 'Limpeza', categoriaId: 1, quantidade: 15, estoque_minimo: 8, valorCompra: 8.90, valorVenda: 15.00, ultimaReposicao: '08/02/2026', fornecedor: 'Distribuidora XYZ' },
    { id: 3, nome: 'Desinfetante Lavanda 2L', categoria: 'Limpeza', categoriaId: 1, quantidade: 5, estoque_minimo: 10, valorCompra: 6.50, valorVenda: 12.00, ultimaReposicao: '05/02/2026', fornecedor: 'Distribuidora XYZ' },
    { id: 4, nome: 'Papel Higiênico (pacote 12un)', categoria: 'Limpeza', categoriaId: 1, quantidade: 30, estoque_minimo: 15, valorCompra: 18.00, valorVenda: 30.00, ultimaReposicao: '12/02/2026', fornecedor: 'Papel Sul' },
    
    { id: 5, nome: 'Jogo de Lençol Casal Branco', categoria: 'Cama & Banho', categoriaId: 2, quantidade: 12, estoque_minimo: 8, valorCompra: 45.00, valorVenda: 90.00, ultimaReposicao: '01/02/2026', fornecedor: 'TêxtilMax' },
    { id: 6, nome: 'Toalha de Banho Grande', categoria: 'Cama & Banho', categoriaId: 2, quantidade: 25, estoque_minimo: 15, valorCompra: 22.00, valorVenda: 45.00, ultimaReposicao: '03/02/2026', fornecedor: 'TêxtilMax' },
    { id: 7, nome: 'Travesseiro Fibra', categoria: 'Cama & Banho', categoriaId: 2, quantidade: 8, estoque_minimo: 10, valorCompra: 18.00, valorVenda: 35.00, ultimaReposicao: '28/01/2026', fornecedor: 'TêxtilMax' },
    { id: 8, nome: 'Toalha de Rosto', categoria: 'Cama & Banho', categoriaId: 2, quantidade: 35, estoque_minimo: 20, valorCompra: 8.00, valorVenda: 18.00, ultimaReposicao: '05/02/2026', fornecedor: 'TêxtilMax' },
    
    { id: 9, nome: 'Café Torrado 500g', categoria: 'Alimentos', categoriaId: 3, quantidade: 18, estoque_minimo: 10, valorCompra: 12.00, valorVenda: 20.00, ultimaReposicao: '11/02/2026', fornecedor: 'Atacado do Zé' },
    { id: 10, nome: 'Açúcar 1kg', categoria: 'Alimentos', categoriaId: 3, quantidade: 20, estoque_minimo: 12, valorCompra: 4.50, valorVenda: 8.00, ultimaReposicao: '09/02/2026', fornecedor: 'Atacado do Zé' },
    { id: 11, nome: 'Biscoito Maisena 400g', categoria: 'Alimentos', categoriaId: 3, quantidade: 8, estoque_minimo: 15, valorCompra: 3.80, valorVenda: 7.00, ultimaReposicao: '07/02/2026', fornecedor: 'Atacado do Zé' },
    
    { id: 12, nome: 'Água Mineral 500ml (cx 12un)', categoria: 'Bebidas', categoriaId: 4, quantidade: 40, estoque_minimo: 20, valorCompra: 15.00, valorVenda: 30.00, ultimaReposicao: '12/02/2026', fornecedor: 'Bebidas Brasil' },
    { id: 13, nome: 'Refrigerante 2L', categoria: 'Bebidas', categoriaId: 4, quantidade: 15, estoque_minimo: 10, valorCompra: 5.50, valorVenda: 10.00, ultimaReposicao: '10/02/2026', fornecedor: 'Bebidas Brasil' },
    
    { id: 14, nome: 'Prato Fundo Branco', categoria: 'Utensílios', categoriaId: 5, quantidade: 50, estoque_minimo: 30, valorCompra: 3.50, valorVenda: 8.00, ultimaReposicao: '20/01/2026', fornecedor: 'Casa & Lar' },
    { id: 15, nome: 'Copo de Vidro 300ml', categoria: 'Utensílios', categoriaId: 5, quantidade: 48, estoque_minimo: 40, valorCompra: 2.00, valorVenda: 5.00, ultimaReposicao: '25/01/2026', fornecedor: 'Casa & Lar' },
    { id: 16, nome: 'Talheres Inox (jogo)', categoria: 'Utensílios', categoriaId: 5, quantidade: 20, estoque_minimo: 15, valorCompra: 25.00, valorVenda: 50.00, ultimaReposicao: '15/01/2026', fornecedor: 'Casa & Lar' },
    
    { id: 17, nome: 'Lâmpada LED 9W', categoria: 'Manutenção', categoriaId: 6, quantidade: 12, estoque_minimo: 20, valorCompra: 8.00, valorVenda: 15.00, ultimaReposicao: '30/01/2026', fornecedor: 'Elétrica Central' },
    { id: 18, nome: 'Chave Philips', categoria: 'Manutenção', categoriaId: 6, quantidade: 3, estoque_minimo: 5, valorCompra: 12.00, valorVenda: 25.00, ultimaReposicao: '10/01/2026', fornecedor: 'Ferramentas Ltda' }
  ];

  const historyData = [
    { id: 1, data: '12/02/2026', quantidade: 30, valorUnitario: 18.00, valorTotal: 540.00, fornecedor: 'Papel Sul', responsavel: 'João Silva' },
    { id: 2, data: '28/01/2026', quantidade: 25, valorUnitario: 17.50, valorTotal: 437.50, fornecedor: 'Papel Sul', responsavel: 'Maria Santos' },
    { id: 3, data: '15/01/2026', quantidade: 20, valorUnitario: 17.50, valorTotal: 350.00, fornecedor: 'Papel Sul', responsavel: 'João Silva' },
    { id: 4, data: '02/01/2026', quantidade: 40, valorUnitario: 16.80, valorTotal: 672.00, fornecedor: 'Papel Sul', responsavel: 'Carlos Oliveira' }
  ];

  const filteredItems = items.filter(item => {
    const matchesSearch = item.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.categoria.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || item.categoriaId === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const itemsByCategory = categories.map(category => ({
    ...category,
    items: filteredItems.filter(item => item.categoriaId === category.id),
    totalItems: items.filter(item => item.categoriaId === category.id).length,
    totalValorEstoque: items
      .filter(item => item.categoriaId === category.id)
      .reduce((sum, item) => sum + (item.quantidade * item.valorCompra), 0)
  }));

  const stats = {
    totalCategorias: categories.length,
    totalItens: items.length,
    totalValorEstoque: items.reduce((sum, item) => sum + (item.quantidade * item.valorCompra), 0),
    itensAbaixoMinimo: items.filter(item => item.quantidade < item.estoque_minimo).length
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
                  <span className="text-white font-bold text-sm">ATENÇÃO</span>
                </div>
                <p className="text-4xl font-bold text-white">{stats.itensAbaixoMinimo}</p>
                <p className="text-white/80 text-xs mt-1">Itens abaixo do mínimo</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {itemsByCategory.map(category => (
                <div key={category.id} className={`${theme.card} rounded-lg p-4 border transition-all duration-200 hover:scale-105`}>
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-3xl">{category.icone}</span>
                    <div className="flex-1">
                      <h3 className={`${theme.text} font-bold text-sm`}>{category.nome}</h3>
                      <p className={`${theme.textSecondary} text-xs`}>{category.descricao}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className={`${theme.textSecondary} text-xs`}>Total de Itens</span>
                      <span className={`${theme.text} font-bold text-sm`}>{category.totalItems}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className={`${theme.textSecondary} text-xs`}>Valor Estoque</span>
                      <span className="text-emerald-500 font-bold text-sm">R$ {category.totalValorEstoque.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className={`${theme.card} backdrop-blur-xl rounded-xl border shadow-xl overflow-hidden`}>
          <div className={`p-4 border-b ${theme.divider}`}>
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
              <h2 className={`text-lg font-bold ${theme.text}`}>Itens do Estoque</h2>
              <div className="flex gap-2 w-full sm:w-auto flex-wrap">
                <div className="relative flex-1 sm:flex-initial">
                  <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 ${theme.textSecondary}`} />
                  <input
                    type="text"
                    placeholder="Buscar item..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className={`w-full sm:w-64 pl-9 pr-3 py-2 ${theme.input} rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent border-2`}
                  />
                </div>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
                  className={`px-3 py-2 ${theme.input} rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 border-2`}
                >
                  <option value="all">Todas Categorias</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.icone} {cat.nome}</option>
                  ))}
                </select>
                {permissions.adicionarCategoria && (
                  <button
                    onClick={() => setShowAddCategoryModal(true)}
                    className={`px-3 py-2 ${theme.button} ${theme.text} rounded-lg border transition-all duration-200 flex items-center gap-2 text-sm font-medium hover:scale-105 active:scale-95`}
                  >
                    <Tag className="w-4 h-4" />
                    Categoria
                  </button>
                )}
                {permissions.adicionarItem && (
                  <button
                    onClick={() => setShowAddItemModal(true)}
                    className="px-3 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-all duration-200 flex items-center gap-2 text-sm font-medium hover:scale-105 active:scale-95 hover:shadow-lg hover:shadow-violet-500/50"
                  >
                    <Plus className="w-4 h-4" />
                    Adicionar Item
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            {itemsByCategory.filter(cat => cat.items.length > 0).map(category => (
              <div key={category.id} className="mb-4 last:mb-0">
                <div 
                  className={`${theme.dateHeader} backdrop-blur-sm px-4 py-3 flex items-center justify-between border-b ${theme.divider} cursor-pointer ${theme.cardHover} transition-colors`}
                  onClick={() => toggleCategoryCollapse(category.id)}
                >
                  <div className="flex items-center gap-3">
                    <ChevronDown 
                      className={`w-4 h-4 text-violet-400 transition-transform duration-200 ${collapsedCategories[category.id] ? '-rotate-90' : ''}`} 
                    />
                    <span className="text-2xl">{category.icone}</span>
                    <span className={`${theme.text} font-bold text-sm`}>{category.nome}</span>
                    <span className={`${theme.textSecondary} text-xs`}>
                      ({category.items.length} {category.items.length === 1 ? 'item' : 'itens'})
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className={`${theme.textSecondary} text-xs uppercase`}>Valor:</span>
                      <span className="text-emerald-500 font-bold text-sm">
                        R$ {category.items.reduce((sum, item) => sum + (item.quantidade * item.valorCompra), 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
                
                {!collapsedCategories[category.id] && (
                  <table className="w-full">
                    <thead>
                      <tr className={`border-b ${theme.divider} ${theme.tableHeader}`}>
                        <th className={`text-left p-3 ${theme.textSecondary} font-semibold text-[10px] uppercase tracking-wider`}>Item</th>
                        <th className={`text-center p-3 ${theme.textSecondary} font-semibold text-[10px] uppercase tracking-wider`}>Quantidade</th>
                        <th className={`text-center p-3 ${theme.textSecondary} font-semibold text-[10px] uppercase tracking-wider`}>Estoque Mín.</th>
                        <th className={`text-right p-3 ${theme.textSecondary} font-semibold text-[10px] uppercase tracking-wider`}>Valor Compra</th>
                        <th className={`text-right p-3 ${theme.textSecondary} font-semibold text-[10px] uppercase tracking-wider`}>Valor Venda</th>
                        <th className={`text-right p-3 ${theme.textSecondary} font-semibold text-[10px] uppercase tracking-wider`}>Última Reposição</th>
                        <th className={`text-center p-3 ${theme.textSecondary} font-semibold text-[10px] uppercase tracking-wider`}>Ações</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${theme.divider}`}>
                      {category.items.map((item, index) => {
                        const isLowStock = item.quantidade < item.estoque_minimo;
                        return (
                          <tr 
                            key={item.id}
                            onClick={() => handleItemClick(item)}
                            className={`${theme.rowHover} transition-all duration-200 group cursor-pointer ${isLowStock ? 'bg-rose-500/5' : ''}`}
                            style={{ animationDelay: `${index * 30}ms` }}
                          >
                            <td className="p-3">
                              <div className="flex items-center gap-3">
                                <Package className={`w-4 h-4 ${isLowStock ? 'text-rose-500' : 'text-violet-500'}`} />
                                <span className={`${theme.text} font-medium text-sm`}>{item.nome}</span>
                              </div>
                            </td>
                            <td className="p-3 text-center">
                              <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                                isLowStock 
                                  ? 'bg-rose-500/20 text-rose-500 border border-rose-500/30' 
                                  : 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/30'
                              }`}>
                                {item.quantidade}
                              </span>
                            </td>
                            <td className="p-3 text-center">
                              <span className={`${theme.textSecondary} text-sm`}>{item.estoque_minimo}</span>
                            </td>
                            <td className="p-3 text-right">
                              <span className={`${theme.text} font-medium text-sm`}>R$ {item.valorCompra.toFixed(2)}</span>
                            </td>
                            <td className="p-3 text-right">
                              <span className="text-emerald-500 font-bold text-sm">R$ {item.valorVenda.toFixed(2)}</span>
                            </td>
                            <td className="p-3 text-right">
                              <span className={`${theme.textSecondary} text-sm`}>{item.ultimaReposicao}</span>
                            </td>
                            <td className="p-3">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleShowHistory(item);
                                  }}
                                  className={`p-1.5 ${theme.button} rounded-lg border transition-all duration-200 hover:scale-110 active:scale-95`}
                                  title="Ver Histórico"
                                >
                                  <History className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            ))}
          </div>

          {filteredItems.length === 0 && (
            <div className="p-12 text-center">
              <div className={`${theme.textSecondary} text-base mb-1`}>Nenhum item encontrado</div>
              <div className={`${theme.textSecondary} text-sm opacity-70`}>Tente ajustar os filtros de busca</div>
            </div>
          )}

          <div className={`p-3 border-t ${theme.divider} ${theme.tableHeader}`}>
            <div className={`flex justify-between items-center text-xs ${theme.textSecondary}`}>
              <span>Mostrando {filteredItems.length} de {items.length} itens</span>
            </div>
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

              <div>
                <label className={`block text-sm font-medium ${theme.text} mb-2`}>Ícone (Emoji)</label>
                <input
                  type="text"
                  placeholder="📦"
                  maxLength={2}
                  className={`w-full px-3 py-2 ${theme.input} rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 border-2`}
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

                  <div>
                    <label className={`block text-sm font-medium ${theme.text} mb-2`}>Fornecedor</label>
                    <input
                      type="text"
                      placeholder="Nome do fornecedor"
                      className={`w-full px-3 py-2 ${theme.input} rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 border-2`}
                    />
                  </div>

                  <div>
                    <label className={`block text-sm font-medium ${theme.text} mb-2`}>Quantidade Inicial *</label>
                    <input
                      type="number"
                      placeholder="0"
                      min="0"
                      className={`w-full px-3 py-2 ${theme.input} rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 border-2`}
                    />
                  </div>

                  <div>
                    <label className={`block text-sm font-medium ${theme.text} mb-2`}>Estoque Mínimo *</label>
                    <input
                      type="number"
                      placeholder="0"
                      min="0"
                      className={`w-full px-3 py-2 ${theme.input} rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 border-2`}
                    />
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

      {/* Modal Detalhes do Item */}
      {showDetailsModal && selectedItem && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`${theme.card} rounded-xl border shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto`}>
            <div className={`p-4 border-b ${theme.divider} flex items-center justify-between`}>
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${selectedItem.quantidade < selectedItem.estoque_minimo ? 'bg-rose-500/20' : 'bg-emerald-500/20'}`}>
                  <Package className={`w-5 h-5 ${selectedItem.quantidade < selectedItem.estoque_minimo ? 'text-rose-500' : 'text-emerald-500'}`} />
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
              <div className={`p-4 rounded-lg ${selectedItem.quantidade < selectedItem.estoque_minimo ? 'bg-rose-500/10 border border-rose-500/20' : 'bg-emerald-500/10 border border-emerald-500/20'}`}>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className={`text-sm ${theme.textSecondary} block mb-1`}>Quantidade em Estoque</span>
                    <span className={`text-3xl font-bold ${selectedItem.quantidade < selectedItem.estoque_minimo ? 'text-rose-500' : 'text-emerald-500'}`}>
                      {selectedItem.quantidade}
                    </span>
                  </div>
                  <div>
                    <span className={`text-sm ${theme.textSecondary} block mb-1`}>Estoque Mínimo</span>
                    <span className={`text-3xl font-bold ${theme.text}`}>
                      {selectedItem.estoque_minimo}
                    </span>
                  </div>
                </div>
                {selectedItem.quantidade < selectedItem.estoque_minimo && (
                  <div className="mt-3 p-2 bg-rose-500/20 rounded-lg">
                    <p className="text-rose-500 text-xs font-semibold">⚠️ Atenção: Estoque abaixo do mínimo!</p>
                  </div>
                )}
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
                <label className={`text-xs ${theme.textSecondary} uppercase tracking-wide mb-1 block`}>Fornecedor</label>
                <div className={`${theme.text} font-medium`}>{selectedItem.fornecedor}</div>
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
              {permissions.removerItem && (
                <button
                  onClick={handleDeleteItem}
                  className={`px-4 py-2 ${theme.button} ${theme.text} rounded-lg border transition-all duration-200 text-sm font-medium hover:scale-105 active:scale-95 flex items-center gap-2`}
                >
                  <Trash2 className="w-4 h-4" />
                  Excluir
                </button>
              )}
              <button
                onClick={() => setShowDetailsModal(false)}
                className={`flex-1 px-4 py-2 ${theme.button} ${theme.text} rounded-lg border transition-all duration-200 text-sm font-medium hover:scale-105 active:scale-95`}
              >
                Fechar
              </button>
              {permissions.editarItem && (
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
          <div className={`${theme.card} rounded-xl border shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto`}>
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
              <table className="w-full">
                <thead>
                  <tr className={`border-b ${theme.divider} ${theme.tableHeader}`}>
                    <th className={`text-left p-3 ${theme.textSecondary} font-semibold text-[10px] uppercase tracking-wider`}>Data</th>
                    <th className={`text-center p-3 ${theme.textSecondary} font-semibold text-[10px] uppercase tracking-wider`}>Quantidade</th>
                    <th className={`text-right p-3 ${theme.textSecondary} font-semibold text-[10px] uppercase tracking-wider`}>Valor Unit.</th>
                    <th className={`text-right p-3 ${theme.textSecondary} font-semibold text-[10px] uppercase tracking-wider`}>Valor Total</th>
                    <th className={`text-left p-3 ${theme.textSecondary} font-semibold text-[10px] uppercase tracking-wider`}>Fornecedor</th>
                    <th className={`text-left p-3 ${theme.textSecondary} font-semibold text-[10px] uppercase tracking-wider`}>Responsável</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${theme.divider}`}>
                  {historyData.map((entry, index) => (
                    <tr 
                      key={entry.id}
                      className={`${theme.cardHover} transition-colors`}
                      style={{ animationDelay: `${index * 30}ms` }}
                    >
                      <td className="p-3">
                        <div className={`${theme.text} font-medium text-sm flex items-center gap-2`}>
                          <Calendar className="w-4 h-4 text-violet-500" />
                          {entry.data}
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-500/20 text-blue-500 border border-blue-500/30">
                          +{entry.quantidade}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <span className={`${theme.text} font-medium text-sm`}>R$ {entry.valorUnitario.toFixed(2)}</span>
                      </td>
                      <td className="p-3 text-right">
                        <span className="text-emerald-500 font-bold text-sm">R$ {entry.valorTotal.toFixed(2)}</span>
                      </td>
                      <td className="p-3">
                        <span className={`${theme.text} text-sm`}>{entry.fornecedor}</span>
                      </td>
                      <td className="p-3">
                        <span className={`${theme.textSecondary} text-sm`}>{entry.responsavel}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className={`mt-4 p-4 rounded-lg ${theme.card} border`}>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <span className={`text-xs ${theme.textSecondary} uppercase tracking-wide block mb-1`}>Total de Reposições</span>
                    <span className={`${theme.text} font-bold text-lg`}>{historyData.length}</span>
                  </div>
                  <div>
                    <span className={`text-xs ${theme.textSecondary} uppercase tracking-wide block mb-1`}>Quantidade Total</span>
                    <span className={`${theme.text} font-bold text-lg`}>
                      {historyData.reduce((sum, entry) => sum + entry.quantidade, 0)}
                    </span>
                  </div>
                  <div>
                    <span className={`text-xs ${theme.textSecondary} uppercase tracking-wide block mb-1`}>Valor Total Investido</span>
                    <span className="text-emerald-500 font-bold text-lg">
                      R$ {historyData.reduce((sum, entry) => sum + entry.valorTotal, 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className={`p-4 border-t ${theme.divider}`}>
              <button
                onClick={() => setShowHistoryModal(false)}
                className={`w-full px-4 py-2 ${theme.button} ${theme.text} rounded-lg border transition-all duration-200 text-sm font-medium hover:scale-105 active:scale-95`}
              >
                Fechar
              </button>
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
                  checked={permissions.mostrarDashboard}
                  onChange={() => togglePermission('mostrarDashboard')}
                  className="w-5 h-5 rounded accent-violet-500 cursor-pointer"
                />
                <div className="flex-1">
                  <span className={`${theme.text} font-medium text-sm block`}>📊 Mostrar Dashboard</span>
                  <span className={`text-xs ${theme.textSecondary}`}>Visualizar estatísticas e resumos</span>
                </div>
                {permissions.mostrarDashboard && <Check className="w-5 h-5 text-emerald-500" />}
              </label>

              <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg hover:bg-white/5 transition-colors">
                <input
                  type="checkbox"
                  checked={permissions.adicionarCategoria}
                  onChange={() => togglePermission('adicionarCategoria')}
                  className="w-5 h-5 rounded accent-violet-500 cursor-pointer"
                />
                <div className="flex-1">
                  <span className={`${theme.text} font-medium text-sm block`}>🏷️ Adicionar Categoria</span>
                  <span className={`text-xs ${theme.textSecondary}`}>Criar novas categorias</span>
                </div>
                {permissions.adicionarCategoria && <Check className="w-5 h-5 text-emerald-500" />}
              </label>

              <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg hover:bg-white/5 transition-colors">
                <input
                  type="checkbox"
                  checked={permissions.adicionarItem}
                  onChange={() => togglePermission('adicionarItem')}
                  className="w-5 h-5 rounded accent-violet-500 cursor-pointer"
                />
                <div className="flex-1">
                  <span className={`${theme.text} font-medium text-sm block`}>➕ Adicionar Item</span>
                  <span className={`text-xs ${theme.textSecondary}`}>Adicionar novos itens ao estoque</span>
                </div>
                {permissions.adicionarItem && <Check className="w-5 h-5 text-emerald-500" />}
              </label>

              <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg hover:bg-white/5 transition-colors">
                <input
                  type="checkbox"
                  checked={permissions.editarItem}
                  onChange={() => togglePermission('editarItem')}
                  className="w-5 h-5 rounded accent-violet-500 cursor-pointer"
                />
                <div className="flex-1">
                  <span className={`${theme.text} font-medium text-sm block`}>✏️ Editar Item</span>
                  <span className={`text-xs ${theme.textSecondary}`}>Modificar informações dos itens</span>
                </div>
                {permissions.editarItem && <Check className="w-5 h-5 text-emerald-500" />}
              </label>

              <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg hover:bg-white/5 transition-colors">
                <input
                  type="checkbox"
                  checked={permissions.removerItem}
                  onChange={() => togglePermission('removerItem')}
                  className="w-5 h-5 rounded accent-violet-500 cursor-pointer"
                />
                <div className="flex-1">
                  <span className={`${theme.text} font-medium text-sm block`}>🗑️ Remover Item</span>
                  <span className={`text-xs ${theme.textSecondary}`}>Excluir itens do estoque</span>
                </div>
                {permissions.removerItem && <Check className="w-5 h-5 text-emerald-500" />}
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
