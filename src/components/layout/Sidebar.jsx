import {
  BedDouble, Clock, CalendarDays, Wallet, Package,
  Tag, LogOut, Sun, Moon, ChevronLeft, ChevronRight, MoreVertical,
  DoorOpen, UserCog, Users, ShieldCheck, Building2,
} from 'lucide-react';
import styles from './Sidebar.module.css';
import { usePermissions } from '../../hooks/usePermissions';

// tela: nome exato da tela no backend (cargo.telas[].nome)
// tela: 'ADMIN' = tela de administrador total (vê tudo)
const NAV_ITEMS = [
  { id: 'reception',   label: 'Recepção',            icon: Building2,  tela: 'DASHBOARD'          },
  { id: 'stays',       label: 'Pernoites',            icon: BedDouble,  tela: 'PERNOITES'          },
  { id: 'rooms',       label: 'Apartamentos',         icon: DoorOpen,   tela: 'APARTAMENTOS'       },
  { id: 'dayuse',      label: 'Day Use',              icon: Clock,      tela: 'DAY USE'            },
  { id: 'bookings',    label: 'Reservas',             icon: CalendarDays,tela: 'RESERVAS'          },
  { id: 'financial',   label: 'Financeiro',           icon: Wallet,     tela: 'FINANCEIRO'         },
  { id: 'inventory',   label: 'Itens',                icon: Package,    tela: 'ITENS'              },
  { id: 'registers',   label: 'Cadastros',            icon: Users,      tela: 'CADASTRO'           },
  { id: 'pricing',     label: 'Preços',               icon: Tag,        tela: 'PRECOS'             },
  { id: 'employees',   label: 'Funcionários',         icon: UserCog,    tela: 'FUNCIONARIOS'       },
  { id: 'permissions', label: 'Cargos e Permissões',  icon: ShieldCheck,tela: 'CARGOS E PERMISSOES'},
];

export default function Sidebar({
  currentPage,
  onNavigate,
  user,
  isDark,
  onToggleTheme,
  onLogout,
  appName = 'Hotel System',
  collapsed = false,
  onToggleCollapse,
}) {
  const { hasTela, loggedUser } = usePermissions();
  const isAdmin = hasTela('ADMIN');

  const rawNome = loggedUser?.pessoa?.nome ?? user?.name ?? '';
  const parts   = rawNome.trim().split(/\s+/);
  const displayName = parts.length >= 2 ? `${parts[0]} ${parts[parts.length - 1]}` : parts[0] || 'Usuário';
  const displayRole = loggedUser?.cargo?.descricao ?? user?.role ?? 'Perfil';

  const visibleItems = NAV_ITEMS.filter(item => isAdmin || hasTela(item.tela));

  // Se a página atual não está acessível, redireciona para a primeira disponível
  const firstAvailable = visibleItems[0]?.id;
  if (firstAvailable && !visibleItems.some(i => i.id === currentPage)) {
    onNavigate(firstAvailable);
  }

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
          onClick={onToggleCollapse}
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

        {visibleItems.map(({ id, label, icon: Icon }, i) => {
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
            {(displayName.charAt(0) || 'U').toUpperCase()}
          </div>

          {!collapsed && (
            <>
              <div className={styles.profileText}>
                <div className={styles.profileName}>{displayName}</div>
                <div className={styles.profileRole}>{displayRole}</div>
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