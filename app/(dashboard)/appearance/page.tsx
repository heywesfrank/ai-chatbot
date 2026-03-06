// app/(dashboard)/appearance/page.tsx
'use client';
import { useBotConfig } from '../BotConfigProvider';
import { supabaseClient as supabase } from '@/lib/supabase-client';
import { toast } from 'sonner';
import { useState } from 'react';

function ColorPicker({ label, value, onChange, disabled }: { label: string, value: string, onChange: (v: string) => void, disabled: boolean }) {
  return (
    <section>
      <label className="block text-sm font-semibold text-gray-900 mb-2">{label}</label>
      <div className="flex items-center gap-3">
        <div className="relative w-10 h-10 rounded-md overflow-hidden border border-gray-200 shrink-0 cursor-pointer bg-white">
          <input type="color" className="absolute -top-2 -left-2 w-16 h-16 cursor-pointer" disabled={disabled} value={value || '#000000'} onChange={(e) => onChange(e.target.value)} />
        </div>
        <input type="text" className="w-full p-2.5 border border-gray-200 rounded-md text-sm outline-none focus:border-black uppercase transition-colors font-mono" disabled={disabled} value={value || ''} onChange={(e) => onChange(e.target.value)} />
      </div>
    </section>
  );
}

export default function AppearancePage() {
  const { config, updateConfig, isOwner, userId } = useBotConfig();
  const [isUploading, setIsUploading] = useState(false);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be less than 2MB');
      return;
    }

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      // Securely upload into a folder matching the user's Auth UID
      const fileName = `${userId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('bot_avatars')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('bot_avatars').getPublicUrl(fileName);
      updateConfig('botAvatar', data.publicUrl);
      toast.success('Avatar updated');
    } catch (error) {
      console.error('Upload failed:', error);
      toast.error('Failed to upload avatar');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="p-4 sm:p-8 pb-20 animate-in fade-in duration-300">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl font-semibold tracking-tight text-gray-900">Appearance</h1>
        <p className="text-sm text-gray-500 mt-1 leading-relaxed">Customize the look and feel of your chatbot widget to match your brand.</p>
      </div>

      <div className="space-y-6 sm:space-y-8 bg-white border border-gray-200 p-4 sm:p-6 rounded-md">

        {/* Brand & Widget Colors */}
        <div>
          <h2 className="text-sm font-bold text-gray-900 mb-4 border-b border-gray-100 pb-2">Global & Launcher</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6">
            <ColorPicker label="Theme (Header & Buttons)" value={config.primaryColor} onChange={(v) => updateConfig('primaryColor', v)} disabled={!isOwner} />
            <ColorPicker label="Chat Bubble (Launcher BG)" value={config.launcherColor} onChange={(v) => updateConfig('launcherColor', v)} disabled={!isOwner} />
            <ColorPicker label="Chat Icon (Launcher Icon)" value={config.launcherIconColor} onChange={(v) => updateConfig('launcherIconColor', v)} disabled={!isOwner} />
          </div>
        </div>

        {/* Message Bubble Colors */}
        <div>
          <h2 className="text-sm font-bold text-gray-900 mb-4 border-b border-gray-100 pb-2">Message Bubbles</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6">
            <ColorPicker label="User Bubble" value={config.userBubbleColor} onChange={(v) => updateConfig('userBubbleColor', v)} disabled={!isOwner} />
            <ColorPicker label="User Text" value={config.userFontColor} onChange={(v) => updateConfig('userFontColor', v)} disabled={!isOwner} />
            <ColorPicker label="Agent Bubble" value={config.agentBubbleColor} onChange={(v) => updateConfig('agentBubbleColor', v)} disabled={!isOwner} />
            <ColorPicker label="Agent Text" value={config.botFontColor} onChange={(v) => updateConfig('botFontColor', v)} disabled={!isOwner} />
          </div>
        </div>

        <section className="pt-4 border-t border-gray-100">
          <label className="block text-sm font-semibold text-gray-900 mb-2">Header Text</label>
          <input type="text" className="w-full p-2.5 border border-gray-200 rounded-md text-sm outline-none focus:border-black transition-colors" disabled={!isOwner} value={config.headerText || ''} onChange={(e) => updateConfig('headerText', e.target.value)} />
        </section>

        <section className="pt-2 border-t border-gray-100">
          <label className="block text-sm font-semibold text-gray-900 mb-2">Subheader Description</label>
          <input type="text" placeholder="e.g. Replies typically in 5 minutes" className="w-full p-2.5 border border-gray-200 rounded-md text-sm outline-none focus:border-black transition-colors" disabled={!isOwner} value={config.descriptionText || ''} onChange={(e) => updateConfig('descriptionText', e.target.value)} />
          <p className="text-[11px] text-gray-500 mt-1.5 font-medium">Optional text displayed below your header name.</p>
        </section>

        <section className="pt-2 border-t border-gray-100">
          <label className="block text-sm font-semibold text-gray-900 mb-2">Welcome Message</label>
          <input type="text" className="w-full p-2.5 border border-gray-200 rounded-md text-sm outline-none focus:border-black transition-colors" disabled={!isOwner} value={config.welcomeMessage || ''} onChange={(e) => updateConfig('welcomeMessage', e.target.value)} />
        </section>

        <section className="pt-2 border-t border-gray-100">
          <label className="block text-sm font-semibold text-gray-900 mb-2">Chat Input Placeholder</label>
          <input type="text" placeholder="Ask a question..." className="w-full p-2.5 border border-gray-200 rounded-md text-sm outline-none focus:border-black transition-colors" disabled={!isOwner} value={config.inputPlaceholder || ''} onChange={(e) => updateConfig('inputPlaceholder', e.target.value)} />
        </section>

        <section className="pt-2 border-t border-gray-100">
          <label className="block text-sm font-semibold text-gray-900 mb-2">Bot Avatar</label>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
             <div className="relative shrink-0 w-12 h-12 rounded-full overflow-hidden border border-gray-200 bg-gray-50 flex items-center justify-center">
               {config.botAvatar ? (
                 <img src={config.botAvatar} alt="Avatar" className="w-full h-full object-cover" />
               ) : (
                 <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
               )}
               {isUploading && (
                 <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                   <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                 </div>
               )}
             </div>
             
             <div className="flex-1">
               <label className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer transition-colors">
                 <span>Upload Image</span>
                 <input 
                   type="file" 
                   accept="image/*" 
                   className="hidden" 
                   disabled={!isOwner || isUploading} 
                   onChange={handleAvatarUpload}
                 />
               </label>
               <p className="text-[11px] text-gray-500 mt-1.5">Recommended size: 64x64px (PNG, JPG, GIF)</p>
             </div>
          </div>
        </section>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6 pt-4 sm:pt-6 border-t border-gray-100">
          <section>
            <label className="block text-sm font-semibold text-gray-900 mb-2">Theme</label>
            <select className="w-full p-2.5 border border-gray-200 rounded-md text-sm outline-none focus:border-black bg-white transition-colors cursor-pointer" disabled={!isOwner} value={config.theme || 'auto'} onChange={(e) => updateConfig('theme', e.target.value)}>
              <option value="auto">System Auto</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </section>
          <section>
            <label className="block text-sm font-semibold text-gray-900 mb-2">Widget Position</label>
            <select className="w-full p-2.5 border border-gray-200 rounded-md text-sm outline-none focus:border-black bg-white transition-colors cursor-pointer" disabled={!isOwner} value={config.position || 'right'} onChange={(e) => updateConfig('position', e.target.value)}>
              <option value="right">Bottom Right</option>
              <option value="left">Bottom Left</option>
            </select>
          </section>
        </div>

      </div>
    </div>
  );
}
