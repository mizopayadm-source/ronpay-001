import { createClient } from '@supabase/supabase-js';

const env = (import.meta as any).env || {};
let supabaseUrl = env.VITE_SUPABASE_URL || 'https://aqrplcmpealgruduwnhw.supabase.co';
let supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || 'sb_publishable__zS5fiKvBI5u6HYgour64g_g_tJj5WL';

export let supabase = createClient(supabaseUrl, supabaseAnonKey);

export const getSupabase = () => supabase;
export const getSupabaseUrl = () => supabaseUrl;
export const getSupabaseAnonKey = () => supabaseAnonKey;
export const isSupabaseConfigured = () => !!supabaseUrl && !!supabaseAnonKey;

export const setSupabaseConfig = (url: string, key: string) => {
  supabaseUrl = url;
  supabaseAnonKey = key;
  supabase = createClient(supabaseUrl, supabaseAnonKey);
};

export const DEFAULT_SUPABASE_URL = 'https://aqrplcmpealgruduwnhw.supabase.co';
export const DEFAULT_SUPABASE_PROJECT_ID = 'aqrplcmpealgruduwnhw';
