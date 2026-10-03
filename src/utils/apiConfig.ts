// Central API Endpoint & Base URL Resolver
// Ensures external custom domains (ronpay.app, www.ronpay.app), mobile browsers, 
// Android WebViews, and standalone PWAs connect directly to the central backend.

export const CLOUD_BACKEND_URL = 'https://ronpay.app';

export function getApiBaseUrl(): string {
  if (typeof window === 'undefined') return '';
  const hostname = (window.location.hostname || '').toLowerCase();
  
  // 1. If running on ronpay.app, www.ronpay.app, Cloud Run (*.run.app), localhost, or 127.0.0.1:
  // Always use relative path so API requests hit the exact same server hosting the app!
  if (
    hostname.includes('ronpay.app') ||
    hostname.includes('run.app') ||
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === ''
  ) {
    return '';
  }
  
  // 2. On standalone native hybrid wrappers (e.g. capacitor://, file://, or external sandboxes),
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
