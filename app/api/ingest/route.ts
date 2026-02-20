import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// BRUTE-FORCE TEXT EXTRACTOR
// This completely ignores GitBook's schema. It walks the entire JSON tree
// and grabs EVERY string associated with a "text" key, no matter how nested.
function extractTextSafe(obj: any): string {
  let result = '';

  function traverse(current: any) {
    if (!current || typeof current !== 'object') return;
    
    // If it's an array, traverse every item
    if (Array.isArray(current)) {
      current.forEach(traverse);
      return;
    }

    // If we find a 'text' property, append it! (GitBook puts all content in "text" keys)
    if (typeof current.text === 'string') {
      result += current.text;
    }
    
    // Recurse into all nested objects to hunt for more text
    for (const key of Object.keys(current)) {
      if (key !== 'text') {
        traverse(current[key]);
      }
    }
    
    // Add spacing after blocks/paragraphs so sentences don't mash together
    if (current.object === 'block' || current.type === 'paragraph' || current.type === 'heading-1') {
      result += '\n\n';
    }
  }

  traverse(obj);
  return result;
}

// Helper to get all page IDs from the GitBook TOC tree
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
  // Notice we removed systemPrompt from here, it's now handled by /api/config
  const { apiKey, spaceId } = await req.json();

  if (!apiKey || !spaceId) {
    return NextResponse.json({ error: 'Missing credentials: API Key and Space ID are required.' }, { status: 400 });
  }

  try {
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
    
    console.log(`[INGEST] Successfully found ${pageIds.length} pages in the Table of Contents.`);

    if (pageIds.length === 0) {
      return NextResponse.json({ error: 'No pages found in this GitBook Space.' }, { status: 400 });
    }

    let extractedParagraphs: string[] = [];

    // 2. Fetch the actual content blocks for each page
    console.log(`[INGEST] Fetching page content...`);
    const GITBOOK_BATCH_SIZE = 10;
    
    for (let i = 0; i < pageIds.length; i += GITBOOK_BATCH_SIZE) {
      const batch = pageIds.slice(i, i + GITBOOK_BATCH_SIZE);
      console.log(`[INGEST] Processing batch ${Math.floor(i / GITBOOK_BATCH_SIZE) + 1} of ${Math.ceil(pageIds.length / GITBOOK_BATCH_SIZE)}...`);
      
      await Promise.all(batch.map(async (pageId) => {
        const pageRes = await fetch(`https://api.gitbook.com/v1/spaces/${spaceId}/content/page/${pageId}`, {
           headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        
        if (!pageRes.ok) return;

        const pageData = await pageRes.json();
        const pageTitle = pageData.title || 'Documentation';
        
        // Use the brute-force extractor
        const rawText = extractTextSafe(pageData.document || pageData);
        const cleanText = rawText.replace(/\n{3,}/g, '\n\n').trim();

        if (cleanText.length > 10) {
           // Safely chunk the page so we don't break OpenAI's token limits
           const MAX_CHUNK_LENGTH = 3000;
           let currentChunk = '';
           
           const chunks = cleanText.split('\n\n');
           for (const chunk of chunks) {
             if (!chunk.trim()) continue;
             
             if (currentChunk.length + chunk.length > MAX_CHUNK_LENGTH) {
               // Prepend the Page Title to every single chunk so the AI never loses context
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

    console.log(`[INGEST] Finished fetching pages. Extracted ${extractedParagraphs.length} text blocks.`);

    if (!extractedParagraphs || extractedParagraphs.length === 0) {
      return NextResponse.json({ error: 'No readable text content found across the pages.' }, { status: 400 });
    }

    // Clear out existing documents for this space to avoid duplicates
    await supabase.from('gitbook_documents').delete().eq('space_id', spaceId);

    // 3. Turn the paragraphs into vectors and insert
    console.log(`[INGEST] Generating OpenAI Embeddings...`);
    const OPENAI_BATCH_SIZE = 100; 
    
    for (let i = 0; i < extractedParagraphs.length; i += OPENAI_BATCH_SIZE) {
      const chunk = extractedParagraphs.slice(i, i + OPENAI_BATCH_SIZE);
      console.log(`[INGEST] Creating embeddings for paragraphs ${i} to ${i + chunk.length}...`);
      
      const embeddingResponse = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: chunk,
      });
        
      const documentsToInsert = chunk.map((paragraph, index) => ({
        space_id: spaceId,
        page_url: `https://app.gitbook.com/s/${spaceId}`,
        content: paragraph,
        embedding: embeddingResponse.data[index].embedding,
      }));

      console.log(`[INGEST] Inserting embeddings into Supabase...`);
      const { error } = await supabase.from('gitbook_documents').insert(documentsToInsert);

      if (error) throw new Error(`Supabase Database error: ${error.message}`);
    }

    console.log(`[INGEST] Ingestion fully completed successfully.`);
    return NextResponse.json({ success: true });
    
  } catch (error: any) {
    console.error("[INGEST] Fatal Route Error:", error);
    return NextResponse.json({ error: error.message || 'Unknown internal server error' }, { status: 500 });
  }
}
