import { Plus, MessageSquare, Trash2, Edit2, X, Search } from 'lucide-react';

export const ChatSidebar = ({
    chats,
    activeChatId,
    onSelect,
    onNew,
    onDelete,
    onRename,
    onClose
}) => {
    // Group chats? For now simple list
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
                        className={`group flex items-center gap-2 p-2 rounded-lg text-sm transition-colors cursor-pointer ${activeChatId === chat.id ? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'}`}
                        onClick={() => { onSelect(chat.id); onClose(); }}
                    >
                        <MessageSquare size={14} className="shrink-0 opacity-70" />
                        <span className="truncate flex-1">{chat.title || "Untitled Chat"}</span>

                        {/* Quick Actions on Hover */}
                        <div className="hidden group-hover:flex items-center gap-1 opacity-100">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    const newName = prompt("New name:", chat.title);
                                    if (newName) onRename(chat.id, newName);
                                }}
                                className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition-colors"
                            >
                                <Edit2 size={12} />
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); onDelete(chat.id); }}
                                className="p-1.5 hover:bg-red-500/20 text-slate-500 hover:text-red-400 rounded transition-colors"
                            >
                                <Trash2 size={12} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
