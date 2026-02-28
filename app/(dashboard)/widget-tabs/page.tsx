// app/(dashboard)/widget-tabs/page.tsx
'use client';
import { useBotConfig } from '../BotConfigProvider';

export default function WidgetTabsPage() {
  const { config, updateConfig, isOwner } = useBotConfig();

  return (
    <div className="p-8 pb-20 animate-in fade-in duration-300">
      <div className="mb-8">
        <h1 className="text-xl font-semibold tracking-tight text-gray-900">Widget Tabs</h1>
        <p className="text-sm text-gray-500 mt-1 leading-relaxed">Upgrade your widget to a modern, tabbed layout with embedded Help Center articles and chat history.</p>
      </div>

      <div className="space-y-8 bg-white border border-gray-200 p-6 rounded-md">
        <section>
          <div className="flex items-center justify-between">
            <div className="pr-4">
              <label className="block text-sm font-semibold text-gray-900">Enable Tabs & Chat History</label>
              <p className="text-[11px] text-gray-500 mt-0.5 font-medium">
                When enabled, the widget will feature a "Messages" and "Help" tab at the bottom. The Help tab pulls directly from your published Help Center. The Messages tab will store a history of recent conversations.
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
      </div>
    </div>
  );
}
