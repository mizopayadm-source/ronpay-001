// Central API Endpoint & Base URL Resolver
// Ensures external custom domains (ronpay.app, www.ronpay.app), GitHub Pages, mobile browsers, 
// Android WebViews, and standalone PWAs connect directly to the central backend.

export const CLOUD_BACKEND_URL = 
  (typeof import.meta !== 'undefined' && ((import.meta as any).env?.VITE_API_URL || (import.meta as any).env?.VITE_BACKEND_URL)) ||
  'https://ronpay.app';

export function getApiBaseUrl(): string {
  if (typeof window === 'undefined') return '';
  
  // Custom server override from localStorage (e.g. if configured by admin for self-hosted instance)
  try {
    const customUrl = localStorage.getItem('ronpay_server_url') || localStorage.getItem('ronpay_backend_url');
    if (customUrl && customUrl.startsWith('http')) {
      return customUrl.replace(/\/+$/, '');
    }
  } catch {}

  const protocol = (window.location.protocol || '').toLowerCase();
  const hostname = (window.location.hostname || '').toLowerCase();

  // If statically hosted on GitHub Pages (e.g. username.github.io) where no backend runs:
  // Route to the authoritative central backend so web & mobile sync seamlessly!
  if (hostname.endsWith('github.io')) {
    return CLOUD_BACKEND_URL;
  }

  // 1. Any standard web browser, iframe preview, mobile web browser, or PWA running over http or https:
  // ALWAYS use relative path so API requests hit the exact server hosting the app!
  if (protocol === 'http:' || protocol === 'https:') {
    return '';
  }
  
  // 2. On standalone native hybrid wrappers (e.g. capacitor://, ionic://, file://, content://):
  // route to the production backend server https://ronpay.app
  return CLOUD_BACKEND_URL;
}

export function resolveApiUrl(path: string): string {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  const base = getApiBaseUrl();
  if (!base) return path;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${cleanPath}`;
}

// Global fetch interceptor to guarantee all relative /api/ and /ronpay_db.json requests
// route to the central Cloud Run backend when running on ronpay.app or external hosts
if (typeof window !== 'undefined') {
  try {
    const originalFetch = window.fetch;
    window.fetch = function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
      let resolvedInput = input;
      if (typeof input === 'string') {
        if (input.startsWith('/api/') || input === '/ronpay_db.json' || input.startsWith('/ronpay_db.json')) {
          resolvedInput = resolveApiUrl(input);
        }
      }
      return originalFetch.call(this, resolvedInput, init);
    };
  } catch (err) {
    console.warn('[RonPay] Failed to install global fetch interceptor:', err);
  }
}
