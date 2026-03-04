// app/api/data-sources/route.ts
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(req: Request) {
  const authHeader = req.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '') || '';
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Resolve spaceId for Owners or Agents
  let spaceId = null;
  const { data: config } = await supabase.from('bot_config').select('space_id').eq('user_id', user.id).maybeSingle();
  if (config?.space_id) {
     spaceId = config.space_id;
  } else if (user.email) {
     const { data: member } = await supabase.from('team_members').select('space_id').eq('email', user.email).maybeSingle();
     if (member?.space_id) spaceId = member.space_id;
  }

  if (!spaceId) return NextResponse.json({ sources: [] });

  const { data } = await supabase.from('data_sources').select('*').eq('space_id', spaceId).order('created_at', { ascending: false });
  return NextResponse.json({ sources: data || [] });
}

export async function POST(req: Request) {
  const authHeader = req.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '') || '';
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();

  // Enforce Ownership Verification (IDOR Fix)
  let hasAccess = false;
  const { data: config } = await supabase.from('bot_config').select('space_id').eq('user_id', user.id).maybeSingle();
  if (config?.space_id === body.spaceId) hasAccess = true;
  else if (user.email) {
    const { data: member } = await supabase.from('team_members').select('space_id').eq('email', user.email).maybeSingle();
    if (member?.space_id === body.spaceId) hasAccess = true;
  }
  if (!hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // Prevent Duplicate sources
  const { count } = await supabase
    .from('data_sources')
    .select('*', { count: 'exact', head: true })
    .eq('space_id', body.spaceId)
    .eq('source_uri', body.sourceUri);

  if (count && count > 0) {
    return NextResponse.json({ error: 'This data source has already been added.' }, { status: 400 });
  }

  const { data, error } = await supabase.from('data_sources').insert({
    space_id: body.spaceId,
    type: body.type,
    source_uri: body.sourceUri,
    credentials: body.credentials,
    status: 'active'
  }).select('id').single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, id: data.id });
}

export async function DELETE(req: Request) {
  const authHeader = req.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '') || '';
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const { data: source } = await supabase.from('data_sources').select('space_id').eq('id', id).maybeSingle();
  if (!source) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Enforce Ownership Verification (IDOR Fix)
  let hasAccess = false;
  const { data: config } = await supabase.from('bot_config').select('space_id').eq('user_id', user.id).maybeSingle();
  if (config?.space_id === source.space_id) hasAccess = true;
  else if (user.email) {
    const { data: member } = await supabase.from('team_members').select('space_id').eq('email', user.email).maybeSingle();
    if (member?.space_id === source.space_id) hasAccess = true;
  }
  if (!hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // 1. Manually delete chunks to be safe
  await supabase.from('knowledge_documents').delete().eq('data_source_id', id).eq('space_id', source.space_id);

  // 2. Delete the actual source
  const { error } = await supabase.from('data_sources').delete().eq('id', id).eq('space_id', source.space_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
