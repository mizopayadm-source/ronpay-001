import { Campaign, MemberRecord, Transaction, CreatorProfile, SystemPricingConfig, AnnouncementBanner, AuditLog, StaffAccount, KumtluangExpense } from '../types';
import { supabase } from '../lib/supabase';
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
  PROTECTED_CANONICAL_TX_IDS,
  CANONICAL_BMP_RECEIPTS,
  PERMANENTLY_PURGED_TX_IDS,
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
  getStoredAuditorGrants,
  saveStoredAuditorGrants,
  getStoredDeletedAuditorGrantIds,
  saveStoredDeletedAuditorGrantIds,
  syncAuditorGrantsAcrossCloud,
  MODIFICATION_REQUESTS_KEY,
  broadcastTabSync,
  safeApiFetch,
  SYSTEM_HARD_PURGE_TIMESTAMP
} from './storage';
import {
  syncCampaignToFirestore,
  syncMemberToFirestore,
  deleteMemberFromFirestore,
  syncTransactionToFirestore,
  syncAnnouncementToFirestore,
  initFirestoreRealtimeSync,
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
  const isOnline = (typeof navigator !== 'undefined' ? navigator.onLine : true);
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
      const unsyncedTransactions = localTransactions.filter(t => {
        if (!t || !t.id) return false;
        const cleanId = String(t.id).toLowerCase().trim();
        if (deletedTxSet.has(cleanId) || PERMANENTLY_PURGED_TX_IDS.has(cleanId)) return false;
        return (t.isSynced !== true || (t as any).isOfflinePending);
      });

      const response = await fetch('/api/data/state', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-is-admin': 'true',
          'x-user-role': 'SUPER_ADMIN',
          'x-user-phone': '9862000001',
        },
        signal: controller ? controller.signal : undefined,
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
        if (Array.isArray(serverData.deletedAuditorGrantIds) && serverData.deletedAuditorGrantIds.length > 0) {
          saveStoredDeletedAuditorGrantIds([
            ...getStoredDeletedAuditorGrantIds(),
            ...serverData.deletedAuditorGrantIds
          ]);
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
              if (Array.isArray(local.definedSections) && local.definedSections.length > 0 && (!Array.isArray(updated.definedSections) || updated.definedSections.length === 0 || localTime >= serverTime)) {
                updated.definedSections = local.definedSections;
              }
              if (local.sectionLabel && (!updated.sectionLabel || localTime >= serverTime)) {
                updated.sectionLabel = local.sectionLabel;
              }
              if (Array.isArray(local.generalPresets) && local.generalPresets.length > 0 && (!Array.isArray(updated.generalPresets) || updated.generalPresets.length === 0 || localTime >= serverTime)) {
                updated.generalPresets = local.generalPresets;
              }
              if (Array.isArray(local.subCategories) && local.subCategories.length > 0 && (!Array.isArray(updated.subCategories) || updated.subCategories.length === 0 || localTime >= serverTime)) {
                updated.subCategories = local.subCategories;
              }
              if (typeof local.openingBalance === 'number' && local.openingBalance > 0 && (!updated.openingBalance || localTime >= serverTime)) {
                updated.openingBalance = local.openingBalance;
              } else if (typeof sc.openingBalance === 'number' && sc.openingBalance > 0 && !updated.openingBalance) {
                updated.openingBalance = sc.openingBalance;
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

          // Merge and preserve locally created campaigns that are not yet returned by serverData
          const mergedCampaigns = [...cleanServerCampaigns];
          const serverIdSet = new Set(cleanServerCampaigns.map(c => String(c.id).toLowerCase().trim()));

          for (const localCamp of localCampaigns) {
            if (!localCamp || !localCamp.id) continue;
            const lId = String(localCamp.id).toLowerCase().trim();
            if (!deletedCampIds.has(lId) && !serverIdSet.has(lId)) {
              mergedCampaigns.push(localCamp);
              serverIdSet.add(lId);
              // Asynchronously push local campaign to server
              safeApiFetch('/api/campaigns', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(localCamp)
              });
            }
          }

          saveStoredCampaigns(mergedCampaigns, true);
          serverData.campaigns = mergedCampaigns;
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('ronpay_campaigns_updated', { detail: mergedCampaigns }));
            window.dispatchEvent(new CustomEvent('ronpay-campaigns-updated', { detail: mergedCampaigns }));
          }
        }

        // 3. Update members with authoritative server seeding & deletion protection
        if (Array.isArray(serverData.deletedMemberIds) && serverData.deletedMemberIds.length > 0) {
          for (const dId of serverData.deletedMemberIds) {
            markMemberAsDeleted(String(dId).toLowerCase().trim());
          }
        }

        if (Array.isArray(serverData.members)) {
          const deletedMemIds = getDeletedMemberIds();
          const cleanServerMembers = serverData.members.filter((m: any) => {
            if (!m || !m.id) return false;
            const cleanId = String(m.id).toLowerCase().trim();
            const name = String(m.name || m.fullName || '').trim();
            return name.length >= 2 && !deletedMemIds.has(cleanId);
          });

          const localMembers = getMembers('all').filter(m => {
            if (!m || !m.id) return false;
            const cleanId = String(m.id).toLowerCase().trim();
            const name = String(m.name || (m as any).fullName || '').trim();
            if (name.length <= 1) {
              markMemberAsDeleted(m.id);
              return false;
            }
            return !deletedMemIds.has(cleanId);
          });

          const memMap = new Map<string, any>();

          // Seed authoritative server/Supabase members first
          for (const sm of cleanServerMembers) {
            memMap.set(String(sm.id).toLowerCase().trim(), sm);
          }

          // Only let a local member override a server member if local has a strictly newer updatedAt timestamp
          for (const lm of localMembers) {
            const k = String(lm.id).toLowerCase().trim();
            if (deletedMemIds.has(k)) continue;

            if (memMap.has(k)) {
              const existing = memMap.get(k);
              const localTime = lm.updatedAt ? new Date(lm.updatedAt).getTime() : 0;
              const serverTime = existing.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
              if (localTime > serverTime) {
                memMap.set(k, { ...existing, ...lm });
              }
            }
          }

          const finalMembers = Array.from(memMap.values()).filter(m => !deletedMemIds.has(String(m.id).toLowerCase().trim()));
          saveMembers(finalMembers, true);
          serverData.members = finalMembers;
        }

        // 4. Update transactions
        if (Array.isArray(serverData.transactions)) {
          const deletedIds = getDeletedTransactionIds();
          if (Array.isArray(serverData.deletedTransactionIds)) {
            for (const tId of serverData.deletedTransactionIds) {
              const cleanTId = String(tId).toLowerCase().trim();
              deletedIds.add(cleanTId);
            }
          }

          const currentTxs = getStoredTransactions();
          const txMap = new Map<string, any>();

          // 1. Authoritative server transactions FIRST
          for (const st of serverData.transactions) {
            if (st && st.id) {
              const k = String(st.id).toLowerCase().trim();
              if (deletedIds.has(k) || PERMANENTLY_PURGED_TX_IDS.has(k)) continue;
              txMap.set(k, { ...st, isSynced: true });
            }
          }

          const mergeRecordAuditorState = (serverRec: any, localRec: any, localIsNewer: boolean) => {
            const base = localIsNewer ? { ...serverRec, ...localRec } : { ...localRec, ...serverRec };
            const verS = serverRec?.auditor_verifications || serverRec?.metadata?.auditor_verifications;
            const verL = localRec?.auditor_verifications || localRec?.metadata?.auditor_verifications;
            if (verS || verL) {
              const mergedVer: Record<string, any> = {};
              const keys = new Set([...Object.keys(verS || {}), ...Object.keys(verL || {})]);
              for (const ak of keys) {
                const entryS = verS?.[ak];
                const entryL = verL?.[ak];
                if (entryS && !entryL) mergedVer[ak] = entryS;
                else if (!entryS && entryL) mergedVer[ak] = entryL;
                else if (entryS && entryL) {
                  const tS = new Date(entryS.markedAt || 0).getTime();
                  const tL = new Date(entryL.markedAt || 0).getTime();
                  mergedVer[ak] = tL >= tS ? entryL : entryS;
                }
              }
              base.auditor_verifications = mergedVer;
              const activeEntries = Object.values(mergedVer).filter((v: any) => v && (v.mark === 'verified' || v.mark === 'flagged'));
              const flaggedEntries = activeEntries.filter((v: any) => v.mark === 'flagged');
              const verifiedEntries = activeEntries.filter((v: any) => v.mark === 'verified');
              if (flaggedEntries.length > 0) {
                base.audit_mark = 'flagged';
                base.audit_query = flaggedEntries.map((f: any) => `${f.auditorName}: ${f.query || 'Query'}`).join(' | ');
                base.audit_marked_by = flaggedEntries.map((f: any) => f.auditorName).join(', ');
              } else if (verifiedEntries.length > 0) {
                base.audit_mark = 'verified';
                base.audit_query = undefined;
                base.audit_marked_by = verifiedEntries.map((v: any) => v.auditorName).join(', ');
              } else {
                base.audit_mark = undefined;
                base.audit_query = undefined;
                base.audit_marked_by = undefined;
                base.audit_marked_at = undefined;
                base.is_locked = false;
                base.locked_by = undefined;
                base.locked_at = undefined;
              }
              if (base.metadata && typeof base.metadata === 'object') {
                base.metadata = {
                  ...base.metadata,
                  audit_mark: base.audit_mark || null,
                  audit_query: base.audit_query || null,
                  auditor_verifications: mergedVer,
                  is_locked: Boolean(base.is_locked)
                };
              }
            } else if (localIsNewer && localRec?.metadata && localRec.metadata.audit_mark === null) {
              base.audit_mark = undefined;
              base.audit_query = undefined;
              base.audit_marked_by = undefined;
              base.audit_marked_at = undefined;
              base.is_locked = false;
              base.locked_by = undefined;
              base.locked_at = undefined;
            }
            return base;
          };

          // 2. Reconcile with local transactions:
          const newLocalTxsToPush: Transaction[] = [];
          const nowMs = Date.now();
          for (const ct of currentTxs) {
            if (ct && ct.id) {
              const k = String(ct.id).toLowerCase().trim();
              if (deletedIds.has(k) || PERMANENTLY_PURGED_TX_IDS.has(k)) {
                txMap.delete(k);
                continue;
              }
              const amt = Number(ct.amount);
              if (!isFinite(amt) || isNaN(amt) || amt <= 0) continue;

              const existing = txMap.get(k);
              if (existing) {
                const localTime = new Date(ct.updatedAt || ct.timestamp || 0).getTime();
                const serverTime = new Date(existing.updatedAt || existing.timestamp || 0).getTime();
                const mergedItem = mergeRecordAuditorState(existing, ct, localTime >= serverTime);
                txMap.set(k, { ...mergedItem, isSynced: true });
              } else {
                // Not in serverData.transactions!
                const isFreshOffline = ((ct as any).isOfflinePending === true || ct.isSynced === false) &&
                  ct.createdAt ? (nowMs - new Date(ct.createdAt).getTime() < 5 * 60 * 1000) : false;
                if (isFreshOffline) {
                  txMap.set(k, ct);
                  newLocalTxsToPush.push(ct);
                } else {
                  // Retain valid local transaction unless explicitly in serverData.deletedTransactionIds
                  txMap.set(k, ct);
                }
              }
            }
          }



          const cleanTxs = Array.from(txMap.values());
          cleanTxs.sort((a, b) => {
            const timeA = new Date(a.updatedAt || a.createdAt || a.timestamp || 0).getTime();
            const timeB = new Date(b.updatedAt || b.createdAt || b.timestamp || 0).getTime();
            return timeB - timeA;
          });
          saveStoredTransactions(cleanTxs, true);
          serverData.transactions = cleanTxs;
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('ronpay_transactions_updated', { detail: cleanTxs }));
            broadcastTabSync('transactions');
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
              const verS = existing?.auditor_verifications || existing?.metadata?.auditor_verifications;
              const verL = le?.auditor_verifications || le?.metadata?.auditor_verifications;
              const baseExp = localTime >= serverTime ? { ...existing, ...le } : { ...le, ...existing };
              if (verS || verL) {
                const mergedVer: Record<string, any> = {};
                const keys = new Set([...Object.keys(verS || {}), ...Object.keys(verL || {})]);
                for (const ak of keys) {
                  const eS = verS?.[ak];
                  const eL = verL?.[ak];
                  if (eS && !eL) mergedVer[ak] = eS;
                  else if (!eS && eL) mergedVer[ak] = eL;
                  else if (eS && eL) {
                    mergedVer[ak] = new Date(eL.markedAt || 0).getTime() >= new Date(eS.markedAt || 0).getTime() ? eL : eS;
                  }
                }
                baseExp.auditor_verifications = mergedVer;
                const activeEntries = Object.values(mergedVer).filter((v: any) => v && (v.mark === 'verified' || v.mark === 'flagged'));
                const flaggedEntries = activeEntries.filter((v: any) => v.mark === 'flagged');
                const verifiedEntries = activeEntries.filter((v: any) => v.mark === 'verified');
                if (flaggedEntries.length > 0) {
                  baseExp.audit_mark = 'flagged';
                  baseExp.audit_query = flaggedEntries.map((f: any) => `${f.auditorName}: ${f.query || 'Query'}`).join(' | ');
                  baseExp.audit_marked_by = flaggedEntries.map((f: any) => f.auditorName).join(', ');
                } else if (verifiedEntries.length > 0) {
                  baseExp.audit_mark = 'verified';
                  baseExp.audit_query = undefined;
                  baseExp.audit_marked_by = verifiedEntries.map((v: any) => v.auditorName).join(', ');
                } else {
                  baseExp.audit_mark = undefined;
                  baseExp.audit_query = undefined;
                  baseExp.audit_marked_by = undefined;
                  baseExp.audit_marked_at = undefined;
                  baseExp.is_locked = false;
                  baseExp.locked_by = undefined;
                  baseExp.locked_at = undefined;
                }
              } else if (localTime >= serverTime && le?.metadata && le.metadata.audit_mark === null) {
                baseExp.audit_mark = undefined;
                baseExp.audit_query = undefined;
                baseExp.is_locked = false;
                baseExp.locked_by = undefined;
                baseExp.locked_at = undefined;
              }
              expMap.set(k, baseExp);
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
            broadcastTabSync('expenses');
          }
        }

        // 11. Update auditor grants & modification requests (authoritative server + fresh local merge)
        const hasServerGrantsArray = Array.isArray(serverData.auditorGrants) || Array.isArray(serverData.grants);
        const rawServerGrants = Array.isArray(serverData.auditorGrants)
          ? serverData.auditorGrants
          : Array.isArray(serverData.grants)
          ? serverData.grants
          : [];
        const delGrantSet = new Set(getStoredDeletedAuditorGrantIds());
        const serverGrants = rawServerGrants.filter(
          (g: any) => g && g.id && !delGrantSet.has(String(g.id).toLowerCase().trim())
        );
        const localGrants = getStoredAuditorGrants();
        if (hasServerGrantsArray) {
          saveStoredAuditorGrants(serverGrants, true, true);
        }
        if (localGrants.length > 0) {
          const serverGrantIds = new Set(serverGrants.map((g: any) => String(g?.id || '').trim()));
          const nowGrantMs = Date.now();
          // Only push local grants that are not deleted AND were created recently (< 30s ago) so deleted grants on other devices are never resurrected
          const unpushedGrants = localGrants.filter(g => {
            if (!g || !g.id) return false;
            const cleanGid = String(g.id).toLowerCase().trim();
            if (delGrantSet.has(cleanGid)) return false;
            if (serverGrantIds.has(String(g.id).trim())) return false;
            const createdMs = new Date(g.createdAt || g.created_at || 0).getTime();
            return createdMs > 0 && nowGrantMs - createdMs < 30000;
          });
          if (unpushedGrants.length > 0) {
            safeApiFetch('/api/data/sync', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ auditorGrants: unpushedGrants })
            }).catch(() => {});
          }
        }
        if (Array.isArray(serverData.modificationRequests)) {
          try {
            localStorage.setItem(MODIFICATION_REQUESTS_KEY, JSON.stringify(serverData.modificationRequests));
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('ronpay_modification_requests_updated', { detail: serverData.modificationRequests }));
            }
          } catch {}
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
  syncTransactionToFirestore(tx).catch(() => {});

  // 2. Also post to local express server and update sync state
  try {
    const res = await safeApiFetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tx),
    });
    if (res && res.ok) {
      tx.isSynced = true;
      try {
        const fresh = getStoredTransactions();
        const patched = fresh.map(t => String(t.id).toLowerCase().trim() === String(tx.id).toLowerCase().trim() ? { ...t, isSynced: true } : t);
        localStorage.setItem('ronpay_transactions_v2', JSON.stringify(patched));
      } catch {}
    }
  } catch {}
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


  return () => {
    stopFirestore();
    if (broadcastChannel) {
      broadcastChannel.close();
      broadcastChannel = null;
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', handleStorageChange);
    }

  };
}

/**
 * Fast authoritative pull of latest central state without re-posting back stale data.
 * Used for real-time SSE updates and tab focus events to avoid infinite broadcast loops.
 */
export async function pullLatestServerState(): Promise<SyncDataState | null> {
  if (typeof window === 'undefined') return null;
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return getLocalFallbackState();
  }

  try {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), 6000) : null;

    const response = await fetch(resolveApiUrl('/api/data/state'), {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: controller ? controller.signal : undefined
    });
    if (timeoutId) clearTimeout(timeoutId);

    if (response.ok) {
      const res = await response.json();
      if (res && res.success && res.data) {
        const serverData = res.data;

        // 1. Process server deletions first
        if (Array.isArray(serverData.deletedTransactionIds)) {
          for (const tId of serverData.deletedTransactionIds) {
            markTransactionAsDeleted(tId);
          }
        }
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
        if (Array.isArray(serverData.deletedAuditorGrantIds) && serverData.deletedAuditorGrantIds.length > 0) {
          saveStoredDeletedAuditorGrantIds([
            ...getStoredDeletedAuditorGrantIds(),
            ...serverData.deletedAuditorGrantIds
          ]);
        }

        // 2. Campaigns
        if (Array.isArray(serverData.campaigns)) {
          saveStoredCampaigns(serverData.campaigns, true);
        }

        // 3. Members
        if (Array.isArray(serverData.members)) {
          saveMembers(serverData.members, true);
        }

        // 4. Transactions - merge authoritative server data with genuine offline creations
        if (Array.isArray(serverData.transactions)) {
          const currentTxs = getStoredTransactions();
          const deletedIds = getDeletedTransactionIds();
          const txMap = new Map<string, Transaction>();
          const nowMs = Date.now();

          // 1. Authoritative server transactions
          for (const st of serverData.transactions) {
            if (st && st.id) {
              const k = String(st.id).toLowerCase().trim();
              if (deletedIds.has(k) || PERMANENTLY_PURGED_TX_IDS.has(k)) continue;
              txMap.set(k, { ...st, isSynced: true });
            }
          }

          // 2. Check local transactions: reconcile updates or detect fresh offline creations
          const unpushedFreshOfflineTxs: Transaction[] = [];
          for (const lt of currentTxs) {
            if (lt && lt.id) {
              const k = String(lt.id).toLowerCase().trim();
              if (deletedIds.has(k) || PERMANENTLY_PURGED_TX_IDS.has(k)) {
                txMap.delete(k);
                continue;
              }
              const amt = Number(lt.amount);
              if (!isFinite(amt) || isNaN(amt) || amt <= 0) continue;

              const isFreshOffline = (lt.isSynced === false || (lt as any).isOfflinePending === true) &&
                lt.createdAt ? (nowMs - new Date(lt.createdAt).getTime() < 5 * 60 * 1000) : false;

              if (txMap.has(k)) {
                const existing = txMap.get(k)!;
                const existingStatus = (existing.status || '').toLowerCase().trim();
                const localStatus = (lt.status || '').toLowerCase().trim();
                const localTime = new Date(lt.updatedAt || lt.audit_marked_at || lt.audit_date || lt.timestamp || 0).getTime();
                const serverTime = new Date(existing.updatedAt || existing.audit_marked_at || existing.audit_date || existing.timestamp || 0).getTime();

                if (localStatus === 'completed' && existingStatus === 'pending') {
                  txMap.set(k, { ...existing, ...lt, status: 'completed', isSynced: true });
                } else if (localTime >= serverTime) {
                  txMap.set(k, { ...existing, ...lt, isSynced: true });
                } else {
                  const merged = { ...lt, ...existing, isSynced: true };
                  if (lt.audit_mark !== undefined && existing.audit_mark === undefined) {
                    merged.audit_mark = lt.audit_mark;
                    merged.audit_query = lt.audit_query;
                    merged.audit_marked_by = lt.audit_marked_by;
                    merged.audit_marked_at = lt.audit_marked_at;
                  }
                  if (lt.is_locked !== undefined && existing.is_locked === undefined) {
                    merged.is_locked = lt.is_locked;
                    merged.locked_by = lt.locked_by;
                    merged.audit_date = lt.audit_date;
                    merged.audit_period = lt.audit_period;
                    merged.audit_notes = lt.audit_notes;
                  }
                  txMap.set(k, merged);
                }
              } else {
                // Retain valid local transaction unless explicitly in serverData.deletedTransactionIds
                txMap.set(k, lt);
                if (isFreshOffline) {
                  unpushedFreshOfflineTxs.push(lt);
                }
              }
            }
          }



          const cleanTxs = Array.from(txMap.values());
          cleanTxs.sort((a, b) => {
            const timeA = new Date(a.updatedAt || a.createdAt || a.timestamp || 0).getTime();
            const timeB = new Date(b.updatedAt || b.createdAt || b.timestamp || 0).getTime();
            return timeB - timeA;
          });

          saveStoredTransactions(cleanTxs, true);
          serverData.transactions = cleanTxs;
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('ronpay_transactions_updated', { detail: cleanTxs }));
            broadcastTabSync('transactions');
          }
        }

        // 5. Creators
        if (Array.isArray(serverData.creators)) {
          saveStoredCreatorsList(serverData.creators, true);
        }

        // 6. Pricing & Announcements
        if (serverData.pricingConfig) {
          saveStoredPricingConfig(serverData.pricingConfig, true);
        }
        if (serverData.announcement) {
          saveStoredAnnouncement(serverData.announcement, true);
        }

        // 7. Auditor Grants & Modification Requests (authoritative replacement so deleted grants are removed everywhere)
        const hasServerGrants = Array.isArray(serverData.auditorGrants) || Array.isArray(serverData.grants);
        const serverGrants = Array.isArray(serverData.auditorGrants)
          ? serverData.auditorGrants
          : Array.isArray(serverData.grants)
          ? serverData.grants
          : [];
        if (hasServerGrants) {
          const delSet = new Set(getStoredDeletedAuditorGrantIds());
          saveStoredAuditorGrants(
            serverGrants.filter((g: any) => g && g.id && !delSet.has(String(g.id).toLowerCase().trim())),
            true,
            true
          );
        }
        if (Array.isArray(serverData.modificationRequests)) {
          try {
            localStorage.setItem(MODIFICATION_REQUESTS_KEY, JSON.stringify(serverData.modificationRequests));
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('ronpay_modification_requests_updated', { detail: serverData.modificationRequests }));
            }
          } catch {}
        }

        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent(RONPAY_SYNC_EVENT, { detail: serverData }));
        }
        return serverData;
      }
    }
  } catch (err) {
    // Silently fall back to cached state
  }

  return getLocalFallbackState();
}

/**
 * High-speed Server-Sent Events (SSE) listener for instant sub-second multi-device / multi-user data synchronization.
 * Guarantees phones, browsers, and different user sessions stay in lockstep without delay.
 */
export function subscribeServerEvents(onChanged: () => void): () => void {
  let isCleanedUp = false;
  let eventSource: EventSource | null = null;

  // 1. Primary: Server-Sent Events (SSE) from local server backend (100% reliable inside iframe)
  if (typeof window !== 'undefined' && typeof EventSource !== 'undefined') {
    try {
      eventSource = new EventSource(resolveApiUrl('/api/sync/events'));
      eventSource.addEventListener('message', (ev: MessageEvent) => {
        try {
          if (ev?.data) {
            const parsed = JSON.parse(ev.data);
            if (parsed?.type === 'auditor_grants_updated') {
              syncAuditorGrantsAcrossCloud().catch(() => {});
            }
          }
        } catch {}
        if (!isCleanedUp) onChanged();
      });
      eventSource.addEventListener('transactions_updated', () => {
        if (!isCleanedUp) onChanged();
      });
      eventSource.addEventListener('auditor_grants_updated', () => {
        syncAuditorGrantsAcrossCloud().catch(() => {});
        if (!isCleanedUp) onChanged();
      });
      eventSource.onerror = () => {
        // EventSource automatically retries on connection drop
      };
    } catch {}
  }

  // 2. Secondary: Supabase Realtime Channel (auto-detach on CHANNEL_ERROR so SSE handles sync cleanly)
  let channel: any = null;
  try {
    channel = supabase.channel('public:transactions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => {
        if (!isCleanedUp) onChanged();
      })
      .subscribe((status) => {
        if ((status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') && channel) {
          const broken = channel;
          channel = null;
          try { supabase.removeChannel(broken); } catch {}
        }
      });
  } catch {}

  return () => {
    isCleanedUp = true;
    if (eventSource) {
      try { eventSource.close(); } catch {}
    }
    if (channel) {
      try { supabase.removeChannel(channel); } catch {}
    }
  };
}
