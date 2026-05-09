import { useEffect, useRef, useState } from 'react';
import { api } from '../../services/api';
import { User } from '../../types';

interface TelegramSignInProps {
  botUsername: string;
  onSuccess: (data: { token: string; user: User }) => void;
  onError?: (err: string) => void;
  mode?: 'login' | 'link'; // link = attach to existing account
}

declare global {
  interface Window {
    TelegramLoginWidget?: {
      dataOnauth: (user: TelegramAuthData) => void;
    };
    onTelegramAuth?: (user: TelegramAuthData) => void;
  }
}

interface TelegramAuthData {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

export function TelegramSignIn({ botUsername, onSuccess, onError, mode = 'login' }: TelegramSignInProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    // Clean up previous widget
    containerRef.current.innerHTML = '';

    // Global callback that Telegram widget will call
    window.onTelegramAuth = async (tgData: TelegramAuthData) => {
      setLoading(true);
      try {
        const payload: Record<string, string | number> = {
          id: tgData.id,
          auth_date: tgData.auth_date,
          hash: tgData.hash,
        };
        if (tgData.first_name) payload.first_name = tgData.first_name;
        if (tgData.last_name) payload.last_name = tgData.last_name;
        if (tgData.username) payload.username = tgData.username;
        if (tgData.photo_url) payload.photo_url = tgData.photo_url;

        if (mode === 'link') {
          const result = await api.telegramLink(payload);
          onSuccess({ token: '', user: result.user });
        } else {
          const result = await api.telegramSignIn(payload);
          onSuccess(result);
        }
      } catch (err: unknown) {
        const msg = err && typeof err === 'object' && 'response' in err
          ? (err.response as { data?: { error?: string } })?.data?.error
          : null;
        onError?.(msg || 'Telegram sign-in failed');
      } finally {
        setLoading(false);
      }
    };

    // Inject Telegram Login Widget script
    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.setAttribute('data-telegram-login', botUsername);
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-onauth', 'onTelegramAuth(user)');
    script.setAttribute('data-request-access', 'write');
    script.async = true;
    containerRef.current.appendChild(script);

    return () => {
      delete window.onTelegramAuth;
    };
  }, [botUsername, mode]);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#2AABEE]/10 border border-[#2AABEE]/30 text-sm text-[#2AABEE]">
        <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>
        Подключаем Telegram...
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div ref={containerRef} className="telegram-widget-container" />
    </div>
  );
}

// ── Fake Telegram button for when widget hasn't loaded ─────────────────────────
export function TelegramButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl border border-[#2AABEE]/40 bg-[#2AABEE]/10 hover:bg-[#2AABEE]/20 transition-colors text-sm font-medium text-[#2AABEE]"
    >
      <TelegramIcon className="w-5 h-5 flex-shrink-0" />
      Войти через Telegram
    </button>
  );
}

export function TelegramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.248l-1.97 9.289c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.833.932z"/>
    </svg>
  );
}
