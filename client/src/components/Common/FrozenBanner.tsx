import { useEffect, useState } from 'react';
import { Snowflake } from 'lucide-react';

interface FrozenBannerProps {
  freezeUntil: number;  // unix timestamp (seconds)
  reason?: string | null;
}

function formatCountdown(secondsLeft: number): string {
  if (secondsLeft <= 0) return 'скоро...';
  const d = Math.floor(secondsLeft / 86400);
  const h = Math.floor((secondsLeft % 86400) / 3600);
  const m = Math.floor((secondsLeft % 3600) / 60);
  const s = secondsLeft % 60;
  if (d > 0) return `${d}д ${h}ч ${m}м`;
  if (h > 0) return `${h}ч ${m}м ${s}с`;
  if (m > 0) return `${m}м ${s}с`;
  return `${s}с`;
}

export function FrozenBanner({ freezeUntil, reason }: FrozenBannerProps) {
  const [secondsLeft, setSecondsLeft] = useState(() =>
    Math.max(0, freezeUntil - Math.floor(Date.now() / 1000))
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsLeft(Math.max(0, freezeUntil - Math.floor(Date.now() / 1000)));
    }, 1000);
    return () => clearInterval(interval);
  }, [freezeUntil]);

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-cyan-950/80 border-b-2 border-cyan-600/60 flex-shrink-0 z-30">
      <Snowflake className="w-5 h-5 text-cyan-400 flex-shrink-0 animate-spin" style={{ animationDuration: '3s' }} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-cyan-300">
          Аккаунт заморожен — отправка сообщений запрещена
        </p>
        {reason && (
          <p className="text-xs text-cyan-500 mt-0.5 truncate">Причина: {reason}</p>
        )}
      </div>
      <div className="flex-shrink-0 text-right">
        <p className="text-xs text-cyan-500 mb-0.5">Разморозка через</p>
        <p className="text-sm font-mono font-bold text-cyan-300">{formatCountdown(secondsLeft)}</p>
      </div>
    </div>
  );
}
