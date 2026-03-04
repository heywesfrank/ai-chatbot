// app/api/help-center/route.ts
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import OpenAI from 'openai';
import * as cheerio from 'cheerio';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function chunkText(htmlString: string, sourceUrl: string) {
  const $ = cheerio.load(htmlString);
  const rawText = $('body').text();
  
  const cleanText = rawText.replace(/\n{3,}/g, '\n\n').trim();
  const chunks: { content: string, url: string }[] = [];
  const MAX_CHUNK_LENGTH = 3000;
  
  if (cleanText.length > 0) {
    let currentChunk = '';
    const rawChunks = cleanText.split('\n\n');
    
    for (const chunk of rawChunks) {
      if (!chunk.trim()) continue;
      if (currentChunk.length + chunk.length > MAX_CHUNK_LENGTH) {
        if (currentChunk.trim().length > 0) {
            chunks.push({ content: `Source: ${sourceUrl}\n\n${currentChunk.trim()}`, url: sourceUrl });
        }
        currentChunk = chunk + '\n\n';
      } else {
        currentChunk += chunk + '\n\n';
      }
    }
    if (currentChunk.trim().length > 0) {
      chunks.push({ content: `Source: ${sourceUrl}\n\n${currentChunk.trim()}`, url: sourceUrl });
    }
  }
  return chunks;
}

export async function GET(req: Request) {
  const authHeader = req.headers.get('Authorization');
  const { data: { user } } = await supabase.auth.getUser(authHeader?.replace('Bearer ', '') || '');
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let spaceId = null;
  const { data: config } = await supabase.from('bot_config').select('space_id').eq('user_id', user.id).maybeSingle();
  if (config) spaceId = config.space_id;
  else {
    const { data: member } = await supabase.from('team_members').select('space_id').eq('email', user.email).maybeSingle();
    if (member) spaceId = member.space_id;
  }

  if (!spaceId) return NextResponse.json({ articles: [] });

  const { data } = await supabase.from('help_center_articles').select('*').eq('space_id', spaceId).order('created_at', { ascending: false });
  return NextResponse.json({ articles: data || [] });
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    const { data: { user } } = await supabase.auth.getUser(authHeader?.replace('Bearer ', '') || '');
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id, spaceId, title, content, category, slug, seo_title, seo_description, status, tags, relatedArticles } = await req.json();
    if (!spaceId || !title || !content) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

    // Enforce Ownership Verification (IDOR Fix)
    let hasAccess = false;
    const { data: config } = await supabase.from('bot_config').select('space_id').eq('user_id', user.id).maybeSingle();
    if (config?.space_id === spaceId) hasAccess = true;
    else if (user.email) {
      const { data: member } = await supabase.from('team_members').select('space_id').eq('email', user.email).maybeSingle();
      if (member?.space_id === spaceId) hasAccess = true;
    }
    if (!hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const payload = { 
      space_id: spaceId, 
      title, 
      content, 
      category: category || 'General',
      slug: slug || null,
      seo_title: seo_title || null,
      seo_description: seo_description || null,
      status: status || 'published',
      tags: tags || [],
      related_articles: relatedArticles || [],
      updated_at: new Date().toISOString() 
    };
    
    let articleRes;
    
    if (id) {
      const { data: existing } = await supabase.from('help_center_articles').select('slug').eq('id', id).eq('space_id', spaceId).maybeSingle();
      if (existing) {
        const oldUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.heyapoyo.com'}/help/${spaceId}/${existing.slug || id}`;
        await supabase.from('knowledge_documents').delete().eq('page_url', oldUrl).eq('space_id', spaceId);
      }
      
      articleRes = await supabase.from('help_center_articles').update(payload).eq('id', id).eq('space_id', spaceId).select().single();
    } else {
      articleRes = await supabase.from('help_center_articles').insert(payload).select().single();
    }

    if (articleRes.error) throw new Error(articleRes.error.message);
    const article = articleRes.data;

    const articleUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://heyapoyo.com'}/help/${spaceId}/${article.slug || article.id}`;
    
    await supabase.from('knowledge_documents').delete().eq('page_url', articleUrl).eq('space_id', spaceId);

    if (article.status === 'published') {
      const fullText = `Title: ${article.title}\nCategory: ${article.category}\n\n${article.content}`;
      const chunks = chunkText(fullText, articleUrl);

      if (chunks.length > 0) {
        const embeddings = await openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: chunks.map(c => c.content),
        });

        const docs = chunks.map((chunk, i) => ({
          space_id: spaceId,
          page_url: articleUrl,
          content: chunk.content,
          embedding: embeddings.data[i].embedding,
          source_type: 'help_center'
        }));

        await supabase.from('knowledge_documents').insert(docs);
      }
    }

    return NextResponse.json({ success: true, article });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    const { data: { user } } = await supabase.auth.getUser(authHeader?.replace('Bearer ', '') || '');
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const url = new URL(req.url);
    const id = url.searchParams.get('id');
    const spaceId = url.searchParams.get('spaceId');
    if (!id || !spaceId) return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });

    // Enforce Ownership Verification (IDOR Fix)
    let hasAccess = false;
    const { data: config } = await supabase.from('bot_config').select('space_id').eq('user_id', user.id).maybeSingle();
    if (config?.space_id === spaceId) hasAccess = true;
    else if (user.email) {
      const { data: member } = await supabase.from('team_members').select('space_id').eq('email', user.email).maybeSingle();
      if (member?.space_id === spaceId) hasAccess = true;
    }
    if (!hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { data: article } = await supabase.from('help_center_articles').select('slug').eq('id', id).eq('space_id', spaceId).maybeSingle();
    if (!article) return NextResponse.json({ error: 'Not found or forbidden' }, { status: 404 });

    const articleUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://heyapoyo.com'}/help/${spaceId}/${article?.slug || id}`;

    await supabase.from('knowledge_documents').delete().eq('page_url', articleUrl).eq('space_id', spaceId);
    await supabase.from('help_center_articles').delete().eq('id', id).eq('space_id', spaceId);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
