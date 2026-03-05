// app/api/slack/oauth/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  if (!code || !state) return NextResponse.redirect(new URL('/integrations?error=invalid_slack_oauth', req.url));

  // Extract spaceId and nonce from state, then CSRF Check
  const [spaceId, nonce] = state.split('::');
  const storedNonce = req.cookies.get('slack_oauth_state')?.value;

  if (!nonce || !storedNonce || nonce !== storedNonce) {
    return NextResponse.redirect(new URL('/integrations?error=csrf_failed', req.url));
  }

  try {
    const formData = new URLSearchParams({ 
      code, 
      client_id: process.env.NEXT_PUBLIC_SLACK_CLIENT_ID!, 
      client_secret: process.env.SLACK_CLIENT_SECRET! 
    });
    
    const res = await fetch('https://slack.com/api/oauth.v2.access', { 
      method: 'POST', 
      body: formData, 
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' } 
    });
    const data = await res.json();

    if (!data.ok) return NextResponse.redirect(new URL('/integrations?error=slack_auth_failed', req.url));

    await supabase.from('workspace_integrations').upsert({
      space_id: spaceId,
      provider: 'slack',
      config: { slack_bot_token: data.access_token, slack_channel_id: data.incoming_webhook?.channel_id }
    }, { onConflict: 'space_id, provider' });

    const redirectRes = NextResponse.redirect(new URL('/integrations?slack=success', req.url));
    
    // Clean up CSRF cookie
    redirectRes.cookies.delete('slack_oauth_state');
    return redirectRes;
  } catch (err) {
    return NextResponse.redirect(new URL('/integrations?error=slack_auth_failed', req.url));
  }
}
