import { useState, useEffect, useRef } from 'react';
import { X, Send, Sparkles, Trash2, Bot, RefreshCw, MessageSquare } from 'lucide-react';
import { api } from '../../services/api';
import { useT } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { useChat } from '../../contexts/ChatContext';

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
  const { user } = useAuth();
  const { activeChatId, messages: allMessages } = useChat();
  const [tab, setTab] = useState<'chat' | 'suggest'>('chat');
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

  // Suggest tab state
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestError, setSuggestError] = useState('');
  const [pickedSuggestion, setPickedSuggestion] = useState('');

  const containerRef = useRef<HTMLDivElement>(null);

  const chatMessages = activeChatId ? (allMessages.get(activeChatId) || []) : [];

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-30)));
  }, [messages]);

  useEffect(() => {
    if (open && available === null) {
      api.aiStatus()
        .then(s => {
          setAvailable(s.available);
          setModelName(s.model);
        })
        .catch(() => setAvailable(false));
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

  async function loadSuggestions() {
    if (chatMessages.length === 0) return;
    setSuggestLoading(true);
    setSuggestError('');
    setSuggestions([]);
    try {
      const last = chatMessages.slice(-6).map(m => ({
        senderName: m.senderName,
        content: m.content,
        isOwn: m.senderId === user?.id,
      }));
      const res = await api.aiSuggestReply(last, lang);
      setSuggestions(res);
    } catch (err: unknown) {
      const errorMsg = err && typeof err === 'object' && 'response' in err
        ? (err.response as { data?: { error?: string } })?.data?.error
        : null;
      setSuggestError(errorMsg || t('ai.error'));
    } finally {
      setSuggestLoading(false);
    }
  }

  function handleTabChange(newTab: 'chat' | 'suggest') {
    setTab(newTab);
    if (newTab === 'suggest' && suggestions.length === 0 && chatMessages.length > 0) {
      loadSuggestions();
    }
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
            {tab === 'chat' && (
              <button
                onClick={clearHistory}
                disabled={messages.length === 0}
                className="p-2 hover:bg-aura-elevated rounded-lg disabled:opacity-30 text-aura-text-dim hover:text-aura-text transition-colors"
                title={t('ai.clear')}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button onClick={onClose} className="p-2 hover:bg-aura-elevated rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-aura-border px-4">
          <button
            onClick={() => handleTabChange('chat')}
            className={`flex items-center gap-1.5 py-2.5 px-3 text-sm font-medium border-b-2 transition-colors ${
              tab === 'chat'
                ? 'border-aura-primary text-aura-primary-light'
                : 'border-transparent text-aura-text-dim hover:text-aura-text'
            }`}
          >
            <Bot className="w-4 h-4" />
            {t('ai.tab_chat') || 'Чат'}
          </button>
          <button
            onClick={() => handleTabChange('suggest')}
            disabled={chatMessages.length === 0}
            className={`flex items-center gap-1.5 py-2.5 px-3 text-sm font-medium border-b-2 transition-colors disabled:opacity-40 ${
              tab === 'suggest'
                ? 'border-aura-primary text-aura-primary-light'
                : 'border-transparent text-aura-text-dim hover:text-aura-text'
            }`}
            title={chatMessages.length === 0 ? 'Откройте чат чтобы использовать' : ''}
          >
            <MessageSquare className="w-4 h-4" />
            {t('ai.tab_suggest') || 'Предложить ответ'}
          </button>
        </div>

        {/* ── Chat tab ── */}
        {tab === 'chat' && (
          <>
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
                        {[t('ai.example_1'), t('ai.example_2'), t('ai.example_3')].map((ex, i) => (
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
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
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
          </>
        )}

        {/* ── Suggest tab ── */}
        {tab === 'suggest' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-4">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-aura-text-dim">
                  {lang === 'ru'
                    ? 'ИИ предлагает варианты ответа на основе последних сообщений в чате'
                    : 'AI suggests replies based on the last messages in the chat'}
                </p>
                <button
                  onClick={loadSuggestions}
                  disabled={suggestLoading}
                  className="p-2 hover:bg-aura-elevated rounded-lg text-aura-text-dim hover:text-aura-text transition-colors"
                  title={lang === 'ru' ? 'Обновить' : 'Refresh'}
                >
                  <RefreshCw className={`w-4 h-4 ${suggestLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {suggestLoading && suggestions.length === 0 && (
                <div className="text-center py-8 text-aura-text-muted text-sm">
                  <Sparkles className="w-8 h-8 mx-auto mb-2 text-aura-primary-light animate-pulse" />
                  {t('ai.thinking')}
                </div>
              )}

              {suggestError && (
                <div className="text-sm text-aura-dnd py-2 px-3 rounded-lg bg-aura-dnd/10">{suggestError}</div>
              )}

              {suggestions.length > 0 && (
                <div className="space-y-2">
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => setPickedSuggestion(s)}
                      className={`w-full text-left text-sm px-4 py-3 rounded-xl transition-colors border ${
                        pickedSuggestion === s
                          ? 'bg-aura-primary-dim border-aura-primary text-aura-primary-light'
                          : 'bg-aura-surface2 border-aura-border hover:bg-aura-elevated hover:border-aura-primary/50'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {pickedSuggestion && (
              <div className="p-3 border-t border-aura-border bg-aura-surface flex items-center gap-2">
                <div className="flex-1 px-3 py-2 rounded-xl bg-aura-elevated text-sm text-aura-text truncate">
                  {pickedSuggestion}
                </div>
                <button
                  onClick={() => {
                    // Copy to clipboard
                    navigator.clipboard.writeText(pickedSuggestion).catch(() => {});
                    setPickedSuggestion('');
                    onClose();
                  }}
                  className="px-3 py-2 rounded-xl bg-aura-primary hover:bg-aura-primary-light text-white text-sm font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap"
                >
                  <Send className="w-3.5 h-3.5" />
                  {lang === 'ru' ? 'Скопировать' : 'Copy'}
                </button>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
