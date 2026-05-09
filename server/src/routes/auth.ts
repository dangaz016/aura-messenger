import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/database';
import { signToken, authenticateToken } from '../middleware/auth';
import {
  authLimiter, registerLimiter,
  generateCaptcha, validateCaptcha,
  checkLockout, recordFailedAttempt, clearLockout,
} from '../middleware/security';
import { UserRow, rowToPublicUser } from '../types';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;

const router = Router();

// GET /api/auth/captcha — get a math challenge
router.get('/captcha', (req, res) => {
  const captcha = generateCaptcha();
  res.json(captcha);
});

const AVATAR_COLORS = [
  '#7C3AED', '#A78BFA', '#EC4899', '#F472B6',
  '#3B82F6', '#06B6D4', '#10B981', '#F59E0B',
  '#EF4444', '#8B5CF6', '#14B8A6', '#F97316',
];

function pickColor() {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
}

router.post('/register', registerLimiter, async (req, res) => {
  try {
    const { username, password, displayName, captchaId, captchaAnswer } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      return res.status(400).json({ error: 'Username must be 3-20 chars: letters/numbers/underscore' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    if (displayName && displayName.length > 50) {
      return res.status(400).json({ error: 'Display name too long (max 50)' });
    }

    // CAPTCHA validation
    if (!captchaId || captchaAnswer === undefined || captchaAnswer === '') {
      return res.status(400).json({ error: 'CAPTCHA required' });
    }
    if (!validateCaptcha(captchaId, Number(captchaAnswer))) {
      return res.status(400).json({ error: 'Incorrect CAPTCHA. Please try again.' });
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

router.post('/login', authLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password || typeof username !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Account lockout check (per IP + username combo)
    const lockKey = `login:${req.ip}:${String(username).toLowerCase()}`;
    const lockStatus = checkLockout(lockKey);
    if (lockStatus.locked) {
      return res.status(429).json({
        error: `Too many failed attempts. Try again in ${lockStatus.remainingMinutes} minute${lockStatus.remainingMinutes > 1 ? 's' : ''}.`,
      });
    }

    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as unknown as UserRow | undefined;

    if (!user) {
      recordFailedAttempt(lockKey);
      // Same error as wrong password — don't reveal username existence
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      const remaining = 5 - (recordFailedAttempt(lockKey) || 0);
      const hint = remaining > 0 && remaining <= 3 ? ` (${remaining} attempt${remaining !== 1 ? 's' : ''} left)` : '';
      return res.status(401).json({ error: `Invalid credentials${hint}` });
    }

    // Successful login — clear lockout
    clearLockout(lockKey);

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
  // Update last_seen on /me requests so we know user is active
  const now = Math.floor(Date.now() / 1000);
  db.prepare('UPDATE users SET last_seen = ? WHERE id = ?').run(now, user.id);
  user.last_seen = now;
  res.json({ user: rowToPublicUser(user) });
});

// POST /auth/google - sign in with Google ID token
router.get('/google/status', (_req, res) => {
  res.json({ available: !!GOOGLE_CLIENT_ID, clientId: GOOGLE_CLIENT_ID || null });
});

router.post('/google', async (req, res) => {
  try {
    if (!GOOGLE_CLIENT_ID) {
      return res.status(503).json({ error: 'Google sign-in not configured' });
    }
    const { credential } = req.body as { credential: string };
    if (!credential) return res.status(400).json({ error: 'Missing credential' });

    // Verify the ID token via Google's tokeninfo endpoint (no extra deps)
    const verifyRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
    if (!verifyRes.ok) {
      return res.status(401).json({ error: 'Invalid Google token' });
    }
    const payload = await verifyRes.json() as {
      sub: string;
      email?: string;
      name?: string;
      picture?: string;
      aud?: string;
      exp?: string;
    };

    if (payload.aud !== GOOGLE_CLIENT_ID) {
      return res.status(401).json({ error: 'Token audience mismatch' });
    }
    const expSeconds = payload.exp ? parseInt(payload.exp) : 0;
    if (expSeconds && expSeconds * 1000 < Date.now()) {
      return res.status(401).json({ error: 'Token expired' });
    }

    const db = getDb();
    const now = Math.floor(Date.now() / 1000);

    // Find or create user
    let user = db.prepare('SELECT * FROM users WHERE google_id = ?').get(payload.sub) as unknown as UserRow | undefined;

    if (!user && payload.email) {
      user = db.prepare('SELECT * FROM users WHERE email = ?').get(payload.email) as unknown as UserRow | undefined;
      if (user) {
        db.prepare('UPDATE users SET google_id = ?, avatar_url = COALESCE(avatar_url, ?), last_seen = ? WHERE id = ?')
          .run(payload.sub, payload.picture ?? null, now, user.id);
      }
    }

    if (!user) {
      // Create new user from Google profile
      const userId = uuidv4();
      let username = (payload.email?.split('@')[0] || `user_${userId.slice(0, 6)}`)
        .replace(/[^a-zA-Z0-9_]/g, '_')
        .slice(0, 18);
      // Ensure uniqueness
      let suffix = 0;
      while (db.prepare('SELECT 1 FROM users WHERE username = ?').get(username)) {
        suffix += 1;
        username = `${username.slice(0, 16)}_${suffix}`;
      }
      const displayName = payload.name || username;
      const avatarColor = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
      const dummyHash = `$2a$10$google_oauth_user_no_password_${userId.slice(0, 12)}`;

      db.prepare(`
        INSERT INTO users (id, username, email, password_hash, display_name, avatar_color, avatar_url, google_id, created_at, last_seen)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(userId, username, payload.email ?? null, dummyHash, displayName, avatarColor, payload.picture ?? null, payload.sub, now, now);

      user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as unknown as UserRow;
    }

    db.prepare('UPDATE users SET last_seen = ? WHERE id = ?').run(now, user!.id);
    user!.last_seen = now;

    const token = signToken({ userId: user!.id, username: user!.username });
    res.json({ token, user: rowToPublicUser(user!) });
  } catch (err) {
    console.error('Google auth error:', err);
    res.status(500).json({ error: 'Google sign-in failed' });
  }
});

export default router;
