import { createClient } from '@supabase/supabase-js';

// Dedicated client for frontend use to avoid creating multiple instances
// and strictly using the anon key.
export const supabaseClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);
