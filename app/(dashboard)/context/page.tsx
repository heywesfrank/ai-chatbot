'use client';

import { useBotConfig } from '../BotConfigProvider';

export default function ContextPage() {
  const { config, updateConfig, isOwner } = useBotConfig();

  return (
    <div className="max-w-3xl mx-auto py-12 px-8">
      <div className="mb-10">
        <h2 className="text-xl font-semibold text-gray-900">Page Context</h2>
        <p className="text-sm text-gray-500 mt-1">
          Enable the AI to see which page your user is currently viewing.
        </p>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h3 className="text-sm font-medium text-gray-900">Share Current URL</h3>
            <p className="text-xs text-gray-500 max-w-md">
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
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-black"></div>
          </label>
        </div>
      </div>
    </div>
  );
}
