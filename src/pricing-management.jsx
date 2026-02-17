import React, { useState } from 'react';
import {
  BedDouble,
  Calendar,
  DollarSign,
  Sun,
  Moon,
  Plus,
  Edit,
  Shield,
  ChevronDown,
  Users,
  Clock,
  Tag,
  X,
  Info,
  Check,
  Trash2,
} from 'lucide-react';

function formatRoomNumber(num) {
  return num < 10 ? `0${num}` : `${num}`;
}

export default function PricingManagement() {
  const [isDark, setIsDark] = useState(true);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [showSeasonalModal, setShowSeasonalModal] = useState(false);
  const [showSeasonalFormModal, setShowSeasonalFormModal] = useState(false);
  const [editingSeasonal, setEditingSeasonal] = useState(null);
  const [selectedCategoryForSeasonal, setSelectedCategoryForSeasonal] = useState(null);
  const [notification, setNotification] = useState(null);
  const [collapsedCategories, setCollapsedCategories] = useState({});

  // Form states
  const [formNome, setFormNome] = useState('');
  const [formDescricao, setFormDescricao] = useState('');
  const [formMaxPessoas, setFormMaxPessoas] = useState(5);
  const [formVinculoQuartos, setFormVinculoQuartos] = useState([]);
  const [formModeloCobranca, setFormModeloCobranca] = useState('Por ocupação');
  const [formPrecoFixo, setFormPrecoFixo] = useState(0);
  const [formPrecosOcupacao, setFormPrecosOcupacao] = useState({});
  const [formDayUseAtivo, setFormDayUseAtivo] = useState(false);
  const [formDayUsePrecoFixo, setFormDayUsePrecoFixo] = useState(0);
  const [formDayUsePrecoAdicional, setFormDayUsePrecoAdicional] = useState(0);
  const [formSazonaisAtivas, setFormSazonaisAtivas] = useState([]);

  // Seasonal form
  const [seasonalNome, setSeasonalNome] = useState('');
  const [seasonalDescricao, setSeasonalDescricao] = useState('');
  const [seasonalDataInicio, setSeasonalDataInicio] = useState('');
  const [seasonalDataFim, setSeasonalDataFim] = useState('');
  const [seasonalHoraInicio, setSeasonalHoraInicio] = useState('');
  const [seasonalHoraFim, setSeasonalHoraFim] = useState('');
  const [seasonalModeloCobranca, setSeasonalModeloCobranca] = useState('Por ocupação');
  const [seasonalPrecoFixo, setSeasonalPrecoFixo] = useState(0);
  const [seasonalPrecosOcupacao, setSeasonalPrecosOcupacao] = useState({});
  const [seasonalMaxPessoas, setSeasonalMaxPessoas] = useState(5);

  const [permissions, setPermissions] = useState({
    acessoTotal: true,
    dashboard: true,
    adicionarCategoria: true,
    editarCategoria: true,
    cadastrarSazonalidade: true,
    alterarSazonalidade: true,
  });

  const baseRooms = [
    { numero: 1, categoriaVisual: 'Standard' },
    { numero: 2, categoriaVisual: 'Standard' },
    { numero: 3, categoriaVisual: 'Standard' },
    { numero: 4, categoriaVisual: 'Standard' },
    { numero: 5, categoriaVisual: 'Standard' },
    { numero: 6, categoriaVisual: 'Luxo' },
    { numero: 7, categoriaVisual: 'Luxo' },
    { numero: 8, categoriaVisual: 'Luxo' },
    { numero: 9, categoriaVisual: 'Suíte' },
    { numero: 10, categoriaVisual: 'Suíte' },
  ];

  const [categories, setCategories] = useState([
    {
      id: 1,
      nome: 'Standard Até 5 Pessoas',
      descricao: 'Categoria base para quartos standard, cobrando por ocupação até 5 pessoas.',
      maxPessoas: 5,
      modeloCobranca: 'Por ocupação',
      vinculoQuartos: [1, 2, 3, 4],
      precoFixo: null,
      precosOcupacao: { 1: 120, 2: 160, 3: 190, 4: 210, 5: 230 },
      dayUse: {
        ativo: true,
        precoFixo: 90,
        precoAdicional: 15,
      },
      sazonaisAtivas: ['alta-verao'],
    },
    {
      id: 2,
      nome: 'Luxo Até 5 Pessoas',
      descricao: 'Categoria luxo com foco em casais e famílias pequenas.',
      maxPessoas: 5,
      modeloCobranca: 'Por ocupação',
      vinculoQuartos: [6, 7, 8],
      precoFixo: null,
      precosOcupacao: { 1: 220, 2: 280, 3: 320, 4: 360, 5: 400 },
      dayUse: {
        ativo: true,
        precoFixo: 150,
        precoAdicional: 25,
      },
      sazonaisAtivas: ['reveillon'],
    },
    {
      id: 3,
      nome: 'Suíte Família',
      descricao: 'Suítes amplas, tarifa fixa por quarto.',
      maxPessoas: 5,
      modeloCobranca: 'Por quarto (tarifa fixa)',
      vinculoQuartos: [9, 10],
      precoFixo: 450,
      precosOcupacao: null,
      dayUse: { ativo: false, precoFixo: 0, precoAdicional: 0 },
      sazonaisAtivas: [],
    },
  ]);

  const [seasonalDefinitions, setSeasonalDefinitions] = useState([
    {
      id: 'alta-verao',
      nome: 'Alta Temporada Verão',
      descricao: 'Período de alta demanda no verão',
      dataInicio: '2026-12-01',
      dataFim: '2027-02-28',
      horaInicio: '14:00',
      horaFim: '12:00',
      modeloCobranca: 'Por ocupação',
      maxPessoas: 5,
      precoFixo: null,
      precosOcupacao: { 1: 150, 2: 200, 3: 240, 4: 270, 5: 300 },
    },
    {
      id: 'reveillon',
      nome: 'Revéillon',
      descricao: 'Virada de ano com tarifas especiais',
      dataInicio: '2026-12-28',
      dataFim: '2027-01-02',
      horaInicio: '15:00',
      horaFim: '11:00',
      modeloCobranca: 'Por ocupação',
      maxPessoas: 5,
      precoFixo: null,
      precosOcupacao: { 1: 300, 2: 380, 3: 440, 4: 500, 5: 560 },
    },
  ]);

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
    button: isDark
      ? 'bg-white/10 hover:bg-white/20 border-white/10'
      : 'bg-slate-100 hover:bg-slate-200 border-slate-300',
  };

  const showNotification = (message, type = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const togglePermission = (key) => {
    setPermissions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleCategoryCollapse = (categoryId) => {
    setCollapsedCategories((prev) => ({ ...prev, [categoryId]: !prev[categoryId] }));
  };

  const resetCategoryForm = () => {
    setFormNome('');
    setFormDescricao('');
    setFormMaxPessoas(5);
    setFormVinculoQuartos([]);
    setFormModeloCobranca('Por ocupação');
    setFormPrecoFixo(0);
    setFormPrecosOcupacao({});
    setFormDayUseAtivo(false);
    setFormDayUsePrecoFixo(0);
    setFormDayUsePrecoAdicional(0);
    setFormSazonaisAtivas([]);
  };

  const handleOpenNewCategory = () => {
    if (!permissions.adicionarCategoria && !permissions.acessoTotal) {
      showNotification('Você não tem permissão para adicionar categoria.', 'error');
      return;
    }
    resetCategoryForm();
    setEditingCategory(null);
    setShowCategoryModal(true);
  };

  const handleEditCategory = (cat) => {
    if (!permissions.editarCategoria && !permissions.acessoTotal) {
      showNotification('Você não tem permissão para editar categoria.', 'error');
      return;
    }
    setEditingCategory(cat);
    setFormNome(cat.nome);
    setFormDescricao(cat.descricao);
    setFormMaxPessoas(cat.maxPessoas);
    setFormVinculoQuartos(cat.vinculoQuartos);
    setFormModeloCobranca(cat.modeloCobranca);
    setFormPrecoFixo(cat.precoFixo || 0);
    setFormPrecosOcupacao(cat.precosOcupacao || {});
    setFormDayUseAtivo(cat.dayUse.ativo);
    setFormDayUsePrecoFixo(cat.dayUse.precoFixo);
    setFormDayUsePrecoAdicional(cat.dayUse.precoAdicional);
    setFormSazonaisAtivas(cat.sazonaisAtivas || []);
    setShowCategoryModal(true);
  };

  const handleSaveCategory = () => {
    if (editingCategory) {
      setCategories((prev) =>
        prev.map((c) =>
          c.id === editingCategory.id
            ? {
                ...c,
                nome: formNome,
                descricao: formDescricao,
                maxPessoas: formMaxPessoas,
                vinculoQuartos: formVinculoQuartos,
                modeloCobranca: formModeloCobranca,
                precoFixo: formModeloCobranca === 'Por quarto (tarifa fixa)' ? formPrecoFixo : null,
                precosOcupacao: formModeloCobranca === 'Por ocupação' ? formPrecosOcupacao : null,
                dayUse: {
                  ativo: formDayUseAtivo,
                  precoFixo: formDayUsePrecoFixo,
                  precoAdicional: formDayUsePrecoAdicional,
                },
                sazonaisAtivas: formSazonaisAtivas,
              }
            : c
        )
      );
      showNotification('Categoria atualizada com sucesso.', 'success');
    } else {
      const newCat = {
        id: Date.now(),
        nome: formNome,
        descricao: formDescricao,
        maxPessoas: formMaxPessoas,
        vinculoQuartos: formVinculoQuartos,
        modeloCobranca: formModeloCobranca,
        precoFixo: formModeloCobranca === 'Por quarto (tarifa fixa)' ? formPrecoFixo : null,
        precosOcupacao: formModeloCobranca === 'Por ocupação' ? formPrecosOcupacao : null,
        dayUse: {
          ativo: formDayUseAtivo,
          precoFixo: formDayUsePrecoFixo,
          precoAdicional: formDayUsePrecoAdicional,
        },
        sazonaisAtivas: formSazonaisAtivas,
      };
      setCategories((prev) => [...prev, newCat]);
      showNotification('Categoria criada com sucesso.', 'success');
    }
    setShowCategoryModal(false);
  };

  const toggleQuartoVinculo = (num) => {
    setFormVinculoQuartos((prev) =>
      prev.includes(num) ? prev.filter((n) => n !== num) : [...prev, num]
    );
  };

  const handleModeloCobrancaChange = (modelo) => {
    setFormModeloCobranca(modelo);
    if (modelo === 'Por quarto (tarifa fixa)') {
      setFormPrecosOcupacao({});
    } else {
      setFormPrecoFixo(0);
    }
  };

  const handleMaxPessoasChange = (max) => {
    setFormMaxPessoas(max);
    if (formModeloCobranca === 'Por ocupação') {
      const novos = {};
      for (let i = 1; i <= max; i++) {
        novos[i] = formPrecosOcupacao[i] || 0;
      }
      setFormPrecosOcupacao(novos);
    }
  };

  const handlePrecoOcupacaoChange = (qtd, valor) => {
    setFormPrecosOcupacao((prev) => ({ ...prev, [qtd]: parseFloat(valor) || 0 }));
  };

  const handleOpenSeasonalManager = (cat) => {
    setSelectedCategoryForSeasonal(cat);
    setShowSeasonalModal(true);
  };

  const resetSeasonalForm = () => {
    setSeasonalNome('');
    setSeasonalDescricao('');
    setSeasonalDataInicio('');
    setSeasonalDataFim('');
    setSeasonalHoraInicio('');
    setSeasonalHoraFim('');
    setSeasonalModeloCobranca('Por ocupação');
    setSeasonalPrecoFixo(0);
    setSeasonalPrecosOcupacao({});
    setSeasonalMaxPessoas(5);
  };

  const handleOpenNewSeasonal = () => {
    if (!permissions.cadastrarSazonalidade && !permissions.acessoTotal) {
      showNotification('Você não tem permissão para cadastrar sazonalidade.', 'error');
      return;
    }
    resetSeasonalForm();
    setEditingSeasonal(null);
    setShowSeasonalFormModal(true);
  };

  const handleEditSeasonal = (s) => {
    if (!permissions.alterarSazonalidade && !permissions.acessoTotal) {
      showNotification('Você não tem permissão para alterar sazonalidade.', 'error');
      return;
    }
    setEditingSeasonal(s);
    setSeasonalNome(s.nome);
    setSeasonalDescricao(s.descricao);
    setSeasonalDataInicio(s.dataInicio);
    setSeasonalDataFim(s.dataFim);
    setSeasonalHoraInicio(s.horaInicio);
    setSeasonalHoraFim(s.horaFim);
    setSeasonalModeloCobranca(s.modeloCobranca);
    setSeasonalPrecoFixo(s.precoFixo || 0);
    setSeasonalPrecosOcupacao(s.precosOcupacao || {});
    setSeasonalMaxPessoas(s.maxPessoas);
    setShowSeasonalFormModal(true);
  };

  const handleSaveSeasonal = () => {
    if (editingSeasonal) {
      setSeasonalDefinitions((prev) =>
        prev.map((s) =>
          s.id === editingSeasonal.id
            ? {
                ...s,
                nome: seasonalNome,
                descricao: seasonalDescricao,
                dataInicio: seasonalDataInicio,
                dataFim: seasonalDataFim,
                horaInicio: seasonalHoraInicio,
                horaFim: seasonalHoraFim,
                modeloCobranca: seasonalModeloCobranca,
                precoFixo: seasonalModeloCobranca === 'Por quarto (tarifa fixa)' ? seasonalPrecoFixo : null,
                precosOcupacao: seasonalModeloCobranca === 'Por ocupação' ? seasonalPrecosOcupacao : null,
                maxPessoas: seasonalMaxPessoas,
              }
            : s
        )
      );
      showNotification('Sazonalidade atualizada.', 'success');
    } else {
      const newSeasonal = {
        id: `seasonal-${Date.now()}`,
        nome: seasonalNome,
        descricao: seasonalDescricao,
        dataInicio: seasonalDataInicio,
        dataFim: seasonalDataFim,
        horaInicio: seasonalHoraInicio,
        horaFim: seasonalHoraFim,
        modeloCobranca: seasonalModeloCobranca,
        precoFixo: seasonalModeloCobranca === 'Por quarto (tarifa fixa)' ? seasonalPrecoFixo : null,
        precosOcupacao: seasonalModeloCobranca === 'Por ocupação' ? seasonalPrecosOcupacao : null,
        maxPessoas: seasonalMaxPessoas,
      };
      setSeasonalDefinitions((prev) => [...prev, newSeasonal]);
      showNotification('Sazonalidade criada.', 'success');
    }
    setShowSeasonalFormModal(false);
  };

  const handleDeleteSeasonal = (id) => {
    setSeasonalDefinitions((prev) => prev.filter((s) => s.id !== id));
    showNotification('Sazonalidade removida.', 'success');
  };

  const handleSeasonalModeloCobrancaChange = (modelo) => {
    setSeasonalModeloCobranca(modelo);
    if (modelo === 'Por quarto (tarifa fixa)') {
      setSeasonalPrecosOcupacao({});
    } else {
      setSeasonalPrecoFixo(0);
    }
  };

  const handleSeasonalMaxPessoasChange = (max) => {
    setSeasonalMaxPessoas(max);
    if (seasonalModeloCobranca === 'Por ocupação') {
      const novos = {};
      for (let i = 1; i <= max; i++) {
        novos[i] = seasonalPrecosOcupacao[i] || 0;
      }
      setSeasonalPrecosOcupacao(novos);
    }
  };

  const handleSeasonalPrecoOcupacaoChange = (qtd, valor) => {
    setSeasonalPrecosOcupacao((prev) => ({ ...prev, [qtd]: parseFloat(valor) || 0 }));
  };

  const toggleSeasonalAtiva = (seasonalId) => {
    setFormSazonaisAtivas((prev) =>
      prev.includes(seasonalId) ? prev.filter((id) => id !== seasonalId) : [...prev, seasonalId]
    );
  };

  const getMaxPreco = (cat) => {
    if (cat.modeloCobranca === 'Por quarto (tarifa fixa)') return cat.precoFixo;
    const values = Object.values(cat.precosOcupacao || {});
    return values.length ? Math.max(...values) : 0;
  };

  const getMinPreco = (cat) => {
    if (cat.modeloCobranca === 'Por quarto (tarifa fixa)') return cat.precoFixo;
    const values = Object.values(cat.precosOcupacao || {});
    return values.length ? Math.min(...values) : 0;
  };

  const getQuartosVinculados = (cat) =>
    baseRooms.filter((r) => cat.vinculoQuartos.includes(r.numero));

  const baseStats = {
    totalCategorias: categories.length,
    categoriasDayUse: categories.filter((c) => c.dayUse.ativo).length,
    categoriasSazonais: categories.filter((c) => c.sazonaisAtivas.length > 0).length,
    totalSazonalidades: seasonalDefinitions.length,
  };

  return (
    <div className={`min-h-screen ${theme.bg}`}>
      <div className={`absolute inset-0 ${theme.bgOverlay}`} />

      <div className="relative max-w-[1600px] mx-auto p-4 sm:p-8">
        {/* Header */}
        <header className="mb-6 pt-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className={`text-3xl font-bold ${theme.text} mb-1 tracking-tight`}>
                Tabela de Preços
              </h1>
              <p className={`${theme.textSecondary} text-sm flex items-center gap-2`}>
                <DollarSign className="w-3.5 h-3.5" />
                Gestão de tarifas por categoria, ocupação, day use e sazonalidade
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

        {/* Dashboard */}
        {permissions.dashboard && (
          <div className={`${theme.card} backdrop-blur-xl rounded-xl p-4 mb-6 border shadow-xl`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-violet-500" />
                <h2 className={`text-sm font-bold ${theme.text} uppercase tracking-wider`}>
                  Visão geral de preços
                </h2>
              </div>
              <div className="flex gap-2">
                {permissions.adicionarCategoria && (
                  <button
                    onClick={handleOpenNewCategory}
                    className="px-3 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-all duration-200 flex items-center gap-2 text-sm font-medium hover:scale-105 active:scale-95 hover:shadow-lg hover:shadow-violet-500/50"
                  >
                    <Plus className="w-4 h-4" />
                    Adicionar categoria
                  </button>
                )}
                {permissions.cadastrarSazonalidade && (
                  <button
                    onClick={handleOpenNewSeasonal}
                    className="px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-all duration-200 flex items-center gap-2 text-sm font-medium hover:scale-105 active:scale-95 hover:shadow-lg hover:shadow-amber-500/50"
                  >
                    <Calendar className="w-4 h-4" />
                    Nova sazonalidade
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-gradient-to-br from-violet-500 to-purple-600 rounded-lg p-4 border border-violet-400/30 shadow-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-white/80 uppercase">Categorias</span>
                  <Tag className="w-4 h-4 text-white/80" />
                </div>
                <p className="text-3xl font-bold text-white">{baseStats.totalCategorias}</p>
                <p className="text-xs text-white/80 mt-1">Tipos de tabela ativos</p>
              </div>

              <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg p-4 border border-emerald-400/30 shadow-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-white/80 uppercase">Day Use</span>
                  <Clock className="w-4 h-4 text-white/80" />
                </div>
                <p className="text-3xl font-bold text-white">{baseStats.categoriasDayUse}</p>
                <p className="text-xs text-white/80 mt-1">Com tarifa de uso diurno</p>
              </div>

              <div className="bg-gradient-to-br from-amber-500 to-orange-500 rounded-lg p-4 border border-amber-400/30 shadow-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-white/80 uppercase">Sazonalidades</span>
                  <Calendar className="w-4 h-4 text-white/80" />
                </div>
                <p className="text-3xl font-bold text-white">{baseStats.totalSazonalidades}</p>
                <p className="text-xs text-white/80 mt-1">Períodos cadastrados</p>
              </div>

              <div className="bg-gradient-to-br from-sky-500 to-blue-600 rounded-lg p-4 border border-sky-400/30 shadow-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-white/80 uppercase">Com sazonais ativas</span>
                  <Users className="w-4 h-4 text-white/80" />
                </div>
                <p className="text-3xl font-bold text-white">{baseStats.categoriasSazonais}</p>
                <p className="text-xs text-white/80 mt-1">Categorias configuradas</p>
              </div>
            </div>
          </div>
        )}

        {/* Lista de categorias */}
        <div className={`${theme.card} rounded-xl border shadow-xl overflow-hidden mb-6`}>
          <div className="px-4 py-3 border-b flex items-center justify-between gap-3">
            <div>
              <h2 className={`text-lg font-bold ${theme.text}`}>Categorias de Preço</h2>
              <p className={`${theme.textSecondary} text-xs`}>
                Cada categoria define valores, day use e sazonais.
              </p>
            </div>
          </div>

          <div className="divide-y divide-slate-700/40">
            {categories.map((cat) => {
              const quartosVinc = getQuartosVinculados(cat);
              const minPreco = getMinPreco(cat);
              const maxPreco = getMaxPreco(cat);
              const isCollapsed = collapsedCategories[cat.id];

              return (
                <div key={cat.id}>
                  <div
                    className={`px-4 py-3 flex items-center justify-between cursor-pointer ${theme.cardHover}`}
                    onClick={() => toggleCategoryCollapse(cat.id)}
                  >
                    <div className="flex items-center gap-3">
                      <ChevronDown
                        className={`w-4 h-4 text-violet-400 transition-transform duration-200 ${
                          isCollapsed ? '-rotate-90' : ''
                        }`}
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`${theme.text} font-semibold text-sm`}>{cat.nome}</span>
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-300 border border-violet-500/30">
                            {cat.modeloCobranca}
                          </span>
                          {cat.dayUse.ativo && (
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                              Day use
                            </span>
                          )}
                          {cat.sazonaisAtivas.length > 0 && (
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                              {cat.sazonaisAtivas.length} sazonal(is)
                            </span>
                          )}
                        </div>
                        <p className={`${theme.textSecondary} text-xs mt-1`}>{cat.descricao}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="hidden sm:flex flex-col text-right text-xs">
                        {cat.modeloCobranca === 'Por quarto (tarifa fixa)' ? (
                          <span className={theme.textSecondary}>
                            Tarifa fixa: R$ {cat.precoFixo?.toFixed(2)}
                          </span>
                        ) : (
                          <span className={theme.textSecondary}>
                            R$ {minPreco.toFixed(2)} - R$ {maxPreco.toFixed(2)}
                          </span>
                        )}
                      </div>
                      {permissions.editarCategoria && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditCategory(cat);
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
                      {/* Hospedagem */}
                      <div className={`${theme.card} rounded-lg border p-3`}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Users className="w-4 h-4 text-violet-400" />
                            <span className={`${theme.text} text-xs font-semibold uppercase`}>
                              Hospedagem
                            </span>
                          </div>
                        </div>
                        {cat.modeloCobranca === 'Por quarto (tarifa fixa)' ? (
                          <div className="text-xs">
                            <p className={`${theme.text} font-semibold text-lg`}>
                              R$ {cat.precoFixo?.toFixed(2)}
                            </p>
                            <p className={`${theme.textSecondary} text-[11px] mt-1`}>
                              Tarifa fixa por quarto, independente da ocupação.
                            </p>
                          </div>
                        ) : (
                          <div className="border border-white/10 rounded-lg overflow-hidden text-xs">
                            <div className="flex bg-white/5">
                              <div className="w-1/2 px-2 py-1 border-r border-white/10">
                                <span className={`${theme.textSecondary} uppercase text-[10px]`}>
                                  Pessoas
                                </span>
                              </div>
                              <div className="w-1/2 px-2 py-1">
                                <span className={`${theme.textSecondary} uppercase text-[10px]`}>
                                  Preço/noite
                                </span>
                              </div>
                            </div>
                            {Array.from({ length: cat.maxPessoas }).map((_, idx) => {
                              const q = idx + 1;
                              const valor = cat.precosOcupacao?.[q];
                              return (
                                <div
                                  key={q}
                                  className="flex border-t border-white/5 hover:bg-violet-500/5"
                                >
                                  <div className="w-1/2 px-2 py-1 border-r border-white/10">
                                    <span className={`${theme.text} text-xs`}>{q} pax</span>
                                  </div>
                                  <div className="w-1/2 px-2 py-1">
                                    <span className={`${theme.text} text-xs font-semibold`}>
                                      R$ {valor?.toFixed(2) || '0.00'}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Day Use */}
                      <div className={`${theme.card} rounded-lg border p-3`}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-emerald-400" />
                            <span className={`${theme.text} text-xs font-semibold uppercase`}>
                              Day Use
                            </span>
                          </div>
                          <span
                            className={`text-[11px] px-2 py-0.5 rounded-full ${
                              cat.dayUse.ativo
                                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                                : 'bg-slate-500/15 text-slate-300 border border-slate-500/30'
                            }`}
                          >
                            {cat.dayUse.ativo ? 'Ativo' : 'Inativo'}
                          </span>
                        </div>
                        {cat.dayUse.ativo ? (
                          <div className="space-y-2 text-xs">
                            <div className="flex items-center justify-between">
                              <span className={theme.textSecondary}>Preço fixo (base)</span>
                              <span className={`${theme.text} font-semibold`}>
                                R$ {cat.dayUse.precoFixo.toFixed(2)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className={theme.textSecondary}>Hora adicional</span>
                              <span className={`${theme.text} font-semibold`}>
                                R$ {cat.dayUse.precoAdicional.toFixed(2)}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <p className={`${theme.textSecondary} text-xs`}>Não ativo.</p>
                        )}
                      </div>

                      {/* Sazonais + Quartos */}
                      <div className="space-y-3">
                        <div className={`${theme.card} rounded-lg border p-3`}>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-amber-400" />
                              <span className={`${theme.text} text-xs font-semibold uppercase`}>
                                Sazonais ativas
                              </span>
                            </div>
                          </div>
                          {cat.sazonaisAtivas.length === 0 ? (
                            <p className={`${theme.textSecondary} text-xs`}>
                              Nenhuma sazonal ativa.
                            </p>
                          ) : (
                            <div className="space-y-1 text-xs">
                              {cat.sazonaisAtivas.map((sid) => {
                                const s = seasonalDefinitions.find((def) => def.id === sid);
                                if (!s) return null;
                                return (
                                  <div
                                    key={sid}
                                    className="flex items-start justify-between border border-white/10 rounded-lg px-2 py-1.5"
                                  >
                                    <div>
                                      <div className={`${theme.text} font-semibold text-xs`}>
                                        {s.nome}
                                      </div>
                                      <div className={`${theme.textSecondary} text-[11px]`}>
                                        {s.dataInicio} → {s.dataFim}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        <div className={`${theme.card} rounded-lg border p-3`}>
                          <div className="flex items-center gap-2 mb-2">
                            <BedDouble className="w-4 h-4 text-sky-400" />
                            <span className={`${theme.text} text-xs font-semibold uppercase`}>
                              Quartos
                            </span>
                          </div>
                          {quartosVinc.length === 0 ? (
                            <p className={`${theme.textSecondary} text-xs`}>Nenhum vinculado.</p>
                          ) : (
                            <div className="flex flex-wrap gap-2 text-xs">
                              {quartosVinc.map((r) => (
                                <span
                                  key={r.numero}
                                  className="px-2 py-1 rounded-full bg-sky-500/15 text-sky-300 border border-sky-500/30"
                                >
                                  {formatRoomNumber(r.numero)}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Lista de sazonalidades cadastradas */}
        <div className={`${theme.card} rounded-xl border shadow-xl overflow-hidden`}>
          <div className="px-4 py-3 border-b flex items-center justify-between gap-3">
            <div>
              <h2 className={`text-lg font-bold ${theme.text}`}>Sazonalidades Cadastradas</h2>
              <p className={`${theme.textSecondary} text-xs`}>
                Períodos especiais com tarifas diferenciadas.
              </p>
            </div>
          </div>

          <div className="divide-y divide-slate-700/40">
            {seasonalDefinitions.length === 0 ? (
              <div className="p-8 text-center">
                <p className={`${theme.textSecondary} text-sm`}>
                  Nenhuma sazonalidade cadastrada ainda.
                </p>
              </div>
            ) : (
              seasonalDefinitions.map((s) => (
                <div key={s.id} className="px-4 py-3 flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`${theme.text} font-semibold text-sm`}>{s.nome}</span>
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                        {s.modeloCobranca}
                      </span>
                    </div>
                    <p className={`${theme.textSecondary} text-xs mt-1`}>{s.descricao}</p>
                    <p className={`${theme.textSecondary} text-[11px] mt-1`}>
                      {s.dataInicio} {s.horaInicio} → {s.dataFim} {s.horaFim}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {permissions.alterarSazonalidade && (
                      <button
                        onClick={() => handleEditSeasonal(s)}
                        className={`px-3 py-1.5 text-xs rounded-lg border ${theme.button} ${theme.text} flex items-center gap-1 hover:scale-105 active:scale-95`}
                      >
                        <Edit className="w-3.5 h-3.5" />
                        Editar
                      </button>
                    )}
                    {permissions.alterarSazonalidade && (
                      <button
                        onClick={() => handleDeleteSeasonal(s.id)}
                        className="px-3 py-1.5 text-xs rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-300 flex items-center gap-1 hover:scale-105 active:scale-95"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Excluir
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Modal Categoria */}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className={`${theme.card} rounded-xl border shadow-2xl max-w-4xl w-full my-8`}>
            <div className={`p-4 border-b ${theme.divider} flex items-center justify-between`}>
              <h3 className={`text-lg font-bold ${theme.text}`}>
                {editingCategory ? 'Editar categoria' : 'Nova categoria'}
              </h3>
              <button
                onClick={() => setShowCategoryModal(false)}
                className={`${theme.textSecondary} hover:${theme.text} transition-transform duration-200 hover:scale-110 active:scale-90`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4 text-sm max-h-[70vh] overflow-y-auto">
              {/* Nome + Descrição */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className={`block mb-1 ${theme.textSecondary}`}>Nome da categoria</label>
                  <input
                    type="text"
                    value={formNome}
                    onChange={(e) => setFormNome(e.target.value)}
                    className={`w-full px-3 py-2 ${theme.input} rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 border-2`}
                    placeholder="Ex: Standard até 5 pessoas"
                  />
                </div>
                <div>
                  <label className={`block mb-1 ${theme.textSecondary}`}>Máximo de pessoas</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={formMaxPessoas}
                    onChange={(e) => handleMaxPessoasChange(parseInt(e.target.value, 10))}
                    className={`w-full px-3 py-2 ${theme.input} rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 border-2`}
                  />
                </div>
              </div>

              <div>
                <label className={`block mb-1 ${theme.textSecondary}`}>Descrição</label>
                <textarea
                  rows={2}
                  value={formDescricao}
                  onChange={(e) => setFormDescricao(e.target.value)}
                  className={`w-full px-3 py-2 ${theme.input} rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 border-2`}
                  placeholder="Breve descrição desta categoria..."
                />
              </div>

              {/* Vincular quartos */}
              <div>
                <label className={`block mb-1 ${theme.textSecondary}`}>
                  Vincular quartos (clique para selecionar)
                </label>
                <div className="flex flex-wrap gap-2">
                  {baseRooms.map((r) => {
                    const selected = formVinculoQuartos.includes(r.numero);
                    return (
                      <button
                        key={r.numero}
                        type="button"
                        onClick={() => toggleQuartoVinculo(r.numero)}
                        className={`px-2 py-1 rounded-full text-xs border transition-all ${
                          selected
                            ? 'bg-violet-600 text-white border-violet-400'
                            : `${theme.button} ${theme.text}`
                        }`}
                      >
                        {formatRoomNumber(r.numero)}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Modelo de cobrança */}
              <div>
                <label className={`block mb-1 ${theme.textSecondary}`}>Modelo de cobrança</label>
                <select
                  value={formModeloCobranca}
                  onChange={(e) => handleModeloCobrancaChange(e.target.value)}
                  className={`w-full px-3 py-2 ${theme.input} rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 border-2`}
                >
                  <option>Por ocupação</option>
                  <option>Por quarto (tarifa fixa)</option>
                </select>
              </div>

              {/* Preços */}
              {formModeloCobranca === 'Por quarto (tarifa fixa)' ? (
                <div>
                  <label className={`block mb-1 ${theme.textSecondary}`}>
                    Preço fixo do quarto (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formPrecoFixo}
                    onChange={(e) => setFormPrecoFixo(parseFloat(e.target.value) || 0)}
                    className={`w-full px-3 py-2 ${theme.input} rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 border-2`}
                  />
                </div>
              ) : (
                <div>
                  <label className={`block mb-1 ${theme.textSecondary}`}>
                    Preços por quantidade de pessoas (R$)
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {Array.from({ length: formMaxPessoas }).map((_, idx) => {
                      const q = idx + 1;
                      return (
                        <div key={q}>
                          <label className={`block mb-1 ${theme.textSecondary} text-xs`}>
                            {q} pessoa{q > 1 ? 's' : ''}
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={formPrecosOcupacao[q] || 0}
                            onChange={(e) => handlePrecoOcupacaoChange(q, e.target.value)}
                            className={`w-full px-3 py-2 ${theme.input} rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 border-2`}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Day Use */}
              <div className="border-t border-white/10 pt-3">
                <label className={`block mb-1 ${theme.textSecondary}`}>Day Use</label>
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="checkbox"
                    checked={formDayUseAtivo}
                    onChange={(e) => setFormDayUseAtivo(e.target.checked)}
                    className="w-4 h-4 accent-violet-500"
                  />
                  <span className={theme.text}>Ativar day use nesta categoria</span>
                </div>
                {formDayUseAtivo && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                    <div>
                      <label className={`block mb-1 ${theme.textSecondary} text-xs`}>
                        Preço fixo base (R$)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={formDayUsePrecoFixo}
                        onChange={(e) =>
                          setFormDayUsePrecoFixo(parseFloat(e.target.value) || 0)
                        }
                        className={`w-full px-3 py-2 ${theme.input} rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 border-2`}
                      />
                    </div>
                    <div>
                      <label className={`block mb-1 ${theme.textSecondary} text-xs`}>
                        Valor hora adicional (R$)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={formDayUsePrecoAdicional}
                        onChange={(e) =>
                          setFormDayUsePrecoAdicional(parseFloat(e.target.value) || 0)
                        }
                        className={`w-full px-3 py-2 ${theme.input} rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 border-2`}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Sazonais ativas */}
              <div className="border-t border-white/10 pt-3">
                <label className={`block mb-1 ${theme.textSecondary}`}>
                  Ativar sazonalidades pré-cadastradas
                </label>
                {seasonalDefinitions.length === 0 ? (
                  <p className={`${theme.textSecondary} text-xs`}>
                    Nenhuma sazonalidade cadastrada ainda.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {seasonalDefinitions.map((s) => {
                      const ativa = formSazonaisAtivas.includes(s.id);
                      return (
                        <label key={s.id} className="flex items-start gap-2">
                          <input
                            type="checkbox"
                            checked={ativa}
                            onChange={() => toggleSeasonalAtiva(s.id)}
                            className="w-4 h-4 accent-violet-500 mt-0.5"
                          />
                          <div>
                            <span className={`${theme.text} text-xs font-semibold`}>
                              {s.nome}
                            </span>
                            <p className={`${theme.textSecondary} text-[11px]`}>
                              {s.dataInicio} → {s.dataFim}
                            </p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className={`p-4 border-t ${theme.divider} flex gap-2`}>
              <button
                onClick={() => setShowCategoryModal(false)}
                className={`flex-1 px-4 py-2 ${theme.button} ${theme.text} rounded-lg border transition-all duration-200 text-sm font-medium hover:scale-105 active:scale-95`}
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveCategory}
                className="flex-1 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-all duration-200 text-sm font-medium hover:scale-105 active:scale-95 hover:shadow-lg hover:shadow-violet-500/50"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Sazonalidade Form */}
      {showSeasonalFormModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className={`${theme.card} rounded-xl border shadow-2xl max-w-3xl w-full my-8`}>
            <div className={`p-4 border-b ${theme.divider} flex items-center justify-between`}>
              <h3 className={`text-lg font-bold ${theme.text}`}>
                {editingSeasonal ? 'Editar sazonalidade' : 'Nova sazonalidade'}
              </h3>
              <button
                onClick={() => setShowSeasonalFormModal(false)}
                className={`${theme.textSecondary} hover:${theme.text} transition-transform duration-200 hover:scale-110 active:scale-90`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4 text-sm max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className={`block mb-1 ${theme.textSecondary}`}>Nome</label>
                  <input
                    type="text"
                    value={seasonalNome}
                    onChange={(e) => setSeasonalNome(e.target.value)}
                    className={`w-full px-3 py-2 ${theme.input} rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 border-2`}
                    placeholder="Ex: Alta Temporada Verão"
                  />
                </div>
                <div>
                  <label className={`block mb-1 ${theme.textSecondary}`}>Máximo de pessoas</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={seasonalMaxPessoas}
                    onChange={(e) => handleSeasonalMaxPessoasChange(parseInt(e.target.value, 10))}
                    className={`w-full px-3 py-2 ${theme.input} rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 border-2`}
                  />
                </div>
              </div>

              <div>
                <label className={`block mb-1 ${theme.textSecondary}`}>Descrição</label>
                <textarea
                  rows={2}
                  value={seasonalDescricao}
                  onChange={(e) => setSeasonalDescricao(e.target.value)}
                  className={`w-full px-3 py-2 ${theme.input} rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 border-2`}
                  placeholder="Breve descrição..."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className={`block mb-1 ${theme.textSecondary}`}>Data início</label>
                  <input
                    type="date"
                    value={seasonalDataInicio}
                    onChange={(e) => setSeasonalDataInicio(e.target.value)}
                    className={`w-full px-3 py-2 ${theme.input} rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 border-2`}
                  />
                </div>
                <div>
                  <label className={`block mb-1 ${theme.textSecondary}`}>Hora início</label>
                  <input
                    type="time"
                    value={seasonalHoraInicio}
                    onChange={(e) => setSeasonalHoraInicio(e.target.value)}
                    className={`w-full px-3 py-2 ${theme.input} rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 border-2`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className={`block mb-1 ${theme.textSecondary}`}>Data fim</label>
                  <input
                    type="date"
                    value={seasonalDataFim}
                    onChange={(e) => setSeasonalDataFim(e.target.value)}
                    className={`w-full px-3 py-2 ${theme.input} rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 border-2`}
                  />
                </div>
                <div>
                  <label className={`block mb-1 ${theme.textSecondary}`}>Hora fim</label>
                  <input
                    type="time"
                    value={seasonalHoraFim}
                    onChange={(e) => setSeasonalHoraFim(e.target.value)}
                    className={`w-full px-3 py-2 ${theme.input} rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 border-2`}
                  />
                </div>
              </div>

              <div>
                <label className={`block mb-1 ${theme.textSecondary}`}>Modelo de cobrança</label>
                <select
                  value={seasonalModeloCobranca}
                  onChange={(e) => handleSeasonalModeloCobrancaChange(e.target.value)}
                  className={`w-full px-3 py-2 ${theme.input} rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 border-2`}
                >
                  <option>Por ocupação</option>
                  <option>Por quarto (tarifa fixa)</option>
                </select>
              </div>

              {seasonalModeloCobranca === 'Por quarto (tarifa fixa)' ? (
                <div>
                  <label className={`block mb-1 ${theme.textSecondary}`}>
                    Preço fixo do quarto (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={seasonalPrecoFixo}
                    onChange={(e) => setSeasonalPrecoFixo(parseFloat(e.target.value) || 0)}
                    className={`w-full px-3 py-2 ${theme.input} rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 border-2`}
                  />
                </div>
              ) : (
                <div>
                  <label className={`block mb-1 ${theme.textSecondary}`}>
                    Preços por quantidade de pessoas (R$)
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {Array.from({ length: seasonalMaxPessoas }).map((_, idx) => {
                      const q = idx + 1;
                      return (
                        <div key={q}>
                          <label className={`block mb-1 ${theme.textSecondary} text-xs`}>
                            {q} pax
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={seasonalPrecosOcupacao[q] || 0}
                            onChange={(e) =>
                              handleSeasonalPrecoOcupacaoChange(q, e.target.value)
                            }
                            className={`w-full px-3 py-2 ${theme.input} rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 border-2`}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className={`p-4 border-t ${theme.divider} flex gap-2`}>
              <button
                onClick={() => setShowSeasonalFormModal(false)}
                className={`flex-1 px-4 py-2 ${theme.button} ${theme.text} rounded-lg border transition-all duration-200 text-sm font-medium hover:scale-105 active:scale-95`}
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveSeasonal}
                className="flex-1 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-all duration-200 text-sm font-medium hover:scale-105 active:scale-95 hover:shadow-lg hover:shadow-violet-500/50"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Permissões */}
      {showPermissionsModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`${theme.card} rounded-xl border shadow-2xl max-w-md w-full`}>
            <div className={`p-4 border-b ${theme.divider} flex items-center justify-between`}>
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-violet-500" />
                <h3 className={`text-lg font-bold ${theme.text}`}>Permissões de Preços</h3>
              </div>
              <button
                onClick={() => setShowPermissionsModal(false)}
                className={`${theme.textSecondary} hover:${theme.text} transition-transform duration-200 hover:scale-110 active:scale-90`}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-3 text-sm">
              <label className="flex items-center justify-between gap-2">
                <span className={theme.text}>Acesso total</span>
                <input
                  type="checkbox"
                  checked={permissions.acessoTotal}
                  onChange={() => togglePermission('acessoTotal')}
                  className="w-4 h-4 accent-violet-500"
                />
              </label>
              <div className={`${theme.divider} border-t my-1`} />
              <label className="flex items-center justify-between gap-2">
                <span className={theme.text}>Dashboard</span>
                <input
                  type="checkbox"
                  checked={permissions.dashboard}
                  onChange={() => togglePermission('dashboard')}
                  className="w-4 h-4 accent-violet-500"
                  disabled={permissions.acessoTotal}
                />
              </label>
              <label className="flex items-center justify-between gap-2">
                <span className={theme.text}>Adicionar categoria</span>
                <input
                  type="checkbox"
                  checked={permissions.adicionarCategoria}
                  onChange={() => togglePermission('adicionarCategoria')}
                  className="w-4 h-4 accent-violet-500"
                  disabled={permissions.acessoTotal}
                />
              </label>
              <label className="flex items-center justify-between gap-2">
                <span className={theme.text}>Editar categoria</span>
                <input
                  type="checkbox"
                  checked={permissions.editarCategoria}
                  onChange={() => togglePermission('editarCategoria')}
                  className="w-4 h-4 accent-violet-500"
                  disabled={permissions.acessoTotal}
                />
              </label>
              <label className="flex items-center justify-between gap-2">
                <span className={theme.text}>Cadastrar sazonalidade</span>
                <input
                  type="checkbox"
                  checked={permissions.cadastrarSazonalidade}
                  onChange={() => togglePermission('cadastrarSazonalidade')}
                  className="w-4 h-4 accent-violet-500"
                  disabled={permissions.acessoTotal}
                />
              </label>
              <label className="flex items-center justify-between gap-2">
                <span className={theme.text}>Alterar sazonalidade</span>
                <input
                  type="checkbox"
                  checked={permissions.alterarSazonalidade}
                  onChange={() => togglePermission('alterarSazonalidade')}
                  className="w-4 h-4 accent-violet-500"
                  disabled={permissions.acessoTotal}
                />
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

      {/* Notificação */}
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
            <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
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
