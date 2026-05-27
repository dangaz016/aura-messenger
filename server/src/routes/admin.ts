import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import { getDb } from '../db/database';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import { UserRow } from '../types';
import { getIo, getUserSockets } from '../socket/handlers';

/** Emit an event directly to all sockets of a specific user */
function emitToUser(userId: string, event: string, data: unknown) {
  const io = getIo();
  if (!io) return;
  const sockets = getUserSockets().get(userId);
  if (sockets) {
    for (const sid of sockets) {
      io.to(sid).emit(event, data);
    }
  }
}

const router = Router();
router.use(authenticateToken, requireAdmin);

// GET /api/admin/stats
router.get('/stats', (_req, res) => {
  const db = getDb();
  const users = (db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number }).c;
  const messages = (db.prepare('SELECT COUNT(*) as c FROM messages WHERE is_deleted = 0').get() as { c: number }).c;
  const chats = (db.prepare('SELECT COUNT(*) as c FROM chats').get() as { c: number }).c;
  const banned = (db.prepare('SELECT COUNT(*) as c FROM users WHERE is_banned = 1').get() as { c: number }).c;
  const frozen = (db.prepare('SELECT COUNT(*) as c FROM users WHERE is_frozen = 1').get() as { c: number }).c;
  const reports = (db.prepare('SELECT COUNT(*) as c FROM reports WHERE resolved = 0').get() as { c: number }).c;
  res.json({ users, messages, chats, banned, frozen, reports });
});

// GET /api/admin/users
router.get('/users', (req, res) => {
  const db = getDb();
  const page = parseInt(req.query.page as string) || 1;
  const limit = 50;
  const offset = (page - 1) * limit;
  const search = (req.query.search as string) || '';
  const rows = db.prepare(`
    SELECT id, username, display_name, avatar_color, is_admin, is_banned, is_frozen,
           ban_reason, freeze_reason, freeze_until, created_at, last_seen, email,
           is_prime, prime_expires_at
    FROM users
    WHERE username LIKE ? OR display_name LIKE ?
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).all(`%${search}%`, `%${search}%`, limit, offset) as unknown as UserRow[];
  const now = Math.floor(Date.now() / 1000);
  res.json(rows.map(r => ({
    id: r.id,
    username: r.username,
    displayName: r.display_name,
    avatarColor: r.avatar_color,
    isAdmin: r.is_admin === 1,
    isBanned: r.is_banned === 1,
    isFrozen: r.is_frozen === 1,
    isPrime: r.is_prime === 1 && (r.prime_expires_at === 0 || r.prime_expires_at > now),
    banReason: r.ban_reason,
    freezeReason: (r as any).freeze_reason,
    freezeUntil: (r as any).freeze_until,
    createdAt: r.created_at,
    lastSeen: r.last_seen,
    email: r.email,
  })));
});

// POST /api/admin/users/:id/ban
router.post('/users/:id/ban', (req, res) => {
  const db = getDb();
  const { reason } = req.body as { reason?: string };
  const banReason = reason || 'Violation of terms';
  db.prepare('UPDATE users SET is_banned = 1, ban_reason = ? WHERE id = ?')
    .run(banReason, req.params.id);
  // Notify the banned user in real-time
  emitToUser(req.params.id, 'user_banned', { reason: banReason });
  res.json({ success: true });
});

// POST /api/admin/users/:id/unban
router.post('/users/:id/unban', (req, res) => {
  const db = getDb();
  db.prepare('UPDATE users SET is_banned = 0, ban_reason = NULL WHERE id = ?').run(req.params.id);
  emitToUser(req.params.id, 'user_unbanned', {});
  res.json({ success: true });
});

// POST /api/admin/users/:id/freeze
// Body: { durationMinutes: number, reason?: string }
router.post('/users/:id/freeze', (req, res) => {
  const db = getDb();
  const { durationMinutes, reason } = req.body as { durationMinutes?: number; reason?: string };
  const mins = Math.max(1, Math.min(durationMinutes || 60, 60 * 24 * 365)); // 1 min – 1 year
  const freezeUntil = Math.floor(Date.now() / 1000) + mins * 60;
  const freezeReason = reason || 'Temporary restriction';
  db.prepare('UPDATE users SET is_frozen = 1, freeze_until = ?, freeze_reason = ? WHERE id = ?')
    .run(freezeUntil, freezeReason, req.params.id);
  emitToUser(req.params.id, 'user_frozen', {
    freezeUntil,
    reason: freezeReason,
    durationMinutes: mins,
  });
  res.json({ success: true });
});

// POST /api/admin/users/:id/unfreeze
router.post('/users/:id/unfreeze', (req, res) => {
  const db = getDb();
  db.prepare('UPDATE users SET is_frozen = 0, freeze_until = 0, freeze_reason = NULL WHERE id = ?').run(req.params.id);
  emitToUser(req.params.id, 'user_unfrozen', {});
  res.json({ success: true });
});

// POST /api/admin/users/:id/make-admin
router.post('/users/:id/make-admin', (req, res) => {
  const db = getDb();
  db.prepare('UPDATE users SET is_admin = 1 WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// POST /api/admin/users/:id/remove-admin
router.post('/users/:id/remove-admin', (req, res) => {
  const db = getDb();
  db.prepare('UPDATE users SET is_admin = 0 WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// GET /api/admin/reports
router.get('/reports', (req, res) => {
  const db = getDb();
  const showResolved = req.query.resolved === '1';
  const type = req.query.type as string | undefined;

  let sql = `
    SELECT r.*,
      u1.username AS reporter_username, u1.display_name AS reporter_name,
      u2.username AS target_username, u2.display_name AS target_name,
      u3.username AS resolved_by_username,
      c.name AS chat_name, c.type AS chat_type,
      m.content AS message_content, m.sender_id AS message_sender_id
    FROM reports r
    LEFT JOIN users u1 ON u1.id = r.reporter_id
    LEFT JOIN users u2 ON u2.id = r.target_user_id
    LEFT JOIN users u3 ON u3.id = r.resolved_by
    LEFT JOIN chats c ON c.id = r.target_chat_id
    LEFT JOIN messages m ON m.id = r.target_message_id
    WHERE r.resolved = ?
  `;
  const params: (number | string)[] = [showResolved ? 1 : 0];

  if (type) {
    sql += ' AND r.type = ?';
    params.push(type);
  }

  sql += ' ORDER BY r.created_at DESC LIMIT 200';
  const rows = db.prepare(sql).all(...params) as unknown[];
  res.json(rows);
});

// POST /api/admin/reports/:id/resolve
router.post('/reports/:id/resolve', (req, res) => {
  const db = getDb();
  const { adminNote, notifyUser } = req.body as { adminNote?: string; notifyUser?: boolean };
  
  // Resolve the report
  db.prepare('UPDATE reports SET resolved = 1, resolved_by = ?, resolved_at = unixepoch(), admin_note = ? WHERE id = ?')
    .run((req as any).user?.userId, adminNote || null, req.params.id);
  
  // Get report details
  const report = db.prepare('SELECT * FROM reports WHERE id = ?').get(req.params.id) as any;
  
  // Notify the reported user if requested
  if (notifyUser && report.target_user_id) {
    emitToUser(report.target_user_id, 'report_resolved', {
      reportId: report.id,
      adminNote: adminNote || 'Report has been reviewed and resolved',
      resolvedBy: (req as any).user?.userId
    });
  }
  
  res.json({ success: true });
});

// GET /api/admin/reports/:id/details — get full details for a report
router.get('/reports/:id/details', (req, res) => {
  const db = getDb();
  
  // Get report with all related data
  const report = db.prepare(`
    SELECT r.*,
      u1.username AS reporter_username, u1.display_name AS reporter_name, u1.avatar_color AS reporter_avatar_color,
      u2.username AS target_username, u2.display_name AS target_name, u2.avatar_color AS target_avatar_color,
      u3.username AS resolved_by_username,
      c.id AS chat_id, c.name AS chat_name, c.type AS chat_type, c.description AS chat_description,
      m.id AS message_id, m.content AS message_content, m.sender_id AS message_sender_id, m.created_at AS message_created_at
    FROM reports r
    LEFT JOIN users u1 ON u1.id = r.reporter_id
    LEFT JOIN users u2 ON u2.id = r.target_user_id
    LEFT JOIN users u3 ON u3.id = r.resolved_by
    LEFT JOIN chats c ON c.id = r.target_chat_id
    LEFT JOIN messages m ON m.id = r.target_message_id
    WHERE r.id = ?
  `).get(req.params.id) as any;
  
  if (!report) {
    return res.status(404).json({ error: 'Report not found' });
  }
  
  // Get chat messages if this is a chat-related report
  let chatMessages: any[] = [];
  if (report.chat_id) {
    chatMessages = db.prepare(`
      SELECT m.id, m.content, m.sender_id, m.created_at, m.is_deleted,
        u.username AS sender_username, u.display_name AS sender_name, u.avatar_color AS sender_avatar_color
      FROM messages m
      JOIN users u ON u.id = m.sender_id
      WHERE m.chat_id = ?
      ORDER BY m.created_at DESC
      LIMIT 50
    `).all(report.chat_id) as any[];
  }
  
  res.json({
    report,
    chatMessages
  });
});

// POST /api/admin/reports/:id/notify — notify user about report review
router.post('/reports/:id/notify', (req, res) => {
  const db = getDb();
  const { message } = req.body as { message?: string };
  
  const report = db.prepare('SELECT * FROM reports WHERE id = ?').get(req.params.id) as any;
  
  if (!report || !report.target_user_id) {
    return res.status(404).json({ error: 'Report or target user not found' });
  }
  
  emitToUser(report.target_user_id, 'report_notification', {
    reportId: report.id,
    message: message || 'An admin is reviewing your reported content for assistance purposes only.',
    reportType: report.type,
    adminId: (req as any).user?.userId
  });
  
  // Log the notification
  db.prepare('INSERT INTO admin_actions (admin_id, action_type, target_user_id, details, created_at) VALUES (?,?,?,?,?)')
    .run((req as any).user?.userId, 'report_notify', report.target_user_id,
        `Notification sent: ${message || 'Default message'}`, Math.floor(Date.now() / 1000));
  
  res.json({ success: true });
});

// POST /api/admin/chats/:id/view — admin view chat (invisible to others)
router.post('/chats/:id/view', (req, res) => {
  const db = getDb();
  const chatId = req.params.id;
  const adminId = (req as any).user?.userId;
  
  // Check if admin is already in chat
  const existingMember = db.prepare('SELECT * FROM chat_members WHERE chat_id = ? AND user_id = ?')
    .get(chatId, adminId) as any;
  
  if (!existingMember) {
    // Add admin to chat invisibly
    db.prepare('INSERT INTO chat_members (chat_id, user_id, role, joined_at, is_invisible) VALUES (?,?,?,?,?)')
      .run(chatId, adminId, 'admin', Math.floor(Date.now() / 1000), 1);
  }
  
  // Get full chat history
  const messages = db.prepare(`
    SELECT m.id, m.content, m.sender_id, m.created_at, m.is_deleted,
      u.username AS sender_username, u.display_name AS sender_name, u.avatar_color AS sender_avatar_color
    FROM messages m
    JOIN users u ON u.id = m.sender_id
    WHERE m.chat_id = ?
    ORDER BY m.created_at DESC
    LIMIT 100
  `).all(chatId) as any[];
  
  // Notify the chat owner/admin that an admin is viewing (for transparency)
  const chat = db.prepare('SELECT id, name, type, owner_id FROM chats WHERE id = ?').get(chatId) as any;
  if (chat && chat.owner_id) {
    emitToUser(chat.owner_id, 'admin_viewing_chat', {
      chatId: chat.id,
      chatName: chat.name,
      adminId: adminId,
      message: 'An admin is temporarily viewing this chat to review a report'
    });
  }
  
  res.json({
    success: true,
    messages,
    chat
  });
});

// POST /api/admin/messages/:id/view-context — get message with context
router.post('/messages/:id/view-context', (req, res) => {
  const db = getDb();
  const messageId = req.params.id;
  
  // Get the message
  const message = db.prepare(`
    SELECT m.*, c.id AS chat_id, c.name AS chat_name, c.type AS chat_type
    FROM messages m
    JOIN chats c ON c.id = m.chat_id
    WHERE m.id = ?
  `).get(messageId) as any;
  
  if (!message) {
    return res.status(404).json({ error: 'Message not found' });
  }
  
  // Get surrounding messages (5 before, 5 after)
  const contextMessages = db.prepare(`
    SELECT m.id, m.content, m.sender_id, m.created_at,
      u.username AS sender_username, u.display_name AS sender_name
    FROM messages m
    JOIN users u ON u.id = m.sender_id
    WHERE m.chat_id = ?
    ORDER BY m.created_at
  `).all(message.chat_id) as any[];
  
  // Find index of our message
  const index = contextMessages.findIndex(m => m.id === messageId);
  const start = Math.max(0, index - 5);
  const end = Math.min(contextMessages.length, index + 6);
  const context = contextMessages.slice(start, end);
  
  // Get sender info
  const sender = db.prepare('SELECT id, username, display_name, avatar_color, is_prime FROM users WHERE id = ?')
    .get(message.sender_id) as any;
  
  res.json({
    message,
    context,
    sender,
    chat: {
      id: message.chat_id,
      name: message.chat_name,
      type: message.chat_type
    }
  });
});

// DELETE /api/admin/messages/:id
router.delete('/messages/:id', (req, res) => {
  const db = getDb();
  db.prepare('UPDATE messages SET is_deleted = 1, content = ? WHERE id = ?')
    .run('[Deleted by admin]', req.params.id);
  res.json({ success: true });
});

// GET /api/admin/backup — download the SQLite database file
router.get('/backup', (req, res) => {
  try {
    const db = getDb();
    // WAL checkpoint before backup
    db.exec('PRAGMA wal_checkpoint(FULL)');

    const dataDir = process.env.DATA_DIR || path.join(__dirname, '../../../data');
    const dbPath = path.join(dataDir, 'aura.db');

    if (!fs.existsSync(dbPath)) {
      // Try alternate paths
      const candidates = [
        path.join(__dirname, '../../data/aura.db'),
        '/tmp/aura-data/aura.db',
      ];
      const found = candidates.find(p => fs.existsSync(p));
      if (!found) return res.status(404).json({ error: 'Database file not found' });
      res.setHeader('Content-Disposition', `attachment; filename="aura-backup-${Date.now()}.db"`);
      res.setHeader('Content-Type', 'application/octet-stream');
      return fs.createReadStream(found).pipe(res);
    }

    res.setHeader('Content-Disposition', `attachment; filename="aura-backup-${Date.now()}.db"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    fs.createReadStream(dbPath).pipe(res);
  } catch (err) {
    console.error('Backup error:', err);
    res.status(500).json({ error: 'Backup failed' });
  }
});

// POST /api/report (from regular users) — extended with type + category
export const reportRouter = Router();
reportRouter.use(authenticateToken);
reportRouter.post('/', (req, res) => {
  const db = getDb();
  const { targetUserId, targetMessageId, reason, type, category } = req.body as {
    targetUserId?: string;
    targetMessageId?: string;
    reason: string;
    type?: string; // 'user' | 'message' | 'bug' | 'content' | 'other'
    category?: string;
  };
  if (!reason?.trim()) return res.status(400).json({ error: 'Reason required' });

  const VALID_TYPES = ['user', 'message', 'bug', 'content', 'spam', 'other'];
  const reportType = VALID_TYPES.includes(type || '') ? type : 'other';

  // Rate limit: max 5 reports per hour per user
  const hourAgo = Math.floor(Date.now() / 1000) - 3600;
  const recentCount = (db.prepare('SELECT COUNT(*) as c FROM reports WHERE reporter_id = ? AND created_at > ?')
    .get(req.user!.userId, hourAgo) as { c: number }).c;
  if (recentCount >= 5) return res.status(429).json({ error: 'Too many reports. Try again later.' });

  db.prepare('INSERT INTO reports (id, reporter_id, target_user_id, target_message_id, reason, type, category) VALUES (?,?,?,?,?,?,?)')
    .run(uuidv4(), req.user!.userId, targetUserId || null, targetMessageId || null, reason.trim(), reportType, category || null);
  res.json({ success: true });
});

export default router;
