import rateLimit from 'express-rate-limit';
import { v4 as uuidv4 } from 'uuid';

// ── Rate Limiters ─────────────────────────────────────────────────────────────

/** Global: 200 req/min per IP */
export const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  message: { error: 'Too many requests, slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === '/api/health',
});

/** Auth: 10 attempts / 15 min per IP */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts. Try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/** Register: 5 registrations / hour per IP */
export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: 'Too many accounts created from this IP. Try again in 1 hour.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/** File upload: 30 uploads / min per IP */
export const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Too many file uploads. Wait a bit.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/** AI: 20 req/min per IP */
export const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: 'AI rate limit exceeded. Try again in a minute.' },
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

// Clean up expired lockouts every 30 min
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
  if (entry.count >= 5) {
    entry.lockedUntil = now + 15 * 60 * 1000; // 15-min lockout
    entry.count = 0;
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
}

const captchas = new Map<string, CaptchaEntry>();

// Clean up expired captchas every 10 min
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of captchas) {
    if (val.expires < now) captchas.delete(key);
  }
}, 10 * 60 * 1000);

export function generateCaptcha(): { id: string; question: string } {
  const a = Math.floor(Math.random() * 20) + 1;
  const b = Math.floor(Math.random() * 20) + 1;
  const useAdd = Math.random() > 0.4;
  const bigger = Math.max(a, b);
  const smaller = Math.min(a, b);
  const answer = useAdd ? a + b : bigger - smaller;
  const question = useAdd ? `${a} + ${b}` : `${bigger} − ${smaller}`;
  const id = uuidv4();
  captchas.set(id, { answer, expires: Date.now() + 10 * 60 * 1000, used: false });
  return { id, question };
}

export function validateCaptcha(id: string, answer: number): boolean {
  const entry = captchas.get(id);
  if (!entry || entry.used || entry.expires < Date.now()) return false;
  if (entry.answer !== Math.floor(answer)) return false;
  entry.used = true; // one-time use
  return true;
}

// ── Helmet CSP config ─────────────────────────────────────────────────────────

export const helmetOptions = {
  // Allow the SPA to load scripts/styles from same origin
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
  crossOriginEmbedderPolicy: false, // needed for media blobs
  crossOriginResourcePolicy: { policy: 'cross-origin' as const }, // allow media from same domain
};
