import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { getDb } from './db/database';
import { setupSocketHandlers } from './socket/handlers';
import authRoutes from './routes/auth';
import usersRoutes from './routes/users';
import chatsRoutes from './routes/chats';
import filesRoutes from './routes/files';

const PORT = parseInt(process.env.PORT || '3001');

// Configure allowed origins via env var: CORS_ORIGINS=https://my.netlify.app,https://aura.app
// Or "*" to allow everything (dev only).
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

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'aura-server', version: '1.0.0' });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/chats', chatsRoutes);
app.use('/api/files', filesRoutes);

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

setupSocketHandlers(io);

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
