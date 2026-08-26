import { Campaign, MemberRecord, Transaction, CreatorProfile, SystemPricingConfig, AnnouncementBanner, AuditLog } from '../types';
import { 
  getStoredCampaigns, 
  saveStoredCampaigns, 
  getMembers, 
  saveMembers, 
  getStoredTransactions, 
  saveStoredTransactions, 
  getStoredCreatorsList, 
  saveStoredCreatorsList, 
  getStoredPricingConfig, 
  saveStoredPricingConfig, 
  getStoredAnnouncement, 
  saveStoredAnnouncement, 
  getStoredAuditLogs, 
  saveStoredAuditLogs 
} from './storage';
import {
  initFirestoreRealtimeSync,
  syncTransactionToFirestore,
  syncCampaignToFirestore,
  syncMemberToFirestore,
  deleteMemberFromFirestore,
  deleteCampaignFromFirestore,
  syncCreatorToFirestore,
  syncAnnouncementToFirestore,
  pushAllLocalDataToFirestore,
  fetchCampaignByIdFromFirestore,
  fetchAllFromFirestore
} from '../services/firestoreSync';

export interface SyncDataState {
  campaigns: Campaign[];
  members: MemberRecord[];
  transactions: Transaction[];
  creators: CreatorProfile[];
  pricingConfig: SystemPricingConfig;
  announcement: AnnouncementBanner;
  auditLogs: AuditLog[];
  lastUpdated?: string;
}

// Custom event name for instant state updates across React components
export const RONPAY_SYNC_EVENT = 'ronpay_data_synced';

/**
 * Trigger sync with Firebase Firestore directly (pure serverless / Vercel compatible)
 */
export async function syncAllWithServer(): Promise<SyncDataState | null> {
  try {
    const firestoreData = await fetchAllFromFirestore();
    if (firestoreData) {
      if (Array.isArray(firestoreData.campaigns) && firestoreData.campaigns.length > 0) {
        saveStoredCampaigns(firestoreData.campaigns);
      }
      if (Array.isArray(firestoreData.members) && firestoreData.members.length > 0) {
        saveMembers(firestoreData.members);
      }
      if (Array.isArray(firestoreData.transactions) && firestoreData.transactions.length > 0) {
        saveStoredTransactions(firestoreData.transactions);
      }
      if (Array.isArray(firestoreData.creators) && firestoreData.creators.length > 0) {
        saveStoredCreatorsList(firestoreData.creators);
      }
      if (firestoreData.announcement) {
        saveStoredAnnouncement(firestoreData.announcement);
      }

      const syncState: SyncDataState = {
        campaigns: getStoredCampaigns(),
        members: getMembers(),
        transactions: getStoredTransactions(),
        creators: getStoredCreatorsList(),
        pricingConfig: getStoredPricingConfig(),
        announcement: getStoredAnnouncement(),
        auditLogs: getStoredAuditLogs(),
        lastUpdated: new Date().toISOString()
      };

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(RONPAY_SYNC_EVENT, { detail: syncState }));
      }

      return syncState;
    }
  } catch (err) {
    console.warn('Firestore direct sync deferring to local storage cache:', err);
  }
  return null;
}

/**
 * Fetch a single campaign by ID from Firestore directly if not found in local storage
 */
export async function fetchCampaignById(campaignId: string): Promise<Campaign | null> {
  if (!campaignId) return null;
  try {
    const firestoreCampaign = await fetchCampaignByIdFromFirestore(campaignId);
    if (firestoreCampaign) {
      const current = getStoredCampaigns();
      const exists = current.some(c => c.id === firestoreCampaign.id);
      if (!exists) {
        saveStoredCampaigns([firestoreCampaign, ...current]);
      }
      return firestoreCampaign;
    }
  } catch (e) {
    console.warn('Failed to fetch campaign by id from Firestore:', e);
  }
  return null;
}

/**
 * Save new or updated campaign to Firestore immediately
 */
export async function saveCampaignToServer(campaign: Campaign): Promise<void> {
  // Sync to Firestore directly
  await syncCampaignToFirestore(campaign).catch((err) => {
    console.error('Firebase Error:', err);
  });
}

/**
 * Save new member to Firestore immediately
 */
export async function saveMemberToServer(member: MemberRecord): Promise<void> {
  // Sync to Firestore directly
  await syncMemberToFirestore(member).catch((err) => {
    console.error('Firebase Error:', err);
  });
}

/**
 * Delete member on Firestore immediately
 */
export async function deleteMemberFromServer(memberId: string): Promise<void> {
  // Sync to Firestore directly
  await deleteMemberFromFirestore(memberId).catch((err) => {
    console.error('Firebase Error:', err);
  });
}

/**
 * Save transaction to Firestore immediately
 */
export async function saveTransactionToServer(tx: Transaction): Promise<void> {
  // Sync to Firestore directly
  await syncTransactionToFirestore(tx).catch((err) => {
    console.error('Firebase Error:', err);
  });
}

/**
 * Save announcement to Firestore immediately
 */
export async function saveAnnouncementToServer(ann: AnnouncementBanner): Promise<void> {
  // Sync to Firestore directly
  await syncAnnouncementToFirestore(ann).catch((err) => {
    console.error('Firebase Error:', err);
  });
}

/**
 * Starts continuous background hybrid sync engine with Firestore onSnapshot + server backup
 */
export function startAutoSyncEngine(onSyncUpdate?: (data: SyncDataState) => void): () => void {
  // 1. Start real-time Firestore listeners
  const stopFirestore = initFirestoreRealtimeSync({
    onTransactionsUpdate: (transactions) => {
      if (onSyncUpdate) {
        onSyncUpdate({
          campaigns: getStoredCampaigns(),
          members: getMembers(),
          transactions,
          creators: getStoredCreatorsList(),
          pricingConfig: getStoredPricingConfig(),
          announcement: getStoredAnnouncement(),
          auditLogs: getStoredAuditLogs()
        });
      }
    },
    onCampaignsUpdate: (campaigns) => {
      if (onSyncUpdate) {
        onSyncUpdate({
          campaigns,
          members: getMembers(),
          transactions: getStoredTransactions(),
          creators: getStoredCreatorsList(),
          pricingConfig: getStoredPricingConfig(),
          announcement: getStoredAnnouncement(),
          auditLogs: getStoredAuditLogs()
        });
      }
    },
    onMembersUpdate: (members) => {
      if (onSyncUpdate) {
        onSyncUpdate({
          campaigns: getStoredCampaigns(),
          members,
          transactions: getStoredTransactions(),
          creators: getStoredCreatorsList(),
          pricingConfig: getStoredPricingConfig(),
          announcement: getStoredAnnouncement(),
          auditLogs: getStoredAuditLogs()
        });
      }
    },
    onCreatorsUpdate: (creators) => {
      if (onSyncUpdate) {
        onSyncUpdate({
          campaigns: getStoredCampaigns(),
          members: getMembers(),
          transactions: getStoredTransactions(),
          creators,
          pricingConfig: getStoredPricingConfig(),
          announcement: getStoredAnnouncement(),
          auditLogs: getStoredAuditLogs()
        });
      }
    },
    onAnnouncementUpdate: (announcement) => {
      if (onSyncUpdate) {
        onSyncUpdate({
          campaigns: getStoredCampaigns(),
          members: getMembers(),
          transactions: getStoredTransactions(),
          creators: getStoredCreatorsList(),
          pricingConfig: getStoredPricingConfig(),
          announcement,
          auditLogs: getStoredAuditLogs()
        });
      }
    }
  });

  // 2. Initial sync with server
  syncAllWithServer().then(res => {
    if (res && onSyncUpdate) onSyncUpdate(res);
  });

  // 3. Periodic fallback sync every 15 seconds
  const intervalId = setInterval(() => {
    syncAllWithServer().then(res => {
      if (res && onSyncUpdate) onSyncUpdate(res);
    });
  }, 15000);

  // Sync on tab visibility change
  const handleVisibility = () => {
    if (document.visibilityState === 'visible') {
      syncAllWithServer().then(res => {
        if (res && onSyncUpdate) onSyncUpdate(res);
      });
    }
  };

  document.addEventListener('visibilitychange', handleVisibility);
  window.addEventListener('focus', handleVisibility);

  return () => {
    stopFirestore();
    clearInterval(intervalId);
    document.removeEventListener('visibilitychange', handleVisibility);
    window.removeEventListener('focus', handleVisibility);
  };
}
