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
    const { spaceId, email, prompt } = await req.json();

    if (!spaceId || !email || !prompt) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400, headers: corsHeaders });
    }

    const { error } = await supabase
      .from('tickets')
      .insert({ space_id: spaceId, email, prompt });

    if (error) throw error;

    return NextResponse.json({ success: true }, { headers: corsHeaders });
  } catch (error: any) {
    console.error("Ticket API Error:", error);
    return NextResponse.json(
      { error: error.message || 'Failed to submit ticket' }, 
      { status: 500, headers: corsHeaders }
    );
  }
}
