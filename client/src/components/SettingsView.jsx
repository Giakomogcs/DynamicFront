
import React, { useState, useEffect } from 'react';
import { Loader2, Save, Check } from 'lucide-react';

export const SettingsView = () => {
    const [loading, setLoading] = useState(true);
    const [availableModels, setAvailableModels] = useState([]);
    const [enabledModels, setEnabledModels] = useState([]); // List of model names
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

            // Default to all enabled if not set
            if (settings.enabledModels) {
                setEnabledModels(settings.enabledModels);
            } else {
                setEnabledModels(allModels.map(m => m.name));
            }
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

    const handleSave = async () => {
        setSaving(true);
        try {
            await fetch('http://localhost:3000/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key: 'enabledModels', value: enabledModels })
            });
            // Show toast or temporary success?
        } catch (e) {
            alert("Failed to save settings: " + e.message);
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="flex h-full items-center justify-center text-slate-500"><Loader2 className="animate-spin mr-2" /> Loading settings...</div>;

    return (
        <div className="p-6 max-w-4xl mx-auto space-y-8 text-slate-200">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-semibold text-white">Settings</h2>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                    {saving ? <Loader2 className="animate-spin size-4" /> : <Save className="size-4" />}
                    Save Changes
                </button>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
                <h3 className="text-lg font-medium text-white mb-4">AI Models</h3>
                <p className="text-sm text-slate-500 mb-4">Select which models should appear in the chat model selector.</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {availableModels.map(m => (
                        <label key={m.name} className="flex items-center gap-3 p-3 bg-slate-950/50 border border-slate-800 rounded-lg cursor-pointer hover:bg-slate-800/50 transition-colors">
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
        </div>
    );
};
