import { useState, useEffect, useRef } from 'react';
import { Timer, Trash2, Smile, Download, FileText, Play, Pause, Reply, Copy, Edit2, Check } from 'lucide-react';
import { Message as MessageType } from '../../types';
import { useChat } from '../../contexts/ChatContext';
import { useAuth } from '../../contexts/AuthContext';
import { useT } from '../../contexts/LanguageContext';
import { api } from '../../services/api';
import { formatMessageTime, formatEchoTime } from '../../utils/formatters';
import { ContextMenu } from '../Common/ContextMenu';

const REACTIONS = ['❤️', '👍', '😂', '🔥', '😮', '😢'];
const PRIME_REACTIONS = ['🌟', '💫', '💎', '👑', '🌈', '✨', '🎭', '🦋', '🌙'];

// ── Voice message player ───────────────────────────────────────────────────

function VoicePlayer({ url, isOwn }: { url: string; isOwn: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    const a = audioRef.current;
    if (!a) return;
    if (playing) { a.pause(); setPlaying(false); }
    else {
      a.play().catch(err => {
        console.error('Audio playback failed:', err);
        setPlaying(false);
      });
      setPlaying(true);
    }
  }

  function fmt(s: number) {
    const v = isFinite(s) ? Math.floor(s) : 0;
    return `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}`;
  }

  const progress = duration > 0 ? currentTime / duration : 0;

  return (
    <div className={`flex items-center gap-2 py-1 pr-1 min-w-[180px] ${isOwn ? '' : ''}`}>
      <audio
        ref={audioRef}
        src={url}
        onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime ?? 0)}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration ?? 0)}
        onEnded={() => { setPlaying(false); setCurrentTime(0); }}
        onError={(e) => {
          console.error('Audio element error:', e);
          setError('Failed to load audio');
        }}
        onCanPlay={() => console.log('Audio can play:', url)}
      />
      <button
        onClick={toggle}
        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
          isOwn ? 'bg-white/20 hover:bg-white/30' : 'bg-aura-primary/20 hover:bg-aura-primary/30'
        }`}
      >
        {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 translate-x-0.5" />}
      </button>

      <div className="flex-1 flex flex-col gap-1">
        {/* Waveform bars */}
        <div className="flex items-center gap-px h-6">
          {Array.from({ length: 28 }).map((_, i) => {
            const barProgress = (i + 1) / 28;
            const filled = barProgress <= progress;
            const height = 8 + Math.abs(Math.sin(i * 0.8 + 1) * 12);
            return (
              <div
                key={i}
                className="rounded-full flex-shrink-0 transition-colors"
                style={{
                  width: '3px',
                  height: `${height}px`,
                  backgroundColor: filled
                    ? (isOwn ? 'rgba(255,255,255,0.9)' : 'var(--aura-accent-light, #A78BFA)')
                    : (isOwn ? 'rgba(255,255,255,0.3)' : 'rgba(124,58,237,0.3)'),
                }}
              />
            );
          })}
        </div>
        <div className="text-[10px] opacity-60">{fmt(currentTime)} / {fmt(duration)}</div>
        {error && <div className="text-[10px] text-red-400">{error}</div>}
      </div>
    </div>
  );
}

// ── Video circle ───────────────────────────────────────────────────────────

function VideoCircle({ url }: { url: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  function toggle() {
    const v = videoRef.current;
    if (!v) return;
    if (playing) { v.pause(); setPlaying(false); }
    else { v.play(); setPlaying(true); }
  }

  return (
    <div className="relative w-40 h-40 cursor-pointer" onClick={toggle}>
      <video
        ref={videoRef}
        src={url}
        className="w-full h-full object-cover rounded-full"
        loop={false}
        playsInline
        onTimeUpdate={() => {
          const v = videoRef.current;
          if (v && v.duration) setProgress(v.currentTime / v.duration);
        }}
        onEnded={() => { setPlaying(false); setProgress(0); }}
      />
      {/* Circular progress ring */}
      <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="48" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="3" />
        <circle
          cx="50" cy="50" r="48" fill="none"
          stroke="rgba(255,255,255,0.85)" strokeWidth="3"
          strokeDasharray={`${301.6 * progress} 301.6`}
          strokeLinecap="round"
        />
      </svg>
      {/* Play/pause overlay */}
      {!playing && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-full">
          <Play className="w-10 h-10 text-white translate-x-1 drop-shadow" />
        </div>
      )}
    </div>
  );
}

// Explosion particle colors
const PARTICLE_COLORS = ['#7C3AED', '#A78BFA', '#EC4899', '#F472B6', '#F59E0B', '#60A5FA', '#34D399', '#FB7185'];

interface MessageProps {
  message: MessageType;
  isOwn: boolean;
  isFirstInGroup: boolean;
  showSender: boolean;
  isExploding?: boolean;
  onReply?: (target: { id: string; senderName: string; content: string; type: string }) => void;
}

export function Message({ message, isOwn, isFirstInGroup, showSender, isExploding = false, onReply }: MessageProps) {
  const { user } = useAuth();
  const { deleteMessage, editMessage, toggleReaction } = useChat();
  const { t } = useT();
  const [showActions, setShowActions] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editText, setEditText] = useState(message.content);
  const [copied, setCopied] = useState(false);
  const [, setTick] = useState(0);
  const editInputRef = useRef<HTMLTextAreaElement>(null);

  const isEcho = !!message.echoExpiresAt;
  useEffect(() => {
    if (!isEcho) return;
    const timer = setInterval(() => setTick(x => x + 1), 1000);
    return () => clearInterval(timer);
  }, [isEcho]);

  useEffect(() => {
    if (editMode && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.selectionStart = editInputRef.current.value.length;
    }
  }, [editMode]);

  const reactionGroups = message.reactions.reduce((acc, r) => {
    if (!acc[r.emoji]) acc[r.emoji] = [];
    acc[r.emoji].push(r.userId);
    return acc;
  }, {} as Record<string, string[]>);

  const isImage = message.type === 'image' || (message.fileMime && message.fileMime.startsWith('image/'));
  const isVoice = message.type === 'voice';
  const isVideoCircle = message.type === 'video';
  const isText = message.type === 'text';
  const fileUrl = message.fileId ? api.fileUrl(message.fileId) : null;

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  }

  function handleReply() {
    onReply?.({
      id: message.id,
      senderName: message.senderName,
      content: message.content,
      type: message.type,
    });
  }

  function handleCopy() {
    if (!message.content) return;
    navigator.clipboard.writeText(message.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  function handleEdit() {
    setEditText(message.content);
    setEditMode(true);
  }

  function handleEditSave() {
    const trimmed = editText.trim();
    if (!trimmed || trimmed === message.content) { setEditMode(false); return; }
    editMessage(message.id, trimmed);
    setEditMode(false);
  }

  function handleEditKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleEditSave(); }
    if (e.key === 'Escape') { setEditMode(false); setEditText(message.content); }
  }

  const menuItems = [
    ...(onReply ? [{ label: 'Ответить', icon: Reply, onClick: handleReply }] : []),
    ...(isText && message.content ? [{ label: copied ? 'Скопировано!' : 'Копировать текст', icon: copied ? Check : Copy, onClick: handleCopy }] : []),
    ...(isOwn && isText ? [{ label: 'Редактировать', icon: Edit2, onClick: handleEdit }] : []),
    { label: 'Реакция', icon: Smile, onClick: () => setShowReactions(true) },
    ...(isOwn ? [{ label: 'Удалить', icon: Trash2, onClick: () => deleteMessage(message.id), danger: true }] : []),
  ];

  return (
    <div
      className={`group flex items-end gap-2 ${isOwn ? 'justify-end' : 'justify-start'} ${isFirstInGroup ? 'mt-3' : 'mt-0.5'}`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => { setShowActions(false); setShowReactions(false); }}
    >
      {!isOwn && (
        <div className="w-8 flex-shrink-0">
          {isFirstInGroup && (
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold cursor-pointer hover:opacity-80 transition-opacity"
              style={{ background: `linear-gradient(135deg, ${message.senderAvatarColor} 0%, ${message.senderAvatarColor}cc 100%)` }}
            >
              {message.senderName.split(/\s+/).map(p => p[0]).join('').slice(0, 2).toUpperCase()}
            </div>
          )}
        </div>
      )}

      <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} max-w-[70%]`}>
        {showSender && (
          <div className="text-xs px-3 mb-0.5" style={{ color: message.senderAvatarColor }}>
            {message.senderName}
          </div>
        )}

        {/* Video circle — no bubble, just round video */}
        {isVideoCircle && fileUrl && (
          <div className="relative group/bubble mb-1" onContextMenu={handleContextMenu}>
            <VideoCircle url={fileUrl} />
            <div className={`absolute bottom-1 ${isOwn ? 'right-2' : 'left-2'} text-[10px] text-white/80 drop-shadow`}>
              {formatMessageTime(message.createdAt)}
            </div>
            {showActions && (
              <div className={`absolute top-0 ${isOwn ? '-left-16' : '-right-16'} flex gap-1`}>
                {isOwn && (
                  <button
                    onClick={() => deleteMessage(message.id)}
                    className="p-1.5 bg-aura-elevated rounded-full hover:bg-aura-dnd text-aura-text-dim hover:text-white transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        <div className="relative group/bubble" onContextMenu={!isVideoCircle ? handleContextMenu : undefined}>
          {/* Explosion particles */}
          {isExploding && Array.from({ length: 8 }).map((_, i) => {
            const angle = (i / 8) * 360;
            const dist = 35 + (i % 3) * 12;
            const dx = Math.cos(angle * Math.PI / 180) * dist;
            const dy = Math.sin(angle * Math.PI / 180) * dist;
            return (
              <div
                key={i}
                className="explode-particle"
                style={{
                  '--dx': `${dx}px`,
                  '--dy': `${dy}px`,
                  backgroundColor: PARTICLE_COLORS[i % PARTICLE_COLORS.length],
                  left: '50%', top: '50%',
                  marginLeft: '-3.5px', marginTop: '-3.5px',
                  animationDelay: `${i * 30}ms`,
                } as React.CSSProperties}
              />
            );
          })}

          {!isVideoCircle && (
          <div
            className={`relative px-3 py-2 rounded-2xl ${isOwn ? 'message-bubble-out rounded-br-md' : 'message-bubble-in rounded-bl-md'} ${isEcho ? 'echo-pulse' : ''} ${isExploding ? 'echo-explode' : ''}`}
          >
            {/* Reply quote bubble */}
            {message.replyToId && message.replyContent != null && (
              <div className={`mb-1.5 -mx-1 px-2 py-1.5 rounded-lg border-l-2 ${isOwn ? 'bg-white/10 border-white/40' : 'bg-aura-surface2 border-aura-primary/60'}`}>
                <div className={`flex items-center gap-1 mb-0.5 ${isOwn ? 'text-white/80' : 'text-aura-primary-light'} text-[11px] font-semibold`}>
                  <Reply className="w-3 h-3" />
                  <span className="truncate">{message.replySenderName}</span>
                </div>
                <div className={`text-xs truncate ${isOwn ? 'text-white/65' : 'text-aura-text-muted'}`}>
                  {message.replyType === 'voice' ? '🎤 Голосовое'
                    : message.replyType === 'video' ? '🎥 Кружок'
                    : message.replyType === 'image' ? '🖼 Фото'
                    : message.replyContent}
                </div>
              </div>
            )}

            {isImage && fileUrl && (
              <a href={fileUrl} target="_blank" rel="noreferrer" className="block mb-1 -mx-1 -mt-1">
                <img
                  src={fileUrl}
                  alt={message.fileName || ''}
                  className="rounded-xl max-w-full max-h-72 object-cover"
                />
              </a>
            )}

            {isVoice && fileUrl && (
              <VoicePlayer url={fileUrl} isOwn={isOwn} />
            )}

            {message.type === 'file' && fileUrl && !isImage && (
              <a
                href={fileUrl}
                download={message.fileName || 'file'}
                className="flex items-center gap-2 mb-1 -mx-1 px-2 py-2 rounded-lg hover:bg-black/20"
              >
                <FileText className="w-8 h-8 flex-shrink-0" />
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{message.fileName}</div>
                  <div className="text-xs opacity-70">{t('message.click_download')}</div>
                </div>
                <Download className="w-4 h-4 flex-shrink-0" />
              </a>
            )}

            {/* Edit mode inline input */}
            {editMode ? (
              <div className="flex flex-col gap-1">
                <textarea
                  ref={editInputRef}
                  value={editText}
                  onChange={e => setEditText(e.target.value)}
                  onKeyDown={handleEditKeyDown}
                  className="bg-transparent resize-none text-sm w-full outline-none min-w-[160px]"
                  rows={Math.max(1, editText.split('\n').length)}
                />
                <div className="flex gap-2 text-[11px]">
                  <button onClick={handleEditSave} className="text-aura-online hover:underline">Сохранить</button>
                  <button onClick={() => { setEditMode(false); setEditText(message.content); }} className="opacity-60 hover:underline">Отмена</button>
                </div>
              </div>
            ) : (
              message.content && !isVoice && (
                <div className="text-sm whitespace-pre-wrap break-words leading-relaxed">{message.content}</div>
              )
            )}

            <div className={`flex items-center gap-1.5 mt-1 text-[10px] ${isOwn ? 'text-white/70' : 'text-aura-text-muted'}`}>
              {isEcho && (
                <>
                  <Timer className="w-3 h-3" />
                  <span>{formatEchoTime(message.echoExpiresAt!)}</span>
                  <span>·</span>
                </>
              )}
              <span>{formatMessageTime(message.createdAt)}</span>
              {message.editedAt && (
                <span className="opacity-60">· изм.</span>
              )}
            </div>
          </div>
          )}

          {/* Hover action buttons */}
          {showActions && !isVideoCircle && !editMode && (
            <div className={`absolute top-0 ${isOwn ? '-left-24' : '-right-24'} flex gap-1 opacity-0 group-hover/bubble:opacity-100 transition-opacity`}>
              {onReply && (
                <button
                  onClick={handleReply}
                  className="p-1.5 bg-aura-elevated rounded-full hover:bg-aura-primary text-aura-text-dim hover:text-white transition-colors"
                  title="Ответить"
                >
                  <Reply className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                onClick={() => setShowReactions(!showReactions)}
                className="p-1.5 bg-aura-elevated rounded-full hover:bg-aura-primary text-aura-text-dim hover:text-white transition-colors"
                title={t('message.react')}
              >
                <Smile className="w-3.5 h-3.5" />
              </button>
              {isOwn && (
                <button
                  onClick={() => deleteMessage(message.id)}
                  className="p-1.5 bg-aura-elevated rounded-full hover:bg-aura-dnd text-aura-text-dim hover:text-white transition-colors"
                  title={t('message.delete')}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}

          {showReactions && (
            <div className={`absolute ${user?.isPrime ? '-top-[4.5rem]' : '-top-10'} ${isOwn ? 'right-0' : 'left-0'} bg-aura-elevated border border-aura-border rounded-2xl px-2 py-1.5 flex flex-col gap-1 shadow-lg z-10`}>
              <div className="flex gap-1">
                {REACTIONS.map(emoji => (
                  <button
                    key={emoji}
                    onClick={() => { toggleReaction(message.id, emoji); setShowReactions(false); }}
                    className="hover:scale-125 transition-transform p-1"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
              {user?.isPrime && (
                <>
                  <div className="border-t border-aura-border/50 mx-1" />
                  <div className="flex gap-1 items-center">
                    <span className="text-[9px] text-violet-400 font-semibold px-1">Prime</span>
                    {PRIME_REACTIONS.map(emoji => (
                      <button
                        key={emoji}
                        onClick={() => { toggleReaction(message.id, emoji); setShowReactions(false); }}
                        className="hover:scale-125 transition-transform p-1"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {Object.keys(reactionGroups).length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1 px-1">
            {Object.entries(reactionGroups).map(([emoji, userIds]) => (
              <button
                key={emoji}
                onClick={() => toggleReaction(message.id, emoji)}
                className={`text-xs px-2 py-0.5 rounded-full border ${
                  userIds.includes(user?.id || '')
                    ? 'bg-aura-primary-dim border-aura-primary/50'
                    : 'bg-aura-elevated border-aura-border'
                } hover:border-aura-primary transition-colors`}
              >
                {emoji} {userIds.length}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Context menu */}
      {contextMenu && menuItems.length > 0 && (
        <ContextMenu
          items={menuItems}
          position={contextMenu}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
