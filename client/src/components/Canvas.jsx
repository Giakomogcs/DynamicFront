import React from 'react';
import { DynamicWidget } from './DynamicWidget';
import { Sparkles, LayoutDashboard } from 'lucide-react';
import { CanvasNavigator } from './CanvasNavigator';

export const Canvas = ({ widgets, loading, canvasId, onNavigate }) => {
    if ((!widgets || widgets.length === 0) && !loading) {
        return (
            <div className="flex-1 h-full flex flex-col items-center justify-center bg-slate-950">
                <div className="flex flex-col items-center max-w-md text-center">
                    <LayoutDashboard size={64} className="mb-6 text-indigo-500/30" />
                    <h2 className="text-2xl font-semibold text-slate-200 mb-2">Canvas Workspace</h2>
                    <p className="text-sm text-slate-500">
                        Charts, tables, and insights will appear here.
                        <br />
                        Start chatting to create visualizations.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 h-full flex flex-col bg-slate-950 overflow-hidden">
            {canvasId && <CanvasNavigator canvasId={canvasId} onNavigate={onNavigate} />}
            <div className="flex-1 overflow-y-auto">
                <div className="min-h-full p-6">
                    <div className="max-w-7xl mx-auto space-y-6">
                        <header className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-800/50">
                            <Sparkles className="text-indigo-400" size={24} />
                            <h2 className="text-xl font-semibold text-white">Dashboard</h2>
                            <span className="text-xs text-slate-500 bg-slate-900 px-3 py-1.5 rounded-full ml-auto border border-slate-800">
                                {widgets.length} Widget{widgets.length !== 1 && 's'}
                            </span>
                            {loading && <span className="text-xs text-indigo-400 animate-pulse">Updating...</span>}
                        </header>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-8">
                            {widgets.map((widget, idx) => (
                                <div key={idx} className={`
                                    ${widget.type === 'table' || widget.type === 'insight' || widget.type === 'expandable' ? 'col-span-1 lg:col-span-2' : 'col-span-1'}
                                    animate-fade-in
                                `}>
                                    <DynamicWidget {...widget} />
                                </div>
                            ))}

                            {loading && (
                                <div className="col-span-1 lg:col-span-2 h-40 bg-slate-900/30 rounded-xl border border-slate-800/50 flex flex-col items-center justify-center animate-pulse">
                                    <Sparkles className="text-indigo-500/50 mb-3" size={32} />
                                    <span className="text-sm text-slate-400 font-medium">Generating widgets...</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
