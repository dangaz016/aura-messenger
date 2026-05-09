export type AuraMode = 'available' | 'ghost' | 'dnd';
export type ChatType = 'direct' | 'group' | 'space' | 'channel';
export type MessageType = 'text' | 'file' | 'image' | 'voice' | 'video';
export type StoryType = 'text' | 'image' | 'video';

export interface UserRow {
  id: string;
  username: string;
  email: string | null;
  password_hash: string;
  display_name: string;
  avatar_color: string;
  public_key: string | null;
  mood_emoji: string;
  mood_text: string;
  aura_mode: AuraMode;
  google_id: string | null;
  avatar_url: string | null;
  created_at: number;
  last_seen: number;
  last_username_change: number;
  is_admin: number;
  is_banned: number;
  is_frozen: number;
  ban_reason: string | null;
  bio: string;
  phone: string | null;
  birthday: string | null;
}

export interface StoryRow {
  id: string;
  author_id: string;
  type: StoryType;
  content: string | null;
  file_id: string | null;
  bg_color: string | null;
  created_at: number;
  expires_at: number;
}

export interface PublicUser {
  id: string;
  username: string;
  displayName: string;
  avatarColor: string;
  avatarUrl: string | null;
  publicKey: string | null;
  moodEmoji: string;
  moodText: string;
  auraMode: AuraMode;
  lastSeen: number;
  createdAt: number;
  bio: string;
  birthday: string | null;
  isAdmin: boolean;
}

export interface ChatRow {
  id: string;
  type: ChatType;
  name: string | null;
  description: string | null;
  avatar_color: string;
  created_by: string;
  created_at: number;
  is_public: number;
  invite_link: string | null;
  channel_username: string | null;
  subscriber_count: number;
  post_permissions: string;
}

export interface MessageRow {
  id: string;
  chat_id: string;
  sender_id: string;
  content: string;
  type: MessageType;
  file_id: string | null;
  echo_duration: number | null;
  echo_expires_at: number | null;
  is_deleted: number;
  created_at: number;
  edited_at: number | null;
  reply_to_id: string | null;
  forwarded_from_id: string | null;
  forwarded_from_name: string | null;
}

export interface JwtPayload {
  userId: string;
  username: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export function rowToPublicUser(row: UserRow): PublicUser {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    avatarColor: row.avatar_color,
    avatarUrl: row.avatar_url ?? null,
    publicKey: row.public_key,
    moodEmoji: row.mood_emoji,
    moodText: row.mood_text,
    auraMode: row.aura_mode,
    lastSeen: row.last_seen,
    createdAt: row.created_at,
    bio: row.bio || '',
    birthday: row.birthday ?? null,
    isAdmin: row.is_admin === 1,
  };
}
