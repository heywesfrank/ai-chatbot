// app/api/ticket/route.ts
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import Sentiment from 'sentiment';

const sentiment = new Sentiment();
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

    const sentimentScore = sentiment.analyze(prompt).score;

    await supabase.from('live_messages').insert({
      session_id: session.id,
      role: 'user',
      content: prompt,
      sentiment_score: sentimentScore
    });

    // Check if Slack is connected via Integrations table
    const { data: slackIntegration } = await supabase
      .from('workspace_integrations')
      .select('config')
      .eq('space_id', spaceId)
      .eq('provider', 'slack')
      .maybeSingle();

    const slackToken = slackIntegration?.config?.slack_bot_token;
    const channelId = slackIntegration?.config?.slack_channel_id;

    if (slackToken && channelId) {
      try {
        const slackRes = await fetch('https://slack.com/api/chat.postMessage', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${slackToken}`
          },
          body: JSON.stringify({
            channel: channelId,
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
