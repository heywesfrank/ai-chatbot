// app/api/ingest/route.ts
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import OpenAI from 'openai';
import * as cheerio from 'cheerio';
import { parseStringPromise } from 'xml2js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MAX_SITEMAP_PAGES = 50; // Strict limit to save costs
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
    
    // Remove unwanted elements
    $('script, style, nav, footer, header, aside, .sidebar, iframe').remove();
    
    const text = $('body').text().replace(/\s+/g, ' ').trim();
    return text;
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
    if (typeof current.text === 'string') {
      result += current.text;
    }
    for (const key of Object.keys(current)) {
      if (key !== 'text') traverse(current[key]);
    }
    if (current.object === 'block' || current.type === 'paragraph' || current.type === 'heading-1') {
      result += '\n\n';
    }
  }
  traverse(obj);
  return result;
}

function extractPageIds(pages: any[]): string[] {
  let ids: string[] = [];
  for (const page of pages) {
    if (page.id) ids.push(page.id);
    if (page.pages && page.pages.length > 0) {
      ids = ids.concat(extractPageIds(page.pages));
    }
  }
  return ids;
}

export async function POST(req: Request) {
  try {
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
      const { apiKey } = body;
      if (!apiKey) return NextResponse.json({ error: 'GitBook API Key required.' }, { status: 400 });

      const gitbookResponse = await fetch(`https://api.gitbook.com/v1/spaces/${spaceId}/content`, {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      });

      if (!gitbookResponse.ok) throw new Error('GitBook API Error');
      
      const tocData = await gitbookResponse.json();
      const pageIds = extractPageIds(tocData.pages || []);
      
      const GITBOOK_BATCH_SIZE = 10;
      for (let i = 0; i < pageIds.length; i += GITBOOK_BATCH_SIZE) {
        const batch = pageIds.slice(i, i + GITBOOK_BATCH_SIZE);
        await Promise.all(batch.map(async (pageId) => {
          const pageRes = await fetch(`https://api.gitbook.com/v1/spaces/${spaceId}/content/page/${pageId}`, {
             headers: { 'Authorization': `Bearer ${apiKey}` }
          });
          if (!pageRes.ok) return;
          const pageData = await pageRes.json();
          const rawText = extractTextSafe(pageData.document || pageData);
          const chunks = chunkText(rawText, `https://app.gitbook.com/s/${spaceId}`); // Ideally actual page URL
          chunks.forEach(c => extractedParagraphs.push({ content: c, url: `https://app.gitbook.com/s/${spaceId}` }));
        }));
      }
    }

    // --- 2. WEBSITE / SITEMAP INGESTION ---
    else if (type === 'website') {
      const { url } = body;
      if (!url) return NextResponse.json({ error: 'URL required.' }, { status: 400 });

      if (url.endsWith('.xml')) {
        // Sitemap Processing
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
        // Single Page Processing
        const text = await scrapePage(url);
        const chunks = chunkText(text, url);
        chunks.forEach(c => extractedParagraphs.push({ content: c, url }));
      }
    }

    // --- 3. RAW TEXT / FILE INGESTION ---
    else if (type === 'file') {
       const { text, filename } = body;
       if (!text) return NextResponse.json({ error: 'Text content required.' }, { status: 400 });
       
       const chunks = chunkText(text, filename || 'Uploaded File');
       chunks.forEach(c => extractedParagraphs.push({ content: c, url: filename || 'File Upload' }));
    }

    if (extractedParagraphs.length === 0) {
      return NextResponse.json({ error: 'No readable text content found.' }, { status: 400 });
    }

    // --- 4. GENERATE EMBEDDINGS & INSERT ---
    console.log(`[INGEST] Generating OpenAI Embeddings for ${extractedParagraphs.length} chunks...`);
    const OPENAI_BATCH_SIZE = 100; 
    const allDocumentsToInsert: any[] = [];
    
    // We append rather than wipe the DB immediately, to allow multiple sources.
    // However, if the user explicitly syncs 'gitbook' we might want to wipe old 'gitbook' sources.
    // For simplicity and safety, we'll delete only matching source types for this space.
    await supabase.from('knowledge_documents').delete().eq('space_id', spaceId).eq('source_type', type);

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
