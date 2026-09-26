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
        const canonicalTxIds = new Set(INITIAL_TRANSACTIONS.map(t => String(t.id).toLowerCase().trim()));
        return new Set(arr.filter((id: any) => !canonicalTxIds.has(String(id).toLowerCase().trim())).map((id: any) => String(id).toLowerCase().trim()));
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
 * Check and seed Firestore with initial default data if empty on cold start (run once per device/browser)
 */
export async function seedInitialCloudDataIfEmpty() {
  if (hasSeededCloudThisSession || !isNetworkOnline) return;
  hasSeededCloudThisSession = true;

  // Once checked/seeded in this browser environment, bypass completely to avoid wasteful Firestore reads
  try {
    if (typeof localStorage !== 'undefined' && localStorage.getItem('ronpay_firestore_seeded_ok') === 'true') {
      return;
    }
  } catch {}

  try {
    // 1. Campaigns seed check with limit(1) - consumes at most 1 read instead of reading entire collection
    const campaignsSnap = await getDocs(query(collection(db, 'campaigns'), limit(1)));
    if (campaignsSnap.empty) {
      console.log('[Firestore] Seeding initial campaigns to Firestore...');
      const batch = writeBatch(db);
      for (const camp of INITIAL_CAMPAIGNS) {
        if (camp && camp.id) {
          const docRef = doc(db, 'campaigns', camp.id);
          batch.set(docRef, sanitizeForFirestore({ ...camp, updatedAt: new Date().toISOString() }), { merge: true });
        }
      }
      await batch.commit();
    }

    // 2. Pricing config seed check
    const pricingDoc = await getDoc(doc(db, 'systemConfig', 'pricing'));
    if (!pricingDoc.exists()) {
      await setDoc(doc(db, 'systemConfig', 'pricing'), sanitizeForFirestore({
        ...DEFAULT_PRICING_CONFIG,
        updatedAt: new Date().toISOString()
      }), { merge: true });
    }

    // 3. Announcement seed check
    const announcementDoc = await getDoc(doc(db, 'systemConfig', 'announcement'));
    if (!announcementDoc.exists()) {
      await setDoc(doc(db, 'systemConfig', 'announcement'), sanitizeForFirestore({
        ...DEFAULT_ANNOUNCEMENT,
        updatedAt: new Date().toISOString()
      }), { merge: true });
    }

    // 4. Initial Creators seed check with limit(1) - consumes at most 1 read instead of reading entire collection
    const creatorsSnap = await getDocs(query(collection(db, 'creators'), limit(1)));
    if (creatorsSnap.empty) {
      const batch = writeBatch(db);
      for (const cr of INITIAL_REGISTERED_CREATORS) {
        if (cr && cr.phone) {
          const docRef = doc(db, 'creators', cr.phone);
          batch.set(docRef, sanitizeForFirestore({ ...cr, updatedAt: new Date().toISOString() }), { merge: true });
        }
      }
      await batch.commit();
    }

    // 5. Initial Members seed check with limit(1) - consumes at most 1 read instead of reading entire collection
    const membersSnap = await getDocs(query(collection(db, 'members'), limit(1)));
    if (membersSnap.empty) {
      const batch = writeBatch(db);
      for (const m of INITIAL_DEFAULT_MEMBERS) {
        if (m && m.id) {
          const docRef = doc(db, 'members', m.id);
          batch.set(docRef, sanitizeForFirestore({ ...m, updatedAt: new Date().toISOString() }), { merge: true });
        }
      }
      await batch.commit();
    }

    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('ronpay_firestore_seeded_ok', 'true');
      }
    } catch {}
  } catch (err) {
    logFirestoreNetworkNote('Seed cloud data check', err);
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

/**
 * Cleanly unsubscribe and stop all active Firestore snapshot listeners across the app.
 */
export function stopAllFirestoreListeners(): void {
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
  activeSubscribers.clear();
  updateStatus('offline', 'Firestore listeners detached.');
  console.info('[RonPay Cloud Sync] Successfully stopped and cleaned up all Firestore snapshot listeners.');
}

/**
 * Initializes real-time bidirectional Firestore Synchronization with onSnapshot listeners.
 * Employs a singleton listener pattern: exactly 1 set of 7 listeners runs across all subscribers.
 * Subscribing components receive real-time updates and properly decrement/cleanup on unmount.
 */
export function initFirestoreRealtimeSync(callbacks: FirestoreSyncCallbacks): () => void {
  // 1. Register callbacks in active subscribers set
  activeSubscribers.add(callbacks);

  // 2. If listeners are already active, do NOT create duplicate onSnapshot listeners (prevents the 49 listeners leak)
  if (isFirestoreListening) {
    if (callbacks.onStatusChange) {
      callbacks.onStatusChange(connectionStatus);
    }
    return () => {
      activeSubscribers.delete(callbacks);
      if (activeSubscribers.size === 0) {
        stopAllFirestoreListeners();
      }
    };
  }

  // 3. First time or re-attaching: ensure previous listeners are stopped cleanly
  stopAllFirestoreListeners();
  activeSubscribers.add(callbacks);
  isFirestoreListening = true;
  updateStatus('connecting');

  // Trigger initial cloud seed check safely once per session
  seedInitialCloudDataIfEmpty().catch(() => {});

  const newUnsubscribers: Array<() => void> = [];

  // Helper to safely broadcast to all active subscribers
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

  // 1. Transactions Listener (onSnapshot on recent transactions only - 20 items to drastically reduce reads)
  try {
    const txQuery = query(collection(db, 'transactions'), orderBy('timestamp', 'desc'), limit(20));
    const unsubTx = onSnapshot(txQuery, (snapshot) => {
      updateStatus('connected');
      const remoteTxList: Transaction[] = [];
      const nowMs = Date.now();
      snapshot.forEach(docSnap => {
        const data = docSnap.data() as Transaction;
        if (data && data.id) {
          // Auto-heal future timestamps if double IST offset occurred
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

        // Safely merge cleanRemote with valid local transactions for UI display
        // IMPORTANT: NEVER call syncTransactionToFirestore inside onSnapshot to avoid infinite read/write feedback loops!
        const localTx = getLocalJson<Transaction[]>('ronpay_transactions_v2', []);
        const txMap = new Map<string, Transaction>();
        // First add remote
        for (const t of cleanRemote) {
          if (t && t.id) txMap.set(String(t.id).toLowerCase().trim(), t);
        }
        // Then merge local without writing back
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
        try {
          window.dispatchEvent(new CustomEvent('ronpay_transactions_updated', { detail: merged }));
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

  // 2. Campaigns Listener (onSnapshot on campaigns collection - limited to 40 to minimize reads)
  try {
    const campQuery = query(collection(db, 'campaigns'), limit(40));
    const unsubCamp = onSnapshot(campQuery, (snapshot) => {
      updateStatus('connected');
      const remoteCampaigns: Campaign[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data() as Campaign;
        if (data && data.id) {
          remoteCampaigns.push(data);
        }
      });

      if (remoteCampaigns.length > 0) {
        const deletedCampIds = getDeletedCampaignIds();
        const filteredRemote = remoteCampaigns.filter(c => c && c.id && !deletedCampIds.has(String(c.id).toLowerCase().trim()));
        const localCamps = getLocalJson<Campaign[]>('ronpay_campaigns_v2', INITIAL_CAMPAIGNS)
          .filter(c => c && c.id && !deletedCampIds.has(String(c.id).toLowerCase().trim()));
        const merged = smartMerge(localCamps, filteredRemote, 'id')
          .filter(c => c && c.id && !deletedCampIds.has(String(c.id).toLowerCase().trim()));
        // Always sort newest first so all devices (Android, web, preview) display the exact same deterministic list
        const sorted = [...merged].sort((a, b) => {
          const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return timeB - timeA;
        });
        setLocalJson('ronpay_campaigns_v2', sorted);
        broadcast('onCampaignsUpdate', sorted);
        try {
          window.dispatchEvent(new CustomEvent('ronpay-campaigns-updated', { detail: sorted }));
        } catch {}
      }
    }, (error) => {
      logFirestoreNetworkNote('Campaigns listener', error);
    });
    newUnsubscribers.push(unsubCamp);
  } catch (err) {
    logFirestoreNetworkNote('Attach campaigns listener', err);
  }

  // 3. Members Listener (Kumtluang / YMA / Bawm member database) - limited to 30 to prevent high read volume
  try {
    const memQuery = query(collection(db, 'members'), limit(30));
    const unsubMem = onSnapshot(memQuery, (snapshot) => {
      const remoteMembers: MemberRecord[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data() as MemberRecord;
        if (data && data.id) {
          remoteMembers.push(data);
        }
      });

      if (remoteMembers.length > 0) {
        const localMembers = getLocalJson<MemberRecord[]>('ronpay_kumtluang_members_v1', INITIAL_DEFAULT_MEMBERS);
        const merged = smartMerge(localMembers, remoteMembers, 'id');
        setLocalJson('ronpay_kumtluang_members_v1', merged);
        broadcast('onMembersUpdate', merged);
        try {
          window.dispatchEvent(new CustomEvent('ronpay-members-updated', { detail: merged }));
        } catch {}
      }
    }, (error) => {
      logFirestoreNetworkNote('Members listener', error);
    });
    newUnsubscribers.push(unsubMem);
  } catch (err) {
    logFirestoreNetworkNote('Attach members listener', err);
  }

  // 4. Creators Profile & List Listener - limited to 15 to reduce reads
  try {
    const creatorsQuery = query(collection(db, 'creators'), limit(15));
    const unsubCreators = onSnapshot(creatorsQuery, (snapshot) => {
      const remoteCreators: CreatorProfile[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data() as CreatorProfile;
        if (data && (data.phone || (data as any).id)) {
          remoteCreators.push(data);
        }
      });

      if (remoteCreators.length > 0) {
        const localCreators = getLocalJson<CreatorProfile[]>('ronpay_creators_list_v2', INITIAL_REGISTERED_CREATORS);
        const merged = smartMerge(localCreators, remoteCreators, 'phone');
        setLocalJson('ronpay_creators_list_v2', merged);
        broadcast('onCreatorsUpdate', merged);

        // Sync active creator profile if phone matches
        const currentActive = getLocalJson<CreatorProfile | null>('ronpay_creator_profile_v2', null);
        if (currentActive && currentActive.phone) {
          const matchedRemote = merged.find(c => c.phone === currentActive.phone);
          if (matchedRemote) {
            const updatedActive = { ...currentActive, ...matchedRemote };
            setLocalJson('ronpay_creator_profile_v2', updatedActive);
            try {
              window.dispatchEvent(new CustomEvent('ronpay-creator-updated', { detail: updatedActive }));
              window.dispatchEvent(new CustomEvent('ronpay_creator_profile_updated', { detail: updatedActive }));
            } catch {}
          }
        }

        try {
          window.dispatchEvent(new CustomEvent('ronpay_creators_updated', { detail: merged }));
        } catch {}
      }
    }, (error) => {
      logFirestoreNetworkNote('Creators listener', error);
    });
    newUnsubscribers.push(unsubCreators);
  } catch (err) {
    logFirestoreNetworkNote('Attach creators listener', err);
  }

  // 5. System Configuration / Announcements Listener
  try {
    const configDocRef = doc(db, 'systemConfig', 'announcement');
    const unsubConfig = onSnapshot(configDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as AnnouncementBanner;
        if (data && data.id) {
          setLocalJson('ronpay_announcement_v1', data);
          broadcast('onAnnouncementUpdate', data);
        }
      }
    }, (error) => {
      logFirestoreNetworkNote('Announcement config listener', error);
    });
    newUnsubscribers.push(unsubConfig);
  } catch (err) {
    logFirestoreNetworkNote('Attach systemConfig announcement listener', err);
  }

  // 6. Pricing Configuration Listener
  try {
    const pricingDocRef = doc(db, 'systemConfig', 'pricing');
    const unsubPricing = onSnapshot(pricingDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as SystemPricingConfig;
        if (data && data.categories) {
          setLocalJson('ronpay_pricing_config_v1', data);
          broadcast('onPricingConfigUpdate', data);
        }
      }
    }, (error) => {
      logFirestoreNetworkNote('Pricing config listener', error);
    });
    newUnsubscribers.push(unsubPricing);
  } catch (err) {
    logFirestoreNetworkNote('Attach pricing config listener', err);
  }

  // 7. Audit Logs Listener - limited to 5 to reduce reads
  try {
    const auditQuery = query(collection(db, 'auditLogs'), orderBy('timestamp', 'desc'), limit(5));
    const unsubAudit = onSnapshot(auditQuery, (snapshot) => {
      const logs: AuditLog[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data() as AuditLog;
        if (data && data.id) {
          logs.push(data);
        }
      });
      if (logs.length > 0) {
        setLocalJson('ronpay_audit_logs_v1', logs);
        broadcast('onAuditLogsUpdate', logs);
      }
    }, (err) => {
      logFirestoreNetworkNote('Audit logs listener', err);
    });
    newUnsubscribers.push(unsubAudit);
  } catch (err) {
    logFirestoreNetworkNote('Attach audit logs listener', err);
  }

  activeFirestoreUnsubscribers = newUnsubscribers;

  // Return unsubscribe function for this specific subscriber
  return () => {
    activeSubscribers.delete(callbacks);
    // When the last subscriber unmounts, unsubscribe all 7 Firestore snapshot listeners
    if (activeSubscribers.size === 0) {
      stopAllFirestoreListeners();
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

/**
 * Push all local records to Firebase Firestore (manual bulk push & migration)
 */
export async function pushAllLocalDataToFirestore(): Promise<{ success: boolean; count: number }> {
  if (!isNetworkOnline) {
    return { success: false, count: 0 };
  }
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

    const rawLogs = localStorage.getItem('ronpay_audit_logs_v1');
    const localAuditLogs: AuditLog[] = rawLogs ? JSON.parse(rawLogs) : [];

    let count = 0;

    // Batch upload campaigns
    for (const c of localCampaigns) {
      if (c && c.id) {
        await syncCampaignToFirestore(c);
        count++;
      }
    }

    // Batch upload transactions
    for (const t of localTransactions) {
      if (t && t.id) {
        await syncTransactionToFirestore(t);
        count++;
      }
    }

    // Batch upload members
    for (const m of localMembers) {
      if (m && m.id) {
        await syncMemberToFirestore(m);
        count++;
      }
    }

    // Batch upload creators
    for (const cr of localCreators) {
      if (cr && cr.phone) {
        await syncCreatorToFirestore(cr);
        count++;
      }
    }

    // System configs
    if (localAnnouncement) {
      await syncAnnouncementToFirestore(localAnnouncement);
      count++;
    }

    if (localPricing) {
      await syncPricingConfigToFirestore(localPricing);
      count++;
    }

    for (const log of localAuditLogs.slice(0, 50)) {
      if (log && log.id) {
        await syncAuditLogToFirestore(log);
        count++;
      }
    }

    return { success: true, count };
  } catch (err) {
    logFirestoreNetworkNote('Push all local data', err);
    return { success: false, count: 0 };
  }
}

/**
 * Force an immediate read of all transactions from Firestore and sync to local storage & state.
 */
export async function forceRefreshFirestore(): Promise<Transaction[]> {
  if (!isNetworkOnline) {
    return getLocalJson<Transaction[]>('ronpay_transactions_v2', []);
  }
  try {
    const txQuery = query(collection(db, 'transactions'), orderBy('timestamp', 'desc'), limit(30));
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
      try {
        window.dispatchEvent(new CustomEvent('ronpay_transactions_updated', { detail: merged }));
        window.dispatchEvent(new CustomEvent('ronpay-transactions-updated', { detail: merged }));
      } catch {}
      return merged;
    }
  } catch (err) {
    logFirestoreNetworkNote('Force refresh Firestore', err);
  }
  return getLocalJson<Transaction[]>('ronpay_transactions_v2', []);
}

