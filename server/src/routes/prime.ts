import { Router } from 'express';
import { getDb } from '../db/database';
import { authenticateToken } from '../middleware/auth';
import { UserRow, rowToPublicUser } from '../types';

const router = Router();
router.use(authenticateToken);

// GET /api/prime/status — current user's Prime status
router.get('/status', (req, res) => {
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user!.userId) as UserRow | undefined;
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user: rowToPublicUser(user) });
});

// PATCH /api/prime/settings — update Prime theme/badge/animatedAvatar (Prime users only)
router.patch('/settings', (req, res) => {
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user!.userId) as UserRow | undefined;
  if (!user) return res.status(404).json({ error: 'User not found' });

  const now = Math.floor(Date.now() / 1000);
  const primeActive = user.is_prime === 1 && (user.prime_expires_at === 0 || user.prime_expires_at > now);
  if (!primeActive) return res.status(403).json({ error: 'Aura Prime required' });

  const VALID_THEMES = ['default', 'midnight', 'cosmos', 'aurora', 'rose', 'ocean', 'sakura'];
  const VALID_BADGES = ['crown', 'star', 'diamond', 'fire', 'lightning', 'crystal'];

  const { theme, badge, animatedAvatar } = req.body as {
    theme?: string;
    badge?: string;
    animatedAvatar?: boolean;
  };

  if (theme && !VALID_THEMES.includes(theme)) {
    return res.status(400).json({ error: 'Invalid theme' });
  }
  if (badge && !VALID_BADGES.includes(badge)) {
    return res.status(400).json({ error: 'Invalid badge' });
  }

  if (theme) db.prepare('UPDATE users SET prime_theme = ? WHERE id = ?').run(theme, user.id);
  if (badge) db.prepare('UPDATE users SET prime_badge = ? WHERE id = ?').run(badge, user.id);
  if (animatedAvatar !== undefined) {
    db.prepare('UPDATE users SET prime_animated_avatar = ? WHERE id = ?').run(animatedAvatar ? 1 : 0, user.id);
  }

  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id) as UserRow;
  res.json({ user: rowToPublicUser(updated) });
});

// POST /api/prime/grant — admin: grant Prime to a user
router.post('/grant', (req, res) => {
  const db = getDb();
  const requestor = db.prepare('SELECT is_admin FROM users WHERE id = ?').get(req.user!.userId) as { is_admin: number } | undefined;
  if (!requestor?.is_admin) return res.status(403).json({ error: 'Admin only' });

  const { userId, durationDays } = req.body as { userId: string; durationDays?: number };
  if (!userId) return res.status(400).json({ error: 'userId required' });

  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as UserRow | undefined;
  if (!target) return res.status(404).json({ error: 'User not found' });

  const now = Math.floor(Date.now() / 1000);
  // 0 = permanent; otherwise set expiry
  const expiresAt = durationDays ? now + durationDays * 86400 : 0;

  db.prepare('UPDATE users SET is_prime = 1, prime_expires_at = ? WHERE id = ?').run(expiresAt, userId);
  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as UserRow;
  res.json({ user: rowToPublicUser(updated) });
});

// POST /api/prime/revoke — admin: revoke Prime
router.post('/revoke', (req, res) => {
  const db = getDb();
  const requestor = db.prepare('SELECT is_admin FROM users WHERE id = ?').get(req.user!.userId) as { is_admin: number } | undefined;
  if (!requestor?.is_admin) return res.status(403).json({ error: 'Admin only' });

  const { userId } = req.body as { userId: string };
  if (!userId) return res.status(400).json({ error: 'userId required' });

  db.prepare('UPDATE users SET is_prime = 0, prime_expires_at = 0 WHERE id = ?').run(userId);
  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as UserRow;
  res.json({ user: rowToPublicUser(updated) });
});

export default router;
