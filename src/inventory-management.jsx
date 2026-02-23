import React, { useState } from 'react';
import {
  Package, Search, Plus, X, Edit, Trash2, Sun, Moon, Shield, Check,
  Calendar, DollarSign, TrendingUp, ShoppingCart,
  History, Tag, Boxes, Minus,
} from 'lucide-react';

export default function InventoryManagement() {
  const [searchTerm, setSearchTerm]                         = useState('');
  const [isDark, setIsDark]                                 = useState(true);
  const [showAddItemModal, setShowAddItemModal]             = useState(false);
  const [showAddCategoryModal, setShowAddCategoryModal]     = useState(false);
  const [showEditCategoryModal, setShowEditCategoryModal]   = useState(false);
  const [showDetailsModal, setShowDetailsModal]             = useState(false);
  const [showHistoryModal, setShowHistoryModal]             = useState(false);
  const [showPriceHistoryModal, setShowPriceHistoryModal]   = useState(false);
  const [showPermissionsModal, setShowPermissionsModal]     = useState(false);
  const [showConsumeModal, setShowConsumeModal]             = useState(false);
  const [showReplenishModal, setShowReplenishModal]         = useState(false);
  const [selectedItem, setSelectedItem]                     = useState(null);
  const [selectedCategory, setSelectedCategory]             = useState('all');
  const [editingCategory, setEditingCategory]               = useState(null);
  const [isLoading, setIsLoading]                           = useState(false);
  const [notification, setNotification]                     = useState(null);

  // ─── Modal de Categoria (NOVO) ────────────────────────────────────────────
  const [showCategoryModal, setShowCategoryModal]           = useState(false);
  const [selectedCategoryModal, setSelectedCategoryModal]   = useState(null); // category do itemsByCategory
  const [categoryTab, setCategoryTab]                       = useState('itens'); // 'itens' | 'financeiro'

  const [permissions, setPermissions] = useState({
    acessoTotal: true,
    mostrarDashboard: true,
    adicionarEditarCategoria: true,
    adicionarEditarItem: true,
    reporEstoque: true,
    verHistoricoPreco: true,
    verHistoricoReposicao: true,
    consumirItem: true,
  });

  // ─── Handlers ───────────────────────────────────────────────────────────────
  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const togglePermission = (key) => {
    if (key === 'acessoTotal') {
      const v = !permissions.acessoTotal;
      setPermissions({
        acessoTotal: v,
        mostrarDashboard: v,
        adicionarEditarCategoria: v,
        adicionarEditarItem: v,
        reporEstoque: v,
        verHistoricoPreco: v,
        verHistoricoReposicao: v,
        consumirItem: v,
      });
    } else {
      setPermissions((p) => ({ ...p, [key]: !p[key] }));
    }
  };

  const withLoading = (fn, delay = 1000) => () => {
    setIsLoading(true);
    setTimeout(() => { setIsLoading(false); fn(); }, delay);
  };

  const handleAddItem          = withLoading(() => { setShowAddItemModal(false);      showNotification('Item adicionado com sucesso!'); }, 1500);
  const handleAddCategory      = withLoading(() => { setShowAddCategoryModal(false);  showNotification('Categoria criada com sucesso!'); });
  const handleUpdateCategory   = withLoading(() => { setShowEditCategoryModal(false); setEditingCategory(null); showNotification('Categoria atualizada com sucesso!'); });
  const handleEditItem         = withLoading(() => { setShowDetailsModal(false);      showNotification('Item atualizado com sucesso!'); });
  const handleConfirmConsume   = withLoading(() => { setShowConsumeModal(false);      showNotification('Item consumido com sucesso!'); });
  const handleConfirmReplenish = withLoading(() => { setShowReplenishModal(false);    showNotification('Estoque reposto com sucesso!'); });

  const handleEditCategory     = (cat)  => { setEditingCategory(cat); setShowEditCategoryModal(true); };
  const handleConsumeItem      = (item) => { setSelectedItem(item);   setShowConsumeModal(true); };
  const handleReplenishItem    = (item) => { setSelectedItem(item);   setShowReplenishModal(true); };
  const handleItemClick        = (item) => { setSelectedItem(item);   setShowDetailsModal(true); };
  const handleShowHistory      = (item) => { setSelectedItem(item);   setShowHistoryModal(true); };
  const handleShowPriceHistory = (item) => { setSelectedItem(item);   setShowPriceHistoryModal(true); };

  // Modal Categoria
  const handleOpenCategoryModal = (categoryObj) => {
    setSelectedCategoryModal(categoryObj);
    setCategoryTab('itens');
    setShowCategoryModal(true);
  };

  const handleCloseCategoryModal = () => {
    setShowCategoryModal(false);
    setSelectedCategoryModal(null);
  };

  // ─── Data ────────────────────────────────────────────────────────────────────
  const categories = [
    { id: 1, nome: 'Limpeza',      descricao: 'Produtos de limpeza e higiene',         icone: '🧹' },
    { id: 2, nome: 'Cama & Banho', descricao: 'Lençóis, toalhas e acessórios',         icone: '🛏️' },
    { id: 3, nome: 'Alimentos',    descricao: 'Alimentos não perecíveis',              icone: '🍞' },
    { id: 4, nome: 'Bebidas',      descricao: 'Bebidas e refrigerantes',               icone: '🥤' },
    { id: 5, nome: 'Utensílios',   descricao: 'Utensílios de cozinha e copa',          icone: '🍴' },
    { id: 6, nome: 'Manutenção',   descricao: 'Ferramentas e materiais de manutenção', icone: '🔧' },
  ];

  const items = [
    { id:  1, nome: 'Detergente Neutro 500ml',       categoria: 'Limpeza',      categoriaId: 1, quantidade: 24, valorCompra:  2.50, valorVenda:  5.00, ultimaReposicao: '10/02/2026' },
    { id:  2, nome: 'Sabão em Pó 1kg',               categoria: 'Limpeza',      categoriaId: 1, quantidade: 15, valorCompra:  8.90, valorVenda: 15.00, ultimaReposicao: '08/02/2026' },
    { id:  3, nome: 'Desinfetante Lavanda 2L',        categoria: 'Limpeza',      categoriaId: 1, quantidade:  5, valorCompra:  6.50, valorVenda: 12.00, ultimaReposicao: '05/02/2026' },
    { id:  4, nome: 'Papel Higiênico (pacote 12un)',  categoria: 'Limpeza',      categoriaId: 1, quantidade: 30, valorCompra: 18.00, valorVenda: 30.00, ultimaReposicao: '12/02/2026' },
    { id:  5, nome: 'Jogo de Lençol Casal Branco',   categoria: 'Cama & Banho', categoriaId: 2, quantidade: 12, valorCompra: 45.00, valorVenda: 90.00, ultimaReposicao: '01/02/2026' },
    { id:  6, nome: 'Toalha de Banho Grande',         categoria: 'Cama & Banho', categoriaId: 2, quantidade: 25, valorCompra: 22.00, valorVenda: 45.00, ultimaReposicao: '03/02/2026' },
    { id:  7, nome: 'Travesseiro Fibra',              categoria: 'Cama & Banho', categoriaId: 2, quantidade:  8, valorCompra: 18.00, valorVenda: 35.00, ultimaReposicao: '28/01/2026' },
    { id:  8, nome: 'Toalha de Rosto',                categoria: 'Cama & Banho', categoriaId: 2, quantidade: 35, valorCompra:  8.00, valorVenda: 18.00, ultimaReposicao: '05/02/2026' },
    { id:  9, nome: 'Café Torrado 500g',              categoria: 'Alimentos',    categoriaId: 3, quantidade: 18, valorCompra: 12.00, valorVenda: 20.00, ultimaReposicao: '11/02/2026' },
    { id: 10, nome: 'Açúcar 1kg',                    categoria: 'Alimentos',    categoriaId: 3, quantidade: 20, valorCompra:  4.50, valorVenda:  8.00, ultimaReposicao: '09/02/2026' },
    { id: 11, nome: 'Biscoito Maisena 400g',          categoria: 'Alimentos',    categoriaId: 3, quantidade:  8, valorCompra:  3.80, valorVenda:  7.00, ultimaReposicao: '07/02/2026' },
    { id: 12, nome: 'Água Mineral 500ml (cx 12un)',   categoria: 'Bebidas',      categoriaId: 4, quantidade: 40, valorCompra: 15.00, valorVenda: 30.00, ultimaReposicao: '12/02/2026' },
    { id: 13, nome: 'Refrigerante 2L',                categoria: 'Bebidas',      categoriaId: 4, quantidade: 15, valorCompra:  5.50, valorVenda: 10.00, ultimaReposicao: '10/02/2026' },
    { id: 14, nome: 'Prato Fundo Branco',             categoria: 'Utensílios',   categoriaId: 5, quantidade: 50, valorCompra:  3.50, valorVenda:  8.00, ultimaReposicao: '20/01/2026' },
    { id: 15, nome: 'Copo de Vidro 300ml',            categoria: 'Utensílios',   categoriaId: 5, quantidade: 48, valorCompra:  2.00, valorVenda:  5.00, ultimaReposicao: '25/01/2026' },
    { id: 16, nome: 'Talheres Inox (jogo)',           categoria: 'Utensílios',   categoriaId: 5, quantidade: 20, valorCompra: 25.00, valorVenda: 50.00, ultimaReposicao: '15/01/2026' },
    { id: 17, nome: 'Lâmpada LED 9W',                categoria: 'Manutenção',   categoriaId: 6, quantidade: 12, valorCompra:  8.00, valorVenda: 15.00, ultimaReposicao: '30/01/2026' },
    { id: 18, nome: 'Chave Philips',                  categoria: 'Manutenção',   categoriaId: 6, quantidade:  3, valorCompra: 12.00, valorVenda: 25.00, ultimaReposicao: '10/01/2026' },
  ];

  const historyData = {
    valorTotalInvestido: 90.0, valorTotalVenda: 225.0, lucro: 135.0,
    itemReposicaoList: [
      { id: 78, dataHoraRegistro: '2026-02-18T14:02:08', valorCompraUnidade: 1.2, valorVendaUnidade: 3.0, fornecedor: 'Distribuidora XYZ', funcionarioNome: 'admin', qtdUnidades: 25, valorTotalInvestido: 30.0, valorTotalVenda:  75.0, lucro:  45.0 },
      { id: 54, dataHoraRegistro: '2026-02-18T14:02:08', valorCompraUnidade: 1.2, valorVendaUnidade: 3.0, fornecedor: 'Distribuidora XYZ', funcionarioNome: 'admin', qtdUnidades: 50, valorTotalInvestido: 60.0, valorTotalVenda: 150.0, lucro:  90.0 },
    ],
  };

  const priceHistoryData = [
    { id: 48, dataHoraRegistro: '2026-02-18T13:21:38', valorCompraUnidade: 1.2, valorVendaUnidade: 3.0, funcionarioNome: 'João Silva Santos' },
    { id: 24, dataHoraRegistro: '2026-02-18T13:21:38', valorCompraUnidade: 1.2, valorVendaUnidade: 3.0, funcionarioNome: 'João Silva Santos' },
  ];

  // ─── Computed ────────────────────────────────────────────────────────────────
  const filteredItems = items.filter((item) =>
    (item.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
     item.categoria.toLowerCase().includes(searchTerm.toLowerCase())) &&
    (selectedCategory === 'all' || item.categoriaId === selectedCategory)
  );

  const itemsByCategory = categories.map((cat) => {
    const catItems = items.filter((i) => i.categoriaId === cat.id);
    const valorTotalInvestido = catItems.reduce((s, i) => s + i.quantidade * i.valorCompra, 0);
    const valorTotalVenda     = catItems.reduce((s, i) => s + i.quantidade * i.valorVenda,  0);
    return {
      ...cat,
      items: filteredItems.filter((i) => i.categoriaId === cat.id),
      totalItems: catItems.length,
      valorTotalInvestido,
      valorTotalVenda,
      lucro: valorTotalVenda - valorTotalInvestido,
    };
  });

  const stats = {
    totalCategorias:   categories.length,
    totalItens:        items.length,
    totalValorEstoque: items.reduce((s, i) => s + i.quantidade * i.valorCompra, 0),
    lucroTotal:        items.reduce((s, i) => s + i.quantidade * (i.valorVenda - i.valorCompra), 0),
  };

  // ─── Theme (mantido do seu paste) ───────────────────────────────────────────
  const theme = {
    bg:            isDark ? 'bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950'      : 'bg-gradient-to-br from-slate-50 via-white to-slate-100',
    bgOverlay:     isDark ? 'bg-[radial-gradient(circle_at_50%_120%,rgba(120,119,198,0.15),transparent)]' : 'bg-[radial-gradient(circle_at_50%_120%,rgba(120,119,198,0.1),transparent)]',
    text:          isDark ? 'text-white'           : 'text-slate-900',
    textSecondary: isDark ? 'text-slate-400'       : 'text-slate-600',
    card:          isDark ? 'bg-white/5 border-white/10'  : 'bg-white border-slate-200',
    cardHover:     isDark ? 'hover:bg-white/10'    : 'hover:bg-slate-50',
    input:         isDark ? 'bg-white/10 border-white/15 text-white placeholder-slate-500' : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400',
    tableHeader:   isDark ? 'bg-white/5'           : 'bg-slate-100',
    divider:       isDark ? 'border-white/10'      : 'border-slate-200',
    rowHover:      isDark
      ? 'hover:bg-violet-500/20 hover:shadow-[0_0_20px_rgba(139,92,246,0.3)] hover:-translate-y-0.5 hover:border-l-4 hover:border-violet-500'
      : 'hover:bg-violet-100 hover:shadow-[0_4px_12px_rgba(139,92,246,0.2)] hover:-translate-y-0.5 hover:border-l-4 hover:border-violet-500',
    button:        isDark ? 'bg-white/10 hover:bg-white/20 border-white/10' : 'bg-slate-100 hover:bg-slate-200 border-slate-300',
  };

  const inputCls = `w-full px-3 py-2 ${theme.input} rounded-lg text-sm border focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent`;

  // ─── Dashboard cards ────────────────────────────────────────────────────────
  const dashCards = [
    { label: 'CATEGORIAS',     sub: 'Categorias cadastradas',  value: stats.totalCategorias,                    icon: <Tag        className="w-5 h-5 text-white" />, color: 'from-blue-600 to-cyan-700'     },
    { label: 'TOTAL DE ITENS', sub: 'Itens cadastrados',       value: stats.totalItens,                         icon: <Package    className="w-5 h-5 text-white" />, color: 'from-violet-600 to-purple-700' },
    { label: 'VALOR ESTOQUE',  sub: 'Valor total em estoque',  value: `R$ ${stats.totalValorEstoque.toFixed(0)}`, icon: <DollarSign className="w-5 h-5 text-white" />, color: 'from-emerald-600 to-teal-700' },
    { label: 'LUCRO POTENCIAL',sub: 'Lucro estimado total',    value: `R$ ${stats.lucroTotal.toFixed(0)}`,      icon: <TrendingUp className="w-5 h-5 text-white" />, color: 'from-rose-600 to-red-700'     },
  ];

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className={`min-h-screen relative ${theme.bg}`}>
      <div className={`fixed inset-0 ${theme.bgOverlay} pointer-events-none`} />

      <div className="relative max-w-[1600px] mx-auto p-4 sm:p-8">

        {/* ── Header ── */}
        <header className="mb-6 pt-6 flex items-center justify-between">
          <div>
            <h1 className={`text-3xl font-bold ${theme.text} mb-1 tracking-tight`}>Almoxarifado</h1>
            <p className={`${theme.textSecondary} text-sm flex items-center gap-2`}>
              <Package className="w-3.5 h-3.5" /> Gerenciamento de Estoque e Inventário
            </p>
          </div>
          <div className="flex gap-2">
            {[
              { label: 'Permissões', icon: <Shield className="w-4 h-4" />, action: () => setShowPermissionsModal(true) },
              { label: isDark ? 'Light' : 'Dark', icon: isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />, action: () => setIsDark(!isDark) },
            ].map(({ label, icon, action }) => (
              <button
                key={label}
                onClick={action}
                className={`px-4 py-2 ${theme.button} ${theme.text} rounded-lg border text-sm font-medium flex items-center gap-2 hover:scale-105 active:scale-95 transition-all`}
              >
                {icon} {label}
              </button>
            ))}
          </div>
        </header>

        {/* ── Dashboard ── */}
        {permissions.mostrarDashboard && (
          <div className={`${theme.card} rounded-xl p-4 mb-6 border shadow-xl`}>
            <div className="flex items-center gap-2 mb-4">
              <Boxes className="w-4 h-4 text-violet-500" />
              <h2 className={`text-sm font-bold ${theme.text} uppercase tracking-wider`}>Dashboard do Estoque</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {dashCards.map((c) => (
                <div key={c.label} className={`bg-gradient-to-br ${c.color} rounded-lg p-4 shadow-lg`}>
                  <div className="flex items-center gap-3 mb-2">
                    {c.icon}
                    <span className="text-white font-bold text-sm">{c.label}</span>
                  </div>
                  <p className="text-3xl font-bold text-white">{c.value}</p>
                  <p className="text-white/80 text-xs mt-1">{c.sub}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Categorias de Estoque (ATUALIZADO) ── */}
        <div className={`${theme.card} rounded-xl border shadow-xl overflow-hidden mb-6`}>
          <div className={`px-4 py-3 border-b ${theme.divider} flex flex-col sm:flex-row gap-3 sm:items-center justify-between`}>
            <div>
              <h2 className={`text-lg font-bold ${theme.text}`}>Categorias de Estoque</h2>
              <p className={`${theme.textSecondary} text-xs`}>Clique em uma categoria para abrir o modal com itens e resumo financeiro.</p>
            </div>

            <div className="flex flex-wrap gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:flex-initial">
                <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 ${theme.textSecondary}`} />
                <input
                  type="text"
                  placeholder="Buscar item..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={`w-full sm:w-56 pl-9 pr-3 py-2 ${theme.input} rounded-lg text-sm border focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent`}
                />
              </div>

              {permissions.adicionarEditarCategoria && (
                <button
                  onClick={() => setShowAddCategoryModal(true)}
                  className="px-3 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-medium flex items-center gap-2 hover:scale-105 active:scale-95 hover:shadow-lg hover:shadow-violet-500/50 transition-all"
                >
                  <Plus className="w-4 h-4" /> Nova Categoria
                </button>
              )}
            </div>
          </div>

          {/* Cards de categoria */}
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {itemsByCategory.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => handleOpenCategoryModal(category)}
                className={`text-left rounded-xl border transition-colors ${theme.cardHover} ${theme.card}`}
              >
                <div className="p-4 flex items-center gap-3">
                  {/* Ícone único (igual ao TOTAL DE ITENS) */}
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${isDark ? 'bg-slate-800/80' : 'bg-slate-100'}`}>
                    <Package className={`${isDark ? 'text-slate-200' : 'text-slate-700'} w-5 h-5`} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`${theme.text} font-semibold text-sm`}>{category.nome}</span>
                      <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-600'}`}>
                        {category.totalItems} {category.totalItems === 1 ? 'item' : 'itens'}
                      </span>
                    </div>
                    <p className={`${theme.textSecondary} text-xs mt-0.5 truncate`}>{category.descricao}</p>
                  </div>
                </div>

                {/* <div className={`px-4 pb-3 pt-0 flex items-center gap-4 border-t ${theme.divider}`}>
                  <div>
                    <p className={`text-[10px] ${theme.textSecondary} uppercase tracking-wide`}>Investido</p>
                    <p className="text-xs font-semibold text-rose-400">R$ {category.valorTotalInvestido.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className={`text-[10px] ${theme.textSecondary} uppercase tracking-wide`}>Venda</p>
                    <p className="text-xs font-semibold text-emerald-400">R$ {category.valorTotalVenda.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className={`text-[10px] ${theme.textSecondary} uppercase tracking-wide`}>Lucro</p>
                    <p className="text-xs font-semibold text-violet-400">R$ {category.lucro.toFixed(2)}</p>
                  </div>
                </div> */}
              </button>
            ))}
          </div>
        </div>

      </div>

      {/* ───────────────── Modal Categoria (ATUALIZADO) ───────────────── */}
      {showCategoryModal && selectedCategoryModal && (() => {
        const cat = selectedCategoryModal;
        const allCatItems = items.filter((i) => i.categoriaId === cat.id);

        const valorTotalInvestido = allCatItems.reduce((s, i) => s + i.quantidade * i.valorCompra, 0);
        const valorTotalVenda     = allCatItems.reduce((s, i) => s + i.quantidade * i.valorVenda,  0);
        const lucro               = valorTotalVenda - valorTotalInvestido;

        return (
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-start justify-center z-50 p-4 overflow-y-auto"
            onClick={handleCloseCategoryModal}
          >
            <div
              className={`${theme.card} rounded-xl border shadow-2xl w-full max-w-5xl my-8`}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className={`px-5 py-4 border-b ${theme.divider} flex items-center justify-between`}>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                    <Package className={`w-5 h-5 ${isDark ? 'text-slate-200' : 'text-slate-700'}`} />
                  </div>
                  <div>
                    <h3 className={`font-semibold text-base ${theme.text}`}>{cat.nome}</h3>
                    <p className={`text-xs ${theme.textSecondary}`}>{cat.descricao}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {permissions.adicionarEditarCategoria && (
                    <button
                      onClick={() => { handleCloseCategoryModal(); handleEditCategory(cat); }}
                      className={`px-3 py-1.5 text-xs rounded-lg border ${theme.button} ${theme.text} flex items-center gap-1.5 transition-all hover:scale-105 active:scale-95`}
                    >
                      <Edit className="w-3.5 h-3.5" /> Editar Categoria
                    </button>
                  )}
                  <button
                    onClick={handleCloseCategoryModal}
                    className={`p-2 rounded-lg border ${theme.button} ${theme.text} transition-all hover:scale-110 active:scale-95`}
                    aria-label="Fechar"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Tabs */}
              <div className={`flex border-b ${theme.divider} px-5`}>
                {[
                  { key: 'itens',      label: 'Itens',             Icon: Package    },
                  { key: 'financeiro', label: 'Resumo Financeiro', Icon: DollarSign },
                ].map(({ key, label, Icon }) => (
                  <button
                    key={key}
                    onClick={() => setCategoryTab(key)}
                    className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors
                      ${categoryTab === key
                        ? 'border-violet-500 text-violet-500'
                        : `border-transparent ${theme.textSecondary} hover:${theme.text}`
                      }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {label}
                  </button>
                ))}
              </div>

              {/* Aba Itens (TABELA) */}
              {categoryTab === 'itens' && (
                <div className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <p className={`text-xs ${theme.textSecondary}`}>
                      {cat.items.length} de {allCatItems.length} item(ns) exibidos
                      {searchTerm && <span className="ml-1 italic">(filtro: "{searchTerm}")</span>}
                    </p>

                    {permissions.adicionarEditarItem && (
                      <button
                        onClick={() => setShowAddItemModal(true)}
                        className="px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all hover:scale-105 active:scale-95"
                      >
                        <Plus className="w-3.5 h-3.5" /> Novo Item
                      </button>
                    )}
                  </div>

                  {cat.items.length === 0 ? (
                    <div className={`text-center py-12 ${theme.card} rounded-lg border`}>
                      <Package className={`w-8 h-8 mx-auto mb-2 ${theme.textSecondary} opacity-40`} />
                      <p className={`${theme.textSecondary} text-sm`}>Nenhum item encontrado.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className={`border-b ${theme.divider} ${theme.tableHeader}`}>
                            {[
                              { label: 'Item',          align: 'text-left' },
                              { label: 'Qtd',           align: 'text-center' },
                              { label: 'Compra Un.',    align: 'text-right' },
                              { label: 'Venda Un.',     align: 'text-right' },
                              { label: 'Total Estoque', align: 'text-right' },
                              { label: 'Últ. Repos.',   align: 'text-left' },
                              { label: 'Ações',         align: 'text-right' },
                            ].map(({ label, align }) => (
                              <th key={label} className={`p-3 ${theme.textSecondary} font-semibold text-[10px] uppercase tracking-wider ${align}`}>
                                {label}
                              </th>
                            ))}
                          </tr>
                        </thead>

                        <tbody className={`divide-y ${theme.divider}`}>
                          {cat.items.map((item) => (
                            <tr
                              key={item.id}
                              onClick={() => handleItemClick(item)}
                              className={`${theme.cardHover} transition-colors cursor-pointer`}
                            >
                              <td className="p-3">
                                <span className={`${theme.text} font-medium text-sm`}>{item.nome}</span>
                              </td>

                              <td className="p-3 text-center">
                                <span className={`px-2 py-0.5 rounded-full text-xs font-bold
                                  ${item.quantidade <= 10
                                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                    : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                  }`}
                                >
                                  {item.quantidade}
                                </span>
                              </td>

                              <td className="p-3 text-right">
                                <span className={`${theme.text} text-sm`}>R$ {item.valorCompra.toFixed(2)}</span>
                              </td>

                              <td className="p-3 text-right">
                                <span className="text-emerald-400 font-bold text-sm">R$ {item.valorVenda.toFixed(2)}</span>
                              </td>

                              <td className="p-3 text-right">
                                <span className="text-violet-400 font-bold text-sm">
                                  R$ {(item.quantidade * item.valorCompra).toFixed(2)}
                                </span>
                              </td>

                              <td className="p-3">
                                <div className={`${theme.textSecondary} text-sm flex items-center gap-2`}>
                                  <Calendar className="w-4 h-4 text-violet-500" />
                                  {item.ultimaReposicao}
                                </div>
                              </td>

                              <td className="p-3">
                                <div className="flex gap-1.5 justify-end" onClick={(e) => e.stopPropagation()}>
                                  {permissions.consumirItem && (
                                    <button
                                      onClick={() => handleConsumeItem(item)}
                                      className="px-2 py-1 text-[11px] bg-rose-600/80 hover:bg-rose-600 text-white rounded-lg flex items-center gap-1 transition-all hover:scale-105 active:scale-95"
                                    >
                                      <Minus className="w-3 h-3" /> Consumir
                                    </button>
                                  )}
                                  {permissions.reporEstoque && (
                                    <button
                                      onClick={() => handleReplenishItem(item)}
                                      className="px-2 py-1 text-[11px] bg-emerald-600/80 hover:bg-emerald-600 text-white rounded-lg flex items-center gap-1 transition-all hover:scale-105 active:scale-95"
                                    >
                                      <Plus className="w-3 h-3" /> Repor
                                    </button>
                                  )}
                                  {(permissions.verHistoricoReposicao || permissions.verHistoricoPreco) && (
                                    <button
                                      onClick={() => handleShowHistory(item)}
                                      className={`px-2 py-1 text-[11px] ${theme.button} ${theme.text} border rounded-lg flex items-center gap-1 transition-all hover:scale-105 active:scale-95`}
                                    >
                                      <History className="w-3 h-3" /> Histórico
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Aba Resumo Financeiro */}
              {categoryTab === 'financeiro' && (
                <div className="p-5 space-y-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      { label: 'Qtd. de Tipos',   value: allCatItems.length,                          cls: theme.text },
                      { label: 'Total Investido', value: `R$ ${valorTotalInvestido.toFixed(2)}`,      cls: 'text-rose-400' },
                      { label: 'Valor de Venda',  value: `R$ ${valorTotalVenda.toFixed(2)}`,          cls: 'text-emerald-400' },
                      { label: 'Lucro Potencial', value: `R$ ${lucro.toFixed(2)}`,                    cls: 'text-violet-400' },
                    ].map((kpi) => (
                      <div key={kpi.label} className={`${theme.card} rounded-lg border p-4`}>
                        <p className={`text-xs ${theme.textSecondary} uppercase tracking-wider`}>{kpi.label}</p>
                        <p className={`${kpi.cls} text-xl font-bold mt-1`}>{kpi.value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className={`border-b ${theme.divider} ${theme.tableHeader}`}>
                          {['Item','Qtd','Compra Un.','Venda Un.','Margem','Lucro Total'].map((h, i) => (
                            <th
                              key={h}
                              className={`p-3 ${theme.textSecondary} font-semibold text-[10px] uppercase tracking-wider ${
                                i === 0 ? 'text-left' : i === 1 ? 'text-center' : 'text-right'
                              }`}
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className={`divide-y ${theme.divider}`}>
                        {allCatItems.map((item) => {
                          const margin = ((item.valorVenda - item.valorCompra) / item.valorCompra) * 100;
                          const lucroTotal = item.quantidade * (item.valorVenda - item.valorCompra);
                          return (
                            <tr key={item.id} className={`${theme.cardHover} transition-colors`}>
                              <td className="p-3"><span className={`${theme.text} font-medium text-sm`}>{item.nome}</span></td>
                              <td className="p-3 text-center"><span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">{item.quantidade}</span></td>
                              <td className="p-3 text-right"><span className={`${theme.text} text-sm`}>R$ {item.valorCompra.toFixed(2)}</span></td>
                              <td className="p-3 text-right"><span className="text-emerald-400 font-bold text-sm">R$ {item.valorVenda.toFixed(2)}</span></td>
                              <td className="p-3 text-right"><span className="text-violet-400 font-bold text-sm">{margin.toFixed(1)}%</span></td>
                              <td className="p-3 text-right"><span className="text-violet-400 font-bold text-sm">R$ {lucroTotal.toFixed(2)}</span></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Footer */}
              <div className={`p-4 border-t ${theme.divider} flex justify-end`}>
                <button
                  onClick={handleCloseCategoryModal}
                  className={`px-4 py-2 ${theme.button} ${theme.text} rounded-lg border text-sm font-medium hover:scale-105 active:scale-95 transition-all`}
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Modal Nova Categoria ── */}
      {showAddCategoryModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`${theme.card} rounded-xl border shadow-2xl max-w-md w-full`}>
            <div className={`p-4 border-b ${theme.divider} flex items-center justify-between`}>
              <div className="flex items-center gap-2"><Tag className="w-5 h-5 text-violet-500" /><h3 className={`text-lg font-bold ${theme.text}`}>Nova Categoria</h3></div>
              <button onClick={() => setShowAddCategoryModal(false)} className={`${theme.textSecondary} hover:scale-110 active:scale-90 transition-transform`}><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className={`block text-sm font-medium ${theme.text} mb-1.5`}>Nome da Categoria *</label>
                <input type="text" placeholder="Ex: Eletrônicos" className={inputCls} />
              </div>

              <div>
                <label className={`block text-sm font-medium ${theme.text} mb-1.5`}>Descrição</label>
                <textarea placeholder="Descreva a categoria..." rows={3} className={`${inputCls} resize-none`} />
              </div>

              <div className="flex gap-2 pt-2">
                <button onClick={() => setShowAddCategoryModal(false)} className={`flex-1 px-4 py-2 ${theme.button} ${theme.text} rounded-lg border text-sm font-medium hover:scale-105 active:scale-95 transition-all`}>Cancelar</button>
                <button onClick={handleAddCategory} className="flex-1 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-medium hover:scale-105 active:scale-95 hover:shadow-lg transition-all">Criar Categoria</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Editar Categoria ── */}
      {showEditCategoryModal && editingCategory && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`${theme.card} rounded-xl border shadow-2xl max-w-md w-full`}>
            <div className={`p-4 border-b ${theme.divider} flex items-center justify-between`}>
              <div className="flex items-center gap-2"><Edit className="w-5 h-5 text-violet-500" /><h3 className={`text-lg font-bold ${theme.text}`}>Editar Categoria</h3></div>
              <button onClick={() => setShowEditCategoryModal(false)} className={`${theme.textSecondary} hover:scale-110 active:scale-90 transition-transform`}><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className={`block text-sm font-medium ${theme.text} mb-1.5`}>Nome da Categoria *</label>
                <input type="text" defaultValue={editingCategory.nome} className={inputCls} />
              </div>

              <div>
                <label className={`block text-sm font-medium ${theme.text} mb-1.5`}>Descrição</label>
                <textarea defaultValue={editingCategory.descricao} rows={3} className={`${inputCls} resize-none`} />
              </div>

              <div className="flex gap-2 pt-2">
                <button onClick={() => setShowEditCategoryModal(false)} className={`flex-1 px-4 py-2 ${theme.button} ${theme.text} rounded-lg border text-sm font-medium hover:scale-105 active:scale-95 transition-all`}>Cancelar</button>
                <button onClick={handleUpdateCategory} className="flex-1 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-medium hover:scale-105 active:scale-95 hover:shadow-lg transition-all">Salvar Alterações</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Adicionar Item ── */}
      {showAddItemModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`${theme.card} rounded-xl border shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto`}>
            <div className={`p-4 border-b ${theme.divider} flex items-center justify-between sticky top-0 ${theme.card} z-10`}>
              <div className="flex items-center gap-2"><ShoppingCart className="w-5 h-5 text-violet-500" /><h3 className={`text-lg font-bold ${theme.text}`}>Adicionar Item ao Estoque</h3></div>
              <button onClick={() => setShowAddItemModal(false)} className={`${theme.textSecondary} hover:scale-110 active:scale-90 transition-transform`}><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-6">
              <div>
                <h4 className={`text-sm font-bold ${theme.text} mb-3 uppercase tracking-wider flex items-center gap-2`}><Package className="w-4 h-4 text-violet-500" />Informações do Item</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className={`block text-sm font-medium ${theme.text} mb-1.5`}>Descrição do Item *</label>
                    <input type="text" placeholder="Ex: Detergente Neutro 500ml" className={inputCls} />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium ${theme.text} mb-1.5`}>Categoria *</label>
                    <select className={inputCls}>
                      <option value="">Selecione...</option>
                      {categories.map((c) => <option key={c.id} value={c.id}>{c.icone} {c.nome}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <h4 className={`text-sm font-bold ${theme.text} mb-3 uppercase tracking-wider flex items-center gap-2`}><DollarSign className="w-4 h-4 text-violet-500" />Valores</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={`block text-sm font-medium ${theme.text} mb-1.5`}>Valor de Compra (unitário) *</label>
                    <input type="number" step="0.01" placeholder="0.00" className={inputCls} />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium ${theme.text} mb-1.5`}>Valor de Venda (unitário) *</label>
                    <input type="number" step="0.01" placeholder="0.00" className={inputCls} />
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button onClick={() => setShowAddItemModal(false)} className={`flex-1 px-4 py-2 ${theme.button} ${theme.text} rounded-lg border text-sm font-medium hover:scale-105 active:scale-95 transition-all`}>Cancelar</button>
                <button onClick={handleAddItem} className="flex-1 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-medium hover:scale-105 active:scale-95 hover:shadow-lg transition-all">Adicionar ao Estoque</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Consumir Item ── */}
      {showConsumeModal && selectedItem && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`${theme.card} rounded-xl border shadow-2xl max-w-md w-full`}>
            <div className={`p-4 border-b ${theme.divider} flex items-center justify-between`}>
              <div className="flex items-center gap-2"><Minus className="w-5 h-5 text-rose-500" /><h3 className={`text-lg font-bold ${theme.text}`}>Consumir Item do Estoque</h3></div>
              <button onClick={() => setShowConsumeModal(false)} className={`${theme.textSecondary} hover:scale-110 active:scale-90 transition-transform`}><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className={`p-3 rounded-lg ${theme.card} border`}>
                <p className={`${theme.textSecondary} text-xs mb-1`}>Item Selecionado</p>
                <p className={`${theme.text} font-bold`}>{selectedItem.nome}</p>
                <p className={`${theme.textSecondary} text-xs mt-1`}>
                  Quantidade disponível: <span className="text-emerald-400 font-semibold">{selectedItem.quantidade}</span>
                </p>
              </div>

              <div>
                <label className={`block text-sm font-medium ${theme.text} mb-1.5`}>Quantidade a Consumir *</label>
                <input type="number" placeholder="0" min="1" max={selectedItem.quantidade} className={inputCls} />
              </div>

              <div>
                <label className={`block text-sm font-medium ${theme.text} mb-1.5`}>Quarto <span className={theme.textSecondary}>(opcional)</span></label>
                <select className={inputCls}>
                  <option value="">Nenhum (uso geral)</option>
                  {Array.from({ length: 22 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>Quarto {String(n).padStart(2, '0')}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className={`block text-sm font-medium ${theme.text} mb-1.5`}>Tipo de Pagamento <span className={theme.textSecondary}>(opcional)</span></label>
                <select className={inputCls}>
                  <option value="">Sem pagamento registrado</option>
                  {['Dinheiro','Cartão de Crédito','Cartão de Débito','PIX','Link NUBANK','Transferência Bancária','PENDENTE'].map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              <div className={`flex items-start gap-3 p-3 rounded-lg border ${theme.divider} ${theme.card}`}>
                <input type="checkbox" id="despesaPessoal" className="w-4 h-4 mt-0.5 rounded accent-rose-500 cursor-pointer flex-shrink-0" />
                <label htmlFor="despesaPessoal" className="cursor-pointer">
                  <span className={`${theme.text} font-medium text-sm block`}>Despesa Pessoal</span>
                  <span className={`${theme.textSecondary} text-xs`}>Marque se este consumo é de uso pessoal e não do hotel</span>
                </label>
              </div>

              <div className="flex gap-2 pt-2">
                <button onClick={() => setShowConsumeModal(false)} className={`flex-1 px-4 py-2 ${theme.button} ${theme.text} rounded-lg border text-sm font-medium hover:scale-105 active:scale-95 transition-all`}>Cancelar</button>
                <button onClick={handleConfirmConsume} className="flex-1 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-medium hover:scale-105 active:scale-95 hover:shadow-lg hover:shadow-rose-500/50 transition-all">Confirmar Consumo</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Repor Estoque ── */}
      {showReplenishModal && selectedItem && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`${theme.card} rounded-xl border shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto`}>
            <div className={`p-4 border-b ${theme.divider} flex items-center justify-between sticky top-0 ${theme.card} z-10`}>
              <div className="flex items-center gap-2"><Plus className="w-5 h-5 text-emerald-500" /><h3 className={`text-lg font-bold ${theme.text}`}>Repor Estoque</h3></div>
              <button onClick={() => setShowReplenishModal(false)} className={`${theme.textSecondary} hover:scale-110 active:scale-90 transition-transform`}><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className={`p-3 rounded-lg ${theme.card} border`}>
                <p className={`${theme.textSecondary} text-xs mb-1`}>Item Selecionado</p>
                <p className={`${theme.text} font-bold`}>{selectedItem.nome}</p>
                <p className={`${theme.textSecondary} text-xs mt-1`}>Quantidade atual: <span className="text-emerald-400 font-semibold">{selectedItem.quantidade}</span></p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className={`block text-sm font-medium ${theme.text} mb-1.5`}>Quantidade *</label><input type="number" placeholder="0" min="1" className={inputCls} /></div>
                <div><label className={`block text-sm font-medium ${theme.text} mb-1.5`}>Fornecedor *</label><input type="text" placeholder="Nome do fornecedor" className={inputCls} /></div>
                <div><label className={`block text-sm font-medium ${theme.text} mb-1.5`}>Valor de Compra (unidade) *</label><input type="number" step="0.01" defaultValue={selectedItem.valorCompra} className={inputCls} /></div>
                <div><label className={`block text-sm font-medium ${theme.text} mb-1.5`}>Valor de Venda (unidade) *</label><input type="number" step="0.01" defaultValue={selectedItem.valorVenda} className={inputCls} /></div>
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={() => setShowReplenishModal(false)} className={`flex-1 px-4 py-2 ${theme.button} ${theme.text} rounded-lg border text-sm font-medium hover:scale-105 active:scale-95 transition-all`}>Cancelar</button>
                <button onClick={handleConfirmReplenish} className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium hover:scale-105 active:scale-95 hover:shadow-lg transition-all">Confirmar Reposição</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Detalhes do Item ── */}
      {showDetailsModal && selectedItem && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`${theme.card} rounded-xl border shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto`}>
            <div className={`p-4 border-b ${theme.divider} flex items-center justify-between`}>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/20"><Package className="w-5 h-5 text-emerald-500" /></div>
                <div>
                  <h3 className={`text-lg font-bold ${theme.text}`}>{selectedItem.nome}</h3>
                  <p className={`text-sm ${theme.textSecondary}`}>{selectedItem.categoria}</p>
                </div>
              </div>
              <button onClick={() => setShowDetailsModal(false)} className={`${theme.textSecondary} hover:scale-110 active:scale-90 transition-transform`}><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <span className={`text-sm ${theme.textSecondary} block mb-1`}>Quantidade em Estoque</span>
                <span className="text-3xl font-bold text-emerald-500">{selectedItem.quantidade}</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className={`text-xs ${theme.textSecondary} uppercase tracking-wide mb-1 block`}>Valor de Compra</label><div className={`${theme.text} font-bold text-lg`}>R$ {selectedItem.valorCompra.toFixed(2)}</div></div>
                <div><label className={`text-xs ${theme.textSecondary} uppercase tracking-wide mb-1 block`}>Valor de Venda</label><div className="text-emerald-500 font-bold text-lg">R$ {selectedItem.valorVenda.toFixed(2)}</div></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className={`text-xs ${theme.textSecondary} uppercase tracking-wide mb-1 block`}>Margem de Lucro</label><div className="text-violet-500 font-bold">{((selectedItem.valorVenda - selectedItem.valorCompra) / selectedItem.valorCompra * 100).toFixed(1)}%</div></div>
                <div><label className={`text-xs ${theme.textSecondary} uppercase tracking-wide mb-1 block`}>Lucro Unitário</label><div className="text-violet-500 font-bold">R$ {(selectedItem.valorVenda - selectedItem.valorCompra).toFixed(2)}</div></div>
              </div>
              <div><label className={`text-xs ${theme.textSecondary} uppercase tracking-wide mb-1 block`}>Última Reposição</label><div className={`${theme.text} font-medium flex items-center gap-2`}><Calendar className="w-4 h-4 text-violet-500" />{selectedItem.ultimaReposicao}</div></div>
              <div className={`p-3 rounded-lg ${theme.card} border`}><label className={`text-xs ${theme.textSecondary} uppercase tracking-wide mb-1 block`}>Valor Total em Estoque</label><div className={`${theme.text} font-bold text-xl`}>R$ {(selectedItem.quantidade * selectedItem.valorCompra).toFixed(2)}</div></div>
            </div>
            <div className={`p-4 border-t ${theme.divider} flex gap-2`}>
              {permissions.adicionarEditarItem && (
                <button onClick={handleEditItem} className="flex-1 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2 hover:scale-105 active:scale-95 hover:shadow-lg transition-all">
                  <Edit className="w-4 h-4" /> Editar Item
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Histórico (mantido) ── */}
      {showHistoryModal && selectedItem && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`${theme.card} rounded-xl border shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto`}>
            <div className={`p-4 border-b ${theme.divider} flex items-center justify-between`}>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-violet-500/20"><History className="w-5 h-5 text-violet-500" /></div>
                <div>
                  <h3 className={`text-lg font-bold ${theme.text}`}>Histórico do Item</h3>
                  <p className={`text-sm ${theme.textSecondary}`}>{selectedItem.nome}</p>
                </div>
              </div>
              <button onClick={() => setShowHistoryModal(false)} className={`${theme.textSecondary} hover:scale-110 active:scale-90 transition-transform`}><X className="w-5 h-5" /></button>
            </div>

            <div className="p-6 space-y-6">
              {permissions.verHistoricoReposicao && (
                <div>
                  <h4 className={`text-sm font-bold ${theme.text} mb-3 uppercase tracking-wider flex items-center gap-2`}>
                    <Package className="w-4 h-4 text-emerald-400" /> Reposições
                  </h4>

                  <div className={`p-3 rounded-lg ${theme.card} border mb-3`}>
                    <div className="grid grid-cols-3 gap-4">
                      <div><span className={`text-xs ${theme.textSecondary} uppercase tracking-wide block mb-1`}>Total Investido</span><span className="text-rose-400 font-bold text-lg">R$ {historyData.valorTotalInvestido.toFixed(2)}</span></div>
                      <div><span className={`text-xs ${theme.textSecondary} uppercase tracking-wide block mb-1`}>Total Venda</span><span className="text-emerald-400 font-bold text-lg">R$ {historyData.valorTotalVenda.toFixed(2)}</span></div>
                      <div><span className={`text-xs ${theme.textSecondary} uppercase tracking-wide block mb-1`}>Lucro Total</span><span className="text-violet-400 font-bold text-lg">R$ {historyData.lucro.toFixed(2)}</span></div>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className={`border-b ${theme.divider} ${theme.tableHeader}`}>
                          {['Data','Qtd','Compra Un.','Venda Un.','Investido','Total Venda','Lucro','Fornecedor','Responsável'].map((h, i) => (
                            <th key={h} className={`p-3 ${theme.textSecondary} font-semibold text-[10px] uppercase tracking-wider ${i === 0 || i >= 7 ? 'text-left' : i === 1 ? 'text-center' : 'text-right'}`}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className={`divide-y ${theme.divider}`}>
                        {historyData.itemReposicaoList.map((entry, idx) => (
                          <tr key={entry.id} className={`${theme.cardHover} transition-colors`} style={{ animationDelay: `${idx * 30}ms` }}>
                            <td className="p-3"><div className={`${theme.text} font-medium text-sm flex items-center gap-2`}><Calendar className="w-4 h-4 text-violet-500" />{new Date(entry.dataHoraRegistro).toLocaleString('pt-BR')}</div></td>
                            <td className="p-3 text-center"><span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">+{entry.qtdUnidades}</span></td>
                            <td className="p-3 text-right"><span className={`${theme.text} text-sm`}>R$ {entry.valorCompraUnidade.toFixed(2)}</span></td>
                            <td className="p-3 text-right"><span className="text-emerald-400 text-sm">R$ {entry.valorVendaUnidade.toFixed(2)}</span></td>
                            <td className="p-3 text-right"><span className="text-rose-400 font-bold text-sm">R$ {entry.valorTotalInvestido.toFixed(2)}</span></td>
                            <td className="p-3 text-right"><span className="text-emerald-400 font-bold text-sm">R$ {entry.valorTotalVenda.toFixed(2)}</span></td>
                            <td className="p-3 text-right"><span className="text-violet-400 font-bold text-sm">R$ {entry.lucro.toFixed(2)}</span></td>
                            <td className="p-3"><span className={`${theme.text} text-sm`}>{entry.fornecedor}</span></td>
                            <td className="p-3"><span className={`${theme.textSecondary} text-sm`}>{entry.funcionarioNome}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {permissions.verHistoricoPreco && (
                <div>
                  <h4 className={`text-sm font-bold ${theme.text} mb-3 uppercase tracking-wider flex items-center gap-2`}>
                    <Tag className="w-4 h-4 text-violet-400" /> Histórico de Preços
                  </h4>

                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className={`border-b ${theme.divider} ${theme.tableHeader}`}>
                          {['Data','Valor Compra','Valor Venda','Margem','Funcionário'].map((h, i) => (
                            <th key={h} className={`p-3 ${theme.textSecondary} font-semibold text-[10px] uppercase tracking-wider ${i === 0 || i === 4 ? 'text-left' : 'text-right'}`}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className={`divide-y ${theme.divider}`}>
                        {priceHistoryData.map((entry, idx) => (
                          <tr key={entry.id} className={`${theme.cardHover} transition-colors`} style={{ animationDelay: `${idx * 30}ms` }}>
                            <td className="p-3"><div className={`${theme.text} font-medium text-sm flex items-center gap-2`}><Calendar className="w-4 h-4 text-violet-500" />{new Date(entry.dataHoraRegistro).toLocaleString('pt-BR')}</div></td>
                            <td className="p-3 text-right"><span className={`${theme.text} text-sm`}>R$ {entry.valorCompraUnidade.toFixed(2)}</span></td>
                            <td className="p-3 text-right"><span className="text-emerald-400 font-bold text-sm">R$ {entry.valorVendaUnidade.toFixed(2)}</span></td>
                            <td className="p-3 text-right"><span className="text-violet-400 font-bold text-sm">{((entry.valorVendaUnidade - entry.valorCompraUnidade) / entry.valorCompraUnidade * 100).toFixed(1)}%</span></td>
                            <td className="p-3"><span className={`${theme.textSecondary} text-sm`}>{entry.funcionarioNome}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* ── Modal Permissões ── */}
      {showPermissionsModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`${theme.card} rounded-xl border shadow-2xl max-w-md w-full`}>
            <div className={`p-4 border-b ${theme.divider} flex items-center justify-between`}>
              <div className="flex items-center gap-2"><Shield className="w-5 h-5 text-violet-500" /><h3 className={`text-lg font-bold ${theme.text}`}>Configurar Permissões</h3></div>
              <button onClick={() => setShowPermissionsModal(false)} className={`${theme.textSecondary} hover:scale-110 active:scale-90 transition-transform`}><X className="w-5 h-5" /></button>
            </div>

            <div className="p-6 space-y-2">
              {[
                { key: 'acessoTotal',              label: '🔓 Acesso Total',                   sub: 'Habilitar todas as permissões' },
                { key: 'mostrarDashboard',         label: '📊 Ver Dashboard',                  sub: 'Visualizar estatísticas e resumos' },
                { key: 'adicionarEditarCategoria', label: '🏷️ Adicionar/Editar Categoria',     sub: 'Criar e modificar categorias' },
                { key: 'adicionarEditarItem',      label: '➕ Adicionar/Editar Item',           sub: 'Criar e modificar itens do estoque' },
                { key: 'reporEstoque',             label: '📦 Repor Estoque',                  sub: 'Adicionar unidades ao estoque' },
                { key: 'verHistoricoPreco',        label: '💰 Ver Histórico de Preço',         sub: 'Visualizar mudanças de preço' },
                { key: 'verHistoricoReposicao',    label: '📋 Ver Histórico de Reposição',     sub: 'Visualizar reposições anteriores' },
                { key: 'consumirItem',             label: '🔻 Consumir Item',                  sub: 'Reduzir quantidade do estoque' },
              ].map(({ key, label, sub }, i) => (
                <React.Fragment key={key}>
                  {i === 1 && <div className={`border-t ${theme.divider} my-2`} />}
                  <label className={`flex items-center gap-3 cursor-pointer p-2.5 rounded-lg ${theme.cardHover} transition-colors`}>
                    <input type="checkbox" checked={permissions[key]} onChange={() => togglePermission(key)} className="w-4 h-4 rounded accent-violet-500 cursor-pointer" />
                    <div className="flex-1">
                      <span className={`${theme.text} font-medium text-sm block`}>{label}</span>
                      <span className={`text-xs ${theme.textSecondary}`}>{sub}</span>
                    </div>
                    {permissions[key] && <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />}
                  </label>
                </React.Fragment>
              ))}
            </div>

            <div className={`p-4 border-t ${theme.divider}`}>
              <button
                onClick={() => setShowPermissionsModal(false)}
                className="w-full px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-medium hover:scale-105 active:scale-95 hover:shadow-lg transition-all"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Loading ── */}
      {isLoading && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100]">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 border-4 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
            <p className="text-white font-medium text-sm">Processando...</p>
          </div>
        </div>
      )}

      {/* ── Notificação ── */}
      {notification && (
        <div className="fixed top-4 right-4 z-[110] animate-slideIn">
          <div className={`${notification.type === 'success' ? 'bg-emerald-500' : 'bg-blue-500'} text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-3`}>
            <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
            <span className="font-medium">{notification.message}</span>
          </div>
        </div>
      )}

      <style jsx>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        * { font-family: 'Inter', sans-serif; }
        @keyframes fadeIn  { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        @keyframes slideIn { from { opacity:0; transform:translateX(100%); } to { opacity:1; transform:translateX(0); } }
        .animate-slideIn { animation: slideIn 0.3s ease-out; }
        tbody tr { animation: fadeIn 0.3s ease-out forwards; opacity:0; }
        select option { background: ${isDark ? '#1e293b' : '#ffffff'}; color: ${isDark ? 'white' : '#0f172a'}; }
      `}</style>
    </div>
  );
}
