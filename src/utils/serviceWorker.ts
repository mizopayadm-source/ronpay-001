export function registerServiceWorker() {
  try {
    const isProd = Boolean((import.meta as any).env?.PROD);
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator && isProd) {
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
  } catch (e) {
    console.warn('[RonPay] ServiceWorker setup ignored:', e);
  }
}
