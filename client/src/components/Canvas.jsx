import React, { useState, useMemo, useEffect } from 'react';
import { DynamicWidget } from './DynamicWidget';
import { Sparkles, LayoutDashboard } from 'lucide-react';
import { CanvasNavigator } from './CanvasNavigator';
import { ScreenSelector } from './ScreenSelector';

export const Canvas = ({ widgets, loading, canvasId, onNavigate, onAction, onRefresh }) => {
    // Screen State
    const [activeScreenId, setActiveScreenId] = useState('default');

    // Group widgets by screen
    const screens = useMemo(() => {
        const groups = {
            'default': { id: 'default', name: '', widgets: [] }
        };

        // If no widgets, just return default
        if (!widgets) return Object.values(groups);

        widgets.forEach(widget => {
            const screenId = widget.screenId || 'default';
            if (!groups[screenId]) {
                // If we discover a new screenId from backend, add it
                // Ideally backend sends screen metadata, but inferring is fine for now
                groups[screenId] = {
                    id: screenId,
                    name: widget.screenName || `Screen ${Object.keys(groups).length + 1}`,
                    widgets: []
                };
            }
            groups[screenId].widgets.push(widget);
        });

        // Convert to array and ensure default is first
        return Object.values(groups).sort((a, b) => a.id === 'default' ? -1 : 1);
    }, [widgets]);

    // Ensure active screen is valid
    useEffect(() => {
        if (!screens.find(s => s.id === activeScreenId)) {
            setActiveScreenId('default');
        }
    }, [screens, activeScreenId]);

    const activeScreen = screens.find(s => s.id === activeScreenId) || screens[0];
    const visibleWidgets = activeScreen?.widgets || [];

    // Empty State
    if ((!widgets || widgets.length === 0) && !loading) {
        return (
            <div className="flex-1 h-full flex flex-col items-center justify-center bg-slate-950">
                <div className="flex flex-col items-center max-w-md text-center p-8 rounded-2xl border border-dashed border-slate-800 bg-slate-900/30">
                    <div className="size-16 rounded-2xl bg-indigo-500/10 flex items-center justify-center mb-6">
                        <Sparkles size={32} className="text-indigo-400" />
                    </div>
                    <h2 className="text-xl font-semibold text-white mb-2">Ready to Analyze</h2>
                    <p className="text-sm text-slate-400 mb-6 leading-relaxed">
                        This page is empty. Use the <strong>AI Assistant</strong> on the right to generate charts, tables, and reports instantly.
                    </p>
                    <div className="flex gap-2 text-xs text-slate-500 bg-slate-950/50 px-4 py-3 rounded-lg border border-slate-800/50">
                        <LayoutDashboard size={14} />
                        <span>Try "Create a Sales Dashboard"</span>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 h-full flex flex-col bg-slate-950 overflow-hidden relative">


            {/* Scrollable Container - Moved padding here to fix scroll issue */}
            <div className="flex-1 overflow-y-auto p-6 scroll-smooth">
                <div className="max-w-7xl mx-auto space-y-6 pb-[50vh]"> {/* Added huge padding for floating chat */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-8">
                        {visibleWidgets.map((widget, idx) => (
                            <div key={`${activeScreenId}-${idx}`} className={`
                                ${widget.type === 'table' || widget.type === 'insight' || widget.type === 'expandable' ? 'col-span-1 lg:col-span-2' : 'col-span-1'}
                                animate-fade-in
                            `}>
                                <DynamicWidget
                                    {...widget}
                                    onAction={onAction}
                                    onNavigateScreen={(targetScreenId) => setActiveScreenId(targetScreenId)}
                                    onRefresh={onRefresh}
                                />
                            </div>
                        ))}

                    </div>
                </div>

                {/* Screen Selector - Only show if we have multiple screens */}
                {screens.length > 1 && (
                    <ScreenSelector
                        screens={screens}
                        activeScreenId={activeScreenId}
                        onSelectScreen={setActiveScreenId}
                    />
                )}
            </div>
        </div>
    );
};
