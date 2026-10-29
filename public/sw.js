// RonPay Service Worker for Offline Mode, Dynamic Caching & Web Push Notifications
const CACHE_NAME = 'ronpay-cache-v3';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/ronpay-logo.png',
  '/favicon.png',
  '/favicon.svg',
  '/pwa-192x192.png',
  '/pwa-512x512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[Service Worker] Non-critical cache error on install:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Network-first with cache fallback for static assets, bypassing API calls & SSE
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || !event.request.url.startsWith('http')) {
    return;
  }

  // Strictly bypass all API calls, database JSON, and SSE streams to guarantee real-time sync
  if (
    event.request.url.includes('/api/') || 
    event.request.url.includes('ronpay_db.json')
  ) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(async () => {
        const cachedResponse = await caches.match(event.request);
        if (cachedResponse) {
          return cachedResponse;
        }

        if (event.request.mode === 'navigate') {
          const fallback = await caches.match('/');
          if (fallback) return fallback;
        }

        return new Response('Offline - RonPay Cached Mode Active', {
          status: 503,
          statusText: 'Service Unavailable (Offline)',
          headers: new Headers({ 'Content-Type': 'text/plain' }),
        });
      })
  );
});

// ==========================================
// Web Push Notifications Integration
// ==========================================
self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: 'RonPay Notification', body: event.data.text() };
    }
  } else {
    data = { title: 'RonPay Platform', body: 'New campaign goal or donation update.' };
  }

  const title = data.title || 'RonPay Digital Platform';
  const options = {
    body: data.body || 'New dynamic receipt or campaign goal update.',
    icon: data.icon || '/ronpay-logo.png',
    badge: data.badge || '/favicon.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/?view=app',
      receiptId: data.receiptId,
      campaignId: data.campaignId,
      timestamp: Date.now()
    },
    actions: [
      { action: 'open', title: 'Open Receipt / App' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'dismiss') return;

  const targetUrl = (event.notification.data && event.notification.data.url) || '/?view=app';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          if ('navigate' in client) {
            client.navigate(targetUrl);
          }
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// Listen for message events (e.g. instant local test notifications or cache updates)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, options } = event.data;
    self.registration.showNotification(title, {
      icon: '/ronpay-logo.png',
      badge: '/favicon.png',
      vibrate: [80, 40, 80],
      ...options
    });
  }
});
