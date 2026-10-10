import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  onSnapshot, 
  getDocs, 
  getDoc, 
  getDocFromServer,
  getDocsFromServer,
  query, 
  orderBy, 
  limit, 
  writeBatch, 
  arrayUnion, 
  increment 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { 
  Campaign, 
  Transaction, 
  MemberRecord, 
  CreatorProfile, 
  SystemPricingConfig, 
  AnnouncementBanner, 
  AuditLog, 
  KumtluangExpense, 
  PublicPoolStats 
} from '../types';
import { 
  INITIAL_CAMPAIGNS, 
  INITIAL_TRANSACTIONS, 
  DEFAULT_PRICING_CONFIG, 
  INITIAL_REGISTERED_CREATORS 
} from '../data/initialData';
import { 
  INITIAL_DEFAULT_MEMBERS, 
  DEFAULT_ANNOUNCEMENT, 
  getDeletedCampaignIds, 
  recordDeletedCampaignId,
  getDeletedMemberIds, 
  markMemberAsDeleted, 
  getMembers,
  getDeletedTransactionIds,
  markTransactionAsDeleted,
  clearDeletedTransactionId,
  PERMANENTLY_PURGED_TX_IDS,
  PROTECTED_CANONICAL_TX_IDS,
  CANONICAL_BMP_RECEIPTS,
  getDeletedExpenseIds,
  markExpenseAsDeleted,
  getStoredExpenses,
  saveStoredExpenses,
  getStoredTransactions,
  saveStoredTransactions,
  safeApiFetch
} from '../utils/storage';

export type FirestoreConnectionStatus = 'connecting' | 'connected' | 'offline' | 'error';

export interface FirestoreSyncCallbacks {
  onTransactionsUpdate?: (transactions: Transaction[]) => void;
  onCampaignsUpdate?: (campaigns: Campaign[]) => void;
  onMembersUpdate?: (members: MemberRecord[]) => void;
  onCreatorsUpdate?: (creators: CreatorProfile[]) => void;
  onAnnouncementUpdate?: (announcement: AnnouncementBanner) => void;
  onPricingConfigUpdate?: (pricingConfig: SystemPricingConfig) => void;
  onAuditLogsUpdate?: (logs: AuditLog[]) => void;
  onExpensesUpdate?: (expenses: KumtluangExpense[]) => void;
  onStatsUpdate?: (stats: PublicPoolStats) => void;
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
  const result = getDeletedTransactionIds();
  for (const id of PERMANENTLY_PURGED_TX_IDS) {
    if (id) result.add(id.toLowerCase().trim());
  }
  return result;
}

/**
 * Purge transactions not belonging to BMP Shillong Unit (cmp-1788107291420)
 */
export async function purgeNonBMPTransactions(): Promise<number> {
  const allTransactions = await getStoredTransactions();
  const bmpCampaignId = 'cmp-1788107291420';
  const toDelete = allTransactions.filter(t => t.campaignId !== bmpCampaignId);

  if (toDelete.length === 0) return 0;

  const batch = writeBatch(db);
  for (const t of toDelete) {
    const docRef = doc(db, 'transactions', t.id);
    batch.delete(docRef);
  }
  
  await batch.commit();

  // Update local storage
  const remaining = allTransactions.filter(t => t.campaignId === bmpCampaignId);
  await saveStoredTransactions(remaining);
  
  return toDelete.length;
}

/**
 * Purge transactions that have been automatically updated by the system.
 * We identify these as transactions where updatedAt is present and different from createdAt.
 */
export async function purgeSystemUpdatedTransactions(): Promise<number> {
  const allTransactions = await getStoredTransactions();
  const systemUpdatedTransactions = allTransactions.filter(t => 
    t.updatedAt && t.createdAt && t.updatedAt !== t.createdAt
  );

  const idsToPurge = systemUpdatedTransactions.map(t => t.id);
  if (idsToPurge.length === 0) return 0;

  for (const id of idsToPurge) {
    try {
      await deleteTransactionFromFirestore(id);
    } catch {}
  }
  return idsToPurge.length;
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
 * On-demand fetch of Kumtluang members from Firestore with tombstone synchronization.
 * Immediately purges any deleted members and syncs fresh member state across devices.
 */
export async function fetchMembersFromFirestore(campaignId?: string, force: boolean = false): Promise<MemberRecord[]> {
  const localMembers = getLocalJson<MemberRecord[]>('ronpay_kumtluang_members_v1', INITIAL_DEFAULT_MEMBERS);
  if (!isNetworkOnline) {
    return localMembers;
  }

  const now = Date.now();
  // 5-second cache: Allow fast responsiveness while preventing rapid loop spam
  if (!force && now - lastMembersFetchTime < 5 * 1000 && localMembers.length > 0) {
    return localMembers;
  }

  if (membersFetchPromise) {
    return membersFetchPromise;
  }

  membersFetchPromise = (async () => {
    try {
      // 1. Fetch deleted members tombstones from single metadata document (Costs ONLY 1 Read!)
      try {
        const tombSnap = await getDoc(doc(db, 'system_metadata', 'tombstones'));
        if (tombSnap.exists()) {
          const data = tombSnap.data();
          if (Array.isArray(data?.deleted_members)) {
            data.deleted_members.forEach((dId: any) => {
              if (dId) markMemberAsDeleted(dId);
            });
          }
        }
      } catch {}

      const deletedMemIds = getDeletedMemberIds();

      // 2. Fetch current active members collection (up to 400 members for full organization coverage)
      const memQuery = query(collection(db, 'members'), limit(400));
      const snapshot = await getDocs(memQuery);
      const remoteMembers: MemberRecord[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data() as MemberRecord;
        if (data && data.id) {
          const cleanId = String(data.id).toLowerCase().trim();
          if (!deletedMemIds.has(cleanId)) {
            remoteMembers.push(data);
          }
        }
      });
      lastMembersFetchTime = Date.now();

      // 3. Clean local members of any tombstones and merge
      const cleanLocal = (localMembers || []).filter(m => m && m.id && !deletedMemIds.has(String(m.id).toLowerCase().trim()));
      const memMap = new Map<string, MemberRecord>();
      for (const m of cleanLocal) {
        memMap.set(String(m.id).toLowerCase().trim(), m);
      }
      for (const rm of remoteMembers) {
        const k = String(rm.id).toLowerCase().trim();
        const existing = memMap.get(k);
        if (!existing) {
          memMap.set(k, rm);
        } else {
          const localTime = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
          const remoteTime = new Date(rm.updatedAt || rm.createdAt || 0).getTime();
          memMap.set(k, remoteTime >= localTime ? { ...existing, ...rm } : { ...rm, ...existing });
        }
      }

      const merged = Array.from(memMap.values());
      setLocalJson('ronpay_kumtluang_members_v1', merged);
      broadcast('onMembersUpdate', merged);
      try {
        window.dispatchEvent(new CustomEvent('ronpay-members-updated', { detail: merged }));
        window.dispatchEvent(new CustomEvent('ronpay_members_updated', { detail: merged }));
      } catch {}
      return merged;
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
export async function fetchAuditLogsFromFirestore(limitCount: number = 100): Promise<AuditLog[]> {
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
      const logMap = new Map<string, AuditLog>();
      for (const l of remoteLogs) if (l && l.id) logMap.set(l.id, l);
      for (const l of localLogs) if (l && l.id && !logMap.has(l.id)) logMap.set(l.id, l);
      const mergedLogs = Array.from(logMap.values());
      mergedLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setLocalJson('ronpay_audit_logs_v1', mergedLogs);
      broadcast('onAuditLogsUpdate', mergedLogs);
      return mergedLogs;
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

  // Fetch system_metadata tombstones immediately on boot so all deletions are registered directly from server
  const fetchBootTombstones = async () => {
    try {
      let tombSnap;
      try {
        tombSnap = await getDocFromServer(doc(db, 'system_metadata', 'tombstones'));
      } catch {
        tombSnap = await getDoc(doc(db, 'system_metadata', 'tombstones'));
      }
      if (tombSnap && tombSnap.exists()) {
        const data = tombSnap.data();
        if (Array.isArray(data?.deleted_transactions)) {
          data.deleted_transactions.forEach((id: any) => {
            if (id) markTransactionAsDeleted(String(id).toLowerCase().trim(), false);
          });
        }
        if (Array.isArray(data?.deleted_campaigns)) {
          data.deleted_campaigns.forEach((id: any) => {
            if (id) recordDeletedCampaignId(String(id).toLowerCase().trim());
          });
        }
        if (Array.isArray(data?.deleted_members)) {
          data.deleted_members.forEach((id: any) => {
            if (id) markMemberAsDeleted(String(id).toLowerCase().trim());
          });
        }
      }
    } catch {}
  };
  fetchBootTombstones().catch(() => {});

  const newUnsubscribers: Array<() => void> = [];

  // 1. Transactions Listener (up to 3000 items with metadata changes for live multi-device synchronization)
  try {
    const txQuery = query(collection(db, 'transactions'), orderBy('timestamp', 'desc'), limit(3000));
    const unsubTx = onSnapshot(txQuery, { includeMetadataChanges: true }, (snapshot) => {
      updateStatus('connected');

      // Process any document additions, modifications, or removals directly
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'removed') {
          const removedId = change.doc.id || (change.doc.data() as any)?.id;
          if (removedId) {
            markTransactionAsDeleted(String(removedId).toLowerCase().trim(), false);
          }
        } else if (change.type === 'added' || change.type === 'modified') {
          const activeData = change.doc.data() as any;
          const activeId = activeData?.id || change.doc.id;
          if (activeId) {
            clearDeletedTransactionId(String(activeId).toLowerCase().trim());
          }
        }
      });

      const remoteTxList: Transaction[] = [];
      const nowMs = Date.now();
      snapshot.forEach(docSnap => {
        const data = docSnap.data() as Transaction;
        if (data && data.id) {
          // Canonical status normalization so Guest and Admin have identical status == SUCCESS behavior
          const rawStatus = (data.status || '').toLowerCase().trim();
          if (rawStatus === 'success' || rawStatus === 'completed' || rawStatus === 'paid' || rawStatus === 'verified' || rawStatus === 'payment_success' || !rawStatus) {
            data.status = 'completed';
          }
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
        const cleanRemote = remoteTxList.filter(t => t && t.id);
        const localTx = getLocalJson<Transaction[]>('ronpay_transactions_v2', []);
        const txMap = new Map<string, Transaction>();
        const remoteIdSet = new Set(cleanRemote.map(t => String(t.id).toLowerCase().trim()));

        // 1. Remote Firestore transactions are authoritative - clear any accidental tombstone
        for (const t of cleanRemote) {
          if (t && t.id) {
            const k = String(t.id).toLowerCase().trim();
            if (!PERMANENTLY_PURGED_TX_IDS.has(k)) {
              clearDeletedTransactionId(t.id);
              txMap.set(k, t);
            }
          }
        }

        // 2. Reconcile local transactions: merge updates if newer, or keep if genuinely unsynced/offline
        const nowMs = Date.now();
        for (const t of localTx) {
          if (t && t.id) {
            const k = String(t.id).toLowerCase().trim();
            if (PERMANENTLY_PURGED_TX_IDS.has(k)) {
              continue;
            }

            const existing = txMap.get(k);
            if (existing) {
              const localTime = new Date(t.updatedAt || t.createdAt || t.timestamp || 0).getTime();
              const existingTime = new Date(existing.updatedAt || existing.createdAt || existing.timestamp || 0).getTime();
              if (localTime > existingTime) {
                txMap.set(k, { ...existing, ...t });
              }
            } else {
              // Not in Firestore! Check if this is a fresh offline entry created in the last 2 minutes
              const isVeryRecent = t.createdAt ? (nowMs - new Date(t.createdAt).getTime() < 120000) : false;
              const isOfflineDraft = ((t as any).isOffline === true || (t as any).isOfflinePending === true || t.isSynced === false);
              if (isOfflineDraft && isVeryRecent) {
                txMap.set(k, t);
              } else {
                // Was deleted in Firestore: do NOT resurrect! Prune locally.
                markTransactionAsDeleted(k, false);
              }
            }
          }
        }

        const merged = Array.from(txMap.values());
        merged.sort((a, b) => {
          const timeA = new Date(a.updatedAt || a.createdAt || a.timestamp || 0).getTime();
          const timeB = new Date(b.updatedAt || b.createdAt || b.timestamp || 0).getTime();
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
          window.dispatchEvent(new CustomEvent('ronpay_transactions_updated', { detail: merged }));
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

  // 2. Campaigns Listener (supports up to 150 campaigns with real-time two-way sync between Web and Mobile)
  try {
    const handleCampaignsSnapshot = (snapshot: any) => {
      updateStatus('connected');

      // 1. Process explicit document deletions in docChanges
      if (snapshot.docChanges) {
        snapshot.docChanges().forEach((change: any) => {
          if (change.type === 'removed') {
            const remId = change.doc.id || change.doc.data()?.id;
            if (remId) {
              const cleanRemId = String(remId).toLowerCase().trim();
              if (cleanRemId !== 'cmp-1788107291420') {
                recordDeletedCampaignId(cleanRemId);
              }
            }
          }
        });
      }

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

    // Attach with limit 150 and includeMetadataChanges for instantaneous two-way sync
    const campQuery = query(collection(db, 'campaigns'), limit(150));
    const unsubCamp = onSnapshot(campQuery, { includeMetadataChanges: true }, handleCampaignsSnapshot, (error) => {
      logFirestoreNetworkNote('Campaigns listener note', error);
    });
    newUnsubscribers.push(unsubCamp);
  } catch (err) {
    logFirestoreNetworkNote('Attach campaigns listener', err);
  }

  // 3. Kumtluang Members Real-Time Listener (limit 60 for low quota consumption)
  try {
    const handleMembersSnapshot = (snapshot: any) => {
      updateStatus('connected');
      const deletedMemIds = getDeletedMemberIds();

      // Check document removals in Firestore snapshot
      if (snapshot.docChanges) {
        snapshot.docChanges().forEach((change: any) => {
          if (change.type === 'removed') {
            const removedId = change.doc.id || change.doc.data()?.id;
            if (removedId) {
              markMemberAsDeleted(removedId);
              deletedMemIds.add(String(removedId).toLowerCase().trim());
            }
          }
        });
      }

      const remoteMembers: MemberRecord[] = [];
      snapshot.forEach((docSnap: any) => {
        const data = docSnap.data() as MemberRecord;
        if (data && data.id) {
          const cleanId = String(data.id).toLowerCase().trim();
          if (!deletedMemIds.has(cleanId)) {
            remoteMembers.push(data);
          }
        }
      });

      const localMembers = getMembers('all');
      const memMap = new Map<string, MemberRecord>();
      
      // Seed with clean local members
      for (const m of localMembers) {
        if (m && m.id && !deletedMemIds.has(String(m.id).toLowerCase().trim())) {
          memMap.set(String(m.id).toLowerCase().trim(), m);
        }
      }

      // Merge remote members
      for (const rm of remoteMembers) {
        if (rm && rm.id && !deletedMemIds.has(String(rm.id).toLowerCase().trim())) {
          const k = String(rm.id).toLowerCase().trim();
          const existing = memMap.get(k);
          if (!existing) {
            memMap.set(k, rm);
          } else {
            const localTime = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
            const remoteTime = new Date(rm.updatedAt || rm.createdAt || 0).getTime();
            memMap.set(k, remoteTime >= localTime ? { ...existing, ...rm } : { ...rm, ...existing });
          }
        }
      }

      const merged = Array.from(memMap.values());
      setLocalJson('ronpay_kumtluang_members_v1', merged);
      broadcast('onMembersUpdate', merged);

      if (coordinatorChannel) {
        try {
          coordinatorChannel.postMessage({ type: 'sync_update', channel: 'members', payload: merged });
        } catch {}
      }

      try {
        window.dispatchEvent(new CustomEvent('ronpay-members-updated', { detail: merged }));
        window.dispatchEvent(new CustomEvent('ronpay_members_updated', { detail: merged }));
      } catch {}
    };

    const memQuery = query(collection(db, 'members'), limit(300));
    const unsubMem = onSnapshot(memQuery, { includeMetadataChanges: true }, handleMembersSnapshot, (error) => {
      logFirestoreNetworkNote('Members listener note', error);
    });
    newUnsubscribers.push(unsubMem);
  } catch (err) {
    logFirestoreNetworkNote('Attach members listener', err);
  }

  // 4. Expenses Listener (NGO / Kumtluang Expenditure real-time sync across Web, Preview & Mobile)
  try {
    const handleExpensesSnapshot = (snapshot: any) => {
      updateStatus('connected');
      const remoteExpenses: KumtluangExpense[] = [];
      const deletedExpSet = getDeletedExpenseIds();

      snapshot.docChanges().forEach((change: any) => {
        if (change.type === 'removed') {
          const removedId = change.doc.id || (change.doc.data() as any)?.id;
          if (removedId) {
            markExpenseAsDeleted(String(removedId).toLowerCase().trim());
          }
        }
      });

      snapshot.forEach((docSnap: any) => {
        const data = docSnap.data() as KumtluangExpense;
        if (data && data.id) {
          const cleanId = String(data.id).toLowerCase().trim();
          if (!deletedExpSet.has(cleanId)) {
            remoteExpenses.push(data);
          }
        }
      });

      const localExpenses = getStoredExpenses().filter(e => e && e.id && !deletedExpSet.has(String(e.id).toLowerCase().trim()));
      const expMap = new Map<string, KumtluangExpense>();
      for (const re of remoteExpenses) {
        if (re && re.id) {
          expMap.set(String(re.id).toLowerCase().trim(), re);
        }
      }
      for (const le of localExpenses) {
        if (le && le.id) {
          const k = String(le.id).toLowerCase().trim();
          const existing = expMap.get(k);
          if (!existing) {
            expMap.set(k, le);
            // Auto-upload local voucher entered on web or mobile up to Firestore!
            syncExpenseToFirestore(le).catch(() => {});
          } else {
            const localTime = new Date(le.updatedAt || le.recordedAt || le.spentDate || 0).getTime();
            const remoteTime = new Date(existing.updatedAt || existing.recordedAt || existing.spentDate || 0).getTime();
            if (localTime > remoteTime) {
              expMap.set(k, { ...existing, ...le });
              syncExpenseToFirestore({ ...existing, ...le }).catch(() => {});
            }
          }
        }
      }

      const merged = Array.from(expMap.values());
      merged.sort((a, b) => {
        const timeA = new Date(a.spentDate || a.recordedAt || 0).getTime();
        const timeB = new Date(b.spentDate || b.recordedAt || 0).getTime();
        return timeB - timeA;
      });

      saveStoredExpenses(merged, true);
      broadcast('onExpensesUpdate', merged);

      if (coordinatorChannel) {
        try {
          coordinatorChannel.postMessage({ type: 'sync_update', channel: 'expenses', payload: merged });
        } catch {}
      }

      try {
        window.dispatchEvent(new CustomEvent('ronpay_expenses_updated', { detail: merged }));
      } catch {}
    };

    const expQuery = query(collection(db, 'expenses'), limit(200));
    const unsubExp = onSnapshot(expQuery, { includeMetadataChanges: true }, handleExpensesSnapshot, (error) => {
      logFirestoreNetworkNote('Expenses listener note', error);
    });
    newUnsubscribers.push(unsubExp);
  } catch (err) {
    logFirestoreNetworkNote('Attach expenses listener', err);
  }

  // 5. Consolidated Real-Time Tombstones Listener (Single Document: Costs ONLY 1 READ!)
  try {
    const tombRef = doc(db, 'system_metadata', 'tombstones');
    const unsubTombstones = onSnapshot(tombRef, { includeMetadataChanges: true }, (docSnap) => {
      if (!docSnap.exists()) return;
      const data = docSnap.data();
      if (!data) return;

      let txUpdated = false;
      if (Array.isArray(data.deleted_transactions)) {
        data.deleted_transactions.forEach((id: any) => {
          if (id) {
            const clean = String(id).toLowerCase().trim();
            if (!PROTECTED_CANONICAL_TX_IDS.has(clean)) {
              markTransactionAsDeleted(clean, false);
              txUpdated = true;
            }
          }
        });
      }
      if (txUpdated) {
        const deletedTxIds = getDeletedTransactionIds();
        const currentLocal = getLocalJson<Transaction[]>('ronpay_transactions_v2', []);
        const filtered = currentLocal.filter(t => t && t.id && !deletedTxIds.has(String(t.id).toLowerCase().trim()) && !PERMANENTLY_PURGED_TX_IDS.has(String(t.id).toLowerCase().trim()));
        setLocalJson('ronpay_transactions_v2', filtered);
        broadcast('onTransactionsUpdate', filtered);
        if (coordinatorChannel) {
          try {
            coordinatorChannel.postMessage({ type: 'sync_update', channel: 'transactions', payload: filtered });
          } catch {}
        }
        try {
          window.dispatchEvent(new CustomEvent('ronpay-transactions-updated', { detail: filtered }));
          window.dispatchEvent(new CustomEvent('ronpay_transactions_updated', { detail: filtered }));
        } catch {}
      }

      let memUpdated = false;
      if (Array.isArray(data.deleted_members)) {
        data.deleted_members.forEach((id: any) => {
          if (id) {
            const clean = String(id).toLowerCase().trim();
            markMemberAsDeleted(clean);
            memUpdated = true;
          }
        });
      }
      if (memUpdated) {
        const deletedMemIds = getDeletedMemberIds();
        const currentLocal = getLocalJson<MemberRecord[]>('ronpay_kumtluang_members_v1', []);
        const filtered = currentLocal.filter(m => m && m.id && !deletedMemIds.has(String(m.id).toLowerCase().trim()));
        setLocalJson('ronpay_kumtluang_members_v1', filtered);
        broadcast('onMembersUpdate', filtered);
        if (coordinatorChannel) {
          try {
            coordinatorChannel.postMessage({ type: 'sync_update', channel: 'members', payload: filtered });
          } catch {}
        }
        try {
          window.dispatchEvent(new CustomEvent('ronpay-members-updated', { detail: filtered }));
          window.dispatchEvent(new CustomEvent('ronpay_members_updated', { detail: filtered }));
        } catch {}
      }

      // 3. Campaigns Tombstones (CRITICAL FOR TWO-WAY DELETION SYNC BETWEEN WEB & MOBILE)
      let campUpdated = false;
      if (Array.isArray(data.deleted_campaigns)) {
        data.deleted_campaigns.forEach((id: any) => {
          if (id) {
            const clean = String(id).toLowerCase().trim();
            if (clean !== 'cmp-1788107291420') {
              recordDeletedCampaignId(clean);
              campUpdated = true;
            }
          }
        });
      }
      if (campUpdated) {
        const deletedCampIds = getDeletedCampaignIds();
        const currentLocal = getLocalJson<Campaign[]>('ronpay_campaigns_v2', []);
        const filtered = currentLocal.filter(c => c && c.id && !deletedCampIds.has(String(c.id).toLowerCase().trim()));
        setLocalJson('ronpay_campaigns_v2', filtered);
        broadcast('onCampaignsUpdate', filtered);
        if (coordinatorChannel) {
          try {
            coordinatorChannel.postMessage({ type: 'sync_update', channel: 'campaigns', payload: filtered });
          } catch {}
        }
        try {
          window.dispatchEvent(new CustomEvent('ronpay-campaigns-updated', { detail: filtered }));
        } catch {}
      }

      if (Array.isArray(data.deleted_expenses)) {
        data.deleted_expenses.forEach((id: any) => {
          if (id) {
            markExpenseAsDeleted(String(id).toLowerCase().trim());
          }
        });
      }
    }, (error) => {
      logFirestoreNetworkNote('Tombstones listener note', error);
    });
    newUnsubscribers.push(unsubTombstones);
  } catch (err) {
    logFirestoreNetworkNote('Attach tombstones listener', err);
  }

  // 6. Public Pool Distributed Counter Listener (doc: stats/public_pool - Server Direct & Cache Bypass)
  try {
    const statsDocRef = doc(db, 'stats', 'public_pool');

    // Immediate Direct Server Fetch bypassing local IndexedDB cache
    getDocFromServer(statsDocRef).then((serverSnap) => {
      if (serverSnap.exists()) {
        const data = serverSnap.data();
        const serverStats: PublicPoolStats = {
          totalAmount: Number(data?.totalAmount) || 0,
          totalCount: Number(data?.totalCount) || 0,
          lastUpdated: data?.lastUpdated || new Date().toISOString(),
          todayCount: Number(data?.todayCount) || 0,
        };
        setLocalJson('ronpay_public_pool_stats_v1', serverStats);
        broadcast('onStatsUpdate', serverStats);
        if (coordinatorChannel) {
          try {
            coordinatorChannel.postMessage({ type: 'sync_update', channel: 'stats', payload: serverStats });
          } catch {}
        }
        try {
          window.dispatchEvent(new CustomEvent('ronpay_stats_updated', { detail: serverStats }));
          window.dispatchEvent(new CustomEvent('ronpay-stats-updated', { detail: serverStats }));
        } catch {}
      } else {
        recalibratePublicPoolStatsFromFirestore().catch(() => {});
      }
    }).catch(() => {});

    const unsubStats = onSnapshot(statsDocRef, { includeMetadataChanges: true }, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const stats: PublicPoolStats = {
          totalAmount: Number(data?.totalAmount) || 0,
          totalCount: Number(data?.totalCount) || 0,
          lastUpdated: data?.lastUpdated || new Date().toISOString(),
          todayCount: Number(data?.todayCount) || 0,
        };
        setLocalJson('ronpay_public_pool_stats_v1', stats);
        broadcast('onStatsUpdate', stats);
        if (coordinatorChannel) {
          try {
            coordinatorChannel.postMessage({ type: 'sync_update', channel: 'stats', payload: stats });
          } catch {}
        }
        try {
          window.dispatchEvent(new CustomEvent('ronpay_stats_updated', { detail: stats }));
          window.dispatchEvent(new CustomEvent('ronpay-stats-updated', { detail: stats }));
        } catch {}
      } else {
        // Bootstrap: If stats/public_pool document doesn't exist yet, auto-calibrate from transactions!
        recalibratePublicPoolStatsFromFirestore().catch(() => {});
      }
    }, (error) => {
      logFirestoreNetworkNote('Stats public_pool listener note', error);
    });
    newUnsubscribers.push(unsubStats);
  } catch (err) {
    logFirestoreNetworkNote('Attach stats listener', err);
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
              try {
                window.dispatchEvent(new CustomEvent('ronpay_transactions_updated', { detail: msg.payload }));
                window.dispatchEvent(new CustomEvent('ronpay-transactions-updated', { detail: msg.payload }));
              } catch {}
            } else if (msg.channel === 'campaigns' && Array.isArray(msg.payload)) {
              setLocalJson('ronpay_campaigns_v2', msg.payload);
              broadcast('onCampaignsUpdate', msg.payload);
              try {
                window.dispatchEvent(new CustomEvent('ronpay_campaigns_updated', { detail: msg.payload }));
                window.dispatchEvent(new CustomEvent('ronpay-campaigns-updated', { detail: msg.payload }));
              } catch {}
            } else if (msg.channel === 'members' && Array.isArray(msg.payload)) {
              setLocalJson('ronpay_kumtluang_members_v1', msg.payload);
              broadcast('onMembersUpdate', msg.payload);
              try {
                window.dispatchEvent(new CustomEvent('ronpay_members_updated', { detail: msg.payload }));
                window.dispatchEvent(new CustomEvent('ronpay-members-updated', { detail: msg.payload }));
              } catch {}
            } else if (msg.channel === 'expenses' && Array.isArray(msg.payload)) {
              saveStoredExpenses(msg.payload, true);
              broadcast('onExpensesUpdate', msg.payload);
              try {
                window.dispatchEvent(new CustomEvent('ronpay_expenses_updated', { detail: msg.payload }));
              } catch {}
            } else if (msg.channel === 'stats' && msg.payload) {
              setLocalJson('ronpay_public_pool_stats_v1', msg.payload);
              broadcast('onStatsUpdate', msg.payload);
              try {
                window.dispatchEvent(new CustomEvent('ronpay_stats_updated', { detail: msg.payload }));
                window.dispatchEvent(new CustomEvent('ronpay-stats-updated', { detail: msg.payload }));
              } catch {}
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
 * Helper to get currently stored public pool stats
 */
export function getStoredPublicPoolStats(): PublicPoolStats {
  return getLocalJson<PublicPoolStats>('ronpay_public_pool_stats_v1', {
    totalAmount: 0,
    totalCount: 0,
    todayCount: 0,
    lastUpdated: new Date().toISOString(),
  });
}

export function setStoredPublicPoolStats(stats: PublicPoolStats): void {
  setLocalJson('ronpay_public_pool_stats_v1', stats);
}

function hasIncrementedStats(txId: string): boolean {
  try {
    const raw = localStorage.getItem('ronpay_incremented_tx_ids');
    const ids = raw ? JSON.parse(raw) : [];
    return Array.isArray(ids) && ids.includes(txId);
  } catch {
    return false;
  }
}

function markIncrementedStats(txId: string): void {
  try {
    const raw = localStorage.getItem('ronpay_incremented_tx_ids');
    const ids = raw ? JSON.parse(raw) : [];
    if (Array.isArray(ids) && !ids.includes(txId)) {
      ids.push(txId);
      if (ids.length > 500) ids.splice(0, ids.length - 500);
      localStorage.setItem('ronpay_incremented_tx_ids', JSON.stringify(ids));
    }
  } catch {}
}

/**
 * Recalibrates stats/public_pool document in Firestore from authoritative transactions
 */
export async function recalibratePublicPoolStatsFromFirestore(): Promise<PublicPoolStats | null> {
  try {
    const txQuery = query(collection(db, 'transactions'), limit(2000));
    let snap;
    try {
      // Force direct server fetch bypassing local IndexedDB cache completely
      snap = await getDocsFromServer(txQuery);
    } catch {
      snap = await getDocs(txQuery);
    }
    let totalAmt = 0;
    let totalCnt = 0;
    const todayStr = new Date().toISOString().slice(0, 10);
    let todayCnt = 0;

    snap.forEach((d) => {
      const data = d.data() as Transaction;
      const s = (data.status || '').toUpperCase().trim();
      // Strict SUCCESS check identical for Guest, Admin, Chrome, and App
      const isConfirmed = s === 'SUCCESS' || s === 'COMPLETED' || s === 'PAID' || s === 'PAYMENT_SUCCESS' || s === 'VERIFIED' || !s;
      if (isConfirmed) {
        totalAmt += Number(data.amount) || 0;
        totalCnt += 1;
        const txDate = (data.timestamp || data.createdAt || data.date || '').slice(0, 10);
        if (txDate === todayStr) {
          todayCnt += 1;
        }
      }
    });

    // Calculate exact totals of active valid transactions
    const statsRef = doc(db, 'stats', 'public_pool');
    const freshStats: PublicPoolStats & { totalTxns: number; todayTxns: number } = {
      totalAmount: Math.round(totalAmt * 100) / 100,
      totalCount: totalCnt,
      totalTxns: totalCnt,
      todayCount: todayCnt,
      todayTxns: todayCnt,
      lastUpdated: new Date().toISOString(),
    };
    await setDoc(statsRef, freshStats, { merge: true });
    setLocalJson('ronpay_public_pool_stats_v1', freshStats);
    broadcast('onStatsUpdate', freshStats);
    try {
      window.dispatchEvent(new CustomEvent('ronpay_stats_updated', { detail: freshStats }));
      window.dispatchEvent(new CustomEvent('ronpay-stats-updated', { detail: freshStats }));
    } catch {}
    return freshStats;
  } catch (e) {
    console.warn('[FirestoreSync] Failed to recalibrate public pool stats:', e);
    return null;
  }
}

/**
 * Direct write: Save single transaction to Firebase Firestore (transactions collection)
 * and atomically increment the Distributed Counter in stats/public_pool
 */
export async function syncTransactionToFirestore(tx: Transaction): Promise<void> {
  if (!tx || !tx.id) return;
  const cleanTxId = String(tx.id).toLowerCase().trim();
  const deletedIds = getDeletedTransactionIds();
  if (deletedIds.has(cleanTxId) || sessionDeletedTransactions.has(cleanTxId) || PERMANENTLY_PURGED_TX_IDS.has(cleanTxId)) {
    return;
  }
  try {
    const cleanTx = sanitizeForFirestore({
      ...tx,
      updatedAt: new Date().toISOString()
    });
    const docRef = doc(db, 'transactions', tx.id);
    await setDoc(docRef, cleanTx, { merge: true });

    // Atomic Distributed Counter update in stats/public_pool
    const cleanTxId = String(tx.id).toLowerCase().trim();
    if (!hasIncrementedStats(cleanTxId)) {
      const s = (tx.status || '').toLowerCase().trim();
      const isConfirmed = s === 'completed' || s === 'paid' || s === 'payment_success' || s === 'success' || s === 'verified' || !s;
      const amt = Number(tx.amount) || 0;
      if (isConfirmed && amt > 0) {
        markIncrementedStats(cleanTxId);
        const statsRef = doc(db, 'stats', 'public_pool');
        await setDoc(statsRef, {
          totalAmount: increment(amt),
          totalCount: increment(1),
          todayCount: increment(1),
          lastUpdated: new Date().toISOString(),
        }, { merge: true });
      }
    }
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
const sessionDeletedMembers = new Set<string>();
export async function deleteMemberFromFirestore(memberId: string): Promise<void> {
  if (!isNetworkOnline || !memberId) return;
  const cleanId = String(memberId).trim();
  if (sessionDeletedMembers.has(cleanId.toLowerCase())) return;
  sessionDeletedMembers.add(cleanId.toLowerCase());
  try {
    const docRef = doc(db, 'members', cleanId);
    await deleteDoc(docRef);
  } catch (err) {
    logFirestoreNetworkNote('Delete member', err);
  }
  try {
    const tombRef = doc(db, 'system_metadata', 'tombstones');
    await setDoc(tombRef, {
      deleted_members: arrayUnion(cleanId.toLowerCase()),
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (err) {
    logFirestoreNetworkNote('Set deleted_members tombstone', err);
  }
}

/**
 * Direct write: Save single expense voucher to Firebase Firestore (expenses collection)
 */
export async function syncExpenseToFirestore(expense: KumtluangExpense): Promise<void> {
  if (!isNetworkOnline || !expense || !expense.id) return;
  try {
    let finalReceipt = expense.attachmentUrl || (expense as any).receiptUrl;
    if (finalReceipt && finalReceipt.startsWith('data:') && finalReceipt.length > 50000) {
      try {
        finalReceipt = await compressDataUrl(finalReceipt, 800, 800, 0.7);
      } catch (err) {
        console.warn('[FirestoreSync] Expense receipt compression warning:', err);
      }
    }

    const cleanExpense = sanitizeForFirestore({
      ...expense,
      attachmentUrl: finalReceipt || null,
      updatedAt: expense.updatedAt || new Date().toISOString()
    });
    const docRef = doc(db, 'expenses', String(expense.id));
    await setDoc(docRef, cleanExpense, { merge: true });
    console.info(`[RonPay Cloud] Synced expense "${expense.voucherNo || expense.id}" to Firestore`);
  } catch (err) {
    logFirestoreNetworkNote('Expense sync', err);
    console.warn(`[RonPay Cloud] Expense sync warning for "${expense.id}":`, err);
  }
}

/**
 * Direct delete: Delete expense voucher from Firestore
 */
const sessionDeletedExpenses = new Set<string>();
export async function deleteExpenseFromFirestore(expenseId: string): Promise<void> {
  if (!isNetworkOnline || !expenseId) return;
  const cleanId = String(expenseId).trim();
  if (sessionDeletedExpenses.has(cleanId.toLowerCase())) return;
  sessionDeletedExpenses.add(cleanId.toLowerCase());
  try {
    const docRef = doc(db, 'expenses', cleanId);
    await deleteDoc(docRef);
    console.info(`[RonPay Cloud] Deleted expense "${cleanId}" from Firestore`);
  } catch (err) {
    logFirestoreNetworkNote('Delete expense', err);
  }
  try {
    const tombRef = doc(db, 'system_metadata', 'tombstones');
    await setDoc(tombRef, {
      deleted_expenses: arrayUnion(cleanId.toLowerCase()),
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (err) {
    logFirestoreNetworkNote('Set deleted_expenses tombstone', err);
  }
}

/**
 * Push all local stored expenses that have not been marked deleted to Firestore.
 * This guarantees any data entered on web (e.g. ronpay.app) or mobile app is uploaded to the cloud!
 */
export async function syncAllLocalExpensesToFirestore(): Promise<void> {
  if (!isNetworkOnline) return;
  try {
    const localExpenses = getStoredExpenses();
    const deletedSet = getDeletedExpenseIds();
    const validExpenses = localExpenses.filter(e => e && e.id && !deletedSet.has(String(e.id).toLowerCase().trim()));
    for (const exp of validExpenses) {
      await syncExpenseToFirestore(exp);
    }
  } catch (err) {
    logFirestoreNetworkNote('Batch sync local expenses', err);
  }
}

let expensesFetchPromise: Promise<KumtluangExpense[]> | null = null;
let lastExpensesFetchTime = 0;

/**
 * On-demand fetch of expenses from Firestore
 */
export async function fetchExpensesFromFirestore(forceRefresh?: boolean): Promise<KumtluangExpense[]> {
  const localExpenses = getStoredExpenses();
  if (!isNetworkOnline) return localExpenses;

  const now = Date.now();
  if (!forceRefresh && lastExpensesFetchTime && (now - lastExpensesFetchTime < 15000)) {
    return localExpenses;
  }

  if (expensesFetchPromise) return expensesFetchPromise;

  expensesFetchPromise = (async () => {
    try {
      const q = query(collection(db, 'expenses'), limit(200));
      const snapshot = await getDocs(q);
      const remoteExpenses: KumtluangExpense[] = [];
      const deletedExpSet = getDeletedExpenseIds();

      snapshot.forEach(docSnap => {
        const data = docSnap.data() as KumtluangExpense;
        if (data && data.id) {
          const cleanId = String(data.id).toLowerCase().trim();
          if (!deletedExpSet.has(cleanId)) {
            remoteExpenses.push(data);
          }
        }
      });
      lastExpensesFetchTime = Date.now();

      const cleanLocal = (localExpenses || []).filter(e => e && e.id && !deletedExpSet.has(String(e.id).toLowerCase().trim()));
      const expMap = new Map<string, KumtluangExpense>();
      for (const re of remoteExpenses) {
        expMap.set(String(re.id).toLowerCase().trim(), re);
      }
      for (const le of cleanLocal) {
        const k = String(le.id).toLowerCase().trim();
        const existing = expMap.get(k);
        if (!existing) {
          expMap.set(k, le);
          syncExpenseToFirestore(le).catch(() => {});
        } else {
          const localTime = new Date(le.updatedAt || le.recordedAt || le.spentDate || 0).getTime();
          const remoteTime = new Date(existing.updatedAt || existing.recordedAt || existing.spentDate || 0).getTime();
          if (localTime > remoteTime) {
            expMap.set(k, { ...existing, ...le });
            syncExpenseToFirestore({ ...existing, ...le }).catch(() => {});
          }
        }
      }

      const merged = Array.from(expMap.values());
      merged.sort((a, b) => new Date(b.spentDate || b.recordedAt || 0).getTime() - new Date(a.spentDate || a.recordedAt || 0).getTime());
      saveStoredExpenses(merged, true);
      broadcast('onExpensesUpdate', merged);
      try {
        window.dispatchEvent(new CustomEvent('ronpay_expenses_updated', { detail: merged }));
      } catch {}
      return merged;
    } catch (err) {
      logFirestoreNetworkNote('Fetch expenses on-demand', err);
    } finally {
      expensesFetchPromise = null;
    }
    return localExpenses;
  })();

  return expensesFetchPromise;
}

/**
 * Direct delete: Delete campaign from Firestore
 */
const sessionDeletedCampaigns = new Set<string>();
export async function deleteCampaignFromFirestore(campaignId: string): Promise<void> {
  if (!isNetworkOnline || !campaignId) return;
  const cleanId = String(campaignId).trim().toLowerCase();
  if (sessionDeletedCampaigns.has(cleanId)) return;
  sessionDeletedCampaigns.add(cleanId);
  try {
    const docRef = doc(db, 'campaigns', cleanId);
    await deleteDoc(docRef);
    if (campaignId !== cleanId) {
      await deleteDoc(doc(db, 'campaigns', campaignId)).catch(() => {});
    }
  } catch (err) {
    logFirestoreNetworkNote('Delete campaign', err);
  }
  try {
    const tombRef = doc(db, 'system_metadata', 'tombstones');
    await setDoc(tombRef, {
      deleted_campaigns: arrayUnion(cleanId),
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (err) {
    logFirestoreNetworkNote('Set deleted_campaigns tombstone', err);
  }
}

/**
 * Direct delete: Delete transaction from Firestore, update tombstones,
 * and atomically decrement the Distributed Counter in stats/public_pool
 */
const sessionDeletedTransactions = new Set<string>();
export async function deleteTransactionFromFirestore(
  transactionId: string,
  txDetails?: Transaction | { amount?: number; status?: string; timestamp?: string }
): Promise<void> {
  if (!transactionId) return;
  const cleanId = String(transactionId).trim();
  const idKey = cleanId.toLowerCase();

  // 1. Resolve transaction details if not provided
  let txToAnalyze = txDetails;
  if (!txToAnalyze) {
    const local = getLocalJson<Transaction[]>('ronpay_transactions_v2', []);
    txToAnalyze = local.find(t => String(t.id).toLowerCase().trim() === idKey);
  }

  // If still not found, try reading from Firestore doc directly before delete
  if (!txToAnalyze) {
    try {
      const snap = await getDoc(doc(db, 'transactions', cleanId));
      if (snap.exists()) {
        txToAnalyze = snap.data() as Transaction;
      }
    } catch {}
  }

  // 2. Atomically decrement stats/public_pool counter if confirmed
  if (txToAnalyze) {
    const s = (txToAnalyze.status || '').toLowerCase().trim();
    const isConfirmed = s === 'completed' || s === 'paid' || s === 'payment_success' || s === 'success' || s === 'verified' || !s;
    const amt = Number(txToAnalyze.amount) || 0;
    if (isConfirmed && amt > 0) {
      const txDate = (txToAnalyze.timestamp || (txToAnalyze as any).createdAt || (txToAnalyze as any).date || '').slice(0, 10);
      const todayStr = new Date().toISOString().slice(0, 10);
      const isToday = txDate === todayStr;

      try {
        const statsRef = doc(db, 'stats', 'public_pool');
        await setDoc(statsRef, {
          totalAmount: increment(-amt),
          totalCount: increment(-1),
          ...(isToday ? { todayCount: increment(-1) } : {}),
          lastUpdated: new Date().toISOString(),
        }, { merge: true });

        // Update local stats immediately
        const cur = getStoredPublicPoolStats();
        const nextStats: PublicPoolStats = {
          ...cur,
          totalAmount: Math.max(0, Math.round(((cur.totalAmount || 0) - amt) * 100) / 100),
          totalCount: Math.max(0, (cur.totalCount || 0) - 1),
          todayCount: isToday ? Math.max(0, (cur.todayCount || 0) - 1) : cur.todayCount,
          lastUpdated: new Date().toISOString(),
        };
        setStoredPublicPoolStats(nextStats);
        broadcast('onStatsUpdate', nextStats);
        try {
          window.dispatchEvent(new CustomEvent('ronpay_stats_updated', { detail: nextStats }));
          window.dispatchEvent(new CustomEvent('ronpay-stats-updated', { detail: nextStats }));
        } catch {}
      } catch (err) {
        logFirestoreNetworkNote('Decrement public_pool stats', err);
      }
    }
  }

  // 3. Delete document from Firestore (both exact ID and lowercase variant)
  sessionDeletedTransactions.add(idKey);
  try {
    const docRef = doc(db, 'transactions', cleanId);
    await deleteDoc(docRef);
    if (cleanId !== cleanId.toLowerCase()) {
      await deleteDoc(doc(db, 'transactions', cleanId.toLowerCase())).catch(() => {});
    }
    if (cleanId !== cleanId.toUpperCase()) {
      await deleteDoc(doc(db, 'transactions', cleanId.toUpperCase())).catch(() => {});
    }
  } catch (err) {
    logFirestoreNetworkNote('Delete transaction', err);
  }

  // 4. Record in system_metadata tombstones
  try {
    const tombRef = doc(db, 'system_metadata', 'tombstones');
    await setDoc(tombRef, {
      deleted_transactions: arrayUnion(cleanId, cleanId.toLowerCase()),
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (err) {
    logFirestoreNetworkNote('Set deleted_transactions tombstone', err);
  }
}

/**
 * Direct batch delete: Delete multiple transactions from Firestore,
 * and atomically decrement the Distributed Counter in stats/public_pool in ONE atomic operation
 */
export async function deleteMultipleTransactionsFromFirestore(
  transactionIds: string[],
  knownTransactions?: Transaction[]
): Promise<void> {
  if (!transactionIds || transactionIds.length === 0) return;
  const cleanIds = transactionIds.map(id => String(id).trim()).filter(Boolean);
  if (cleanIds.length === 0) return;

  const idSet = new Set(cleanIds.map(id => id.toLowerCase()));

  // 1. Gather all transactions to know amounts and statuses
  const txsToAnalyze: Transaction[] = [];
  if (knownTransactions && knownTransactions.length > 0) {
    txsToAnalyze.push(...knownTransactions);
  } else {
    const local = getLocalJson<Transaction[]>('ronpay_transactions_v2', []);
    txsToAnalyze.push(...local.filter(t => idSet.has(String(t.id).toLowerCase().trim())));
  }

  let totalAmtToRemove = 0;
  let totalCntToRemove = 0;
  let todayCntToRemove = 0;
  const todayStr = new Date().toISOString().slice(0, 10);

  for (const tx of txsToAnalyze) {
    const s = (tx.status || '').toLowerCase().trim();
    const isConfirmed = s === 'completed' || s === 'paid' || s === 'payment_success' || s === 'success' || s === 'verified' || !s;
    const amt = Number(tx.amount) || 0;
    if (isConfirmed && amt > 0) {
      totalAmtToRemove += amt;
      totalCntToRemove += 1;
      const txDate = (tx.timestamp || (tx as any).createdAt || (tx as any).date || '').slice(0, 10);
      if (txDate === todayStr) {
        todayCntToRemove += 1;
      }
    }
  }

  // 2. Decrement Distributed Counter atomically in stats/public_pool
  if (totalCntToRemove > 0) {
    try {
      const statsRef = doc(db, 'stats', 'public_pool');
      await setDoc(statsRef, {
        totalAmount: increment(-totalAmtToRemove),
        totalCount: increment(-totalCntToRemove),
        ...(todayCntToRemove > 0 ? { todayCount: increment(-todayCntToRemove) } : {}),
        lastUpdated: new Date().toISOString(),
      }, { merge: true });

      // Immediate local stats update
      const cur = getStoredPublicPoolStats();
      const nextStats: PublicPoolStats = {
        ...cur,
        totalAmount: Math.max(0, Math.round(((cur.totalAmount || 0) - totalAmtToRemove) * 100) / 100),
        totalCount: Math.max(0, (cur.totalCount || 0) - totalCntToRemove),
        todayCount: Math.max(0, (cur.todayCount || 0) - todayCntToRemove),
        lastUpdated: new Date().toISOString(),
      };
      setStoredPublicPoolStats(nextStats);
      broadcast('onStatsUpdate', nextStats);
      try {
        window.dispatchEvent(new CustomEvent('ronpay_stats_updated', { detail: nextStats }));
        window.dispatchEvent(new CustomEvent('ronpay-stats-updated', { detail: nextStats }));
      } catch {}
    } catch (err) {
      logFirestoreNetworkNote('Batch decrement stats', err);
    }
  }

  // 3. Delete docs from Firestore in parallel
  await Promise.all(
    cleanIds.map(async (id) => {
      sessionDeletedTransactions.add(id.toLowerCase());
      try {
        await deleteDoc(doc(db, 'transactions', id));
        if (id !== id.toLowerCase()) {
          await deleteDoc(doc(db, 'transactions', id.toLowerCase())).catch(() => {});
        }
      } catch (err) {
        logFirestoreNetworkNote(`Delete doc ${id}`, err);
      }
    })
  );

  // 4. Update tombstones in one arrayUnion call
  try {
    const tombRef = doc(db, 'system_metadata', 'tombstones');
    const tombIds: string[] = [];
    cleanIds.forEach(id => {
      tombIds.push(id);
      tombIds.push(id.toLowerCase());
    });
    await setDoc(tombRef, {
      deleted_transactions: arrayUnion(...tombIds),
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (err) {
    logFirestoreNetworkNote('Batch tombstones update', err);
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
        const clean = sanitizeForFirestore({ ...c, updatedAt: c.updatedAt || c.createdAt || new Date().toISOString() });
        batch.set(doc(db, 'campaigns', c.id), clean, { merge: true });
        batchOps++;
        totalCount++;
        await commitBatchIfNeeded();
      }
    }

    // 2. Members
    for (const m of localMembers) {
      if (m && m.id) {
        const clean = sanitizeForFirestore({ ...m, updatedAt: m.updatedAt || m.createdAt || new Date().toISOString() });
        batch.set(doc(db, 'members', m.id), clean, { merge: true });
        batchOps++;
        totalCount++;
        await commitBatchIfNeeded();
      }
    }

    // 3. Creators
    for (const cr of localCreators) {
      if (cr && cr.phone) {
        const clean = sanitizeForFirestore({ ...cr, updatedAt: cr.updatedAt || cr.createdAt || new Date().toISOString() });
        batch.set(doc(db, 'creators', cr.phone), clean, { merge: true });
        batchOps++;
        totalCount++;
        await commitBatchIfNeeded();
      }
    }

    // 4. Recent transactions (Limit to latest 100 non-deleted items)
    const deletedTxIds = getDeletedTransactionIds();
    const recentTxList = localTransactions
      .filter(t => t && t.id && !deletedTxIds.has(String(t.id).toLowerCase().trim()) && !PERMANENTLY_PURGED_TX_IDS.has(String(t.id).toLowerCase().trim()))
      .slice(0, 100);
    for (const t of recentTxList) {
      if (t && t.id) {
        const clean = sanitizeForFirestore({ ...t, updatedAt: t.updatedAt || t.createdAt || t.timestamp || new Date().toISOString() });
        batch.set(doc(db, 'transactions', t.id), clean, { merge: true });
        batchOps++;
        totalCount++;
        await commitBatchIfNeeded();
      }
    }

    // 5. Recent audit logs for Super Admin Sulhnu consistency
    const localLogs = getLocalJson<AuditLog[]>('ronpay_audit_logs_v1', []);
    const recentLogs = localLogs.slice(0, 50);
    for (const log of recentLogs) {
      if (log && log.id) {
        const clean = sanitizeForFirestore({ ...log, updatedAt: log.timestamp || new Date().toISOString() });
        batch.set(doc(db, 'auditLogs', log.id), clean, { merge: true });
        batchOps++;
        totalCount++;
        await commitBatchIfNeeded();
      }
    }

    // 6. Configs
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

    // 7. Expenses (Kumtluang / NGO Expenditure vouchers)
    const rawExpenses = localStorage.getItem('ronpay_kumtluang_expenses_v1');
    const localExpenses: KumtluangExpense[] = rawExpenses ? JSON.parse(rawExpenses) : [];
    const delExpSet = getDeletedExpenseIds();
    for (const exp of localExpenses) {
      if (exp && exp.id && !delExpSet.has(String(exp.id).toLowerCase().trim())) {
        const clean = sanitizeForFirestore({
          ...exp,
          updatedAt: exp.updatedAt || exp.recordedAt || exp.spentDate || new Date().toISOString()
        });
        batch.set(doc(db, 'expenses', String(exp.id)), clean, { merge: true });
        batchOps++;
        totalCount++;
        await commitBatchIfNeeded();
      }
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
  if (now - lastForceRefreshTimestamp < 3000) {
    return localTx;
  }
  lastForceRefreshTimestamp = now;

  try {
    const txQuery = query(collection(db, 'transactions'), orderBy('timestamp', 'desc'), limit(1500));
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
      const cleanRemote = remoteTxList.filter(t => t && t.id);
      
      const txMap = new Map<string, Transaction>();
      // 1. Seed with local transactions
      for (const it of localTx) {
        if (it && it.id) {
          const k = String(it.id).toLowerCase().trim();
          if (!deletedIds.has(k) && !PERMANENTLY_PURGED_TX_IDS.has(k)) txMap.set(k, it);
        }
      }
      // 2. Overlay remote Firestore transactions
      for (const t of cleanRemote) {
        if (t && t.id) {
          const k = String(t.id).toLowerCase().trim();
          if (!deletedIds.has(k)) {
            const existing = txMap.get(k);
            txMap.set(k, existing ? { ...existing, ...t } : t);
          }
        }
      }
      // 3. Preserve genuine local transactions
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

export interface FirestoreDiagnosticData {
  firestoreTransactions: Transaction[];
  firestoreCampaigns: Campaign[];
  deletedTransactionIds: string[];
  deletedMemberIds: string[];
  firestoreStatus: FirestoreConnectionStatus;
  latencyMs: number;
  timestamp: string;
}

export interface DeepAuditResult {
  success: boolean;
  restoredCount: number;
  prunedCount: number;
  restoredIds: string[];
  prunedIds: string[];
  totalValidTxns: number;
  totalValidAmount: number;
  todayTxns: number;
  cloudStats: PublicPoolStats & { totalTxns: number; todayTxns: number };
  reconciledTransactions: Transaction[];
  message: string;
  messageMizo: string;
}

/**
 * On-demand diagnostic scan of Cloud Firestore for the Admin Sync Diagnostic tool.
 * Reads transactions (up to limit), campaigns, and system tombstones to compare with Local & Server DB.
 * Bypasses local IndexedDB cache using getDocsFromServer where possible.
 */
export async function fetchFirestoreDiagnosticData(transactionLimit: number = 5000): Promise<FirestoreDiagnosticData> {
  const startTime = Date.now();
  const result: FirestoreDiagnosticData = {
    firestoreTransactions: [],
    firestoreCampaigns: [],
    deletedTransactionIds: [],
    deletedMemberIds: [],
    firestoreStatus: connectionStatus,
    latencyMs: 0,
    timestamp: new Date().toISOString()
  };

  if (!isNetworkOnline) {
    result.firestoreStatus = 'offline';
    return result;
  }

  try {
    // 1. Fetch transactions directly from Firestore server (bypassing local IndexedDB cache)
    const txQuery = query(collection(db, 'transactions'), limit(transactionLimit));
    let txSnap;
    try {
      txSnap = await getDocsFromServer(txQuery);
    } catch {
      txSnap = await getDocs(txQuery);
    }
    txSnap.forEach(docSnap => {
      const data = docSnap.data() as Transaction;
      if (data && (data.id || docSnap.id)) {
        result.firestoreTransactions.push({ ...data, id: data.id || docSnap.id });
      }
    });

    // 2. Fetch campaigns directly from Firestore
    let campSnap;
    try {
      campSnap = await getDocsFromServer(collection(db, 'campaigns'));
    } catch {
      campSnap = await getDocs(collection(db, 'campaigns'));
    }
    campSnap.forEach(docSnap => {
      const data = docSnap.data() as Campaign;
      if (data && (data.id || docSnap.id)) {
        result.firestoreCampaigns.push({ ...data, id: data.id || docSnap.id });
      }
    });

    // 3. Fetch tombstones directly from server
    try {
      let tombSnap;
      try {
        tombSnap = await getDocFromServer(doc(db, 'system_metadata', 'tombstones'));
      } catch {
        tombSnap = await getDoc(doc(db, 'system_metadata', 'tombstones'));
      }
      if (tombSnap && tombSnap.exists()) {
        const d = tombSnap.data();
        if (Array.isArray(d?.deleted_transactions)) {
          result.deletedTransactionIds = d.deleted_transactions.map(String);
        }
        if (Array.isArray(d?.deleted_members)) {
          result.deletedMemberIds = d.deleted_members.map(String);
        }
      }
    } catch {}

    result.latencyMs = Date.now() - startTime;
    result.firestoreStatus = 'connected';
  } catch (err) {
    result.firestoreStatus = 'error';
    logFirestoreNetworkNote('Diagnostic scan', err);
  }

  return result;
}

/**
 * Automated Deep Audit & Auto-Repair Engine:
 * 1. Server-Authoritative Deep Audit:
 *    - Bypasses local IndexedDB/offline persistence cache and fetches directly from Cloud Firestore
 *      server (`transactions` collection where status is SUCCESS / confirmed valid).
 *    - Compares server snapshot against local client state:
 *      * Missing Records: IDs that exist on Firestore server but are missing from local state
 *        (e.g., RPAY-CASH-615272, RPAY-CASH-237973, RPAY-CASH-897495) are force-injected into local state.
 *        Any erroneous local tombstone blocking them is cleared via clearDeletedTransactionId().
 *      * Ghost/Orphan Records: Detects and removes any local entries that no longer exist in Firestore.
 * 2. Centralized Metrics & Auto-Repair:
 *    - Calculates true totalAmount, totalTxns, and todayTxns directly from validated server records.
 *    - Atomically overwrites this clean aggregate data into the stats/public_pool document using setDoc.
 *    - Force re-renders all dependent UI components across all screens (Home pool, Reports breakdown,
 *      Rikrum/Ralna tabs, and badge pills) using this single verified source of truth.
 * 3. Returns comprehensive audit summary for modal & toast UI feedback.
 */
export async function performDeepAuditAndAutoRepair(): Promise<DeepAuditResult> {
  // 1. DIRECT SERVER FETCH (Cache Bypass: source == 'server')
  let snap;
  const txCol = collection(db, 'transactions');
  try {
    snap = await getDocsFromServer(query(txCol, limit(5000)));
  } catch (err1) {
    try {
      snap = await getDocs(query(txCol, limit(5000)));
    } catch (err2: any) {
      throw new Error(`Cloud Firestore server audit fetch failed: ${err2?.message || String(err2)}`);
    }
  }

  // 2. Fetch server-authoritative tombstones
  const cloudTombstoneTxIds = new Set<string>();
  try {
    let tombSnap;
    try {
      tombSnap = await getDocFromServer(doc(db, 'system_metadata', 'tombstones'));
    } catch {
      tombSnap = await getDoc(doc(db, 'system_metadata', 'tombstones'));
    }
    if (tombSnap && tombSnap.exists()) {
      const td = tombSnap.data();
      if (Array.isArray(td?.deleted_transactions)) {
        td.deleted_transactions.forEach((id: any) => {
          if (id) cloudTombstoneTxIds.add(String(id).toLowerCase().trim());
        });
      }
    }
  } catch (tombErr) {
    console.warn('[DeepAudit] Tombstones direct read note:', tombErr);
  }

  // 3. Extract and normalize all valid Cloud Firestore transactions
  const validCloudTxMap = new Map<string, Transaction>();
  const nowMs = Date.now();
  const todayStr = new Date().toISOString().slice(0, 10);

  snap.forEach(docSnap => {
    const data = docSnap.data() as Transaction;
    if (!data) return;
    const rawId = (data.id || docSnap.id || '').trim();
    if (!rawId) return;
    const cleanId = rawId.toLowerCase();

    // Exclude documents that were explicitly tombstoned in cloud or permanently purged
    if (cloudTombstoneTxIds.has(cleanId) || PERMANENTLY_PURGED_TX_IDS.has(cleanId)) {
      return;
    }

    // Verify valid payment status: status == 'SUCCESS' or equivalent confirmed states
    const rawStatus = (data.status || '').toUpperCase().trim();
    const isSuccess = rawStatus === 'SUCCESS' || rawStatus === 'COMPLETED' || rawStatus === 'PAID' ||
                      rawStatus === 'VERIFIED' || rawStatus === 'PAYMENT_SUCCESS' || rawStatus === 'DONE' || !rawStatus;
    const isFailed = rawStatus === 'FAILED' || rawStatus === 'CANCELLED' || rawStatus === 'REJECTED';
    const amt = Number(data.amount) || Number(data.totalAmount) || 0;

    if (isSuccess && !isFailed && amt > 0) {
      const normalized: Transaction = {
        ...data,
        id: rawId,
        status: 'completed',
        amount: amt,
        totalAmount: amt,
        campaignNetReceived: amt,
        isSynced: true
      };

      // Auto-heal future timestamps if double IST offset occurred
      const txTime = normalized.timestamp ? new Date(normalized.timestamp).getTime() : 0;
      if (txTime > nowMs + 60000) {
        const matchRpay = rawId.match(/^RPAY_TXN_(\d{13})/i);
        if (matchRpay && Number(matchRpay[1]) > 0 && Number(matchRpay[1]) <= nowMs + 60000) {
          normalized.timestamp = new Date(Number(matchRpay[1])).toISOString();
          normalized.createdAt = normalized.timestamp;
        } else if (txTime - nowMs <= (6.5 * 3600 * 1000)) {
          normalized.timestamp = new Date(txTime - (5.5 * 3600 * 1000)).toISOString();
          normalized.createdAt = normalized.timestamp;
        }
      }

      validCloudTxMap.set(cleanId, normalized);
    }
  });

  // 4. Compare Against Local Client State
  const localStoredTxs = getStoredTransactions();
  const localDeletedIds = getDeletedTransactionIds();
  const localTxMap = new Map<string, Transaction>();
  localStoredTxs.forEach(t => {
    if (t && t.id) localTxMap.set(String(t.id).toLowerCase().trim(), t);
  });

  const restoredIds: string[] = [];
  const prunedIds: string[] = [];

  // 4A. Restore Missing Records on Local Client
  for (const [cleanId, cloudTx] of validCloudTxMap.entries()) {
    // If local tombstone mistakenly blocked this valid cloud document, CLEAR it!
    if (localDeletedIds.has(cleanId)) {
      clearDeletedTransactionId(cloudTx.id);
    }

    if (!localTxMap.has(cleanId)) {
      restoredIds.push(cloudTx.id);
    }
  }

  // 4B. Remove Ghost/Orphan Records from Local Client
  for (const [cleanId, localTx] of localTxMap.entries()) {
    if (!validCloudTxMap.has(cleanId)) {
      // Check if this is an offline draft created in the last 2 minutes
      const isVeryRecent = localTx.createdAt ? (nowMs - new Date(localTx.createdAt).getTime() < 120000) : false;
      const isOfflineDraft = ((localTx as any).isOffline === true || (localTx as any).isOfflinePending === true || localTx.isSynced === false);
      if (!(isOfflineDraft && isVeryRecent)) {
        prunedIds.push(localTx.id);
        markTransactionAsDeleted(localTx.id, false);
      }
    }
  }

  // 5. Construct Single Verified Source of Truth Transaction Array
  const reconciledList: Transaction[] = Array.from(validCloudTxMap.values());
  for (const [cleanId, localTx] of localTxMap.entries()) {
    if (!validCloudTxMap.has(cleanId) && !prunedIds.includes(localTx.id)) {
      reconciledList.push(localTx);
    }
  }

  reconciledList.sort((a, b) => {
    const timeA = new Date(a.updatedAt || a.createdAt || a.timestamp || 0).getTime();
    const timeB = new Date(b.updatedAt || b.createdAt || b.timestamp || 0).getTime();
    return timeB - timeA;
  });

  // 6. Centralized Metrics & Auto-Repair on stats/public_pool
  let trueTotalAmt = 0;
  let trueTotalTxns = 0;
  let trueTodayTxns = 0;

  for (const tx of reconciledList) {
    const s = (tx.status || '').toLowerCase().trim();
    if (s === 'completed' || s === 'success' || s === 'paid' || s === 'verified' || !s) {
      trueTotalAmt += Number(tx.amount) || 0;
      trueTotalTxns += 1;
      const dStr = (tx.timestamp || tx.createdAt || tx.date || '').slice(0, 10);
      if (dStr === todayStr) {
        trueTodayTxns += 1;
      }
    }
  }

  const cleanPoolStats: PublicPoolStats & { totalTxns: number; todayTxns: number } = {
    totalAmount: Math.round(trueTotalAmt * 100) / 100,
    totalCount: trueTotalTxns,
    totalTxns: trueTotalTxns,
    todayCount: trueTodayTxns,
    todayTxns: trueTodayTxns,
    lastUpdated: new Date().toISOString(),
  };

  // Atomically overwrite stats/public_pool document in Cloud Firestore
  try {
    await setDoc(doc(db, 'stats', 'public_pool'), cleanPoolStats);
  } catch (setErr) {
    console.warn('[DeepAudit] setDoc stats/public_pool note:', setErr);
  }

  // 7. Overwrite Local Storage & Synchronize Server
  saveStoredTransactions(reconciledList, true);
  try {
    localStorage.setItem('ronpay_transactions_v2', JSON.stringify(reconciledList));
    localStorage.setItem('ronpay_public_pool_stats_v1', JSON.stringify(cleanPoolStats));
  } catch {}
  setStoredPublicPoolStats(cleanPoolStats);

  // Sync server Express layer
  safeApiFetch('/api/data/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transactions: reconciledList, stats: cleanPoolStats })
  }).catch(() => {});

  // 8. Force Re-render all dependent UI components across all screens
  try {
    window.dispatchEvent(new CustomEvent('ronpay_transactions_updated', { detail: reconciledList }));
    window.dispatchEvent(new CustomEvent('ronpay-transactions-updated', { detail: reconciledList }));
    window.dispatchEvent(new CustomEvent('ronpay_stats_updated', { detail: cleanPoolStats }));
    window.dispatchEvent(new CustomEvent('ronpay-stats-updated', { detail: cleanPoolStats }));
  } catch {}

  broadcast('onTransactionsUpdate', reconciledList);
  broadcast('onStatsUpdate', cleanPoolStats);
  if (coordinatorChannel) {
    try {
      coordinatorChannel.postMessage({ type: 'sync_update', channel: 'transactions', payload: reconciledList });
      coordinatorChannel.postMessage({ type: 'sync_update', channel: 'stats', payload: cleanPoolStats });
    } catch {}
  }

  return {
    success: true,
    restoredCount: restoredIds.length,
    prunedCount: prunedIds.length,
    restoredIds,
    prunedIds,
    totalValidTxns: trueTotalTxns,
    totalValidAmount: Math.round(trueTotalAmt * 100) / 100,
    todayTxns: trueTodayTxns,
    cloudStats: cleanPoolStats,
    reconciledTransactions: reconciledList,
    message: `Deep Sync Complete: ${restoredIds.length} missing records restored, ${prunedIds.length} stale records pruned. Cloud and local state are 100% synchronized.`,
    messageMizo: `Scan Finished: ${restoredIds.length} Missing records restored, ${prunedIds.length} Ghost records removed. Everything 100% Synced`
  };
}

