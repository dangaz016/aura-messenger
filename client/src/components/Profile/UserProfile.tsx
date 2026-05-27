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

function formatSocialLinks(socialLinks: Record<string, string> | null | undefined): { platform: string; url: string; icon: JSX.Element }[] {
  if (!socialLinks) return [];
  return Object.entries(socialLinks).map(([platform, url]) => {
    const icons: Record<string, JSX.Element> = {
      twitter: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/></svg>,
      instagram: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>,
      github: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>,
      linkedin: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>,
      youtube: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>,
    };
    return { platform, url, icon: icons[platform] || <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/></svg> };
  });
}

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
                  {/* Website */}
                  {profile.website && (
                    <div className="flex items-center gap-2.5 text-sm text-aura-text-dim">
                      <svg className="w-4 h-4 text-aura-text-muted flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1.41 15.71L6.5 12.59V11h10.99v1.59l-4.09 3.12-1.09-4.04-3.3 2.58zM13.5 6.31c-.28 0-.5.22-.5.5s.22.5.5.5.5-.22.5-.5-.22-.5-.5-.5zm-3 0c-.28 0-.5.22-.5.5s.22.5.5.5.5-.22.5-.5-.22-.5-.5-.5z"/>
                      </svg>
                      <a href={profile.website} target="_blank" rel="noopener noreferrer" className="hover:text-aura-primary transition-colors">
                        {profile.website ? profile.website.replace(/^https?:\/\//, '') : ''}
                      </a>
                    </div>
                  )}
                  {/* Location */}
                  {profile.location && (
                    <div className="flex items-center gap-2.5 text-sm text-aura-text-dim">
                      <svg className="w-4 h-4 text-aura-text-muted flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                      </svg>
                      <span>{profile.location}</span>
                    </div>
                  )}
                  {/* Social Links */}
                  {profile.socialLinks && Object.keys(profile.socialLinks).length > 0 && (
                    <div className="flex items-center gap-3 text-sm">
                      {formatSocialLinks(profile.socialLinks).map(({ platform, url, icon }) => (
                        <a key={platform} href={url} target="_blank" rel="noopener noreferrer"
                          className="text-aura-text-muted hover:text-aura-text transition-colors" title={platform}>
                          {icon}
                        </a>
                      ))}
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
