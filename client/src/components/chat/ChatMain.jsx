import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2, StopCircle, CornerDownLeft, Sparkles, BrainCircuit, ChevronDown, CheckCircle2 } from 'lucide-react';
import { MessageBubble } from './MessageBubble';

export const ChatMain = ({
    messages,
    onSendMessage,
    isProcessing,
    onStop,
    agentMode,
    setAgentMode,
    selectedModel,
    setSelectedModel,
    availableModels
}) => {
    const [input, setInput] = useState('');
    const bottomRef = useRef(null);

    const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);

    // Auto-scroll
    useEffect(() => {
        if (bottomRef.current) {
            bottomRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, isProcessing]);

    const handleSend = () => {
        if (!input.trim() || isProcessing) return;
        onSendMessage(input);
        setInput('');
    };

    const isChatEmpty = messages.length === 0;

    return (
        <div className="flex flex-col h-full relative font-sans">

            {/* Header / Mode Selector - REMOVED, moving to bottom */}
            <div className={`transition-all duration-300 ${isChatEmpty ? 'absolute top-0 right-0 left-0 z-10' : ''}`}>
                {/* Empty header for now, or just invisible spacer if needed */}
            </div>


            {/* Content Area */}
            <div className={`flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800 transition-all duration-500 ${isChatEmpty ? 'flex items-center justify-center' : ''}`}>

                {isChatEmpty ? (
                    <div className="w-full max-w-md px-6 -mt-20 flex flex-col items-center animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <div className="p-6 bg-slate-900/50 rounded-3xl mb-6 shadow-2xl shadow-indigo-500/5 border border-slate-800/50 relative group cursor-default">
                            <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-violet-500 rounded-3xl opacity-20 blur group-hover:opacity-30 transition-opacity" />
                            <BrainCircuit size={48} className="text-indigo-400 relative z-10" />
                        </div>
                        <h2 className="text-lg font-medium text-slate-200 mb-6">How can I help you today?</h2>

                        {/* Centered Input (Moved here for empty state) */}
                        <div className="w-full relative group">

                            {/* Input Controls (Top of box) */}
                            <div className="absolute -top-3 left-4 z-20 flex gap-2">
                                <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-700 shadow-lg">
                                    <button
                                        onClick={() => setAgentMode('fast')}
                                        className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${agentMode === 'fast' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
                                    >
                                        Fast
                                    </button>
                                    <button
                                        onClick={() => setAgentMode('planning')}
                                        className={`px-3 py-1 text-xs font-medium rounded-md transition-all flex items-center gap-1 ${agentMode === 'planning' ? 'bg-violet-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
                                    >
                                        <Sparkles size={10} /> Planning
                                    </button>
                                </div>
                            </div>

                            <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500/20 to-violet-500/20 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity blur" />
                            <div className="relative bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl">
                                <textarea
                                    value={input}
                                    onChange={e => setInput(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            handleSend();
                                        }
                                    }}
                                    placeholder="Ask anything..."
                                    className="w-full bg-transparent p-4 pr-12 min-h-[50px] max-h-[120px] resize-none focus:outline-none text-sm text-slate-200 placeholder:text-slate-600"
                                    autoFocus
                                />
                                <button
                                    onClick={isProcessing ? onStop : handleSend}
                                    disabled={!input.trim() && !isProcessing}
                                    className={`absolute right-2 bottom-2 p-1.5 rounded-xl transition-all ${input.trim() ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20 scale-100' : 'bg-slate-900 text-slate-600 scale-90 opacity-50'
                                        }`}
                                >
                                    {isProcessing ? <StopCircle size={18} /> : <CornerDownLeft size={18} />}
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="p-4 space-y-6 min-h-full flex flex-col justify-end">
                        <div className="flex-1" /> {/* Spacer to push messages down if few, or fill */}

                        {messages.map((msg, idx) => (
                            <MessageBubble key={idx} message={msg} />
                        ))}

                        {isProcessing && (
                            <div className="flex justify-start animate-fade-in pl-10 py-2">
                                <div className="flex items-center gap-2 text-slate-500 text-xs">
                                    <Loader2 size={14} className="animate-spin text-indigo-500" />
                                    <span className="animate-pulse">Reasoning...</span>
                                </div>
                            </div>
                        )}
                        <div ref={bottomRef} />
                    </div>
                )}
            </div>

            {/* Bottom Input (Only visible if NOT empty) */}
            {!isChatEmpty && (
                <div className="p-4 pt-2 bg-slate-950 border-t border-slate-800 animate-in slide-in-from-bottom-10 fade-in duration-300">

                    {/* Controls Bar */}
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1 bg-slate-900/50 p-1 rounded-lg border border-slate-800/50">
                            <button
                                onClick={() => setAgentMode('fast')}
                                className={`px-2 py-1 text-xs font-medium rounded-md transition-all ${agentMode === 'fast' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:text-slate-200'}`}
                            >
                                Fast
                            </button>
                            <button
                                onClick={() => setAgentMode('planning')}
                                className={`px-2 py-1 text-xs font-medium rounded-md transition-all flex items-center gap-1 ${agentMode === 'planning' ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/20' : 'text-slate-400 hover:text-slate-200'}`}
                            >
                                <Sparkles size={10} /> Planning
                            </button>
                        </div>

                        {/* Mini Model Selector */}
                        <div className="relative">
                            <button
                                onClick={() => setIsModelMenuOpen(!isModelMenuOpen)}
                                className="flex items-center gap-1 text-[10px] font-medium text-slate-500 hover:text-slate-300 transition-colors px-2 py-1 rounded hover:bg-slate-900"
                            >
                                <span>{availableModels.find(m => m.name === selectedModel)?.displayName || selectedModel}</span>
                            </button>
                            {isModelMenuOpen && (
                                <>
                                    <div className="fixed inset-0 z-10" onClick={() => setIsModelMenuOpen(false)} />
                                    <div className="absolute right-0 bottom-full mb-2 w-48 bg-slate-900 border border-slate-800 rounded-xl shadow-xl overflow-hidden z-20">
                                        <div className="p-1 max-h-60 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700">
                                            {availableModels.map(m => (
                                                <button
                                                    key={m.name}
                                                    onClick={() => { setSelectedModel(m.name); setIsModelMenuOpen(false); }}
                                                    className={`w-full text-left px-3 py-2 text-xs rounded-lg transition-colors flex items-center justify-between group ${selectedModel === m.name ? 'bg-indigo-600/10 text-indigo-400' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
                                                >
                                                    <span>{m.displayName || m.name}</span>
                                                    {selectedModel === m.name && <CheckCircle2 size={10} />}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="relative">
                        <textarea
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSend();
                                }
                            }}
                            placeholder="Type a message..."
                            className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 pr-12 min-h-[50px] max-h-[200px] resize-none focus:ring-1 focus:ring-indigo-500 outline-none text-sm text-slate-200 scrollbar-hide"
                        />

                        <button
                            onClick={isProcessing ? onStop : handleSend}
                            disabled={!input.trim() && !isProcessing}
                            className={`absolute right-2 bottom-2 p-2 rounded-lg transition-colors ${!input.trim() && !isProcessing ? 'text-slate-700 cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-500'
                                }`}
                        >
                            {isProcessing ? <StopCircle size={16} /> : <CornerDownLeft size={16} />}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
