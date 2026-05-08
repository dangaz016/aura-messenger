import { Server as SocketIOServer, Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/database';
import { verifyToken } from '../middleware/auth';
import { MessageRow, MessageType, AuraMode, UserRow, rowToPublicUser } from '../types';

interface AuthSocket extends Socket {
  userId?: string;
  username?: string;
}

const userSockets = new Map<string, Set<string>>();

function addUserSocket(userId: string, socketId: string) {
  if (!userSockets.has(userId)) userSockets.set(userId, new Set());
  userSockets.get(userId)!.add(socketId);
}

function removeUserSocket(userId: string, socketId: string) {
  userSockets.get(userId)?.delete(socketId);
  if (userSockets.get(userId)?.size === 0) userSockets.delete(userId);
}

function getChatMemberIds(chatId: string): string[] {
  const db = getDb();
  const rows = db.prepare('SELECT user_id FROM chat_members WHERE chat_id = ?').all(chatId) as unknown as { user_id: string }[];
  return rows.map(r => r.user_id);
}

function emitToUsers(io: SocketIOServer, userIds: string[], event: string, data: unknown) {
  for (const userId of userIds) {
    const sockets = userSockets.get(userId);
    if (sockets) {
      for (const sid of sockets) {
        io.to(sid).emit(event, data);
      }
    }
  }
}

function getRelatedUsers(userId: string): string[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT DISTINCT cm2.user_id FROM chat_members cm1
    JOIN chat_members cm2 ON cm1.chat_id = cm2.chat_id
    WHERE cm1.user_id = ? AND cm2.user_id != ?
  `).all(userId, userId) as unknown as { user_id: string }[];
  return rows.map(r => r.user_id);
}

export function setupSocketHandlers(io: SocketIOServer) {
  io.on('connection', (socket: AuthSocket) => {
    const token = socket.handshake.auth?.token as string | undefined;
    const payload = token ? verifyToken(token) : null;

    if (!payload) {
      socket.emit('auth_error', { message: 'Invalid token' });
      socket.disconnect();
      return;
    }

    socket.userId = payload.userId;
    socket.username = payload.username;

    const db = getDb();
    const connUser = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.userId) as unknown as UserRow | undefined;
    if (!connUser) {
      socket.emit('auth_error', { message: 'User not found' });
      socket.disconnect();
      return;
    }

    addUserSocket(payload.userId, socket.id);
    db.prepare('UPDATE users SET last_seen = unixepoch() WHERE id = ?').run(payload.userId);

    socket.emit('authenticated', { userId: payload.userId });

    const related = getRelatedUsers(payload.userId);
    emitToUsers(io, related, 'user_status', {
      userId: payload.userId,
      auraMode: connUser.aura_mode,
      isOnline: true,
      lastSeen: connUser.last_seen,
    });

    socket.on('send_message', (data: {
      chatId: string;
      content: string;
      type?: MessageType;
      fileId?: string;
      echoDuration?: number;
      replyToId?: string;
    }) => {
      try {
        const { chatId, content, type = 'text', fileId, echoDuration, replyToId } = data;
        if (!chatId || !content) return socket.emit('error', { message: 'Missing fields' });

        const member = db.prepare('SELECT 1 FROM chat_members WHERE chat_id = ? AND user_id = ?')
          .get(chatId, socket.userId!);
        if (!member) return socket.emit('error', { message: 'Not a member' });

        const messageId = uuidv4();
        const now = Math.floor(Date.now() / 1000);
        const echoExpiresAt = echoDuration ? now + echoDuration : null;

        db.prepare(`
          INSERT INTO messages (id, chat_id, sender_id, content, type, file_id, echo_duration, echo_expires_at, created_at, reply_to_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(messageId, chatId, socket.userId!, content, type, fileId ?? null, echoDuration ?? null, echoExpiresAt, now, replyToId ?? null);

        const msg = db.prepare(`
          SELECT m.*, u.username, u.display_name, u.avatar_color,
                 f.original_name as file_name, f.mime_type as file_mime,
                 rm.content as reply_content, rm.type as reply_type, ru.display_name as reply_sender_name
          FROM messages m
          LEFT JOIN users u ON u.id = m.sender_id
          LEFT JOIN files f ON f.id = m.file_id
          LEFT JOIN messages rm ON rm.id = m.reply_to_id
          LEFT JOIN users ru ON ru.id = rm.sender_id
          WHERE m.id = ?
        `).get(messageId) as unknown as MessageRow & {
          username: string;
          display_name: string;
          avatar_color: string;
          file_name: string | null;
          file_mime: string | null;
          reply_content: string | null;
          reply_type: string | null;
          reply_sender_name: string | null;
        };

        const payload = {
          id: msg.id,
          chatId: msg.chat_id,
          senderId: msg.sender_id,
          senderName: msg.display_name,
          senderUsername: msg.username,
          senderAvatarColor: msg.avatar_color,
          content: msg.content,
          type: msg.type,
          fileId: msg.file_id,
          fileName: msg.file_name,
          fileMime: msg.file_mime,
          echoDuration: msg.echo_duration,
          echoExpiresAt: msg.echo_expires_at,
          createdAt: msg.created_at,
          replyToId: replyToId ?? null,
          replyContent: msg.reply_content ?? null,
          replyType: msg.reply_type ?? null,
          replySenderName: msg.reply_sender_name ?? null,
          reactions: [],
        };

        const memberIds = getChatMemberIds(chatId);
        emitToUsers(io, memberIds, 'new_message', payload);
      } catch (err) {
        console.error('send_message error', err);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    socket.on('typing_start', (data: { chatId: string }) => {
      const memberIds = getChatMemberIds(data.chatId).filter(id => id !== socket.userId);
      emitToUsers(io, memberIds, 'typing', {
        chatId: data.chatId,
        userId: socket.userId,
        username: socket.username,
        isTyping: true,
      });
    });

    socket.on('typing_stop', (data: { chatId: string }) => {
      const memberIds = getChatMemberIds(data.chatId).filter(id => id !== socket.userId);
      emitToUsers(io, memberIds, 'typing', {
        chatId: data.chatId,
        userId: socket.userId,
        username: socket.username,
        isTyping: false,
      });
    });

    socket.on('update_status', (data: { auraMode: AuraMode }) => {
      const valid: AuraMode[] = ['available', 'ghost', 'dnd'];
      if (!valid.includes(data.auraMode)) return;

      db.prepare('UPDATE users SET aura_mode = ?, last_seen = unixepoch() WHERE id = ?')
        .run(data.auraMode, socket.userId!);

      const related = getRelatedUsers(socket.userId!);
      emitToUsers(io, related, 'user_status', {
        userId: socket.userId,
        auraMode: data.auraMode,
        isOnline: true,
        lastSeen: Math.floor(Date.now() / 1000),
      });
    });

    socket.on('add_reaction', (data: { messageId: string; emoji: string }) => {
      try {
        const msg = db.prepare('SELECT chat_id FROM messages WHERE id = ?').get(data.messageId) as unknown as
          | { chat_id: string }
          | undefined;
        if (!msg) return;
        const member = db.prepare('SELECT 1 FROM chat_members WHERE chat_id = ? AND user_id = ?')
          .get(msg.chat_id, socket.userId!);
        if (!member) return;

        const existing = db.prepare(
          'SELECT 1 FROM reactions WHERE message_id = ? AND user_id = ? AND emoji = ?'
        ).get(data.messageId, socket.userId!, data.emoji);

        if (existing) {
          db.prepare('DELETE FROM reactions WHERE message_id = ? AND user_id = ? AND emoji = ?')
            .run(data.messageId, socket.userId!, data.emoji);
        } else {
          db.prepare('INSERT INTO reactions (message_id, user_id, emoji) VALUES (?, ?, ?)')
            .run(data.messageId, socket.userId!, data.emoji);
        }

        const memberIds = getChatMemberIds(msg.chat_id);
        emitToUsers(io, memberIds, 'reaction_update', {
          messageId: data.messageId,
          chatId: msg.chat_id,
          userId: socket.userId,
          emoji: data.emoji,
          added: !existing,
        });
      } catch (err) {
        console.error('add_reaction error', err);
      }
    });

    socket.on('delete_message', (data: { messageId: string }) => {
      const msg = db.prepare('SELECT * FROM messages WHERE id = ?').get(data.messageId) as unknown as
        | MessageRow
        | undefined;
      if (!msg || msg.sender_id !== socket.userId) return;

      db.prepare('UPDATE messages SET is_deleted = 1 WHERE id = ?').run(data.messageId);
      const memberIds = getChatMemberIds(msg.chat_id);
      emitToUsers(io, memberIds, 'message_deleted', {
        messageId: data.messageId,
        chatId: msg.chat_id,
      });
    });

    socket.on('disconnect', () => {
      if (!socket.userId) return;
      removeUserSocket(socket.userId, socket.id);

      const stillOnline = userSockets.has(socket.userId);
      if (!stillOnline) {
        const now = Math.floor(Date.now() / 1000);
        db.prepare('UPDATE users SET last_seen = ? WHERE id = ?').run(now, socket.userId);
        const related = getRelatedUsers(socket.userId);
        const discUser = db.prepare('SELECT * FROM users WHERE id = ?').get(socket.userId) as unknown as UserRow | undefined;
        if (discUser) {
          emitToUsers(io, related, 'user_status', {
            userId: socket.userId,
            auraMode: discUser.aura_mode,
            isOnline: false,
            lastSeen: now,
          });
        }
      }
    });
  });

  setInterval(() => {
    try {
      const db = getDb();
      const now = Math.floor(Date.now() / 1000);
      const expired = db.prepare(`
        SELECT id, chat_id FROM messages
        WHERE echo_expires_at IS NOT NULL AND echo_expires_at <= ? AND is_deleted = 0
      `).all(now) as unknown as { id: string; chat_id: string }[];

      if (expired.length > 0) {
        const ids = expired.map(e => e.id);
        const placeholders = ids.map(() => '?').join(',');
        db.prepare(`UPDATE messages SET is_deleted = 1 WHERE id IN (${placeholders})`).run(...ids);

        for (const exp of expired) {
          const memberIds = getChatMemberIds(exp.chat_id);
          emitToUsers(io, memberIds, 'message_deleted', {
            messageId: exp.id,
            chatId: exp.chat_id,
            reason: 'echo_expired',
          });
        }
      }
    } catch (err) {
      console.error('Echo cleanup error', err);
    }
  }, 5000);
}

export function isUserOnline(userId: string): boolean {
  return userSockets.has(userId);
}
