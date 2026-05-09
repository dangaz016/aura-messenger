import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

function resolveDataDir(): string {
  const candidates = [
    process.env.DATA_DIR,
    path.join(__dirname, '../../data'),
    path.join(__dirname, '../data'),
    path.join(process.cwd(), 'data'),
    '/tmp/aura-data',
  ].filter(Boolean) as string[];

  for (const dir of candidates) {
    try {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      // Test write access
      const testFile = path.join(dir, '.write_test');
      fs.writeFileSync(testFile, '1');
      fs.unlinkSync(testFile);
      return dir;
    } catch {
      // try next
    }
  }
  throw new Error('Cannot find a writable data directory');
}

const DATA_DIR = resolveDataDir();
const DB_PATH = path.join(DATA_DIR, 'aura.db');

let dbInstance: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!dbInstance) {
    dbInstance = new Database(DB_PATH);
    dbInstance.exec('PRAGMA journal_mode = WAL');
    dbInstance.exec('PRAGMA foreign_keys = ON');
    initializeSchema(dbInstance);
  }
  return dbInstance;
}

function initializeSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      email TEXT,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      avatar_color TEXT DEFAULT '#7C3AED',
      public_key TEXT,
      mood_emoji TEXT DEFAULT '👋',
      mood_text TEXT DEFAULT 'Available',
      aura_mode TEXT DEFAULT 'available',
      created_at INTEGER DEFAULT (unixepoch()),
      last_seen INTEGER DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS chats (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      name TEXT,
      description TEXT,
      avatar_color TEXT DEFAULT '#7C3AED',
      created_by TEXT REFERENCES users(id),
      created_at INTEGER DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS chat_members (
      chat_id TEXT REFERENCES chats(id) ON DELETE CASCADE,
      user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      role TEXT DEFAULT 'member',
      joined_at INTEGER DEFAULT (unixepoch()),
      last_read_at INTEGER DEFAULT 0,
      PRIMARY KEY (chat_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      chat_id TEXT REFERENCES chats(id) ON DELETE CASCADE,
      sender_id TEXT REFERENCES users(id),
      content TEXT NOT NULL,
      type TEXT DEFAULT 'text',
      file_id TEXT,
      echo_duration INTEGER,
      echo_expires_at INTEGER,
      is_deleted INTEGER DEFAULT 0,
      created_at INTEGER DEFAULT (unixepoch()),
      edited_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS reactions (
      message_id TEXT REFERENCES messages(id) ON DELETE CASCADE,
      user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      emoji TEXT NOT NULL,
      PRIMARY KEY (message_id, user_id, emoji)
    );

    CREATE TABLE IF NOT EXISTS files (
      id TEXT PRIMARY KEY,
      uploader_id TEXT REFERENCES users(id),
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      mime_type TEXT,
      size INTEGER,
      created_at INTEGER DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS stories (
      id TEXT PRIMARY KEY,
      author_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      content TEXT,
      file_id TEXT,
      bg_color TEXT,
      created_at INTEGER DEFAULT (unixepoch()),
      expires_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS story_views (
      story_id TEXT REFERENCES stories(id) ON DELETE CASCADE,
      viewer_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      viewed_at INTEGER DEFAULT (unixepoch()),
      PRIMARY KEY (story_id, viewer_id)
    );

    CREATE TABLE IF NOT EXISTS story_reactions (
      story_id TEXT REFERENCES stories(id) ON DELETE CASCADE,
      user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      emoji TEXT NOT NULL,
      created_at INTEGER DEFAULT (unixepoch()),
      PRIMARY KEY (story_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS message_reads (
      message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      read_at INTEGER NOT NULL DEFAULT (unixepoch()),
      PRIMARY KEY (message_id, user_id)
    );

    CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);
    CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
    CREATE INDEX IF NOT EXISTS idx_chat_members_user_id ON chat_members(user_id);
    CREATE INDEX IF NOT EXISTS idx_stories_author ON stories(author_id);
    CREATE INDEX IF NOT EXISTS idx_stories_expires ON stories(expires_at);
    CREATE INDEX IF NOT EXISTS idx_message_reads ON message_reads(message_id);
  `);

  // Channels and new features tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS story_comments (
      id TEXT PRIMARY KEY,
      story_id TEXT REFERENCES stories(id) ON DELETE CASCADE,
      user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      created_at INTEGER DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      reporter_id TEXT REFERENCES users(id),
      target_user_id TEXT REFERENCES users(id),
      target_message_id TEXT,
      reason TEXT NOT NULL,
      created_at INTEGER DEFAULT (unixepoch()),
      resolved INTEGER DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_story_comments_story ON story_comments(story_id);
  `);

  // Migrations: users table
  try { db.exec("ALTER TABLE users ADD COLUMN google_id TEXT"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE users ADD COLUMN avatar_url TEXT"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE users ADD COLUMN last_username_change INTEGER DEFAULT 0"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE users ADD COLUMN is_banned INTEGER DEFAULT 0"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE users ADD COLUMN is_frozen INTEGER DEFAULT 0"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE users ADD COLUMN ban_reason TEXT"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE users ADD COLUMN bio TEXT DEFAULT ''"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE users ADD COLUMN phone TEXT"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE users ADD COLUMN birthday TEXT"); } catch { /* already exists */ }
  // Migrations: chats table (channels)
  try { db.exec("ALTER TABLE chats ADD COLUMN is_public INTEGER DEFAULT 1"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE chats ADD COLUMN invite_link TEXT"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE chats ADD COLUMN channel_username TEXT"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE chats ADD COLUMN subscriber_count INTEGER DEFAULT 0"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE chats ADD COLUMN post_permissions TEXT DEFAULT 'admins'"); } catch { /* already exists */ }
  try {
    db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id) WHERE google_id IS NOT NULL");
  } catch { /* ignore */ }
  try {
    db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_chats_channel_username ON chats(channel_username) WHERE channel_username IS NOT NULL");
  } catch { /* ignore */ }
  // Migrations: messages table
  try { db.exec("ALTER TABLE messages ADD COLUMN reply_to_id TEXT REFERENCES messages(id)"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE messages ADD COLUMN forwarded_from_id TEXT"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE messages ADD COLUMN forwarded_from_name TEXT"); } catch { /* already exists */ }
  // Migrations: chats table (pinned message)
  try { db.exec("ALTER TABLE chats ADD COLUMN pinned_message_id TEXT REFERENCES messages(id)"); } catch { /* already exists */ }
}

export function closeDb() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

// Log the resolved data directory for debugging
console.log(`[DB] Data directory: ${DATA_DIR}`);
console.log(`[DB] Database path: ${DB_PATH}`);
