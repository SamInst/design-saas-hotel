import { useState, useRef, useCallback, useEffect } from "react";
import {
  Calendar, Users, BedDouble, Sun, Moon, Shield, X,
  ChevronDown, ChevronLeft, ChevronRight, Plus, Clock,
  CreditCard, DollarSign, AlertCircle, Check, Edit, Move, Home,
} from "lucide-react";

function formatRoomNumber(num) {
  return num < 10 ? `0${num}` : `${num}`;
}

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDays(dateStr, n) {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + n);
  return formatDate(d);
}

function diffDays(startStr, endStr) {
  return Math.round(
    (new Date(endStr + "T00:00:00") - new Date(startStr + "T00:00:00")) / 86400000
  );
}

const DAY_CELL_W = 120;

const STATUS_COLORS = {
  hospedado: { bg: "bg-slate-500", border: "border-slate-400", text: "text-white", opacity: "opacity-70" },
  confirmada: { bg: "bg-emerald-500", border: "border-emerald-400", text: "text-white", opacity: "opacity-95" },
  solicitada: { bg: "bg-amber-500", border: "border-amber-400", text: "text-white", opacity: "opacity-95" },
};

const INITIAL_RESERVAS = [
  {
    id: 1, quarto: 3, categoria: "Standard", titularNome: "João Silva",
    quantidadeAcompanhantes: 1, dataInicio: "2026-02-15", dataFim: "2026-02-17",
    chegadaPrevista: "2026-02-15 14:00", saidaPrevista: "2026-02-17 12:00",
    status: "hospedado",
    hospedes: [{ id: 1, nome: "João Silva", cpf: "123.456.789-00" }, { id: 2, nome: "Maria Silva", cpf: "987.654.321-00" }],
    pagamentos: [{ id: 1, descricao: "Sinal 50%", valor: 160, formaPagamento: "PIX" }],
    valorTotal: 320, totalPago: 160,
  },
  {
    id: 2, quarto: 6, categoria: "Luxo", titularNome: "Ana Costa",
    quantidadeAcompanhantes: 0, dataInicio: "2026-02-10", dataFim: "2026-02-19",
    chegadaPrevista: "2026-02-10 15:00", saidaPrevista: "2026-02-19 12:00",
    status: "hospedado",
    hospedes: [{ id: 3, nome: "Ana Costa", cpf: "111.222.333-44" }],
    pagamentos: [{ id: 1, descricao: "Pagamento integral", valor: 2520, formaPagamento: "Cartão" }],
    valorTotal: 2520, totalPago: 2520,
  },
  {
    id: 3, quarto: 1, categoria: "Standard", titularNome: "Carlos Mendes",
    quantidadeAcompanhantes: 3, dataInicio: "2026-02-18", dataFim: "2026-02-22",
    chegadaPrevista: "2026-02-18 14:00", saidaPrevista: "2026-02-22 12:00",
    status: "confirmada",
    hospedes: [
      { id: 4, nome: "Carlos Mendes", cpf: "555.666.777-88" },
      { id: 5, nome: "Fernanda Mendes", cpf: "999.888.777-66" },
      { id: 6, nome: "Pedro Mendes", cpf: "444.333.222-11" },
      { id: 7, nome: "Laura Mendes", cpf: "222.111.000-99" },
    ],
    pagamentos: [],
    valorTotal: 640, totalPago: 0,
  },
  {
    id: 4, quarto: 9, categoria: "Suíte", titularNome: "Roberto Lima",
    quantidadeAcompanhantes: 1, dataInicio: "2026-02-20", dataFim: "2026-02-25",
    chegadaPrevista: "2026-02-20 14:00", saidaPrevista: "2026-02-25 12:00",
    status: "confirmada",
    hospedes: [
      { id: 8, nome: "Roberto Lima", cpf: "333.222.111-00" },
      { id: 9, nome: "Julia Lima", cpf: "111.000.999-88" },
    ],
    pagamentos: [{ id: 1, descricao: "Entrada", valor: 920, formaPagamento: "PIX" }],
    valorTotal: 2300, totalPago: 920,
  },
  {
    id: 5, quarto: 7, categoria: "Luxo", titularNome: "Beatriz Souza",
    quantidadeAcompanhantes: 0, dataInicio: "2026-02-22", dataFim: "2026-02-27",
    chegadaPrevista: "2026-02-22 15:00", saidaPrevista: "2026-02-27 12:00",
    status: "solicitada",
    hospedes: [{ id: 10, nome: "Beatriz Souza", cpf: "777.888.999-00" }],
    pagamentos: [],
    valorTotal: 1400, totalPago: 0,
  },
  {
    id: 6, quarto: 2, categoria: "Standard", titularNome: "Fernando Alves",
    quantidadeAcompanhantes: 2, dataInicio: "2026-02-19", dataFim: "2026-02-23",
    chegadaPrevista: "2026-02-19 14:00", saidaPrevista: "2026-02-23 12:00",
    status: "confirmada",
    hospedes: [
      { id: 11, nome: "Fernando Alves", cpf: "444.555.666-77" },
      { id: 12, nome: "Carla Alves", cpf: "888.999.000-11" },
      { id: 13, nome: "Lucas Alves", cpf: "222.333.444-55" },
    ],
    pagamentos: [{ id: 1, descricao: "Entrada 30%", valor: 192, formaPagamento: "Cartão" }],
    valorTotal: 640, totalPago: 192,
  },
  {
    id: 7, quarto: 8, categoria: "Luxo", titularNome: "Patricia Santos",
    quantidadeAcompanhantes: 1, dataInicio: "2026-02-25", dataFim: "2026-03-01",
    chegadaPrevista: "2026-02-25 15:00", saidaPrevista: "2026-03-01 12:00",
    status: "solicitada",
    hospedes: [
      { id: 14, nome: "Patricia Santos", cpf: "666.777.888-99" },
      { id: 15, nome: "Ricardo Santos", cpf: "111.222.333-44" },
    ],
    pagamentos: [],
    valorTotal: 1680, totalPago: 0,
  },
  {
    id: 8, quarto: 10, categoria: "Suíte", titularNome: "Gabriel Costa",
    quantidadeAcompanhantes: 0, dataInicio: "2026-02-28", dataFim: "2026-03-05",
    chegadaPrevista: "2026-02-28 14:00", saidaPrevista: "2026-03-05 12:00",
    status: "confirmada",
    hospedes: [{ id: 16, nome: "Gabriel Costa", cpf: "999.000.111-22" }],
    pagamentos: [{ id: 1, descricao: "Pagamento total", valor: 3220, formaPagamento: "PIX" }],
    valorTotal: 3220, totalPago: 3220,
  },
];

const CATEGORIAS = [
  { id: 1, nome: "Standard", quartos: [1, 2, 3, 4, 5] },
  { id: 2, nome: "Luxo", quartos: [6, 7, 8] },
  { id: 3, nome: "Suíte", quartos: [9, 10] },
];

// ─── MODAL DETALHES ────────────────────────────────────────────────────────
function ReservaDetailsModal({ reserva, onClose, theme, permissions, onCancel }) {
  if (!reserva) return null;
  const sc = STATUS_COLORS[reserva.status] || STATUS_COLORS.confirmada;
  const pendente = reserva.valorTotal - reserva.totalPago;
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[80] p-4" onClick={onClose}>
      <div
        className={`${theme.card} rounded-2xl border shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`p-5 border-b ${theme.divider} flex items-center justify-between`}>
          <div>
            <h3 className={`text-xl font-bold ${theme.text}`}>{reserva.titularNome}</h3>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold mt-1 ${sc.bg} ${sc.text}`}>
              {reserva.status.toUpperCase()}
            </span>
          </div>
          <button onClick={onClose} className={`${theme.textSecondary} hover:text-white`}><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className={`${theme.inputBg} rounded-lg p-3`}>
              <p className={`${theme.textSecondary} text-xs mb-1`}>Quarto</p>
              <p className={`${theme.text} font-bold text-lg`}>#{formatRoomNumber(reserva.quarto)}</p>
              <p className={`${theme.textSecondary} text-xs`}>{reserva.categoria}</p>
            </div>
            <div className={`${theme.inputBg} rounded-lg p-3`}>
              <p className={`${theme.textSecondary} text-xs mb-1`}>Período</p>
              <p className={`${theme.text} font-semibold`}>{reserva.dataInicio}</p>
              <p className={`${theme.textSecondary} text-xs`}>→ {reserva.dataFim} ({diffDays(reserva.dataInicio, reserva.dataFim)} diárias)</p>
            </div>
          </div>

          <div className={`${theme.inputBg} rounded-lg p-3`}>
            <p className={`${theme.textSecondary} text-xs mb-2`}>Horários</p>
            <div className="flex gap-4 text-sm">
              <div><span className={theme.textSecondary}>Check-in: </span><span className={theme.text}>{reserva.chegadaPrevista}</span></div>
              <div><span className={theme.textSecondary}>Check-out: </span><span className={theme.text}>{reserva.saidaPrevista}</span></div>
            </div>
          </div>

          <div className={`${theme.inputBg} rounded-lg p-3`}>
            <p className={`${theme.textSecondary} text-xs mb-2`}>Hóspedes ({reserva.hospedes.length})</p>
            {reserva.hospedes.map((h) => (
              <div key={h.id} className="flex items-center gap-2 mb-1">
                <div className="w-6 h-6 rounded-full bg-violet-500/30 flex items-center justify-center text-[10px] text-violet-300 font-bold">{h.nome[0]}</div>
                <div>
                  <p className={`${theme.text} text-sm font-medium`}>{h.nome}</p>
                  <p className={`${theme.textSecondary} text-xs`}>{h.cpf}</p>
                </div>
              </div>
            ))}
          </div>

          <div className={`${theme.inputBg} rounded-lg p-3`}>
            <div className="flex justify-between items-center mb-2">
              <p className={`${theme.textSecondary} text-xs`}>Financeiro</p>
              {pendente > 0 && <span className="text-amber-400 text-xs font-semibold">⚠ R$ {pendente.toFixed(2)} pendente</span>}
            </div>
            <div className="flex justify-between">
              <span className={theme.textSecondary}>Total:</span>
              <span className={`${theme.text} font-bold`}>R$ {reserva.valorTotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className={theme.textSecondary}>Pago:</span>
              <span className="text-emerald-400 font-semibold">R$ {reserva.totalPago.toFixed(2)}</span>
            </div>
            {reserva.pagamentos.map((p) => (
              <div key={p.id} className={`mt-1 text-xs ${theme.textSecondary}`}>• {p.descricao}: R$ {p.valor.toFixed(2)} ({p.formaPagamento})</div>
            ))}
          </div>
        </div>
        {(permissions.cancelarReserva || permissions.acessoTotal) && (
          <div className={`p-4 border-t ${theme.divider} flex gap-2`}>
            <button
              onClick={() => { onCancel(reserva.id); onClose(); }}
              className="flex-1 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-medium transition-all"
            >
              Cancelar Reserva
            </button>
            <button onClick={onClose} className={`flex-1 px-4 py-2 ${theme.button} ${theme.text} border ${theme.divider} rounded-lg text-sm font-medium transition-all`}>
              Fechar
            </button>
          </div>
        )}
        {!(permissions.cancelarReserva || permissions.acessoTotal) && (
          <div className={`p-4 border-t ${theme.divider}`}>
            <button onClick={onClose} className={`w-full px-4 py-2 ${theme.button} ${theme.text} border ${theme.divider} rounded-lg text-sm font-medium`}>
              Fechar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── MODAL ADICIONAR RESERVA ────────────────────────────────────────────────
function AddReservaModal({ theme, onClose, onSave, initialRoom, initialStart, initialEnd }) {
  const [quarto, setQuarto] = useState(initialRoom || "");
  const [dataInicio, setDataInicio] = useState(initialStart || "");
  const [dataFim, setDataFim] = useState(initialEnd || "");
  const [titular, setTitular] = useState("");
  const [status, setStatus] = useState("confirmada");
  const [valorTotal, setValorTotal] = useState("");

  const handleSave = () => {
    if (!quarto || !dataInicio || !dataFim || !titular) return;
    if (dataFim <= dataInicio) return;
    onSave({
      quarto: parseInt(quarto),
      dataInicio,
      dataFim,
      titularNome: titular,
      status,
      valorTotal: parseFloat(valorTotal) || 0,
      totalPago: 0,
      quantidadeAcompanhantes: 0,
      hospedes: [{ id: Date.now(), nome: titular, cpf: "" }],
      pagamentos: [],
      chegadaPrevista: dataInicio + " 14:00",
      saidaPrevista: dataFim + " 12:00",
      categoria: CATEGORIAS.find(c => c.quartos.includes(parseInt(quarto)))?.nome || "",
    });
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[80] p-4" onClick={onClose}>
      <div className={`${theme.card} rounded-2xl border shadow-2xl w-full max-w-md`} onClick={e => e.stopPropagation()}>
        <div className={`p-5 border-b ${theme.divider} flex items-center justify-between`}>
          <h3 className={`text-xl font-bold ${theme.text}`}>Nova Reserva</h3>
          <button onClick={onClose} className={theme.textSecondary}><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className={`block text-xs ${theme.textSecondary} mb-1`}>Quarto</label>
            <select
              value={quarto}
              onChange={e => setQuarto(e.target.value)}
              className={`w-full px-3 py-2 rounded-lg text-sm border focus:outline-none focus:ring-2 focus:ring-violet-500 ${theme.input}`}
            >
              <option value="">Selecione...</option>
              {CATEGORIAS.map(cat => (
                <optgroup key={cat.id} label={cat.nome}>
                  {cat.quartos.map(r => <option key={r} value={r}>Quarto {formatRoomNumber(r)}</option>)}
                </optgroup>
              ))}
            </select>
          </div>
          <div>
            <label className={`block text-xs ${theme.textSecondary} mb-1`}>Titular</label>
            <input
              type="text"
              value={titular}
              onChange={e => setTitular(e.target.value)}
              placeholder="Nome do titular"
              className={`w-full px-3 py-2 rounded-lg text-sm border focus:outline-none focus:ring-2 focus:ring-violet-500 ${theme.input}`}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={`block text-xs ${theme.textSecondary} mb-1`}>Check-in</label>
              <input
                type="date"
                value={dataInicio}
                onChange={e => setDataInicio(e.target.value)}
                className={`w-full px-3 py-2 rounded-lg text-sm border focus:outline-none focus:ring-2 focus:ring-violet-500 ${theme.input}`}
              />
            </div>
            <div>
              <label className={`block text-xs ${theme.textSecondary} mb-1`}>Check-out</label>
              <input
                type="date"
                value={dataFim}
                onChange={e => setDataFim(e.target.value)}
                className={`w-full px-3 py-2 rounded-lg text-sm border focus:outline-none focus:ring-2 focus:ring-violet-500 ${theme.input}`}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={`block text-xs ${theme.textSecondary} mb-1`}>Status</label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value)}
                className={`w-full px-3 py-2 rounded-lg text-sm border focus:outline-none focus:ring-2 focus:ring-violet-500 ${theme.input}`}
              >
                <option value="confirmada">Confirmada</option>
                <option value="solicitada">Solicitada</option>
                <option value="hospedado">Hospedado</option>
              </select>
            </div>
            <div>
              <label className={`block text-xs ${theme.textSecondary} mb-1`}>Valor Total (R$)</label>
              <input
                type="number"
                value={valorTotal}
                onChange={e => setValorTotal(e.target.value)}
                placeholder="0.00"
                className={`w-full px-3 py-2 rounded-lg text-sm border focus:outline-none focus:ring-2 focus:ring-violet-500 ${theme.input}`}
              />
            </div>
          </div>
        </div>
        <div className={`p-4 border-t ${theme.divider} flex gap-2`}>
          <button onClick={onClose} className={`flex-1 px-4 py-2 ${theme.button} ${theme.text} border ${theme.divider} rounded-lg text-sm font-medium`}>
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={!quarto || !dataInicio || !dataFim || !titular}
            className="flex-1 px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white rounded-lg text-sm font-medium transition-all"
          >
            Criar Reserva
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── MODAL PERMISSÕES ────────────────────────────────────────────────────────
function PermissoesModal({ theme, permissions, setPermissions, onClose }) {
  const toggle = (key) => setPermissions(p => ({ ...p, [key]: !p[key] }));
  const perms = [
    { key: "acessoTotal", label: "Acesso Total", desc: "Sobrepõe todas as permissões" },
    { key: "dashboard", label: "Ver Dashboard", desc: "Exibe o painel de visão geral" },
    { key: "verCalendario", label: "Ver Calendário", desc: "Acesso ao calendário de reservas" },
    { key: "criarReserva", label: "Criar Reserva", desc: "Permitir criar novas reservas" },
    { key: "editarReserva", label: "Editar/Redimensionar", desc: "Arrastar bordas para ajustar período" },
    { key: "moverReserva", label: "Mover Reserva", desc: "Arrastar reserva para outro quarto/data" },
    { key: "cancelarReserva", label: "Cancelar Reserva", desc: "Remover reservas do sistema" },
  ];
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[80] p-4" onClick={onClose}>
      <div className={`${theme.card} rounded-2xl border shadow-2xl w-full max-w-md`} onClick={e => e.stopPropagation()}>
        <div className={`p-5 border-b ${theme.divider} flex items-center justify-between`}>
          <h3 className={`text-xl font-bold ${theme.text}`}>Permissões de Acesso</h3>
          <button onClick={onClose} className={theme.textSecondary}><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-2">
          {perms.map(p => (
            <div key={p.key} className={`flex items-center justify-between p-3 rounded-lg ${theme.inputBg}`}>
              <div>
                <p className={`${theme.text} text-sm font-semibold`}>{p.label}</p>
                <p className={`${theme.textSecondary} text-xs`}>{p.desc}</p>
              </div>
              <button
                onClick={() => toggle(p.key)}
                className={`w-11 h-6 rounded-full transition-all duration-200 ${permissions[p.key] ? "bg-violet-600" : "bg-slate-600"}`}
              >
                <div className={`w-4 h-4 rounded-full bg-white transition-transform mx-1 ${permissions[p.key] ? "translate-x-5" : "translate-x-0"}`} />
              </button>
            </div>
          ))}
        </div>
        <div className={`p-4 border-t ${theme.divider}`}>
          <button onClick={onClose} className="w-full px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-medium">
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
export default function BookingCalendar() {
  const [isDark, setIsDark] = useState(true);
  const today = new Date(); today.setHours(0, 0, 0, 0);

  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const [collapsed, setCollapsed] = useState({});

  // Start from yesterday
  const getYesterday = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    d.setHours(0, 0, 0, 0);
    return d;
  };

  const [startDate, setStartDate] = useState(getYesterday());
  const [reservas, setReservas] = useState(INITIAL_RESERVAS);
  const [collapsedCategories, setCollapsedCategories] = useState({});
  const [notification, setNotification] = useState(null);
  const [permissions, setPermissions] = useState({
    acessoTotal: true, dashboard: true, verCalendario: true,
    criarReserva: true, editarReserva: true, moverReserva: true, cancelarReserva: true,
  });

  // Modals
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedReserva, setSelectedReserva] = useState(null);

  // New reservation via calendar click
  const [selRoom, setSelRoom] = useState(null);
  const [selStart, setSelStart] = useState(null);
  const [selEnd, setSelEnd] = useState(null);
  const [addModalInit, setAddModalInit] = useState({ room: null, start: null, end: null });

  // Drag-move state
  const [movingId, setMovingId] = useState(null);
  // Drag-resize state
  const [resizeState, setResizeState] = useState(null); // { id, direction, origStart, origEnd }
  const [ghostReserva, setGhostReserva] = useState(null); // { id, dataInicio, dataFim, quarto }
  const [pendingConfirm, setPendingConfirm] = useState(null);

  const scrollRef = useRef(null);
  const VISIBLE_DAYS = 30;

  const days = Array.from({ length: VISIBLE_DAYS }, (_, i) => {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    return d;
  });

  const todayStr = formatDate(new Date());
  const can = (key) => permissions.acessoTotal || permissions[key];

  const notify = useCallback((message, type = "info") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  }, []);

  // Navigate days
  const shiftDays = (n) => {
    setStartDate(d => {
      const nd = new Date(d);
      nd.setDate(nd.getDate() + n);
      return nd;
    });
  };

  const theme = {
    bg: isDark ? "bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950" : "bg-gradient-to-br from-slate-100 via-white to-slate-200",
    text: isDark ? "text-white" : "text-slate-900",
    textSecondary: isDark ? "text-slate-400" : "text-slate-500",
    card: isDark ? "bg-slate-800/60 border-white/10" : "bg-white border-slate-200",
    cardHdr: isDark ? "bg-slate-900/80" : "bg-slate-50",
    inputBg: isDark ? "bg-slate-700/50" : "bg-slate-100",
    input: isDark ? "bg-slate-700 border-slate-600 text-white placeholder-slate-400" : "bg-slate-50 border-slate-300 text-slate-900",
    divider: isDark ? "border-white/10" : "border-slate-200",
    button: isDark ? "bg-slate-700 hover:bg-slate-600 border-slate-600" : "bg-slate-100 hover:bg-slate-200 border-slate-300",
    rowBg: isDark ? "bg-slate-900/40" : "bg-white",
    rowAlt: isDark ? "bg-slate-800/30" : "bg-slate-50/50",
    catRow: isDark ? "bg-violet-950/60" : "bg-violet-50",
    headerBg: isDark ? "bg-slate-900" : "bg-slate-100",
    todayBg: isDark ? "bg-violet-900/30" : "bg-violet-100",
    weekendBg: isDark ? "bg-rose-950/30" : "bg-rose-50",
    cellHover: isDark ? "hover:bg-white/5" : "hover:bg-slate-100",
    selBg: isDark ? "bg-violet-500/25 ring-2 ring-inset ring-violet-500" : "bg-violet-100 ring-2 ring-inset ring-violet-500",
  };

  // ── Calendar click: select range per room ──
  const handleCellClick = (room, dateStr) => {
    if (!can("criarReserva")) { notify("Sem permissão para criar reservas.", "error"); return; }
    if (movingId) {
      // place the moving reservation here
      const r = reservas.find(x => x.id === movingId);
      if (!r) { setMovingId(null); return; }
      const days_ = diffDays(r.dataInicio, r.dataFim);
      const newEnd = addDays(dateStr, days_);
      const conflict = reservas.some(x => x.id !== r.id && x.quarto === room && x.dataInicio < newEnd && x.dataFim > dateStr);
      if (conflict) { notify("Conflito de reservas neste período.", "error"); setMovingId(null); return; }
      setReservas(rs => rs.map(x => x.id === r.id ? { ...x, quarto: room, dataInicio: dateStr, dataFim: newEnd, categoria: CATEGORIAS.find(c => c.quartos.includes(room))?.nome || x.categoria } : x));
      notify(`Reserva movida para quarto ${formatRoomNumber(room)}, ${dateStr} → ${newEnd}`, "success");
      setMovingId(null);
      setGhostReserva(null);
      return;
    }

    if (selRoom !== room) {
      setSelRoom(room);
      setSelStart(dateStr);
      setSelEnd(null);
      return;
    }
    if (!selStart) {
      setSelStart(dateStr);
      return;
    }
    if (!selEnd) {
      if (dateStr > selStart) {
        // Open add modal with prefilled values
        setAddModalInit({ room, start: selStart, end: dateStr });
        setShowAddModal(true);
        setSelRoom(null); setSelStart(null); setSelEnd(null);
      } else if (dateStr < selStart) {
        setSelStart(dateStr);
      } else {
        setSelRoom(null); setSelStart(null); setSelEnd(null);
      }
      return;
    }
    setSelRoom(room);
    setSelStart(dateStr);
    setSelEnd(null);
  };

  const isCellSelected = (room, dateStr) => {
    if (selRoom !== room || !selStart) return false;
    if (!selEnd) return dateStr === selStart;
    return dateStr >= selStart && dateStr < selEnd;
  };

  // ── Reservation rendering ──
  const getReservasForRow = (room) => reservas.filter(r => r.quarto === room);

  const getDisplayReserva = (reservaId) => ghostReserva?.id === reservaId ? ghostReserva : reservas.find(r => r.id === reservaId);

  // ── Click on reservation bar ──
  const handleBarClick = (e, reserva) => {
    e.stopPropagation();
    if (movingId === reserva.id) {
      setMovingId(null);
      setGhostReserva(null);
      notify("Movimentação cancelada.", "info");
      return;
    }
    setSelectedReserva(reserva);
  };

  // ── Double-click activates move ──
  const handleBarDblClick = (e, reserva) => {
    e.stopPropagation();
    if (!can("moverReserva")) { notify("Sem permissão para mover reservas.", "error"); return; }
    setMovingId(reserva.id);
    setGhostReserva(null);
    notify(`Clique na célula de destino para mover "${reserva.titularNome}"`, "info");
  };

  // ── Resize handles: mousedown → global mousemove/mouseup ──
  const handleResizeMouseDown = (e, reserva, direction) => {
    e.preventDefault();
    e.stopPropagation();
    if (!can("editarReserva")) { notify("Sem permissão para editar reservas.", "error"); return; }
    setResizeState({ id: reserva.id, direction, origStart: reserva.dataInicio, origEnd: reserva.dataFim, quarto: reserva.quarto });
    setGhostReserva({ ...reserva });
  };

  const handleCellMouseEnter = (room, dateStr) => {
    if (!resizeState) return;
    if (resizeState.quarto !== room) return;
    const g = ghostReserva || reservas.find(r => r.id === resizeState.id);
    if (!g) return;
    if (resizeState.direction === "start") {
      if (dateStr < resizeState.origEnd) {
        setGhostReserva({ ...g, dataInicio: dateStr });
      }
    } else {
      const nextDay = addDays(dateStr, 1);
      if (nextDay > resizeState.origStart) {
        setGhostReserva({ ...g, dataFim: nextDay });
      }
    }
  };

  const handleMouseUp = useCallback(() => {
    if (!resizeState) return;
    const g = ghostReserva;
    if (g && g.dataInicio !== resizeState.origStart || g && g.dataFim !== resizeState.origEnd) {
      const days_ = diffDays(g.dataInicio, g.dataFim);
      setReservas(rs => rs.map(r => r.id === resizeState.id ? { ...r, dataInicio: g.dataInicio, dataFim: g.dataFim } : r));
      notify(`Período ajustado: ${g.dataInicio} → ${g.dataFim} (${days_} diárias)`, "success");
    }
    setResizeState(null);
    setGhostReserva(null);
  }, [resizeState, ghostReserva, notify]);

  useEffect(() => {
    window.addEventListener("mouseup", handleMouseUp);
    return () => window.removeEventListener("mouseup", handleMouseUp);
  }, [handleMouseUp]);

  // ── Stats ──
  const stats = {
    total: reservas.length,
    solicitadas: reservas.filter(r => r.status === "solicitada").length,
    confirmadas: reservas.filter(r => r.status === "confirmada").length,
    hospedados: reservas.filter(r => r.status === "hospedado").length,
    ocupados: reservas.filter(r => r.dataInicio <= todayStr && r.dataFim > todayStr).length,
    totalQuartos: CATEGORIAS.reduce((s, c) => s + c.quartos.length, 0),
  };

  // ── Render reservation bars for a given room/day window ──
  const renderBars = (room) => {
    const roomReservas = getReservasForRow(room);
    const daysStrings = days.map(d => formatDate(d));
    const firstDayStr = daysStrings[0];
    const lastDayStr = daysStrings[daysStrings.length - 1];

    return roomReservas.map(reserva => {
      const display = (ghostReserva?.id === reserva.id) ? ghostReserva : reserva;
      const { dataInicio, dataFim } = display;

      // Check if visible
      if (dataFim <= firstDayStr || dataInicio > lastDayStr) return null;

      const clampedStart = dataInicio < firstDayStr ? firstDayStr : dataInicio;
      const clampedEnd = dataFim > addDays(lastDayStr, 1) ? addDays(lastDayStr, 1) : dataFim;

      const startIdx = daysStrings.indexOf(clampedStart);
      const endIdx = daysStrings.indexOf(addDays(clampedEnd, -1));
      const span = diffDays(clampedStart, clampedEnd);

      if (startIdx < 0 || span <= 0) return null;

      const sc = STATUS_COLORS[reserva.status] || STATUS_COLORS.confirmada;
      const isMoving = movingId === reserva.id;
      const isResizing = resizeState?.id === reserva.id;
      const isClipped = dataInicio < firstDayStr;
      const isClippedEnd = dataFim > addDays(lastDayStr, 1);
      const totalDays = diffDays(reserva.dataInicio, reserva.dataFim);
      const pendente = reserva.valorTotal - reserva.totalPago;

      return (
        <div
          key={reserva.id}
          className={`absolute top-2 bottom-2 ${sc.bg} ${sc.opacity} ${isMoving ? "ring-4 ring-amber-400 animate-pulse" : ""} ${isResizing ? "ring-2 ring-blue-400" : ""} flex items-center cursor-pointer hover:brightness-110 transition-all shadow-lg select-none z-10`}
          style={{
            left: `${startIdx * DAY_CELL_W + (isClipped ? 0 : 8)}px`,
            width: `${span * DAY_CELL_W - (isClipped ? 0 : 8) - (isClippedEnd ? 0 : 8)}px`,
            borderRadius: `${isClipped ? 0 : 10}px ${isClippedEnd ? 0 : 10}px ${isClippedEnd ? 0 : 10}px ${isClipped ? 0 : 10}px`,
          }}
          onClick={(e) => handleBarClick(e, reserva)}
          onDoubleClick={(e) => handleBarDblClick(e, reserva)}
        >
          {/* Left resize handle */}
          {!isClipped && (
            <div
              onMouseDown={(e) => handleResizeMouseDown(e, reserva, "start")}
              className="absolute left-0 top-0 bottom-0 w-3 cursor-ew-resize bg-black/20 hover:bg-black/40 rounded-l-[10px] flex items-center justify-center z-20"
              onClick={e => e.stopPropagation()}
            >
              <div className="w-0.5 h-4 bg-white/60 rounded-full" />
            </div>
          )}

          {/* Content */}
          <div className="flex-1 px-4 py-1 overflow-hidden min-w-0">
            <div className="text-white text-xs font-bold truncate leading-tight">{reserva.titularNome}</div>
            <div className="text-white/80 text-[10px] truncate leading-tight">
              {reserva.quantidadeAcompanhantes > 0 ? `+${reserva.quantidadeAcompanhantes} · ` : ""}{totalDays} diária{totalDays !== 1 ? "s" : ""}
            </div>
            {reserva.status === "hospedado" && (
              <div className="text-white/90 text-[9px] font-bold leading-tight">🏠 HOSPEDADO</div>
            )}
            {pendente > 0 && (
              <div className="text-amber-200 text-[9px] leading-tight">💰 R${pendente.toFixed(0)} pend.</div>
            )}
          </div>

          {/* Right resize handle */}
          {!isClippedEnd && (
            <div
              onMouseDown={(e) => handleResizeMouseDown(e, reserva, "end")}
              className="absolute right-0 top-0 bottom-0 w-3 cursor-ew-resize bg-black/20 hover:bg-black/40 rounded-r-[10px] flex items-center justify-center z-20"
              onClick={e => e.stopPropagation()}
            >
              <div className="w-0.5 h-4 bg-white/60 rounded-full" />
            </div>
          )}
        </div>
      );
    });
  };

  // ── Cancel reservation ──
  const handleCancelReserva = (id) => {
    setReservas(rs => rs.filter(r => r.id !== id));
    notify("Reserva cancelada.", "success");
  };

  // ── Save new reservation ──
  const handleSaveNew = (data) => {
    const newId = Math.max(...reservas.map(r => r.id), 0) + 1;
    setReservas(rs => [...rs, { id: newId, ...data }]);
    notify("Reserva criada com sucesso!", "success");
    setShowAddModal(false);
    setAddModalInit({ room: null, start: null, end: null });
  };

  const ROOM_H = 80; // px height per room row
  const CAT_H = 40; // px height for category header
  const monthName = new Date(viewYear, viewMonth, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  return (
    <div className={`min-h-screen ${theme.bg} ${theme.text} font-sans`} style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      {/* HEADER */}
      <div className={`sticky top-0 z-50 ${theme.headerBg} border-b ${theme.divider} shadow-xl`}>
        <div className="max-w-[1800px] mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center">
              <BedDouble className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className={`text-base font-bold ${theme.text} leading-tight`}>Calendário de Reservas</h1>
              <p className={`${theme.textSecondary} text-xs`}>Gestão de quartos e hospedagens</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {can("criarReserva") && (
              <button
                onClick={() => { setAddModalInit({ room: null, start: null, end: null }); setShowAddModal(true); }}
                className="px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all"
              >
                <Plus className="w-3.5 h-3.5" /> Nova Reserva
              </button>
            )}
            <button
              onClick={() => setShowPermissionsModal(true)}
              className={`px-3 py-1.5 ${theme.button} ${theme.text} border rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all`}
            >
              <Shield className="w-3.5 h-3.5" /> Permissões
            </button>
            <button
              onClick={() => setIsDark(d => !d)}
              className={`px-3 py-1.5 ${theme.button} ${theme.text} border rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all`}
            >
              {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-[1800px] mx-auto p-4 space-y-4">
        {/* DASHBOARD */}
        {can("dashboard") && (
          <div className={`${theme.card} border rounded-xl p-4`}>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {[
                { label: "Total Reservas", val: stats.total, color: "from-violet-600 to-purple-700", icon: <Calendar className="w-4 h-4" /> },
                { label: "Solicitadas", val: stats.solicitadas, color: "from-amber-500 to-orange-600", icon: <AlertCircle className="w-4 h-4" /> },
                { label: "Confirmadas", val: stats.confirmadas, color: "from-emerald-500 to-teal-600", icon: <Check className="w-4 h-4" /> },
                { label: "Hospedados", val: stats.hospedados, color: "from-slate-500 to-slate-600", icon: <Home className="w-4 h-4" /> },
                { label: "Ocupação Hoje", val: `${Math.round(stats.ocupados / stats.totalQuartos * 100)}%`, color: "from-blue-500 to-indigo-600", icon: <BedDouble className="w-4 h-4" /> },
              ].map((s, i) => (
                <div key={i} className={`bg-gradient-to-br ${s.color} rounded-lg p-3 border border-white/10`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-white/80 text-[10px] uppercase font-semibold tracking-wide">{s.label}</span>
                    <span className="text-white/70">{s.icon}</span>
                  </div>
                  <p className="text-2xl font-extrabold text-white">{s.val}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* MOVING INDICATOR */}
        {movingId && (
          <div className="flex items-center gap-3 px-4 py-3 bg-amber-500/20 border border-amber-500/40 rounded-xl">
            <Move className="w-4 h-4 text-amber-400 animate-pulse flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className={`${theme.text} text-sm font-semibold`}>Modo movimentação ativo</p>
              <p className={`${theme.textSecondary} text-xs`}>Clique em qualquer célula vazia para mover a reserva de "{reservas.find(r=>r.id===movingId)?.titularNome}"</p>
            </div>
            <button onClick={() => { setMovingId(null); setGhostReserva(null); }} className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-medium flex-shrink-0">
              Cancelar
            </button>
          </div>
        )}

        {/* SELECTION INDICATOR */}
        {selStart && !showAddModal && (
          <div className="flex items-center gap-3 px-4 py-3 bg-violet-500/20 border border-violet-500/40 rounded-xl">
            <Calendar className="w-4 h-4 text-violet-400 flex-shrink-0" />
            <p className={`${theme.text} text-sm`}>
              Quarto {formatRoomNumber(selRoom)} selecionado a partir de <strong>{selStart}</strong> — clique em outra data para definir o fim
            </p>
            <button onClick={() => { setSelRoom(null); setSelStart(null); setSelEnd(null); }} className={`px-3 py-1 ${theme.button} ${theme.text} border ${theme.divider} rounded text-xs flex-shrink-0`}>
              Limpar
            </button>
          </div>
        )}

        {/* CALENDAR */}
        {can("verCalendario") && (
          <div className={`${theme.card} border rounded-xl overflow-hidden`}>
            {/* Navigation bar */}
            <div className={`${theme.cardHdr} border-b ${theme.divider} px-4 py-2.5 flex items-center justify-between gap-2`}>
              <button onClick={() => shiftMonth(-1)} className={`${theme.btnSec} rounded-xl px-3 py-2`}><ChevronLeft className="w-4 h-4" /></button>
              <span className={`${theme.text} text-base font-black capitalize min-w-[200px] text-center`}>{monthName}</span>
              <button onClick={() => shiftMonth(1)} className={`${theme.btnSec} rounded-xl px-3 py-2`}><ChevronRight className="w-4 h-4" /></button>
              <button onClick={() => { setViewYear(today.getFullYear()); setViewMonth(today.getMonth()); }} className="px-3 py-2 bg-violet-600/70 hover:bg-violet-600 text-white rounded-xl text-sm font-bold">Hoje</button>
              <button onClick={() => { setJumpVal(`${viewYear}-${String(viewMonth + 1).padStart(2, "0")}`); setShowJump(true); }} className={`${theme.btnSec} rounded-xl px-3 py-2 flex items-center gap-1.5 text-sm font-bold`}>
                <Calendar className="w-4 h-4" /> Ir para mês
              </button>

  

              <span className={`${theme.textSecondary} text-xs hidden sm:block`}>
                {days[0]?.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} – {days[days.length-1]?.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
              </span>
            </div>

            {/* Grid */}
            <div className="flex overflow-hidden">
              {/* Room labels column — fixed */}
              <div className="flex-shrink-0 w-32 border-r border-white/10" style={{ zIndex: 20 }}>
                {/* top-left corner */}
                <div className={`${theme.cardHdr} border-b ${theme.divider} flex items-center px-3`} style={{ height: 52 }}>
                  <span className={`${theme.textSecondary} text-xs font-semibold uppercase`}>Quarto</span>
                </div>
                {CATEGORIAS.map(cat => {
                  const isCollapsed = collapsedCategories[cat.nome];
                  return (
                    <div key={cat.id}>
                      <div
                        onClick={() => setCollapsedCategories(prev => ({ ...prev, [cat.nome]: !prev[cat.nome] }))}
                        className={`${theme.catRow} border-b ${theme.divider} flex items-center px-3 cursor-pointer`}
                        style={{ height: CAT_H }}
                      >
                        <ChevronDown className={`w-3.5 h-3.5 text-violet-400 mr-1.5 transition-transform ${isCollapsed ? "-rotate-90" : ""}`} />
                        <BedDouble className="w-3.5 h-3.5 text-violet-400 mr-1.5" />
                        <span className={`${theme.text} text-xs font-bold`}>{cat.nome}</span>
                      </div>
                      {!isCollapsed && cat.quartos.map(room => (
                        <div
                          key={room}
                          className={`border-b ${theme.divider} flex items-center justify-center ${theme.rowBg}`}
                          style={{ height: ROOM_H }}
                        >
                          <span className="text-2xl font-extrabold text-violet-400">{formatRoomNumber(room)}</span>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>

              {/* Scrollable days area */}
              <div className="flex-1 overflow-x-auto" ref={scrollRef}>
                <div style={{ width: days.length * DAY_CELL_W, minWidth: "100%" }}>
                  {/* Day headers — sticky top */}
                  <div className={`sticky top-0 z-30 ${theme.cardHdr} border-b ${theme.divider} flex`} style={{ height: 52 }}>
                    {days.map((day, idx) => {
                      const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                      const isToday = formatDate(day) === todayStr;
                      return (
                        <div
                          key={idx}
                          style={{ width: DAY_CELL_W, flexShrink: 0 }}
                          className={`border-r ${theme.divider} flex flex-col items-center justify-center text-center
                            ${isWeekend ? theme.weekendBg : ""} ${isToday ? theme.todayBg : ""}`}
                        >
                          <div className={`text-[10px] font-semibold uppercase tracking-wider ${isWeekend ? "text-rose-400" : theme.textSecondary}`}>
                            {day.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "")}
                          </div>
                          <div className={`text-sm font-bold ${isToday ? "text-violet-400" : theme.text}`}>
                            {day.getDate()}
                          </div>
                          <div className={`text-[9px] ${theme.textSecondary}`}>{day.getMonth() + 1}/{day.getFullYear().toString().slice(2)}</div>
                          {isToday && <div className="text-[8px] font-bold text-violet-400 leading-none">HOJE</div>}
                        </div>
                      );
                    })}
                  </div>

                  {/* Room rows */}
                  {CATEGORIAS.map(cat => {
                    const isCollapsed = collapsedCategories[cat.nome];
                    return (
                      <div key={cat.id}>
                        {/* Category spacer row */}
                        <div className={`${theme.catRow} border-b ${theme.divider} flex`} style={{ height: CAT_H }}>
                          {days.map((_, idx) => (
                            <div key={idx} style={{ width: DAY_CELL_W, flexShrink: 0 }} className={`border-r ${theme.divider}`} />
                          ))}
                        </div>

                        {!isCollapsed && cat.quartos.map((room, roomIdx) => (
                          <div
                            key={room}
                            className={`relative border-b ${theme.divider} flex ${roomIdx % 2 === 0 ? theme.rowBg : theme.rowAlt}`}
                            style={{ height: ROOM_H }}
                          >
                            {/* Cells */}
                            {days.map((day, idx) => {
                              const dateStr = formatDate(day);
                              const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                              const isToday = dateStr === todayStr;
                              const isSel = isCellSelected(room, dateStr);
                              const hasReserva = reservas.some(r => r.quarto === room && r.dataInicio <= dateStr && r.dataFim > dateStr);
                              return (
                                <div
                                  key={idx}
                                  style={{ width: DAY_CELL_W, flexShrink: 0, height: ROOM_H }}
                                  className={`border-r ${theme.divider} relative cursor-pointer transition-colors
                                    ${isWeekend && !isSel ? theme.weekendBg : ""}
                                    ${isToday && !isSel ? theme.todayBg : ""}
                                    ${isSel ? theme.selBg : ""}
                                    ${!hasReserva && !isSel && !movingId ? theme.cellHover : ""}
                                    ${movingId && !hasReserva ? "hover:bg-amber-500/20" : ""}`}
                                  onClick={() => {
                                    if (hasReserva && !movingId) return;
                                    handleCellClick(room, dateStr);
                                  }}
                                  onMouseEnter={() => handleCellMouseEnter(room, dateStr)}
                                />
                              );
                            })}

                            {/* Reservation bars — rendered absolutely over cells */}
                            <div className="absolute inset-0 pointer-events-none">
                              <div className="relative h-full pointer-events-auto">
                                {renderBars(room)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Legend */}
            <div className={`${theme.cardHdr} border-t ${theme.divider} px-4 py-2.5 flex items-center gap-4 flex-wrap`}>
              {[
                { color: "bg-emerald-500", label: "Confirmada" },
                { color: "bg-amber-500", label: "Solicitada" },
                { color: "bg-slate-500 opacity-70", label: "Hospedado" },
              ].map(l => (
                <div key={l.label} className="flex items-center gap-1.5">
                  <div className={`w-3 h-3 rounded-sm ${l.color}`} />
                  <span className={`${theme.textSecondary} text-xs`}>{l.label}</span>
                </div>
              ))}
              <span className={`${theme.textSecondary} text-xs ml-auto hidden sm:block`}>
                Clique na reserva para ver detalhes · Duplo clique para mover · Arraste as bordas para redimensionar · Clique em 2 células vazias para criar
              </span>
            </div>
          </div>
        )}
      </div>

      {/* MODALS */}
      {selectedReserva && (
        <ReservaDetailsModal
          reserva={reservas.find(r => r.id === selectedReserva.id) || selectedReserva}
          onClose={() => setSelectedReserva(null)}
          theme={theme}
          permissions={permissions}
          onCancel={handleCancelReserva}
        />
      )}

      {showAddModal && (
        <AddReservaModal
          theme={theme}
          onClose={() => { setShowAddModal(false); setAddModalInit({ room: null, start: null, end: null }); }}
          onSave={handleSaveNew}
          initialRoom={addModalInit.room}
          initialStart={addModalInit.start}
          initialEnd={addModalInit.end}
        />
      )}

      {showPermissionsModal && (
        <PermissoesModal
          theme={theme}
          permissions={permissions}
          setPermissions={setPermissions}
          onClose={() => setShowPermissionsModal(false)}
        />
      )}

      {/* NOTIFICATION */}
      {notification && (
        <div className="fixed top-4 right-4 z-[200] pointer-events-none">
          <div className={`px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 text-white text-sm font-medium
            ${notification.type === "success" ? "bg-emerald-600" : notification.type === "error" ? "bg-rose-600" : notification.type === "warning" ? "bg-amber-500" : "bg-slate-700"}`}
            style={{ animation: "slideIn 0.25s ease-out" }}
          >
            <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
            {notification.message}
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideIn { from { opacity: 0; transform: translateX(60px); } to { opacity: 1; transform: translateX(0); } }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { height: 6px; width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #4c4f69; border-radius: 3px; }
      `}</style>
    </div>
  );
}