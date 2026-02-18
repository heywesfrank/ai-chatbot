import { NextResponse } from 'next/server';
import OpenAI from 'openai';

// Initialize OpenAI using your secret key from Vercel
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: Request) {
  const { messages } = await req.json();
  const latestMessage = messages[messages.length - 1].text;

  // 1. (Future Step) Search Supabase for the closest matching GitBook paragraphs
  // const context = await searchSupabase(latestMessage);
  const context = "Placeholder text from Supabase: To reset your password, click the settings gear.";

  // 2. Call GPT-5 nano
  const completion = await openai.chat.completions.create({
    model: 'gpt-5-nano',
    messages: [
      { 
        role: 'system', 
        content: `You are a helpful, minimalist support assistant. Answer the user's question using ONLY this context: ${context}` 
      },
      ...messages.map((m: any) => ({ role: m.role, content: m.text }))
    ],
  });

  return NextResponse.json({ reply: completion.choices[0].message.content });
}
