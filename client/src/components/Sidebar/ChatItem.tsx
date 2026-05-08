import { Hash, Users, Timer } from 'lucide-react';
import { Chat, UserStatus } from '../../types';
import { Avatar } from '../Common/Avatar';
import { formatChatListTime } from '../../utils/formatters';
import { useT } from '../../contexts/LanguageContext';

interface ChatItemProps {
  chat: Chat;
  active: boolean;
  onClick: () => void;
  userStatus?: UserStatus;
}

export function ChatItem({ chat, active, onClick, userStatus }: ChatItemProps) {
  const { t, lang } = useT();
  const lastMsg = chat.lastMessage;
  const isOnline = chat.type === 'direct' && (userStatus?.isOnline ?? false);
  const auraMode = chat.type === 'direct' ? userStatus?.auraMode ?? chat.otherUser?.auraMode : undefined;

  const lastMsgPreview = (() => {
    if (!lastMsg) return chat.type === 'space' ? chat.description || t('chat_item.welcome_space') : t('chat_item.no_messages');
    if (lastMsg.type === 'image') return '🖼 ' + t('chat_item.image');
    if (lastMsg.type === 'file') return '📎 ' + t('chat_item.file');
    return lastMsg.content.length > 50 ? lastMsg.content.slice(0, 50) + '…' : lastMsg.content;
  })();

  const isEcho = !!lastMsg?.echoExpiresAt;

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-3 transition-all duration-200 text-left hover:scale-[1.02] active:scale-[0.98] ${
        active ? 'bg-aura-primary-dim' : 'hover:bg-aura-elevated'
      }`}
    >
      <div className="relative">
        {chat.type === 'space' ? (
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold"
            style={{ background: `linear-gradient(135deg, ${chat.avatarColor} 0%, ${chat.avatarColor}cc 100%)` }}
          >
            <Hash className="w-6 h-6" />
          </div>
        ) : chat.type === 'group' ? (
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold"
            style={{ background: `linear-gradient(135deg, ${chat.avatarColor} 0%, ${chat.avatarColor}cc 100%)` }}
          >
            <Users className="w-6 h-6" />
          </div>
        ) : (
          <Avatar
            name={chat.name || '?'}
            color={chat.avatarColor}
            size={48}
            isOnline={isOnline}
            auraMode={auraMode}
          />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <div className="font-medium truncate text-sm">{chat.name || 'Unknown'}</div>
          {lastMsg && (
            <div className="text-xs text-aura-text-muted flex-shrink-0">
              {formatChatListTime(lastMsg.createdAt, lang)}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="text-xs text-aura-text-dim truncate flex items-center gap-1">
            {isEcho && <Timer className="w-3 h-3 text-aura-ghost flex-shrink-0" />}
            {chat.type === 'group' && lastMsg && (
              <span className="text-aura-text-muted">{lastMsg.senderName}: </span>
            )}
            <span className="truncate">{lastMsgPreview}</span>
          </div>

          {chat.unreadCount > 0 && (
            <span className="bg-aura-primary text-white text-xs rounded-full px-2 py-0.5 min-w-[20px] text-center font-medium flex-shrink-0 animate-scale-in glow-primary">
              {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
