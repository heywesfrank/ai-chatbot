// app/api/live-message/route.ts
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import Sentiment from 'sentiment';

const sentiment = new Sentiment();

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

    let sentimentScore = null;
    if (role === 'user') {
      sentimentScore = sentiment.analyze(content).score;
    }

    const { error } = await supabase
      .from('live_messages')
      .insert({ session_id: sessionId, role, content, sentiment_score: sentimentScore });

    if (error) throw error;

    // Optional sync out to Slack Thread if the agent replies from Next.js Inbox
    if (role === 'agent' || role === 'note') {
      const { data: session } = await supabase
        .from('live_sessions')
        .select('space_id, slack_thread_ts')
        .eq('id', sessionId)
        .single();
        
      if (session && session.slack_thread_ts) {
        const { data: config } = await supabase
          .from('bot_config')
          .select('slack_bot_token, slack_channel_id')
          .eq('space_id', session.space_id)
          .single();
          
        if (config?.slack_bot_token) {
          await fetch('https://slack.com/api/chat.postMessage', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.slack_bot_token}` },
            body: JSON.stringify({
              channel: config.slack_channel_id,
              text: role === 'note' ? `*_Internal Note:_*\n${content}` : content,
              thread_ts: session.slack_thread_ts
            })
          });
        }
      }
    }

    return NextResponse.json({ success: true }, { headers: corsHeaders });
  } catch (error: any) {
    console.error("Live Message API Error:", error);
    return NextResponse.json(
      { error: error.message || 'Failed to send message' }, 
      { status: 500, headers: corsHeaders }
    );
  }
}
