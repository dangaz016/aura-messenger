import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, Trash2, Eye, MessageCircle, Send } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useStories } from '../../contexts/StoriesContext';
import { useT } from '../../contexts/LanguageContext';
import { api } from '../../services/api';
import { StoryViewer as StoryViewerType } from '../../types';
import { getInitials } from '../../utils/formatters';

const STORY_DURATION_MS = 5000;

const QUICK_REACTIONS = ['❤️', '🔥', '😂', '😮', '😢', '🎉'];

interface StoryComment {
  id: string;
  content: string;
  created_at: number;
  user_id: string;
  display_name: string;
  username: string;
  avatar_color: string;
}

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
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<StoryComment[]>([]);
  const [commentInput, setCommentInput] = useState('');
  const [sendingComment, setSendingComment] = useState(false);
  const [reactedEmoji, setReactedEmoji] = useState<string | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const elapsedRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  // Ref to always have latest navigation functions (fixes stale closure bug)
  const handleNextRef = useRef<() => void>(() => {});
  const handlePrevRef = useRef<() => void>(() => {});

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

  // Progress animation — uses handleNextRef to avoid stale closure
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
          handleNextRef.current(); // always fresh, no stale closure!
          return;
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [viewerOpen, story?.id, paused]);

  const handleNext = useCallback(() => {
    setShowComments(false);
    if (!currentGroup) return closeViewer();
    if (storyIndex < currentGroup.stories.length - 1) {
      setStoryIndex(i => i + 1);
    } else {
      if (groupIndex + 1 < feed.length) {
        const nextGroup = feed[groupIndex + 1];
        closeViewer();
        setTimeout(() => {
          const ev = new CustomEvent('aura:openStoryGroup', { detail: { userId: nextGroup.user.id } });
          window.dispatchEvent(ev);
        }, 50);
      } else {
        closeViewer();
      }
    }
  }, [currentGroup, storyIndex, groupIndex, feed, closeViewer]);

  const handlePrev = useCallback(() => {
    setShowComments(false);
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
  }, [storyIndex, groupIndex, feed, closeViewer]);

  // Keep refs up to date every render
  handleNextRef.current = handleNext;
  handlePrevRef.current = handlePrev;

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
    setReactedEmoji(emoji);
    try {
      await api.reactToStory(story.id, emoji);
    } catch (err) {
      console.error(err);
    }
    setTimeout(() => setReactedEmoji(null), 1500);
  }

  async function handleLoadComments() {
    if (!story) return;
    setShowComments(true);
    setPaused(true);
    try {
      const data = await api.getStoryComments(story.id);
      setComments(Array.isArray(data) ? data : []);
    } catch { setComments([]); }
  }

  async function handleSendComment() {
    if (!story || !commentInput.trim() || sendingComment) return;
    setSendingComment(true);
    try {
      const newComment = await api.addStoryComment(story.id, commentInput.trim());
      setComments(prev => [...prev, newComment]);
      setCommentInput('');
    } catch { /* ignore */ }
    setSendingComment(false);
  }

  // Keyboard navigation — uses refs to avoid stale closures
  useEffect(() => {
    if (!viewerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { if (showComments) { setShowComments(false); setPaused(false); } else closeViewer(); }
      else if (e.key === 'ArrowRight' || e.key === ' ') handleNextRef.current();
      else if (e.key === 'ArrowLeft') handlePrevRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [viewerOpen, showComments, closeViewer]);

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
      <button onClick={closeViewer} className="absolute inset-0 cursor-default" aria-label={t('stories.close')} />

      {/* Story container */}
      <div className="relative w-full h-full max-w-md lg:max-h-[90vh] mx-auto flex flex-col">

        {/* Progress bars */}
        <div className="absolute top-3 left-3 right-3 z-20 flex gap-1">
          {currentGroup.stories.map((s, i) => (
            <div key={s.id} className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden">
              <div
                className="h-full bg-white"
                style={{
                  width: i < storyIndex ? '100%' : i === storyIndex ? `${progress * 100}%` : '0%',
                  transition: i === storyIndex ? 'none' : undefined,
                }}
              />
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="absolute top-7 left-3 right-3 z-20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0"
              style={{ background: `linear-gradient(135deg, ${currentGroup.user.avatarColor} 0%, ${currentGroup.user.avatarColor}cc 100%)` }}
            >
              {getInitials(currentGroup.user.displayName)}
            </div>
            <div>
              <div className="text-white text-sm font-semibold leading-tight">{currentGroup.user.displayName}</div>
              <div className="text-white/60 text-xs">{timeAgo}</div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {isOwn && (
              <button onClick={handleDelete} className="p-2 hover:bg-white/10 rounded-full text-white/80 hover:text-white" title={t('stories.delete')}>
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

          {/* Reaction feedback overlay */}
          {reactedEmoji && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-7xl animate-bounce-subtle">{reactedEmoji}</div>
            </div>
          )}
        </div>

        {/* Tap zones for desktop navigation */}
        <button onClick={handlePrev} className="hidden lg:block absolute left-0 top-0 bottom-0 w-1/3 z-10 group" aria-label="Prev">
          <ChevronLeft className="w-8 h-8 text-white/0 group-hover:text-white/60 absolute left-2 top-1/2 -translate-y-1/2 transition-colors" />
        </button>
        <button onClick={handleNext} className="hidden lg:block absolute right-0 top-0 bottom-0 w-1/3 z-10 group" aria-label="Next">
          <ChevronRight className="w-8 h-8 text-white/0 group-hover:text-white/60 absolute right-2 top-1/2 -translate-y-1/2 transition-colors" />
        </button>

        {/* Bottom bar */}
        <div className="absolute bottom-4 left-3 right-3 z-20">
          {isOwn ? (
            <div className="flex items-center gap-2">
              <button
                onClick={handleShowViewers}
                className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full px-3 py-1.5 text-white text-sm transition-colors"
              >
                <Eye className="w-4 h-4" />
                <span>{story.viewerCount > 0 ? story.viewerCount : t('stories.no_views_yet')}</span>
              </button>
              <button
                onClick={handleLoadComments}
                className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full px-3 py-1.5 text-white text-sm transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
                <span>{comments.length > 0 ? comments.length : 'Comments'}</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {/* Emoji reactions with proper sizing */}
              <div className="flex gap-1 flex-1">
                {QUICK_REACTIONS.map(emoji => (
                  <button
                    key={emoji}
                    onClick={() => handleReact(emoji)}
                    className={`w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-all hover:scale-110 active:scale-95 text-xl leading-none ${reactedEmoji === emoji ? 'bg-white/30 scale-125' : ''}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
              <button
                onClick={handleLoadComments}
                className="flex items-center gap-1 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full px-3 py-2 text-white text-sm transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Viewers list panel */}
      {showViewers && (
        <div className="absolute inset-0 z-30 bg-black/80 backdrop-blur-md flex items-end justify-center"
          onClick={() => { setShowViewers(false); setPaused(false); }}>
          <div onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-aura-surface rounded-t-2xl max-h-[60vh] flex flex-col animate-slide-in-bottom">
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
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0"
                      style={{ background: `linear-gradient(135deg, ${v.avatarColor} 0%, ${v.avatarColor}cc 100%)` }}>
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

      {/* Comments panel */}
      {showComments && (
        <div className="absolute inset-0 z-30 bg-black/80 backdrop-blur-md flex items-end justify-center"
          onClick={() => { setShowComments(false); setPaused(false); }}>
          <div onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-aura-surface rounded-t-2xl max-h-[70vh] flex flex-col animate-slide-in-bottom">
            <div className="p-4 border-b border-aura-border flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2">
                <MessageCircle className="w-4 h-4" /> Comments ({comments.length})
              </h3>
              <button onClick={() => { setShowComments(false); setPaused(false); }} className="p-1 hover:bg-aura-elevated rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {comments.length === 0 ? (
                <div className="p-6 text-center text-aura-text-muted text-sm">No comments yet. Be first!</div>
              ) : (
                comments.map(c => (
                  <div key={c.id} className="flex gap-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0"
                      style={{ background: `linear-gradient(135deg, ${c.avatar_color} 0%, ${c.avatar_color}cc 100%)` }}>
                      {getInitials(c.display_name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-aura-text-dim mb-0.5">@{c.username}</div>
                      <div className="text-sm text-aura-text bg-aura-elevated rounded-lg px-3 py-2 break-words">
                        {c.content}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            {/* Comment input */}
            <div className="p-3 border-t border-aura-border flex gap-2">
              <input
                type="text"
                value={commentInput}
                onChange={(e) => setCommentInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendComment()}
                placeholder="Write a comment..."
                className="flex-1 bg-aura-surface2 border border-aura-border rounded-full px-4 py-2 text-sm focus:outline-none focus:border-aura-primary"
                maxLength={500}
              />
              <button
                onClick={handleSendComment}
                disabled={!commentInput.trim() || sendingComment}
                className="w-9 h-9 rounded-full bg-aura-primary hover:bg-aura-primary-light disabled:opacity-50 flex items-center justify-center transition-colors"
              >
                <Send className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
