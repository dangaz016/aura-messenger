import { Router } from 'express';
import { getDb } from '../db/database';
import { authenticateToken } from '../middleware/auth';
import { UserRow, rowToPublicUser, rowToFilteredUser, AuraMode, PrivacyLevel } from '../types';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

router.use(authenticateToken);

router.get('/search', (req, res) => {
  const q = (req.query.q as string || '').trim();
  if (q.length < 1) return res.json({ users: [] });
  
  const db = getDb();
  const users = db.prepare(`
    SELECT * FROM users
    WHERE id != ?
      AND (username LIKE ? OR display_name LIKE ? OR phone LIKE ?)
    ORDER BY username
    LIMIT 30
  `).all(req.user!.userId, `%${q}%`, `%${q}%`, `%${q}%`) as unknown as UserRow[];
  
  res.json({ users: users.map((u) => rowToPublicUser(u)) });
});

// GET /api/users/me — own full profile with privacy settings
router.get('/me', (req, res) => {
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user!.userId) as unknown as UserRow | undefined;
  if (!user) return res.status(404).json({ error: 'Not found' });
  res.json({ user: rowToPublicUser(user, true) });
});

router.patch('/profile', (req, res) => {
  const { displayName, moodEmoji, moodText, auraMode, avatarColor, publicKey, avatarUrl, birthday, website, location, socialLinks } = req.body;
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
    const valid = birthday === null || birthday === '' || /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(birthday);
    if (!valid) return res.status(400).json({ error: 'Invalid birthday format' });
    updates.push('birthday = ?');
    values.push(birthday || null);
  }
  if (website !== undefined) { updates.push('website = ?'); values.push(website || null); }
  if (location !== undefined) { updates.push('location = ?'); values.push(location || null); }
  if (socialLinks !== undefined) { updates.push('social_links = ?'); values.push(socialLinks ? JSON.stringify(socialLinks) : null); }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  values.push(req.user!.userId);
  db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values);

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user!.userId) as unknown as UserRow;
  res.json({ user: rowToPublicUser(user, true) });
});

// PATCH /api/users/privacy — update privacy settings
router.patch('/privacy', (req, res) => {
  const VALID_LEVELS: PrivacyLevel[] = ['everyone', 'contacts', 'nobody'];
  const db = getDb();

  const updates: string[] = [];
  const values: (string | number)[] = [];

  const fields: Record<string, string> = {
    lastSeen: 'privacy_last_seen',
    avatar: 'privacy_avatar',
    bio: 'privacy_bio',
    birthday: 'privacy_birthday',
    phone: 'privacy_phone',
    online: 'privacy_online',
    groups: 'privacy_groups',
    website: 'privacy_website',
    location: 'privacy_location',
  };

  const body = req.body as Record<string, unknown>;

  for (const [key, col] of Object.entries(fields)) {
    const val = body[key];
    if (val !== undefined) {
      if (!VALID_LEVELS.includes(val as PrivacyLevel)) {
        return res.status(400).json({ error: `Invalid value for ${key}` });
      }
      updates.push(`${col} = ?`);
      values.push(val as string);
    }
  }

  if (body.readReceipts !== undefined) {
    updates.push('privacy_read_receipts = ?');
    values.push(body.readReceipts ? 1 : 0);
  }
  if (body.forwardFrom !== undefined) {
    updates.push('privacy_forward_from = ?');
    values.push(body.forwardFrom ? 1 : 0);
  }

  if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });

  values.push(req.user!.userId);
  db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values);

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user!.userId) as unknown as UserRow;
  res.json({ user: rowToPublicUser(user, true) });
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

  if (currentUser.username === newUsername) {
    return res.status(400).json({ error: 'New username cannot be the same as current' });
  }

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

  const existing = db.prepare('SELECT id FROM users WHERE username = ? AND id != ?')
    .get(newUsername, req.user!.userId);
  
  if (existing) {
    return res.status(409).json({ error: 'Username already taken' });
  }

  db.prepare('UPDATE users SET username = ?, last_username_change = ? WHERE id = ?')
    .run(newUsername, now, req.user!.userId);

  const updatedUser = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user!.userId) as unknown as UserRow;
  res.json({ user: rowToPublicUser(updatedUser, true) });
});

// GET /api/users/profile/:id — view another user's profile (privacy-filtered)
router.get('/profile/:id', (req, res) => {
  const db = getDb();
  const targetId = req.params.id;
  const viewerId = req.user!.userId;

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(targetId) as unknown as UserRow | undefined;
  if (!user) return res.status(404).json({ error: 'User not found' });

  // If viewing own profile — return full with privacy
  if (targetId === viewerId) {
    return res.json(rowToPublicUser(user, true));
  }

  // Check if viewer is a "contact" (shared direct chat)
  const sharedChat = db.prepare(`
    SELECT 1 FROM chats c
    JOIN chat_members cm1 ON cm1.chat_id = c.id AND cm1.user_id = ?
    JOIN chat_members cm2 ON cm2.chat_id = c.id AND cm2.user_id = ?
    WHERE c.type = 'direct'
    LIMIT 1
  `).get(viewerId, targetId);
  const isContact = !!sharedChat;

  res.json(rowToFilteredUser(user, isContact));
});

// GET /api/users/:id — get user by id (basic, used internally)
router.get('/:id', (req, res) => {
  const db = getDb();
  const targetId = req.params.id;
  const viewerId = req.user!.userId;

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(targetId) as unknown as UserRow | undefined;
  if (!user) return res.status(404).json({ error: 'User not found' });

  if (targetId === viewerId) {
    return res.json({ user: rowToPublicUser(user, true) });
  }

  const sharedChat = db.prepare(`
    SELECT 1 FROM chats c
    JOIN chat_members cm1 ON cm1.chat_id = c.id AND cm1.user_id = ?
    JOIN chat_members cm2 ON cm2.chat_id = c.id AND cm2.user_id = ?
    WHERE c.type = 'direct'
    LIMIT 1
  `).get(viewerId, targetId);
  const isContact = !!sharedChat;

  res.json({ user: rowToFilteredUser(user, isContact) });
});

// POST /api/users/contacts/sync — sync device contacts
router.post('/contacts/sync', (req, res) => {
  const { contacts } = req.body;
  if (!contacts || !Array.isArray(contacts)) {
    return res.status(400).json({ error: 'Contacts array is required' });
  }
  
  const db = getDb();
  const userId = req.user!.userId;
  
  // Process contacts and find matches
  const placeholders = contacts.map(() => '?').join(',');
  const matchedUsers = db.prepare(`
    SELECT id, username, phone, display_name, avatar_url
    FROM users
    WHERE (phone IN (${placeholders}) OR username IN (${placeholders}))
      AND id != ?
  `).all(...contacts, ...contacts, userId) as unknown as UserRow[];
  
  res.json({ users: matchedUsers.map((u) => rowToPublicUser(u)) });
});

// POST /api/users/invites — generate invite link
router.post('/invites', (req, res) => {
  const userId = req.user!.userId;
  const inviteCode = uuidv4();
  
  const db = getDb();
  db.prepare(`
    INSERT INTO invites (id, created_by, created_at)
    VALUES (?, ?, ?)
  `).run(inviteCode, userId, Math.floor(Date.now() / 1000));
  
  const inviteLink = `${process.env.PUBLIC_URL}/invite/${inviteCode}`;
  res.json({ inviteLink });
});

// GET /api/users/invites — get user's invites
router.get('/invites', (req, res) => {
  const userId = req.user!.userId;
  const db = getDb();
  
  const invites = db.prepare(`
    SELECT id, created_at
    FROM invites
    WHERE created_by = ?
    ORDER BY created_at DESC
  `).all(userId);
  
  res.json({ invites });
});

export default router;
