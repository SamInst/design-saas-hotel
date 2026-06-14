import { recepcaoApi } from '../../../services/api';

// helpers for local (day-use / minibar) cache mutations
const _clone  = (v) => JSON.parse(JSON.stringify(v));
let   _nextId = 9000;
const _genId  = () => ++_nextId;

// ── Room status ───────────────────────────────────────────────────────────────
export const ROOM_STATUS = {
  DISPONIVEL:      'Disponível',
  OCUPADO:         'Ocupado',
  RESERVADO:       'Reservado',
  LIMPEZA:         'Limpeza',
  MANUTENCAO:      'Manutenção',
  FORA_DE_SERVICO: 'Fora de Serviço',
};

// ── Service status ────────────────────────────────────────────────────────────
export const PERNOITE_STATUS = {
  ATIVO:               'ATIVO',
  DIARIA_ENCERRADA:    'DIÁRIA ENCERRADA',
  FINALIZADO:          'FINALIZADO',
  CANCELADO:           'CANCELADO',
  FINALIZADO_PENDENTE: 'FINALIZADO - PAGAMENTO PENDENTE',
};

export const DAYUSE_STATUS = {
  ATIVO:               'ATIVO',
  ENCERRADO:           'ENCERRADO',
  FINALIZADO:          'FINALIZADO',
  CANCELADO:           'CANCELADO',
  FINALIZADO_PENDENTE: 'FINALIZADO - PAGAMENTO PENDENTE',
};

// ── Categories & options ──────────────────────────────────────────────────────
export const OVERVIEW_CATEGORIES = [
  { id: 1, nome: 'Standard', descricao: 'Quartos simples e confortáveis para estadias curtas.' },
  { id: 2, nome: 'Luxo',     descricao: 'Quartos amplos com mais conforto e comodidades.'      },
  { id: 3, nome: 'Suíte',   descricao: 'Suítes completas com serviços extras.'                 },
];

export const TIPOS_OCUPACAO = ['Individual', 'Casal', 'Duplo', 'Triplo', 'Quádruplo', 'Quíntuplo'];

export const FORMAS_PAGAMENTO = [
  'Dinheiro', 'PIX', 'Cartão de Crédito', 'Cartão de Débito', 'Transferência Bancária',
];

export const HOSPEDES_CADASTRADOS = [
  { id: 1, nome: 'João Silva',     cpf: '123.456.789-00', telefone: '(98) 99999-9999', email: 'joao.silva@email.com'     },
  { id: 2, nome: 'Maria Silva',    cpf: '987.654.321-00', telefone: '(98) 98888-8888', email: 'maria.silva@email.com'    },
  { id: 3, nome: 'Ana Costa',      cpf: '111.222.333-44', telefone: '(98) 97777-7777', email: 'ana.costa@email.com'      },
  { id: 4, nome: 'Carlos Mendes',  cpf: '555.666.777-88', telefone: '(98) 96666-6666', email: 'carlos.mendes@email.com'  },
  { id: 5, nome: 'Fernanda Souza', cpf: '999.888.777-66', telefone: '(98) 95555-5555', email: 'fernanda.souza@email.com' },
  { id: 6, nome: 'Roberto Lima',   cpf: '444.333.222-11', telefone: '(98) 94444-4444', email: 'roberto.lima@email.com'   },
  { id: 7, nome: 'Patrícia Gomes', cpf: '777.888.999-00', telefone: '(98) 93333-3333', email: 'patricia.gomes@email.com' },
  { id: 8, nome: 'Pedro Oliveira', cpf: '333.222.111-00', telefone: '(98) 92222-2222', email: 'pedro.oliveira@email.com' },
];

// ── Pricing per category ──────────────────────────────────────────────────────
export const DAY_USE_PRICING = {
  'Standard': { horasBase: 2, precoBase: 90,  precoAdicional: 15 },
  'Luxo':     { horasBase: 2, precoBase: 150, precoAdicional: 25 },
  'Suíte':    { horasBase: 2, precoBase: 200, precoAdicional: 40 },
};

export const STAY_PRICING = {
  'Standard': { modeloCobranca: 'Por ocupação', precosOcupacao: { 1: 120, 2: 160, 3: 190, 4: 210, 5: 230 } },
  'Luxo':     { modeloCobranca: 'Por ocupação', precosOcupacao: { 1: 220, 2: 280, 3: 320, 4: 360, 5: 400 } },
  'Suíte':    { modeloCobranca: 'Por quarto (tarifa fixa)', precoFixo: 450 },
};

// ── Helpers ────────────────────────────────────────────────────────────────────
export function calcPrecoDiaria(categoria, numPessoas) {
  const pricing = STAY_PRICING[categoria];
  if (!pricing) return 0;
  if (pricing.modeloCobranca === 'Por quarto (tarifa fixa)') return pricing.precoFixo;
  const n = Math.max(1, Math.min(5, numPessoas));
  return pricing.precosOcupacao[n] || 0;
}

export function diffDays(d1, d2) {
  if (!d1 || !d2) return 0;
  const ms = d2 - d1;
  return Math.max(0, Math.round(ms / (1000 * 60 * 60 * 24)));
}

export const CATEGORIAS_CONSUMO = [
  { id: 1, nome: 'Bebidas',     produtos: [
    { id: 101, nome: 'Água Mineral',       preco: 4  },
    { id: 102, nome: 'Cerveja Heineken',   preco: 12 },
    { id: 103, nome: 'Refrigerante',       preco: 8  },
    { id: 104, nome: 'Suco Natural',       preco: 10 },
    { id: 105, nome: 'Vinho Tinto 375ml',  preco: 80 },
  ]},
  { id: 2, nome: 'Alimentação', produtos: [
    { id: 201, nome: 'Hambúrguer',         preco: 35 },
    { id: 202, nome: 'Pizza média',        preco: 45 },
    { id: 203, nome: 'Salada Caesar',      preco: 28 },
    { id: 204, nome: 'Prato do dia',       preco: 32 },
  ]},
  { id: 3, nome: 'Serviços',    produtos: [
    { id: 301, nome: 'Frigobar',           preco: 15 },
    { id: 302, nome: 'Lavanderia',         preco: 25 },
    { id: 303, nome: 'Estacionamento',     preco: 20 },
  ]},
];

export const OVERVIEW_ROOMS_CATS = [
  { nome: 'Standard', quartos: ['01','02','03','04','05','06','07','08','09','10'] },
  { nome: 'Luxo',     quartos: ['11','12','13','14','15','16'] },
  { nome: 'Suíte',    quartos: ['17','18','19','20','21','22'] },
];

// ── Normalizers ───────────────────────────────────────────────────────────────
const _STATUS_MAP = {
  DISPONIVEL:      ROOM_STATUS.DISPONIVEL,
  OCUPADO:         ROOM_STATUS.OCUPADO,
  LIMPEZA:         ROOM_STATUS.LIMPEZA,
  EM_LIMPEZA:      ROOM_STATUS.LIMPEZA,
  MANUTENCAO:      ROOM_STATUS.MANUTENCAO,
  FORA_DE_SERVICO: ROOM_STATUS.FORA_DE_SERVICO,
  RESERVADO:       ROOM_STATUS.RESERVADO,
};

// Hospedagem.Status (backend) → { tipo de serviço, status curto usado na UI }
function _mapServicoStatus(s) {
  switch (s) {
    case 'PERNOITE_ATIVO':                         return { tipo: 'pernoite', status: PERNOITE_STATUS.ATIVO };
    case 'PERNOITE_FINALIZADO':                    return { tipo: 'pernoite', status: PERNOITE_STATUS.FINALIZADO };
    case 'PERNOITE_FINALIZADO_PAGAMENTO_PENDENTE': return { tipo: 'pernoite', status: PERNOITE_STATUS.FINALIZADO_PENDENTE };
    case 'PERNOITE_CANCELADO':                     return { tipo: 'pernoite', status: PERNOITE_STATUS.CANCELADO };
    case 'DAY_USE_ATIVO':
    case 'DAY_USE_SOLICITADO':                     return { tipo: 'dayuse',   status: DAYUSE_STATUS.ATIVO };
    case 'DAY_USE_FINALIZADO':                     return { tipo: 'dayuse',   status: DAYUSE_STATUS.FINALIZADO };
    case 'DAY_USE_FINALIZADO_PAGAMENTO_PENDENTE':  return { tipo: 'dayuse',   status: DAYUSE_STATUS.FINALIZADO_PENDENTE };
    case 'DAY_USE_CANCELADO':                      return { tipo: 'dayuse',   status: DAYUSE_STATUS.CANCELADO };
    case 'RESERVA_ATIVA':                          return { tipo: 'reserva',  status: 'RESERVA_ATIVA' };
    case 'RESERVA_SOLICITADA':                     return { tipo: 'reserva',  status: 'RESERVA_SOLICITADA' };
    default:                                       return { tipo: null,       status: s ?? '' };
  }
}

function _normalizePessoa(p) {
  // API may wrap person under p.pessoa (reserva shape) or be flat (pernoite shape)
  const core = p.pessoa ?? p;
  return {
    id:       core.id,
    nome:     core.nome      ?? '',
    cpf:      core.cpf       ?? '',
    telefone: core.telefone  ?? '',
    email:    core.email     ?? '',
    titular:  core.titular   ?? p.representante ?? false,
  };
}

function _normalizeConsumo(c) {
  const qty  = c.quantidade ?? 1;
  const unit = c.valor ?? c.valor_unitario ?? c.valorUnitario ?? 0;
  const itemNome = typeof c.item === 'object' ? (c.item?.descricao ?? '') : (c.descricao ?? c.item ?? '');
  const pag = c.pagamento ?? null;
  return {
    id: c.id,
    categoria: c.categoria ?? '',
    item: itemNome,
    quantidade: qty,
    valorUnitario: unit,
    valorTotal: c.valor_total ?? (unit * qty),
    despesaPessoal: c.despesa_pessoal ?? false,
    cancelado: c.cancelado ?? false,
    pagamento: pag ? {
      nomePagador:   pag.nome_pagador ?? '',
      formaPagamento: pag.tipo_pagamento?.descricao ?? '',
      valor:         pag.valor ?? 0,
      data:          pag.data_hora_registro ?? '',
    } : null,
  };
}

function _normalizePagamento(p) {
  return {
    id:              p.uuid ?? p.id,
    nomePagador:     p.nome_pagador ?? '',
    descricao:       p.nome_pagador ?? p.descricao ?? '', // kept for backward compat displays
    descricaoOrig:   p.descricao ?? '',
    formaPagamento:  p.tipo_pagamento?.descricao ?? p.formaPagamento ?? '',
    tipoPagamentoId: p.tipo_pagamento?.id ?? null,
    valor:           p.valor ?? 0,
    data:            p.data_hora_registro ?? p.data ?? '',
    cancelado:       p.cancelado ?? false,
  };
}

function _normalizeDiaria(d) {
  return {
    id: d.id,
    idx: (d.numero ?? 1) - 1,
    num: d.numero ?? 1,
    // Hospedagem.Diaria usa checkin/checkout; mantém fallback ao formato antigo
    dataInicio: d.checkin ?? d.data_hora_inicio ?? '',
    dataFim:    d.checkout ?? d.data_hora_fim ?? '',
    valor: d.valor ?? 0,
    hospedes: (d.pessoas ?? []).map(_normalizePessoa),
    consumos: (d.consumos ?? []).map(c => ({ ..._normalizeConsumo(c), diariaId: d.id })),
    pagamentos: [],
  };
}

// h: Hospedagem completa (status PERNOITE_/DAY_USE_/RESERVA_…); q: Quarto (p/ tipo de acomodação)
function _normalizeServico(h, q) {
  if (!h) return null;
  const { tipo, status } = _mapServicoStatus(h.status);

  const diarias    = (h.diarias    ?? []).map(_normalizeDiaria);
  const pagamentos = (h.pagamentos ?? []).map(_normalizePagamento);
  // Consumos agora vêm no nível da hospedagem (não mais aninhados por diária)
  const consumos   = (h.consumos   ?? []).map(_normalizeConsumo);
  const pessoas    = (h.pessoas     ?? []).map(_normalizePessoa);

  const totalPago  = pagamentos.filter(p => !p.cancelado).reduce((s, p) => s + p.valor, 0);
  const consumoSum = consumos.filter(c => !c.cancelado).reduce((s, c) => s + (c.valorTotal ?? 0), 0);
  const valorTotal = (h.valor_total ?? 0) + consumoSum;
  const titular    = pessoas.find(p => p.titular) ?? pessoas[0];

  const checkin  = h.data_hora_checkin  ?? '';
  const checkout = h.data_hora_checkout ?? '';

  return {
    tipo,
    id: h.id,
    titularNome: titular?.nome ?? null,
    tipoAcomodacao: q?.descricao ?? '',
    periodo: `${checkin} - ${checkout}`,
    chegadaPrevista: checkin,
    saidaPrevista:   checkout,
    status,
    statusBackend: h.status ?? '',
    totalDiarias: h.quantidade_diarias ?? diarias.length,
    diariaAtual:  h.numero_diaria_atual ?? 0,
    valorTotal,
    totalPago,
    pagamentoPendente: Math.max(0, valorTotal - totalPago),
    observacao: h.observacao ?? '',
    grupoId: h.grupo_id ?? null,
    novoPreco: h.novo_preco ?? null,
    motivoCancelamento: h.motivo_cancelamento ?? null,
    pessoasOrcamento: h.pessoas_orcamento ?? [],
    hospedes: pessoas,
    consumos,
    pagamentos,
    diarias,
  };
}

// API shape: { data, categorias: [{ id, nome, descricao, quartos: [{ quarto, hospedagem }] }] }
function _normalizeHospedagem(item, cat) {
  const q = item.quarto;
  const h = item.hospedagem ?? null;

  const servico = _normalizeServico(h, q);

  const lm = q.quarto_limpeza;
  const limpeza = lm ? {
    id: lm.id,
    responsavel: lm.nome_responsavel ?? lm.responsavel ?? lm.funcionario?.nome ?? '',
    inicio: lm.data_hora_inicio ?? '',
  } : null;

  const mn = q.quarto_manutencao;
  const manutencao = mn ? {
    id: mn.id,
    responsavel: mn.nome_responsavel ?? mn.responsavel ?? mn.funcionario?.nome ?? '',
    descricao: mn.descricao ?? '',
    previsaoFim: mn.data_hora_fim ?? mn.previsao_fim ?? '',
  } : null;

  return {
    id: q.id,
    numero: String(q.id).padStart(2, '0'),
    categoriaId: cat.id,
    categoria: cat.nome,
    categoriaDescricao: cat.descricao ?? '',
    tipoOcupacao: q.descricao ?? '',
    descricao: q.descricao ?? '',
    camas: {
      casal:    q.quantidade_cama_casal     ?? 0,
      solteiro: q.quantidade_cama_solteiro  ?? 0,
      beliche:  q.quantidade_beliche        ?? 0,
      rede:     q.quantidade_rede           ?? 0,
    },
    status: (() => {
      if (servico?.tipo === 'pernoite' || servico?.tipo === 'dayuse') return ROOM_STATUS.OCUPADO;
      if (servico?.tipo === 'reserva')                                return ROOM_STATUS.RESERVADO;
      if (q.quarto_limpeza)                                           return ROOM_STATUS.LIMPEZA;
      if (q.quarto_manutencao)                                        return ROOM_STATUS.MANUTENCAO;
      return _STATUS_MAP[q.status] ?? ROOM_STATUS.DISPONIVEL;
    })(),
    servico,
    limpeza,
    manutencao,
    itens: (q.quarto_itens ?? []).map(i => ({ nome: i.item?.descricao ?? '', qtd: i.quantidade_atual ?? 0 })),
    minibar: (q.quarto_itens ?? []).map(i => ({
      quartoItemId: i.id,
      produtoId:    i.item?.id,
      nome:         i.item?.descricao ?? '',
      qtdBase:      i.quantidade_padrao    ?? 0,
      qtdAtual:     i.quantidade_atual     ?? 0,
      qtdTotal:     i.qtd_total_unidades   ?? null,
      preco:        i.preco ?? 0,
    })),
  };
}

// ── Cache ─────────────────────────────────────────────────────────────────────
let _cache = [];

async function _reload() {
  const data = await recepcaoApi.listar();
  const rooms = [];
  for (const cat of (data?.categorias ?? [])) {
    for (const item of (cat.quartos ?? [])) {
      rooms.push(_normalizeHospedagem(item, cat));
    }
  }
  _cache = rooms;
  return _cache;
}

function _find(id) { return _cache.find(q => q.id === id) ?? null; }

function _patchCache(id, updater) {
  const idx = _cache.findIndex(q => q.id === id);
  if (idx >= 0) _cache[idx] = updater(_clone(_cache[idx]));
  return _find(id);
}

// ── Real API ──────────────────────────────────────────────────────────────────
export const overviewApi = {
  async listar() {
    return _reload();
  },

  async finalizarLimpeza(quartoId) {
    const room = _find(quartoId);
    if (room?.limpeza?.id) await recepcaoApi.finalizarLimpeza(room.limpeza.id);
    await _reload();
    return _find(quartoId);
  },

  async finalizarManutencao(quartoId) {
    const room = _find(quartoId);
    if (room?.manutencao?.id) await recepcaoApi.finalizarManutencao(room.manutencao.id);
    await _reload();
    return _find(quartoId);
  },

  async marcarDisponivel(id) {
    const room = _find(id);
    if (room?.limpeza?.id)       await recepcaoApi.finalizarLimpeza(room.limpeza.id);
    else if (room?.manutencao?.id) await recepcaoApi.finalizarManutencao(room.manutencao.id);
    else                           await recepcaoApi.alterarStatusQuarto(id, 'DISPONIVEL');
    await _reload();
    return _find(id);
  },

  async marcarLimpeza(id, data = {}) {
    await recepcaoApi.acionarLimpeza(id, {
      funcionario:      data.funcId ? { id: data.funcId } : undefined,
      data_hora_inicio: data.dataHoraInicio || undefined,
      data_hora_fim:    data.dataHoraFim    || undefined,
    });
    await _reload();
    return _find(id);
  },

  async marcarManutencao(id, data = {}) {
    await recepcaoApi.criarManutencao({
      quarto:           { id },
      nome_responsavel: data.responsavel || undefined,
      descricao:        data.descricao   || undefined,
      data_hora_inicio: data.dataHoraInicio || undefined,
      data_hora_fim:    data.dataHoraFim    || undefined,
    });
    await _reload();
    return _find(id);
  },

  async marcarForaDeServico(id) {
    await recepcaoApi.alterarStatusQuarto(id, 'FORA_DE_SERVICO');
    await _reload();
    return _find(id);
  },

  async criarPernoite(id, servicoData) {
    const checkIn  = (servicoData.chegadaPrevista ?? '').split(' ')[0];
    const checkOut = (servicoData.saidaPrevista   ?? '').split(' ')[0];
    const pessoas  = (servicoData.hospedes ?? []).map(h => h.id).filter(Boolean);
    const pernoite = await recepcaoApi.criarPernoite({ quarto_id: id, data_entrada: checkIn, data_saida: checkOut, pessoas });
    const pagamentos = (servicoData.pagamentos ?? []).map(p => ({
      tipo_pagamento: { id: p.tipoPagamentoId },
      nome_pagador:   p.nomePagador,
      descricao:      p.descricao || undefined,
      valor:          p.valor,
    }));
    if (pagamentos.length && pernoite?.id) {
      await recepcaoApi.adicionarPagamentos(pernoite.id, pagamentos);
    }
    await _reload();
    return _find(id);
  },

  // Day use – not yet in documented API; mutate local cache only
  async criarDayUse(id, servicoData) {
    return _patchCache(id, (q) => ({
      ...q,
      status: ROOM_STATUS.OCUPADO,
      servico: { ...servicoData, tipo: 'dayuse', id: _genId() },
    }));
  },

  async encerrarDayUse(id, { horaSaida, valorTotal, pagamentoPendente }) {
    return _patchCache(id, (q) => ({
      ...q,
      servico: q.servico ? { ...q.servico, horaSaida, valorTotal, pagamentoPendente, status: DAYUSE_STATUS.ENCERRADO } : q.servico,
    }));
  },

  async finalizarServico(id, status = 'FINALIZADO') {
    const pernoiteId = _find(id)?.servico?.id;
    if (pernoiteId) await recepcaoApi.alterarStatusPernoite(pernoiteId, status);
    await _reload();
    return _find(id);
  },

  async cancelarServico(id) {
    const pernoiteId = _find(id)?.servico?.id;
    if (pernoiteId) await recepcaoApi.alterarStatusPernoite(pernoiteId, 'CANCELADO');
    await _reload();
    return _find(id);
  },

  async adicionarPagamento(id, pag) {
    const room = _find(id);
    const pernoiteId = room?.servico?.id;
    const isPernoite = room?.servico?.tipo === 'pernoite' || room?.servico?.tipo === 'reserva';

    if (pernoiteId && isPernoite) {
      await recepcaoApi.adicionarPagamentos(pernoiteId, [{
        tipo_pagamento: { id: pag.tipoPagamentoId },
        nome_pagador:   pag.nomePagador || '',
        descricao:      pag.descricao   || undefined,
        valor:          pag.valor,
      }]);
      await _reload();
      return _find(id);
    }

    // Day use – local cache
    return _patchCache(id, (q) => {
      if (!q.servico) return q;
      const novoPago = (q.servico.totalPago ?? 0) + pag.valor;
      return {
        ...q,
        servico: {
          ...q.servico,
          totalPago: novoPago,
          pagamentoPendente: Math.max(0, (q.servico.valorTotal ?? 0) - novoPago),
          pagamentos: [...(q.servico.pagamentos ?? []), { ...pag, id: _genId() }],
        },
      };
    });
  },

  // Ajuste manual de preço ("Gerenciar Preços"). body já calculado no front-end.
  async gerenciarPreco(quartoId, body) {
    const hospedagemId = _find(quartoId)?.servico?.id;
    if (hospedagemId) await recepcaoApi.gerenciarPreco(hospedagemId, body);
    await _reload();
    return _find(quartoId);
  },

  async adicionarDiaria(id) {
    // Not yet implemented via dedicated endpoint; reload to refresh state
    await _reload();
    return _find(id);
  },

  async removerDiaria(id) {
    await _reload();
    return _find(id);
  },

  async trocarQuarto(id, novoQuartoId, diariasIdxs = []) {
    const room    = _find(id);
    const diarias = room?.servico?.diarias ?? [];
    const targets = diariasIdxs.length
      ? diarias.filter(d => diariasIdxs.includes(d.idx))
      : diarias;
    await Promise.all(targets.map(d => recepcaoApi.trocarQuartoDiaria(d.id, novoQuartoId)));
    await _reload();
    return _find(id);
  },

  async adicionarConsumo(id, consumo) {
    const room       = _find(id);
    const diarias    = room?.servico?.diarias ?? [];
    const diariaAtual = room?.servico?.diariaAtual ?? 0;
    const diaria     = diarias.find(d => d.num === diariaAtual) ?? diarias[diarias.length - 1];

    if (diaria?.id && consumo.produtoId) {
      await recepcaoApi.adicionarConsumos(diaria.id, [{ fk_item: consumo.produtoId, quantidade: consumo.quantidade ?? 1 }]);
      await _reload();
      return _find(id);
    }

    // Local cache fallback (day use or items without API item ID)
    return _patchCache(id, (q) => {
      if (!q.servico) return q;
      return {
        ...q,
        servico: {
          ...q.servico,
          consumos: [...(q.servico.consumos ?? []), { ...consumo, id: _genId() }],
        },
      };
    });
  },

  // Minibar – no dedicated API; local cache mutations
  async updateMinibarItem(id, produtoId, delta) {
    return _patchCache(id, (q) => ({
      ...q,
      minibar: (q.minibar ?? []).map(item =>
        item.produtoId !== produtoId ? item : { ...item, qtdAtual: Math.max(0, item.qtdAtual + delta) }
      ),
    }));
  },

  async reporMinibar(id) {
    return _patchCache(id, (q) => ({
      ...q,
      minibar: (q.minibar ?? []).map(item => ({ ...item, qtdAtual: item.qtdBase })),
    }));
  },

  async cancelarPagamento(quartoId, pagUuid) {
    await recepcaoApi.cancelarPagamento(pagUuid, 'Cancelado pela recepção');
    await _reload();
    return _find(quartoId);
  },

  async removerConsumo(quartoId, consumoId) {
    const room    = _find(quartoId);
    const diarias = room?.servico?.diarias ?? [];
    // Consumos vêm no nível da hospedagem (sem vínculo de diária no payload);
    // tenta localizar pela diária, senão usa a diária atual / última como alvo do endpoint.
    const diaria  = diarias.find(d => d.consumos.some(c => c.id === consumoId))
      ?? diarias.find(d => d.num === room?.servico?.diariaAtual)
      ?? diarias[diarias.length - 1];
    if (diaria?.id && consumoId) {
      await recepcaoApi.removerConsumo(diaria.id, consumoId);
    }
    await _reload();
    return _find(quartoId);
  },

  async adicionarPessoaDiaria(quartoId, diariaId, pessoaId) {
    await recepcaoApi.adicionarPessoas(diariaId, [pessoaId]);
    await _reload();
    return _find(quartoId);
  },

  async removerPessoaDiaria(quartoId, diariaId, pessoaId) {
    await recepcaoApi.removerPessoa(diariaId, pessoaId);
    await _reload();
    return _find(quartoId);
  },

  async adicionarMinibarItem(id, item) {
    return _patchCache(id, (q) => {
      const minibar = _clone(q.minibar ?? []);
      const existing = minibar.find(m => m.produtoId === item.produtoId);
      if (existing) { existing.qtdAtual += item.quantidade; existing.qtdBase += item.quantidade; }
      else minibar.push({ produtoId: item.produtoId, nome: item.nome, qtdBase: item.quantidade, qtdAtual: item.quantidade });
      return { ...q, minibar };
    });
  },
};
