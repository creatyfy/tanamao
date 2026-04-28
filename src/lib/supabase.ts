import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || 'https://fgjlyvkdkhxvzsgxuuad.supabase.co').replace(/["']/g, '').trim();
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZnamx5dmtka2h4dnpzZ3h1dWFkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyODg0MDEsImV4cCI6MjA4OTg2NDQwMX0.TLh27Ok-uAlaKihA1_1mE5i4yRIRWYsKcT6o_pu1TyI').replace(/["']/g, '').trim();

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    flowType: 'implicit',
  }
});
