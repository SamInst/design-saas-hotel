import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';
import styles from './TimeInput.module.css';

// "14:30" mask: extracts digits, caps H at 23 and M at 59
function applyMask(raw) {
  const d = raw.replace(/\D/g, '').slice(0, 4);
  if (d.length === 0) return '';
  if (d.length <= 2) {
    // Cap hours at 2x while typing: "3" → "3", "25" → "23"
    if (d.length === 2 && parseInt(d, 10) > 23) return '23';
    return d;
  }
  const h = Math.min(23, parseInt(d.slice(0, 2), 10));
  const mRaw = d.slice(2);
  const m = mRaw.length === 2 ? Math.min(59, parseInt(mRaw, 10)) : parseInt(mRaw, 10);
  return String(h).padStart(2, '0') + ':' + String(m).padStart(mRaw.length < 2 ? mRaw.length : 2, '0');
}

const isComplete = (v) => /^\d{2}:\d{2}$/.test(v);

export function TimeInput({
  value = '',
  onChange,
  label,
  disabled = false,
  placeholder = '00:00',
}) {
  const [text, setText] = useState(value);
  const [focused, setFocused] = useState(false);

  // Keep in sync when not focused
  useEffect(() => {
    if (!focused) setText(value);
  }, [value, focused]);

  const handleChange = (e) => {
    const masked = applyMask(e.target.value);
    setText(masked);
    if (isComplete(masked)) onChange?.(masked);
    else if (masked === '') onChange?.('');
  };

  const handleBlur = () => {
    setFocused(false);
    // Revert to last valid value if field is incomplete
    if (!isComplete(text)) setText(value);
  };

  const fieldCls = [
    styles.field,
    focused    ? styles.focused   : '',
    disabled   ? styles.disabled  : '',
  ].join(' ');

  return (
    <div className={styles.wrap}>
      {label && <label className={styles.label}>{label}</label>}
      <div className={fieldCls}>
        <Clock size={13} className={styles.icon} />
        <input
          type="text"
          inputMode="numeric"
          className={styles.input}
          value={focused ? text : value}
          onChange={handleChange}
          onFocus={() => { setFocused(true); setText(value); }}
          onBlur={handleBlur}
          placeholder={placeholder}
          maxLength={5}
          disabled={disabled}
        />
      </div>
    </div>
  );
}
