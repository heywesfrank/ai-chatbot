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
    const { spaceId, messageId, prompt, response, rating } = await req.json();

    if (!spaceId || !messageId || !rating) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400, headers: corsHeaders });
    }

    // Delete any existing feedback for this specific message to allow switching votes
    await supabase.from('chat_feedback').delete().eq('message_id', messageId);

    // Insert the new/updated feedback
    const { error } = await supabase
      .from('chat_feedback')
      .insert({ space_id: spaceId, message_id: messageId, prompt, response, rating });

    if (error) throw error;

    return NextResponse.json({ success: true }, { headers: corsHeaders });
  } catch (error: any) {
    console.error("Feedback API Error:", error);
    return NextResponse.json(
      { error: error.message || 'Failed to save feedback' }, 
      { status: 500, headers: corsHeaders }
    );
  }
}
