import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(req: Request) {
  const authHeader = req.headers.get('Authorization');
  const { data: { user } } = await supabase.auth.getUser(authHeader?.replace('Bearer ', '') || '');
  
  const { data: config } = await supabase.from('bot_config').select('space_id').eq('user_id', user?.id).single();
  if (!config) return NextResponse.json({ integrations: [] });

  const { data } = await supabase.from('workspace_integrations').select('*').eq('space_id', config.space_id);
  return NextResponse.json({ integrations: data || [] });
}

export async function POST(req: Request) {
  const body = await req.json();
  await supabase.from('workspace_integrations').upsert({
    space_id: body.spaceId, provider: body.provider, config: body.config
  }, { onConflict: 'space_id, provider' });
  return NextResponse.json({ success: true });
}

export async function DELETE(req: Request) {
  const authHeader = req.headers.get('Authorization');
  const { data: { user } } = await supabase.auth.getUser(authHeader?.replace('Bearer ', '') || '');
  const { data: config } = await supabase.from('bot_config').select('space_id').eq('user_id', user?.id).single();
  
  const provider = new URL(req.url).searchParams.get('provider');
  await supabase.from('workspace_integrations').delete().eq('space_id', config?.space_id).eq('provider', provider);
  return NextResponse.json({ success: true });
}
