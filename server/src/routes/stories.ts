import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/database';
import { authenticateToken } from '../middleware/auth';
import { StoryRow, StoryType, UserRow, rowToPublicUser } from '../types';

const router = Router();

router.use(authenticateToken);

const STORY_DURATION = 24 * 60 * 60; // 24 hours in seconds

const STORY_BG_COLORS = [
  'linear-gradient(135deg, #7C3AED 0%, #EC4899 100%)',
  'linear-gradient(135deg, #3B82F6 0%, #06B6D4 100%)',
  'linear-gradient(135deg, #F59E0B 0%, #EF4444 100%)',
  'linear-gradient(135deg, #10B981 0%, #06B6D4 100%)',
  'linear-gradient(135deg, #8B5CF6 0%, #3B82F6 100%)',
  'linear-gradient(135deg, #EC4899 0%, #F472B6 100%)',
];

function getContactIds(userId: string): string[] {
  const db = getDb();
  // Users in any direct chat with me
  const rows = db.prepare(`
    SELECT DISTINCT cm2.user_id FROM chat_members cm1
    JOIN chats c ON c.id = cm1.chat_id
    JOIN chat_members cm2 ON cm2.chat_id = cm1.chat_id
    WHERE cm1.user_id = ? AND cm2.user_id != ? AND c.type = 'direct'
  `).all(userId, userId) as unknown as { user_id: string }[];
  return rows.map(r => r.user_id);
}

// POST /api/stories - create a new story
router.post('/', (req, res) => {
  const { type, content, fileId, bgColor } = req.body as {
    type: StoryType;
    content?: string;
    fileId?: string;
    bgColor?: string;
  };

  if (!type || !['text', 'image', 'video'].includes(type)) {
    return res.status(400).json({ error: 'Invalid story type' });
  }
  if (type === 'text' && (!content || content.trim().length === 0)) {
    return res.status(400).json({ error: 'Text story requires content' });
  }
  if ((type === 'image' || type === 'video') && !fileId) {
    return res.status(400).json({ error: 'Media story requires fileId' });
  }

  const db = getDb();
  const id = uuidv4();
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + STORY_DURATION;
  const finalBg = bgColor || STORY_BG_COLORS[Math.floor(Math.random() * STORY_BG_COLORS.length)];

  db.prepare(`
    INSERT INTO stories (id, author_id, type, content, file_id, bg_color, created_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    req.user!.userId,
    type,
    content ?? null,
    fileId ?? null,
    finalBg,
    now,
    expiresAt
  );

  const story = db.prepare('SELECT * FROM stories WHERE id = ?').get(id) as unknown as StoryRow;
  res.json({ story: storyToPublic(story, false, 0) });
});

// GET /api/stories - get story feed (own + contacts')
router.get('/', (req, res) => {
  const db = getDb();
  const userId = req.user!.userId;
  const now = Math.floor(Date.now() / 1000);

  const contactIds = getContactIds(userId);
  const allowedIds = [userId, ...contactIds];
  if (allowedIds.length === 0) return res.json({ feed: [] });

  const placeholders = allowedIds.map(() => '?').join(',');
  const stories = db.prepare(`
    SELECT s.*, u.username, u.display_name, u.avatar_color, u.avatar_url
    FROM stories s
    JOIN users u ON u.id = s.author_id
    WHERE s.author_id IN (${placeholders}) AND s.expires_at > ?
    ORDER BY s.created_at DESC
  `).all(...allowedIds, now) as unknown as (StoryRow & {
    username: string;
    display_name: string;
    avatar_color: string;
    avatar_url: string | null;
  })[];

  // Group by author
  const groupedMap = new Map<string, {
    user: { id: string; username: string; displayName: string; avatarColor: string; avatarUrl: string | null };
    stories: ReturnType<typeof storyToPublic>[];
    hasUnviewed: boolean;
  }>();

  // Get all viewed story IDs
  const viewed = stories.length > 0
    ? db.prepare(`
        SELECT story_id FROM story_views
        WHERE viewer_id = ? AND story_id IN (${stories.map(() => '?').join(',')})
      `).all(userId, ...stories.map(s => s.id)) as unknown as { story_id: string }[]
    : [];
  const viewedSet = new Set(viewed.map(v => v.story_id));

  for (const s of stories) {
    if (!groupedMap.has(s.author_id)) {
      groupedMap.set(s.author_id, {
        user: {
          id: s.author_id,
          username: s.username,
          displayName: s.display_name,
          avatarColor: s.avatar_color,
          avatarUrl: s.avatar_url,
        },
        stories: [],
        hasUnviewed: false,
      });
    }
    const isViewed = viewedSet.has(s.id);
    const group = groupedMap.get(s.author_id)!;
    group.stories.push(storyToPublic(s, isViewed, 0));
    if (!isViewed) group.hasUnviewed = true;
  }

  // Sort: own first, then unviewed first, then by latest story
  const feed = Array.from(groupedMap.values()).sort((a, b) => {
    if (a.user.id === userId && b.user.id !== userId) return -1;
    if (b.user.id === userId && a.user.id !== userId) return 1;
    if (a.hasUnviewed && !b.hasUnviewed) return -1;
    if (b.hasUnviewed && !a.hasUnviewed) return 1;
    return (b.stories[0]?.createdAt ?? 0) - (a.stories[0]?.createdAt ?? 0);
  });

  // Reverse stories per user so oldest is first (chronological viewing)
  feed.forEach(g => g.stories.reverse());

  res.json({ feed });
});

// POST /api/stories/:id/view - mark as viewed
router.post('/:id/view', (req, res) => {
  const db = getDb();
  const userId = req.user!.userId;
  const storyId = req.params.id;
  const now = Math.floor(Date.now() / 1000);

  const story = db.prepare('SELECT * FROM stories WHERE id = ? AND expires_at > ?')
    .get(storyId, now) as unknown as StoryRow | undefined;
  if (!story) return res.status(404).json({ error: 'Story not found or expired' });

  if (story.author_id !== userId) {
    db.prepare('INSERT OR IGNORE INTO story_views (story_id, viewer_id, viewed_at) VALUES (?, ?, ?)')
      .run(storyId, userId, now);
  }

  res.json({ success: true });
});

// GET /api/stories/:id/viewers - get list of viewers (only for own stories)
router.get('/:id/viewers', (req, res) => {
  const db = getDb();
  const userId = req.user!.userId;
  const storyId = req.params.id;

  const story = db.prepare('SELECT author_id FROM stories WHERE id = ?')
    .get(storyId) as unknown as { author_id: string } | undefined;
  if (!story) return res.status(404).json({ error: 'Story not found' });
  if (story.author_id !== userId) return res.status(403).json({ error: 'Not your story' });

  const viewers = db.prepare(`
    SELECT u.*, sv.viewed_at FROM story_views sv
    JOIN users u ON u.id = sv.viewer_id
    WHERE sv.story_id = ?
    ORDER BY sv.viewed_at DESC
  `).all(storyId) as unknown as (UserRow & { viewed_at: number })[];

  res.json({
    viewers: viewers.map(v => ({ ...rowToPublicUser(v), viewedAt: v.viewed_at })),
  });
});

// DELETE /api/stories/:id - delete own story
router.delete('/:id', (req, res) => {
  const db = getDb();
  const userId = req.user!.userId;

  const story = db.prepare('SELECT author_id FROM stories WHERE id = ?')
    .get(req.params.id) as unknown as { author_id: string } | undefined;
  if (!story) return res.status(404).json({ error: 'Story not found' });
  if (story.author_id !== userId) return res.status(403).json({ error: 'Not your story' });

  db.prepare('DELETE FROM stories WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// POST /api/stories/:id/react - add reaction (emoji)
router.post('/:id/react', (req, res) => {
  const { emoji } = req.body as { emoji: string };
  if (!emoji || emoji.length > 8) return res.status(400).json({ error: 'Invalid emoji' });

  const db = getDb();
  const userId = req.user!.userId;
  const storyId = req.params.id;
  const now = Math.floor(Date.now() / 1000);

  const story = db.prepare('SELECT * FROM stories WHERE id = ? AND expires_at > ?')
    .get(storyId, now) as unknown as StoryRow | undefined;
  if (!story) return res.status(404).json({ error: 'Story not found' });

  db.prepare(`
    INSERT INTO story_reactions (story_id, user_id, emoji, created_at) VALUES (?, ?, ?, ?)
    ON CONFLICT(story_id, user_id) DO UPDATE SET emoji = excluded.emoji, created_at = excluded.created_at
  `).run(storyId, userId, emoji, now);

  res.json({ success: true });
});

function storyToPublic(s: StoryRow, viewed: boolean, viewerCount: number) {
  return {
    id: s.id,
    authorId: s.author_id,
    type: s.type,
    content: s.content,
    fileId: s.file_id,
    bgColor: s.bg_color,
    createdAt: s.created_at,
    expiresAt: s.expires_at,
    viewed,
    viewerCount,
  };
}

// GET /api/stories/:id/comments
router.get('/:id/comments', (req, res) => {
  const db = getDb();
  const rows = db.prepare(`
    SELECT sc.id, sc.content, sc.created_at,
      u.id AS user_id, u.display_name, u.username, u.avatar_color, u.avatar_url
    FROM story_comments sc
    JOIN users u ON u.id = sc.user_id
    WHERE sc.story_id = ?
    ORDER BY sc.created_at ASC
  `).all(req.params.id) as unknown[];
  res.json(rows);
});

// POST /api/stories/:id/comments
router.post('/:id/comments', (req, res) => {
  const db = getDb();
  const { content } = req.body as { content: string };
  if (!content?.trim() || content.length > 500) {
    return res.status(400).json({ error: 'Comment required (max 500 chars)' });
  }
  const story = db.prepare('SELECT id FROM stories WHERE id = ?').get(req.params.id);
  if (!story) return res.status(404).json({ error: 'Story not found' });
  const id = require('crypto').randomUUID();
  db.prepare('INSERT INTO story_comments (id, story_id, user_id, content) VALUES (?,?,?,?)')
    .run(id, req.params.id, req.user!.userId, content.trim());
  const comment = db.prepare(`
    SELECT sc.id, sc.content, sc.created_at,
      u.id AS user_id, u.display_name, u.username, u.avatar_color
    FROM story_comments sc
    JOIN users u ON u.id = sc.user_id
    WHERE sc.id = ?
  `).get(id);
  res.json(comment);
});

// DELETE /api/stories/comments/:commentId
router.delete('/comments/:commentId', (req, res) => {
  const db = getDb();
  const comment = db.prepare('SELECT user_id FROM story_comments WHERE id = ?').get(req.params.commentId) as
    { user_id: string } | undefined;
  if (!comment) return res.status(404).json({ error: 'Comment not found' });
  if (comment.user_id !== req.user!.userId) return res.status(403).json({ error: 'Forbidden' });
  db.prepare('DELETE FROM story_comments WHERE id = ?').run(req.params.commentId);
  res.json({ success: true });
});

// Cleanup job: delete expired stories
export function startStoryCleanup() {
  setInterval(() => {
    try {
      const db = getDb();
      const now = Math.floor(Date.now() / 1000);
      const result = db.prepare('DELETE FROM stories WHERE expires_at <= ?').run(now);
      if ((result.changes ?? 0) > 0) {
        console.log(`[stories] Cleaned up ${result.changes} expired stories`);
      }
    } catch (err) {
      console.error('[stories] Cleanup error:', err);
    }
  }, 5 * 60 * 1000); // every 5 minutes
}

export default router;
