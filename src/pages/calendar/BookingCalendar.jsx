import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  BedDouble, ChevronLeft, ChevronRight, Plus,
  ChevronDown, Loader2, X, Users, Building2, Search, CalendarDays, Bell,
} from 'lucide-react';
import { Button }       from '../../components/ui/Button';
import { Modal }        from '../../components/ui/Modal';
import { FormField }    from '../../components/ui/Input';
import { DatePicker }   from '../../components/ui/DatePicker';
import { Notification } from '../../components/ui/Notification';
import {
  CATEGORIAS, calendarApi, addDaysStr,
  QUARTOS_INFO, HOSPEDES_CADASTRADOS,
} from './calendarMocks';
import styles from './BookingCalendar.module.css';

// ─── Constants ────────────────────────────────────────────────────────────────
const DAY_CELL_W   = 56;
const ROOM_H       = 50;
const CAT_H        = 30;
const HDR_H        = 50;
const LEFT_W       = 110;
const VISIBLE_DAYS = 31;
const HALF         = DAY_CELL_W / 2;
const FORMAS_PAG   = ['PIX', 'Cartão de Crédito', 'Cartão de Débito', 'Dinheiro', 'Transferência'];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtBRL = (v) =>
  Number(v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const formatDate = (d) => {
  const y  = d.getFullYear();
  const m  = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
};

const addDays   = (s, n) => addDaysStr(s, n);
const diffDays  = (a, b) =>
  Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000);
const fmtRoom   = (n) => String(n).padStart(2, '0');
const fmtDateBR = (s) => { if (!s) return ''; const [y, m, d] = s.split('-'); return `${d}/${m}/${y}`; };
const diariasTxt = (n) => `${n} diária${n !== 1 ? 's' : ''}`;

const initials = (nome) => {
  const p = (nome || '').trim().split(/\s+/).filter(Boolean);
  if (!p.length) return '?';
  if (p.length === 1) return p[0][0].toUpperCase();
  return (p[0][0] + p[p.length - 1][0]).toUpperCase();
};

const STATUS_LABEL = {
  hospedado: 'Hospedado', confirmada: 'Confirmada',
  solicitada: 'Solicitada', finalizado: 'Finalizado', cancelado: 'Cancelado',
};

// ─── Confirm Modal ────────────────────────────────────────────────────────────
function ConfirmModal({ title, message, onConfirm, onCancel }) {
  return (
    <Modal open onClose={onCancel} size="sm" title={title}
      footer={
        <div className={styles.footerRight}>
          <Button variant="secondary" onClick={onCancel}>Cancelar</Button>
          <Button variant="primary"   onClick={onConfirm}>Confirmar</Button>
        </div>
      }
    >
      <p style={{ margin: 0, fontSize: 14, color: 'var(--text)' }}>{message}</p>
    </Modal>
  );
}

// ─── Reserva Detail Modal ─────────────────────────────────────────────────────
function ReservaModal({ reserva, onClose, onCancel }) {
  const pendente = reserva.valorTotal - reserva.totalPago;
  const dias     = diffDays(reserva.dataInicio, reserva.dataFim);
  const cat      = CATEGORIAS.find((c) => c.quartos.includes(reserva.quarto));
  return (
    <Modal open onClose={onClose} size="md"
      title={<><BedDouble size={15} /> Quarto {fmtRoom(reserva.quarto)} — {reserva.titularNome}</>}
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
        <div className={styles.detailRoomHeader}>
          <div className={styles.detailRoomBadge}>
            <span className={styles.detailRoomNum}>{fmtRoom(reserva.quarto)}</span>
          </div>
          <div>
            <div className={styles.detailRoomCat}>{cat?.nome || reserva.categoria}</div>
            <span className={[styles.statusBadge, styles[`status_${reserva.status}`]].join(' ')}>
              {STATUS_LABEL[reserva.status] ?? reserva.status}
            </span>
          </div>
        </div>
        <div className={styles.detailGrid2}>
          <div className={styles.detailBox}>
            <span className={styles.detailLabel}>Check-in</span>
            <span className={styles.detailValue}>{fmtDateBR(reserva.dataInicio)}</span>
            <span className={styles.detailSub}>{reserva.chegadaPrevista?.split(' ')[1] ?? '14:00'}</span>
          </div>
          <div className={styles.detailBox}>
            <span className={styles.detailLabel}>Check-out</span>
            <span className={styles.detailValue}>{fmtDateBR(reserva.dataFim)}</span>
            <span className={styles.detailSub}>{reserva.saidaPrevista?.split(' ')[1] ?? '12:00'}</span>
          </div>
        </div>
        <div className={styles.detailBox}>
          <span className={styles.detailLabel}>Período</span>
          <span className={styles.detailValue}>{diariasTxt(dias)}</span>
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
                <div className={styles.hospedeAvatar}>{initials(h.nome)}</div>
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
          <div className={styles.finGrid}>
            <div className={styles.finBox}><span className={styles.finBoxLabel}>Total</span><span className={styles.finTotal}>{fmtBRL(reserva.valorTotal)}</span></div>
            <div className={styles.finBox}><span className={styles.finBoxLabel}>Pago</span><span className={styles.finPago}>{fmtBRL(reserva.totalPago)}</span></div>
            <div className={styles.finBox}><span className={styles.finBoxLabel}>Pendente</span>
              <span className={pendente > 0 ? styles.finPendente : styles.finPago}>{fmtBRL(Math.max(0, pendente))}</span>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ─── Day Modal ────────────────────────────────────────────────────────────────
function DayModal({ dateStr, reservas, onClose, onNewReserva }) {
  const dayReservas    = reservas.filter((r) => r.dataInicio <= dateStr && r.dataFim > dateStr);
  const occupiedRooms  = new Set(dayReservas.map((r) => r.quarto));
  const availableRooms = CATEGORIAS.flatMap((c) => c.quartos).filter((r) => !occupiedRooms.has(r));
  const dayObj  = new Date(dateStr + 'T00:00:00');
  const weekday = dayObj.toLocaleDateString('pt-BR', { weekday: 'long' });
  const cap     = weekday.charAt(0).toUpperCase() + weekday.slice(1);
  return (
    <Modal open onClose={onClose} size="lg"
      title={<><CalendarDays size={15} /> {cap}, {fmtDateBR(dateStr)}</>}
      footer={
        <div className={styles.footerSpread}>
          <span className={styles.footerInfo}>
            {dayReservas.length} reserva{dayReservas.length !== 1 ? 's' : ''} · {availableRooms.length} disponível{availableRooms.length !== 1 ? 'is' : ''}
          </span>
          <div className={styles.footerRight}>
            <Button variant="primary" onClick={() => { onClose(); onNewReserva(dateStr, availableRooms); }}>
              <Plus size={13} /> Nova Reserva
            </Button>
            <Button variant="secondary" onClick={onClose}>Fechar</Button>
          </div>
        </div>
      }
    >
      {dayReservas.length === 0 ? (
        <div className={styles.emptyState}>Nenhuma reserva para este dia.</div>
      ) : (
        <div className={styles.dayRoomList}>
          {dayReservas.map((r) => {
            const dias = diffDays(r.dataInicio, r.dataFim);
            return (
              <div key={r.id} className={[styles.dayRoomRow, styles[`dayRoom_${r.status}`]].join(' ')}>
                <div className={[styles.dayRoomBadge, styles[`dayRoomBadge_${r.status}`]].join(' ')}>{fmtRoom(r.quarto)}</div>
                <div className={styles.dayRoomInfo}>
                  <div className={styles.dayRoomTitular}>{r.titularNome}</div>
                  <div className={styles.dayRoomDates}>{fmtDateBR(r.dataInicio)} → {fmtDateBR(r.dataFim)} · {diariasTxt(dias)}</div>
                  <div className={styles.dayRoomHospedes}>
                    {(r.hospedes || []).slice(0, 5).map((h) => (
                      <div key={h.id} className={styles.initialsCircleSm} title={h.nome}>{initials(h.nome)}</div>
                    ))}
                    {(r.hospedes || []).length > 5 && <div className={styles.initialsCircleSm}>+{r.hospedes.length - 5}</div>}
                  </div>
                </div>
                <span className={[styles.statusBadge, styles[`status_${r.status}`]].join(' ')}>{STATUS_LABEL[r.status]}</span>
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}

// ─── Room Modal ───────────────────────────────────────────────────────────────
function RoomModal({ room, reservas, onClose }) {
  const cat          = CATEGORIAS.find((c) => c.quartos.includes(room));
  const roomReservas = [...reservas].filter((r) => r.quarto === room).sort((a, b) => a.dataInicio.localeCompare(b.dataInicio));
  return (
    <Modal open onClose={onClose} size="md"
      title={<><BedDouble size={15} /> Quarto {fmtRoom(room)} — {cat?.nome || ''}</>}
      footer={<div className={styles.footerRight}><Button variant="secondary" onClick={onClose}>Fechar</Button></div>}
    >
      {roomReservas.length === 0 ? (
        <div className={styles.emptyState}>Nenhuma reserva registrada.</div>
      ) : (
        <div className={styles.roomHistoryList}>
          {roomReservas.map((r) => {
            const dias = diffDays(r.dataInicio, r.dataFim);
            return (
              <div key={r.id} className={styles.roomHistoryRow}>
                <div className={styles.roomHistoryLeft}>
                  <div className={styles.roomHistoryDates}>
                    <span className={styles.roomHistoryDate}>{fmtDateBR(r.dataInicio)}</span>
                    <span className={styles.roomHistoryArrow}>→</span>
                    <span className={styles.roomHistoryDate}>{fmtDateBR(r.dataFim)}</span>
                    <span className={styles.roomHistoryNights}>{diariasTxt(dias)}</span>
                  </div>
                  <div className={styles.roomHistoryTitle}>{r.titularNome}</div>
                </div>
                <div className={styles.roomHistoryHospedes}>
                  {(r.hospedes || []).slice(0, 4).map((h) => (
                    <div key={h.id} className={styles.initialsCircleSm} title={h.nome}>{initials(h.nome)}</div>
                  ))}
                  {(r.hospedes || []).length > 4 && <div className={styles.initialsCircleSm}>+{r.hospedes.length - 4}</div>}
                </div>
                <span className={[styles.statusBadgeSm, styles[`status_${r.status}`]].join(' ')}>{STATUS_LABEL[r.status]}</span>
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}

// ─── Solicitações Modal — list style like RoomModal ───────────────────────────
function SolicitacoesModal({ reservas, allRooms, onClose, onApprove, onReject }) {
  const [view,     setView]     = useState('list');
  const [selected, setSelected] = useState(null);
  const [sqQuarto, setSqQuarto] = useState('');
  const [sqObs,    setSqObs]    = useState('');
  const [saving,   setSaving]   = useState(false);

  const solicitadas = reservas.filter((r) => r.status === 'solicitada');

  const openDetail = (r) => {
    setSelected(r); setSqQuarto(''); setSqObs(''); setView('detail');
  };

  const handleApprove = async () => {
    if (!sqQuarto) return;
    setSaving(true);
    try { await onApprove(selected.id, parseInt(sqQuarto), sqObs); }
    finally { setSaving(false); }
  };

  const handleReject = async () => {
    setSaving(true);
    try { await onReject(selected.id); }
    finally { setSaving(false); }
  };

  if (view === 'detail' && selected) {
    const dias     = diffDays(selected.dataInicio, selected.dataFim);
    const pendente = Math.max(0, (selected.valorTotal || 0) - (selected.totalPago || 0));
    return (
      <Modal open onClose={onClose} size="md"
        title={<><Bell size={15} /> Solicitação — {selected.titularNome}</>}
        footer={
          <div className={styles.footerSpread}>
            <Button variant="secondary" onClick={() => setView('list')}>← Voltar</Button>
            <div className={styles.footerRight}>
              <Button variant="danger" disabled={saving} onClick={handleReject}>
                {saving && <Loader2 size={13} className={styles.spin} />} Rejeitar
              </Button>
              <Button variant="primary" disabled={!sqQuarto || saving} onClick={handleApprove}>
                {saving && <Loader2 size={13} className={styles.spin} />} Aprovar
              </Button>
            </div>
          </div>
        }
      >
        <div className={styles.detailBody}>
          <div className={styles.detailGrid2}>
            <div className={styles.detailBox}><span className={styles.detailLabel}>Check-in</span><span className={styles.detailValue}>{fmtDateBR(selected.dataInicio)}</span></div>
            <div className={styles.detailBox}><span className={styles.detailLabel}>Check-out</span><span className={styles.detailValue}>{fmtDateBR(selected.dataFim)}</span></div>
          </div>
          <div className={styles.detailBox}><span className={styles.detailLabel}>Período</span><span className={styles.detailValue}>{diariasTxt(dias)}</span></div>
          <div className={styles.detailBox}>
            <span className={styles.detailLabel}>Hóspedes ({selected.hospedes?.length ?? 0})</span>
            <div className={styles.hospedeList}>
              {(selected.hospedes || []).map((h) => (
                <div key={h.id} className={styles.hospedeRow}>
                  <div className={styles.hospedeAvatar}>{initials(h.nome)}</div>
                  <div><div className={styles.hospedeName}>{h.nome}</div>{h.cpf && <div className={styles.hospedeCpf}>{h.cpf}</div>}</div>
                </div>
              ))}
            </div>
          </div>
          <div className={styles.detailBox}>
            <span className={styles.detailLabel}>Financeiro</span>
            <div className={styles.finGrid}>
              <div className={styles.finBox}><span className={styles.finBoxLabel}>Total</span><span className={styles.finTotal}>{fmtBRL(selected.valorTotal)}</span></div>
              <div className={styles.finBox}><span className={styles.finBoxLabel}>Pago</span><span className={styles.finPago}>{fmtBRL(selected.totalPago)}</span></div>
              <div className={styles.finBox}><span className={styles.finBoxLabel}>Pendente</span><span className={pendente > 0 ? styles.finPendente : styles.finPago}>{fmtBRL(pendente)}</span></div>
            </div>
          </div>
          <div className={styles.detailBox}>
            <span className={styles.detailLabel}>Atribuir Quarto</span>
            <select className={styles.formSelect} value={sqQuarto} onChange={(e) => setSqQuarto(e.target.value)}>
              <option value="">Selecione um quarto...</option>
              {allRooms.map((r) => <option key={r} value={r}>Quarto {fmtRoom(r)}</option>)}
            </select>
          </div>
          <div className={styles.detailBox}>
            <span className={styles.detailLabel}>Observação (opcional)</span>
            <textarea className={styles.obsTextarea} value={sqObs} onChange={(e) => setSqObs(e.target.value)} placeholder="Mensagem para o hóspede..." rows={3} />
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open onClose={onClose} size="md"
      title={<><Bell size={15} /> Solicitações ({solicitadas.length})</>}
      footer={<div className={styles.footerRight}><Button variant="secondary" onClick={onClose}>Fechar</Button></div>}
    >
      {solicitadas.length === 0 ? (
        <div className={styles.emptyState}>Nenhuma solicitação pendente.</div>
      ) : (
        <div className={styles.roomHistoryList}>
          {solicitadas.map((r) => {
            const dias = diffDays(r.dataInicio, r.dataFim);
            return (
              <div key={r.id} className={styles.roomHistoryRow} style={{ cursor: 'pointer' }} onClick={() => openDetail(r)}>
                <div className={styles.roomHistoryLeft}>
                  <div className={styles.roomHistoryDates}>
                    <span className={styles.roomHistoryDate}>{fmtDateBR(r.dataInicio)}</span>
                    <span className={styles.roomHistoryArrow}>→</span>
                    <span className={styles.roomHistoryDate}>{fmtDateBR(r.dataFim)}</span>
                    <span className={styles.roomHistoryNights}>{diariasTxt(dias)}</span>
                  </div>
                  <div className={styles.roomHistoryTitle}>{r.titularNome}</div>
                </div>
                <div className={styles.roomHistoryHospedes}>
                  {(r.hospedes || []).slice(0, 4).map((h) => (
                    <div key={h.id} className={styles.initialsCircleSm} title={h.nome}>{initials(h.nome)}</div>
                  ))}
                  {(r.hospedes || []).length > 4 && <div className={styles.initialsCircleSm}>+{r.hospedes.length - 4}</div>}
                </div>
                <span className={[styles.statusBadgeSm, styles.status_solicitada].join(' ')}>Solicitada</span>
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}

// ─── Room Multi-Select Combobox ───────────────────────────────────────────────
function RoomCombobox({ value, onChange, availableRooms }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const toggle = (r) => {
    const rs = String(r);
    onChange(value.includes(rs) ? value.filter((x) => x !== rs) : [...value, rs]);
  };

  const label = value.length === 0 ? 'Selecione quarto(s)...'
    : value.length === 1 ? `Quarto ${fmtRoom(parseInt(value[0]))}`
    : `${value.length} quartos selecionados`;

  return (
    <div ref={ref} className={styles.comboWrap}>
      <button type="button" className={styles.comboTrigger} onClick={() => setOpen((o) => !o)}>
        <span className={value.length === 0 ? styles.comboPlaceholder : ''}>{label}</span>
        <ChevronDown size={13} style={{ flexShrink: 0, transition: 'transform 0.18s', transform: open ? 'rotate(180deg)' : '' }} />
      </button>
      {open && (
        <div className={styles.comboDropdown}>
          {CATEGORIAS.map((cat) => (
            <div key={cat.id} className={styles.comboGroup}>
              <div className={styles.comboGroupLabel}>{cat.nome}</div>
              <div className={styles.roomBtnRow}>
                {cat.quartos.map((r) => {
                  const avail = availableRooms.includes(r);
                  const sel   = value.includes(String(r));
                  const info  = QUARTOS_INFO[r];
                  return (
                    <button
                      key={r} type="button" disabled={!avail}
                      title={avail ? `${info?.tipo} — ${fmtBRL(info?.preco)}/noite` : 'Ocupado neste período'}
                      className={[styles.roomBtn, sel ? styles.roomBtnSel : '', !avail ? styles.roomBtnUnavail : ''].join(' ')}
                      onClick={() => avail && toggle(r)}
                    >
                      {fmtRoom(r)}
                      {info && <span className={styles.roomBtnTipo}>{info.tipo}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
      {value.length > 0 && (
        <div className={styles.comboChips}>
          {value.map((q) => (
            <div key={q} className={styles.hospedeChip}>
              <span>#{fmtRoom(parseInt(q))}</span>
              <button type="button" className={styles.chipRemove} onClick={() => toggle(parseInt(q))}><X size={10} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Create Reservation Modal ─────────────────────────────────────────────────
function CreateModal({ initialRoom, initialStart, initialAvailable, reservas, onClose, onSave, onNotify }) {
  const STEPS = ['Tipo & Hóspedes', 'Quarto & Período', 'Resumo & Pagamento'];

  const [step,        setStep]        = useState(1);
  const [tipo,        setTipo]        = useState('simples');  // 'simples' | 'grupo'
  const [isOrcamento, setIsOrcamento] = useState(false);

  // Step 1: Hóspedes
  const [hospSearch,       setHospSearch]       = useState('');
  const [hospSelecionados, setHospSelecionados] = useState([]);
  const [manualNome,       setManualNome]       = useState('');

  // Step 2: período único
  const [quartos,  setQuartos]  = useState(initialRoom ? [String(initialRoom)] : []);
  const [checkin,  setCheckin]  = useState(initialStart ? new Date(initialStart + 'T00:00:00') : null);
  const [checkout, setCheckout] = useState(null);

  // Step 2: múltiplos períodos
  const [periodoMode, setPeriodoMode] = useState('unico'); // 'unico' | 'multiplos'
  const [periodos,    setPeriodos]    = useState([]);      // [{ rooms, checkin, checkout }]
  const [mpRooms,     setMpRooms]     = useState([]);
  const [mpCheckin,   setMpCheckin]   = useState(null);
  const [mpCheckout,  setMpCheckout]  = useState(null);

  // Step 3: Pagamentos
  const [pagamentos,   setPagamentos]   = useState([]);
  const [pagDesc,      setPagDesc]      = useState('Entrada');
  const [pagForma,     setPagForma]     = useState('PIX');
  const [pagValor,     setPagValor]     = useState('');
  const [showPagModal, setShowPagModal] = useState(false);
  const [saving,       setSaving]       = useState(false);

  // Derived
  const checkinStr  = checkin  ? formatDate(checkin)  : '';
  const checkoutStr = checkout ? formatDate(checkout) : '';
  const dias        = checkinStr && checkoutStr ? diffDays(checkinStr, checkoutStr) : 0;

  const availableRooms = useMemo(() => {
    if (!checkinStr || !checkoutStr) return initialAvailable || CATEGORIAS.flatMap((c) => c.quartos);
    return CATEGORIAS.flatMap((c) => c.quartos).filter(
      (r) => !reservas.some((res) => res.quarto === r && res.dataInicio < checkoutStr && res.dataFim > checkinStr)
    );
  }, [checkinStr, checkoutStr, reservas, initialAvailable]);

  const mpAvailableRooms = useMemo(() => {
    if (!mpCheckin || !mpCheckout) return CATEGORIAS.flatMap((c) => c.quartos);
    const ci = formatDate(mpCheckin);
    const co = formatDate(mpCheckout);
    const alreadyPicked = periodos.flatMap((p) => {
      const pi = formatDate(p.checkin); const po = formatDate(p.checkout);
      if (pi < co && po > ci) return p.rooms.map((r) => parseInt(r));
      return [];
    });
    return CATEGORIAS.flatMap((c) => c.quartos).filter(
      (r) => !alreadyPicked.includes(r) && !reservas.some((res) => res.quarto === r && res.dataInicio < co && res.dataFim > ci)
    );
  }, [mpCheckin, mpCheckout, periodos, reservas]);

  // Financial
  const valorTotalUnico = quartos.reduce((sum, q) => {
    const qi = QUARTOS_INFO[parseInt(q)]; return sum + dias * (qi?.preco || 0);
  }, 0);
  const valorTotalMulti = periodos.reduce((sum, p) => {
    const d  = diffDays(formatDate(p.checkin), formatDate(p.checkout));
    return sum + p.rooms.reduce((s, q) => { const qi = QUARTOS_INFO[parseInt(q)]; return s + d * (qi?.preco || 0); }, 0);
  }, 0);
  const valorTotal = periodoMode === 'multiplos' ? valorTotalMulti : valorTotalUnico;
  const totalPago  = pagamentos.reduce((s, p) => s + p.valor, 0);
  const pendente   = Math.max(0, valorTotal - totalPago);

  const filteredHospedes = hospSearch.trim().length >= 2
    ? HOSPEDES_CADASTRADOS.filter((h) => h.nome.toLowerCase().includes(hospSearch.toLowerCase()))
    : [];

  const addHospede  = (h)  => { if (hospSelecionados.find((x) => x.id === h.id)) return; setHospSelecionados((p) => [...p, h]); setHospSearch(''); };
  const addManual   = ()   => { if (!manualNome.trim()) return; setHospSelecionados((p) => [...p, { id: Date.now(), nome: manualNome.trim(), cpf: '' }]); setManualNome(''); };
  const remHospede  = (id) => setHospSelecionados((p) => p.filter((x) => x.id !== id));

  const addPagamento = () => {
    const v = parseFloat(pagValor.replace(',', '.')) || 0;
    if (!v || !pagForma) return;
    setPagamentos((p) => [...p, { id: Date.now(), descricao: pagDesc, formaPagamento: pagForma, valor: v }]);
    setPagValor(''); setPagDesc('Entrada');
  };

  const addPeriodo = () => {
    if (!mpRooms.length || !mpCheckin || !mpCheckout) return;
    setPeriodos((p) => [...p, { rooms: [...mpRooms], checkin: mpCheckin, checkout: mpCheckout }]);
    setMpRooms([]); setMpCheckin(null); setMpCheckout(null);
  };

  // Room type summary
  const allSelectedRooms = periodoMode === 'multiplos'
    ? [...new Set(periodos.flatMap((p) => p.rooms))]
    : quartos;
  const roomTypeSummary = allSelectedRooms.reduce((acc, q) => {
    const t = QUARTOS_INFO[parseInt(q)]?.tipo || 'OUTRO'; acc[t] = (acc[t] || 0) + 1; return acc;
  }, {});
  const roomSummaryStr = Object.entries(roomTypeSummary).map(([t, c]) => `${c}x ${t}`).join(', ');

  const canNext2 = periodoMode === 'unico'
    ? quartos.length > 0 && checkinStr && checkoutStr && dias > 0
    : periodos.length > 0;

  const handleSave = async () => {
    if (isOrcamento) { onNotify('Orçamento gerado! (Em desenvolvimento)'); onClose(); return; }
    setSaving(true);
    try {
      const titular  = hospSelecionados[0]?.nome || manualNome.trim() || 'Hóspede';
      const hospList = hospSelecionados.length > 0
        ? hospSelecionados.map((h) => ({ id: h.id, nome: h.nome, cpf: h.cpf || '' }))
        : [{ id: Date.now(), nome: titular, cpf: '' }];

      let dataArr;
      if (periodoMode === 'multiplos') {
        dataArr = periodos.flatMap((p) => {
          const ci = formatDate(p.checkin); const co = formatDate(p.checkout); const d = diffDays(ci, co);
          return p.rooms.map((q) => {
            const cat = CATEGORIAS.find((c) => c.quartos.includes(parseInt(q)));
            const qi  = QUARTOS_INFO[parseInt(q)];
            return { quarto: parseInt(q), categoria: cat?.nome || '', titularNome: titular, empresaNome: null,
              quantidadeAcompanhantes: Math.max(0, hospList.length - 1), dataInicio: ci, dataFim: co,
              chegadaPrevista: ci + ' 14:00', saidaPrevista: co + ' 12:00', status: 'confirmada',
              hospedes: hospList, pagamentos, valorTotal: d * (qi?.preco || 0), totalPago };
          });
        });
      } else {
        dataArr = quartos.map((q) => {
          const cat = CATEGORIAS.find((c) => c.quartos.includes(parseInt(q)));
          const qi  = QUARTOS_INFO[parseInt(q)];
          return { quarto: parseInt(q), categoria: cat?.nome || '', titularNome: titular, empresaNome: null,
            quantidadeAcompanhantes: Math.max(0, hospList.length - 1), dataInicio: checkinStr, dataFim: checkoutStr,
            chegadaPrevista: checkinStr + ' 14:00', saidaPrevista: checkoutStr + ' 12:00', status: 'confirmada',
            hospedes: hospList, pagamentos, valorTotal: dias * (qi?.preco || 0), totalPago };
        });
      }
      await onSave(dataArr);
    } finally { setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} size="lg"
      title={<><Plus size={15} /> Nova Reserva</>}
      footer={
        <div className={styles.footerSpread}>
          <div>{step > 1 && <Button variant="secondary" onClick={() => setStep((s) => s - 1)}>Voltar</Button>}</div>
          <div className={styles.footerRight}>
            <Button variant="secondary" onClick={onClose}>Cancelar</Button>
            {step < 3 ? (
              <Button variant="primary" disabled={step === 2 && !canNext2} onClick={() => setStep((s) => s + 1)}>Próximo</Button>
            ) : (
              <Button variant="primary" disabled={!canNext2 || saving} onClick={handleSave}>
                {saving && <Loader2 size={13} className={styles.spin} />}
                {isOrcamento ? 'Gerar Orçamento' : 'Criar Reserva'}
              </Button>
            )}
          </div>
        </div>
      }
    >
      {/* Step bar */}
      <div className={styles.stepBar}>
        {STEPS.map((s, i) => (
          <div key={i} className={[styles.stepItem, step === i + 1 ? styles.stepActive : '', step > i + 1 ? styles.stepDone : ''].join(' ')}>
            <div className={styles.stepDot}>{step > i + 1 ? '✓' : i + 1}</div>
            <span className={styles.stepLabel}>{s}</span>
          </div>
        ))}
      </div>

      {/* Live summary bar */}
      {(allSelectedRooms.length > 0 || checkinStr || valorTotal > 0) && (
        <div className={styles.summaryBar}>
          {allSelectedRooms.length > 0 && (
            <span>{allSelectedRooms.length === 1 ? `Quarto ${fmtRoom(parseInt(allSelectedRooms[0]))}` : `${allSelectedRooms.length} quartos`}</span>
          )}
          {periodoMode === 'unico' && checkinStr && checkoutStr && dias > 0 && (
            <span>{fmtDateBR(checkinStr)} → {fmtDateBR(checkoutStr)} · {diariasTxt(dias)}</span>
          )}
          {periodoMode === 'multiplos' && periodos.length > 0 && (
            <span>{periodos.length} período{periodos.length !== 1 ? 's' : ''}</span>
          )}
          {valorTotal > 0 && <span className={styles.summaryTotal}>{fmtBRL(valorTotal)}</span>}
          {isOrcamento && <span className={styles.orcamentoBadge}>Orçamento</span>}
        </div>
      )}

      {/* ── Step 1: Tipo & Hóspedes ────────────────────────────────────────── */}
      {step === 1 && (
        <div className={styles.formStack}>
          <FormField label="Tipo de Reserva">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div className={styles.tipoRow}>
                {[['simples', 'Reserva Simples'], ['grupo', 'Reserva em Grupo']].map(([v, l]) => (
                  <button key={v} type="button"
                    className={[styles.tipoBtn, tipo === v ? styles.tipoBtnActive : ''].join(' ')}
                    onClick={() => { setTipo(v); if (v !== 'grupo') setQuartos((q) => q.slice(0, 1)); }}
                  >{l}</button>
                ))}
              </div>
              <label className={styles.orcamentoToggle}>
                <input type="checkbox" checked={isOrcamento} onChange={(e) => setIsOrcamento(e.target.checked)} />
                <span>É orçamento</span>
              </label>
            </div>
          </FormField>

          <FormField label="Hóspedes">
            <div className={styles.hospSearchWrap}>
              <Search size={13} className={styles.hospSearchIcon} />
              <input className={styles.formInput} style={{ paddingLeft: 30 }} value={hospSearch}
                onChange={(e) => setHospSearch(e.target.value)} placeholder="Buscar hóspede cadastrado..." />
            </div>
            {filteredHospedes.length > 0 && (
              <div className={styles.searchResultsList}>
                {filteredHospedes.slice(0, 6).map((h) => (
                  <div key={h.id} className={styles.searchResultItem} onClick={() => addHospede(h)}>
                    <div className={styles.initialsCircle}>{initials(h.nome)}</div>
                    <div><div className={styles.searchResultName}>{h.nome}</div>{h.cpf && <div className={styles.hospedeCpf}>{h.cpf}</div>}</div>
                    <Plus size={13} className={styles.addIcon} />
                  </div>
                ))}
              </div>
            )}
            {hospSelecionados.length > 0 && (
              <div className={styles.selectedChips}>
                {hospSelecionados.map((h) => (
                  <div key={h.id} className={styles.hospedeChip}>
                    <div className={styles.initialsCircleSm}>{initials(h.nome)}</div>
                    <span>{h.nome}</span>
                    <button type="button" className={styles.chipRemove} onClick={() => remHospede(h.id)}><X size={10} /></button>
                  </div>
                ))}
              </div>
            )}
            <div className={styles.manualRow}>
              <input className={styles.formInput} value={manualNome} onChange={(e) => setManualNome(e.target.value)}
                placeholder="Ou informe o nome do titular..." onKeyDown={(e) => e.key === 'Enter' && addManual()} />
              <Button variant="secondary" onClick={addManual} disabled={!manualNome.trim()}><Plus size={13} /></Button>
            </div>
          </FormField>
        </div>
      )}

      {/* ── Step 2: Quarto & Período ───────────────────────────────────────── */}
      {step === 2 && (
        <div className={styles.formStack}>
          {/* Período mode tabs */}
          <div className={styles.periodoTabs}>
            {[['unico', 'Período Único'], ['multiplos', 'Múltiplos Períodos']].map(([v, l]) => (
              <button key={v} type="button"
                className={[styles.periodoTab, periodoMode === v ? styles.periodoTabActive : ''].join(' ')}
                onClick={() => setPeriodoMode(v)}
              >{l}</button>
            ))}
          </div>

          {periodoMode === 'unico' && (
            <>
              <FormField label="Período de estadia">
                <DatePicker mode="range" startDate={checkin} endDate={checkout}
                  onRangeChange={({ start, end }) => { setCheckin(start); setCheckout(end); }}
                  placeholder="Selecione check-in → check-out" minDate={new Date()} />
              </FormField>
              <FormField label={tipo === 'grupo' ? 'Quartos (múltipla seleção)' : 'Quarto'}>
                <RoomCombobox value={quartos}
                  onChange={(v) => tipo !== 'grupo' ? setQuartos(v.slice(-1)) : setQuartos(v)}
                  availableRooms={availableRooms} />
              </FormField>
            </>
          )}

          {periodoMode === 'multiplos' && (
            <>
              {periodos.length > 0 && (
                <div className={styles.periodosList}>
                  {periodos.map((p, i) => {
                    const ci = formatDate(p.checkin); const co = formatDate(p.checkout);
                    return (
                      <div key={i} className={styles.periodoItem}>
                        <div className={styles.periodoItemInfo}>
                          <span className={styles.periodoItemRooms}>{p.rooms.map((q) => `#${fmtRoom(parseInt(q))}`).join(', ')}</span>
                          <span className={styles.periodoItemDates}>{fmtDateBR(ci)} → {fmtDateBR(co)} · {diariasTxt(diffDays(ci, co))}</span>
                        </div>
                        <button type="button" className={styles.chipRemove} onClick={() => setPeriodos((ps) => ps.filter((_, j) => j !== i))}><X size={12} /></button>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className={styles.mpForm}>
                <FormField label="Quartos para este período">
                  <RoomCombobox value={mpRooms} onChange={setMpRooms} availableRooms={mpAvailableRooms} />
                </FormField>
                <FormField label="Período">
                  <DatePicker mode="range" startDate={mpCheckin} endDate={mpCheckout}
                    onRangeChange={({ start, end }) => { setMpCheckin(start); setMpCheckout(end); }}
                    placeholder="Check-in → Check-out" minDate={new Date()} />
                </FormField>
                <Button variant="secondary" disabled={!mpRooms.length || !mpCheckin || !mpCheckout} onClick={addPeriodo}>
                  <Plus size={13} /> Adicionar Período
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Step 3: Resumo & Pagamentos ───────────────────────────────────── */}
      {step === 3 && (
        <div className={styles.formStack}>
          <div className={styles.finSummaryGrid}>
            <div className={styles.finSummaryBox}>
              <span className={styles.finSummaryLabel}>Total</span>
              <span className={styles.finSummaryValue}>{fmtBRL(valorTotal)}</span>
            </div>
            <div className={styles.finSummaryBox}>
              <span className={styles.finSummaryLabel}>Pago</span>
              <span className={[styles.finSummaryValue, styles.finPago].join(' ')}>{fmtBRL(totalPago)}</span>
            </div>
            <div className={styles.finSummaryBox}>
              <span className={styles.finSummaryLabel}>Pendente</span>
              <span className={[styles.finSummaryValue, pendente > 0 ? styles.finPendente : styles.finPago].join(' ')}>{fmtBRL(pendente)}</span>
            </div>
          </div>

          {!isOrcamento && (
            <div className={styles.detailBox}>
              <div className={styles.pagSectionHeader}>
                <span className={styles.detailLabel}>Pagamentos</span>
                <Button variant="secondary" onClick={() => setShowPagModal(true)}><Plus size={13} /> Adicionar</Button>
              </div>
              {pagamentos.length === 0 ? (
                <div className={styles.pagEmpty}>Nenhum pagamento adicionado</div>
              ) : (
                pagamentos.map((p) => (
                  <div key={p.id} className={styles.pagItem}>
                    <span className={styles.pagDesc}>{p.descricao}</span>
                    <span className={styles.pagForma}>{p.formaPagamento}</span>
                    <span className={styles.finPago}>{fmtBRL(p.valor)}</span>
                    <button type="button" className={styles.chipRemove} onClick={() => setPagamentos((prev) => prev.filter((x) => x.id !== p.id))}><X size={10} /></button>
                  </div>
                ))
              )}
            </div>
          )}

          <div className={styles.detailBox}>
            <span className={styles.detailLabel}>Resumo da Reserva</span>
            {allSelectedRooms.length > 0 && (
              <>
                <div className={styles.finRow}><span>Quarto{allSelectedRooms.length > 1 ? 's' : ''}:</span><span>{allSelectedRooms.map((q) => `#${fmtRoom(parseInt(q))}`).join(', ')}</span></div>
                {roomSummaryStr && <div className={styles.finRow}><span>Disposição:</span><span>{roomSummaryStr}</span></div>}
              </>
            )}
            {periodoMode === 'unico' && checkinStr && checkoutStr && (
              <div className={styles.finRow}><span>Período:</span><span>{fmtDateBR(checkinStr)} → {fmtDateBR(checkoutStr)} ({diariasTxt(dias)})</span></div>
            )}
            {periodoMode === 'multiplos' && periodos.map((p, i) => {
              const ci = formatDate(p.checkin); const co = formatDate(p.checkout);
              return <div key={i} className={styles.finRow}><span>Período {i + 1}:</span><span>{p.rooms.map((q) => `#${fmtRoom(parseInt(q))}`).join(', ')} · {fmtDateBR(ci)} → {fmtDateBR(co)}</span></div>;
            })}
            {(hospSelecionados.length > 0 || manualNome.trim()) && (
              <div className={styles.finRow}><span>Titular:</span><span>{hospSelecionados[0]?.nome || manualNome.trim()}</span></div>
            )}
            <div className={styles.finRow}><span>Tipo:</span><span style={{ textTransform: 'capitalize' }}>{tipo}{isOrcamento ? ' (orçamento)' : ''}</span></div>
          </div>

          {hospSelecionados.length > 0 && (
            <div className={styles.detailBox}>
              <span className={styles.detailLabel}>Hóspedes</span>
              <div className={styles.hospedeList}>
                {hospSelecionados.map((h) => (
                  <div key={h.id} className={styles.hospedeRow}>
                    <div className={styles.hospedeAvatar}>{initials(h.nome)}</div>
                    <div><div className={styles.hospedeName}>{h.nome}</div>{h.cpf && <div className={styles.hospedeCpf}>{h.cpf}</div>}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Payment sub-modal */}
      {showPagModal && (
        <Modal open onClose={() => setShowPagModal(false)} size="sm" title="Adicionar Pagamento"
          footer={
            <div className={styles.footerRight}>
              <Button variant="secondary" onClick={() => setShowPagModal(false)}>Cancelar</Button>
              <Button variant="primary" disabled={!pagValor} onClick={() => { addPagamento(); setShowPagModal(false); }}>Confirmar</Button>
            </div>
          }
        >
          <div className={styles.formStack}>
            <FormField label="Descrição">
              <input className={styles.formInput} value={pagDesc} onChange={(e) => setPagDesc(e.target.value)} placeholder="Entrada, parcela..." />
            </FormField>
            <FormField label="Forma de Pagamento">
              <select className={styles.formSelect} value={pagForma} onChange={(e) => setPagForma(e.target.value)}>
                {FORMAS_PAG.map((f) => <option key={f}>{f}</option>)}
              </select>
            </FormField>
            <FormField label="Valor (R$)">
              <input className={styles.formInput} value={pagValor} onChange={(e) => setPagValor(e.target.value)} placeholder="0,00" />
            </FormField>
          </div>
        </Modal>
      )}
    </Modal>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function BookingCalendar() {
  const today    = new Date(); today.setHours(0, 0, 0, 0);
  const todayStr = formatDate(today);

  const [reservas,    setReservas]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [viewDate,    setViewDate]    = useState(() => { const d = new Date(today); d.setDate(d.getDate() - 1); return d; });
  const [collapsedCats,   setCollapsedCats]   = useState({});
  const [selectedReserva, setSelectedReserva] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createInit,      setCreateInit]      = useState({ room: null, start: null, end: null, available: null });
  const [searchTerm,      setSearchTerm]      = useState('');
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [showSolicitacoes,   setShowSolicitacoes]   = useState(false);
  const [dayModal,  setDayModal]  = useState(null);
  const [roomModal, setRoomModal] = useState(null);
  const [selRoom,   setSelRoom]   = useState(null);
  const [selStart,  setSelStart]  = useState(null);
  const [selHover,  setSelHover]  = useState(null);
  const [dragState, setDragState] = useState(null);
  const [ghostDrag, setGhostDrag] = useState(null);
  const [confirmData, setConfirmData] = useState(null);
  const [notif,       setNotif]       = useState(null);

  const lastHoverRef = useRef(null);
  const searchRef    = useRef(null);

  const notify = useCallback((msg, type = 'success') => {
    setNotif({ message: msg, type });
    setTimeout(() => setNotif(null), 3500);
  }, []);

  useEffect(() => {
    calendarApi.listarReservas().then((d) => { setReservas(d); setLoading(false); });
  }, []);

  // Close search dropdown on outside click
  useEffect(() => {
    const h = (e) => { if (searchRef.current && !searchRef.current.contains(e.target)) setShowSearchDropdown(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const days        = Array.from({ length: VISIBLE_DAYS }, (_, i) => { const d = new Date(viewDate); d.setDate(d.getDate() + i); return d; });
  const daysStr     = days.map((d) => formatDate(d));
  const firstDayStr = daysStr[0];
  const lastDayStr  = daysStr[daysStr.length - 1];

  const shiftMonth = (delta) => {
    setViewDate((d) => {
      const target = new Date(d.getFullYear(), d.getMonth() + delta, 1);
      const isCurrent = target.getFullYear() === today.getFullYear() && target.getMonth() === today.getMonth();
      if (isCurrent) { const y = new Date(today); y.setDate(y.getDate() - 1); return y; }
      return target;
    });
  };

  const monthLabel = viewDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  const filteredReservas = searchTerm.trim().length >= 2
    ? reservas.filter((r) => r.titularNome.toLowerCase().includes(searchTerm.toLowerCase()) || (r.empresaNome && r.empresaNome.toLowerCase().includes(searchTerm.toLowerCase())))
    : reservas;

  const searchResults = searchTerm.trim().length >= 2
    ? reservas.filter((r) => r.titularNome.toLowerCase().includes(searchTerm.toLowerCase()) || (r.empresaNome && r.empresaNome.toLowerCase().includes(searchTerm.toLowerCase()))).slice(0, 8)
    : [];

  const navigateToReserva = (r) => { setViewDate(new Date(r.dataInicio + 'T00:00:00')); setSearchTerm(''); setShowSearchDropdown(false); };

  const solicitadasCount = reservas.filter((r) => r.status === 'solicitada').length;
  const allRooms         = CATEGORIAS.flatMap((c) => c.quartos);

  const handleApproveSolicitacao = async (id, quarto, obs) => {
    const upd = await calendarApi.atualizarReserva(id, { status: 'confirmada', quarto, ...(obs ? { observacao: obs } : {}) });
    setReservas((rs) => rs.map((r) => r.id === id ? upd : r));
    notify('Solicitação aprovada!'); setShowSolicitacoes(false);
  };
  const handleRejectSolicitacao = async (id) => {
    await calendarApi.cancelarReserva(id);
    setReservas((rs) => rs.filter((r) => r.id !== id));
    notify('Solicitação rejeitada.'); setShowSolicitacoes(false);
  };

  const handleCellClick = (room, dateStr) => {
    if (dragState) return;
    if (selRoom === room && selStart !== null) {
      if (dateStr === selStart) { setSelRoom(null); setSelStart(null); setSelHover(null); return; }
      const start = dateStr < selStart ? dateStr : selStart;
      const end   = dateStr < selStart ? selStart : dateStr;
      setCreateInit({ room, start, end, available: null });
      setShowCreateModal(true);
      setSelRoom(null); setSelStart(null); setSelHover(null); return;
    }
    const occupied = filteredReservas.some((r) => r.quarto === room && r.dataInicio <= dateStr && r.dataFim > dateStr);
    if (occupied) return;
    setSelRoom(room); setSelStart(dateStr); setSelHover(dateStr);
  };

  const handleRoomMouseMove = (e, room) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const idx  = Math.floor((e.clientX - rect.left) / DAY_CELL_W);
    if (idx < 0 || idx >= VISIBLE_DAYS) return;
    const dateStr = daysStr[idx];
    const key = `${room}-${dateStr}`;
    if (lastHoverRef.current === key) return;
    lastHoverRef.current = key;
    if (dragState) handleDragHover(room, dateStr);
    else if (selRoom === room) setSelHover(dateStr);
  };

  const isCellSelected = (room, dateStr) => {
    if (selRoom !== room || !selStart) return false;
    const hov = selHover || selStart;
    const lo  = selStart < hov ? selStart : hov;
    const hi  = selStart < hov ? hov : selStart;
    return dateStr >= lo && dateStr <= hi;
  };

  const handleBarMouseDown = (e, r) => {
    e.preventDefault(); e.stopPropagation(); if (e.button !== 0) return;
    setDragState({ type: 'move', id: r.id, origQuarto: r.quarto, origInicio: r.dataInicio, origFim: r.dataFim });
    setGhostDrag({ quarto: r.quarto, dataInicio: r.dataInicio, dataFim: r.dataFim });
  };
  const handleResizeMouseDown = (e, r, edge) => {
    e.preventDefault(); e.stopPropagation(); if (e.button !== 0) return;
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
      if (dateStr < dragState.origFim) setGhostDrag((g) => ({ ...g, dataInicio: dateStr }));
    } else if (dragState.type === 'resize-r') {
      if (dragState.origQuarto !== room) return;
      const nd = addDays(dateStr, 1);
      if (nd > dragState.origInicio) setGhostDrag((g) => ({ ...g, dataFim: nd }));
    }
  };

  const dragStateRef = useRef(dragState); const ghostDragRef = useRef(ghostDrag); const reservasRef = useRef(reservas);
  dragStateRef.current = dragState; ghostDragRef.current = ghostDrag; reservasRef.current = reservas;

  const handleGlobalMouseUp = useCallback(() => {
    const ds = dragStateRef.current; const gd = ghostDragRef.current;
    if (!ds || !gd) return;
    const r = reservasRef.current.find((x) => x.id === ds.id);
    if (!r) { setDragState(null); setGhostDrag(null); return; }
    const changed = gd.quarto !== r.quarto || gd.dataInicio !== r.dataInicio || gd.dataFim !== r.dataFim;
    if (changed) {
      const dias = diffDays(gd.dataInicio, gd.dataFim);
      const message = ds.type === 'move'
        ? gd.quarto !== r.quarto ? `Mover para Quarto ${fmtRoom(gd.quarto)}: ${gd.dataInicio} → ${gd.dataFim} (${diariasTxt(dias)})?`
          : `Alterar datas para ${gd.dataInicio} → ${gd.dataFim} (${diariasTxt(dias)})?`
        : `Ajustar período para ${gd.dataInicio} → ${gd.dataFim} (${diariasTxt(dias)})?`;
      const snapshot = { ...gd }; const resId = ds.id;
      setConfirmData({
        title: ds.type === 'move' ? 'Mover Reserva' : 'Ajustar Período', message,
        onConfirm: async () => {
          const upd = await calendarApi.atualizarReserva(resId, snapshot);
          setReservas((rs) => rs.map((x) => x.id === resId ? upd : x));
          notify(ds.type === 'move' ? 'Reserva movida.' : 'Período ajustado.'); setConfirmData(null);
        },
      });
    }
    setDragState(null); setGhostDrag(null); lastHoverRef.current = null;
  }, [notify]);

  useEffect(() => { window.addEventListener('mouseup', handleGlobalMouseUp); return () => window.removeEventListener('mouseup', handleGlobalMouseUp); }, [handleGlobalMouseUp]);
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') { setDragState(null); setGhostDrag(null); lastHoverRef.current = null; setSelRoom(null); setSelStart(null); setSelHover(null); } };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, []);

  const handleSaveNew = async (dataArr) => {
    const arr   = Array.isArray(dataArr) ? dataArr : [dataArr];
    const novas = await Promise.all(arr.map((d) => calendarApi.criarReserva(d)));
    setReservas((rs) => [...rs, ...novas]);
    notify(novas.length > 1 ? `${novas.length} reservas criadas!` : 'Reserva criada!');
    setShowCreateModal(false);
  };
  const handleCancelReserva = async (id) => {
    await calendarApi.cancelarReserva(id);
    setReservas((rs) => rs.filter((r) => r.id !== id));
    notify('Reserva cancelada.');
  };

  // ── Render bars ────────────────────────────────────────────────────────────
  const renderBars = (room) => {
    const toRender = filteredReservas.filter((r) => r.quarto === room);
    const bars = [];
    for (const r of toRender) {
      const isBeingDragged = dragState?.id === r.id;
      const useGhost       = isBeingDragged && ghostDrag && ghostDrag.quarto === room;
      const displayR       = useGhost ? { ...r, ...ghostDrag } : r;
      const el = buildBar(displayR, r, { opacity: isBeingDragged && !useGhost ? 0.35 : 1, isGhost: false, isDragging: isBeingDragged });
      if (el) bars.push(el);
    }
    if (dragState && ghostDrag && ghostDrag.quarto === room) {
      const orig = reservas.find((r) => r.id === dragState.id);
      if (orig && orig.quarto !== room) {
        const el = buildBar({ ...orig, ...ghostDrag }, orig, { isGhost: true });
        if (el) bars.push(el);
      }
    }
    return bars;
  };

  const buildBar = (display, orig, { opacity = 1, isGhost = false, isDragging = false }) => {
    const { dataInicio, dataFim } = display;
    const startInView = dataInicio >= firstDayStr;
    const endInView   = dataFim   <= addDays(lastDayStr, 1);

    let left;
    if (!startInView) { left = 0; }
    else { const idx = daysStr.indexOf(dataInicio); if (idx < 0) return null; left = idx * DAY_CELL_W + HALF; }

    let right;
    if (!endInView) { right = VISIBLE_DAYS * DAY_CELL_W; }
    else {
      const idx = daysStr.indexOf(dataFim);
      if (idx < 0 && dataFim > lastDayStr) right = VISIBLE_DAYS * DAY_CELL_W;
      else if (idx < 0) return null;
      else right = idx * DAY_CELL_W + HALF;
    }

    const width = right - left;
    if (width <= 4) return null;

    const rLeft        = startInView ? 5 : 0;
    const rRight       = endInView   ? 5 : 0;
    const borderRadius = `${rLeft}px ${rRight}px ${rRight}px ${rLeft}px`;
    const dias         = diffDays(orig.dataInicio, orig.dataFim);
    const totalPeople  = 1 + (orig.quantidadeAcompanhantes || 0);
    const key          = isGhost ? `ghost-${orig.id}` : `bar-${orig.id}`;

    const currentDiaria = orig.status === 'hospedado'
      ? Math.min(dias, Math.max(1, diffDays(orig.dataInicio, todayStr) + 1)) : null;

    const isCancelado = orig.status === 'cancelado';

    return (
      <div key={key}
        className={[styles.bar, styles[`bar_${orig.status}`], isGhost ? styles.barGhost : '', isDragging ? styles.barDragging : ''].join(' ')}
        style={{ left, width, borderRadius, opacity: isCancelado ? Math.min(opacity, 0.55) : opacity }}
        onMouseDown={isGhost ? undefined : (e) => handleBarMouseDown(e, orig)}
        onClick={(e) => { e.stopPropagation(); if (!dragState) setSelectedReserva(orig); }}
        title={`${orig.titularNome} — ${diariasTxt(dias)}`}
      >
        {startInView && !isGhost && (
          <div className={styles.resizeHandle} onMouseDown={(e) => handleResizeMouseDown(e, orig, 'resize-l')} />
        )}
        <div className={styles.barContent}>
          <span className={styles.barName}>{orig.titularNome}</span>
          {isGhost ? (
            <div className={styles.barDateLabel}>{display.dataInicio} → {display.dataFim} · {diariasTxt(diffDays(display.dataInicio, display.dataFim))}</div>
          ) : (
            <div className={styles.barMeta}>
              <span className={styles.barBadge}><Users size={9} /> {totalPeople}</span>
              <span className={styles.barBadge}>
                <CalendarDays size={9} />
                {currentDiaria !== null ? `${currentDiaria}/${dias}` : diariasTxt(dias)}
              </span>
              {orig.empresaNome && <span className={styles.barBadge}><Building2 size={9} /></span>}
            </div>
          )}
        </div>
        {endInView && !isGhost && (
          <div className={[styles.resizeHandle, styles.resizeHandleRight].join(' ')} onMouseDown={(e) => handleResizeMouseDown(e, orig, 'resize-r')} />
        )}
      </div>
    );
  };

  const gridTotalW = LEFT_W + VISIBLE_DAYS * DAY_CELL_W;

  return (
    <div className={styles.page}>
      <Notification notification={notif} />
      <div className={styles.card}>

        {/* Header */}
        <div className={styles.tableHeader}>
          <div>
            <h2 className={styles.h2}>Calendário de Reservas</h2>
            <p className={styles.subtitle}>Visualize e gerencie reservas por quarto e período</p>
          </div>
          <div className={styles.tableTools}>
            <div className={styles.navGroup}>
              <button className={styles.navBtn} onClick={() => shiftMonth(-1)}><ChevronLeft size={14} /></button>
              <span className={styles.monthLabel}>{monthLabel}</span>
              <button className={styles.navBtn} onClick={() => shiftMonth(1)}><ChevronRight size={14} /></button>
            </div>

            {/* Search combobox */}
            <div className={styles.searchWrap} ref={searchRef}>
              <Search size={13} className={styles.searchIcon} />
              <input className={styles.searchInput} value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setShowSearchDropdown(true); }}
                onFocus={() => searchTerm.length >= 2 && setShowSearchDropdown(true)}
                placeholder="Buscar hóspede..." />
              {searchTerm && (
                <button className={styles.clearSearch} onClick={() => { setSearchTerm(''); setShowSearchDropdown(false); }}><X size={12} /></button>
              )}
              {showSearchDropdown && searchResults.length > 0 && (
                <div className={styles.searchDropdown}>
                  {searchResults.map((r) => {
                    const dias = diffDays(r.dataInicio, r.dataFim);
                    return (
                      <div key={r.id} className={styles.searchDropItem} onClick={() => navigateToReserva(r)}>
                        <div className={styles.initialsCircleSm}>{initials(r.titularNome)}</div>
                        <div className={styles.searchDropInfo}>
                          <div className={styles.searchDropName}><span className={styles.searchDropRoom}>#{fmtRoom(r.quarto)}</span> {r.titularNome}</div>
                          <div className={styles.searchDropDates}>{fmtDateBR(r.dataInicio)} → {fmtDateBR(r.dataFim)} · {diariasTxt(dias)}</div>
                        </div>
                        <span className={[styles.statusBadgeSm, styles[`status_${r.status}`]].join(' ')}>{STATUS_LABEL[r.status]}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Solicitações */}
            <div className={styles.solBtnWrap}>
              <Button variant="secondary" onClick={() => setShowSolicitacoes(true)}><Bell size={14} /> Solicitações</Button>
              {solicitadasCount > 0 && <span className={styles.solBadge}>{solicitadasCount}</span>}
            </div>

            <Button variant="primary" onClick={() => { setCreateInit({ room: null, start: null, end: null, available: null }); setShowCreateModal(true); }}>
              <Plus size={14} /> Nova Reserva
            </Button>
          </div>
        </div>

        {/* Selection hint */}
        {selStart && (
          <div className={styles.selHint}>
            <span>Quarto <strong>{fmtRoom(selRoom)}</strong> · a partir de <strong>{selStart}</strong> — clique outra data para definir fim</span>
            <button className={styles.selHintClose} onClick={() => { setSelRoom(null); setSelStart(null); setSelHover(null); }}><X size={12} /></button>
          </div>
        )}

        {/* Grid */}
        <div className={styles.gridScroll}>
          {loading ? (
            <div className={styles.loadingRow}><Loader2 size={20} className={styles.spin} /> Carregando...</div>
          ) : (
            <>
              <div className={styles.dayHeaderRow} style={{ width: gridTotalW }}>
                <div className={styles.cornerCell} style={{ width: LEFT_W, height: HDR_H }}>
                  <BedDouble size={11} /><span>Quarto</span>
                </div>
                {days.map((day, idx) => {
                  const dStr      = daysStr[idx];
                  const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                  const isToday   = dStr === todayStr;
                  return (
                    <div key={idx}
                      className={[styles.dayHeader, isWeekend ? styles.dayHeaderWeekend : '', isToday ? styles.dayHeaderToday : ''].join(' ')}
                      style={{ width: DAY_CELL_W, height: HDR_H }}
                      onClick={() => setDayModal({ dateStr: dStr })}
                      title={`Ver reservas — ${fmtDateBR(dStr)}`}
                    >
                      <span className={[styles.dayWeekday, isWeekend ? styles.dayWeekdayRed : ''].join(' ')}>
                        {day.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')}
                      </span>
                      <span className={[styles.dayNum, isToday ? styles.dayNumToday : ''].join(' ')}>
                        {day.getDate()}
                      </span>
                    </div>
                  );
                })}
              </div>

              {CATEGORIAS.map((cat) => {
                const isCollapsed = !!collapsedCats[cat.id];
                return (
                  <div key={cat.id}>
                    <div className={styles.catRow} style={{ width: gridTotalW, height: CAT_H }}
                      onClick={() => setCollapsedCats((p) => ({ ...p, [cat.id]: !p[cat.id] }))}>
                      <div className={styles.catLabel} style={{ width: LEFT_W }}>
                        <ChevronDown size={11} className={isCollapsed ? styles.chevronCollapsed : styles.chevronOpen} />
                        <BedDouble size={11} />{cat.nome}
                      </div>
                      {days.map((_, i) => <div key={i} className={styles.catCell} style={{ width: DAY_CELL_W }} />)}
                    </div>

                    {!isCollapsed && cat.quartos.map((room) => (
                      <div key={room} className={styles.roomRow} style={{ width: gridTotalW, height: ROOM_H }}>
                        <button className={styles.roomLabel} style={{ width: LEFT_W, height: ROOM_H }}
                          onClick={() => setRoomModal({ room })} title={`Histórico quarto ${fmtRoom(room)}`}>
                          <span className={styles.roomNum}>{fmtRoom(room)}</span>
                          <span className={styles.roomCatTag}>{cat.nome.slice(0, 3).toUpperCase()}</span>
                        </button>
                        <div className={styles.roomCells} onMouseMove={(e) => handleRoomMouseMove(e, room)}>
                          {days.map((day, idx) => {
                            const dStr      = daysStr[idx];
                            const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                            const isToday   = dStr === todayStr;
                            const isSel     = isCellSelected(room, dStr);
                            return (
                              <div key={idx}
                                className={[styles.cell, isWeekend ? styles.cellWeekend : '', isToday ? styles.cellToday : '', isSel ? styles.cellSelected : '', styles.cellClickable].join(' ')}
                                style={{ width: DAY_CELL_W, height: ROOM_H, flexShrink: 0 }}
                                onClick={() => handleCellClick(room, dStr)}
                              />
                            );
                          })}
                          <div className={styles.barsLayer}>{renderBars(room)}</div>
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
            { cls: 'legendDot_hospedado',  label: 'Hospedado'  },
            { cls: 'legendDot_finalizado', label: 'Finalizado' },
            { cls: 'legendDot_cancelado',  label: 'Cancelado'  },
          ].map((l) => (
            <div key={l.label} className={styles.legendItem}>
              <div className={[styles.legendDot, styles[l.cls]].join(' ')} />
              <span>{l.label}</span>
            </div>
          ))}
          <span className={styles.legendHint}>Clique dia/quarto · 2 células para criar · Arraste/borda para mover</span>
        </div>
      </div>

      {/* Modals */}
      {selectedReserva && <ReservaModal reserva={selectedReserva} onClose={() => setSelectedReserva(null)} onCancel={handleCancelReserva} />}
      {showCreateModal && (
        <CreateModal initialRoom={createInit.room} initialStart={createInit.start} initialAvailable={createInit.available}
          reservas={reservas} onClose={() => setShowCreateModal(false)} onSave={handleSaveNew} onNotify={notify} />
      )}
      {dayModal && (
        <DayModal dateStr={dayModal.dateStr} reservas={filteredReservas} onClose={() => setDayModal(null)}
          onNewReserva={(dateStr, available) => { setCreateInit({ room: null, start: dateStr, end: null, available }); setShowCreateModal(true); }} />
      )}
      {roomModal && <RoomModal room={roomModal.room} reservas={reservas} onClose={() => setRoomModal(null)} />}
      {showSolicitacoes && (
        <SolicitacoesModal reservas={reservas} allRooms={allRooms} onClose={() => setShowSolicitacoes(false)}
          onApprove={handleApproveSolicitacao} onReject={handleRejectSolicitacao} />
      )}
      {confirmData && (
        <ConfirmModal title={confirmData.title} message={confirmData.message} onConfirm={confirmData.onConfirm} onCancel={() => setConfirmData(null)} />
      )}
    </div>
  );
}
