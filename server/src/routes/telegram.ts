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

// POST /api/telegram/send-invite — send invite via Telegram
router.post('/send-invite', authenticateToken, async (req, res) => {
  const { phoneOrUsername, message } = req.body;
  if (!phoneOrUsername) {
    return res.status(400).json({ error: 'phoneOrUsername is required' });
  }
 
  const db = getDb();
  const userId = req.user!.userId;
  const user = db.prepare('SELECT display_name FROM users WHERE id = ?')
    .get(userId) as { display_name: string } | undefined;
 
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
 
  const inviteMessage = message || `
👋 Привет! Меня зовут ${user.display_name}. Присоединяйся ко мне в Aura Messenger — приватном и быстром мессенджере!

📱 Скачай Aura: ${process.env.PUBLIC_URL}
🔗 Или открой в браузере: ${process.env.PUBLIC_URL}

Поговорим в Aura! 💬
`;
 
  try {
    const response = await sendTelegramMessage(phoneOrUsername, inviteMessage);
    if (response) {
      res.json({ success: true });
    } else {
      res.status(500).json({ error: 'Failed to send invite via Telegram' });
    }
  } catch (err) {
    console.error('Failed to send Telegram invite:', err);
    res.status(500).json({ error: 'Failed to send invite' });
  }
});

// GET /api/telegram/get-chats — get Telegram chats
router.get('/get-chats', authenticateToken, async (req, res) => {
  try {
    const response = await fetch(`${TELEGRAM_API}/getUpdates`);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('Failed to fetch Telegram chats:', err);
    res.status(500).json({ error: 'Failed to fetch Telegram chats' });
  }
});

// POST /api/telegram/send-message — send message via Telegram
router.post('/send-message', authenticateToken, async (req, res) => {
  const { chatId, text } = req.body;
  if (!chatId || !text) {
    return res.status(400).json({ error: 'chatId and text are required' });
  }
  try {
    const response = await sendTelegramMessage(chatId, text);
    res.json(response);
  } catch (err) {
    console.error('Failed to send Telegram message:', err);
    res.status(500).json({ error: 'Failed to send Telegram message' });
  }
});

// POST /api/telegram/forward-message — forward message via Telegram
router.post('/forward-message', authenticateToken, async (req, res) => {
  const { fromChatId, messageId, toChatId } = req.body;
  if (!fromChatId || !messageId || !toChatId) {
    return res.status(400).json({ error: 'fromChatId, messageId, and toChatId are required' });
  }
  try {
    const response = await fetch(`${TELEGRAM_API}/forwardMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from_chat_id: fromChatId, message_id: messageId, chat_id: toChatId }),
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('Failed to forward Telegram message:', err);
    res.status(500).json({ error: 'Failed to forward Telegram message' });
  }
});

// POST /api/telegram/send-photo — send photo via Telegram
router.post('/send-photo', authenticateToken, async (req, res) => {
  const { chatId, photo, caption } = req.body;
  if (!chatId || !photo) {
    return res.status(400).json({ error: 'chatId and photo are required' });
  }
  try {
    const response = await fetch(`${TELEGRAM_API}/sendPhoto`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, photo, caption }),
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('Failed to send Telegram photo:', err);
    res.status(500).json({ error: 'Failed to send Telegram photo' });
  }
});

// POST /api/telegram/send-document — send document via Telegram
router.post('/send-document', authenticateToken, async (req, res) => {
  const { chatId, document, caption } = req.body;
  if (!chatId || !document) {
    return res.status(400).json({ error: 'chatId and document are required' });
  }
  try {
    const response = await fetch(`${TELEGRAM_API}/sendDocument`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, document, caption }),
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('Failed to send Telegram document:', err);
    res.status(500).json({ error: 'Failed to send Telegram document' });
  }
});

// POST /api/telegram/send-audio — send audio via Telegram
router.post('/send-audio', authenticateToken, async (req, res) => {
  const { chatId, audio, caption } = req.body;
  if (!chatId || !audio) {
    return res.status(400).json({ error: 'chatId and audio are required' });
  }
  try {
    const response = await fetch(`${TELEGRAM_API}/sendAudio`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, audio, caption }),
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('Failed to send Telegram audio:', err);
    res.status(500).json({ error: 'Failed to send Telegram audio' });
  }
});

// POST /api/telegram/send-video — send video via Telegram
router.post('/send-video', authenticateToken, async (req, res) => {
  const { chatId, video, caption } = req.body;
  if (!chatId || !video) {
    return res.status(400).json({ error: 'chatId and video are required' });
  }
  try {
    const response = await fetch(`${TELEGRAM_API}/sendVideo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, video, caption }),
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('Failed to send Telegram video:', err);
    res.status(500).json({ error: 'Failed to send Telegram video' });
  }
});

// POST /api/telegram/send-sticker — send sticker via Telegram
router.post('/send-sticker', authenticateToken, async (req, res) => {
  const { chatId, sticker } = req.body;
  if (!chatId || !sticker) {
    return res.status(400).json({ error: 'chatId and sticker are required' });
  }
  try {
    const response = await fetch(`${TELEGRAM_API}/sendSticker`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, sticker }),
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('Failed to send Telegram sticker:', err);
    res.status(500).json({ error: 'Failed to send Telegram sticker' });
  }
});

// POST /api/telegram/send-location — send location via Telegram
router.post('/send-location', authenticateToken, async (req, res) => {
  const { chatId, latitude, longitude } = req.body;
  if (!chatId || !latitude || !longitude) {
    return res.status(400).json({ error: 'chatId, latitude, and longitude are required' });
  }
  try {
    const response = await fetch(`${TELEGRAM_API}/sendLocation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, latitude, longitude }),
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('Failed to send Telegram location:', err);
    res.status(500).json({ error: 'Failed to send Telegram location' });
  }
});

// POST /api/telegram/send-contact — send contact via Telegram
router.post('/send-contact', authenticateToken, async (req, res) => {
  const { chatId, phoneNumber, firstName, lastName } = req.body;
  if (!chatId || !phoneNumber || !firstName) {
    return res.status(400).json({ error: 'chatId, phoneNumber, and firstName are required' });
  }
  try {
    const response = await fetch(`${TELEGRAM_API}/sendContact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, phone_number: phoneNumber, first_name: firstName, last_name: lastName }),
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('Failed to send Telegram contact:', err);
    res.status(500).json({ error: 'Failed to send Telegram contact' });
  }
});

export default router;
