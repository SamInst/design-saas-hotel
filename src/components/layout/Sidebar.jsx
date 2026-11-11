import { useEffect, useRef, useState } from 'react';
import {
  CalendarDays, Wallet, Package, Tag, LogOut,
  UserCog, Users, ShieldCheck, Building2, Settings, Hotel, ChevronDown, Check, Loader2, Sun, Moon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import styles from './Sidebar.module.css';
import { usePermissions } from '../../hooks/usePermissions';
import { authApi } from '../../services/api';

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


export default function Sidebar({ currentPage, onNavigate, user, onLogout, isDark, onToggleTheme }) {
  const { t } = useTranslation();
  const { hasTela, loggedUser, contexto } = usePermissions();
  const hoteis = contexto?.hoteis ?? [];
  const hotelAtual = contexto?.hotel;
  const podeTrocar = hoteis.length > 1;
  const [hoteisAberto, setHoteisAberto] = useState(false);
  const [trocando, setTrocando] = useState(null);
  const [erroTroca, setErroTroca] = useState('');
  const hotelRef = useRef(null);

  useEffect(() => {
    if (!hoteisAberto) return undefined;
    const fora  = (e) => { if (hotelRef.current && !hotelRef.current.contains(e.target)) setHoteisAberto(false); };
    const tecla = (e) => { if (e.key === 'Escape') setHoteisAberto(false); };
    document.addEventListener('mousedown', fora);
    document.addEventListener('keydown', tecla);
    return () => { document.removeEventListener('mousedown', fora); document.removeEventListener('keydown', tecla); };
  }, [hoteisAberto]);

  const trocarHotel = async (id) => {
    if (id === hotelAtual?.id || trocando) return;
    setTrocando(id);
    setErroTroca('');
    try {
      await authApi.trocarHotel(id);
      window.location.reload();
    } catch (err) {
      setErroTroca(err.message);
      setTrocando(null);
    }
  };

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


  const rawNome = loggedUser?.pessoa?.nome ?? user?.name ?? '';
  const parts   = rawNome.trim().split(/\s+/).filter(Boolean);
  const nome    = parts.join(' ') || t('profile.defaultName');
  const cargo   = loggedUser?.cargo?.descricao ?? user?.role ?? t('profile.defaultRole');
  const iniciais = parts.length >= 2 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : (nome.charAt(0) || 'U').toUpperCase();

  const permitidos = NAV_ITEMS.filter((i) => hasTela(i.tela));

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
    <aside className={styles.sidebar} aria-label={t('nav.menu')} role="navigation">
      <span className={styles.janelaPontos} aria-hidden="true"><i /><i /><i /></span>
      {podeTrocar && (
      <div className={styles.topo}>
        <div className={styles.hotel} ref={hotelRef}>
          {podeTrocar ? (
            <button type="button" className={[styles.marca, styles.marcaBotao].join(' ')}
              onClick={() => setHoteisAberto((v) => !v)} aria-haspopup="menu" aria-expanded={hoteisAberto}
              title={t('nav.switchHotel', 'Trocar de hotel')}>
              <span className={styles.marcaTxt}>{hotelAtual?.nome}</span>
              <ChevronDown size={14} className={hoteisAberto ? styles.marcaSetaAberta : ''} />
            </button>
          ) : null}
          {hoteisAberto && (
            <div className={styles.hoteisMenu} role="menu">
              {hoteis.map((h) => (
                <button key={h.id} type="button" role="menuitemradio" aria-checked={h.id === hotelAtual?.id}
                  className={[styles.hotelOpcao, h.id === hotelAtual?.id ? styles.hotelOpcaoAtual : ''].join(' ')}
                  onClick={() => trocarHotel(h.id)} disabled={!!trocando}>
                  <Hotel size={14} />
                  <span className={styles.hotelOpcaoTxt}>
                    <b>{h.nome}</b>
                    {h.redeNome && <small>{h.redeNome}</small>}
                  </span>
                  {trocando === h.id ? <Loader2 size={14} className={styles.girando} /> : h.id === hotelAtual?.id ? <Check size={14} /> : null}
                </button>
              ))}
              {erroTroca && <p className={styles.hotelErro}>{erroTroca}</p>}
            </div>
          )}
        </div>
      </div>
      )}

      <nav className={styles.nav}>
        <ul className={styles.lista}>
          {permitidos.map((i) => item({ id: i.id, label: t(i.label), icon: i.icon, ativo: currentPage === i.id, onClick: () => go(i.id) }))}
        </ul>
      </nav>

      <ul className={[styles.lista, styles.rodape].join(' ')}>
        {onToggleTheme && item({ id: '_tema', label: isDark ? t('theme.light', 'Tema claro') : t('theme.dark', 'Tema escuro'), icon: isDark ? Moon : Sun, onClick: onToggleTheme })}
      </ul>

      <div className={styles.conta} ref={contaRef}>
        <button type="button" className={styles.contaBtn} onClick={() => setContaAberta((v) => !v)}
          aria-haspopup="menu" aria-expanded={contaAberta} aria-label={`${t('nav.account', 'Conta')}: ${nome}, ${cargo}`} title={`${nome} · ${cargo}`}>
          <span className={styles.avatar} aria-hidden="true">{iniciais.charAt(0)}</span>
          <span className={styles.contaNome}>{parts[0] || nome}</span>
        </button>
        {contaAberta && (
          <div className={styles.contaMenu} role="menu">
            <button type="button" role="menuitem" className={styles.contaOpcao} onClick={() => { setContaAberta(false); go('settings'); }}>
              <Settings size={15} /> {t('profile.settings')}
            </button>
            <button type="button" role="menuitem" className={styles.sair} onClick={() => { setContaAberta(false); onLogout(); }}>
              <LogOut size={15} /> {t('profile.logout')}
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
