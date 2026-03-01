import { X } from 'lucide-react';
import styles from './Modal.module.css';

export function Modal({ open, onClose, title, children, footer, size = 'md', bodyStyle }) {
  if (!open) return null;

  return (
    <div className={styles.backdrop}>
      <div className={[styles.modal, styles[size]].join(' ')}>
        <div className={styles.header}>
          <div className={styles.title}>{title}</div>
          <button className={styles.close} onClick={onClose} type="button" aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

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
