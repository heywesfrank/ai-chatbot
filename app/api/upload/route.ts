// app/api/upload/route.ts
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

export const runtime = 'edge';

export async function OPTIONS(req: Request) {
  const origin = req.headers.get('origin') || '*';
  return NextResponse.json({}, {
    headers: {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

export async function POST(req: Request) {
  const origin = req.headers.get('origin') || '*';
  const corsHeaders = { 'Access-Control-Allow-Origin': origin };

  try {
    // 1. IP Rate Limiting (Protects against Denial of Wallet)
    if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
      try {
        const redis = new Redis({
          url: process.env.UPSTASH_REDIS_REST_URL,
          token: process.env.UPSTASH_REDIS_REST_TOKEN,
        });
        const ratelimit = new Ratelimit({
          redis,
          limiter: Ratelimit.slidingWindow(5, '1 m'), // Max 5 uploads per minute per IP
        });
        const ip = req.headers.get('x-real-ip') || req.headers.get('x-vercel-forwarded-for') || 'anonymous';
        const { success } = await ratelimit.limit(`rl_upload_${ip}`);

        if (!success) {
          return NextResponse.json({ error: 'Too many uploads. Please try again later.' }, { status: 429, headers: corsHeaders });
        }
      } catch (err) {
        console.error("Rate limiting failure:", err);
      }
    }

    // 2. Parse Multipart Form Data
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const sessionId = formData.get('sessionId') as string;

    if (!file || !sessionId) {
      return NextResponse.json({ error: 'Missing file or sessionId' }, { status: 400, headers: corsHeaders });
    }

    // 3. Strict Server-Side Validation
    const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File size exceeds the 2MB limit.' }, { status: 400, headers: corsHeaders });
    }

    const allowedTypes = [
      'image/jpeg', 
      'image/png', 
      'image/jpg', 
      'image/gif', 
      'application/pdf', 
      'application/msword', 
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type. Only images, PDF, and DOC are allowed.' }, { status: 400, headers: corsHeaders });
    }

    // Sanitize extension
    const fileExt = file.name.split('.').pop()?.replace(/[^a-zA-Z0-9]/g, '') || 'bin';
    const fileName = `${sessionId}/${Date.now()}.${fileExt}`;

    // 4. Secure Upload via Service Role Key (Bypasses RLS)
    const { error: uploadError } = await supabase.storage
      .from('chat_attachments')
      .upload(fileName, file, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data: publicUrlData } = supabase.storage
      .from('chat_attachments')
      .getPublicUrl(fileName);

    return NextResponse.json({ fileUrl: publicUrlData.publicUrl }, { headers: corsHeaders });
  } catch (error: any) {
    console.error("Upload API Error:", error);
    return NextResponse.json(
      { error: error.message || 'Failed to upload file' },
      { status: 500, headers: corsHeaders }
    );
  }
}
