// Firebase Cloud Messaging (FCM) Service Worker for RonPay
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyDbLHlj2yEDQVxm2LRJjY8OMpuBab-TxEk",
  authDomain: "ronpay-7fc69.firebaseapp.com",
  projectId: "ronpay-7fc69",
  storageBucket: "ronpay-7fc69.firebasestorage.app",
  messagingSenderId: "807189818533",
  appId: "1:807189818533:web:2ab29ad49be78f9824b14c",
  measurementId: "G-P29J9QMYK6"
};

firebase.initializeApp(firebaseConfig);

let messaging;
try {
  messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background message:', payload);
    const notificationTitle = payload.notification?.title || payload.data?.title || '💳 RonPay: Payment Receipt';
    const notificationOptions = {
      body: payload.notification?.body || payload.data?.body || 'Your payment has been settled successfully.',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: payload.data || {},
      tag: payload.data?.transactionId || 'ronpay-receipt'
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
  });
} catch (err) {
  console.warn('[firebase-messaging-sw.js] Messaging init warning:', err);
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const txId = event.notification.data?.transactionId || event.notification.data?.id;
  const targetUrl = txId ? `/?receipt=${encodeURIComponent(txId)}` : '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
