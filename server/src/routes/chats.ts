import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/database';
import { authenticateToken } from '../middleware/auth';
import { ChatRow, ChatType, MessageRow, UserRow, rowToPublicUser } from '../types';

const router = Router();

router.use(authenticateToken);

const CHAT_COLORS = ['#7C3AED', '#A78BFA', '#EC4899', '#3B82F6', '#10B981', '#F59E0B'];
const pickChatColor = () => CHAT_COLORS[Math.floor(Math.random() * CHAT_COLORS.length)];

function getChatMembers(chatId: string) {
  const db = getDb();
  const rows = db.prepare(`
    SELECT u.*, cm.role
    FROM chat_members cm
    JOIN users u ON u.id = cm.user_id
    WHERE cm.chat_id = ?
  `).all(chatId) as unknown as (UserRow & { role: string })[];
  return rows.map(r => ({ ...rowToPublicUser(r), role: r.role }));
}

function isMember(chatId: string, userId: string): boolean {
  const db = getDb();
  const row = db.prepare('SELECT 1 FROM chat_members WHERE chat_id = ? AND user_id = ?').get(chatId, userId);
  return !!row;
}

function getLastMessage(chatId: string) {
  const db = getDb();
  const msg = db.prepare(`
    SELECT m.*, u.username, u.display_name
    FROM messages m
    LEFT JOIN users u ON u.id = m.sender_id
    WHERE m.chat_id = ? AND m.is_deleted = 0
      AND (m.echo_expires_at IS NULL OR m.echo_expires_at > unixepoch())
    ORDER BY m.created_at DESC
    LIMIT 1
  `).get(chatId) as unknown as (MessageRow & { username: string; display_name: string }) | undefined;
  if (!msg) return null;
  return {
    id: msg.id,
    content: msg.content,
    type: msg.type,
    senderId: msg.sender_id,
    senderName: msg.display_name,
    createdAt: msg.created_at,
    echoExpiresAt: msg.echo_expires_at,
  };
}

function getUnreadCount(chatId: string, userId: string): number {
  const db = getDb();
  const member = db.prepare('SELECT last_read_at FROM chat_members WHERE chat_id = ? AND user_id = ?')
    .get(chatId, userId) as unknown as { last_read_at: number } | undefined;
  const lastRead = member?.last_read_at ?? 0;
  const result = db.prepare(`
    SELECT COUNT(*) as count FROM messages
    WHERE chat_id = ? AND sender_id != ? AND created_at > ? AND is_deleted = 0
      AND (echo_expires_at IS NULL OR echo_expires_at > unixepoch())
  `).get(chatId, userId, lastRead) as unknown as { count: number };
  return result.count;
}

router.get('/', (req, res) => {
  const db = getDb();
  const userId = req.user!.userId;

  const chats = db.prepare(`
    SELECT c.* FROM chats c
    JOIN chat_members cm ON cm.chat_id = c.id
    WHERE cm.user_id = ?
    ORDER BY c.created_at DESC
  `).all(userId) as unknown as ChatRow[];

  const result = chats.map(chat => {
    const members = getChatMembers(chat.id);
    let displayName = chat.name;
    let avatarColor = chat.avatar_color;
    let otherUser = null;

    if (chat.type === 'direct') {
      const other = members.find(m => m.id !== userId);
      if (other) {
        displayName = other.displayName;
        avatarColor = other.avatarColor;
        otherUser = other;
      }
    }

    return {
      id: chat.id,
      type: chat.type,
      name: displayName,
      description: chat.description,
      avatarColor,
      createdBy: chat.created_by,
      createdAt: chat.created_at,
      members,
      otherUser,
      lastMessage: getLastMessage(chat.id),
      unreadCount: getUnreadCount(chat.id, userId),
    };
  });

  result.sort((a, b) => {
    const aTime = a.lastMessage?.createdAt ?? a.createdAt;
    const bTime = b.lastMessage?.createdAt ?? b.createdAt;
    return bTime - aTime;
  });

  res.json({ chats: result });
});

router.post('/', (req, res) => {
  const { type, memberIds, name, description } = req.body as {
    type: ChatType;
    memberIds: string[];
    name?: string;
    description?: string;
  };

  if (!type || !['direct', 'group', 'space'].includes(type)) {
    return res.status(400).json({ error: 'Invalid chat type' });
  }
  if (!Array.isArray(memberIds)) {
    return res.status(400).json({ error: 'memberIds must be an array' });
  }

  const db = getDb();
  const userId = req.user!.userId;
  const allMembers = Array.from(new Set([userId, ...memberIds]));

  if (type === 'direct') {
    if (allMembers.length !== 2) {
      return res.status(400).json({ error: 'Direct chat must have exactly 2 members' });
    }
    const otherId = allMembers.find(id => id !== userId)!;
    const existing = db.prepare(`
      SELECT c.id FROM chats c
      JOIN chat_members cm1 ON cm1.chat_id = c.id AND cm1.user_id = ?
      JOIN chat_members cm2 ON cm2.chat_id = c.id AND cm2.user_id = ?
      WHERE c.type = 'direct'
      LIMIT 1
    `).get(userId, otherId) as unknown as { id: string } | undefined;

    if (existing) {
      return res.json({
        chat: {
          id: existing.id,
          type: 'direct',
          members: getChatMembers(existing.id),
          existing: true,
        },
      });
    }
  }

  if ((type === 'group' || type === 'space') && (!name || name.trim().length < 2)) {
    return res.status(400).json({ error: 'Name is required for groups and spaces' });
  }

  const chatId = uuidv4();
  const now = Math.floor(Date.now() / 1000);

  db.prepare(`
    INSERT INTO chats (id, type, name, description, avatar_color, created_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(chatId, type, name ?? null, description ?? null, pickChatColor(), userId, now);

  const insertMember = db.prepare(`
    INSERT INTO chat_members (chat_id, user_id, role, joined_at)
    VALUES (?, ?, ?, ?)
  `);
  for (const memberId of allMembers) {
    insertMember.run(chatId, memberId, memberId === userId ? 'admin' : 'member', now);
  }

  const chat = db.prepare('SELECT * FROM chats WHERE id = ?').get(chatId) as unknown as ChatRow;
  res.json({
    chat: {
      id: chat.id,
      type: chat.type,
      name: chat.name,
      description: chat.description,
      avatarColor: chat.avatar_color,
      createdBy: chat.created_by,
      createdAt: chat.created_at,
      members: getChatMembers(chatId),
    },
  });
});

router.get('/:id', (req, res) => {
  const db = getDb();
  const chatId = req.params.id;
  const userId = req.user!.userId;

  if (!isMember(chatId, userId)) {
    return res.status(403).json({ error: 'You are not a member of this chat' });
  }

  const chat = db.prepare('SELECT * FROM chats WHERE id = ?').get(chatId) as unknown as ChatRow | undefined;
  if (!chat) return res.status(404).json({ error: 'Chat not found' });

  res.json({
    chat: {
      id: chat.id,
      type: chat.type,
      name: chat.name,
      description: chat.description,
      avatarColor: chat.avatar_color,
      createdBy: chat.created_by,
      createdAt: chat.created_at,
      members: getChatMembers(chatId),
    },
  });
});

router.get('/:id/messages', (req, res) => {
  const db = getDb();
  const chatId = req.params.id;
  const userId = req.user!.userId;
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  const before = parseInt(req.query.before as string) || Math.floor(Date.now() / 1000) + 1;

  if (!isMember(chatId, userId)) {
    return res.status(403).json({ error: 'You are not a member of this chat' });
  }

  const messages = db.prepare(`
    SELECT m.*, u.username, u.display_name, u.avatar_color, f.original_name as file_name, f.mime_type as file_mime
    FROM messages m
    LEFT JOIN users u ON u.id = m.sender_id
    LEFT JOIN files f ON f.id = m.file_id
    WHERE m.chat_id = ?
      AND m.created_at < ?
      AND m.is_deleted = 0
      AND (m.echo_expires_at IS NULL OR m.echo_expires_at > unixepoch())
    ORDER BY m.created_at DESC
    LIMIT ?
  `).all(chatId, before, limit) as unknown as (MessageRow & {
    username: string;
    display_name: string;
    avatar_color: string;
    file_name: string | null;
    file_mime: string | null;
  })[];

  const reactionsByMsg = new Map<string, { userId: string; emoji: string }[]>();
  if (messages.length > 0) {
    const ids = messages.map(m => m.id);
    const placeholders = ids.map(() => '?').join(',');
    const reactions = db.prepare(`SELECT * FROM reactions WHERE message_id IN (${placeholders})`)
      .all(...ids) as unknown as { message_id: string; user_id: string; emoji: string }[];
    for (const r of reactions) {
      if (!reactionsByMsg.has(r.message_id)) reactionsByMsg.set(r.message_id, []);
      reactionsByMsg.get(r.message_id)!.push({ userId: r.user_id, emoji: r.emoji });
    }
  }

  const result = messages.reverse().map(m => ({
    id: m.id,
    chatId: m.chat_id,
    senderId: m.sender_id,
    senderName: m.display_name,
    senderUsername: m.username,
    senderAvatarColor: m.avatar_color,
    content: m.content,
    type: m.type,
    fileId: m.file_id,
    fileName: m.file_name,
    fileMime: m.file_mime,
    echoDuration: m.echo_duration,
    echoExpiresAt: m.echo_expires_at,
    createdAt: m.created_at,
    editedAt: m.edited_at,
    reactions: reactionsByMsg.get(m.id) || [],
  }));

  const now = Math.floor(Date.now() / 1000);
  db.prepare('UPDATE chat_members SET last_read_at = ? WHERE chat_id = ? AND user_id = ?')
    .run(now, chatId, userId);

  res.json({ messages: result });
});

router.post('/:id/read', (req, res) => {
  const db = getDb();
  const chatId = req.params.id;
  const userId = req.user!.userId;

  if (!isMember(chatId, userId)) {
    return res.status(403).json({ error: 'Not a member' });
  }

  const now = Math.floor(Date.now() / 1000);
  db.prepare('UPDATE chat_members SET last_read_at = ? WHERE chat_id = ? AND user_id = ?')
    .run(now, chatId, userId);

  res.json({ success: true });
});

router.delete('/:id/messages/:messageId', (req, res) => {
  const db = getDb();
  const { id: chatId, messageId } = req.params;
  const userId = req.user!.userId;

  const msg = db.prepare('SELECT * FROM messages WHERE id = ? AND chat_id = ?')
    .get(messageId, chatId) as unknown as MessageRow | undefined;
  if (!msg) return res.status(404).json({ error: 'Message not found' });
  if (msg.sender_id !== userId) {
    return res.status(403).json({ error: 'Cannot delete others messages' });
  }

  db.prepare('UPDATE messages SET is_deleted = 1 WHERE id = ?').run(messageId);
  res.json({ success: true });
});

export default router;
