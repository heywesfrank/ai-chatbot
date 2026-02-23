// app/api/chat/route.ts
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
    const { messages, spaceId } = await req.json();
    const lastMessageContent = messages.filter((m: any) => m.role === 'user').pop()?.content || '';
    
    // 1. Fetch Configuration (Persona, FAQs, Language)
    const { data: configData } = await supabase
      .from('bot_config')
      .select('system_prompt, faq_overrides, language')
      .eq('space_id', spaceId)
      .maybeSingle();

    // 2. Check Custom FAQ Overrides first (Case Insensitive)
    const faqs = configData?.faq_overrides || [];
    const matchedFaq = faqs.find((f: any) => f.question.toLowerCase().trim() === lastMessageContent.toLowerCase().trim());

    if (matchedFaq) {
      // Stream back the matched FAQ answer instantly, bypassing the LLM
      const encoder = new TextEncoder();
      const readableStream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(`0:${JSON.stringify(matchedFaq.answer)}\n`));
          controller.close();
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
    }

    // 3. Fallback to normal Document embedding logic if no FAQ match
    const recentMessagesContext = messages
      .filter((m: any) => m.role === 'user')
      .slice(-3)
      .map((m: any) => m.content)
      .join('\n');

    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: recentMessagesContext,
    });

    const queryEmbedding = embeddingResponse.data?.[0]?.embedding;
    
    if (!queryEmbedding) {
      throw new Error('Failed to generate context embedding.');
    }

    // Calls the updated match_documents which queries knowledge_documents
    const { data: documents, error: supabaseError } = await supabase.rpc('match_documents', {
      query_embedding: queryEmbedding,
      match_threshold: 0.2,
      match_count: 5,       
      p_space_id: spaceId 
    });

    if (supabaseError) {
      console.error("Supabase Search Error:", supabaseError);
    }

    const context = documents && documents.length > 0 
      ? documents.map((doc: DocumentMatch) => `[Source: ${doc.page_url}]\n${doc.content}`).join('\n\n') 
      : "";

    const agentPersona = configData?.system_prompt || "You are a helpful, minimalist support assistant.";
    const language = configData?.language || 'Auto-detect';
    const langInstruction = language === 'Auto-detect'
      ? 'Automatically detect the language of the user and reply in that same language.'
      : `You MUST always reply in ${language}, regardless of the language the user speaks.`;

    const systemInstructions = `
${agentPersona}

CORE DIRECTIVES:
1. LANGUAGE: ${langInstruction}
2. CONVERSATIONAL MODE: If the user is making casual conversation (e.g., greetings, goodbyes, expressions of gratitude, or general small talk), respond naturally and politely. Ignore the CONTEXT.
3. SUPPORT MODE: If the user is asking a question or seeking help, you MUST answer using ONLY the CONTEXT below. When answering from CONTEXT, you MUST append the source URLs you used at the very end of your response using this exact markdown format:

**Sources:** [1](URL) [2](URL)
4. UNKNOWN INFO: If in Support Mode and the CONTEXT does not contain the answer, politely state that you do not have that information in your documentation. Do not guess or hallucinate.

CONTEXT:
${context || "No context available."}
`.trim();

    const stream = await openai.responses.create({
      model: 'gpt-5-nano',
      instructions: systemInstructions,
      input: messages.map((m: any) => ({ 
        role: m.role, 
        content: m.content 
      })),
      stream: true, 
    });

    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (event.type === 'response.output_text.delta') {
              const deltaText = event.delta || '';
              if (deltaText) {
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
