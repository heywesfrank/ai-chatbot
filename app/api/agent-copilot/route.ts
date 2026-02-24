// app/api/agent-copilot/route.ts
import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { supabase } from '@/lib/supabase';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { spaceId, messages } = await req.json();

    if (!spaceId || !messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { data: configData } = await supabase
      .from('bot_config')
      .select('match_threshold')
      .eq('space_id', spaceId)
      .maybeSingle();

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

    const systemInstructions = `
You are an AI Co-Pilot helping a human customer support agent.
Your task is to draft a helpful, accurate, and concise response to the user's latest message based ONLY on the provided CONTEXT.

- Be professional and empathetic.
- Do NOT include greetings (like "Hi") or sign-offs (like "Best, Support"), as the human agent will add those if needed.
- Focus directly on the core answer.
- If the CONTEXT does not contain the answer, politely write "I couldn't find a specific answer in the documentation."

CONTEXT:
${context || 'No context available.'}
`.trim();

    const requestPayload: any = {
      model: 'gpt-5-nano',
      instructions: systemInstructions,
      input: messages.map((m: any) => ({
        role: m.role === 'user' ? 'user' : 'assistant', // map internal roles safely
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
      },
    });
  } catch (error: any) {
    console.error("Co-Pilot API Error:", error);
    return NextResponse.json({ error: error.message || 'Copilot failed' }, { status: 500 });
  }
}
