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
        <div className="h-screen flex overflow-hidden">
          <Sidebar
            onOpenSettings={() => setShowSettings(true)}
            onOpenAI={() => setShowAI(true)}
            view={view}
            setView={setView}
          />
          <ChatWindow />
          <LanguageToggle floating />

          {/* Floating AI button */}
          <button
            onClick={() => setShowAI(true)}
            className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-2xl gradient-aura glow-primary hover:scale-110 transition-transform flex items-center justify-center shadow-2xl"
            title={t('ai.menu_label')}
          >
            <Sparkles className="w-6 h-6 text-white" />
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
