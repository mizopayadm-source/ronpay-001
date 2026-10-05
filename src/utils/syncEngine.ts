import { Campaign, MemberRecord, Transaction, CreatorProfile, SystemPricingConfig, AnnouncementBanner, AuditLog, StaffAccount, KumtluangExpense } from '../types';
import { resolveApiUrl } from './apiConfig';
import { BCM_EBENEZER_DEFAULT_LOGO, INITIAL_TRANSACTIONS } from '../data/initialData';
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
  getStoredStaffAccounts,
  saveStoredStaffAccounts,
  getDeletedTransactionIds,
  markTransactionAsDeleted,
  getDeletedCampaignIds,
  recordDeletedCampaignId,
  getDeletedMemberIds,
  markMemberAsDeleted,
  getDeletedStaffIds,
  markStaffAsDeleted,
  getStoredExpenses,
  saveStoredExpenses,
  getDeletedExpenseIds,
  markExpenseAsDeleted,
  broadcastTabSync,
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
  staffAccounts?: StaffAccount[];
  expenses?: KumtluangExpense[];
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
    staffAccounts: getStoredStaffAccounts(),
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
export async function syncAllWithServer(forceAuthoritative: boolean = false): Promise<SyncDataState | null> {
  // 1. Check network connectivity: browser navigator + Firestore listener state
  const isOnline = (typeof navigator !== 'undefined' ? navigator.onLine : true) && isOnlineState();
  if (!isOnline && !forceAuthoritative) {
    // Return local cache immediately without making any network calls
    return getLocalFallbackState();
  }

  // 2. Check exponential backoff wait period (bypassed if forceAuthoritative)
  const now = Date.now();
  if (!forceAuthoritative && now < nextAllowedSyncTime) {
    // Connection recently dropped or reset; reuse local cached state
    return getLocalFallbackState();
  }

  // 3. Deduplicate simultaneous sync requests (bypassed if forceAuthoritative)
  if (!forceAuthoritative && inFlightSyncPromise) {
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
      const localStaff = getStoredStaffAccounts();

      // Set up 8-second request timeout to avoid hung connections
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timeoutId = controller ? setTimeout(() => controller.abort(), 8000) : null;

      const deletedTxSet = getDeletedTransactionIds();
      const unsyncedTransactions = localTransactions.filter(t => 
        t && t.id && !deletedTxSet.has(String(t.id).toLowerCase().trim()) && (t.isSynced === false || (t as any).isOfflinePending)
      );

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
          deletedMemberIds: Array.from(getDeletedMemberIds()),
          transactions: unsyncedTransactions,
          deletedTransactionIds: Array.from(deletedTxSet),
          creators: localCreators,
          pricingConfig: localPricingConfig,
          announcement: localAnnouncement,
          auditLogs: localAuditLogs,
          staffAccounts: localStaff,
          deletedStaffIds: Array.from(getDeletedStaffIds()),
          expenses: getStoredExpenses(),
          deletedExpenseIds: Array.from(getDeletedExpenseIds())
        }),
      });

      if (timeoutId) clearTimeout(timeoutId);

      let serverData: any = null;

      if (response.ok) {
        try {
          const result = await response.json();
          if (result && result.success && result.data) {
            serverData = result.data;
          }
        } catch {}
      }

      // Fallback for static hosts (e.g. ronpay.app on Cloudflare Pages or Vercel without Node.js backend)
      if (!serverData) {
        try {
          const dbResp = await fetch('/ronpay_db.json', { cache: 'no-cache' });
          if (dbResp.ok) {
            const dbData = await dbResp.json();
            if (dbData && (Array.isArray(dbData.campaigns) || Array.isArray(dbData.transactions))) {
              serverData = dbData;
            }
          }
        } catch (dbErr) {
          console.warn('Fallback static /ronpay_db.json fetch note:', dbErr);
        }
      }

      if (!serverData) {
        throw new Error(`Sync server responded with status ${response.status}`);
      }

      if (serverData) {
        // Successful sync: reset failure backoff
        syncFailureCount = 0;
        nextAllowedSyncTime = 0;

        // 1. Process server tombstone records first to purge any deleted records
        if (Array.isArray(serverData.deletedCampaignIds)) {
          for (const dId of serverData.deletedCampaignIds) {
            recordDeletedCampaignId(dId);
          }
        }
        if (Array.isArray(serverData.deletedMemberIds)) {
          for (const mId of serverData.deletedMemberIds) {
            markMemberAsDeleted(mId);
          }
        }
        if (Array.isArray(serverData.deletedTransactionIds)) {
          for (const tId of serverData.deletedTransactionIds) {
            markTransactionAsDeleted(tId);
          }
        }
        if (Array.isArray(serverData.deletedStaffIds)) {
          for (const sId of serverData.deletedStaffIds) {
            markStaffAsDeleted(sId);
          }
        }
        if (Array.isArray(serverData.deletedExpenseIds)) {
          for (const eId of serverData.deletedExpenseIds) {
            markExpenseAsDeleted(eId);
          }
        }

        // 2. Update campaigns
        if (Array.isArray(serverData.campaigns)) {
          const deletedCampIds = getDeletedCampaignIds();
          const localCampaigns = getStoredCampaigns();
          const localMap = new Map(localCampaigns.map(c => [String(c.id).toLowerCase().trim(), c]));
          const isCustom = (url?: string) => url && typeof url === 'string' && !url.includes('unsplash.com');

          const cleanServerCampaigns = serverData.campaigns
            .filter((c: any) => c && c.id && (!deletedCampIds.has(String(c.id).toLowerCase().trim()) || String(c.id).toLowerCase().trim() === 'cmp-1788107291420'))
            .map((sc: any) => {
              const local = localMap.get(String(sc.id).toLowerCase().trim());
              if (!local) return sc;
              const localTime = local.updatedAt ? new Date(local.updatedAt).getTime() : 0;
              const serverTime = sc.updatedAt ? new Date(sc.updatedAt).getTime() : 0;
              const updated = localTime >= serverTime ? { ...sc, ...local } : { ...local, ...sc };

              // Protect officerPasscode, presets, and group protection settings from stale server overwrite
              if (local.officerPasscode && (!updated.officerPasscode || localTime >= serverTime)) {
                updated.officerPasscode = local.officerPasscode;
              }
              if (typeof local.allowPublicGroupDeposits === 'boolean' && localTime >= serverTime) {
                updated.allowPublicGroupDeposits = local.allowPublicGroupDeposits;
              }
              if (Array.isArray(local.groupPresets) && local.groupPresets.length > 0 && (!Array.isArray(updated.groupPresets) || updated.groupPresets.length === 0 || localTime >= serverTime)) {
                updated.groupPresets = local.groupPresets;
              }
              // Protect local custom uploaded logo from being overwritten by server unsplash or empty logo
              if (isCustom(local.imageUrl) && !isCustom(updated.imageUrl)) {
                updated.imageUrl = local.imageUrl;
              }
              // If local has newer timestamp and a custom logo, local keeps its image
              if (local.updatedAt && sc.updatedAt && localTime > serverTime && isCustom(local.imageUrl)) {
                updated.imageUrl = local.imageUrl;
              }
              // Ensure BCM Ebenezer always has valid church photo
              if (updated.id === 'cmp-kumtluang-1' || String(updated.title).toLowerCase().includes('bcm ebenezer')) {
                if (!updated.imageUrl || updated.imageUrl.includes('unsplash.com') || updated.imageUrl.includes('photo-1548625361-195feee10fce')) {
                  updated.imageUrl = BCM_EBENEZER_DEFAULT_LOGO;
                }
              }
              return updated;
            });
          saveStoredCampaigns(cleanServerCampaigns, true);
          serverData.campaigns = cleanServerCampaigns;
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('ronpay_campaigns_updated', { detail: cleanServerCampaigns }));
            window.dispatchEvent(new CustomEvent('ronpay-campaigns-updated', { detail: cleanServerCampaigns }));
          }
        }

        // 3. Update members with authoritative server seeding & deletion protection
        if (Array.isArray(serverData.members) && serverData.members.length > 0) {
          const deletedMemIds = getDeletedMemberIds();
          const cleanServerMembers = serverData.members.filter((m: any) => {
            if (!m || !m.id) return false;
            const name = String(m.name || m.fullName || '').trim();
            return name.length >= 2 && !deletedMemIds.has(String(m.id).toLowerCase().trim());
          });

          const localMembers = getMembers('all').filter(m => {
            if (!m || !m.id) return false;
            const name = String(m.name || (m as any).fullName || '').trim();
            if (name.length <= 1) {
              markMemberAsDeleted(m.id);
              return false;
            }
            return !deletedMemIds.has(String(m.id).toLowerCase().trim());
          });

          const memMap = new Map<string, any>();
          
          // Seed authoritative server members first
          for (const sm of cleanServerMembers) {
            memMap.set(String(sm.id).toLowerCase().trim(), sm);
          }

          // Merge local members only if not forceAuthoritative or if genuine offline pending
          for (const lm of localMembers) {
            const k = String(lm.id).toLowerCase().trim();
            if (!memMap.has(k)) {
              if ((lm as any).isOfflinePending || (!forceAuthoritative && (Date.now() - new Date(lm.createdAt || 0).getTime() < 24 * 3600 * 1000))) {
                memMap.set(k, lm);
              }
            } else {
              const existing = memMap.get(k);
              const localTime = new Date(lm.updatedAt || lm.createdAt || 0).getTime();
              const serverTime = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
              if (localTime > serverTime) {
                memMap.set(k, { ...existing, ...lm });
              }
            }
          }

          const finalMembers = Array.from(memMap.values());
          saveMembers(finalMembers, true);
          serverData.members = finalMembers;
        }

        // 4. Update transactions
        if (Array.isArray(serverData.transactions)) {
          const deletedIds = getDeletedTransactionIds();
          if (Array.isArray(serverData.deletedTransactionIds)) {
            for (const tId of serverData.deletedTransactionIds) {
              deletedIds.add(String(tId).toLowerCase().trim());
            }
          }
          const currentTxs = getStoredTransactions();
          const txMap = new Map<string, any>();
          const nowMs = Date.now();

          // 1. Seed canonical baseline transactions so official records are NEVER purged
          for (const it of INITIAL_TRANSACTIONS) {
            if (it && it.id) {
              const k = String(it.id).toLowerCase().trim();
              if (!deletedIds.has(k)) {
                txMap.set(k, it);
              }
            }
          }

          // 2. Overlay authoritative server transactions
          for (const t of serverData.transactions) {
            if (t && t.id) {
              const k = String(t.id).toLowerCase().trim();
              if (!deletedIds.has(k)) {
                const existing = txMap.get(k);
                txMap.set(k, existing ? { ...existing, ...t } : t);
              }
            }
          }

          // Check if local storage was corrupted / inflated (e.g. ₹13,00,950 vs server ₹2,77,875.9)
          const serverConfirmedSum = serverData.transactions
            .filter((t: any) => {
              const s = (t.status || '').toLowerCase().trim();
              return s === 'completed' || s === 'success' || s === 'verified';
            })
            .reduce((sum: number, t: any) => sum + (Number(t.amount) || 0), 0);

          const localConfirmedSum = currentTxs
            .filter(t => {
              const s = (t.status || '').toLowerCase().trim();
              return s === 'completed' || s === 'success' || s === 'verified';
            })
            .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
          
          const isLocalInflated = localConfirmedSum > Math.max(1000000, serverConfirmedSum * 2);

          // Merge local transactions only if not forcing authoritative and not corrupted
          if (!forceAuthoritative && !isLocalInflated) {
            const newLocalTxsToPush: Transaction[] = [];
            for (const t of currentTxs) {
              if (t && t.id) {
                const k = String(t.id).toLowerCase().trim();
                if (deletedIds.has(k)) continue;
                const amt = Number(t.amount);
                if (!isFinite(amt) || isNaN(amt) || amt <= 0 || amt > 500000) continue;

                if (!txMap.has(k)) {
                  // Only preserve genuine pending offline transactions created in last 24 hours
                  const tTime = new Date(t.createdAt || t.timestamp || 0).getTime();
                  if (nowMs - tTime < 24 * 3600 * 1000) {
                    txMap.set(k, t);
                    newLocalTxsToPush.push(t);
                  }
                }
              }
            }

            // If there are genuine recent local transactions, push them to server
            if (newLocalTxsToPush.length > 0) {
              safeApiFetch('/api/data/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ transactions: newLocalTxsToPush })
              }).catch(() => {});
            }
          }

          const cleanTxs = Array.from(txMap.values());
          cleanTxs.sort((a, b) => {
            const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
            const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
            return timeB - timeA;
          });
          saveStoredTransactions(cleanTxs, true);
          serverData.transactions = cleanTxs;
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('ronpay_transactions_updated', { detail: cleanTxs }));
          }
        }

        // 5. Update creators
        if (Array.isArray(serverData.creators)) {
          saveStoredCreatorsList(serverData.creators, true);
        }

        // 6. Update staff accounts
        if (Array.isArray(serverData.staffAccounts)) {
          const deletedStaff = getDeletedStaffIds();
          const cleanStaff = serverData.staffAccounts.filter((s: any) => s && s.id && !deletedStaff.has(String(s.id).trim()));
          saveStoredStaffAccounts(cleanStaff);
        }

        // 7. Update pricing config
        if (serverData.pricingConfig) {
          saveStoredPricingConfig(serverData.pricingConfig, true);
        }

        // 8. Update announcement
        if (serverData.announcement) {
          saveStoredAnnouncement(serverData.announcement, true);
        }

        // 9. Update audit logs
        if (Array.isArray(serverData.auditLogs)) {
          saveStoredAuditLogs(serverData.auditLogs);
        }

        // 10. Update expenses (NGO / Kumtluang Expenditure desk)
        if (Array.isArray(serverData.deletedExpenseIds)) {
          serverData.deletedExpenseIds.forEach((id: string) => {
            if (id) markExpenseAsDeleted(String(id).toLowerCase().trim());
          });
        }
        if (Array.isArray(serverData.expenses)) {
          const deletedExpSet = getDeletedExpenseIds();
          const cleanServerExpenses = serverData.expenses.filter((e: any) => e && e.id && !deletedExpSet.has(String(e.id).toLowerCase().trim()));
          const localExpenses = getStoredExpenses().filter(e => e && e.id && !deletedExpSet.has(String(e.id).toLowerCase().trim()));
          const expMap = new Map<string, any>();
          for (const se of cleanServerExpenses) {
            expMap.set(String(se.id).toLowerCase().trim(), se);
          }
          for (const le of localExpenses) {
            const k = String(le.id).toLowerCase().trim();
            if (!expMap.has(k)) {
              expMap.set(k, le);
            } else {
              const existing = expMap.get(k);
              const localTime = new Date(le.updatedAt || le.recordedAt || le.spentDate || 0).getTime();
              const serverTime = new Date(existing.updatedAt || existing.recordedAt || existing.spentDate || 0).getTime();
              if (localTime > serverTime) {
                expMap.set(k, { ...existing, ...le });
              }
            }
          }
          const finalExpenses = Array.from(expMap.values());
          finalExpenses.sort((a, b) => {
            const timeA = new Date(a.spentDate || a.recordedAt || 0).getTime();
            const timeB = new Date(b.spentDate || b.recordedAt || 0).getTime();
            return timeB - timeA;
          });
          saveStoredExpenses(finalExpenses, true);
          serverData.expenses = finalExpenses;
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('ronpay_expenses_updated', { detail: finalExpenses }));
          }
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

  // 2. Initial sync with server - disabled to make sync purely event-driven
  // syncAllWithServer().then(res => { if (res && onSyncUpdate) onSyncUpdate(res); }).catch(() => {});

  // 3. Same-browser cross-tab & cross-window synchronization via BroadcastChannel
  let broadcastChannel: BroadcastChannel | null = null;
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    try {
      broadcastChannel = new BroadcastChannel('ronpay_realtime_sync');
      broadcastChannel.onmessage = (ev) => {
        if (ev && ev.data && onSyncUpdate) {
          onSyncUpdate(getLocalFallbackState());
        }
      };
    } catch (e) {}
  }

  // 4. Cross-window storage listener for local key changes across browser windows
  const handleStorageChange = (e: StorageEvent) => {
    if (!e.key) return;
    if (e.key.startsWith('ronpay_')) {
      if (onSyncUpdate) {
        onSyncUpdate(getLocalFallbackState());
      }
    }
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', handleStorageChange);
  }

  // 5. Server-Sent Events (SSE) for instant sub-second multi-device synchronization
  let eventSource: EventSource | null = null;
  let sseReconnectTimer: any = null;
  if (typeof window !== 'undefined' && 'EventSource' in window) {
    const connectSSE = () => {
      try {
        eventSource = new EventSource(resolveApiUrl('/api/data/events'));
        eventSource.onmessage = (event) => {
          try {
            const parsed = JSON.parse(event.data);
            if (parsed && (parsed.type === 'data_changed' || parsed.type === 'message')) {
              syncAllWithServer(true).then(res => {
                if (res && onSyncUpdate) onSyncUpdate(res);
              }).catch(() => {});
            }
          } catch {}
        };
        eventSource.onerror = () => {
          if (eventSource) {
            eventSource.close();
            eventSource = null;
          }
          if (!sseReconnectTimer) {
            sseReconnectTimer = setTimeout(() => {
              sseReconnectTimer = null;
              connectSSE();
            }, 10000);
          }
        };
      } catch (err) {
        console.warn('SSE connection note:', err);
      }
    };
    connectSSE();

    // Mobile & multi-browser resume listener: When user opens app or brings phone screen back from sleep
    const handleVisibilityOrOnline = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        if (!eventSource) {
          connectSSE();
        }
        syncAllWithServer().then(res => {
          if (res && onSyncUpdate) onSyncUpdate(res);
        }).catch(() => {});
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityOrOnline);
    window.addEventListener('online', handleVisibilityOrOnline);
  }

  return () => {
    stopFirestore();
    if (broadcastChannel) {
      broadcastChannel.close();
      broadcastChannel = null;
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', handleStorageChange);
    }
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
    if (sseReconnectTimer) {
      clearTimeout(sseReconnectTimer);
      sseReconnectTimer = null;
    }
  };
}

/**
 * High-speed Server-Sent Events (SSE) listener for instant sub-second multi-device / multi-user data synchronization.
 * Guarantees phones, browsers, and different user sessions stay in lockstep without delay.
 */
export function subscribeServerEvents(onChanged: () => void): () => void {
  if (typeof window === 'undefined' || !('EventSource' in window)) {
    return () => {};
  }

  let eventSource: EventSource | null = null;
  let sseReconnectTimer: any = null;
  let isClosed = false;

  const connect = () => {
    if (isClosed) return;
    try {
      eventSource = new EventSource(resolveApiUrl('/api/data/events'));

      eventSource.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          if (parsed && (parsed.type === 'data_changed' || parsed.type === 'message')) {
            onChanged();
          }
        } catch {}
      };

      eventSource.onerror = () => {
        if (eventSource) {
          eventSource.close();
          eventSource = null;
        }
        if (!isClosed && !sseReconnectTimer) {
          sseReconnectTimer = setTimeout(() => {
            sseReconnectTimer = null;
            connect();
          }, 3000);
        }
      };
    } catch {
      if (!isClosed && !sseReconnectTimer) {
        sseReconnectTimer = setTimeout(() => {
          sseReconnectTimer = null;
          connect();
        }, 5000);
      }
    }
  };

  connect();

  const handleVisibility = () => {
    if (document.visibilityState === 'visible' && !isClosed) {
      if (!eventSource) {
        connect();
      }
      onChanged();
    }
  };

  const handleOnline = () => {
    if (!isClosed) {
      if (!eventSource) {
        connect();
      }
      onChanged();
    }
  };

  document.addEventListener('visibilitychange', handleVisibility);
  window.addEventListener('online', handleOnline);

  return () => {
    isClosed = true;
    if (sseReconnectTimer) {
      clearTimeout(sseReconnectTimer);
      sseReconnectTimer = null;
    }
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
    document.removeEventListener('visibilitychange', handleVisibility);
    window.removeEventListener('online', handleOnline);
  };
}
