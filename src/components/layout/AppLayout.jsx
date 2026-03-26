import { useState } from 'react';
import { Menu } from 'lucide-react';
import Sidebar from './Sidebar';
import styles from './AppLayout.module.css';

export default function AppLayout(props) {
  const { children, onNavigate, ...sidebarProps } = props;
  const [collapsed,   setCollapsed]   = useState(false);
  const [mobileOpen,  setMobileOpen]  = useState(false);

  // fecha sidebar mobile ao navegar
  const handleNavigate = (page) => {
    onNavigate(page);
    setMobileOpen(false);
  };

  return (
    <div className={styles.shell}>

      {/* ── overlay mobile ── */}
      {mobileOpen && (
        <div className={styles.mobileOverlay} onClick={() => setMobileOpen(false)} />
      )}

      {/* ── botão flutuante (só mobile) ── */}
      <button
        className={styles.mobileToggle}
        onClick={() => setMobileOpen(v => !v)}
        aria-label="Abrir menu"
      >
        <Menu size={18} />
      </button>

      {/* ── sidebar ── */}
      <div className={[styles.sidebarSlot, mobileOpen ? styles.sidebarSlotOpen : ''].join(' ')}>
        <Sidebar
          {...sidebarProps}
          onNavigate={handleNavigate}
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed(v => !v)}
        />
      </div>

      <main className={[styles.main, collapsed ? styles.mainCollapsed : ''].join(' ')}>
        {children}
      </main>
    </div>
  );
}
