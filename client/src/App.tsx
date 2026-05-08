import { useState, useEffect, useCallback } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ChatProvider } from './contexts/ChatContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { LanguageProvider, useT } from './contexts/LanguageContext';
import { StoriesProvider, useStories } from './contexts/StoriesContext';
import { ToastProvider } from './contexts/ToastContext';
import { ToastContainer } from './components/Common/Toast';
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
import { Sparkles, Bot, Bell, X, Shield } from 'lucide-react';
import { AdminPanel } from './components/Admin/AdminPanel';

// Telegram-style notification permission banner
function NotificationBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'default') return;
    if (sessionStorage.getItem('aura_notif_dismissed')) return;
    setShow(true);
  }, []);

  if (!show) return null;

  function dismiss() {
    sessionStorage.setItem('aura_notif_dismissed', '1');
    setShow(false);
  }

  async function handleEnable() {
    const perm = await Notification.requestPermission();
    if (perm !== 'default') dismiss();
  }

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-aura-surface border-b border-aura-border flex-shrink-0 z-30">
      <Bell className="w-4 h-4 text-aura-primary-light flex-shrink-0" />
      <p className="flex-1 text-sm text-aura-text-dim min-w-0 truncate">
        Включить уведомления, чтобы не пропускать сообщения
      </p>
      <button
        onClick={handleEnable}
        className="text-sm font-semibold text-aura-primary-light hover:text-aura-primary whitespace-nowrap transition-colors px-2 py-1 rounded hover:bg-aura-primary/10"
      >
        Включить
      </button>
      <button
        onClick={dismiss}
        className="p-1 rounded hover:bg-aura-elevated text-aura-text-muted hover:text-aura-text transition-colors flex-shrink-0"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

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

// Block browser right-click menu globally (allow on inputs)
function GlobalContextMenuBlocker() {
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
      e.preventDefault();
    };
    document.addEventListener('contextmenu', handler);
    return () => document.removeEventListener('contextmenu', handler);
  }, []);
  return null;
}

function AppShell() {
  const { user, loading } = useAuth();
  const { t } = useT();
  const [showSettings, setShowSettings] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [view, setView] = useState<'chats' | 'spaces'>('chats');
  const [showSidebar, setShowSidebar] = useState(false);

  // On mobile: auto-open sidebar initially
  useEffect(() => {
    const isMobile = window.innerWidth < 1024;
    if (isMobile) setShowSidebar(true);
  }, []);

  const handleCloseMobile = useCallback(() => setShowSidebar(false), []);

  useEffect(() => {
    if (user) registerServiceWorker();
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center gradient-bg">
        <LanguageToggle floating />
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl gradient-aura animate-pulse-soft flex items-center justify-center">
            <Sparkles className="w-8 h-8 text-white animate-sparkle" />
          </div>
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
      <ToastProvider>
        <StoriesProvider>
          <StoriesEventBridge />
          <AnimatedBackground />
          <div className="h-screen flex flex-col overflow-hidden relative z-10">
            <NotificationBanner />
            <div className="flex flex-1 overflow-hidden">
            <Sidebar
              onOpenSettings={() => setShowSettings(true)}
              onOpenAI={() => setShowAI(true)}
              view={view}
              setView={setView}
              showMobile={showSidebar}
              onCloseMobile={handleCloseMobile}
            />

            <ChatWindow
              onOpenSidebar={() => setShowSidebar(true)}
              onCloseSidebar={handleCloseMobile}
            />

            <LanguageToggle floating />

            {/* Floating AI button — beautiful, stands out */}
            <button
              onClick={() => setShowAI(true)}
              className="
                fixed bottom-24 right-4
                lg:bottom-6 lg:right-auto lg:left-[14.5rem]
                z-40
                group flex items-center gap-2
                bg-gradient-to-br from-violet-600 via-purple-500 to-fuchsia-500
                hover:from-violet-500 hover:via-purple-400 hover:to-fuchsia-400
                text-white
                px-3 py-3 lg:px-4 lg:py-2.5
                rounded-2xl
                shadow-lg shadow-purple-500/40
                hover:shadow-purple-500/60 hover:scale-105
                active:scale-95
                transition-all duration-200
                border border-white/10
              "
              title={t('ai.menu_label')}
            >
              <Bot className="w-5 h-5 flex-shrink-0" />
              <span className="hidden lg:block text-sm font-semibold whitespace-nowrap">Aura AI</span>
              {/* Glow orb */}
              <span className="absolute inset-0 rounded-2xl bg-gradient-to-br from-violet-400/20 to-fuchsia-400/20 blur-md -z-10 group-hover:blur-lg transition-all" />
            </button>

            {/* Admin button — only for admin users */}
            {user?.isAdmin && (
              <button
                onClick={() => setShowAdmin(true)}
                className="fixed bottom-24 right-20 lg:bottom-6 lg:right-6 z-40 w-11 h-11 rounded-2xl bg-aura-dnd/80 hover:bg-aura-dnd text-white flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all"
                title="Admin Panel"
              >
                <Shield className="w-5 h-5" />
              </button>
            )}

            {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
            {showAdmin && <AdminPanel onClose={() => setShowAdmin(false)} />}
            <AIAssistant open={showAI} onClose={() => setShowAI(false)} />
            <StoryViewer />
            <StoryComposer />
            <ToastContainer />
            </div>
          </div>
        </StoriesProvider>
      </ToastProvider>
    </ChatProvider>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <ThemeProvider>
        <AuthProvider>
          <GlobalContextMenuBlocker />
          <AppShell />
        </AuthProvider>
      </ThemeProvider>
    </LanguageProvider>
  );
}
