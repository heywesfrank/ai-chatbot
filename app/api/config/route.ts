import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const { spaceId, systemPrompt } = await req.json();

    if (!spaceId || !systemPrompt) {
      return NextResponse.json({ error: 'Space ID and System Prompt are required.' }, { status: 400 });
    }

    // Only update the persona/config. No vector embeddings here!
    const { error } = await supabase
      .from('bot_config')
      .upsert({ space_id: spaceId, system_prompt: systemPrompt }, { onConflict: 'space_id' });

    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
