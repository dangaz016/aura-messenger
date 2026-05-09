import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { createHmac } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/database';
import { signToken, authenticateToken } from '../middleware/auth';
import {
  authLimiter, registerLimiter, powLimiter,
  generateCaptcha, validateCaptcha,
  generatePowChallenge, validatePow,
  checkLockout, recordFailedAttempt, clearLockout,
  addSuspicion, suspicionGuard, registrationDelay,
} from '../middleware/security';
import { UserRow, rowToPublicUser } from '../types';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

const router = Router();

// GET /api/auth/captcha — get a math challenge
router.get('/captcha', (req, res) => {
  const ip = req.ip || '';
  const captcha = generateCaptcha(ip);
  res.json(captcha);
});

// GET /api/auth/pow — get a proof-of-work challenge
router.get('/pow', powLimiter, (req, res) => {
  const ip = req.ip || '';
  const pow = generatePowChallenge(ip);
  res.json(pow);
});

const AVATAR_COLORS = [
  '#7C3AED', '#A78BFA', '#EC4899', '#F472B6',
  '#3B82F6', '#06B6D4', '#10B981', '#F59E0B',
  '#EF4444', '#8B5CF6', '#14B8A6', '#F97316',
];

function pickColor() {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
}

router.post('/register', suspicionGuard, registerLimiter, registrationDelay, async (req, res) => {
  const ip = req.ip || '';
  try {
    const {
      username, password, displayName,
      captchaId, captchaAnswer,
      powId, powNonce,
      honeypot,        // must be empty — hidden field
      behaviorScore,   // client-side score 0-100 (higher = more human)
      timeOnPage,      // ms spent on form (too fast = bot)
    } = req.body as {
      username: string; password: string; displayName?: string;
      captchaId?: string; captchaAnswer?: string;
      powId?: string; powNonce?: string;
      honeypot?: string;
      behaviorScore?: number;
      timeOnPage?: number;
    };

    // ── Honeypot check ────────────────────────────────────────────────────────
    if (honeypot && honeypot.trim() !== '') {
      addSuspicion(ip, 100); // instant ban — bots fill hidden fields
      return res.status(400).json({ error: 'Verification failed.' });
    }

    // ── Time-on-page check (<3s = bot) ────────────────────────────────────────
    if (timeOnPage !== undefined && timeOnPage < 3000) {
      addSuspicion(ip, 40);
      return res.status(400).json({ error: 'Please fill the form more carefully.' });
    }

    // ── Behavioural score check ───────────────────────────────────────────────
    if (behaviorScore !== undefined && behaviorScore < 20) {
      addSuspicion(ip, 30);
      return res.status(400).json({ error: 'Bot-like behaviour detected. Please try again.' });
    }

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      return res.status(400).json({ error: 'Username must be 3-20 chars: letters/numbers/underscore' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    if (displayName && displayName.length > 50) {
      return res.status(400).json({ error: 'Display name too long (max 50)' });
    }

    // ── Proof-of-Work validation ──────────────────────────────────────────────
    if (!powId || !powNonce) {
      return res.status(400).json({ error: 'Proof-of-work required. Please wait for verification to complete.' });
    }
    if (!validatePow(powId, powNonce, ip)) {
      addSuspicion(ip, 20);
      return res.status(400).json({ error: 'Invalid proof-of-work. Please refresh and try again.' });
    }

    // ── CAPTCHA validation ────────────────────────────────────────────────────
    if (!captchaId || captchaAnswer === undefined || captchaAnswer === '') {
      return res.status(400).json({ error: 'CAPTCHA required' });
    }
    if (!validateCaptcha(captchaId, Number(captchaAnswer), ip)) {
      addSuspicion(ip, 10);
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

// ── Telegram Login Widget ─────────────────────────────────────────────────────
// GET /api/auth/telegram/status
router.get('/telegram/status', (_req, res) => {
  res.json({ available: !!TELEGRAM_BOT_TOKEN, botToken: TELEGRAM_BOT_TOKEN ? 'configured' : null });
});

// POST /api/auth/telegram — verify Telegram Login Widget data
router.post('/telegram', authLimiter, async (req, res) => {
  try {
    if (!TELEGRAM_BOT_TOKEN) {
      return res.status(503).json({ error: 'Telegram sign-in not configured. Set TELEGRAM_BOT_TOKEN in .env' });
    }

    // Telegram Login Widget sends: id, first_name, last_name, username, photo_url, auth_date, hash
    const { id, first_name, last_name, username, photo_url, auth_date, hash } = req.body as {
      id: string | number;
      first_name?: string;
      last_name?: string;
      username?: string;
      photo_url?: string;
      auth_date: string | number;
      hash: string;
    };

    if (!id || !auth_date || !hash) {
      return res.status(400).json({ error: 'Missing Telegram auth data' });
    }

    // Verify auth_date is fresh (within 1 day)
    const authDateNum = typeof auth_date === 'string' ? parseInt(auth_date) : auth_date;
    if (Date.now() / 1000 - authDateNum > 86400) {
      return res.status(401).json({ error: 'Telegram auth data expired' });
    }

    // Build data-check-string: sorted key=value pairs (excluding hash)
    const data: Record<string, string> = {
      id: String(id),
      auth_date: String(auth_date),
    };
    if (first_name) data.first_name = first_name;
    if (last_name) data.last_name = last_name;
    if (username) data.username = username;
    if (photo_url) data.photo_url = photo_url;

    const checkString = Object.keys(data)
      .sort()
      .map(k => `${k}=${data[k]}`)
      .join('\n');

    // Secret key = SHA256(bot_token), NOT HMAC
    const { createHash } = await import('crypto');
    const secretKey = createHash('sha256').update(TELEGRAM_BOT_TOKEN).digest();
    const expectedHash = createHmac('sha256', secretKey).update(checkString).digest('hex');

    if (expectedHash !== hash) {
      return res.status(401).json({ error: 'Invalid Telegram signature' });
    }

    const db = getDb();
    const now = Math.floor(Date.now() / 1000);
    const telegramId = String(id);

    // Find existing user by telegram_id
    let user = db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(telegramId) as UserRow | undefined;

    if (user) {
      // Update last_seen and photo if changed
      db.prepare('UPDATE users SET last_seen = ?, avatar_url = COALESCE(?, avatar_url) WHERE id = ?')
        .run(now, photo_url ?? null, user.id);
    } else {
      // Create new user from Telegram profile
      const displayName = [first_name, last_name].filter(Boolean).join(' ') || `User${telegramId.slice(-4)}`;
      // Generate unique username from telegram username or id
      let baseUsername = username
        ? username.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 18)
        : `tg${telegramId.slice(-8)}`;
      // Ensure username is at least 3 chars
      if (baseUsername.length < 3) baseUsername = `tg_${baseUsername}`;

      let finalUsername = baseUsername;
      let suffix = 1;
      while (db.prepare('SELECT id FROM users WHERE username = ?').get(finalUsername)) {
        finalUsername = `${baseUsername}${suffix++}`;
      }

      const AVATAR_COLORS = ['#7C3AED', '#A78BFA', '#EC4899', '#F472B6', '#3B82F6', '#06B6D4', '#10B981'];
      const avatarColor = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
      const userId = uuidv4();
      const dummyHash = `$2a$10$telegram_user_no_password_${userId.slice(0, 12)}`;

      db.prepare(`
        INSERT INTO users (id, username, email, password_hash, display_name, avatar_color, avatar_url, telegram_id, created_at, last_seen)
        VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?)
      `).run(userId, finalUsername, dummyHash, displayName, avatarColor, photo_url ?? null, telegramId, now, now);

      user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as UserRow;
    }

    if (user.is_banned) {
      return res.status(403).json({ error: 'Account banned', reason: user.ban_reason });
    }

    const token = signToken({ userId: user.id, username: user.username });
    res.json({ token, user: rowToPublicUser(user) });
  } catch (err) {
    console.error('Telegram auth error:', err);
    res.status(500).json({ error: 'Telegram sign-in failed' });
  }
});

// POST /api/auth/telegram/link — link Telegram to existing account (authenticated)
router.post('/telegram/link', authenticateToken, authLimiter, async (req, res) => {
  try {
    if (!TELEGRAM_BOT_TOKEN) {
      return res.status(503).json({ error: 'Telegram not configured' });
    }

    const { id, first_name, last_name, username, photo_url, auth_date, hash } = req.body as {
      id: string | number; first_name?: string; last_name?: string;
      username?: string; photo_url?: string; auth_date: string | number; hash: string;
    };

    if (!id || !auth_date || !hash) return res.status(400).json({ error: 'Missing Telegram auth data' });

    const authDateNum = typeof auth_date === 'string' ? parseInt(auth_date) : auth_date;
    if (Date.now() / 1000 - authDateNum > 86400) return res.status(401).json({ error: 'Auth data expired' });

    const data: Record<string, string> = { id: String(id), auth_date: String(auth_date) };
    if (first_name) data.first_name = first_name;
    if (last_name) data.last_name = last_name;
    if (username) data.username = username;
    if (photo_url) data.photo_url = photo_url;

    const checkString = Object.keys(data).sort().map(k => `${k}=${data[k]}`).join('\n');
    const { createHash } = await import('crypto');
    const secretKey = createHash('sha256').update(TELEGRAM_BOT_TOKEN).digest();
    const expectedHash = createHmac('sha256', secretKey).update(checkString).digest('hex');
    if (expectedHash !== hash) return res.status(401).json({ error: 'Invalid signature' });

    const db = getDb();
    const telegramId = String(id);

    // Check not already linked to another account
    const existing = db.prepare('SELECT id FROM users WHERE telegram_id = ?').get(telegramId) as { id: string } | undefined;
    if (existing && existing.id !== req.user!.userId) {
      return res.status(409).json({ error: 'This Telegram account is linked to another user' });
    }

    db.prepare('UPDATE users SET telegram_id = ? WHERE id = ?').run(telegramId, req.user!.userId);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user!.userId) as UserRow;
    res.json({ user: rowToPublicUser(user) });
  } catch (err) {
    console.error('Telegram link error:', err);
    res.status(500).json({ error: 'Failed to link Telegram' });
  }
});

export default router;
