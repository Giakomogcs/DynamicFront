import React, { useState, useEffect } from 'react';
import { 
    Layout, 
    Plus, 
    Search, 
    FolderOpen, 
    Calendar, 
    Clock, 
    MoreVertical, 
    Trash2,
    ArrowRight
} from 'lucide-react';

export const ShowroomView = ({ onSelectSession, onCreateSession }) => {
    const [sessions, setSessions] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [showNewProjectModal, setShowNewProjectModal] = useState(false);
    const [newProjectData, setNewProjectData] = useState({ title: '', description: '' });

    // Fetch Sessions
    useEffect(() => {
        fetchSessions();
    }, []);

    const fetchSessions = async () => {
        setIsLoading(true);
        try {
            const res = await fetch('http://localhost:3000/api/sessions');
            if (res.ok) {
                const data = await res.json();
                setSessions(data);
            }
        } catch (error) {
            console.error("Failed to load sessions:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateProject = async () => {
        if (!newProjectData.title.trim()) return;
        
        try {
            const res = await fetch('http://localhost:3000/api/sessions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newProjectData)
            });
            
            if (res.ok) {
                const session = await res.json();
                // Immediately open the new session
                onSelectSession(session.id);
            }
        } catch (e) {
            console.error(e);
            alert("Failed to create project");
        }
    };

    const handleDeleteProject = async (e, id) => {
        e.stopPropagation();
        if (!confirm("Are you sure you want to delete this project? This action cannot be undone.")) return;

        try {
            await fetch(`http://localhost:3000/api/sessions/${id}`, { method: 'DELETE' });
            fetchSessions();
        } catch (e) {
            console.error(e);
        }
    };

    const filteredSessions = sessions.filter(s => 
        s.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (s.description && s.description.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);
    };

    return (
        <div className="flex-1 bg-slate-950 p-8 overflow-y-auto">
            <div className="max-w-7xl mx-auto space-y-8">
                
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-800/50">
                    <div>
                        <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">Showroom</h1>
                        <p className="text-slate-400">Manage your analysis projects and sessions.</p>
                    </div>
                    
                    <div className="flex items-center gap-4">
                        <div className="relative group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors" size={18} />
                            <input 
                                type="text" 
                                placeholder="Search projects..." 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-slate-200 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none w-64 transition-all"
                            />
                        </div>
                        
                        <button 
                            onClick={() => setShowNewProjectModal(true)}
                            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium shadow-lg shadow-indigo-500/20 transition-all hover:scale-105 active:scale-95"
                        >
                            <Plus size={20} />
                            <span>New Project</span>
                        </button>
                    </div>
                </div>

                {/* Grid */}
                {isLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[1,2,3].map(i => (
                            <div key={i} className="h-64 bg-slate-900/50 rounded-2xl animate-pulse" />
                        ))}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {/* Empty State */}
                        {filteredSessions.length === 0 && (
                            <div className="col-span-full py-20 text-center text-slate-500">
                                <FolderOpen size={48} className="mx-auto mb-4 opacity-50" />
                                <p className="text-lg">No projects found. Create one to get started!</p>
                            </div>
                        )}

                        {filteredSessions.map(session => (
                            <div 
                                key={session.id}
                                onClick={() => onSelectSession(session.id)}
                                className="group relative bg-slate-900/40 border border-slate-800 hover:border-indigo-500/50 rounded-2xl p-5 cursor-pointer transition-all duration-300 hover:shadow-2xl hover:shadow-indigo-500/10 hover:-translate-y-1 overflow-hidden"
                            >
                                {/* Thumbnail Placeholder or Real Image */}
                                <div className="h-32 mb-4 bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl flex items-center justify-center relative overflow-hidden">
                                     {session.thumbnail ? (
                                        <img src={session.thumbnail} alt="" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                                     ) : (
                                        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-900/20 via-slate-900 to-slate-900 opacity-60" />
                                     )}
                                     <div className="relative z-10 p-3 bg-slate-950/30 backdrop-blur-sm rounded-lg border border-white/5">
                                        <Layout className="text-indigo-400" size={24} />
                                     </div>
                                </div>

                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <h3 className="text-lg font-semibold text-white group-hover:text-indigo-300 transition-colors line-clamp-1">
                                            {session.title}
                                        </h3>
                                        <p className="text-sm text-slate-500 line-clamp-1 h-5">
                                            {session.description || 'No description'}
                                        </p>
                                    </div>
                                    <button 
                                        onClick={(e) => handleDeleteProject(e, session.id)}
                                        className="p-1.5 text-slate-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                        title="Delete Project"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>

                                <div className="flex items-center gap-4 text-xs text-slate-500 mt-4 border-t border-slate-800/50 pt-4">
                                    <div className="flex items-center gap-1.5">
                                        <Layout size={14} />
                                        <span>{session.pageCount || 0} Pages</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 ml-auto">
                                        <Clock size={14} />
                                        <span>{formatDate(session.lastActive)}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* New Project Modal */}
            {showNewProjectModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div 
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
                        onClick={() => setShowNewProjectModal(false)}
                    />
                    <div className="relative bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in zoom-in-95 duration-200">
                        <h2 className="text-2xl font-bold text-white mb-1">Create New Project</h2>
                        <p className="text-slate-400 text-sm mb-6">Start a new analysis session.</p>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">Project Title</label>
                                <input 
                                    autoFocus
                                    type="text" 
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                    placeholder="e.g. Q3 Sales Analysis"
                                    value={newProjectData.title}
                                    onChange={e => setNewProjectData({...newProjectData, title: e.target.value})}
                                />
                            </div>
                            
                            <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1.5 uppercase tracking-wide">Goal / Description (Optional)</label>
                                <textarea 
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all h-24 resize-none"
                                    placeholder="Briefly describe what you want to achieve..."
                                    value={newProjectData.description}
                                    onChange={e => setNewProjectData({...newProjectData, description: e.target.value})}
                                />
                            </div>

                            <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-slate-800">
                                <button 
                                    onClick={() => setShowNewProjectModal(false)}
                                    className="px-4 py-2 rounded-xl text-slate-400 hover:bg-slate-800 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button 
                                    onClick={handleCreateProject}
                                    disabled={!newProjectData.title.trim()}
                                    className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                >
                                    Create Project
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
