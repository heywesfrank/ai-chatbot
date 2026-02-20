'use client';
import { useState } from 'react';
import { Toaster, toast } from 'sonner';

export default function Dashboard() {
  const [apiKey, setApiKey] = useState('');
  const [spaceId, setSpaceId] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('You are a helpful, minimalist support assistant.');
  
  // Independent loading states
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Drives the right-hand playground preview
  const [activeSpaceId, setActiveSpaceId] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  // ACTION 1: Syncs the heavy vector embeddings
  const handleSyncKnowledge = async () => {
    if (!apiKey || !spaceId) {
      toast.error('Please provide both an API Key and a Space ID.');
      return;
    }
    
    setIsSyncing(true);
    try {
      const response = await fetch('/api/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey, spaceId }),
      });

      if (response.ok) {
        toast.success('Knowledge base synced successfully!');
        setActiveSpaceId(spaceId);
        setRefreshKey(prev => prev + 1);
      } else {
        toast.error('Failed to sync with GitBook. Check your credentials.');
      }
    } catch (error) {
      toast.error('An unexpected error occurred during ingestion.');
    } finally {
      setIsSyncing(false);
    }
  };

  // ACTION 2: Instantly saves the persona
  const handleSavePersona = async () => {
    if (!spaceId) {
      toast.error('Please enter a Space ID first to identify your bot.');
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spaceId, systemPrompt }),
      });

      if (response.ok) {
        toast.success('Agent persona updated!');
        setActiveSpaceId(spaceId);
        setRefreshKey(prev => prev + 1); // Refresh the iframe to test new persona
      } else {
        toast.error('Failed to update persona.');
      }
    } catch (error) {
      toast.error('Error saving persona.');
    } finally {
      setIsSaving(false);
    }
  };

  const embedCode = `<iframe src="https://ai-chatbot-alpha-orpin.vercel.app/widget?spaceId=${activeSpaceId}" width="400" height="600" style="border: 1px solid #e5e7eb; border-radius: 4px;" sandbox="allow-scripts allow-same-origin allow-forms"></iframe>`;

  return (
    <div className="flex flex-col md:flex-row h-screen bg-white text-gray-900 font-sans overflow-hidden">
      <Toaster position="top-center" />
      
      {/* LEFT PANE: CONFIGURATION */}
      <div className="w-full md:w-[400px] border-r border-gray-200 bg-white p-8 flex flex-col overflow-y-auto z-10 shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
        <div className="mb-8">
          <h1 className="text-xl font-medium mb-1 tracking-tight">Workspace</h1>
          <p className="text-gray-500 text-sm">Configure and train your AI agent.</p>
        </div>
        
        <div className="space-y-8 flex-1">
          
          {/* SECTION 1: KNOWLEDGE BASE */}
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-gray-900 border-b border-gray-100 pb-2">1. Knowledge Base</h2>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider">GitBook Token</label>
              <input 
                type="password" 
                placeholder="pat_..."
                className="w-full p-2.5 border border-gray-300 rounded-sm focus:outline-none focus:border-black transition-colors text-sm"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider">Space ID</label>
              <input 
                type="text" 
                placeholder="e.g. xYz123..."
                className="w-full p-2.5 border border-gray-300 rounded-sm focus:outline-none focus:border-black transition-colors text-sm"
                value={spaceId}
                onChange={(e) => setSpaceId(e.target.value)}
              />
            </div>
            <button 
              onClick={handleSyncKnowledge}
              disabled={isSyncing}
              className="w-full bg-white border border-gray-300 text-gray-900 p-2.5 rounded-sm hover:bg-gray-50 disabled:bg-gray-100 transition-colors text-sm font-medium flex justify-center items-center"
            >
              {isSyncing ? 'Syncing...' : 'Sync Data'}
            </button>
          </div>

          {/* SECTION 2: PERSONA */}
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-gray-900 border-b border-gray-100 pb-2">2. Agent Persona</h2>
            <div>
              <textarea 
                placeholder="How should your bot behave?"
                className="w-full p-2.5 border border-gray-300 rounded-sm focus:outline-none focus:border-black transition-colors text-sm h-32 resize-none leading-relaxed"
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
              />
            </div>
            <button 
              onClick={handleSavePersona}
              disabled={isSaving}
              className="w-full bg-black text-white p-2.5 rounded-sm hover:bg-gray-800 disabled:bg-gray-300 transition-colors text-sm font-medium flex justify-center items-center"
            >
              {isSaving ? 'Saving...' : 'Save & Update Preview'}
            </button>
          </div>

        </div>
      </div>

      {/* RIGHT PANE: PLAYGROUND & EXPORT */}
      {/* ... (Right Pane remains exactly the same as the previous response) ... */}
      <div className="flex-1 bg-[#FAFAFA] p-8 flex flex-col relative overflow-y-auto">
        {!activeSpaceId ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center max-w-sm mx-auto animate-fade-in">
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-4 border border-gray-200">
              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </div>
            <h2 className="text-lg font-medium mb-2 text-gray-900">Playground Empty</h2>
            <p className="text-gray-500 text-sm leading-relaxed">Enter your credentials and sync your GitBook on the left to start testing your bot.</p>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto w-full h-full flex flex-col animate-fade-in space-y-8">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-medium text-gray-900">Live Preview</h2>
                <p className="text-sm text-gray-500">Test your latest configuration before deploying.</p>
              </div>
              <span className="px-2.5 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full flex items-center gap-1.5 border border-green-200">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                Active
              </span>
            </div>

            <div className="flex-1 flex gap-8">
              <div className="w-[400px] h-[600px] bg-white border border-gray-200 rounded-sm shadow-sm overflow-hidden flex-shrink-0 relative">
                <iframe 
                  key={refreshKey}
                  src={`/widget?spaceId=${activeSpaceId}`} 
                  className="w-full h-full border-none"
                />
              </div>

              <div className="flex-1 flex flex-col">
                <h3 className="text-sm font-medium mb-3 text-gray-900">Deployment Code</h3>
                <p className="text-xs text-gray-500 mb-4">Copy and paste this snippet directly into your website's HTML.</p>
                <textarea 
                  readOnly 
                  className="w-full p-4 border border-gray-200 rounded-sm bg-gray-50 text-xs font-mono h-48 focus:outline-none focus:ring-1 focus:ring-black transition-shadow text-gray-700 leading-relaxed resize-none"
                  value={embedCode}
                  onClick={(e) => e.currentTarget.select()}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
