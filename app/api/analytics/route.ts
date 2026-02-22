// app/api/analytics/route.ts
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // 1. Get the user's space_id
    const { data: config } = await supabase
      .from('bot_config')
      .select('space_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!config?.space_id) {
      return NextResponse.json({ feedbacks: [] });
    }

    // 2. Fetch feedback securely bypassing RLS
    const { data: feedbacks, error } = await supabase
      .from('chat_feedback')
      .select('*')
      .eq('space_id', config.space_id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ feedbacks: feedbacks || [] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
