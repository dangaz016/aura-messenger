import { createContext, useContext, useEffect, useState, useCallback, ReactNode, useRef } from 'react';
import { Chat, Message, UserStatus, TypingEvent, AuraMode } from '../types';
import { api } from '../services/api';
import { socketService } from '../services/socket';
import { useAuth } from './AuthContext';

interface ChatContextValue {
  chats: Chat[];
  activeChatId: string | null;
  setActiveChatId: (id: string | null) => void;
  messages: Map<string, Message[]>;
  loadMessages: (chatId: string) => Promise<void>;
  sendMessage: (chatId: string, content: string, opts?: { type?: 'text' | 'file' | 'image'; fileId?: string; echoDuration?: number }) => void;
  refreshChats: () => Promise<void>;
  createDirectChat: (userId: string) => Promise<Chat>;
  createGroupChat: (name: string, memberIds: string[], description?: string) => Promise<Chat>;
  createSpace: (name: string, description: string) => Promise<Chat>;
  userStatuses: Map<string, UserStatus>;
  typingUsers: Map<string, Set<string>>;
  startTyping: (chatId: string) => void;
  stopTyping: (chatId: string) => void;
  deleteMessage: (messageId: string) => void;
  toggleReaction: (messageId: string, emoji: string) => void;
  updateAuraMode: (mode: AuraMode) => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const { user, updateUser } = useAuth();
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Map<string, Message[]>>(new Map());
  const [userStatuses, setUserStatuses] = useState<Map<string, UserStatus>>(new Map());
  const [typingUsers, setTypingUsers] = useState<Map<string, Set<string>>>(new Map());
  const typingTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const refreshChats = useCallback(async () => {
    if (!user) return;
    const data = await api.getChats();
    setChats(data);
  }, [user]);

  useEffect(() => {
    if (user) refreshChats();
  }, [user, refreshChats]);

  useEffect(() => {
    if (!user) return;

    const unsubMsg = socketService.onMessage((msg) => {
      setMessages((prev) => {
        const next = new Map(prev);
        const list = next.get(msg.chatId) || [];
        if (list.find((m) => m.id === msg.id)) return prev;
        next.set(msg.chatId, [...list, msg]);
        return next;
      });
      refreshChats();
    });

    const unsubStatus = socketService.onUserStatus((s) => {
      setUserStatuses((prev) => {
        const next = new Map(prev);
        next.set(s.userId, s);
        return next;
      });
    });

    const unsubTyping = socketService.onTyping((t: TypingEvent) => {
      setTypingUsers((prev) => {
        const next = new Map(prev);
        const chatTyping = new Set(next.get(t.chatId) || []);
        if (t.isTyping) chatTyping.add(t.userId);
        else chatTyping.delete(t.userId);
        next.set(t.chatId, chatTyping);
        return next;
      });

      if (t.isTyping) {
        const key = `${t.chatId}:${t.userId}`;
        const old = typingTimers.current.get(key);
        if (old) clearTimeout(old);
        const timer = setTimeout(() => {
          setTypingUsers((prev) => {
            const next = new Map(prev);
            const chatTyping = new Set(next.get(t.chatId) || []);
            chatTyping.delete(t.userId);
            next.set(t.chatId, chatTyping);
            return next;
          });
        }, 5000);
        typingTimers.current.set(key, timer);
      }
    });

    const unsubDel = socketService.onMessageDeleted((d) => {
      setMessages((prev) => {
        const next = new Map(prev);
        const list = next.get(d.chatId);
        if (list) next.set(d.chatId, list.filter((m) => m.id !== d.messageId));
        return next;
      });
      refreshChats();
    });

    const unsubReact = socketService.onReaction((d) => {
      setMessages((prev) => {
        const next = new Map(prev);
        const list = next.get(d.chatId);
        if (!list) return prev;
        next.set(d.chatId, list.map((m) => {
          if (m.id !== d.messageId) return m;
          const reactions = [...m.reactions];
          if (d.added) {
            reactions.push({ userId: d.userId, emoji: d.emoji });
          } else {
            const idx = reactions.findIndex(r => r.userId === d.userId && r.emoji === d.emoji);
            if (idx >= 0) reactions.splice(idx, 1);
          }
          return { ...m, reactions };
        }));
        return next;
      });
    });

    return () => {
      unsubMsg(); unsubStatus(); unsubTyping(); unsubDel(); unsubReact();
    };
  }, [user, refreshChats]);

  const loadMessages = useCallback(async (chatId: string) => {
    const data = await api.getMessages(chatId);
    setMessages((prev) => {
      const next = new Map(prev);
      next.set(chatId, data);
      return next;
    });
    await api.markRead(chatId).catch(() => {});
    refreshChats();
  }, [refreshChats]);

  const sendMessage = useCallback((chatId: string, content: string, opts: { type?: 'text' | 'file' | 'image'; fileId?: string; echoDuration?: number } = {}) => {
    socketService.sendMessage(chatId, content, opts);
  }, []);

  const createDirectChat = useCallback(async (userId: string) => {
    const chat = await api.createChat('direct', [userId]);
    await refreshChats();
    return chat;
  }, [refreshChats]);

  const createGroupChat = useCallback(async (name: string, memberIds: string[], description?: string) => {
    const chat = await api.createChat('group', memberIds, name, description);
    await refreshChats();
    return chat;
  }, [refreshChats]);

  const createSpace = useCallback(async (name: string, description: string) => {
    const chat = await api.createChat('space', [], name, description);
    await refreshChats();
    return chat;
  }, [refreshChats]);

  const startTyping = useCallback((chatId: string) => {
    socketService.startTyping(chatId);
  }, []);

  const stopTyping = useCallback((chatId: string) => {
    socketService.stopTyping(chatId);
  }, []);

  const deleteMessage = useCallback((messageId: string) => {
    socketService.deleteMessage(messageId);
  }, []);

  const toggleReaction = useCallback((messageId: string, emoji: string) => {
    socketService.addReaction(messageId, emoji);
  }, []);

  const updateAuraMode = useCallback(async (mode: AuraMode) => {
    socketService.updateStatus(mode);
    if (user) {
      const updated = await api.updateProfile({ auraMode: mode });
      updateUser(updated);
    }
  }, [user, updateUser]);

  return (
    <ChatContext.Provider value={{
      chats, activeChatId, setActiveChatId, messages, loadMessages, sendMessage,
      refreshChats, createDirectChat, createGroupChat, createSpace,
      userStatuses, typingUsers, startTyping, stopTyping,
      deleteMessage, toggleReaction, updateAuraMode,
    }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be used within ChatProvider');
  return ctx;
}
