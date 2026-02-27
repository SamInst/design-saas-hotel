// ── Simulated network delay ─────────────────────────────────────────────────
const delay = (ms = 220) => new Promise((r) => setTimeout(r, ms));

let _nextId = 500;
const nextId = () => ++_nextId;
const clone  = (v) => JSON.parse(JSON.stringify(v));

// ── Status constants ─────────────────────────────────────────────────────────
export const STATUS = {
  ATIVO:               'ATIVO',
  DIARIA_ENCERRADA:    'DIÁRIA ENCERRADA',
  FINALIZADO:          'FINALIZADO',
  CANCELADO:           'CANCELADO',
  FINALIZADO_PENDENTE: 'FINALIZADO - PAGAMENTO PENDENTE',
};

// ── Formas de pagamento ──────────────────────────────────────────────────────
export const FORMAS_PAGAMENTO = [
  'Dinheiro', 'PIX', 'Cartão de Crédito', 'Cartão de Débito', 'Transferência Bancária',
];

// ── Categorias de quartos ────────────────────────────────────────────────────
export const CATEGORIAS_QUARTOS = [
  {
    id: 1, nome: 'Standard',
    modeloCobranca: 'Por ocupação',
    precosOcupacao: { 1: 120, 2: 160, 3: 190, 4: 210, 5: 230 },
    quartos: [1, 2, 3, 4, 5],
  },
  {
    id: 2, nome: 'Luxo',
    modeloCobranca: 'Por ocupação',
    precosOcupacao: { 1: 220, 2: 280, 3: 320, 4: 360, 5: 400 },
    quartos: [6, 7, 8],
  },
  {
    id: 3, nome: 'Suíte',
    modeloCobranca: 'Por quarto (tarifa fixa)',
    precoFixo: 450,
    quartos: [9, 10],
  },
];

// ── Hóspedes cadastrados (para busca) ────────────────────────────────────────
export const HOSPEDES_CADASTRADOS = [
  { id: 1, nome: 'João Silva',     cpf: '123.456.789-00', telefone: '(98) 99999-9999' },
  { id: 2, nome: 'Maria Silva',    cpf: '987.654.321-00', telefone: '(98) 98888-8888' },
  { id: 3, nome: 'Ana Costa',      cpf: '111.222.333-44', telefone: '(98) 97777-7777' },
  { id: 4, nome: 'Carlos Mendes',  cpf: '555.666.777-88', telefone: '(98) 96666-6666' },
  { id: 5, nome: 'Fernanda Souza', cpf: '999.888.777-66', telefone: '(98) 95555-5555' },
  { id: 6, nome: 'Roberto Lima',   cpf: '444.333.222-11', telefone: '(98) 94444-4444' },
];

// ── Categorias de consumo ────────────────────────────────────────────────────
export const CATEGORIAS_CONSUMO = [
  {
    id: 1, nome: 'Bebidas',
    produtos: [
      { id: 1, nome: 'Cerveja Heineken',     preco: 12 },
      { id: 2, nome: 'Refrigerante Lata',    preco:  6 },
      { id: 3, nome: 'Água Mineral',         preco:  4 },
    ],
  },
  {
    id: 2, nome: 'Alimentação',
    produtos: [
      { id: 4, nome: 'Porção de batata frita', preco: 25 },
      { id: 5, nome: 'Hambúrguer',             preco: 35 },
      { id: 6, nome: 'Pizza média',            preco: 45 },
    ],
  },
  {
    id: 3, nome: 'Serviços',
    produtos: [
      { id: 7, nome: 'Lavanderia', preco: 20 },
      { id: 8, nome: 'Frigobar',   preco: 15 },
    ],
  },
];

// ── Utility: calc price ──────────────────────────────────────────────────────
export function getCategoriaDoQuarto(quartoNum) {
  return CATEGORIAS_QUARTOS.find((c) => c.quartos.includes(Number(quartoNum)));
}

export function calcPrecoDiaria(quartoNum, pessoas) {
  const cat = getCategoriaDoQuarto(quartoNum);
  if (!cat) return 0;
  if (cat.modeloCobranca === 'Por quarto (tarifa fixa)') return cat.precoFixo;
  return cat.precosOcupacao?.[pessoas] || 0;
}

export function diffDays(a, b) {
  const da = a instanceof Date ? a : new Date(a);
  const db = b instanceof Date ? b : new Date(b);
  return Math.max(0, Math.round(Math.abs(db - da) / 86400000));
}

export function fmtNum(n) {
  return n < 10 ? `0${n}` : `${n}`;
}

// ── Initial stays data ───────────────────────────────────────────────────────
let _stays = [
  {
    id: 1, quarto: 3, categoria: 'Standard', titularNome: 'João Silva',
    periodo: '15/02/2026 - 25/02/2026', status: STATUS.ATIVO,
    totalDiarias: 3, chegadaPrevista: '15/02/2026 14:00', saidaPrevista: '18/02/2026 12:00',
    valorTotal: 480, totalPago: 240, pagamentoPendente: 240, diariaAtual: 2,
    diarias: [
      {
        id: 1, numero: 1, quarto: 3, valorDiaria: 160,
        dataInicio: '15/02/2026 14:00', dataFim: '16/02/2026 12:00',
        hospedes: [
          { id: 1, nome: 'João Silva',  cpf: '123.456.789-00', telefone: '(98) 99999-9999' },
          { id: 2, nome: 'Maria Silva', cpf: '987.654.321-00', telefone: '(98) 98888-8888' },
        ],
        consumos: [
          { id: 101, categoria: 'Bebidas',    item: 'Cerveja Heineken',     quantidade: 3, valorUnitario: 12, valorTotal: 36, formaPagamento: 'Cartão de Crédito' },
          { id: 102, categoria: 'Alimentação', item: 'Porção de batata frita', quantidade: 1, valorUnitario: 25, valorTotal: 25, formaPagamento: 'Dinheiro' },
        ],
        pagamentos: [
          { id: 201, descricao: 'Entrada (50%)', formaPagamento: 'PIX', valor: 240, data: '15/02/2026 14:30' },
        ],
      },
      {
        id: 2, numero: 2, quarto: 3, valorDiaria: 160,
        dataInicio: '16/02/2026 12:00', dataFim: '17/02/2026 12:00',
        hospedes: [
          { id: 1, nome: 'João Silva',  cpf: '123.456.789-00', telefone: '(98) 99999-9999' },
          { id: 2, nome: 'Maria Silva', cpf: '987.654.321-00', telefone: '(98) 98888-8888' },
        ],
        consumos: [
          { id: 103, categoria: 'Bebidas', item: 'Refrigerante Lata', quantidade: 2, valorUnitario: 6, valorTotal: 12, formaPagamento: 'Cartão de Débito' },
          { id: 104, categoria: 'Serviços', item: 'Lavanderia',       quantidade: 1, valorUnitario: 20, valorTotal: 20, formaPagamento: 'Dinheiro' },
        ],
        pagamentos: [],
      },
      {
        id: 3, numero: 3, quarto: 3, valorDiaria: 160,
        dataInicio: '17/02/2026 12:00', dataFim: '18/02/2026 12:00',
        hospedes: [
          { id: 1, nome: 'João Silva', cpf: '123.456.789-00', telefone: '(98) 99999-9999' },
        ],
        consumos: [],
        pagamentos: [],
      },
    ],
  },
  {
    id: 2, quarto: 6, categoria: 'Luxo', titularNome: 'Ana Costa',
    periodo: '14/02/2026 - 16/02/2026', status: STATUS.DIARIA_ENCERRADA,
    totalDiarias: 2, chegadaPrevista: '14/02/2026 15:00', saidaPrevista: '16/02/2026 11:00',
    valorTotal: 560, totalPago: 560, pagamentoPendente: 0, diariaAtual: 2,
    diarias: [
      {
        id: 1, numero: 1, quarto: 6, valorDiaria: 280,
        dataInicio: '14/02/2026 15:00', dataFim: '15/02/2026 11:00',
        hospedes: [
          { id: 3, nome: 'Ana Costa', cpf: '111.222.333-44', telefone: '(98) 97777-7777' },
        ],
        consumos: [
          { id: 201, categoria: 'Bebidas',    item: 'Cerveja Heineken',  quantidade: 4, valorUnitario: 12, valorTotal: 48, formaPagamento: 'Cartão de Crédito' },
          { id: 202, categoria: 'Alimentação', item: 'Hambúrguer',       quantidade: 2, valorUnitario: 35, valorTotal: 70, formaPagamento: 'Cartão de Crédito' },
        ],
        pagamentos: [
          { id: 301, descricao: 'Pagamento integral', formaPagamento: 'PIX', valor: 560, data: '14/02/2026 15:30' },
        ],
      },
      {
        id: 2, numero: 2, quarto: 6, valorDiaria: 280,
        dataInicio: '15/02/2026 11:00', dataFim: '16/02/2026 11:00',
        hospedes: [
          { id: 3, nome: 'Ana Costa', cpf: '111.222.333-44', telefone: '(98) 97777-7777' },
        ],
        consumos: [
          { id: 203, categoria: 'Serviços', item: 'Frigobar', quantidade: 1, valorUnitario: 15, valorTotal: 15, formaPagamento: 'Dinheiro' },
        ],
        pagamentos: [],
      },
    ],
  },
  {
    id: 3, quarto: 9, categoria: 'Suíte', titularNome: 'Carlos Mendes',
    periodo: '10/02/2026 - 13/02/2026', status: STATUS.FINALIZADO,
    totalDiarias: 3, chegadaPrevista: '10/02/2026 14:00', saidaPrevista: '13/02/2026 12:00',
    valorTotal: 1350, totalPago: 1350, pagamentoPendente: 0, diariaAtual: 3,
    diarias: [],
  },
  {
    id: 4, quarto: 2, categoria: 'Standard', titularNome: 'Fernanda Souza',
    periodo: '12/02/2026 - 14/02/2026', status: STATUS.CANCELADO,
    totalDiarias: 2, chegadaPrevista: '12/02/2026 15:00', saidaPrevista: '14/02/2026 12:00',
    valorTotal: 320, totalPago: 0, pagamentoPendente: 0, diariaAtual: 0,
    diarias: [],
  },
  {
    id: 5, quarto: 7, categoria: 'Luxo', titularNome: 'Roberto Lima',
    periodo: '08/02/2026 - 11/02/2026', status: STATUS.FINALIZADO_PENDENTE,
    totalDiarias: 3, chegadaPrevista: '08/02/2026 14:00', saidaPrevista: '11/02/2026 12:00',
    valorTotal: 840, totalPago: 500, pagamentoPendente: 340, diariaAtual: 3,
    diarias: [],
  },
];

// ── Mock API ─────────────────────────────────────────────────────────────────
export const stayApi = {
  async listar() {
    await delay();
    return clone(_stays);
  },

  async criar(stay) {
    await delay();
    const nova = { ...clone(stay), id: nextId() };
    _stays = [..._stays, nova];
    return clone(nova);
  },

  async atualizar(id, patch) {
    await delay();
    _stays = _stays.map((s) => s.id === id ? { ...s, ...clone(patch) } : s);
    return clone(_stays.find((s) => s.id === id));
  },

  async atualizarStatus(id, status) {
    await delay();
    _stays = _stays.map((s) => s.id === id ? { ...s, status } : s);
    return clone(_stays.find((s) => s.id === id));
  },

  async adicionarDiaria(stayId, diaria) {
    await delay();
    const stay = _stays.find((s) => s.id === stayId);
    if (!stay) throw new Error('Pernoite não encontrado');
    const novaId = (stay.diarias.length || 0) + 1;
    const nova = { ...clone(diaria), id: novaId, numero: novaId };
    _stays = _stays.map((s) =>
      s.id === stayId
        ? { ...s, diarias: [...s.diarias, nova], totalDiarias: novaId }
        : s
    );
    return clone(_stays.find((s) => s.id === stayId));
  },

  async removerDiaria(stayId, diariaIdx) {
    await delay();
    const stay = _stays.find((s) => s.id === stayId);
    if (!stay) throw new Error('Pernoite não encontrado');
    const novas = stay.diarias
      .filter((_, i) => i !== diariaIdx)
      .map((d, i) => ({ ...d, id: i + 1, numero: i + 1 }));
    const diariaAtual = Math.min(stay.diariaAtual, novas.length);
    _stays = _stays.map((s) =>
      s.id === stayId ? { ...s, diarias: novas, totalDiarias: novas.length, diariaAtual } : s
    );
    return clone(_stays.find((s) => s.id === stayId));
  },

  async editarDiaria(stayId, diariaIndex, patch) {
    await delay();
    _stays = _stays.map((s) => {
      if (s.id !== stayId) return s;
      return {
        ...s,
        diarias: s.diarias.map((d, i) => i === diariaIndex ? { ...d, ...clone(patch) } : d),
      };
    });
    return clone(_stays.find((s) => s.id === stayId));
  },

  async adicionarHospede(stayId, diariaIndex, hospede) {
    await delay();
    _stays = _stays.map((s) => {
      if (s.id !== stayId) return s;
      return {
        ...s,
        diarias: s.diarias.map((d, i) => {
          if (i !== diariaIndex) return d;
          if (d.hospedes.find((h) => h.id === hospede.id)) return d;
          return { ...d, hospedes: [...d.hospedes, clone(hospede)] };
        }),
      };
    });
    return clone(_stays.find((s) => s.id === stayId));
  },

  async removerHospede(stayId, diariaIndex, hospedeId) {
    await delay();
    _stays = _stays.map((s) => {
      if (s.id !== stayId) return s;
      return {
        ...s,
        diarias: s.diarias.map((d, i) =>
          i === diariaIndex
            ? { ...d, hospedes: d.hospedes.filter((h) => h.id !== hospedeId) }
            : d
        ),
      };
    });
    return clone(_stays.find((s) => s.id === stayId));
  },

  async adicionarConsumo(stayId, diariaIndex, consumo) {
    await delay();
    _stays = _stays.map((s) => {
      if (s.id !== stayId) return s;
      return {
        ...s,
        diarias: s.diarias.map((d, i) =>
          i === diariaIndex
            ? { ...d, consumos: [...d.consumos, { ...clone(consumo), id: nextId() }] }
            : d
        ),
      };
    });
    return clone(_stays.find((s) => s.id === stayId));
  },

  async adicionarPagamento(stayId, diariaIndex, pagamento) {
    await delay();
    const stay = _stays.find((s) => s.id === stayId);
    if (!stay) throw new Error('Pernoite não encontrado');
    const novoPago = stay.totalPago + pagamento.valor;
    _stays = _stays.map((s) => {
      if (s.id !== stayId) return s;
      return {
        ...s,
        totalPago: novoPago,
        pagamentoPendente: Math.max(0, s.valorTotal - novoPago),
        diarias: s.diarias.map((d, i) =>
          i === diariaIndex
            ? { ...d, pagamentos: [...d.pagamentos, { ...clone(pagamento), id: nextId() }] }
            : d
        ),
      };
    });
    return clone(_stays.find((s) => s.id === stayId));
  },
};
