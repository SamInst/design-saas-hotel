import React, { useState } from 'react';
import {
  BedDouble, Calendar, DollarSign, Sun, Moon, Plus, Edit,
  Shield, ChevronDown, Users, Clock, Tag, X, Info, Check, Trash2, RefreshCw,
} from 'lucide-react';

function formatRoomNumber(num) { return num < 10 ? `0${num}` : `${num}`; }
const fmt = (v) => `R$ ${Number(v || 0).toFixed(2)}`;

// ─── Helpers de recorrência ───────────────────────────────────────────────────
const RECORRENCIAS = ['Diária', 'Semanal', 'Quinzenal', 'Mensal', 'Trimestral', 'Semestral', 'Anual'];
const DIAS_SEMANA  = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

function describeSchedule(s) {
  if (s.modoOperacao === 'data-especifica') {
    return `${s.dataInicio} ${s.horaInicio} → ${s.dataFim} ${s.horaFim}`;
  }
  const base = `${s.recorrencia} · ${s.horaInicioRecorrencia}–${s.horaFimRecorrencia}`;
  if (s.recorrencia === 'Semanal' && s.diasSemana?.length) {
    return `${base} · ${s.diasSemana.map((d) => DIAS_SEMANA[d]).join(', ')}`;
  }
  return base;
}

export default function PricingManagement() {
  const [isDark, setIsDark]                               = useState(true);
  const [showCategoryModal, setShowCategoryModal]         = useState(false);
  const [editingCategory, setEditingCategory]             = useState(null);
  const [showPermissionsModal, setShowPermissionsModal]   = useState(false);
  const [showSeasonalFormModal, setShowSeasonalFormModal] = useState(false);
  const [editingSeasonal, setEditingSeasonal]             = useState(null);
  const [notification, setNotification]                   = useState(null);
  const [collapsedCategories, setCollapsedCategories]     = useState({});
  const [collapsedSeasonals, setCollapsedSeasonals]       = useState({});

  // ── Category form ────────────────────────────────────────────────────────────
  const [formNome, setFormNome]                             = useState('');
  const [formDescricao, setFormDescricao]                   = useState('');
  const [formMaxPessoas, setFormMaxPessoas]                 = useState(5);
  const [formVinculoQuartos, setFormVinculoQuartos]         = useState([]);
  const [formModeloCobranca, setFormModeloCobranca]         = useState('Por ocupação');
  const [formPrecoFixo, setFormPrecoFixo]                   = useState(0);
  const [formPrecosOcupacao, setFormPrecosOcupacao]         = useState({});
  const [formDayUseAtivo, setFormDayUseAtivo]               = useState(false);
  const [formDayUsePrecoFixo, setFormDayUsePrecoFixo]       = useState(0);
  const [formDayUsePrecoAdicional, setFormDayUsePrecoAdicional] = useState(0);
  const [formSazonaisAtivas, setFormSazonaisAtivas]         = useState([]);

  // ── Seasonal form ─────────────────────────────────────────────────────────────
  const [sNome, setSNome]                         = useState('');
  const [sDescricao, setSDescricao]               = useState('');
  const [sModo, setSModo]                         = useState('data-especifica'); // 'data-especifica' | 'recorrencia'
  // Data específica
  const [sDataInicio, setSDataInicio]             = useState('');
  const [sDataFim, setSDataFim]                   = useState('');
  const [sHoraInicio, setSHoraInicio]             = useState('');
  const [sHoraFim, setSHoraFim]                   = useState('');
  // Recorrência
  const [sRecorrencia, setSRecorrencia]           = useState('Mensal');
  const [sDiasSemana, setSDiasSemana]             = useState([]);
  const [sHoraInicioRec, setSHoraInicioRec]       = useState('');
  const [sHoraFimRec, setSHoraFimRec]             = useState('');
  // Preços
  const [sModeloCobranca, setSModeloCobranca]     = useState('Por ocupação');
  const [sPrecoFixo, setSPrecoFixo]               = useState(0);
  const [sPrecosOcupacao, setSPrecosOcupacao]     = useState({});
  const [sMaxPessoas, setSMaxPessoas]             = useState(5);
  // Day Use sazonal
  const [sDayUseAtivo, setSDayUseAtivo]           = useState(false);
  const [sDayUsePreco, setSDayUsePreco]           = useState(0);
  const [sDayUsePrecoAd, setSDayUsePrecoAd]       = useState(0);

  const [permissions, setPermissions] = useState({
    acessoTotal: true, dashboard: true, adicionarCategoria: true,
    editarCategoria: true, cadastrarSazonalidade: true, alterarSazonalidade: true,
  });

  const baseRooms = [
    {numero:1,categoriaVisual:'Standard'},{numero:2,categoriaVisual:'Standard'},
    {numero:3,categoriaVisual:'Standard'},{numero:4,categoriaVisual:'Standard'},
    {numero:5,categoriaVisual:'Standard'},{numero:6,categoriaVisual:'Luxo'},
    {numero:7,categoriaVisual:'Luxo'},{numero:8,categoriaVisual:'Luxo'},
    {numero:9,categoriaVisual:'Suíte'},{numero:10,categoriaVisual:'Suíte'},
  ];

  const [categories, setCategories] = useState([
    { id:1, nome:'Standard Até 5 Pessoas', descricao:'Categoria base para quartos standard, cobrando por ocupação até 5 pessoas.', maxPessoas:5, modeloCobranca:'Por ocupação', vinculoQuartos:[1,2,3,4], precoFixo:null, precosOcupacao:{1:120,2:160,3:190,4:210,5:230}, dayUse:{ativo:true,precoFixo:90,precoAdicional:15}, sazonaisAtivas:['alta-verao'] },
    { id:2, nome:'Luxo Até 5 Pessoas',     descricao:'Categoria luxo com foco em casais e famílias pequenas.',                     maxPessoas:5, modeloCobranca:'Por ocupação', vinculoQuartos:[6,7,8],    precoFixo:null, precosOcupacao:{1:220,2:280,3:320,4:360,5:400}, dayUse:{ativo:true,precoFixo:150,precoAdicional:25}, sazonaisAtivas:['reveillon'] },
    { id:3, nome:'Suíte Família',          descricao:'Suítes amplas, tarifa fixa por quarto.',                                     maxPessoas:5, modeloCobranca:'Por quarto (tarifa fixa)', vinculoQuartos:[9,10], precoFixo:450, precosOcupacao:null, dayUse:{ativo:false,precoFixo:0,precoAdicional:0}, sazonaisAtivas:[] },
  ]);

  const [seasonalDefinitions, setSeasonalDefinitions] = useState([
    {
      id:'alta-verao', nome:'Alta Temporada Verão', descricao:'Período de alta demanda no verão',
      modoOperacao:'data-especifica',
      dataInicio:'2026-12-01', dataFim:'2027-02-28', horaInicio:'14:00', horaFim:'12:00',
      recorrencia:null, diasSemana:[], horaInicioRecorrencia:'', horaFimRecorrencia:'',
      modeloCobranca:'Por ocupação', maxPessoas:5, precoFixo:null,
      precosOcupacao:{1:150,2:200,3:240,4:270,5:300},
      dayUse:{ativo:true,precoFixo:110,precoAdicional:20},
    },
    {
      id:'reveillon', nome:'Revéillon', descricao:'Virada de ano com tarifas especiais',
      modoOperacao:'data-especifica',
      dataInicio:'2026-12-28', dataFim:'2027-01-02', horaInicio:'15:00', horaFim:'11:00',
      recorrencia:null, diasSemana:[], horaInicioRecorrencia:'', horaFimRecorrencia:'',
      modeloCobranca:'Por ocupação', maxPessoas:5, precoFixo:null,
      precosOcupacao:{1:300,2:380,3:440,4:500,5:560},
      dayUse:{ativo:false,precoFixo:0,precoAdicional:0},
    },
    {
      id:'fim-semana', nome:'Fim de Semana', descricao:'Tarifa especial para finais de semana',
      modoOperacao:'recorrencia',
      dataInicio:'', dataFim:'', horaInicio:'', horaFim:'',
      recorrencia:'Semanal', diasSemana:[5,6], horaInicioRecorrencia:'14:00', horaFimRecorrencia:'12:00',
      modeloCobranca:'Por ocupação', maxPessoas:5, precoFixo:null,
      precosOcupacao:{1:180,2:240,3:280,4:310,5:340},
      dayUse:{ativo:false,precoFixo:0,precoAdicional:0},
    },
  ]);

  // ── Theme ────────────────────────────────────────────────────────────────────
  const theme = {
    bg:            isDark ? 'bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950' : 'bg-gradient-to-br from-slate-100 via-slate-50 to-slate-200',
    bgOverlay:     isDark ? 'bg-[radial-gradient(circle_at_50%_120%,rgba(120,119,198,0.15),transparent)]' : 'bg-[radial-gradient(circle_at_50%_120%,rgba(120,119,198,0.08),transparent)]',
    text:          isDark ? 'text-white'        : 'text-slate-900',
    textSecondary: isDark ? 'text-slate-400'    : 'text-slate-600',
    card:          isDark ? 'bg-white/5 border-white/10'   : 'bg-white border-slate-200',
    cardHover:     isDark ? 'hover:bg-white/10' : 'hover:bg-slate-50',
    input:         isDark ? 'bg-slate-800 border-white/15 text-white placeholder-slate-500' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400',
    divider:       isDark ? 'border-white/10'   : 'border-slate-200',
    button:        isDark ? 'bg-white/10 hover:bg-white/20 border-white/10' : 'bg-slate-100 hover:bg-slate-200 border-slate-300',
  };

  const inputCls = `w-full px-3 py-2 ${theme.input} rounded-lg text-sm border focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent`;

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const showNotification = (msg, type = 'info') => { setNotification({ message: msg, type }); setTimeout(() => setNotification(null), 3000); };
  const togglePermission   = (k) => setPermissions((p) => ({ ...p, [k]: !p[k] }));
  const toggleCatCollapse  = (id) => setCollapsedCategories((p) => ({ ...p, [id]: !p[id] }));
  const toggleSeaCollapse  = (id) => setCollapsedSeasonals((p) => ({ ...p, [id]: !p[id] }));
  const getMinPreco = (c) => c.modeloCobranca === 'Por quarto (tarifa fixa)' ? c.precoFixo : Math.min(...Object.values(c.precosOcupacao || { 0: 0 }));
  const getMaxPreco = (c) => c.modeloCobranca === 'Por quarto (tarifa fixa)' ? c.precoFixo : Math.max(...Object.values(c.precosOcupacao || { 0: 0 }));
  const getQuartosVinc = (cat) => baseRooms.filter((r) => cat.vinculoQuartos.includes(r.numero));

  // ── Category handlers ────────────────────────────────────────────────────────
  const resetCategoryForm = () => {
    setFormNome(''); setFormDescricao(''); setFormMaxPessoas(5); setFormVinculoQuartos([]);
    setFormModeloCobranca('Por ocupação'); setFormPrecoFixo(0); setFormPrecosOcupacao({});
    setFormDayUseAtivo(false); setFormDayUsePrecoFixo(0); setFormDayUsePrecoAdicional(0);
    setFormSazonaisAtivas([]);
  };

  const handleOpenNewCategory = () => {
    if (!permissions.adicionarCategoria && !permissions.acessoTotal) { showNotification('Sem permissão.', 'error'); return; }
    resetCategoryForm(); setEditingCategory(null); setShowCategoryModal(true);
  };

  const handleEditCategory = (cat) => {
    if (!permissions.editarCategoria && !permissions.acessoTotal) { showNotification('Sem permissão.', 'error'); return; }
    setEditingCategory(cat);
    setFormNome(cat.nome); setFormDescricao(cat.descricao); setFormMaxPessoas(cat.maxPessoas);
    setFormVinculoQuartos(cat.vinculoQuartos); setFormModeloCobranca(cat.modeloCobranca);
    setFormPrecoFixo(cat.precoFixo || 0); setFormPrecosOcupacao(cat.precosOcupacao || {});
    setFormDayUseAtivo(cat.dayUse.ativo); setFormDayUsePrecoFixo(cat.dayUse.precoFixo);
    setFormDayUsePrecoAdicional(cat.dayUse.precoAdicional);
    setFormSazonaisAtivas(cat.sazonaisAtivas || []);
    setShowCategoryModal(true);
  };

  const handleSaveCategory = () => {
    const data = {
      nome: formNome, descricao: formDescricao, maxPessoas: formMaxPessoas,
      vinculoQuartos: formVinculoQuartos, modeloCobranca: formModeloCobranca,
      precoFixo: formModeloCobranca === 'Por quarto (tarifa fixa)' ? formPrecoFixo : null,
      precosOcupacao: formModeloCobranca === 'Por ocupação' ? formPrecosOcupacao : null,
      dayUse: { ativo: formDayUseAtivo, precoFixo: formDayUsePrecoFixo, precoAdicional: formDayUsePrecoAdicional },
      sazonaisAtivas: formSazonaisAtivas,
    };
    if (editingCategory) {
      setCategories((p) => p.map((c) => c.id === editingCategory.id ? { ...c, ...data } : c));
      showNotification('Categoria atualizada.', 'success');
    } else {
      setCategories((p) => [...p, { id: Date.now(), ...data }]);
      showNotification('Categoria criada.', 'success');
    }
    setShowCategoryModal(false);
  };

  const toggleQuartoVinculo = (num) => setFormVinculoQuartos((p) => p.includes(num) ? p.filter((n) => n !== num) : [...p, num]);
  const toggleSeasonalAtiva = (id)  => setFormSazonaisAtivas((p) => p.includes(id)  ? p.filter((x) => x !== id)  : [...p, id]);

  const handleModeloCobrancaChange = (m) => {
    setFormModeloCobranca(m);
    if (m === 'Por quarto (tarifa fixa)') setFormPrecosOcupacao({}); else setFormPrecoFixo(0);
  };

  const handleMaxPessoasChange = (max) => {
    setFormMaxPessoas(max);
    if (formModeloCobranca === 'Por ocupação') {
      const n = {}; for (let i = 1; i <= max; i++) n[i] = formPrecosOcupacao[i] || 0;
      setFormPrecosOcupacao(n);
    }
  };

  // ── Seasonal handlers ────────────────────────────────────────────────────────
  const resetSeasonalForm = () => {
    setSNome(''); setSDescricao(''); setSModo('data-especifica');
    setSDataInicio(''); setSDataFim(''); setSHoraInicio(''); setSHoraFim('');
    setSRecorrencia('Mensal'); setSDiasSemana([]); setSHoraInicioRec(''); setSHoraFimRec('');
    setSModeloCobranca('Por ocupação'); setSPrecoFixo(0); setSPrecosOcupacao({}); setSMaxPessoas(5);
    setSDayUseAtivo(false); setSDayUsePreco(0); setSDayUsePrecoAd(0);
  };

  const handleOpenNewSeasonal = () => {
    if (!permissions.cadastrarSazonalidade && !permissions.acessoTotal) { showNotification('Sem permissão.', 'error'); return; }
    resetSeasonalForm(); setEditingSeasonal(null); setShowSeasonalFormModal(true);
  };

  const handleEditSeasonal = (s) => {
    if (!permissions.alterarSazonalidade && !permissions.acessoTotal) { showNotification('Sem permissão.', 'error'); return; }
    setEditingSeasonal(s);
    setSNome(s.nome); setSDescricao(s.descricao); setSModo(s.modoOperacao || 'data-especifica');
    setSDataInicio(s.dataInicio || ''); setSDataFim(s.dataFim || '');
    setSHoraInicio(s.horaInicio || ''); setSHoraFim(s.horaFim || '');
    setSRecorrencia(s.recorrencia || 'Mensal'); setSDiasSemana(s.diasSemana || []);
    setSHoraInicioRec(s.horaInicioRecorrencia || ''); setSHoraFimRec(s.horaFimRecorrencia || '');
    setSModeloCobranca(s.modeloCobranca); setSPrecoFixo(s.precoFixo || 0);
    setSPrecosOcupacao(s.precosOcupacao || {}); setSMaxPessoas(s.maxPessoas);
    setSDayUseAtivo(s.dayUse?.ativo || false);
    setSDayUsePreco(s.dayUse?.precoFixo || 0); setSDayUsePrecoAd(s.dayUse?.precoAdicional || 0);
    setShowSeasonalFormModal(true);
  };

  const handleSaveSeasonal = () => {
    const data = {
      nome: sNome, descricao: sDescricao, modoOperacao: sModo,
      dataInicio: sModo === 'data-especifica' ? sDataInicio : '',
      dataFim:    sModo === 'data-especifica' ? sDataFim    : '',
      horaInicio: sModo === 'data-especifica' ? sHoraInicio : '',
      horaFim:    sModo === 'data-especifica' ? sHoraFim    : '',
      recorrencia:           sModo === 'recorrencia' ? sRecorrencia    : null,
      diasSemana:            sModo === 'recorrencia' ? sDiasSemana     : [],
      horaInicioRecorrencia: sModo === 'recorrencia' ? sHoraInicioRec  : '',
      horaFimRecorrencia:    sModo === 'recorrencia' ? sHoraFimRec     : '',
      modeloCobranca: sModeloCobranca, maxPessoas: sMaxPessoas,
      precoFixo: sModeloCobranca === 'Por quarto (tarifa fixa)' ? sPrecoFixo : null,
      precosOcupacao: sModeloCobranca === 'Por ocupação' ? sPrecosOcupacao : null,
      dayUse: { ativo: sDayUseAtivo, precoFixo: sDayUsePreco, precoAdicional: sDayUsePrecoAd },
    };
    if (editingSeasonal) {
      setSeasonalDefinitions((p) => p.map((s) => s.id === editingSeasonal.id ? { ...s, ...data } : s));
      showNotification('Sazonalidade atualizada.', 'success');
    } else {
      setSeasonalDefinitions((p) => [...p, { id: `seasonal-${Date.now()}`, ...data }]);
      showNotification('Sazonalidade criada.', 'success');
    }
    setShowSeasonalFormModal(false);
  };

  const handleDeleteSeasonal = (id) => { setSeasonalDefinitions((p) => p.filter((s) => s.id !== id)); showNotification('Sazonalidade removida.', 'success'); };

  const handleSeasonalModeloCobrancaChange = (m) => {
    setSModeloCobranca(m);
    if (m === 'Por quarto (tarifa fixa)') setSPrecosOcupacao({}); else setSPrecoFixo(0);
  };

  const handleSeasonalMaxPessoasChange = (max) => {
    setSMaxPessoas(max);
    if (sModeloCobranca === 'Por ocupação') {
      const n = {}; for (let i = 1; i <= max; i++) n[i] = sPrecosOcupacao[i] || 0;
      setSPrecosOcupacao(n);
    }
  };

  const toggleDiaSemana = (d) => setSDiasSemana((p) => p.includes(d) ? p.filter((x) => x !== d) : [...p, d]);

  const baseStats = {
    totalCategorias:    categories.length,
    categoriasDayUse:   categories.filter((c) => c.dayUse.ativo).length,
    categoriasSazonais: categories.filter((c) => c.sazonaisAtivas.length > 0).length,
    totalSazonalidades: seasonalDefinitions.length,
  };

  // ─── Tab button helper ───────────────────────────────────────────────────────
  const ModoTab = ({ value, label, icon: Icon, current, onChange }) => (
    <button type="button" onClick={() => onChange(value)}
      className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${current === value ? 'bg-violet-600 text-white' : `${theme.button} ${theme.text}`}`}>
      <Icon className="w-4 h-4" /> {label}
    </button>
  );

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className={`min-h-screen relative ${theme.bg}`}>
      <div className={`fixed inset-0 ${theme.bgOverlay} pointer-events-none`} />

      <div className="relative max-w-[1600px] mx-auto p-4 sm:p-8">

        {/* Header */}
        <header className="mb-6 pt-6 flex items-center justify-between">
          <div>
            <h1 className={`text-3xl font-bold ${theme.text} mb-1 tracking-tight`}>Categorias, Sazonais e Tabela de Preços</h1>
            <p className={`${theme.textSecondary} text-sm flex items-center gap-2`}><DollarSign className="w-3.5 h-3.5" /> Gestão de tarifas por categoria, ocupação, day use e sazonalidade</p>
          </div>
          <div className="flex gap-2">
            {[
              { label:'Permissões', icon:<Shield className="w-4 h-4" />, action:() => setShowPermissionsModal(true) },
              { label:isDark?'Light':'Dark', icon:isDark?<Sun className="w-4 h-4" />:<Moon className="w-4 h-4" />, action:() => setIsDark(!isDark) },
            ].map(({ label, icon, action }) => (
              <button key={label} onClick={action}
                className={`px-4 py-2 ${theme.button} ${theme.text} rounded-lg border text-sm font-medium flex items-center gap-2 hover:scale-105 active:scale-95 transition-all`}>
                {icon} {label}
              </button>
            ))}
          </div>
        </header>

        {/* Dashboard */}
        {permissions.dashboard && (
          <div className={`${theme.card} rounded-xl p-4 mb-6 border`}>
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="w-4 h-4 text-violet-500" />
              <h2 className={`text-sm font-bold ${theme.text} uppercase tracking-wider`}>Visão geral de preços</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label:'CATEGORIAS',          value:baseStats.totalCategorias,    sub:'Tipos de tabela ativos',   gradient:'from-violet-600 to-purple-700', Icon:Tag      },
                { label:'DAY USE',             value:baseStats.categoriasDayUse,   sub:'Com tarifa de uso diurno', gradient:'from-emerald-600 to-teal-700',  Icon:Clock    },
                { label:'SAZONALIDADES',       value:baseStats.totalSazonalidades, sub:'Períodos cadastrados',     gradient:'from-amber-600 to-orange-600',  Icon:Calendar },
                { label:'COM SAZONAIS ATIVAS', value:baseStats.categoriasSazonais, sub:'Categorias configuradas',  gradient:'from-sky-600 to-blue-700',      Icon:Users    },
              ].map(({ label, value, sub, gradient, Icon }) => (
                <div key={label} className={`rounded-lg p-4 bg-gradient-to-br ${gradient}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-white/80 uppercase font-medium">{label}</span>
                    <Icon className="w-4 h-4 text-white/80" />
                  </div>
                  <p className="text-3xl font-bold text-white">{value}</p>
                  <p className="text-xs text-white/80 mt-1">{sub}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Categorias de Preço ── */}
        <div className={`${theme.card} rounded-xl border overflow-hidden mb-6`}>
          <div className={`px-4 py-3 border-b ${theme.divider} flex flex-col sm:flex-row gap-3 sm:items-center justify-between`}>
            <div>
              <h2 className={`text-lg font-bold ${theme.text}`}>Categorias de Preço</h2>
              <p className={`${theme.textSecondary} text-xs`}>Cada categoria define valores, day use e sazonais.</p>
            </div>
            <div className="flex gap-2">
              {permissions.cadastrarSazonalidade && (
                <button onClick={handleOpenNewSeasonal}
                  className={`px-3 py-2 ${theme.button} ${theme.text} rounded-lg border text-sm font-medium flex items-center gap-2 hover:scale-105 active:scale-95 transition-all`}>
                  <Calendar className="w-4 h-4" /> Nova Sazonalidade
                </button>
              )}
              {permissions.adicionarCategoria && (
                <button onClick={handleOpenNewCategory}
                  className="px-3 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-medium flex items-center gap-2 hover:scale-105 active:scale-95 transition-all">
                  <Plus className="w-4 h-4" /> Nova Categoria
                </button>
              )}
            </div>
          </div>

          <div className="divide-y divide-slate-700/40">
            {categories.map((cat) => {
              const quartosVinc = getQuartosVinc(cat);
              const isCollapsed = collapsedCategories[cat.id];
              return (
                <div key={cat.id}>
                  <div onClick={() => toggleCatCollapse(cat.id)}
                    className={`px-4 py-3 flex items-center justify-between cursor-pointer ${theme.cardHover} transition-colors`}>
                    <div className="flex items-center gap-3">
                      <ChevronDown className={`w-4 h-4 text-violet-400 transition-transform duration-200 ${isCollapsed ? '-rotate-90' : ''}`} />
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`${theme.text} font-semibold text-sm`}>{cat.nome}</span>
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-300 border border-violet-500/30">{cat.modeloCobranca}</span>
                          {cat.dayUse.ativo && <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">Day Use</span>}
                          {cat.sazonaisAtivas.length > 0 && <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">{cat.sazonaisAtivas.length} sazonal(is)</span>}
                        </div>
                        <p className={`${theme.textSecondary} text-xs mt-0.5`}>{cat.descricao}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="hidden sm:flex flex-col text-right text-xs">
                        {cat.modeloCobranca === 'Por quarto (tarifa fixa)'
                          ? <span className={theme.textSecondary}>Fixo: {fmt(cat.precoFixo)}</span>
                          : <span className={theme.textSecondary}>{fmt(getMinPreco(cat))} – {fmt(getMaxPreco(cat))}</span>}
                      </div>
                      {permissions.editarCategoria && (
                        <button onClick={(e) => { e.stopPropagation(); handleEditCategory(cat); }}
                          className={`px-3 py-1.5 text-xs rounded-lg border ${theme.button} ${theme.text} flex items-center gap-1.5 hover:scale-105 active:scale-95 transition-all`}>
                          <Edit className="w-3.5 h-3.5" /> Editar
                        </button>
                      )}
                    </div>
                  </div>

                  {!isCollapsed && (
                    <div className="px-4 pb-4 pt-2 grid grid-cols-1 lg:grid-cols-3 gap-4">
                      {/* Hospedagem */}
                      <div className={`${theme.card} rounded-lg border p-3 flex flex-col`}>
                        <div className="flex items-center gap-2 mb-2"><Users className="w-4 h-4 text-violet-400" /><span className={`${theme.text} text-xs font-semibold uppercase`}>Hospedagem</span></div>
                        {cat.modeloCobranca === 'Por quarto (tarifa fixa)' ? (
                          <div><p className={`${theme.text} font-bold text-lg`}>{fmt(cat.precoFixo)}</p><p className={`${theme.textSecondary} text-[11px] mt-1`}>Tarifa fixa por quarto.</p></div>
                        ) : (
                          <div className={`rounded-lg overflow-hidden border ${theme.divider} text-xs flex-1`}>
                            <div className={`flex ${isDark ? 'bg-white/5' : 'bg-slate-50'}`}>
                              <div className={`w-1/2 px-2 py-1 border-r ${theme.divider}`}><span className={`${theme.textSecondary} uppercase text-[10px]`}>Pessoas</span></div>
                              <div className="w-1/2 px-2 py-1"><span className={`${theme.textSecondary} uppercase text-[10px]`}>Preço/noite</span></div>
                            </div>
                            {Array.from({ length: cat.maxPessoas }).map((_, idx) => {
                              const q = idx + 1;
                              return (
                                <div key={q} className={`flex border-t ${theme.divider} hover:bg-violet-500/5`}>
                                  <div className={`w-1/2 px-2 py-1 border-r ${theme.divider}`}><span className={`${theme.text} text-xs`}>{q} pax</span></div>
                                  <div className="w-1/2 px-2 py-1"><span className={`${theme.text} text-xs font-semibold`}>{fmt(cat.precosOcupacao?.[q])}</span></div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      {/* Day Use */}
                      <div className={`${theme.card} rounded-lg border p-3 flex flex-col`}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2"><Clock className="w-4 h-4 text-emerald-400" /><span className={`${theme.text} text-xs font-semibold uppercase`}>Day Use</span></div>
                          <span className={`text-[11px] px-2 py-0.5 rounded-full ${cat.dayUse.ativo ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' : 'bg-slate-500/15 text-slate-300 border border-slate-500/30'}`}>{cat.dayUse.ativo ? 'Ativo' : 'Inativo'}</span>
                        </div>
                        {cat.dayUse.ativo ? (
                          <div className="space-y-2 text-xs flex-1">
                            <div className="flex justify-between"><span className={theme.textSecondary}>Preço base</span><span className={`${theme.text} font-semibold`}>{fmt(cat.dayUse.precoFixo)}</span></div>
                            <div className="flex justify-between"><span className={theme.textSecondary}>Hora adicional</span><span className={`${theme.text} font-semibold`}>{fmt(cat.dayUse.precoAdicional)}</span></div>
                          </div>
                        ) : <p className={`${theme.textSecondary} text-xs flex-1`}>Não habilitado.</p>}
                      </div>
                      {/* Sazonais + Quartos */}
                      <div className="flex flex-col gap-3">
                        <div className={`${theme.card} rounded-lg border p-3 flex-1`}>
                          <div className="flex items-center gap-2 mb-2"><Calendar className="w-4 h-4 text-amber-400" /><span className={`${theme.text} text-xs font-semibold uppercase`}>Sazonais ativas</span></div>
                          {cat.sazonaisAtivas.length === 0 ? <p className={`${theme.textSecondary} text-xs`}>Nenhuma sazonal ativa.</p> : (
                            <div className="space-y-1">
                              {cat.sazonaisAtivas.map((sid) => {
                                const s = seasonalDefinitions.find((d) => d.id === sid);
                                if (!s) return null;
                                return (
                                  <div key={sid} className={`rounded-lg px-2 py-1.5 border ${theme.divider}`}>
                                    <div className="flex items-center gap-1.5">
                                      {s.modoOperacao === 'recorrencia' ? <RefreshCw className="w-3 h-3 text-amber-400" /> : <Calendar className="w-3 h-3 text-amber-400" />}
                                      <span className={`${theme.text} font-semibold text-xs`}>{s.nome}</span>
                                    </div>
                                    <div className={`${theme.textSecondary} text-[10px] mt-0.5`}>{describeSchedule(s)}</div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                        <div className={`${theme.card} rounded-lg border p-3`}>
                          <div className="flex items-center gap-2 mb-2"><BedDouble className="w-4 h-4 text-sky-400" /><span className={`${theme.text} text-xs font-semibold uppercase`}>Quartos</span></div>
                          <div className="flex flex-wrap gap-1.5">
                            {quartosVinc.length === 0 ? <span className={`${theme.textSecondary} text-xs`}>Nenhum vinculado.</span>
                              : quartosVinc.map((r) => <span key={r.numero} className="px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-300 border border-sky-500/30 text-xs">{formatRoomNumber(r.numero)}</span>)}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Sazonalidades Cadastradas ── */}
        <div className={`${theme.card} rounded-xl border overflow-hidden mb-6`}>
          <div className={`px-4 py-3 border-b ${theme.divider}`}>
            <h2 className={`text-lg font-bold ${theme.text}`}>Sazonalidades Cadastradas</h2>
            <p className={`${theme.textSecondary} text-xs`}>Clique para expandir e ver detalhes.</p>
          </div>
          <div className="divide-y divide-slate-700/40">
            {seasonalDefinitions.length === 0
              ? <div className="p-8 text-center"><p className={`${theme.textSecondary} text-sm`}>Nenhuma sazonalidade cadastrada.</p></div>
              : seasonalDefinitions.map((s) => {
                const expanded = collapsedSeasonals[s.id] === true;
                const isRecorrencia = s.modoOperacao === 'recorrencia';
                return (
                  <div key={s.id}>
                    <div onClick={() => toggleSeaCollapse(s.id)}
                      className={`px-4 py-3 flex items-start justify-between cursor-pointer ${theme.cardHover} transition-colors`}>
                      <div className="flex items-center gap-3">
                        <ChevronDown className={`w-4 h-4 text-amber-400 transition-transform duration-200 mt-0.5 ${expanded ? '' : '-rotate-90'}`} />
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`${theme.text} font-semibold text-sm`}>{s.nome}</span>
                            <span className={`text-[11px] px-2 py-0.5 rounded-full flex items-center gap-1 ${isRecorrencia ? 'bg-sky-500/15 text-sky-300 border border-sky-500/30' : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'}`}>
                              {isRecorrencia ? <RefreshCw className="w-2.5 h-2.5" /> : <Calendar className="w-2.5 h-2.5" />}
                              {isRecorrencia ? (s.recorrencia || 'Recorrente') : 'Data Específica'}
                            </span>
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-300 border border-violet-500/30">{s.modeloCobranca}</span>
                            {s.dayUse?.ativo && <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">Day Use</span>}
                          </div>
                          <p className={`${theme.textSecondary} text-xs mt-0.5`}>{s.descricao}</p>
                          <p className={`${theme.textSecondary} text-[11px] mt-0.5`}>{describeSchedule(s)}</p>
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0 ml-2">
                        {permissions.alterarSazonalidade && (
                          <>
                            <button onClick={(e) => { e.stopPropagation(); handleEditSeasonal(s); }}
                              className={`px-3 py-1.5 text-xs rounded-lg border ${theme.button} ${theme.text} flex items-center gap-1.5 hover:scale-105 active:scale-95 transition-all`}>
                              <Edit className="w-3.5 h-3.5" /> Editar
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); handleDeleteSeasonal(s.id); }}
                              className="px-3 py-1.5 text-xs rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-300 flex items-center gap-1.5 hover:scale-105 active:scale-95 transition-all">
                              <Trash2 className="w-3.5 h-3.5" /> Excluir
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {expanded && (
                      <div className="px-4 pb-4 pt-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {/* Período / Recorrência */}
                        <div className={`${theme.card} rounded-lg border p-3`}>
                          <div className="flex items-center gap-2 mb-2">
                            {isRecorrencia ? <RefreshCw className="w-4 h-4 text-sky-400" /> : <Calendar className="w-4 h-4 text-amber-400" />}
                            <span className={`${theme.text} text-xs font-semibold uppercase`}>{isRecorrencia ? 'Recorrência' : 'Período'}</span>
                          </div>
                          <div className="space-y-1.5 text-xs">
                            {isRecorrencia ? (
                              <>
                                <div className="flex justify-between"><span className={theme.textSecondary}>Tipo</span><span className={`${theme.text} font-medium`}>{s.recorrencia}</span></div>
                                {s.recorrencia === 'Semanal' && s.diasSemana?.length > 0 && (
                                  <div className="flex justify-between items-start gap-2">
                                    <span className={theme.textSecondary}>Dias</span>
                                    <div className="flex flex-wrap gap-1 justify-end">
                                      {s.diasSemana.map((d) => <span key={d} className="px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 text-[10px]">{DIAS_SEMANA[d]}</span>)}
                                    </div>
                                  </div>
                                )}
                                <div className="flex justify-between"><span className={theme.textSecondary}>Horário</span><span className={`${theme.text} font-medium`}>{s.horaInicioRecorrencia} – {s.horaFimRecorrencia}</span></div>
                              </>
                            ) : (
                              <>
                                <div className="flex justify-between"><span className={theme.textSecondary}>Início</span><span className={`${theme.text} font-medium`}>{s.dataInicio} {s.horaInicio}</span></div>
                                <div className="flex justify-between"><span className={theme.textSecondary}>Fim</span><span className={`${theme.text} font-medium`}>{s.dataFim} {s.horaFim}</span></div>
                              </>
                            )}
                            <div className="flex justify-between"><span className={theme.textSecondary}>Modelo</span><span className={`${theme.text} font-medium`}>{s.modeloCobranca}</span></div>
                          </div>
                        </div>

                        {/* Tabela de Preços */}
                        <div className={`${theme.card} rounded-lg border p-3`}>
                          <div className="flex items-center gap-2 mb-2"><DollarSign className="w-4 h-4 text-violet-400" /><span className={`${theme.text} text-xs font-semibold uppercase`}>Tabela de Preços</span></div>
                          {s.modeloCobranca === 'Por quarto (tarifa fixa)' ? (
                            <div><p className={`${theme.text} font-bold text-lg`}>{fmt(s.precoFixo)}</p><p className={`${theme.textSecondary} text-[11px]`}>Valor fixo por quarto.</p></div>
                          ) : (
                            <div className={`rounded-lg overflow-hidden border ${theme.divider} text-xs`}>
                              <div className={`flex ${isDark ? 'bg-white/5' : 'bg-slate-50'}`}>
                                <div className={`w-1/2 px-2 py-1 border-r ${theme.divider}`}><span className={`${theme.textSecondary} uppercase text-[10px]`}>Pessoas</span></div>
                                <div className="w-1/2 px-2 py-1"><span className={`${theme.textSecondary} uppercase text-[10px]`}>Preço/noite</span></div>
                              </div>
                              {Array.from({ length: s.maxPessoas }).map((_, idx) => {
                                const q = idx + 1;
                                return (
                                  <div key={q} className={`flex border-t ${theme.divider} hover:bg-amber-500/5`}>
                                    <div className={`w-1/2 px-2 py-1 border-r ${theme.divider}`}><span className={`${theme.text} text-xs`}>{q} pax</span></div>
                                    <div className="w-1/2 px-2 py-1"><span className={`${theme.text} text-xs font-semibold`}>{fmt(s.precosOcupacao?.[q])}</span></div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* Day Use */}
                        <div className={`${theme.card} rounded-lg border p-3`}>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2"><Clock className="w-4 h-4 text-emerald-400" /><span className={`${theme.text} text-xs font-semibold uppercase`}>Day Use</span></div>
                            <span className={`text-[11px] px-2 py-0.5 rounded-full ${s.dayUse?.ativo ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' : 'bg-slate-500/15 text-slate-300 border border-slate-500/30'}`}>{s.dayUse?.ativo ? 'Ativo' : 'Inativo'}</span>
                          </div>
                          {s.dayUse?.ativo ? (
                            <div className="space-y-1.5 text-xs">
                              <div className="flex justify-between"><span className={theme.textSecondary}>Preço base</span><span className={`${theme.text} font-semibold`}>{fmt(s.dayUse.precoFixo)}</span></div>
                              <div className="flex justify-between"><span className={theme.textSecondary}>Hora adicional</span><span className={`${theme.text} font-semibold`}>{fmt(s.dayUse.precoAdicional)}</span></div>
                            </div>
                          ) : <p className={`${theme.textSecondary} text-xs`}>Não habilitado nesta sazonalidade.</p>}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      </div>

      {/* ── Modal Categoria ── */}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className={`${theme.card} rounded-xl border shadow-2xl max-w-4xl w-full my-8`}>
            <div className={`p-4 border-b ${theme.divider} flex items-center justify-between`}>
              <h3 className={`text-lg font-bold ${theme.text}`}>{editingCategory ? 'Editar categoria' : 'Nova categoria'}</h3>
              <button onClick={() => setShowCategoryModal(false)} className={`${theme.textSecondary} hover:scale-110 active:scale-90 transition-transform`}><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-4 text-sm max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div><label className={`block mb-1 ${theme.textSecondary}`}>Nome *</label><input type="text" value={formNome} onChange={(e) => setFormNome(e.target.value)} className={inputCls} placeholder="Ex: Standard até 5 pessoas" /></div>
                <div><label className={`block mb-1 ${theme.textSecondary}`}>Máximo de pessoas</label><input type="number" min={1} max={10} value={formMaxPessoas} onChange={(e) => handleMaxPessoasChange(parseInt(e.target.value, 10))} className={inputCls} /></div>
              </div>
              <div><label className={`block mb-1 ${theme.textSecondary}`}>Descrição</label><textarea rows={2} value={formDescricao} onChange={(e) => setFormDescricao(e.target.value)} className={`${inputCls} resize-none`} /></div>
              <div>
                <label className={`block mb-1 ${theme.textSecondary}`}>Vincular quartos</label>
                <div className="flex flex-wrap gap-2">
                  {baseRooms.map((r) => {
                    const sel = formVinculoQuartos.includes(r.numero);
                    return <button key={r.numero} type="button" onClick={() => toggleQuartoVinculo(r.numero)} className={`px-2 py-1 rounded-full text-xs border transition-all ${sel ? 'bg-violet-600 text-white border-violet-400' : `${theme.button} ${theme.text}`}`}>{formatRoomNumber(r.numero)}</button>;
                  })}
                </div>
              </div>
              <div><label className={`block mb-1 ${theme.textSecondary}`}>Modelo de cobrança</label>
                <select value={formModeloCobranca} onChange={(e) => handleModeloCobrancaChange(e.target.value)} className={inputCls}>
                  <option>Por ocupação</option><option>Por quarto (tarifa fixa)</option>
                </select>
              </div>
              {formModeloCobranca === 'Por quarto (tarifa fixa)' ? (
                <div><label className={`block mb-1 ${theme.textSecondary}`}>Preço fixo (R$)</label><input type="number" step="0.01" value={formPrecoFixo} onChange={(e) => setFormPrecoFixo(parseFloat(e.target.value) || 0)} className={inputCls} /></div>
              ) : (
                <div>
                  <label className={`block mb-1 ${theme.textSecondary}`}>Preços por pessoas (R$)</label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {Array.from({ length: formMaxPessoas }).map((_, idx) => {
                      const q = idx + 1;
                      return <div key={q}><label className={`block mb-1 ${theme.textSecondary} text-xs`}>{q} pessoa{q > 1 ? 's' : ''}</label><input type="number" step="0.01" value={formPrecosOcupacao[q] || 0} onChange={(e) => setFormPrecosOcupacao((p) => ({ ...p, [q]: parseFloat(e.target.value) || 0 }))} className={inputCls} /></div>;
                    })}
                  </div>
                </div>
              )}
              <div className={`border-t ${theme.divider} pt-3`}>
                <label className={`block mb-2 ${theme.textSecondary}`}>Day Use</label>
                <label className="flex items-center gap-2 mb-2 cursor-pointer"><input type="checkbox" checked={formDayUseAtivo} onChange={(e) => setFormDayUseAtivo(e.target.checked)} className="w-4 h-4 accent-violet-500" /><span className={theme.text}>Ativar day use nesta categoria</span></label>
                {formDayUseAtivo && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                    <div><label className={`block mb-1 ${theme.textSecondary} text-xs`}>Preço base (R$)</label><input type="number" step="0.01" value={formDayUsePrecoFixo} onChange={(e) => setFormDayUsePrecoFixo(parseFloat(e.target.value) || 0)} className={inputCls} /></div>
                    <div><label className={`block mb-1 ${theme.textSecondary} text-xs`}>Hora adicional (R$)</label><input type="number" step="0.01" value={formDayUsePrecoAdicional} onChange={(e) => setFormDayUsePrecoAdicional(parseFloat(e.target.value) || 0)} className={inputCls} /></div>
                  </div>
                )}
              </div>
              <div className={`border-t ${theme.divider} pt-3`}>
                <label className={`block mb-2 ${theme.textSecondary}`}>Ativar sazonalidades</label>
                {seasonalDefinitions.length === 0 ? <p className={`${theme.textSecondary} text-xs`}>Nenhuma sazonalidade cadastrada.</p> : (
                  <div className="space-y-2">
                    {seasonalDefinitions.map((s) => (
                      <label key={s.id} className="flex items-start gap-2 cursor-pointer">
                        <input type="checkbox" checked={formSazonaisAtivas.includes(s.id)} onChange={() => toggleSeasonalAtiva(s.id)} className="w-4 h-4 accent-violet-500 mt-0.5" />
                        <div>
                          <span className={`${theme.text} text-xs font-semibold flex items-center gap-1`}>
                            {s.modoOperacao === 'recorrencia' ? <RefreshCw className="w-3 h-3 text-sky-400" /> : <Calendar className="w-3 h-3 text-amber-400" />}
                            {s.nome}
                          </span>
                          <p className={`${theme.textSecondary} text-[11px]`}>{describeSchedule(s)}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className={`p-4 border-t ${theme.divider} flex gap-2`}>
              <button onClick={() => setShowCategoryModal(false)} className={`flex-1 px-4 py-2 ${theme.button} ${theme.text} rounded-lg border text-sm font-medium hover:scale-105 active:scale-95 transition-all`}>Cancelar</button>
              <button onClick={handleSaveCategory} className="flex-1 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-medium hover:scale-105 active:scale-95 transition-all">Salvar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Sazonalidade ── */}
      {showSeasonalFormModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className={`${theme.card} rounded-xl border shadow-2xl max-w-3xl w-full my-8`}>
            <div className={`p-4 border-b ${theme.divider} flex items-center justify-between`}>
              <h3 className={`text-lg font-bold ${theme.text}`}>{editingSeasonal ? 'Editar sazonalidade' : 'Nova sazonalidade'}</h3>
              <button onClick={() => setShowSeasonalFormModal(false)} className={`${theme.textSecondary} hover:scale-110 active:scale-90 transition-transform`}><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-4 text-sm max-h-[75vh] overflow-y-auto">

              {/* Nome + Máx. pessoas */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div><label className={`block mb-1 ${theme.textSecondary}`}>Nome *</label><input type="text" value={sNome} onChange={(e) => setSNome(e.target.value)} className={inputCls} placeholder="Ex: Alta Temporada Verão" /></div>
                <div><label className={`block mb-1 ${theme.textSecondary}`}>Máx. pessoas</label><input type="number" min={1} max={10} value={sMaxPessoas} onChange={(e) => handleSeasonalMaxPessoasChange(parseInt(e.target.value, 10))} className={inputCls} /></div>
              </div>
              <div><label className={`block mb-1 ${theme.textSecondary}`}>Descrição</label><textarea rows={2} value={sDescricao} onChange={(e) => setSDescricao(e.target.value)} className={`${inputCls} resize-none`} /></div>

              {/* ── Seletor de Modo ── */}
              <div>
                <label className={`block mb-2 ${theme.textSecondary} font-medium`}>Modo de operação *</label>
                <div className="flex gap-2">
                  <ModoTab value="data-especifica" label="Data Específica"  icon={Calendar}   current={sModo} onChange={setSModo} />
                  <ModoTab value="recorrencia"     label="Recorrência"      icon={RefreshCw}  current={sModo} onChange={setSModo} />
                </div>
              </div>

              {/* ── Data Específica ── */}
              {sModo === 'data-especifica' && (
                <div className={`${theme.card} rounded-lg border p-3 space-y-3`}>
                  <p className={`text-xs ${theme.textSecondary}`}>Período com data de início e fim definidos.</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className={`block mb-1 ${theme.textSecondary} text-xs`}>Data início</label><input type="date" value={sDataInicio} onChange={(e) => setSDataInicio(e.target.value)} className={inputCls} /></div>
                    <div><label className={`block mb-1 ${theme.textSecondary} text-xs`}>Hora check-in</label><input type="time" value={sHoraInicio} onChange={(e) => setSHoraInicio(e.target.value)} className={inputCls} /></div>
                    <div><label className={`block mb-1 ${theme.textSecondary} text-xs`}>Data fim</label><input type="date" value={sDataFim} onChange={(e) => setSDataFim(e.target.value)} className={inputCls} /></div>
                    <div><label className={`block mb-1 ${theme.textSecondary} text-xs`}>Hora check-out</label><input type="time" value={sHoraFim} onChange={(e) => setSHoraFim(e.target.value)} className={inputCls} /></div>
                  </div>
                </div>
              )}

              {/* ── Recorrência ── */}
              {sModo === 'recorrencia' && (
                <div className={`${theme.card} rounded-lg border p-3 space-y-3`}>
                  <p className={`text-xs ${theme.textSecondary}`}>Aplica-se automaticamente a cada ciclo de tempo definido.</p>
                  <div>
                    <label className={`block mb-1 ${theme.textSecondary} text-xs`}>Frequência *</label>
                    <div className="flex flex-wrap gap-2">
                      {RECORRENCIAS.map((r) => (
                        <button key={r} type="button" onClick={() => setSRecorrencia(r)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${sRecorrencia === r ? 'bg-sky-600 text-white border-sky-400' : `${theme.button} ${theme.text}`}`}>
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Dias da semana — só aparece em Semanal */}
                  {sRecorrencia === 'Semanal' && (
                    <div>
                      <label className={`block mb-1 ${theme.textSecondary} text-xs`}>Dias da semana *</label>
                      <div className="flex flex-wrap gap-2">
                        {DIAS_SEMANA.map((dia, idx) => (
                          <button key={idx} type="button" onClick={() => toggleDiaSemana(idx)}
                            className={`w-11 h-9 rounded-lg text-xs font-medium border transition-all ${sDiasSemana.includes(idx) ? 'bg-sky-600 text-white border-sky-400' : `${theme.button} ${theme.text}`}`}>
                            {dia}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Horário do ciclo */}
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className={`block mb-1 ${theme.textSecondary} text-xs`}>Hora início do ciclo</label><input type="time" value={sHoraInicioRec} onChange={(e) => setSHoraInicioRec(e.target.value)} className={inputCls} /></div>
                    <div><label className={`block mb-1 ${theme.textSecondary} text-xs`}>Hora fim do ciclo</label><input type="time" value={sHoraFimRec} onChange={(e) => setSHoraFimRec(e.target.value)} className={inputCls} /></div>
                  </div>
                </div>
              )}

              {/* Modelo de cobrança */}
              <div><label className={`block mb-1 ${theme.textSecondary}`}>Modelo de cobrança</label>
                <select value={sModeloCobranca} onChange={(e) => handleSeasonalModeloCobrancaChange(e.target.value)} className={inputCls}>
                  <option>Por ocupação</option><option>Por quarto (tarifa fixa)</option>
                </select>
              </div>

              {sModeloCobranca === 'Por quarto (tarifa fixa)' ? (
                <div><label className={`block mb-1 ${theme.textSecondary}`}>Preço fixo (R$)</label><input type="number" step="0.01" value={sPrecoFixo} onChange={(e) => setSPrecoFixo(parseFloat(e.target.value) || 0)} className={inputCls} /></div>
              ) : (
                <div>
                  <label className={`block mb-1 ${theme.textSecondary}`}>Preços por pessoas (R$)</label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {Array.from({ length: sMaxPessoas }).map((_, idx) => {
                      const q = idx + 1;
                      return <div key={q}><label className={`block mb-1 ${theme.textSecondary} text-xs`}>{q} pax</label><input type="number" step="0.01" value={sPrecosOcupacao[q] || 0} onChange={(e) => setSPrecosOcupacao((p) => ({ ...p, [q]: parseFloat(e.target.value) || 0 }))} className={inputCls} /></div>;
                    })}
                  </div>
                </div>
              )}

              {/* Day Use sazonal */}
              <div className={`border-t ${theme.divider} pt-3`}>
                <label className={`block mb-2 ${theme.textSecondary}`}>Day Use</label>
                <label className="flex items-center gap-2 mb-2 cursor-pointer"><input type="checkbox" checked={sDayUseAtivo} onChange={(e) => setSDayUseAtivo(e.target.checked)} className="w-4 h-4 accent-violet-500" /><span className={theme.text}>Ativar day use nesta sazonalidade</span></label>
                {sDayUseAtivo && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                    <div><label className={`block mb-1 ${theme.textSecondary} text-xs`}>Preço base (R$)</label><input type="number" step="0.01" value={sDayUsePreco} onChange={(e) => setSDayUsePreco(parseFloat(e.target.value) || 0)} className={inputCls} /></div>
                    <div><label className={`block mb-1 ${theme.textSecondary} text-xs`}>Hora adicional (R$)</label><input type="number" step="0.01" value={sDayUsePrecoAd} onChange={(e) => setSDayUsePrecoAd(parseFloat(e.target.value) || 0)} className={inputCls} /></div>
                  </div>
                )}
              </div>
            </div>

            <div className={`p-4 border-t ${theme.divider} flex gap-2`}>
              <button onClick={() => setShowSeasonalFormModal(false)} className={`flex-1 px-4 py-2 ${theme.button} ${theme.text} rounded-lg border text-sm font-medium hover:scale-105 active:scale-95 transition-all`}>Cancelar</button>
              <button onClick={handleSaveSeasonal} className="flex-1 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-medium hover:scale-105 active:scale-95 transition-all">Salvar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Permissões ── */}
      {showPermissionsModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`${theme.card} rounded-xl border shadow-2xl max-w-md w-full`}>
            <div className={`p-4 border-b ${theme.divider} flex items-center justify-between`}>
              <div className="flex items-center gap-2"><Shield className="w-5 h-5 text-violet-500" /><h3 className={`text-lg font-bold ${theme.text}`}>Permissões de Preços</h3></div>
              <button onClick={() => setShowPermissionsModal(false)} className={`${theme.textSecondary} hover:scale-110 active:scale-90 transition-transform`}><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-2">
              {[
                { key:'acessoTotal',           label:'🔓 Acesso Total',             desc:'Libera todas as funções'           },
                { key:'dashboard',             label:'📊 Dashboard',               desc:'Ver visão geral de preços'         },
                { key:'adicionarCategoria',    label:'➕ Adicionar Categoria',      desc:'Criar novas categorias de preço'  },
                { key:'editarCategoria',       label:'✏️ Editar Categoria',         desc:'Alterar dados de uma categoria'   },
                { key:'cadastrarSazonalidade', label:'📅 Cadastrar Sazonalidade',   desc:'Criar novos períodos sazonais'    },
                { key:'alterarSazonalidade',   label:'🔁 Alterar Sazonalidade',     desc:'Editar/remover sazonalidades'     },
              ].map(({ key, label, desc }) => (
                <label key={key} className={`flex items-center gap-3 cursor-pointer p-2.5 rounded-lg ${theme.cardHover} transition-colors`}>
                  <input type="checkbox" checked={permissions[key]} onChange={() => togglePermission(key)} className="w-4 h-4 rounded accent-violet-500" />
                  <div className="flex-1"><span className={`${theme.text} font-medium text-sm block`}>{label}</span><span className={`${theme.textSecondary} text-xs`}>{desc}</span></div>
                  {permissions[key] && <Check className="w-4 h-4 text-emerald-400" />}
                </label>
              ))}
            </div>
            <div className={`p-4 border-t ${theme.divider}`}>
              <button onClick={() => setShowPermissionsModal(false)} className="w-full px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-medium hover:scale-105 active:scale-95 transition-all">Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {/* Notificação */}
      {notification && (
        <div className="fixed top-4 right-4 z-[110] animate-slideIn">
          <div className={`${notification.type === 'success' ? 'bg-emerald-500' : notification.type === 'error' ? 'bg-rose-500' : notification.type === 'warning' ? 'bg-amber-500' : 'bg-slate-700'} text-white px-6 py-3 rounded-lg flex items-center gap-3`}>
            <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
            <span className="font-medium text-sm">{notification.message}</span>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes slideIn { from { opacity:0; transform:translateX(100%); } to { opacity:1; transform:translateX(0); } }
        .animate-slideIn { animation: slideIn 0.3s ease-out; }
        select option { background: ${isDark ? '#1e293b' : '#ffffff'}; color: ${isDark ? 'white' : '#0f172a'}; }
        input[type="date"]::-webkit-calendar-picker-indicator,
        input[type="time"]::-webkit-calendar-picker-indicator { filter: ${isDark ? 'invert(1)' : 'none'}; }
      `}</style>
    </div>
  );
}
