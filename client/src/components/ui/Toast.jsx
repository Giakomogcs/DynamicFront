
import React, { createContext, useContext, useState, useCallback } from 'react';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

const ToastContext = createContext();

export const useToast = () => useContext(ToastContext);

export const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);

    const addToast = useCallback((message, type = 'info', duration = 3000) => {
        const id = Date.now().toString();
        setToasts(prev => [...prev, { id, message, type }]);

        if (duration) {
            setTimeout(() => {
                removeToast(id);
            }, duration);
        }
    }, []);

    const removeToast = useCallback((id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const success = (msg, duration) => addToast(msg, 'success', duration);
    const error = (msg, duration) => addToast(msg, 'error', duration);
    const info = (msg, duration) => addToast(msg, 'info', duration);

    return (
        <ToastContext.Provider value={{ addToast, removeToast, success, error, info }}>
            {children}
            <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
                {toasts.map(toast => (
                    <div
                        key={toast.id}
                        className={`
                            pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border backdrop-blur-md transform transition-all duration-300 ease-out animate-in slide-in-from-right-8 fade-in
                            ${toast.type === 'success' ? 'bg-slate-900/90 border-green-500/30 text-green-200' : ''}
                            ${toast.type === 'error' ? 'bg-slate-900/90 border-red-500/30 text-red-200' : ''}
                            ${toast.type === 'info' ? 'bg-slate-900/90 border-blue-500/30 text-blue-200' : ''}
                        `}
                    >
                        {toast.type === 'success' && <CheckCircle className="size-5 text-green-500" />}
                        {toast.type === 'error' && <AlertCircle className="size-5 text-red-500" />}
                        {toast.type === 'info' && <Info className="size-5 text-blue-500" />}

                        <p className="text-sm font-medium">{toast.message}</p>

                        <button
                            onClick={() => removeToast(toast.id)}
                            className="ml-2 hover:bg-white/10 p-1 rounded transition-colors"
                        >
                            <X className="size-4 opacity-50 hover:opacity-100" />
                        </button>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
};
