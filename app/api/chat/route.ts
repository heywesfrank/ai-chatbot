import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const { message } = await req.json();
  // Logic to search Vector Database and call OpenAI/Gemini goes here.
  return NextResponse.json({ reply: "I found this in the documentation..." });
}
