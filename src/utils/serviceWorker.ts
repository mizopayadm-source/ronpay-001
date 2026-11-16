// Service Worker registration, cache cleanup & Web Push notification helpers

let swRegistration: ServiceWorkerRegistration | null = null;

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  try {
    if (typeof window !== 'undefined' && 'caches' in window) {
      // Purge any legacy static-HTML/JS caches that could serve outdated frontend code
      caches.keys().then((names) => {
        names.forEach((name) => {
          if (name.startsWith('ronpay-cache-v1') || name.startsWith('ronpay-cache-v2') || name.startsWith('ronpay-cache-v3')) {
            caches.delete(name).catch(() => {});
          }
        });
      }).catch(() => {});
    }

    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      const hadController = Boolean(navigator.serviceWorker.controller);
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
        updateViaCache: 'none'
      });
      swRegistration = registration;

      // Immediately check for updated Service Worker so stale v3 workers upgrade seamlessly
      registration.update().catch(() => {});

      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!hadController) return;
        try {
          const reloadKey = 'ronpay_sw_reloaded_v4';
          if (!sessionStorage.getItem(reloadKey)) {
            sessionStorage.setItem(reloadKey, '1');
            window.location.reload();
          }
        } catch {}
      });

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
