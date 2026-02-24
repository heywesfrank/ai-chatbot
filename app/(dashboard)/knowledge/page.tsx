// app/(dashboard)/knowledge/page.tsx
'use client';
import { useState, useEffect, useRef } from 'react';
import { useBotConfig } from '../BotConfigProvider';
import { supabaseClient as supabase } from '@/lib/supabase-client';
import { toast } from 'sonner';

// Define a type for our source items to handle the UI state
type DataSource = {
  id: string;
  type: string;
  source_uri: string;
  created_at?: string;
  status?: 'active' | 'syncing' | 'error'; 
};

export default function KnowledgeBasePage() {
  const { activeSpaceId } = useBotConfig();
  const [sources, setSources] = useState<DataSource[]>([]);
  const [isFetchingSources, setIsFetchingSources] = useState(true);
  
  // We keep isSyncing for the global form disabled state, 
  // but individual items track their own status via the sources array
  const [isSyncing, setIsSyncing] = useState(false);

  const [sourceType, setSourceType] = useState<'website' | 'gitbook' | 'file' | 'notion' | 'gdrive' | 'zendesk'>('website');
  
  const [inputValue, setInputValue] = useState('');
  const [gitbookToken, setGitbookToken] = useState('');
  const [notionToken, setNotionToken] = useState('');
  const [gdriveToken, setGdriveToken] = useState('');
  const [zendeskEmail, setZendeskEmail] = useState('');
  const [zendeskToken, setZendeskToken] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (activeSpaceId) {
      fetchSources();
    } else {
      setIsFetchingSources(false);
    }
  }, [activeSpaceId]);

  const fetchSources = async () => {
    setIsFetchingSources(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setIsFetchingSources(false);
      return;
    }
    const res = await fetch('/api/data-sources', { headers: { 'Authorization': `Bearer ${session.access_token}` } });
    if (res.ok) {
      const data = await res.json();
      setSources(data.sources || []);
    }
    setIsFetchingSources(false);
  };

  const handleAddSource = async (payload: any) => {
    if (!activeSpaceId) return toast.error('Workspace initializing...');
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    setIsSyncing(true);
    let tempId: string | null = null;

    try {
      let sourceUri = payload.url || payload.gitbookSpaceId || payload.pageId || payload.folderId || payload.subdomain || payload.filename;
      let credentials = null;

      if (payload.type === 'gitbook') credentials = { api_key: payload.apiKey };
      if (payload.type === 'notion') credentials = { api_key: payload.token };
      if (payload.type === 'gdrive') credentials = { api_key: payload.token };
      if (payload.type === 'zendesk') credentials = { email: payload.email, api_key: payload.token };

      // 1. Insert into data_sources and get the ID back
      const dsRes = await fetch('/api/data-sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({
          spaceId: activeSpaceId,
          type: payload.type,
          sourceUri,
          credentials
        })
      });
      
      const dsData = await dsRes.json();
      if (dsData.error) throw new Error(dsData.error);
      const newDataSourceId = dsData.id;
      tempId = newDataSourceId;

      // Optimistically update UI to show "Syncing..."
      // We manually add the new source to the list with a 'syncing' status
      const newSource: DataSource = {
        id: newDataSourceId,
        type: payload.type,
        source_uri: sourceUri,
        created_at: new Date().toISOString(),
        status: 'syncing' 
      };
      
      setSources(prev => [newSource, ...prev]);

      // Reset form inputs immediately for better UX
      setInputValue('');
      setGitbookToken('');
      setNotionToken('');
      setGdriveToken('');
      setZendeskEmail('');
      setZendeskToken('');

      // 2. Start the heavy ingestion job
      const syncRes = await fetch('/api/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ ...payload, spaceId: activeSpaceId, dataSourceId: newDataSourceId }),
      });

      if (!syncRes.ok) {
        if (syncRes.status === 504) {
          toast.success('Syncing continuing in background.');
        } else {
          const errData = await syncRes.json();
          throw new Error(errData.error || 'Failed to sync source');
        }
      } else {
        toast.success('Source synced successfully.');
      }

    } catch (e: any) {
      toast.error(e.message || 'Failed to add source');
      // If ingestion failed, we might want to remove it from the list or mark as error
      // For now, refreshing the list will show the true state (which might be the source exists but has no docs, or was deleted if logic dictates)
    } finally {
      // 3. Always refresh the full list from DB to get the final canonical state
      await fetchSources();
      setIsSyncing(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      if (text) handleAddSource({ type: 'file', text, filename: file.name });
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeSource = async (id: string) => {
    // Optimistic remove
    setSources(prev => prev.filter(s => s.id !== id));
    
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    
    try {
      await fetch(`/api/data-sources?id=${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${session.access_token}` } });
      toast.success('Data source removed.');
      fetchSources();
    } catch (e) {
      toast.error('Failed to remove source.');
      fetchSources(); // Revert on error
    }
  };

  const tabs = [
    { id: 'website', label: 'Website' },
    { id: 'file', label: 'File Upload' },
    { id: 'gitbook', label: 'GitBook' },
    { id: 'notion', label: 'Notion' },
    { id: 'gdrive', label: 'Google Drive' },
    { id: 'zendesk', label: 'Zendesk' }
  ] as const;

  return (
    <div className="p-8 pb-20 animate-in fade-in duration-300">
      <div className="mb-8">
        <h1 className="text-xl font-semibold tracking-tight text-gray-900">Knowledge Base</h1>
        <p className="text-sm text-gray-500 mt-1 leading-relaxed">Add data sources for your bot to learn from. Upload text docs, crawl websites, or connect your tools directly.</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg mb-8 overflow-hidden">
        <div className="flex border-b border-gray-100 overflow-x-auto no-scrollbar">
          {tabs.map(tab => (
            <button 
              key={tab.id} 
              onClick={() => { setSourceType(tab.id as any); setInputValue(''); }} 
              className={`px-5 py-4 text-sm font-medium transition-colors whitespace-nowrap border-b-2 flex-1 text-center outline-none ${sourceType === tab.id ? 'border-black text-black bg-gray-50/50' : 'border-transparent text-gray-500 hover:text-gray-900 hover:bg-gray-50'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        
        <div className="p-6">
          {sourceType === 'website' && (
            <div className="flex flex-col gap-4 max-w-2xl">
              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">Website URL</label>
                <div className="flex gap-3">
                  <input type="url" placeholder="https://example.com/sitemap.xml" className="flex-1 p-2.5 border border-gray-200 rounded-md text-sm outline-none focus:border-black transition-colors bg-white" value={inputValue} onChange={(e) => setInputValue(e.target.value)} />
                  <button onClick={() => handleAddSource({ type: 'website', url: inputValue })} disabled={isSyncing || !inputValue} className="px-6 bg-black text-white text-sm font-medium rounded-md hover:bg-gray-800 disabled:opacity-50 transition-colors">
                    {isSyncing ? 'Processing...' : 'Sync URL'}
                  </button>
                </div>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">Provide a link to your website's sitemap.xml to crawl multiple pages, or a direct link to a single page.</p>
            </div>
          )}

          {sourceType === 'file' && (
            <div className="flex flex-col gap-4 max-w-2xl">
              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">Upload Document</label>
                <div className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center bg-gray-50/50 hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                  <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept=".txt,.csv,.json" />
                  <div className="w-10 h-10 bg-white border border-gray-200 rounded-full flex items-center justify-center mx-auto mb-3">
                    <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                  </div>
                  <p className="text-sm font-medium text-gray-900 mb-1">{isSyncing ? 'Uploading...' : 'Click to upload or drag and drop'}</p>
                  <p className="text-xs text-gray-500">Supports .txt, .csv, and .json files</p>
                </div>
              </div>
            </div>
          )}

          {sourceType === 'gitbook' && (
            <div className="flex flex-col gap-4 max-w-2xl">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">Space ID</label>
                  <input type="text" placeholder="e.g. -Mxx_xxxxxxxxx" className="w-full p-2.5 border border-gray-200 rounded-md text-sm outline-none focus:border-black transition-colors bg-white" value={inputValue} onChange={(e) => setInputValue(e.target.value)} />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">API Token</label>
                  <input type="password" placeholder="gb_api_..." className="w-full p-2.5 border border-gray-200 rounded-md text-sm outline-none focus:border-black transition-colors bg-white" value={gitbookToken} onChange={(e) => setGitbookToken(e.target.value)} />
                </div>
              </div>
              <button onClick={() => handleAddSource({ type: 'gitbook', gitbookSpaceId: inputValue, apiKey: gitbookToken })} disabled={isSyncing || !inputValue || !gitbookToken} className="self-start px-6 py-2.5 bg-black text-white text-sm font-medium rounded-md hover:bg-gray-800 disabled:opacity-50 transition-colors">
                {isSyncing ? 'Syncing...' : 'Connect GitBook'}
              </button>
            </div>
          )}

          {sourceType === 'notion' && (
            <div className="flex flex-col gap-4 max-w-2xl">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">Root Page ID</label>
                  <input type="text" placeholder="32-character ID" className="w-full p-2.5 border border-gray-200 rounded-md text-sm outline-none focus:border-black transition-colors bg-white" value={inputValue} onChange={(e) => setInputValue(e.target.value)} />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">Integration Token</label>
                  <input type="password" placeholder="secret_..." className="w-full p-2.5 border border-gray-200 rounded-md text-sm outline-none focus:border-black transition-colors bg-white" value={notionToken} onChange={(e) => setNotionToken(e.target.value)} />
                </div>
              </div>
              <button onClick={() => handleAddSource({ type: 'notion', pageId: inputValue, token: notionToken })} disabled={isSyncing || !inputValue || !notionToken} className="self-start px-6 py-2.5 bg-black text-white text-sm font-medium rounded-md hover:bg-gray-800 disabled:opacity-50 transition-colors">
                {isSyncing ? 'Syncing...' : 'Connect Notion'}
              </button>
            </div>
          )}

          {sourceType === 'gdrive' && (
            <div className="flex flex-col gap-4 max-w-2xl">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">Folder ID</label>
                  <input type="text" placeholder="Folder ID from URL" className="w-full p-2.5 border border-gray-200 rounded-md text-sm outline-none focus:border-black transition-colors bg-white" value={inputValue} onChange={(e) => setInputValue(e.target.value)} />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">Access Token</label>
                  <input type="password" placeholder="ya29..." className="w-full p-2.5 border border-gray-200 rounded-md text-sm outline-none focus:border-black transition-colors bg-white" value={gdriveToken} onChange={(e) => setGdriveToken(e.target.value)} />
                </div>
              </div>
              <button onClick={() => handleAddSource({ type: 'gdrive', folderId: inputValue, token: gdriveToken })} disabled={isSyncing || !inputValue || !gdriveToken} className="self-start px-6 py-2.5 bg-black text-white text-sm font-medium rounded-md hover:bg-gray-800 disabled:opacity-50 transition-colors">
                {isSyncing ? 'Syncing...' : 'Connect Google Drive'}
              </button>
            </div>
          )}

          {sourceType === 'zendesk' && (
            <div className="flex flex-col gap-4 max-w-2xl">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">Subdomain</label>
                  <input type="text" placeholder="e.g. mycompany" className="w-full p-2.5 border border-gray-200 rounded-md text-sm outline-none focus:border-black transition-colors bg-white" value={inputValue} onChange={(e) => setInputValue(e.target.value)} />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">Agent Email</label>
                  <input type="email" placeholder="agent@example.com" className="w-full p-2.5 border border-gray-200 rounded-md text-sm outline-none focus:border-black transition-colors bg-white" value={zendeskEmail} onChange={(e) => setZendeskEmail(e.target.value)} />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">API Token</label>
                  <input type="password" placeholder="Token..." className="w-full p-2.5 border border-gray-200 rounded-md text-sm outline-none focus:border-black transition-colors bg-white" value={zendeskToken} onChange={(e) => setZendeskToken(e.target.value)} />
                </div>
              </div>
              <button onClick={() => handleAddSource({ type: 'zendesk', subdomain: inputValue, email: zendeskEmail, token: zendeskToken })} disabled={isSyncing || !inputValue || !zendeskEmail || !zendeskToken} className="self-start px-6 py-2.5 bg-black text-white text-sm font-medium rounded-md hover:bg-gray-800 disabled:opacity-50 transition-colors">
                {isSyncing ? 'Syncing...' : 'Connect Zendesk'}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/30">
          <h2 className="text-sm font-semibold text-gray-900">Active Sources</h2>
          {isFetchingSources && <div className="w-4 h-4 border-2 border-gray-300 border-t-black rounded-full animate-spin"></div>}
        </div>
        
        {sources.length === 0 && !isFetchingSources ? (
          <div className="p-12 text-center text-sm text-gray-500 flex flex-col items-center">
            <svg className="w-8 h-8 text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
            <p>No data sources added yet.</p>
            <p className="text-xs text-gray-400 mt-1">Connect a source above to train your bot.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {sources.map(src => {
              const isItemSyncing = src.status === 'syncing';
              return (
                <div key={src.id} className="p-4 sm:px-6 flex justify-between items-center hover:bg-gray-50/50 transition-colors group">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center shrink-0">
                      {src.type === 'website' && <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>}
                      {src.type === 'file' && <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>}
                      {['gitbook', 'notion', 'gdrive', 'zendesk'].includes(src.type) && <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>}
                    </div>
                    <div className="min-w-0 pr-4">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-gray-900 capitalize">{src.type === 'gdrive' ? 'Google Drive' : src.type}</p>
                        {isItemSyncing && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-800">
                             Syncing...
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5 font-medium truncate" title={src.source_uri}>{src.source_uri}</p>
                    </div>
                  </div>
                  
                  {isItemSyncing ? (
                    <div className="px-3 py-1.5 flex items-center gap-2">
                      <div className="w-3.5 h-3.5 border-2 border-gray-300 border-t-black rounded-full animate-spin"></div>
                      <span className="text-xs text-gray-400 font-medium">Syncing</span>
                    </div>
                  ) : (
                    <button onClick={() => removeSource(src.id)} className="text-xs text-red-500 hover:text-red-700 font-medium transition-colors bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-md shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100">
                      Remove
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
