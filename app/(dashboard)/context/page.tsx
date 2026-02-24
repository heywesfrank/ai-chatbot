'use client';

import { useBotConfig } from '../BotConfigProvider';

export default function ContextPage() {
  const { config, updateConfig, isOwner } = useBotConfig();

  return (
    <div className="p-8 pb-20 animate-in fade-in duration-300">
      <div className="mb-8">
        <h1 className="text-xl font-semibold tracking-tight text-gray-900">Page Context</h1>
        <p className="text-sm text-gray-500 mt-1 leading-relaxed">Enable the AI to see which page your user is currently viewing.</p>
      </div>

      <div className="space-y-8 bg-white border border-gray-200 p-6 rounded-md">
        <section>
          <div className="flex items-center justify-between">
            <div>
              <label className="block text-sm font-semibold text-gray-900">Share Current URL</label>
              <p className="text-[11px] text-gray-500 mt-0.5 font-medium">
                When enabled, the chatbot will receive the URL of the page the user is on.
                This allows it to provide specific answers based on the page (e.g., "Pricing" vs "Home").
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                className="sr-only peer"
                checked={config.pageContextEnabled}
                onChange={(e) => updateConfig('pageContextEnabled', e.target.checked)}
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
