// app/api/chat/route.ts
import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { supabase } from '@/lib/supabase';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import Sentiment from 'sentiment';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Handle browser clicks to prevent 405 errors
export async function GET() {
  return NextResponse.json(
    { message: "Chat API is running successfully. Use POST to interact." },
    { headers: { 'Access-Control-Allow-Origin': '*' } }
  );
}

export async function OPTIONS(req: Request) {
  const origin = req.headers.get('origin') || '*';
  return NextResponse.json(
    {},
    {
      headers: {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    }
  );
}

export async function POST(req: Request) {
  const origin = req.headers.get('origin') || req.headers.get('referer') || '*';
  const corsHeaders = { 'Access-Control-Allow-Origin': origin };

  try {
    const body = await req.json();
    const { messages, spaceId, currentUrl, routingContext } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Invalid messages format' }, { status: 400, headers: corsHeaders });
    }

    // 1. Fetch Core Configuration
    const { data: configData } = await supabase
      .from('bot_config')
      .select('system_prompt, language, match_threshold, allowed_domains, follow_up_questions_enabled')
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

    // --- SENTIMENT ANALYSIS START ---
    let sentimentScore = 0;
    let sentimentContext = '';
    try {
      if (lastMessageContent) {
        const sentiment = new Sentiment();
        const analysis = sentiment.analyze(lastMessageContent);
        sentimentScore = analysis.score;
        
        if (spaceId) {
          supabase.from('bot_messages').insert({
            space_id: spaceId,
            role: 'user',
            content: lastMessageContent,
            sentiment_score: sentimentScore,
          }).then(({ error }) => {
            if (error) console.error('Failed to log message sentiment:', error);
          });
        }

        if (sentimentScore <= -3) {
          sentimentContext = `\nIMPORTANT: The user has expressed significant frustration. Be extremely empathetic, acknowledge their frustration, and offer human support if you cannot resolve it immediately.`;
        }
      }
    } catch (e) {
      console.error('Sentiment analysis failed:', e);
    }
    // --- SENTIMENT ANALYSIS END ---

    // 4. FAQ Exact Match
    if (lastMessageContent && spaceId) {
      const { data: matchedFaq } = await supabase
        .from('faqs')
        .select('answer')
        .eq('space_id', spaceId)
        .ilike('question', lastMessageContent.trim())
        .maybeSingle();

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
    }

    // 5. RAG Retrieval
    const recentMessagesContext = messages
      .filter((m: any) => m.role === 'user')
      .slice(-3)
      .map((m: any) => m.content)
      .join('\n');

    let queryEmbedding = null;
    if (recentMessagesContext) {
      const embeddingResponse = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: recentMessagesContext,
      });
      queryEmbedding = embeddingResponse.data?.[0]?.embedding;
    }

    let context = '';
    if (queryEmbedding && spaceId) {
      const { data: documents } = await supabase.rpc('match_documents', {
        query_embedding: queryEmbedding,
        match_threshold: configData?.match_threshold ?? 0.2,
        match_count: 5,
        p_space_id: spaceId,
      });

      context = documents && documents.length > 0
          ? documents.map((doc: any) => `[Source: ${doc.page_url}]\n${doc.content}`).join('\n\n')
          : '';
    }

    const agentPersona = configData?.system_prompt || 'You are a helpful, minimalist support assistant.';
    const language = configData?.language || 'Auto-detect';
    const langInstruction = language === 'Auto-detect'
        ? 'Automatically detect the language of the user and reply in that same language.'
        : `You MUST always reply in ${language}, regardless of the language the user speaks.`;

    const routingInstruction = routingContext ? `USER SELECTED CONTEXT: ${routingContext}` : '';
    const pageContextInstruction = currentUrl ? `USER IS VIEWING PAGE: ${currentUrl}` : '';

    const followUpInstruction = configData?.follow_up_questions_enabled
      ? `\n5. FOLLOW-UP QUESTIONS: At the very end of your response, always provide exactly 3 short, relevant follow-up questions the user might ask next. Format them exactly like this:\n**Follow-ups:**\n- [Question 1]\n- [Question 2]\n- [Question 3]`
      : '';

    const systemInstructions = `
${agentPersona}

CORE DIRECTIVES:
1. LANGUAGE: ${langInstruction}
2. CONVERSATIONAL MODE: If the user is making casual conversation, respond naturally and politely.
3. SUPPORT MODE: If asking a question, you MUST answer using ONLY the CONTEXT below. You MUST append the source URLs at the very end in this format: **Sources:** [1](URL) [2](URL)
4. UNKNOWN INFO: If the CONTEXT does not contain the answer, politely state you do not have that information.${followUpInstruction}${sentimentContext}

SESSION METADATA:
${routingInstruction}
${pageContextInstruction}

CONTEXT:
${context || 'No context available.'}
`.trim();

    const requestPayload: any = {
      model: 'gpt-5-nano',
      instructions: systemInstructions,
      input: messages.map((m: any) => ({
        role: m.role === 'user' ? 'user' : 'assistant', // Forces safety against unknown Vercel AI SDK roles
        content: m.content,
      })),
      stream: true,
    };

    const stream = await (openai as any).responses.create(requestPayload);

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
    console.error("Chat API Error:", error);
    return NextResponse.json({ error: error.message || 'Chat failed' }, { status: 500, headers: corsHeaders });
  }
}
