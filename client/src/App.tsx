import { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ChatProvider } from './contexts/ChatContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { LoginPage } from './components/Auth/LoginPage';
import { Sidebar } from './components/Sidebar/Sidebar';
import { ChatWindow } from './components/Chat/ChatWindow';
import { SettingsPanel } from './components/Settings/SettingsPanel';

function AppShell() {
  const { user, loading } = useAuth();
  const [showSettings, setShowSettings] = useState(false);
  const [view, setView] = useState<'chats' | 'spaces'>('chats');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center gradient-bg">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-3 rounded-2xl gradient-aura animate-pulse-soft" />
          <div className="text-aura-text-dim text-sm">Loading Aura...</div>
        </div>
      </div>
    );
  }

  if (!user) return <LoginPage />;

  return (
    <ChatProvider>
      <div className="h-screen flex overflow-hidden">
        <Sidebar onOpenSettings={() => setShowSettings(true)} view={view} setView={setView} />
        <ChatWindow />
        {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
      </div>
    </ChatProvider>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppShell />
      </AuthProvider>
    </ThemeProvider>
  );
}
