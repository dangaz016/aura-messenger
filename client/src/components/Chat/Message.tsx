import { useState, useEffect } from 'react';
import { Timer, Trash2, Smile, Download, FileText } from 'lucide-react';
import { Message as MessageType } from '../../types';
import { useChat } from '../../contexts/ChatContext';
import { useAuth } from '../../contexts/AuthContext';
import { useT } from '../../contexts/LanguageContext';
import { api } from '../../services/api';
import { formatMessageTime, formatEchoTime } from '../../utils/formatters';

const REACTIONS = ['❤️', '👍', '😂', '🔥', '😮', '😢'];

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

        <div className="relative group/bubble">
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

            {message.content && (
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

          {showActions && (
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
