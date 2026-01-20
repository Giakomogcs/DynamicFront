/**
 * useToast Hook
 * Provides convenient methods for showing toast notifications
 */

import { useContext } from 'react';
import { ToastContext } from '@/context/ToastContext';

export function useToast() {
  const context = useContext(ToastContext);

  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }

  return {
    /**
     * Show a success toast
     */
    success: (title: string, description?: string) =>
      context.addToast({ type: 'success', title, description }),

    /**
     * Show an error toast
     */
    error: (title: string, description?: string) =>
      context.addToast({ type: 'error', title, description }),

    /**
     * Show a warning toast
     */
    warning: (title: string, description?: string) =>
      context.addToast({ type: 'warning', title, description }),

    /**
     * Show an info toast
     */
    info: (title: string, description?: string) =>
      context.addToast({ type: 'info', title, description }),

    /**
     * Show a loading toast (requires manual dismiss)
     */
    loading: (title: string, description?: string) =>
      context.addToast({ type: 'loading', title, description, duration: 0 }),

    /**
     * Manually dismiss a toast by ID
     */
    dismiss: (id: string) => context.removeToast(id),

    /**
     * Get all active toasts
     */
    toasts: context.toasts,
  };
}
