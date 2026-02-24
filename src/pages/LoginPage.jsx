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
  const [focused,  setFocused]  = useState(null);

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

      // Monta o objeto de sessão que o App.jsx vai usar
      onLogin({
        id:          user.id,
        usuarioId:   user.usuarioId,
        pessoaId:    user.pessoaId,
        name:        user.nome,          // nome completo
        username:    user.username,
        email:       user.email,
        role:        user.cargo?.nome ?? 'Funcionário',
        cargo:       user.cargo,         // { id, nome, telas[] }
        dataAdmissao: user.dataAdmissao,
        avatar:      null,
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

      {/* ── LEFT PANEL ── */}
      <div className={styles.left}>
        <div className={styles.leftInner}>
          <div className={styles.orbs}>
            <div className={styles.orb1} />
            <div className={styles.orb2} />
            <div className={styles.orb3} />
          </div>

          <div className={styles.leftContent}>
            <div className={styles.logoMark}>
              <img src="/images/hotel-system-logo.svg" alt="Hotel System" className={styles.logoSvg} />
            </div>

            <div className={styles.leftText}>
              <h2 className={styles.leftHeading}>Bem-vindo de volta</h2>
              <p className={styles.leftDesc}>
                Gerencie reservas, finanças e operações do hotel em um só lugar.
              </p>
            </div>

            <div className={styles.stats}>
              <div className={styles.stat}>
                <span className={styles.statNum}>22</span>
                <span className={styles.statLabel}>Quartos</span>
              </div>
              <div className={styles.statDivider} />
              <div className={styles.stat}>
                <span className={styles.statNum}>98%</span>
                <span className={styles.statLabel}>Ocupação</span>
              </div>
              <div className={styles.statDivider} />
              <div className={styles.stat}>
                <span className={styles.statNum}>4.9</span>
                <span className={styles.statLabel}>Avaliação</span>
              </div>
            </div>
          </div>

          <div className={styles.leftGrid} aria-hidden="true">
            {Array.from({ length: 48 }).map((_, i) => (
              <div key={i} className={styles.gridCell} />
            ))}
          </div>
        </div>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div className={styles.right}>
        <div className={styles.formWrap}>

          <div className={styles.formHeader}>
            <div className={styles.logoSmall}>
              <img src="/images/hotel-system-logo.svg" alt="" className={styles.logoSvgSm} />
            </div>
            <div>
              <h1 className={styles.formTitle}>Hotel System</h1>
              <p className={styles.formSub}>Acesso ao painel de gestão</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className={styles.form} noValidate>

            {/* Error banner */}
            {error && (
              <div className={styles.errorBanner}>
                <AlertCircle size={15} />
                <span>{error}</span>
              </div>
            )}

            {/* Username */}
            <div className={`${styles.fieldGroup} ${focused === 'user' ? styles.active : ''} ${error ? styles.hasError : ''}`}>
              <label className={styles.fieldLabel} htmlFor="username">Usuário</label>
              <div className={styles.inputWrap}>
                <input
                  id="username"
                  className={styles.input}
                  type="text"
                  autoComplete="username"
                  placeholder="seu.usuario"
                  value={username}
                  onChange={(e) => { setUsername(e.target.value); setError(''); }}
                  onFocus={() => setFocused('user')}
                  onBlur={() => setFocused(null)}
                  disabled={loading}
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div className={`${styles.fieldGroup} ${focused === 'pass' ? styles.active : ''} ${error ? styles.hasError : ''}`}>
              <label className={styles.fieldLabel} htmlFor="password">Senha</label>
              <div className={styles.inputWrap}>
                <input
                  id="password"
                  className={`${styles.input} ${styles.inputPass}`}
                  type={showPass ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(''); }}
                  onFocus={() => setFocused('pass')}
                  onBlur={() => setFocused(null)}
                  disabled={loading}
                  required
                />
                <button
                  type="button"
                  className={styles.eyeBtn}
                  onClick={() => setShowPass(v => !v)}
                  aria-label={showPass ? 'Ocultar senha' : 'Mostrar senha'}
                  tabIndex={-1}
                >
                  {showPass ? <Eye size={15} /> : <EyeOff size={15} />}
                </button>
              </div>
            </div>

            <div className={styles.forgotRow}>
              <button type="button" className={styles.forgotBtn}>
                Esqueceu a senha?
              </button>
            </div>

            <button className={styles.submit} disabled={loading} type="submit">
              {loading ? (
                <>
                  <Loader2 size={16} className={styles.spinner} />
                  Entrando…
                </>
              ) : (
                <>
                  Entrar
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          <p className={styles.copyright}>Hotel System © {new Date().getFullYear()}</p>
        </div>
      </div>
    </div>
  );
}