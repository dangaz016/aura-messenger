import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { playMessageReceivedSound } from '../utils/sounds';

export type ToastType = 'success' | 'error' | 'info' | 'message';

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
  title?: string;
  avatarColor?: string;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType, title?: string, avatarColor?: string) => void;
  toasts: ToastItem[];
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

// Re-export for backwards compatibility
export function playNotificationSound() {
  playMessageReceivedSound();
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((
    message: string,
    type: ToastType = 'info',
    title?: string,
    avatarColor?: string
  ) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev.slice(-4), { id, message, type, title, avatarColor }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4500);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, toasts, removeToast }}>
      {children}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
