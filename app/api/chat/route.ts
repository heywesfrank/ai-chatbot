import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { supabase } from '@/lib/supabase';

// Initialize OpenAI using your secret key from Vercel
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// 1. Add an OPTIONS handler to manage CORS preflight requests
export async function OPTIONS() {
  return NextResponse.json(
    {},
    {
      headers: {
        'Access-Control-Allow-Origin': '*', // Allows requests from any origin
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    }
  );
}

export async function POST(req: Request) {
  try {
    // 1. Destructure messages and spaceId from the request
    const { messages, spaceId } = await req.json();
    const latestMessage = messages[messages.length - 1].text;

    // 2. Turn the user's question into a vector embedding
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: latestMessage,
    });
    const queryEmbedding = embeddingResponse.data[0].embedding;

    // 3. Search Supabase for the top 5 matching GitBook paragraphs
    const { data: documents, error: supabaseError } = await supabase.rpc('match_documents', {
      query_embedding: queryEmbedding,
      match_threshold: 0.3, 
      match_count: 5,       
      p_space_id: spaceId 
    });

    if (supabaseError) {
      console.error("Supabase Search Error:", supabaseError);
    }

    // 4. Fetch the custom Persona prompt for this space from Supabase
    const { data: configData, error: configError } = await supabase
      .from('bot_config')
      .select('system_prompt')
      .eq('space_id', spaceId)
      .single();
      
    const agentPersona = configData?.system_prompt || "You are a helpful, minimalist support assistant.";

    // 5. Combine the retrieved paragraphs into one string of context
    // If empty, leave it explicitly empty to trigger the fallback instructions
    const context = documents && documents.length > 0 
      ? documents.map((doc: any) => doc.content).join('\n\n') 
      : "";

    // 6. Assemble the final instructions strictly separating persona and context rules
    const systemInstructions = `${agentPersona}

Answer the user's question using ONLY the provided context below. 
If the context is empty or does not contain the answer, politely inform the user that you don't have that information in your documentation and ask if there's anything else you can assist them with. Do not hallucinate answers.

CONTEXT:
${context || "No context available."}`;

    // 7. Call GPT-5 Nano using the new Responses API
    const response = await openai.responses.create({
      model: 'gpt-5-nano',
      instructions: systemInstructions,
      input: messages.map((m: any) => ({ 
        role: m.role, 
        content: m.text 
      })),
    });

    // 8. Return the text using the new SDK helper with CORS headers
    return NextResponse.json(
      { reply: response.output_text },
      {
        headers: {
          'Access-Control-Allow-Origin': '*', // Required for the browser to accept the response
        },
      }
    );
  } catch (error: any) {
    console.error("Chat API Error:", error);
    return NextResponse.json(
      { error: error.message || 'Chat failed' },
      { 
        status: 500,
        headers: { 'Access-Control-Allow-Origin': '*' }
      }
    );
  }
}
