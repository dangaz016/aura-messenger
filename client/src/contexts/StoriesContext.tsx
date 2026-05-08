import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { StoryGroup } from '../types';
import { api } from '../services/api';
import { useAuth } from './AuthContext';

interface StoriesContextValue {
  feed: StoryGroup[];
  loading: boolean;
  refresh: () => Promise<void>;
  viewerOpen: boolean;
  viewerUserId: string | null;
  viewerStartIndex: number;
  openViewer: (userId: string, startIndex?: number) => void;
  closeViewer: () => void;
  composerOpen: boolean;
  openComposer: () => void;
  closeComposer: () => void;
}

const StoriesContext = createContext<StoriesContextValue | null>(null);

export function StoriesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [feed, setFeed] = useState<StoryGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerUserId, setViewerUserId] = useState<string | null>(null);
  const [viewerStartIndex, setViewerStartIndex] = useState(0);
  const [composerOpen, setComposerOpen] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await api.getStoryFeed();
      setFeed(data);
    } catch (err) {
      console.error('[stories] refresh error', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) refresh();
  }, [user, refresh]);

  // Auto-refresh every 30 seconds while user is active
  useEffect(() => {
    if (!user) return;
    const t = setInterval(refresh, 30000);
    return () => clearInterval(t);
  }, [user, refresh]);

  const openViewer = useCallback((userId: string, startIndex = 0) => {
    setViewerUserId(userId);
    setViewerStartIndex(startIndex);
    setViewerOpen(true);
  }, []);

  const closeViewer = useCallback(() => {
    setViewerOpen(false);
    setViewerUserId(null);
    refresh();
  }, [refresh]);

  return (
    <StoriesContext.Provider value={{
      feed, loading, refresh,
      viewerOpen, viewerUserId, viewerStartIndex,
      openViewer, closeViewer,
      composerOpen,
      openComposer: () => setComposerOpen(true),
      closeComposer: () => { setComposerOpen(false); refresh(); },
    }}>
      {children}
    </StoriesContext.Provider>
  );
}

export function useStories() {
  const ctx = useContext(StoriesContext);
  if (!ctx) throw new Error('useStories must be used within StoriesProvider');
  return ctx;
}
