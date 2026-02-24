// app/(dashboard)/model/page.tsx
'use client';
import { useBotConfig } from '../BotConfigProvider';

export default function ModelPage() {
  const { config, updateConfig, isOwner } = useBotConfig();

  return (
    <div className="p-8 pb-20 max-w-[800px] animate-in fade-in duration-300">
      <div className="mb-8">
        <h1 className="text-xl font-semibold tracking-tight text-gray-900">AI Model Settings</h1>
        <p className="text-sm text-gray-500 mt-1 leading-relaxed">Fine-tune the intelligence, strictness, and verbosity of your AI agent.</p>
      </div>

      <div className="space-y-8 bg-white border border-gray-200 p-6 rounded-md shadow-sm">
        
        <section>
          <div className="flex justify-between mb-2">
            <label className="block text-sm font-semibold text-gray-900">Match Threshold</label>
            <span className="text-[11px] text-gray-500 font-bold bg-gray-100 px-2 py-0.5 rounded border border-gray-200">{config.matchThreshold}</span>
          </div>
          <input type="range" min="0" max="1" step="0.05" disabled={!isOwner} className="w-full max-w-md accent-black h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer mt-1" value={config.matchThreshold} onChange={(e) => updateConfig('matchThreshold', parseFloat(e.target.value))} />
          <p className="text-[11px] text-gray-500 mt-2 font-medium max-w-md">Controls how strictly the AI matches user queries to your knowledge base. Lower values pull more documents (broader), higher values pull fewer (stricter).</p>
        </section>

        <section className="border-t border-gray-100 pt-8">
          <div className="flex justify-between mb-2">
            <label className="block text-sm font-semibold text-gray-900">Temperature</label>
            <span className="text-[11px] text-gray-500 font-bold bg-gray-100 px-2 py-0.5 rounded border border-gray-200">{config.temperature}</span>
          </div>
          <input type="range" min="0" max="2" step="0.1" disabled={!isOwner} className="w-full max-w-md accent-black h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer mt-1" value={config.temperature} onChange={(e) => updateConfig('temperature', parseFloat(e.target.value))} />
          <p className="text-[11px] text-gray-500 mt-2 font-medium max-w-md">Controls the creativity of the AI. Lower values produce more focused, deterministic responses. Higher values produce more creative output.</p>
        </section>

        <section className="border-t border-gray-100 pt-8">
          <label className="block text-sm font-semibold text-gray-900 mb-2">Reasoning Effort (GPT-5)</label>
          <select className="w-full max-w-md p-2.5 border border-gray-200 rounded-md text-sm outline-none focus:border-black bg-white shadow-sm transition-colors cursor-pointer" value={config.reasoningEffort} disabled={!isOwner} onChange={(e) => updateConfig('reasoningEffort', e.target.value)}>
            <option value="low">Low (Faster)</option>
            <option value="medium">Medium (Balanced)</option>
            <option value="high">High (Deep thinking)</option>
          </select>
          <p className="text-[11px] text-gray-500 mt-1.5 font-medium max-w-md">Adjusts the cognitive effort the model spends before answering complex user queries.</p>
        </section>

        <section className="border-t border-gray-100 pt-8">
          <label className="block text-sm font-semibold text-gray-900 mb-2">Verbosity</label>
          <select className="w-full max-w-md p-2.5 border border-gray-200 rounded-md text-sm outline-none focus:border-black bg-white shadow-sm transition-colors cursor-pointer" value={config.verbosity} disabled={!isOwner} onChange={(e) => updateConfig('verbosity', e.target.value)}>
            <option value="low">Low (Concise)</option>
            <option value="medium">Medium</option>
            <option value="high">High (Detailed)</option>
          </select>
          <p className="text-[11px] text-gray-500 mt-1.5 font-medium max-w-md">Instructs the AI on how long and detailed its responses should be.</p>
        </section>

      </div>
    </div>
  );
}
