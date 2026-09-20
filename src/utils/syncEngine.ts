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
  saveStoredAuditLogs,
  getDeletedTransactionIds,
  getDeletedCampaignIds,
  recordDeletedCampaignId,
  safeApiFetch
} from './storage';
import {
  initFirestoreRealtimeSync,
  syncTransactionToFirestore,
  syncCampaignToFirestore,
  syncMemberToFirestore,
  deleteMemberFromFirestore,
  deleteCampaignFromFirestore,
  deleteTransactionFromFirestore,
  syncCreatorToFirestore,
  syncAnnouncementToFirestore,
  syncPricingConfigToFirestore,
  pushAllLocalDataToFirestore,
  isOnlineState
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

// Exponential backoff and network loop protection
let syncFailureCount = 0;
let nextAllowedSyncTime = 0;
let inFlightSyncPromise: Promise<SyncDataState | null> | null = null;
let lastSyncWarnTime = 0;

/**
 * Fast synchronous retrieval of current local state for immediate fallback
 */
export function getLocalFallbackState(): SyncDataState {
  return {
    campaigns: getStoredCampaigns(),
    members: getMembers(),
    transactions: getStoredTransactions(),
    creators: getStoredCreatorsList(),
    pricingConfig: getStoredPricingConfig(),
    announcement: getStoredAnnouncement(),
    auditLogs: getStoredAuditLogs(),
    lastUpdated: new Date().toISOString()
  };
}

// Listen for network reconnect to immediately reset backoff and sync gently
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    syncFailureCount = 0;
    nextAllowedSyncTime = 0;
    setTimeout(() => {
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        syncAllWithServer().catch(() => {});
      }
    }, 2500);
  });
  window.addEventListener('offline', () => {
    // When offline, halt server sync attempts for at least 1 minute
    nextAllowedSyncTime = Date.now() + 60000;
  });
}

/**
 * Trigger sync with server backend (/api/data/sync or /api/data/state)
 * Includes exponential backoff, offline checking, and fallback local cache
 */
export async function syncAllWithServer(): Promise<SyncDataState | null> {
  // 1. Check network connectivity: browser navigator + Firestore listener state
  const isOnline = (typeof navigator !== 'undefined' ? navigator.onLine : true) && isOnlineState();
  if (!isOnline) {
    // Return local cache immediately without making any network calls
    return getLocalFallbackState();
  }

  // 2. Check exponential backoff wait period
  const now = Date.now();
  if (now < nextAllowedSyncTime) {
    // Connection recently dropped or reset; reuse local cached state
    return getLocalFallbackState();
  }

  // 3. Deduplicate simultaneous sync requests
  if (inFlightSyncPromise) {
    return inFlightSyncPromise;
  }

  inFlightSyncPromise = (async () => {
    try {
      const localCampaigns = getStoredCampaigns();
      const localMembers = getMembers();
      const localTransactions = getStoredTransactions();
      const localCreators = getStoredCreatorsList();
      const localPricingConfig = getStoredPricingConfig();
      const localAnnouncement = getStoredAnnouncement();
      const localAuditLogs = getStoredAuditLogs();

      // Set up 8-second request timeout to avoid hung connections
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timeoutId = controller ? setTimeout(() => controller.abort(), 8000) : null;

      const response = await fetch('/api/data/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller ? controller.signal : undefined,
        body: JSON.stringify({
          campaigns: localCampaigns,
          deletedCampaignIds: Array.from(getDeletedCampaignIds()),
          members: localMembers,
          transactions: localTransactions,
          deletedTransactionIds: Array.from(getDeletedTransactionIds()),
          creators: localCreators,
          pricingConfig: localPricingConfig,
          announcement: localAnnouncement,
          auditLogs: localAuditLogs,
        }),
      });

      if (timeoutId) clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Sync server responded with status ${response.status}`);
      }

      const result = await response.json();
      if (result.success && result.data) {
        // Successful sync: reset failure backoff
        syncFailureCount = 0;
        nextAllowedSyncTime = 0;

        const serverData = result.data;

        // Update local storage with unified server data
        if (Array.isArray(serverData.deletedCampaignIds)) {
          for (const dId of serverData.deletedCampaignIds) {
            recordDeletedCampaignId(dId);
          }
        }

        if (Array.isArray(serverData.campaigns)) {
          const deletedCampIds = getDeletedCampaignIds();
          const cleanServerCampaigns = serverData.campaigns.filter(
            (c: any) => c && c.id && !deletedCampIds.has(String(c.id).toLowerCase().trim())
          );
          saveStoredCampaigns(cleanServerCampaigns, true);
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('ronpay_campaigns_updated', { detail: cleanServerCampaigns }));
            window.dispatchEvent(new CustomEvent('ronpay-campaigns-updated', { detail: cleanServerCampaigns }));
          }
        }
        if (Array.isArray(serverData.members) && serverData.members.length > 0) {
          const localMembers = getMembers('all');
          const memMap = new Map<string, any>();
          for (const m of localMembers) {
            if (m && m.id) memMap.set(m.id.toLowerCase(), m);
          }
          for (const m of serverData.members) {
            if (m && m.id) {
              const k = m.id.toLowerCase();
              memMap.set(k, { ...(memMap.get(k) || {}), ...m });
            }
          }
          saveMembers(Array.from(memMap.values()));
        }
        if (Array.isArray(serverData.transactions) && serverData.transactions.length > 0) {
          const deletedIds = getDeletedTransactionIds();
          const currentTxs = getStoredTransactions();
          const txMap = new Map<string, any>();
          for (const t of currentTxs) {
            if (t && t.id && !deletedIds.has(String(t.id).toLowerCase().trim())) {
              txMap.set(String(t.id).toLowerCase().trim(), t);
            }
          }
          for (const t of serverData.transactions) {
            if (t && t.id && !deletedIds.has(String(t.id).toLowerCase().trim())) {
              const k = String(t.id).toLowerCase().trim();
              txMap.set(k, { ...(txMap.get(k) || {}), ...t });
            }
          }
          const cleanTxs = Array.from(txMap.values());
          cleanTxs.sort((a, b) => {
            const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
            const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
            return timeB - timeA;
          });
          saveStoredTransactions(cleanTxs, true);
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('ronpay_transactions_updated', { detail: cleanTxs }));
          }
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
    } catch (err: any) {
      // Exponential backoff: 3s -> 4.5s -> 7s -> 10s -> max 30s
      syncFailureCount++;
      const baseDelay = Math.min(30000, 3000 * Math.pow(1.5, Math.min(syncFailureCount - 1, 5)));
      const jitter = Math.floor(Math.random() * 500);
      nextAllowedSyncTime = Date.now() + baseDelay + jitter;

      // Throttle warning log to at most once per 20s so console error spam is completely stopped
      const timeSinceLastWarn = Date.now() - lastSyncWarnTime;
      if (timeSinceLastWarn > 20000) {
        lastSyncWarnTime = Date.now();
        console.info(`[RonPay Sync] Network standby mode active (backoff ${(baseDelay / 1000).toFixed(1)}s, using local fallback cache).`);
      }

      return getLocalFallbackState();
    } finally {
      inFlightSyncPromise = null;
    }
    return getLocalFallbackState();
  })();

  return inFlightSyncPromise;
}

/**
 * Fetch a single campaign by ID from server if not found in local storage
 */
export async function fetchCampaignById(campaignId: string): Promise<Campaign | null> {
  if (!campaignId) return null;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return null;
  try {
    const res = await safeApiFetch(`/api/campaigns/${encodeURIComponent(campaignId)}`);
    if (res && res.ok) {
      const json = await res.json();
      if (json.success && json.campaign) {
        const current = getStoredCampaigns();
        const exists = current.some(c => c.id === json.campaign.id);
        if (!exists) {
          saveStoredCampaigns([json.campaign, ...current]);
        }
        return json.campaign;
      }
    }
  } catch {}
  return null;
}

/**
 * Save new or updated campaign to Firestore & Server immediately
 */
export async function saveCampaignToServer(campaign: Campaign): Promise<void> {
  // 1. Direct write to Firestore
  await syncCampaignToFirestore(campaign);
  
  // 2. Also post to local express server
  safeApiFetch('/api/campaigns', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(campaign),
  });
}

/**
 * Save new member to Firestore & Server immediately
 */
export async function saveMemberToServer(member: MemberRecord): Promise<void> {
  // 1. Direct write to Firestore
  await syncMemberToFirestore(member);

  // 2. Also post to local express server
  safeApiFetch('/api/members', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(member),
  });
}

/**
 * Delete member on Firestore & Server immediately
 */
export async function deleteMemberFromServer(memberId: string): Promise<void> {
  // 1. Direct delete on Firestore
  await deleteMemberFromFirestore(memberId);

  // 2. Also delete on server
  safeApiFetch(`/api/members/${encodeURIComponent(memberId)}`, {
    method: 'DELETE',
  });
}

/**
 * Save transaction to Firestore & Server immediately
 */
export async function saveTransactionToServer(tx: Transaction): Promise<void> {
  // 1. Direct write to Firestore
  await syncTransactionToFirestore(tx);

  // 2. Also post to local server
  safeApiFetch('/api/transactions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(tx),
  });
}

/**
 * Save announcement to Firestore & Server immediately
 */
export async function saveAnnouncementToServer(ann: AnnouncementBanner): Promise<void> {
  await syncAnnouncementToFirestore(ann);

  safeApiFetch('/api/announcement', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(ann),
  });
}

/**
 * Starts continuous background hybrid sync engine with Firestore onSnapshot + server backup
 */
export function startAutoSyncEngine(onSyncUpdate?: (data: SyncDataState) => void): () => void {
  // 1. Start real-time Firestore listeners
  const stopFirestore = initFirestoreRealtimeSync({
    onTransactionsUpdate: (transactions) => {
      try {
        localStorage.setItem('ronpay_transactions_v2', JSON.stringify(transactions));
      } catch (e) {}
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
      try {
        localStorage.setItem('ronpay_campaigns_v2', JSON.stringify(campaigns));
      } catch (e) {}
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
      try {
        localStorage.setItem('ronpay_kumtluang_members_v1', JSON.stringify(members));
      } catch (e) {}
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
      try {
        localStorage.setItem('ronpay_creators_list_v2', JSON.stringify(creators));
      } catch (e) {}
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
      try {
        localStorage.setItem('ronpay_announcement_v1', JSON.stringify(announcement));
      } catch (e) {}
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
    },
    onPricingConfigUpdate: (pricingConfig) => {
      try {
        localStorage.setItem('ronpay_pricing_config_v1', JSON.stringify(pricingConfig));
      } catch (e) {}
      if (onSyncUpdate) {
        onSyncUpdate({
          campaigns: getStoredCampaigns(),
          members: getMembers(),
          transactions: getStoredTransactions(),
          creators: getStoredCreatorsList(),
          pricingConfig,
          announcement: getStoredAnnouncement(),
          auditLogs: getStoredAuditLogs()
        });
      }
    },
    onAuditLogsUpdate: (auditLogs) => {
      try {
        localStorage.setItem('ronpay_audit_logs_v1', JSON.stringify(auditLogs));
      } catch (e) {}
      if (onSyncUpdate) {
        onSyncUpdate({
          campaigns: getStoredCampaigns(),
          members: getMembers(),
          transactions: getStoredTransactions(),
          creators: getStoredCreatorsList(),
          pricingConfig: getStoredPricingConfig(),
          announcement: getStoredAnnouncement(),
          auditLogs
        });
      }
    }
  });

  // 2. Initial sync with server
  syncAllWithServer().then(res => {
    if (res && onSyncUpdate) onSyncUpdate(res);
  }).catch(() => {});

  // 3. Periodic fallback sync every 25 seconds (respects backoff & offline status)
  const intervalId = setInterval(() => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    if (Date.now() < nextAllowedSyncTime) return;
    syncAllWithServer().then(res => {
      if (res && onSyncUpdate) onSyncUpdate(res);
    }).catch(() => {});
  }, 25000);

  // Sync on tab visibility change (only if online and not in backoff)
  const handleVisibility = () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    if (Date.now() < nextAllowedSyncTime) return;
    if (document.visibilityState === 'visible') {
      syncAllWithServer().then(res => {
        if (res && onSyncUpdate) onSyncUpdate(res);
      }).catch(() => {});
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
