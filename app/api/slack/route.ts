// app/api/slack/route.ts
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import crypto from 'crypto';

export async function POST(req: Request) {
  try {
    // 0. Verify Slack Signature to prevent webhook forgery
    const rawBody = await req.text();
    const signature = req.headers.get('x-slack-signature');
    const timestamp = req.headers.get('x-slack-request-timestamp');
    const signingSecret = process.env.SLACK_SIGNING_SECRET;

    if (!signature || !timestamp || !signingSecret) {
      return NextResponse.json({ error: 'Unauthorized: Missing signature or secret' }, { status: 401 });
    }

    // Prevent replay attacks (5 minute threshold)
    const time = Math.floor(Date.now() / 1000);
    if (Math.abs(time - parseInt(timestamp)) > 300) {
      return NextResponse.json({ error: 'Unauthorized: Request expired' }, { status: 401 });
    }

    const sigBasestring = `v0:${timestamp}:${rawBody}`;
    const mySignature = 'v0=' + crypto.createHmac('sha256', signingSecret).update(sigBasestring).digest('hex');

    const mySigBuffer = Buffer.from(mySignature, 'utf8');
    const slackSigBuffer = Buffer.from(signature, 'utf8');

    if (mySigBuffer.length !== slackSigBuffer.length || !crypto.timingSafeEqual(mySigBuffer, slackSigBuffer)) {
      return NextResponse.json({ error: 'Unauthorized: Invalid signature' }, { status: 401 });
    }

    const body = JSON.parse(rawBody);

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
