// app/(dashboard)/help-center/page.tsx
'use client';
import { useState, useEffect, useMemo } from 'react';
import { supabaseClient as supabase } from '@/lib/supabase-client';
import { toast } from 'sonner';
import { useBotConfig } from '../BotConfigProvider';
import { FileTextIcon, PlusIcon, ClearIcon, ExternalLinkIcon, EyeIcon, SmileIcon, FrownIcon, PaletteIcon } from '@/components/icons';
import HelpCenterEditor from './HelpCenterEditor';

export default function HelpCenterPage() {
  const { activeSpaceId, config, updateConfig, saveConfig, isSaving, isOwner, hasUnsavedChanges } = useBotConfig();
  const [articles, setArticles] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // List filters/sort state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [sortBy, setSortBy] = useState<'updated' | 'alpha' | 'category'>('updated');

  // Editor & Settings state
  const [isEditing, setIsEditing] = useState(false);
  const [editingArticle, setEditingArticle] = useState<any>(null);
  const [isAppearanceOpen, setIsAppearanceOpen] = useState(false);
  const [isUploadingBg, setIsUploadingBg] = useState(false);

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

  const handleBgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    setIsUploadingBg(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `help_center_bg/${config.spaceId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('chat_attachments')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('chat_attachments').getPublicUrl(fileName);
      updateConfig('helpCenterBgImage', data.publicUrl);
      toast.success('Background image updated');
    } catch (error) {
      toast.error('Failed to upload background');
    } finally {
      setIsUploadingBg(false);
    }
  };

  const allCategories = useMemo(() => {
    const cats = Array.from(new Set(articles.map(a => a.category || 'General'))).sort();
    return cats;
  }, [articles]);

  const displayedArticles = useMemo(() => {
    let list = [...articles];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(a => a.title.toLowerCase().includes(q));
    }

    if (filterCategory) {
      list = list.filter(a => (a.category || 'General') === filterCategory);
    }

    if (sortBy === 'updated') {
      list.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    } else if (sortBy === 'alpha') {
      list.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortBy === 'category') {
      list.sort((a, b) => (a.category || 'General').localeCompare(b.category || 'General'));
    }

    return list;
  }, [articles, searchQuery, filterCategory, sortBy]);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this article?')) return;
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`/api/help-center?id=${id}&spaceId=${activeSpaceId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${session?.access_token}` }
    });
    if (res.ok) { toast.success('Article deleted.'); fetchArticles(); }
    else toast.error('Failed to delete.');
  };

  const openEditor = (article: any = null) => {
    setEditingArticle(article);
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
      <HelpCenterEditor
        article={editingArticle}
        activeSpaceId={activeSpaceId}
        allCategories={allCategories}
        allArticles={articles}
        onClose={() => setIsEditing(false)}
        onSuccess={fetchArticles}
      />
    );
  }

  return (
    <div className="flex flex-col h-full w-full bg-[#FAFAFA] text-gray-900 font-sans overflow-y-auto">
      <div className="max-w-[1200px] mx-auto w-full p-8 pb-20">
        <div className="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-xl font-medium mb-1 tracking-tight">Help Center</h1>
            <p className="text-gray-500 text-sm leading-relaxed">Create and manage support articles. Published articles sync seamlessly to your AI agent.</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setIsAppearanceOpen(!isAppearanceOpen)} className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50 transition-colors">
              <PaletteIcon className="w-4 h-4" />
              Customize Appearance
            </button>
            <a href={`/help/${activeSpaceId}`} target="_blank" className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50 transition-colors">
              <ExternalLinkIcon className="w-4 h-4" />
              View Portal
            </a>
            <button onClick={() => openEditor()} className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-black text-white text-sm font-medium rounded-md hover:bg-gray-800 transition-colors">
              <PlusIcon className="w-4 h-4" />
              New Article
            </button>
          </div>
        </div>

        {isAppearanceOpen && (
          <div className="bg-white border border-gray-200 p-6 rounded-md mb-6 shadow-sm animate-in fade-in duration-200">
            <div className="flex justify-between items-center mb-4 border-b border-gray-100 pb-3">
               <h2 className="text-sm font-semibold text-gray-900">Help Center Appearance</h2>
               <button onClick={() => setIsAppearanceOpen(false)} className="text-gray-400 hover:text-gray-900">
                 <ClearIcon className="w-4 h-4" />
               </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-2">Hero Background Color</label>
                  <div className="flex items-center gap-3">
                    <div className="relative w-10 h-10 rounded-md overflow-hidden border border-gray-200 shrink-0 cursor-pointer shadow-sm">
                      <input type="color" className="absolute -top-2 -left-2 w-16 h-16 cursor-pointer" disabled={!isOwner} value={config.helpCenterColor || config.primaryColor || '#000000'} onChange={(e) => updateConfig('helpCenterColor', e.target.value)} />
                    </div>
                    <input type="text" className="w-full max-w-[200px] p-2.5 border border-gray-200 rounded-md text-sm outline-none focus:border-black uppercase transition-colors font-mono" disabled={!isOwner} value={config.helpCenterColor || config.primaryColor || '#000000'} onChange={(e) => updateConfig('helpCenterColor', e.target.value)} />
                  </div>
               </div>
               <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-2">Hero Background Image</label>
                  <div className="flex items-center gap-4">
                     {config.helpCenterBgImage && (
                        <div className="relative w-20 h-12 rounded-md border border-gray-200 overflow-hidden bg-gray-50">
                           <img src={config.helpCenterBgImage} alt="bg" className="w-full h-full object-cover" />
                        </div>
                     )}
                     <label className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer transition-colors shadow-sm">
                       <span>{isUploadingBg ? 'Uploading...' : 'Upload Image'}</span>
                       <input type="file" accept="image/*" className="hidden" disabled={!isOwner || isUploadingBg} onChange={handleBgUpload} />
                     </label>
                     {config.helpCenterBgImage && (
                        <button onClick={() => updateConfig('helpCenterBgImage', '')} className="text-xs text-red-500 hover:text-red-700 font-medium">Remove</button>
                     )}
                  </div>
               </div>
            </div>
            <div className="mt-6 flex justify-end">
               <button onClick={saveConfig} disabled={!isOwner || isSaving || !hasUnsavedChanges} className="px-5 py-2.5 bg-black text-white text-sm font-medium rounded-md hover:bg-gray-800 transition-colors disabled:opacity-50">
                 {isSaving ? 'Saving...' : 'Save Appearance'}
               </button>
            </div>
          </div>
        )}

        {articles.length > 0 && (
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <input
              type="text"
              placeholder="Search articles..."
              className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-md bg-white outline-none focus:border-black transition-colors"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            <select
              className="px-3 py-2 text-sm border border-gray-200 rounded-md bg-white outline-none focus:border-black transition-colors cursor-pointer"
              value={filterCategory}
              onChange={e => setFilterCategory(e.target.value)}
            >
              <option value="">All Categories</option>
              {allCategories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            <select
              className="px-3 py-2 text-sm border border-gray-200 rounded-md bg-white outline-none focus:border-black transition-colors cursor-pointer"
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
            >
              <option value="updated">Last Updated</option>
              <option value="alpha">Alphabetical</option>
              <option value="category">Category</option>
            </select>
          </div>
        )}

        <div className="bg-white border border-gray-200 rounded-sm overflow-hidden">
          {articles.length === 0 ? (
            <div className="p-12 text-center flex flex-col items-center justify-center">
              <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center border border-gray-100 mb-4">
                <FileTextIcon className="w-6 h-6 text-gray-400" />
              </div>
              <h3 className="text-sm font-semibold text-gray-900 mb-1">No articles yet</h3>
              <p className="text-xs text-gray-500 max-w-xs mb-6 mx-auto">Write your first help center article to instantly train your AI and generate a public knowledge base.</p>
              <button onClick={() => openEditor()} className="px-4 py-2 bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50 transition-colors">Create Article</button>
            </div>
          ) : displayedArticles.length === 0 ? (
            <div className="p-10 text-center text-sm text-gray-500">
              No articles match your search.
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {displayedArticles.map((article) => (
                <div key={article.id} className="p-5 flex items-center justify-between hover:bg-gray-50/50 transition-colors group cursor-pointer" onClick={() => openEditor(article)}>
                  <div className="flex items-center gap-4 min-w-0 pr-4">
                    <div className="w-10 h-10 rounded-md bg-indigo-50/50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                      <FileTextIcon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex flex-col justify-center">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-sm font-semibold text-gray-900 truncate">{article.title}</h4>
                        {article.status === 'draft' && (
                          <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-sm font-bold uppercase tracking-wide shrink-0">Draft</span>
                        )}
                        {article.status === 'archived' && (
                          <span className="text-[10px] bg-gray-200 text-gray-700 px-2 py-0.5 rounded-sm font-bold uppercase tracking-wide shrink-0">Archived</span>
                        )}
                        {article.status === 'published' && article.scheduled_at && new Date(article.scheduled_at) > new Date() && (
                          <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-sm font-bold uppercase tracking-wide shrink-0">Scheduled</span>
                        )}
                        {article.visibility === 'private' && (
                          <span className="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-sm font-bold uppercase tracking-wide shrink-0">Private</span>
                        )}
                        <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium shrink-0">{article.category || 'General'}</span>
                      </div>
                      <p className="text-xs text-gray-500 truncate max-w-lg">
                        {article.content.replace(/<[^>]*>?/gm, '').substring(0, 100)}{article.content.length > 100 ? '...' : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="hidden md:flex items-center gap-4 mr-2">
                      <span className="flex items-center gap-1.5 text-[11px] text-gray-500 font-medium" title="Views">
                        <EyeIcon className="w-3.5 h-3.5 text-gray-400" /> {article.views || 0}
                      </span>
                      <span className="flex items-center gap-1.5 text-[11px] text-green-600 font-medium" title="Helpful">
                        <SmileIcon className="w-3.5 h-3.5 text-green-500" /> {article.upvotes || 0}
                      </span>
                      <span className="flex items-center gap-1.5 text-[11px] text-red-500 font-medium" title="Not Helpful">
                        <FrownIcon className="w-3.5 h-3.5 text-red-400" /> {article.downvotes || 0}
                      </span>
                    </div>
                    <span className="w-px h-3 bg-gray-200 hidden md:block"></span>
                    <span className="text-[11px] text-gray-400 font-medium hidden sm:block">
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
