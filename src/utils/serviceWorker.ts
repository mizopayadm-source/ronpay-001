// Service Worker registration & Web Push notification helpers

let swRegistration: ServiceWorkerRegistration | null = null;

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  try {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      swRegistration = registration;
      console.log('[RonPay] ServiceWorker registered with scope:', registration.scope);
      return registration;
    }
  } catch (error) {
    console.warn('[RonPay] ServiceWorker registration note:', error);
  }
  return null;
}

export function getSWRegistration(): ServiceWorkerRegistration | null {
  return swRegistration;
}

/**
 * Triggers a notification via active service worker
 */
export async function showNotificationViaSW(title: string, options: NotificationOptions = {}): Promise<boolean> {
  try {
    if (typeof window === 'undefined' || !('Notification' in window)) return false;
    if (Notification.permission !== 'granted') return false;

    if ('serviceWorker' in navigator) {
      const reg = swRegistration || (await navigator.serviceWorker.ready.catch(() => null));
      if (reg && reg.showNotification) {
        await reg.showNotification(title, {
          icon: '/ronpay-logo.png',
          badge: '/favicon.png',
          ...options,
        });
        return true;
      }
    }

    // Direct browser Notification fallback
    new Notification(title, {
      icon: '/ronpay-logo.png',
      badge: '/favicon.png',
      ...options,
    });
    return true;
  } catch (e) {
    console.warn('[RonPay] Failed to show notification:', e);
    return false;
  }
}
