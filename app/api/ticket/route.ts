// app/api/ticket/route.ts
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import Sentiment from 'sentiment';
import { UAParser } from 'ua-parser-js';
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
    const { spaceId, email, prompt, history, url } = await req.json();

    if (!spaceId || !email || !prompt) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400, headers: corsHeaders });
    }

    // Payload Size and Type Validation (Mitigates Insufficient Payload Size Limits)
    if (
      typeof email !== 'string' || email.length > 255 ||
      typeof prompt !== 'string' || prompt.length > 2000 ||
      typeof spaceId !== 'string' || spaceId.length > 50 ||
      (url && (typeof url !== 'string' || url.length > 2048))
    ) {
      return NextResponse.json({ error: 'Payload validation failed or data exceeds allowed length.' }, { status: 400, headers: corsHeaders });
    }

    // IP Rate Limiting to prevent Ticket Spam / Quota Exhaustion
    if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
      try {
        const redis = new Redis({
          url: process.env.UPSTASH_REDIS_REST_URL,
          token: process.env.UPSTASH_REDIS_REST_TOKEN,
        });
        const ratelimit = new Ratelimit({
          redis,
          limiter: Ratelimit.slidingWindow(3, '1 m'), // Max 3 tickets per minute per IP
        });
        const ip = req.headers.get('x-real-ip') || req.headers.get('x-vercel-forwarded-for') || 'anonymous';
        const { success } = await ratelimit.limit(`rl_ticket_${spaceId}_${ip}`);
        
        if (!success) {
          return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429, headers: corsHeaders });
        }
      } catch (err) {
        console.error("Rate limiting failure:", err);
      }
    }

    // Capture Metadata
    const userAgent = req.headers.get('user-agent') || '';
    const parser = new UAParser(userAgent);
    const browser = parser.getBrowser();
    const os = parser.getOS();
    
    const city = req.headers.get('x-vercel-ip-city') || '';
    const country = req.headers.get('x-vercel-ip-country') || '';
    let location = 'Unknown Location';
    if (city && country) location = `${city}, ${country}`;
    else if (country) location = country;

    const metadata = {
      browser: browser.name ? `${browser.name} ${browser.version || ''}`.trim() : 'Unknown Browser',
      os: os.name ? `${os.name} ${os.version || ''}`.trim() : 'Unknown OS',
      location,
      url: url || 'Unknown URL'
    };

    await supabase.from('tickets').insert({ space_id: spaceId, email, prompt });

    const { data: session, error: sessionError } = await supabase
      .from('live_sessions')
      .insert({
        space_id: spaceId,
        email,
        status: 'open',
        history: JSON.stringify(history || []),
        metadata
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

    // Determine owner email
    const { data: config } = await supabase.from('bot_config').select('user_id').eq('space_id', spaceId).maybeSingle();
    let ownerEmail = '';
    if (config?.user_id) {
       const { data: userData } = await supabase.auth.admin.getUserById(config.user_id);
       if (userData?.user?.email) ownerEmail = userData.user.email;
    }

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
            text: `*New Ticket from ${email}*\n*URL:* ${metadata.url}\n*Browser:* ${metadata.browser} on ${metadata.os}\n*Location:* ${metadata.location}\n\n*Message:*\n${prompt}`,
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
    } else if (ownerEmail && process.env.RESEND_API_KEY) {
      // Send Email notification to owner if Slack is not configured
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: 'Knowledge Bot <onboarding@resend.dev>',
            to: ownerEmail,
            subject: `New Ticket from ${email}`,
            html: `
              <h2>New Ticket Submission</h2>
              <p><strong>Email:</strong> ${email}</p>
              <p><strong>Page URL:</strong> ${metadata.url}</p>
              <p><strong>Browser/OS:</strong> ${metadata.browser} on ${metadata.os}</p>
              <p><strong>Location:</strong> ${metadata.location}</p>
              <hr/>
              <p><strong>Message:</strong><br/>${prompt}</p>
              <br/>
              <a href="${req.headers.get('origin') || 'https://heyapoyo.com'}/inbox">Reply in Dashboard</a>
            `
          })
        });
      } catch (emailErr) {
        console.error("Failed to send email", emailErr);
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
