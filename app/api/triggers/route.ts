// app/api/triggers/route.ts
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(req: Request) {
  const authHeader = req.headers.get('Authorization');
  const { data: { user } } = await supabase.auth.getUser(authHeader?.replace('Bearer ', '') || '');
  
  if (!user) return NextResponse.json({ triggers: [], spaceId: null });

  let spaceId = null;

  // 1. Check if the user is the owner of a workspace
  const { data: config } = await supabase.from('bot_config').select('space_id').eq('user_id', user.id).maybeSingle();
  
  if (config) {
    spaceId = config.space_id;
  } else {
    // 2. Check if the user is a team member (agent)
    const { data: member } = await supabase.from('team_members').select('space_id').eq('email', user.email).maybeSingle();
    if (member) spaceId = member.space_id;
  }

  if (!spaceId) return NextResponse.json({ triggers: [], spaceId: null });

  const { data } = await supabase.from('proactive_triggers').select('*').eq('space_id', spaceId).order('created_at', { ascending: false });
  return NextResponse.json({ triggers: data || [], spaceId });
}

export async function POST(req: Request) {
  const authHeader = req.headers.get('Authorization');
  const { data: { user } } = await supabase.auth.getUser(authHeader?.replace('Bearer ', '') || '');
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { spaceId, urlMatch, delaySeconds, message } = await req.json();
  
  // Verify that the user owns the space before inserting
  const { data: config } = await supabase.from('bot_config').select('user_id').eq('space_id', spaceId).maybeSingle();
  if (config?.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await supabase.from('proactive_triggers').insert({ space_id: spaceId, url_match: urlMatch, delay_seconds: delaySeconds, message });
  return NextResponse.json({ success: true });
}

export async function DELETE(req: Request) {
  const authHeader = req.headers.get('Authorization');
  const { data: { user } } = await supabase.auth.getUser(authHeader?.replace('Bearer ', '') || '');
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });
  
  const { data: trigger } = await supabase.from('proactive_triggers').select('space_id').eq('id', id).maybeSingle();
  if (!trigger) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  
  // Verify that the user owns the space before deleting
  const { data: config } = await supabase.from('bot_config').select('user_id').eq('space_id', trigger.space_id).maybeSingle();
  if (config?.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await supabase.from('proactive_triggers').delete().eq('id', id);
  return NextResponse.json({ success: true });
}
