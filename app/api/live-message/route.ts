// app/api/live-message/route.ts
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import Sentiment from 'sentiment';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

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

    // Payload Size and Type Validation
    if (
      typeof content !== 'string' || content.length > 3000 ||
      typeof sessionId !== 'string' || sessionId.length > 50
    ) {
      return NextResponse.json({ error: 'Payload validation failed or message too long.' }, { status: 400, headers: corsHeaders });
    }

    // 1. Validate that the session actually exists and fetch its details
    const { data: sessionInfo, error: sessionInfoError } = await supabase
      .from('live_sessions')
      .select('space_id, status')
      .eq('id', sessionId)
      .single();
      
    if (sessionInfoError || !sessionInfo) {
       return NextResponse.json({ error: 'Session not found' }, { status: 404, headers: corsHeaders });
    }

    const spaceId = sessionInfo.space_id;

    // 2. Authenticate and Authorize 'agent' or 'note' messages
    if (role === 'agent' || role === 'note') {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
      
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabase.auth.getUser(token);
      if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });

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
    // 3. Validate 'user' messages
    else if (role === 'user') {
      // Prevent users from injecting messages into closed tickets
      if (sessionInfo.status !== 'open') {
         return NextResponse.json({ error: 'Session is closed' }, { status: 400, headers: corsHeaders });
      }

      // IP Rate Limiting to prevent database flooding / spam
      if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
        try {
          const redis = new Redis({
            url: process.env.UPSTASH_REDIS_REST_URL,
            token: process.env.UPSTASH_REDIS_REST_TOKEN,
          });
          const ratelimit = new Ratelimit({
            redis,
            limiter: Ratelimit.slidingWindow(20, '1 m'), // Max 20 messages per minute per IP
          });
          const ip = req.headers.get('x-real-ip') || req.headers.get('x-vercel-forwarded-for') || 'anonymous';
          const { success } = await ratelimit.limit(`rl_live_msg_${sessionId}_${ip}`);
          
          if (!success) {
            return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429, headers: corsHeaders });
          }
        } catch (err) {
          console.error("Rate limiting failure:", err);
        }
      }
    }

    let sentimentScore = null;
    if (role === 'user') {
      sentimentScore = sentiment.analyze(content).score;
    }

    // 4. Insert the message securely
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
