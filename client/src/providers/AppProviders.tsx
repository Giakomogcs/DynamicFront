/**
 * App Providers Wrapper for v2.0
 * Wraps the entire application with necessary context providers
 */

import { ReactNode } from 'react';
import { AuthProvider } from '@/context/AuthContext';
import { ToastProvider } from '@/context/ToastContext';
import { SessionProvider } from '@/context/SessionContext';
import { ToastContainer } from '@/components/common/ToastContainer';

interface AppProvidersProps {
  children: ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <AuthProvider>
      <ToastProvider>
        <SessionProvider>
          {children}
          <ToastContainer />
        </SessionProvider>
      </ToastProvider>
    </AuthProvider>
  );
}
