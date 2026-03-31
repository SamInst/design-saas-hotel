import { useState, useEffect, useRef } from 'react';
import styles from './TimePicker.module.css';

const HOURS   = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);
const ITEM_H  = 36;

export function TimePicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [pos,  setPos]  = useState({ top: 0, left: 0 });
  const [text, setText] = useState(value || '');
  const inputRef = useRef(null);
  const dropRef  = useRef(null);
  const hourRef  = useRef(null);
  const minRef   = useRef(null);

  const parse = (v) => {
    const parts = (v || '00:00').split(':');
    const h = Math.min(23, Math.max(0, parseInt(parts[0], 10) || 0));
    const m = Math.min(59, Math.max(0, parseInt(parts[1], 10) || 0));
    return { h, m };
  };
  const { h, m } = parse(value);

  useEffect(() => { setText(value || ''); }, [value]);

  const openDrop = () => {
    if (inputRef.current) {
      const r = inputRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 4, left: r.left });
    }
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      if (hourRef.current) hourRef.current.scrollTop = h * ITEM_H;
      if (minRef.current)  minRef.current.scrollTop  = m * ITEM_H;
    }, 10);
    return () => clearTimeout(t);
  }, [open, h, m]);

  useEffect(() => {
    const handler = (e) => {
      if (
        inputRef.current && !inputRef.current.contains(e.target) &&
        dropRef.current  && !dropRef.current.contains(e.target)
      ) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const emit = (hh, mm) => {
    const v = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    onChange(v);
    setText(v);
  };

  const handleText = (e) => {
    const v = e.target.value;
    setText(v);
    if (/^\d{1,2}:\d{2}$/.test(v)) {
      const [hh, mm] = v.split(':').map(Number);
      if (hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59)
        onChange(`${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`);
    }
  };

  const stepH = (dir) => emit((h + dir + 24) % 24, m);
  const stepM = (dir) => emit(h, (m + dir + 60) % 60);

  const scrollTo = (ref, idx) => {
    if (ref.current) ref.current.scrollTop = idx * ITEM_H;
  };

  return (
    <div className={styles.timeWrap}>
      <input
        ref={inputRef}
        className={styles.timeInput}
        value={text}
        onChange={handleText}
        onClick={openDrop}
        placeholder="HH:MM"
        maxLength={5}
      />
      {open && (
        <div ref={dropRef} className={styles.timeDrop} style={{ top: pos.top, left: pos.left }}>
          <div className={styles.timeColWrap}>
            <span className={styles.timeColLabel}>Hora</span>
            <button type="button" className={styles.timeArrow}
              onClick={() => { stepH(-1); scrollTo(hourRef, (h - 1 + 24) % 24); }}>▲</button>
            <div ref={hourRef} className={styles.timeCol}>
              {HOURS.map((hh) => (
                <button key={hh} type="button"
                  className={[styles.timeItem, hh === h ? styles.timeItemActive : ''].join(' ')}
                  onClick={() => { emit(hh, m); scrollTo(hourRef, hh); }}>
                  {String(hh).padStart(2, '0')}
                </button>
              ))}
            </div>
            <button type="button" className={styles.timeArrow}
              onClick={() => { stepH(1); scrollTo(hourRef, (h + 1) % 24); }}>▼</button>
          </div>

          <span className={styles.timeSep}>:</span>

          <div className={styles.timeColWrap}>
            <span className={styles.timeColLabel}>Min</span>
            <button type="button" className={styles.timeArrow}
              onClick={() => { stepM(-1); scrollTo(minRef, (m - 1 + 60) % 60); }}>▲</button>
            <div ref={minRef} className={styles.timeCol}>
              {MINUTES.map((mm) => (
                <button key={mm} type="button"
                  className={[styles.timeItem, mm === m ? styles.timeItemActive : ''].join(' ')}
                  onClick={() => { emit(h, mm); scrollTo(minRef, mm); setOpen(false); }}>
                  {String(mm).padStart(2, '0')}
                </button>
              ))}
            </div>
            <button type="button" className={styles.timeArrow}
              onClick={() => { stepM(1); scrollTo(minRef, (m + 1) % 60); }}>▼</button>
          </div>
        </div>
      )}
    </div>
  );
}
