import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Send, Bot, User, Loader2, StopCircle, CornerDownLeft, Sparkles, BrainCircuit, ChevronDown, CheckCircle2, Mic } from 'lucide-react';
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
    availableModels,
    width = 450 // Default width if not provided
}) => {
    const isCompact = width < 350; // Threshold for compact mode
    const [input, setInput] = useState('');
    const bottomRef = useRef(null);

    const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
    const [isModeMenuOpen, setIsModeMenuOpen] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const recognitionRef = useRef(null);
    const modeButtonRef = useRef(null);
    const modelButtonRef = useRef(null);
    const [modeDropdownPos, setModeDropdownPos] = useState({ top: 0, left: 0 });
    const [modelDropdownPos, setModelDropdownPos] = useState({ top: 0, left: 0 });

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

    const handleVoiceToggle = () => {
        if (isRecording) {
            // Stop recognition
            if (recognitionRef.current) {
                recognitionRef.current.stop();
            }
            setIsRecording(false);
        } else {
            // Start speech recognition
            try {
                const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
                
                if (!SpeechRecognition) {
                    alert('Speech recognition is not supported in your browser. Please use Chrome, Edge, or Safari.');
                    return;
                }

                const recognition = new SpeechRecognition();
                recognition.continuous = true;
                recognition.interimResults = true;
                recognition.lang = 'pt-BR'; // Portuguese

                recognition.onstart = () => {
                    setIsRecording(true);
                    console.log('Speech recognition started');
                };

                recognition.onresult = (event) => {
                    let finalTranscript = '';

                    // Only process final results to avoid duplication
                    for (let i = event.resultIndex; i < event.results.length; i++) {
                        if (event.results[i].isFinal) {
                            finalTranscript += event.results[i][0].transcript + ' ';
                        }
                    }

                    // Only add final transcripts to input
                    if (finalTranscript) {
                        setInput(prev => prev + finalTranscript);
                    }
                };

                recognition.onerror = (event) => {
                    console.error('Speech recognition error:', event.error);
                    setIsRecording(false);
                    
                    if (event.error === 'not-allowed') {
                        alert('Microphone access denied. Please allow microphone access and try again.');
                    } else if (event.error === 'no-speech') {
                        // Silent, just stop
                    } else {
                        alert(`Recognition error: ${event.error}`);
                    }
                };

                recognition.onend = () => {
                    setIsRecording(false);
                    console.log('Speech recognition ended');
                };

                recognitionRef.current = recognition;
                recognition.start();

            } catch (error) {
                console.error('Error starting speech recognition:', error);
                alert('Could not start speech recognition. Please check your browser compatibility.');
                setIsRecording(false);
            }
        }
    };

    const isChatEmpty = messages.length === 0;

    // Close one menu when the other opens
    useEffect(() => {
        if (isModelMenuOpen && isModeMenuOpen) {
            setIsModeMenuOpen(false);
        }
    }, [isModelMenuOpen]);

    useEffect(() => {
        if (isModeMenuOpen && isModelMenuOpen) {
            setIsModelMenuOpen(false);
        }
    }, [isModeMenuOpen]);

    return (
        <div className="flex flex-col h-full relative font-sans">

            {/* Header / Mode Selector - REMOVED, moving to bottom */}
            <div className={`transition-all duration-300 ${isChatEmpty ? 'absolute top-0 right-0 left-0 z-10' : ''}`}>
                {/* Empty header for now, or just invisible spacer if needed */}
            </div>


            {/* Content Area */}
            <div className={`flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800 transition-all duration-500 ${isChatEmpty ? 'flex items-center justify-center' : ''}`}>

                {isChatEmpty ? (
                    <div className={`w-full max-w-2xl -mt-20 flex flex-col items-center animate-in fade-in slide-in-from-bottom-4 duration-700 ${isCompact ? 'px-2' : 'px-6'}`}>
                        <div className="p-6 bg-slate-900/50 rounded-3xl mb-6 shadow-2xl shadow-indigo-500/5 border border-slate-800/50 relative group cursor-default">
                            <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-violet-500 rounded-3xl opacity-20 blur group-hover:opacity-30 transition-opacity" />
                            <BrainCircuit size={48} className="text-indigo-400 relative z-10" />
                        </div>
                        <h2 className="text-lg font-medium text-slate-200 mb-6">How can I help you today?</h2>

                        {/* Antigravity-style Input Container */}
                        <div className="w-full relative">
                            <div className="bg-slate-900/80 backdrop-blur-sm border border-slate-700/50 rounded-2xl shadow-2xl">
                                
                                {/* Main Input Field */}
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
                                    className="w-full bg-transparent px-4 py-3 text-sm text-slate-200 placeholder:text-slate-500 outline-none resize-none min-h-[50px] max-h-[200px]"
                                    autoFocus
                                    rows={1}
                                    style={{
                                        height: 'auto',
                                        overflowY: input.split('\n').length > 3 ? 'auto' : 'hidden'
                                    }}
                                    onInput={(e) => {
                                        e.target.style.height = 'auto';
                                        e.target.style.height = e.target.scrollHeight + 'px';
                                    }}
                                />

                                {/* Bottom Controls Bar */}
                                <div className="flex items-center gap-2 px-3 py-2 border-t border-slate-800/50">

                                    {/* Agent Mode Selector */}
                                    <div className="relative">
                                        <button
                                            onClick={() => setIsModeMenuOpen(!isModeMenuOpen)}
                                            className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                                        >
                                            <ChevronDown size={11} />
                                            {!isCompact && <span className="capitalize">{agentMode}</span>}
                                            {isCompact && <span className="capitalize">{agentMode === 'fast' ? '⚡' : '🧠'}</span>}
                                        </button>
                                        {isModeMenuOpen && (
                                            <>
                                                <div className="fixed inset-0 z-[60]" onClick={() => setIsModeMenuOpen(false)} />
                                                <div className="absolute left-0 bottom-full mb-2 w-32 bg-slate-900 border border-slate-800 rounded-xl shadow-xl overflow-hidden z-[70]">
                                                    <div className="p-1">
                                                        <button
                                                            onClick={() => { setAgentMode('fast'); setIsModeMenuOpen(false); }}
                                                            className={`w-full text-left px-3 py-2 text-xs rounded-lg transition-colors flex items-center justify-between ${
                                                                agentMode === 'fast' 
                                                                    ? 'bg-indigo-600/20 text-indigo-300' 
                                                                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                                                            }`}
                                                        >
                                                            <span>Fast</span>
                                                            {agentMode === 'fast' && <CheckCircle2 size={12} className="text-indigo-400" />}
                                                        </button>
                                                        <button
                                                            onClick={() => { setAgentMode('planning'); setIsModeMenuOpen(false); }}
                                                            className={`w-full text-left px-3 py-2 text-xs rounded-lg transition-colors flex items-center justify-between ${
                                                                agentMode === 'planning' 
                                                                    ? 'bg-indigo-600/20 text-indigo-300' 
                                                                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                                                            }`}
                                                        >
                                                            <span>Planning</span>
                                                            {agentMode === 'planning' && <CheckCircle2 size={12} className="text-indigo-400" />}
                                                        </button>
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    {/* Model Selector */}
                                    <div className="relative">
                                        <button
                                            onClick={() => setIsModelMenuOpen(!isModelMenuOpen)}
                                            className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                                        >
                                            <ChevronDown size={11} />
                                            <span className={`max-w-[100px] truncate text-[10px] ${isCompact ? 'hidden' : 'block'}`}>
                                                {availableModels.find(m => m.name === selectedModel)?.displayName || selectedModel}
                                            </span>
                                            {isCompact && <Bot size={14} />}
                                        </button>
                                        {isModelMenuOpen && (
                                            <>
                                                <div className="fixed inset-0 z-[60]" onClick={() => setIsModelMenuOpen(false)} />
                                                <div className="absolute left-0 bottom-full mb-2 w-64 bg-slate-900 border border-slate-800 rounded-xl shadow-xl overflow-hidden z-[70]">
                                                    <div className="p-1 max-h-60 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700">
                                                        {availableModels.map(m => (
                                                            <button
                                                                key={m.name}
                                                                onClick={() => { setSelectedModel(m.name); setIsModelMenuOpen(false); }}
                                                                className={`w-full text-left px-3 py-2 text-xs rounded-lg transition-colors flex items-center justify-between ${
                                                                    selectedModel === m.name 
                                                                        ? 'bg-indigo-600/20 text-indigo-300' 
                                                                        : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                                                                }`}
                                                            >
                                                                <span>{m.displayName || m.name}</span>
                                                                {selectedModel === m.name && <CheckCircle2 size={12} className="text-indigo-400" />}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    <div className="flex-1" /> {/* Spacer */}

                                    {/* Voice Input Button */}
                                    <button 
                                        onClick={handleVoiceToggle}
                                        className={`p-1 rounded transition-colors ${
                                            isRecording 
                                                ? 'text-red-400 bg-red-500/20 animate-pulse' 
                                                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                                        }`}
                                        title={isRecording ? 'Stop recording' : 'Voice input'}
                                    >
                                        <Mic size={16} className={isRecording ? 'animate-pulse' : ''} />
                                    </button>

                                    {/* Send Button */}
                                    <button
                                        onClick={isProcessing ? onStop : handleSend}
                                        disabled={!input.trim() && !isProcessing}
                                        className={`p-1.5 rounded-lg transition-all ${
                                            input.trim() || isProcessing
                                                ? 'bg-slate-700 hover:bg-slate-600 text-white' 
                                                : 'bg-slate-800/50 text-slate-600 cursor-not-allowed'
                                        }`}
                                    >
                                        {isProcessing ? <StopCircle size={16} /> : <Send size={16} />}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="p-4 space-y-6 min-h-full flex flex-col justify-end">
                        <div className="flex-1" /> {/* Spacer to push messages down if few, or fill */}

                        {messages.map((msg, idx) => (
                            <MessageBubble key={idx} message={msg} />
                        ))}

                        {/* Minimalist Thinking Indicator */}
                        {isProcessing && (
                            <div className="flex flex-col gap-1 items-start animate-in slide-in-from-bottom-2 duration-300 fade-in pl-1">
                                <div className="flex items-center gap-2 opacity-60">
                                    <div className="size-5 rounded-full flex items-center justify-center shrink-0 bg-indigo-600/50">
                                        <Bot size={10} className="text-white" />
                                    </div>
                                    <div className="flex gap-1 h-3 items-center">
                                        <div className="size-1 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                                        <div className="size-1 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                                        <div className="size-1 bg-indigo-400 rounded-full animate-bounce"></div>
                                    </div>
                                </div>
                            </div>
                        )}

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
                <div className="p-3 bg-slate-950 border-t border-slate-800 animate-in slide-in-from-bottom-10 fade-in duration-300">
                    <div className="bg-slate-900/80 backdrop-blur-sm border border-slate-700/50 rounded-2xl shadow-xl">
                        
                        {/* Main Input Field */}
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
                            className="w-full bg-transparent px-4 py-2.5 text-sm text-slate-200 placeholder:text-slate-500 outline-none resize-none min-h-[40px] max-h-[180px]"
                            rows={1}
                            style={{
                                height: 'auto',
                                overflowY: input.split('\n').length > 3 ? 'auto' : 'hidden'
                            }}
                            onInput={(e) => {
                                e.target.style.height = 'auto';
                                e.target.style.height = e.target.scrollHeight + 'px';
                            }}
                        />

                        {/* Bottom Controls Bar */}
                        <div className="flex items-center gap-2 px-3 py-1.5 border-t border-slate-800/50">

                            {/* Agent Mode Selector */}
                            <div className="relative">
                                <button
                                    ref={modeButtonRef}
                                    onClick={() => {
                                        if (modeButtonRef.current) {
                                            const rect = modeButtonRef.current.getBoundingClientRect();
                                            setModeDropdownPos({ top: rect.top, left: rect.left });
                                        }
                                        setIsModeMenuOpen(!isModeMenuOpen);
                                    }}
                                    className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                                >
                                    <ChevronDown size={10} />
                                    {!isCompact && <span className="capitalize">{agentMode}</span>}
                                    {isCompact && <span className="capitalize">{agentMode === 'fast' ? '⚡' : '🧠'}</span>}
                                </button>
                                
                                <FloatingMenu
                                    isOpen={isModeMenuOpen}
                                    onClose={() => setIsModeMenuOpen(false)}
                                    position={modeDropdownPos}
                                    width={140}
                                >
                                    <div className="p-1">
                                        <button
                                            onClick={() => { setAgentMode('fast'); setIsModeMenuOpen(false); }}
                                            className={`w-full text-left px-3 py-2 text-xs rounded-lg transition-colors flex items-center justify-between ${
                                                agentMode === 'fast' 
                                                    ? 'bg-indigo-600/20 text-indigo-300' 
                                                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                                            }`}
                                        >
                                            <span>Fast</span>
                                            {agentMode === 'fast' && <CheckCircle2 size={11} className="text-indigo-400" />}
                                        </button>
                                        <button
                                            onClick={() => { setAgentMode('planning'); setIsModeMenuOpen(false); }}
                                            className={`w-full text-left px-3 py-2 text-xs rounded-lg transition-colors flex items-center justify-between ${
                                                agentMode === 'planning' 
                                                    ? 'bg-indigo-600/20 text-indigo-300' 
                                                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                                            }`}
                                        >
                                            <span>Planning</span>
                                            {agentMode === 'planning' && <CheckCircle2 size={11} className="text-indigo-400" />}
                                        </button>
                                    </div>
                                </FloatingMenu>
                            </div>

                            {/* Model Selector */}
                            <div className="relative">
                                <button
                                    ref={modelButtonRef}
                                    onClick={() => {
                                        if (modelButtonRef.current) {
                                            const rect = modelButtonRef.current.getBoundingClientRect();
                                            setModelDropdownPos({ top: rect.top, left: rect.left });
                                        }
                                        setIsModelMenuOpen(!isModelMenuOpen);
                                    }}
                                    className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                                >
                                    <ChevronDown size={10} />
                                    <span className={`max-w-[90px] truncate text-[9px] ${isCompact ? 'hidden' : 'block'}`}>
                                        {availableModels.find(m => m.name === selectedModel)?.displayName || selectedModel}
                                    </span>
                                    {isCompact && <Bot size={13} />}
                                </button>

                                <FloatingMenu
                                    isOpen={isModelMenuOpen}
                                    onClose={() => setIsModelMenuOpen(false)}
                                    position={modelDropdownPos}
                                    width={240}
                                >
                                    <div className="p-1 max-h-60 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700">
                                        {availableModels.map(m => (
                                            <button
                                                key={m.name}
                                                onClick={() => { setSelectedModel(m.name); setIsModelMenuOpen(false); }}
                                                className={`w-full text-left px-3 py-2 text-xs rounded-lg transition-colors flex items-center justify-between ${
                                                    selectedModel === m.name 
                                                        ? 'bg-indigo-600/20 text-indigo-300' 
                                                        : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                                                }`}
                                            >
                                                <span>{m.displayName || m.name}</span>
                                                {selectedModel === m.name && <CheckCircle2 size={11} className="text-indigo-400" />}
                                            </button>
                                        ))}
                                    </div>
                                </FloatingMenu>
                            </div>

                            <div className="flex-1" /> {/* Spacer */}

                            {/* Voice Input Button */}
                            <button 
                                onClick={handleVoiceToggle}
                                className={`p-1 rounded transition-colors ${
                                    isRecording 
                                        ? 'text-red-400 bg-red-500/20 animate-pulse' 
                                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                                }`}
                                title={isRecording ? 'Stop recording' : 'Voice input'}
                            >
                                <Mic size={14} className={isRecording ? 'animate-pulse' : ''} />
                            </button>

                            {/* Send Button */}
                            <button
                                onClick={isProcessing ? onStop : handleSend}
                                disabled={!input.trim() && !isProcessing}
                                className={`p-1 rounded-lg transition-all ${
                                    input.trim() || isProcessing
                                        ? 'bg-slate-700 hover:bg-slate-600 text-white' 
                                        : 'bg-slate-800/50 text-slate-600 cursor-not-allowed'
                                }`}
                            >
                                {isProcessing ? <StopCircle size={14} /> : <Send size={14} />}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// Portal-based Floating Menu
const FloatingMenu = ({ isOpen, onClose, position, children, width = 200 }) => {
    if (!isOpen) return null;

    // Calculate position: display ABOVE the button by default (since buttons are at bottom)
    // but check for fit? For now, hardcode "above" logic: bottom = screenHeight - rect.top
    const style = {
        position: 'fixed',
        left: position.left,
        bottom: window.innerHeight - position.top + 8, // 8px Gap
        width: width,
        zIndex: 9999
    };

    return createPortal(
        <>
            <div className="fixed inset-0 z-[9998]" onClick={onClose} />
            <div 
                className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
                style={style}
            >
                {children}
            </div>
        </>,
        document.body
    );
};
