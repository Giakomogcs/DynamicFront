import React, { useState, useEffect } from 'react';
import Layout from './Layout';
import { Chat } from './components/Chat';
import { ResourcesView } from './components/ResourcesView';
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


  const handleSendMessage = async (text) => {
    // Switch to workspace mode on first message
    if (layoutMode === 'center') setLayoutMode('workspace');

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
          location // Send location context
        })
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

      // 4. Update Canvas with new widgets if any (Append or Replace? Let's Append for now, or Replace if user asks new thing?)
      // For a "Dashboard" feel, we might want to accumulate. 
      // But usually user wants to see the *answer*. Let's set active widgets to the latest response + keep old ones?
      // User said: "ter varios chats para esse canvas".
      // Let's replace for clarity unless we build a complex dashboard builder.
      if (data.widgets && data.widgets.length > 0) {
        setActiveWidgets(data.widgets);
      }

    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { role: 'model', text: `Error: ${error.message}` }]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRegister = async (type, formData) => {
    setIsProcessing(true);
    try {
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

      setModalType(null);
      // Add a system message to chat confirming success
      setMessages(prev => [...prev, { role: 'model', text: result.content?.[0]?.text || "Registration successful." }]);

    } catch (e) {
      alert(e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Layout
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      onRegisterApi={() => setModalType('api')}
      onRegisterDb={() => setModalType('db')}
      onOpenLoadModal={() => setShowLoadModal(true)}
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
      {activeTab === 'resources' && <ResourcesView />}

      <Modal
        isOpen={!!modalType}
        onClose={() => setModalType(null)}
        title={modalType === 'api' ? 'Connect New API' : 'Connect Database'}
      >
        {modalType === 'api' && <RegisterApiForm onSubmit={(data) => handleRegister('api', data)} isLoading={isProcessing} />}
        {modalType === 'db' && <RegisterDbForm onSubmit={(data) => handleRegister('db', data)} isLoading={isProcessing} />}
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
