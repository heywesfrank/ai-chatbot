// app/(dashboard)/home/page.tsx
'use client';
import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { supabaseClient as supabase } from '@/lib/supabase-client';

type Tab = 'data' | 'appearance' | 'behavior' | 'install';
type SourceTab = 'gitbook' | 'website' | 'file';

export default function HomeDashboard() {
  const [userId, setUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('data');
  const [sourceTab, setSourceTab] = useState<SourceTab>('website');
  
  // UI States
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeSpaceId, setActiveSpaceId] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [newPrompt, setNewPrompt] = useState('');

  // Source States
  const [websiteUrl, setWebsiteUrl] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Consolidated Configuration State
  const [config, setConfig] = useState({
    apiKey: '',
    spaceId: '',
    systemPrompt: 'You are a helpful, minimalist support assistant.',
    primaryColor: '#000000',
    headerText: 'Documentation Bot',
    welcomeMessage: 'How can I help you today?',
    botAvatar: '',
    showPrompts: true,
    suggestedPrompts: [
      "How do I reset my password?",
      "Where can I find the documentation?",
      "How do I contact support?"
    ],
    leadCaptureEnabled: false,
    theme: 'auto',
    position: 'right'
  });

  const updateConfig = (key: keyof typeof config, value: any) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

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
      .select('*')
      .eq('user_id', uid)
      .limit(1)
      .maybeSingle(); 

    if (data) {
      setConfig(prev => ({
        ...prev,
        spaceId: data.space_id || '',
        systemPrompt: data.system_prompt || prev.systemPrompt,
        apiKey: data.api_key || '', 
        primaryColor: data.primary_color || prev.primaryColor,
        headerText: data.header_text || prev.headerText,
        welcomeMessage: data.welcome_message || prev.welcomeMessage,
        botAvatar: data.bot_avatar || '',
        showPrompts: data.show_prompts ?? true,
        leadCaptureEnabled: data.lead_capture_enabled ?? false,
        suggestedPrompts: data.suggested_prompts || prev.suggestedPrompts
      }));
      if (data.space_id) setActiveSpaceId(data.space_id);
    }
  };

  const handleAddPrompt = () => {
    const p = newPrompt.trim();
    if (!p) return;
    if (config.suggestedPrompts.includes(p)) {
      setNewPrompt('');
      return toast.error('This prompt already exists.');
    }
    updateConfig('suggestedPrompts', [...config.suggestedPrompts, p]);
    setNewPrompt('');
  };

  const handleRemovePrompt = (promptToRemove: string) => {
    updateConfig('suggestedPrompts', config.suggestedPrompts.filter(p => p !== promptToRemove));
  };

  const callIngestApi = async (payload: any) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return toast.error('Authentication required.');

    setIsSyncing(true);
    try {
      const response = await fetch('/api/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ ...payload, spaceId: config.spaceId }),
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(`Synced successfully! ${data.count || 0} segments learned.`);
        
        // Save config if space ID is new
        await fetch('/api/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
          body: JSON.stringify({ ...config, userId: session.user.id }), 
        });
        
        setActiveSpaceId(config.spaceId);
        setRefreshKey(prev => prev + 1);
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Failed to sync data.');
      }
    } catch (error) {
      toast.error('An unexpected error occurred.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSyncGitbook = () => {
    if (!config.apiKey || !config.spaceId) return toast.error('API Key and Space ID are required.');
    callIngestApi({ type: 'gitbook', apiKey: config.apiKey });
  };

  const handleSyncWebsite = () => {
    if (!websiteUrl || !config.spaceId) return toast.error('URL and Space ID are required.');
    callIngestApi({ type: 'website', url: websiteUrl });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!config.spaceId) return toast.error('Please generate or enter a Space ID first.');
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'text/plain' && file.type !== 'text/csv' && file.type !== 'application/json') {
      return toast.error('Please upload a .txt, .csv, or .json file. (PDF coming soon)');
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      if (text) {
        callIngestApi({ type: 'file', text, filename: file.name });
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSaveConfig = async () => {
    if (!config.spaceId) return toast.error('Enter a Space ID first.');
    
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return toast.error('Authentication required.');

    setIsSaving(true);
    try {
      const response = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ ...config, userId }),
      });

      if (response.ok) {
        toast.success('Configuration updated!');
        setActiveSpaceId(config.spaceId);
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

  const generateSpaceId = () => {
    const id = Math.random().toString(36).substring(2, 10);
    updateConfig('spaceId', id);
  };

  if (!userId) return null; 

  const embedCode = `<script>
  (function() {
    var position = "${config.position}";
    var theme = "${config.theme}";
    var iframe = document.createElement('iframe');
    iframe.src = "[https://ai-chatbot-alpha-orpin.vercel.app/widget?spaceId=$](https://ai-chatbot-alpha-orpin.vercel.app/widget?spaceId=$){activeSpaceId}&position=" + position + "&theme=" + theme;
    iframe.style.position = 'fixed';
    iframe.style.bottom = '20px';
    iframe.style[position === 'left' ? 'left' : 'right'] = '20px';
    iframe.style.width = '100px';
    iframe.style.height = '100px';
    iframe.style.border = 'none';
    iframe.style.zIndex = '999999';
    iframe.style.background = 'transparent';
    iframe.style.colorScheme = 'normal';
    var meta = document.createElement('meta');
    meta.name = 'viewport';
    meta.content = 'width=device-width, initial-scale=1, maximum-scale=1';
    document.head.appendChild(meta);
    document.body.appendChild(iframe);

    window.addEventListener('message', function(e) {
      if (e.data && e.data.type === 'kb-widget-resize') {
        if (e.data.isOpen) {
          var isMobile = window.innerWidth < 600;
          iframe.style.width = isMobile ? '100%' : '400px';
          iframe.style.height = isMobile ? '100%' : '600px';
          iframe.style.bottom = isMobile ? '0' : '20px';
          iframe.style.right = isMobile ? '0' : (position === 'right' ? '20px' : 'auto');
          iframe.style.left = isMobile ? '0' : (position === 'left' ? '20px' : 'auto');
        } else {
          iframe.style.width = '100px';
          iframe.style.height = '100px';
          iframe.style.bottom = '20px';
          iframe.style.right = position === 'right' ? '20px' : 'auto';
          iframe.style.left = position === 'left' ? '20px' : 'auto';
        }
      }
    });
  })();
</script>`;

  const previewUrl = `/widget?spaceId=${activeSpaceId}&color=${encodeURIComponent(config.primaryColor)}&header=${encodeURIComponent(config.headerText)}&showPrompts=${config.showPrompts}&prompts=${encodeURIComponent(JSON.stringify(config.suggestedPrompts))}&leadCapture=${config.leadCaptureEnabled}&theme=${config.theme}&position=${config.position}&preview=true`;

  return (
    <div className="flex flex-col md:flex-row h-full w-full bg-[#FAFAFA] text-gray-900 font-sans overflow-hidden">
      
      {/* LEFT PANE: CONFIGURATION */}
      <div className="w-full md:w-[420px] border-r border-gray-200 bg-white flex flex-col z-10 shadow-[4px_0_24px_rgba(0,0,0,0.02)] relative">
        
        {/* Sticky Header */}
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-white/95 backdrop-blur-sm sticky top-0 z-20">
          <div>
            <h1 className="text-lg font-medium tracking-tight">Workspace</h1>
            <p className="text-gray-500 text-xs mt-0.5">Configure your AI agent</p>
          </div>
          <button 
            onClick={handleSaveConfig}
            disabled={isSaving || !config.spaceId}
            className="bg-black text-white px-4 py-2 rounded-md hover:bg-gray-800 disabled:bg-gray-200 disabled:text-gray-500 transition-colors text-xs font-medium shadow-sm"
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex px-6 border-b border-gray-100 space-x-6 text-sm bg-white overflow-x-auto no-scrollbar shrink-0">
          {(['data', 'appearance', 'behavior', 'install'] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-3.5 font-medium capitalize tracking-wide border-b-2 transition-colors outline-none whitespace-nowrap ${
                activeTab === tab ? 'border-black text-black' : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tab Content Area */}
        <div className="p-6 overflow-y-auto flex-1 pb-20 bg-white">
          
          {/* DATA TAB */}
          {activeTab === 'data' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-wider flex justify-between">
                  <span>Project ID</span>
                  {!config.spaceId && (
                    <button onClick={generateSpaceId} className="text-blue-500 hover:text-blue-600 transition-colors">Generate</button>
                  )}
                </label>
                <input type="text" placeholder="A unique identifier for your bot" className="w-full p-2.5 border border-gray-200 rounded-md text-sm outline-none focus:border-black transition-colors bg-gray-50" value={config.spaceId} onChange={(e) => updateConfig('spaceId', e.target.value)} />
                <p className="text-[10px] text-gray-400 mt-1">Required to link your data to your widget.</p>
              </div>

              <div className="border-t border-gray-100 pt-6">
                <div className="flex space-x-2 bg-gray-50 p-1 rounded-lg border border-gray-200 mb-4">
                  {(['website', 'gitbook', 'file'] as SourceTab[]).map(tab => (
                    <button
                      key={tab}
                      onClick={() => setSourceTab(tab)}
                      className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${sourceTab === tab ? 'bg-white shadow-sm text-gray-900 border border-gray-200/50' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                      {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </button>
                  ))}
                </div>

                {sourceTab === 'website' && (
                  <div className="space-y-4 animate-in fade-in duration-200">
                     <div>
                      <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">URL or Sitemap.xml</label>
                      <input type="url" placeholder="[https://example.com/sitemap.xml](https://example.com/sitemap.xml)" className="w-full p-2.5 border border-gray-200 rounded-md text-sm outline-none focus:border-black transition-colors" value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} />
                      <p className="text-[10px] text-gray-400 mt-1">Max 50 pages crawled per sitemap to prevent overload.</p>
                    </div>
                    <button 
                      onClick={handleSyncWebsite}
                      disabled={isSyncing || !websiteUrl || !config.spaceId}
                      className="w-full bg-white border border-gray-200 text-gray-900 p-2.5 rounded-md hover:bg-gray-50 disabled:bg-gray-50 disabled:text-gray-400 transition-colors text-sm font-medium shadow-sm"
                    >
                      {isSyncing ? 'Crawling...' : 'Fetch Website'}
                    </button>
                  </div>
                )}

                {sourceTab === 'file' && (
                  <div className="space-y-4 animate-in fade-in duration-200">
                     <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 flex flex-col items-center justify-center text-center bg-gray-50/50">
                        <svg className="w-6 h-6 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        <p className="text-sm text-gray-600 mb-1 font-medium">Upload Document</p>
                        <p className="text-[10px] text-gray-400 mb-4">Supports .txt, .csv, .json</p>
                        <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept=".txt,.csv,.json" />
                        <button 
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isSyncing || !config.spaceId}
                          className="px-4 py-2 bg-white border border-gray-200 text-gray-700 text-xs font-medium rounded shadow-sm hover:bg-gray-50 transition-colors disabled:opacity-50"
                        >
                          {isSyncing ? 'Uploading...' : 'Select File'}
                        </button>
                     </div>
                  </div>
                )}

                {sourceTab === 'gitbook' && (
                  <div className="space-y-4 animate-in fade-in duration-200">
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">GitBook Token</label>
                      <input type="password" placeholder="pat_..." className="w-full p-2.5 border border-gray-200 rounded-md text-sm outline-none focus:border-black transition-colors" value={config.apiKey} onChange={(e) => updateConfig('apiKey', e.target.value)} />
                    </div>
                    <button 
                      onClick={handleSyncGitbook}
                      disabled={isSyncing || !config.apiKey || !config.spaceId}
                      className="w-full bg-white border border-gray-200 text-gray-900 p-2.5 rounded-md hover:bg-gray-50 disabled:bg-gray-50 disabled:text-gray-400 transition-colors text-sm font-medium shadow-sm"
                    >
                      {isSyncing ? 'Syncing...' : 'Sync GitBook'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* APPEARANCE TAB */}
          {activeTab === 'appearance' && (
            <div className="space-y-5 animate-in fade-in duration-300">
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">Primary Color</label>
                <div className="flex items-center space-x-3">
                  <input type="color" className="w-10 h-10 p-0 border-0 rounded-md cursor-pointer" value={config.primaryColor} onChange={(e) => updateConfig('primaryColor', e.target.value)} />
                  <input type="text" className="flex-1 p-2.5 border border-gray-200 rounded-md text-sm outline-none focus:border-black uppercase transition-colors" value={config.primaryColor} onChange={(e) => updateConfig('primaryColor', e.target.value)} />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">Header Text</label>
                <input type="text" className="w-full p-2.5 border border-gray-200 rounded-md text-sm outline-none focus:border-black transition-colors" value={config.headerText} onChange={(e) => updateConfig('headerText', e.target.value)} />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">Welcome Message</label>
                <input type="text" className="w-full p-2.5 border border-gray-200 rounded-md text-sm outline-none focus:border-black transition-colors" value={config.welcomeMessage} onChange={(e) => updateConfig('welcomeMessage', e.target.value)} />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">Bot Avatar URL</label>
                <input type="text" placeholder="https://..." className="w-full p-2.5 border border-gray-200 rounded-md text-sm outline-none focus:border-black transition-colors" value={config.botAvatar} onChange={(e) => updateConfig('botAvatar', e.target.value)} />
              </div>
              <div className="flex gap-4 pt-2">
                <div className="flex-1">
                  <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">Theme</label>
                  <select className="w-full p-2.5 border border-gray-200 rounded-md text-sm outline-none focus:border-black bg-white" value={config.theme} onChange={(e) => updateConfig('theme', e.target.value)}>
                    <option value="auto">Auto</option>
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">Position</label>
                  <select className="w-full p-2.5 border border-gray-200 rounded-md text-sm outline-none focus:border-black bg-white" value={config.position} onChange={(e) => updateConfig('position', e.target.value)}>
                    <option value="right">Right</option>
                    <option value="left">Left</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* BEHAVIOR TAB */}
          {activeTab === 'behavior' && (
            <div className="space-y-7 animate-in fade-in duration-300">
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">System Prompt</label>
                <textarea 
                  className="w-full p-3 border border-gray-200 rounded-md text-sm h-32 outline-none focus:border-black resize-none leading-relaxed transition-colors"
                  value={config.systemPrompt}
                  onChange={(e) => updateConfig('systemPrompt', e.target.value)}
                />
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-900 uppercase tracking-wider">Suggested Prompts</label>
                    <p className="text-xs text-gray-500 mt-0.5">Show helpful quick-replies.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={config.showPrompts} onChange={(e) => updateConfig('showPrompts', e.target.checked)} />
                    <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-black"></div>
                  </label>
                </div>

                {config.showPrompts && (
                  <div className="space-y-3 p-4 bg-gray-50 rounded-md border border-gray-100">
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        placeholder="Add a prompt..."
                        className="flex-1 p-2 border border-gray-200 rounded-md text-sm outline-none focus:border-black transition-colors bg-white"
                        value={newPrompt}
                        onChange={(e) => setNewPrompt(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddPrompt(); } }}
                      />
                      <button onClick={(e) => { e.preventDefault(); handleAddPrompt(); }} disabled={!newPrompt.trim()} className="px-3 bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50 disabled:opacity-50 transition-colors">Add</button>
                    </div>
                    {config.suggestedPrompts.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {config.suggestedPrompts.map(prompt => (
                          <span key={prompt} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-gray-200 rounded-md text-xs text-gray-700 shadow-sm">
                            <span className="truncate max-w-[200px]">{prompt}</span>
                            <button onClick={() => handleRemovePrompt(prompt)} className="text-gray-400 hover:text-red-500 focus:outline-none">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between border-t border-gray-100 pt-6">
                <div className="pr-4">
                  <label className="block text-[11px] font-semibold text-gray-900 uppercase tracking-wider">Lead Capture</label>
                  <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">Require users to enter their name and email before starting a chat.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                  <input type="checkbox" className="sr-only peer" checked={config.leadCaptureEnabled} onChange={(e) => updateConfig('leadCaptureEnabled', e.target.checked)} />
                  <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-black"></div>
                </label>
              </div>
            </div>
          )}

          {/* INSTALL TAB */}
          {activeTab === 'install' && (
            <div className="space-y-4 animate-in fade-in duration-300">
              <div>
                <label className="block text-[11px] font-semibold text-gray-900 uppercase tracking-wider mb-1.5">Deployment Script</label>
                <p className="text-xs text-gray-500 mb-4 leading-relaxed">Copy and paste this snippet directly into your website's HTML before the closing <code className="bg-gray-100 px-1 rounded text-gray-800">&lt;/body&gt;</code> tag.</p>
                <textarea 
                  readOnly 
                  className="w-full p-4 border border-gray-200 rounded-md bg-gray-50 text-[11px] font-mono h-64 focus:outline-none focus:ring-1 focus:ring-black transition-shadow text-gray-700 leading-relaxed resize-none"
                  value={embedCode}
                  onClick={(e) => {
                    e.currentTarget.select();
                    toast.success('Copied to clipboard!');
                    navigator.clipboard.writeText(embedCode);
                  }}
                />
              </div>
            </div>
          )}

        </div>
      </div>

      {/* RIGHT PANE: EXCLUSIVE LIVE PREVIEW */}
      <div className="flex-1 p-8 flex flex-col items-center justify-center relative overflow-hidden bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px]">
        {!activeSpaceId ? (
          <div className="flex flex-col items-center justify-center text-center max-w-sm bg-white p-8 rounded-xl border border-gray-200 shadow-sm">
            <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mb-4 border border-gray-100">
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </div>
            <h2 className="text-base font-medium mb-1 text-gray-900">Playground Empty</h2>
            <p className="text-gray-500 text-sm leading-relaxed">Generate a Space ID and add data on the left to start testing your bot.</p>
          </div>
        ) : (
          <div className="w-[380px] h-[600px] bg-white rounded-2xl shadow-[0_20px_40px_-15px_rgba(0,0,0,0.15)] overflow-hidden border border-gray-200/50 relative animate-in fade-in zoom-in-95 duration-500">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-gray-200 to-transparent z-10 opacity-50"></div>
            <iframe 
              key={refreshKey}
              src={previewUrl} 
              className="w-full h-full border-none bg-transparent"
              title="Widget Preview"
            />
          </div>
        )}
      </div>
    </div>
  );
}
