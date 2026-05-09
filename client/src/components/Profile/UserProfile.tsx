import { useState, useEffect } from 'react';
import { X, MessageCircle, Shield, Flag, Copy, Check, Clock, ShieldCheck, Phone, Cake, CalendarDays } from 'lucide-react';
import { User, AuraMode } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { useChat } from '../../contexts/ChatContext';
import { api } from '../../services/api';
import { getInitials } from '../../utils/formatters';
import { PrimePill } from '../Common/PrimeBadge';
import { ReportModal } from '../Common/ReportModal';

interface UserProfileProps {
  userId: string;
  onClose: () => void;
  onStartChat?: () => void;
}

const STATUS_COLOR: Record<AuraMode, string> = {
  available: '#22c55e',
  ghost: '#f59e0b',
  dnd: '#ef4444',
};
const STATUS_LABEL: Record<AuraMode, string> = {
  available: 'Онлайн',
  ghost: 'Призрак',
  dnd: 'Не беспокоить',
};

function lastSeenText(ts: number) {
  if (!ts) return null;
  const mins = Math.floor((Date.now() / 1000 - ts) / 60);
  if (mins < 2) return 'только что';
  if (mins < 60) return `${mins} мин назад`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}ч назад`;
  return `${Math.floor(hrs / 24)}д назад`;
}

function formatBirthday(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const [mm, dd] = raw.split('-');
  const MONTHS = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  const m = parseInt(mm) - 1;
  if (m < 0 || m > 11) return null;
  return `${parseInt(dd)} ${MONTHS[m]}`;
}

export function UserProfile({ userId, onClose, onStartChat }: UserProfileProps) {
  const { user: me } = useAuth();
  const { createDirectChat, setActiveChatId } = useChat();
  const [profile, setProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedUsername, setCopiedUsername] = useState(false);
  const [showReport, setShowReport] = useState(false);

  const isMe = userId === me?.id;

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

  const birthday = formatBirthday(profile?.birthday);

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
        onClick={onClose}>
        <div className="bg-aura-surface border border-aura-border rounded-2xl w-full max-w-sm overflow-hidden animate-scale-in shadow-2xl"
          onClick={e => e.stopPropagation()}>

          {loading ? (
            <div className="p-12 flex items-center justify-center">
              <div className="w-8 h-8 rounded-full border-2 border-aura-primary border-t-transparent animate-spin" />
            </div>
          ) : !profile ? (
            <div className="p-8 text-center text-aura-text-muted">Пользователь не найден</div>
          ) : (
            <>
              {/* Banner */}
              <div className="relative h-28 overflow-hidden"
                style={{ background: `linear-gradient(135deg, ${profile.avatarColor} 0%, ${profile.avatarColor}88 100%)` }}>
                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/30" />
                <button onClick={onClose}
                  className="absolute top-3 right-3 p-1.5 bg-black/30 hover:bg-black/50 rounded-full text-white transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="px-5 pb-5">
                {/* Avatar row */}
                <div className="relative -mt-12 mb-3 flex items-end justify-between">
                  <div className="relative">
                    <div
                      className="w-20 h-20 rounded-full border-4 border-aura-surface flex items-center justify-center text-white text-2xl font-bold shadow-xl overflow-hidden"
                      style={{ background: `linear-gradient(135deg, ${profile.avatarColor} 0%, ${profile.avatarColor}cc 100%)` }}
                    >
                      {profile.avatarUrl
                        ? <img src={profile.avatarUrl} alt="" className="w-full h-full object-cover" />
                        : getInitials(profile.displayName)
                      }
                    </div>
                    {/* Prime animated border indicator */}
                    {profile.isPrime && (
                      <div className="absolute -bottom-1 -right-1 text-base">
                        {profile.primeBadge === 'star' ? '⭐' : profile.primeBadge === 'diamond' ? '💎' : profile.primeBadge === 'fire' ? '🔥' : profile.primeBadge === 'lightning' ? '⚡' : profile.primeBadge === 'crystal' ? '🔮' : '👑'}
                      </div>
                    )}
                    {/* Online dot */}
                    <div className="absolute bottom-1 right-1 w-4 h-4 rounded-full border-2 border-aura-surface"
                      style={{ backgroundColor: STATUS_COLOR[profile.auraMode as AuraMode] || '#6b6b8d' }} />
                  </div>

                  {!isMe && (
                    <div className="flex gap-2 mb-1">
                      <button
                        onClick={handleStartChat}
                        className="flex items-center gap-1.5 bg-aura-primary hover:bg-aura-primary-light text-white px-4 py-2 rounded-xl font-medium transition-colors text-sm"
                      >
                        <MessageCircle className="w-4 h-4" />
                        Написать
                      </button>
                      <button
                        onClick={() => setShowReport(true)}
                        className="p-2 rounded-xl bg-aura-surface2 hover:bg-aura-elevated border border-aura-border transition-colors text-aura-text-muted hover:text-aura-dnd"
                        title="Пожаловаться"
                      >
                        <Flag className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Name + badges */}
                <div className="mb-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-xl font-bold leading-tight">{profile.displayName}</h2>
                    {profile.isAdmin && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-aura-primary/20 text-aura-primary-light flex items-center gap-1">
                        <Shield className="w-3 h-3" /> Admin
                      </span>
                    )}
                    {profile.isPrime && <PrimePill user={profile} />}
                  </div>
                  <button onClick={copyUsername}
                    className="flex items-center gap-1 text-aura-text-muted hover:text-aura-text transition-colors text-sm mt-0.5">
                    {copiedUsername ? <Check className="w-3.5 h-3.5 text-aura-online" /> : <Copy className="w-3.5 h-3.5" />}
                    @{profile.username}
                  </button>
                </div>

                {/* Mood */}
                {(profile.moodEmoji || profile.moodText) && (
                  <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-xl bg-aura-surface2 border border-aura-border">
                    <span className="text-lg">{profile.moodEmoji}</span>
                    <span className="text-sm text-aura-text-dim">{profile.moodText}</span>
                  </div>
                )}

                {/* Bio */}
                {profile.bio && (
                  <div className="mb-3 text-sm text-aura-text-dim leading-relaxed whitespace-pre-wrap break-words">
                    {profile.bio}
                  </div>
                )}

                {/* Info rows */}
                <div className="space-y-2 mb-4">
                  {/* Status */}
                  <div className="flex items-center gap-2.5 text-sm">
                    <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                      <div className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: STATUS_COLOR[profile.auraMode as AuraMode] || '#6b6b8d' }} />
                    </div>
                    <span style={{ color: STATUS_COLOR[profile.auraMode as AuraMode] }}>
                      {STATUS_LABEL[profile.auraMode as AuraMode] || profile.auraMode}
                    </span>
                    {profile.auraMode !== 'available' && profile.lastSeen > 0 && (
                      <span className="text-aura-text-muted flex items-center gap-1 text-xs">
                        <Clock className="w-3 h-3" />
                        {lastSeenText(profile.lastSeen)}
                      </span>
                    )}
                  </div>

                  {/* Birthday */}
                  {birthday && (
                    <div className="flex items-center gap-2.5 text-sm text-aura-text-dim">
                      <Cake className="w-4 h-4 text-pink-400 flex-shrink-0" />
                      <span>День рождения: <span className="text-aura-text">{birthday}</span></span>
                    </div>
                  )}

                  {/* Phone (if visible) */}
                  {profile.phone && (
                    <div className="flex items-center gap-2.5 text-sm text-aura-text-dim">
                      <Phone className="w-4 h-4 text-aura-text-muted flex-shrink-0" />
                      <span>{profile.phone}</span>
                    </div>
                  )}

                  {/* E2E encryption */}
                  {profile.publicKey && (
                    <div className="flex items-center gap-2.5 text-sm text-aura-text-dim">
                      <ShieldCheck className="w-4 h-4 text-aura-primary-light flex-shrink-0" />
                      <span>Сквозное шифрование активно</span>
                    </div>
                  )}

                  {/* Telegram */}
                  {profile.hasTelegram && (
                    <div className="flex items-center gap-2.5 text-sm text-[#2AABEE]">
                      <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.248l-1.97 9.289c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.833.932z"/>
                      </svg>
                      <span>Telegram привязан</span>
                    </div>
                  )}
                </div>

                {/* Footer: joined date */}
                <div className="border-t border-aura-border pt-3 flex items-center gap-2 text-xs text-aura-text-muted">
                  <CalendarDays className="w-3.5 h-3.5" />
                  <span>В Aura с {new Date(profile.createdAt * 1000).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {showReport && profile && (
        <ReportModal
          onClose={() => setShowReport(false)}
          targetUserId={profile.id}
          targetName={profile.displayName}
        />
      )}
    </>
  );
}
