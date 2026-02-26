import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Package, Search, Plus, Edit2, Tag, DollarSign, TrendingUp,
  Boxes, History, Minus, Loader2, RefreshCw, Calendar, AlertTriangle,
} from 'lucide-react';
import { Modal }                     from '../../components/ui/Modal';
import { Button }                    from '../../components/ui/Button';
import { Input, Select, FormField }  from '../../components/ui/Input';
import { Notification }              from '../../components/ui/Notification';
import { itemApi, categoriaApi, enumApi } from '../../services/api';
import styles from './InventoryManagement.module.css';

// ── Helpers ─────────────────────────────────────────────────
const fmtBRL = (v) => {
  if (v == null) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
};
const fmtDate = (iso) => {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString('pt-BR'); } catch { return iso; }
};
const parseNum = (v) => Number(String(v ?? '').replace(',', '.')) || 0;

export default function InventoryManagement() {
  // ── State ──────────────────────────────────────────────────
  const [dashboard, setDashboard]     = useState(null);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState('');
  const [notification, setNotification] = useState(null);
  const searchTimer = useRef(null);

  // Category modal
  const [categoryModal, setCategoryModal] = useState(null);
  const [categoryTab, setCategoryTab]     = useState('itens');

  // Item form modal
  const [itemFormModal, setItemFormModal] = useState(null); // null | 'create' | 'edit'
  const [selectedItem, setSelectedItem]   = useState(null);
  const [itemForm, setItemForm] = useState({
    descricao: '', categoriaId: '', quantidadeTotal: '',
    valorCompraUnidade: '', valorVendaUnidade: '', fornecedor: '',
  });
  const [itemSaving, setItemSaving] = useState(false);

  // Category form modal
  const [catFormModal, setCatFormModal] = useState(null); // null | 'create' | 'edit'
  const [editingCat, setEditingCat]     = useState(null);
  const [catForm, setCatForm]           = useState({ descricao: '' });
  const [catSaving, setCatSaving]       = useState(false);

  // Repor estoque modal
  const [reporModal, setReporModal] = useState(false);
  const [reporItem, setReporItem]   = useState(null);
  const [reporForm, setReporForm]   = useState({ qtdUnidades: '', valorCompraUnidade: '', valorVendaUnidade: '', fornecedor: '' });
  const [reporSaving, setReporSaving] = useState(false);

  // Consumir item modal
  const [consumirModal, setConsumiModal]   = useState(false);
  const [consumirItem, setConsumiItem]     = useState(null);
  const [consumirForm, setConsumiForm]     = useState({ qtdUnidades: '', quartoId: '', tipoPagamentoId: '', despesaPessoal: false });
  const [consumirSaving, setConsumiSaving] = useState(false);
  const [tiposPagamento, setTiposPagamento] = useState([]);

  // Historico modal
  const [historicoModal, setHistoricoModal]         = useState(false);
  const [historicoItem, setHistoricoItem]           = useState(null);
  const [historicoReposicao, setHistoricoReposicao] = useState(null);
  const [historicoPrecos, setHistoricoPrecos]       = useState([]);
  const [historicoLoading, setHistoricoLoading]     = useState(false);
  const [historicoTab, setHistoricoTab]             = useState('reposicao');

  // ── Notification helper ────────────────────────────────────
  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3500);
  };

  // ── Load dashboard ─────────────────────────────────────────
  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const data = await itemApi.dashboard();
      setDashboard(data);
    } catch (e) {
      showNotification('Erro ao carregar inventário: ' + e.message, 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
    enumApi.tipoPagamento().then(setTiposPagamento).catch(() => {});
  }, [loadDashboard]);

  // ── Search (client-side filter) ────────────────────────────
  const handleSearch = (e) => {
    clearTimeout(searchTimer.current);
    setSearch(e.target.value);
  };

  // ── Filtered categories ────────────────────────────────────
  const categorias = dashboard?.categorias ?? [];
  const filteredCategorias = search.length < 2
    ? categorias
    : categorias
        .map((cat) => ({
          ...cat,
          itens: (cat.itens ?? []).filter((item) => {
            const term = search.toLowerCase();
            return (
              (item.descricao ?? item.nome ?? '').toLowerCase().includes(term) ||
              (item.fornecedor ?? '').toLowerCase().includes(term)
            );
          }),
        }))
        .filter((cat) => cat.itens.length > 0);

  // ── KPI data ───────────────────────────────────────────────
  const kpis = dashboard ? [
    { label: 'Categorias',       sub: 'Categorias cadastradas',     value: dashboard.totalCategorias ?? categorias.length,  color: 'blue',    icon: <Tag size={18} /> },
    { label: 'Total de Itens',   sub: 'Tipos de itens cadastrados', value: dashboard.totalDeItens ?? 0,                     color: 'violet',  icon: <Package size={18} /> },
    { label: 'Valor Investido',  sub: 'Total em estoque (custo)',   value: fmtBRL(dashboard.valorTotalInvestido),           color: 'rose',    icon: <DollarSign size={18} /> },
    { label: 'Lucro Potencial',  sub: 'Lucro estimado total',       value: fmtBRL(dashboard.lucro),                         color: 'emerald', icon: <TrendingUp size={18} /> },
  ] : [];

  // ── Category modal ─────────────────────────────────────────
  const openCategoryModal = (cat) => { setCategoryModal(cat); setCategoryTab('itens'); };
  const closeCategoryModal = () => setCategoryModal(null);

  // ── Item form ──────────────────────────────────────────────
  const openCreateItem = (cat) => {
    setItemForm({ descricao: '', categoriaId: cat?.id ?? '', quantidadeTotal: '', valorCompraUnidade: '', valorVendaUnidade: '', fornecedor: '' });
    setSelectedItem(null);
    setItemFormModal('create');
  };

  const openEditItem = (item) => {
    setItemForm({
      descricao:           item.descricao ?? item.nome ?? '',
      categoriaId:         item.categoriaId ?? '',
      quantidadeTotal:     item.quantidadeTotal ?? item.quantidade ?? '',
      valorCompraUnidade:  item.valorCompraUnidade ?? item.valorCompra ?? '',
      valorVendaUnidade:   item.valorVendaUnidade ?? item.valorVenda ?? '',
      fornecedor:          item.fornecedor ?? '',
    });
    setSelectedItem(item);
    setItemFormModal('edit');
  };

  const handleSaveItem = async () => {
    if (!itemForm.descricao.trim() || !itemForm.categoriaId) {
      showNotification('Preencha descrição e categoria.', 'error');
      return;
    }
    setItemSaving(true);
    try {
      const body = {
        descricao:          itemForm.descricao.trim(),
        categoriaId:        Number(itemForm.categoriaId),
        quantidadeTotal:    Number(itemForm.quantidadeTotal) || 0,
        valorCompraUnidade: parseNum(itemForm.valorCompraUnidade),
        valorVendaUnidade:  parseNum(itemForm.valorVendaUnidade),
        fornecedor:         itemForm.fornecedor.trim(),
      };
      if (itemFormModal === 'create') {
        await itemApi.criar(body);
        showNotification('Item criado com sucesso!');
      } else {
        await itemApi.atualizar(selectedItem.id, body);
        showNotification('Item atualizado com sucesso!');
      }
      setItemFormModal(null);
      loadDashboard();
    } catch (e) {
      showNotification('Erro: ' + e.message, 'error');
    } finally {
      setItemSaving(false);
    }
  };

  // ── Category form ──────────────────────────────────────────
  const openCreateCat = () => {
    setCatForm({ descricao: '' });
    setEditingCat(null);
    setCatFormModal('create');
  };

  const openEditCat = (cat) => {
    setCatForm({ descricao: cat.descricao ?? cat.nome ?? '' });
    setEditingCat(cat);
    setCatFormModal('edit');
  };

  const handleSaveCat = async () => {
    if (!catForm.descricao.trim()) {
      showNotification('Informe a descrição da categoria.', 'error');
      return;
    }
    setCatSaving(true);
    try {
      if (catFormModal === 'create') {
        await categoriaApi.criar({ descricao: catForm.descricao.trim() });
        showNotification('Categoria criada com sucesso!');
      } else {
        await categoriaApi.atualizar(editingCat.id, { descricao: catForm.descricao.trim() });
        showNotification('Categoria atualizada com sucesso!');
      }
      setCatFormModal(null);
      if (categoryModal) closeCategoryModal();
      loadDashboard();
    } catch (e) {
      showNotification('Erro: ' + e.message, 'error');
    } finally {
      setCatSaving(false);
    }
  };

  // ── Repor estoque ──────────────────────────────────────────
  const openRepor = (item, e) => {
    e?.stopPropagation();
    setReporItem(item);
    setReporForm({
      qtdUnidades:        '',
      valorCompraUnidade: String(item.valorCompraUnidade ?? item.valorCompra ?? ''),
      valorVendaUnidade:  String(item.valorVendaUnidade ?? item.valorVenda ?? ''),
      fornecedor:         item.fornecedor ?? '',
    });
    setReporModal(true);
  };

  const handleRepor = async () => {
    if (!reporForm.qtdUnidades || !reporForm.fornecedor.trim()) {
      showNotification('Preencha quantidade e fornecedor.', 'error');
      return;
    }
    setReporSaving(true);
    try {
      await itemApi.repor(reporItem.id, {
        qtdUnidades:        Number(reporForm.qtdUnidades),
        valorCompraUnidade: parseNum(reporForm.valorCompraUnidade),
        valorVendaUnidade:  parseNum(reporForm.valorVendaUnidade),
        fornecedor:         reporForm.fornecedor.trim(),
      });
      showNotification('Estoque reposto com sucesso!');
      setReporModal(false);
      loadDashboard();
    } catch (e) {
      showNotification('Erro: ' + e.message, 'error');
    } finally {
      setReporSaving(false);
    }
  };

  // ── Consumir item ──────────────────────────────────────────
  const openConsumir = (item, e) => {
    e?.stopPropagation();
    setConsumiItem(item);
    setConsumiForm({ qtdUnidades: '', quartoId: '', tipoPagamentoId: '', despesaPessoal: false });
    setConsumiModal(true);
  };

  const handleConsumir = async () => {
    if (!consumirForm.qtdUnidades) {
      showNotification('Informe a quantidade.', 'error');
      return;
    }
    setConsumiSaving(true);
    try {
      const body = {
        qtdUnidades:   Number(consumirForm.qtdUnidades),
        despesaPessoal: consumirForm.despesaPessoal,
      };
      if (consumirForm.quartoId)      body.quartoId      = Number(consumirForm.quartoId);
      if (consumirForm.tipoPagamentoId) body.tipoPagamentoId = Number(consumirForm.tipoPagamentoId);
      await itemApi.consumir(consumirItem.id, body);
      showNotification('Item consumido com sucesso!');
      setConsumiModal(false);
      loadDashboard();
    } catch (e) {
      showNotification('Erro: ' + e.message, 'error');
    } finally {
      setConsumiSaving(false);
    }
  };

  // ── Historico ──────────────────────────────────────────────
  const openHistorico = async (item, e) => {
    e?.stopPropagation();
    setHistoricoItem(item);
    setHistoricoModal(true);
    setHistoricoTab('reposicao');
    setHistoricoReposicao(null);
    setHistoricoPrecos([]);
    setHistoricoLoading(true);
    try {
      const [repos, precos] = await Promise.all([
        itemApi.historicoReposicao(item.id),
        itemApi.historicoPreco(item.id),
      ]);
      setHistoricoReposicao(repos);
      setHistoricoPrecos(Array.isArray(precos) ? precos : []);
    } catch (e) {
      showNotification('Erro ao carregar histórico: ' + e.message, 'error');
    } finally {
      setHistoricoLoading(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────
  return (
    <div className={styles.page}>
      <Notification notification={notification} />

      <div className={styles.container}>

        {/* ── KPI cards ── */}
        {!loading && dashboard && (
          <div className={styles.kpiGrid}>
            {kpis.map((k) => (
              <div key={k.label} className={[styles.kpiCard, styles[`kpi_${k.color}`]].join(' ')}>
                <div className={styles.kpiIcon}>{k.icon}</div>
                <div className={styles.kpiBody}>
                  <span className={styles.kpiLabel}>{k.label}</span>
                  <span className={styles.kpiValue}>{k.value}</span>
                  <span className={styles.kpiSub}>{k.sub}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Main card ── */}
        <div className={styles.card}>
          {/* Toolbar inside card */}
          <div className={styles.tableHeader}>
            <div>
              <h2 className={styles.h2}>Itens e Almoxarifado</h2>
              <p className={styles.subtitle}>Gestão de estoque e inventário por categoria</p>
            </div>
            <div className={styles.tableTools}>
              <div className={styles.searchWrap}>
                <Search size={14} className={styles.searchIcon} />
                <Input
                  className={styles.searchInput}
                  placeholder="Buscar item..."
                  value={search}
                  onChange={handleSearch}
                />
              </div>
              <Button variant="secondary" onClick={openCreateCat}>
                <Tag size={14} /> Nova Categoria
              </Button>
              <Button variant="primary" onClick={() => openCreateItem(null)}>
                <Plus size={15} /> Novo Item
              </Button>
            </div>
          </div>

          {/* Content area */}
          {loading ? (
            <div className={styles.empty}>
              <Loader2 size={28} className={styles.spin} />
              <span>Carregando inventário...</span>
            </div>
          ) : filteredCategorias.length === 0 ? (
            <div className={styles.empty}>
              <Boxes size={32} color="var(--text-2)" />
              <span>{search.length >= 2 ? 'Nenhum item encontrado para a busca' : 'Nenhuma categoria cadastrada'}</span>
            </div>
          ) : (
            <div className={styles.catGrid}>
              {filteredCategorias.map((cat) => {
                const count    = cat.itens?.length ?? 0;
                const hasLow   = cat.itens?.some((i) => (i.quantidadeTotal ?? i.quantidade ?? 0) <= 5);
                const itensAtencao = dashboard?.itensComAtencao ?? 0;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    className={[styles.catCard, hasLow ? styles.catCardLow : ''].join(' ')}
                    onClick={() => openCategoryModal(cat)}
                  >
                    <div className={styles.catCardInner}>
                      <div className={[styles.catIcon, hasLow ? styles.catIconLow : ''].join(' ')}>
                        <Package size={20} />
                      </div>
                      <div className={styles.catInfo}>
                        <div className={styles.catNameRow}>
                          <span className={styles.catName}>{cat.descricao ?? cat.nome}</span>
                          <span className={styles.catCount}>{count} {count === 1 ? 'item' : 'itens'}</span>
                        </div>
                        <div className={styles.catFinRow}>
                          <span className={styles.catFinLabel}>Investido:</span>
                          <span className={styles.catFinVal}>{fmtBRL(cat.valorTotalInvestido)}</span>
                          <span className={styles.catFinSep}>·</span>
                          <span className={styles.catFinLabel}>Lucro:</span>
                          <span className={[styles.catFinVal, styles.catFinLucro].join(' ')}>{fmtBRL(cat.lucro)}</span>
                        </div>
                        {hasLow && (
                          <div className={styles.catLowBadge}>
                            <AlertTriangle size={10} /> Itens com estoque baixo
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════
          MODAL — Categoria (Itens + Resumo Financeiro)
      ═══════════════════════════════════════════════════════ */}
      {categoryModal && (
        <Modal
          open={!!categoryModal}
          onClose={closeCategoryModal}
          size="xl"
          title={
            <span className={styles.catModalTitle}>
              <Package size={16} /> {categoryModal.descricao ?? categoryModal.nome}
            </span>
          }
          footer={
            <div className={styles.modalFooter}>
              <Button variant="secondary" onClick={() => { closeCategoryModal(); openEditCat(categoryModal); }}>
                <Edit2 size={14} /> Editar Categoria
              </Button>
              <Button variant="primary" onClick={() => openCreateItem(categoryModal)}>
                <Plus size={14} /> Novo Item
              </Button>
            </div>
          }
        >
          {/* Tabs */}
          <div className={styles.tabs}>
            <button type="button"
              className={[styles.tab, categoryTab === 'itens' ? styles.tabActive : ''].join(' ')}
              onClick={() => setCategoryTab('itens')}
            >
              <Package size={13} /> Itens
            </button>
            <button type="button"
              className={[styles.tab, categoryTab === 'financeiro' ? styles.tabActive : ''].join(' ')}
              onClick={() => setCategoryTab('financeiro')}
            >
              <DollarSign size={13} /> Resumo Financeiro
            </button>
          </div>

          {/* ── Tab: Itens ── */}
          {categoryTab === 'itens' && (
            !categoryModal.itens?.length ? (
              <div className={styles.empty}>
                <Package size={24} color="var(--text-2)" />
                <span>Nenhum item nesta categoria</span>
              </div>
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th className={styles.thCenter}>Qtd</th>
                      <th className={styles.thRight}>Compra Un.</th>
                      <th className={styles.thRight}>Venda Un.</th>
                      <th className={styles.thRight}>Total Estoque</th>
                      <th>Últ. Reposição</th>
                      <th className={styles.thRight}>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categoryModal.itens.map((item) => {
                      const qty    = item.quantidadeTotal ?? item.quantidade ?? 0;
                      const isLow  = qty <= 5;
                      const compra = item.valorCompraUnidade ?? item.valorCompra ?? 0;
                      return (
                        <tr key={item.id} className={styles.row} onClick={() => openEditItem(item)}>
                          <td>
                            <span className={styles.itemName}>{item.descricao ?? item.nome}</span>
                            {item.fornecedor && <span className={styles.itemSub}>{item.fornecedor}</span>}
                          </td>
                          <td className={styles.tdCenter}>
                            <span className={[styles.qtyBadge, isLow ? styles.qtyBadgeLow : styles.qtyBadgeOk].join(' ')}>
                              {qty}
                            </span>
                          </td>
                          <td className={styles.tdRight}>{fmtBRL(compra)}</td>
                          <td className={[styles.tdRight, styles.valVenda].join(' ')}>
                            {fmtBRL(item.valorVendaUnidade ?? item.valorVenda)}
                          </td>
                          <td className={[styles.tdRight, styles.valTotal].join(' ')}>
                            {fmtBRL(qty * compra)}
                          </td>
                          <td>
                            {item.ultimaReposicao
                              ? <span className={styles.dateCell}><Calendar size={12} />{fmtDate(item.ultimaReposicao)}</span>
                              : <span className={styles.dateEmpty}>—</span>}
                          </td>
                          <td className={styles.tdRight} onClick={(e) => e.stopPropagation()}>
                            <div className={styles.actionBtns}>
                              <button type="button"
                                className={[styles.actionBtn, styles.actionBtnConsumir].join(' ')}
                                onClick={(e) => openConsumir(item, e)}
                              >
                                <Minus size={11} /> Consumir
                              </button>
                              <button type="button"
                                className={[styles.actionBtn, styles.actionBtnRepor].join(' ')}
                                onClick={(e) => openRepor(item, e)}
                              >
                                <RefreshCw size={11} /> Repor
                              </button>
                              <button type="button"
                                className={[styles.actionBtn, styles.actionBtnHist].join(' ')}
                                onClick={(e) => openHistorico(item, e)}
                              >
                                <History size={11} /> Histórico
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )
          )}

          {/* ── Tab: Resumo Financeiro ── */}
          {categoryTab === 'financeiro' && (
            <div className={styles.finTab}>
              <div className={styles.finKpiGrid}>
                {[
                  { label: 'Tipos de Itens',  value: String(categoryModal.itens?.length ?? 0), cls: '' },
                  { label: 'Total Investido', value: fmtBRL(categoryModal.valorTotalInvestido), cls: styles.valRose },
                  { label: 'Valor de Venda',  value: fmtBRL(categoryModal.valorTotalVenda),     cls: styles.valVenda },
                  { label: 'Lucro Potencial', value: fmtBRL(categoryModal.lucro),               cls: styles.valTotal },
                ].map((k) => (
                  <div key={k.label} className={styles.finKpiCard}>
                    <span className={styles.finKpiLabel}>{k.label}</span>
                    <span className={[styles.finKpiValue, k.cls].join(' ')}>{k.value}</span>
                  </div>
                ))}
              </div>
              {categoryModal.itens?.length > 0 && (
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th className={styles.thCenter}>Qtd</th>
                        <th className={styles.thRight}>Compra Un.</th>
                        <th className={styles.thRight}>Venda Un.</th>
                        <th className={styles.thRight}>Margem</th>
                        <th className={styles.thRight}>Lucro Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {categoryModal.itens.map((item) => {
                        const qty    = item.quantidadeTotal ?? item.quantidade ?? 0;
                        const compra = item.valorCompraUnidade ?? item.valorCompra ?? 0;
                        const venda  = item.valorVendaUnidade ?? item.valorVenda ?? 0;
                        const margin = compra > 0 ? ((venda - compra) / compra * 100).toFixed(1) : '—';
                        const lucroTotal = qty * (venda - compra);
                        return (
                          <tr key={item.id} className={styles.rowHover}>
                            <td><span className={styles.itemName}>{item.descricao ?? item.nome}</span></td>
                            <td className={styles.tdCenter}>
                              <span className={[styles.qtyBadge, styles.qtyBadgeOk].join(' ')}>{qty}</span>
                            </td>
                            <td className={styles.tdRight}>{fmtBRL(compra)}</td>
                            <td className={[styles.tdRight, styles.valVenda].join(' ')}>{fmtBRL(venda)}</td>
                            <td className={[styles.tdRight, styles.valTotal].join(' ')}>{margin}{margin !== '—' ? '%' : ''}</td>
                            <td className={[styles.tdRight, styles.valTotal].join(' ')}>{fmtBRL(lucroTotal)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </Modal>
      )}

      {/* ═══════════════════════════════════════════════════════
          MODAL — Criar / Editar Item
      ═══════════════════════════════════════════════════════ */}
      <Modal
        open={!!itemFormModal}
        onClose={() => setItemFormModal(null)}
        size="md"
        title={itemFormModal === 'create'
          ? <><Package size={15} /> Novo Item</>
          : <><Edit2 size={15} /> Editar Item</>}
        footer={
          <div className={styles.modalFooter}>
            <Button variant="secondary" onClick={() => setItemFormModal(null)}>Cancelar</Button>
            <Button variant="primary" onClick={handleSaveItem} disabled={itemSaving}>
              {itemSaving && <Loader2 size={14} className={styles.spinInline} />}
              {itemFormModal === 'create' ? 'Criar Item' : 'Salvar'}
            </Button>
          </div>
        }
      >
        <div className={styles.formBody}>
          <FormField label="Descrição *">
            <Input
              placeholder="Ex: Detergente Neutro 500ml"
              value={itemForm.descricao}
              onChange={(e) => setItemForm((f) => ({ ...f, descricao: e.target.value }))}
            />
          </FormField>
          <FormField label="Categoria *">
            <Select
              value={itemForm.categoriaId}
              onChange={(e) => setItemForm((f) => ({ ...f, categoriaId: e.target.value }))}
            >
              <option value="">Selecione...</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>{c.descricao ?? c.nome}</option>
              ))}
            </Select>
          </FormField>
          {itemFormModal === 'create' && (
            <FormField label="Quantidade inicial">
              <Input
                type="number" placeholder="0" min="0"
                value={itemForm.quantidadeTotal}
                onChange={(e) => setItemForm((f) => ({ ...f, quantidadeTotal: e.target.value }))}
              />
            </FormField>
          )}
          <div className={styles.formRow}>
            <FormField label="Valor de Compra (un.) *">
              <Input
                placeholder="0,00"
                value={itemForm.valorCompraUnidade}
                onChange={(e) => setItemForm((f) => ({ ...f, valorCompraUnidade: e.target.value }))}
              />
            </FormField>
            <FormField label="Valor de Venda (un.) *">
              <Input
                placeholder="0,00"
                value={itemForm.valorVendaUnidade}
                onChange={(e) => setItemForm((f) => ({ ...f, valorVendaUnidade: e.target.value }))}
              />
            </FormField>
          </div>
          <FormField label="Fornecedor">
            <Input
              placeholder="Nome do fornecedor"
              value={itemForm.fornecedor}
              onChange={(e) => setItemForm((f) => ({ ...f, fornecedor: e.target.value }))}
            />
          </FormField>
        </div>
      </Modal>

      {/* ═══════════════════════════════════════════════════════
          MODAL — Criar / Editar Categoria
      ═══════════════════════════════════════════════════════ */}
      <Modal
        open={!!catFormModal}
        onClose={() => setCatFormModal(null)}
        size="sm"
        title={catFormModal === 'create'
          ? <><Tag size={15} /> Nova Categoria</>
          : <><Edit2 size={15} /> Editar Categoria</>}
        footer={
          <div className={styles.modalFooter}>
            <Button variant="secondary" onClick={() => setCatFormModal(null)}>Cancelar</Button>
            <Button variant="primary" onClick={handleSaveCat} disabled={catSaving}>
              {catSaving && <Loader2 size={14} className={styles.spinInline} />}
              {catFormModal === 'create' ? 'Criar Categoria' : 'Salvar'}
            </Button>
          </div>
        }
      >
        <div className={styles.formBody}>
          <FormField label="Descrição da Categoria *">
            <Input
              placeholder="Ex: Limpeza"
              value={catForm.descricao}
              onChange={(e) => setCatForm({ descricao: e.target.value })}
            />
          </FormField>
        </div>
      </Modal>

      {/* ═══════════════════════════════════════════════════════
          MODAL — Repor Estoque
      ═══════════════════════════════════════════════════════ */}
      <Modal
        open={reporModal}
        onClose={() => setReporModal(false)}
        size="md"
        title={<><RefreshCw size={15} /> Repor Estoque</>}
        footer={
          <div className={styles.modalFooter}>
            <Button variant="secondary" onClick={() => setReporModal(false)}>Cancelar</Button>
            <Button variant="primary" onClick={handleRepor} disabled={reporSaving}>
              {reporSaving && <Loader2 size={14} className={styles.spinInline} />}
              Confirmar Reposição
            </Button>
          </div>
        }
      >
        {reporItem && (
          <div className={styles.formBody}>
            <div className={styles.itemInfoBox}>
              <span className={styles.itemInfoLabel}>Item selecionado</span>
              <span className={styles.itemInfoName}>{reporItem.descricao ?? reporItem.nome}</span>
              <span className={styles.itemInfoSub}>
                Qtd atual: <strong>{reporItem.quantidadeTotal ?? reporItem.quantidade ?? 0}</strong>
              </span>
            </div>
            <FormField label="Quantidade a Repor *">
              <Input
                type="number" placeholder="0" min="1"
                value={reporForm.qtdUnidades}
                onChange={(e) => setReporForm((f) => ({ ...f, qtdUnidades: e.target.value }))}
              />
            </FormField>
            <FormField label="Fornecedor *">
              <Input
                placeholder="Nome do fornecedor"
                value={reporForm.fornecedor}
                onChange={(e) => setReporForm((f) => ({ ...f, fornecedor: e.target.value }))}
              />
            </FormField>
            <div className={styles.formRow}>
              <FormField label="Valor de Compra (un.)">
                <Input
                  placeholder="0,00"
                  value={reporForm.valorCompraUnidade}
                  onChange={(e) => setReporForm((f) => ({ ...f, valorCompraUnidade: e.target.value }))}
                />
              </FormField>
              <FormField label="Valor de Venda (un.)">
                <Input
                  placeholder="0,00"
                  value={reporForm.valorVendaUnidade}
                  onChange={(e) => setReporForm((f) => ({ ...f, valorVendaUnidade: e.target.value }))}
                />
              </FormField>
            </div>
          </div>
        )}
      </Modal>

      {/* ═══════════════════════════════════════════════════════
          MODAL — Consumir Item
      ═══════════════════════════════════════════════════════ */}
      <Modal
        open={consumirModal}
        onClose={() => setConsumiModal(false)}
        size="sm"
        title={<><Minus size={15} /> Consumir Item</>}
        footer={
          <div className={styles.modalFooter}>
            <Button variant="secondary" onClick={() => setConsumiModal(false)}>Cancelar</Button>
            <Button variant="danger" onClick={handleConsumir} disabled={consumirSaving}>
              {consumirSaving && <Loader2 size={14} className={styles.spinInline} />}
              Confirmar Consumo
            </Button>
          </div>
        }
      >
        {consumirItem && (
          <div className={styles.formBody}>
            <div className={styles.itemInfoBox}>
              <span className={styles.itemInfoLabel}>Item selecionado</span>
              <span className={styles.itemInfoName}>{consumirItem.descricao ?? consumirItem.nome}</span>
              <span className={styles.itemInfoSub}>
                Disponível: <strong>{consumirItem.quantidadeTotal ?? consumirItem.quantidade ?? 0}</strong>
              </span>
            </div>
            <FormField label="Quantidade *">
              <Input
                type="number" placeholder="0" min="1"
                max={consumirItem.quantidadeTotal ?? consumirItem.quantidade ?? 9999}
                value={consumirForm.qtdUnidades}
                onChange={(e) => setConsumiForm((f) => ({ ...f, qtdUnidades: e.target.value }))}
              />
            </FormField>
            <FormField label="Quarto (opcional)">
              <Input
                type="number" placeholder="Número do quarto" min="1"
                value={consumirForm.quartoId}
                onChange={(e) => setConsumiForm((f) => ({ ...f, quartoId: e.target.value }))}
              />
            </FormField>
            {tiposPagamento.length > 0 && (
              <FormField label="Tipo de Pagamento (opcional)">
                <Select
                  value={consumirForm.tipoPagamentoId}
                  onChange={(e) => setConsumiForm((f) => ({ ...f, tipoPagamentoId: e.target.value }))}
                >
                  <option value="">Sem pagamento registrado</option>
                  {tiposPagamento.map((t) => (
                    <option key={t.id} value={t.id}>{t.descricao}</option>
                  ))}
                </Select>
              </FormField>
            )}
            <label className={styles.checkboxRow}>
              <input
                type="checkbox"
                className={styles.checkbox}
                checked={consumirForm.despesaPessoal}
                onChange={(e) => setConsumiForm((f) => ({ ...f, despesaPessoal: e.target.checked }))}
              />
              <div>
                <span className={styles.checkboxLabel}>Despesa Pessoal</span>
                <span className={styles.checkboxSub}>Marque se este consumo é de uso pessoal e não do hotel</span>
              </div>
            </label>
          </div>
        )}
      </Modal>

      {/* ═══════════════════════════════════════════════════════
          MODAL — Histórico (Reposição + Preços)
      ═══════════════════════════════════════════════════════ */}
      <Modal
        open={historicoModal}
        onClose={() => setHistoricoModal(false)}
        size="xl"
        title={
          <span className={styles.catModalTitle}>
            <History size={16} /> Histórico — {historicoItem?.descricao ?? historicoItem?.nome}
          </span>
        }
      >
        <div className={styles.tabs}>
          <button type="button"
            className={[styles.tab, historicoTab === 'reposicao' ? styles.tabActive : ''].join(' ')}
            onClick={() => setHistoricoTab('reposicao')}
          >
            <Package size={13} /> Reposições
          </button>
          <button type="button"
            className={[styles.tab, historicoTab === 'precos' ? styles.tabActive : ''].join(' ')}
            onClick={() => setHistoricoTab('precos')}
          >
            <Tag size={13} /> Histórico de Preços
          </button>
        </div>

        {historicoLoading ? (
          <div className={styles.empty}><Loader2 size={24} className={styles.spin} /></div>
        ) : historicoTab === 'reposicao' ? (
          <div>
            {historicoReposicao && (
              <div className={styles.histKpiGrid}>
                <div className={styles.histKpiCard}>
                  <span className={styles.histKpiLabel}>Total Investido</span>
                  <span className={[styles.histKpiVal, styles.valRose].join(' ')}>{fmtBRL(historicoReposicao.valorTotalInvestido)}</span>
                </div>
                <div className={styles.histKpiCard}>
                  <span className={styles.histKpiLabel}>Total de Venda</span>
                  <span className={[styles.histKpiVal, styles.valVenda].join(' ')}>{fmtBRL(historicoReposicao.valorTotalVenda)}</span>
                </div>
                <div className={styles.histKpiCard}>
                  <span className={styles.histKpiLabel}>Lucro Total</span>
                  <span className={[styles.histKpiVal, styles.valTotal].join(' ')}>{fmtBRL(historicoReposicao.lucro)}</span>
                </div>
              </div>
            )}
            {!historicoReposicao?.itemReposicaoList?.length ? (
              <div className={styles.empty}>
                <Package size={24} color="var(--text-2)" />
                <span>Nenhuma reposição registrada</span>
              </div>
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th className={styles.thCenter}>Qtd</th>
                      <th className={styles.thRight}>Compra Un.</th>
                      <th className={styles.thRight}>Venda Un.</th>
                      <th className={styles.thRight}>Investido</th>
                      <th className={styles.thRight}>Total Venda</th>
                      <th className={styles.thRight}>Lucro</th>
                      <th>Fornecedor</th>
                      <th>Responsável</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historicoReposicao.itemReposicaoList.map((entry) => (
                      <tr key={entry.id} className={styles.rowHover}>
                        <td><span className={styles.dateCell}><Calendar size={12} />{fmtDate(entry.dataHoraRegistro)}</span></td>
                        <td className={styles.tdCenter}>
                          <span className={[styles.qtyBadge, styles.qtyBadgeOk].join(' ')}>+{entry.qtdUnidades}</span>
                        </td>
                        <td className={styles.tdRight}>{fmtBRL(entry.valorCompraUnidade)}</td>
                        <td className={[styles.tdRight, styles.valVenda].join(' ')}>{fmtBRL(entry.valorVendaUnidade)}</td>
                        <td className={[styles.tdRight, styles.valRose].join(' ')}>{fmtBRL(entry.valorTotalInvestido)}</td>
                        <td className={[styles.tdRight, styles.valVenda].join(' ')}>{fmtBRL(entry.valorTotalVenda)}</td>
                        <td className={[styles.tdRight, styles.valTotal].join(' ')}>{fmtBRL(entry.lucro)}</td>
                        <td>{entry.fornecedor}</td>
                        <td className={styles.tdSecondary}>{entry.funcionarioNome}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          <div>
            {!historicoPrecos.length ? (
              <div className={styles.empty}>
                <Tag size={24} color="var(--text-2)" />
                <span>Nenhum histórico de preços</span>
              </div>
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th className={styles.thRight}>Valor Compra</th>
                      <th className={styles.thRight}>Valor Venda</th>
                      <th className={styles.thRight}>Margem</th>
                      <th>Funcionário</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historicoPrecos.map((entry) => {
                      const margin = entry.valorCompraUnidade > 0
                        ? ((entry.valorVendaUnidade - entry.valorCompraUnidade) / entry.valorCompraUnidade * 100).toFixed(1)
                        : '—';
                      return (
                        <tr key={entry.id} className={styles.rowHover}>
                          <td><span className={styles.dateCell}><Calendar size={12} />{fmtDate(entry.dataHoraRegistro)}</span></td>
                          <td className={styles.tdRight}>{fmtBRL(entry.valorCompraUnidade)}</td>
                          <td className={[styles.tdRight, styles.valVenda].join(' ')}>{fmtBRL(entry.valorVendaUnidade)}</td>
                          <td className={[styles.tdRight, styles.valTotal].join(' ')}>{margin}{margin !== '—' ? '%' : ''}</td>
                          <td className={styles.tdSecondary}>{entry.funcionarioNome}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
