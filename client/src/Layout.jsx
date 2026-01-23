import React, { useState } from 'react';
import { Layers, Database, MessageSquareText, Plus, Settings2, Menu, X, ChevronLeft, ChevronRight, LayoutGrid, Cloud, CloudLightning, Shield } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs) {
    return twMerge(clsx(inputs));
}

const Layout = ({
    children,
    activeTab,
    setActiveTab,
    onRegisterApi,
    onRegisterDb,
    onOpenLoadModal,
    headerContent,
    onToggleSettings,
    sidebarContent,
    title,
    collapsed = false,
    onToggleCollapse,
    // Settings Drawer Props
    isSettingsOpen = false,
    onSettingsClose,

    settingsContent,
    showAdminLink = false
}) => {
    const [sidebarOpen, setSidebarOpen] = useState(false);

    return (
        <div className="flex h-screen bg-slate-950 text-slate-200 overflow-hidden font-sans relative">
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
                    "flex items-center border-b border-slate-800 h-14 transition-all duration-300",
                    collapsed ? "justify-center px-0" : "justify-between px-4"
                )}>
                    <div className="flex items-center gap-3 overflow-hidden ml-1">
                        {/* Toggle Button (Desktop) - Replaces logo based on Gemini style? Or keeps both? 
                            Let's keep the logo but maybe make it icon only when collapsed? 
                            Actually, Gemini puts the hamburger at the top left. 
                            Let's put the toggle button HERE.
                         */}
                        <button
                            onClick={onToggleCollapse}
                            className="hidden md:flex items-center justify-center p-2 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                        >
                            <Menu size={20} />
                        </button>

                        {/* Logo / Title */}
                        {!collapsed && (
                            <span className="font-bold text-xl tracking-tight text-white whitespace-nowrap animate-fade-in">
                                DynamicFront
                            </span>
                        )}
                    </div>

                    {/* Mobile close button */}
                    <button
                        onClick={() => setSidebarOpen(false)}
                        className="md:hidden p-1.5 hover:bg-slate-800 rounded-lg transition-colors"
                    >
                        <X size={20} className="text-slate-400" />
                    </button>
                </div>

                <nav className={cn(
                    "flex-1 overflow-x-hidden",
                    sidebarContent ? "overflow-y-hidden p-0" : "overflow-y-auto p-3 space-y-2"
                )}>
                    {/* CUSTOM SIDEBAR CONTENT (e.g. Session Nav) */}
                    {sidebarContent ? (
                        <>
                            {sidebarContent}
                            <div className="my-4 border-t border-slate-800" />
                        </>
                    ) : (
                        /* DEFAULT SIDEBAR: SHOWCASE / MAIN MENU */
                        <>

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
                            {showAdminLink && (
                                <SidebarItem
                                    icon={<Shield size={20} />} // Shield needs import
                                    label="Admin"
                                    isActive={activeTab === 'admin'}
                                    collapsed={collapsed}
                                    onClick={() => {
                                        setActiveTab('admin');
                                        setSidebarOpen(false);
                                    }}
                                />
                            )}
                        </>
                    )}

                    {/* ALWAYS SHOW RESOURCE REGISTRATION BUTTONS */}
                    <div className={cn(
                        sidebarContent ? "px-3 space-y-2" : "", // Add padding when after custom content
                        "flex flex-col"
                    )}>
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
                    </div>
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

                    {/* Collapse Toggle MOVED TO TOP */}
                </div>
            </div>

            {/* Settings Drawer Backdrop (z-40: Below Sidebar z-50, Above Content) */}
            {isSettingsOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
                    onClick={onSettingsClose}
                />
            )}

            {/* Settings Drawer (z-40: Sits on top of backdrop, appears as extension) */}
            <div className={cn(
                "fixed top-0 bottom-0 z-40 transition-all duration-300 ease-in-out bg-slate-900 border-r border-slate-800 shadow-2xl overflow-hidden",
                // Mobile: Full width or slideover. Desktop: Anchored to sidebar
                "w-full md:w-[600px]",
                // Position logic
                isSettingsOpen ? "translate-x-0 opacity-100" : "-translate-x-full opacity-0 pointer-events-none",
                // Left offset matches sidebar width on desktop
                collapsed ? "md:left-20" : "md:left-64",
                "left-0" // Mobile default
            )}>
                {settingsContent}
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
                            {title || (activeTab === 'chat' ? 'Agentic Canvas' : activeTab === 'resources' ? 'My Resources' : activeTab === 'companies' ? 'Minha Empresa' : activeTab === 'settings' ? 'Settings' : activeTab === 'showcase' ? 'Projects' : activeTab === 'admin' ? 'Admin Dashboard' : activeTab)}
                        </h2>
                    </div>
                    <div className="flex items-center gap-3">
                        {headerContent}

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
