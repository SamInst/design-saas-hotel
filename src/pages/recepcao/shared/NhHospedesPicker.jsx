import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Search, Loader2, Check, ChevronRight, X } from 'lucide-react';
import { cadastroApi } from '../../../services/api';
import styles from '../recepcao.module.css';

const fmtCpf = (v) => v ? v.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : '';

export default function NhHospedesPicker({ value = [], onChange }) {
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
