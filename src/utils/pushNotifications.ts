import { showNotificationViaSW, registerServiceWorker } from './serviceWorker';
import { dismissGuestBanner } from './guestPersonalization';

export interface PushPromptOptions {
  reason?: 'campaign_view' | 'transaction_create' | 'user_manual';
  campaignTitle?: string;
  receiptId?: string;
}

/**
 * Check if the current browser environment supports Push Notifications
 */
export const isPushSupported = (): boolean => {
  if (typeof window === 'undefined') return false;
  return 'Notification' in window && 'serviceWorker' in navigator;
};

/**
 * Get current notification permission state
 */
export const getNotificationPermission = (): NotificationPermission => {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }
  return Notification.permission;
};

/**
 * Request notification permission from the user
 */
export const requestNotificationPermission = async (options?: PushPromptOptions): Promise<boolean> => {
  if (!isPushSupported()) {
    console.warn('[RonPay Web Push] Push notifications not supported on this browser.');
    return false;
  }

  try {
    // Ensure service worker is registered
    await registerServiceWorker();

    const permission = await Notification.requestPermission();
    console.log('[RonPay Web Push] Notification permission result:', permission);

    if (permission === 'granted') {
      // Send a welcome / confirmation notification
      let bodyText = "Hnathawh leh thawhlawm/receipt thar a awmin notification i dawng zel ang.";
      if (options?.reason === 'transaction_create' && options?.receiptId) {
        bodyText = `Receipt #${options.receiptId} verification leh campaign updates i dawng nghal ang.`;
      } else if (options?.reason === 'campaign_view' && options?.campaignTitle) {
        bodyText = `"${options.campaignTitle}" Bawm goal leh thawhlawm thar updates i dawng thei tawh ang.`;
      }

      await showNotificationViaSW('RonPay Notifications Active 🔔', {
        body: bodyText,
        icon: '/ronpay-logo.png',
        badge: '/favicon.png',
        data: {
          url: '/?view=app',
          receiptId: options?.receiptId,
        },
      });

      return true;
    } else if (permission === 'denied') {
      dismissGuestBanner('push');
      return false;
    }
  } catch (error) {
    console.warn('[RonPay Web Push] Permission request error:', error);
  }

  return false;
};

/**
 * Dispatch an update push notification (e.g. receipt verified, goal updated)
 */
export const sendRonPayPushUpdate = async (
  title: string, 
  body: string, 
  data?: { url?: string; receiptId?: string; campaignId?: string }
): Promise<boolean> => {
  if (getNotificationPermission() !== 'granted') return false;

  return showNotificationViaSW(title, {
    body,
    icon: '/ronpay-logo.png',
    badge: '/favicon.png',
    data: data || { url: '/?view=app' },
  });
};
