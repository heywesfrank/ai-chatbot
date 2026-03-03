// app/(dashboard)/pages/page.tsx
'use client';
import { useState, useEffect, useRef } from 'react';
import { useBotConfig } from '../BotConfigProvider';
import { supabaseClient as supabase } from '@/lib/supabase-client';
import { toast } from 'sonner';
import { ClearIcon, PlusIcon, GripVerticalIcon, ChevronDownIcon } from '@/components/icons';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

function SimpleColorPicker({ label, value, onChange, disabled }: { label: string, value: string, onChange: (v: string) => void, disabled: boolean }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-1.5">{label}</label>
      <div className="flex items-center gap-2">
        <div className="relative w-8 h-8 rounded border border-gray-200 overflow-hidden shrink-0">
          <input type="color" className="absolute -top-2 -left-2 w-12 h-12 cursor-pointer" disabled={disabled} value={value || '#000000'} onChange={(e) => onChange(e.target.value)} />
        </div>
        <input type="text" className="flex-1 p-2.5 border border-gray-200 rounded-md text-sm outline-none focus:border-black uppercase transition-colors font-mono max-w-[100px]" disabled={disabled} value={value || ''} onChange={(e) => onChange(e.target.value)} />
      </div>
    </div>
  );
}

function ImageUpload({ label, url, onUpload, disabled, onRemove }: any) {
  const [isUploading, setIsUploading] = useState(false);
  const { config } = useBotConfig();

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `home_assets/${config.spaceId}/${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;

      const { error } = await supabase.storage.from('chat_attachments').upload(fileName, file);
      if (error) throw error;

      const { data } = supabase.storage.from('chat_attachments').getPublicUrl(fileName);
      onUpload(data.publicUrl);
    } catch (err) {
      toast.error('Image upload failed.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start sm:items-center justify-between gap-2">
        <label className="block text-xs font-medium text-gray-700">{label}</label>
        {url && onRemove && (
          <button onClick={onRemove} disabled={disabled} className="text-[10px] text-red-500 hover:underline shrink-0">Remove</button>
        )}
      </div>
      {url ? (
        <div className="relative w-full aspect-[21/9] rounded-md border border-gray-200 bg-gray-50 p-2 flex items-center justify-center overflow-hidden group/img">
          <img src={url} alt="preview" className="max-w-full max-h-full object-contain z-0" />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center z-10">
            <label className="cursor-pointer bg-white text-black px-3 py-1.5 rounded text-xs font-medium hover:bg-gray-100 transition-colors">
              Replace
              <input type="file" className="hidden" accept="image/*" disabled={disabled || isUploading} onChange={handleUpload} />
            </label>
          </div>
        </div>
      ) : (
        <label className="cursor-pointer flex flex-col items-center justify-center w-full aspect-[21/9] rounded-md border-2 border-dashed border-gray-300 bg-gray-50 hover:bg-gray-100 transition-colors">
          <span className="text-xs font-medium text-gray-500">
            {isUploading ? 'Uploading...' : 'Upload Image'}
          </span>
          <input type="file" className="hidden" accept="image/*" disabled={disabled || isUploading} onChange={handleUpload} />
        </label>
      )}
    </div>
  );
}

function SortableBlockItem({ block, updateBlock, removeBlock, isOwner }: any) {
  const [isUploading, setIsUploading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(!(block.title || block.imageUrl || block.description));
  const { config } = useBotConfig();

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isExpanded && textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [block.description, isExpanded]);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `home_blocks/${config.spaceId}/${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;

      const { error } = await supabase.storage.from('chat_attachments').upload(fileName, file);
      if (error) throw error;

      const { data } = supabase.storage.from('chat_attachments').getPublicUrl(fileName);
      updateBlock(block.id, { imageUrl: data.publicUrl });
    } catch (err) {
      toast.error('Image upload failed.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div ref={setNodeRef} style={style} className={`flex flex-col p-3 sm:p-4 bg-white border border-gray-200 rounded-lg relative group ${isDragging ? 'opacity-50' : ''}`}>
      <div className="flex items-center gap-2">
        <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 outline-none p-1 -ml-1 shrink-0">
          <GripVerticalIcon className="w-5 h-5" />
        </div>
        
        <button onClick={() => setIsExpanded(!isExpanded)} className="flex-1 text-left font-medium text-sm text-gray-700 hover:text-black transition-colors flex items-center gap-2 outline-none break-words min-w-0">
          <ChevronDownIcon className={`w-4 h-4 shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
          <span className="truncate">{block.title || 'Untitled Block'}</span>
        </button>
        
        {isOwner && (
          <button onClick={() => removeBlock(block.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors outline-none shrink-0" title="Delete block">
            <ClearIcon className="w-4 h-4" />
          </button>
        )}
      </div>
      
      {isExpanded && (
        <div className="flex flex-col gap-4 mt-3 sm:mt-4 pl-4 sm:pl-8 pr-1 sm:pr-2 pb-2 animate-in fade-in slide-in-from-top-2 duration-200 border-t border-gray-100 pt-3 sm:pt-4">
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Landscape Image</label>
            {block.imageUrl ? (
              <div className="relative w-full max-w-sm aspect-[16/9] rounded-md border border-gray-200 bg-white p-3 sm:p-4">
                <div className="relative w-full h-full group/img">
                  <img src={block.imageUrl} alt="preview" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                    <label className="cursor-pointer bg-white text-black px-3 py-1.5 rounded text-xs font-medium hover:bg-gray-100 transition-colors">
                      Replace Image
                      <input type="file" className="hidden" accept="image/*" disabled={!isOwner || isUploading} onChange={handleUpload} />
                    </label>
                  </div>
                </div>
              </div>
            ) : (
              <label className="cursor-pointer flex flex-col items-center justify-center w-full max-w-sm aspect-[16/9] rounded-md border-2 border-dashed border-gray-300 bg-gray-50 hover:bg-gray-100 transition-colors">
                <span className="text-xs font-medium text-gray-500">
                  {isUploading ? 'Uploading...' : 'Click to upload image'}
                </span>
                <input type="file" className="hidden" accept="image/*" disabled={!isOwner || isUploading} onChange={handleUpload} />
              </label>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Card Title</label>
              <input type="text" placeholder="e.g. Pioneer Summit 2026" className="w-full p-2 border border-gray-200 rounded-md text-sm outline-none focus:border-black transition-colors" value={block.title || ''} onChange={e => updateBlock(block.id, { title: e.target.value })} disabled={!isOwner} />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Short Description</label>
              <textarea 
                ref={textareaRef}
                placeholder="e.g. Join us in San Francisco..." 
                className="w-full p-2 border border-gray-200 rounded-md text-sm min-h-[64px] resize-none outline-none focus:border-black transition-colors overflow-hidden" 
                value={block.description || ''} 
                onChange={e => {
                  updateBlock(block.id, { description: e.target.value });
                  e.target.style.height = 'auto';
                  e.target.style.height = `${e.target.scrollHeight}px`;
                }} 
                disabled={!isOwner} 
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Clickable Link URL</label>
              <input type="text" placeholder="e.g. yourwebsite.com/event" className="w-full p-2 border border-gray-200 rounded-md text-sm outline-none focus:border-black transition-colors" value={block.linkUrl || ''} onChange={e => updateBlock(block.id, { linkUrl: e.target.value })} disabled={!isOwner} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function WidgetPagesConfig() {
  const { config, updateConfig, isOwner } = useBotConfig();
  
  const [homeConfig, setHomeConfig] = useState<any>({
    logoUrl: '',
    bgUrl: '',
    titleColor: '#ffffff',
    bodyColor: '#e5e7eb',
    blocks: []
  });

  useEffect(() => {
    try {
      if (config.homeContent) {
        const parsed = JSON.parse(config.homeContent);
        if (Array.isArray(parsed)) {
          setHomeConfig((prev: any) => ({ ...prev, blocks: parsed }));
        } else {
          setHomeConfig({
            logoUrl: parsed.logoUrl || '',
            bgUrl: parsed.bgUrl || '',
            titleColor: parsed.titleColor || '#ffffff',
            bodyColor: parsed.bodyColor || '#e5e7eb',
            blocks: parsed.blocks || []
          });
        }
      }
    } catch {
      // Fallback
    }
  }, [config.homeContent]);

  const updateHomeConfig = (updates: any) => {
    const newConfig = { ...homeConfig, ...updates };
    setHomeConfig(newConfig);
    updateConfig('homeContent', JSON.stringify(newConfig));
  };

  const addBlock = () => {
    const newBlock = { id: Date.now().toString(), imageUrl: '', title: '', description: '', linkUrl: '' };
    updateHomeConfig({ blocks: [...homeConfig.blocks, newBlock] });
  };

  const updateBlock = (id: string, updates: any) => {
    updateHomeConfig({ blocks: homeConfig.blocks.map((b: any) => b.id === id ? { ...b, ...updates } : b) });
  };

  const removeBlock = (id: string) => {
    updateHomeConfig({ blocks: homeConfig.blocks.filter((b: any) => b.id !== id) });
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = homeConfig.blocks.findIndex((b: any) => b.id === active.id);
      const newIndex = homeConfig.blocks.findIndex((b: any) => b.id === over.id);
      updateHomeConfig({ blocks: arrayMove(homeConfig.blocks, oldIndex, newIndex) });
    }
  };

  return (
    <div className="p-4 sm:p-8 pb-20 animate-in fade-in duration-300">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl font-semibold tracking-tight text-gray-900">Widget Pages & Layout</h1>
        <p className="text-sm text-gray-500 mt-1 leading-relaxed">Customize the multi-page experience including Home, Messages, and Help tabs.</p>
      </div>

      <div className="space-y-4 sm:space-y-6">
        
        {/* Core Tabs Toggle */}
        <section className="bg-white border border-gray-200 p-4 sm:p-6 rounded-md">
          <div className="flex items-start sm:items-center justify-between gap-4">
            <div className="pr-0 sm:pr-4">
              <label className="block text-sm font-semibold text-gray-900">Enable Tabbed Layout</label>
              <p className="text-[11px] text-gray-500 mt-0.5 font-medium">
                Transforms your widget into a full-featured application with a bottom navigation bar.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1 sm:mt-0">
              <input 
                type="checkbox" 
                className="sr-only peer"
                checked={config.tabsEnabled}
                onChange={(e) => updateConfig('tabsEnabled', e.target.checked)}
                disabled={!isOwner}
              />
              <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-black"></div>
            </label>
          </div>
        </section>

        {config.tabsEnabled && (
          <>
            {/* Header / Top Settings */}
            <section className="bg-white border border-gray-200 p-4 sm:p-6 rounded-md space-y-6">
              <div>
                <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-1">Header & Greeting</h2>
                <p className="text-[11px] text-gray-500">Design the top banner displayed when users open the widget.</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-8 pt-4 border-t border-gray-100">
                 <div>
                   <label className="block text-xs font-medium text-gray-700 mb-1.5">Greeting Title</label>
                   <input type="text" className="w-full p-2.5 border border-gray-200 rounded-md text-sm outline-none focus:border-black transition-colors mb-4" value={config.greetingTitle || ''} disabled={!isOwner} onChange={(e) => updateConfig('greetingTitle', e.target.value)} placeholder="e.g. Hello there." />
                   <SimpleColorPicker label="Title Text Color" value={homeConfig.titleColor} onChange={(v) => updateHomeConfig({ titleColor: v })} disabled={!isOwner} />
                 </div>
                 <div>
                   <label className="block text-xs font-medium text-gray-700 mb-1.5">Greeting Body</label>
                   <input type="text" className="w-full p-2.5 border border-gray-200 rounded-md text-sm outline-none focus:border-black transition-colors mb-4" value={config.greetingBody || ''} disabled={!isOwner} onChange={(e) => updateConfig('greetingBody', e.target.value)} placeholder="e.g. How can we help you today?" />
                   <SimpleColorPicker label="Body Text Color" value={homeConfig.bodyColor} onChange={(v) => updateHomeConfig({ bodyColor: v })} disabled={!isOwner} />
                 </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-8 pt-6 border-t border-gray-100">
                 <ImageUpload label="Company Logo (Optional)" url={homeConfig.logoUrl} onUpload={(url: string) => updateHomeConfig({ logoUrl: url })} onRemove={() => updateHomeConfig({ logoUrl: '' })} disabled={!isOwner} />
                 <ImageUpload label="Header Background Image (Optional)" url={homeConfig.bgUrl} onUpload={(url: string) => updateHomeConfig({ bgUrl: url })} onRemove={() => updateHomeConfig({ bgUrl: '' })} disabled={!isOwner} />
              </div>
            </section>

            {/* Home Tab Builder */}
            <section className="bg-white border border-gray-200 p-4 sm:p-6 rounded-md">
              <div className="flex items-start sm:items-center justify-between gap-4 mb-4 border-b border-gray-100 pb-4">
                <div>
                  <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Home Tab Blocks</h2>
                  <p className="text-[11px] text-gray-500 mt-0.5">Build a customizable landing page with images and links.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1 sm:mt-0">
                  <input 
                    type="checkbox" 
                    className="sr-only peer"
                    checked={config.homeTabEnabled}
                    onChange={(e) => updateConfig('homeTabEnabled', e.target.checked)}
                    disabled={!isOwner}
                  />
                  <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-black"></div>
                </label>
              </div>

              {config.homeTabEnabled && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-300 bg-gray-50 p-3 sm:p-4 rounded-lg border border-gray-200 flex flex-col gap-4">
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={homeConfig.blocks.map((b: any) => b.id)} strategy={verticalListSortingStrategy}>
                      {homeConfig.blocks.map((block: any) => (
                        <SortableBlockItem 
                          key={block.id} 
                          block={block} 
                          updateBlock={updateBlock} 
                          removeBlock={removeBlock} 
                          isOwner={isOwner} 
                        />
                      ))}
                    </SortableContext>
                  </DndContext>

                  <button
                    onClick={addBlock}
                    disabled={!isOwner}
                    className="w-full py-3 sm:py-3.5 bg-white border border-dashed border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-colors text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <PlusIcon className="w-4 h-4 shrink-0" />
                    Add Content Block
                  </button>
                </div>
              )}
            </section>

            {/* Help Center Settings */}
            <section className="bg-white border border-gray-200 p-4 sm:p-6 rounded-md">
              <h2 className="text-sm font-bold text-gray-900 mb-4 uppercase tracking-wider">Help Center Tab</h2>
              <div className="pt-4 border-t border-gray-100">
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Search Input Placeholder</label>
                <input type="text" className="w-full max-w-sm p-2.5 border border-gray-200 rounded-md text-sm outline-none focus:border-black transition-colors" value={config.helpSearchPlaceholder || ''} disabled={!isOwner} onChange={(e) => updateConfig('helpSearchPlaceholder', e.target.value)} placeholder="e.g. Search for articles..." />
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
