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

    await supabase.from('tickets').insert({ space_id: spaceId, email, prompt });

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

    await supabase.from('live_messages').insert({
      session_id: session.id,
      role: 'user',
      content: prompt
    });

    const { data: config } = await supabase
      .from('bot_config')
      .select('slack_bot_token, slack_channel_id')
      .eq('space_id', spaceId)
      .maybeSingle();

    if (config?.slack_bot_token && config?.slack_channel_id) {
      try {
        const slackRes = await fetch('[https://slack.com/api/chat.postMessage](https://slack.com/api/chat.postMessage)', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.slack_bot_token}`
          },
          body: JSON.stringify({
            channel: config.slack_channel_id,
            text: `*New Ticket from ${email}*\n\n*Message:*\n${prompt}`,
          })
        });

        const slackData = await slackRes.json();
        if (slackData.ok && slackData.ts) {
          await supabase.from('live_sessions')
            .update({ slack_thread_ts: slackData.ts })
            .eq('id', session.id);
        }
      } catch (slackErr) {
        console.error("Failed to post to slack", slackErr);
      }
    }

    return NextResponse.json({ success: true, sessionId: session.id }, { headers: corsHeaders });
  } catch (error: any) {
    console.error("Handoff API Error:", error);
    return NextResponse.json(
      { error: error.message || 'Failed to submit ticket' }, 
      { status: 500, headers: corsHeaders }
    );
  }
}
