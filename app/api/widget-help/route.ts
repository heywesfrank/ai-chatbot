// app/api/widget-help/route.ts
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Force Next.js to always fetch fresh data and never cache this route
export const dynamic = 'force-dynamic';
export const runtime = 'edge';

export async function OPTIONS(req: Request) {
  const origin = req.headers.get('origin') || '*';
  return NextResponse.json({}, {
    headers: {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

export async function GET(req: Request) {
  const origin = req.headers.get('origin') || '*';
  const corsHeaders = { 'Access-Control-Allow-Origin': origin };

  try {
    const { searchParams } = new URL(req.url);
    const spaceId = searchParams.get('spaceId');

    if (!spaceId) {
      return NextResponse.json({ error: 'Missing spaceId' }, { status: 400, headers: corsHeaders });
    }

    const { data, error } = await supabase
      .from('help_center_articles')
      .select('id, title, category, content')
      .eq('space_id', spaceId)
      .eq('status', 'published')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ articles: data || [] }, { headers: corsHeaders });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch articles' },
      { status: 500, headers: corsHeaders }
    );
  }
}
