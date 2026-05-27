import { Phone, PhoneOff, Video, VideoOff } from 'lucide-react';
import { Avatar } from '../Common/Avatar';

interface IncomingCallModalProps {
  callerName: string;
  callerId: string;
  hasVideo: boolean;
  onAccept: (videoCall: boolean) => void;
  onDecline: () => void;
}

export function IncomingCallModal({ callerName, callerId, hasVideo, onAccept, onDecline }: IncomingCallModalProps) {
  return (
    <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center animate-fade-in">
      <div className="text-center">
        {/* Pulsing ring animation */}
        <div className="relative mx-auto mb-8">
          <div className="absolute inset-0 w-32 h-32 rounded-full bg-aura-primary/20 animate-ping" />
          <div className="absolute inset-0 w-32 h-32 rounded-full bg-aura-primary/30 animate-pulse" />
          <div className="relative">
            <Avatar name={callerName} color="#7C3AED" size={128} />
          </div>
        </div>

        {/* Caller info */}
        <h2 className="text-3xl font-semibold text-white mb-2">{callerName}</h2>
        <p className="text-aura-text-dim text-lg mb-2">
          {hasVideo ? 'Входящий видео-звонок...' : 'Входящий звонок...'}
        </p>
        {hasVideo && (
          <p className="text-aura-text-dim/80 text-sm mb-8">Звонок с видео</p>
        )}

        {/* Action buttons */}
        <div className="flex items-center justify-center gap-8">
          {/* Decline */}
          <button
            onClick={onDecline}
            className="group flex flex-col items-center gap-3"
          >
            <div className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 transition-all flex items-center justify-center group-hover:scale-110 shadow-lg shadow-red-500/50">
              <PhoneOff className="w-7 h-7 text-white" />
            </div>
            <span className="text-sm text-aura-text-dim">Отклонить</span>
          </button>

          {/* Accept */}
          <button
            onClick={() => onAccept(hasVideo)}
            className="group flex flex-col items-center gap-3"
          >
            <div className="w-16 h-16 rounded-full bg-green-500 hover:bg-green-600 transition-all flex items-center justify-center group-hover:scale-110 shadow-lg shadow-green-500/50 animate-pulse">
              {hasVideo ? <Video className="w-7 h-7 text-white" /> : <Phone className="w-7 h-7 text-white" />}
            </div>
            <span className="text-sm text-aura-text-dim">Принять</span>
          </button>
        </div>
      </div>
    </div>
  );
}
