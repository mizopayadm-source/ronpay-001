// RonPay Service Worker for Web Push Notifications & Live Cache-Busting
const CACHE_NAME = 'ronpay-cache-v4-live';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => caches.delete(name))
      );
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

// Always fetch fresh code, HTML, APIs, and data directly from network so browsers never load stale cached code
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || !event.request.url.startsWith('http')) {
    return;
  }

  // Bypass HTML/navigation, JS/CSS modules, API calls, and database JSON completely
  const url = event.request.url;
  const isNavOrCode =
    event.request.mode === 'navigate' ||
    url.includes('/api/') ||
    url.includes('ronpay_db.json') ||
    url.endsWith('.html') ||
    url.endsWith('.js') ||
    url.endsWith('.ts') ||
    url.endsWith('.tsx') ||
    url.endsWith('.css');

  if (isNavOrCode) {
    return;
  }
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

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
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
