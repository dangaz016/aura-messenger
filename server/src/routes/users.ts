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
  const { displayName, moodEmoji, moodText, auraMode, avatarColor, publicKey, avatarUrl, birthday } = req.body;
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
  if (avatarUrl !== undefined) { updates.push('avatar_url = ?'); values.push(avatarUrl || null); }
  const bio = req.body.bio;
  if (bio !== undefined) { updates.push('bio = ?'); values.push(bio.slice(0, 300)); }
  if (birthday !== undefined) {
    // Validate MM-DD format or null
    const valid = birthday === null || birthday === '' || /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(birthday);
    if (!valid) return res.status(400).json({ error: 'Invalid birthday format' });
    updates.push('birthday = ?');
    values.push(birthday || null);
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  values.push(req.user!.userId);
  db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values);

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user!.userId) as unknown as UserRow;
  res.json({ user: rowToPublicUser(user) });
});

router.patch('/username', (req, res) => {
  const { newUsername } = req.body;

  if (!newUsername) {
    return res.status(400).json({ error: 'New username is required' });
  }

  if (!/^[a-zA-Z0-9_]{3,20}$/.test(newUsername)) {
    return res.status(400).json({ error: 'Username must be 3-20 chars: letters/numbers/underscore' });
  }

  const db = getDb();
  const currentUser = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user!.userId) as unknown as UserRow;

  if (!currentUser) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Check if username is the same
  if (currentUser.username === newUsername) {
    return res.status(400).json({ error: 'New username cannot be the same as current' });
  }

  // Check if 30 days have passed since last change
  const now = Math.floor(Date.now() / 1000);
  const lastChange = currentUser.last_username_change || 0;
  const daysSinceChange = (now - lastChange) / (60 * 60 * 24);

  if (daysSinceChange < 30) {
    const daysLeft = Math.ceil(30 - daysSinceChange);
    return res.status(403).json({ 
      error: `You can change your username again in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`,
      daysLeft 
    });
  }

  // Check if new username is taken
  const existing = db.prepare('SELECT id FROM users WHERE username = ? AND id != ?')
    .get(newUsername, req.user!.userId);
  
  if (existing) {
    return res.status(409).json({ error: 'Username already taken' });
  }

  // Update username
  db.prepare('UPDATE users SET username = ?, last_username_change = ? WHERE id = ?')
    .run(newUsername, now, req.user!.userId);

  const updatedUser = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user!.userId) as unknown as UserRow;
  res.json({ user: rowToPublicUser(updatedUser) });
});

router.get('/:id', (req, res) => {
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id) as unknown as UserRow | undefined;
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user: rowToPublicUser(user) });
});

export default router;
