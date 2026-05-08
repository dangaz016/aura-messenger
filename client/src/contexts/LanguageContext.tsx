import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { Lang, TranslationKey, translations } from '../i18n/translations';

interface LanguageContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  toggle: () => void;
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

function detectInitialLang(): Lang {
  const saved = localStorage.getItem('aura_lang');
  if (saved === 'ru' || saved === 'en') return saved;
  // Detect browser preference
  const browserLang = (navigator.language || 'en').toLowerCase();
  if (browserLang.startsWith('ru') || browserLang.startsWith('uk') || browserLang.startsWith('be') || browserLang.startsWith('kk')) {
    return 'ru';
  }
  return 'en';
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detectInitialLang);

  useEffect(() => {
    localStorage.setItem('aura_lang', lang);
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((l: Lang) => setLangState(l), []);
  const toggle = useCallback(() => setLangState(l => (l === 'en' ? 'ru' : 'en')), []);

  const t = useCallback((key: TranslationKey): string => {
    const entry = translations[key];
    if (!entry) return key;
    return entry[lang] || entry.en || key;
  }, [lang]);

  return (
    <LanguageContext.Provider value={{ lang, setLang, toggle, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useT() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useT must be used within LanguageProvider');
  return ctx;
}
