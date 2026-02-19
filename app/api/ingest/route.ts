import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Helper to recursively extract text from GitBook node blocks
function extractTextFromBlocks(blocks: any[]): string[] {
  let paragraphs: string[] = [];

  for (const block of blocks) {
    // If it's a text block, grab the plain text
    if (block.object === 'block' && block.type === 'paragraph') {
      const text = block.nodes?.map((node: any) => node.text || '').join('') || '';
      if (text.trim()) paragraphs.push(text);
    }
    
    // Recursively parse nested blocks (like lists or quotes)
    if (block.nodes && block.nodes.length > 0) {
      paragraphs = paragraphs.concat(extractTextFromBlocks(block.nodes));
    }
  }
  return paragraphs;
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
    return NextResponse.json({ error: 'Missing credentials' }, { status: 400 });
  }

  try {
    // 0. Save or update the persona prompt to the database for this space
    const fallbackPrompt = "You are a helpful, minimalist support assistant.";
    const { error: configError } = await supabase
      .from('bot_config')
      .upsert({ space_id: spaceId, system_prompt: systemPrompt || fallbackPrompt }, { onConflict: 'space_id' });
      
    if (configError) {
      console.error("Supabase Config Insert Error:", configError.message);
      throw new Error(`Database error saving config: ${configError.message}`);
    }

    // 1. Fetch the raw table of contents from GitBook
    const gitbookResponse = await fetch(`https://api.gitbook.com/v1/spaces/${spaceId}/content`, {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });

    if (!gitbookResponse.ok) {
      throw new Error(`Failed to authenticate with GitBook API. Status: ${gitbookResponse.status}`);
    }

    const tocData = await gitbookResponse.json();
    
    // Extract page IDs from the Table of Contents
    const pageIds = extractPageIds(tocData.pages || []);
    
    if (pageIds.length === 0) {
      return NextResponse.json({ error: 'No pages found in the Space' }, { status: 400 });
    }

    let extractedParagraphs: string[] = [];

    // 2. Fetch the actual content blocks for each page
    // We process these in batches of 10 to avoid hitting GitBook API rate limits
    const GITBOOK_BATCH_SIZE = 10;
    for (let i = 0; i < pageIds.length; i += GITBOOK_BATCH_SIZE) {
      const batch = pageIds.slice(i, i + GITBOOK_BATCH_SIZE);
      
      await Promise.all(batch.map(async (pageId) => {
        const pageRes = await fetch(`https://api.gitbook.com/v1/spaces/${spaceId}/content/page/${pageId}`, {
           headers: { 'Authorization': `Bearer ${apiKey}` }
        });
        if (pageRes.ok) {
          const pageData = await pageRes.json();
          if (pageData.document && pageData.document.nodes) {
            const paragraphs = extractTextFromBlocks(pageData.document.nodes);
            extractedParagraphs.push(...paragraphs);
          }
        }
      }));
    }

    if (!extractedParagraphs || extractedParagraphs.length === 0) {
      return NextResponse.json({ error: 'No readable text content found across the pages' }, { status: 400 });
    }

    // Clear out existing documents for this space to avoid duplicates on re-sync
    await supabase.from('gitbook_documents').delete().eq('space_id', spaceId);

    // 3. Turn the paragraphs into vectors and insert in batches to avoid OpenAI/Supabase limits
    const OPENAI_BATCH_SIZE = 500;
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
        console.error("Supabase Insert Error:", error.message);
        throw new Error(`Database error: ${error.message}`);
      }
    }

    return NextResponse.json({ success: true });
    
  } catch (error: any) {
    console.error("Ingestion Route Error:", error);
    return NextResponse.json({ error: error.message || 'Ingestion failed' }, { status: 500 });
  }
}
