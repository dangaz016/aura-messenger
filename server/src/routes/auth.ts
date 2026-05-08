import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/database';
import { signToken, authenticateToken } from '../middleware/auth';
import { UserRow, rowToPublicUser } from '../types';

const router = Router();

const AVATAR_COLORS = [
  '#7C3AED', '#A78BFA', '#EC4899', '#F472B6',
  '#3B82F6', '#06B6D4', '#10B981', '#F59E0B',
  '#EF4444', '#8B5CF6', '#14B8A6', '#F97316',
];

function pickColor() {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
}

router.post('/register', async (req, res) => {
  try {
    const { username, password, displayName } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      return res.status(400).json({ error: 'Username must be 3-20 chars: letters/numbers/underscore' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const db = getDb();
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) {
      return res.status(409).json({ error: 'Username already taken' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userId = uuidv4();
    const now = Math.floor(Date.now() / 1000);

    db.prepare(`
      INSERT INTO users (id, username, password_hash, display_name, avatar_color, created_at, last_seen)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(userId, username, passwordHash, displayName || username, pickColor(), now, now);

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as unknown as UserRow;
    const token = signToken({ userId: user.id, username: user.username });

    res.json({ token, user: rowToPublicUser(user) });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as unknown as UserRow | undefined;

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const now = Math.floor(Date.now() / 1000);
    db.prepare('UPDATE users SET last_seen = ? WHERE id = ?').run(now, user.id);
    user.last_seen = now;

    const token = signToken({ userId: user.id, username: user.username });
    res.json({ token, user: rowToPublicUser(user) });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/me', authenticateToken, (req, res) => {
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user!.userId) as unknown as UserRow | undefined;
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user: rowToPublicUser(user) });
});

export default router;
