// app/api/config/route.ts
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    if (!body.spaceId || !body.systemPrompt) return NextResponse.json({ error: 'Space ID and System Prompt are required.' }, { status: 400 });

    const { data: existing } = await supabase.from('bot_config').select('user_id').eq('space_id', body.spaceId).maybeSingle();
    if (existing && existing.user_id !== user.id) return NextResponse.json({ error: 'Forbidden. Space ID already claimed.' }, { status: 403 });

    const updatePayload = {
      space_id: body.spaceId,
      workspace_name: body.workspaceName,
      timezone: body.timezone,           
      system_prompt: body.systemPrompt,
      user_id: user.id,
      primary_color: body.primaryColor ?? '#000000',
      bot_font_color: body.botFontColor ?? '#1f2937',
      user_font_color: body.userFontColor ?? '#ffffff',
      agent_bubble_color: body.agentBubbleColor ?? '#f3f4f6',
      user_bubble_color: body.userBubbleColor ?? '#000000',
      launcher_color: body.launcherColor ?? '#000000',
      launcher_icon_color: body.launcherIconColor ?? '#ffffff',
      header_text: body.headerText ?? 'Documentation Bot',
      description_text: body.descriptionText ?? null,
      welcome_message: body.welcomeMessage ?? 'How can I help you today?',
      input_placeholder: body.inputPlaceholder ?? 'Ask a question...',
      bot_avatar: body.botAvatar ?? null,
      remove_branding: body.removeBranding ?? false,
      show_prompts: body.showPrompts ?? true,
      suggested_prompts: body.suggestedPrompts ?? [],
      follow_up_questions_enabled: body.followUpQuestionsEnabled ?? false,
      lead_capture_enabled: body.leadCaptureEnabled ?? false,
      page_context_enabled: body.pageContextEnabled ?? false,
      tabs_enabled: body.tabsEnabled ?? false,
      routing_config: body.routingConfig ?? [],
      language: body.language ?? 'Auto-detect',
      theme: body.theme ?? 'auto',
      position: body.position ?? 'right',
      allowed_domains: body.allowedDomains ?? null,
      temperature: body.temperature ?? 0.5,
      match_threshold: body.matchThreshold ?? 0.5,
      reasoning_effort: body.reasoningEffort ?? 'medium',
      verbosity: body.verbosity ?? 'medium',
      
      // Page Extensions
      help_search_placeholder: body.helpSearchPlaceholder ?? null,
      help_center_color: body.helpCenterColor ?? '#000000',
      help_center_bg_image: body.helpCenterBgImage ?? null,
      greeting_title: body.greetingTitle ?? null,
      greeting_body: body.greetingBody ?? null,
      home_tab_enabled: body.homeTabEnabled ?? false,
      home_content: body.homeContent ?? null
    };

    const { error } = await supabase.from('bot_config').upsert(updatePayload, { onConflict: 'user_id' });
    if (error) {
      // Gracefully catch unique constraint violations to prevent 500s or DoS behavior
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Space ID is already in use by another workspace. Please generate a new one.' }, { status: 409 });
      }
      throw new Error(error.message);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
