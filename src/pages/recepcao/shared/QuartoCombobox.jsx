import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Search, ChevronDown } from 'lucide-react';
import { ROOM_STATUS } from './overviewApi';
import styles from '../recepcao.module.css';

export default function QuartoCombobox({ value, onChange, quartos = [], categorias = [], currentNumero = null }) {
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
