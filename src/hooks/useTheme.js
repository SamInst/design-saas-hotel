import { useEffect, useState } from 'react';

const STORAGE_KEY = 'theme'; // 'light' | 'dark' | 'neon'
const MODOS = ['light', 'dark', 'neon'];

export function useTheme() {
  const [mode, setMode] = useState(() => {
    const salvo = localStorage.getItem(STORAGE_KEY);
    return MODOS.includes(salvo) ? salvo : 'light';
  });

  useEffect(() => {
    const raiz = document.documentElement;
    raiz.setAttribute('data-theme', mode === 'light' ? 'light' : 'dark');
    if (mode === 'dark') raiz.setAttribute('data-tone', 'grafite');
    else if (mode === 'neon') raiz.setAttribute('data-tone', 'neon');
    else raiz.removeAttribute('data-tone');
    localStorage.setItem(STORAGE_KEY, mode);
  }, [mode]);

  const isDark = mode !== 'light';
  const toggleTheme = () => setMode((m) => (m === 'light' ? 'dark' : 'light'));

  return { mode, setMode, isDark, toggleTheme };
}
