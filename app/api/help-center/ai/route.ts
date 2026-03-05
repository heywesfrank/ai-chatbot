// app/api/help-center/ai/route.ts
import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { supabase } from '@/lib/supabase';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

export const runtime = 'edge';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    const { data: { user } } = await supabase.auth.getUser(authHeader?.replace('Bearer ', '') || '');
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { action, content, selection, tone, spaceId } = await req.json();

    if (!spaceId) {
      return NextResponse.json({ error: 'Space ID is required.' }, { status: 400 });
    }

    // IDOR Protection: Verify the user has access to this spaceId
    let hasAccess = false;
    const { data: config } = await supabase.from('bot_config').select('space_id').eq('user_id', user.id).maybeSingle();
    if (config?.space_id === spaceId) {
      hasAccess = true;
    } else if (user.email) {
      const { data: member } = await supabase.from('team_members').select('space_id').eq('email', user.email).maybeSingle();
      if (member?.space_id === spaceId) hasAccess = true;
    }
    
    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Rate limiting to prevent OpenAI budget draining
    if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
      try {
        const redis = new Redis({
          url: process.env.UPSTASH_REDIS_REST_URL,
          token: process.env.UPSTASH_REDIS_REST_TOKEN,
        });
        const ratelimit = new Ratelimit({
          redis,
          limiter: Ratelimit.slidingWindow(15, '1 m'), // 15 AI generations per minute per user
        });
        const { success } = await ratelimit.limit(`rl_ai_editor_${user.id}`);
        
        if (!success) {
          return NextResponse.json({ error: 'Too many requests. Please wait a moment.' }, { status: 429 });
        }
      } catch (err) {
        console.error("Rate limiting failure:", err);
      }
    }

    let instructions = '';
    let inputContent = '';

    if (action === 'seo') {
      instructions = 'Generate an SEO Title and SEO Description for the following article. Respond ONLY in JSON format: {"title": "The Title", "description": "The description (max 160 chars)"}. Return raw JSON, no markdown backticks.';
      inputContent = content;
    } else if (action === 'tldr') {
      instructions = 'Write a very concise TL;DR (1-2 sentences) for the following article. Output only the text.';
      inputContent = content;
    } else if (action === 'improve') {
      instructions = 'Improve the grammar and clarity of the following text. Preserve original markdown if present. Output only the improved text.';
      inputContent = selection;
    } else if (action === 'concise') {
      instructions = 'Make the following text more concise. Preserve original markdown if present. Output only the concise text.';
      inputContent = selection;
    } else if (action === 'expand') {
      instructions = 'Expand on the following text, providing more detail. Preserve original markdown if present. Output only the expanded text.';
      inputContent = selection;
    } else if (action === 'tone') {
      instructions = `Rewrite the following text to have a ${tone} tone. Preserve original markdown if present. Output only the rewritten text.`;
      inputContent = selection;
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const stream = await (openai as any).responses.create({
      model: 'gpt-5-nano',
      instructions,
      input: [{ role: 'user', content: inputContent }],
      stream: true,
    });

    let result = '';
    for await (const event of stream) {
      if (event.type === 'response.output_text.delta') {
        result += event.delta || '';
      }
    }

    if (action === 'seo') {
      try {
        const cleaned = result.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleaned);
        return NextResponse.json({ result: parsed });
      } catch (e) {
        return NextResponse.json({ error: 'Failed to parse JSON from AI' }, { status: 500 });
      }
    }

    return NextResponse.json({ result: result.trim() });
  } catch (error: any) {
    console.error("Editor AI Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
