import { useState } from 'react';
import { Crown, Sparkles, Check, RefreshCw, Link } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api';
import { Avatar } from '../Common/Avatar';
import { PRIME_THEMES, PRIME_BADGES, PrimePill } from '../Common/PrimeBadge';
import { TelegramSignIn, TelegramIcon } from '../Auth/TelegramSignIn';

export function AuraPrimePanel() {
  const { user, updateUser } = useAuth();
  const [saving, setSaving] = useState(false);
  const [showTgWidget, setShowTgWidget] = useState(false);
  const [tgError, setTgError] = useState('');
  const [tgSuccess, setTgSuccess] = useState(false);

  if (!user) return null;

  async function updateSetting(settings: { theme?: string; badge?: string; animatedAvatar?: boolean }) {
    if (!user?.isPrime) return;
    setSaving(true);
    try {
      const updated = await api.primeUpdateSettings(settings);
      updateUser(updated);
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  }

  const tgBotUsername = import.meta.env.VITE_TELEGRAM_BOT_USERNAME as string | undefined;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl p-5 bg-gradient-to-br from-violet-600/20 via-fuchsia-600/10 to-pink-600/20 border border-violet-500/30">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-fuchsia-500/5 animate-prime-glow pointer-events-none" />
        <div className="relative flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-violet-500/30 text-2xl">
            👑
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-lg font-bold bg-gradient-to-r from-violet-300 to-fuchsia-300 bg-clip-text text-transparent">
                Aura Prime
              </h2>
              {user.isPrime && <PrimePill user={user} />}
            </div>
            {user.isPrime ? (
              <p className="text-sm text-aura-text-dim">
                {user.primeExpiresAt
                  ? `Активна до ${new Date(user.primeExpiresAt * 1000).toLocaleDateString('ru-RU')}`
                  : 'Постоянная подписка'}
              </p>
            ) : (
              <p className="text-sm text-aura-text-dim">Разблокируй эксклюзивные возможности</p>
            )}
          </div>
        </div>
      </div>

      {!user.isPrime ? (
        /* Not Prime — show benefits */
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-aura-text-dim uppercase tracking-wider">Возможности Prime</h3>
          {[
            { icon: '🎨', title: 'Эксклюзивные темы', desc: '7 уникальных тем оформления: Полночь, Космос, Аврора и другие' },
            { icon: '👑', title: 'Значок Prime', desc: '6 вариантов значка: корона, звезда, бриллиант, огонь, молния, кристалл' },
            { icon: '✨', title: 'Анимированный аватар', desc: 'Красивая анимированная рамка вокруг аватара' },
            { icon: '📁', title: 'Файлы до 4 ГБ', desc: 'Отправляй файлы размером до 4 ГБ (обычно 50 МБ)' },
            { icon: '🌟', title: 'Эксклюзивные реакции', desc: 'Доступ к особым реакциям: 🌟💫💎👑🌈🦋🌙' },
            { icon: '🔗', title: 'Привязка Telegram', desc: 'Входи через Telegram — без пароля' },
          ].map(b => (
            <div key={b.title} className="flex items-start gap-3 p-3 rounded-xl bg-aura-surface2 border border-aura-border">
              <span className="text-xl flex-shrink-0">{b.icon}</span>
              <div>
                <div className="text-sm font-medium">{b.title}</div>
                <div className="text-xs text-aura-text-dim mt-0.5">{b.desc}</div>
              </div>
            </div>
          ))}
          <p className="text-xs text-aura-text-muted text-center pt-2">
            Обратитесь к администратору для получения Aura Prime
          </p>
        </div>
      ) : (
        /* Prime user — show settings */
        <div className="space-y-6">
          {/* Avatar preview */}
          <div className="flex items-center gap-4 p-4 rounded-xl bg-aura-surface2 border border-aura-border">
            <Avatar
              name={user.displayName}
              color={user.avatarColor}
              imageUrl={user.avatarUrl}
              size={56}
              isOnline={true}
              isPrime={true}
              primeTheme={user.primeTheme}
              primeAnimatedAvatar={user.primeAnimatedAvatar}
            />
            <div>
              <div className="font-semibold flex items-center gap-1">
                {user.displayName}
                <span>{user.primeBadge === 'crown' ? '👑' : user.primeBadge === 'star' ? '⭐' : user.primeBadge === 'diamond' ? '💎' : user.primeBadge === 'fire' ? '🔥' : user.primeBadge === 'lightning' ? '⚡' : '🔮'}</span>
              </div>
              <div className="text-xs text-aura-text-dim">@{user.username}</div>
            </div>
            {saving && <RefreshCw className="w-4 h-4 text-aura-primary animate-spin ml-auto" />}
          </div>

          {/* Theme selector */}
          <div>
            <h3 className="text-sm font-semibold text-aura-text-dim uppercase tracking-wider mb-3">Тема оформления</h3>
            <div className="grid grid-cols-2 gap-2">
              {PRIME_THEMES.map(theme => (
                <button
                  key={theme.id}
                  onClick={() => updateSetting({ theme: theme.id })}
                  disabled={saving}
                  className={`relative flex items-center gap-2.5 p-3 rounded-xl border transition-all ${
                    user.primeTheme === theme.id
                      ? 'border-aura-primary bg-aura-primary-dim'
                      : 'border-aura-border hover:border-aura-primary/50 hover:bg-aura-elevated'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg ${theme.preview} flex-shrink-0 border border-white/10`} />
                  <span className="text-sm font-medium">{theme.name}</span>
                  {user.primeTheme === theme.id && (
                    <Check className="w-4 h-4 text-aura-primary ml-auto flex-shrink-0" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Badge selector */}
          <div>
            <h3 className="text-sm font-semibold text-aura-text-dim uppercase tracking-wider mb-3">Значок рядом с именем</h3>
            <div className="grid grid-cols-3 gap-2">
              {PRIME_BADGES.map(badge => (
                <button
                  key={badge.id}
                  onClick={() => updateSetting({ badge: badge.id })}
                  disabled={saving}
                  className={`flex flex-col items-center gap-1 py-3 px-2 rounded-xl border transition-all ${
                    user.primeBadge === badge.id
                      ? 'border-aura-primary bg-aura-primary-dim'
                      : 'border-aura-border hover:border-aura-primary/50 hover:bg-aura-elevated'
                  }`}
                >
                  <span className="text-2xl">{badge.icon}</span>
                  <span className="text-xs text-aura-text-dim">{badge.name}</span>
                  {user.primeBadge === badge.id && (
                    <Check className="w-3 h-3 text-aura-primary" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Animated avatar toggle */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-aura-surface2 border border-aura-border">
            <div>
              <div className="text-sm font-medium flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-aura-primary-light" />
                Анимированная рамка аватара
              </div>
              <div className="text-xs text-aura-text-dim mt-0.5">Градиентная рамка вращается вокруг аватара</div>
            </div>
            <button
              onClick={() => updateSetting({ animatedAvatar: !user.primeAnimatedAvatar })}
              disabled={saving}
              className={`relative inline-flex w-12 h-6 rounded-full transition-colors ${
                user.primeAnimatedAvatar ? 'bg-aura-primary' : 'bg-aura-elevated'
              }`}
            >
              <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                user.primeAnimatedAvatar ? 'translate-x-7' : 'translate-x-1'
              }`} />
            </button>
          </div>

          {/* Prime reactions info */}
          <div className="p-4 rounded-xl bg-aura-surface2 border border-aura-border">
            <div className="text-sm font-medium mb-2 flex items-center gap-2">
              <Crown className="w-4 h-4 text-yellow-400" />
              Эксклюзивные реакции
            </div>
            <div className="flex flex-wrap gap-2">
              {['🌟', '💫', '🔥', '💎', '👑', '🌈', '✨', '🎭', '🦋', '🌙'].map(e => (
                <span key={e} className="text-2xl hover:scale-110 transition-transform cursor-default">{e}</span>
              ))}
            </div>
            <p className="text-xs text-aura-text-muted mt-2">Доступны в меню реакций на сообщения</p>
          </div>
        </div>
      )}

      {/* Telegram linking section */}
      <div className="border-t border-aura-border pt-5">
        <h3 className="text-sm font-semibold text-aura-text-dim uppercase tracking-wider mb-3 flex items-center gap-2">
          <TelegramIcon className="w-4 h-4 text-[#2AABEE]" />
          Telegram аккаунт
        </h3>

        {user.hasTelegram ? (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-[#2AABEE]/10 border border-[#2AABEE]/30">
            <TelegramIcon className="w-5 h-5 text-[#2AABEE]" />
            <div>
              <div className="text-sm font-medium text-[#2AABEE]">Telegram привязан</div>
              <div className="text-xs text-aura-text-dim">Ты можешь войти через Telegram</div>
            </div>
          </div>
        ) : tgBotUsername ? (
          <div>
            {tgError && (
              <div className="mb-2 text-xs text-aura-dnd px-3 py-2 rounded-lg bg-aura-dnd/10">{tgError}</div>
            )}
            {tgSuccess ? (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-green-500/10 border border-green-500/30 text-green-400 text-sm">
                <Check className="w-4 h-4" />
                Telegram успешно привязан!
              </div>
            ) : showTgWidget ? (
              <TelegramSignIn
                botUsername={tgBotUsername}
                mode="link"
                onSuccess={({ user: updated }) => {
                  updateUser(updated);
                  setTgSuccess(true);
                  setShowTgWidget(false);
                }}
                onError={(e) => { setTgError(e); setShowTgWidget(false); }}
              />
            ) : (
              <button
                onClick={() => { setShowTgWidget(true); setTgError(''); }}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-[#2AABEE]/40 bg-[#2AABEE]/10 hover:bg-[#2AABEE]/20 transition-colors text-sm font-medium text-[#2AABEE]"
              >
                <Link className="w-4 h-4" />
                Привязать Telegram аккаунт
              </button>
            )}
          </div>
        ) : (
          <p className="text-xs text-aura-text-muted">Telegram вход не настроен на этом сервере</p>
        )}
      </div>
    </div>
  );
}
