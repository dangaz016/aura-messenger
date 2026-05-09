import { User } from '../../types';

export type BadgeStyle = 'crown' | 'star' | 'diamond' | 'fire' | 'lightning' | 'crystal';

const BADGE_ICONS: Record<BadgeStyle, string> = {
  crown: '👑',
  star: '⭐',
  diamond: '💎',
  fire: '🔥',
  lightning: '⚡',
  crystal: '🔮',
};

interface PrimeBadgeProps {
  user: User;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function PrimeBadge({ user, size = 'sm', className = '' }: PrimeBadgeProps) {
  if (!user.isPrime) return null;

  const badge = (user.primeBadge || 'crown') as BadgeStyle;
  const icon = BADGE_ICONS[badge] || '👑';

  const sizeClass = size === 'sm' ? 'text-xs' : size === 'md' ? 'text-sm' : 'text-base';

  return (
    <span
      className={`inline-flex items-center ${sizeClass} ${className}`}
      title="Aura Prime"
      aria-label="Aura Prime"
    >
      {icon}
    </span>
  );
}

// Renders display name with Prime badge inline
export function DisplayNameWithBadge({ user, className = '' }: { user: User; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <span>{user.displayName}</span>
      {user.isPrime && <PrimeBadge user={user} size="sm" />}
    </span>
  );
}

// Prime label pill for profiles
export function PrimePill({ user }: { user: User }) {
  if (!user.isPrime) return null;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-gradient-to-r from-violet-600 to-fuchsia-500 text-white shadow-sm">
      👑 Aura Prime
    </span>
  );
}

export const PRIME_THEMES = [
  { id: 'default', name: 'По умолчанию', preview: 'bg-aura-bg' },
  { id: 'midnight', name: 'Полночь', preview: 'bg-gradient-to-br from-slate-900 to-violet-950' },
  { id: 'cosmos', name: 'Космос', preview: 'bg-gradient-to-br from-indigo-950 to-purple-900' },
  { id: 'aurora', name: 'Аврора', preview: 'bg-gradient-to-br from-teal-900 to-cyan-950' },
  { id: 'rose', name: 'Роза', preview: 'bg-gradient-to-br from-rose-900 to-pink-950' },
  { id: 'ocean', name: 'Океан', preview: 'bg-gradient-to-br from-sky-900 to-blue-950' },
  { id: 'sakura', name: 'Сакура', preview: 'bg-gradient-to-br from-pink-900 to-fuchsia-950' },
] as const;

export const PRIME_BADGES = [
  { id: 'crown', icon: '👑', name: 'Корона' },
  { id: 'star', icon: '⭐', name: 'Звезда' },
  { id: 'diamond', icon: '💎', name: 'Бриллиант' },
  { id: 'fire', icon: '🔥', name: 'Огонь' },
  { id: 'lightning', icon: '⚡', name: 'Молния' },
  { id: 'crystal', icon: '🔮', name: 'Кристалл' },
] as const;

// Prime exclusive reactions
export const PRIME_REACTIONS = ['🌟', '💫', '🔥', '💎', '👑', '🌈', '✨', '🎭', '🦋', '🌙'];
