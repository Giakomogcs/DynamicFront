import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Play, CheckCircle, AlertCircle, User, Key, Shield, Pencil } from 'lucide-react';
import { useToast } from './ui/Toast';

export const AuthProfilesModal = ({ resourceId, resourceName, onClose }) => {
    const { success, error: toastError } = useToast();
    const [profiles, setProfiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [testingId, setTestingId] = useState(null);
    const [testResult, setTestResult] = useState(null); // { id, success, role, message }

    // Form State
    const [isAdding, setIsAdding] = useState(false);
    const [editingId, setEditingId] = useState(null); // ID being edited
    const [newLabel, setNewLabel] = useState('');
    const [newRole, setNewRole] = useState('user');
    const [credentialsKV, setCredentialsKV] = useState([{ key: 'email', value: '' }]); // Dynamic keys

    useEffect(() => {
        fetchProfiles();
    }, [resourceId]);

    const fetchProfiles = async () => {
        try {
            const res = await fetch(`http://localhost:3000/api/resources/${resourceId}/auth-profiles`);
            if (res.ok) {
                const data = await res.json();
                setProfiles(data);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleAddParam = () => {
        setCredentialsKV([...credentialsKV, { key: '', value: '' }]);
    };

    const handleRemoveParam = (index) => {
        const next = [...credentialsKV];
        next.splice(index, 1);
        setCredentialsKV(next);
    };

    const handleParamChange = (index, field, val) => {
        const next = [...credentialsKV];
        next[index][field] = val;
        setCredentialsKV(next);
    };

    const handleEdit = (profile) => {
        setEditingId(profile.id);
        setNewLabel(profile.label);
        setNewRole(profile.role);

        // Convert Object back to KV array
        const kvs = Object.entries(profile.credentials).map(([key, value]) => ({ key, value }));
        setCredentialsKV(kvs.length > 0 ? kvs : [{ key: 'email', value: '' }]);

        setIsAdding(true);
    };

    const handleCancel = () => {
        setIsAdding(false);
        setEditingId(null);
        setNewLabel('');
        setNewRole('user');
        setCredentialsKV([{ key: 'email', value: '' }]);
    };

    const handleSaveProfile = async () => {
        if (!newLabel) return toastError("Label is required");

        // Convert KV to Object
        const credentials = {};
        credentialsKV.forEach(p => {
            if (p.key) credentials[p.key] = p.value;
        });

        if (Object.keys(credentials).length === 0) return toastError("Add at least one credential parameter");

        try {
            const payload = {
                label: newLabel,
                role: newRole,
                credentials
            };
            if (editingId) payload.id = editingId; // Include ID to update

            const res = await fetch(`http://localhost:3000/api/resources/${resourceId}/auth-profiles`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res.ok) throw new Error("Failed to save");

            await fetchProfiles();
            success(editingId ? "Profile updated!" : "Profile added!");
            handleCancel(); // Reset form
        } catch (e) {
            toastError(e.message);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm("Delete this user profile?")) return;
        try {
            await fetch(`http://localhost:3000/api/resources/${resourceId}/auth-profiles/${id}`, { method: 'DELETE' });
            fetchProfiles();
            success("Deleted");
        } catch (e) {
            toastError("Failed to delete");
        }
    };

    const handleTest = async (profile) => {
        setTestingId(profile.id);
        setTestResult(null);

        try {
            const res = await fetch(`http://localhost:3000/api/resources/${resourceId}/auth-profiles/test`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ credentials: profile.credentials })
            });

            const result = await res.json();

            setTestResult({
                id: profile.id,
                success: result.success,
                role: result.detectedRole,
                output: result.output
            });

            if (result.success) success(`Auth Success: Role detected as ${result.detectedRole}`);
            else toastError("Auth Failed: Check credentials.");

        } catch (e) {
            setTestResult({
                id: profile.id,
                success: false,
                output: e.message
            });
            toastError("Test Request Failed");
        } finally {
            setTestingId(null);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-slate-900 w-full max-w-2xl rounded-2xl border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">

                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900/50">
                    <div>
                        <h3 className="font-semibold text-white flex items-center gap-2">
                            <User size={20} className="text-indigo-400" />
                            Manage Users: {resourceName}
                        </h3>
                        <p className="text-xs text-slate-500 mt-1">Configure credentials for automated authentication.</p>
                    </div>
                    <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto space-y-6">

                    {/* List Existing */}
                    {!loading && profiles.length === 0 && !isAdding && (
                        <div className="text-center p-8 border border-dashed border-slate-800 rounded-xl">
                            <p className="text-slate-500 mb-4">No users configured for this resource.</p>
                            <button onClick={() => setIsAdding(true)} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors">
                                Add First User
                            </button>
                        </div>
                    )}

                    {profiles.length > 0 && (
                        <div className="space-y-3">
                            {profiles.map(profile => (
                                <div key={profile.id} className="bg-slate-950 border border-slate-800 rounded-xl p-4 transition-all hover:border-slate-700">
                                    <div className="flex items-start justify-between">
                                        <div className="items-start gap-3">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-semibold text-white">{profile.label}</span>
                                                <span className="px-2 py-0.5 bg-slate-800 text-xs text-slate-400 rounded-full border border-slate-700">{profile.role}</span>
                                            </div>
                                            <div className="text-xs text-slate-500 font-mono space-y-1">
                                                {Object.entries(profile.credentials).map(([k, v]) => (
                                                    <div key={k}>{k}: <span className="text-slate-400">{v.replace(/./g, '*')}</span></div>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => handleTest(profile)}
                                                disabled={testingId === profile.id}
                                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${testResult?.id === profile.id
                                                    ? testResult.success
                                                        ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                                                        : 'bg-red-500/10 text-red-400 border border-red-500/20'
                                                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                                                    }`}
                                            >
                                                {testingId === profile.id ? (
                                                    <div className="animate-spin w-3 h-3 border-2 border-current border-t-transparent rounded-full" />
                                                ) : testResult?.id === profile.id ? (
                                                    testResult.success ? <CheckCircle size={14} /> : <AlertCircle size={14} />
                                                ) : <Play size={14} />}

                                                {testResult?.id === profile.id
                                                    ? (testResult.success ? 'Verified' : 'Failed')
                                                    : 'Test Auth'}
                                            </button>

                                            <button
                                                onClick={() => handleEdit(profile)}
                                                className="p-2 text-slate-500 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors"
                                                title="Edit"
                                            >
                                                <Pencil size={16} />
                                            </button>

                                            <button
                                                onClick={() => handleDelete(profile.id)}
                                                className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Test Feedack */}
                                    {testResult?.id === profile.id && (
                                        <div className={`mt-3 p-3 rounded-lg text-xs border ${testResult.success ? 'bg-green-950/20 border-green-900/50' : 'bg-red-950/20 border-red-900/50'
                                            }`}>
                                            <div className="flex items-center gap-2 mb-1">
                                                <strong className={testResult.success ? 'text-green-400' : 'text-red-400'}>
                                                    {testResult.success ? "Authentication Successful" : "Authentication Failed"}
                                                </strong>
                                                {testResult.success && <span className="text-slate-400 ml-auto">Detected Role: <span className="text-white">{testResult.role}</span></span>}
                                            </div>
                                            <div className="font-mono opacity-80 max-h-20 overflow-y-auto whitespace-pre-wrap text-slate-300">
                                                {testResult.output}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Add New Section */}
                    {isAdding && (
                        <div className="bg-slate-900 border border-indigo-500/30 rounded-xl p-4 animate-in fade-in slide-in-from-top-2">
                            <h4 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
                                {editingId ? <Pencil size={16} className="text-amber-400" /> : <Plus size={16} className="text-indigo-400" />}
                                {editingId ? 'Edit User' : 'Add New User'}
                            </h4>

                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div>
                                    <label className="text-xs text-slate-400 block mb-1">Label (Name)</label>
                                    <input
                                        type="text"
                                        value={newLabel}
                                        onChange={e => setNewLabel(e.target.value)}
                                        placeholder="e.g. Finance Admin"
                                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-400 block mb-1">Role (Tag)</label>
                                    <input
                                        type="text"
                                        value={newRole}
                                        onChange={e => setNewRole(e.target.value)}
                                        placeholder="e.g. admin"
                                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2 mb-4">
                                <label className="text-xs text-slate-400 block">Credentials (Key / Value)</label>
                                {credentialsKV.map((kv, i) => (
                                    <div key={i} className="flex gap-2">
                                        <input
                                            placeholder="Key (e.g. email)"
                                            value={kv.key}
                                            onChange={e => handleParamChange(i, 'key', e.target.value)}
                                            className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white font-mono focus:border-indigo-500 outline-none"
                                        />
                                        <input
                                            placeholder="Value"
                                            value={kv.value}
                                            onChange={e => handleParamChange(i, 'value', e.target.value)}
                                            className="flex-[2] bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white font-mono focus:border-indigo-500 outline-none"
                                        />
                                        <button onClick={() => handleRemoveParam(i)} className="p-2 text-slate-600 hover:text-red-400 rounded-lg">
                                            <X size={16} />
                                        </button>
                                    </div>
                                ))}
                                <button onClick={handleAddParam} className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 mt-1">
                                    <Plus size={12} /> Add Parameter
                                </button>
                            </div>

                            <div className="flex justify-end gap-2">
                                <button onClick={handleCancel} className="px-3 py-2 text-sm text-slate-400 hover:text-white">Cancel</button>
                                <button onClick={handleSaveProfile} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium">
                                    {editingId ? 'Update User' : 'Save User'}
                                </button>
                            </div>
                        </div>
                    )}

                    {!isAdding && profiles.length > 0 && (
                        <button onClick={() => setIsAdding(true)} className="w-full py-3 border border-dashed border-slate-800 rounded-xl text-slate-500 hover:text-indigo-400 hover:border-indigo-500/30 hover:bg-slate-900/50 transition-all text-sm font-medium flex items-center justify-center gap-2">
                            <Plus size={18} /> Register Another User
                        </button>
                    )}

                </div>
            </div>
        </div>
    );
};
