import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Building2, Plus, Search, BedDouble, BedSingle, Layers, Waves,
  Clock, User, CreditCard, ChevronDown, Wrench, Sparkles,
  CheckCircle, XCircle, DollarSign, Calendar, Square, Loader2,
  AlertTriangle, ShoppingCart, Package, Trash2, Phone, Mail,
  RefreshCw, ArrowLeftRight, Minus, RotateCcw, Users, X,
  Percent, Tag, ChevronRight, ChevronLeft, Check, FileText, Pencil,
} from 'lucide-react';
import { Modal }                    from '../../components/ui/Modal';
import { Button }                   from '../../components/ui/Button';
import { Input, Select, FormField } from '../../components/ui/Input';
import { DatePicker }               from '../../components/ui/DatePicker';
import { TimeInput }                from '../../components/ui/TimeInput';
import { PaymentModal }             from '../../components/ui/PaymentModal';
import { Notification }             from '../../components/ui/Notification';
import {
  overviewApi,
  ROOM_STATUS, PERNOITE_STATUS, DAYUSE_STATUS,
  TIPOS_OCUPACAO, FORMAS_PAGAMENTO,
  HOSPEDES_CADASTRADOS, DAY_USE_PRICING, STAY_PRICING,
  calcPrecoDiaria, diffDays, CATEGORIAS_CONSUMO,
} from './shared/overviewApi';
import { cadastroApi, reservaApi, funcionarioApi, itemApi, quartoApi, recepcaoApi } from '../../services/api';
import { gerarVoucherHospedagem } from './shared/gerarVoucherHospedagem';
import styles from './recepcao.module.css';
import NovoServicoModal     from './quartos/modals/NovoServicoModal';
import TrocaQuartoModal     from './quartos/modals/TrocaQuartoModal';
import EncerrarModal        from './dayuse/modals/EncerrarModal';
import DescontoModal        from './pernoites/modals/DescontoModal';
import ConsumoModal         from './pernoites/modals/ConsumoModal';
import AtribuirLimpezaModal from './pernoites/modals/AtribuirLimpezaModal';

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmtBRL = (v) =>
  v == null ? 'R$ 0,00' :
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const maskBRL = (v) => {
  const digits = String(v ?? '').replace(/\D/g, '');
  if (!digits) return '';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
    .format(parseInt(digits, 10) / 100);
};
const parseBRL = (v) =>
  parseFloat(String(v ?? '').replace(/[R$\s.]/g, '').replace(',', '.')) || 0;

const todayStr  = () => new Date().toISOString().slice(0, 10);
const nowTime   = () => new Date().toTimeString().slice(0, 5);
const todayDisplay = () => {
  const d = new Date();
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
};
const dateToDisplay = (d) => {
  if (!d) return '';
  const dt = d instanceof Date ? d : new Date(d);
  return `${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}/${dt.getFullYear()}`;
};
const displayToDate = (s) => {
  if (!s) return null;
  const [dd, mm, yyyy] = s.split('/');
  return new Date(+yyyy, +mm - 1, +dd);
};
const isoToDate = (s) => s ? new Date(s.split('T')[0] + 'T12:00:00') : null;
const dateToISO = (d) => d ? `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` : '';

function calcElapsedSeconds(dataUso, horaEntrada, horaSaida = null) {
  if (!dataUso || !horaEntrada) return 0;
  const [d, m, y] = dataUso.split('/');
  const [h, min]  = horaEntrada.split(':');
  const start     = new Date(+y, +m - 1, +d, +h, +min, 0);
  const end = horaSaida
    ? (() => { const [hh, mm2] = horaSaida.split(':'); const e = new Date(+y, +m - 1, +d, +hh, +mm2, 0); return e < start ? new Date(e.getTime() + 86400000) : e; })()
    : new Date();
  return Math.max(0, Math.floor((end - start) / 1000));
}
const calcElapsedMinutes = (dataUso, ent, sai) => Math.floor(calcElapsedSeconds(dataUso, ent, sai) / 60);

function calcValorDayUse(precoBase, precoAdicional, horasBase, elapsedMin) {
  if (!precoBase) return 0;
  const base = (horasBase || 2) * 60;
  if (elapsedMin <= base) return precoBase;
  return precoBase + Math.ceil((elapsedMin - base) / 60) * (precoAdicional || 0);
}

function fmtElapsed(min) {
  if (min <= 0) return '0min';
  const h = Math.floor(min / 60), m = min % 60;
  return h === 0 ? `${m}min` : `${h}h ${String(m).padStart(2, '0')}min`;
}
function fmtClock(sec) {
  if (sec <= 0) return '00:00';
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
    : `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

// ── Status key → CSS ──────────────────────────────────────────────────────────
function roomStatusKey(status) {
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

const FILTER_OPTIONS = [
  { id: 'todos',     label: 'Todos'           },
  { id: 'disponivel',label: 'Disponível'      },
  { id: 'ocupado',   label: 'Ocupado'         },
  { id: 'reservado', label: 'Reservado'       },
  { id: 'limpeza',   label: 'Limpeza'         },
  { id: 'servico',   label: 'Manutenção/Fora' },
];

// ── Mock itens do quarto ──────────────────────────────────────────────────────
const MOCK_ITENS_QUARTO = [
  { id: 1, nome: 'Cerveja Heineken 350ml', categoria: 'Bebidas',    preco: 12.00, qtdAtual: 4, qtdBase: 6 },
  { id: 2, nome: 'Água Mineral 500ml',     categoria: 'Bebidas',    preco: 4.50,  qtdAtual: 3, qtdBase: 4 },
  { id: 3, nome: 'Amendoim Salgado 100g',  categoria: 'Petiscos',   preco: 8.00,  qtdAtual: 2, qtdBase: 2 },
  { id: 4, nome: 'Kit Higiene Completo',   categoria: 'Higiene',    preco: 25.00, qtdAtual: 1, qtdBase: 1 },
];

// ── Blank forms ───────────────────────────────────────────────────────────────
const blankNpForm  = () => ({ chegadaDate: new Date(), chegadaHora: '14:00', saidaDate: null, saidaHora: '12:00', tipoAcomodacao: 'Casal', hospedes: [], hospedeSearch: '' });
const blankNduForm = () => ({ horaEntrada: nowTime(), hospedes: [], hospedeSearch: '' });
const blankPagForm = () => ({ descricao: '', formaPagamento: 'PIX', valor: '' });
const blankSvcForm = () => ({ responsavel: '', descricao: '', previsaoFim: '', dataHoraInicio: '', dataHoraFim: '' });

// ── QuartoCombobox ────────────────────────────────────────────────────────────
function QuartoCombobox({ value, onChange, quartos = [], categorias = [], currentNumero = null }) {
  const [open,      setOpen]      = useState(false);
  const [filter,    setFilter]    = useState('');
  const [dropStyle, setDropStyle] = useState({});
  const triggerRef = useRef(null);
  const dropRef    = useRef(null);

  const updatePos = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const dropH = 260;
    const openAbove = spaceBelow < dropH && rect.top > dropH;
    const w    = Math.min(rect.width, window.innerWidth - 16);
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - w - 8));
    setDropStyle({
      position: 'fixed', zIndex: 9999, width: w, left,
      top: openAbove ? rect.top - dropH - 4 : rect.bottom + 4,
      maxHeight: openAbove ? rect.top - 8 : spaceBelow - 8,
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePos();
    window.addEventListener('scroll', updatePos, true);
    window.addEventListener('resize', updatePos);
    return () => { window.removeEventListener('scroll', updatePos, true); window.removeEventListener('resize', updatePos); };
  }, [open, updatePos]);

  useEffect(() => {
    const h = (e) => {
      if (triggerRef.current?.contains(e.target) || dropRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const fl = filter.toLowerCase();
  const selected = quartos.find((q) => q.id === value);

  const dropdown = open && createPortal(
    <div ref={dropRef} className={styles.qcDropdown} style={{ ...dropStyle, overflowY: 'auto' }}>
      <div className={styles.qcSearchWrap}>
        <Search size={12} className={styles.qcSearchIcon} />
        <input className={styles.qcSearchInput} value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filtrar apartamento..." autoFocus />
      </div>
      {categorias.map((cat) => {
        const rows = cat.quartos.filter((n) => {
          if (n === currentNumero) return false;
          if (fl && !String(n).includes(fl) && !cat.nome.toLowerCase().includes(fl)) return false;
          return true;
        });
        if (!rows.length) return null;
        return (
          <div key={cat.nome}>
            <div className={styles.qcGroupLabel}>{cat.nome}</div>
            {rows.map((n) => {
              const q = quartos.find((r) => r.numero === n);
              const avail = q && q.status === ROOM_STATUS.DISPONIVEL;
              const sel   = q && q.id === value;
              return (
                <div key={n}
                  className={[styles.qcItem, sel ? styles.qcItemSel : '', !avail ? styles.qcItemUnavail : ''].join(' ')}
                  onClick={() => { if (!avail) return; onChange(q.id); setOpen(false); setFilter(''); }}
                >
                  <span className={styles.qcItemNum}>Apt. {n}</span>
                  {q && <span className={styles.qcItemTipo}>{q.categoria}</span>}
                  {!avail && <span className={styles.qcItemOcupado}>Ocupado</span>}
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
    <div className={styles.qcWrap}>
      <button ref={triggerRef} type="button" className={styles.qcTrigger}
        onClick={() => { setOpen((o) => !o); setFilter(''); }}
      >
        {selected
          ? <span className={styles.qcSelected}>Apt. {selected.numero} — {selected.categoria}</span>
          : <span className={styles.qcPlaceholder}>Selecione um apartamento...</span>
        }
        <ChevronDown size={13} style={{ flexShrink: 0, transition: 'transform 0.18s', transform: open ? 'rotate(180deg)' : '' }} />
      </button>
      {dropdown}
    </div>
  );
}

// ── DiariasCombobox ───────────────────────────────────────────────────────────
function DiariasCombobox({ value = [], onChange, diarias = [], atualNum = 1 }) {
  const [open,      setOpen]      = useState(false);
  const [dropStyle, setDropStyle] = useState({});
  const triggerRef = useRef(null);
  const dropRef    = useRef(null);

  const updatePos = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const dropH = 260;
    const openAbove = spaceBelow < dropH && rect.top > dropH;
    const w    = Math.min(rect.width, window.innerWidth - 16);
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - w - 8));
    setDropStyle({
      position: 'fixed', zIndex: 9999, width: w, left,
      top: openAbove ? rect.top - dropH - 4 : rect.bottom + 4,
      maxHeight: openAbove ? rect.top - 8 : spaceBelow - 8,
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePos();
    window.addEventListener('scroll', updatePos, true);
    window.addEventListener('resize', updatePos);
    return () => { window.removeEventListener('scroll', updatePos, true); window.removeEventListener('resize', updatePos); };
  }, [open, updatePos]);

  useEffect(() => {
    const h = (e) => {
      if (triggerRef.current?.contains(e.target) || dropRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const allSelected = diarias.length > 0 && value.length === diarias.length;
  const label = value.length === 0
    ? 'Selecione as diárias...'
    : value.length === diarias.length
      ? `Todas as diárias (${diarias.length})`
      : `${value.length} de ${diarias.length} diária(s)`;

  const toggle = (idx) => onChange(value.includes(idx) ? value.filter((x) => x !== idx) : [...value, idx]);
  const toggleAll = () => onChange(allSelected ? [] : diarias.map((d) => d.idx));

  const dropdown = open && createPortal(
    <div ref={dropRef} className={styles.qcDropdown} style={{ ...dropStyle, overflowY: 'auto' }}>
      <div
        className={[styles.qcItem, allSelected ? styles.qcItemSel : ''].join(' ')}
        onClick={toggleAll}
        style={{ borderBottom: '1px solid var(--border)', marginBottom: 6, paddingBottom: 10 }}
      >
        <div className={[styles.qcCheck, allSelected ? styles.qcCheckSel : ''].join(' ')}>{allSelected ? '✓' : ''}</div>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>Selecionar todas</span>
      </div>
      {diarias.map((d) => {
        const sel = value.includes(d.idx);
        const isCurrent = d.num === atualNum;
        return (
          <div key={d.idx} className={[styles.qcItem, sel ? styles.qcItemSel : ''].join(' ')} onClick={() => toggle(d.idx)}>
            <div className={[styles.qcCheck, sel ? styles.qcCheckSel : ''].join(' ')}>{sel ? '✓' : ''}</div>
            <span className={styles.qcItemNum}>Diária {d.num}</span>
            {isCurrent && <span className={styles.qcItemTipo}>atual</span>}
            <span style={{ fontSize: 11, color: 'var(--text-2)', marginLeft: 'auto' }}>{d.dataInicio?.split(' ')[0]}</span>
          </div>
        );
      })}
    </div>,
    document.body
  );

  return (
    <div className={styles.qcWrap}>
      <button ref={triggerRef} type="button" className={styles.qcTrigger}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={value.length === 0 ? styles.qcPlaceholder : styles.qcSelected}>{label}</span>
        <ChevronDown size={13} style={{ flexShrink: 0, transition: 'transform 0.18s', transform: open ? 'rotate(180deg)' : '' }} />
      </button>
      {dropdown}
    </div>
  );
}

// ── NhHospedesPicker ─────────────────────────────────────────────────────────
const fmtCpf = (v) => v ? v.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : '';

function NhHospedesPicker({ value = [], onChange }) {
  const [search,    setSearch]    = useState('');
  const [results,   setResults]   = useState([]);
  const [searching, setSearching] = useState(false);
  const [dropStyle, setDropStyle] = useState({});
  const [pending,   setPending]   = useState(null);
  const inputRef = useRef(null);
  const wrapRef  = useRef(null);

  useEffect(() => {
    if (search.trim().length < 2) { setResults([]); setPending(null); return; }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const res  = await cadastroApi.listarPessoas({ termo: search.trim(), size: 8 });
        const list = Array.isArray(res) ? res : (res.content ?? []);
        setResults(list.map((p) => ({
          id: p.id,
          nome: p.nome,
          cpf: p.cpf ?? '',
          telefone: p.telefone ?? '',
          email: p.email ?? '',
          dataNascimento: p.data_nascimento ?? '',
          bloqueado: p.status === 'BLOQUEADO',
          acompanhantes: (p.acompanhantes ?? []).map((a) => ({
            id: a.id, nome: a.nome, cpf: a.cpf ?? '',
            telefone: a.telefone ?? '',
            email: a.email ?? '',
            dataNascimento: a.data_nascimento ?? '',
            bloqueado: a.status === 'BLOQUEADO',
          })),
        })));
      } catch { setResults([]); }
      finally  { setSearching(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const calcPos = () => {
    const el = wrapRef.current ?? inputRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const spaceAbove = rect.top - 8;
    setDropStyle({ position: 'fixed', zIndex: 99999, left: rect.left, bottom: window.innerHeight - rect.top + 4, width: rect.width, maxHeight: Math.min(260, spaceAbove) });
  };

  useEffect(() => { if (results.length) calcPos(); }, [results]);

  const addMany = (list) => {
    const existing = new Set(value.map((x) => x.id));
    const toAdd = list.filter((h) => !existing.has(h.id));
    if (toAdd.length) onChange([...value, ...toAdd]);
  };

  const handleClick = (h) => {
    if (h.bloqueado) return;
    if (h.acompanhantes?.length > 0) {
      setPending({ titular: h, selected: new Set() });
      calcPos();
    } else {
      addMany([h]);
      setSearch(''); setResults([]);
    }
  };

  const toggleComp = (id) => setPending((prev) => {
    const next = new Set(prev.selected);
    next.has(id) ? next.delete(id) : next.add(id);
    return { ...prev, selected: next };
  });

  const confirmAdd = () => {
    addMany([pending.titular, ...pending.titular.acompanhantes.filter((a) => !a.bloqueado && pending.selected.has(a.id))]);
    setPending(null); setSearch(''); setResults([]);
  };

  const rem = (id) => onChange(value.filter((x) => x.id !== id));

  const showDrop = pending !== null || results.length > 0;
  const dropdown = showDrop && createPortal(
    <div className={styles.nhPickerDrop} style={dropStyle}>
      {pending ? (
        <>
          <div className={styles.nhPickerBack}>
            <button className={styles.nhPickerBackBtn} onClick={() => setPending(null)}><ChevronRight size={12} style={{ transform: 'rotate(180deg)' }} /> Voltar</button>
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            <div className={styles.nhPickerRow}>
              <div className={[styles.nhPickerCheck, styles.nhPickerChecked].join(' ')}><Check size={11} /></div>
              <div className={styles.nhPickerInfo}>
                <span className={styles.nhPickerName}>{pending.titular.nome}</span>
                {pending.titular.cpf && <span className={styles.nhPickerMeta}>{fmtCpf(pending.titular.cpf)}</span>}
              </div>
              <span className={styles.titularTag}>Titular</span>
            </div>
            {pending.titular.acompanhantes.map((a) => (
              <div key={a.id} className={[styles.nhPickerRow, a.bloqueado ? styles.nhPickerBlocked : styles.nhPickerRowClick].join(' ')}
                onClick={() => !a.bloqueado && toggleComp(a.id)}>
                <div className={[styles.nhPickerCheck, pending.selected.has(a.id) ? styles.nhPickerChecked : ''].join(' ')}>
                  {pending.selected.has(a.id) && <Check size={11} />}
                </div>
                <div className={styles.nhPickerInfo}>
                  <span className={styles.nhPickerName}>{a.nome}</span>
                  {a.cpf && <span className={styles.nhPickerMeta}>{fmtCpf(a.cpf)}</span>}
                </div>
                {a.bloqueado && <span className={styles.nhPickerBlockedChip}>Bloqueado</span>}
              </div>
            ))}
          </div>
          <div className={styles.nhPickerActions}>
            <button className={styles.nhPickerBtnSec} onClick={() => { addMany([pending.titular]); setPending(null); setSearch(''); setResults([]); }}>Só o titular</button>
            <button className={styles.nhPickerBtnPrim} onClick={confirmAdd}>Adicionar →</button>
          </div>
        </>
      ) : (
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {results.map((h) => (
            <div key={h.id} className={[styles.nhPickerResult, h.bloqueado ? styles.nhPickerBlocked : ''].join(' ')} onClick={() => handleClick(h)}>
              <div className={styles.nhPickerInfo}>
                <span className={styles.nhPickerName}>{h.nome}</span>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  {h.cpf && <span className={styles.nhPickerMeta}>{fmtCpf(h.cpf)}</span>}
                  {h.acompanhantes?.length > 0 && !h.bloqueado && <span className={styles.nhPickerAcompChip}>{h.acompanhantes.length} acomp.</span>}
                  {h.bloqueado && <span className={styles.nhPickerBlockedChip}>Bloqueado</span>}
                </div>
              </div>
              <ChevronRight size={13} className={styles.nhPickerArrow} />
            </div>
          ))}
        </div>
      )}
    </div>,
    document.body
  );

  return (
    <div ref={wrapRef} className={styles.nhPickerWrap}>
      {searching
        ? <Loader2 size={13} className={[styles.nhPickerIcon, styles.spin].join(' ')} />
        : <Search size={13} className={styles.nhPickerIcon} />}
      <div className={styles.nhPickerInner}>
        {value.map((h) => (
          <div key={h.id} className={styles.nhPickerChip}>
            <span>{h.nome}</span>
            <button type="button" className={styles.nhPickerChipRemove} onClick={() => rem(h.id)}><X size={10} /></button>
          </div>
        ))}
        <input ref={inputRef} className={styles.nhPickerInput} value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={value.length === 0 ? 'Buscar hóspede...' : ''} />
      </div>
      {dropdown}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function RecepcaoPage() {
  const [quartos, setQuartos]           = useState([]);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [collapsed, setCollapsed]       = useState({});
  const [tick, setTick]                 = useState(0);
  const [notif, setNotif]               = useState(null);

  // Filters 2
  const [filterTipoOcupacao, setFilterTipoOcupacao] = useState('');
  const [filterDateStart, setFilterDateStart]       = useState(null);
  const [filterDateEnd, setFilterDateEnd]           = useState(null);
  const [dateGroupCollapsed, setDateGroupCollapsed] = useState({});

  // Desconto modal
  const [showDescontoModal, setShowDescontoModal]   = useState(false);
  const [descontoScope, setDescontoScope]           = useState('global'); // 'global' | 'diaria'
  const [descontoTipo, setDescontoTipo]             = useState('percentual'); // 'percentual' | 'fixo'
  const [descontoValor, setDescontoValor]           = useState('');
  const [descontoDescricao, setDescontoDescricao]   = useState('');
  const [descontoSaving, setDescontoSaving]         = useState(false);

  // Add Quarto
  const [showAddQuarto, setShowAddQuarto] = useState(false);

  // Detail modal
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [detailTab, setDetailTab]       = useState('dados');
  const [svGuests, setSvGuests]         = useState([]); // enriched with telefone/email

  // Pernoite detail — diária navigation
  const [detailDiariaIdx, setDetailDiariaIdx] = useState(0);
  const [diariaTab, setDiariaTab]             = useState('detalhes');

  // Novo Pernoite / Day Use
  const [novoModal, setNovoModal]       = useState(null); // 'pernoite' | 'dayuse' | null
  const [novoRoom, setNovoRoom]         = useState(null);
  const [npForm, setNpForm]             = useState(blankNpForm());
  const [nduForm, setNduForm]           = useState(blankNduForm());

  // Nova Hospedagem (single-view create modal)
  const [nhHospedes, setNhHospedes]             = useState([]);
  const [nhCheckinDate, setNhCheckinDate]       = useState(null);
  const [nhCheckoutDate, setNhCheckoutDate]     = useState(null);
  const [nhPagamentos, setNhPagamentos]         = useState([]);
  const [nhPagTipoId, setNhPagTipoId]           = useState('');
  const [nhPagNomePagador, setNhPagNomePagador] = useState('');
  const [nhPagDescricao, setNhPagDescricao]     = useState('');
  const [nhPagValor, setNhPagValor]             = useState('');
  const [nhCalc, setNhCalc]                         = useState(null);
  const [nhCalcLoading, setNhCalcLoading]           = useState(false);
  const [nhShowPriceDetail, setNhShowPriceDetail]   = useState(false);
  const [nhShowPagForm, setNhShowPagForm]           = useState(false);
  const [savingNh, setSavingNh]                     = useState(false);

  // Detail — Add Hóspede (pernoite/dayuse existing)
  const [showDetailAddHospede, setShowDetailAddHospede]     = useState(false);
  const [detailHospedeSearch, setDetailHospedeSearch]       = useState('');
  const [detailHospedeSelected, setDetailHospedeSelected]   = useState(null);

  // Detail — Add Consumo (pernoite/dayuse existing)
  const [detailConsumoCat, setDetailConsumoCat]                 = useState('');
  const [showConsumoExternoModal, setShowConsumoExternoModal]   = useState(false);
  const [externoCart, setExternoCart]                           = useState([]); // [{ key, catId, itemId, nome, categoria, preco, qtd }]

  // Consumo — carrinho unificado (interno + externo → único pagamento)
  const [consumoCart,    setConsumoCart]    = useState([]); // [{ key, tipo, nome, categoria, preco, qtd, qtdMax?, itemId? }]
  const [consumoCartPag, setConsumoCartPag] = useState(null);
  const [showConsumoPag, setShowConsumoPag] = useState(false);

  // Detail — Add Pagamento (pernoite/dayuse existing)
  const [showDetailAddPag, setShowDetailAddPag]             = useState(false);
  const [detailPagDesc, setDetailPagDesc]                   = useState('');
  const [detailPagForma, setDetailPagForma]                 = useState('');
  const [detailPagValor, setDetailPagValor]                 = useState('');

  // Unified payment modal
  const [payModal, setPayModal]                     = useState(false); // { context } - context info string
  const [payNomePagador, setPayNomePagador]         = useState('');
  const [payAutoFill, setPayAutoFill]               = useState(false);
  const [payDescricao, setPayDescricao]             = useState('');
  const [payValor, setPayValor]                     = useState('');
  const [payTipo, setPayTipo]                       = useState('');
  const [payOnConfirm, setPayOnConfirm]             = useState(null); // callback(pagamento)

  // Add payment (old pagModal - kept for backward compat)
  const [pagModal, setPagModal]         = useState(false);
  const [pagForm, setPagForm]           = useState(blankPagForm());

  // Service actions (limpeza/manutencao/fora)
  const [serviceModal, setServiceModal] = useState(null); // { type, room }
  const [svcForm, setSvcForm]           = useState(blankSvcForm());
  const [funcList, setFuncList]         = useState([]);
  const [funcLoading, setFuncLoading]   = useState(false);
  const [funcSelected, setFuncSelected] = useState(null);

  // Minibar add item modal (quarto disponível only)
  const [showAddMinibar, setShowAddMinibar]       = useState(false);
  const [minibarCat, setMinibarCat]               = useState('');
  const [minibarProd, setMinibarProd]             = useState('');
  const [minibarQtyAdd, setMinibarQtyAdd]         = useState(1);
  const [savingMinibar, setSavingMinibar]         = useState(false);

  // Add item from estoque modal (quarto disponível — consumo tab)
  const [showAddEstoque, setShowAddEstoque]         = useState(false);
  const [estoqueCats, setEstoqueCats]               = useState([]);
  const [estoqueLoading, setEstoqueLoading]         = useState(false);
  const [consumoCats, setConsumoCats]               = useState([]);
  const [consumoCatsLoading, setConsumoCatsLoading] = useState(false);
  const [estoqueSelCat, setEstoqueSelCat]           = useState('');
  const [estoqueSelItem, setEstoqueSelItem]         = useState(null); // { id, descricao, quantidade, valor_venda }
  const [estoqueQtdAtual, setEstoqueQtdAtual]       = useState(1);
  const [estoqueQtdPadrao, setEstoqueQtdPadrao]     = useState(3);
  const [savingEstoque, setSavingEstoque]           = useState(false);

  // Disponível consumo — payment modal
  const [showDisponPay, setShowDisponPay] = useState(false);

  // Unified add consumo modal (pernoite / dayuse)
  const [showAddConsumoModal, setShowAddConsumoModal] = useState(false);
  const [consumoSaving, setConsumoSaving]             = useState(false);

  // Gerenciar Diárias modal
  const [showGerenciarDiarias, setShowGerenciarDiarias] = useState(false);
  const [gdStartDate, setGdStartDate]                   = useState(null);
  const [gdEndDate, setGdEndDate]                       = useState(null);
  const [gdValor, setGdValor]                           = useState('');
  const [gdDiariaPendentes, setGdDiariaPendentes]       = useState([]);
  const [savingGd, setSavingGd]                         = useState(false);
  const [gdRemoverConfirm, setGdRemoverConfirm]         = useState(null); // { diariaIdx, diariaNum }
  const gdDiariaListRef                                 = useRef(null);

  // Trocar Quarto modal
  const [showTrocarQuarto, setShowTrocarQuarto]   = useState(false);
  const [tqNovoQuartoId, setTqNovoQuartoId]       = useState(null);
  const [tqDiariasIdxs, setTqDiariasIdxs]         = useState([]);
  const [savingTq, setSavingTq]                   = useState(false);

  // Encerrar day use
  const [encerrarModal, setEncerrarModal] = useState(false);

  // Confirm (finalizar / cancelar)
  const [confirmModal, setConfirmModal] = useState(null); // { action: 'cancelar' }
  const [pendingPayWarning, setPendingPayWarning] = useState(false);
  const [checkoutAntecipado, setCheckoutAntecipado] = useState(false);
  // Atribuir limpeza ao finalizar
  const [atribuirLimpezaModal, setAtribuirLimpezaModal] = useState(null); // { status: 'FINALIZADO'|'FINALIZADO_PAGAMENTO_PENDENTE' }
  const [limpezaFuncs, setLimpezaFuncs]       = useState([]);
  const [limpezaFuncsLoading, setLimpezaFuncsLoading] = useState(false);
  const [limpezaFuncId, setLimpezaFuncId]     = useState('');

  // Ações dropdown (pernoite footer)
  const [ovAcoesOpen, setOvAcoesOpen]       = useState(false);
  const [voucherPicking, setVoucherPicking] = useState(false);

  // Diária combobox
  const [diariaComboOpen, setDiariaComboOpen] = useState(false);
  const [showAlterarPessoas, setShowAlterarPessoas] = useState(false);
  const [apDiariaIdx, setApDiariaIdx]               = useState(0);
  const [apComboOpen, setApComboOpen]               = useState(false);
  const [apSearch, setApSearch]                     = useState('');
  const [apSearchResults, setApSearchResults]       = useState([]);
  const [apSearchLoading, setApSearchLoading]       = useState(false);

  // Gerenciar modals
  const [showGerenciarPag, setShowGerenciarPag]         = useState(false);
  const [showGerenciarConsumo, setShowGerenciarConsumo] = useState(false);
  const [editingPag, setEditingPag]                     = useState(null);



  // Saving
  const [saving, setSaving] = useState(false);

  // ── Notify ───────────────────────────────────────────────────────────────────
  const notify = (message, type = 'success') => {
    setNotif({ message, type });
    setTimeout(() => setNotif(null), 3500);
  };

  // ── Load ─────────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try { setQuartos(await overviewApi.listar()); }
    catch (e) { notify('Erro ao carregar: ' + e.message, 'error'); }
    finally   { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Pessoa search for Gerenciar Pessoas modal ──────────────────────────────────
  useEffect(() => {
    if (!showAlterarPessoas || !apSearch || apSearch.length < 2) {
      setApSearchResults([]);
      return;
    }
    let cancelled = false;
    setApSearchLoading(true);
    const tid = setTimeout(async () => {
      try {
        const res = await cadastroApi.listarPessoas({ termo: apSearch.trim(), size: 8 });
        if (!cancelled) setApSearchResults(res?.content ?? []);
      } catch { if (!cancelled) setApSearchResults([]); }
      finally  { if (!cancelled) setApSearchLoading(false); }
    }, 400);
    return () => { cancelled = true; clearTimeout(tid); };
  }, [apSearch, showAlterarPessoas]);

  // ── 1-second tick for active Day Uses ────────────────────────────────────────
  useEffect(() => {
    const hasActive = quartos.some((q) => q.servico?.tipo === 'dayuse' && q.servico.status === DAYUSE_STATUS.ATIVO);
    if (!hasActive) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [quartos]);

  // ── Nova Hospedagem computed ──────────────────────────────────────────────────
  const nhPessoas = nhHospedes.length || 1;
  const nhPrecoDiaria = useMemo(() =>
    novoRoom ? calcPrecoDiaria(novoRoom.categoria, nhPessoas) : 0,
    [novoRoom, nhPessoas]
  );
  const nhTotalDias = useMemo(() =>
    diffDays(nhCheckinDate, nhCheckoutDate),
    [nhCheckinDate, nhCheckoutDate]
  );
  const nhTotalHosp  = nhCalc?.valor_total ?? (nhPrecoDiaria * nhTotalDias);
  const nhTotalPago  = nhPagamentos.reduce((s, p) => s + p.valor, 0);
  const nhPendente   = Math.max(0, nhTotalHosp - nhTotalPago);

  // ── Calcula preço automaticamente ao selecionar período / hóspedes ───────────
  useEffect(() => {
    if (!novoRoom || !nhCheckinDate || !nhCheckoutDate) { setNhCalc(null); return; }
    let cancelled = false;
    setNhCalcLoading(true);
    setNhCalc(null);
    const isoToBr = (iso) => iso.split('-').reverse().join('/');
    const datas_nascimento = nhHospedes
      .map((h) => h.dataNascimento)
      .filter(Boolean)
      .map((dn) => /^\d{4}-\d{2}-\d{2}$/.test(dn) ? isoToBr(dn) : dn);
    reservaApi.calcularPreco([{
      fk_quarto:    novoRoom.id,
      data_entrada: dateToDisplay(nhCheckinDate),
      data_saida:   dateToDisplay(nhCheckoutDate),
      datas_nascimento,
    }])
      .then((res) => { if (!cancelled) setNhCalc(Array.isArray(res) ? res[0] : res); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setNhCalcLoading(false); });
    return () => { cancelled = true; };
  }, [novoRoom?.id, nhCheckinDate, nhCheckoutDate, nhHospedes]); // eslint-disable-line

  // ── Detail add consumo computed ───────────────────────────────────────────────
  const detailConsumoCatSel = consumoCats.find((c) => String(c.id) === String(detailConsumoCat));
  const detailHospResults    = useMemo(() =>
    HOSPEDES_CADASTRADOS.filter((h) => !detailHospedeSearch || h.nome.toLowerCase().includes(detailHospedeSearch.toLowerCase())),
    [detailHospedeSearch]
  );

  // ── Derived data ──────────────────────────────────────────────────────────────
  const filteredQuartos = quartos.filter((q) => {
    const sk = roomStatusKey(q.status);
    const matchFilter =
      statusFilter === 'todos'     ||
      (statusFilter === 'disponivel' && sk === 'disponivel') ||
      (statusFilter === 'ocupado'    && (sk === 'ocupado')) ||
      (statusFilter === 'reservado'  && sk === 'reservado') ||
      (statusFilter === 'limpeza'    && sk === 'limpeza') ||
      (statusFilter === 'servico'    && (sk === 'manutencao' || sk === 'fora'));
    const term    = search.toLowerCase();
    const matchSearch = !search || q.numero.includes(search) || (q.servico?.titularNome || '').toLowerCase().includes(term);
    const matchTipo = !filterTipoOcupacao || q.tipoOcupacao === filterTipoOcupacao;
    // Period filter: match pernoite rooms overlapping with selected date range
    let matchPeriod = true;
    if (filterDateStart && q.servico?.tipo === 'pernoite') {
      const chegada = displayToDate(q.servico.chegadaPrevista?.split(' ')[0]);
      const saida   = displayToDate(q.servico.saidaPrevista?.split(' ')[0]);
      if (chegada && saida) {
        const fEnd = filterDateEnd || filterDateStart;
        matchPeriod = chegada <= fEnd && saida >= filterDateStart;
      }
    }
    return matchFilter && matchSearch && matchTipo && matchPeriod;
  });

  // Derive categories from loaded rooms (API categories are dynamic)
  const apiCategories = useMemo(() => {
    const seen = new Map();
    quartos.forEach((q) => {
      if (!seen.has(q.categoriaId))
        seen.set(q.categoriaId, { id: q.categoriaId, nome: q.categoria, descricao: q.categoriaDescricao ?? '' });
    });
    return [...seen.values()];
  }, [quartos]);

  const byCategory = apiCategories.map((cat) => ({
    ...cat,
    rooms:       filteredQuartos.filter((q) => q.categoriaId === cat.id),
    total:       quartos.filter((q) => q.categoriaId === cat.id).length,
    disponiveis: quartos.filter((q) => q.categoriaId === cat.id && q.status === ROOM_STATUS.DISPONIVEL).length,
    ocupados:    quartos.filter((q) => q.categoriaId === cat.id && [ROOM_STATUS.OCUPADO, ROOM_STATUS.RESERVADO].includes(q.status)).length,
    emServico:   quartos.filter((q) => q.categoriaId === cat.id && [ROOM_STATUS.LIMPEZA, ROOM_STATUS.MANUTENCAO, ROOM_STATUS.FORA_DE_SERVICO].includes(q.status)).length,
  }));

  const isDateFilterActive = !!(filterDateStart);

  // Date-sorted groups (shown when date range filter is active)
  const dateGroups = useMemo(() => {
    if (!isDateFilterActive) return [];
    const pernoiteRooms = filteredQuartos.filter((q) => q.servico?.tipo === 'pernoite');
    const byDate = {};
    pernoiteRooms.forEach((r) => {
      const dateStr = r.servico.chegadaPrevista?.split(' ')[0] || 'Sem data';
      if (!byDate[dateStr]) byDate[dateStr] = [];
      byDate[dateStr].push(r);
    });
    return Object.entries(byDate)
      .sort(([a], [b]) => {
        if (a === 'Sem data') return 1;
        if (b === 'Sem data') return -1;
        const [da, ma, ya] = a.split('/'); const [db, mb, yb] = b.split('/');
        return new Date(+ya, +ma - 1, +da) - new Date(+yb, +mb - 1, +db);
      })
      .map(([date, rooms]) => ({ date, rooms }));
  }, [filteredQuartos, isDateFilterActive]);

  const toggleDateGroup = (date) =>
    setDateGroupCollapsed((p) => ({ ...p, [date]: p[date] !== false ? false : true }));
  const isDateGroupCollapsed = (date) => dateGroupCollapsed[date] !== false;

  const filterCounts = {
    todos:      quartos.length,
    disponivel: quartos.filter((q) => q.status === ROOM_STATUS.DISPONIVEL).length,
    ocupado:    quartos.filter((q) => q.status === ROOM_STATUS.OCUPADO).length,
    reservado:  quartos.filter((q) => q.status === ROOM_STATUS.RESERVADO).length,
    limpeza:    quartos.filter((q) => q.status === ROOM_STATUS.LIMPEZA).length,
    servico:    quartos.filter((q) => [ROOM_STATUS.MANUTENCAO, ROOM_STATUS.FORA_DE_SERVICO].includes(q.status)).length,
  };

  // ── Total hospedados across all occupied rooms ────────────────────────────────
  const totalHospedados = quartos.reduce((sum, q) => sum + (q.servico?.hospedes?.length || 0), 0);
  const quartosOcupados = quartos.filter((q) => [ROOM_STATUS.OCUPADO, ROOM_STATUS.RESERVADO].includes(q.status)).length;

  // ── Elapsed for selected room (dayuse) ────────────────────────────────────────
  const selElapsedSec = useMemo(() => {
    if (!selectedRoom?.servico || selectedRoom.servico.tipo !== 'dayuse' || selectedRoom.servico.status !== DAYUSE_STATUS.ATIVO) return 0;
    return calcElapsedSeconds(selectedRoom.servico.dataUso, selectedRoom.servico.horaEntrada, null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRoom, tick]);

  const selElapsedMin = useMemo(() => {
    if (!selectedRoom?.servico || selectedRoom.servico.tipo !== 'dayuse') return 0;
    return calcElapsedMinutes(selectedRoom.servico.dataUso, selectedRoom.servico.horaEntrada, selectedRoom.servico.horaSaida || null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRoom, tick]);

  const selValorAtual = selectedRoom?.servico?.tipo === 'dayuse'
    ? calcValorDayUse(selectedRoom.servico.precoBase, selectedRoom.servico.precoAdicional, selectedRoom.servico.horasBase,
        selectedRoom.servico.status === DAYUSE_STATUS.ATIVO ? Math.floor(selElapsedSec / 60) : selElapsedMin)
    : 0;

  const selConsumoTotal = useMemo(() => {
    if (!selectedRoom?.servico?.consumos) return 0;
    return selectedRoom.servico.consumos.reduce((sum, c) => sum + (c.valorTotal || c.valor || 0), 0);
  }, [selectedRoom]);

  // ── Sync selectedRoom when quartos update ─────────────────────────────────────
  useEffect(() => {
    if (!selectedRoom) return;
    const fresh = quartos.find((q) => q.id === selectedRoom.id);
    if (fresh) setSelectedRoom(fresh);
  }, [quartos]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Enrich guest contact info when room/servico changes ──────────────────────
  useEffect(() => {
    const hospedes = selectedRoom?.servico?.hospedes ?? [];
    if (!hospedes.length) { setSvGuests([]); return; }
    setSvGuests(hospedes); // show names immediately
    let cancelled = false;
    Promise.all(hospedes.map(async (h) => {
      if (h.telefone || h.email) return h;
      try {
        // try by id first; fall back to cpf search if id param not supported
        let res  = await cadastroApi.listarPessoas({ id: h.id, size: 1 });
        let full = res?.content?.[0] ?? (Array.isArray(res) ? res[0] : res) ?? null;
        if (!full?.id && h.cpf) {
          res  = await cadastroApi.listarPessoas({ termo: h.cpf.replace(/\D/g, ''), size: 1 });
          full = res?.content?.[0] ?? (Array.isArray(res) ? res[0] : res) ?? null;
        }
        if (!full?.id || full.id !== h.id) return h;
        return { ...h, telefone: full.telefone ?? '', email: full.email ?? '' };
      } catch { return h; }
    })).then((enriched) => { if (!cancelled) setSvGuests(enriched); });
    return () => { cancelled = true; };
  }, [selectedRoom?.id, selectedRoom?.servico?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (serviceModal?.type !== 'limpeza') return;
    setFuncLoading(true);
    (async () => {
      try {
        const res = await funcionarioApi.listar({ size: 100 });
        setFuncList(res?.content ?? []);
      } catch { setFuncList([]); }
      finally { setFuncLoading(false); }
    })();
  }, [serviceModal?.type]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const toggleCollapse = (id) => setCollapsed((p) => ({ ...p, [id]: !p[id] }));

  const openDetail = (room) => {
    setSelectedRoom(room);
    setDetailTab('dados');
    setDetailDiariaIdx(Math.max(0, (room.servico?.diariaAtual || 1) - 1));
    setDiariaTab('detalhes');
    setConsumoCart([]);
    setConsumoCartPag(null);
  };

  const closeDetail = () => { setSelectedRoom(null); setOvAcoesOpen(false); setVoucherPicking(false); setDiariaComboOpen(false); setShowAlterarPessoas(false); setApComboOpen(false); setApSearch(''); };
  const closeAcoes  = () => { setOvAcoesOpen(false); setVoucherPicking(false); };

  const openNovoServico = (tipo, room) => {
    setNovoRoom(room);
    if (tipo === 'pernoite') {
      setNhHospedes([]);
      setNhCheckinDate(new Date()); setNhCheckoutDate(null);
      setNhPagamentos([]);
      setNhPagTipoId(''); setNhPagNomePagador(''); setNhPagDescricao(''); setNhPagValor('');
      setNhCalc(null); setNhCalcLoading(false); setNhShowPriceDetail(false); setNhShowPagForm(false);
    } else {
      setNduForm(blankNduForm());
    }
    setNovoModal(tipo);
    setSelectedRoom(null);
  };

  const openService = (type, room) => {
    setServiceModal({ type, room });
    setSvcForm(blankSvcForm());
    setFuncSelected(null);
  };

  const handleFinalizarManutencao = async (room) => {
    try {
      setSaving(true);
      const updated = await overviewApi.finalizarManutencao(room.id);
      setQuartos((prev) => prev.map((q) => q.id === updated.id ? updated : q));
      notify(`Manutenção do Apt. ${room.numero} finalizada.`);
      closeDetail();
    } catch (e) { notify('Erro: ' + e.message, 'error'); }
    finally { setSaving(false); }
  };

  const handleFinalizarLimpeza = async (room) => {
    try {
      setSaving(true);
      const updated = await overviewApi.finalizarLimpeza(room.id);
      setQuartos((prev) => prev.map((q) => q.id === updated.id ? updated : q));
      notify(`Limpeza do Apt. ${room.numero} finalizada.`);
      closeDetail();
    } catch (e) { notify('Erro: ' + e.message, 'error'); }
    finally { setSaving(false); }
  };

  const handleMarcarDisponivel = async (room) => {
    try {
      setSaving(true);
      const updated = await overviewApi.marcarDisponivel(room.id);
      setQuartos((prev) => prev.map((q) => q.id === updated.id ? updated : q));
      notify(`Quarto ${room.numero} marcado como Disponível.`);
      closeDetail();
    } catch (e) { notify('Erro: ' + e.message, 'error'); }
    finally { setSaving(false); }
  };

  const handleService = async () => {
    if (!serviceModal) return;
    const { type, room } = serviceModal;
    setSaving(true);
    try {
      let updated;
      if (type === 'limpeza')     updated = await overviewApi.marcarLimpeza(room.id, svcForm);
      else if (type === 'manutencao') updated = await overviewApi.marcarManutencao(room.id, svcForm);
      else                         updated = await overviewApi.marcarForaDeServico(room.id, svcForm);
      setQuartos((prev) => prev.map((q) => q.id === updated.id ? updated : q));
      notify(`Quarto ${room.numero} → ${updated.status}.`);
      setServiceModal(null);
    } catch (e) { notify('Erro: ' + e.message, 'error'); }
    finally { setSaving(false); }
  };

  // Hóspede helpers for forms
  const npHosp = useMemo(() => {
    const q = npForm.hospedeSearch.trim().toLowerCase();
    return q.length < 2 ? [] : HOSPEDES_CADASTRADOS.filter((h) => h.nome.toLowerCase().includes(q) && !npForm.hospedes.find((x) => x.id === h.id));
  }, [npForm.hospedeSearch, npForm.hospedes]);

  const nduHosp = useMemo(() => {
    const q = nduForm.hospedeSearch.trim().toLowerCase();
    return q.length < 2 ? [] : HOSPEDES_CADASTRADOS.filter((h) => h.nome.toLowerCase().includes(q) && !nduForm.hospedes.find((x) => x.id === h.id));
  }, [nduForm.hospedeSearch, nduForm.hospedes]);

  const addNpHospede  = (h) => { setNpForm((f)  => ({ ...f, hospedes: [...f.hospedes, h],  hospedeSearch: '' })); };
  const remNpHospede  = (id) => { setNpForm((f) => ({ ...f, hospedes: f.hospedes.filter((h) => h.id !== id) })); };
  const addNduHospede = (h) => { setNduForm((f) => ({ ...f, hospedes: [...f.hospedes, h], hospedeSearch: '' })); };
  const remNduHospede = (id) => { setNduForm((f) => ({ ...f, hospedes: f.hospedes.filter((h) => h.id !== id) })); };

  // ── Criar Pernoite (Nova Hospedagem) ─────────────────────────────────────────
  const handleCriarPernoite = async () => {
    if (!novoRoom || !nhCheckinDate || !nhCheckoutDate) { notify('Preencha as data de chegada e saída.', 'error'); return; }
    setSavingNh(true);
    try {
      const chegada  = `${dateToDisplay(nhCheckinDate)} 14:00`;
      const saida    = `${dateToDisplay(nhCheckoutDate)} 12:00`;
      const dias     = Math.max(1, diffDays(nhCheckinDate, nhCheckoutDate));
      const valorDiaria = calcPrecoDiaria(novoRoom.categoria, nhHospedes.length || 1);
      const valorTotal  = valorDiaria * dias;
      const totalPago   = nhPagamentos.reduce((s, p) => s + p.valor, 0);
      const titular = nhHospedes[0]?.nome || 'Hóspede';
      const servico = {
        titularNome: titular, tipoAcomodacao: novoRoom.tipoOcupacao,
        periodo: `${dateToDisplay(nhCheckinDate)} - ${dateToDisplay(nhCheckoutDate)}`,
        chegadaPrevista: chegada, saidaPrevista: saida,
        status: PERNOITE_STATUS.ATIVO, totalDiarias: dias, diariaAtual: 1,
        valorTotal, totalPago, pagamentoPendente: Math.max(0, valorTotal - totalPago),
        hospedes: nhHospedes, consumos: [], pagamentos: nhPagamentos, diarias: [],
      };
      const updated = await overviewApi.criarPernoite(novoRoom.id, servico);
      setQuartos((prev) => prev.map((q) => q.id === updated.id ? updated : q));
      notify(`Pernoite criado! ${titular} — Apt. ${novoRoom.numero}.`);
      setNovoModal(null);
    } catch (e) { notify('Erro: ' + e.message, 'error'); }
    finally { setSavingNh(false); }
  };

  // ── Criar Day Use ─────────────────────────────────────────────────────────────
  const handleCriarDayUse = async () => {
    if (!novoRoom || !nduForm.horaEntrada) { notify('Informe a hora de entrada.', 'error'); return; }
    setSaving(true);
    try {
      const pricing  = DAY_USE_PRICING[novoRoom.categoria] || { horasBase: 2, precoBase: 90, precoAdicional: 15 };
      const titular  = nduForm.hospedes[0]?.nome || null;
      const servico  = {
        titularNome: titular, dataUso: todayDisplay(),
        horaEntrada: nduForm.horaEntrada, horaSaida: null,
        status: DAYUSE_STATUS.ATIVO,
        horasBase: pricing.horasBase, precoBase: pricing.precoBase, precoAdicional: pricing.precoAdicional,
        valorTotal: 0, totalPago: 0, pagamentoPendente: 0,
        hospedes: nduForm.hospedes, consumos: [], pagamentos: [],
      };
      const updated = await overviewApi.criarDayUse(novoRoom.id, servico);
      setQuartos((prev) => prev.map((q) => q.id === updated.id ? updated : q));
      notify(`Day Use iniciado! ${titular || 'Sem titular'} — Apt. ${novoRoom.numero}.`);
      setNovoModal(null);
    } catch (e) { notify('Erro: ' + e.message, 'error'); }
    finally { setSaving(false); }
  };

  // ── Encerrar Day Use ─────────────────────────────────────────────────────────
  const handleEncerrar = async () => {
    if (!selectedRoom) return;
    setSaving(true);
    try {
      const horaSaida = nowTime();
      const min       = calcElapsedMinutes(selectedRoom.servico.dataUso, selectedRoom.servico.horaEntrada, horaSaida);
      const vt        = calcValorDayUse(selectedRoom.servico.precoBase, selectedRoom.servico.precoAdicional, selectedRoom.servico.horasBase, min);
      const updated   = await overviewApi.encerrarDayUse(selectedRoom.id, { horaSaida, valorTotal: vt, pagamentoPendente: vt });
      setQuartos((prev) => prev.map((q) => q.id === updated.id ? updated : q));
      notify(`Day Use encerrado — ${fmtBRL(vt)}`);
      setEncerrarModal(false);
    } catch (e) { notify('Erro: ' + e.message, 'error'); }
    finally { setSaving(false); }
  };

  // ── Hospedar reserva → POST /pernoites { reserva_id } ───────────────────────
  const handleHospedarReserva = async () => {
    if (!selectedRoom) return;
    const reservaId = selectedRoom.servico?.id;
    if (!reservaId) { notify('Reserva não identificada.', 'error'); return; }
    setSaving(true);
    try {
      await recepcaoApi.criarPernoite({ reserva_id: reservaId });
      await load();
      notify(`Hospedagem iniciada — Apt. ${selectedRoom.numero}.`);
      closeDetail();
    } catch (e) { notify('Erro: ' + e.message, 'error'); }
    finally { setSaving(false); }
  };

  // ── Finalizar / Cancelar ──────────────────────────────────────────────────────
  const openAtribuirLimpeza = (status) => {
    setLimpezaFuncId('');
    setAtribuirLimpezaModal({ status });
    setLimpezaFuncsLoading(true);
    funcionarioApi.listar({ size: 100 })
      .then((res) => setLimpezaFuncs(res?.content ?? (Array.isArray(res) ? res : [])))
      .catch(() => setLimpezaFuncs([]))
      .finally(() => setLimpezaFuncsLoading(false));
  };

  const _prosseguirFinalizar = () => {
    const pendente = selectedRoom?.servico?.pagamentoPendente ?? 0;
    if (pendente > 0) {
      setPendingPayWarning(true);
    } else {
      openAtribuirLimpeza('FINALIZADO');
    }
  };

  const handleClickFinalizar = () => {
    const saidaStr = selectedRoom?.servico?.saidaPrevista?.split(' ')[0]; // "dd/MM/yyyy"
    const saidaISO = saidaStr ? saidaStr.split('/').reverse().join('-') : '';
    if (saidaISO && saidaISO !== todayStr()) {
      setCheckoutAntecipado(true);
      return;
    }
    _prosseguirFinalizar();
  };

  const handleDoFinalizar = async (funcId) => {
    if (!selectedRoom) return;
    const status = atribuirLimpezaModal?.status ?? 'FINALIZADO';
    const pernoiteId = selectedRoom.servico?.id;
    setSaving(true);
    try {
      if (pernoiteId) await recepcaoApi.alterarStatusPernoite(pernoiteId, status);
      await recepcaoApi.acionarLimpeza(selectedRoom.id, {
        funcionario: funcId ? { id: Number(funcId) } : undefined,
      });
      await load();
      const msg = status === 'FINALIZADO_PAGAMENTO_PENDENTE'
        ? 'Finalizado com pagamento pendente.'
        : 'Serviço finalizado.';
      notify(funcId ? `${msg} Limpeza atribuída.` : `${msg} Quarto encaminhado para limpeza.`);
      setAtribuirLimpezaModal(null);
      closeDetail();
    } catch (e) { notify('Erro: ' + e.message, 'error'); }
    finally { setSaving(false); }
  };

  const handleCancelar = async () => {
    if (!selectedRoom) return;
    setSaving(true);
    try {
      const updated = await overviewApi.cancelarServico(selectedRoom.id);
      setQuartos((prev) => prev.map((q) => q.id === updated.id ? updated : q));
      notify('Serviço cancelado.');
      setConfirmModal(null);
    } catch (e) { notify('Erro: ' + e.message, 'error'); }
    finally { setSaving(false); }
  };

  // ── Open unified payment modal ────────────────────────────────────────────────
  const openPayModal = (onConfirmCb, titularNome = '') => {
    setPayNomePagador(titularNome || '');
    setPayAutoFill(!!titularNome);
    setPayDescricao('');
    setPayValor('');
    setPayTipo('PIX');
    setPayOnConfirm(() => onConfirmCb);
    setPayModal(true);
  };

  const handlePayConfirm = async () => {
    const valor = parseBRL(payValor);
    if (!valor || valor <= 0) { notify('Informe um valor válido.', 'error'); return; }
    if (!payDescricao.trim()) { notify('Informe uma descrição.', 'error'); return; }
    if (!payNomePagador.trim()) { notify('Informe o nome do pagador.', 'error'); return; }
    const now = new Date();
    const dataStr = `${dateToDisplay(now)} ${now.toTimeString().slice(0,5)}`;
    const pagamento = { descricao: payDescricao, nomePagador: payNomePagador, formaPagamento: payTipo, valor, data: dataStr };
    if (payOnConfirm) {
      await payOnConfirm(pagamento);
    }
    setPayModal(false);
  };

  // ── Minibar handlers ──────────────────────────────────────────────────────────
  const handleMinibarConsumir = async (produtoId) => {
    if (!selectedRoom) return;
    try {
      const updated = await overviewApi.updateMinibarItem(selectedRoom.id, produtoId, -1);
      setQuartos((prev) => prev.map((q) => q.id === updated.id ? updated : q));
    } catch (e) { notify('Erro: ' + e.message, 'error'); }
  };

  const handleMinibarRepor = async (produtoId) => {
    if (!selectedRoom) return;
    const item = selectedRoom.minibar?.find((m) => m.produtoId === produtoId);
    if (!item) return;
    const delta = item.qtdBase - item.qtdAtual;
    if (delta <= 0) { notify('Item já está na quantidade base.', 'info'); return; }
    try {
      const updated = await overviewApi.updateMinibarItem(selectedRoom.id, produtoId, delta);
      setQuartos((prev) => prev.map((q) => q.id === updated.id ? updated : q));
      notify(`${item.nome} reposto para ${item.qtdBase} unidade(s).`);
    } catch (e) { notify('Erro: ' + e.message, 'error'); }
  };

  const handleMinibarReporTudo = async () => {
    if (!selectedRoom) return;
    try {
      const updated = await overviewApi.reporMinibar(selectedRoom.id);
      setQuartos((prev) => prev.map((q) => q.id === updated.id ? updated : q));
      notify('Minibar reposto completamente.');
    } catch (e) { notify('Erro: ' + e.message, 'error'); }
  };

  const handleAddMinibarItem = async () => {
    if (!selectedRoom || !minibarProd) return;
    const cat = CATEGORIAS_CONSUMO.find((c) => c.id === parseInt(minibarCat));
    const prod = cat?.produtos.find((p) => p.id === parseInt(minibarProd));
    if (!prod) return;
    setSavingMinibar(true);
    try {
      const updated = await overviewApi.adicionarMinibarItem(selectedRoom.id, { produtoId: prod.id, nome: prod.nome, quantidade: minibarQtyAdd });
      setQuartos((prev) => prev.map((q) => q.id === updated.id ? updated : q));
      notify(`${prod.nome} adicionado ao minibar.`);
      setShowAddMinibar(false);
    } catch (e) { notify('Erro: ' + e.message, 'error'); }
    finally { setSavingMinibar(false); }
  };

  // ── Adicionar item do estoque ao quarto ───────────────────────────────────────
  const handleOpenAddEstoque = async () => {
    setEstoqueSelCat('');
    setEstoqueSelItem(null);
    setEstoqueQtdAtual(1);
    setEstoqueQtdPadrao(3);
    setShowAddEstoque(true);
    setEstoqueLoading(true);
    try {
      const res = await itemApi.estoque();
      setEstoqueCats(res?.categorias ?? []);
    } catch (e) { notify('Erro ao carregar estoque: ' + e.message, 'error'); }
    finally { setEstoqueLoading(false); }
  };

  const handleConfirmAddEstoque = async () => {
    if (!selectedRoom || !estoqueSelItem) return;
    const jaExiste = (selectedRoom.minibar ?? []).some((m) => m.produtoId === estoqueSelItem.id);
    if (jaExiste) { notify(`${estoqueSelItem.descricao} já está no quarto.`, 'error'); return; }
    setSavingEstoque(true);
    try {
      await quartoApi.adicionarItem(selectedRoom.id, {
        item: { id: estoqueSelItem.id },
        quantidade_atual: estoqueQtdAtual,
        quantidade_padrao: estoqueQtdPadrao,
      });
      notify(`${estoqueSelItem.descricao} adicionado ao quarto.`);
      setShowAddEstoque(false);
      await load();
    } catch (e) { notify('Erro: ' + e.message, 'error'); }
    finally { setSavingEstoque(false); }
  };

  // ── Consumo interno (minibar item → consumo list) ─────────────────────────────
  const handleConsumoInterno = async (item) => {
    if (!selectedRoom) return;
    setConsumoSaving(true);
    try {
      // Look up price from CATEGORIAS_CONSUMO by produtoId
      let preco = 0;
      for (const cat of CATEGORIAS_CONSUMO) {
        const prod = cat.produtos.find((p) => p.id === item.produtoId);
        if (prod) { preco = prod.preco; break; }
      }
      const consumo = {
        item: item.nome, categoria: 'Minibar',
        quantidade: 1, valorUnitario: preco, valorTotal: preco,
        tipo: 'interno', produtoId: item.produtoId,
      };
      const updated = await overviewApi.adicionarConsumo(selectedRoom.id, consumo);
      setQuartos((prev) => prev.map((q) => q.id === updated.id ? updated : q));
      notify(`${item.nome} consumido.`);
    } catch (e) { notify('Erro: ' + e.message, 'error'); }
    finally { setConsumoSaving(false); }
  };

  // ── Consumo — helpers do carrinho ─────────────────────────────────────────────
  const updateInternQty = (item, newQty) => {
    const capped = Math.min(Math.max(0, newQty), item.qtdAtual);
    setConsumoCart((prev) => {
      if (capped <= 0) return prev.filter((c) => !(c.tipo === 'interno' && c.itemId === item.id));
      const ex = prev.find((c) => c.tipo === 'interno' && c.itemId === item.id);
      if (ex) return prev.map((c) => c.tipo === 'interno' && c.itemId === item.id ? { ...c, qtd: capped } : c);
      return [...prev, { key: `int-${item.id}`, tipo: 'interno', nome: item.nome, categoria: item.categoria, preco: item.preco, qtd: capped, qtdMax: item.qtdAtual, itemId: item.id, quartoItemId: item.quartoItemId }];
    });
  };

  // ── Disponível — consumir via API ─────────────────────────────────────────────
  const [reporLoading, setReporLoading]           = useState(false);
  const [reporItemLoading, setReporItemLoading]   = useState(new Set());

  const handleConfirmDisponConsumo = async (pag) => {
    if (!selectedRoom) return;
    const internCart = consumoCart.filter((c) => c.tipo === 'interno');
    if (!internCart.length) return;
    setConsumoSaving(true);
    try {
      await Promise.all(internCart.map((c) =>
        quartoApi.consumirItem({ id: c.quartoItemId, quantidade: c.qtd })
      ));
      notify(`${internCart.length} item(s) consumido(s).`);
      setConsumoCart([]); setConsumoCartPag(null);
      await load();
    } catch (e) { notify('Erro: ' + e.message, 'error'); }
    finally { setConsumoSaving(false); }
  };

  const handleReporTudo = async () => {
    if (!selectedRoom) return;
    const itensParaRepor = (selectedRoom.minibar ?? [])
      .map((m) => ({ ...m, delta: m.qtdBase - m.qtdAtual }))
      .filter((m) => m.delta > 0);
    if (!itensParaRepor.length) { notify('Todos os itens já estão no máximo.', 'info'); return; }
    setReporLoading(true);
    try {
      await Promise.all(itensParaRepor.map((m) =>
        quartoApi.reporItem({ id: m.quartoItemId, quantidade: m.delta })
      ));
      notify('Itens repostos.');
      await load();
    } catch (e) { notify('Erro: ' + e.message, 'error'); }
    finally { setReporLoading(false); }
  };

  const handleReporItem = async (item) => {
    const delta = item.qtdBase - item.qtdAtual;
    if (delta <= 0) return;
    setReporItemLoading((prev) => new Set([...prev, item.produtoId]));
    try {
      await quartoApi.reporItem({ id: item.quartoItemId, quantidade: delta });
      notify(`${item.nome} reposto.`);
      await load();
    } catch (e) { notify('Erro: ' + e.message, 'error'); }
    finally { setReporItemLoading((prev) => { const s = new Set(prev); s.delete(item.produtoId); return s; }); }
  };

  const updateExternoQty = (item, newQty) => {
    const catId  = detailConsumoCat;
    const catNome = detailConsumoCatSel?.nome ?? '';
    setExternoCart((prev) => {
      if (newQty <= 0) return prev.filter((c) => !(c.catId === catId && c.itemId === item.id));
      const ex = prev.find((c) => c.catId === catId && c.itemId === item.id);
      if (ex) return prev.map((c) => c.catId === catId && c.itemId === item.id ? { ...c, qtd: newQty } : c);
      return [...prev, { key: `ext-${catId}-${item.id}`, catId, itemId: item.id, nome: item.nome, categoria: catNome, preco: item.preco, qtd: newQty }];
    });
  };

  const removeFromExternoCart = (key) => setExternoCart((prev) => prev.filter((c) => c.key !== key));

  const handleConfirmExterno = () => {
    setConsumoCart((prev) => {
      const updated = [...prev];
      externoCart.forEach((ec) => {
        const cartItem = { key: `ext-${ec.catId}-${ec.itemId}-${Date.now()}`, tipo: 'externo', nome: ec.nome, categoria: ec.categoria, preco: ec.preco, qtd: ec.qtd, itemId: ec.itemId };
        const idx = updated.findIndex((c) => c.tipo === 'externo' && c.itemId === ec.itemId && c.categoria === ec.categoria);
        if (idx >= 0) updated[idx] = { ...updated[idx], qtd: updated[idx].qtd + ec.qtd };
        else updated.push(cartItem);
      });
      return updated;
    });
    setShowConsumoExternoModal(false);
    setExternoCart([]);
    setDetailConsumoCat('');
  };

  const removeFromCart = (key) => setConsumoCart((prev) => prev.filter((c) => c.key !== key));

  const handleConfirmConsumoAll = async (pag) => {
    if (!selectedRoom || consumoCart.length === 0) return;
    setConsumoCartPag(pag);
    setShowConsumoPag(false);
    setConsumoSaving(true);
    try {
      const diarias     = selectedRoom.servico?.diarias ?? [];
      const diariaAtual = selectedRoom.servico?.diariaAtual ?? 0;
      const diaria      = diarias.find((d) => d.num === diariaAtual) ?? diarias[diarias.length - 1];
      if (!diaria?.id) throw new Error('Diária atual não encontrada.');

      const isDespesa = !!pag?.despesa_pessoal;
      const hasPag    = !isDespesa && pag?.tipo_pagamento?.id && pag?.nome_pagador;
      const body = consumoCart.map((item) => ({
        item:            { id: item.itemId },
        quantidade:      item.qtd,
        despesa_pessoal: isDespesa,
        ...(hasPag && {
          pagamento: {
            tipo_pagamento: { id: Number(pag.tipo_pagamento?.id) },
            valor:          item.preco * item.qtd,
            nome_pagador:   pag.nome_pagador,
            ...(pag.descricao ? { descricao: pag.descricao } : {}),
          },
        }),
      }));

      await recepcaoApi.adicionarConsumos(diaria.id, body);
      notify(`${consumoCart.length} item(s) adicionado(s) ao consumo.`);
      setShowAddConsumoModal(false);
      setConsumoCart([]); setConsumoCartPag(null); setDetailConsumoCat('');
      await load();
    } catch (e) { notify('Erro: ' + e.message, 'error'); }
    finally { setConsumoSaving(false); }
  };

  // ── Gerenciar Diárias handlers ────────────────────────────────────────────────
  const openGerenciarDiarias = () => {
    setGdStartDate(null); setGdEndDate(null); setGdDiariaPendentes([]);
    setShowGerenciarDiarias(true);
  };

  const handleAdicionarDiaria = (dataInicio, dataFim) => {
    if (!dataInicio || !dataFim) { notify('Preencha o período da nova diária.', 'error'); return; }
    const formatDate = (d) => {
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      return `${dd}/${mm}/${yyyy}`;
    };
    const novaDiaria = {
      dataInicio: formatDate(dataInicio),
      dataFim: formatDate(dataFim),
      valor: 0, hospedes: selectedRoom.servico?.hospedes || [], consumos: [], pagamentos: [],
    };
    setGdDiariaPendentes((prev) => [...prev, novaDiaria]);
    setTimeout(() => {
      if (gdDiariaListRef.current) {
        gdDiariaListRef.current.scrollTop = gdDiariaListRef.current.scrollHeight;
      }
    }, 50);
  };

  const handleConfirmarDiarias = async () => {
    if (!selectedRoom || gdDiariaPendentes.length === 0) return;
    setSavingGd(true);
    try {
      let updated = selectedRoom;
      for (const diaria of gdDiariaPendentes) {
        updated = await overviewApi.adicionarDiaria(selectedRoom.id, {
          ...diaria,
          dataInicio: `${diaria.dataInicio} 14:00`,
          dataFim: `${diaria.dataFim} 12:00`,
        });
      }
      setQuartos((prev) => prev.map((q) => q.id === updated.id ? updated : q));
      notify(`${gdDiariaPendentes.length} diária(s) adicionada(s).`);
      setGdDiariaPendentes([]);
    } catch (e) { notify('Erro: ' + e.message, 'error'); }
    finally { setSavingGd(false); }
  };

  const handleRemoverDiaria = async (diariaIdx) => {
    if (!selectedRoom) return;
    const diaria = selectedRoom.servico?.diarias?.[diariaIdx];
    const atual = selectedRoom.servico?.diariaAtual || 1;
    if (!diaria) return;
    if (diaria.num < atual) { notify('Não é possível remover uma diária já encerrada.', 'error'); return; }
    setSavingGd(true);
    try {
      const updated = await overviewApi.removerDiaria(selectedRoom.id, diariaIdx);
      setQuartos((prev) => prev.map((q) => q.id === updated.id ? updated : q));
      notify(`Diária ${diaria.num} removida.`);
    } catch (e) { notify('Erro: ' + e.message, 'error'); }
    finally { setSavingGd(false); }
  };

  // ── Trocar Quarto handlers ─────────────────────────────────────────────────────
  const openTrocarQuarto = () => {
    const diarias = selectedRoom?.servico?.diarias || [];
    const atual   = selectedRoom?.servico?.diariaAtual || 1;
    // Pre-select all diárias from current forward
    setTqDiariasIdxs(diarias.filter((d) => d.num >= atual).map((d) => d.idx));
    setTqNovoQuartoId(null);
    setShowTrocarQuarto(true);
  };

  const handleTrocarQuarto = async () => {
    if (!selectedRoom || !tqNovoQuartoId) { notify('Selecione o quarto destino.', 'error'); return; }
    setSavingTq(true);
    try {
      await overviewApi.trocarQuarto(selectedRoom.id, tqNovoQuartoId, tqDiariasIdxs);
      notify('Quarto alterado com sucesso.');
      setShowTrocarQuarto(false);
      closeDetail();
      await load();
    } catch (e) { notify('Erro: ' + e.message, 'error'); }
    finally { setSavingTq(false); }
  };

  // ── Aplicar Desconto ─────────────────────────────────────────────────────────
  const handleAplicarDesconto = async () => {
    const valor = parseBRL(descontoValor) || parseFloat(descontoValor) || 0;
    if (!valor || valor <= 0) { notify('Informe um valor de desconto válido.', 'error'); return; }
    if (!descontoDescricao.trim()) { notify('Informe uma descrição para o desconto.', 'error'); return; }
    setDescontoSaving(true);
    try {
      const desconto = { tipo: descontoTipo, valor, descricao: descontoDescricao, scope: descontoScope };
      const updatedRooms = quartos.map((q) => {
        if (q.id !== selectedRoom?.id) return q;
        return { ...q, servico: { ...q.servico, desconto } };
      });
      setQuartos(updatedRooms);
      const label = descontoTipo === 'percentual' ? `${valor}%` : fmtBRL(valor);
      notify(`Desconto de ${label} aplicado — ${descontoDescricao}.`);
      setShowDescontoModal(false);
    } catch (e) { notify('Erro: ' + e.message, 'error'); }
    finally { setDescontoSaving(false); }
  };

  // ── Adicionar Pagamento ───────────────────────────────────────────────────────
  const tiposPagamentoOv = FORMAS_PAGAMENTO.map((f, i) => ({ id: i + 1, descricao: f }));
  const pagamentoFromPaymentModal = (payment) => {
    const tipoId = Number(payment.tipo_pagamento?.id);
    const forma  = tiposPagamentoOv.find((t) => t.id === tipoId)?.descricao ?? '';
    const now    = new Date();
    return { descricao: payment.descricao ?? '', nomePagador: payment.nome_pagador ?? '', tipoPagamentoId: tipoId, formaPagamento: forma, valor: payment.valor, data: `${dateToDisplay(now)} ${now.toTimeString().slice(0, 5)}` };
  };

  const handleAddPagamento = async (payment) => {
    const pag = pagamentoFromPaymentModal(payment);
    setSaving(true);
    try {
      const updated = await overviewApi.adicionarPagamento(selectedRoom.id, pag);
      setQuartos((prev) => prev.map((q) => q.id === updated.id ? updated : q));
      notify(`Pagamento de ${fmtBRL(pag.valor)} registrado.`);
      setPagModal(false);
    } catch (e) { notify('Erro: ' + e.message, 'error'); }
    finally { setSaving(false); }
  };

  const handleCancelarPagamento = async (pagUuid) => {
    if (!selectedRoom) return;
    setSaving(true);
    try {
      const updated = await overviewApi.cancelarPagamento(selectedRoom.id, pagUuid);
      setQuartos((prev) => prev.map((q) => q.id === updated.id ? updated : q));
      notify('Pagamento cancelado.');
    } catch (e) { notify('Erro: ' + e.message, 'error'); }
    finally { setSaving(false); }
  };

  const handleEditarPagamento = async (oldUuid, payment) => {
    if (!selectedRoom) return;
    const pag = pagamentoFromPaymentModal(payment);
    setSaving(true);
    try {
      await overviewApi.cancelarPagamento(selectedRoom.id, oldUuid);
      const updated = await overviewApi.adicionarPagamento(selectedRoom.id, pag);
      setQuartos((prev) => prev.map((q) => q.id === updated.id ? updated : q));
      notify('Pagamento atualizado.');
      setEditingPag(null);
      setShowGerenciarPag(true);
    } catch (e) { notify('Erro: ' + e.message, 'error'); }
    finally { setSaving(false); }
  };

  const handleRemoverConsumo = async (consumoId) => {
    if (!selectedRoom) return;
    setSaving(true);
    try {
      const updated = await overviewApi.removerConsumo(selectedRoom.id, consumoId);
      setQuartos((prev) => prev.map((q) => q.id === updated.id ? updated : q));
      notify('Consumo removido.');
    } catch (e) { notify('Erro: ' + e.message, 'error'); }
    finally { setSaving(false); }
  };

  const handleAdicionarPessoa = async (pessoaId) => {
    if (!selectedRoom) return;
    const diarias = selectedRoom.servico?.diarias ?? [];
    const selDiaria = diarias[apDiariaIdx];
    if (!selDiaria?.id) { notify('Selecione uma diária primeiro.', 'error'); return; }
    setSaving(true);
    try {
      const updated = await overviewApi.adicionarPessoaDiaria(selectedRoom.id, selDiaria.id, pessoaId);
      setQuartos((prev) => prev.map((q) => q.id === updated.id ? updated : q));
      notify('Pessoa adicionada.');
      setApSearch('');
      setApSearchResults([]);
    } catch (e) { notify('Erro: ' + e.message, 'error'); }
    finally { setSaving(false); }
  };

  const handleRemoverPessoa = async (diariaId, pessoaId, nome) => {
    if (!selectedRoom) return;
    if (!window.confirm(`Remover ${nome} desta diária?`)) return;
    setSaving(true);
    try {
      const updated = await overviewApi.removerPessoaDiaria(selectedRoom.id, diariaId, pessoaId);
      setQuartos((prev) => prev.map((q) => q.id === updated.id ? updated : q));
      notify('Pessoa removida.');
    } catch (e) { notify('Erro: ' + e.message, 'error'); }
    finally { setSaving(false); }
  };

  const handlePayConfirmNew = async (payment) => {
    const pag = pagamentoFromPaymentModal(payment);
    if (payOnConfirm) await payOnConfirm(pag);
    setPayModal(false);
  };


  // ── Render helpers ─────────────────────────────────────────────────────────────
  const BedsRow = ({ camas }) => (
    <div className={styles.bedsRow}>
      <span className={styles.bedItem}><BedDouble size={11} /> Cama Casal: {camas.casal || 0}</span>
      <span className={styles.bedItem}><BedSingle size={11} /> Solteiro: {camas.solteiro || 0}</span>
      <span className={styles.bedItem}><Layers size={11} /> Beliche: {camas.beliche || 0}</span>
      <span className={styles.bedItem}><Waves size={11} /> Rede: {camas.rede || 0}</span>
    </div>
  );

  const BedsDetailGrid = ({ camas }) => (
    <div className={styles.bedsDetailGrid}>
      {[
        { key: 'casal',    label: 'Cama Casal',   Icon: BedDouble },
        { key: 'solteiro', label: 'Cama Solteiro', Icon: BedSingle },
        { key: 'beliche',  label: 'Beliches',      Icon: Layers    },
        { key: 'rede',     label: 'Rede',          Icon: Waves     },
      ].map(({ key, label, Icon }) => (
        <div key={key} className={[styles.bedDetailItem, camas[key] > 0 ? styles.bedDetailItemActive : ''].join(' ')}>
          <Icon size={18} className={styles.bedDetailIcon} />
          <div>
            <span className={styles.bedDetailLabel}>{label}</span>
            <span className={styles.bedDetailCount}>{camas[key] || 0}</span>
          </div>
        </div>
      ))}
    </div>
  );

  // ── Build detail modal content ─────────────────────────────────────────────
  const renderDetailContent = () => {
    if (!selectedRoom) return null;
    const s = selectedRoom;
    const sk = roomStatusKey(s.status);
    const ini = (nome) => (nome || '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

    // ── Disponível ────────────────────────────────────────────────────────────
    if (s.status === ROOM_STATUS.DISPONIVEL) {
      const dispTabs  = [
        { id: 'dados',   label: 'Dados' },
        { id: 'consumo', label: 'Consumo' },
      ];
      return (
        <>
          <div className={styles.detailTabs}>
            {dispTabs.map((t) => (
              <button key={t.id} className={[styles.detailTab, detailTab === t.id ? styles.detailTabActive : ''].join(' ')} onClick={() => setDetailTab(t.id)}>
                {t.label}
              </button>
            ))}
          </div>
          <div className={styles.detailTabBody}>
            {detailTab === 'dados' && (
              <div className={styles.tabContent}>
                <div className={styles.sectionTitle}><BedDouble size={13} /> Configuração de Camas</div>
                <BedsDetailGrid camas={s.camas} />
                <div className={styles.infoGrid2}>
                  <div className={styles.infoRow}><span className={styles.infoLabel}>Categoria</span><span className={styles.infoValue}>{s.categoria}</span></div>
                  <div className={styles.infoRow}><span className={styles.infoLabel}>Tipo de Ocupação</span><span className={styles.infoValue}>{s.tipoOcupacao}</span></div>
                </div>
                {s.descricao && (
                  <div className={styles.descricaoBlock}>
                    <span className={styles.infoLabel}>Descrição</span>
                    <p className={styles.descricaoText}>{s.descricao}</p>
                  </div>
                )}
              </div>
            )}
            {detailTab === 'consumo' && (() => {
              const minibarItems = (s.minibar || []).map((item) => ({
                id: item.produtoId,
                quartoItemId: item.quartoItemId,
                nome: item.nome,
                categoria: item.categoria || 'Minibar',
                preco: item.preco ?? 0,
                qtdAtual: item.qtdAtual ?? 0,
                qtdBase: item.qtdBase ?? 0,
                qtdTotal: item.qtdTotal ?? null,
              }));
              const temParaRepor = minibarItems.some((i) => i.qtdAtual < i.qtdBase);
              const internCart  = consumoCart.filter((c) => c.tipo === 'interno');
              const cartTotal   = internCart.reduce((sum, c) => sum + c.preco * c.qtd, 0);
              const hasSelected = internCart.length > 0;
              return (
                <div className={styles.tabContent}>
                  <div className={styles.consumoModalSection}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div className={styles.consumoModalSectionTitle}><ShoppingCart size={13} /> Itens do quarto</div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {hasSelected && (
                          <Button variant="primary" style={{ padding: '4px 10px', fontSize: 12 }} disabled={consumoSaving} onClick={() => setShowDisponPay(true)}>
                            {consumoSaving && <Loader2 size={12} className={styles.spin} />}
                            <ShoppingCart size={12} /> Consumir
                          </Button>
                        )}
                        {temParaRepor && !hasSelected && (
                          <Button variant="secondary" style={{ padding: '4px 10px', fontSize: 12 }} disabled={reporLoading} onClick={handleReporTudo}>
                            {reporLoading ? <Loader2 size={12} className={styles.spin} /> : <RotateCcw size={12} />}
                            Repor tudo
                          </Button>
                        )}
                        <Button variant="secondary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={handleOpenAddEstoque}>
                          <Plus size={12} /> Adicionar Item
                        </Button>
                      </div>
                    </div>
                    {minibarItems.length === 0
                      ? <div className={styles.emptyList}><Package size={24} color="var(--text-2)" /><span>Nenhum item no quarto</span></div>
                      : (
                        <div className={styles.consumoItemList}>
                          {minibarItems.map((item) => {
                            const esgotado = item.qtdAtual === 0;
                            const cartEntry = internCart.find((c) => c.itemId === item.id);
                            const cartQty   = cartEntry?.qtd ?? 0;
                            return (
                              <div key={item.id} className={styles.consumoItemRow}>
                                <div className={styles.consumoItemInfo}>
                                  <span className={styles.consumoItemNome}>{item.nome}</span>
                                  <span className={styles.consumoItemMeta}>{item.categoria}{item.preco > 0 ? ` · ${fmtBRL(item.preco)}/un.` : ''}</span>
                                </div>
                                <div className={styles.minibarStockInfo}>
                                  <span className={[styles.minibarStockBadge, esgotado ? styles.minibarStockBadgeEmpty : ''].join(' ')}>
                                    {item.qtdAtual}/{item.qtdBase}
                                  </span>
                                  {item.qtdTotal != null && (
                                    <span className={styles.minibarStockTotal}>({item.qtdTotal} un. disp.)</span>
                                  )}
                                </div>
                                <div className={[styles.cartQtdStepper, esgotado ? styles.cartQtdStepperDisabled : ''].join(' ')}>
                                  <button disabled={cartQty === 0} onClick={() => updateInternQty(item, cartQty - 1)}>−</button>
                                  <span className={styles.cartStepperFrac}>{cartQty}</span>
                                  <button disabled={esgotado || cartQty >= item.qtdAtual} onClick={() => updateInternQty(item, cartQty + 1)}>+</button>
                                </div>
                                {item.qtdAtual < item.qtdBase && (
                                  <button
                                    className={styles.reporItemBtn}
                                    disabled={reporItemLoading.has(item.produtoId)}
                                    onClick={() => handleReporItem(item)}
                                    title="Repor item"
                                  >
                                    {reporItemLoading.has(item.produtoId)
                                      ? <Loader2 size={11} className={styles.spin} />
                                      : <RotateCcw size={11} />}
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )
                    }
                  </div>

                </div>
              );
            })()}
            {detailTab === 'itens' && (
              <div className={styles.tabContent}>
                {(!s.itens || s.itens.length === 0)
                  ? <div className={styles.emptyList}><Package size={24} color="var(--text-2)" /><span>Nenhum item cadastrado</span></div>
                  : (
                    <div className={styles.itemsGrid}>
                      {s.itens.map((item, i) => (
                        <div key={i} className={styles.itemCard}>
                          <Package size={14} className={styles.itemCardIcon} />
                          <div>
                            <div className={styles.itemCardName}>{item.nome}</div>
                            <div className={styles.itemCardQty}>Qtd: {item.qtd}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                }
              </div>
            )}
          </div>
        </>
      );
    }

    // ── Limpeza / Manutenção / Fora ───────────────────────────────────────────
    if ([ROOM_STATUS.LIMPEZA, ROOM_STATUS.MANUTENCAO, ROOM_STATUS.FORA_DE_SERVICO].includes(s.status)) {
      return (
        <div className={styles.tabContent}>
          <div className={styles.infoGrid2}>
            <div className={styles.infoRow}><span className={styles.infoLabel}>Categoria</span><span className={styles.infoValue}>{s.categoria}</span></div>
            <div className={styles.infoRow}><span className={styles.infoLabel}>Tipo de Ocupação</span><span className={styles.infoValue}>{s.tipoOcupacao}</span></div>
          </div>
          {s.status === ROOM_STATUS.LIMPEZA && s.limpeza && (
            <div className={styles.serviceBlock}>
              <Sparkles size={14} className={styles.serviceBlockIcon} />
              <div className={styles.serviceBlockInfo}>
                <span className={styles.serviceBlockLabel}>Em Limpeza</span>
                {s.limpeza.responsavel && <span className={styles.serviceBlockValue}>Responsável: {s.limpeza.responsavel}</span>}
                {s.limpeza.inicio      && <span className={styles.serviceBlockSub}>Início: {s.limpeza.inicio}</span>}
              </div>
            </div>
          )}
          {(s.status === ROOM_STATUS.MANUTENCAO || s.status === ROOM_STATUS.FORA_DE_SERVICO) && s.manutencao && (
            <div className={styles.serviceBlock}>
              <Wrench size={14} className={[styles.serviceBlockIcon, styles.serviceBlockIconAmber].join(' ')} />
              <div className={styles.serviceBlockInfo}>
                <span className={styles.serviceBlockLabel}>{s.status}</span>
                {s.manutencao.responsavel && <span className={styles.serviceBlockValue}>Responsável: {s.manutencao.responsavel}</span>}
                {s.manutencao.descricao   && <span className={styles.serviceBlockSub}>{s.manutencao.descricao}</span>}
                {s.manutencao.previsaoFim && <span className={styles.serviceBlockSub}>Previsão: {s.manutencao.previsaoFim}</span>}
              </div>
            </div>
          )}
          <BedsDetailGrid camas={s.camas} />
        </div>
      );
    }

    // ── Reservado ─────────────────────────────────────────────────────────────
    if (s.status === ROOM_STATUS.RESERVADO && s.servico?.tipo === 'reserva') {
      const sv = s.servico;
      const progressPercent = sv.valorTotal > 0 ? Math.min(100, ((sv.totalPago || 0) / sv.valorTotal) * 100) : 0;
      const allPagamentos   = sv.pagamentos || [];
      const pagamentoTotal  = allPagamentos.reduce((acc, p) => acc + (p.valor ?? 0), 0);
      const [checkinDate, checkinHora]   = (sv.chegadaPrevista || '').split(' ');
      const [checkoutDate, checkoutHora] = (sv.saidaPrevista   || '').split(' ');
      return (
        <>
          {/* ── Header ── */}
          <div className={styles.ovHeader}>
            <div className={styles.ovRoomBadge}>{s.numero}</div>
            <div className={styles.ovHeaderContent}>
              <div className={styles.ovHeaderTopRow}>
                <span className={[styles.ovHeaderStatusPill, styles[`ovStatus_reservado`]].join(' ')}>{s.status}</span>
              </div>
              <div className={styles.ovHeaderName}>{sv.titularNome || `Apartamento ${s.numero}`}</div>
              <div className={styles.ovHeaderSub}>
                {s.categoria} · {s.tipoOcupacao} · Reserva
              </div>
            </div>
            <button className={styles.ovCloseBtn} onClick={closeDetail}><X size={15} /></button>
          </div>

          {/* ── Tab bar ── */}
          <div className={styles.detailTabs}>
            {[
              ['detalhes',   'Detalhes'],
              ['pessoas',    `Pessoas (${svGuests.length})`],
              ['pagamentos', `Pagamentos (${allPagamentos.length})`],
            ].map(([t, label]) => (
              <button key={t} className={[styles.detailTab, diariaTab === t ? styles.detailTabActive : ''].join(' ')} onClick={() => setDiariaTab(t)}>
                {label}
              </button>
            ))}
          </div>

          {/* ── Tab body ── */}
          <div className={styles.detailTabBody}>
            {diariaTab === 'detalhes' && (
              <div className={styles.ovBodyPad}>
                <div className={styles.ovPeriodDark}>
                  <div className={styles.ovDatesRow}>
                    <div className={styles.ovDateCell}>
                      <div className={styles.ovDateLabel}>Check-in</div>
                      <div className={styles.ovDateValue}>{checkinDate}</div>
                      <div className={styles.ovDateTime}>{checkinHora}</div>
                    </div>
                    <div className={styles.ovDateArrow}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                      </svg>
                    </div>
                    <div className={[styles.ovDateCell, styles.ovDateCellRight].join(' ')}>
                      <div className={styles.ovDateLabel}>Check-out</div>
                      <div className={styles.ovDateValue}>{checkoutDate}</div>
                      <div className={styles.ovDateTime}>{checkoutHora}</div>
                    </div>
                    <div className={styles.ovNightsCell}>
                      <div className={styles.ovNightsNum}>{sv.totalDiarias || '—'}</div>
                      <div className={styles.ovNightsLabel}>Diárias</div>
                    </div>
                  </div>
                </div>
                <div className={styles.ovFinCard}>
                  <div className={styles.ovFinHeader}>
                    <DollarSign size={13} className={styles.ovFinIcon} />
                    <span className={styles.ovFinTitle}>Resumo Financeiro</span>
                  </div>
                  <div className={styles.ovFinRow}>
                    <div className={styles.ovFinItem}>
                      <span className={styles.ovFinLabel}>Valor Total</span>
                      <span className={styles.ovFinValue}>{fmtBRL(sv.valorTotal)}</span>
                    </div>
                    <div className={styles.ovFinItem}>
                      <span className={styles.ovFinLabel}>Total Pago</span>
                      <span className={styles.ovFinValue}>{fmtBRL(sv.totalPago || 0)}</span>
                    </div>
                    <div className={styles.ovFinItem}>
                      <span className={styles.ovFinLabel}>Pendente</span>
                      <span className={[styles.ovFinValue, (sv.pagamentoPendente || 0) > 0 ? styles.ovFinPending : styles.ovFinPaid].join(' ')}>
                        {fmtBRL(sv.pagamentoPendente || 0)}
                      </span>
                    </div>
                  </div>
                  {sv.valorTotal > 0 && (
                    <div className={styles.ovFinProgress}>
                      <div className={styles.ovFinProgressMeta}>
                        <span>Progresso de pagamento</span>
                        <span>{progressPercent.toFixed(0)}%</span>
                      </div>
                      <div className={styles.ovFinBar}>
                        <div className={styles.ovFinBarFill} style={{ width: `${progressPercent}%` }} />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
            {diariaTab === 'pessoas' && (
              <div className={styles.ovBodyPad}>
                {svGuests.length === 0
                  ? <div className={styles.emptyList}><User size={24} color="var(--text-2)" /><span>Nenhum hóspede registrado</span></div>
                  : (
                    <div className={styles.ovGuestTable}>
                      {svGuests.map((h) => (
                        <div key={h.id || h.nome} className={styles.ovGuestRow}>
                          <div className={styles.ovGuestAvatar}>{ini(h.nome)}</div>
                          <div className={styles.ovGuestInfo}>
                            <div className={styles.ovGuestName}>{h.nome}</div>
                            {h.telefone && <div className={styles.ovGuestMeta}>{h.telefone}</div>}
                            {h.email    && <div className={styles.ovGuestMeta}>{h.email}</div>}
                          </div>
                          <div className={styles.contactActions}>
                            {h.telefone && (
                              <a href={`https://wa.me/55${h.telefone.replace(/\D/g,'')}`} target="_blank" rel="noreferrer"
                                className={styles.quickBtn} title="WhatsApp" onClick={(e) => e.stopPropagation()}>
                                <svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                              </a>
                            )}
                            {h.email && (
                              <a href={`mailto:${h.email}`}
                                className={styles.quickBtn} title="E-mail" onClick={(e) => e.stopPropagation()}>
                                <Mail size={11} />
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                }
              </div>
            )}
            {diariaTab === 'pagamentos' && (
              <div className={styles.subTabContent} style={{ padding: 16 }}>
                {allPagamentos.length === 0
                  ? <div className={styles.emptyList}><CreditCard size={24} color="var(--text-2)" /><span>Nenhum pagamento registrado</span></div>
                  : (
                    <div className={styles.ovDiariasCard}>
                      {allPagamentos.map((p, i) => (
                        <div key={i} className={styles.ovPricePagCard}>
                          <div className={styles.ovPricePagMain}>
                            <div className={styles.ovPagTitle}>{p.descricao}</div>
                            {(p.nomePagador || sv.titularNome) && <div className={styles.ovPagName}>{p.nomePagador || sv.titularNome}</div>}
                            <div className={styles.ovPagMeta}>
                              {p.data && <span>{p.data}</span>}
                              {(p.forma || p.formaPagamento) && (
                                <>{p.data && <span className={styles.ovPagDot}>·</span>}<span>{p.forma || p.formaPagamento}</span></>
                              )}
                            </div>
                            {p.registradoPor && <div className={styles.ovPagRegistrado}>registrado por {p.registradoPor}</div>}
                          </div>
                          <span className={styles.ovPagValor}>{fmtBRL(p.valor)}</span>
                        </div>
                      ))}
                      {allPagamentos.length > 1 && (
                        <div className={styles.ovPriceConsumoTotal}>
                          <span>Total pagamentos</span>
                          <span>{fmtBRL(pagamentoTotal)}</span>
                        </div>
                      )}
                    </div>
                  )
                }
              </div>
            )}
          </div>

          {/* ── Footer ── */}
          <div className={styles.ovFooter}>
            <div className={styles.ovAcoesWrap}>
              {ovAcoesOpen && (
                <>
                  <div className={styles.ovAcoesBackdrop} onClick={closeAcoes} />
                  <div className={styles.ovAcoesMenu}>
                    <button className={[styles.ovAcoesItem, styles.ovAcoesItemDanger].join(' ')} onClick={() => { closeAcoes(); setConfirmModal({ action: 'cancelar' }); }}>
                      <XCircle size={14} /> Cancelar Reserva
                    </button>
                    <button className={[styles.ovAcoesItem, styles.ovAcoesItemPrimary].join(' ')} onClick={() => { closeAcoes(); handleHospedarReserva(); }} disabled={saving}>
                      {saving ? <Loader2 size={14} className={styles.spin} /> : <CheckCircle size={14} />} Hospedar
                    </button>
                  </div>
                </>
              )}
              <button className={styles.ovAcoesBtn} onClick={() => { setOvAcoesOpen((v) => !v); setVoucherPicking(false); }}>
                Ações
                <ChevronDown size={14} className={ovAcoesOpen ? styles.ovAcoesBtnChevronOpen : styles.ovAcoesBtnChevron} />
              </button>
            </div>
          </div>
        </>
      );
    }

    // ── Ocupado — Pernoite ─────────────────────────────────────────────────────
    if (s.servico?.tipo === 'pernoite') {
      const sv = s.servico;
      const diarias = sv.diarias || [];
      const curDiaria = diarias[detailDiariaIdx];
      const progressPercent = sv.valorTotal > 0 ? Math.min(100, (sv.totalPago / sv.valorTotal) * 100) : 0;
      const allPagamentos = sv.pagamentos || [];
      return (
        <>
          {/* ── Custom header ── */}
          <div className={styles.ovHeader}>
            <div className={styles.ovRoomBadge}>{s.numero}</div>
            <div className={styles.ovHeaderContent}>
              <div className={styles.ovHeaderTopRow}>
                <span className={[styles.ovHeaderStatusPill, styles[`ovStatus_${sk}`]].join(' ')}>{s.status}</span>
              </div>
              <div className={styles.ovHeaderName}>{sv.titularNome || `Apartamento ${s.numero}`}</div>
              <div className={styles.ovHeaderSub}>{s.categoria} · {s.tipoOcupacao} · Pernoite</div>
            </div>
            <button className={styles.ovCloseBtn} onClick={closeDetail}><X size={16} /></button>
          </div>

          {/* ── Tab bar ── */}
          <div className={styles.detailTabs}>
            {[
              ['detalhes',   'Detalhes'],
              ['pessoas',    `Pessoas (${svGuests.length})`],
              ['pagamentos', `Pagamentos (${allPagamentos.length})`],
              ['consumos',   `Consumos (${(sv.consumos || []).length})`],
            ].map(([t, label]) => (
              <button key={t} className={[styles.detailTab, diariaTab === t ? styles.detailTabActive : ''].join(' ')} onClick={() => setDiariaTab(t)}>
                {label}
              </button>
            ))}
          </div>

          {/* ── Tab body ── */}
          <div className={styles.detailTabBody}>
            {diariaTab === 'detalhes' && (
              <div className={styles.ovBodyPad}>
                <div className={styles.ovPeriodDark}>
                  <div className={styles.ovDatesRow}>
                    <div className={styles.ovDateCell}>
                      <div className={styles.ovDateLabel}>Check-in</div>
                      <div className={styles.ovDateValue}>{sv.chegadaPrevista?.split(' ')[0] || '—'}</div>
                      <div className={styles.ovDateTime}>{sv.chegadaPrevista?.split(' ')[1] || ''}</div>
                    </div>
                    <div className={styles.ovDateArrow}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                      </svg>
                    </div>
                    <div className={[styles.ovDateCell, styles.ovDateCellRight].join(' ')}>
                      <div className={styles.ovDateLabel}>Check-out</div>
                      <div className={styles.ovDateValue}>{sv.saidaPrevista?.split(' ')[0] || '—'}</div>
                      <div className={styles.ovDateTime}>{sv.saidaPrevista?.split(' ')[1] || ''}</div>
                    </div>
                    <div className={styles.ovNightsCell}>
                      <div className={styles.ovNightsNum}><span style={{ color: '#ef4444' }}>{sv.diariaAtual}</span>/{sv.totalDiarias}</div>
                      <div className={styles.ovNightsLabel}>Diárias</div>
                    </div>
                  </div>
                </div>
                <div className={styles.ovFinCard}>
                  <div className={styles.ovFinRow}>
                    <div className={styles.ovFinItem}>
                      <span className={styles.ovFinLabel}>Valor Total</span>
                      <span className={styles.ovFinValue}>{fmtBRL(sv.valorTotal)}</span>
                    </div>
                    <div className={styles.ovFinItem}>
                      <span className={styles.ovFinLabel}>Total Pago</span>
                      <span className={styles.ovFinValue}>{fmtBRL(sv.totalPago)}</span>
                    </div>
                    <div className={styles.ovFinItem}>
                      <span className={styles.ovFinLabel}>Pendente</span>
                      <span className={[styles.ovFinValue, sv.pagamentoPendente > 0 ? styles.ovFinPending : styles.ovFinPaid].join(' ')}>
                        {fmtBRL(sv.pagamentoPendente)}
                      </span>
                    </div>
                  </div>
                  {sv.valorTotal > 0 && (
                    <div className={styles.ovFinProgress}>
                      <div className={styles.ovFinProgressMeta}>
                        <span>Progresso de pagamento</span>
                        <span>{progressPercent.toFixed(0)}%</span>
                      </div>
                      <div className={styles.ovFinBar}>
                        <div className={styles.ovFinBarFill} style={{ width: `${progressPercent}%` }} />
                      </div>
                    </div>
                  )}
                  {sv.diarias?.length > 0 && (
                    <div className={styles.ovPriceInline}>
                      <div className={styles.ovDiariasCard}>
                        <div className={styles.ovDiariasList}>
                          {sv.diarias.map((d) => {
                            const dateFrom = d.dataInicio?.split(' ')[0] || '';
                            const dateTo   = d.dataFim?.split(' ')[0] || '';
                            const nHosp    = (d.hospedes || []).length || 1;
                            return (
                              <div key={d.num} className={styles.ovPriceCardRow}>
                                <div className={styles.ovDiariaDesc}>
                                  <span className={styles.ovDiariaNum}>Diária {d.num}</span>
                                  {dateFrom && <span className={styles.ovDiariaDate}>{dateFrom}</span>}
                                  {dateTo   && <span className={styles.ovDiariaDate}>{dateTo}</span>}
                                  <span className={styles.ovDiariaDate}>{nHosp} Adulto{nHosp !== 1 ? 's' : ''}</span>
                                </div>
                                <span className={styles.step3PriceVal}>{fmtBRL(d.valor)}</span>
                              </div>
                            );
                          })}
                        </div>
                        {sv.diarias.length > 1 && (
                          <div className={styles.ovPriceConsumoTotal}>
                            <span>Total diárias</span>
                            <span>{fmtBRL(sv.diarias.reduce((s, d) => s + (d.valor ?? 0), 0))}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
            {diariaTab === 'pessoas' && (
              <div className={styles.ovBodyPad}>
                {svGuests.length === 0
                  ? <div className={styles.emptyList}><User size={24} color="var(--text-2)" /><span>Nenhum hóspede registrado</span></div>
                  : (
                    <div className={styles.ovGuestTable}>
                      {svGuests.map((h) => (
                        <div key={h.id || h.nome} className={styles.ovGuestRow}>
                          <div className={styles.ovGuestAvatar}>{ini(h.nome)}</div>
                          <div className={styles.ovGuestInfo}>
                            <div className={styles.ovGuestName}>{h.nome}</div>
                            {h.telefone && <div className={styles.ovGuestMeta}>{h.telefone}</div>}
                            {h.email    && <div className={styles.ovGuestMeta}>{h.email}</div>}
                          </div>
                          <div className={styles.contactActions}>
                            {h.telefone && (
                              <a href={`https://wa.me/55${h.telefone.replace(/\D/g,'')}`} target="_blank" rel="noreferrer"
                                className={styles.quickBtn} title="WhatsApp" onClick={(e) => e.stopPropagation()}>
                                <svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                              </a>
                            )}
                            {h.email && (
                              <a href={`mailto:${h.email}`}
                                className={styles.quickBtn} title="E-mail" onClick={(e) => e.stopPropagation()}>
                                <Mail size={11} />
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                }
              </div>
            )}
            {diariaTab === 'pagamentos' && (
              <div className={styles.ovBodyPad}>
                <div className={styles.ovFinCard}>
                  <div className={styles.ovFinRow}>
                    <div className={styles.ovFinItem}>
                      <span className={styles.ovFinLabel}>Valor Total</span>
                      <span className={styles.ovFinValue}>{fmtBRL(sv.valorTotal)}</span>
                    </div>
                    <div className={styles.ovFinItem}>
                      <span className={styles.ovFinLabel}>Total Pago</span>
                      <span className={styles.ovFinValue}>{fmtBRL(sv.totalPago)}</span>
                    </div>
                    <div className={styles.ovFinItem}>
                      <span className={styles.ovFinLabel}>Pendente</span>
                      <span className={[styles.ovFinValue, sv.pagamentoPendente > 0 ? styles.ovFinPending : styles.ovFinPaid].join(' ')}>
                        {fmtBRL(sv.pagamentoPendente)}
                      </span>
                    </div>
                  </div>
                  {sv.valorTotal > 0 && (
                    <div className={styles.ovFinProgress}>
                      <div className={styles.ovFinProgressMeta}>
                        <span>Progresso de pagamento</span>
                        <span>{progressPercent.toFixed(0)}%</span>
                      </div>
                      <div className={styles.ovFinBar}>
                        <div className={styles.ovFinBarFill} style={{ width: `${progressPercent}%` }} />
                      </div>
                    </div>
                  )}
                </div>
                {allPagamentos.length === 0
                  ? <div className={styles.emptyList}><CreditCard size={24} color="var(--text-2)" /><span>Nenhum pagamento registrado</span></div>
                  : (
                    <div className={styles.ovDiariasCard}>
                      {allPagamentos.map((p, i) => (
                        <div key={i} className={styles.ovPricePagCard}>
                          <div className={styles.ovPricePagMain}>
                            <div className={styles.ovPagTitle}>{p.descricao}</div>
                            {(p.nomePagador || sv.titularNome) && <div className={styles.ovPagName}>{p.nomePagador || sv.titularNome}</div>}
                            <div className={styles.ovPagMeta}>
                              {p.data && <span>{p.data}</span>}
                              {(p.forma || p.formaPagamento) && (
                                <>
                                  {p.data && <span className={styles.ovPagDot}>·</span>}
                                  <span>{p.forma || p.formaPagamento}</span>
                                </>
                              )}
                            </div>
                            {p.registradoPor && <div className={styles.ovPagRegistrado}>registrado por {p.registradoPor}</div>}
                          </div>
                          <span className={styles.ovPagValor}>{fmtBRL(p.valor)}</span>
                        </div>
                      ))}
                      {allPagamentos.length > 1 && (
                        <div className={styles.ovPriceConsumoTotal}>
                          <span>Total pagamentos</span>
                          <span>{fmtBRL(allPagamentos.reduce((acc, p) => acc + (p.valor ?? 0), 0))}</span>
                        </div>
                      )}
                    </div>
                  )
                }
              </div>
            )}
            {diariaTab === 'consumos' && (
              <div className={styles.ovBodyPad}>
                {(sv.consumos || []).length === 0
                  ? <div className={styles.emptyList}><ShoppingCart size={24} color="var(--text-2)" /><span>Nenhum consumo registrado</span></div>
                  : (
                    <div className={styles.receiptCard}>
                      <div className={styles.receiptHead}>
                        <div className={styles.receiptTitle}>Consumos — Quarto {s.numero}</div>
                        <div className={styles.receiptSub}>
                          {sv.chegadaPrevista?.split(' ')[0]}
                          {sv.saidaPrevista ? ` → ${sv.saidaPrevista.split(' ')[0]}` : ''}
                        </div>
                      </div>
                      {(sv.consumos || []).map((c, i) => (
                        <div key={c.id || i} className={styles.receiptRow}>
                          <div>
                            <div className={styles.receiptItemName}>{c.item}</div>
                            {(c.categoria || c.despesaPessoal || c.pagamento?.formaPagamento) && (
                              <div className={styles.receiptItemSub}>
                                {c.despesaPessoal
                                  ? 'Despesa pessoal'
                                  : [c.categoria, c.pagamento?.nomePagador, c.pagamento?.formaPagamento].filter(Boolean).join(' · ')
                                }
                              </div>
                            )}
                          </div>
                          <span className={styles.receiptItemMeta}>
                            {c.quantidade > 1 ? `×${c.quantidade}` : ''}
                            {c.valorUnitario > 0 ? `  ${fmtBRL(c.valorUnitario)}` : ''}
                          </span>
                          <span className={styles.receiptItemVal}>{fmtBRL(c.valorTotal)}</span>
                        </div>
                      ))}
                      <div className={styles.receiptFoot}>
                        <span>Total</span>
                        <span>{fmtBRL((sv.consumos || []).reduce((s, c) => s + (c.valorTotal ?? 0), 0))}</span>
                      </div>
                    </div>
                  )
                }
              </div>
            )}
          </div>

          {/* ── Footer ── */}
          <div className={styles.ovFooter}>
            <div className={styles.ovAcoesWrap}>
              {ovAcoesOpen && (
                <>
                  <div className={styles.ovAcoesBackdrop} onClick={closeAcoes} />
                  <div className={styles.ovAcoesMenu}>
                    {voucherPicking ? (
                      <>
                        <button className={styles.ovAcoesSubBack} onClick={() => setVoucherPicking(false)}>
                          <ChevronLeft size={12} /> Voucher de Hospedagem
                        </button>
                        <button className={styles.ovAcoesItem} onClick={() => { gerarVoucherHospedagem({ quarto: s, servico: sv, incluirConsumo: false }); closeAcoes(); }}>
                          <FileText size={14} /> Sem Consumo
                        </button>
                        {(sv.consumos || []).length > 0 && (
                          <button className={styles.ovAcoesItem} onClick={() => { gerarVoucherHospedagem({ quarto: s, servico: sv, incluirConsumo: true }); closeAcoes(); }}>
                            <FileText size={14} /> Com Consumo
                          </button>
                        )}
                      </>
                    ) : (
                      <>
                        <button className={styles.ovAcoesItem} onClick={() => { closeAcoes(); openService('limpeza', s); }}>
                          <Sparkles size={14} /> Limpeza
                        </button>
                        <button className={styles.ovAcoesItem} onClick={() => { closeAcoes(); openService('manutencao', s); }}>
                          <Wrench size={14} /> Manutenção
                        </button>
                        <button className={styles.ovAcoesItem} onClick={() => { closeAcoes(); openGerenciarDiarias(); }}>
                          <RefreshCw size={14} /> Gerenciar Diárias
                        </button>
                        <button className={styles.ovAcoesItem} onClick={() => { closeAcoes(); openTrocarQuarto(); }}>
                          <ArrowLeftRight size={14} /> Trocar Quarto
                        </button>
                        <button className={styles.ovAcoesItem} onClick={() => { closeAcoes(); setShowGerenciarPag(true); }}>
                          <CreditCard size={14} /> Gerenciar Pagamentos
                        </button>
                        <button className={styles.ovAcoesItem} onClick={() => { closeAcoes(); setShowGerenciarConsumo(true); }}>
                          <ShoppingCart size={14} /> Gerenciar Consumos
                        </button>
                        <button className={styles.ovAcoesItem} onClick={() => { closeAcoes(); setApDiariaIdx((sv.diariaAtual ?? 1) - 1); setApComboOpen(false); setApSearch(''); setApSearchResults([]); setShowAlterarPessoas(true); }}>
                          <Users size={14} /> Gerenciar Pessoas
                        </button>
                        <button className={styles.ovAcoesItem} onClick={() => setVoucherPicking(true)}>
                          <FileText size={14} /> Gerar Voucher
                          <ChevronRight size={12} className={styles.ovAcoesItemArrow} />
                        </button>
                        <div className={styles.ovAcoesDiv} />
                        <button className={[styles.ovAcoesItem, styles.ovAcoesItemDanger].join(' ')} onClick={() => { closeAcoes(); setConfirmModal({ action: 'cancelar' }); }}>
                          <XCircle size={14} /> Cancelar Pernoite
                        </button>
                        <button className={[styles.ovAcoesItem, styles.ovAcoesItemPrimary].join(' ')} onClick={() => { closeAcoes(); handleClickFinalizar(); }} disabled={saving}>
                          {saving ? <Loader2 size={14} className={styles.spin} /> : <CheckCircle size={14} />} Finalizar
                        </button>
                      </>
                    )}
                  </div>
                </>
              )}
              <button className={styles.ovAcoesBtn} onClick={() => { setOvAcoesOpen((v) => !v); setVoucherPicking(false); }}>
                Ações
                <ChevronDown size={14} className={ovAcoesOpen ? styles.ovAcoesBtnChevronOpen : styles.ovAcoesBtnChevron} />
              </button>
            </div>
          </div>
        </>
      );
    }

    // ── Ocupado — Day Use ──────────────────────────────────────────────────────
    if (s.servico?.tipo === 'dayuse') {
      const sv     = s.servico;
      const isAtivo = sv.status === DAYUSE_STATUS.ATIVO;
      return (
        <>
          <div className={styles.detailTabs}>
            {[
              ['dados',      'Dados'],
              ['hospedes',   `Hóspedes (${sv.hospedes?.length || 0})`],
              ['consumos',   `Consumo (${sv.consumos?.length || 0})`],
              ['pagamentos', `Pagamentos (${sv.pagamentos?.length || 0})`],
            ].map(([t, label]) => (
              <button key={t} className={[styles.detailTab, detailTab === t ? styles.detailTabActive : ''].join(' ')} onClick={() => setDetailTab(t)}>
                {label}
              </button>
            ))}
          </div>

          <div className={styles.detailTabBody}>
            {detailTab === 'dados' && (
              <div className={styles.tabContent}>
                <div className={styles.pricingBlock}>
                  <div className={styles.pricingBlockTitle}>Day Use — {s.categoria}</div>
                  <div className={styles.pricingCols}>
                    <div className={styles.pricingCol}>
                      <span className={styles.pricingColLabel}>Referência de Preços</span>
                      <span className={styles.pricingColVal}>{fmtBRL(sv.precoBase)}</span>
                      <span className={styles.pricingColSub}>{sv.horasBase}h base · +{fmtBRL(sv.precoAdicional)}/h extra</span>
                    </div>
                    <div className={styles.pricingColSep} />
                    <div className={styles.pricingCol}>
                      <span className={styles.pricingColLabel}>{isAtivo ? 'Tempo decorrido' : 'Tempo total'}</span>
                      {isAtivo
                        ? <span className={[styles.pricingColVal, styles.clockRunning].join(' ')}>{fmtClock(selElapsedSec)}</span>
                        : <span className={styles.pricingColVal}>{fmtElapsed(selElapsedMin)}</span>
                      }
                      <span className={styles.pricingColSub}>{isAtivo ? 'em andamento' : (sv.horaEntrada + ' → ' + sv.horaSaida)}</span>
                    </div>
                  </div>
                </div>
                <div className={styles.financialBox}>
                  <div className={styles.financialGrid}>
                    <div className={styles.financialItem}>
                      <span className={styles.financialLabel}>{isAtivo ? 'Hospedagem até agora' : 'Hospedagem'}</span>
                      <span className={styles.financialValue}>{fmtBRL(isAtivo ? selValorAtual : sv.valorTotal)}</span>
                    </div>
                    <div className={styles.financialItem}>
                      <span className={styles.financialLabel}>Consumo</span>
                      <span className={styles.financialValue}>{fmtBRL(selConsumoTotal)}</span>
                    </div>
                    <div className={styles.financialItem}>
                      <span className={styles.financialLabel}>Total</span>
                      <span className={[styles.financialValue, styles.valueGreen].join(' ')}>
                        {fmtBRL((isAtivo ? selValorAtual : sv.valorTotal) + selConsumoTotal)}
                      </span>
                    </div>
                  </div>
                  {!isAtivo && (() => {
                    const duTotal = (sv.valorTotal || 0) + selConsumoTotal;
                    const duPago  = sv.totalPago || 0;
                    const duPct   = duTotal > 0 ? Math.min(100, (duPago / duTotal) * 100) : 0;
                    return (
                      <>
                        <div className={styles.financialGrid} style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                          <div className={styles.financialItem}>
                            <span className={styles.financialLabel}>Total Pago</span>
                            <span className={[styles.financialValue, styles.valueGreen].join(' ')}>{fmtBRL(sv.totalPago || 0)}</span>
                          </div>
                          <div className={styles.financialItem}>
                            <span className={styles.financialLabel}>Falta Pagar</span>
                            <span className={[styles.financialValue, (sv.pagamentoPendente || 0) > 0 ? styles.valueAmber : styles.valueGreen].join(' ')}>
                              {fmtBRL(sv.pagamentoPendente || 0)}
                            </span>
                          </div>
                          {sv.desconto?.valor > 0 && (
                            <div className={styles.financialItem}>
                              <span className={styles.financialLabel}>Desconto</span>
                              <span className={[styles.financialValue, styles.valueGreen].join(' ')}>
                                {sv.desconto.tipo === 'percentual' ? `${sv.desconto.valor}%` : fmtBRL(sv.desconto.valor)}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className={styles.progressWrap} style={{ marginTop: 10 }}>
                          <div className={styles.progressLabels}>
                            <span>Progresso de pagamento</span>
                            <span>{duPct.toFixed(0)}%</span>
                          </div>
                          <div className={styles.progressBar}>
                            <div className={styles.progressFill} style={{ width: `${duPct}%` }} />
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
                <div className={styles.infoGrid2}>
                  <div className={styles.infoRow}><span className={styles.infoLabel}>Titular</span><span className={styles.infoValue}>{sv.titularNome || <em>Sem titular</em>}</span></div>
                  <div className={styles.infoRow}><span className={styles.infoLabel}>Data de uso</span><span className={styles.infoValue}>{sv.dataUso}</span></div>
                  <div className={styles.infoRow}><span className={styles.infoLabel}>Entrada</span><span className={styles.infoValue}>{sv.horaEntrada}</span></div>
                  <div className={styles.infoRow}><span className={styles.infoLabel}>Saída</span><span className={styles.infoValue}>{sv.horaSaida || <em>Em aberto</em>}</span></div>
                  {sv.pagamentoPendente > 0 && <div className={styles.infoRow}><span className={styles.infoLabel}>Pendente</span><span className={[styles.infoValue, styles.textAmber].join(' ')}>{fmtBRL(sv.pagamentoPendente)}</span></div>}
                </div>
              </div>
            )}
            {detailTab === 'hospedes' && (
              <div className={styles.ovBodyPad}>
                <Button variant="secondary" size="sm" onClick={() => { setApDiariaIdx(0); setApComboOpen(false); setApSearch(''); setApSearchResults([]); setShowAlterarPessoas(true); }}>
                  <Users size={13} /> Gerenciar Pessoas
                </Button>
                {svGuests.length === 0
                  ? <div className={styles.emptyList}><User size={24} color="var(--text-2)" /><span>Nenhum hóspede registrado</span></div>
                  : (
                    <div className={styles.ovGuestTable}>
                      {svGuests.map((h) => (
                          <div key={h.id} className={styles.ovGuestRow}>
                            <div className={styles.ovGuestAvatarCol}>
                              <div className={styles.ovGuestAvatar}>{ini(h.nome)}</div>
                              <div className={styles.contactActions}>
                                {h.telefone && (
                                  <a href={`https://wa.me/55${h.telefone.replace(/\D/g,'')}`} target="_blank" rel="noreferrer"
                                    className={styles.quickBtn} title="WhatsApp" onClick={(e) => e.stopPropagation()}>
                                    <Phone size={11} />
                                  </a>
                                )}
                                {h.email && (
                                  <a href={`mailto:${h.email}`}
                                    className={styles.quickBtn} title="E-mail" onClick={(e) => e.stopPropagation()}>
                                    <Mail size={11} />
                                  </a>
                                )}
                              </div>
                            </div>
                            <div className={styles.ovGuestInfo}>
                              <div className={styles.ovGuestName}>{h.nome}</div>
                              {h.telefone && <div className={styles.ovGuestMeta}>{h.telefone}</div>}
                              {h.email    && <div className={styles.ovGuestMeta}>{h.email}</div>}
                            </div>
                            <button type="button" className={styles.removeBtn}
                              onClick={() => { if (window.confirm(`Remover ${h.nome}?`)) notify('Funcionalidade em desenvolvimento.', 'info'); }}>
                              <Trash2 size={12} />
                            </button>
                          </div>
                      ))}
                    </div>
                  )
                }
              </div>
            )}
            {detailTab === 'consumos' && (
              <div className={styles.subTabContent}>
                <Button variant="primary" size="sm" onClick={() => setShowGerenciarConsumo(true)}>
                  <ShoppingCart size={13} /> Gerenciar Consumos
                </Button>
                {(sv.consumos || []).length === 0
                  ? <div className={styles.emptyList}><ShoppingCart size={24} color="var(--text-2)" /><span>Nenhum consumo registrado</span></div>
                  : (
                    <div className={styles.itemList}>
                      {(sv.consumos || []).map((c, i) => (
                        <div key={c.id || i} className={styles.listItem}>
                          <div className={styles.listItemLeft}>
                            <ShoppingCart size={14} className={c.tipo === 'interno' ? styles.listItemIconGreen : styles.listItemIcon} />
                            <div>
                              <div className={styles.listItemName}>{c.item}</div>
                              <div className={styles.listItemSub}>{c.categoria} · Qtd: {c.quantidade}{c.formaPagamento ? ` · ${c.formaPagamento}` : ''}</div>
                            </div>
                          </div>
                          <span className={styles.listItemValue}>{fmtBRL(c.valorTotal)}</span>
                        </div>
                      ))}
                    </div>
                  )
                }
              </div>
            )}
            {detailTab === 'pagamentos' && (
              <div className={styles.subTabContent}>
                <Button variant="primary" size="sm" onClick={() => setShowGerenciarPag(true)}>
                  <CreditCard size={13} /> Gerenciar Pagamentos
                </Button>
                <div className={styles.itemList}>
                  {(sv.pagamentos || []).length === 0
                    ? <div className={styles.emptyList}><CreditCard size={24} color="var(--text-2)" /><span>Nenhum pagamento registrado</span></div>
                    : (sv.pagamentos || []).map((p) => (
                      <div key={p.id} className={styles.listItem}>
                        <div className={styles.listItemLeft}>
                          <CreditCard size={14} className={styles.listItemIconGreen} />
                          <div>
                            <div className={styles.listItemName}>{p.descricao}</div>
                            <div className={styles.listItemSub}>{p.formaPagamento} · {p.data}</div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span className={[styles.listItemValue, styles.valueGreen].join(' ')}>{fmtBRL(p.valor)}</span>
                          <button className={styles.removeBtn} onClick={() => notify('Em desenvolvimento')}><Trash2 size={13} /></button>
                        </div>
                      </div>
                    ))
                  }
                </div>
              </div>
            )}
          </div>
        </>
      );
    }

    return null;
  };

  // ── Build detail modal footer ─────────────────────────────────────────────
  const renderDetailFooter = () => {
    if (!selectedRoom) return null;
    const s = selectedRoom;

    if (s.status === ROOM_STATUS.DISPONIVEL) {
      return (
        <div className={styles.footerRight}>
          <div className={styles.ovAcoesWrap}>
            {ovAcoesOpen && (
              <>
                <div className={styles.ovAcoesBackdrop} onClick={closeAcoes} />
                <div className={styles.ovAcoesMenu}>
                  <button className={styles.ovAcoesItem} onClick={() => { closeAcoes(); openService('limpeza', s); }}>
                    <Sparkles size={14} /> Limpeza
                  </button>
                  <button className={styles.ovAcoesItem} onClick={() => { closeAcoes(); openService('manutencao', s); }}>
                    <Wrench size={14} /> Manutenção
                  </button>
                  <div className={styles.ovAcoesDiv} />
                  <button className={styles.ovAcoesItem} onClick={() => { closeAcoes(); openNovoServico('pernoite', s); }}>
                    <BedDouble size={14} /> Novo Pernoite
                  </button>
                  <button className={[styles.ovAcoesItem, styles.ovAcoesItemPrimary].join(' ')} onClick={() => { closeAcoes(); openNovoServico('dayuse', s); }}>
                    <Clock size={14} /> Novo Day Use
                  </button>
                </div>
              </>
            )}
            <button className={styles.ovAcoesBtn} onClick={() => setOvAcoesOpen((v) => !v)}>
              Ações
              <ChevronDown size={14} className={ovAcoesOpen ? styles.ovAcoesBtnChevronOpen : styles.ovAcoesBtnChevron} />
            </button>
          </div>
        </div>
      );
    }

    if (s.status === ROOM_STATUS.LIMPEZA) {
      return (
        <div className={styles.footerRight}>
          <Button variant="primary" className={styles.btnBlue} onClick={() => handleFinalizarLimpeza(s)} disabled={saving}>
            {saving && <Loader2 size={14} className={styles.spin} />}
            <Sparkles size={14} /> Finalizar Limpeza
          </Button>
        </div>
      );
    }

    if (s.status === ROOM_STATUS.MANUTENCAO) {
      return (
        <div className={styles.footerRight}>
          <Button variant="primary" className={styles.btnPurple} onClick={() => handleFinalizarManutencao(s)} disabled={saving}>
            {saving && <Loader2 size={14} className={styles.spin} />}
            <Wrench size={14} /> Finalizar Manutenção
          </Button>
        </div>
      );
    }

    if (s.status === ROOM_STATUS.FORA_DE_SERVICO) {
      return (
        <div className={styles.footerRight}>
          <Button variant="secondary" onClick={closeDetail}>Fechar</Button>
          <Button variant="primary" className={styles.btnGreen} onClick={() => handleMarcarDisponivel(s)} disabled={saving}>
            {saving && <Loader2 size={14} className={styles.spin} />}
            <BedDouble size={14} /> Marcar Disponível
          </Button>
        </div>
      );
    }

    if (s.status === ROOM_STATUS.RESERVADO) {
      return (
        <div className={styles.footerRight}>
          <Button variant="danger" onClick={() => setConfirmModal({ action: 'cancelar' })}>
            <XCircle size={14} /> Cancelar Reserva
          </Button>
          <Button variant="primary" onClick={handleHospedarReserva} disabled={saving}>
            {saving && <Loader2 size={14} className={styles.spin} />}
            <BedDouble size={14} /> Hospedar
          </Button>
        </div>
      );
    }

    if (s.servico?.tipo === 'pernoite') {
      return (
        <div className={styles.footerBetween}>
          <div className={styles.footerLeft}>
            <Button variant="danger" onClick={() => setConfirmModal({ action: 'cancelar' })}>
              <XCircle size={14} /> Cancelar
            </Button>
          </div>
          <div className={styles.footerRight}>
            <Button variant="primary" onClick={handleClickFinalizar} disabled={saving}>
              {saving && <Loader2 size={14} className={styles.spin} />}
              <CheckCircle size={14} /> Finalizar
            </Button>
          </div>
        </div>
      );
    }

    if (s.servico?.tipo === 'dayuse') {
      const sv = s.servico;
      const isAtivo     = sv.status === DAYUSE_STATUS.ATIVO;
      const isEncerrado = sv.status === DAYUSE_STATUS.ENCERRADO;
      return (
        <div className={styles.footerBetween}>
          <div className={styles.footerLeft}>
            <Button variant="danger" onClick={() => setConfirmModal({ action: 'cancelar' })}>
              <XCircle size={14} /> Cancelar
            </Button>
            {isEncerrado && (
              <Button variant="secondary" onClick={() => openService('limpeza', s)}>
                <Sparkles size={14} /> Limpeza
              </Button>
            )}
          </div>
          <div className={styles.footerRight}>
            {isAtivo && (
              <Button variant="primary" onClick={() => setEncerrarModal(true)}>
                <Square size={14} /> Encerrar tempo
              </Button>
            )}
            {isEncerrado && (
              <>
                <Button variant="secondary" onClick={() => {
                  setDescontoScope('global'); setDescontoTipo('percentual');
                  setDescontoValor(''); setDescontoDescricao('');
                  setShowDescontoModal(true);
                }}>
                  <Tag size={14} /> Desconto
                </Button>
                <Button variant="primary" onClick={handleClickFinalizar} disabled={saving}>
                  {saving && <Loader2 size={14} className={styles.spin} />}
                  <CheckCircle size={14} /> Finalizar
                </Button>
              </>
            )}
          </div>
        </div>
      );
    }

    return <div className={styles.footerRight}><Button variant="secondary" onClick={closeDetail}>Fechar</Button></div>;
  };

  // ── Detail modal title ────────────────────────────────────────────────────
  const renderDetailTitle = () => {
    if (!selectedRoom) return null;
    const s  = selectedRoom;
    const sk = roomStatusKey(s.status);
    const sv = s.servico;
    const mainLine = sv?.titularNome
      ? sv.titularNome
      : sv?.tipo === 'dayuse' ? 'Day Use em andamento'
      : `Apartamento ${s.numero}`;

    return (
      <div className={styles.detailModalTitle}>
        <div className={[styles.detailRoomBadge, styles[`detailBadge_${sk}`]].join(' ')}>
          {s.numero}
        </div>
        <div>
          <div className={[styles.detailTitular, !sv?.titularNome && sv?.tipo === 'dayuse' ? styles.detailTitularPending : ''].join(' ')}>
            {mainLine}
          </div>
          <div className={styles.detailMeta}>
            <span className={[styles.statusBadge, styles[`badge_${sk}`]].join(' ')}>{s.status}</span>
            <span className={styles.detailCategoria}>{s.categoria}</span>
            <span className={styles.detailSep}>·</span>
            <span className={styles.detailTipo}>{s.tipoOcupacao}</span>
            {sv?.periodo && <span className={styles.detailPeriodo}>{sv.periodo}</span>}
            {sv?.tipo === 'pernoite' && <span className={styles.pernoiteBadge}>Pernoite</span>}
            {sv?.tipo === 'dayuse'   && <span className={styles.dayuseBadge}>Day Use</span>}
          </div>
        </div>
      </div>
    );
  };

  // ── Room Row ──────────────────────────────────────────────────────────────
  const RoomCard = ({ room }) => {
    const sk        = roomStatusKey(room.status);
    const sv        = room.servico;
    const isDuAtivo = sv?.tipo === 'dayuse' && sv.status === DAYUSE_STATUS.ATIVO;
    const elapsed   = isDuAtivo ? calcElapsedMinutes(sv.dataUso, sv.horaEntrada, null) : 0;
    const guestCount  = sv?.hospedes?.length ?? 0;
    const hasDesconto = !!(sv?.desconto?.valor);

    const bedTags = room.status === ROOM_STATUS.DISPONIVEL
      ? [
          { key: 'casal',    Icon: BedDouble },
          { key: 'solteiro', Icon: BedSingle },
          { key: 'beliche',  Icon: Layers    },
          { key: 'rede',     Icon: Waves     },
        ].filter(({ key }) => (room.camas?.[key] || 0) > 0)
      : [];

    return (
      <div className={[styles.roomCard, styles[`roomCard_${sk}`]].join(' ')} onClick={() => openDetail(room)}>
        {/* Top row: number + status badge */}
        <div className={styles.roomCardTop}>
          <span className={[styles.roomCardNum, styles[`roomCardNum_${sk}`]].join(' ')}>{room.numero}</span>
          <span className={[styles.statusBadge, styles[`badge_${sk}`]].join(' ')}>{room.status}</span>
        </div>

        {/* Content by status */}
        <div className={styles.roomCardBody}>
          {room.status === ROOM_STATUS.DISPONIVEL && (
            <div className={styles.bedGrid}>
              {[
                { key: 'casal',    Icon: BedDouble, label: 'Casal'    },
                { key: 'solteiro', Icon: BedSingle, label: 'Solteiro' },
                { key: 'beliche',  Icon: Layers,    label: 'Beliche'  },
                { key: 'rede',     Icon: Waves,     label: 'Rede'     },
              ].map(({ key, Icon, label }) => {
                const qty = room.camas?.[key] || 0;
                return (
                  <div key={key} title={label} className={[styles.bedGridCell, qty > 0 ? styles.bedGridCellActive : ''].join(' ')}>
                    <Icon size={12} />
                    <span className={styles.bedGridQty}>{qty}</span>
                  </div>
                );
              })}
            </div>
          )}

          {room.status === ROOM_STATUS.LIMPEZA && (
            <>
              <span className={styles.roomCardLabel}>Em Limpeza</span>
              {room.limpeza?.responsavel && <span className={styles.roomCardMeta}><User size={10} /> {room.limpeza.responsavel}</span>}
            </>
          )}

          {(room.status === ROOM_STATUS.MANUTENCAO || room.status === ROOM_STATUS.FORA_DE_SERVICO) && (
            <>
              <span className={styles.roomCardLabel}>{room.status === ROOM_STATUS.MANUTENCAO ? 'Manutenção' : 'Fora de Serviço'}</span>
              {room.manutencao?.responsavel && <span className={styles.roomCardMeta}><Wrench size={10} /> {room.manutencao.responsavel}</span>}
              {room.manutencao?.descricao   && <span className={styles.roomCardDesc}>{room.manutencao.descricao.slice(0, 50)}</span>}
            </>
          )}

          {sv?.tipo === 'pernoite' && (
            <>
              <span className={styles.roomCardGuest}>{sv.titularNome || '—'}</span>
              {sv.periodo && (
                <span className={styles.roomCardPeriod}><Calendar size={10} /> {sv.periodo}</span>
              )}
              <div className={styles.roomCardBadges}>
                {guestCount > 0 && <span className={styles.guestCountBadge}><Users size={10} />{guestCount}</span>}
                {sv.totalDiarias > 0 && <span className={styles.diariaBadge}><Calendar size={9} />{sv.diariaAtual}/{sv.totalDiarias}</span>}
                <span className={styles.pernoiteBadge}>Pernoite</span>
                {hasDesconto && (
                  <span className={styles.descontoBadge}><Tag size={9} />{sv.desconto.tipo === 'percentual' ? `${sv.desconto.valor}%` : fmtBRL(sv.desconto.valor)}</span>
                )}
              </div>
              {sv.pagamentoPendente > 0 && (
                <span className={styles.roomCardPendente}>{fmtBRL(sv.pagamentoPendente)} pendente</span>
              )}
            </>
          )}

          {sv?.tipo === 'dayuse' && (
            <>
              <span className={styles.roomCardGuest}>
                {sv.titularNome || (sv.status === DAYUSE_STATUS.ENCERRADO ? 'Day use encerrado' : sv.status === DAYUSE_STATUS.FINALIZADO ? 'Day use finalizado' : 'Day Use')}
              </span>
              <span className={styles.roomCardPeriod}>
                {isDuAtivo
                  ? <><Clock size={10} /> <span className={styles.timerLive}>{sv.horaEntrada} · {fmtElapsed(elapsed)}</span></>
                  : <><Clock size={10} /> {sv.horaEntrada}{sv.horaSaida ? ` → ${sv.horaSaida}` : ''}</>
                }
              </span>
              <div className={styles.roomCardBadges}>
                {guestCount > 0 && <span className={styles.guestCountBadge}><Users size={10} />{guestCount}</span>}
                <span className={styles.dayuseBadge}>Day Use</span>
                {hasDesconto && (
                  <span className={styles.descontoBadge}><Tag size={9} />{sv.desconto.tipo === 'percentual' ? `${sv.desconto.valor}%` : fmtBRL(sv.desconto.valor)}</span>
                )}
              </div>
              {sv.pagamentoPendente > 0 && (
                <span className={styles.roomCardPendente}>{fmtBRL(sv.pagamentoPendente)} pendente</span>
              )}
            </>
          )}

          {sv?.tipo === 'reserva' && (() => {
            const parseBrDate = (s) => { const [d, t] = (s || '').split(' '); const [dd, mm, yyyy] = (d || '').split('/'); return yyyy ? new Date(`${yyyy}-${mm}-${dd}T${t || '00:00'}`) : null; };
            const cin  = parseBrDate(sv.chegadaPrevista);
            const cout = parseBrDate(sv.saidaPrevista);
            const noites = cin && cout ? Math.round((cout - cin) / 86400000) : null;
            const nPessoas = (sv.hospedes || []).length;
            return (
              <>
                <span className={styles.roomCardGuest} style={{ whiteSpace: 'normal', overflow: 'visible', textOverflow: 'unset', lineHeight: 1.25 }}>{sv.titularNome || '—'}</span>
                {sv.chegadaPrevista && <span className={styles.roomCardPeriod}><Calendar size={10} /> Check-in: {sv.chegadaPrevista}</span>}
                <div className={styles.roomCardBadges} style={{ marginTop: 2 }}>
                  {nPessoas > 0 && <span className={styles.guestCountBadge}><Users size={10} /> {nPessoas}</span>}
                  {noites > 0   && <span className={styles.guestCountBadge}><Calendar size={10} /> {noites}</span>}
                </div>
              </>
            );
          })()}
        </div>
      </div>
    );
  };

  // ── Hospede search result component ──────────────────────────────────────────
  const HospedeResults = ({ results, onAdd }) =>
    results.length === 0 ? null : (
      <div className={styles.hospedeResults}>
        {results.map((h) => (
          <div key={h.id} className={styles.hospedeResult} onClick={() => onAdd(h)}>
            <span className={styles.hospedeResultName}>{h.nome}</span>
            <span className={styles.hospedeResultSub}>{h.cpf} · {h.telefone}</span>
          </div>
        ))}
      </div>
    );

  // ── Main render ───────────────────────────────────────────────────────────────
  return (
    <div className={styles.page}>
      <Notification notification={notif} />

      <div className={styles.card}>
        {/* ── Header ── */}
        <div className={styles.tableHeader}>
          <div className={styles.tableHeaderLeft}>
            <h2 className={styles.h2}>Recepção</h2>
            <p className={styles.subtitle}><Building2 size={13} /> Visão geral de quartos, hóspedes e day use</p>
          </div>
          <div className={styles.tableHeaderActions}>
            <div className={[styles.searchWrap, styles.headerControl].join(' ')}>
              <Search size={13} className={styles.searchIcon} />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nº ou hóspede..." className={styles.searchInput} />
              {search.trim() && (
                <button
                  type="button"
                  className={styles.searchClearBtn}
                  onClick={() => setSearch('')}
                  aria-label="Limpar busca"
                  title="Limpar busca"
                >
                  <X size={12} />
                </button>
              )}
            </div>
            <div className={[styles.dateRangeWrap, styles.headerControl].join(' ')}>
              <DatePicker
                mode="single"
                value={filterDateStart}
                onChange={(date) => { setFilterDateStart(date); setFilterDateEnd(null); setDateGroupCollapsed({}); }}
                placeholder="Data de check-in..."
                className={styles.datePickerWrap}
                triggerClassName={styles.headerControlField}
              />
            </div>
            <Button variant="primary" className={styles.headerControlBtn} onClick={() => setShowAddQuarto(true)}>
              <Plus size={14} /> Adicionar Quarto
            </Button>
          </div>
        </div>

        {/* ── Filters row ── */}
        <div className={styles.filterTabs}>
          <div className={styles.filterField}>
            <div className={styles.filterSelectWrap}>
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className={[
                  styles.filterSelectBar,
                  statusFilter !== 'todos' ? styles.filterSelectActive : '',
                  statusFilter !== 'todos' ? styles.filterSelectWithClear : '',
                ].join(' ')}
              >
                <option value="todos">Todos os quartos</option>
                {FILTER_OPTIONS.filter((f) => f.id !== 'todos').map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}{filterCounts[f.id] != null ? ` (${filterCounts[f.id]})` : ''}
                  </option>
                ))}
              </Select>
              {statusFilter !== 'todos' && (
                <button
                  type="button"
                  className={styles.filterClearBtn}
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setStatusFilter('todos'); }}
                  aria-label="Limpar filtro de status"
                  title="Limpar filtro"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>
          <div className={styles.filterField}>
            <div className={styles.filterSelectWrap}>
              <Select
                value={filterTipoOcupacao}
                onChange={(e) => setFilterTipoOcupacao(e.target.value)}
                className={[
                  styles.filterSelectBar,
                  filterTipoOcupacao ? styles.filterSelectActive : '',
                  filterTipoOcupacao ? styles.filterSelectWithClear : '',
                ].join(' ')}
              >
                <option value="">Tipo de ocupação</option>
                {TIPOS_OCUPACAO.map((t) => <option key={t} value={t}>{t}</option>)}
              </Select>
              {filterTipoOcupacao && (
                <button
                  type="button"
                  className={styles.filterClearBtn}
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setFilterTipoOcupacao(''); }}
                  aria-label="Limpar filtro de tipo de ocupação"
                  title="Limpar filtro"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Category / Date groups ── */}
        {loading ? (
          <div className={styles.emptyState}><Loader2 size={28} className={styles.spin} /> Carregando...</div>
        ) : isDateFilterActive ? (
          /* ── Date-sorted view (when date range active) ── */
          dateGroups.length === 0
            ? <div className={styles.emptyState}>Nenhum pernoite encontrado neste período.</div>
            : dateGroups.map((group) => (
              <div key={group.date} className={styles.dateSection}>
                <button className={styles.dateGroupHeader} onClick={() => toggleDateGroup(group.date)}>
                  <div className={styles.dateGroupHeaderLeft}>
                    <ChevronDown size={14} className={[styles.catChevron, isDateGroupCollapsed(group.date) ? styles.catChevronClosed : ''].join(' ')} />
                    <Calendar size={13} style={{ color: 'var(--text-2)' }} />
                    <span className={styles.dateGroupTitle}>Check-in {group.date}</span>
                  </div>
                  <span className={styles.dateGroupCount}>{group.rooms.length} quarto{group.rooms.length !== 1 ? 's' : ''}</span>
                </button>
                {!isDateGroupCollapsed(group.date) && (
                  <div className={styles.catBody}>
                    <div className={styles.roomGrid}>
                      {group.rooms.map((room) => <RoomCard key={room.id} room={room} />)}
                    </div>
                  </div>
                )}
              </div>
            ))
        ) : (
          /* ── Normal category view ── */
          byCategory.map((cat) => (
            <div key={cat.id} className={styles.catSection}>
              <div className={styles.catHeader} onClick={() => toggleCollapse(cat.id)}>
                <div className={styles.catHeaderLeft}>
                  <ChevronDown size={15} className={[styles.catChevron, collapsed[cat.id] ? styles.catChevronClosed : ''].join(' ')} />
                  {collapsed[cat.id] ? (
                    <span className={styles.catName} style={{ marginRight: 0 }}>{cat.nome}</span>
                  ) : (
                    <div>
                      <span className={styles.catName}>{cat.nome}</span>
                      <span className={styles.catDesc}>{cat.descricao}</span>
                    </div>
                  )}
                </div>
              </div>
              {!collapsed[cat.id] && (
                <div className={styles.catBody}>
                  {cat.rooms.length === 0
                    ? <div className={styles.catEmpty}>Nenhum quarto com os filtros aplicados.</div>
                    : <div className={styles.roomGrid}>{cat.rooms.map((room) => <RoomCard key={room.id} room={room} />)}</div>
                  }
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════
          MODAL — Detalhe do Quarto
      ═══════════════════════════════════════════════════════ */}
      {selectedRoom && (() => {
        const isServiceCard = [ROOM_STATUS.LIMPEZA, ROOM_STATUS.MANUTENCAO, ROOM_STATUS.FORA_DE_SERVICO].includes(selectedRoom.status);
        const isFullscreen  = ['pernoite', 'reserva'].includes(selectedRoom?.servico?.tipo);
        return (
        <Modal
          open={!!selectedRoom}
          onClose={closeDetail}
          size="lg"
          hideHeader={isFullscreen}
          title={renderDetailTitle()}
          footer={isFullscreen ? undefined : renderDetailFooter()}
          containerStyle={isFullscreen
            ? { height: window.innerWidth <= 980 ? 'min(90vh, 680px)' : 'clamp(480px, 74vh, 640px)', width: 'min(520px, 96vw)', maxWidth: 'min(520px, 96vw)' }
            : undefined}
          bodyStyle={isFullscreen
            ? { padding: 0, gap: 0, display: 'flex', flexDirection: 'column', overflow: window.innerWidth <= 980 ? 'auto' : 'hidden', flex: 1, minHeight: 0 }
            : undefined}
        >
          {renderDetailContent()}
        </Modal>
        );
      })()}

      <NovoServicoModal
        novoModal={novoModal} setNovoModal={setNovoModal} novoRoom={novoRoom}
        nhHospedes={nhHospedes} setNhHospedes={setNhHospedes}
        nhCheckinDate={nhCheckinDate} setNhCheckinDate={setNhCheckinDate}
        nhCheckoutDate={nhCheckoutDate} setNhCheckoutDate={setNhCheckoutDate}
        nhCalcLoading={nhCalcLoading} nhCalc={nhCalc}
        nhShowPriceDetail={nhShowPriceDetail} setNhShowPriceDetail={setNhShowPriceDetail}
        nhTotalHosp={nhTotalHosp} nhTotalPago={nhTotalPago} nhPendente={nhPendente}
        nhPagamentos={nhPagamentos} setNhPagamentos={setNhPagamentos}
        nhPagTipoId={nhPagTipoId} setNhPagTipoId={setNhPagTipoId}
        nhPagNomePagador={nhPagNomePagador} setNhPagNomePagador={setNhPagNomePagador}
        nhPagDescricao={nhPagDescricao} setNhPagDescricao={setNhPagDescricao}
        nhPagValor={nhPagValor} setNhPagValor={setNhPagValor}
        nhShowPagForm={nhShowPagForm} setNhShowPagForm={setNhShowPagForm}
        savingNh={savingNh} handleCriarPernoite={handleCriarPernoite}
        saving={saving} handleCriarDayUse={handleCriarDayUse}
        nduForm={nduForm} setNduForm={setNduForm}
        nduHosp={nduHosp} addNduHospede={addNduHospede} remNduHospede={remNduHospede}
        tiposPagamentoOv={tiposPagamentoOv}
      />

      <EncerrarModal
        open={encerrarModal && selectedRoom?.servico?.tipo === 'dayuse'}
        onClose={() => setEncerrarModal(false)}
        selectedRoom={selectedRoom}
        handleEncerrar={handleEncerrar}
        saving={saving}
        selElapsedSec={selElapsedSec}
        selElapsedMin={selElapsedMin}
        selValorAtual={selValorAtual}
      />

      {/* ═══════════════════════════════════════════════════════
          MODAL — Adicionar Item do Estoque ao Quarto
      ═══════════════════════════════════════════════════════ */}
      {showAddEstoque && selectedRoom && (() => {
        const minibarIds = new Set((selectedRoom.minibar ?? []).map((m) => m.produtoId));
        const catSel     = estoqueCats.find((c) => String(c.id) === estoqueSelCat);
        const catItems   = catSel?.itens ?? [];
        return (
          <Modal
            open
            onClose={() => setShowAddEstoque(false)}
            size="sm"
            title={<><Package size={15} /> Adicionar Item — Apt. {selectedRoom.numero}</>}
            footer={
              <div className={styles.footerRight}>
                <Button variant="secondary" onClick={() => setShowAddEstoque(false)}>Cancelar</Button>
                <Button variant="primary" onClick={handleConfirmAddEstoque} disabled={savingEstoque || !estoqueSelItem}>
                  {savingEstoque && <Loader2 size={14} className={styles.spin} />}
                  Adicionar
                </Button>
              </div>
            }
          >
            <div className={styles.formStack}>
              {estoqueLoading ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-2)', fontSize: 13 }}>
                  <Loader2 size={14} className={styles.spin} /> Carregando estoque...
                </div>
              ) : (
                <>
                  <FormField label="Categoria *">
                    <Select value={estoqueSelCat} onChange={(e) => { setEstoqueSelCat(e.target.value); setEstoqueSelItem(null); }}>
                      <option value="">Selecione...</option>
                      {estoqueCats.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                    </Select>
                  </FormField>
                  {catSel && (
                    <FormField label="Item *">
                      <Select value={estoqueSelItem?.id ?? ''} onChange={(e) => {
                        const found = catItems.find((i) => String(i.id) === e.target.value);
                        setEstoqueSelItem(found ?? null);
                      }}>
                        <option value="">Selecione...</option>
                        {catItems.map((i) => {
                          const jaNoQuarto = minibarIds.has(i.id);
                          return (
                            <option key={i.id} value={i.id} disabled={jaNoQuarto}>
                              {i.descricao}{jaNoQuarto ? ' (já no quarto)' : ''}{i.valor_venda ? ` — ${fmtBRL(i.valor_venda)}` : ''}{i.quantidade != null ? ` (estoque: ${i.quantidade})` : ''}
                            </option>
                          );
                        })}
                      </Select>
                    </FormField>
                  )}
                  {estoqueSelItem && (
                    <>
                      <div className={styles.estoqueItemInfo}>
                        <Package size={13} />
                        <span>{estoqueSelItem.descricao}</span>
                        {estoqueSelItem.valor_venda != null && (
                          <span className={styles.estoqueItemPrice}>{fmtBRL(estoqueSelItem.valor_venda)}/un.</span>
                        )}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <FormField label="Qtd. atual *">
                          <Input
                            type="number" min="0"
                            value={estoqueQtdAtual}
                            onChange={(e) => setEstoqueQtdAtual(Math.max(0, parseInt(e.target.value) || 0))}
                          />
                        </FormField>
                        <FormField label="Qtd. padrão *">
                          <Input
                            type="number" min="1"
                            value={estoqueQtdPadrao}
                            onChange={(e) => setEstoqueQtdPadrao(Math.max(1, parseInt(e.target.value) || 1))}
                          />
                        </FormField>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          </Modal>
        );
      })()}

      {/* ═══════════════════════════════════════════════════════
          MODAL — Consumir (disponível) — pagamento direto
      ═══════════════════════════════════════════════════════ */}
      <PaymentModal
        open={showDisponPay}
        onClose={() => setShowDisponPay(false)}
        onConfirm={(pag) => { setShowDisponPay(false); handleConfirmDisponConsumo(pag); }}
        tiposPagamento={tiposPagamentoOv}
        isSubmitting={consumoSaving}
        titularNome={null}
        valorTotal={consumoCart.filter((c) => c.tipo === 'interno').reduce((s, c) => s + c.preco * c.qtd, 0)}
        valorPago={null}
        canAplicarDesconto={false}
        canDespesaPessoal={true}
      />

      {/* ═══════════════════════════════════════════════════════
          MODAL — Pagamento Unificado
      ═══════════════════════════════════════════════════════ */}
      <PaymentModal
        open={!!payModal}
        onClose={() => setPayModal(false)}
        onConfirm={handlePayConfirmNew}
        tiposPagamento={tiposPagamentoOv}
        isSubmitting={saving}
        titularNome={selectedRoom?.servico?.titularNome ?? null}
        valorTotal={selectedRoom?.servico?.valorTotal ?? null}
        valorPago={selectedRoom?.servico?.totalPago ?? null}
        canAplicarDesconto={false}
      />

      {/* ═══════════════════════════════════════════════════════
          MODAL — Adicionar Pagamento
      ═══════════════════════════════════════════════════════ */}
      <PaymentModal
        open={!!pagModal}
        onClose={() => setPagModal(false)}
        onConfirm={handleAddPagamento}
        tiposPagamento={tiposPagamentoOv}
        isSubmitting={saving}
        titularNome={selectedRoom?.servico?.titularNome ?? null}
        valorTotal={selectedRoom?.servico?.valorTotal ?? null}
        valorPago={selectedRoom?.servico?.totalPago ?? null}
        canAplicarDesconto={false}
      />

      {/* ═══════════════════════════════════════════════════════
          MODAL — Acionar Serviço (Limpeza / Manutenção / Fora)
      ═══════════════════════════════════════════════════════ */}
      {serviceModal && (
        <Modal
          open
          onClose={() => setServiceModal(null)}
          size="sm"
          title={
            serviceModal.type === 'limpeza'
              ? <><Sparkles size={15} /> Acionar Limpeza — Apt. {serviceModal.room.numero}</>
              : serviceModal.type === 'manutencao'
              ? <><Wrench size={15} /> Acionar Manutenção — Apt. {serviceModal.room.numero}</>
              : <><AlertTriangle size={15} /> Fora de Serviço — Apt. {serviceModal.room.numero}</>
          }
          footer={
            <div className={styles.footerRight}>
              <Button variant="primary" onClick={handleService} disabled={saving}>
                {saving && <Loader2 size={14} className={styles.spin} />}
                Confirmar
              </Button>
            </div>
          }
        >
          <div className={styles.formStack}>
            {serviceModal.type === 'limpeza' ? (
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)', display: 'block', marginBottom: 8 }}>Selecione o funcionário</label>
                {funcLoading ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-2)', fontSize: 13 }}>
                    <Loader2 size={13} className={styles.spin} /> Carregando...
                  </div>
                ) : funcList.length === 0 ? (
                  <div style={{ color: 'var(--text-2)', fontSize: 13 }}>Nenhum funcionário disponível</div>
                ) : (
                  <div className={styles.funcList}>
                    {funcList.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        className={`${styles.funcListItem} ${funcSelected?.id === f.id ? styles.funcListItemActive : ''}`}
                        onClick={() => { setFuncSelected(f); setSvcForm((fm) => ({ ...fm, responsavel: f.pessoa?.nome || f.nome, funcId: f.id })); }}
                      >
                        {f.pessoa?.nome || f.nome}
                        {funcSelected?.id === f.id && <Check size={14} style={{ marginLeft: 'auto' }} />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (<>
              <FormField label="Responsável">
                <Input className={styles.modalInput} value={svcForm.responsavel} onChange={(e) => setSvcForm((f) => ({ ...f, responsavel: e.target.value }))} placeholder="Nome do responsável (opcional)" />
              </FormField>
              <FormField label="Descrição">
                <textarea className={styles.modalInput} style={{ width: '100%', minHeight: 120, padding: '8px 10px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', fontSize: 13, color: 'var(--text)', fontFamily: 'inherit' }} value={svcForm.descricao} onChange={(e) => setSvcForm((f) => ({ ...f, descricao: e.target.value }))} placeholder="Descreva o serviço a ser realizado" />
              </FormField>
            </>)}
          </div>
        </Modal>
      )}

      {/* ═══════════════════════════════════════════════════════
          MODAL — Adicionar Quarto
      ═══════════════════════════════════════════════════════ */}
      {showAddQuarto && (
        <Modal
          open
          onClose={() => setShowAddQuarto(false)}
          size="sm"
          title={<><Plus size={15} /> Adicionar Quarto</>}
          footer={
            <div className={styles.footerRight}>
              <Button variant="secondary" className={styles.addRoomCancelBtn} onClick={() => setShowAddQuarto(false)}>Cancelar</Button>
              <Button variant="primary" className={styles.addRoomSaveBtn} onClick={() => { notify('Funcionalidade em desenvolvimento.', 'info'); setShowAddQuarto(false); }}>Salvar quarto</Button>
            </div>
          }
        >
          <div className={styles.addRoomModal}>
            <div className={styles.grid2}>
              <FormField label="Número *">
                <Input className={styles.addRoomField} placeholder="Ex: 23" />
              </FormField>
              <FormField label="Categoria *">
                <Select className={styles.addRoomField}>
                  <option value="">Categoria do quarto</option>
                  <option>Standard</option>
                  <option>Luxo</option>
                  <option>Suíte</option>
                </Select>
              </FormField>
            </div>

            <FormField label="Descrição">
              <Input className={styles.addRoomField} placeholder="Descrição do quarto..." />
            </FormField>

            <div className={styles.grid2}>
              <FormField label="Tipo de Ocupação *">
                <Select className={styles.addRoomField}>
                  <option value="">Tipo de ocupação</option>
                  {TIPOS_OCUPACAO.map((t) => <option key={t}>{t}</option>)}
                </Select>
              </FormField>
              <FormField label="Qtd. máx. de pessoas">
                <Input className={styles.addRoomField} type="number" min="1" max="10" placeholder="Ex: 2" />
              </FormField>
            </div>

            <div className={styles.addRoomBedsGrid}>
              <FormField label="Camas de casal">
                <Input className={styles.addRoomField} type="number" min="0" placeholder="0" />
              </FormField>
              <FormField label="Camas solteiro">
                <Input className={styles.addRoomField} type="number" min="0" placeholder="0" />
              </FormField>
              <FormField label="Beliches">
                <Input className={styles.addRoomField} type="number" min="0" placeholder="0" />
              </FormField>
              <FormField label="Redes">
                <Input className={styles.addRoomField} type="number" min="0" placeholder="0" />
              </FormField>
            </div>
          </div>
        </Modal>
      )}

      {/* ═══════════════════════════════════════════════════════
          SUB-MODAL — Adicionar Hóspede (detail)
      ═══════════════════════════════════════════════════════ */}
      {showDetailAddHospede && (
        <Modal
          open
          onClose={() => setShowDetailAddHospede(false)}
          size="sm"
          title={<><User size={15} /> Adicionar Hóspede</>}
          footer={
            <div className={styles.footerRight}>
              <Button variant="secondary" onClick={() => setShowDetailAddHospede(false)}>Cancelar</Button>
              <Button
                variant="primary"
                disabled={!detailHospedeSelected}
                onClick={() => { notify('Em desenvolvimento'); setShowDetailAddHospede(false); }}
              >
                Adicionar
              </Button>
            </div>
          }
        >
          <div className={styles.formStack}>
            <Input
              value={detailHospedeSearch}
              onChange={(e) => { setDetailHospedeSearch(e.target.value); setDetailHospedeSelected(null); }}
              placeholder="Buscar por nome..."
            />
            {detailHospResults.length > 0 && (
              <div className={styles.guestList}>
                {detailHospResults.map((h) => (
                  <button
                    key={h.id}
                    className={[styles.guestItem, detailHospedeSelected?.id === h.id ? styles.guestItemActive : ''].join(' ')}
                    onClick={() => setDetailHospedeSelected(h)}
                  >
                    <span className={styles.guestName}>{h.nome}</span>
                    <span className={styles.guestSub}>{h.cpf} · {h.telefone}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </Modal>
      )}

      <ConsumoModal
        showAddConsumoModal={showAddConsumoModal} setShowAddConsumoModal={setShowAddConsumoModal}
        showConsumoExternoModal={showConsumoExternoModal} setShowConsumoExternoModal={setShowConsumoExternoModal}
        showConsumoPag={showConsumoPag} setShowConsumoPag={setShowConsumoPag}
        selectedRoom={selectedRoom}
        consumoCart={consumoCart} setConsumoCart={setConsumoCart}
        consumoCartPag={consumoCartPag} setConsumoCartPag={setConsumoCartPag}
        consumoSaving={consumoSaving}
        consumoCats={consumoCats} consumoCatsLoading={consumoCatsLoading}
        detailConsumoCat={detailConsumoCat} setDetailConsumoCat={setDetailConsumoCat}
        detailConsumoCatSel={detailConsumoCatSel}
        externoCart={externoCart} setExternoCart={setExternoCart}
        tiposPagamentoOv={tiposPagamentoOv}
        updateInternQty={updateInternQty} updateExternoQty={updateExternoQty}
        removeFromCart={removeFromCart} removeFromExternoCart={removeFromExternoCart}
        handleConfirmConsumoAll={handleConfirmConsumoAll} handleConfirmExterno={handleConfirmExterno}
      />

      {/* ═══════════════════════════════════════════════════════
          SUB-MODAL — Alterar Pessoas nas Diárias
      ═══════════════════════════════════════════════════════ */}
      {showAlterarPessoas && selectedRoom && (() => {
        const _sv      = selectedRoom.servico;
        const _diarias = _sv?.diarias || [];
        const _selDiaria = _diarias[apDiariaIdx] ?? _diarias[0];
        const _hospedes  = _selDiaria?.hospedes || [];
        const _ini = (nome) => (nome || '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
        const hospedesIds = new Set(_hospedes.map(h => h.id));
        return (
          <Modal
            open
            onClose={() => { setShowAlterarPessoas(false); setApSearch(''); setApSearchResults([]); }}
            size="md"
            bodyStyle={{ padding: 0 }}
            title={<><Users size={15} /> Gerenciar Pessoas</>}
          >
            {/* Diária selector */}
            {_diarias.length > 1 && (
              <div className={styles.diariaSelectBar}>
                {apComboOpen && <div className={styles.diariaComboBackdrop} onClick={() => setApComboOpen(false)} />}
                <div className={styles.diariaCombo}>
                  <button type="button" className={styles.diariaComboTrigger} onClick={() => setApComboOpen((v) => !v)}>
                    <span className={styles.diariaComboLabel}>
                      {_selDiaria
                        ? `Diária ${_selDiaria.num ?? apDiariaIdx + 1}${_selDiaria.dataInicio ? ` — ${_selDiaria.dataInicio} → ${_selDiaria.dataFim}` : ''}`
                        : 'Selecione uma diária'}
                    </span>
                    <ChevronDown size={13} className={apComboOpen ? styles.diariaComboChevronOpen : styles.diariaComboChevron} />
                  </button>
                  {apComboOpen && (
                    <div className={styles.diariaComboDropdown}>
                      {_diarias.map((d, i) => (
                        <div key={i}
                          className={[styles.diariaComboOption, i === apDiariaIdx ? styles.diariaComboOptionActive : ''].join(' ')}
                          onClick={() => { setApDiariaIdx(i); setApComboOpen(false); }}>
                          <span className={styles.diariaComboOptionLabel}>
                            Diária {d.num ?? i + 1}{d.dataInicio ? ` — ${d.dataInicio} → ${d.dataFim}` : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Guests in selected diária */}
            <div className={styles.apHospedesBody}>
              {_hospedes.length === 0 ? (
                <div className={styles.emptyList}><User size={20} color="var(--text-2)" /><span>Sem hóspedes nesta diária</span></div>
              ) : (
                <div className={styles.ovGuestTable}>
                  {_hospedes.map((h, idx) => (
                    <div key={h.id || h.nome} className={styles.ovGuestRow}>
                      <div className={styles.ovGuestAvatar}>{_ini(h.nome)}</div>
                      <div className={styles.ovGuestInfo}>
                        <div className={styles.ovGuestName}>
                          {h.nome}
                          {(h.titular || idx === 0) && <span className={styles.titularTag}>Titular</span>}
                        </div>
                        {h.telefone && <div className={styles.ovGuestMeta}>{h.telefone}</div>}
                      </div>
                      <div className={styles.contactActions}>
                        {!h.titular && idx !== 0 && (
                          <button type="button" className={styles.quickBtn} title="Tornar Titular"
                            onClick={() => notify('Troca de titular indisponível pela API.', 'info')}>
                            <ArrowLeftRight size={11} />
                          </button>
                        )}
                        <button type="button" className={styles.removeBtn} disabled={saving}
                          onClick={() => _selDiaria?.id && handleRemoverPessoa(_selDiaria.id, h.id, h.nome)}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Search to add */}
            <div className={styles.apSearchWrap}>
              <Input
                value={apSearch}
                onChange={(e) => { setApSearch(e.target.value); }}
                placeholder="Buscar pessoa para adicionar..."
              />
              {apSearchLoading && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 0', color: 'var(--text-2)', fontSize: 12 }}>
                  <Loader2 size={12} className={styles.spin} /> Buscando...
                </div>
              )}
              {!apSearchLoading && apSearchResults.length > 0 && (
                <div className={styles.guestList}>
                  {apSearchResults.filter(h => !hospedesIds.has(h.id)).map((h) => (
                    <button
                      key={h.id}
                      type="button"
                      className={styles.guestItem}
                      disabled={saving || !_selDiaria?.id}
                      onClick={() => handleAdicionarPessoa(h.id)}
                    >
                      <span className={styles.guestName}>{h.nome}</span>
                      <span className={styles.guestSub}>{h.cpf}{h.telefone ? ` · ${h.telefone}` : ''}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </Modal>
        );
      })()}

      {/* ═══════════════════════════════════════════════════════
          SUB-MODAL — Adicionar Pagamento (detail)
      ═══════════════════════════════════════════════════════ */}
      <PaymentModal
        open={!!showDetailAddPag && !!selectedRoom}
        onClose={() => setShowDetailAddPag(false)}
        onConfirm={async (payment) => {
          const pag = pagamentoFromPaymentModal(payment);
          if (payOnConfirm) await payOnConfirm(pag);
          setShowDetailAddPag(false);
        }}
        tiposPagamento={tiposPagamentoOv}
        isSubmitting={saving}
        titularNome={selectedRoom?.servico?.titularNome ?? null}
        valorTotal={selectedRoom?.servico?.valorTotal ?? null}
        valorPago={selectedRoom?.servico?.totalPago ?? null}
        canAplicarDesconto={false}
      />

      {/* ═══════════════════════════════════════════════════════
          MODAL — Gerenciar Pagamentos
      ═══════════════════════════════════════════════════════ */}
      {showGerenciarPag && selectedRoom?.servico && (() => {
        const sv = selectedRoom.servico;
        const pags = (sv.pagamentos || []).filter(p => !p.cancelado);
        const total = pags.reduce((s, p) => s + (p.valor ?? 0), 0);
        return (
          <Modal
            open
            onClose={() => setShowGerenciarPag(false)}
            size="sm"
            title={<><CreditCard size={15} /> Gerenciar Pagamentos</>}
            footer={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                {pags.length > 1 && <span style={{ fontSize: 12, color: 'var(--text-2)' }}>Total: <b style={{ color: 'var(--text)' }}>{fmtBRL(total)}</b></span>}
                <div style={{ marginLeft: 'auto' }}>
                  <Button variant="primary" size="sm" onClick={() => {
                    setShowGerenciarPag(false);
                    openPayModal(async (pag) => {
                      const updated = await overviewApi.adicionarPagamento(selectedRoom.id, pag);
                      setQuartos((prev) => prev.map((q) => q.id === updated.id ? updated : q));
                      notify(`Pagamento de ${fmtBRL(pag.valor)} registrado.`);
                      setShowGerenciarPag(true);
                    }, sv.titularNome);
                  }}>
                    <Plus size={13} /> Adicionar
                  </Button>
                </div>
              </div>
            }
          >
            {pags.length === 0 ? (
              <div className={styles.emptyList}><CreditCard size={24} color="var(--text-2)" /><span>Nenhum pagamento registrado</span></div>
            ) : (
              <div className={styles.itemList}>
                {pags.map((p) => (
                  <div key={p.id} className={styles.listItem}>
                    <div className={styles.listItemLeft}>
                      <CreditCard size={14} className={styles.listItemIconGreen} />
                      <div>
                        <div className={styles.listItemName}>{p.descricao || p.nomePagador}</div>
                        {p.nomePagador && <div className={styles.listItemSub}>{p.nomePagador}</div>}
                        <div className={styles.listItemSub}>{p.formaPagamento}{p.data ? ` · ${p.data}` : ''}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className={[styles.listItemValue, styles.valueGreen].join(' ')}>{fmtBRL(p.valor)}</span>
                      <button className={styles.quickBtn} title="Editar" disabled={saving}
                        onClick={() => {
                          setShowGerenciarPag(false);
                          setEditingPag(p);
                        }}>
                        <Pencil size={12} />
                      </button>
                      <button className={styles.removeBtn} title="Cancelar pagamento" disabled={saving}
                        onClick={async () => {
                          if (!window.confirm('Cancelar este pagamento?')) return;
                          await handleCancelarPagamento(p.id);
                        }}>
                        {saving ? <Loader2 size={12} className={styles.spin} /> : <Trash2 size={12} />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Modal>
        );
      })()}

      {/* PaymentModal para edição de pagamento */}
      <PaymentModal
        open={!!editingPag && !!selectedRoom}
        onClose={() => { setEditingPag(null); setShowGerenciarPag(true); }}
        onConfirm={(payment) => handleEditarPagamento(editingPag?.id, payment)}
        tiposPagamento={tiposPagamentoOv}
        isSubmitting={saving}
        initialPayment={editingPag ? {
          tipo_pagamento: { id: tiposPagamentoOv.find(t => t.descricao === editingPag.formaPagamento)?.id ?? '' },
          nome_pagador: editingPag.nomePagador,
          descricao: editingPag.descricaoOrig,
          valor: editingPag.valor,
          uuid: editingPag.id,
        } : null}
        titularNome={selectedRoom?.servico?.titularNome ?? null}
        valorTotal={selectedRoom?.servico?.valorTotal ?? null}
        valorPago={selectedRoom?.servico?.totalPago ?? null}
        canAplicarDesconto={false}
      />

      {/* ═══════════════════════════════════════════════════════
          MODAL — Gerenciar Consumos
      ═══════════════════════════════════════════════════════ */}
      {showGerenciarConsumo && selectedRoom?.servico && (() => {
        const sv = selectedRoom.servico;
        const consumos = sv.consumos || [];
        const total = consumos.reduce((s, c) => s + (c.valorTotal ?? 0), 0);
        return (
          <Modal
            open
            onClose={() => setShowGerenciarConsumo(false)}
            size="sm"
            title={<><ShoppingCart size={15} /> Gerenciar Consumos</>}
            footer={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                {consumos.length > 1 && <span style={{ fontSize: 12, color: 'var(--text-2)' }}>Total: <b style={{ color: 'var(--text)' }}>{fmtBRL(total)}</b></span>}
                <div style={{ marginLeft: 'auto' }}>
                  <Button variant="primary" size="sm" onClick={() => {
                    setShowGerenciarConsumo(false);
                    setDetailConsumoCat('');
                    setExternoCart([]);
                    setConsumoCart([]);
                    setConsumoCartPag(null);
                    setShowAddConsumoModal(true);
                    setConsumoCats([]);
                    setConsumoCatsLoading(true);
                    itemApi.estoque().then((r) => setConsumoCats(r?.categorias ?? [])).catch(() => {}).finally(() => setConsumoCatsLoading(false));
                  }}>
                    <Plus size={13} /> Adicionar
                  </Button>
                </div>
              </div>
            }
          >
            {consumos.length === 0 ? (
              <div className={styles.emptyList}><ShoppingCart size={24} color="var(--text-2)" /><span>Nenhum consumo registrado</span></div>
            ) : (
              <div className={styles.itemList}>
                {consumos.map((c, i) => (
                  <div key={c.id || i} className={styles.listItem}>
                    <div className={styles.listItemLeft}>
                      <ShoppingCart size={14} className={styles.listItemIcon} />
                      <div>
                        <div className={styles.listItemName}>{c.item}</div>
                        <div className={styles.listItemSub}>
                          {c.categoria}{c.quantidade ? ` · ×${c.quantidade}` : ''}
                          {c.valorUnitario > 0 ? ` · ${fmtBRL(c.valorUnitario)}/un.` : ''}
                          {c.despesaPessoal ? ' · Despesa pessoal' : ''}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className={styles.listItemValue}>{fmtBRL(c.valorTotal)}</span>
                      <button className={styles.removeBtn} title="Remover consumo" disabled={saving}
                        onClick={async () => {
                          if (!window.confirm(`Remover "${c.item}"?`)) return;
                          await handleRemoverConsumo(c.id);
                        }}>
                        {saving ? <Loader2 size={12} className={styles.spin} /> : <Trash2 size={12} />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Modal>
        );
      })()}

      {/* ═══════════════════════════════════════════════════════
          MODAL — Gerenciar Diárias
      ═══════════════════════════════════════════════════════ */}
      {showGerenciarDiarias && selectedRoom?.servico?.tipo === 'pernoite' && (() => {
        const sv = selectedRoom.servico;
        const diarias = sv.diarias || [];
        const atualNum = sv.diariaAtual || 1;
        const novoTotal = diarias.reduce((s, d) => s + (d.valor || 0), 0) + (parseBRL(gdValor) || 0);
        const ultimaDiaria = gdDiariaPendentes.length > 0
          ? gdDiariaPendentes[gdDiariaPendentes.length - 1]
          : (diarias.length > 0 ? diarias[diarias.length - 1] : null);
        const minDataDiaria = ultimaDiaria?.dataFim ? (() => {
          const datePart = ultimaDiaria.dataFim.split(' ')[0]; // "dd/MM/yyyy" only
          const [dd, mm, yyyy] = datePart.split('/');
          return new Date(+yyyy, +mm - 1, +dd);
        })() : null;
        return (
          <Modal
            open
            onClose={() => setShowGerenciarDiarias(false)}
            size="md"
            title={<><RefreshCw size={15} /> Gerenciar Diárias — Apt. {selectedRoom.numero}</>}
            footer={
              <div className={styles.footerRight} />
            }
          >
            <div className={styles.formStack}>
              <Button variant="primary" onClick={() => {
                if (!minDataDiaria) { notify('Nenhuma diária registrada.', 'error'); return; }
                const fim = new Date(minDataDiaria);
                fim.setDate(fim.getDate() + 1);
                handleAdicionarDiaria(minDataDiaria, fim);
              }} disabled={savingGd || !minDataDiaria} style={{ width: '100%', marginBottom: 16 }}>
                {savingGd && <Loader2 size={14} className={styles.spin} />}
                <Plus size={14} /> Adicionar Diária
              </Button>
              {diarias.length === 0 && gdDiariaPendentes.length === 0
                ? <div className={styles.emptyList}><Calendar size={20} color="var(--text-2)" /><span>Nenhuma diária registrada</span></div>
                : (
                  <div className={styles.gdDiariaList} ref={gdDiariaListRef}>
                    {diarias.map((d) => {
                      const isCurrent = d.num === atualNum;
                      const isPast = d.num < atualNum;
                      const canRemove = d.num >= atualNum;
                      return (
                        <div key={d.idx} className={[styles.gdDiariaItem, isCurrent ? styles.gdDiariaItemCurrent : '', isPast ? styles.gdDiariaItemPast : ''].join(' ')}>
                          <div className={styles.gdDiariaItemBody}>
                            <div className={styles.gdDiariaTopRow}>
                              <div className={styles.gdDiariaLeftGroup}>
                                <span className={styles.gdDiariaNum}>Diária {d.num}</span>
                                {isCurrent && <span className={styles.gdCurrentTag}>Atual</span>}
                              </div>
                              <span className={styles.gdDiariaVal}>{fmtBRL(d.valor)}</span>
                            </div>
                            <span className={styles.gdDiariaDate}>{d.dataInicio} → {d.dataFim}</span>
                          </div>
                          {canRemove && !isCurrent && (
                            <button className={styles.removeBtn} onClick={() => setGdRemoverConfirm({ diariaIdx: d.idx, diariaNum: d.num })} disabled={savingGd} title="Remover diária">
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      );
                    })}
                    {gdDiariaPendentes.map((d, idx) => (
                      <div key={`pending-${idx}`} className={styles.gdDiariaItem} style={{ opacity: 0.7, borderColor: 'var(--violet)' }}>
                        <div className={styles.gdDiariaItemBody}>
                          <div className={styles.gdDiariaTopRow}>
                            <div className={styles.gdDiariaLeftGroup}>
                              <span className={styles.gdDiariaNum} style={{ color: 'var(--violet)' }}>Diária {diarias.length + idx + 1}</span>
                              <span className={styles.gdCurrentTag} style={{ background: 'rgba(124, 58, 237, 0.15)', color: 'var(--violet)' }}>Pendente</span>
                            </div>
                            <span className={styles.gdDiariaVal}>{fmtBRL(d.valor)}</span>
                          </div>
                          <span className={styles.gdDiariaDate}>{d.dataInicio} → {d.dataFim}</span>
                        </div>
                        <button className={styles.removeBtn} onClick={() => setGdDiariaPendentes((prev) => prev.filter((_, i) => i !== idx))} title="Remover da lista">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )
              }
              {gdDiariaPendentes.length > 0 && (
                <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                  <Button variant="secondary" onClick={() => setGdDiariaPendentes([])} style={{ flex: 1 }}>Cancelar</Button>
                  <Button variant="primary" onClick={handleConfirmarDiarias} disabled={savingGd} style={{ flex: 1 }}>
                    {savingGd && <Loader2 size={14} className={styles.spin} />}
                    Confirmar {gdDiariaPendentes.length} diária(s)
                  </Button>
                </div>
              )}
            </div>
          </Modal>
        );
      })()}

      {/* ═══════════════════════════════════════════════════════
          MODAL — Confirmação Remover Diária
      ═══════════════════════════════════════════════════════ */}
      {gdRemoverConfirm && (
        <Modal
          open
          onClose={() => setGdRemoverConfirm(null)}
          size="sm"
          title={<><AlertTriangle size={15} /> Remover Diária</>}
          footer={
            <div className={styles.footerRight}>
              <Button variant="secondary" onClick={() => setGdRemoverConfirm(null)} disabled={savingGd}>Cancelar</Button>
              <Button variant="danger" onClick={async () => { await handleRemoverDiaria(gdRemoverConfirm.diariaIdx); setGdRemoverConfirm(null); }} disabled={savingGd}>
                {savingGd && <Loader2 size={14} className={styles.spin} />}
                Remover
              </Button>
            </div>
          }
        >
          <p style={{ margin: 0, color: 'var(--text-2)', fontSize: 14 }}>
            Tem certeza que deseja remover a <strong>Diária {gdRemoverConfirm.diariaNum}</strong>?
          </p>
        </Modal>
      )}

      <TrocaQuartoModal
        open={showTrocarQuarto && selectedRoom?.servico?.tipo === 'pernoite'}
        onClose={() => setShowTrocarQuarto(false)}
        selectedRoom={selectedRoom}
        quartos={quartos}
        apiCategories={apiCategories}
        tqDiariasIdxs={tqDiariasIdxs} setTqDiariasIdxs={setTqDiariasIdxs}
        tqNovoQuartoId={tqNovoQuartoId} setTqNovoQuartoId={setTqNovoQuartoId}
        savingTq={savingTq} handleTrocarQuarto={handleTrocarQuarto}
      />

      <DescontoModal
        open={showDescontoModal}
        onClose={() => setShowDescontoModal(false)}
        selectedRoom={selectedRoom}
        descontoScope={descontoScope} setDescontoScope={setDescontoScope}
        descontoTipo={descontoTipo} setDescontoTipo={setDescontoTipo}
        descontoValor={descontoValor} setDescontoValor={setDescontoValor}
        descontoDescricao={descontoDescricao} setDescontoDescricao={setDescontoDescricao}
        descontoSaving={descontoSaving} handleAplicarDesconto={handleAplicarDesconto}
      />

      <AtribuirLimpezaModal
        atribuirLimpezaModal={atribuirLimpezaModal} setAtribuirLimpezaModal={setAtribuirLimpezaModal}
        checkoutAntecipado={checkoutAntecipado} setCheckoutAntecipado={setCheckoutAntecipado}
        pendingPayWarning={pendingPayWarning} setPendingPayWarning={setPendingPayWarning}
        confirmModal={confirmModal} setConfirmModal={setConfirmModal}
        selectedRoom={selectedRoom}
        limpezaFuncs={limpezaFuncs} limpezaFuncsLoading={limpezaFuncsLoading}
        limpezaFuncId={limpezaFuncId} setLimpezaFuncId={setLimpezaFuncId}
        saving={saving}
        handleDoFinalizar={handleDoFinalizar}
        _prosseguirFinalizar={_prosseguirFinalizar}
        openAtribuirLimpeza={openAtribuirLimpeza}
        handleCancelar={handleCancelar}
      />
    </div>
  );
}
