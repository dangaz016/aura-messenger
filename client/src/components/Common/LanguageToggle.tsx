import { Globe } from 'lucide-react';
import { useT } from '../../contexts/LanguageContext';

interface LanguageToggleProps {
  floating?: boolean;
}

export function LanguageToggle({ floating = false }: LanguageToggleProps) {
  const { lang, toggle } = useT();

  const baseClasses = 'flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-aura-surface2/80 hover:bg-aura-elevated border border-aura-border hover:border-aura-primary/50 backdrop-blur-md transition-colors text-sm font-medium';
  const positionClasses = floating ? 'fixed top-4 right-4 z-50 shadow-lg' : '';

  return (
    <button
      onClick={toggle}
      className={`${baseClasses} ${positionClasses}`}
      title={lang === 'en' ? 'Switch to Russian' : 'Переключить на английский'}
    >
      <Globe className="w-4 h-4 text-aura-primary-light" />
      <span className="text-aura-text">{lang === 'en' ? 'EN' : 'RU'}</span>
      <span className="text-aura-text-muted text-xs">/{lang === 'en' ? 'RU' : 'EN'}</span>
    </button>
  );
}
