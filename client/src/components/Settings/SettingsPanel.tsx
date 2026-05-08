import { useState } from 'react';
import { X, LogOut, Palette, ShieldCheck, Eye, EyeOff, BellOff, Check, Moon, Sparkles, Waves } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useChat } from '../../contexts/ChatContext';
import { useTheme, Theme } from '../../contexts/ThemeContext';
import { Avatar } from '../Common/Avatar';
import { api } from '../../services/api';
import { AuraMode } from '../../types';

const COLORS = [
  '#7C3AED', '#A78BFA', '#EC4899', '#F472B6',
  '#3B82F6', '#06B6D4', '#10B981', '#F59E0B',
  '#EF4444', '#8B5CF6', '#14B8A6', '#F97316',
];

const MOOD_PRESETS = [
  { emoji: '👋', text: 'Available' },
  { emoji: '💭', text: 'Thinking' },
  { emoji: '☕', text: 'Coffee break' },
  { emoji: '💻', text: 'Working' },
  { emoji: '🎮', text: 'Gaming' },
  { emoji: '🎵', text: 'Listening to music' },
  { emoji: '🛌', text: 'Sleeping' },
  { emoji: '🌴', text: 'On vacation' },
  { emoji: '📚', text: 'Studying' },
  { emoji: '🎬', text: 'Watching movie' },
];

interface SettingsPanelProps {
  onClose: () => void;
}

export function SettingsPanel({ onClose }: SettingsPanelProps) {
  const { user, updateUser, logout } = useAuth();
  const { updateAuraMode } = useChat();
  const { theme, setTheme } = useTheme();
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [moodEmoji, setMoodEmoji] = useState(user?.moodEmoji || '👋');
  const [moodText, setMoodText] = useState(user?.moodText || 'Available');
  const [color, setColor] = useState(user?.avatarColor || '#7C3AED');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

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

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto animate-fade-in">
      <div className="card w-full max-w-2xl my-8 animate-slide-up">
        <div className="flex items-center justify-between p-6 border-b border-aura-border">
          <h2 className="text-2xl font-bold">Settings</h2>
          <button onClick={onClose} className="p-2 hover:bg-aura-elevated rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-8">
          {/* Profile */}
          <Section title="Profile" icon={<Sparkles className="w-4 h-4" />}>
            <div className="flex items-start gap-4">
              <Avatar name={displayName} color={color} size={80} emoji={moodEmoji} showStatus={false} />
              <div className="flex-1 space-y-3">
                <div>
                  <Label>Display name</Label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="input-aura w-full"
                    maxLength={40}
                  />
                </div>
                <div>
                  <Label>Username (cannot change)</Label>
                  <input value={`@${user.username}`} readOnly className="input-aura w-full opacity-60" />
                </div>
              </div>
            </div>

            <div className="mt-4">
              <Label>Avatar color</Label>
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
          <Section title="Mood Status" icon={<Sparkles className="w-4 h-4" />}>
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
                placeholder="What's on your mind?"
                className="input-aura flex-1"
                maxLength={50}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              {MOOD_PRESETS.map(m => (
                <button
                  key={m.text}
                  onClick={() => { setMoodEmoji(m.emoji); setMoodText(m.text); }}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-aura-surface2 hover:bg-aura-elevated text-sm text-left"
                >
                  <span className="text-lg">{m.emoji}</span>
                  <span className="truncate">{m.text}</span>
                </button>
              ))}
            </div>
          </Section>

          {/* Aura Mode */}
          <Section title="Aura Mode" icon={<ShieldCheck className="w-4 h-4" />}>
            <p className="text-xs text-aura-text-dim mb-3">
              Control your visibility and notifications. Privacy is the priority.
            </p>
            <div className="space-y-2">
              <ModeOption
                active={user.auraMode === 'available'}
                onClick={() => handleAuraMode('available')}
                icon={<Eye className="w-5 h-5 text-aura-online" />}
                title="Available"
                desc="Show as online, receive all notifications"
              />
              <ModeOption
                active={user.auraMode === 'ghost'}
                onClick={() => handleAuraMode('ghost')}
                icon={<EyeOff className="w-5 h-5 text-aura-ghost" />}
                title="Ghost mode"
                desc="Read messages without showing online. Stealth, but real."
              />
              <ModeOption
                active={user.auraMode === 'dnd'}
                onClick={() => handleAuraMode('dnd')}
                icon={<BellOff className="w-5 h-5 text-aura-dnd" />}
                title="Do not disturb"
                desc="Silence all notifications, others see your status"
              />
            </div>
          </Section>

          {/* Theme */}
          <Section title="Theme" icon={<Palette className="w-4 h-4" />}>
            <div className="grid grid-cols-3 gap-2">
              <ThemeOption active={theme === 'dark'} onClick={() => setTheme('dark')}
                icon={<Moon className="w-5 h-5" />} label="Dark" gradient="from-[#7C3AED] to-[#0d0d1a]" />
              <ThemeOption active={theme === 'midnight'} onClick={() => setTheme('midnight')}
                icon={<Sparkles className="w-5 h-5" />} label="Midnight" gradient="from-[#A78BFA] to-[#000000]" />
              <ThemeOption active={theme === 'aurora'} onClick={() => setTheme('aurora')}
                icon={<Waves className="w-5 h-5" />} label="Aurora" gradient="from-[#06B6D4] to-[#0a1a1f]" />
            </div>
          </Section>

          {/* Privacy */}
          <Section title="Privacy" icon={<ShieldCheck className="w-4 h-4" />}>
            <div className="space-y-2 text-sm text-aura-text-dim">
              <div className="flex items-center gap-2"><Check className="w-4 h-4 text-aura-online" />End-to-end encryption enabled</div>
              <div className="flex items-center gap-2"><Check className="w-4 h-4 text-aura-online" />Keys stored locally on this device</div>
              <div className="flex items-center gap-2"><Check className="w-4 h-4 text-aura-online" />No phone number required</div>
              <div className="flex items-center gap-2"><Check className="w-4 h-4 text-aura-online" />No ads, no tracking, no data selling</div>
            </div>
            {user.publicKey && (
              <div className="mt-3 px-3 py-2 rounded-lg bg-aura-surface2 text-xs font-mono break-all text-aura-text-muted">
                <span className="text-aura-text-dim">Your public key: </span>
                {user.publicKey.slice(0, 32)}...
              </div>
            )}
          </Section>

          {/* Actions */}
          <div className="flex justify-between items-center pt-4 border-t border-aura-border">
            <button onClick={logout} className="flex items-center gap-2 text-aura-dnd hover:text-red-400 px-3 py-2 rounded-lg hover:bg-aura-dnd/10 transition-colors">
              <LogOut className="w-4 h-4" />
              <span className="text-sm font-medium">Sign out</span>
            </button>
            <div className="flex gap-2">
              <button onClick={onClose} className="btn-secondary">Close</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary min-w-24">
                {saving ? 'Saving...' : saved ? '✓ Saved' : 'Save'}
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
