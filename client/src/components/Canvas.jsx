import React, { useState, useMemo, useEffect } from 'react';
import { DynamicWidget } from './DynamicWidget';
import { Sparkles, LayoutDashboard } from 'lucide-react';
import { CanvasNavigator } from './CanvasNavigator';
import { ScreenSelector } from './ScreenSelector';

export const Canvas = ({ widgets, loading, canvasId, onNavigate, onAction }) => {
    // Screen State
    const [activeScreenId, setActiveScreenId] = useState('default');
    
    // Group widgets by screen
    const screens = useMemo(() => {
        const groups = {
            'default': { id: 'default', name: 'Main Screen', widgets: [] }
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
        <div className="flex-1 h-full flex flex-col bg-slate-950 overflow-hidden relative">
            {canvasId && <CanvasNavigator canvasId={canvasId} onNavigate={onNavigate} />}
            
            {/* Scrollable Container - Moved padding here to fix scroll issue */}
            <div className="flex-1 overflow-y-auto p-6 scroll-smooth">
                <div className="max-w-7xl mx-auto space-y-6 pb-24"> {/* Added pb-24 for screen selector space */}
                    <header className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-800/50">
                        <Sparkles className="text-indigo-400" size={24} />
                        <h2 className="text-xl font-semibold text-white">
                            {activeScreen.name}
                        </h2>
                        <span className="text-xs text-slate-500 bg-slate-900 px-3 py-1.5 rounded-full ml-auto border border-slate-800">
                            {visibleWidgets.length} Widget{visibleWidgets.length !== 1 && 's'}
                        </span>
                        {loading && <span className="text-xs text-indigo-400 animate-pulse">Updating...</span>}
                    </header>

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
                                />
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

            {/* Screen Selector - Only show if we have multiple screens or widgets to prompt creation (simulated) */}
            {screens.length > 0 && (
                <ScreenSelector 
                    screens={screens} 
                    activeScreenId={activeScreenId} 
                    onSelectScreen={setActiveScreenId}
                />
            )}
        </div>
    );
};
