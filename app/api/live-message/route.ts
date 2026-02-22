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
    const { sessionId, role, content } = await req.json();

    if (!sessionId || !role || !content) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400, headers: corsHeaders });
    }

    const { error } = await supabase
      .from('live_messages')
      .insert({ session_id: sessionId, role, content });

    if (error) throw error;

    return NextResponse.json({ success: true }, { headers: corsHeaders });
  } catch (error: any) {
    console.error("Live Message API Error:", error);
    return NextResponse.json(
      { error: error.message || 'Failed to send message' }, 
      { status: 500, headers: corsHeaders }
    );
  }
}
