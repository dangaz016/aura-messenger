import { useEffect, useState } from 'react';
import { X, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { api } from '../../services/api';

interface MediaItem {
  fileId: string;
  type: 'image' | 'video' | 'voice';
  fileName?: string;
}

interface MediaLightboxProps {
  items: MediaItem[];
  initialIndex: number;
  onClose: () => void;
}

export function MediaLightbox({ items, initialIndex, onClose }: MediaLightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') handlePrev();
      if (e.key === 'ArrowRight') handleNext();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, items.length]);

  function handlePrev() {
    setCurrentIndex((i) => (i > 0 ? i - 1 : items.length - 1));
  }

  function handleNext() {
    setCurrentIndex((i) => (i < items.length - 1 ? i + 1 : 0));
  }

  const currentItem = items[currentIndex];
  if (!currentItem) return null;

  const fileUrl = api.fileUrl(currentItem.fileId);

  // Preload adjacent images for smoother navigation
  useEffect(() => {
    if (currentItem.type === 'image') {
      const prevIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
      const nextIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
      
      if (items[prevIndex]?.type === 'image') {
        const img = new Image();
        img.src = api.fileUrl(items[prevIndex].fileId);
      }
      if (items[nextIndex]?.type === 'image') {
        const img = new Image();
        img.src = api.fileUrl(items[nextIndex].fileId);
      }
    }
  }, [currentIndex, items]);

  // Handle image load errors
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const handleImageLoad = () => {
    setImageLoaded(true);
    setImageError(false);
  };

  const handleImageError = () => {
    setImageError(true);
    setImageLoaded(false);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between bg-gradient-to-b from-black/60 to-transparent z-10">
        <div className="text-white text-sm font-medium">
          {currentIndex + 1} / {items.length}
        </div>
        <div className="flex items-center gap-2">
          <a
            href={fileUrl}
            download={currentItem.fileName || `media_${currentItem.fileId}`}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
            title="Скачать"
          >
            <Download className="w-5 h-5" />
          </a>
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
            title="Закрыть (ESC)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Navigation arrows */}
      {items.length > 1 && (
        <>
          <button
            onClick={handlePrev}
            className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all z-10"
            title="Предыдущее (←)"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button
            onClick={handleNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all z-10"
            title="Следующее (→)"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </>
      )}

      {/* Media content */}
      <div className="relative w-full h-full flex items-center justify-center p-16" onClick={onClose}>
        <div
          className="max-w-full max-h-full"
          onClick={(e) => e.stopPropagation()}
        >
          {currentItem.type === 'image' && (
            <>
              {!imageLoaded && !imageError && (
                <div className="w-96 h-96 flex items-center justify-center">
                  <div className="w-12 h-12 rounded-full border-4 border-white/30 border-t-transparent animate-spin" />
                </div>
              )}
              {imageError ? (
                <div className="w-96 h-96 flex flex-col items-center justify-center bg-red-500/10 rounded-lg border-2 border-red-500/30">
                  <div className="text-red-400 text-sm mb-2">⚠️ Failed to load image</div>
                  <button
                    onClick={() => {
                      setImageError(false);
                      setImageLoaded(false);
                    }}
                    className="px-4 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg text-sm"
                  >
                    Retry
                  </button>
                </div>
              ) : (
                <img
                  src={fileUrl}
                  alt={currentItem.fileName || ''}
                  className={`max-w-full max-h-full object-contain rounded-lg shadow-2xl ${imageLoaded ? 'animate-fade-in' : 'opacity-0'}`}
                  onLoad={handleImageLoad}
                  onError={handleImageError}
                />
              )}
            </>
          )}
          {currentItem.type === 'video' && (
            <video
              key={fileUrl}
              src={fileUrl}
              controls
              autoPlay
              className="max-w-full max-h-full rounded-lg shadow-2xl animate-fade-in"
              onError={() => alert('Failed to load video')}
            />
          )}
          {currentItem.type === 'voice' && (
            <div className="bg-aura-elevated rounded-2xl p-8 shadow-2xl animate-fade-in">
              <div className="text-center mb-4 text-white">
                <div className="text-lg font-medium mb-2">🎤 Голосовое сообщение</div>
                <div className="text-sm text-white/70">{currentItem.fileName}</div>
              </div>
              <audio src={fileUrl} controls className="w-full" onError={() => alert('Failed to load audio')} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
