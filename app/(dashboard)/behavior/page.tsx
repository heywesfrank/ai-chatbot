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
    if (config.suggestedPrompts.includes(p)) { setNewPrompt(''); return; }
    updateConfig('suggestedPrompts', [...config.suggestedPrompts, p]);
    setNewPrompt('');
  };

  const handleRemovePrompt = (promptToRemove: string) => {
    if (isOwner) updateConfig('suggestedPrompts', config.suggestedPrompts.filter((p: string) => p !== promptToRemove));
  };

  return (
    <div className="p-8 pb-20 max-w-[800px] animate-in fade-in duration-300">
      <div className="mb-8">
        <h1 className="text-xl font-semibold tracking-tight text-gray-900">Behavior & Model</h1>
        <p className="text-sm text-gray-500 mt-1 leading-relaxed">Control how your bot responds and processes information. This serves as the "brain" of your agent.</p>
      </div>

      <div className="space-y-8 bg-white border border-gray-200 p-6 rounded-md shadow-sm">
        <section>
          <label className="block text-sm font-semibold text-gray-900 mb-2">System Prompt</label>
          <textarea className="w-full p-3 border border-gray-200 rounded-md text-sm h-32 outline-none focus:border-black resize-none transition-colors bg-gray-50/50" value={config.systemPrompt} disabled={!isOwner} onChange={(e) => updateConfig('systemPrompt', e.target.value)} />
          <p className="text-[11px] text-gray-500 mt-1.5 font-medium">Define the persona, tone, and specific instructions for your bot.</p>
        </section>

        <section>
          <div className="flex items-center justify-between mb-3">
            <div>
              <label className="block text-sm font-semibold text-gray-900">Suggested Prompts</label>
              <p className="text-[11px] text-gray-500 mt-0.5 font-medium">Show helpful quick-replies to users when they open the chat.</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" disabled={!isOwner} checked={config.showPrompts} onChange={(e) => updateConfig('showPrompts', e.target.checked)} />
              <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-black"></div>
            </label>
          </div>
          {config.showPrompts && (
            <div className="p-4 bg-gray-50/50 rounded-md border border-gray-200 space-y-3">
              <div className="flex gap-2">
                <input type="text" placeholder="Add a prompt..." disabled={!isOwner} className="flex-1 p-2.5 border border-gray-200 rounded-md text-sm outline-none focus:border-black shadow-sm transition-colors" value={newPrompt} onChange={(e) => setNewPrompt(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddPrompt(); } }} />
                <button onClick={(e) => { e.preventDefault(); handleAddPrompt(); }} disabled={!newPrompt.trim() || !isOwner} className="px-5 bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50 shadow-sm transition-colors disabled:opacity-50">Add</button>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                {config.suggestedPrompts.map((prompt: string) => (
                  <span key={prompt} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-md text-[11px] font-medium text-gray-700 shadow-sm">
                    <span className="truncate max-w-[250px]">{prompt}</span>
                    <button onClick={() => handleRemovePrompt(prompt)} disabled={!isOwner} className="text-gray-400 hover:text-red-500 transition-colors">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>

        <section>
          <div className="flex items-center justify-between border-t border-gray-100 pt-8">
            <div>
              <label className="block text-sm font-semibold text-gray-900">Lead Capture</label>
              <p className="text-[11px] text-gray-500 mt-0.5 font-medium">Require visitors to enter their name and email before chatting.</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" disabled={!isOwner} checked={config.leadCaptureEnabled} onChange={(e) => updateConfig('leadCaptureEnabled', e.target.checked)} />
              <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-black"></div>
            </label>
          </div>
        </section>

        <div className="border-t border-gray-100 pt-8 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
          <section>
            <label className="block text-sm font-semibold text-gray-900 mb-2">Bot Language</label>
            <select className="w-full p-2.5 border border-gray-200 rounded-md text-sm outline-none focus:border-black bg-white shadow-sm transition-colors cursor-pointer" value={config.language} disabled={!isOwner} onChange={(e) => updateConfig('language', e.target.value)}>
              <option value="Auto-detect">Auto-detect</option>
              <option value="English">English</option>
              <option value="Spanish">Spanish</option>
              <option value="French">French</option>
              <option value="German">German</option>
            </select>
          </section>

          <section>
            <div className="flex justify-between mb-2">
              <label className="block text-sm font-semibold text-gray-900">Match Threshold</label>
              <span className="text-[11px] text-gray-500 font-bold bg-gray-100 px-2 py-0.5 rounded">{config.matchThreshold}</span>
            </div>
            <input type="range" min="0" max="1" step="0.05" disabled={!isOwner} className="w-full accent-black h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer mt-1" value={config.matchThreshold} onChange={(e) => updateConfig('matchThreshold', parseFloat(e.target.value))} />
            <p className="text-[10px] text-gray-400 mt-2 font-medium">Lower values pull more documents (broader), higher values pull fewer (stricter).</p>
          </section>

          <section>
            <label className="block text-sm font-semibold text-gray-900 mb-2">Reasoning Effort (GPT-5)</label>
            <select className="w-full p-2.5 border border-gray-200 rounded-md text-sm outline-none focus:border-black bg-white shadow-sm transition-colors cursor-pointer" value={config.reasoningEffort} disabled={!isOwner} onChange={(e) => updateConfig('reasoningEffort', e.target.value)}>
              <option value="low">Low (Faster)</option>
              <option value="medium">Medium (Balanced)</option>
              <option value="high">High (Deep thinking)</option>
            </select>
          </section>

          <section>
            <label className="block text-sm font-semibold text-gray-900 mb-2">Verbosity</label>
            <select className="w-full p-2.5 border border-gray-200 rounded-md text-sm outline-none focus:border-black bg-white shadow-sm transition-colors cursor-pointer" value={config.verbosity} disabled={!isOwner} onChange={(e) => updateConfig('verbosity', e.target.value)}>
              <option value="low">Low (Concise)</option>
              <option value="medium">Medium</option>
              <option value="high">High (Detailed)</option>
            </select>
          </section>
        </div>
      </div>
    </div>
  );
}
