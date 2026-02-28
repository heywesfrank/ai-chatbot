// app/(dashboard)/help-center/HelpCenterEditor.tsx
'use client';
import { useState, useMemo, useRef, useEffect } from 'react';
import { supabaseClient as supabase } from '@/lib/supabase-client';
import { toast } from 'sonner';
import { ArrowLeftIcon, ExternalLinkIcon, ClearIcon } from '@/components/icons';
import dynamic from 'next/dynamic';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import hljs from 'highlight.js';
import 'highlight.js/styles/github.css';
import 'react-quill/dist/quill.snow.css';

// Bind highlight.js globally synchronously so Quill can find it immediately
if (typeof window !== 'undefined') {
  (window as any).hljs = hljs;
}

const ReactQuill = dynamic(async () => {
  const { default: RQ } = await import('react-quill');
  const { Quill } = RQ as any;
  if (Quill && !Quill.imports['formats/imageWithAlt']) {
    const ImageFormat = Quill.import('formats/image');
    class ImageWithAlt extends ImageFormat {
      static create(value: any) {
        const node = super.create(typeof value === 'string' ? value : value.url);
        if (typeof value === 'object' && value.alt) {
          node.setAttribute('alt', value.alt);
        }
        return node;
      }
      static value(node: any) {
        return {
          url: node.getAttribute('src'),
          alt: node.getAttribute('alt')
        };
      }
    }
    ImageWithAlt.blotName = 'imageWithAlt';
    ImageWithAlt.tagName = 'IMG';
    Quill.register(ImageWithAlt, true);
  }
  return RQ;
}, {
  ssr: false,
  loading: () => <div className="h-64 flex items-center justify-center bg-gray-50 rounded-md border border-gray-100 text-sm text-gray-400">Loading editor...</div>
}) as any;

interface HelpCenterEditorProps {
  article: any;
  activeSpaceId: string;
  allCategories: string[];
  allArticles: any[];
  onClose: () => void;
  onSuccess: () => void;
}

const flattenText = (node: any): string => {
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(flattenText).join('');
  if (node && typeof node === 'object' && node.props && node.props.children) {
    return flattenText(node.props.children);
  }
  return '';
};

export default function HelpCenterEditor({ article, activeSpaceId, allCategories, allArticles, onClose, onSuccess }: HelpCenterEditorProps) {
  const [currentId, setCurrentId] = useState<string | null>(article?.id || null);
  const [title, setTitle] = useState(article?.title || '');
  const [category, setCategory] = useState(article?.category || 'General');
  const [content, setContent] = useState(article?.content || '');
  const [slug, setSlug] = useState(article?.slug || '');
  const [seoTitle, setSeoTitle] = useState(article?.seo_title || '');
  const [seoDescription, setSeoDescription] = useState(article?.seo_description || '');
  const [status, setStatus] = useState<'draft' | 'published'>(article?.status || 'draft');
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isPreview, setIsPreview] = useState(false);

  // New Organization & Search states
  const [tags, setTags] = useState<string[]>(article?.tags || []);
  const [tagInput, setTagInput] = useState('');
  const [relatedArticles, setRelatedArticles] = useState<string[]>(article?.related_articles || []);

  const [altTextModal, setAltTextModal] = useState<{ url: string, range: any } | null>(null);
  const [altText, setAltText] = useState('');

  const reactQuillRef = useRef<any>(null);

  const generateSlug = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setTitle(newTitle);
    if (!currentId && !slug) setSlug(generateSlug(newTitle));
  };

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const val = tagInput.trim().replace(/^,|,$/g, '');
      if (val && !tags.includes(val)) setTags([...tags, val]);
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };

  const toggleRelatedArticle = (articleId: string) => {
    if (relatedArticles.includes(articleId)) {
      setRelatedArticles(relatedArticles.filter(id => id !== articleId));
    } else {
      if (relatedArticles.length >= 3) {
        toast.error("You can only select up to 3 related articles.");
        return;
      }
      setRelatedArticles([...relatedArticles, articleId]);
    }
  };

  const handleSave = async (targetStatus: 'draft' | 'published', silent = false) => {
    if (!title.trim() || !content.trim()) {
      if (!silent) toast.error('Title and content are required.');
      return;
    }
    if (!silent) setIsSaving(true);
    
    const finalSlug = slug.trim() || generateSlug(title);
    const { data: { session } } = await supabase.auth.getSession();
    
    const res = await fetch('/api/help-center', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
      body: JSON.stringify({ 
        id: currentId, spaceId: activeSpaceId, title, content, category, 
        slug: finalSlug, seo_title: seoTitle, seo_description: seoDescription, 
        status: targetStatus, tags, relatedArticles 
      })
    });
    
    if (!silent) setIsSaving(false);
    
    if (res.ok) {
      const data = await res.json();
      if (!currentId && data.article?.id) setCurrentId(data.article.id);
      setStatus(targetStatus);
      setLastSaved(new Date());

      if (!silent) {
        toast.success(targetStatus === 'published' ? 'Article published & synced to AI!' : 'Draft saved successfully.');
        onSuccess();
        onClose();
      }
    } else {
      if (!silent) toast.error('Failed to save article.');
    }
  };

  useEffect(() => {
    if (!title.trim() || !content.trim()) return;
    const timeoutId = setTimeout(() => handleSave(status, true), 30000);
    return () => clearTimeout(timeoutId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, content, category, slug, seoTitle, seoDescription, status, tags, relatedArticles]);

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
        
        toast.promise(uploadPromise, { loading: 'Uploading image...', success: 'Image uploaded!', error: 'Error uploading image.' });
        const { error } = await uploadPromise;
        if (error) return;
        
        const { data: publicUrlData } = supabase.storage.from('article_images').getPublicUrl(filePath);
        
        if (reactQuillRef.current) {
          const editor = reactQuillRef.current.getEditor();
          const range = editor.getSelection(true);
          setAltTextModal({ url: publicUrlData.publicUrl, range: range ? range.index : 0 });
        }
      }
    };
  };

  const handleAltTextSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!altTextModal) return;
    const editor = reactQuillRef.current?.getEditor();
    if (editor) {
      editor.insertEmbed(altTextModal.range, 'imageWithAlt', { url: altTextModal.url, alt: altText });
      editor.setSelection(altTextModal.range + 1);
    }
    setAltTextModal(null);
    setAltText('');
  };

  const modules = useMemo(() => ({
    syntax: true,
    toolbar: {
      container: [[{ 'header': [1, 2, 3, false] }], ['bold', 'italic', 'underline', 'strike'], [{ 'list': 'ordered' }, { 'list': 'bullet' }], ['link', 'image', 'code-block'], ['clean']],
      handlers: { image: imageHandler }
    }
  }), [activeSpaceId]);

  return (
    <div className="flex flex-col h-full w-full bg-[#FAFAFA] text-gray-900 font-sans">
      <div className="flex items-center justify-between px-8 py-5 border-b border-gray-200 shrink-0 bg-white z-10">
        <div className="flex items-center gap-4">
          <button onClick={onClose} className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors">
            <ArrowLeftIcon className="w-4 h-4" />
            Back
          </button>
          <div className="h-4 w-px bg-gray-200" />
          <span className="text-sm font-medium text-gray-900">{currentId ? 'Edit Article' : 'New Article'}</span>
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${status === 'published' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
            {status}
          </span>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="bg-gray-100 p-0.5 rounded-md flex items-center mr-2">
            <button onClick={() => setIsPreview(false)} className={`px-3 py-1.5 text-xs font-medium rounded-sm transition-all ${!isPreview ? 'bg-white shadow-sm text-black' : 'text-gray-500 hover:text-gray-900'}`}>Edit</button>
            <button onClick={() => setIsPreview(true)} className={`px-3 py-1.5 text-xs font-medium rounded-sm transition-all ${isPreview ? 'bg-white shadow-sm text-black' : 'text-gray-500 hover:text-gray-900'}`}>Preview</button>
          </div>
          {lastSaved && <span className="text-[10px] text-gray-400 mr-2 font-medium hidden sm:block">Saved {lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
          {currentId && status === 'published' && (
            <a href={`/help/${activeSpaceId}/${slug || currentId}`} target="_blank" className="text-xs font-medium text-gray-500 hover:text-gray-900 transition-colors flex items-center gap-1.5 px-3 py-2 rounded-md hover:bg-gray-50 border border-transparent">
              View Live <ExternalLinkIcon className="w-3.5 h-3.5" />
            </a>
          )}
          <button onClick={() => handleSave('draft')} disabled={isSaving || !title.trim() || !content.trim()} className="px-5 py-2.5 bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50">
            Save as Draft
          </button>
          <button onClick={() => handleSave('published')} disabled={isSaving || !title.trim() || !content.trim()} className="px-5 py-2.5 bg-black text-white text-sm font-medium rounded-md hover:bg-gray-800 transition-colors disabled:opacity-50">
            {isSaving ? 'Saving...' : 'Publish to Live'}
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-y-auto p-8 bg-white">
          <div className="max-w-3xl mx-auto w-full flex flex-col gap-6">
            <input type="text" placeholder="Article Title" className="w-full text-4xl font-bold text-gray-900 placeholder:text-gray-300 outline-none border-none bg-transparent" value={title} onChange={handleTitleChange} />
            
            {isPreview ? (
              <div className="prose prose-slate max-w-none prose-headings:font-semibold prose-a:text-blue-600 hover:prose-a:text-blue-500 prose-img:rounded-xl prose-img:shadow-sm leading-relaxed text-[15px] text-gray-700 min-h-[400px] p-6 border border-gray-100 rounded-lg bg-gray-50/30">
                {content ? (
                  <ReactMarkdown rehypePlugins={[rehypeRaw]} components={{ a: ({ node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />, h2: ({ node, children, ...props }) => <h2 id={generateSlug(flattenText(children))} {...props}>{children}</h2>, h3: ({ node, children, ...props }) => <h3 id={generateSlug(flattenText(children))} {...props}>{children}</h3> }}>
                    {content}
                  </ReactMarkdown>
                ) : <span className="text-gray-400 italic">No content to preview yet.</span>}
              </div>
            ) : (
              <>
                <style dangerouslySetInnerHTML={{__html: `.ql-toolbar.ql-snow { border: 1px solid #E5E7EB; border-radius: 0.375rem 0.375rem 0 0; background: #FAFAFA; border-bottom: none; } .ql-container.ql-snow { border: 1px solid #E5E7EB; border-radius: 0 0 0.375rem 0.375rem; font-family: inherit; font-size: 1rem; } .ql-editor { min-height: 400px; padding: 1.5rem; color: #374151; line-height: 1.7; } .ql-editor h1, .ql-editor h2, .ql-editor h3 { color: #111827; font-weight: 600; margin-top: 1.5em; margin-bottom: 0.5em; } .ql-editor p { margin-bottom: 1em; } .ql-editor img { border-radius: 0.5rem; border: 1px solid #F3F4F6; } .ql-syntax { background-color: #f3f4f6 !important; border: 1px solid #e5e7eb; border-radius: 0.375rem; padding: 1rem; font-size: 0.875rem; }`}} />
                <div className="flex-1 pb-10">
                  <ReactQuill ref={reactQuillRef} theme="snow" value={content} onChange={setContent} modules={modules} placeholder="Write your amazing article here..." />
                </div>
              </>
            )}
          </div>
        </div>

        <div className="w-[340px] shrink-0 border-l border-gray-200 bg-[#FAFAFA] p-6 overflow-y-auto flex flex-col gap-8">
          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Classification</h3>
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Category</label>
                <input type="text" list="category-suggestions" placeholder="e.g. Getting Started" className="w-full text-sm text-gray-900 bg-white border border-gray-200 rounded-md px-3 py-2 outline-none focus:border-black transition-colors" value={category} onChange={e => setCategory(e.target.value)} />
                <datalist id="category-suggestions">{allCategories.map(cat => <option key={cat} value={cat} />)}</datalist>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Tags</label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {tags.map((tag, i) => (
                    <span key={i} className="inline-flex items-center gap-1 bg-gray-200 text-gray-700 px-2 py-1 rounded-sm text-xs font-medium">
                      {tag} <button type="button" onClick={() => removeTag(tag)} className="hover:text-red-500 transition-colors ml-0.5"><ClearIcon className="w-3 h-3"/></button>
                    </span>
                  ))}
                </div>
                <input type="text" placeholder="Type & press enter" className="w-full text-sm text-gray-900 bg-white border border-gray-200 rounded-md px-3 py-2 outline-none focus:border-black transition-colors" value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={handleTagKeyDown} />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-medium text-gray-700">Related Articles</label>
                  <span className="text-[10px] font-medium text-gray-400">{relatedArticles.length}/3</span>
                </div>
                <div className="border border-gray-200 rounded-md max-h-40 overflow-y-auto bg-white p-1.5 space-y-0.5 shadow-sm">
                  {allArticles.filter(a => a.id !== currentId).map(a => (
                    <label key={a.id} className="flex items-center gap-2.5 p-2 hover:bg-gray-50 rounded-sm cursor-pointer transition-colors group">
                      <input 
                        type="checkbox" 
                        checked={relatedArticles.includes(a.id)} 
                        onChange={() => toggleRelatedArticle(a.id)} 
                        className="w-3.5 h-3.5 accent-black border-gray-300 rounded-sm focus:ring-black" 
                      />
                      <span className="text-[13px] text-gray-700 group-hover:text-gray-900 truncate font-medium">{a.title}</span>
                    </label>
                  ))}
                  {allArticles.length <= 1 && <span className="text-[11px] text-gray-400 p-2 block italic text-center">No other articles available.</span>}
                </div>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Meta & SEO</h3>
            <div className="flex flex-col gap-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">URL Slug</label>
                <input type="text" placeholder="e.g. how-to-reset-password" className="w-full text-sm text-gray-900 bg-white border border-gray-200 rounded-md px-3 py-2 outline-none focus:border-black transition-colors shadow-sm" value={slug} onChange={e => setSlug(generateSlug(e.target.value))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">SEO Title</label>
                <input type="text" placeholder="Optimized title" className="w-full text-sm text-gray-900 bg-white border border-gray-200 rounded-md px-3 py-2 outline-none focus:border-black transition-colors shadow-sm" value={seoTitle} onChange={e => setSeoTitle(e.target.value)} />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-medium text-gray-700">SEO Description</label>
                  <span className="text-[10px] font-medium text-gray-400">{seoDescription.length}/160</span>
                </div>
                <textarea placeholder="Brief description for search engines" rows={3} maxLength={160} className="w-full text-sm text-gray-900 bg-white border border-gray-200 rounded-md px-3 py-2 outline-none focus:border-black transition-colors resize-none shadow-sm" value={seoDescription} onChange={e => setSeoDescription(e.target.value)} />
              </div>

              {/* Minimalistic Google SERP Preview */}
              <div className="mt-2 p-4 border border-gray-200 rounded-md bg-white shadow-sm flex flex-col gap-1.5 select-none relative overflow-hidden">
                 <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
                 <span className="text-[9px] uppercase font-bold text-gray-400 mb-0.5 tracking-wider">Search Preview</span>
                 <div className="text-[11px] text-[#202124] flex items-center gap-1.5 truncate">
                   <div className="w-3.5 h-3.5 rounded-full bg-gray-200 flex-shrink-0" />
                   <span className="truncate opacity-80">yourdomain.com › help › {slug || generateSlug(title) || 'article'}</span>
                 </div>
                 <div className="text-[15px] text-[#1a0dab] font-medium truncate leading-tight cursor-pointer hover:underline">
                   {seoTitle || title || 'Article Title'}
                 </div>
                 <div className="text-[12px] text-[#4d5156] line-clamp-2 leading-relaxed">
                   {seoDescription || content.replace(/<[^>]*>?/gm, '').substring(0, 160) || 'Write an engaging meta description to help users discover your content in search engines.'}
                 </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {altTextModal && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center animate-in fade-in duration-200">
          <form onSubmit={handleAltTextSubmit} className="bg-white border border-gray-200 shadow-2xl rounded-xl p-6 w-full max-w-sm flex flex-col gap-4 animate-in zoom-in-95 duration-200">
            <h3 className="text-sm font-semibold text-gray-900">Image Details</h3>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-700">Alt Text</label>
              <input autoFocus type="text" placeholder="Describe the image..." className="w-full text-sm text-gray-900 bg-white border border-gray-200 rounded-md px-3 py-2 outline-none focus:border-black transition-colors shadow-sm" value={altText} onChange={e => setAltText(e.target.value)} />
              <p className="text-[10px] text-gray-500">Improves accessibility and AI document context.</p>
            </div>
            <div className="flex justify-end gap-2 mt-2">
              <button type="button" onClick={() => { setAltTextModal(null); setAltText(''); }} className="px-4 py-2.5 bg-white border border-gray-200 text-xs font-medium text-gray-700 hover:bg-gray-50 rounded-md transition-colors shadow-sm">Cancel</button>
              <button type="submit" className="px-4 py-2.5 bg-black text-white text-xs font-medium rounded-md hover:bg-gray-800 transition-colors shadow-sm">Insert Image</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
