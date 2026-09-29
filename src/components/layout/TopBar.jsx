import { useEffect, useRef, useState } from 'react';
import {
  CalendarDays, Wallet, Package, Tag, LogOut, Sun, Moon, ChevronDown,
  UserCog, Users, ShieldCheck, Building2,
} from 'lucide-react';
import styles from './TopBar.module.css';
import img3dRecepcao     from '../../assets/menu/recepcao.png';
import img3dReservas     from '../../assets/menu/reservas.png';
import img3dFinanceiro   from '../../assets/menu/financeiro.png';
import img3dItens        from '../../assets/menu/itens.png';
import img3dCadastros    from '../../assets/menu/cadastros.png';
import img3dPrecos       from '../../assets/menu/precos.png';
import img3dFuncionarios from '../../assets/menu/funcionarios.png';
import img3dPermissoes   from '../../assets/menu/permissoes.png';
import { usePermissions } from '../../hooks/usePermissions';

// tela: nome exato da tela no backend (cargo.telas[].nome)
// tela: 'ADMIN' = tela de administrador total (vê tudo)
const NAV_ITEMS = [
  { id: 'reception',   label: 'Recepção',            icon: Building2,  tela: 'DASHBOARD', img: img3dRecepcao, tone: '#f28b6d' },
  { id: 'bookings',    label: 'Reservas',             icon: CalendarDays,tela: 'RESERVAS', img: img3dReservas, tone: '#6fa8f5' },
  { id: 'financial',   label: 'Financeiro',           icon: Wallet,     tela: 'FINANCEIRO', img: img3dFinanceiro, tone: '#5fc79a' },
  { id: 'inventory',   label: 'Itens',                icon: Package,    tela: 'ITENS', img: img3dItens, tone: '#f5b75a' },
  { id: 'registers',   label: 'Cadastros',            icon: Users,      tela: 'CADASTRO', img: img3dCadastros, tone: '#9b8cf0' },
  { id: 'pricing',     label: 'Preços',               icon: Tag,        tela: 'PRECOS', img: img3dPrecos, tone: '#f07fa6' },
  { id: 'employees',   label: 'Funcionários',         icon: UserCog,    tela: 'FUNCIONARIOS', img: img3dFuncionarios, tone: '#4fc2c9' },
  { id: 'permissions', label: 'Cargos e Permissões',  icon: ShieldCheck,tela: 'CARGOS E PERMISSOES', img: img3dPermissoes, tone: '#8a9bb5' },
];

/** Ícone do menu de telas — SVG próprio, herda a cor do botão. */
function MenuIcon({ size = 19 }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 512 474.051"
      fill="currentColor" fillRule="evenodd" clipRule="evenodd"
      shapeRendering="geometricPrecision"
      aria-hidden="true" focusable="false"
    >
      <path d="M11.216 0H88.37c6.169 0 11.216 5.047 11.216 11.216v70.947c0 6.17-5.047 11.217-11.216 11.217H11.216C5.047 93.38 0 88.333 0 82.163V11.216C0 5.047 5.047 0 11.216 0zm152.662 380.672h336.906c6.169 0 11.216 5.05 11.216 11.216v70.947c0 6.166-5.051 11.216-11.216 11.216H163.878c-6.166 0-11.217-5.046-11.217-11.216v-70.947c0-6.169 5.047-11.216 11.217-11.216zm-152.662 0H88.37c6.169 0 11.216 5.047 11.216 11.216v70.947c0 6.17-5.047 11.216-11.216 11.216H11.216C5.047 474.051 0 469.005 0 462.835v-70.947c0-6.169 5.047-11.216 11.216-11.216zm152.662-190.336h336.906c6.169 0 11.216 5.05 11.216 11.216v70.947c0 6.166-5.051 11.216-11.216 11.216H163.878c-6.166 0-11.217-5.046-11.217-11.216v-70.947c0-6.17 5.047-11.216 11.217-11.216zm-152.662 0H88.37c6.169 0 11.216 5.046 11.216 11.216v70.947c0 6.17-5.047 11.216-11.216 11.216H11.216C5.047 283.715 0 278.669 0 272.499v-70.947c0-6.17 5.047-11.216 11.216-11.216zM163.878 0h336.906C506.953 0 512 5.051 512 11.216v70.947c0 6.166-5.051 11.217-11.216 11.217H163.878c-6.166 0-11.217-5.047-11.217-11.217V11.216C152.661 5.047 157.708 0 163.878 0z" />
    </svg>
  );
}

/** Fecha o menu ao clicar fora ou apertar Esc. */
function useDismiss(ref, onDismiss) {
  useEffect(() => {
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) onDismiss(); };
    const onKey  = (e) => { if (e.key === 'Escape') onDismiss(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [ref, onDismiss]);
}

export default function TopBar({
  currentPage,
  onNavigate,
  user,
  isDark,
  onToggleTheme,
  onLogout,
}) {
  const { hasTela, loggedUser } = usePermissions();
  const isAdmin = hasTela('ADMIN');

  const [menuOpen,    setMenuOpen]    = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const menuRef    = useRef(null);
  const profileRef = useRef(null);
  useDismiss(menuRef,    () => setMenuOpen(false));
  useDismiss(profileRef, () => setProfileOpen(false));

  const rawNome = loggedUser?.pessoa?.nome ?? user?.name ?? '';
  const parts   = rawNome.trim().split(/\s+/).filter(Boolean);
  const displayName = parts.length >= 2 ? `${parts[0]} ${parts[parts.length - 1]}` : parts[0] || 'Usuário';
  const displayRole = loggedUser?.cargo?.descricao ?? user?.role ?? 'Perfil';
  const initials = parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : (displayName.charAt(0) || 'U').toUpperCase();

  const visibleItems = NAV_ITEMS.filter((item) => isAdmin || hasTela(item.tela));

  // Se a página atual não está acessível, redireciona para a primeira disponível
  const firstAvailable = visibleItems[0]?.id;
  if (firstAvailable && !visibleItems.some((i) => i.id === currentPage)) {
    onNavigate(firstAvailable);
  }

  const pageItem  = NAV_ITEMS.find((i) => i.id === currentPage);
  const pageLabel = pageItem?.label ?? '';

  const go = (id) => { setMenuOpen(false); onNavigate(id); };

  return (
    <header className={styles.topbar}>
      {/* ── Logo + nome da tela ── */}
      <div className={styles.brand}>
        {pageItem?.img && <img className={styles.pageIcon} src={pageItem.img} alt="" />}
        <h1 className={styles.pageName}>{pageLabel}</h1>
      </div>

      <div className={styles.right}>
        {/* ── Menu de telas ── */}
        <div className={styles.menuWrap} ref={menuRef}>
          <button
            type="button"
            className={[styles.iconBtn, menuOpen ? styles.iconBtnActive : ''].join(' ')}
            onClick={() => { setMenuOpen((v) => !v); setProfileOpen(false); }}
            aria-label="Menu"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            title="Menu"
          >
            <MenuIcon size={19} />
          </button>

          {menuOpen && (
            <div className={styles.dropdown} role="menu">
              <span className={styles.dropdownLabel}>Menu</span>
              {visibleItems.map(({ id, label, icon: Icon, img, tone }, i) => {
                const active = currentPage === id;
                return (
                  <button
                    key={id}
                    type="button"
                    role="menuitem"
                    className={[styles.menuItem, active ? styles.menuItemActive : ''].join(' ')}
                    style={{ animationDelay: `${i * 22}ms` }}
                    onClick={() => go(id)}
                  >
                    {img ? (
                      <span className={styles.menuIcon}><img src={img} alt="" className={styles.menuIcon3d} /></span>
                    ) : (
                      <span className={[styles.menuIcon, styles.menuIconPastel].join(' ')} style={{ '--tone': tone }}>
                        <Icon size={16} strokeWidth={2.2} />
                      </span>
                    )}
                    <span className={styles.menuLabel}>{label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Perfil ── */}
        <div className={styles.menuWrap} ref={profileRef}>
          <button
            type="button"
            className={[styles.profileBtn, profileOpen ? styles.profileBtnActive : ''].join(' ')}
            onClick={() => { setProfileOpen((v) => !v); setMenuOpen(false); }}
            aria-haspopup="menu"
            aria-expanded={profileOpen}
          >
            <span className={styles.avatar}>{initials}</span>
            <span className={styles.profileText}>
              <span className={styles.profileName}>{displayName}</span>
              <span className={styles.profileRole}>{displayRole}</span>
            </span>
            <ChevronDown size={16} className={[styles.chevron, profileOpen ? styles.chevronOpen : ''].join(' ')} />
          </button>

          {profileOpen && (
            <div className={[styles.dropdown, styles.dropdownRight].join(' ')} role="menu">
              <div className={styles.profileHead}>
                <span className={[styles.avatar, styles.avatarLg].join(' ')}>{initials}</span>
                <span className={styles.profileText}>
                  <span className={styles.profileName}>{displayName}</span>
                  <span className={styles.profileRole}>{displayRole}</span>
                </span>
              </div>

              <div className={styles.divider} />

              <button
                type="button"
                role="menuitem"
                className={styles.menuItem}
                onClick={() => { setProfileOpen(false); onToggleTheme(); }}
              >
                <span className={styles.menuIcon}>{isDark ? <Sun size={17} /> : <Moon size={17} />}</span>
                <span className={styles.menuLabel}>{isDark ? 'Modo Claro' : 'Modo Escuro'}</span>
              </button>

              <button
                type="button"
                role="menuitem"
                className={[styles.menuItem, styles.menuItemDanger].join(' ')}
                onClick={() => { setProfileOpen(false); onLogout(); }}
              >
                <span className={styles.menuIcon}><LogOut size={17} /></span>
                <span className={styles.menuLabel}>Sair</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
