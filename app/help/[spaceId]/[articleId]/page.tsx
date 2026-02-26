import { supabase } from '@/lib/supabase';
import { notFound } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import Link from 'next/link';
import { Metadata } from 'next';
import { ArrowLeftIcon } from '@/components/icons';

export const revalidate = 60; // Revalidate cache every 60 seconds

export async function generateMetadata({ params }: { params: { spaceId: string, articleId: string } }): Promise<Metadata> {
  const { data: article } = await supabase.from('help_center_articles').select('title, content').eq('id', params.articleId).eq('space_id', params.spaceId).maybeSingle();
  const { data: config } = await supabase.from('bot_config').select('workspace_name').eq('space_id', params.spaceId).maybeSingle();
  
  if (!article) return { title: 'Not Found' };

  return {
    title: `${article.title} | ${config?.workspace_name || 'Help Center'}`,
    description: article.content.substring(0, 160).replace(/\n/g, ' ') + '...',
    openGraph: {
      title: article.title,
      description: article.content.substring(0, 160).replace(/\n/g, ' ') + '...',
    }
  };
}

export default async function ArticlePage({ params }: { params: { spaceId: string, articleId: string } }) {
  const { data: config } = await supabase.from('bot_config').select('workspace_name, primary_color').eq('space_id', params.spaceId).maybeSingle();
  const { data: article } = await supabase.from('help_center_articles').select('*').eq('id', params.articleId).eq('space_id', params.spaceId).maybeSingle();

  if (!article) notFound();

  const brandColor = config?.primary_color || '#000000';

  return (
    <div>
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto w-full px-6 h-16 flex items-center justify-between">
          <Link 
            href={`/help/${params.spaceId}`} 
            className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors"
          >
            <ArrowLeftIcon className="w-4 h-4" />
            Back to Help Center
          </Link>
          <span className="text-sm font-semibold text-gray-900 truncate ml-4 hidden sm:block">
            {config?.workspace_name || 'Help Center'}
          </span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto w-full px-6 py-12 md:py-20">
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
             <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded bg-gray-100 text-gray-600">
               {article.category || 'General'}
             </span>
             <span className="text-xs font-medium text-gray-400">
               Last updated on {new Date(article.updated_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
             </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900 mb-6 leading-tight">
            {article.title}
          </h1>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 sm:p-10">
          <ReactMarkdown 
            className="prose prose-slate max-w-none prose-headings:font-semibold prose-a:text-blue-600 hover:prose-a:text-blue-500 prose-img:rounded-xl prose-img:shadow-sm leading-relaxed"
            components={{
              a: ({ node, ...props }) => <a {...props} style={{ color: brandColor }} target="_blank" rel="noopener noreferrer" />
            }}
          >
            {article.content}
          </ReactMarkdown>
        </div>
        
        <div className="mt-12 text-center">
           <p className="text-sm text-gray-500 font-medium">Still need help?</p>
           <Link href={`/help/${params.spaceId}`} className="inline-block mt-3 px-6 py-2.5 bg-black text-white text-sm font-medium rounded-full hover:bg-gray-800 transition-colors shadow-sm" style={{ backgroundColor: brandColor }}>
             Contact Support
           </Link>
        </div>
      </main>
    </div>
  );
}
