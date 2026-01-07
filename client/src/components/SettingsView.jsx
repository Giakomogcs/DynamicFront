
import React, { useState, useEffect } from 'react';
import { Loader2, Save, Key, Cpu, AlertTriangle } from 'lucide-react';

export const SettingsView = () => {
    const [loading, setLoading] = useState(true);
    const [availableModels, setAvailableModels] = useState([]);
    const [enabledModels, setEnabledModels] = useState([]);

    // API Keys
    const [apiKeys, setApiKeys] = useState({
        GEMINI_API_KEY: '',
        GROQ_API_KEY: ''
    });

    const [saving, setSaving] = useState(false);

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

            // Load Enabled Models
            if (settings.enabledModels) {
                setEnabledModels(settings.enabledModels);
            } else {
                setEnabledModels(allModels.map(m => m.name));
            }

            // Load Keys (Empty value implies not set or hidden)
            setApiKeys({
                GEMINI_API_KEY: settings.GEMINI_API_KEY || '',
                GROQ_API_KEY: settings.GROQ_API_KEY || '',
                OPENAI_API_KEY: settings.OPENAI_API_KEY || '',
                ANTHROPIC_API_KEY: settings.ANTHROPIC_API_KEY || '',
                XAI_API_KEY: settings.XAI_API_KEY || ''
            });

        } catch (e) {
            console.error("Failed to load settings", e);
        } finally {
            setLoading(false);
        }
    };

    const toggleModel = (name) => {
        setEnabledModels(prev => {
            if (prev.includes(name)) return prev.filter(n => n !== name);
            return [...prev, name];
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

            // Save API Keys (Only if changed/present)
            for (const [key, val] of Object.entries(apiKeys)) {
                if (val) {
                    await fetch('http://localhost:3000/api/settings', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ key, value: val })
                    });
                }
            }

            // Force Refresh of Models (re-init providers with new keys)
            // Ideally backend ModelManager should watch DB or we trigger a reload. 
            // For now, next request will reload if logic is there, or we might need restart?
            // Current ModelManager implementation loads settings on `init()`. 
            // It marks `isInitialized = true`. 
            // We need a way to force re-init or just rely on process restart for now, 
            // OR update `ModelManager` to reload settings on request if keys change.
            // Let's assume user might need to restart server or we improve ModelManager later.
            alert("Settings Saved! (Server restart may be required for new API Keys to take effect)");

        } catch (e) {
            alert("Failed to save settings: " + e.message);
        } finally {
            setSaving(false);
        }
    };

    // Group Models by Provider
    const modelsByProvider = availableModels.reduce((acc, m) => {
        const provider = m.provider || 'unknown';
        if (!acc[provider]) acc[provider] = [];
        acc[provider].push(m);
        return acc;
    }, {});

    if (loading) return <div className="flex h-full items-center justify-center text-slate-500"><Loader2 className="animate-spin mr-2" /> Loading settings...</div>;

    return (
        <div className="p-6 max-w-4xl mx-auto space-y-8 text-slate-200 overflow-y-auto h-full pb-20">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-semibold text-white">Settings</h2>
                    <p className="text-slate-500">Manage AI providers, models, and API keys.</p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                    {saving ? <Loader2 className="animate-spin size-4" /> : <Save className="size-4" />}
                    Save Changes
                </button>
            </div>

            {/* API KEYS SECTION */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
                <div className="flex items-center gap-2 text-indigo-400">
                    <Key className="size-5" />
                    <h3 className="text-lg font-medium text-white">Provider API Keys</h3>
                </div>
                <div className="grid grid-cols-1 gap-6">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">Google Gemini API Key</label>
                        <input
                            type="password"
                            value={apiKeys.GEMINI_API_KEY}
                            onChange={(e) => handleKeyChange('GEMINI_API_KEY', e.target.value)}
                            placeholder="AIzaSy..."
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">Groq API Key</label>
                        <input
                            type="password"
                            value={apiKeys.GROQ_API_KEY}
                            onChange={(e) => handleKeyChange('GROQ_API_KEY', e.target.value)}
                            placeholder="gsk_..."
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        />
                        <p className="text-xs text-slate-500">Needed for high-speed Llama 3 & Mixtral models.</p>
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">OpenAI API Key</label>
                        <input
                            type="password"
                            value={apiKeys.OPENAI_API_KEY}
                            onChange={(e) => handleKeyChange('OPENAI_API_KEY', e.target.value)}
                            placeholder="sk-..."
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">Anthropic API Key</label>
                        <input
                            type="password"
                            value={apiKeys.ANTHROPIC_API_KEY}
                            onChange={(e) => handleKeyChange('ANTHROPIC_API_KEY', e.target.value)}
                            placeholder="sk-ant-..."
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300">xAI (Grok) API Key</label>
                        <input
                            type="password"
                            value={apiKeys.XAI_API_KEY}
                            onChange={(e) => handleKeyChange('XAI_API_KEY', e.target.value)}
                            placeholder="Just for Grok..."
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-slate-200 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        />
                    </div>
                </div>
            </div>

            {/* MODELS SECTION */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
                <div className="flex items-center gap-2 text-indigo-400">
                    <Cpu className="size-5" />
                    <h3 className="text-lg font-medium text-white">AI Models</h3>
                </div>

                {Object.keys(modelsByProvider).length === 0 && (
                    <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 text-yellow-200 rounded-lg flex items-center gap-2">
                        <AlertTriangle className="size-4" />
                        No models found. Check if your API Keys are valid.
                    </div>
                )}

                {Object.entries(modelsByProvider).map(([provider, models]) => (
                    <div key={provider} className="space-y-3">
                        <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider">{provider} Models</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {models.map(m => (
                                <label key={m.id} className="flex items-center gap-3 p-3 bg-slate-950/50 border border-slate-800 rounded-lg cursor-pointer hover:bg-slate-800/50 transition-colors">
                                    <input
                                        type="checkbox"
                                        checked={enabledModels.includes(m.name)}
                                        onChange={() => toggleModel(m.name)}
                                        className="w-5 h-5 rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-slate-900"
                                    />
                                    <div>
                                        <div className="font-medium text-slate-200">{m.displayName}</div>
                                        <div className="text-xs text-slate-500 font-mono">{m.name}</div>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
