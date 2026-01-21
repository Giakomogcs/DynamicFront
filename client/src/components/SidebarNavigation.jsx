import React, { useState } from 'react';
import {
    Layout,
    Home,
    FileText,
    Plus,
    MoreVertical,
    Edit2,
    Trash2,
    ChevronLeft,
    MessageSquare
} from 'lucide-react';

export const SidebarNavigation = ({
    pages,
    activePageId,
    onNavigate,
    onCreatePage,
    onRenamePage,
    onDeletePage,

    // Chat Props
    chats = [],
    activeChatId,
    onSelectChat,
    onCreateChat,
    onRenameChat,
    onDeleteChat,

    onBackToHome
}) => {
    const [editingId, setEditingId] = useState(null);
    const [editName, setEditName] = useState('');
    const [menuOpenId, setMenuOpenId] = useState(null);

    const startEditing = (item, e) => {
        e.stopPropagation();
        setEditingId(item.id);
        setEditName(item.title);
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
                <div className="flex items-center justify-between">
                    <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Chats</h2>
                    <button
                        onClick={onCreateChat}
                        className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors"
                        title="New Chat"
                    >
                        <Plus size={14} />
                    </button>
                </div>
            </div>

            {/* Chats List */}
            <div className="flex-none max-h-[40%] overflow-y-auto px-2 py-2 space-y-1 scrollbar-discreet border-b border-slate-800">
                {chats.map(chat => (
                    <div
                        key={chat.id}
                        onClick={() => onSelectChat(chat.id)}
                        className={`
                            group flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all border border-transparent
                            ${activeChatId === chat.id
                                ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20'
                                : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'}
                        `}
                    >
                        <MessageSquare size={16} className="shrink-0" />

                        {/* Title (Editable) */}
                        {editingId === chat.id ? (
                            <input
                                autoFocus
                                type="text"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                onBlur={() => {
                                    if (editName.trim()) onRenameChat(chat.id, editName);
                                    setEditingId(null);
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        if (editName.trim()) onRenameChat(chat.id, editName);
                                        setEditingId(null);
                                    }
                                    if (e.key === 'Escape') setEditingId(null);
                                }}
                                onClick={(e) => e.stopPropagation()}
                                className="flex-1 bg-slate-800 text-white text-sm px-1.5 py-0.5 rounded outline-none border border-indigo-500"
                            />
                        ) : (
                            <span className="flex-1 text-sm font-medium truncate">{chat.title || "Untitled Chat"}</span>
                        )}

                        {/* Context Menu Trigger */}
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
                                                onDeleteChat(chat.id);
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

            {/* Pages Header */}
            <div className="p-4 py-2 border-b border-slate-800 flex items-center justify-between">
                <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pages</h2>
                <button
                    onClick={onCreatePage}
                    className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors"
                    title="New Page"
                >
                    <Plus size={14} />
                </button>
            </div>

            {/* Page List */}
            <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1 scrollbar-discreet">
                {pages.map(page => (
                    <div
                        key={page.id}
                        onClick={() => onNavigate(page.slug)}
                        className={`
                            group flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all border border-transparent
                            ${activePageId === page.id
                                ? 'bg-teal-500/10 text-teal-300 border-teal-500/20'
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

            {/* Footer Action - Removed generic "New Page" big button since we have specific + buttons now? Or keep? */}
            {/* Let's keep it but maybe context aware or just remove it to clean up UI since we typically add via chat or + button */}
        </div>
    );
};
