import React, { useState, useEffect, useRef } from 'react';
import { PanelLeft, PanelRight, GripVertical, ChevronRight, ChevronLeft, History, X, Plus } from 'lucide-react';

import { ChatSidebar } from './ChatSidebar';
import { ChatMain } from './ChatMain';

export const ChatLayout = ({
    chats,
    activeChatId,
    messages,
    onSendMessage,
    onNewChat,
    onNavigateChat,
    onDeleteChat,
    onRenameChat,
    isProcessing,
    onStop,
    // Model/Mode props
    agentMode,
    setAgentMode,
    selectedModel,
    setSelectedModel,
    availableModels,
    onClose // If strictly closing
}) => {
    const [width, setWidth] = useState(450);
    const [isResizing, setIsResizing] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(false); // Minimized state

    const sidebarRef = useRef(null);

    // Resizing Logic
    useEffect(() => {
        const handleMouseMove = (e) => {
            if (!isResizing) return;
            // Calculate new width based on mouse position from RIGHT edge of screen? 
            // Or usually Chat is on the RIGHT side.
            // If on right side, width = window.innerWidth - e.clientX
            const newWidth = window.innerWidth - e.clientX;

            if (newWidth < 300) {
                // Snap to collapse if too small?
                // For now, hard limit
                setWidth(300);
            } else if (newWidth > 800) {
                setWidth(800);
            } else {
                setWidth(newWidth);
            }
        };

        const handleMouseUp = () => {
            setIsResizing(false);
        };

        if (isResizing) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        }
        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizing]);

    // Collapse Toggle
    const toggleCollapse = () => {
        setIsCollapsed(!isCollapsed);
    };

    if (isCollapsed) {
        return (
            <div className="fixed right-0 top-0 bottom-0 w-12 bg-slate-950 border-l border-slate-800 flex flex-col items-center py-4 z-50">
                <button
                    onClick={toggleCollapse}
                    className="p-2 bg-slate-800 rounded-lg text-slate-400 hover:text-white mb-4"
                    title="Expand Chat"
                >
                    <PanelRight size={20} />
                </button>
                {/* Vertical Text or Icons indicate status? */}
                <div className="writing-vertical-rl text-slate-500 text-xs font-mono tracking-widest uppercase rotate-180 flex-1 flex items-center justify-center gap-4">
                    <span>Antigravity Chat</span>
                </div>
            </div>
        );
    }

    return (
        <div
            className="fixed right-0 top-0 bottom-0 bg-slate-950 border-l border-slate-800 z-40 flex shadow-2xl transition-all duration-75"
            style={{ width: `${width}px` }}
        >
            {/* Resizer Handle */}
            <div
                className="absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-indigo-500/50 transition-colors z-50 group flex items-center justify-center"
                onMouseDown={() => setIsResizing(true)}
            >
                <div className="h-8 w-1 bg-slate-700 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col h-full overflow-hidden relative">

                {/* Header / Top Bar */}
                <div className="h-14 border-b border-slate-800 flex items-center justify-between px-4 bg-slate-900/50">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={toggleCollapse}
                            className="p-1.5 hover:bg-slate-800 rounded-md text-slate-400"
                        >
                            <ChevronRight size={18} />
                        </button>
                        <button
                            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                            className={cn(
                                "p-1.5 rounded-md transition-colors",
                                isSidebarOpen ? "bg-indigo-500/10 text-indigo-400" : "hover:bg-slate-800 text-slate-400"
                            )}
                            title="History"
                        >
                            <History size={18} />
                        </button>
                        <span className="font-semibold text-slate-200">Assistant</span>
                    </div>

                    <div className="flex items-center gap-1">
                        <button
                            onClick={onNewChat}
                            disabled={messages.length === 0}
                            className={`p-1.5 rounded-md transition-colors ${messages.length === 0
                                    ? 'text-slate-700 cursor-not-allowed'
                                    : 'hover:bg-slate-800 text-slate-400 hover:text-white'
                                }`}
                            title="New Chat"
                        >
                            <Plus size={18} />
                        </button>
                        <button
                            onClick={onClose} // Assuming onClose prop handles global close/collapse
                            className="p-1.5 hover:bg-slate-800 rounded-md text-slate-400 hover:text-white"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Inner Layout: Sidebar + Main */}
                <div className="flex-1 flex overflow-hidden relative">
                    {/* Sidebar Overlay (or Push based on preference, let's do Push for width sharing or Overlay for simpler mobile-ish feel) */}
                    {/* Given "Antigravity" style usually implies a clean dedicated panel. Let's make it an Overlay on the left side of the chat panel. */}

                    <div className={cn(
                        "absolute top-0 bottom-0 left-0 w-64 bg-slate-900 border-r border-slate-800 transform transition-transform duration-300 z-20",
                        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
                    )}>
                        <ChatSidebar
                            chats={chats}
                            activeChatId={activeChatId}
                            onSelect={onNavigateChat}
                            onNew={onNewChat}
                            onDelete={onDeleteChat}
                            onRename={onRenameChat}
                            onClose={() => setIsSidebarOpen(false)}
                        />
                    </div>

                    {/* Chat Main Stream */}
                    <div className="flex-1 flex flex-col min-w-0 bg-slate-950">
                        <ChatMain
                            messages={messages}
                            onSendMessage={onSendMessage}
                            isProcessing={isProcessing}
                            onStop={onStop}
                            // Props for Input
                            agentMode={agentMode}
                            setAgentMode={setAgentMode}
                            selectedModel={selectedModel}
                            setSelectedModel={setSelectedModel}
                            availableModels={availableModels}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

// Simple utility inline
function cn(...classes) {
    return classes.filter(Boolean).join(' ');
}


