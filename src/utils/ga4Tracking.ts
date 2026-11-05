import { resolveApiUrl } from './apiConfig';

function getOrCreateVisitorId(): string {
  if (typeof window === 'undefined') return 'anon';
  try {
    let vid = localStorage.getItem('ronpay_visitor_id_v1');
    if (!vid) {
      vid = 'vis-' + Math.random().toString(36).substring(2, 10) + '-' + Date.now().toString(36);
      localStorage.setItem('ronpay_visitor_id_v1', vid);
    }
    return vid;
  } catch {
    return 'anon-' + Date.now();
  }
}

/**
 * Safely tracks GA4 page views and custom events for React SPA page transitions
 */
export function trackGA4PageView(pagePath: string, pageTitle?: string) {
  if (typeof window === 'undefined') return;
  const title = pageTitle || document.title || 'RonPay App';
  const visitorId = getOrCreateVisitorId();

  // 1. Google Analytics Client Tag
  try {
    const gtag = (window as any).gtag;
    if (typeof gtag === 'function') {
      const measurementId = localStorage.getItem('ronpay_ga_measurement_id') || 'G-P29J9QMYK6';
      gtag('config', measurementId, {
        page_path: pagePath,
        page_title: title,
        page_location: window.location.href,
        user_id: visitorId,
      });
      gtag('event', 'page_view', {
        page_path: pagePath,
        page_title: title,
        page_location: window.location.href,
        user_id: visitorId,
        send_to: measurementId,
      });
    }
  } catch {
    // Silently ignore if blocked by adblocker
  }

  // 2. Direct First-Party Backend Beacon Hit (Bypasses Adblockers & guarantees real-time stats)
  try {
    const endpoint = resolveApiUrl('/api/analytics/hit');
    const payload = JSON.stringify({ path: pagePath, title, visitorId });
    if (navigator.sendBeacon) {
      const blob = new Blob([payload], { type: 'application/json' });
      navigator.sendBeacon(endpoint, blob);
    } else {
      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    // Silently continue
  }
}

export function trackGA4Event(eventName: string, params?: Record<string, any>) {
  if (typeof window === 'undefined') return;
  try {
    const gtag = (window as any).gtag;
    if (typeof gtag === 'function') {
      gtag('event', eventName, params || {});
    }
  } catch {
    // Silently ignore
  }
}
