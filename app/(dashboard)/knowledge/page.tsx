// app/(dashboard)/knowledge/page.tsx
'use client';
import { useState, useEffect, useRef } from 'react';
import { supabaseClient as supabase } from '@/lib/supabase-client';
import { toast } from 'sonner';

export default function KnowledgeBasePage() {
  const [sources, setSources] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [activeSpaceId, setActiveSpaceId] = useState<string | null>(null);

  const [sourceType, setSourceType] = useState<'website' | 'gitbook' | 'file'>('website');
  const [inputValue, setInputValue] = useState('');
  const [gitbookToken, setGitbookToken] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchSources();
  }, []);

  const fetchSources = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    
    // Get active workspace ID
    const { data: config } = await supabase.from('bot_config').select('space_id').eq('user_id', session.user.id).maybeSingle();
    const spaceId = config?.space_id;
    if (spaceId) setActiveSpaceId(spaceId);

    const res = await fetch('/api/data-sources', { headers: { 'Authorization': `Bearer ${session.access_token}` } });
    if (res.ok) {
      const data = await res.json();
      setSources(data.sources || []);
    }
    setIsLoading(false);
  };

  const handleAddSource = async (payload: any) => {
    if (!activeSpaceId) return toast.error('Please configure your bot in the Workspace tab first.');
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    setIsSyncing(true);
    try {
      // 1. Sync data using the existing ingest logic
      const syncRes = await fetch('/api/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ ...payload, spaceId: activeSpaceId }),
      });

      if (!syncRes.ok) throw new Error((await syncRes.json()).error);

      // 2. Save source configuration to the database
      await fetch('/api/data-sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({
          spaceId: activeSpaceId,
          type: payload.type,
          sourceUri: payload.type === 'file' ? payload.filename : payload.url || payload.gitbookSpaceId,
          credentials: payload.type === 'gitbook' ? { api_key: payload.apiKey } : null
        })
      });

      toast.success('Source synced and added successfully.');
      setInputValue('');
      setGitbookToken('');
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

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-[#FAFAFA]">
        <div className="flex space-x-1">
          <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-pulse" />
          <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-pulse delay-75" />
          <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-pulse delay-150" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full bg-[#FAFAFA] text-gray-900 font-sans overflow-y-auto">
      <div className="max-w-[1200px] mx-auto w-full p-8 pb-20">
        <div className="mb-8">
          <h1 className="text-xl font-medium mb-1 tracking-tight">Knowledge Base</h1>
          <p className="text-gray-500 text-sm leading-relaxed">Add data sources for your bot to learn from.</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-sm p-6 mb-8 shadow-sm">
          <div className="flex space-x-2 bg-gray-50 p-1 rounded-lg border border-gray-200 mb-6 max-w-sm">
            {(['website', 'gitbook', 'file'] as const).map(tab => (
              <button key={tab} onClick={() => setSourceType(tab)} className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${sourceType === tab ? 'bg-white shadow-sm text-gray-900 border border-gray-200/50' : 'text-gray-500 hover:text-gray-700'}`}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          {sourceType === 'website' && (
            <div className="flex gap-3 max-w-md">
              <input type="url" placeholder="https://example.com/sitemap.xml" className="flex-1 p-2.5 border border-gray-200 rounded-sm text-sm outline-none focus:border-black transition-colors" value={inputValue} onChange={(e) => setInputValue(e.target.value)} />
              <button onClick={() => handleAddSource({ type: 'website', url: inputValue })} disabled={isSyncing || !inputValue} className="px-5 bg-black text-white text-sm font-medium rounded-sm hover:bg-gray-800 disabled:opacity-50 transition-colors shadow-sm">
                {isSyncing ? 'Crawling...' : 'Add'}
              </button>
            </div>
          )}

          {sourceType === 'gitbook' && (
            <div className="flex flex-col gap-3 max-w-md">
              <input type="text" placeholder="GitBook Space ID" className="w-full p-2.5 border border-gray-200 rounded-sm text-sm outline-none focus:border-black transition-colors" value={inputValue} onChange={(e) => setInputValue(e.target.value)} />
              <input type="password" placeholder="GitBook API Token" className="w-full p-2.5 border border-gray-200 rounded-sm text-sm outline-none focus:border-black transition-colors" value={gitbookToken} onChange={(e) => setGitbookToken(e.target.value)} />
              <button onClick={() => handleAddSource({ type: 'gitbook', gitbookSpaceId: inputValue, apiKey: gitbookToken })} disabled={isSyncing || !inputValue || !gitbookToken} className="self-end px-5 py-2.5 bg-black text-white text-sm font-medium rounded-sm hover:bg-gray-800 disabled:opacity-50 transition-colors shadow-sm">
                {isSyncing ? 'Syncing...' : 'Add Gitbook'}
              </button>
            </div>
          )}

          {sourceType === 'file' && (
            <div>
              <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept=".txt,.csv,.json" />
              <button onClick={() => fileInputRef.current?.click()} disabled={isSyncing} className="px-5 py-2.5 bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-sm hover:bg-gray-50 transition-colors shadow-sm disabled:opacity-50">
                {isSyncing ? 'Uploading...' : 'Upload Document (.txt, .csv, .json)'}
              </button>
            </div>
          )}
        </div>

        <div className="bg-white border border-gray-200 rounded-sm">
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
                    <p className="text-sm font-medium text-gray-900 capitalize">{src.type}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{src.source_uri}</p>
                  </div>
                  <button onClick={() => removeSource(src.id)} className="text-sm text-red-500 hover:text-red-700 font-medium transition-colors">Remove</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
