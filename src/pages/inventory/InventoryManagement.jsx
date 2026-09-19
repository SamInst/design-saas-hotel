import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Package, Search, Plus, Edit2, Tag, Minus,
  History, Loader2, RefreshCw, Calendar, Boxes, CreditCard,
  X, ChevronLeft, ChevronRight, AlertTriangle, BedDouble,
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
const itemCompra = (i) => i?.valor_compra_unidade ?? i?.valorCompraUnidade ?? i?.valor_compra ?? i?.valorCompra ?? 0;
const itemVenda  = (i) => i?.valor_venda_unidade  ?? i?.valorVendaUnidade  ?? i?.valor_venda  ?? i?.valorVenda ?? 0;
const itemDesc   = (i) => i?.descricao ?? i?.nome ?? '';
const itemForn   = (i) => i?.fornecedor ?? '';
// Serviço não tem estoque físico: sem quantidade e sem valor de compra.
const itemServico = (i) => i?.servico === true;
const itemCatId  = (i) => i?.categoria_item?.id ?? i?.categoriaItem?.id ?? i?.categoriaId ?? '';

// ── Reposicao entry accessors ────────────────────────────────
const repQty    = (r) => r?.quantidade_unidades ?? r?.qtdUnidades ?? 0;
const repCompra = (r) => r?.valor_compra_unidade ?? r?.valorCompraUnidade ?? 0;
const repVenda  = (r) => r?.valor_venda_unidade  ?? r?.valorVendaUnidade  ?? 0;

const repForn   = (r) => r?.fornecedor ?? '—';
const repFunc   = (r) => r?.funcionario?.nome ?? r?.funcionarioNome ?? '—';
const repData   = (r) => r?.data_hora_registro ?? r?.dataHoraRegistro ?? null;

// A partir de quantas unidades o item entra na lista de estoque baixo.
const LIMITE_ESTOQUE_BAIXO = 5;

// ── Ícone do menu de ações do item ───────────────────────────
// SVG próprio (não vem do lucide); herda a cor do botão via currentColor.
function MenuIcon({ size = 16 }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 512 497.435"
      fill="currentColor" fillRule="evenodd" clipRule="evenodd"
      shapeRendering="geometricPrecision"
      aria-hidden="true" focusable="false"
    >
      <path d="M9.576 0h492.849C507.692 0 512 4.314 512 9.576v61.179c0 5.263-4.313 9.576-9.575 9.576H9.576C4.313 80.331 0 76.023 0 70.755V9.576C0 4.308 4.308 0 9.576 0zm0 417.104h492.849c5.267 0 9.575 4.314 9.575 9.576v61.179c0 5.263-4.313 9.576-9.575 9.576H9.576c-5.263 0-9.576-4.308-9.576-9.576V426.68c0-5.268 4.308-9.576 9.576-9.576zm0-139.035h492.849c5.267 0 9.575 4.313 9.575 9.576v61.179c0 5.262-4.313 9.576-9.575 9.576H9.576C4.313 358.4 0 354.092 0 348.824v-61.179c0-5.268 4.308-9.576 9.576-9.576zm0-139.033h492.849c5.267 0 9.575 4.313 9.575 9.575v61.179c0 5.263-4.313 9.576-9.575 9.576H9.576c-5.263 0-9.576-4.307-9.576-9.576v-61.179c0-5.268 4.308-9.575 9.576-9.575z" />
    </svg>
  );
}

// ── Esqueletos de carregamento ───────────────────────────────
const sk = (...extra) => [styles.sk, ...extra].join(' ');

function SkeletonLista({ linhas = 7 }) {
  return (
    <div role="status" aria-label="Carregando categorias">
      {Array.from({ length: linhas }, (_, i) => (
        <div key={i} className={styles.listItem} aria-hidden="true">
          <span className={styles.listItemBody}>
            <span className={sk(styles.skName)} style={{ width: `${55 + ((i * 13) % 26)}%` }} />
            <span className={sk(styles.skSub)} />
          </span>
        </div>
      ))}
    </div>
  );
}

function SkeletonPainel() {
  return (
    <div className={styles.statGrid} role="status" aria-label="Carregando totais">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className={styles.statCard} aria-hidden="true">
          <span className={sk(styles.skLabel)} />
          <span className={sk(styles.skNumero)} />
        </div>
      ))}
    </div>
  );
}

export default function InventoryManagement() {
  const { loggedUser, can } = usePermissions();
  const canAplicarDesconto  = can('FINANCEIRO', 'APLICAR DESCONTO');

  // ── Permissões da tela de itens ─────────────────────────────
  const canAcessoTotal        = can('ITENS', 'ACESSO TOTAL');
  const canHistReposicoes     = canAcessoTotal || can('ITENS', 'HISTORICO DE REPOSICOES');
  const canDashboardCategoria = canAcessoTotal || can('ITENS', 'DASHBOARD DA CATEGORIA');
  const canAdicionarCategoria = canAcessoTotal || can('ITENS', 'ADICIONAR CATEGORIA');
  const canHistoricoConsumo   = canAcessoTotal || can('ITENS', 'HISTORICO CONSUMO');
  const canAdicionarItem      = canAcessoTotal || can('ITENS', 'ADICIONAR ITEM');
  const canConsumirItem       = canAcessoTotal || can('ITENS', 'CONSUMIR ITEM');
  const canReporItem          = canAcessoTotal || can('ITENS', 'REPOR ITEM');
  const canEditarCategoria    = canAcessoTotal || can('ITENS', 'EDITAR CATEGORIA');

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
  const [itemForm, setItemForm]           = useState({ descricao: '', categoriaId: '', servico: false });
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

  // ── Aba da lista: categorias ou quartos ────────────────────
  const [aba, setAba] = useState('cat'); // 'cat' | 'quarto'

  // ── Item aberto no painel de detalhe ───────────────────────
  const [detailCat, setDetailCat]       = useState(null);
  const [detailQuarto, setDetailQuarto] = useState(null);
  const [itemSearch, setItemSearch]     = useState('');
  // itens cuja distribuição por quarto está expandida
  const [quartosAbertos, setQuartosAbertos] = useState(() => new Set());
  // item cujo menu de ações está aberto, e onde desenhá-lo na tela
  const [menuAberto, setMenuAberto] = useState(null);
  const [menuPos, setMenuPos]       = useState(null);
  const menuBtnRef   = useRef(null);
  const menuPanelRef = useRef(null);

  // ── Historico de reposições (modal, por item) ──────────────
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
    setItemForm({ descricao: '', categoriaId: cat?.id ?? '', servico: false });
    setSelectedItem(null);
    setItemFormModal('create');
  };

  const openEditItem = (item, catId) => {
    setItemForm({
      descricao:   itemDesc(item),
      categoriaId: catId ?? itemCatId(item),
      servico:     itemServico(item),
    });
    setSelectedItem(item);
    setItemFormModal('edit');
  };

  const handleSaveItem = async () => {
    const { descricao, categoriaId, servico } = itemForm;
    if (!descricao.trim() || !categoriaId) {
      showNotification('Preencha todos os campos obrigatórios.', 'error');
      return;
    }
    setItemSaving(true);
    try {
      const body = {
        descricao: descricao.trim(),
        categoria_item: { id: Number(categoriaId) },
        servico: !!servico,
      };
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
    const servico = itemServico(reporItem);
    const compra  = parseBRL(reporForm.valor_compra_unidade);
    const venda   = parseBRL(reporForm.valor_venda_unidade);

    // Serviço não tem quantidade, fornecedor nem custo: só o valor cobrado.
    if (!venda || (!servico && (!reporForm.quantidade_unidades || !reporForm.fornecedor.trim() || !compra))) {
      showNotification('Preencha todos os campos obrigatórios.', 'error');
      return;
    }
    setReporSaving(true);
    try {
      await itemApi.criarHistoricoReposicao({
        item:                { id: reporItem.id },
        fornecedor:          servico ? null : reporForm.fornecedor.trim(),
        quantidade_unidades: servico ? 0 : parseInt(reporForm.quantidade_unidades, 10),
        valor_compra_unidade: servico ? 0 : compra,
        valor_venda_unidade:  venda,
      });
      showNotification(servico ? 'Valor do serviço atualizado!' : 'Estoque reposto com sucesso!');
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

  // ── Painel de detalhe ───────────────────────────────────────
  const closeDetail = () => { setDetailCat(null); setDetailQuarto(null); setItemSearch(''); };

  // Trocar de aba fecha a ficha aberta — ela é da outra lista.
  const changeAba = (nova) => {
    if (nova === aba) return;
    setAba(nova); setSearch(''); closeDetail();
  };

  /**
   * O menu é desenhado em um portal no <body> com position: fixed, porque o
   * painel de detalhe tem overflow-y: auto e recortaria um menu absoluto.
   * Por isso a posição vem do retângulo do botão, medido na hora de abrir.
   */
  const abrirMenu = (itemId, e) => {
    if (menuAberto === itemId) { setMenuAberto(null); return; }
    const r = e.currentTarget.getBoundingClientRect();
    const espacoAbaixo = window.innerHeight - r.bottom;
    setMenuPos({
      right: window.innerWidth - r.right,
      // perto do rodapé o menu sobe, senão ficaria fora da tela
      ...(espacoAbaixo < 220
        ? { bottom: window.innerHeight - r.top + 4 }
        : { top: r.bottom + 4 }),
    });
    setMenuAberto(itemId);
  };

  // Fecha ao clicar fora, apertar Esc, rolar ou redimensionar — o menu é
  // fixo, então rolar o painel o deixaria descolado do botão.
  useEffect(() => {
    if (menuAberto == null) return;
    const onDown = (e) => {
      if (menuBtnRef.current?.contains(e.target)) return;
      if (menuPanelRef.current?.contains(e.target)) return;
      setMenuAberto(null);
    };
    const onKey   = (e) => { if (e.key === 'Escape') setMenuAberto(null); };
    const fechar  = () => setMenuAberto(null);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', fechar, true);
    window.addEventListener('resize', fechar);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', fechar, true);
      window.removeEventListener('resize', fechar);
    };
  }, [menuAberto]);

  const toggleQuartos = (itemId) => setQuartosAbertos((prev) => {
    const next = new Set(prev);
    if (next.has(itemId)) next.delete(itemId); else next.add(itemId);
    return next;
  });

  // Trocar de categoria zera a busca de item — ela é da categoria anterior.
  useEffect(() => { setItemSearch(''); }, [detailCat?.id]);

  // Depois de repor/consumir/editar, loadSections recria os objetos: a
  // categoria aberta precisa apontar para a versão nova, ou os itens ficam
  // com a quantidade velha.
  useEffect(() => {
    if (!detailCat) return;
    const fresca = sections.find((s) => s.id === detailCat.id);
    if (!fresca) setDetailCat(null);
    else if (fresca !== detailCat) setDetailCat(fresca);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sections]);

  // Mesma coisa para o quarto aberto, que vem da lista de quartos.
  useEffect(() => {
    if (!detailQuarto) return;
    const fresco = quartos.find((q) => q.id === detailQuarto.id);
    if (!fresco) setDetailQuarto(null);
    else if (fresco !== detailQuarto) setDetailQuarto(fresco);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quartos]);

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

  const catNome = (s) => s?.nome ?? s?.categoria ?? '—';

  // Lista da esquerda: categorias filtradas pela busca.
  const catsFiltradas = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return sections;
    return sections.filter((s) => catNome(s).toLowerCase().includes(term));
  }, [sections, search]);

  // Painel da direita: itens da categoria aberta, filtrados pela busca própria.
  const itensDaCat = useMemo(() => {
    const items = detailCat?.items ?? [];
    const term  = itemSearch.trim().toLowerCase();
    if (!term) return items;
    return items.filter((i) => itemDesc(i).toLowerCase().includes(term));
  }, [detailCat, itemSearch]);

  /**
   * Quanto de cada item está distribuído nos quartos.
   * `/quarto` devolve `quarto_itens` desde a mudança no QuartoService — antes
   * isso só vinha de `/quarto/recepcao`.
   */
  const estoqueQuartos = useMemo(() => {
    const mapa = new Map();
    for (const q of quartos) {
      for (const qi of (q.quarto_itens ?? [])) {
        const id = qi.item?.id;
        if (!id) continue;
        const atual  = qi.quantidade_atual  ?? 0;
        const padrao = qi.quantidade_padrao ?? 0;
        const e = mapa.get(id) ?? { total: 0, quartos: [] };
        e.total += atual;
        e.quartos.push({ id: q.id, descricao: q.descricao ?? '', atual, padrao });
        mapa.set(id, e);
      }
    }
    return mapa;
  }, [quartos]);

  // Itens com pouco ou nenhum estoque, do mais crítico para o menos.
  const estoqueBaixo = useMemo(() => sections
    .flatMap((s) => (s.items ?? []).map((i) => ({ item: i, section: s })))
    .filter(({ item }) => !itemServico(item) && itemQty(item) <= LIMITE_ESTOQUE_BAIXO)
    .sort((a, b) => itemQty(a.item) - itemQty(b.item)),
  [sections]);

  // Totais do painel geral.
  const totais = useMemo(() => sections.reduce((acc, s) => {
    const d = s.dashboard ?? {};
    acc.itens     += d.quantidade_itens ?? (s.items ?? []).length;
    acc.investido += d.valor_investido ?? 0;
    acc.lucro     += d.lucro_potencial ?? 0;
    acc.semEstoque += (s.items ?? []).filter((i) => !itemServico(i) && itemQty(i) <= 0).length;
    return acc;
  }, { itens: 0, investido: 0, lucro: 0, semEstoque: 0 }), [sections]);

  const catDash   = detailCat?.dashboard ?? {};
  const isQuartos = aba === 'quarto';

  // Lista da esquerda quando a aba é Quartos.
  const quartosFiltrados = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return quartos;
    return quartos.filter((q) =>
      `quarto ${q.id} ${q.descricao ?? ''}`.toLowerCase().includes(term));
  }, [quartos, search]);

  // ── Render ─────────────────────────────────────────────────
  return (
    <div className={styles.page}>
      <Notification notification={notification} />

      <div className={styles.container}>
        {/* Abaixo de 1024px, com uma categoria aberta, ela toma a tela e a lista sai. */}
        <main className={[styles.split, (detailCat || detailQuarto) ? styles.splitListHidden : ''].join(' ')}>

          {/* ══ LISTA — CATEGORIAS OU QUARTOS ═══════════════════ */}
          <aside className={styles.listPanel}>
            <div className={styles.segmented}>
              <button type="button"
                className={[styles.segmentedBtn, !isQuartos ? styles.segmentedBtnActive : ''].join(' ')}
                onClick={() => changeAba('cat')}>
                Categorias
              </button>
              <button type="button"
                className={[styles.segmentedBtn, isQuartos ? styles.segmentedBtnActive : ''].join(' ')}
                onClick={() => changeAba('quarto')}>
                Quartos
              </button>
            </div>

            <div className={[styles.searchWrap, styles.searchWrapFull].join(' ')}>
              <Search size={16} className={styles.searchIcon} />
              <Input
                value={search}
                onChange={handleSearch}
                placeholder={isQuartos ? 'Buscar quarto...' : 'Buscar categoria...'}
                className={styles.searchInput}
                aria-label={isQuartos ? 'Buscar quarto' : 'Buscar categoria'}
              />
              {search.length > 0 && (
                <button className={styles.searchClear} onClick={() => setSearch('')} aria-label="Limpar busca">
                  <X size={14} />
                </button>
              )}
            </div>

            <div className={styles.listMeta}>
              <span>
                {loading
                  ? 'Carregando...'
                  : isQuartos
                    ? `${quartosFiltrados.length} quarto${quartosFiltrados.length !== 1 ? 's' : ''}`
                    : `${catsFiltradas.length} categoria${catsFiltradas.length !== 1 ? 's' : ''}`}
              </span>
              {!isQuartos && canAdicionarCategoria && (
                <Button className={[styles.btnSolid, styles.btnSm, styles.btnPrimary].join(' ')}
                  onClick={openCreateCat}>
                  Nova categoria
                </Button>
              )}
            </div>

            <div className={styles.listScroll}>
              {loading ? (
                <SkeletonLista />
              ) : isQuartos ? (
                quartosFiltrados.length === 0 ? (
                  <div className={styles.empty}>
                    <BedDouble size={24} opacity={0.3} />
                    <span>
                      {search ? `Nenhum quarto encontrado para "${search}".`
                        : 'Nenhum quarto cadastrado.'}
                    </span>
                  </div>
                ) : quartosFiltrados.map((q) => {
                  const itens    = q.quarto_itens ?? [];
                  const unidades = itens.reduce((n, qi) => n + (qi.quantidade_atual ?? 0), 0);
                  const abaixo   = itens.filter((qi) => (qi.quantidade_atual ?? 0) < (qi.quantidade_padrao ?? 0)).length;
                  const ativo    = detailQuarto?.id === q.id;
                  return (
                    <button key={q.id} type="button"
                      className={[styles.listItem, ativo ? styles.listItemActive : ''].join(' ')}
                      onClick={() => setDetailQuarto(q)}>
                      <span className={styles.listItemBody}>
                        <span className={styles.listItemName}>
                          <span className={styles.nome}>Quarto {q.id} · {q.descricao}</span>
                        </span>
                        <span className={styles.listItemSub}>
                          <span className={styles.tag}>
                            {itens.length} {itens.length === 1 ? 'item' : 'itens'}
                          </span>
                          {itens.length > 0 && (
                            <span className={styles.tag}>{unidades} un</span>
                          )}
                          {abaixo > 0 && (
                            <span className={[styles.tag, styles.tagRose].join(' ')}>
                              {abaixo} a repor
                            </span>
                          )}
                        </span>
                      </span>
                      <ChevronRight size={16} className={styles.listChevron} />
                    </button>
                  );
                })
              ) : catsFiltradas.length === 0 ? (
                <div className={styles.empty}>
                  <Tag size={24} opacity={0.3} />
                  <span>
                    {search ? `Nenhuma categoria encontrada para "${search}".`
                      : 'Nenhuma categoria cadastrada.'}
                  </span>
                </div>
              ) : catsFiltradas.map((section) => {
                const items = section.items ?? [];
                const nItens = section.dashboard?.quantidade_itens ?? items.length;
                const zerados = items.filter((i) => !itemServico(i) && itemQty(i) <= 0).length;
                const ativo   = detailCat?.id === section.id;
                return (
                  <button key={section.id} type="button"
                    className={[styles.listItem, ativo ? styles.listItemActive : ''].join(' ')}
                    onClick={() => setDetailCat(section)}>
                    <span className={styles.listItemBody}>
                      <span className={styles.listItemName}>
                        <span className={styles.nome}>{catNome(section)}</span>
                      </span>
                      <span className={styles.listItemSub}>
                        <span className={styles.tag}>{nItens} {nItens === 1 ? 'item' : 'itens'}</span>
                        {zerados > 0 && (
                          <span className={[styles.tag, styles.tagRose].join(' ')}>
                            {zerados} sem estoque
                          </span>
                        )}
                      </span>
                    </span>
                    <ChevronRight size={16} className={styles.listChevron} />
                  </button>
                );
              })}
            </div>
          </aside>

          {/* ══ DETALHE — QUARTO ════════════════════════════════ */}
          {isQuartos && detailQuarto ? (
            <div className={styles.detailPanel}>
              <section className={styles.dCard}>
                <h3 className={styles.dCardHead}>
                  <button type="button" className={styles.backBtn} onClick={closeDetail}
                    title="Voltar para a lista" aria-label="Voltar para a lista">
                    <ChevronLeft size={17} />
                  </button>
                  <BedDouble size={16} />
                  <span className={styles.dCardTitle}>Itens do quarto</span>
                  <div className={styles.dCardActions}>
                    <button type="button" className={styles.idClose} onClick={closeDetail}
                      title="Fechar" aria-label="Fechar">
                      <X size={16} />
                    </button>
                  </div>
                </h3>

                <div className={styles.dCardBody}>
                  <div className={styles.idHead}>
                    <div className={styles.idHeadMain}>
                      <div className={styles.idName}>
                        <h2 style={{ margin: 0, font: 'inherit' }}>Quarto {detailQuarto.id}</h2>
                      </div>
                      <p className={styles.idSub}>{detailQuarto.descricao}</p>
                    </div>
                  </div>

                  {(detailQuarto.quarto_itens ?? []).length === 0 ? (
                    <p className={styles.blockEmpty}>Nenhum item configurado para este quarto.</p>
                  ) : (
                    <div className={styles.itemList}>
                      {(detailQuarto.quarto_itens ?? []).map((qi) => {
                        const atual  = qi.quantidade_atual  ?? 0;
                        const padrao = qi.quantidade_padrao ?? 0;
                        const falta  = Math.max(0, padrao - atual);
                        return (
                          <div key={qi.id} className={styles.itemRow}>
                            <div className={styles.itemRowMain}>
                              <p className={styles.itemRowNome}>{qi.item?.descricao ?? '—'}</p>
                              <div className={styles.itemRowSub}>
                                <span className={[styles.tag, falta > 0 ? styles.tagRose : styles.tagEmerald].join(' ')}>
                                  {atual} de {padrao}
                                </span>
                                {falta > 0 && <span>faltam {falta} un</span>}
                              </div>
                            </div>
                            <div className={styles.itemRowPreco}>
                              <p className={styles.itemRowVenda}>{fmtBRL(qi.preco ?? 0)}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </section>
            </div>
          ) :

          /* ══ DETALHE — ITENS DA CATEGORIA ════════════════════ */
          !detailCat ? (
            /* ── Painel geral (nenhuma categoria selecionada) ── */
            <div className={styles.detailPanel}>
              <section className={styles.dCard}>
                <h3 className={styles.dCardHead}>
                  <Boxes size={16} />
                  <span className={styles.dCardTitle}>Visão geral do estoque</span>
                  <div className={styles.dCardActions}>
                    {canHistoricoConsumo && (
                      <Button className={styles.btnSolid} onClick={openConsumos}>Consumos</Button>
                    )}
                  </div>
                </h3>

                <div className={styles.dCardBody}>
                  {loading ? <SkeletonPainel /> : (
                    <div className={styles.statGrid}>
                      <div className={styles.statCard}>
                        <p className={styles.statLabel}>Categorias</p>
                        <p className={styles.statVal}>{sections.length}</p>
                      </div>
                      <div className={styles.statCard}>
                        <p className={styles.statLabel}>Itens</p>
                        <p className={styles.statVal}>{totais.itens}</p>
                      </div>
                      <div className={styles.statCard}>
                        <p className={styles.statLabel}>Sem estoque</p>
                        <p className={[styles.statVal, totais.semEstoque > 0 ? styles.statValRose : ''].join(' ')}>
                          {totais.semEstoque}
                        </p>
                      </div>
                      {canDashboardCategoria && (
                        <div className={styles.statCard}>
                          <p className={styles.statLabel}>Lucro potencial</p>
                          <p className={[styles.statVal, styles.statValEmerald].join(' ')}>{fmtBRL(totais.lucro)}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </section>

              {/* ── Estoque baixo ── */}
              {!loading && (
                <section className={styles.dCard}>
                  <h3 className={styles.dCardHead}>
                    <AlertTriangle size={16} />
                    <span className={styles.dCardTitle}>Estoque baixo</span>
                  </h3>

                  <div className={styles.dCardBody}>
                    {estoqueBaixo.length === 0 ? (
                      <p className={styles.blockEmpty}>
                        Nenhum item com {LIMITE_ESTOQUE_BAIXO} unidades ou menos.
                      </p>
                    ) : (
                      <div className={styles.itemList}>
                        {estoqueBaixo.map(({ item, section }) => {
                          const qty = itemQty(item);
                          return (
                            <div key={item.id} className={styles.itemRow}>
                              <div className={styles.itemRowMain}>
                                <p className={styles.itemRowNome}>{itemDesc(item)}</p>
                                <div className={styles.itemRowSub}>
                                  <span className={[styles.tag, styles.tagRose].join(' ')}>
                                    {qty} {qty === 1 ? 'unidade' : 'unidades'}
                                  </span>
                                  <button type="button" className={styles.linkCat}
                                    onClick={() => setDetailCat(section)}>
                                    {catNome(section)}
                                  </button>
                                </div>
                              </div>
                              <div className={styles.itemRowPreco}>
                                <p className={styles.itemRowVenda}>{fmtBRL(itemVenda(item))}</p>
                                <p className={styles.itemRowCompra}>custo {fmtBRL(itemCompra(item))}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </section>
              )}

              <div className={styles.detailHint}>
                Escolha uma categoria na lista ao lado para ver os itens dela.
              </div>
            </div>
          ) : (
            /* ── Categoria aberta ── */
            <div className={styles.detailPanel}>

              {/* ── Dados da categoria ── */}
              <section className={styles.dCard}>
                <h3 className={styles.dCardHead}>
                  <button type="button" className={styles.backBtn} onClick={closeDetail}
                    title="Voltar para a lista" aria-label="Voltar para a lista">
                    <ChevronLeft size={17} />
                  </button>
                  <Tag size={16} />
                  <span className={styles.dCardTitle}>Dados da categoria</span>
                  <div className={styles.dCardActions}>
                    {canEditarCategoria && (
                      <Button className={styles.btnSolid} onClick={() => openEditCat(detailCat)}>
                        Editar
                      </Button>
                    )}
                    <button type="button" className={styles.idClose} onClick={closeDetail}
                      title="Fechar" aria-label="Fechar">
                      <X size={16} />
                    </button>
                  </div>
                </h3>

                <div className={styles.dCardBody}>
                  <div className={styles.idHead}>
                    <div className={styles.idHeadMain}>
                      <div className={styles.idName}>
                        <h2 style={{ margin: 0, font: 'inherit' }}>{catNome(detailCat)}</h2>
                      </div>
                      {detailCat.descricao && <p className={styles.idSub}>{detailCat.descricao}</p>}
                    </div>
                  </div>

                  <div className={styles.statGrid}>
                    <div className={styles.statCard}>
                      <p className={styles.statLabel}>Itens</p>
                      <p className={styles.statVal}>
                        {catDash.quantidade_itens ?? (detailCat.items ?? []).length}
                      </p>
                    </div>
                    {canDashboardCategoria && (
                      <>
                        <div className={styles.statCard}>
                          <p className={styles.statLabel}>Investido</p>
                          <p className={[styles.statVal, styles.statValRose].join(' ')}>
                            {fmtBRL(catDash.valor_investido)}
                          </p>
                        </div>
                        <div className={styles.statCard}>
                          <p className={styles.statLabel}>Lucro potencial</p>
                          <p className={[styles.statVal, styles.statValEmerald].join(' ')}>
                            {fmtBRL(catDash.lucro_potencial)}
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </section>

              {/* ── Itens ── */}
              <section className={styles.dCard}>
                <h3 className={styles.dCardHead}>
                  <Package size={16} />
                  <span className={styles.dCardTitle}>Itens</span>
                  <div className={styles.dCardActions}>
                    {canAdicionarItem && (
                      <Button variant="primary" className={[styles.btnSolid, styles.btnPrimary].join(' ')}
                        onClick={() => openCreateItem(detailCat)}>
                        Novo item
                      </Button>
                    )}
                  </div>
                </h3>

                <div className={styles.dCardBody}>
                  {(detailCat.items ?? []).length > 3 && (
                    <div className={[styles.searchWrap, styles.searchWrapFull, styles.itemSearch].join(' ')}>
                      <Search size={16} className={styles.searchIcon} />
                      <Input
                        value={itemSearch}
                        onChange={(e) => setItemSearch(e.target.value)}
                        placeholder="Buscar item nesta categoria..."
                        className={styles.searchInput}
                        aria-label="Buscar item"
                      />
                      {itemSearch.length > 0 && (
                        <button className={styles.searchClear} onClick={() => setItemSearch('')} aria-label="Limpar busca">
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  )}

                  {itensDaCat.length === 0 ? (
                    <p className={styles.blockEmpty}>
                      {itemSearch ? `Nenhum item encontrado para "${itemSearch}".` : 'Nenhum item cadastrado nesta categoria.'}
                    </p>
                  ) : (
                    <div className={styles.itemGrid}>
                      {itensDaCat.map((item) => {
                        const qty     = itemQty(item);
                        const servico = itemServico(item);
                        const nosQ    = estoqueQuartos.get(item.id);
                        const aberto  = quartosAbertos.has(item.id);
                        const menu    = menuAberto === item.id;
                        return (
                          <div key={item.id} className={styles.itemCard}>
                            <div className={styles.itemCardHead}>
                              <p className={styles.itemCardNome}>{itemDesc(item)}</p>

                              <div className={styles.itemMenuWrap} ref={menu ? menuBtnRef : null}>
                                <button type="button"
                                  className={[styles.itemMenuBtn, menu ? styles.itemMenuBtnOn : ''].join(' ')}
                                  onClick={(e) => abrirMenu(item.id, e)}
                                  aria-haspopup="menu" aria-expanded={menu}
                                  title="Ações do item" aria-label="Ações do item">
                                  <MenuIcon size={15} />
                                </button>

                                {menu && menuPos && createPortal(
                                  <div className={styles.itemMenu} role="menu"
                                    ref={menuPanelRef} style={menuPos}>
                                    {canConsumirItem && (servico || qty > 0) && (
                                      <button type="button" role="menuitem"
                                        className={[styles.itemMenuItem, styles.itemMenuItemDanger].join(' ')}
                                        onClick={(e) => { setMenuAberto(null); openConsumir(item, e); }}>
                                        <Minus size={14} /> Consumir
                                      </button>
                                    )}
                                    {canReporItem && (
                                      <button type="button" role="menuitem" className={styles.itemMenuItem}
                                        onClick={(e) => { setMenuAberto(null); openRepor(item, e); }}>
                                        <RefreshCw size={14} /> {servico ? 'Alterar valor' : 'Repor estoque'}
                                      </button>
                                    )}
                                    {canHistReposicoes && (
                                      <button type="button" role="menuitem" className={styles.itemMenuItem}
                                        onClick={(e) => { setMenuAberto(null); openHistorico(item, e); }}>
                                        <History size={14} /> Histórico
                                      </button>
                                    )}
                                    {canAdicionarItem && (
                                      <button type="button" role="menuitem" className={styles.itemMenuItem}
                                        onClick={() => { setMenuAberto(null); openEditItem(item, detailCat.id); }}>
                                        <Edit2 size={14} /> Editar
                                      </button>
                                    )}
                                  </div>,
                                  document.body,
                                )}
                              </div>
                            </div>

                            <div className={styles.itemCardTags}>
                              {servico ? (
                                <span className={[styles.tag, styles.tagPrimary].join(' ')}>Serviço</span>
                              ) : (
                                <span className={[styles.tag, qty <= 5 ? styles.tagRose : styles.tagEmerald].join(' ')}>
                                  {qty} {qty === 1 ? 'unidade' : 'unidades'}
                                </span>
                              )}
                              {!servico && nosQ && (
                                <button type="button" className={styles.quartosToggle}
                                  onClick={() => toggleQuartos(item.id)}
                                  aria-expanded={aberto}>
                                  <BedDouble size={13} />
                                  {nosQ.total} un em {nosQ.quartos.length} {nosQ.quartos.length === 1 ? 'quarto' : 'quartos'}
                                  <ChevronRight size={13}
                                    className={[styles.quartosChevron, aberto ? styles.quartosChevronOpen : ''].join(' ')} />
                                </button>
                              )}
                            </div>

                            {!servico && itemForn(item) && (
                              <p className={styles.itemCardForn}>{itemForn(item)}</p>
                            )}

                            {/* Quanto deste item está em cada quarto — vem do
                                /quarto, que agora devolve quarto_itens. */}
                            {aberto && nosQ && (
                              <div className={styles.quartosList}>
                                {nosQ.quartos.map((q) => (
                                  <div key={q.id} className={styles.quartosRow}>
                                    <span className={styles.quartosNome}>Quarto {q.id} · {q.descricao}</span>
                                    <span className={[
                                      styles.quartosQtd,
                                      q.atual < q.padrao ? styles.quartosQtdBaixa : '',
                                    ].join(' ')}>
                                      {q.atual} de {q.padrao}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Preço em destaque, ancorado no rodapé do cartão. */}
                            <div className={styles.itemCardPreco}>
                              <p className={styles.itemRowVenda}>{fmtBRL(itemVenda(item))}</p>
                              {!servico && (
                                <p className={styles.itemRowCompra}>custo {fmtBRL(itemCompra(item))}</p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </section>
            </div>
          )}
        </main>
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

          <label className={styles.checkboxRow}>
            <input
              type="checkbox"
              checked={!!itemForm.servico}
              onChange={(e) => setItemForm((f) => ({ ...f, servico: e.target.checked }))}
            />
            <div>
              <span className={styles.checkboxLabel}>É um serviço</span>
              <span className={styles.checkboxSub}>
                Serviços não têm estoque: não se informa quantidade nem valor de compra.
              </span>
            </div>
          </label>
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
              <span className={styles.itemInfoLabel}>
                {itemServico(reporItem) ? 'Serviço selecionado' : 'Item selecionado'}
              </span>
              <span className={styles.itemInfoName}>{itemDesc(reporItem)}</span>
              {!itemServico(reporItem) && (
                <span className={styles.itemInfoSub}>
                  Qtd atual: <strong>{itemQty(reporItem)}</strong> unidades
                </span>
              )}
            </div>

            {/* Serviço não tem estoque: só o valor de venda faz sentido. */}
            {!itemServico(reporItem) && (
              <>
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
              </>
            )}

            <div className={itemServico(reporItem) ? undefined : styles.formRow}>
              {!itemServico(reporItem) && (
                <FormField label="Valor de Compra (un.) *">
                  <Input
                    placeholder="R$ 0,00"
                    value={reporForm.valor_compra_unidade}
                    onChange={(e) => setReporForm((f) => ({ ...f, valor_compra_unidade: maskBRL(e.target.value) }))}
                  />
                </FormField>
              )}
              <FormField label={itemServico(reporItem) ? 'Valor cobrado *' : 'Valor de Venda (un.) *'}>
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
                        {repCompra(entry) > 0 && repVenda(entry) > 0
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
