import React, { useState } from 'react';
import { X, Check, Loader2 } from 'lucide-react';

export const Modal = ({ isOpen, onClose, title, children }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-slate-900 w-full max-w-lg rounded-2xl border border-slate-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between p-4 border-b border-slate-800">
                    <h3 className="font-semibold text-white">{title}</h3>
                    <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>
                <div className="p-6">
                    {children}
                </div>
            </div>
        </div>
    );
};

export const RegisterApiForm = ({ onSubmit, isLoading, initialData }) => {
    const [formData, setFormData] = useState(() => {
        if (initialData) {
            // Parse auth config
            let docsAuthEnabled = false;
            let docsUsername = '';
            let docsPassword = '';
            let defaultAuthType = 'none';
            let defaultAuthToken = '';
            let defaultApiKeyName = '';
            let defaultApiKeyValue = '';
            let defaultApiKeyLocation = 'query';
            let profiles = [];

            try {
                const ac = JSON.parse(initialData.authConfig || '{}');
                // Docs
                if (ac.docs) {
                    docsAuthEnabled = true;
                    docsUsername = ac.docs.username || '';
                    docsPassword = ac.docs.password || '';
                }
                // API Default
                if (ac.api && ac.api.default) {
                    const def = ac.api.default;
                    defaultAuthType = def.type || 'none';
                    if (def.type === 'bearer') defaultAuthToken = def.token;
                    if (def.type === 'apiKey') {
                        defaultApiKeyName = def.paramName;
                        defaultApiKeyValue = def.value;
                        defaultApiKeyLocation = def.paramLocation || 'query';
                    }
                }
                // Profiles logic (omitted for brevity, assumes they work similar)
            } catch (e) {
                console.error("Failed to parse initial auth config", e);
            }

            return {
                name: initialData.name || '',
                specUrl: initialData.specUrl || '',
                docsAuthEnabled,
                docsUsername,
                docsPassword,
                defaultAuthType,
                defaultAuthToken,
                defaultApiKeyName,
                defaultApiKeyValue,
                defaultApiKeyLocation,
                profiles
            };
        }

        return {
            name: '',
            specUrl: '',
            docsAuthEnabled: false,
            docsUsername: '',
            docsPassword: '',
            defaultAuthType: 'none',
            defaultAuthToken: '',
            defaultApiKeyName: 'api_key',
            defaultApiKeyValue: '',
            defaultApiKeyLocation: 'query',
            profiles: []
        };
    });

    // ... (profiles omitted)

    const handleSubmit = (e) => {
        e.preventDefault();

        // 1. Build Docs Auth
        let docsAuth = null;
        if (formData.docsAuthEnabled) {
            docsAuth = {
                type: 'basic',
                username: formData.docsUsername,
                password: formData.docsPassword
            };
        }

        // 2. Build API Auth (Default)
        const buildAuthObj = (type, token, keyName, keyValue, location, username, password) => {
            if (type === 'bearer') return { type: 'bearer', token };
            if (type === 'apiKey') return { type: 'apiKey', paramName: keyName, value: keyValue, paramLocation: location };
            if (type === 'basic') return { type: 'basic', username, password };
            return null;
        };

        const defaultAuth = buildAuthObj(
            formData.defaultAuthType,
            formData.defaultAuthToken,
            formData.defaultApiKeyName,
            formData.defaultApiKeyValue,
            formData.defaultApiKeyLocation
        );

        // 3. Build Profiles
        const profilesMap = {};
        formData.profiles.forEach(p => {
            if (p.name) {
                const pAuth = buildAuthObj(p.type, p.token, p.keyName, p.keyValue, p.username, p.password);
                if (pAuth) profilesMap[p.name] = pAuth;
            }
        });

        const authConfigObj = {
            docs: docsAuth,
            api: {
                default: defaultAuth,
                profiles: profilesMap
            }
        };

        onSubmit({
            name: formData.name,
            specUrl: formData.specUrl,
            authConfig: JSON.stringify(authConfigObj)
        });
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto px-1">
            {/* Basic Info */}
            <div className="space-y-3">
                <label className="block text-sm font-medium text-slate-400">Basic Info</label>
                <input
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white outline-none"
                    placeholder="API Name (e.g. NASA API)"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                />
                <div className="space-y-1">
                    <input
                        required
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white outline-none"
                        placeholder="Documentation URL"
                        value={formData.specUrl}
                        onChange={e => setFormData({ ...formData, specUrl: e.target.value })}
                    />
                    <div className="flex items-center gap-2 mt-2">
                        <input
                            type="checkbox"
                            id="docsAuth"
                            checked={formData.docsAuthEnabled}
                            onChange={e => setFormData({ ...formData, docsAuthEnabled: e.target.checked })}
                            className="rounded border-slate-700 bg-slate-900"
                        />
                        <label htmlFor="docsAuth" className="text-xs text-slate-400 cursor-pointer select-none">Documentation requires login?</label>
                    </div>
                    {formData.docsAuthEnabled && (
                        <div className="flex gap-2 mt-2 pl-4 border-l-2 border-slate-800">
                            <input className="w-1/2 bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-white" placeholder="Username" value={formData.docsUsername} onChange={e => setFormData({ ...formData, docsUsername: e.target.value })} />
                            <input className="w-1/2 bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-white" type="password" placeholder="Password" value={formData.docsPassword} onChange={e => setFormData({ ...formData, docsPassword: e.target.value })} />
                        </div>
                    )}
                </div>
            </div>

            <div className="border-t border-slate-800 my-4" />

            {/* Default API Auth */}
            <div className="space-y-3">
                <label className="block text-sm font-medium text-slate-400">Default API Authentication</label>
                <div className="bg-slate-950/50 p-3 rounded-lg border border-slate-800 space-y-3">
                    <select
                        className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-white text-sm outline-none"
                        value={formData.defaultAuthType}
                        onChange={e => setFormData({ ...formData, defaultAuthType: e.target.value })}
                    >
                        <option value="none">No Authentication</option>
                        <option value="bearer">Bearer Token</option>
                        <option value="apiKey">API Key</option>
                    </select>

                    {formData.defaultAuthType === 'bearer' && (
                        <input required className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-white text-sm" placeholder="Token" value={formData.defaultAuthToken} onChange={e => setFormData({ ...formData, defaultAuthToken: e.target.value })} />
                    )}
                    {formData.defaultAuthType === 'apiKey' && (
                        <div className="space-y-2">
                            <div className="flex gap-2">
                                <input required className="w-1/3 bg-slate-950 border border-slate-800 rounded px-3 py-2 text-white text-sm" placeholder="Key Parameter Name (e.g. x-api-key)" value={formData.defaultApiKeyName} onChange={e => setFormData({ ...formData, defaultApiKeyName: e.target.value })} />
                                <input required className="w-2/3 bg-slate-950 border border-slate-800 rounded px-3 py-2 text-white text-sm" placeholder="Value" value={formData.defaultApiKeyValue} onChange={e => setFormData({ ...formData, defaultApiKeyValue: e.target.value })} />
                            </div>
                            <select
                                className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-white text-xs outline-none"
                                value={formData.defaultApiKeyLocation || 'query'}
                                onChange={e => setFormData({ ...formData, defaultApiKeyLocation: e.target.value })}
                            >
                                <option value="query">Add to Query Parameters (?key=value)</option>
                                <option value="header">Add to Request Headers</option>
                            </select>
                        </div>
                    )}
                </div>
            </div>

            {/* Profiles */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <label className="block text-sm font-medium text-slate-400">Advanced Profiles (Optional)</label>
                    <button type="button" onClick={addProfile} className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1">+ Add Profile</button>
                </div>

                {formData.profiles.map((profile, idx) => (
                    <div key={profile.id} className="bg-slate-900/50 border border-dashed border-slate-700 p-3 rounded-lg relative">
                        <button type="button" onClick={() => removeProfile(profile.id)} className="absolute top-2 right-2 text-slate-600 hover:text-red-400"><X size={14} /></button>
                        <div className="space-y-2 pr-6">
                            <input className="w-full bg-transparent border-b border-slate-700 px-1 py-1 text-sm text-indigo-200 placeholder-indigo-500/50 focus:border-indigo-500 outline-none" placeholder="Profile Name (e.g. admin)" value={profile.name} onChange={e => updateProfile(profile.id, 'name', e.target.value)} />
                            <div className="flex gap-2">
                                <select className="w-1/3 bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-white" value={profile.type} onChange={e => updateProfile(profile.id, 'type', e.target.value)}>
                                    <option value="bearer">Bearer</option>
                                    <option value="apiKey">API Key</option>
                                    <option value="basic">Basic Auth</option>
                                </select>
                                {profile.type === 'bearer' && (
                                    <input className="w-2/3 bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-white" placeholder="Token" value={profile.token} onChange={e => updateProfile(profile.id, 'token', e.target.value)} />
                                )}
                                {profile.type === 'apiKey' && (
                                    <>
                                        <input className="w-1/3 bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-white" placeholder="Key" value={profile.keyName} onChange={e => updateProfile(profile.id, 'keyName', e.target.value)} />
                                        <input className="w-1/3 bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-white" placeholder="Value" value={profile.keyValue} onChange={e => updateProfile(profile.id, 'keyValue', e.target.value)} />
                                    </>
                                )}
                                {profile.type === 'basic' && (
                                    <>
                                        <input className="w-1/3 bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-white" placeholder="Username" value={profile.username || ''} onChange={e => updateProfile(profile.id, 'username', e.target.value)} />
                                        <input className="w-1/3 bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-white" type="password" placeholder="Password" value={profile.password || ''} onChange={e => updateProfile(profile.id, 'password', e.target.value)} />
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 mt-4"
            >
                {isLoading ? <Loader2 className="animate-spin size-4" /> : <Check className="size-4" />}
                {initialData ? 'Update API' : 'Register API'}
            </button>
        </form>
    );
};

export const RegisterDbForm = ({ onSubmit, isLoading, initialData }) => {
    const [formData, setFormData] = useState(() => {
        if (initialData) {
            return {
                name: initialData.name,
                connectionString: initialData.connectionString,
                type: initialData.type
            };
        }
        return { name: '', connectionString: '', type: 'postgres' };
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        onSubmit(formData);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Database Name</label>
                <input
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    placeholder="e.g. Analytics DB"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Type</label>
                <select
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    value={formData.type}
                    onChange={e => setFormData({ ...formData, type: e.target.value })}
                >
                    <option value="postgres">PostgreSQL</option>
                    <option value="mysql">MySQL</option>
                </select>
            </div>
            <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Connection String</label>
                <input
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-mono text-xs"
                    placeholder="postgres://user:pass@localhost:5432/db"
                    value={formData.connectionString}
                    onChange={e => setFormData({ ...formData, connectionString: e.target.value })}
                />
            </div>
            <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
                {isLoading ? <Loader2 className="animate-spin size-4" /> : <Check className="size-4" />}
                {initialData ? 'Update Database' : 'Register Database'}
            </button>
        </form>
    );
};
