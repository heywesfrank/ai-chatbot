// app/(dashboard)/home/page.tsx
'use client';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { supabaseClient as supabase } from '@/lib/supabase-client';

type Tab = 'appearance' | 'behavior' | 'model' | 'install';

export default function HomeDashboard() {
  const [userId, setUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('appearance');
  const [isOwner, setIsOwner] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeSpaceId, setActiveSpaceId] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [newPrompt, setNewPrompt] = useState('');

  const [config, setConfig] = useState({
    spaceId: '',
    systemPrompt: 'You are a helpful, minimalist support assistant.',
    primaryColor: '#000000',
    headerText: 'Documentation Bot',
    welcomeMessage: 'How can I help you today?',
    botAvatar: '',
    showPrompts: true,
    suggestedPrompts: ["How do I reset my password?", "Where can I find the documentation?", "How do I contact support?"],
    leadCaptureEnabled: false,
    language: 'Auto-detect',
    theme: 'auto',
    position: 'right',
    temperature: 0.5,
    matchThreshold: 0.2,
    reasoningEffort: 'medium',
    verbosity: 'medium',
    allowedDomains: ''
  });

  const updateConfig = (key: keyof typeof config, value: any) => {
    if (isOwner) setConfig(prev => ({ ...prev, [key]: value }));
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setUserId(session.user.id);
        hydrateWorkspace(session.user.id, session.user.email || '');
      }
    });
  }, []);

  const hydrateWorkspace = async (uid: string, email: string) => {
    let spaceData = null;
    let owner = true;

    const { data } = await supabase.from('bot_config').select('*').eq('user_id', uid).maybeSingle();
    if (data) {
      spaceData = data;
    } else {
      const { data: member } = await supabase.from('team_members').select('space_id').eq('email', email).maybeSingle();
      if (member) {
        const { data: teamData } = await supabase.from('bot_config').select('*').eq('space_id', member.space_id).maybeSingle();
        if (teamData) { spaceData = teamData; owner = false; }
      }
    }

    setIsOwner(owner);

    if (spaceData) {
      setConfig(prev => ({
        ...prev,
        spaceId: spaceData.space_id || '',
        systemPrompt: spaceData.system_prompt || prev.systemPrompt,
        primaryColor: spaceData.primary_color || prev.primaryColor,
        headerText: spaceData.header_text || prev.headerText,
        welcomeMessage: spaceData.welcome_message || prev.welcomeMessage,
        botAvatar: spaceData.bot_avatar || '',
        showPrompts: spaceData.show_prompts ?? true,
        leadCaptureEnabled: spaceData.lead_capture_enabled ?? false,
        suggestedPrompts: spaceData.suggested_prompts || prev.suggestedPrompts,
        language: spaceData.language || 'Auto-detect',
        temperature: spaceData.temperature ?? prev.temperature,
        matchThreshold: spaceData.match_threshold ?? prev.matchThreshold,
        reasoningEffort: spaceData.reasoning_effort || prev.reasoningEffort,
        verbosity: spaceData.verbosity || prev.verbosity,
        allowedDomains: spaceData.allowed_domains || ''
      }));
      if (spaceData.space_id) setActiveSpaceId(spaceData.space_id);
    }
  };

  const handleAddPrompt = () => {
    const p = newPrompt.trim();
    if (!p || !isOwner) return;
    if (config.suggestedPrompts.includes(p)) { setNewPrompt(''); return toast.error('This prompt already exists.'); }
    updateConfig('suggestedPrompts', [...config.suggestedPrompts, p]);
    setNewPrompt('');
  };

  const handleRemovePrompt = (promptToRemove: string) => {
    if (isOwner) updateConfig('suggestedPrompts', config.suggestedPrompts.filter(p => p !== promptToRemove));
  };

  const handleSaveConfig = async () => {
    const activeId = config.spaceId || Math.random().toString(36).substring(2, 10);
    if (!config.spaceId) updateConfig('spaceId', activeId);
    
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return toast.error('Authentication required.');

    setIsSaving(true);
    try {
      const response = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ ...config, spaceId: activeId, userId }),
      });

      if (response.ok) {
        toast.success('Configuration updated!');
        setActiveSpaceId(activeId);
        setRefreshKey(prev => prev + 1); 
      } else {
        toast.error('Failed to update configuration.');
      }
    } catch (error) { toast.error('Error saving configuration.'); } finally { setIsSaving(false); }
  };

  if (!userId) return null; 

  const embedCode = `<script>
  (function() {
    var position = "${config.position}";
    var theme = "${config.theme}";
    var iframe = document.createElement('iframe');
    iframe.src = "https://ai-chatbot-alpha-orpin.vercel.app/widget?spaceId=${activeSpaceId}&position=" + position + "&theme=" + theme;
    iframe.style.position = 'fixed'; iframe.style.bottom = '20px'; iframe.style[position === 'left' ? 'left' : 'right'] = '20px';
    iframe.style.width = '100px'; iframe.style.height = '100px'; iframe.style.border = 'none'; iframe.style.zIndex = '999999';
    iframe.style.background = 'transparent'; iframe.style.colorScheme = 'normal';
    document.head.appendChild(document.createElement('meta')).setAttribute('name', 'viewport');
    document.body.appendChild(iframe);
    window.addEventListener('message', function(e) {
      if (e.data && e.data.type === 'kb-widget-resize') {
        var isMobile = window.innerWidth < 600;
        iframe.style.width = e.data.isOpen ? (isMobile ? '100%' : '400px') : '100px';
        iframe.style.height = e.data.isOpen ? (isMobile ? '100%' : '600px') : '100px';
        iframe.style.bottom = e.data.isOpen && isMobile ? '0' : '20px';
        iframe.style.right = e.data.isOpen && isMobile ? '0' : (position === 'right' ? '20px' : 'auto');
        iframe.style.left = e.data.isOpen && isMobile ? '0' : (position === 'left' ? '20px' : 'auto');
      }
    });
  })();
</script>`;

  const previewUrl = `/widget?spaceId=${activeSpaceId}&color=${encodeURIComponent(config.primaryColor)}&header=${encodeURIComponent(config.headerText)}&showPrompts=${config.showPrompts}&prompts=${encodeURIComponent(JSON.stringify(config.suggestedPrompts))}&leadCapture=${config.leadCaptureEnabled}&theme=${config.theme}&position=${config.position}&preview=true`;

  return (
    <div className="flex flex-col md:flex-row h-full w-full bg-[#FAFAFA] text-gray-900 font-sans overflow-hidden">
      <div className="w-full md:w-[420px] border-r border-gray-200 bg-white flex flex-col z-10 shadow-[4px_0_24px_rgba(0,0,0,0.02)] relative">
        {!isOwner && (
          <div className="bg-blue-50 border-b border-blue-100 p-3 text-[11px] text-blue-700 flex items-center justify-center gap-2 shrink-0 font-medium">
             Read-only view. Only the owner can save changes.
          </div>
        )}
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-white/95 backdrop-blur-sm sticky top-0 z-20">
          <div>
            <h1 className="text-lg font-medium tracking-tight">Workspace</h1>
            <p className="text-gray-500 text-xs mt-0.5">Configure your AI agent</p>
          </div>
          <button onClick={handleSaveConfig} disabled={isSaving || !isOwner} className="bg-black text-white px-4 py-2 rounded-md hover:bg-gray-800 disabled:bg-gray-200 disabled:text-gray-500 transition-colors text-xs font-medium shadow-sm">
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>

        <div className="flex px-6 border-b border-gray-100 space-x-6 text-sm bg-white overflow-x-auto no-scrollbar shrink-0">
          {(['appearance', 'behavior', 'model', 'install'] as Tab[]).map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`py-3.5 font-medium capitalize tracking-wide border-b-2 transition-colors outline-none whitespace-nowrap ${activeTab === tab ? 'border-black text-black' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>{tab}</button>
          ))}
        </div>

        <div className="p-6 overflow-y-auto flex-1 pb-20 bg-white">
          {activeTab === 'appearance' && (
            <div className="space-y-5 animate-in fade-in duration-300">
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">Primary Color</label>
                <div className="flex items-center space-x-3">
                  <input type="color" className="w-10 h-10 p-0 border-0 rounded-md cursor-pointer" disabled={!isOwner} value={config.primaryColor} onChange={(e) => updateConfig('primaryColor', e.target.value)} />
                  <input type="text" className="flex-1 p-2.5 border border-gray-200 rounded-md text-sm outline-none focus:border-black uppercase transition-colors" disabled={!isOwner} value={config.primaryColor} onChange={(e) => updateConfig('primaryColor', e.target.value)} />
                </div>
              </div>
              <div><label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">Header Text</label><input type="text" className="w-full p-2.5 border border-gray-200 rounded-md text-sm outline-none focus:border-black" disabled={!isOwner} value={config.headerText} onChange={(e) => updateConfig('headerText', e.target.value)} /></div>
              <div><label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">Welcome Message</label><input type="text" className="w-full p-2.5 border border-gray-200 rounded-md text-sm outline-none focus:border-black" disabled={!isOwner} value={config.welcomeMessage} onChange={(e) => updateConfig('welcomeMessage', e.target.value)} /></div>
              <div><label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">Bot Avatar URL</label><input type="text" placeholder="https://..." className="w-full p-2.5 border border-gray-200 rounded-md text-sm outline-none focus:border-black" disabled={!isOwner} value={config.botAvatar} onChange={(e) => updateConfig('botAvatar', e.target.value)} /></div>
              <div className="flex gap-4 pt-2">
                <div className="flex-1"><label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">Theme</label><select className="w-full p-2.5 border border-gray-200 rounded-md text-sm outline-none focus:border-black bg-white" disabled={!isOwner} value={config.theme} onChange={(e) => updateConfig('theme', e.target.value)}><option value="auto">Auto</option><option value="light">Light</option><option value="dark">Dark</option></select></div>
                <div className="flex-1"><label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">Position</label><select className="w-full p-2.5 border border-gray-200 rounded-md text-sm outline-none focus:border-black bg-white" disabled={!isOwner} value={config.position} onChange={(e) => updateConfig('position', e.target.value)}><option value="right">Right</option><option value="left">Left</option></select></div>
              </div>
            </div>
          )}

          {activeTab === 'behavior' && (
            <div className="space-y-7 animate-in fade-in duration-300">
              <div><label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">System Prompt</label><textarea className="w-full p-3 border border-gray-200 rounded-md text-sm h-32 outline-none focus:border-black resize-none" value={config.systemPrompt} disabled={!isOwner} onChange={(e) => updateConfig('systemPrompt', e.target.value)} /></div>
              <div><label className="block text-[11px] font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">Bot Language</label><select className="w-full p-2.5 border border-gray-200 rounded-md text-sm outline-none focus:border-black bg-white" value={config.language} disabled={!isOwner} onChange={(e) => updateConfig('language', e.target.value)}><option value="Auto-detect">Auto-detect</option><option value="English">English</option><option value="Spanish">Spanish</option><option value="French">French</option><option value="German">German</option></select></div>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div><label className="block text-[11px] font-semibold text-gray-900 uppercase tracking-wider">Suggested Prompts</label><p className="text-xs text-gray-500 mt-0.5">Show helpful quick-replies.</p></div>
                  <label className="relative inline-flex items-center cursor-pointer"><input type="checkbox" className="sr-only peer" disabled={!isOwner} checked={config.showPrompts} onChange={(e) => updateConfig('showPrompts', e.target.checked)} /><div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-black"></div></label>
                </div>
                {config.showPrompts && (
                  <div className="space-y-3 p-4 bg-gray-50 rounded-md border border-gray-100">
                    <div className="flex gap-2"><input type="text" placeholder="Add a prompt..." disabled={!isOwner} className="flex-1 p-2 border border-gray-200 rounded-md text-sm outline-none focus:border-black" value={newPrompt} onChange={(e) => setNewPrompt(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddPrompt(); } }} /><button onClick={(e) => { e.preventDefault(); handleAddPrompt(); }} disabled={!newPrompt.trim() || !isOwner} className="px-3 bg-white border border-gray-200 text-gray-700 text-sm rounded-md">Add</button></div>
                    {config.suggestedPrompts.map(prompt => (
                      <span key={prompt} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-gray-200 rounded-md text-xs mr-2 mb-2"><span className="truncate max-w-[200px]">{prompt}</span><button onClick={() => handleRemovePrompt(prompt)} disabled={!isOwner} className="text-gray-400 hover:text-red-500"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button></span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between border-t border-gray-100 pt-6">
                <div><label className="block text-[11px] font-semibold text-gray-900 uppercase tracking-wider">Lead Capture</label><p className="text-xs text-gray-500 mt-0.5">Require name/email before chat.</p></div>
                <label className="relative inline-flex items-center cursor-pointer"><input type="checkbox" className="sr-only peer" disabled={!isOwner} checked={config.leadCaptureEnabled} onChange={(e) => updateConfig('leadCaptureEnabled', e.target.checked)} /><div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-black"></div></label>
              </div>
            </div>
          )}

          {activeTab === 'model' && (
            <div className="space-y-7 animate-in fade-in duration-300">
              <div><div className="flex justify-between mb-1.5"><label className="block text-[11px] font-semibold text-gray-900 uppercase tracking-wider">Temperature</label><span className="text-[11px] text-gray-500">{config.temperature}</span></div><input type="range" min="0" max="2" step="0.1" disabled={!isOwner} className="w-full accent-black" value={config.temperature} onChange={(e) => updateConfig('temperature', parseFloat(e.target.value))} /></div>
              <div className="border-t border-gray-100 pt-6"><div className="flex justify-between mb-1.5"><label className="block text-[11px] font-semibold text-gray-900 uppercase tracking-wider">Match Threshold</label><span className="text-[11px] text-gray-500">{config.matchThreshold}</span></div><input type="range" min="0" max="1" step="0.05" disabled={!isOwner} className="w-full accent-black" value={config.matchThreshold} onChange={(e) => updateConfig('matchThreshold', parseFloat(e.target.value))} /></div>
              <div className="border-t border-gray-100 pt-6"><label className="block text-[11px] font-semibold text-gray-900 uppercase tracking-wider mb-1.5">Reasoning Effort</label><select className="w-full p-2.5 border border-gray-200 rounded-md text-sm outline-none bg-white" value={config.reasoningEffort} disabled={!isOwner} onChange={(e) => updateConfig('reasoningEffort', e.target.value)}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></div>
              <div className="border-t border-gray-100 pt-6"><label className="block text-[11px] font-semibold text-gray-900 uppercase tracking-wider mb-1.5">Verbosity</label><select className="w-full p-2.5 border border-gray-200 rounded-md text-sm outline-none bg-white" value={config.verbosity} disabled={!isOwner} onChange={(e) => updateConfig('verbosity', e.target.value)}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></div>
            </div>
          )}

          {activeTab === 'install' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div><label className="block text-[11px] font-semibold text-gray-900 uppercase tracking-wider mb-1.5">Project ID</label><input type="text" readOnly className="w-full p-2.5 border border-gray-200 rounded-md text-sm bg-gray-50 text-gray-500 outline-none" value={config.spaceId} /></div>
              <div className="border-t border-gray-100 pt-6"><label className="block text-[11px] font-semibold text-gray-900 uppercase tracking-wider mb-1.5">Allowed Domains</label><input type="text" placeholder="example.com, localhost" className="w-full p-2.5 border border-gray-200 rounded-md text-sm outline-none bg-white" disabled={!isOwner} value={config.allowedDomains} onChange={(e) => updateConfig('allowedDomains', e.target.value)} /></div>
              <div className="border-t border-gray-100 pt-6"><label className="block text-[11px] font-semibold text-gray-900 uppercase tracking-wider mb-1.5">Deployment Script</label><textarea readOnly className="w-full p-4 border border-gray-200 rounded-md bg-gray-50 text-[11px] font-mono h-64 focus:outline-none" value={embedCode} onClick={(e) => { e.currentTarget.select(); navigator.clipboard.writeText(embedCode); toast.success('Copied!');}} /></div>
            </div>
          )}
        </div>
      </div>
      <div className="flex-1 p-8 flex flex-col items-center justify-center relative bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px]">
        {activeSpaceId && (
          <div className="w-[380px] h-[600px] bg-white rounded-2xl shadow-[0_20px_40px_-15px_rgba(0,0,0,0.15)] overflow-hidden border border-gray-200/50 animate-in fade-in zoom-in-95 duration-500">
            <iframe key={refreshKey} src={previewUrl} className="w-full h-full border-none bg-transparent" title="Widget Preview" />
          </div>
        )}
      </div>
    </div>
  );
}
