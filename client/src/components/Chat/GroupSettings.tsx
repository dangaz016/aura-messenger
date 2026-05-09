import { useState } from 'react';
import { X, Radio, Link, Globe, Lock, Users, Copy, Check, Trash2, Settings2,
  Clock, UserCheck, Smile, History, Image, Link2, PenLine, Users2, Crown, ChevronDown } from 'lucide-react';
import { Chat } from '../../types';
import { api } from '../../services/api';
import { useChat } from '../../contexts/ChatContext';
import { useAuth } from '../../contexts/AuthContext';

const COLORS = [
  '#7C3AED', '#A78BFA', '#EC4899', '#F472B6',
  '#3B82F6', '#06B6D4', '#10B981', '#F59E0B',
  '#EF4444', '#8B5CF6', '#14B8A6', '#F97316',
];

const SLOW_MODE_OPTIONS = [
  { value: 0, label: 'Выкл' },
  { value: 10, label: '10 сек' },
  { value: 30, label: '30 сек' },
  { value: 60, label: '1 мин' },
  { value: 300, label: '5 мин' },
  { value: 900, label: '15 мин' },
  { value: 3600, label: '1 час' },
];

const MAX_MEMBERS_OPTIONS = [
  { value: 0, label: 'Без ограничений' },
  { value: 10, label: '10' },
  { value: 50, label: '50' },
  { value: 100, label: '100' },
  { value: 200, label: '200' },
  { value: 500, label: '500' },
];

interface GroupSettingsProps {
  chat: Chat;
  onClose: () => void;
}

interface ToggleSettingProps {
  icon: React.ReactNode;
  label: string;
  description: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}

function ToggleSetting({ icon, label, description, value, onChange, disabled }: ToggleSettingProps) {
  return (
    <div className="flex items-center justify-between gap-3 p-3 rounded-xl hover:bg-aura-elevated/50 transition-colors">
      <div className="flex items-start gap-3">
        <div className="text-aura-text-muted mt-0.5">{icon}</div>
        <div>
          <div className="text-sm font-medium">{label}</div>
          <div className="text-xs text-aura-text-muted">{description}</div>
        </div>
      </div>
      <button
        onClick={() => onChange(!value)}
        disabled={disabled}
        className={`relative inline-flex w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
          value ? 'bg-aura-primary' : 'bg-aura-elevated'
        } disabled:opacity-50`}
      >
        <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
          value ? 'translate-x-6' : 'translate-x-1'
        }`} />
      </button>
    </div>
  );
}

export function GroupSettings({ chat, onClose }: GroupSettingsProps) {
  const { user } = useAuth();
  const { refreshChats, setActiveChatId } = useChat();

  const isChannel = chat.type === 'channel';
  const isGroup = chat.type === 'group' || chat.type === 'space';

  const [tab, setTab] = useState<'general' | 'permissions' | 'advanced'>('general');
  const [name, setName] = useState(chat.name || '');
  const [description, setDescription] = useState(chat.description || '');
  const [isPublic, setIsPublic] = useState(chat.isPublic !== false);
  const [channelUsername, setChannelUsername] = useState(chat.channelUsername || '');
  const [color, setColor] = useState(chat.avatarColor);
  const [postPermissions, setPostPermissions] = useState(chat.postPermissions || 'admins');
  // Extended settings
  const [slowMode, setSlowMode] = useState(chat.slowMode ?? 0);
  const [joinApproval, setJoinApproval] = useState(chat.joinApproval ?? false);
  const [reactionsEnabled, setReactionsEnabled] = useState(chat.reactionsEnabled !== false);
  const [historyVisible, setHistoryVisible] = useState(chat.historyVisible !== false);
  const [mediaEnabled, setMediaEnabled] = useState(chat.mediaEnabled !== false);
  const [linksEnabled, setLinksEnabled] = useState(chat.linksEnabled !== false);
  const [signMessages, setSignMessages] = useState(chat.signMessages ?? false);
  const [maxMembers, setMaxMembers] = useState(chat.maxMembers ?? 0);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [error, setError] = useState('');

  const isAdmin = chat.createdBy === user?.id ||
    chat.members?.find(m => m.id === user?.id)?.role === 'admin';

  const inviteUrl = chat.inviteLink
    ? `${window.location.origin}/join/${chat.inviteLink}`
    : null;

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      await api.updateChatSettings(chat.id, {
        name: name.trim(),
        description: description.trim(),
        isPublic,
        channelUsername: channelUsername.trim() || undefined,
        postPermissions,
        avatarColor: color,
        slowMode,
        joinApproval,
        reactionsEnabled,
        historyVisible,
        mediaEnabled,
        linksEnabled,
        signMessages,
        maxMembers,
      });
      await refreshChats();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
        : null;
      setError(msg || 'Не удалось сохранить');
    }
    setSaving(false);
  }

  async function handleLeave() {
    if (!confirm(`Покинуть ${isChannel ? 'канал' : 'группу'}?`)) return;
    try {
      await api.leaveChat(chat.id);
      await refreshChats();
      setActiveChatId(null);
      onClose();
    } catch { /* ignore */ }
  }

  async function handleGenerateLink() {
    try {
      await api.generateInviteLink(chat.id);
      await refreshChats();
    } catch { /* ignore */ }
  }

  function copyLink() {
    if (!inviteUrl) return;
    navigator.clipboard.writeText(inviteUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  }

  const TABS = [
    { id: 'general', label: 'Основное' },
    { id: 'permissions', label: 'Права' },
    { id: 'advanced', label: 'Дополнительно' },
  ] as const;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}>
      <div className="bg-aura-surface border border-aura-border rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col animate-scale-in overflow-hidden"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-aura-border">
          <h3 className="font-bold flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-aura-primary" />
            Настройки {isChannel ? 'канала' : 'группы'}
          </h3>
          <button onClick={onClose} className="p-1.5 hover:bg-aura-elevated rounded-lg transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-5 pt-3 border-b border-aura-border">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id as typeof tab)}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                tab === t.id
                  ? 'bg-aura-elevated text-aura-primary border-b-2 border-aura-primary'
                  : 'text-aura-text-muted hover:text-aura-text'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* GENERAL TAB */}
          {tab === 'general' && (
            <>
              {/* Name */}
              <div>
                <label className="text-xs font-semibold text-aura-text-muted uppercase tracking-wider block mb-2">
                  Название
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  disabled={!isAdmin}
                  className="input-aura w-full"
                  maxLength={100}
                />
              </div>

              {/* Description */}
              <div>
                <label className="text-xs font-semibold text-aura-text-muted uppercase tracking-wider block mb-2">
                  Описание
                </label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  disabled={!isAdmin}
                  className="input-aura w-full resize-none"
                  rows={3}
                  maxLength={500}
                  placeholder="Описание группы или канала..."
                />
                <div className="text-right text-xs text-aura-text-muted mt-0.5">{description.length}/500</div>
              </div>

              {/* Color */}
              <div>
                <label className="text-xs font-semibold text-aura-text-muted uppercase tracking-wider block mb-2">
                  Цвет
                </label>
                <div className="flex flex-wrap gap-2">
                  {COLORS.map(c => (
                    <button
                      key={c}
                      onClick={() => isAdmin && setColor(c)}
                      className={`w-8 h-8 rounded-full transition-all ${color === c ? 'ring-2 ring-offset-2 ring-white ring-offset-aura-surface scale-110' : ''}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              {/* Public/Private */}
              <div className="p-4 rounded-xl bg-aura-surface2 border border-aura-border">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold">
                    {isChannel ? 'Тип канала' : 'Тип группы'}
                  </span>
                </div>
                <div className="flex gap-2">
                  {[
                    { v: true, label: 'Публичный', icon: <Globe className="w-4 h-4" /> },
                    { v: false, label: 'Приватный', icon: <Lock className="w-4 h-4" /> },
                  ].map(opt => (
                    <button
                      key={String(opt.v)}
                      onClick={() => isAdmin && setIsPublic(opt.v)}
                      disabled={!isAdmin}
                      className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                        isPublic === opt.v
                          ? 'border-aura-primary bg-aura-primary/10 text-aura-primary'
                          : 'border-aura-border text-aura-text-muted hover:border-aura-primary/50'
                      }`}
                    >
                      {opt.icon} {opt.label}
                    </button>
                  ))}
                </div>

                {/* Public username */}
                {isPublic && isChannel && (
                  <div className="mt-3">
                    <div className="flex items-center gap-2 bg-aura-bg border border-aura-border rounded-xl px-3 py-2">
                      <span className="text-aura-text-muted text-sm">@</span>
                      <input
                        type="text"
                        value={channelUsername}
                        onChange={e => setChannelUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                        disabled={!isAdmin}
                        placeholder="username"
                        className="flex-1 bg-transparent text-sm outline-none"
                        maxLength={30}
                      />
                    </div>
                    <p className="text-xs text-aura-text-muted mt-1">
                      Ссылка: t.me/{channelUsername || 'username'}
                    </p>
                  </div>
                )}
              </div>

              {/* Invite link */}
              <div className="p-4 rounded-xl bg-aura-surface2 border border-aura-border">
                <div className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Link className="w-4 h-4" />
                  Ссылка для приглашения
                </div>
                {inviteUrl ? (
                  <div className="flex gap-2">
                    <input
                      readOnly
                      value={inviteUrl}
                      className="input-aura flex-1 text-xs font-mono"
                    />
                    <button onClick={copyLink}
                      className="px-3 rounded-xl border border-aura-border hover:bg-aura-elevated transition-colors">
                      {copiedLink ? <Check className="w-4 h-4 text-aura-online" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                ) : isAdmin ? (
                  <button onClick={handleGenerateLink}
                    className="btn-secondary w-full text-sm flex items-center justify-center gap-2">
                    <Link2 className="w-4 h-4" /> Создать ссылку
                  </button>
                ) : (
                  <p className="text-xs text-aura-text-muted">Ссылка не создана</p>
                )}
              </div>
            </>
          )}

          {/* PERMISSIONS TAB */}
          {tab === 'permissions' && (
            <>
              {isChannel && (
                <div>
                  <label className="text-xs font-semibold text-aura-text-muted uppercase tracking-wider block mb-3">
                    Кто может публиковать сообщения
                  </label>
                  {[
                    { v: 'admins', label: 'Только администраторы', icon: <Crown className="w-4 h-4" /> },
                    { v: 'everyone', label: 'Все участники', icon: <Users2 className="w-4 h-4" /> },
                  ].map(opt => (
                    <button
                      key={opt.v}
                      onClick={() => isAdmin && setPostPermissions(opt.v)}
                      disabled={!isAdmin}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all mb-2 ${
                        postPermissions === opt.v
                          ? 'border-aura-primary bg-aura-primary/10'
                          : 'border-aura-border hover:border-aura-primary/50'
                      }`}
                    >
                      <span className={postPermissions === opt.v ? 'text-aura-primary' : 'text-aura-text-muted'}>
                        {opt.icon}
                      </span>
                      <span className="text-sm">{opt.label}</span>
                      {postPermissions === opt.v && <Check className="w-4 h-4 text-aura-primary ml-auto" />}
                    </button>
                  ))}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-semibold text-aura-text-muted uppercase tracking-wider block mb-2">
                  Права участников
                </label>
                <ToggleSetting
                  icon={<Smile className="w-4 h-4" />}
                  label="Реакции"
                  description="Участники могут ставить реакции на сообщения"
                  value={reactionsEnabled}
                  onChange={v => isAdmin && setReactionsEnabled(v)}
                  disabled={!isAdmin}
                />
                <ToggleSetting
                  icon={<Image className="w-4 h-4" />}
                  label="Медиафайлы"
                  description="Участники могут отправлять фото и видео"
                  value={mediaEnabled}
                  onChange={v => isAdmin && setMediaEnabled(v)}
                  disabled={!isAdmin}
                />
                <ToggleSetting
                  icon={<Link2 className="w-4 h-4" />}
                  label="Ссылки"
                  description="Участники могут отправлять ссылки и URL"
                  value={linksEnabled}
                  onChange={v => isAdmin && setLinksEnabled(v)}
                  disabled={!isAdmin}
                />
                {isGroup && (
                  <ToggleSetting
                    icon={<UserCheck className="w-4 h-4" />}
                    label="Одобрение вступления"
                    description="Новые участники требуют одобрения администратора"
                    value={joinApproval}
                    onChange={v => isAdmin && setJoinApproval(v)}
                    disabled={!isAdmin}
                  />
                )}
              </div>
            </>
          )}

          {/* ADVANCED TAB */}
          {tab === 'advanced' && (
            <>
              {/* Slow mode */}
              <div>
                <label className="text-xs font-semibold text-aura-text-muted uppercase tracking-wider block mb-2 flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5" /> Медленный режим
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {SLOW_MODE_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => isAdmin && setSlowMode(opt.value)}
                      disabled={!isAdmin}
                      className={`py-2 rounded-xl text-xs font-medium transition-all border ${
                        slowMode === opt.value
                          ? 'bg-aura-primary border-aura-primary text-white'
                          : 'border-aura-border text-aura-text-muted hover:border-aura-primary/50'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-aura-text-muted mt-2">
                  Участники смогут отправлять сообщение раз в указанный период
                </p>
              </div>

              {/* Max members */}
              {isGroup && (
                <div>
                  <label className="text-xs font-semibold text-aura-text-muted uppercase tracking-wider block mb-2 flex items-center gap-2">
                    <Users className="w-3.5 h-3.5" /> Максимум участников
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {MAX_MEMBERS_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => isAdmin && setMaxMembers(opt.value)}
                        disabled={!isAdmin}
                        className={`py-2 rounded-xl text-xs font-medium transition-all border ${
                          maxMembers === opt.value
                            ? 'bg-aura-primary border-aura-primary text-white'
                            : 'border-aura-border text-aura-text-muted hover:border-aura-primary/50'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Other toggles */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-aura-text-muted uppercase tracking-wider block mb-2">
                  Другие настройки
                </label>
                <ToggleSetting
                  icon={<History className="w-4 h-4" />}
                  label="История сообщений"
                  description="Новые участники видят историю переписки"
                  value={historyVisible}
                  onChange={v => isAdmin && setHistoryVisible(v)}
                  disabled={!isAdmin}
                />
                {isChannel && (
                  <ToggleSetting
                    icon={<PenLine className="w-4 h-4" />}
                    label="Подписывать сообщения"
                    description="Имя автора отображается под каждым постом"
                    value={signMessages}
                    onChange={v => isAdmin && setSignMessages(v)}
                    disabled={!isAdmin}
                  />
                )}
              </div>
            </>
          )}

          {error && (
            <div className="text-xs text-aura-dnd px-3 py-2 rounded-lg bg-aura-dnd/10 border border-aura-dnd/30">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-aura-border flex items-center gap-3">
          {isAdmin && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 btn-primary flex items-center justify-center gap-2 py-2.5"
            >
              {saving ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : saved ? (
                <><Check className="w-4 h-4" /> Сохранено</>
              ) : (
                'Сохранить'
              )}
            </button>
          )}
          <button
            onClick={handleLeave}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-aura-dnd/30 text-aura-dnd hover:bg-aura-dnd/10 transition-colors text-sm font-medium"
          >
            <Trash2 className="w-4 h-4" />
            Покинуть
          </button>
        </div>
      </div>
    </div>
  );
}
