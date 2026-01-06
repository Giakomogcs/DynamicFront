import React, { useState } from 'react';
import { Layers, Database, MessageSquare, Plus, Settings } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
    return twMerge(clsx(inputs));
}

const Layout = ({ children, activeTab, setActiveTab, onRegisterApi, onRegisterDb, onOpenLoadModal, headerContent }) => {

    return (
        <div className="flex h-screen bg-slate-950 text-slate-200 overflow-hidden font-sans">
            {/* Sidebar */}
            <div className="w-16 md:w-64 bg-slate-900 border-r border-slate-800 flex flex-col transition-all duration-300">
                <div className="p-4 flex items-center gap-3 border-b border-slate-800 h-16">
                    <div className="size-8 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0">
                        <Layers className="text-white size-5" />
                    </div>
                    <span className="font-bold text-lg hidden md:block tracking-tight text-white">DynamicFront</span>
                </div>

                <nav className="flex-1 p-3 space-y-2">
                    <SidebarItem
                        icon={<MessageSquare size={20} />}
                        label="Chat Canvas"
                        isActive={activeTab === 'chat'}
                        onClick={() => setActiveTab('chat')}
                    />
                    <SidebarItem
                        icon={<Database size={20} />}
                        label="My Resources"
                        isActive={activeTab === 'resources'}
                        onClick={() => setActiveTab('resources')}
                    />
                    <SidebarItem
                        icon={<Database size={20} />}
                        label="Load Analysis"
                        onClick={onOpenLoadModal}
                    />
                    <div className="pt-4 pb-2 px-3 text-xs font-semibold text-slate-500 hidden md:block uppercase tracking-wider">
                        Resources
                    </div>
                    <SidebarItem
                        icon={<Plus size={20} />}
                        label="Register API"
                        onClick={onRegisterApi}
                    />
                    <SidebarItem
                        icon={<Database size={20} />}
                        label="Register Database"
                        onClick={onRegisterDb}
                    />
                </nav>

                <div className="p-3 border-t border-slate-800">
                    <SidebarItem
                        icon={<Settings size={20} />}
                        label="Settings"
                        isActive={activeTab === 'settings'}
                        onClick={() => setActiveTab('settings')}
                    />
                </div>
            </div>

            {/* Main Content */}
            <main className="flex-1 flex flex-col relative overflow-hidden bg-slate-950">
                <header className="h-16 border-b border-slate-800 flex items-center justify-between px-6 bg-slate-900/50 backdrop-blur-sm z-10">
                    <h2 className="text-xl font-medium text-slate-100">
                        {activeTab === 'chat' ? 'Agentic Canvas' : activeTab}
                    </h2>
                    <div className="flex items-center gap-2">
                        {/* Dynamic Header Content (e.g. Model Selector) */}
                        {headerContent}
                        <span className="text-xs text-green-400 bg-green-400/10 px-2 py-1 rounded-full border border-green-400/20">
                            System Online
                        </span>
                    </div>
                </header>

                <div className="flex-1 overflow-auto p-0 scroll-smooth">
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
            "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group relative",
            isActive
                ? "bg-indigo-600/10 text-indigo-400 border border-indigo-600/20 shadow-sm shadow-indigo-900/20"
                : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
        )}
    >
        <span className={cn("transition-colors", isActive ? "text-indigo-400" : "text-slate-500 group-hover:text-slate-300")}>
            {icon}
        </span>
        <span className="hidden md:block font-medium text-sm whitespace-nowrap">{label}</span>
        {isActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-indigo-500 rounded-r shadow-[0_0_10px_rgba(99,102,241,0.5)]" />}
    </button>
);

export default Layout;
