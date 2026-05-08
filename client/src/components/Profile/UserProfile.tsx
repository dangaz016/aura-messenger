import { useState, useEffect } from 'react';
import { X, MessageCircle, UserCheck, UserX, Shield, Flag, Copy, Check, Clock } from 'lucide-react';
import { User, AuraMode } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { useChat } from '../../contexts/ChatContext';
import { api } from '../../services/api';
import { getInitials } from '../../utils/formatters';

interface UserProfileProps {
  userId: string;
  onClose: () => void;
  onStartChat?: () => void;
}

export function UserProfile({ userId, onClose, onStartChat }: UserProfileProps) {
  const { user: me } = useAuth();
  const { createDirectChat, setActiveChatId } = useChat();
  const [profile, setProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedUsername, setCopiedUsername] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reporting, setReporting] = useState(false);
  const [reported, setReported] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.getUser(userId)
      .then(u => setProfile(u))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [userId]);

  async function handleStartChat() {
    if (!profile) return;
    const chat = await createDirectChat(profile.id);
    setActiveChatId(chat.id);
    onClose();
    onStartChat?.();
  }

  function copyUsername() {
    if (!profile) return;
    navigator.clipboard.writeText(`@${profile.username}`);
    setCopiedUsername(true);
    setTimeout(() => setCopiedUsername(false), 2000);
  }

  async function handleReport() {
    if (!profile || !reportReason.trim()) return;
    setReporting(true);
    try {
      await api.reportUser(profile.id, reportReason.trim());
      setReported(true);
      setTimeout(() => setShowReport(false), 2000);
    } catch { /* ignore */ }
    setReporting(false);
  }

  const statusColor = {
    available: '#22c55e',
    ghost: '#f59e0b',
    dnd: '#ef4444',
  };
  const statusLabel = {
    available: 'Online',
    ghost: 'Ghost mode',
    dnd: 'Do Not Disturb',
  };
  const lastSeenText = (ts: number) => {
    const mins = Math.floor((Date.now() / 1000 - ts) / 60);
    if (mins < 2) return 'just now';
    if (mins < 60) return `${mins} min ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}>
      <div className="bg-aura-surface border border-aura-border rounded-2xl w-full max-w-sm overflow-hidden animate-scale-in"
        onClick={e => e.stopPropagation()}>

        {loading ? (
          <div className="p-12 flex items-center justify-center">
            <div className="w-8 h-8 rounded-full border-2 border-aura-primary border-t-transparent animate-spin" />
          </div>
        ) : !profile ? (
          <div className="p-8 text-center text-aura-text-muted">User not found</div>
        ) : (
          <>
            {/* Header gradient banner */}
            <div className="relative h-28" style={{ background: `linear-gradient(135deg, ${profile.avatarColor} 0%, ${profile.avatarColor}88 100%)` }}>
              <button onClick={onClose} className="absolute top-3 right-3 p-1.5 bg-black/30 hover:bg-black/50 rounded-full text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Avatar */}
            <div className="px-5 pb-1">
              <div className="relative -mt-12 mb-3 inline-flex">
                <div
                  className="w-20 h-20 rounded-full border-4 border-aura-surface flex items-center justify-center text-white text-2xl font-bold shadow-xl"
                  style={{ background: `linear-gradient(135deg, ${profile.avatarColor} 0%, ${profile.avatarColor}cc 100%)` }}
                >
                  {profile.avatarUrl ? (
                    <img src={profile.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
                  ) : (
                    getInitials(profile.displayName)
                  )}
                </div>
                {/* Status indicator */}
                <div className="absolute bottom-1 right-1 w-4 h-4 rounded-full border-2 border-aura-surface"
                  style={{ backgroundColor: statusColor[profile.auraMode as AuraMode] || '#6b6b8d' }} />
              </div>

              {/* Name + username */}
              <div className="mb-3">
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold truncate">{profile.displayName}</h2>
                  {profile.isAdmin && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-aura-primary/20 text-aura-primary-light flex items-center gap-1">
                      <Shield className="w-3 h-3" /> Admin
                    </span>
                  )}
                </div>
                <button
                  onClick={copyUsername}
                  className="flex items-center gap-1 text-aura-text-muted hover:text-aura-text transition-colors text-sm mt-0.5"
                >
                  {copiedUsername ? <Check className="w-3.5 h-3.5 text-aura-online" /> : <Copy className="w-3.5 h-3.5" />}
                  @{profile.username}
                </button>
              </div>

              {/* Mood */}
              {(profile.moodEmoji || profile.moodText) && (
                <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-xl bg-aura-surface2">
                  <span className="text-lg">{profile.moodEmoji}</span>
                  <span className="text-sm text-aura-text-dim">{profile.moodText}</span>
                </div>
              )}

              {/* Bio */}
              {profile.bio && (
                <div className="mb-3 text-sm text-aura-text-dim leading-relaxed">{profile.bio}</div>
              )}

              {/* Status */}
              <div className="flex items-center gap-2 mb-4 text-sm">
                <div className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: statusColor[profile.auraMode as AuraMode] || '#6b6b8d' }} />
                <span style={{ color: statusColor[profile.auraMode as AuraMode] }}>
                  {statusLabel[profile.auraMode as AuraMode] || profile.auraMode}
                </span>
                {profile.auraMode !== 'available' && (
                  <span className="text-aura-text-muted flex items-center gap-1 ml-1">
                    <Clock className="w-3 h-3" />
                    {lastSeenText(profile.lastSeen)}
                  </span>
                )}
              </div>

              {/* Actions */}
              {me?.id !== profile.id && (
                <div className="flex gap-2 mb-4">
                  <button
                    onClick={handleStartChat}
                    className="flex-1 flex items-center justify-center gap-2 bg-aura-primary hover:bg-aura-primary-light text-white px-4 py-2.5 rounded-xl font-medium transition-colors"
                  >
                    <MessageCircle className="w-4 h-4" />
                    Message
                  </button>
                  <button
                    onClick={() => setShowReport(true)}
                    className="p-2.5 rounded-xl bg-aura-surface2 hover:bg-aura-elevated border border-aura-border transition-colors text-aura-text-muted hover:text-aura-dnd"
                    title="Report"
                  >
                    <Flag className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Info rows */}
              <div className="border-t border-aura-border pt-3 pb-4 space-y-2 text-xs text-aura-text-muted">
                <div className="flex justify-between">
                  <span>Member since</span>
                  <span>{new Date(profile.createdAt * 1000).toLocaleDateString()}</span>
                </div>
              </div>
            </div>

            {/* Report modal */}
            {showReport && (
              <div className="border-t border-aura-border p-4">
                <div className="text-sm font-medium mb-2 flex items-center gap-2 text-aura-dnd">
                  <Flag className="w-4 h-4" /> Report user
                </div>
                {reported ? (
                  <div className="flex items-center gap-2 text-aura-online text-sm">
                    <Check className="w-4 h-4" /> Reported successfully
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={reportReason}
                      onChange={e => setReportReason(e.target.value)}
                      placeholder="Reason (spam, abuse, etc.)"
                      className="flex-1 bg-aura-surface2 border border-aura-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-aura-dnd"
                    />
                    <button
                      onClick={handleReport}
                      disabled={reporting || !reportReason.trim()}
                      className="px-3 py-1.5 bg-aura-dnd/20 hover:bg-aura-dnd/30 text-aura-dnd rounded-lg text-sm disabled:opacity-50 transition-colors"
                    >
                      {reporting ? '...' : 'Send'}
                    </button>
                    <button onClick={() => setShowReport(false)} className="px-3 py-1.5 bg-aura-elevated rounded-lg text-sm">
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
