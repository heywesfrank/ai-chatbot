// app/(dashboard)/knowledge/page.tsx
'use client';
import { useState, useEffect, useRef } from 'react';
import { useBotConfig } from '../BotConfigProvider';
import { supabaseClient as supabase } from '@/lib/supabase-client';
import { toast } from 'sonner';

export default function KnowledgeBasePage() {
  const { activeSpaceId } = useBotConfig();
  const [sources, setSources] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  const [sourceType, setSourceType] = useState<'website' | 'gitbook' | 'file' | 'notion' | 'gdrive' | 'zendesk'>('website');
  
  // Shared & specific inputs
  const [inputValue, setInputValue] = useState('');
  const [gitbookToken, setGitbookToken] = useState('');
  const [notionToken, setNotionToken] = useState('');
  const [gdriveToken, setGdriveToken] = useState('');
  const [zendeskEmail, setZendeskEmail] = useState('');
  const [zendeskToken, setZendeskToken] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (activeSpaceId) fetchSources();
  }, [activeSpaceId]);

  const fetchSources = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const res = await fetch('/api/data-sources', { headers: { 'Authorization': `Bearer ${session.access_token}` } });
    if (res.ok) {
      const data = await res.json();
      setSources(data.sources || []);
    }
    setIsLoading(false);
  };

  const handleAddSource = async (payload: any) => {
    if (!activeSpaceId) return toast.error('Workspace initializing...');
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    setIsSyncing(true);
    try {
      const syncRes = await fetch('/api/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ ...payload, spaceId: activeSpaceId }),
      });

      if (!syncRes.ok) throw new Error((await syncRes.json()).error);

      // Determine URI and Credentials based on type for DB tracking
      let sourceUri = payload.url || payload.gitbookSpaceId || payload.pageId || payload.folderId || payload.subdomain || payload.filename;
      let credentials = null;

      if (payload.type === 'gitbook') credentials = { api_key: payload.apiKey };
      if (payload.type === 'notion') credentials = { api_key: payload.token };
      if (payload.type === 'gdrive') credentials = { api_key: payload.token };
      if (payload.type === 'zendesk') credentials = { email: payload.email, api_key: payload.token };

      await fetch('/api/data-sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({
          spaceId: activeSpaceId,
          type: payload.type,
          sourceUri,
          credentials
        })
      });

      toast.success('Source synced and added successfully.');
      setInputValue('');
      setGitbookToken('');
      setNotionToken('');
      setGdriveToken('');
      setZendeskEmail('');
      setZendeskToken('');
      fetchSources();
    } catch (e: any) {
      toast.error(e.message || 'Failed to add source');
    } finally {
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
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await fetch(`/api/data-sources?id=${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${session.access_token}` } });
    fetchSources();
    toast.success('Data source removed.');
  };

  if (isLoading) return null;

  return (
    <div className="p-8 pb-20 max-w-[800px] animate-in fade-in duration-300">
      <div className="mb-8">
        <h1 className="text-xl font-semibold tracking-tight text-gray-900">Knowledge Base</h1>
        <p className="text-sm text-gray-500 mt-1 leading-relaxed">Add data sources for your bot to learn from. Upload text docs, crawl websites, or connect your tools directly.</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-md p-6 mb-8 shadow-sm">
        <div className="flex flex-wrap gap-2 bg-gray-50 p-1.5 rounded-lg border border-gray-200 mb-6">
          {(['website', 'gitbook', 'file', 'notion', 'gdrive', 'zendesk'] as const).map(tab => (
            <button key={tab} onClick={() => { setSourceType(tab); setInputValue(''); }} className={`flex-1 min-w-[80px] py-1.5 px-2 text-xs font-semibold rounded-md transition-all ${sourceType === tab ? 'bg-white shadow-sm text-gray-900 border border-gray-200/50' : 'text-gray-500 hover:text-gray-700'}`}>
              {tab === 'gdrive' ? 'Drive' : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {sourceType === 'website' && (
          <div className="flex gap-3 max-w-md">
            <input type="url" placeholder="https://example.com/sitemap.xml" className="flex-1 p-2.5 border border-gray-200 rounded-md text-sm outline-none focus:border-black transition-colors shadow-sm" value={inputValue} onChange={(e) => setInputValue(e.target.value)} />
            <button onClick={() => handleAddSource({ type: 'website', url: inputValue })} disabled={isSyncing || !inputValue} className="px-5 bg-black text-white text-sm font-medium rounded-md hover:bg-gray-800 disabled:opacity-50 transition-colors shadow-sm">
              {isSyncing ? 'Crawling...' : 'Add'}
            </button>
          </div>
        )}

        {sourceType === 'gitbook' && (
          <div className="flex flex-col gap-3 max-w-md">
            <input type="text" placeholder="GitBook Space ID" className="w-full p-2.5 border border-gray-200 rounded-md text-sm outline-none focus:border-black transition-colors shadow-sm" value={inputValue} onChange={(e) => setInputValue(e.target.value)} />
            <input type="password" placeholder="GitBook API Token" className="w-full p-2.5 border border-gray-200 rounded-md text-sm outline-none focus:border-black transition-colors shadow-sm" value={gitbookToken} onChange={(e) => setGitbookToken(e.target.value)} />
            <button onClick={() => handleAddSource({ type: 'gitbook', gitbookSpaceId: inputValue, apiKey: gitbookToken })} disabled={isSyncing || !inputValue || !gitbookToken} className="self-end px-5 py-2.5 bg-black text-white text-sm font-medium rounded-md hover:bg-gray-800 disabled:opacity-50 transition-colors shadow-sm">
              {isSyncing ? 'Syncing...' : 'Add Gitbook'}
            </button>
          </div>
        )}

        {sourceType === 'notion' && (
          <div className="flex flex-col gap-3 max-w-md">
            <input type="text" placeholder="Notion Root Page ID" className="w-full p-2.5 border border-gray-200 rounded-md text-sm outline-none focus:border-black transition-colors shadow-sm" value={inputValue} onChange={(e) => setInputValue(e.target.value)} />
            <input type="password" placeholder="Internal Integration Token" className="w-full p-2.5 border border-gray-200 rounded-md text-sm outline-none focus:border-black transition-colors shadow-sm" value={notionToken} onChange={(e) => setNotionToken(e.target.value)} />
            <button onClick={() => handleAddSource({ type: 'notion', pageId: inputValue, token: notionToken })} disabled={isSyncing || !inputValue || !notionToken} className="self-end px-5 py-2.5 bg-black text-white text-sm font-medium rounded-md hover:bg-gray-800 disabled:opacity-50 transition-colors shadow-sm">
              {isSyncing ? 'Syncing...' : 'Add Notion'}
            </button>
          </div>
        )}

        {sourceType === 'gdrive' && (
          <div className="flex flex-col gap-3 max-w-md">
            <input type="text" placeholder="Google Drive Folder ID" className="w-full p-2.5 border border-gray-200 rounded-md text-sm outline-none focus:border-black transition-colors shadow-sm" value={inputValue} onChange={(e) => setInputValue(e.target.value)} />
            <input type="password" placeholder="Google Access Token" className="w-full p-2.5 border border-gray-200 rounded-md text-sm outline-none focus:border-black transition-colors shadow-sm" value={gdriveToken} onChange={(e) => setGdriveToken(e.target.value)} />
            <button onClick={() => handleAddSource({ type: 'gdrive', folderId: inputValue, token: gdriveToken })} disabled={isSyncing || !inputValue || !gdriveToken} className="self-end px-5 py-2.5 bg-black text-white text-sm font-medium rounded-md hover:bg-gray-800 disabled:opacity-50 transition-colors shadow-sm">
              {isSyncing ? 'Syncing...' : 'Add Drive Folder'}
            </button>
          </div>
        )}

        {sourceType === 'zendesk' && (
          <div className="flex flex-col gap-3 max-w-md">
            <input type="text" placeholder="Zendesk Subdomain (e.g., 'mycompany')" className="w-full p-2.5 border border-gray-200 rounded-md text-sm outline-none focus:border-black transition-colors shadow-sm" value={inputValue} onChange={(e) => setInputValue(e.target.value)} />
            <input type="email" placeholder="Agent Email" className="w-full p-2.5 border border-gray-200 rounded-md text-sm outline-none focus:border-black transition-colors shadow-sm" value={zendeskEmail} onChange={(e) => setZendeskEmail(e.target.value)} />
            <input type="password" placeholder="Zendesk API Token" className="w-full p-2.5 border border-gray-200 rounded-md text-sm outline-none focus:border-black transition-colors shadow-sm" value={zendeskToken} onChange={(e) => setZendeskToken(e.target.value)} />
            <button onClick={() => handleAddSource({ type: 'zendesk', subdomain: inputValue, email: zendeskEmail, token: zendeskToken })} disabled={isSyncing || !inputValue || !zendeskEmail || !zendeskToken} className="self-end px-5 py-2.5 bg-black text-white text-sm font-medium rounded-md hover:bg-gray-800 disabled:opacity-50 transition-colors shadow-sm">
              {isSyncing ? 'Syncing...' : 'Add Zendesk'}
            </button>
          </div>
        )}

        {sourceType === 'file' && (
          <div>
            <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept=".txt,.csv,.json" />
            <button onClick={() => fileInputRef.current?.click()} disabled={isSyncing} className="px-5 py-2.5 bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50 transition-colors shadow-sm disabled:opacity-50">
              {isSyncing ? 'Uploading...' : 'Upload Document (.txt, .csv, .json)'}
            </button>
          </div>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-md shadow-sm">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Active Sources</h2>
        </div>
        {sources.length === 0 ? (
          <div className="p-10 text-center text-sm text-gray-500">
            No data sources added yet.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {sources.map(src => (
              <div key={src.id} className="p-6 flex justify-between items-center hover:bg-gray-50/50 transition-colors">
                <div>
                  <p className="text-sm font-semibold text-gray-900 capitalize">{src.type}</p>
                  <p className="text-xs text-gray-500 mt-1 font-medium max-w-xs truncate">{src.source_uri}</p>
                </div>
                <button onClick={() => removeSource(src.id)} className="text-sm text-red-500 hover:text-red-700 font-medium transition-colors bg-red-50 px-3 py-1.5 rounded-md">Remove</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
