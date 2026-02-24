// app/api/widget-config/route.ts
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
  const origin = req.headers.get('origin') || req.headers.get('referer') || '*';
  const corsHeaders = { 'Access-Control-Allow-Origin': origin };

  try {
    const { searchParams } = new URL(req.url);
    const spaceId = searchParams.get('spaceId');

    if (!spaceId) {
      return NextResponse.json({ error: 'Missing spaceId' }, { status: 400, headers: corsHeaders });
    }

    const { data, error } = await supabase
      .from('bot_config')
      .select('primary_color, bot_font_color, user_font_color, agent_bubble_color, user_bubble_color, launcher_color, launcher_icon_color, header_text, description_text, input_placeholder, welcome_message, bot_avatar, remove_branding, show_prompts, suggested_prompts, lead_capture_enabled, page_context_enabled, routing_config, agents_online, allowed_domains')
      .eq('space_id', spaceId)
      .maybeSingle();

    if (error) console.error("Supabase Config Fetch Error:", error.message);

    if (data?.allowed_domains) {
      const allowedList = data.allowed_domains.split(',').map((d: string) => d.trim().toLowerCase()).filter(Boolean);
      if (allowedList.length > 0) {
        const originHost = origin.replace(/^https?:\/\//, '').split('/')[0].split(':')[0].toLowerCase();
        const isAllowed = allowedList.some((d: string) => originHost.includes(d) || originHost === d);
        if (!isAllowed && originHost && originHost !== '*') {
          return NextResponse.json({ error: 'Unauthorized: Domain not authorized.' }, { status: 403, headers: corsHeaders });
        }
      }
    }

    // Fetch proactive triggers
    const { data: triggersData } = await supabase
      .from('proactive_triggers')
      .select('url_match, delay_seconds, message')
      .eq('space_id', spaceId);

    if (data) {
      delete data.allowed_domains;
      (data as any).triggers = triggersData || [];
    }

    return NextResponse.json({ config: data || { triggers: triggersData || [] } }, { headers: corsHeaders });

  } catch (error: any) {
    console.error("Widget Config API Error:", error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch configuration' }, 
      { status: 500, headers: corsHeaders }
    );
  }
}
