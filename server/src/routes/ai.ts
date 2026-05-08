import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.use(authenticateToken);

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = process.env.AI_MODEL || 'llama-3.3-70b-versatile';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

async function callGroq(messages: ChatMessage[], maxTokens = 500): Promise<string> {
  if (!GROQ_API_KEY) {
    throw new Error('AI_NOT_CONFIGURED');
  }
  const res = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      max_tokens: maxTokens,
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Groq API error: ${res.status} ${text.slice(0, 200)}`);
  }

  const data = await res.json() as { choices: { message: { content: string } }[] };
  return data.choices?.[0]?.message?.content?.trim() || '';
}

router.get('/status', (_req, res) => {
  res.json({ available: !!GROQ_API_KEY, model: GROQ_API_KEY ? MODEL : null });
});

// POST /api/ai/chat - general chat with AI assistant
router.post('/chat', async (req, res) => {
  const { message, history, lang } = req.body as {
    message: string;
    history?: { role: 'user' | 'assistant'; content: string }[];
    lang?: 'en' | 'ru';
  };

  if (!message || typeof message !== 'string' || message.length > 2000) {
    return res.status(400).json({ error: 'Invalid message' });
  }

  const systemPrompt = lang === 'ru'
    ? `Ты — Aura AI, дружелюбный ассистент в приватном мессенджере Aura. Отвечай кратко и по делу. Будь тёплым и полезным. Не упоминай OpenAI или Llama. Можешь помогать с идеями, переводами, объяснениями, советами. Отвечай на русском языке.`
    : `You are Aura AI, a friendly assistant inside the private Aura messenger. Be concise and helpful. Don't mention OpenAI or Llama. Help with ideas, translations, explanations, advice. Respond in English.`;

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...(history || []).slice(-10).map(h => ({ role: h.role, content: h.content } as ChatMessage)),
    { role: 'user', content: message },
  ];

  try {
    const reply = await callGroq(messages, 600);
    res.json({ reply });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'unknown';
    if (msg === 'AI_NOT_CONFIGURED') {
      return res.status(503).json({ error: 'AI features not configured. Set GROQ_API_KEY env var.' });
    }
    console.error('[ai/chat]', err);
    res.status(500).json({ error: 'AI request failed' });
  }
});

// POST /api/ai/suggest-reply - suggest a reply to a message
router.post('/suggest-reply', async (req, res) => {
  const { lastMessages, lang } = req.body as {
    lastMessages: { senderName: string; content: string; isOwn: boolean }[];
    lang?: 'en' | 'ru';
  };

  if (!Array.isArray(lastMessages) || lastMessages.length === 0) {
    return res.status(400).json({ error: 'lastMessages required' });
  }

  const conversation = lastMessages
    .slice(-6)
    .map(m => `${m.isOwn ? 'Me' : m.senderName}: ${m.content}`)
    .join('\n');

  const systemPrompt = lang === 'ru'
    ? 'Ты помощник для составления ответов в чате. Прочитай разговор и предложи 3 коротких варианта ответа от лица "Me". Ответы должны быть РАЗНЫМИ по тону: один дружеский, один нейтральный, один краткий. Каждый ответ — одна строка, не больше 100 символов. Без нумерации, без кавычек. Каждый ответ с новой строки. Отвечай только на русском.'
    : 'You help compose chat replies. Read the conversation and suggest 3 short reply options from "Me"\'s perspective. Make them DIFFERENT in tone: one friendly, one neutral, one brief. Each reply on its own line, max 100 chars. No numbering, no quotes. Reply only in English.';

  try {
    const reply = await callGroq([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: conversation },
    ], 300);

    const suggestions = reply
      .split('\n')
      .map(s => s.replace(/^[\d\-\*\.\)]+\s*/, '').replace(/^["']|["']$/g, '').trim())
      .filter(s => s.length > 0 && s.length < 200)
      .slice(0, 3);

    res.json({ suggestions });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'unknown';
    if (msg === 'AI_NOT_CONFIGURED') {
      return res.status(503).json({ error: 'AI not configured' });
    }
    console.error('[ai/suggest-reply]', err);
    res.status(500).json({ error: 'AI request failed' });
  }
});

// POST /api/ai/summarize - summarize a long chat
router.post('/summarize', async (req, res) => {
  const { messages, lang } = req.body as {
    messages: { senderName: string; content: string }[];
    lang?: 'en' | 'ru';
  };

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages required' });
  }

  const text = messages
    .slice(-50)
    .map(m => `${m.senderName}: ${m.content}`)
    .join('\n');

  const systemPrompt = lang === 'ru'
    ? 'Кратко суммаризуй разговор. 3-5 пунктов о главных темах и решениях. Только на русском.'
    : 'Briefly summarize the conversation. 3-5 bullets covering main topics and decisions. English only.';

  try {
    const reply = await callGroq([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: text },
    ], 500);
    res.json({ summary: reply });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'unknown';
    if (msg === 'AI_NOT_CONFIGURED') {
      return res.status(503).json({ error: 'AI not configured' });
    }
    console.error('[ai/summarize]', err);
    res.status(500).json({ error: 'AI request failed' });
  }
});

export default router;
