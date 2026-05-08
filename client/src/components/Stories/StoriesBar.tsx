import { Plus } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useStories } from '../../contexts/StoriesContext';
import { useT } from '../../contexts/LanguageContext';
import { getInitials } from '../../utils/formatters';

export function StoriesBar() {
  const { user } = useAuth();
  const { feed, openViewer, openComposer } = useStories();
  const { t } = useT();

  if (!user) return null;

  const myGroup = feed.find(g => g.user.id === user.id);
  const otherGroups = feed.filter(g => g.user.id !== user.id);

  return (
    <div className="px-3 pt-3 pb-2 border-b border-aura-border">
      <div className="text-xs uppercase tracking-wide text-aura-text-muted mb-2 font-medium">
        {t('stories.bar_title')}
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1">
        {/* "Your story" — always first */}
        <button
          onClick={() => myGroup ? openViewer(user.id, 0) : openComposer()}
          className="flex flex-col items-center gap-1 flex-shrink-0 group"
        >
          <div className="relative">
            <div
              className={`w-14 h-14 rounded-full p-0.5 ${
                myGroup
                  ? myGroup.hasUnviewed
                    ? 'bg-gradient-to-tr from-aura-primary via-pink-500 to-orange-400'
                    : 'bg-aura-border'
                  : 'bg-aura-border'
              }`}
            >
              <div className="w-full h-full rounded-full bg-aura-surface p-0.5">
                <div
                  className="w-full h-full rounded-full flex items-center justify-center text-white text-sm font-semibold"
                  style={{ background: `linear-gradient(135deg, ${user.avatarColor} 0%, ${user.avatarColor}cc 100%)` }}
                >
                  {getInitials(user.displayName)}
                </div>
              </div>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); openComposer(); }}
              className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-aura-primary border-2 border-aura-surface flex items-center justify-center hover:bg-aura-primary-light transition-colors"
              title={t('stories.add')}
            >
              <Plus className="w-3 h-3 text-white" strokeWidth={3} />
            </button>
          </div>
          <div className="text-[10px] text-aura-text-dim max-w-[58px] truncate">
            {myGroup ? t('stories.your_story') : t('stories.add_short')}
          </div>
        </button>

        {/* Other users' stories */}
        {otherGroups.map(group => (
          <button
            key={group.user.id}
            onClick={() => openViewer(group.user.id, 0)}
            className="flex flex-col items-center gap-1 flex-shrink-0 group"
          >
            <div
              className={`w-14 h-14 rounded-full p-0.5 ${
                group.hasUnviewed
                  ? 'bg-gradient-to-tr from-aura-primary via-pink-500 to-orange-400'
                  : 'bg-aura-border'
              }`}
            >
              <div className="w-full h-full rounded-full bg-aura-surface p-0.5">
                <div
                  className="w-full h-full rounded-full flex items-center justify-center text-white text-sm font-semibold"
                  style={{ background: `linear-gradient(135deg, ${group.user.avatarColor} 0%, ${group.user.avatarColor}cc 100%)` }}
                >
                  {getInitials(group.user.displayName)}
                </div>
              </div>
            </div>
            <div className="text-[10px] text-aura-text-dim max-w-[58px] truncate">
              {group.user.displayName}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
