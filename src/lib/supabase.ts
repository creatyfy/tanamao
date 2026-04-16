import { createClient } from '@supabase/supabase-js';

// Remove aspas extras e espaços caso o Vite as tenha injetado a partir do .env
const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || 'https://ymeyfhqietbznqslhjbh.supabase.co').replace(/["']/g, '').trim();
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').replace(/["']/g, '').trim();

if (!supabaseAnonKey.startsWith('eyJ')) {
  console.error('CRITICAL: Invalid Supabase Anon Key. The key must be a JWT starting with "eyJ". You are currently using a Stripe key or an empty string.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  }
});
