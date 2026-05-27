import { useState, useEffect } from 'react';
import { UserPlus, Search, User, MessageCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useChat } from '../../contexts/ChatContext';
import { useT } from '../../contexts/LanguageContext';
import { api } from '../../services/api';
import { Avatar } from '../Common/Avatar';
import { PrimeBadge } from '../Common/PrimeBadge';

export function ContactsList() {
  const { user } = useAuth();
  const { createDirectChat, setActiveChatId } = useChat();
  const { t } = useT();
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchUsers() {
      try {
        setLoading(true);
        const response = await api.searchUsers(search);
        setUsers(response);
        setError(null);
      } catch (err) {
        setError('Failed to load contacts');
        console.error('Failed to fetch users:', err);
      } finally {
        setLoading(false);
      }
    }
    
    const timer = setTimeout(() => {
      fetchUsers();
    }, 300);
    
    return () => clearTimeout(timer);
  }, [search]);

  async function handleStartChat(userId: string) {
    const chat = await createDirectChat(userId);
    setActiveChatId(chat.id);
  }

  return (
    <div className="p-3">
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-aura-text-muted" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('sidebar.search_chats')}
          className="input-aura w-full pl-10 py-2 text-sm"
        />
      </div>

      {loading ? (
        <div className="p-6 text-center text-aura-text-muted text-sm">
          Loading contacts...
        </div>
      ) : error ? (
        <div className="p-6 text-center text-aura-text-muted text-sm">
          {error}
        </div>
      ) : users.length === 0 ? (
        <div className="p-6 text-center text-aura-text-muted text-sm">
          No contacts found
        </div>
      ) : (
        <div className="space-y-2">
          {users.map(u => (
            <div key={u.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-aura-elevated transition-colors">
              <Avatar
                name={u.displayName}
                color={u.avatarColor}
                imageUrl={u.avatarUrl}
                size={40}
                isOnline={!!u.lastSeen && Date.now() / 1000 - u.lastSeen < 300}
                auraMode={u.auraMode}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium truncate">{u.displayName}</span>
                  {u.isPrime && <PrimeBadge user={u} size="sm" />}
                </div>
                <div className="text-xs text-aura-text-muted truncate">
                  @{u.username}
                </div>
              </div>
              <button
                onClick={() => handleStartChat(u.id)}
                className="p-2 rounded-lg hover:bg-aura-primary-dim text-aura-primary-light transition-colors"
                title="Start chat"
              >
                <MessageCircle className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}