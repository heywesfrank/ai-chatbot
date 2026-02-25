// app/(dashboard)/appearance/page.tsx
'use client';
import { useBotConfig } from '../BotConfigProvider';

function ColorPicker({ label, value, onChange, disabled }: { label: string, value: string, onChange: (v: string) => void, disabled: boolean }) {
  return (
    <section>
      <label className="block text-sm font-semibold text-gray-900 mb-2">{label}</label>
      <div className="flex items-center gap-3">
        <div className="relative w-10 h-10 rounded-md overflow-hidden border border-gray-200 shrink-0 cursor-pointer">
          <input type="color" className="absolute -top-2 -left-2 w-16 h-16 cursor-pointer" disabled={disabled} value={value} onChange={(e) => onChange(e.target.value)} />
        </div>
        <input type="text" className="w-full p-2.5 border border-gray-200 rounded-md text-sm outline-none focus:border-black uppercase transition-colors font-mono" disabled={disabled} value={value} onChange={(e) => onChange(e.target.value)} />
      </div>
    </section>
  );
}

export default function AppearancePage() {
  const { config, updateConfig, isOwner } = useBotConfig();

  return (
    <div className="p-8 pb-20 animate-in fade-in duration-300">
      <div className="mb-8">
        <h1 className="text-xl font-semibold tracking-tight text-gray-900">Appearance</h1>
        <p className="text-sm text-gray-500 mt-1 leading-relaxed">Customize the look and feel of your chatbot widget to match your brand.</p>
      </div>

      <div className="space-y-8 bg-white border border-gray-200 p-6 rounded-md">

        {/* Brand & Widget Colors */}
        <div>
          <h2 className="text-sm font-bold text-gray-900 mb-4 border-b border-gray-100 pb-2">Global & Launcher</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <ColorPicker label="Theme (Header & Buttons)" value={config.primaryColor} onChange={(v) => updateConfig('primaryColor', v)} disabled={!isOwner} />
            <ColorPicker label="Chat Bubble (Launcher BG)" value={config.launcherColor} onChange={(v) => updateConfig('launcherColor', v)} disabled={!isOwner} />
            <ColorPicker label="Chat Icon (Launcher Icon)" value={config.launcherIconColor} onChange={(v) => updateConfig('launcherIconColor', v)} disabled={!isOwner} />
          </div>
        </div>

        {/* Message Bubble Colors */}
        <div>
          <h2 className="text-sm font-bold text-gray-900 mb-4 border-b border-gray-100 pb-2">Message Bubbles</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <ColorPicker label="User Bubble" value={config.userBubbleColor} onChange={(v) => updateConfig('userBubbleColor', v)} disabled={!isOwner} />
            <ColorPicker label="User Text" value={config.userFontColor} onChange={(v) => updateConfig('userFontColor', v)} disabled={!isOwner} />
            <ColorPicker label="Agent Bubble" value={config.agentBubbleColor} onChange={(v) => updateConfig('agentBubbleColor', v)} disabled={!isOwner} />
            <ColorPicker label="Agent Text" value={config.botFontColor} onChange={(v) => updateConfig('botFontColor', v)} disabled={!isOwner} />
          </div>
        </div>

        <section className="pt-4 border-t border-gray-100">
          <label className="block text-sm font-semibold text-gray-900 mb-2">Header Text</label>
          <input type="text" className="w-full p-2.5 border border-gray-200 rounded-md text-sm outline-none focus:border-black transition-colors" disabled={!isOwner} value={config.headerText} onChange={(e) => updateConfig('headerText', e.target.value)} />
        </section>

        <section className="pt-2 border-t border-gray-100">
          <label className="block text-sm font-semibold text-gray-900 mb-2">Subheader Description</label>
          <input type="text" placeholder="e.g. Replies typically in 5 minutes" className="w-full p-2.5 border border-gray-200 rounded-md text-sm outline-none focus:border-black transition-colors" disabled={!isOwner} value={config.descriptionText || ''} onChange={(e) => updateConfig('descriptionText', e.target.value)} />
          <p className="text-[11px] text-gray-500 mt-1.5 font-medium">Optional text displayed below your header name.</p>
        </section>

        <section className="pt-2 border-t border-gray-100">
          <label className="block text-sm font-semibold text-gray-900 mb-2">Welcome Message</label>
          <input type="text" className="w-full p-2.5 border border-gray-200 rounded-md text-sm outline-none focus:border-black transition-colors" disabled={!isOwner} value={config.welcomeMessage} onChange={(e) => updateConfig('welcomeMessage', e.target.value)} />
        </section>

        <section className="pt-2 border-t border-gray-100">
          <label className="block text-sm font-semibold text-gray-900 mb-2">Chat Input Placeholder</label>
          <input type="text" placeholder="Ask a question..." className="w-full p-2.5 border border-gray-200 rounded-md text-sm outline-none focus:border-black transition-colors" disabled={!isOwner} value={config.inputPlaceholder || ''} onChange={(e) => updateConfig('inputPlaceholder', e.target.value)} />
        </section>

        <section className="pt-2 border-t border-gray-100">
          <label className="block text-sm font-semibold text-gray-900 mb-2">Bot Avatar URL</label>
          <div className="flex items-center gap-3">
             {config.botAvatar && <img src={config.botAvatar} alt="Avatar" className="w-10 h-10 rounded-full object-cover border border-gray-200 shrink-0" />}
             <input type="url" placeholder="https://example.com/avatar.png" className="w-full p-2.5 border border-gray-200 rounded-md text-sm outline-none focus:border-black transition-colors" disabled={!isOwner} value={config.botAvatar} onChange={(e) => updateConfig('botAvatar', e.target.value)} />
          </div>
        </section>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-gray-100">
          <section>
            <label className="block text-sm font-semibold text-gray-900 mb-2">Theme</label>
            <select className="w-full p-2.5 border border-gray-200 rounded-md text-sm outline-none focus:border-black bg-white transition-colors cursor-pointer" disabled={!isOwner} value={config.theme} onChange={(e) => updateConfig('theme', e.target.value)}>
              <option value="auto">System Auto</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </section>
          <section>
            <label className="block text-sm font-semibold text-gray-900 mb-2">Widget Position</label>
            <select className="w-full p-2.5 border border-gray-200 rounded-md text-sm outline-none focus:border-black bg-white transition-colors cursor-pointer" disabled={!isOwner} value={config.position} onChange={(e) => updateConfig('position', e.target.value)}>
              <option value="right">Bottom Right</option>
              <option value="left">Bottom Left</option>
            </select>
          </section>
        </div>

        <section className="pt-6 border-t border-gray-100 mt-6">
          <div className="flex items-center justify-between">
            <div>
              <label className="block text-sm font-semibold text-gray-900">Remove Branding</label>
              <p className="text-[11px] text-gray-500 mt-0.5 font-medium">Hide the "Powered by Knowledge Bot" watermark at the bottom of the widget.</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" disabled={!isOwner} checked={config.removeBranding} onChange={(e) => updateConfig('removeBranding', e.target.checked)} />
              <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-black"></div>
            </label>
          </div>
        </section>

      </div>
    </div>
  );
}
