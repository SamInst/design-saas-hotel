import { useState, useCallback, useEffect, useRef } from 'react';
import {
  BedDouble, ChevronLeft, ChevronRight, Plus,
  ChevronDown, Loader2, X, Users, Moon, Building2,
} from 'lucide-react';
import { Button }                   from '../../components/ui/Button';
import { Modal }                    from '../../components/ui/Modal';
import { Input, Select, FormField } from '../../components/ui/Input';
import { Notification }             from '../../components/ui/Notification';
import { CATEGORIAS, calendarApi, addDaysStr } from './calendarMocks';
import styles from './BookingCalendar.module.css';

// ─── Constants ────────────────────────────────────────────────────────────────
const DAY_CELL_W  = 92;   // px per day column (wide enough for full weekday name)
const ROOM_H      = 66;   // px per room row
const CAT_H       = 34;   // px for category header
const HDR_H       = 58;   // px for day header (taller for full name)
const LEFT_W      = 130;  // px for left label column
const VISIBLE_DAYS = 31;
const HALF         = DAY_CELL_W / 2;

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtBRL = (v) =>
  Number(v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const formatDate = (d) => {
  const y  = d.getFullYear();
  const m  = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
};

const addDays = (dateStr, n) => addDaysStr(dateStr, n);

const diffDays = (a, b) =>
  Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000);

const fmtRoom = (n) => String(n).padStart(2, '0');

const STATUS_LABEL = { hospedado: 'Hospedado', confirmada: 'Confirmada', solicitada: 'Solicitada' };

// ─── Confirmation Modal ───────────────────────────────────────────────────────
function ConfirmModal({ title, message, onConfirm, onCancel }) {
  return (
    <Modal
      open
      onClose={onCancel}
      size="sm"
      title={title}
      footer={
        <div className={styles.footerRight}>
          <Button variant="secondary" onClick={onCancel}>Cancelar</Button>
          <Button variant="primary" onClick={onConfirm}>Confirmar</Button>
        </div>
      }
    >
      <p style={{ margin: 0, fontSize: 14, color: 'var(--text)' }}>{message}</p>
    </Modal>
  );
}

// ─── Detail Modal ─────────────────────────────────────────────────────────────
function ReservaModal({ reserva, onClose, onCancel }) {
  const pendente = reserva.valorTotal - reserva.totalPago;
  const dias     = diffDays(reserva.dataInicio, reserva.dataFim);

  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      title={<><BedDouble size={15} /> {reserva.titularNome}</>}
      footer={
        <div className={styles.footerSpread}>
          <Button variant="danger" onClick={() => { onCancel(reserva.id); onClose(); }}>
            Cancelar Reserva
          </Button>
          <Button variant="secondary" onClick={onClose}>Fechar</Button>
        </div>
      }
    >
      <div className={styles.detailBody}>
        <div className={styles.detailGrid2}>
          <div className={styles.detailBox}>
            <span className={styles.detailLabel}>Quarto</span>
            <span className={styles.detailValue}>#{fmtRoom(reserva.quarto)}</span>
            <span className={styles.detailSub}>{reserva.categoria}</span>
          </div>
          <div className={styles.detailBox}>
            <span className={styles.detailLabel}>Período</span>
            <span className={styles.detailValue}>{dias} diária{dias !== 1 ? 's' : ''}</span>
            <span className={styles.detailSub}>{reserva.dataInicio} → {reserva.dataFim}</span>
          </div>
        </div>
        <div className={styles.detailBox}>
          <span className={styles.detailLabel}>Status</span>
          <span className={[styles.statusBadge, styles[`status_${reserva.status}`]].join(' ')}>
            {STATUS_LABEL[reserva.status] ?? reserva.status}
          </span>
        </div>
        {reserva.empresaNome && (
          <div className={styles.detailBox}>
            <span className={styles.detailLabel}>Empresa</span>
            <span className={styles.detailValue} style={{ fontSize: 14 }}>{reserva.empresaNome}</span>
          </div>
        )}
        <div className={styles.detailBox}>
          <span className={styles.detailLabel}>Hóspedes ({reserva.hospedes?.length ?? 0})</span>
          <div className={styles.hospedeList}>
            {(reserva.hospedes || []).map((h) => (
              <div key={h.id} className={styles.hospedeRow}>
                <div className={styles.hospedeAvatar}>{h.nome[0]}</div>
                <div>
                  <div className={styles.hospedeName}>{h.nome}</div>
                  {h.cpf && <div className={styles.hospedeCpf}>{h.cpf}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className={styles.detailBox}>
          <span className={styles.detailLabel}>Financeiro</span>
          <div className={styles.finRow}>
            <span>Total:</span>
            <span className={styles.finTotal}>{fmtBRL(reserva.valorTotal)}</span>
          </div>
          <div className={styles.finRow}>
            <span>Pago:</span>
            <span className={styles.finPago}>{fmtBRL(reserva.totalPago)}</span>
          </div>
          {pendente > 0 && (
            <div className={styles.finRow}>
              <span>Pendente:</span>
              <span className={styles.finPendente}>{fmtBRL(pendente)}</span>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

// ─── Add Reservation Modal ────────────────────────────────────────────────────
function AddModal({ initialRoom, initialStart, initialEnd, onClose, onSave }) {
  const [quarto,     setQuarto]     = useState(initialRoom ? String(initialRoom) : '');
  const [dataInicio, setDataInicio] = useState(initialStart || '');
  const [dataFim,    setDataFim]    = useState(initialEnd   || '');
  const [titular,    setTitular]    = useState('');
  const [status,     setStatus]     = useState('confirmada');
  const [valorTotal, setValorTotal] = useState('');
  const [saving,     setSaving]     = useState(false);

  const valid = quarto && dataInicio && dataFim && titular && dataFim > dataInicio;

  const handleSave = async () => {
    if (!valid) return;
    setSaving(true);
    try {
      const cat = CATEGORIAS.find((c) => c.quartos.includes(parseInt(quarto)));
      await onSave({
        quarto:                  parseInt(quarto),
        categoria:               cat?.nome || '',
        titularNome:             titular,
        empresaNome:             null,
        quantidadeAcompanhantes: 0,
        dataInicio,
        dataFim,
        chegadaPrevista:         dataInicio + ' 14:00',
        saidaPrevista:           dataFim    + ' 12:00',
        status,
        hospedes:                [{ id: Date.now(), nome: titular, cpf: '' }],
        pagamentos:              [],
        valorTotal:              parseFloat(valorTotal) || 0,
        totalPago:               0,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={<><Plus size={15} /> Nova Reserva</>}
      footer={
        <div className={styles.footerRight}>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" disabled={!valid || saving} onClick={handleSave}>
            {saving && <Loader2 size={13} className={styles.spin} />}
            Criar Reserva
          </Button>
        </div>
      }
    >
      <div className={styles.formStack}>
        <FormField label="Quarto">
          <Select value={quarto} onChange={(e) => setQuarto(e.target.value)}>
            <option value="">Selecione...</option>
            {CATEGORIAS.map((cat) => (
              <optgroup key={cat.id} label={cat.nome}>
                {cat.quartos.map((r) => (
                  <option key={r} value={r}>Quarto {fmtRoom(r)}</option>
                ))}
              </optgroup>
            ))}
          </Select>
        </FormField>
        <FormField label="Titular">
          <Input value={titular} onChange={(e) => setTitular(e.target.value)} placeholder="Nome do titular" />
        </FormField>
        <div className={styles.formRow2}>
          <FormField label="Check-in">
            <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
          </FormField>
          <FormField label="Check-out">
            <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
          </FormField>
        </div>
        <div className={styles.formRow2}>
          <FormField label="Status">
            <Select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="confirmada">Confirmada</option>
              <option value="solicitada">Solicitada</option>
              <option value="hospedado">Hospedado</option>
            </Select>
          </FormField>
          <FormField label="Valor Total (R$)">
            <Input type="number" value={valorTotal} onChange={(e) => setValorTotal(e.target.value)} placeholder="0,00" min="0" />
          </FormField>
        </div>
      </div>
    </Modal>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function BookingCalendar() {
  const today    = new Date(); today.setHours(0, 0, 0, 0);
  const todayStr = formatDate(today);

  // ── State ────────────────────────────────────────────────────────────────
  const [reservas,        setReservas]        = useState([]);
  const [loading,         setLoading]         = useState(true);

  // View: start from yesterday
  const [viewDate, setViewDate] = useState(() => {
    const d = new Date(today);
    d.setDate(d.getDate() - 1);
    return d;
  });

  const [collapsedCats,   setCollapsedCats]   = useState({});
  const [selectedReserva, setSelectedReserva] = useState(null);
  const [showAddModal,    setShowAddModal]     = useState(false);
  const [addInit,         setAddInit]         = useState({ room: null, start: null, end: null });
  const [searchTerm,      setSearchTerm]      = useState('');

  // Cell selection (improved)
  const [selRoom,  setSelRoom]  = useState(null);
  const [selStart, setSelStart] = useState(null);
  const [selHover, setSelHover] = useState(null); // tracks hover during selection

  // Drag-move state
  const [dragState,  setDragState]  = useState(null);
  // dragState = { type: 'move'|'resize-l'|'resize-r', id, origQuarto, origInicio, origFim }
  const [ghostDrag,  setGhostDrag]  = useState(null);
  // ghostDrag = { quarto, dataInicio, dataFim }

  // Ref to avoid redundant state updates during fast mouse movement
  const lastHoverRef = useRef(null);

  // Confirmation modal
  const [confirmData, setConfirmData] = useState(null);
  // confirmData = { title, message, onConfirm }

  const [notif, setNotif] = useState(null);

  const notify = useCallback((message, type = 'success') => {
    setNotif({ message, type });
    setTimeout(() => setNotif(null), 3500);
  }, []);

  // ── Load ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    calendarApi.listarReservas().then((data) => {
      setReservas(data);
      setLoading(false);
    });
  }, []);

  // ── Days array ────────────────────────────────────────────────────────────
  const days = Array.from({ length: VISIBLE_DAYS }, (_, i) => {
    const d = new Date(viewDate);
    d.setDate(d.getDate() + i);
    return d;
  });
  const daysStr     = days.map((d) => formatDate(d));
  const firstDayStr = daysStr[0];
  const lastDayStr  = daysStr[daysStr.length - 1];

  // ── Navigation ────────────────────────────────────────────────────────────
  const shiftMonth = (delta) => {
    setViewDate((d) => {
      // Go to first day of the next/prev month
      const nd = new Date(d.getFullYear(), d.getMonth() + delta, 1);
      return nd;
    });
  };

  const goToday = () => {
    const d = new Date(today);
    d.setDate(d.getDate() - 1);
    setViewDate(d);
  };

  // Month label from current view
  const monthLabel = viewDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  // ── Search filter ─────────────────────────────────────────────────────────
  const filteredReservas = searchTerm.trim().length >= 2
    ? reservas.filter((r) =>
        r.titularNome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.empresaNome && r.empresaNome.toLowerCase().includes(searchTerm.toLowerCase()))
      )
    : reservas;

  // ── Cell selection ────────────────────────────────────────────────────────
  const handleCellClick = (room, dateStr) => {
    if (dragState) return; // ignore clicks during drag

    const occupied = filteredReservas.some(
      (r) => r.quarto === room && r.dataInicio <= dateStr && r.dataFim > dateStr
    );
    if (occupied) return;

    if (selRoom === null) {
      // First click: start selection
      setSelRoom(room);
      setSelStart(dateStr);
      setSelHover(dateStr);
      return;
    }

    if (selRoom !== room) {
      // Clicked different room → restart
      setSelRoom(room);
      setSelStart(dateStr);
      setSelHover(dateStr);
      return;
    }

    // Same room — second click confirms
    if (dateStr === selStart) {
      // Clicked same cell → cancel
      setSelRoom(null); setSelStart(null); setSelHover(null);
      return;
    }

    const start = dateStr < selStart ? dateStr : selStart;
    const end   = dateStr < selStart ? selStart : dateStr;

    setAddInit({ room, start, end });
    setShowAddModal(true);
    setSelRoom(null); setSelStart(null); setSelHover(null);
  };

  // onMouseMove on roomCells container — more frequent than onMouseEnter, smoother
  const handleRoomMouseMove = (e, room) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const cellIdx = Math.floor(x / DAY_CELL_W);
    if (cellIdx < 0 || cellIdx >= VISIBLE_DAYS) return;
    const dateStr = daysStr[cellIdx];
    const key = `${room}-${dateStr}`;
    if (lastHoverRef.current === key) return; // no change
    lastHoverRef.current = key;

    if (dragState) {
      handleDragHover(room, dateStr);
    } else if (selRoom === room) {
      setSelHover(dateStr);
    }
  };

  const isCellSelected = (room, dateStr) => {
    if (selRoom !== room || !selStart) return false;
    const hov = selHover || selStart;
    const lo  = selStart < hov ? selStart : hov;
    const hi  = selStart < hov ? hov : selStart;
    return dateStr >= lo && dateStr <= hi;
  };

  // ── Drag / Resize ─────────────────────────────────────────────────────────
  const handleBarMouseDown = (e, r) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.button !== 0) return; // left button only
    setDragState({ type: 'move', id: r.id, origQuarto: r.quarto, origInicio: r.dataInicio, origFim: r.dataFim });
    setGhostDrag({ quarto: r.quarto, dataInicio: r.dataInicio, dataFim: r.dataFim });
  };

  const handleResizeMouseDown = (e, r, edge) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.button !== 0) return;
    setDragState({ type: edge, id: r.id, origQuarto: r.quarto, origInicio: r.dataInicio, origFim: r.dataFim });
    setGhostDrag({ quarto: r.quarto, dataInicio: r.dataInicio, dataFim: r.dataFim });
  };

  const handleDragHover = (room, dateStr) => {
    if (!dragState || !ghostDrag) return;

    if (dragState.type === 'move') {
      const dur = diffDays(dragState.origInicio, dragState.origFim);
      setGhostDrag({ quarto: room, dataInicio: dateStr, dataFim: addDays(dateStr, dur) });
    } else if (dragState.type === 'resize-l') {
      if (dragState.origQuarto !== room) return;
      if (dateStr < dragState.origFim) {
        setGhostDrag((g) => ({ ...g, dataInicio: dateStr }));
      }
    } else if (dragState.type === 'resize-r') {
      if (dragState.origQuarto !== room) return;
      const nextDay = addDays(dateStr, 1);
      if (nextDay > dragState.origInicio) {
        setGhostDrag((g) => ({ ...g, dataFim: nextDay }));
      }
    }
  };

  // Use refs to access latest state in global mouseup handler
  const dragStateRef  = useRef(dragState);
  const ghostDragRef  = useRef(ghostDrag);
  const reservasRef   = useRef(reservas);
  dragStateRef.current  = dragState;
  ghostDragRef.current  = ghostDrag;
  reservasRef.current   = reservas;

  const handleGlobalMouseUp = useCallback(() => {
    const ds = dragStateRef.current;
    const gd = ghostDragRef.current;
    if (!ds || !gd) return;

    const r = reservasRef.current.find((x) => x.id === ds.id);
    if (!r) { setDragState(null); setGhostDrag(null); return; }

    const changed =
      gd.quarto     !== r.quarto     ||
      gd.dataInicio !== r.dataInicio ||
      gd.dataFim    !== r.dataFim;

    if (changed) {
      const dias = diffDays(gd.dataInicio, gd.dataFim);
      let message = '';
      if (ds.type === 'move') {
        message = gd.quarto !== r.quarto
          ? `Mover para Quarto ${fmtRoom(gd.quarto)}: ${gd.dataInicio} → ${gd.dataFim} (${dias} diária${dias !== 1 ? 's' : ''})?`
          : `Alterar datas para ${gd.dataInicio} → ${gd.dataFim} (${dias} diária${dias !== 1 ? 's' : ''})?`;
      } else {
        message = `Ajustar período para ${gd.dataInicio} → ${gd.dataFim} (${dias} diária${dias !== 1 ? 's' : ''})?`;
      }

      const snapshot = { ...gd };
      const resId    = ds.id;
      setConfirmData({
        title:     ds.type === 'move' ? 'Mover Reserva' : 'Ajustar Período',
        message,
        onConfirm: async () => {
          const updated = await calendarApi.atualizarReserva(resId, snapshot);
          setReservas((rs) => rs.map((x) => x.id === resId ? updated : x));
          notify(ds.type === 'move' ? 'Reserva movida.' : 'Período ajustado.');
          setConfirmData(null);
        },
      });
    }

    setDragState(null);
    setGhostDrag(null);
    lastHoverRef.current = null;
  }, [notify]);

  useEffect(() => {
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [handleGlobalMouseUp]);

  // Cancel drag on Escape
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setDragState(null); setGhostDrag(null); lastHoverRef.current = null;
        setSelRoom(null);   setSelStart(null); setSelHover(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ── Save new reservation ──────────────────────────────────────────────────
  const handleSaveNew = async (data) => {
    const nova = await calendarApi.criarReserva(data);
    setReservas((rs) => [...rs, nova]);
    notify('Reserva criada!');
    setShowAddModal(false);
  };

  const handleCancelReserva = async (id) => {
    await calendarApi.cancelarReserva(id);
    setReservas((rs) => rs.filter((r) => r.id !== id));
    notify('Reserva cancelada.');
  };

  // ── Render bars ───────────────────────────────────────────────────────────
  const renderBars = (room) => {
    // Combine actual reservations with ghost (if ghost is in this room)
    const toRender = filteredReservas.filter((r) => r.quarto === room);

    const bars = [];

    for (const r of toRender) {
      const isBeingDragged = dragState?.id === r.id;

      // Use ghost data for this bar's position if it's being moved within same room
      const useGhost = isBeingDragged && ghostDrag && ghostDrag.quarto === room;
      const displayR = useGhost ? { ...r, ...ghostDrag } : r;

      const barEl = buildBar(displayR, r, {
        opacity:     isBeingDragged && !useGhost ? 0.35 : 1, // fade if moved to different room
        isGhost:     false,
        isDragging:  isBeingDragged,
      });
      if (barEl) bars.push(barEl);
    }

    // If ghost is being dragged to THIS room from a DIFFERENT room, render ghost here
    if (dragState && ghostDrag && ghostDrag.quarto === room) {
      const orig = reservas.find((r) => r.id === dragState.id);
      if (orig && orig.quarto !== room) {
        const ghostEl = buildBar({ ...orig, ...ghostDrag }, orig, { isGhost: true });
        if (ghostEl) bars.push(ghostEl);
      }
    }

    return bars;
  };

  const buildBar = (display, orig, { opacity = 1, isGhost = false, isDragging = false }) => {
    const { dataInicio, dataFim, quarto } = display;

    // Bars start at MIDDLE of checkin day, end at MIDDLE of checkout day
    const startInView = dataInicio >= firstDayStr;
    const endInView   = dataFim   <= addDays(lastDayStr, 1);

    // Determine left edge
    let left;
    if (!startInView) {
      left = 0; // clipped at left edge
    } else {
      const idx = daysStr.indexOf(dataInicio);
      if (idx < 0) return null; // not in window
      left = idx * DAY_CELL_W + HALF;
    }

    // Determine right edge
    let right;
    if (!endInView) {
      right = VISIBLE_DAYS * DAY_CELL_W; // extend to right edge
    } else {
      const idx = daysStr.indexOf(dataFim);
      if (idx < 0 && dataFim > lastDayStr) {
        right = VISIBLE_DAYS * DAY_CELL_W;
      } else if (idx < 0) {
        return null; // checkout before window, nothing to show
      } else {
        right = idx * DAY_CELL_W + HALF;
      }
    }

    const width = right - left;
    if (width <= 4) return null;

    const rLeft  = startInView ? 6 : 0;
    const rRight = endInView   ? 6 : 0;
    const borderRadius = `${rLeft}px ${rRight}px ${rRight}px ${rLeft}px`;

    const dias = diffDays(orig.dataInicio, orig.dataFim);
    const totalPeople = 1 + (orig.quantidadeAcompanhantes || 0);

    const key = isGhost ? `ghost-${orig.id}` : `bar-${orig.id}`;

    return (
      <div
        key={key}
        className={[
          styles.bar,
          styles[`bar_${orig.status}`],
          isGhost  ? styles.barGhost   : '',
          isDragging ? styles.barDragging : '',
        ].join(' ')}
        style={{ left, width, borderRadius, opacity }}
        onMouseDown={isGhost ? undefined : (e) => handleBarMouseDown(e, orig)}
        onClick={(e) => {
          e.stopPropagation();
          if (!dragState) setSelectedReserva(orig);
        }}
        title={`${orig.titularNome} — ${dias} diária${dias !== 1 ? 's' : ''}`}
      >
        {/* Left resize handle */}
        {startInView && !isGhost && (
          <div
            className={styles.resizeHandle}
            onMouseDown={(e) => handleResizeMouseDown(e, orig, 'resize-l')}
          />
        )}

        {/* Content */}
        <div className={styles.barContent}>
          <span className={styles.barName}>{orig.titularNome}</span>
          {isGhost ? (
            /* Ghost bar: show target dates + duration */
            <div className={styles.barDateLabel}>
              {display.dataInicio} → {display.dataFim} · {diffDays(display.dataInicio, display.dataFim)}n
            </div>
          ) : (
            <>
              <div className={styles.barMeta}>
                <span className={styles.barMetaItem}><Users size={9} /> {totalPeople}</span>
                <span className={styles.barMetaItem}><Moon size={9} /> {dias}n</span>
              </div>
              {orig.empresaNome && (
                <div className={styles.barCompany}><Building2 size={9} /> {orig.empresaNome}</div>
              )}
            </>
          )}
        </div>

        {/* Right resize handle */}
        {endInView && !isGhost && (
          <div
            className={[styles.resizeHandle, styles.resizeHandleRight].join(' ')}
            onMouseDown={(e) => handleResizeMouseDown(e, orig, 'resize-r')}
          />
        )}
      </div>
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────
  const gridTotalW = LEFT_W + VISIBLE_DAYS * DAY_CELL_W;

  return (
    <div
      className={styles.page}
      onMouseLeave={() => { /* don't cancel on leave, use global mouseup */ }}
    >
      <Notification notification={notif} />

      {/* Page header */}
      <div>
        <h1 className={styles.h1}>Calendário de Reservas</h1>
        <p className={styles.subtitle}>Visualize e gerencie reservas por quarto e período</p>
      </div>

      {/* Calendar card */}
      <div className={styles.card}>

        {/* Nav bar */}
        <div className={styles.navBar}>
          {/* Month navigation */}
          <div className={styles.navLeft}>
            <button className={styles.navBtn} onClick={() => shiftMonth(-1)}>
              <ChevronLeft size={15} />
            </button>
            <span className={styles.monthLabel}>{monthLabel}</span>
            <button className={styles.navBtn} onClick={() => shiftMonth(1)}>
              <ChevronRight size={15} />
            </button>
            <button className={[styles.navBtn, styles.navBtnToday].join(' ')} onClick={goToday}>
              Hoje
            </button>
          </div>

          {/* Search by client name */}
          <div className={styles.navSearch}>
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar hóspede ou empresa..."
              style={{ fontSize: 12, padding: '5px 10px', height: 30 }}
            />
            {searchTerm && (
              <button className={styles.clearSearch} onClick={() => setSearchTerm('')}>
                <X size={12} />
              </button>
            )}
          </div>

          {/* Nova Reserva */}
          <Button
            variant="primary"
            onClick={() => { setAddInit({ room: null, start: null, end: null }); setShowAddModal(true); }}
          >
            <Plus size={14} /> Nova Reserva
          </Button>
        </div>

        {/* Selection hint */}
        {selStart && (
          <div className={styles.selHint}>
            <span>
              Quarto <strong>{fmtRoom(selRoom)}</strong> · a partir de <strong>{selStart}</strong>
              {' '}— clique em outra data para definir o fim
            </span>
            <button
              className={styles.selHintClose}
              onClick={() => { setSelRoom(null); setSelStart(null); setSelHover(null); }}
            >
              <X size={12} />
            </button>
          </div>
        )}

        {/* Drag hint */}
        {dragState && (
          <div className={[styles.selHint, styles.dragHint].join(' ')}>
            <span>
              {dragState.type === 'move'
                ? 'Arraste para o quarto/data de destino'
                : 'Arraste para ajustar o período'}
              {' '}— Esc para cancelar
            </span>
          </div>
        )}

        {/* Grid */}
        <div className={styles.gridScroll}>
          {loading ? (
            <div className={styles.loadingRow}>
              <Loader2 size={20} className={styles.spin} /> Carregando...
            </div>
          ) : (
            <>
              {/* Day header row */}
              <div className={styles.dayHeaderRow} style={{ width: gridTotalW }}>
                <div className={styles.cornerCell} style={{ width: LEFT_W, height: HDR_H }}>
                  <BedDouble size={12} />
                  <span>Quarto</span>
                </div>
                {days.map((day, idx) => {
                  const dStr      = daysStr[idx];
                  const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                  const isToday   = dStr === todayStr;
                  return (
                    <div
                      key={idx}
                      className={[
                        styles.dayHeader,
                        isWeekend ? styles.dayHeaderWeekend : '',
                        isToday   ? styles.dayHeaderToday   : '',
                      ].join(' ')}
                      style={{ width: DAY_CELL_W, height: HDR_H }}
                    >
                      <span className={[styles.dayWeekday, isWeekend ? styles.dayWeekdayRed : ''].join(' ')}>
                        {day.toLocaleDateString('pt-BR', { weekday: 'long' })}
                      </span>
                      <span className={[styles.dayNum, isToday ? styles.dayNumToday : ''].join(' ')}>
                        {day.getDate()}
                      </span>
                      {isToday && <span className={styles.todayTag}>hoje</span>}
                    </div>
                  );
                })}
              </div>

              {/* Categories + rooms */}
              {CATEGORIAS.map((cat) => {
                const isCollapsed = !!collapsedCats[cat.id];
                return (
                  <div key={cat.id}>
                    {/* Category header */}
                    <div
                      className={styles.catRow}
                      style={{ width: gridTotalW, height: CAT_H }}
                      onClick={() =>
                        setCollapsedCats((p) => ({ ...p, [cat.id]: !p[cat.id] }))
                      }
                    >
                      <div className={styles.catLabel} style={{ width: LEFT_W }}>
                        <ChevronDown size={12} className={isCollapsed ? styles.chevronCollapsed : styles.chevronOpen} />
                        <BedDouble size={12} />
                        {cat.nome}
                      </div>
                      {days.map((_, idx) => (
                        <div key={idx} className={styles.catCell} style={{ width: DAY_CELL_W }} />
                      ))}
                    </div>

                    {/* Room rows */}
                    {!isCollapsed && cat.quartos.map((room) => (
                      <div
                        key={room}
                        className={styles.roomRow}
                        style={{ width: gridTotalW, height: ROOM_H }}
                      >
                        {/* Room label */}
                        <div className={styles.roomLabel} style={{ width: LEFT_W, height: ROOM_H }}>
                          <span className={styles.roomNum}>{fmtRoom(room)}</span>
                        </div>

                        {/* Day cells + bars */}
                        <div
                          className={styles.roomCells}
                          onMouseMove={(e) => handleRoomMouseMove(e, room)}
                        >
                          {days.map((day, idx) => {
                            const dStr      = daysStr[idx];
                            const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                            const isToday   = dStr === todayStr;
                            const isSel     = isCellSelected(room, dStr);

                            return (
                              <div
                                key={idx}
                                className={[
                                  styles.cell,
                                  isWeekend ? styles.cellWeekend : '',
                                  isToday   ? styles.cellToday   : '',
                                  isSel     ? styles.cellSelected : '',
                                  styles.cellClickable,
                                ].join(' ')}
                                style={{ width: DAY_CELL_W, height: ROOM_H, flexShrink: 0 }}
                                onClick={() => handleCellClick(room, dStr)}
                              />
                            );
                          })}

                          {/* Bars overlay */}
                          <div className={styles.barsLayer}>
                            {renderBars(room)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </>
          )}
        </div>

        {/* Legend */}
        <div className={styles.legend}>
          {[
            { cls: 'legendDot_confirmada', label: 'Confirmada' },
            { cls: 'legendDot_solicitada', label: 'Solicitada' },
            { cls: 'legendDot_hospedado',  label: 'Hospedado' },
          ].map((l) => (
            <div key={l.label} className={styles.legendItem}>
              <div className={[styles.legendDot, styles[l.cls]].join(' ')} />
              <span>{l.label}</span>
            </div>
          ))}
          <span className={styles.legendHint}>
            Clique para ver · Clique em 2 células para criar · Arraste para mover · Arraste borda para redimensionar
          </span>
        </div>
      </div>

      {/* Modals */}
      {selectedReserva && (
        <ReservaModal
          reserva={selectedReserva}
          onClose={() => setSelectedReserva(null)}
          onCancel={handleCancelReserva}
        />
      )}

      {showAddModal && (
        <AddModal
          initialRoom={addInit.room}
          initialStart={addInit.start}
          initialEnd={addInit.end}
          onClose={() => { setShowAddModal(false); setAddInit({ room: null, start: null, end: null }); }}
          onSave={handleSaveNew}
        />
      )}

      {confirmData && (
        <ConfirmModal
          title={confirmData.title}
          message={confirmData.message}
          onConfirm={confirmData.onConfirm}
          onCancel={() => setConfirmData(null)}
        />
      )}
    </div>
  );
}
