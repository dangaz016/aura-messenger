import { useState, useMemo } from 'react';
import { Search, Plus, Settings, Compass, MessageCircle, Hash } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useChat } from '../../contexts/ChatContext';
import { useT } from '../../contexts/LanguageContext';
import { Avatar } from '../Common/Avatar';
import { ChatItem } from './ChatItem';
import { NewChatModal } from './NewChatModal';

interface SidebarProps {
  onOpenSettings: () => void;
  view: 'chats' | 'spaces';
  setView: (v: 'chats' | 'spaces') => void;
}

export function Sidebar({ onOpenSettings, view, setView }: SidebarProps) {
  const { user } = useAuth();
  const { chats, activeChatId, setActiveChatId, userStatuses } = useChat();
  const { t } = useT();
  const [search, setSearch] = useState('');
  const [showNewChat, setShowNewChat] = useState(false);

  const filteredChats = useMemo(() => {
    const list = chats.filter(c => view === 'spaces' ? c.type === 'space' : c.type !== 'space');
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(c => (c.name || '').toLowerCase().includes(q));
  }, [chats, search, view]);

  const totalUnread = chats.filter(c => c.type !== 'space').reduce((sum, c) => sum + c.unreadCount, 0);
  const totalSpaceUnread = chats.filter(c => c.type === 'space').reduce((sum, c) => sum + c.unreadCount, 0);

  return (
    <>
      <aside className="w-80 bg-aura-surface border-r border-aura-border flex flex-col h-full">
        <div className="p-4 border-b border-aura-border flex items-center gap-3">
          <button
            onClick={onOpenSettings}
            className="hover:opacity-80 transition-opacity"
            title={t('sidebar.open_settings')}
          >
            {user && (
              <Avatar
                name={user.displayName}
                color={user.avatarColor}
                size={40}
                isOnline={true}
                auraMode={user.auraMode}
              />
            )}
          </button>

          <div className="flex-1 min-w-0">
            <div className="font-semibold truncate">{user?.displayName}</div>
            <div className="text-xs text-aura-text-dim flex items-center gap-1 truncate">
              <span>{user?.moodEmoji}</span>
              <span className="truncate">{user?.moodText}</span>
            </div>
          </div>

          <button
            onClick={onOpenSettings}
            className="p-2 rounded-lg hover:bg-aura-elevated transition-colors text-aura-text-dim hover:text-aura-text"
            title={t('sidebar.settings')}
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>

        <div className="px-3 pt-3 pb-2 flex gap-1">
          <TabButton
            active={view === 'chats'}
            onClick={() => setView('chats')}
            icon={<MessageCircle className="w-4 h-4" />}
            label={t('sidebar.chats')}
            badge={totalUnread}
          />
          <TabButton
            active={view === 'spaces'}
            onClick={() => setView('spaces')}
            icon={<Compass className="w-4 h-4" />}
            label={t('sidebar.spaces')}
            badge={totalSpaceUnread}
          />
        </div>

        <div className="px-3 pb-3 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-aura-text-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={view === 'spaces' ? t('sidebar.search_spaces') : t('sidebar.search_chats')}
              className="input-aura w-full pl-10 py-2 text-sm"
            />
          </div>
          <button
            onClick={() => setShowNewChat(true)}
            className="bg-aura-primary hover:bg-aura-primary-light transition-colors p-2 rounded-lg"
            title={view === 'spaces' ? t('sidebar.create_space') : t('sidebar.new_chat')}
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filteredChats.length === 0 ? (
            <div className="p-6 text-center text-aura-text-muted text-sm">
              {view === 'spaces' ? (
                <>
                  <Hash className="w-12 h-12 mx-auto mb-2 opacity-40" />
                  <div>{t('sidebar.no_spaces')}</div>
                  <div className="text-xs mt-1">{t('sidebar.no_spaces_hint')}</div>
                </>
              ) : (
                <>
                  <MessageCircle className="w-12 h-12 mx-auto mb-2 opacity-40" />
                  <div>{t('sidebar.no_chats')}</div>
                  <div className="text-xs mt-1">{t('sidebar.no_chats_hint')}</div>
                </>
              )}
            </div>
          ) : (
            filteredChats.map(chat => (
              <ChatItem
                key={chat.id}
                chat={chat}
                active={chat.id === activeChatId}
                onClick={() => setActiveChatId(chat.id)}
                userStatus={chat.otherUser ? userStatuses.get(chat.otherUser.id) : undefined}
              />
            ))
          )}
        </div>
      </aside>

      {showNewChat && (
        <NewChatModal mode={view === 'spaces' ? 'space' : 'chat'} onClose={() => setShowNewChat(false)} />
      )}
    </>
  );
}

function TabButton({ active, onClick, icon, label, badge }: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  badge?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg transition-colors text-sm font-medium ${
        active ? 'bg-aura-primary-dim text-aura-primary-light' : 'text-aura-text-dim hover:text-aura-text hover:bg-aura-elevated'
      }`}
    >
      {icon}
      {label}
      {badge && badge > 0 ? (
        <span className="bg-aura-primary text-white text-xs rounded-full px-1.5 py-0.5 ml-1">{badge}</span>
      ) : null}
    </button>
  );
}
