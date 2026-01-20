/**
 * Toast Container
 * Renders all active toasts in a fixed position
 */

import { useToast } from '@/hooks/useToast';
import { Toast } from './Toast';

export function ToastContainer() {
  const { toasts, dismiss } = useToast();

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div
      className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none"
      aria-live="polite"
      aria-atomic="false"
    >
      {toasts.map(toast => (
        <div key={toast.id} className="pointer-events-auto">
          <Toast toast={toast} onDismiss={dismiss} />
        </div>
      ))}
    </div>
  );
}
