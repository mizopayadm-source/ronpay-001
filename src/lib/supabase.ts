import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Default Supabase project reference from user's dashboard (aqrplcmpealgruduwnhw)
export const DEFAULT_SUPABASE_PROJECT_ID = 'aqrplcmpealgruduwnhw';
export const DEFAULT_SUPABASE_URL = `https://${DEFAULT_SUPABASE_PROJECT_ID}.supabase.co`;

const STORAGE_KEY_URL = 'ronpay_supabase_url';
const STORAGE_KEY_ANON_KEY = 'ronpay_supabase_anon_key';

let cachedClient: SupabaseClient | null = null;
let lastUrl: string = '';
let lastKey: string = '';

/**
 * Retrieves the currently configured Supabase Project URL
 */
export function getSupabaseUrl(): string {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(STORAGE_KEY_URL);
    if (saved && saved.trim()) return saved.trim();
  }
  const envUrl = (import.meta as any).env?.VITE_SUPABASE_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim()) {
    return envUrl.trim();
  }
  return DEFAULT_SUPABASE_URL;
}

/**
 * Retrieves the currently configured Supabase Anon Key
 */
export function getSupabaseAnonKey(): string {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(STORAGE_KEY_ANON_KEY);
    if (saved && saved.trim()) return saved.trim();
  }
  const envKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY;
  if (envKey && typeof envKey === 'string' && envKey.trim()) {
    return envKey.trim();
  }
  return '';
}

// Automatically bootstrap remote server Supabase config on startup
if (typeof window !== 'undefined') {
  fetch('/api/supabase/config')
    .then(r => r.json())
    .then(data => {
      if (data && data.anonKey && !localStorage.getItem(STORAGE_KEY_ANON_KEY)) {
        localStorage.setItem(STORAGE_KEY_ANON_KEY, data.anonKey);
        if (data.url) localStorage.setItem(STORAGE_KEY_URL, data.url);
        cachedClient = null;
      }
    })
    .catch(() => {});
}

/**
 * Persists Supabase credentials to localStorage and server for universal runtime configuration
 */
export function setSupabaseConfig(url?: string, anonKey?: string): void {
  if (typeof window === 'undefined') return;
  const finalUrl = url !== undefined ? url.trim() : getSupabaseUrl();
  const finalKey = anonKey !== undefined ? anonKey.trim() : getSupabaseAnonKey();

  if (url !== undefined) {
    if (url.trim()) {
      localStorage.setItem(STORAGE_KEY_URL, url.trim());
    } else {
      localStorage.removeItem(STORAGE_KEY_URL);
    }
  }
  if (anonKey !== undefined) {
    if (anonKey.trim()) {
      localStorage.setItem(STORAGE_KEY_ANON_KEY, anonKey.trim());
    } else {
      localStorage.removeItem(STORAGE_KEY_ANON_KEY);
    }
  }

  // Persist to server backend so all mobile users and donors auto-inherit the key
  fetch('/api/supabase/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: finalUrl, anonKey: finalKey })
  }).catch(() => {});

  // Invalidate cached client
  cachedClient = null;
  lastUrl = '';
  lastKey = '';
}

/**
 * Returns true if Supabase URL and Anon Key are configured
 */
export function isSupabaseConfigured(): boolean {
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();
  return Boolean(url && key && key.length >= 10);
}

/**
 * Returns the PostgREST Supabase client singleton, or null if not yet configured
 */
export function getSupabase(): SupabaseClient | null {
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();

  if (!url || !key) {
    return null;
  }

  if (cachedClient && lastUrl === url && lastKey === key) {
    return cachedClient;
  }

  try {
    cachedClient = createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
      db: {
        schema: 'public',
      },
    });
    lastUrl = url;
    lastKey = key;
    return cachedClient;
  } catch (err) {
    console.error('[SupabaseClient] Initialization failed:', err);
    return null;
  }
}
