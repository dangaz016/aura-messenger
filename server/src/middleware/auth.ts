import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JwtPayload } from '../types';
import { getDb } from '../db/database';

export const JWT_SECRET = process.env.JWT_SECRET || 'aura-dev-secret-change-in-production';
export const JWT_EXPIRES_IN = '30d';

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}

export function authenticateToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  // Check ban/freeze status
  try {
    const db = getDb();
    const row = db.prepare('SELECT is_banned, is_frozen, ban_reason FROM users WHERE id = ?').get(payload.userId) as
      { is_banned: number; is_frozen: number; ban_reason: string | null } | undefined;
    if (row) {
      if (row.is_banned) {
        return res.status(403).json({ error: 'Account banned', reason: row.ban_reason || 'Violation of terms' });
      }
      if (row.is_frozen) {
        return res.status(403).json({ error: 'Account temporarily frozen. Contact support.' });
      }
    }
  } catch { /* db error — allow through */ }

  req.user = payload;
  next();
}

// Middleware to require admin
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const db = getDb();
  const row = db.prepare('SELECT is_admin FROM users WHERE id = ?').get(req.user.userId) as
    { is_admin: number } | undefined;
  if (!row || !row.is_admin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}
