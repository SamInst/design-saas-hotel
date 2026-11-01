import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Package, Search, Edit2, Tag, Minus,
  History, Loader2, RefreshCw, Calendar, Boxes,
  X, ChevronLeft, ChevronRight, ChevronDown, BedDouble, LayoutGrid, List,
} from 'lucide-react';
import { Button }                   from '../../components/ui/Button';
import { Input, Select, FormField } from '../../components/ui/Input';
import { Notification }             from '../../components/ui/Notification';
import { itemApi, categoriaApi, enumApi, quartoApi } from '../../services/api';
import { usePermissions }           from '../../hooks/usePermissions';
import styles from './InventoryManagement.module.css';
import { tr } from '../../i18n';

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
const fmtBRL  = (v) => v == null ? tr('R$ 0,00') : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
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
    <div role="status" aria-label={tr('Carregando categorias')}>
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

// ── Campo rótulo/valor da ficha ──────────────────────────────
function Field({ label, value }) {
  const vazio = value == null || value === '';
  return (
    <div>
      <p className={styles.fLabel}>{label}</p>
      <p className={styles.fVal}>{vazio ? '—' : value}</p>
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

  const [modoItens, setModoItens] = useState(() => {
    try { return localStorage.getItem('estoque.modoItens') === 'lista' ? 'lista' : 'blocos'; } catch { return 'blocos'; }
  });
  const trocarModoItens = (m) => {
    setModoItens(m);
    try { localStorage.setItem('estoque.modoItens', m); } catch { return; }
  };

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
  // repor um item do quarto até a quantidade padrão, tirando do estoque geral
  const [reporQuarto, setReporQuarto]       = useState(null); // { qi, quarto }
  const [reporQuartoQtd, setReporQuartoQtd] = useState('');

  // ── Consumir modal ─────────────────────────────────────────
  const [consumirModal, setConsumiModal]         = useState(false);
  const [consumirItem, setConsumiItem]           = useState(null);
  const [consumirQtd, setConsumiQtd]             = useState('');
  const [consumirSaving, setConsumiSaving]       = useState(false);
  const [consumirPag, setConsumiPag]               = useState({ tipo: '', nome: '', descricao: '' });
  const [consumirDespesa, setConsumiDespesa]       = useState(false);
  const [consumirQuarto, setConsumiQuarto]           = useState('');
  const [consumirOrigem, setConsumiOrigem]           = useState('estoque'); // 'estoque' | 'quarto'
  const [quartoItens, setQuartoItens]               = useState([]);

  // ── Aba da lista: categorias ou quartos ────────────────────
  const [aba, setAba] = useState('cat'); // 'cat' | 'quarto'

  // ── Item aberto no painel de detalhe ───────────────────────
  const [detailCat, setDetailCat]       = useState(null);
  const [detailQuarto, setDetailQuarto] = useState(null);
  const [abaFicha, setAbaFicha]         = useState('itens');

  const [isDesktop, setIsDesktop] = useState(() => window.matchMedia('(min-width: 1024px)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const on = (e) => setIsDesktop(e.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  const [itemSearch, setItemSearch]     = useState('');
  // item cuja distribuição por quarto está aberta na caixa flutuante
  const [quartosPop, setQuartosPop]       = useState(null);
  // Consumir / Repor abrem numa caixa flutuante presa ao botão de ações do item
  const [acaoPos, setAcaoPos]   = useState(null);
  const acaoAnchorRef = useRef(null);
  const acaoPanelRef  = useRef(null);
  const [quartosPopPos, setQuartosPopPos] = useState(null);
  const quartosBtnRef   = useRef(null);
  const quartosPanelRef = useRef(null);
  // item cujo menu de ações está aberto, e onde desenhá-lo na tela
  const [menuAberto, setMenuAberto] = useState(null);
  const [menuPos, setMenuPos]       = useState(null);
  const menuBtnRef   = useRef(null);
  const menuPanelRef = useRef(null);

  // ── Historico de reposições (modal, por item) ──────────────
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

  // ── Adicionar item ao quarto / repor o quarto todo ─────────
  const [addQuartoItem, setAddQuartoItem] = useState(false);
  const [addQIForm, setAddQIForm]         = useState({ itemId: '', padrao: '', atual: '' });
  const [addQISaving, setAddQISaving]     = useState(false);
  const [reporTudoSaving, setReporTudoSaving] = useState(false);

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
      showNotification(tr('Erro ao carregar inventário: ') + e.message, 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSections(); }, [loadSections]);
  useEffect(() => { enumApi.tipoPagamento().then(setTiposPagamento).catch(() => {}); }, []);
  const loadQuartos = useCallback(() => {
    quartoApi.listar({ size: 900 }).then(r => setQuartos(r?.content ?? [])).catch(() => {});
  }, []);
  useEffect(() => { loadQuartos(); }, [loadQuartos]);

  // ── Search (frontend filter) ─────────────────────────────────
  const handleSearch = (e) => setSearch(e.target.value);

  // ── Item form ──────────────────────────────────────────────
  const openCreateItem = (cat) => {
    setItemForm({ descricao: '', categoriaId: cat?.id ?? '', servico: false });
    setSelectedItem(null);
    setHistoricoItem(null);
    setConsumiModal(false);
    setItemFormModal('create');
  };

  const openEditItem = (item, catId) => {
    setItemForm({
      descricao:   itemDesc(item),
      categoriaId: catId ?? itemCatId(item),
      servico:     itemServico(item),
    });
    setSelectedItem(item);
    setHistoricoItem(null);
    setConsumiModal(false);
    setItemFormModal('edit');
  };

  const handleSaveItem = async () => {
    const { descricao, categoriaId, servico } = itemForm;
    if (!descricao.trim() || !categoriaId) {
      showNotification(tr('Preencha todos os campos obrigatórios.'), 'error');
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
        showNotification(tr('Item criado com sucesso!'));
      } else {
        await itemApi.atualizar({ ...body, id: selectedItem.id });
        showNotification(tr('Item atualizado com sucesso!'));
      }
      setItemFormModal(null);
      loadSections();
    } catch (e) {
      showNotification(tr('Erro: ') + e.message, 'error');
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
      showNotification(tr('Informe o nome da categoria.'), 'error');
      return;
    }
    setCatSaving(true);
    try {
      if (catFormModal === 'create') {
        await categoriaApi.criar({ nome: catForm.nome.trim(), descricao: catForm.descricao.trim() });
        showNotification(tr('Categoria criada com sucesso!'));
      } else {
        await categoriaApi.atualizar(editingCat.id, {
          id: editingCat.id, nome: catForm.nome.trim(), descricao: catForm.descricao.trim(),
        });
        showNotification(tr('Categoria atualizada com sucesso!'));
      }
      setCatFormModal(null);
      loadSections();
    } catch (e) {
      showNotification(tr('Erro: ') + e.message, 'error');
    } finally {
      setCatSaving(false);
    }
  };

  // ── Repor estoque ──────────────────────────────────────────
  const openRepor = (item, e) => {
    e?.stopPropagation();
    setConsumiModal(false);
    setReporQuarto(null);
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
      showNotification(tr('Preencha todos os campos obrigatórios.'), 'error');
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
      showNotification(servico ? tr('Valor do serviço atualizado!') : tr('Estoque reposto com sucesso!'));
      setReporModal(false);
      loadSections();
    } catch (e) {
      showNotification(tr('Erro: ') + e.message, 'error');
    } finally {
      setReporSaving(false);
    }
  };

  const reporQuartoMax = (qi) => {
    const falta = Math.max(0, (qi.quantidade_padrao ?? 0) - (qi.quantidade_atual ?? 0));
    const geral = itemQty(itemPorId.get(qi.item?.id));
    return Math.max(0, Math.min(falta, geral));
  };

  const openReporQuarto = (qi, quarto, e) => {
    e?.stopPropagation();
    setReporModal(false);
    setConsumiModal(false);
    setReporQuarto({ qi, quarto });
    const max = reporQuartoMax(qi);
    setReporQuartoQtd(max > 0 ? String(max) : '');
  };

  const handleReporQuarto = async () => {
    const { qi } = reporQuarto;
    const qty = parseInt(reporQuartoQtd, 10) || 0;
    const max = reporQuartoMax(qi);
    if (qty <= 0 || qty > max) {
      showNotification(max > 0
        ? tr('Informe uma quantidade entre 1 e {{max}}.', { max })
        : tr('Não há estoque geral para repor este item.'), 'error');
      return;
    }
    setReporSaving(true);
    try {
      await quartoApi.reporItem({ id: qi.id, quantidade: qty });
      showNotification(tr('Item reposto no quarto!'));
      setReporQuarto(null);
      loadQuartos();
      loadSections();
    } catch (e) {
      showNotification(tr('Erro: ') + e.message, 'error');
    } finally {
      setReporSaving(false);
    }
  };

  const openAddQuartoItem = () => {
    setConsumiModal(false); setReporQuarto(null);
    setAddQIForm({ itemId: '', padrao: '', atual: '' });
    setAddQuartoItem(true);
  };

  const handleAddQuartoItem = async (q) => {
    const itemId = Number(addQIForm.itemId);
    const padrao = parseInt(addQIForm.padrao, 10);
    const atual  = parseInt(addQIForm.atual, 10) || 0;
    const geral  = itemQty(itemPorId.get(itemId));
    if (!itemId) { showNotification(tr('Selecione o item.'), 'error'); return; }
    if (!(padrao > 0)) { showNotification(tr('Informe a quantidade padrão.'), 'error'); return; }
    if (atual < 0 || atual > geral) {
      showNotification(tr('A quantidade no quarto deve ficar entre 0 e {{max}} (estoque geral).', { max: geral }), 'error');
      return;
    }
    setAddQISaving(true);
    try {
      await quartoApi.adicionarItem(q.id, { item: { id: itemId }, quantidade_padrao: padrao, quantidade_atual: atual });
      showNotification(tr('Item adicionado ao quarto!'));
      setAddQuartoItem(false);
      loadQuartos();
      loadSections();
    } catch (e) {
      showNotification(tr('Erro: ') + e.message, 'error');
    } finally {
      setAddQISaving(false);
    }
  };

  // Completa todos os itens abaixo do padrão, até onde o estoque geral permitir.
  const handleReporTudo = async (q) => {
    const pendentes = (q.quarto_itens ?? [])
      .map((qi) => ({ qi, qtd: reporQuartoMax(qi) }))
      .filter((p) => p.qtd > 0);
    if (pendentes.length === 0) {
      showNotification(tr('Não há estoque geral para repor os itens deste quarto.'), 'error');
      return;
    }
    setReporTudoSaving(true);
    let ok = 0;
    try {
      for (const { qi, qtd } of pendentes) {
        await quartoApi.reporItem({ id: qi.id, quantidade: qtd });
        ok++;
      }
      showNotification(tr('{{n}} item(ns) reposto(s) no quarto!', { n: ok }));
    } catch (e) {
      showNotification(tr('Erro: ') + e.message, 'error');
    } finally {
      setReporTudoSaving(false);
      loadQuartos();
      loadSections();
    }
  };

  // ── Consumir ────────────────────────────────────────────────
  // Da categoria consome do estoque geral; do quarto, do que está no quarto.
  const openConsumir = (item, e, quarto = null) => {
    e?.stopPropagation();
    setReporModal(false);
    setReporQuarto(null);
    setItemFormModal(null);
    setHistoricoItem(null);
    setEditHistModal(false);
    setConsumiItem(item);
    setConsumiQtd('');
    setConsumiPag({ tipo: '', nome: '', descricao: '' });
    setConsumiDespesa(false);
    setConsumiOrigem(quarto ? 'quarto' : 'estoque');
    setConsumiQuarto(quarto ? String(quarto.id) : '');
    setQuartoItens(quarto?.quarto_itens ?? []);
    setConsumiModal(true);
  };

  const openConsumirQuarto = (qi, quarto, e) => {
    const item = itemPorId.get(qi.item?.id)
      ?? { id: qi.item?.id, descricao: qi.item?.descricao, valor_venda_unidade: qi.preco ?? 0 };
    openConsumir(item, e, quarto);
  };

  const consumoEsperado  = () => (Number(consumirQtd) || 0) * itemVenda(consumirItem);

  const handleConsumir = async () => {
    const qty = Number(consumirQtd);
    if (!consumirQtd || qty <= 0) {
      showNotification(tr('Informe a quantidade.'), 'error');
      return;
    }
    if (consumirQuarto) {
      const entrada = quartoItens.find(qi => qi.item?.id === consumirItem?.id);
      if (!entrada) {
        showNotification(tr('Este item não está configurado para o quarto selecionado.'), 'error');
        return;
      }
      if (qty > entrada.quantidade_atual) {
        showNotification(tr('Quantidade maior que o disponível no quarto ({{quantidade_atual}} un.).', { quantidade_atual: entrada.quantidade_atual }), 'error');
        return;
      }
    }
    const pago = consumoEsperado();
    if (!consumirDespesa && (!consumirPag.tipo || !consumirPag.nome.trim())) {
      showNotification(tr('Preencha tipo de pagamento e nome do pagador.'), 'error');
      return;
    }
    setConsumiSaving(true);
    try {
      const pagamentoBody = consumirDespesa ? null : {
        tipo_pagamento: { id: Number(consumirPag.tipo) },
        nome_pagador:   consumirPag.nome.trim(),
        descricao:      consumirPag.descricao.trim() || undefined,
        valor:          pago,
        funcionario:    { id: loggedUser?.id },
      };
      await itemApi.consumir({
        item:            { id: consumirItem.id },
        quantidade:      qty,
        despesa_pessoal: consumirDespesa,
        ...(pagamentoBody ? { pagamento: pagamentoBody } : {}),
        ...(consumirQuarto ? { quarto: { id: Number(consumirQuarto) } } : {}),
      });
      showNotification(tr('Item consumido com sucesso!'));
      setConsumiModal(false);
      loadSections();
      if (consumirOrigem === 'quarto') loadQuartos();
    } catch (e) {
      showNotification(tr('Erro: ') + e.message, 'error');
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
      showNotification(tr('Informe a quantidade.'), 'error');
      return;
    }
    setEditHistSaving(true);
    try {
      await itemApi.atualizarHistoricoReposicao({
        id:                  editHistEntry.id,
        quantidade_unidades: Number(editHistForm.quantidade_unidades),
        fornecedor:          editHistForm.fornecedor.trim() || null,
      });
      showNotification(tr('Reposição atualizada com sucesso!'));
      setEditHistModal(false);
      // recarrega o historico do item atual
      const repos = await itemApi.historicoReposicao(historicoItem.id);
      setHistoricoReposicao(Array.isArray(repos) ? repos : (repos?.itemReposicaoList ?? []));
    } catch (e) {
      showNotification(tr('Erro: ') + e.message, 'error');
    } finally {
      setEditHistSaving(false);
    }
  };

  // ── Historico de consumos (hotel) ──────────────────────────
  const fecharConsumos = () => { setConsumosModal(false); setConsumoDetalhe(null); setConfirmCancelar(false); };

  const openConsumos = async () => {
    setCatFormModal(null);
    setConsumoDetalhe(null);
    setConfirmCancelar(false);
    setConsumosModal(true);
    setConsumos([]);
    setConsumosLoading(true);
    try {
      const data = await itemApi.listarConsumos();
      setConsumos(Array.isArray(data) ? data : []);
    } catch (e) {
      showNotification(tr('Erro ao carregar consumos: ') + e.message, 'error');
    } finally {
      setConsumosLoading(false);
    }
  };

  // ── Historico de reposições ─────────────────────────────────
  const openHistorico = async (item, e) => {
    e?.stopPropagation();
    setItemFormModal(null);
    setConsumiModal(false);
    setEditHistModal(false);
    setHistoricoItem(item);
    setHistoricoReposicao([]);
    setHistoricoLoading(true);
    try {
      const repos = await itemApi.historicoReposicao(item.id);
      setHistoricoReposicao(Array.isArray(repos) ? repos : (repos?.itemReposicaoList ?? []));
    } catch (e) {
      showNotification(tr('Erro ao carregar histórico: ') + e.message, 'error');
    } finally {
      setHistoricoLoading(false);
    }
  };

  // ── Painel de detalhe ───────────────────────────────────────
  const closeDetail = () => {
    setDetailCat(null); setDetailQuarto(null); setItemSearch(''); setAddQuartoItem(false);
    setItemFormModal(null); setHistoricoItem(null); setEditHistModal(false); setConsumiModal(false);
  };
  const closeHistorico = () => { setHistoricoItem(null); setEditHistModal(false); };

  // ── Caixa flutuante de Consumir / Repor ─────────────────────
  // Portal no <body>, como o menu de ações: o painel de detalhe rola e
  // recortaria a caixa. A posição sai do botão de ações do item e é
  // recalculada ao rolar, para a caixa acompanhar o cartão.
  const ACAO_W = 280;
  const calcAcaoPos = () => {
    const el = acaoAnchorRef.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const left  = Math.max(8, Math.min(r.right - ACAO_W, window.innerWidth - ACAO_W - 8));
    const below = window.innerHeight - r.bottom - 14;
    const above = r.top - 14;
    return below >= 380 || below >= above
      ? { left, top: r.bottom + 6, maxHeight: below }
      : { left, bottom: window.innerHeight - r.top + 6, maxHeight: above };
  };
  const ancorarAcao = () => { acaoAnchorRef.current = menuBtnRef.current; setAcaoPos(calcAcaoPos()); };
  const fecharAcao  = () => { setReporModal(false); setReporQuarto(null); };
  const acaoAberta  = reporModal || !!reporQuarto;

  useEffect(() => {
    if (!acaoAberta) return;
    const reposicionar = () => setAcaoPos(calcAcaoPos());
    const onKey = (e) => { if (e.key === 'Escape') fecharAcao(); };
    window.addEventListener('scroll', reposicionar, true);
    window.addEventListener('resize', reposicionar);
    document.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('scroll', reposicionar, true);
      window.removeEventListener('resize', reposicionar);
      document.removeEventListener('keydown', onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acaoAberta]);

  // Abrir uma ficha fecha o formulário que estiver no lugar dela.
  const openCat = (section) => {
    setItemFormModal(null); setCatFormModal(null); fecharConsumos();
    setHistoricoItem(null); setEditHistModal(false); setConsumiModal(false);
    setDetailCat(section); setAbaFicha('itens');
  };
  const openQuarto = (q) => {
    setItemFormModal(null); setCatFormModal(null); fecharConsumos(); setConsumiModal(false);
    setAddQuartoItem(false);
    setDetailQuarto(q);
  };

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

  // Caixa flutuante com o item em cada quarto: portal no <body>, como o menu
  // de ações, porque o painel de detalhe rola e recortaria a caixa.
  const abrirQuartos = (itemId, e) => {
    if (quartosPop === itemId) { setQuartosPop(null); return; }
    const r = e.currentTarget.getBoundingClientRect();
    const espacoAbaixo = window.innerHeight - r.bottom;
    setQuartosPopPos({
      left: Math.min(r.left, window.innerWidth - 320),
      ...(espacoAbaixo < 260
        ? { bottom: window.innerHeight - r.top + 6 }
        : { top: r.bottom + 6 }),
    });
    setQuartosPop(itemId);
  };

  useEffect(() => {
    if (quartosPop == null) return;
    const onDown = (e) => {
      if (quartosBtnRef.current?.contains(e.target)) return;
      if (quartosPanelRef.current?.contains(e.target)) return;
      setQuartosPop(null);
    };
    const onKey  = (e) => { if (e.key === 'Escape') setQuartosPop(null); };
    const fechar = (e) => { if (!quartosPanelRef.current?.contains(e.target)) setQuartosPop(null); };
    const onResize = () => setQuartosPop(null);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', fechar, true);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', fechar, true);
      window.removeEventListener('resize', onResize);
    };
  }, [quartosPop]);

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
      showNotification(tr('Consumo cancelado com sucesso!'));
      setConsumoDetalhe(null);
      setConfirmCancelar(false);
      const data = await itemApi.listarConsumos();
      setConsumos(Array.isArray(data) ? data : []);
      loadSections();
    } catch (e) {
      showNotification(tr('Erro ao cancelar: ') + e.message, 'error');
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
  const itemPorId = useMemo(() => {
    const mapa = new Map();
    for (const sec of sections) for (const i of (sec.items ?? [])) mapa.set(i.id, i);
    return mapa;
  }, [sections]);

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
  const formAtivo = catFormModal ? 'cat' : null;

  // só aparece quando a ficha/formulário ocupa a tela e a lista está fora
  const BackBtn = ({ onClick = closeDetail, title = tr('Voltar para a lista') }) => (
    <button type="button" className={styles.backBtn} onClick={onClick}
      title={title} aria-label={title}>
      <ChevronLeft size={17} />
    </button>
  );

  /** Abas da ficha (mesmo desenho das abas da ficha de Preços). */
  const FichaTabs = ({ abas, atual, onChange }) => (
    <div className={styles.fichaTabs} role="tablist">
      {abas.map(([k, label]) => (
        <button key={k} type="button" role="tab" aria-selected={atual === k}
          className={[styles.fichaTab, atual === k ? styles.fichaTabAtiva : ''].join(' ')}
          onClick={() => onChange(k)}>
          {label}
        </button>
      ))}
    </div>
  );

  const nUn = (n) => (n === 1 ? tr('{{n}} item', { n }) : tr('{{n}} itens', { n }));

  const renderItemMenu = (item) => {
    const qty     = itemQty(item);
    const servico = itemServico(item);
    const menu    = menuAberto === item.id;
    return (
      <div className={styles.itemMenuWrap} ref={menu ? menuBtnRef : null}>
        <button type="button"
          className={[styles.itemMenuBtn, menu ? styles.itemMenuBtnOn : ''].join(' ')}
          onClick={(e) => abrirMenu(item.id, e)}
          aria-haspopup="menu" aria-expanded={menu}
          title={tr('Ações do item')} aria-label={tr('Ações do item')}>
          <MenuIcon size={15} />
        </button>

        {menu && menuPos && createPortal(
          <div className={styles.itemMenu} role="menu"
            ref={menuPanelRef} style={menuPos}>
            {canConsumirItem && (servico || qty > 0) && (
              <button type="button" role="menuitem"
                className={[styles.itemMenuItem, styles.itemMenuItemDanger].join(' ')}
                onClick={(e) => { setMenuAberto(null); openConsumir(item, e); }}>
                <Minus size={14} /> {tr('Consumir do estoque')}
              </button>
            )}
            {canReporItem && (
              <button type="button" role="menuitem" className={styles.itemMenuItem}
                onClick={(e) => { ancorarAcao(); setMenuAberto(null); openRepor(item, e); }}>
                <RefreshCw size={14} /> {servico ? tr('Alterar valor') : tr('Repor estoque')}
              </button>
            )}
            {canHistReposicoes && (
              <button type="button" role="menuitem" className={styles.itemMenuItem}
                onClick={(e) => { setMenuAberto(null); openHistorico(item, e); }}>
                <History size={14} /> {tr('Histórico')}
              </button>
            )}
            {canAdicionarItem && (
              <button type="button" role="menuitem" className={styles.itemMenuItem}
                onClick={() => { setMenuAberto(null); openEditItem(item, detailCat.id); }}>
                <Edit2 size={14} /> {tr('Editar')}
              </button>
            )}
          </div>,
          document.body,
        )}
      </div>
    );
  };

  const renderQuartosToggle = (item) => {
    const nosQ   = estoqueQuartos.get(item.id);
    const aberto = quartosPop === item.id;
    if (itemServico(item) || !nosQ) return null;
    return (<>
      <button type="button" className={[styles.quartosToggle, aberto ? styles.quartosToggleOn : ''].join(' ')}
        ref={aberto ? quartosBtnRef : null}
        onClick={(e) => abrirQuartos(item.id, e)}
        aria-haspopup="dialog" aria-expanded={aberto}>
        <BedDouble size={13} />
        {nosQ.total} {tr('un em')} {nosQ.quartos.length} {nosQ.quartos.length === 1 ? tr('quarto') : tr('quartos')}
        <ChevronDown size={13} className={[styles.quartosChevron, aberto ? styles.quartosChevronOpen : ''].join(' ')} />
      </button>

      {/* Quanto deste item está em cada quarto — vem do /quarto, que devolve quarto_itens. */}
      {aberto && quartosPopPos && createPortal(
        <div className={styles.quartosPop} role="dialog" aria-label={tr('Item nos quartos')}
          ref={quartosPanelRef} style={quartosPopPos}>
          <div className={styles.quartosPopHead}>
            <span className={styles.quartosPopNome}>{itemDesc(item)}</span>
            <span className={styles.quartosPopSub}>
              {nosQ.total} {tr('un em')} {nosQ.quartos.length} {nosQ.quartos.length === 1 ? tr('quarto') : tr('quartos')}
            </span>
          </div>
          <div className={styles.quartosList}>
            {nosQ.quartos.map((q) => (
              <div key={q.id} className={styles.quartosRow}>
                <span className={styles.quartosNome}>{tr('Quarto')} {q.id}</span>
                <span className={[
                  styles.quartosQtd,
                  q.atual < q.padrao ? styles.quartosQtdBaixa : '',
                ].join(' ')}>
                  {q.atual} {tr('de')} {q.padrao}
                </span>
              </div>
            ))}
          </div>
        </div>,
        document.body,
      )}
    </>);
  };

  const renderQtdTag = (item) => {
    const qty = itemQty(item);
    return itemServico(item) ? (
      <span className={[styles.tag, styles.tagPrimary].join(' ')}>{tr('Serviço')}</span>
    ) : (
      <span className={[styles.tag, qty <= LIMITE_ESTOQUE_BAIXO ? styles.tagRed : styles.tagEmerald].join(' ')}>
        {qty} {qty === 1 ? tr('unidade') : tr('unidades')}
      </span>
    );
  };

  // ── Cartões dos itens da categoria aberta ──────────────────
  const renderItens = () => (
    itensDaCat.length === 0 ? (
      <p className={styles.blockEmpty}>
        {itemSearch ? tr('Nenhum item encontrado para "{{itemSearch}}".', { itemSearch }) : tr('Nenhum item cadastrado nesta categoria.')}
      </p>
    ) : modoItens === 'lista' ? (
      <div className={styles.iScroll}>
        <table className={styles.iTable}>
          <thead><tr>
            <th>{tr('Item')}</th><th>{tr('Estoque')}</th><th>{tr('Fornecedor')}</th>
            <th>{tr('Nos quartos')}</th><th className={styles.iDir}>{tr('Custo')}</th>
            <th className={styles.iDir}>{tr('Venda')}</th><th aria-label={tr('Ações')} />
          </tr></thead>
          <tbody>
            {itensDaCat.map((item) => {
              const servico = itemServico(item);
              return (
                <tr key={item.id}>
                  <td className={styles.iNome}>{itemDesc(item)}</td>
                  <td className={styles.itemCardTags}>{renderQtdTag(item)}</td>
                  <td className={styles.iMuted}>{(!servico && itemForn(item)) || '—'}</td>
                  <td>{renderQuartosToggle(item) ?? <span className={styles.iMuted}>—</span>}</td>
                  <td className={[styles.iDir, styles.iMuted].join(' ')}>{servico ? '—' : fmtBRL(itemCompra(item))}</td>
                  <td className={[styles.iDir, styles.iVenda].join(' ')}>{fmtBRL(itemVenda(item))}</td>
                  <td className={styles.iAcao}>{renderItemMenu(item)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    ) : (
      <div className={styles.itemGrid}>
        {itensDaCat.map((item) => {
          const servico = itemServico(item);
          return (
            <div key={item.id} className={styles.itemCard}>
              <div className={styles.itemCardHead}>
                <p className={styles.itemCardNome}>{itemDesc(item)}</p>
                {renderItemMenu(item)}
              </div>

              <div className={styles.itemCardTags}>{renderQtdTag(item)}</div>

              {!servico && itemForn(item) && (
                <p className={styles.itemCardForn}>{itemForn(item)}</p>
              )}

              {/* Rodapé do cartão: quartos à esquerda, preço em destaque à direita. */}
              <div className={styles.itemCardFoot}>
                {renderQuartosToggle(item)}
                <div className={styles.itemCardPreco}>
                  <p className={styles.itemRowVenda}>{fmtBRL(itemVenda(item))}</p>
                  {!servico && (
                    <p className={styles.itemRowCompra}>{tr('custo')} {fmtBRL(itemCompra(item))}</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    )
  );

  // ── Ficha da categoria ─────────────────────────────────────
  const renderCatPanel = (cat) => {
    const items   = cat.items ?? [];
    const nItens  = catDash.quantidade_itens ?? items.length;
    const zerados = items.filter((i) => !itemServico(i) && itemQty(i) <= 0).length;
    const abas = [
      ['itens', tr('Itens')],
      ['dados', tr('Dados da categoria')],
    ];

    return (
      <div className={styles.detailPanel}>
        <section className={[styles.dCard, styles.fichaCard].join(' ')}>
          <h3 className={[styles.dCardHead, styles.fichaHead].join(' ')}>
            <BackBtn />
            <Tag size={16} />
            <span className={styles.dCardTitle}>{tr('Ficha da categoria')}</span>
            <div className={styles.dCardActions}>
              {canEditarCategoria && (
                <Button className={styles.btnSolid} onClick={() => openEditCat(cat)}>{tr('Editar')}</Button>
              )}
              <button type="button" className={styles.idClose} onClick={closeDetail}
                title={tr('Fechar ficha')} aria-label={tr('Fechar ficha')}>
                <X size={16} />
              </button>
            </div>
          </h3>

          <div className={[styles.dCardBody, styles.fichaBody].join(' ')}>
            <div className={styles.fichaTopo}>
              <div className={styles.fichaId}>
                <span className={styles.fichaIcone}><Tag size={26} /></span>
                <div className={styles.idHeadMain}>
                  <h2 className={styles.fichaNome}>{catNome(cat)}</h2>
                  {cat.descricao && <p className={styles.fichaSub}>{cat.descricao}</p>}
                  <div className={styles.idTags}>
                    <span className={styles.tag}>{nUn(nItens)}</span>
                    {zerados > 0 && (
                      <span className={[styles.tag, styles.tagRed].join(' ')}>{zerados} {tr('sem estoque')}</span>
                    )}
                  </div>
                </div>
              </div>
              <FichaTabs abas={abas} atual={abaFicha} onChange={setAbaFicha} />
            </div>

            {abaFicha === 'itens' && itemFormModal ? renderItemForm()
              : abaFicha === 'itens' && consumirModal && consumirOrigem === 'estoque' && consumirItem ? renderConsumir()
              : abaFicha === 'itens' && historicoItem ? renderHistorico()
              : abaFicha === 'dados' ? (
              <div className={styles.fieldGrid}>
                <Field label={tr('Nome')} value={catNome(cat)} />
                <Field label={tr('Descrição')} value={cat.descricao} />
                <Field label={tr('Itens')} value={String(nItens)} />
                {canDashboardCategoria && <>
                  <Field label={tr('Investido')} value={fmtBRL(catDash.valor_investido)} />
                  <Field label={tr('Lucro potencial')} value={fmtBRL(catDash.lucro_potencial)} />
                </>}
              </div>
            ) : (<>
              <div className={styles.itemToolbar}>
                <div className={[styles.searchWrap, styles.searchWrapFull, styles.itemSearch, itemSearch ? styles.searchAtiva : ''].join(' ')}>
                  <Search size={16} className={styles.searchIcon} />
                  <Input
                    value={itemSearch}
                    onChange={(e) => setItemSearch(e.target.value)}
                    placeholder={tr('Buscar item nesta categoria...')}
                    className={styles.searchInput}
                    aria-label={tr('Buscar item')}
                  />
                  {itemSearch.length > 0 && (
                    <button className={styles.searchClear} onClick={() => setItemSearch('')} aria-label={tr('Limpar busca')}>
                      <X size={14} />
                    </button>
                  )}
                </div>
                <div className={styles.viewToggle} role="group" aria-label={tr('Modo de visualização')}>
                  {[['blocos', LayoutGrid, tr('Blocos')], ['lista', List, tr('Lista')]].map(([m, Icon, label]) => (
                    <button key={m} type="button"
                      className={[styles.viewToggleBtn, modoItens === m ? styles.viewToggleOn : ''].join(' ')}
                      onClick={() => trocarModoItens(m)} aria-pressed={modoItens === m}
                      title={label} aria-label={label}>
                      <Icon size={16} />
                    </button>
                  ))}
                </div>
                {canAdicionarItem && (
                  <Button variant="primary" className={[styles.btnSolid, styles.btnPrimary].join(' ')}
                    onClick={() => openCreateItem(cat)}>
                    {tr('Novo item')}
                  </Button>
                )}
              </div>
              {renderItens()}
            </>)}
          </div>
        </section>
      </div>
    );
  };

  const renderQuartoItemMenu = (qi, q) => {
    const chave = `q${qi.id}`;
    const menu  = menuAberto === chave;
    const atual = qi.quantidade_atual ?? 0;
    const falta = (qi.quantidade_padrao ?? 0) - atual;
    const podeConsumir = canConsumirItem && atual > 0;
    const podeRepor    = canReporItem && falta > 0;
    if (!podeConsumir && !podeRepor) return null;
    return (
      <div className={styles.itemMenuWrap} ref={menu ? menuBtnRef : null}>
        <button type="button"
          className={[styles.itemMenuBtn, menu ? styles.itemMenuBtnOn : ''].join(' ')}
          onClick={(e) => abrirMenu(chave, e)}
          aria-haspopup="menu" aria-expanded={menu}
          title={tr('Ações do item')} aria-label={tr('Ações do item')}>
          <MenuIcon size={15} />
        </button>

        {menu && menuPos && createPortal(
          <div className={styles.itemMenu} role="menu"
            ref={menuPanelRef} style={menuPos}>
            {podeConsumir && (
              <button type="button" role="menuitem"
                className={[styles.itemMenuItem, styles.itemMenuItemDanger].join(' ')}
                onClick={(e) => { setMenuAberto(null); openConsumirQuarto(qi, q, e); }}>
                <Minus size={14} /> {tr('Consumir do quarto')}
              </button>
            )}
            {podeRepor && (
              <button type="button" role="menuitem" className={styles.itemMenuItem}
                onClick={(e) => { ancorarAcao(); setMenuAberto(null); openReporQuarto(qi, q, e); }}>
                <RefreshCw size={14} /> {tr('Repor do estoque')}
              </button>
            )}
          </div>,
          document.body,
        )}
      </div>
    );
  };

  // ── Ficha do quarto ────────────────────────────────────────
  const renderQuartoPanel = (q) => {
    const itens  = q.quarto_itens ?? [];
    const abaixo = itens.filter((qi) => (qi.quantidade_atual ?? 0) < (qi.quantidade_padrao ?? 0)).length;

    return (
      <div className={styles.detailPanel}>
        <section className={[styles.dCard, styles.fichaCard].join(' ')}>
          <h3 className={[styles.dCardHead, styles.fichaHead].join(' ')}>
            <BackBtn />
            <BedDouble size={16} />
            <span className={styles.dCardTitle}>{tr('Itens do quarto')}</span>
            <div className={styles.dCardActions}>
              {canReporItem && !addQuartoItem && abaixo > 0 && (
                <Button className={styles.btnSolid} onClick={() => handleReporTudo(q)} disabled={reporTudoSaving}>
                  {reporTudoSaving ? <Loader2 size={14} className={styles.spinInline} /> : <RefreshCw size={14} />}
                  {tr('Repor quarto')}
                </Button>
              )}
              {canAdicionarItem && !addQuartoItem && (
                <Button variant="primary" className={[styles.btnSolid, styles.btnPrimary].join(' ')}
                  onClick={openAddQuartoItem}>
                  {tr('Adicionar item')}
                </Button>
              )}
              <button type="button" className={styles.idClose} onClick={closeDetail}
                title={tr('Fechar ficha')} aria-label={tr('Fechar ficha')}>
                <X size={16} />
              </button>
            </div>
          </h3>

          <div className={[styles.dCardBody, styles.fichaBody].join(' ')}>
            <div className={styles.fichaTopo}>
              <div className={styles.fichaId}>
                <span className={styles.fichaIcone}><BedDouble size={26} /></span>
                <div className={styles.idHeadMain}>
                  <h2 className={styles.fichaNome}>{tr('Quarto')} {q.id}</h2>
                  {q.descricao && <p className={styles.fichaSub}>{q.descricao}</p>}
                  <div className={styles.idTags}>
                    <span className={styles.tag}>{nUn(itens.length)}</span>
                    {abaixo > 0 && <span className={[styles.tag, styles.tagRed].join(' ')}>{abaixo} {tr('a repor')}</span>}
                  </div>
                </div>
              </div>
              <FichaTabs abas={[['itens', tr('Itens')]]} atual="itens" onChange={() => {}} />
            </div>

            {addQuartoItem ? renderAddQuartoItem(q)
              : consumirModal && consumirOrigem === 'quarto' && consumirItem ? renderConsumir()
              : itens.length === 0 ? (
              <p className={styles.blockEmpty}>{tr('Nenhum item configurado para este quarto.')}</p>
            ) : (
              <div className={styles.iScroll}>
                <table className={styles.iTable}>
                  <thead><tr>
                    <th>{tr('Item')}</th><th>{tr('Quantidade')}</th><th>{tr('A repor')}</th>
                    <th className={styles.iDir}>{tr('Preço')}</th><th aria-label={tr('Ações')} />
                  </tr></thead>
                  <tbody>
                    {itens.map((qi) => {
                      const atual  = qi.quantidade_atual  ?? 0;
                      const padrao = qi.quantidade_padrao ?? 0;
                      const falta  = Math.max(0, padrao - atual);
                      return (
                        <tr key={qi.id}>
                          <td className={styles.iNome}>{qi.item?.descricao ?? '—'}</td>
                          <td className={styles.itemCardTags}>
                            <span className={[styles.tag, falta > 0 ? styles.tagRed : styles.tagEmerald].join(' ')}>
                              {atual} {tr('de')} {padrao}
                            </span>
                          </td>
                          <td className={styles.iMuted}>{falta > 0 ? `${falta} ${tr('un')}` : '—'}</td>
                          <td className={[styles.iDir, styles.iVenda].join(' ')}>{fmtBRL(qi.preco ?? 0)}</td>
                          <td className={styles.iAcao}>{renderQuartoItemMenu(qi, q)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </div>
    );
  };

  // ── Adicionar item ao quarto, dentro da ficha do quarto ────
  const renderAddQuartoItem = (q) => {
    const jaNoQuarto = new Set((q.quarto_itens ?? []).map((qi) => qi.item?.id));
    const cancelar   = () => setAddQuartoItem(false);
    const geral      = addQIForm.itemId ? itemQty(itemPorId.get(Number(addQIForm.itemId))) : null;
    const setCampo   = (campo, v) => setAddQIForm((f) => ({ ...f, [campo]: v }));
    return (
      <div className={styles.inlineView}>
        <div className={styles.inlineHead}>
          <button type="button" className={styles.inlineBack} onClick={cancelar}>
            <ChevronLeft size={15} /> {tr('Voltar aos itens')}
          </button>
          <span className={styles.inlineTitle}>{tr('Adicionar item ao quarto')}</span>
        </div>

        <div className={styles.formBody}>
          <FormField label={tr('Item *')}>
            <Select value={addQIForm.itemId} onChange={(e) => setCampo('itemId', e.target.value)}>
              <option value="">{tr('Selecione...')}</option>
              {sections.map((sec) => {
                const opcoes = (sec.items ?? []).filter((i) => !itemServico(i) && !jaNoQuarto.has(i.id));
                return opcoes.length > 0 && (
                  <optgroup key={sec.id} label={catNome(sec)}>
                    {opcoes.map((i) => (
                      <option key={i.id} value={i.id}>{itemDesc(i)} ({itemQty(i)} {tr('em estoque')})</option>
                    ))}
                  </optgroup>
                );
              })}
            </Select>
          </FormField>
          <div className={styles.formRow}>
            <FormField label={tr('Quantidade padrão *')}>
              <Input type="number" placeholder="0" min="1"
                value={addQIForm.padrao} onChange={(e) => setCampo('padrao', e.target.value)} />
            </FormField>
            <FormField label={geral != null ? tr('Colocar agora (máx. {{max}})', { max: geral }) : tr('Colocar agora')}>
              <Input type="number" placeholder="0" min="0" max={geral ?? undefined}
                value={addQIForm.atual} onChange={(e) => setCampo('atual', e.target.value)} />
            </FormField>
          </div>
          <p className={styles.blockEmpty}>{tr('O que for colocado agora sai do estoque geral.')}</p>
        </div>

        <div className={styles.formFoot}>
          <Button className={styles.btnSolid} onClick={cancelar}>{tr('Cancelar')}</Button>
          <Button variant="primary" className={[styles.btnSolid, styles.btnPrimary].join(' ')}
            onClick={() => handleAddQuartoItem(q)} disabled={addQISaving}>
            {addQISaving && <Loader2 size={14} className={styles.spinInline} />}
            {tr('Adicionar')}
          </Button>
        </div>
      </div>
    );
  };

  // ── Formulário de item, dentro da aba Itens da ficha ───────
  const renderItemForm = () => {
    const editar = itemFormModal === 'edit';
    const cancelar = () => setItemFormModal(null);
    return (
      <div className={styles.inlineView}>
        <div className={styles.inlineHead}>
          <button type="button" className={styles.inlineBack} onClick={cancelar}>
            <ChevronLeft size={15} /> {tr('Voltar aos itens')}
          </button>
          <span className={styles.inlineTitle}>{editar ? tr('Editar item') : tr('Novo item')}</span>
        </div>

        <div className={styles.formBody}>
          <FormField label={tr('Descrição *')}>
            <Input
              placeholder={tr('Ex: DETERGENTE NEUTRO 500ML')}
              value={itemForm.descricao}
              onChange={(e) => setItemForm((f) => ({ ...f, descricao: e.target.value.toUpperCase() }))}
            />
          </FormField>
          <FormField label={tr('Categoria *')}>
            <Select
              value={itemForm.categoriaId}
              onChange={(e) => setItemForm((f) => ({ ...f, categoriaId: e.target.value }))}
            >
              <option value="">{tr('Selecione...')}</option>
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
              <span className={styles.checkboxLabel}>{tr('É um serviço')}</span>
              <span className={styles.checkboxSub}>
                {tr('Serviços não têm estoque: não se informa quantidade nem valor de compra.')}
              </span>
            </div>
          </label>
        </div>

        <div className={styles.formFoot}>
          <Button className={styles.btnSolid} onClick={cancelar}>{tr('Cancelar')}</Button>
          <Button variant="primary" className={[styles.btnSolid, styles.btnPrimary].join(' ')}
            onClick={handleSaveItem} disabled={itemSaving}>
            {itemSaving && <Loader2 size={14} className={styles.spinInline} />}
            {editar ? tr('Salvar alterações') : tr('Criar item')}
          </Button>
        </div>
      </div>
    );
  };

  // ── Consumir, dentro da aba Itens da ficha ─────────────────
  const renderConsumir = () => {
    const item     = consumirItem;
    const qty      = Number(consumirQtd) || 0;
    const esperado = consumoEsperado();
    const nomeFunc = loggedUser?.pessoa?.nome?.toUpperCase();
    const setPag   = (campo, v) => setConsumiPag((p) => ({ ...p, [campo]: v }));
    return (
      <div className={[styles.inlineView, styles.consumoView].join(' ')}>
        <div className={styles.inlineHead}>
          <button type="button" className={styles.inlineBack} onClick={() => setConsumiModal(false)}>
            <ChevronLeft size={15} /> {tr('Voltar aos itens')}
          </button>
          <span className={styles.inlineTitle}>
            <Minus size={15} />
            {consumirOrigem === 'quarto'
              ? tr('Consumir do quarto {{id}} —', { id: consumirQuarto })
              : tr('Consumir do estoque —')} {itemDesc(item)}
          </span>
        </div>

        <div className={styles.consumoGrid}>
          <div className={styles.formBody}>
            <p className={styles.consumoSecao}>{tr('Consumo')}</p>
            <FormField label={tr('Quantidade a consumir *')}>
              <Input
                type="number" placeholder="0" min="1"
                value={consumirQtd}
                onChange={(e) => setConsumiQtd(e.target.value)}
              />
            </FormField>

            {consumirQuarto && (() => {
              const entrada = quartoItens.find(qi => qi.item?.id === item?.id);
              if (!entrada) return (
                <div className={styles.quartoItensBox}>
                  <span className={styles.quartoItensNone}>{tr('Item não configurado para este quarto')}</span>
                </div>
              );
              const { quantidade_atual, quantidade_padrao } = entrada;
              const ok  = quantidade_atual >= quantidade_padrao;
              const qtdExcede = qty > quantidade_atual;
              return (
                <div className={qtdExcede ? styles.quartoItensBoxErr : styles.quartoItensBox}>
                  <div className={styles.quartoItensRow}>
                    <span className={styles.quartoItensLabel}>{tr('No quarto agora')}</span>
                    <span className={ok ? styles.quartoItensOk : styles.quartoItensLow}>
                      {quantidade_atual} / {quantidade_padrao}
                    </span>
                  </div>
                  {qtdExcede && (
                    <span className={styles.quartoItensNone} style={{ color: '#ef4444', fontStyle: 'normal' }}>
                      {tr('Quantidade maior que o disponível no quarto (')}{quantidade_atual} {tr('un.)')}
                    </span>
                  )}
                </div>
              );
            })()}

            <label className={styles.checkInline}>
              <input
                type="checkbox"
                checked={consumirDespesa}
                onChange={(e) => setConsumiDespesa(e.target.checked)}
              />
              <span>{tr('Despesa pessoal')}</span>
            </label>

            {qty > 0 && (
              <div className={styles.consumoAlert}>
                <div className={styles.consumoAlertRow}>
                  <span>{tr('Total')}</span>
                  <strong>{fmtBRL(esperado)}</strong>
                </div>
              </div>
            )}
          </div>

          <div className={styles.formBody}>
            <p className={styles.consumoSecao}>{tr('Pagamento')}</p>
            {consumirDespesa ? (
              <p className={styles.blockEmpty}>{tr('Despesa pessoal: sem cobrança.')}</p>
            ) : (<>
              <div className={styles.formRow}>
                <FormField label={tr('Tipo de Pagamento *')}>
                  <Select value={consumirPag.tipo} onChange={(e) => setPag('tipo', e.target.value)}>
                    <option value="">{tr('Selecione...')}</option>
                    {tiposPagamento.map((tp) => (
                      <option key={tp.id} value={tp.id}>{tp.descricao}</option>
                    ))}
                  </Select>
                </FormField>
                <FormField label={tr('Valor')}>
                  <Input value={fmtBRL(esperado)} readOnly tabIndex={-1} className={styles.inputFixo} />
                </FormField>
              </div>
              <FormField label={tr('Nome do Pagador *')}>
                <Input
                  placeholder={tr('Nome completo')}
                  value={consumirPag.nome}
                  onChange={(e) => setPag('nome', e.target.value.toUpperCase())}
                />
              </FormField>
              {nomeFunc && (
                <label className={styles.checkInline}>
                  <input
                    type="checkbox"
                    checked={consumirPag.nome === nomeFunc}
                    onChange={(e) => setPag('nome', e.target.checked ? nomeFunc : '')}
                  />
                  <span>{tr('Nome do funcionário')}</span>
                </label>
              )}
              <FormField label={tr('Descrição')}>
                <Input
                  placeholder={tr('Descrição do pagamento')}
                  value={consumirPag.descricao}
                  onChange={(e) => setPag('descricao', e.target.value.toUpperCase())}
                />
              </FormField>
            </>)}
          </div>
        </div>

        <div className={styles.formFoot}>
          <Button className={styles.btnSolid} onClick={() => setConsumiModal(false)}>{tr('Cancelar')}</Button>
          <Button variant="primary" className={[styles.btnSolid, styles.btnPrimary].join(' ')}
            onClick={handleConsumir} disabled={consumirSaving}>
            {consumirSaving && <Loader2 size={14} className={styles.spinInline} />}
            {tr('Confirmar consumo')}
          </Button>
        </div>
      </div>
    );
  };

  // ── Histórico de reposições, dentro da aba Itens da ficha ──
  const renderHistorico = () => (
    <div className={styles.inlineView}>
      <div className={styles.inlineHead}>
        <button type="button" className={styles.inlineBack} onClick={closeHistorico}>
          <ChevronLeft size={15} /> {tr('Voltar aos itens')}
        </button>
        <span className={styles.inlineTitle}>
          <History size={15} /> {tr('Histórico —')} {itemDesc(historicoItem)}
        </span>
      </div>

      {/* Editar uma reposição: os campos abrem aqui, acima da tabela */}
      {editHistModal && editHistEntry && (
        <div className={styles.inlineEdit}>
          <div className={styles.itemInfoBox}>
            <span className={styles.itemInfoLabel}>{tr('Editar Reposição')}</span>
            <span className={styles.itemInfoName}>{fmtDate(repData(editHistEntry))}</span>
            <span className={styles.itemInfoSub}>
              {tr('Compra un.:')} <strong>{fmtBRL(repCompra(editHistEntry))}</strong>
              {' · '}{tr('Venda un.:')} <strong>{fmtBRL(repVenda(editHistEntry))}</strong>
            </span>
          </div>
          <div className={styles.formRow}>
            <FormField label={tr('Quantidade (unidades) *')}>
              <Input
                type="number" placeholder="0" min="1"
                value={editHistForm.quantidade_unidades}
                onChange={(e) => setEditHistForm((f) => ({ ...f, quantidade_unidades: e.target.value }))}
              />
            </FormField>
            <FormField label={tr('Fornecedor')}>
              <Input
                placeholder={tr('NOME DO FORNECEDOR')}
                value={editHistForm.fornecedor}
                onChange={(e) => setEditHistForm((f) => ({ ...f, fornecedor: e.target.value.toUpperCase() }))}
              />
            </FormField>
          </div>
          <div className={styles.formFoot}>
            <Button className={styles.btnSolid} onClick={() => setEditHistModal(false)}>{tr('Cancelar')}</Button>
            <Button variant="primary" className={[styles.btnSolid, styles.btnPrimary].join(' ')}
              onClick={handleSaveHist} disabled={editHistSaving}>
              {editHistSaving && <Loader2 size={14} className={styles.spinInline} />}
              {tr('Salvar')}
            </Button>
          </div>
        </div>
      )}

      {historicoLoading ? (
        <div className={styles.emptyInline}><Loader2 size={24} className={styles.spin} /></div>
      ) : !historicoReposicao.length ? (
        <div className={styles.emptyInline}>
          <Package size={24} color="var(--text-2)" />
          <span>{tr('Nenhuma reposição registrada')}</span>
        </div>
      ) : (
        <div className={styles.iScroll}>
          <table className={styles.iTable}>
            <thead><tr>
              <th>{tr('Data')}</th><th>{tr('Qtd')}</th>
              <th className={styles.iDir}>{tr('Compra Un.')}</th>
              <th className={styles.iDir}>{tr('Venda Un.')}</th>
              <th className={styles.iDir}>{tr('Margem')}</th>
              <th>{tr('Fornecedor')}</th><th>{tr('Responsável')}</th>
              <th aria-label={tr('Ações')} />
            </tr></thead>
            <tbody>
              {historicoReposicao.map((entry, idx) => (
                <tr key={entry.id ?? idx}
                  className={editHistModal && editHistEntry?.id === entry.id ? styles.rowEditando : ''}>
                  <td>{fmtDate(repData(entry))}</td>
                  <td className={styles.itemCardTags}>
                    <span className={[styles.tag, styles.tagEmerald].join(' ')}>+{repQty(entry)}</span>
                  </td>
                  <td className={[styles.iDir, styles.iMuted].join(' ')}>{fmtBRL(repCompra(entry))}</td>
                  <td className={[styles.iDir, styles.iVenda].join(' ')}>{fmtBRL(repVenda(entry))}</td>
                  <td className={styles.iDir}>
                    {repCompra(entry) > 0 && repVenda(entry) > 0
                      ? ((repVenda(entry) - repCompra(entry)) / repCompra(entry) * 100).toFixed(1) + '%'
                      : '—'}
                  </td>
                  <td>{repForn(entry) || '—'}</td>
                  <td className={styles.iMuted}>{repFunc(entry) || '—'}</td>
                  <td className={styles.iAcao}>
                    <button type="button" className={styles.itemMenuBtn} onClick={() => openEditHist(entry)}
                      title={tr('Editar')} aria-label={tr('Editar')}>
                      <Edit2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  // ── Histórico de consumos do hotel, no lugar da ficha ──────
  const renderConsumos = () => (
    <div className={styles.detailPanel}>
      <section className={[styles.dCard, styles.fichaCard].join(' ')}>
        <h3 className={[styles.dCardHead, styles.fichaHead].join(' ')}>
          <BackBtn onClick={fecharConsumos} />
          <History size={16} />
          <span className={styles.dCardTitle}>{tr('Histórico de Consumos')}</span>
          <div className={styles.dCardActions}>
            <button type="button" className={styles.idClose} onClick={fecharConsumos}
              title={tr('Fechar')} aria-label={tr('Fechar')}>
              <X size={16} />
            </button>
          </div>
        </h3>

        <div className={[styles.dCardBody, styles.fichaBody].join(' ')}>
          <div className={styles.inlineView}>
            {/* Detalhe do consumo escolhido na tabela, acima dela */}
            {consumoDetalhe && (
              <div className={styles.inlineEdit}>
                <div className={styles.inlineHead}>
                  <span className={styles.inlineTitle}><History size={15} /> {tr('Detalhe do Consumo')}</span>
                </div>
              {consumoDetalhe && (() => {
                const c = consumoDetalhe;
                const pag = c.pagamento;
                return (
                  <div className={styles.formBody}>
                    {/* Item */}
                    <div className={styles.itemInfoBox}>
                      <span className={styles.itemInfoLabel}>{tr('Item')}</span>
                      <span className={styles.itemInfoName}>{c.item?.descricao ?? '—'}</span>
                      <span className={styles.itemInfoSub}>
                        {tr('ID #')}{c.item?.id} {tr('· Quantidade:')} <strong>{c.quantidade}</strong>
                      </span>
                    </div>
        
                    {/* Pagamento */}
                    <div className={styles.itemInfoBox}>
                      <span className={styles.itemInfoLabel}>{tr('Pagamento')}</span>
                      {pag ? (
                        <>
                          <span className={styles.itemInfoName}>
                            {pag.tipo_pagamento?.descricao ?? '—'}
                            {' · '}
                            <span className={styles.valVenda}>{fmtBRL(pag.valor)}</span>
                          </span>
                          <span className={styles.itemInfoSub}>
                            {tr('Pagador:')} <strong>{pag.nome_pagador ?? '—'}</strong>
                          </span>
                          {pag.descricao && (
                            <span className={styles.itemInfoSub}>{tr('Descrição:')} {pag.descricao}</span>
                          )}
                          {pag.desconto != null && (
                            <span className={styles.itemInfoSub}>{tr('Desconto:')} <strong>{fmtBRL(pag.desconto)}</strong></span>
                          )}
                          <span className={styles.itemInfoSub}>
                            {tr('Registrado em:')} {pag.data_hora_registro ?? '—'}
                            {' · '}
                            {pag.cancelado
                              ? <span className={styles.valRose}>{tr('Cancelado')}</span>
                              : <span className={styles.valVenda}>{tr('Ativo')}</span>}
                          </span>
                        </>
                      ) : (
                        <span className={styles.itemInfoSub}>{tr('Sem pagamento registrado')}</span>
                      )}
                    </div>
        
                    {/* Meta */}
                    <div className={styles.itemInfoBox}>
                      <span className={styles.itemInfoLabel}>{tr('Informações')}</span>
                      <span className={styles.itemInfoSub}>
                        {tr('Data:')} <strong>{c.data_hora_registro ?? '—'}</strong>
                      </span>
                      <span className={styles.itemInfoSub}>
                        {tr('Responsável:')} <strong>{c.funcionario?.nome ?? '—'}</strong>
                      </span>
                      {c.quarto && (
                        <span className={styles.itemInfoSub}>
                          {tr('Quarto:')} <strong>{c.quarto.descricao ?? `#${c.quarto.id}`}</strong>
                        </span>
                      )}
                      <span className={styles.itemInfoSub}>
                        {tr('Despesa pessoal:')}{' '}
                        <strong>{c.despesa_pessoal ? tr('Sim') : tr('Não')}</strong>
                      </span>
                    </div>
                  </div>
                );
              })()}
        
                <div className={styles.formFoot}>
                  {confirmCancelar ? (
                    <>
                      <span className={styles.confirmPergunta}>{tr('Confirmar cancelamento?')}</span>
                      <Button className={styles.btnSolid} onClick={() => setConfirmCancelar(false)} disabled={cancelandoConsumo}>
                        {tr('Não')}
                      </Button>
                      <Button variant="danger" className={[styles.btnSolid, styles.btnDanger].join(' ')}
                        onClick={handleCancelarConsumo} disabled={cancelandoConsumo}>
                        {cancelandoConsumo && <Loader2 size={14} className={styles.spinInline} />}
                        {tr('Sim, cancelar')}
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button className={styles.btnSolid} onClick={() => { setConsumoDetalhe(null); setConfirmCancelar(false); }}>
                        {tr('Fechar')}
                      </Button>
                      {!consumoDetalhe.cancelado && (
                        <Button variant="danger" className={[styles.btnSolid, styles.btnDanger].join(' ')}
                          onClick={() => setConfirmCancelar(true)}>
                          {tr('Cancelar Consumo')}
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}

              {consumosLoading ? (
                <div className={styles.emptyInline}><Loader2 size={24} className={styles.spin} /></div>
              ) : !consumos.length ? (
                <div className={styles.emptyInline}>
                  <Boxes size={24} color="var(--text-2)" />
                  <span>{tr('Nenhum consumo registrado')}</span>
                </div>
              ) : (
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>{tr('Data')}</th>
                        <th>{tr('Item')}</th>
                        <th className={styles.thCenter}>{tr('Qtd')}</th>
                        <th>{tr('Pagamento')}</th>
                        <th>{tr('Quarto')}</th>
                        <th className={styles.thCenter}>{tr('Despesa pessoal')}</th>
                        <th>{tr('Responsável')}</th>
                        <th className={styles.thCenter}>{tr('Status')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {consumos.map((c, idx) => (
                        <tr key={c.id ?? idx}
                    className={[c.cancelado ? styles.rowCancelado : styles.row, consumoDetalhe?.id === c.id ? styles.rowEditando : ''].join(' ')}
                    onClick={() => { setConsumoDetalhe(c); setConfirmCancelar(false); }}>
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
                            {c.quarto ? tr('Quarto {{id}} - {{descricao}}', { id: c.quarto.id, descricao: c.quarto.descricao }) : '—'}
                          </td>
                          <td className={styles.tdCenter}>
                            {c.despesa_pessoal
                              ? <span className={[styles.qtyBadge, styles.qtyBadgeOk].join(' ')}>{tr('Sim')}</span>
                              : <span className={styles.tdSecondary}>—</span>}
                          </td>
                          <td className={styles.tdSecondary}>{c.funcionario?.nome ?? '—'}</td>
                          <td className={styles.tdCenter}>
                            {c.cancelado
                              ? <span className={[styles.qtyBadge, styles.qtyBadgeLow].join(' ')}>{tr('Cancelado')}</span>
                              : <span className={styles.tdSecondary}>—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
      
          </div>
        </div>
      </section>
    </div>
  );

  // ── Formulário de categoria, no lugar da ficha ─────────────
  const renderForm = () => {
    const isCat   = true;
    const editar  = catFormModal === 'edit';
    const salvando = catSaving;
    const cancelar = () => setCatFormModal(null);
    const titulo  = editar ? tr('Editar categoria') : tr('Nova categoria');
    const voltarFicha = editar;

    return (
      <div className={styles.detailPanel}>
        <section className={[styles.dCard, styles.fichaCard].join(' ')}>
          <h3 className={[styles.dCardHead, styles.fichaHead].join(' ')}>
            <BackBtn onClick={cancelar} title={voltarFicha ? tr('Voltar para a ficha') : tr('Voltar para a lista')} />
            {isCat ? <Tag size={16} /> : <Package size={16} />}
            <span className={styles.dCardTitle}>{titulo}</span>
            <div className={styles.dCardActions}>
              <button type="button" className={styles.idClose} onClick={cancelar}
                title={tr('Cancelar')} aria-label={tr('Cancelar')}>
                <X size={16} />
              </button>
            </div>
          </h3>

          <div className={[styles.dCardBody, styles.fichaBody].join(' ')}>
            <div className={styles.formBody}>
              {isCat ? (<>
                <FormField label={tr('Nome da Categoria *')}>
                  <Input
                    placeholder={tr('EX: BEBIDAS')}
                    value={catForm.nome}
                    onChange={(e) => setCatForm((f) => ({ ...f, nome: e.target.value.toUpperCase() }))}
                  />
                </FormField>
                <FormField label={tr('Descrição')}>
                  <Input
                    placeholder={tr('DESCRIÇÃO DA CATEGORIA')}
                    value={catForm.descricao}
                    onChange={(e) => setCatForm((f) => ({ ...f, descricao: e.target.value.toUpperCase() }))}
                  />
                </FormField>
              </>) : (<>
                <FormField label={tr('Descrição *')}>
                  <Input
                    placeholder={tr('Ex: DETERGENTE NEUTRO 500ML')}
                    value={itemForm.descricao}
                    onChange={(e) => setItemForm((f) => ({ ...f, descricao: e.target.value.toUpperCase() }))}
                  />
                </FormField>
                <FormField label={tr('Categoria *')}>
                  <Select
                    value={itemForm.categoriaId}
                    onChange={(e) => setItemForm((f) => ({ ...f, categoriaId: e.target.value }))}
                  >
                    <option value="">{tr('Selecione...')}</option>
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
                    <span className={styles.checkboxLabel}>{tr('É um serviço')}</span>
                    <span className={styles.checkboxSub}>
                      {tr('Serviços não têm estoque: não se informa quantidade nem valor de compra.')}
                    </span>
                  </div>
                </label>
              </>)}
            </div>

            <div className={styles.formFoot}>
              <Button className={styles.btnSolid} onClick={cancelar}>{tr('Cancelar')}</Button>
              <Button variant="primary" className={[styles.btnSolid, styles.btnPrimary].join(' ')}
                onClick={isCat ? handleSaveCat : handleSaveItem} disabled={salvando}>
                {salvando && <Loader2 size={14} className={styles.spinInline} />}
                {editar ? tr('Salvar alterações') : isCat ? tr('Criar categoria') : tr('Criar item')}
              </Button>
            </div>
          </div>
        </section>
      </div>
    );
  };

  // Tabela de preços: o que aparece à direita enquanto nenhuma ficha está aberta.
  const renderTabelaPrecos = () => (
    <div className={styles.detailPanel}>
      <section className={[styles.dCard, styles.fichaCard].join(' ')}>
        <h3 className={[styles.dCardHead, styles.fichaHead].join(' ')}>
          <Package size={16} />
          <span className={styles.dCardTitle}>{tr('Tabela de preços')}</span>
        </h3>
        <div className={[styles.dCardBody, styles.fichaBody, styles.precoBody].join(' ')}>
          {loading ? <SkeletonLista linhas={5} />
            : sections.length === 0 ? <p className={styles.blockEmpty}>{tr('Nenhuma categoria cadastrada.')}</p>
            : sections.map((section) => {
              const items = section.items ?? [];
              return (
                <div key={section.id} className={styles.precoBloco}>
                  <h4 className={styles.precoCat}>{catNome(section)}</h4>
                  {items.length === 0 ? (
                    <p className={styles.blockEmpty}>{tr('Nenhum item cadastrado nesta categoria.')}</p>
                  ) : (
                    <table className={[styles.iTable, styles.precoTable].join(' ')}>
                      <thead><tr>
                        <th>{tr('Descrição')}</th>
                        <th className={styles.iDir}>{tr('Estoque')}</th>
                        <th className={styles.iDir}>{tr('Venda')}</th>
                      </tr></thead>
                      <tbody>
                        {items.map((item) => (
                          <tr key={item.id}>
                            <td className={styles.iNome}>{itemDesc(item)}</td>
                            <td className={[styles.iDir, styles.iMuted].join(' ')}>{itemServico(item) ? '—' : itemQty(item)}</td>
                            <td className={[styles.iDir, styles.iVenda].join(' ')}>{fmtBRL(itemVenda(item))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              );
            })}
        </div>
      </section>
    </div>
  );

  return (
    <div className={styles.page}>
      <Notification notification={notification} />

      <div className={styles.container}>
        {/* Abaixo de 1024px, com ficha ou formulário aberto, ele toma a tela e a lista sai. */}
        <main className={[styles.split, (detailCat || detailQuarto || formAtivo || consumosModal) ? styles.splitListHidden : ''].join(' ')}>

          {/* ══ LISTA — CATEGORIAS OU QUARTOS ═══════════════════ */}
          <aside className={styles.listPanel}>
            <div className={styles.listTopoEscuro}>
            {/* abas Categorias / Quartos e o cadastro de categoria ao lado */}
            <div className={styles.listTopo}>
              <div className={styles.segmented}>
                <button type="button"
                  className={[styles.segmentedBtn, !isQuartos ? styles.segmentedBtnActive : ''].join(' ')}
                  onClick={() => changeAba('cat')}>
                  {tr('Categorias')}
                </button>
                <button type="button"
                  className={[styles.segmentedBtn, isQuartos ? styles.segmentedBtnActive : ''].join(' ')}
                  onClick={() => changeAba('quarto')}>
                  {tr('Quartos')}
                </button>
              </div>
              {!isQuartos && canAdicionarCategoria && !formAtivo && (
                <Button variant="primary" className={[styles.btnSolid, styles.btnPrimary].join(' ')}
                  onClick={openCreateCat}>
                  {tr('Cadastrar')}
                </Button>
              )}
            </div>

            <div className={[styles.searchWrap, styles.searchWrapFull, search ? styles.searchAtiva : ''].join(' ')}>
              <Search size={16} className={styles.searchIcon} />
              <Input
                value={search}
                onChange={handleSearch}
                placeholder={isQuartos ? tr('Buscar quarto...') : tr('Buscar categoria...')}
                className={styles.searchInput}
                aria-label={isQuartos ? tr('Buscar quarto') : tr('Buscar categoria')}
              />
              {search.length > 0 && (
                <button className={styles.searchClear} onClick={() => setSearch('')} aria-label={tr('Limpar busca')}>
                  <X size={14} />
                </button>
              )}
            </div>

            </div>
            <div className={styles.listCorpo}>
            <div className={styles.listMeta}>
              <span>
                {loading
                  ? tr('Carregando...')
                  : isQuartos
                    ? (quartosFiltrados.length !== 1 ? tr('{{n}} quartos', { n: quartosFiltrados.length }) : tr('{{n}} quarto', { n: quartosFiltrados.length }))
                    : (catsFiltradas.length !== 1 ? tr('{{n}} categorias', { n: catsFiltradas.length }) : tr('{{n}} categoria', { n: catsFiltradas.length }))}
              </span>
              {canHistoricoConsumo && (
                <button type="button" className={styles.listMetaLink} onClick={openConsumos}>
                  {tr('Histórico de Consumos')}
                </button>
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
                      {search ? tr('Nenhum quarto encontrado para "{{search}}".', { search })
                        : tr('Nenhum quarto cadastrado.')}
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
                      onClick={() => openQuarto(q)}>
                      <span className={styles.listItemBody}>
                        <span className={styles.listItemName}>
                          <span className={styles.nome}>{tr('Quarto')} {q.id} · {q.descricao}</span>
                          {abaixo > 0 && <span className={[styles.tag, styles.tagRed].join(' ')}>{abaixo} {tr('a repor')}</span>}
                        </span>
                        <span className={styles.listItemSub}>
                          {[nUn(itens.length), itens.length > 0 && `${unidades} ${tr('un')}`].filter(Boolean).join(' · ')}
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
                    {search ? tr('Nenhuma categoria encontrada para "{{search}}".', { search })
                      : tr('Nenhuma categoria cadastrada.')}
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
                    onClick={() => openCat(section)}>
                    <span className={styles.listItemBody}>
                      <span className={styles.listItemName}>
                        <span className={styles.nome}>{catNome(section)}</span>
                        {zerados > 0 && <span className={[styles.tag, styles.tagRed].join(' ')}>{zerados} {tr('sem estoque')}</span>}
                      </span>
                      <span className={styles.listItemSub}>
                        {[nUn(nItens), section.descricao].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                    <ChevronRight size={16} className={styles.listChevron} />
                  </button>
                );
              })}
            </div>
            </div>
          </aside>

          {/* ══ DIREITA: formulário ou ficha ══════ */}
          {formAtivo ? renderForm()
            : consumosModal ? renderConsumos()
            : isQuartos && detailQuarto ? renderQuartoPanel(detailQuarto)
            : detailCat ? renderCatPanel(detailCat)
            : isDesktop ? renderTabelaPrecos()
            : null}
        </main>
      </div>

      {/* ═══════════════════════════════════════════════════════
          CAIXA FLUTUANTE — Repor estoque
      ═══════════════════════════════════════════════════════ */}
      {acaoAberta && acaoPos && createPortal(
        <div className={styles.acaoPop} role="dialog" ref={acaoPanelRef}
          style={acaoPos}
          aria-label={reporQuarto ? tr('Repor do estoque') : tr('Repor Estoque')}>
          <div className={styles.acaoPopHead}>
            <RefreshCw size={15} />
            <span className={styles.acaoPopTitle}>
              {reporQuarto ? tr('Repor do estoque')
                : reporItem && itemServico(reporItem) ? tr('Alterar valor') : tr('Repor Estoque')}
            </span>
            <button type="button" className={styles.acaoPopClose} onClick={fecharAcao}
              title={tr('Fechar')} aria-label={tr('Fechar')}>
              <X size={15} />
            </button>
          </div>

          <div className={styles.acaoPopBody}>
            {reporQuarto ? (() => {
              const { qi, quarto } = reporQuarto;
              const max = reporQuartoMax(qi);
              return (
                <div className={styles.formBody}>
                  <span className={styles.itemInfoName}>{qi.item?.descricao ?? '—'}</span>
                  <span className={styles.itemInfoSub}>
                    {tr('Quarto')} {quarto.id} · {qi.quantidade_atual ?? 0} {tr('de')} {qi.quantidade_padrao ?? 0}
                    {' · '}{tr('estoque geral')} {itemQty(itemPorId.get(qi.item?.id))}
                  </span>
                  <FormField label={tr('Quantidade (máx. {{max}}) *', { max })}>
                    <Input
                      type="number" placeholder="0" min="1" max={max}
                      value={reporQuartoQtd}
                      onChange={(e) => setReporQuartoQtd(e.target.value)}
                    />
                  </FormField>
                </div>
              );
            })() : reporItem && (
              <div className={styles.formBody}>
                <span className={styles.itemInfoName}>{itemDesc(reporItem)}</span>
    
                {/* Serviço não tem estoque: só o valor de venda faz sentido. */}
                {!itemServico(reporItem) && (
                  <>
                    <FormField label={tr('Quantidade (unidades) *')}>
                      <Input
                        type="number" placeholder="0" min="1"
                        value={reporForm.quantidade_unidades}
                        onChange={(e) => setReporForm((f) => ({ ...f, quantidade_unidades: e.target.value }))}
                      />
                    </FormField>
                    <FormField label={tr('Fornecedor *')}>
                      <Input
                        placeholder={tr('NOME DO FORNECEDOR')}
                        value={reporForm.fornecedor}
                        onChange={(e) => setReporForm((f) => ({ ...f, fornecedor: e.target.value.toUpperCase() }))}
                      />
                    </FormField>
                  </>
                )}
    
                <div className={itemServico(reporItem) ? undefined : styles.formRow}>
                  {!itemServico(reporItem) && (
                    <FormField label={tr('Valor de Compra (un.) *')}>
                      <Input
                        placeholder={tr('R$ 0,00')}
                        value={reporForm.valor_compra_unidade}
                        onChange={(e) => setReporForm((f) => ({ ...f, valor_compra_unidade: maskBRL(e.target.value) }))}
                      />
                    </FormField>
                  )}
                  <FormField label={itemServico(reporItem) ? tr('Valor cobrado *') : tr('Valor de Venda (un.) *')}>
                    <Input
                      placeholder={tr('R$ 0,00')}
                      value={reporForm.valor_venda_unidade}
                      onChange={(e) => setReporForm((f) => ({ ...f, valor_venda_unidade: maskBRL(e.target.value) }))}
                    />
                  </FormField>
                </div>
              </div>
            )}
          </div>

          <div className={styles.acaoPopFoot}>
            <Button variant="primary" className={[styles.btnSolid, styles.btnPrimary].join(' ')}
              onClick={reporQuarto ? handleReporQuarto : handleRepor} disabled={reporSaving}>
              {reporSaving && <Loader2 size={14} className={styles.spinInline} />}
              {tr('Confirmar Reposição')}
            </Button>
          </div>
        </div>,
        document.body,
      )}

    </div>
  );
}
