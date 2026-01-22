import React, { useState } from 'react';
import {
    Home,
    FileText,
    Plus,
    MoreVertical,
    Edit2,
    Trash2,
    ChevronLeft,
    PieChart,
    Settings,
    Code,
    Database,
    Cloud,
    Layout as LayoutIcon,
    Terminal
} from 'lucide-react';

const getPageIcon = (title, isHome) => {
    if (isHome) return <Home size={18} />;
    const lower = title.toLowerCase();
    
    if (lower.includes('analy') || lower.includes('dash')) return <PieChart size={18} />;
    if (lower.includes('conf') || lower.includes('set')) return <Settings size={18} />;
    if (lower.includes('code') || lower.includes('dev')) return <Code size={18} />;
    if (lower.includes('data') || lower.includes('sql')) return <Database size={18} />;
    if (lower.includes('api') || lower.includes('cloud')) return <Cloud size={18} />;
    if (lower.includes('console') || lower.includes('term')) return <Terminal size={18} />;
    
    return <FileText size={18} />;
};

export const SidebarNavigation = ({
    pages,
    activePageId,
    onNavigate,
    onCreatePage,
    onRenamePage,
    onDeletePage,
    onRequestDelete,

    onBackToHome,
    collapsed = false
}) => {
    const [editingId, setEditingId] = useState(null);
    const [editName, setEditName] = useState('');
    const [menuOpenId, setMenuOpenId] = useState(null);

    const handleCreatePage = async () => {
        const newPage = await onCreatePage();
        if (newPage) {
            setEditingId(newPage.id);
            setEditName(newPage.title);
            // Auto-navigate to it
            onNavigate(newPage.slug);
        }
    };

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
        <div className="w-full flex flex-col bg-slate-950 border-r border-slate-800 h-full select-none">
            {/* Project Header */}
            <div className={`p-4 border-b border-slate-800 shrink-0 ${collapsed ? 'flex justify-center' : ''}`}>
                <button
                    onClick={onBackToHome}
                    className={`flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm mb-0 ${collapsed ? 'justify-center p-2' : ''}`}
                    title="Back to Projects"
                >
                    <ChevronLeft size={16} />
                    {!collapsed && <span>Back to Projects</span>}
                </button>
            </div>



            {/* Pages Header */}
            {!collapsed && (
                <div className="p-4 py-2 flex items-center justify-between shrink-0">
                    <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pages</h2>
                    <button
                        onClick={handleCreatePage}
                        className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors"
                        title="New Page"
                    >
                        <Plus size={14} />
                    </button>
                </div>
            )}
            
            {/* Pages Header (Collapsed - "+" Button) */}
             {collapsed && (
                <div className="p-2 flex justify-center shrink-0 border-b border-slate-800/50">
                     <button
                        onClick={handleCreatePage}
                        className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
                        title="New Page"
                    >
                        <Plus size={16} />
                    </button>
                </div>
            )}

            {/* Page List - Fix scroll here */}
            <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1 scrollbar-discreet">
                {pages.map(page => (
                    <div
                        key={page.id}
                        onClick={() => onNavigate(page.slug)}
                        title={collapsed ? page.title : undefined}
                        className={`
                            group flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all border border-transparent
                            ${collapsed ? 'justify-center' : ''}
                            ${activePageId === page.id
                                ? 'bg-indigo-600/10 text-indigo-400 border-indigo-500/20'
                                : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'}
                        `}
                    >
                        {/* Icon */}
                        {getPageIcon(page.title, page.isHome)}

                        {/* Title (Editable) - Hide if collapsed */}
                        {!collapsed && (
                            editingId === page.id ? (
                                <input
                                    autoFocus
                                    type="text"
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    onBlur={() => handleSaveRename(page.id)}
                                    onKeyDown={(e) => handleKeyDown(e, page.id)}
                                    onClick={(e) => e.stopPropagation()}
                                    className="flex-1 bg-slate-800 text-white text-sm px-1.5 py-0.5 rounded outline-none border border-indigo-500 min-w-0"
                                />
                            ) : (
                                <span className="flex-1 text-sm font-medium truncate">{page.title}</span>
                            )
                        )}

                        {/* Context Menu Trigger - Hide if collapsed for cleaner look? Or show overlay? */}
                        {!collapsed && (
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
                                                    onRequestDelete(page);
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
                        )}
                    </div>
                ))}
            </div>

            {/* Footer Action - Removed generic "New Page" big button since we have specific + buttons now? Or keep? */}
            {/* Let's keep it but maybe context aware or just remove it to clean up UI since we typically add via chat or + button */}

            {/* DELETE MODAL */}

        </div>
    );
};
