import styles from './Notification.module.css';

export function Notification({ notification }) {
  if (!notification) return null;

  const type = notification.type || 'default';
  return (
    <div className={styles.wrap}>
      <div className={[styles.toast, styles[type] || styles.default].join(' ')}>
        <span className={styles.dot} />
        <span className={styles.text}>{notification.message}</span>
      </div>
    </div>
  );
}
