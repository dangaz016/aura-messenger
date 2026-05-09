import { io, Socket } from 'socket.io-client';
import { Message, UserStatus, TypingEvent, MessageType } from '../types';

type Listener<T = unknown> = (data: T) => void;

const SOCKET_URL = import.meta.env.VITE_API_URL || undefined;

class SocketService {
  private socket: Socket | null = null;
  private listeners = new Map<string, Set<Listener>>();

  connect(token: string) {
    if (this.socket?.connected) return;
    if (this.socket) this.socket.disconnect();

    this.socket = SOCKET_URL
      ? io(SOCKET_URL, { auth: { token }, transports: ['websocket', 'polling'] })
      : io({ auth: { token }, transports: ['websocket', 'polling'] });

    this.socket.on('connect', () => console.log('[socket] connected'));
    this.socket.on('disconnect', () => console.log('[socket] disconnected'));
    this.socket.on('auth_error', (e) => console.error('[socket] auth error', e));

    const events = [
      'authenticated', 'new_message', 'user_status', 'typing', 'message_deleted', 'message_edited',
      'reaction_update', 'messages_read', 'chat_pinned', 'error'
    ];
    for (const evt of events) {
      this.socket.on(evt, (data: unknown) => this.emit(evt, data));
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.listeners.clear();
  }

  on<T = unknown>(event: string, listener: Listener<T>): () => void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(listener as Listener);
    return () => this.listeners.get(event)?.delete(listener as Listener);
  }

  private emit(event: string, data: unknown) {
    this.listeners.get(event)?.forEach(l => l(data));
  }

  onMessage(listener: (msg: Message) => void) { return this.on<Message>('new_message', listener); }
  onUserStatus(listener: (s: UserStatus) => void) { return this.on<UserStatus>('user_status', listener); }
  onTyping(listener: (t: TypingEvent) => void) { return this.on<TypingEvent>('typing', listener); }
  onMessageDeleted(listener: (d: { messageId: string; chatId: string; reason?: string }) => void) {
    return this.on('message_deleted', listener);
  }
  onReaction(listener: (d: { messageId: string; chatId: string; userId: string; emoji: string; added: boolean }) => void) {
    return this.on('reaction_update', listener);
  }

  sendMessage(chatId: string, content: string, opts: { type?: MessageType; fileId?: string; echoDuration?: number; replyToId?: string } = {}) {
    this.socket?.emit('send_message', { chatId, content, ...opts });
  }

  startTyping(chatId: string) { this.socket?.emit('typing_start', { chatId }); }
  stopTyping(chatId: string) { this.socket?.emit('typing_stop', { chatId }); }
  updateStatus(auraMode: 'available' | 'ghost' | 'dnd') { this.socket?.emit('update_status', { auraMode }); }
  onMessageEdited(listener: (d: { messageId: string; chatId: string; content: string; editedAt: number }) => void) {
    return this.on('message_edited', listener);
  }
  addReaction(messageId: string, emoji: string) { this.socket?.emit('add_reaction', { messageId, emoji }); }
  deleteMessage(messageId: string) { this.socket?.emit('delete_message', { messageId }); }
  editMessage(messageId: string, content: string) { this.socket?.emit('edit_message', { messageId, content }); }

  // ── New features: read receipts, pinned, forwarding ──────────────────────────
  markRead(messageId: string, chatId: string) { this.socket?.emit('mark_read', { messageId, chatId }); }
  pinMessage(chatId: string, messageId: string | null) { this.socket?.emit('pin_message', { chatId, messageId }); }
  forwardMessage(messageId: string, toChatId: string) { this.socket?.emit('forward_message', { messageId, toChatId }); }

  onMessagesRead(listener: (d: { messageId: string; chatId: string; userId: string; readAt: number }) => void) {
    return this.on('messages_read', listener);
  }
  onChatPinned(listener: (d: { chatId: string; pinnedMessageId: string | null; pinnedContent: string | null; pinnedSenderName: string | null; pinnedType: string | null }) => void) {
    return this.on('chat_pinned', listener);
  }
}

export const socketService = new SocketService();
