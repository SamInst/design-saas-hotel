import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import styles from './TimePicker.module.css';

const HOURS   = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);
const ITEM_H  = 34;
const VISIVEIS = 5; // itens visíveis na roda (ímpar: o do meio é o selecionado)
const DROP_H  = ITEM_H * VISIVEIS + 60; // altura aproximada do popup

/** Coluna em roda, no estilo do seletor de horas do iPhone. */
function Roda({ itens, valor, onPick }) {
  const ref = useRef(null);
  const [top, setTop] = useState(valor * ITEM_H);
  const timer = useRef(null);

  useEffect(() => {
    if (ref.current) ref.current.scrollTop = valor * ITEM_H;
    // só na abertura; depois quem manda é a rolagem
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onScroll = () => {
    const st = ref.current.scrollTop;
    setTop(st);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const idx = Math.min(itens.length - 1, Math.max(0, Math.round(st / ITEM_H)));
      if (idx !== valor) onPick(idx);
    }, 120);
  };

  const irPara = (i) => ref.current?.scrollTo({ top: i * ITEM_H, behavior: 'smooth' });

  return (
    <div className={styles.roda}>
      <div ref={ref} className={styles.rodaScroll} onScroll={onScroll}>
        <div style={{ height: ITEM_H * ((VISIVEIS - 1) / 2) }} />
        {itens.map((n, i) => {
          const dist = (i * ITEM_H - top) / ITEM_H;
          const abs  = Math.min(Math.abs(dist), 3);
          return (
            <button key={n} type="button" onClick={() => irPara(i)}
              className={[styles.rodaItem, Math.round(dist) === 0 ? styles.rodaItemSel : ''].join(' ')}
              style={{
                transform: `rotateX(${Math.max(-60, Math.min(60, -dist * 22))}deg)`,
                opacity: 1 - abs * 0.28,
              }}>
              {String(n).padStart(2, '0')}
            </button>
          );
        })}
        <div style={{ height: ITEM_H * ((VISIVEIS - 1) / 2) }} />
      </div>
    </div>
  );
}

export function TimePicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [pos,  setPos]  = useState({ top: 0, left: 0 });
  const [text, setText] = useState(value || '');
  const inputRef = useRef(null);
  const dropRef  = useRef(null);

  const parse = (v) => {
    const parts = (v || '00:00').split(':');
    const h = Math.min(23, Math.max(0, parseInt(parts[0], 10) || 0));
    const m = Math.min(59, Math.max(0, parseInt(parts[1], 10) || 0));
    return { h, m };
  };
  const { h, m } = parse(value);
  const atual = useRef(value);
  atual.current = value;

  useEffect(() => { setText(value || ''); }, [value]);

  const openDrop = () => {
    if (inputRef.current) {
      const r = inputRef.current.getBoundingClientRect();
      // sem espaço embaixo, abre para cima
      const cima = window.innerHeight - r.bottom < DROP_H + 8 && r.top > DROP_H + 8;
      setPos({ top: cima ? r.top - DROP_H - 4 : r.bottom + 4, left: r.left });
    }
    setOpen(true);
  };

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
      {open && createPortal(
        <div ref={dropRef} className={styles.timeDrop} style={{ top: pos.top, left: pos.left }}>
          <div className={styles.rodas} style={{ height: ITEM_H * VISIVEIS }}>
            <div className={styles.faixa} style={{ height: ITEM_H, top: ITEM_H * ((VISIVEIS - 1) / 2) }} />
            <Roda itens={HOURS}   valor={h} onPick={(hh) => emit(hh, parse(atual.current).m)} />
            <span className={styles.timeSep}>:</span>
            <Roda itens={MINUTES} valor={m} onPick={(mm) => emit(parse(atual.current).h, mm)} />
          </div>
          <button type="button" className={styles.timeOk} onClick={() => setOpen(false)}>OK</button>
        </div>,
        document.body,
      )}
    </div>
  );
}
