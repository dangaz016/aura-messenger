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

// Anti-spam tracking
const userMessageTimes = new Map<string, number[]>(); // userId -> array of timestamps
const lastMessages = new Map<string, { content: string; timestamp: number }>(); // userId_chatId -> last message

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

        const userId = socket.userId!;
        const now = Math.floor(Date.now() / 1000);

        // ── Anti-spam: flood detection ─────────────────────────────────────────
        if (!userMessageTimes.has(userId)) userMessageTimes.set(userId, []);
        const times = userMessageTimes.get(userId)!;
        times.push(now);
        // Keep only messages from last 5 seconds
        while (times.length > 0 && times[0] < now - 5) times.shift();
        if (times.length > 10) {
          return socket.emit('error', { message: 'Too many messages. Slow down.' });
        }

        // ── Anti-spam: duplicate detection ─────────────────────────────────────
        const lastKey = `${userId}_${chatId}`;
        const last = lastMessages.get(lastKey);
        if (last && last.content === content && now - last.timestamp < 2) {
          return socket.emit('error', { message: 'Duplicate message detected.' });
        }
        lastMessages.set(lastKey, { content, timestamp: now });

        const member = db.prepare('SELECT 1 FROM chat_members WHERE chat_id = ? AND user_id = ?')
          .get(chatId, userId);
        if (!member) return socket.emit('error', { message: 'Not a member' });

        const messageId = uuidv4();
        const echoExpiresAt = echoDuration ? now + echoDuration : null;

        db.prepare(`
          INSERT INTO messages (id, chat_id, sender_id, content, type, file_id, echo_duration, echo_expires_at, created_at, reply_to_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(messageId, chatId, userId, content, type, fileId ?? null, echoDuration ?? null, echoExpiresAt, now, replyToId ?? null);

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

    socket.on('edit_message', (data: { messageId: string; content: string }) => {
      const { messageId, content } = data;
      if (!content?.trim()) return;
      const msg = db.prepare('SELECT * FROM messages WHERE id = ?').get(messageId) as unknown as MessageRow | undefined;
      if (!msg || msg.sender_id !== socket.userId) return;
      if (msg.is_deleted) return;
      // Only allow editing text messages
      if (msg.type !== 'text') return;

      const now = Math.floor(Date.now() / 1000);
      db.prepare('UPDATE messages SET content = ?, edited_at = ? WHERE id = ?')
        .run(content.trim(), now, messageId);

      const memberIds = getChatMemberIds(msg.chat_id);
      emitToUsers(io, memberIds, 'message_edited', {
        messageId,
        chatId: msg.chat_id,
        content: content.trim(),
        editedAt: now,
      });
    });

    socket.on('mark_read', (data: { messageId: string; chatId: string }) => {
      try {
        const { messageId, chatId } = data;
        if (!messageId || !chatId) return;
        const member = db.prepare('SELECT 1 FROM chat_members WHERE chat_id = ? AND user_id = ?')
          .get(chatId, socket.userId!);
        if (!member) return;

        const now = Math.floor(Date.now() / 1000);
        db.prepare('INSERT OR REPLACE INTO message_reads (message_id, user_id, read_at) VALUES (?, ?, ?)')
          .run(messageId, socket.userId!, now);

        const memberIds = getChatMemberIds(chatId);
        emitToUsers(io, memberIds, 'messages_read', {
          messageId,
          chatId,
          userId: socket.userId,
          readAt: now,
        });
      } catch (err) {
        console.error('mark_read error', err);
      }
    });

    socket.on('pin_message', (data: { chatId: string; messageId: string | null }) => {
      try {
        const { chatId, messageId } = data;
        if (!chatId) return;
        const chat = db.prepare('SELECT * FROM chats WHERE id = ?').get(chatId) as unknown as { id: string; created_by: string; type: string } | undefined;
        if (!chat) return;

        const member = db.prepare('SELECT role FROM chat_members WHERE chat_id = ? AND user_id = ?')
          .get(chatId, socket.userId!) as unknown as { role: string } | undefined;
        if (!member) return;

        // Check permission: direct chat (any member), group/space/channel (admin or creator only)
        const isCreator = chat.created_by === socket.userId;
        const isAdmin = member.role === 'admin';
        if (chat.type !== 'direct' && !isCreator && !isAdmin) {
          return socket.emit('error', { message: 'Only admins can pin messages' });
        }

        db.prepare('UPDATE chats SET pinned_message_id = ? WHERE id = ?')
          .run(messageId, chatId);

        let pinnedContent = null;
        let pinnedSenderName = null;
        let pinnedType = null;
        if (messageId) {
          const msg = db.prepare(`
            SELECT m.content, m.type, u.display_name
            FROM messages m
            LEFT JOIN users u ON u.id = m.sender_id
            WHERE m.id = ?
          `).get(messageId) as unknown as { content: string; type: string; display_name: string } | undefined;
          if (msg) {
            pinnedContent = msg.content;
            pinnedSenderName = msg.display_name;
            pinnedType = msg.type;
          }
        }

        const memberIds = getChatMemberIds(chatId);
        emitToUsers(io, memberIds, 'chat_pinned', {
          chatId,
          pinnedMessageId: messageId,
          pinnedContent,
          pinnedSenderName,
          pinnedType,
        });
      } catch (err) {
        console.error('pin_message error', err);
      }
    });

    socket.on('forward_message', (data: { messageId: string; toChatId: string }) => {
      try {
        const { messageId, toChatId } = data;
        if (!messageId || !toChatId) return;

        // Load original message
        const original = db.prepare(`
          SELECT m.*, u.display_name, u.username, u.avatar_color
          FROM messages m
          LEFT JOIN users u ON u.id = m.sender_id
          WHERE m.id = ?
        `).get(messageId) as unknown as MessageRow & { display_name: string; username: string; avatar_color: string } | undefined;
        if (!original || original.is_deleted) return;

        // Check sender is member of source chat
        const sourceMember = db.prepare('SELECT 1 FROM chat_members WHERE chat_id = ? AND user_id = ?')
          .get(original.chat_id, socket.userId!);
        if (!sourceMember) return;

        // Check sender is member of dest chat
        const destMember = db.prepare('SELECT 1 FROM chat_members WHERE chat_id = ? AND user_id = ?')
          .get(toChatId, socket.userId!);
        if (!destMember) return;

        const newMessageId = uuidv4();
        const now = Math.floor(Date.now() / 1000);

        db.prepare(`
          INSERT INTO messages (id, chat_id, sender_id, content, type, file_id, created_at, forwarded_from_id, forwarded_from_name)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          newMessageId,
          toChatId,
          socket.userId!,
          original.content,
          original.type,
          original.file_id ?? null,
          now,
          original.sender_id,
          original.display_name
        );

        // Fetch full new message with joins
        const newMsg = db.prepare(`
          SELECT m.*, u.username, u.display_name, u.avatar_color,
                 f.original_name as file_name, f.mime_type as file_mime
          FROM messages m
          LEFT JOIN users u ON u.id = m.sender_id
          LEFT JOIN files f ON f.id = m.file_id
          WHERE m.id = ?
        `).get(newMessageId) as unknown as MessageRow & {
          username: string;
          display_name: string;
          avatar_color: string;
          file_name: string | null;
          file_mime: string | null;
        };

        const payload = {
          id: newMsg.id,
          chatId: newMsg.chat_id,
          senderId: newMsg.sender_id,
          senderName: newMsg.display_name,
          senderUsername: newMsg.username,
          senderAvatarColor: newMsg.avatar_color,
          content: newMsg.content,
          type: newMsg.type,
          fileId: newMsg.file_id,
          fileName: newMsg.file_name,
          fileMime: newMsg.file_mime,
          echoDuration: null,
          echoExpiresAt: null,
          createdAt: newMsg.created_at,
          replyToId: null,
          replyContent: null,
          replyType: null,
          replySenderName: null,
          reactions: [],
          forwardedFromId: newMsg.forwarded_from_id,
          forwardedFromName: newMsg.forwarded_from_name,
        };

        const memberIds = getChatMemberIds(toChatId);
        emitToUsers(io, memberIds, 'new_message', payload);
      } catch (err) {
        console.error('forward_message error', err);
      }
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
