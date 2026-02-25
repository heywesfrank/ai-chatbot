import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(req: Request) {
  const authHeader = req.headers.get('Authorization');
  const { data: { user } } = await supabase.auth.getUser(authHeader?.replace('Bearer ', '') || '');
  
  if (!user) return NextResponse.json({ faqs: [], spaceId: null });

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
  const { spaceId, question, answer } = await req.json();
  await supabase.from('faqs').insert({ space_id: spaceId, question, answer });
  return NextResponse.json({ success: true });
}

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get('id');
  await supabase.from('faqs').delete().eq('id', id);
  return NextResponse.json({ success: true });
}
