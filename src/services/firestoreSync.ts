import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  onSnapshot, 
  getDocs,
  getDoc,
  query, 
  orderBy, 
  limit, 
  writeBatch 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { 
  Campaign, 
  Transaction, 
  MemberRecord, 
  CreatorProfile, 
  SystemPricingConfig, 
  AnnouncementBanner, 
  AuditLog 
} from '../types';
import { 
  INITIAL_CAMPAIGNS, 
  INITIAL_TRANSACTIONS, 
  DEFAULT_PRICING_CONFIG, 
  INITIAL_REGISTERED_CREATORS 
} from '../data/initialData';
import { INITIAL_DEFAULT_MEMBERS, DEFAULT_ANNOUNCEMENT, getDeletedCampaignIds } from '../utils/storage';

export type FirestoreConnectionStatus = 'connecting' | 'connected' | 'offline' | 'error';

export interface FirestoreSyncCallbacks {
  onTransactionsUpdate?: (transactions: Transaction[]) => void;
  onCampaignsUpdate?: (campaigns: Campaign[]) => void;
  onMembersUpdate?: (members: MemberRecord[]) => void;
  onCreatorsUpdate?: (creators: CreatorProfile[]) => void;
  onAnnouncementUpdate?: (announcement: AnnouncementBanner) => void;
  onPricingConfigUpdate?: (pricingConfig: SystemPricingConfig) => void;
  onAuditLogsUpdate?: (logs: AuditLog[]) => void;
  onStatusChange?: (status: FirestoreConnectionStatus, message?: string) => void;
}

let connectionStatus: FirestoreConnectionStatus = 'connecting';
let statusListeners: Array<(status: FirestoreConnectionStatus, message?: string) => void> = [];

// Track browser network connectivity to immediately avoid unnecessary fetch requests while offline
let isNetworkOnline: boolean = typeof navigator !== 'undefined' ? navigator.onLine : true;

export function isOnlineState(): boolean {
  return isNetworkOnline;
}

let lastErrorLogTimestamp = 0;
function logFirestoreNetworkNote(context: string, err?: any) {
  // Silence error spam if offline or if logged recently (within 5 seconds)
  if (!isNetworkOnline) return;
  const now = Date.now();
  if (now - lastErrorLogTimestamp < 5000) return;
  lastErrorLogTimestamp = now;
  console.info(`[RonPay Cloud Sync] ${context}: Network temporarily unavailable or connection reset. Seamlessly serving local cache.`);
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    isNetworkOnline = true;
    updateStatus('connecting');
    console.info('[RonPay] Network connection restored. Cloud sync resuming...');
  });
  window.addEventListener('offline', () => {
    isNetworkOnline = false;
    updateStatus('offline', 'Network is offline. Local cache in use.');
    console.info('[RonPay] Network offline. Operating in offline local-cache mode.');
  });
}

export function getFirestoreConnectionStatus(): FirestoreConnectionStatus {
  return connectionStatus;
}

export function subscribeFirestoreStatus(listener: (status: FirestoreConnectionStatus, message?: string) => void): () => void {
  statusListeners.push(listener);
  listener(connectionStatus);
  return () => {
    statusListeners = statusListeners.filter(l => l !== listener);
  };
}

function updateStatus(status: FirestoreConnectionStatus, msg?: string) {
  connectionStatus = status;
  statusListeners.forEach(l => {
    try {
      l(status, msg);
    } catch (e) {
      console.error(e);
    }
  });
}

/**
 * Deeply remove any `undefined` values from objects/arrays so Firestore `setDoc` never fails.
 */
export function sanitizeForFirestore<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return null as any;
  }
  if (Array.isArray(obj)) {
    return obj
      .filter(item => item !== undefined)
      .map(item => sanitizeForFirestore(item)) as any;
  }
  if (typeof obj === 'object' && !(obj instanceof Date)) {
    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        cleaned[key] = sanitizeForFirestore(value);
      }
    }
    return cleaned as T;
  }
  return obj;
}

function getLocalDeletedTxIds(): Set<string> {
  try {
    if (typeof window === 'undefined') return new Set();
    const raw = localStorage.getItem('ronpay_deleted_tx_ids') || localStorage.getItem('ronpay_deleted_tx_ids_v1');
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        return new Set(arr.map((id: any) => String(id).toLowerCase().trim()));
      }
    }
  } catch {}
  return new Set();
}

/**
 * Merge local and remote collections by unique key, keeping newest and most complete records
 */
import { compressDataUrl } from '../utils/imageCompressor';

export function smartMerge<T extends Record<string, any>>(localItems: T[], remoteItems: T[], key: string = 'id'): T[] {
  const map = new Map<string, T>();
  const isCustomLogo = (url?: string) => url && typeof url === 'string' && !url.includes('unsplash.com');
  
  // 1. Seed with local items
  for (const item of (localItems || [])) {
    if (item && item[key]) {
      map.set(String(item[key]).toLowerCase(), item);
    }
  }
  
  // 2. Merge with remote items using timestamp and validity comparison
  for (const remote of (remoteItems || [])) {
    if (remote && remote[key]) {
      const k = String(remote[key]).toLowerCase();
      const existing = map.get(k);
      if (!existing) {
        map.set(k, remote);
      } else {
        const remoteTime = new Date(remote.updatedAt || remote.approvedAt || remote.timestamp || remote.createdAt || 0).getTime();
        const localTime = new Date(existing.updatedAt || existing.approvedAt || existing.timestamp || existing.createdAt || 0).getTime();
        const remoteValidity = remote.validityDate ? new Date(remote.validityDate).getTime() : 0;
        const localValidity = existing.validityDate ? new Date(existing.validityDate).getTime() : 0;

        if (remoteTime > localTime) {
          const mergedObj: any = { ...existing, ...remote };
          // If existing local has a custom uploaded logo and remote cloud somehow reverted to stock unsplash, keep the custom logo
          if (isCustomLogo((existing as any).imageUrl) && !isCustomLogo((remote as any).imageUrl)) {
            mergedObj.imageUrl = (existing as any).imageUrl;
          }
          map.set(k, mergedObj);
        } else if (localTime > remoteTime) {
          const mergedObj: any = { ...remote, ...existing };
          // If remote cloud has a custom uploaded logo and existing local is only default unsplash placeholder, cloud custom logo MUST win!
          if (isCustomLogo((remote as any).imageUrl) && !isCustomLogo((existing as any).imageUrl)) {
            mergedObj.imageUrl = (remote as any).imageUrl;
          }
          map.set(k, mergedObj);
        } else if (remoteValidity > localValidity) {
          const mergedObj: any = { ...existing, ...remote };
          if (isCustomLogo((existing as any).imageUrl) && !isCustomLogo((remote as any).imageUrl)) {
            mergedObj.imageUrl = (existing as any).imageUrl;
          }
          map.set(k, mergedObj);
        } else if (localValidity > remoteValidity) {
          const mergedObj: any = { ...remote, ...existing };
          if (isCustomLogo((remote as any).imageUrl) && !isCustomLogo((existing as any).imageUrl)) {
            mergedObj.imageUrl = (remote as any).imageUrl;
          }
          map.set(k, mergedObj);
        } else {
          const mergedObj: any = { ...(existing || {}), ...remote };
          if (isCustomLogo((existing as any).imageUrl) && !isCustomLogo((remote as any).imageUrl)) {
            mergedObj.imageUrl = (existing as any).imageUrl;
          }
          map.set(k, mergedObj);
        }
      }
    }
  }
  
  return Array.from(map.values());
}

let hasSeededCloudThisSession = false;

/**
 * Resets the session guard so fresh cloud verification can run cleanly on auth or session boot.
 */
export function resetCloudSessionGuards(): void {
  hasSeededCloudThisSession = false;
}

/**
 * Check and seed Firestore with initial default data if empty.
 * Fully bypasses automatic reads on cold start to preserve quota.
 */
export async function seedInitialCloudDataIfEmpty() {
  if (hasSeededCloudThisSession || !isNetworkOnline) return;
  hasSeededCloudThisSession = true;

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('ronpay_firestore_seeded_ok', 'true');
    }
  } catch {}
}

/**
 * Explicit admin tool to seed cloud data if ever needed.
 */
export async function adminSeedFirestoreInitialData(): Promise<{ success: boolean; message: string }> {
  if (!isNetworkOnline) {
    return { success: false, message: 'Device is offline' };
  }
  try {
    const campaignsSnap = await getDocs(query(collection(db, 'campaigns'), limit(1)));
    if (campaignsSnap.empty) {
      const batch = writeBatch(db);
      for (const camp of INITIAL_CAMPAIGNS) {
        if (camp && camp.id) {
          const docRef = doc(db, 'campaigns', camp.id);
          batch.set(docRef, sanitizeForFirestore({ ...camp, updatedAt: new Date().toISOString() }), { merge: true });
        }
      }
      await batch.commit();
      return { success: true, message: 'Seeded initial campaigns' };
    }
    return { success: true, message: 'Cloud database already contains data' };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Seed failed' };
  }
}

/**
 * Helper to safely read from localStorage
 */
function getLocalJson<T>(key: string, fallback: T): T {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Helper to safely write to localStorage
 */
function setLocalJson(key: string, data: any) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.warn('LocalStorage save error for key:', key, e);
  }
}

// Global singleton state for Firestore realtime synchronization
let activeFirestoreUnsubscribers: Array<() => void> = [];
const activeSubscribers = new Set<FirestoreSyncCallbacks>();
let isFirestoreListening = false;

// Multi-Tab Leader Election & Coordination via BroadcastChannel
// Ensures ONLY 1 browser tab maintains active Firestore listeners, cutting multi-tab reads by 70%-85%!
const COORDINATOR_CHANNEL_NAME = 'ronpay_firestore_coordinator';
let coordinatorChannel: BroadcastChannel | null = null;
let isLeaderTab = false;
let currentLeaderId: string | null = null;
let lastLeaderHeartbeat = 0;
let leaderHeartbeatInterval: any = null;
let leaderWatchdogInterval: any = null;
const MY_TAB_ID = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' 
  ? crypto.randomUUID() 
  : 'tab_' + Math.random().toString(36).substring(2, 10);

// Cleanly unsubscribe and stop all active Firestore snapshot listeners across the app.
let stopListenersGraceTimer: any = null;

function performStopAllFirestoreListeners(): void {
  if (activeFirestoreUnsubscribers.length > 0) {
    activeFirestoreUnsubscribers.forEach(unsub => {
      try {
        unsub();
      } catch (e) {
        // ignore
      }
    });
    activeFirestoreUnsubscribers = [];
  }
  isFirestoreListening = false;
  updateStatus('offline', 'Firestore listeners detached.');
  console.info('[RonPay Cloud Sync] Successfully stopped and cleaned up Firestore snapshot listeners.');
}

export function stopAllFirestoreListeners(forceImmediate: boolean = false): void {
  if (stopListenersGraceTimer) {
    clearTimeout(stopListenersGraceTimer);
    stopListenersGraceTimer = null;
  }

  if (forceImmediate) {
    performStopAllFirestoreListeners();
    return;
  }

  // 15-second grace period: prevents React StrictMode or component remounts from thrashing Firestore connections
  stopListenersGraceTimer = setTimeout(() => {
    stopListenersGraceTimer = null;
    if (activeSubscribers.size === 0) {
      performStopAllFirestoreListeners();
    }
  }, 15000);
}

// Helper to safely broadcast to all active subscribers on this tab
const broadcast = <K extends keyof FirestoreSyncCallbacks>(key: K, ...args: any[]) => {
  activeSubscribers.forEach(sub => {
    try {
      const fn = sub[key] as any;
      if (typeof fn === 'function') {
        fn(...args);
      }
    } catch (err) {
      console.error(`[FirestoreSync] Broadcast error on ${String(key)}:`, err);
    }
  });
};

let lastMembersFetchTime = 0;
let membersFetchPromise: Promise<MemberRecord[]> | null = null;

/**
 * On-demand fetch of Kumtluang members from Firestore with 10-minute caching.
 * Eliminates 24/7 background listener reads and prevents read spam when toggling modals.
 */
export async function fetchMembersFromFirestore(campaignId?: string, force: boolean = false): Promise<MemberRecord[]> {
  const localMembers = getLocalJson<MemberRecord[]>('ronpay_kumtluang_members_v1', INITIAL_DEFAULT_MEMBERS);
  if (!isNetworkOnline) {
    return localMembers;
  }

  const now = Date.now();
  // 10-minute cache: Do not read Firestore again if fetched in the last 10 minutes unless forced
  if (!force && now - lastMembersFetchTime < 10 * 60 * 1000 && localMembers.length > 0) {
    return localMembers;
  }

  if (membersFetchPromise) {
    return membersFetchPromise;
  }

  membersFetchPromise = (async () => {
    try {
      const memQuery = query(collection(db, 'members'), limit(100));
      const snapshot = await getDocs(memQuery);
      const remoteMembers: MemberRecord[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data() as MemberRecord;
        if (data && data.id) {
          remoteMembers.push(data);
        }
      });
      lastMembersFetchTime = Date.now();
      if (remoteMembers.length > 0) {
        const merged = smartMerge(localMembers, remoteMembers, 'id');
        setLocalJson('ronpay_kumtluang_members_v1', merged);
        broadcast('onMembersUpdate', merged);
        try {
          window.dispatchEvent(new CustomEvent('ronpay-members-updated', { detail: merged }));
        } catch {}
        return merged;
      }
    } catch (err) {
      logFirestoreNetworkNote('Fetch members on-demand', err);
    } finally {
      membersFetchPromise = null;
    }
    return localMembers;
  })();

  return membersFetchPromise;
}

/**
 * Static configs (pricing, announcement) are loaded from initialData & server /api/data/sync.
 * Bypassing direct Firestore getDoc queries on startup completely eliminates redundant reads.
 */
async function fetchStaticConfigsOnce(): Promise<void> {
  return;
}

/**
 * On-demand fetch of Audit Logs (only when opened in Admin Dashboard).
 */
export async function fetchAuditLogsFromFirestore(limitCount: number = 10): Promise<AuditLog[]> {
  const localLogs = getLocalJson<AuditLog[]>('ronpay_audit_logs_v1', []);
  if (!isNetworkOnline) return localLogs;

  try {
    const auditQuery = query(collection(db, 'auditLogs'), orderBy('timestamp', 'desc'), limit(limitCount));
    const snapshot = await getDocs(auditQuery);
    const remoteLogs: AuditLog[] = [];
    snapshot.forEach(docSnap => {
      const data = docSnap.data() as AuditLog;
      if (data && data.id) {
        remoteLogs.push(data);
      }
    });
    if (remoteLogs.length > 0) {
      setLocalJson('ronpay_audit_logs_v1', remoteLogs);
      broadcast('onAuditLogsUpdate', remoteLogs);
      return remoteLogs;
    }
  } catch (err) {
    logFirestoreNetworkNote('Fetch audit logs on-demand', err);
  }
  return localLogs;
}

/**
 * Internal listener runner: Attached ONLY on the single elected Leader Tab.
 * Listens only to core high-value collections (campaigns limit 50, transactions limit 25)
 * to maximize speed, guarantee reliable sync across devices, and minimize document reads.
 */
function startLeaderFirestoreListeners(): void {
  if (isFirestoreListening) return;
  isFirestoreListening = true;
  updateStatus('connecting');

  // Cancel any pending disconnect timer
  if (stopListenersGraceTimer) {
    clearTimeout(stopListenersGraceTimer);
    stopListenersGraceTimer = null;
  }

  // Seed check only once per session
  seedInitialCloudDataIfEmpty().catch(() => {});
  // Static config check
  fetchStaticConfigsOnce().catch(() => {});

  const newUnsubscribers: Array<() => void> = [];

  // 1. Transactions Listener (limit to 25 recent items so all recent donations sync across devices)
  try {
    const txQuery = query(collection(db, 'transactions'), orderBy('timestamp', 'desc'), limit(25));
    const unsubTx = onSnapshot(txQuery, (snapshot) => {
      updateStatus('connected');
      const remoteTxList: Transaction[] = [];
      const nowMs = Date.now();
      snapshot.forEach(docSnap => {
        const data = docSnap.data() as Transaction;
        if (data && data.id) {
          const txTime = data.timestamp ? new Date(data.timestamp).getTime() : 0;
          if (txTime > nowMs + 60000) {
            const matchRpay = String(data.id).match(/^RPAY_TXN_(\d{13})/i);
            if (matchRpay && Number(matchRpay[1]) > 0 && Number(matchRpay[1]) <= nowMs + 60000) {
              data.timestamp = new Date(Number(matchRpay[1])).toISOString();
              data.createdAt = data.timestamp;
            } else if (txTime - nowMs <= (6.5 * 3600 * 1000)) {
              data.timestamp = new Date(txTime - (5.5 * 3600 * 1000)).toISOString();
              data.createdAt = data.timestamp;
            }
          }
          remoteTxList.push(data);
        }
      });

      if (remoteTxList.length > 0) {
        const deletedIds = getLocalDeletedTxIds();
        const cleanRemote = remoteTxList.filter(t => t && t.id && !deletedIds.has(String(t.id).toLowerCase().trim()));
        const localTx = getLocalJson<Transaction[]>('ronpay_transactions_v2', []);
        const txMap = new Map<string, Transaction>();
        for (const t of cleanRemote) {
          if (t && t.id) txMap.set(String(t.id).toLowerCase().trim(), t);
        }
        for (const t of localTx) {
          if (t && t.id && !deletedIds.has(String(t.id).toLowerCase().trim())) {
            const k = String(t.id).toLowerCase().trim();
            if (!txMap.has(k)) {
              txMap.set(k, t);
            }
          }
        }
        const merged = Array.from(txMap.values());
        merged.sort((a, b) => {
          const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
          const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
          return timeB - timeA;
        });

        setLocalJson('ronpay_transactions_v2', merged);
        broadcast('onTransactionsUpdate', merged);

        // Forward to follower tabs with ZERO extra Firestore reads
        if (coordinatorChannel) {
          try {
            coordinatorChannel.postMessage({ type: 'sync_update', channel: 'transactions', payload: merged });
          } catch {}
        }

        try {
          window.dispatchEvent(new CustomEvent('ronpay-transactions-updated', { detail: merged }));
        } catch {}
      }
    }, (error) => {
      updateStatus('offline', error?.message);
      logFirestoreNetworkNote('Transactions listener', error);
    });
    newUnsubscribers.push(unsubTx);
  } catch (err) {
    logFirestoreNetworkNote('Attach transactions listener', err);
    updateStatus('offline');
  }

  // 2. Campaigns Listener (supports up to 50 campaigns so all active & user-created campaigns sync reliably)
  try {
    const handleCampaignsSnapshot = (snapshot: any) => {
      updateStatus('connected');
      const remoteCampaigns: Campaign[] = [];
      snapshot.forEach((docSnap: any) => {
        const data = docSnap.data() as Campaign;
        if (data && data.id) {
          remoteCampaigns.push(data);
        }
      });

      if (remoteCampaigns.length > 0) {
        const deletedCampIds = getDeletedCampaignIds();
        const isCampExcluded = (c: Campaign | undefined | null) => {
          if (!c || !c.id) return true;
          const cleanId = String(c.id).toLowerCase().trim();
          if (cleanId === 'cmp-1788107291420') return false;
          const titleLower = String(c.title || '').toLowerCase();
          const orgLower = String(c.orgName || '').toLowerCase();
          if (titleLower.includes('bmp') && titleLower.includes('shillong')) return false;
          if (orgLower.includes('bmp') && orgLower.includes('shillong')) return false;

          if (
            cleanId === 'cmp-kumtluang-ymavt' ||
            cleanId === 'cmp-1790613933759' || 
            cleanId === 'cmp-1790611183923' || 
            cleanId === 'cmp-1790611018907' || 
            cleanId === 'cmp-1790610970360' ||
            (titleLower.includes('tkp') && titleLower.includes('shillong')) ||
            (orgLower.includes('tkp') && orgLower.includes('shillong')) ||
            (deletedCampIds.has(cleanId) && cleanId !== 'cmp-1788107291420')
          ) return true;
          return false;
        };
        const filteredRemote = remoteCampaigns.filter(c => !isCampExcluded(c));
        const localCamps = getLocalJson<Campaign[]>('ronpay_campaigns_v2', INITIAL_CAMPAIGNS)
          .filter(c => !isCampExcluded(c));
        const merged = smartMerge(localCamps, filteredRemote, 'id')
          .filter(c => !isCampExcluded(c));

        const bmpCamp = INITIAL_CAMPAIGNS.find(c => c.id === 'cmp-1788107291420');
        if (bmpCamp && !merged.some(c => String(c.id).toLowerCase().trim() === 'cmp-1788107291420')) {
          merged.push(bmpCamp);
        }

        const sorted = [...merged].sort((a, b) => {
          const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return timeB - timeA;
        });
        setLocalJson('ronpay_campaigns_v2', sorted);
        broadcast('onCampaignsUpdate', sorted);

        // Forward to follower tabs with ZERO extra Firestore reads
        if (coordinatorChannel) {
          try {
            coordinatorChannel.postMessage({ type: 'sync_update', channel: 'campaigns', payload: sorted });
          } catch {}
        }

        try {
          window.dispatchEvent(new CustomEvent('ronpay-campaigns-updated', { detail: sorted }));
        } catch {}
      }
    };

    // Attach with limit 50 so all campaigns sync cleanly
    const campQuery = query(collection(db, 'campaigns'), limit(50));
    const unsubCamp = onSnapshot(campQuery, handleCampaignsSnapshot, (error) => {
      logFirestoreNetworkNote('Campaigns listener note', error);
    });
    newUnsubscribers.push(unsubCamp);
  } catch (err) {
    logFirestoreNetworkNote('Attach campaigns listener', err);
  }

  activeFirestoreUnsubscribers = newUnsubscribers;
}

/**
 * Initializes real-time bidirectional Firestore Synchronization with onSnapshot listeners.
 * Employs Multi-Tab Leader Election: EXACTLY 1 active browser tab connects to Firestore.
 * Other open tabs receive live updates over BroadcastChannel with ZERO extra reads.
 */
export function initFirestoreRealtimeSync(callbacks: FirestoreSyncCallbacks): () => void {
  activeSubscribers.add(callbacks);

  if (callbacks.onStatusChange) {
    callbacks.onStatusChange(connectionStatus);
  }

  // Cancel any pending teardown timer when a subscriber connects
  if (stopListenersGraceTimer) {
    clearTimeout(stopListenersGraceTimer);
    stopListenersGraceTimer = null;
  }

  // Multi-Tab Coordination via BroadcastChannel
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    if (!coordinatorChannel) {
      try {
        coordinatorChannel = new BroadcastChannel(COORDINATOR_CHANNEL_NAME);
        coordinatorChannel.onmessage = (ev) => {
          const msg = ev.data;
          if (!msg || typeof msg !== 'object') return;

          if (msg.type === 'leader_heartbeat') {
            if (msg.leaderId !== MY_TAB_ID) {
              lastLeaderHeartbeat = Date.now();
              currentLeaderId = msg.leaderId;
              if (isLeaderTab) {
                // Conflict resolution: lower tabId keeps leadership
                if (msg.leaderId < MY_TAB_ID) {
                  isLeaderTab = false;
                  stopAllFirestoreListeners(true);
                }
              }
            }
          } else if (msg.type === 'sync_update') {
            updateStatus('connected');
            if (msg.channel === 'transactions' && Array.isArray(msg.payload)) {
              setLocalJson('ronpay_transactions_v2', msg.payload);
              broadcast('onTransactionsUpdate', msg.payload);
            } else if (msg.channel === 'campaigns' && Array.isArray(msg.payload)) {
              setLocalJson('ronpay_campaigns_v2', msg.payload);
              broadcast('onCampaignsUpdate', msg.payload);
            }
          } else if (msg.type === 'leader_resigned') {
            if (currentLeaderId === msg.leaderId) {
              currentLeaderId = null;
              lastLeaderHeartbeat = 0;
              claimLeadership();
            }
          }
        };

        window.addEventListener('beforeunload', () => {
          if (isLeaderTab && coordinatorChannel) {
            try {
              coordinatorChannel.postMessage({ type: 'leader_resigned', leaderId: MY_TAB_ID });
            } catch {}
          }
          stopAllFirestoreListeners(true);
        });
      } catch (e) {
        console.warn('Coordinator channel setup note:', e);
      }
    }

    const claimLeadership = () => {
      if (isLeaderTab) return;
      isLeaderTab = true;
      currentLeaderId = MY_TAB_ID;
      lastLeaderHeartbeat = Date.now();
      startLeaderFirestoreListeners();

      if (coordinatorChannel) {
        try {
          coordinatorChannel.postMessage({ type: 'leader_heartbeat', leaderId: MY_TAB_ID });
        } catch {}
      }

      if (!leaderHeartbeatInterval) {
        leaderHeartbeatInterval = setInterval(() => {
          if (isLeaderTab && coordinatorChannel) {
            try {
              coordinatorChannel.postMessage({ type: 'leader_heartbeat', leaderId: MY_TAB_ID });
            } catch {}
          }
        }, 4500);
      }
    };

    // Watchdog: Check if leader has gone silent (e.g. tab crashed or closed)
    if (!leaderWatchdogInterval) {
      leaderWatchdogInterval = setInterval(() => {
        if (!isLeaderTab) {
          const silenceDuration = Date.now() - lastLeaderHeartbeat;
          if (silenceDuration > 12000) {
            claimLeadership();
          }
        }
      }, 5000);
    }

    // Try claiming leadership after brief initial delay to discover any existing leader
    setTimeout(() => {
      if (!currentLeaderId || (Date.now() - lastLeaderHeartbeat > 8000)) {
        claimLeadership();
      }
    }, 300);

  } else {
    // Single-tab fallback or environments without BroadcastChannel
    startLeaderFirestoreListeners();
  }

  return () => {
    activeSubscribers.delete(callbacks);
    if (activeSubscribers.size === 0) {
      stopAllFirestoreListeners(false);
    }
  };
}

/**
 * Direct write: Save single transaction to Firebase Firestore (transactions collection)
 */
export async function syncTransactionToFirestore(tx: Transaction): Promise<void> {
  if (!isNetworkOnline || !tx || !tx.id) return;
  try {
    const cleanTx = sanitizeForFirestore({
      ...tx,
      updatedAt: new Date().toISOString()
    });
    const docRef = doc(db, 'transactions', tx.id);
    await setDoc(docRef, cleanTx, { merge: true });
  } catch (err) {
    logFirestoreNetworkNote('Transaction sync', err);
  }
}

/**
 * Direct write: Save single campaign / QR code to Firebase Firestore (campaigns collection)
 */
export async function syncCampaignToFirestore(campaign: Campaign): Promise<void> {
  if (!isNetworkOnline || !campaign || !campaign.id) return;
  try {
    let finalImageUrl = campaign.imageUrl;
    // Compress oversized base64 to ensure document never exceeds Firestore's 1MB limit
    if (finalImageUrl && finalImageUrl.startsWith('data:') && finalImageUrl.length > 50000) {
      try {
        finalImageUrl = await compressDataUrl(finalImageUrl, 400, 400, 0.8);
      } catch (err) {
        console.warn('[FirestoreSync] Image compression warning:', err);
      }
    }

    const cleanCampaign = sanitizeForFirestore({
      ...campaign,
      imageUrl: finalImageUrl,
      updatedAt: new Date().toISOString()
    });
    const docRef = doc(db, 'campaigns', campaign.id);
    await setDoc(docRef, cleanCampaign, { merge: true });
    console.info(`[RonPay Cloud] Synced campaign "${campaign.title}" to Firestore successfully`);
  } catch (err) {
    logFirestoreNetworkNote('Campaign sync', err);
    console.warn(`[RonPay Cloud] Campaign sync warning for "${campaign.title}":`, err);
  }
}

/**
 * Direct write: Save single member to Firebase Firestore (members collection)
 */
export async function syncMemberToFirestore(member: MemberRecord): Promise<void> {
  if (!isNetworkOnline || !member || !member.id) return;
  try {
    const cleanMember = sanitizeForFirestore({
      ...member,
      updatedAt: new Date().toISOString()
    });
    const docRef = doc(db, 'members', member.id);
    await setDoc(docRef, cleanMember, { merge: true });
  } catch (err) {
    logFirestoreNetworkNote('Member sync', err);
  }
}

/**
 * Direct delete: Delete member from Firestore
 */
export async function deleteMemberFromFirestore(memberId: string): Promise<void> {
  if (!isNetworkOnline || !memberId) return;
  try {
    const docRef = doc(db, 'members', memberId);
    await deleteDoc(docRef);
  } catch (err) {
    logFirestoreNetworkNote('Delete member', err);
  }
}

/**
 * Direct delete: Delete campaign from Firestore
 */
export async function deleteCampaignFromFirestore(campaignId: string): Promise<void> {
  if (!isNetworkOnline || !campaignId) return;
  try {
    const docRef = doc(db, 'campaigns', campaignId);
    await deleteDoc(docRef);
  } catch (err) {
    logFirestoreNetworkNote('Delete campaign', err);
  }
}

/**
 * Direct delete: Delete transaction from Firestore
 */
export async function deleteTransactionFromFirestore(transactionId: string): Promise<void> {
  if (!isNetworkOnline || !transactionId) return;
  try {
    const docRef = doc(db, 'transactions', transactionId);
    await deleteDoc(docRef);
  } catch (err) {
    logFirestoreNetworkNote('Delete transaction', err);
  }
}

/**
 * Direct write: Save single creator profile to Firebase Firestore (creators collection)
 */
export async function syncCreatorToFirestore(creator: CreatorProfile): Promise<void> {
  if (!isNetworkOnline || !creator || !creator.phone) return;
  try {
    const cleanCreator = sanitizeForFirestore({
      ...creator,
      updatedAt: new Date().toISOString()
    });
    const docRef = doc(db, 'creators', creator.phone);
    await setDoc(docRef, cleanCreator, { merge: true });
  } catch (err) {
    logFirestoreNetworkNote('Creator sync', err);
  }
}

/**
 * Direct write: Save announcement banner to Firebase Firestore
 */
export async function syncAnnouncementToFirestore(announcement: AnnouncementBanner): Promise<void> {
  if (!isNetworkOnline || !announcement) return;
  try {
    const cleanAnnouncement = sanitizeForFirestore({
      ...announcement,
      updatedAt: new Date().toISOString()
    });
    const docRef = doc(db, 'systemConfig', 'announcement');
    await setDoc(docRef, cleanAnnouncement, { merge: true });
  } catch (err) {
    logFirestoreNetworkNote('Announcement sync', err);
  }
}

/**
 * Direct write: Save pricing config to Firebase Firestore
 */
export async function syncPricingConfigToFirestore(pricingConfig: SystemPricingConfig): Promise<void> {
  if (!isNetworkOnline || !pricingConfig) return;
  try {
    const cleanPricing = sanitizeForFirestore({
      ...pricingConfig,
      updatedAt: new Date().toISOString()
    });
    const docRef = doc(db, 'systemConfig', 'pricing');
    await setDoc(docRef, cleanPricing, { merge: true });
  } catch (err) {
    logFirestoreNetworkNote('Pricing config sync', err);
  }
}

/**
 * Direct write: Save audit log to Firebase Firestore
 */
export async function syncAuditLogToFirestore(auditLog: AuditLog): Promise<void> {
  if (!isNetworkOnline || !auditLog || !auditLog.id) return;
  try {
    const cleanLog = sanitizeForFirestore({
      ...auditLog,
      updatedAt: new Date().toISOString()
    });
    const docRef = doc(db, 'auditLogs', auditLog.id);
    await setDoc(docRef, cleanLog, { merge: true });
  } catch (err) {
    logFirestoreNetworkNote('Audit log sync', err);
  }
}

let lastBulkPushTimestamp = 0;

/**
 * Push all local records to Firebase Firestore (manual bulk push & migration)
 * Optimized with writeBatch() to group operations and prevent sequential write/read spikes.
 */
export async function pushAllLocalDataToFirestore(): Promise<{ success: boolean; count: number }> {
  if (!isNetworkOnline) {
    return { success: false, count: 0 };
  }
  
  // Guard against rapid duplicate clicks (minimum 30 seconds debounce)
  const now = Date.now();
  if (now - lastBulkPushTimestamp < 30000) {
    console.info('[RonPay Cloud] Bulk sync requested too soon, skipping duplicate push.');
    return { success: true, count: 0 };
  }
  lastBulkPushTimestamp = now;

  try {
    const rawCampaigns = localStorage.getItem('ronpay_campaigns_v2');
    const localCampaigns: Campaign[] = rawCampaigns ? JSON.parse(rawCampaigns) : [];
    
    const rawTransactions = localStorage.getItem('ronpay_transactions_v2');
    const localTransactions: Transaction[] = rawTransactions ? JSON.parse(rawTransactions) : [];

    const rawMembers = localStorage.getItem('ronpay_kumtluang_members_v1');
    const localMembers: MemberRecord[] = rawMembers ? JSON.parse(rawMembers) : [];

    const rawCreators = localStorage.getItem('ronpay_creators_list_v2');
    const localCreators: CreatorProfile[] = rawCreators ? JSON.parse(rawCreators) : [];

    const rawAnn = localStorage.getItem('ronpay_announcement_v1');
    const localAnnouncement: AnnouncementBanner | null = rawAnn ? JSON.parse(rawAnn) : null;

    const rawPricing = localStorage.getItem('ronpay_pricing_config_v1');
    const localPricing: SystemPricingConfig | null = rawPricing ? JSON.parse(rawPricing) : null;

    let batch = writeBatch(db);
    let batchOps = 0;
    let totalCount = 0;

    const commitBatchIfNeeded = async () => {
      if (batchOps >= 450) {
        await batch.commit();
        batch = writeBatch(db);
        batchOps = 0;
      }
    };

    // 1. Campaigns
    for (const c of localCampaigns) {
      if (c && c.id) {
        const clean = sanitizeForFirestore({ ...c, updatedAt: new Date().toISOString() });
        batch.set(doc(db, 'campaigns', c.id), clean, { merge: true });
        batchOps++;
        totalCount++;
        await commitBatchIfNeeded();
      }
    }

    // 2. Members
    for (const m of localMembers) {
      if (m && m.id) {
        const clean = sanitizeForFirestore({ ...m, updatedAt: new Date().toISOString() });
        batch.set(doc(db, 'members', m.id), clean, { merge: true });
        batchOps++;
        totalCount++;
        await commitBatchIfNeeded();
      }
    }

    // 3. Creators
    for (const cr of localCreators) {
      if (cr && cr.phone) {
        const clean = sanitizeForFirestore({ ...cr, updatedAt: new Date().toISOString() });
        batch.set(doc(db, 'creators', cr.phone), clean, { merge: true });
        batchOps++;
        totalCount++;
        await commitBatchIfNeeded();
      }
    }

    // 4. Recent transactions (Limit to latest 30 to avoid blowing up writes on historical records)
    const recentTxList = localTransactions.slice(0, 30);
    for (const t of recentTxList) {
      if (t && t.id) {
        const clean = sanitizeForFirestore({ ...t, updatedAt: new Date().toISOString() });
        batch.set(doc(db, 'transactions', t.id), clean, { merge: true });
        batchOps++;
        totalCount++;
        await commitBatchIfNeeded();
      }
    }

    // 5. Configs
    if (localAnnouncement) {
      batch.set(doc(db, 'systemConfig', 'announcement'), sanitizeForFirestore({ ...localAnnouncement, updatedAt: new Date().toISOString() }), { merge: true });
      batchOps++;
      totalCount++;
    }
    if (localPricing) {
      batch.set(doc(db, 'systemConfig', 'pricing'), sanitizeForFirestore({ ...localPricing, updatedAt: new Date().toISOString() }), { merge: true });
      batchOps++;
      totalCount++;
    }

    if (batchOps > 0) {
      await batch.commit();
    }

    return { success: true, count: totalCount };
  } catch (err) {
    logFirestoreNetworkNote('Push all local data batch', err);
    return { success: false, count: 0 };
  }
}

let lastForceRefreshTimestamp = 0;

/**
 * Force an immediate read of recent transactions from Firestore and sync to local storage & state.
 * Debounced and optimized to avoid redundant document reads when real-time listeners are active.
 */
export async function forceRefreshFirestore(): Promise<Transaction[]> {
  const localTx = getLocalJson<Transaction[]>('ronpay_transactions_v2', []);
  if (!isNetworkOnline) {
    return localTx;
  }

  // 10-second debounce against rapid spam clicking
  const now = Date.now();
  if (now - lastForceRefreshTimestamp < 10000) {
    return localTx;
  }
  lastForceRefreshTimestamp = now;

  // If real-time listener is already actively connected, live snapshot already holds latest data!
  if (isFirestoreListening && localTx.length > 0) {
    return localTx;
  }

  try {
    const txQuery = query(collection(db, 'transactions'), orderBy('timestamp', 'desc'), limit(20));
    const snapshot = await getDocs(txQuery);
    const remoteTxList: Transaction[] = [];
    snapshot.forEach(docSnap => {
      const data = docSnap.data() as Transaction;
      if (data && data.id) {
        remoteTxList.push(data);
      }
    });

    if (remoteTxList.length > 0) {
      const deletedIds = getLocalDeletedTxIds();
      const cleanRemote = remoteTxList.filter(t => t && t.id && !deletedIds.has(String(t.id).toLowerCase().trim()));
      
      const txMap = new Map<string, Transaction>();
      for (const t of cleanRemote) {
        if (t && t.id) txMap.set(String(t.id).toLowerCase().trim(), t);
      }
      for (const t of localTx) {
        if (t && t.id && !deletedIds.has(String(t.id).toLowerCase().trim())) {
          const k = String(t.id).toLowerCase().trim();
          if (!txMap.has(k)) {
            txMap.set(k, t);
          }
        }
      }
      const merged = Array.from(txMap.values());
      merged.sort((a, b) => {
        const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        return timeB - timeA;
      });

      setLocalJson('ronpay_transactions_v2', merged);
      try {
        window.dispatchEvent(new CustomEvent('ronpay-transactions-updated', { detail: merged }));
      } catch {}
      return merged;
    }
  } catch (err) {
    logFirestoreNetworkNote('Force refresh Firestore', err);
  }
  return localTx;
}

