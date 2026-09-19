import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import TopBar from './TopBar';
import styles from './AppLayout.module.css';

export default function AppLayout({ children, currentPage, onNavigate, ...topBarProps }) {
  // Troca de tela: as páginas montam e só então buscam os próprios dados, então
  // fica um intervalo de tela vazia. O overlay cobre esse intervalo — entra na
  // hora da troca e sai no quadro seguinte à montagem da nova tela.
  const [navigating, setNavigating] = useState(false);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    setNavigating(true);
    let timer;
    const frame = requestAnimationFrame(() => {
      timer = setTimeout(() => setNavigating(false), 280);
    });
    return () => { cancelAnimationFrame(frame); clearTimeout(timer); };
  }, [currentPage]);

  return (
    <div className={styles.shell}>
      <TopBar currentPage={currentPage} onNavigate={onNavigate} {...topBarProps} />

      {/* key: refaz a animação a cada troca de tela */}
      <main key={currentPage} className={styles.main}>
        {children}

        {navigating && (
          <div className={styles.navLoading} role="status" aria-live="polite">
            <Loader2 size={26} className={styles.navSpinner} />
            <span>Carregando...</span>
          </div>
        )}
      </main>
    </div>
  );
}
