export function registerServiceWorker() {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('[RonPay] ServiceWorker registered successfully with scope:', registration.scope);
        })
        .catch((error) => {
          console.warn('[RonPay] ServiceWorker registration notice:', error);
        });
    });
  }
}
