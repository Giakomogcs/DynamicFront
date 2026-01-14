import React, { useState, useEffect, useMemo } from 'react';
import { Loader2, Save, Key, Cpu, AlertTriangle, Settings, Shield, Server, X, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { useToast } from './ui/Toast';

const FLAGSHIP_PRIORITY = [
    // OpenAI
    'gpt-4o', 'gpt-4o-mini', 'o1-preview', 'o1-mini', 'gpt-4-turbo', 'gpt-3.5-turbo',
    // Anthropic
    'claude-3-5-sonnet', 'claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku',
    // Google
    'gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-1.0-pro',
    // Meta / Groq
    'llama-3.1-70b', 'llama-3.1-8b', 'llama3-70b', 'llama3-8b', 'mixtral-8x7b'
];

export const SettingsView = ({ onClose, onSettingsChanged }) => {
    const { success, error, info } = useToast();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState('keys'); // 'keys', 'models'

    // Data State
    const [availableModels, setAvailableModels] = useState([]);
    const [enabledModels, setEnabledModels] = useState([]);
    const [userSettings, setUserSettings] = useState({});

    // UI State for "Show More"
    const [expandedProviders, setExpandedProviders] = useState({});

    // API Keys State
    const [apiKeys, setApiKeys] = useState({
        GEMINI_API_KEY: '',
        GROQ_API_KEY: '',
        OPENAI_API_KEY: '',
        ANTHROPIC_API_KEY: '',
        XAI_API_KEY: '',
        GITHUB_COPILOT_TOKEN: '',
        LM_STUDIO_URL: '',
        OLLAMA_URL: ''
    });

    // GitHub Copilot Auth State
    const [copilotStatus, setCopilotStatus] = useState('disconnected');
    const [copilotData, setCopilotData] = useState(null);
    const [copilotUser, setCopilotUser] = useState(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            // 1. Fetch All Models
            const modelsRes = await fetch('http://localhost:3000/api/models');
            const modelsData = await modelsRes.json();
            const allModels = Array.isArray(modelsData.models) ? modelsData.models : (modelsData || []);
            setAvailableModels(allModels);

            // 2. Fetch Settings
            const settingsRes = await fetch('http://localhost:3000/api/settings');
            const settings = await settingsRes.json();
            setUserSettings(settings);

            // Load Enabled Models
            if (settings.enabledModels && settings.enabledModels.length > 0) {
                setEnabledModels(settings.enabledModels);
            } else {
                // DEFAULT: Enable only Flagship/Popular models
                const defaultEnabled = allModels
                    .filter(m => FLAGSHIP_PRIORITY.some(f => m.name.toLowerCase().includes(f)))
                    .map(m => m.name);
                setEnabledModels(defaultEnabled);
            }

            // Load Keys
            setApiKeys({
                GEMINI_API_KEY: settings.GEMINI_API_KEY || '',
                GROQ_API_KEY: settings.GROQ_API_KEY || '',
                OPENAI_API_KEY: settings.OPENAI_API_KEY || '',
                ANTHROPIC_API_KEY: settings.ANTHROPIC_API_KEY || '',
                XAI_API_KEY: settings.XAI_API_KEY || '',
                GITHUB_COPILOT_TOKEN: settings.GITHUB_COPILOT_TOKEN || '',
                LM_STUDIO_URL: settings.LM_STUDIO_URL || '',
                OLLAMA_URL: settings.OLLAMA_URL || ''
            });

            if (settings.GITHUB_COPILOT_TOKEN && settings.GITHUB_COPILOT_TOKEN.length > 10) {
                setCopilotStatus('connected');
                fetchCopilotUser(settings.GITHUB_COPILOT_TOKEN);
            } else {
                setCopilotStatus('disconnected');
            }

        } catch (e) {
            console.error("Failed to load settings", e);
            error("Failed to load settings");
        } finally {
            setLoading(false);
        }
    };

    const fetchCopilotUser = async (token) => {
        try {
            const res = await fetch('http://localhost:3000/api/copilot/user', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const user = await res.json();
                setCopilotUser(user.login);
            } else {
                // If invalid token
                setCopilotStatus('disconnected');
            }
        } catch (e) {
            console.error("Failed to fetch copilot user", e);
        }
    };

    const toggleModel = (name) => {
        setEnabledModels(prev => {
            if (prev.includes(name)) return prev.filter(n => n !== name);
            return [...prev, name];
        });
    };

    const toggleAllProvider = (models, shouldEnable) => {
        const names = models.map(m => m.name);
        setEnabledModels(prev => {
            const temp = prev.filter(n => !names.includes(n)); // Remove all from this provider
            if (shouldEnable) {
                return [...temp, ...names]; // Add all back
            }
            return temp; // Just removed
        });
    };

    const handleKeyChange = (provider, value) => {
        setApiKeys(prev => ({ ...prev, [provider]: value }));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            // Save Enabled Models
            await fetch('http://localhost:3000/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key: 'enabledModels', value: enabledModels })
            });

            // Save API Keys
            for (const [key, val] of Object.entries(apiKeys)) {
                if (val !== undefined) {
                    await fetch('http://localhost:3000/api/settings', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ key, value: val })
                    });
                }
            }

            await fetchData(); // Refresh local data
            if (onSettingsChanged) onSettingsChanged(); // Refresh global app data

            success("Settings Saved Successfully!");
        } catch (e) {
            error("Failed to save: " + e.message);
        } finally {
            setSaving(false);
        }
    };

    // Copilot Auth Flow
    const startCopilotAuth = async () => {
        setCopilotStatus('loading');
        try {
            const clientId = "Ov23li8WeYTbFauBQ4xH";
            const res = await fetch('http://localhost:3000/api/auth/copilot/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ clientId })
            });
            const data = await res.json();
            if (data.device_code) {
                setCopilotData({ ...data, clientId });
                setCopilotStatus('waiting');
                pollCopilotToken(data.device_code, data.interval, clientId);
            } else {
                error("Failed to start auth: " + JSON.stringify(data));
                setCopilotStatus('disconnected');
            }
        } catch (e) {
            error("Auth error: " + e.message);
            setCopilotStatus('disconnected');
        }
    };

    const pollCopilotToken = async (deviceCode, interval, clientId) => {
        const poll = async () => {
            try {
                const res = await fetch('http://localhost:3000/api/auth/copilot/poll', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ clientId, deviceCode })
                });
                const data = await res.json();

                if (data.access_token) {
                    setCopilotStatus('connected');
                    setApiKeys(prev => ({ ...prev, GITHUB_COPILOT_TOKEN: data.access_token }));
                    await fetch('http://localhost:3000/api/settings', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ key: 'GITHUB_COPILOT_TOKEN', value: data.access_token })
                    });
                    fetchCopilotUser(data.access_token);
                    success("GitHub Copilot Connected!");

                    // Trigger refresh to show models immediately
                    setTimeout(async () => {
                        await fetchData();
                        if (onSettingsChanged) onSettingsChanged();
                    }, 1000);

                } else if (data.error === 'authorization_pending') {
                    setTimeout(poll, (interval + 1) * 1000);
                } else if (data.error === 'slow_down') {
                    setTimeout(poll, (interval + 5) * 1000);
                } else {
                    setCopilotStatus('disconnected');
                }
            } catch (e) {
                console.error("Polling network error", e);
            }
        };
        setTimeout(poll, interval * 1000);
    };

    const disconnectCopilot = async () => {
        setApiKeys(prev => ({ ...prev, GITHUB_COPILOT_TOKEN: '' }));
        setCopilotStatus('disconnected');
        setCopilotUser(null);
        await fetch('http://localhost:3000/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: 'GITHUB_COPILOT_TOKEN', value: '' })
        });

        info("Copilot disconnected");
        setTimeout(async () => {
            await fetchData();
            if (onSettingsChanged) onSettingsChanged();
        }, 500);
    };

    // --- SMART MODEL FILTERING ---
    const processedModels = useMemo(() => {
        const groups = {};

        // Legacy/Utility terms to filter out
        const BLACKLIST_TERMS = [
            'vision-preview', '0301', '0314', '0613', '1106', '0125', // Old dates
            'instruct', 'babbage', 'davinci', 'curie', 'ada', // Legacy GPT-3
            'tts-', 'whisper', 'dall-e', 'embedding', // Utility/non-chat
            'realtime' // Specialized
        ];

        availableModels.forEach(m => {
            const provider = m.provider || 'unknown';
            if (!groups[provider]) groups[provider] = [];

            const lowerName = m.name.toLowerCase();

            // 1. Hard Filter: Remove known junk/utility models
            if (BLACKLIST_TERMS.some(term => lowerName.includes(term))) {
                return;
            }

            groups[provider].push(m);
        });

        // Sort and Rank within groups
        Object.keys(groups).forEach(provider => {
            groups[provider].sort((a, b) => {
                const aName = a.name;
                const bName = b.name;

                // 1. Priority Ranking (Exact or partial match)
                const getPriorityScore = (name) => {
                    const index = FLAGSHIP_PRIORITY.findIndex(p => name.toLowerCase().includes(p));
                    return index === -1 ? 999 : index;
                };

                const aScore = getPriorityScore(aName);
                const bScore = getPriorityScore(bName);

                if (aScore !== bScore) {
                    return aScore - bScore; // Lower index = Higher priority
                }

                // 2. Deprioritize specific keywords that slipped through
                const isPreviewA = aName.includes('preview');
                const isPreviewB = bName.includes('preview');
                if (isPreviewA !== isPreviewB) return isPreviewA ? 1 : -1;

                // 3. Alphabetical fallback
                return aName.localeCompare(bName);
            });
        });

        return groups;

    }, [availableModels]);

    const toggleProviderExpand = (provider) => {
        setExpandedProviders(prev => ({
            ...prev,
            [provider]: !prev[provider]
        }));
    };


    if (loading) return <div className="flex h-full items-center justify-center text-slate-500"><Loader2 className="animate-spin mr-2" /> Loading settings...</div>;

    const tabs = [
        { id: 'keys', label: 'Providers', icon: Key },
        { id: 'models', label: 'Models', icon: Cpu },
    ];

    return (
        <div className="flex flex-col h-full bg-slate-950 text-slate-200">
            {/* HEADER & TABS */}
            <div className="shrink-0 bg-slate-900 border-b border-slate-800">
                <div className="flex items-center justify-between px-6 h-16">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <Shield className="size-5 text-indigo-500" />
                        Settings
                    </h2>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="hidden md:flex items-center gap-2 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors disabled:opacity-50 text-sm font-medium shadow-md shadow-indigo-500/10"
                        >
                            {saving ? <Loader2 className="animate-spin size-4" /> : <Save className="size-4" />}
                            Save
                        </button>
                        {onClose && (
                            <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors">
                                <X className="size-5" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Horizontal Tabs */}
                <div className="flex px-6 gap-6">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 pb-3 text-sm font-medium border-b-2 transition-all ${activeTab === tab.id
                                ? 'border-indigo-500 text-indigo-400'
                                : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
                                }`}
                        >
                            <tab.icon className="size-4" />
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* CONTENT AREA */}
            <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar">

                {/* KEYS TAB */}
                {activeTab === 'keys' && (
                    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-2">

                        {/* GitHub Copilot Block */}
                        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
                            <div className="p-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 bg-slate-800 rounded-lg text-white"><Settings className="size-4" /></div>
                                    <span className="font-medium text-white">GitHub Copilot</span>
                                </div>
                                {copilotStatus === 'connected' ? (
                                    <div className="flex items-center gap-2">
                                        <span className="px-2 py-0.5 bg-green-500/10 text-green-400 text-xs rounded-full border border-green-500/20 flex items-center gap-1">
                                            <div className="size-1.5 rounded-full bg-green-500" />
                                            {copilotUser || 'Connected'}
                                        </span>
                                    </div>
                                ) : <span className="text-xs text-slate-500">Not Connected</span>}
                            </div>

                            <div className="p-6 space-y-4">
                                <p className="text-sm text-slate-400">Connect to your GitHub account to access Copilot models.</p>

                                {copilotStatus === 'connected' ? (
                                    <div className="flex justify-between items-center bg-slate-950/50 p-3 rounded-lg border border-slate-800">
                                        <span className="text-sm text-slate-300">Account linked successfully.</span>
                                        <button onClick={disconnectCopilot} className="text-xs text-red-400 hover:bg-red-500/10 px-2 py-1 rounded transition-colors">Disconnect</button>
                                    </div>
                                ) : (
                                    <>
                                        {copilotStatus === 'waiting' && copilotData ? (
                                            <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-lg space-y-3">
                                                <div className="flex items-center gap-3">
                                                    <Loader2 className="animate-spin text-indigo-400 size-5" />
                                                    <div className="flex-1">
                                                        <div className="text-sm text-indigo-200">Authorization Required</div>
                                                        <div className="text-xs text-indigo-400/70 mt-1">Code: <strong className="text-white bg-slate-800 px-1.5 py-0.5 rounded ml-1 select-all">{copilotData.user_code}</strong></div>
                                                    </div>
                                                    <a href={copilotData.verification_uri} target="_blank" className="px-3 py-1.5 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-500 shadow-lg shadow-indigo-500/20">Authorize</a>
                                                </div>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={startCopilotAuth}
                                                disabled={copilotStatus === 'loading'}
                                                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-sm text-white transition-colors"
                                            >
                                                {copilotStatus === 'loading' ? <Loader2 className="animate-spin size-4" /> : <Server className="size-4" />}
                                                {copilotStatus === 'loading' ? 'Requesting Code...' : 'Connect Copilot'}
                                            </button>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Standard Keys Grid */}
                        <div className="space-y-6">
                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                                <Cloud className="size-3" /> Cloud Providers
                            </h4>
                            <div className="space-y-4">
                                <ApiKeyInput
                                    label="Google Gemini"
                                    value={apiKeys.GEMINI_API_KEY}
                                    onChange={(v) => handleKeyChange('GEMINI_API_KEY', v)}
                                    placeholder="AIzaSy..."
                                />
                                <ApiKeyInput
                                    label="OpenAI"
                                    value={apiKeys.OPENAI_API_KEY}
                                    onChange={(v) => handleKeyChange('OPENAI_API_KEY', v)}
                                    placeholder="sk-..."
                                />
                                <ApiKeyInput
                                    label="Groq"
                                    value={apiKeys.GROQ_API_KEY}
                                    onChange={(v) => handleKeyChange('GROQ_API_KEY', v)}
                                    desc="Required for Llama 3 & Mixtral (Fast)"
                                    placeholder="gsk_..."
                                />
                                <ApiKeyInput
                                    label="Anthropic"
                                    value={apiKeys.ANTHROPIC_API_KEY}
                                    onChange={(v) => handleKeyChange('ANTHROPIC_API_KEY', v)}
                                    placeholder="sk-ant-..."
                                />
                                <ApiKeyInput
                                    label="xAI (Grok)"
                                    value={apiKeys.XAI_API_KEY}
                                    onChange={(v) => handleKeyChange('XAI_API_KEY', v)}
                                    placeholder="key..."
                                />
                            </div>
                        </div>

                        <div className="space-y-6">
                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                                <Server className="size-3" /> Local Servers
                            </h4>
                            <div className="space-y-4">
                                <ApiKeyInput
                                    label="LM Studio URL"
                                    value={apiKeys.LM_STUDIO_URL}
                                    onChange={(v) => handleKeyChange('LM_STUDIO_URL', v)}
                                    placeholder="http://localhost:1234/v1"
                                    type="text"
                                    desc="Requires CORS enabled in LM Studio."
                                />
                                <ApiKeyInput
                                    label="Ollama URL"
                                    value={apiKeys.OLLAMA_URL}
                                    onChange={(v) => handleKeyChange('OLLAMA_URL', v)}
                                    placeholder="http://localhost:11434/v1"
                                    type="text"
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* MODELS TAB */}
                {activeTab === 'models' && (
                    <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-2">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-semibold text-white">Active Models</h3>
                                <p className="text-sm text-slate-400">Select which models are visible in the chat selector.</p>
                            </div>
                            <button
                                onClick={fetchData}
                                className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                            >
                                <RefreshCw className="size-3" /> Refresh
                            </button>
                        </div>

                        {Object.keys(processedModels).length === 0 && (
                            <div className="flex flex-col items-center justify-center p-12 bg-slate-900 border border-slate-800 rounded-xl text-center">
                                <AlertTriangle className="size-10 text-yellow-500 mb-4" />
                                <h4 className="text-lg font-medium text-white">No Models Found</h4>
                                <p className="text-slate-500 max-w-sm mt-2 text-sm">Configure your API keys in the <strong>Providers</strong> tab.</p>
                            </div>
                        )}

                        <div className="grid grid-cols-1 gap-6">
                            {Object.entries(processedModels).map(([provider, models]) => {
                                const isExpanded = expandedProviders[provider];
                                const visibleModels = isExpanded ? models : models.slice(0, 5);
                                const hasMore = models.length > 5;

                                // Calculate Provider State
                                const providerModelNames = models.map(m => m.name);
                                const activeCount = providerModelNames.filter(name => enabledModels.includes(name)).length;
                                const isAllActive = activeCount === providerModelNames.length;
                                const isIndeterminate = activeCount > 0 && !isAllActive;

                                return (
                                    <div key={provider} className="bg-slate-900/40 border border-slate-800 rounded-xl overflow-hidden flex flex-col">
                                        <div className="px-4 py-3 bg-slate-900/60 border-b border-slate-800 flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                {/* Provider Toggle */}
                                                <div
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        toggleAllProvider(models, !isAllActive);
                                                    }}
                                                    className={`size-4 rounded border flex items-center justify-center cursor-pointer transition-colors
                                                        ${isAllActive
                                                            ? 'bg-indigo-600 border-indigo-600 text-white'
                                                            : (isIndeterminate ? 'bg-indigo-600/50 border-indigo-600/50 text-white' : 'border-slate-600 bg-slate-800')
                                                        }`}
                                                >
                                                    {isAllActive && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                                                    {isIndeterminate && <div className="w-2 h-0.5 bg-white rounded-full" />}
                                                </div>

                                                <span className="font-bold text-slate-300 uppercase tracking-wide text-xs flex items-center gap-2">
                                                    {provider}
                                                </span>
                                            </div>
                                            <span className="text-[10px] text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">{activeCount} / {models.length}</span>
                                        </div>
                                        <div className="divide-y divide-slate-800/50">
                                            {visibleModels.map(m => (
                                                <label key={m.id} className="flex items-center gap-3 p-3 hover:bg-slate-800 cursor-pointer transition-colors group">
                                                    <div className="relative flex items-center justify-center pt-0.5">
                                                        <input
                                                            type="checkbox"
                                                            checked={enabledModels.includes(m.name)}
                                                            onChange={() => toggleModel(m.name)}
                                                            className="peer appearance-none size-4 rounded border-slate-600 bg-slate-800 checked:bg-indigo-600 checked:border-indigo-600 transition-colors"
                                                        />
                                                        <div className="absolute inset-0 flex items-center justify-center text-white opacity-0 peer-checked:opacity-100 pointer-events-none transition-opacity">
                                                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                                        </div>
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <div className="text-sm font-medium text-slate-300 group-hover:text-white truncate transition-colors">
                                                                {m.displayName?.replace(new RegExp(`${provider}[/\\s]*`, 'i'), '')}
                                                            </div>
                                                            {/* Flagship Badge */}
                                                            {FLAGSHIP_PRIORITY.some(f => m.name.toLowerCase().includes(f)) && (
                                                                <span className="hidden sm:inline-block px-1.5 py-0.5 bg-yellow-500/10 text-yellow-500 text-[9px] font-bold rounded border border-yellow-500/20 uppercase">
                                                                    Popular
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="text-[10px] text-slate-600 group-hover:text-slate-500 font-mono truncate">{m.name}</div>
                                                    </div>
                                                </label>
                                            ))}
                                        </div>
                                        {hasMore && (
                                            <button
                                                onClick={() => toggleProviderExpand(provider)}
                                                className="w-full py-2 text-xs text-slate-500 hover:text-indigo-400 hover:bg-slate-800/50 transition-colors flex items-center justify-center gap-1 border-t border-slate-800/50"
                                            >
                                                {isExpanded ? (
                                                    <>Show Less <ChevronUp className="size-3" /></>
                                                ) : (
                                                    <>Show {models.length - 5} More Models <ChevronDown className="size-3" /></>
                                                )}
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* Mobile Footer Save */}
            <div className="md:hidden p-4 border-t border-slate-800 bg-slate-900">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors disabled:opacity-50 font-medium"
                >
                    {saving ? <Loader2 className="animate-spin size-4" /> : <Save className="size-4" />}
                    Save Changes
                </button>
            </div>
        </div>
    );
};


const ApiKeyInput = ({ label, value, onChange, placeholder, type = 'password', desc }) => (
    <div className="space-y-1.5 group">
        <div className="flex justify-between">
            <label className="text-xs font-medium text-slate-400 group-focus-within:text-indigo-400 transition-colors">{label}</label>
        </div>
        <div className="relative">
            <input
                type={type}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-3 pr-8 py-2 text-sm text-slate-200 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-700 hover:border-slate-700"
            />
            {value && value.length > 5 && (
                <div className="absolute right-2.5 top-2.5">
                    <div className="size-1.5 rounded-full bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]" />
                </div>
            )}
        </div>
        {desc && <p className="text-[10px] text-slate-600">{desc}</p>}
    </div>
);

// Helper Icon
const Cloud = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M17.5 19c0-3.037-2.463-5.5-5.5-5.5S6.5 15.963 6.5 19" />
        <circle cx="12" cy="10" r="3" />
        <path d="M12 2a10 10 0 0 1 10 10c0 5.523-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2z" opacity="0.0" />
    </svg>
);
