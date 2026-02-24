import Sidebar from './Sidebar';
import styles from './AppLayout.module.css';

export default function AppLayout(props) {
  const { children, ...sidebarProps } = props;

  // Se você expuser "collapsed" para o layout, dá pra alternar mainCollapsed.
  // Por enquanto mantém fixo 260.
  return (
    <div className={styles.shell}>
      <div className={styles.sidebarSlot}>
        <Sidebar {...sidebarProps} />
      </div>

      <main className={styles.main}>
        {children}
      </main>
    </div>
  );
}
