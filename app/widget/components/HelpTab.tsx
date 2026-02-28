// app/widget/components/HelpTab.tsx
import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import { ChevronDownIcon } from '@/components/icons';

export default function HelpTab({ spaceId, primaryColor }: any) {
  const [articles, setArticles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedArticle, setSelectedArticle] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetch(`/api/widget-help?spaceId=${spaceId}`)
      .then(res => res.json())
      .then(data => {
        if (data.articles) setArticles(data.articles);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [spaceId]);

  if (selectedArticle) {
    return (
      <div className="flex flex-col h-full bg-[var(--bg-primary)]">
        <div className="p-4 border-b border-[var(--border-strong)] flex items-center gap-2 sticky top-0 bg-[var(--bg-primary)] z-10 shrink-0">
          <button onClick={() => setSelectedArticle(null)} className="p-1.5 hover:bg-[var(--bg-secondary)] rounded-md transition-colors text-[var(--text-secondary)] -ml-2">
            <svg className="w-5 h-5 rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </button>
          <h2 className="font-semibold text-[var(--text-primary)] text-sm truncate pr-4">{selectedArticle.title}</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-5 pb-6">
          <h1 className="text-xl font-bold text-[var(--text-primary)] mb-5">{selectedArticle.title}</h1>
          <div className="prose prose-sm max-w-none text-[var(--text-primary)] prose-a:text-blue-500 prose-headings:text-[var(--text-primary)] prose-strong:text-[var(--text-primary)] prose-img:rounded-xl leading-relaxed whitespace-pre-wrap">
            <ReactMarkdown rehypePlugins={[rehypeRaw]}>{selectedArticle.content}</ReactMarkdown>
          </div>
        </div>
      </div>
    );
  }

  const filtered = articles.filter(a => a.title.toLowerCase().includes(searchQuery.toLowerCase()));
  const grouped = filtered.reduce((acc, a) => {
    const c = a.category || 'General';
    if (!acc[c]) acc[c] = [];
    acc[c].push(a);
    return acc;
  }, {} as any);

  return (
    <div className="flex flex-col h-full bg-[var(--bg-primary)]">
      <div className="p-5 border-b border-[var(--border-strong)] shrink-0 bg-[var(--bg-primary)] sticky top-0 z-10">
        <h2 className="font-semibold text-[var(--text-primary)] text-lg mb-3">Help Center</h2>
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input 
            type="text" 
            placeholder="Search articles..." 
            value={searchQuery} 
            onChange={e => setSearchQuery(e.target.value)} 
            className="w-full pl-9 pr-3 py-2.5 bg-[var(--input-bg)] border border-[var(--border-strong)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:border-transparent focus:ring-2 transition-all shadow-sm" 
            style={{ '--tw-ring-color': primaryColor } as any} 
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-5 pb-6">
        {loading ? (
          <div className="flex justify-center p-4"><div className="w-5 h-5 border-2 border-[var(--text-secondary)] border-t-transparent rounded-full animate-spin" /></div>
        ) : Object.keys(grouped).length === 0 ? (
          <p className="text-center text-[var(--text-secondary)] text-sm">No articles found.</p>
        ) : (
          Object.keys(grouped).sort().map(cat => (
            <div key={cat} className="mb-6 last:mb-0">
              <h3 className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2.5">{cat}</h3>
              <div className="flex flex-col gap-1.5">
                {grouped[cat].map((a: any) => (
                  <button key={a.id} onClick={() => setSelectedArticle(a)} className="text-left p-3.5 bg-[var(--bg-secondary)] hover:bg-[var(--border-strong)] rounded-xl text-sm text-[var(--text-primary)] transition-colors shadow-sm border border-transparent hover:border-[var(--border-strong)]">
                    <span className="font-medium line-clamp-2 leading-snug">{a.title}</span>
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
