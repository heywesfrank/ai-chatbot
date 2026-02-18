// lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

// These environment variables will be set in your Vercel dashboard
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// We use the Service Role Key here because this will only be used in secure 
// backend routes (/api/) to bypass Row Level Security during MVP development.
export const supabase = createClient(supabaseUrl, supabaseServiceKey);
