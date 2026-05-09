import express, { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/database';
import { authenticateToken } from '../middleware/auth';
import { uploadLimiter } from '../middleware/security';

const router = Router();

// ── Dangerous file type blocklist ─────────────────────────────────────────────
const BLOCKED_EXTENSIONS = new Set([
  '.exe', '.bat', '.cmd', '.com', '.pif', '.scr', '.msi', '.msp',
  '.sh', '.bash', '.zsh', '.ps1', '.psm1', '.psd1', '.vbs', '.vbe',
  '.js', '.jse', '.wsf', '.wsh', '.php', '.php3', '.php4', '.php5', '.phtml',
  '.py', '.pyc', '.pyo', '.rb', '.pl', '.perl', '.lua',
  '.apk', '.ipa', '.deb', '.rpm', '.pkg', '.dmg',
  '.jar', '.war', '.ear', '.class',
  '.htaccess', '.htpasswd', '.env',
]);

const UPLOAD_DIR = path.join(__dirname, '../../uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, _file, cb) => {
    // Store with UUID only — no original extension exposed on disk
    cb(null, uuidv4());
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (BLOCKED_EXTENSIONS.has(ext)) {
      return cb(new Error(`File type '${ext}' is not allowed`));
    }
    // Block if original name contains path traversal
    if (file.originalname.includes('..') || file.originalname.includes('/') || file.originalname.includes('\\')) {
      return cb(new Error('Invalid filename'));
    }
    cb(null, true);
  },
});

// Multer error handler
function handleUpload(req: express.Request, res: express.Response, next: express.NextFunction) {
  upload.single('file')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'File too large (max 50 MB)' });
      return res.status(400).json({ error: err.message });
    }
    if (err) return res.status(400).json({ error: err.message || 'Upload error' });
    next();
  });
}

router.post('/upload', authenticateToken, uploadLimiter, handleUpload, (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const fileId = uuidv4();
  const db = getDb();

  // Sanitize original name
  const safeName = path.basename(req.file.originalname).slice(0, 255);

  db.prepare(`
    INSERT INTO files (id, uploader_id, filename, original_name, mime_type, size, created_at)
    VALUES (?, ?, ?, ?, ?, ?, unixepoch())
  `).run(
    fileId,
    req.user!.userId,
    req.file.filename,
    safeName,
    req.file.mimetype,
    req.file.size
  );

  res.json({
    file: {
      id: fileId,
      url: `/api/files/${fileId}`,
      originalName: safeName,
      mimeType: req.file.mimetype,
      size: req.file.size,
    },
  });
});

router.get('/:id', (req, res) => {
  // Validate that the ID is a UUID-format string to prevent injection
  if (!/^[0-9a-f-]{36}$/.test(req.params.id)) {
    return res.status(400).json({ error: 'Invalid file ID' });
  }

  const db = getDb();
  const file = db.prepare('SELECT * FROM files WHERE id = ?').get(req.params.id) as unknown as
    | { filename: string; original_name: string; mime_type: string }
    | undefined;
  if (!file) return res.status(404).json({ error: 'File not found' });

  // Prevent path traversal: resolve and verify it's inside UPLOAD_DIR
  const filePath = path.resolve(UPLOAD_DIR, file.filename);
  if (!filePath.startsWith(path.resolve(UPLOAD_DIR))) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File missing on disk' });

  // Force safe content-type for non-media files
  const safeMime = file.mime_type || 'application/octet-stream';
  res.setHeader('Content-Type', safeMime);
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(file.original_name)}"`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  fs.createReadStream(filePath).pipe(res);
});

export default router;
