// app/(dashboard)/behavior/page.tsx
'use client';
import { useState } from 'react';
import { useBotConfig } from '../BotConfigProvider';

export default function BehaviorPage() {
  const { config, updateConfig, isOwner } = useBotConfig();
  const [newPrompt, setNewPrompt] = useState('');

  const handleAddPrompt = () => {
    const p = newPrompt.trim();
    if (!p || !isOwner) return;
    const existingPrompts = config.suggestedPrompts ?? [];
    if (existingPrompts.includes(p)) { setNewPrompt(''); return; }
    updateConfig('suggestedPrompts', [...existingPrompts, p]);
    setNewPrompt('');
  };

  const handleRemovePrompt = (promptToRemove: string) => {
    if (isOwner) {
      const existingPrompts = config.suggestedPrompts ?? [];
      updateConfig('suggestedPrompts', existingPrompts.filter((p: string) => p !== promptToRemove));
    }
  };

  return (
    <div className="p-4 sm:p-8 pb-20 animate-in fade-in duration-300">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl font-semibold tracking-tight text-gray-900">Behavior</h1>
        <p className="text-sm text-gray-500 mt-1 leading-relaxed">Control how your bot responds and interacts with users.</p>
      </div>

      <div className="space-y-6 sm:space-y-8 bg-white border border-gray-200 p-4 sm:p-6 rounded-md">
        <section>
          <label className="block text-sm font-semibold text-gray-900 mb-2">System Prompt</label>
          <textarea className="w-full p-3 border border-gray-200 rounded-md text-sm h-32 outline-none focus:border-black resize-none transition-colors bg-gray-50/50" value={config.systemPrompt ?? ''} disabled={!isOwner} onChange={(e) => updateConfig('systemPrompt', e.target.value)} />
          <p className="text-[11px] text-gray-500 mt-1.5 font-medium">Define the persona, tone, and specific instructions for your bot.</p>
        </section>

        <section>
          <div className="flex items-start sm:items-center justify-between gap-4 mb-3">
            <div>
              <label className="block text-sm font-semibold text-gray-900">Suggested Prompts</label>
              <p className="text-[11px] text-gray-500 mt-0.5 font-medium">Show helpful quick-replies to users when they open the chat.</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input type="checkbox" className="sr-only peer" disabled={!isOwner} checked={config.showPrompts ?? true} onChange={(e) => updateConfig('showPrompts', e.target.checked)} />
              <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-black"></div>
            </label>
          </div>
          {(config.showPrompts ?? true) && (
            <div className="p-3 sm:p-4 bg-gray-50/50 rounded-md border border-gray-200 space-y-3">
              <div className="flex gap-2">
                <input type="text" placeholder="Add a prompt..." disabled={!isOwner} className="flex-1 p-2.5 border border-gray-200 rounded-md text-sm outline-none focus:border-black transition-colors min-w-0" value={newPrompt} onChange={(e) => setNewPrompt(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddPrompt(); } }} />
                <button onClick={(e) => { e.preventDefault(); handleAddPrompt(); }} disabled={!newPrompt.trim() || !isOwner} className="px-4 sm:px-5 bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50 shrink-0">Add</button>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                {(config.suggestedPrompts ?? []).map((prompt: string) => (
                  <span key={prompt} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-md text-[11px] font-medium text-gray-700">
                    <span className="truncate max-w-[200px] sm:max-w-[250px]">{prompt}</span>
                    <button onClick={() => handleRemovePrompt(prompt)} disabled={!isOwner} className="text-gray-400 hover:text-red-500 transition-colors shrink-0">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>

        <section>
          <div className="flex items-start sm:items-center justify-between gap-4 border-t border-gray-100 pt-6 sm:pt-8">
            <div>
              <label className="block text-sm font-semibold text-gray-900">Interactive Follow-ups</label>
              <p className="text-[11px] text-gray-500 mt-0.5 font-medium">Have the AI automatically suggest 3 dynamic follow-up questions at the end of its response.</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input type="checkbox" className="sr-only peer" disabled={!isOwner} checked={config.followUpQuestionsEnabled ?? false} onChange={(e) => updateConfig('followUpQuestionsEnabled', e.target.checked)} />
              <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-black"></div>
            </label>
          </div>
        </section>

        <section>
          <div className="flex items-start sm:items-center justify-between gap-4 border-t border-gray-100 pt-6 sm:pt-8 mb-4 sm:mb-6">
            <div>
              <label className="block text-sm font-semibold text-gray-900">Lead Capture</label>
              <p className="text-[11px] text-gray-500 mt-0.5 font-medium">Require visitors to enter their name and email before chatting.</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input type="checkbox" className="sr-only peer" disabled={!isOwner} checked={config.leadCaptureEnabled ?? false} onChange={(e) => updateConfig('leadCaptureEnabled', e.target.checked)} />
              <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-black"></div>
            </label>
          </div>
        </section>

        <section className="border-t border-gray-100 pt-6 sm:pt-8">
          <label className="block text-sm font-semibold text-gray-900 mb-2">Bot Language</label>
          <select className="w-full p-2.5 border border-gray-200 rounded-md text-sm outline-none focus:border-black bg-white transition-colors cursor-pointer" value={config.language ?? 'Auto-detect'} disabled={!isOwner} onChange={(e) => updateConfig('language', e.target.value)}>
            <option value="Auto-detect">Auto-detect</option>
            <option value="English">English</option>
            <option value="Spanish">Spanish</option>
            <option value="French">French</option>
            <option value="German">German</option>
          </select>
          <p className="text-[11px] text-gray-500 mt-1.5 font-medium">Force the bot to respond in a specific language, or auto-detect based on user input.</p>
        </section>
      </div>
    </div>
  );
}
