import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

export type Theme = 'dark' | 'midnight' | 'aurora';

const THEMES: Record<Theme, Record<string, string>> = {
  dark: {
    '--aura-bg': '#0d0d1a',
    '--aura-surface': '#13131f',
    '--aura-surface2': '#1a1a2e',
    '--aura-elevated': '#1e1e35',
    '--aura-border': '#2a2a44',
    '--aura-border-light': '#373760',
    '--aura-accent': '#7C3AED',
    '--aura-accent-light': '#A78BFA',
    '--aura-accent-dim': 'rgba(124, 58, 237, 0.15)',
  },
  midnight: {
    '--aura-bg': '#000000',
    '--aura-surface': '#0a0a14',
    '--aura-surface2': '#10101a',
    '--aura-elevated': '#16161f',
    '--aura-border': '#1f1f2e',
    '--aura-border-light': '#2a2a3e',
    '--aura-accent': '#A78BFA',
    '--aura-accent-light': '#C4B5FD',
    '--aura-accent-dim': 'rgba(167, 139, 250, 0.15)',
  },
  aurora: {
    '--aura-bg': '#0a1a1f',
    '--aura-surface': '#0f2128',
    '--aura-surface2': '#162a33',
    '--aura-elevated': '#1d3540',
    '--aura-border': '#2a4858',
    '--aura-border-light': '#3a6070',
    '--aura-accent': '#06B6D4',
    '--aura-accent-light': '#22D3EE',
    '--aura-accent-dim': 'rgba(6, 182, 212, 0.15)',
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
