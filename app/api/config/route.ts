import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    // Basic Authentication Check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Extract all configurations including new branding & prompt fields
    const { 
      spaceId, 
      systemPrompt, 
      userId, 
      apiKey, 
      primaryColor, 
      headerText, 
      welcomeMessage, 
      botAvatar,
      showPrompts,
      suggestedPrompts
    } = await req.json();

    // Validate that all required fields are present
    if (!spaceId || !systemPrompt || !userId) {
      return NextResponse.json(
        { error: 'Space ID, System Prompt, and User ID are required.' }, 
        { status: 400 }
      );
    }

    // Ensure the authenticated user is only editing their own data
    if (user.id !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Update the bot configuration and link it to the authenticated user.
    const { error } = await supabase
      .from('bot_config')
      .upsert(
        { 
          space_id: spaceId, 
          system_prompt: systemPrompt, 
          user_id: userId,
          api_key: apiKey || null,
          primary_color: primaryColor || '#000000',
          header_text: headerText || 'Documentation Bot',
          welcome_message: welcomeMessage || 'How can I help you today?',
          bot_avatar: botAvatar || null,
          show_prompts: showPrompts !== undefined ? showPrompts : true,
          suggested_prompts: suggestedPrompts || []
        }, 
        { onConflict: 'user_id' }
      );

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
