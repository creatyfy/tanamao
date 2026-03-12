import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mtruhprjiwfcdtdkjqus.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10cnVocHJqaXdmY2R0ZGtqcXVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNDg0NjcsImV4cCI6MjA4ODgyNDQ2N30.X2LsJQvSop5-HQyoD_Jlxw5rmMh0g2cPLbnaiSrZJmI';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
