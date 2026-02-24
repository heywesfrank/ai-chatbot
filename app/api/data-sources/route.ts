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

  // Prevent Duplicate sources
  const { count } = await supabase
    .from('data_sources')
    .select('*', { count: 'exact', head: true })
    .eq('space_id', body.spaceId)
    .eq('source_uri', body.sourceUri);

  if (count && count > 0) {
    return NextResponse.json({ error: 'This data source has already been added.' }, { status: 400 });
  }

  const { error } = await supabase.from('data_sources').insert({
    space_id: body.spaceId,
    type: body.type,
    source_uri: body.sourceUri,
    credentials: body.credentials
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(req: Request) {
  const authHeader = req.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '') || '';
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  // Get the source details before deleting
  const { data: source } = await supabase.from('data_sources').select('*').eq('id', id).single();
  
  if (source) {
    // 1. Delete the data source entry
    await supabase.from('data_sources').delete().eq('id', id);

    // 2. Best-effort cleanup of associated chunks from the DB
    let urlPattern = `${source.source_uri}%`;
    if (source.type === 'gitbook') urlPattern = `https://app.gitbook.com/s/${source.source_uri}%`;
    else if (source.type === 'notion') urlPattern = `notion://${source.source_uri}%`;
    
    await supabase
      .from('knowledge_documents')
      .delete()
      .eq('space_id', source.space_id)
      .ilike('page_url', urlPattern);
  }

  return NextResponse.json({ success: true });
}
