// app/help/[spaceId]/category/[categoryName]/page.tsx
import { supabase } from '@/lib/supabase';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Metadata } from 'next';

export const revalidate = 60;

export async function generateMetadata({ params }: { params: { spaceId: string, categoryName: string } }): Promise<Metadata> {
  const decodedCategory = decodeURIComponent(params.categoryName);
  const { data: config } = await supabase.from('bot_config').select('workspace_name').eq('space_id', params.spaceId).maybeSingle();
  return {
    title: `${decodedCategory} | ${config?.workspace_name || 'Help Center'}`,
    description: `Articles in ${decodedCategory} collection.`,
  };
}

export default async function CategoryPage({ params }: { params: { spaceId: string, categoryName: string } }) {
  const decodedCategory = decodeURIComponent(params.categoryName);
  
  const { data: config } = await supabase.from('bot_config')
    .select('workspace_name, bot_avatar, primary_color, help_search_placeholder')
    .eq('space_id', params.spaceId)
    .maybeSingle();

  if (!config) notFound();

  // Fetch all published articles and filter in-memory to safely handle Null/'General' fallbacks
  const { data: allArticles } = await supabase.from('help_center_articles')
    .select('id, title, category, content, slug')
    .eq('space_id', params.spaceId)
    .eq('status', 'published')
    .order('created_at', { ascending: false });

  const articles = allArticles?.filter(a => (a.category || 'General') === decodedCategory) || [];
  const brandColor = config.primary_color || '#000000';

  return (
    <div className="bg-[#FAFAFA] min-h-screen text-gray-900 font-sans">
      {/* Universal Nav */}
      <nav className="px-6 py-4 flex items-center justify-between border-b border-gray-100 bg-white sticky top-0 z-50">
        <Link href={`/help/${params.spaceId}`} className="flex items-center gap-2 transition-opacity hover:opacity-80">
          {config.bot_avatar ? (
            <img src={config.bot_avatar} alt="Logo" className="h-6 w-6 rounded-md object-cover border border-gray-100" />
          ) : (
             <img src="/apoyo.png" alt="Logo" className="h-6 object-contain" />
          )}
          <span className="font-semibold text-gray-900 ml-1">{config.workspace_name || 'Help Center'}</span>
        </Link>
        <div className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-600">
          <Link href="#" className="hover:text-gray-900 transition-colors">Community</Link>
          <Link href="#" className="hover:text-gray-900 transition-colors">Academy</Link>
          <Link href="#" className="hover:text-gray-900 transition-colors">Developer Hub</Link>
          <Link href="#" className="hover:text-gray-900 transition-colors flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            English
          </Link>
        </div>
      </nav>

      {/* Mini Search Header */}
      <div className="bg-white border-b border-gray-200 py-10 px-6 relative">
        <div className="max-w-3xl mx-auto relative z-10">
          <form action={`/help/${params.spaceId}`} method="GET" className="relative">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input 
              type="text" 
              name="q" 
              placeholder={config.help_search_placeholder || "Search for articles..."} 
              className="w-full pl-12 pr-4 py-3.5 rounded-lg border border-gray-200 bg-white shadow-sm focus:outline-none focus:ring-2 transition-all text-base placeholder:text-gray-400"
              style={{ '--tw-ring-color': brandColor } as React.CSSProperties}
            />
          </form>
        </div>
      </div>

      {/* Category Content */}
      <main className="max-w-[850px] mx-auto w-full px-6 py-12">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-10 whitespace-nowrap overflow-x-auto pb-1">
          <Link href={`/help/${params.spaceId}`} className="hover:text-gray-900 transition-colors">All Collections</Link>
          <span>›</span>
          <span className="text-gray-400 truncate">{decodedCategory}</span>
        </div>

        <div className="flex items-center gap-5 mb-10">
          <div className="w-16 h-16 rounded-2xl bg-gray-900 flex items-center justify-center shrink-0 shadow-sm text-white">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
            </svg>
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">{decodedCategory}</h1>
            <p className="text-gray-500 mt-1 text-[15px]">{articles.length} {articles.length === 1 ? 'article' : 'articles'}</p>
          </div>
        </div>

        {articles.length === 0 ? (
           <p className="text-gray-500 text-sm">No articles in this collection.</p>
        ) : (
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
            {articles.map(article => (
              <Link key={article.id} href={`/help/${params.spaceId}/${article.slug || article.id}`} className="flex flex-col sm:flex-row sm:items-center justify-between p-6 border-b border-gray-100 hover:bg-gray-50 transition-colors group last:border-0 gap-4">
                <div className="flex flex-col">
                  <span className="text-[17px] font-medium text-gray-900 group-hover:text-blue-600 transition-colors mb-1">{article.title}</span>
                  <span className="text-[15px] text-gray-500 line-clamp-1">{article.content.replace(/<[^>]*>?/gm, '').substring(0, 150)}...</span>
                </div>
                <svg className="w-5 h-5 text-gray-400 shrink-0 hidden sm:block group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
