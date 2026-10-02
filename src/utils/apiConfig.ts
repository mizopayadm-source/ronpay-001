// Central API Endpoint & Base URL Resolver
// Ensures external custom domains (ronpay.app, www.ronpay.app), mobile browsers, 
// and standalone PWAs connect directly to the central Cloud Run server backend.

export const CLOUD_BACKEND_URL = 'https://ais-pre-y2fdvwg2x6cpi5iequ7ugj-868993197140.asia-southeast1.run.app';

export function getApiBaseUrl(): string {
  if (typeof window === 'undefined') return '';
  const hostname = window.location.hostname;
  
  // If we are already running on Cloud Run or localhost, use relative path
  if (hostname.includes('run.app') || hostname === 'localhost' || hostname === '127.0.0.1') {
    return '';
  }
  
  // On custom domains (ronpay.app), PWAs, mobile browsers, or external hosts, route to central backend
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
