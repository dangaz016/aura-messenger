import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ChatProvider } from './contexts/ChatContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { LanguageProvider, useT } from './contexts/LanguageContext';
import { StoriesProvider, useStories } from './contexts/StoriesContext';
import { LoginPage } from './components/Auth/LoginPage';
import { Sidebar } from './components/Sidebar/Sidebar';
import { ChatWindow } from './components/Chat/ChatWindow';
import { SettingsPanel } from './components/Settings/SettingsPanel';
import { LanguageToggle } from './components/Common/LanguageToggle';
import { StoryViewer } from './components/Stories/StoryViewer';
import { StoryComposer } from './components/Stories/StoryComposer';
import { AIAssistant } from './components/AI/AIAssistant';
import { AnimatedBackground } from './components/Common/AnimatedBackground';
import { registerServiceWorker } from './utils/notifications';
import { Sparkles } from 'lucide-react';

function StoriesEventBridge() {
  const { openViewer } = useStories();
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { userId: string; startIndex?: number };
      if (detail?.userId) openViewer(detail.userId, detail.startIndex || 0);
    };
    window.addEventListener('aura:openStoryGroup', handler);
    return () => window.removeEventListener('aura:openStoryGroup', handler);
  }, [openViewer]);
  return null;
}

function AppShell() {
  const { user, loading } = useAuth();
  const { t } = useT();
  const [showSettings, setShowSettings] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [view, setView] = useState<'chats' | 'spaces'>('chats');
  const [showSidebar, setShowSidebar] = useState(false);

  // Register service worker
  useEffect(() => {
    if (user) {
      registerServiceWorker();
    }
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center gradient-bg">
        <LanguageToggle floating />
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-3 rounded-2xl gradient-aura animate-pulse-soft" />
          <div className="text-aura-text-dim text-sm">{t('app.loading')}</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <LanguageToggle floating />
        <LoginPage />
      </>
    );
  }

  return (
    <ChatProvider>
      <StoriesProvider>
        <StoriesEventBridge />
        <AnimatedBackground />
        <div className="h-screen flex overflow-hidden relative z-10">
          <Sidebar
            onOpenSettings={() => setShowSettings(true)}
            onOpenAI={() => setShowAI(true)}
            view={view}
            setView={setView}
            showMobile={showSidebar}
            onCloseMobile={() => setShowSidebar(false)}
          />
          <ChatWindow onOpenSidebar={() => setShowSidebar(true)} />
          <LanguageToggle floating />

          {/* Floating AI button */}
          <button
            onClick={() => setShowAI(true)}
            className="fixed bottom-4 right-4 lg:bottom-6 lg:right-6 z-40 w-12 h-12 lg:w-14 lg:h-14 rounded-2xl gradient-aura glow-pulse hover:scale-110 active:scale-95 transition-all duration-300 flex items-center justify-center shadow-2xl animate-float"
            title={t('ai.menu_label')}
          >
            <Sparkles className="w-5 h-5 lg:w-6 lg:h-6 text-white animate-sparkle" />
          </button>

          {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
          <AIAssistant open={showAI} onClose={() => setShowAI(false)} />
          <StoryViewer />
          <StoryComposer />
        </div>
      </StoriesProvider>
    </ChatProvider>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <ThemeProvider>
        <AuthProvider>
          <AppShell />
        </AuthProvider>
      </ThemeProvider>
    </LanguageProvider>
  );
}
