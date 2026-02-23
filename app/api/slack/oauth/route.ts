// app/api/slack/oauth/route.ts
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const runtime = 'edge';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state'); // Passed as the spaceId

  if (!code || !state) {
    return NextResponse.redirect(new URL('/home?error=invalid_slack_oauth', req.url));
  }

  try {
    const formData = new URLSearchParams();
    formData.append('code', code);
    formData.append('client_id', process.env.NEXT_PUBLIC_SLACK_CLIENT_ID!);
    formData.append('client_secret', process.env.SLACK_CLIENT_SECRET!);

    const res = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      body: formData,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    const data = await res.json();

    if (!data.ok) {
      console.error("Slack OAuth Error:", data);
      return NextResponse.redirect(new URL('/home?error=slack_auth_failed', req.url));
    }

    const botToken = data.access_token;
    const channelId = data.incoming_webhook?.channel_id;

    if (botToken && channelId) {
      await supabase
        .from('bot_config')
        .update({ slack_bot_token: botToken, slack_channel_id: channelId })
        .eq('space_id', state);
    }

    return NextResponse.redirect(new URL('/home?slack=success', req.url));
  } catch (err) {
    return NextResponse.redirect(new URL('/home?error=slack_auth_failed', req.url));
  }
}
