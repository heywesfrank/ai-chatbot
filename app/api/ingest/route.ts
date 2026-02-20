import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// BRUTE-FORCE TEXT EXTRACTOR
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
      if (key !== 'text') {
        traverse(current[key]);
      }
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
    // Authenticate Request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { apiKey, spaceId } = await req.json();

    if (!apiKey || !spaceId) {
      return NextResponse.json({ error: 'Missing credentials: API Key and Space ID are required.' }, { status: 400 });
    }

    console.log(`[INGEST] Starting ingestion for Space ID: ${spaceId}`);

    // 1. Fetch TOC from GitBook
    console.log(`[INGEST] Fetching Table of Contents from GitBook...`);
    const gitbookResponse = await fetch(`https://api.gitbook.com/v1/spaces/${spaceId}/content`, {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });

    if (!gitbookResponse.ok) {
      const errText = await gitbookResponse.text();
      return NextResponse.json({ error: `GitBook API Error (TOC): ${gitbookResponse.status} - ${errText}` }, { status: 400 });
    }

    const tocData = await gitbookResponse.json();
    const pageIds = extractPageIds(tocData.pages || []);
    
    if (pageIds.length === 0) {
      return NextResponse.json({ error: 'No pages found in this GitBook Space.' }, { status: 400 });
    }

    let extractedParagraphs: string[] = [];

    // 2. Fetch the actual content blocks for each page
    console.log(`[INGEST] Fetching page content...`);
    const GITBOOK_BATCH_SIZE = 10;
    
    for (let i = 0; i < pageIds.length; i += GITBOOK_BATCH_SIZE) {
      const batch = pageIds.slice(i, i + GITBOOK_BATCH_SIZE);
      
      await Promise.all(batch.map(async (pageId) => {
        const pageRes = await fetch(`https://api.gitbook.com/v1/spaces/${spaceId}/content/page/${pageId}`, {
           headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        
        if (!pageRes.ok) return;

        const pageData = await pageRes.json();
        const pageTitle = pageData.title || 'Documentation';
        
        const rawText = extractTextSafe(pageData.document || pageData);
        const cleanText = rawText.replace(/\n{3,}/g, '\n\n').trim();

        if (cleanText.length > 10) {
           const MAX_CHUNK_LENGTH = 3000;
           let currentChunk = '';
           
           const chunks = cleanText.split('\n\n');
           for (const chunk of chunks) {
             if (!chunk.trim()) continue;
             
             if (currentChunk.length + chunk.length > MAX_CHUNK_LENGTH) {
               extractedParagraphs.push(`Page: ${pageTitle}\n\n${currentChunk.trim()}`);
               currentChunk = chunk + '\n\n';
             } else {
               currentChunk += chunk + '\n\n';
             }
           }
           
           if (currentChunk.trim().length > 10) {
             extractedParagraphs.push(`Page: ${pageTitle}\n\n${currentChunk.trim()}`);
           }
        }
      }));
    }

    if (!extractedParagraphs || extractedParagraphs.length === 0) {
      return NextResponse.json({ error: 'No readable text content found across the pages.' }, { status: 400 });
    }

    // 3. Turn the paragraphs into vectors and hold in memory (Non-Destructive until finished)
    console.log(`[INGEST] Generating OpenAI Embeddings...`);
    const OPENAI_BATCH_SIZE = 100; 
    const allDocumentsToInsert: any[] = [];
    
    for (let i = 0; i < extractedParagraphs.length; i += OPENAI_BATCH_SIZE) {
      const chunk = extractedParagraphs.slice(i, i + OPENAI_BATCH_SIZE);
      
      const embeddingResponse = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: chunk,
      });
        
      const batchDocs = chunk.map((paragraph, index) => ({
        space_id: spaceId,
        page_url: `https://app.gitbook.com/s/${spaceId}`,
        content: paragraph,
        embedding: embeddingResponse.data[index].embedding,
      }));

      allDocumentsToInsert.push(...batchDocs);
    }

    // 4. Safely clear old documents and insert the new array
    console.log(`[INGEST] Embeddings generated successfully. Clearing old DB entries...`);
    await supabase.from('gitbook_documents').delete().eq('space_id', spaceId);

    console.log(`[INGEST] Inserting into Supabase...`);
    for (let i = 0; i < allDocumentsToInsert.length; i += OPENAI_BATCH_SIZE) {
      const batchToInsert = allDocumentsToInsert.slice(i, i + OPENAI_BATCH_SIZE);
      const { error } = await supabase.from('gitbook_documents').insert(batchToInsert);
      if (error) throw new Error(`Supabase Database error: ${error.message}`);
    }

    console.log(`[INGEST] Ingestion fully completed successfully.`);
    return NextResponse.json({ success: true });
    
  } catch (error: any) {
    console.error("[INGEST] Fatal Route Error:", error);
    return NextResponse.json({ error: error.message || 'Unknown internal server error' }, { status: 500 });
  }
}
