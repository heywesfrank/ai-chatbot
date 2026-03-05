// app/api/notion/oauth/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  if (error) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/knowledge?error=${error}`);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/knowledge?error=missing_params`);
  }

  // Split out the spaceId and CSRF nonce
  const [prefixedSpaceId, nonce] = state.split('::');
  const spaceId = prefixedSpaceId ? prefixedSpaceId.replace(/^kb_/, '') : null;
  const storedNonce = req.cookies.get('notion_oauth_state')?.value;

  // Validate CSRF state
  if (!nonce || !storedNonce || nonce !== storedNonce) {
    console.error('CSRF validation failed for Notion OAuth');
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/knowledge?error=csrf_failed`);
  }

  try {
    // 1. Exchange code for access_token
    const encoded = Buffer.from(`${process.env.NEXT_PUBLIC_NOTION_CLIENT_ID}:${process.env.NOTION_CLIENT_SECRET}`).toString('base64');
    
    const tokenRes = await fetch('https://api.notion.com/v1/oauth/token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Basic ${encoded}`,
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/notion/oauth`,
      }),
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok) {
      console.error('Notion OAuth Error:', tokenData);
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/knowledge?error=notion_auth_failed`);
    }

    // 2. Insert into data_sources
    const { data: sourceData, error: dbError } = await supabase
      .from('data_sources')
      .insert({
        space_id: spaceId,
        type: 'notion',
        source_uri: `Notion Workspace: ${tokenData.workspace_name || 'Connected'}`,
        credentials: { 
          access_token: tokenData.access_token,
          bot_id: tokenData.bot_id,
          workspace_id: tokenData.workspace_id,
          owner: tokenData.owner 
        },
        status: 'active' // Ready to sync
      })
      .select()
      .single();

    if (dbError) {
      console.error('DB Insert Error:', dbError);
      return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/knowledge?error=db_insert_failed`);
    }

    // 3. Redirect back to Knowledge page with the new ID to trigger client-side sync
    const redirectResponse = NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/knowledge?new_source_id=${sourceData.id}`);
    
    // Clean up CSRF cookie
    redirectResponse.cookies.delete('notion_oauth_state');
    return redirectResponse;

  } catch (err) {
    console.error('Notion OAuth Route Exception:', err);
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/knowledge?error=server_error`);
  }
}
