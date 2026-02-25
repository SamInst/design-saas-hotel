import { useState } from 'react';
import Sidebar from './Sidebar';
import styles from './AppLayout.module.css';

export default function AppLayout(props) {
  const { children, ...sidebarProps } = props;
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className={styles.shell}>
      <div className={styles.sidebarSlot}>
        <Sidebar {...sidebarProps} collapsed={collapsed} onToggleCollapse={() => setCollapsed(v => !v)} />
      </div>

      <main className={[styles.main, collapsed ? styles.mainCollapsed : ''].join(' ')}>
        {children}
      </main>
    </div>
  );
}
