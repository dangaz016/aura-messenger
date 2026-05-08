import { useState } from 'react';
import { Sparkles, RefreshCw, X } from 'lucide-react';
import { api } from '../../services/api';
import { Message } from '../../types';
import { useT } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';

interface SuggestReplyProps {
  messages: Message[];
  onPick: (text: string) => void;
}

export function SuggestReply({ messages, onPick }: SuggestReplyProps) {
  const { t, lang } = useT();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function loadSuggestions() {
    setLoading(true);
    setError('');
    try {
      const last = messages
        .slice(-6)
        .map(m => ({
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
      setError(errorMsg || t('ai.error'));
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => { setOpen(true); loadSuggestions(); }}
        disabled={messages.length === 0}
        className="p-2 rounded-lg hover:bg-aura-elevated text-aura-primary-light hover:text-aura-primary transition-colors disabled:opacity-50"
        title={t('ai.suggest_reply')}
      >
        <Sparkles className="w-5 h-5" />
      </button>
    );
  }

  return (
    <div className="absolute bottom-full mb-2 left-0 right-0 mx-3 bg-aura-elevated border border-aura-border rounded-xl shadow-lg z-10 p-3 animate-slide-up">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-aura-primary-light">
          <Sparkles className="w-3.5 h-3.5" />
          {t('ai.suggestions')}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={loadSuggestions}
            disabled={loading}
            className="p-1 hover:bg-aura-surface2 rounded"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={() => setOpen(false)} className="p-1 hover:bg-aura-surface2 rounded">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {loading && suggestions.length === 0 && (
        <div className="text-xs text-aura-text-muted py-3 text-center">{t('ai.thinking')}</div>
      )}

      {error && (
        <div className="text-xs text-aura-dnd py-2">{error}</div>
      )}

      {suggestions.length > 0 && (
        <div className="space-y-1.5">
          {suggestions.map((s, i) => (
            <button
              key={i}
              onClick={() => { onPick(s); setOpen(false); }}
              className="w-full text-left text-sm px-3 py-2 rounded-lg bg-aura-surface2 hover:bg-aura-primary-dim hover:text-aura-primary-light transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
