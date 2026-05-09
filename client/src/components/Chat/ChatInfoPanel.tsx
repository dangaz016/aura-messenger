import { useState, useEffect } from 'react';
import { X, Image as ImageIcon, FileText, Users, Trash2, LogOut, Ban, Hash, Radio } from 'lucide-react';
import { Chat, ChatMember } from '../../types';
import { Avatar } from '../Common/Avatar';
import { MediaLightbox } from '../Common/MediaLightbox';
import { api } from '../../services/api';

interface MediaItem {
  id: string;
  type: 'image' | 'video' | 'voice';
  file_id: string;
  file_name: string | null;
  file_mime: string | null;
  created_at: number;
  sender_name: string;
}

interface ChatInfoPanelProps {
  chat: Chat;
  currentUserId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ChatInfoPanel({ chat, currentUserId, isOpen, onClose }: ChatInfoPanelProps) {
  const [activeTab, setActiveTab] = useState<'media' | 'files' | 'members'>('media');
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && activeTab === 'media') {
      loadMedia();
    }
  }, [isOpen, activeTab, chat.id]);

  async function loadMedia() {
    setLoading(true);
    try {
      const token = localStorage.getItem('aura_token');
      const res = await fetch(`/api/chats/${chat.id}/media`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setMedia(data);
      }
    } catch (err) {
      console.error('Failed to load media', err);
    } finally {
      setLoading(false);
    }
  }

  const imageMedia = media.filter((m) => m.type === 'image');
  const videoMedia = media.filter((m) => m.type === 'video');
  const voiceMedia = media.filter((m) => m.type === 'voice');

  const isGroup = chat.type === 'group' || chat.type === 'space' || chat.type === 'channel';
  const memberCount = chat.members.length;
  const onlineCount = chat.members.filter((m) => m.auraMode === 'available').length;

  return (
    <>
      <div
        className={`fixed top-0 right-0 h-full w-full sm:w-96 bg-aura-surface border-l border-aura-border shadow-2xl z-50 transform transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="h-14 flex items-center justify-between px-4 border-b border-aura-border bg-aura-elevated">
          <button onClick={onClose} className="p-2 -ml-2 hover:bg-aura-surface2 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
          <h2 className="font-semibold">Информация</h2>
          <div className="w-9" />
        </div>

        {/* Chat avatar + name */}
        <div className="px-4 py-6 border-b border-aura-border bg-aura-elevated/50">
          <div className="flex flex-col items-center">
            {chat.type === 'space' ? (
              <div
                className="w-20 h-20 rounded-2xl flex items-center justify-center text-white mb-3 shadow-lg"
                style={{
                  background: `linear-gradient(135deg, ${chat.avatarColor} 0%, ${chat.avatarColor}cc 100%)`,
                }}
              >
                <Hash className="w-10 h-10" />
              </div>
            ) : chat.type === 'channel' ? (
              <div
                className="w-20 h-20 rounded-2xl flex items-center justify-center text-white mb-3 shadow-lg"
                style={{
                  background: `linear-gradient(135deg, ${chat.avatarColor} 0%, ${chat.avatarColor}cc 100%)`,
                }}
              >
                <Radio className="w-10 h-10" />
              </div>
            ) : chat.type === 'group' ? (
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center text-white mb-3 shadow-lg"
                style={{
                  background: `linear-gradient(135deg, ${chat.avatarColor} 0%, ${chat.avatarColor}cc 100%)`,
                }}
              >
                <Users className="w-10 h-10" />
              </div>
            ) : (
              <Avatar
                name={chat.name || '?'}
                color={chat.avatarColor}
                imageUrl={chat.otherUser?.avatarUrl ?? undefined}
                size={80}
                isOnline={chat.otherUser?.auraMode === 'available'}
                auraMode={chat.otherUser?.auraMode}
              />
            )}

            <h3 className="text-lg font-semibold mb-1">{chat.name}</h3>
            {chat.description && <p className="text-sm text-aura-text-dim text-center mb-2">{chat.description}</p>}
            {isGroup && (
              <div className="text-xs text-aura-text-muted">
                {memberCount} участников{onlineCount > 0 && `, ${onlineCount} онлайн`}
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        {isGroup && (
          <div className="flex border-b border-aura-border bg-aura-elevated">
            <TabButton
              label="Медиа"
              active={activeTab === 'media'}
              onClick={() => setActiveTab('media')}
              icon={<ImageIcon className="w-4 h-4" />}
            />
            <TabButton
              label="Файлы"
              active={activeTab === 'files'}
              onClick={() => setActiveTab('files')}
              icon={<FileText className="w-4 h-4" />}
            />
            <TabButton
              label="Участники"
              active={activeTab === 'members'}
              onClick={() => setActiveTab('members')}
              icon={<Users className="w-4 h-4" />}
            />
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'media' && (
            <div className="p-4">
              {loading && <div className="text-center text-aura-text-dim py-8">Загрузка...</div>}
              {!loading && imageMedia.length === 0 && videoMedia.length === 0 && (
                <div className="text-center text-aura-text-dim py-8">Нет медиа</div>
              )}

              {/* Images */}
              {imageMedia.length > 0 && (
                <div className="mb-4">
                  <div className="text-xs text-aura-text-muted mb-2 font-medium">Фото ({imageMedia.length})</div>
                  <div className="grid grid-cols-3 gap-1">
                    {imageMedia.slice(0, 30).map((item, idx) => (
                      <button
                        key={item.id}
                        onClick={() => setLightboxIndex(idx)}
                        className="aspect-square rounded-lg overflow-hidden bg-aura-elevated hover:opacity-80 transition-opacity"
                      >
                        <img
                          src={api.fileUrl(item.file_id)}
                          alt=""
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Videos */}
              {videoMedia.length > 0 && (
                <div className="mb-4">
                  <div className="text-xs text-aura-text-muted mb-2 font-medium">Видео ({videoMedia.length})</div>
                  <div className="grid grid-cols-3 gap-1">
                    {videoMedia.slice(0, 30).map((item) => (
                      <div
                        key={item.id}
                        className="aspect-square rounded-lg overflow-hidden bg-aura-elevated relative"
                      >
                        <video src={api.fileUrl(item.file_id)} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                          <div className="w-8 h-8 rounded-full bg-white/90 flex items-center justify-center">
                            <div className="w-0 h-0 border-l-8 border-l-black border-t-4 border-t-transparent border-b-4 border-b-transparent ml-1" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Voice */}
              {voiceMedia.length > 0 && (
                <div>
                  <div className="text-xs text-aura-text-muted mb-2 font-medium">
                    Голосовые ({voiceMedia.length})
                  </div>
                  <div className="space-y-1">
                    {voiceMedia.slice(0, 10).map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-aura-elevated hover:bg-aura-surface2 transition-colors"
                      >
                        <div className="w-8 h-8 rounded-full bg-aura-primary/20 flex items-center justify-center flex-shrink-0">
                          🎤
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm truncate">{item.sender_name}</div>
                          <div className="text-xs text-aura-text-muted">
                            {new Date(item.created_at * 1000).toLocaleDateString()}
                          </div>
                        </div>
                        <audio src={api.fileUrl(item.file_id)} controls className="max-w-[120px]" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'files' && (
            <div className="p-4">
              <div className="text-center text-aura-text-dim py-8">Файлы скоро появятся</div>
            </div>
          )}

          {activeTab === 'members' && (
            <div className="p-4 space-y-2">
              {chat.members.map((member) => (
                <MemberItem key={member.id} member={member} currentUserId={currentUserId} />
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="border-t border-aura-border p-3 space-y-2 bg-aura-elevated">
          {chat.type === 'direct' && (
            <button className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg hover:bg-aura-dnd/10 text-aura-dnd transition-colors">
              <Ban className="w-4 h-4" />
              <span className="text-sm font-medium">Заблокировать</span>
            </button>
          )}
          {isGroup && (
            <>
              <button className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg hover:bg-aura-surface2 transition-colors">
                <Trash2 className="w-4 h-4 text-aura-text-dim" />
                <span className="text-sm">Очистить историю</span>
              </button>
              <button className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg hover:bg-aura-dnd/10 text-aura-dnd transition-colors">
                <LogOut className="w-4 h-4" />
                <span className="text-sm font-medium">Покинуть {chat.type === 'group' ? 'группу' : 'канал'}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <MediaLightbox
          items={imageMedia.map((m) => ({ fileId: m.file_id, type: m.type, fileName: m.file_name || undefined }))}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 sm:hidden"
          onClick={onClose}
        />
      )}
    </>
  );
}

function TabButton({
  label,
  active,
  onClick,
  icon,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
        active ? 'border-aura-primary text-aura-primary' : 'border-transparent text-aura-text-dim hover:text-aura-text'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function MemberItem({ member, currentUserId }: { member: ChatMember; currentUserId: string }) {
  const isYou = member.id === currentUserId;
  const isOnline = member.auraMode === 'available';

  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-aura-elevated transition-colors">
      <Avatar
        name={member.displayName}
        color={member.avatarColor}
        imageUrl={member.avatarUrl ?? undefined}
        size={40}
        isOnline={isOnline}
        auraMode={member.auraMode}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">{member.displayName}</span>
          {isYou && <span className="text-xs text-aura-text-muted">(вы)</span>}
          {member.role === 'admin' && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-aura-primary/20 text-aura-primary-light">
              admin
            </span>
          )}
        </div>
        <div className="text-xs text-aura-text-muted">@{member.username}</div>
      </div>
    </div>
  );
}
