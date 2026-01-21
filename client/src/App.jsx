import React, { useState, useEffect, useCallback } from 'react';
import Layout from './Layout';
import { Chat } from './components/Chat';
import { MessageSquareText } from 'lucide-react';
import { ResourcesView } from './components/ResourcesView';
import { SettingsView } from './components/SettingsView';
import { Modal, RegisterApiForm, RegisterDbForm } from './components/RegistrationModal';
import { ToastProvider, useToast } from './components/ui/Toast';

import { Canvas } from './components/Canvas';
import { CanvasHeader } from './components/CanvasHeader';
import { ShowroomView } from './components/ShowroomView';
import { SidebarNavigation } from './components/SidebarNavigation';

function AppContent() {
    const { error, success, info } = useToast();

    // --- Global State ---
    const [activeTab, setActiveTab] = useState('showcase'); // 'showcase', 'project', 'resources'
    const [isProcessing, setIsProcessing] = useState(false);
    const [modalType, setModalType] = useState(null);
    const [showSettings, setShowSettings] = useState(false);
    const [location, setLocation] = useState(null);

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

    const [lastSaved, setLastSaved] = useState(null);
    const [chatCollapsed, setChatCollapsed] = useState(false);
    const [chatExpanded, setChatExpanded] = useState(false); // For vertical expansion
    const [chatWidth, setChatWidth] = useState(400);
    const [isResizing, setIsResizing] = useState(false);
    // --- History State ---
    const [historyStack, setHistoryStack] = useState([]); // Stack of canvas IDs

    // --- Handlers ---
    const handleError = (msg) => {
        console.error(msg);
        error(msg);
    };

    const refreshSession = async (sessId) => {
        try {
            const res = await fetch(`http://localhost:3000/api/sessions/${sessId}/structure`);
            if (!res.ok) throw new Error("Failed to load layout");
            const struct = await res.json();
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

    const handleDeleteChat = async (id) => {
        if (!confirm("Delete this chat?")) return;
        try {
            await fetch(`http://localhost:3000/api/chats/${id}`, { method: 'DELETE' });
            setChats(prev => prev.filter(c => c.id !== id));
            if (activeChatId === id) {
                setActiveChatId(null);
                setMessages([]);
            }
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
                    title: 'New Page',
                    groupId: sessId,
                    widgets: [],
                    messages: []
                })
            });
            const newCanvas = await res.json();

            // Reload session structure
            await refreshSession(sessId);
            // Load new canvas
            await loadCanvas(newCanvas.id);
        } catch (e) {
            handleError("Failed to create page");
        } finally {
            setIsProcessing(false);
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
        } catch (e) {
            handleError(e.message);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleRenamePage = async (id, newTitle) => {
        try {
            await fetch(`http://localhost:3000/api/canvases/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: newTitle })
            });
            if (id === canvasId) setCanvasTitle(newTitle);
            refreshSession(sessionId);
        } catch (e) {
            handleError("Rename failed");
        }
    };

    const handleDeletePage = async (id) => {
        if (!confirm("Delete this page?")) return;
        try {
            await fetch(`http://localhost:3000/api/canvases/${id}`, { method: 'DELETE' });
            const updated = await refreshSession(sessionId);
            // If deleted current, go home
            if (id === canvasId && updated?.canvases?.length > 0) {
                loadCanvas(updated.canvases[0].id);
            }
        } catch (e) {
            handleError("Delete failed");
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
        if (!isSystemHidden) {
            setMessages(prev => [...prev, { role: 'user', text }]);
        }
        setIsProcessing(true);

        try {
            const response = await fetch('http://localhost:3000/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: text,
                    history: messages,
                    location,
                    model: selectedModel,
                    sessionId,
                    chatId: activeChatId, // VITAL: Send Chat ID
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

            if (!response.ok) throw new Error(data.error);

            // Add Bot Message
            setMessages(prev => [...prev, { role: 'model', text: data.text }]);

            // If implicit creation happened, update ID
            if (data.chatId && data.chatId !== activeChatId) {
                setActiveChatId(data.chatId);
                // Refresh list to show new chat
                loadChats(sessionId);
            }

            // Handle Widgets - DEFER update if navigating
            let nextWidgets = data.widgets || [];


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

    return (
        <Layout
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            onToggleSettings={() => setShowSettings(true)}
            onRegisterApi={() => setModalType('api')}
            onRegisterDb={() => setModalType('db')}
            onOpenLoadModal={() => setModalType('load')}
            // Pass Sidebar Content for Navigation
            sidebarContent={activeTab === 'project' && sessionStructure ? (
                <SidebarNavigation
                    pages={sessionStructure.canvases || []}
                    activePageId={canvasId}
                    onNavigate={handleNavigatePage}
                    onCreatePage={() => handleCreateNewCanvas()}
                    onRenamePage={handleRenamePage}
                    onDeletePage={handleDeletePage}

                    // Chat Props
                    chats={chats}
                    activeChatId={activeChatId}
                    onSelectChat={(id) => loadChat(id)}
                    onCreateChat={() => handleCreateNewChat()}
                    onRenameChat={handleRenameChat}
                    onDeleteChat={handleDeleteChat}

                    onBackToHome={() => setActiveTab('showcase')}
                />
            ) : null}
        >
            {activeTab === 'showcase' && (
                <ShowroomView
                    onSelectSession={handleSelectSession}
                    onCreateSession={(id) => handleSelectSession(id)}
                />
            )}

            {activeTab === 'project' && (
                <div className="flex-1 flex flex-col min-w-0 relative h-full">
                    {/* 1. Top Header */}
                    <CanvasHeader
                        title={canvasTitle}
                        projectTitle={sessionStructure?.title || "Project"}
                        onTitleChange={(t) => { setCanvasTitle(t); saveCanvas(t); }}
                        isSaving={isSaving || isProcessing}
                        onSave={() => saveCanvas()}
                        lastSavedAt={lastSaved}
                        canGoBack={false}
                        onBack={() => { }}
                    />

                    {/* 2. Horizontal Container (Canvas + Sidebar) */}
                    <div className="flex-1 flex flex-row relative overflow-hidden bg-slate-950">

                        {/* 2a. Main Canvas Area (Takes remaining width) */}
                        <div className="flex-1 relative h-full min-w-0">
                            <Canvas
                                widgets={activeWidgets}
                                loading={isProcessing}
                                canvasId={canvasId}
                                onAction={(action) => console.log(action)}
                            />

                            {/* Floating Trigger (When Collapsed) */}
                            {chatCollapsed && (
                                <div className="absolute bottom-6 right-6 z-50 animate-bounce-in pointer-events-auto">
                                    <button
                                        onClick={() => setChatCollapsed(false)}
                                        className="bg-indigo-600 hover:bg-indigo-500 text-white p-4 rounded-full shadow-2xl transition-transform hover:scale-110 flex items-center justify-center transform active:scale-95"
                                        title="Open Chat"
                                    >
                                        <span className="sr-only">Open Chat</span>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2-2z" /></svg>
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* 2b. Chat Sidebar (Animated Width) */}
                        <div
                            className={`border-l border-slate-800 bg-slate-900/40 backdrop-blur-sm transition-all duration-300 ease-in-out flex flex-col z-20 h-full ${chatCollapsed ? 'w-0 opacity-0 overflow-hidden' : 'w-[450px] opacity-100'
                                }`}
                        >
                            <Chat
                                messages={messages}
                                onSendMessage={handleSendMessage}
                                isProcessing={isProcessing}
                                onStop={handleStopGeneration}

                                // Centralized Control Props
                                collapsed={false}
                                onToggleCollapse={() => setChatCollapsed(!chatCollapsed)}

                                // Management
                                chats={chats} // Pass actual chats
                                activeChatId={activeChatId}
                                onNavigateChat={(id) => loadChat(id)} // Maps to onSelectChat basically
                                onNewChat={handleCreateNewChat}
                                onEditMessage={handleEditMessage}
                            />
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'resources' && <ResourcesView />}

            {/* Settings & Modals ... */}
            {showSettings && (
                <div className="fixed inset-0 z-[60] flex justify-end">
                    <div className="absolute inset-0 bg-black/60" onClick={() => setShowSettings(false)} />
                    <div className="relative w-full max-w-2xl bg-slate-950 border-l border-slate-800 shadow-2xl h-full animate-in slide-in-from-right">
                        <SettingsView onClose={() => setShowSettings(false)} onSettingsChanged={() => { }} />
                    </div>
                </div>
            )}

            <Modal
                isOpen={modalType === 'api'}
                onClose={() => setModalType(null)}
                title="Register New API"
            >
                <RegisterApiForm onSubmit={handleRegisterApiSubmit} isLoading={isProcessing} />
            </Modal>

            <Modal
                isOpen={modalType === 'db'}
                onClose={() => setModalType(null)}
                title="Register New Database"
            >
                <RegisterDbForm onSubmit={handleRegisterDbSubmit} isLoading={isProcessing} />
            </Modal>
        </Layout>
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

