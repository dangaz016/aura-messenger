import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { getDb } from '../db/database';
import { authenticateToken } from '../middleware/auth';

const router = Router();

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

// Send message via Telegram Bot API
async function sendTelegramMessage(chatId: string, text: string) {
  try {
    const response = await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'Markdown',
      }),
    });
    return await response.json();
  } catch (err) {
    console.error('Telegram sendMessage error:', err);
    return null;
  }
}

// POST /api/telegram/request-verification — generate verification code (authenticated)
router.post('/request-verification', authenticateToken, (req, res) => {
  const db = getDb();
  const userId = req.user!.userId;

  // Generate 6-digit code
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const verificationId = uuidv4();
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + 15 * 60; // 15 minutes

  db.prepare(`
    INSERT INTO telegram_verifications (id, user_id, code, created_at, expires_at, used)
    VALUES (?, ?, ?, ?, ?, 0)
  `).run(verificationId, userId, code, now, expiresAt);

  res.json({
    code,
    botUsername: 'AuraAuthBotBot',
    deepLink: `https://t.me/AuraAuthBotBot?start=${code}`,
  });
});

// GET /api/telegram/status — check if Telegram is linked (authenticated)
router.get('/status', authenticateToken, (req, res) => {
  const db = getDb();
  const userId = req.user!.userId;

  const user = db.prepare('SELECT telegram_id, telegram_username FROM users WHERE id = ?')
    .get(userId) as unknown as { telegram_id: string | null; telegram_username: string | null } | undefined;

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.json({
    linked: !!user.telegram_id,
    telegramUsername: user.telegram_username,
  });
});

// POST /api/telegram/unlink — unlink Telegram account (authenticated)
router.post('/unlink', authenticateToken, (req, res) => {
  const db = getDb();
  const userId = req.user!.userId;

  db.prepare('UPDATE users SET telegram_id = NULL, telegram_username = NULL WHERE id = ?')
    .run(userId);

  res.json({ success: true });
});

// POST /api/telegram/webhook — handle incoming Telegram updates
router.post('/webhook', async (req, res) => {
  const update = req.body;
  console.log('[Telegram Webhook]', JSON.stringify(update));

  // Acknowledge immediately
  res.sendStatus(200);

  if (!update.message || !update.message.text) return;

  const message = update.message;
  const chatId = message.chat.id.toString();
  const text = message.text.trim();
  const username = message.from.username || null;
  const telegramUserId = message.from.id.toString();

  const db = getDb();

  // Handle /start or /start CODE
  if (text.startsWith('/start')) {
    const parts = text.split(' ');
    const code = parts[1];

    if (!code) {
      await sendTelegramMessage(chatId, 
        `👋 *Добро пожаловать в Aura Auth Bot!*\n\n` +
        `Для привязки аккаунта:\n` +
        `1️⃣ Открой Aura Messenger\n` +
        `2️⃣ Перейди в Настройки → Telegram\n` +
        `3️⃣ Получи код верификации\n` +
        `4️⃣ Отправь мне этот код`
      );
      return;
    }

    // Find verification by code
    const verification = db.prepare(`
      SELECT * FROM telegram_verifications
      WHERE code = ? AND used = 0 AND expires_at > unixepoch()
      ORDER BY created_at DESC
      LIMIT 1
    `).get(code) as unknown as {
      id: string;
      user_id: string;
      code: string;
      used: number;
    } | undefined;

    if (!verification) {
      await sendTelegramMessage(chatId, 
        `❌ *Код неверный или истёк*\n\n` +
        `Получи новый код в приложении Aura.`
      );
      return;
    }

    // Mark as used
    db.prepare('UPDATE telegram_verifications SET used = 1, telegram_chat_id = ? WHERE id = ?')
      .run(chatId, verification.id);

    // Link account
    db.prepare('UPDATE users SET telegram_id = ?, telegram_username = ? WHERE id = ?')
      .run(telegramUserId, username, verification.user_id);

    await sendTelegramMessage(chatId, 
      `✅ *Аккаунт успешно привязан!*\n\n` +
      `Теперь ты будешь получать уведомления от Aura через этот бот.`
    );
    return;
  }

  // Handle raw code (6 digits)
  if (/^\d{6}$/.test(text)) {
    const code = text;

    const verification = db.prepare(`
      SELECT * FROM telegram_verifications
      WHERE code = ? AND used = 0 AND expires_at > unixepoch()
      ORDER BY created_at DESC
      LIMIT 1
    `).get(code) as unknown as {
      id: string;
      user_id: string;
      code: string;
      used: number;
    } | undefined;

    if (!verification) {
      await sendTelegramMessage(chatId, 
        `❌ *Код неверный или истёк*\n\n` +
        `Получи новый код в приложении Aura.`
      );
      return;
    }

    // Mark as used
    db.prepare('UPDATE telegram_verifications SET used = 1, telegram_chat_id = ? WHERE id = ?')
      .run(chatId, verification.id);

    // Link account
    db.prepare('UPDATE users SET telegram_id = ?, telegram_username = ? WHERE id = ?')
      .run(telegramUserId, username, verification.user_id);

    await sendTelegramMessage(chatId, 
      `✅ *Аккаунт успешно привязан!*\n\n` +
      `Теперь ты будешь получать уведомления от Aura через этот бот.`
    );
    return;
  }

  // Unknown command
  await sendTelegramMessage(chatId, 
    `❓ *Не понял команду*\n\n` +
    `Отправь мне 6-значный код из приложения Aura или используй /start`
  );
});

export default router;
