// app/(dashboard)/appearance/page.tsx
'use client';
import { useBotConfig } from '../BotConfigProvider';

export default function AppearancePage() {
  const { config, updateConfig, isOwner } = useBotConfig();

  return (
    <div className="p-8 pb-20 max-w-[800px] animate-in fade-in duration-300">
      <div className="mb-8">
        <h1 className="text-xl font-semibold tracking-tight text-gray-900">Appearance</h1>
        <p className="text-sm text-gray-500 mt-1 leading-relaxed">Customize the look and feel of your chatbot widget to match your brand.</p>
      </div>

      <div className="space-y-6 bg-white border border-gray-200 p-6 rounded-md shadow-sm">
        <section>
          <label className="block text-sm font-semibold text-gray-900 mb-2">Primary Color</label>
          <div className="flex items-center gap-3">
            <div className="relative w-10 h-10 rounded-md overflow-hidden border border-gray-200 shadow-sm shrink-0 cursor-pointer">
               <input type="color" className="absolute -top-2 -left-2 w-16 h-16 cursor-pointer" disabled={!isOwner} value={config.primaryColor} onChange={(e) => updateConfig('primaryColor', e.target.value)} />
            </div>
            <input type="text" className="w-32 p-2.5 border border-gray-200 rounded-md text-sm outline-none focus:border-black uppercase transition-colors shadow-sm font-mono" disabled={!isOwner} value={config.primaryColor} onChange={(e) => updateConfig('primaryColor', e.target.value)} />
          </div>
        </section>

        <section className="pt-2 border-t border-gray-100">
          <label className="block text-sm font-semibold text-gray-900 mb-2">Header Text</label>
          <input type="text" className="w-full max-w-md p-2.5 border border-gray-200 rounded-md text-sm outline-none focus:border-black shadow-sm transition-colors" disabled={!isOwner} value={config.headerText} onChange={(e) => updateConfig('headerText', e.target.value)} />
        </section>

        <section className="pt-2 border-t border-gray-100">
          <label className="block text-sm font-semibold text-gray-900 mb-2">Welcome Message</label>
          <input type="text" className="w-full max-w-md p-2.5 border border-gray-200 rounded-md text-sm outline-none focus:border-black shadow-sm transition-colors" disabled={!isOwner} value={config.welcomeMessage} onChange={(e) => updateConfig('welcomeMessage', e.target.value)} />
        </section>

        <section className="pt-2 border-t border-gray-100">
          <label className="block text-sm font-semibold text-gray-900 mb-2">Bot Avatar URL</label>
          <div className="flex items-center gap-3">
             {config.botAvatar && <img src={config.botAvatar} alt="Avatar" className="w-10 h-10 rounded-full object-cover border border-gray-200 shadow-sm shrink-0" />}
             <input type="url" placeholder="https://example.com/avatar.png" className="w-full max-w-md p-2.5 border border-gray-200 rounded-md text-sm outline-none focus:border-black shadow-sm transition-colors" disabled={!isOwner} value={config.botAvatar} onChange={(e) => updateConfig('botAvatar', e.target.value)} />
          </div>
        </section>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-md pt-6 border-t border-gray-100">
          <section>
            <label className="block text-sm font-semibold text-gray-900 mb-2">Theme</label>
            <select className="w-full p-2.5 border border-gray-200 rounded-md text-sm outline-none focus:border-black bg-white shadow-sm transition-colors cursor-pointer" disabled={!isOwner} value={config.theme} onChange={(e) => updateConfig('theme', e.target.value)}>
              <option value="auto">System Auto</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </section>
          <section>
            <label className="block text-sm font-semibold text-gray-900 mb-2">Widget Position</label>
            <select className="w-full p-2.5 border border-gray-200 rounded-md text-sm outline-none focus:border-black bg-white shadow-sm transition-colors cursor-pointer" disabled={!isOwner} value={config.position} onChange={(e) => updateConfig('position', e.target.value)}>
              <option value="right">Bottom Right</option>
              <option value="left">Bottom Left</option>
            </select>
          </section>
        </div>
      </div>
    </div>
  );
}
