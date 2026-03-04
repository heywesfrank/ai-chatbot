// app/help/[spaceId]/page.tsx
import { supabase } from '@/lib/supabase';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Metadata } from 'next';
import HelpCenterHero from '../components/HelpCenterHero';

export const revalidate = 60; 

export async function generateMetadata({ params }: { params: { spaceId: string } }): Promise<Metadata> {
  const { data: config } = await supabase.from('bot_config').select('workspace_name').eq('space_id', params.spaceId).maybeSingle();
  return {
    title: `${config?.workspace_name || 'Help Center'} - Documentation`,
    description: `Browse support articles and documentation for ${config?.workspace_name || 'our product'}.`,
  };
}

export default async function HelpCenterIndex({ params, searchParams }: { params: { spaceId: string }, searchParams: { q?: string } }) {
  const { data: config } = await supabase.from('bot_config')
    .select('workspace_name, primary_color, bot_avatar, help_search_placeholder, help_center_color, help_center_bg_image')
    .eq('space_id', params.spaceId)
    .maybeSingle();

  if (!config) notFound();

  // Fetch only published articles
  const { data: articles } = await supabase.from('help_center_articles')
    .select('id, title, category, content, slug')
    .eq('space_id', params.spaceId)
    .eq('status', 'published')
    .order('created_at', { ascending: false });

  const searchQuery = searchParams.q?.toLowerCase() || '';
  
  // Filter for search results if a query exists
  const searchResults = searchQuery 
    ? articles?.filter(a => a.title.toLowerCase().includes(searchQuery) || a.content.toLowerCase().includes(searchQuery)) || []
    : [];

  const grouped = articles?.reduce((acc, article) => {
    const cat = article.category || 'General';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(article);
    return acc;
  }, {} as Record<string, any[]>) || {};

  const categories = Object.keys(grouped).sort();

  return (
    <div className="bg-[#FAFAFA] min-h-screen text-gray-900 font-sans">
      <HelpCenterHero config={config} spaceId={params.spaceId} searchQuery={searchQuery} />

      <main className="max-w-5xl mx-auto w-full px-4 sm:px-6 py-8 sm:py-12">
        {searchQuery ? (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-6">Search results for "{searchQuery}"</h2>
            {searchResults.length === 0 ? (
              <p className="text-gray-500 text-sm">No articles found matching your query.</p>
            ) : (
              <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                {searchResults.map(article => (
                  <Link key={article.id} href={`/help/${params.spaceId}/${article.slug || article.id}`} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-6 border-b border-gray-100 hover:bg-gray-50 transition-colors group last:border-0 gap-4">
                    <div className="flex flex-col">
                      <span className="text-[17px] font-medium text-gray-900 group-hover:text-blue-600 transition-colors mb-1">{article.title}</span>
                      <span className="text-[15px] text-gray-500 line-clamp-1">{article.content.replace(/<[^>]*>?/gm, '').substring(0, 150)}...</span>
                    </div>
                    <svg className="w-5 h-5 text-gray-400 shrink-0 hidden sm:block group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </Link>
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            {categories.length === 0 ? (
              <div className="text-center py-20 text-gray-500">
                No articles have been published yet.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {categories.map(category => (
                  <Link key={category} href={`/help/${params.spaceId}/category/${encodeURIComponent(category)}`} className="flex items-start gap-4 p-4 sm:p-6 border border-gray-200 rounded-2xl bg-white hover:border-gray-300 transition-all group">
                    <div className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center shrink-0 border border-gray-100 group-hover:bg-white transition-colors text-gray-500 group-hover:text-gray-900">
                      <svg className="w-6 h-6 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                      </svg>
                    </div>
                    <div>
                      <h2 className="text-[17px] font-semibold text-gray-900 mb-1 leading-tight group-hover:text-blue-600 transition-colors">{category}</h2>
                      <p className="text-[14px] text-gray-500">{grouped[category].length} {grouped[category].length === 1 ? 'article' : 'articles'}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
