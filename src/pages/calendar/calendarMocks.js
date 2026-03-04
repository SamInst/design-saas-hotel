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
        : isPast ? 'hospedado'
        : rng(seed + 2) < 0.25 ? 'solicitada'
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
