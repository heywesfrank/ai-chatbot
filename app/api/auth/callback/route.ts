import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.redirect(new URL('/?error=auth_failed', req.url));
  }

  // 1. In a production app, you would exchange the 'code' for a GitBook access token
  // const token = await fetchGitBookToken(code);
  // const pages = await fetchGitBookPages(token);

  // MOCK DATA: Imagine this is the clean JSON payload returned from the GitBook API
  const mockGitBookPages = [
    { url: '/setup', text: "To install the chat widget, paste the iframe code into your HTML." },
    { url: '/billing', text: "We accept Visa and Stripe. We do not accept cryptocurrency." }
  ];

  // 2. Process and store the pages in Supabase
  for (const page of mockGitBookPages) {
    
    // Generate the embedding for this specific paragraph/page
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: page.text,
    });
    
    const embedding = embeddingResponse.data[0].embedding;

    // Save to your Supabase pgvector table
    await supabase.from('gitbook_documents').insert({
      page_url: page.url,
      content: page.text,
      embedding: embedding,
    });
  }

  // 3. Redirect the user back to your dashboard with a success flag
  return NextResponse.redirect(new URL('/?success=true', req.url));
}
