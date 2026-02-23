// app/api/cron/ai-insights/route.ts
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export const runtime = 'edge';

export async function GET(req: Request) {
  try {
    // Optionally secure your cron by checking Vercel's Cron Secret Header
    const authHeader = req.headers.get('Authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Get all spaces that have active bot configurations
    const { data: spaces } = await supabase.from('bot_config').select('space_id');
    if (!spaces) return NextResponse.json({ success: true, message: "No spaces found" });

    for (const space of spaces) {
      // Fetch up to the 50 most recent failed interactions for this space
      const { data: negativeFeedback } = await supabase
        .from('chat_feedback')
        .select('prompt')
        .eq('space_id', space.space_id)
        .eq('rating', 'down')
        .order('created_at', { ascending: false })
        .limit(50);

      // Only generate insights if there's enough actionable data (e.g., at least 5 failures)
      if (negativeFeedback && negativeFeedback.length >= 5) {
        const prompts = negativeFeedback.map(f => f.prompt).join('\n- ');
        
        const systemInstructions = 'You are an AI analyst. Review the following failed user queries from a documentation chatbot. Categorize the missing knowledge into 2-3 short, actionable bullet points explaining what is missing from the docs. Be extremely concise, minimalist, and direct.';
        
        // Use custom gpt-5-nano endpoint
        const stream = await openai.responses.create({
          model: 'gpt-5-nano',
          instructions: systemInstructions,
          input: [
            { 
              role: 'user', 
              content: `Failed queries:\n- ${prompts}` 
            }
          ],
          stream: true,
        });

        // Accumulate the streaming response
        let insights = '';
        for await (const event of stream) {
          if (event.type === 'response.output_text.delta') {
            insights += event.delta || '';
          }
        }

        // Save the final aggregated insights back to the config
        await supabase
          .from('bot_config')
          .update({ ai_insights: insights.trim() })
          .eq('space_id', space.space_id);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Cron AI Insights Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
