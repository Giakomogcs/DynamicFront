import React, { useEffect, useState } from 'react';
import { Trash2, Database, Globe, Loader2, AlertCircle } from 'lucide-react';

export const ResourcesView = () => {
    const [resources, setResources] = useState({ apis: [], dbs: [] });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [deletingId, setDeletingId] = useState(null);

    const fetchResources = async () => {
        try {
            const res = await fetch('http://localhost:3000/api/resources');
            if (!res.ok) throw new Error("Failed to fetch resources");
            const data = await res.json();
            setResources(data);
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchResources();
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

    if (loading) return <div className="flex h-full items-center justify-center text-slate-500"><Loader2 className="animate-spin mr-2" /> Loading resources...</div>;
    if (error) return <div className="flex h-full items-center justify-center text-red-500"><AlertCircle className="mr-2" /> {error}</div>;

    const hasResources = resources.apis.length > 0 || resources.dbs.length > 0;

    return (
        <div className="p-6 max-w-4xl mx-auto space-y-8">
            <h2 className="text-2xl font-semibold text-white mb-6">Managed Resources</h2>

            {!hasResources && (
                <div className="text-center p-12 bg-slate-900/50 rounded-xl border border-slate-800 text-slate-400">
                    No resources registered yet. Use the sidebar to add APIs or Databases.
                </div>
            )}

            {resources.apis.length > 0 && (
                <div className="space-y-4">
                    <h3 className="text-lg font-medium text-slate-300 flex items-center gap-2">
                        <Globe size={18} className="text-indigo-400" /> APIs
                    </h3>
                    <div className="grid gap-4">
                        {resources.apis.map(api => (
                            <ResourceCard
                                key={api.idString}
                                icon={<Globe size={20} className="text-indigo-400" />}
                                name={api.name}
                                subtext={api.baseUrl}
                                details={`Spec: ${api.specUrl || 'N/A'}`}
                                onDelete={() => handleDelete('api', api.idString)}
                                isDeleting={deletingId === api.idString}
                            />
                        ))}
                    </div>
                </div>
            )}

            {resources.dbs.length > 0 && (
                <div className="space-y-4">
                    <h3 className="text-lg font-medium text-slate-300 flex items-center gap-2">
                        <Database size={18} className="text-emerald-400" /> Databases
                    </h3>
                    <div className="grid gap-4">
                        {resources.dbs.map(db => (
                            <ResourceCard
                                key={db.idString}
                                icon={<Database size={20} className="text-emerald-400" />}
                                name={db.name}
                                subtext={db.type}
                                details={db.connectionString.replace(/:[^:]*@/, ':****@')} // Mask password
                                onDelete={() => handleDelete('db', db.idString)}
                                isDeleting={deletingId === db.idString}
                            />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

const ResourceCard = ({ icon, name, subtext, details, onDelete, isDeleting }) => (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between hover:border-slate-700 transition-colors">
        <div className="flex items-center gap-4">
            <div className="p-2 bg-slate-800 rounded-lg">{icon}</div>
            <div>
                <h4 className="font-medium text-slate-200">{name}</h4>
                <div className="text-sm text-slate-500">{subtext}</div>
                <div className="text-xs text-slate-600 font-mono mt-1">{details}</div>
            </div>
        </div>
        <button
            onClick={onDelete}
            disabled={isDeleting}
            className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all disabled:opacity-50"
            title="Delete Resource"
        >
            {isDeleting ? <Loader2 size={18} className="animate-spin" /> : <Trash2 size={18} />}
        </button>
    </div>
);
