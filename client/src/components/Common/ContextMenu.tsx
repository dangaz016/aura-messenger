import { useEffect, useRef } from 'react';
import { LucideIcon } from 'lucide-react';

interface ContextMenuItem {
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}

interface ContextMenuProps {
  items: ContextMenuItem[];
  position: { x: number; y: number };
  onClose: () => void;
}

export function ContextMenu({ items, position, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  // Adjust position to keep menu in viewport
  useEffect(() => {
    if (!menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const adjustedX = Math.min(position.x, window.innerWidth - rect.width - 10);
    const adjustedY = Math.min(position.y, window.innerHeight - rect.height - 10);
    
    menuRef.current.style.left = `${adjustedX}px`;
    menuRef.current.style.top = `${adjustedY}px`;
  }, [position]);

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        ref={menuRef}
        className="fixed z-50 bg-aura-elevated border border-aura-border rounded-lg shadow-2xl py-1 min-w-[180px] animate-scale-in"
        style={{ left: position.x, top: position.y }}
      >
        {items.map((item, index) => {
          const Icon = item.icon;
          return (
            <button
              key={index}
              onClick={() => {
                if (!item.disabled) {
                  item.onClick();
                  onClose();
                }
              }}
              disabled={item.disabled}
              className={`w-full flex items-center gap-3 px-4 py-2 text-left text-sm transition-colors ${
                item.disabled
                  ? 'opacity-50 cursor-not-allowed'
                  : item.danger
                  ? 'text-aura-dnd hover:bg-aura-dnd/10'
                  : 'hover:bg-aura-surface2'
              }`}
            >
              {Icon && <Icon className="w-4 h-4 flex-shrink-0" />}
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}
