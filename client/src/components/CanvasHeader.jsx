import React, { useState, useEffect } from 'react';
import { Pencil, Save, PlusCircle, Check, Plus, Replace } from 'lucide-react';

export const CanvasHeader = ({ title, onTitleChange, onSave, onNewChat, isSaving, lastSavedAt, canvasMode, onModeChange }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [tempTitle, setTempTitle] = useState(title || "");

    useEffect(() => {
        setTempTitle(title);
    }, [title]);

    const handleTitleSubmit = () => {
        onTitleChange(tempTitle);
        setIsEditing(false);
    };

    return (
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950">
            <div className="flex items-center gap-4">
                {isEditing ? (
                    <div className="flex items-center gap-2">
                        <input
                            type="text"
                            value={tempTitle}
                            onChange={(e) => setTempTitle(e.target.value)}
                            onBlur={handleTitleSubmit}
                            onKeyDown={(e) => e.key === 'Enter' && handleTitleSubmit()}
                            autoFocus
                            className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white focus:outline-none focus:border-indigo-500"
                        />
                        <button onClick={handleTitleSubmit} className="text-green-500 hover:text-green-400">
                            <Check size={16} />
                        </button>
                    </div>
                ) : (
                    <div className="flex items-center gap-2 group cursor-pointer" onClick={() => setIsEditing(true)}>
                        <h1 className="text-xl font-semibold text-white">{title || "Untitled Dashboard"}</h1>
                        <Pencil size={14} className="text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                )}

                {lastSavedAt && (
                    <span className="text-xs text-slate-500 ml-2">
                        Saved: {new Date(lastSavedAt).toLocaleTimeString()}
                    </span>
                )}
            </div>

            <div className="flex items-center gap-3">
                {/* Canvas Mode Toggle REMOVED - AI is now intelligent */}
                {/* 
                   Dynamic UI: The system will determine whether to append, replace, or update 
                   based on the user request and context.
                */}

                <button
                    onClick={onNewChat}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors border border-slate-800"
                >
                    <PlusCircle size={16} />
                    New Chat
                </button>

                <button
                    onClick={onSave}
                    disabled={isSaving}
                    className="flex items-center gap-2 px-4 py-1.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors disabled:opacity-50"
                >
                    <Save size={16} />
                    {isSaving ? 'Saving...' : 'Save Canvas'}
                </button>
            </div>
        </div>
    );
};
