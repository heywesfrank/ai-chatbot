import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

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
      .from('bot_config')
      .select('primary_color, header_text, welcome_message, bot_avatar, remove_branding, show_prompts, suggested_prompts')
      .eq('space_id', spaceId)
      .maybeSingle();

    if (error) {
      console.error("Supabase Config Fetch Error:", error.message);
    }

    // Safely return defaults if no config is found
    return NextResponse.json({ config: data || {} }, { headers: corsHeaders });

  } catch (error: any) {
    console.error("Widget Config API Error:", error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch configuration' }, 
      { status: 500, headers: corsHeaders }
    );
  }
}
