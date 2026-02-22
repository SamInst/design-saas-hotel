import React, { useState } from 'react';
import {
  Package, Search, Plus, X, Edit, Trash2, Sun, Moon, Shield, Check,
  Calendar, DollarSign, TrendingUp, ShoppingCart,
  History, Tag, Boxes, Minus, LayoutGrid,
} from 'lucide-react';

export default function InventoryManagement() {
  const [searchTerm, setSearchTerm]                         = useState('');
  const [isDark, setIsDark]                                 = useState(true);
  const [showAddItemModal, setShowAddItemModal]             = useState(false);
  const [showAddCategoryModal, setShowAddCategoryModal]     = useState(false);
  const [showEditCategoryModal, setShowEditCategoryModal]   = useState(false);
  const [showDetailsModal, setShowDetailsModal]             = useState(false);
  const [showHistoryModal, setShowHistoryModal]             = useState(false);
  const [showPermissionsModal, setShowPermissionsModal]     = useState(false);
  const [showConsumeModal, setShowConsumeModal]             = useState(false);
  const [showReplenishModal, setShowReplenishModal]         = useState(false);
  const [selectedItem, setSelectedItem]                     = useState(null);
  const [selectedCategory, setSelectedCategory]             = useState('all');
  const [editingCategory, setEditingCategory]               = useState(null);
  const [isLoading, setIsLoading]                           = useState(false);
  const [notification, setNotification]                     = useState(null);

  // Card de categoria aberto (substitui collapsedCategories)
  const [openCategoryCard, setOpenCategoryCard]             = useState(null); // id da categoria
  const [categoryCardTab, setCategoryCardTab]               = useState('itens'); // 'itens' | 'financeiro'

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

  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [selectedCategoryModal, setSelectedCategoryModal] = useState(null);
  const handleOpenCategoryModal = (categoryObj) => {
  setSelectedCategoryModal(categoryObj);
  setShowCategoryModal(true);
  };

  const handleCloseCategoryModal = () => {
  setShowCategoryModal(false);
  setSelectedCategoryModal(null);
  };

  const togglePermission = (key) => {
    if (key === 'acessoTotal') {
      const v = !permissions.acessoTotal;
      setPermissions({
        acessoTotal: v, mostrarDashboard: v, adicionarEditarCategoria: v,
        adicionarEditarItem: v, reporEstoque: v, verHistoricoPreco: v,
        verHistoricoReposicao: v, consumirItem: v,
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
  const handleUpdateCategory   = withLoading(() => { setShowEditCategoryModal(false); setEditingCategory(null); showNotification('Categoria atualizada!'); });
  const handleEditItem         = withLoading(() => { setShowDetailsModal(false);      showNotification('Item atualizado com sucesso!'); });
  const handleConfirmConsume   = withLoading(() => { setShowConsumeModal(false);      showNotification('Item consumido com sucesso!'); });
  const handleConfirmReplenish = withLoading(() => { setShowReplenishModal(false);    showNotification('Estoque reposto com sucesso!'); });

  const handleEditCategory     = (cat)  => { setEditingCategory(cat); setShowEditCategoryModal(true); };
  const handleConsumeItem      = (item) => { setSelectedItem(item);   setShowConsumeModal(true); };
  const handleReplenishItem    = (item) => { setSelectedItem(item);   setShowReplenishModal(true); };
  const handleItemClick        = (item) => { setSelectedItem(item);   setShowDetailsModal(true); };
  const handleShowHistory      = (item) => { setSelectedItem(item);   setShowHistoryModal(true); };

  const handleOpenCategoryCard = (id) => {
    if (openCategoryCard === id) { setOpenCategoryCard(null); return; }
    setOpenCategoryCard(id);
    setCategoryCardTab('itens');
  };

  // ─── Data ─────────────────────────────────────────────────────────────────
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
      { id: 78, dataHoraRegistro: '2026-02-18T14:02:08', valorCompraUnidade: 1.2, valorVendaUnidade: 3.0, fornecedor: 'Distribuidora XYZ', funcionarioNome: 'admin',       qtdUnidades: 25, valorTotalInvestido: 30.0, valorTotalVenda:  75.0, lucro:  45.0 },
      { id: 54, dataHoraRegistro: '2026-02-10T09:15:00', valorCompraUnidade: 1.2, valorVendaUnidade: 3.0, fornecedor: 'Distribuidora XYZ', funcionarioNome: 'admin',       qtdUnidades: 50, valorTotalInvestido: 60.0, valorTotalVenda: 150.0, lucro:  90.0 },
    ],
  };

  const priceHistoryData = [
    { id: 48, dataHoraRegistro: '2026-02-18T13:21:38', valorCompraUnidade: 1.2, valorVendaUnidade: 3.0, funcionarioNome: 'João Silva Santos' },
    { id: 24, dataHoraRegistro: '2026-02-01T10:00:00', valorCompraUnidade: 1.0, valorVendaUnidade: 2.5, funcionarioNome: 'João Silva Santos' },
  ];

  // ─── Computed ─────────────────────────────────────────────────────────────
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

  // ─── Theme — totalmente revisado, sem elementos "gamer" ───────────────────
  const theme = {
    // Fundos
    pageBg:        isDark
      ? 'bg-slate-950'
      : 'bg-slate-50',
    // Cards principais
    card:          isDark
      ? 'bg-slate-900 border-slate-800'
      : 'bg-white border-slate-200',
    // Cards internos / secundários
    cardInner:     isDark
      ? 'bg-slate-800/60 border-slate-700'
      : 'bg-slate-50 border-slate-200',
    // Hover genérico em linhas/itens
    rowHover:      isDark
      ? 'hover:bg-slate-800/70'
      : 'hover:bg-slate-50',
    // Textos
    text:          isDark ? 'text-slate-100'  : 'text-slate-900',
    textSub:       isDark ? 'text-slate-400'  : 'text-slate-500',
    textMuted:     isDark ? 'text-slate-500'  : 'text-slate-400',
    // Inputs / selects
    input:         isDark
      ? 'bg-slate-800 border-slate-700 text-slate-100 placeholder-slate-500'
      : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400',
    // Botão neutro (outline)
    btnNeutral:    isDark
      ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'
      : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50',
    // Divisores
    divider:       isDark ? 'border-slate-800' : 'border-slate-200',
    dividerLight:  isDark ? 'border-slate-700' : 'border-slate-200',
    // Table header
    tableHeader:   isDark ? 'bg-slate-800/80'  : 'bg-slate-100',
    // Overlay radial suave (não-gamer)
    overlay:       isDark
      ? 'rgba(99,102,241,0.06)'
      : 'rgba(99,102,241,0.03)',
  };

  const inputCls = `w-full px-3 py-2 ${theme.input} rounded-lg text-sm border focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-colors`;

  // ─── Dashboard cards ───────────────────────────────────────────────────────
  const dashCards = [
    { label: 'Categorias',      sub: 'Cadastradas',           value: stats.totalCategorias,                    Icon: Tag,        color: isDark ? 'bg-blue-600/20 border-blue-600/30 text-blue-400'    : 'bg-blue-50 border-blue-200 text-blue-600'    },
    { label: 'Total de Itens',  sub: 'Itens cadastrados',     value: stats.totalItens,                         Icon: Package,    color: isDark ? 'bg-violet-600/20 border-violet-600/30 text-violet-400' : 'bg-violet-50 border-violet-200 text-violet-600' },
    { label: 'Valor em Estoque',sub: 'Custo total',           value: `R$ ${stats.totalValorEstoque.toFixed(2)}`, Icon: DollarSign, color: isDark ? 'bg-emerald-600/20 border-emerald-600/30 text-emerald-400': 'bg-emerald-50 border-emerald-200 text-emerald-600' },
    { label: 'Lucro Potencial', sub: 'Estimado total',        value: `R$ ${stats.lucroTotal.toFixed(2)}`,      Icon: TrendingUp, color: isDark ? 'bg-amber-600/20 border-amber-600/30 text-amber-400'   : 'bg-amber-50 border-amber-200 text-amber-600'   },
  ];

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className={`min-h-screen ${theme.pageBg} relative`}>
      {/* Overlay radial suave */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{ background: `radial-gradient(ellipse at 60% 0%, ${theme.overlay}, transparent 70%)` }}
      />

      <div className="relative max-w-[1600px] mx-auto px-4 sm:px-8 py-8">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <header className="mb-6 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className={`text-2xl font-semibold ${theme.text} tracking-tight`}>Almoxarifado</h1>
            <p className={`${theme.textSub} text-sm mt-0.5 flex items-center gap-1.5`}>
              <Package className="w-3.5 h-3.5" /> Gerenciamento de Estoque e Inventário
            </p>
          </div>
          <div className="flex gap-2">
            {[
              { label: 'Permissões', Icon: Shield, action: () => setShowPermissionsModal(true) },
              { label: isDark ? 'Tema Claro' : 'Tema Escuro', Icon: isDark ? Sun : Moon, action: () => setIsDark(!isDark) },
            ].map(({ label, Icon, action }) => (
              <button key={label} onClick={action}
                className={`px-3 py-2 ${theme.btnNeutral} rounded-lg border text-sm font-medium flex items-center gap-2 transition-colors`}>
                <Icon className="w-4 h-4" /> {label}
              </button>
            ))}
          </div>
        </header>

        {/* ── Dashboard ───────────────────────────────────────────────────── */}
        {permissions.mostrarDashboard && (
          <div className={`${theme.card} rounded-xl border p-4 mb-6 shadow-sm`}>
            <div className="flex items-center gap-2 mb-4">
              <Boxes className="w-4 h-4 text-violet-500" />
              <h2 className={`text-sm font-semibold ${theme.text} uppercase tracking-wide`}>Resumo do Estoque</h2>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {dashCards.map(({ label, sub, value, Icon, color }) => (
                <div key={label} className={`${color} rounded-lg border p-4`}>
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className="w-4 h-4" />
                    <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
                  </div>
                  <p className={`text-2xl font-bold ${theme.text}`}>{value}</p>
                  <p className={`text-xs mt-0.5 ${theme.textSub}`}>{sub}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Categorias ──────────────────────────────────────────────────── */}
        <div className={`${theme.card} rounded-xl border shadow-sm overflow-visible`}>

          {/* Toolbar */}
          <div className={`px-4 py-3 border-b ${theme.divider} flex flex-col sm:flex-row gap-3 sm:items-center justify-between`}>
            <div>
              <h2 className={`text-base font-semibold ${theme.text}`}>Categorias de Estoque</h2>
              <p className={`${theme.textSub} text-xs mt-0.5`}>Clique em uma categoria para ver itens e resumo financeiro.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="relative">
                <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 ${theme.textSub}`} />
                <input type="text" placeholder="Buscar item..." value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={`pl-9 pr-3 py-2 ${theme.input} w-48 rounded-lg text-sm border focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-colors`}
                />
              </div>
              <select value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                className={`px-3 py-2 ${theme.input} rounded-lg text-sm border focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-colors`}>
                <option value="all">Todas as categorias</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.icone} {c.nome}</option>)}
              </select>
              {permissions.adicionarEditarCategoria && (
                <button onClick={() => setShowAddCategoryModal(true)}
                  className="px-3 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors">
                  <Plus className="w-4 h-4" /> Nova Categoria
                </button>
              )}
            </div>
          </div>




<div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
  {itemsByCategory.map((category) => (
    <button
      key={category.id}
      type="button"
      onClick={() => handleOpenCategoryModal(category)}
      className={`
        text-left rounded-xl border transition-colors
        ${isDark ? 'bg-slate-800/60 border-slate-700 hover:bg-slate-800' : 'bg-white border-slate-200 hover:bg-slate-50'}
      `}
    >
      <div className="p-4 flex items-center gap-3">
        {/* Ícone padronizado: igual ao do Total de Itens */}
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${isDark ? 'bg-slate-700' : 'bg-slate-100'}`}>
          <Package className={`${isDark ? 'text-slate-200' : 'text-slate-700'} w-5 h-5`} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`${theme.text} font-semibold text-sm`}>{category.nome}</span>
            <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-600'}`}>
              {category.totalItems} {category.totalItems === 1 ? 'item' : 'itens'}
            </span>
          </div>
          <p className={`${theme.textSub} text-xs mt-0.5 truncate`}>
            {category.descricao}
          </p>
        </div>
      </div>

      {/* Mini resumo (mantém os mesmos elementos, mas no formato card) */}
      <div className={`px-4 pb-3 pt-0 flex items-center gap-4 border-t ${theme.dividerLight}`}>
        <div>
          <p className={`text-[10px] ${theme.textMuted} uppercase tracking-wide`}>Investido</p>
          <p className={`text-xs font-semibold ${isDark ? 'text-rose-400' : 'text-rose-600'}`}>
            R$ {category.valorTotalInvestido.toFixed(2)}
          </p>
        </div>
        <div>
          <p className={`text-[10px] ${theme.textMuted} uppercase tracking-wide`}>Venda</p>
          <p className={`text-xs font-semibold ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
            R$ {category.valorTotalVenda.toFixed(2)}
          </p>
        </div>
        <div>
          <p className={`text-[10px] ${theme.textMuted} uppercase tracking-wide`}>Lucro</p>
          <p className={`text-xs font-semibold ${isDark ? 'text-violet-400' : 'text-violet-600'}`}>
            R$ {category.lucro.toFixed(2)}
          </p>
        </div>
      </div>
    </button>
  ))}
</div>

// 4) Modal: Descrição + Itens da categoria
{showCategoryModal && selectedCategoryModal && (
  <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-start justify-center z-50 p-4 overflow-y-auto">
    <div className={`${theme.card} rounded-xl border shadow-2xl max-w-4xl w-full my-8`}>
      {/* Header */}
      <div className={`p-4 border-b ${theme.divider} flex items-center justify-between`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
            <Package className={`${isDark ? 'text-slate-200' : 'text-slate-700'} w-5 h-5`} />
          </div>
          <div>
            <h3 className={`text-base font-semibold ${theme.text}`}>{selectedCategoryModal.nome}</h3>
            <p className={`text-xs ${theme.textSub}`}>{selectedCategoryModal.totalItems} {selectedCategoryModal.totalItems === 1 ? 'item' : 'itens'} cadastrados</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {permissions.adicionarEditarCategoria && (
            <button
              onClick={() => handleEditCategory(selectedCategoryModal)}
              className={`px-3 py-1.5 text-xs rounded-lg border ${theme.btnNeutral} flex items-center gap-1.5 transition-colors`}
            >
              <Edit className="w-3.5 h-3.5" /> Editar Categoria
            </button>
          )}
          <button
            onClick={handleCloseCategoryModal}
            className={`p-2 rounded-lg border ${theme.btnNeutral} transition-colors`}
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="p-5 space-y-4">
        {/* Descrição */}
        <div className={`${theme.cardInner} rounded-lg border p-4`}>
          <p className={`text-[11px] uppercase tracking-wide ${theme.textMuted} mb-1`}>Descrição</p>
          <p className={`${theme.text} text-sm`}>{selectedCategoryModal.descricao || 'Sem descrição.'}</p>
        </div>

        {/* Itens */}
        <div className="flex items-center justify-between">
          <p className={`${theme.textSub} text-xs`}>
            Exibindo {selectedCategoryModal.items.length} item(ns) (filtro aplicado)
          </p>

          {permissions.adicionarEditarItem && (
            <button
              onClick={() => setShowAddItemModal(true)}
              className="px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Novo Item
            </button>
          )}
        </div>

        {selectedCategoryModal.items.length === 0 ? (
          <div className={`text-center py-10 ${theme.cardInner} rounded-lg border`}>
            <Package className={`w-8 h-8 mx-auto mb-2 ${theme.textMuted}`} />
            <p className={`${theme.textSub} text-sm`}>Nenhum item nesta categoria (com o filtro atual).</p>
          </div>
        ) : (
          <div className="space-y-2">
            {selectedCategoryModal.items.map((item) => (
              <div
                key={item.id}
                onClick={() => handleItemClick(item)}
                className={`flex items-center justify-between rounded-lg border px-4 py-3 cursor-pointer transition-colors
                  ${isDark ? 'border-slate-800 hover:border-slate-600 hover:bg-slate-800/50' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}
              >
                <div className="min-w-0 mr-4">
                  <p className={`${theme.text} font-medium text-sm truncate`}>{item.nome}</p>
                  <p className={`${theme.textSub} text-xs mt-0.5`}>
                    Estoque: <span className={`${isDark ? 'text-slate-200' : 'text-slate-700'} font-semibold`}>{item.quantidade}</span>
                    {' · '}Compra: R$ {item.valorCompra.toFixed(2)}
                    {' · '}Venda: R$ {item.valorVenda.toFixed(2)}
                  </p>
                </div>

                <div className="flex gap-2 shrink-0">
                  {permissions.consumirItem && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleConsumeItem(item); }}
                      className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs rounded-lg flex items-center gap-1 transition-colors"
                    >
                      <Minus className="w-3 h-3" /> Consumir
                    </button>
                  )}
                  {permissions.reporEstoque && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleReplenishItem(item); }}
                      className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs rounded-lg flex items-center gap-1 transition-colors"
                    >
                      <Plus className="w-3 h-3" /> Repor
                    </button>
                  )}
                  {(permissions.verHistoricoReposicao || permissions.verHistoricoPreco) && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleShowHistory(item); }}
                      className={`px-2.5 py-1.5 ${theme.btnNeutral} border text-xs rounded-lg flex items-center gap-1 transition-colors`}
                    >
                      <History className="w-3 h-3" /> Histórico
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className={`p-4 border-t ${theme.divider} flex justify-end`}>
        <button
          onClick={handleCloseCategoryModal}
          className={`px-4 py-2 ${theme.btnNeutral} rounded-lg border text-sm font-medium transition-colors`}
        >
          Fechar
        </button>
      </div>
    </div>
  </div>
)}

        </div>
      </div>

      {/* ══ MODAIS ════════════════════════════════════════════════════════════ */}

      {/* Modal Nova Categoria */}
      {showAddCategoryModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`${theme.card} rounded-xl border shadow-2xl max-w-md w-full`}>
            <div className={`p-4 border-b ${theme.divider} flex items-center justify-between`}>
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-violet-500" />
                <h3 className={`text-base font-semibold ${theme.text}`}>Nova Categoria</h3>
              </div>
              <button onClick={() => setShowAddCategoryModal(false)} className={`${theme.textSub} hover:scale-110 active:scale-90 transition-transform`}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className={`block text-sm font-medium ${theme.text} mb-1.5`}>Nome da Categoria *</label>
                <input type="text" placeholder="Ex: Eletrônicos" className={inputCls} />
              </div>
              <div>
                <label className={`block text-sm font-medium ${theme.text} mb-1.5`}>Descrição</label>
                <textarea placeholder="Descreva a categoria..." rows={3} className={`${inputCls} resize-none`} />
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={() => setShowAddCategoryModal(false)}
                  className={`flex-1 px-4 py-2 ${theme.btnNeutral} rounded-lg border text-sm font-medium transition-colors`}>
                  Cancelar
                </button>
                <button onClick={handleAddCategory}
                  className="flex-1 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-medium transition-colors">
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
                <Edit className="w-4 h-4 text-violet-500" />
                <h3 className={`text-base font-semibold ${theme.text}`}>Editar Categoria</h3>
              </div>
              <button onClick={() => setShowEditCategoryModal(false)} className={`${theme.textSub} hover:scale-110 active:scale-90 transition-transform`}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className={`block text-sm font-medium ${theme.text} mb-1.5`}>Nome da Categoria *</label>
                <input type="text" defaultValue={editingCategory.nome} className={inputCls} />
              </div>
              <div>
                <label className={`block text-sm font-medium ${theme.text} mb-1.5`}>Descrição</label>
                <textarea defaultValue={editingCategory.descricao} rows={3} className={`${inputCls} resize-none`} />
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={() => setShowEditCategoryModal(false)}
                  className={`flex-1 px-4 py-2 ${theme.btnNeutral} rounded-lg border text-sm font-medium transition-colors`}>
                  Cancelar
                </button>
                <button onClick={handleUpdateCategory}
                  className="flex-1 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-medium transition-colors">
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
          <div className={`${theme.card} rounded-xl border shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto`}>
            <div className={`p-4 border-b ${theme.divider} flex items-center justify-between sticky top-0 ${theme.card} z-10`}>
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-violet-500" />
                <h3 className={`text-base font-semibold ${theme.text}`}>Adicionar Item ao Estoque</h3>
              </div>
              <button onClick={() => setShowAddItemModal(false)} className={`${theme.textSub} hover:scale-110 active:scale-90 transition-transform`}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-5">
              <div>
                <p className={`text-xs font-semibold uppercase tracking-wide ${theme.textSub} mb-3 flex items-center gap-1.5`}>
                  <Package className="w-3.5 h-3.5" /> Informações do Item
                </p>
                <div className="space-y-3">
                  <div>
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
                <p className={`text-xs font-semibold uppercase tracking-wide ${theme.textSub} mb-3 flex items-center gap-1.5`}>
                  <DollarSign className="w-3.5 h-3.5" /> Valores
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={`block text-sm font-medium ${theme.text} mb-1.5`}>Valor de Compra *</label>
                    <input type="number" step="0.01" placeholder="0,00" className={inputCls} />
                  </div>
                  <div>
                    <label className={`block text-sm font-medium ${theme.text} mb-1.5`}>Valor de Venda *</label>
                    <input type="number" step="0.01" placeholder="0,00" className={inputCls} />
                  </div>
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={() => setShowAddItemModal(false)}
                  className={`flex-1 px-4 py-2 ${theme.btnNeutral} rounded-lg border text-sm font-medium transition-colors`}>
                  Cancelar
                </button>
                <button onClick={handleAddItem}
                  className="flex-1 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-medium transition-colors">
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
                <Minus className="w-4 h-4 text-rose-500" />
                <h3 className={`text-base font-semibold ${theme.text}`}>Consumir Item do Estoque</h3>
              </div>
              <button onClick={() => setShowConsumeModal(false)} className={`${theme.textSub} hover:scale-110 active:scale-90 transition-transform`}><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className={`p-3 rounded-lg ${theme.cardInner} border`}>
                <p className={`${theme.textSub} text-xs mb-1`}>Item Selecionado</p>
                <p className={`${theme.text} font-semibold text-sm`}>{selectedItem.nome}</p>
                <p className={`${theme.textSub} text-xs mt-1`}>
                  Disponível: <span className={`font-semibold ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>{selectedItem.quantidade}</span>
                </p>
              </div>
              <div>
                <label className={`block text-sm font-medium ${theme.text} mb-1.5`}>Quantidade a Consumir *</label>
                <input type="number" placeholder="0" min="1" max={selectedItem.quantidade} className={inputCls} />
              </div>
              <div>
                <label className={`block text-sm font-medium ${theme.text} mb-1.5`}>Quarto <span className={theme.textSub}>(opcional)</span></label>
                <select className={inputCls}>
                  <option value="">Nenhum (uso geral)</option>
                  {Array.from({ length: 22 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>Quarto {String(n).padStart(2, '0')}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={`block text-sm font-medium ${theme.text} mb-1.5`}>Forma de Pagamento <span className={theme.textSub}>(opcional)</span></label>
                <select className={inputCls}>
                  <option value="">Sem pagamento</option>
                  {['Dinheiro','Cartão de Crédito','Cartão de Débito','PIX','Link NUBANK','Transferência Bancária','PENDENTE'].map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div className={`flex items-start gap-3 p-3 rounded-lg border ${theme.divider} ${theme.cardInner}`}>
                <input type="checkbox" id="despesaPessoal" className="w-4 h-4 mt-0.5 rounded accent-rose-500 cursor-pointer shrink-0" />
                <label htmlFor="despesaPessoal" className="cursor-pointer">
                  <span className={`${theme.text} font-medium text-sm block`}>Despesa Pessoal</span>
                  <span className={`${theme.textSub} text-xs`}>Marque se é de uso pessoal, não do hotel</span>
                </label>
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={() => setShowConsumeModal(false)}
                  className={`flex-1 px-4 py-2 ${theme.btnNeutral} rounded-lg border text-sm font-medium transition-colors`}>Cancelar</button>
                <button onClick={handleConfirmConsume}
                  className="flex-1 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-medium transition-colors">Confirmar Consumo</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Repor Estoque */}
      {showReplenishModal && selectedItem && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`${theme.card} rounded-xl border shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto`}>
            <div className={`p-4 border-b ${theme.divider} flex items-center justify-between sticky top-0 ${theme.card} z-10`}>
              <div className="flex items-center gap-2">
                <Plus className="w-4 h-4 text-emerald-500" />
                <h3 className={`text-base font-semibold ${theme.text}`}>Repor Estoque</h3>
              </div>
              <button onClick={() => setShowReplenishModal(false)} className={`${theme.textSub} hover:scale-110 active:scale-90 transition-transform`}><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className={`p-3 rounded-lg ${theme.cardInner} border`}>
                <p className={`${theme.textSub} text-xs mb-1`}>Item Selecionado</p>
                <p className={`${theme.text} font-semibold text-sm`}>{selectedItem.nome}</p>
                <p className={`${theme.textSub} text-xs mt-1`}>
                  Atual: <span className={`font-semibold ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>{selectedItem.quantidade}</span>
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block text-sm font-medium ${theme.text} mb-1.5`}>Quantidade *</label>
                  <input type="number" placeholder="0" min="1" className={inputCls} />
                </div>
                <div>
                  <label className={`block text-sm font-medium ${theme.text} mb-1.5`}>Fornecedor *</label>
                  <input type="text" placeholder="Nome do fornecedor" className={inputCls} />
                </div>
                <div>
                  <label className={`block text-sm font-medium ${theme.text} mb-1.5`}>Valor de Compra (un.) *</label>
                  <input type="number" step="0.01" defaultValue={selectedItem.valorCompra} className={inputCls} />
                </div>
                <div>
                  <label className={`block text-sm font-medium ${theme.text} mb-1.5`}>Valor de Venda (un.) *</label>
                  <input type="number" step="0.01" defaultValue={selectedItem.valorVenda} className={inputCls} />
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={() => setShowReplenishModal(false)}
                  className={`flex-1 px-4 py-2 ${theme.btnNeutral} rounded-lg border text-sm font-medium transition-colors`}>Cancelar</button>
                <button onClick={handleConfirmReplenish}
                  className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors">Confirmar Reposição</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Detalhes do Item */}
      {showDetailsModal && selectedItem && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`${theme.card} rounded-xl border shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto`}>
            <div className={`p-4 border-b ${theme.divider} flex items-center justify-between`}>
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${isDark ? 'bg-emerald-600/15' : 'bg-emerald-50'}`}>
                  <Package className="w-4 h-4 text-emerald-500" />
                </div>
                <div>
                  <h3 className={`text-base font-semibold ${theme.text}`}>{selectedItem.nome}</h3>
                  <p className={`text-xs ${theme.textSub}`}>{selectedItem.categoria}</p>
                </div>
              </div>
              <button onClick={() => setShowDetailsModal(false)} className={`${theme.textSub} hover:scale-110 active:scale-90 transition-transform`}><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className={`p-4 rounded-lg ${isDark ? 'bg-emerald-600/10 border-emerald-600/20' : 'bg-emerald-50 border-emerald-200'} border`}>
                <p className={`text-xs ${theme.textSub} mb-1`}>Quantidade em Estoque</p>
                <p className={`text-3xl font-bold ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>{selectedItem.quantidade}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className={`${theme.cardInner} rounded-lg border p-3`}>
                  <p className={`text-xs ${theme.textSub} mb-1`}>Valor de Compra</p>
                  <p className={`font-bold text-lg ${theme.text}`}>R$ {selectedItem.valorCompra.toFixed(2)}</p>
                </div>
                <div className={`${theme.cardInner} rounded-lg border p-3`}>
                  <p className={`text-xs ${theme.textSub} mb-1`}>Valor de Venda</p>
                  <p className={`font-bold text-lg ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>R$ {selectedItem.valorVenda.toFixed(2)}</p>
                </div>
                <div className={`${theme.cardInner} rounded-lg border p-3`}>
                  <p className={`text-xs ${theme.textSub} mb-1`}>Margem de Lucro</p>
                  <p className={`font-bold ${isDark ? 'text-violet-400' : 'text-violet-600'}`}>{((selectedItem.valorVenda - selectedItem.valorCompra) / selectedItem.valorCompra * 100).toFixed(1)}%</p>
                </div>
                <div className={`${theme.cardInner} rounded-lg border p-3`}>
                  <p className={`text-xs ${theme.textSub} mb-1`}>Lucro Unitário</p>
                  <p className={`font-bold ${isDark ? 'text-violet-400' : 'text-violet-600'}`}>R$ {(selectedItem.valorVenda - selectedItem.valorCompra).toFixed(2)}</p>
                </div>
              </div>
              <div className={`${theme.cardInner} rounded-lg border p-3 flex items-center gap-2`}>
                <Calendar className={`w-4 h-4 ${isDark ? 'text-violet-400' : 'text-violet-600'}`} />
                <div>
                  <p className={`text-xs ${theme.textSub}`}>Última Reposição</p>
                  <p className={`${theme.text} font-medium text-sm`}>{selectedItem.ultimaReposicao}</p>
                </div>
              </div>
              <div className={`${theme.cardInner} rounded-lg border p-3`}>
                <p className={`text-xs ${theme.textSub} mb-1`}>Valor Total em Estoque</p>
                <p className={`${theme.text} font-bold text-xl`}>R$ {(selectedItem.quantidade * selectedItem.valorCompra).toFixed(2)}</p>
              </div>
            </div>
            <div className={`p-4 border-t ${theme.divider} flex gap-2`}>
              {permissions.adicionarEditarItem && (
                <button onClick={handleEditItem}
                  className="flex-1 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors">
                  <Edit className="w-4 h-4" /> Editar Item
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Histórico */}
      {showHistoryModal && selectedItem && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`${theme.card} rounded-xl border shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto`}>
            <div className={`p-4 border-b ${theme.divider} flex items-center justify-between`}>
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${isDark ? 'bg-violet-600/15' : 'bg-violet-50'}`}>
                  <History className="w-4 h-4 text-violet-500" />
                </div>
                <div>
                  <h3 className={`text-base font-semibold ${theme.text}`}>Histórico do Item</h3>
                  <p className={`text-xs ${theme.textSub}`}>{selectedItem.nome}</p>
                </div>
              </div>
              <button onClick={() => setShowHistoryModal(false)} className={`${theme.textSub} hover:scale-110 active:scale-90 transition-transform`}><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-6">
              {permissions.verHistoricoReposicao && (
                <div>
                  <p className={`text-xs font-semibold uppercase tracking-wide ${theme.textSub} mb-3 flex items-center gap-1.5`}>
                    <Package className="w-3.5 h-3.5 text-emerald-500" /> Reposições
                  </p>
                  <div className={`${theme.cardInner} rounded-lg border p-4 mb-3`}>
                    <div className="grid grid-cols-3 gap-4">
                      {[
                        { label: 'Total Investido', value: `R$ ${historyData.valorTotalInvestido.toFixed(2)}`, color: isDark ? 'text-rose-400' : 'text-rose-600' },
                        { label: 'Total de Venda',  value: `R$ ${historyData.valorTotalVenda.toFixed(2)}`,    color: isDark ? 'text-emerald-400' : 'text-emerald-600' },
                        { label: 'Lucro Total',     value: `R$ ${historyData.lucro.toFixed(2)}`,             color: isDark ? 'text-violet-400' : 'text-violet-600' },
                      ].map(({ label, value, color }) => (
                        <div key={label}>
                          <p className={`text-xs ${theme.textSub} mb-1`}>{label}</p>
                          <p className={`${color} font-bold text-lg`}>{value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="overflow-x-auto rounded-lg border border-slate-200/10">
                    <table className="w-full">
                      <thead>
                        <tr className={`${theme.tableHeader} border-b ${theme.divider}`}>
                          {['Data','Qtd','Compra Un.','Venda Un.','Investido','Total Venda','Lucro','Fornecedor','Responsável'].map((h, i) => (
                            <th key={h} className={`px-3 py-2.5 ${theme.textSub} font-semibold text-[10px] uppercase tracking-wide whitespace-nowrap
                              ${i === 0 || i >= 7 ? 'text-left' : i === 1 ? 'text-center' : 'text-right'}`}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className={`divide-y ${theme.divider}`}>
                        {historyData.itemReposicaoList.map((entry) => (
                          <tr key={entry.id} className={`${theme.rowHover} transition-colors`}>
                            <td className="px-3 py-2.5 text-sm"><span className={theme.text}>{new Date(entry.dataHoraRegistro).toLocaleString('pt-BR')}</span></td>
                            <td className="px-3 py-2.5 text-center"><span className={`px-2 py-0.5 rounded-full text-xs font-bold ${isDark ? 'bg-blue-600/15 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>+{entry.qtdUnidades}</span></td>
                            <td className="px-3 py-2.5 text-right text-sm"><span className={theme.text}>R$ {entry.valorCompraUnidade.toFixed(2)}</span></td>
                            <td className="px-3 py-2.5 text-right text-sm"><span className={isDark ? 'text-emerald-400' : 'text-emerald-600'}>R$ {entry.valorVendaUnidade.toFixed(2)}</span></td>
                            <td className="px-3 py-2.5 text-right text-sm"><span className={isDark ? 'text-rose-400' : 'text-rose-600'}>R$ {entry.valorTotalInvestido.toFixed(2)}</span></td>
                            <td className="px-3 py-2.5 text-right text-sm"><span className={isDark ? 'text-emerald-400' : 'text-emerald-600'}>R$ {entry.valorTotalVenda.toFixed(2)}</span></td>
                            <td className="px-3 py-2.5 text-right text-sm"><span className={isDark ? 'text-violet-400' : 'text-violet-600'}>R$ {entry.lucro.toFixed(2)}</span></td>
                            <td className="px-3 py-2.5 text-sm"><span className={theme.text}>{entry.fornecedor}</span></td>
                            <td className="px-3 py-2.5 text-sm"><span className={theme.textSub}>{entry.funcionarioNome}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {permissions.verHistoricoPreco && (
                <div>
                  <p className={`text-xs font-semibold uppercase tracking-wide ${theme.textSub} mb-3 flex items-center gap-1.5`}>
                    <Tag className="w-3.5 h-3.5 text-violet-500" /> Histórico de Preços
                  </p>
                  <div className="overflow-x-auto rounded-lg border border-slate-200/10">
                    <table className="w-full">
                      <thead>
                        <tr className={`${theme.tableHeader} border-b ${theme.divider}`}>
                          {['Data','Valor Compra','Valor Venda','Margem','Funcionário'].map((h, i) => (
                            <th key={h} className={`px-3 py-2.5 ${theme.textSub} font-semibold text-[10px] uppercase tracking-wide
                              ${i === 0 || i === 4 ? 'text-left' : 'text-right'}`}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className={`divide-y ${theme.divider}`}>
                        {priceHistoryData.map((entry) => (
                          <tr key={entry.id} className={`${theme.rowHover} transition-colors`}>
                            <td className="px-3 py-2.5 text-sm"><span className={theme.text}>{new Date(entry.dataHoraRegistro).toLocaleString('pt-BR')}</span></td>
                            <td className="px-3 py-2.5 text-right text-sm"><span className={theme.text}>R$ {entry.valorCompraUnidade.toFixed(2)}</span></td>
                            <td className="px-3 py-2.5 text-right text-sm"><span className={isDark ? 'text-emerald-400' : 'text-emerald-600'}>R$ {entry.valorVendaUnidade.toFixed(2)}</span></td>
                            <td className="px-3 py-2.5 text-right text-sm"><span className={isDark ? 'text-violet-400' : 'text-violet-600'}>{((entry.valorVendaUnidade - entry.valorCompraUnidade) / entry.valorCompraUnidade * 100).toFixed(1)}%</span></td>
                            <td className="px-3 py-2.5 text-sm"><span className={theme.textSub}>{entry.funcionarioNome}</span></td>
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

      {/* Modal Permissões */}
      {showPermissionsModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`${theme.card} rounded-xl border shadow-2xl max-w-md w-full`}>
            <div className={`p-4 border-b ${theme.divider} flex items-center justify-between`}>
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-violet-500" />
                <h3 className={`text-base font-semibold ${theme.text}`}>Permissões</h3>
              </div>
              <button onClick={() => setShowPermissionsModal(false)} className={`${theme.textSub} hover:scale-110 active:scale-90 transition-transform`}><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-1.5 max-h-[60vh] overflow-y-auto">
              {[
                { key: 'acessoTotal',             label: 'Acesso Total',                sub: 'Habilitar todas as permissões'       },
                { key: 'mostrarDashboard',         label: 'Ver Dashboard',               sub: 'Visualizar estatísticas e resumos'   },
                { key: 'adicionarEditarCategoria', label: 'Adicionar / Editar Categoria',sub: 'Criar e modificar categorias'        },
                { key: 'adicionarEditarItem',      label: 'Adicionar / Editar Item',     sub: 'Criar e modificar itens do estoque'  },
                { key: 'reporEstoque',             label: 'Repor Estoque',               sub: 'Adicionar unidades ao estoque'       },
                { key: 'verHistoricoPreco',        label: 'Histórico de Preços',         sub: 'Visualizar mudanças de preço'        },
                { key: 'verHistoricoReposicao',    label: 'Histórico de Reposição',      sub: 'Visualizar reposições anteriores'    },
                { key: 'consumirItem',             label: 'Consumir Item',               sub: 'Reduzir quantidade do estoque'       },
              ].map(({ key, label, sub }, i) => (
                <React.Fragment key={key}>
                  {i === 1 && <div className={`border-t ${theme.divider} my-2`} />}
                  <label className={`flex items-center gap-3 cursor-pointer p-2.5 rounded-lg ${theme.rowHover} transition-colors`}>
                    <input type="checkbox" checked={permissions[key]} onChange={() => togglePermission(key)}
                      className="w-4 h-4 rounded accent-violet-500 cursor-pointer" />
                    <div className="flex-1">
                      <p className={`${theme.text} font-medium text-sm`}>{label}</p>
                      <p className={`text-xs ${theme.textSub}`}>{sub}</p>
                    </div>
                    {permissions[key] && <Check className="w-4 h-4 text-emerald-500 shrink-0" />}
                  </label>
                </React.Fragment>
              ))}
            </div>
            <div className={`p-4 border-t ${theme.divider}`}>
              <button onClick={() => setShowPermissionsModal(false)}
                className="w-full px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-medium transition-colors">
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100]">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
            <p className="text-white text-sm font-medium">Processando...</p>
          </div>
        </div>
      )}

      {/* Notificação */}
      {notification && (
        <div className="fixed top-4 right-4 z-[110] animate-slideIn">
          <div className={`${notification.type === 'success' ? 'bg-emerald-600' : 'bg-slate-700'} text-white px-5 py-3 rounded-lg shadow-xl flex items-center gap-3`}>
            <Check className="w-4 h-4" /> 
            <span className="text-sm font-medium">{notification.message}</span>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideIn { from { opacity:0; transform:translateX(1rem); } to { opacity:1; transform:translateX(0); } }
        .animate-slideIn { animation: slideIn 0.2s ease-out; }
        select option { background: ${isDark ? '#1e293b' : '#ffffff'}; color: ${isDark ? '#f1f5f9' : '#0f172a'}; }
      `}</style>
    </div>
  );
}
