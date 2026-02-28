// app/(dashboard)/pages/page.tsx
'use client';
import { useState, useEffect } from 'react';
import { useBotConfig } from '../BotConfigProvider';
import { supabaseClient as supabase } from '@/lib/supabase-client';
import { toast } from 'sonner';
import { ClearIcon, PlusIcon, GripVerticalIcon } from '@/components/icons';
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

function SortableBlockItem({ 
  block, 
  updateBlock, 
  removeBlock, 
  isOwner 
}: any) {
  const [isUploading, setIsUploading] = useState(false);
  const { config } = useBotConfig();

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
    <div ref={setNodeRef} style={style} className={`flex gap-3 p-4 bg-white border border-gray-200 rounded-lg shadow-sm relative group ${isDragging ? 'opacity-50' : ''}`}>
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 mt-2 shrink-0 outline-none">
        <GripVerticalIcon className="w-5 h-5" />
      </div>
      
      <div className="flex-1 flex flex-col gap-4 min-w-0 pr-6">
        {/* Image Area */}
        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Landscape Image</label>
          {block.imageUrl ? (
            <div className="relative w-full max-w-sm aspect-video rounded-md overflow-hidden border border-gray-200 bg-gray-50 group/img">
              <img src={block.imageUrl} alt="preview" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                <label className="cursor-pointer bg-white text-black px-3 py-1.5 rounded text-xs font-medium shadow-sm hover:bg-gray-100 transition-colors">
                  Replace Image
                  <input type="file" className="hidden" accept="image/*" disabled={!isOwner || isUploading} onChange={handleUpload} />
                </label>
              </div>
            </div>
          ) : (
            <label className="cursor-pointer flex flex-col items-center justify-center w-full max-w-sm aspect-video rounded-md border-2 border-dashed border-gray-300 bg-gray-50 hover:bg-gray-100 transition-colors">
              <span className="text-xs font-medium text-gray-500">
                {isUploading ? 'Uploading...' : 'Click to upload image'}
              </span>
              <input type="file" className="hidden" accept="image/*" disabled={!isOwner || isUploading} onChange={handleUpload} />
            </label>
          )}
        </div>

        {/* Text & Link Inputs */}
        <div className="grid grid-cols-1 gap-3">
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Card Title</label>
            <input type="text" placeholder="e.g. Pioneer Summit 2026" className="w-full p-2 border border-gray-200 rounded-md text-sm outline-none focus:border-black transition-colors" value={block.title} onChange={e => updateBlock(block.id, { title: e.target.value })} disabled={!isOwner} />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Short Description</label>
            <textarea placeholder="e.g. Join us in San Francisco..." className="w-full p-2 border border-gray-200 rounded-md text-sm h-16 resize-none outline-none focus:border-black transition-colors" value={block.description} onChange={e => updateBlock(block.id, { description: e.target.value })} disabled={!isOwner} />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Clickable Link URL</label>
            <input type="url" placeholder="https://..." className="w-full p-2 border border-gray-200 rounded-md text-sm outline-none focus:border-black transition-colors" value={block.linkUrl} onChange={e => updateBlock(block.id, { linkUrl: e.target.value })} disabled={!isOwner} />
          </div>
        </div>
      </div>
      
      {isOwner && (
        <button onClick={() => removeBlock(block.id)} className="absolute top-3 right-3 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors opacity-0 group-hover:opacity-100 outline-none" title="Delete block">
          <ClearIcon className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

export default function WidgetPagesConfig() {
  const { config, updateConfig, isOwner } = useBotConfig();
  const [blocks, setBlocks] = useState<any[]>([]);

  // Parse existing JSON blocks or fallback cleanly
  useEffect(() => {
    try {
      if (config.homeContent) {
        const parsed = JSON.parse(config.homeContent);
        setBlocks(Array.isArray(parsed) ? parsed : []);
      }
    } catch {
      // Legacy markdown defaults to empty slate
      setBlocks([]);
    }
  }, [config.homeContent]);

  const saveBlocks = (newBlocks: any[]) => {
    setBlocks(newBlocks);
    updateConfig('homeContent', JSON.stringify(newBlocks));
  };

  const addBlock = () => {
    const newBlock = { id: Date.now().toString(), imageUrl: '', title: '', description: '', linkUrl: '' };
    saveBlocks([...blocks, newBlock]);
  };

  const updateBlock = (id: string, updates: any) => {
    saveBlocks(blocks.map(b => b.id === id ? { ...b, ...updates } : b));
  };

  const removeBlock = (id: string) => {
    saveBlocks(blocks.filter(b => b.id !== id));
  };

  // Setup DND Sensors (allow inputs to be clicked without initiating drag)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = blocks.findIndex(b => b.id === active.id);
      const newIndex = blocks.findIndex(b => b.id === over.id);
      saveBlocks(arrayMove(blocks, oldIndex, newIndex));
    }
  };

  return (
    <div className="p-8 pb-20 animate-in fade-in duration-300">
      <div className="mb-8">
        <h1 className="text-xl font-semibold tracking-tight text-gray-900">Pages & Tabs</h1>
        <p className="text-sm text-gray-500 mt-1 leading-relaxed">Design a modern widget with specialized Home, Messages, and Help Center views.</p>
      </div>

      <div className="space-y-8 bg-white border border-gray-200 p-6 rounded-md">
        
        {/* Core Tabs Toggle */}
        <section>
          <div className="flex items-center justify-between pb-4 border-b border-gray-100">
            <div className="pr-4">
              <label className="block text-sm font-semibold text-gray-900">Enable Multi-page Layout</label>
              <p className="text-[11px] text-gray-500 mt-0.5 font-medium">
                Transforms your widget into a full-featured application with a bottom navigation bar.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
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
            <section className="pt-2">
              <h2 className="text-sm font-bold text-gray-900 mb-4 uppercase tracking-wider">Top Banner & Greeting</h2>
              <div className="space-y-4">
                 <div>
                   <label className="block text-xs font-medium text-gray-700 mb-1.5">Greeting Title</label>
                   <input type="text" className="w-full p-2.5 border border-gray-200 rounded-md text-sm outline-none focus:border-black transition-colors" value={config.greetingTitle || ''} disabled={!isOwner} onChange={(e) => updateConfig('greetingTitle', e.target.value)} placeholder="e.g. Hello there." />
                 </div>
                 <div>
                   <label className="block text-xs font-medium text-gray-700 mb-1.5">Greeting Body</label>
                   <input type="text" className="w-full p-2.5 border border-gray-200 rounded-md text-sm outline-none focus:border-black transition-colors" value={config.greetingBody || ''} disabled={!isOwner} onChange={(e) => updateConfig('greetingBody', e.target.value)} placeholder="e.g. How can we help?" />
                   <p className="text-[10px] text-gray-500 mt-1.5">This greeting displays prominently when users open the widget.</p>
                 </div>
              </div>
            </section>

            {/* Home Tab Builder */}
            <section className="pt-6 border-t border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Home Tab Blocks</h2>
                  <p className="text-[11px] text-gray-500 mt-0.5">Build a customizable landing page with images and links.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
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
                <div className="animate-in fade-in slide-in-from-top-2 duration-300 bg-gray-50 p-4 rounded-lg border border-gray-200 flex flex-col gap-4">
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={blocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
                      {blocks.map((block) => (
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
                    className="w-full py-3.5 bg-white border border-dashed border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-colors text-sm font-medium flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
                  >
                    <PlusIcon className="w-4 h-4" />
                    Add Home Block
                  </button>
                </div>
              )}
            </section>

            {/* Help Center Settings */}
            <section className="pt-6 border-t border-gray-100">
              <h2 className="text-sm font-bold text-gray-900 mb-4 uppercase tracking-wider">Help Center Tab</h2>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Search Input Placeholder</label>
                <input type="text" className="w-full p-2.5 border border-gray-200 rounded-md text-sm outline-none focus:border-black transition-colors" value={config.helpSearchPlaceholder || ''} disabled={!isOwner} onChange={(e) => updateConfig('helpSearchPlaceholder', e.target.value)} placeholder="Search for articles..." />
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
