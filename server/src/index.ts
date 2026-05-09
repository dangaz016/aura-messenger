import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import http from 'http';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { Server as SocketIOServer } from 'socket.io';
import { getDb } from './db/database';
import { globalLimiter, helmetOptions, aiLimiter } from './middleware/security';
import { setupSocketHandlers } from './socket/handlers';
import authRoutes from './routes/auth';
import usersRoutes from './routes/users';
import chatsRoutes from './routes/chats';
import filesRoutes from './routes/files';
import storiesRoutes, { startStoryCleanup } from './routes/stories';
import aiRoutes from './routes/ai';
import adminRoutes, { reportRouter } from './routes/admin';

// ── Auto-create first admin from env vars ────────────────────────────────────
async function initAdminIfNeeded() {
  const adminUser = process.env.ADMIN_INIT_USER;
  const adminPass = process.env.ADMIN_INIT_PASS;
  if (!adminUser || !adminPass) return;
  try {
    const db = getDb();
    // If user exists, just make admin
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(adminUser) as { id: string } | undefined;
    if (existing) {
      db.prepare('UPDATE users SET is_admin = 1 WHERE username = ?').run(adminUser);
      console.log(`[admin] Granted admin to existing user: ${adminUser}`);
      return;
    }
    // No admin at all and ADMIN_INIT_USER is set → create new admin user
    const hasAdmin = db.prepare('SELECT id FROM users WHERE is_admin = 1').get();
    if (hasAdmin && !existing) {
      console.log(`[admin] Admin already exists, skipping ADMIN_INIT_USER`);
      return;
    }
    const hash = await bcrypt.hash(adminPass, 10);
    const now = Math.floor(Date.now() / 1000);
    const userId = uuidv4();
    db.prepare(`
      INSERT INTO users (id, username, password_hash, display_name, avatar_color, is_admin, mood_emoji, mood_text, created_at, last_seen)
      VALUES (?, ?, ?, ?, '#7C3AED', 1, '🛡️', 'Admin', ?, ?)
    `).run(userId, adminUser, hash, adminUser, now, now);
    console.log(`[admin] Created admin user: ${adminUser}`);
  } catch (err) {
    console.error('[admin] Failed to init admin:', err);
  }
}

// Load .env if present (local dev)
try {
  const envPath = path.join(__dirname, '../../.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq < 0) continue;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  }
} catch { /* ignore */ }

const PORT = parseInt(process.env.PORT || '3001');

// Configure allowed origins via env var: CORS_ORIGINS=https://my.app
// Use "*" for dev or when serving the client from the same server (same-origin).
const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || '*')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const corsOrigin = ALLOWED_ORIGINS.includes('*') ? '*' : ALLOWED_ORIGINS;

const app = express();
const server = http.createServer(app);

const io = new SocketIOServer(server, {
  cors: {
    origin: corsOrigin,
    methods: ['GET', 'POST'],
  },
});

app.set('trust proxy', 1); // trust first proxy (needed for correct IP behind Render/nginx)
app.use(helmet(helmetOptions));
app.use(cors({ origin: corsOrigin }));
app.use(express.json({ limit: '2mb' })); // 2MB max JSON body (was 10MB — no need for bigger)
app.use(globalLimiter);

getDb();

// API routes
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'aura-server', version: '1.0.0' });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/chats', chatsRoutes);
app.use('/api/files', filesRoutes);
app.use('/api/stories', storiesRoutes);
app.use('/api/ai', aiLimiter, aiRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/report', reportRouter);

// Serve client SPA in production. The client is built into ../client/dist
// (from compiled server/dist, that's ../../client/dist).
const CLIENT_DIST_CANDIDATES = [
  path.join(__dirname, '../../client/dist'),
  path.join(__dirname, '../client/dist'),
];
const CLIENT_DIST = CLIENT_DIST_CANDIDATES.find(p => fs.existsSync(p));

if (CLIENT_DIST) {
  console.log(`[server] Serving client from ${CLIENT_DIST}`);
  app.use(express.static(CLIENT_DIST));

  // SPA fallback: any GET that's not an API or socket.io route → index.html
  app.use((req, res, next) => {
    if (req.method !== 'GET') return next();
    if (req.path.startsWith('/api/') || req.path.startsWith('/socket.io/')) return next();
    res.sendFile(path.join(CLIENT_DIST, 'index.html'));
  });
} else {
  console.log('[server] Client build not found — running API-only mode');
}

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

setupSocketHandlers(io);
startStoryCleanup();
initAdminIfNeeded();

server.listen(PORT, () => {
  console.log(`
  ╔═══════════════════════════════════════╗
  ║                                       ║
  ║         AURA Messenger Server         ║
  ║                                       ║
  ║   Running on http://localhost:${PORT}   ║
  ║   WebSocket: ws://localhost:${PORT}     ║
  ║                                       ║
  ║   Privacy first. Always.              ║
  ║                                       ║
  ╚═══════════════════════════════════════╝
  `);
});
