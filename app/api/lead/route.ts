import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

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
    const { spaceId, name, email } = await req.json();

    if (!spaceId || !name || !email) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400, headers: corsHeaders });
    }

    const { error } = await supabase
      .from('leads')
      .insert({ space_id: spaceId, name, email });

    if (error) throw error;

    // Check if the user has a Lead webhook configured
    const { data: config } = await supabase
      .from('bot_config')
      .select('webhook_url')
      .eq('space_id', spaceId)
      .maybeSingle();

    if (config?.webhook_url) {
      try {
        await fetch(config.webhook_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            spaceId, 
            name, 
            email, 
            timestamp: new Date().toISOString() 
          })
        });
      } catch (webhookErr) {
        console.error("Webhook trigger failed:", webhookErr);
        // Do not throw; we still successfully captured the lead in Supabase
      }
    }

    return NextResponse.json({ success: true }, { headers: corsHeaders });
  } catch (error: any) {
    console.error("Lead API Error:", error);
    return NextResponse.json(
      { error: error.message || 'Failed to save lead' }, 
      { status: 500, headers: corsHeaders }
    );
  }
}
