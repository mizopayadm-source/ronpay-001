/**
 * Safely tracks GA4 page views and custom events for React SPA page transitions
 */
export function trackGA4PageView(pagePath: string, pageTitle?: string) {
  if (typeof window === 'undefined') return;
  try {
    const gtag = (window as any).gtag;
    if (typeof gtag === 'function') {
      gtag('event', 'page_view', {
        page_path: pagePath,
        page_title: pageTitle || document.title || 'RonPay App',
      });
    }
  } catch {
    // Silently ignore if blocked by adblocker
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
