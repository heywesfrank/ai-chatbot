'use client';

import { useState } from 'react';
import { useBotConfig } from '../BotConfigProvider';
import { ClearIcon } from '@/components/icons';

export default function ContextAndRoutingPage() {
  const { config, updateConfig, isOwner } = useBotConfig();
  const [newLabel, setNewLabel] = useState('');
  const [newValue, setNewValue] = useState('');

  const routes = config.routingConfig || [];

  const addRoute = () => {
    if (!newLabel.trim() || !newValue.trim()) return;
    const newRoute = { 
      id: Math.random().toString(36).substr(2, 9), 
      label: newLabel, 
      value: newValue 
    };
    updateConfig('routingConfig', [...routes, newRoute]);
    setNewLabel('');
    setNewValue('');
  };

  const removeRoute = (id: string) => {
    updateConfig('routingConfig', routes.filter((r: any) => r.id !== id));
  };

  return (
    <div className="p-8 pb-20 animate-in fade-in duration-300">
      <div className="mb-8">
        <h1 className="text-xl font-semibold tracking-tight text-gray-900">Context & Routing</h1>
        <p className="text-sm text-gray-500 mt-1 leading-relaxed">Provide the AI with invisible background context and present pre-chat routing options to users.</p>
      </div>

      <div className="space-y-8 bg-white border border-gray-200 p-6 rounded-md">
        
        {/* Page Context Section */}
        <section>
          <div className="flex items-center justify-between">
            <div className="pr-4">
              <label className="block text-sm font-semibold text-gray-900">Share Current URL</label>
              <p className="text-[11px] text-gray-500 mt-0.5 font-medium">
                When enabled, the chatbot will invisibly receive the URL of the page the user is currently viewing.
                This allows it to provide specific answers based on their location (e.g., "Pricing" vs "Home").
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
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

        {/* Routing Section */}
        <section className="pt-8 border-t border-gray-100">
          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-900">Pre-Chat Routing Options</label>
            <p className="text-[11px] text-gray-500 mt-0.5 font-medium">Add buttons that users must click before chatting. This sets a hidden instruction for the AI based on their choice.</p>
          </div>

          <div className="space-y-3 mb-6">
            {routes.length === 0 && (
              <div className="p-4 bg-gray-50/50 rounded-md border border-gray-200 text-center">
                <p className="text-xs text-gray-500 italic">No routing options configured yet.</p>
              </div>
            )}
            {routes.map((route: any) => (
              <div key={route.id} className="flex items-center justify-between p-3 bg-gray-50/50 rounded-md border border-gray-200 group">
                <div className="flex-1 grid grid-cols-2 gap-4">
                  <div>
                    <span className="block text-[10px] uppercase font-bold text-gray-400 tracking-wider">Button Label</span>
                    <span className="block text-sm font-medium text-gray-900">{route.label}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase font-bold text-gray-400 tracking-wider">AI Context</span>
                    <span className="block text-sm text-gray-600 truncate">{route.value}</span>
                  </div>
                </div>
                {isOwner && (
                  <button onClick={() => removeRoute(route.id)} className="ml-3 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-all opacity-0 group-hover:opacity-100">
                    <ClearIcon className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {isOwner && (
            <div className="flex flex-col sm:flex-row items-end gap-3 pt-4 border-t border-gray-100">
              <div className="flex-1 w-full">
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Button Label</label>
                <input
                  type="text"
                  placeholder="e.g., Support"
                  className="w-full p-2.5 border border-gray-200 rounded-md text-sm outline-none focus:border-black transition-colors"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                />
              </div>
              <div className="flex-[2] w-full">
                <label className="block text-xs font-medium text-gray-700 mb-1.5">AI Context Instruction</label>
                <input
                  type="text"
                  placeholder="e.g., The user is asking about Support."
                  className="w-full p-2.5 border border-gray-200 rounded-md text-sm outline-none focus:border-black transition-colors"
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                />
              </div>
              <button 
                onClick={addRoute}
                disabled={!newLabel.trim() || !newValue.trim()}
                className="w-full sm:w-auto px-4 py-2.5 bg-black text-white text-sm font-medium rounded-md hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed h-[42px]"
              >
                Add
              </button>
            </div>
          )}
        </section>

      </div>
    </div>
  );
}
