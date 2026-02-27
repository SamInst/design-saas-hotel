// ── Simulated network delay ─────────────────────────────────────────────────
const delay = (ms = 220) => new Promise((r) => setTimeout(r, ms));

let _nextId = 200;
const nextId = () => ++_nextId;
const clone  = (v) => JSON.parse(JSON.stringify(v));

// ── Status constants ─────────────────────────────────────────────────────────
export const STATUS = {
  DISPONIVEL:      'Disponível',
  OCUPADO:         'Ocupado',
  RESERVADO:       'Reservado',
  LIMPEZA:         'Limpeza',
  MANUTENCAO:      'Manutenção',
  FORA_DE_SERVICO: 'Fora de Serviço',
};

// ── Room categories ──────────────────────────────────────────────────────────
export const ROOM_CATEGORIES = [
  { id: 1, tipo: 'Standard', descricao: 'Quartos simples e confortáveis para estadias curtas.' },
  { id: 2, tipo: 'Luxo',     descricao: 'Quartos amplos com mais conforto e comodidades.'      },
  { id: 3, tipo: 'Suíte',   descricao: 'Suítes completas com serviços extras.'                 },
];

// ── Tipos de ocupação disponíveis ────────────────────────────────────────────
export const TIPOS_OCUPACAO = ['Individual', 'Casal', 'Duplo', 'Triplo', 'Quádruplo', 'Quíntuplo'];

// ── Item structure per room ──────────────────────────────────────────────────
// { id, nome, quantidadeConfigurada, quantidadeAtual, valorVenda }

// ── Initial room data ────────────────────────────────────────────────────────
let _quartos = [
  {
    id: 1, numero: '01', categoriaId: 1, tipoOcupacao: 'Casal',
    descricao: 'Quarto Standard com cama de casal.',
    camas: { casal: 1, solteiro: 0, beliche: 0, rede: 0 },
    status: STATUS.DISPONIVEL,
    hospede: null, limpeza: null, manutencao: null,
    itens: [
      { id: 11, nome: 'Água Mineral 500ml',  quantidadeConfigurada: 2, quantidadeAtual: 2, valorVenda: 5.00  },
      { id: 12, nome: 'Refrigerante Lata',   quantidadeConfigurada: 2, quantidadeAtual: 2, valorVenda: 8.00  },
      { id: 13, nome: 'Suco de Caixa',       quantidadeConfigurada: 1, quantidadeAtual: 1, valorVenda: 6.50  },
      { id: 14, nome: 'Chocolate Barra',     quantidadeConfigurada: 1, quantidadeAtual: 1, valorVenda: 10.00 },
    ],
  },
  {
    id: 2, numero: '02', categoriaId: 1, tipoOcupacao: 'Duplo',
    descricao: 'Quarto Standard com duas camas de solteiro.',
    camas: { casal: 0, solteiro: 2, beliche: 0, rede: 0 },
    status: STATUS.DISPONIVEL,
    hospede: null, limpeza: null, manutencao: null,
    itens: [
      { id: 21, nome: 'Água Mineral 500ml',  quantidadeConfigurada: 2, quantidadeAtual: 2, valorVenda: 5.00  },
      { id: 22, nome: 'Refrigerante Lata',   quantidadeConfigurada: 2, quantidadeAtual: 2, valorVenda: 8.00  },
      { id: 23, nome: 'Suco de Caixa',       quantidadeConfigurada: 1, quantidadeAtual: 1, valorVenda: 6.50  },
      { id: 24, nome: 'Amendoim Salgado',    quantidadeConfigurada: 2, quantidadeAtual: 2, valorVenda: 7.00  },
    ],
  },
  {
    id: 3, numero: '03', categoriaId: 1, tipoOcupacao: 'Duplo',
    descricao: 'Quarto Standard com beliche e rede adicional.',
    camas: { casal: 0, solteiro: 1, beliche: 1, rede: 1 },
    status: STATUS.OCUPADO,
    hospede: {
      nome: 'João Silva',
      tipo: 'pernoite',
      checkin:  '2026-02-24 14:00',
      checkout: '2026-02-28 12:00',
    },
    limpeza: null, manutencao: null,
    itens: [
      { id: 31, nome: 'Água Mineral 500ml',  quantidadeConfigurada: 2, quantidadeAtual: 1, valorVenda: 5.00  },
      { id: 32, nome: 'Refrigerante Lata',   quantidadeConfigurada: 2, quantidadeAtual: 0, valorVenda: 8.00  },
      { id: 33, nome: 'Suco de Caixa',       quantidadeConfigurada: 1, quantidadeAtual: 1, valorVenda: 6.50  },
      { id: 34, nome: 'Chocolate Barra',     quantidadeConfigurada: 1, quantidadeAtual: 0, valorVenda: 10.00 },
    ],
  },
  {
    id: 4, numero: '04', categoriaId: 1, tipoOcupacao: 'Individual',
    descricao: 'Quarto Standard econômico.',
    camas: { casal: 1, solteiro: 0, beliche: 0, rede: 0 },
    status: STATUS.RESERVADO,
    hospede: {
      nome: 'Maria Santos',
      tipo: 'pernoite',
      checkin:  '2026-02-27 15:00',
      checkout: '2026-03-02 11:00',
    },
    limpeza: null, manutencao: null,
    itens: [
      { id: 41, nome: 'Água Mineral 500ml',  quantidadeConfigurada: 2, quantidadeAtual: 2, valorVenda: 5.00 },
      { id: 42, nome: 'Refrigerante Lata',   quantidadeConfigurada: 2, quantidadeAtual: 2, valorVenda: 8.00 },
    ],
  },
  {
    id: 5, numero: '05', categoriaId: 1, tipoOcupacao: 'Casal',
    descricao: 'Quarto Standard aguardando limpeza.',
    camas: { casal: 1, solteiro: 0, beliche: 0, rede: 0 },
    status: STATUS.LIMPEZA,
    hospede: null, limpeza: { responsavel: 'Ana Paula' }, manutencao: null,
    itens: [
      { id: 51, nome: 'Água Mineral 500ml',  quantidadeConfigurada: 2, quantidadeAtual: 2, valorVenda: 5.00 },
      { id: 52, nome: 'Refrigerante Lata',   quantidadeConfigurada: 2, quantidadeAtual: 2, valorVenda: 8.00 },
      { id: 53, nome: 'Suco de Caixa',       quantidadeConfigurada: 1, quantidadeAtual: 1, valorVenda: 6.50 },
    ],
  },
  {
    id: 6, numero: '06', categoriaId: 2, tipoOcupacao: 'Casal',
    descricao: 'Quarto Luxo com varanda e cama king.',
    camas: { casal: 1, solteiro: 0, beliche: 0, rede: 0 },
    status: STATUS.OCUPADO,
    hospede: {
      nome: 'Carlos Mendes',
      tipo: 'dayuse',
      checkin:  '2026-02-26 09:30',
      checkout: null,
    },
    limpeza: null, manutencao: null,
    itens: [
      { id: 61, nome: 'Água Mineral 500ml',  quantidadeConfigurada: 4, quantidadeAtual: 3, valorVenda: 5.00  },
      { id: 62, nome: 'Refrigerante Lata',   quantidadeConfigurada: 4, quantidadeAtual: 4, valorVenda: 8.00  },
      { id: 63, nome: 'Cerveja Long Neck',   quantidadeConfigurada: 4, quantidadeAtual: 2, valorVenda: 12.00 },
      { id: 64, nome: 'Suco Natural 300ml',  quantidadeConfigurada: 2, quantidadeAtual: 2, valorVenda: 14.00 },
      { id: 65, nome: 'Chocolate Importado', quantidadeConfigurada: 2, quantidadeAtual: 2, valorVenda: 22.00 },
      { id: 66, nome: 'Amendoim Salgado',    quantidadeConfigurada: 2, quantidadeAtual: 1, valorVenda: 7.00  },
    ],
  },
  {
    id: 7, numero: '07', categoriaId: 2, tipoOcupacao: 'Triplo',
    descricao: 'Quarto Luxo com hidromassagem e vista.',
    camas: { casal: 1, solteiro: 0, beliche: 0, rede: 1 },
    status: STATUS.DISPONIVEL,
    hospede: null, limpeza: null, manutencao: null,
    itens: [
      { id: 71, nome: 'Água Mineral 500ml',  quantidadeConfigurada: 4, quantidadeAtual: 4, valorVenda: 5.00  },
      { id: 72, nome: 'Refrigerante Lata',   quantidadeConfigurada: 4, quantidadeAtual: 4, valorVenda: 8.00  },
      { id: 73, nome: 'Cerveja Long Neck',   quantidadeConfigurada: 4, quantidadeAtual: 4, valorVenda: 12.00 },
      { id: 74, nome: 'Suco Natural 300ml',  quantidadeConfigurada: 2, quantidadeAtual: 2, valorVenda: 14.00 },
      { id: 75, nome: 'Chocolate Importado', quantidadeConfigurada: 2, quantidadeAtual: 2, valorVenda: 22.00 },
      { id: 76, nome: 'Amendoim Salgado',    quantidadeConfigurada: 2, quantidadeAtual: 2, valorVenda: 7.00  },
    ],
  },
  {
    id: 8, numero: '08', categoriaId: 2, tipoOcupacao: 'Casal',
    descricao: 'Quarto Luxo em manutenção elétrica.',
    camas: { casal: 1, solteiro: 0, beliche: 0, rede: 0 },
    status: STATUS.MANUTENCAO,
    hospede: null, limpeza: null,
    manutencao: { responsavel: 'Carlos Oliveira', descricao: 'Reparo no sistema elétrico e tomadas.', previsaoFim: '2026-02-28' },
    itens: [
      { id: 81, nome: 'Água Mineral 500ml',  quantidadeConfigurada: 4, quantidadeAtual: 4, valorVenda: 5.00  },
      { id: 82, nome: 'Cerveja Long Neck',   quantidadeConfigurada: 4, quantidadeAtual: 4, valorVenda: 12.00 },
      { id: 83, nome: 'Chocolate Importado', quantidadeConfigurada: 2, quantidadeAtual: 2, valorVenda: 22.00 },
    ],
  },
  {
    id: 9, numero: '09', categoriaId: 3, tipoOcupacao: 'Quádruplo',
    descricao: 'Suíte Master com sala de estar.',
    camas: { casal: 1, solteiro: 2, beliche: 0, rede: 0 },
    status: STATUS.DISPONIVEL,
    hospede: null, limpeza: null, manutencao: null,
    itens: [
      { id: 91, nome: 'Água Mineral 500ml',  quantidadeConfigurada: 6, quantidadeAtual: 6, valorVenda: 5.00  },
      { id: 92, nome: 'Refrigerante Lata',   quantidadeConfigurada: 4, quantidadeAtual: 4, valorVenda: 8.00  },
      { id: 93, nome: 'Cerveja Long Neck',   quantidadeConfigurada: 6, quantidadeAtual: 6, valorVenda: 12.00 },
      { id: 94, nome: 'Vinho Tinto 375ml',   quantidadeConfigurada: 2, quantidadeAtual: 2, valorVenda: 55.00 },
      { id: 95, nome: 'Suco Natural 300ml',  quantidadeConfigurada: 4, quantidadeAtual: 4, valorVenda: 14.00 },
      { id: 96, nome: 'Chocolate Importado', quantidadeConfigurada: 4, quantidadeAtual: 4, valorVenda: 22.00 },
      { id: 97, nome: 'Castanha de Caju',    quantidadeConfigurada: 2, quantidadeAtual: 2, valorVenda: 18.00 },
    ],
  },
  {
    id: 10, numero: '10', categoriaId: 3, tipoOcupacao: 'Triplo',
    descricao: 'Suíte em reforma geral do banheiro.',
    camas: { casal: 1, solteiro: 0, beliche: 0, rede: 0 },
    status: STATUS.FORA_DE_SERVICO,
    hospede: null, limpeza: null,
    manutencao: { responsavel: 'Equipe Técnica', descricao: 'Reforma geral do banheiro e troca de azulejos.', previsaoFim: '2026-03-15' },
    itens: [
      { id: 101, nome: 'Água Mineral 500ml',  quantidadeConfigurada: 6, quantidadeAtual: 6, valorVenda: 5.00  },
      { id: 102, nome: 'Refrigerante Lata',   quantidadeConfigurada: 4, quantidadeAtual: 4, valorVenda: 8.00  },
      { id: 103, nome: 'Cerveja Long Neck',   quantidadeConfigurada: 6, quantidadeAtual: 6, valorVenda: 12.00 },
      { id: 104, nome: 'Vinho Tinto 375ml',   quantidadeConfigurada: 2, quantidadeAtual: 2, valorVenda: 55.00 },
      { id: 105, nome: 'Suco Natural 300ml',  quantidadeConfigurada: 4, quantidadeAtual: 4, valorVenda: 14.00 },
      { id: 106, nome: 'Chocolate Importado', quantidadeConfigurada: 4, quantidadeAtual: 4, valorVenda: 22.00 },
    ],
  },
];

// ── Simulated API ────────────────────────────────────────────────────────────
export const quartoApi = {
  async listar() {
    await delay(260);
    return clone(_quartos);
  },

  async criar(data) {
    await delay(320);
    const item = {
      id: nextId(),
      status: STATUS.DISPONIVEL,
      hospede: null, limpeza: null, manutencao: null,
      itens: [],
      ...data,
    };
    _quartos.push(item);
    return clone(item);
  },

  async atualizar(id, data) {
    await delay(320);
    const idx = _quartos.findIndex((q) => q.id === id);
    if (idx === -1) throw new Error('Quarto não encontrado');
    _quartos[idx] = { ..._quartos[idx], ...data };
    return clone(_quartos[idx]);
  },

  async excluir(id) {
    await delay(200);
    _quartos = _quartos.filter((q) => q.id !== id);
  },

  async alterarStatus(id, novoStatus, extra = {}) {
    await delay(260);
    const idx = _quartos.findIndex((q) => q.id === id);
    if (idx === -1) throw new Error('Quarto não encontrado');
    const q = { ..._quartos[idx], status: novoStatus };

    if (novoStatus === STATUS.LIMPEZA) {
      q.limpeza    = { responsavel: extra.responsavel || '' };
      q.manutencao = null;
    } else if ([STATUS.MANUTENCAO, STATUS.FORA_DE_SERVICO].includes(novoStatus)) {
      q.manutencao = {
        responsavel: extra.responsavel || '',
        descricao:   extra.descricao   || '',
        previsaoFim: extra.previsaoFim || '',
      };
      q.limpeza = null;
    } else if (novoStatus === STATUS.DISPONIVEL) {
      q.limpeza    = null;
      q.manutencao = null;
      q.hospede    = null;
    }

    _quartos[idx] = q;
    return clone(q);
  },

  async consumirItem(quartoId, itemId, quantidade) {
    await delay(220);
    const q = _quartos.find((r) => r.id === quartoId);
    if (!q) throw new Error('Quarto não encontrado');
    const item = (q.itens || []).find((i) => i.id === itemId);
    if (!item) throw new Error('Item não encontrado');
    if (quantidade > item.quantidadeAtual) throw new Error('Quantidade insuficiente');
    item.quantidadeAtual = Math.max(0, item.quantidadeAtual - quantidade);
    return clone(q);
  },

  async reporItem(quartoId, itemId) {
    await delay(220);
    const q = _quartos.find((r) => r.id === quartoId);
    if (!q) throw new Error('Quarto não encontrado');
    const item = (q.itens || []).find((i) => i.id === itemId);
    if (!item) throw new Error('Item não encontrado');
    item.quantidadeAtual = item.quantidadeConfigurada;
    return clone(q);
  },
};
