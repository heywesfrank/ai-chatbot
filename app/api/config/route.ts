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

    // Extract apiKey along with other config
    const { spaceId, systemPrompt, userId, apiKey } = await req.json();

    // Validate that all required fields are present (apiKey is optional for saving just persona, but required for sync)
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
    // We use user_id as the conflict key so it updates the user's SaaS config row
    const { error } = await supabase
      .from('bot_config')
      .upsert(
        { 
          space_id: spaceId, 
          system_prompt: systemPrompt, 
          user_id: userId,
          api_key: apiKey || null // Save the token if provided
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
