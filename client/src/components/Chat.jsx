import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, ChevronRight, Edit2, Minus, Plus, History, MessageSquare, Trash2, MoreVertical, X, ChevronDown, ChevronUp } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
    return twMerge(clsx(inputs));
}

// Inline helper if not imported
function classNames(...classes) {
    return classes.filter(Boolean).join(' ');
}

export const Chat = ({
    messages,
    onSendMessage,
    isProcessing,
    onStop,
    collapsed,
    onToggleCollapse,
    onEditMessage,
    // New Props for Central Management
    chats = [],
    activeChatId,
    onNavigateChat,
    onNewChat
}) => {
    const [input, setInput] = useState('');
    const [editingIndex, setEditingIndex] = useState(null);
    const [showHistory, setShowHistory] = useState(false); // Default to Input Only? Or persist?
    const [isHistoryDropdownOpen, setIsHistoryDropdownOpen] = useState(false);

    const bottomRef = useRef(null);
    const historyRef = useRef(null);

    // Auto-scroll when history is shown or messages update
    useEffect(() => {
        if (showHistory && bottomRef.current) {
            bottomRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, showHistory]);

    const handleSend = () => {
        if (!input.trim() || isProcessing) return;
        onSendMessage(input);
        setInput('');
        setEditingIndex(null);
        setShowHistory(true); // Auto-open history on send
    };

    const handleEditMessage = (index) => {
        const messageToEdit = messages[index];
        if (messageToEdit.role !== 'user') return;

        setInput(messageToEdit.text);
        setEditingIndex(index);
        if (onEditMessage) onEditMessage(index);
    };

    // Group chats by session or simple list? App passes 'chats' which is flat list of canvases
    // We can just list them.

    return (
        <div className="flex flex-col h-full w-full bg-slate-900 border-r border-slate-800 relative">

            {/* 1. COMPONENT HEADER (Centralized Controls) */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-950/50 backdrop-blur-md z-10 shrink-0">
                <div className="flex items-center gap-2 relative">
                    {/* Minimize Button */}
                    <button
                        onClick={onToggleCollapse}
                        className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
                        title="Minimize Chat"
                    >
                        <Minus size={16} />
                    </button>

                    {/* Open History Dropdown (Mini Modal) */}
                    <div className="relative">
                        <button
                            onClick={() => setIsHistoryDropdownOpen(!isHistoryDropdownOpen)}
                            className={classNames(
                                "flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm font-medium transition-colors",
                                isHistoryDropdownOpen ? "bg-indigo-600 text-white" : "hover:bg-slate-800 text-slate-300"
                            )}
                            title="Switch Chat"
                        >
                            <History size={16} />
                            <span className="hidden sm:inline">History</span>
                            <ChevronDown size={14} className={cn("transition-transform", isHistoryDropdownOpen && "rotate-180")} />
                        </button>

                        {/* MINI MODAL: Session Chats History */}
                        {isHistoryDropdownOpen && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setIsHistoryDropdownOpen(false)} />
                                <div className="absolute top-full left-0 mt-2 w-64 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 flex flex-col max-h-[300px] overflow-hidden animate-in fade-in zoom-in-95 duration-200 origin-top-left">
                                    <div className="p-3 bg-slate-950 border-b border-slate-800">
                                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Previous Chats</h3>
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-1 scrollbar-thin scrollbar-thumb-slate-700">
                                        {chats.length === 0 ? (
                                            <div className="p-4 text-center text-xs text-slate-500">No history yet</div>
                                        ) : (
                                            chats.map(chat => (
                                                <button
                                                    key={chat.id}
                                                    onClick={() => {
                                                        onNavigateChat(chat.id); // Changed from slug to id
                                                        setIsHistoryDropdownOpen(false);
                                                    }}
                                                    className={classNames(
                                                        "w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors",
                                                        activeChatId === chat.id
                                                            ? "bg-indigo-500/10 text-indigo-300 border border-indigo-500/20"
                                                            : "text-slate-400 hover:bg-slate-800 hover:text-white"
                                                    )}
                                                >
                                                    <MessageSquare size={14} className="shrink-0" />
                                                    <span className="truncate flex-1">{chat.title}</span>
                                                    {activeChatId === chat.id && <div className="size-1.5 rounded-full bg-indigo-500 shrink-0" />}
                                                </button>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* Right Actions */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => {
                            if (onNewChat) onNewChat();
                            setShowHistory(false); // Reset view for new chat
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white rounded-lg text-xs font-medium transition-all border border-slate-700 hover:border-indigo-500"
                        title="New Chat"
                    >
                        <Plus size={14} />
                        New Chat
                    </button>
                </div>
            </div>

            {/* 2. CHAT HISTORY AREA (Collapsible) */}
            <div className="flex-1 overflow-hidden relative flex flex-col">
                {/* Toggle Overlay (When History Hidden) */}
                {!showHistory && messages.length > 0 && (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm z-0">
                        <button
                            onClick={() => setShowHistory(true)}
                            className="flex flex-col items-center gap-2 text-slate-400 hover:text-white transition-colors animate-pulse hover:animate-none"
                        >
                            <div className="p-3 bg-slate-800 rounded-full shadow-lg border border-slate-700">
                                <History size={20} />
                            </div>
                            <span className="text-xs font-medium">Show Conversation History</span>
                        </button>
                    </div>
                )}

                {/* Messages Container */}
                <div
                    ref={historyRef}
                    className={classNames(
                        "flex-1 overflow-y-auto p-4 space-y-6 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent transition-all duration-300",
                        showHistory ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                    )}
                >
                    {(!messages || messages.length === 0) && (
                        <div className="flex flex-col items-center justify-center h-full text-slate-500 opacity-50 space-y-4">
                            <Bot size={48} className="text-slate-700" />
                            <p className="text-sm">Start a new conversation...</p>
                        </div>
                    )}

                    {messages.map((msg, idx) => {
                        const isLastUserMessage = msg.role === 'user' && idx === messages.findLastIndex(m => m.role === 'user');
                        return (
                            <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''} group animate-in slide-in-from-bottom-2 duration-300 fade-in`}>
                                <div className={`size-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-slate-700' : 'bg-indigo-600'}`}>
                                    {msg.role === 'user' ? <User size={14} className="text-white" /> : <Bot size={14} className="text-white" />}
                                </div>

                                <div className={`flex-1 max-w-[85%] space-y-2`}>
                                    <div className={`relative p-3 rounded-2xl ${msg.role === 'user' ? 'bg-slate-800 text-white rounded-tr-none' : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-none'}`}>
                                        <div className={classNames(
                                            "prose prose-invert max-w-none text-xs sm:text-sm leading-relaxed whitespace-pre-wrap overflow-x-auto",
                                            (msg.text.startsWith('Error:') || msg.text.includes('System Limit')) && "p-2 bg-red-500/10 border border-red-500/20 rounded-lg text-red-200"
                                        )}>
                                            {msg.text}
                                        </div>

                                        {isLastUserMessage && !isProcessing && (
                                            <button
                                                onClick={() => handleEditMessage(idx)}
                                                className="absolute -bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-700 hover:bg-slate-600 p-1.5 rounded-lg border border-slate-600"
                                                title="Edit message"
                                            >
                                                <Edit2 size={12} className="text-slate-300" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    <div ref={bottomRef} />

                    {isProcessing && (
                        <div className="flex justify-start animate-fade-in px-4 pb-4">
                            <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-800/50 rounded-2xl rounded-tl-none border border-slate-700/50">
                                <span className="size-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                                <span className="size-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                                <span className="size-1.5 bg-indigo-500 rounded-full animate-bounce" />
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* 3. INPUT AREA (Always Visible) */}
            <div className="p-4 bg-slate-950 border-t border-slate-800 shrink-0 z-20">

                {/* Visibility Toggle (Quick Action) */}
                <div className="flex justify-center mb-2">
                    <button
                        onClick={() => setShowHistory(!showHistory)}
                        className="text-[10px] uppercase font-bold text-slate-600 hover:text-indigo-400 flex items-center gap-1 transition-colors"
                    >
                        {showHistory ? (
                            <>Hide History <ChevronDown size={12} /></>
                        ) : (
                            <>Show History <ChevronUp size={12} /></>
                        )}
                    </button>
                </div>

                <div className="relative flex gap-2 items-end">
                    <textarea
                        value={input}
                        onChange={(e) => {
                            setInput(e.target.value);
                            e.target.style.height = 'auto';
                            e.target.style.height = `${Math.min(e.target.scrollHeight, 150)}px`;
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSend();
                                // Reset height
                                setTimeout(() => {
                                    const ta = document.querySelector('textarea.chat-input');
                                    if (ta) ta.style.height = '52px';
                                }, 0);
                            }
                        }}
                        placeholder={showHistory ? "Type a message..." : "Type here to start..."}
                        className="chat-input w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 pr-12 text-sm text-white focus:ring-1 focus:ring-indigo-500 outline-none resize-none min-h-[52px] max-h-[150px] overflow-y-auto shadow-inner transition-all focus:bg-slate-800"
                        style={{ height: '52px' }}
                        disabled={isProcessing}
                    />

                    {isProcessing ? (
                        <button
                            onClick={onStop}
                            className="absolute right-2 bottom-2 p-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/30 rounded-lg transition-all"
                            title="Stop Generation"
                        >
                            <div className="size-3 bg-current rounded-[1px]" />
                        </button>
                    ) : (
                        <button
                            onClick={handleSend}
                            disabled={!input.trim()}
                            className={classNames(
                                "absolute right-2 bottom-2 p-2 rounded-lg transition-all",
                                !input.trim()
                                    ? "bg-slate-800 text-slate-600 cursor-not-allowed"
                                    : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20 hover:scale-105"
                            )}
                        >
                            <Send size={16} />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
