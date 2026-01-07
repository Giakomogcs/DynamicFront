import React, { useState } from 'react';
import { X, Check, Loader2, Eye, EyeOff } from 'lucide-react';

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

const RevealableInput = ({ value, onChange, placeholder, className, disabled }) => {
    const [show, setShow] = useState(false);
    return (
        <div className="relative w-full">
            <input
                type={show ? 'text' : 'password'}
                className={`${className} pr-8`}
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                disabled={disabled}
            />
            <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-indigo-400 focus:outline-none"
                onClick={() => setShow(!show)}
            >
                {show ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
        </div>
    );
};

const ProfileSkeleton = () => (
    <div className="bg-slate-900/50 border border-dashed border-slate-700 p-3 rounded-lg animate-pulse relative">
        <div className="h-6 bg-slate-800 rounded w-1/3 mb-2"></div>
        <div className="flex gap-2">
            <div className="h-6 bg-slate-800 rounded w-1/3"></div>
            <div className="h-6 bg-slate-800 rounded w-2/3"></div>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
            <div className="space-y-0.5">
                <div className="h-3 bg-slate-800 rounded w-1/4"></div>
                <div className="h-6 bg-slate-800 rounded w-full"></div>
            </div>
            <div className="space-y-0.5">
                <div className="h-3 bg-slate-800 rounded w-1/4"></div>
                <div className="h-6 bg-slate-800 rounded w-full"></div>
            </div>
        </div>
    </div>
);

export const RegisterApiForm = ({ onSubmit, isLoading, initialData }) => {
    const [testResult, setTestResult] = useState(null);
    const [isTesting, setIsTesting] = useState(false);

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
                if (ac.api && ac.api.default) {
                    const def = ac.api.default;
                    defaultAuthType = def.type || 'none';
                    if (def.type === 'bearer') defaultAuthToken = def.token;
                    if (def.type === 'apiKey') {
                        defaultApiKeyName = def.paramName;
                        defaultApiKeyValue = def.value;
                        defaultApiKeyLocation = def.paramLocation || 'query';
                    }
                    if (def.type === 'basic') {
                        defaultAuthType = 'basic';
                        defaultAuthToken = `${def.username}:${def.password}`;
                    }
                }

                // Profiles logic
                if (ac.api && ac.api.profiles) {
                    Object.entries(ac.api.profiles).forEach(([profName, profConf]) => {
                        profiles.push({
                            id: crypto.randomUUID(),
                            name: profName,
                            type: profConf.type || 'none',
                            token: profConf.token || '',
                            keyName: profConf.paramName || '',
                            keyValue: profConf.value || '',
                            username: profConf.username || '',
                            password: profConf.password || ''
                        });
                    });
                }
            } catch (e) {
                console.error("Failed to parse initial auth config", e);
            }

            // Extract extended basic auth fields
            let defaultAuthLoginUrl = '';
            let defaultAuthTokenPath = 'access_token';
            let defaultAuthLoginParams = []; // { key, label, value, type: 'text'|'password'|'hidden' }

            try {
                const ac = JSON.parse(initialData.authConfig || '{}');
                const def = ac.api?.default;
                if (def && def.type === 'basic') {
                    defaultAuthLoginUrl = def.loginUrl || '';
                    defaultAuthTokenPath = def.tokenPath || 'access_token';
                    // Migrate legacy fields if present, else use params
                    if (def.loginParams) {
                        defaultAuthLoginParams = def.loginParams;
                    } else if (def.usernameKey || def.passwordKey) {
                        // Migration path for what we just built
                        defaultAuthLoginParams = [
                            { key: def.usernameKey || 'username', label: def.usernameLabel || 'Username', value: '', type: 'text' },
                            { key: def.passwordKey || 'password', label: def.passwordLabel || 'Password', value: '', type: 'password' }
                        ];
                        if (def.extraBody) {
                            // This is hard to migrate perfectly without parsing JSON, but we can try
                            try {
                                const extra = JSON.parse(def.extraBody);
                                Object.entries(extra).forEach(([k, v]) => {
                                    defaultAuthLoginParams.push({
                                        key: k,
                                        label: k,
                                        value: v,
                                        type: 'hidden'
                                    });
                                });
                            } catch { }
                        }
                    } else {
                        // Default Init
                        defaultAuthLoginParams = [
                            { key: 'username', label: 'Username', value: '', type: 'text' },
                            { key: 'password', label: 'Password', value: '', type: 'password' }
                        ];
                    }
                }
            } catch { }

            return {
                name: initialData.name || '',
                specUrl: initialData.specUrl || '',
                baseUrl: initialData.baseUrl || '',
                docsMode: 'url',
                docsContent: '',
                docsAuthEnabled,
                docsUsername,
                docsPassword,
                defaultAuthType,
                defaultAuthToken,
                defaultApiKeyName,
                defaultApiKeyValue,
                defaultApiKeyLocation,
                defaultAuthLoginUrl,
                defaultAuthTokenPath,
                defaultAuthLoginParams,
                profiles
            };
        }

        return {
            name: '',
            specUrl: '',
            baseUrl: '',
            docsMode: 'url',
            docsContent: '',
            docsAuthEnabled: false,
            docsUsername: '',
            docsPassword: '',
            defaultAuthType: 'none',
            defaultAuthToken: '',
            defaultApiKeyName: 'api_key',
            defaultApiKeyValue: '',
            defaultApiKeyLocation: 'query',
            defaultAuthLoginUrl: '',
            defaultAuthTokenPath: 'access_token',
            defaultAuthLoginParams: [
                { id: '1', key: 'username', label: 'Username', value: '', type: 'text' },
                { id: '2', key: 'password', label: 'Password', value: '', type: 'password' }
            ],
            profiles: []
        };
    });

    const addProfile = () => {
        setFormData(prev => ({
            ...prev,
            profiles: [...prev.profiles, {
                id: crypto.randomUUID(),
                name: '',
                type: prev.defaultAuthType || 'bearer',
                token: '',
                keyName: prev.defaultApiKeyName || '',
                keyValue: '',
                username: '',
                password: '',
                // Initialize Independent Schema Copy, BUT PRESERVE IDs to link with Default
                loginParams: (prev.defaultAuthLoginParams || []).map(p => ({ ...p, value: '' })),
                // Initialize Values Map (to be kept in sync or used for lookup)
                params: (prev.defaultAuthLoginParams || []).reduce((acc, p) => ({ ...acc, [p.key]: '' }), {})
            }]
        }));
    };

    const removeProfile = (id) => {
        setFormData(prev => ({
            ...prev,
            profiles: prev.profiles.filter(p => p.id !== id)
        }));
    };

    const updateProfile = (id, field, value) => {
        setFormData(prev => ({
            ...prev,
            profiles: prev.profiles.map(p => p.id === id ? { ...p, [field]: value } : p)
        }));
    };

    // Helper: Construct Auth Config Object
    const constructAuthConfig = () => {
        // 1. Docs Auth
        let docsAuth = null;
        if (formData.docsAuthEnabled) {
            docsAuth = {
                type: 'basic',
                username: formData.docsUsername,
                password: formData.docsPassword
            };
        }

        // 2. Default API Auth
        const buildAuthObj = (type, token, keyName, keyValue, location, username, password, params, customLoginParamsSchema) => {
            if (type === 'bearer') return { type: 'bearer', token };
            if (type === 'apiKey') return { type: 'apiKey', paramName: keyName, value: keyValue, paramLocation: location };

            if (type === 'basic') {
                const base = { type: 'basic', username, password };

                // If using Custom Login URL, we need to attach the specific params with values
                if (formData.defaultAuthLoginUrl) {
                    base.loginUrl = formData.defaultAuthLoginUrl;
                    base.tokenPath = formData.defaultAuthTokenPath;

                    // Priority 1: Use independent schema from Profile (customLoginParamsSchema)
                    // Priority 2: Use default schema (formData.defaultAuthLoginParams)
                    const schemaToUse = customLoginParamsSchema || formData.defaultAuthLoginParams || [];

                    // Inject values
                    // If 'params' is passed (from Profile values map), use that to look up values
                    // Otherwise rely on the schema's own 'value' property (Default Auth)
                    base.loginParams = schemaToUse.map(p => ({
                        ...p,
                        value: params ? (params[p.key] || '') : (p.value || '')
                    }));
                }
                return base;
            }
            return null;
        };

        let defUsername, defPassword;
        if (formData.defaultAuthType === 'basic') {
            const parts = formData.defaultAuthToken.split(':');
            defUsername = parts[0] || '';
            defPassword = parts.slice(1).join(':') || '';
        }

        const defaultAuth = buildAuthObj(
            formData.defaultAuthType,
            formData.defaultAuthToken,
            formData.defaultApiKeyName,
            formData.defaultApiKeyValue,
            formData.defaultApiKeyLocation,
            defUsername,
            defPassword,
            null, // No override params for default
            null  // No override schema for default
        );

        // 3. Profiles
        const profilesMap = {};
        formData.profiles.forEach(p => {
            if (p.name) {
                const pAuth = buildAuthObj(
                    p.type,
                    p.token,
                    p.keyName,
                    p.keyValue,
                    null,
                    p.username,
                    p.password,
                    p.params,           // Values Map
                    p.loginParams       // Independent Schema
                );
                if (pAuth) profilesMap[p.name] = pAuth;
            }
        });

        return {
            docs: docsAuth,
            api: {
                default: defaultAuth,
                profiles: profilesMap
            }
        };
    };

    const handleTestConnection = async () => {
        if (!formData.baseUrl) {
            setTestResult({ success: false, message: "Please enter a Base URL to test." });
            return;
        }

        setIsTesting(true);
        setTestResult(null);

        try {
            const authConfig = constructAuthConfig();
            const res = await fetch('http://localhost:3000/api/tools/test-connection', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    baseUrl: formData.baseUrl,
                    authConfig: JSON.stringify(authConfig)
                })
            });
            const data = await res.json();
            setTestResult(data);
        } catch (e) {
            setTestResult({ success: false, message: "Network Error: " + e.message });
        } finally {
            setIsTesting(false);
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const authConfigObj = constructAuthConfig();

        onSubmit({
            name: formData.name,
            specUrl: formData.docsMode === 'url' ? formData.specUrl : undefined,
            baseUrl: formData.baseUrl,
            docsContent: formData.docsMode === 'text' ? formData.docsContent : undefined,
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

                {/* Base URL (Crucial for Validating Connection) */}
                <div className="flex gap-2">
                    <input
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white outline-none"
                        placeholder="Base URL (e.g. https://api.example.com)"
                        value={formData.baseUrl}
                        onChange={e => setFormData({ ...formData, baseUrl: e.target.value })}
                    />
                    <button
                        type="button"
                        onClick={handleTestConnection}
                        disabled={isTesting}
                        className={`px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${isTesting ? 'bg-slate-800 text-slate-400' :
                            'bg-violet-600/20 text-violet-300 hover:bg-violet-600/30 border border-violet-500/30'
                            }`}
                    >
                        {isTesting ? 'Testing...' : 'Test Connection'}
                    </button>
                </div>

                {/* Test Result Feedback */}
                {testResult && (
                    <div className={`p-2 rounded text-xs border ${testResult.success ? 'bg-green-900/20 border-green-800 text-green-300' : 'bg-red-900/20 border-red-800 text-red-300'}`}>
                        {testResult.results ? (
                            <div className="space-y-1">
                                <div className="font-bold border-b border-white/10 pb-1 mb-1">{testResult.message}</div>
                                {testResult.results.map((r, i) => (
                                    <div key={i} className={`flex items-start justify-between ${r.success ? 'text-green-300' : 'text-red-300'}`}>
                                        <span className="font-mono">{r.profile}:</span>
                                        <span className="text-right">{r.message}</span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <>
                                <strong>{testResult.success ? 'Success' : 'Failed'}:</strong> {testResult.message}
                                {testResult.detail && <div className="mt-1 opacity-75 font-mono text-[10px] break-all">{testResult.detail}</div>}
                            </>
                        )}
                    </div>
                )}

                <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                        <div className="flex items-center gap-4">
                            <span>Documentation Source:</span>
                            <label className="flex items-center gap-1 cursor-pointer">
                                <input type="radio" name="docsMode" checked={formData.docsMode === 'url'} onChange={() => setFormData({ ...formData, docsMode: 'url' })} />
                                URL
                            </label>
                            <label className="flex items-center gap-1 cursor-pointer">
                                <input type="radio" name="docsMode" checked={formData.docsMode === 'text'} onChange={() => setFormData({ ...formData, docsMode: 'text' })} />
                                Raw Text
                            </label>
                        </div>
                        <button
                            type="button"
                            onClick={async () => {
                                const docsUrl = formData.docsMode === 'url' ? formData.specUrl : '';
                                const docsContent = formData.docsMode === 'text' ? formData.docsContent : '';
                                if (!docsUrl && !docsContent) return alert("Please provide docs URL or Content first.");

                                setIsTesting(true); // Reuse loader
                                try {
                                    const body = { docsUrl, docsContent };
                                    if (formData.docsAuthEnabled) {
                                        body.docsAuth = {
                                            type: 'basic',
                                            username: formData.docsUsername,
                                            password: formData.docsPassword
                                        };
                                    }

                                    const res = await fetch('http://localhost:3000/api/tools/analyze-auth', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify(body)
                                    });
                                    const data = await res.json();
                                    if (data.success && data.config) {
                                        const c = data.config;
                                        // Generate params with IDs once to share between Default and Profiles
                                        const analyzedParams = (c.loginParams || []).map(p => ({
                                            ...p,
                                            id: crypto.randomUUID(),
                                            value: p.value || '',
                                            type: p.type || 'text'
                                        }));

                                        setFormData(prev => ({
                                            ...prev,
                                            // Prefer Basic Auth if login fields found, map 'session' to 'basic' for UI
                                            defaultAuthType: (c.type === 'session' ? 'basic' : c.type) || 'basic',
                                            // Set loginUrl directly. State handles toggle logic via !!value
                                            defaultAuthLoginUrl: c.loginUrl || '',
                                            defaultAuthTokenPath: c.tokenPath || 'access_token',
                                            // Map Login Params
                                            defaultAuthLoginParams: analyzedParams,
                                            // Auto-Populate Profiles from Roles
                                            profiles: (c.roles || []).map(r => ({
                                                id: crypto.randomUUID(),
                                                name: r.name,
                                                type: (c.type === 'session' ? 'basic' : c.type) || 'basic',
                                                // Initialize independent schema BUT share IDs for sync
                                                loginParams: analyzedParams.map(p => ({ ...p, value: '' })),
                                                // Initialize params values map
                                                params: analyzedParams.reduce((acc, p) => ({ ...acc, [p.key]: '' }), {})
                                            }))
                                        }));
                                    } else {
                                        setTestResult({ success: false, message: "Could not detect auth config." });
                                    }
                                } catch (e) {
                                    setTestResult({ success: false, message: "Analysis Failed: " + e.message });
                                } finally {
                                    setIsTesting(false);
                                }
                            }}
                            className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-1 rounded hover:bg-indigo-500/40"
                        >
                            🪄 Auto-Detect Auth
                        </button>
                    </div>

                    {formData.docsMode === 'url' ? (
                        <>
                            <input
                                required={formData.docsMode === 'url'}
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
                                    <RevealableInput
                                        className="w-1/2 bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-white"
                                        placeholder="Password"
                                        value={formData.docsPassword}
                                        onChange={e => setFormData({ ...formData, docsPassword: e.target.value })}
                                    />
                                </div>
                            )}
                        </>
                    ) : (
                        <textarea
                            required={formData.docsMode === 'text'}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white outline-none h-32 text-xs font-mono"
                            placeholder="Paste your API documentation content here..."
                            value={formData.docsContent}
                            onChange={e => setFormData({ ...formData, docsContent: e.target.value })}
                        />
                    )}
                </div>
            </div>

            <div className="border-t border-slate-800 my-4" />

            {/* Default API Auth */}
            <div className="space-y-3">
                <label className="block text-sm font-medium text-slate-400">Default API Authentication</label>
                {isTesting ? (
                    <div className="bg-slate-950/50 p-3 rounded-lg border border-slate-800 space-y-4 animate-pulse">
                        <div className="h-9 bg-slate-800 rounded w-full"></div>
                        <div className="space-y-2">
                            <div className="h-3 bg-slate-800 rounded w-1/4"></div>
                            <div className="h-8 bg-slate-800 rounded w-full"></div>
                        </div>
                        <div className="space-y-2">
                            <div className="h-3 bg-slate-800 rounded w-1/3"></div>
                            <div className="h-8 bg-slate-800 rounded w-full"></div>
                        </div>
                        <div className="pt-2 border-t border-slate-800">
                            <div className="flex justify-between items-center mb-2">
                                <div className="h-3 bg-slate-800 rounded w-1/4"></div>
                                <div className="h-3 bg-slate-800 rounded w-1/6"></div>
                            </div>
                            <div className="h-8 bg-slate-800 rounded w-full"></div>
                        </div>
                    </div>
                ) : (
                    <div className="bg-slate-950/50 p-3 rounded-lg border border-slate-800 space-y-3">
                        <select
                            className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-white text-sm outline-none"
                            value={formData.defaultAuthType}
                            onChange={e => setFormData({ ...formData, defaultAuthType: e.target.value })}
                        >
                            <option value="none">No Authentication</option>
                            <option value="bearer">Bearer Token</option>
                            <option value="apiKey">API Key</option>
                            <option value="basic">Basic Auth (Login)</option>
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
                        {formData.defaultAuthType === 'basic' && (
                            <div className="space-y-3 mt-2 pt-2 border-t border-slate-800">
                                {/* Token Exchange Toggle */}
                                <div className="flex items-center gap-2 mb-1">
                                    <input
                                        type="checkbox"
                                        id="loginUrlToggle"
                                        checked={!!formData.defaultAuthLoginUrl}
                                        onChange={e => setFormData({ ...formData, defaultAuthLoginUrl: e.target.checked ? '/login' : '' })}
                                        className="rounded border-slate-700 bg-slate-900"
                                    />
                                    <label htmlFor="loginUrlToggle" className="cursor-pointer select-none text-xs text-slate-400">Auth via Custom Login Endpoint</label>
                                </div>

                                {formData.defaultAuthLoginUrl && (
                                    <div className="pl-4 border-l-2 border-slate-800 space-y-3">
                                        <div className="grid grid-cols-2 gap-2">
                                            <input
                                                className="col-span-1 bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-white"
                                                placeholder="Login URL (e.g. /api/auth/login)"
                                                value={formData.defaultAuthLoginUrl === true ? '' : formData.defaultAuthLoginUrl}
                                                onChange={e => setFormData({ ...formData, defaultAuthLoginUrl: e.target.value })}
                                            />
                                            <input
                                                className="col-span-1 bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-white"
                                                placeholder="Token Path (e.g. access_token)"
                                                value={formData.defaultAuthTokenPath || 'access_token'}
                                                onChange={e => setFormData({ ...formData, defaultAuthTokenPath: e.target.value })}
                                            />
                                        </div>

                                        {/* Dynamic Login Params Builder */}
                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center">
                                                <span className="text-[10px] text-slate-500 uppercase font-bold">Login Parameters</span>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const newId = crypto.randomUUID();
                                                        const newParam = { id: newId, key: '', label: '', value: '', type: 'text' };

                                                        setFormData(prev => {
                                                            // 1. Add to Default
                                                            const newDefaultParams = [...(prev.defaultAuthLoginParams || []), newParam];

                                                            // 2. Sync: Add to all Profiles
                                                            const newProfiles = prev.profiles.map(prof => ({
                                                                ...prof,
                                                                loginParams: [...(prof.loginParams || []), { ...newParam, value: '' }]
                                                            }));

                                                            return { ...prev, defaultAuthLoginParams: newDefaultParams, profiles: newProfiles };
                                                        });
                                                    }}
                                                    className="text-[10px] text-indigo-400 hover:text-indigo-300"
                                                >
                                                    + Add Field
                                                </button>
                                            </div>

                                            {(formData.defaultAuthLoginParams || []).map((param, idx) => (
                                                <div key={param.id || idx} className="grid grid-cols-12 gap-1 items-center bg-slate-900/30 p-1 rounded">
                                                    <input
                                                        className="col-span-2 bg-slate-950 border border-slate-800 rounded px-2 py-1 text-[10px] text-white font-mono"
                                                        placeholder="JSON Key"
                                                        value={param.key}
                                                        onChange={e => {
                                                            const newVal = e.target.value;
                                                            setFormData(prev => {
                                                                // 1. Update Default
                                                                const newParams = [...(prev.defaultAuthLoginParams || [])];
                                                                newParams[idx] = { ...newParams[idx], key: newVal };

                                                                // 2. Sync: Update Profiles by ID
                                                                const newProfiles = prev.profiles.map(prof => ({
                                                                    ...prof,
                                                                    loginParams: (prof.loginParams || []).map(p =>
                                                                        p.id === param.id ? { ...p, key: newVal } : p
                                                                    )
                                                                }));

                                                                return { ...prev, defaultAuthLoginParams: newParams, profiles: newProfiles };
                                                            });
                                                        }}
                                                    />
                                                    <select
                                                        className="col-span-2 bg-slate-950 border border-slate-800 rounded px-1 py-1 text-[10px] text-white"
                                                        value={param.type}
                                                        onChange={e => {
                                                            const newVal = e.target.value;
                                                            setFormData(prev => {
                                                                // 1. Update Default
                                                                const newParams = [...(prev.defaultAuthLoginParams || [])];
                                                                newParams[idx] = { ...newParams[idx], type: newVal };

                                                                // 2. Sync: Update Profiles by ID
                                                                const newProfiles = prev.profiles.map(prof => ({
                                                                    ...prof,
                                                                    loginParams: (prof.loginParams || []).map(p =>
                                                                        p.id === param.id ? { ...p, type: newVal } : p
                                                                    )
                                                                }));

                                                                return { ...prev, defaultAuthLoginParams: newParams, profiles: newProfiles };
                                                            });
                                                        }}
                                                    >
                                                        <option value="text">Text</option>
                                                        <option value="password">Password</option>
                                                        <option value="hidden">Hidden</option>
                                                    </select>
                                                    <input
                                                        className="col-span-2 bg-slate-950 border border-slate-800 rounded px-2 py-1 text-[10px] text-white"
                                                        placeholder="Label"
                                                        value={param.label || ''}
                                                        onChange={e => {
                                                            const newVal = e.target.value;
                                                            setFormData(prev => {
                                                                // 1. Update Default
                                                                const newParams = [...(prev.defaultAuthLoginParams || [])];
                                                                newParams[idx] = { ...newParams[idx], label: newVal };

                                                                // 2. Sync: Update Profiles by ID
                                                                const newProfiles = prev.profiles.map(prof => ({
                                                                    ...prof,
                                                                    loginParams: (prof.loginParams || []).map(p =>
                                                                        p.id === param.id ? { ...p, label: newVal } : p
                                                                    )
                                                                }));

                                                                return { ...prev, defaultAuthLoginParams: newParams, profiles: newProfiles };
                                                            });
                                                        }}
                                                    />
                                                    <input
                                                        className="col-span-2 bg-slate-950 border border-slate-800 rounded px-2 py-1 text-[10px] text-white"
                                                        placeholder="Holder"
                                                        value={param.placeholder || ''}
                                                        onChange={e => {
                                                            const newVal = e.target.value;
                                                            setFormData(prev => {
                                                                // 1. Update Default
                                                                const newParams = [...(prev.defaultAuthLoginParams || [])];
                                                                newParams[idx] = { ...newParams[idx], placeholder: newVal };

                                                                // 2. Sync: Update Profiles by ID
                                                                const newProfiles = prev.profiles.map(prof => ({
                                                                    ...prof,
                                                                    loginParams: (prof.loginParams || []).map(p =>
                                                                        p.id === param.id ? { ...p, placeholder: newVal } : p
                                                                    )
                                                                }));

                                                                return { ...prev, defaultAuthLoginParams: newParams, profiles: newProfiles };
                                                            });
                                                        }}
                                                    />
                                                    <input
                                                        className="col-span-3 bg-slate-950 border border-slate-800 rounded px-2 py-1 text-[10px] text-slate-300"
                                                        placeholder="Default Value"
                                                        value={param.value}
                                                        onChange={e => {
                                                            const newParams = [...formData.defaultAuthLoginParams];
                                                            newParams[idx].value = e.target.value;
                                                            setFormData({ ...formData, defaultAuthLoginParams: newParams });
                                                        }}
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setFormData(prev => {
                                                                // 1. Remove from Default
                                                                const newParams = prev.defaultAuthLoginParams.filter((_, i) => i !== idx);

                                                                // 2. Sync: Remove from Profiles by ID
                                                                const newProfiles = prev.profiles.map(prof => ({
                                                                    ...prof,
                                                                    loginParams: (prof.loginParams || []).filter(p => p.id !== param.id)
                                                                }));

                                                                return { ...prev, defaultAuthLoginParams: newParams, profiles: newProfiles };
                                                            });
                                                        }}
                                                        className="col-span-1 flex justify-center text-slate-600 hover:text-red-400"
                                                    >
                                                        <X size={12} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Preview Inputs (What the user will see) */}
                                        {formData.defaultAuthLoginParams && formData.defaultAuthLoginParams.length > 0 && (
                                            <div className="bg-slate-950 p-2 rounded border border-slate-800 opacity-75">
                                                <div className="text-[9px] text-slate-500 mb-1">PREVIEW (Run-time Inputs)</div>
                                                <div className="space-y-2">
                                                    {formData.defaultAuthLoginParams.filter(p => p.type !== 'hidden').map((p, i) => (
                                                        <div key={i} className="space-y-1">
                                                            <label className="text-[10px] text-slate-400 block">{p.label || p.key}</label>
                                                            <input
                                                                type={p.type === 'password' ? 'password' : 'text'}
                                                                className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-slate-300 pointer-events-none"
                                                                placeholder={p.placeholder || `Enter ${p.label}`}
                                                            />
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                    </div>
                                )}

                                {/* Fallback Standard Basic Auth UI (If Login URL is NOT checked) */}
                                {!formData.defaultAuthLoginUrl && (
                                    <div className="flex gap-2">
                                        <input
                                            className="w-1/2 bg-slate-950 border border-slate-800 rounded px-3 py-2 text-white text-sm"
                                            placeholder="Username"
                                            value={formData.defaultAuthToken.split(':')[0] || ''}
                                            onChange={e => setFormData({ ...formData, defaultAuthToken: `${e.target.value}:${formData.defaultAuthToken.split(':')[1] || ''}` })}
                                        />
                                        <RevealableInput
                                            className="w-1/2 bg-slate-950 border border-slate-800 rounded px-3 py-2 text-white text-sm"
                                            placeholder="Password"
                                            value={formData.defaultAuthToken.split(':')[1] || ''}
                                            onChange={e => setFormData({ ...formData, defaultAuthToken: `${formData.defaultAuthToken.split(':')[0] || ''}:${e.target.value}` })}
                                        />
                                    </div>
                                )}
                            </div>
                        )}

                    </div>
                )}
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
                                        {!formData.defaultAuthLoginUrl && (
                                            <>
                                                <input className="w-1/3 bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-white" placeholder="Username" value={profile.username || ''} onChange={e => updateProfile(profile.id, 'username', e.target.value)} />
                                                <RevealableInput
                                                    className="w-1/3 bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-white"
                                                    placeholder="Password"
                                                    value={profile.password || ''}
                                                    onChange={e => updateProfile(profile.id, 'password', e.target.value)}
                                                />
                                            </>
                                        )}
                                        {formData.defaultAuthLoginUrl && (
                                            <div className="w-full mt-2 space-y-2">
                                                {/* Profile Params Header & Add Button */}
                                                <div className="flex justify-between items-center px-1">
                                                    <span className="text-[10px] text-slate-500 uppercase font-bold">Custom Login Fields</span>
                                                    <button
                                                        type="button"
                                                        className="text-[10px] text-indigo-400 hover:text-indigo-300"
                                                        onClick={() => {
                                                            const newProfiles = [...formData.profiles];
                                                            const prof = newProfiles.find(p => p.id === profile.id);
                                                            if (prof) {
                                                                prof.loginParams = [...(prof.loginParams || []), { id: crypto.randomUUID(), key: '', label: '', value: '', type: 'text' }];
                                                                setFormData({ ...formData, profiles: newProfiles });
                                                            }
                                                        }}
                                                    >
                                                        + Add Field
                                                    </button>
                                                </div>

                                                {(profile.loginParams || []).map((p, pIdx) => (
                                                    <div key={p.id} className="grid grid-cols-12 gap-1 items-center bg-slate-950/50 p-1 rounded border border-slate-800/50">
                                                        {/* Key (Editable in Profile) */}
                                                        <input
                                                            className="col-span-3 bg-transparent border-b border-slate-700 text-[10px] text-slate-400 font-mono focus:text-white outline-none px-1"
                                                            placeholder="Key"
                                                            value={p.key}
                                                            onChange={e => {
                                                                const newProfiles = [...formData.profiles];
                                                                const prof = newProfiles.find(x => x.id === profile.id);
                                                                if (prof && prof.loginParams[pIdx]) {
                                                                    prof.loginParams[pIdx].key = e.target.value;
                                                                    setFormData({ ...formData, profiles: newProfiles });
                                                                }
                                                            }}
                                                        />

                                                        {/* Value Input */}
                                                        <div className="col-span-8">
                                                            {p.type === 'password' ? (
                                                                <RevealableInput
                                                                    className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-white"
                                                                    placeholder={p.placeholder || p.label || p.key}
                                                                    value={(profile.params && profile.params[p.key]) || ''}
                                                                    onChange={e => {
                                                                        const newProfiles = [...formData.profiles];
                                                                        const prof = newProfiles.find(x => x.id === profile.id);
                                                                        if (prof) {
                                                                            prof.params = { ...(prof.params || {}), [p.key]: e.target.value };
                                                                            setFormData({ ...formData, profiles: newProfiles });
                                                                        }
                                                                    }}
                                                                />
                                                            ) : (
                                                                <input
                                                                    type="text"
                                                                    className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-white"
                                                                    placeholder={p.placeholder || p.label || p.key}
                                                                    value={(profile.params && profile.params[p.key]) || ''}
                                                                    onChange={e => {
                                                                        const newProfiles = [...formData.profiles];
                                                                        const prof = newProfiles.find(x => x.id === profile.id);
                                                                        if (prof) {
                                                                            prof.params = { ...(prof.params || {}), [p.key]: e.target.value };
                                                                            setFormData({ ...formData, profiles: newProfiles });
                                                                        }
                                                                    }}
                                                                />
                                                            )}
                                                        </div>

                                                        {/* Remove Field Button */}
                                                        <button
                                                            type="button"
                                                            className="col-span-1 flex justify-center text-slate-600 hover:text-red-400"
                                                            onClick={() => {
                                                                const newProfiles = [...formData.profiles];
                                                                const prof = newProfiles.find(x => x.id === profile.id);
                                                                if (prof) {
                                                                    prof.loginParams = prof.loginParams.filter((_, i) => i !== pIdx);
                                                                    setFormData({ ...formData, profiles: newProfiles });
                                                                }
                                                            }}
                                                        >
                                                            <X size={10} />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
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
