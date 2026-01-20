/**
 * Toast Component
 * Individual toast notification with styled variants
 */

import { X, CheckCircle, AlertCircle, AlertTriangle, Info, Loader2 } from 'lucide-react';
import { Toast as ToastType } from '@/context/ToastContext';
import { clsx } from 'clsx';

interface ToastProps {
  toast: ToastType;
  onDismiss: (id: string) => void;
}

const toastIcons = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
  loading: Loader2,
};

const toastStyles = {
  success: 'bg-green-50 border-green-200 text-green-900',
  error: 'bg-red-50 border-red-200 text-red-900',
  warning: 'bg-yellow-50 border-yellow-200 text-yellow-900',
  info: 'bg-blue-50 border-blue-200 text-blue-900',
  loading: 'bg-gray-50 border-gray-200 text-gray-900',
};

const iconStyles = {
  success: 'text-green-500',
  error: 'text-red-500',
  warning: 'text-yellow-500',
  info: 'text-blue-500',
  loading: 'text-gray-500',
};

export function Toast({ toast, onDismiss }: ToastProps) {
  const Icon = toastIcons[toast.type];
  const isLoading = toast.type === 'loading';

  return (
    <div
      className={clsx(
        'flex items-start gap-3 p-4 rounded-lg border shadow-lg',
        'animate-slide-in-right min-w-[320px] max-w-md',
        toastStyles[toast.type]
      )}
      role="alert"
    >
      <Icon
        className={clsx('w-5 h-5 flex-shrink-0 mt-0.5', iconStyles[toast.type], {
          'animate-spin': isLoading,
        })}
      />

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">{toast.title}</p>
        {toast.description && (
          <p className="text-sm opacity-90 mt-1">{toast.description}</p>
        )}
      </div>

      <button
        onClick={() => onDismiss(toast.id)}
        className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity"
        aria-label="Dismiss notification"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
