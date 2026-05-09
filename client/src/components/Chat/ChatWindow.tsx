import { useEffect, useMemo, useState } from 'react';
import { Phone, Video, MoreVertical, Hash, Users, ShieldCheck, Menu, Radio, ArrowLeft, X } from 'lucide-react';
import { useChat } from '../../contexts/ChatContext';
import { useAuth } from '../../contexts/AuthContext';
import { useT } from '../../contexts/LanguageContext';
import { Avatar } from '../Common/Avatar';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { ChatInfoPanel } from './ChatInfoPanel';
import { formatLastSeen } from '../../utils/formatters';

interface ChatWindowProps {
  onOpenSidebar?: () => void;
  onCloseSidebar?: () => void;
}

function isBirthdayToday(birthday?: string | null): boolean {
  if (!birthday) return false;
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return birthday === `${mm}-${dd}`;
}

export function ChatWindow({ onOpenSidebar, onCloseSidebar }: ChatWindowProps) {
  const { user } = useAuth();
  const { chats, activeChatId, setActiveChatId, loadMessages, userStatuses, typingUsers } = useChat();
  const { t, lang } = useT();
  const [bdDismissed, setBdDismissed] = useState(false);
  const [infoPanelOpen, setInfoPanelOpen] = useState(false);

  const activeChat = useMemo(() => chats.find(c => c.id === activeChatId), [chats, activeChatId]);

  useEffect(() => {
    if (activeChatId) loadMessages(activeChatId);
  }, [activeChatId, loadMessages]);

  // Check birthday dismissal whenever chat changes
  useEffect(() => {
    if (activeChat?.otherUser?.id) {
      const key = `aura_bday_${activeChat.otherUser.id}_${new Date().toDateString()}`;
      setBdDismissed(!!localStorage.getItem(key));
    } else {
      setBdDismissed(false);
    }
  }, [activeChat?.otherUser?.id]);

  // Welcome screen (no chat selected)
  if (!activeChat) {
    return (
      <div className="flex-1 flex flex-col bg-aura-bg gradient-bg min-w-0">
        {/* Mobile header */}
        <header className="lg:hidden h-14 border-b border-aura-border flex items-center px-4 bg-aura-surface/60 backdrop-blur-md flex-shrink-0">
          <button
            onClick={onOpenSidebar}
            className="p-2 -ml-2 hover:bg-aura-elevated rounded-lg mr-2"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="font-bold text-lg gradient-text bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
            Aura
          </div>
        </header>

        <div className="flex-1 flex items-center justify-center px-6">
          <div className="text-center max-w-md">
            <div className="inline-flex items-center justify-center w-24 h-24 rounded-3xl gradient-aura glow-primary mb-6">
              <ShieldCheck className="w-12 h-12 text-white" strokeWidth={2} />
            </div>
            <h2 className="text-2xl font-bold mb-2">{t('chatwindow.welcome_title')}</h2>
            <p className="text-aura-text-dim mb-6">{t('chatwindow.welcome_text')}</p>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="card p-3">
                <div className="font-medium mb-1">{t('chatwindow.feature_modes_title')}</div>
                <div className="text-aura-text-dim text-xs">{t('chatwindow.feature_modes_desc')}</div>
              </div>
              <div className="card p-3">
                <div className="font-medium mb-1">{t('chatwindow.feature_echo_title')}</div>
                <div className="text-aura-text-dim text-xs">{t('chatwindow.feature_echo_desc')}</div>
              </div>
              <div className="card p-3">
                <div className="font-medium mb-1">{t('chatwindow.feature_spaces_title')}</div>
                <div className="text-aura-text-dim text-xs">{t('chatwindow.feature_spaces_desc')}</div>
              </div>
              <div className="card p-3">
                <div className="font-medium mb-1">{t('chatwindow.feature_mood_title')}</div>
                <div className="text-aura-text-dim text-xs">{t('chatwindow.feature_mood_desc')}</div>
              </div>
            </div>
            {/* Mobile prompt */}
            <button
              onClick={onOpenSidebar}
              className="mt-6 lg:hidden btn-primary flex items-center gap-2 mx-auto"
            >
              <Menu className="w-4 h-4" />
              {t('sidebar.chats')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const otherUserStatus = activeChat.otherUser ? userStatuses.get(activeChat.otherUser.id) : undefined;
  const isOnline = activeChat.type === 'direct' && (otherUserStatus?.isOnline ?? false);
  const auraMode = activeChat.type === 'direct' ? otherUserStatus?.auraMode ?? activeChat.otherUser?.auraMode : undefined;
  const lastSeen = activeChat.otherUser?.lastSeen || 0;

  const typingSet = typingUsers.get(activeChat.id) || new Set();
  const typingNames = Array.from(typingSet)
    .map(uid => activeChat.members.find(m => m.id === uid)?.displayName)
    .filter(Boolean) as string[];

  let subtitle = '';
  if (activeChat.type === 'direct') {
    if (typingNames.length > 0) subtitle = t('chatwindow.typing');
    else if (auraMode === 'ghost' && !isOnline) subtitle = t('chatwindow.last_seen_recently');
    else subtitle = formatLastSeen(lastSeen, isOnline, lang);
  } else if (activeChat.type === 'group') {
    subtitle = typingNames.length > 0
      ? `${typingNames.join(', ')} ${t('chatwindow.typing')}`
      : `${activeChat.members.length} ${t('chatwindow.members')}`;
  } else if (activeChat.type === 'channel') {
    subtitle = `${activeChat.subscriberCount ?? activeChat.members.length} подписчиков`;
  } else {
    subtitle = activeChat.description || `${activeChat.members.length} ${t('chatwindow.members')}`;
  }

  function handleBack() {
    setActiveChatId(null);
    onOpenSidebar?.();
  }

  const showBdBanner = activeChat.type === 'direct'
    && isBirthdayToday(activeChat.otherUser?.birthday)
    && !bdDismissed;

  function dismissBdBanner() {
    const uid = activeChat?.otherUser?.id;
    if (uid) {
      localStorage.setItem(`aura_bday_${uid}_${new Date().toDateString()}`, '1');
    }
    setBdDismissed(true);
  }

  return (
    <div className="flex-1 flex flex-col bg-aura-bg min-w-0">
      <header className="h-14 border-b border-aura-border flex items-center justify-between px-3 bg-aura-surface/40 backdrop-blur-md flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          {/* Mobile back button */}
          <button
            onClick={handleBack}
            className="lg:hidden p-2 -ml-1 hover:bg-aura-elevated rounded-lg flex-shrink-0"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          {/* Clickable header area */}
          <button
            onClick={() => setInfoPanelOpen(true)}
            className="flex items-center gap-2 min-w-0 hover:bg-aura-elevated rounded-lg px-1 py-1 -ml-1 transition-colors flex-1"
          >
            {activeChat.type === 'space' ? (
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white flex-shrink-0"
                style={{ background: `linear-gradient(135deg, ${activeChat.avatarColor} 0%, ${activeChat.avatarColor}cc 100%)` }}>
                <Hash className="w-4 h-4" />
              </div>
            ) : activeChat.type === 'channel' ? (
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white flex-shrink-0"
                style={{ background: `linear-gradient(135deg, ${activeChat.avatarColor} 0%, ${activeChat.avatarColor}cc 100%)` }}>
                <Radio className="w-4 h-4" />
              </div>
            ) : activeChat.type === 'group' ? (
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-white flex-shrink-0"
                style={{ background: `linear-gradient(135deg, ${activeChat.avatarColor} 0%, ${activeChat.avatarColor}cc 100%)` }}>
                <Users className="w-4 h-4" />
              </div>
            ) : (
              <Avatar
                name={activeChat.name || '?'}
                color={activeChat.avatarColor}
                imageUrl={activeChat.otherUser?.avatarUrl ?? undefined}
                size={36}
                isOnline={isOnline}
                auraMode={auraMode}
              />
            )}

            <div className="min-w-0 text-left">
              <div className="font-semibold text-sm truncate flex items-center gap-1.5">
                {activeChat.name}
                {activeChat.type === 'direct' && activeChat.otherUser?.publicKey && (
                  <ShieldCheck className="w-3.5 h-3.5 text-aura-primary-light flex-shrink-0" />
                )}
              </div>
              <div className={`text-xs truncate ${typingNames.length > 0 ? 'text-aura-primary-light' : 'text-aura-text-dim'}`}>
                {subtitle}
              </div>
            </div>
          </button>
        </div>

        <div className="flex items-center gap-0.5 flex-shrink-0">
          {activeChat.type === 'direct' && (
            <>
              <IconBtn icon={<Phone className="w-4 h-4" />} title={t('chatwindow.voice_call')} />
              <IconBtn icon={<Video className="w-4 h-4" />} title={t('chatwindow.video_call')} />
            </>
          )}
          <IconBtn icon={<MoreVertical className="w-4 h-4" />} title={t('chatwindow.more')} />
        </div>
      </header>

      {/* Birthday banner */}
      {showBdBanner && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-gradient-to-r from-pink-600/20 via-rose-500/15 to-purple-600/20 border-b border-pink-500/30 flex-shrink-0">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-xl flex-shrink-0">🎂</span>
            <p className="text-sm font-medium text-pink-300 truncate">
              {lang === 'ru'
                ? `Сегодня день рождения у ${activeChat.name}!`
                : `Today is ${activeChat.name}'s birthday!`}
            </p>
            <span className="text-base flex-shrink-0">🎉</span>
          </div>
          <button
            onClick={dismissBdBanner}
            className="p-1 rounded-md hover:bg-white/10 text-pink-300/70 hover:text-pink-200 transition-colors flex-shrink-0"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <MessageList chatId={activeChat.id} />
      <MessageInput chatId={activeChat.id} chatType={activeChat.type} />

      {/* Info Panel */}
      {user && (
        <ChatInfoPanel
          chat={activeChat}
          currentUserId={user.id}
          isOpen={infoPanelOpen}
          onClose={() => setInfoPanelOpen(false)}
        />
      )}
    </div>
  );
}

function IconBtn({ icon, title, onClick }: { icon: React.ReactNode; title: string; onClick?: () => void }) {
  return (
    <button onClick={onClick} title={title}
      className="p-2 rounded-lg hover:bg-aura-elevated text-aura-text-dim hover:text-aura-text transition-colors">
      {icon}
    </button>
  );
}
