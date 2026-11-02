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

const QUOTA_BLOCKED_KEY = 'ronpay_supabase_quota_blocked_v1';

export const isSupabaseQuotaBlocked = (): boolean => {
  if (typeof window !== 'undefined') {
    if ((window as any).__SUPABASE_QUOTA_EXCEEDED) return true;
    try {
      const blocked = localStorage.getItem(QUOTA_BLOCKED_KEY);
      if (blocked === 'true') {
        (window as any).__SUPABASE_QUOTA_EXCEEDED = true;
        return true;
      }
    } catch {}
  }
  return false;
};

export const markSupabaseQuotaBlocked = (reason: string = 'exceed_egress_quota') => {
  if (typeof window !== 'undefined') {
    (window as any).__SUPABASE_QUOTA_EXCEEDED = true;
    try {
      localStorage.setItem(QUOTA_BLOCKED_KEY, 'true');
    } catch {}
    console.warn(`[Supabase Circuit Breaker Active] Outgoing requests paused to stop egress usage: ${reason}`);
  }
};

export const clearSupabaseQuotaBlocked = () => {
  if (typeof window !== 'undefined') {
    (window as any).__SUPABASE_QUOTA_EXCEEDED = false;
    try {
      localStorage.removeItem(QUOTA_BLOCKED_KEY);
    } catch {}
  }
};

