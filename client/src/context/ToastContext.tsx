/**
 * Toast Context
 * Manages toast notifications across the application
 */

import { createContext, useState, useCallback, ReactNode } from 'react';

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info' | 'loading';
  title: string;
  description?: string;
  duration?: number; // milliseconds, 0 means manual dismiss only
}

interface ToastContextType {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => string;
  removeToast: (id: string) => void;
}

export const ToastContext = createContext<ToastContextType | undefined>(undefined);

interface ToastProviderProps {
  children: ReactNode;
  maxToasts?: number;
}

export function ToastProvider({ children, maxToasts = 5 }: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const addToast = useCallback(
    (toast: Omit<Toast, 'id'>): string => {
      const id = `toast_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const newToast: Toast = { ...toast, id };

      setToasts(prev => {
        const updated = [...prev, newToast];
        // Limit number of toasts
        if (updated.length > maxToasts) {
          return updated.slice(-maxToasts);
        }
        return updated;
      });

      // Auto-dismiss if duration is set and not 0
      if (toast.duration !== 0) {
        const autoDismissTime = toast.duration || 5000;
        setTimeout(() => {
          removeToast(id);
        }, autoDismissTime);
      }

      return id;
    },
    [maxToasts, removeToast]
  );

  const value: ToastContextType = {
    toasts,
    addToast,
    removeToast,
  };

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}
