import { useEffect, useState } from 'react';

const STORAGE_KEY = 'theme'; // 'light' | 'dark'

export function useTheme() {
  const [mode, setMode] = useState(() => {
    return localStorage.getItem(STORAGE_KEY) || 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', mode);
    localStorage.setItem(STORAGE_KEY, mode);
  }, [mode]);

  const isDark = mode === 'dark';
  const toggleTheme = () => setMode((m) => (m === 'dark' ? 'light' : 'dark'));

  return { mode, setMode, isDark, toggleTheme };
}
