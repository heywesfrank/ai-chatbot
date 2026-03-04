// app/help/components/ArticleFeedback.tsx
'use client';

import { useState, useEffect, useRef } from 'react';

export default function ArticleFeedback({ articleId }: { articleId: string }) {
  const [status, setStatus] = useState<'idle' | 'submitting' | 'submitted'>('idle');
  const viewed = useRef(false);

  // Ping a view count exactly once when the component mounts
  useEffect(() => {
    if (!viewed.current) {
      viewed.current = true;
      fetch('/api/article-analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleId, action: 'view' })
      }).catch(() => {});
    }
  }, [articleId]);

  const handleVote = async (action: 'upvote' | 'neutral' | 'downvote') => {
    if (status !== 'idle') return;
    setStatus('submitting');
    try {
      await fetch('/api/article-analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleId, action })
      });
      setStatus('submitted');
    } catch (e) {
      setStatus('idle');
    }
  };

  return (
    <div className="mt-10 sm:mt-16 p-6 sm:p-8 bg-[#F9FAFB] rounded-xl flex flex-col items-center justify-center transition-all border border-gray-100/50">
      <span className="text-[15px] font-medium text-gray-700 mb-5 text-center">Did this answer your question?</span>
      
      {status === 'submitted' ? (
        <div className="flex items-center gap-2 text-sm text-green-600 font-medium animate-in fade-in zoom-in duration-300">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          Thanks for your feedback!
        </div>
      ) : (
        <div className="flex gap-4">
          <button 
            onClick={() => handleVote('downvote')}
            disabled={status === 'submitting'}
            className="text-[32px] hover:scale-110 active:scale-95 transition-transform grayscale hover:grayscale-0 focus:outline-none disabled:opacity-50"
            title="No"
          >
            😞
          </button>
          <button 
            onClick={() => handleVote('neutral')}
            disabled={status === 'submitting'}
            className="text-[32px] hover:scale-110 active:scale-95 transition-transform grayscale hover:grayscale-0 focus:outline-none disabled:opacity-50"
            title="Somewhat"
          >
            😐
          </button>
          <button 
            onClick={() => handleVote('upvote')}
            disabled={status === 'submitting'}
            className="text-[32px] hover:scale-110 active:scale-95 transition-transform grayscale hover:grayscale-0 focus:outline-none disabled:opacity-50"
            title="Yes"
          >
            😃
          </button>
        </div>
      )}
    </div>
  );
}
