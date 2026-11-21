import { useEffect, useId, useState } from 'react';
import { Eye, EyeOff, AlertCircle, KeyRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { authApi } from '../services/api';
import { AnimatedSpinner } from '../components/ui/AnimatedSpinner';
import styles from './LoginPage.module.css';

const SLIDES = Object.values(
  import.meta.glob('../assets/login/*.jpg', { eager: true, import: 'default' })
);
const SLIDE_MS = 7000;

const SLIDES_READY = Promise.all(SLIDES.map(src => {
  const img = new Image();
  img.src = src;
  return img.decode().catch(() => {});
}));

function PlusMark({ className }) {
  return (
    <svg className={className} viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <linearGradient id="plusGold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0"    stopColor="#f6d9a8" />
          <stop offset="0.45" stopColor="#e3ac6b" />
          <stop offset="1"    stopColor="#c25a36" />
        </linearGradient>
      </defs>
      <rect x="39" y="8"  width="22" height="84" rx="11" fill="url(#plusGold)" />
      <rect x="8"  y="39" width="84" height="22" rx="11" fill="url(#plusGold)" />
    </svg>
  );
}

export default function LoginPage({ onLogin }) {
  const { t } = useTranslation();
  const id = useId();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [slide,    setSlide]    = useState(0);
  const [ready,    setReady]    = useState(false);

  useEffect(() => {
    let alive = true;
    SLIDES_READY.then(() => { if (alive) setReady(true); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!ready) return;
    const timer = setInterval(() => setSlide(i => (i + 1) % SLIDES.length), SLIDE_MS);
    return () => clearInterval(timer);
  }, [ready]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError(t('login.errors.required'));
      return;
    }

    setError('');
    setLoading(true);

    try {
      const { user } = await authApi.login(username.trim(), password);
      onLogin({
        id:           user.id,
        usuarioId:    user.usuario?.id,
        pessoaId:     user.pessoa?.id,
        name:         user.pessoa?.nome,
        username:     user.usuario?.username,
        email:        user.pessoa?.email,
        role:         user.cargo?.descricao ?? t('login.defaultRole'),
        cargo:        user.cargo,
        dataAdmissao: user.data_admissao,
        avatar:       null,
      });
    } catch (err) {
      if (err.status === 401 || err.status === 403) {
        setError(err.message && !/credenciais/i.test(err.message) ? err.message : t('login.errors.invalid'));
      } else if (err.status === 0 || !err.status) {
        setError(t('login.errors.network'));
      } else {
        setError(err.message || t('login.errors.generic'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className={styles.page} aria-label={t('login.submit')}>
      <section className={styles.formSide}>
        <div className={`${styles.formWrap} ${loading ? styles.isLoading : ''}`} aria-busy={loading}>
          <div className={styles.collapse}>
          <div className={styles.collapseInner}>
          <div className={styles.head}>
            <div className={styles.badge}>
              <span className={styles.badgeGlow} aria-hidden="true" />
              <span className={styles.badgeCore}>
                <KeyRound size={22} strokeWidth={1.8} aria-hidden="true" />
              </span>
            </div>
            <h1 className={styles.title}>{t('login.welcome')}</h1>
            <p className={styles.sub}>{t('login.subtitle')}</p>
          </div>

          <form onSubmit={handleSubmit} className={styles.form} noValidate>
            {error && (
              <div className={styles.error} role="alert">
                <AlertCircle size={15} strokeWidth={2.2} />
                <span>{error}</span>
              </div>
            )}

            <div className={styles.field}>
              <label className={styles.label} htmlFor={`${id}-user`}>{t('login.username')}</label>
              <input
                id={`${id}-user`}
                className={styles.input}
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => { setUsername(e.target.value); setError(''); }}
                disabled={loading}
                required
              />
            </div>

            <div className={styles.field}>
              <div className={styles.labelRow}>
                <label className={styles.label} htmlFor={`${id}-pass`}>{t('login.password')}</label>
                <button type="button" className={styles.link}>{t('login.forgot')}</button>
              </div>
              <div className={styles.inputGroup}>
                <input
                  id={`${id}-pass`}
                  className={styles.input}
                  type={showPass ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••••"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(''); }}
                  disabled={loading}
                  required
                />
                <button
                  type="button"
                  className={styles.eye}
                  onClick={() => setShowPass(v => !v)}
                  aria-label={showPass ? t('login.hidePassword') : t('login.showPassword')}
                >
                  {showPass ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                </button>
              </div>
            </div>

            <button className={styles.submit} disabled={loading} type="submit">
              <span>{loading ? t('login.submitting') : t('login.submit')}</span>
            </button>
          </form>

          <footer className={styles.legal}>
            +hospedagem © {new Date().getFullYear()} · {t('login.footer')}
          </footer>
          </div>
          </div>

          <div className={styles.loader}>
            <div className={styles.loaderInner}>
              <AnimatedSpinner size="7rem" lineWidth="0.9rem" />
            </div>
          </div>
        </div>
      </section>

      <aside className={styles.visual} aria-hidden="true">
        {SLIDES.map((src, i) => (
          <div
            key={src}
            className={`${styles.slide} ${i === slide ? styles.slideActive : ''}`}
            style={{ backgroundImage: `url(${src})` }}
          />
        ))}
        <div className={styles.shade} />

        <div className={styles.visualBody}>
          <p className={styles.wordmark}>
            <PlusMark className={styles.plus} /><span>hospedagem</span>
          </p>
          <p className={styles.kicker}>{t('login.kicker')}</p>
        </div>
      </aside>
    </main>
  );
}
