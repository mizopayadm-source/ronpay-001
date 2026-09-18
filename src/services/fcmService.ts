import { getMessaging, getToken, onMessage, isSupported, Messaging } from 'firebase/messaging';
import { doc, setDoc } from 'firebase/firestore';
import { app, db } from '../lib/firebase';
import { Transaction } from '../types';
import { getCustomDomain } from '../utils/qr';

export interface FCMNotificationPayload {
  title: string;
  body: string;
  transactionId?: string;
  campaignId?: string;
  amount?: number;
  url?: string;
  timestamp: string;
}

let messagingInstance: Messaging | null = null;
let isFCMSupported = false;
let notificationListeners: Array<(payload: FCMNotificationPayload) => void> = [];

/**
 * Check FCM browser support and initialize messaging
 */
export async function initFCM(): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  try {
    const supported = await isSupported();
    if (!supported) {
      console.info('Firebase Cloud Messaging (FCM) is not supported in this browser environment.');
      return false;
    }

    messagingInstance = getMessaging(app);
    isFCMSupported = true;

    // Foreground push message listener
    onMessage(messagingInstance, (payload) => {
      console.log('🔔 [FCM] Foreground push message received:', payload);
      
      const notificationData: FCMNotificationPayload = {
        title: payload.notification?.title || payload.data?.title || '💳 RonPay: Payment Receipt',
        body: payload.notification?.body || payload.data?.body || 'Your transaction was settled successfully.',
        transactionId: payload.data?.transactionId || payload.data?.id,
        campaignId: payload.data?.campaignId,
        amount: payload.data?.amount ? Number(payload.data.amount) : undefined,
        url: payload.data?.url || (payload.data?.transactionId ? `${getCustomDomain()}/?receipt=${payload.data.transactionId}` : undefined),
        timestamp: new Date().toISOString()
      };

      // Notify in-app subscribers
      notificationListeners.forEach(listener => {
        try {
          listener(notificationData);
        } catch (e) {
          console.error(e);
        }
      });

      // Show browser system notification if allowed
      if ('Notification' in window && Notification.permission === 'granted') {
        try {
          const n = new Notification(notificationData.title, {
            body: notificationData.body,
            icon: '/icon-192.png',
            tag: notificationData.transactionId || 'ronpay-receipt'
          });
          n.onclick = () => {
            window.focus();
            if (notificationData.url) {
              window.location.href = notificationData.url;
            }
          };
        } catch (err) {
          console.warn('Browser system notification display failed:', err);
        }
      }
    });

    return true;
  } catch (err) {
    console.warn('FCM Initialization error:', err);
    return false;
  }
}

/**
 * Subscribe to in-app foreground FCM notifications
 */
export function onFCMNotification(listener: (payload: FCMNotificationPayload) => void): () => void {
  notificationListeners.push(listener);
  return () => {
    notificationListeners = notificationListeners.filter(l => l !== listener);
  };
}

/**
 * Request Push Notification Permission and acquire FCM Token
 */
export async function requestFCMNotificationPermission(): Promise<{ granted: boolean; token?: string; error?: string }> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return { granted: false, error: 'Notifications not supported in this browser' };
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return { granted: false, error: 'Notification permission denied' };
    }

    if (!messagingInstance) {
      await initFCM();
    }

    if (!messagingInstance) {
      return { granted: true, token: 'local_notification_enabled' };
    }

    try {
      // Register service worker if available
      let serviceWorkerRegistration: ServiceWorkerRegistration | undefined;
      if ('serviceWorker' in navigator) {
        try {
          serviceWorkerRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
        } catch (swErr) {
          console.warn('FCM SW registration fallback:', swErr);
        }
      }

      const token = await getToken(messagingInstance, {
        serviceWorkerRegistration
      });

      if (token) {
        localStorage.setItem('ronpay_fcm_token', token);
        
        // Register token in Firestore collection for push routing
        try {
          const tokenRef = doc(db, 'fcmTokens', token.slice(0, 32));
          await setDoc(tokenRef, {
            token,
            updatedAt: new Date().toISOString(),
            userAgent: navigator.userAgent
          }, { merge: true });
        } catch (dbErr) {
          console.warn('FCM token save to Firestore deferred:', dbErr);
        }

        return { granted: true, token };
      }
    } catch (tokenErr) {
      console.warn('FCM getToken notice:', tokenErr);
    }

    return { granted: true, token: 'browser_push_enabled' };
  } catch (err: any) {
    return { granted: false, error: err?.message || 'Permission request error' };
  }
}

/**
 * Get current FCM Permission and Token state
 */
export function getFCMStatus(): { permission: NotificationPermission | 'unsupported'; token: string | null } {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return { permission: 'unsupported', token: null };
  }
  const token = localStorage.getItem('ronpay_fcm_token');
  return { permission: Notification.permission, token };
}

const playedReceiptChimes = new Set<string>();

/**
 * Triggers a real-time digital payment receipt notification (FCM foreground / local chime)
 */
export function triggerReceiptNotification(
  tx: Transaction,
  campaignTitle?: string,
  options: { playSound?: boolean } = { playSound: false }
) {
  if (typeof window === 'undefined') return;

  const titleName = campaignTitle || tx.campaignTitle || 'RonPay Bawm';
  const receiptUrl = `${getCustomDomain()}/?receipt=${encodeURIComponent(tx.id)}`;

  const payload: FCMNotificationPayload = {
    title: `💳 RonPay: Pawisa Chhunluh Hlawhtling!`,
    body: `₹${(tx.amount || 0).toLocaleString('en-IN')} - ${titleName} (${tx.id}). Digital receipt peih a ni e.`,
    transactionId: tx.id,
    campaignId: tx.campaignId,
    amount: tx.amount,
    url: receiptUrl,
    timestamp: new Date().toISOString()
  };

  // 1. Play receipt notification chime only if explicitly requested and not already played
  const alreadyPlayed = tx.id && (playedReceiptChimes.has(tx.id) || (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(`ronpay_fcm_chime_${tx.id}`) === 'true'));
  if (options.playSound && !alreadyPlayed) {
    if (tx.id) {
      playedReceiptChimes.add(tx.id);
      try {
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.setItem(`ronpay_fcm_chime_${tx.id}`, 'true');
        }
      } catch {}
    }
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
        osc.frequency.exponentialRampToValueAtTime(1318.51, ctx.currentTime + 0.15); // E6
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      }
    } catch (e) {
      // Audio policy fallback
    }
  }

  // 2. Dispatch to in-app listeners
  notificationListeners.forEach(listener => {
    try {
      listener(payload);
    } catch (e) {
      console.error(e);
    }
  });

  // 3. Trigger native browser push notification
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      const notif = new Notification(payload.title, {
        body: payload.body,
        icon: '/icon-192.png',
        tag: tx.id
      });
      notif.onclick = () => {
        window.focus();
        window.location.href = receiptUrl;
      };
    } catch (e) {
      // Browser restriction fallback
    }
  }
}
