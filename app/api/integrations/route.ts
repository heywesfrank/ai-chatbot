// app/api/integrations/route.ts
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(req: Request) {
  const authHeader = req.headers.get('Authorization');
  const { data: { user } } = await supabase.auth.getUser(authHeader?.replace('Bearer ', '') || '');
  
  if (!user) return NextResponse.json({ integrations: [] }, { status: 401 });

  const { data: config } = await supabase.from('bot_config').select('space_id').eq('user_id', user.id).single();
  if (!config) return NextResponse.json({ integrations: [] });

  const { data } = await supabase.from('workspace_integrations').select('*').eq('space_id', config.space_id);
  
  // SECURE: Strip out the Slack Bot Token before transmitting to the client
  const safeIntegrations = (data || []).map(integration => {
    const safeConfig = { ...integration.config };
    if (safeConfig.slack_bot_token) {
      delete safeConfig.slack_bot_token;
    }
    return { ...integration, config: safeConfig };
  });

  return NextResponse.json({ integrations: safeIntegrations });
}

export async function POST(req: Request) {
  const authHeader = req.headers.get('Authorization');
  const { data: { user } } = await supabase.auth.getUser(authHeader?.replace('Bearer ', '') || '');
  
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();

  // Verify the user owns the space they are trying to integrate with
  const { data: config } = await supabase.from('bot_config').select('space_id').eq('user_id', user.id).single();
  if (!config || config.space_id !== body.spaceId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await supabase.from('workspace_integrations').upsert({
    space_id: body.spaceId, provider: body.provider, config: body.config
  }, { onConflict: 'space_id, provider' });
  
  return NextResponse.json({ success: true });
}

export async function DELETE(req: Request) {
  const authHeader = req.headers.get('Authorization');
  const { data: { user } } = await supabase.auth.getUser(authHeader?.replace('Bearer ', '') || '');
  
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: config } = await supabase.from('bot_config').select('space_id').eq('user_id', user.id).single();
  
  const provider = new URL(req.url).searchParams.get('provider');
  await supabase.from('workspace_integrations').delete().eq('space_id', config?.space_id).eq('provider', provider);
  
  return NextResponse.json({ success: true });
}
