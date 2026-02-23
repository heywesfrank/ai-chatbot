// app/api/chat/route.ts
import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { supabase } from '@/lib/supabase';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

export const runtime = 'edge';

interface DocumentMatch {
  id: number;
  content: string;
  page_url: string;
  similarity: number;
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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
  const origin = req.headers.get('origin') || req.headers.get('referer') || '*';
  const corsHeaders = { 'Access-Control-Allow-Origin': origin };

  try {
    const { messages, spaceId } = await req.json();

    // 1. Fetch Configuration
    const { data: configData } = await supabase
      .from('bot_config')
      .select('system_prompt, faq_overrides, language, temperature, match_threshold, reasoning_effort, verbosity, allowed_domains')
      .eq('space_id', spaceId)
      .maybeSingle();

    // 2. Domain Whitelisting Check
    if (configData?.allowed_domains) {
      const allowedList = configData.allowed_domains.split(',').map((d: string) => d.trim().toLowerCase()).filter(Boolean);
      if (allowedList.length > 0) {
        const originHost = origin.replace(/^https?:\/\//, '').split('/')[0].split(':')[0].toLowerCase();
        const isAllowed = allowedList.some((d: string) => originHost.includes(d) || originHost === d);
        if (!isAllowed && originHost && originHost !== '*') {
          return NextResponse.json({ error: 'Unauthorized: Domain not authorized.' }, { status: 403, headers: corsHeaders });
        }
      }
    }

    // 3. Upstash/KV IP Rate Limiting
    if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
      try {
        const redis = new Redis({
          url: process.env.UPSTASH_REDIS_REST_URL,
          token: process.env.UPSTASH_REDIS_REST_TOKEN,
        });
        const ratelimit = new Ratelimit({
          redis,
          limiter: Ratelimit.slidingWindow(20, '1 m'),
        });
        const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'anonymous';
        const { success } = await ratelimit.limit(`rl_chat_${spaceId}_${ip}`);
        
        if (!success) {
          return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429, headers: corsHeaders });
        }
      } catch (err) {
        console.error("Rate limiting failure:", err);
      }
    }

    const lastMessageContent = messages.filter((m: any) => m.role === 'user').pop()?.content || '';

    // 4. FAQ Exact Match
    const faqs = configData?.faq_overrides || [];
    const matchedFaq = faqs.find(
      (f: any) => f.question.toLowerCase().trim() === lastMessageContent.toLowerCase().trim()
    );

    if (matchedFaq) {
      const encoder = new TextEncoder();
      const readableStream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(`0:${JSON.stringify(matchedFaq.answer)}\n`));
          controller.close();
        },
      });

      return new Response(readableStream, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'X-Vercel-AI-Data-Stream': 'v1',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
          ...corsHeaders,
        },
      });
    }

    // 5. RAG Retrieval
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
    if (!queryEmbedding) throw new Error('Failed to generate embedding.');

    const { data: documents } = await supabase.rpc('match_documents', {
      query_embedding: queryEmbedding,
      match_threshold: configData?.match_threshold ?? 0.2,
      match_count: 5,
      p_space_id: spaceId,
    });

    const context = documents && documents.length > 0
        ? documents.map((doc: DocumentMatch) => `[Source: ${doc.page_url}]\n${doc.content}`).join('\n\n')
        : '';

    const agentPersona = configData?.system_prompt || 'You are a helpful, minimalist support assistant.';
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
${context || 'No context available.'}
`.trim();

    const requestPayload: any = {
      model: 'gpt-5-nano',
      instructions: systemInstructions,
      input: messages.map((m: any) => ({
        role: m.role,
        content: m.content,
      })),
      temperature: configData?.temperature ?? 0.5,
      reasoning: { effort: configData?.reasoning_effort || 'medium' },
      text: { verbosity: configData?.verbosity || 'medium' },
      stream: true,
    };

    const stream = await openai.responses.create(requestPayload as OpenAI.Responses.ResponseCreateParamsStreaming);

    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (event.type === 'response.output_text.delta' && event.delta) {
              controller.enqueue(encoder.encode(`0:${JSON.stringify(event.delta)}\n`));
            }
          }
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Vercel-AI-Data-Stream': 'v1',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Chat failed' }, { status: 500, headers: corsHeaders });
  }
}
