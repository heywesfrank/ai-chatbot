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
  
  if (cleanText.length > 10) {
    let currentChunk = '';
    const rawChunks = cleanText.split('\n\n');
    
    for (const chunk of rawChunks) {
      if (!chunk.trim()) continue;
      if (currentChunk.length + chunk.length > MAX_CHUNK_LENGTH) {
        chunks.push(`Source: ${sourceUrl}\n\n${currentChunk.trim()}`);
        currentChunk = chunk + '\n\n';
      } else {
        currentChunk += chunk + '\n\n';
      }
    }
    if (currentChunk.trim().length > 10) {
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
  try {
    // 1. IP Rate Limiting (Protects against spam/abuse)
    if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
      try {
        const redis = new Redis({
          url: process.env.UPSTASH_REDIS_REST_URL,
          token: process.env.UPSTASH_REDIS_REST_TOKEN,
        });
        // Limit to 5 requests per minute per IP for ingestions
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
    const { spaceId, type } = body;

    if (!spaceId || !type) {
      return NextResponse.json({ error: 'Space ID and Type are required.' }, { status: 400 });
    }

    console.log(`[INGEST] Starting ingestion for Space ID: ${spaceId} | Type: ${type}`);
    let extractedParagraphs: { content: string, url: string }[] = [];

    // --- 1. GITBOOK INGESTION ---
    if (type === 'gitbook') {
      const { apiKey, gitbookSpaceId } = body;
      if (!apiKey || !gitbookSpaceId) return NextResponse.json({ error: 'GitBook API Key and Space ID required.' }, { status: 400 });

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

    // --- 2. NOTION INGESTION ---
    else if (type === 'notion') {
      const { pageId, token: notionToken } = body;
      if (!pageId || !notionToken) return NextResponse.json({ error: 'Notion Page ID and Integration Token required.' }, { status: 400 });

      async function fetchNotionBlocks(blockId: string, depth = 0): Promise<string> {
        if (depth > 5) return ''; // Prevent deep recursion
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

      const rawText = await fetchNotionBlocks(pageId);
      if (!rawText) throw new Error('Could not fetch Notion content. Check integration token and page sharing permissions.');
      
      const chunks = chunkText(rawText, `notion://${pageId}`);
      chunks.forEach(c => extractedParagraphs.push({ content: c, url: `notion://${pageId}` }));
    }

    // --- 3. GOOGLE DRIVE INGESTION ---
    else if (type === 'gdrive') {
      const { folderId, token: driveToken } = body;
      if (!folderId || !driveToken) return NextResponse.json({ error: 'GDrive Folder ID and Access Token required.' }, { status: 400 });

      // Fetch files in the folder
      const res = await fetch(`https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents&fields=files(id,name,mimeType)`, {
        headers: { 'Authorization': `Bearer ${driveToken}` }
      });
      if (!res.ok) throw new Error('Google Drive API Error. Check token or permissions.');
      const data = await res.json();

      for (const file of data.files || []) {
         let fileRes;
         // Support native Google Docs (export to text) or plain text documents
         if (file.mimeType === 'application/vnd.google-apps.document') {
           fileRes = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}/export?mimeType=text/plain`, {
             headers: { 'Authorization': `Bearer ${driveToken}` }
           });
         } else if (file.mimeType === 'text/plain') {
           fileRes = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`, {
             headers: { 'Authorization': `Bearer ${driveToken}` }
           });
         } else {
           continue; 
         }

         if (fileRes && fileRes.ok) {
            const text = await fileRes.text();
            const url = `https://docs.google.com/document/d/${file.id}`;
            const chunks = chunkText(text, url);
            chunks.forEach(c => extractedParagraphs.push({ content: c, url }));
         }
      }
    }

    // --- 4. ZENDESK INGESTION ---
    else if (type === 'zendesk') {
      const { subdomain, email, token: zendeskToken } = body;
      if (!subdomain || !email || !zendeskToken) return NextResponse.json({ error: 'Zendesk credentials required.' }, { status: 400 });

      // Create base64 basic auth string natively
      const auth = Buffer.from(`${email}/token:${zendeskToken}`).toString('base64');
      const res = await fetch(`https://${subdomain}.zendesk.com/api/v2/help_center/articles.json?per_page=100`, {
        headers: { 'Authorization': `Basic ${auth}` }
      });
      
      if (!res.ok) throw new Error('Zendesk API Error. Check Subdomain and Token.');
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

    // --- 5. WEBSITE / SITEMAP INGESTION ---
    else if (type === 'website') {
      const { url } = body;
      if (!url) return NextResponse.json({ error: 'URL required.' }, { status: 400 });

      if (url.endsWith('.xml')) {
        const res = await fetch(url);
        const xml = await res.text();
        const parsed = await parseStringPromise(xml);
        
        let urls: string[] = [];
        if (parsed.urlset && parsed.urlset.url) {
          urls = parsed.urlset.url.map((u: any) => u.loc[0]).slice(0, MAX_SITEMAP_PAGES);
        }
        
        for (const pageUrl of urls) {
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

    // --- 6. RAW TEXT / FILE INGESTION ---
    else if (type === 'file') {
       const { text, filename } = body;
       if (!text) return NextResponse.json({ error: 'Text content required.' }, { status: 400 });
       
       const chunks = chunkText(text, filename || 'Uploaded File');
       chunks.forEach(c => extractedParagraphs.push({ content: c, url: filename || 'File Upload' }));
    }

    if (extractedParagraphs.length === 0) {
      return NextResponse.json({ error: 'No readable text content found.' }, { status: 400 });
    }

    // --- CHECK QUOTA / LIMITS ---
    const { count: existingCount } = await supabase
      .from('knowledge_documents')
      .select('*', { count: 'exact', head: true })
      .eq('space_id', spaceId);

    if ((existingCount || 0) + extractedParagraphs.length > 1000) {
      return NextResponse.json({ 
        error: `Chunk limit exceeded. You have ${existingCount || 0} chunks and are trying to add ${extractedParagraphs.length} more. The limit is 1000.` 
      }, { status: 400 });
    }

    // --- 7. GENERATE EMBEDDINGS & INSERT ---
    console.log(`[INGEST] Generating OpenAI Embeddings for ${extractedParagraphs.length} chunks...`);
    const OPENAI_BATCH_SIZE = 100; 
    const allDocumentsToInsert: any[] = [];
    
    // NOTE: We no longer delete the whole source_type here. 
    // Deletions are strictly handled by the DELETE endpoint in /api/data-sources.

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
        source_type: type
      }));

      allDocumentsToInsert.push(...batchDocs);
    }

    console.log(`[INGEST] Inserting into Supabase...`);
    for (let i = 0; i < allDocumentsToInsert.length; i += OPENAI_BATCH_SIZE) {
      const batchToInsert = allDocumentsToInsert.slice(i, i + OPENAI_BATCH_SIZE);
      const { error } = await supabase.from('knowledge_documents').insert(batchToInsert);
      if (error) throw new Error(`Supabase Database error: ${error.message}`);
    }

    console.log(`[INGEST] Ingestion fully completed successfully.`);
    return NextResponse.json({ success: true, count: allDocumentsToInsert.length });
    
  } catch (error: any) {
    console.error("[INGEST] Fatal Route Error:", error);
    return NextResponse.json({ error: error.message || 'Unknown internal server error' }, { status: 500 });
  }
}
