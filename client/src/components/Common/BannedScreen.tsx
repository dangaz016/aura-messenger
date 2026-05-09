import { Ban } from 'lucide-react';

interface BannedScreenProps {
  reason?: string | null;
}

export function BannedScreen({ reason }: BannedScreenProps) {
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black select-none"
      style={{ backdropFilter: 'none' }}
      onContextMenu={e => e.preventDefault()}
    >
      {/* Red pulsing background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-red-700/20 blur-3xl animate-pulse" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] rounded-full bg-red-600/30 blur-2xl" />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-6 px-8 text-center max-w-md">
        {/* Icon */}
        <div className="w-28 h-28 rounded-full bg-red-600/20 border-2 border-red-500/50 flex items-center justify-center animate-pulse">
          <Ban className="w-14 h-14 text-red-400" strokeWidth={1.5} />
        </div>

        {/* Title */}
        <div>
          <h1 className="text-4xl font-black text-red-400 tracking-tight mb-2">
            Аккаунт заблокирован
          </h1>
          <p className="text-gray-400 text-lg">
            Ваш аккаунт был заблокирован администратором
          </p>
        </div>

        {/* Reason box */}
        {reason && (
          <div className="w-full bg-red-950/60 border border-red-700/50 rounded-2xl px-6 py-4">
            <p className="text-xs text-red-400 uppercase tracking-widest mb-1 font-semibold">Причина</p>
            <p className="text-white text-base font-medium">{reason}</p>
          </div>
        )}

        {/* Info */}
        <p className="text-gray-500 text-sm leading-relaxed">
          Если вы считаете, что это ошибка — обратитесь к администратору.
          Все действия в приложении заблокированы.
        </p>

        {/* Decorative lines */}
        <div className="w-full border-t border-red-900/40" />
        <p className="text-red-900 text-xs tracking-widest uppercase">AURA MESSENGER • ACCESS DENIED</p>
      </div>
    </div>
  );
}
