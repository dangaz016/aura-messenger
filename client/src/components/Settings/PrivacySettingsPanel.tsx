import { useState } from 'react';
import { Eye, EyeOff, Users, Globe, UserX, Check, Shield, RefreshCw, Bell, Forward } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api';
import { PrivacyLevel, PrivacySettings } from '../../types';

type PrivacyField = keyof Omit<PrivacySettings, 'readReceipts' | 'forwardFrom'>;

const LEVEL_OPTIONS: { value: PrivacyLevel; label: string; icon: React.ReactNode; desc: string }[] = [
  { value: 'everyone', label: 'Все', icon: <Globe className="w-3.5 h-3.5" />, desc: 'Все пользователи' },
  { value: 'contacts', label: 'Контакты', icon: <Users className="w-3.5 h-3.5" />, desc: 'Только с общими чатами' },
  { value: 'nobody', label: 'Никто', icon: <UserX className="w-3.5 h-3.5" />, desc: 'Скрыто от всех' },
];

interface PrivacyRowProps {
  label: string;
  description: string;
  value: PrivacyLevel;
  onChange: (v: PrivacyLevel) => void;
  saving: boolean;
  icon?: React.ReactNode;
}

function PrivacyRow({ label, description, value, onChange, saving, icon }: PrivacyRowProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-aura-surface2 border border-aura-border">
      <div className="flex items-start gap-3">
        {icon && <div className="mt-0.5 text-aura-text-muted">{icon}</div>}
        <div>
          <div className="text-sm font-medium">{label}</div>
          <div className="text-xs text-aura-text-muted mt-0.5">{description}</div>
        </div>
      </div>
      <div className="flex gap-1.5 flex-shrink-0">
        {LEVEL_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            disabled={saving}
            title={opt.desc}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
              value === opt.value
                ? 'bg-aura-primary border-aura-primary text-white shadow-sm'
                : 'border-aura-border text-aura-text-muted hover:border-aura-primary/50 hover:text-aura-text'
            }`}
          >
            {opt.icon}
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

interface ToggleRowProps {
  label: string;
  description: string;
  value: boolean;
  onChange: (v: boolean) => void;
  saving: boolean;
  icon?: React.ReactNode;
}

function ToggleRow({ label, description, value, onChange, saving, icon }: ToggleRowProps) {
  return (
    <div className="flex items-center justify-between gap-3 p-4 rounded-xl bg-aura-surface2 border border-aura-border">
      <div className="flex items-start gap-3">
        {icon && <div className="mt-0.5 text-aura-text-muted">{icon}</div>}
        <div>
          <div className="text-sm font-medium">{label}</div>
          <div className="text-xs text-aura-text-muted mt-0.5">{description}</div>
        </div>
      </div>
      <button
        onClick={() => onChange(!value)}
        disabled={saving}
        className={`relative inline-flex w-12 h-6 rounded-full transition-colors flex-shrink-0 ${
          value ? 'bg-aura-primary' : 'bg-aura-elevated'
        }`}
      >
        <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
          value ? 'translate-x-7' : 'translate-x-1'
        }`} />
      </button>
    </div>
  );
}

export function PrivacySettingsPanel() {
  const { user, updateUser } = useAuth();
  const [saving, setSaving] = useState(false);
  const [savedField, setSavedField] = useState<string | null>(null);

  if (!user) return null;

  const privacy = user.privacy ?? {
    lastSeen: 'everyone' as PrivacyLevel,
    avatar: 'everyone' as PrivacyLevel,
    bio: 'everyone' as PrivacyLevel,
    birthday: 'contacts' as PrivacyLevel,
    phone: 'nobody' as PrivacyLevel,
    online: 'everyone' as PrivacyLevel,
    readReceipts: true,
    forwardFrom: true,
    groups: 'everyone' as PrivacyLevel,
  };

  async function save(patch: Partial<PrivacySettings>, fieldName: string) {
    setSaving(true);
    setSavedField(null);
    try {
      const updated = await api.updatePrivacy(patch);
      updateUser(updated);
      setSavedField(fieldName);
      setTimeout(() => setSavedField(null), 1500);
    } catch { /* ignore */ }
    setSaving(false);
  }

  const changeLevel = (field: PrivacyField) => (value: PrivacyLevel) =>
    save({ [field]: value }, field);

  return (
    <div className="space-y-6">
      {/* Who can see */}
      <div>
        <h3 className="text-xs font-semibold text-aura-text-dim uppercase tracking-wider mb-3 flex items-center gap-2">
          <Eye className="w-3.5 h-3.5" />
          Кто может видеть
        </h3>
        <div className="space-y-2">
          <PrivacyRow
            label="Время последнего визита"
            description="Когда ты был онлайн"
            value={privacy.lastSeen}
            onChange={changeLevel('lastSeen')}
            saving={saving}
            icon={<Shield className="w-4 h-4" />}
          />
          <PrivacyRow
            label="Онлайн статус"
            description="Показывать ли что ты сейчас онлайн"
            value={privacy.online}
            onChange={changeLevel('online')}
            saving={saving}
            icon={<div className="w-2.5 h-2.5 rounded-full bg-aura-online mt-0.5" />}
          />
          <PrivacyRow
            label="Фото профиля"
            description="Аватар и фотографии профиля"
            value={privacy.avatar}
            onChange={changeLevel('avatar')}
            saving={saving}
            icon={<div className="w-4 h-4 rounded-full bg-aura-primary/30 border border-aura-primary/50" />}
          />
          <PrivacyRow
            label="О себе (Bio)"
            description="Описание профиля"
            value={privacy.bio}
            onChange={changeLevel('bio')}
            saving={saving}
            icon={<EyeOff className="w-4 h-4" />}
          />
          <PrivacyRow
            label="День рождения"
            description="Дата рождения в профиле"
            value={privacy.birthday}
            onChange={changeLevel('birthday')}
            saving={saving}
            icon={<span className="text-sm">🎂</span>}
          />
          <PrivacyRow
            label="Номер телефона"
            description="Телефон привязанный к аккаунту"
            value={privacy.phone}
            onChange={changeLevel('phone')}
            saving={saving}
            icon={<span className="text-sm">📱</span>}
          />
          <PrivacyRow
            label="Кто может добавить в группу"
            description="Кто может приглашать тебя в группы"
            value={privacy.groups}
            onChange={changeLevel('groups')}
            saving={saving}
            icon={<Users className="w-4 h-4" />}
          />
        </div>
      </div>

      {/* Toggles */}
      <div>
        <h3 className="text-xs font-semibold text-aura-text-dim uppercase tracking-wider mb-3 flex items-center gap-2">
          <Bell className="w-3.5 h-3.5" />
          Уведомления и активность
        </h3>
        <div className="space-y-2">
          <ToggleRow
            label="Прочитанные сообщения"
            description="Показывать двойную галочку когда прочитал сообщение"
            value={privacy.readReceipts}
            onChange={v => save({ readReceipts: v }, 'readReceipts')}
            saving={saving}
            icon={<Check className="w-4 h-4" />}
          />
          <ToggleRow
            label="Ссылка на тебя при пересылке"
            description="Показывать твоё имя при пересылке твоих сообщений"
            value={privacy.forwardFrom}
            onChange={v => save({ forwardFrom: v }, 'forwardFrom')}
            saving={saving}
            icon={<Forward className="w-4 h-4" />}
          />
        </div>
      </div>

      {/* Saving indicator */}
      {(saving || savedField) && (
        <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg ${
          savedField ? 'bg-aura-online/10 text-aura-online border border-aura-online/30'
                     : 'bg-aura-surface2 text-aura-text-muted border border-aura-border'
        }`}>
          {saving
            ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Сохраняем...</>
            : <><Check className="w-3.5 h-3.5" /> Сохранено</>
          }
        </div>
      )}

      {/* Privacy tip */}
      <div className="p-3 rounded-xl bg-aura-surface2 border border-aura-border text-xs text-aura-text-muted leading-relaxed">
        <span className="font-semibold text-aura-text">Контакты</span> — пользователи, с которыми у тебя есть общий личный чат.
        Настройки применяются при просмотре твоего профиля другими пользователями.
      </div>
    </div>
  );
}
