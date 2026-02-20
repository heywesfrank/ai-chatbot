import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// GREEDY AST EXTRACTOR: Recursively flattens GitBook AST into clean paragraphs
function extractAllTextFromAST(node: any): string {
  if (!node) return '';

  // Base case: we found a text leaf
  if (typeof node.text === 'string') {
    return node.text;
  }

  // If we are at the root level of the page data, traverse into the document
  if (node.document) {
    return extractAllTextFromAST(node.document);
  }

  // Recursive case: node has children
  if (Array.isArray(node.nodes)) {
    const text = node.nodes.map((n: any) => extractAllTextFromAST(n)).join('');
    // If it's a structural block (like a paragraph, heading, or code block), append newlines
    return node.object === 'block' ? text + '\n\n' : text;
  }

  return '';
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
  const { apiKey, spaceId, systemPrompt } = await req.json();

  if (!apiKey || !spaceId) {
    return NextResponse.json({ error: 'Missing credentials: API Key and Space ID are required.' }, { status: 400 });
  }

  try {
    console.log(`[INGEST] Starting ingestion for Space ID: ${spaceId}`);

    // 0. Database Configuration
    const fallbackPrompt = "You are a helpful, minimalist support assistant.";
    const { error: configError } = await supabase
      .from('bot_config')
      .upsert({ space_id: spaceId, system_prompt: systemPrompt || fallbackPrompt }, { onConflict: 'space_id' });
      
    if (configError) {
      console.error("[INGEST] Supabase Config Error:", configError.message);
      throw new Error(`Database error saving config: ${configError.message}`);
    }

    // 1. Fetch TOC from GitBook
    console.log(`[INGEST] Fetching Table of Contents from GitBook...`);
    const gitbookResponse = await fetch(`https://api.gitbook.com/v1/spaces/${spaceId}/content`, {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });

    if (!gitbookResponse.ok) {
      const errText = await gitbookResponse.text();
      console.error(`[INGEST] GitBook TOC fetch failed: ${gitbookResponse.status} - ${errText}`);
      return NextResponse.json({ error: `GitBook API Error: ${gitbookResponse.status}` }, { status: 400 });
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
        
        // Use the greedy extractor to get all text, then split by the double-newlines we added
        const rawText = extractAllTextFromAST(pageData);
        const paragraphs = rawText.split('\n\n').map(p => p.trim()).filter(p => p.length > 10); // Filter out empty or tiny blocks

        // Prepend the page title to EVERY chunk. This drastically improves RAG accuracy.
        paragraphs.forEach(p => {
          extractedParagraphs.push(`Page: ${pageTitle}\n\n${p}`);
        });
      }));
    }

    console.log(`[INGEST] Finished fetching pages. Extracted ${extractedParagraphs.length} text blocks.`);

    if (extractedParagraphs.length === 0) {
      return NextResponse.json({ error: 'No readable text content found across the pages.' }, { status: 400 });
    }

    // Clear out existing documents for this space to avoid duplicates
    await supabase.from('gitbook_documents').delete().eq('space_id', spaceId);

    // 3. Turn the paragraphs into vectors and insert
    console.log(`[INGEST] Generating OpenAI Embeddings...`);
    const OPENAI_BATCH_SIZE = 500; // Safe batch limit for OpenAI
    
    for (let i = 0; i < extractedParagraphs.length; i += OPENAI_BATCH_SIZE) {
      const chunk = extractedParagraphs.slice(i, i + OPENAI_BATCH_SIZE);
      
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

      const { error } = await supabase.from('gitbook_documents').insert(documentsToInsert);

      if (error) {
        console.error("[INGEST] Supabase Insert Error:", error.message);
        throw new Error(`Supabase Database error: ${error.message}`);
      }
    }

    console.log(`[INGEST] Ingestion fully completed successfully.`);
    return NextResponse.json({ success: true });
    
  } catch (error: any) {
    console.error("[INGEST] Fatal Route Error:", error);
    return NextResponse.json({ error: error.message || 'Unknown internal server error' }, { status: 500 });
  }
}
