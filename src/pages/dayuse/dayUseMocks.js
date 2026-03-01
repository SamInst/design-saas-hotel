// ── Simulated network delay ─────────────────────────────────────────────────
const delay = (ms = 220) => new Promise((r) => setTimeout(r, ms));

let _nextId = 600;
const nextId = () => ++_nextId;
const clone  = (v) => JSON.parse(JSON.stringify(v));

// ── Status constants ─────────────────────────────────────────────────────────
export const STATUS_DU = {
  ATIVO:               'ATIVO',
  ENCERRADO:           'ENCERRADO',
  FINALIZADO:          'FINALIZADO',
  CANCELADO:           'CANCELADO',
  FINALIZADO_PENDENTE: 'FINALIZADO - PAGAMENTO PENDENTE',
};

// ── Day Use pricing per category ─────────────────────────────────────────────
// horasBase: hours included in precoFixo; precoAdicional: per extra hour
export const DAY_USE_PRICING = {
  'Standard': { modo: 'padrao', horasBase: 2, precoFixo: 90,  precoAdicional: 15 },
  'Luxo':     { modo: 'padrao', horasBase: 2, precoFixo: 150, precoAdicional: 25 },
  'Suíte':    { modo: 'padrao', horasBase: 2, precoFixo: 200, precoAdicional: 40 },
};

// ── Re-export shared data from staysMocks ────────────────────────────────────
export {
  FORMAS_PAGAMENTO,
  CATEGORIAS_QUARTOS,
  HOSPEDES_CADASTRADOS,
  CATEGORIAS_CONSUMO,
  getCategoriaDoQuarto,
  TIPOS_ACOMODACAO,
} from '../stays/staysMocks';

// ── Initial day use data ─────────────────────────────────────────────────────
// horasBase / precoBase / precoAdicional come from DAY_USE_PRICING at creation
let _dayUses = [
  {
    id: 1, quarto: 3, categoria: 'Standard', tipo: 'Casal', titularNome: 'João Silva',
    dataUso: '28/02/2026', horaEntrada: '01:00', horaSaida: null,
    status: STATUS_DU.ATIVO,
    horasBase: 2, precoBase: 90, precoAdicional: 15, modo: 'padrao',
    valorTotal: 0, totalPago: 0, pagamentoPendente: 0,
    hospedes: [
      { id: 1, nome: 'João Silva',  cpf: '123.456.789-00', telefone: '(98) 99999-9999' },
      { id: 2, nome: 'Maria Silva', cpf: '987.654.321-00', telefone: '(98) 98888-8888' },
    ],
    consumos: [
      { id: 101, categoria: 'Bebidas', item: 'Cerveja Heineken', quantidade: 2, valorUnitario: 12, valorTotal: 24, formaPagamento: 'Cartão de Crédito' },
    ],
    pagamentos: [],
  },
  {
    id: 2, quarto: 6, categoria: 'Luxo', tipo: 'Individual', titularNome: 'Ana Costa',
    dataUso: '28/02/2026', horaEntrada: '08:00', horaSaida: '10:45',
    status: STATUS_DU.ENCERRADO,
    horasBase: 2, precoBase: 150, precoAdicional: 25, modo: 'padrao',
    valorTotal: 175, totalPago: 0, pagamentoPendente: 175,
    hospedes: [
      { id: 3, nome: 'Ana Costa', cpf: '111.222.333-44', telefone: '(98) 97777-7777' },
    ],
    consumos: [],
    pagamentos: [],
  },
  {
    id: 3, quarto: 2, categoria: 'Standard', tipo: 'Individual', titularNome: 'Carlos Mendes',
    dataUso: '27/02/2026', horaEntrada: '07:00', horaSaida: '12:30',
    status: STATUS_DU.FINALIZADO,
    horasBase: 2, precoBase: 90, precoAdicional: 15, modo: 'padrao',
    valorTotal: 105, totalPago: 105, pagamentoPendente: 0,
    hospedes: [
      { id: 4, nome: 'Carlos Mendes', cpf: '555.666.777-88', telefone: '(98) 96666-6666' },
    ],
    consumos: [
      { id: 301, categoria: 'Alimentação', item: 'Hambúrguer', quantidade: 1, valorUnitario: 35, valorTotal: 35, formaPagamento: 'Dinheiro' },
    ],
    pagamentos: [
      { id: 401, descricao: 'Pagamento integral', formaPagamento: 'PIX', valor: 105, data: '27/02/2026 12:35' },
    ],
  },
  {
    id: 4, quarto: 9, categoria: 'Suíte', tipo: 'Casal', titularNome: 'Roberto Lima',
    dataUso: '27/02/2026', horaEntrada: '07:00', horaSaida: '11:00',
    status: STATUS_DU.FINALIZADO_PENDENTE,
    horasBase: 2, precoBase: 200, precoAdicional: 40, modo: 'padrao',
    valorTotal: 200, totalPago: 100, pagamentoPendente: 100,
    hospedes: [
      { id: 6, nome: 'Roberto Lima',   cpf: '444.333.222-11', telefone: '(98) 94444-4444' },
      { id: 5, nome: 'Fernanda Souza', cpf: '999.888.777-66', telefone: '(98) 95555-5555' },
    ],
    consumos: [],
    pagamentos: [
      { id: 501, descricao: 'Entrada', formaPagamento: 'Dinheiro', valor: 100, data: '27/02/2026 09:10' },
    ],
  },
];

// ── Mock API ─────────────────────────────────────────────────────────────────
export const dayUseApi = {
  async listar() {
    await delay();
    return clone(_dayUses);
  },

  async criar(du) {
    await delay();
    const nova = { ...clone(du), id: nextId() };
    _dayUses = [..._dayUses, nova];
    return clone(nova);
  },

  async atualizar(id, patch) {
    await delay();
    _dayUses = _dayUses.map((s) => s.id === id ? { ...s, ...clone(patch) } : s);
    return clone(_dayUses.find((s) => s.id === id));
  },

  async encerrar(id, { horaSaida, valorTotal, pagamentoPendente }) {
    await delay();
    _dayUses = _dayUses.map((s) =>
      s.id !== id ? s : {
        ...s,
        horaSaida,
        valorTotal,
        pagamentoPendente,
        status: STATUS_DU.ENCERRADO,
      }
    );
    return clone(_dayUses.find((s) => s.id === id));
  },

  async atualizarStatus(id, status) {
    await delay();
    _dayUses = _dayUses.map((s) => s.id === id ? { ...s, status } : s);
    return clone(_dayUses.find((s) => s.id === id));
  },

  async adicionarHospede(id, hospede) {
    await delay();
    _dayUses = _dayUses.map((s) => {
      if (s.id !== id) return s;
      if (s.hospedes.find((h) => h.id === hospede.id)) return s;
      return { ...s, hospedes: [...s.hospedes, clone(hospede)] };
    });
    return clone(_dayUses.find((s) => s.id === id));
  },

  async removerHospede(id, hospedeId) {
    await delay();
    _dayUses = _dayUses.map((s) =>
      s.id !== id ? s : { ...s, hospedes: s.hospedes.filter((h) => h.id !== hospedeId) }
    );
    return clone(_dayUses.find((s) => s.id === id));
  },

  async adicionarConsumo(id, consumo) {
    await delay();
    _dayUses = _dayUses.map((s) =>
      s.id !== id ? s : { ...s, consumos: [...s.consumos, { ...clone(consumo), id: nextId() }] }
    );
    return clone(_dayUses.find((s) => s.id === id));
  },

  async adicionarPagamento(id, pagamento) {
    await delay();
    const du = _dayUses.find((s) => s.id === id);
    if (!du) throw new Error('Day Use não encontrado');
    const novoPago = du.totalPago + pagamento.valor;
    _dayUses = _dayUses.map((s) =>
      s.id !== id ? s : {
        ...s,
        totalPago: novoPago,
        pagamentoPendente: Math.max(0, s.valorTotal - novoPago),
        pagamentos: [...s.pagamentos, { ...clone(pagamento), id: nextId() }],
      }
    );
    return clone(_dayUses.find((s) => s.id === id));
  },
};
