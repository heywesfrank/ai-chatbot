'use client';
import { useState, useEffect } from 'react';
import { supabaseClient as supabase } from '@/lib/supabase-client';
import { toast } from 'sonner';
import { useBotConfig } from '../BotConfigProvider';

export default function TriggersPage() {
  const { activeSpaceId, isOwner } = useBotConfig();
  const [triggers, setTriggers] = useState<any[]>([]);
  const [urlMatch, setUrlMatch] = useState('');
  const [delaySeconds, setDelaySeconds] = useState<number>(10);
  const [message, setMessage] = useState('');

  const fetchTriggers = async () => {
    if (!activeSpaceId) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const res = await fetch('/api/triggers', { headers: { 'Authorization': `Bearer ${session.access_token}` } });
    if (res.ok) {
      const data = await res.json();
      setTriggers(data.triggers || []);
    }
  };

  useEffect(() => { fetchTriggers(); }, [activeSpaceId]);

  const handleAddTrigger = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlMatch.trim() || !message.trim() || !activeSpaceId || !isOwner) return;
    
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const res = await fetch('/api/triggers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify({ spaceId: activeSpaceId, urlMatch, delaySeconds, message })
    });
    
    if (res.ok) {
      toast.success('Trigger added.');
      setUrlMatch('');
      setDelaySeconds(10);
      setMessage('');
      fetchTriggers();
    } else {
      toast.error('Failed to add trigger.');
    }
  };

  const removeTrigger = async (id: string) => {
    if (!isOwner) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const res = await fetch(`/api/triggers?id=${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${session.access_token}` } });
    
    if (res.ok) {
      toast.success('Trigger removed.');
      fetchTriggers();
    } else {
      toast.error('Failed to remove trigger.');
    }
  };

  return (
    <div className="p-4 sm:p-8 pb-20 animate-in fade-in duration-300">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl font-semibold tracking-tight text-gray-900">Proactive Triggers</h1>
        <p className="text-sm text-gray-500 mt-1 leading-relaxed">Automatically pop open the chat widget and send a message if a user spends time on a specific page.</p>
      </div>

      {isOwner && (
        <form onSubmit={handleAddTrigger} className="bg-white border border-gray-200 rounded-md p-4 sm:p-6 mb-6 sm:mb-8 flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">URL Path Match</label>
              <input required type="text" placeholder="e.g. /pricing or https://yourwebsite.com/pricing" className="w-full p-2.5 border border-gray-200 rounded-md text-sm outline-none focus:border-black transition-colors" value={urlMatch} onChange={e => setUrlMatch(e.target.value)} />
            </div>
            <div className="w-full sm:w-32">
              <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">Delay (Secs)</label>
              <input required type="number" min="0" className="w-full p-2.5 border border-gray-200 rounded-md text-sm outline-none focus:border-black transition-colors" value={delaySeconds} onChange={e => setDelaySeconds(Number(e.target.value))} />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">Initial Message</label>
            <textarea required placeholder="e.g. Need help picking a plan?" className="w-full p-2.5 border border-gray-200 rounded-md text-sm h-20 outline-none focus:border-black resize-none transition-colors" value={message} onChange={e => setMessage(e.target.value)} />
          </div>
          <button type="submit" className="w-full sm:w-auto sm:self-end px-6 py-2.5 bg-black text-white text-sm font-medium rounded-md hover:bg-gray-800 transition-colors">Add Trigger</button>
        </form>
      )}

      <div className="bg-white border border-gray-200 rounded-md">
        <div className="p-4 sm:p-6 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Active Triggers</h2>
        </div>
        {triggers.length === 0 ? (
          <div className="p-8 sm:p-10 text-center text-sm text-gray-500">
            No triggers added.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {triggers.map(trigger => (
              <div key={trigger.id} className="p-4 sm:p-6 flex flex-col sm:flex-row justify-between items-start hover:bg-gray-50/50 transition-colors group gap-4 sm:gap-0">
                <div className="pr-0 sm:pr-8 w-full">
                  <p className="text-[13px] font-semibold text-gray-900 mb-1 flex items-start gap-2">
                    <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-bold uppercase shrink-0 mt-0.5">If</span>
                    <span className="break-words">{trigger.url_match} <span className="text-gray-400 font-normal ml-1">after {trigger.delay_seconds}s</span></span>
                  </p>
                  <p className="text-[13px] text-gray-600 mt-2 flex items-start gap-2 leading-relaxed">
                    <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-bold uppercase mt-0.5 shrink-0">Send</span>
                    <span className="break-words">{trigger.message}</span>
                  </p>
                </div>
                {isOwner && (
                  <button onClick={() => removeTrigger(trigger.id)} className="w-full sm:w-auto text-xs text-red-500 hover:text-red-700 font-medium shrink-0 transition-colors bg-red-50 px-3 py-2 sm:py-1.5 rounded-md opacity-100 sm:opacity-0 group-hover:opacity-100 focus:opacity-100 self-end sm:self-auto">Remove</button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
