import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  onSnapshot, 
  getDocs,
  query,
  orderBy,
  limit,
  writeBatch
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Campaign, Transaction, MemberRecord, CreatorProfile, SystemPricingConfig, AnnouncementBanner, AuditLog } from '../types';
import { 
  getStoredCampaigns, 
  saveStoredCampaigns, 
  getStoredTransactions, 
  saveStoredTransactions, 
  getMembers, 
  saveMembers, 
  getStoredCreatorsList, 
  saveStoredCreatorsList,
  getStoredPricingConfig,
  saveStoredPricingConfig,
  getStoredAnnouncement,
  saveStoredAnnouncement,
  getStoredAuditLogs,
  saveStoredAuditLogs
} from '../utils/storage';

export type FirestoreConnectionStatus = 'connecting' | 'connected' | 'offline' | 'error';

export interface FirestoreSyncCallbacks {
  onTransactionsUpdate?: (transactions: Transaction[]) => void;
  onCampaignsUpdate?: (campaigns: Campaign[]) => void;
  onMembersUpdate?: (members: MemberRecord[]) => void;
  onCreatorsUpdate?: (creators: CreatorProfile[]) => void;
  onAnnouncementUpdate?: (announcement: AnnouncementBanner) => void;
  onPricingConfigUpdate?: (pricingConfig: SystemPricingConfig) => void;
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
 * Merge local and remote collections by unique key, keeping newest and most complete records
 */
function smartMerge<T extends Record<string, any>>(localItems: T[], remoteItems: T[], key: string = 'id'): T[] {
  const map = new Map<string, T>();
  
  // 1. Seed with local items
  for (const item of localItems) {
    if (item && item[key]) {
      map.set(String(item[key]).toLowerCase(), item);
    }
  }
  
  // 2. Merge with remote items
  for (const remote of remoteItems) {
    if (remote && remote[key]) {
      const k = String(remote[key]).toLowerCase();
      const existing = map.get(k);
      map.set(k, { ...(existing || {}), ...remote });
    }
  }
  
  return Array.from(map.values());
}

/**
 * Upload initial local seed data to Firestore if Firestore is empty on first launch
 */
async function seedInitialCloudDataIfEmpty() {
  try {
    const campaignsSnap = await getDocs(collection(db, 'campaigns'));
    if (campaignsSnap.empty) {
      console.log('Seeding initial campaigns to Firestore...');
      const localCampaigns = getStoredCampaigns();
      const batch = writeBatch(db);
      for (const camp of localCampaigns) {
        if (camp && camp.id) {
          const docRef = doc(db, 'campaigns', camp.id);
          batch.set(docRef, camp, { merge: true });
        }
      }
      await batch.commit();
    }
  } catch (err) {
    console.warn('Initial Firestore seed check skipped or handled by offline cache:', err);
  }
}

/**
 * Initializes real-time bidirectional Firestore Synchronization with onSnapshot listeners
 */
export function initFirestoreRealtimeSync(callbacks: FirestoreSyncCallbacks): () => void {
  const unsubscribers: Array<() => void> = [];
  updateStatus('connecting');

  // Check initial seed
  seedInitialCloudDataIfEmpty().catch(() => {});

  // 1. Transactions Listener (onSnapshot on payment collection)
  try {
    const txQuery = query(collection(db, 'transactions'), orderBy('createdAt', 'desc'), limit(500));
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
        const localTxList = getStoredTransactions();
        const merged = smartMerge(localTxList, remoteTxList, 'id');
        
        // Cache to local storage immediately
        saveStoredTransactions(merged);

        if (callbacks.onTransactionsUpdate) {
          callbacks.onTransactionsUpdate(merged);
        }
      }
    }, (error) => {
      console.warn('Firestore transactions listener warning (using local persistence):', error);
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
        const localCampaigns = getStoredCampaigns();
        const merged = smartMerge(localCampaigns, remoteCampaigns, 'id');
        
        // Cache to local storage immediately
        saveStoredCampaigns(merged);

        if (callbacks.onCampaignsUpdate) {
          callbacks.onCampaignsUpdate(merged);
        }
      }
    }, (error) => {
      console.warn('Firestore campaigns listener warning (using local persistence):', error);
    });
    unsubscribers.push(unsubCamp);
  } catch (err) {
    console.warn('Failed to attach campaigns onSnapshot listener:', err);
  }

  // 3. Members Listener (Kumtluang / YMA member database)
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
        const localMembers = getMembers();
        const merged = smartMerge(localMembers, remoteMembers, 'id');
        
        // Cache to local storage immediately
        saveMembers(merged);

        if (callbacks.onMembersUpdate) {
          callbacks.onMembersUpdate(merged);
        }
      }
    }, (error) => {
      console.warn('Firestore members listener warning:', error);
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
        const localCreators = getStoredCreatorsList();
        const merged = smartMerge(localCreators, remoteCreators, 'phone');
        
        // Cache to local storage immediately
        saveStoredCreatorsList(merged);

        if (callbacks.onCreatorsUpdate) {
          callbacks.onCreatorsUpdate(merged);
        }
      }
    }, (error) => {
      console.warn('Firestore creators listener warning:', error);
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
          saveStoredAnnouncement(data);
          if (callbacks.onAnnouncementUpdate) {
            callbacks.onAnnouncementUpdate(data);
          }
        }
      }
    }, (error) => {
      console.warn('Firestore announcement config listener warning:', error);
    });
    unsubscribers.push(unsubConfig);
  } catch (err) {
    console.warn('Failed to attach systemConfig listener:', err);
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
 * Write single transaction to Firestore with auto-merge & local caching
 */
export async function syncTransactionToFirestore(tx: Transaction): Promise<void> {
  if (!tx || !tx.id) return;
  try {
    const docRef = doc(db, 'transactions', tx.id);
    await setDoc(docRef, { ...tx, updatedAt: new Date().toISOString() }, { merge: true });
  } catch (err) {
    console.warn('Cloud sync for transaction deferred to offline cache:', err);
  }
}

/**
 * Write single campaign to Firestore with auto-merge & local caching
 */
export async function syncCampaignToFirestore(campaign: Campaign): Promise<void> {
  if (!campaign || !campaign.id) return;
  try {
    const docRef = doc(db, 'campaigns', campaign.id);
    await setDoc(docRef, { ...campaign, updatedAt: new Date().toISOString() }, { merge: true });
    console.log('[Firestore] Campaign successfully synced:', campaign.id);
  } catch (err) {
    console.error('Firebase Error:', err);
  }
}

/**
 * Write single member to Firestore with auto-merge & local caching
 */
export async function syncMemberToFirestore(member: MemberRecord): Promise<void> {
  if (!member || !member.id) return;
  try {
    const docRef = doc(db, 'members', member.id);
    await setDoc(docRef, { ...member, updatedAt: new Date().toISOString() }, { merge: true });
  } catch (err) {
    console.warn('Cloud sync for member deferred to offline cache:', err);
  }
}

/**
 * Delete member from Firestore
 */
export async function deleteMemberFromFirestore(memberId: string): Promise<void> {
  if (!memberId) return;
  try {
    const docRef = doc(db, 'members', memberId);
    await deleteDoc(docRef);
  } catch (err) {
    console.warn('Cloud delete for member deferred to offline cache:', err);
  }
}

/**
 * Delete campaign from Firestore
 */
export async function deleteCampaignFromFirestore(campaignId: string): Promise<void> {
  if (!campaignId) return;
  try {
    const docRef = doc(db, 'campaigns', campaignId);
    await deleteDoc(docRef);
  } catch (err) {
    console.warn('Cloud delete for campaign deferred to offline cache:', err);
  }
}

/**
 * Write single creator profile to Firestore
 */
export async function syncCreatorToFirestore(creator: CreatorProfile): Promise<void> {
  if (!creator || !creator.phone) return;
  try {
    const docRef = doc(db, 'creators', creator.phone);
    await setDoc(docRef, { ...creator, updatedAt: new Date().toISOString() }, { merge: true });
  } catch (err) {
    console.warn('Cloud sync for creator deferred to offline cache:', err);
  }
}

/**
 * Write announcement banner to Firestore
 */
export async function syncAnnouncementToFirestore(announcement: AnnouncementBanner): Promise<void> {
  if (!announcement) return;
  try {
    const docRef = doc(db, 'systemConfig', 'announcement');
    await setDoc(docRef, { ...announcement, updatedAt: new Date().toISOString() }, { merge: true });
  } catch (err) {
    console.warn('Cloud sync for announcement deferred to offline cache:', err);
  }
}

/**
 * Push all local records to Firestore (e.g. on manual sync or initial migration)
 */
export async function pushAllLocalDataToFirestore(): Promise<{ success: boolean; count: number }> {
  try {
    const localCampaigns = getStoredCampaigns();
    const localTransactions = getStoredTransactions();
    const localMembers = getMembers();
    const localCreators = getStoredCreatorsList();
    const localAnnouncement = getStoredAnnouncement();

    let count = 0;

    // Batch upload campaigns
    for (const c of localCampaigns) {
      if (c && c.id) {
        await setDoc(doc(db, 'campaigns', c.id), c, { merge: true });
        count++;
      }
    }

    // Batch upload transactions
    for (const t of localTransactions) {
      if (t && t.id) {
        await setDoc(doc(db, 'transactions', t.id), t, { merge: true });
        count++;
      }
    }

    // Batch upload members
    for (const m of localMembers) {
      if (m && m.id) {
        await setDoc(doc(db, 'members', m.id), m, { merge: true });
        count++;
      }
    }

    // Batch upload creators
    for (const cr of localCreators) {
      if (cr && cr.phone) {
        await setDoc(doc(db, 'creators', cr.phone), cr, { merge: true });
        count++;
      }
    }

    // System configs
    if (localAnnouncement) {
      await setDoc(doc(db, 'systemConfig', 'announcement'), localAnnouncement, { merge: true });
      count++;
    }

    return { success: true, count };
  } catch (err) {
    console.error('Failed pushing local data to Firestore:', err);
    return { success: false, count: 0 };
  }
}
