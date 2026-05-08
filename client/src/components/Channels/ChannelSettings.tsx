import { useState } from 'react';
import { X, Radio, Link, Globe, Lock, Users, Copy, Check, Trash2, Settings } from 'lucide-react';
import { Chat } from '../../types';
import { api } from '../../services/api';
import { useChat } from '../../contexts/ChatContext';
import { useAuth } from '../../contexts/AuthContext';

const COLORS = [
  '#7C3AED', '#A78BFA', '#EC4899', '#F472B6',
  '#3B82F6', '#06B6D4', '#10B981', '#F59E0B',
  '#EF4444', '#8B5CF6', '#14B8A6', '#F97316',
];

interface ChannelSettingsProps {
  chat: Chat;
  onClose: () => void;
}

export function ChannelSettings({ chat, onClose }: ChannelSettingsProps) {
  const { user } = useAuth();
  const { refreshChats, setActiveChatId } = useChat();
  const [name, setName] = useState(chat.name || '');
  const [description, setDescription] = useState(chat.description || '');
  const [isPublic, setIsPublic] = useState(chat.isPublic !== false);
  const [channelUsername, setChannelUsername] = useState(chat.channelUsername || '');
  const [color, setColor] = useState(chat.avatarColor);
  const [postPermissions, setPostPermissions] = useState(chat.postPermissions || 'admins');
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
      });
      await refreshChats();
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save');
    }
    setSaving(false);
  }

  async function handleLeave() {
    if (!confirm('Leave this channel?')) return;
    try {
      await api.leaveChat(chat.id);
      await refreshChats();
      setActiveChatId(null);
      onClose();
    } catch { /* ignore */ }
  }

  function copyLink() {
    if (!inviteUrl) return;
    navigator.clipboard.writeText(inviteUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}>
      <div className="bg-aura-surface border border-aura-border rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-scale-in"
        onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between p-5 border-b border-aura-border">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Settings className="w-5 h-5 text-aura-primary" />
            Channel Settings
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-aura-elevated rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-6">
          {/* Channel info section */}
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white flex-shrink-0"
              style={{ background: `linear-gradient(135deg, ${color} 0%, ${color}cc 100%)` }}>
              <Radio className="w-8 h-8" />
            </div>
            <div className="flex-1 space-y-3">
              <div>
                <label className="text-xs font-medium text-aura-text-dim uppercase tracking-wide block mb-1.5">Channel Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="input-aura w-full"
                  maxLength={50}
                  disabled={!isAdmin}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-aura-text-dim uppercase tracking-wide block mb-1.5">Description</label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="input-aura w-full resize-none"
                  rows={2}
                  maxLength={200}
                  disabled={!isAdmin}
                />
              </div>
            </div>
          </div>

          {/* Color picker */}
          {isAdmin && (
            <div>
              <label className="text-xs font-medium text-aura-text-dim uppercase tracking-wide block mb-2">Color</label>
              <div className="flex flex-wrap gap-2">
                {COLORS.map(c => (
                  <button key={c} onClick={() => setColor(c)}
                    className={`w-8 h-8 rounded-full transition-all ${color === c ? 'ring-2 ring-aura-text scale-110' : 'hover:scale-105'}`}
                    style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>
          )}

          {/* Channel username */}
          {isAdmin && (
            <div>
              <label className="text-xs font-medium text-aura-text-dim uppercase tracking-wide block mb-1.5">
                Channel Username (optional)
              </label>
              <div className="flex items-center gap-2">
                <span className="text-aura-text-muted">@</span>
                <input
                  type="text"
                  value={channelUsername}
                  onChange={e => setChannelUsername(e.target.value)}
                  placeholder="my_channel"
                  className="input-aura flex-1"
                  maxLength={30}
                  pattern="[a-zA-Z0-9_]+"
                />
              </div>
              <div className="text-xs text-aura-text-muted mt-1">3–30 chars: letters, numbers, underscores</div>
            </div>
          )}

          {/* Privacy */}
          {isAdmin && (
            <div>
              <label className="text-xs font-medium text-aura-text-dim uppercase tracking-wide block mb-2">Privacy</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setIsPublic(true)}
                  className={`flex items-center gap-2 p-3 rounded-xl border transition-colors ${
                    isPublic ? 'border-aura-primary bg-aura-primary-dim' : 'border-aura-border hover:border-aura-border-light'
                  }`}
                >
                  <Globe className="w-4 h-4" />
                  <div className="text-left">
                    <div className="text-sm font-medium">Public</div>
                    <div className="text-xs text-aura-text-muted">Anyone can find & join</div>
                  </div>
                </button>
                <button
                  onClick={() => setIsPublic(false)}
                  className={`flex items-center gap-2 p-3 rounded-xl border transition-colors ${
                    !isPublic ? 'border-aura-primary bg-aura-primary-dim' : 'border-aura-border hover:border-aura-border-light'
                  }`}
                >
                  <Lock className="w-4 h-4" />
                  <div className="text-left">
                    <div className="text-sm font-medium">Private</div>
                    <div className="text-xs text-aura-text-muted">Invite link only</div>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Post permissions */}
          {isAdmin && (
            <div>
              <label className="text-xs font-medium text-aura-text-dim uppercase tracking-wide block mb-2">Who Can Post</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setPostPermissions('admins')}
                  className={`flex items-center gap-2 p-3 rounded-xl border text-left transition-colors ${
                    postPermissions === 'admins' ? 'border-aura-primary bg-aura-primary-dim' : 'border-aura-border hover:border-aura-border-light'
                  }`}
                >
                  <Settings className="w-4 h-4" />
                  <div>
                    <div className="text-sm font-medium">Admins only</div>
                    <div className="text-xs text-aura-text-muted">Broadcast channel</div>
                  </div>
                </button>
                <button
                  onClick={() => setPostPermissions('all')}
                  className={`flex items-center gap-2 p-3 rounded-xl border text-left transition-colors ${
                    postPermissions === 'all' ? 'border-aura-primary bg-aura-primary-dim' : 'border-aura-border hover:border-aura-border-light'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  <div>
                    <div className="text-sm font-medium">All members</div>
                    <div className="text-xs text-aura-text-muted">Group-like posting</div>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Invite link */}
          {inviteUrl && (
            <div>
              <label className="text-xs font-medium text-aura-text-dim uppercase tracking-wide block mb-2">
                <Link className="w-3 h-3 inline mr-1" /> Invite Link
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={inviteUrl}
                  readOnly
                  className="input-aura flex-1 text-xs opacity-70 font-mono"
                />
                <button onClick={copyLink} className="btn-secondary px-3">
                  {copiedLink ? <Check className="w-4 h-4 text-aura-online" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          {/* Stats */}
          <div className="flex gap-4 text-sm">
            <div className="flex items-center gap-2 text-aura-text-muted">
              <Users className="w-4 h-4" />
              <span>{chat.subscriberCount ?? chat.members?.length ?? 0} subscribers</span>
            </div>
          </div>

          {error && (
            <div className="px-3 py-2 rounded-lg bg-aura-dnd/10 border border-aura-dnd/30 text-aura-dnd text-sm">{error}</div>
          )}
        </div>

        {/* Actions */}
        <div className="p-5 border-t border-aura-border flex justify-between items-center">
          <button onClick={handleLeave} className="flex items-center gap-2 text-aura-dnd hover:text-red-400 px-3 py-2 rounded-lg hover:bg-aura-dnd/10 transition-colors text-sm">
            <Trash2 className="w-4 h-4" />
            Leave Channel
          </button>
          {isAdmin && (
            <div className="flex gap-2">
              <button onClick={onClose} className="btn-secondary">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary min-w-20">
                {saving ? '...' : saved ? '✓ Saved' : 'Save'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
