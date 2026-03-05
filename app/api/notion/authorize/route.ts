// app/api/notion/authorize/route.ts
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
  const state = `kb_${spaceId}::${nonce}`;

  const redirectUri = encodeURIComponent(`${process.env.NEXT_PUBLIC_APP_URL}/api/notion/oauth`);
  const clientId = process.env.NEXT_PUBLIC_NOTION_CLIENT_ID;
  
  const notionAuthUrl = `https://api.notion.com/v1/oauth/authorize?client_id=${clientId}&response_type=code&owner=user&redirect_uri=${redirectUri}&state=${state}`;

  const response = NextResponse.redirect(notionAuthUrl);
  
  // Store nonce in HttpOnly cookie to verify upon callback
  response.cookies.set('notion_oauth_state', nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 3600 // 1 hour expiration
  });

  return response;
}
