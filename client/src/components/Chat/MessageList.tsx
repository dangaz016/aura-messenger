import { useEffect, useRef } from 'react';
import { useChat } from '../../contexts/ChatContext';
import { useAuth } from '../../contexts/AuthContext';
import { Message } from './Message';

interface MessageListProps {
  chatId: string;
}

export function MessageList({ chatId }: MessageListProps) {
  const { messages, typingUsers, chats } = useChat();
  const { user } = useAuth();
  const containerRef = useRef<HTMLDivElement>(null);
  const messageList = messages.get(chatId) || [];

  const chat = chats.find(c => c.id === chatId);
  const typingSet = typingUsers.get(chatId) || new Set();
  const typingNames = Array.from(typingSet)
    .filter(uid => uid !== user?.id)
    .map(uid => chat?.members.find(m => m.id === uid)?.displayName)
    .filter(Boolean) as string[];

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messageList.length, typingNames.length, chatId]);

  if (messageList.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-aura-text-muted text-sm">
        <div className="text-center">
          <div className="text-2xl mb-2">✨</div>
          <div>No messages yet</div>
          <div className="text-xs mt-1">Send the first one to start the conversation</div>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
      {messageList.map((msg, i) => {
        const prev = messageList[i - 1];
        const isFirstInGroup = !prev || prev.senderId !== msg.senderId || (msg.createdAt - prev.createdAt) > 300;
        const isOwn = msg.senderId === user?.id;
        return (
          <Message
            key={msg.id}
            message={msg}
            isOwn={isOwn}
            isFirstInGroup={isFirstInGroup}
            showSender={chat?.type !== 'direct' && !isOwn && isFirstInGroup}
          />
        );
      })}

      {typingNames.length > 0 && (
        <div className="flex items-center gap-2 px-3 py-1 text-aura-text-dim text-sm animate-fade-in">
          <div>
            <span className="typing-dot" />
            <span className="typing-dot" />
            <span className="typing-dot" />
          </div>
          <span className="text-xs">{typingNames.join(', ')} typing...</span>
        </div>
      )}
    </div>
  );
}
