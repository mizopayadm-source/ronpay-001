import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://aqrplcmpealgruduwnhw.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable__zS5fiKvBI5u6HYgour64g_g_tJj5WL';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
