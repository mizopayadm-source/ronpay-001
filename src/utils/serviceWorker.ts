export function registerServiceWorker() {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          // Immediately check for SW update on server
          registration.update().catch(() => {});

          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  // A new update is available and active
                  console.log('[RonPay] New update installed and activated');
                }
              });
            }
          });
        })
        .catch((error) => {
          console.warn('[RonPay] ServiceWorker registration notice:', error);
        });
    });
  }
}
