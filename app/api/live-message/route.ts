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

    // Authenticate and Authorize 'agent' or 'note' messages
    if (role === 'agent' || role === 'note') {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
      
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabase.auth.getUser(token);
      if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });

      // Fetch the session to determine the associated space_id
      const { data: sessionInfo, error: sessionInfoError } = await supabase
        .from('live_sessions')
        .select('space_id')
        .eq('id', sessionId)
        .single();
        
      if (sessionInfoError || !sessionInfo) {
         return NextResponse.json({ error: 'Session not found' }, { status: 404, headers: corsHeaders });
      }

      const spaceId = sessionInfo.space_id;
      let hasAccess = false;
      
      // Verify Ownership or Agent status
      const { data: config } = await supabase.from('bot_config').select('space_id').eq('user_id', user.id).maybeSingle();
      if (config?.space_id === spaceId) {
         hasAccess = true;
      } else if (user.email) {
         const { data: member } = await supabase.from('team_members').select('space_id').eq('email', user.email).maybeSingle();
         if (member?.space_id === spaceId) hasAccess = true;
      }
      
      if (!hasAccess) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403, headers: corsHeaders });
      }
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
        const { data: slackIntegration } = await supabase
          .from('workspace_integrations')
          .select('config')
          .eq('space_id', session.space_id)
          .eq('provider', 'slack')
          .maybeSingle();
          
        const slackToken = slackIntegration?.config?.slack_bot_token;
        const channelId = slackIntegration?.config?.slack_channel_id;
          
        if (slackToken && channelId) {
          await fetch('https://slack.com/api/chat.postMessage', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${slackToken}` },
            body: JSON.stringify({
              channel: channelId,
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
