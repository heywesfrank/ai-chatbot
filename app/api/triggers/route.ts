// app/api/triggers/route.ts
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(req: Request) {
  const authHeader = req.headers.get('Authorization');
  const { data: { user } } = await supabase.auth.getUser(authHeader?.replace('Bearer ', '') || '');
  const { data: config } = await supabase.from('bot_config').select('space_id').eq('user_id', user?.id).single();
  
  if (!config) return NextResponse.json({ triggers: [], spaceId: null });
  const { data } = await supabase.from('proactive_triggers').select('*').eq('space_id', config.space_id).order('created_at', { ascending: false });
  return NextResponse.json({ triggers: data || [], spaceId: config.space_id });
}

export async function POST(req: Request) {
  const { spaceId, urlMatch, delaySeconds, message } = await req.json();
  await supabase.from('proactive_triggers').insert({ space_id: spaceId, url_match: urlMatch, delay_seconds: delaySeconds, message });
  return NextResponse.json({ success: true });
}

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get('id');
  await supabase.from('proactive_triggers').delete().eq('id', id);
  return NextResponse.json({ success: true });
}
