import React, { useState, useEffect } from 'react';
import { Users, Search, Shield, Activity, Power, MoreVertical, Loader2 } from 'lucide-react';
import { useToast } from '../components/ui/Toast';

export const AdminDashboard = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const { success, error } = useToast();
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            const token = localStorage.getItem('authToken');
            const res = await fetch('http://localhost:3000/api/admin/users', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.status === 403) throw new Error("Access Denied");
            if (!res.ok) throw new Error("Failed to fetch users");
            
            const data = await res.json();
            setUsers(data);
        } catch (e) {
            console.error(e);
            error(e.message);
        } finally {
            setLoading(false);
        }
    };

    const toggleUserStatus = async (userId, currentStatus) => {
        try {
            const token = localStorage.getItem('authToken');
            const res = await fetch(`http://localhost:3000/api/admin/users/${userId}/toggle`, {
                method: 'PATCH',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error("Action failed");
            
            setUsers(users.map(u => u.id === userId ? { ...u, isActive: !currentStatus } : u));
            success("User updated");
        } catch (e) {
            error(e.message);
        }
    };

    if (loading) return <div className="flex h-full items-center justify-center text-slate-500"><Loader2 className="animate-spin mr-2" /> Loading Admin Dashboard...</div>;

    const filteredUsers = users.filter(u => 
        u.email.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (u.name && u.name.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div className="flex-1 overflow-y-auto p-8 max-w-7xl mx-auto w-full space-y-8 animate-in fade-in duration-500">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">User Management</h1>
                    <p className="text-slate-400 mt-1">Monitor user activity and manage system access.</p>
                </div>
                
                {/* Search Bar */}
                <div className="relative w-full md:w-96 group">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-5 w-5 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
                    </div>
                    <input
                        type="text"
                        placeholder="Search users by name or email..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="block w-full pl-10 pr-3 py-2.5 bg-slate-900 border border-slate-700 rounded-xl leading-5 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 sm:text-sm transition-all shadow-sm"
                    />
                </div>
            </div>

            {/* Stats Overview (Optional Polish) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-xl flex items-center gap-4">
                    <div className="p-3 bg-indigo-500/10 rounded-lg text-indigo-400">
                        <Users size={24} />
                    </div>
                    <div>
                        <div className="text-2xl font-bold text-white">{users.length}</div>
                        <div className="text-xs text-slate-400 font-medium uppercase tracking-wider">Total Users</div>
                    </div>
                </div>
                <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-xl flex items-center gap-4">
                    <div className="p-3 bg-emerald-500/10 rounded-lg text-emerald-400">
                        <Activity size={24} />
                    </div>
                    <div>
                        <div className="text-2xl font-bold text-white">{users.filter(u => u.isActive).length}</div>
                        <div className="text-xs text-slate-400 font-medium uppercase tracking-wider">Active Users</div>
                    </div>
                </div>
                <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-xl flex items-center gap-4">
                    <div className="p-3 bg-purple-500/10 rounded-lg text-purple-400">
                        <Shield size={24} />
                    </div>
                    <div>
                        <div className="text-2xl font-bold text-white">{users.filter(u => u.role === 'ADMIN').length}</div>
                        <div className="text-xs text-slate-400 font-medium uppercase tracking-wider">Admins</div>
                    </div>
                </div>
            </div>

            {/* Table Section */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl shadow-black/20">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-800/50">
                        <thead>
                            <tr className="bg-slate-950/30">
                                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                    User
                                </th>
                                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                    Role
                                </th>
                                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                    Status
                                </th>
                                <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                    Joined
                                </th>
                                <th scope="col" className="px-6 py-4 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50 bg-slate-900/20">
                            {filteredUsers.length > 0 ? (
                                filteredUsers.map((user) => (
                                    <tr key={user.id} className="hover:bg-slate-800/40 transition-colors group">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <div className="flex-shrink-0 h-10 w-10">
                                                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold shadow-lg shadow-indigo-500/20 text-sm">
                                                        {user.avatarUrl ? <img src={user.avatarUrl} alt="" className="h-10 w-10 rounded-full object-cover"/> : (user.name?.[0] || user.email[0]).toUpperCase()}
                                                    </div>
                                                </div>
                                                <div className="ml-4">
                                                    <div className="text-sm font-medium text-white group-hover:text-indigo-300 transition-colors">
                                                        {user.name || 'Unknown User'}
                                                    </div>
                                                    <div className="text-sm text-slate-500">
                                                        {user.email}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                                                user.role === 'ADMIN' 
                                                ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' 
                                                : 'bg-slate-800 text-slate-400 border-slate-700'
                                            }`}>
                                                {user.role === 'ADMIN' && <Shield className="w-3 h-3 mr-1" />}
                                                {user.role}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                                                user.isActive 
                                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                                                : 'bg-red-500/10 text-red-400 border-red-500/20'
                                            }`}>
                                                <span className={`h-1.5 w-1.5 rounded-full ${user.isActive ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                                                {user.isActive ? 'Active' : 'Suspended'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">
                                            {new Date(user.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <button
                                                onClick={() => toggleUserStatus(user.id, user.isActive)}
                                                className={`p-2 rounded-lg transition-colors border ${
                                                    user.isActive 
                                                    ? 'text-slate-400 border-slate-700 hover:border-red-500/50 hover:text-red-400 hover:bg-red-500/10' 
                                                    : 'text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 hover:border-emerald-500/50'
                                                }`}
                                                title={user.isActive ? "Suspend User" : "Activate User"}
                                            >
                                                <Power size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="5" className="px-6 py-12 text-center text-slate-500">
                                        <div className="flex flex-col items-center gap-2">
                                            <Search className="h-8 w-8 text-slate-600" />
                                            <p>No users found matching "{searchTerm}"</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
