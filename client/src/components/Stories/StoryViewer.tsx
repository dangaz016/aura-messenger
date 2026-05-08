import { useState, useEffect, useRef, useMemo } from 'react';
import { X, ChevronLeft, ChevronRight, Trash2, Eye } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useStories } from '../../contexts/StoriesContext';
import { useT } from '../../contexts/LanguageContext';
import { api } from '../../services/api';
import { StoryViewer as StoryViewerType } from '../../types';
import { getInitials } from '../../utils/formatters';

const STORY_DURATION_MS = 5000;

const QUICK_REACTIONS = ['❤️', '🔥', '😂', '😮', '😢', '🎉'];

export function StoryViewer() {
  const { user } = useAuth();
  const { feed, viewerOpen, viewerUserId, viewerStartIndex, closeViewer, refresh } = useStories();
  const { t } = useT();

  const groupIndex = useMemo(() => feed.findIndex(g => g.user.id === viewerUserId), [feed, viewerUserId]);
  const currentGroup = groupIndex >= 0 ? feed[groupIndex] : null;
  const [storyIndex, setStoryIndex] = useState(viewerStartIndex);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [showViewers, setShowViewers] = useState(false);
  const [viewers, setViewers] = useState<StoryViewerType[]>([]);
  const startTimeRef = useRef<number>(Date.now());
  const elapsedRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const story = currentGroup?.stories[storyIndex];

  useEffect(() => {
    if (viewerOpen) {
      setStoryIndex(viewerStartIndex);
      setProgress(0);
      elapsedRef.current = 0;
      startTimeRef.current = Date.now();
    }
  }, [viewerOpen, viewerStartIndex, viewerUserId]);

  // Mark as viewed
  useEffect(() => {
    if (story && !story.viewed) {
      api.viewStory(story.id).catch(() => {});
    }
  }, [story?.id]);

  // Progress animation
  useEffect(() => {
    if (!viewerOpen || !story) return;
    setProgress(0);
    elapsedRef.current = 0;
    startTimeRef.current = Date.now();

    const tick = () => {
      if (paused) {
        startTimeRef.current = Date.now() - elapsedRef.current;
      } else {
        elapsedRef.current = Date.now() - startTimeRef.current;
        const p = Math.min(1, elapsedRef.current / STORY_DURATION_MS);
        setProgress(p);
        if (p >= 1) {
          handleNext();
          return;
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewerOpen, story?.id, paused]);

  function handleNext() {
    if (!currentGroup) return closeViewer();
    if (storyIndex < currentGroup.stories.length - 1) {
      setStoryIndex(i => i + 1);
    } else {
      // Move to next user group
      if (groupIndex + 1 < feed.length) {
        const nextGroup = feed[groupIndex + 1];
        // close current viewer state, open next group
        closeViewer();
        setTimeout(() => {
          // re-open via context
          const ev = new CustomEvent('aura:openStoryGroup', { detail: { userId: nextGroup.user.id } });
          window.dispatchEvent(ev);
        }, 50);
      } else {
        closeViewer();
      }
    }
  }

  function handlePrev() {
    if (storyIndex > 0) {
      setStoryIndex(i => i - 1);
    } else if (groupIndex > 0) {
      const prevGroup = feed[groupIndex - 1];
      closeViewer();
      setTimeout(() => {
        const ev = new CustomEvent('aura:openStoryGroup', { detail: { userId: prevGroup.user.id, startIndex: prevGroup.stories.length - 1 } });
        window.dispatchEvent(ev);
      }, 50);
    }
  }

  async function handleDelete() {
    if (!story) return;
    if (!confirm(t('stories.confirm_delete'))) return;
    try {
      await api.deleteStory(story.id);
      await refresh();
      closeViewer();
    } catch (err) {
      console.error(err);
    }
  }

  async function handleShowViewers() {
    if (!story) return;
    setShowViewers(true);
    setPaused(true);
    try {
      const list = await api.getStoryViewers(story.id);
      setViewers(list);
    } catch (err) {
      setViewers([]);
    }
  }

  async function handleReact(emoji: string) {
    if (!story) return;
    try {
      await api.reactToStory(story.id, emoji);
    } catch (err) {
      console.error(err);
    }
  }

  // Keyboard navigation
  useEffect(() => {
    if (!viewerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeViewer();
      else if (e.key === 'ArrowRight' || e.key === ' ') handleNext();
      else if (e.key === 'ArrowLeft') handlePrev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewerOpen, currentGroup, storyIndex, groupIndex]);

  // Touch swipe handling
  function handleTouchStart(e: React.TouchEvent) {
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    };
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (!touchStartRef.current) return;
    const deltaX = e.changedTouches[0].clientX - touchStartRef.current.x;
    const deltaY = e.changedTouches[0].clientY - touchStartRef.current.y;
    touchStartRef.current = null;

    // Only horizontal swipes (not vertical scrolls)
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
      if (deltaX > 0) handlePrev();
      else handleNext();
    }
  }

  if (!viewerOpen || !currentGroup || !story) return null;

  const isOwn = user?.id === currentGroup.user.id;
  const fileUrl = story.fileId ? api.fileUrl(story.fileId) : null;
  const timeAgo = (() => {
    const mins = Math.floor((Date.now() / 1000 - story.createdAt) / 60);
    if (mins < 1) return t('stories.just_now');
    if (mins < 60) return `${mins}${t('stories.min_short')}`;
    return `${Math.floor(mins / 60)}${t('stories.hour_short')}`;
  })();

  return (
    <div className="fixed inset-0 z-50 bg-black flex items-center justify-center animate-fade-in">
      {/* Backdrop click to close */}
      <button
        onClick={closeViewer}
        className="absolute inset-0 cursor-default"
        aria-label={t('stories.close')}
      />

      {/* Story container */}
      <div className="relative w-full h-full max-w-md lg:max-h-[90vh] mx-auto flex flex-col">
        {/* Progress bars */}
        <div className="absolute top-3 left-3 right-3 z-20 flex gap-1">
          {currentGroup.stories.map((s, i) => (
            <div key={s.id} className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden">
              <div
                className="h-full bg-white transition-all"
                style={{
                  width: i < storyIndex ? '100%' : i === storyIndex ? `${progress * 100}%` : '0%',
                }}
              />
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="absolute top-7 left-3 right-3 z-20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-semibold"
              style={{ background: `linear-gradient(135deg, ${currentGroup.user.avatarColor} 0%, ${currentGroup.user.avatarColor}cc 100%)` }}
            >
              {getInitials(currentGroup.user.displayName)}
            </div>
            <div>
              <div className="text-white text-sm font-semibold">{currentGroup.user.displayName}</div>
              <div className="text-white/60 text-xs">{timeAgo}</div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {isOwn && (
              <button
                onClick={handleDelete}
                className="p-2 hover:bg-white/10 rounded-full text-white/80 hover:text-white"
                title={t('stories.delete')}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button onClick={closeViewer} className="p-2 hover:bg-white/10 rounded-full text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div
          className="flex-1 relative flex items-center justify-center overflow-hidden"
          onMouseDown={() => setPaused(true)}
          onMouseUp={() => setPaused(false)}
          onMouseLeave={() => setPaused(false)}
          onTouchStart={(e) => { setPaused(true); handleTouchStart(e); }}
          onTouchEnd={(e) => { setPaused(false); handleTouchEnd(e); }}
        >
          {story.type === 'text' ? (
            <div
              className="w-full h-full flex items-center justify-center p-8"
              style={{ background: story.bgColor || 'linear-gradient(135deg, #7C3AED 0%, #EC4899 100%)' }}
            >
              <div className="text-white text-2xl font-semibold text-center break-words leading-relaxed">
                {story.content}
              </div>
            </div>
          ) : story.type === 'image' && fileUrl ? (
            <img src={fileUrl} alt="" className="max-w-full max-h-full object-contain" />
          ) : story.type === 'video' && fileUrl ? (
            <video src={fileUrl} className="max-w-full max-h-full" autoPlay controls={false} muted playsInline />
          ) : null}
        </div>

        {/* Tap zones - hidden on touch devices, navigation is via swipe */}
        <button onClick={handlePrev} className="hidden lg:block absolute left-0 top-0 bottom-0 w-1/3 z-10" aria-label="Prev">
          <ChevronLeft className="w-8 h-8 text-white/0 hover:text-white/40 absolute left-2 top-1/2 -translate-y-1/2" />
        </button>
        <button onClick={handleNext} className="hidden lg:block absolute right-0 top-0 bottom-0 w-1/3 z-10" aria-label="Next">
          <ChevronRight className="w-8 h-8 text-white/0 hover:text-white/40 absolute right-2 top-1/2 -translate-y-1/2" />
        </button>

        {/* Bottom: reactions / viewer count */}
        <div className="absolute bottom-4 left-3 right-3 z-20 flex items-center gap-2">
          {isOwn ? (
            <button
              onClick={handleShowViewers}
              className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full px-3 py-1.5 text-white text-sm transition-colors"
            >
              <Eye className="w-4 h-4" />
              {story.viewerCount > 0 ? story.viewerCount : t('stories.no_views_yet')}
            </button>
          ) : (
            <div className="flex gap-1 mx-auto">
              {QUICK_REACTIONS.map(emoji => (
                <button
                  key={emoji}
                  onClick={() => handleReact(emoji)}
                  className="text-2xl hover:scale-125 transition-transform p-1"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Viewers list panel */}
      {showViewers && (
        <div
          className="absolute inset-0 z-30 bg-black/80 backdrop-blur-md flex items-end justify-center"
          onClick={() => { setShowViewers(false); setPaused(false); }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-aura-surface rounded-t-2xl max-h-[60vh] flex flex-col"
          >
            <div className="p-4 border-b border-aura-border flex items-center justify-between">
              <h3 className="font-semibold">{t('stories.viewers')} ({viewers.length})</h3>
              <button onClick={() => { setShowViewers(false); setPaused(false); }} className="p-1 hover:bg-aura-elevated rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {viewers.length === 0 ? (
                <div className="p-6 text-center text-aura-text-muted text-sm">{t('stories.no_views_yet')}</div>
              ) : (
                viewers.map(v => (
                  <div key={v.id} className="flex items-center gap-3 px-3 py-2 hover:bg-aura-elevated rounded-lg">
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-semibold"
                      style={{ background: `linear-gradient(135deg, ${v.avatarColor} 0%, ${v.avatarColor}cc 100%)` }}
                    >
                      {getInitials(v.displayName)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{v.displayName}</div>
                      <div className="text-xs text-aura-text-dim">@{v.username}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
