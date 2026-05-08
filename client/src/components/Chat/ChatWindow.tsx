import { useEffect, useMemo } from 'react';
import { Phone, Video, MoreVertical, Hash, Users, ShieldCheck } from 'lucide-react';
import { useChat } from '../../contexts/ChatContext';
import { useAuth } from '../../contexts/AuthContext';
import { Avatar } from '../Common/Avatar';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { formatLastSeen } from '../../utils/formatters';

export function ChatWindow() {
  const { user } = useAuth();
  const { chats, activeChatId, loadMessages, userStatuses, typingUsers } = useChat();

  const activeChat = useMemo(() => chats.find(c => c.id === activeChatId), [chats, activeChatId]);

  useEffect(() => {
    if (activeChatId) loadMessages(activeChatId);
  }, [activeChatId, loadMessages]);

  if (!activeChat) {
    return (
      <div className="flex-1 flex items-center justify-center bg-aura-bg gradient-bg">
        <div className="text-center max-w-md px-6">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-3xl gradient-aura glow-primary mb-6">
            <ShieldCheck className="w-12 h-12 text-white" strokeWidth={2} />
          </div>
          <h2 className="text-2xl font-bold mb-2">Welcome to Aura</h2>
          <p className="text-aura-text-dim mb-6">
            Select a chat to start messaging, or create a new one. Everything you send is end-to-end encrypted.
          </p>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="card p-3">
              <div className="font-medium mb-1">Aura Modes</div>
              <div className="text-aura-text-dim text-xs">Ghost, DND, or Available</div>
            </div>
            <div className="card p-3">
              <div className="font-medium mb-1">Echo Messages</div>
              <div className="text-aura-text-dim text-xs">Self-destructing texts</div>
            </div>
            <div className="card p-3">
              <div className="font-medium mb-1">Spaces</div>
              <div className="text-aura-text-dim text-xs">Channels meet forums</div>
            </div>
            <div className="card p-3">
              <div className="font-medium mb-1">Mood Status</div>
              <div className="text-aura-text-dim text-xs">Express yourself</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const otherUserStatus = activeChat.otherUser ? userStatuses.get(activeChat.otherUser.id) : undefined;
  const isOnline = activeChat.type === 'direct' && (otherUserStatus?.isOnline ?? false);
  const auraMode = activeChat.type === 'direct' ? otherUserStatus?.auraMode ?? activeChat.otherUser?.auraMode : undefined;
  const lastSeen = activeChat.otherUser?.lastSeen || 0;

  const typingSet = typingUsers.get(activeChat.id) || new Set();
  const typingNames = Array.from(typingSet)
    .map(uid => activeChat.members.find(m => m.id === uid)?.displayName)
    .filter(Boolean) as string[];

  let subtitle = '';
  if (activeChat.type === 'direct') {
    if (typingNames.length > 0) subtitle = 'typing...';
    else if (auraMode === 'ghost' && !isOnline) subtitle = 'last seen recently';
    else subtitle = formatLastSeen(lastSeen, isOnline);
  } else if (activeChat.type === 'group') {
    subtitle = typingNames.length > 0
      ? `${typingNames.join(', ')} typing...`
      : `${activeChat.members.length} members`;
  } else {
    subtitle = activeChat.description || `${activeChat.members.length} members`;
  }

  return (
    <div className="flex-1 flex flex-col bg-aura-bg">
      <header className="h-16 border-b border-aura-border flex items-center justify-between px-4 bg-aura-surface/40 backdrop-blur-md">
        <div className="flex items-center gap-3 min-w-0">
          {activeChat.type === 'space' ? (
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white"
              style={{ background: `linear-gradient(135deg, ${activeChat.avatarColor} 0%, ${activeChat.avatarColor}cc 100%)` }}
            >
              <Hash className="w-5 h-5" />
            </div>
          ) : activeChat.type === 'group' ? (
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-white"
              style={{ background: `linear-gradient(135deg, ${activeChat.avatarColor} 0%, ${activeChat.avatarColor}cc 100%)` }}
            >
              <Users className="w-5 h-5" />
            </div>
          ) : (
            <Avatar
              name={activeChat.name || '?'}
              color={activeChat.avatarColor}
              size={40}
              isOnline={isOnline}
              auraMode={auraMode}
            />
          )}

          <div className="min-w-0">
            <div className="font-semibold truncate flex items-center gap-2">
              {activeChat.name}
              {activeChat.type === 'direct' && activeChat.otherUser?.publicKey && (
                <ShieldCheck className="w-4 h-4 text-aura-primary-light" />
              )}
            </div>
            <div className={`text-xs truncate ${typingNames.length > 0 ? 'text-aura-primary-light' : 'text-aura-text-dim'}`}>
              {subtitle}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {activeChat.type === 'direct' && (
            <>
              <IconBtn icon={<Phone className="w-5 h-5" />} title="Voice call" />
              <IconBtn icon={<Video className="w-5 h-5" />} title="Video call" />
            </>
          )}
          <IconBtn icon={<MoreVertical className="w-5 h-5" />} title="More" />
        </div>
      </header>

      <MessageList chatId={activeChat.id} />
      <MessageInput chatId={activeChat.id} chatType={activeChat.type} />
    </div>
  );
}

function IconBtn({ icon, title, onClick }: { icon: React.ReactNode; title: string; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="p-2 rounded-lg hover:bg-aura-elevated text-aura-text-dim hover:text-aura-text transition-colors"
    >
      {icon}
    </button>
  );
}
