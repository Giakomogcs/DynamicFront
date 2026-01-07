import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles } from 'lucide-react';
import { DynamicWidget } from './DynamicWidget';

export const Chat = ({ messages, onSendMessage, isProcessing, onStop }) => {
    const [input, setInput] = useState('');
    const bottomRef = useRef(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = () => {
        if (!input.trim() || isProcessing) return;
        onSendMessage(input);
        setInput('');
    };

    return (
        <div className="flex flex-col h-full w-full bg-slate-900/30 border-r border-slate-800">
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {(!messages || messages.length === 0) && (
                    <div className="flex flex-col items-center justify-center h-full text-slate-500 opacity-60">
                        <Sparkles size={32} className="mb-4 text-indigo-500" />
                        <p className="text-sm font-medium">AI Assistant</p>
                    </div>
                )}

                {Array.isArray(messages) && messages.map((msg, idx) => (
                    <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                        <div className={`size-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-slate-700' : 'bg-indigo-600'}`}>
                            {msg.role === 'user' ? <User size={14} className="text-white" /> : <Bot size={14} className="text-white" />}
                        </div>

                        <div className={`flex-1 max-w-[85%] space-y-2`}>
                            <div className={`p-3 rounded-2xl ${msg.role === 'user' ? 'bg-slate-800 text-white rounded-tr-none' : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-none'}`}>
                                <div className="prose prose-invert max-w-none text-xs sm:text-sm leading-relaxed whitespace-pre-wrap">
                                    {msg.text}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
                <div ref={bottomRef} />
                {isProcessing && (
                    <div className="flex justify-start animate-fade-in px-4 pb-4">
                        <div className="bg-slate-800 text-slate-200 p-3 rounded-2xl rounded-tl-none animate-pulse flex items-center gap-2 w-fit">
                            <Sparkles size={14} className="text-indigo-400" />
                            <span className="text-xs font-medium text-indigo-200">Analyzing...</span>
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
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-all disabled:opacity-0 disabled:scale-90"
                        >
                            <Send size={16} />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
