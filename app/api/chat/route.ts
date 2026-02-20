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
    
    // Concatenate the last 3 user messages to give the embedding model conversational context
    const recentMessagesContext = messages
      .filter((m: any) => m.role === 'user')
      .slice(-3)
      .map((m: any) => m.content)
      .join('\n');

    // 2. Parallelize independent database calls
    const configPromise = supabase
      .from('bot_config')
      .select('system_prompt')
      .eq('space_id', spaceId)
      .maybeSingle(); 

    const embeddingPromise = openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: recentMessagesContext,
    });

    const [configResponse, embeddingResponse] = await Promise.all([configPromise, embeddingPromise]);

    const queryEmbedding = embeddingResponse.data[0].embedding;
    const agentPersona = configResponse.data?.system_prompt || "You are a helpful, minimalist support assistant.";

    // 3. Search Supabase for the top 5 matching GitBook paragraphs
    const { data: documents, error: supabaseError } = await supabase.rpc('match_documents', {
      query_embedding: queryEmbedding,
      match_threshold: 0.2,
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

    // 5. Assemble the final instructions using clean, categorical logic
    const systemInstructions = `
${agentPersona}

CORE DIRECTIVES:
1. CONVERSATIONAL MODE: If the user is making casual conversation (e.g., greetings, goodbyes, expressions of gratitude, or general small talk), respond naturally and politely. Ignore the CONTEXT.
2. SUPPORT MODE: If the user is asking a question or seeking help, you MUST answer using ONLY the CONTEXT below.
3. UNKNOWN INFO: If in Support Mode and the CONTEXT does not contain the answer, politely state that you do not have that information in your documentation. Do not guess or hallucinate.

CONTEXT:
${context || "No context available."}
`.trim();

    // 6. Call Custom gpt-5-nano with stream=true
    const stream = await openai.responses.create({
      model: 'gpt-5-nano',
      instructions: systemInstructions,
      input: messages.map((m: any) => ({ 
        role: m.role, 
        content: m.content 
      })),
      stream: true, 
    });

    // 7. Format the custom response stream into the Vercel AI DataStream Protocol
    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (event.type === 'response.output_text.delta') {
              // TypeScript fix: ResponseTextDeltaEvent strictly uses `delta`
              const deltaText = event.delta || '';
              if (deltaText) {
                // Formatting payload as: 0:"The text chunk"\n for Vercel AI SDK
                controller.enqueue(encoder.encode(`0:${JSON.stringify(deltaText)}\n`));
              }
            }
          }
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      }
    });

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Vercel-AI-Data-Stream': 'v1', 
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
