import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Paperclip, Timer, Smile, X, Mic, Camera, Image, Video, Reply, Snowflake } from 'lucide-react';
import { useChat } from '../../contexts/ChatContext';
import { useAuth } from '../../contexts/AuthContext';
import { useT } from '../../contexts/LanguageContext';
import { api } from '../../services/api';
import { SuggestReply } from '../AI/SuggestReply';
import { Message } from '../../types';
import { playMessageSentSound } from '../../utils/sounds';
import { saveDraft, loadDraft, clearDraft } from '../../utils/sessionStorage';

export interface ReplyTarget {
  id: string;
  senderName: string;
  content: string;
  type: string;
}

const getEchoOptions = (offLabel: string): { label: string; value: number | null }[] => [
  { label: offLabel, value: null },
  { label: '1s', value: 1 },
  { label: '5s', value: 5 },
  { label: '10s', value: 10 },
  { label: '30s', value: 30 },
  { label: '1m', value: 60 },
  { label: '2m', value: 120 },
  { label: '5m', value: 300 },
  { label: '10m', value: 600 },
  { label: '30m', value: 1800 },
  { label: '1h', value: 3600 },
  { label: '3h', value: 10800 },
  { label: '6h', value: 21600 },
  { label: '12h', value: 43200 },
  { label: '1d', value: 86400 },
  { label: '3d', value: 259200 },
  { label: '1w', value: 604800 },
  { label: '2w', value: 1209600 },
  { label: '1mo', value: 2592000 },
];

const QUICK_EMOJIS = ['😀', '😂', '😍', '🥰', '😎', '🤔', '👀', '👍', '👎', '🔥', '❤️', '💔', '😭', '😡', '🎉', '✨', '💯', '🙏', '👋', '🚀'];

interface MessageInputProps {
  chatId: string;
  chatType: 'direct' | 'group' | 'space' | 'channel';
  replyTo?: ReplyTarget | null;
  onClearReply?: () => void;
}

export function MessageInput({ chatId, replyTo, onClearReply }: MessageInputProps) {
  const { sendMessage, startTyping, stopTyping, messages: allMessages } = useChat();
  const { isFrozen, freezeUntil, freezeReason } = useAuth();
  const { t } = useT();
  // Is the freeze still active?
  const frozenActive = isFrozen && freezeUntil > Math.floor(Date.now() / 1000);
  const ECHO_OPTIONS = getEchoOptions(t('input.echo_off'));
  const chatMessages = allMessages.get(chatId) || [];
  const [text, setText] = useState('');
  const [echoDuration, setEchoDuration] = useState<number | null>(null);
  const [showEcho, setShowEcho] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showMediaMenu, setShowMediaMenu] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const recordingCancelledRef = useRef(false);

  // Video circle state
  const [isVideoRecording, setIsVideoRecording] = useState(false);
  const [videoTime, setVideoTime] = useState(0);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  // Voice recording refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const holdTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Video recording refs
  const videoRecorderRef = useRef<MediaRecorder | null>(null);
  const videoChunksRef = useRef<Blob[]>([]);
  const videoTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const videoStreamRef = useRef<MediaStream | null>(null);

  // Restore draft when chatId changes
  useEffect(() => {
    const draft = loadDraft(chatId);
    setText(draft);
  }, [chatId]);

  // Save draft when text changes (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      saveDraft(chatId, text);
    }, 500);
    return () => clearTimeout(timer);
  }, [text, chatId]);

  useEffect(() => {
    return () => {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      if (isTypingRef.current) stopTyping(chatId);
      isTypingRef.current = false;
      stopAnyRecording();
    };
  }, [chatId, stopTyping]);

  function stopAnyRecording() {
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    if (videoTimerRef.current) clearInterval(videoTimerRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    videoStreamRef.current?.getTracks().forEach(t => t.stop());
  }

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
    sendMessage(chatId, content, {
      echoDuration: echoDuration ?? undefined,
      replyToId: replyTo?.id,
    });
    playMessageSentSound();
    setText('');
    clearDraft(chatId);
    setShowEmoji(false);
    onClearReply?.();
    if (isTypingRef.current) {
      stopTyping(chatId);
      isTypingRef.current = false;
    }
    textareaRef.current?.focus();
  }

  async function handleUploadAndSend(file: File, type: 'file' | 'image' | 'voice' | 'video') {
    setUploading(true);
    setUploadProgress(type === 'voice' ? '🎤 Отправка...' : type === 'video' ? '🎥 Отправка...' : `${t('input.uploading')} ${file.name}...`);
    try {
      const uploaded = await api.uploadFile(file);
      sendMessage(chatId, file.name, {
        type,
        fileId: uploaded.id,
        echoDuration: echoDuration ?? undefined,
      });
    } catch {
      setUploadProgress(t('input.upload_failed'));
      setTimeout(() => setUploadProgress(''), 2000);
    } finally {
      setUploading(false);
      setTimeout(() => setUploadProgress(''), 1500);
    }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    const type = isImage ? 'image' : isVideo ? 'video' : 'file';
    await handleUploadAndSend(file, type);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (imageInputRef.current) imageInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  // ── Voice recording ────────────────────────────────────────────────────────

  const startVoiceRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg';
      const recorder = new MediaRecorder(stream, { mimeType });
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        if (recordingCancelledRef.current) {
          recordingCancelledRef.current = false;
          return;
        }
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        const ext = mimeType.includes('webm') ? 'webm' : 'ogg';
        const file = new File([blob], `voice_${Date.now()}.${ext}`, { type: mimeType });
        await handleUploadAndSend(file, 'voice');
      };

      recorder.start(100);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      recordingCancelledRef.current = false;
      setRecordingTime(0);
      recordingTimerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000);
    } catch {
      // Microphone access denied
    }
  }, []);

  function stopVoiceRecording(cancel = false) {
    if (cancel) recordingCancelledRef.current = true;
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
    setRecordingTime(0);
  }

  function handleMicPointerDown(e: React.PointerEvent) {
    e.preventDefault();
    holdTimeoutRef.current = setTimeout(() => {
      startVoiceRecording();
    }, 200); // slight delay to distinguish tap from hold
  }

  function handleMicPointerUp() {
    if (holdTimeoutRef.current) clearTimeout(holdTimeoutRef.current);
    if (isRecording) stopVoiceRecording(false);
  }

  // ── Video circle recording ─────────────────────────────────────────────────

  async function startVideoCircle() {
    setShowMediaMenu(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 300, height: 300 }, audio: true });
      videoStreamRef.current = stream;

      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
        videoPreviewRef.current.play();
      }

      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9'
        : MediaRecorder.isTypeSupported('video/webm') ? 'video/webm' : 'video/mp4';
      const recorder = new MediaRecorder(stream, { mimeType: mimeType.split(';')[0] });
      videoChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) videoChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(videoChunksRef.current, { type: 'video/webm' });
        const file = new File([blob], `video_${Date.now()}.webm`, { type: 'video/webm' });
        await handleUploadAndSend(file, 'video');
        setIsVideoRecording(false);
        setVideoTime(0);
      };

      recorder.start(100);
      videoRecorderRef.current = recorder;
      setIsVideoRecording(true);
      setVideoTime(0);
      videoTimerRef.current = setInterval(() => {
        setVideoTime(t => {
          if (t >= 59) {
            stopVideoCircle();
            return 60;
          }
          return t + 1;
        });
      }, 1000);
    } catch {
      // Camera access denied
    }
  }

  function stopVideoCircle() {
    if (videoTimerRef.current) clearInterval(videoTimerRef.current);
    videoRecorderRef.current?.stop();
  }

  function cancelVideoCircle() {
    if (videoTimerRef.current) clearInterval(videoTimerRef.current);
    videoStreamRef.current?.getTracks().forEach(t => t.stop());
    videoRecorderRef.current = null;
    setIsVideoRecording(false);
    setVideoTime(0);
  }

  function formatTime(sec: number) {
    return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
  }

  // ── Video circle recording UI ─────────────────────────────────────────────

  if (isVideoRecording) {
    return (
      <div className="border-t border-aura-border bg-aura-surface/40 backdrop-blur-md p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="relative w-36 h-36 rounded-full overflow-hidden border-4 border-red-500 shadow-lg shadow-red-500/30">
            <video ref={videoPreviewRef} className="w-full h-full object-cover scale-x-[-1]" muted playsInline />
            {/* Circular progress */}
            <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="48" fill="none" stroke="rgba(239,68,68,0.4)" strokeWidth="4" />
              <circle
                cx="50" cy="50" r="48" fill="none" stroke="#ef4444" strokeWidth="4"
                strokeDasharray={`${301.6 * (videoTime / 60)} 301.6`}
                strokeLinecap="round"
              />
            </svg>
          </div>
          <div className="text-sm text-red-400 font-mono animate-pulse">{formatTime(videoTime)} / 1:00</div>
          <div className="flex gap-3">
            <button
              onClick={cancelVideoCircle}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-aura-elevated text-aura-text-dim hover:text-aura-text transition-colors"
            >
              <X className="w-4 h-4" /> Отмена
            </button>
            <button
              onClick={stopVideoCircle}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-aura-primary hover:bg-aura-primary-light text-white transition-colors"
            >
              <Send className="w-4 h-4" /> Отправить
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Voice recording UI ────────────────────────────────────────────────────

  if (isRecording) {
    return (
      <div className="border-t border-aura-border bg-aura-surface/40 backdrop-blur-md p-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => stopVoiceRecording(true)}
            className="p-2 rounded-lg hover:bg-aura-elevated text-red-400 hover:text-red-300 transition-colors"
            title="Отмена"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex-1 flex items-center gap-3">
            {/* Waveform animation */}
            <div className="flex items-center gap-0.5 h-8">
              {Array.from({ length: 20 }).map((_, i) => (
                <div
                  key={i}
                  className="w-1 bg-red-400 rounded-full animate-pulse"
                  style={{
                    height: `${20 + Math.sin(i * 0.7) * 12}px`,
                    animationDelay: `${i * 50}ms`,
                    animationDuration: `${600 + (i % 3) * 200}ms`,
                  }}
                />
              ))}
            </div>
            <span className="text-red-400 font-mono text-sm tabular-nums">{formatTime(recordingTime)}</span>
          </div>
          <button
            onPointerUp={handleMicPointerUp}
            className="p-3 rounded-full bg-red-500 hover:bg-red-400 text-white shadow-lg shadow-red-500/30 transition-all active:scale-95"
          >
            <Mic className="w-5 h-5" />
          </button>
        </div>
      </div>
    );
  }

  // ── Normal input UI ───────────────────────────────────────────────────────

  // Frozen — show locked input instead
  if (frozenActive) {
    return (
      <div className="border-t-2 border-cyan-700/60 bg-cyan-950/50 backdrop-blur-md p-4 flex items-center gap-3">
        <Snowflake className="w-5 h-5 text-cyan-400 flex-shrink-0 animate-spin" style={{ animationDuration: '3s' }} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-cyan-300">Отправка сообщений заблокирована</p>
          {freezeReason && <p className="text-xs text-cyan-600 truncate">{freezeReason}</p>}
        </div>
        <Snowflake className="w-5 h-5 text-cyan-900 flex-shrink-0" />
      </div>
    );
  }

  return (
    <div className="border-t border-aura-border bg-aura-surface/40 backdrop-blur-md safe-bottom">
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

      {/* Reply preview */}
      {replyTo && (
        <div className="mx-3 mt-2 px-3 py-1.5 rounded-xl bg-aura-elevated border-l-2 border-aura-primary flex items-start gap-2">
          <Reply className="w-3.5 h-3.5 text-aura-primary mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-aura-primary-light truncate">{replyTo.senderName}</div>
            <div className="text-xs text-aura-text-muted truncate">
              {replyTo.type === 'voice' ? '🎤 Голосовое' : replyTo.type === 'video' ? '🎥 Кружок' : replyTo.type === 'image' ? '🖼 Фото' : replyTo.content}
            </div>
          </div>
          <button onClick={onClearReply} className="p-0.5 hover:bg-aura-surface2 rounded text-aura-text-muted">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Hidden file inputs */}
      <input ref={fileInputRef} id="aura-file-input" type="file" onChange={handleFile} className="sr-only" accept="*/*" />
      <input ref={imageInputRef} id="aura-gallery-input" type="file" onChange={handleFile} className="sr-only" accept="image/*,video/*" />
      <input ref={cameraInputRef} id="aura-camera-input" type="file" onChange={handleFile} className="sr-only" accept="image/*" capture="environment" />

      <div className="p-3 flex items-end gap-2 relative">

        {/* Camera / Gallery / Video circle button */}
        <div className="relative">
          <button
            onClick={() => { setShowMediaMenu(m => !m); setShowEcho(false); setShowEmoji(false); }}
            className="p-2 rounded-lg hover:bg-aura-elevated text-aura-text-dim hover:text-aura-text transition-colors"
            title="Медиа"
          >
            <Camera className="w-5 h-5" />
          </button>
          {showMediaMenu && (
            <div className="absolute bottom-full mb-2 left-0 bg-aura-elevated border border-aura-border rounded-xl p-1 flex flex-col gap-0.5 shadow-lg z-20 min-w-[180px]">
              {/* Use <label> for gallery — works on iOS/Android without programmatic click */}
              <label
                htmlFor="aura-gallery-input"
                onClick={() => setShowMediaMenu(false)}
                className="flex items-center gap-3 text-sm px-3 py-2.5 rounded-lg hover:bg-aura-surface2 transition-colors cursor-pointer"
              >
                <Image className="w-4 h-4 text-blue-400 flex-shrink-0" />
                <span>Галерея</span>
              </label>
              <label
                htmlFor="aura-camera-input"
                onClick={() => setShowMediaMenu(false)}
                className="flex items-center gap-3 text-sm px-3 py-2.5 rounded-lg hover:bg-aura-surface2 transition-colors cursor-pointer"
              >
                <Camera className="w-4 h-4 text-green-400 flex-shrink-0" />
                <span>Камера (фото)</span>
              </label>
              <button
                type="button"
                onClick={startVideoCircle}
                className="flex items-center gap-3 text-left text-sm px-3 py-2.5 rounded-lg hover:bg-aura-surface2 transition-colors"
              >
                <Video className="w-4 h-4 text-purple-400 flex-shrink-0" />
                <span>Видео-кружок</span>
              </button>
              <div className="border-t border-aura-border my-0.5" />
              <label
                htmlFor="aura-file-input"
                onClick={() => setShowMediaMenu(false)}
                className="flex items-center gap-3 text-sm px-3 py-2.5 rounded-lg hover:bg-aura-surface2 transition-colors cursor-pointer"
              >
                <Paperclip className="w-4 h-4 text-aura-text-dim flex-shrink-0" />
                <span>Файл</span>
              </label>
            </div>
          )}
        </div>

        <SuggestReply messages={chatMessages} onPick={(s) => setText(s)} />

        {/* Echo timer */}
        <div className="relative">
          <button
            onClick={() => { setShowEcho(!showEcho); setShowEmoji(false); setShowMediaMenu(false); }}
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

        {/* Text input */}
        <div className="relative flex-1">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => handleTextChange(e.target.value)}
            onKeyDown={handleKey}
            placeholder={t('input.placeholder')}
            rows={1}
            className="input-aura w-full resize-none max-h-32 py-2.5"
            style={{ minHeight: '42px' }}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="sentences"
          />
        </div>

        {/* Emoji */}
        <div className="relative">
          <button
            onClick={() => { setShowEmoji(!showEmoji); setShowEcho(false); setShowMediaMenu(false); }}
            className="p-2 rounded-lg hover:bg-aura-elevated text-aura-text-dim hover:text-aura-text transition-colors"
            title={t('input.emoji')}
          >
            <Smile className="w-5 h-5" />
          </button>
          {showEmoji && (
            <div className="absolute bottom-full mb-2 right-0 bg-aura-elevated border border-aura-border rounded-xl p-2 grid grid-cols-6 gap-0.5 shadow-lg z-10 w-56">
              {QUICK_EMOJIS.map(e => (
                <button
                  key={e}
                  onClick={() => { setText(prev => prev + e); setShowEmoji(false); }}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-aura-surface2 transition-colors text-xl leading-none"
                  style={{ fontSize: '20px', lineHeight: 1 }}
                >
                  {e}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Send OR Mic (like Telegram: mic when empty, send when text) */}
        {text.trim() ? (
          <button
            onClick={handleSend}
            disabled={uploading}
            className="p-2 rounded-lg bg-aura-primary hover:bg-aura-primary-light active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            title={t('input.send')}
          >
            <Send className="w-5 h-5 text-white" />
          </button>
        ) : (
          <button
            onPointerDown={handleMicPointerDown}
            onPointerUp={handleMicPointerUp}
            onPointerLeave={handleMicPointerUp}
            disabled={uploading}
            className="p-2 rounded-lg bg-aura-elevated hover:bg-aura-primary/20 active:bg-aura-primary/40 text-aura-text-dim hover:text-aura-primary active:scale-95 disabled:opacity-30 transition-all select-none"
            title="Удержи для записи голосового"
          >
            <Mic className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );
}
