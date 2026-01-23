import React, { useState, useEffect, useMemo } from 'react';
import { Loader2, Save, Key, Cpu, AlertTriangle, Settings, Shield, Server, X, RefreshCw, ChevronDown, ChevronUp, Eye, EyeOff, Globe, Power } from 'lucide-react';
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

export const SettingsView = ({ onClose, onSettingsChanged, isOpen }) => {
    const { success, error, info } = useToast();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState('keys'); // 'keys', 'models'

    // Data State
    const [availableModels, setAvailableModels] = useState([]);

    const [enabledModels, setEnabledModels] = useState([]);
    const [initialEnabledModels, setInitialEnabledModels] = useState([]); // Added missing state

    const [userSettings, setUserSettings] = useState({});

    const [generalSettings, setGeneralSettings] = useState({
        FAILOVER_ENABLED: true
    });
    const [initialGeneralSettings, setInitialGeneralSettings] = useState({ FAILOVER_ENABLED: true }); // Added missing state

    const [providerSettings, setProviderSettings] = useState({});
    const [initialProviderSettings, setInitialProviderSettings] = useState({}); // Added missing state

    const [providerStatuses, setProviderStatuses] = useState({});

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
    const [initialApiKeys, setInitialApiKeys] = useState({}); // Added missing state

    // Validation Tracking State
    const [validatingKeys, setValidatingKeys] = useState(new Set());
    const [keyErrors, setKeyErrors] = useState({}); // { GEMINI_API_KEY: "Erro..." }
    const [refreshingProviders, setRefreshingProviders] = useState(false);

    // Save State
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

    // GitHub Copilot Auth State
    const [copilotStatus, setCopilotStatus] = useState('disconnected');
    const [copilotData, setCopilotData] = useState(null);
    const [copilotUser, setCopilotUser] = useState(null);

    useEffect(() => {
        // Fetch on mount to ensure data is loaded even if isOpen is not passed
        fetchData();
    }, []);

    useEffect(() => {
        if (isOpen) {
            fetchData();
        }
    }, [isOpen]);

    const fetchData = async (options = {}) => {
        const { skipSettings = false } = options;
        try {
            // 1. Fetch All Models (In settings, we want to see ALL discovered models to enable/disable them)
            const modelsRes = await fetch(`http://localhost:3000/api/models?all=true&t=${Date.now()}`);
            let allModels = [];
            if (modelsRes.ok) {
                const modelsData = await modelsRes.json();
                allModels = Array.isArray(modelsData.models) ? modelsData.models : (Array.isArray(modelsData) ? modelsData : []);
            }
            setAvailableModels(allModels);

            // 2. Fetch Provider Statuses
            try {
                const statusRes = await fetch(`http://localhost:3000/api/providers?t=${Date.now()}`);
                if (statusRes.ok) {
                    const statusData = await statusRes.json();
                    setProviderStatuses(statusData);
                }
            } catch (e) {
                console.warn("Failed to fetch provider statuses", e);
            }

            if (skipSettings) {
                setLoading(false);
                return;
            }

            // 3. Fetch Settings
            const settingsRes = await fetch('http://localhost:3000/api/settings');
            const settings = await settingsRes.json();
            setUserSettings(settings);

            setGeneralSettings({
                FAILOVER_ENABLED: settings.FAILOVER_ENABLED !== false // Default true
            });
            setInitialGeneralSettings({
                FAILOVER_ENABLED: settings.FAILOVER_ENABLED !== false
            });

            // Extract provider enabled states
            const provSettings = {};
            ['gemini', 'groq', 'openai', 'anthropic', 'xai', 'copilot', 'lmstudio', 'ollama', 'gemini-internal'].forEach(p => {
                provSettings[p] = settings[`PROVIDER_ENABLED_${p.toUpperCase()}`] !== false; // Default true
            });
            setProviderSettings(provSettings);
            setInitialProviderSettings(provSettings);

            // Load Enabled Models
            if (settings.enabledModels && settings.enabledModels.length > 0) {
                setEnabledModels(settings.enabledModels);
                setInitialEnabledModels(settings.enabledModels);
            } else {
                // DEFAULT: Enable all available models (Minimalist approach: Backend already filtered them)
                // If user wants to hide some, they can. But default to showing what works.
                const defaultEnabled = Array.isArray(allModels) ? allModels.map(m => m.name) : [];
                setEnabledModels(defaultEnabled);
                setInitialEnabledModels(defaultEnabled);
            }

            // Load Keys
            const loadedKeys = {
                GEMINI_API_KEY: settings.GEMINI_API_KEY || '',
                GROQ_API_KEY: settings.GROQ_API_KEY || '',
                OPENAI_API_KEY: settings.OPENAI_API_KEY || '',
                ANTHROPIC_API_KEY: settings.ANTHROPIC_API_KEY || '',
                XAI_API_KEY: settings.XAI_API_KEY || '',
                GITHUB_COPILOT_TOKEN: settings.GITHUB_COPILOT_TOKEN || '',
                LM_STUDIO_URL: settings.LM_STUDIO_URL || '',
                OLLAMA_URL: settings.OLLAMA_URL || ''
            };
            setApiKeys(loadedKeys);
            setInitialApiKeys(loadedKeys);

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

    const disconnectGemini = async () => {
        try {
            setRefreshingProviders(true);
            await fetch('http://localhost:3000/auth/gemini-cli/disconnect', { method: 'POST' });
            await fetchData({ skipSettings: false });
            if (onSettingsChanged) onSettingsChanged();
            success("Disconnected Gemini CLI");
        } catch (e) {
            error("Failed to disconnect");
        } finally {
            setRefreshingProviders(false);
        }
    };



    const disconnectCopilot = async () => {
        try {
            setRefreshingProviders(true);
            setCopilotStatus('disconnected');
            setCopilotUser(null);

            // Clear Token in DB
            await fetch('http://localhost:3000/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key: 'GITHUB_COPILOT_TOKEN', value: '' })
            });

            // Also disable the provider to be safe?
            // await fetch('http://localhost:3000/api/settings', {
            //     method: 'POST',
            //     headers: { 'Content-Type': 'application/json' },
            //     body: JSON.stringify({ key: 'PROVIDER_ENABLED_COPILOT', value: false })
            // });
            // Updating local state for the toggle to 'Disabled' would be consistent, 
            // but user might want to keep it 'Active' but disconnected? 
            // Usually if disconnected, it can't be active. 
            // Let's force disable it too.

            await fetch('http://localhost:3000/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key: 'PROVIDER_ENABLED_COPILOT', value: false })
            });
            setProviderSettings(prev => ({ ...prev, copilot: false }));

            await fetchData({ skipSettings: false });
            if (onSettingsChanged) onSettingsChanged();
            success("Disconnected GitHub Copilot");
        } catch (e) {
            console.error("Disconnect failed", e);
            error("Failed to disconnect");
        } finally {
            setRefreshingProviders(false);
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
        // Clean error when user edits
        setKeyErrors(prev => {
            if (!prev[provider]) return prev;
            const updated = { ...prev };
            delete updated[provider];
            return updated;
        });
    };

    const handleProviderToggle = async (providerId, isEnabled) => {
        // 1. Optimistic UI update
        const newSettings = { ...providerSettings, [providerId]: isEnabled };
        setProviderSettings(newSettings);
        setRefreshingProviders(true);

        try {
            // 2. Explicit Save to DB immediately to avoid race conditions
            await fetch('http://localhost:3000/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key: `PROVIDER_ENABLED_${providerId.toUpperCase()}`, value: isEnabled })
            });

            // Update initial state so auto-saver doesn't get confused if it runs later
            setInitialProviderSettings(prev => ({ ...prev, [providerId]: isEnabled }));

            // 3. Refresh Data (Models might change)
            // FORCE FULL RELOAD to ensure DB persistence is verified by UI
            await fetchData({ skipSettings: false });

            if (onSettingsChanged) {
                onSettingsChanged();
            }

            info(`${isEnabled ? 'Enabled' : 'Disabled'} ${providerId}`);

        } catch (e) {
            console.error("Failed to toggle provider", e);
            error("Failed to save setting");
            // Revert on error
            setProviderSettings(prev => ({ ...prev, [providerId]: !isEnabled }));
        } finally {
            setRefreshingProviders(false);
        }
    };

    const handleGeneralChange = (key, value) => {
        setGeneralSettings(prev => ({ ...prev, [key]: value }));
    };

    // --- SMART SAVE LOGIC ---

    // --- SMART SAVE LOGIC ---
    // (Initial values are now set in fetchData)

    // Detect if API keys actually changed
    const hasApiKeyChanges = useMemo(() => {
        if (loading || Object.keys(initialApiKeys).length === 0) return false;
        return Object.keys(apiKeys).some(key => apiKeys[key] !== initialApiKeys[key]);
    }, [apiKeys, initialApiKeys, loading]);

    // 1. Auto-save Enabled Models, General Settings (Immediate)
    useEffect(() => {
        if (loading) return;
        if (initialEnabledModels.length === 0) return; // Skip initial render

        // Only save if actually changed
        const modelsChanged = JSON.stringify(enabledModels) !== JSON.stringify(initialEnabledModels);
        const generalChanged = JSON.stringify(generalSettings) !== JSON.stringify(initialGeneralSettings);

        if (modelsChanged) {
            saveNonKeySettings();
        }
    }, [enabledModels, generalSettings]);

    // 2. Smart API Keys save (only on real changes, debounced)
    useEffect(() => {
        if (!hasApiKeyChanges) return;

        setHasUnsavedChanges(true);
        const timer = setTimeout(() => {
            saveApiKeys();
        }, 2000); // 2s debounce for keys

        return () => clearTimeout(timer);
    }, [apiKeys, hasApiKeyChanges]);

    // Clean up Orphaned Models (Models saved in DB but no longer returned by API/Filter)
    useEffect(() => {
        if (loading || availableModels.length === 0) return;

        // Get set of valid IDs
        const validIds = new Set(availableModels.map(m => m.id || m.name));

        // Find enabled models that are invalid
        const orphans = enabledModels.filter(id => !validIds.has(id));

        if (orphans.length > 0) {
            console.log("Removing orphaned models:", orphans);
            setEnabledModels(prev => prev.filter(id => validIds.has(id)));
            // This state change will trigger the auto-save effect automatically, cleaning DB.
        }
    }, [availableModels, loading]); // Depend only on availableModels change


    // Refactored Save Functions
    const saveNonKeySettings = async () => {
        setSaving(true);
        try {
            const promises = [];
            // Check if models actually changed vs initial
            if (JSON.stringify(enabledModels) !== JSON.stringify(initialEnabledModels)) {
                promises.push(fetch('http://localhost:3000/api/settings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ key: 'enabledModels', value: enabledModels })
                }));
            }

            // Check General Settings
            Object.entries(generalSettings).forEach(([key, val]) => {
                promises.push(fetch('http://localhost:3000/api/settings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ key, value: val })
                }));
            });

            // Check Provider Settings
            // We save ALL provider settings to ensure consistency, but only if we are here.
            Object.entries(providerSettings).forEach(([id, isEnabled]) => {
                promises.push(fetch('http://localhost:3000/api/settings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ key: `PROVIDER_ENABLED_${id.toUpperCase()}`, value: isEnabled })
                }));
            });

            await Promise.all(promises);

            // Update initial state to prevent loop and reflect current committed state
            setInitialEnabledModels(enabledModels);
            setInitialProviderSettings(providerSettings);

            // Only refresh full data if PROVIDERS were toggled (as that affects available models)
            // We can detect this by checking if providerSettings changed.
            // For now, let's skip fetchData here unless necessary to stop the loop.
            // The user interaction 'handleProviderToggle' already calls fetchData, so we don't need it here.

            if (onSettingsChanged) onSettingsChanged();
        } catch (e) {
            console.error("Auto-save failed", e);
            error("Auto-save failed: " + e.message);
        } finally {
            setSaving(false);
        }
    };

    const saveApiKeys = async () => {
        setSaving(true);
        try {
            const promises = [];
            const providersToValidate = new Set();

            // Map keys to provider IDs
            const keyMap = {
                'GEMINI_API_KEY': 'gemini',
                'GROQ_API_KEY': 'groq',
                'OPENAI_API_KEY': 'openai',
                'ANTHROPIC_API_KEY': 'anthropic',
                'XAI_API_KEY': 'xai',
                'GITHUB_COPILOT_TOKEN': 'copilot',
                'LM_STUDIO_URL': 'lmstudio',
                'OLLAMA_URL': 'ollama'
            };

            // Only save keys that actually changed
            Object.entries(apiKeys).forEach(([key, val]) => {
                if (val !== undefined && val !== initialApiKeys[key]) {
                    promises.push(fetch('http://localhost:3000/api/settings', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ key, value: val })
                    }));

                    const providerId = keyMap[key];
                    if (providerId) providersToValidate.add(providerId);
                }
            });

            if (promises.length === 0) {
                setSaving(false);
                return; // Nothing to save
            }

            await Promise.all(promises);

            // Update initial values to reflect saved state
            setInitialApiKeys(apiKeys);
            setHasUnsavedChanges(false);

            // Trigger Validation Logic
            if (providersToValidate.size > 0) {
                info("Validating new keys...");

                // Set validating state
                setValidatingKeys(new Set(providersToValidate));

                // Validate each in parallel
                const validationPromises = Array.from(providersToValidate).map(async (pid) => {
                    try {
                        const res = await fetch(`http://localhost:3000/api/providers/${pid}/validate`, { method: 'POST' });
                        const data = await res.json();

                        const apiKeyName = Object.keys(keyMap).find(k => keyMap[k] === pid);

                        if (!data.valid) {
                            // Set error state
                            const errorMsg = data.status?.errorMessage || 'Validation Failed';
                            setKeyErrors(prev => ({
                                ...prev,
                                [apiKeyName]: errorMsg
                            }));
                            // Show toast
                            error(`${pid.toUpperCase()} failed: ${errorMsg}`);
                        } else {
                            // Clear specific error if success
                            setKeyErrors(prev => {
                                const next = { ...prev };
                                delete next[apiKeyName];
                                return next;
                            });
                        }
                    } catch (e) {
                        console.error(`Validation error for ${pid}`, e);
                    } finally {
                        setValidatingKeys(prev => {
                            const next = new Set(prev);
                            next.delete(pid);
                            return next;
                        });
                    }
                });

                await Promise.all(validationPromises);
            }

            // Refresh to get new models and statuses
            await fetchData({ skipSettings: true });

            if (Object.keys(keyErrors).length === 0) {
                // Only show success if no errors persist (or we could show partial success)
                // success("Settings saved!");
            }

            if (onSettingsChanged) onSettingsChanged();
        } catch (e) {
            error("Failed to save keys: " + e.message);
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

                    // Save token
                    await fetch('http://localhost:3000/api/settings', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ key: 'GITHUB_COPILOT_TOKEN', value: data.access_token })
                    });

                    // Update state AFTER saving to avoid auto-save conflict
                    setApiKeys(prev => ({ ...prev, GITHUB_COPILOT_TOKEN: data.access_token }));
                    setInitialApiKeys(prev => ({ ...prev, GITHUB_COPILOT_TOKEN: data.access_token }));

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





    // --- SMART MODEL FILTERING ---
    const processedModels = useMemo(() => {
        const groups = {};

        // Safety check if API failed
        const safeModels = Array.isArray(availableModels) ? availableModels : [];

        // Backend now strictly returns only validated models from healthy providers.
        // We just need to group them by provider.

        safeModels.forEach(m => {
            const provider = m.provider || 'unknown';
            if (!groups[provider]) groups[provider] = [];
            groups[provider].push(m);
        });

        // Sort within groups
        Object.keys(groups).forEach(provider => {
            groups[provider].sort((a, b) => {
                // Keep flagship priority for sorting order only
                const getPriorityScore = (name) => {
                    const index = FLAGSHIP_PRIORITY.findIndex(p => name.toLowerCase().includes(p));
                    return index === -1 ? 999 : index;
                };

                const aScore = getPriorityScore(a.name);
                const bScore = getPriorityScore(b.name);

                if (aScore !== bScore) {
                    return aScore - bScore;
                }
                return a.name.localeCompare(b.name);
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
        { id: 'general', label: 'General', icon: Settings },
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
                        {saving && (
                            <span className="flex items-center gap-2 text-xs text-indigo-400 font-medium animate-pulse">
                                <Loader2 className="animate-spin size-3" />
                                Saving...
                            </span>
                        )}
                        {/* 
                           REMOVED SAVE BUTTON 
                           Auto-save is enabled
                        */}
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

                {/* GENERAL TAB */}
                {activeTab === 'general' && (
                    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-2">
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold text-white">System Preferences</h3>
                            <Toggle
                                label="Automatic Model Failover"
                                description="If a model fails or hits a rate limit, automatically try other configured providers."
                                check={generalSettings.FAILOVER_ENABLED}
                                onChange={(val) => handleGeneralChange('FAILOVER_ENABLED', val)}
                            />

                            <div className="pt-6 border-t border-slate-800">
                                <h3 className="text-lg font-semibold text-white mb-4">Account</h3>
                                <button
                                    onClick={() => {
                                        // Simple logout: clear token and reload
                                        // In a real app we might want to call an endpoint, but JWT is stateless mostly.
                                        localStorage.removeItem('authToken');
                                        window.location.href = '/login';
                                    }}
                                    className="px-4 py-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 rounded-lg transition-colors flex items-center gap-2"
                                >
                                    <Power className="size-4" />
                                    Log Out
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* KEYS TAB */}
                {activeTab === 'keys' && (
                    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-2">

                        {/* Gemini Internal (CLI) Block */}
                        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
                            <div className="p-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 bg-slate-800 rounded-lg text-indigo-400"><Globe className="size-4" /></div>
                                    <span className="font-medium text-white">Gemini CLI (Internal)</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    {(providerStatuses['gemini-internal']?.connected) && (
                                        <div
                                            onClick={() => handleProviderToggle('gemini-internal', !providerSettings['gemini-internal'])}
                                            className={`cursor-pointer px-2 py-0.5 text-xs rounded-full border flex items-center gap-1 opacity-80 hover:opacity-100 ${providerSettings['gemini-internal'] !== false ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-slate-700 text-slate-400'}`}
                                        >
                                            <div className={`size-1.5 rounded-full ${providerSettings['gemini-internal'] !== false ? 'bg-green-500' : 'bg-slate-500'}`} />
                                            {providerSettings['gemini-internal'] !== false ? 'Active' : 'Disabled'}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="p-6 space-y-4">
                                <p className="text-sm text-slate-400">
                                    Connect your Google Cloud account to unlock internal Gemini models.
                                </p>

                                {(providerStatuses['gemini-internal']?.connected) ? (
                                    <div className="flex justify-between items-center bg-slate-950/50 p-3 rounded-lg border border-slate-800">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm text-slate-300">Connected to <strong>Google Cloud</strong></span>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => {
                                                    const redirectUrl = new URL(window.location.href);
                                                    redirectUrl.searchParams.set('settings', 'true');
                                                    window.location.href = `http://localhost:3000/auth/gemini-cli/connect?redirect=${encodeURIComponent(redirectUrl.toString())}`;
                                                }}
                                                className="text-xs text-indigo-400 hover:bg-slate-800 px-2 py-1 rounded transition-colors"
                                            >
                                                Reconnect
                                            </button>
                                            <button
                                                onClick={disconnectGemini}
                                                className="text-xs text-red-400 hover:bg-red-500/10 px-2 py-1 rounded transition-colors"
                                            >
                                                Disconnect
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => {
                                            const redirectUrl = new URL(window.location.href);
                                            redirectUrl.searchParams.set('settings', 'true');
                                            window.location.href = `http://localhost:3000/auth/gemini-cli/connect?redirect=${encodeURIComponent(redirectUrl.toString())}`;
                                        }}
                                        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors shadow-lg shadow-indigo-500/20"
                                    >
                                        <Globe className="size-4" />
                                        Connect Gemini CLI
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* GitHub Copilot Block */}
                        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
                            <div className="p-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 bg-slate-800 rounded-lg text-white"><Settings className="size-4" /></div>
                                    <span className="font-medium text-white">GitHub Copilot</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    {(copilotStatus === 'connected' || providerStatuses['copilot']?.connected) && (
                                        <div
                                            onClick={() => handleProviderToggle('copilot', !providerSettings.copilot)}
                                            className={`cursor-pointer px-2 py-0.5 text-xs rounded-full border flex items-center gap-1 opacity-80 hover:opacity-100 ${providerSettings.copilot !== false ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-slate-700 text-slate-400'}`}
                                        >
                                            <div className={`size-1.5 rounded-full ${providerSettings.copilot !== false ? 'bg-green-500' : 'bg-slate-500'}`} />
                                            {providerSettings.copilot !== false ? 'Active' : 'Disabled'}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="p-6 space-y-4">
                                <p className="text-sm text-slate-400">Connect to your GitHub account to access Copilot models.</p>

                                {(copilotStatus === 'connected' || providerStatuses['copilot']?.connected) ? (
                                    <div className="flex justify-between items-center bg-slate-950/50 p-3 rounded-lg border border-slate-800">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm text-slate-300">Logged in as <strong>{copilotUser}</strong></span>
                                        </div>
                                        <button onClick={disconnectCopilot} className="text-xs text-red-400 hover:bg-red-500/10 px-2 py-1 rounded transition-colors">Disconnect Account</button>
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
                                    isEnabled={providerSettings.gemini}
                                    onToggle={(v) => handleProviderToggle('gemini', v)}
                                    status={providerStatuses.gemini}
                                    validating={validatingKeys.has('gemini')}
                                    error={keyErrors['GEMINI_API_KEY']}
                                />
                                <ApiKeyInput
                                    label="OpenAI"
                                    value={apiKeys.OPENAI_API_KEY}
                                    onChange={(v) => handleKeyChange('OPENAI_API_KEY', v)}
                                    placeholder="sk-..."
                                    isEnabled={providerSettings.openai}
                                    onToggle={(v) => handleProviderToggle('openai', v)}
                                    status={providerStatuses.openai}
                                    validating={validatingKeys.has('openai')}
                                    error={keyErrors['OPENAI_API_KEY']}
                                />
                                <ApiKeyInput
                                    label="Groq"
                                    value={apiKeys.GROQ_API_KEY}
                                    onChange={(v) => handleKeyChange('GROQ_API_KEY', v)}
                                    desc="Required for Llama 3 & Mixtral (Fast)"
                                    placeholder="gsk_..."
                                    isEnabled={providerSettings.groq}
                                    onToggle={(v) => handleProviderToggle('groq', v)}
                                    status={providerStatuses.groq}
                                    validating={validatingKeys.has('groq')}
                                    error={keyErrors['GROQ_API_KEY']}
                                />
                                <ApiKeyInput
                                    label="Anthropic"
                                    value={apiKeys.ANTHROPIC_API_KEY}
                                    onChange={(v) => handleKeyChange('ANTHROPIC_API_KEY', v)}
                                    placeholder="sk-ant-..."
                                    isEnabled={providerSettings.anthropic}
                                    onToggle={(v) => handleProviderToggle('anthropic', v)}
                                    status={providerStatuses.anthropic}
                                    validating={validatingKeys.has('anthropic')}
                                    error={keyErrors['ANTHROPIC_API_KEY']}
                                />
                                <ApiKeyInput
                                    label="xAI (Grok)"
                                    value={apiKeys.XAI_API_KEY}
                                    onChange={(v) => handleKeyChange('XAI_API_KEY', v)}
                                    placeholder="key..."
                                    isEnabled={providerSettings.xai}
                                    onToggle={(v) => handleProviderToggle('xai', v)}
                                    status={providerStatuses.xai}
                                    validating={validatingKeys.has('xai')}
                                    error={keyErrors['XAI_API_KEY']}
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
                                    isEnabled={providerSettings.lmstudio}
                                    onToggle={(v) => handleProviderToggle('lmstudio', v)}
                                    status={providerStatuses.lmstudio}
                                    validating={validatingKeys.has('lmstudio')}
                                    error={keyErrors['LM_STUDIO_URL']}
                                />
                                <ApiKeyInput
                                    label="Ollama URL"
                                    value={apiKeys.OLLAMA_URL}
                                    onChange={(v) => handleKeyChange('OLLAMA_URL', v)}
                                    placeholder="http://localhost:11434/v1"
                                    type="text"
                                    isEnabled={providerSettings.ollama}
                                    onToggle={(v) => handleProviderToggle('ollama', v)}
                                    status={providerStatuses.ollama}
                                    validating={validatingKeys.has('ollama')}
                                    error={keyErrors['OLLAMA_URL']}
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
                                                <label key={m.id || m.name} className="flex items-center gap-3 p-3 hover:bg-slate-800 cursor-pointer transition-colors group">
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

            {/* Mobile Footer Save - REMOVED */}
        </div>
    );
};


const Toggle = ({ check, onChange, label, description }) => (
    <div className="flex items-center justify-between p-3 bg-slate-900 border border-slate-800 rounded-lg">
        <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium text-slate-200">{label}</span>
            {description && <span className="text-[10px] text-slate-500">{description}</span>}
        </div>
        <button
            onClick={() => onChange(!check)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900 ${check ? 'bg-indigo-600' : 'bg-slate-700'}`}
        >
            <span
                className={`${check ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
            />
        </button>
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

const ApiKeyInput = ({ label, value, onChange, placeholder, type = 'password', desc, onToggle, isEnabled, status, validating, error }) => {
    const [showKey, setShowKey] = useState(false);

    const getStatusInfo = () => {
        if (validating) return { color: 'blue', text: 'Validating...' };
        if (error) return { color: 'red', text: 'Validation Failed' };

        if (!status) return { color: 'slate', text: 'Unknown' };

        const { status: providerStatus, quota, lastError, failCount } = status;

        // Check for errors first
        if (lastError || (failCount && failCount > 0)) {
            return { color: 'red', text: 'Error' };
        }

        // Check quota
        if (quota) {
            const usagePercent = quota.usagePercentage || 0;
            if (usagePercent > 90) return { color: 'red', text: 'Quota Critical' };
            if (usagePercent > 70) return { color: 'yellow', text: 'Quota Warning' };
        }

        // Check provider status
        if (providerStatus === 'online') return { color: 'green', text: 'Online' };
        if (providerStatus === 'offline') return { color: 'red', text: 'Offline' };

        return { color: 'slate', text: 'Unknown' };
    };

    const statusInfo = getStatusInfo();
    const hasValue = value && value.length > 5;

    const formatNumber = (num) => {
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num?.toString() || '0';
    };

    return (
        <div className="space-y-2 group">
            <div className="flex justify-between items-center">
                <label className="text-xs font-medium text-slate-400 group-focus-within:text-indigo-400 transition-colors flex items-center gap-2">
                    {label}
                    {hasValue && isEnabled && (
                        <span className={`flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full border ${statusInfo.color === 'green' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                            statusInfo.color === 'yellow' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
                                statusInfo.color === 'red' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                                    statusInfo.color === 'blue' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                                        'bg-slate-500/10 text-slate-400 border-slate-500/20'
                            }`}>
                            {validating ? (
                                <Loader2 className="animate-spin size-2.5" />
                            ) : (
                                <span className={`size-1.5 rounded-full ${statusInfo.color === 'green' ? 'bg-green-500' :
                                    statusInfo.color === 'yellow' ? 'bg-yellow-500' :
                                        statusInfo.color === 'red' ? 'bg-red-500' :
                                            statusInfo.color === 'blue' ? 'bg-blue-500' : 'bg-slate-500'
                                    }`} />
                            )}
                            {statusInfo.text}
                            {status?.models && !validating && !error && <span className="opacity-60">· {status.models.length} models</span>}
                        </span>
                    )}
                </label>
                {onToggle && (
                    <span onClick={() => onToggle(!isEnabled)} className={`text-[9px] px-1.5 py-0.5 rounded cursor-pointer border transition-colors ${isEnabled ? 'bg-green-500/10 text-green-400 border-green-500/20 hover:bg-green-500/20' :
                        'bg-slate-800 text-slate-500 border-slate-700 hover:bg-slate-700'
                        }`}>{isEnabled ? 'ENABLED' : 'DISABLED'}</span>
                )}
            </div>
            <div className={`relative ${!isEnabled && onToggle ? 'opacity-50 pointer-events-none grayscale' : ''}`}>
                <input type={showKey ? 'text' : type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
                    className={`w-full bg-slate-950 border rounded-lg pl-3 pr-16 py-2 text-sm text-slate-200 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all placeholder:text-slate-700 font-mono
                        ${error ? 'border-red-500/50 focus:border-red-500 focus:ring-red-500' : 'border-slate-800 hover:border-slate-700'}`}
                />

                {hasValue && type === 'password' && (
                    <button type="button" onClick={() => setShowKey(!showKey)}
                        className="absolute right-9 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-300 transition-colors"
                        title={showKey ? 'Hide API key' : 'Show API key'}>
                        {showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                )}
                {hasValue && isEnabled !== false && statusInfo.color === 'green' && !validating && !error && (
                    <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                        <div className="size-1.5 rounded-full bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]" />
                    </div>
                )}
                {validating && (
                    <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                        <Loader2 className="animate-spin size-3 text-blue-400" />
                    </div>
                )}
                {error && (
                    <div className="absolute right-2.5 top-1/2 -translate-y-1/2 group/err">
                        <AlertTriangle className="size-4 text-red-500 cursor-help" />
                        <div className="absolute bottom-full right-0 mb-2 w-64 p-2 bg-red-950 border border-red-500/30 rounded text-[10px] text-red-200 opacity-0 group-hover/err:opacity-100 pointer-events-none transition-opacity shadow-xl z-50">
                            {error}
                        </div>
                    </div>
                )}
            </div>
            {status?.quota && status.quota.dailyLimit && (
                <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-slate-500">
                        <span>{formatNumber(status.quota.dailyUsage)} / {formatNumber(status.quota.dailyLimit)} tokens today</span>
                        <span className={status.quota.usagePercentage > 70 ? 'text-yellow-400 font-medium' : ''}>
                            {status.quota.usagePercentage?.toFixed(1)}%
                        </span>
                    </div>
                    <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${status.quota.usagePercentage > 90 ? 'bg-red-500' :
                            status.quota.usagePercentage > 70 ? 'bg-yellow-500' : 'bg-green-500'
                            }`} style={{ width: `${Math.min(status.quota.usagePercentage || 0, 100)}%` }} />
                    </div>
                </div>
            )}
            {desc && <p className="text-[10px] text-slate-600">{desc}</p>}
        </div>
    );
};
