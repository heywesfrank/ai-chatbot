// app/api/faq/route.ts
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { question, answer } = await req.json();
    if (!question || !answer) return NextResponse.json({ error: 'Missing question or answer' }, { status: 400 });

    let configData = null;
    const { data: ownConfig } = await supabase.from('bot_config').select('space_id, faq_overrides').eq('user_id', user.id).maybeSingle();
    if (ownConfig) configData = ownConfig;
    else if (user.email) {
       const { data: member } = await supabase.from('team_members').select('space_id').eq('email', user.email).maybeSingle();
       if (member?.space_id) {
          const { data: teamConfig } = await supabase.from('bot_config').select('space_id, faq_overrides').eq('space_id', member.space_id).maybeSingle();
          configData = teamConfig;
       }
    }

    if (!configData) return NextResponse.json({ error: 'Configuration not found' }, { status: 404 });

    const newFaqs = [...(configData.faq_overrides || []), { question, answer }];

    const { error } = await supabase.from('bot_config').update({ faq_overrides: newFaqs }).eq('space_id', configData.space_id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("FAQ API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
