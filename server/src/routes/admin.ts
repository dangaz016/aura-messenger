import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/database';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import { UserRow } from '../types';

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
           ban_reason, created_at, last_seen, email
    FROM users
    WHERE username LIKE ? OR display_name LIKE ?
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).all(`%${search}%`, `%${search}%`, limit, offset) as unknown as UserRow[];
  res.json(rows.map(r => ({
    id: r.id,
    username: r.username,
    displayName: r.display_name,
    avatarColor: r.avatar_color,
    isAdmin: r.is_admin === 1,
    isBanned: r.is_banned === 1,
    isFrozen: r.is_frozen === 1,
    banReason: r.ban_reason,
    createdAt: r.created_at,
    lastSeen: r.last_seen,
    email: r.email,
  })));
});

// POST /api/admin/users/:id/ban
router.post('/users/:id/ban', (req, res) => {
  const db = getDb();
  const { reason } = req.body as { reason?: string };
  db.prepare('UPDATE users SET is_banned = 1, ban_reason = ? WHERE id = ?')
    .run(reason || 'Violation of terms', req.params.id);
  res.json({ success: true });
});

// POST /api/admin/users/:id/unban
router.post('/users/:id/unban', (req, res) => {
  const db = getDb();
  db.prepare('UPDATE users SET is_banned = 0, ban_reason = NULL WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// POST /api/admin/users/:id/freeze
router.post('/users/:id/freeze', (req, res) => {
  const db = getDb();
  db.prepare('UPDATE users SET is_frozen = 1 WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// POST /api/admin/users/:id/unfreeze
router.post('/users/:id/unfreeze', (req, res) => {
  const db = getDb();
  db.prepare('UPDATE users SET is_frozen = 0 WHERE id = ?').run(req.params.id);
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
router.get('/reports', (_req, res) => {
  const db = getDb();
  const rows = db.prepare(`
    SELECT r.*, 
      u1.username AS reporter_username, u1.display_name AS reporter_name,
      u2.username AS target_username, u2.display_name AS target_name
    FROM reports r
    LEFT JOIN users u1 ON u1.id = r.reporter_id
    LEFT JOIN users u2 ON u2.id = r.target_user_id
    WHERE r.resolved = 0
    ORDER BY r.created_at DESC
    LIMIT 100
  `).all() as unknown[];
  res.json(rows);
});

// POST /api/admin/reports/:id/resolve
router.post('/reports/:id/resolve', (req, res) => {
  const db = getDb();
  db.prepare('UPDATE reports SET resolved = 1 WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// DELETE /api/admin/messages/:id
router.delete('/messages/:id', (req, res) => {
  const db = getDb();
  db.prepare('UPDATE messages SET is_deleted = 1, content = ? WHERE id = ?')
    .run('[Deleted by admin]', req.params.id);
  res.json({ success: true });
});

// POST /api/admin/report (from regular users)
export const reportRouter = Router();
reportRouter.use(authenticateToken);
reportRouter.post('/', (req, res) => {
  const db = getDb();
  const { targetUserId, targetMessageId, reason } = req.body as {
    targetUserId?: string;
    targetMessageId?: string;
    reason: string;
  };
  if (!reason?.trim()) return res.status(400).json({ error: 'Reason required' });
  db.prepare('INSERT INTO reports (id, reporter_id, target_user_id, target_message_id, reason) VALUES (?,?,?,?,?)')
    .run(uuidv4(), req.user!.userId, targetUserId || null, targetMessageId || null, reason.trim());
  res.json({ success: true });
});

export default router;
