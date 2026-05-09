import { ROOM_STATUS } from './overviewApi';

// ── Currency helpers ──────────────────────────────────────────────────────────
export const fmtBRL = (v) =>
  v == null ? 'R$ 0,00' :
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

export const maskBRL = (v) => {
  const digits = String(v ?? '').replace(/\D/g, '');
  if (!digits) return '';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
    .format(parseInt(digits, 10) / 100);
};

export const parseBRL = (v) =>
  parseFloat(String(v ?? '').replace(/[R$\s.]/g, '').replace(',', '.')) || 0;

// ── Date helpers ──────────────────────────────────────────────────────────────
export const todayStr  = () => new Date().toISOString().slice(0, 10);
export const nowTime   = () => new Date().toTimeString().slice(0, 5);
export const todayDisplay = () => {
  const d = new Date();
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
};
export const dateToDisplay = (d) => {
  if (!d) return '';
  const dt = d instanceof Date ? d : new Date(d);
  return `${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}/${dt.getFullYear()}`;
};
export const displayToDate = (s) => {
  if (!s) return null;
  const [dd, mm, yyyy] = s.split('/');
  return new Date(+yyyy, +mm - 1, +dd);
};
export const isoToDate = (s) => s ? new Date(s.split('T')[0] + 'T12:00:00') : null;
export const dateToISO = (d) => d ? `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` : '';

// ── Elapsed time helpers ──────────────────────────────────────────────────────
export function calcElapsedSeconds(dataUso, horaEntrada, horaSaida = null) {
  if (!dataUso || !horaEntrada) return 0;
  const [d, m, y] = dataUso.split('/');
  const [h, min]  = horaEntrada.split(':');
  const start     = new Date(+y, +m - 1, +d, +h, +min, 0);
  const end = horaSaida
    ? (() => { const [hh, mm2] = horaSaida.split(':'); const e = new Date(+y, +m - 1, +d, +hh, +mm2, 0); return e < start ? new Date(e.getTime() + 86400000) : e; })()
    : new Date();
  return Math.max(0, Math.floor((end - start) / 1000));
}

export const calcElapsedMinutes = (dataUso, ent, sai) => Math.floor(calcElapsedSeconds(dataUso, ent, sai) / 60);

export function calcValorDayUse(precoBase, precoAdicional, horasBase, elapsedMin) {
  if (!precoBase) return 0;
  const base = (horasBase || 2) * 60;
  if (elapsedMin <= base) return precoBase;
  return precoBase + Math.ceil((elapsedMin - base) / 60) * (precoAdicional || 0);
}

export function fmtElapsed(min) {
  if (min <= 0) return '0min';
  const h = Math.floor(min / 60), m = min % 60;
  return h === 0 ? `${m}min` : `${h}h ${String(m).padStart(2, '0')}min`;
}

export function fmtClock(sec) {
  if (sec <= 0) return '00:00';
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
    : `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

// ── Status key → CSS ──────────────────────────────────────────────────────────
export function roomStatusKey(status) {
  switch (status) {
    case ROOM_STATUS.DISPONIVEL:      return 'disponivel';
    case ROOM_STATUS.OCUPADO:         return 'ocupado';
    case ROOM_STATUS.RESERVADO:       return 'reservado';
    case ROOM_STATUS.LIMPEZA:         return 'limpeza';
    case ROOM_STATUS.MANUTENCAO:      return 'manutencao';
    case ROOM_STATUS.FORA_DE_SERVICO: return 'fora';
    default: return 'outro';
  }
}

// ── Filter options ────────────────────────────────────────────────────────────
export const FILTER_OPTIONS = [
  { id: 'todos',     label: 'Todos'           },
  { id: 'disponivel',label: 'Disponível'      },
  { id: 'ocupado',   label: 'Ocupado'         },
  { id: 'reservado', label: 'Reservado'       },
  { id: 'limpeza',   label: 'Limpeza'         },
  { id: 'servico',   label: 'Manutenção/Fora' },
];

// ── Mock itens do quarto ──────────────────────────────────────────────────────
export const MOCK_ITENS_QUARTO = [
  { id: 1, nome: 'Cerveja Heineken 350ml', categoria: 'Bebidas',    preco: 12.00, qtdAtual: 4, qtdBase: 6 },
  { id: 2, nome: 'Água Mineral 500ml',     categoria: 'Bebidas',    preco: 4.50,  qtdAtual: 3, qtdBase: 4 },
  { id: 3, nome: 'Amendoim Salgado 100g',  categoria: 'Petiscos',   preco: 8.00,  qtdAtual: 2, qtdBase: 2 },
  { id: 4, nome: 'Kit Higiene Completo',   categoria: 'Higiene',    preco: 25.00, qtdAtual: 1, qtdBase: 1 },
];
