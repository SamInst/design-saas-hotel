import TopBar from './TopBar';
import styles from './AppLayout.module.css';

export default function AppLayout({ children, currentPage, onNavigate, ...topBarProps }) {
  return (
    <div className={styles.shell}>
      <TopBar currentPage={currentPage} onNavigate={onNavigate} {...topBarProps} />

      {/* key: refaz a animação a cada troca de tela */}
      <main key={currentPage} className={styles.main}>
        {children}
      </main>
    </div>
  );
}
