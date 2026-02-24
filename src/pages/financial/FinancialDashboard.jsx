import { useState, useEffect } from 'react';
import {
  CreditCard, Calendar, Filter, Search, ChevronDown, Plus, Edit2,
  Wallet, Banknote, Smartphone, Building2, Clock, TrendingUp,
  TrendingDown, DollarSign, ArrowUpRight, ArrowDownRight, Minus,
  Loader2, AlertCircle,
} from 'lucide-react';

import { Button }                           from '../../components/ui/Button';
import { Modal }                            from '../../components/ui/Modal';
import { Input, Select, FormField }         from '../../components/ui/Input';
import { Notification }                     from '../../components/ui/Notification';
import { DatePicker }                       from '../../components/ui/DatePicker';
import { relatorioApi, enumApi, quartoApi } from '../../services/api';

import styles from './FinancialDashboard.module.css';

// ─── Formata valor como moeda BRL corretamente (centavos) ─────
const fmt = (v) =>
  Number(v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// ─── Ícone por forma de pagamento (sem emoji) ─────────────────
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

// ─── Chave de cor por método ──────────────────────────────────
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

// ─────────────────────────────────────────────────────────────
export default function FinancialDashboard() {
  // ── dados da API ──────────────────────────────────────────
  // grupos = [ { data, totalDia, content: [relatorio, ...] } ]
  const [grupos,         setGrupos]         = useState([]);
  const [pagamentos,     setPagamentos]     = useState({});
  const [tiposPagamento, setTiposPagamento] = useState([]);
  const [quartos,        setQuartos]        = useState([]);

  const [loadingData,    setLoadingData]    = useState(true);
  const [isSubmitting,   setIsSubmitting]   = useState(false);
  const [notification,   setNotification]   = useState(null);
  const [searchTerm,     setSearchTerm]     = useState('');
  const [expanded,       setExpanded]       = useState({});
  const [activeFilters,  setActiveFilters]  = useState({});

  // ── modais ────────────────────────────────────────────────
  const [showAdd,    setShowAdd]    = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [showEdit,   setShowEdit]   = useState(false);
  const [item,       setItem]       = useState(null);

  // ── form add ──────────────────────────────────────────────
  const [addDesc,    setAddDesc]    = useState('');
  const [addValor,   setAddValor]   = useState('');
  const [addTipo,    setAddTipo]    = useState('income');
  const [addPagId,   setAddPagId]   = useState('');
  const [addQuarto,  setAddQuarto]  = useState('');
  const [addPessoal, setAddPessoal] = useState(false);

  // ── form edit ─────────────────────────────────────────────
  const [editDesc,    setEditDesc]    = useState('');
  const [editValor,   setEditValor]   = useState('');
  const [editPagId,   setEditPagId]   = useState('');
  const [editQuarto,  setEditQuarto]  = useState('');
  const [editPessoal, setEditPessoal] = useState(false);

  // ── filtros ───────────────────────────────────────────────
  const [fStart,   setFStart]   = useState(null);
  const [fEnd,     setFEnd]     = useState(null);
  const [fValores, setFValores] = useState('');
  const [fPagId,   setFPagId]   = useState('');
  const [fQuarto,  setFQuarto]  = useState('');

  const showNotif = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const toApiDate = (d) => d ? d.toISOString().split('T')[0] : undefined;

  // ── carregar enums ────────────────────────────────────────
  useEffect(() => {
    enumApi.tipoPagamento().then(setTiposPagamento).catch(() => {});
    quartoApi.listar({ size: 900 }).then(r => setQuartos(r?.content ?? [])).catch(() => {});
  }, []);

  // ── fetch relatórios ──────────────────────────────────────
  const fetchData = async (filters = {}) => {
    setLoadingData(true);
    try {
      const res = await relatorioApi.listar({ size: 200, ...filters });
      // Estrutura real: { pagamentos: {...}, page: { content: [{data, totalDia, content:[]}] } }
      setGrupos(res?.page?.content ?? []);
      setPagamentos(res?.pagamentos ?? {});
    } catch {
      showNotif('Erro ao carregar lançamentos.', 'error');
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // ── adicionar ─────────────────────────────────────────────
  const handleAdd = async () => {
    if (!addDesc || !addValor || !addPagId) {
      showNotif('Preencha descrição, valor e tipo de pagamento.', 'error');
      return;
    }
    setIsSubmitting(true);
    try {
      const valor = addTipo === 'expense'
        ? -Math.abs(parseFloat(String(addValor).replace(',', '.')))
        :  Math.abs(parseFloat(String(addValor).replace(',', '.')));
      await relatorioApi.criar({
        relatorio: addDesc, valor,
        tipoPagamentoId: Number(addPagId),
        quartoId: addQuarto ? Number(addQuarto) : undefined,
        despesaPessoal: addPessoal,
      });
      setShowAdd(false);
      setAddDesc(''); setAddValor(''); setAddTipo('income');
      setAddPagId(''); setAddQuarto(''); setAddPessoal(false);
      showNotif('Lançamento adicionado!');
      fetchData(activeFilters);
    } catch (e) {
      showNotif(e.message || 'Erro ao adicionar.', 'error');
    } finally { setIsSubmitting(false); }
  };

  // ── editar ────────────────────────────────────────────────
  const handleEdit = async () => {
    if (!item) return;
    setIsSubmitting(true);
    try {
      await relatorioApi.atualizar(item.id, {
        relatorio: editDesc, valor: parseFloat(String(editValor).replace(',', '.')),
        tipoPagamentoId: Number(editPagId),
        quartoId: editQuarto ? Number(editQuarto) : undefined,
        despesaPessoal: editPessoal,
      });
      setShowEdit(false);
      showNotif('Lançamento editado!');
      fetchData(activeFilters);
    } catch (e) {
      showNotif(e.message || 'Erro ao editar.', 'error');
    } finally { setIsSubmitting(false); }
  };

  const openDetail = (t) => { setItem(t); setShowDetail(true); };
  const openEdit   = () => {
    if (!item) return;
    setEditDesc(item.relatorio ?? '');
    setEditValor(Number(item.valor ?? 0).toFixed(2).replace('.', ','));
    setEditPagId(String(item.tipoPagamentoId ?? ''));
    setEditQuarto(String(item.quartoId ?? ''));
    setEditPessoal(item.despesaPessoal ?? false);
    setShowDetail(false);
    setShowEdit(true);
  };

  // ── filtros ───────────────────────────────────────────────
  const applyFilter = () => {
    const f = {};
    if (fStart)   f.dataInicio      = toApiDate(fStart);
    if (fEnd)     f.dataFim         = toApiDate(fEnd);
    if (fValores) f.valores         = fValores;
    if (fPagId)   f.tipoPagamentoId = Number(fPagId);
    if (fQuarto)  f.quartoId        = Number(fQuarto);
    setActiveFilters(f);
    setExpanded({});
    setShowFilter(false);
    fetchData(f);
    showNotif('Filtros aplicados!', 'info');
  };

  const clearFilter = () => {
    setFStart(null); setFEnd(null); setFValores(''); setFPagId(''); setFQuarto('');
    setActiveFilters({});
    setExpanded({});
    setShowFilter(false);
    fetchData();
  };

  // ── resumo ────────────────────────────────────────────────
  const total = pagamentos?.TOTAL ?? { receitas: 0, despesas: 0, lucro: 0 };
  const methodEntries = Object.entries(pagamentos).filter(([k]) => k !== 'TOTAL');

  const summaryCards = [
    { key: 'r', title: 'Receita Total',       icon: TrendingUp,   color: 'emerald',
      r: total.receitas, d: 0,             l: total.receitas },
    { key: 'd', title: 'Despesa Total',        icon: TrendingDown, color: 'rose',
      r: 0,             d: total.despesas, l: -total.despesas },
    { key: 'l', title: 'Resultado do Período', icon: DollarSign,   color: 'violet',
      r: total.receitas, d: total.despesas, l: total.lucro },
  ];

  // ── busca local ───────────────────────────────────────────
  const visibleGrupos = grupos.map(g => ({
    ...g,
    content: g.content.filter(t =>
      !searchTerm || (t.relatorio ?? '').toLowerCase().includes(searchTerm.toLowerCase())
    ),
  })).filter(g => g.content.length > 0);

  const nFilters = Object.keys(activeFilters).length;

  // ─────────────────────────────────────────────────────────
  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.mainLayout}>

          {/* ══ COLUNA ESQUERDA ════════════════════════════ */}
          <section className={styles.card} style={{ flex: 1, minWidth: 0 }}>
            <div className={styles.tableHeader}>
              <div>
                <h2 className={styles.h2}>Financeiro</h2>
                <p className={styles.subtitle}>Resumo financeiro e histórico de transações do hotel</p>
              </div>
              <div className={styles.tableTools}>
                <div className={styles.searchWrap}>
                  <Search size={13} className={styles.searchIcon} />
                  <Input value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                    placeholder="Buscar descrição..." className={styles.searchInput} />
                </div>
                <Button onClick={() => setShowFilter(true)}>
                  <Filter size={14} /> Filtros
                  {nFilters > 0 && <span className={styles.filterBadge}>{nFilters}</span>}
                </Button>
                <Button variant="primary" onClick={() => setShowAdd(true)}>
                  <Plus size={14} /> Adicionar
                </Button>
              </div>
            </div>

            {loadingData ? (
              <div className={styles.loadingInline}>
                <Loader2 size={17} className={styles.spinnerInline} /> Carregando...
              </div>
            ) : visibleGrupos.length === 0 ? (
              <div className={styles.empty}>
                <AlertCircle size={26} opacity={0.3} />
                <span>Nenhum lançamento encontrado.</span>
              </div>
            ) : (
              <div className={styles.groupList}>
                {visibleGrupos.map(({ data, content }) => {
                  const isOpen = !!expanded[data];
                  const dayR  = content.filter(t => t.valor >= 0).reduce((s,t) => s + t.valor, 0);
                  const dayD  = content.filter(t => t.valor <  0).reduce((s,t) => s + Math.abs(t.valor), 0);
                  const dayL  = dayR - dayD;

                  return (
                    <div key={data} className={styles.group}>
                      <div className={styles.groupHeader}
                        onClick={() => setExpanded(p => ({ ...p, [data]: !p[data] }))}>
                        <div className={styles.groupLeft}>
                          <ChevronDown size={14} className={[styles.chev, isOpen ? '' : styles.chevCollapsed].join(' ')} />
                          <Calendar size={13} className={styles.iconViolet} />
                          <span className={styles.groupDate}>{data}</span>
                          <span className={styles.badge}>{content.length} {content.length === 1 ? 'lançamento' : 'lançamentos'}</span>
                        </div>
                        <div className={styles.groupRight}>
                          <span className={styles.dotPlus} />
                          <b className={styles.moneyPlus}>{fmt(dayR)}</b>
                          <span className={styles.dotMinus} />
                          <b className={styles.moneyMinus}>{fmt(dayD)}</b>
                          <span className={styles.dotViolet} />
                          <b className={dayL >= 0 ? styles.moneyViolet : styles.moneyMinus}>{fmt(dayL)}</b>
                        </div>
                      </div>

                      {isOpen && (
                        <div className={styles.tableWrap}>
                          <table className={styles.table}>
                            <thead><tr>
                              <th style={{ width: 36 }}></th>
                              <th>Descrição</th>
                              <th style={{ width: 140, textAlign: 'right' }}>Valor</th>
                              <th style={{ width: 150, textAlign: 'right' }}>Saldo Dinheiro</th>
                            </tr></thead>
                            <tbody>
                              {content.map(t => {
                                const isExp = t.valor < 0;
                                const ak    = accentOf(t.tipoPagamentoDescricao);
                                const saldo = t.valorHistoricoDinheiro ?? 0;

                                return (
                                  <tr key={t.id} className={styles.row} onClick={() => openDetail(t)}>
                                    <td>
                                      <span className={[styles.methodIcon, styles[`accent_${ak}`]].join(' ')}>
                                        <PayMethodIcon descricao={t.tipoPagamentoDescricao} size={14} />
                                      </span>
                                    </td>
                                    <td>
                                      <div className={styles.desc}>{t.relatorio}</div>
                                      <div className={styles.subdesc}>
                                        {t.dataHora} · {t.tipoPagamentoDescricao ?? '—'}
                                        {t.despesaPessoal && <span className={styles.pessoalTag}>pessoal</span>}
                                      </div>
                                    </td>
                                    <td style={{ textAlign: 'right' }}>
                                      <b className={isExp ? styles.moneyMinus : styles[`money_${ak}`]}>
                                        {isExp ? '−' : '+'}{fmt(Math.abs(t.valor))}
                                      </b>
                                    </td>
                                    <td style={{ textAlign: 'right' }}>
                                      <span className={styles.balance}>
                                        <b>{fmt(saldo)}</b>
                                        {saldo > 0
                                          ? <ArrowUpRight   size={12} className={styles.iconEmerald} />
                                          : saldo < 0
                                          ? <ArrowDownRight size={12} className={styles.iconRose} />
                                          : <Minus         size={12} className={styles.iconMuted} />}
                                      </span>
                                    </td>
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
            )}
          </section>

          {/* ══ COLUNA DIREITA: RESUMO ══════════════════════ */}
          <aside className={styles.summaryCol}>
            <div className={styles.sectionTitle}>
              <CreditCard size={12} className={styles.iconViolet} />
              <h2>Resumo</h2>
            </div>
            <div className={styles.summaryList}>
              {summaryCards.map(({ key, title, icon: Icon, color, r, d, l }) => (
                <div key={key} className={styles.summaryCard}>
                  <div className={styles.summaryHead}>
                    <div className={[styles.summaryIcon, styles[`summaryIcon_${color}`]].join(' ')}>
                      <Icon size={14} />
                    </div>
                    <span className={styles.summaryTitle}>{title}</span>
                  </div>
                  <div className={styles.kv}>
                    <div className={styles.kvRow}><span>Receitas</span><b className={styles.moneyPlus}>{fmt(r)}</b></div>
                    <div className={styles.kvRow}><span>Despesas</span><b className={styles.moneyMinus}>{fmt(d)}</b></div>
                    <div className={styles.divider} />
                    <div className={styles.kvRow}>
                      <span>Resultado</span>
                      <b className={l >= 0 ? styles.moneyViolet : styles.moneyMinus}>{fmt(l)}</b>
                    </div>
                  </div>
                </div>
              ))}

              {methodEntries.map(([method, values]) => {
                const ak = accentOf(method);
                return (
                  <div key={method} className={styles.summaryCard}>
                    <div className={styles.summaryHead}>
                      <div className={[styles.summaryIcon, styles[`summaryIcon_${ak}`]].join(' ')}>
                        <PayMethodIcon descricao={method} size={14} />
                      </div>
                      <span className={styles.summaryTitle}>{method}</span>
                    </div>
                    <div className={styles.kv}>
                      <div className={styles.kvRow}><span>Receitas</span><b className={styles.moneyPlus}>{fmt(values.receitas)}</b></div>
                      <div className={styles.kvRow}><span>Despesas</span><b className={styles.moneyMinus}>{fmt(values.despesas)}</b></div>
                      <div className={styles.divider} />
                      <div className={styles.kvRow}>
                        <span>Resultado</span>
                        <b className={values.lucro >= 0 ? styles[`money_${ak}`] : styles.moneyMinus}>{fmt(values.lucro)}</b>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </aside>
        </div>
      </div>

      {/* ══ MODAL: DETALHE ══════════════════════════════════ */}
      <Modal open={showDetail && !!item} onClose={() => setShowDetail(false)} title="Lançamento"
        footer={
          <div className={styles.modalFooter}>
            <Button onClick={() => setShowDetail(false)} className={styles.full}>Fechar</Button>
            <Button variant="primary" onClick={openEdit} className={styles.full}>
              <Edit2 size={13} /> Editar
            </Button>
          </div>
        }>
        {item && (
          <div className={styles.detailGrid}>
            {[
              ['Descrição',      item.relatorio],
              ['Data / Hora',    `${item.data ?? '—'} às ${item.dataHora ?? '—'}`],
              ['Pagamento',      item.tipoPagamentoDescricao ?? '—'],
              ['Quarto',         item.quartoDescricao ?? '—'],
              ['Funcionário',    item.funcionario?.nome ?? '—'],
              ['Saldo Dinheiro', fmt(item.valorHistoricoDinheiro ?? 0)],
            ].map(([label, val]) => (
              <div key={label} className={styles.detailRow}>
                <span className={styles.detailLabel}>{label}</span>
                <span className={styles.detailVal}>{val}</span>
              </div>
            ))}
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Valor</span>
              <span className={item.valor >= 0 ? styles.detailPlus : styles.detailMinus}>
                {item.valor >= 0 ? '+' : '−'}{fmt(Math.abs(item.valor))}
              </span>
            </div>
            {item.despesaPessoal && (
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Tipo</span>
                <span className={styles.pessoalTag}>Despesa Pessoal</span>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ══ MODAL: EDITAR ═══════════════════════════════════ */}
      <Modal open={showEdit} onClose={() => setShowEdit(false)} title="Editar Lançamento"
        footer={
          <div className={styles.modalFooter}>
            <Button onClick={() => setShowEdit(false)} className={styles.full}>Cancelar</Button>
            <Button variant="primary" onClick={handleEdit} disabled={isSubmitting} className={styles.full}>
              {isSubmitting ? <><Loader2 size={13} className={styles.spinnerInline} /> Salvando...</> : 'Salvar'}
            </Button>
          </div>
        }>
        <FormField label="Descrição">
          <Input value={editDesc} onChange={e => setEditDesc(e.target.value)} />
        </FormField>
        <div className={styles.grid2}>
          <FormField label="Valor (R$)">
            <Input type="text" placeholder="0,00" value={editValor} onChange={e => setEditValor(e.target.value)} />
          </FormField>
          <FormField label="Tipo de Pagamento">
            <Select value={editPagId} onChange={e => setEditPagId(e.target.value)}>
              <option value="">Selecione...</option>
              {tiposPagamento.map(tp => <option key={tp.id} value={tp.id}>{tp.descricao}</option>)}
            </Select>
          </FormField>
        </div>
        <FormField label="Quarto">
          <Select value={editQuarto} onChange={e => setEditQuarto(e.target.value)}>
            <option value="">Nenhum</option>
            {quartos.map(q => <option key={q.id} value={q.id}>{q.descricao}</option>)}
          </Select>
        </FormField>
        <label className={styles.checkRow}>
          <input type="checkbox" checked={editPessoal} onChange={e => setEditPessoal(e.target.checked)} />
          <span>Despesa pessoal do funcionário</span>
        </label>
      </Modal>

      {/* ══ MODAL: ADICIONAR ════════════════════════════════ */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Novo Lançamento"
        footer={
          <div className={styles.modalFooter}>
            <Button onClick={() => setShowAdd(false)} className={styles.full}>Cancelar</Button>
            <Button variant="primary" onClick={handleAdd} disabled={isSubmitting} className={styles.full}>
              {isSubmitting ? <><Loader2 size={13} className={styles.spinnerInline} /> Salvando...</> : 'Salvar'}
            </Button>
          </div>
        }>
        <FormField label="Descrição">
          <Input placeholder="Ex: Pagamento de diária" value={addDesc} onChange={e => setAddDesc(e.target.value)} />
        </FormField>
        <div className={styles.grid2}>
          <FormField label="Tipo">
            <Select value={addTipo} onChange={e => setAddTipo(e.target.value)}>
              <option value="income">Receita (+)</option>
              <option value="expense">Despesa (−)</option>
            </Select>
          </FormField>
          <FormField label="Tipo de Pagamento">
            <Select value={addPagId} onChange={e => setAddPagId(e.target.value)}>
              <option value="">Selecione...</option>
              {tiposPagamento.map(tp => <option key={tp.id} value={tp.id}>{tp.descricao}</option>)}
            </Select>
          </FormField>
        </div>
        <FormField label="Valor (R$)">
          <Input type="text" placeholder="0,00" value={addValor} onChange={e => setAddValor(e.target.value)} />
        </FormField>
        <FormField label="Quarto">
          <Select value={addQuarto} onChange={e => setAddQuarto(e.target.value)}>
            <option value="">Nenhum</option>
            {quartos.map(q => <option key={q.id} value={q.id}>{q.descricao}</option>)}
          </Select>
        </FormField>
        <label className={styles.checkRow}>
          <input type="checkbox" checked={addPessoal} onChange={e => setAddPessoal(e.target.checked)} />
          <span>Despesa pessoal do funcionário</span>
        </label>
      </Modal>

      {/* ══ MODAL: FILTROS ══════════════════════════════════ */}
      <Modal open={showFilter} onClose={() => setShowFilter(false)} title="Filtros"
        footer={
          <div className={styles.modalFooter}>
            <Button onClick={clearFilter} className={styles.full}>Limpar</Button>
            <Button variant="primary" onClick={applyFilter} className={styles.full}>Aplicar</Button>
          </div>
        }>
        <DatePicker
          mode="range" label="Período"
          startDate={fStart} endDate={fEnd}
          onRangeChange={({ start, end }) => { setFStart(start); setFEnd(end); }}
          placeholder="Selecione o período..."
        />
        <FormField label="Tipo de Valor">
          <Select value={fValores} onChange={e => setFValores(e.target.value)}>
            <option value="">Selecione</option>
            <option value="ENTRADA">Entradas</option>
            <option value="SAIDA">Saídas</option>
          </Select>
        </FormField>
        <FormField label="Tipo de Pagamento">
          <Select value={fPagId} onChange={e => setFPagId(e.target.value)}>
            <option value="">Selecione</option>
            {tiposPagamento.map(tp => <option key={tp.id} value={tp.id}>{tp.descricao}</option>)}
          </Select>
        </FormField>
        <FormField label="Quarto">
          <Select value={fQuarto} onChange={e => setFQuarto(e.target.value)}>
            <option value="">Selecione</option>
            {quartos.map(q => <option key={q.id} value={q.id}>{q.descricao}</option>)}
          </Select>
        </FormField>
      </Modal>

      <Notification notification={notification} />
    </div>
  );
}