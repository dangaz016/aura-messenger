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
}

export function Avatar({ name, color, size = 40, isOnline = false, auraMode, emoji, showStatus = true, imageUrl }: AvatarProps) {
  const fontSize = size * 0.38;
  const statusSize = Math.max(10, size * 0.28);

  const statusColor = !isOnline ? '#6b7280'
    : auraMode === 'ghost' ? '#f59e0b'
    : auraMode === 'dnd' ? '#ef4444'
    : '#22c55e';

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      {imageUrl ? (
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
