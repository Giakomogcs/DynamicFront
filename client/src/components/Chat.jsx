import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles, ChevronLeft, ChevronRight, Edit2 } from 'lucide-react';
import { DynamicWidget } from './DynamicWidget';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
    return twMerge(clsx(inputs));
}

export const Chat = ({ messages, onSendMessage, isProcessing, onStop, collapsed, onToggleCollapse, onEditMessage, showControls = true }) => {
    const [input, setInput] = useState('');
    const [editingIndex, setEditingIndex] = useState(null);
    const bottomRef = useRef(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = () => {
        if (!input.trim() || isProcessing) return;
        onSendMessage(input);
        setInput('');
        setEditingIndex(null);
    };

    const handleEditMessage = (index) => {
        const messageToEdit = messages[index];
        if (messageToEdit.role !== 'user') return;

        setInput(messageToEdit.text);
        setEditingIndex(index);

        // Notify parent to remove this message and all subsequent ones
        if (onEditMessage) {
            onEditMessage(index);
        }
    };

    if (collapsed) {
        return (
            <div className="w-12 bg-slate-900/30 border-r border-slate-800 flex flex-col items-center py-4 relative">
                <button
                    onClick={onToggleCollapse}
                    className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
                    title="Expand chat"
                >
                    <ChevronRight size={20} className="text-slate-400" />
                </button>
                <div className="flex-1 flex items-center justify-center">
                    <div className="writing-vertical text-xs text-slate-500 font-medium">
                        Chat
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full w-full bg-slate-900/30 border-r border-slate-800 relative">
            {/* Minimize Button */}
            {showControls && (
                <button
                    onClick={onToggleCollapse}
                    className="absolute -right-3 top-4 z-50 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-full p-1 transition-colors"
                    title="Minimize chat"
                >
                    <ChevronLeft size={14} className="text-slate-400" />
                </button>
            )}

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {(!messages || messages.length === 0) && (
                    <div className="flex flex-col items-center justify-center h-full text-slate-500 opacity-60">
                        <Sparkles size={32} className="mb-4 text-indigo-500" />
                        <p className="text-sm font-medium">AI Assistant</p>
                    </div>
                )}

                {Array.isArray(messages) && messages.map((msg, idx) => {
                    const isLastUserMessage = msg.role === 'user' && idx === messages.findLastIndex(m => m.role === 'user');

                    return (
                        <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''} group`}>
                            <div className={`size-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-slate-700' : 'bg-indigo-600'}`}>
                                {msg.role === 'user' ? <User size={14} className="text-white" /> : <Bot size={14} className="text-white" />}
                            </div>

                            <div className={`flex-1 max-w-[85%] space-y-2`}>
                                <div className={`relative p-3 rounded-2xl ${msg.role === 'user' ? 'bg-slate-800 text-white rounded-tr-none' : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-none'}`}>
                                    <div className={cn(
                                        "prose prose-invert max-w-none text-xs sm:text-sm leading-relaxed whitespace-pre-wrap overflow-x-auto",
                                        (msg.text.startsWith('Error:') || msg.text.includes('System Limit')) && "p-2 bg-red-500/10 border border-red-500/20 rounded-lg text-red-200"
                                    )}>
                                        {msg.text}
                                    </div>

                                    {/* Edit button for last user message */}
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

            <div className="p-4 bg-slate-950 border-t border-slate-800 z-10">
                <div className="relative flex gap-2">
                    <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSend();
                            }
                        }}
                        placeholder="Type a message..."
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 pr-12 text-sm text-white focus:ring-1 focus:ring-indigo-500 outline-none resize-none h-[52px]"
                        disabled={isProcessing}
                    />

                    {isProcessing ? (
                        <button
                            onClick={onStop}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/30 rounded-lg transition-all"
                            title="Stop Generation"
                        >
                            <div className="size-4 bg-current rounded-[2px]" />
                        </button>
                    ) : (
                        <button
                            onClick={handleSend}
                            disabled={!input.trim()}
                            className={cn(
                                "absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-all",
                                !input.trim()
                                    ? "bg-slate-700 text-slate-500 cursor-not-allowed opacity-50"
                                    : "bg-indigo-600 hover:bg-indigo-500 text-white hover:scale-105"
                            )}
                            title={editingIndex !== null ? "Send edited message" : "Send message"}
                        >
                            <Send size={16} />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
