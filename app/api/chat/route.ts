import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { supabase } from '@/lib/supabase';

// Initialize OpenAI using your secret key from Vercel
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: Request) {
  const { messages } = await req.json();
  const latestMessage = messages[messages.length - 1].text;

export async function POST(req: Request) {
  // 1. Destructure spaceId from the request
  const { messages, spaceId } = await req.json();
  const latestMessage = messages[messages.length - 1].text;

  const embeddingResponse = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: latestMessage,
  });
  const queryEmbedding = embeddingResponse.data[0].embedding;

  // 2. Pass the spaceId to Supabase to filter matching documents
  const { data: documents } = await supabase.rpc('match_documents', {
    query_embedding: queryEmbedding,
    match_threshold: 0.7, 
    match_count: 5,     
    p_space_id: spaceId // <--- Filters vectors to ONLY this user's data
  });

  // 3. Combine the retrieved paragraphs into one string of context
  const context = documents?.map((doc: any) => doc.content).join('\n\n') || "No relevant documentation found.";

  // 4. Call GPT-5 Nano using the new Responses API
  const response = await openai.responses.create({
    model: 'gpt-5-nano',
    instructions: `You are a helpful, minimalist support assistant. Answer the user's question using ONLY this context:\n\n${context}`,
    input: messages.map((m: any) => ({ 
      role: m.role, 
      content: m.text 
    })),
  });

  // 5. Return the text using the new SDK helper
  return NextResponse.json({ reply: response.output_text });
}
