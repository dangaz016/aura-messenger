import { useState, useEffect, useRef } from 'react';
import { X, LogOut, Palette, ShieldCheck, Eye, EyeOff, BellOff, Check, Moon, Sparkles, Waves, Bell, Edit3, Camera, Loader2, Cake, Crown, Lock, Send } from 'lucide-react';
import { AuraPrimePanel } from './AuraPrimePanel';
import { PrivacySettingsPanel } from './PrivacySettingsPanel';
import { TelegramLinkPanel } from './TelegramLinkPanel';
import { useAuth } from '../../contexts/AuthContext';
import { useChat } from '../../contexts/ChatContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useT } from '../../contexts/LanguageContext';
import { TranslationKey } from '../../i18n/translations';
import { Avatar } from '../Common/Avatar';
import { api } from '../../services/api';
import { AuraMode } from '../../types';
import { requestNotificationPermission } from '../../utils/notifications';
import { LanguageToggle } from '../Common/LanguageToggle';

const COLORS = [
  '#7C3AED', '#A78BFA', '#EC4899', '#F472B6',
  '#3B82F6', '#06B6D4', '#10B981', '#F59E0B',
  '#EF4444', '#8B5CF6', '#14B8A6', '#F97316',
];

const MONTHS_RU = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
const MONTHS_EN = ['January','February','March','April','May','June','July','August','September','October','November','December'];

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
  const { t, lang } = useT();
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [moodEmoji, setMoodEmoji] = useState(user?.moodEmoji || '👋');
  const [moodText, setMoodText] = useState(user?.moodText || 'Available');
  const [color, setColor] = useState(user?.avatarColor || '#7C3AED');
  // Birthday: stored as "MM-DD"
  const [bdMonth, setBdMonth] = useState(user?.birthday?.split('-')[0] || '');
  const [bdDay, setBdDay] = useState(user?.birthday?.split('-')[1] || '');
  const [website, setWebsite] = useState(user?.website || '');
  const [location, setLocation] = useState(user?.location || '');
  const [socialLinks, setSocialLinks] = useState<Record<string, string>>(user?.socialLinks || {});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  const [showUsernameChange, setShowUsernameChange] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [changingUsername, setChangingUsername] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const MONTHS = lang === 'ru' ? MONTHS_RU : MONTHS_EN;

  useEffect(() => {
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  if (!user) return null;

  async function handleSave() {
    setSaving(true);
    try {
      const birthday = bdMonth && bdDay ? `${bdMonth}-${bdDay}` : '';
      const updated = await api.updateProfile({ displayName, moodEmoji, moodText, avatarColor: color, bio, birthday, website, location, socialLinks });
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

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    setUploadingAvatar(true);
    try {
      const uploaded = await api.uploadFile(file);
      const avatarUrl = api.fileUrl(uploaded.id);
      const updated = await api.updateProfile({ avatarUrl });
      updateUser(updated);
    } catch { /* ignore */ } finally {
      setUploadingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  }

  async function handleRemoveAvatar() {
    setUploadingAvatar(true);
    try {
      const updated = await api.updateProfile({ avatarUrl: '' });
      updateUser(updated);
    } catch { /* ignore */ } finally {
      setUploadingAvatar(false);
    }
  }

  async function handleRequestNotifications() {
    const permission = await requestNotificationPermission();
    setNotificationPermission(permission);
  }

  async function handleUsernameChange() {
    if (!newUsername.trim()) {
      setUsernameError(t('settings.username_required'));
      return;
    }

    if (!/^[a-zA-Z0-9_]{3,20}$/.test(newUsername)) {
      setUsernameError(t('settings.username_invalid'));
      return;
    }

    setChangingUsername(true);
    setUsernameError('');

    try {
      const updatedUser = await api.changeUsername(newUsername);
      updateUser(updatedUser);
      setShowUsernameChange(false);
      setNewUsername('');
      alert(t('settings.username_changed'));
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || t('settings.username_error');
      setUsernameError(errorMsg);
    } finally {
      setChangingUsername(false);
    }
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
              {/* Avatar with upload button */}
              <div className="relative flex-shrink-0 group cursor-pointer" onClick={() => avatarInputRef.current?.click()}>
                <Avatar
                  name={displayName}
                  color={color}
                  size={80}
                  emoji={user.avatarUrl ? undefined : moodEmoji}
                  showStatus={false}
                  imageUrl={user.avatarUrl}
                />
                <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  {uploadingAvatar
                    ? <Loader2 className="w-6 h-6 text-white animate-spin" />
                    : <Camera className="w-6 h-6 text-white" />
                  }
                </div>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarUpload}
                />
              </div>
              <div className="flex-1 min-w-0 space-y-3">
                {user.avatarUrl && (
                  <button onClick={handleRemoveAvatar} className="text-xs text-aura-dnd hover:underline block">
                    Удалить фото
                  </button>
                )}
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
                  <Label>{t('settings.username')}</Label>
                  <div className="flex gap-2">
                    <input value={`@${user.username}`} readOnly className="input-aura flex-1 opacity-60" />
                    <button
                      onClick={() => setShowUsernameChange(true)}
                      className="btn-secondary"
                      title={t('settings.change_username')}
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div>
                  <Label>Bio</Label>
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder={lang === 'ru' ? 'Расскажите о себе…' : 'Tell about yourself…'}
                    className="input-aura w-full resize-none"
                    rows={2}
                    maxLength={300}
                  />
                  <div className="text-right text-xs text-aura-text-muted mt-0.5">{bio.length}/300</div>
                </div>
              </div>
            </div>

            {/* Website */}
            <div className="mt-4 flex items-start gap-3 p-3 rounded-xl bg-aura-surface2 border border-aura-border">
              <svg className="w-5 h-5 text-aura-text-muted flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1.41 15.71L6.5 12.59V11h10.99v1.59l-4.09 3.12-1.09-4.04-3.3 2.58zM13.5 6.31c-.28 0-.5.22-.5.5s.22.5.5.5.5-.22.5-.5-.22-.5-.5-.5zm-3 0c-.28 0-.5.22-.5.5s.22.5.5.5.5-.22.5-.5-.22-.5-.5-.5z"/>
              </svg>
              <div className="flex-1">
                <Label>{lang === 'ru' ? 'Веб-сайт' : 'Website'}</Label>
                <input
                  type="url"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://example.com"
                  className="input-aura w-full"
                />
              </div>
            </div>

            {/* Location */}
            <div className="mt-4 flex items-start gap-3 p-3 rounded-xl bg-aura-surface2 border border-aura-border">
              <svg className="w-5 h-5 text-aura-text-muted flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
              </svg>
              <div className="flex-1">
                <Label>{lang === 'ru' ? 'Местоположение' : 'Location'}</Label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder={lang === 'ru' ? 'Город, страна' : 'City, Country'}
                  className="input-aura w-full"
                  maxLength={60}
                />
              </div>
            </div>

            {/* Birthday */}
            <div className="mt-4 flex items-start gap-3 p-3 rounded-xl bg-aura-surface2 border border-aura-border">
              <Cake className="w-5 h-5 text-pink-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <Label>{lang === 'ru' ? 'День рождения' : 'Birthday'}</Label>
                <div className="flex items-center gap-2 flex-wrap">
                  <select
                    value={bdMonth}
                    onChange={e => { setBdMonth(e.target.value); if (!e.target.value) setBdDay(''); }}
                    className="input-aura flex-1 min-w-[120px]"
                  >
                    <option value="">{lang === 'ru' ? '— Месяц —' : '— Month —'}</option>
                    {MONTHS.map((m, i) => (
                      <option key={i + 1} value={String(i + 1).padStart(2, '0')}>{m}</option>
                    ))}
                  </select>
                  <select
                    value={bdDay}
                    onChange={e => setBdDay(e.target.value)}
                    disabled={!bdMonth}
                    className="input-aura w-[80px] disabled:opacity-40"
                  >
                    <option value="">{lang === 'ru' ? '— День —' : '— Day —'}</option>
                    {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                      <option key={d} value={String(d).padStart(2, '0')}>{d}</option>
                    ))}
                  </select>
                  {(bdMonth || bdDay) && (
                    <button
                      onClick={() => { setBdMonth(''); setBdDay(''); }}
                      className="text-xs text-aura-dnd hover:underline whitespace-nowrap"
                    >
                      {lang === 'ru' ? 'Удалить' : 'Remove'}
                    </button>
                  )}
                </div>
                {bdMonth && bdDay && (
                  <p className="text-xs text-aura-text-muted mt-1.5">
                    🎂 {MONTHS[parseInt(bdMonth) - 1]} {parseInt(bdDay)}
                  </p>
                )}
              </div>
            </div>

            {/* Social Links */}
            <div className="mt-4 flex items-start gap-3 p-3 rounded-xl bg-aura-surface2 border border-aura-border">
              <svg className="w-5 h-5 text-aura-text-muted flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z"/>
              </svg>
              <div className="flex-1">
                <Label>{lang === 'ru' ? 'Социальные сети' : 'Social Links'}</Label>
                <div className="space-y-2">
                  {['twitter', 'instagram', 'github', 'linkedin', 'youtube'].map(platform => (
                    <div key={platform} className="flex items-center gap-2">
                      <input
                        type="url"
                        value={socialLinks[platform] || ''}
                        onChange={(e) => setSocialLinks({...socialLinks, [platform]: e.target.value})}
                        placeholder={platform === 'twitter' ? 'https://twitter.com/username' : platform === 'instagram' ? 'https://instagram.com/username' : platform === 'github' ? 'https://github.com/username' : platform === 'linkedin' ? 'https://linkedin.com/in/username' : 'https://youtube.com/channel/...'}
                        className="input-aura flex-1"
                      />
                    </div>
                  ))}
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

          {/* Change Username Modal */}
          {showUsernameChange && (
            <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
              <div className="bg-aura-surface border border-aura-border rounded-2xl max-w-md w-full p-6 animate-scale-in">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-lg">{t('settings.change_username')}</h3>
                  <button onClick={() => { setShowUsernameChange(false); setUsernameError(''); setNewUsername(''); }} className="p-2 hover:bg-aura-elevated rounded-lg">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label>{t('settings.current_username')}</Label>
                    <input value={`@${user.username}`} readOnly className="input-aura w-full opacity-60" />
                  </div>

                  <div>
                    <Label>{t('settings.new_username')}</Label>
                    <input
                      type="text"
                      value={newUsername}
                      onChange={(e) => { setNewUsername(e.target.value); setUsernameError(''); }}
                      placeholder="new_username"
                      className="input-aura w-full"
                      maxLength={20}
                    />
                    {usernameError && (
                      <div className="mt-2 text-xs text-aura-dnd">{usernameError}</div>
                    )}
                    <div className="mt-2 text-xs text-aura-text-muted">
                      {t('settings.username_hint')}
                    </div>
                  </div>

                  <div className="px-3 py-2 rounded-lg bg-aura-ghost/10 border border-aura-ghost/30 text-xs text-aura-text-dim">
                    {t('settings.username_limit')}
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => { setShowUsernameChange(false); setUsernameError(''); setNewUsername(''); }}
                      className="btn-secondary flex-1"
                    >
                      {t('settings.cancel')}
                    </button>
                    <button
                      onClick={handleUsernameChange}
                      disabled={changingUsername || !newUsername.trim()}
                      className="btn-primary flex-1"
                    >
                      {changingUsername ? t('settings.changing') : t('settings.change')}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

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

          {/* Privacy — security info */}
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

          {/* Privacy — who can see */}
          <Section title="Конфиденциальность" icon={<Lock className="w-4 h-4 text-aura-primary-light" />}>
            <PrivacySettingsPanel />
          </Section>

          {/* Telegram Link */}
          <Section title="Telegram" icon={<Send className="w-4 h-4 text-blue-400" />}>
            <TelegramLinkPanel />
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

          {/* Language Settings */}
          <Section title={t('settings.section_language')} icon={<Sparkles className="w-4 h-4" />}>
            <LanguageToggle />
          </Section>

          {/* Aura Prime */}
          <Section title="Aura Prime" icon={<Crown className="w-4 h-4 text-yellow-400" />}>
            <AuraPrimePanel />
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
