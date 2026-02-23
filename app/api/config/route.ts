// app/api/config/route.ts
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();

    if (!body.spaceId || !body.systemPrompt || !body.userId) {
      return NextResponse.json({ error: 'Space ID, System Prompt, and User ID are required.' }, { status: 400 });
    }

    if (user.id !== body.userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Only update the keys provided in the payload to avoid wiping out Inbox settings
    const updatePayload: any = {
      space_id: body.spaceId,
      system_prompt: body.systemPrompt,
      user_id: body.userId,
    };

    if (body.apiKey !== undefined) updatePayload.api_key = body.apiKey || null;
    if (body.primaryColor !== undefined) updatePayload.primary_color = body.primaryColor || '#000000';
    if (body.headerText !== undefined) updatePayload.header_text = body.headerText || 'Documentation Bot';
    if (body.welcomeMessage !== undefined) updatePayload.welcome_message = body.welcomeMessage || 'How can I help you today?';
    if (body.botAvatar !== undefined) updatePayload.bot_avatar = body.botAvatar || null;
    if (body.showPrompts !== undefined) updatePayload.show_prompts = body.showPrompts;
    if (body.suggestedPrompts !== undefined) updatePayload.suggested_prompts = body.suggestedPrompts;
    if (body.leadCaptureEnabled !== undefined) updatePayload.lead_capture_enabled = body.leadCaptureEnabled;
    if (body.slackBotToken !== undefined) updatePayload.slack_bot_token = body.slackBotToken || null;
    if (body.slackChannelId !== undefined) updatePayload.slack_channel_id = body.slackChannelId || null;

    const { error } = await supabase.from('bot_config').upsert(updatePayload, { onConflict: 'user_id' });

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[CONFIG_API] Error updating persona:", error);
    return NextResponse.json(
      { error: error.message || 'Failed to update configuration' }, 
      { status: 500 }
    );
  }
}
