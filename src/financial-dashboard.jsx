import React, { useState } from 'react';
import { TrendingUp, TrendingDown, DollarSign, CreditCard, Calendar, Filter, Download, Search, Sun, Moon, Minus, ChevronDown, Plus, X, Edit } from 'lucide-react';

export default function FinancialDashboard() {
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isDark, setIsDark] = useState(true);
  const [collapsedDates, setCollapsedDates] = useState({});
  const [showAddModal, setShowAddModal] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [notification, setNotification] = useState(null);
  const [numbersAnimating, setNumbersAnimating] = useState(false);

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleTransactionClick = (transaction) => {
    setSelectedTransaction(transaction);
    setShowDetailsModal(true);
  };

  const handleEditTransaction = () => {
    setShowDetailsModal(false);
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setNumbersAnimating(true);
      showNotification('Relatório editado com sucesso!');
      setTimeout(() => setNumbersAnimating(false), 600);
    }, 1000);
  };

  const handleAddRelatorio = () => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setShowAddModal(false);
      setNumbersAnimating(true);
      showNotification('Relatório adicionado com sucesso!');
      setTimeout(() => setNumbersAnimating(false), 600);
    }, 1500);
  };

  const handleApplyFilter = () => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setShowFilterModal(false);
      setNumbersAnimating(true);
      showNotification('Filtros aplicados com sucesso!', 'info');
      setTimeout(() => setNumbersAnimating(false), 600);
    }, 1000);
  };

  const handleSearch = (value) => {
    setSearchTerm(value);
    if (value.length > 0) {
      setNumbersAnimating(true);
      setTimeout(() => setNumbersAnimating(false), 600);
    }
  };

  const toggleDateCollapse = (date) => {
    setCollapsedDates(prev => ({
      ...prev,
      [date]: !prev[date]
    }));
  };
  
  const data = {
    pagamentos: {
      "Cartão de Crédito": { receitas: 7.0, despesas: 0.0, lucro: 7.0 },
      "Cartão de Débito": { receitas: 123.0, despesas: 0.0, lucro: 123.0 },
      "Dinheiro": { receitas: 553.0, despesas: 107.0, lucro: 446.0 },
      "Link NUBANK": { receitas: 0.0, despesas: 0.0, lucro: 0.0 },
      "PENDENTE": { receitas: 0.0, despesas: 0.0, lucro: 0.0 },
      "PIX": { receitas: 557.0, despesas: 0.0, lucro: 557.0 },
      "Transferência Bancária": { receitas: 0.0, despesas: 0.0, lucro: 0.0 },
      "TOTAL": { receitas: 1240.0, despesas: 107.0, lucro: 1133.0 }
    },
    transactions: [
      { id: 407, date: "12/02/2026", time: "16:56", description: "ENTRADA NOITE", amount: 44.0, method: "Dinheiro", type: "income", cashBalance: 486.0 },
      { id: 406, date: "12/02/2026", time: "16:56", description: "ENTRADA DIA", amount: 40.0, method: "Dinheiro", type: "income", cashBalance: 442.0 },
      { id: 405, date: "12/02/2026", time: "16:55", description: "PAGO OFICINA PNEU (CARRO DE MAO)", amount: -5.0, method: "Dinheiro", type: "expense", cashBalance: 402.0 },
      { id: 404, date: "12/02/2026", time: "16:54", description: "PAGO CHEIRO VERDE", amount: -6.0, method: "Dinheiro", type: "expense", cashBalance: 407.0 },
      { id: 403, date: "12/02/2026", time: "16:54", description: "ENTRADA DIA", amount: 63.0, method: "PIX", type: "income", cashBalance: 413.0 },
      { id: 402, date: "12/02/2026", time: "16:52", description: "ENTRADA DIA", amount: 40.0, method: "Dinheiro", type: "income", cashBalance: 413.0 },
      { id: 401, date: "11/02/2026", time: "16:13", description: "PERNOITE", amount: 220.0, method: "PIX", type: "income", cashBalance: 373.0 },
      { id: 400, date: "11/02/2026", time: "16:12", description: "PERNOITE", amount: 90.0, method: "PIX", type: "income", cashBalance: 373.0 },
      { id: 399, date: "11/02/2026", time: "16:12", description: "PERNOITE", amount: 177.0, method: "Dinheiro", type: "income", cashBalance: 373.0 },
      { id: 398, date: "11/02/2026", time: "16:11", description: "PERNOITE", amount: 184.0, method: "PIX", type: "income", cashBalance: 196.0 },
      { id: 397, date: "11/02/2026", time: "16:11", description: "CONSUMO 8/15 CARTAO", amount: 7.0, method: "Cartão de Crédito", type: "income", cashBalance: 196.0 },
      { id: 396, date: "11/02/2026", time: "16:04", description: "PERNOITE", amount: 123.0, method: "Cartão de Débito", type: "income", cashBalance: 196.0 },
      { id: 395, date: "11/02/2026", time: "16:03", description: "PAGO LEITE", amount: -10.0, method: "Dinheiro", type: "expense", cashBalance: 196.0 },
      { id: 394, date: "11/02/2026", time: "16:03", description: "ENTRADA DIA", amount: 43.0, method: "Dinheiro", type: "income", cashBalance: 206.0 },
      { id: 393, date: "11/02/2026", time: "16:02", description: "PAGO LAVAGEM DE CARRO", amount: -40.0, method: "Dinheiro", type: "expense", cashBalance: 163.0 },
      { id: 392, date: "11/02/2026", time: "16:02", description: "PAGO COMIDA", amount: -40.0, method: "Dinheiro", type: "expense", cashBalance: 203.0 },
      { id: 391, date: "11/02/2026", time: "16:01", description: "PAGO CHEIRO VERDE", amount: -6.0, method: "Dinheiro", type: "expense", cashBalance: 243.0 },
      { id: 390, date: "11/02/2026", time: "16:01", description: "SALDO TRANFERIDO", amount: 249.0, method: "Dinheiro", type: "income", cashBalance: 249.0 }
    ]
  };

  const transactionsWithChange = data.transactions.map((transaction, index, arr) => {
    const previousBalance = index < arr.length - 1 ? arr[index + 1].cashBalance : 0;
    const change = transaction.cashBalance - previousBalance;
    const changeType = change > 0 ? 'up' : change < 0 ? 'down' : 'neutral';
    return { ...transaction, previousBalance, change, changeType };
  });

  const paymentMethods = Object.entries(data.pagamentos).filter(([key]) => key !== 'TOTAL');
  const total = data.pagamentos.TOTAL;

  const filteredTransactions = transactionsWithChange.filter(t => {
    const matchesSearch = t.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = selectedFilter === 'all' || t.type === selectedFilter;
    return matchesSearch && matchesFilter;
  });

  const getMethodIcon = (method) => {
    if (method.includes('PIX')) return '💳';
    if (method.includes('Cartão')) return '💳';
    if (method.includes('Dinheiro')) return '💵';
    return '💰';
  };

  const theme = {
    bg: isDark ? 'bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950' : 'bg-gradient-to-br from-slate-50 via-white to-slate-100',
    bgOverlay: isDark ? 'bg-[radial-gradient(circle_at_50%_120%,rgba(120,119,198,0.15),rgba(255,255,255,0))]' : 'bg-[radial-gradient(circle_at_50%_120%,rgba(120,119,198,0.1),rgba(255,255,255,0))]',
    text: isDark ? 'text-white' : 'text-slate-900',
    textSecondary: isDark ? 'text-slate-400' : 'text-slate-600',
    card: isDark ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200',
    cardHover: isDark ? 'hover:bg-white/10' : 'hover:bg-slate-50',
    input: isDark ? 'bg-white/10 border-white/20 text-white placeholder-slate-400' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-500',
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
                Financeiro
              </h1>
              <p className={`${theme.textSecondary} text-sm flex items-center gap-2`}>
                <Calendar className="w-3.5 h-3.5" />
                11/02/2026 - 12/02/2026
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
              <button className={`px-4 py-2 ${theme.button} ${theme.text} rounded-lg backdrop-blur-sm border transition-all duration-200 flex items-center gap-2 text-sm font-medium hover:scale-105 active:scale-95`}>
                <Download className="w-4 h-4" />
                Exportar
              </button>
            </div>
          </div>
        </header>

        <div className={`${theme.card} backdrop-blur-xl rounded-xl p-4 mb-6 border shadow-xl`}>
          <div className="flex items-center gap-2 mb-4">
            <CreditCard className="w-4 h-4 text-violet-500" />
            <h2 className={`text-sm font-bold ${theme.text} uppercase tracking-wider`}>Resumo Financeiro</h2>
          </div>
          
          <div className="relative">
            <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-white/5 pb-2">
              <div className="flex gap-3 w-max">
                <div className="bg-gradient-to-br from-violet-500 to-purple-600 rounded-lg p-4 border border-violet-400/30 shadow-lg w-[280px] flex-shrink-0">
                  <div className="flex items-center gap-2 mb-3">
                    <Calendar className="w-5 h-5 text-white" />
                    <div className="flex flex-col">
                      <span className="text-white font-bold text-sm">PERÍODO</span>
                      <span className="text-white/80 text-xs">11/02 - 12/02/2026</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-white/80 text-xs uppercase">Receitas</span>
                      <span className={`text-white font-bold text-sm ${numbersAnimating ? 'animate-numberSpin' : ''}`}>R$ {total.receitas.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-white/80 text-xs uppercase">Despesas</span>
                      <span className={`text-white font-bold text-sm ${numbersAnimating ? 'animate-numberSpin' : ''}`}>R$ {total.despesas.toFixed(2)}</span>
                    </div>
                    <div className="h-px bg-white/20 my-2"></div>
                    <div className="flex justify-between items-center">
                      <span className="text-white text-xs uppercase font-semibold">Lucro do Período</span>
                      <span className={`text-white font-bold text-base ${numbersAnimating ? 'animate-numberSpin' : ''}`}>R$ {total.lucro.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-indigo-500 to-blue-600 rounded-lg p-4 border border-indigo-400/30 shadow-lg w-[280px] flex-shrink-0">
                  <div className="flex items-center gap-2 mb-3">
                    <DollarSign className="w-5 h-5 text-white" />
                    <span className="text-white font-bold text-sm">TOTAL DE VENDAS</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-white/80 text-xs uppercase">Receitas</span>
                      <span className={`text-white font-bold text-sm ${numbersAnimating ? 'animate-numberSpin' : ''}`}>R$ {total.receitas}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-white/80 text-xs uppercase">Despesas</span>
                      <span className={`text-white font-bold text-sm ${numbersAnimating ? 'animate-numberSpin' : ''}`}>R$ {total.despesas}</span>
                    </div>
                    <div className="h-px bg-white/20 my-2"></div>
                    <div className="flex justify-between items-center">
                      <span className="text-white text-xs uppercase font-semibold">Lucro</span>
                      <span className={`text-white font-bold text-base ${numbersAnimating ? 'animate-numberSpin' : ''}`}>R$ {total.lucro}</span>
                    </div>
                  </div>
                </div>

                {paymentMethods.map(([method, values]) => (
                  <div key={method} className={`${theme.card} rounded-lg p-4 border ${theme.cardHover} transition-all w-[280px] flex-shrink-0`}>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-xl">{getMethodIcon(method)}</span>
                      <span className={`${theme.text} font-medium text-sm truncate`}>{method}</span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className={`${theme.textSecondary} text-xs uppercase`}>Receitas</span>
                        <span className="text-emerald-500 font-semibold text-sm">R$ {values.receitas}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className={`${theme.textSecondary} text-xs uppercase`}>Despesas</span>
                        <span className="text-rose-500 font-semibold text-sm">R$ {values.despesas}</span>
                      </div>
                      <div className={`h-px ${theme.divider} my-1`}></div>
                      <div className="flex justify-between items-center">
                        <span className={`${theme.text} text-xs uppercase font-semibold`}>Lucro</span>
                        <span className={`font-bold text-sm ${values.lucro >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                          R$ {values.lucro}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-6">
          <div className="flex-1 min-w-0">
            <div className={`${theme.card} backdrop-blur-xl rounded-xl border shadow-xl overflow-hidden`}>
              <div className={`p-4 border-b ${theme.divider}`}>
                <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                  <h2 className={`text-lg font-bold ${theme.text}`}>Transações Recentes</h2>
                  <div className="flex gap-2 w-full sm:w-auto">
                    <div className="relative flex-1 sm:flex-initial">
                      <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 ${theme.textSecondary}`} />
                      <input
                        type="text"
                        placeholder="Buscar..."
                        value={searchTerm}
                        onChange={(e) => handleSearch(e.target.value)}
                        className={`w-full sm:w-48 pl-9 pr-3 py-2 ${theme.input} rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent`}
                      />
                    </div>
                    <button
                      onClick={() => setShowFilterModal(true)}
                      className={`px-3 py-2 ${theme.button} ${theme.text} rounded-lg border transition-all duration-200 flex items-center gap-2 text-sm font-medium hover:scale-105 active:scale-95`}
                    >
                      <Filter className="w-4 h-4" />
                      Filtros
                    </button>
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
                {Object.entries(
                  filteredTransactions.reduce((groups, transaction) => {
                    const date = transaction.date;
                    if (!groups[date]) groups[date] = [];
                    groups[date].push(transaction);
                    return groups;
                  }, {})
                ).map(([date, transactions]) => {
                  const dayReceitas = transactions.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0);
                  const dayDespesas = transactions.filter(t => t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0);
                  const dayLucro = dayReceitas - dayDespesas;

                  return (
                    <div key={date} className="mb-4 last:mb-0">
                      <div 
                        className={`${theme.dateHeader} backdrop-blur-sm px-4 py-3 flex items-center justify-between border-b ${theme.divider} cursor-pointer ${theme.cardHover} transition-colors`}
                        onClick={() => toggleDateCollapse(date)}
                      >
                        <div className="flex items-center gap-3">
                          <ChevronDown 
                            className={`w-4 h-4 text-violet-400 transition-transform duration-200 ${collapsedDates[date] ? '-rotate-90' : ''}`} 
                          />
                          <Calendar className="w-4 h-4 text-violet-400" />
                          <span className={`${theme.text} font-bold text-sm`}>{date}</span>
                          <span className={`${theme.textSecondary} text-xs`}>
                            ({transactions.length} {transactions.length === 1 ? 'transação' : 'transações'})
                          </span>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="flex items-center gap-2">
                            <span className={`${theme.textSecondary} text-xs uppercase`}>Receitas:</span>
                            <span className="text-emerald-500 font-bold text-sm">R$ {dayReceitas.toFixed(2)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`${theme.textSecondary} text-xs uppercase`}>Despesas:</span>
                            <span className="text-rose-500 font-bold text-sm">R$ {dayDespesas.toFixed(2)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`${theme.textSecondary} text-xs uppercase`}>Lucro:</span>
                            <span className={`font-bold text-sm ${dayLucro >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                              R$ {dayLucro.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      {!collapsedDates[date] && (
                        <table className="w-full">
                          <thead>
                            <tr className={`border-b ${theme.divider} ${theme.tableHeader}`}>
                              <th className={`text-left p-3 ${theme.textSecondary} font-semibold text-[10px] uppercase tracking-wider w-12`}></th>
                              <th className={`text-left p-3 ${theme.textSecondary} font-semibold text-[10px] uppercase tracking-wider`}>Hora</th>
                              <th className={`text-left p-3 ${theme.textSecondary} font-semibold text-[10px] uppercase tracking-wider`}>Descrição</th>
                              <th className={`text-right p-3 ${theme.textSecondary} font-semibold text-[10px] uppercase tracking-wider`}>Valor</th>
                              <th className={`text-right p-3 ${theme.textSecondary} font-semibold text-[10px] uppercase tracking-wider`}>Saldo Caixa</th>
                            </tr>
                          </thead>
                          <tbody className={`divide-y ${theme.divider}`}>
                            {transactions.map((transaction, index) => (
                              <tr 
                                key={transaction.id} 
                                onClick={() => handleTransactionClick(transaction)}
                                className={`${theme.rowHover} transition-all duration-200 group cursor-pointer`}
                                style={{ animationDelay: `${index * 30}ms` }}
                              >
                                <td className="p-3">
                                  <div className="flex items-center justify-center">
                                    <span className="text-2xl" title={transaction.method}>{getMethodIcon(transaction.method)}</span>
                                  </div>
                                </td>
                                <td className="p-3">
                                  <span className={`${theme.text} font-medium text-sm`}>{transaction.time}</span>
                                </td>
                                <td className="p-3">
                                  <span className={`${theme.text} text-sm`}>{transaction.description}</span>
                                </td>
                                <td className="p-3 text-right">
                                  <span className={`text-base font-bold ${transaction.amount >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                    {transaction.amount >= 0 ? '+' : ''}R$ {Math.abs(transaction.amount).toFixed(2)}
                                  </span>
                                </td>
                                <td className="p-3 text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    <span className={`${theme.text} font-bold text-sm`}>R$ {transaction.cashBalance.toFixed(2)}</span>
                                    {transaction.changeType === 'up' && (
                                      <TrendingUp className="w-4 h-4 text-emerald-500" />
                                    )}
                                    {transaction.changeType === 'down' && (
                                      <TrendingDown className="w-4 h-4 text-rose-500" />
                                    )}
                                    {transaction.changeType === 'neutral' && (
                                      <Minus className="w-4 h-4 text-slate-400" />
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  );
                })}
              </div>

              {filteredTransactions.length === 0 && (
                <div className="p-12 text-center">
                  <div className={`${theme.textSecondary} text-base mb-1`}>Nenhuma transação encontrada</div>
                  <div className={`${theme.textSecondary} text-sm opacity-70`}>Tente ajustar os filtros de busca</div>
                </div>
              )}

              <div className={`p-3 border-t ${theme.divider} ${theme.tableHeader}`}>
                <div className={`flex justify-between items-center text-xs ${theme.textSecondary}`}>
                  <span>Mostrando {filteredTransactions.length} de {transactionsWithChange.length} transações</span>
                  <div className="flex gap-2">
                    <button className={`px-3 py-1.5 ${theme.button} rounded-lg transition-all duration-200 ${theme.text} text-xs hover:scale-105 active:scale-95`}>Anterior</button>
                    <button className={`px-3 py-1.5 ${theme.button} rounded-lg transition-all duration-200 ${theme.text} text-xs hover:scale-105 active:scale-95`}>Próxima</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`${theme.card} rounded-xl border shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto`}>
            <div className={`p-4 border-b ${theme.divider} flex items-center justify-between sticky top-0 ${theme.card} z-10`}>
              <h3 className={`text-lg font-bold ${theme.text}`}>Adicionar Relatório</h3>
              <button onClick={() => setShowAddModal(false)} className={`${theme.textSecondary} hover:${theme.text} transition-transform duration-200 hover:scale-110 active:scale-90`}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className={`block text-sm font-medium ${theme.text} mb-2`}>Descrição</label>
                <input
                  type="text"
                  placeholder="Ex: Entrada de diária"
                  className={`w-full px-3 py-2 ${theme.input} rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500`}
                />
              </div>
              
              <div>
                <label className={`block text-sm font-medium ${theme.text} mb-2`}>Tipo de Lançamento</label>
                <select className={`w-full px-3 py-2 ${theme.input} rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500`}>
                  <option value="income">Receita</option>
                  <option value="expense">Despesa</option>
                </select>
              </div>

              <div>
                <label className={`block text-sm font-medium ${theme.text} mb-2`}>Tipo de Pagamento</label>
                <select className={`w-full px-3 py-2 ${theme.input} rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500`}>
                  <option value="1">💵 Dinheiro</option>
                  <option value="2">💳 Cartão de Crédito</option>
                  <option value="3">💳 Cartão de Débito</option>
                  <option value="4">💳 PIX</option>
                  <option value="5">💰 Link NUBANK</option>
                  <option value="6">🏦 Transferência Bancária</option>
                  <option value="7">⏳ PENDENTE</option>
                </select>
              </div>

              <div>
                <label className={`block text-sm font-medium ${theme.text} mb-2`}>Valor</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  className={`w-full px-3 py-2 ${theme.input} rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500`}
                />
              </div>

              <div>
                <label className={`block text-sm font-medium ${theme.text} mb-2`}>Quarto (Opcional)</label>
                <input
                  type="text"
                  placeholder="Ex: Quarto 101"
                  className={`w-full px-3 py-2 ${theme.input} rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500`}
                />
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  onClick={() => setShowAddModal(false)}
                  className={`flex-1 px-4 py-2 ${theme.button} ${theme.text} rounded-lg border transition-all duration-200 text-sm font-medium hover:scale-105 active:scale-95`}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleAddRelatorio}
                  className="flex-1 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-all duration-200 text-sm font-medium hover:scale-105 active:scale-95 hover:shadow-lg hover:shadow-violet-500/50"
                >
                  Salvar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showFilterModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`${theme.card} rounded-xl border shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto`}>
            <div className={`p-4 border-b ${theme.divider} flex items-center justify-between sticky top-0 ${theme.card} z-10`}>
              <h3 className={`text-lg font-bold ${theme.text}`}>Filtros</h3>
              <button onClick={() => setShowFilterModal(false)} className={`${theme.textSecondary} hover:${theme.text} transition-transform duration-200 hover:scale-110 active:scale-90`}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className={`block text-sm font-medium ${theme.text} mb-2`}>Período</label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <input
                      type="date"
                      className={`w-full px-3 py-2 ${theme.input} rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500`}
                    />
                    <span className={`text-xs ${theme.textSecondary} mt-1 block`}>Data Inicial</span>
                  </div>
                  <div>
                    <input
                      type="date"
                      className={`w-full px-3 py-2 ${theme.input} rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500`}
                    />
                    <span className={`text-xs ${theme.textSecondary} mt-1 block`}>Data Final</span>
                  </div>
                </div>
              </div>

              <div>
                <label className={`block text-sm font-medium ${theme.text} mb-2`}>Tipo de Lançamento</label>
                <select className={`w-full px-3 py-2 ${theme.input} rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500`}>
                  <option value="all">Todos</option>
                  <option value="income">Receitas</option>
                  <option value="expense">Despesas</option>
                </select>
              </div>

              <div>
                <label className={`block text-sm font-medium ${theme.text} mb-2`}>Tipo de Pagamento</label>
                <select className={`w-full px-3 py-2 ${theme.input} rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500`}>
                  <option value="all">Todos</option>
                  <option value="1">💵 Dinheiro</option>
                  <option value="2">💳 Cartão de Crédito</option>
                  <option value="3">💳 Cartão de Débito</option>
                  <option value="4">💳 PIX</option>
                  <option value="5">💰 Link NUBANK</option>
                  <option value="6">🏦 Transferência Bancária</option>
                  <option value="7">⏳ PENDENTE</option>
                </select>
              </div>

              <div>
                <label className={`block text-sm font-medium ${theme.text} mb-2`}>Quarto</label>
                <input
                  type="text"
                  placeholder="Filtrar por quarto"
                  className={`w-full px-3 py-2 ${theme.input} rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500`}
                />
              </div>

              <div>
                <label className={`block text-sm font-medium ${theme.text} mb-2`}>Funcionário</label>
                <input
                  type="text"
                  placeholder="Filtrar por funcionário"
                  className={`w-full px-3 py-2 ${theme.input} rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500`}
                />
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  onClick={() => setShowFilterModal(false)}
                  className={`flex-1 px-4 py-2 ${theme.button} ${theme.text} rounded-lg border transition-all duration-200 text-sm font-medium hover:scale-105 active:scale-95`}
                >
                  Limpar
                </button>
                <button
                  onClick={handleApplyFilter}
                  className="flex-1 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-all duration-200 text-sm font-medium hover:scale-105 active:scale-95 hover:shadow-lg hover:shadow-violet-500/50"
                >
                  Aplicar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showDetailsModal && selectedTransaction && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`${theme.card} rounded-xl border shadow-2xl max-w-lg w-full`}>
            <div className={`p-4 border-b ${theme.divider} flex items-center justify-between`}>
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${selectedTransaction.type === 'income' ? 'bg-emerald-500/20' : 'bg-rose-500/20'}`}>
                  {selectedTransaction.type === 'income' ? (
                    <TrendingUp className={`w-5 h-5 text-emerald-500`} />
                  ) : (
                    <TrendingDown className={`w-5 h-5 text-rose-500`} />
                  )}
                </div>
                <h3 className={`text-lg font-bold ${theme.text}`}>
                  {selectedTransaction.type === 'income' ? 'Receita' : 'Despesa'}
                </h3>
              </div>
              <button onClick={() => setShowDetailsModal(false)} className={`${theme.textSecondary} hover:${theme.text} transition-transform duration-200 hover:scale-110 active:scale-90`}>
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className={`p-4 rounded-lg ${selectedTransaction.type === 'income' ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-rose-500/10 border border-rose-500/20'}`}>
                <div className="flex items-center justify-between">
                  <span className={`text-sm ${theme.textSecondary}`}>Valor</span>
                  <span className={`text-3xl font-bold ${selectedTransaction.type === 'income' ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {selectedTransaction.amount >= 0 ? '+' : ''}R$ {Math.abs(selectedTransaction.amount).toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`text-xs ${theme.textSecondary} uppercase tracking-wide mb-1 block`}>Data</label>
                  <div className={`${theme.text} font-medium flex items-center gap-2`}>
                    <Calendar className="w-4 h-4 text-violet-500" />
                    {selectedTransaction.date}
                  </div>
                </div>
                <div>
                  <label className={`text-xs ${theme.textSecondary} uppercase tracking-wide mb-1 block`}>Hora</label>
                  <div className={`${theme.text} font-medium`}>
                    {selectedTransaction.time}
                  </div>
                </div>
              </div>

              <div>
                <label className={`text-xs ${theme.textSecondary} uppercase tracking-wide mb-1 block`}>Descrição</label>
                <div className={`${theme.text} font-medium`}>
                  {selectedTransaction.description}
                </div>
              </div>

              <div>
                <label className={`text-xs ${theme.textSecondary} uppercase tracking-wide mb-1 block`}>Forma de Pagamento</label>
                <div className={`flex items-center gap-2 ${theme.text} font-medium`}>
                  <span className="text-xl">{getMethodIcon(selectedTransaction.method)}</span>
                  {selectedTransaction.method}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`text-xs ${theme.textSecondary} uppercase tracking-wide mb-1 block`}>Quarto</label>
                  <div className={`${theme.text} font-medium`}>
                    {selectedTransaction.room || '—'}
                  </div>
                </div>
                <div>
                  <label className={`text-xs ${theme.textSecondary} uppercase tracking-wide mb-1 block`}>Funcionário</label>
                  <div className={`${theme.text} font-medium`}>
                    admin
                  </div>
                </div>
              </div>

              {selectedTransaction.method === 'Dinheiro' && (
                <div className={`p-3 rounded-lg ${theme.card} border`}>
                  <label className={`text-xs ${theme.textSecondary} uppercase tracking-wide mb-1 block`}>Saldo do Caixa</label>
                  <div className="flex items-center justify-between">
                    <div className={`${theme.text} font-bold text-lg`}>
                      R$ {selectedTransaction.cashBalance.toFixed(2)}
                    </div>
                    <div className="flex items-center gap-2">
                      {selectedTransaction.changeType === 'up' && (
                        <>
                          <TrendingUp className="w-4 h-4 text-emerald-500" />
                          <span className="text-sm text-emerald-500 font-medium">
                            +R$ {selectedTransaction.change.toFixed(2)}
                          </span>
                        </>
                      )}
                      {selectedTransaction.changeType === 'down' && (
                        <>
                          <TrendingDown className="w-4 h-4 text-rose-500" />
                          <span className="text-sm text-rose-500 font-medium">
                            R$ {selectedTransaction.change.toFixed(2)}
                          </span>
                        </>
                      )}
                      {selectedTransaction.changeType === 'neutral' && (
                        <>
                          <Minus className="w-4 h-4 text-slate-400" />
                          <span className="text-sm text-slate-400 font-medium">
                            Sem alteração
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className={`p-4 border-t ${theme.divider} flex gap-2`}>
              <button
                onClick={() => setShowDetailsModal(false)}
                className={`flex-1 px-4 py-2 ${theme.button} ${theme.text} rounded-lg border transition-all duration-200 text-sm font-medium hover:scale-105 active:scale-95`}
              >
                Fechar
              </button>
              <button
                onClick={handleEditTransaction}
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

        @keyframes numberSpin {
          0% {
            opacity: 1;
            transform: rotateX(0deg);
          }
          50% {
            opacity: 0.3;
            transform: rotateX(90deg);
          }
          100% {
            opacity: 1;
            transform: rotateX(0deg);
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

        .animate-numberSpin {
          animation: numberSpin 0.6s ease-in-out;
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
