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
    const { spaceId, email, prompt, history } = await req.json();

    if (!spaceId || !email || !prompt) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400, headers: corsHeaders });
    }

    // Retain legacy ticket mapping for backup
    await supabase.from('tickets').insert({ space_id: spaceId, email, prompt });

    // Initiate the Real-Time Live Session
    const { data: session, error: sessionError } = await supabase
      .from('live_sessions')
      .insert({
        space_id: spaceId,
        email,
        status: 'open',
        history: JSON.stringify(history || [])
      })
      .select()
      .single();

    if (sessionError) throw sessionError;

    // Immediately push the user's initial hand-off prompt into the live message table
    await supabase.from('live_messages').insert({
      session_id: session.id,
      role: 'user',
      content: prompt
    });

    return NextResponse.json({ success: true, sessionId: session.id }, { headers: corsHeaders });
  } catch (error: any) {
    console.error("Handoff API Error:", error);
    return NextResponse.json(
      { error: error.message || 'Failed to submit ticket' }, 
      { status: 500, headers: corsHeaders }
    );
  }
}
