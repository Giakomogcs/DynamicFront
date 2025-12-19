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

export const RegisterApiForm = ({ onSubmit, isLoading }) => {
    const [formData, setFormData] = useState({
        name: '',
        specUrl: '',
        authType: 'none',
        authToken: '',
        apiKeyName: 'api_key',
        apiKeyValue: ''
    });

    const handleSubmit = (e) => {
        e.preventDefault();

        // Construct detailed Auth Config
        let authConfigObj = {};
        if (formData.authType === 'bearer') {
            authConfigObj = { type: 'bearer', token: formData.authToken };
        } else if (formData.authType === 'apiKey') {
            authConfigObj = {
                type: 'apiKey',
                paramName: formData.apiKeyName,
                value: formData.apiKeyValue
            };
        }

        onSubmit({
            name: formData.name,
            specUrl: formData.specUrl,
            authConfig: JSON.stringify(authConfigObj)
        });
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">API Name</label>
                <input
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    placeholder="e.g. NASA API"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Documentation or OpenAPI URL</label>
                <input
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    placeholder="https://api.nasa.gov/index.html"
                    value={formData.specUrl}
                    onChange={e => setFormData({ ...formData, specUrl: e.target.value })}
                />
                <p className="text-xs text-slate-500 mt-1">
                    Provide a Swagger JSON url OR a documentation page. The Agent will attempt to learn the tools automatically.
                </p>
            </div>

            <div className="p-3 bg-slate-950/50 rounded-lg border border-slate-800 space-y-3">
                <label className="block text-sm font-medium text-slate-400">Authentication</label>
                <select
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={formData.authType}
                    onChange={e => setFormData({ ...formData, authType: e.target.value })}
                >
                    <option value="none">No Authentication</option>
                    <option value="bearer">Bearer Token</option>
                    <option value="apiKey">API Key</option>
                </select>

                {formData.authType === 'bearer' && (
                    <input
                        required
                        type="password"
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white outline-none"
                        placeholder="Bearer Token (e.g. sk-...)"
                        value={formData.authToken}
                        onChange={e => setFormData({ ...formData, authToken: e.target.value })}
                    />
                )}

                {formData.authType === 'apiKey' && (
                    <div className="flex gap-2">
                        <input
                            required
                            className="w-1/3 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white outline-none"
                            placeholder="Key Name (e.g. api_key)"
                            value={formData.apiKeyName}
                            onChange={e => setFormData({ ...formData, apiKeyName: e.target.value })}
                        />
                        <input
                            required
                            type="password"
                            className="w-2/3 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-white outline-none"
                            placeholder="Value"
                            value={formData.apiKeyValue}
                            onChange={e => setFormData({ ...formData, apiKeyValue: e.target.value })}
                        />
                    </div>
                )}
            </div>

            <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
                {isLoading ? <Loader2 className="animate-spin size-4" /> : <Check className="size-4" />}
                Register API
            </button>
        </form>
    );
};

export const RegisterDbForm = ({ onSubmit, isLoading }) => {
    const [formData, setFormData] = useState({ name: '', connectionString: '', type: 'postgres' });

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
                Register Database
            </button>
        </form>
    );
};
