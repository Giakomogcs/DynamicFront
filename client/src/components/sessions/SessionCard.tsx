/**
 * Session Card Component
 * Displays session information with preview, stats, and actions
 */

import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { FileText, Trash2, MoreVertical } from 'lucide-react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import type { Session } from '@/types';

interface SessionCardProps {
  session: Session;
  onOpen: (session: Session) => void;
  onDelete: (session: Session) => void;
}

export function SessionCard({ session, onOpen, onDelete }: SessionCardProps) {
  const canvasCount = session.canvases?.length || 0;
  const lastUpdated = formatDistanceToNow(new Date(session.updatedAt), {
    addSuffix: true,
    locale: ptBR,
  });

  return (
    <Card
      hover
      className="cursor-pointer group"
      onClick={() => onOpen(session)}
    >
      {/* Preview */}
      <div className="h-40 bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-pattern opacity-10" />
        <FileText className="w-16 h-16 text-indigo-400" />
        
        {/* Status badge */}
        <div className="absolute top-3 right-3">
          <Badge variant={session.status === 'active' ? 'success' : 'default'}>
            {session.status === 'active' ? 'Ativa' : 'Arquivada'}
          </Badge>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-slate-900 truncate">
              {session.name}
            </h3>
            {session.description && (
              <p className="text-sm text-slate-600 line-clamp-2 mt-1">
                {session.description}
              </p>
            )}
          </div>

          {/* Actions menu */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              // TODO: Open dropdown menu
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors opacity-0 group-hover:opacity-100"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 text-sm text-slate-500 mt-3">
          <div className="flex items-center gap-1.5">
            <FileText className="w-4 h-4" />
            <span>{canvasCount} {canvasCount === 1 ? 'canvas' : 'canvases'}</span>
          </div>
          <div>•</div>
          <div>
           {lastUpdated}
          </div>
        </div>
      </div>

      {/* Footer actions */}
      <div className="px-4 pb-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(session);
          }}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          Excluir
        </button>
      </div>
    </Card>
  );
}
