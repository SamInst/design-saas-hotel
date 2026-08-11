import { X } from 'lucide-react';
import styles from './Modal.module.css';

export function Modal({ open, onClose, title, children, footer, size = 'md', bodyStyle, hideHeader, containerStyle, backdropStyle, closeOnBackdrop }) {
  if (!open) return null;

  // closeOnBackdrop: fecha ao clicar fora do modal (usado quando não há botão de fechar).
  const handleBackdrop = closeOnBackdrop
    ? (e) => { if (e.target === e.currentTarget) onClose?.(); }
    : undefined;

  return (
    <div className={styles.backdrop} style={backdropStyle} onMouseDown={handleBackdrop}>
      <div className={[styles.modal, styles[size]].join(' ')} style={containerStyle}>
        {!hideHeader && (
          <div className={styles.header}>
            <div className={styles.title}>{title}</div>
            <button className={styles.close} onClick={onClose} type="button" aria-label="Fechar">
              <X size={18} />
            </button>
          </div>
        )}

        <div className={styles.body} style={bodyStyle}>
          {children}
        </div>

        {footer && (
          <div className={styles.footer}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
