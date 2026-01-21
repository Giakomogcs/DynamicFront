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
  const { toast } = useToast();
  
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
  
  // --- Canvas State ---
  const [canvasId, setCanvasId] = useState(null);
  const [canvasTitle, setCanvasTitle] = useState("New Analysis");
  const [activeWidgets, setActiveWidgets] = useState([]);
  const [messages, setMessages] = useState([]);
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
      toast({ title: "Error", description: msg, variant: "destructive" });
  };

  const refreshSession = async (sessId) => {
      try {
          const res = await fetch(`http://localhost:3000/api/sessions/${sessId}/structure`);
          if (!res.ok) throw new Error("Failed to load layout");
          const struct = await res.json();
          setSessionStructure(struct);
          return struct;
      } catch (e) {
          console.error("Refresh session failed", e);
      }
  };

  const loadCanvas = async (cId) => {
      setIsProcessing(true);
      try {
          const res = await fetch(`http://localhost:3000/api/canvases/${cId}`);
          if (!res.ok) throw new Error("Failed to load canvas");
          const data = await res.json();
          
          setCanvasId(data.id);
          setCanvasTitle(data.title);
          setActiveWidgets(data.widgets || []);
          setMessages(data.messages || []);
          setActiveSlug(data.slug);
          
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
      const struct = await refreshSession(id);
      
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
    setIsSaving(true); // Start saving indicator
    try {
        const payload = {
            title: overrideTitle || canvasTitle,
            widgets: activeWidgets,
            messages: messages, // Save chat history with canvas
            groupId: sessionId // Optional: only if session exists
        };
        const res = await fetch(`http://localhost:3000/api/canvases/${canvasId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        if (!res.ok) throw new Error("Failed to save");

        setLastSaved(new Date().toISOString());
        
        // Refresh sidebar structure in bg
        if (sessionId) refreshSession(sessionId);
        
        // Feedback
        // toast({ title: "Saved", description: "Canvas saved successfully.", variant: "success" }); 
        // Note: variant 'success' might not exist in default shadcn toast, usually default is fine or we rely on 'Save' icon change.
        // Let's just rely on the button state returning to normal + last saved time updating.
        
    } catch (e) {
        console.error("Save failed", e);
        toast({ title: "Save Failed", description: "Could not save changes.", variant: "destructive" });
    } finally {
        setIsSaving(false); // Stop indicator
    }
  };

  // --- Page Navigation (Client) ---
  // --- Page Navigation (Client) ---
  const handleNavigatePage = async (slug) => {
      // Auto-save current
      saveCanvas();
      
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
      
      // Save current before leaving? Maybe.
      // saveCanvas(); 
      
      await loadCanvas(prevId);
  };

  const handleCreateNewCanvas = async (sessId = sessionId) => {
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
  }, []);


  const handleSendMessage = async (text, isSystemHidden = false) => {
    // Abort logic ... (same as before)

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
                canvasContext: {
                    mode: 'intelligent',
                    widgets: activeWidgets,
                    activePageId: canvasId,
                    activeSlug: activeSlug, // Pass slug for Router
                    pageTitle: canvasTitle,
                    sessionId: sessionId // Pass session ID for Router context
                }
            })
        });

        const data = await response.json();
        
        if (!response.ok) throw new Error(data.error);

        // Add Bot Message
        setMessages(prev => [...prev, { role: 'model', text: data.text }]);

        // Handle Widgets
        if (data.widgets) {
            setActiveWidgets(data.widgets);
        }

        // Handle Navigation / Actions
        if (data.metadata?.action === 'navigate_canvas' && data.metadata.targetSlug) {
             console.log(`[Agent] Navigating to: ${data.metadata.targetSlug}`);
             // Refresh structure to ensure we see the new page
             const updatedStruct = await refreshSession(sessionId);
             const target = updatedStruct?.canvases?.find(c => c.slug === data.metadata.targetSlug);
             
             if (target) {
                 await loadCanvas(target.id);
             } else {
                 console.warn("Target page not found after create:", data.metadata.targetSlug);
             }
        }

        // Handle Navigation / Actions
        if (data.metadata?.action === 'navigate_canvas' && data.metadata.targetSlug) {
             console.log(`[Agent] Navigating to: ${data.metadata.targetSlug}`);
             // Refresh structure to ensure we see the new page
             const updatedStruct = await refreshSession(sessionId);
             const target = updatedStruct?.canvases?.find(c => c.slug === data.metadata.targetSlug);
             
             if (target) {
                 await loadCanvas(target.id);
                 // Toast or feedback?
             } else {
                 console.warn("Target page not found after create:", data.metadata.targetSlug);
             }
        }

        // Auto Save
        setTimeout(() => saveCanvas(), 500);

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
            // Pass Sidebar Content for Navigation
            sidebarContent={activeTab === 'project' && sessionStructure ? (
                <SidebarNavigation 
                    pages={sessionStructure.canvases || []}
                    activePageId={canvasId}
                    onNavigate={handleNavigatePage}
                    onCreatePage={() => handleCreateNewCanvas()}
                    onRenamePage={handleRenamePage}
                    onDeletePage={handleDeletePage}
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
                    <CanvasHeader 
                        title={canvasTitle} 
                        projectTitle={sessionStructure?.title || "Loading..."}
                        onTitleChange={(t) => { setCanvasTitle(t); saveCanvas(t); }} 
                        isSaving={isSaving || isProcessing}
                        onSave={() => saveCanvas()}
                        onNewChat={() => setMessages([])}
                        lastSavedAt={lastSaved}
                        chatCollapsed={chatCollapsed}
                        onToggleChat={() => setChatCollapsed(!chatCollapsed)}
                        canGoBack={historyStack.length > 0}
                        onBack={handleBack}
                    />
                    <Canvas 
                        widgets={activeWidgets}
                        loading={isProcessing}
                        canvasId={canvasId}
                        onAction={(action) => console.log(action)}
                    />

                    {/* Floating Chat Overlay */}
                    <div 
                        className={`fixed left-1/2 -translate-x-1/2 transition-all duration-300 ease-in-out z-50 flex flex-col shadow-2xl rounded-t-2xl border border-slate-700 bg-slate-900/95 backdrop-blur-md overflow-hidden
                            ${chatCollapsed 
                                ? 'bottom-0 w-[50px] h-[50px] rounded-full !border-slate-600 cursor-pointer hover:scale-110' 
                                : 'bottom-0 w-full max-w-3xl rounded-t-2xl'
                            }
                        `}
                        style={{ 
                            height: chatCollapsed ? '50px' : (isResizing ? '80vh' : (chatExpanded ? '80vh' : '50vh')),
                            maxHeight: chatCollapsed ? '50px' : (chatExpanded ? '90vh' : '50vh'),
                            minHeight: chatCollapsed ? '50px' : '50vh'
                        }}
                    >
                         {/* Chat Component */}
                         {chatCollapsed ? (
                            <button 
                                onClick={() => setChatCollapsed(false)}
                                className="w-full h-full flex items-center justify-center bg-indigo-600 text-white rounded-full shadow-lg"
                            >
                                <MessageSquareText size={24} />
                            </button>
                         ) : (
                            <Chat 
                                messages={messages}
                                onSendMessage={handleSendMessage}
                                isProcessing={isProcessing}
                                onStop={() => {}}
                                onToggleCollapse={() => setChatCollapsed(true)}
                                isFloating={true}
                                isExpanded={chatExpanded}
                                onExpand={() => setChatExpanded(!chatExpanded)}
                            />
                         )}
                    </div>
                </div>
            )}
            
            {activeTab === 'resources' && <ResourcesView />}

            {/* Settings & Modals ... */}
             {showSettings && (
                <div className="fixed inset-0 z-[60] flex justify-end">
                    <div className="absolute inset-0 bg-black/60" onClick={() => setShowSettings(false)} />
                    <div className="relative w-full max-w-2xl bg-slate-950 border-l border-slate-800 shadow-2xl h-full animate-in slide-in-from-right">
                        <SettingsView onClose={() => setShowSettings(false)} onSettingsChanged={() => {}} />
                    </div>
                </div>
            )}
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

