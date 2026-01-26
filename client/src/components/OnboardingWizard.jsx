import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Key, Check, ChevronRight, Globe, Database, Shield, Github, Loader2, ArrowRight, X, RotateCw, Cpu } from 'lucide-react';
import { useToast } from './ui/Toast';

export const OnboardingWizard = ({ status, onComplete, onSkip, onOpenApiModal, onOpenDbModal, refreshTrigger, onStatusUpdate }) => {
    const { success, error: showError, info } = useToast();
    // Smart Step Detection
    // Simplified Step Mapping:
    // 1: Welcome
    // 2: Providers (API Keys / OAuth)
    // 3: Model Selection (New)
    // 4: Resources (APIs / Databases)
    // 5: Completion

    const [activeWizardSteps, setActiveWizardSteps] = useState([]);
    const [currentStepIdx, setCurrentStepIdx] = useState(0);

    const [step, setStep] = useState(1); // Internal compatibility with existing step logic
    const [availableModelsList, setAvailableModelsList] = useState([]);
    const [enabledModels, setEnabledModels] = useState([]);
    const [providers, setProviders] = useState({});
    const [loading, setLoading] = useState(false);
    const [checkingStatus, setCheckingStatus] = useState(false);

    // Copilot State
    const [copilotCode, setCopilotCode] = useState(null);
    const [copilotUrl, setCopilotUrl] = useState(null);
    const [isPollingCopilot, setIsPollingCopilot] = useState(false);

    const [openProvider, setOpenProvider] = useState(null);
    const [resourceCount, setResourceCount] = useState(0);

    const toggleProvider = (id) => {
        setOpenProvider(openProvider === id ? null : id);
    };



    // Parse initial settings to detecting enabled state
    const [enabledProviders, setEnabledProviders] = useState({});
    const [providerStatuses, setProviderStatuses] = useState({});

    const [availableResources, setAvailableResources] = useState({ apis: [], dbs: [] });
    const [toggleLoading, setToggleLoading] = useState(null); // { type: 'api'|'db', id: string }

    // Calculate Active Steps on Mount/Status Change
    useEffect(() => {
        if (!status) return;

        const steps = [];
        // Always show Welcome if not fully initialized
        if (!status.initialized) steps.push(1);

        // Models logic
        if (!status.hasModels) {
            // If no providers are even connected/configured, show Providers step
            // If no models are available, we ALWAYS need to verify providers/keys are enabled.
            steps.push(2);
            steps.push(3); // Model selection
        }

        // Resources logic
        if (!status.hasResources) {
            steps.push(4);
        }

        // Always end with completion if we came from an overlay
        steps.push(5);

        setActiveWizardSteps(steps);
        setStep(steps[0] || 1);
        setCurrentStepIdx(0);

        if (steps.includes(2)) {
            loadSettings();
        }

        if (steps.includes(3)) {
            fetchModels();
        }
    }, [status]);

    const fetchModels = async () => {
        try {
            // Force refresh of cache on backend if possible, or usually the backend handles it.
            // But we add a query param just in case we implement it
            const res = await fetch('http://localhost:3000/api/models?all=true&refresh=true&t=' + Date.now());
            const data = await res.json();
            setAvailableModelsList(data.models || []);

            // Also fetch current enabled models
            const setRes = await fetch('http://localhost:3000/api/settings');
            const setData = await setRes.json();
            setEnabledModels(setData.enabledModels || []);
        } catch (e) {
            console.error("Failed to fetch models for wizard", e);
        }
    };

    const handleNext = () => {
        const nextIdx = currentStepIdx + 1;
        if (nextIdx < activeWizardSteps.length) {
            setCurrentStepIdx(nextIdx);
            setStep(activeWizardSteps[nextIdx]);
        } else {
            onComplete();
        }
    };

    const handleBack = () => {
        if (currentStepIdx > 0) {
            const prevIdx = currentStepIdx - 1;
            setCurrentStepIdx(prevIdx);
            setStep(activeWizardSteps[prevIdx]);
        }
    };

    // Watch for resource updates to auto-advance
    useEffect(() => {
        if (step === 4) {
            fetchResources(); 
            checkResources().then(has => has && setResourceCount(1));
            
            // Regular check to detect new/external registrations
            const interval = setInterval(async () => {
                const res = await checkResources();
                setResourceCount(res ? 1 : 0);
            }, 5000); // 5s is enough for background, manual actions trigger immediate check
            
            return () => clearInterval(interval);
        }
    }, [refreshTrigger, step]);

    const fetchResources = async () => {
        try {
            const res = await fetch('http://localhost:3000/api/resources');
            const data = await res.json();
            // Filter out system resources so they don't clutter the UI or confuse the user
            const filtered = {
                apis: (data.apis || []).filter(r => !r.name?.includes('Gemini Internal') && !r.name?.includes('DataNavigator') && !r.name?.includes('Gemini CLI') && !r.idString?.startsWith('sys-')),
                dbs: (data.dbs || []).filter(r => !r.idString?.startsWith('sys-'))
            };
            setAvailableResources(filtered);
        } catch (e) {
            console.error("Failed to fetch resources", e);
        }
    };

    const handleToggleResource = async (type, id, currentStatus) => {
        setToggleLoading({ type, id });
        try {
            await fetch(`http://localhost:3000/api/resources/${type}/${id}/toggle`, {
                method: 'PATCH'
            });
            // Optimistic update
            setAvailableResources(prev => {
                const list = prev[type === 'api' ? 'apis' : 'dbs'];
                const updated = list.map(r => r.idString === id ? { ...r, isEnabled: !currentStatus } : r);
                return { ...prev, [type === 'api' ? 'apis' : 'dbs']: updated };
            });
            
            // 1. Notify parent to refresh system status
            if (onStatusUpdate) onStatusUpdate();

            // 2. Immediately check resources locally to unlock "Continue"
            const has = await checkResources();
            setResourceCount(has ? 1 : 0);

            // 3. Refresh the list to stay in sync
            fetchResources(); 
        } catch (e) {
            showError("Failed to toggle resource");
        } finally {
            setToggleLoading(null);
        }
    };

    const loadSettings = async () => {
        try {
            const [settingsRes, statusRes] = await Promise.all([
                fetch('http://localhost:3000/api/settings'),
                fetch('http://localhost:3000/api/providers')
            ]);

            const data = await settingsRes.json();
            const statuses = await statusRes.json();

            setProviders(data);
            setProviderStatuses(statuses);

            // Extract enabled states (default to true if undefined, unless key is missing)
            const enabledState = {};
            const keys = ['GEMINI', 'OPENAI', 'ANTHROPIC', 'GROQ', 'XAI', 'OLLAMA', 'LMSTUDIO', 'COPILOT', 'GEMINI-INTERNAL'];

            keys.forEach(k => {
                const settingKey = `PROVIDER_ENABLED_${k}`;
                // If setting exists, use it. If not, default to TRUE if key exists, else FALSE.
                if (data[settingKey] !== undefined) {
                    enabledState[k] = data[settingKey] === true || data[settingKey] === 'true';
                } else {
                    if (k === 'COPILOT') enabledState[k] = !!data.GITHUB_COPILOT_TOKEN;
                    else if (k === 'GEMINI-INTERNAL') {
                        // Use accurate status from /api/providers
                        enabledState[k] = statuses['gemini-internal']?.connected;
                    }
                    else {
                        const keyMap = {
                            'GEMINI': 'GEMINI_API_KEY',
                            'OPENAI': 'OPENAI_API_KEY',
                            'ANTHROPIC': 'ANTHROPIC_API_KEY',
                            'GROQ': 'GROQ_API_KEY',
                            'XAI': 'XAI_API_KEY',
                            'OLLAMA': 'OLLAMA_URL',
                            'LMSTUDIO': 'LM_STUDIO_URL'
                        };
                        enabledState[k] = !!data[keyMap[k]];
                    }
                }
            });
            setEnabledProviders(enabledState);

        } catch (e) {
            console.error("Failed to load settings", e);
        }
    };

    const handleProviderToggleState = (key, value) => {
        setEnabledProviders(prev => ({ ...prev, [key]: value }));
    };

    const checkResources = async () => {
        try {
            const res = await fetch('http://localhost:3000/api/system/status');
            const data = await res.json();
            return data.hasResources;
        } catch (e) {
            return false;
        }
    };

    const ProviderRow = ({ icon, label, providerKey, isConfigured, onToggleEnable, isEnabled, children }) => (
        <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden transition-all hover:border-slate-700">
            <div className="flex items-center justify-between p-4 bg-slate-900/50">
                <button
                    onClick={() => toggleProvider(label)}
                    className="flex-1 flex items-center justify-between hover:bg-slate-800/50 transition-colors rounded-l-lg mr-2"
                >
                    <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 text-white font-medium cursor-pointer pointer-events-none">
                            {icon} {label}
                        </label>
                        {isConfigured && !isEnabled && <span className="text-[10px] bg-red-500/10 text-red-400 px-2 py-0.5 rounded uppercase font-bold tracking-wider">Disabled</span>}
                        {isConfigured && isEnabled && <span className="text-[10px] bg-green-500/10 text-green-400 px-2 py-0.5 rounded uppercase font-bold tracking-wider">Active</span>}
                    </div>
                </button>

                <div className="flex items-center gap-4">
                    {/* Toggle Switch */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onToggleEnable(!isEnabled);
                            }}
                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900 ${isEnabled ? 'bg-indigo-600' : 'bg-slate-700'}`}
                            title={isEnabled ? "Disable Provider" : "Enable Provider"}
                        >
                            <span
                                className={`${isEnabled ? 'translate-x-5' : 'translate-x-1'} inline-block h-3 w-3 transform rounded-full bg-white transition-transform`}
                            />
                        </button>
                    </div>

                    <button
                        onClick={() => toggleProvider(label)}
                        className="p-1 hover:bg-slate-800 rounded text-slate-500 hover:text-white transition-colors"
                    >
                        <ChevronRight className={`transition-transform ${openProvider === label ? 'rotate-90' : ''}`} size={16} />
                    </button>
                </div>
            </div>
            {openProvider === label && (
                <div className="p-4 pt-0 animate-in slide-in-from-top-2 border-t border-slate-800/50 mt-2">
                    {children}
                </div>
            )}
        </div>
    );

    const saveSetting = async (key, value) => {
        // Safe-guard against undefined
        const safeValue = value === undefined ? '' : value;
        await fetch('http://localhost:3000/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key, value: safeValue })
        });
    };

    const pollingRef = useRef(false);

    const startCopilotAuth = async () => {
        setLoading(true);
        try {
            const res = await fetch('http://localhost:3000/api/auth/copilot/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({}) // Send empty object to ensure body exists
            });
            const data = await res.json();
            if (data.user_code) {
                setCopilotCode(data.user_code);
                setCopilotUrl(data.verification_uri);
                setIsPollingCopilot(true);
                pollingRef.current = true;
                pollCopilot(data.device_code, data.interval || 5);
            }
        } catch (e) {
            alert("Copilot Login Failed: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    const pollCopilot = async (deviceCode, intervalSeconds) => {
        const poll = async (currentInterval) => {
            if (!pollingRef.current) return;

            try {
                const res = await fetch('http://localhost:3000/api/auth/copilot/poll', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ deviceCode: deviceCode })
                });
                const data = await res.json();

                if (!pollingRef.current) return;

                if (data.access_token) {
                    pollingRef.current = false;
                    setIsPollingCopilot(false);
                    setCopilotCode(null);

                    // SAVE THE TOKEN!
                    await saveSetting('GITHUB_COPILOT_TOKEN', data.access_token);

                    // Refresh settings to update UI "Connected" state
                    await loadSettings();
                    // Do NOT auto-advance, let user see it connected
                    return;
                }

                if (data.error) {
                    if (data.error === 'authorization_pending') {
                        setTimeout(() => poll(currentInterval), currentInterval * 1000);
                    } else if (data.error === 'slow_down') {
                        // Increase interval by 5 seconds
                        const newInterval = currentInterval + 5;
                        console.log(`Copilot slow_down, increasing interval to ${newInterval}s`);
                        setTimeout(() => poll(newInterval), newInterval * 1000);
                    } else {
                        pollingRef.current = false;
                        setIsPollingCopilot(false);
                        alert("Copilot Error: " + data.error);
                    }
                }
            } catch (e) {
                console.error(e);
                setIsPollingCopilot(false);
                pollingRef.current = false;
            }
        };

        // Start initial poll
        setTimeout(() => poll(intervalSeconds), intervalSeconds * 1000);
    };

    const handleSaveProviders = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const updates = [];

            // Helper to save key and enable provider state
            const saveAndSync = (keyName, enabledKey, value, isEnabled) => {
                // Save Key Value even if empty to clear old values
                updates.push(saveSetting(keyName, value || ''));
                // Save Enabled State
                updates.push(saveSetting(enabledKey, isEnabled));
            };

            saveAndSync('GEMINI_API_KEY', 'PROVIDER_ENABLED_GEMINI', providers.GEMINI_API_KEY, enabledProviders.GEMINI);
            saveAndSync('OPENAI_API_KEY', 'PROVIDER_ENABLED_OPENAI', providers.OPENAI_API_KEY, enabledProviders.OPENAI);
            saveAndSync('ANTHROPIC_API_KEY', 'PROVIDER_ENABLED_ANTHROPIC', providers.ANTHROPIC_API_KEY, enabledProviders.ANTHROPIC);
            saveAndSync('GROQ_API_KEY', 'PROVIDER_ENABLED_GROQ', providers.GROQ_API_KEY, enabledProviders.GROQ);
            saveAndSync('XAI_API_KEY', 'PROVIDER_ENABLED_XAI', providers.XAI_API_KEY, enabledProviders.XAI);
            saveAndSync('OLLAMA_URL', 'PROVIDER_ENABLED_OLLAMA', providers.OLLAMA_URL, enabledProviders.OLLAMA);
            saveAndSync('LM_STUDIO_URL', 'PROVIDER_ENABLED_LMSTUDIO', providers.LM_STUDIO_URL, enabledProviders.LMSTUDIO);

            // Gemini CLI Toggle
            updates.push(saveSetting('PROVIDER_ENABLED_GEMINI-INTERNAL', enabledProviders['GEMINI-INTERNAL'] !== false));

            // Copilot Special Case
            if (providers.GITHUB_COPILOT_TOKEN) {
                updates.push(saveSetting('PROVIDER_ENABLED_COPILOT', enabledProviders.COPILOT));
            }

            info('Saving settings...');
            await Promise.all(updates);

            // Wait briefly for Settings handling
            await new Promise(resolve => setTimeout(resolve, 500));

            // --- VALIDATION PHASE ---
            // --- VERIFICATION PHASE ---
            const providersToValidate = [];
            if (enabledProviders.GEMINI) providersToValidate.push('gemini');
            if (enabledProviders.OPENAI) providersToValidate.push('openai');
            if (enabledProviders.ANTHROPIC) providersToValidate.push('anthropic');
            if (enabledProviders.GROQ) providersToValidate.push('groq');
            if (enabledProviders.XAI) providersToValidate.push('xai');

            info('Verifying connections...');
            
            // Trigger a full system status refresh (this reloads ModelManager on backend)
            await fetch('http://localhost:3000/api/system/status?t=' + Date.now());
            
            // Fetch updated provider statuses and models
            const [providersRes, modelsRes] = await Promise.all([
                fetch('http://localhost:3000/api/providers?t=' + Date.now()),
                fetch('http://localhost:3000/api/models?all=true&t=' + Date.now())
            ]);
            
            const statuses = await providersRes.json();
            const modelsData = await modelsRes.json();
            
            setProviderStatuses(statuses); // Sync local state
            setAvailableModelsList(modelsData.models || []);

            // Identify which selected providers are actually online/working
            const passed = [];
            const failed = [];
            
            providersToValidate.forEach(pid => {
                const s = statuses[pid];
                const hasModels = (s?.models && s.models.length > 0);
                if (s?.healthy && hasModels) {
                    passed.push(pid);
                } else {
                    failed.push(pid);
                }
            });

            // REPORTING (Grouped to avoid spam)
            if (passed.length > 0) {
                const passedList = passed.map(p => p.toUpperCase()).join(', ');
                success(`✓ Active: ${passedList}`);
            }

            if (failed.length > 0) {
                const failedList = failed.map(f => `${f.toUpperCase()}`).join(', ');
                showError(`⚠️ Could not reach: ${failedList}`);
            }

            // --- PERMISSIVE CHECK ---
            const hasAnyModels = (modelsData.models && modelsData.models.length > 0);
            const anyPassed = passed.length > 0;
            const isInternalConnected = statuses['gemini-internal']?.healthy && enabledProviders['GEMINI-INTERNAL'] !== false;

            if (hasAnyModels || anyPassed || isInternalConnected) {
                // If we have models, we can proceed!
                handleNext();
                return;
            } else {
                // Completely blocked flow
                if (failed.length > 0) {
                    showError("Please check your API keys or connection.");
                } else if (providersToValidate.length === 0 && !isInternalConnected) {
                    info("Please configure and enable at least one provider.");
                } else {
                    showError("No active models detected. Try enabling another provider.");
                }
            }
        } catch (err) {
            console.error('Save providers error:', err);
            showError("An error occurred during verification.");
        } finally {
            setLoading(false);
        }
    };

    // Check if at least one provider is configured AND enabled
    const hasActiveProvider =
        (providers.GEMINI_API_KEY && enabledProviders.GEMINI) ||
        (providers.OPENAI_API_KEY && enabledProviders.OPENAI) ||
        (providers.ANTHROPIC_API_KEY && enabledProviders.ANTHROPIC) ||
        (providers.GROQ_API_KEY && enabledProviders.GROQ) ||
        (providers.XAI_API_KEY && enabledProviders.XAI) ||
        ((providers.OLLAMA_URL || providers.LM_STUDIO_URL) && (enabledProviders.OLLAMA || enabledProviders.LMSTUDIO)) ||
        (providers.GITHUB_COPILOT_TOKEN && enabledProviders.COPILOT) ||
        (providerStatuses['gemini-internal']?.connected && enabledProviders['GEMINI-INTERNAL'] !== false);


    if (step === 2) {
        return (
            <div className="max-w-xl mx-auto p-6 animate-in slide-in-from-right duration-300 relative">
                <button
                    onClick={onSkip}
                    className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors"
                    title="Close & Skip"
                >
                    <X size={24} />
                </button>

                <div className="mb-8">
                    <div className="text-sm text-indigo-400 font-semibold mb-2">
                        {status?.hasResources ? 'MISSING CONFIGURATION' : 'STEP 1 OF 3'}
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">
                        {status?.hasModels ? 'Configure AI Providers' : 'Connect AI Providers'}
                    </h2>
                    <p className="text-slate-400">
                        {!status?.hasModels
                            ? "No active AI models detected. Please configure at least one provider to restore system functionality."
                            : "Configure at least one provider to power your agent."}
                    </p>
                </div>

                <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                    <ProviderRow
                        icon={<span className="text-blue-400">♦</span>}
                        label="Google Gemini"
                        isConfigured={!!providers.GEMINI_API_KEY}
                        isEnabled={enabledProviders.GEMINI}
                        onToggleEnable={(v) => handleProviderToggleState('GEMINI', v)}
                    >
                        <input
                            type="password"
                            placeholder="GEMINI_API_KEY"
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-indigo-500 outline-none"
                            value={providers.GEMINI_API_KEY || ''}
                            onChange={e => setProviders({ ...providers, GEMINI_API_KEY: e.target.value })}
                        />
                    </ProviderRow>

                    <ProviderRow
                        icon={<span className="text-green-400">●</span>}
                        label="OpenAI"
                        isConfigured={!!providers.OPENAI_API_KEY}
                        isEnabled={enabledProviders.OPENAI}
                        onToggleEnable={(v) => handleProviderToggleState('OPENAI', v)}
                    >
                        <input
                            type="password"
                            placeholder="OPENAI_API_KEY"
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-indigo-500 outline-none"
                            value={providers.OPENAI_API_KEY || ''}
                            onChange={e => setProviders({ ...providers, OPENAI_API_KEY: e.target.value })}
                        />
                    </ProviderRow>

                    <ProviderRow
                        icon={<span className="text-amber-400">▲</span>}
                        label="Anthropic Claude"
                        isConfigured={!!providers.ANTHROPIC_API_KEY}
                        isEnabled={enabledProviders.ANTHROPIC}
                        onToggleEnable={(v) => handleProviderToggleState('ANTHROPIC', v)}
                    >
                        <input
                            type="password"
                            placeholder="ANTHROPIC_API_KEY"
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-indigo-500 outline-none"
                            value={providers.ANTHROPIC_API_KEY || ''}
                            onChange={e => setProviders({ ...providers, ANTHROPIC_API_KEY: e.target.value })}
                        />
                    </ProviderRow>

                    <ProviderRow
                        icon={<span className="text-orange-400">⚡</span>}
                        label="Groq"
                        isConfigured={!!providers.GROQ_API_KEY}
                        isEnabled={enabledProviders.GROQ}
                        onToggleEnable={(v) => handleProviderToggleState('GROQ', v)}
                    >
                        <input
                            type="password"
                            placeholder="GROQ_API_KEY"
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-indigo-500 outline-none"
                            value={providers.GROQ_API_KEY || ''}
                            onChange={e => setProviders({ ...providers, GROQ_API_KEY: e.target.value })}
                        />
                    </ProviderRow>

                    <ProviderRow
                        icon={<span className="text-white">✕</span>}
                        label="xAI (Grok)"
                        isConfigured={!!providers.XAI_API_KEY}
                        isEnabled={enabledProviders.XAI}
                        onToggleEnable={(v) => handleProviderToggleState('XAI', v)}
                    >
                        <input
                            type="password"
                            placeholder="XAI_API_KEY"
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-indigo-500 outline-none"
                            value={providers.XAI_API_KEY || ''}
                            onChange={e => setProviders({ ...providers, XAI_API_KEY: e.target.value })}
                        />
                    </ProviderRow>

                    <ProviderRow
                        icon={<span className="text-purple-400">🖥️</span>}
                        label="Local LLMs"
                        isConfigured={!!providers.OLLAMA_URL || !!providers.LM_STUDIO_URL}
                        isEnabled={enabledProviders.OLLAMA || enabledProviders.LMSTUDIO}
                        onToggleEnable={(v) => {
                            handleProviderToggleState('OLLAMA', v);
                            handleProviderToggleState('LMSTUDIO', v);
                        }}
                    >
                        <div className="space-y-3">
                            <input
                                type="text"
                                placeholder="OLLAMA_URL (e.g., http://localhost:11434/v1)"
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-indigo-500 outline-none"
                                value={providers.OLLAMA_URL || ''}
                                onChange={e => setProviders({ ...providers, OLLAMA_URL: e.target.value })}
                            />
                            <input
                                type="text"
                                placeholder="LM_STUDIO_URL (e.g., http://localhost:1234/v1)"
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-indigo-500 outline-none"
                                value={providers.LM_STUDIO_URL || ''}
                                onChange={e => setProviders({ ...providers, LM_STUDIO_URL: e.target.value })}
                            />
                        </div>
                    </ProviderRow>

                    {/* Gemini CLI Special Case */}
                    <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden shadow-sm">
                        <div className="p-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
                            <button
                                onClick={() => toggleProvider('gemini-cli')}
                                className="flex-1 flex items-center justify-between hover:bg-slate-800/50 transition-colors rounded-l-lg mr-2"
                            >
                                <div className="flex items-center gap-2">
                                    <label className="flex items-center gap-2 text-white font-medium cursor-pointer pointer-events-none">
                                        <Globe size={18} /> Gemini CLI (Internal)
                                    </label>
                                    {(providerStatuses['gemini-internal']?.connected) && (
                                        <span className={`text-[10px] px-2 py-0.5 rounded uppercase font-bold tracking-wider ${enabledProviders['GEMINI-INTERNAL'] !== false ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                                            {enabledProviders['GEMINI-INTERNAL'] !== false ? 'Active' : 'Disabled'}
                                        </span>
                                    )}
                                </div>
                            </button>

                            <div className="flex items-center gap-4">
                                {/* Toggle Switch */}
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            const nextVal = !enabledProviders['GEMINI-INTERNAL'];
                                            handleProviderToggleState('GEMINI-INTERNAL', nextVal);
                                            // Trigger backend refresh immediately so models are available
                                            saveSetting('PROVIDER_ENABLED_GEMINI-INTERNAL', nextVal).then(() => {
                                                if (onStatusUpdate) onStatusUpdate();
                                            });
                                        }}
                                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900 ${enabledProviders['GEMINI-INTERNAL'] !== false ? 'bg-indigo-600' : 'bg-slate-700'}`}
                                        title={enabledProviders['GEMINI-INTERNAL'] !== false ? "Disable Provider" : "Enable Provider"}
                                    >
                                        <span
                                            className={`${enabledProviders['GEMINI-INTERNAL'] !== false ? 'translate-x-5' : 'translate-x-1'} inline-block h-3 w-3 transform rounded-full bg-white transition-transform`}
                                        />
                                    </button>
                                </div>

                                <button
                                    onClick={() => toggleProvider('gemini-cli')}
                                    className="p-1 hover:bg-slate-800 rounded text-slate-500 hover:text-white transition-colors"
                                >
                                    <ChevronRight className={`transition-transform ${openProvider === 'gemini-cli' ? 'rotate-90' : ''}`} size={16} />
                                </button>
                            </div>
                        </div>

                        {openProvider === 'gemini-cli' && (
                            <div className="p-4 pt-0 animate-in slide-in-from-top-2 border-t border-slate-800/50 mt-2">
                                <p className="text-sm text-slate-400 mb-3 mt-2">
                                    {providerStatuses['gemini-internal']?.connected
                                        ? "Connected to Google Cloud. You can now access internal Gemini models."
                                        : "Connect your Google Cloud account to access internal Gemini models."}
                                </p>
                                <button
                                    onClick={() => window.location.href = `http://localhost:3000/auth/gemini-cli/connect?redirect=${encodeURIComponent(window.location.href)}`}
                                    className={`w-full py-2 rounded-lg transition-colors flex items-center justify-center gap-2 border shadow-lg ${providerStatuses['gemini-internal']?.connected ? 'bg-green-900/20 border-green-800 text-green-400' : 'bg-indigo-600 hover:bg-indigo-500 text-white border-transparent shadow-indigo-500/20'}`}
                                >
                                    {providerStatuses['gemini-internal']?.connected ? <><Check size={16} /> Connected</> : <><Globe size={16} /> Connect Google Account</>}
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Copilot Special Case */}
                    <ProviderRow
                        icon={<Github size={18} />}
                        label="GitHub Copilot"
                        isConfigured={!!(providers.GITHUB_COPILOT_TOKEN || providers.copilot_token || providerStatuses['copilot']?.connected)}
                        isEnabled={enabledProviders.COPILOT}
                        onToggleEnable={(v) => handleProviderToggleState('COPILOT', v)}
                    >
                        {!copilotCode ? (
                            <button
                                onClick={startCopilotAuth}
                                disabled={isPollingCopilot || providerStatuses['copilot']?.connected}
                                className={`w-full py-2 rounded-lg transition-colors flex items-center justify-center gap-2 border ${providerStatuses['copilot']?.connected ? 'bg-green-900/20 border-green-800 text-green-400 cursor-default' : 'bg-slate-800 hover:bg-slate-700 text-white border-slate-700'}`}
                            >
                                {providerStatuses['copilot']?.connected ? <><Check size={16} /> Authenticated</> : (loading ? <Loader2 className="animate-spin" /> : 'Login with GitHub')}
                            </button>
                        ) : (
                            <div className="text-center p-4 bg-black/30 rounded-lg border border-white/10 relative">
                                <button
                                    onClick={() => {
                                        setCopilotCode(null);
                                        setIsPollingCopilot(false);
                                    }}
                                    className="absolute top-2 right-2 text-slate-600 hover:text-white transition-colors p-1 hover:bg-white/10 rounded"
                                    title="Reset Code"
                                >
                                    <RotateCw size={14} />
                                </button>
                                <p className="text-slate-300 text-sm mb-2">Visit <a href={copilotUrl} target="_blank" className="text-indigo-400 underline">{copilotUrl}</a></p>
                                <div className="text-2xl font-mono font-bold text-white tracking-widest my-2 select-all cursor-pointer bg-black/50 p-2 rounded">{copilotCode}</div>
                                <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
                                    <Loader2 size={12} className="animate-spin" /> Waiting for authentication...
                                </div>
                            </div>
                        )}
                    </ProviderRow>
                </div>

                <div className="flex justify-between items-center mt-8 gap-3">
                    <button
                        onClick={handleBack}
                        className="px-4 py-2 text-slate-400 hover:text-white transition-colors text-sm font-medium"
                    >
                        Back
                    </button>
                    <button
                        onClick={handleSaveProviders}
                        disabled={loading || !hasActiveProvider}
                        className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-white rounded-lg font-medium shadow-lg transition-all flex items-center gap-2"
                    >
                        {loading ? <Loader2 className="animate-spin" /> : <><Check size={18} /> Verify & Continue</>}
                    </button>
                </div>
            </div>
        );
    }

    if (step === 3) {
        const toggleModel = async (modelName) => {
            const next = enabledModels.includes(modelName)
                ? enabledModels.filter(m => m !== modelName)
                : [...enabledModels, modelName];

            setEnabledModels(next);
            await saveSetting('enabledModels', next);
        };

        const selectAll = async () => {
            const all = availableModelsList.map(m => m.name);
            const isAllSelected = all.every(m => enabledModels.includes(m));

            if (isAllSelected) {
                // Deselect All
                setEnabledModels([]);
                await saveSetting('enabledModels', []);
                info("All models disabled");
            } else {
                // Select All
                setEnabledModels(all);
                await saveSetting('enabledModels', all);
                success("All models enabled");
            }
        };

        // Group models by provider
        const grouped = availableModelsList.reduce((acc, m) => {
            const p = m.provider || 'Other';
            if (!acc[p]) acc[p] = [];
            acc[p].push(m);
            return acc;
        }, {});

        return (
            <div className="max-w-xl mx-auto p-6 animate-in slide-in-from-right duration-300 relative">
                <button
                    onClick={onSkip}
                    className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors"
                    title="Close & Skip"
                >
                    <X size={24} />
                </button>

                <div className="mb-6">
                    <div className="text-sm text-indigo-400 font-semibold mb-2">
                        {status?.initialized ? 'MISSING MODELS' : `STEP ${currentStepIdx + 1} OF ${activeWizardSteps.length}`}
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">Select Active Models</h2>
                    <p className="text-slate-400">Choose which models you want to use for chat and design tasks.</p>
                </div>

                <div className="space-y-6 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar p-1">
                    {Object.entries(grouped).map(([provider, models]) => (
                        <div key={provider} className="space-y-3">
                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                <div className="h-px bg-slate-800 flex-1" />
                                {provider}
                                <div className="h-px bg-slate-800 flex-1" />
                            </h3>
                            <div className="grid grid-cols-1 gap-2">
                                {models.map(m => (
                                    <div
                                        key={m.name}
                                        onClick={() => toggleModel(m.name)}
                                        className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${enabledModels.includes(m.name)
                                            ? 'bg-indigo-600/10 border-indigo-500/50 text-white'
                                            : 'bg-slate-900/50 border-slate-800 text-slate-400 hover:border-slate-700'
                                            }`}
                                    >
                                        <div className="flex flex-col">
                                            <span className="text-sm font-medium">{m.displayName || m.name}</span>
                                            <span className="text-[10px] opacity-60">{m.id}</span>
                                        </div>
                                        <div className={`size-5 rounded-full border-2 flex items-center justify-center transition-all ${enabledModels.includes(m.name) ? 'bg-indigo-600 border-indigo-600' : 'border-slate-700'}`}>
                                            {enabledModels.includes(m.name) && <Check size={12} className="text-white" />}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="flex justify-between items-center mt-8 pt-4 border-t border-slate-800">
                    <button
                        onClick={handleBack}
                        className="px-4 py-2 text-slate-400 hover:text-white transition-colors text-sm font-medium"
                    >
                        Back
                    </button>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={selectAll}
                            className="text-xs text-indigo-400 hover:text-indigo-300 font-medium"
                        >
                            {availableModelsList.length > 0 && availableModelsList.every(m => enabledModels.includes(m.name))
                                ? "Deselect All"
                                : "Select All"}
                        </button>
                        <button
                            onClick={handleNext}
                            disabled={enabledModels.length === 0}
                            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg font-medium shadow-lg transition-all"
                        >
                            Continue
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // --- Dynamic Step Rendering ---

    // Step 1: Welcome
    if (step === 1) {
        return (
            <div className="max-w-xl mx-auto p-12 text-center animate-in fade-in zoom-in duration-500 relative">
                <button
                    onClick={onSkip}
                    className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors"
                >
                    <X size={24} />
                </button>

                <div className="size-20 bg-indigo-600/20 rounded-2xl flex items-center justify-center mx-auto mb-8 text-indigo-400 rotate-3 shadow-xl">
                    <Sparkles size={40} />
                </div>
                <h1 className="text-4xl font-bold text-white mb-4">Configurações e Conexões</h1>
                <p className="text-lg text-slate-400 mb-8 leading-relaxed">
                    Percebemos que seu ambiente ainda não está totalmente configurado.
                    Vamos guiá-lo pelos passos necessários para ativar seu assistente inteligente.
                </p>
                <div className="space-y-4 mb-10 text-left bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Configurações Pendentes:</h3>
                    {activeWizardSteps.map((s, idx) => {
                        if (s === 1 || s === 5) return null;
                        const label = s === 2 ? "Conectar Provedores de IA" : s === 3 ? "Selecionar Modelos Ativos" : "Adicionar Recursos de Dados";
                        const icon = s === 2 ? <Key size={16} /> : s === 3 ? <Cpu size={16} /> : <Database size={16} />;
                        const color = s === 2 ? "text-blue-400" : s === 3 ? "text-purple-400" : "text-emerald-400";
                        return (
                            <div key={s} className="flex items-center gap-3 text-slate-300">
                                <div className={`p-1.5 rounded-lg bg-slate-800 ${color}`}>{icon}</div>
                                <span className="text-sm font-medium">{label}</span>
                            </div>
                        );
                    })}
                </div>
                <button
                    onClick={handleNext}
                    className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-lg shadow-lg shadow-indigo-500/20 transition-all flex items-center justify-center gap-3"
                >
                    Começar Configuração <ArrowRight size={20} />
                </button>
            </div>
        );
    }

    // Step 2: Providers (Handled by the large block above - ensuring it uses handleNext)
    // Actually, I need to make sure the large block of code for step 2 is still there and correct.
    // I noticed in the previous view that the step 2 block was still mostly intact but might have been shifted.

    // Step 4: Resources
    if (step === 4) {
        return (
            <div className="max-w-xl mx-auto p-6 animate-in slide-in-from-right duration-300 relative">
                <button
                    onClick={onSkip}
                    className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors"
                >
                    <X size={24} />
                </button>

                <div className="mb-4">
                    <div className="text-sm text-indigo-400 font-semibold mb-2">
                        {status?.initialized ? 'MISSING DATA' : `STEP ${currentStepIdx + 1} OF ${activeWizardSteps.length}`}
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">Add Data Resource</h2>
                    <p className="text-slate-400">
                        Connect an existing API or Database so the agent can interact with your data.
                    </p>
                </div>

                {/* SHOW EXISTING RESOURCES IF ANY EXIST (Even if enabled, so user can toggle them if system status is weird) */}
                {(availableResources.apis?.length > 0 || availableResources.dbs?.length > 0) && (
                    <div className="mb-6 bg-slate-900/50 border border-slate-800 rounded-xl p-4 animate-in slide-in-from-top-2">
                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                            <RotateCw size={14} /> Manage Existing Resources
                        </h3>
                        <div className="space-y-2 max-h-[150px] overflow-y-auto custom-scrollbar pr-1">
                            {availableResources.apis?.map(api => (
                                <div key={api.idString} className="flex items-center justify-between p-3 bg-slate-950/50 rounded-lg border border-slate-800">
                                    <div className="flex items-center gap-3">
                                        <Globe size={16} className="text-blue-400" />
                                        <div className="flex flex-col">
                                            <span className="text-sm text-slate-300 font-medium">{api.name}</span>
                                            {/* <span className="text-[10px] text-slate-500">{api.baseUrl}</span> */}
                                        </div>
                                        {!api.isEnabled && <span className="text-[10px] bg-red-500/10 text-red-400 px-1.5 py-0.5 rounded uppercase">Disabled</span>}
                                        {api.isEnabled && <span className="text-[10px] bg-green-500/10 text-green-400 px-1.5 py-0.5 rounded uppercase">Active</span>}
                                    </div>
                                    <button
                                        disabled={toggleLoading?.id === api.idString}
                                        onClick={() => handleToggleResource('api', api.idString, api.isEnabled)}
                                        className={`text-xs px-3 py-1.5 rounded-md transition-colors flex items-center gap-2 ${api.isEnabled ? 'bg-slate-800 text-slate-400 hover:text-white' : 'bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300'}`}
                                    >
                                        {toggleLoading?.id === api.idString && <Loader2 className="size-3 animate-spin" />}
                                        {api.isEnabled ? 'Disable' : 'Enable'}
                                    </button>
                                </div>
                            ))}
                            {availableResources.dbs?.map(db => (
                                <div key={db.idString} className="flex items-center justify-between p-3 bg-slate-950/50 rounded-lg border border-slate-800">
                                    <div className="flex items-center gap-3">
                                        <Database size={16} className="text-emerald-400" />
                                        <div className="flex flex-col">
                                            <span className="text-sm text-slate-300 font-medium">{db.name}</span>
                                        </div>
                                        {!db.isEnabled && <span className="text-[10px] bg-red-500/10 text-red-400 px-1.5 py-0.5 rounded uppercase">Disabled</span>}
                                        {db.isEnabled && <span className="text-[10px] bg-green-500/10 text-green-400 px-1.5 py-0.5 rounded uppercase">Active</span>}
                                    </div>
                                    <button
                                        disabled={toggleLoading?.id === db.idString}
                                        onClick={() => handleToggleResource('db', db.idString, db.isEnabled)}
                                        className={`text-xs px-3 py-1.5 rounded-md transition-colors flex items-center gap-2 ${db.isEnabled ? 'bg-slate-800 text-slate-400 hover:text-white' : 'bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300'}`}
                                    >
                                        {toggleLoading?.id === db.idString && <Loader2 className="size-3 animate-spin" />}
                                        {db.isEnabled ? 'Disable' : 'Enable'}
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                    <button
                        onClick={onOpenApiModal}
                        className="p-6 bg-slate-900 border border-slate-800 hover:border-indigo-500 rounded-xl group transition-all text-left"
                    >
                        <div className="p-3 bg-indigo-500/10 rounded-lg w-fit mb-4 group-hover:bg-indigo-500/20 text-indigo-400 text-sm">
                            <Globe size={24} />
                        </div>
                        <h3 className="text-lg font-semibold text-white mb-1">Register API</h3>
                        <p className="text-xs text-slate-500 leading-relaxed">Connect a REST API via OpenAPI/Swagger spec.</p>
                    </button>

                    <button
                        onClick={onOpenDbModal}
                        className="p-6 bg-slate-900 border border-slate-800 hover:border-emerald-500 rounded-xl group transition-all text-left"
                    >
                        <div className="p-3 bg-emerald-500/10 rounded-lg w-fit mb-4 group-hover:bg-emerald-500/20 text-emerald-400 text-sm">
                            <Database size={24} />
                        </div>
                        <h3 className="text-lg font-semibold text-white mb-1">Register Database</h3>
                        <p className="text-xs text-slate-500 leading-relaxed">Connect a PostgreSQL or SQL Server database.</p>
                    </button>
                </div>

                <div className="mt-8 bg-blue-900/10 border border-blue-800/30 p-4 rounded-lg flex gap-3 text-slate-300 text-sm">
                    <Shield className="shrink-0 text-blue-400" size={18} />
                    <p>Registering resources allows the agent to perform actions and query data safely.</p>
                </div>

                <div className="flex justify-between items-center mt-8">
                    <button
                        onClick={handleBack}
                        className="px-4 py-2 text-slate-400 hover:text-white transition-colors text-sm font-medium"
                    >
                        Back
                    </button>

                    <div className="flex items-center gap-4">
                        <div className="text-xs text-slate-500 flex items-center">
                            {resourceCount > 0 ? (
                                <span className="text-green-400 flex items-center gap-1 font-medium"><Check size={14} /> Resource Detected</span>
                            ) : (
                                <span className="text-amber-400 flex items-center gap-1 font-medium"><RotateCw size={14} className="animate-spin" /> Waiting for resource...</span>
                            )}
                        </div>
                        <button
                            onClick={handleNext}
                            disabled={resourceCount === 0}
                            className="px-6 py-2 bg-white text-black hover:bg-slate-200 rounded-lg font-medium shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Continue
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Completion Step
    if (step === 5) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] text-center max-w-lg mx-auto p-8 animate-in zoom-in duration-300">
                <div className="size-20 bg-green-500/20 rounded-full flex items-center justify-center mb-6 text-green-400">
                    <Check size={40} />
                </div>
                <h2 className="text-3xl font-bold text-white mb-4">All Systems Go!</h2>
                <p className="text-slate-400 mb-8 leading-relaxed text-lg">
                    Seu ambiente está pronto! Agora você já pode criar projetos e conversar com seu assistente.
                </p>
                <button
                    onClick={onComplete}
                    className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-lg shadow-lg active:scale-95 transition-all"
                >
                    Finalizar e Ir para Projetos
                </button>
            </div>
        );
    }

    return null;
};
