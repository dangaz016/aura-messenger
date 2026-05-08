import { useState, useEffect } from 'react';
import { X, LogOut, Palette, ShieldCheck, Eye, EyeOff, BellOff, Check, Moon, Sparkles, Waves, Bell } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useChat } from '../../contexts/ChatContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useT } from '../../contexts/LanguageContext';
import { TranslationKey } from '../../i18n/translations';
import { Avatar } from '../Common/Avatar';
import { api } from '../../services/api';
import { AuraMode } from '../../types';
import { requestNotificationPermission } from '../../utils/notifications';

const COLORS = [
  '#7C3AED', '#A78BFA', '#EC4899', '#F472B6',
  '#3B82F6', '#06B6D4', '#10B981', '#F59E0B',
  '#EF4444', '#8B5CF6', '#14B8A6', '#F97316',
];

const MOOD_PRESETS: { emoji: string; key: TranslationKey }[] = [
  { emoji: '👋', key: 'mood.available' },
  { emoji: '💭', key: 'mood.thinking' },
  { emoji: '☕', key: 'mood.coffee' },
  { emoji: '💻', key: 'mood.working' },
  { emoji: '🎮', key: 'mood.gaming' },
  { emoji: '🎵', key: 'mood.music' },
  { emoji: '🛌', key: 'mood.sleeping' },
  { emoji: '🌴', key: 'mood.vacation' },
  { emoji: '📚', key: 'mood.studying' },
  { emoji: '🎬', key: 'mood.movie' },
];

interface SettingsPanelProps {
  onClose: () => void;
}

export function SettingsPanel({ onClose }: SettingsPanelProps) {
  const { user, updateUser, logout } = useAuth();
  const { updateAuraMode } = useChat();
  const { theme, setTheme } = useTheme();
  const { t } = useT();
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [moodEmoji, setMoodEmoji] = useState(user?.moodEmoji || '👋');
  const [moodText, setMoodText] = useState(user?.moodText || 'Available');
  const [color, setColor] = useState(user?.avatarColor || '#7C3AED');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  if (!user) return null;

  async function handleSave() {
    setSaving(true);
    try {
      const updated = await api.updateProfile({ displayName, moodEmoji, moodText, avatarColor: color });
      updateUser(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } finally {
      setSaving(false);
    }
  }

  async function handleAuraMode(mode: AuraMode) {
    await updateAuraMode(mode);
  }

  async function handleRequestNotifications() {
    const permission = await requestNotificationPermission();
    setNotificationPermission(permission);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center p-0 lg:p-4 overflow-y-auto animate-fade-in">
      <div className="card w-full max-w-full lg:max-w-2xl my-0 lg:my-8 min-h-full lg:min-h-0 lg:rounded-2xl rounded-none animate-slide-up">
        <div className="flex items-center justify-between p-6 border-b border-aura-border">
          <h2 className="text-2xl font-bold">{t('settings.title')}</h2>
          <button onClick={onClose} className="p-2 hover:bg-aura-elevated rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-8">
          {/* Profile */}
          <Section title={t('settings.section_profile')} icon={<Sparkles className="w-4 h-4" />}>
            <div className="flex items-start gap-4">
              <Avatar name={displayName} color={color} size={80} emoji={moodEmoji} showStatus={false} />
              <div className="flex-1 space-y-3">
                <div>
                  <Label>{t('settings.display_name')}</Label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="input-aura w-full"
                    maxLength={40}
                  />
                </div>
                <div>
                  <Label>{t('settings.username_readonly')}</Label>
                  <input value={`@${user.username}`} readOnly className="input-aura w-full opacity-60" />
                </div>
              </div>
            </div>

            <div className="mt-4">
              <Label>{t('settings.avatar_color')}</Label>
              <div className="flex flex-wrap gap-2">
                {COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className={`w-9 h-9 rounded-full transition-all ${color === c ? 'ring-2 ring-aura-text scale-110' : 'hover:scale-105'}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </Section>

          {/* Mood */}
          <Section title={t('settings.section_mood')} icon={<Sparkles className="w-4 h-4" />}>
            <div className="flex items-center gap-2 mb-3">
              <input
                type="text"
                value={moodEmoji}
                onChange={(e) => setMoodEmoji(e.target.value)}
                className="input-aura w-16 text-center text-2xl"
                maxLength={4}
              />
              <input
                type="text"
                value={moodText}
                onChange={(e) => setMoodText(e.target.value)}
                placeholder={t('settings.mood_placeholder')}
                className="input-aura flex-1"
                maxLength={50}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              {MOOD_PRESETS.map(m => (
                <button
                  key={m.key}
                  onClick={() => { setMoodEmoji(m.emoji); setMoodText(t(m.key)); }}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-aura-surface2 hover:bg-aura-elevated text-sm text-left"
                >
                  <span className="text-lg">{m.emoji}</span>
                  <span className="truncate">{t(m.key)}</span>
                </button>
              ))}
            </div>
          </Section>

          {/* Aura Mode */}
          <Section title={t('settings.section_aura')} icon={<ShieldCheck className="w-4 h-4" />}>
            <p className="text-xs text-aura-text-dim mb-3">
              {t('settings.aura_subtitle')}
            </p>
            <div className="space-y-2">
              <ModeOption
                active={user.auraMode === 'available'}
                onClick={() => handleAuraMode('available')}
                icon={<Eye className="w-5 h-5 text-aura-online" />}
                title={t('settings.mode_available')}
                desc={t('settings.mode_available_desc')}
              />
              <ModeOption
                active={user.auraMode === 'ghost'}
                onClick={() => handleAuraMode('ghost')}
                icon={<EyeOff className="w-5 h-5 text-aura-ghost" />}
                title={t('settings.mode_ghost')}
                desc={t('settings.mode_ghost_desc')}
              />
              <ModeOption
                active={user.auraMode === 'dnd'}
                onClick={() => handleAuraMode('dnd')}
                icon={<BellOff className="w-5 h-5 text-aura-dnd" />}
                title={t('settings.mode_dnd')}
                desc={t('settings.mode_dnd_desc')}
              />
            </div>
          </Section>

          {/* Theme */}
          <Section title={t('settings.section_theme')} icon={<Palette className="w-4 h-4" />}>
            <div className="grid grid-cols-3 gap-2">
              <ThemeOption active={theme === 'dark'} onClick={() => setTheme('dark')}
                icon={<Moon className="w-5 h-5" />} label={t('settings.theme_dark')} gradient="from-[#7C3AED] to-[#0d0d1a]" />
              <ThemeOption active={theme === 'midnight'} onClick={() => setTheme('midnight')}
                icon={<Sparkles className="w-5 h-5" />} label={t('settings.theme_midnight')} gradient="from-[#A78BFA] to-[#000000]" />
              <ThemeOption active={theme === 'aurora'} onClick={() => setTheme('aurora')}
                icon={<Waves className="w-5 h-5" />} label={t('settings.theme_aurora')} gradient="from-[#06B6D4] to-[#0a1a1f]" />
            </div>
          </Section>

          {/* Privacy */}
          <Section title={t('settings.section_privacy')} icon={<ShieldCheck className="w-4 h-4" />}>
            <div className="space-y-2 text-sm text-aura-text-dim">
              <div className="flex items-center gap-2"><Check className="w-4 h-4 text-aura-online" />{t('settings.privacy_e2e')}</div>
              <div className="flex items-center gap-2"><Check className="w-4 h-4 text-aura-online" />{t('settings.privacy_keys')}</div>
              <div className="flex items-center gap-2"><Check className="w-4 h-4 text-aura-online" />{t('settings.privacy_no_phone')}</div>
              <div className="flex items-center gap-2"><Check className="w-4 h-4 text-aura-online" />{t('settings.privacy_no_ads')}</div>
            </div>
            {user.publicKey && (
              <div className="mt-3 px-3 py-2 rounded-lg bg-aura-surface2 text-xs font-mono break-all text-aura-text-muted">
                <span className="text-aura-text-dim">{t('settings.your_public_key')} </span>
                {user.publicKey.slice(0, 32)}...
              </div>
            )}
          </Section>

          {/* Notifications */}
          <Section title={t('settings.section_notifications')} icon={<Bell className="w-4 h-4" />}>
            <div className="space-y-3">
              <div className="text-sm text-aura-text-dim">
                {t('settings.notifications_desc')}
              </div>
              
              {notificationPermission === 'granted' ? (
                <div className="flex items-center gap-2 text-sm text-aura-online">
                  <Check className="w-4 h-4" />
                  {t('settings.notifications_enabled')}
                </div>
              ) : notificationPermission === 'denied' ? (
                <div className="flex items-center gap-2 text-sm text-aura-dnd">
                  <BellOff className="w-4 h-4" />
                  {t('settings.notifications_blocked')}
                </div>
              ) : (
                <button
                  onClick={handleRequestNotifications}
                  className="btn-primary"
                >
                  <Bell className="w-4 h-4 inline mr-2" />
                  {t('settings.notifications_enable')}
                </button>
              )}

              {notificationPermission === 'denied' && (
                <div className="px-3 py-2 rounded-lg bg-aura-dnd/10 border border-aura-dnd/30 text-xs text-aura-text-dim">
                  {t('settings.notifications_blocked_help')}
                </div>
              )}
            </div>
          </Section>

          {/* Actions */}
          <div className="flex justify-between items-center pt-4 border-t border-aura-border">
            <button onClick={logout} className="flex items-center gap-2 text-aura-dnd hover:text-red-400 px-3 py-2 rounded-lg hover:bg-aura-dnd/10 transition-colors">
              <LogOut className="w-4 h-4" />
              <span className="text-sm font-medium">{t('settings.signout')}</span>
            </button>
            <div className="flex gap-2">
              <button onClick={onClose} className="btn-secondary">{t('settings.close')}</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary min-w-24">
                {saving ? t('settings.saving') : saved ? t('settings.saved') : t('settings.save')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="font-semibold mb-3 flex items-center gap-2 text-sm uppercase tracking-wide text-aura-text-dim">
        {icon}
        {title}
      </h3>
      {children}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-xs font-medium text-aura-text-dim mb-1.5 uppercase tracking-wide">{children}</div>;
}

function ModeOption({ active, onClick, icon, title, desc }: {
  active: boolean; onClick: () => void; icon: React.ReactNode; title: string; desc: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-start gap-3 px-4 py-3 rounded-xl border transition-colors text-left ${
        active ? 'bg-aura-primary-dim border-aura-primary/50' : 'bg-aura-surface2 border-aura-border hover:bg-aura-elevated'
      }`}
    >
      <div className="mt-0.5">{icon}</div>
      <div className="flex-1">
        <div className="font-medium">{title}</div>
        <div className="text-xs text-aura-text-dim">{desc}</div>
      </div>
      {active && <Check className="w-5 h-5 text-aura-primary-light" />}
    </button>
  );
}

function ThemeOption({ active, onClick, icon, label, gradient }: {
  active: boolean; onClick: () => void; icon: React.ReactNode; label: string; gradient: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-colors ${
        active ? 'border-aura-primary' : 'border-aura-border hover:border-aura-border-light'
      }`}
    >
      <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center text-white`}>
        {icon}
      </div>
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
}
