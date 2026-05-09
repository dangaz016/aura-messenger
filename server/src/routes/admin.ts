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
      u3.username AS resolved_by_username
    FROM reports r
    LEFT JOIN users u1 ON u1.id = r.reporter_id
    LEFT JOIN users u2 ON u2.id = r.target_user_id
    LEFT JOIN users u3 ON u3.id = r.resolved_by
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
  const { adminNote } = req.body as { adminNote?: string };
  db.prepare('UPDATE reports SET resolved = 1, resolved_by = ?, resolved_at = unixepoch(), admin_note = ? WHERE id = ?')
    .run((req as any).user?.userId, adminNote || null, req.params.id);
  res.json({ success: true });
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
