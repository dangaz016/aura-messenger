import { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ChatProvider } from './contexts/ChatContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { LanguageProvider, useT } from './contexts/LanguageContext';
import { LoginPage } from './components/Auth/LoginPage';
import { Sidebar } from './components/Sidebar/Sidebar';
import { ChatWindow } from './components/Chat/ChatWindow';
import { SettingsPanel } from './components/Settings/SettingsPanel';
import { LanguageToggle } from './components/Common/LanguageToggle';

function AppShell() {
  const { user, loading } = useAuth();
  const { t } = useT();
  const [showSettings, setShowSettings] = useState(false);
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
      <div className="h-screen flex overflow-hidden">
        <Sidebar onOpenSettings={() => setShowSettings(true)} view={view} setView={setView} />
        <ChatWindow />
        <LanguageToggle floating />
        {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
      </div>
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
