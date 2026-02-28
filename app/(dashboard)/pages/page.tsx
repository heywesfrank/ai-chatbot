// app/(dashboard)/pages/page.tsx
'use client';
import { useBotConfig } from '../BotConfigProvider';

export default function WidgetPagesConfig() {
  const { config, updateConfig, isOwner } = useBotConfig();

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

            {/* Home Tab Settings */}
            <section className="pt-6 border-t border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Home Tab</h2>
                  <p className="text-[11px] text-gray-500 mt-0.5">A customizable landing page for news, updates, or links.</p>
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
                <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">Page Content (Markdown)</label>
                  <textarea 
                    className="w-full p-3 border border-gray-200 rounded-md text-sm h-48 outline-none focus:border-black resize-none transition-colors font-mono" 
                    value={config.homeContent || ''} 
                    disabled={!isOwner} 
                    onChange={(e) => updateConfig('homeContent', e.target.value)}
                    placeholder="### Big Updates!&#10;Check out our new feature release today.&#10;[Read more here](https://yourwebsite.com)"
                  />
                  <p className="text-[10px] text-gray-500 mt-1.5">Supports links, bolding, lists, and images.</p>
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
