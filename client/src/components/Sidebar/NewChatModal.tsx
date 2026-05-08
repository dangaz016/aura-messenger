import { useState, useEffect } from 'react';
import { X, Search, MessageCircle, Users, Hash, Check } from 'lucide-react';
import { User } from '../../types';
import { api } from '../../services/api';
import { useChat } from '../../contexts/ChatContext';
import { Avatar } from '../Common/Avatar';

interface NewChatModalProps {
  mode: 'chat' | 'space';
  onClose: () => void;
}

export function NewChatModal({ mode, onClose }: NewChatModalProps) {
  const { createDirectChat, createGroupChat, createSpace, setActiveChatId } = useChat();
  const [type, setType] = useState<'direct' | 'group' | 'space'>(mode === 'space' ? 'space' : 'direct');
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [selected, setSelected] = useState<User[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (type === 'space') return;
    const t = setTimeout(async () => {
      if (search.trim().length < 1) {
        setUsers([]);
        return;
      }
      try {
        const res = await api.searchUsers(search);
        setUsers(res);
      } catch {}
    }, 200);
    return () => clearTimeout(t);
  }, [search, type]);

  function toggleUser(user: User) {
    if (type === 'direct') {
      setSelected([user]);
    } else {
      setSelected(prev => prev.find(u => u.id === user.id)
        ? prev.filter(u => u.id !== user.id)
        : [...prev, user]);
    }
  }

  async function handleCreate() {
    setError('');
    setLoading(true);
    try {
      let chat;
      if (type === 'direct') {
        if (selected.length !== 1) throw new Error('Pick a user');
        chat = await createDirectChat(selected[0].id);
      } else if (type === 'group') {
        if (!name.trim()) throw new Error('Name is required');
        if (selected.length === 0) throw new Error('Add at least one member');
        chat = await createGroupChat(name, selected.map(u => u.id), description);
      } else {
        if (!name.trim()) throw new Error('Name is required');
        chat = await createSpace(name, description);
      }
      setActiveChatId(chat.id);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message
        : (err && typeof err === 'object' && 'response' in err
          ? ((err.response as { data?: { error?: string } })?.data?.error || 'Failed to create')
          : 'Failed to create');
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  const canCreate = type === 'direct' ? selected.length === 1
    : type === 'group' ? name.trim().length > 0 && selected.length > 0
    : name.trim().length > 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="card w-full max-w-md p-6 animate-slide-up">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">
            {type === 'direct' ? 'New chat' : type === 'group' ? 'New group' : 'New space'}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-aura-elevated rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {mode !== 'space' && (
          <div className="grid grid-cols-3 gap-2 mb-4">
            <TypeButton active={type === 'direct'} onClick={() => { setType('direct'); setSelected([]); }}
              icon={<MessageCircle className="w-4 h-4" />} label="Direct" />
            <TypeButton active={type === 'group'} onClick={() => { setType('group'); setSelected([]); }}
              icon={<Users className="w-4 h-4" />} label="Group" />
            <TypeButton active={type === 'space'} onClick={() => { setType('space'); setSelected([]); }}
              icon={<Hash className="w-4 h-4" />} label="Space" />
          </div>
        )}

        {(type === 'group' || type === 'space') && (
          <div className="space-y-3 mb-3">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={type === 'space' ? 'Space name' : 'Group name'}
              className="input-aura w-full"
              maxLength={50}
            />
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description (optional)"
              className="input-aura w-full"
              maxLength={200}
            />
          </div>
        )}

        {type !== 'space' && (
          <>
            {selected.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {selected.map(u => (
                  <button
                    key={u.id}
                    onClick={() => toggleUser(u)}
                    className="flex items-center gap-1.5 bg-aura-primary-dim px-2 py-1 rounded-full text-xs hover:bg-aura-primary/30"
                  >
                    {u.displayName}
                    <X className="w-3 h-3" />
                  </button>
                ))}
              </div>
            )}

            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-aura-text-muted" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search users by name..."
                className="input-aura w-full pl-10"
                autoFocus
              />
            </div>

            <div className="max-h-60 overflow-y-auto -mx-2 mb-3">
              {users.length === 0 && search.length > 0 && (
                <div className="text-center text-aura-text-muted text-sm py-4">No users found</div>
              )}
              {users.map(u => {
                const isSelected = selected.find(s => s.id === u.id);
                return (
                  <button
                    key={u.id}
                    onClick={() => toggleUser(u)}
                    className="w-full flex items-center gap-3 px-3 py-2 hover:bg-aura-elevated rounded-lg transition-colors"
                  >
                    <Avatar name={u.displayName} color={u.avatarColor} size={36} showStatus={false} />
                    <div className="flex-1 text-left min-w-0">
                      <div className="font-medium text-sm truncate">{u.displayName}</div>
                      <div className="text-xs text-aura-text-dim">@{u.username}</div>
                    </div>
                    {isSelected && (
                      <div className="w-5 h-5 rounded-full bg-aura-primary flex items-center justify-center">
                        <Check className="w-3 h-3" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </>
        )}

        {error && (
          <div className="px-3 py-2 mb-3 rounded-lg bg-aura-dnd/10 border border-aura-dnd/30 text-aura-dnd text-sm">
            {error}
          </div>
        )}

        <div className="flex gap-2">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button
            onClick={handleCreate}
            disabled={!canCreate || loading}
            className="btn-primary flex-1 disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}

function TypeButton({ active, onClick, icon, label }: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1 py-3 rounded-lg transition-colors ${
        active ? 'bg-aura-primary-dim text-aura-primary-light border border-aura-primary/30'
               : 'bg-aura-surface2 hover:bg-aura-elevated border border-aura-border'
      }`}
    >
      {icon}
      <span className="text-xs font-medium">{label}</span>
    </button>
  );
}
