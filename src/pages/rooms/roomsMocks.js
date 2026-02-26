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

// ── Initial room data ────────────────────────────────────────────────────────
// hospede.tipo: 'pernoite' | 'dayuse'
let _quartos = [
  {
    id: 1, numero: '01', categoriaId: 1, tipoOcupacao: 'Casal',
    descricao: 'Quarto Standard com cama de casal.',
    camas: { casal: 1, solteiro: 0, beliche: 0, rede: 0 },
    status: STATUS.DISPONIVEL,
    hospede: null, limpeza: null, manutencao: null,
  },
  {
    id: 2, numero: '02', categoriaId: 1, tipoOcupacao: 'Duplo',
    descricao: 'Quarto Standard com duas camas de solteiro.',
    camas: { casal: 0, solteiro: 2, beliche: 0, rede: 0 },
    status: STATUS.DISPONIVEL,
    hospede: null, limpeza: null, manutencao: null,
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
  },
  {
    id: 5, numero: '05', categoriaId: 1, tipoOcupacao: 'Casal',
    descricao: 'Quarto Standard aguardando limpeza.',
    camas: { casal: 1, solteiro: 0, beliche: 0, rede: 0 },
    status: STATUS.LIMPEZA,
    hospede: null, limpeza: { responsavel: 'Ana Paula' }, manutencao: null,
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
  },
  {
    id: 7, numero: '07', categoriaId: 2, tipoOcupacao: 'Triplo',
    descricao: 'Quarto Luxo com hidromassagem e vista.',
    camas: { casal: 1, solteiro: 0, beliche: 0, rede: 1 },
    status: STATUS.DISPONIVEL,
    hospede: null, limpeza: null, manutencao: null,
  },
  {
    id: 8, numero: '08', categoriaId: 2, tipoOcupacao: 'Casal',
    descricao: 'Quarto Luxo em manutenção elétrica.',
    camas: { casal: 1, solteiro: 0, beliche: 0, rede: 0 },
    status: STATUS.MANUTENCAO,
    hospede: null, limpeza: null,
    manutencao: { responsavel: 'Carlos Oliveira', descricao: 'Reparo no sistema elétrico e tomadas.', previsaoFim: '2026-02-28' },
  },
  {
    id: 9, numero: '09', categoriaId: 3, tipoOcupacao: 'Quádruplo',
    descricao: 'Suíte Master com sala de estar.',
    camas: { casal: 1, solteiro: 2, beliche: 0, rede: 0 },
    status: STATUS.DISPONIVEL,
    hospede: null, limpeza: null, manutencao: null,
  },
  {
    id: 10, numero: '10', categoriaId: 3, tipoOcupacao: 'Triplo',
    descricao: 'Suíte em reforma geral do banheiro.',
    camas: { casal: 1, solteiro: 0, beliche: 0, rede: 0 },
    status: STATUS.FORA_DE_SERVICO,
    hospede: null, limpeza: null,
    manutencao: { responsavel: 'Equipe Técnica', descricao: 'Reforma geral do banheiro e troca de azulejos.', previsaoFim: '2026-03-15' },
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
};
