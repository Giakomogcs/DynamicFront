import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Key, Check, ChevronRight, Globe, Database, Shield, Github, Loader2, ArrowRight, X, RotateCw } from 'lucide-react';

export const OnboardingWizard = ({ status, onComplete, onSkip, onOpenApiModal, onOpenDbModal, refreshTrigger }) => {
    // Smart Step Detection
    const getInitialStep = () => {
        if (!status) return 1;
        if (!status.hasModels) return 2; // Needs Providers
        if (!status.hasResources) return 3; // Needs Resources
        return 1; // Default welcome
    };

    const [step, setStep] = useState(getInitialStep());
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

    const ProviderRow = ({ icon, label, isConfigured, children }) => (
        <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
            <button
                onClick={() => toggleProvider(label)}
                className="w-full flex items-center justify-between p-4 hover:bg-slate-800/50 transition-colors"
                title={label}
            >
                <label className="flex items-center gap-2 text-white font-medium cursor-pointer">
                    {icon} {label}
                </label>
                <div className="flex items-center gap-2">
                    {isConfigured && <span className="text-[10px] bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded uppercase font-bold tracking-wider">Configured</span>}
                    <ChevronRight className={`text-slate-500 transition-transform ${openProvider === label ? 'rotate-90' : ''}`} size={16} />
                </div>
            </button>
            {openProvider === label && (
                <div className="p-4 pt-0 animate-in slide-in-from-top-2 border-t border-slate-800/50 mt-2">
                    {children}
                </div>
            )}
        </div>
    );

    // Initial check for providers
    useEffect(() => {
        loadSettings();
    }, []);

    // Watch for resource updates to auto-advance
    useEffect(() => {
        if (step === 3) {
            checkResources().then(has => has && setResourceCount(1)); // Simplified initial check
            const interval = setInterval(async () => {
                const res = await checkResources();
                setResourceCount(res ? 1 : 0);
            }, 2000);
            return () => clearInterval(interval);
        }
    }, [refreshTrigger, step]);

    const loadSettings = async () => {
        try {
            const res = await fetch('http://localhost:3000/api/settings');
            const data = await res.json();
            setProviders(data);
        } catch (e) {
            console.error("Failed to load settings", e);
        }
    };

    const checkResources = async () => {
        try {
            const res = await fetch('http://localhost:3000/api/resources');
            const data = await res.json();
            const count = (data.apis?.length || 0) + (data.dbs?.length || 0);
            if (count > 0) {
                // Determine if we should auto-open auth modal? 
                // The prompt says: "toda vez que adiciona um resource já abre o modal de usuarios"
                // This is likely handled by the Register Modal's onSuccess in App.jsx.
                // Here we just show "Great, ready to finish!" button enabled.
            }
            return count > 0;
        } catch { return false; }
    };

    const handleSaveProviders = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            // Save each non-empty key
            const updates = [];
            if (providers.GEMINI_API_KEY) updates.push(saveSetting('GEMINI_API_KEY', providers.GEMINI_API_KEY));
            if (providers.OPENAI_API_KEY) updates.push(saveSetting('OPENAI_API_KEY', providers.OPENAI_API_KEY));
            if (providers.ANTHROPIC_API_KEY) updates.push(saveSetting('ANTHROPIC_API_KEY', providers.ANTHROPIC_API_KEY));
            if (providers.GROQ_API_KEY) updates.push(saveSetting('GROQ_API_KEY', providers.GROQ_API_KEY));
            if (providers.XAI_API_KEY) updates.push(saveSetting('XAI_API_KEY', providers.XAI_API_KEY));
            if (providers.OLLAMA_URL) updates.push(saveSetting('OLLAMA_URL', providers.OLLAMA_URL));
            if (providers.LM_STUDIO_URL) updates.push(saveSetting('LM_STUDIO_URL', providers.LM_STUDIO_URL));

            await Promise.all(updates);

            // Verify models
            const modelsRes = await fetch('http://localhost:3000/api/models');
            const modelsData = await modelsRes.json();

            if (modelsData.models && modelsData.models.length > 0) {
                setStep(3);
            } else {
                alert("No active models detected. Please check your keys or login with Copilot.");
            }
        } catch (err) {
            alert("Failed to save settings");
        } finally {
            setLoading(false);
        }
    };

    const saveSetting = async (key, value) => {
        await fetch('http://localhost:3000/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key, value })
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

    const hasAnyProvider = Object.values(providers).some(v => v && v.length > 0) || !!providers.GITHUB_COPILOT_TOKEN;

    if (step === 1) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center max-w-2xl mx-auto p-8 animate-in fade-in zoom-in duration-500 relative z-50">
                <div className="size-24 bg-indigo-600/20 rounded-full flex items-center justify-center mb-6 backdrop-blur-sm border border-indigo-500/30">
                    <Sparkles className="text-indigo-400 size-12" />
                </div>
                <h1 className="text-4xl font-bold text-white mb-4 drop-shadow-lg">Welcome to DynamicFront</h1>
                <p className="text-xl text-slate-200 mb-8 leading-relaxed drop-shadow-md">
                    Your intelligent agent ecosystem. <br />
                    It looks like your system is empty. We can help you set up your AI brains and data sources right now.
                </p>
                <div className="flex flex-col gap-4 w-full max-w-xs">
                    <button
                        onClick={() => setStep(2)}
                        className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold text-lg hover:scale-105 transition-all shadow-xl shadow-indigo-500/20 flex items-center justify-center gap-3"
                    >
                        Initialize System <ArrowRight />
                    </button>
                    <button
                        onClick={onSkip}
                        className="text-slate-400 hover:text-white text-sm font-medium transition-colors"
                    >
                        Skip setup for now
                    </button>
                </div>
            </div>
        );
    }

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
                    <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
                        <button
                            onClick={() => toggleProvider('gemini-cli')}
                            className="w-full flex items-center justify-between p-4 hover:bg-slate-800/50 transition-colors"
                        >
                            <label className="flex items-center gap-2 text-white font-medium cursor-pointer">
                                <Globe size={18} /> Gemini CLI (Internal)
                            </label>
                            <div className="flex items-center gap-2">
                                {/* Use providers prop if available or some other check. For now assume disconnected unless found in providers list (if we sync status) */}
                                {/* Since providers object from settings usually only has keys, we might need to rely on if 'gemini-internal' status is passed or if we just want to offer the connect button always */}
                                <ChevronRight className={`text-slate-500 transition-transform ${openProvider === 'gemini-cli' ? 'rotate-90' : ''}`} size={16} />
                            </div>
                        </button>

                        {openProvider === 'gemini-cli' && (
                            <div className="p-4 pt-0 animate-in slide-in-from-top-2 border-t border-slate-800/50 mt-2">
                                <p className="text-sm text-slate-400 mb-3">
                                    Connect your Google Cloud account to access internal Gemini models.
                                </p>
                                <button
                                    onClick={() => window.location.href = `http://localhost:3000/auth/gemini-cli/connect?redirect=${encodeURIComponent(window.location.origin)}`}
                                    className="w-full py-2 rounded-lg transition-colors flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20"
                                >
                                    <Globe size={16} /> Connect Google Account
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Copilot Special Case */}
                    <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
                        <button
                            onClick={() => toggleProvider('copilot')}
                            className="w-full flex items-center justify-between p-4 hover:bg-slate-800/50 transition-colors"
                        >
                            <label className="flex items-center gap-2 text-white font-medium cursor-pointer">
                                <Github size={18} /> GitHub Copilot
                            </label>
                            <div className="flex items-center gap-2">
                                {(providers.GITHUB_COPILOT_TOKEN || providers.copilot_token) && <span className="text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded uppercase font-bold tracking-wider">Connected</span>}
                                <ChevronRight className={`text-slate-500 transition-transform ${openProvider === 'copilot' ? 'rotate-90' : ''}`} size={16} />
                            </div>
                        </button>

                        {openProvider === 'copilot' && (
                            <div className="p-4 pt-0 animate-in slide-in-from-top-2 border-t border-slate-800/50 mt-2">
                                {!copilotCode ? (
                                    <button
                                        onClick={startCopilotAuth}
                                        disabled={isPollingCopilot || providers.GITHUB_COPILOT_TOKEN}
                                        className={`w-full py-2 rounded-lg transition-colors flex items-center justify-center gap-2 border ${providers.GITHUB_COPILOT_TOKEN ? 'bg-green-900/20 border-green-800 text-green-400 cursor-default' : 'bg-slate-800 hover:bg-slate-700 text-white border-slate-700'}`}
                                    >
                                        {providers.GITHUB_COPILOT_TOKEN ? <><Check size={16} /> Authenticated</> : (loading ? <Loader2 className="animate-spin" /> : 'Login with GitHub')}
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
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex justify-between items-center mt-8 gap-3">
                    <button
                        onClick={() => setStep(1)}
                        className="px-4 py-2 text-slate-400 hover:text-white transition-colors text-sm font-medium"
                    >
                        Back
                    </button>
                    <button
                        onClick={handleSaveProviders}
                        disabled={loading || !hasAnyProvider}
                        className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-white rounded-lg font-medium shadow-lg transition-all flex items-center gap-2"
                    >
                        {loading ? <Loader2 className="animate-spin" /> : <><Check size={18} /> Verify & Continue</>}
                    </button>
                </div>
            </div>
        );
    }

    if (step === 3) {


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
                        {status?.hasModels ? 'MISSING DATA' : 'STEP 2 OF 3'}
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">Add Data Resource</h2>
                    <p className="text-slate-400">
                        {!status?.hasResources
                            ? "The agent needs data to work with. Connect an existing API or Database."
                            : "The agent needs context. Connect an existing API or Database."}
                    </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <button
                        onClick={onOpenApiModal}
                        className="p-6 bg-slate-900 border border-slate-800 hover:border-indigo-500 rounded-xl group transition-all text-left"
                    >
                        <div className="p-3 bg-indigo-500/10 rounded-lg w-fit mb-4 group-hover:bg-indigo-500/20 text-indigo-400">
                            <Globe size={24} />
                        </div>
                        <h3 className="text-lg font-semibold text-white mb-1">Register API</h3>
                        <p className="text-sm text-slate-500">Connect a REST API via OpenAPI/Swagger spec.</p>
                    </button>

                    <button
                        onClick={onOpenDbModal}
                        className="p-6 bg-slate-900 border border-slate-800 hover:border-emerald-500 rounded-xl group transition-all text-left"
                    >
                        <div className="p-3 bg-emerald-500/10 rounded-lg w-fit mb-4 group-hover:bg-emerald-500/20 text-emerald-400">
                            <Database size={24} />
                        </div>
                        <h3 className="text-lg font-semibold text-white mb-1">Register Database</h3>
                        <p className="text-sm text-slate-500">Connect a PostgreSQL or SQL Server database.</p>
                    </button>
                </div>

                <div className="mt-8 bg-blue-900/10 border border-blue-800/30 p-4 rounded-lg flex gap-3 text-slate-300 text-sm">
                    <Shield className="shrink-0 text-blue-400" />
                    <p>When you register a resource, we'll automatically detect users and prompting you to configure access profiles.</p>
                </div>

                <div className="flex justify-between items-center mt-8">
                    <button
                        onClick={() => setStep(2)}
                        className="px-4 py-2 text-slate-400 hover:text-white transition-colors text-sm font-medium"
                    >
                        Back
                    </button>

                    <div className="flex items-center gap-4">
                        <div className="text-sm text-slate-500 flex items-center">
                            {resourceCount > 0 ? (
                                <span className="text-green-400 flex items-center gap-1"><Check size={14} /> Resource Detected</span>
                            ) : (
                                <span className="text-amber-400 flex items-center gap-1"><Loader2 size={14} className="animate-spin" /> Waiting for resource...</span>
                            )}
                        </div>
                        <button
                            onClick={() => setStep(4)}
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
    if (step === 4) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] text-center max-w-lg mx-auto p-8 animate-in zoom-in duration-300">
                <div className="size-20 bg-green-500/20 rounded-full flex items-center justify-center mb-6 text-green-400">
                    <Check size={40} />
                </div>
                <h2 className="text-3xl font-bold text-white mb-4">All Systems Go!</h2>
                <p className="text-slate-400 mb-8">
                    Your agent environment is configured. You can now create your first project and start building screens dynamically.
                </p>
                <div className="w-full">
                    <button
                        onClick={onComplete}
                        className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-lg shadow-lg active:scale-95 transition-all"
                    >
                        Create My First Project
                    </button>
                </div>
            </div>
        );
    }

    return null;
};
