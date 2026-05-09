export type AuraMode = 'available' | 'ghost' | 'dnd';
export type ChatType = 'direct' | 'group' | 'space' | 'channel';
export type MessageType = 'text' | 'file' | 'image' | 'voice' | 'video';
export type StoryType = 'text' | 'image' | 'video';
export type PrivacyLevel = 'everyone' | 'contacts' | 'nobody';

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
  telegram_id: string | null;
  avatar_url: string | null;
  created_at: number;
  last_seen: number;
  last_username_change: number;
  is_admin: number;
  is_banned: number;
  is_frozen: number;
  ban_reason: string | null;
  freeze_reason: string | null;
  freeze_until: number;
  bio: string;
  phone: string | null;
  birthday: string | null;
  is_prime: number;
  prime_expires_at: number;
  prime_theme: string;
  prime_badge: string;
  prime_animated_avatar: number;
  // Privacy
  privacy_last_seen: string;
  privacy_avatar: string;
  privacy_bio: string;
  privacy_birthday: string;
  privacy_phone: string;
  privacy_online: string;
  privacy_read_receipts: number;
  privacy_forward_from: number;
  privacy_groups: string;
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
  phone: string | null;
  isAdmin: boolean;
  isBanned: boolean;
  isFrozen: boolean;
  banReason: string | null;
  freezeReason: string | null;
  freezeUntil: number;
  isPrime: boolean;
  primeExpiresAt: number;
  primeTheme: string;
  primeBadge: string;
  primeAnimatedAvatar: boolean;
  hasTelegram: boolean;
  // Privacy settings (only returned for own profile)
  privacy?: {
    lastSeen: string;
    avatar: string;
    bio: string;
    birthday: string;
    phone: string;
    online: string;
    readReceipts: boolean;
    forwardFrom: boolean;
    groups: string;
  };
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

export function rowToPublicUser(row: UserRow, includePrivacy = false): PublicUser {
  const now = Math.floor(Date.now() / 1000);
  const primeActive = row.is_prime === 1 && (row.prime_expires_at === 0 || row.prime_expires_at > now);
  const base: PublicUser = {
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
    phone: null, // hidden by default; set below if allowed
    isAdmin: row.is_admin === 1,
    isBanned: row.is_banned === 1,
    isFrozen: row.is_frozen === 1,
    banReason: row.ban_reason ?? null,
    freezeReason: row.freeze_reason ?? null,
    freezeUntil: row.freeze_until ?? 0,
    isPrime: primeActive,
    primeExpiresAt: row.prime_expires_at ?? 0,
    primeTheme: row.prime_theme || 'default',
    primeBadge: row.prime_badge || 'crown',
    primeAnimatedAvatar: row.prime_animated_avatar === 1,
    hasTelegram: !!row.telegram_id,
  };
  if (includePrivacy) {
    base.privacy = {
      lastSeen: row.privacy_last_seen || 'everyone',
      avatar: row.privacy_avatar || 'everyone',
      bio: row.privacy_bio || 'everyone',
      birthday: row.privacy_birthday || 'contacts',
      phone: row.privacy_phone || 'nobody',
      online: row.privacy_online || 'everyone',
      readReceipts: row.privacy_read_receipts !== 0,
      forwardFrom: row.privacy_forward_from !== 0,
      groups: row.privacy_groups || 'everyone',
    };
    base.phone = row.phone ?? null;
  }
  return base;
}

/**
 * Returns user profile filtered by privacy settings.
 * viewerIsContact: whether the requester is in the target's contacts (shared chat).
 */
export function rowToFilteredUser(row: UserRow, viewerIsContact: boolean): PublicUser {
  const base = rowToPublicUser(row, false);

  function visible(level: string | undefined) {
    const l = level || 'everyone';
    if (l === 'everyone') return true;
    if (l === 'contacts') return viewerIsContact;
    return false; // nobody
  }

  if (!visible(row.privacy_last_seen)) {
    base.lastSeen = 0;
    base.auraMode = 'ghost' as AuraMode;
  }
  if (!visible(row.privacy_bio)) base.bio = '';
  if (!visible(row.privacy_birthday)) base.birthday = null;
  if (visible(row.privacy_phone)) base.phone = row.phone ?? null;
  if (!visible(row.privacy_avatar)) base.avatarUrl = null;

  return base;
}
