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
    onClose, // If strictly closing
    // Collapse control
    onCollapseChange, // Callback when collapse state changes
    isCollapsed: externalIsCollapsed // Controlled by parent
}) => {
    const [width, setWidth] = useState(450);

    const [isResizing, setIsResizing] = useState(false);
    const startXRef = useRef(0);
    const startWidthRef = useRef(0);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(false); // Internal state

    const sidebarRef = useRef(null);

    // Sync with parent's collapsed state
    useEffect(() => {
        if (externalIsCollapsed !== undefined && externalIsCollapsed !== isCollapsed) {
            setIsCollapsed(externalIsCollapsed);
        }
    }, [externalIsCollapsed]);

    // Notify parent when collapse state changes
    useEffect(() => {
        if (onCollapseChange) {
            onCollapseChange(isCollapsed);
        }
    }, [isCollapsed, onCollapseChange]);

    // Resizing Logic - DELTA BASED
    useEffect(() => {
        const handleMouseMove = (e) => {
            if (!isResizing) return;
            
            // Calculate delta: Positive if moved LEFT (growing), Negative if moved RIGHT (shrinking)
            // startX (larger) - currentX (smaller) = positive delta
            const delta = startXRef.current - e.clientX;
            const newWidth = startWidthRef.current + delta;

            // Apply limits: 250px min, 1000px max
            if (newWidth < 250) {
                setWidth(250);
            } else if (newWidth > 1000) {
                setWidth(1000);
            } else {
                setWidth(newWidth);
            }
        };

        const handleMouseUp = () => {
            setIsResizing(false);
            document.body.style.cursor = ''; // Reset cursor
            document.body.style.userSelect = ''; // Re-enable text selection
        };

        if (isResizing) {
            document.body.style.cursor = 'ew-resize'; // Show resize cursor globally
            document.body.style.userSelect = 'none'; // Prevent text selection while dragging
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

    // When collapsed, don't render anything - the button will be in the header
    if (isCollapsed) {
        return null;
    }

    return (
        <div
            className={`h-full bg-slate-950 border-l border-slate-800 flex shadow-2xl relative ${isResizing ? 'transition-none' : 'transition-all duration-300'}`}
            style={{ width: `${width}px`, minWidth: '250px', maxWidth: '1000px' }}
        >
            {/* Resizer Handle - Enhanced visibility and Hit Area */}
            <div
                className="absolute left-0 top-0 bottom-0 w-4 -ml-2 cursor-ew-resize hover:bg-indigo-500/10 active:bg-indigo-500/20 transition-all z-50 group flex items-center justify-center"
                onMouseDown={(e) => {
                    e.preventDefault(); // Prevent text selection start
                    startXRef.current = e.clientX;
                    startWidthRef.current = width;
                    setIsResizing(true);
                }}
                title="Arrastar para redimensionar"
            >
                <div className="h-16 w-1 bg-slate-500 rounded-full opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity" />
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col h-full overflow-hidden relative">

                {/* Header / Top Bar */}
                <div className="h-14 border-b border-slate-800 flex items-center justify-between px-4 bg-slate-900/50">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={toggleCollapse}
                            className="p-1.5 hover:bg-slate-800 rounded-md text-slate-400 hover:text-white transition-colors"
                            title="Minimize Chat"
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
                        <span className="font-semibold text-slate-200">
                            {chats.find(c => c.id === activeChatId)?.title || 'New Chat'}
                        </span>
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
                    </div>
                </div>

                {/* Inner Layout: Sidebar + Main */}
                <div className="flex-1 flex overflow-hidden relative">
                    {/* Sidebar Overlay (or Push based on preference, let's do Push for width sharing or Overlay for simpler mobile-ish feel) */}
                    {/* Given "Antigravity" style usually implies a clean dedicated panel. Let's make it an Overlay on the left side of the chat panel. */}

                    <div className={cn(
                        "absolute top-0 bottom-0 left-0 bg-slate-900 border-r border-slate-800 transform transition-transform duration-300 z-20",
                        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
                    )}
                    style={{ width: width < 300 ? '100%' : '256px' }} // Responsive width: Full width if chat is narrow, else 256px
                    >
                        <ChatSidebar
                            chats={chats}
                            activeChatId={activeChatId}
                            onSelect={onNavigateChat}
                            onNew={onNewChat}
                            onDelete={onDeleteChat}
                            onRename={onRenameChat}
                            onClose={() => setIsSidebarOpen(false)}
                            width={width} // Pass width down if needed for internal adjustments
                        />
                    </div>

                    {/* Chat Main Stream */}
                    <div className="flex-1 flex flex-col min-w-0 bg-slate-950">
                        <ChatMain
                            width={width} // Pass width for responsive layout
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


