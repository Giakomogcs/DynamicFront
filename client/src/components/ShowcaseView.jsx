import React, { useState, useEffect } from 'react';
import { Plus, Folder, Calendar, Layout, ArrowRight, Loader2 } from 'lucide-react';

export function ShowcaseView({ onSelectSession, onCreateSession }) {
    const [sessions, setSessions] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchSessions();
    }, []);

    const fetchSessions = async () => {
        try {
            // In a real scenario, we fetch from /api/sessions
            // For now, if the endpoint is not 100% ready, we might want fallback?
            // But we built SessionService.js, so it should be there.
            const res = await fetch('http://localhost:3000/api/sessions');
            if (res.ok) {
                const data = await res.json();
                setSessions(data);
            } else {
                console.error("Failed to fetch sessions");
                // Fallback or empty
                setSessions([]);
            }
        } catch (e) {
            console.error("Error loading sessions", e);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-950 p-8 overflow-y-auto custom-scrollbar">

            {/* Header */}
            <div className="flex justify-between items-end mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">Your Projects</h1>
                    <p className="text-slate-400">Manage your AI-generated applications and dashboards.</p>
                </div>
                <button
                    onClick={onCreateSession}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-lg flex items-center gap-2 font-medium transition-all shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/40"
                >
                    <Plus size={20} />
                    New Project
                </button>
            </div>

            {/* Grid */}
            {isLoading ? (
                <div className="flex items-center justify-center h-64">
                    <Loader2 className="animate-spin text-indigo-500" size={32} />
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">

                    {/* New Project Card (Alternative) */}
                    <button
                        onClick={onCreateSession}
                        className="group relative flex flex-col items-center justify-center p-8 rounded-2xl border-2 border-dashed border-slate-800 hover:border-indigo-500/50 bg-slate-900/50 hover:bg-slate-900 transition-all duration-300 min-h-[220px]"
                    >
                        <div className="size-14 rounded-full bg-slate-800 group-hover:bg-indigo-500/10 flex items-center justify-center mb-4 transition-colors">
                            <Plus className="text-slate-500 group-hover:text-indigo-400 transition-colors" size={28} />
                        </div>
                        <span className="text-slate-400 group-hover:text-slate-200 font-medium">Create New App</span>
                    </button>

                    {/* Session Cards */}
                    {sessions.map(session => (
                        <div
                            key={session.id}
                            onClick={() => onSelectSession(session.id)}
                            className="group bg-slate-900 rounded-2xl border border-slate-800 hover:border-slate-700 p-5 cursor-pointer transition-all hover:shadow-xl hover:shadow-black/50 hover:-translate-y-1 relative overflow-hidden"
                        >
                            {/* Hover Glow */}
                            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                            <div className="flex justify-between items-start mb-10 relative">
                                <div className="p-3 bg-slate-800 rounded-xl group-hover:bg-indigo-500/20 transition-colors">
                                    <Layout className="text-indigo-400" size={24} />
                                </div>
                                {/* Options/Menu could go here */}
                            </div>

                            <div className="relative">
                                <h3 className="text-lg font-bold text-slate-100 mb-1 group-hover:text-indigo-300 transition-colors truncate">
                                    {session.title || "Untitled Project"}
                                </h3>
                                <p className="text-sm text-slate-400 mb-2 truncate">
                                    {session.description || "No description"}
                                </p>
                                <p className="text-xs text-slate-500 mb-4 flex items-center gap-2">
                                    <Calendar size={12} />
                                    {session.updatedAt ? new Date(session.updatedAt).toLocaleDateString() : 'Just now'}
                                </p>

                                <div className="flex items-center justify-between text-xs text-slate-400 pt-4 border-t border-slate-800/50">
                                    <span>{session.canvases ? session.canvases.length : 0} pages</span>
                                    <span className="flex items-center gap-1 group-hover:translate-x-1 transition-transform text-indigo-400/0 group-hover:text-indigo-400">
                                        Open <ArrowRight size={12} />
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}

                    {sessions.length === 0 && !isLoading && (
                        <div className="col-span-full flex flex-col items-center justify-center py-12 text-slate-500">
                            <Folder size={48} className="mb-4 opacity-20" />
                            <p>No projects found. Start building!</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
