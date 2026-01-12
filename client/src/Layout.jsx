import React, { useState } from 'react';
import { Layers, Database, MessageSquare, Plus, Settings, Menu, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
    return twMerge(clsx(inputs));
}

const Layout = ({ children, activeTab, setActiveTab, onRegisterApi, onRegisterDb, onOpenLoadModal, headerContent }) => {
    const [sidebarOpen, setSidebarOpen] = useState(false);

    return (
        <div className="flex h-screen bg-slate-950 text-slate-200 overflow-hidden font-sans">
            {/* Overlay for mobile sidebar */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 md:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar - Overlay on mobile, fixed width on desktop */}
            <div className={cn(
                "bg-slate-900 border-r border-slate-800 flex flex-col transition-transform duration-300 z-50",
                "fixed md:relative h-full w-64",
                sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
            )}>
                {/* Header with logo */}
                <div className="p-4 flex items-center justify-between border-b border-slate-800 h-16">
                    <div className="flex items-center gap-3">
                        <div className="size-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shrink-0 shadow-lg shadow-indigo-500/20">
                            <Layers className="text-white size-6" />
                        </div>
                        <span className="font-bold text-xl tracking-tight text-white">
                            DynamicFront
                        </span>
                    </div>

                    {/* Mobile close button */}
                    <button
                        onClick={() => setSidebarOpen(false)}
                        className="md:hidden p-1.5 hover:bg-slate-800 rounded-lg transition-colors"
                    >
                        <X size={20} className="text-slate-400" />
                    </button>
                </div>

                <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                    <SidebarItem
                        icon={<MessageSquare size={20} />}
                        label="Chat Canvas"
                        isActive={activeTab === 'chat'}
                        onClick={() => {
                            setActiveTab('chat');
                            setSidebarOpen(false);
                        }}
                    />
                    <SidebarItem
                        icon={<Database size={20} />}
                        label="My Resources"
                        isActive={activeTab === 'resources'}
                        onClick={() => {
                            setActiveTab('resources');
                            setSidebarOpen(false);
                        }}
                    />
                    <SidebarItem
                        icon={<Database size={20} />}
                        label="Load Analysis"
                        onClick={() => {
                            onOpenLoadModal();
                            setSidebarOpen(false);
                        }}
                    />

                    <div className="pt-6 pb-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Resources
                    </div>

                    <SidebarItem
                        icon={<Plus size={20} />}
                        label="Register API"
                        onClick={() => {
                            onRegisterApi();
                            setSidebarOpen(false);
                        }}
                    />
                    <SidebarItem
                        icon={<Database size={20} />}
                        label="Register Database"
                        onClick={() => {
                            onRegisterDb();
                            setSidebarOpen(false);
                        }}
                    />
                </nav>

                <div className="p-4 border-t border-slate-800">
                    <SidebarItem
                        icon={<Settings size={20} />}
                        label="Settings"
                        isActive={activeTab === 'settings'}
                        onClick={() => {
                            setActiveTab('settings');
                            setSidebarOpen(false);
                        }}
                    />
                </div>
            </div>

            {/* Main Content */}
            <main className="flex-1 flex flex-col relative overflow-hidden bg-slate-950">
                {/* Header with hamburger menu */}
                <header className="h-14 border-b border-slate-800 flex items-center justify-between px-4 bg-slate-900/95 backdrop-blur-sm z-30 shrink-0">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setSidebarOpen(!sidebarOpen)}
                            className="p-2 hover:bg-slate-800 rounded-lg transition-colors md:hidden"
                            title="Toggle menu"
                        >
                            <Menu size={20} className="text-slate-400" />
                        </button>
                        <h2 className="text-lg font-semibold text-slate-100">
                            {activeTab === 'chat' ? 'Agentic Canvas' : activeTab === 'resources' ? 'My Resources' : activeTab === 'settings' ? 'Settings' : activeTab}
                        </h2>
                    </div>
                    <div className="flex items-center gap-3">
                        {headerContent}
                        <span className="hidden sm:flex text-xs text-green-400 bg-green-400/10 px-2 py-1 rounded-full border border-green-400/20">
                            Online
                        </span>
                    </div>
                </header>

                {/* Content Area - NO PADDING */}
                <div className="flex-1 overflow-hidden">
                    {children}
                </div>
            </main>
        </div>
    );
};

const SidebarItem = ({ icon, label, isActive, onClick }) => (
    <button
        onClick={onClick}
        className={cn(
            "w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-200 group relative",
            isActive
                ? "bg-indigo-600/10 text-indigo-400 border border-indigo-600/20"
                : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
        )}
    >
        <span className={cn("transition-colors shrink-0", isActive ? "text-indigo-400" : "text-slate-500 group-hover:text-slate-300")}>
            {icon}
        </span>
        <span className="font-medium text-sm">{label}</span>
        {isActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-indigo-500 rounded-r" />}
    </button>
);

export default Layout;
