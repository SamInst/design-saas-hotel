import { createContext, useContext } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import styles from './Modal.module.css';
import { tr } from '../../i18n';

// Com um elemento aqui, o Modal abre como gaveta lateral dentro dele, em vez de sobrepor a tela.
export const ModalGavetaCtx = createContext(null);

export function Modal({ open, onClose, title, children, footer, size = 'md', bodyStyle, hideHeader, containerStyle, backdropStyle, closeOnBackdrop }) {
  const slot = useContext(ModalGavetaCtx);
  if (!open) return null;

  if (slot) {
    return createPortal(
      <section className={[styles.gaveta, styles[`gaveta_${size}`]].join(' ')} style={containerStyle} role="dialog" aria-modal="false">
        {!hideHeader && (
          <header className={styles.gavetaHead}>
            <div className={styles.gavetaTit}>{title}</div>
            <button className={styles.gavetaFechar} onClick={onClose} type="button" aria-label={tr('Fechar')}>
              <X size={17} />
            </button>
          </header>
        )}
        <div className={styles.gavetaCorpo} style={bodyStyle}>{children}</div>
        {footer && <footer className={styles.gavetaRodape}>{footer}</footer>}
      </section>,
      slot,
    );
  }

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
            <button className={styles.close} onClick={onClose} type="button" aria-label={tr('Fechar')}>
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
