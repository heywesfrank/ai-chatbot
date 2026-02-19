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
      const text = block.nodes?.map((node: any) => node.text).join('') || '';
      if (text.trim()) paragraphs.push(text);
    }
    
    // Recursively parse nested blocks (like lists or quotes)
    if (block.nodes && block.nodes.length > 0) {
      paragraphs = paragraphs.concat(extractTextFromBlocks(block.nodes));
    }
  }
  return paragraphs;
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

    // 1. Fetch the raw content from GitBook using the user's API key
    const gitbookResponse = await fetch(`https://api.gitbook.com/v1/spaces/${spaceId}/content`, {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });

    if (!gitbookResponse.ok) {
      throw new Error('Failed to authenticate with GitBook API');
    }

    const data = await gitbookResponse.json();
    
    // Recursively parse the GitBook blocks to extract plain text
    const extractedParagraphs = extractTextFromBlocks(data.pages ? data.pages : [data]);

    if (!extractedParagraphs || extractedParagraphs.length === 0) {
      return NextResponse.json({ error: 'No readable content found in the Space' }, { status: 400 });
    }

    // 2. Turn the paragraphs into vectors simultaneously (batching)
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: extractedParagraphs,
    });
      
    // 3. Map into a single array
    const documentsToInsert = extractedParagraphs.map((paragraph, index) => ({
      space_id: spaceId,
      page_url: `https://app.gitbook.com/s/${spaceId}`,
      content: paragraph,
      embedding: embeddingResponse.data[index].embedding,
    }));

    // 4. Bulk insert into Supabase
    const { error } = await supabase.from('gitbook_documents').insert(documentsToInsert);

    if (error) {
      console.error("Supabase Insert Error:", error.message);
      throw new Error(`Database error: ${error.message}`);
    }

    return NextResponse.json({ success: true });
    
  } catch (error: any) {
    console.error("Ingestion Route Error:", error);
    return NextResponse.json({ error: error.message || 'Ingestion failed' }, { status: 500 });
  }
}
