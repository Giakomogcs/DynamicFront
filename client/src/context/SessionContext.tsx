/**
 * Session Context
 * Manages session state across the application
 */

import { createContext, useState, ReactNode, useCallback } from 'react';
import type { Session, Canvas } from '@/types';

interface SessionContextType {
  sessions: Session[];
  currentSession: Session | null;
  currentCanvas: Canvas | null;
  setCurrentSession: (session: Session | null) => void;
  setCurrentCanvas: (canvas: Canvas | null) => void;
  updateSession: (session: Session) => void;
  addSession: (session: Session) => void;
  removeSession: (sessionId: string) => void;
  setSessions: (sessions: Session[]) => void;
}

export const SessionContext = createContext<SessionContextType | undefined>(undefined);

interface SessionProviderProps {
  children: ReactNode;
}

export function SessionProvider({ children }: SessionProviderProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [currentCanvas, setCurrentCanvas] = useState<Canvas | null>(null);

  const updateSession = useCallback((updatedSession: Session) => {
    setSessions(prev => prev.map(s => (s.id === updatedSession.id ? updatedSession : s)));

    // Update current session if it's the one being updated
    if (currentSession?.id === updatedSession.id) {
      setCurrentSession(updatedSession);
    }
  }, [currentSession]);

  const addSession = useCallback((newSession: Session) => {
    setSessions(prev => [newSession, ...prev]);
  }, []);

  const removeSession = useCallback((sessionId: string) => {
    setSessions(prev => prev.filter(s => s.id !== sessionId));

    // Clear current session if it's the one being removed
    if (currentSession?.id === sessionId) {
      setCurrentSession(null);
      setCurrentCanvas(null);
    }
  }, [currentSession]);

  const value: SessionContextType = {
    sessions,
    currentSession,
    currentCanvas,
    setCurrentSession,
    setCurrentCanvas,
    updateSession,
    addSession,
    removeSession,
    setSessions,
  };

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
