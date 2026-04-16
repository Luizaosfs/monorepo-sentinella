import { type ReactNode, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

const getStoredTheme = (): Theme => {
  if (typeof window === 'undefined') return 'light';
  const stored = localStorage.getItem('theme');
  return stored === 'dark' ? 'dark' : 'light';
};

const applyTheme = (theme: Theme) => {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.remove('light', 'dark');
  root.classList.add(theme);
};

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  useEffect(() => {
    applyTheme(getStoredTheme());
  }, []);

  return <>{children}</>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useTheme = () => {
  const [theme, setThemeState] = useState<Theme>(getStoredTheme);

  useEffect(() => {
    applyTheme(theme);
    if (typeof window !== 'undefined') {
      localStorage.setItem('theme', theme);
      window.dispatchEvent(new CustomEvent<Theme>('app-theme-change', { detail: theme }));
    }
  }, [theme]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleThemeChange = (event: Event) => {
      const nextTheme = (event as CustomEvent<Theme>).detail;
      if (nextTheme === 'light' || nextTheme === 'dark') {
        setThemeState(nextTheme);
      }
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === 'theme') {
        setThemeState(getStoredTheme());
      }
    };

    window.addEventListener('app-theme-change', handleThemeChange as EventListener);
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener('app-theme-change', handleThemeChange as EventListener);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const setTheme = (nextTheme: Theme) => setThemeState(nextTheme);
  const toggleTheme = () => setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'));

  return { theme, setTheme, toggleTheme };
};
