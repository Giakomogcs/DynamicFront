/**
 * useSession Hook
 * Provides access to session context
 */

import { useContext } from 'react';
import { SessionContext } from '@/context/SessionContext';

export function useSession() {
  const context = useContext(SessionContext);

  if (context === undefined) {
    throw new Error('useSession must be used within a SessionProvider');
  }

  return context;
}
