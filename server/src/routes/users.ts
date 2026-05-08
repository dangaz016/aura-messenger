import { Router } from 'express';
import { getDb } from '../db/database';
import { authenticateToken } from '../middleware/auth';
import { UserRow, rowToPublicUser, AuraMode } from '../types';

const router = Router();

router.use(authenticateToken);

router.get('/search', (req, res) => {
  const q = (req.query.q as string || '').trim();
  if (q.length < 1) return res.json({ users: [] });

  const db = getDb();
  const users = db.prepare(`
    SELECT * FROM users
    WHERE id != ?
      AND (username LIKE ? OR display_name LIKE ?)
    ORDER BY username
    LIMIT 30
  `).all(req.user!.userId, `%${q}%`, `%${q}%`) as unknown as UserRow[];

  res.json({ users: users.map(rowToPublicUser) });
});

router.patch('/profile', (req, res) => {
  const { displayName, moodEmoji, moodText, auraMode, avatarColor, publicKey } = req.body;
  const db = getDb();

  const validModes: AuraMode[] = ['available', 'ghost', 'dnd'];
  if (auraMode && !validModes.includes(auraMode)) {
    return res.status(400).json({ error: 'Invalid aura mode' });
  }

  const updates: string[] = [];
  const values: (string | number | null)[] = [];

  if (displayName !== undefined) { updates.push('display_name = ?'); values.push(displayName); }
  if (moodEmoji !== undefined) { updates.push('mood_emoji = ?'); values.push(moodEmoji); }
  if (moodText !== undefined) { updates.push('mood_text = ?'); values.push(moodText); }
  if (auraMode !== undefined) { updates.push('aura_mode = ?'); values.push(auraMode); }
  if (avatarColor !== undefined) { updates.push('avatar_color = ?'); values.push(avatarColor); }
  if (publicKey !== undefined) { updates.push('public_key = ?'); values.push(publicKey); }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  values.push(req.user!.userId);
  db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values);

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user!.userId) as unknown as UserRow;
  res.json({ user: rowToPublicUser(user) });
});

router.get('/:id', (req, res) => {
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id) as unknown as UserRow | undefined;
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user: rowToPublicUser(user) });
});

export default router;
