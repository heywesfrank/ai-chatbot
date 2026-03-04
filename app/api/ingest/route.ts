// app/api/ingest/route.ts
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import OpenAI from 'openai';
import * as cheerio from 'cheerio';
import { parseStringPromise } from 'xml2js';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Force Vercel Hobby Plan to allow the maximum execution time
export const maxDuration = 60; 

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MAX_SITEMAP_PAGES = 50; 
const MAX_CHUNK_LENGTH = 3000;

// Helper to chunk text
function chunkText(text: string, sourceUrl: string): string[] {
  const cleanText = text.replace(/\n{3,}/g, '\n\n').trim();
  const chunks: string[] = [];
  
  if (cleanText.length > 0) {
    let currentChunk = '';
    const rawChunks = cleanText.split('\n\n');
    
    for (const chunk of rawChunks) {
      if (!chunk.trim()) continue;
      if (currentChunk.length + chunk.length > MAX_CHUNK_LENGTH) {
        if (currentChunk.trim().length > 0) {
            chunks.push(`Source: ${sourceUrl}\n\n${currentChunk.trim()}`);
        }
        currentChunk = chunk + '\n\n';
      } else {
        currentChunk += chunk + '\n\n';
      }
    }
    if (currentChunk.trim().length > 0) {
      chunks.push(`Source: ${sourceUrl}\n\n${currentChunk.trim()}`);
    }
  }
  return chunks;
}

// Helper to scrape a single webpage
async function scrapePage(url: string): Promise<string> {
  try {
    const res = await fetch(url);
    if (!res.ok) return '';
    const html = await res.text();
    const $ = cheerio.load(html);
    $('script, style, nav, footer, header, aside, .sidebar, iframe').remove();
    return $('body').text().replace(/\s+/g, ' ').trim();
  } catch (error) {
    console.error(`Failed to scrape ${url}:`, error);
    return '';
  }
}

// Gitbook extractors
function extractTextSafe(obj: any): string {
  let result = '';
  function traverse(current: any) {
    if (!current || typeof current !== 'object') return;
    if (Array.isArray(current)) {
      current.forEach(traverse);
      return;
    }
    if (typeof current.text === 'string') result += current.text;
    for (const key of Object.keys(current)) {
      if (key !== 'text') traverse(current[key]);
    }
    if (current.object === 'block' || current.type === 'paragraph' || current.type === 'heading-1') result += '\n\n';
  }
  traverse(obj);
  return result;
}

function extractPageIds(pages: any[]): string[] {
  let ids: string[] = [];
  for (const page of pages) {
    if (page.id) ids.push(page.id);
    if (page.pages && page.pages.length > 0) ids = ids.concat(extractPageIds(page.pages));
  }
  return ids;
}

export async function POST(req: Request) {
  let dataSourceIdRef: string | null = null; // Keep track of ID for error handling

  try {
    // 1. IP Rate Limiting
    if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
      try {
        const redis = new Redis({
          url: process.env.UPSTASH_REDIS_REST_URL,
          token: process.env.UPSTASH_REDIS_REST_TOKEN,
        });
        const ratelimit = new Ratelimit({
          redis,
          limiter: Ratelimit.slidingWindow(5, '1 m'),
        });
        const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'anonymous';
        const { success } = await ratelimit.limit(`rl_ingest_${ip}`);
        
        if (!success) {
          return NextResponse.json({ error: 'Too many sync requests. Please try again in a minute.' }, { status: 429 });
        }
      } catch (err) {
        console.error("Rate limiting failure:", err);
      }
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { spaceId, type, dataSourceId } = body;
    dataSourceIdRef = dataSourceId;

    if (!spaceId || !type || !dataSourceId) {
      return NextResponse.json({ error: 'Space ID, Type, and Data Source ID are required.' }, { status: 400 });
    }

    // Enforce Ownership Verification (IDOR Fix)
    let hasAccess = false;
    const { data: config } = await supabase.from('bot_config').select('space_id').eq('user_id', user.id).maybeSingle();
    if (config?.space_id === spaceId) hasAccess = true;
    else if (user.email) {
      const { data: member } = await supabase.from('team_members').select('space_id').eq('email', user.email).maybeSingle();
      if (member?.space_id === spaceId) hasAccess = true;
    }
    if (!hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    // Set status to syncing explicitly (in case it wasn't already)
    await supabase.from('data_sources').update({ status: 'syncing' }).eq('id', dataSourceId).eq('space_id', spaceId);

    console.log(`[INGEST] Starting ingestion for Space ID: ${spaceId} | Type: ${type} | Source ID: ${dataSourceId}`);
    
    // --- 0. CLEANUP EXISTING DATA ---
    await supabase.from('knowledge_documents').delete().eq('data_source_id', dataSourceId).eq('space_id', spaceId);

    let extractedParagraphs: { content: string, url: string }[] = [];

    // --- 1. GITBOOK INGESTION ---
    if (type === 'gitbook') {
      const { apiKey, gitbookSpaceId } = body;
      if (!apiKey || !gitbookSpaceId) throw new Error('GitBook API Key and Space ID required.');

      const gitbookResponse = await fetch(`https://api.gitbook.com/v1/spaces/${gitbookSpaceId}/content`, {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      });

      if (!gitbookResponse.ok) throw new Error('GitBook API Error');
      
      const tocData = await gitbookResponse.json();
      const pageIds = extractPageIds(tocData.pages || []);
      
      const GITBOOK_BATCH_SIZE = 10;
      for (let i = 0; i < pageIds.length; i += GITBOOK_BATCH_SIZE) {
        const batch = pageIds.slice(i, i + GITBOOK_BATCH_SIZE);
        await Promise.all(batch.map(async (pageId) => {
          const pageRes = await fetch(`https://api.gitbook.com/v1/spaces/${gitbookSpaceId}/content/page/${pageId}`, {
             headers: { 'Authorization': `Bearer ${apiKey}` }
          });
          if (!pageRes.ok) return;
          const pageData = await pageRes.json();
          const rawText = extractTextSafe(pageData.document || pageData);
          const chunks = chunkText(rawText, `https://app.gitbook.com/s/${gitbookSpaceId}`); 
          chunks.forEach(c => extractedParagraphs.push({ content: c, url: `https://app.gitbook.com/s/${gitbookSpaceId}` }));
        }));
      }
    }

    // --- 2. NOTION INGESTION (OAUTH) ---
    else if (type === 'notion') {
      let notionToken = body.token;
      let pageIds: string[] = body.pageId ? [body.pageId] : [];

      if (!notionToken && dataSourceId) {
         const { data: ds } = await supabase.from('data_sources').select('credentials').eq('id', dataSourceId).eq('space_id', spaceId).single();
         if (ds?.credentials?.access_token) {
            notionToken = ds.credentials.access_token;
         }
      }

      if (!notionToken) throw new Error('Notion Access Token not found.');

      if (pageIds.length === 0) {
        console.log('[INGEST] Searching for all accessible Notion pages...');
        const searchRes = await fetch('https://api.notion.com/v1/search', {
          method: 'POST',
          headers: { 
            'Authorization': `Bearer ${notionToken}`, 
            'Notion-Version': '2022-06-28', 
            'Content-Type': 'application/json' 
          },
          body: JSON.stringify({ 
            filter: { value: 'page', property: 'object' },
            sort: { direction: 'descending', timestamp: 'last_edited_time' }
          })
        });

        if (!searchRes.ok) throw new Error(`Notion Search API Error: ${searchRes.statusText}`);
        
        const searchData = await searchRes.json();
        pageIds = searchData.results.map((r: any) => r.id);
        
        if (pageIds.length === 0) {
           throw new Error('No pages found. Please ensure you shared pages with the integration.');
        }
      }

      async function fetchNotionBlocks(blockId: string, depth = 0): Promise<string> {
        if (depth > 5) return ''; 
        let text = '';
        let cursor = undefined;
        let hasMore = true;

        while (hasMore) {
          const url = new URL(`https://api.notion.com/v1/blocks/${blockId}/children`);
          url.searchParams.append('page_size', '100');
          if (cursor) url.searchParams.append('start_cursor', cursor);

          const res = await fetch(url.toString(), {
            headers: {
              'Authorization': `Bearer ${notionToken}`,
              'Notion-Version': '2022-06-28'
            }
          });

          if (!res.ok) {
            console.error('Notion API Error:', await res.text());
            break;
          }

          const data = await res.json();
          for (const block of data.results) {
            const blockType = block.type;
            const richText = block[blockType]?.rich_text;
            if (richText) {
              text += richText.map((t: any) => t.plain_text).join('') + '\n\n';
            }
            if (block.has_children) {
              text += await fetchNotionBlocks(block.id, depth + 1);
            }
          }
          hasMore = data.has_more;
          cursor = data.next_cursor;
        }
        return text;
      }

      console.log(`[INGEST] Ingesting ${pageIds.length} Notion pages...`);
      await Promise.all(pageIds.map(async (pid) => {
        const rawText = await fetchNotionBlocks(pid);
        if (rawText.trim()) {
           const chunks = chunkText(rawText, `notion://${pid}`);
           chunks.forEach(c => extractedParagraphs.push({ content: c, url: `notion://${pid}` }));
        }
      }));
    }

    // --- 3. ZENDESK INGESTION ---
    else if (type === 'zendesk') {
      const { subdomain, email, token: zendeskToken } = body;
      
      if (!subdomain) throw new Error('Zendesk subdomain required.');

      // Server-side strict sanitization to prevent "company.zendesk.com.zendesk.com"
      const cleanSubdomain = subdomain
        .replace(/^https?:\/\//, '')
        .replace(/\.zendesk\.com.*$/, '')
        .replace(/\/$/, '');

      const headers: HeadersInit = {};
      if (email && zendeskToken) {
         const auth = Buffer.from(`${email}/token:${zendeskToken}`).toString('base64');
         headers['Authorization'] = `Basic ${auth}`;
      }

      // Fetch
      const res = await fetch(`https://${cleanSubdomain}.zendesk.com/api/v2/help_center/articles.json?per_page=100`, {
        headers
      });
      
      if (!res.ok) {
        throw new Error(`Zendesk API Error (${res.status}): ${res.statusText}. Check Subdomain or Permissions.`);
      }
      
      const data = await res.json();

      for (const article of data.articles || []) {
         if (!article.body) continue;
         const $ = cheerio.load(article.body);
         const text = $('body').text().replace(/\s+/g, ' ').trim();
         if (text) {
           const chunks = chunkText(text, article.html_url);
           chunks.forEach(c => extractedParagraphs.push({ content: c, url: article.html_url }));
         }
      }
    }

    // --- 4. WEBSITE / SITEMAP INGESTION ---
    else if (type === 'website') {
      const { url } = body;
      if (!url) throw new Error('URL required.');

      if (url.endsWith('.xml')) {
        const res = await fetch(url);
        const xml = await res.text();
        const parsed = await parseStringPromise(xml);
        
        let urls: string[] = [];
        if (parsed.urlset && parsed.urlset.url) {
          urls = parsed.urlset.url.map((u: any) => u.loc[0]).slice(0, MAX_SITEMAP_PAGES);
        }
        
        const uniqueUrls = [...new Set(urls)];

        for (const pageUrl of uniqueUrls) {
           const text = await scrapePage(pageUrl);
           const chunks = chunkText(text, pageUrl);
           chunks.forEach(c => extractedParagraphs.push({ content: c, url: pageUrl }));
        }
      } else {
        const text = await scrapePage(url);
        const chunks = chunkText(text, url);
        chunks.forEach(c => extractedParagraphs.push({ content: c, url }));
      }
    }

    // --- 5. RAW TEXT / FILE INGESTION ---
    else if (type === 'file') {
       const { text, filename } = body;
       if (!text) throw new Error('Text content required.');
       
       const chunks = chunkText(text, filename || 'Uploaded File');
       chunks.forEach(c => extractedParagraphs.push({ content: c, url: filename || 'File Upload' }));
    }

    if (extractedParagraphs.length === 0) {
      throw new Error('No readable text content found.');
    }

    // --- CHECK QUOTA / LIMITS ---
    const { count: existingCount } = await supabase
      .from('knowledge_documents')
      .select('*', { count: 'exact', head: true })
      .eq('space_id', spaceId);

    if ((existingCount || 0) + extractedParagraphs.length > 1000) {
      throw new Error(`Chunk limit exceeded. You have ${existingCount || 0} chunks and are trying to add ${extractedParagraphs.length} more. The limit is 1000.`);
    }

    // --- 6. GENERATE EMBEDDINGS & INSERT ---
    console.log(`[INGEST] Generating OpenAI Embeddings for ${extractedParagraphs.length} chunks...`);
    const OPENAI_BATCH_SIZE = 100; 
    const allDocumentsToInsert: any[] = [];
    
    for (let i = 0; i < extractedParagraphs.length; i += OPENAI_BATCH_SIZE) {
      const chunkBatch = extractedParagraphs.slice(i, i + OPENAI_BATCH_SIZE);
      const textChunk = chunkBatch.map(c => c.content);
      
      const embeddingResponse = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: textChunk,
      });
        
      const batchDocs = chunkBatch.map((chunk, index) => ({
        space_id: spaceId,
        page_url: chunk.url,
        content: chunk.content,
        embedding: embeddingResponse.data[index].embedding,
        source_type: type,
        data_source_id: dataSourceId 
      }));

      allDocumentsToInsert.push(...batchDocs);
    }

    console.log(`[INGEST] Inserting into Supabase...`);
    for (let i = 0; i < allDocumentsToInsert.length; i += OPENAI_BATCH_SIZE) {
      const batchToInsert = allDocumentsToInsert.slice(i, i + OPENAI_BATCH_SIZE);
      const { error } = await supabase.from('knowledge_documents').insert(batchToInsert);
      if (error) throw new Error(`Supabase Database error: ${error.message}`);
    }

    // --- 7. SUCCESS: UPDATE STATUS TO 'active' ---
    await supabase.from('data_sources').update({ status: 'active' }).eq('id', dataSourceId).eq('space_id', spaceId);

    console.log(`[INGEST] Ingestion fully completed successfully.`);
    return NextResponse.json({ success: true, count: allDocumentsToInsert.length });
    
  } catch (error: any) {
    console.error("[INGEST] Fatal Route Error:", error);
    
    // --- ERROR: ROLLBACK DATA SOURCE ---
    if (dataSourceIdRef) {
      const body = await req.json().catch(() => ({}));
      if (body.spaceId) {
        await supabase.from('knowledge_documents').delete().eq('data_source_id', dataSourceIdRef).eq('space_id', body.spaceId);
        await supabase.from('data_sources').delete().eq('id', dataSourceIdRef).eq('space_id', body.spaceId);
      }
    }

    return NextResponse.json({ error: error.message || 'Unknown internal server error' }, { status: 500 });
  }
}
