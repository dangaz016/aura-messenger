import { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, Timer, Smile, X } from 'lucide-react';
import { useChat } from '../../contexts/ChatContext';
import { useT } from '../../contexts/LanguageContext';
import { api } from '../../services/api';

const getEchoOptions = (offLabel: string): { label: string; value: number | null }[] => [
  { label: offLabel, value: null },
  { label: '5s', value: 5 },
  { label: '30s', value: 30 },
  { label: '1m', value: 60 },
  { label: '5m', value: 300 },
  { label: '1h', value: 3600 },
  { label: '24h', value: 86400 },
];

const QUICK_EMOJIS = ['😀', '😂', '😍', '🥰', '😎', '🤔', '👀', '👍', '👎', '🔥', '❤️', '💔', '😭', '😡', '🎉', '✨', '💯', '🙏', '👋', '🚀'];

interface MessageInputProps {
  chatId: string;
  chatType: 'direct' | 'group' | 'space';
}

export function MessageInput({ chatId }: MessageInputProps) {
  const { sendMessage, startTyping, stopTyping } = useChat();
  const { t } = useT();
  const ECHO_OPTIONS = getEchoOptions(t('input.echo_off'));
  const [text, setText] = useState('');
  const [echoDuration, setEchoDuration] = useState<number | null>(null);
  const [showEcho, setShowEcho] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  useEffect(() => {
    return () => {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      if (isTypingRef.current) stopTyping(chatId);
      isTypingRef.current = false;
    };
  }, [chatId, stopTyping]);

  function handleTextChange(value: string) {
    setText(value);
    if (value.trim() && !isTypingRef.current) {
      startTyping(chatId);
      isTypingRef.current = true;
    }
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      if (isTypingRef.current) {
        stopTyping(chatId);
        isTypingRef.current = false;
      }
    }, 2000);
  }

  function handleSend() {
    const content = text.trim();
    if (!content) return;
    sendMessage(chatId, content, { echoDuration: echoDuration ?? undefined });
    setText('');
    setShowEmoji(false);
    if (isTypingRef.current) {
      stopTyping(chatId);
      isTypingRef.current = false;
    }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadProgress(`${t('input.uploading')} ${file.name}...`);
    try {
      const uploaded = await api.uploadFile(file);
      const isImage = file.type.startsWith('image/');
      sendMessage(chatId, file.name, {
        type: isImage ? 'image' : 'file',
        fileId: uploaded.id,
        echoDuration: echoDuration ?? undefined,
      });
    } catch {
      setUploadProgress(t('input.upload_failed'));
      setTimeout(() => setUploadProgress(''), 2000);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setTimeout(() => setUploadProgress(''), 1500);
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="border-t border-aura-border bg-aura-surface/40 backdrop-blur-md">
      {echoDuration && (
        <div className="px-4 pt-2 -mb-1 flex items-center gap-2 text-xs text-aura-ghost">
          <Timer className="w-3 h-3" />
          <span>{t('input.echo_active')} {echoDuration < 60 ? `${echoDuration}s` : echoDuration < 3600 ? `${echoDuration/60}m` : `${echoDuration/3600}h`}</span>
          <button onClick={() => setEchoDuration(null)} className="ml-auto p-1 hover:bg-aura-elevated rounded">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {uploadProgress && (
        <div className="px-4 pt-2 text-xs text-aura-text-dim">{uploadProgress}</div>
      )}

      <div className="p-3 flex items-end gap-2 relative">
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFile}
          className="hidden"
          accept="*/*"
        />

        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="p-2 rounded-lg hover:bg-aura-elevated text-aura-text-dim hover:text-aura-text transition-colors disabled:opacity-50"
          title={t('input.attach')}
        >
          <Paperclip className="w-5 h-5" />
        </button>

        <div className="relative">
          <button
            onClick={() => setShowEcho(!showEcho)}
            className={`p-2 rounded-lg transition-colors ${
              echoDuration ? 'text-aura-ghost bg-aura-ghost/10' : 'text-aura-text-dim hover:text-aura-text hover:bg-aura-elevated'
            }`}
            title={t('input.echo')}
          >
            <Timer className="w-5 h-5" />
          </button>
          {showEcho && (
            <div className="absolute bottom-full mb-2 left-0 bg-aura-elevated border border-aura-border rounded-xl p-2 flex flex-col gap-1 shadow-lg z-10 min-w-[120px]">
              <div className="text-xs text-aura-text-muted px-2 py-1">{t('input.echo_timer')}</div>
              {ECHO_OPTIONS.map(opt => (
                <button
                  key={opt.label}
                  onClick={() => { setEchoDuration(opt.value); setShowEcho(false); }}
                  className={`text-left text-sm px-3 py-1.5 rounded-md transition-colors ${
                    echoDuration === opt.value ? 'bg-aura-primary text-white' : 'hover:bg-aura-surface2'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="relative flex-1">
          <textarea
            value={text}
            onChange={(e) => handleTextChange(e.target.value)}
            onKeyDown={handleKey}
            placeholder={t('input.placeholder')}
            rows={1}
            className="input-aura w-full resize-none max-h-32 py-2.5"
            style={{ minHeight: '42px' }}
          />
        </div>

        <div className="relative">
          <button
            onClick={() => setShowEmoji(!showEmoji)}
            className="p-2 rounded-lg hover:bg-aura-elevated text-aura-text-dim hover:text-aura-text transition-colors"
            title={t('input.emoji')}
          >
            <Smile className="w-5 h-5" />
          </button>
          {showEmoji && (
            <div className="absolute bottom-full mb-2 right-0 bg-aura-elevated border border-aura-border rounded-xl p-3 grid grid-cols-5 gap-1 shadow-lg z-10">
              {QUICK_EMOJIS.map(e => (
                <button
                  key={e}
                  onClick={() => setText(prev => prev + e)}
                  className="text-2xl hover:scale-125 transition-transform p-1"
                >
                  {e}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={handleSend}
          disabled={!text.trim()}
          className="p-2 rounded-lg bg-aura-primary hover:bg-aura-primary-light disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title={t('input.send')}
        >
          <Send className="w-5 h-5 text-white" />
        </button>
      </div>
    </div>
  );
}
