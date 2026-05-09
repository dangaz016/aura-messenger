import { getInitials } from '../../utils/formatters';
import { AuraMode } from '../../types';

interface AvatarProps {
  name: string;
  color: string;
  size?: number;
  isOnline?: boolean;
  auraMode?: AuraMode;
  emoji?: string;
  showStatus?: boolean;
  imageUrl?: string | null;
  isPrime?: boolean;
  primeTheme?: string;
  primeAnimatedAvatar?: boolean;
}

// Prime theme → gradient colors for animated border
const PRIME_GRADIENTS: Record<string, string> = {
  default:  'from-violet-500 via-fuchsia-500 to-pink-500',
  midnight: 'from-slate-400 via-violet-500 to-indigo-400',
  cosmos:   'from-indigo-400 via-purple-500 to-blue-400',
  aurora:   'from-teal-400 via-cyan-400 to-emerald-400',
  rose:     'from-rose-400 via-pink-400 to-fuchsia-400',
  ocean:    'from-sky-400 via-blue-400 to-cyan-400',
  sakura:   'from-pink-400 via-fuchsia-400 to-rose-300',
};

export function Avatar({
  name, color, size = 40, isOnline = false, auraMode, emoji,
  showStatus = true, imageUrl, isPrime = false, primeTheme = 'default', primeAnimatedAvatar = false,
}: AvatarProps) {
  const fontSize = size * 0.38;
  const statusSize = Math.max(10, size * 0.28);
  const gradient = PRIME_GRADIENTS[primeTheme] || PRIME_GRADIENTS.default;

  const statusColor = !isOnline ? '#6b7280'
    : auraMode === 'ghost' ? '#f59e0b'
    : auraMode === 'dnd' ? '#ef4444'
    : '#22c55e';

  const avatarContent = imageUrl ? (
    <img
      src={imageUrl}
      alt={name}
      className="rounded-full object-cover w-full h-full shadow-md"
      style={{ width: size, height: size }}
      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
    />
  ) : (
    <div
      className="rounded-full flex items-center justify-center font-semibold text-white shadow-md"
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, ${color} 0%, ${color}cc 100%)`,
        fontSize,
      }}
    >
      {emoji ? <span style={{ fontSize: size * 0.5 }}>{emoji}</span> : getInitials(name)}
    </div>
  );

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      {isPrime ? (
        // Prime animated gradient border wrapper
        <div
          className={`rounded-full p-[2px] bg-gradient-to-br ${gradient} ${primeAnimatedAvatar ? 'animate-spin-slow' : ''}`}
          style={{ width: size + 4, height: size + 4, margin: '-2px' }}
        >
          <div className="rounded-full overflow-hidden bg-aura-bg" style={{ width: size, height: size }}>
            {avatarContent}
          </div>
        </div>
      ) : (
        avatarContent
      )}
      {showStatus && (
        <div
          className="absolute bottom-0 right-0 rounded-full border-2 border-aura-bg"
          style={{ width: statusSize, height: statusSize, backgroundColor: statusColor }}
        />
      )}
    </div>
  );
}
