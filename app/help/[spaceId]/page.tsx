import { supabase } from '@/lib/supabase';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Metadata } from 'next';

export const revalidate = 60; 

export async function generateMetadata({ params }: { params: { spaceId: string } }): Promise<Metadata> {
  const { data: config } = await supabase.from('bot_config').select('workspace_name').eq('space_id', params.spaceId).maybeSingle();
  return {
    title: `${config?.workspace_name || 'Help Center'} - Documentation`,
    description: `Browse support articles and documentation for ${config?.workspace_name || 'our product'}.`,
  };
}

export default async function HelpCenterIndex({ params }: { params: { spaceId: string } }) {
  const { data: config } = await supabase.from('bot_config')
    .select('workspace_name, primary_color, bot_avatar, description_text')
    .eq('space_id', params.spaceId)
    .maybeSingle();

  if (!config) notFound();

  // ONLY fetch published articles and include the slug
  const { data: articles } = await supabase.from('help_center_articles')
    .select('id, title, category, content, slug')
    .eq('space_id', params.spaceId)
    .eq('status', 'published')
    .order('created_at', { ascending: false });

  const grouped = articles?.reduce((acc, article) => {
    const cat = article.category || 'General';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(article);
    return acc;
  }, {} as Record<string, any[]>) || {};

  const categories = Object.keys(grouped).sort();
  const brandColor = config.primary_color || '#000000';

  return (
    <div>
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto w-full px-6 py-12 text-center md:py-16">
          {config.bot_avatar && (
            <img src={config.bot_avatar} alt="Logo" className="w-16 h-16 rounded-full mx-auto mb-4 object-cover border border-gray-100 shadow-sm" />
          )}
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 mb-3">
            {config.workspace_name || 'Help Center'}
          </h1>
          <p className="text-gray-500 max-w-lg mx-auto text-base">
            {config.description_text || 'Search our knowledge base or browse categories below to find the answers you need.'}
          </p>
        </div>
      </header>

      <main className="max-w-4xl mx-auto w-full px-6 py-12">
        {categories.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            No articles have been published yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {categories.map(category => (
              <div key={category} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col h-full">
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                  <h2 className="text-lg font-semibold text-gray-900">{category}</h2>
                  <p className="text-xs text-gray-500 mt-1">{grouped[category].length} {grouped[category].length === 1 ? 'article' : 'articles'}</p>
                </div>
                <div className="p-2 flex-1">
                  <ul className="divide-y divide-gray-50">
                    {grouped[category].map((article: any) => (
                      <li key={article.id}>
                        {/* Uses slug for SEO friendly URLs, falls back to ID */}
                        <Link 
                          href={`/help/${params.spaceId}/${article.slug || article.id}`}
                          className="flex flex-col p-4 rounded-lg hover:bg-gray-50 transition-colors group"
                          style={{ '--brand-color': brandColor } as React.CSSProperties}
                        >
                          <span className="font-medium text-gray-900 group-hover:text-[var(--brand-color)] transition-colors">
                            {article.title}
                          </span>
                          <span className="text-sm text-gray-500 line-clamp-1 mt-1">
                            {/* Strips out markdown syntax completely for the preview text */}
                            {article.content.replace(/[#*`~_\[\]>]/g, '').substring(0, 120)}...
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
