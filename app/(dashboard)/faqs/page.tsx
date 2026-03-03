'use client';
import { useState, useEffect } from 'react';
import { supabaseClient as supabase } from '@/lib/supabase-client';
import { toast } from 'sonner';
import { useBotConfig } from '../BotConfigProvider';

export default function FAQsPage() {
  const { activeSpaceId, triggerRefresh } = useBotConfig();
  const [faqs, setFaqs] = useState<any[]>([]);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');

  const fetchFaqs = async () => {
    if (!activeSpaceId) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const res = await fetch('/api/faq', { headers: { 'Authorization': `Bearer ${session.access_token}` } });
    if (res.ok) {
      const data = await res.json();
      setFaqs(data.faqs || []);
    }
  };

  useEffect(() => { fetchFaqs(); }, [activeSpaceId]);

  const handleAddFaq = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || !answer.trim() || !activeSpaceId) return;
    
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    await fetch('/api/faq', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify({ spaceId: activeSpaceId, question, answer })
    });
    
    toast.success('FAQ Override added.');
    setQuestion('');
    setAnswer('');
    fetchFaqs();
    triggerRefresh();
  };

  const removeFaq = async (id: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await fetch(`/api/faq?id=${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${session.access_token}` } });
    toast.success('FAQ removed.');
    fetchFaqs();
    triggerRefresh();
  };

  return (
    <div className="p-4 sm:p-8 pb-20 animate-in fade-in duration-300">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl font-semibold tracking-tight text-gray-900">Custom FAQs</h1>
        <p className="text-sm text-gray-500 mt-1 leading-relaxed">Bypass the AI and force an exact response to specific user questions. Helpful for complex pricing or precise disclaimers.</p>
      </div>

      <form onSubmit={handleAddFaq} className="bg-white border border-gray-200 rounded-md p-4 sm:p-6 mb-6 sm:mb-8 flex flex-col gap-4">
        <div>
          <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">Exact Question Match</label>
          <input required type="text" placeholder="e.g. What is your pricing?" className="w-full p-2.5 border border-gray-200 rounded-md text-sm outline-none focus:border-black transition-colors" value={question} onChange={e => setQuestion(e.target.value)} />
        </div>
        <div>
          <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">Exact Answer Reply</label>
          <textarea required placeholder="Write the response here..." className="w-full p-2.5 border border-gray-200 rounded-md text-sm h-24 outline-none focus:border-black resize-none transition-colors" value={answer} onChange={e => setAnswer(e.target.value)} />
        </div>
        <button type="submit" className="w-full sm:w-auto sm:self-end px-6 py-2.5 bg-black text-white text-sm font-medium rounded-md hover:bg-gray-800 transition-colors">Add Override</button>
      </form>

      <div className="bg-white border border-gray-200 rounded-md">
        <div className="p-4 sm:p-6 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Active Overrides</h2>
        </div>
        {faqs.length === 0 ? (
          <div className="p-8 sm:p-10 text-center text-sm text-gray-500">
            No FAQ overrides added.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {faqs.map(faq => (
              <div key={faq.id} className="p-4 sm:p-6 flex flex-col sm:flex-row justify-between items-start hover:bg-gray-50/50 transition-colors group gap-4 sm:gap-0">
                <div className="pr-0 sm:pr-8 w-full">
                  <p className="text-[13px] font-semibold text-gray-900 mb-1 flex items-start gap-2">
                    <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-bold uppercase shrink-0 mt-0.5">Q</span>
                    <span className="break-words">{faq.question}</span>
                  </p>
                  <p className="text-[13px] text-gray-600 mt-2 flex items-start gap-2 leading-relaxed">
                    <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-bold uppercase mt-0.5 shrink-0">A</span>
                    <span className="break-words">{faq.answer}</span>
                  </p>
                </div>
                <button onClick={() => removeFaq(faq.id)} className="w-full sm:w-auto text-xs text-red-500 hover:text-red-700 font-medium shrink-0 transition-colors bg-red-50 px-3 py-2 sm:py-1.5 rounded-md opacity-100 sm:opacity-0 group-hover:opacity-100 focus:opacity-100 self-end sm:self-auto">Remove</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
