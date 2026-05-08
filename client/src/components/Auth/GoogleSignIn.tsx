import { useEffect, useRef, useState } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useT } from '../../contexts/LanguageContext';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            ux_mode?: 'popup' | 'redirect';
            auto_select?: boolean;
          }) => void;
          renderButton: (
            element: HTMLElement,
            options: {
              theme?: 'outline' | 'filled_blue' | 'filled_black';
              size?: 'large' | 'medium' | 'small';
              text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
              width?: number;
              shape?: 'rectangular' | 'pill';
              logo_alignment?: 'left' | 'center';
            }
          ) => void;
          prompt: () => void;
        };
      };
    };
  }
}

export function GoogleSignIn() {
  const { updateUser } = useAuth();
  const { lang } = useT();
  const [clientId, setClientId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const buttonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.googleStatus().then(s => {
      if (s.available && s.clientId) setClientId(s.clientId);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!clientId) return;

    // Load Google Identity Services script if not present
    if (!document.querySelector('#google-identity-script')) {
      const script = document.createElement('script');
      script.id = 'google-identity-script';
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
      script.onload = () => initGoogle();
    } else {
      initGoogle();
    }

    function initGoogle() {
      if (!window.google || !buttonRef.current) {
        setTimeout(initGoogle, 200);
        return;
      }
      window.google.accounts.id.initialize({
        client_id: clientId!,
        callback: async (response) => {
          try {
            setError('');
            const { user } = await api.googleSignIn(response.credential);
            updateUser(user);
            window.location.reload();
          } catch (err: unknown) {
            const msg = err && typeof err === 'object' && 'response' in err
              ? (err.response as { data?: { error?: string } })?.data?.error
              : null;
            setError(msg || 'Sign-in failed');
          }
        },
        ux_mode: 'popup',
      });

      window.google.accounts.id.renderButton(buttonRef.current, {
        theme: 'filled_black',
        size: 'large',
        shape: 'pill',
        text: 'continue_with',
        logo_alignment: 'left',
        width: 320,
      });
    }
  }, [clientId, lang]);

  if (!clientId) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 my-3">
        <div className="flex-1 h-px bg-aura-border" />
        <span className="text-xs text-aura-text-muted">{lang === 'ru' ? 'или' : 'or'}</span>
        <div className="flex-1 h-px bg-aura-border" />
      </div>
      <div ref={buttonRef} className="flex justify-center" />
      {error && (
        <div className="text-xs text-aura-dnd text-center">{error}</div>
      )}
    </div>
  );
}
