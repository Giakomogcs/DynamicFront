import React, { useState, useEffect, useCallback } from 'react';
import Layout from './Layout';
import { ChatLayout } from './components/chat/ChatLayout'; // NEW
import { Canvas } from './components/Canvas';
import { MessageSquareText, Search, Plus, Save, AlertTriangle, Globe, Database } from 'lucide-react';

import { ResourcesView } from './components/ResourcesView';
import { SettingsView } from './components/SettingsView';
import { Modal, RegisterApiForm, RegisterDbForm } from './components/RegistrationModal';
import { ToastProvider, useToast } from './components/ui/Toast';

import { OnboardingWizard } from './components/OnboardingWizard';
import { ShowroomView } from './components/ShowroomView';
import { SidebarNavigation } from './components/SidebarNavigation';
import { Loader2 } from 'lucide-react';

function AppContent() {
    const { error, success, info } = useToast();

    // --- Global State ---
    const [activeTab, setActiveTab] = useState('showcase'); // 'showcase', 'project', 'resources'
    const [isProcessing, setIsProcessing] = useState(false);
    const [modalType, setModalType] = useState(null);
    const [showSettings, setShowSettings] = useState(false);
    const [location, setLocation] = useState(null);
    const [refreshResourcesTrigger, setRefreshResourcesTrigger] = useState(0);
    const [projectsSearchTerm, setProjectsSearchTerm] = useState('');
    const [refreshProjectsTrigger, setRefreshProjectsTrigger] = useState(0);
    const [showNewProjectModal, setShowNewProjectModal] = useState(false);
    const [newProjectData, setNewProjectData] = useState({ title: '', description: '' });
    const [onboardingDismissed, setOnboardingDismissed] = useState(false);


    // --- Onboarding State ---
    const [systemStatus, setSystemStatus] = useState(null); // { initialized, hasModels, hasResources }

    useEffect(() => {
        fetch('http://localhost:3000/api/system/status')
            .then(res => res.json())
            .then(data => setSystemStatus(data))
            .catch(err => {
                console.warn("[App] Failed to check system status, assuming initialized", err);
                setSystemStatus({ initialized: true, hasModels: true, hasResources: true });
            });
    }, [refreshResourcesTrigger]);


    // --- Session State ---
    const [sessionId, setSessionId] = useState(null);
    const [sessionStructure, setSessionStructure] = useState(null); // { canvases: [] }
    const [activeSlug, setActiveSlug] = useState(null);

    // --- Chat State (New) ---
    const [chats, setChats] = useState([]);
    const [activeChatId, setActiveChatId] = useState(null);

    // --- Canvas State ---
    const [canvasId, setCanvasId] = useState(null);
    const [canvasTitle, setCanvasTitle] = useState("New Analysis");
    const [activeWidgets, setActiveWidgets] = useState([]);
    const [messages, setMessages] = useState([]); // This now reflects CURRENT CHAT messages
    const [isSaving, setIsSaving] = useState(false);

    // --- Agent Mode State (New) ---
    const [agentMode, setAgentMode] = useState('fast'); // 'fast' | 'planning'


    const [lastSaved, setLastSaved] = useState(null);
    const [chatCollapsed, setChatCollapsed] = useState(false);
    const [chatExpanded, setChatExpanded] = useState(false); // For vertical expansion
    const [chatWidth, setChatWidth] = useState(400);
    const [isResizing, setIsResizing] = useState(false);

    // --- UI State ---
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [pageToDelete, setPageToDelete] = useState(null);
    const [chatToDelete, setChatToDelete] = useState(null); // New state for chat deletion modal // Lifted state for Delete Modal

    // --- History State ---
    const [historyStack, setHistoryStack] = useState([]); // Stack of canvas IDs

    // --- Handlers ---
    const handleError = (msg) => {
        console.error(msg);
        error(msg);
    };

    // --- Persistence (F5 Support) ---
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const urlProjectId = params.get('project');
        if (urlProjectId) {
            console.log("Restoring session from URL:", urlProjectId);
            // We need to restore the session
            // Note: We don't have the full session object here, but handleSelectSession fetches it.
            // We just need to make sure we don't duplicate logic.
            handleSelectSession(urlProjectId);
        }
    }, []); // Run ONCE on mount

    const refreshSession = async (sessId) => {
        try {
            const res = await fetch(`http://localhost:3000/api/sessions/${sessId}/structure`);
            if (!res.ok) throw new Error("Failed to load layout");
            const struct = await res.json();

            // STABLE SORT: Sort by ID to prevent jumping
            if (struct.canvases) {
                struct.canvases.sort((a, b) => a.id - b.id);
            }

            setSessionStructure(struct);

            // Also load chats
            loadChats(sessId);

            return struct;
        } catch (e) {
            console.error("Refresh session failed", e);
        }
    };

    const loadChats = async (sessId) => {
        try {
            const res = await fetch(`http://localhost:3000/api/sessions/${sessId}/chats`);
            if (!res.ok) return;
            const data = await res.json();
            setChats(data || []);
        } catch (e) {
            console.error("Failed to load chats", e);
        }
    };

    const loadChat = async (cId) => {
        if (!cId) return;
        setIsProcessing(true);
        try {
            const res = await fetch(`http://localhost:3000/api/chats/${cId}`);
            if (!res.ok) throw new Error("Failed to load chat");
            const data = await res.json();
            setMessages(data.messages || []);
            setActiveChatId(data.id);
        } catch (e) {
            handleError("Could not load chat");
        } finally {
            setIsProcessing(false);
        }
    };

    const loadCanvas = async (cId, preserveCurrentChat = true) => {
        setIsProcessing(true);
        try {
            const res = await fetch(`http://localhost:3000/api/canvases/${cId}`);
            if (!res.ok) throw new Error("Failed to load canvas");
            const data = await res.json();

            setCanvasId(data.id);
            setCanvasTitle(data.title);
            setActiveWidgets(data.widgets || []);
            setActiveSlug(data.slug);

            // Legacy support: If canvas has embedded messages and NO active chat, maybe show them?
            // But we are moving to strict separation.
            // If we are just navigating pages, we typically WANT to preserve the current chat context 
            // because the chat is "about" the session/exploration, not just this file.
            // So preserveCurrentChat defaults to true now.

            if (!preserveCurrentChat) {
                // If explicitly asked to clear/switch context (rare now with separate chats)
                // setMessages([]); 
            }

        } catch (e) {
            handleError("Could not load page");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleSelectSession = async (id) => {
        setSessionId(id);
        setActiveTab('project');
        setHistoryStack([]); // Clear history on project switch

        // Persist URL
        const newUrl = `${window.location.pathname}?project=${id}`;
        window.history.pushState({ path: newUrl }, '', newUrl);

        // Load Data
        const struct = await refreshSession(id);
        await loadChats(id);

        // Auto Open Chat (Last valid or create new)
        // For now, create a new chat or pick the latest?
        // Let's pick the latest chat if available, else new.
        // We need to fetch the list first... `refreshSession` triggers it but async.
        // Let's just trigger a fetch here to be sure for the selection logic.
        try {
            const chatsRes = await fetch(`http://localhost:3000/api/sessions/${id}/chats`);
            const chatList = await chatsRes.json();
            if (chatList && chatList.length > 0) {
                // Open most recent
                loadChat(chatList[0].id);
            } else {
                // Create Default Chat
                handleCreateNewChat(id);
            }
        } catch (e) {
            handleCreateNewChat(id);
        }

        // Auto load last active or home
        if (struct && struct.canvases && struct.canvases.length > 0) {
            const home = struct.canvases.find(c => c.isHome) || struct.canvases[0];
            loadCanvas(home.id);
        } else if (struct && (!struct.canvases || struct.canvases.length === 0)) {
            // Empty session? Create Home automatically
            console.log("Empty session detected. Auto-creating Home.");
            await handleCreateNewCanvas(id);
        }
    };

    const saveCanvas = async (overrideTitle = null) => {
        if (!canvasId) return;
        setIsSaving(true);
        try {
            const payload = {
                title: overrideTitle || canvasTitle,
                widgets: activeWidgets,
                // messages: messages, // REMOVED: Canvas no longer owns messages
                groupId: sessionId
            };
            const res = await fetch(`http://localhost:3000/api/canvases/${canvasId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            // ... strict save logic ...
            if (!res.ok) throw new Error("Failed to save");
            setLastSaved(new Date().toISOString());
            if (sessionId) refreshSession(sessionId);
        } catch (e) {
            console.error("Save failed", e);
            error("Could not save changes.");
        } finally {
            setIsSaving(false);
        }
    };

    // --- Page Navigation (Client) ---
    // --- Page Navigation (Client) ---
    const handleNavigatePage = async (slug) => {
        // Auto-save current
        await saveCanvas();

        const target = sessionStructure?.canvases?.find(c => c.slug === slug);
        if (target) {
            if (canvasId && canvasId !== target.id) {
                setHistoryStack(prev => [...prev, canvasId]);
            }
            await loadCanvas(target.id);
        }
    };

    const handleBack = async () => {
        if (historyStack.length === 0) return;

        const prevId = historyStack[historyStack.length - 1];
        setHistoryStack(prev => prev.slice(0, -1)); // Pop

        // Save current before leaving
        if (canvasId) await saveCanvas();

        await loadCanvas(prevId);
    };

    const handleCreateNewChat = async (sessId = sessionId) => {
        try {
            setIsProcessing(true);
            const res = await fetch('http://localhost:3000/api/chats', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: 'New Chat',
                    sessionId: sessId
                })
            });
            const newChat = await res.json();

            // Update List
            setChats(prev => [newChat, ...prev]);

            // Set Active
            setActiveChatId(newChat.id);
            setMessages([]); // Clear view

        } catch (e) {
            handleError("Failed to create chat");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleRenameChat = async (id, newTitle) => {
        try {
            await fetch(`http://localhost:3000/api/chats/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: newTitle })
            });
            setChats(prev => prev.map(c => c.id === id ? { ...c, title: newTitle } : c));
        } catch (e) {
            handleError("Rename chat failed");
        }
    };

    const handleDeleteChat = (id) => {
        // Find chat to show title or just pass ID
        const chat = chats.find(c => c.id === id);
        setChatToDelete(chat || { id, title: 'Untitled Chat' });
    };

    const confirmDeleteChat = async () => {
        if (!chatToDelete) return;
        const id = chatToDelete.id;
        try {
            await fetch(`http://localhost:3000/api/chats/${id}`, { method: 'DELETE' });
            setChats(prev => prev.filter(c => c.id !== id));
            if (activeChatId === id) {
                setActiveChatId(null);
                setMessages([]);
            }
            setChatToDelete(null);
        } catch (e) {
            handleError("Delete chat failed");
        }
    };

    const handleCreateNewCanvas = async (sessId = sessionId) => {
        // PERF: Auto-save current work before creating new
        if (canvasId) await saveCanvas();

        // Create via API directly
        try {
            setIsProcessing(true);
            const res = await fetch('http://localhost:3000/api/canvases', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: 'Untitled Page',
                    groupId: sessId,
                    widgets: [],
                    messages: [],
                    skipGeneration: true // Prevent auto-generated welcome widget delay
                })
            });
            const newCanvas = await res.json();

            // OPTIMISTIC UPDATE: Add to local state immediately so UI updates fast
            setSessionStructure(prev => {
                if (!prev) return prev;
                return {
                    ...prev,
                    canvases: [...(prev.canvases || []), newCanvas].sort((a, b) => a.id - b.id)
                };
            });

            // Return the new canvas so the UI can select/edit it
            return newCanvas;
        } catch (e) {
            handleError("Failed to create page");
            return null;
        } finally {
            setIsProcessing(false);
            // Background refresh to true-up everything
            refreshSession(sessId);
        }
    };

    const handleCreateProject = async () => {
        if (!newProjectData.title.trim()) return;

        try {
            const res = await fetch('http://localhost:3000/api/sessions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newProjectData)
            });

            if (res.ok) {
                const session = await res.json();
                // Close modal and refresh list
                setShowNewProjectModal(false);
                setNewProjectData({ title: '', description: '' });
                setRefreshProjectsTrigger(prev => prev + 1);
                // Optional: Open directly?
                // onSelectSession(session.id); 
            }
        } catch (e) {
            console.error(e);
            alert("Failed to create project");
        }
    };

    // ... registration handlers ... (omitted for brevity, assume unchanged or update if overlap)
    const handleRegisterApiSubmit = async (data) => {
        setIsProcessing(true);
        try {
            const res = await fetch('http://localhost:3000/api/tools/execute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: 'register_api',
                    args: data
                })
            });
            const result = await res.json();
            if (!res.ok) throw new Error(result.error || "Failed to register API");

            success("API registered successfully!");
            setModalType(null);
            setRefreshResourcesTrigger(prev => prev + 1);
        } catch (e) {
            handleError(e.message);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleRegisterDbSubmit = async (data) => {
        setIsProcessing(true);
        try {
            const res = await fetch('http://localhost:3000/api/tools/execute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: 'register_db',
                    args: data
                })
            });
            const result = await res.json();
            if (!res.ok) throw new Error(result.error || "Failed to register database");

            success("Database registered successfully!");
            setModalType(null);
            setRefreshResourcesTrigger(prev => prev + 1);
        } catch (e) {
            handleError(e.message);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleRenamePage = async (id, newTitle) => {
        // Optimistic Update
        setSessionStructure(prev => {
            if (!prev) return prev;
            return {
                ...prev,
                canvases: prev.canvases?.map(c =>
                    c.id === id ? { ...c, title: newTitle } : c
                ) || []
            };
        });
        if (id === canvasId) setCanvasTitle(newTitle);

        try {
            await fetch(`http://localhost:3000/api/canvases/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: newTitle })
            });
            // Background refresh to ensure consistency
            refreshSession(sessionId);
        } catch (e) {
            handleError("Rename failed");
            refreshSession(sessionId); // Revert on error
        }
    };

    const handleDeletePage = async (id) => {
        // No confirm here - the Modal handles the user interaction
        try {
            // Optimistic Removal
            setSessionStructure(prev => {
                if (!prev) return prev;
                return {
                    ...prev,
                    canvases: prev.canvases.filter(c => c.id !== id)
                };
            });

            await fetch(`http://localhost:3000/api/canvases/${id}`, { method: 'DELETE' });

            // If deleted current, go home or prev
            if (id === canvasId) {
                const remaining = sessionStructure?.canvases?.filter(c => c.id !== id) || [];
                if (remaining.length > 0) {
                    loadCanvas(remaining[0].id);
                }
            }

            await refreshSession(sessionId);
        } catch (e) {
            handleError("Delete failed");
            // Revert on error would be ideal, but for now just refresh
            refreshSession(sessionId);
        }
    };

    // --- Agent & Chat ---

    // Custom Model Selector (Keep existing logic simplified for brevity but functional)
    // ... (ModelSelector component logic reused from previous, but imported or inline)
    // For now let's use the basic state
    const [availableModels, setAvailableModels] = useState([]);
    const [selectedModel, setSelectedModel] = useState("gemini-2.0-flash");

    // Fetch models on load
    useEffect(() => {
        fetch('http://localhost:3000/api/models')
            .then(r => r.json())
            .then(d => setAvailableModels(d.models || []))
            .catch(e => console.error(e));

        // Fetch Location
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const loc = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                        // accuracy: position.coords.accuracy
                    };
                    console.log("Device Location obtained:", loc);
                    setLocation(loc);
                },
                (err) => {
                    console.warn("Location access denied or failed", err);
                }
            );
        }
    }, []);


    const handleStopGeneration = () => {
        setIsProcessing(false);
    };

    const handleEditMessage = (index) => {
        console.log("Edit requested at index:", index);
    };

    const handleSendMessage = async (text, isSystemHidden = false) => {
        // Construct the new history explicitly to ensure API gets the latest state
        // (State updates are async, so 'messages' would be stale if used directly)
        const newMessage = { role: 'user', text };
        const updatedHistory = [...messages, newMessage];

        if (!isSystemHidden) {
            setMessages(updatedHistory);
        }
        setIsProcessing(true);

        try {
            const response = await fetch('http://localhost:3000/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: text,
                    history: updatedHistory, // USE UPDATED HISTORY
                    location,
                    model: selectedModel,
                    sessionId,
                    chatId: activeChatId,
                    canvasContext: {
                        mode: 'intelligent',
                        widgets: activeWidgets,
                        activePageId: canvasId,
                        activeSlug: activeSlug,
                        pageTitle: canvasTitle,
                        sessionId: sessionId
                    }
                })
            });

            const data = await response.json();

            if (!response.ok) {
                // If backend sent a friendly text along with the error (e.g. Quota Exceeded), show it
                if (data.text) {
                    setMessages(prev => [...prev, { role: 'model', text: data.text }]);
                    // Don't throw if handled gracefully
                    return;
                }
                throw new Error(data.error || "Unknown Error");
            }

            // Add Bot Message
            setMessages(prev => [...prev, {
                role: 'model',
                text: data.text,
                thought: data.thought,
                toolCalls: data.toolCalls
            }]);

                // Reflexive update to chat list if we just got a real ID
                if (data.chatId && data.chatId !== activeChatId) {
                    setActiveChatId(data.chatId);
                    await loadChats(sessionId);
                }

                // Check if we need to auto-rename (First Message)
                // Use 'messages' from closure (state at start of function call)
                if (messages.length === 0) { 
                    const preview = text.substring(0, 21).trim();
                    if (preview) {
                        try {
                            // Update DB
                            await fetch(`http://localhost:3000/api/chats/${data.chatId}`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ title: preview })
                            });
                            
                            // Update Local State IMMEDIATELY
                            setChats(prev => prev.map(c => 
                                c.id === data.chatId 
                                    ? { ...c, title: preview } 
                                    : c
                            ));
                        } catch (e) {
                            console.error("Auto-rename failed", e);
                        }
                    }
                }

            // Handle Widgets - DEFER update if navigating
            let nextWidgets = data.widgets || [];

            // FALLBACK: Update Model if backend switched it (Context Preservation)
            if (data.usedModel && data.usedModel !== selectedModel) {
                console.log(`[App] 🔄 Backend switched model to: ${data.usedModel}`);
                setSelectedModel(data.usedModel);
                // Optional: Notify user?
                // success(`Switched to ${data.usedModel} for better performance`);
            }


            // Handle Navigation / Actions
            if (data.metadata?.action === 'navigate_canvas' && data.metadata.targetSlug) {
                console.log(`[Agent] Navigating to: ${data.metadata.targetSlug}`);

                // 1. Save CURRENT state (Old Page) *without* the new widgets
                // This ensures we don't accidentally overwrite the source page content with destination page content
                await saveCanvas();

                // 2. Refresh structure
                const updatedStruct = await refreshSession(sessionId);
                const target = updatedStruct?.canvases?.find(c => c.slug === data.metadata.targetSlug);

                if (target) {
                    // 3. Navigate & Load Target
                    // Preserve chat messages if it's a new page creation flow, so context isn't lost
                    const isNewlyCreated = data.metadata.isNewPage || false;
                    await loadCanvas(target.id, isNewlyCreated);

                    // 4. Apply Widgets to NEW Page (Target)
                    if (nextWidgets.length > 0) {
                        setActiveWidgets(nextWidgets);

                        // 5. Save NEW Page immediately with the new widgets
                        // We need to wait a tick for state to settle or pass explicitly? 
                        // React state batching might be tricky. 
                        // safer to call saveCanvas with explicit args OR rely on effect?
                        // Let's call a modified save helper or just wait.
                        // But we can't easily pass args to saveCanvas for state that isn't set yet.
                        // So we manually construct the payload for the immediate save.

                        // Actually, since we are inside an async function, setting state won't reflect efficiently in 'canvasId' or 'activeWidgets' immediately for the next line's execution context if we used `saveCanvas()` which reads state.

                        // Strategy: update local vars and force save via API directly or generic save wrapper
                        // Simplest: set state, then wait, then save.
                        // Or: create a specialized "saveTargetCanvas" function? 
                        // Let's rely on `useEffect` or just manual fetch for this critical edge case.

                        try {
                            await fetch(`http://localhost:3000/api/canvases/${target.id}`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    widgets: nextWidgets, // The new widgets
                                    // We might want to save messages too? If we preserved them?
                                    // If isNewlyCreated, we might have some messages in `messages` state?
                                    // But `loadCanvas` sets `messages`. 
                                    // If we want to persist the "Navigating..." message to the new page?
                                    // Maybe not necessary. Just widgets is key.
                                })
                            });
                            setLastSaved(new Date().toISOString());
                        } catch (err) {
                            console.error("Failed to save new page widgets", err);
                        }
                    }

                    info(`Página "${target.title}" carregada`);
                } else {
                    console.warn("Target page not found after create:", data.metadata.targetSlug);
                    error("Página criada mas não encontrada. Atualize a lista.");
                }
            } else {
                // Normal flow: Update current page
                if (nextWidgets.length > 0) {
                    setActiveWidgets(nextWidgets);
                }
                // Auto-save for normal updates
                setTimeout(() => saveCanvas(), 500);
            }

        } catch (e) {
            setMessages(prev => [...prev, { role: 'model', text: `Error: ${e.message}` }]);
        } finally {
            setIsProcessing(false);
        }
    };

    // --- Render ---

    if (!systemStatus) {
        return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><Loader2 className="animate-spin text-indigo-500" size={32} /></div>;
    }

    return (
        <>
            {/* ONBOARDING OVERLAY */}
            {!systemStatus.initialized && !onboardingDismissed && (
                <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center animate-in fade-in duration-500">
                    <div className="w-full max-w-4xl">
                        <OnboardingWizard
                            status={systemStatus}
                            onComplete={() => {
                                setSystemStatus(prev => ({ ...prev, initialized: true })); // Optimistic
                                setRefreshProjectsTrigger(prev => prev + 1);
                            }}
                            onSkip={() => setOnboardingDismissed(true)}
                            onOpenApiModal={() => setModalType('api')}
                            onOpenDbModal={() => setModalType('db')}
                            refreshTrigger={refreshResourcesTrigger}
                        />
                    </div>
                </div>
            )}



            <Layout
                activeTab={activeTab}
                setActiveTab={setActiveTab}

                onToggleSettings={() => setShowSettings(prev => !prev)}
                onRegisterApi={() => setModalType('api')}
                onRegisterDb={() => setModalType('db')}
                onOpenLoadModal={() => setModalType('load')}

                // Settings Drawer Props
                isSettingsOpen={showSettings}
                onSettingsClose={() => setShowSettings(false)}
                settingsContent={<SettingsView onClose={() => setShowSettings(false)} />}

                // Pass Sidebar Content for Navigation
                sidebarContent={activeTab === 'project' && sessionStructure ? (
                    <SidebarNavigation
                        pages={sessionStructure.canvases || []}
                        activePageId={canvasId}
                        collapsed={sidebarCollapsed}
                        onNavigate={handleNavigatePage}
                        onCreatePage={() => handleCreateNewCanvas()}
                        onRenamePage={handleRenamePage}
                        onDeletePage={(pageId) => handleDeletePage(pageId)}
                        onRequestDelete={(page) => {
                            console.log("Requesting delete for:", page);
                            setPageToDelete(page);
                        }}



                        onBackToHome={() => {
                            setActiveTab('showcase');
                            // Clear URL
                            window.history.pushState({}, '', window.location.pathname);
                        }}
                    />
                ) : null}
                title={activeTab === 'project' ? (sessionStructure?.title || 'Loading Project...') : undefined}
                collapsed={sidebarCollapsed}
                onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
                headerContent={
                    <div className="flex items-center gap-4">
                        {/* PROJECT CANVAS CONTROLS - Moved before chat */}
                        {activeTab === 'project' && (
                            <div className="flex items-center gap-2 bg-slate-800/50 p-1.5 rounded-lg border border-white/5">
                                <span className="text-xs font-semibold text-slate-400 px-2">Current Page</span>
                                <div className="h-4 w-px bg-white/10" />
                                <button
                                    onClick={() => saveCanvas()}
                                    disabled={isSaving}
                                    title="Save Project"
                                    className={`
                                    p-1.5 rounded-md transition-all flex items-center gap-2
                                    ${isSaving
                                            ? 'bg-amber-500/10 text-amber-500 cursor-wait'
                                            : 'hover:bg-indigo-500 hover:text-white text-slate-400'}\n                                `}
                                >
                                    <Save size={16} />
                                </button>
                            </div>
                        )}

                        {/* CHAT TOGGLE (when minimized in project view) - Moved after save */}
                        {activeTab === 'project' && chatCollapsed && (
                            <button
                                onClick={() => setChatCollapsed(false)}
                                className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-indigo-400 transition-colors"
                                title="Open Assistant"
                            >
                                <MessageSquareText size={18} />
                            </button>
                        )}
                        
                        {/* PROJECTS VIEW CONTROLS */}
                        {activeTab === 'showcase' && (
                            <>
                                <div className="relative group">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors" size={16} />
                                    <input
                                        type="text"
                                        placeholder="Search projects..."
                                        value={projectsSearchTerm}
                                        onChange={(e) => setProjectsSearchTerm(e.target.value)}
                                        className="pl-9 pr-4 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-200 focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none w-48 transition-all"
                                    />
                                </div>

                                <button
                                    onClick={() => setShowNewProjectModal(true)}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium shadow-lg shadow-indigo-500/20 transition-all hover:scale-105 active:scale-95"
                                >
                                    <Plus size={16} />
                                    <span>New Project</span>
                                </button>
                            </>
                        )}

                        {/* RESOURCES VIEW CONTROLS */}
                        {activeTab === 'resources' && (
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => setModalType('api')}
                                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                                >
                                    <Globe size={16} /> Add API
                                </button>
                                <button
                                    onClick={() => setModalType('db')}
                                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                                >
                                    <Database size={16} /> Add Database
                                </button>
                            </div>
                        )}
                    </div>
                }
            >
                {/* ACTIVE TAB CONTENT */}
                {
                    activeTab === 'showcase' && (
                        <ShowroomView
                            searchTerm={projectsSearchTerm}
                            refreshTrigger={refreshProjectsTrigger}
                            onSelectSession={handleSelectSession}
                            onCreateProject={() => setShowNewProjectModal(true)}
                        />
                    )
                }
                {
                    activeTab === 'project' && (
                        <div className="flex h-full w-full relative">
                            {/* Canvas Area */}
                            <div className="flex-1 h-full min-w-0 flex flex-col relative overflow-hidden">
                                <Canvas
                                    key={canvasId} // Key ensures remount on swap
                                    canvasId={canvasId}
                                    title={canvasTitle}
                                    widgets={activeWidgets}
                                    messages={messages}
                                    isProcessing={isProcessing}
                                    onSendMessage={handleSendMessage}
                                    onStopGeneration={handleStopGeneration}
                                    onWidgetChange={setActiveWidgets}
                                    activeChatId={activeChatId}
                                />
                            </div>

                            {/* Chat - Integrated to push content */}
                            {!chatCollapsed && sessionId && (
                                <ChatLayout
                                    chats={chats}
                                    activeChatId={activeChatId}
                                    messages={messages}
                                    agentMode={agentMode}
                                    setAgentMode={setAgentMode}
                                    selectedModel={selectedModel}
                                    setSelectedModel={setSelectedModel}
                                    availableModels={availableModels}
                                    onSendMessage={handleSendMessage}
                                    onNewChat={() => handleCreateNewChat()}
                                    onNavigateChat={(id) => loadChat(id)}
                                    onDeleteChat={handleDeleteChat}
                                    onRenameChat={handleRenameChat}
                                    isProcessing={isProcessing}
                                    onStop={handleStopGeneration}
                                    isCollapsed={chatCollapsed}
                                    onCollapseChange={(collapsed) => setChatCollapsed(collapsed)}
                                />
                            )}


                        </div>
                    )
                }
                {
                    activeTab === 'resources' && (
                        <ResourcesView refreshTrigger={refreshResourcesTrigger} />
                    )
                }

            </Layout >



            {/* GLOBAL MODALS */}

            {/* DELETE PAGE MODAL */}
            {
                pageToDelete && (
                    <Modal
                        isOpen={!!pageToDelete}
                        onClose={() => setPageToDelete(null)}
                        title="Delete Page"
                    >
                        <div className="flex flex-col items-center text-center p-2 mb-6">
                            <div className="size-12 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
                                <AlertTriangle className="text-red-500" size={24} />
                            </div>
                            <h3 className="text-lg font-bold text-white mb-2">Confirm Deletion</h3>
                            <p className="text-slate-400 text-sm">
                                Are you sure you want to delete <span className="text-white font-medium">"{pageToDelete.title}"</span>?
                                <br />This action cannot be undone.
                            </p>
                        </div>

                        <div className="flex w-full gap-3">
                            <button
                                onClick={() => setPageToDelete(null)}
                                className="flex-1 px-4 py-2 rounded-xl text-slate-300 hover:bg-slate-800 transition-colors font-medium text-sm border border-slate-700 hover:text-white"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    handleDeletePage(pageToDelete.id);
                                    setPageToDelete(null);
                                }}
                                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl font-medium shadow-lg shadow-red-500/20 transition-all text-sm"
                            >
                                Delete Page
                            </button>
                        </div>
                    </Modal>
                )
            }

            {/* NEW PROJECT MODAL */}
            {
                showNewProjectModal && (
                    <Modal
                        isOpen={showNewProjectModal}
                        onClose={() => setShowNewProjectModal(false)}
                        title="Create New Project"
                    >
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Project Name</label>
                                <input
                                    type="text"
                                    autoFocus
                                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white focus:ring-2 focus:ring-indigo-500/50 outline-none"
                                    value={newProjectData.title}
                                    onChange={e => setNewProjectData(prev => ({ ...prev, title: e.target.value }))}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1">Description</label>
                                <textarea
                                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-white focus:ring-2 focus:ring-indigo-500/50 outline-none h-24 resize-none"
                                    value={newProjectData.description}
                                    onChange={e => setNewProjectData(prev => ({ ...prev, description: e.target.value }))}
                                />
                            </div>
                            <div className="flex justify-end gap-3 pt-4">
                                <button
                                    onClick={() => setShowNewProjectModal(false)}
                                    className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleCreateProject}
                                    disabled={!newProjectData.title.trim()}
                                    className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Create Project
                                </button>
                            </div>
                        </div>
                    </Modal>
                )
            }

            {/* API REGISTRATION MODAL */}
            {
                modalType === 'api' && (
                    <Modal
                        isOpen={modalType === 'api'}
                        onClose={() => setModalType(null)}
                        title="Register New API"
                    >
                        <RegisterApiForm
                            onSubmit={handleRegisterApiSubmit}
                            isProcessing={isProcessing}
                            onCancel={() => setModalType(null)}
                        />
                    </Modal>
                )
            }

            {/* DATABASE REGISTRATION MODAL */}
            {
                modalType === 'db' && (
                    <Modal
                        isOpen={modalType === 'db'}
                        onClose={() => setModalType(null)}
                        title="Register New Database"
                    >
                        <RegisterDbForm
                            onSubmit={handleRegisterDbSubmit}
                            isProcessing={isProcessing}
                            onCancel={() => setModalType(null)}
                        />
                    </Modal>
                )
            }


            {/* DELETE PAGE MODAL */}
            {pageToDelete && (
                <Modal
                    isOpen={!!pageToDelete}
                    onClose={() => setPageToDelete(null)}
                    title="Delete Page?"
                >
                    <div className="space-y-4">
                        <p className="text-slate-300 text-sm">
                            Are you sure you want to delete <strong>{pageToDelete.title}</strong>? This action cannot be undone.
                        </p>
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => setPageToDelete(null)}
                                className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleDeletePage(pageToDelete.id).then(() => setPageToDelete(null))}
                                className="px-4 py-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors border border-red-500/20"
                            >
                                Delete Page
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* DELETE CHAT MODAL */}
            {chatToDelete && (
                <Modal
                    isOpen={!!chatToDelete}
                    onClose={() => setChatToDelete(null)}
                    title="Delete Chat?"
                >
                    <div className="space-y-4">
                        <p className="text-slate-300 text-sm">
                            Are you sure you want to delete <strong>{chatToDelete.title}</strong>? This action cannot be undone.
                        </p>
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => setChatToDelete(null)}
                                className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmDeleteChat}
                                className="px-4 py-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors border border-red-500/20"
                            >
                                Delete Chat
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

        </>
    );
}

// Wrapper for Toast Provider
function App() {
    return (
        <ToastProvider>
            <AppContent />
        </ToastProvider>
    );
}

export default App;

