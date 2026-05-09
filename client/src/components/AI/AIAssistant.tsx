import { useState, useEffect, useRef } from 'react';
import { X, Send, Sparkles, Trash2, Bot } from 'lucide-react';
import { api } from '../../services/api';
import { useT } from '../../contexts/LanguageContext';

interface AIMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface AIAssistantProps {
  open: boolean;
  onClose: () => void;
}

const STORAGE_KEY = 'aura_ai_history';

export function AIAssistant({ open, onClose }: AIAssistantProps) {
  const { t, lang } = useT();
  const [messages, setMessages] = useState<AIMessage[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [modelName, setModelName] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-30)));
  }, [messages]);

  useEffect(() => {
    if (open && available === null) {
      api.aiStatus()
        .then(s => {
          setAvailable(s.available);
          setModelName(s.model);
          console.log('[AI] Status:', s.available ? `✅ Available (${s.model})` : '❌ Not configured');
        })
        .catch(err => {
          console.error('[AI] Status check failed:', err);
          setAvailable(false);
        });
    }
  }, [open, available]);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: AIMessage = { role: 'user', content: text, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const history = messages.map(m => ({ role: m.role, content: m.content }));
      const reply = await api.aiChat(text, history, lang);
      setMessages(prev => [...prev, { role: 'assistant', content: reply, timestamp: Date.now() }]);
    } catch (err: unknown) {
      const errorMsg = err && typeof err === 'object' && 'response' in err
        ? (err.response as { data?: { error?: string } })?.data?.error
        : null;
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: errorMsg ? `⚠️ ${errorMsg}` : `⚠️ ${t('ai.error')}`,
        timestamp: Date.now(),
      }]);
    } finally {
      setLoading(false);
    }
  }

  function clearHistory() {
    if (!confirm(t('ai.confirm_clear'))) return;
    setMessages([]);
    localStorage.removeItem(STORAGE_KEY);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-0 lg:p-4 animate-fade-in">
      <div className="w-full max-w-full lg:max-w-lg bg-aura-surface lg:rounded-2xl overflow-hidden flex flex-col h-full lg:h-[80vh] animate-slide-up border-0 lg:border border-aura-border">
        {/* Header */}
        <div className="p-4 border-b border-aura-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl gradient-aura glow-primary flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-semibold">{t('ai.title')}</h2>
              <div className="text-xs text-aura-text-dim flex items-center gap-1">
                {available === true && (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-aura-online inline-block" />
                    {modelName ? `${t('ai.online')} • ${modelName}` : t('ai.online')}
                  </>
                )}
                {available === false && <><span className="w-1.5 h-1.5 rounded-full bg-aura-dnd inline-block" />{t('ai.offline')}</>}
                {available === null && t('ai.connecting')}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={clearHistory}
              disabled={messages.length === 0}
              className="p-2 hover:bg-aura-elevated rounded-lg disabled:opacity-30 text-aura-text-dim hover:text-aura-text transition-colors"
              title={t('ai.clear')}
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button onClick={onClose} className="p-2 hover:bg-aura-elevated rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div ref={containerRef} className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 ? (
            <div className="h-full flex items-center justify-center text-center px-6">
              <div>
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl gradient-aura glow-primary mb-4">
                  <Bot className="w-8 h-8 text-white" />
                </div>
                <h3 className="font-semibold mb-2">{t('ai.welcome_title')}</h3>
                <p className="text-aura-text-dim text-sm mb-4">{t('ai.welcome_text')}</p>
                {available === false && (
                  <div className="px-3 py-2 rounded-lg bg-aura-ghost/10 border border-aura-ghost/30 text-aura-ghost text-xs">
                    {t('ai.not_configured')}
                  </div>
                )}
                {available && (
                  <div className="grid grid-cols-1 gap-2 text-sm text-left mt-4">
                    {[
                      t('ai.example_1'),
                      t('ai.example_2'),
                      t('ai.example_3'),
                    ].map((ex, i) => (
                      <button
                        key={i}
                        onClick={() => setInput(ex)}
                        className="px-3 py-2 rounded-lg bg-aura-surface2 hover:bg-aura-elevated text-aura-text-dim hover:text-aura-text transition-colors text-left"
                      >
                        💡 {ex}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'message-bubble-out rounded-br-md'
                      : 'message-bubble-in rounded-bl-md'
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))
          )}
          {loading && (
            <div className="flex justify-start">
              <div className="message-bubble-in rounded-2xl rounded-bl-md px-4 py-3">
                <span className="typing-dot" />
                <span className="typing-dot" />
                <span className="typing-dot" />
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="p-3 border-t border-aura-border flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder={available === false ? t('ai.input_disabled') : t('ai.input_placeholder')}
            disabled={loading || available === false}
            rows={1}
            className="input-aura flex-1 resize-none max-h-32"
            style={{ minHeight: '42px' }}
          />
          <button
            onClick={send}
            disabled={!input.trim() || loading || available === false}
            className="bg-aura-primary hover:bg-aura-primary-light disabled:opacity-30 transition-colors p-2 rounded-lg"
          >
            <Send className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}
