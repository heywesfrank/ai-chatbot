import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const runtime = 'edge';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const spaceId = url.searchParams.get('state');

  if (!code || !spaceId) return NextResponse.redirect(new URL('/home?error=invalid_slack_oauth', req.url));

  try {
    const formData = new URLSearchParams({ code, client_id: process.env.NEXT_PUBLIC_SLACK_CLIENT_ID!, client_secret: process.env.SLACK_CLIENT_SECRET! });
    const res = await fetch('https://slack.com/api/oauth.v2.access', { method: 'POST', body: formData, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
    const data = await res.json();

    if (!data.ok) return NextResponse.redirect(new URL('/home?error=slack_auth_failed', req.url));

    await supabase.from('workspace_integrations').upsert({
      space_id: spaceId,
      provider: 'slack',
      config: { slack_bot_token: data.access_token, slack_channel_id: data.incoming_webhook?.channel_id }
    }, { onConflict: 'space_id, provider' });

    return NextResponse.redirect(new URL('/home?slack=success', req.url));
  } catch (err) {
    return NextResponse.redirect(new URL('/home?error=slack_auth_failed', req.url));
  }
}
