import React, { useState } from 'react';
import { User, Bot, CheckCircle2, Circle, ChevronDown, ChevronRight, Play, ExternalLink, Terminal, Brain } from 'lucide-react';

export const MessageBubble = ({ message }) => {
    const isUser = message.role === 'user';
    const isModel = message.role === 'model';

    // Parse "Thoughts" and "Tools" from message text if structured, 
    // OR if backend sends them as separate fields (future proof).
    // For now, let's assume `message.thoughts` and `message.tool_calls` might exist later.
    // If not, we might parse specific mock tags like <thought>...</thought>.

    // TEMPORARY: Basic Markdown rendering
    // We will enhance this once backend sends structured data.

    return (
        <div className={`flex gap-4 ${isUser ? 'flex-row-reverse' : ''} group animate-in slide-in-from-bottom-2 duration-300 fade-in`}>
            <div className={`size-8 rounded-full flex items-center justify-center shrink-0 mt-1 ${isUser ? 'bg-slate-700' : 'bg-indigo-600'}`}>
                {isUser ? <User size={14} className="text-white" /> : <Bot size={14} className="text-white" />}
            </div>

            <div className={`flex-1 max-w-[90%]`}>
                {/* Name / Time (Optional) */}
                <div className={`text-[10px] text-slate-500 mb-1 ${isUser ? 'text-right' : 'text-left'}`}>
                    {isUser ? 'You' : 'Assistant'}
                </div>

                <div className={`relative p-4 rounded-2xl ${isUser
                        ? 'bg-slate-800 text-slate-100 rounded-tr-sm'
                        : 'bg-slate-900 border border-slate-800 text-slate-300 rounded-tl-sm'
                    }`}>

                    {/* THOUGHT BUBBLE (Collapsible) */}
                    {message.thought && (
                        <ThoughtBlock text={message.thought} />
                    )}

                    {/* MAIN CONTENT */}
                    <div className="prose prose-invert prose-sm max-w-none leading-relaxed whitespace-pre-wrap">
                        {message.text}
                    </div>

                    {/* TOOL EXECUTIONS (Structured) */}
                    {message.toolCalls && message.toolCalls.length > 0 && (
                        <div className="mt-4 space-y-2">
                            {message.toolCalls.map((tool, i) => (
                                <ToolBrick key={i} tool={tool} />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const ThoughtBlock = ({ text }) => {
    const [isOpen, setIsOpen] = useState(false);
    return (
        <div className="mb-4">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 text-xs font-semibold text-violet-400 hover:text-violet-300 transition-colors bg-violet-500/10 px-3 py-1.5 rounded-full select-none"
            >
                <Brain size={12} />
                <span>Thought Process</span>
                {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </button>

            {isOpen && (
                <div className="mt-2 text-xs text-slate-400 bg-slate-950/50 p-3 rounded-lg border border-indigo-500/20 italic font-mono leading-relaxed animate-in fade-in zoom-in-95 duration-200">
                    {text}
                </div>
            )}
        </div>
    );
}

const ToolBrick = ({ tool }) => {
    // tool: { name, args, status, result }
    const [isOpen, setIsOpen] = useState(false);
    return (
        <div className="border border-slate-800 bg-slate-950/30 rounded-lg overflow-hidden text-xs">
            <div
                className="flex items-center justify-between p-2 cursor-pointer hover:bg-slate-800/50 transition-colors"
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className="flex items-center gap-2 text-slate-400">
                    <Terminal size={12} className="text-emerald-500" />
                    <span className="font-mono text-emerald-400">{tool.name}</span>
                    <span className="text-slate-600">({Object.keys(tool.args || {}).length} args)</span>
                </div>
                {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </div>

            {isOpen && (
                <div className="p-2 border-t border-slate-800 bg-slate-950/50 font-mono text-slate-500 overflow-x-auto">
                    <div className="mb-1 text-[10px] uppercase text-slate-600">Input</div>
                    <pre>{JSON.stringify(tool.args, null, 2)}</pre>

                    {/* Include result if available */}
                    {tool.result && (
                        <>
                            <div className="mt-2 mb-1 text-[10px] uppercase text-slate-600">Result</div>
                            <pre className="text-slate-400">{JSON.stringify(tool.result, null, 2)}</pre>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
