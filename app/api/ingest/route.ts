import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: Request) {
  const { apiKey, spaceId } = await req.json();

  if (!apiKey || !spaceId) {
    return NextResponse.json({ error: 'Missing credentials' }, { status: 400 });
  }

  try {
    // 1. Fetch the raw content from GitBook using the user's API key
    const gitbookResponse = await fetch(`https://api.gitbook.com/v1/spaces/${spaceId}/content`, {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });

    if (!gitbookResponse.ok) {
      throw new Error('Failed to authenticate with GitBook API');
    }

    // const rawData = await gitbookResponse.json();
    
    // MOCK DATA: Parsing GitBook's document node tree requires a recursive function.
    // For your MVP, we are mocking the extracted text array so you can test the AI first.
    const extractedParagraphs = [
      "To reset your password, navigate to the settings gear icon and click 'Security'.",
      "We currently support Visa, Mastercard, and Stripe for billing.",
      "To invite a team member, click the plus icon next to the workspace name."
    ];

    // 2. Turn the paragraphs into vectors and save them to Supabase
    for (const paragraph of extractedParagraphs) {
      const embeddingResponse = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: paragraph,
      });
      
      await supabase.from('gitbook_documents').insert({
        page_url: `https://app.gitbook.com/s/${spaceId}`,
        content: paragraph,
        embedding: embeddingResponse.data[0].embedding,
      });
    }

    return NextResponse.json({ success: true });
    
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Ingestion failed' }, { status: 500 });
  }
}
