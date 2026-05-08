import { useState, useRef } from 'react';
import { X, Image as ImageIcon, Type, Send } from 'lucide-react';
import { useStories } from '../../contexts/StoriesContext';
import { useT } from '../../contexts/LanguageContext';
import { api } from '../../services/api';

const BG_GRADIENTS = [
  'linear-gradient(135deg, #7C3AED 0%, #EC4899 100%)',
  'linear-gradient(135deg, #3B82F6 0%, #06B6D4 100%)',
  'linear-gradient(135deg, #F59E0B 0%, #EF4444 100%)',
  'linear-gradient(135deg, #10B981 0%, #06B6D4 100%)',
  'linear-gradient(135deg, #8B5CF6 0%, #3B82F6 100%)',
  'linear-gradient(135deg, #EC4899 0%, #F472B6 100%)',
  'linear-gradient(135deg, #1f2937 0%, #4B5563 100%)',
  'linear-gradient(135deg, #FBBF24 0%, #F472B6 100%)',
];

export function StoryComposer() {
  const { composerOpen, closeComposer } = useStories();
  const { t } = useT();
  const [mode, setMode] = useState<'text' | 'image'>('text');
  const [text, setText] = useState('');
  const [bgColor, setBgColor] = useState(BG_GRADIENTS[0]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!composerOpen) return null;

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError(t('stories.error_image_only'));
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setMode('image');
    setError('');
  }

  async function handlePost() {
    setError('');
    setPosting(true);
    try {
      if (mode === 'text') {
        if (!text.trim()) throw new Error(t('stories.error_text_empty'));
        await api.createStory({ type: 'text', content: text.trim(), bgColor });
      } else {
        if (!imageFile) throw new Error(t('stories.error_no_image'));
        const uploaded = await api.uploadFile(imageFile);
        await api.createStory({ type: 'image', fileId: uploaded.id });
      }
      handleClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('stories.error_post'));
    } finally {
      setPosting(false);
    }
  }

  function handleClose() {
    setText('');
    setImageFile(null);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
    setMode('text');
    setError('');
    closeComposer();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
      <div className="w-full max-w-md bg-aura-surface rounded-2xl overflow-hidden flex flex-col max-h-[90vh] animate-slide-up">
        <div className="p-4 border-b border-aura-border flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t('stories.create')}</h2>
          <button onClick={handleClose} className="p-1 hover:bg-aura-elevated rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode tabs */}
        <div className="px-4 pt-3 flex gap-2">
          <button
            onClick={() => setMode('text')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${
              mode === 'text' ? 'bg-aura-primary text-white' : 'bg-aura-surface2 text-aura-text-dim hover:bg-aura-elevated'
            }`}
          >
            <Type className="w-4 h-4" />
            {t('stories.mode_text')}
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${
              mode === 'image' ? 'bg-aura-primary text-white' : 'bg-aura-surface2 text-aura-text-dim hover:bg-aura-elevated'
            }`}
          >
            <ImageIcon className="w-4 h-4" />
            {t('stories.mode_image')}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFile}
            className="hidden"
          />
        </div>

        {/* Preview */}
        <div className="p-4">
          <div
            className="aspect-[9/16] max-h-[60vh] mx-auto rounded-2xl overflow-hidden flex items-center justify-center relative"
            style={mode === 'text' ? { background: bgColor } : { background: '#000' }}
          >
            {mode === 'text' ? (
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={t('stories.text_placeholder')}
                className="w-full h-full bg-transparent text-white text-2xl font-semibold text-center px-6 py-12 resize-none placeholder-white/50 focus:outline-none"
                maxLength={300}
                autoFocus
              />
            ) : imagePreview ? (
              <img src={imagePreview} alt="" className="max-w-full max-h-full object-contain" />
            ) : (
              <div className="text-white/60 text-sm">{t('stories.select_image')}</div>
            )}
          </div>

          {mode === 'text' && (
            <div className="mt-3">
              <div className="text-xs text-aura-text-muted mb-2">{t('stories.background')}</div>
              <div className="flex gap-2 flex-wrap">
                {BG_GRADIENTS.map(g => (
                  <button
                    key={g}
                    onClick={() => setBgColor(g)}
                    className={`w-8 h-8 rounded-lg ${bgColor === g ? 'ring-2 ring-white scale-110' : ''} transition-transform`}
                    style={{ background: g }}
                  />
                ))}
              </div>
            </div>
          )}

          {mode === 'text' && (
            <div className="text-xs text-aura-text-muted mt-2 text-right">{text.length}/300</div>
          )}
        </div>

        {error && (
          <div className="mx-4 mb-3 px-3 py-2 rounded-lg bg-aura-dnd/10 border border-aura-dnd/30 text-aura-dnd text-sm">
            {error}
          </div>
        )}

        <div className="p-4 border-t border-aura-border flex gap-2">
          <button onClick={handleClose} className="btn-secondary flex-1" disabled={posting}>
            {t('stories.cancel')}
          </button>
          <button
            onClick={handlePost}
            disabled={posting || (mode === 'text' ? !text.trim() : !imageFile)}
            className="btn-primary flex-1 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {posting ? t('stories.posting') : (
              <>
                <Send className="w-4 h-4" />
                {t('stories.post')}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
