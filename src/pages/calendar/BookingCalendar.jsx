import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  BedDouble, ChevronLeft, ChevronRight, Plus,
  ChevronDown, Loader2, X, Users, Building2, Search, CalendarDays, Bell,
} from 'lucide-react';
import { Button }        from '../../components/ui/Button';
import { Modal }         from '../../components/ui/Modal';
import { FormField }     from '../../components/ui/Input';
import { DatePicker }    from '../../components/ui/DatePicker';
import { Notification }  from '../../components/ui/Notification';
import { PaymentModal }  from '../../components/ui/PaymentModal';
import { addDaysStr }    from './calendarMocks';
import { reservaApi, quartoApi, quartoCategoriApi, cadastroApi, enumApi } from '../../services/api';
import styles from './BookingCalendar.module.css';

// ─── Date helpers (backend uses "dd/MM/yyyy HH:mm", frontend uses "yyyy-MM-dd") ─
const parseBrDate = (s) => {
  if (!s) return '';
  const [dt] = s.split(' ');
  const [d, m, y] = dt.split('/');
  return `${y}-${m}-${d}`;
};
const toBrDate = (iso) => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

// ─── Status mapping (backend enums → frontend keys) ───────────────────────────
const mapStatus = (r) => {
  if (r.status) {
    const s = (r.status + '').toLowerCase();
    if (s === 'cancelado')  return 'cancelado';
    if (s === 'hospedado')  return 'hospedado';
    if (s === 'finalizado') return 'finalizado';
    if (s === 'solicitada') return 'solicitada';
    if (s === 'ativo')      return 'confirmada';
    return s;
  }
  if (r.cancelado)          return 'cancelado';
  if (r.hospedado)          return 'hospedado';
  if (r.ativa === false)    return 'finalizado';
  return 'confirmada';
};

// ─── Normalize backend Reserva → frontend shape ───────────────────────────────
const normalizeReserva = (r) => {
  const pessoas   = r.pessoas ?? [];
  const titular   = pessoas[0];
  const pags      = r.pagamentos ?? [];
  const totalPago = pags.reduce((s, p) => s + (p.valor ?? 0), 0);
  return {
    id:                     r.id,
    quarto:                 r.quarto?.id ?? r.fk_quarto ?? r.quarto,
    categoria:              r.categoria?.nome ?? '',
    titularNome:            titular?.nome ?? r.titular_nome ?? 'Hóspede',
    empresaNome:            r.empresa?.razao_social ?? r.empresa_nome ?? null,
    quantidadeAcompanhantes: Math.max(0, pessoas.length - 1),
    dataInicio:             parseBrDate(r.data_hora_entrada),
    dataFim:                parseBrDate(r.data_hora_saida),
    chegadaPrevista:        r.data_hora_entrada ?? '',
    saidaPrevista:          r.data_hora_saida   ?? '',
    status:                 mapStatus(r),
    hospedes:               pessoas.map((p) => ({ id: p.id, nome: p.nome, cpf: p.cpf ?? '' })),
    pagamentos:             pags.map((p) => ({
      id:             p.id,
      descricao:      p.descricao ?? '',
      formaPagamento: p.tipo_pagamento?.descricao ?? p.forma_pagamento ?? '',
      valor:          p.valor ?? 0,
    })),
    valorTotal: r.valor_total ?? 0,
    totalPago,
  };
};

// ─── Constants ────────────────────────────────────────────────────────────────
const DAY_CELL_W   = 168;
const ROOM_H       = 60;
const CAT_H        = 30;
const HDR_H        = 56;
const LEFT_W       = 80;
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
function ReservaModal({ reserva, onClose, onCancel, categorias }) {
  const pendente = reserva.valorTotal - reserva.totalPago;
  const dias     = diffDays(reserva.dataInicio, reserva.dataFim);
  const cat      = categorias.find((c) => c.quartos.includes(reserva.quarto));
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
function DayModal({ dateStr, reservas, onClose, onNewReserva, categorias }) {
  const dayReservas    = reservas.filter((r) => r.dataInicio <= dateStr && r.dataFim > dateStr);
  const occupiedRooms  = new Set(dayReservas.map((r) => r.quarto));
  const totalRooms     = categorias.flatMap((c) => c.quartos).length;
  const availableRooms = categorias.flatMap((c) => c.quartos).filter((r) => !occupiedRooms.has(r));
  const totalPeople    = dayReservas.reduce((s, r) => s + (r.hospedes?.length || (1 + (r.quantidadeAcompanhantes || 0))), 0);
  const dayObj  = new Date(dateStr + 'T00:00:00');
  const weekday = dayObj.toLocaleDateString('pt-BR', { weekday: 'long' });
  const cap     = weekday.charAt(0).toUpperCase() + weekday.slice(1);
  return (
    <Modal open onClose={onClose} size="lg"
      title={<><CalendarDays size={15} /> {cap}, {fmtDateBR(dateStr)}</>}
      footer={
        <div className={styles.footerSpread}>
          <span className={styles.footerInfo}>
            {availableRooms.length} quarto{availableRooms.length !== 1 ? 's' : ''} disponível{availableRooms.length !== 1 ? 'is' : ''}
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
      {/* Stats cards */}
      <div className={styles.dayStats}>
        <div className={styles.dayStatBox}>
          <span className={styles.dayStatLabel}>Quartos Ocupados</span>
          <span className={styles.dayStatValue}>{occupiedRooms.size}<span className={styles.dayStatOf}>/{totalRooms}</span></span>
        </div>
        <div className={styles.dayStatBox}>
          <span className={styles.dayStatLabel}>Reservas</span>
          <span className={styles.dayStatValue}>{dayReservas.length}</span>
        </div>
        <div className={styles.dayStatBox}>
          <span className={styles.dayStatLabel}>Total de Pessoas</span>
          <span className={styles.dayStatValue}>{totalPeople}</span>
        </div>
        <div className={styles.dayStatBox}>
          <span className={styles.dayStatLabel}>Disponíveis</span>
          <span className={styles.dayStatValue} style={{ color: 'var(--emerald)' }}>{availableRooms.length}</span>
        </div>
      </div>
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
function RoomModal({ room, reservas, onClose, categorias }) {
  const cat          = categorias.find((c) => c.quartos.includes(room));
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

// ─── Room Combobox (single or multi-select) ───────────────────────────────────
function RoomCombobox({ value, onChange, availableRooms, categorias, singleSelect = false }) {
  const [open,      setOpen]      = useState(false);
  const [filter,    setFilter]    = useState('');
  const [dropStyle, setDropStyle] = useState({});
  const triggerRef = useRef(null);
  const dropRef    = useRef(null);

  const updatePos = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const dropH = Math.min(280, 400);
    const openAbove = spaceBelow < dropH && rect.top > dropH;
    setDropStyle({
      position: 'fixed',
      zIndex: 9999,
      width: rect.width,
      left: rect.left,
      top: openAbove ? rect.top - dropH - 4 : rect.bottom + 4,
      maxHeight: openAbove ? rect.top - 8 : spaceBelow - 8,
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePos();
    window.addEventListener('scroll', updatePos, true);
    window.addEventListener('resize', updatePos);
    return () => {
      window.removeEventListener('scroll', updatePos, true);
      window.removeEventListener('resize', updatePos);
    };
  }, [open, updatePos]);

  useEffect(() => {
    const h = (e) => {
      const inTrigger = triggerRef.current && triggerRef.current.contains(e.target);
      const inDrop    = dropRef.current    && dropRef.current.contains(e.target);
      if (!inTrigger && !inDrop) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const handleSelect = (r) => {
    if (!availableRooms.includes(r)) return;
    if (singleSelect) {
      onChange([String(r)]);
      setOpen(false);
    } else {
      const rs = String(r);
      onChange(value.includes(rs) ? value.filter((x) => x !== rs) : [...value, rs]);
    }
  };

  const fl = filter.toLowerCase();
  const label = value.length === 0
    ? (singleSelect ? 'Selecione um quarto...' : 'Selecione quarto(s)...')
    : `Quarto ${fmtRoom(parseInt(value[0]))}${!singleSelect && value.length > 1 ? ` +${value.length - 1}` : ''}`;

  const dropdown = open && createPortal(
    <div ref={dropRef} className={styles.comboDropdown} style={{ ...dropStyle, overflowY: 'auto' }}>
      <div className={styles.comboSearchWrap}>
        <Search size={12} className={styles.comboSearchIcon} />
        <input
          className={styles.comboSearchInput}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filtrar quarto..."
          autoFocus
        />
      </div>
      {categorias.map((cat) => {
        const rows = cat.quartos.filter((r) =>
          !fl || fmtRoom(r).includes(fl) || cat.nome.toLowerCase().includes(fl)
        );
        if (!rows.length) return null;
        return (
          <div key={cat.id}>
            <div className={styles.comboGroupLabel}>{cat.nome}</div>
            {rows.map((r) => {
              const avail = availableRooms.includes(r);
              const sel   = value.includes(String(r));
              return (
                <div key={r}
                  className={[styles.comboItem, sel ? styles.comboItemSel : '', !avail ? styles.comboItemUnavail : ''].join(' ')}
                  onClick={() => handleSelect(r)}
                >
                  {!singleSelect && (
                    <div className={[styles.comboCheck, sel ? styles.comboCheckSel : ''].join(' ')}>{sel && '✓'}</div>
                  )}
                  <span className={styles.comboItemNum}>Quarto {fmtRoom(r)}</span>
                  <span className={styles.comboItemTipo}>{cat.nome}</span>
                  {!avail && <span className={styles.comboItemOcupado}>Ocupado</span>}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>,
    document.body
  );

  return (
    <div className={styles.comboWrap}>
      <button ref={triggerRef} type="button" className={styles.comboTrigger}
        onClick={() => { setOpen((o) => !o); setFilter(''); }}
      >
        <span className={value.length === 0 ? styles.comboPlaceholder : ''}>{label}</span>
        <ChevronDown size={13} style={{ flexShrink: 0, transition: 'transform 0.18s', transform: open ? 'rotate(180deg)' : '' }} />
      </button>
      {dropdown}
      {!singleSelect && value.length > 0 && (
        <div className={styles.comboChips}>
          {value.map((q) => (
            <div key={q} className={styles.hospedeChip}>
              <span>Quarto {fmtRoom(parseInt(q))}</span>
              <button type="button" className={styles.chipRemove} onClick={() => handleSelect(parseInt(q))}><X size={10} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Create Reservation Modal ─────────────────────────────────────────────────
function CreateModal({ initialRoom, initialStart, initialAvailable, reservas, onClose, onSave, onNotify, categorias }) {
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
  const [pagamentos,     setPagamentos]     = useState([]);
  const [showPagModal,   setShowPagModal]   = useState(false);
  const [tiposPagamento, setTiposPagamento] = useState([]);
  const [saving,         setSaving]         = useState(false);

  useEffect(() => {
    enumApi.tipoPagamento().then(setTiposPagamento).catch(() => {});
  }, []);

  // Derived
  const checkinStr  = checkin  ? formatDate(checkin)  : '';
  const checkoutStr = checkout ? formatDate(checkout) : '';
  const dias        = checkinStr && checkoutStr ? diffDays(checkinStr, checkoutStr) : 0;

  const allRoomIds = useMemo(() => categorias.flatMap((c) => c.quartos), [categorias]);

  const availableRooms = useMemo(() => {
    if (!checkinStr || !checkoutStr) return initialAvailable || allRoomIds;
    return allRoomIds.filter(
      (r) => !reservas.some((res) => res.quarto === r && res.dataInicio < checkoutStr && res.dataFim > checkinStr)
    );
  }, [checkinStr, checkoutStr, reservas, initialAvailable, allRoomIds]);

  const mpAvailableRooms = useMemo(() => {
    if (!mpCheckin || !mpCheckout) return allRoomIds;
    const ci = formatDate(mpCheckin);
    const co = formatDate(mpCheckout);
    const alreadyPicked = periodos.flatMap((p) => {
      const pi = formatDate(p.checkin); const po = formatDate(p.checkout);
      if (pi < co && po > ci) return p.rooms.map((r) => parseInt(r));
      return [];
    });
    return allRoomIds.filter(
      (r) => !alreadyPicked.includes(r) && !reservas.some((res) => res.quarto === r && res.dataInicio < co && res.dataFim > ci)
    );
  }, [mpCheckin, mpCheckout, periodos, reservas, allRoomIds]);

  // Financial (prices come from calcularPrecos; show 0 here as placeholder)
  const valorTotal = 0;
  const totalPago  = pagamentos.reduce((s, p) => s + p.valor, 0);
  const pendente   = Math.max(0, valorTotal - totalPago);

  // Guest search (real API)
  const [filteredHospedes,  setFilteredHospedes]  = useState([]);
  const [searchingHospedes, setSearchingHospedes] = useState(false);
  useEffect(() => {
    if (hospSearch.trim().length < 2) { setFilteredHospedes([]); return; }
    const t = setTimeout(async () => {
      setSearchingHospedes(true);
      try {
        const res  = await cadastroApi.listarPessoas({ termo: hospSearch.trim(), size: 6 });
        const list = Array.isArray(res) ? res : (res.content ?? []);
        setFilteredHospedes(list.map((p) => ({ id: p.id, nome: p.nome, cpf: p.cpf ?? '' })));
      } catch { setFilteredHospedes([]); }
      finally  { setSearchingHospedes(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [hospSearch]);

  const addHospede  = (h)  => { if (hospSelecionados.find((x) => x.id === h.id)) return; setHospSelecionados((p) => [...p, h]); setHospSearch(''); };
  const addManual   = ()   => { if (!manualNome.trim()) return; setHospSelecionados((p) => [...p, { id: `tmp-${Date.now()}`, nome: manualNome.trim(), cpf: '' }]); setManualNome(''); };
  const remHospede  = (id) => setHospSelecionados((p) => p.filter((x) => x.id !== id));

  const addPagamento = (payment) => {
    setPagamentos((p) => [...p, { _localId: Date.now(), ...payment }]);
    setShowPagModal(false);
  };

  const addPeriodo = () => {
    if (!mpRooms.length || !mpCheckin || !mpCheckout) return;
    setPeriodos((p) => [...p, { rooms: [...mpRooms], checkin: mpCheckin, checkout: mpCheckout }]);
    setMpRooms([]); setMpCheckin(null); setMpCheckout(null);
  };

  // Room type summary (group by category name)
  const allSelectedRooms = periodoMode === 'multiplos'
    ? [...new Set(periodos.flatMap((p) => p.rooms))]
    : quartos;
  const roomTypeSummary = allSelectedRooms.reduce((acc, q) => {
    const cat = categorias.find((c) => c.quartos.includes(parseInt(q)));
    const t   = cat?.nome || 'Quarto';
    acc[t] = (acc[t] || 0) + 1; return acc;
  }, {});
  const roomSummaryStr = Object.entries(roomTypeSummary).map(([t, c]) => `${c}x ${t}`).join(', ');

  const canNext2 = periodoMode === 'unico'
    ? quartos.length > 0 && checkinStr && checkoutStr && dias > 0
    : periodos.length > 0;

  const handleSave = async () => {
    if (isOrcamento) { onNotify('Orçamento gerado! (Em desenvolvimento)'); onClose(); return; }
    setSaving(true);
    try {
      // Only include pessoas that have a real backend ID (not temp manual entries)
      const pessoasIds = hospSelecionados
        .filter((h) => h.id && !String(h.id).startsWith('tmp-'))
        .map((h) => ({ id: h.id }));

      const buildItem = (quartoId, dataEntrada, dataSaida) => ({
        fk_quarto:    parseInt(quartoId),
        data_entrada: toBrDate(dataEntrada),
        data_saida:   toBrDate(dataSaida),
        ...(pessoasIds.length ? { pessoas: pessoasIds } : {}),
        ...(pagamentos.length ? {
          pagamentos: pagamentos.map(({ _localId, ...pg }) => pg),
        } : {}),
      });

      let reservasBody;
      if (periodoMode === 'multiplos') {
        reservasBody = periodos.flatMap((p) =>
          p.rooms.map((q) => buildItem(q, formatDate(p.checkin), formatDate(p.checkout)))
        );
      } else {
        reservasBody = quartos.map((q) => buildItem(q, checkinStr, checkoutStr));
      }
      await onSave(reservasBody);
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
      <div style={{ minHeight: '62vh', display: 'flex', flexDirection: 'column' }}>
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
                {[['simples', 'Reserva Simples'], ['grupo', 'Múltiplas Reservas']].map(([v, l]) => (
                  <button key={v} type="button"
                    className={[styles.tipoBtn, tipo === v ? styles.tipoBtnActive : ''].join(' ')}
                    onClick={() => { setTipo(v); if (v !== 'grupo') setQuartos((q) => q.slice(0, 1)); }}
                  >{l}</button>
                ))}
              </div>
              <label className={styles.orcamentoToggle}>
                <input type="checkbox" checked={isOrcamento} onChange={(e) => setIsOrcamento(e.target.checked)} />
                <span>Simular Orçamento</span>
              </label>
            </div>
          </FormField>

          <FormField label="Hóspedes">
            <div className={styles.hospSearchWrap}>
              {searchingHospedes
                ? <Loader2 size={13} className={[styles.hospSearchIcon, styles.spin].join(' ')} />
                : <Search size={13} className={styles.hospSearchIcon} />}
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
            {isOrcamento && (
              <div className={styles.manualRow}>
                <input className={styles.formInput} value={manualNome} onChange={(e) => setManualNome(e.target.value)}
                  placeholder="Nome do titular (para orçamento)..." onKeyDown={(e) => e.key === 'Enter' && addManual()} />
                <Button variant="secondary" onClick={addManual} disabled={!manualNome.trim()}><Plus size={13} /></Button>
              </div>
            )}
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
            <div className={styles.step2Grid}>
              <FormField label="Período de estadia">
                <div className={styles.dateCompact}>
                  <DatePicker mode="range" startDate={checkin} endDate={checkout}
                    onRangeChange={({ start, end }) => { setCheckin(start); setCheckout(end); }}
                    placeholder="Check-in → Check-out" minDate={new Date()} />
                </div>
              </FormField>
              <FormField label={tipo === 'grupo' ? 'Quartos (múltipla seleção)' : 'Quarto'}>
                <RoomCombobox value={quartos}
                  onChange={setQuartos}
                  availableRooms={availableRooms}
                  categorias={categorias}
                  singleSelect={tipo !== 'grupo'} />
              </FormField>
            </div>
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
                  <RoomCombobox value={mpRooms} onChange={setMpRooms} availableRooms={mpAvailableRooms} categorias={categorias} />
                </FormField>
                <FormField label="Período">
                  <div className={styles.dateCompact}>
                    <DatePicker mode="range" startDate={mpCheckin} endDate={mpCheckout}
                      onRangeChange={({ start, end }) => { setMpCheckin(start); setMpCheckout(end); }}
                      placeholder="Check-in → Check-out" minDate={new Date()} />
                  </div>
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
                pagamentos.map((p) => {
                  const tipDesc = tiposPagamento.find((t) => t.id === p.tipo_pagamento?.id)?.descricao ?? p.tipo_pagamento?.descricao ?? '—';
                  return (
                    <div key={p._localId} className={styles.pagItem}>
                      <span className={styles.pagDesc}>{p.nome_pagador || p.descricao || '—'}</span>
                      <span className={styles.pagForma}>{tipDesc}</span>
                      <span className={styles.finPago}>{fmtBRL(p.valor)}</span>
                      <button type="button" className={styles.chipRemove} onClick={() => setPagamentos((prev) => prev.filter((x) => x._localId !== p._localId))}><X size={10} /></button>
                    </div>
                  );
                })
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
      </div>

      {/* Payment modal */}
      <PaymentModal
        open={showPagModal}
        onClose={() => setShowPagModal(false)}
        onConfirm={addPagamento}
        tiposPagamento={tiposPagamento}
        titularNome={hospSelecionados[0]?.nome || manualNome.trim() || null}
        canAplicarDesconto={false}
      />
    </Modal>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function BookingCalendar() {
  const today    = new Date(); today.setHours(0, 0, 0, 0);
  const todayStr = formatDate(today);

  const [reservas,    setReservas]    = useState([]);
  const [categorias,  setCategorias]  = useState([]);
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

  // ── Load categories + rooms, then cross-reference ────────────────────────
  useEffect(() => {
    Promise.all([
      quartoCategoriApi.listar({ size: 900 }),
      quartoApi.listar({ size: 900 }),
    ]).then(([catRes, roomRes]) => {
      const catList  = Array.isArray(catRes)  ? catRes  : (catRes?.content  ?? []);
      const roomList = Array.isArray(roomRes) ? roomRes : (roomRes?.content ?? []);

      setCategorias(
        catList
          .map((c) => {
            // First try quartos embedded in category response
            let quartos = (c.quartos ?? []).map((q) => q.id ?? q);
            // Fall back: filter rooms list by categoriaId
            if (!quartos.length) {
              quartos = roomList
                .filter((r) => (r.categoriaId ?? r.categoria?.id) === c.id)
                .map((r) => r.id);
            }
            return { id: c.id, nome: c.nome, quartos };
          })
          .filter((c) => c.quartos.length > 0),
      );
    }).catch(() => {});
  }, []);

  // ── Reload reservations when month/year changes ───────────────────────────
  useEffect(() => {
    setLoading(true);
    const mes = viewDate.getMonth() + 1;
    const ano = viewDate.getFullYear();
    reservaApi.listarPorMesAno({ mes, ano })
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setReservas(list.map(normalizeReserva).filter((r) => r.dataInicio));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewDate.getMonth(), viewDate.getFullYear()]);

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
  const allRooms         = categorias.flatMap((c) => c.quartos);

  const handleApproveSolicitacao = async (id, quarto) => {
    const upd = await reservaApi.atualizar({ id, fk_quarto: quarto });
    setReservas((rs) => rs.map((r) => r.id === id ? normalizeReserva(upd) : r));
    notify('Solicitação aprovada!'); setShowSolicitacoes(false);
  };
  const handleRejectSolicitacao = async (id) => {
    await reservaApi.cancelar(id);
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
          const upd = await reservaApi.atualizar({
            id:          resId,
            fk_quarto:   snapshot.quarto,
            data_entrada: toBrDate(snapshot.dataInicio),
            data_saida:   toBrDate(snapshot.dataFim),
          });
          setReservas((rs) => rs.map((x) => x.id === resId ? normalizeReserva(upd) : x));
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

  const handleSaveNew = async (reservasBody) => {
    try {
      const result = await reservaApi.criar({ reservas: reservasBody });
      const novas  = (Array.isArray(result) ? result : [result]).map(normalizeReserva).filter((r) => r.dataInicio);
      setReservas((rs) => [...rs, ...novas]);
      notify(novas.length > 1 ? `${novas.length} reservas criadas!` : 'Reserva criada!');
      setShowCreateModal(false);
    } catch (e) {
      notify(e.message || 'Erro ao criar reserva.', 'error');
      throw e; // re-throw so CreateModal's finally runs setSaving(false)
    }
  };
  const handleCancelReserva = async (id) => {
    await reservaApi.cancelar(id);
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
                      <span className={[styles.dayWeekday, isWeekend ? styles.dayWeekdayRed : '', isToday ? styles.dayWeekdayToday : ''].join(' ')}>
                        {isToday ? 'HOJE' : day.toLocaleDateString('pt-BR', { weekday: 'long' })}
                      </span>
                      <span className={[styles.dayNum, isToday ? styles.dayNumToday : ''].join(' ')}>
                        {day.getDate()}
                      </span>
                    </div>
                  );
                })}
              </div>

              {categorias.map((cat) => {
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
      {selectedReserva && <ReservaModal reserva={selectedReserva} onClose={() => setSelectedReserva(null)} onCancel={handleCancelReserva} categorias={categorias} />}
      {showCreateModal && (
        <CreateModal initialRoom={createInit.room} initialStart={createInit.start} initialAvailable={createInit.available}
          reservas={reservas} onClose={() => setShowCreateModal(false)} onSave={handleSaveNew} onNotify={notify} categorias={categorias} />
      )}
      {dayModal && (
        <DayModal dateStr={dayModal.dateStr} reservas={filteredReservas} onClose={() => setDayModal(null)} categorias={categorias}
          onNewReserva={(dateStr, available) => { setCreateInit({ room: null, start: dateStr, end: null, available }); setShowCreateModal(true); }} />
      )}
      {roomModal && <RoomModal room={roomModal.room} reservas={reservas} onClose={() => setRoomModal(null)} categorias={categorias} />}
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
