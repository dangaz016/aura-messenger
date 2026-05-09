export type AuraMode = 'available' | 'ghost' | 'dnd';
export type ChatType = 'direct' | 'group' | 'space' | 'channel';
export type MessageType = 'text' | 'file' | 'image' | 'voice' | 'video';
export type StoryType = 'text' | 'image' | 'video';

export interface User {
  id: string;
  username: string;
  displayName: string;
  avatarColor: string;
  avatarUrl?: string | null;
  publicKey: string | null;
  moodEmoji: string;
  moodText: string;
  auraMode: AuraMode;
  lastSeen: number;
  createdAt: number;
  bio?: string;
  birthday?: string | null;
  isAdmin?: boolean;
  isBanned?: boolean;
  isFrozen?: boolean;
  banReason?: string | null;
  freezeReason?: string | null;
  freezeUntil?: number;
}

export interface Story {
  id: string;
  authorId: string;
  type: StoryType;
  content: string | null;
  fileId: string | null;
  bgColor: string | null;
  createdAt: number;
  expiresAt: number;
  viewed: boolean;
  viewerCount: number;
}

export interface StoryGroup {
  user: {
    id: string;
    username: string;
    displayName: string;
    avatarColor: string;
    avatarUrl: string | null;
  };
  stories: Story[];
  hasUnviewed: boolean;
}

export interface StoryViewer {
  id: string;
  username: string;
  displayName: string;
  avatarColor: string;
  avatarUrl?: string | null;
  viewedAt: number;
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
  // Channel fields
  isPublic?: boolean;
  inviteLink?: string | null;
  channelUsername?: string | null;
  subscriberCount?: number;
  postPermissions?: string;
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
  replyToId: string | null;
  replyContent: string | null;
  replyType: string | null;
  replySenderName: string | null;
  forwardedFromId?: string | null;
  forwardedFromName?: string | null;
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
