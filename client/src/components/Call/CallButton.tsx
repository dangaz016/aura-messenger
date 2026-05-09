import { Phone } from 'lucide-react';

interface CallButtonProps {
  userId: string;
  userName: string;
  onStartCall: (userId: string, userName: string) => void;
}

export function CallButton({ userId, userName, onStartCall }: CallButtonProps) {
  return (
    <button
      onClick={() => onStartCall(userId, userName)}
      className="p-2 rounded-lg hover:bg-aura-surface2 transition-colors text-aura-text-dim hover:text-aura-primary"
      title="Позвонить"
    >
      <Phone className="w-5 h-5" />
    </button>
  );
}
