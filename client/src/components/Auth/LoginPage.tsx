import { useState } from 'react';
import { Shield, Sparkles, Zap, Lock } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export function LoginPage() {
  const { login, register } = useAuth();
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
      if (isRegister) {
        await register(username, password, displayName || undefined);
      } else {
        await login(username, password);
      }
    } catch (err: unknown) {
      const errorMsg = err && typeof err === 'object' && 'response' in err
        ? (err.response as { data?: { error?: string } })?.data?.error
        : null;
      setError(errorMsg || 'Something went wrong');
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
            Your space. Your rules. Your aura.
          </p>
        </div>

        <div className="card p-8 shadow-2xl">
          <h2 className="text-xl font-semibold mb-1">
            {isRegister ? 'Create your aura' : 'Welcome back'}
          </h2>
          <p className="text-aura-text-dim text-sm mb-6">
            {isRegister ? 'Start chatting privately in seconds' : 'Sign in to continue'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-aura-text-dim mb-1.5 uppercase tracking-wide">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="input-aura w-full"
                placeholder="@yourname"
                autoComplete="username"
                required
              />
            </div>

            {isRegister && (
              <div>
                <label className="block text-xs font-medium text-aura-text-dim mb-1.5 uppercase tracking-wide">
                  Display name (optional)
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="input-aura w-full"
                  placeholder="How you want to appear"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-aura-text-dim mb-1.5 uppercase tracking-wide">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-aura w-full"
                placeholder="••••••••"
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                required
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
              {loading ? 'Loading...' : isRegister ? 'Create account' : 'Sign in'}
            </button>
          </form>

          <div className="mt-6 text-center text-sm">
            <span className="text-aura-text-dim">
              {isRegister ? 'Already have an aura? ' : 'New here? '}
            </span>
            <button
              type="button"
              onClick={() => { setIsRegister(!isRegister); setError(''); }}
              className="text-aura-primary-light hover:underline font-medium"
            >
              {isRegister ? 'Sign in' : 'Create account'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mt-6">
          <Feature icon={<Shield className="w-4 h-4" />} text="E2E Encrypted" />
          <Feature icon={<Lock className="w-4 h-4" />} text="No phone needed" />
          <Feature icon={<Zap className="w-4 h-4" />} text="Lightning fast" />
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
