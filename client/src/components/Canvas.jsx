import React from 'react';
import { DynamicWidget } from './DynamicWidget';
import { Sparkles, LayoutDashboard } from 'lucide-react';

export const Canvas = ({ widgets, loading }) => {
    if ((!widgets || widgets.length === 0) && !loading) {

        return (
            <div className="flex-1 h-full flex flex-col items-center justify-center bg-slate-950 p-8 text-slate-500">
                <div className="bg-slate-900/50 p-8 rounded-3xl border border-slate-800/50 flex flex-col items-center max-w-md text-center">
                    <LayoutDashboard size={48} className="mb-4 text-indigo-500/50" />
                    <h2 className="text-xl font-medium text-slate-200 mb-2">Workspace Canvas</h2>
                    <p className="text-sm">
                        Charts, tables, and insights requested from the chat will appear here.
                        Try asking: "Show me a chart of sales."
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 h-full overflow-y-auto bg-slate-950 p-6 md:p-8">
            <div className="max-w-6xl mx-auto space-y-6">
                <header className="flex items-center gap-2 mb-8 border-b border-slate-800 pb-4">
                    <Sparkles className="text-indigo-400" size={20} />
                    <h2 className="text-lg font-medium text-white">Active Dashboard</h2>
                    <span className="text-xs text-slate-500 bg-slate-900 px-2 py-1 rounded ml-auto">
                        {widgets.length} Item{widgets.length !== 1 && 's'}
                    </span>
                    {loading && <span className="text-xs text-indigo-400 animate-pulse ml-2">Updating...</span>}
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 auto-rows-min pb-20">
                    {widgets.map((widget, idx) => (
                        <div key={idx} className={`
                            ${widget.type === 'table' || widget.type === 'insight' ? 'col-span-1 md:col-span-2' : 'col-span-1'}
                        `}>
                            <DynamicWidget {...widget} />
                        </div>
                    ))}

                    {loading && (
                        <div className="col-span-1 md:col-span-2 h-32 bg-slate-900/50 rounded-xl border border-slate-800/50 flex flex-col items-center justify-center animate-pulse">
                            <Sparkles className="text-indigo-500/50 mb-2" />
                            <span className="text-sm text-slate-500">Designing new widgets...</span>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
};
