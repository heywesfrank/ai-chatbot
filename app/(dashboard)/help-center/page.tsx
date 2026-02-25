// app/(dashboard)/help-center/page.tsx
'use client';
import { useState, useEffect } from 'react';
import { supabaseClient as supabase } from '@/lib/supabase-client';
import { toast } from 'sonner';
import { useBotConfig } from '../BotConfigProvider';
import { FileTextIcon, PlusIcon, ArrowLeftIcon, ClearIcon } from '@/components/icons';

export default function HelpCenterPage() {
  const { activeSpaceId } = useBotConfig();
  const [articles, setArticles] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [isEditing, setIsEditing] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (activeSpaceId) fetchArticles();
  }, [activeSpaceId]);

  const fetchArticles = async () => {
    setIsLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const res = await fetch('/api/help-center', { headers: { 'Authorization': `Bearer ${session.access_token}` } });
    if (res.ok) {
      const data = await res.json();
      setArticles(data.articles || []);
    }
    setIsLoading(false);
  };

  const handleSave = async () => {
    if (!title.trim() || !content.trim()) return toast.error('Title and content are required.');
    setIsSaving(true);
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch('/api/help-center', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
      body: JSON.stringify({ id: currentId, spaceId: activeSpaceId, title, content })
    });
    setIsSaving(false);
    if (res.ok) {
      toast.success('Article saved & synced to AI!');
      setIsEditing(false);
      fetchArticles();
    } else {
      toast.error('Failed to save article.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this article?')) return;
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`/api/help-center?id=${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${session?.access_token}` }
    });
    if (res.ok) {
      toast.success('Article deleted.');
      fetchArticles();
    } else {
      toast.error('Failed to delete.');
    }
  };

  const openEditor = (article: any = null) => {
    if (article) {
      setCurrentId(article.id);
      setTitle(article.title);
      setContent(article.content);
    } else {
      setCurrentId(null);
      setTitle('');
      setContent('');
    }
    setIsEditing(true);
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

  if (isEditing) {
    return (
      <div className="flex flex-col h-full w-full bg-white text-gray-900 font-sans">
        <div className="flex items-center justify-between px-8 py-5 border-b border-gray-100 shrink-0 bg-white">
          <button onClick={() => setIsEditing(false)} className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors">
            <ArrowLeftIcon className="w-4 h-4" />
            Back to articles
          </button>
          <button onClick={handleSave} disabled={isSaving || !title.trim() || !content.trim()} className="px-5 py-2.5 bg-black text-white text-sm font-medium rounded-md hover:bg-gray-800 transition-colors disabled:opacity-50">
            {isSaving ? 'Saving...' : 'Save & Publish'}
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-8 flex flex-col max-w-4xl mx-auto w-full gap-4">
          <input 
            type="text" 
            placeholder="Article Title" 
            className="w-full text-3xl font-semibold text-gray-900 placeholder:text-gray-300 outline-none border-none bg-transparent"
            value={title}
            onChange={e => setTitle(e.target.value)}
          />
          <textarea 
            placeholder="Write your article content here... (Markdown supported)"
            className="w-full flex-1 resize-none text-base text-gray-700 leading-relaxed placeholder:text-gray-400 outline-none border-none bg-transparent mt-4"
            value={content}
            onChange={e => setContent(e.target.value)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full bg-[#FAFAFA] text-gray-900 font-sans overflow-y-auto">
      <div className="max-w-[1200px] mx-auto w-full p-8 pb-20">
        <div className="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-xl font-medium mb-1 tracking-tight">Help Center</h1>
            <p className="text-gray-500 text-sm leading-relaxed">Create and manage support articles. Saved articles automatically train your AI bot.</p>
          </div>
          <button onClick={() => openEditor()} className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-black text-white text-sm font-medium rounded-md hover:bg-gray-800 transition-colors">
             <PlusIcon className="w-4 h-4" />
             New Article
          </button>
        </div>

        <div className="bg-white border border-gray-200 rounded-sm overflow-hidden">
          {articles.length === 0 ? (
            <div className="p-12 text-center flex flex-col items-center justify-center">
              <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center border border-gray-100 mb-4">
                 <FileTextIcon className="w-6 h-6 text-gray-400" />
              </div>
              <h3 className="text-sm font-semibold text-gray-900 mb-1">No articles yet</h3>
              <p className="text-xs text-gray-500 max-w-xs mb-6 mx-auto">Write your first help center article to instantly train your AI and help your customers.</p>
              <button onClick={() => openEditor()} className="px-4 py-2 bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50 transition-colors">Create Article</button>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {articles.map((article) => (
                <div key={article.id} className="p-5 flex items-center justify-between hover:bg-gray-50/50 transition-colors group cursor-pointer" onClick={() => openEditor(article)}>
                  <div className="flex items-center gap-4 min-w-0 pr-4">
                     <div className="w-10 h-10 rounded-md bg-indigo-50/50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                       <FileTextIcon className="w-5 h-5" />
                     </div>
                     <div className="min-w-0">
                       <h4 className="text-sm font-semibold text-gray-900 truncate">{article.title}</h4>
                       <p className="text-xs text-gray-500 mt-1 truncate max-w-lg">
                         {article.content.substring(0, 100)}{article.content.length > 100 ? '...' : ''}
                       </p>
                     </div>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <span className="text-[11px] text-gray-400 font-medium">
                      {new Date(article.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleDelete(article.id); }}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-all opacity-0 group-hover:opacity-100 outline-none"
                      title="Delete article"
                    >
                      <ClearIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
