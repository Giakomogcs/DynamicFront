import React, { useState, useEffect } from 'react';
import Layout from './Layout';
import { Chat } from './components/Chat';
import { ResourcesView } from './components/ResourcesView';
import { SettingsView } from './components/SettingsView';
import { Modal, RegisterApiForm, RegisterDbForm } from './components/RegistrationModal';

import { Canvas } from './components/Canvas';
import { CanvasHeader } from './components/CanvasHeader';


function App() {
  const [messages, setMessages] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [modalType, setModalType] = useState(null); // 'api' | 'db' | null
  const [activeTab, setActiveTab] = useState('chat');
  const [location, setLocation] = useState(null);

  // New State: Active Widgets for Canvas and Layout Mode
  const [activeWidgets, setActiveWidgets] = useState([]);
  const [layoutMode, setLayoutMode] = useState('center'); // 'center' | 'workspace'

  // Canvas State
  const [canvasId, setCanvasId] = useState(null);
  const [canvasTitle, setCanvasTitle] = useState("New Analysis");
  const [lastSaved, setLastSaved] = useState(null);
  const [savedCanvases, setSavedCanvases] = useState([]);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [canvasMode, setCanvasMode] = useState('append'); // 'append' | 'replace'
  const [chatCollapsed, setChatCollapsed] = useState(false);


  // Get User Location on Mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
        (err) => console.log("Geolocation denied or error:", err)
      );
    }
  }, []);

  // Fetch Saved Canvases on Mount
  useEffect(() => {
    fetchCanvases();
  }, []);

  const fetchCanvases = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/canvases');
      const data = await res.json();
      setSavedCanvases(data);
    } catch (e) {
      console.error("Failed to load canvases", e);
    }
  };

  const saveCanvas = async (curTitle, curWidgets, curMessages) => {
    setIsProcessing(true);
    try {
      const payload = {
        title: curTitle !== undefined ? curTitle : canvasTitle,
        widgets: curWidgets !== undefined ? curWidgets : activeWidgets,
        messages: curMessages !== undefined ? curMessages : messages
      };

      let url = 'http://localhost:3000/api/canvases';
      let method = 'POST';

      if (canvasId) {
        url = `http://localhost:3000/api/canvases/${canvasId}`;
        method = 'PUT';
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      setCanvasId(data.id);
      setCanvasTitle(data.title);
      setLastSaved(data.updatedAt);
      fetchCanvases(); // Refresh list
    } catch (e) {
      console.error("Save failed", e);
      alert("Failed to save canvas");
    } finally {
      setIsProcessing(false);
    }
  };

  const loadCanvas = async (id) => {
    setIsProcessing(true);
    try {
      const res = await fetch(`http://localhost:3000/api/canvases/${id}`);
      const data = await res.json();
      setCanvasId(data.id);
      setCanvasTitle(data.title);
      setActiveWidgets(data.widgets || []);
      setMessages(data.messages || []); // Load saved messages
      setLastSaved(data.updatedAt);
      setLayoutMode('workspace');
      setShowLoadModal(false);
    } catch (e) {
      console.error("Load failed", e);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleNewChat = () => {
    setMessages([]); // Clear chat
    // Keep canvas widgets? User said "abrir outro chat em cima desse canvas"
    // So yes, we keep widgets and canvasId.
    setMessages([{ role: 'model', text: "Started a new chat session on this canvas." }]);
  };

  const handleCreateNewCanvas = () => {
    setCanvasId(null);
    setCanvasTitle("New Analysis");
    setActiveWidgets([]);
    setMessages([]);
    setLayoutMode('center');
    setLastSaved(null);
    setShowLoadModal(false);
  };

  const handleDeleteCanvas = async (id, title) => {
    if (!confirm(`Tem certeza que deseja deletar o canvas "${title}"?`)) {
      return;
    }

    try {
      const res = await fetch(`http://localhost:3000/api/canvases/${id}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        // If deleting current canvas, reset to new canvas
        if (canvasId === id) {
          handleCreateNewCanvas();
        }
        // Refresh canvas list
        fetchCanvases();
      } else {
        alert('Falha ao deletar canvas');
      }
    } catch (e) {
      console.error("Delete failed", e);
      alert('Erro ao deletar canvas');
    }
  };


  // Fetch Models & Settings
  const [availableModels, setAvailableModels] = useState([]);
  const [enabledModels, setEnabledModels] = useState(null); // null = load yet
  const [selectedModel, setSelectedModel] = useState("");

  useEffect(() => {
    // Parallel fetch
    Promise.all([
      fetch('http://localhost:3000/api/models').then(r => r.json()),
      fetch('http://localhost:3000/api/settings').then(r => r.json())
    ]).then(([modelsData, settingsData]) => {
      const models = Array.isArray(modelsData) ? modelsData : (modelsData.models || []);
      const defaultModel = modelsData.defaultModel;

      let enabled = [];
      if (settingsData.enabledModels) {
        enabled = settingsData.enabledModels;
      } else {
        // Default all enabled
        enabled = models.map(m => m.name);
      }

      setEnabledModels(enabled);
      setAvailableModels(models);

      // Determine selection
      // Filter first
      const visibleModels = models.filter(m => enabled.includes(m.name));

      if (defaultModel && visibleModels.find(m => m.name === defaultModel)) {
        setSelectedModel(defaultModel);
      } else if (visibleModels.length > 0) {
        setSelectedModel(visibleModels[0].name);
      } else if (models.length > 0) {
        // Fallback if user disabled everything (shouldn't happen ideally)
        setSelectedModel(models[0].name);
      }
    }).catch(err => console.error("Failed to fetch initial data", err));

    // Debug log
    console.log("[App] Mounted / Initial Fetch");

    return () => console.log("[App] Unmounted");
  }, []); // Run on mount

  // Computed visible models
  const visibleModels = availableModels.filter(m => !enabledModels || enabledModels.includes(m.name));

  const abortControllerRef = React.useRef(null);

  const handleSendMessage = async (text) => {
    // Switch to workspace mode on first message
    if (layoutMode === 'center') setLayoutMode('workspace');

    // Cancel any ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new controller
    const controller = new AbortController();
    abortControllerRef.current = controller;

    // 1. Add User Message
    const userMsg = { role: 'user', text };
    setMessages(prev => [...prev, userMsg]);
    setIsProcessing(true);

    try {
      // 2. Call Backend API
      // Build canvas context for incremental mode
      const canvasContext = canvasMode === 'append' && canvasId ? {
        mode: canvasMode,
        widgets: activeWidgets,
        messages: messages
      } : null;

      const response = await fetch('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: messages,
          location, // Send location context
          model: selectedModel,
          canvasContext // Send canvas context for incremental mode
        }),
        signal: controller.signal
      });

      const data = await response.json();
      console.log("Backend Response:", data); // DEBUG LOG


      if (!response.ok) throw new Error(data.error || 'Failed to get response');

      // 3. Add Bot Message
      const botMsg = {
        role: 'model',
        text: data.text,
        widgets: data.widgets || []
      };
      setMessages(prev => [...prev, botMsg]);

      // 4. Update Canvas with new widgets
      if (data.widgets && data.widgets.length > 0) {
        if (canvasMode === 'append') {
          // Append mode: add new widgets to existing ones
          setActiveWidgets(prev => [...prev, ...data.widgets]);
        } else {
          // Replace mode: replace all widgets
          setActiveWidgets(data.widgets);
        }
      }

      // Auto-save after successful response
      if (canvasId) {
        setTimeout(() => saveCanvas(), 1000);
      }

    } catch (error) {
      if (error.name === 'AbortError') {
        console.log("Generation stopped by user");
        setMessages(prev => [...prev, { role: 'model', text: "🛑 Generation stopped." }]);
      } else {
        console.error(error);
        setMessages(prev => [...prev, { role: 'model', text: `Error: ${error.message}` }]);
      }
    } finally {
      setIsProcessing(false);
      abortControllerRef.current = null;
    }
  };

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsProcessing(false);
    }
  };

  const handleEditMessage = (index) => {
    // Remove the message at index and all subsequent messages
    setMessages(prev => prev.slice(0, index));
  };

  // --- Resource Management (Create / Update) ---
  const [editingResource, setEditingResource] = useState(null); // { type: 'api'|'db', data: ... }
  const [resourcesVersion, setResourcesVersion] = useState(0);

  const handleRegister = React.useCallback(async (type, formData) => {
    setIsProcessing(true);
    try {
      // Determine if Create or Update
      if (editingResource) {
        // UPDATE
        const url = `http://localhost:3000/api/resources/${editingResource.type}/${editingResource.data.idString}`;
        const res = await fetch(url, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Update failed");
        }
        setMessages(prev => [...prev, { role: 'model', text: `Updated resource '${formData.name}' successfully.` }]);
      } else {
        // CREATE
        const endpoint = type === 'api' ? 'register_api' : 'register_db';
        const response = await fetch('http://localhost:3000/api/tools/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: endpoint,
            args: formData
          })
        });

        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        setMessages(prev => [...prev, { role: 'model', text: result.content?.[0]?.text || "Registration successful." }]);
      }

      setModalType(null);
      setEditingResource(null); // Clear edit state
      setResourcesVersion(v => v + 1); // Trigger refresh of ResourcesView

    } catch (e) {
      alert(e.message);
    } finally {
      setIsProcessing(false);
    }
  }, [editingResource]); // Depends on editingResource

  const handleEditResource = React.useCallback((type, data) => {
    setEditingResource({ type, data });
    setModalType(type); // Re-use the same modal
  }, []);

  // Close modal cleanup
  const closeModal = React.useCallback(() => {
    setModalType(null);
    setEditingResource(null);
  }, []);

  // --- Custom Model Selector Component ---
  const ModelSelector = ({ models, selected, onSelect }) => {
    const [isOpen, setIsOpen] = useState(false);
    const selectedModelObj = models.find(m => m.name === selected) || { displayName: 'Select Model', name: '' };

    return (
      <div className="relative z-50">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors text-sm font-medium text-slate-200"
        >
          <span className="text-indigo-400">✨</span>
          <span>{selectedModelObj.displayName?.replace('models/', '') || selected?.replace('models/', '') || 'Loading...'}</span>
          <span className="text-slate-500 text-xs">▼</span>
        </button>

        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            <div className="absolute top-full left-0 mt-2 w-64 max-h-80 overflow-y-auto bg-slate-900 border border-slate-700 rounded-xl shadow-xl shadow-black/50 z-50 p-1">
              <div className="px-3 py-2 text-xs font-bold text-slate-500 uppercase tracking-wider">Available Models</div>
              {models.map(m => (
                <button
                  key={m.name}
                  onClick={() => { onSelect(m.name); setIsOpen(false); }}
                  className={`
                    w-full text-left px-3 py-2 rounded-lg text-sm mb-1 flex flex-col
                    ${selected === m.name ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30' : 'text-slate-300 hover:bg-slate-800'}
                  `}
                >
                  <span className="font-medium">{m.displayName?.replace('models/', '')}</span>
                  <span className="text-[10px] text-slate-500 truncate">{m.name}</span>
                </button>
              ))}
              {models.length === 0 && <div className="p-3 text-slate-500 text-xs text-center">Loading models...</div>}
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <Layout
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      onRegisterApi={() => setModalType('api')}
      onRegisterDb={() => setModalType('db')}
      onOpenLoadModal={() => setShowLoadModal(true)}
      headerContent={
        <ModelSelector
          models={visibleModels}
          selected={selectedModel}
          onSelect={setSelectedModel}
        />
      }
    >
      {activeTab === 'chat' && (
        <div className="flex h-full w-full overflow-hidden">
          {/* Sidebar Chat */}
          <div className={`
                 transition-all duration-300 ease-in-out bg-slate-950 flex flex-col
                 ${layoutMode === 'center' ? 'w-full' : (chatCollapsed ? 'w-12 shrink-0' : 'w-[400px] shrink-0')}
             `}>
            <Chat
              messages={messages}
              onSendMessage={handleSendMessage}
              isProcessing={isProcessing}
              onStop={handleStopGeneration}
              collapsed={chatCollapsed && layoutMode === 'workspace'}
              onToggleCollapse={() => setChatCollapsed(!chatCollapsed)}
              onEditMessage={handleEditMessage}
            />
          </div>

          {/* Main Canvas Area - Hidden in Center Mode */}
          {layoutMode === 'workspace' && (
            <div className="flex-1 flex flex-col min-w-0 bg-slate-950 relative">
              <CanvasHeader
                title={canvasTitle}
                onTitleChange={(newTitle) => { setCanvasTitle(newTitle); saveCanvas(newTitle, null, null); }}
                onSave={() => saveCanvas()}
                onNewChat={handleNewChat}
                isSaving={isProcessing}
                lastSavedAt={lastSaved}
                canvasMode={canvasMode}
                onModeChange={setCanvasMode}
              />
              <Canvas
                widgets={activeWidgets}
                loading={isProcessing}
                canvasId={canvasId}
                onNavigate={loadCanvas}
              />
            </div>
          )}
        </div>
      )}
      {activeTab === 'resources' && (
        <ResourcesView
          key={resourcesVersion}
          onEdit={(type, data) => handleEditResource(type, data)}
        />
      )}
      {activeTab === 'settings' && <SettingsView />}

      <Modal
        isOpen={!!modalType}
        onClose={closeModal}
        title={editingResource ? `Edit ${modalType === 'api' ? 'API' : 'Database'}` : (modalType === 'api' ? 'Connect New API' : 'Connect Database')}
      >
        {modalType === 'api' && (
          <RegisterApiForm
            onSubmit={(data) => handleRegister('api', data)}
            isLoading={isProcessing}
            initialData={editingResource?.type === 'api' ? editingResource.data : null}
          />
        )}
        {modalType === 'db' && (
          <RegisterDbForm
            onSubmit={(data) => handleRegister('db', data)}
            isLoading={isProcessing}
            initialData={editingResource?.type === 'db' ? editingResource.data : null}
          />
        )}
      </Modal>

      {/* Load Canvas Modal (Simple) */}
      <Modal
        isOpen={showLoadModal}
        onClose={() => setShowLoadModal(false)}
        title="Load Canvas"
      >
        <div className="space-y-2">
          <button
            onClick={handleCreateNewCanvas}
            className="w-full text-left p-3 rounded bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 border border-indigo-500/20 mb-4 flex items-center gap-2"
          >
            <span className="text-xl">+</span> Create New Canvas
          </button>
          <div className="max-h-60 overflow-y-auto space-y-2">
            {savedCanvases.map(c => (
              <div
                key={c.id}
                className="flex items-center gap-2 p-3 rounded bg-slate-800 border border-slate-700 hover:bg-slate-700 transition-colors"
              >
                <button
                  onClick={() => loadCanvas(c.id)}
                  className="flex-1 text-left flex justify-between items-center"
                >
                  <div className="flex flex-col">
                    <span className="text-slate-200">{c.title}</span>
                    <span className="text-xs text-slate-500">
                      {new Date(c.updatedAt).toLocaleDateString()} • {c.widgetCount} widgets • {c.messageCount} messages
                    </span>
                  </div>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteCanvas(c.id, c.title);
                  }}
                  className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors"
                  title="Delete canvas"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 6h18"></path>
                    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                  </svg>
                </button>
              </div>
            ))}
            {savedCanvases.length === 0 && <p className="text-slate-500 text-center py-4">No saved canvases</p>}
          </div>
        </div>
      </Modal>

    </Layout>
  );
}

export default App;
