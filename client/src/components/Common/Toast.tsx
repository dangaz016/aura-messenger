import { useEffect, useState, useCallback } from 'react';
import { X, CheckCircle, AlertCircle, Info, MessageCircle } from 'lucide-react';
import { ToastItem, useToast } from '../../contexts/ToastContext';

function ToastCard({ toast, onRemove }: { toast: ToastItem; onRemove: () => void }) {
  const [exiting, setExiting] = useState(false);

  function handleClose() {
    setExiting(true);
    setTimeout(onRemove, 300);
  }

  useEffect(() => {
    const t = setTimeout(() => {
      setExiting(true);
      setTimeout(onRemove, 300);
    }, 4200);
    return () => clearTimeout(t);
  }, [onRemove]);

  const icons = {
    success: <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />,
    error: <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />,
    info: <Info className="w-5 h-5 text-blue-400 flex-shrink-0" />,
    message: <MessageCircle className="w-5 h-5 text-aura-primary-light flex-shrink-0" />,
  };

  const borders = {
    success: 'border-green-500/30',
    error: 'border-red-500/30',
    info: 'border-blue-500/30',
    message: 'border-aura-primary/30',
  };

  const glows = {
    success: 'shadow-green-500/10',
    error: 'shadow-red-500/10',
    info: 'shadow-blue-500/10',
    message: 'shadow-aura-primary/20',
  };

  return (
    <div
      className={`
        flex items-start gap-3 px-4 py-3 rounded-xl
        bg-aura-elevated/95 backdrop-blur-md
        border ${borders[toast.type]}
        shadow-xl ${glows[toast.type]}
        max-w-sm w-full
        transition-all duration-300
        ${exiting ? 'opacity-0 translate-x-4 scale-95' : 'opacity-100 translate-x-0 scale-100'}
      `}
    >
      {toast.type === 'message' && toast.avatarColor ? (
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
          style={{ background: `linear-gradient(135deg, ${toast.avatarColor} 0%, ${toast.avatarColor}cc 100%)` }}
        >
          {(toast.title || '?')[0].toUpperCase()}
        </div>
      ) : (
        icons[toast.type]
      )}

      <div className="flex-1 min-w-0">
        {toast.title && (
          <div className="font-semibold text-sm truncate">{toast.title}</div>
        )}
        <div className="text-xs text-aura-text-dim truncate">{toast.message}</div>
      </div>

      <button
        onClick={handleClose}
        className="p-0.5 rounded hover:bg-aura-surface2 text-aura-text-muted hover:text-aura-text transition-colors flex-shrink-0"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export function ToastContainer() {
  const { toasts, removeToast, showToast } = useToast();

  // Listen for new message events dispatched by ChatContext
  useEffect(() => {
    const handler = (e: Event) => {
      const msg = (e as CustomEvent).detail as {
        senderName: string;
        content: string;
        senderAvatarColor: string;
        type: string;
      };
      const preview = msg.type === 'image' ? '🖼 Фото'
        : msg.type === 'file' ? '📎 Файл'
        : msg.type === 'voice' ? '🎤 Голосовое'
        : msg.content?.slice(0, 60) || '…';
      showToast(preview, 'message', msg.senderName, msg.senderAvatarColor);
    };
    window.addEventListener('aura:newMessage', handler);
    return () => window.removeEventListener('aura:newMessage', handler);
  }, [showToast]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[200] flex flex-col gap-2 pointer-events-none max-w-[320px] w-full">
      {toasts.map(toast => (
        <div key={toast.id} className="pointer-events-auto">
          <ToastCard toast={toast} onRemove={() => removeToast(toast.id)} />
        </div>
      ))}
    </div>
  );
}
