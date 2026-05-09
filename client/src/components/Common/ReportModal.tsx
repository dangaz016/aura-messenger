import { useState } from 'react';
import { X, Flag, Bug, AlertTriangle, Ban, MessageSquare, MoreHorizontal, Check, ChevronRight } from 'lucide-react';
import { api } from '../../services/api';

type ReportType = 'user' | 'message' | 'bug' | 'content' | 'spam' | 'other';

interface ReportModalProps {
  onClose: () => void;
  targetUserId?: string;
  targetMessageId?: string;
  targetName?: string; // display name of reported user/content
}

const REPORT_TYPES: {
  type: ReportType;
  label: string;
  icon: React.ReactNode;
  color: string;
  categories: string[];
}[] = [
  {
    type: 'spam',
    label: 'Спам',
    icon: <Ban className="w-5 h-5" />,
    color: 'text-orange-400',
    categories: ['Массовая рассылка', 'Фишинг / мошенничество', 'Реклама'],
  },
  {
    type: 'user',
    label: 'Нарушение правил',
    icon: <AlertTriangle className="w-5 h-5" />,
    color: 'text-aura-dnd',
    categories: ['Оскорбления / угрозы', 'Дискриминация', 'Выдаёт себя за другого', 'Домогательства'],
  },
  {
    type: 'content',
    label: 'Неприемлемый контент',
    icon: <Flag className="w-5 h-5" />,
    color: 'text-pink-400',
    categories: ['Насилие / жестокость', '18+ контент', 'Незаконный контент', 'Личные данные'],
  },
  {
    type: 'message',
    label: 'Сообщение',
    icon: <MessageSquare className="w-5 h-5" />,
    color: 'text-blue-400',
    categories: ['Ложная информация', 'Угрозы', 'Оскорбления', 'Другое'],
  },
  {
    type: 'bug',
    label: 'Ошибка / баг',
    icon: <Bug className="w-5 h-5" />,
    color: 'text-green-400',
    categories: ['Интерфейс', 'Производительность', 'Функция не работает', 'Проблема с данными'],
  },
  {
    type: 'other',
    label: 'Другое',
    icon: <MoreHorizontal className="w-5 h-5" />,
    color: 'text-aura-text-muted',
    categories: [],
  },
];

export function ReportModal({ onClose, targetUserId, targetMessageId, targetName }: ReportModalProps) {
  const [step, setStep] = useState<'type' | 'category' | 'reason' | 'done'>('type');
  const [selectedType, setSelectedType] = useState<(typeof REPORT_TYPES)[0] | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit() {
    const finalReason = reason.trim() || selectedCategory || selectedType?.label || 'Жалоба';
    if (!selectedType) return;

    setSubmitting(true);
    setError('');
    try {
      await api.submitReport({
        targetUserId,
        targetMessageId,
        reason: finalReason,
        type: selectedType.type,
        category: selectedCategory || undefined,
      });
      setStep('done');
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
        : null;
      setError(msg || 'Не удалось отправить жалобу');
    } finally {
      setSubmitting(false);
    }
  }

  function selectType(t: (typeof REPORT_TYPES)[0]) {
    setSelectedType(t);
    setSelectedCategory('');
    if (t.categories.length > 0) {
      setStep('category');
    } else {
      setStep('reason');
    }
  }

  function selectCategory(cat: string) {
    setSelectedCategory(cat);
    setStep('reason');
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}>
      <div className="bg-aura-surface border border-aura-border rounded-2xl w-full max-w-sm overflow-hidden animate-scale-in shadow-xl"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-aura-border">
          <div className="flex items-center gap-2">
            {step !== 'type' && step !== 'done' && (
              <button
                onClick={() => setStep(step === 'reason' && selectedType?.categories.length ? 'category' : 'type')}
                className="p-1 hover:bg-aura-elevated rounded-lg transition-colors text-aura-text-muted"
              >
                <ChevronRight className="w-4 h-4 rotate-180" />
              </button>
            )}
            <h3 className="font-bold flex items-center gap-2">
              <Flag className="w-4 h-4 text-aura-dnd" />
              {step === 'done' ? 'Жалоба отправлена' : 'Пожаловаться'}
            </h3>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-aura-elevated rounded-lg transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5">
          {/* Target info */}
          {targetName && step !== 'done' && (
            <div className="mb-4 text-sm text-aura-text-muted px-3 py-2 rounded-lg bg-aura-surface2 border border-aura-border">
              <span className="text-aura-text-dim">Жалоба на:</span> <span className="font-medium">{targetName}</span>
            </div>
          )}

          {/* Step: type selection */}
          {step === 'type' && (
            <div className="space-y-2">
              <p className="text-sm text-aura-text-muted mb-3">Выберите причину жалобы:</p>
              {REPORT_TYPES.map(t => (
                <button
                  key={t.type}
                  onClick={() => selectType(t)}
                  className="w-full flex items-center gap-3 p-3.5 rounded-xl border border-aura-border hover:border-aura-primary/50 hover:bg-aura-elevated transition-all text-left group"
                >
                  <span className={t.color}>{t.icon}</span>
                  <span className="flex-1 text-sm font-medium">{t.label}</span>
                  <ChevronRight className="w-4 h-4 text-aura-text-muted group-hover:text-aura-text transition-colors" />
                </button>
              ))}
            </div>
          )}

          {/* Step: category selection */}
          {step === 'category' && selectedType && (
            <div className="space-y-2">
              <p className="text-sm text-aura-text-muted mb-3 flex items-center gap-2">
                <span className={selectedType.color}>{selectedType.icon}</span>
                {selectedType.label}
              </p>
              {selectedType.categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => selectCategory(cat)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-aura-border hover:border-aura-primary/50 hover:bg-aura-elevated transition-all text-left group"
                >
                  <span className="flex-1 text-sm">{cat}</span>
                  <ChevronRight className="w-4 h-4 text-aura-text-muted group-hover:text-aura-text transition-colors" />
                </button>
              ))}
              <button
                onClick={() => setStep('reason')}
                className="w-full flex items-center gap-3 p-3 rounded-xl border border-aura-border hover:border-aura-primary/50 hover:bg-aura-elevated transition-all text-left group text-aura-text-muted"
              >
                <span className="flex-1 text-sm">Другое</span>
                <ChevronRight className="w-4 h-4 group-hover:text-aura-text transition-colors" />
              </button>
            </div>
          )}

          {/* Step: reason text */}
          {step === 'reason' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-aura-text-muted">
                {selectedType && <span className={selectedType.color}>{selectedType.icon}</span>}
                <span>{selectedType?.label}</span>
                {selectedCategory && (
                  <>
                    <ChevronRight className="w-3.5 h-3.5" />
                    <span>{selectedCategory}</span>
                  </>
                )}
              </div>

              <div>
                <label className="text-xs text-aura-text-muted uppercase tracking-wider font-semibold block mb-2">
                  Описание (необязательно)
                </label>
                <textarea
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder={
                    selectedType?.type === 'bug'
                      ? 'Опишите баг как можно подробнее: что произошло, как воспроизвести...'
                      : 'Дополнительная информация...'
                  }
                  rows={4}
                  maxLength={1000}
                  className="input-aura w-full resize-none"
                />
                <div className="text-right text-xs text-aura-text-muted mt-1">{reason.length}/1000</div>
              </div>

              {error && (
                <div className="text-xs text-aura-dnd px-3 py-2 rounded-lg bg-aura-dnd/10 border border-aura-dnd/30">
                  {error}
                </div>
              )}

              <div className="flex gap-2">
                <button onClick={onClose} className="flex-1 btn-secondary py-2.5 text-sm">
                  Отмена
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="flex-1 btn-primary py-2.5 text-sm flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Flag className="w-4 h-4" />
                  )}
                  Отправить
                </button>
              </div>
            </div>
          )}

          {/* Step: done */}
          {step === 'done' && (
            <div className="text-center py-4 space-y-4">
              <div className="w-16 h-16 rounded-full bg-aura-online/10 border border-aura-online/30 flex items-center justify-center mx-auto">
                <Check className="w-8 h-8 text-aura-online" />
              </div>
              <div>
                <p className="font-semibold mb-1">Жалоба получена!</p>
                <p className="text-sm text-aura-text-muted">
                  Мы рассмотрим её в ближайшее время. Спасибо за помощь в поддержании безопасности Aura.
                </p>
              </div>
              <button onClick={onClose} className="btn-primary w-full py-2.5 text-sm">
                Закрыть
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
