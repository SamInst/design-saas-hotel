import { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import styles from './DatePicker.module.css';

const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const DAYS   = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

const sod = (d) => { const x = new Date(d); x.setHours(0,0,0,0); return x; };
const sameDay = (a,b) => a && b && a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();
const between = (d,s,e) => d && s && e && d > s && d < e;

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
}) {
  const today = sod(new Date());
  const [open,      setOpen]      = useState(false);
  const [viewYear,  setViewYear]  = useState((value||startDate||today).getFullYear());
  const [viewMonth, setViewMonth] = useState((value||startDate||today).getMonth());
  const [hoverDate, setHoverDate] = useState(null);
  const ref = useRef(null);

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const prevM = () => viewMonth===0 ? (setViewMonth(11), setViewYear(y=>y-1)) : setViewMonth(m=>m-1);
  const nextM = () => viewMonth===11? (setViewMonth(0),  setViewYear(y=>y+1)) : setViewMonth(m=>m+1);

  const isDisabled = (d) => (minDate && d<sod(minDate)) || (maxDate && d>sod(maxDate));

  const handleClick = (d) => {
    if (isDisabled(d)) return;
    if (mode==='single') { onChange?.(d); setOpen(false); return; }
    if (!startDate || (startDate && endDate)) {
      onRangeChange?.({ start: d, end: null });
    } else {
      onRangeChange?.(d<startDate ? {start:d, end:startDate} : {start:startDate, end:d});
      setOpen(false);
    }
  };

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInM  = new Date(viewYear, viewMonth+1, 0).getDate();
  const cells = [...Array(firstDay).fill(null), ...Array.from({length:daysInM},(_,i)=>new Date(viewYear,viewMonth,i+1))];

  const fmtD = (d) => d ? d.toLocaleDateString('pt-BR') : '';
  const display = mode==='single' ? fmtD(value)
    : startDate && endDate ? `${fmtD(startDate)} – ${fmtD(endDate)}`
    : startDate ? `${fmtD(startDate)} – ...` : '';

  const rangeEnd = hoverDate && startDate && !endDate ? hoverDate : endDate;

  return (
    <div className={styles.wrap} ref={ref}>
      {label && <label className={styles.label}>{label}</label>}
      <button type="button" className={[styles.trigger, open?styles.open:''].join(' ')} onClick={()=>setOpen(o=>!o)}>
        <svg className={styles.ico} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        <span className={display ? styles.val : styles.ph}>{display || placeholder}</span>
        {(mode==='single'?value:startDate) && (
          <button type="button" className={styles.clear}
            onClick={e=>{e.stopPropagation(); mode==='single'?onChange?.(null):onRangeChange?.({start:null,end:null});}}>
            ×
          </button>
        )}
      </button>

      {open && (
        <div className={styles.pop}>
          <div className={styles.head}>
            <button type="button" className={styles.nav} onClick={prevM}><ChevronLeft size={14}/></button>
            <span className={styles.month}>{MONTHS[viewMonth]} {viewYear}</span>
            <button type="button" className={styles.nav} onClick={nextM}><ChevronRight size={14}/></button>
          </div>
          <div className={styles.wdays}>{DAYS.map(d=><span key={d} className={styles.wday}>{d}</span>)}</div>
          <div className={styles.grid} onMouseLeave={()=>setHoverDate(null)}>
            {cells.map((d,i) => {
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
                  onClick={()=>handleClick(sod(d))}
                  onMouseEnter={()=>{ if(mode==='range'&&startDate&&!endDate) setHoverDate(sod(d)); }}>
                  {d.getDate()}
                </button>
              );
            })}
          </div>
          {mode==='range' && startDate && !endDate && <p className={styles.hint}>Selecione a data final</p>}
        </div>
      )}
    </div>
  );
}