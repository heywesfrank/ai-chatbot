// app/(dashboard)/settings/page.tsx
'use client';
import { useState, useEffect } from 'react';
import { useBotConfig } from '../BotConfigProvider';

export default function SettingsPage() {
  const { config, updateConfig, saveConfig, isOwner, isSaving } = useBotConfig();
  const [localName, setLocalName] = useState('');
  const [localTimezone, setLocalTimezone] = useState('');

  // Sync local state with config using strict null checks
  useEffect(() => {
    if (config) {
      setLocalName(config.workspaceName ?? 'My Workspace');
      setLocalTimezone(config.timezone ?? 'UTC');
    }
  }, [config]);

  const handleSave = async () => {
    updateConfig('workspaceName', localName);
    updateConfig('timezone', localTimezone);
    await saveConfig();
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#FAFAFA] text-gray-900 font-sans overflow-y-auto">
      <div className="max-w-[1200px] mx-auto w-full p-4 sm:p-8 pb-20 animate-in fade-in duration-300">
        
        <div className="mb-6 sm:mb-8">
          <h1 className="text-xl font-medium mb-1 tracking-tight">General Settings</h1>
          <p className="text-gray-500 text-sm leading-relaxed">Manage your workspace preferences and defaults.</p>
        </div>

        <div className="space-y-4 sm:space-y-6">
          
          <div className="bg-white border border-gray-200 rounded-sm p-4 sm:p-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Workspace Details</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5 uppercase tracking-wide">Workspace Name</label>
                <input 
                  type="text" 
                  value={localName}
                  onChange={(e) => setLocalName(e.target.value)}
                  disabled={!isOwner}
                  className="w-full sm:max-w-md p-2.5 border border-gray-200 rounded-sm text-sm outline-none focus:border-black transition-colors disabled:bg-gray-50 disabled:text-gray-400"
                />
                <p className="text-[11px] text-gray-400 mt-1.5">This name is visible to your team members in the dashboard.</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5 uppercase tracking-wide">Timezone</label>
                <select 
                  value={localTimezone}
                  onChange={(e) => setLocalTimezone(e.target.value)}
                  disabled={!isOwner}
                  className="w-full sm:max-w-md p-2.5 border border-gray-200 rounded-sm text-sm outline-none focus:border-black bg-white transition-colors cursor-pointer disabled:bg-gray-50 disabled:text-gray-400"
                >
                  <option value="UTC">UTC (Coordinated Universal Time)</option>
                  <option value="America/New_York">Eastern Time (US & Canada)</option>
                  <option value="America/Los_Angeles">Pacific Time (US & Canada)</option>
                  <option value="Europe/London">London</option>
                  <option value="Europe/Paris">Paris</option>
                  <option value="Asia/Tokyo">Tokyo</option>
                  <option value="Australia/Sydney">Sydney</option>
                </select>
                <p className="text-[11px] text-gray-400 mt-1.5">Used for analytics reporting and timestamp displays.</p>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-gray-100 flex justify-end">
               <button 
                onClick={handleSave} 
                disabled={isSaving || !isOwner}
                className="w-full sm:w-auto bg-black text-white px-5 py-2.5 rounded-sm text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
               >
                 {isSaving ? 'Saving...' : 'Save Changes'}
               </button>
            </div>
          </div>

          <div className="bg-white border border-red-100 rounded-sm p-4 sm:p-6">
            <h2 className="text-sm font-semibold text-red-600 mb-1">Danger Zone</h2>
            <p className="text-xs text-gray-500 mb-4">Irreversible actions for your workspace.</p>
            
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-red-50/50 border border-red-100 rounded-sm">
               <div>
                 <p className="text-sm font-medium text-gray-900">Delete Workspace</p>
                 <p className="text-xs text-gray-500 mt-0.5">Permanently remove all data, leads, and configuration.</p>
               </div>
               <button 
                 disabled={true} 
                 className="w-full sm:w-auto px-4 py-2.5 bg-white border border-gray-200 text-red-600 text-sm font-medium rounded-sm hover:bg-red-50 hover:border-red-200 transition-colors cursor-not-allowed opacity-60"
                 title="Contact support to delete workspace"
               >
                 Delete
               </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
