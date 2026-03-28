import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Package, Search, Plus, Edit2, Tag, Minus,
  History, Loader2, RefreshCw, Calendar, Boxes, CreditCard,
} from 'lucide-react';
import { Modal }                    from '../../components/ui/Modal';
import { Button }                   from '../../components/ui/Button';
import { Input, Select, FormField } from '../../components/ui/Input';
import { Notification }             from '../../components/ui/Notification';
import { PaymentModal }             from '../../components/ui/PaymentModal';
import { itemApi, categoriaApi, enumApi, quartoApi } from '../../services/api';
import { usePermissions }           from '../../hooks/usePermissions';
import styles from './InventoryManagement.module.css';

// ── Money helpers ────────────────────────────────────────────
const maskBRL = (v) => {
  const digits = String(v ?? '').replace(/\D/g, '');
  if (!digits) return '';
  const num = parseInt(digits, 10) / 100;
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num);
};
const parseBRL = (v) => {
  const s = String(v ?? '').replace(/[R$\s.]/g, '').replace(',', '.');
  return parseFloat(s) || 0;
};
const fmtBRL  = (v) => v == null ? 'R$ 0,00' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
const fmtDate = (v) => v ?? '—';

// ── Item field accessors ─────────────────────────────────────
const itemQty    = (i) => i?.quantidade_total ?? i?.quantidadeTotal ?? i?.quantidade ?? 0;
const itemCompra = (i) => i?.valor_compra_unidade ?? i?.valorCompraUnidade ?? i?.valorCompra ?? 0;
const itemVenda  = (i) => i?.valor_venda_unidade  ?? i?.valorVendaUnidade  ?? i?.valor_venda  ?? i?.valorVenda ?? 0;
const itemDesc   = (i) => i?.descricao ?? i?.nome ?? '';
const itemForn   = (i) => i?.fornecedor ?? '';
const itemCatId  = (i) => i?.categoria_item?.id ?? i?.categoriaItem?.id ?? i?.categoriaId ?? '';

// ── Reposicao entry accessors ────────────────────────────────
const repQty    = (r) => r?.quantidade_unidades ?? r?.qtdUnidades ?? 0;
const repCompra = (r) => r?.valor_compra_unidade ?? r?.valorCompraUnidade ?? 0;
const repVenda  = (r) => r?.valor_venda_unidade  ?? r?.valorVendaUnidade  ?? 0;

const repForn   = (r) => r?.fornecedor ?? '—';
const repFunc   = (r) => r?.funcionario?.nome ?? r?.funcionarioNome ?? '—';
const repData   = (r) => r?.data_hora_registro ?? r?.dataHoraRegistro ?? null;

export default function InventoryManagement() {
  const { loggedUser, can } = usePermissions();
  const canAplicarDesconto  = can('FINANCEIRO', 'APLICAR DESCONTO');

  // ── Sections (category + its items) ────────────────────────
  const [sections, setSections]   = useState([]);
  const [loading, setLoading]     = useState(true);

  // ── Tipos de pagamento ──────────────────────────────────────
  const [tiposPagamento, setTiposPagamento] = useState([]);

  // ── Quartos ─────────────────────────────────────────────────
  const [quartos, setQuartos] = useState([]);

  // ── Search ──────────────────────────────────────────────────
  const [search, setSearch] = useState('');

  // ── Notification ────────────────────────────────────────────
  const [notification, setNotification] = useState(null);

  // ── Item form modal ────────────────────────────────────────
  const [itemFormModal, setItemFormModal] = useState(null);
  const [selectedItem, setSelectedItem]   = useState(null);
  const [itemForm, setItemForm]           = useState({ descricao: '', categoriaId: '' });
  const [itemSaving, setItemSaving]       = useState(false);

  // ── Category form modal ────────────────────────────────────
  const [catFormModal, setCatFormModal] = useState(null);
  const [editingCat, setEditingCat]     = useState(null);
  const [catForm, setCatForm]           = useState({ nome: '', descricao: '' });
  const [catSaving, setCatSaving]       = useState(false);

  // ── Repor estoque modal ────────────────────────────────────
  const [reporModal, setReporModal]   = useState(false);
  const [reporItem, setReporItem]     = useState(null);
  const [reporForm, setReporForm]     = useState({
    quantidade_unidades: '', fornecedor: '',
    valor_compra_unidade: '', valor_venda_unidade: '',
  });
  const [reporSaving, setReporSaving] = useState(false);

  // ── Consumir modal ─────────────────────────────────────────
  const [consumirModal, setConsumiModal]         = useState(false);
  const [consumirItem, setConsumiItem]           = useState(null);
  const [consumirQtd, setConsumiQtd]             = useState('');
  const [consumirSaving, setConsumiSaving]       = useState(false);
  const [consumirPagamento, setConsumiPagamento]   = useState(null);
  const [showConsumiPag, setShowConsumiPag]        = useState(false);
  const [consumirDespesa, setConsumiDespesa]       = useState(false);
  const [consumirQuarto, setConsumiQuarto]           = useState('');
  const [quartoItens, setQuartoItens]               = useState([]);
  const [quartoItensLoading, setQuartoItensLoading] = useState(false);

  // ── Historico de reposições modal ──────────────────────────
  const [historicoModal, setHistoricoModal]         = useState(false);
  const [historicoItem, setHistoricoItem]           = useState(null);
  const [historicoReposicao, setHistoricoReposicao] = useState([]);
  const [historicoLoading, setHistoricoLoading]     = useState(false);

  // ── Editar entrada de historico ────────────────────────────
  const [editHistModal, setEditHistModal]   = useState(false);
  const [editHistEntry, setEditHistEntry]   = useState(null);
  const [editHistForm, setEditHistForm]     = useState({ quantidade_unidades: '', fornecedor: '' });
  const [editHistSaving, setEditHistSaving] = useState(false);

  // ── Historico de consumos modal ────────────────────────────
  const [consumosModal, setConsumosModal]     = useState(false);
  const [consumos, setConsumos]               = useState([]);
  const [consumosLoading, setConsumosLoading] = useState(false);
  const [consumoDetalhe, setConsumoDetalhe]     = useState(null);
  const [cancelandoConsumo, setCancelandoConsumo] = useState(false);
  const [confirmCancelar, setConfirmCancelar]   = useState(false);

  // ── Helpers ─────────────────────────────────────────────────
  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3500);
  };

  // ── Load all sections ───────────────────────────────────────
  const loadSections = useCallback(async () => {
    setLoading(true);
    try {
      const data = await itemApi.estoque();
      const cats = data?.categorias ?? [];
      setSections(cats.map((c) => ({ ...c, items: c.itens ?? [] })));
    } catch (e) {
      showNotification('Erro ao carregar inventário: ' + e.message, 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSections(); }, [loadSections]);
  useEffect(() => { enumApi.tipoPagamento().then(setTiposPagamento).catch(() => {}); }, []);
  useEffect(() => { quartoApi.listar({ size: 900 }).then(r => setQuartos(r?.content ?? [])).catch(() => {}); }, []);

  // ── Search (frontend filter) ─────────────────────────────────
  const handleSearch = (e) => setSearch(e.target.value);

  // ── Item form ──────────────────────────────────────────────
  const openCreateItem = (cat) => {
    setItemForm({ descricao: '', categoriaId: cat?.id ?? '' });
    setSelectedItem(null);
    setItemFormModal('create');
  };

  const openEditItem = (item, catId) => {
    setItemForm({ descricao: itemDesc(item), categoriaId: catId ?? itemCatId(item) });
    setSelectedItem(item);
    setItemFormModal('edit');
  };

  const handleSaveItem = async () => {
    const { descricao, categoriaId } = itemForm;
    if (!descricao.trim() || !categoriaId) {
      showNotification('Preencha todos os campos obrigatórios.', 'error');
      return;
    }
    setItemSaving(true);
    try {
      const body = { descricao: descricao.trim(), categoria_item: { id: Number(categoriaId) } };
      if (itemFormModal === 'create') {
        await itemApi.criar(body);
        showNotification('Item criado com sucesso!');
      } else {
        await itemApi.atualizar({ ...body, id: selectedItem.id });
        showNotification('Item atualizado com sucesso!');
      }
      setItemFormModal(null);
      loadSections();
    } catch (e) {
      showNotification('Erro: ' + e.message, 'error');
    } finally {
      setItemSaving(false);
    }
  };

  // ── Category form ──────────────────────────────────────────
  const openCreateCat = () => {
    setCatForm({ nome: '', descricao: '' });
    setEditingCat(null);
    setCatFormModal('create');
  };

  const openEditCat = (cat) => {
    setCatForm({ nome: cat.nome ?? cat.categoria ?? '', descricao: cat.descricao ?? '' });
    setEditingCat(cat);
    setCatFormModal('edit');
  };

  const handleSaveCat = async () => {
    if (!catForm.nome.trim()) {
      showNotification('Informe o nome da categoria.', 'error');
      return;
    }
    setCatSaving(true);
    try {
      if (catFormModal === 'create') {
        await categoriaApi.criar({ nome: catForm.nome.trim(), descricao: catForm.descricao.trim() });
        showNotification('Categoria criada com sucesso!');
      } else {
        await categoriaApi.atualizar(editingCat.id, {
          id: editingCat.id, nome: catForm.nome.trim(), descricao: catForm.descricao.trim(),
        });
        showNotification('Categoria atualizada com sucesso!');
      }
      setCatFormModal(null);
      loadSections();
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
      quantidade_unidades:  '',
      fornecedor:           itemForn(item),
      valor_compra_unidade: maskBRL(String(Math.round(itemCompra(item) * 100))),
      valor_venda_unidade:  maskBRL(String(Math.round(itemVenda(item)  * 100))),
    });
    setReporModal(true);
  };

  const handleRepor = async () => {
    const compra = parseBRL(reporForm.valor_compra_unidade);
    const venda  = parseBRL(reporForm.valor_venda_unidade);
    if (!reporForm.quantidade_unidades || !reporForm.fornecedor.trim() || !compra || !venda) {
      showNotification('Preencha todos os campos obrigatórios.', 'error');
      return;
    }
    setReporSaving(true);
    try {
      await itemApi.criarHistoricoReposicao({
        item:                { id: reporItem.id },
        fornecedor:          reporForm.fornecedor.trim(),
        quantidade_unidades: parseInt(reporForm.quantidade_unidades, 10),
        valor_compra_unidade: compra,
        valor_venda_unidade:  venda,
      });
      showNotification('Estoque reposto com sucesso!');
      setReporModal(false);
      loadSections();
    } catch (e) {
      showNotification('Erro: ' + e.message, 'error');
    } finally {
      setReporSaving(false);
    }
  };

  // ── Consumir ────────────────────────────────────────────────
  const openConsumir = (item, e) => {
    e?.stopPropagation();
    setConsumiItem(item);
    setConsumiQtd('');
    setConsumiPagamento(null);
    setConsumiDespesa(false);
    setConsumiQuarto('');
    setQuartoItens([]);
    setConsumiModal(true);
  };

  const handleConsumir = async () => {
    const qty = Number(consumirQtd);
    if (!consumirQtd || qty <= 0) {
      showNotification('Informe a quantidade.', 'error');
      return;
    }
    if (consumirQuarto) {
      const entrada = quartoItens.find(qi => qi.item?.id === consumirItem?.id);
      if (!entrada) {
        showNotification('Este item não está configurado para o quarto selecionado.', 'error');
        return;
      }
      if (qty > entrada.quantidade_atual) {
        showNotification(`Quantidade maior que o disponível no quarto (${entrada.quantidade_atual} un.).`, 'error');
        return;
      }
    }
    if (!consumirPagamento && !consumirDespesa) {
      showNotification('Defina o pagamento antes de confirmar.', 'error');
      return;
    }
    if (consumirPagamento && !consumirDespesa) {
      const esperado = qty * itemVenda(consumirItem);
      const pago     = consumirPagamento.valor ?? 0;
      if (Math.abs(esperado - pago) > 0.01) {
        showNotification('O valor pago diverge do valor esperado. Corrija o pagamento ou marque como despesa pessoal.', 'error');
        return;
      }
    }
    setConsumiSaving(true);
    try {
      const pagamentoBody = consumirPagamento
        ? (() => { const { _arquivo, _arquivoRemov, ...rest } = consumirPagamento; return { ...rest, funcionario: { id: loggedUser?.id } }; })()
        : null;
      await itemApi.consumir({
        item:            { id: consumirItem.id },
        quantidade:      qty,
        despesa_pessoal: consumirDespesa,
        ...(pagamentoBody ? { pagamento: pagamentoBody } : {}),
        ...(consumirQuarto ? { quarto: { id: Number(consumirQuarto) } } : {}),
      });
      showNotification('Item consumido com sucesso!');
      setConsumiModal(false);
      loadSections();
    } catch (e) {
      showNotification('Erro: ' + e.message, 'error');
    } finally {
      setConsumiSaving(false);
    }
  };

  // ── Editar entrada de historico ────────────────────────────
  const openEditHist = (entry) => {
    setEditHistEntry(entry);
    setEditHistForm({
      quantidade_unidades: String(repQty(entry)),
      fornecedor:          repForn(entry) === '—' ? '' : repForn(entry),
    });
    setEditHistModal(true);
  };

  const handleSaveHist = async () => {
    if (!editHistForm.quantidade_unidades || Number(editHistForm.quantidade_unidades) <= 0) {
      showNotification('Informe a quantidade.', 'error');
      return;
    }
    setEditHistSaving(true);
    try {
      await itemApi.atualizarHistoricoReposicao({
        id:                  editHistEntry.id,
        quantidade_unidades: Number(editHistForm.quantidade_unidades),
        fornecedor:          editHistForm.fornecedor.trim() || null,
      });
      showNotification('Reposição atualizada com sucesso!');
      setEditHistModal(false);
      // recarrega o historico do item atual
      const repos = await itemApi.historicoReposicao(historicoItem.id);
      setHistoricoReposicao(Array.isArray(repos) ? repos : (repos?.itemReposicaoList ?? []));
    } catch (e) {
      showNotification('Erro: ' + e.message, 'error');
    } finally {
      setEditHistSaving(false);
    }
  };

  // ── Historico de consumos (hotel) ──────────────────────────
  const openConsumos = async () => {
    setConsumosModal(true);
    setConsumos([]);
    setConsumosLoading(true);
    try {
      const data = await itemApi.listarConsumos();
      setConsumos(Array.isArray(data) ? data : []);
    } catch (e) {
      showNotification('Erro ao carregar consumos: ' + e.message, 'error');
    } finally {
      setConsumosLoading(false);
    }
  };

  // ── Historico de reposições ─────────────────────────────────
  const openHistorico = async (item, e) => {
    e?.stopPropagation();
    setHistoricoItem(item);
    setHistoricoModal(true);
    setHistoricoReposicao([]);
    setHistoricoLoading(true);
    try {
      const repos = await itemApi.historicoReposicao(item.id);
      setHistoricoReposicao(Array.isArray(repos) ? repos : (repos?.itemReposicaoList ?? []));
    } catch (e) {
      showNotification('Erro ao carregar histórico: ' + e.message, 'error');
    } finally {
      setHistoricoLoading(false);
    }
  };

  // ── Cancelar consumo ────────────────────────────────────────
  const handleCancelarConsumo = async () => {
    if (!consumoDetalhe) return;
    setCancelandoConsumo(true);
    try {
      await itemApi.cancelarConsumo(consumoDetalhe.id);
      showNotification('Consumo cancelado com sucesso!');
      setConsumoDetalhe(null);
      setConfirmCancelar(false);
      const data = await itemApi.listarConsumos();
      setConsumos(Array.isArray(data) ? data : []);
      loadSections();
    } catch (e) {
      showNotification('Erro ao cancelar: ' + e.message, 'error');
      setConfirmCancelar(false);
    } finally {
      setCancelandoConsumo(false);
    }
  };

  // ── Derived ─────────────────────────────────────────────────
  const categorias = sections.map((s) => ({ id: s.id, nome: s.nome ?? s.categoria }));

  const searchResults = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (term.length < 2) return null;
    return sections.flatMap((s) =>
      (s.items ?? [])
        .filter((i) => itemDesc(i).toLowerCase().includes(term))
        .map((i) => ({ ...i, _catNome: s.nome ?? s.categoria ?? '—' }))
    );
  }, [search, sections]);

  // ── Render ─────────────────────────────────────────────────
  return (
    <div className={styles.page}>
      <Notification notification={notification} />

      <div className={styles.container}>

        {/* ── Toolbar card ── */}
        <div className={styles.card}>
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
              <Button variant="secondary" onClick={openConsumos}>
                <History size={14} /> Consumos
              </Button>
              <Button variant="secondary" onClick={openCreateCat}>
                <Tag size={14} /> Nova Categoria
              </Button>
            </div>
          </div>
        </div>

        {/* ── Body ── */}
        {loading ? (
          <div className={styles.card}>
            <div className={styles.empty}>
              <Loader2 size={28} className={styles.spin} />
              <span>Carregando inventário...</span>
            </div>
          </div>

        ) : searchResults !== null ? (
          /* ── Search results ── */
          <div className={styles.card}>
            {searchResults.length === 0 ? (
              <div className={styles.empty}>
                <Boxes size={32} color="var(--text-2)" />
                <span>Nenhum item encontrado para "{search}"</span>
              </div>
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Categoria</th>
                      <th className={styles.thCenter}>Qtd</th>
                      <th className={styles.thRight}>Venda Un.</th>
                      <th className={styles.thRight}>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {searchResults.map((item) => {
                      const qty = itemQty(item);
                      return (
                        <tr key={item.id} className={styles.row} onClick={() => openEditItem(item)}>
                          <td><span className={styles.itemName}>{itemDesc(item)}</span></td>
                          <td className={styles.tdSecondary}>{item._catNome ?? '—'}</td>
                          <td className={styles.tdCenter}>
                            <span className={[styles.qtyBadge, qty <= 5 ? styles.qtyBadgeLow : styles.qtyBadgeOk].join(' ')}>{qty}</span>
                          </td>
                          <td className={[styles.tdRight, styles.valVenda].join(' ')}>{fmtBRL(itemVenda(item))}</td>
                          <td className={styles.tdRight} onClick={(e) => e.stopPropagation()}>
                            <div className={styles.actionBtns}>
                              {qty > 0 && (
                                <button type="button" className={[styles.actionBtn, styles.actionBtnConsumir].join(' ')} onClick={(e) => openConsumir(item, e)}>
                                  <Minus size={11} /> Consumir
                                </button>
                              )}
                              <button type="button" className={[styles.actionBtn, styles.actionBtnRepor].join(' ')} onClick={(e) => openRepor(item, e)}>
                                <RefreshCw size={11} /> Repor
                              </button>
                              <button type="button" className={[styles.actionBtn, styles.actionBtnHist].join(' ')} onClick={(e) => openHistorico(item, e)}>
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
            )}
          </div>

        ) : sections.length === 0 ? (
          <div className={styles.card}>
            <div className={styles.empty}>
              <Boxes size={32} color="var(--text-2)" />
              <span>Nenhuma categoria cadastrada</span>
            </div>
          </div>

        ) : (
          /* ── Category sections ── */
          <div className={styles.sectionList}>
            {sections.map((section) => {
              const items = section.items ?? [];
              const { quantidade_itens = 0, valor_investido = 0, lucro_potencial = 0 } = section.dashboard ?? {};
              const catNome = section.nome ?? section.categoria ?? '—';

              return (
                <div key={section.id} className={styles.catSection}>

                    {/* Header */}
                    <div className={styles.catSectionHeader}>
                      <div className={styles.catSectionLeft}>
                        <div className={styles.catSectionIcon}>
                          <Package size={17} />
                        </div>
                        <div className={styles.catSectionInfo}>
                          <h3 className={styles.catSectionName}>{catNome}</h3>
                          {section.descricao && (
                            <p className={styles.catSectionDesc}>{section.descricao}</p>
                          )}
                        </div>
                      </div>
                      <div className={styles.catSectionActions}>
                        <Button variant="secondary" onClick={() => openEditCat(section)}>
                          <Edit2 size={13} /> Editar Categoria
                        </Button>
                        <Button variant="primary" onClick={() => openCreateItem(section)}>
                          <Plus size={13} /> Novo Item
                        </Button>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className={styles.catStats}>
                      <span className={styles.catStat}>
                        <span className={styles.catStatLabel}>Itens</span>
                        <span className={styles.catStatValue}>{quantidade_itens}</span>
                      </span>
                      <span className={styles.catStat}>
                        <span className={styles.catStatLabel}>Investido</span>
                        <span className={[styles.catStatValue, styles.catStatRose].join(' ')}>{fmtBRL(valor_investido)}</span>
                      </span>
                      <span className={styles.catStat}>
                        <span className={styles.catStatLabel}>Lucro potencial</span>
                        <span className={[styles.catStatValue, styles.catStatViolet].join(' ')}>{fmtBRL(lucro_potencial)}</span>
                      </span>
                    </div>

                    {/* Items */}
                    {items.length === 0 ? (
                      <div className={styles.emptyCat}>
                        <Package size={16} color="var(--text-2)" />
                        <span>Nenhum item cadastrado</span>
                      </div>
                    ) : (
                      <div className={styles.tableWrap}>
                        <table className={styles.table}>
                          <thead>
                            <tr>
                              <th>Item</th>
                              <th className={styles.thCenter}>Qtd</th>
                              <th className={styles.thRight}>Venda Un.</th>
                              <th className={styles.thRight}>Ações</th>
                            </tr>
                          </thead>
                          <tbody>
                            {items.map((item) => {
                              const qty = itemQty(item);
                              return (
                                <tr key={item.id} className={styles.row} onClick={() => openEditItem(item, section.id)}>
                                  <td><span className={styles.itemName}>{itemDesc(item)}</span></td>
                                  <td className={styles.tdCenter}>
                                    <span className={[styles.qtyBadge, qty <= 5 ? styles.qtyBadgeLow : styles.qtyBadgeOk].join(' ')}>{qty}</span>
                                  </td>
                                  <td className={[styles.tdRight, styles.valVenda].join(' ')}>{fmtBRL(itemVenda(item))}</td>
                                  <td className={styles.tdRight} onClick={(e) => e.stopPropagation()}>
                                    <div className={styles.actionBtns}>
                                      {qty > 0 && (
                                        <button type="button" className={[styles.actionBtn, styles.actionBtnConsumir].join(' ')} onClick={(e) => openConsumir(item, e)}>
                                          <Minus size={11} /> Consumir
                                        </button>
                                      )}
                                      <button type="button" className={[styles.actionBtn, styles.actionBtnRepor].join(' ')} onClick={(e) => openRepor(item, e)}>
                                        <RefreshCw size={11} /> Repor
                                      </button>
                                      <button type="button" className={[styles.actionBtn, styles.actionBtnHist].join(' ')} onClick={(e) => openHistorico(item, e)}>
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
                    )}
                  </div>
                );
              })}
            </div>
          )}
      </div>

      {/* ═══════════════════════════════════════════════════════
          MODAL — Criar / Editar Item
      ═══════════════════════════════════════════════════════ */}
      <Modal
        open={!!itemFormModal}
        onClose={() => setItemFormModal(null)}
        size="sm"
        title={itemFormModal === 'create' ? <><Package size={15} /> Novo Item</> : <><Edit2 size={15} /> Editar Item</>}
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
              placeholder="Ex: DETERGENTE NEUTRO 500ML"
              value={itemForm.descricao}
              onChange={(e) => setItemForm((f) => ({ ...f, descricao: e.target.value.toUpperCase() }))}
            />
          </FormField>
          <FormField label="Categoria *">
            <Select
              value={itemForm.categoriaId}
              onChange={(e) => setItemForm((f) => ({ ...f, categoriaId: e.target.value }))}
            >
              <option value="">Selecione...</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </Select>
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
        title={catFormModal === 'create' ? <><Tag size={15} /> Nova Categoria</> : <><Edit2 size={15} /> Editar Categoria</>}
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
          <FormField label="Nome da Categoria *">
            <Input
              placeholder="EX: BEBIDAS"
              value={catForm.nome}
              onChange={(e) => setCatForm((f) => ({ ...f, nome: e.target.value.toUpperCase() }))}
            />
          </FormField>
          <FormField label="Descrição">
            <Input
              placeholder="DESCRIÇÃO DA CATEGORIA"
              value={catForm.descricao}
              onChange={(e) => setCatForm((f) => ({ ...f, descricao: e.target.value.toUpperCase() }))}
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
              <span className={styles.itemInfoName}>{itemDesc(reporItem)}</span>
              <span className={styles.itemInfoSub}>
                Qtd atual: <strong>{itemQty(reporItem)}</strong> unidades
              </span>
            </div>
            <FormField label="Quantidade (unidades) *">
              <Input
                type="number" placeholder="0" min="1"
                value={reporForm.quantidade_unidades}
                onChange={(e) => setReporForm((f) => ({ ...f, quantidade_unidades: e.target.value }))}
              />
            </FormField>
            <FormField label="Fornecedor *">
              <Input
                placeholder="NOME DO FORNECEDOR"
                value={reporForm.fornecedor}
                onChange={(e) => setReporForm((f) => ({ ...f, fornecedor: e.target.value.toUpperCase() }))}
              />
            </FormField>
            <div className={styles.formRow}>
              <FormField label="Valor de Compra (un.) *">
                <Input
                  placeholder="R$ 0,00"
                  value={reporForm.valor_compra_unidade}
                  onChange={(e) => setReporForm((f) => ({ ...f, valor_compra_unidade: maskBRL(e.target.value) }))}
                />
              </FormField>
              <FormField label="Valor de Venda (un.) *">
                <Input
                  placeholder="R$ 0,00"
                  value={reporForm.valor_venda_unidade}
                  onChange={(e) => setReporForm((f) => ({ ...f, valor_venda_unidade: maskBRL(e.target.value) }))}
                />
              </FormField>
            </div>
          </div>
        )}
      </Modal>

      {/* ═══════════════════════════════════════════════════════
          MODAL — Histórico de Reposições
      ═══════════════════════════════════════════════════════ */}
      <Modal
        open={historicoModal}
        onClose={() => setHistoricoModal(false)}
        size="xl"
        title={
          <span className={styles.histModalTitle}>
            <History size={16} /> Histórico — {historicoItem ? itemDesc(historicoItem) : ''}
          </span>
        }
      >
        <div className={styles.histTabBody}>
          {historicoLoading ? (
            <div className={styles.emptyInline}><Loader2 size={24} className={styles.spin} /></div>
          ) : !historicoReposicao.length ? (
            <div className={styles.emptyInline}>
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
                    <th className={styles.thRight}>Margem</th>
                    <th>Fornecedor</th>
                    <th>Responsável</th>
                    <th className={styles.thRight}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {historicoReposicao.map((entry, idx) => (
                    <tr key={entry.id ?? idx} className={styles.rowHover}>
                      <td><span className={styles.dateCell}><Calendar size={12} />{fmtDate(repData(entry))}</span></td>
                      <td className={styles.tdCenter}>
                        <span className={[styles.qtyBadge, styles.qtyBadgeOk].join(' ')}>+{repQty(entry)}</span>
                      </td>
                      <td className={styles.tdRight}>{fmtBRL(repCompra(entry))}</td>
                      <td className={[styles.tdRight, styles.valVenda].join(' ')}>{fmtBRL(repVenda(entry))}</td>
                      <td className={[styles.tdRight, styles.valTotal].join(' ')}>
                        {repVenda(entry) > 0
                          ? ((repVenda(entry) - repCompra(entry)) / repCompra(entry) * 100).toFixed(1) + '%'
                          : '—'}
                      </td>
                      <td>{repForn(entry)}</td>
                      <td className={styles.tdSecondary}>{repFunc(entry)}</td>
                      <td className={styles.tdRight}>
                        <div className={styles.actionBtns}>
                          <button type="button" className={styles.actionBtn} onClick={() => openEditHist(entry)}>
                            <Edit2 size={11} /> Editar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Modal>
      {/* ═══════════════════════════════════════════════════════
          MODAL — Editar Histórico de Reposição
      ═══════════════════════════════════════════════════════ */}
      <Modal
        open={editHistModal}
        onClose={() => setEditHistModal(false)}
        size="sm"
        title={<><Edit2 size={15} /> Editar Reposição</>}
        footer={
          <div className={styles.modalFooter}>
            <Button variant="secondary" onClick={() => setEditHistModal(false)}>Cancelar</Button>
            <Button variant="primary" onClick={handleSaveHist} disabled={editHistSaving}>
              {editHistSaving && <Loader2 size={14} className={styles.spinInline} />}
              Salvar
            </Button>
          </div>
        }
      >
        {editHistEntry && (
          <div className={styles.formBody}>
            <div className={styles.itemInfoBox}>
              <span className={styles.itemInfoLabel}>Registro</span>
              <span className={styles.itemInfoName}>{fmtDate(repData(editHistEntry))}</span>
              <span className={styles.itemInfoSub}>
                Compra un.: <strong>{fmtBRL(repCompra(editHistEntry))}</strong>
                {' · '}Venda un.: <strong>{fmtBRL(repVenda(editHistEntry))}</strong>
              </span>
            </div>
            <FormField label="Quantidade (unidades) *">
              <Input
                type="number" placeholder="0" min="1"
                value={editHistForm.quantidade_unidades}
                onChange={(e) => setEditHistForm((f) => ({ ...f, quantidade_unidades: e.target.value }))}
              />
            </FormField>
            <FormField label="Fornecedor">
              <Input
                placeholder="NOME DO FORNECEDOR"
                value={editHistForm.fornecedor}
                onChange={(e) => setEditHistForm((f) => ({ ...f, fornecedor: e.target.value.toUpperCase() }))}
              />
            </FormField>
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
            <Button variant="primary" onClick={handleConsumir} disabled={consumirSaving}>
              {consumirSaving && <Loader2 size={14} className={styles.spinInline} />}
              Confirmar
            </Button>
          </div>
        }
      >
        {consumirItem && (() => {
          const qty      = Number(consumirQtd) || 0;
          const esperado = qty * itemVenda(consumirItem);
          const pago     = consumirPagamento?.valor ?? null;
          const diverge  = pago !== null && Math.abs(esperado - pago) > 0.01;
          return (
            <div className={styles.formBody}>
              <div className={styles.itemInfoBox}>
                <span className={styles.itemInfoLabel}>Item selecionado</span>
                <span className={styles.itemInfoName}>{itemDesc(consumirItem)}</span>
                <span className={styles.itemInfoSub}>
                  Qtd atual: <strong>{itemQty(consumirItem)}</strong> unidades
                  {' · '}Venda un.: <strong>{fmtBRL(itemVenda(consumirItem))}</strong>
                </span>
              </div>

              <FormField label="Quantidade a consumir *">
                <Input
                  type="number" placeholder="0" min="1"
                  value={consumirQtd}
                  onChange={(e) => setConsumiQtd(e.target.value)}
                />
              </FormField>

              <FormField label="Quarto">
                <Select
                  value={consumirQuarto}
                  onChange={async (e) => {
                    const id = e.target.value;
                    setConsumiQuarto(id);
                    setQuartoItens([]);
                    if (!id) return;
                    setQuartoItensLoading(true);
                    try {
                      const data = await quartoApi.itens(id);
                      setQuartoItens(Array.isArray(data) ? data : []);
                    } catch { setQuartoItens([]); }
                    finally { setQuartoItensLoading(false); }
                  }}
                >
                  <option value="">Nenhum</option>
                  {quartos.map((q) => (
                    <option key={q.id} value={q.id}>Quarto {q.id} - {q.descricao}</option>
                  ))}
                </Select>
              </FormField>

              {consumirQuarto && (() => {
                if (quartoItensLoading) return (
                  <div className={styles.quartoItensBox}>
                    <Loader2 size={13} className={styles.spinInline} />
                    <span>Carregando itens do quarto...</span>
                  </div>
                );
                const entrada = quartoItens.find(qi => qi.item?.id === consumirItem?.id);
                if (!entrada) return (
                  <div className={styles.quartoItensBox}>
                    <span className={styles.quartoItensNone}>Item não configurado para este quarto</span>
                  </div>
                );
                const { quantidade_atual, quantidade_padrao } = entrada;
                const ok  = quantidade_atual >= quantidade_padrao;
                const qtdExcede = (Number(consumirQtd) || 0) > quantidade_atual;
                return (
                  <div className={qtdExcede ? styles.quartoItensBoxErr : styles.quartoItensBox}>
                    <div className={styles.quartoItensRow}>
                      <span className={styles.quartoItensLabel}>No quarto agora</span>
                      <span className={ok ? styles.quartoItensOk : styles.quartoItensLow}>
                        {quantidade_atual} / {quantidade_padrao}
                      </span>
                    </div>
                    {qtdExcede && (
                      <span className={styles.quartoItensNone} style={{ color: '#ef4444', fontStyle: 'normal' }}>
                        Quantidade maior que o disponível no quarto ({quantidade_atual} un.)
                      </span>
                    )}
                  </div>
                );
              })()}

              <label className={styles.checkboxRow}>
                <input
                  type="checkbox"
                  checked={consumirDespesa}
                  onChange={(e) => setConsumiDespesa(e.target.checked)}
                />
                <span>Despesa pessoal</span>
              </label>

              {consumirPagamento ? (
                <div className={styles.pagamentoChip}>
                  <CreditCard size={13} />
                  <span>
                    {tiposPagamento.find(t => t.id === consumirPagamento.tipo_pagamento?.id)?.descricao
                      ?? consumirPagamento.tipo_pagamento?.descricao ?? '—'}
                    {' · '}{consumirPagamento.nome_pagador ?? '—'}
                    {' · '}{fmtBRL(pago)}
                  </span>
                  <button className={styles.pagamentoEdit} onClick={() => setShowConsumiPag(true)}>
                    Alterar
                  </button>
                </div>
              ) : (
                <button className={styles.definePagamento} onClick={() => setShowConsumiPag(true)}>
                  <CreditCard size={13} /> Definir Pagamento{consumirDespesa ? '' : ' *'}
                </button>
              )}

              {qty > 0 && (
                <div className={diverge ? styles.consumoAlertDiverg : styles.consumoAlert}>
                  <div className={styles.consumoAlertRow}>
                    <span>Valor esperado</span>
                    <strong>{fmtBRL(esperado)}</strong>
                  </div>
                  {pago !== null && (
                    <div className={styles.consumoAlertRow}>
                      <span>Valor informado</span>
                      <strong className={diverge ? styles.valRose : styles.valVenda}>{fmtBRL(pago)}</strong>
                    </div>
                  )}
                  {diverge && !consumirDespesa && (
                    <p className={styles.consumoAlertMsg}>
                      Os valores divergem. Corrija o pagamento ou marque como despesa pessoal.
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })()}
      </Modal>
      <PaymentModal
        open={showConsumiPag}
        onClose={() => setShowConsumiPag(false)}
        onConfirm={(pag) => { setConsumiPagamento(pag); setShowConsumiPag(false); }}
        tiposPagamento={tiposPagamento}
        initialPayment={consumirPagamento ?? undefined}
        tipoRegistro="SAIDA"
        loggedUser={loggedUser}
        canAplicarDesconto={canAplicarDesconto}
      />

      {/* ═══════════════════════════════════════════════════════
          MODAL — Histórico de Consumos
      ═══════════════════════════════════════════════════════ */}
      <Modal
        open={consumosModal}
        onClose={() => setConsumosModal(false)}
        size="xl"
        title={<><History size={16} /> Histórico de Consumos</>}
      >
        <div className={styles.histTabBody}>
          {consumosLoading ? (
            <div className={styles.emptyInline}><Loader2 size={24} className={styles.spin} /></div>
          ) : !consumos.length ? (
            <div className={styles.emptyInline}>
              <Boxes size={24} color="var(--text-2)" />
              <span>Nenhum consumo registrado</span>
            </div>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Item</th>
                    <th className={styles.thCenter}>Qtd</th>
                    <th>Pagamento</th>
                    <th>Quarto</th>
                    <th className={styles.thCenter}>Despesa pessoal</th>
                    <th>Responsável</th>
                    <th className={styles.thCenter}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {consumos.map((c, idx) => (
                    <tr key={c.id ?? idx} className={c.cancelado ? styles.rowCancelado : styles.row} onClick={() => setConsumoDetalhe(c)}>
                      <td>
                        <span className={styles.dateCell}>
                          <Calendar size={12} />{fmtDate(c.data_hora_registro ?? c.dataHoraRegistro)}
                        </span>
                      </td>
                      <td><span className={styles.itemName}>{c.item?.descricao ?? '—'}</span></td>
                      <td className={styles.tdCenter}>
                        <span className={[styles.qtyBadge, styles.qtyBadgeLow].join(' ')}>{c.quantidade}</span>
                      </td>
                      <td>
                        {c.pagamento ? (
                          <>
                            <span className={styles.itemName}>
                              {c.pagamento.tipo_pagamento?.descricao ?? c.pagamento.tipoPagamento?.descricao ?? '—'}
                            </span>
                            <span className={styles.itemSub}>
                              {c.pagamento.nome_pagador ?? c.pagamento.nomePagador ?? ''}
                              {' · '}
                              <span className={styles.valVenda}>{fmtBRL(c.pagamento.valor ?? 0)}</span>
                            </span>
                          </>
                        ) : (
                          <span className={styles.tdSecondary}>—</span>
                        )}
                      </td>
                      <td className={styles.tdSecondary}>
                        {c.quarto ? `Quarto ${c.quarto.id} - ${c.quarto.descricao}` : '—'}
                      </td>
                      <td className={styles.tdCenter}>
                        {c.despesa_pessoal
                          ? <span className={[styles.qtyBadge, styles.qtyBadgeOk].join(' ')}>Sim</span>
                          : <span className={styles.tdSecondary}>—</span>}
                      </td>
                      <td className={styles.tdSecondary}>{c.funcionario?.nome ?? '—'}</td>
                      <td className={styles.tdCenter}>
                        {c.cancelado
                          ? <span className={[styles.qtyBadge, styles.qtyBadgeLow].join(' ')}>Cancelado</span>
                          : <span className={styles.tdSecondary}>—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Modal>

      {/* ═══════════════════════════════════════════════════════
          MODAL — Detalhe do Consumo
      ═══════════════════════════════════════════════════════ */}
      <Modal
        open={!!consumoDetalhe}
        onClose={() => { setConsumoDetalhe(null); setConfirmCancelar(false); }}
        size="sm"
        title={<><History size={15} /> Detalhe do Consumo</>}
        footer={
          <div className={styles.modalFooter}>
            {confirmCancelar ? (
              <>
                <span style={{ fontSize: 12, color: 'var(--text-2)', flex: 1 }}>Confirmar cancelamento?</span>
                <Button variant="secondary" onClick={() => setConfirmCancelar(false)} disabled={cancelandoConsumo}>
                  Não
                </Button>
                <Button variant="danger" onClick={handleCancelarConsumo} disabled={cancelandoConsumo}>
                  {cancelandoConsumo && <Loader2 size={14} className={styles.spinInline} />}
                  Sim, cancelar
                </Button>
              </>
            ) : (
              <>
                <Button variant="secondary" onClick={() => { setConsumoDetalhe(null); setConfirmCancelar(false); }}>Fechar</Button>
                {consumoDetalhe && !consumoDetalhe.cancelado && (
                  <Button variant="danger" onClick={() => setConfirmCancelar(true)}>
                    Cancelar Consumo
                  </Button>
                )}
              </>
            )}
          </div>
        }
      >
        {consumoDetalhe && (() => {
          const c = consumoDetalhe;
          const pag = c.pagamento;
          return (
            <div className={styles.formBody}>
              {/* Item */}
              <div className={styles.itemInfoBox}>
                <span className={styles.itemInfoLabel}>Item</span>
                <span className={styles.itemInfoName}>{c.item?.descricao ?? '—'}</span>
                <span className={styles.itemInfoSub}>
                  ID #{c.item?.id} · Quantidade: <strong>{c.quantidade}</strong>
                </span>
              </div>

              {/* Pagamento */}
              <div className={styles.itemInfoBox}>
                <span className={styles.itemInfoLabel}>Pagamento</span>
                {pag ? (
                  <>
                    <span className={styles.itemInfoName}>
                      {pag.tipo_pagamento?.descricao ?? '—'}
                      {' · '}
                      <span className={styles.valVenda}>{fmtBRL(pag.valor)}</span>
                    </span>
                    <span className={styles.itemInfoSub}>
                      Pagador: <strong>{pag.nome_pagador ?? '—'}</strong>
                    </span>
                    {pag.descricao && (
                      <span className={styles.itemInfoSub}>Descrição: {pag.descricao}</span>
                    )}
                    {pag.desconto != null && (
                      <span className={styles.itemInfoSub}>Desconto: <strong>{fmtBRL(pag.desconto)}</strong></span>
                    )}
                    <span className={styles.itemInfoSub}>
                      Registrado em: {pag.data_hora_registro ?? '—'}
                      {' · '}
                      {pag.cancelado
                        ? <span className={styles.valRose}>Cancelado</span>
                        : <span className={styles.valVenda}>Ativo</span>}
                    </span>
                  </>
                ) : (
                  <span className={styles.itemInfoSub}>Sem pagamento registrado</span>
                )}
              </div>

              {/* Meta */}
              <div className={styles.itemInfoBox}>
                <span className={styles.itemInfoLabel}>Informações</span>
                <span className={styles.itemInfoSub}>
                  Data: <strong>{c.data_hora_registro ?? '—'}</strong>
                </span>
                <span className={styles.itemInfoSub}>
                  Responsável: <strong>{c.funcionario?.nome ?? '—'}</strong>
                </span>
                {c.quarto && (
                  <span className={styles.itemInfoSub}>
                    Quarto: <strong>{c.quarto.descricao ?? `#${c.quarto.id}`}</strong>
                  </span>
                )}
                <span className={styles.itemInfoSub}>
                  Despesa pessoal:{' '}
                  <strong>{c.despesa_pessoal ? 'Sim' : 'Não'}</strong>
                </span>
              </div>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}
