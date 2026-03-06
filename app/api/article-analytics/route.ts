// app/api/article-analytics/route.ts
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

export const runtime = 'edge';

export async function OPTIONS(req: Request) {
  const origin = req.headers.get('origin') || '*';
  return NextResponse.json({}, {
    headers: {
      'Access-Control-Allow-Origin': origin, 
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

export async function POST(req: Request) {
  const origin = req.headers.get('origin') || '*';
  const corsHeaders = { 'Access-Control-Allow-Origin': origin };

  try {
    // IP Rate Limiting to prevent Analytics Data Spam & Database Flooding
    if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
      try {
        const redis = new Redis({
          url: process.env.UPSTASH_REDIS_REST_URL,
          token: process.env.UPSTASH_REDIS_REST_TOKEN,
        });
        const ratelimit = new Ratelimit({
          redis,
          limiter: Ratelimit.slidingWindow(5, '1 m'), // Max 5 analytics events per minute per IP
        });
        const ip = req.headers.get('x-real-ip') || req.headers.get('x-vercel-forwarded-for') || 'anonymous';
        const { success } = await ratelimit.limit(`rl_article_analytics_${ip}`);
        
        if (!success) {
          return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429, headers: corsHeaders });
        }
      } catch (err) {
        console.error("Rate limiting failure:", err);
      }
    }

    const { articleId, action } = await req.json();

    if (!articleId || !action) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400, headers: corsHeaders });
    }

    // Fetch current stats safely
    const { data: article, error: fetchError } = await supabase
      .from('help_center_articles')
      .select('views, upvotes, neutral_votes, downvotes')
      .eq('id', articleId)
      .single();

    if (fetchError || !article) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404, headers: corsHeaders });
    }

    const updates: Record<string, number> = {};

    if (action === 'view') {
      updates.views = (article.views || 0) + 1;
    } else if (action === 'upvote') {
      updates.upvotes = (article.upvotes || 0) + 1;
    } else if (action === 'neutral') {
      updates.neutral_votes = (article.neutral_votes || 0) + 1;
    } else if (action === 'downvote') {
      updates.downvotes = (article.downvotes || 0) + 1;
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400, headers: corsHeaders });
    }

    const { error: updateError } = await supabase
      .from('help_center_articles')
      .update(updates)
      .eq('id', articleId);

    if (updateError) throw updateError;

    return NextResponse.json({ success: true }, { headers: corsHeaders });
  } catch (error: any) {
    console.error('Article Analytics Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500, headers: corsHeaders }
    );
  }
}
