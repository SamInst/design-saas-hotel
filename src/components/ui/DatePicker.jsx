import { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import styles from './DatePicker.module.css';

const MONTHS       = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const MONTHS_SHORT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const DAYS         = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

const sod     = (d) => { const x = new Date(d); x.setHours(0,0,0,0); return x; };
const sameDay = (a,b) => a && b && a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();
const between = (d,s,e) => d && s && e && d > s && d < e;

const parseTyped = str => {
  const m = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (!m) return null;
  const d = new Date(+m[3], +m[2]-1, +m[1]);
  if (isNaN(d)) return null;
  if (d.getMonth() !== +m[2]-1) return null;
  return sod(d);
};

const autoFmtDate = (raw) => {
  // Strip everything except digits, then rebuild dd/mm/yyyy
  const digits = raw.replace(/\D/g,'').slice(0,8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return digits.slice(0,2) + '/' + digits.slice(2);
  return digits.slice(0,2) + '/' + digits.slice(2,4) + '/' + digits.slice(4);
};

const getYearRange = (center) => {
  const start = center - 5;
  return Array.from({ length: 12 }, (_, i) => start + i);
};

export function DatePicker({
  mode = 'single',
  value = null,
  startDate = null,
  endDate = null,
  onChange,
  onRangeChange,
  minDate = null,
  maxDate = null,
  placeholder = 'Selecione a data',
  label,
  error = false,
}) {
  const today = sod(new Date());
  const [open,         setOpen]         = useState(false);
  const [viewYear,     setViewYear]     = useState((value||startDate||today).getFullYear());
  const [viewMonth,    setViewMonth]    = useState((value||startDate||today).getMonth());
  const [hoverDate,    setHoverDate]    = useState(null);
  const [viewMode,     setViewMode]     = useState('days');
  const [inputText,    setInputText]    = useState('');
  const [inputFocused, setInputFocused] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const h = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false); setViewMode('days');
      }
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  // Keep displayed text in sync when not editing
  useEffect(() => {
    if (!inputFocused && mode === 'single') {
      setInputText(value ? fmtD(value) : '');
    }
  }, [value, inputFocused, mode]); // eslint-disable-line

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

  const isDisabled = (d) => (minDate && d < sod(minDate)) || (maxDate && d > sod(maxDate));

  const handleDayClick = (d) => {
    if (isDisabled(d)) return;
    if (mode === 'single') {
      onChange?.(d); setOpen(false); setViewMode('days'); return;
    }
    if (!startDate || (startDate && endDate)) {
      onRangeChange?.({ start: d, end: null });
    } else {
      onRangeChange?.(d < startDate ? { start: d, end: startDate } : { start: startDate, end: d });
      setOpen(false); setViewMode('days');
    }
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
      }
    } else if (formatted === '') {
      onChange?.(null);
    }
  };

  const handleInputFocus = () => {
    setInputFocused(true);
    // Show the raw text value so user can edit
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

  const rangeEnd = hoverDate && startDate && !endDate ? hoverDate : endDate;

  const headLabel = viewMode === 'years'
    ? `${getYearRange(viewYear)[0]} – ${getYearRange(viewYear)[11]}`
    : viewMode === 'months' ? String(viewYear)
    : `${MONTHS[viewMonth]} ${viewYear}`;

  const triggerCls = [
    styles.trigger,
    open   ? styles.open        : '',
    error  ? styles.triggerError : '',
  ].join(' ');

  return (
    <div className={styles.wrap} ref={ref}>
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

      {open && (
        <div className={styles.pop}>
          <div className={styles.head}>
            <button type="button" className={styles.nav} onClick={prevNav}><ChevronLeft size={14}/></button>
            <button
              type="button"
              className={styles.headBtn}
              onClick={() => setViewMode(vm => vm === 'days' ? 'months' : 'years')}
            >
              {headLabel}
            </button>
            <button type="button" className={styles.nav} onClick={nextNav}><ChevronRight size={14}/></button>
          </div>

          {viewMode === 'days' && (
            <>
              <div className={styles.wdays}>{DAYS.map(d=><span key={d} className={styles.wday}>{d}</span>)}</div>
              <div className={styles.grid} onMouseLeave={() => setHoverDate(null)}>
                {cells.map((d, i) => {
                  if (!d) return <span key={`e${i}`}/>;
                  const dis  = isDisabled(d);
                  const tod  = sameDay(d, today);
                  const sel  = mode==='single' ? sameDay(d,value) : sameDay(d,startDate)||sameDay(d,endDate);
                  const iS   = mode==='range' && sameDay(d,startDate);
                  const iE   = mode==='range' && sameDay(d,rangeEnd);
                  const inR  = mode==='range' && startDate && rangeEnd && between(sod(d),sod(startDate),sod(rangeEnd));
                  const hovE = mode==='range' && !endDate && sameDay(d,hoverDate);
                  return (
                    <button key={d.toISOString()} type="button" disabled={dis}
                      className={[styles.day, tod?styles.tod:'', sel?styles.sel:'', iS?styles.rS:'', iE?styles.rE:'', inR?styles.inR:'', hovE?styles.hovE:'', dis?styles.dis:''].join(' ')}
                      onClick={() => handleDayClick(sod(d))}
                      onMouseEnter={() => { if (mode==='range' && startDate && !endDate) setHoverDate(sod(d)); }}>
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
        </div>
      )}
    </div>
  );
}
