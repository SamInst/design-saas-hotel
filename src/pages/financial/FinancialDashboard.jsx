import { useState, useEffect, useRef } from 'react';
import {
  CreditCard, Calendar, Filter, Search, ChevronLeft, ChevronRight, Plus, Edit2,
  Wallet, Banknote, Smartphone, Building2, Clock, ArrowRight,
  ArrowUpRight, ArrowDownRight, TrendingUp, TrendingDown,
  Loader2, AlertCircle, Download, Tag, X, History, User, FileText, LayoutDashboard,
} from 'lucide-react';

import { Button }           from '../../components/ui/Button';
import { Modal }            from '../../components/ui/Modal';
import { Input, Select, FormField } from '../../components/ui/Input';
import { Notification }     from '../../components/ui/Notification';
import { DatePicker }       from '../../components/ui/DatePicker';
import { PaymentModal }     from '../../components/ui/PaymentModal';
import { relatorioApi, enumApi, quartoApi, funcionarioApi, arquivoApi } from '../../services/api';
import { usePermissions } from '../../hooks/usePermissions';
import { relatorioDiaPdf, relatorioFiltroPdf } from './financeiroReport';
import { ComparativoBarras } from './FinanceCharts';

import icoPix           from '../../assets/pagamento/pix.png';
import icoCartao        from '../../assets/pagamento/cartao.png';
import icoDinheiro      from '../../assets/pagamento/dinheiro.png';
import icoTransferencia from '../../assets/pagamento/transferencia.png';
import icoLink          from '../../assets/pagamento/link.png';
import icoBoleto        from '../../assets/pagamento/boleto.png';

import styles from './FinancialDashboard.module.css';
import { tr, locale } from '../../i18n';

// ─── Money helpers ─────────────────────────────────────────────

const fmt = (v) =>
  Number(v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// ─── Icon por forma de pagamento ───────────────────────────────
function PayMethodIcon({ descricao = '', size = 15, className = '' }) {
  const d = (descricao ?? '').toUpperCase();
  const p = { size, className };
  if (d.includes('PIX'))                              return <Smartphone  {...p} />;
  if (d.includes('CREDITO') || d.includes('CRÉDITO')) return <CreditCard  {...p} />;
  if (d.includes('DEBITO')  || d.includes('DÉBITO'))  return <CreditCard  {...p} />;
  if (d.includes('DINHEIRO'))                         return <Banknote    {...p} />;
  if (d.includes('NUBANK'))                           return <Smartphone  {...p} />;
  if (d.includes('TRANSFER'))                         return <Building2   {...p} />;
  if (d.includes('PENDENTE'))                         return <Clock       {...p} />;
  return <Wallet {...p} />;
}

// Ícone do filtro — o mesmo SVG da tela de Cadastros; herda a cor do botão.
function FilterIcon({ size = 16 }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 487 511.954"
      fill="currentColor" fillRule="evenodd" clipRule="evenodd"
      shapeRendering="geometricPrecision"
      aria-hidden="true" focusable="false"
    >
      <path fillRule="nonzero" d="M0 52.894h146.098a70.42 70.42 0 0118.388-32.26C177.18 7.874 194.783 0 214.13 0c19.37 0 36.95 7.874 49.645 20.569s20.569 30.275 20.569 49.644c0 19.348-7.874 36.95-20.569 49.645-12.76 12.673-30.319 20.569-49.645 20.569-19.282 0-36.884-7.896-49.579-20.569-8.79-8.812-15.29-19.936-18.453-32.326H0V52.894zm392.096 201.698a35.528 35.528 0 00-10.404-25.172 35.526 35.526 0 00-25.172-10.404 35.562 35.562 0 00-25.171 10.404c-6.413 6.369-10.404 15.334-10.404 25.172 0 9.837 3.991 18.802 10.382 25.193 6.391 6.391 15.356 10.382 25.193 10.382 9.837 0 18.802-3.991 25.193-10.382a35.728 35.728 0 0010.383-25.193zm14.069-49.645a70.26 70.26 0 0118.409 32.326h62.405v34.637h-62.405a70.366 70.366 0 01-18.409 32.326c-12.761 12.673-30.319 20.569-49.645 20.569-19.282 0-36.884-7.896-49.579-20.569-12.738-12.76-20.634-30.362-20.634-49.644 0-19.326 7.896-36.885 20.569-49.58 12.694-12.76 30.297-20.634 49.644-20.634 19.369 0 36.95 7.874 49.645 20.569zM260.11 271.91H0v-34.637h260.11v34.637zM67.007 424.421a70.414 70.414 0 0118.388-32.26c12.694-12.76 30.297-20.634 49.644-20.634 19.369 0 36.95 7.874 49.645 20.569 12.694 12.694 20.569 30.275 20.569 49.644 0 19.347-7.875 36.95-20.569 49.645-12.76 12.672-30.319 20.569-49.645 20.569-19.282 0-36.884-7.897-49.579-20.569-8.79-8.813-15.29-19.937-18.453-32.326H0v-34.638h67.007zm42.839-7.852c-6.391 6.369-10.382 15.334-10.382 25.171s3.991 18.802 10.382 25.193c6.391 6.391 15.356 10.383 25.193 10.383 9.838 0 18.803-3.992 25.193-10.383a35.728 35.728 0 0010.383-25.193 35.525 35.525 0 00-35.576-35.576 35.654 35.654 0 00-25.193 10.405zm121.603 7.852h255.508v34.638H231.449v-34.638zM188.937 45.042c-6.391 6.369-10.382 15.334-10.382 25.171 0 9.838 3.991 18.802 10.382 25.193 6.391 6.391 15.356 10.383 25.193 10.383 9.838 0 18.802-3.992 25.193-10.383a35.725 35.725 0 0010.383-25.193 35.524 35.524 0 00-35.576-35.575 35.653 35.653 0 00-25.193 10.404zm121.603 7.852H487v34.638H310.54V52.894z" />
    </svg>
  );
}

// Mesmos ícones do histórico de hospedagem (Cadastros). Pendente fica com o relógio.
const imgPagamento = (desc) => {
  const d = (desc ?? '').toUpperCase();
  if (d.includes('PENDENTE')) return null;
  return d.includes('PIX') ? icoPix
    : /CART|CR[EÉ]DITO|D[EÉ]BITO/.test(d) ? icoCartao
    : /DINHEIRO|ESP[EÉ]CIE/.test(d) ? icoDinheiro
    : /TRANSFER|TED|DOC|NUBANK/.test(d) ? icoTransferencia
    : /LINK/.test(d) ? icoLink
    : icoBoleto;
};

const accentOf = (d = '') => {
  const u = (d ?? '').toUpperCase();
  if (u.includes('PIX'))      return 'sky';
  if (u.includes('CREDITO') || u.includes('CRÉDITO')) return 'violet';
  if (u.includes('DEBITO')  || u.includes('DÉBITO'))  return 'indigo';
  if (u.includes('DINHEIRO')) return 'emerald';
  if (u.includes('NUBANK'))   return 'fuchsia';
  if (u.includes('TRANSFER')) return 'amber';
  if (u.includes('PENDENTE')) return 'slate';
  return 'violet';
};

const ACCENT_HEX = {
  sky: '#1b9a8c', violet: '#5b5bd6', indigo: '#3a7bc8', emerald: '#2f8a57',
  fuchsia: '#9046c4', amber: '#c08a1e', slate: '#8a94a6',
};
const methodColor = (m) => ACCENT_HEX[accentOf(m)] ?? '#7c3aed';

// Datas do back-end chegam como dd/mm/aaaa (dia) e dd/mm/aaaa hh:mm (lançamento).
const parseDia  = (s) => { const [d, m, y] = (s ?? '').split('/').map(Number); return new Date(y, (m || 1) - 1, d || 1); };
const diaSemana = (s) => parseDia(s).toLocaleDateString(locale(), { weekday: 'long' });
const dataLonga = (s) => parseDia(s).toLocaleDateString(locale(), { day: 'numeric', month: 'long', year: 'numeric' });
const horaDe = (s) => (s ?? '').split(' ')[1] ?? '—';

// Campo da ficha — mesmo desenho dos dados cadastrais em Cadastros.
function Field({ label, value, mono = false, className = '' }) {
  return (
    <div>
      <p className={styles.fLabel}>{label}</p>
      <p className={[styles.fVal, mono ? styles.fMono : '', className].join(' ')}>{value || '—'}</p>
    </div>
  );
}

const fmtQuarto = (q) => tr('Quarto {{id}} - {{descricao}}', { id: q.id, descricao: q.descricao });

// ─────────────────────────────────────────────────────────────
export default function FinancialDashboard() {
  const { can, loggedUser } = usePermissions();

  const canNovoLancamento  = can('FINANCEIRO', 'NOVO RELATORIO');
  const canEditar          = can('FINANCEIRO', 'EDITAR RELATORIO');
  const canEditarPagamento = can('FINANCEIRO', 'EDITAR PAGAMENTO');
  const canFiltros         = can('FINANCEIRO', 'FILTROS');
  const canHistoricoSaldo  = can('FINANCEIRO', 'HISTORICO DO FLUXO DE CAIXA');
  const canDashboard       = can('FINANCEIRO', 'DASHBOARD');
  const canValorParcial    = can('FINANCEIRO', 'ACESSO AO CARD DE DINHEIRO');
  const canValorTotalDia   = can('FINANCEIRO', 'RECEITAS DO DIA');

  const [grupos,         setGrupos]         = useState([]);
  const [pagamentos,     setPagamentos]     = useState({});
  const [tiposPagamento, setTiposPagamento] = useState([]);
  const [quartos,        setQuartos]        = useState([]);
  const [funcionarios,   setFuncionarios]   = useState([]);
  const [loadingData,    setLoadingData]    = useState(true);
  const [isSubmitting,   setIsSubmitting]   = useState(false);
  const [notification,   setNotification]   = useState(null);
  const [searchTerm,     setSearchTerm]     = useState('');
  const [selDay,         setSelDay]         = useState(null);
  const [showFormas,     setShowFormas]     = useState(false);
  const [isDesktop,      setIsDesktop]      = useState(() => window.matchMedia('(min-width: 1024px)').matches);
  const [activeFilters,  setActiveFilters]  = useState({});
  const [abaLanc,        setAbaLanc]        = useState('dados');

  // modais
  const [showPaymentAdd,  setShowPaymentAdd]  = useState(false);
  const [showFilter,      setShowFilter]      = useState(false);
  const [showDetail,      setShowDetail]      = useState(false);
  const [showEdit,        setShowEdit]        = useState(false);
  const [showPaymentEdit, setShowPaymentEdit] = useState(false);
  const [item,            setItem]            = useState(null);

  // histórico de alterações do lançamento aberto
  const [historico,   setHistorico]   = useState([]);
  const [loadingHist, setLoadingHist] = useState(false);

  // form add — o tipo é definido pelo botão (Receita/Despesa)
  const [addTipoRegistro, setAddTipoRegistro] = useState('ENTRADA');

  // form edit
  const [editTipoRegistro, setEditTipoRegistro] = useState('ENTRADA');
  const [editQuarto,       setEditQuarto]       = useState('');
  const [editPessoal,      setEditPessoal]      = useState(false);
  const [editPagamento,    setEditPagamento]    = useState(null);

  // filtros
  const [fStart,   setFStart]   = useState(null);
  const [fEnd,     setFEnd]     = useState(null);
  const [fValores, setFValores] = useState('');
  const [fPagId,   setFPagId]   = useState('');
  const [fQuarto,  setFQuarto]  = useState('');
  const [fFuncId,  setFFuncId]  = useState('');

  const showNotif = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };
  const toApiDate = (d) => d ? d.toISOString().split('T')[0] : undefined;

  useEffect(() => {
    // só carrega dados auxiliares quando o usuário tem permissão de usá-los
    if (canNovoLancamento || canEditar || canEditarPagamento || canFiltros) {
      enumApi.tipoPagamento().then(setTiposPagamento).catch(() => {});
    }
    if (canNovoLancamento || canEditar || canFiltros) {
      quartoApi.listar({ size: 900 }).then(r => setQuartos(r?.content ?? [])).catch(() => {});
    }
    if (canFiltros) {
      funcionarioApi.listar({ size: 200, page: 0 }).then(r => setFuncionarios(r?.content ?? [])).catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchData = async (filters = {}) => {
    setLoadingData(true);
    try {
      const res = await relatorioApi.listar({ size: 200, ...filters });
      setGrupos(res?.page?.content ?? []);
      setPagamentos(res?.pagamentos ?? {});
    } catch {
      showNotif(tr('Erro ao carregar lançamentos.'), 'error');
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => { fetchData(); }, []);
  // Filtro flutuante: fecha ao clicar fora (o calendário do período abre
  // fora da página, num portal, então cliques lá não contam).
  const pageRef   = useRef(null);
  const filtroRef = useRef(null);
  useEffect(() => {
    if (!showFilter) return;
    const fora = (e) => {
      if (filtroRef.current?.contains(e.target)) return;
      if (!pageRef.current?.contains(e.target)) return;
      setShowFilter(false);
    };
    const esc = (e) => { if (e.key === 'Escape') setShowFilter(false); };
    document.addEventListener('mousedown', fora);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', fora); document.removeEventListener('keydown', esc); };
  }, [showFilter]);

  const abriuDashboard = useRef(false);
  useEffect(() => {
    if (abriuDashboard.current || !canDashboard || !isDesktop) return;
    abriuDashboard.current = true;
    setShowFormas(true);
  }, [canDashboard, isDesktop]);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const on = (e) => setIsDesktop(e.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  // ── ADD ───────────────────────────────────────────────────
  const abrirNovo = (tipo) => { setShowFormas(false); setShowDetail(false); setAddTipoRegistro(tipo); setShowPaymentAdd(true); };
  const openNovaReceita = () => abrirNovo('ENTRADA');
  const openNovaDespesa = () => abrirNovo('SAIDA');

  // Cria o lançamento direto a partir do PaymentModal (modal único)
  const handleAddFromPayment = async (pag) => {
    setIsSubmitting(true);
    try {
      const sign  = addTipoRegistro === 'SAIDA' ? -1 : 1;
      const valor = Math.abs(pag.valor) * sign;
      const { _arquivo, _arquivoRemov, _quarto, _despesaInterna, ...pagamentoBody } = pag;
      const relatorio = pagamentoBody.descricao?.trim() || null;
      const desconto  = pagamentoBody.desconto
        ? {
            ...(pagamentoBody.desconto._uuid ? { id: pagamentoBody.desconto._uuid } : {}),
            funcionario: { id: loggedUser?.id },
            porcentagem: pagamentoBody.desconto.porcentagem,
            valor:       pagamentoBody.desconto.valor,
          }
        : undefined;
      const body = {
        funcionario:     { id: loggedUser?.id },
        relatorio,
        tipo_registro:   addTipoRegistro,
        despesa_pessoal: !!_despesaInterna,
        pagamento:       { ...pagamentoBody, valor, funcionario: { id: loggedUser?.id }, desconto },
        ...(_quarto ? { quarto: { id: Number(_quarto) } } : {}),
      };
      await relatorioApi.criar(body, _arquivo ?? null);
      showNotif(tr('Lançamento adicionado!'));
      fetchData(activeFilters);
    } catch (e) {
      showNotif(e.message || tr('Erro ao adicionar.'), 'error');
    } finally {
      setIsSubmitting(false);
      setShowPaymentAdd(false);
    }
  };

  // ── EDIT ──────────────────────────────────────────────────
  const handleEdit = async () => {
    if (!item) return;
    setIsSubmitting(true);
    try {
      const sign  = editTipoRegistro === 'SAIDA' ? -1 : 1;
      const valor = Math.abs(editPagamento?.valor ?? 0) * sign;
      const { _arquivo: _arqEdit, _arquivoRemov: _remov, ...editPagamentoBody } = editPagamento ?? {};
      const descricao = editPagamentoBody.descricao?.trim() || null;
      const descontoId = editPagamentoBody.desconto?._uuid ?? editPagamentoBody.desconto?.uuid;
      const desconto  = editPagamentoBody.desconto
        ? {
            ...(descontoId ? { uuid: descontoId } : {}),
            pagamento:   { uuid: editPagamentoBody.uuid },
            funcionario: { id: loggedUser?.id },
            porcentagem: editPagamentoBody.desconto.porcentagem,
            valor:       editPagamentoBody.desconto.valor,
          }
        : undefined;
      const body = {
        id:              item.id,
        descricao,
        despesa_pessoal: editPessoal,
        pagamento:       editPagamento
          ? { ...editPagamentoBody, valor, funcionario: { id: loggedUser?.id }, desconto }
          : undefined,
        ...(editQuarto ? { quarto: { id: Number(editQuarto) } } : {}),
      };
      await relatorioApi.atualizar(body, _arqEdit ?? null);
      setShowEdit(false);
      showNotif(tr('Lançamento editado!'));
      fetchData(activeFilters);
    } catch (e) {
      showNotif(e.message || tr('Erro ao editar.'), 'error');
    } finally { setIsSubmitting(false); }
  };

  const openDetail = (t) => {
    setItem(t);
    setAbaLanc('dados');
    setShowPaymentAdd(false);
    setShowDetail(true);
    setHistorico([]);
    setLoadingHist(true);
    relatorioApi.historico(t.id)
      .then(h => setHistorico(Array.isArray(h) ? h : []))
      .catch(() => setHistorico([]))
      .finally(() => setLoadingHist(false));
  };
  const openEdit   = async () => {
    if (!item) return;
    let full = item;
    try { full = await relatorioApi.buscar(item.id); } catch (_) { /* usa item parcial */ }
    setEditTipoRegistro(full.valor >= 0 ? 'ENTRADA' : 'SAIDA');
    setEditQuarto(String(full.quarto?.id ?? ''));
    setEditPessoal(full.despesa_pessoal ?? false);
    setEditPagamento(full.pagamento ?? null);
    setShowDetail(false);
    setShowEdit(true);
  };

  // ── FILTROS ───────────────────────────────────────────────
  const applyFilter = () => {
    const f = {};
    if (fStart)   f.data_inicio       = toApiDate(fStart);
    if (fEnd)     f.data_fim          = toApiDate(fEnd);
    if (fValores) f.registro          = fValores;
    if (fPagId)   f.tipo_pagamento_id = Number(fPagId);
    if (fQuarto)  f.quarto_id         = Number(fQuarto);
    if (fFuncId)  f.funcionario_id    = Number(fFuncId);
    setActiveFilters(f);
    setSelDay(null);
    setShowFilter(false);
    fetchData(f);
  };

  const clearFilter = () => {
    setFStart(null); setFEnd(null); setFValores(''); setFPagId(''); setFQuarto(''); setFFuncId('');
    setActiveFilters({});
    setSelDay(null);
    setShowFilter(false);
    fetchData();
  };

  // ── RESUMO ────────────────────────────────────────────────
  const total = pagamentos?.TOTAL ?? { receitas: 0, despesas: 0, lucro: 0 };
  const methodEntries = Object.entries(pagamentos).filter(([k]) => k !== 'TOTAL');

  // Rótulo do período (usa o filtro; sem filtro mostra a data de hoje)
  const brDate = (iso) => {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  };
  const periodoLabel = (() => {
    const totalTx = methodEntries.reduce((acc, [, v]) => acc + (v.amount ?? 0), 0);
    const totalTxLabel = tr('Total de transações: {{totalTx}}', { totalTx });
    const ini = activeFilters.data_inicio;
    const fim = activeFilters.data_fim;
    let periodo = '';
    if (ini && fim)   periodo = ini === fim ? brDate(ini) : `${brDate(ini)} – ${brDate(fim)}`;
    else if (ini)     periodo = tr('A partir de {{data}}', { data: brDate(ini) });
    else if (fim)     periodo = tr('Até {{data}}', { data: brDate(fim) });
    return periodo ? `${totalTxLabel} · ${periodo}` : totalTxLabel;
  })();
  // Mesmo dado, sem o separador com ponto: só o período, ou a contagem quando não há período.
  const periodoTexto = (() => {
    const ini = activeFilters.data_inicio;
    const fim = activeFilters.data_fim;
    if (ini && fim) return ini === fim ? brDate(ini) : tr('de {{ini}} a {{fim}}', { ini: brDate(ini), fim: brDate(fim) });
    if (ini) return tr('A partir de {{data}}', { data: brDate(ini) });
    if (fim) return tr('Até {{data}}', { data: brDate(fim) });
    const n = methodEntries.reduce((acc, [, v]) => acc + (v.amount ?? 0), 0);
    return n === 1 ? tr('1 lançamento') : tr('{{n}} lançamentos', { n });
  })();


  // ── BUSCA LOCAL ───────────────────────────────────────────
  const visibleGrupos = grupos.map(g => ({
    ...g,
    _items: (g.relatorios ?? []).filter(t =>
      !searchTerm ||
      (t.relatorio ?? '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.pagamento?.nome_pagador ?? '').toLowerCase().includes(searchTerm.toLowerCase())
    ),
  })).filter(g => g._items.length > 0);

  const nFilters = Object.keys(activeFilters).length;

  // ── RELATÓRIOS PDF ────────────────────────────────────────
  const filtrosResumo = () => {
    const parts = [];
    if (activeFilters.data_inicio || activeFilters.data_fim) {
      parts.push({ type: 'periodo', label: tr('Período'), value: `${activeFilters.data_inicio ? brDate(activeFilters.data_inicio) : '…'} a ${activeFilters.data_fim ? brDate(activeFilters.data_fim) : '…'}` });
    }
    if (activeFilters.registro) {
      parts.push({ type: 'registro', label: tr('Tipo'), value: activeFilters.registro === 'ENTRADA' ? tr('Entradas') : tr('Saídas') });
    }
    if (activeFilters.tipo_pagamento_id) {
      const tp = tiposPagamento.find(t => t.id === activeFilters.tipo_pagamento_id);
      parts.push({ type: 'pagamento', label: tr('Pagamento'), value: tp?.descricao ?? activeFilters.tipo_pagamento_id });
    }
    if (activeFilters.quarto_id) {
      const q = quartos.find(x => x.id === activeFilters.quarto_id);
      parts.push({ type: 'quarto', label: tr('Quarto'), value: q ? fmtQuarto(q) : activeFilters.quarto_id });
    }
    if (activeFilters.funcionario_id) {
      const f = funcionarios.find(x => x.id === activeFilters.funcionario_id);
      parts.push({ type: 'funcionario', label: tr('Funcionário'), value: f?.pessoa?.nome ?? activeFilters.funcionario_id });
    }
    return parts;
  };
  // Remove um único filtro (mantém os demais) e recarrega
  const removeFiltro = (type) => {
    const f = { ...activeFilters };
    switch (type) {
      case 'periodo':     delete f.data_inicio; delete f.data_fim; setFStart(null); setFEnd(null); break;
      case 'registro':    delete f.registro;          setFValores(''); break;
      case 'pagamento':   delete f.tipo_pagamento_id; setFPagId('');   break;
      case 'quarto':      delete f.quarto_id;         setFQuarto('');  break;
      case 'funcionario': delete f.funcionario_id;    setFFuncId('');  break;
      default: break;
    }
    setActiveFilters(f);
    setSelDay(null);
    fetchData(f);
  };

  // O PDF reproduz a tela: mesmos grupos visíveis (busca aplicada) e as mesmas
  // seções que a permissão do usuário libera.
  const permissoesRelatorio = {
    saldo:     canHistoricoSaldo,
    totaisDia: canValorTotalDia,
    dashboard: canDashboard,
    caixa:     canDashboard || canValorParcial,
  };
  const usuarioRelatorio = loggedUser?.pessoa?.nome ?? '';

  const baixarRelatorioFiltro = () =>
    relatorioFiltroPdf({
      grupos: visibleGrupos,
      total,
      pagamentos,
      filtros: filtrosResumo(),
      periodo: periodoLabel,
      permissoes: permissoesRelatorio,
      usuario: usuarioRelatorio,
    });

  const baixarRelatorioDia = (grupo) =>
    relatorioDiaPdf(grupo, { permissoes: permissoesRelatorio, usuario: usuarioRelatorio });

  // Helpers para exibir pagamento chips nos formulários
  const descPag = (pag) => {
    if (!pag) return null;
    const desc = tiposPagamento.find(t => t.id === pag.tipo_pagamento?.id)?.descricao
      ?? pag.tipo_pagamento?.descricao ?? '—';
    return `${desc} · ${pag.nome_pagador ?? '—'} · ${fmt(pag.valor ?? 0)}`;
  };

  // ── Dia aberto no livro-caixa ─────────────────────────────
  const diaAberto = visibleGrupos.find(g => g.data === selDay) ?? null;

  // No desktop, sem dia escolhido, abre o mais recente.
  useEffect(() => {
    if (!isDesktop || loadingData) return;
    if (!diaAberto && visibleGrupos.length) setSelDay(visibleGrupos[0].data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDesktop, loadingData, grupos, searchTerm]);

  const abrirDia = (data) => { setShowFormas(false); setShowDetail(false); setShowPaymentAdd(false); setSelDay(data); };
  const abrirFormas = () => { setShowDetail(false); setShowPaymentAdd(false); setShowFormas(true); };

  const valorFinal = (t) => {
    const bruto = Math.abs(t.pagamento?.valor ?? t.valor);
    const d = t.pagamento?.desconto;
    return d ? bruto - (d.porcentagem > 0 ? bruto * (d.porcentagem / 100) : (d.valor ?? 0)) : bruto;
  };

  // Saldo do caixa ao fim do dia: o saldo em dinheiro do último lançamento do dia.
  const saldoFechamento = (g) => {
    const lista = (g.relatorios ?? []).filter(t => t.valor_historico_dinheiro != null);
    if (!lista.length) return null;
    const ultimo = lista.reduce((a, t) => (horaDe(t.data_hora_registro) > horaDe(a.data_hora_registro) ? t : a));
    return ultimo.valor_historico_dinheiro;
  };

  const verSaldoCaixa = canDashboard || canValorParcial;

  const SkLinhas = ({ n = 5 }) => (
    <div className={styles.skLista} aria-hidden="true">
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className={styles.skLinha}>
          <span className={[styles.sk, styles.skDot].join(' ')} />
          <span className={styles.skCol}>
            <span className={[styles.sk, styles.skTxt].join(' ')} style={{ width: `${70 - (i % 3) * 12}%` }} />
            <span className={[styles.sk, styles.skSub].join(' ')} />
          </span>
          <span className={[styles.sk, styles.skValor].join(' ')} />
        </div>
      ))}
    </div>
  );

  const renderCarregandoPainel = () => (
    <div className={styles.detailPanel} aria-busy="true">
      <section className={[styles.dCard, styles.fichaCard].join(' ')}>
        <div className={[styles.dCardHead, styles.fichaHead].join(' ')}>
          <span className={[styles.sk, styles.skTxt].join(' ')} style={{ width: 140 }} />
        </div>
        <div className={[styles.dCardBody, styles.fichaBody].join(' ')}>
          <div className={[styles.sk, styles.skHero].join(' ')} />
          <SkLinhas n={6} />
        </div>
      </section>
    </div>
  );

  // ── Receita por forma de pagamento (painel da direita) ─────
  const renderFormas = () => {
    const fechar = () => setShowFormas(false);
    const ini = activeFilters.data_inicio;
    const fim = activeFilters.data_fim;
    const periodoTitulo = (ini || fim) ? periodoTexto : tr('Todos os dias listados');
    const saldoCx = verSaldoCaixa && grupos.length ? saldoFechamento(grupos[0]) : null;
    return (
      <div className={styles.detailPanel}>
        <section className={[styles.dCard, styles.fichaCard].join(' ')}>
          <h3 className={[styles.dCardHead, styles.fichaHead].join(' ')}>
            <button type="button" className={styles.backBtn} onClick={fechar}
              title={tr('Voltar para os dias')} aria-label={tr('Voltar para os dias')}>
              <ChevronLeft size={17} />
            </button>
            <LayoutDashboard size={16} />
            <span className={styles.dCardTitle}>{tr('Dashboard financeiro')}</span>
            <div className={styles.dCardActions}>
              <button type="button" className={styles.idClose} onClick={fechar}
                title={tr('Fechar')} aria-label={tr('Fechar')}>
                <X size={16} />
              </button>
            </div>
          </h3>
          <div className={[styles.dCardBody, styles.fichaBody].join(' ')}>
            {loadingData ? (<>
              <div className={[styles.sk, styles.skHero].join(' ')} />
              <SkLinhas n={5} />
            </>) : (<>
              <div className={styles.diaTopo}>
                <div className={styles.diaHero}>
                  <div className={styles.diaHeroTopo}>
                    <div className={styles.diaData}>
                      <span className={styles.diaSemana}>{tr('Período')}</span>
                      <h2 className={styles.diaNome}>{periodoTitulo}</h2>
                    </div>
                  </div>
                  <div className={styles.dashBoxes}>
                    <div className={[styles.diaCaixa, styles.boxFat].join(' ')}>
                      <span className={styles.diaCaixaRot}><ArrowUpRight size={14} /> {tr('Faturamento')}</span>
                      <span className={styles.diaCaixaVal}>{fmt(total.receitas)}</span>
                    </div>
                    <div className={[styles.diaCaixa, styles.boxDesp].join(' ')}>
                      <span className={styles.diaCaixaRot}><ArrowDownRight size={14} /> {tr('Despesas')}</span>
                      <span className={styles.diaCaixaVal}>{fmt(Math.abs(total.despesas))}</span>
                    </div>
                    <div className={[styles.diaCaixa, styles.boxLucro].join(' ')}>
                      <span className={styles.diaCaixaRot}>
                        {total.lucro < 0 ? <TrendingDown size={14} /> : <TrendingUp size={14} />} {tr('Lucro')}
                      </span>
                      <span className={[styles.diaCaixaVal, total.lucro < 0 ? styles.hOut : ''].join(' ')}>{fmt(total.lucro)}</span>
                    </div>
                    {saldoCx != null && (
                      <div className={styles.diaCaixa}>
                        <span className={styles.diaCaixaRot}><Banknote size={14} /> {tr('Saldo do caixa')}</span>
                        <span className={[styles.diaCaixaVal, saldoCx < 0 ? styles.hOut : ''].join(' ')}>{fmt(saldoCx)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className={styles.charts}>
                <ComparativoBarras entries={methodEntries} total={total.receitas} />
              </div>
              <div className={styles.reguaTit}>
                <span>{tr('Faturamento por forma de pagamento')}</span>
                <span className={styles.reguaQtd}>{periodoTexto}</span>
              </div>
              <div className={styles.tScroll}>
                <table className={styles.iTable}>
                  <thead><tr>
                    <th>{tr('Forma')}</th>
                    <th>{tr('Lançamentos')}</th>
                    <th>{tr('Faturamento')}</th>
                    <th>{tr('Despesas')}</th>
                    <th>{tr('Lucro')}</th>
                    <th>{tr('Participação')}</th>
                  </tr></thead>
                  <tbody>
                    {methodEntries.map(([m, v]) => {
                      const pct = total.receitas > 0 ? (v.receitas / total.receitas) * 100 : 0;
                      return (
                        <tr key={m}>
                          <td>
                            <span className={styles.forma} style={{ '--m': methodColor(m) }}>
                              <span className={styles.formaIco}><PayMethodIcon descricao={m} size={14} /></span>
                              <span className={styles.formaNome}>{m}</span>
                            </span>
                          </td>
                          <td className={styles.tMuted}>{v.amount ?? 0}</td>
                          <td className={styles.tValor}>{fmt(v.receitas)}</td>
                          <td className={[styles.tValor, styles.vOut].join(' ')}>{fmt(Math.abs(v.despesas ?? 0))}</td>
                          <td className={[styles.tValor, (v.lucro ?? 0) < 0 ? styles.vOut : ''].join(' ')}>{fmt(v.lucro ?? 0)}</td>
                          <td className={styles.tMuted}>{Math.round(pct)}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>)}
          </div>
        </section>
      </div>
    );
  };

  // ── Movimento do dia: extrato com linha do tempo ───────────
  const renderDia = (g) => {
    const entrada = g.total_entrada_dia ?? 0;
    const saida   = Math.abs(g.total_saida_dia ?? 0);
    const lucro   = g.lucro_total_dia ?? 0;
    const saldoCx = verSaldoCaixa ? saldoFechamento(g) : null;
    return (
      <div className={styles.detailPanel}>
        <section className={[styles.dCard, styles.fichaCard].join(' ')}>
          <h3 className={[styles.dCardHead, styles.fichaHead].join(' ')}>
            <button type="button" className={styles.backBtn} onClick={() => setSelDay(null)}
              title={tr('Voltar para os dias')} aria-label={tr('Voltar para os dias')}>
              <ChevronLeft size={17} />
            </button>
            <Calendar size={16} />
            <span className={styles.dCardTitle}>{tr('Movimento do dia')}</span>
            {canValorTotalDia && (
              <div className={styles.dCardActions}>
                <Button className={styles.btnSolid} onClick={() => baixarRelatorioDia(g)}>
                  <Download size={14} /> {tr('Relatório do dia')}
                </Button>
              </div>
            )}
          </h3>

          <div className={[styles.dCardBody, styles.fichaBody].join(' ')}>
            <div className={styles.diaTopo}>
              <div className={styles.diaHero}>
                <div className={styles.diaHeroTopo}>
                  <div className={styles.diaData}>
                    <span className={styles.diaSemana}>{diaSemana(g.data)}</span>
                    <h2 className={styles.diaNome}>{dataLonga(g.data)}</h2>
                  </div>
                  {saldoCx != null && (
                    <div className={styles.diaCaixa}>
                      <span className={styles.diaCaixaRot}><Banknote size={13} /> {tr('Saldo do caixa')}</span>
                      <span className={[styles.diaCaixaVal, saldoCx < 0 ? styles.hOut : ''].join(' ')}>{fmt(saldoCx)}</span>
                    </div>
                  )}
                </div>
                {canValorTotalDia && (
                  <ul className={styles.diaLinhaTot}>
                    <li>
                      <ArrowUpRight size={15} className={styles.hIn} />
                      <span className={styles.diaTotRot}>{tr('Entrou')}</span>
                      <b className={styles.hIn}>{fmt(entrada)}</b>
                    </li>
                    <li>
                      <ArrowDownRight size={15} className={styles.hOut} />
                      <span className={styles.diaTotRot}>{tr('Saiu')}</span>
                      <b className={styles.hOut}>{fmt(saida)}</b>
                    </li>
                    <li>
                      {lucro < 0
                        ? <TrendingDown size={15} className={styles.hOut} />
                        : <TrendingUp size={15} className={styles.hIn} />}
                      <span className={styles.diaTotRot}>{tr('Resultado')}</span>
                      <b className={lucro < 0 ? styles.hOut : undefined}>{fmt(lucro)}</b>
                    </li>
                  </ul>
                )}
              </div>
            </div>

            <div className={styles.tScroll}>
              <table className={[styles.iTable, styles.ledger].join(' ')}>
                <thead><tr>
                  <th className={styles.cTl} aria-label={tr('Forma')} />
                  <th className={styles.cHora}>{tr('Hora')}</th>
                  <th>{tr('Lançamento')}</th>
                  <th className={styles.cForma}>{tr('Forma')}</th>
                  <th className={styles.cValor}>{tr('Valor')}</th>
                  {canHistoricoSaldo && <th className={styles.cSaldo}>{tr('Saldo do caixa')}</th>}
                </tr></thead>
                <tbody>
                  {g._items.map(t => {
                    const isExp   = t.valor < 0;
                    const metDesc = t.pagamento?.tipo_pagamento?.descricao;
                    const pagador = t.pagamento?.nome_pagador;
                    const hora    = horaDe(t.data_hora_registro);
                    return (
                      <tr key={t.id}
                        className={[styles.lRow, showDetail && item?.id === t.id ? styles.lRowAtivo : ''].join(' ')}
                        tabIndex={0}
                        onClick={() => openDetail(t)}
                        onKeyDown={(e) => { if (e.key === 'Enter') openDetail(t); }}>
                        <td className={styles.cTl}>
                          <span className={[styles.tlDot, isExp ? styles.tlDotOut : ''].join(' ')}
                            style={{ '--m': methodColor(metDesc) }} title={metDesc ?? ''}>
                            {imgPagamento(metDesc)
                              ? <img src={imgPagamento(metDesc)} alt="" draggable={false} />
                              : <Clock size={11} />}
                          </span>
                        </td>
                        <td className={[styles.cHora, styles.tMuted].join(' ')}>{hora}</td>
                        <td className={styles.cDesc}>
                          <span className={styles.lDesc}>{t.relatorio ?? '—'}</span>
                          <span className={styles.lSub}>
                            <span className={styles.lHoraMob}>{hora}</span>
                            {pagador && <span>{pagador}</span>}
                            {t.despesa_pessoal && <span className={styles.flagInterna}>{tr('Despesa interna')}</span>}
                            {t.pagamento?.desconto && <span className={styles.flagDesconto}><Tag size={11} /> {tr('Com desconto')}</span>}
                            {t.editado && <span className={styles.flagEditado}>{tr('Editado')}</span>}
                          </span>
                        </td>
                        <td className={[styles.cForma, styles.tMuted].join(' ')}>{metDesc ?? '—'}</td>
                        <td className={[styles.cValor, styles.tValor, isExp ? styles.vOut : styles.vIn].join(' ')}>
                          {isExp ? '−' : '+'}{fmt(valorFinal(t))}
                        </td>
                        {canHistoricoSaldo && (
                          <td className={[styles.cSaldo, (t.valor_historico_dinheiro ?? 0) < 0 ? styles.vOut : styles.tMuted].join(' ')}>
                            {fmt(t.valor_historico_dinheiro ?? 0)}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    );
  };

  // ── Lançamento aberto: ficha no padrão do cliente em Cadastros ───
  const renderLancamento = () => {
    const pag     = item.pagamento;
    const metDesc = pag?.tipo_pagamento?.descricao;
    const isExp   = item.valor < 0;
    const sinal   = isExp ? '−' : '+';
    const bruto   = Math.abs(pag?.valor ?? item.valor);
    const d       = pag?.desconto;
    const desc    = d ? (d.porcentagem > 0 ? bruto * (d.porcentagem / 100) : (d.valor ?? 0)) : 0;
    const img     = imgPagamento(metDesc);
    const fechar  = () => setShowDetail(false);
    return (
      <div key={`l${item.id}`} className={[styles.detailPanel, styles.girar].join(' ')}>
        <section className={[styles.dCard, styles.fichaCard].join(' ')}>
          <h3 className={[styles.dCardHead, styles.fichaHead].join(' ')}>
            <button type="button" className={styles.backBtnSempre} onClick={fechar}
              title={tr('Voltar para o dia')} aria-label={tr('Voltar para o dia')}>
              <ChevronLeft size={17} />
            </button>
            <FileText size={16} />
            <span className={styles.dCardTitle}>{tr('Lançamento')}</span>
            <div className={styles.dCardActions}>
              <span className={[styles.fichaStatus, isExp ? styles.fichaStatusOut : ''].join(' ')}>
                {isExp ? tr('Despesa') : tr('Receita')}
              </span>
              {canEditar && (
                <Button className={styles.btnSolid} onClick={openEdit}>{tr('Editar')}</Button>
              )}
              <button type="button" className={styles.idClose} onClick={fechar}
                title={tr('Fechar')} aria-label={tr('Fechar')}>
                <X size={16} />
              </button>
            </div>
          </h3>

          <div className={[styles.dCardBody, styles.fichaBody].join(' ')}>
            <div className={styles.fichaTopo}>
              <div className={styles.fichaId}>
                <span className={[styles.fichaAvatar, isExp ? styles.fichaAvatarOut : ''].join(' ')}
                  style={{ '--m': methodColor(metDesc) }}>
                  {img ? <img src={img} alt="" draggable={false} /> : <Clock size={26} />}
                </span>
                <div className={styles.fichaIdMain}>
                  <h2 className={styles.fichaNome}>{item.relatorio ?? '—'}</h2>
                  <p className={styles.fichaSub}>
                    <span className={[styles.fichaValor, isExp ? styles.vOut : styles.vIn].join(' ')}>
                      {sinal}{fmt(bruto - desc)}
                    </span>
                    {metDesc && <span>{metDesc}</span>}
                    {item.despesa_pessoal && <span className={styles.flagInterna}>{tr('Despesa interna')}</span>}
                    {item.editado && <span className={styles.flagEditado}>{tr('Editado')}</span>}
                  </p>
                  <p className={styles.fichaSub}>
                    {item.funcionario?.nome
                      ? tr('Registrado por {{nome}}', { nome: item.funcionario.nome })
                      : tr('Registrado')}
                    {item.data_hora_registro && ` · ${item.data_hora_registro}`}
                  </p>
                </div>
              </div>

              <div className={styles.fichaTabs} role="tablist">
                {[['dados', tr('Dados do lançamento')], ['historico', tr('Histórico de alterações')]].map(([k, label]) => (
                  <button key={k} type="button" role="tab" aria-selected={abaLanc === k}
                    className={[styles.fichaTab, abaLanc === k ? styles.fichaTabAtiva : ''].join(' ')}
                    onClick={() => setAbaLanc(k)}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {abaLanc === 'historico' ? (
              loadingHist ? (
                <div className={styles.histList} aria-busy="true" aria-label={tr('Carregando histórico...')}>
                  {[0, 1].map(i => (
                    <div key={i} className={styles.histItem}>
                      <span className={[styles.sk, styles.skTxt].join(' ')} style={{ width: '45%' }} />
                      <span className={[styles.sk, styles.skSub].join(' ')} style={{ width: '70%', marginTop: 10 }} />
                    </div>
                  ))}
                </div>
              ) : historico.length === 0 ? (
                <p className={styles.histEmpty}>{tr('Nenhuma alteração registrada.')}</p>
              ) : (
                <div className={styles.histList}>
                  {historico.map(h => (
                    <div key={h.id} className={styles.histItem}>
                      <div className={styles.histHead}>
                        <span className={styles.histWho}><User size={12} /> {h.funcionario?.nome ?? '—'}</span>
                        <span className={styles.histWhen}>{h.data_hora}</span>
                      </div>
                      <div className={styles.histChanges}>
                        {(h.alteracoes ?? []).map((a, i) => (
                          <div key={i} className={styles.histChange}>
                            <span className={styles.histField}>{a.campo}</span>
                            <span className={styles.histFrom}>{a.de ?? '—'}</span>
                            <ArrowRight size={11} className={styles.histArrow} />
                            <span className={styles.histTo}>{a.para ?? '—'}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : (<>
              <div className={styles.fieldGrid}>
                <Field label={tr('Valor')} value={`${sinal}${fmt(bruto - desc)}`} className={isExp ? styles.vOut : styles.vIn} />
                <Field label={tr('Data / Hora')} value={item.data_hora_registro} />
                <Field label={tr('Quarto')} value={item.quarto ? fmtQuarto(item.quarto) : ''} />
                <Field label={tr('Funcionário')} value={item.funcionario?.nome} />
                <Field label={tr('Tipo')} value={item.despesa_pessoal ? tr('Despesa interna') : isExp ? tr('Despesa') : tr('Receita')} />
                {canHistoricoSaldo && <Field label={tr('Saldo do caixa')} value={fmt(item.valor_historico_dinheiro ?? 0)} />}
              </div>

              <div className={styles.dadosGrupoSep}>
                <div className={styles.dadosHead}><CreditCard size={16} /><span>{tr('Pagamento')}</span></div>
                <div className={styles.fieldGrid}>
                  <Field label={tr('Forma')} value={metDesc} />
                  <Field label={tr('Pagador')} value={pag?.nome_pagador} />
                  <Field label={tr('Comprovante')} value={pag?.path_arquivo ? (
                    <button type="button" className={styles.arquivoLink} onClick={() => arquivoApi.abrir(pag.path_arquivo)}>
                      <Download size={13} /> {tr('Ver comprovante')}
                    </button>
                  ) : ''} />
                  <Field label="UUID" value={pag?.uuid} mono />
                </div>
              </div>

              {d && (
                <div className={styles.dadosGrupoSep}>
                  <div className={styles.dadosHead}><Tag size={16} /><span>{tr('Desconto')}</span></div>
                  <div className={styles.fieldGrid}>
                    <Field label={tr('Valor bruto')} value={`${sinal}${fmt(bruto)}`} />
                    <Field label={tr('Desconto')} value={`−${fmt(desc)}${d.porcentagem > 0 ? ` (${d.porcentagem}%)` : ''}`} className={styles.vOut} />
                    <Field label={tr('Valor final')} value={`${sinal}${fmt(bruto - desc)}`} />
                    <Field label={tr('Autorizado por')} value={d.funcionario?.nome} />
                    <Field label={tr('Data / Hora')} value={d.data_hora_registro} />
                    <Field label="UUID" value={d.uuid} mono />
                  </div>
                </div>
              )}
            </>)}
          </div>
        </section>
      </div>
    );
  };

  // ── Nova receita / despesa: campos no painel da direita ────
  const renderNovo = () => {
    const fechar = () => setShowPaymentAdd(false);
    const despesa = addTipoRegistro === 'SAIDA';
    return (
      <div key={`n${addTipoRegistro}`} className={[styles.detailPanel, styles.girar].join(' ')}>
        <section className={[styles.dCard, styles.fichaCard].join(' ')}>
          <h3 className={[styles.dCardHead, styles.fichaHead].join(' ')}>
            <button type="button" className={styles.backBtnSempre} onClick={fechar}
              title={tr('Voltar')} aria-label={tr('Voltar')}>
              <ChevronLeft size={17} />
            </button>
            {despesa ? <ArrowDownRight size={16} className={styles.vOut} /> : <ArrowUpRight size={16} className={styles.vIn} />}
            <span className={styles.dCardTitle}>{despesa ? tr('Nova despesa') : tr('Nova receita')}</span>
          </h3>
          <div className={[styles.dCardBody, styles.fichaBody].join(' ')}>
            <PaymentModal
              key={addTipoRegistro}
              inline
              open
              onClose={fechar}
              onConfirm={handleAddFromPayment}
              tiposPagamento={tiposPagamento}
              tipoRegistro={addTipoRegistro}
              quartos={quartos}
              despesaInternaEnabled={despesa}
              isSubmitting={isSubmitting}
              loggedUser={loggedUser}
              canAplicarDesconto={false}
            />
          </div>
        </section>
      </div>
    );
  };

  // ─────────────────────────────────────────────────────────
  return (
    <div className={styles.page} ref={pageRef}>
      <div className={styles.container}>
        <main className={[styles.split, (diaAberto || showFormas || showPaymentAdd || (showDetail && item)) ? styles.splitListHidden : ''].join(' ')}>

          {/* ══ DIAS ═══════════════════════════════════════ */}
          <aside className={styles.listPanel}>
            {canNovoLancamento && (
              <div className={styles.novoRow}>
                <Button className={[styles.btnSolid, styles.btnIn].join(' ')} onClick={openNovaReceita}>
                  <Plus size={14} /> {tr('Nova receita')}
                </Button>
                <Button className={[styles.btnSolid, styles.btnOut].join(' ')} onClick={openNovaDespesa}>
                  <Plus size={14} /> {tr('Nova despesa')}
                </Button>
              </div>
            )}

            <div className={styles.searchRow}>
              <div className={[styles.searchWrap, searchTerm ? styles.searchAtiva : ''].join(' ')}>
                <Search size={16} className={styles.searchIcon} />
                <Input value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                  placeholder={tr('Buscar por descrição ou pagador')} className={styles.searchInput}
                  aria-label={tr('Buscar lançamento')} />
                {searchTerm && (
                  <button type="button" className={styles.searchClear} onClick={() => setSearchTerm('')}
                    aria-label={tr('Limpar busca')}>
                    <X size={14} />
                  </button>
                )}
              </div>
              {canFiltros && (
                <div className={styles.filtroWrap} ref={filtroRef}>
                  <button type="button"
                    className={[styles.filterBtn, (nFilters > 0 || showFilter) ? styles.filterBtnOn : ''].join(' ')}
                    onClick={() => setShowFilter(v => !v)}
                    title={tr('Filtros')} aria-label={tr('Filtros')} aria-expanded={showFilter}>
                    <FilterIcon size={18} />
                    {nFilters > 0 && <span className={styles.filterDot} />}
                  </button>
                  {showFilter && (
                    <div className={styles.filtroPop} role="dialog" aria-label={tr('Filtros')}>
                      <DatePicker
                        mode="range" label={tr('Período')}
                        startDate={fStart} endDate={fEnd}
                        onRangeChange={({ start, end }) => { setFStart(start); setFEnd(end); }}
                        placeholder={tr('Selecione o período...')}
                      />
                      <label className={styles.filtroCampo}>
                        <span>{tr('Tipo de Valor')}</span>
                        <Select value={fValores} onChange={e => setFValores(e.target.value)}>
                          <option value="">{tr('Todos')}</option>
                          <option value="ENTRADA">{tr('Entradas')}</option>
                          <option value="SAIDA">{tr('Saídas')}</option>
                        </Select>
                      </label>
                      <label className={styles.filtroCampo}>
                        <span>{tr('Tipo de Pagamento')}</span>
                        <Select value={fPagId} onChange={e => setFPagId(e.target.value)}>
                          <option value="">{tr('Todos')}</option>
                          {tiposPagamento.map(tp => <option key={tp.id} value={tp.id}>{tp.descricao}</option>)}
                        </Select>
                      </label>
                      <label className={styles.filtroCampo}>
                        <span>{tr('Quarto')}</span>
                        <Select value={fQuarto} onChange={e => setFQuarto(e.target.value)}>
                          <option value="">{tr('Todos')}</option>
                          {quartos.map(q => <option key={q.id} value={q.id}>{fmtQuarto(q)}</option>)}
                        </Select>
                      </label>
                      <label className={styles.filtroCampo}>
                        <span>{tr('Funcionário')}</span>
                        <Select value={fFuncId} onChange={e => setFFuncId(e.target.value)}>
                          <option value="">{tr('Todos')}</option>
                          {funcionarios.map(f => <option key={f.id} value={f.id}>{f.pessoa?.nome}</option>)}
                        </Select>
                      </label>
                      <div className={styles.filtroAcoes}>
                        <button type="button" className={styles.linkBtn} onClick={clearFilter}>{tr('Limpar')}</button>
                        <Button className={[styles.btnSolid, styles.filtroAplicar].join(' ')} onClick={applyFilter}>{tr('Aplicar')}</Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {canFiltros && nFilters > 0 && (
              <div className={styles.filtroChips}>
                {filtrosResumo().map(p => (
                  <span key={p.type} className={styles.filtroChip}>
                    <span className={styles.filtroChipRot}>{p.label}:</span> {p.value}
                    <button type="button" className={styles.filtroChipX}
                      onClick={() => removeFiltro(p.type)}
                      title={tr('Remover filtro: {{label}}', { label: p.label })}
                      aria-label={tr('Remover filtro: {{label}}', { label: p.label })}>
                      <X size={12} />
                    </button>
                  </span>
                ))}
                <span className={styles.filtrosAcoes}>
                  <button type="button" className={styles.linkBtn} onClick={baixarRelatorioFiltro}>
                    <Download size={13} /> {tr('Relatório PDF')}
                  </button>
                  <button type="button" className={styles.linkBtn} onClick={clearFilter}>
                    {tr('Limpar filtros')}
                  </button>
                </span>
              </div>
            )}

            <div className={styles.listMeta}>
              <span>
                {loadingData ? tr('Carregando...')
                  : visibleGrupos.length === 1 ? tr('1 dia com lançamentos')
                  : tr('{{n}} dias com lançamentos', { n: visibleGrupos.length })}
              </span>
              {canDashboard && methodEntries.length > 0 && (
                <button type="button"
                  className={[styles.listMetaLink, showFormas ? styles.listMetaLinkOn : ''].join(' ')}
                  onClick={abrirFormas}>
                  {tr('Dashboard financeiro')}
                </button>
              )}
            </div>

            <div className={styles.listScroll}>
              {loadingData ? (
                <div aria-busy="true">
                  {Array.from({ length: 7 }, (_, i) => (
                    <div key={i} className={styles.skDia}>
                      <span className={styles.skCol}>
                        <span className={[styles.sk, styles.skTxt].join(' ')} style={{ width: `${62 - (i % 3) * 10}%` }} />
                        <span className={[styles.sk, styles.skSub].join(' ')} />
                      </span>
                    </div>
                  ))}
                </div>
              ) : visibleGrupos.length === 0 ? (
                <div className={styles.empty}>
                  <AlertCircle size={24} opacity={0.3} />
                  <span>
                    {searchTerm ? tr('Nenhum lançamento encontrado para "{{search}}".', { search: searchTerm })
                      : nFilters > 0 ? tr('Nenhum lançamento com esses filtros.')
                      : tr('Nenhum lançamento registrado.')}
                  </span>
                </div>
              ) : visibleGrupos.map((g) => {
                const lucro   = g.lucro_total_dia ?? 0;
                const ativo   = !showFormas && !showPaymentAdd && diaAberto?.data === g.data;
                return (
                  <button key={g.data} type="button"
                    className={[styles.dia, ativo ? styles.diaAtivo : ''].join(' ')}
                    onClick={() => abrirDia(g.data)}>
                    <span className={styles.diaBody}>
                      <span className={styles.diaLinha}>
                        <span className={styles.diaTitulo}>{g.data}</span>
                        {canValorTotalDia && (
                          <span className={[styles.diaLucro, lucro < 0 ? styles.vOut : ''].join(' ')}>{fmt(lucro)}</span>
                        )}
                      </span>
                      <span className={styles.diaSub}>
                        <span className={styles.diaSemanaLista}>{diaSemana(g.data)}</span>
                        <span>{g._items.length === 1 ? tr('1 lançamento') : tr('{{n}} lançamentos', { n: g._items.length })}</span>
                      </span>
                    </span>
                    <ChevronRight size={16} className={styles.listChevron} />
                  </button>
                );
              })}
            </div>
          </aside>

          {/* ══ DIREITA ═══════════════════════════════════ */}
          {showPaymentAdd ? renderNovo()
            : showDetail && item ? renderLancamento()
            : showFormas ? renderFormas()
            : loadingData ? (isDesktop ? renderCarregandoPainel() : null)
            : diaAberto ? renderDia(diaAberto)
            : isDesktop && visibleGrupos.length > 0 ? (
              <div className={styles.detailPanel}>
                <div className={[styles.dCard, styles.empty].join(' ')}>
                  <Calendar size={24} opacity={0.3} />
                  <span>{tr('Escolha um dia para ver os lançamentos.')}</span>
                </div>
              </div>
            ) : null}
        </main>
      </div>

      {/* ══ MODAL: EDITAR ═══════════════════════════════════ */}
      <Modal open={showEdit} onClose={() => setShowEdit(false)} title={tr('Editar Lançamento')}
        footer={
          <div className={styles.modalFooter}>
            <Button onClick={() => setShowEdit(false)} className={styles.full}>{tr('Cancelar')}</Button>
            <Button variant="primary" onClick={handleEdit} disabled={isSubmitting} className={styles.full}>
              {isSubmitting ? <><Loader2 size={13} className={styles.spinnerInline} /> {tr('Salvando...')}</> : tr('Salvar')}
            </Button>
          </div>
        }>
        <FormField label={tr('Tipo')}>
          <Select value={editTipoRegistro} onChange={e => setEditTipoRegistro(e.target.value)}>
            <option value="ENTRADA">{tr('Receita (+)')}</option>
            <option value="SAIDA">{tr('Despesa (−)')}</option>
          </Select>
        </FormField>
        <FormField label={tr('Quarto')}>
          <Select value={editQuarto} onChange={e => setEditQuarto(e.target.value)}>
            <option value="">{tr('Nenhum')}</option>
            {quartos.map(q => <option key={q.id} value={q.id}>{fmtQuarto(q)}</option>)}
          </Select>
        </FormField>
        <label className={styles.checkRow}>
          <input type="checkbox" checked={editPessoal}
            onChange={e => setEditPessoal(e.target.checked)} />
          <span>{tr('Despesa interna do Hotel')}</span>
        </label>

        {editPagamento ? (
          <div className={styles.pagamentoChip}>
            <PayMethodIcon descricao={editPagamento.tipo_pagamento?.descricao} size={13} />
            <span>{descPag(editPagamento)}</span>
            {canEditarPagamento && (
              <button className={styles.pagamentoEdit} onClick={() => setShowPaymentEdit(true)}>
                {tr('Alterar')}
              </button>
            )}
          </div>
        ) : canEditarPagamento && (
          <button className={styles.definePagamento} onClick={() => setShowPaymentEdit(true)}>
            <CreditCard size={13} /> {tr('Definir Pagamento')}
          </button>
        )}
      </Modal>

      {/* ══ PAYMENT MODALS ══════════════════════════════════ */}
      <PaymentModal
        open={showPaymentEdit}
        onClose={() => setShowPaymentEdit(false)}
        onConfirm={pag => { setEditPagamento(pag); setShowPaymentEdit(false); }}
        tiposPagamento={tiposPagamento}
        initialPayment={editPagamento}
        defaultValor={Math.abs(editPagamento?.valor ?? 0)}
        tipoRegistro={editTipoRegistro}
        loggedUser={loggedUser}
        canAplicarDesconto={false}
      />

      <Notification notification={notification} />
    </div>
  );
}
