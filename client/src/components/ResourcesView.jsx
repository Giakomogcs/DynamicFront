import React, { useState, useEffect } from 'react';
import { Trash2, Database, Globe, Loader2, AlertCircle, Eye, RefreshCw, Pencil } from 'lucide-react';

export const ResourcesView = ({ onEdit }) => {
    const [resources, setResources] = useState({ apis: [], dbs: [] });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [deletingId, setDeletingId] = useState(null);

    const fetchResources = async () => {
        try {
            console.log('[ResourcesView] Fetching resources...');
            const res = await fetch('http://localhost:3000/api/resources');
            if (!res.ok) throw new Error("Failed to fetch resources");
            const data = await res.json();
            // Defensive: ensure structure matches
            const safeData = {
                apis: Array.isArray(data?.apis) ? data.apis : [],
                dbs: Array.isArray(data?.dbs) ? data.dbs : []
            };
            setResources(safeData);
        } catch (e) {
            console.error('[ResourcesView] Error:', e);
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        console.log('[ResourcesView] Mounted');
        fetchResources();
        return () => console.log('[ResourcesView] Unmounted');
    }, []);

    const handleDelete = async (type, id) => {
        if (!confirm("Are you sure you want to delete this resource?")) return;
        setDeletingId(id);
        try {
            const res = await fetch(`http://localhost:3000/api/resources/${type}/${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error("Failed to delete");
            await fetchResources();
        } catch (e) {
            alert(e.message);
        } finally {
            setDeletingId(null);
        }
    };

    const [viewingTools, setViewingTools] = useState(null); // { name: '', tools: [] } | null

    const handleRefresh = async (type, id) => {
        try {
            const res = await fetch(`http://localhost:3000/api/resources/${type}/${id}/refresh`, { method: 'POST' });
            if (!res.ok) throw new Error("Refresh failed");
            await fetchResources();
            alert("Resource refreshed successfully!");
        } catch (e) {
            alert(e.message);
        }
    };

    const handleViewTools = async (type, id, name) => {
        try {
            const res = await fetch(`http://localhost:3000/api/resources/${type}/${id}/tools`);
            const tools = await res.json();
            setViewingTools({ name, tools });
        } catch (e) {
            alert("Failed to load tools");
        }
    };

    if (loading) return <div className="flex h-full items-center justify-center text-slate-500"><Loader2 className="animate-spin mr-2" /> Loading resources...</div>;
    if (error) return <div className="flex h-full items-center justify-center text-red-500"><AlertCircle className="mr-2" /> {error}</div>;

    // Defensive access
    const apis = resources?.apis || [];
    const dbs = resources?.dbs || [];
    const hasResources = apis.length > 0 || dbs.length > 0;

    return (
        <div className="p-6 max-w-4xl mx-auto space-y-8">
            <h2 className="text-2xl font-semibold text-white mb-6">Managed Resources</h2>

            {!hasResources && (
                <div className="text-center p-12 bg-slate-900/50 rounded-xl border border-slate-800 text-slate-400">
                    No resources registered yet. Use the sidebar to add APIs or Databases.
                </div>
            )}

            {apis.length > 0 && (
                <div className="space-y-4">
                    <h3 className="text-lg font-medium text-slate-300 flex items-center gap-2">
                        <Globe size={18} className="text-indigo-400" /> APIs
                    </h3>
                    <div className="grid gap-4">
                        {apis.map(api => (
                            <ResourceCard
                                key={api.idString}
                                icon={<Globe size={20} className="text-indigo-400" />}
                                name={api.name}
                                subtext={api.baseUrl}
                                details={`Spec: ${api.specUrl || 'N/A'}`}
                                onDelete={() => handleDelete('api', api.idString)}
                                onEdit={() => onEdit && onEdit('api', api)}
                                onRefresh={() => handleRefresh('api', api.idString)}
                                onViewTools={() => handleViewTools('api', api.idString, api.name)}
                                isDeleting={deletingId === api.idString}
                            />
                        ))}
                    </div>
                </div>
            )}

            {dbs.length > 0 && (
                <div className="space-y-4">
                    <h3 className="text-lg font-medium text-slate-300 flex items-center gap-2">
                        <Database size={18} className="text-emerald-400" /> Databases
                    </h3>
                    <div className="grid gap-4">
                        {dbs.map(db => (
                            <ResourceCard
                                key={db.idString}
                                icon={<Database size={20} className="text-emerald-400" />}
                                name={db.name}
                                subtext={db.type}
                                details={db.connectionString.replace(/:[^:]*@/, ':****@')} // Mask password
                                onDelete={() => handleDelete('db', db.idString)}
                                onEdit={() => onEdit && onEdit('db', db)}
                                onRefresh={() => handleRefresh('db', db.idString)}
                                onViewTools={() => handleViewTools('db', db.idString, db.name)}
                                isDeleting={deletingId === db.idString}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* Tools Modal */}
            {viewingTools && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-slate-900 w-full max-w-2xl rounded-2xl border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
                        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900/50">
                            <h3 className="font-semibold text-white">Tools: {viewingTools.name}</h3>
                            <button onClick={() => setViewingTools(null)} className="text-slate-500 hover:text-white">✕</button>
                        </div>
                        <div className="p-4 overflow-y-auto space-y-3">
                            {viewingTools.tools.length === 0 && <p className="text-slate-500 text-center">No tools generated for this resource.</p>}
                            {viewingTools.tools.map((t, idx) => (
                                <div key={idx} className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                                    <div className="font-mono text-sm text-indigo-400 font-semibold">{t.name}</div>
                                    <div className="text-xs text-slate-400 mt-1">{t.description}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const ResourceCard = ({ icon, name, subtext, details, onDelete, isDeleting, onEdit, onRefresh, onViewTools }) => (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between hover:border-slate-700 transition-colors">
        <div className="flex items-center gap-4">
            <div className="p-2 bg-slate-800 rounded-lg">{icon}</div>
            <div>
                <h4 className="font-medium text-slate-200">{name}</h4>
                <div className="text-sm text-slate-500">{subtext}</div>
                <div className="text-xs text-slate-600 font-mono mt-1">{details}</div>
            </div>
        </div>
        <div className="flex items-center gap-2">
            <button onClick={onViewTools} className="p-2 text-slate-500 hover:text-indigo-400 hover:bg-slate-800 rounded-lg transition-colors" title="View Generated Tools">
                <Eye size={18} />
            </button>
            <button onClick={onRefresh} className="p-2 text-slate-500 hover:text-green-400 hover:bg-slate-800 rounded-lg transition-colors" title="Force Refresh">
                <RefreshCw size={18} />
            </button>
            <button onClick={onEdit} className="p-2 text-slate-500 hover:text-amber-400 hover:bg-slate-800 rounded-lg transition-colors" title="Edit Connection">
                <Pencil size={18} />
            </button>
            <button
                onClick={onDelete}
                disabled={isDeleting}
                className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all disabled:opacity-50"
                title="Delete Resource"
            >
                {isDeleting ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
            </button>
        </div>
    </div>
);
