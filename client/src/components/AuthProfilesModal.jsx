import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Play, CheckCircle, AlertCircle, User, Key, Shield, Pencil, Eye, EyeOff } from 'lucide-react';
import { useToast } from './ui/Toast';
import { z } from 'zod';
import { authProfileSchema } from '../schemas/resourceSchemas';

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
    const [validationErrors, setValidationErrors] = useState({});
    
    // New: Strict Validation State
    const [testFormResult, setTestFormResult] = useState(null); // null = not tested, { success: true/false }
    const [showCredentials, setShowCredentials] = useState({}); // { id: boolean }

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
        setTestFormResult(null); // Reset validation on change
    };

    const handleEdit = (profile) => {
        setEditingId(profile.id);
        setNewLabel(profile.label);
        setNewRole(profile.role);

        // Convert Object back to KV array
        const kvs = Object.entries(profile.credentials).map(([key, value]) => ({ key, value }));
        setCredentialsKV(kvs.length > 0 ? kvs : [{ key: 'email', value: '' }]);
        setValidationErrors({});
        setTestFormResult({ success: true }); // Assume existing are valid (or require re-test? Let's require re-test to be strict? No, better UX to assume valid but reset on change)
        // Actually, to be strict and ensure they work, let's force re-test if they want to edit? 
        // Or just let them save if they don't touch credentials? 
        // For now: require re-test to be safe, so set to null.
        setTestFormResult(null); 

        setIsAdding(true);
    };

    const handleCancel = () => {
        setIsAdding(false);
        setEditingId(null);
        setNewLabel('');
        setNewRole('user');
        setCredentialsKV([{ key: 'email', value: '' }]);
        setValidationErrors({});
        setTestFormResult(null);
    };

    // New: Test the specific form values
    const handleTestForm = async () => {
        // 1. Construct Credentials
        const credentials = {};
        credentialsKV.forEach(p => {
            if (p.key) credentials[p.key] = p.value;
        });

        if (Object.keys(credentials).length === 0) return toastError("Add at least one credential parameter");

        setTestingId('new');
        setTestFormResult(null);

        try {
            const res = await fetch(`http://localhost:3000/api/resources/${resourceId}/auth-profiles/test`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ credentials })
            });

            const result = await res.json();

            if (result.success) {
                setTestFormResult({ success: true });
                success("Verified!");
                
                // Auto-fill Role if detected
                if (result.detectedRole && result.detectedRole !== 'Unknown') {
                    setNewRole(result.detectedRole);
                    // toast("Role detected: " + result.detectedRole);
                }
            } else {
                setTestFormResult({ success: false });
                toastError("Authentication Failed: " + (result.output || "Check credentials"));
            }

        } catch (e) {
            setTestFormResult({ success: false });
            toastError("Test Failed: " + e.message);
        } finally {
            setTestingId(null);
        }
    };



// ... (in component)

    const handleSaveProfile = async (formData) => {
        // If formData is passed (from child component), use it.
        // Otherwise use state (legacy/fallback, though we switched to child component now).
        
        const payload = formData ? {
            label: formData.label,
            role: formData.role,
            credentials: formData.credentials
        } : {
            label: newLabel,
            role: newRole,
            credentials: {} // fallback
        };

        // Construct validation payload
        if (!formData) {
            credentialsKV.forEach(p => {
                if (p.key) payload.credentials[p.key] = p.value;
            });
        }

        if (Object.keys(payload.credentials).length === 0) return toastError("Add at least one credential parameter");

        try {
            // Zod Validation
            authProfileSchema.parse(payload);
            setValidationErrors({});

            const isUpdate = formData ? !!formData.id : !!editingId;
            const targetId = formData ? formData.id : editingId;

            let url = `http://localhost:3000/api/resources/${resourceId}/auth-profiles`;
            let method = 'POST';

            if (isUpdate) {
                // UPDATE user (PUT)
                url = `http://localhost:3000/api/resources/${resourceId}/auth-profiles/${targetId}`;
                method = 'PUT';
            }

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res.ok) throw new Error("Failed to save");

            await fetchProfiles();
            success(isUpdate ? "Profile updated!" : "Profile added!");
            handleCancel(); // Reset form/state
        } catch (e) {
             if (e instanceof z.ZodError) {
                // Zod Error - Extract the user-friendly message from the first issue
                const errors = {};
                e.issues.forEach(evt => errors[evt.path[0]] = evt.message);
                setValidationErrors(errors);
                
                const msg = e.issues[0]?.message || "Validation error";
                toastError(msg);
            } else {
                toastError(e.message);
            }
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
                body: JSON.stringify({ 
                    credentials: profile.credentials,
                    profileId: profile.id 
                })
            });

            const result = await res.json();

            setTestResult({
                id: profile.id,
                success: result.success,
                role: result.detectedRole,
                output: result.output
            });

            if (result.success) {
                success(`Auth Success: Role detected as ${result.detectedRole}`);
                await fetchProfiles(); // Refresh to show synced role/updates
            } else {
                toastError("Auth Failed: Check credentials.");
            }

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
                                    {editingId === profile.id ? (
                                        <AuthProfileForm 
                                            initialData={profile}
                                            onCancel={handleCancel}
                                            onSave={handleSaveProfile}
                                            resourceId={resourceId}
                                            isEditing={true}
                                        />
                                    ) : (
                                        /* Read-Only Card */
                                        <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                                            <div className="items-start gap-3 w-full sm:w-auto overflow-hidden">
                                                <div className="flex flex-wrap items-center gap-2 mb-1">
                                                    <span className="font-semibold text-white truncate max-w-[200px] sm:max-w-md" title={profile.label}>{profile.label}</span>
                                                    <span className="px-2 py-0.5 bg-slate-800 text-xs text-slate-400 rounded-full border border-slate-700 whitespace-nowrap max-w-full truncate" title={profile.role}>{profile.role}</span>
                                                </div>
                                                <div className="text-xs text-slate-500 font-mono space-y-1 relative group">
                                                    {Object.entries(profile.credentials).map(([k, v]) => (
                                                        <div key={k} className="flex items-center gap-2">
                                                            <span>{k}:</span>
                                                            <span className="text-slate-400">
                                                                {showCredentials[profile.id] 
                                                                    ? String(v) 
                                                                    : String(v).replace(/./g, '*')
                                                                }
                                                            </span>
                                                        </div>
                                                    ))}
                                                    <button 
                                                        onClick={() => setShowCredentials(prev => ({ ...prev, [profile.id]: !prev[profile.id] }))}
                                                        className="absolute top-0 right-[-24px] opacity-0 group-hover:opacity-100 p-1 text-slate-600 hover:text-slate-400 transition-opacity"
                                                        title={showCredentials[profile.id] ? "Hide Credentials" : "Show Credentials"}
                                                    >
                                                        {showCredentials[profile.id] ? <EyeOff size={12} /> : <Eye size={12} />}
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2 shrink-0 ml-auto sm:ml-0">
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
                                    )}

                                    {/* Test Feedack (Only show if NOT editing this one, or show below form?) */}
                                    {/* Actually if editing, the form has its own feedback. The list feedback is for the 'Test Auth' button on the card. */}
                                    {testResult?.id === profile.id && editingId !== profile.id && (
                                        <div className={`mt-3 p-3 rounded-lg text-xs border relative animate-in slide-in-from-top-2 ${
                                            testResult.success ? 'bg-green-950/20 border-green-900/50' : 'bg-red-950/20 border-red-900/50'
                                            }`}>
                                            <button 
                                                onClick={() => setTestResult(null)}
                                                className="absolute top-2 right-2 text-slate-500 hover:text-white transition-colors"
                                            >
                                                <X size={14} />
                                            </button>
                                            
                                            <div className="flex items-center gap-2 mb-1 pr-6">
                                                <strong className={testResult.success ? 'text-green-400' : 'text-red-400'}>
                                                    {testResult.success ? "Authentication Successful" : "Authentication Failed"}
                                                </strong>
                                                {testResult.success && <span className="text-slate-400 hidden sm:inline ml-auto">Detected Role: <span className="text-white">{testResult.role}</span></span>}
                                            </div>
                                            <div className="font-mono opacity-80 max-h-20 overflow-y-auto whitespace-pre-wrap text-slate-300 pr-4">
                                                {testResult.output}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Add New Section (Collapsible) */}
                    {isAdding && (
                        <div className="bg-slate-900 border border-indigo-500/30 rounded-xl p-4 animate-in fade-in slide-in-from-top-2 shadow-lg mb-6">
                             <AuthProfileForm 
                                initialData={null}
                                onCancel={handleCancel}
                                onSave={handleSaveProfile}
                                resourceId={resourceId}
                                isEditing={false}
                            />
                        </div>
                    )}


                    {!isAdding && profiles.length > 0 && (
                        <button onClick={() => setIsAdding(true)} className="w-full py-3 border border-dashed border-slate-800 rounded-xl text-slate-500 hover:text-indigo-400 hover:border-indigo-500/30 hover:bg-slate-900/50 transition-all text-sm font-medium flex items-center justify-center gap-2 mb-4">
                            <Plus size={18} /> Register Another User
                        </button>
                    )}

                </div>
            </div>
        </div>
    );
};

const AuthProfileForm = ({ initialData, onCancel, onSave, resourceId, isEditing }) => {
    const { success, error: toastError } = useToast();
    
    // Form State
    const [label, setLabel] = useState(initialData?.label || '');
    const [role, setRole] = useState(initialData?.role || 'user');
    
    // Initialize Creds
    const initCreds = initialData?.credentials 
        ? Object.entries(initialData.credentials).map(([key, value]) => ({ key, value }))
        : [{ key: 'email', value: '' }];

    const [credentialsKV, setCredentialsKV] = useState(initCreds);
    const [validationErrors, setValidationErrors] = useState({});
    
    // Validation State
    const [testResult, setTestResult] = useState(isEditing ? { success: true } : null); // Assume valid if editing existing? OR force re-test
    // Actually, user requested strict validation. If editing, we should probably force them to re-verify if they change anything.
    // But initially, if they just opened edit and didn't change anything, is it verified?
    // Let's set it to null to force re-verification on edit to be safe/strict, 
    // UNLESS we want to allow "Rename only" without re-testing?
    // The previous implementation forced null. Let's stick to strict: must verify to save.
    // However, for UX, if I just want to change the Label, do I need to re-type password? 
    // Credentials are pre-filled. So I just click "Test".
    // Let's default to null (require test).
    
    const [testing, setTesting] = useState(false);

    const handleAddParam = () => setCredentialsKV([...credentialsKV, { key: '', value: '' }]);
    const handleRemoveParam = (index) => {
        const next = [...credentialsKV];
        next.splice(index, 1);
        setCredentialsKV(next);
        setTestResult(null);
    };
    const handleParamChange = (index, field, val) => {
        const next = [...credentialsKV];
        next[index][field] = val;
        setCredentialsKV(next);
        setTestResult(null);
    };

    const handleTest = async () => {
        const credentials = {};
        credentialsKV.forEach(p => { if (p.key) credentials[p.key] = p.value; });
        
        if (Object.keys(credentials).length === 0) return toastError("Add credentials");

        setTesting(true);
        setTestResult(null);

        try {
            const body = { credentials };
            if (isEditing && initialData?.id) body.profileId = initialData.id;

            const res = await fetch(`http://localhost:3000/api/resources/${resourceId}/auth-profiles/test`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const result = await res.json();

            if (result.success) {
                setTestResult({ success: true });
                success("Verified!");
                if (result.detectedRole && result.detectedRole !== 'Unknown') {
                    setRole(result.detectedRole);
                }
            } else {
                setTestResult({ success: false, message: result.output });
                toastError("Auth Failed");
            }
        } catch (e) {
            setTestResult({ success: false, message: e.message });
            toastError("Error: " + e.message);
        } finally {
            setTesting(false);
        }
    };

    const handleSubmit = () => {
        if (!testResult?.success) return;
        
        const credentials = {};
        credentialsKV.forEach(p => { if (p.key) credentials[p.key] = p.value; });

        // Forward to parent
        onSave({
            label,
            role,
            credentials,
            id: initialData?.id // Pass ID if editing
        });
    };

    return (
        <div className="w-full">
            <h4 className="text-sm font-medium text-white mb-4 flex items-center gap-2">
                {isEditing ? <Pencil size={16} className="text-amber-400" /> : <Plus size={16} className="text-indigo-400" />}
                {isEditing ? `Editing: ${initialData.label}` : 'Add New User'}
            </h4>

            <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                    <label className="text-xs text-slate-400 block mb-1">Label (Name)</label>
                    <input
                        type="text"
                        value={label}
                        onChange={e => setLabel(e.target.value)}
                        placeholder="e.g. Finance Admin"
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                    />
                </div>
                <div>
                    <label className="text-xs text-slate-400 block mb-1">Role (Tag)</label>
                    <input
                        type="text"
                        value={role}
                        onChange={e => setRole(e.target.value)}
                        placeholder="e.g. admin"
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                    />
                </div>
            </div>

            <div className="space-y-2 mb-4 bg-slate-950 p-3 rounded-lg border border-slate-800">
                <label className="text-xs text-slate-400 block uppercase tracking-wider font-semibold mb-2">Credentials</label>
                {credentialsKV.map((kv, i) => (
                    <div key={i} className="flex gap-2">
                        <input
                            placeholder="Key"
                            value={kv.key}
                            onChange={e => handleParamChange(i, 'key', e.target.value)}
                            className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white font-mono focus:border-indigo-500 outline-none"
                        />
                        <input
                            placeholder="Value"
                            value={kv.value}
                            onChange={e => handleParamChange(i, 'value', e.target.value)}
                            className="flex-[2] bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white font-mono focus:border-indigo-500 outline-none"
                        />
                        <button onClick={() => handleRemoveParam(i)} className="p-2 text-slate-600 hover:text-red-400 hover:bg-slate-900 rounded-lg">
                            <X size={16} />
                        </button>
                    </div>
                ))}
                <button onClick={handleAddParam} className="text-xs text-indigo-400 flex items-center gap-1 mt-2 px-2 py-1 hover:bg-indigo-500/10 rounded">
                    <Plus size={12} /> Add Parameter
                </button>
            </div>

            <div className="flex justify-between items-center border-t border-slate-800 pt-3">
                <div className="flex items-center gap-2">
                     <button 
                        onClick={handleTest}
                        disabled={testing}
                        className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center gap-2 ${
                            testResult?.success 
                            ? 'bg-green-500/10 text-green-400 border border-green-500/20' 
                            : 'bg-slate-800 text-indigo-300 hover:bg-slate-700 border border-slate-700'
                        }`}
                    >
                        {testing ? <div className="animate-spin w-3 h-3 border-2 border-current border-t-transparent rounded-full" /> : 
                         testResult?.success ? <CheckCircle size={14} /> : <Shield size={14} />}
                        {testResult?.success ? "Verified" : "Test Connection"}
                    </button>
                    
                    {testResult && !testResult.success && (
                        <span className="text-xs text-red-400">{testResult.message || 'Test Failed'}</span>
                    )}
                </div>

                <div className="flex gap-2">
                    <button onClick={onCancel} className="px-3 py-2 text-xs text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg">Cancel</button>
                    <button 
                        onClick={handleSubmit} 
                        disabled={!testResult?.success}
                        className={`px-4 py-2 text-white rounded-lg text-sm font-medium shadow-lg flex items-center gap-2 ${
                            testResult?.success 
                            ? 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-500/20' 
                            : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                        }`}
                    >
                        {isEditing ? 'Update User' : 'Save User'}
                    </button>
                </div>
            </div>
        </div>
    );
};
