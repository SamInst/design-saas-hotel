import { useState } from 'react';
import { Languages, Check, Sun, Moon, Palette, CalendarDays, GanttChartSquare, CalendarRange } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LANGUAGES } from '../../i18n';
import { usePermissions } from '../../hooks/usePermissions';
import { Notification } from '../../components/ui/Notification';
import StoneIntegracao from './StoneIntegracao';
import styles from './SettingsPage.module.css';

export default function SettingsPage({ isDark = false, onToggleTheme }) {
  const { t, i18n } = useTranslation();
  const current = i18n.resolvedLanguage;
  const { hasTela } = usePermissions();
  const [notification, setNotification] = useState(null);
  const [visao, setVisao] = useState(() => { try { return localStorage.getItem('calendario:visao') === 'mes' ? 'mes' : 'linha'; } catch { return 'linha'; } });
  const escolherVisao = (v) => { setVisao(v); try { localStorage.setItem('calendario:visao', v); } catch { /* sem storage */ } };

  const notify = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3200);
  };

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <header className={styles.header}>
          <h2 className={styles.title}>{t('settings.title')}</h2>
          <p className={styles.subtitle}>{t('settings.subtitle')}</p>
        </header>

        <section className={styles.card}>
          <div className={styles.cardHead}>
            <span className={styles.cardIcon}><Languages size={18} /></span>
            <div>
              <h3 className={styles.cardTitle}>{t('settings.language.title')}</h3>
              <p className={styles.cardDesc}>{t('settings.language.description')}</p>
            </div>
          </div>

          <div className={styles.options} role="radiogroup" aria-label={t('settings.language.title')}>
            {LANGUAGES.map(({ code, label, flag }) => {
              const active = current === code;
              return (
                <button
                  key={code}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  className={[styles.option, active ? styles.optionActive : ''].join(' ')}
                  onClick={() => { if (!active) i18n.changeLanguage(code).then(() => window.location.reload()); }}
                >
                  <span className={styles.flag} aria-hidden="true">{flag}</span>
                  <span className={styles.optionLabel}>{label}</span>
                  {active && (
                    <span className={styles.badge}><Check size={13} strokeWidth={2.6} />{t('settings.language.active')}</span>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        <section className={styles.card}>
          <div className={styles.cardHead}>
            <span className={styles.cardIcon}><Palette size={18} /></span>
            <div>
              <h3 className={styles.cardTitle}>{t('settings.theme.title', 'Tema')}</h3>
              <p className={styles.cardDesc}>{t('settings.theme.description', 'Escolha a aparência do sistema neste navegador.')}</p>
            </div>
          </div>

          <div className={styles.options} role="radiogroup" aria-label={t('settings.theme.title', 'Tema')}>
            {[[false, t('profile.lightMode'), Sun], [true, t('profile.darkMode'), Moon]].map(([escuro, label, Icone]) => {
              const active = isDark === escuro;
              return (
                <button
                  key={label}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  className={[styles.option, active ? styles.optionActive : ''].join(' ')}
                  onClick={() => { if (!active) onToggleTheme?.(); }}
                >
                  <span className={styles.flag} aria-hidden="true"><Icone size={18} /></span>
                  <span className={styles.optionLabel}>{label}</span>
                  {active && (
                    <span className={styles.badge}><Check size={13} strokeWidth={2.6} />{t('settings.language.active')}</span>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        <section className={styles.card}>
          <div className={styles.cardHead}>
            <span className={styles.cardIcon}><CalendarDays size={18} /></span>
            <div>
              <h3 className={styles.cardTitle}>{t('settings.calendar.title', 'Visualização do calendário')}</h3>
              <p className={styles.cardDesc}>{t('settings.calendar.description', 'Escolha como as reservas aparecem na tela de reservas.')}</p>
            </div>
          </div>

          <div className={styles.options} role="radiogroup" aria-label={t('settings.calendar.title', 'Visualização do calendário')}>
            {[['linha', t('settings.calendar.timeline', 'Matriz (Quarto x dias da semana)'), GanttChartSquare], ['mes', t('settings.calendar.month', 'Calendário do mês'), CalendarRange]].map(([v, label, Icone]) => {
              const active = visao === v;
              return (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  className={[styles.option, active ? styles.optionActive : ''].join(' ')}
                  onClick={() => { if (!active) escolherVisao(v); }}
                >
                  <span className={styles.flag} aria-hidden="true"><Icone size={18} /></span>
                  <span className={styles.optionLabel}>{label}</span>
                  {active && (
                    <span className={styles.badge}><Check size={13} strokeWidth={2.6} />{t('settings.language.active')}</span>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {hasTela('ADMIN') && <StoneIntegracao onNotify={notify} />}
      </div>
      <Notification notification={notification} />
    </div>
  );
}
