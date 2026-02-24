import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(req: Request) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: config } = await supabase.from('bot_config').select('space_id').eq('user_id', user.id).single();
  if (!config) return NextResponse.json({ sources: [] });

  const { data } = await supabase.from('data_sources').select('id, type, source_uri, created_at').eq('space_id', config.space_id);
  return NextResponse.json({ sources: data || [] });
}

export async function POST(req: Request) {
  const authHeader = req.headers.get('Authorization');
  const { data: { user } } = await supabase.auth.getUser(authHeader?.replace('Bearer ', '') || '');
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  await supabase.from('data_sources').insert(body);
  return NextResponse.json({ success: true });
}

export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  await supabase.from('data_sources').delete().eq('id', id);
  return NextResponse.json({ success: true });
}
