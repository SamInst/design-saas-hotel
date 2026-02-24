import styles from './Input.module.css';

export function Input({ className = '', ...props }) {
  return <input className={[styles.input, className].join(' ')} {...props} />;
}

export function Select({ className = '', children, ...props }) {
  return (
    <select className={[styles.input, className].join(' ')} {...props}>
      {children}
    </select>
  );
}

export function FormField({ label, children }) {
  return (
    <div className={styles.field}>
      <label className={styles.label}>{label}</label>
      {children}
    </div>
  );
}
