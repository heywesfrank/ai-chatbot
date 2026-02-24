'use client';

import { useState } from 'react';
import { useBotConfig } from '../BotConfigProvider';
import { ClearIcon } from '@/components/icons';

export default function RoutingPage() {
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
    <div className="max-w-3xl mx-auto py-12 px-8">
      <div className="mb-10">
        <h2 className="text-xl font-semibold text-gray-900">Pre-Chat Routing</h2>
        <p className="text-sm text-gray-500 mt-1">
          Present users with options before they start chatting to guide the conversation.
        </p>
      </div>

      <div className="space-y-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <h3 className="text-sm font-medium text-gray-900 mb-4">Routing Options</h3>
          
          <div className="space-y-3 mb-6">
            {routes.length === 0 && (
              <p className="text-sm text-gray-400 italic">No routing options configured.</p>
            )}
            {routes.map((route: any) => (
              <div key={route.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-md border border-gray-100">
                <div className="flex-1">
                  <span className="block text-sm font-medium text-gray-900">{route.label}</span>
                  <span className="block text-xs text-gray-500">Context: {route.value}</span>
                </div>
                {isOwner && (
                  <button onClick={() => removeRoute(route.id)} className="p-1 text-gray-400 hover:text-red-500">
                    <ClearIcon className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {isOwner && (
            <div className="flex gap-3 items-end border-t border-gray-100 pt-4">
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-700 mb-1">Button Label</label>
                <input
                  type="text"
                  placeholder="e.g., Support"
                  className="w-full p-2 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-black focus:border-black outline-none"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                />
              </div>
              <div className="flex-[2]">
                <label className="block text-xs font-medium text-gray-700 mb-1">AI Context Instruction</label>
                <input
                  type="text"
                  placeholder="e.g., The user is asking about Support."
                  className="w-full p-2 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-black focus:border-black outline-none"
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                />
              </div>
              <button 
                onClick={addRoute}
                className="bg-black text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-800 transition-colors"
              >
                Add
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
