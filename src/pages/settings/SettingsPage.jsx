import { useState } from 'react';
import { Languages, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LANGUAGES } from '../../i18n';
import { usePermissions } from '../../hooks/usePermissions';
import { Notification } from '../../components/ui/Notification';
import StoneIntegracao from './StoneIntegracao';
import styles from './SettingsPage.module.css';

export default function SettingsPage() {
  const { t, i18n } = useTranslation();
  const current = i18n.resolvedLanguage;
  const { hasTela } = usePermissions();
  const [notification, setNotification] = useState(null);

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

        {hasTela('ADMIN') && <StoneIntegracao onNotify={notify} />}
      </div>
      <Notification notification={notification} />
    </div>
  );
}
