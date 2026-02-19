import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { supabase } from '@/lib/supabase';

// Utilize the Next.js Edge Runtime for high performance
export const runtime = 'edge';

// Interface for strictly typing the Supabase RPC return data
interface DocumentMatch {
  id: number;
  content: string;
  page_url: string;
  similarity: number;
}

// Initialize OpenAI using your secret key from Vercel
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// 1. Add an OPTIONS handler to manage CORS preflight requests based on Origin
export async function OPTIONS(req: Request) {
  const origin = req.headers.get('origin') || '*';
  return NextResponse.json(
    {},
    {
      headers: {
        'Access-Control-Allow-Origin': origin, 
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    }
  );
}

export async function POST(req: Request) {
  const origin = req.headers.get('origin') || '*';
  const corsHeaders = { 'Access-Control-Allow-Origin': origin };

  try {
    // 1. Destructure messages and spaceId from the request
    const { messages, spaceId } = await req.json();
    const latestMessage = messages[messages.length - 1].text;

    // 2. Parallelize independent database calls
    const configPromise = supabase
      .from('bot_config')
      .select('system_prompt')
      .eq('space_id', spaceId)
      .single();

    const embeddingPromise = openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: latestMessage,
    });

    const [configResponse, embeddingResponse] = await Promise.all([configPromise, embeddingPromise]);

    const queryEmbedding = embeddingResponse.data[0].embedding;
    const agentPersona = configResponse.data?.system_prompt || "You are a helpful, minimalist support assistant.";

    // 3. Search Supabase for the top 5 matching GitBook paragraphs
    const { data: documents, error: supabaseError } = await supabase.rpc('match_documents', {
      query_embedding: queryEmbedding,
      match_threshold: 0.3, 
      match_count: 5,       
      p_space_id: spaceId 
    });

    if (supabaseError) {
      console.error("Supabase Search Error:", supabaseError);
    }

    // 4. Combine the retrieved paragraphs into one string of context using Strict Types
    const context = documents && documents.length > 0 
      ? documents.map((doc: DocumentMatch) => doc.content).join('\n\n') 
      : "";

    // 5. Assemble the final instructions
    const systemInstructions = `${agentPersona}\n\nYou are allowed to respond naturally and politely to basic greetings, pleasantries, or casual conversation (e.g., "hello", "how are you", "what's up").\n\nHowever, for ANY actual questions or requests for information, you must answer using ONLY the provided context below. \nIf the context is empty or does not contain the answer to their specific question, politely inform the user that you don't have that information in your documentation and ask if there's anything else you can assist them with. Do not hallucinate facts.\n\nCONTEXT:\n${context || "No context available."}`;

    // 6. Call GPT-5 Nano with stream=true
    const stream = await openai.responses.create({
      model: 'gpt-5-nano',
      instructions: systemInstructions,
      input: messages.map((m: any) => ({ 
        role: m.role, 
        content: m.text 
      })),
      stream: true, // Enable streaming
    });

    // 7. Stream the response chunks to the client using SSE
    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (event.type === 'response.output_text.delta') {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
            }
          }
          controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      }
    });

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        ...corsHeaders
      }
    });

  } catch (error: any) {
    console.error("Chat API Error:", error);
    return NextResponse.json(
      { error: error.message || 'Chat failed' },
      { 
        status: 500,
        headers: corsHeaders
      }
    );
  }
}
