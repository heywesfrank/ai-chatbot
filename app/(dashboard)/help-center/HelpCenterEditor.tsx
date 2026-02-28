'use client';
import { useState, useMemo, useRef } from 'react';
import { supabaseClient as supabase } from '@/lib/supabase-client';
import { toast } from 'sonner';
import { ArrowLeftIcon, ExternalLinkIcon } from '@/components/icons';
import dynamic from 'next/dynamic';
import 'react-quill/dist/quill.snow.css';

const ReactQuill = dynamic(() => import('react-quill'), {
  ssr: false,
  loading: () => <div className="h-64 flex items-center justify-center bg-gray-50 rounded-md border border-gray-100 text-sm text-gray-400">Loading editor...</div>
}) as any;

interface HelpCenterEditorProps {
  article: any;
  activeSpaceId: string;
  allCategories: string[];
  onClose: () => void;
  onSuccess: () => void;
}

export default function HelpCenterEditor({ article, activeSpaceId, allCategories, onClose, onSuccess }: HelpCenterEditorProps) {
  const [currentId] = useState<string | null>(article?.id || null);
  const [title, setTitle] = useState(article?.title || '');
  const [category, setCategory] = useState(article?.category || 'General');
  const [content, setContent] = useState(article?.content || '');
  const [slug, setSlug] = useState(article?.slug || '');
  const [seoTitle, setSeoTitle] = useState(article?.seo_title || '');
  const [seoDescription, setSeoDescription] = useState(article?.seo_description || '');
  const [status, setStatus] = useState<'draft' | 'published'>(article?.status || 'draft');
  const [isSaving, setIsSaving] = useState(false);

  const reactQuillRef = useRef<any>(null);

  const generateSlug = (text: string) =>
    text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setTitle(newTitle);
    if (!currentId && !slug) setSlug(generateSlug(newTitle));
  };

  const handleSave = async (targetStatus: 'draft' | 'published') => {
    if (!title.trim() || !content.trim()) return toast.error('Title and content are required.');
    setIsSaving(true);
    const finalSlug = slug.trim() || generateSlug(title);
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch('/api/help-center', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
      body: JSON.stringify({ id: currentId, spaceId: activeSpaceId, title, content, category, slug: finalSlug, seo_title: seoTitle, seo_description: seoDescription, status: targetStatus })
    });
    setIsSaving(false);
    if (res.ok) {
      toast.success(targetStatus === 'published' ? 'Article published & synced to AI!' : 'Draft saved successfully.');
      onSuccess();
      onClose();
    } else {
      toast.error('Failed to save article.');
    }
  };

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
        const { data, error } = await uploadPromise;
        if (error) { console.error('Upload error:', error); return; }
        const { data: publicUrlData } = supabase.storage.from('article_images').getPublicUrl(filePath);
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
        [{ 'list': 'ordered' }, { 'list': 'bullet' }],
        ['link', 'image', 'code-block'],
        ['clean']
      ],
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
            <input
              type="text"
              placeholder="Article Title"
              className="w-full text-4xl font-bold text-gray-900 placeholder:text-gray-300 outline-none border-none bg-transparent"
              value={title}
              onChange={handleTitleChange}
            />
            <style dangerouslySetInnerHTML={{__html: `
              .ql-toolbar.ql-snow { border: 1px solid #E5E7EB; border-radius: 0.375rem 0.375rem 0 0; background: #FAFAFA; border-bottom: none; }
              .ql-container.ql-snow { border: 1px solid #E5E7EB; border-radius: 0 0 0.375rem 0.375rem; font-family: inherit; font-size: 1rem; }
              .ql-editor { min-height: 400px; padding: 1.5rem; color: #374151; line-height: 1.7; }
              .ql-editor h1, .ql-editor h2, .ql-editor h3 { color: #111827; font-weight: 600; margin-top: 1.5em; margin-bottom: 0.5em; }
              .ql-editor p { margin-bottom: 1em; }
              .ql-editor img { border-radius: 0.5rem; border: 1px solid #F3F4F6; }
            `}} />
            <div className="flex-1">
              {/* @ts-ignore */}
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

        <div className="w-80 shrink-0 border-l border-gray-200 bg-[#FAFAFA] p-6 overflow-y-auto flex flex-col gap-8">
          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Classification</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Category</label>
              <input
                type="text"
                list="category-suggestions"
                placeholder="e.g. Getting Started"
                className="w-full text-sm text-gray-900 bg-white border border-gray-200 rounded-md px-3 py-2 outline-none focus:border-black transition-colors"
                value={category}
                onChange={e => setCategory(e.target.value)}
              />
              <datalist id="category-suggestions">
                {allCategories.map(cat => (
                  <option key={cat} value={cat} />
                ))}
              </datalist>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Meta & SEO</h3>
            <div className="flex flex-col gap-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">URL Slug</label>
                <input
                  type="text"
                  placeholder="e.g. how-to-reset-password"
                  className="w-full text-sm text-gray-900 bg-white border border-gray-200 rounded-md px-3 py-2 outline-none focus:border-black transition-colors"
                  value={slug}
                  onChange={e => setSlug(generateSlug(e.target.value))}
                />
                <p className="text-[11px] text-gray-500 mt-1">Leave empty to auto-generate from title.</p>
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
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-medium text-gray-700">SEO Description</label>
                  <span className="text-[10px] font-medium text-gray-400">{seoDescription.length}/160</span>
                </div>
                <textarea
                  placeholder="Brief description for search engines"
                  rows={3}
                  maxLength={160}
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
