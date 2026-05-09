import { useState, useRef, useEffect } from 'react';
import { Hash, Users, Timer, Trash2, Archive, Pin, PinOff, BellOff, Bell, Radio, LogOut } from 'lucide-react';
import { Chat, UserStatus } from '../../types';
import { Avatar } from '../Common/Avatar';
import { ContextMenu } from '../Common/ContextMenu';
import { ConfirmDialog } from '../Common/ConfirmDialog';
import { formatChatListTime } from '../../utils/formatters';
import { useT } from '../../contexts/LanguageContext';
import { useChat } from '../../contexts/ChatContext';
import { api } from '../../services/api';
import { chatPrefs } from '../../utils/chatPrefs';

interface ChatItemProps {
  chat: Chat;
  active: boolean;
  onClick: () => void;
  userStatus?: UserStatus;
}

export function ChatItem({ chat, active, onClick, userStatus }: ChatItemProps) {
  const { t, lang } = useT();
  const { refreshChats, setActiveChatId } = useChat();
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pinned, setPinned] = useState(() => chatPrefs.isPinned(chat.id));
  const [muted, setMuted] = useState(() => chatPrefs.isMuted(chat.id));
  const [archived, setArchived] = useState(() => chatPrefs.isArchived(chat.id));
  const buttonRef = useRef<HTMLButtonElement>(null);

  const lastMsg = chat.lastMessage;
  const isOnline = chat.type === 'direct' && (userStatus?.isOnline ?? false);
  const auraMode = chat.type === 'direct' ? userStatus?.auraMode ?? chat.otherUser?.auraMode : undefined;

  const lastMsgPreview = (() => {
    if (!lastMsg) return (chat.type === 'space' || chat.type === 'channel') ? chat.description || t('chat_item.welcome_space') : t('chat_item.no_messages');
    if (lastMsg.type === 'image') return '🖼 ' + t('chat_item.image');
    if (lastMsg.type === 'file') return '📎 ' + t('chat_item.file');
    if (lastMsg.type === 'voice') return '🎤 Голосовое';
    if (lastMsg.type === 'video') return '🎥 Видео-кружок';
    return lastMsg.content.length > 50 ? lastMsg.content.slice(0, 50) + '…' : lastMsg.content;
  })();

  const isEcho = !!lastMsg?.echoExpiresAt;

  // Нативный обработчик ПКМ
  useEffect(() => {
    const el = buttonRef.current;
    if (!el) return;
    const handler = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setContextMenu({ x: e.clientX, y: e.clientY });
    };
    el.addEventListener('contextmenu', handler);
    return () => el.removeEventListener('contextmenu', handler);
  }, []);

  async function handleDeleteChat() {
    try {
      await api.leaveChat(chat.id);
      setActiveChatId(null);
      await refreshChats();
    } catch { /* ignore */ }
    setConfirmDelete(false);
  }

  function handlePin() {
    const next = chatPrefs.togglePin(chat.id);
    setPinned(next);
  }

  function handleMute() {
    const next = chatPrefs.toggleMute(chat.id);
    setMuted(next);
  }

  function handleArchive() {
    const next = chatPrefs.toggleArchive(chat.id);
    setArchived(next);
    // Если заархивировали активный чат — сбрасываем выделение
    if (next) setActiveChatId(null);
  }

  const contextMenuItems = [
    {
      label: pinned ? 'Открепить' : 'Закрепить',
      icon: pinned ? PinOff : Pin,
      onClick: handlePin,
    },
    {
      label: muted ? 'Включить звук' : 'Выключить звук',
      icon: muted ? Bell : BellOff,
      onClick: handleMute,
    },
    {
      label: archived ? 'Разархивировать' : 'Архивировать',
      icon: Archive,
      onClick: handleArchive,
    },
    {
      label: chat.type === 'channel' ? 'Покинуть канал' : chat.type === 'group' ? 'Покинуть группу' : t('chat_menu.delete'),
      icon: chat.type === 'channel' || chat.type === 'group' ? LogOut : Trash2,
      onClick: () => setConfirmDelete(true),
      danger: true,
    },
  ];

  return (
    <>
      <button
        ref={buttonRef}
        onClick={onClick}
        className={`w-full flex items-center gap-3 px-3 py-2.5 transition-all duration-150 text-left hover:bg-aura-elevated active:scale-[0.98] ${
          active ? 'bg-aura-primary-dim border-l-2 border-aura-primary' : ''
        } ${archived ? 'opacity-60' : ''}`}
      >
        <div className="relative flex-shrink-0">
          {chat.type === 'space' ? (
            <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold"
              style={{ background: `linear-gradient(135deg, ${chat.avatarColor} 0%, ${chat.avatarColor}cc 100%)` }}>
              <Hash className="w-5 h-5" />
            </div>
          ) : chat.type === 'channel' ? (
            <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold"
              style={{ background: `linear-gradient(135deg, ${chat.avatarColor} 0%, ${chat.avatarColor}cc 100%)` }}>
              <Radio className="w-5 h-5" />
            </div>
          ) : chat.type === 'group' ? (
            <div className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold"
              style={{ background: `linear-gradient(135deg, ${chat.avatarColor} 0%, ${chat.avatarColor}cc 100%)` }}>
              <Users className="w-5 h-5" />
            </div>
          ) : (
            <Avatar
              name={chat.name || '?'}
              color={chat.avatarColor}
              imageUrl={chat.otherUser?.avatarUrl ?? undefined}
              size={44}
              isOnline={isOnline}
              auraMode={auraMode}
            />
          )}

          {/* Закреплённый индикатор */}
          {pinned && (
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-aura-primary rounded-full flex items-center justify-center">
              <Pin className="w-2.5 h-2.5 text-white" />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <div className="font-medium truncate text-sm flex items-center gap-1">
              {chat.name || 'Unknown'}
              {pinned && <Pin className="w-3 h-3 text-aura-primary-light flex-shrink-0" />}
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              {muted && <BellOff className="w-3 h-3 text-aura-text-muted" />}
              {lastMsg && (
                <div className="text-[11px] text-aura-text-muted">
                  {formatChatListTime(lastMsg.createdAt, lang)}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="text-xs text-aura-text-dim truncate flex items-center gap-1">
              {isEcho && <Timer className="w-3 h-3 text-aura-ghost flex-shrink-0" />}
              {chat.type === 'group' && lastMsg && (
                <span className="text-aura-text-muted">{lastMsg.senderName}: </span>
              )}
              <span className="truncate">{lastMsgPreview}</span>
            </div>

            {!muted && chat.unreadCount > 0 && (
              <span className="bg-aura-primary text-white text-[10px] rounded-full px-1.5 py-0.5 min-w-[18px] text-center font-medium flex-shrink-0 glow-primary">
                {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
              </span>
            )}
            {muted && chat.unreadCount > 0 && (
              <span className="bg-aura-surface2 border border-aura-border text-aura-text-muted text-[10px] rounded-full px-1.5 py-0.5 min-w-[18px] text-center font-medium flex-shrink-0">
                {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
              </span>
            )}
          </div>
        </div>
      </button>

      {contextMenu && (
        <ContextMenu
          items={contextMenuItems}
          position={contextMenu}
          onClose={() => setContextMenu(null)}
        />
      )}

      {confirmDelete && (
        <ConfirmDialog
          title={chat.type === 'channel' ? 'Покинуть канал?' : chat.type === 'group' ? 'Покинуть группу?' : t('chat_menu.confirm_delete')}
          message={chat.type === 'direct'
            ? `Удалить переписку с ${chat.name}? Это действие нельзя отменить.`
            : `Вы покинете "${chat.name}". Это действие нельзя отменить.`
          }
          confirmLabel={chat.type === 'direct' ? 'Удалить' : 'Покинуть'}
          cancelLabel="Отмена"
          onConfirm={handleDeleteChat}
          onCancel={() => setConfirmDelete(false)}
          danger
        />
      )}
    </>
  );
}
