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
  // New State: Active Widgets for Canvas and Layout Mode
  const [activeWidgets, setActiveWidgets] = useState([]);
  const [layoutMode, setLayoutMode] = useState('center'); // 'center' | 'workspace'

  // Canvas State
  const [canvasId, setCanvasId] = useState(null);
  const [canvasTitle, setCanvasTitle] = useState("New Analysis");
  const [lastSaved, setLastSaved] = useState(null);
  const [savedCanvases, setSavedCanvases] = useState([]);
  const [showLoadModal, setShowLoadModal] = useState(false);


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

  const saveCanvas = async (curTitle, curWidgets) => {
    setIsProcessing(true);
    try {
      const payload = {
        title: curTitle || canvasTitle,
        widgets: curWidgets || activeWidgets
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
      setLastSaved(data.updatedAt);
      setLayoutMode('workspace');
      setMessages([{ role: 'model', text: `Loaded canvas: ${data.title}` }]); // Reset chat
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
      const response = await fetch('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: messages,
          location, // Send location context
          model: selectedModel
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

      // 4. Update Canvas with new widgets if any
      if (data.widgets && data.widgets.length > 0) {
        setActiveWidgets(data.widgets);
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

  // --- Resource Management (Create / Update) ---
  const [editingResource, setEditingResource] = useState(null); // { type: 'api'|'db', data: ... }

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
                 transition-all duration-500 ease-in-out border-r border-slate-800 bg-slate-950 flex flex-col
                 ${layoutMode === 'center' ? 'w-full max-w-3xl mx-auto border-r-0' : 'w-[400px] shrink-0'}
             `}>
            <Chat
              messages={messages}
              onSendMessage={handleSendMessage}
              isProcessing={isProcessing}
              onStop={handleStopGeneration}
            />
          </div>

          {/* Main Canvas Area - Hidden in Center Mode */}
          {layoutMode === 'workspace' && (
            <div className="flex-1 flex flex-col min-w-0 bg-slate-950 relative">
              <CanvasHeader
                title={canvasTitle}
                onTitleChange={(newTitle) => { setCanvasTitle(newTitle); saveCanvas(newTitle, null); }}
                onSave={() => saveCanvas()}
                onNewChat={handleNewChat}
                isSaving={isProcessing}
                lastSavedAt={lastSaved}
              />
              <Canvas widgets={activeWidgets} loading={isProcessing} />
            </div>
          )}
        </div>
      )}
      {activeTab === 'resources' && (
        <ResourcesView
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
              <button
                key={c.id}
                onClick={() => loadCanvas(c.id)}
                className="w-full text-left p-3 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex justify-between items-center"
              >
                <span>{c.title}</span>
                <span className="text-xs text-slate-500">{new Date(c.updatedAt).toLocaleDateString()}</span>
              </button>
            ))}
            {savedCanvases.length === 0 && <p className="text-slate-500 text-center py-4">No saved canvases</p>}
          </div>
        </div>
      </Modal>

    </Layout>
  );
}

export default App;
