import React from 'react';
import { Layout, Plus } from 'lucide-react';

export const ScreenSelector = ({ screens, activeScreenId, onSelectScreen, onAddScreen }) => {
    return (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-full p-1.5 flex items-center gap-1 shadow-xl">
            {screens.map((screen) => (
                <button
                    key={screen.id}
                    onClick={() => onSelectScreen(screen.id)}
                    className={`
                        px-4 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-2
                        ${activeScreenId === screen.id 
                            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/25' 
                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}
                    `}
                >
                    <Layout size={12} />
                    {screen.name}
                </button>
            ))}
            
            {onAddScreen && (
                <button 
                    onClick={onAddScreen}
                    className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 transition-colors ml-1"
                    title="Add new screen"
                >
                    <Plus size={14} />
                </button>
            )}
        </div>
    );
};
