// app/api/export/route.ts
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return new NextResponse('Unauthorized', { status: 401 });
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return new NextResponse('Unauthorized', { status: 401 });

    let spaceId = null;
    const { data: config } = await supabase.from('bot_config').select('space_id').eq('user_id', user.id).maybeSingle();
    if (config?.space_id) {
       spaceId = config.space_id;
    } else if (user.email) {
       const { data: member } = await supabase.from('team_members').select('space_id').eq('email', user.email).maybeSingle();
       if (member?.space_id) spaceId = member.space_id;
    }

    if (!spaceId) return new NextResponse('No config found', { status: 400 });

    const url = new URL(req.url);
    const type = url.searchParams.get('type');
    let csvStr = "";

    if (type === 'leads') {
      const { data } = await supabase.from('leads').select('*').eq('space_id', spaceId).order('created_at', { ascending: false });
      csvStr = "Date,Name,Email\n";
      data?.forEach(r => {
        csvStr += `"${new Date(r.created_at).toISOString()}","${r.name?.replace(/"/g, '""')}","${r.email?.replace(/"/g, '""')}"\n`;
      });
    } else if (type === 'chats') {
      const { data } = await supabase.from('chat_feedback').select('*').eq('space_id', spaceId).order('created_at', { ascending: false });
      csvStr = "Date,Rating,User Prompt,Bot Response\n";
      data?.forEach(r => {
        csvStr += `"${new Date(r.created_at).toISOString()}","${r.rating}","${r.prompt?.replace(/"/g, '""')}","${r.response?.replace(/"/g, '""')}"\n`;
      });
    }

    return new NextResponse(csvStr, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${type}-export.csv"`
      }
    });
  } catch (error: any) {
    return new NextResponse('Internal Error', { status: 500 });
  }
}
