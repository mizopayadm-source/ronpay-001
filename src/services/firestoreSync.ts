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
import { INITIAL_DEFAULT_MEMBERS, DEFAULT_ANNOUNCEMENT } from '../utils/storage';

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

/**
 * Merge local and remote collections by unique key, keeping newest and most complete records
 */
export function smartMerge<T extends Record<string, any>>(localItems: T[], remoteItems: T[], key: string = 'id'): T[] {
  const map = new Map<string, T>();
  
  // 1. Seed with local items
  for (const item of (localItems || [])) {
    if (item && item[key]) {
      map.set(String(item[key]).toLowerCase(), item);
    }
  }
  
  // 2. Merge with remote items
  for (const remote of (remoteItems || [])) {
    if (remote && remote[key]) {
      const k = String(remote[key]).toLowerCase();
      const existing = map.get(k);
      map.set(k, { ...(existing || {}), ...remote });
    }
  }
  
  return Array.from(map.values());
}

/**
 * Check and seed Firestore with initial default data if empty on cold start
 */
export async function seedInitialCloudDataIfEmpty() {
  try {
    // 1. Campaigns seed check
    const campaignsSnap = await getDocs(collection(db, 'campaigns'));
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

    // 4. Initial Creators seed check
    const creatorsSnap = await getDocs(collection(db, 'creators'));
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

    // 5. Initial Members seed check
    const membersSnap = await getDocs(collection(db, 'members'));
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
  } catch (err) {
    console.warn('[Firestore] Initial cloud seed check note:', err);
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

/**
 * Initializes real-time bidirectional Firestore Synchronization with onSnapshot listeners.
 * Every change from other browsers / mobile apps immediately triggers the callbacks and updates localStorage.
 */
export function initFirestoreRealtimeSync(callbacks: FirestoreSyncCallbacks): () => void {
  const unsubscribers: Array<() => void> = [];
  updateStatus('connecting');

  // Trigger initial cloud seed check
  seedInitialCloudDataIfEmpty().catch(() => {});

  // 1. Transactions Listener (onSnapshot on transactions collection)
  try {
    const txQuery = query(collection(db, 'transactions'), orderBy('timestamp', 'desc'), limit(1000));
    const unsubTx = onSnapshot(txQuery, (snapshot) => {
      updateStatus('connected');
      const remoteTxList: Transaction[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data() as Transaction;
        if (data && data.id) {
          remoteTxList.push(data);
        }
      });

      if (remoteTxList.length > 0) {
        const localTx = getLocalJson<Transaction[]>('ronpay_transactions_v2', INITIAL_TRANSACTIONS);
        const merged = smartMerge(localTx, remoteTxList, 'id');
        setLocalJson('ronpay_transactions_v2', merged);
        if (callbacks.onTransactionsUpdate) {
          callbacks.onTransactionsUpdate(merged);
        }
        try {
          window.dispatchEvent(new CustomEvent('ronpay-transactions-updated', { detail: merged }));
        } catch {}
      }
    }, (error) => {
      console.warn('Firestore transactions listener note:', error);
      updateStatus('offline', error.message);
    });
    unsubscribers.push(unsubTx);
  } catch (err) {
    console.warn('Failed to attach transactions onSnapshot listener:', err);
    updateStatus('offline');
  }

  // 2. Campaigns Listener (onSnapshot on campaigns collection)
  try {
    const campQuery = collection(db, 'campaigns');
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
        let deletedIds = new Set<string>();
        try {
          const rawDel = localStorage.getItem('ronpay_deleted_campaign_ids_v1');
          if (rawDel) {
            const arr = JSON.parse(rawDel);
            if (Array.isArray(arr)) {
              deletedIds = new Set(arr.map((id: any) => String(id).toLowerCase().trim()));
            }
          }
        } catch {}

        const filteredRemote = remoteCampaigns.filter(c => c && c.id && !deletedIds.has(String(c.id).toLowerCase().trim()));
        const localCamps = getLocalJson<Campaign[]>('ronpay_campaigns_v2', INITIAL_CAMPAIGNS)
          .filter(c => c && c.id && !deletedIds.has(String(c.id).toLowerCase().trim()));
        const merged = smartMerge(localCamps, filteredRemote, 'id')
          .filter(c => c && c.id && !deletedIds.has(String(c.id).toLowerCase().trim()));

        // Always sort newest first so all devices (Android, web, preview) display the exact same deterministic list
        const sorted = [...merged].sort((a, b) => {
          const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return timeB - timeA;
        });
        setLocalJson('ronpay_campaigns_v2', sorted);
        if (callbacks.onCampaignsUpdate) {
          callbacks.onCampaignsUpdate(sorted);
        }
        try {
          window.dispatchEvent(new CustomEvent('ronpay-campaigns-updated', { detail: sorted }));
        } catch {}
      }
    }, (error) => {
      console.warn('Firestore campaigns listener note:', error);
    });
    unsubscribers.push(unsubCamp);
  } catch (err) {
    console.warn('Failed to attach campaigns onSnapshot listener:', err);
  }

  // 3. Members Listener (Kumtluang / YMA / Bawm member database)
  try {
    const memQuery = collection(db, 'members');
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
        if (callbacks.onMembersUpdate) {
          callbacks.onMembersUpdate(merged);
        }
        try {
          window.dispatchEvent(new CustomEvent('ronpay-members-updated', { detail: merged }));
        } catch {}
      }
    }, (error) => {
      console.warn('Firestore members listener note:', error);
    });
    unsubscribers.push(unsubMem);
  } catch (err) {
    console.warn('Failed to attach members onSnapshot listener:', err);
  }

  // 4. Creators Profile & List Listener
  try {
    const creatorsQuery = collection(db, 'creators');
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
        if (callbacks.onCreatorsUpdate) {
          callbacks.onCreatorsUpdate(merged);
        }

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
      console.warn('Firestore creators listener note:', error);
    });
    unsubscribers.push(unsubCreators);
  } catch (err) {
    console.warn('Failed to attach creators onSnapshot listener:', err);
  }

  // 5. System Configuration / Announcements Listener
  try {
    const configDocRef = doc(db, 'systemConfig', 'announcement');
    const unsubConfig = onSnapshot(configDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as AnnouncementBanner;
        if (data && data.id) {
          setLocalJson('ronpay_announcement_v1', data);
          if (callbacks.onAnnouncementUpdate) {
            callbacks.onAnnouncementUpdate(data);
          }
        }
      }
    }, (error) => {
      console.warn('Firestore announcement config listener note:', error);
    });
    unsubscribers.push(unsubConfig);
  } catch (err) {
    console.warn('Failed to attach systemConfig announcement listener:', err);
  }

  // 6. Pricing Configuration Listener
  try {
    const pricingDocRef = doc(db, 'systemConfig', 'pricing');
    const unsubPricing = onSnapshot(pricingDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as SystemPricingConfig;
        if (data && data.categories) {
          setLocalJson('ronpay_pricing_config_v1', data);
          if (callbacks.onPricingConfigUpdate) {
            callbacks.onPricingConfigUpdate(data);
          }
        }
      }
    }, (error) => {
      console.warn('Firestore pricing config listener note:', error);
    });
    unsubscribers.push(unsubPricing);
  } catch (err) {
    console.warn('Failed to attach pricing config listener:', err);
  }

  // 7. Audit Logs Listener
  try {
    const auditQuery = query(collection(db, 'auditLogs'), orderBy('timestamp', 'desc'), limit(100));
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
        if (callbacks.onAuditLogsUpdate) {
          callbacks.onAuditLogsUpdate(logs);
        }
      }
    }, (err) => {
      console.warn('Firestore audit logs listener note:', err);
    });
    unsubscribers.push(unsubAudit);
  } catch (err) {
    console.warn('Failed to attach audit logs listener:', err);
  }

  // Return unsubscribe all function
  return () => {
    unsubscribers.forEach(unsub => {
      try {
        unsub();
      } catch (e) {
        // ignore
      }
    });
  };
}

/**
 * Direct write: Save single transaction to Firebase Firestore (transactions collection)
 */
export async function syncTransactionToFirestore(tx: Transaction): Promise<void> {
  if (!tx || !tx.id) return;
  try {
    const cleanTx = sanitizeForFirestore({
      ...tx,
      updatedAt: new Date().toISOString()
    });
    const docRef = doc(db, 'transactions', tx.id);
    await setDoc(docRef, cleanTx, { merge: true });
  } catch (err: any) {
    if (err?.code !== 'resource-exhausted') {
      console.warn('[Firestore] Transaction sync note:', err?.message || err);
    }
  }
}

/**
 * Direct write: Save single campaign / QR code to Firebase Firestore (campaigns collection)
 */
export async function syncCampaignToFirestore(campaign: Campaign): Promise<void> {
  if (!campaign || !campaign.id) return;
  try {
    const cleanCampaign = sanitizeForFirestore({
      ...campaign,
      updatedAt: new Date().toISOString()
    });
    const docRef = doc(db, 'campaigns', campaign.id);
    await setDoc(docRef, cleanCampaign, { merge: true });
  } catch (err: any) {
    if (err?.code !== 'resource-exhausted') {
      console.warn('[Firestore] Campaign sync note:', err?.message || err);
    }
  }
}

/**
 * Direct write: Save single member to Firebase Firestore (members collection)
 */
export async function syncMemberToFirestore(member: MemberRecord): Promise<void> {
  if (!member || !member.id) return;
  try {
    const cleanMember = sanitizeForFirestore({
      ...member,
      updatedAt: new Date().toISOString()
    });
    const docRef = doc(db, 'members', member.id);
    await setDoc(docRef, cleanMember, { merge: true });
  } catch (err: any) {
    if (err?.code !== 'resource-exhausted') {
      console.warn('[Firestore] Member sync note:', err?.message || err);
    }
  }
}

/**
 * Direct delete: Delete member from Firestore
 */
export async function deleteMemberFromFirestore(memberId: string): Promise<void> {
  if (!memberId) return;
  try {
    const docRef = doc(db, 'members', memberId);
    await deleteDoc(docRef);
  } catch (err: any) {
    console.warn('[Firestore] Member delete note:', err?.message || err);
  }
}

/**
 * Direct delete: Delete campaign from Firestore
 */
export async function deleteCampaignFromFirestore(campaignId: string): Promise<void> {
  if (!campaignId) return;
  try {
    const docRef = doc(db, 'campaigns', campaignId);
    await deleteDoc(docRef);
  } catch (err: any) {
    console.warn('[Firestore] Campaign delete note:', err?.message || err);
  }
}

/**
 * Direct delete: Delete transaction from Firestore
 */
export async function deleteTransactionFromFirestore(transactionId: string): Promise<void> {
  if (!transactionId) return;
  try {
    const docRef = doc(db, 'transactions', transactionId);
    await deleteDoc(docRef);
  } catch (err: any) {
    console.warn('[Firestore] Transaction delete note:', err?.message || err);
  }
}

/**
 * Direct write: Save single creator profile to Firebase Firestore (creators collection)
 */
export async function syncCreatorToFirestore(creator: CreatorProfile): Promise<void> {
  if (!creator || !creator.phone) return;
  try {
    const cleanCreator = sanitizeForFirestore({
      ...creator,
      updatedAt: new Date().toISOString()
    });
    const docRef = doc(db, 'creators', creator.phone);
    await setDoc(docRef, cleanCreator, { merge: true });
  } catch (err: any) {
    if (err?.code !== 'resource-exhausted') {
      console.warn('[Firestore] Creator sync note:', err?.message || err);
    }
  }
}

/**
 * Direct write: Save announcement banner to Firebase Firestore
 */
export async function syncAnnouncementToFirestore(announcement: AnnouncementBanner): Promise<void> {
  if (!announcement) return;
  try {
    const cleanAnnouncement = sanitizeForFirestore({
      ...announcement,
      updatedAt: new Date().toISOString()
    });
    const docRef = doc(db, 'systemConfig', 'announcement');
    await setDoc(docRef, cleanAnnouncement, { merge: true });
  } catch (err: any) {
    console.warn('[Firestore] Announcement sync note:', err?.message || err);
  }
}

/**
 * Direct write: Save pricing config to Firebase Firestore
 */
export async function syncPricingConfigToFirestore(pricingConfig: SystemPricingConfig): Promise<void> {
  if (!pricingConfig) return;
  try {
    const cleanPricing = sanitizeForFirestore({
      ...pricingConfig,
      updatedAt: new Date().toISOString()
    });
    const docRef = doc(db, 'systemConfig', 'pricing');
    await setDoc(docRef, cleanPricing, { merge: true });
  } catch (err: any) {
    console.warn('[Firestore] Pricing sync note:', err?.message || err);
  }
}

/**
 * Direct write: Save audit log to Firebase Firestore
 */
export async function syncAuditLogToFirestore(auditLog: AuditLog): Promise<void> {
  if (!auditLog || !auditLog.id) return;
  try {
    const cleanLog = sanitizeForFirestore({
      ...auditLog,
      updatedAt: new Date().toISOString()
    });
    const docRef = doc(db, 'auditLogs', auditLog.id);
    await setDoc(docRef, cleanLog, { merge: true });
  } catch (err: any) {
    // Audit logs non-critical
  }
}

/**
 * Push all local records to Firebase Firestore using atomic writeBatches
 */
export async function pushAllLocalDataToFirestore(): Promise<{ success: boolean; count: number }> {
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
    let currentBatch = writeBatch(db);
    let batchOps = 0;

    const commitAndResetBatch = async () => {
      if (batchOps > 0) {
        await currentBatch.commit();
        currentBatch = writeBatch(db);
        batchOps = 0;
      }
    };

    // 1. Campaigns Batch
    for (const c of localCampaigns) {
      if (c && c.id) {
        const docRef = doc(db, 'campaigns', c.id);
        currentBatch.set(docRef, sanitizeForFirestore({ ...c, updatedAt: new Date().toISOString() }), { merge: true });
        count++;
        batchOps++;
        if (batchOps >= 400) await commitAndResetBatch();
      }
    }

    // 2. Transactions Batch
    for (const t of localTransactions) {
      if (t && t.id) {
        const docRef = doc(db, 'transactions', t.id);
        currentBatch.set(docRef, sanitizeForFirestore({ ...t, updatedAt: new Date().toISOString() }), { merge: true });
        count++;
        batchOps++;
        if (batchOps >= 400) await commitAndResetBatch();
      }
    }

    // 3. Members Batch
    for (const m of localMembers) {
      if (m && m.id) {
        const docRef = doc(db, 'members', m.id);
        currentBatch.set(docRef, sanitizeForFirestore({ ...m, updatedAt: new Date().toISOString() }), { merge: true });
        count++;
        batchOps++;
        if (batchOps >= 400) await commitAndResetBatch();
      }
    }

    // 4. Creators Batch
    for (const cr of localCreators) {
      if (cr && cr.phone) {
        const docRef = doc(db, 'creators', cr.phone);
        currentBatch.set(docRef, sanitizeForFirestore({ ...cr, updatedAt: new Date().toISOString() }), { merge: true });
        count++;
        batchOps++;
        if (batchOps >= 400) await commitAndResetBatch();
      }
    }

    // 5. System configs
    if (localAnnouncement) {
      const docRef = doc(db, 'systemConfig', 'announcement');
      currentBatch.set(docRef, sanitizeForFirestore({ ...localAnnouncement, updatedAt: new Date().toISOString() }), { merge: true });
      count++;
      batchOps++;
    }

    if (localPricing) {
      const docRef = doc(db, 'systemConfig', 'pricing');
      currentBatch.set(docRef, sanitizeForFirestore({ ...localPricing, updatedAt: new Date().toISOString() }), { merge: true });
      count++;
      batchOps++;
    }

    for (const log of localAuditLogs.slice(0, 30)) {
      if (log && log.id) {
        const docRef = doc(db, 'auditLogs', log.id);
        currentBatch.set(docRef, sanitizeForFirestore({ ...log, updatedAt: new Date().toISOString() }), { merge: true });
        count++;
        batchOps++;
        if (batchOps >= 400) await commitAndResetBatch();
      }
    }

    await commitAndResetBatch();
    return { success: true, count };
  } catch (err) {
    console.error('Failed pushing local data to Firestore:', err);
    return { success: false, count: 0 };
  }
}
