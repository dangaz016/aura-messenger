import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

export type Theme = 'dark' | 'midnight' | 'aurora';

const THEMES: Record<Theme, Record<string, string>> = {
  dark: {
    '--bg': '#0d0d1a',
    '--surface': '#13131f',
    '--surface2': '#1a1a2e',
    '--elevated': '#1e1e35',
    '--border': '#2a2a44',
    '--accent': '#7C3AED',
  },
  midnight: {
    '--bg': '#000000',
    '--surface': '#0a0a14',
    '--surface2': '#10101a',
    '--elevated': '#16161f',
    '--border': '#1f1f2e',
    '--accent': '#A78BFA',
  },
  aurora: {
    '--bg': '#0a1a1f',
    '--surface': '#0f2128',
    '--surface2': '#162a33',
    '--elevated': '#1d3540',
    '--border': '#2a4858',
    '--accent': '#06B6D4',
  },
};

interface ThemeContextValue {
  theme: Theme;
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    return (localStorage.getItem('aura_theme') as Theme) || 'dark';
  });

  useEffect(() => {
    const vars = THEMES[theme];
    Object.entries(vars).forEach(([k, v]) => document.documentElement.style.setProperty(k, v));
    localStorage.setItem('aura_theme', theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme: setThemeState }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
