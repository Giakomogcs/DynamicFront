import React, { useState } from 'react';
import { X, Check, Loader2, Eye, EyeOff, Sparkles, AlertCircle, ArrowRight } from 'lucide-react';

export const Modal = ({ isOpen, onClose, title, children }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-slate-900 w-full max-w-lg rounded-2xl border border-slate-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between p-4 border-b border-slate-800 shrink-0">
                    <h3 className="font-semibold text-white">{title}</h3>
                    <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>
                <div className="p-6 overflow-y-auto custom-scrollbar">
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

export const RegisterApiForm = ({ onSubmit, isLoading, initialData }) => {
    const [step, setStep] = useState(initialData ? 2 : 1);
    const [analyzing, setAnalyzing] = useState(false);
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState(null);

    // Initial State Logic
    // Initial State Logic
    const [basicInfo, setBasicInfo] = useState(() => {
        const base = {
            name: initialData?.name || '',
            baseUrl: initialData?.baseUrl || '',
            docsMode: 'url', // 'url' | 'text'
            specUrl: initialData?.specUrl || '',
            docsContent: initialData?.docsContent || '',
            docsAuthEnabled: false,
            docsUsername: '',
            docsPassword: ''
        };

        if (initialData && initialData.authConfig) {
            try {
                const ac = JSON.parse(initialData.authConfig);
                // Populate Docs Auth if present
                if (ac.docs && ac.docs.type === 'basic') {
                    base.docsAuthEnabled = true;
                    base.docsUsername = ac.docs.username || '';
                    base.docsPassword = ac.docs.password || '';
                }
            } catch (e) {
                console.error("Failed to parse authConfig for Docs Auth initialization", e);
            }
        }
        return base;
    });

    const [authConfig, setAuthConfig] = useState(() => {
        if (initialData && initialData.authConfig) {
            try {
                const ac = JSON.parse(initialData.authConfig);
                // Try extracting from old structure if present, or new
                if (ac.api && ac.api.default) {
                    const def = ac.api.default;
                    if (def.type === 'apiKey') return { type: 'apiKey', apiKey: { paramName: def.paramName, value: def.value, location: def.paramLocation }, login: { params: [] }, bearer: { token: '' } };
                    if (def.type === 'bearer') return { type: 'bearer', bearer: { token: def.token }, apiKey: { paramName: '', value: '', location: 'header' }, login: { params: [] } };
                    if (def.type === 'basic') return {
                        type: 'basic',
                        login: {
                            url: def.loginUrl || '',
                            tokenPath: def.tokenPath || 'access_token',
                            params: def.loginParams || [{ key: 'username', value: '', type: 'text' }, { key: 'password', value: '', type: 'password' }]
                        },
                        apiKey: { paramName: '', value: '', location: 'header' }, bearer: { token: '' }
                    };
                }
            } catch (e) { }
        }
        // Default Clean State
        return {
            type: 'none', // none, apiKey, bearer, basic
            // API Key Specific
            apiKey: { paramName: 'X-API-KEY', value: '', location: 'header' },
            // Login/Bearer Specific
            login: { url: '', tokenPath: 'access_token', params: [{ key: 'username', type: 'text', value: '' }, { key: 'password', type: 'password', value: '' }] },
            // Static Token
            bearer: { token: '' }
        };
    });

    // --- Actions ---

    const handleAnalyze = async () => {
        if (!basicInfo.specUrl && !basicInfo.docsContent) {
            alert("Please provide Documentation URL or Content.");
            return;
        }
        setAnalyzing(true);
        try {
            // Prepare Docs Auth
            let docsAuth = null;
            if (basicInfo.docsMode === 'url' && basicInfo.docsAuthEnabled) {
                docsAuth = {
                    type: 'basic',
                    username: basicInfo.docsUsername,
                    password: basicInfo.docsPassword
                };
            }

            // 1. Fetch Analysis
            const res = await fetch('http://localhost:3000/api/tools/analyze-auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    docsUrl: basicInfo.docsMode === 'url' ? basicInfo.specUrl.trim() : undefined,
                    docsContent: basicInfo.docsMode === 'text' ? basicInfo.docsContent : undefined,
                    docsAuth: docsAuth // Send to Analyzer
                })
            });
            const data = await res.json();

            if (data.success && data.config) {
                const c = data.config;
                let newAuth = { ...authConfig };

                // Determine Type
                if (c.type === 'apiKey') {
                    newAuth.type = 'apiKey';
                    newAuth.apiKey = {
                        paramName: c.paramName || 'X-API-KEY',
                        location: c.paramLocation || 'header',
                        value: ''
                    };
                } else if (c.type === 'basic' || c.type === 'session') {
                    newAuth.type = 'basic'; // UI treats session/basic as "Login Flow"
                    newAuth.login = {
                        url: c.loginUrl || (basicInfo.baseUrl.trim() + '/login'),
                        tokenPath: c.tokenPath || 'access_token',
                        params: (c.loginParams || []).map(p => ({
                            key: p.key,
                            label: p.label || p.key,
                            value: p.value || '',
                            type: p.type || 'text',
                            placeholder: p.placeholder
                        }))
                    };
                    // Ensure we have at least user/pass if empty
                    if (newAuth.login.params.length === 0) {
                        newAuth.login.params = [
                            { key: 'username', label: 'Username', type: 'text', value: '' },
                            { key: 'password', label: 'Password', type: 'password', value: '' }
                        ];
                    }
                } else if (c.type === 'bearer') {
                    newAuth.type = 'bearer';
                } else {
                    newAuth.type = 'none';
                }

                setAuthConfig(newAuth);
                setStep(2); // Move to Config
            } else {
                alert("Could not detect authentication strategy automatically. Please configure manually.");
                setStep(2);
            }
        } catch (e) {
            alert(`Analysis failed: ${e.message}`);
            setStep(2); // Fallback to manual
        } finally {
            setAnalyzing(false);
        }
    };

    const handleTest = async () => {
        if (!basicInfo.baseUrl) return alert("Base URL is required");
        setTesting(true);
        setTestResult(null);

        // Construct Config for Backend
        const finalConfig = { api: { default: {} } };
        const ac = authConfig;

        // Add Docs Auth if present (so test connection could potentially use it if needed? No, usually not needed for Test Connection to API, only for fetching specs)
        // Actually, Test Connection only tests the API Base URL, not the Docs URL.

        if (ac.type === 'apiKey') {
            finalConfig.api.default = {
                type: 'apiKey',
                paramName: ac.apiKey.paramName.trim(),
                value: ac.apiKey.value.trim(),
                paramLocation: ac.apiKey.location
            };
        } else if (ac.type === 'bearer') {
            finalConfig.api.default = { type: 'bearer', token: ac.bearer.token.trim() };
        } else if (ac.type === 'basic') {
            // Login Flow
            finalConfig.api.default = {
                type: 'basic',
                loginUrl: ac.login.url.trim(),
                tokenPath: ac.login.tokenPath.trim(),
                loginParams: ac.login.params.map(p => ({ ...p, key: p.key.trim(), value: p.value.trim() }))
            };
        } else {
            finalConfig.api.default = { type: 'none' };
        }

        try {
            const res = await fetch('http://localhost:3000/api/tools/test-connection', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    baseUrl: basicInfo.baseUrl.trim(),
                    authConfig: JSON.stringify(finalConfig)
                })
            });
            const r = await res.json();
            setTestResult(r);
        } catch (e) {
            setTestResult({ success: false, message: e.message });
        } finally {
            setTesting(false);
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        // Final Construction
        const finalConfig = { api: { default: {} } };
        const ac = authConfig;

        // Add Docs Auth to Final Config so Register Handler can use it to fetch Spec
        if (basicInfo.docsMode === 'url' && basicInfo.docsAuthEnabled) {
            finalConfig.docs = {
                type: 'basic',
                username: basicInfo.docsUsername,
                password: basicInfo.docsPassword
            };
        }

        if (ac.type === 'apiKey') {
            finalConfig.api.default = {
                type: 'apiKey',
                paramName: ac.apiKey.paramName.trim(),
                value: ac.apiKey.value.trim(),
                paramLocation: ac.apiKey.location
            };
        } else if (ac.type === 'bearer') {
            finalConfig.api.default = { type: 'bearer', token: ac.bearer.token.trim() };
        } else if (ac.type === 'basic') {
            finalConfig.api.default = {
                type: 'basic',
                loginUrl: ac.login.url.trim(),
                tokenPath: ac.login.tokenPath.trim(),
                loginParams: ac.login.params.map(p => ({ ...p, key: p.key.trim(), value: p.value.trim() }))
            };
        } else {
            finalConfig.api.default = { type: 'none' };
        }

        // Capture Auth Data from Test Result if available
        let verificationAuthData = null;
        if (testResult && testResult.success) {
            // Check for flat authData
            if (testResult.authData) {
                verificationAuthData = testResult.authData;
            } 
            // Check for results array (profile based)
            else if (testResult.results && Array.isArray(testResult.results)) {
                const firstSuccess = testResult.results.find(r => r.success && r.authData);
                if (firstSuccess) verificationAuthData = firstSuccess.authData;
            }
        }

        onSubmit({
            name: basicInfo.name,
            baseUrl: basicInfo.baseUrl.trim(),
            specUrl: basicInfo.docsMode === 'url' ? basicInfo.specUrl.trim() : undefined,
            docsContent: basicInfo.docsMode === 'text' ? basicInfo.docsContent : undefined,
            authConfig: JSON.stringify(finalConfig),
            verificationAuthData // Pass to backend
        });
    };

    // --- Render ---

    // STEP 1: Basic Info
    if (step === 1) {
        return (
            <div className="space-y-4">
                <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">API Name</label>
                    <input autoFocus required className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white text-sm focus:border-indigo-500 outline-none"
                        placeholder="e.g. Stripe API"
                        value={basicInfo.name} onChange={e => setBasicInfo({ ...basicInfo, name: e.target.value })} />
                </div>
                <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Base URL</label>
                    <input required className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white text-sm focus:border-indigo-500 outline-none font-mono"
                        placeholder="https://api.example.com/v1"
                        value={basicInfo.baseUrl} onChange={e => setBasicInfo({ ...basicInfo, baseUrl: e.target.value })} />
                </div>

                <div className="bg-slate-950/50 p-4 rounded-lg border border-slate-800/50">
                    <div className="flex gap-6 mb-3 text-xs text-slate-400">
                        <label className="flex items-center gap-2 cursor-pointer hover:text-white"><input type="radio" checked={basicInfo.docsMode === 'url'} onChange={() => setBasicInfo({ ...basicInfo, docsMode: 'url' })} className="accent-indigo-500" /> Docs URL</label>
                        <label className="flex items-center gap-2 cursor-pointer hover:text-white"><input type="radio" checked={basicInfo.docsMode === 'text'} onChange={() => setBasicInfo({ ...basicInfo, docsMode: 'text' })} className="accent-indigo-500" /> Paste Code/Text</label>
                    </div>
                    {basicInfo.docsMode === 'url' ? (
                        <div className="space-y-3">
                            <input className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-white text-sm focus:ring-1 focus:ring-indigo-500/50 outline-none transition-all"
                                placeholder="https://docs.example.com/api"
                                value={basicInfo.specUrl} onChange={e => setBasicInfo({ ...basicInfo, specUrl: e.target.value })} />

                            <div className="flex items-center gap-2">
                                <input type="checkbox" id="docsAuthCheck"
                                    checked={basicInfo.docsAuthEnabled || false}
                                    onChange={e => setBasicInfo({ ...basicInfo, docsAuthEnabled: e.target.checked })}
                                    className="rounded border-slate-700 bg-slate-900 accent-indigo-500" />
                                <label htmlFor="docsAuthCheck" className="text-xs text-slate-400 cursor-pointer select-none">Documentation requires login (Basic Auth)?</label>
                            </div>

                            {basicInfo.docsAuthEnabled && (
                                <div className="grid grid-cols-2 gap-2 animate-in fade-in slide-in-from-top-1">
                                    <input className="bg-slate-900 border border-slate-800 rounded px-2.5 py-2 text-white text-xs outline-none"
                                        placeholder="Username"
                                        value={basicInfo.docsUsername || ''}
                                        onChange={e => setBasicInfo({ ...basicInfo, docsUsername: e.target.value })} />
                                    <RevealableInput
                                        className="bg-slate-900 border border-slate-800 rounded px-2.5 py-2 text-white text-xs outline-none focus:border-indigo-500"
                                        placeholder="Password"
                                        value={basicInfo.docsPassword || ''}
                                        onChange={e => setBasicInfo({ ...basicInfo, docsPassword: e.target.value })} />
                                </div>
                            )}
                        </div>
                    ) : (
                        <textarea className="w-full bg-slate-900 border border-slate-800 rounded-lg p-3 text-white text-xs h-32 font-mono focus:ring-1 focus:ring-indigo-500/50 outline-none transition-all resize-none"
                            placeholder="Paste CURL commands, JSON specs, or raw docs here..."
                            value={basicInfo.docsContent} onChange={e => setBasicInfo({ ...basicInfo, docsContent: e.target.value })} />
                    )}
                </div>

                <div className="pt-2">
                    <button onClick={handleAnalyze} disabled={analyzing} className="w-full py-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-lg font-medium flex justify-center items-center gap-2 transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-70 disabled:cursor-not-allowed">
                        {analyzing ? <Loader2 className="animate-spin size-4" /> : <Sparkles className="size-4" />}
                        {analyzing ? 'Analyzing Documentation...' : 'Analyze & Configure Auth'}
                    </button>
                    <div className="text-center mt-3">
                        <button onClick={() => setStep(2)} className="text-xs text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-1 mx-auto">
                            Skip analysis, configure manually <ArrowRight size={10} />
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // STEP 2: Auth Config
    return (
        <div className="space-y-5 animate-in slide-in-from-right-4 duration-300">
            <div className="flex items-center justify-between pb-2 border-b border-white/5">
                <button onClick={() => setStep(1)} className="text-xs text-slate-500 hover:text-white flex items-center gap-1 transition-colors">
                    ← Back to Details
                </button>
                <div className="text-xs font-mono text-emerald-400 bg-emerald-950/30 px-2 py-0.5 rounded border border-emerald-900/50">{basicInfo.name}</div>
            </div>

            <div className="p-5 bg-slate-950 border border-slate-800 rounded-xl space-y-5 shadow-inner">
                <div>
                    <label className="block text-xs font-bold text-slate-400 mb-3 tracking-wide uppercase">Authentication Strategy</label>
                    <div className="grid grid-cols-4 gap-2">
                        {[
                            { id: 'none', label: 'None' },
                            { id: 'apiKey', label: 'API Key' },
                            { id: 'bearer', label: 'Bearer' },
                            { id: 'basic', label: 'Login Flow' }
                        ].map(t => (
                            <button key={t.id}
                                onClick={() => {
                                    setAuthConfig({ ...authConfig, type: t.id });
                                    setTestResult(null); // Reset test on type change
                                }}
                                className={`px-2 py-2 rounded-lg text-xs font-medium border transition-all duration-200 flex flex-col items-center gap-1
                                ${authConfig.type === t.id
                                        ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-900/20 scale-[1.02]'
                                        : 'bg-slate-900 border-slate-700 text-slate-400 hover:bg-slate-800 hover:border-slate-600'}`}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* API Key Form */}
                {authConfig.type === 'apiKey' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                        <div className="grid grid-cols-3 gap-3">
                            <div className="col-span-1">
                                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1.5">Key Parameter</label>
                                <input className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-white text-xs font-mono focus:border-indigo-500 outline-none"
                                    value={authConfig.apiKey.paramName}
                                    onChange={e => setAuthConfig({ ...authConfig, apiKey: { ...authConfig.apiKey, paramName: e.target.value } })}
                                    placeholder="X-API-KEY" />
                            </div>
                            <div className="col-span-2">
                                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1.5">Location</label>
                                <select className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-white text-xs outline-none cursor-pointer hover:bg-slate-800"
                                    value={authConfig.apiKey.location}
                                    onChange={e => setAuthConfig({ ...authConfig, apiKey: { ...authConfig.apiKey, location: e.target.value } })}
                                >
                                    <option value="header">Header (Recommended)</option>
                                    <option value="query">Query Parameter</option>
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1.5">Key Value</label>
                            <RevealableInput className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-white text-xs font-mono focus:border-indigo-500 outline-none"
                                placeholder="sk_live_..."
                                value={authConfig.apiKey.value}
                                onChange={e => setAuthConfig({ ...authConfig, apiKey: { ...authConfig.apiKey, value: e.target.value } })} />
                        </div>
                    </div>
                )}

                {/* Login/Basic Form */}
                {authConfig.type === 'basic' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                        <div>
                            <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1.5">Login Endpoint</label>
                            <input className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-white text-xs font-mono focus:border-indigo-500 outline-none"
                                placeholder="https://api.example.com/auth/login"
                                value={authConfig.login.url}
                                onChange={e => setAuthConfig({ ...authConfig, login: { ...authConfig.login, url: e.target.value } })} />
                        </div>

                        <div className="space-y-2 bg-slate-900/30 p-3 rounded-lg border border-slate-800/50">
                            <div className="flex justify-between items-end mb-2">
                                <label className="block text-[10px] uppercase font-bold text-slate-500">Body Parameters</label>
                                <button type="button" onClick={() => {
                                    setAuthConfig({
                                        ...authConfig,
                                        login: {
                                            ...authConfig.login,
                                            params: [...authConfig.login.params, { key: '', value: '', type: 'text' }]
                                        }
                                    });
                                }} className="text-[10px] text-indigo-400 font-medium hover:text-indigo-300 flex items-center gap-1">+ Add Field</button>
                            </div>
                            {authConfig.login.params.length === 0 && <div className="text-center text-[10px] text-slate-600 italic py-2">No parameters defined. Add one to start.</div>}
                            {authConfig.login.params.map((p, idx) => (
                                <div key={idx} className="flex gap-2 items-start animate-in fade-in slide-in-from-left-2">
                                    <div className="w-1/3">
                                        <input className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-slate-300 font-mono focus:border-slate-600 outline-none"
                                            placeholder="Key"
                                            value={p.key}
                                            onChange={e => {
                                                const newParams = [...authConfig.login.params];
                                                newParams[idx].key = e.target.value;
                                                setAuthConfig({ ...authConfig, login: { ...authConfig.login, params: newParams } });
                                            }} />
                                    </div>
                                    <div className="w-full relative">
                                        <input className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-white focus:border-indigo-500/50 outline-none pr-7"
                                            type={p.type === 'password' ? 'password' : 'text'}
                                            placeholder="Value"
                                            value={p.value}
                                            onChange={e => {
                                                const newParams = [...authConfig.login.params];
                                                newParams[idx].value = e.target.value;
                                                setAuthConfig({ ...authConfig, login: { ...authConfig.login, params: newParams } });
                                            }} />
                                        {/* Toggle Type */}
                                        <button onClick={() => {
                                            const newParams = [...authConfig.login.params];
                                            newParams[idx].type = newParams[idx].type === 'password' ? 'text' : 'password';
                                            setAuthConfig({ ...authConfig, login: { ...authConfig.login, params: newParams } });
                                        }} className="absolute right-2 top-2 text-slate-600 hover:text-slate-400">
                                            {p.type === 'password' ? <Eye size={12} /> : <EyeOff size={12} />}
                                        </button>
                                    </div>
                                    <button onClick={() => {
                                        const newParams = authConfig.login.params.filter((_, i) => i !== idx);
                                        setAuthConfig({ ...authConfig, login: { ...authConfig.login, params: newParams } });
                                    }} className="text-slate-600 hover:text-red-400 p-2"><X size={14} /></button>
                                </div>
                            ))}
                        </div>
                        <div>
                            <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1.5">Token Path in Response</label>
                            <input className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-slate-300 text-xs font-mono focus:border-indigo-500 outline-none"
                                placeholder="access_token"
                                value={authConfig.login.tokenPath}
                                onChange={e => setAuthConfig({ ...authConfig, login: { ...authConfig.login, tokenPath: e.target.value } })} />
                        </div>
                    </div>
                )}

                {/* Bearer Static */}
                {authConfig.type === 'bearer' && (
                    <div className="animate-in fade-in slide-in-from-top-2">
                        <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1.5">Static Bearer Token</label>
                        <textarea className="w-full bg-slate-900 border border-slate-800 rounded-lg p-3 text-white text-xs font-mono h-24 focus:border-indigo-500 outline-none resize-none"
                            placeholder="eyJhbGciOiJIUz..."
                            value={authConfig.bearer.token}
                            onChange={e => setAuthConfig({ ...authConfig, bearer: { ...authConfig.bearer, token: e.target.value } })} />
                    </div>
                )}

                {/* Connection Test */}
                <div className="pt-2 border-t border-slate-800">
                    <button onClick={handleTest} disabled={testing || (authConfig.type !== 'none' && !basicInfo.baseUrl)}
                        className={`w-full py-2.5 rounded-lg text-xs font-semibold border flex justify-center items-center gap-2 transition-colors
                        ${testing ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-slate-900 border-slate-700 text-indigo-300 hover:bg-slate-800 hover:text-indigo-200 hover:border-indigo-900'}`}>
                        {testing ? <Loader2 className="animate-spin size-3" /> : null}
                        {testing ? "Verifying Connectivity..." : "Test Connection"}
                    </button>
                    {testResult && (
                        <div className={`mt-3 p-3 rounded-lg text-[11px] border flex items-start gap-2 ${testResult.success ? 'bg-green-950/20 border-green-900/50 text-green-400' : 'bg-red-950/20 border-red-900/50 text-red-400'}`}>
                            {testResult.success ? <Check className="size-4 shrink-0 mt-0.5" /> : <AlertCircle className="size-4 shrink-0 mt-0.5" />}
                            <div>
                                <div className="font-bold mb-0.5">{testResult.success ? "Connection Successful" : "Connection Failed"}</div>
                                <div className="opacity-90 leading-relaxed text-[10px]">{testResult.message}</div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <button
                onClick={handleSubmit}
                disabled={isLoading || (authConfig.type !== 'none' && !testResult?.success)}
                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-900/20"
            >
                {isLoading ? <Loader2 className="animate-spin size-4" /> : <Check className="size-4" />}
                {initialData ? 'Update API' : 'Register API'}
            </button>
        </div>
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

    const [testResult, setTestResult] = useState(null);
    const [isTesting, setIsTesting] = useState(false);

    // TODO: Add Db Test Endpoint validation here similar to API if desired.
    // For now we just implement simple UI to match.

    const handleSubmit = (e) => {
        e.preventDefault();
        onSubmit(formData);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Database Name</label>
                <input
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white text-sm focus:border-indigo-500 outline-none"
                    placeholder="e.g. Analytics DB"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                />
            </div>
            <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Type</label>
                <select
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white text-sm focus:border-indigo-500 outline-none"
                    value={formData.type}
                    onChange={e => setFormData({ ...formData, type: e.target.value })}
                >
                    <option value="postgres">PostgreSQL</option>
                    <option value="mysql">MySQL</option>
                </select>
            </div>
            <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Connection String</label>
                <input
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white text-sm font-mono focus:border-indigo-500 outline-none"
                    placeholder="postgres://user:pass@localhost:5432/db"
                    value={formData.connectionString}
                    onChange={e => setFormData({ ...formData, connectionString: e.target.value })}
                />
            </div>
            <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-3 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 mt-4 shadow-lg shadow-indigo-900/20"
            >
                {isLoading ? <Loader2 className="animate-spin size-4" /> : <Check className="size-4" />}
                {initialData ? 'Update Database' : 'Register Database'}
            </button>
        </form>
    );
};
