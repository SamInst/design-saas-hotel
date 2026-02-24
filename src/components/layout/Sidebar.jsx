import { useState } from 'react';
import {
  LayoutGrid, BedDouble, Clock, CalendarDays, Wallet, Package,
  Tag, LogOut, Sun, Moon, ChevronLeft, ChevronRight, MoreVertical,
  DoorOpen, UserCog, Users, ShieldCheck,
} from 'lucide-react';
import styles from './Sidebar.module.css';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard',    icon: LayoutGrid  },
  { id: 'stays',     label: 'Pernoites',    icon: BedDouble   },
  { id: 'rooms',     label: 'Apartamentos', icon: DoorOpen    },
  { id: 'dayuse',    label: 'Day Use',      icon: Clock       },
  { id: 'bookings',  label: 'Reservas',     icon: CalendarDays},
  { id: 'financial', label: 'Financeiro',   icon: Wallet      },
  { id: 'inventory', label: 'Itens',        icon: Package     },
  { id: 'registers', label: 'Cadastros',    icon: Users       },
  { id: 'pricing',   label: 'Preços',       icon: Tag         },
  { id: 'users',     label: 'Funcionários', icon: UserCog     },
  { id: 'permissions', label: 'Permissões', icon: ShieldCheck },
];

export default function Sidebar({
  currentPage,
  onNavigate,
  user,
  isDark,
  onToggleTheme,
  onLogout,
  appName = 'Hotel System',
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside className={[styles.sidebar, collapsed ? styles.collapsed : ''].join(' ')}>

      {/* ── BRAND ── */}
      <div className={styles.brand}>
        <div className={styles.logoWrap}>
          <img
            src="/images/hotel-system-logo.svg"
            alt="Hotel System"
            className={styles.logoImg}
          />
        </div>

        {!collapsed && (
          <div className={styles.brandText}>
            <span className={styles.appName}>{appName}</span>
            <span className={styles.appTagline}>Painel de Gestão</span>
          </div>
        )}

        <button
          type="button"
          className={styles.collapseBtn}
          onClick={() => setCollapsed(v => !v)}
          aria-label={collapsed ? 'Expandir menu' : 'Colapsar menu'}
          title={collapsed ? 'Expandir' : 'Colapsar'}
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>

      <div className={styles.dividerTop} />

      {/* ── NAV ── */}
      <nav className={styles.nav}>
        {!collapsed && <span className={styles.navSection}>Menu</span>}

        {NAV_ITEMS.map(({ id, label, icon: Icon }, i) => {
          const active = currentPage === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onNavigate(id)}
              className={[styles.item, active ? styles.itemActive : ''].join(' ')}
              title={collapsed ? label : undefined}
              style={{ animationDelay: `${i * 30}ms` }}
            >
              <span className={styles.iconWrap}>
                <Icon size={17} />
              </span>
              {!collapsed && <span className={styles.label}>{label}</span>}
              {active && !collapsed && <span className={styles.activePip} />}
            </button>
          );
        })}
      </nav>

      {/* ── BOTTOM ── */}
      <div className={styles.bottom}>
        <div className={styles.dividerBottom} />

        <button
          type="button"
          className={styles.themeBtn}
          onClick={onToggleTheme}
          title={isDark ? 'Modo Claro' : 'Modo Escuro'}
        >
          <span className={styles.iconWrap}>
            {isDark ? <Sun size={17} /> : <Moon size={17} />}
          </span>
          {!collapsed && (
            <span className={styles.label}>
              {isDark ? 'Modo Claro' : 'Modo Escuro'}
            </span>
          )}
        </button>

        <button
          type="button"
          className={styles.logoutBtn}
          onClick={onLogout}
          title={collapsed ? 'Sair' : undefined}
        >
          <span className={styles.iconWrap}>
            <LogOut size={17} />
          </span>
          {!collapsed && <span className={styles.label}>Sair</span>}
        </button>

        <div className={styles.dividerBottom} />

        <div className={styles.profile}>
          <div className={styles.avatar}>
            {(user?.name?.charAt(0) || 'U').toUpperCase()}
          </div>

          {!collapsed && (
            <>
              <div className={styles.profileText}>
                <div className={styles.profileName}>{user?.name || 'Usuário'}</div>
                <div className={styles.profileRole}>{user?.role || 'Perfil'}</div>
              </div>
              <button type="button" className={styles.moreBtn} aria-label="Opções">
                <MoreVertical size={16} />
              </button>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}