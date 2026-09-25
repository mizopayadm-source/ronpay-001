/**
 * RonPay Cross-Tab & Cross-Window State Synchronization Service
 * 
 * Provides instantaneous synchronization across multiple browser tabs, windows,
 * and devices using the BroadcastChannel API ('ronpay_state_sync'), backed by
 * storage events and focus refetching.
 * 
 * Guarantees zero unnecessary Firestore reads during cross-tab state updates.
 */

import { resetCloudSessionGuards } from './firestoreSync';

export const BROADCAST_CHANNEL_NAME = 'ronpay_state_sync';
export const LEGACY_BROADCAST_CHANNEL_NAME = 'ronpay_realtime_sync';
export const STATE_SYNC_STORAGE_SIGNAL_KEY = 'ronpay_state_sync_signal_v1';
export const SESSION_BOOT_TIMESTAMP_KEY = 'ronpay_session_boot_ts_v1';

// Generate a persistent, unique identifier for this window/tab instance
export const CURRENT_TAB_ID: string = (() => {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return `tab_${crypto.randomUUID()}`;
    }
  } catch {}
  return `tab_${Math.random().toString(36).substring(2, 11)}_${Date.now()}`;
})();

export type StateSyncTopic =
  | 'campaigns'
  | 'transactions'
  | 'members'
  | 'creators'
  | 'creator_profile'
  | 'pricing_config'
  | 'announcement'
  | 'audit_logs'
  | 'user_paid'
  | 'wallet'
  | 'auth'
  | 'all';

export type StateSyncAction = 'create' | 'update' | 'delete' | 'auth_login' | 'auth_logout' | 'refresh';

export interface StateSyncMessage {
  topic: StateSyncTopic;
  action?: StateSyncAction;
  data?: any;
  timestamp: number;
  sourceTabId: string;
}

// Persistent singleton channel instances to prevent message dropping
let stateChannelInstance: BroadcastChannel | null = null;
let legacyChannelInstance: BroadcastChannel | null = null;
let isChannelListening = false;

const subscribers = new Set<(msg: StateSyncMessage) => void>();

function getBroadcastChannels(): BroadcastChannel[] {
  if (typeof window === 'undefined' || !('BroadcastChannel' in window)) {
    return [];
  }

  const channels: BroadcastChannel[] = [];

  if (!stateChannelInstance) {
    try {
      stateChannelInstance = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
    } catch (e) {
      console.warn('[CrossTabSync] Failed to initialize stateSyncChannel:', e);
    }
  }
  if (stateChannelInstance) channels.push(stateChannelInstance);

  if (!legacyChannelInstance) {
    try {
      legacyChannelInstance = new BroadcastChannel(LEGACY_BROADCAST_CHANNEL_NAME);
    } catch (e) {
      console.warn('[CrossTabSync] Failed to initialize legacySyncChannel:', e);
    }
  }
  if (legacyChannelInstance) channels.push(legacyChannelInstance);

  return channels;
}

function handleIncomingMessage(rawEventData: any) {
  if (!rawEventData || typeof rawEventData !== 'object') return;

  // Handle both standard StateSyncMessage and legacy { type, data } payload formats
  let normalizedMessage: StateSyncMessage;

  if (rawEventData.topic && rawEventData.sourceTabId) {
    normalizedMessage = rawEventData as StateSyncMessage;
  } else if (rawEventData.type) {
    // Legacy format from old broadcastTabSync callers
    normalizedMessage = {
      topic: (rawEventData.type as StateSyncTopic) || 'all',
      action: 'update',
      data: rawEventData.data,
      timestamp: rawEventData.timestamp || Date.now(),
      sourceTabId: rawEventData.sourceTabId || 'legacy_tab'
    };
  } else {
    return;
  }

  // Do not process messages emitted by this same tab
  if (normalizedMessage.sourceTabId === CURRENT_TAB_ID) {
    return;
  }

  // Dispatch to all registered subscribers
  subscribers.forEach(listener => {
    try {
      listener(normalizedMessage);
    } catch (err) {
      console.error('[CrossTabSync] Listener error:', err);
    }
  });
}

function initChannelListeners() {
  if (isChannelListening || typeof window === 'undefined') return;
  isChannelListening = true;

  const channels = getBroadcastChannels();
  channels.forEach(ch => {
    ch.onmessage = (event: MessageEvent) => {
      handleIncomingMessage(event.data);
    };
  });

  // Storage event listener as reliable cross-tab fallback
  window.addEventListener('storage', (e: StorageEvent) => {
    if (e.key === STATE_SYNC_STORAGE_SIGNAL_KEY && e.newValue) {
      try {
        const parsed = JSON.parse(e.newValue);
        if (parsed && parsed.sourceTabId !== CURRENT_TAB_ID) {
          handleIncomingMessage(parsed);
        }
      } catch {}
    }
  });
}

/**
 * Instantly broadcasts a state mutation to all other active windows and tabs.
 * Refreshes other tabs' state without making redundant Firestore read calls.
 */
export function broadcastStateChange(
  topic: StateSyncTopic,
  data?: any,
  action: StateSyncAction = 'update'
): void {
  if (typeof window === 'undefined') return;

  const message: StateSyncMessage = {
    topic,
    action,
    data,
    timestamp: Date.now(),
    sourceTabId: CURRENT_TAB_ID
  };

  // 1. Dispatch custom local events for intra-window component reactiveness
  try {
    window.dispatchEvent(new CustomEvent('ronpay_state_sync_event', { detail: message }));
    window.dispatchEvent(new CustomEvent(`ronpay_${topic}_updated`, { detail: data }));
    window.dispatchEvent(new CustomEvent(`ronpay-${topic.replace('_', '-')}-updated`, { detail: data }));
  } catch (e) {}

  // 2. Post to BroadcastChannels ('ronpay_state_sync' and 'ronpay_realtime_sync')
  const channels = getBroadcastChannels();
  channels.forEach(ch => {
    try {
      ch.postMessage(message);
    } catch (e) {
      console.warn('[CrossTabSync] postMessage error on channel:', e);
    }
  });

  // 3. Update localStorage signal key as a fallback for browsers / contexts without BroadcastChannel
  try {
    localStorage.setItem(
      STATE_SYNC_STORAGE_SIGNAL_KEY,
      JSON.stringify({
        topic,
        action,
        timestamp: Date.now(),
        sourceTabId: CURRENT_TAB_ID
      })
    );
  } catch (e) {}
}

/**
 * Subscribes to cross-tab synchronization events.
 * Returns an unsubscribe callback.
 */
export function subscribeCrossTabSync(listener: (msg: StateSyncMessage) => void): () => void {
  subscribers.add(listener);
  initChannelListeners();

  return () => {
    subscribers.delete(listener);
  };
}

/**
 * Window Focus / Tab Re-activation Refetch Listener:
 * Performs a light check or invalidates stale localStorage/in-memory cache
 * to sync the latest state whenever the user switches back to the tab or opens a new window.
 */
let lastFocusSyncTimestamp = 0;
let lastKnownSignalTimestamp = 0;

export function setupWindowFocusSync(
  onRefresh: () => void,
  throttleMs: number = 1000
): () => void {
  if (typeof window === 'undefined') return () => {};

  const handleFocusOrVisible = () => {
    const now = Date.now();
    // Throttle frequent focus events (e.g. clicking into console or inspector)
    if (now - lastFocusSyncTimestamp < throttleMs) {
      return;
    }
    lastFocusSyncTimestamp = now;

    // Light check: inspect whether another tab modified data while this window was inactive
    let hasExternalMutation = false;
    try {
      const signalRaw = localStorage.getItem(STATE_SYNC_STORAGE_SIGNAL_KEY);
      if (signalRaw) {
        const parsed = JSON.parse(signalRaw);
        if (parsed && parsed.timestamp > lastKnownSignalTimestamp && parsed.sourceTabId !== CURRENT_TAB_ID) {
          hasExternalMutation = true;
          lastKnownSignalTimestamp = parsed.timestamp;
        }
      }
    } catch {}

    // Refetch/resync immediately if external mutation was detected or tab regained active focus
    if (hasExternalMutation || document.visibilityState === 'visible') {
      try {
        onRefresh();
      } catch (err) {
        console.error('[CrossTabSync] Error in focus refresh callback:', err);
      }
    }
  };

  window.addEventListener('focus', handleFocusOrVisible);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      handleFocusOrVisible();
    }
  });

  return () => {
    window.removeEventListener('focus', handleFocusOrVisible);
  };
}

/**
 * Cache Invalidation on Auth / Session Boot:
 * Purges stale cached state and resets memory guards (such as hasSeededCloudThisSession)
 * so the user always renders fresh server data first upon sign-in, sign-out, or session boot.
 */
export function invalidateCacheOnAuthOrBoot(
  reason: 'auth_login' | 'auth_logout' | 'session_boot' = 'session_boot'
): void {
  // 1. Only reset cloud session guards on explicit auth logout to prevent excessive Firestore reads
  if (reason === 'auth_logout') {
    resetCloudSessionGuards();
  }

  // 2. Mark session boot timestamp
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(SESSION_BOOT_TIMESTAMP_KEY, Date.now().toString());
    }
  } catch {}

  // 3. Broadcast across tabs so open windows cleanly align auth state
  if (reason === 'auth_login' || reason === 'auth_logout') {
    broadcastStateChange('auth', { reason }, reason);
  }
}
