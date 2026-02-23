import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const runtime = 'edge';

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // 1. URL Verification Challenge (Required for Slack to verify the endpoint)
    if (body.type === 'url_verification') {
      return new Response(body.challenge, { 
        status: 200, 
        headers: { 'Content-Type': 'text/plain' } 
      });
    }

    // 2. Process Incoming Messages from Agents
    if (body.event && body.event.type === 'message') {
      const { bot_id, thread_ts, text } = body.event;

      // Ignore messages from bots or un-threaded root messages to prevent infinite loops
      if (bot_id || !thread_ts) {
        return NextResponse.json({ success: true });
      }

      // Map slack_thread_ts back to the Live Session ID in your database
      const { data: session } = await supabase
        .from('live_sessions')
        .select('id')
        .eq('slack_thread_ts', thread_ts)
        .maybeSingle();

      if (session) {
        // Insert the Slack agent's reply into Supabase so it shows up in the Chat Widget
        await supabase.from('live_messages').insert({
          session_id: session.id,
          role: 'agent',
          content: text
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Slack Webhook Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
