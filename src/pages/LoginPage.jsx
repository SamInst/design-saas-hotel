import { useEffect, useState } from 'react';
import { Eye, EyeOff, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { authApi } from '../services/api';
import styles from './LoginPage.module.css';

// Fotos 4K (Unsplash) do carrossel de fundo — ordem = ordem de exibição.
const SLIDES = Object.values(
  import.meta.glob('../assets/login/*.jpg', { eager: true, import: 'default' })
);
const SLIDE_MS = 7000;

const SLIDES_READY = Promise.all(SLIDES.map(src => {
  const img = new Image();
  img.src = src;
  return img.decode().catch(() => {});
}));

// "+" da marca: duas barras arredondadas em gradiente dourado→terra,
// com um brilho no cruzamento — lê como "mais" e como uma estrela/cruz de guia.
function PlusMark({ className }) {
  return (
    <svg className={className} viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <linearGradient id="plusGold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0"    stopColor="#f6d9a8" />
          <stop offset="0.45" stopColor="#e3ac6b" />
          <stop offset="1"    stopColor="#c25a36" />
        </linearGradient>
        <radialGradient id="plusGlow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#fff6e6" stopOpacity="0.95" />
          <stop offset="1" stopColor="#fff6e6" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect x="39" y="8"  width="22" height="84" rx="11" fill="url(#plusGold)" />
      <rect x="8"  y="39" width="84" height="22" rx="11" fill="url(#plusGold)" />
      <circle cx="50" cy="50" r="17" fill="url(#plusGlow)" />
    </svg>
  );
}

export default function LoginPage({ onLogin }) {
  const { t } = useTranslation();
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
    const t = setInterval(() => setSlide(i => (i + 1) % SLIDES.length), SLIDE_MS);
    return () => clearInterval(t);
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
        setError(t('login.errors.invalid'));
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
    <div className={styles.page}>

      {/* ── BACKGROUND CAROUSEL ─────────────────────────────────────── */}
      <div className={styles.carousel} aria-hidden="true">
        {SLIDES.map((src, i) => (
          <div
            key={src}
            className={`${styles.slide} ${i === slide ? styles.slideActive : ''}`}
            style={{ backgroundImage: `url(${src})` }}
          />
        ))}
        <div className={styles.shade} />
        <div className={styles.grain} />
      </div>

      {/* ── IMMERSIVE STAGE ─────────────────────────────────────────── */}
      <aside className={styles.stage} aria-hidden="true">
        <div className={styles.stageBody}>
          <span className={styles.kicker}>{t('login.kicker')}</span>
          <h2 className={styles.wordmark}>
            <PlusMark className={styles.plus} /><em>hospedagem</em>
          </h2>
          <p className={styles.features}>{t('login.features')}</p>
          <div className={styles.dots}>
            {SLIDES.map((src, i) => (
              <span
                key={src}
                className={`${styles.dot} ${i === slide && ready ? styles.dotActive : ''}`}
                style={i === slide ? { animationDuration: `${SLIDE_MS}ms` } : undefined}
              />
            ))}
          </div>
          {/*<p className={styles.lede}>*/}
          {/*  Onde cada reserva vira uma estadia, e cada estadia, uma história*/}
          {/*  à beira-mar.*/}
          {/*</p>*/}
        </div>
      </aside>

      {/* ── FORM ────────────────────────────────────────────────────── */}
      <main className={styles.panel}>
        <div className={styles.glass}>
          <span className={styles.glassSheen} aria-hidden="true" />
          <div className={styles.panelInner}>

          <div className={styles.intro}>
            <h1 className={styles.title}>{t('login.welcome')}</h1>
            {/*<p className={styles.sub}>Entre para gerenciar a operação da hospedagem.</p>*/}
          </div>

          <form onSubmit={handleSubmit} className={styles.form} noValidate>

            {error && (
              <div className={styles.error} role="alert">
                <AlertCircle size={15} strokeWidth={2.2} />
                <span>{error}</span>
              </div>
            )}

            <div className={styles.field}>
              <input
                id="username"
                className={styles.input}
                type="text"
                autoComplete="username"
                placeholder=" "
                value={username}
                onChange={(e) => { setUsername(e.target.value); setError(''); }}
                disabled={loading}
                required
              />
              <label className={styles.label} htmlFor="username">{t('login.username')}</label>
              <span className={styles.underline} />
            </div>

            <div className={styles.field}>
              <input
                id="password"
                className={styles.input}
                type={showPass ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder=" "
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(''); }}
                disabled={loading}
                required
              />
              <label className={styles.label} htmlFor="password">{t('login.password')}</label>
              <span className={styles.underline} />
              <button
                type="button"
                className={styles.eye}
                onClick={() => setShowPass(v => !v)}
                aria-label={showPass ? t('login.hidePassword') : t('login.showPassword')}
                tabIndex={-1}
              >
                {showPass ? <Eye size={16} /> : <EyeOff size={16} />}
              </button>
            </div>

            <div className={styles.forgotRow}>
              <button type="button" className={styles.forgot}>{t('login.forgot')}</button>
            </div>

            <button className={styles.submit} disabled={loading} type="submit">
              <span className={styles.submitLabel}>
                {loading ? t('login.submitting') : t('login.submit')}
              </span>
              {loading
                ? <Loader2 size={17} className={styles.spinner} />
                : <ArrowRight size={17} className={styles.submitArrow} />}
            </button>
          </form>

          <footer className={styles.legal}>
            +hospedagem © {new Date().getFullYear()} · {t('login.footer')}
          </footer>
          </div>
        </div>
      </main>
    </div>
  );
}
