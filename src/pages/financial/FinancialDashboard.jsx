import { useState, useEffect, useMemo } from 'react';
import {
  CreditCard, Calendar, Filter, Search, ChevronDown, Plus, Edit2,
  Wallet, Banknote, Smartphone, Building2, Clock, TrendingUp,
  TrendingDown, DollarSign, ArrowUpRight, ArrowDownRight, Minus,
  Loader2, AlertCircle, Download, Tag,
} from 'lucide-react';

import { Button }           from '../../components/ui/Button';
import { Modal }            from '../../components/ui/Modal';
import { Input, Select, FormField } from '../../components/ui/Input';
import { Notification }     from '../../components/ui/Notification';
import { DatePicker }       from '../../components/ui/DatePicker';
import { PaymentModal }     from '../../components/ui/PaymentModal';
import { relatorioApi, enumApi, quartoApi, funcionarioApi, arquivoApi, userStorage } from '../../services/api';

import styles from './FinancialDashboard.module.css';

// ─── Money helpers ─────────────────────────────────────────────

const parseBRL = (v) => {
  const s = String(v ?? '').replace(/[R$\s.]/g, '').replace(',', '.');
  return parseFloat(s) || 0;
};
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

const fmtQuarto = (q) => `Quarto ${q.id} - ${q.descricao}`;

const blankAdd = () => ({
  tipoRegistro: 'ENTRADA', quarto: '', pessoal: false,
});

// ─────────────────────────────────────────────────────────────
export default function FinancialDashboard() {
  const loggedUser = useMemo(() => userStorage.get(), []);

  const [grupos,         setGrupos]         = useState([]);
  const [pagamentos,     setPagamentos]     = useState({});
  const [tiposPagamento, setTiposPagamento] = useState([]);
  const [quartos,        setQuartos]        = useState([]);
  const [funcionarios,   setFuncionarios]   = useState([]);
  const [loadingData,    setLoadingData]    = useState(true);
  const [isSubmitting,   setIsSubmitting]   = useState(false);
  const [notification,   setNotification]   = useState(null);
  const [searchTerm,     setSearchTerm]     = useState('');
  const [expanded,       setExpanded]       = useState({});
  const [activeFilters,  setActiveFilters]  = useState({});

  // modais
  const [showAdd,         setShowAdd]         = useState(false);
  const [showPaymentAdd,  setShowPaymentAdd]  = useState(false);
  const [showFilter,      setShowFilter]      = useState(false);
  const [showDetail,      setShowDetail]      = useState(false);
  const [showEdit,        setShowEdit]        = useState(false);
  const [showPaymentEdit, setShowPaymentEdit] = useState(false);
  const [item,            setItem]            = useState(null);

  // form add
  const [addForm,     setAddForm]     = useState(blankAdd());
  const [addPagamento, setAddPagamento] = useState(null);

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
    enumApi.tipoPagamento().then(setTiposPagamento).catch(() => {});
    quartoApi.listar({ size: 900 }).then(r => setQuartos(r?.content ?? [])).catch(() => {});
    funcionarioApi.listar({ size: 200, page: 0 }).then(r => setFuncionarios(r?.content ?? [])).catch(() => {});
  }, []);

  const fetchData = async (filters = {}) => {
    setLoadingData(true);
    try {
      const res = await relatorioApi.listar({ size: 200, ...filters });
      setGrupos(res?.page?.content ?? []);
      setPagamentos(res?.pagamentos ?? {});
    } catch {
      showNotif('Erro ao carregar lançamentos.', 'error');
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // ── ADD ───────────────────────────────────────────────────
  const handleAdd = async () => {
    if (!addPagamento) {
      showNotif('Defina o pagamento antes de salvar.', 'error');
      return;
    }
    setIsSubmitting(true);
    try {
      const sign  = addForm.tipoRegistro === 'SAIDA' ? -1 : 1;
      const valor = Math.abs(addPagamento.valor) * sign;
      const { _arquivo, _arquivoRemov, ...pagamentoBody } = addPagamento;
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
        tipo_registro:   addForm.tipoRegistro,
        despesa_pessoal: addForm.pessoal,
        pagamento:       { ...pagamentoBody, valor, funcionario: { id: loggedUser?.id }, desconto },
        ...(addForm.quarto ? { quarto: { id: Number(addForm.quarto) } } : {}),
      };
      await relatorioApi.criar(body, _arquivo ?? null);
      setShowAdd(false);
      setAddForm(blankAdd());
      setAddPagamento(null);
      showNotif('Lançamento adicionado!');
      fetchData(activeFilters);
    } catch (e) {
      showNotif(e.message || 'Erro ao adicionar.', 'error');
    } finally { setIsSubmitting(false); }
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
      showNotif('Lançamento editado!');
      fetchData(activeFilters);
    } catch (e) {
      showNotif(e.message || 'Erro ao editar.', 'error');
    } finally { setIsSubmitting(false); }
  };

  const openDetail = (t) => { setItem(t); setShowDetail(true); };
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
    setExpanded({});
    setShowFilter(false);
    fetchData(f);
  };

  const clearFilter = () => {
    setFStart(null); setFEnd(null); setFValores(''); setFPagId(''); setFQuarto(''); setFFuncId('');
    setActiveFilters({});
    setExpanded({});
    setShowFilter(false);
    fetchData();
  };

  const closeAdd = () => { setShowAdd(false); setAddForm(blankAdd()); setAddPagamento(null); };

  // ── RESUMO ────────────────────────────────────────────────
  const total = pagamentos?.TOTAL ?? { receitas: 0, despesas: 0, lucro: 0 };
  const methodEntries = Object.entries(pagamentos).filter(([k]) => k !== 'TOTAL');

  const summaryCards = [
    { key: 'r', title: 'Receita Total',        icon: TrendingUp,   color: 'emerald',
      r: total.receitas, d: 0,             l: total.receitas },
    { key: 'd', title: 'Despesa Total',         icon: TrendingDown, color: 'rose',
      r: 0,             d: total.despesas, l: -total.despesas },
    { key: 'l', title: 'Resultado do Período',  icon: DollarSign,   color: 'violet',
      r: total.receitas, d: total.despesas, l: total.lucro },
  ];

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

  // Helpers para exibir pagamento chips nos formulários
  const descPag = (pag) => {
    if (!pag) return null;
    const desc = tiposPagamento.find(t => t.id === pag.tipo_pagamento?.id)?.descricao
      ?? pag.tipo_pagamento?.descricao ?? '—';
    return `${desc} · ${pag.nome_pagador ?? '—'} · ${fmt(pag.valor ?? 0)}`;
  };
  const iconPag = (pag) =>
    tiposPagamento.find(t => t.id === pag?.tipo_pagamento?.id)?.descricao
    ?? pag?.tipo_pagamento?.descricao;

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
                    placeholder="Buscar lançamento..." className={styles.searchInput} />
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
                {visibleGrupos.map(({ data, total_entrada_dia, total_saida_dia, lucro_total_dia, _items }) => {
                  const isOpen = !!expanded[data];
                  const dayL   = lucro_total_dia ?? 0;

                  return (
                    <div key={data} className={styles.group}>
                      <div className={styles.groupHeader}
                        onClick={() => setExpanded(p => ({ ...p, [data]: !p[data] }))}>
                        <div className={styles.groupLeft}>
                          <ChevronDown size={14} className={[styles.chev, isOpen ? '' : styles.chevCollapsed].join(' ')} />
                          <Calendar size={13} className={styles.iconViolet} />
                          <span className={styles.groupDate}>{data}</span>
                          <span className={styles.badge}>{_items.length} {_items.length === 1 ? 'lançamento' : 'lançamentos'}</span>
                        </div>
                        <div className={styles.groupRight}>
                          <span className={styles.dotPlus} />
                          <b className={styles.moneyPlus}>{fmt(total_entrada_dia)}</b>
                          <span className={styles.dotMinus} />
                          <b className={styles.moneyMinus}>{fmt(total_saida_dia)}</b>
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
                              {_items.map(t => {
                                const isExp   = t.valor < 0;
                                const metDesc = t.pagamento?.tipo_pagamento?.descricao;
                                const ak      = accentOf(metDesc);
                                const saldo   = t.valor_historico_dinheiro ?? 0;

                                return (
                                  <tr key={t.id} className={styles.row} onClick={() => openDetail(t)}>
                                    <td>
                                      <span className={[styles.methodIcon, styles[`accent_${ak}`]].join(' ')}>
                                        <PayMethodIcon descricao={metDesc} size={14} />
                                      </span>
                                    </td>
                                    <td>
                                      <div className={styles.desc}>{t.relatorio ?? '—'}</div>
                                      <div className={styles.subdesc}>
                                        {t.data_hora_registro} · {metDesc ?? '—'}
                                        {t.despesa_pessoal && <span className={styles.pessoalTag}>Despesa Interna</span>}
                                      </div>
                                    </td>
                                    <td style={{ textAlign: 'right' }}>
                                      <b className={t.pagamento?.desconto ? styles.moneyDesconto : isExp ? styles.moneyMinus : styles[`money_${ak}`]} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                        {(() => {
                                          const bruto = Math.abs(t.pagamento?.valor ?? t.valor);
                                          const d = t.pagamento?.desconto;
                                          const final = d
                                            ? bruto - (d.porcentagem > 0 ? bruto * (d.porcentagem / 100) : (d.valor ?? 0))
                                            : bruto;
                                          return <>{isExp ? '−' : '+'}{fmt(final)}</>;
                                        })()}
                                        {t.pagamento?.desconto && <Tag size={13} className={styles.descontoBadge} />}
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

            {/* ── Lançamento ── */}
            <div className={styles.detailSection}>Lançamento</div>
            {[
              ['Descrição',   item.relatorio ?? '—'],
              ['Data / Hora', item.data_hora_registro ?? '—'],
              ['Funcionário', item.funcionario?.nome ?? '—'],
              ['Quarto',      item.quarto ? fmtQuarto(item.quarto) : '—'],
            ].map(([label, val]) => (
              <div key={label} className={styles.detailRow}>
                <span className={styles.detailLabel}>{label}</span>
                <span className={styles.detailVal}>{val}</span>
              </div>
            ))}
            {item.despesa_pessoal && (
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Tipo</span>
                <span className={styles.pessoalTag}>Despesa Interna</span>
              </div>
            )}

            {/* ── Pagamento ── */}
            <div className={styles.detailSection}>Pagamento</div>
            {[
              ['Pagador',       item.pagamento?.nome_pagador ?? '—'],
              ['Forma',         item.pagamento?.tipo_pagamento?.descricao ?? '—'],
            ].map(([label, val]) => (
              <div key={label} className={styles.detailRow}>
                <span className={styles.detailLabel}>{label}</span>
                <span className={styles.detailVal}>{val}</span>
              </div>
            ))}
            {item.pagamento?.path_arquivo && (
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Comprovante</span>
                <button className={styles.arquivoLink}
                  onClick={() => arquivoApi.abrir(item.pagamento.path_arquivo)}>
                  <Download size={13} /> Ver comprovante
                </button>
              </div>
            )}

            {/* ── Valor ── */}
            <div className={styles.detailSection}>Valor</div>
            {item.pagamento?.desconto ? (() => {
              const d     = item.pagamento.desconto;
              const bruto = Math.abs(item.pagamento?.valor ?? item.valor);
              const desc  = d.porcentagem > 0 ? bruto * (d.porcentagem / 100) : (d.valor ?? 0);
              const final = bruto - desc;
              const sign  = item.valor >= 0 ? '+' : '−';
              return (<>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Valor bruto</span>
                  <span className={styles.detailVal}>{sign}{fmt(bruto)}</span>
                </div>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Desconto</span>
                  <span className={styles.detailMinus} style={{ fontSize: 13 }}>
                    −{fmt(desc)}{d.porcentagem > 0 ? ` (${d.porcentagem}%)` : ''}
                  </span>
                </div>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Valor final</span>
                  <span className={item.valor >= 0 ? styles.detailPlus : styles.detailMinus}>
                    {sign}{fmt(final)}
                  </span>
                </div>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Saldo Dinheiro</span>
                  <span className={styles.detailVal}>{fmt(item.valor_historico_dinheiro ?? 0)}</span>
                </div>
                <div className={styles.detailSection}>Desconto</div>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Autorizado por</span>
                  <span className={styles.detailVal}>{d.funcionario?.nome ?? '—'}</span>
                </div>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Data / Hora</span>
                  <span className={styles.detailVal}>{d.data_hora_registro ?? '—'}</span>
                </div>
              </>);
            })() : (<>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Valor</span>
                <span className={item.valor >= 0 ? styles.detailPlus : styles.detailMinus}>
                  {item.valor >= 0 ? '+' : '−'}{fmt(Math.abs(item.valor))}
                </span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Saldo Dinheiro</span>
                <span className={styles.detailVal}>{fmt(item.valor_historico_dinheiro ?? 0)}</span>
              </div>
            </>)}

          </div>
        )}
      </Modal>

      {/* ══ MODAL: ADICIONAR ════════════════════════════════ */}
      <Modal open={showAdd} onClose={closeAdd} title="Novo Lançamento"
        footer={
          <div className={styles.modalFooter}>
            <Button onClick={closeAdd} className={styles.full}>Cancelar</Button>
            <Button variant="primary" onClick={handleAdd}
              disabled={isSubmitting || !addPagamento} className={styles.full}>
              {isSubmitting ? <><Loader2 size={13} className={styles.spinnerInline} /> Salvando...</> : 'Salvar'}
            </Button>
          </div>
        }>
        <FormField label="Tipo">
          <Select value={addForm.tipoRegistro}
            onChange={e => setAddForm(f => ({ ...f, tipoRegistro: e.target.value }))}>
            <option value="ENTRADA">Receita (+)</option>
            <option value="SAIDA">Despesa (−)</option>
          </Select>
        </FormField>
        <FormField label="Quarto">
          <Select value={addForm.quarto}
            onChange={e => setAddForm(f => ({ ...f, quarto: e.target.value }))}>
            <option value="">Nenhum</option>
            {quartos.map(q => <option key={q.id} value={q.id}>{fmtQuarto(q)}</option>)}
          </Select>
        </FormField>
        <label className={styles.checkRow}>
          <input type="checkbox" checked={addForm.pessoal}
            onChange={e => setAddForm(f => ({ ...f, pessoal: e.target.checked }))} />
          <span>Despesa interna do Hotel</span>
        </label>

        {addPagamento ? (
          <div className={styles.pagamentoChip}>
            <PayMethodIcon descricao={iconPag(addPagamento)} size={13} />
            <span>{descPag(addPagamento)}</span>
            <button className={styles.pagamentoEdit} onClick={() => setShowPaymentAdd(true)}>
              Alterar
            </button>
          </div>
        ) : (
          <button className={styles.definePagamento} onClick={() => setShowPaymentAdd(true)}>
            <CreditCard size={13} /> Definir Pagamento *
          </button>
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
        <FormField label="Tipo">
          <Select value={editTipoRegistro} onChange={e => setEditTipoRegistro(e.target.value)}>
            <option value="ENTRADA">Receita (+)</option>
            <option value="SAIDA">Despesa (−)</option>
          </Select>
        </FormField>
        <FormField label="Quarto">
          <Select value={editQuarto} onChange={e => setEditQuarto(e.target.value)}>
            <option value="">Nenhum</option>
            {quartos.map(q => <option key={q.id} value={q.id}>{fmtQuarto(q)}</option>)}
          </Select>
        </FormField>
        <label className={styles.checkRow}>
          <input type="checkbox" checked={editPessoal}
            onChange={e => setEditPessoal(e.target.checked)} />
          <span>Despesa interna do Hotel</span>
        </label>

        {editPagamento ? (
          <div className={styles.pagamentoChip}>
            <PayMethodIcon descricao={editPagamento.tipo_pagamento?.descricao} size={13} />
            <span>{descPag(editPagamento)}</span>
            <button className={styles.pagamentoEdit} onClick={() => setShowPaymentEdit(true)}>
              Alterar
            </button>
          </div>
        ) : (
          <button className={styles.definePagamento} onClick={() => setShowPaymentEdit(true)}>
            <CreditCard size={13} /> Definir Pagamento
          </button>
        )}
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
            {quartos.map(q => <option key={q.id} value={q.id}>{fmtQuarto(q)}</option>)}
          </Select>
        </FormField>
        <FormField label="Funcionário">
          <Select value={fFuncId} onChange={e => setFFuncId(e.target.value)}>
            <option value="">Selecione</option>
            {funcionarios.map(f => (
              <option key={f.id} value={f.id}>{f.pessoa?.nome}</option>
            ))}
          </Select>
        </FormField>
      </Modal>

      {/* ══ PAYMENT MODALS ══════════════════════════════════ */}
      <PaymentModal
        open={showPaymentAdd}
        onClose={() => setShowPaymentAdd(false)}
        onConfirm={pag => { setAddPagamento(pag); setShowPaymentAdd(false); }}
        tiposPagamento={tiposPagamento}
        defaultValor={parseBRL(addForm.valor)}
        tipoRegistro={addForm.tipoRegistro}
        loggedUser={loggedUser}
      />
      <PaymentModal
        open={showPaymentEdit}
        onClose={() => setShowPaymentEdit(false)}
        onConfirm={pag => { setEditPagamento(pag); setShowPaymentEdit(false); }}
        tiposPagamento={tiposPagamento}
        initialPayment={editPagamento}
        defaultValor={Math.abs(editPagamento?.valor ?? 0)}
        tipoRegistro={editTipoRegistro}
        loggedUser={loggedUser}
      />

      <Notification notification={notification} />
    </div>
  );
}
