// app/help/[spaceId]/category/[categoryName]/page.tsx
import { supabase } from '@/lib/supabase';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Metadata } from 'next';
import HelpCenterHero from '../../../components/HelpCenterHero';

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
    .select('workspace_name, bot_avatar, primary_color, help_search_placeholder, help_center_color, help_center_bg_image')
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

  return (
    <div className="bg-[#FAFAFA] min-h-screen text-gray-900 font-sans">
      <HelpCenterHero config={config} spaceId={params.spaceId} />

      <main className="max-w-[850px] mx-auto w-full px-4 sm:px-6 py-8 sm:py-12">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-8 sm:mb-10 whitespace-nowrap overflow-x-auto pb-1">
          <Link href={`/help/${params.spaceId}`} className="hover:text-gray-900 transition-colors">All Collections</Link>
          <span>›</span>
          <span className="text-gray-400 truncate">{decodedCategory}</span>
        </div>

        <div className="flex items-center gap-4 sm:gap-5 mb-8 sm:mb-10">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gray-900 flex items-center justify-center shrink-0 text-white">
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
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            {articles.map(article => (
              <Link key={article.id} href={`/help/${params.spaceId}/${article.slug || article.id}`} className="flex flex-col sm:flex-row sm:items-center justify-between p-5 sm:p-6 border-b border-gray-100 hover:bg-gray-50 transition-colors group last:border-0 gap-4">
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
