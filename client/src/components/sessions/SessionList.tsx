/**
 * Session List Component
 * Grid layout for displaying multiple session cards
 */

import { SessionCard } from './SessionCard';
import { Spinner } from '../ui/Spinner';
import { FileX } from 'lucide-react';
import type { Session } from '@/types';

interface SessionListProps {
  sessions: Session[];
  loading?: boolean;
  onOpenSession: (session: Session) => void;
  onDeleteSession: (session: Session) => void;
}

export function SessionList({
  sessions,
  loading = false,
  onOpenSession,
  onDeleteSession,
}: SessionListProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <Spinner size="lg" className="mb-4" />
          <p className="text-slate-600">Carregando sessões...</p>
        </div>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center max-w-md">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 mb-4">
            <FileX className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">
            Nenhuma sessão encontrada
          </h3>
          <p className="text-slate-600">
            Crie sua primeira sessão para começar a trabalhar com canvases dinâmicos.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {sessions.map((session) => (
        <SessionCard
          key={session.id}
          session={session}
          onOpen={onOpenSession}
          onDelete={onDeleteSession}
        />
      ))}
    </div>
  );
}
