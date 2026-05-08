import express from 'express';
import cors from 'cors';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { Server as SocketIOServer } from 'socket.io';
import { getDb } from './db/database';
import { setupSocketHandlers } from './socket/handlers';
import authRoutes from './routes/auth';
import usersRoutes from './routes/users';
import chatsRoutes from './routes/chats';
import filesRoutes from './routes/files';
import storiesRoutes, { startStoryCleanup } from './routes/stories';
import aiRoutes from './routes/ai';

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

app.use(cors({ origin: corsOrigin }));
app.use(express.json({ limit: '10mb' }));

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
app.use('/api/ai', aiRoutes);

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
