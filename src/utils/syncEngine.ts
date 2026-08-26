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
  pushAllLocalDataToFirestore
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
 * Trigger sync with server backend (/api/data/sync or /api/data/state)
 */
export async function syncAllWithServer(): Promise<SyncDataState | null> {
  try {
    const localCampaigns = getStoredCampaigns();
    const localMembers = getMembers();
    const localTransactions = getStoredTransactions();
    const localCreators = getStoredCreatorsList();
    const localPricingConfig = getStoredPricingConfig();
    const localAnnouncement = getStoredAnnouncement();
    const localAuditLogs = getStoredAuditLogs();

    const response = await fetch('/api/data/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        campaigns: localCampaigns,
        members: localMembers,
        transactions: localTransactions,
        creators: localCreators,
        pricingConfig: localPricingConfig,
        announcement: localAnnouncement,
        auditLogs: localAuditLogs,
      }),
    });

    if (!response.ok) {
      throw new Error(`Sync server responded with status ${response.status}`);
    }

    const result = await response.json();
    if (result.success && result.data) {
      const serverData = result.data;

      // Update local storage with unified server data
      if (Array.isArray(serverData.campaigns) && serverData.campaigns.length > 0) {
        saveStoredCampaigns(serverData.campaigns);
      }
      if (Array.isArray(serverData.members)) {
        saveMembers(serverData.members);
      }
      if (Array.isArray(serverData.transactions)) {
        saveStoredTransactions(serverData.transactions);
      }
      if (Array.isArray(serverData.creators)) {
        saveStoredCreatorsList(serverData.creators);
      }
      if (serverData.pricingConfig) {
        saveStoredPricingConfig(serverData.pricingConfig);
      }
      if (serverData.announcement) {
        saveStoredAnnouncement(serverData.announcement);
      }
      if (Array.isArray(serverData.auditLogs)) {
        saveStoredAuditLogs(serverData.auditLogs);
      }

      // Dispatch event to re-render any listening UI
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(RONPAY_SYNC_EVENT, { detail: serverData }));
      }

      return serverData;
    }
  } catch (err) {
    console.warn('Network sync offline or server unreachable (using local storage):', err);
  }
  return null;
}

/**
 * Fetch a single campaign by ID from server if not found in local storage
 */
export async function fetchCampaignById(campaignId: string): Promise<Campaign | null> {
  if (!campaignId) return null;
  try {
    const res = await fetch(`/api/campaigns/${encodeURIComponent(campaignId)}`);
    if (res.ok) {
      const json = await res.json();
      if (json.success && json.campaign) {
        // Save to local storage
        const current = getStoredCampaigns();
        const exists = current.some(c => c.id === json.campaign.id);
        if (!exists) {
          saveStoredCampaigns([json.campaign, ...current]);
        }
        return json.campaign;
      }
    }
  } catch (e) {
    console.warn('Failed to fetch campaign by id from server:', e);
  }
  return null;
}

/**
 * Save new or updated campaign to Firestore & Server immediately
 */
export async function saveCampaignToServer(campaign: Campaign): Promise<void> {
  // Sync to Firestore
  syncCampaignToFirestore(campaign).catch(() => {});
  
  // Also post to local express server
  try {
    await fetch('/api/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(campaign),
    });
  } catch (e) {
    console.warn('Could not post campaign to server:', e);
  }
}

/**
 * Save new member to Firestore & Server immediately
 */
export async function saveMemberToServer(member: MemberRecord): Promise<void> {
  // Sync to Firestore
  syncMemberToFirestore(member).catch(() => {});

  // Also post to local express server
  try {
    await fetch('/api/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(member),
    });
  } catch (e) {
    console.warn('Could not post member to server:', e);
  }
}

/**
 * Delete member on Firestore & Server immediately
 */
export async function deleteMemberFromServer(memberId: string): Promise<void> {
  // Sync to Firestore
  deleteMemberFromFirestore(memberId).catch(() => {});

  // Also delete on server
  try {
    await fetch(`/api/members/${encodeURIComponent(memberId)}`, {
      method: 'DELETE',
    });
  } catch (e) {
    console.warn('Could not delete member on server:', e);
  }
}

/**
 * Save transaction to Firestore & Server immediately
 */
export async function saveTransactionToServer(tx: Transaction): Promise<void> {
  // Sync to Firestore
  syncTransactionToFirestore(tx).catch(() => {});

  // Also post to local server
  try {
    await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tx),
    });
  } catch (e) {
    console.warn('Could not post transaction to server:', e);
  }
}

/**
 * Save announcement to Firestore & Server immediately
 */
export async function saveAnnouncementToServer(ann: AnnouncementBanner): Promise<void> {
  // Sync to Firestore
  syncAnnouncementToFirestore(ann).catch(() => {});

  try {
    await fetch('/api/announcement', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ann),
    });
  } catch (e) {
    console.warn('Could not post announcement to server:', e);
  }
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
