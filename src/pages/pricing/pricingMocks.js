// ── Simulated network delay ─────────────────────────────────────────────────
const delay = (ms = 220) => new Promise((r) => setTimeout(r, ms));

let _nextId = 100;
const nextId = () => ++_nextId;

const clone = (v) => JSON.parse(JSON.stringify(v));

// ── Quartos (mock — substituir por quartoApi.listar() quando disponível) ────
export const MOCK_QUARTOS = [
  { id: 1,  numero: '01', tipo: 'Standard' },
  { id: 2,  numero: '02', tipo: 'Standard' },
  { id: 3,  numero: '03', tipo: 'Standard' },
  { id: 4,  numero: '04', tipo: 'Standard' },
  { id: 5,  numero: '05', tipo: 'Standard' },
  { id: 6,  numero: '06', tipo: 'Luxo'     },
  { id: 7,  numero: '07', tipo: 'Luxo'     },
  { id: 8,  numero: '08', tipo: 'Luxo'     },
  { id: 9,  numero: '09', tipo: 'Suíte'    },
  { id: 10, numero: '10', tipo: 'Suíte'    },
];

// ── Sazonalidades iniciais ───────────────────────────────────────────────────
let _sazonalidades = [
  {
    id: 1,
    nome: 'Alta Temporada Verão',
    descricao: 'Período de alta demanda no verão',
    modoOperacao: 'data-especifica',
    dataInicio: '2026-12-01', dataFim: '2027-02-28',
    horaInicio: '14:00',      horaFim: '12:00',
    diaIntegral: false, horaInicioCiclo: '', horaFimCiclo: '',
    horaCheckin: '', horaCheckout: '',
    diasSemana: [], diasMes: [], meses: [],
    modeloCobranca: 'Por ocupação', maxPessoas: 5, precoFixo: null,
    precosOcupacao: { 1: 150, 2: 200, 3: 240, 4: 270, 5: 300 },
    dayUse: { ativo: true,  modo: 'padrao', precoFixo: 110, precoAdicional: 20, precosOcupacao: {}, horaAdicionalPorPessoa: 0 },
  },
  {
    id: 2,
    nome: 'Revéillon',
    descricao: 'Virada de ano com tarifas especiais',
    modoOperacao: 'data-especifica',
    dataInicio: '2026-12-28', dataFim: '2027-01-02',
    horaInicio: '15:00',      horaFim: '11:00',
    diaIntegral: false, horaInicioCiclo: '', horaFimCiclo: '',
    horaCheckin: '', horaCheckout: '',
    diasSemana: [], diasMes: [], meses: [],
    modeloCobranca: 'Por ocupação', maxPessoas: 5, precoFixo: null,
    precosOcupacao: { 1: 300, 2: 380, 3: 440, 4: 500, 5: 560 },
    dayUse: { ativo: false, modo: 'padrao', precoFixo: 0, precoAdicional: 0, precosOcupacao: {}, horaAdicionalPorPessoa: 0 },
  },
  {
    id: 3,
    nome: 'Fim de Semana',
    descricao: 'Tarifa especial para finais de semana',
    modoOperacao: 'semanal',
    dataInicio: '', dataFim: '', horaInicio: '', horaFim: '',
    diaIntegral: false, horaInicioCiclo: '', horaFimCiclo: '',
    horaCheckin: '14:00', horaCheckout: '12:00',
    diasSemana: [5, 6], diasMes: [], meses: [],
    modeloCobranca: 'Por ocupação', maxPessoas: 5, precoFixo: null,
    precosOcupacao: { 1: 180, 2: 240, 3: 280, 4: 310, 5: 340 },
    dayUse: { ativo: false, modo: 'padrao', precoFixo: 0, precoAdicional: 0, precosOcupacao: {}, horaAdicionalPorPessoa: 0 },
  },
];

// ── Categorias de preço iniciais ─────────────────────────────────────────────
let _categorias = [
  {
    id: 1,
    nome: 'Standard Até 5 Pessoas',
    descricao: 'Categoria base para quartos standard, cobrando por ocupação.',
    maxPessoas: 5,
    modeloCobranca: 'Por ocupação',
    quartos: [1, 2, 3, 4, 5],
    precoFixo: null,
    precosOcupacao: { 1: 120, 2: 160, 3: 190, 4: 210, 5: 230 },
    dayUse: { ativo: true,  modo: 'padrao', precoFixo: 90,  precoAdicional: 15, precosOcupacao: {}, horaAdicionalPorPessoa: 0 },
    sazonaisAtivas: [1],
  },
  {
    id: 2,
    nome: 'Luxo Até 5 Pessoas',
    descricao: 'Categoria luxo com foco em casais e famílias pequenas.',
    maxPessoas: 5,
    modeloCobranca: 'Por ocupação',
    quartos: [6, 7, 8],
    precoFixo: null,
    precosOcupacao: { 1: 220, 2: 280, 3: 320, 4: 360, 5: 400 },
    dayUse: { ativo: true,  modo: 'padrao', precoFixo: 150, precoAdicional: 25, precosOcupacao: {}, horaAdicionalPorPessoa: 0 },
    sazonaisAtivas: [2],
  },
  {
    id: 3,
    nome: 'Suíte Família',
    descricao: 'Suítes amplas, tarifa fixa por quarto.',
    maxPessoas: 5,
    modeloCobranca: 'Por quarto (tarifa fixa)',
    quartos: [9, 10],
    precoFixo: 450,
    precosOcupacao: null,
    dayUse: { ativo: false, modo: 'padrao', precoFixo: 0,   precoAdicional: 0,  precosOcupacao: {}, horaAdicionalPorPessoa: 0 },
    sazonaisAtivas: [],
  },
];

// ── API simulada ─────────────────────────────────────────────────────────────
export const pricingApi = {
  async listar() {
    await delay(260);
    return { categorias: clone(_categorias), sazonalidades: clone(_sazonalidades) };
  },

  async listarQuartos() {
    await delay(150);
    return clone(MOCK_QUARTOS);
  },

  // ── Categorias ─────────────────────────────────────────────
  async criarCategoria(data) {
    await delay(320);
    const item = { id: nextId(), ...data };
    _categorias.push(item);
    return clone(item);
  },

  async atualizarCategoria(id, data) {
    await delay(320);
    const idx = _categorias.findIndex((c) => c.id === id);
    if (idx === -1) throw new Error('Categoria não encontrada');
    _categorias[idx] = { ..._categorias[idx], ...data };
    return clone(_categorias[idx]);
  },

  async excluirCategoria(id) {
    await delay(200);
    _categorias = _categorias.filter((c) => c.id !== id);
  },

  // ── Sazonalidades ──────────────────────────────────────────
  async criarSazonalidade(data) {
    await delay(320);
    const item = { id: nextId(), ...data };
    _sazonalidades.push(item);
    return clone(item);
  },

  async atualizarSazonalidade(id, data) {
    await delay(320);
    const idx = _sazonalidades.findIndex((s) => s.id === id);
    if (idx === -1) throw new Error('Sazonalidade não encontrada');
    _sazonalidades[idx] = { ..._sazonalidades[idx], ...data };
    return clone(_sazonalidades[idx]);
  },

  async excluirSazonalidade(id) {
    await delay(200);
    // Remove vínculo das categorias
    _categorias = _categorias.map((c) => ({
      ...c,
      sazonaisAtivas: (c.sazonaisAtivas || []).filter((sid) => sid !== id),
    }));
    _sazonalidades = _sazonalidades.filter((s) => s.id !== id);
  },
};
