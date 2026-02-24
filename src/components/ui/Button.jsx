import styles from './Button.module.css';

export function Button({ children, variant = 'secondary', onClick, className = '', type = 'button', disabled = false }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={[
        styles.btn,
        styles[variant] || styles.secondary,
        className
      ].join(' ')}
    >
      {children}
    </button>
  );
}
