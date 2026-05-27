import { useState } from 'react';
import { Phone, Video } from 'lucide-react';

interface CallButtonProps {
  userId: string;
  userName: string;
  onStartCall: (userId: string, userName: string, videoCall: boolean) => void;
}

export function CallButton({ userId, userName, onStartCall }: CallButtonProps) {
  const [showOptions, setShowOptions] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setShowOptions(!showOptions)}
        className="p-2 rounded-lg hover:bg-aura-surface2 transition-colors text-aura-text-dim hover:text-aura-primary"
        title="Позвонить"
      >
        <Phone className="w-5 h-5" />
      </button>

      {showOptions && (
        <div className="absolute bottom-full mb-2 right-0 bg-aura-elevated border border-aura-border rounded-xl p-1 flex flex-col gap-0.5 shadow-lg z-20 min-w-[120px]">
          <button
            onClick={() => { onStartCall(userId, userName, false); setShowOptions(false); }}
            className="flex items-center gap-3 text-sm px-3 py-2 rounded-lg hover:bg-aura-surface2 transition-colors text-left"
          >
            <Phone className="w-4 h-4 text-green-400 flex-shrink-0" />
            <span>Голосовой звонок</span>
          </button>
          <button
            onClick={() => { onStartCall(userId, userName, true); setShowOptions(false); }}
            className="flex items-center gap-3 text-sm px-3 py-2 rounded-lg hover:bg-aura-surface2 transition-colors text-left"
          >
            <Video className="w-4 h-4 text-blue-400 flex-shrink-0" />
            <span>Видео-звонок</span>
          </button>
        </div>
      )}
    </div>
  );
}
