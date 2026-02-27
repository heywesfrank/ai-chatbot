'use client';
import { useState, useEffect, useMemo, useRef } from 'react';
import { supabaseClient as supabase } from '@/lib/supabase-client';
import { toast } from 'sonner';
import { useBotConfig } from '../BotConfigProvider';
import { FileTextIcon, PlusIcon, ArrowLeftIcon, ClearIcon, ExternalLinkIcon } from '@/components/icons';
import dynamic from 'next/dynamic';
import 'react-quill/dist/quill.snow.css';

// Dynamically import Quill editor to avoid SSR issues
const ReactQuill = dynamic(() => import('react-quill'), { 
  ssr: false,
  loading: () => <div className="h-64 flex items-center justify-center bg-gray-50 rounded-md border border-gray-100 text-sm text-gray-400">Loading editor...</div>
}) as any;

export default function HelpCenterPage() {
  const { activeSpaceId } = useBotConfig();
  const [articles, setArticles] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [isEditing, setIsEditing] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('General');
  const [content, setContent] = useState('');
  const [slug, setSlug] = useState('');
  const [seoTitle, setSeoTitle] = useState('');
  const [seoDescription, setSeoDescription] = useState('');
  const [status, setStatus] = useState<'draft' | 'published'>('draft');
  const [isSaving, setIsSaving] = useState(false);

  const reactQuillRef = useRef<any>(null);

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

  const generateSlug = (text: string) => {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setTitle(newTitle);
    if (!currentId && !slug) { // Only auto-generate slug for new articles if slug is empty
      setSlug(generateSlug(newTitle));
    }
  };

  const handleSave = async (targetStatus: 'draft' | 'published') => {
    if (!title.trim() || !content.trim()) return toast.error('Title and content are required.');
    setIsSaving(true);
    
    // Auto-fill slug if empty
    const finalSlug = slug.trim() || generateSlug(title);

    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch('/api/help-center', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
      body: JSON.stringify({ 
        id: currentId, 
        spaceId: activeSpaceId, 
        title, 
        content, 
        category,
        slug: finalSlug,
        seo_title: seoTitle,
        seo_description: seoDescription,
        status: targetStatus
      })
    });
    
    setIsSaving(false);
    if (res.ok) {
      toast.success(targetStatus === 'published' ? 'Article published & synced to AI!' : 'Draft saved successfully.');
      setIsEditing(false);
      fetchArticles();
    } else {
      toast.error('Failed to save article.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this article?')) return;
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`/api/help-center?id=${id}&spaceId=${activeSpaceId}`, {
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
      setCategory(article.category || 'General');
      setContent(article.content);
      setSlug(article.slug || '');
      setSeoTitle(article.seo_title || '');
      setSeoDescription(article.seo_description || '');
      setStatus(article.status || 'published'); // Default to published for legacy records
    } else {
      setCurrentId(null);
      setTitle('');
      setCategory('General');
      setContent('');
      setSlug('');
      setSeoTitle('');
      setSeoDescription('');
      setStatus('draft');
    }
    setIsEditing(true);
  };

  // Custom Image Handler for Quill
  const imageHandler = () => {
    const input = document.createElement('input');
    input.setAttribute('type', 'file');
    input.setAttribute('accept', 'image/*');
    input.click();

    input.onchange = async () => {
      if (input !== null && input.files !== null) {
        const file = input.files[0];
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
        const filePath = `${activeSpaceId}/${fileName}`;

        const uploadPromise = supabase.storage.from('article_images').upload(filePath, file);
        toast.promise(uploadPromise, {
          loading: 'Uploading image...',
          success: 'Image uploaded!',
          error: 'Error uploading image.'
        });

        const { data, error } = await uploadPromise;

        if (error) {
          console.error('Upload error:', error);
          return;
        }

        const { data: publicUrlData } = supabase.storage.from('article_images').getPublicUrl(filePath);
        
        // Insert the image into the editor
        if (reactQuillRef.current) {
          const editor = reactQuillRef.current.getEditor();
          const range = editor.getSelection();
          editor.insertEmbed(range ? range.index : 0, 'image', publicUrlData.publicUrl);
        }
      }
    };
  };

  const modules = useMemo(() => ({
    toolbar: {
      container: [
        [{ 'header': [1, 2, 3, false] }],
        ['bold', 'italic', 'underline', 'strike'],
        [{ 'list': 'ordered'}, { 'list': 'bullet' }],
        ['link', 'image', 'code-block'],
        ['clean']
      ],
      handlers: {
        image: imageHandler
      }
    }
  }), [activeSpaceId]);

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
      <div className="flex flex-col h-full w-full bg-[#FAFAFA] text-gray-900 font-sans">
        <div className="flex items-center justify-between px-8 py-5 border-b border-gray-200 shrink-0 bg-white shadow-sm z-10">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsEditing(false)} className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors">
              <ArrowLeftIcon className="w-4 h-4" />
              Back
            </button>
            <div className="h-4 w-px bg-gray-200"></div>
            <span className="text-sm font-medium text-gray-900">
              {currentId ? 'Edit Article' : 'New Article'}
            </span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${status === 'published' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
              {status}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {currentId && status === 'published' && (
              <a 
                href={`/help/${activeSpaceId}/${slug || currentId}`} 
                target="_blank" 
                className="text-xs font-medium text-gray-500 hover:text-gray-900 transition-colors flex items-center gap-1.5 px-3 py-2 rounded-md hover:bg-gray-50 border border-transparent"
              >
                View Live <ExternalLinkIcon className="w-3.5 h-3.5" />
              </a>
            )}
            <button 
              onClick={() => handleSave('draft')} 
              disabled={isSaving || !title.trim() || !content.trim()} 
              className="px-5 py-2.5 bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Save as Draft
            </button>
            <button 
              onClick={() => handleSave('published')} 
              disabled={isSaving || !title.trim() || !content.trim()} 
              className="px-5 py-2.5 bg-black text-white text-sm font-medium rounded-md hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Publish to Live'}
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Main Editor Area */}
          <div className="flex-1 overflow-y-auto p-8 bg-white">
            <div className="max-w-3xl mx-auto w-full flex flex-col gap-6">
              <input 
                type="text" 
                placeholder="Article Title" 
                className="w-full text-4xl font-bold text-gray-900 placeholder:text-gray-300 outline-none border-none bg-transparent"
                value={title}
                onChange={handleTitleChange}
              />
              
              {/* Quill Editor styling overrides to make it look clean and flat */}
              <style dangerouslySetInnerHTML={{__html: `
                .ql-toolbar.ql-snow { border: 1px solid #E5E7EB; border-radius: 0.375rem 0.375rem 0 0; background: #FAFAFA; border-bottom: none; }
                .ql-container.ql-snow { border: 1px solid #E5E7EB; border-radius: 0 0 0.375rem 0.375rem; font-family: inherit; font-size: 1rem; }
                .ql-editor { min-height: 400px; padding: 1.5rem; color: #374151; line-height: 1.7; }
                .ql-editor h1, .ql-editor h2, .ql-editor h3 { color: #111827; font-weight: 600; margin-top: 1.5em; margin-bottom: 0.5em; }
                .ql-editor p { margin-bottom: 1em; }
                .ql-editor img { border-radius: 0.5rem; border: 1px solid #F3F4F6; }
              `}} />
              
              <div className="flex-1">
                {/* @ts-ignore - dynamic component ref typing issue */}
                <ReactQuill 
                  ref={reactQuillRef}
                  theme="snow" 
                  value={content} 
                  onChange={setContent} 
                  modules={modules}
                  placeholder="Write your amazing article here..."
                />
              </div>
            </div>
          </div>

          {/* Settings Sidebar */}
          <div className="w-80 shrink-0 border-l border-gray-200 bg-[#FAFAFA] p-6 overflow-y-auto flex flex-col gap-8">
            
            {/* Classification */}
            <div>
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Classification</h3>
              <div className="flex flex-col gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Category</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Getting Started" 
                    className="w-full text-sm text-gray-900 bg-white border border-gray-200 rounded-md px-3 py-2 outline-none focus:border-black transition-colors"
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Meta & SEO */}
            <div>
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Meta & SEO</h3>
              <div className="flex flex-col gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">URL Slug</label>
                  <input 
                    type="text" 
                    placeholder="e.g. how-to-reset-password" 
                    className="w-full text-sm text-gray-900 bg-white border border-gray-200 rounded-md px-3 py-2 outline-none focus:border-black transition-colors"
                    value={slug}
                    onChange={e => setSlug(e.target.value)}
                  />
                  <p className="text-[11px] text-gray-500 mt-1">Leaves empty to auto-generate from title.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">SEO Title</label>
                  <input 
                    type="text" 
                    placeholder="Optional optimized title" 
                    className="w-full text-sm text-gray-900 bg-white border border-gray-200 rounded-md px-3 py-2 outline-none focus:border-black transition-colors"
                    value={seoTitle}
                    onChange={e => setSeoTitle(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">SEO Description</label>
                  <textarea 
                    placeholder="Brief description for search engines" 
                    rows={3}
                    className="w-full text-sm text-gray-900 bg-white border border-gray-200 rounded-md px-3 py-2 outline-none focus:border-black transition-colors resize-none"
                    value={seoDescription}
                    onChange={e => setSeoDescription(e.target.value)}
                  />
                </div>
              </div>
            </div>
            
          </div>
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
            <p className="text-gray-500 text-sm leading-relaxed">Create and manage support articles. Published articles sync seamlessly to your AI agent.</p>
          </div>
          <div className="flex items-center gap-3">
             <a 
                href={`/help/${activeSpaceId}`} 
                target="_blank" 
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50 transition-colors shadow-sm"
              >
                 <ExternalLinkIcon className="w-4 h-4" />
                 View Portal
              </a>
              <button onClick={() => openEditor()} className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-black text-white text-sm font-medium rounded-md hover:bg-gray-800 transition-colors shadow-sm">
                <PlusIcon className="w-4 h-4" />
                New Article
              </button>
          </div>
        </div>

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
          ) : (
            <div className="divide-y divide-gray-100">
              {articles.map((article) => (
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
                         <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium shrink-0">{article.category || 'General'}</span>
                       </div>
                       <p className="text-xs text-gray-500 truncate max-w-lg">
                         {/* Strip HTML tags for preview just in case since content is now HTML */}
                         {article.content.replace(/<[^>]*>?/gm, '').substring(0, 100)}{article.content.length > 100 ? '...' : ''}
                       </p>
                     </div>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
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
