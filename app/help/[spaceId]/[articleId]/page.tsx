import { supabase } from '@/lib/supabase';
import { notFound } from 'next/navigation';
import ReactMarkdown from 'react-markdown';
import Link from 'next/link';
import { Metadata } from 'next';

export const revalidate = 60; // Revalidate cache every 60 seconds

// --- Helper Functions ---

function formatTimeAgo(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diffInSeconds < 60) return 'just now';
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `Updated ${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `Updated ${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) return `Updated ${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
  const diffInWeeks = Math.floor(diffInDays / 7);
  if (diffInWeeks < 4) return `Updated over ${diffInWeeks} week${diffInWeeks > 1 ? 's' : ''} ago`;
  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) return `Updated over ${diffInMonths} month${diffInMonths > 1 ? 's' : ''} ago`;
  const diffInYears = Math.floor(diffInDays / 365);
  return `Updated over ${diffInYears} year${diffInYears > 1 ? 's' : ''} ago`;
}

const flattenText = (node: any): string => {
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(flattenText).join('');
  if (node && typeof node === 'object' && node.props && node.props.children) {
    return flattenText(node.props.children);
  }
  return '';
};

const slugify = (text: string) => {
  return text.toLowerCase().replace(/[^\w]+/g, '-').replace(/(^-|-$)/g, '');
};

// Extracts headings for the Table of Contents right from the Markdown string
function extractHeadings(content: string) {
  const headings: { level: number; text: string; slug: string }[] = [];
  const lines = content.split('\n');
  let inCodeBlock = false;

  for (const line of lines) {
    if (line.trim().startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;

    const match = line.match(/^(#{2,3})\s+(.+)$/);
    if (match) {
      const level = match[1].length;
      let text = match[2].trim();
      text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'); // Remove markdown links
      text = text.replace(/[*_~`]/g, ''); // Remove simple bold/italic formatting
      headings.push({
        level,
        text,
        slug: slugify(text)
      });
    }
  }
  return headings;
}

// --- Metadata ---

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

// --- Page Component ---

export default async function ArticlePage({ params }: { params: { spaceId: string, articleId: string } }) {
  const { data: config } = await supabase.from('bot_config').select('workspace_name, primary_color, bot_avatar').eq('space_id', params.spaceId).maybeSingle();
  const { data: article } = await supabase.from('help_center_articles').select('*').eq('id', params.articleId).eq('space_id', params.spaceId).maybeSingle();

  if (!article) notFound();

  const brandColor = config?.primary_color || '#000000';
  const headings = extractHeadings(article.content);

  return (
    <div className="bg-white min-h-screen text-gray-900 font-sans">
      
      {/* Top Navbar */}
      <nav className="px-6 py-4 flex items-center justify-between border-b border-gray-100 bg-white sticky top-0 z-50">
        <Link href={`/help/${params.spaceId}`} className="flex items-center gap-2 transition-opacity hover:opacity-80">
          <img src="/apoyo.png" alt="Apoyo" className="h-6 object-contain" />
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

      {/* Hero Search Section */}
      <div className="bg-gray-50 border-b border-gray-100 py-10 px-6 relative">
        <div className="max-w-3xl mx-auto relative z-10">
          <form action={`/help/${params.spaceId}`} method="GET" className="relative">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input 
              type="text" 
              name="q" 
              placeholder="Search for articles..." 
              className="w-full pl-12 pr-4 py-3.5 rounded-lg border border-gray-200 bg-white shadow-sm focus:outline-none focus:ring-2 transition-all text-base"
              style={{ '--tw-ring-color': brandColor } as React.CSSProperties}
            />
          </form>
        </div>
      </div>

      {/* Main Layout */}
      <main className="max-w-[1100px] mx-auto w-full px-6 py-12 flex flex-col lg:flex-row gap-16 items-start">
        
        {/* Article Content */}
        <article className="flex-1 min-w-0">
          
          {/* Breadcrumbs */}
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-8 whitespace-nowrap overflow-x-auto pb-1">
            <Link href={`/help/${params.spaceId}`} className="hover:text-gray-900 transition-colors">All Collections</Link>
            <span>›</span>
            <Link href={`/help/${params.spaceId}`} className="hover:text-gray-900 transition-colors">{article.category || 'General'}</Link>
            <span>›</span>
            <span className="text-gray-400 truncate">{article.title}</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900 mb-6 leading-tight">
            {article.title}
          </h1>

          {/* Author Meta */}
          <div className="flex items-center gap-3 mb-10">
             <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden border border-gray-200 shrink-0">
                {config?.bot_avatar ? (
                  <img src={config.bot_avatar} alt="Author" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-gray-500 font-medium text-sm">{(config?.workspace_name || 'T')[0]}</span>
                )}
             </div>
             <div className="flex flex-col">
                <span className="text-sm font-medium text-gray-700">
                  Written by {config?.workspace_name || 'Support Team'}
                </span>
                <span className="text-[13px] text-gray-400">
                  {formatTimeAgo(article.updated_at)}
                </span>
             </div>
          </div>

          {/* Markdown Body */}
          <div className="prose prose-slate max-w-none prose-headings:font-semibold prose-headings:scroll-mt-24 prose-a:text-blue-600 hover:prose-a:text-blue-500 prose-img:rounded-xl prose-img:shadow-sm leading-relaxed text-[15px] text-gray-700">
            <ReactMarkdown 
              components={{
                a: ({ node, ...props }) => <a {...props} style={{ color: brandColor }} target="_blank" rel="noopener noreferrer" />,
                h2: ({ node, children, ...props }) => <h2 id={slugify(flattenText(children))} {...props}>{children}</h2>,
                h3: ({ node, children, ...props }) => <h3 id={slugify(flattenText(children))} {...props}>{children}</h3>,
              }}
            >
              {article.content}
            </ReactMarkdown>
          </div>
        </article>

        {/* Right Sidebar: Table of Contents */}
        {headings.length > 0 && (
          <aside className="w-[260px] shrink-0 hidden lg:block sticky top-28">
            <ul className="space-y-3 border-l-2 border-gray-100 pl-4">
              {headings.map((h, i) => (
                <li key={i} className={`${h.level === 3 ? 'ml-4' : ''}`}>
                  <a 
                    href={`#${h.slug}`} 
                    className="text-[13px] text-gray-500 hover:text-gray-900 transition-colors block leading-snug"
                  >
                    {h.text}
                  </a>
                </li>
              ))}
            </ul>
          </aside>
        )}
      </main>

    </div>
  );
}
