import React, { useState, useRef } from 'react';
import {
  TrendingUp, TrendingDown, DollarSign, CreditCard, Calendar,
  Filter, Download, Search, Sun, Moon, Minus, ChevronDown,
  Plus, X, Shield, Edit, Check,
} from 'lucide-react';

export default function FinancialDashboard() {
  const [selectedFilter, setSelectedFilter]       = useState('all');
  const [searchTerm, setSearchTerm]               = useState('');
  const [isDark, setIsDark]                       = useState(true);
  const [collapsedDates, setCollapsedDates]       = useState({});
  const [showAddModal, setShowAddModal]           = useState(false);
  const [showFilterModal, setShowFilterModal]     = useState(false);
  const [showDetailsModal, setShowDetailsModal]   = useState(false);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [selectedTransaction, setSelectedTransaction]   = useState(null);
  const [isLoading, setIsLoading]                 = useState(false);
  const [notification, setNotification]           = useState(null);
  const [numbersAnimating, setNumbersAnimating]   = useState(false);
  const scrollContainerRef                        = useRef(null);

  const [permissions, setPermissions] = useState({
    acessoTotal: true,
    mostrarResumo: true,
    botaoAdicionar: true,
    botaoFiltrar: true,
    mostrarSaldoCaixa: true,
    mostrarReceitaDespesaDia: true,
    mostrarHistoricoSaldo: true,
  });

  // ─── Handlers ───────────────────────────────────────────────────────────────
  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const togglePermission = (key) => {
    setPermissions((prev) => {
      const next = { ...prev };
      if (key === 'acessoTotal') {
        const val = !prev.acessoTotal;
        Object.keys(next).forEach((k) => { next[k] = val; });
      } else {
        next[key] = !prev[key];
        next.acessoTotal = Object.keys(next).filter((k) => k !== 'acessoTotal').every((k) => next[k]);
      }
      return next;
    });
  };

  const handleTransactionClick = (t) => { setSelectedTransaction(t); setShowDetailsModal(true); };
  const handleEditTransaction   = () => {
    setShowDetailsModal(false);
    setIsLoading(true);
    setTimeout(() => { setIsLoading(false); setNumbersAnimating(true); showNotification('Relatório editado!'); setTimeout(() => setNumbersAnimating(false), 600); }, 1000);
  };
  const handleAddRelatorio = () => {
    setIsLoading(true);
    setTimeout(() => { setIsLoading(false); setShowAddModal(false); setNumbersAnimating(true); showNotification('Relatório adicionado!'); setTimeout(() => setNumbersAnimating(false), 600); }, 1500);
  };
  const handleApplyFilter = () => {
    setIsLoading(true);
    setTimeout(() => { setIsLoading(false); setShowFilterModal(false); setNumbersAnimating(true); showNotification('Filtros aplicados!', 'info'); setTimeout(() => setNumbersAnimating(false), 600); }, 1000);
  };
  const handleSearch = (value) => {
    setSearchTerm(value);
    if (value.length > 0) { setNumbersAnimating(true); setTimeout(() => setNumbersAnimating(false), 600); }
  };
  const toggleDateCollapse = (date) => setCollapsedDates((p) => ({ ...p, [date]: !p[date] }));
  const scrollCarousel = (dir) => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ left: scrollContainerRef.current.scrollLeft + (dir === 'left' ? -300 : 300), behavior: 'smooth' });
    }
  };

  // ─── Data ────────────────────────────────────────────────────────────────────
  const data = {
    pagamentos: {
      'Cartão de Crédito':      { receitas: 7.0,    despesas: 0.0,   lucro: 7.0   },
      'Cartão de Débito':       { receitas: 123.0,  despesas: 0.0,   lucro: 123.0 },
      'Dinheiro':               { receitas: 553.0,  despesas: 107.0, lucro: 446.0 },
      'Link NUBANK':            { receitas: 0.0,    despesas: 0.0,   lucro: 0.0   },
      'PENDENTE':               { receitas: 0.0,    despesas: 0.0,   lucro: 0.0   },
      'PIX':                    { receitas: 557.0,  despesas: 0.0,   lucro: 557.0 },
      'Transferência Bancária': { receitas: 0.0,    despesas: 0.0,   lucro: 0.0   },
      'TOTAL':                  { receitas: 1240.0, despesas: 107.0, lucro: 1133.0},
    },
    transactions: [
      { id: 407, date: '12/02/2026', time: '16:56', description: 'ENTRADA NOITE',              amount:   44.0, method: 'Dinheiro',        type: 'income',  cashBalance: 486.0 },
      { id: 406, date: '12/02/2026', time: '16:56', description: 'ENTRADA DIA',                amount:   40.0, method: 'Dinheiro',        type: 'income',  cashBalance: 442.0 },
      { id: 405, date: '12/02/2026', time: '16:55', description: 'PAGO OFICINA PNEU',          amount:   -5.0, method: 'Dinheiro',        type: 'expense', cashBalance: 402.0 },
      { id: 404, date: '12/02/2026', time: '16:54', description: 'PAGO CHEIRO VERDE',          amount:   -6.0, method: 'Dinheiro',        type: 'expense', cashBalance: 407.0 },
      { id: 403, date: '12/02/2026', time: '16:54', description: 'ENTRADA DIA',                amount:   63.0, method: 'PIX',             type: 'income',  cashBalance: 413.0 },
      { id: 402, date: '12/02/2026', time: '16:52', description: 'ENTRADA DIA',                amount:   40.0, method: 'Dinheiro',        type: 'income',  cashBalance: 413.0 },
      { id: 401, date: '11/02/2026', time: '16:13', description: 'PERNOITE',                   amount:  220.0, method: 'PIX',             type: 'income',  cashBalance: 373.0 },
      { id: 400, date: '11/02/2026', time: '16:12', description: 'PERNOITE',                   amount:   90.0, method: 'PIX',             type: 'income',  cashBalance: 373.0 },
      { id: 399, date: '11/02/2026', time: '16:12', description: 'PERNOITE',                   amount:  177.0, method: 'Dinheiro',        type: 'income',  cashBalance: 373.0 },
      { id: 398, date: '11/02/2026', time: '16:11', description: 'PERNOITE',                   amount:  184.0, method: 'PIX',             type: 'income',  cashBalance: 196.0 },
      { id: 397, date: '11/02/2026', time: '16:11', description: 'CONSUMO 8/15 CARTAO',        amount:    7.0, method: 'Cartão de Crédito', type: 'income', cashBalance: 196.0 },
      { id: 396, date: '11/02/2026', time: '16:04', description: 'PERNOITE',                   amount:  123.0, method: 'Cartão de Débito',  type: 'income', cashBalance: 196.0 },
      { id: 395, date: '11/02/2026', time: '16:03', description: 'PAGO LEITE',                 amount:  -10.0, method: 'Dinheiro',        type: 'expense', cashBalance: 196.0 },
      { id: 394, date: '11/02/2026', time: '16:03', description: 'ENTRADA DIA',                amount:   43.0, method: 'Dinheiro',        type: 'income',  cashBalance: 206.0 },
      { id: 393, date: '11/02/2026', time: '16:02', description: 'PAGO LAVAGEM DE CARRO',      amount:  -40.0, method: 'Dinheiro',        type: 'expense', cashBalance: 163.0 },
      { id: 392, date: '11/02/2026', time: '16:02', description: 'PAGO COMIDA',                amount:  -40.0, method: 'Dinheiro',        type: 'expense', cashBalance: 203.0 },
      { id: 391, date: '11/02/2026', time: '16:01', description: 'PAGO CHEIRO VERDE',          amount:   -6.0, method: 'Dinheiro',        type: 'expense', cashBalance: 243.0 },
    ],
  };

  // ─── Computed ────────────────────────────────────────────────────────────────
  const transactionsWithChange = data.transactions.map((t, i, arr) => {
    const prev   = i < arr.length - 1 ? arr[i + 1].cashBalance : 0;
    const change = t.cashBalance - prev;
    return { ...t, previousBalance: prev, change, changeType: change > 0 ? 'up' : change < 0 ? 'down' : 'neutral' };
  });

  const paymentMethods = Object.entries(data.pagamentos).filter(([k]) => k !== 'TOTAL');
  const total          = data.pagamentos.TOTAL;
  const receitaTotal   = total.receitas;

  const filteredTransactions = transactionsWithChange.filter((t) =>
    t.description.toLowerCase().includes(searchTerm.toLowerCase()) &&
    (selectedFilter === 'all' || t.type === selectedFilter)
  );

  // ─── Helpers ─────────────────────────────────────────────────────────────────
  const getMethodIcon = (method) => {
    if (method.includes('PIX'))       return '🔵';
    if (method.includes('Crédito'))   return '💳';
    if (method.includes('Débito'))    return '💳';
    if (method.includes('Dinheiro'))  return '💵';
    if (method.includes('NUBANK'))    return '🟣';
    if (method.includes('Transfer'))  return '🏦';
    if (method.includes('PENDENTE'))  return '⏳';
    return '💰';
  };

  // Cores fixas por método; novos métodos recebem fallback em sequência
  const knownMethodColors = {
    'Dinheiro':               'from-slate-700 to-slate-800 border-slate-600/40',
    'PIX':                    'from-slate-700 to-slate-800 border-slate-600/40',
    'Cartão de Crédito':      'from-slate-700 to-slate-800 border-slate-600/40',
    'Cartão de Débito':       'from-slate-700 to-slate-800 border-slate-600/40',
    'Link NUBANK':            'from-slate-700 to-slate-800 border-slate-600/40',
    'Transferência Bancária': 'from-slate-700 to-slate-800 border-slate-600/40',
    'PENDENTE':               'from-slate-700 to-slate-800 border-slate-600/40',
  };

  // Accent por método (para o ícone e linha de destaque)
  const methodAccent = {
    'Dinheiro':               'text-emerald-400',
    'PIX':                    'text-sky-400',
    'Cartão de Crédito':      'text-violet-400',
    'Cartão de Débito':       'text-indigo-400',
    'Link NUBANK':            'text-fuchsia-400',
    'Transferência Bancária': 'text-amber-400',
    'PENDENTE':               'text-slate-400',
  };

  const fallbackGradients = [
    'from-slate-700 to-slate-800 border-slate-600/40',
    'from-slate-700 to-slate-800 border-slate-600/40',
  ];
  const fallbackMap = {};
  const getMethodGradient = (method) => {
    if (knownMethodColors[method]) return knownMethodColors[method];
    if (!fallbackMap[method]) fallbackMap[method] = fallbackGradients[Object.keys(fallbackMap).length % fallbackGradients.length];
    return fallbackMap[method];
  };

  // Cards fixos do resumo
  const summaryCards = [
    { key: 'periodo',      titulo: 'PERÍODO',           descricao: '11/02/2026 - 12/02/2026',   receitas: total.receitas, despesas: total.despesas, lucro: total.lucro,  icon: <Calendar   className="w-5 h-5 text-violet-400" />, accent: 'text-violet-400', bar: 'bg-violet-500/30' },
    { key: 'receitaTotal', titulo: 'RECEITA TOTAL',      descricao: 'Todas as receitas do período', receitas: receitaTotal,  despesas: 0,             lucro: receitaTotal, icon: <TrendingUp className="w-5 h-5 text-emerald-400"/>, accent: 'text-emerald-400',bar: 'bg-emerald-500/30'},
    { key: 'dinheiro',     titulo: 'DINHEIRO EM CAIXA', descricao: 'Saldo consolidado no período', receitas: total.receitas, despesas: total.despesas, lucro: total.lucro,  icon: <DollarSign className="w-5 h-5 text-indigo-400" />, accent: 'text-indigo-400', bar: 'bg-indigo-500/30'  },
  ];

  // ─── Theme ───────────────────────────────────────────────────────────────────
  const theme = {
    bg:            isDark ? 'bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950'      : 'bg-gradient-to-br from-slate-50 via-white to-slate-100',
    bgOverlay:     isDark ? 'bg-[radial-gradient(circle_at_50%_120%,rgba(120,119,198,0.15),transparent)]' : 'bg-[radial-gradient(circle_at_50%_120%,rgba(120,119,198,0.1),transparent)]',
    text:          isDark ? 'text-white'            : 'text-slate-900',
    textSecondary: isDark ? 'text-slate-400'        : 'text-slate-600',
    card:          isDark ? 'bg-white/5 border-white/10'  : 'bg-white border-slate-200',
    cardHover:     isDark ? 'hover:bg-white/8'      : 'hover:bg-slate-50',
    input:         isDark ? 'bg-white/10 border-white/15 text-white placeholder-slate-500' : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400',
    tableHeader:   isDark ? 'bg-white/5'            : 'bg-slate-100',
    divider:       isDark ? 'border-white/10'       : 'border-slate-200',
    button:        isDark ? 'bg-white/10 hover:bg-white/20 border-white/10' : 'bg-slate-100 hover:bg-slate-200 border-slate-300',
  };

  // classe reutilizável para inputs/selects
  const inputCls = `w-full px-3 py-2 ${theme.input} rounded-lg text-sm border focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent`;


  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className={`min-h-screen relative ${theme.bg}`}>
      <div className={`fixed inset-0 ${theme.bgOverlay} pointer-events-none`} />

      <div className="relative max-w-[1600px] mx-auto p-4 sm:p-8">

        {/* ── Header ── */}
        <header className="mb-6 pt-6 flex items-center justify-between">
          <div>
            <h1 className={`text-3xl font-bold ${theme.text} mb-1 tracking-tight`}>Financeiro</h1>
            <p className={`${theme.textSecondary} text-sm flex items-center gap-2`}>
              <Sun className="w-3.5 h-3.5" /> Resumo financeiro e histórico de transações do hotel
            </p>
          </div>
          <div className="flex gap-2">
            {[
              { label: 'Permissões', icon: <Shield className="w-4 h-4" />, action: () => setShowPermissionsModal(true) },
              { label: isDark ? 'Light' : 'Dark', icon: isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />, action: () => setIsDark(!isDark) },
              { label: 'Exportar',   icon: <Download className="w-4 h-4" />, action: () => {} },
            ].map(({ label, icon, action }) => (
              <button key={label} onClick={action}
                className={`px-4 py-2 ${theme.button} ${theme.text} rounded-lg border text-sm font-medium flex items-center gap-2 hover:scale-105 active:scale-95 transition-all`}>
                {icon} {label}
              </button>
            ))}
          </div>
        </header>

        {/* ── Resumo Financeiro ── */}
        {permissions.mostrarResumo && (
          <div className={`${theme.card} backdrop-blur-xl rounded-xl p-4 mb-6 border shadow-xl`}>
            <div className="flex items-center gap-2 mb-4">
              <CreditCard className="w-4 h-4 text-violet-500" />
              <h2 className={`text-sm font-bold ${theme.text} uppercase tracking-wider`}>Resumo Financeiro</h2>
            </div>

            <div className="relative">
              {/* Botões de rolagem */}
              <div className="hidden sm:flex absolute inset-y-0 left-0 items-center z-10">
                <button onClick={() => scrollCarousel('left')}
                  className="ml-[-10px] w-7 h-7 rounded-full bg-slate-800/90 border border-white/10 text-white/60 hover:text-white hover:bg-violet-600 hover:border-violet-500 flex items-center justify-center shadow-lg hover:scale-110 active:scale-95 transition-all">
                  <ChevronDown className="w-4 h-4 rotate-90" />
                </button>
              </div>
              <div className="hidden sm:flex absolute inset-y-0 right-0 items-center z-10">
                <button onClick={() => scrollCarousel('right')}
                  className="mr-[-10px] w-7 h-7 rounded-full bg-slate-800/90 border border-white/10 text-white/60 hover:text-white hover:bg-violet-600 hover:border-violet-500 flex items-center justify-center shadow-lg hover:scale-110 active:scale-95 transition-all">
                  <ChevronDown className="w-4 h-4 -rotate-90" />
                </button>
              </div>

              <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-white/5 pb-2" ref={scrollContainerRef}>
                <div className="flex gap-3 w-max">

                  {/* Cards fixos */}
                  {summaryCards.map((card) => (
                    <div key={card.key}
                      className={`${theme.card} rounded-xl p-4 border shadow-lg w-[260px] flex-shrink-0 hover:border-white/20 transition-all`}>
                      <div className="flex items-center gap-2 mb-3">
                        <div className={`p-2 rounded-lg ${card.bar}`}>{card.icon}</div>
                        <div>
                          <span className={`${theme.text} font-bold text-sm block`}>{card.titulo}</span>
                          <span className={`${theme.textSecondary} text-[10px]`}>{card.descricao}</span>
                        </div>
                      </div>
                      <div className="space-y-1.5 text-xs">
                        <div className="flex justify-between">
                          <span className={theme.textSecondary}>Receitas</span>
                          <span className="text-emerald-400 font-semibold">R$ {card.receitas.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className={theme.textSecondary}>Despesas</span>
                          <span className="text-rose-400 font-semibold">R$ {card.despesas.toFixed(2)}</span>
                        </div>
                        <div className={`h-px ${theme.divider} my-1`} />
                        <div className="flex justify-between">
                          <span className={`${theme.textSecondary} font-semibold`}>Lucro</span>
                          <span className={`${card.accent} font-bold text-sm`}>R$ {card.lucro.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Cards por método de pagamento */}
                  {paymentMethods.map(([method, values]) => {
                    const accent = methodAccent[method] || 'text-slate-300';
                    return (
                      <div key={method}
                        className={`${theme.card} rounded-xl p-4 border shadow-lg w-[260px] flex-shrink-0 hover:border-white/20 transition-all`}>
                        <div className="flex items-center gap-2 mb-3">
                          <div className="p-2 rounded-lg bg-white/10">
                            <span className="text-base">{getMethodIcon(method)}</span>
                          </div>
                          <div>
                            <span className={`${theme.text} font-bold text-sm block truncate`}>{method}</span>
                            <span className={`${theme.textSecondary} text-[10px]`}>Forma de pagamento</span>
                          </div>
                        </div>
                        <div className="space-y-1.5 text-xs">
                          <div className="flex justify-between">
                            <span className={theme.textSecondary}>Receitas</span>
                            <span className="text-emerald-400 font-semibold">R$ {values.receitas.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className={theme.textSecondary}>Despesas</span>
                            <span className="text-rose-400 font-semibold">R$ {values.despesas.toFixed(2)}</span>
                          </div>
                          <div className={`h-px ${theme.divider} my-1`} />
                          <div className="flex justify-between">
                            <span className={`${theme.textSecondary} font-semibold`}>Lucro</span>
                            <span className={`${values.lucro >= 0 ? accent : 'text-rose-400'} font-bold text-sm`}>
                              R$ {values.lucro.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Histórico do Saldo ── */}
        {permissions.mostrarHistoricoSaldo && (
          <div className={`${theme.card} rounded-xl border shadow-xl overflow-hidden mb-6`}>
            {/* Header */}
            <div className={`px-4 py-3 border-b ${theme.divider} flex flex-col sm:flex-row gap-3 sm:items-center justify-between`}>
              <div>
                <h2 className={`text-lg font-bold ${theme.text}`}>Histórico do Saldo</h2>
                <p className={`${theme.textSecondary} text-xs`}>Transações agrupadas por data.</p>
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:flex-initial">
                  <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 ${theme.textSecondary}`} />
                  <input type="text" placeholder="Buscar..." value={searchTerm} onChange={(e) => handleSearch(e.target.value)}
                    className={`${inputCls} pl-9 sm:w-64`} />
                </div>
                {permissions.botaoFiltrar && (
                  <button onClick={() => setShowFilterModal(true)}
                    className={`px-3 py-2 ${theme.button} ${theme.text} rounded-lg border text-sm font-medium flex items-center gap-2 hover:scale-105 active:scale-95 transition-all`}>
                    <Filter className="w-4 h-4" /> Filtros
                  </button>
                )}
                {permissions.botaoAdicionar && (
                  <button onClick={() => setShowAddModal(true)}
                    className="px-3 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-medium flex items-center gap-2 hover:scale-105 active:scale-95 hover:shadow-lg  transition-all">
                    <Plus className="w-4 h-4" /> Adicionar
                  </button>
                )}
              </div>
            </div>

            {/* Grupos por data */}
            <div className="divide-y divide-slate-700/40">
              {Object.entries(
                filteredTransactions.reduce((g, t) => { if (!g[t.date]) g[t.date] = []; g[t.date].push(t); return g; }, {})
              ).map(([date, transactions]) => {
                const isCollapsed  = collapsedDates[date];
                const dayReceitas  = transactions.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
                const dayDespesas  = transactions.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
                const dayLucro     = dayReceitas - dayDespesas;

                return (
                  <div key={date}>
                    {/* Header da data */}
                    <div onClick={() => toggleDateCollapse(date)}
                      className={`px-4 py-3 flex items-center justify-between cursor-pointer ${theme.cardHover} transition-colors`}>
                      <div className="flex items-center gap-3">
                        <ChevronDown className={`w-4 h-4 text-violet-400 transition-transform duration-200 ${isCollapsed ? '-rotate-90' : ''}`} />
                        <div>
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-violet-400" />
                            <span className={`${theme.text} font-semibold text-sm`}>{date}</span>
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-300 border border-violet-500/30">
                              {transactions.length} {transactions.length === 1 ? 'transação' : 'transações'}
                            </span>
                          </div>
                        </div>
                      </div>
                      {permissions.mostrarReceitaDespesaDia && (
                        <div className="hidden sm:flex items-center gap-4 text-xs font-semibold">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                            <span className="text-emerald-400">R$ {dayReceitas.toFixed(2)}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-rose-500" />
                            <span className="text-rose-400">R$ {dayDespesas.toFixed(2)}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-violet-400" />
                            <span className={dayLucro >= 0 ? 'text-violet-400' : 'text-rose-400'}>
                              R$ {dayLucro.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Linhas de transação */}
                    {/* Linhas de transação — estilo tabela de funcionários */}
{!isCollapsed && (
  <div className="overflow-x-auto">
    <table className="w-full">
      <thead>
  <tr className={`border-b ${theme.divider} ${theme.tableHeader}`}>
    <th className={`text-left p-3 ${theme.textSecondary} font-semibold text-[10px] uppercase tracking-wider w-10`}>
      Pgto
    </th>
    <th className={`text-left p-3 ${theme.textSecondary} font-semibold text-[10px] uppercase tracking-wider`}>
      Descrição
    </th>
    <th className={`text-right p-3 ${theme.textSecondary} font-semibold text-[10px] uppercase tracking-wider`}>
      Valor
    </th>
    {permissions.mostrarSaldoCaixa && (
      <th className={`text-right p-3 ${theme.textSecondary} font-semibold text-[10px] uppercase tracking-wider`}>
        Saldo Caixa
      </th>
    )}
  </tr>
</thead>

<tbody className={`divide-y ${theme.divider}`}>
  {transactions.map((transaction, index) => {
    const isExpense = transaction.amount < 0;
    const accent    = isExpense ? 'text-rose-400' : methodAccent[transaction.method] || 'text-slate-300';
    const trendIcon = transaction.changeType === 'up'
      ? <TrendingUp   className="w-3.5 h-3.5 text-emerald-400" />
      : transaction.changeType === 'down'
      ? <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
      : <Minus        className="w-3.5 h-3.5 text-slate-400" />;

    return (
      <tr
        key={transaction.id}
        onClick={() => handleTransactionClick(transaction)}
        className={`
          transition-all duration-200 cursor-pointer
          hover:bg-violet-500/10
          hover:-translate-y-0.5
          `}
        style={{ animationDelay: `${index * 30}ms` }}
        >

        {/* Ícone do método — sem círculo, maior */}
        <td className="p-3">
          <span className="text-xl leading-none">{getMethodIcon(transaction.method)}</span>
        </td>

        {/* Descrição + hora e método abaixo */}
        <td className="p-3">
          <span className={`${theme.text} text-sm font-medium block`}>
            {transaction.description}
          </span>
          <span className={`${theme.textSecondary} text-[11px] mt-0.5 block`}>
            {transaction.time} · {transaction.method}
          </span>
        </td>

        {/* Valor */}
        <td className="p-3 text-right">
          <span className={`text-sm font-bold ${accent}`}>
            {isExpense ? '-' : '+'}R$ {Math.abs(transaction.amount).toFixed(2)}
          </span>
        </td>

        {/* Saldo caixa */}
        {permissions.mostrarSaldoCaixa && (
          <td className="p-3 text-right">
            <div className="flex items-center justify-end gap-1.5">
              <span className={`${theme.text} font-bold text-sm`}>
                R$ {transaction.cashBalance.toFixed(2)}
              </span>
              {trendIcon}
            </div>
          </td>
        )}
      </tr>
    );
  })}
</tbody>

    </table>
  </div>
)}

                  </div>
                );
              })}
            </div>

            {filteredTransactions.length === 0 && (
              <div className="p-12 text-center">
                <p className={`${theme.textSecondary} text-base mb-1`}>Nenhuma transação encontrada</p>
                <p className={`${theme.textSecondary} text-sm opacity-70`}>Tente ajustar os filtros de busca</p>
              </div>
            )}

            {/* Rodapé */}
            <div className={`p-3 border-t ${theme.divider} ${theme.tableHeader}`}>
              {/* Legenda */}
              <div className="flex flex-wrap items-center gap-4 mb-3 text-xs">
                {[
                  { color: 'bg-emerald-500', label: 'Entradas em Dinheiro | Receita do dia' },
                  { color: 'bg-sky-500',     label: 'Entradas | Outros tipos de pagamento)' },
                  { color: 'bg-rose-500',    label: 'Saídas | Despesa do dia' },
                  { color: 'bg-purple-500',    label: 'Lucro do dia | Lucro por categoria' },
                ].map(({ color, label }) => (
                  <div key={label} className="flex items-center gap-1.5">
                    <span className={`w-2.5 h-2.5 rounded-full ${color}`} />
                    <span className={theme.textSecondary}>{label}</span>
                  </div>
                ))}
              </div>
              <div className={`flex justify-between items-center text-xs ${theme.textSecondary}`}>
                <span>Mostrando {filteredTransactions.length} de {transactionsWithChange.length} transações</span>
                <div className="flex gap-2">
                  {['Anterior', 'Próxima'].map((label) => (
                    <button key={label} className={`px-3 py-1.5 ${theme.button} ${theme.text} rounded-lg border text-xs hover:scale-105 active:scale-95 transition-all`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Modal Adicionar ── */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`${theme.card} rounded-xl border shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto`}>
            <div className={`p-4 border-b ${theme.divider} flex items-center justify-between sticky top-0 ${theme.card} z-10`}>
              <h3 className={`text-lg font-bold ${theme.text}`}>Adicionar Relatório</h3>
              <button onClick={() => setShowAddModal(false)} className={`${theme.textSecondary} hover:scale-110 active:scale-90 transition-transform`}><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className={`block text-sm font-medium ${theme.text} mb-1.5`}>Descrição</label>
                <input type="text" placeholder="Ex: Entrada de diária" className={inputCls} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`block text-sm font-medium ${theme.text} mb-1.5`}>Tipo de Lançamento</label>
                  <select className={inputCls}>
                    <option value="income">Receita</option>
                    <option value="expense">Despesa</option>
                  </select>
                </div>
                <div>
                  <label className={`block text-sm font-medium ${theme.text} mb-1.5`}>Tipo de Pagamento</label>
                  <select className={inputCls}>
                    {['Dinheiro','Cartão de Crédito','Cartão de Débito','PIX','Link NUBANK','Transferência Bancária','PENDENTE'].map((m) => (
                      <option key={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className={`block text-sm font-medium ${theme.text} mb-1.5`}>Valor</label>
                <input type="number" step="0.01" placeholder="0.00" className={inputCls} />
              </div>
              
              <div>
                <label className={`block text-sm font-medium ${theme.text} mb-1.5`}>Quarto</label>
                  <select className={inputCls}>
                    <option value="all">Todos os quartos</option>
                      {[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22].map((n) => (
                      <option key={n} value={n}>Quarto {String(n).padStart(2, '0')}</option>))}
                  </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button onClick={() => setShowAddModal(false)}
                  className={`flex-1 px-4 py-2 ${theme.button} ${theme.text} rounded-lg border text-sm font-medium hover:scale-105 active:scale-95 transition-all`}>
                  Cancelar
                </button>
                <button onClick={handleAddRelatorio}
                  className="flex-1 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-medium hover:scale-105 active:scale-95 hover:shadow-lg  transition-all">
                  Salvar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Filtros ── */}
      {showFilterModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`${theme.card} rounded-xl border shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto`}>

            <div className={`p-4 border-b ${theme.divider} flex items-center justify-between sticky top-0 ${theme.card} z-10`}>
              <h3 className={`text-lg font-bold ${theme.text}`}>Filtros</h3>
              <button onClick={() => setShowFilterModal(false)} className={`${theme.textSecondary} hover:scale-110 active:scale-90 transition-transform`}><X className="w-5 h-5" /></button>
            </div>
            
            <div className="p-4 space-y-4">

              <div>
                <label className={`block text-sm font-medium ${theme.text} mb-1.5`}>Período</label>
                <div className="grid grid-cols-2 gap-2">
                  <div><input type="date" className={inputCls} /><span className={`text-xs ${theme.textSecondary} mt-1 block`}>Data inicial</span></div>
                  <div><input type="date" className={inputCls} /><span className={`text-xs ${theme.textSecondary} mt-1 block`}>Data final</span></div>
                </div>
              </div>

              <div>
                <label className={`block text-sm font-medium ${theme.text} mb-1.5`}>Tipo de Lançamento</label>
                <select value={selectedFilter} onChange={(e) => setSelectedFilter(e.target.value)} className={inputCls}>
                  <option value="all">Todos</option>
                  <option value="income">Receitas</option>
                  <option value="expense">Despesas</option>
                </select>
              </div>

              <div>
                <label className={`block text-sm font-medium ${theme.text} mb-1.5`}>Tipo de Pagamento</label>
                <select className={inputCls}>
                  <option value="all">Todos</option>
                  {['Dinheiro','Cartão de Crédito','Cartão de Débito','PIX','Link NUBANK','Transferência Bancária','PENDENTE'].map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className={`block text-sm font-medium ${theme.text} mb-1.5`}>Quarto</label>
                  <select className={inputCls}>
                    <option value="all">Todos os quartos</option>
                      {[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22].map((n) => (
                      <option key={n} value={n}>Quarto {String(n).padStart(2, '0')}</option>))}
                  </select>
              </div>

              <div>
                <label className={`block text-sm font-medium ${theme.text} mb-1.5`}>Funcionário</label>
                  <select className={inputCls}>
                    <option value="all">Todos os funcionários</option>
                    {['Ana Paula','Carlos Oliveira','João Silva','Marcos Souza','Joana Lima','Pedro Lima','José Almeida'].map((f) => (
                      <option key={f} value={f}>{f}</option>))}
                  </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button onClick={() => setShowFilterModal(false)}
                  className={`flex-1 px-4 py-2 ${theme.button} ${theme.text} rounded-lg border text-sm font-medium hover:scale-105 active:scale-95 transition-all`}>
                  Limpar
                </button>
                <button onClick={handleApplyFilter}
                  className="flex-1 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-medium hover:scale-105 active:scale-95 hover:shadow-lg  transition-all">
                  Aplicar
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* ── Modal Permissões ── */}
      {showPermissionsModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`${theme.card} rounded-xl border shadow-2xl max-w-md w-full`}>
            <div className={`p-4 border-b ${theme.divider} flex items-center justify-between`}>
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-violet-500" />
                <h3 className={`text-lg font-bold ${theme.text}`}>Configurar Permissões</h3>
              </div>
              <button onClick={() => setShowPermissionsModal(false)} className={`${theme.textSecondary} hover:scale-110 active:scale-90 transition-transform`}><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className={`p-3 rounded-lg ${permissions.acessoTotal ? 'bg-emerald-500/10 border border-emerald-500/30' : `${theme.card} border`}`}>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={permissions.acessoTotal} onChange={() => togglePermission('acessoTotal')} className="w-5 h-5 rounded accent-emerald-500 cursor-pointer" />
                  <div>
                    <span className={`${theme.text} font-bold text-sm block`}>🔓 Acesso Total</span>
                    <span className={`text-xs ${theme.textSecondary}`}>Habilita todas as visualizações e ações</span>
                  </div>
                  {permissions.acessoTotal && <Check className="w-5 h-5 text-emerald-500 ml-auto" />}
                </label>
              </div>
              <div className={`h-px ${theme.divider}`} />
              <div className="space-y-3">
                {[
                  { key: 'mostrarResumo',             label: '📊 Mostrar Dashboard Financeiro'        },
                  { key: 'botaoAdicionar',             label: '➕ Adicionar Relatorio'           },
                  { key: 'botaoFiltrar',               label: '🔍 Filtros de busca do Relatorio'             },
                  { key: 'mostrarSaldoCaixa',          label: '💵 Historico do Saldo do Caixa'            },
                  { key: 'mostrarReceitaDespesaDia',   label: '📈 Receita/Despesa/Lucro do Dia'},
                
                ].map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={permissions[key]} onChange={() => togglePermission(key)} className="w-4 h-4 rounded accent-violet-500 cursor-pointer" />
                    <span className={`${theme.text} text-sm`}>{label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className={`p-4 border-t ${theme.divider}`}>
              <button onClick={() => setShowPermissionsModal(false)}
                className="w-full px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-medium hover:scale-105 active:scale-95 hover:shadow-lg  transition-all">
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Detalhes ── */}
      {showDetailsModal && selectedTransaction && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`${theme.card} rounded-xl border shadow-2xl max-w-lg w-full`}>
            <div className={`p-4 border-b ${theme.divider} flex items-center justify-between`}>
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${selectedTransaction.type === 'income' ? 'bg-emerald-500/20' : 'bg-rose-500/20'}`}>
                  {selectedTransaction.type === 'income'
                    ? <TrendingUp className="w-5 h-5 text-emerald-500" />
                    : <TrendingDown className="w-5 h-5 text-rose-500" />}
                </div>
                <div>
                  <h3 className={`text-lg font-bold ${theme.text}`}>{selectedTransaction.type === 'income' ? 'Receita' : 'Despesa'}</h3>
                  <p className={`${theme.textSecondary} text-xs`}>{selectedTransaction.description}</p>
                </div>
              </div>
              <button onClick={() => setShowDetailsModal(false)} className={`${theme.textSecondary} hover:scale-110 active:scale-90 transition-transform`}><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className={`p-4 rounded-lg ${selectedTransaction.type === 'income' ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-rose-500/10 border border-rose-500/20'}`}>
                <div className="flex items-center justify-between">
                  <span className={`text-sm ${theme.textSecondary}`}>Valor</span>
                  <span className={`text-3xl font-bold ${selectedTransaction.type === 'income' ? 'text-emerald-500' : 'text-rose-500'}`}>
                    R$ {Math.abs(selectedTransaction.amount).toFixed(2)}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`text-xs ${theme.textSecondary} uppercase tracking-wide mb-1 block`}>Data</label>
                  <div className={`${theme.text} font-medium flex items-center gap-2`}><Calendar className="w-4 h-4 text-violet-500" />{selectedTransaction.date}</div>
                </div>
                <div>
                  <label className={`text-xs ${theme.textSecondary} uppercase tracking-wide mb-1 block`}>Hora</label>
                  <div className={`${theme.text} font-medium`}>{selectedTransaction.time}</div>
                </div>
              </div>
              <div>
                <label className={`text-xs ${theme.textSecondary} uppercase tracking-wide mb-1 block`}>Forma de Pagamento</label>
                <div className={`flex items-center gap-2 ${theme.text} font-medium`}>
                  <span className="text-xl">{getMethodIcon(selectedTransaction.method)}</span>
                  {selectedTransaction.method}
                </div>
              </div>
              {selectedTransaction.method === 'Dinheiro' && (
                <div className="p-3 rounded-lg bg-slate-900/40 border border-slate-700">
                  <label className={`text-xs ${theme.textSecondary} uppercase tracking-wide mb-1 block`}>Saldo do Caixa</label>
                  <div className="flex items-center justify-between">
                    <span className={`${theme.text} font-bold text-lg`}>R$ {selectedTransaction.cashBalance.toFixed(2)}</span>
                    <div className="flex items-center gap-2">
                      {selectedTransaction.changeType === 'up'   && <><TrendingUp   className="w-4 h-4 text-emerald-500" /><span className="text-sm text-emerald-500 font-medium">+R$ {selectedTransaction.change.toFixed(2)}</span></>}
                      {selectedTransaction.changeType === 'down' && <><TrendingDown  className="w-4 h-4 text-rose-500"    /><span className="text-sm text-rose-500 font-medium">R$ {selectedTransaction.change.toFixed(2)}</span></>}
                      {selectedTransaction.changeType === 'neutral' && <><Minus className="w-4 h-4 text-slate-400" /><span className="text-sm text-slate-400 font-medium">Sem alteração</span></>}
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className={`p-4 border-t ${theme.divider} flex gap-2`}>
              <button onClick={() => setShowDetailsModal(false)}
                className={`flex-1 px-4 py-2 ${theme.button} ${theme.text} rounded-lg border text-sm font-medium hover:scale-105 active:scale-95 transition-all`}>
                Fechar
              </button>
              <button onClick={handleEditTransaction}
                className="flex-1 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-2 hover:scale-105 active:scale-95 hover:shadow-lg  transition-all">
                <Edit className="w-4 h-4" /> Editar
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
          <div className={`${
            notification.type === 'success' ? 'bg-emerald-500' :
            notification.type === 'error'   ? 'bg-rose-500'    :
            notification.type === 'info'    ? 'bg-blue-500'    : 'bg-slate-700'
          } text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-3`}>
            <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
            <span className="font-medium">{notification.message}</span>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes slideIn { from { opacity:0; transform:translateX(100%); } to { opacity:1; transform:translateX(0); } }
        .animate-slideIn { animation: slideIn 0.3s ease-out; }
        .scrollbar-thin::-webkit-scrollbar       { height: 6px; }
        .scrollbar-thin::-webkit-scrollbar-track { background: rgba(255,255,255,0.05); border-radius: 3px; }
        .scrollbar-thin::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2);  border-radius: 3px; }
        .scrollbar-thin::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.3); }
        select option {
          background-color: #1e293b;
          color: #f8fafc;
        }
        
      `}</style>
    </div>
  );
}
