import { useState } from 'react';
import { Eye, EyeOff, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import { authApi } from '../services/api';
import styles from './LoginPage.module.css';

export default function LoginPage({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Preencha usuário e senha.');
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
        role:         user.cargo?.descricao ?? 'Funcionário',
        cargo:        user.cargo,
        dataAdmissao: user.data_admissao,
        avatar:       null,
      });
    } catch (err) {
      if (err.status === 401 || err.status === 403) {
        setError('Usuário ou senha incorretos.');
      } else if (err.status === 0 || !err.status) {
        setError('Não foi possível conectar ao servidor. Tente novamente.');
      } else {
        setError(err.message || 'Erro ao fazer login. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>

      {/* ── IMMERSIVE STAGE ─────────────────────────────────────────── */}
      <aside className={styles.stage} aria-hidden="true">
        <div className={styles.photo} />
        <div className={styles.tint} />
        <div className={styles.sun} />
        <div className={styles.grain} />

        <div className={styles.stageTop}>
          <span className={styles.badge}>
            <span className={styles.badgeDot} />
            Estabelecido · Litoral
          </span>
        </div>

        <div className={styles.stageBody}>
          <span className={styles.kicker}>Sistema de Gestão Hoteleira</span>
          <h2 className={styles.wordmark}>
            Isto é<br /><em>Pousada</em>.
          </h2>
          <p className={styles.lede}>
            Onde cada reserva vira uma estadia, e cada estadia, uma história
            à beira-mar.
          </p>
        </div>

        <ul className={styles.features}>
          <li><span className={styles.featNum}>01</span> Reservas &amp; pernoites num só calendário</li>
          <li><span className={styles.featNum}>02</span> Financeiro, vouchers e orçamentos</li>
          <li><span className={styles.featNum}>03</span> Recepção em tempo real</li>
        </ul>
      </aside>

      {/* ── FORM ────────────────────────────────────────────────────── */}
      <main className={styles.panel}>
        <div className={styles.panelInner}>

          <header className={styles.brand}>
            <span className={styles.monogram}>ip</span>
            <span className={styles.brandText}>Isto é Pousada</span>
          </header>

          <div className={styles.intro}>
            <h1 className={styles.title}>Bem-vindo de volta</h1>
            <p className={styles.sub}>Entre para gerenciar a operação da pousada.</p>
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
              <label className={styles.label} htmlFor="username">Usuário</label>
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
              <label className={styles.label} htmlFor="password">Senha</label>
              <span className={styles.underline} />
              <button
                type="button"
                className={styles.eye}
                onClick={() => setShowPass(v => !v)}
                aria-label={showPass ? 'Ocultar senha' : 'Mostrar senha'}
                tabIndex={-1}
              >
                {showPass ? <Eye size={16} /> : <EyeOff size={16} />}
              </button>
            </div>

            <div className={styles.forgotRow}>
              <button type="button" className={styles.forgot}>Esqueceu a senha?</button>
            </div>

            <button className={styles.submit} disabled={loading} type="submit">
              <span className={styles.submitLabel}>
                {loading ? 'Entrando' : 'Entrar'}
              </span>
              {loading
                ? <Loader2 size={17} className={styles.spinner} />
                : <ArrowRight size={17} className={styles.submitArrow} />}
            </button>
          </form>

          <footer className={styles.legal}>
            Isto é Pousada © {new Date().getFullYear()} · Painel interno
          </footer>
        </div>
      </main>
    </div>
  );
}
