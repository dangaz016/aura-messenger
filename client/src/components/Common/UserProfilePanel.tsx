import { useEffect, useState } from 'react';
import { X, MessageCircle, ShieldCheck, Phone, Video } from 'lucide-react';
import { User } from '../../types';
import { Avatar } from './Avatar';

interface UserProfilePanelProps {
  userId: string;
  onClose: () => void;
  onStartChat?: (userId: string) => void;
}

export function UserProfilePanel({ userId, onClose, onStartChat }: UserProfilePanelProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    loadUser();
  }, [userId]);

  async function loadUser() {
    setLoading(true);
    setError(false);
    try {
      const token = localStorage.getItem('aura_token');
      const res = await fetch(`/api/users/profile/${userId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data);
      } else {
        setError(true);
      }
    } catch (err) {
      console.error('Failed to load user profile', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  function handleStartChat() {
    if (onStartChat && user) {
      onStartChat(user.id);
      onClose();
    }
  }

  const auraModeLabels: Record<string, { label: string; color: string }> = {
    available: { label: 'Доступен', color: 'text-aura-online' },
    ghost: { label: 'Призрак', color: 'text-aura-ghost' },
    dnd: { label: 'Не беспокоить', color: 'text-aura-dnd' },
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-aura-elevated border border-aura-border rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-aura-border bg-aura-surface/50">
          <h3 className="font-semibold">Профиль</h3>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-aura-surface2 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {loading && (
            <div className="text-center text-aura-text-dim py-8">Загрузка...</div>
          )}
          {error && (
            <div className="text-center text-aura-text-dim py-8">
              <div className="mb-2">Не удалось загрузить профиль</div>
              <button onClick={loadUser} className="text-sm text-aura-primary hover:underline">
                Повторить
              </button>
            </div>
          )}
          {user && (
            <div className="space-y-4">
              {/* Avatar */}
              <div className="flex flex-col items-center">
                <Avatar
                  name={user.displayName}
                  color={user.avatarColor}
                  imageUrl={user.avatarUrl ?? undefined}
                  size={96}
                  isOnline={user.auraMode === 'available'}
                  auraMode={user.auraMode}
                />
                <h2 className="mt-3 text-xl font-bold flex items-center gap-2">
                  {user.displayName}
                  {user.publicKey && (
                    <span title="Публичный ключ настроен">
                      <ShieldCheck className="w-5 h-5 text-aura-primary-light" />
                    </span>
                  )}
                </h2>
                <p className="text-sm text-aura-text-muted">@{user.username}</p>
              </div>

              {/* Aura mode badge */}
              <div className="flex justify-center">
                <div
                  className={`px-3 py-1 rounded-full text-xs font-medium ${auraModeLabels[user.auraMode]?.color || 'text-aura-text-muted'} bg-aura-surface2`}
                >
                  {auraModeLabels[user.auraMode]?.label || user.auraMode}
                </div>
              </div>

              {/* Mood */}
              {(user.moodEmoji || user.moodText) && (
                <div className="card p-3">
                  <div className="text-xs text-aura-text-muted mb-1 font-medium">Настроение</div>
                  <div className="flex items-center gap-2">
                    {user.moodEmoji && <span className="text-2xl">{user.moodEmoji}</span>}
                    {user.moodText && <span className="text-sm">{user.moodText}</span>}
                  </div>
                </div>
              )}

              {/* Bio */}
              {user.bio && (
                <div className="card p-3">
                  <div className="text-xs text-aura-text-muted mb-1 font-medium">О себе</div>
                  <p className="text-sm whitespace-pre-wrap break-words">{user.bio}</p>
                </div>
              )}

              {/* Birthday (if today) */}
              {user.birthday && (
                <div className="card p-3">
                  <div className="text-xs text-aura-text-muted mb-1 font-medium">День рождения</div>
                  <p className="text-sm flex items-center gap-2">
                    🎂 {user.birthday}
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                {onStartChat && (
                  <button
                    onClick={handleStartChat}
                    className="flex-1 btn-primary flex items-center justify-center gap-2"
                  >
                    <MessageCircle className="w-4 h-4" />
                    Написать
                  </button>
                )}
                <button className="p-3 rounded-lg bg-aura-surface2 hover:bg-aura-elevated transition-colors">
                  <Phone className="w-5 h-5" />
                </button>
                <button className="p-3 rounded-lg bg-aura-surface2 hover:bg-aura-elevated transition-colors">
                  <Video className="w-5 h-5" />
                </button>
              </div>

              {/* Close button */}
              <button onClick={onClose} className="w-full btn-secondary">
                Закрыть
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
