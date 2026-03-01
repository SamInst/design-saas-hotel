// ── Simulated network delay ─────────────────────────────────────────────────
const delay = (ms = 220) => new Promise((r) => setTimeout(r, ms));

let _nextId = 900;
const nextId = () => ++_nextId;
const clone  = (v) => JSON.parse(JSON.stringify(v));

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

// ── 22 rooms ──────────────────────────────────────────────────────────────────
let _quartos = [
  // ── STANDARD (01–10) ────────────────────────────────────────────────────────
  {
    id: 1, numero: '01', categoriaId: 1, categoria: 'Standard', tipoOcupacao: 'Casal',
    descricao: 'Quarto aconchegante com vista para o jardim.',
    camas: { casal: 1, solteiro: 0, beliche: 0, rede: 0 },
    status: ROOM_STATUS.DISPONIVEL,
    servico: null, limpeza: null, manutencao: null,
    itens: [
      { nome: 'Cama Casal', qtd: 1 }, { nome: 'TV 32"', qtd: 1 }, { nome: 'Ar-Condicionado', qtd: 1 },
      { nome: 'Frigobar', qtd: 1 }, { nome: 'Banheiro Privativo', qtd: 1 }, { nome: 'Wi-Fi', qtd: 1 },
    ],
  },
  {
    id: 2, numero: '02', categoriaId: 1, categoria: 'Standard', tipoOcupacao: 'Duplo',
    descricao: 'Quarto compartilhado com duas camas de solteiro.',
    camas: { casal: 0, solteiro: 2, beliche: 0, rede: 0 },
    status: ROOM_STATUS.DISPONIVEL,
    servico: null, limpeza: null, manutencao: null,
    itens: [
      { nome: 'Cama Solteiro', qtd: 2 }, { nome: 'TV 32"', qtd: 1 }, { nome: 'Ar-Condicionado', qtd: 1 },
      { nome: 'Frigobar', qtd: 1 }, { nome: 'Banheiro Privativo', qtd: 1 }, { nome: 'Wi-Fi', qtd: 1 },
    ],
  },
  {
    id: 3, numero: '03', categoriaId: 1, categoria: 'Standard', tipoOcupacao: 'Casal',
    descricao: 'Quarto Standard com cama de casal e TV a cabo.',
    camas: { casal: 1, solteiro: 0, beliche: 0, rede: 0 },
    status: ROOM_STATUS.OCUPADO,
    limpeza: null, manutencao: null,
    itens: [
      { nome: 'Cama Casal', qtd: 1 }, { nome: 'TV 32"', qtd: 1 }, { nome: 'Ar-Condicionado', qtd: 1 },
      { nome: 'Frigobar', qtd: 1 }, { nome: 'Banheiro Privativo', qtd: 1 }, { nome: 'Wi-Fi', qtd: 1 },
    ],
    servico: {
      tipo: 'pernoite', id: 301,
      titularNome: 'João Silva', tipoAcomodacao: 'Casal',
      periodo: '24/02/2026 - 28/02/2026',
      chegadaPrevista: '24/02/2026 14:00', saidaPrevista: '28/02/2026 12:00',
      status: PERNOITE_STATUS.ATIVO,
      totalDiarias: 4, diariaAtual: 3,
      valorTotal: 640, totalPago: 320, pagamentoPendente: 320,
      hospedes: [
        { id: 1, nome: 'João Silva',  cpf: '123.456.789-00', telefone: '(98) 99999-9999', email: 'joao.silva@email.com'  },
        { id: 2, nome: 'Maria Silva', cpf: '987.654.321-00', telefone: '(98) 98888-8888', email: 'maria.silva@email.com' },
      ],
      consumos: [
        { id: 9001, categoria: 'Bebidas',     item: 'Cerveja Heineken', quantidade: 3, valorUnitario: 12, valorTotal: 36 },
        { id: 9002, categoria: 'Alimentação', item: 'Hambúrguer',       quantidade: 2, valorUnitario: 35, valorTotal: 70 },
      ],
      pagamentos: [
        { id: 8001, descricao: 'Entrada (50%)', formaPagamento: 'PIX', valor: 320, data: '24/02/2026 14:30' },
      ],
      diarias: [
        { idx: 0, num: 1, dataInicio: '24/02/2026 14:00', dataFim: '25/02/2026 12:00', valor: 160,
          hospedes: [{ nome: 'João Silva', cpf: '123.456.789-00', telefone: '(98) 99999-9999', email: 'joao.silva@email.com' }, { nome: 'Maria Silva', cpf: '987.654.321-00', telefone: '(98) 98888-8888', email: 'maria.silva@email.com' }],
          consumos: [], pagamentos: [] },
        { idx: 1, num: 2, dataInicio: '25/02/2026 12:00', dataFim: '26/02/2026 12:00', valor: 160,
          hospedes: [{ nome: 'João Silva', cpf: '123.456.789-00', telefone: '(98) 99999-9999', email: 'joao.silva@email.com' }, { nome: 'Maria Silva', cpf: '987.654.321-00', telefone: '(98) 98888-8888', email: 'maria.silva@email.com' }],
          consumos: [{ item: 'Cerveja Heineken', qtd: 3, valor: 36 }], pagamentos: [] },
        { idx: 2, num: 3, dataInicio: '26/02/2026 12:00', dataFim: '27/02/2026 12:00', valor: 160,
          hospedes: [{ nome: 'João Silva', cpf: '123.456.789-00', telefone: '(98) 99999-9999', email: 'joao.silva@email.com' }, { nome: 'Maria Silva', cpf: '987.654.321-00', telefone: '(98) 98888-8888', email: 'maria.silva@email.com' }],
          consumos: [{ item: 'Hambúrguer', qtd: 2, valor: 70 }],
          pagamentos: [{ descricao: 'Entrada (50%)', forma: 'PIX', valor: 320 }] },
        { idx: 3, num: 4, dataInicio: '27/02/2026 12:00', dataFim: '28/02/2026 12:00', valor: 160,
          hospedes: [{ nome: 'João Silva', cpf: '123.456.789-00', telefone: '(98) 99999-9999', email: 'joao.silva@email.com' }, { nome: 'Maria Silva', cpf: '987.654.321-00', telefone: '(98) 98888-8888', email: 'maria.silva@email.com' }],
          consumos: [], pagamentos: [] },
      ],
    },
  },
  {
    id: 4, numero: '04', categoriaId: 1, categoria: 'Standard', tipoOcupacao: 'Individual',
    descricao: 'Quarto Standard econômico com cama de solteiro.',
    camas: { casal: 0, solteiro: 1, beliche: 0, rede: 0 },
    status: ROOM_STATUS.RESERVADO,
    limpeza: null, manutencao: null,
    itens: [
      { nome: 'Cama Solteiro', qtd: 1 }, { nome: 'TV 28"', qtd: 1 }, { nome: 'Ar-Condicionado', qtd: 1 },
      { nome: 'Banheiro Compartilhado', qtd: 1 }, { nome: 'Wi-Fi', qtd: 1 },
    ],
    servico: {
      tipo: 'reserva', id: 302,
      titularNome: 'Carlos Mendes', tipoAcomodacao: 'Individual',
      chegadaPrevista: '28/02/2026 15:00', saidaPrevista: '01/03/2026 12:00',
      totalDiarias: 1,
    },
  },
  {
    id: 5, numero: '05', categoriaId: 1, categoria: 'Standard', tipoOcupacao: 'Casal',
    descricao: 'Quarto Standard aguardando limpeza.',
    camas: { casal: 1, solteiro: 0, beliche: 0, rede: 0 },
    status: ROOM_STATUS.LIMPEZA,
    servico: null, manutencao: null,
    itens: [
      { nome: 'Cama Casal', qtd: 1 }, { nome: 'TV 32"', qtd: 1 }, { nome: 'Ar-Condicionado', qtd: 1 },
      { nome: 'Frigobar', qtd: 1 }, { nome: 'Banheiro Privativo', qtd: 1 }, { nome: 'Wi-Fi', qtd: 1 },
    ],
    limpeza: { responsavel: 'Ana Paula', inicio: '28/02/2026 12:30' },
  },
  {
    id: 6, numero: '06', categoriaId: 1, categoria: 'Standard', tipoOcupacao: 'Individual',
    descricao: 'Quarto compacto e econômico, ideal para viajante solo.',
    camas: { casal: 0, solteiro: 1, beliche: 0, rede: 0 },
    status: ROOM_STATUS.DISPONIVEL,
    servico: null, limpeza: null, manutencao: null,
    itens: [
      { nome: 'Cama Solteiro', qtd: 1 }, { nome: 'TV 28"', qtd: 1 }, { nome: 'Ar-Condicionado', qtd: 1 },
      { nome: 'Banheiro Privativo', qtd: 1 }, { nome: 'Wi-Fi', qtd: 1 },
    ],
  },
  {
    id: 7, numero: '07', categoriaId: 1, categoria: 'Standard', tipoOcupacao: 'Casal',
    descricao: 'Quarto Standard espaçoso com ar-condicionado.',
    camas: { casal: 1, solteiro: 0, beliche: 0, rede: 0 },
    status: ROOM_STATUS.OCUPADO,
    limpeza: null, manutencao: null,
    itens: [
      { nome: 'Cama Casal', qtd: 1 }, { nome: 'TV 32"', qtd: 1 }, { nome: 'Ar-Condicionado', qtd: 1 },
      { nome: 'Frigobar', qtd: 1 }, { nome: 'Banheiro Privativo', qtd: 1 }, { nome: 'Wi-Fi', qtd: 1 },
    ],
    servico: {
      tipo: 'dayuse', id: 701,
      titularNome: null,
      dataUso: '28/02/2026', horaEntrada: '09:00', horaSaida: null,
      status: DAYUSE_STATUS.ATIVO,
      horasBase: 2, precoBase: 90, precoAdicional: 15,
      valorTotal: 0, totalPago: 0, pagamentoPendente: 0,
      hospedes: [],
      consumos: [
        { id: 7001, categoria: 'Bebidas', item: 'Cerveja Heineken', quantidade: 2, valorUnitario: 12, valorTotal: 24 },
      ],
      pagamentos: [],
    },
  },
  {
    id: 8, numero: '08', categoriaId: 1, categoria: 'Standard', tipoOcupacao: 'Triplo',
    descricao: 'Quarto familiar com beliche e cama de casal.',
    camas: { casal: 1, solteiro: 0, beliche: 1, rede: 0 },
    status: ROOM_STATUS.DISPONIVEL,
    servico: null, limpeza: null, manutencao: null,
    itens: [
      { nome: 'Cama Casal', qtd: 1 }, { nome: 'Beliche', qtd: 1 }, { nome: 'TV 32"', qtd: 1 },
      { nome: 'Ar-Condicionado', qtd: 1 }, { nome: 'Banheiro Privativo', qtd: 1 }, { nome: 'Wi-Fi', qtd: 1 },
    ],
  },
  {
    id: 9, numero: '09', categoriaId: 1, categoria: 'Standard', tipoOcupacao: 'Casal',
    descricao: 'Quarto em manutenção do sistema elétrico.',
    camas: { casal: 1, solteiro: 0, beliche: 0, rede: 0 },
    status: ROOM_STATUS.MANUTENCAO,
    servico: null, limpeza: null,
    itens: [
      { nome: 'Cama Casal', qtd: 1 }, { nome: 'TV 32"', qtd: 1 }, { nome: 'Ar-Condicionado', qtd: 1 },
      { nome: 'Banheiro Privativo', qtd: 1 }, { nome: 'Wi-Fi', qtd: 1 },
    ],
    manutencao: { responsavel: 'Carlos Oliveira', descricao: 'Reparo no sistema elétrico e tomadas.', previsaoFim: '01/03/2026' },
  },
  {
    id: 10, numero: '10', categoriaId: 1, categoria: 'Standard', tipoOcupacao: 'Casal',
    descricao: 'Quarto recém reformado com decoração moderna.',
    camas: { casal: 1, solteiro: 0, beliche: 0, rede: 0 },
    status: ROOM_STATUS.DISPONIVEL,
    servico: null, limpeza: null, manutencao: null,
    itens: [
      { nome: 'Cama Casal', qtd: 1 }, { nome: 'TV 40"', qtd: 1 }, { nome: 'Ar-Condicionado', qtd: 1 },
      { nome: 'Frigobar', qtd: 1 }, { nome: 'Banheiro Privativo', qtd: 1 }, { nome: 'Wi-Fi', qtd: 1 },
    ],
  },

  // ── LUXO (11–16) ─────────────────────────────────────────────────────────────
  {
    id: 11, numero: '11', categoriaId: 2, categoria: 'Luxo', tipoOcupacao: 'Casal',
    descricao: 'Quarto Luxo com varanda, vista panorâmica e cama king.',
    camas: { casal: 1, solteiro: 0, beliche: 0, rede: 0 },
    status: ROOM_STATUS.DISPONIVEL,
    servico: null, limpeza: null, manutencao: null,
    itens: [
      { nome: 'Cama King', qtd: 1 }, { nome: 'TV 50" Smart', qtd: 1 }, { nome: 'Ar-Condicionado', qtd: 1 },
      { nome: 'Frigobar', qtd: 1 }, { nome: 'Banheiro Privativo', qtd: 1 }, { nome: 'Varanda', qtd: 1 },
      { nome: 'Cofre', qtd: 1 }, { nome: 'Wi-Fi', qtd: 1 },
    ],
  },
  {
    id: 12, numero: '12', categoriaId: 2, categoria: 'Luxo', tipoOcupacao: 'Casal',
    descricao: 'Quarto Luxo com hidromassagem e TV 4K.',
    camas: { casal: 1, solteiro: 0, beliche: 0, rede: 0 },
    status: ROOM_STATUS.OCUPADO,
    limpeza: null, manutencao: null,
    itens: [
      { nome: 'Cama King', qtd: 1 }, { nome: 'TV 55" 4K', qtd: 1 }, { nome: 'Ar-Condicionado', qtd: 1 },
      { nome: 'Hidromassagem', qtd: 1 }, { nome: 'Frigobar', qtd: 1 }, { nome: 'Cofre', qtd: 1 },
      { nome: 'Varanda', qtd: 1 }, { nome: 'Wi-Fi', qtd: 1 },
    ],
    servico: {
      tipo: 'pernoite', id: 1201,
      titularNome: 'Ana Costa', tipoAcomodacao: 'Casal',
      periodo: '26/02/2026 - 03/03/2026',
      chegadaPrevista: '26/02/2026 15:00', saidaPrevista: '03/03/2026 12:00',
      status: PERNOITE_STATUS.ATIVO,
      totalDiarias: 5, diariaAtual: 3,
      valorTotal: 1400, totalPago: 700, pagamentoPendente: 700,
      hospedes: [
        { id: 3, nome: 'Ana Costa', cpf: '111.222.333-44', telefone: '(98) 97777-7777' },
      ],
      consumos: [
        { id: 12001, categoria: 'Serviços',    item: 'Frigobar',    quantidade: 1, valorUnitario: 15, valorTotal: 15 },
        { id: 12002, categoria: 'Alimentação', item: 'Pizza média', quantidade: 1, valorUnitario: 45, valorTotal: 45 },
      ],
      pagamentos: [
        { id: 11001, descricao: 'Entrada (50%)', formaPagamento: 'Cartão de Crédito', valor: 700, data: '26/02/2026 15:30' },
      ],
      diarias: [
        { idx: 0, num: 1, dataInicio: '26/02/2026 15:00', dataFim: '27/02/2026 12:00', valor: 280,
          hospedes: [{ nome: 'Ana Costa', cpf: '111.222.333-44' }], consumos: [],
          pagamentos: [{ descricao: 'Entrada (50%)', forma: 'Cartão de Crédito', valor: 700 }] },
        { idx: 1, num: 2, dataInicio: '27/02/2026 12:00', dataFim: '28/02/2026 12:00', valor: 280,
          hospedes: [{ nome: 'Ana Costa', cpf: '111.222.333-44' }],
          consumos: [{ item: 'Frigobar', qtd: 1, valor: 15 }], pagamentos: [] },
        { idx: 2, num: 3, dataInicio: '28/02/2026 12:00', dataFim: '01/03/2026 12:00', valor: 280,
          hospedes: [{ nome: 'Ana Costa', cpf: '111.222.333-44' }],
          consumos: [{ item: 'Pizza média', qtd: 1, valor: 45 }], pagamentos: [] },
        { idx: 3, num: 4, dataInicio: '01/03/2026 12:00', dataFim: '02/03/2026 12:00', valor: 280,
          hospedes: [{ nome: 'Ana Costa', cpf: '111.222.333-44' }], consumos: [], pagamentos: [] },
        { idx: 4, num: 5, dataInicio: '02/03/2026 12:00', dataFim: '03/03/2026 12:00', valor: 280,
          hospedes: [{ nome: 'Ana Costa', cpf: '111.222.333-44' }], consumos: [], pagamentos: [] },
      ],
    },
  },
  {
    id: 13, numero: '13', categoriaId: 2, categoria: 'Luxo', tipoOcupacao: 'Triplo',
    descricao: 'Quarto Luxo espaçoso com hidromassagem e rede adicional.',
    camas: { casal: 1, solteiro: 0, beliche: 0, rede: 1 },
    status: ROOM_STATUS.DISPONIVEL,
    servico: null, limpeza: null, manutencao: null,
    itens: [
      { nome: 'Cama King', qtd: 1 }, { nome: 'Rede', qtd: 1 }, { nome: 'TV 50" Smart', qtd: 1 },
      { nome: 'Ar-Condicionado', qtd: 1 }, { nome: 'Hidromassagem', qtd: 1 }, { nome: 'Frigobar', qtd: 1 },
      { nome: 'Varanda', qtd: 1 }, { nome: 'Wi-Fi', qtd: 1 },
    ],
  },
  {
    id: 14, numero: '14', categoriaId: 2, categoria: 'Luxo', tipoOcupacao: 'Casal',
    descricao: 'Quarto Luxo com varanda exclusiva e minibar.',
    camas: { casal: 1, solteiro: 0, beliche: 0, rede: 0 },
    status: ROOM_STATUS.OCUPADO,
    limpeza: null, manutencao: null,
    itens: [
      { nome: 'Cama King', qtd: 1 }, { nome: 'TV 50" Smart', qtd: 1 }, { nome: 'Ar-Condicionado', qtd: 1 },
      { nome: 'Minibar', qtd: 1 }, { nome: 'Varanda Privativa', qtd: 1 }, { nome: 'Cofre', qtd: 1 },
      { nome: 'Wi-Fi', qtd: 1 },
    ],
    servico: {
      tipo: 'dayuse', id: 1401,
      titularNome: 'Fernanda Souza',
      dataUso: '28/02/2026', horaEntrada: '08:00', horaSaida: '11:30',
      status: DAYUSE_STATUS.ENCERRADO,
      horasBase: 2, precoBase: 150, precoAdicional: 25,
      valorTotal: 175, totalPago: 0, pagamentoPendente: 175,
      hospedes: [
        { id: 5, nome: 'Fernanda Souza', cpf: '999.888.777-66', telefone: '(98) 95555-5555' },
      ],
      consumos: [],
      pagamentos: [],
    },
  },
  {
    id: 15, numero: '15', categoriaId: 2, categoria: 'Luxo', tipoOcupacao: 'Casal',
    descricao: 'Quarto Luxo em processo de limpeza pós-estadia.',
    camas: { casal: 1, solteiro: 0, beliche: 0, rede: 0 },
    status: ROOM_STATUS.LIMPEZA,
    servico: null, manutencao: null,
    itens: [
      { nome: 'Cama King', qtd: 1 }, { nome: 'TV 50" Smart', qtd: 1 }, { nome: 'Ar-Condicionado', qtd: 1 },
      { nome: 'Frigobar', qtd: 1 }, { nome: 'Varanda', qtd: 1 }, { nome: 'Wi-Fi', qtd: 1 },
    ],
    limpeza: { responsavel: 'Paulo Fonseca', inicio: '28/02/2026 11:45' },
  },
  {
    id: 16, numero: '16', categoriaId: 2, categoria: 'Luxo', tipoOcupacao: 'Duplo',
    descricao: 'Quarto Luxo duplo com duas camas de solteiro e varanda.',
    camas: { casal: 0, solteiro: 2, beliche: 0, rede: 0 },
    status: ROOM_STATUS.RESERVADO,
    limpeza: null, manutencao: null,
    itens: [
      { nome: 'Cama Solteiro', qtd: 2 }, { nome: 'TV 50" Smart', qtd: 1 }, { nome: 'Ar-Condicionado', qtd: 1 },
      { nome: 'Frigobar', qtd: 1 }, { nome: 'Varanda', qtd: 1 }, { nome: 'Cofre', qtd: 1 }, { nome: 'Wi-Fi', qtd: 1 },
    ],
    servico: {
      tipo: 'reserva', id: 1601,
      titularNome: 'Pedro Oliveira', tipoAcomodacao: 'Duplo',
      chegadaPrevista: '01/03/2026 14:00', saidaPrevista: '04/03/2026 12:00',
      totalDiarias: 3,
    },
  },

  // ── SUÍTE (17–22) ────────────────────────────────────────────────────────────
  {
    id: 17, numero: '17', categoriaId: 3, categoria: 'Suíte', tipoOcupacao: 'Quádruplo',
    descricao: 'Suíte Master com sala de estar e vista para o mar.',
    camas: { casal: 1, solteiro: 2, beliche: 0, rede: 0 },
    status: ROOM_STATUS.DISPONIVEL,
    servico: null, limpeza: null, manutencao: null,
    itens: [
      { nome: 'Cama King', qtd: 1 }, { nome: 'Cama Solteiro', qtd: 2 }, { nome: 'TV 65" 4K', qtd: 2 },
      { nome: 'Ar-Condicionado', qtd: 2 }, { nome: 'Banheira de Imersão', qtd: 1 }, { nome: 'Sala de Estar', qtd: 1 },
      { nome: 'Frigobar Premium', qtd: 1 }, { nome: 'Cofre', qtd: 1 }, { nome: 'Varanda Panorâmica', qtd: 1 },
      { nome: 'Wi-Fi', qtd: 1 },
    ],
  },
  {
    id: 18, numero: '18', categoriaId: 3, categoria: 'Suíte', tipoOcupacao: 'Casal',
    descricao: 'Suíte com banheira de imersão e serviço de mordomia.',
    camas: { casal: 1, solteiro: 0, beliche: 0, rede: 0 },
    status: ROOM_STATUS.OCUPADO,
    limpeza: null, manutencao: null,
    itens: [
      { nome: 'Cama King', qtd: 1 }, { nome: 'TV 65" 4K', qtd: 1 }, { nome: 'Ar-Condicionado', qtd: 2 },
      { nome: 'Banheira de Imersão', qtd: 1 }, { nome: 'Frigobar Premium', qtd: 1 }, { nome: 'Cofre', qtd: 1 },
      { nome: 'Mordomia', qtd: 1 }, { nome: 'Wi-Fi', qtd: 1 },
    ],
    servico: {
      tipo: 'pernoite', id: 1801,
      titularNome: 'Roberto Lima', tipoAcomodacao: 'Casal',
      periodo: '27/02/2026 - 02/03/2026',
      chegadaPrevista: '27/02/2026 14:00', saidaPrevista: '02/03/2026 12:00',
      status: PERNOITE_STATUS.DIARIA_ENCERRADA,
      totalDiarias: 3, diariaAtual: 2,
      valorTotal: 1350, totalPago: 1350, pagamentoPendente: 0,
      hospedes: [
        { id: 6, nome: 'Roberto Lima',   cpf: '444.333.222-11', telefone: '(98) 94444-4444' },
        { id: 5, nome: 'Fernanda Souza', cpf: '999.888.777-66', telefone: '(98) 95555-5555' },
      ],
      consumos: [
        { id: 18001, categoria: 'Bebidas', item: 'Vinho Tinto 375ml', quantidade: 1, valorUnitario: 80, valorTotal: 80 },
      ],
      pagamentos: [
        { id: 17001, descricao: 'Pagamento integral', formaPagamento: 'Cartão de Crédito', valor: 1350, data: '27/02/2026 14:30' },
      ],
      diarias: [
        { idx: 0, num: 1, dataInicio: '27/02/2026 14:00', dataFim: '28/02/2026 12:00', valor: 450,
          hospedes: [{ nome: 'Roberto Lima', cpf: '444.333.222-11' }, { nome: 'Fernanda Souza', cpf: '999.888.777-66' }],
          consumos: [], pagamentos: [{ descricao: 'Pagamento integral', forma: 'Cartão de Crédito', valor: 1350 }] },
        { idx: 1, num: 2, dataInicio: '28/02/2026 12:00', dataFim: '01/03/2026 12:00', valor: 450,
          hospedes: [{ nome: 'Roberto Lima', cpf: '444.333.222-11' }, { nome: 'Fernanda Souza', cpf: '999.888.777-66' }],
          consumos: [{ item: 'Vinho Tinto 375ml', qtd: 1, valor: 80 }], pagamentos: [] },
        { idx: 2, num: 3, dataInicio: '01/03/2026 12:00', dataFim: '02/03/2026 12:00', valor: 450,
          hospedes: [{ nome: 'Roberto Lima', cpf: '444.333.222-11' }, { nome: 'Fernanda Souza', cpf: '999.888.777-66' }],
          consumos: [], pagamentos: [] },
      ],
    },
  },
  {
    id: 19, numero: '19', categoriaId: 3, categoria: 'Suíte', tipoOcupacao: 'Triplo',
    descricao: 'Suíte em reforma completa do banheiro.',
    camas: { casal: 1, solteiro: 0, beliche: 0, rede: 0 },
    status: ROOM_STATUS.FORA_DE_SERVICO,
    servico: null, limpeza: null,
    itens: [
      { nome: 'Cama King', qtd: 1 }, { nome: 'TV 65" 4K', qtd: 1 }, { nome: 'Ar-Condicionado', qtd: 2 },
      { nome: 'Banheira de Imersão', qtd: 1 }, { nome: 'Frigobar Premium', qtd: 1 }, { nome: 'Wi-Fi', qtd: 1 },
    ],
    manutencao: { responsavel: 'Equipe Técnica', descricao: 'Reforma geral do banheiro e troca de azulejos.', previsaoFim: '15/03/2026' },
  },
  {
    id: 20, numero: '20', categoriaId: 3, categoria: 'Suíte', tipoOcupacao: 'Casal',
    descricao: 'Suíte executiva com banheira de imersão e varanda privativa.',
    camas: { casal: 1, solteiro: 0, beliche: 0, rede: 0 },
    status: ROOM_STATUS.DISPONIVEL,
    servico: null, limpeza: null, manutencao: null,
    itens: [
      { nome: 'Cama King', qtd: 1 }, { nome: 'TV 65" 4K', qtd: 1 }, { nome: 'Ar-Condicionado', qtd: 2 },
      { nome: 'Banheira de Imersão', qtd: 1 }, { nome: 'Frigobar Premium', qtd: 1 }, { nome: 'Cofre', qtd: 1 },
      { nome: 'Varanda Privativa', qtd: 1 }, { nome: 'Wi-Fi', qtd: 1 },
    ],
  },
  {
    id: 21, numero: '21', categoriaId: 3, categoria: 'Suíte', tipoOcupacao: 'Casal',
    descricao: 'Suíte presidencial com serviço de mordomia.',
    camas: { casal: 1, solteiro: 0, beliche: 0, rede: 0 },
    status: ROOM_STATUS.OCUPADO,
    limpeza: null, manutencao: null,
    itens: [
      { nome: 'Cama King', qtd: 1 }, { nome: 'TV 65" 4K', qtd: 2 }, { nome: 'Ar-Condicionado', qtd: 2 },
      { nome: 'Banheira de Imersão', qtd: 1 }, { nome: 'Frigobar Premium', qtd: 1 }, { nome: 'Cofre', qtd: 1 },
      { nome: 'Mordomia', qtd: 1 }, { nome: 'Sala de Estar', qtd: 1 }, { nome: 'Wi-Fi', qtd: 1 },
    ],
    servico: {
      tipo: 'dayuse', id: 2101,
      titularNome: 'Patrícia Gomes',
      dataUso: '28/02/2026', horaEntrada: '10:00', horaSaida: null,
      status: DAYUSE_STATUS.ATIVO,
      horasBase: 2, precoBase: 200, precoAdicional: 40,
      valorTotal: 0, totalPago: 0, pagamentoPendente: 0,
      hospedes: [
        { id: 7, nome: 'Patrícia Gomes', cpf: '777.888.999-00', telefone: '(98) 93333-3333' },
      ],
      consumos: [
        { id: 21001, categoria: 'Serviços', item: 'Frigobar',     quantidade: 1, valorUnitario: 15, valorTotal: 15 },
        { id: 21002, categoria: 'Bebidas',  item: 'Água Mineral', quantidade: 2, valorUnitario:  4, valorTotal:  8 },
      ],
      pagamentos: [],
    },
  },
  {
    id: 22, numero: '22', categoriaId: 3, categoria: 'Suíte', tipoOcupacao: 'Triplo',
    descricao: 'Suíte em manutenção do sistema de climatização.',
    camas: { casal: 1, solteiro: 1, beliche: 0, rede: 0 },
    status: ROOM_STATUS.MANUTENCAO,
    servico: null, limpeza: null,
    itens: [
      { nome: 'Cama King', qtd: 1 }, { nome: 'Cama Solteiro', qtd: 1 }, { nome: 'TV 65" 4K', qtd: 1 },
      { nome: 'Ar-Condicionado', qtd: 2 }, { nome: 'Banheira de Imersão', qtd: 1 }, { nome: 'Wi-Fi', qtd: 1 },
    ],
    manutencao: { responsavel: 'João Técnico', descricao: 'Troca completa do sistema de ar-condicionado.', previsaoFim: '05/03/2026' },
  },
];

// ── Mock API ──────────────────────────────────────────────────────────────────
export const overviewApi = {
  async listar() {
    await delay();
    return clone(_quartos);
  },

  async marcarDisponivel(id) {
    await delay();
    _quartos = _quartos.map((q) =>
      q.id !== id ? q : { ...q, status: ROOM_STATUS.DISPONIVEL, servico: null, limpeza: null, manutencao: null }
    );
    return clone(_quartos.find((q) => q.id === id));
  },

  async marcarLimpeza(id, data = {}) {
    await delay();
    _quartos = _quartos.map((q) =>
      q.id !== id ? q : { ...q, status: ROOM_STATUS.LIMPEZA, limpeza: { responsavel: data.responsavel || '', inicio: data.inicio || '' }, manutencao: null }
    );
    return clone(_quartos.find((q) => q.id === id));
  },

  async marcarManutencao(id, data = {}) {
    await delay();
    _quartos = _quartos.map((q) =>
      q.id !== id ? q : { ...q, status: ROOM_STATUS.MANUTENCAO, manutencao: { responsavel: data.responsavel || '', descricao: data.descricao || '', previsaoFim: data.previsaoFim || '' }, limpeza: null }
    );
    return clone(_quartos.find((q) => q.id === id));
  },

  async marcarForaDeServico(id, data = {}) {
    await delay();
    _quartos = _quartos.map((q) =>
      q.id !== id ? q : { ...q, status: ROOM_STATUS.FORA_DE_SERVICO, manutencao: { responsavel: data.responsavel || '', descricao: data.descricao || '', previsaoFim: data.previsaoFim || '' }, limpeza: null }
    );
    return clone(_quartos.find((q) => q.id === id));
  },

  async criarPernoite(id, servicoData) {
    await delay();
    _quartos = _quartos.map((q) =>
      q.id !== id ? q : { ...q, status: ROOM_STATUS.OCUPADO, servico: { ...clone(servicoData), tipo: 'pernoite', id: nextId() } }
    );
    return clone(_quartos.find((q) => q.id === id));
  },

  async criarDayUse(id, servicoData) {
    await delay();
    _quartos = _quartos.map((q) =>
      q.id !== id ? q : { ...q, status: ROOM_STATUS.OCUPADO, servico: { ...clone(servicoData), tipo: 'dayuse', id: nextId() } }
    );
    return clone(_quartos.find((q) => q.id === id));
  },

  async encerrarDayUse(id, { horaSaida, valorTotal, pagamentoPendente }) {
    await delay();
    _quartos = _quartos.map((q) => {
      if (q.id !== id || !q.servico) return q;
      return { ...q, servico: { ...q.servico, horaSaida, valorTotal, pagamentoPendente, status: DAYUSE_STATUS.ENCERRADO } };
    });
    return clone(_quartos.find((q) => q.id === id));
  },

  async finalizarServico(id) {
    await delay();
    const q = _quartos.find((r) => r.id === id);
    if (!q || !q.servico) throw new Error('Serviço não encontrado');
    const servico = clone(q.servico);
    if (servico.tipo === 'pernoite') {
      servico.status = servico.pagamentoPendente > 0 ? PERNOITE_STATUS.FINALIZADO_PENDENTE : PERNOITE_STATUS.FINALIZADO;
    } else if (servico.tipo === 'dayuse') {
      servico.status = servico.pagamentoPendente > 0 ? DAYUSE_STATUS.FINALIZADO_PENDENTE : DAYUSE_STATUS.FINALIZADO;
    }
    _quartos = _quartos.map((r) =>
      r.id !== id ? r : { ...r, status: ROOM_STATUS.LIMPEZA, limpeza: { responsavel: '', inicio: '' }, servico }
    );
    return clone(_quartos.find((r) => r.id === id));
  },

  async cancelarServico(id) {
    await delay();
    _quartos = _quartos.map((q) => {
      if (q.id !== id || !q.servico) return q;
      const servico = clone(q.servico);
      if (servico.tipo === 'pernoite') servico.status = PERNOITE_STATUS.CANCELADO;
      else if (servico.tipo === 'dayuse') servico.status = DAYUSE_STATUS.CANCELADO;
      return { ...q, status: ROOM_STATUS.DISPONIVEL, servico };
    });
    return clone(_quartos.find((q) => q.id === id));
  },

  async adicionarPagamento(id, pagamento) {
    await delay();
    const q = _quartos.find((r) => r.id === id);
    if (!q?.servico) throw new Error('Serviço não encontrado');
    const novoPago = q.servico.totalPago + pagamento.valor;
    _quartos = _quartos.map((r) => {
      if (r.id !== id) return r;
      const servico = {
        ...r.servico,
        totalPago: novoPago,
        pagamentoPendente: Math.max(0, r.servico.valorTotal - novoPago),
        pagamentos: [...r.servico.pagamentos, { ...clone(pagamento), id: nextId() }],
      };
      return { ...r, servico };
    });
    return clone(_quartos.find((r) => r.id === id));
  },
};
