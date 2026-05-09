import { useState, useEffect, useRef } from 'react';
import { Shield, Sparkles, Zap, Lock, RefreshCw, CheckCircle, Loader, GripHorizontal } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useT } from '../../contexts/LanguageContext';
import { TranslationKey } from '../../i18n/translations';
import { GoogleSignIn } from './GoogleSignIn';
import { TelegramSignIn, TelegramIcon } from './TelegramSignIn';
import { api } from '../../services/api';
import { BehaviorTracker } from '../../utils/botDetection';

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

// ── Drag-Slider CAPTCHA ───────────────────────────────────────────────────────
interface SliderCaptchaProps {
  onVerified: () => void;
}

function SliderCaptcha({ onVerified }: SliderCaptchaProps) {
  const [progress, setProgress] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [verified, setVerified] = useState(false);
  const [failed, setFailed] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const startX = useRef(0);

  const THRESHOLD = 92; // % of track to slide

  function onPointerDown(e: React.PointerEvent) {
    if (verified) return;
    setDragging(true);
    setFailed(false);
    startX.current = e.clientX;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragging || verified) return;
    const track = trackRef.current;
    if (!track) return;
    const trackWidth = track.getBoundingClientRect().width;
    const thumbWidth = 52;
    const maxMove = trackWidth - thumbWidth;
    const moved = Math.max(0, Math.min(e.clientX - startX.current, maxMove));
    setProgress((moved / maxMove) * 100);
  }

  function onPointerUp() {
    if (!dragging || verified) return;
    setDragging(false);
    if (progress >= THRESHOLD) {
      setVerified(true);
      setTimeout(onVerified, 300);
    } else {
      setFailed(true);
      setProgress(0);
      setTimeout(() => setFailed(false), 1000);
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-aura-text-muted uppercase tracking-widest font-semibold">
        Потяните вправо для подтверждения
      </p>
      <div
        ref={trackRef}
        className={`relative h-13 rounded-xl overflow-hidden border-2 transition-colors select-none ${
          verified ? 'border-green-500 bg-green-500/10' :
          failed ? 'border-red-500 bg-red-500/10' :
          'border-aura-border bg-aura-elevated'
        }`}
        style={{ height: '52px' }}
      >
        {/* Fill */}
        <div
          className={`absolute inset-y-0 left-0 transition-all ${
            verified ? 'bg-green-500/30' : failed ? 'bg-red-500/20' : 'bg-aura-primary/20'
          }`}
          style={{ width: `${progress}%` }}
        />
        {/* Text */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className={`text-sm font-medium transition-colors ${
            verified ? 'text-green-400' : 'text-aura-text-muted'
          }`}>
            {verified ? '✓ Подтверждено' : failed ? 'Тяните до конца' : '→ Потяните вправо'}
          </span>
        </div>
        {/* Thumb */}
        {!verified && (
          <div
            className={`absolute top-1 bottom-1 w-12 rounded-lg flex items-center justify-center cursor-grab active:cursor-grabbing transition-colors shadow-lg ${
              failed ? 'bg-red-500' : 'bg-aura-primary hover:bg-aura-primary-light'
            }`}
            style={{ left: `calc(${progress}% * (1 - 52px / 100%))`, transition: dragging ? 'none' : 'left 0.2s' }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
          >
            <GripHorizontal className="w-5 h-5 text-white" />
          </div>
        )}
        {verified && (
          <div className="absolute inset-0 flex items-center justify-center">
            <CheckCircle className="w-6 h-6 text-green-400" />
          </div>
        )}
      </div>
    </div>
  );
}

// ── PoW Status Badge ──────────────────────────────────────────────────────────
interface PowStatusProps {
  state: 'idle' | 'mining' | 'done' | 'error';
  attempts: number;
}

function PowStatus({ state, attempts }: PowStatusProps) {
  if (state === 'idle') return null;
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium border ${
      state === 'mining' ? 'bg-aura-primary/10 border-aura-primary/30 text-aura-primary-light' :
      state === 'done' ? 'bg-green-500/10 border-green-500/30 text-green-400' :
      'bg-red-500/10 border-red-500/30 text-red-400'
    }`}>
      {state === 'mining' && <Loader className="w-3.5 h-3.5 animate-spin flex-shrink-0" />}
      {state === 'done' && <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />}
      {state === 'mining' && (
        <span>Верификация... {attempts > 0 ? `${(attempts / 1000).toFixed(0)}K попыток` : ''}</span>
      )}
      {state === 'done' && <span>Верификация пройдена ✓</span>}
      {state === 'error' && <span>Ошибка верификации — обновите страницу</span>}
    </div>
  );
}

// ── Main Login Page ───────────────────────────────────────────────────────────
export function LoginPage() {
  const { login, register, loginWithToken } = useAuth();
  const { t } = useT();
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Telegram
  const [tgBotUsername, setTgBotUsername] = useState<string | null>(null);
  const [showTgWidget, setShowTgWidget] = useState(false);

  useEffect(() => {
    api.telegramStatus().then(s => {
      if (s.available && s.botToken) {
        // Extract bot username from env or use placeholder — server only confirms it's configured
        // We need to store TELEGRAM_BOT_USERNAME in env for the widget
        const botUser = (window as unknown as Record<string, unknown>).__TELEGRAM_BOT_USERNAME__ as string
          || import.meta.env.VITE_TELEGRAM_BOT_USERNAME as string
          || null;
        setTgBotUsername(botUser);
      }
    }).catch(() => {});
  }, []);

  // Math CAPTCHA
  const [captchaId, setCaptchaId] = useState('');
  const [captchaQuestion, setCaptchaQuestion] = useState('');
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [captchaLoading, setCaptchaLoading] = useState(false);

  // Drag-slider CAPTCHA
  const [sliderDone, setSliderDone] = useState(false);

  // Behaviour tracking
  const behaviorRef = useRef<BehaviorTracker | null>(null);
  const formShownAt = useRef<number>(0);

  async function fetchCaptcha() {
    setCaptchaLoading(true);
    setCaptchaAnswer('');
    try {
      const { id, question } = await api.getCaptcha();
      setCaptchaId(id);
      setCaptchaQuestion(question);
    } catch {
      setCaptchaQuestion('');
    } finally {
      setCaptchaLoading(false);
    }
  }


  useEffect(() => {
    if (isRegister) {
      formShownAt.current = Date.now();
      behaviorRef.current = new BehaviorTracker();
      fetchCaptcha();
    } else {
      behaviorRef.current?.detach();
      behaviorRef.current = null;
      setSliderDone(false);
    }
    return () => {
      behaviorRef.current?.detach();
    };
  }, [isRegister]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const cleanUsername = username.replace(/^@+/, '').trim();
      if (isRegister) {
        // Final checks before submit
        if (!sliderDone) {
          setError('Пожалуйста, пройдите проверку слайдера');
          setLoading(false);
          return;
        }
        const behavior = behaviorRef.current?.collect();
        const timeOnPage = Date.now() - formShownAt.current;

        await register(
          cleanUsername, password, displayName || undefined,
          captchaId || undefined, captchaAnswer || undefined,
          behavior?.score, timeOnPage,
        );
      } else {
        await login(cleanUsername, password);
      }
    } catch (err: unknown) {
      const errorMsg = err && typeof err === 'object' && 'response' in err
        ? (err.response as { data?: { error?: string } })?.data?.error
        : null;
      const mapped = mapServerError(errorMsg || '');
      setError(mapped ? t(mapped) : (errorMsg || t('login.error_generic')));
      if (isRegister) {
        fetchCaptcha();
        setSliderDone(false);
      }
    } finally {
      setLoading(false);
    }
  }

  const allVerified = sliderDone;

  return (
    <div className="min-h-screen gradient-bg flex items-center justify-center p-4">
      {/* Honeypot CSS — make this invisible via CSS so humans can't see it but bots fill it */}
      <style>{`
        .hp-field { position: absolute; left: -9999px; opacity: 0; pointer-events: none; tab-index: -1; }
        @keyframes autofill-detect { from {} to {} }
        input:-webkit-autofill { animation-name: autofill-detect; }
      `}</style>

      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl gradient-aura glow-primary mb-4">
            <Sparkles className="w-10 h-10 text-white" strokeWidth={2.5} />
          </div>
          <h1 className="text-5xl font-bold mb-2 bg-gradient-to-r from-aura-primary-light to-aura-primary bg-clip-text text-transparent">
            Aura
          </h1>
          <p className="text-aura-text-dim text-sm">{t('app.tagline')}</p>
        </div>

        <div className="card p-8 shadow-2xl">
          <h2 className="text-xl font-semibold mb-1">
            {isRegister ? t('login.create_title') : t('login.welcome_back')}
          </h2>
          <p className="text-aura-text-dim text-sm mb-6">
            {isRegister ? t('login.create_subtitle') : t('login.signin_subtitle')}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Honeypot field — hidden from humans, bots fill it */}
            <div className="hp-field" aria-hidden="true">
              <input
                type="text"
                name="website"
                tabIndex={-1}
                autoComplete="off"
                style={{ display: 'none' }}
              />
            </div>

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
                minLength={isRegister ? 8 : 1}
              />
              {isRegister && (
                <div className="text-xs text-aura-text-muted mt-1">Минимум 8 символов</div>
              )}
            </div>

            {/* ── Registration-only verification ── */}
            {isRegister && (
              <div className="space-y-4 pt-2 border-t border-aura-border">
                <p className="text-xs text-aura-text-dim uppercase tracking-widest font-semibold flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5" /> Защита от ботов
                </p>

                {/* Math CAPTCHA */}
                <div>
                  <label className="block text-xs font-medium text-aura-text-dim mb-1.5 uppercase tracking-wide">
                    Решите пример
                  </label>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex-1 px-4 py-2.5 rounded-xl bg-aura-elevated border border-aura-border text-base font-mono font-bold tracking-widest select-none text-center">
                      {captchaLoading ? '...' : captchaQuestion || ''}
                    </div>
                    <button
                      type="button"
                      onClick={fetchCaptcha}
                      disabled={captchaLoading}
                      className="p-2.5 rounded-xl bg-aura-elevated border border-aura-border text-aura-text-dim hover:text-aura-primary-light transition-colors disabled:opacity-40"
                      title="Новый пример"
                    >
                      <RefreshCw className={`w-4 h-4 ${captchaLoading ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={captchaAnswer}
                    onChange={(e) => setCaptchaAnswer(e.target.value)}
                    className="input-aura w-full"
                    placeholder="Ваш ответ"
                    required
                    autoComplete="off"
                  />
                </div>

                {/* Slider CAPTCHA */}
                <SliderCaptcha onVerified={() => setSliderDone(true)} />

                {/* Verification progress summary */}
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Пример', done: !!captchaAnswer && captchaAnswer.length > 0 },
                    { label: 'Слайдер', done: sliderDone },
                  ].map(item => (
                    <div key={item.label} className={`px-2 py-1.5 rounded-lg text-center text-xs border transition-colors ${
                      item.done
                        ? 'bg-green-500/10 border-green-500/30 text-green-400'
                        : 'bg-aura-elevated border-aura-border text-aura-text-muted'
                    }`}>
                      {item.done ? '✓ ' : '○ '}{item.label}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {error && (
              <div className="px-3 py-2 rounded-lg bg-aura-dnd/10 border border-aura-dnd/30 text-aura-dnd text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || (isRegister && !allVerified)}
              className="btn-primary w-full py-3 text-base disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading
                ? t('login.loading')
                : isRegister
                  ? (allVerified ? t('login.create_button') : 'Завершите проверку...')
                  : t('login.signin_button')
              }
            </button>
          </form>

          <GoogleSignIn />

          {/* Telegram Sign In */}
          {tgBotUsername && (
            <div className="mt-3">
              {showTgWidget ? (
                <TelegramSignIn
                  botUsername={tgBotUsername}
                  onSuccess={async ({ token, user }) => {
                    if (token) {
                      await loginWithToken(token, user);
                    }
                  }}
                  onError={(err) => setError(err)}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setShowTgWidget(true)}
                  className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl border border-[#2AABEE]/40 bg-[#2AABEE]/10 hover:bg-[#2AABEE]/20 transition-colors text-sm font-medium text-[#2AABEE]"
                >
                  <TelegramIcon className="w-5 h-5 flex-shrink-0" />
                  Войти через Telegram
                </button>
              )}
            </div>
          )}

          <div className="mt-6 text-center text-sm">
            <span className="text-aura-text-dim">
              {isRegister ? t('login.have_aura') : t('login.new_here')}
            </span>
            <button
              type="button"
              onClick={() => { setIsRegister(!isRegister); setError(''); }}
              className="text-aura-primary-light hover:underline font-medium ml-1"
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
