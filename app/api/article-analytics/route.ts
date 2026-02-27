// app/api/article-analytics/route.ts
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const runtime = 'edge';

export async function POST(req: Request) {
  try {
    const { articleId, action } = await req.json();

    if (!articleId || !action) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    // Fetch current stats safely
    const { data: article, error: fetchError } = await supabase
      .from('help_center_articles')
      .select('views, upvotes, neutral_votes, downvotes')
      .eq('id', articleId)
      .single();

    if (fetchError || !article) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 });
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
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const { error: updateError } = await supabase
      .from('help_center_articles')
      .update(updates)
      .eq('id', articleId);

    if (updateError) throw updateError;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Article Analytics Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
