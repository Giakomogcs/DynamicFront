import React, { useState } from 'react';
import { 
    Layout, 
    Home, 
    FileText, 
    Plus, 
    MoreVertical, 
    Edit2, 
    Trash2, 
    ChevronLeft
} from 'lucide-react';

export const SidebarNavigation = ({ 
    pages, 
    activePageId, 
    onNavigate, 
    onCreatePage, 
    onRenamePage, 
    onDeletePage,
    onBackToHome
}) => {
    const [editingId, setEditingId] = useState(null);
    const [editName, setEditName] = useState('');
    const [menuOpenId, setMenuOpenId] = useState(null);

    const startEditing = (page, e) => {
        e.stopPropagation();
        setEditingId(page.id);
        setEditName(page.title);
        setMenuOpenId(null);
    };

    const handleSaveRename = (id) => {
        if (editName.trim()) {
            onRenamePage(id, editName);
        }
        setEditingId(null);
    };

    const handleKeyDown = (e, id) => {
        if (e.key === 'Enter') handleSaveRename(id);
        if (e.key === 'Escape') setEditingId(null);
    };

    return (
        <div className="w-64 flex flex-col bg-slate-950 border-r border-slate-800 h-full select-none">
            {/* Project Header */}
            <div className="p-4 border-b border-slate-800">
                <button 
                    onClick={onBackToHome}
                    className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm mb-4"
                >
                    <ChevronLeft size={16} />
                    <span>Back to Projects</span>
                </button>
                <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1">Pages</h2>
            </div>

            {/* Page List */}
            <div className="flex-1 overflow-y-auto px-2 py-4 space-y-1">
                {pages.map(page => (
                    <div 
                        key={page.id}
                        onClick={() => onNavigate(page.slug)}
                        className={`
                            group flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all border border-transparent
                            ${activePageId === page.id 
                                ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20' 
                                : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'}
                        `}
                    >
                        {/* Icon */}
                        {page.isHome ? <Home size={18} /> : <FileText size={18} />}

                        {/* Title (Editable) */}
                        {editingId === page.id ? (
                            <input 
                                autoFocus
                                type="text"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                onBlur={() => handleSaveRename(page.id)}
                                onKeyDown={(e) => handleKeyDown(e, page.id)}
                                onClick={(e) => e.stopPropagation()}
                                className="flex-1 bg-slate-800 text-white text-sm px-1.5 py-0.5 rounded outline-none border border-indigo-500"
                            />
                        ) : (
                            <span className="flex-1 text-sm font-medium truncate">{page.title}</span>
                        )}

                        {/* Context Menu Trigger */}
                        <div className="relative" onClick={(e) => e.stopPropagation()}>
                            <button 
                                onClick={() => setMenuOpenId(menuOpenId === page.id ? null : page.id)}
                                className={`p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-slate-800 transition-all ${menuOpenId === page.id ? 'opacity-100 bg-slate-800' : ''}`}
                            >
                                <MoreVertical size={14} />
                            </button>

                            {/* Dropdown Menu */}
                            {menuOpenId === page.id && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setMenuOpenId(null)} />
                                    <div className="absolute right-0 top-full mt-1 w-32 bg-slate-900 border border-slate-700 rounded-lg shadow-xl z-50 py-1 flex flex-col">
                                        <button 
                                            onClick={(e) => startEditing(page, e)}
                                            className="flex items-center gap-2 px-3 py-2 text-xs text-slate-300 hover:bg-slate-800 w-full text-left"
                                        >
                                            <Edit2 size={12} /> Rename
                                        </button>
                                        {!page.isHome && (
                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation(); 
                                                    onDeletePage(page.id);
                                                    setMenuOpenId(null);
                                                }}
                                                className="flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 w-full text-left"
                                            >
                                                <Trash2 size={12} /> Delete
                                            </button>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Footer Action */}
            <div className="p-4 border-t border-slate-800">
                <button 
                    onClick={onCreatePage}
                    className="flex items-center justify-center gap-2 w-full px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors text-sm font-medium border border-slate-700"
                >
                    <Plus size={16} />
                    <span>New Page</span>
                </button>
            </div>
        </div>
    );
};
