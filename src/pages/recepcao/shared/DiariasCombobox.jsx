import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import styles from '../recepcao.module.css';

export default function DiariasCombobox({ value = [], onChange, diarias = [], atualNum = 1 }) {
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

  const toggle    = (idx) => onChange(value.includes(idx) ? value.filter((x) => x !== idx) : [...value, idx]);
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
        const sel       = value.includes(d.idx);
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
