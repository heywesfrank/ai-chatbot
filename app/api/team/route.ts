// app/api/team/route.ts
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const url = new URL(req.url);
    const spaceId = url.searchParams.get('spaceId');
    if (!spaceId) return NextResponse.json({ error: 'Space ID missing' }, { status: 400 });

    const { data: config } = await supabase.from('bot_config').select('user_id').eq('space_id', spaceId).maybeSingle();
    if (!config) return NextResponse.json({ error: 'Space not found' }, { status: 404 });
    
    if (config.user_id !== user.id) {
       const { data: member } = await supabase.from('team_members').select('*').eq('space_id', spaceId).eq('email', user.email).maybeSingle();
       if (!member) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data: members } = await supabase.from('team_members').select('*').eq('space_id', spaceId);
    return NextResponse.json({ members: members || [] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { spaceId, email, role = 'agent' } = await req.json();
    if (!spaceId || !email) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

    const { data: config } = await supabase.from('bot_config').select('user_id').eq('space_id', spaceId).maybeSingle();
    if (config?.user_id !== user.id) return NextResponse.json({ error: 'Forbidden. Only the owner can manage team members.' }, { status: 403 });

    const { error } = await supabase.from('team_members').insert({ space_id: spaceId, email, role });
    if (error) throw error;
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id, spaceId } = await req.json();
    if (!id || !spaceId) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

    const { data: config } = await supabase.from('bot_config').select('user_id').eq('space_id', spaceId).maybeSingle();
    if (config?.user_id !== user.id) return NextResponse.json({ error: 'Forbidden. Only the owner can manage team members.' }, { status: 403 });

    const { error } = await supabase.from('team_members').delete().eq('id', id).eq('space_id', spaceId);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
