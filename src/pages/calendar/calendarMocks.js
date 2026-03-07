// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmt = (d) => {
  const y  = d.getFullYear();
  const m  = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
};

export const addDaysStr = (dateStr, n) => {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return fmt(d);
};

const delay = () => new Promise((r) => setTimeout(r, 250));

let _nextId = 500;
const nextId = () => ++_nextId;

// Deterministic pseudo-random in [0,1) based on seed
const rng = (seed) => ((seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;

// ─── Static data ─────────────────────────────────────────────────────────────
export const CATEGORIAS = [
  { id: 1, nome: 'Standard', quartos: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
  { id: 2, nome: 'Luxo',     quartos: [11, 12, 13, 14, 15, 16, 17, 18] },
  { id: 3, nome: 'Suíte',   quartos: [19, 20, 21, 22, 23, 24] },
  { id: 4, nome: 'Premium', quartos: [25, 26, 27, 28, 29, 30] },
];

const NAMES = [
  'João Silva', 'Ana Costa', 'Carlos Mendes', 'Roberto Lima',
  'Beatriz Souza', 'Fernando Alves', 'Patricia Santos', 'Gabriel Costa',
  'Marcos Oliveira', 'Larissa Ferreira', 'Diego Martins', 'Camila Rocha',
  'Rafael Almeida', 'Juliana Nunes', 'Thiago Carvalho', 'Isabela Moraes',
  'Lucas Pereira', 'Amanda Lima', 'Felipe Gomes', 'Mariana Silva',
  'Ricardo Ferreira', 'Priscila Rodrigues', 'Eduardo Nascimento', 'Natalia Araújo',
  'Bruno Ribeiro', 'Vanessa Oliveira', 'Gustavo Martins', 'Renata Costa',
  'André Pereira', 'Cláudia Santos', 'Paulo Mendes', 'Helena Lima',
];

const COMPANIES = [
  null, null, null, null,
  'Acme Corp', null, null, 'Tech Solutions',
  null, null, 'Grupo Hotels', null,
  null, 'Viagens & Cia', null, null,
];

// ─── Generate dense mock reservations ────────────────────────────────────────
function generateReservations() {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const T = fmt(today);
  const allRooms = CATEGORIAS.flatMap((c) => c.quartos);
  const result = [];
  let id = 1;

  for (const room of allRooms) {
    let cursor = addDaysStr(T, -25); // start 25 days ago
    let seq = 0;

    while (true) {
      const seed = room * 1000 + seq;
      // Gap between reservations: 0–2 days
      const gap = Math.floor(rng(seed) * 3);
      cursor = addDaysStr(cursor, gap);

      // Stop if we've gone 65+ days past today
      const daysFromToday = Math.round(
        (new Date(cursor + 'T00:00:00') - today) / 86400000
      );
      if (daysFromToday > 65) break;

      // Duration: 1–6 nights (weighted toward 2–4)
      const durSeed = rng(seed + 1);
      const duration = durSeed < 0.15 ? 1
        : durSeed < 0.45 ? 2
        : durSeed < 0.70 ? 3
        : durSeed < 0.85 ? 5
        : 6;

      const fim = addDaysStr(cursor, duration);

      const nameIdx = (id + room) % NAMES.length;
      const compIdx = (id * 3 + room) % COMPANIES.length;
      const cat = CATEGORIAS.find((c) => c.quartos.includes(room));

      const isCurrentlyStaying = cursor <= T && fim > T;
      const isPast = fim <= T;
      const status = isCurrentlyStaying ? 'hospedado'
        : isPast && rng(seed + 5) < 0.07 ? 'cancelado'
        : isPast ? 'finalizado'
        : rng(seed + 2) < 0.2 ? 'solicitada'
        : 'confirmada';

      const acomp = Math.floor(rng(seed + 3) * 4);
      const hospedes = [{ id: id * 100, nome: NAMES[nameIdx], cpf: '' }];
      for (let i = 0; i < acomp; i++) {
        hospedes.push({ id: id * 100 + i + 1, nome: NAMES[(nameIdx + i + 1) % NAMES.length], cpf: '' });
      }

      const tarifa = cat?.nome === 'Premium' ? 650
        : cat?.nome === 'Suíte' ? 480
        : cat?.nome === 'Luxo' ? 320
        : 160;
      const valorTotal = duration * tarifa;
      const pago = isPast || isCurrentlyStaying
        ? Math.round(valorTotal * (0.5 + rng(seed + 4) * 0.5))
        : Math.round(valorTotal * rng(seed + 4) * 0.5);

      result.push({
        id: id++,
        quarto: room,
        categoria: cat?.nome || '',
        titularNome: NAMES[nameIdx],
        empresaNome: COMPANIES[compIdx] || null,
        quantidadeAcompanhantes: acomp,
        dataInicio: cursor,
        dataFim: fim,
        chegadaPrevista: cursor + ' 14:00',
        saidaPrevista: fim + ' 12:00',
        status,
        hospedes,
        pagamentos: pago > 0 ? [{ id: 1, descricao: 'Sinal', valor: pago, formaPagamento: id % 2 === 0 ? 'PIX' : 'Cartão' }] : [],
        valorTotal,
        totalPago: pago,
      });

      cursor = fim;
      seq++;
    }
  }

  return result;
}

let _reservas = generateReservations();

// ─── Quartos Info (tipo + preco) ──────────────────────────────────────────────
export const QUARTOS_INFO = (() => {
  const tiposByIdx = ['DUPLO', 'TRIPLO', 'DUPLO', 'TRIPLO', 'DUPLO', 'TRIPLO', 'DUPLO', 'TRIPLO', 'DUPLO', 'TRIPLO'];
  const info = {};
  CATEGORIAS.forEach((cat) => {
    cat.quartos.forEach((room, i) => {
      const tipo  = tiposByIdx[i] || 'DUPLO';
      const preco = cat.nome === 'Premium' ? 650
        : cat.nome === 'Suíte'   ? 480
        : cat.nome === 'Luxo'    ? 320
        : 160;
      info[room] = { tipo, preco, categoria: cat.nome };
    });
  });
  return info;
})();

// ─── Hóspedes cadastrados (for search in create modal) ────────────────────────
export const HOSPEDES_CADASTRADOS = [
  { id: 2001, nome: 'João Silva',        cpf: '123.456.789-00' },
  { id: 2002, nome: 'Ana Costa',         cpf: '234.567.890-11' },
  { id: 2003, nome: 'Carlos Mendes',     cpf: '345.678.901-22' },
  { id: 2004, nome: 'Roberto Lima',      cpf: '456.789.012-33' },
  { id: 2005, nome: 'Beatriz Souza',     cpf: '567.890.123-44' },
  { id: 2006, nome: 'Fernando Alves',    cpf: '678.901.234-55' },
  { id: 2007, nome: 'Patricia Santos',   cpf: '789.012.345-66' },
  { id: 2008, nome: 'Gabriel Costa',     cpf: '890.123.456-77' },
  { id: 2009, nome: 'Marcos Oliveira',   cpf: '901.234.567-88' },
  { id: 2010, nome: 'Larissa Ferreira',  cpf: '012.345.678-99' },
  { id: 2011, nome: 'Diego Martins',     cpf: '111.222.333-44' },
  { id: 2012, nome: 'Camila Rocha',      cpf: '222.333.444-55' },
  { id: 2013, nome: 'Rafael Almeida',    cpf: '333.444.555-66' },
  { id: 2014, nome: 'Juliana Nunes',     cpf: '444.555.666-77' },
  { id: 2015, nome: 'Thiago Carvalho',   cpf: '555.666.777-88' },
  { id: 2016, nome: 'Isabela Moraes',    cpf: '666.777.888-99' },
  { id: 2017, nome: 'Lucas Pereira',     cpf: '777.888.999-00' },
  { id: 2018, nome: 'Amanda Lima',       cpf: '888.999.000-11' },
  { id: 2019, nome: 'Felipe Gomes',      cpf: '999.000.111-22' },
  { id: 2020, nome: 'Mariana Silva',     cpf: '000.111.222-33' },
  { id: 2021, nome: 'Ricardo Ferreira',  cpf: '111.333.555-77' },
  { id: 2022, nome: 'Priscila Rodrigues',cpf: '222.444.666-88' },
  { id: 2023, nome: 'Eduardo Nascimento',cpf: '333.555.777-99' },
  { id: 2024, nome: 'Natalia Araújo',    cpf: '444.666.888-00' },
  { id: 2025, nome: 'Bruno Ribeiro',     cpf: '555.777.999-11' },
];

// ─── API (mock) ───────────────────────────────────────────────────────────────
export const calendarApi = {
  async listarReservas() {
    await delay();
    return _reservas.map((r) => ({ ...r }));
  },

  async criarReserva(data) {
    await delay();
    const nova = { ...data, id: nextId() };
    _reservas = [..._reservas, nova];
    return { ...nova };
  },

  async cancelarReserva(id) {
    await delay();
    _reservas = _reservas.filter((r) => r.id !== id);
  },

  async atualizarReserva(id, changes) {
    await delay();
    _reservas = _reservas.map((r) => r.id === id ? { ...r, ...changes } : r);
    return { ..._reservas.find((r) => r.id === id) };
  },
};
