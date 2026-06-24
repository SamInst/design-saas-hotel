import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import styles from './DatePicker.module.css';

const MONTHS       = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const MONTHS_SHORT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const DAYS         = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

const sod     = (d) => { const x = new Date(d); x.setHours(0,0,0,0); return x; };
const sameDay = (a,b) => a && b && a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();
const between = (d,s,e) => d && s && e && d > s && d < e;
const dkey    = (d) => { const x = sod(d); return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`; };

const parseTyped = str => {
  const m = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (!m) return null;
  const d = new Date(+m[3], +m[2]-1, +m[1]);
  if (isNaN(d)) return null;
  if (d.getMonth() !== +m[2]-1) return null;
  return sod(d);
};

const autoFmtDate = (raw) => {
  const digits = raw.replace(/\D/g,'').slice(0,8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return digits.slice(0,2) + '/' + digits.slice(2);
  return digits.slice(0,2) + '/' + digits.slice(2,4) + '/' + digits.slice(4);
};

const getYearRange = (center) => {
  const start = center - 5;
  return Array.from({ length: 12 }, (_, i) => start + i);
};

const POP_HEIGHT = 330; // approximate max height of the popup

export function DatePicker({
  mode = 'single',
  value = null,
  startDate = null,
  endDate = null,
  onChange,
  onRangeChange,
  onMonthChange,          // (year, month0) — fired when the visible month changes (month is 0-based)
  minDate = null,
  maxDate = null,
  markedDate = null,
  disabledDates = null,   // Set<'yyyy-MM-dd'> — occupied nights (range mode aware)
  occupancy = null,       // Map<'yyyy-MM-dd', {am,pm}> — midday half-day occupancy (range mode)
  inline = false,         // render the calendar statically (embedded), no trigger/portal
  readOnly = false,       // somente visualização: dias não selecionáveis (mantém navegação de mês)
  lockMonth = false,      // trava o mês exibido: esconde as setas e desativa o seletor de mês/ano
  placeholder = 'Selecione a data',
  label,
  error = false,
  className = '',
  triggerClassName = '',
}) {
  const today = sod(new Date());
  const [open,         setOpen]         = useState(inline);
  const [viewYear,     setViewYear]     = useState((value||startDate||today).getFullYear());
  const [viewMonth,    setViewMonth]    = useState((value||startDate||today).getMonth());
  const [hoverDate,    setHoverDate]    = useState(null);
  const [viewMode,     setViewMode]     = useState('days');
  const [inputText,    setInputText]    = useState('');
  const [inputFocused, setInputFocused] = useState(false);
  const [popStyle,     setPopStyle]     = useState({});
  const ref    = useRef(null);
  const popRef = useRef(null);

  // Calculate popup position relative to viewport (for portal/fixed positioning)
  const updatePopPos = useCallback(() => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const openAbove  = spaceBelow < POP_HEIGHT && rect.top > POP_HEIGHT;
    setPopStyle({
      position: 'fixed',
      zIndex: 9999,
      width: Math.max(rect.width, 278),
      left: Math.min(rect.left, window.innerWidth - Math.max(rect.width, 278) - 8),
      top: openAbove ? rect.top - POP_HEIGHT - 6 : rect.bottom + 6,
    });
  }, []);

  // Close on outside click (covers both wrap and portal popup) — skipped when inline
  useEffect(() => {
    if (inline) return;
    const h = (e) => {
      const inWrap = ref.current    && ref.current.contains(e.target);
      const inPop  = popRef.current && popRef.current.contains(e.target);
      if (!inWrap && !inPop) { setOpen(false); setViewMode('days'); }
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [inline]);

  // Reposition on scroll/resize while open
  useEffect(() => {
    if (inline || !open) return;
    updatePopPos();
    window.addEventListener('scroll', updatePopPos, true);
    window.addEventListener('resize', updatePopPos);
    return () => {
      window.removeEventListener('scroll', updatePopPos, true);
      window.removeEventListener('resize', updatePopPos);
    };
  }, [inline, open, updatePopPos]);

  // Keep displayed text in sync when not editing
  useEffect(() => {
    if (!inputFocused && mode === 'single') {
      setInputText(value ? fmtD(value) : '');
    }
  }, [value, inputFocused, mode]); // eslint-disable-line

  // Notify parent of the currently-visible month so it can load occupancy on demand.
  useEffect(() => {
    onMonthChange?.(viewYear, viewMonth);
  }, [viewYear, viewMonth]); // eslint-disable-line

  const prevNav = () => {
    if (viewMode === 'years')  setViewYear(y => y - 12);
    else if (viewMode === 'months') setViewYear(y => y - 1);
    else viewMonth === 0
      ? (setViewMonth(11), setViewYear(y => y - 1))
      : setViewMonth(m => m - 1);
  };
  const nextNav = () => {
    if (viewMode === 'years')  setViewYear(y => y + 12);
    else if (viewMode === 'months') setViewYear(y => y + 1);
    else viewMonth === 11
      ? (setViewMonth(0), setViewYear(y => y + 1))
      : setViewMonth(m => m + 1);
  };

  // ── Occupancy-aware helpers ────────────────────────────────────────────────
  const blocked     = (d) => !!disabledDates && disabledDates.has(dkey(d));
  const outOfBounds = (d) => (minDate && d < sod(minDate)) || (maxDate && d > sod(maxDate));
  const isDisabled  = (d) => outOfBounds(d) || blocked(d);

  // First occupied night strictly after `from` (the latest valid checkout lands ON it).
  const firstBlockedAfter = (from) => {
    if (!disabledDates || !from) return null;
    const cur = sod(from);
    for (let i = 0; i < 400; i++) {
      cur.setDate(cur.getDate() + 1);
      if (blocked(cur)) return sod(cur);
    }
    return null;
  };

  // ── Midday occupancy (half-day) helpers — active only when `occupancy` is given ──
  // A stay runs from midday(check-in) to midday(check-out): the check-in day is busy in the
  // afternoon (pm), the check-out day busy in the morning (am), middle days busy all day.
  const useHalf  = !!occupancy;
  const occAt    = (d) => useHalf ? occupancy.get(dkey(d)) : null;
  const amBusy   = (d) => { const o = occAt(d); return !!(o && o.am); };
  const pmBusy   = (d) => { const o = occAt(d); return !!(o && o.pm); };
  // A new check-in needs the afternoon free; a new check-out needs the morning free.
  const canStartHalf = (d) => !pmBusy(d);
  const canEndHalf   = (d) => !amBusy(d);
  // First day after `from` that the new stay cannot fully occupy (any busy half).
  const firstObstacleAfter = (from) => {
    if (!useHalf || !from) return null;
    const cur = sod(from);
    for (let i = 0; i < 400; i++) {
      cur.setDate(cur.getDate() + 1);
      if (amBusy(cur) || pmBusy(cur)) return sod(cur);
    }
    return null;
  };
  // Latest selectable checkout for a given check-in (inclusive).
  const maxEndForStart = (start) => {
    const f = firstObstacleAfter(start);
    if (!f) return null;                   // no limit
    if (pmBusy(f) && !amBusy(f)) return f;  // obstacle is another check-in → check out that morning
    const prev = sod(f); prev.setDate(prev.getDate() - 1);
    return prev;
  };

  const handleDayClick = (d) => {
    if (mode === 'single') {
      if (isDisabled(d)) return;
      onChange?.(d);
      if (!inline) { setOpen(false); setViewMode('days'); }
      return;
    }

    // ── range ──
    if (outOfBounds(d)) return;

    // ── midday (half-day) selection ──
    if (useHalf) {
      // starting a fresh selection
      if (!startDate || (startDate && endDate)) {
        if (!canStartHalf(d)) return;        // afternoon already taken
        onRangeChange?.({ start: d, end: null });
        return;
      }
      // clicked the same day → restart
      if (sod(d).getTime() === sod(startDate).getTime()) {
        onRangeChange?.({ start: d, end: null });
        return;
      }
      // clicked earlier → becomes the new check-in
      if (d < startDate) {
        if (!canStartHalf(d)) return;
        const me = maxEndForStart(d);
        if ((me && startDate > me) || !canEndHalf(startDate)) { onRangeChange?.({ start: d, end: null }); return; }
        onRangeChange?.({ start: d, end: startDate });
        if (!inline) { setOpen(false); setViewMode('days'); }
        return;
      }
      // clicked later → it's the checkout
      const me = maxEndForStart(startDate);
      if ((me && d > me) || !canEndHalf(d)) return;
      onRangeChange?.({ start: startDate, end: d });
      if (!inline) { setOpen(false); setViewMode('days'); }
      return;
    }

    // ── legacy full-night selection (disabledDates Set) ──
    // starting a fresh selection
    if (!startDate || (startDate && endDate)) {
      if (blocked(d)) return;               // a check-in can't be an occupied night
      onRangeChange?.({ start: d, end: null });
      return;
    }

    // clicked the same day → restart
    if (sod(d).getTime() === sod(startDate).getTime()) {
      onRangeChange?.({ start: d, end: null });
      return;
    }

    // clicked earlier → becomes the new check-in (must be free + no occupied night up to old start)
    if (d < startDate) {
      if (blocked(d)) return;
      const fb = firstBlockedAfter(d);
      if (fb && fb < startDate) { onRangeChange?.({ start: d, end: null }); return; }
      onRangeChange?.({ start: d, end: startDate });
      if (!inline) { setOpen(false); setViewMode('days'); }
      return;
    }

    // clicked later → it's the checkout. Valid only if no occupied night between [start, d).
    const fb = firstBlockedAfter(startDate);
    if (fb && d > fb) return;               // crosses an occupied night
    onRangeChange?.({ start: startDate, end: d });
    if (!inline) { setOpen(false); setViewMode('days'); }
  };

  const selectMonth = (m) => { setViewMonth(m); setViewMode('days'); };
  const selectYear  = (y) => { setViewYear(y);  setViewMode('months'); };

  const handleInputChange = (e) => {
    const formatted = autoFmtDate(e.target.value);
    setInputText(formatted);
    if (formatted.length === 10) {
      const parsed = parseTyped(formatted);
      if (parsed && !isDisabled(parsed) && mode === 'single') {
        onChange?.(parsed);
        setViewYear(parsed.getFullYear());
        setViewMonth(parsed.getMonth());
        setOpen(false);
        setViewMode('days');
      }
    } else if (formatted === '') {
      onChange?.(null);
    }
  };

  const handleInputFocus = () => {
    setInputFocused(true);
    if (mode === 'single' && value) setInputText(fmtD(value));
    else setInputText('');
    setOpen(true);
    setViewMode('days');
  };

  const handleInputBlur = () => {
    setInputFocused(false);
    if (mode === 'single' && value) setInputText(fmtD(value));
    else if (!parseTyped(inputText)) setInputText('');
  };

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInM  = new Date(viewYear, viewMonth+1, 0).getDate();
  const cells    = [...Array(firstDay).fill(null), ...Array.from({length:daysInM},(_,i)=>new Date(viewYear,viewMonth,i+1))];

  const fmtD   = (d) => d ? d.toLocaleDateString('pt-BR') : '';
  const display = mode === 'single' ? fmtD(value)
    : startDate && endDate  ? `${fmtD(startDate)} – ${fmtD(endDate)}`
    : startDate             ? `${fmtD(startDate)} – ...` : '';

  // Hover preview clamps at the latest valid checkout so the range never spans an occupied night.
  const fbFromStart = mode === 'range' && startDate && !endDate
    ? (useHalf ? maxEndForStart(startDate) : firstBlockedAfter(startDate))
    : null;
  const clampedHover = hoverDate && fbFromStart && hoverDate > fbFromStart ? fbFromStart : hoverDate;
  const rangeEnd = clampedHover && startDate && !endDate ? clampedHover : endDate;

  const headLabel = viewMode === 'years'
    ? `${getYearRange(viewYear)[0]} – ${getYearRange(viewYear)[11]}`
    : viewMode === 'months' ? String(viewYear)
    : `${MONTHS[viewMonth]} ${viewYear}`;

  const triggerCls = [
    styles.trigger,
    triggerClassName,
    open   ? styles.open        : '',
    error  ? styles.triggerError : '',
  ].join(' ');

  const calendarInner = (
    <>
      <div className={styles.head}>
        {!lockMonth && <button type="button" className={styles.nav} onClick={prevNav}><ChevronLeft size={14}/></button>}
        <button
          type="button"
          className={styles.headBtn}
          disabled={lockMonth}
          style={lockMonth ? { cursor: 'default' } : undefined}
          onClick={lockMonth ? undefined : () => setViewMode(vm => vm === 'days' ? 'months' : 'years')}
        >
          {headLabel}
        </button>
        {!lockMonth && <button type="button" className={styles.nav} onClick={nextNav}><ChevronRight size={14}/></button>}
      </div>

      {viewMode === 'days' && (
        <>
          <div className={styles.wdays}>{DAYS.map(d=><span key={d} className={styles.wday}>{d}</span>)}</div>
          <div className={styles.grid} onMouseLeave={() => setHoverDate(null)}>
            {cells.map((d, i) => {
              if (!d) return <span key={`e${i}`}/>;
              const oob  = outOfBounds(d);
              // Occupancy: full day, or only one half — am = morning/left, pm = afternoon/right.
              const amB    = useHalf && amBusy(d);
              const pmB    = useHalf && pmBusy(d);
              const fullB  = amB && pmB;
              const blk    = useHalf ? fullB : blocked(d);   // "fully occupied" look
              const halfAM = useHalf && amB && !fullB;       // check-out morning  → left half
              const halfPM = useHalf && pmB && !fullB;       // check-in afternoon → right half
              const tod  = sameDay(d, today);
              const sel  = mode==='single' ? sameDay(d,value) : sameDay(d,startDate)||sameDay(d,endDate);
              const iS   = mode==='range' && sameDay(d,startDate);
              const iE   = mode==='range' && sameDay(d,rangeEnd);
              const inR  = mode==='range' && startDate && rangeEnd && between(sod(d),sod(startDate),sod(rangeEnd));
              const hovE = mode==='range' && !endDate && sameDay(d,clampedHover);
              const mkd  = markedDate && !sel && sameDay(d, markedDate);
              // checkout may land ON the next occupied night (adjacency); otherwise blocked is dead.
              const endCandidate = mode==='range' && startDate && !endDate && fbFromStart && sameDay(d, fbFromStart);
              let cellDisabled;
              if (mode === 'single') {
                cellDisabled = oob || blk;
              } else if (useHalf) {
                if (!startDate || endDate) {
                  cellDisabled = oob || !canStartHalf(d);                    // picking check-in
                } else {
                  const validEnd   = d > startDate && (!fbFromStart || d <= fbFromStart) && canEndHalf(d);
                  const validStart = d <= startDate && canStartHalf(d);       // restart / earlier check-in
                  cellDisabled = oob || !(validEnd || validStart);
                }
              } else {
                cellDisabled = (!startDate || endDate) ? oob || blk : oob || (blk && !endCandidate);
              }
              return (
                <button key={d.toISOString()} type="button" disabled={cellDisabled || readOnly} tabIndex={readOnly ? -1 : undefined}
                  className={[styles.day, tod?styles.tod:'', sel?styles.sel:'', iS?styles.rS:'', iE?styles.rE:'', inR?styles.inR:'', hovE?styles.hovE:'', oob?styles.dis:'', blk?styles.blk:'', halfAM?styles.hAM:'', halfPM?styles.hPM:'', mkd?styles.mkd:''].join(' ')}
                  onClick={readOnly ? undefined : () => handleDayClick(sod(d))}
                  onMouseEnter={() => { if (!readOnly && mode==='range' && startDate && !endDate) setHoverDate(sod(d)); }}>
                  {d.getDate()}
                </button>
              );
            })}
          </div>
          {mode==='range' && startDate && !endDate && <p className={styles.hint}>Selecione a data final</p>}
        </>
      )}

      {viewMode === 'months' && (
        <div className={styles.smGrid}>
          {MONTHS_SHORT.map((m, i) => (
            <button key={m} type="button"
              className={[styles.smCell, (value && value.getFullYear()===viewYear && value.getMonth()===i) ? styles.smActive : ''].join(' ')}
              onClick={() => selectMonth(i)}>
              {m}
            </button>
          ))}
        </div>
      )}

      {viewMode === 'years' && (
        <div className={styles.smGrid}>
          {getYearRange(viewYear).map(y => (
            <button key={y} type="button"
              className={[styles.smCell, (value && value.getFullYear()===y) ? styles.smActive : ''].join(' ')}
              onClick={() => selectYear(y)}>
              {y}
            </button>
          ))}
        </div>
      )}
    </>
  );

  // ── Inline (embedded, real-time) variant ──
  if (inline) {
    return (
      <div className={[styles.inline, readOnly ? styles.readOnly : '', className].join(' ')} ref={ref}>
        {label && <label className={styles.label}>{label}</label>}
        {calendarInner}
      </div>
    );
  }

  const popup = open && (
    <div ref={popRef} className={styles.pop} style={popStyle}>
      {calendarInner}
    </div>
  );

  return (
    <div className={[styles.wrap, className].join(' ')} ref={ref}>
      {label && <label className={styles.label}>{label}</label>}

      <div
        className={triggerCls}
        onClick={() => { if (!open) { setOpen(true); setViewMode('days'); } }}
      >
        <svg className={styles.ico} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="4" width="18" height="18" rx="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8"  y1="2" x2="8"  y2="6"/>
          <line x1="3"  y1="10" x2="21" y2="10"/>
        </svg>

        {mode === 'single' ? (
          <input
            type="text"
            className={styles.textInput}
            value={inputFocused ? inputText : (display || '')}
            onChange={handleInputChange}
            onFocus={handleInputFocus}
            onBlur={handleInputBlur}
            placeholder={placeholder}
          />
        ) : (
          <span className={display ? styles.val : styles.ph}>{display || placeholder}</span>
        )}

        {(mode === 'single' ? value : startDate) && (
          <button type="button" className={styles.clear}
            onClick={e => {
              e.stopPropagation();
              if (mode === 'single') { onChange?.(null); setInputText(''); }
              else onRangeChange?.({ start: null, end: null });
            }}>
            ×
          </button>
        )}
      </div>

      {createPortal(popup, document.body)}
    </div>
  );
}
