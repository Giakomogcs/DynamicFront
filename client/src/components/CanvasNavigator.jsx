import React, { useState, useEffect } from 'react';
import { Link2, ChevronRight, Layers } from 'lucide-react';

export const CanvasNavigator = ({ canvasId, onNavigate }) => {
    const [relatedCanvases, setRelatedCanvases] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (canvasId) {
            fetchRelatedCanvases();
        }
    }, [canvasId]);

    const fetchRelatedCanvases = async () => {
        setLoading(true);
        try {
            const res = await fetch(`http://localhost:3000/api/canvases/${canvasId}/related`);
            const data = await res.json();
            setRelatedCanvases(data);
        } catch (e) {
            console.error("Failed to fetch related canvases", e);
        } finally {
            setLoading(false);
        }
    };

    if (!relatedCanvases || relatedCanvases.length === 0) return null;

    return (
        <div className="flex items-center gap-2 px-4 py-2 bg-slate-900/50 border-b border-slate-800">
            <Link2 size={14} className="text-slate-500" />
            <span className="text-xs text-slate-500">Related:</span>
            <div className="flex items-center gap-2 flex-wrap">
                {relatedCanvases.slice(0, 3).map((canvas) => (
                    <button
                        key={canvas.id}
                        onClick={() => onNavigate(canvas.id)}
                        className="flex items-center gap-1 px-2 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition-colors"
                    >
                        <Layers size={12} />
                        <span>{canvas.title}</span>
                        {canvas.linkLabel && (
                            <span className="text-[10px] text-slate-500">({canvas.linkLabel})</span>
                        )}
                    </button>
                ))}
                {relatedCanvases.length > 3 && (
                    <span className="text-xs text-slate-500">+{relatedCanvases.length - 3} more</span>
                )}
            </div>
        </div>
    );
};
