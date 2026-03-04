import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(req: Request) {
  const authHeader = req.headers.get('Authorization');
  const { data: { user } } = await supabase.auth.getUser(authHeader?.replace('Bearer ', '') || '');
  
  if (!user) return NextResponse.json({ faqs: [], spaceId: null }, { status: 401 });

  let spaceId = null;

  // 1. Try to find config where user is owner
  const { data: config } = await supabase.from('bot_config').select('space_id').eq('user_id', user.id).maybeSingle();
  
  if (config) {
    spaceId = config.space_id;
  } else {
    // 2. Fallback: Check if user is a team member
    const { data: member } = await supabase.from('team_members').select('space_id').eq('email', user.email).maybeSingle();
    if (member) spaceId = member.space_id;
  }
  
  if (!spaceId) return NextResponse.json({ faqs: [], spaceId: null });

  const { data } = await supabase.from('faqs').select('*').eq('space_id', spaceId).order('created_at', { ascending: false });
  return NextResponse.json({ faqs: data || [], spaceId });
}

export async function POST(req: Request) {
  const authHeader = req.headers.get('Authorization');
  const { data: { user } } = await supabase.auth.getUser(authHeader?.replace('Bearer ', '') || '');
  
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { spaceId, question, answer } = await req.json();

  // Verify access to spaceId before inserting
  let hasAccess = false;
  const { data: config } = await supabase.from('bot_config').select('space_id').eq('user_id', user.id).maybeSingle();
  
  if (config && config.space_id === spaceId) {
    hasAccess = true;
  } else {
    const { data: member } = await supabase.from('team_members').select('space_id').eq('email', user.email).maybeSingle();
    if (member && member.space_id === spaceId) hasAccess = true;
  }

  if (!hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  await supabase.from('faqs').insert({ space_id: spaceId, question, answer });
  return NextResponse.json({ success: true });
}

export async function DELETE(req: Request) {
  const authHeader = req.headers.get('Authorization');
  const { data: { user } } = await supabase.auth.getUser(authHeader?.replace('Bearer ', '') || '');
  
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

  // Fetch FAQ to get its space_id
  const { data: faq } = await supabase.from('faqs').select('space_id').eq('id', id).single();
  if (!faq) return NextResponse.json({ error: 'FAQ not found' }, { status: 404 });

  // Verify access to spaceId before deleting
  let hasAccess = false;
  const { data: config } = await supabase.from('bot_config').select('space_id').eq('user_id', user.id).maybeSingle();
  
  if (config && config.space_id === faq.space_id) {
    hasAccess = true;
  } else {
    const { data: member } = await supabase.from('team_members').select('space_id').eq('email', user.email).maybeSingle();
    if (member && member.space_id === faq.space_id) hasAccess = true;
  }

  if (!hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  await supabase.from('faqs').delete().eq('id', id);
  return NextResponse.json({ success: true });
}
