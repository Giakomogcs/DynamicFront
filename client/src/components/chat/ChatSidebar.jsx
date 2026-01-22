import { useState } from 'react';
import { Plus, MessageSquare, Trash2, Edit2, X, Search, MoreVertical } from 'lucide-react';

export const ChatSidebar = ({
    chats,
    activeChatId,
    onSelect,
    onNew,
    onDelete,
    onRename,
    onClose
}) => {
    const [editingId, setEditingId] = useState(null);
    const [editName, setEditName] = useState('');
    const [menuOpenId, setMenuOpenId] = useState(null);

    const startEditing = (chat, e) => {
        e.stopPropagation();
        setEditingId(chat.id);
        setEditName(chat.title);
        setMenuOpenId(null);
    };

    const handleSaveRename = (id) => {
        if (editName.trim()) {
            onRename(id, editName);
        }
        setEditingId(null);
    };

    const handleKeyDown = (e, id) => {
        if (e.key === 'Enter') handleSaveRename(id);
        if (e.key === 'Escape') setEditingId(null);
    };

    return (
        <div className="flex flex-col h-full">
            <div className="p-3 border-b border-slate-800 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">History</span>
                <button onClick={onClose} className="text-slate-500 hover:text-white"><X size={14} /></button>
            </div>

            <div className="p-2">
                <button
                    onClick={() => { onNew(); onClose(); }}
                    className="w-full flex items-center justify-center gap-2 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors"
                >
                    <Plus size={16} /> New Chat
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-thin scrollbar-thumb-slate-700">
                {chats.map(chat => (
                    <div
                        key={chat.id}
                        className={`group flex items-center gap-2 px-3 py-2.5 rounded-lg transition-all cursor-pointer border border-transparent ${
                            activeChatId === chat.id 
                                ? 'bg-indigo-600/10 text-indigo-400 border-indigo-500/20' 
                                : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                        }`}
                        onClick={() => { onSelect(chat.id); onClose(); }}
                    >
                        <MessageSquare size={14} className="shrink-0 opacity-70" />

                        {/* Title (Editable) */}
                        {editingId === chat.id ? (
                            <input
                                autoFocus
                                type="text"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                onBlur={() => handleSaveRename(chat.id)}
                                onKeyDown={(e) => handleKeyDown(e, chat.id)}
                                onClick={(e) => e.stopPropagation()}
                                className="flex-1 bg-slate-800 text-white text-sm px-1.5 py-0.5 rounded outline-none border border-indigo-500 min-w-0"
                            />
                        ) : (
                            <span className="truncate flex-1 text-sm font-medium">{chat.title || "Untitled Chat"}</span>
                        )}

                        {/* Context Menu */}
                        <div className="relative" onClick={(e) => e.stopPropagation()}>
                            <button
                                onClick={() => setMenuOpenId(menuOpenId === chat.id ? null : chat.id)}
                                className={`p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-slate-800 transition-all ${menuOpenId === chat.id ? 'opacity-100 bg-slate-800' : ''}`}
                            >
                                <MoreVertical size={14} />
                            </button>

                            {/* Dropdown Menu */}
                            {menuOpenId === chat.id && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setMenuOpenId(null)} />
                                    <div className="absolute right-0 top-full mt-1 w-32 bg-slate-900 border border-slate-700 rounded-lg shadow-xl z-50 py-1 flex flex-col">
                                        <button
                                            onClick={(e) => startEditing(chat, e)}
                                            className="flex items-center gap-2 px-3 py-2 text-xs text-slate-300 hover:bg-slate-800 w-full text-left"
                                        >
                                            <Edit2 size={12} /> Rename
                                        </button>
                                        <button
                                            onClick={(e) => { 
                                                e.stopPropagation(); 
                                                onDelete(chat.id); 
                                                setMenuOpenId(null); 
                                            }}
                                            className="flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 w-full text-left"
                                        >
                                            <Trash2 size={12} /> Delete
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
