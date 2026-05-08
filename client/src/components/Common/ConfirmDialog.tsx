import { AlertTriangle } from 'lucide-react';

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'OK',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  danger = false,
}: ConfirmDialogProps) {
  return (
    <div
      className="fixed inset-0 z-[150] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
      onClick={onCancel}
    >
      <div
        className="bg-aura-surface border border-aura-border rounded-2xl max-w-sm w-full p-5 animate-scale-in shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 mb-4">
          {danger && (
            <div className="w-10 h-10 rounded-full bg-aura-dnd/15 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-5 h-5 text-aura-dnd" />
            </div>
          )}
          <div>
            <h3 className="font-semibold text-base mb-1">{title}</h3>
            <p className="text-sm text-aura-text-dim">{message}</p>
          </div>
        </div>

        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="btn-secondary px-5 py-2 text-sm"
          >
            {cancelLabel}
          </button>
          <button
            onClick={() => { onConfirm(); }}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
              danger
                ? 'bg-aura-dnd hover:bg-red-600 text-white'
                : 'btn-primary'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
