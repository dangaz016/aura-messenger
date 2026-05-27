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
import { Sparkles, Bell, X, Shield } from 'lucide-react';
import { AdminPanel } from './components/Admin/AdminPanel';
import { BannedScreen } from './components/Common/BannedScreen';
import { FrozenBanner } from './components/Common/FrozenBanner';
import { useCall } from './hooks/useCall';
import { IncomingCallModal } from './components/Call/IncomingCallModal';
import { ActiveCallModal } from './components/Call/ActiveCallModal';
import { LaunchScreen } from './components/Common/LaunchScreen';

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
  const { user, loading, isBanned, banReason, isFrozen, freezeUntil, freezeReason } = useAuth();
  const { t } = useT();
  const [showSettings, setShowSettings] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [view, setView] = useState<'chats' | 'spaces' | 'contacts'>('chats');
  const [showSidebar, setShowSidebar] = useState(false);

  // Call management
  const call = useCall();

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
    return <LaunchScreen />;
  }

  if (!user) {
    return (
      <>
        <LoginPage />
      </>
    );
  }

  // Full-screen ban overlay — nothing else is accessible
  if (isBanned) {
    return <BannedScreen reason={banReason} />;
  }

  return (
    <ChatProvider>
      <ToastProvider>
        <StoriesProvider>
          <StoriesEventBridge />
          <AnimatedBackground />
          <div className="h-screen flex flex-col overflow-hidden relative z-10">
            <NotificationBanner />
            {isFrozen && freezeUntil > Math.floor(Date.now() / 1000) && (
              <FrozenBanner freezeUntil={freezeUntil} reason={freezeReason} />
            )}
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
              onStartCall={call.startCall}
            />

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

            {/* Voice Call Modals */}
            {call.callState === 'ringing' && call.isIncoming && call.remoteUserId && call.remoteUserName && (
              <IncomingCallModal
                callerName={call.remoteUserName}
                callerId={call.remoteUserId}
                hasVideo={call.isVideoEnabled}
                onAccept={call.acceptCall}
                onDecline={call.rejectCall}
              />
            )}

            {(call.callState === 'calling' || call.callState === 'connected') && call.remoteUserId && call.remoteUserName && (
              <ActiveCallModal
                userName={call.remoteUserName}
                userId={call.remoteUserId}
                duration={call.callDuration}
                isMuted={call.isMuted}
                isVideoEnabled={call.isVideoEnabled}
                onMuteToggle={call.toggleMute}
                onVideoToggle={call.toggleVideo}
                onEndCall={call.endCall}
                isConnected={call.callState === 'connected'}
              />
            )}
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
