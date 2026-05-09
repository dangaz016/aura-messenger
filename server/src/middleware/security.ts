import rateLimit from 'express-rate-limit';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';

// ── Rate Limiters ─────────────────────────────────────────────────────────────

/** Global: 120 req/min per IP */
export const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  message: { error: 'Too many requests, slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === '/api/health',
});

/** Auth login: 5 attempts / 15 min per IP */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many login attempts. Try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/** Register: 2 registrations / hour per IP — very strict */
export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 2,
  message: { error: 'Too many accounts created from this IP. Try again in 1 hour.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/** File upload: 20 uploads / min per IP */
export const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: 'Too many file uploads. Wait a bit.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/** AI: 15 req/min per IP */
export const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  message: { error: 'AI rate limit exceeded. Try again in a minute.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/** PoW challenge: 10 req/min per IP */
export const powLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Too many challenge requests.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ── Account Lockout ───────────────────────────────────────────────────────────

interface LockoutEntry {
  count: number;
  lockedUntil: number;
  lastAttempt: number;
}

const lockouts = new Map<string, LockoutEntry>();

setInterval(() => {
  const now = Date.now();
  for (const [key, val] of lockouts) {
    if (val.lockedUntil < now && val.lastAttempt < now - 2 * 60 * 60 * 1000) {
      lockouts.delete(key);
    }
  }
}, 30 * 60 * 1000);

export function checkLockout(key: string): { locked: boolean; remainingMinutes: number } {
  const entry = lockouts.get(key);
  if (!entry) return { locked: false, remainingMinutes: 0 };
  if (entry.lockedUntil > Date.now()) {
    const remaining = Math.ceil((entry.lockedUntil - Date.now()) / 60_000);
    return { locked: true, remainingMinutes: remaining };
  }
  return { locked: false, remainingMinutes: 0 };
}

export function recordFailedAttempt(key: string): number {
  const now = Date.now();
  const entry = lockouts.get(key) || { count: 0, lockedUntil: 0, lastAttempt: 0 };
  entry.count++;
  entry.lastAttempt = now;
  // Progressive lockout: 5 fails=15min, 10 fails=1h, 20 fails=24h
  if (entry.count >= 20) {
    entry.lockedUntil = now + 24 * 60 * 60 * 1000;
    entry.count = 0;
  } else if (entry.count >= 10) {
    entry.lockedUntil = now + 60 * 60 * 1000;
    entry.count = 0;
  } else if (entry.count >= 5) {
    entry.lockedUntil = now + 15 * 60 * 1000;
  }
  lockouts.set(key, entry);
  return entry.count;
}

export function clearLockout(key: string): void {
  lockouts.delete(key);
}

// ── CAPTCHA (server-side math challenge) ─────────────────────────────────────

interface CaptchaEntry {
  answer: number;
  expires: number;
  used: boolean;
  ip: string;
}

const captchas = new Map<string, CaptchaEntry>();

setInterval(() => {
  const now = Date.now();
  for (const [key, val] of captchas) {
    if (val.expires < now) captchas.delete(key);
  }
}, 10 * 60 * 1000);

export function generateCaptcha(ip = ''): { id: string; question: string } {
  // More complex: mix of operations
  const ops = ['+', '-', '*'] as const;
  const op = ops[Math.floor(Math.random() * ops.length)];
  let a: number, b: number, answer: number, question: string;
  if (op === '*') {
    a = Math.floor(Math.random() * 9) + 2;
    b = Math.floor(Math.random() * 9) + 2;
    answer = a * b;
    question = `${a} × ${b}`;
  } else if (op === '+') {
    a = Math.floor(Math.random() * 50) + 10;
    b = Math.floor(Math.random() * 50) + 10;
    answer = a + b;
    question = `${a} + ${b}`;
  } else {
    a = Math.floor(Math.random() * 50) + 30;
    b = Math.floor(Math.random() * 20) + 5;
    answer = a - b;
    question = `${a} − ${b}`;
  }
  const id = uuidv4();
  captchas.set(id, { answer, expires: Date.now() + 10 * 60 * 1000, used: false, ip });
  console.log(`Generated captcha: ${question} = ${answer} (ID: ${id})`);
  return { id, question };
}

export function validateCaptcha(id: string, answer: number, ip = ''): boolean {
  const entry = captchas.get(id);
  if (!entry) {
    console.log(`Captcha not found (ID: ${id})`);
    return false;
  }
  if (entry.used) {
    console.log(`Captcha already used (ID: ${id})`);
    return false;
  }
  if (entry.expires < Date.now()) {
    console.log(`Captcha expired (ID: ${id})`);
    return false;
  }
  // IP binding
  if (entry.ip && ip && entry.ip !== ip) {
    console.log(`Captcha IP mismatch (ID: ${id})`);
    return false;
  }
  if (entry.answer !== Math.floor(answer)) {
    console.log(`Incorrect captcha answer (ID: ${id}, expected: ${entry.answer}, got: ${answer})`);
    return false;
  }
  entry.used = true;
  console.log(`Captcha validated successfully (ID: ${id})`);
  return true;
}

// ── Proof-of-Work ─────────────────────────────────────────────────────────────
// Client must find nonce such that SHA256(challenge + nonce) starts with N zeroes

interface PowEntry {
  challenge: string;
  difficulty: number; // number of leading zero bits required
  expires: number;
  used: boolean;
  ip: string;
}

const powChallenges = new Map<string, PowEntry>();

setInterval(() => {
  const now = Date.now();
  for (const [key, val] of powChallenges) {
    if (val.expires < now) powChallenges.delete(key);
  }
}, 5 * 60 * 1000);

export function generatePowChallenge(ip = ''): { id: string; challenge: string; difficulty: number } {
  const challenge = crypto.randomBytes(32).toString('hex');
  const difficulty = 16; // 16 leading zero bits — ~65k hashes, ~1-2 seconds on modern hardware
  const id = uuidv4();
  powChallenges.set(id, {
    challenge,
    difficulty,
    expires: Date.now() + 15 * 60 * 1000, // 15 min to solve
    used: false,
    ip,
  });
  return { id, challenge, difficulty };
}

export function validatePow(id: string, nonce: string, ip = ''): boolean {
  const entry = powChallenges.get(id);
  if (!entry || entry.used || entry.expires < Date.now()) return false;
  if (entry.ip && ip && entry.ip !== ip) return false;

  // Verify: SHA256(challenge + nonce) must have `difficulty` leading zero bits
  const hash = crypto.createHash('sha256')
    .update(entry.challenge + nonce)
    .digest();

  // Check leading zero bits
  let zeroBits = 0;
  for (const byte of hash) {
    if (byte === 0) {
      zeroBits += 8;
    } else {
      // Count leading zero bits in this byte
      let b = byte;
      while ((b & 0x80) === 0) { zeroBits++; b <<= 1; }
      break;
    }
    if (zeroBits >= entry.difficulty) break;
  }

  if (zeroBits < entry.difficulty) return false;
  entry.used = true;
  return true;
}

// ── Suspicious Request Detection ──────────────────────────────────────────────

// Track IPs that submitted honeypot fields or failed multiple captchas
const suspiciousIps = new Map<string, { score: number; bannedUntil: number }>();

export function addSuspicion(ip: string, points: number): void {
  const entry = suspiciousIps.get(ip) || { score: 0, bannedUntil: 0 };
  entry.score += points;
  if (entry.score >= 100) {
    entry.bannedUntil = Date.now() + 24 * 60 * 60 * 1000; // 24h ban
    entry.score = 0;
    console.warn(`[security] IP ${ip} auto-banned (score overflow)`);
  }
  suspiciousIps.set(ip, entry);
}

export function isSuspiciousIp(ip: string): boolean {
  const entry = suspiciousIps.get(ip);
  if (!entry) return false;
  if (entry.bannedUntil > Date.now()) return true;
  if (entry.score >= 50) return true;
  return false;
}

/** Middleware: block auto-banned IPs */
export function suspicionGuard(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip || req.socket.remoteAddress || '';
  const entry = suspiciousIps.get(ip);
  if (entry && entry.bannedUntil > Date.now()) {
    // Slow-respond to not reveal the block timing
    setTimeout(() => res.status(403).json({ error: 'Access denied.' }), 500 + Math.random() * 1000);
    return;
  }
  next();
}

/** Middleware: add artificial delay on registration to slow down bots */
export function registrationDelay(req: Request, res: Response, next: NextFunction) {
  // Random 300-800ms delay — imperceptible for humans, costly for bots
  setTimeout(next, 300 + Math.random() * 500);
}

// ── Helmet CSP config ─────────────────────────────────────────────────────────

export const helmetOptions = {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
      imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
      connectSrc: ["'self'", 'wss:', 'ws:', 'https:'],
      mediaSrc: ["'self'", 'blob:'],
      objectSrc: ["'none'"],
      frameSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' as const },
};
