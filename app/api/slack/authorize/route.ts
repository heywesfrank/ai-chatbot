// app/api/slack/authorize/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const spaceId = searchParams.get('spaceId');

  if (!spaceId) {
    return new NextResponse('Missing spaceId', { status: 400 });
  }

  // Generate a random CSRF nonce
  const nonce = crypto.randomUUID();
  const state = `${spaceId}::${nonce}`;

  const clientId = process.env.NEXT_PUBLIC_SLACK_CLIENT_ID;
  const slackAuthUrl = `https://slack.com/oauth/v2/authorize?client_id=${clientId}&scope=chat:write,incoming-webhook,channels:history,groups:history&state=${state}`;

  const response = NextResponse.redirect(slackAuthUrl);
  
  // Store nonce in HttpOnly cookie to verify upon callback
  response.cookies.set('slack_oauth_state', nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 3600 // 1 hour
  });

  return response;
}
