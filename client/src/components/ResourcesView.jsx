import React, { useState, useEffect } from 'react';
import { Trash2, Database, Globe, Loader2, AlertCircle, Eye, RefreshCw, Pencil, Power, Users } from 'lucide-react';
import { useToast } from './ui/Toast';
import { AuthProfilesModal } from './AuthProfilesModal';

export const ResourcesView = ({ onEdit }) => {
    const { success, error: toastError } = useToast();
    const [resources, setResources] = useState({ apis: [], dbs: [] });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [deletingId, setDeletingId] = useState(null);
    const [loadingToolsId, setLoadingToolsId] = useState(null);

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
            toastError("Failed to load resources");
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
            success("Resource deleted successfully");
        } catch (e) {
            toastError(e.message);
        } finally {
            setDeletingId(null);
        }
    };

    const [viewingTools, setViewingTools] = useState(null); // { name: '', tools: [] } | null
    const [authModal, setAuthModal] = useState(null); // { id: '', name: '' } | null

    const handleRefresh = async (type, id) => {
        try {
            const res = await fetch(`http://localhost:3000/api/resources/${type}/${id}/refresh`, { method: 'POST' });
            if (!res.ok) throw new Error("Refresh failed");
            await fetchResources();
            success("Resource refreshed successfully!");
        } catch (e) {
            toastError(e.message);
        }
    };

    const handleViewTools = async (type, id, name) => {
        setLoadingToolsId(id);
        try {
            const res = await fetch(`http://localhost:3000/api/resources/${type}/${id}/tools`);
            if (!res.ok) throw new Error("Failed to load tools");
            const tools = await res.json();
            setViewingTools({ name, tools });
        } catch (e) {
            toastError("Failed to load tools");
        } finally {
            setLoadingToolsId(null);
        }
    };

    const handleToggle = async (type, id) => {
        try {
            const res = await fetch(`http://localhost:3000/api/resources/${type}/${id}/toggle`, { method: 'PATCH' });
            if (!res.ok) throw new Error("Toggle failed");
            await fetchResources();
            success("Resource status updated");
        } catch (e) {
            toastError(e.message);
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
                                isEnabled={api.isEnabled}
                                onToggle={() => handleToggle('api', api.idString)}
                                onDelete={() => handleDelete('api', api.idString)}
                                onEdit={() => onEdit && onEdit('api', api)}
                                onRefresh={() => handleRefresh('api', api.idString)}
                                onViewTools={() => handleViewTools('api', api.idString, api.name)}
                                onAuth={() => setAuthModal({ id: api.idString, name: api.name })}
                                isDeleting={deletingId === api.idString}
                                isToolsLoading={loadingToolsId === api.idString}
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
                                isEnabled={db.isEnabled}
                                onToggle={() => handleToggle('db', db.idString)}
                                onDelete={() => handleDelete('db', db.idString)}
                                onEdit={() => onEdit && onEdit('db', db)}
                                onRefresh={() => handleRefresh('db', db.idString)}
                                onViewTools={() => handleViewTools('db', db.idString, db.name)}
                                isDeleting={deletingId === db.idString}
                                isToolsLoading={loadingToolsId === db.idString}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* Auth Profiles Modal */}
            {authModal && (
                <AuthProfilesModal
                    resourceId={authModal.id}
                    resourceName={authModal.name}
                    onClose={() => setAuthModal(null)}
                />
            )}

            {/* Tools Modal - Enhanced */}
            {viewingTools && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-slate-900 w-full max-w-4xl rounded-2xl border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
                        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900/50">
                            <div>
                                <h3 className="font-semibold text-white">Tools: {viewingTools.name}</h3>
                                <p className="text-xs text-slate-500 mt-1">{viewingTools.tools.length} tools generated</p>
                            </div>
                            <button onClick={() => setViewingTools(null)} className="text-slate-500 hover:text-white text-xl">✕</button>
                        </div>
                        <div className="p-4 overflow-y-auto space-y-3">
                            {viewingTools.tools.length === 0 && <p className="text-slate-500 text-center py-8">No tools generated for this resource.</p>}
                            {viewingTools.tools.map((t, idx) => {
                                const params = t.inputSchema?.properties || {};
                                const required = t.inputSchema?.required || [];
                                const paramCount = Object.keys(params).filter(k => !k.startsWith('_')).length;

                                return (
                                    <details key={idx} className="bg-slate-950 rounded-lg border border-slate-800 overflow-hidden">
                                        <summary className="p-3 cursor-pointer hover:bg-slate-900/50 transition-colors">
                                            <div className="flex items-center justify-between">
                                                <div className="flex-1">
                                                    <div className="font-mono text-sm text-indigo-400 font-semibold">{t.name}</div>
                                                    <div className="text-xs text-slate-400 mt-1">{t.description}</div>
                                                </div>
                                                <div className="text-xs text-slate-600 ml-4">
                                                    {paramCount} param{paramCount !== 1 ? 's' : ''}
                                                </div>
                                            </div>
                                        </summary>
                                        <div className="p-3 pt-0 border-t border-slate-800/50 mt-2">
                                            {paramCount === 0 ? (
                                                <p className="text-xs text-slate-600 italic">No parameters</p>
                                            ) : (
                                                <div className="space-y-2">
                                                    {Object.entries(params).filter(([key]) => !key.startsWith('_')).map(([key, schema]) => {
                                                        const isRequired = required.includes(key);
                                                        const hasExample = schema.description?.includes('Example:');

                                                        return (
                                                            <div key={key} className="bg-slate-900/50 p-2 rounded border border-slate-800/50">
                                                                <div className="flex items-center gap-2 mb-1">
                                                                    <span className="font-mono text-xs text-emerald-400">{key}</span>
                                                                    <span className="text-xs text-slate-600">{schema.type}</span>
                                                                    {isRequired && <span className="text-xs bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded">required</span>}
                                                                    {schema.format && <span className="text-xs bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded">{schema.format}</span>}
                                                                    {hasExample && <span className="text-xs bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded">✨ example</span>}
                                                                </div>
                                                                <div className="text-xs text-slate-500 leading-relaxed">{schema.description || 'No description'}</div>
                                                                {schema.enum && (
                                                                    <div className="mt-1 text-xs text-slate-600">
                                                                        Enum: {schema.enum.join(', ')}
                                                                    </div>
                                                                )}
                                                                {schema.items && schema.items.properties && (
                                                                    <div className="mt-1 pl-3 border-l-2 border-slate-700">
                                                                        <div className="text-xs text-slate-600 mb-1">Array items:</div>
                                                                        {Object.entries(schema.items.properties).map(([itemKey, itemSchema]) => (
                                                                            <div key={itemKey} className="text-xs text-slate-500">
                                                                                • <span className="text-emerald-400">{itemKey}</span>: {itemSchema.type}
                                                                                {itemSchema.example && <span className="text-purple-400"> (e.g. {JSON.stringify(itemSchema.example)})</span>}
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    </details>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const ResourceCard = ({ icon, name, subtext, details, isEnabled, onToggle, onDelete, isDeleting, onEdit, onRefresh, onViewTools, onAuth, isToolsLoading }) => (
    <div className={`bg-slate-900 border rounded-xl p-4 flex items-center justify-between transition-all ${isEnabled ? 'border-slate-800 hover:border-slate-700' : 'border-slate-800/50 opacity-60'
        }`}>
        <div className="flex items-center gap-4">
            <div className="p-2 bg-slate-800 rounded-lg">{icon}</div>
            <div>
                <h4 className="font-medium text-slate-200 flex items-center gap-2">
                    {name}
                    {!isEnabled && <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded">Disabled</span>}
                </h4>
                <div className="text-sm text-slate-500">{subtext}</div>
                <div className="text-xs text-slate-600 font-mono mt-1">{details}</div>
            </div>
        </div>
        <div className="flex items-center gap-2">
            <button
                onClick={onToggle}
                className={`p-2 rounded-lg transition-colors ${isEnabled
                    ? 'text-green-400 hover:bg-green-400/10'
                    : 'text-slate-600 hover:text-slate-400 hover:bg-slate-800'
                    }`}
                title={isEnabled ? "Disable Resource" : "Enable Resource"}
            >
                <Power size={18} />
            </button>
            <button
                onClick={onAuth}
                className="p-2 text-slate-500 hover:text-purple-400 hover:bg-slate-800 rounded-lg transition-colors"
                title="Manage Users & Auth"
            >
                <Users size={18} />
            </button>
            <button
                onClick={onViewTools}
                className="p-2 text-slate-500 hover:text-indigo-400 hover:bg-slate-800 rounded-lg transition-colors"
                title="View Generated Tools"
                disabled={isToolsLoading}
            >
                {isToolsLoading ? <Loader2 size={18} className="animate-spin" /> : <Eye size={18} />}
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
