// app/(dashboard)/faqs/page.tsx
'use client';
import { useState, useEffect } from 'react';
import { supabaseClient as supabase } from '@/lib/supabase-client';
import { toast } from 'sonner';

export default function FAQsPage() {
  const [faqs, setFaqs] = useState<any[]>([]);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [activeSpaceId, setActiveSpaceId] = useState<string | null>(null);

  const fetchFaqs = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const res = await fetch('/api/faq', { headers: { 'Authorization': `Bearer ${session.access_token}` } });
    if (res.ok) {
      const data = await res.json();
      setFaqs(data.faqs || []);
      if (data.spaceId) setActiveSpaceId(data.spaceId);
    }
  };

  useEffect(() => { fetchFaqs(); }, []);

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
  };

  const removeFaq = async (id: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await fetch(`/api/faq?id=${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${session.access_token}` } });
    toast.success('FAQ removed.');
    fetchFaqs();
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#FAFAFA] text-gray-900 font-sans overflow-y-auto">
      <div className="max-w-[1200px] mx-auto w-full p-8 pb-20">
        <div className="mb-8">
          <h1 className="text-xl font-medium mb-1 tracking-tight">Custom FAQs</h1>
          <p className="text-gray-500 text-sm leading-relaxed">Bypass the AI and force an exact response to specific user questions.</p>
        </div>

        <form onSubmit={handleAddFaq} className="bg-white border border-gray-200 rounded-sm p-6 mb-8 shadow-sm flex flex-col gap-3">
          <input required type="text" placeholder="Exact Question (e.g. What is your pricing?)" className="w-full p-2.5 border border-gray-200 rounded-sm text-sm outline-none focus:border-black transition-colors" value={question} onChange={e => setQuestion(e.target.value)} />
          <textarea required placeholder="Exact Answer" className="w-full p-2.5 border border-gray-200 rounded-sm text-sm h-20 outline-none focus:border-black resize-none transition-colors" value={answer} onChange={e => setAnswer(e.target.value)} />
          <button type="submit" className="self-end px-6 py-2.5 bg-black text-white text-sm font-medium rounded-sm hover:bg-gray-800 transition-colors shadow-sm">Add Override</button>
        </form>

        <div className="bg-white border border-gray-200 rounded-sm">
          <div className="p-6 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">Overrides List</h2>
          </div>
          {faqs.length === 0 ? (
            <div className="p-10 text-center text-sm text-gray-500">
              No FAQ overrides added.
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {faqs.map(faq => (
                <div key={faq.id} className="p-6 flex justify-between items-start hover:bg-gray-50/50 transition-colors">
                  <div className="pr-8">
                    <p className="text-sm font-semibold text-gray-900 mb-1">Q: {faq.question}</p>
                    <p className="text-sm text-gray-600">A: {faq.answer}</p>
                  </div>
                  <button onClick={() => removeFaq(faq.id)} className="text-sm text-red-500 hover:text-red-700 font-medium shrink-0 transition-colors">Remove</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
