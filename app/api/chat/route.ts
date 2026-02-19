import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { supabase } from '@/lib/supabase';

// Initialize OpenAI using your secret key from Vercel
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// 1. Add an OPTIONS handler to manage CORS preflight requests
export async function OPTIONS() {
  return NextResponse.json(
    {},
    {
      headers: {
        'Access-Control-Allow-Origin': '*', // Allows requests from any origin
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    }
  );
}

export async function POST(req: Request) {
  try {
    // 1. Destructure messages and spaceId from the request
    const { messages, spaceId } = await req.json();
    const latestMessage = messages[messages.length - 1].text;

    // 2. Turn the user's question into a vector embedding
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: latestMessage,
    });
    const queryEmbedding = embeddingResponse.data[0].embedding;

    // 3. Search Supabase for the top 5 matching GitBook paragraphs
    const { data: documents } = await supabase.rpc('match_documents', {
      query_embedding: queryEmbedding,
      match_threshold: 0.3, 
      match_count: 5,       
      p_space_id: spaceId

    // 4. Combine the retrieved paragraphs into one string of context
    const context = documents?.map((doc: any) => doc.content).join('\n\n') || "No relevant documentation found.";

    // 5. Call GPT-5 Nano using the new Responses API
    const response = await openai.responses.create({
      model: 'gpt-5-nano',
      instructions: `You are a helpful, minimalist support assistant. Answer the user's question using ONLY this context:\n\n${context}`,
      input: messages.map((m: any) => ({ 
        role: m.role, 
        content: m.text 
      })),
    });

    // 6. Return the text using the new SDK helper with CORS headers
    return NextResponse.json(
      { reply: response.output_text },
      {
        headers: {
          'Access-Control-Allow-Origin': '*', // Required for the browser to accept the response
        },
      }
    );
  } catch (error: any) {
    console.error("Chat API Error:", error);
    return NextResponse.json(
      { error: error.message || 'Chat failed' },
      { 
        status: 500,
        headers: { 'Access-Control-Allow-Origin': '*' }
      }
    );
  }
}
