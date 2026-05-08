export type AuraMode = 'available' | 'ghost' | 'dnd';
export type ChatType = 'direct' | 'group' | 'space';
export type MessageType = 'text' | 'file' | 'image' | 'voice';

export interface User {
  id: string;
  username: string;
  displayName: string;
  avatarColor: string;
  publicKey: string | null;
  moodEmoji: string;
  moodText: string;
  auraMode: AuraMode;
  lastSeen: number;
  createdAt: number;
}

export interface ChatMember extends User {
  role: 'admin' | 'member';
}

export interface LastMessage {
  id: string;
  content: string;
  type: MessageType;
  senderId: string;
  senderName: string;
  createdAt: number;
  echoExpiresAt: number | null;
}

export interface Chat {
  id: string;
  type: ChatType;
  name: string | null;
  description: string | null;
  avatarColor: string;
  createdBy: string;
  createdAt: number;
  members: ChatMember[];
  otherUser?: User | null;
  lastMessage: LastMessage | null;
  unreadCount: number;
}

export interface Reaction {
  userId: string;
  emoji: string;
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  senderName: string;
  senderUsername: string;
  senderAvatarColor: string;
  content: string;
  type: MessageType;
  fileId: string | null;
  fileName: string | null;
  fileMime: string | null;
  echoDuration: number | null;
  echoExpiresAt: number | null;
  createdAt: number;
  editedAt: number | null;
  reactions: Reaction[];
}

export interface UserStatus {
  userId: string;
  auraMode: AuraMode;
  isOnline: boolean;
  lastSeen: number;
}

export interface TypingEvent {
  chatId: string;
  userId: string;
  username: string;
  isTyping: boolean;
}
