import React, { useState } from 'react';
import { Layers, Database, MessageSquareText, Plus, Settings2, Menu, X, ChevronLeft, ChevronRight, LayoutGrid, Cloud, CloudLightning } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
    return twMerge(clsx(inputs));
}

const Layout = ({ children, activeTab, setActiveTab, onRegisterApi, onRegisterDb, onOpenLoadModal, headerContent, onToggleSettings, sidebarContent }) => {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [collapsed, setCollapsed] = useState(false);

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
                "bg-slate-900 border-r border-slate-800 flex flex-col transition-all duration-300 ease-in-out z-50",
                "fixed md:relative h-full",
                sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
                collapsed ? "md:w-20" : "md:w-64"
            )}>
                {/* Header with logo */}
                <div className={cn(
                    "flex items-center border-b border-slate-800 h-16 transition-all duration-300",
                    collapsed ? "justify-center px-0" : "justify-between px-4"
                )}>
                    <div className="flex items-center gap-3 overflow-hidden">
                        <div className="size-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shrink-0 shadow-lg shadow-indigo-500/20">
                            <Layers className="text-white size-6" />
                        </div>
                        <span className={cn(
                            "font-bold text-xl tracking-tight text-white whitespace-nowrap transition-all duration-300",
                            collapsed ? "opacity-0 w-0 translate-x-[-20px]" : "opacity-100 w-auto translate-x-0"
                        )}>
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

                <nav className="flex-1 p-3 space-y-2 overflow-y-auto overflow-x-hidden">
                    {/* CUSTOM SIDEBAR CONTENT (e.g. Session Nav) */}
                    {sidebarContent ? (
                        <>
                            {sidebarContent}
                            <div className="my-4 border-t border-slate-800" />
                            {/* Always show "Back to Projects" if we are in a sub-view? 
                                Actually SidebarNavigation handles "Back to Projects". 
                                So we might just render sidebarContent and that's it. 
                                But check if we need standard items below it.
                            */}
                        </>
                    ) : (
                        /* DEFAULT SIDEBAR: SHOWCASE / MAIN MENU */
                        <>
                            <SidebarItem
                                icon={<MessageSquareText size={20} />}
                                label="Chat Canvas"
                                isActive={activeTab === 'chat'}
                                collapsed={collapsed}
                                onClick={() => {
                                    setActiveTab('chat');
                                    setSidebarOpen(false);
                                }}
                            />
                            <SidebarItem
                                icon={<LayoutGrid size={20} />}
                                label="Projects"
                                isActive={activeTab === 'showcase'}
                                collapsed={collapsed}
                                onClick={() => {
                                    setActiveTab('showcase');
                                    setSidebarOpen(false);
                                }}
                            />
                            <SidebarItem
                                icon={<Database size={20} />}
                                label="My Resources"
                                isActive={activeTab === 'resources'}
                                collapsed={collapsed}
                                onClick={() => {
                                    setActiveTab('resources');
                                    setSidebarOpen(false);
                                }}
                            />
                            <SidebarItem
                                icon={<Cloud size={20} />}
                                label="Load Analysis"
                                collapsed={collapsed}
                                onClick={() => {
                                    onOpenLoadModal();
                                    setSidebarOpen(false);
                                }}
                            />

                            <div className={cn(
                                "pt-4 pb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider transition-all duration-300 whitespace-nowrap overflow-hidden",
                                collapsed ? "opacity-0 h-0 p-0" : "opacity-100 px-3"
                            )}>
                                Resources
                            </div>

                            <SidebarItem
                                icon={<CloudLightning size={20} />}
                                label="Register API"
                                collapsed={collapsed}
                                onClick={() => {
                                    onRegisterApi();
                                    setSidebarOpen(false);
                                }}
                            />
                            <SidebarItem
                                icon={<Plus size={20} />}
                                label="Register Database"
                                collapsed={collapsed}
                                onClick={() => {
                                    onRegisterDb();
                                    setSidebarOpen(false);
                                }}
                            />
                        </>
                    )}
                </nav>

                <div className="p-3 border-t border-slate-800 flex flex-col gap-2">
                    <SidebarItem
                        icon={<Settings2 size={20} />}
                        label="Settings"
                        collapsed={collapsed}
                        onClick={() => {
                            if (onToggleSettings) onToggleSettings();
                            setSidebarOpen(false);
                        }}
                    />

                    {/* Collapse Toggle (Desktop only) */}
                    <button
                        onClick={() => setCollapsed(!collapsed)}
                        className="hidden md:flex items-center justify-center p-2 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors mt-2"
                        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                    >
                        {collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
                    </button>
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
                <div className="flex-1 overflow-hidden flex flex-col">
                    {children}
                </div>
            </main>
        </div>
    );
};

const SidebarItem = ({ icon, label, isActive, collapsed, onClick }) => (
    <button
        onClick={onClick}
        className={cn(
            "w-full flex items-center transition-all duration-200 group relative rounded-xl",
            collapsed ? "justify-center p-3" : "px-3 py-3 gap-3",
            isActive
                ? "bg-indigo-600/10 text-indigo-400 border border-indigo-600/20"
                : "text-slate-400 hover:bg-slate-800 hover:text-slate-100 border border-transparent"
        )}
        title={collapsed ? label : undefined}
    >
        <span className={cn("transition-colors shrink-0", isActive ? "text-indigo-400" : "text-slate-500 group-hover:text-slate-300")}>
            {icon}
        </span>

        {!collapsed && (
            <span className="font-medium text-sm whitespace-nowrap overflow-hidden text-ellipsis animate-fade-in origin-left">
                {label}
            </span>
        )}

        {isActive && !collapsed && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-indigo-500 rounded-r shadow shadow-indigo-500/50" />}
        {isActive && collapsed && <div className="absolute inset-0 rounded-xl bg-indigo-500/10 ring-1 ring-indigo-500/20" />}
    </button>
);

export default Layout;
