import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { backupDatabase, restoreFromBackup, backupMediaFiles } from './backup';
import { restoreFromCloud } from '../services/storage';

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
const BACKUP_DIR = path.join(DATA_DIR, 'backups');

let dbInstance: Database.Database | null = null;
let backupInterval: NodeJS.Timeout;

// Создать директорию для резервных копий
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// Создать директорию для медиафайлов
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

export function getDb(): Database.Database {
  if (!dbInstance) {
    initializeDatabase();
  }
  if (!dbInstance) {
    throw new Error('Failed to initialize database');
  }
  return dbInstance;
}

async function initializeDatabase() {
  // Проверка целостности базы
  if (fs.existsSync(DB_PATH)) {
    try {
      // Попробовать открыть существующую базу
      const db = new Database(DB_PATH);
      db.pragma('integrity_check');
      db.close();
    } catch (err) {
      console.error('[DB] Database integrity check failed:', err);
      // Попробовать восстановить из облачной резервной копии
      try {
        const backups = fs.readdirSync(BACKUP_DIR)
          .filter(f => f.startsWith('aura-backup-') && f.endsWith('.db.gz'))
          .sort()
          .reverse();
        
        if (backups.length > 0) {
          const latestBackup = backups[0];
          const timestamp = latestBackup.replace('aura-backup-', '').replace('.db.gz', '');
          await restoreFromCloud(DB_PATH, timestamp);
        } else {
          throw new Error('No cloud backups available for restoration');
        }
      } catch (cloudRestoreErr) {
        console.error('[DB] Cloud restore failed:', cloudRestoreErr);
        // Попробовать восстановить из локальной резервной копии
        try {
          await restoreFromBackup(DB_PATH, BACKUP_DIR);
        } catch (localRestoreErr) {
          console.error('[DB] Local backup restore failed:', localRestoreErr);
          throw new Error('Database corrupted and all restore attempts failed');
        }
      }
    }
  }
  
  // Инициализировать базу
  dbInstance = new Database(DB_PATH);
  dbInstance.exec('PRAGMA journal_mode = WAL');
  dbInstance.exec('PRAGMA synchronous = NORMAL');
  dbInstance.exec('PRAGMA foreign_keys = ON');
  dbInstance.exec('PRAGMA wal_autocheckpoint = 1000'); // Чекпоинт каждые 1000 страниц
  dbInstance.exec('PRAGMA wal_checkpoint(TRUNCATE)');
  
  // Инициализировать схему
  initializeSchema(dbInstance);
  
  // Начать регулярное резервное копирование
  startBackupProcess(DB_PATH, BACKUP_DIR);
  
  // Начать регулярное резервное копирование медиафайлов
  startMediaBackupProcess(UPLOAD_DIR, BACKUP_DIR);
  
  // Обработчики для graceful shutdown
  process.on('SIGINT', () => shutdownDatabase());
  process.on('SIGTERM', () => shutdownDatabase());
}

function startBackupProcess(dbPath: string, backupDir: string) {
  // Первое резервное копирование сразу
  backupDatabase(dbPath, backupDir).catch((err: any) => {
    console.error('[DB] Initial backup failed:', err);
  });
  
  // Регулярное резервное копирование
  backupInterval = setInterval(() => {
    backupDatabase(dbPath, backupDir).catch((err: any) => {
      console.error('[DB] Scheduled backup failed:', err);
    });
  }, 60 * 60 * 1000); // Каждый час
}

function startMediaBackupProcess(uploadDir: string, backupDir: string) {
  // Первое резервное копирование медиафайлов сразу
  backupMediaFiles(uploadDir, backupDir).catch((err: any) => {
    console.error('[Media] Initial backup failed:', err);
  });
  
  // Регулярное резервное копирование медиафайлов
  const mediaBackupInterval = setInterval(() => {
    backupMediaFiles(uploadDir, backupDir).catch((err: any) => {
      console.error('[Media] Scheduled backup failed:', err);
    });
  }, 24 * 60 * 60 * 1000); // Каждые 24 часа
}

function shutdownDatabase() {
  if (dbInstance) {
    console.log('[DB] Shutting down gracefully...');
    
    // Принудительный чекпоинт WAL
    try {
      dbInstance.pragma('wal_checkpoint(TRUNCATE)');
    } catch (err: any) {
      console.error('[DB] WAL checkpoint failed during shutdown:', err);
    }
    
    // Окончательное резервное копирование
    Promise.all([
      backupDatabase(DB_PATH, BACKUP_DIR),
      backupMediaFiles(UPLOAD_DIR, BACKUP_DIR)
    ])
      .then(() => {
        dbInstance?.close();
        console.log('[DB] Database closed and final backups created');
        process.exit(0);
      })
      .catch((err: any) => {
        console.error('[DB] Final backup failed:', err);
        dbInstance?.close();
        process.exit(1);
      });
    
    if (backupInterval) clearInterval(backupInterval);
  }
}

export function closeDb() {
  if (dbInstance) {
    try {
      dbInstance.exec('PRAGMA wal_checkpoint(TRUNCATE)');
    } catch (err) {
      console.error('[DB] WAL checkpoint failed:', err);
    }
    dbInstance.close();
    dbInstance = null;
    if (backupInterval) clearInterval(backupInterval);
  }
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

  // Invites table
  db.exec(`
    CREATE TABLE IF NOT EXISTS invites (
      id TEXT PRIMARY KEY,
      created_by TEXT NOT NULL REFERENCES users(id),
      created_at INTEGER DEFAULT (unixepoch())
    );
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
  try { db.exec("ALTER TABLE users ADD COLUMN freeze_reason TEXT"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE users ADD COLUMN freeze_until INTEGER DEFAULT 0"); } catch { /* already exists */ }
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
  // Migrations: Telegram auth
  try { db.exec("ALTER TABLE users ADD COLUMN telegram_id TEXT"); } catch { /* already exists */ }
  try { db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id) WHERE telegram_id IS NOT NULL"); } catch { /* ignore */ }
  // Migrations: Aura Prime
  try { db.exec("ALTER TABLE users ADD COLUMN is_prime INTEGER DEFAULT 0"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE users ADD COLUMN prime_expires_at INTEGER DEFAULT 0"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE users ADD COLUMN prime_theme TEXT DEFAULT 'default'"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE users ADD COLUMN prime_badge TEXT DEFAULT 'crown'"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE users ADD COLUMN prime_animated_avatar INTEGER DEFAULT 0"); } catch { /* already exists */ }
  // Migrations: Privacy settings (visibility: 'everyone' | 'contacts' | 'nobody')
  try { db.exec("ALTER TABLE users ADD COLUMN privacy_last_seen TEXT DEFAULT 'everyone'"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE users ADD COLUMN privacy_avatar TEXT DEFAULT 'everyone'"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE users ADD COLUMN privacy_bio TEXT DEFAULT 'everyone'"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE users ADD COLUMN privacy_birthday TEXT DEFAULT 'contacts'"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE users ADD COLUMN privacy_phone TEXT DEFAULT 'nobody'"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE users ADD COLUMN privacy_online TEXT DEFAULT 'everyone'"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE users ADD COLUMN privacy_read_receipts INTEGER DEFAULT 1"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE users ADD COLUMN privacy_forward_from INTEGER DEFAULT 1"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE users ADD COLUMN privacy_groups TEXT DEFAULT 'everyone'"); } catch { /* already exists */ }
  // Migrations: reports — add type and category fields
  try { db.exec("ALTER TABLE reports ADD COLUMN type TEXT DEFAULT 'user'"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE reports ADD COLUMN category TEXT DEFAULT 'other'"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE reports ADD COLUMN resolved_by TEXT REFERENCES users(id)"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE reports ADD COLUMN resolved_at INTEGER"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE reports ADD COLUMN admin_note TEXT"); } catch { /* already exists */ }
  // Migrations: group/channel extra settings
  try { db.exec("ALTER TABLE chats ADD COLUMN slow_mode INTEGER DEFAULT 0"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE chats ADD COLUMN join_approval INTEGER DEFAULT 0"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE chats ADD COLUMN reactions_enabled INTEGER DEFAULT 1"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE chats ADD COLUMN history_visible INTEGER DEFAULT 1"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE chats ADD COLUMN media_enabled INTEGER DEFAULT 1"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE chats ADD COLUMN links_enabled INTEGER DEFAULT 1"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE chats ADD COLUMN sign_messages INTEGER DEFAULT 0"); } catch { /* already exists */ }
  try { db.exec("ALTER TABLE chats ADD COLUMN max_members INTEGER DEFAULT 0"); } catch { /* already exists */ }
  // join requests table for groups with join_approval=1
  db.exec(`
    CREATE TABLE IF NOT EXISTS join_requests (
      id TEXT PRIMARY KEY,
      chat_id TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      message TEXT,
      created_at INTEGER DEFAULT (unixepoch()),
      status TEXT DEFAULT 'pending',
      UNIQUE(chat_id, user_id)
    )
  `);
  // Telegram verification
  try { db.exec("ALTER TABLE users ADD COLUMN telegram_username TEXT"); } catch { /* already exists */ }
  db.exec(`
    CREATE TABLE IF NOT EXISTS telegram_verifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      code TEXT NOT NULL UNIQUE,
      telegram_chat_id TEXT,
      created_at INTEGER DEFAULT (unixepoch()),
      expires_at INTEGER NOT NULL,
      used INTEGER DEFAULT 0
    )
  `);
}


// Log the resolved data directory for debugging
console.log(`[DB] Data directory: ${DATA_DIR}`);
console.log(`[DB] Database path: ${DB_PATH}`);
