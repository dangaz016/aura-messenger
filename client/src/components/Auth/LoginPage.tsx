import { useState } from 'react';
import { Shield, Sparkles, Zap, Lock } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useT } from '../../contexts/LanguageContext';
import { TranslationKey } from '../../i18n/translations';
import { GoogleSignIn } from './GoogleSignIn';

// Map server error messages to translation keys
function mapServerError(message: string): TranslationKey | null {
  if (!message) return null;
  const m = message.toLowerCase();
  if (m.includes('username already')) return 'login.error_username_taken';
  if (m.includes('username must be')) return 'login.error_username_invalid';
  if (m.includes('password must')) return 'login.error_password_short';
  if (m.includes('invalid credentials')) return 'login.error_credentials';
  return null;
}

export function LoginPage() {
  const { login, register } = useAuth();
  const { t } = useT();
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      // Strip leading @ if user added it (we show @ as a prefix decoration)
      const cleanUsername = username.replace(/^@+/, '').trim();
      if (isRegister) {
        await register(cleanUsername, password, displayName || undefined);
      } else {
        await login(cleanUsername, password);
      }
    } catch (err: unknown) {
      const errorMsg = err && typeof err === 'object' && 'response' in err
        ? (err.response as { data?: { error?: string } })?.data?.error
        : null;
      const mapped = mapServerError(errorMsg || '');
      setError(mapped ? t(mapped) : (errorMsg || t('login.error_generic')));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen gradient-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl gradient-aura glow-primary mb-4">
            <Sparkles className="w-10 h-10 text-white" strokeWidth={2.5} />
          </div>
          <h1 className="text-5xl font-bold mb-2 bg-gradient-to-r from-aura-primary-light to-aura-primary bg-clip-text text-transparent">
            Aura
          </h1>
          <p className="text-aura-text-dim text-sm">
            {t('app.tagline')}
          </p>
        </div>

        <div className="card p-8 shadow-2xl">
          <h2 className="text-xl font-semibold mb-1">
            {isRegister ? t('login.create_title') : t('login.welcome_back')}
          </h2>
          <p className="text-aura-text-dim text-sm mb-6">
            {isRegister ? t('login.create_subtitle') : t('login.signin_subtitle')}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-aura-text-dim mb-1.5 uppercase tracking-wide">
                {t('login.username')}
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-aura-text-muted pointer-events-none select-none">@</span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.replace(/^@+/, ''))}
                  className="input-aura w-full pl-7"
                  placeholder={t('login.username_placeholder')}
                  autoComplete="username"
                  required
                  pattern="[a-zA-Z0-9_]{3,20}"
                  title={t('login.username_hint')}
                />
              </div>
              {isRegister && (
                <div className="text-xs text-aura-text-muted mt-1">{t('login.username_hint')}</div>
              )}
            </div>

            {isRegister && (
              <div>
                <label className="block text-xs font-medium text-aura-text-dim mb-1.5 uppercase tracking-wide">
                  {t('login.display_name')}
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="input-aura w-full"
                  placeholder={t('login.display_name_placeholder')}
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-aura-text-dim mb-1.5 uppercase tracking-wide">
                {t('login.password')}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-aura w-full"
                placeholder={t('login.password_placeholder')}
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                required
                minLength={6}
              />
            </div>

            {error && (
              <div className="px-3 py-2 rounded-lg bg-aura-dnd/10 border border-aura-dnd/30 text-aura-dnd text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3 text-base disabled:opacity-50"
            >
              {loading ? t('login.loading') : isRegister ? t('login.create_button') : t('login.signin_button')}
            </button>
          </form>

          <GoogleSignIn />

          <div className="mt-6 text-center text-sm">
            <span className="text-aura-text-dim">
              {isRegister ? t('login.have_aura') : t('login.new_here')}
            </span>
            <button
              type="button"
              onClick={() => { setIsRegister(!isRegister); setError(''); }}
              className="text-aura-primary-light hover:underline font-medium"
            >
              {isRegister ? t('login.signin_button') : t('login.create_button')}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mt-6">
          <Feature icon={<Shield className="w-4 h-4" />} text={t('login.feature_e2e')} />
          <Feature icon={<Lock className="w-4 h-4" />} text={t('login.feature_no_phone')} />
          <Feature icon={<Zap className="w-4 h-4" />} text={t('login.feature_fast')} />
        </div>
      </div>
    </div>
  );
}

function Feature({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="text-center px-2 py-3 rounded-lg bg-aura-surface/40 border border-aura-border/40">
      <div className="text-aura-primary-light mb-1 inline-flex">{icon}</div>
      <div className="text-xs text-aura-text-dim">{text}</div>
    </div>
  );
}
