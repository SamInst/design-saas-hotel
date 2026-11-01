import { useEffect, useRef, useState } from 'react';
import {
  CalendarDays, Wallet, Package, Tag, LogOut, MoreVertical,
  UserCog, Users, ShieldCheck, Building2, Settings, ChevronsLeft, ChevronsRight, Hotel,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import styles from './Sidebar.module.css';
import { usePermissions } from '../../hooks/usePermissions';
import { NOME_HOTEL } from '../../constants/hotel';

const NAV_ITEMS = [
  { id: 'reception',   label: 'nav.reception',   icon: Building2,    tela: 'DASHBOARD' },
  { id: 'bookings',    label: 'nav.bookings',    icon: CalendarDays, tela: 'RESERVAS' },
  { id: 'financial',   label: 'nav.financial',   icon: Wallet,       tela: 'FINANCEIRO' },
  { id: 'inventory',   label: 'nav.inventory',   icon: Package,      tela: 'ITENS' },
  { id: 'registers',   label: 'nav.registers',   icon: Users,        tela: 'CADASTRO' },
  { id: 'pricing',     label: 'nav.pricing',     icon: Tag,          tela: 'PRECOS' },
  { id: 'employees',   label: 'nav.employees',   icon: UserCog,      tela: 'FUNCIONARIOS' },
  { id: 'permissions', label: 'nav.permissions', icon: ShieldCheck,  tela: 'CARGOS E PERMISSOES' },
];

const lerRecolhido = () => { try { return localStorage.getItem('sidebar:recolhido') === '1'; } catch { return false; } };
const gravarRecolhido = (v) => { try { localStorage.setItem('sidebar:recolhido', v ? '1' : '0'); } catch { /* sem storage */ } };


export default function Sidebar({ currentPage, onNavigate, user, onLogout }) {
  const { t } = useTranslation();
  const { hasTela, loggedUser } = usePermissions();
  const isAdmin = hasTela('ADMIN');

  const [recolhido, setRecolhido] = useState(lerRecolhido);
  const [contaAberta, setContaAberta] = useState(false);
  const contaRef = useRef(null);

  useEffect(() => {
    if (!contaAberta) return undefined;
    const fora  = (e) => { if (contaRef.current && !contaRef.current.contains(e.target)) setContaAberta(false); };
    const tecla = (e) => { if (e.key === 'Escape') setContaAberta(false); };
    document.addEventListener('mousedown', fora);
    document.addEventListener('keydown', tecla);
    return () => { document.removeEventListener('mousedown', fora); document.removeEventListener('keydown', tecla); };
  }, [contaAberta]);

  const alterna = () => setRecolhido((v) => { gravarRecolhido(!v); return !v; });

  const rawNome = loggedUser?.pessoa?.nome ?? user?.name ?? '';
  const parts   = rawNome.trim().split(/\s+/).filter(Boolean);
  const nome    = parts.join(' ') || t('profile.defaultName');
  const cargo   = loggedUser?.cargo?.descricao ?? user?.role ?? t('profile.defaultRole');
  const iniciais = parts.length >= 2 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : (nome.charAt(0) || 'U').toUpperCase();

  const permitidos = NAV_ITEMS.filter((i) => isAdmin || hasTela(i.tela));
  const visiveis = [...permitidos.filter((i) => i.id === currentPage), ...permitidos.filter((i) => i.id !== currentPage)];

  const go = (id) => onNavigate(id);

  const item = ({ id, label, icon: Icon, onClick, ativo = false }) => (
    <li key={id}>
      <button type="button" className={[styles.item, ativo ? styles.itemAtivo : ''].join(' ')}
        onClick={onClick} aria-current={ativo ? 'page' : undefined} aria-label={label}>
        <Icon size={17} strokeWidth={1.9} className={styles.itemIcone} />
        <span className={styles.itemTxt}>{label}</span>
        {(recolhido || id.startsWith("_") || id === "settings") && <span className={styles.dica} role="tooltip">{label}</span>}
      </button>
    </li>
  );

  return (
    <aside className={[styles.sidebar, recolhido ? styles.recolhido : ''].join(' ')} aria-label={t('nav.menu')} role="navigation">
      <div className={styles.topo}>
        <span className={styles.logo}><Hotel size={18} strokeWidth={2} /></span>
        <span className={styles.marca}>{NOME_HOTEL}</span>
        <button type="button" className={styles.recolher} onClick={alterna}
          aria-label={recolhido ? t('nav.expand', 'Expandir menu') : t('nav.collapse', 'Recolher menu')}
          title={recolhido ? t('nav.expand', 'Expandir menu') : t('nav.collapse', 'Recolher menu')}>
          {recolhido ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
        </button>
      </div>

      <nav className={styles.nav}>
        <ul className={styles.lista}>
          {visiveis.map((i) => item({ id: i.id, label: t(i.label), icon: i.icon, ativo: currentPage === i.id, onClick: () => go(i.id) }))}
        </ul>
      </nav>

      <ul className={[styles.lista, styles.rodape].join(' ')}>
        {item({ id: 'settings', label: t('profile.settings'), icon: Settings, ativo: currentPage === 'settings', onClick: () => go('settings') })}
      </ul>

      <div className={styles.conta} ref={contaRef}>
        <span className={styles.avatar} aria-hidden="true">{iniciais}</span>
        <span className={styles.contaTxt}>
          <b>{nome}</b>
          <small>{cargo}</small>
        </span>
        <button type="button" className={styles.contaMais} onClick={() => setContaAberta((v) => !v)}
          aria-haspopup="menu" aria-expanded={contaAberta} aria-label={t('nav.account', 'Conta')}>
          <MoreVertical size={16} />
        </button>
        {contaAberta && (
          <div className={styles.contaMenu} role="menu">
            <button type="button" role="menuitem" className={styles.sair} onClick={() => { setContaAberta(false); onLogout(); }}>
              <LogOut size={15} /> {t('profile.logout')}
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
