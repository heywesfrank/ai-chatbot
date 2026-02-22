'use client';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { supabaseClient as supabase } from '@/lib/supabase-client';

export default function HomeDashboard() {
  const [userId, setUserId] = useState<string | null>(null);

  // --- Config States ---
  const [apiKey, setApiKey] = useState('');
  const [spaceId, setSpaceId] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('You are a helpful, minimalist support assistant.');
  
  // --- Branding States ---
  const [primaryColor, setPrimaryColor] = useState('#000000');
  const [headerText, setHeaderText] = useState('Documentation Bot');
  const [welcomeMessage, setWelcomeMessage] = useState('How can I help you today?');
  const [botAvatar, setBotAvatar] = useState('');
  const [showPrompts, setShowPrompts] = useState(true);
  const [suggestedPrompts, setSuggestedPrompts] = useState<string[]>([]);
  const [newPrompt, setNewPrompt] = useState('');
  const [leadCaptureEnabled, setLeadCaptureEnabled] = useState(false);
  
  // --- UI States ---
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeSpaceId, setActiveSpaceId] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  // Hydrate only — layout handles redirect checks
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setUserId(session.user.id);
        hydrateWorkspace(session.user.id);
      }
    });
  }, []);

  const hydrateWorkspace = async (uid: string) => {
    const { data, error } = await supabase
      .from('bot_config')
      .select('space_id, system_prompt, api_key, primary_color, header_text, welcome_message, bot_avatar, show_prompts, suggested_prompts, lead_capture_enabled') 
      .eq('user_id', uid)
      .limit(1)
      .maybeSingle(); 

    if (error) {
      console.error("Supabase Hydration Error:", error.message);
      return;
    }

    if (data) {
      setSpaceId(data.space_id || '');
      setSystemPrompt(data.system_prompt || '');
      setApiKey(data.api_key || ''); 
      setPrimaryColor(data.primary_color || '#000000');
      setHeaderText(data.header_text || 'Documentation Bot');
      setWelcomeMessage(data.welcome_message || 'How can I help you today?');
      setBotAvatar(data.bot_avatar || '');
      setShowPrompts(data.show_prompts ?? true);
      setLeadCaptureEnabled(data.lead_capture_enabled ?? false);
      
      setSuggestedPrompts(data.suggested_prompts || [
        "How do I reset my password?",
        "Where can I find the documentation?",
        "How do I contact support?"
      ]);
      
      if (data.space_id) {
        setActiveSpaceId(data.space_id);
      }
    } else {
      setSuggestedPrompts([
        "How do I reset my password?",
        "Where can I find the documentation?",
        "How do I contact support?"
      ]);
    }
  };

  const handleAddPrompt = () => {
    const p = newPrompt.trim();
    if (!p) return;
    if (suggestedPrompts.includes(p)) {
      setNewPrompt('');
      return toast.error('This prompt already exists.');
    }
    setSuggestedPrompts([...suggestedPrompts, p]);
    setNewPrompt('');
  };

  const handleRemovePrompt = (promptToRemove: string) => {
    setSuggestedPrompts(suggestedPrompts.filter(p => p !== promptToRemove));
  };

  const handleSyncKnowledge = async () => {
    if (!apiKey || !spaceId) return toast.error('API Key and Space ID are required.');
    
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return toast.error('Authentication required.');

    setIsSyncing(true);
    try {
      const syncResponse = await fetch('/api/ingest', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ apiKey, spaceId }),
      });

      const configResponse = await fetch('/api/config', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ spaceId, systemPrompt, userId: session.user.id, apiKey, primaryColor, headerText, welcomeMessage, botAvatar, showPrompts, suggestedPrompts, leadCaptureEnabled }), 
      });

      if (syncResponse.ok && configResponse.ok) {
        toast.success('Knowledge base synced and configuration saved!');
        setActiveSpaceId(spaceId);
        setRefreshKey(prev => prev + 1); 
      } else {
        toast.error('Failed to sync or save configuration. Check credentials.');
      }
    } catch (error) {
      toast.error('An unexpected error occurred.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSaveConfig = async () => {
    if (!spaceId) return toast.error('Enter a Space ID first.');
    
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return toast.error('Authentication required.');

    setIsSaving(true);
    
    try {
      const response = await fetch('/api/config', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ spaceId, systemPrompt, userId, apiKey, primaryColor, headerText, welcomeMessage, botAvatar, showPrompts, suggestedPrompts, leadCaptureEnabled }),
      });

      if (response.ok) {
        toast.success('Configuration updated!');
        setActiveSpaceId(spaceId);
        setRefreshKey(prev => prev + 1); 
      } else {
        toast.error('Failed to update configuration.');
      }
    } catch (error) {
      toast.error('Error saving configuration.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!userId) return null; 

  const embedCode = `<iframe src="https://ai-chatbot-alpha-orpin.vercel.app/widget?spaceId=${activeSpaceId}" width="400" height="600" style="border: 1px solid #e5e7eb; border-radius: 4px;" sandbox="allow-scripts allow-same-origin allow-forms"></iframe>`;

  // Pass un-saved values into the iframe to allow instant live previews without a DB roundtrip
  const previewUrl = `/widget?spaceId=${activeSpaceId}&color=${encodeURIComponent(primaryColor)}&header=${encodeURIComponent(headerText)}&showPrompts=${showPrompts}&prompts=${encodeURIComponent(JSON.stringify(suggestedPrompts))}&leadCapture=${leadCaptureEnabled}`;

  return (
    <div className="flex flex-col md:flex-row h-full w-full bg-white text-gray-900 font-sans overflow-hidden">
      
      {/* LEFT PANE: CONFIGURATION */}
      <div className="w-full md:w-[400px] border-r border-gray-200 bg-white p-8 flex flex-col overflow-y-auto z-10 shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
        <div className="mb-8">
          <h1 className="text-xl font-medium mb-1 tracking-tight">Workspace</h1>
          <p className="text-gray-500 text-sm">Configure your AI agent.</p>
        </div>
        
        <div className="space-y-8 flex-1 pb-10">
          {/* 1. KNOWLEDGE BASE */}
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
              className="w-full bg-white border border-gray-300 text-gray-900 p-2.5 rounded-sm hover:bg-gray-50 disabled:bg-gray-100 transition-colors text-sm font-medium"
            >
              {isSyncing ? 'Syncing...' : 'Sync Data'}
            </button>
          </div>

          {/* 2. PERSONA */}
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-gray-900 border-b border-gray-100 pb-2">2. Agent Persona</h2>
            <div>
              <textarea 
                placeholder="How should your bot behave?"
                className="w-full p-2.5 border border-gray-300 rounded-sm focus:outline-none focus:border-black transition-colors text-sm h-28 resize-none leading-relaxed"
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
              />
            </div>
          </div>

          {/* 3. BRAND CUSTOMIZATION */}
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-gray-900 border-b border-gray-100 pb-2">3. Brand Customization</h2>
            
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider">Primary Color</label>
              <div className="flex items-center space-x-2">
                <input 
                  type="color" 
                  className="w-9 h-9 p-0 border-0 rounded-sm cursor-pointer"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                />
                <input 
                  type="text" 
                  className="flex-1 p-2.5 border border-gray-300 rounded-sm focus:outline-none focus:border-black transition-colors text-sm uppercase"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider">Header Text</label>
              <input 
                type="text" 
                placeholder="e.g. Acme Support"
                className="w-full p-2.5 border border-gray-300 rounded-sm focus:outline-none focus:border-black transition-colors text-sm"
                value={headerText}
                onChange={(e) => setHeaderText(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider">Bot Avatar URL</label>
              <input 
                type="text" 
                placeholder="[https://example.com/avatar.png](https://example.com/avatar.png)"
                className="w-full p-2.5 border border-gray-300 rounded-sm focus:outline-none focus:border-black transition-colors text-sm"
                value={botAvatar}
                onChange={(e) => setBotAvatar(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider">Welcome Message</label>
              <input 
                type="text" 
                placeholder="How can I help you today?"
                className="w-full p-2.5 border border-gray-300 rounded-sm focus:outline-none focus:border-black transition-colors text-sm"
                value={welcomeMessage}
                onChange={(e) => setWelcomeMessage(e.target.value)}
              />
            </div>
          </div>

          {/* 4. SUGGESTED PROMPTS */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-2">
              <h2 className="text-sm font-semibold text-gray-900">4. Suggested Prompts</h2>
              <label className="flex items-center cursor-pointer">
                <div className="relative">
                  <input 
                    type="checkbox" 
                    className="sr-only" 
                    checked={showPrompts} 
                    onChange={(e) => setShowPrompts(e.target.checked)} 
                  />
                  <div className={`block w-8 h-4.5 rounded-full transition-colors ${showPrompts ? 'bg-black' : 'bg-gray-300'}`}></div>
                  <div className={`absolute left-0.5 top-0.5 bg-white w-3.5 h-3.5 rounded-full transition-transform ${showPrompts ? 'transform translate-x-3.5' : ''}`}></div>
                </div>
              </label>
            </div>

            {showPrompts && (
              <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    placeholder="e.g. How do I reset my password?"
                    className="flex-1 p-2.5 border border-gray-300 rounded-sm focus:outline-none focus:border-black transition-colors text-sm"
                    value={newPrompt}
                    onChange={(e) => setNewPrompt(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddPrompt();
                      }
                    }}
                  />
                  <button 
                    onClick={(e) => { e.preventDefault(); handleAddPrompt(); }}
                    disabled={!newPrompt.trim()}
                    className="px-4 bg-gray-100 border border-gray-300 text-gray-700 text-sm font-medium rounded-sm hover:bg-gray-200 disabled:opacity-50 transition-colors"
                  >
                    Add
                  </button>
                </div>

                {suggestedPrompts.length > 0 && (
                  <div className="flex flex-wrap gap-2 p-3 bg-gray-50 border border-gray-200 rounded-sm">
                    {suggestedPrompts.map(prompt => (
                      <span key={prompt} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-gray-200 rounded-full text-xs text-gray-700 shadow-sm">
                        <span className="truncate max-w-[200px]">{prompt}</span>
                        <button 
                          onClick={() => handleRemovePrompt(prompt)} 
                          className="text-gray-400 hover:text-red-500 focus:outline-none"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 5. LEAD GENERATION */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-2">
              <h2 className="text-sm font-semibold text-gray-900">5. Lead Generation</h2>
              <label className="flex items-center cursor-pointer">
                <div className="relative">
                  <input 
                    type="checkbox" 
                    className="sr-only" 
                    checked={leadCaptureEnabled} 
                    onChange={(e) => setLeadCaptureEnabled(e.target.checked)} 
                  />
                  <div className={`block w-8 h-4.5 rounded-full transition-colors ${leadCaptureEnabled ? 'bg-black' : 'bg-gray-300'}`}></div>
                  <div className={`absolute left-0.5 top-0.5 bg-white w-3.5 h-3.5 rounded-full transition-transform ${leadCaptureEnabled ? 'transform translate-x-3.5' : ''}`}></div>
                </div>
              </label>
            </div>
            {leadCaptureEnabled && (
              <p className="text-xs text-gray-500 animate-in fade-in duration-300">
                A pre-chat form will require users to enter their Name and Email before they can start interacting with your bot.
              </p>
            )}

            <button 
              onClick={handleSaveConfig}
              disabled={isSaving}
              className="w-full bg-black text-white p-2.5 rounded-sm hover:bg-gray-800 disabled:bg-gray-300 transition-colors text-sm font-medium mt-6"
            >
              {isSaving ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>
        </div>
      </div>

      {/* RIGHT PANE: PLAYGROUND & EXPORT */}
      <div className="flex-1 bg-[#FAFAFA] p-8 flex flex-col relative overflow-y-auto">
        {!activeSpaceId ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center max-w-sm mx-auto">
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-4 border border-gray-200">
              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </div>
            <h2 className="text-lg font-medium mb-2 text-gray-900">Playground Empty</h2>
            <p className="text-gray-500 text-sm leading-relaxed">Enter your credentials and sync your GitBook on the left to start testing your bot.</p>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto w-full h-full flex flex-col space-y-8">
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
                  src={previewUrl} 
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
