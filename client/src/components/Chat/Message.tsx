import { useState, useEffect, useRef } from 'react';
import { Timer, Trash2, Smile, Download, FileText, Play, Pause } from 'lucide-react';
import { Message as MessageType } from '../../types';
import { useChat } from '../../contexts/ChatContext';
import { useAuth } from '../../contexts/AuthContext';
import { useT } from '../../contexts/LanguageContext';
import { api } from '../../services/api';
import { formatMessageTime, formatEchoTime } from '../../utils/formatters';

const REACTIONS = ['❤️', '👍', '😂', '🔥', '😮', '😢'];

// ── Voice message player ───────────────────────────────────────────────────

function VoicePlayer({ url, isOwn }: { url: string; isOwn: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  function toggle() {
    const a = audioRef.current;
    if (!a) return;
    if (playing) { a.pause(); setPlaying(false); }
    else { a.play(); setPlaying(true); }
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
                className="w-1 rounded-full transition-colors"
                style={{
                  height: `${height}px`,
                  backgroundColor: filled
                    ? (isOwn ? 'rgba(255,255,255,0.9)' : 'var(--color-aura-primary, #7C3AED)')
                    : (isOwn ? 'rgba(255,255,255,0.35)' : 'rgba(124,58,237,0.3)'),
                }}
              />
            );
          })}
        </div>
        <div className={`text-[10px] ${isOwn ? 'text-white/60' : 'text-aura-text-muted'}`}>
          {playing ? fmt(currentTime) : fmt(duration)} {!playing && duration > 0 ? '' : ''}
        </div>
      </div>
    </div>
  );
}

// ── Video circle player ────────────────────────────────────────────────────

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

interface MessageProps {
  message: MessageType;
  isOwn: boolean;
  isFirstInGroup: boolean;
  showSender: boolean;
}

export function Message({ message, isOwn, isFirstInGroup, showSender }: MessageProps) {
  const { user } = useAuth();
  const { deleteMessage, toggleReaction } = useChat();
  const { t } = useT();
  const [showActions, setShowActions] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [, setTick] = useState(0);

  const isEcho = !!message.echoExpiresAt;
  useEffect(() => {
    if (!isEcho) return;
    const t = setInterval(() => setTick(x => x + 1), 1000);
    return () => clearInterval(t);
  }, [isEcho]);

  const reactionGroups = message.reactions.reduce((acc, r) => {
    if (!acc[r.emoji]) acc[r.emoji] = [];
    acc[r.emoji].push(r.userId);
    return acc;
  }, {} as Record<string, string[]>);

  const isImage = message.type === 'image' || (message.fileMime && message.fileMime.startsWith('image/'));
  const isVoice = message.type === 'voice';
  const isVideoCircle = message.type === 'video';
  const fileUrl = message.fileId ? api.fileUrl(message.fileId) : null;

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
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold"
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
          <div className="relative group/bubble mb-1">
            <VideoCircle url={fileUrl} />
            <div className={`absolute bottom-1 ${isOwn ? 'right-2' : 'left-2'} text-[10px] text-white/80 drop-shadow`}>
              {formatMessageTime(message.createdAt)}
            </div>
            {showActions && (
              <div className={`absolute top-0 ${isOwn ? '-left-16' : '-right-16'} flex gap-1 opacity-0 group-hover/bubble:opacity-100 transition-opacity`}>
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

        <div className="relative group/bubble">
          {!isVideoCircle && (
          <div
            className={`relative px-3 py-2 rounded-2xl ${isOwn ? 'message-bubble-out rounded-br-md' : 'message-bubble-in rounded-bl-md'} ${isEcho ? 'echo-pulse' : ''}`}
          >
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

            {message.content && !isVoice && (
              <div className="text-sm whitespace-pre-wrap break-words leading-relaxed">{message.content}</div>
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
            </div>
          </div>
          )}

          {showActions && !isVideoCircle && (
            <div className={`absolute top-0 ${isOwn ? '-left-20' : '-right-20'} flex gap-1 opacity-0 group-hover/bubble:opacity-100 transition-opacity`}>
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
            <div className={`absolute -top-10 ${isOwn ? 'right-0' : 'left-0'} bg-aura-elevated border border-aura-border rounded-full px-2 py-1 flex gap-1 shadow-lg z-10`}>
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
    </div>
  );
}
