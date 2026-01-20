/**
 * New Session Modal Component
 * Modal for creating new sessions
 */

import { useState, FormEvent } from 'react';
import { X } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

interface NewSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; description?: string }) => void | Promise<void>;
}

export function NewSessionModal({ isOpen, onClose, onSubmit }: NewSessionModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        description: description.trim() || undefined,
      });
      // Reset form
      setName('');
      setDescription('');
      onClose();
    } catch (error) {
      console.error('Error creating session:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-2xl max-w-md w-full animate-fade-in">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
            <h2 className="text-xl font-semibold text-slate-900">
              Nova Sessão
            </h2>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
            <Input
              label="Nome da sessão"
              placeholder="Ex: Dashboard de Vendas"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Descrição (opcional)
              </label>
              <textarea
                placeholder="Descreva o propósito desta sessão..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full px-4 py-2 text-base bg-white border border-slate-300 rounded-lg placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 resize-none"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={onClose}
                className="flex-1"
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                variant="primary"
                isLoading={isSubmitting}
                className="flex-1"
                disabled={!name.trim() || isSubmitting}
              >
                Criar Sessão
              </Button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
