import { Campaign, Transaction, CreatorProfile, BawmCategory, SystemPricingConfig, AuditLog, AnnouncementBanner, AnnouncementItem, MemberRecord, RonPayWallet, WalletTransaction, StaffAccount, PaymentGatewayConfig } from '../types';
import { INITIAL_CAMPAIGNS, INITIAL_TRANSACTIONS, DEFAULT_PRICING_CONFIG, INITIAL_REGISTERED_CREATORS } from '../data/initialData';
import {
  syncCampaignToFirestore,
  deleteCampaignFromFirestore,
  syncTransactionToFirestore,
  deleteTransactionFromFirestore,
  syncMemberToFirestore,
  deleteMemberFromFirestore,
  syncCreatorToFirestore,
  syncAnnouncementToFirestore,
  syncPricingConfigToFirestore,
  syncAuditLogToFirestore
} from '../services/firestoreSync';

const CAMPAIGNS_KEY = 'ronpay_campaigns_v2';
const TRANSACTIONS_KEY = 'ronpay_transactions_v2';
const CREATOR_PROFILE_KEY = 'ronpay_creator_profile_v2';
const CREATORS_LIST_KEY = 'ronpay_creators_list_v2';
const MEMBERS_LIST_KEY = 'ronpay_kumtluang_members_v1';
const PRICING_CONFIG_KEY = 'ronpay_pricing_config_v1';
const CAMPAIGNS_LAST_SYNC_KEY = 'ronpay_campaigns_last_sync_v1';
const AUDIT_LOGS_KEY = 'ronpay_audit_logs_v1';
const ANNOUNCEMENT_KEY = 'ronpay_announcement_v1';

export const broadcastTabSync = (type: string) => {
  try {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      const bc = new BroadcastChannel('ronpay_realtime_sync');
      bc.postMessage({ type, timestamp: Date.now() });
      bc.close();
    }
  } catch (e) {}
};

/**
 * Resilient, offline-aware fetch wrapper that prevents connection reset crashes when offline or reconnecting
 */
export const safeApiFetch = async (url: string, options?: RequestInit): Promise<Response | null> => {
  if (typeof window !== 'undefined' && typeof navigator !== 'undefined' && !navigator.onLine) {
    return null;
  }
  try {
    const res = await fetch(url, options);
    return res;
  } catch {
    return null;
  }
};

export const DEFAULT_ANNOUNCEMENT_ITEMS: AnnouncementItem[] = [
  {
    id: 'ann-1',
    isActive: true,
    type: 'urgent',
    title: 'Mizoram State-wide Community Notice',
    message: 'RonPay v2.5 live: Ralna, Khawlsak, Rikrum leh Kumtluang bawm zawng zawng QR Code verified-te chauh sum chhun nan hmang rawh le.',
    linkText: 'Bawm Explorer En Rawh',
    linkAction: 'explore_bawm',
    badge: 'URGENT',
    bannerMediaUrl: 'https://www.canva.com/design/DAHTTgdvhsU/77qJSQZdradri_piWLrIzw/view?embed',
    mediaType: 'canva',
    mediaLayout: 'hero_top'
  },
  {
    id: 'ann-2',
    isActive: true,
    type: 'info',
    title: 'Instant UPI & BBPS Live Integration',
    message: 'PhonePe, Paytm, Google Pay leh BBPS hmangin Electric, FASTag, Water Bill leh Fees te awlsam takin pek fel nghal zung zung theih a ni e.',
    linkText: 'Bill Payments En Rawh',
    linkAction: 'open_bill_service',
    badge: 'BBPS LIVE',
    bannerMediaUrl: 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?q=80&w=800&auto=format&fit=crop',
    mediaType: 'image',
    mediaLayout: 'hero_top'
  },
  {
    id: 'ann-3',
    isActive: true,
    type: 'notice',
    title: 'YMA & Creator Verification Studio',
    message: 'Branch YMA, NGO leh Kohhran tan Creator Studio-ah registration tiin Free QR Code siam a, donation awlsam takin tlingkhawm rawh le.',
    linkText: 'Creator Studio-ah Lut Rawh',
    linkAction: 'create_qr',
    badge: 'CREATOR HUB'
  },
  {
    id: 'ann-4',
    isActive: true,
    type: 'event',
    title: 'Synod & Kohhran Khawmpui Pual',
    message: 'Kohhran Inkhawmpui, Fellowship leh Khawtlang thiltih hrang hrang pualin Kumtluang & Khawlsak Bawm siam a remchang e.',
    linkText: 'Kumtluang Bawm En Rawh',
    linkAction: 'kumtluang_bawm',
    badge: 'EVENT',
    bannerMediaUrl: 'https://images.unsplash.com/photo-1544427920-c49ccfb85579?q=80&w=800&auto=format&fit=crop',
    mediaType: 'image',
    mediaLayout: 'hero_top'
  }
];

export const DEFAULT_ANNOUNCEMENT: AnnouncementBanner = {
  id: 'ann-main-config',
  isActive: true,
  type: 'urgent',
  title: 'Mizoram State-wide Community Notice',
  message: 'RonPay v2.5 live: Ralna, Khawlsak, Rikrum leh Kumtluang bawm zawng zawng QR Code verified-te chauh sum chhun nan hmang rawh le.',
  linkText: 'Bawm Explorer En Rawh',
  linkAction: 'explore_bawm',
  animationStyle: 'slide',
  rotationSpeedSeconds: 4,
  autoRotate: true,
  items: DEFAULT_ANNOUNCEMENT_ITEMS,
  createdAt: new Date().toISOString()
};

export const INITIAL_AUDIT_LOGS: AuditLog[] = [
  {
    id: 'log-1',
    action: 'System Initialized',
    details: 'RonPay Community Platform v2.5 security and moderation subsystem online.',
    targetType: 'system',
    performedBy: 'System Administrator',
    timestamp: new Date(Date.now() - 3600000 * 24).toISOString()
  },
  {
    id: 'log-2',
    action: 'Creator Approved',
    details: 'Bungkawn Branch YMA creator profile verified and approved for Ralna & Rikrum categories.',
    targetType: 'creator',
    targetId: '9862311223',
    performedBy: 'Admin (Biometric Verified)',
    timestamp: new Date(Date.now() - 3600000 * 12).toISOString()
  },
  {
    id: 'log-3',
    action: 'Campaign Approved',
    details: 'Pi Lalhmingliani Ralna QR verified with verified beneficiary details.',
    targetType: 'campaign',
    targetId: 'cmp-ralna-1',
    performedBy: 'Admin',
    timestamp: new Date(Date.now() - 3600000 * 6).toISOString()
  }
];

export const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxChd7adkM_dnbo9z7nApt_JcjUUg83NU93aoTh3neALz1bR8B-7iJCmoIPmHdkg4NB/exec";

export const getLastSyncTime = (): string => {
  try {
    const saved = localStorage.getItem(CAMPAIGNS_LAST_SYNC_KEY);
    if (saved) return saved;
  } catch (e) {
    console.error('Failed to get last sync time', e);
  }
  return new Date().toISOString();
};

export const setLastSyncTime = (timestamp: string = new Date().toISOString()) => {
  try {
    localStorage.setItem(CAMPAIGNS_LAST_SYNC_KEY, timestamp);
  } catch (e) {
    console.error('Failed to save last sync time', e);
  }
};

export const getStoredCampaigns = (): Campaign[] => {
  try {
    const raw = localStorage.getItem(CAMPAIGNS_KEY);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const mapped = parsed
          .filter((camp: Campaign) => camp.id !== 'cmp-kumtluang-ymavt')
          .map((camp: Campaign) => {
            if (!camp.orgCode) {
              const initialMatch = INITIAL_CAMPAIGNS.find(ic => ic.id === camp.id);
              const derived = initialMatch?.orgCode || derivePrefixFromText(camp.orgName || camp.title);
              return { ...camp, orgCode: derived };
            }
            return camp;
          });

        // Smart merge: ensure default initial campaigns exist alongside any user-created campaigns
        const existingIds = new Set(mapped.map(c => c.id));
        let hasNew = false;
        const merged = [...mapped];
        for (const initCamp of INITIAL_CAMPAIGNS) {
          if (!existingIds.has(initCamp.id)) {
            merged.push(initCamp);
            hasNew = true;
          }
        }

        const sorted = merged.sort((a, b) => {
          const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return timeB - timeA;
        });

        if (hasNew || mapped.length !== parsed.length) {
          localStorage.setItem(CAMPAIGNS_KEY, JSON.stringify(sorted));
        }

        return sorted;
      }
    }
    // Initialize if never stored before
    const initialSorted = [...INITIAL_CAMPAIGNS].sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeB - timeA;
    });
    localStorage.setItem(CAMPAIGNS_KEY, JSON.stringify(initialSorted));
    return initialSorted;
  } catch (e) {
    console.error('Failed to parse stored campaigns', e);
  }
  return INITIAL_CAMPAIGNS;
};

// Helper to derive 3-letter prefix from string
export const derivePrefixFromText = (text?: string): string => {
  if (!text) return 'MEM';
  const upper = text.toUpperCase();
  if (upper.includes('EBENEZER') || upper.includes('EBE')) return 'EBE';
  if (upper.includes('BETHEL') || upper.includes('BET')) return 'BET';
  if (upper.includes('KHATLA') || upper.includes('KTL')) return 'KTL';
  if (upper.includes('BCM')) return 'BCM';
  if (upper.includes('YMA')) return 'YMA';
  if (upper.includes('SYNOD')) return 'SYN';
  if (upper.includes('CHANMARI')) return 'CHM';
  if (upper.includes('BUNGKAWN')) return 'BKN';
  if (upper.includes('DAWRPUI')) return 'DWP';
  if (upper.includes('ZOTLANG')) return 'ZTL';
  if (upper.includes('RAMHLUN')) return 'RMH';
  if (upper.includes('KANAN')) return 'KNN';
  if (upper.includes('BAWNGKAWN')) return 'BGK';
  if (upper.includes('MISSION')) return 'MSV';
  
  const clean = upper.replace(/[^A-Z]/g, '');
  return clean.substring(0, 3) || 'BAW';
};

// System-wide Unique Prefix Code Validator
export const isPrefixCodeTaken = (prefix: string, excludeCampaignId?: string): boolean => {
  const clean = prefix.trim().toUpperCase();
  if (!clean) return false;
  const campaigns = getStoredCampaigns();
  return campaigns.some(c => c.id !== excludeCampaignId && (c.orgCode || '').trim().toUpperCase() === clean);
};

// Dynamic Alternative Prefix Generator with clean suggestions
export const suggestAlternativePrefixes = (baseTextOrPrefix: string, excludeCampaignId?: string): string[] => {
  const campaigns = getStoredCampaigns();
  const existingPrefixes = new Set(
    campaigns
      .filter(c => c.id !== excludeCampaignId && c.orgCode)
      .map(c => c.orgCode!.trim().toUpperCase())
  );

  const clean = baseTextOrPrefix.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  const candidates: string[] = [];

  if (clean.length >= 3) {
    // 1. Standard first 3 letters (e.g. BET)
    candidates.push(clean.substring(0, 3));
    
    // 2. Consonants only (e.g. BTH, BTN for Bethani / Bethel)
    const consonants = clean.replace(/[AEIOU]/g, '');
    if (consonants.length >= 3) candidates.push(consonants.substring(0, 3));
    if (consonants.length >= 2 && clean.length >= 3) {
      candidates.push(consonants.substring(0, 2) + clean.charAt(2));
      candidates.push(consonants.substring(0, 2) + clean.charAt(clean.length - 1));
    }
    
    // 3. First, Middle, Last letter (e.g. BNI for Bethani)
    if (clean.length >= 4) {
      candidates.push(clean.charAt(0) + clean.charAt(Math.floor(clean.length / 2)) + clean.charAt(clean.length - 1));
      candidates.push(clean.charAt(0) + clean.substring(clean.length - 2));
      candidates.push(clean.substring(0, 2) + clean.charAt(clean.length - 1));
      candidates.push(clean.substring(0, 4));
    }
  } else if (clean.length > 0) {
    candidates.push(clean.padEnd(3, 'X'));
  }

  // 4. Fallbacks with clean suffixes (e.g. BT1, BT2, BTH1)
  const base2 = clean.length >= 2 ? clean.substring(0, 2) : (clean || 'B');
  for (let i = 1; i <= 9; i++) {
    candidates.push(`${base2}${i}`);
    if (clean.length >= 3) {
      candidates.push(`${clean.substring(0, 2)}${clean.charAt(clean.length - 1)}${i}`);
    }
  }

  // Filter out any taken prefix and duplicate entries
  const available: string[] = [];
  for (const cand of candidates) {
    const candUpper = cand.toUpperCase();
    if (candUpper.length >= 2 && !existingPrefixes.has(candUpper) && !available.includes(candUpper)) {
      available.push(candUpper);
      if (available.length >= 4) break;
    }
  }

  // If still empty, supply unique synthetic prefixes
  let counter = 1;
  while (available.length < 3 && counter < 100) {
    const synth = `${base2}${counter.toString().padStart(2, '0')}`;
    if (!existingPrefixes.has(synth) && !available.includes(synth)) {
      available.push(synth);
    }
    counter++;
  }

  return available;
};

export const saveStoredCampaigns = (campaigns: Campaign[]) => {
  try {
    // Enforce unique prefix codes across all campaigns
    const seenPrefixes = new Set<string>();
    const sanitized = campaigns.map(c => {
      let code = (c.orgCode || derivePrefixFromText(c.orgName || c.title)).trim().toUpperCase();
      if (seenPrefixes.has(code)) {
        // Auto disambiguate collision if saving
        const alts = suggestAlternativePrefixes(code, c.id);
        code = alts[0] || `${code.substring(0, 2)}${Math.floor(Math.random() * 9 + 1)}`;
      }
      seenPrefixes.add(code);
      return { ...c, orgCode: code };
    });

    const sortedSanitized = sanitized.sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeB - timeA;
    });

    localStorage.setItem(CAMPAIGNS_KEY, JSON.stringify(sortedSanitized));
    setLastSyncTime(new Date().toISOString());

    // Broadcast local event for immediate real-time sync across all components
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ronpay_campaigns_updated', { detail: sortedSanitized }));
      broadcastTabSync('campaigns');
    }

    // Asynchronously push to backend server for multi-device sync
    safeApiFetch('/api/data/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campaigns: sortedSanitized })
    });
  } catch (e) {
    console.error('Failed to save campaigns', e);
  }
};

export const saveCampaign = (camp: Campaign): void => {
  if (!camp || !camp.id) return;
  const current = getStoredCampaigns();
  const idx = current.findIndex(c => c.id === camp.id);
  let updated: Campaign[];
  if (idx >= 0) {
    updated = [...current];
    updated[idx] = camp;
  } else {
    updated = [camp, ...current];
  }
  saveStoredCampaigns(updated);
  syncCampaignToFirestore(camp).catch(() => {});
  safeApiFetch('/api/campaigns', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(camp)
  });
};

export const deleteStoredCampaign = (campaignId: string, reason?: string, deletedBy?: string): void => {
  if (!campaignId) return;
  const current = getStoredCampaigns();
  const target = current.find(c => c.id === campaignId);
  if (!target) return;

  const allTxns = getStoredTransactions();
  const campTxns = allTxns.filter(t => t.campaignId === campaignId || t.campaignTitle === target.title);
  const hasPayments = campTxns.length > 0;

  if (hasPayments) {
    // Financial Safety Rule: Retain financial ledger & sulhnu history. Soft delete / Archive only!
    const updated = current.map(c => {
      if (c.id === campaignId) {
        return {
          ...c,
          status: 'cancelled' as const,
          deletionReason: reason || 'Siam sual palh vanga tihtawp / Archived',
          cancelledAt: new Date().toISOString()
        };
      }
      return c;
    });
    saveStoredCampaigns(updated);
    recordAuditLog(
      'Campaign Cancelled & Archived',
      `Campaign "${target.title}" (${target.id}) with ${campTxns.length} transactions was cancelled and safely archived. Reason: ${reason || 'Siam sual / Creator cancelled'} (Ledger Retained)`,
      'campaign',
      campaignId
    );
  } else {
    // Zero collections: Safe for hard delete
    const updated = current.filter(c => c.id !== campaignId);
    saveStoredCampaigns(updated);
    deleteCampaignFromFirestore(campaignId).catch(() => {});
    recordAuditLog(
      'Campaign Deleted',
      `Fresh campaign "${target.title}" (${target.id}) with ₹0 collections was deleted permanently. Reason: ${reason || 'Siam sual palh'}`,
      'campaign',
      campaignId
    );
  }

  safeApiFetch(`/api/campaigns/${encodeURIComponent(campaignId)}`, {
    method: 'DELETE',
  });
};

export const isConfirmedTransaction = (tx?: Transaction | null): boolean => {
  if (!tx) return false;
  const status = (tx.status || '').toLowerCase().trim();
  if (
    status === 'pending' || 
    status === 'pending_verification' || 
    status === 'failed' || 
    status === 'rejected' || 
    status === 'cancelled'
  ) {
    return false;
  }
  return true;
};

const DELETED_TX_IDS_KEY = 'ronpay_deleted_tx_ids_v1';

export const getDeletedTransactionIds = (): Set<string> => {
  try {
    const raw = localStorage.getItem(DELETED_TX_IDS_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return new Set(arr.map(id => String(id).toLowerCase().trim()));
    }
  } catch (e) {}
  return new Set<string>();
};

export const markTransactionAsDeleted = (txId: string): void => {
  if (!txId) return;
  try {
    const set = getDeletedTransactionIds();
    set.add(String(txId).toLowerCase().trim());
    const arr = Array.from(set).slice(-1000); // Retain recent 1000 deletions
    localStorage.setItem(DELETED_TX_IDS_KEY, JSON.stringify(arr));

    // Asynchronously push deletion to backend server and Firestore for cross-window & mobile sync
    safeApiFetch('/api/data/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deletedTransactionIds: [txId] })
    });
    deleteTransactionFromFirestore(txId).catch(() => {});
  } catch (e) {}
};

export const getStoredTransactions = (): Transaction[] => {
  try {
    const deletedIds = getDeletedTransactionIds();
    const raw = localStorage.getItem(TRANSACTIONS_KEY);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        // Filter out legacy sample entries for Liana & Kunga or old mismatched seed transactions or deleted transactions
        const legacyMismatchedIds = new Set(['TXN-9015', 'TXN-9016', 'TXN-9017']);
        const cleaned = parsed.filter(t => 
          t && t.id &&
          !deletedIds.has(String(t.id).toLowerCase().trim()) &&
          t.donorName !== 'Liana' && 
          t.donorName !== 'Kunga' && 
          !legacyMismatchedIds.has(t.id)
        );

        // Smart merge with INITIAL_TRANSACTIONS so any newly added initial transactions
        // (like Zonunmawia or demo accounts) are never missing due to old browser cache,
        // BUT NEVER restore any ID that was intentionally deleted by user
        const existingIds = new Set(cleaned.map(t => String(t.id).toLowerCase().trim()));
        let hasNew = false;
        const merged = [...cleaned];
        for (const initTx of INITIAL_TRANSACTIONS) {
          const initKey = String(initTx.id).toLowerCase().trim();
          if (!existingIds.has(initKey) && !deletedIds.has(initKey)) {
            merged.push(initTx);
            hasNew = true;
          }
        }

        if (hasNew || cleaned.length !== parsed.length) {
          localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(merged));
        }

        // Auto-correct any legacy campaign titles & categories cached in localStorage
        let hasFixed = false;
        for (const t of merged) {
          if (t.campaignId === 'cmp-1788526889943' || (t.category === 'ralna' && t.campaignTitle === 'BCM Ebenezer')) {
            if (t.campaignTitle !== 'Lalrinpuii Ralna') {
              t.campaignTitle = 'Lalrinpuii Ralna';
              hasFixed = true;
            }
          }
          if (t.campaignId === 'cmp-1788527889945' && t.campaignTitle === 'BCM Ebenezer') {
            t.campaignTitle = 'Pocket Money';
            hasFixed = true;
          }

          // Ensure non-bill transactions are never mistakenly stored with category 'others' or empty
          const isBill = Boolean(t.billServiceType || t.billConsumerNumber || t.billOperator) ||
            String(t.id || '').startsWith('BILL-') || 
            String(t.id || '').startsWith('TXN-BILL-') || 
            String(t.campaignId || '').startsWith('bill-');
          if (!isBill) {
            if (!t.category || t.category === 'others') {
              const titleL = String(t.campaignTitle || '').toLowerCase();
              if (titleL.includes('ralna') || t.campaignId === 'cmp-1788526889943') {
                t.category = 'ralna';
                hasFixed = true;
              } else if (titleL.includes('rikrum') || t.campaignId === 'cmp-1788528889947') {
                t.category = 'rikrum';
                hasFixed = true;
              } else if (titleL.includes('kumtluang') || t.campaignId === 'cmp-1788529889949') {
                t.category = 'kumtluang';
                hasFixed = true;
              } else {
                t.category = 'khawlsak';
                hasFixed = true;
              }
            }
          }
        }
        if (hasFixed) {
          localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(merged));
        }

        return merged;
      }
    }
    // Initialize if never stored before
    localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(INITIAL_TRANSACTIONS));
    return INITIAL_TRANSACTIONS;
  } catch (e) {
    console.error('Failed to parse stored transactions', e);
  }
  return INITIAL_TRANSACTIONS;
};

let _syncServerTxTimer: any = null;

export const saveStoredTransactions = (transactions: Transaction[], skipServerPush: boolean = false) => {
  try {
    localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(transactions));

    // Broadcast local event for immediate real-time sync across components/tabs
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ronpay_transactions_updated', { detail: transactions }));
      broadcastTabSync('transactions');
    }

    if (!skipServerPush) {
      // Asynchronously debounced push to backend server for cross-window and mobile app sync
      if (typeof window !== 'undefined' && typeof navigator !== 'undefined' && navigator.onLine) {
        if (_syncServerTxTimer) clearTimeout(_syncServerTxTimer);
        _syncServerTxTimer = setTimeout(() => {
          const deletedIds = Array.from(getDeletedTransactionIds());
          safeApiFetch('/api/data/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              transactions,
              deletedTransactionIds: deletedIds
            })
          })
          .then(res => res ? res.json() : null)
          .then(result => {
            if (result && result.success && result.data && Array.isArray(result.data.transactions)) {
              const serverTxs: Transaction[] = result.data.transactions;
              const currentLocal = getStoredTransactions();
              const localMap = new Map<string, Transaction>();
              for (const t of currentLocal) {
                if (t && t.id) localMap.set(String(t.id).toLowerCase().trim(), t);
              }
              let hasNewFromOtherWindow = false;
              for (const st of serverTxs) {
                if (st && st.id) {
                  const k = String(st.id).toLowerCase().trim();
                  if (!localMap.has(k)) {
                    localMap.set(k, st);
                    hasNewFromOtherWindow = true;
                  }
                }
              }
              if (hasNewFromOtherWindow) {
                const cleanMerged = Array.from(localMap.values());
                cleanMerged.sort((a, b) => {
                  const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
                  const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
                  return timeB - timeA;
                });
                localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(cleanMerged));
                if (typeof window !== 'undefined') {
                  window.dispatchEvent(new CustomEvent('ronpay_transactions_updated', { detail: cleanMerged }));
                  broadcastTabSync('transactions');
                }
              }
            }
          })
          .catch(() => {});
        }, 250);
      }
    }
  } catch (e) {
    console.error('Failed to save transactions', e);
  }
};

export const GUEST_CREATOR_PROFILE: CreatorProfile = {
  name: 'Khualmi (Guest User)',
  orgName: 'RonPay Community',
  designation: 'Visitor / Donor',
  phone: '',
  isPhoneVerified: false,
  isApproved: false,
  isAdmin: false,
  approvedCategories: [],
  createdQRsCount: 0,
};

export const DEFAULT_INITIAL_CREATOR: CreatorProfile = {
  name: 'Rev. Dr. R. Zothansanga',
  orgName: 'BCM Ebenezer, Zobawk Local Church',
  designation: 'Pastor / Secretary',
  phone: '9862599881',
  password: '1234',
  pin: '1234',
  avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
  isPhoneVerified: true,
  isApproved: true,
  approvedCategories: ['kumtluang', 'ralna'],
  createdQRsCount: 5,
};

export const getStoredCreatorProfile = (): CreatorProfile => {
  try {
    const raw = localStorage.getItem(CREATOR_PROFILE_KEY);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        if (parsed.orgName === 'RonPay HQ / Master Console') {
          parsed.orgName = 'BCM Ebenezer';
          saveStoredCreatorProfile(parsed);
        }
        if (parsed.isAdmin && (parsed.name === 'Smart Cabs Admin' || parsed.name === 'New RonPay User' || parsed.name === 'RonPay Member' || !parsed.phone || parsed.phone === '9436001234')) {
          parsed.isAdmin = false;
          parsed.role = 'MEMBER';
          saveStoredCreatorProfile(parsed);
          try {
            sessionStorage.removeItem('ronpay_admin_auth');
          } catch {}
        }
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to parse creator profile', e);
  }
  // First time app launch: new user enters as Guest User (Khualmi)
  saveStoredCreatorProfile(GUEST_CREATOR_PROFILE);
  return GUEST_CREATOR_PROFILE;
};

export const logoutCreator = (): CreatorProfile => {
  try {
    localStorage.setItem(CREATOR_PROFILE_KEY, JSON.stringify(GUEST_CREATOR_PROFILE));
    sessionStorage.removeItem('ronpay_admin_auth');
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ronpay-creator-updated', { detail: GUEST_CREATOR_PROFILE }));
      window.dispatchEvent(new CustomEvent('ronpay_creator_profile_updated', { detail: GUEST_CREATOR_PROFILE }));
    }
  } catch (e) {
    console.error('Failed to log out creator', e);
  }
  return GUEST_CREATOR_PROFILE;
};

export const loginCreator = (profile: CreatorProfile): void => {
  try {
    localStorage.setItem(CREATOR_PROFILE_KEY, JSON.stringify(profile));
    if (profile.isAdmin) {
      sessionStorage.setItem('ronpay_admin_auth', 'true');
    }
    
    // Update or insert into registered creators list
    const currentList = getStoredCreatorsList();
    const idx = currentList.findIndex(c => c.phone === profile.phone);
    let updatedList = [...currentList];
    if (idx >= 0) {
      updatedList[idx] = { ...updatedList[idx], ...profile };
    } else {
      updatedList.push(profile);
    }
    localStorage.setItem(CREATORS_LIST_KEY, JSON.stringify(updatedList));

    syncCreatorToFirestore(profile).catch(() => {});
    safeApiFetch('/api/data/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ creators: updatedList })
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ronpay-creator-updated', { detail: profile }));
      window.dispatchEvent(new CustomEvent('ronpay_creator_profile_updated', { detail: profile }));
      window.dispatchEvent(new CustomEvent('ronpay_creators_updated', { detail: updatedList }));
    }
  } catch (e) {
    console.error('Failed to login creator', e);
  }
};

export const saveStoredCreatorProfile = (profile: CreatorProfile) => {
  try {
    localStorage.setItem(CREATOR_PROFILE_KEY, JSON.stringify(profile));

    // Update in registered creators list as well
    const currentList = getStoredCreatorsList();
    const idx = currentList.findIndex(c => c.phone === profile.phone);
    let updatedList = [...currentList];
    if (idx >= 0) {
      updatedList[idx] = { ...updatedList[idx], ...profile };
    } else if (profile.phone) {
      updatedList.push(profile);
    }
    localStorage.setItem(CREATORS_LIST_KEY, JSON.stringify(updatedList));

    if (profile && profile.phone) {
      syncCreatorToFirestore(profile).catch(() => {});
    }

    safeApiFetch('/api/data/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ creators: updatedList })
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ronpay-creator-updated', { detail: profile }));
      window.dispatchEvent(new CustomEvent('ronpay_creator_profile_updated', { detail: profile }));
      window.dispatchEvent(new CustomEvent('ronpay_creators_updated', { detail: updatedList }));
    }
  } catch (e) {
    console.error('Failed to save creator profile', e);
  }
};

export const getStoredCreatorsList = (): CreatorProfile[] => {
  try {
    const raw = localStorage.getItem(CREATORS_LIST_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const existingPhones = new Set(parsed.map(c => (c.phone || '').trim().replace(/\D/g, '').slice(-10)));
        let hasNew = false;
        const merged = [...parsed];
        for (const initC of INITIAL_REGISTERED_CREATORS) {
          const initPhoneDigits = (initC.phone || '').trim().replace(/\D/g, '').slice(-10);
          if (initPhoneDigits && !existingPhones.has(initPhoneDigits)) {
            merged.push(initC);
            hasNew = true;
          }
        }
        if (hasNew) {
          localStorage.setItem(CREATORS_LIST_KEY, JSON.stringify(merged));
        }
        return merged;
      }
    }
  } catch (e) {
    console.error('Failed to parse creators list', e);
  }
  return INITIAL_REGISTERED_CREATORS;
};

export const saveStoredCreatorsList = (creators: CreatorProfile[]) => {
  try {
    localStorage.setItem(CREATORS_LIST_KEY, JSON.stringify(creators));
    
    // Check if active profile is in the list
    const active = getStoredCreatorProfile();
    if (active && active.phone) {
      const matched = creators.find(c => c.phone === active.phone);
      if (matched && (matched.name !== active.name || matched.orgName !== active.orgName || matched.designation !== active.designation || matched.isApproved !== active.isApproved || matched.avatarUrl !== active.avatarUrl || matched.logoUrl !== active.logoUrl)) {
        const updatedActive = { ...active, ...matched };
        localStorage.setItem(CREATOR_PROFILE_KEY, JSON.stringify(updatedActive));
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('ronpay-creator-updated', { detail: updatedActive }));
          window.dispatchEvent(new CustomEvent('ronpay_creator_profile_updated', { detail: updatedActive }));
        }
      }
    }

    safeApiFetch('/api/data/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ creators })
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ronpay_creators_updated', { detail: creators }));
    }
  } catch (e) {
    console.error('Failed to save creators list', e);
  }
};

export const getStoredPricingConfig = (): SystemPricingConfig => {
  try {
    const raw = localStorage.getItem(PRICING_CONFIG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.categories) {
        return {
          ...DEFAULT_PRICING_CONFIG,
          ...parsed,
          categories: {
            ...DEFAULT_PRICING_CONFIG.categories,
            ...parsed.categories
          }
        };
      }
    }
  } catch (e) {
    console.error('Failed to parse pricing config', e);
  }
  return DEFAULT_PRICING_CONFIG;
};

export const saveStoredPricingConfig = (config: SystemPricingConfig) => {
  try {
    localStorage.setItem(PRICING_CONFIG_KEY, JSON.stringify(config));
    if (config) {
      syncPricingConfigToFirestore(config).catch(() => {});
    }
  } catch (e) {
    console.error('Failed to save pricing config', e);
  }
};

export const syncWithGoogleScript = async (payload: Record<string, any>) => {
  try {
    await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return true;
  } catch (err) {
    console.warn('Google Apps Script webhook non-fatal notice:', err);
    return false;
  }
};

const USER_PAID_TX_IDS_KEY = 'ronpay_user_paid_tx_ids_v3';

export const getStoredUserPaidTxIds = (): string[] => {
  try {
    const raw = localStorage.getItem(USER_PAID_TX_IDS_KEY);
    const ids: string[] = [];
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        for (const id of parsed) {
          if (id && id !== 'TXN-9011' && id !== 'TXN-9015' && !ids.includes(id)) {
            ids.push(id);
          }
        }
      }
    }
    // Also check and merge legacy keys
    for (const legacyKey of ['ronpay_user_paid_tx_ids_v2', 'ronpay_user_paid_tx_ids_v1', 'ronpay_user_paid_tx_ids']) {
      const legacyRaw = localStorage.getItem(legacyKey);
      if (legacyRaw) {
        try {
          const legacyParsed = JSON.parse(legacyRaw);
          if (Array.isArray(legacyParsed)) {
            for (const id of legacyParsed) {
              if (id && id !== 'TXN-9011' && id !== 'TXN-9015' && !ids.includes(id)) {
                ids.push(id);
              }
            }
          }
        } catch {}
      }
    }
    return ids;
  } catch (e) {
    console.error('Failed to parse user paid tx ids', e);
  }
  return [];
};

export const saveStoredUserPaidTxIds = (ids: string[]) => {
  try {
    localStorage.setItem(USER_PAID_TX_IDS_KEY, JSON.stringify(ids));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ronpay_user_paid_updated', { detail: ids }));
    }
  } catch (e) {
    console.error('Failed to save user paid tx ids', e);
  }
};

export const recordUserPaidTxId = (id: string) => {
  try {
    if (!id || id === 'TXN-9011' || id === 'TXN-9015') return;
    const current = getStoredUserPaidTxIds();
    if (!current.includes(id)) {
      const updated = [id, ...current];
      saveStoredUserPaidTxIds(updated);
    }
  } catch (e) {
    console.error('Failed to record user paid tx id', e);
  }
};

/**
 * Checks if a transaction was paid by the currently active user/creator or on this device session.
 * Sulhnu Record must STRICTLY only show transactions made by the active user/creator.
 * Other users' contributions are strictly excluded.
 */
export const isUserPaidTransaction = (
  tx: Transaction,
  userPaidIds: string[] = [],
  creatorProfile?: CreatorProfile | null
): boolean => {
  if (!tx) return false;

  // 1. Transaction was explicitly paid in this active browser session/device
  if (userPaidIds && userPaidIds.length > 0 && userPaidIds.includes(tx.id)) {
    return true;
  }

  // 2. Strict Phone Match with currently logged-in user/creator profile
  if (creatorProfile?.phone && tx.donorPhone) {
    const userPhoneDigits = creatorProfile.phone.replace(/\D/g, '').slice(-10);
    const txPhoneDigits = tx.donorPhone.replace(/\D/g, '').slice(-10);
    if (userPhoneDigits.length >= 8 && txPhoneDigits.length >= 8 && userPhoneDigits === txPhoneDigits) {
      return true;
    }
  }

  // 3. Strict Name Match with verified logged-in creator/user profile (only when name is distinctive and non-generic)
  if (creatorProfile?.name && tx.donorName && !tx.isAnonymous) {
    const uName = creatorProfile.name.trim().toLowerCase();
    const dName = tx.donorName.trim().toLowerCase();
    const isGeneric = ['ronpay user', 'guest user', 'user', 'valued donor', 'anonymous', 'donor'].includes(uName);
    
    if (!isGeneric && uName.length >= 3 && (uName === dName || uName.includes(dName) || dName.includes(uName))) {
      // If both have phone numbers, verify they do not conflict
      if (creatorProfile.phone && tx.donorPhone) {
        const uDigits = creatorProfile.phone.replace(/\D/g, '').slice(-10);
        const tDigits = tx.donorPhone.replace(/\D/g, '').slice(-10);
        if (uDigits && tDigits && uDigits !== tDigits) {
          return false;
        }
      }
      return true;
    }
  }

  return false;
};

/**
 * Checks if the currently active user/creator is the verified owner/creator of a given campaign.
 * User-isolation: Target goals, progress, edit/delete privileges & reports are strictly private
 * and exclusively accessible to the individual creator who created the campaign.
 */
export const isCampaignCreator = (camp: Campaign, creatorProfile?: CreatorProfile | null): boolean => {
  if (!creatorProfile || !camp) return false;
  if (creatorProfile.isAdmin) return true;
  if (!creatorProfile.phone && !creatorProfile.name) return false;

  const creatorPhone = (creatorProfile.phone || '').trim().replace(/\D/g, '').slice(-10);
  const creatorRawPhone = (creatorProfile.phone || '').trim();
  const creatorName = (creatorProfile.name || '').trim().toLowerCase();
  const cleanCreatorName = creatorName.replace(/\s*\([^)]*\)/g, '').trim();

  const campCreatedBy = (camp.createdBy || '').trim();
  const campCreatedByDigits = campCreatedBy.replace(/\D/g, '').slice(-10);
  const campCreatedByLower = campCreatedBy.toLowerCase();

  const campCreatorPhone = ((camp as any).creatorPhone || (camp as any).contactPhone || '').trim().replace(/\D/g, '').slice(-10);
  const campCreatorName = ((camp as any).creatorName || (camp as any).contactPerson || '').trim().toLowerCase();

  // Alias match for demo YMA creators
  if ((creatorPhone === '9862300000' || creatorPhone === '9862311223') && 
      (campCreatedByDigits === '9862311223' || campCreatedByDigits === '9862300000')) {
    return true;
  }

  // 1. Strict Phone Match (last 10 digits or exact string)
  if (creatorPhone && creatorPhone.length >= 8) {
    if (campCreatedByDigits && campCreatedByDigits.length >= 8 && campCreatedByDigits === creatorPhone) {
      return true;
    }
    if (campCreatorPhone && campCreatorPhone.length >= 8 && campCreatorPhone === creatorPhone) {
      return true;
    }
    if (campCreatedBy && campCreatedBy === creatorRawPhone) {
      return true;
    }
  }

  // 2. Creator Name Match (exact normalized name, non-generic)
  const genericNames = [
    'user', 'guest', 'ronpay user', 'ronpay', 'donor', 'citizen', 
    'community donor', 'community citizen', 'valued donor', 'anonymous', ''
  ];
  const isGeneric = genericNames.includes(cleanCreatorName) || cleanCreatorName.length < 3;

  if (!isGeneric) {
    if (campCreatedByLower && (campCreatedByLower === creatorName || campCreatedByLower === cleanCreatorName)) {
      return true;
    }
    if (campCreatorName && (campCreatorName === creatorName || campCreatorName === cleanCreatorName)) {
      return true;
    }
  }

  // 3. Organization Name Match (if specific and non-generic)
  if (creatorProfile.orgName && camp.orgName) {
    const cOrg = creatorProfile.orgName.trim().toLowerCase();
    const campOrg = camp.orgName.trim().toLowerCase();
    const genericOrgs = ['ronpay community', 'standard user', 'guest', 'ronpay', 'community'];
    if (!genericOrgs.includes(cOrg) && cOrg.length >= 4 && campOrg.length >= 4) {
      if (cOrg === campOrg) {
        return true;
      }
    }
  }

  return false;
};

/**
 * Determines whether a transaction is visible to the currently active user or creator in Sulhnu (History).
 * User / Creator isolation rules:
 * 1. Super Admin: Can view all transactions across the entire platform.
 * 2. Creator: Can view:
 *    - All incoming transactions donated to Campaigns created/managed by this Creator (Bawm Thawhlawm Dawnte).
 *    - Personal transactions paid by this Creator as a donor (Ka Thawhpekte / Pekna).
 *    - Foreign campaigns created by other users where this creator was not the donor are strictly excluded.
 * 3. General Member / Donor / Citizen:
 *    - Sees all transactions made by their phone number, name, or recorded in their local device session.
 */
export const isUserOrCreatorTransaction = (
  tx: Transaction,
  campaigns: Campaign[],
  creatorProfile: CreatorProfile | null | undefined,
  userPaidIds: string[] = []
): boolean => {
  if (!tx) return false;

  // 1. Super Admin has unrestricted access
  if (creatorProfile?.isAdmin) return true;

  // 2. Local device session payments
  if (Array.isArray(userPaidIds) && userPaidIds.length > 0 && userPaidIds.includes(tx.id)) {
    return true;
  }

  const creatorPhoneDigits = (creatorProfile?.phone || '').trim().replace(/\D/g, '').slice(-10);
  const creatorNameRaw = (creatorProfile?.name || '').trim().toLowerCase();
  const cleanCreatorName = creatorNameRaw.replace(/\s*\([^)]*\)/g, '').trim();
  const isGenericUser = ['ronpay user', 'guest user', 'user', 'valued donor', 'anonymous', 'donor', ''].includes(cleanCreatorName);

  const txCampaignTitle = String(tx.campaignTitle || '').toLowerCase().trim();

  // 3. Campaign ownership: Check if tx belongs to a campaign created by the active profile
  if (creatorProfile && (creatorPhoneDigits.length >= 8 || (!isGenericUser && cleanCreatorName.length >= 3))) {
    const parentCamp = (campaigns || []).find(c => 
      c && (
        c.id === tx.campaignId || 
        (txCampaignTitle && c.title && String(c.title).toLowerCase().trim() === txCampaignTitle)
      )
    );
    if (parentCamp && isCampaignCreator(parentCamp, creatorProfile)) {
      return true;
    }

    // Direct check across all campaigns owned by creator
    const isOwned = (campaigns || []).some(c => 
      c && (
        c.id === tx.campaignId || 
        (txCampaignTitle && c.title && String(c.title).toLowerCase().trim() === txCampaignTitle)
      ) &&
      isCampaignCreator(c, creatorProfile)
    );
    if (isOwned) {
      return true;
    }
  }

  // 4. Donor Phone Match (Last 10 digits)
  if (creatorPhoneDigits && creatorPhoneDigits.length >= 8 && tx.donorPhone) {
    const txDigits = String(tx.donorPhone).replace(/\D/g, '').slice(-10);
    if (txDigits.length >= 8 && creatorPhoneDigits === txDigits) {
      return true;
    }
  }

  // 5. Distinctive Donor Name Match (non-generic names)
  if (!isGenericUser && cleanCreatorName.length >= 3 && tx.donorName && !tx.isAnonymous) {
    const dName = String(tx.donorName).trim().toLowerCase();
    if (dName === cleanCreatorName || dName.includes(cleanCreatorName) || cleanCreatorName.includes(dName)) {
      // If phone exists for both, ensure no mismatch
      if (creatorPhoneDigits && creatorPhoneDigits.length >= 8 && tx.donorPhone) {
        const txDigits = String(tx.donorPhone).replace(/\D/g, '').slice(-10);
        if (txDigits.length >= 8 && creatorPhoneDigits !== txDigits) {
          return false;
        }
      }
      return true;
    }
  }

  // 6. Direct Creator/Collector tag match on transaction (if available)
  if (creatorPhoneDigits && creatorPhoneDigits.length >= 8) {
    const txCreatorDigits = String((tx as any).creatorPhone || (tx as any).collectorPhone || (tx as any).createdBy || '').replace(/\D/g, '').slice(-10);
    if (txCreatorDigits && txCreatorDigits.length >= 8 && txCreatorDigits === creatorPhoneDigits) {
      return true;
    }
  }

  return false;
};

/**
 * Returns all transactions accessible to the current logged-in Creator or User for Sulhnu History.
 */
export const getUserOrCreatorVisibleTransactions = (
  transactions: Transaction[],
  campaigns: Campaign[],
  creatorProfile: CreatorProfile | null | undefined,
  userPaidIds: string[] = []
): Transaction[] => {
  if (!transactions || !Array.isArray(transactions) || transactions.length === 0) return [];

  // Super Admin gets all transactions
  if (creatorProfile?.isAdmin) {
    return transactions.filter(Boolean);
  }

  const safeCampaigns = Array.isArray(campaigns) ? campaigns.filter(Boolean) : [];
  const safeUserPaidIds = Array.isArray(userPaidIds) ? userPaidIds : [];

  const matched = transactions.filter(tx => 
    tx && isUserOrCreatorTransaction(tx, safeCampaigns, creatorProfile, safeUserPaidIds)
  );

  // If user is a brand-new guest explorer (no phone, no specific profile name, no session payment), provide standard demo transactions for receipt exploration
  const creatorPhoneDigits = (creatorProfile?.phone || '').trim().replace(/\D/g, '').slice(-10);
  const creatorNameRaw = (creatorProfile?.name || '').trim().toLowerCase();
  const cleanCreatorName = creatorNameRaw.replace(/\s*\([^)]*\)/g, '').trim();
  const isGeneric = ['ronpay user', 'guest user', 'user', 'valued donor', 'anonymous', 'donor', ''].includes(cleanCreatorName);
  
  const hasSpecificAccount = Boolean((creatorPhoneDigits && creatorPhoneDigits.length >= 8) || (!isGeneric && cleanCreatorName.length >= 3));

  if (matched.length === 0 && !hasSpecificAccount && safeUserPaidIds.length === 0) {
    // For guest users or fresh mobile app installs, show the full platform transactions so the screen is never blank
    return transactions;
  }

  return matched;
};

// ==========================================
// Audit Logs Storage & Management
// ==========================================

export const getStoredAuditLogs = (): AuditLog[] => {
  try {
    const raw = localStorage.getItem(AUDIT_LOGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to parse audit logs', e);
  }
  return INITIAL_AUDIT_LOGS;
};

export const saveStoredAuditLogs = (logs: AuditLog[]) => {
  try {
    localStorage.setItem(AUDIT_LOGS_KEY, JSON.stringify(logs));
  } catch (e) {
    console.error('Failed to save audit logs', e);
  }
};

export const recordAuditLog = (
  action: string,
  details: string,
  targetType: AuditLog['targetType'] = 'system',
  targetId?: string,
  performedBy: string = 'Admin (Biometric)'
): AuditLog => {
  const newLog: AuditLog = {
    id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    action,
    details,
    targetType,
    targetId,
    performedBy,
    timestamp: new Date().toISOString()
  };

  try {
    const current = getStoredAuditLogs();
    const updated = [newLog, ...current.slice(0, 199)]; // Keep latest 200 logs
    saveStoredAuditLogs(updated);
    syncAuditLogToFirestore(newLog).catch(() => {});
  } catch (e) {
    console.error('Failed to record audit log', e);
  }

  return newLog;
};

// ==========================================
// Custom Announcement Banner Storage
// ==========================================

export const getStoredAnnouncement = (): AnnouncementBanner => {
  try {
    const raw = localStorage.getItem(ANNOUNCEMENT_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.title) {
        // Ensure default items exist if upgrading from older format
        if (!parsed.items || parsed.items.length === 0) {
          parsed.items = DEFAULT_ANNOUNCEMENT_ITEMS;
        }
        if (parsed.autoRotate === undefined) {
          parsed.autoRotate = true;
        }
        if (!parsed.rotationSpeedSeconds) {
          parsed.rotationSpeedSeconds = 4;
        }
        if (!parsed.animationStyle) {
          parsed.animationStyle = 'slide';
        }
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to parse announcement banner', e);
  }
  return DEFAULT_ANNOUNCEMENT;
};

export const saveStoredAnnouncement = (ann: AnnouncementBanner) => {
  try {
    localStorage.setItem(ANNOUNCEMENT_KEY, JSON.stringify(ann));
    if (ann) {
      syncAnnouncementToFirestore(ann).catch(() => {});
    }
    safeApiFetch('/api/announcement', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ann)
    });
  } catch (e) {
    console.error('Failed to save announcement banner', e);
  }
};

// ==========================================
// Data Backup & Restore (JSON)
// ==========================================

export interface RonPayBackupPackage {
  version: string;
  exportedAt: string;
  app: string;
  data: {
    campaigns: Campaign[];
    transactions: Transaction[];
    creatorsList: CreatorProfile[];
    creatorProfile: CreatorProfile;
    pricingConfig: SystemPricingConfig;
    announcement: AnnouncementBanner;
    auditLogs: AuditLog[];
    userPaidTxIds: string[];
  };
}

export const exportFullDatabaseBackup = (): string => {
  const backup: RonPayBackupPackage = {
    version: '2.5.0',
    exportedAt: new Date().toISOString(),
    app: 'RonPay Community Platform',
    data: {
      campaigns: getStoredCampaigns(),
      transactions: getStoredTransactions(),
      creatorsList: getStoredCreatorsList(),
      creatorProfile: getStoredCreatorProfile(),
      pricingConfig: getStoredPricingConfig(),
      announcement: getStoredAnnouncement(),
      auditLogs: getStoredAuditLogs(),
      userPaidTxIds: getStoredUserPaidTxIds(),
    }
  };

  recordAuditLog(
    'Database Backup Exported',
    `Exported full backup containing ${backup.data.campaigns.length} campaigns, ${backup.data.transactions.length} transactions, and ${backup.data.creatorsList.length} creators.`,
    'system'
  );

  return JSON.stringify(backup, null, 2);
};

export const restoreFullDatabaseBackup = (
  jsonString: string
): { success: boolean; error?: string; counts?: { campaigns: number; transactions: number; creators: number } } => {
  try {
    const parsed: RonPayBackupPackage = JSON.parse(jsonString);
    if (!parsed || !parsed.data) {
      return { success: false, error: 'Invalid backup file structure: missing data payload.' };
    }

    const { data } = parsed;

    if (Array.isArray(data.campaigns)) {
      saveStoredCampaigns(data.campaigns);
    }
    if (Array.isArray(data.transactions)) {
      saveStoredTransactions(data.transactions);
    }
    if (Array.isArray(data.creatorsList)) {
      saveStoredCreatorsList(data.creatorsList);
    }
    if (data.creatorProfile && typeof data.creatorProfile === 'object') {
      saveStoredCreatorProfile(data.creatorProfile);
    }
    if (data.pricingConfig && typeof data.pricingConfig === 'object') {
      saveStoredPricingConfig(data.pricingConfig);
    }
    if (data.announcement && typeof data.announcement === 'object') {
      saveStoredAnnouncement(data.announcement);
    }
    if (Array.isArray(data.auditLogs)) {
      saveStoredAuditLogs(data.auditLogs);
    }
    if (Array.isArray(data.userPaidTxIds)) {
      saveStoredUserPaidTxIds(data.userPaidTxIds);
    }

    recordAuditLog(
      'Database Restored from Backup',
      `Restored database snapshot from ${parsed.exportedAt || 'backup file'}.`,
      'system'
    );

    return {
      success: true,
      counts: {
        campaigns: data.campaigns?.length || 0,
        transactions: data.transactions?.length || 0,
        creators: data.creatorsList?.length || 0,
      }
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'JSON parsing failure.' };
  }
};

export const INITIAL_DEFAULT_MEMBERS: MemberRecord[] = [
  {
    id: 'EBE-1460',
    campaignId: 'cmp-kumtluang-1',
    name: 'Rammuanpuia Ralte',
    orgCode: 'EBE',
    phoneLast4: '1460',
    fullPhone: '9436141460',
    section: 'Bial 1 (Vengchhak)',
    isFamilyHead: true,
    dependents: [
      { subId: 'EBE-1460-01', name: 'Lalrinchhani (Nupui)', relation: 'Nupui' },
      { subId: 'EBE-1460-02', name: 'Muanpuia Jr. (Fapa)', relation: 'Fa' }
    ],
    createdAt: '2026-01-01T00:00:00.000Z'
  },
  {
    id: 'EBE-8622',
    campaignId: 'cmp-kumtluang-1',
    name: 'Lalduhawma Fanai',
    orgCode: 'EBE',
    phoneLast4: '8622',
    fullPhone: '9862358622',
    section: 'Bial 2 (Vengthlang)',
    isFamilyHead: true,
    dependents: [
      { subId: 'EBE-8622-01', name: 'Zodingliani (Nupui)', relation: 'Nupui' },
      { subId: 'EBE-8622-02', name: 'Lalmuanawma (Fa)', relation: 'Fa' }
    ],
    createdAt: '2026-01-02T00:00:00.000Z'
  },
  {
    id: 'EBE-3120',
    campaignId: 'cmp-kumtluang-1',
    name: 'Zonunsanga Hnamte',
    orgCode: 'EBE',
    phoneLast4: '3120',
    fullPhone: '8794563120',
    section: 'Bial 1 (Vengchhak)',
    isFamilyHead: true,
    dependents: [
      { subId: 'EBE-3120-01', name: 'Lalremruati (Nupui)', relation: 'Nupui' }
    ],
    createdAt: '2026-01-03T00:00:00.000Z'
  },
  {
    id: 'EBE-5544',
    campaignId: 'cmp-kumtluang-1',
    name: 'C. Lalmuanpuia',
    orgCode: 'EBE',
    phoneLast4: '5544',
    fullPhone: '9436125544',
    section: 'Bial 3 (Venglai)',
    isFamilyHead: true,
    dependents: [],
    createdAt: '2026-01-04T00:00:00.000Z'
  },
  {
    id: 'EBE-9912',
    campaignId: 'cmp-kumtluang-1',
    name: 'Lalbiakzuala & Chhungte',
    orgCode: 'EBE',
    phoneLast4: '9912',
    fullPhone: '9862399912',
    section: 'Bial 4 (Field Veng)',
    isFamilyHead: true,
    dependents: [
      { subId: 'EBE-9912-01', name: 'Lalhmingmawii (Nupui)', relation: 'Nupui' }
    ],
    createdAt: '2026-01-05T00:00:00.000Z'
  },
  {
    id: 'KTL-5510',
    campaignId: 'cmp-kumtluang-2',
    name: 'Vanlalhruaia Chhangte',
    orgCode: 'KTL',
    phoneLast4: '5510',
    fullPhone: '9862555510',
    section: 'Bial I (Khatla South)',
    isFamilyHead: true,
    dependents: [
      { subId: 'KTL-5510-01', name: 'Lallawmsangi (Nupui)', relation: 'Nupui' },
      { subId: 'KTL-5510-02', name: 'Lalremruata (Fapa)', relation: 'Fa' }
    ],
    createdAt: '2026-01-06T00:00:00.000Z'
  },
  {
    id: 'KTL-7234',
    campaignId: 'cmp-kumtluang-2',
    name: 'Zodingliana Sailo',
    orgCode: 'KTL',
    phoneLast4: '7234',
    fullPhone: '9436127234',
    section: 'Bial II (Khatla North)',
    isFamilyHead: true,
    dependents: [
      { subId: 'KTL-7234-01', name: 'Zomuanpuii (Nupui)', relation: 'Nupui' }
    ],
    createdAt: '2026-01-07T00:00:00.000Z'
  },
  {
    id: 'YMAVT-7373',
    campaignId: 'cmp-1787829303143',
    name: 'Lalhmangaiha',
    orgCode: 'YMAVT',
    phoneLast4: '7373',
    fullPhone: '9862377373',
    section: 'Section A (Vengthar)',
    isFamilyHead: true,
    dependents: [
      { subId: 'YMAVT-7373-01', name: 'Lalduhawmi (Nupui)', relation: 'Nupui' }
    ],
    createdAt: '2026-08-20T00:00:00.000Z'
  },
  {
    id: 'YMAVT-1212',
    campaignId: 'cmp-1787829303143',
    name: 'Vanlalthlana',
    orgCode: 'YMAVT',
    phoneLast4: '1212',
    fullPhone: '9436121212',
    section: 'Section B (Vengthar)',
    isFamilyHead: true,
    dependents: [],
    createdAt: '2026-08-21T00:00:00.000Z'
  },
  {
    id: 'YMAVT-3434',
    campaignId: 'cmp-1787829303143',
    name: 'C. Lalramnghaka',
    orgCode: 'YMAVT',
    phoneLast4: '3434',
    fullPhone: '8794343434',
    section: 'Section A (Vengthar)',
    isFamilyHead: true,
    dependents: [],
    createdAt: '2026-08-22T00:00:00.000Z'
  },
  {
    id: 'YMAVT-5465',
    campaignId: 'cmp-1787829303143',
    name: 'Zonunmawia',
    orgCode: 'YMAVT',
    phoneLast4: '5465',
    fullPhone: '9862545465',
    section: 'Section C (Vengthar)',
    isFamilyHead: true,
    dependents: [],
    createdAt: '2026-08-23T00:00:00.000Z'
  },
  {
    id: 'YMAVT-5859',
    campaignId: 'cmp-1787829303143',
    name: 'Lalrinawma',
    orgCode: 'YMAVT',
    phoneLast4: '5859',
    fullPhone: '9436585859',
    section: 'Section D (Vengthar)',
    isFamilyHead: true,
    dependents: [],
    createdAt: '2026-08-24T00:00:00.000Z'
  },
  {
    id: 'YMAVT-8466',
    campaignId: 'cmp-1787829303143',
    name: 'Lalhruaitluanga',
    orgCode: 'YMAVT',
    phoneLast4: '8466',
    fullPhone: '8794848466',
    section: 'Section B (Vengthar)',
    isFamilyHead: true,
    dependents: [],
    createdAt: '2026-08-25T00:00:00.000Z'
  },
  // --- BMP Shillong (cmp-1788107291420) Member Roll ---
  {
    id: 'BMPSHL-1718',
    campaignId: 'cmp-1788107291420',
    name: 'J Lalsangliana',
    orgCode: 'BMPSHL',
    phoneLast4: '1718',
    fullPhone: '',
    section: 'Section A',
    isFamilyHead: true,
    dependents: [],
    createdAt: '2026-08-15T00:00:00.000Z',
    status: 'paid'
  },
  {
    id: 'BMPSHL-1739',
    campaignId: 'cmp-1788107291420',
    name: 'Upa Thawngphena Tuallawt',
    orgCode: 'BMPSHL',
    phoneLast4: '1739',
    fullPhone: '9366321739',
    section: 'Bial 1 (Vengchhak)',
    isFamilyHead: true,
    dependents: [],
    createdAt: '2026-08-15T00:00:00.000Z',
    status: 'paid'
  },
  {
    id: 'BMPSHL-4259',
    campaignId: 'cmp-1788107291420',
    name: 'Eric C Lallawmpuia',
    orgCode: 'BMPSHL',
    phoneLast4: '4259',
    fullPhone: '8800904259',
    section: 'Section A',
    isFamilyHead: true,
    dependents: [],
    createdAt: '2026-03-15T00:00:00.000Z',
    status: 'paid'
  },
  {
    id: 'BMPSHL-0562',
    campaignId: 'cmp-1788107291420',
    name: 'Lalruatfela Zadeng',
    orgCode: 'BMPSHL',
    phoneLast4: '0562',
    fullPhone: '7642930562',
    section: 'Section A',
    isFamilyHead: true,
    dependents: [],
    createdAt: '2026-08-31T18:21:49.989Z',
    status: 'paid'
  },
  {
    id: 'BMPSHL-0520',
    campaignId: 'cmp-1788107291420',
    name: 'Lalrinawma Hmar',
    orgCode: 'BMPSHL',
    phoneLast4: '0520',
    fullPhone: '8787560520',
    section: 'Section A',
    isFamilyHead: true,
    dependents: [],
    createdAt: '2026-08-31T18:19:28.675Z',
    status: 'paid'
  },
  {
    id: 'BMPSHL-8871',
    campaignId: 'cmp-1788107291420',
    name: 'Upa Vanlalliana',
    orgCode: 'BMPSHL',
    phoneLast4: '8871',
    fullPhone: '9615328871',
    section: 'Section A',
    isFamilyHead: true,
    dependents: [],
    createdAt: '2026-08-31T18:18:40.740Z',
    status: 'paid'
  },
  {
    id: 'BMPSHL-1111',
    campaignId: 'cmp-1788107291420',
    name: 'Lalhruaisanga',
    orgCode: 'BMPSHL',
    phoneLast4: '1111',
    fullPhone: '2222211111',
    section: 'Section A',
    isFamilyHead: true,
    dependents: [],
    createdAt: '2026-08-31T18:18:07.314Z',
    status: 'paid'
  },
  {
    id: 'BMPSHL-8526',
    campaignId: 'cmp-1788107291420',
    name: 'Lalzawmliana Sailo',
    orgCode: 'BMPSHL',
    phoneLast4: '8526',
    fullPhone: '7005338526',
    section: 'Section A',
    isFamilyHead: true,
    dependents: [],
    createdAt: '2026-08-31T18:15:26.267Z',
    status: 'paid'
  },
  {
    id: 'BMPSHL-3106',
    campaignId: 'cmp-1788107291420',
    name: 'K Lalfakzuala',
    orgCode: 'BMPSHL',
    phoneLast4: '3106',
    fullPhone: '9383193106',
    section: 'Section A',
    isFamilyHead: true,
    dependents: [],
    createdAt: '2026-08-31T18:14:59.224Z',
    status: 'paid'
  },
  {
    id: 'BMPSHL-1548',
    campaignId: 'cmp-1788107291420',
    name: 'Zothanzuala Hrahsel',
    orgCode: 'BMPSHL',
    phoneLast4: '1548',
    fullPhone: '',
    section: 'Section A',
    isFamilyHead: true,
    dependents: [],
    createdAt: '2026-08-31T18:11:34.756Z',
    status: 'paid'
  },
  {
    id: 'BMPSHL-5353',
    campaignId: 'cmp-1788107291420',
    name: 'Micky Marbanag',
    orgCode: 'BMPSHL',
    phoneLast4: '5353',
    fullPhone: '3532535353',
    section: 'Section A',
    isFamilyHead: true,
    dependents: [],
    createdAt: '2026-08-31T17:37:05.710Z',
    status: 'paid'
  },
  {
    id: 'BMPSHL-3333',
    campaignId: 'cmp-1788107291420',
    name: 'David Lallianzuala',
    orgCode: 'BMPSHL',
    phoneLast4: '3333',
    fullPhone: '4534543333',
    section: 'Section A',
    isFamilyHead: true,
    dependents: [],
    createdAt: '2026-08-31T17:36:40.078Z',
    status: 'paid'
  },
  {
    id: 'BMPSHL-2445',
    campaignId: 'cmp-1788107291420',
    name: 'JH Lalthlanbika',
    orgCode: 'BMPSHL',
    phoneLast4: '2445',
    fullPhone: '2324552445',
    section: 'Section A',
    isFamilyHead: true,
    dependents: [],
    createdAt: '2026-08-31T17:36:09.358Z',
    status: 'paid'
  },
  {
    id: 'BMPSHL-1133',
    campaignId: 'cmp-1788107291420',
    name: 'David Jahau',
    orgCode: 'BMPSHL',
    phoneLast4: '1133',
    fullPhone: '6323521133',
    section: 'Section A',
    isFamilyHead: true,
    dependents: [],
    createdAt: '2026-08-31T12:06:48.589Z',
    status: 'paid'
  },
  {
    id: 'BMPSHL-2079',
    campaignId: 'cmp-1788107291420',
    name: 'Richard L Jongte',
    orgCode: 'BMPSHL',
    phoneLast4: '2079',
    fullPhone: '9862712079',
    section: 'Section A',
    isFamilyHead: true,
    dependents: [],
    createdAt: '2026-08-31T12:04:53.726Z',
    status: 'paid'
  },
  {
    id: 'BMPSHL-6368',
    campaignId: 'cmp-1788107291420',
    name: 'Zoliansanga',
    orgCode: 'BMPSHL',
    phoneLast4: '6368',
    fullPhone: '9436156368',
    section: 'Section A',
    isFamilyHead: true,
    dependents: [],
    createdAt: '2026-08-31T12:03:27.271Z',
    status: 'paid'
  },
  {
    id: 'BMPSHL-7128',
    campaignId: 'cmp-1788107291420',
    name: 'Lalnuntluanga Vanchhawng',
    orgCode: 'BMPSHL',
    phoneLast4: '7128',
    fullPhone: '8415967128',
    section: 'Section A',
    isFamilyHead: true,
    dependents: [],
    createdAt: '2026-08-31T12:02:10.171Z',
    status: 'paid'
  },
  {
    id: 'BMPSHL-4610',
    campaignId: 'cmp-1788107291420',
    name: 'Upa R Lalhmachhuana',
    orgCode: 'BMPSHL',
    phoneLast4: '4610',
    fullPhone: '9436354610',
    section: 'Section A',
    isFamilyHead: true,
    dependents: [],
    createdAt: '2026-08-31T12:01:27.790Z',
    status: 'paid'
  },
  {
    id: 'BMPSHL-8223',
    campaignId: 'cmp-1788107291420',
    name: 'Jackie Lalrinsanga',
    orgCode: 'BMPSHL',
    phoneLast4: '8223',
    fullPhone: '9620998223',
    section: 'Section A',
    isFamilyHead: true,
    dependents: [],
    createdAt: '2026-08-31T11:37:53.546Z',
    status: 'paid'
  },
  {
    id: 'BMPSHL-0258',
    campaignId: 'cmp-1788107291420',
    name: 'Upa B Laltanpuia',
    orgCode: 'BMPSHL',
    phoneLast4: '0258',
    fullPhone: '9436100258',
    section: 'Section A',
    isFamilyHead: true,
    dependents: [],
    createdAt: '2026-08-31T11:37:28.837Z',
    status: 'paid'
  },
  {
    id: 'BMPSHL-8999',
    campaignId: 'cmp-1788107291420',
    name: 'JH Lallianbika',
    orgCode: 'BMPSHL',
    phoneLast4: '8999',
    fullPhone: '2345678999',
    section: 'Section A',
    isFamilyHead: true,
    dependents: [],
    createdAt: '2026-08-31T11:36:55.552Z',
    status: 'paid'
  },
  {
    id: 'BMPSHL-8465',
    campaignId: 'cmp-1788107291420',
    name: 'Upa Lalramzauva Sailo',
    orgCode: 'BMPSHL',
    phoneLast4: '8465',
    fullPhone: '9436118465',
    section: 'Section A',
    isFamilyHead: true,
    dependents: [],
    createdAt: '2026-08-31T11:36:07.910Z',
    status: 'paid'
  },
  {
    id: 'BMPSHL-7944',
    campaignId: 'cmp-1788107291420',
    name: 'Upa C Lalbiaktluanga',
    orgCode: 'BMPSHL',
    phoneLast4: '7944',
    fullPhone: '9774487944',
    section: 'Section A',
    isFamilyHead: true,
    dependents: [],
    createdAt: '2026-08-31T11:35:42.937Z',
    status: 'paid'
  },
  {
    id: 'BMPSHL-3902',
    campaignId: 'cmp-1788107291420',
    name: 'RC Lalliana',
    orgCode: 'BMPSHL',
    phoneLast4: '3902',
    fullPhone: '7005153902',
    section: 'Section A',
    isFamilyHead: true,
    dependents: [],
    createdAt: '2026-08-31T11:33:22.166Z',
    status: 'paid'
  },
  {
    id: 'BMPSHL-1253',
    campaignId: 'cmp-1788107291420',
    name: 'J Lalsangliana',
    orgCode: 'BMPSHL',
    phoneLast4: '1253',
    fullPhone: '8635241253',
    section: 'Bial 1 (Vengchhak)',
    isFamilyHead: true,
    dependents: [],
    createdAt: '2026-08-30T17:17:12.449Z',
    status: 'paid'
  },
  {
    id: 'BMPSHL-6709',
    campaignId: 'cmp-1788107291420',
    name: 'Lalkhawmuana',
    orgCode: 'BMPSHL',
    phoneLast4: '6709',
    fullPhone: '',
    section: 'Section A',
    isFamilyHead: true,
    dependents: [],
    createdAt: '2026-03-22T00:00:00.000Z',
    status: 'paid'
  },
  // --- PCI Sikulpuikawn (cmp-1787771373697) ---
  {
    id: 'PCIS-4444',
    campaignId: 'cmp-1787771373697',
    name: 'Biaka',
    orgCode: 'PCIS',
    phoneLast4: '4444',
    fullPhone: '',
    section: 'Bial 1 (Vengchhak)',
    isFamilyHead: true,
    dependents: [],
    createdAt: '2026-08-26T19:15:27.048Z',
    status: 'paid'
  }
];

export const getMembers = (campaignId?: string): MemberRecord[] => {
  try {
    let storedMembers: MemberRecord[] = [];
    const raw = localStorage.getItem(MEMBERS_LIST_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        storedMembers = parsed;
      }
    }

    // Merge default initial members with stored members
    const map = new Map<string, MemberRecord>();
    for (const m of INITIAL_DEFAULT_MEMBERS) {
      if (m && m.id) map.set(m.id.toLowerCase(), m);
    }
    for (const m of storedMembers) {
      if (m && m.id) {
        const k = m.id.toLowerCase();
        const existing = map.get(k);
        const resolvedCampaignId = m.campaignId === 'cmp-kumtluang-ymavt' ? 'cmp-1787829303143' : (m.campaignId || existing?.campaignId || '');
        map.set(k, { ...(existing || {}), ...m, campaignId: resolvedCampaignId });
      }
    }

    // Self-healing from transactions: If any transactions exist for members not yet in map, automatically recover them!
    try {
      const txs = getStoredTransactions();
      let hasRecovered = false;
      for (const t of txs) {
        if (t && t.memberId && String(t.memberId).trim()) {
          const mid = String(t.memberId).trim();
          const k = mid.toLowerCase();
          if (!map.has(k)) {
            const orgCode = mid.split('-')[0] || '';
            const phoneLast4 = t.donorPhone ? String(t.donorPhone).slice(-4) : (mid.split('-')[1] || '');
            map.set(k, {
              id: mid,
              campaignId: t.campaignId || '',
              name: t.donorName || `Member ${mid}`,
              orgCode: orgCode.toUpperCase(),
              phoneLast4: phoneLast4,
              fullPhone: (t.donorPhone && String(t.donorPhone).length >= 10) ? String(t.donorPhone) : '',
              section: t.donorVeng || 'Section A',
              isFamilyHead: true,
              dependents: [],
              createdAt: t.timestamp || new Date().toISOString(),
              status: 'paid'
            });
            hasRecovered = true;
          }
        }
      }
      if (hasRecovered && typeof localStorage !== 'undefined') {
        localStorage.setItem(MEMBERS_LIST_KEY, JSON.stringify(Array.from(map.values())));
      }
    } catch (recoverErr) {
      console.warn('Storage transaction self-healing check:', recoverErr);
    }

    const allMembers = Array.from(map.values());

    if (!campaignId || campaignId === 'all') {
      return allMembers;
    }

    // Filter strictly by campaignId, orgCode, or prefix
    const campaigns = getStoredCampaigns();
    const targetCampaign = campaigns.find(c => c.id === campaignId);

    return allMembers.filter(m => {
      // 1. Direct campaignId match
      if (m.campaignId && m.campaignId === campaignId) {
        return true;
      }
      
      // 2. Org code match with targetCampaign (e.g. BMPSHL === BMPSHL)
      if (targetCampaign && m.orgCode && targetCampaign.orgCode && m.orgCode.toUpperCase() === targetCampaign.orgCode.toUpperCase()) {
        return true;
      }
      
      // 3. ID prefix match (e.g. BMPSHL-1718 starts with BMPSHL)
      if (targetCampaign?.orgCode && m.id) {
        const prefix = m.id.split('-')[0].toUpperCase();
        if (prefix === targetCampaign.orgCode.toUpperCase()) {
          return true;
        }
      }

      // 4. Backward compatibility & direct campaign mappings
      if (m.orgCode === 'EBE' && campaignId === 'cmp-kumtluang-1') return true;
      if (m.orgCode === 'KTL' && campaignId === 'cmp-kumtluang-2') return true;
      if (m.orgCode === 'BMPSHL' && (campaignId === 'cmp-1788107291420' || campaignId.toLowerCase().includes('bmp'))) return true;
      if (m.orgCode === 'YMAVT' && (campaignId === 'cmp-kumtluang-ymavt' || campaignId === 'cmp-1787829303143' || campaignId.includes('ymavt') || campaignId.includes('yma-vengthar'))) return true;
      if (m.orgCode === 'PCIS' && (campaignId === 'cmp-1787771373697' || campaignId.toLowerCase().includes('pcis') || campaignId.toLowerCase().includes('sikulpuikawn'))) return true;

      // 5. Title / Org Name match (e.g. 'BMP Shillong' contains 'BMPSHL' or 'BMP')
      if (targetCampaign) {
        const campClean = (targetCampaign.orgName || targetCampaign.title || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
        const memOrgClean = (m.orgCode || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
        const memPrefixClean = (m.id.split('-')[0] || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (memOrgClean && campClean && (campClean.includes(memOrgClean) || memOrgClean.includes(campClean))) {
          return true;
        }
        if (memPrefixClean && campClean && (campClean.includes(memPrefixClean) || memPrefixClean.includes(campClean))) {
          return true;
        }
      }

      return false;
    });
  } catch (e) {
    if (!campaignId || campaignId === 'all') return INITIAL_DEFAULT_MEMBERS;
    return INITIAL_DEFAULT_MEMBERS.filter(m => m.campaignId === campaignId || (campaignId === 'cmp-kumtluang-1' && m.orgCode === 'EBE') || (campaignId === 'cmp-kumtluang-2' && m.orgCode === 'KTL'));
  }
};

export const saveMembers = (members: MemberRecord[]): void => {
  try {
    localStorage.setItem(MEMBERS_LIST_KEY, JSON.stringify(members));
    
    // Broadcast instant sync events to all components & windows
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ronpay-members-updated', { detail: members }));
      window.dispatchEvent(new CustomEvent('ronpay_members_updated', { detail: members }));
    }

    safeApiFetch('/api/data/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ members })
    });
  } catch (e) {
    console.error('Failed to save members to localStorage', e);
  }
};

export const addBatchMembers = (newMembers: MemberRecord[], overwriteExisting = true): { added: number; updated: number; total: number } => {
  if (!newMembers || newMembers.length === 0) return { added: 0, updated: 0, total: 0 };
  const allList = getMembers();
  let added = 0;
  let updated = 0;

  for (const member of newMembers) {
    if (!member || !member.id) continue;
    const targetId = member.id.trim().toLowerCase();
    const idx = allList.findIndex(m =>
      (m.id || '').trim().toLowerCase() === targetId &&
      (!member.campaignId || !m.campaignId || m.campaignId === member.campaignId)
    );

    if (idx >= 0) {
      if (overwriteExisting) {
        allList[idx] = { ...allList[idx], ...member };
        updated++;
      }
    } else {
      allList.unshift(member);
      added++;
    }
  }

  saveMembers(allList);
  return { added, updated, total: allList.length };
};

export const addOrUpdateMember = (member: MemberRecord): void => {
  const allList = getMembers(); // Load all members across all Bawms
  const targetId = (member.id || '').trim().toLowerCase();
  const idx = allList.findIndex(m => 
    (m.id || '').trim().toLowerCase() === targetId && 
    (!member.campaignId || !m.campaignId || m.campaignId === member.campaignId)
  );
  if (idx >= 0) {
    allList[idx] = member;
  } else {
    allList.unshift(member);
  }
  saveMembers(allList);
  if (member && member.id) {
    syncMemberToFirestore(member).catch(() => {});
  }
  safeApiFetch('/api/members', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(member)
  });
};

export const deleteMember = (memberId: string, campaignId?: string): void => {
  const allList = getMembers();
  const targetId = (memberId || '').trim().toLowerCase();
  const filtered = allList.filter(m => {
    if ((m.id || '').trim().toLowerCase() !== targetId) return true;
    if (campaignId && m.campaignId && m.campaignId !== campaignId) return true;
    return false;
  });
  saveMembers(filtered);
  if (memberId) {
    deleteMemberFromFirestore(memberId).catch(() => {});
  }
  safeApiFetch(`/api/members/${encodeURIComponent(memberId)}`, {
    method: 'DELETE'
  });
};

export const migrateCampaignMembersPrefix = (campaignId: string, oldPrefix: string, newPrefix: string): number => {
  if (!campaignId || !newPrefix) return 0;
  const cleanOld = (oldPrefix || '').trim().toUpperCase();
  const cleanNew = newPrefix.trim().toUpperCase();
  if (cleanOld && cleanOld === cleanNew) return 0;

  const allMembers = getMembers();
  let migratedCount = 0;
  const updatedMembers = allMembers.map(m => {
    const isThisCampaign = m.campaignId === campaignId || (!m.campaignId && cleanOld && m.orgCode === cleanOld);
    if (isThisCampaign) {
      migratedCount++;
      const p4 = m.phoneLast4 || (m.id.includes('-') ? m.id.split('-')[1] : m.id.slice(-4));
      return {
        ...m,
        campaignId,
        orgCode: cleanNew,
        id: `${cleanNew}-${p4}`
      };
    }
    return m;
  });

  if (migratedCount > 0) {
    saveMembers(updatedMembers);
  }
  return migratedCount;
};

export const saveTransaction = (tx: Transaction): void => {
  if (!tx || !tx.id) return;
  const isBill = Boolean(tx.billServiceType || tx.billConsumerNumber || tx.billOperator) ||
    String(tx.id || '').startsWith('BILL-') || 
    String(tx.id || '').startsWith('TXN-BILL-') || 
    String(tx.campaignId || '').startsWith('bill-');
  if (!isBill && (!tx.category || tx.category === 'others')) {
    const titleL = String(tx.campaignTitle || '').toLowerCase();
    if (titleL.includes('ralna') || tx.campaignId === 'cmp-1788526889943') {
      tx.category = 'ralna';
    } else if (titleL.includes('rikrum') || tx.campaignId === 'cmp-1788528889947') {
      tx.category = 'rikrum';
    } else if (titleL.includes('kumtluang') || tx.campaignId === 'cmp-1788529889949') {
      tx.category = 'kumtluang';
    } else {
      tx.category = 'khawlsak';
    }
  }
  const current = getStoredTransactions();
  const updated = [tx, ...current.filter(t => t.id !== tx.id)];
  saveStoredTransactions(updated);
  recordUserPaidTxId(tx.id);
  syncTransactionToFirestore(tx).catch(() => {});
  safeApiFetch('/api/transactions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(tx)
  });
};

const WALLET_KEY = 'ronpay_wallet_v1';

export const DEFAULT_WALLET: RonPayWallet = {
  walletId: 'WAL-9436001234',
  upiHandle: 'ronpay.9436001234@yesbank',
  balance: 3450,
  pendingPayouts: 0,
  totalCredited: 12500,
  totalWithdrawn: 9050,
  linkedBankName: 'State Bank of India (Aizawl Main)',
  linkedAccountLast4: '4589',
  linkedUpiId: 'ronpay.creator@oksbi',
  isKycVerified: true,
  history: [
    {
      id: 'WTX-101',
      type: 'credit',
      title: 'UPI Wallet Top-up (GPay)',
      amount: 1000,
      status: 'completed',
      source: 'upi_topup',
      timestamp: new Date(Date.now() - 3600000 * 3).toISOString(),
      utrRef: 'UPI/384920491823',
      remark: 'RonPay Wallet Fast Top-Up',
      balanceAfter: 3450
    },
    {
      id: 'WTX-102',
      type: 'debit',
      title: 'Bawm Donation (Ralna Bawm)',
      amount: 500,
      status: 'completed',
      source: 'qr_payment',
      timestamp: new Date(Date.now() - 3600000 * 20).toISOString(),
      utrRef: 'TXN/RAL/928401',
      remark: 'Paid to Pu Lalthanzauva Ralna',
      balanceAfter: 2450
    },
    {
      id: 'WTX-103',
      type: 'credit',
      title: 'Campaign Payout Credit',
      amount: 2500,
      status: 'completed',
      source: 'campaign_collection',
      timestamp: new Date(Date.now() - 3600000 * 48).toISOString(),
      utrRef: 'SETTLE/KUM/48190',
      remark: 'Kumtluang Bawm Monthly Settlement',
      balanceAfter: 2950
    },
    {
      id: 'WTX-104',
      type: 'debit',
      title: 'Bank Settlement (IMPS)',
      amount: 2000,
      status: 'completed',
      source: 'bank_withdrawal',
      timestamp: new Date(Date.now() - 3600000 * 72).toISOString(),
      utrRef: 'IMPS/SBI/928340192',
      remark: 'Transferred to SBI A/C ending 4589',
      balanceAfter: 450
    }
  ]
};

export const getStoredWallet = (): RonPayWallet => {
  try {
    const raw = localStorage.getItem(WALLET_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.balance === 'number') {
        return parsed;
      }
    }
    localStorage.setItem(WALLET_KEY, JSON.stringify(DEFAULT_WALLET));
  } catch (e) {
    console.error('Failed to read wallet from storage', e);
  }
  return DEFAULT_WALLET;
};

export const saveStoredWallet = (wallet: RonPayWallet) => {
  try {
    localStorage.setItem(WALLET_KEY, JSON.stringify(wallet));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ronpay_wallet_updated', { detail: wallet }));
    }
  } catch (e) {
    console.error('Failed to save wallet to storage', e);
  }
};

const STAFF_ACCOUNTS_KEY = 'ronpay_staff_accounts_v1';

export const getStoredStaffAccounts = (): StaffAccount[] => {
  try {
    const raw = localStorage.getItem(STAFF_ACCOUNTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to read staff accounts from storage', e);
  }
  return [
    {
      id: 'staff-super-1',
      name: 'Super Admin (Master)',
      email: 'superadmin@ronpay.com',
      phone: '9862000001',
      role: 'SUPER_ADMIN',
      designation: 'Chief System Architect',
      assignedAt: '2026-01-01T00:00:00.000Z',
      assignedBy: 'System Root',
      isActive: true,
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
      lastLogin: new Date().toISOString(),
      createdAt: '2026-01-01T00:00:00.000Z'
    },
    {
      id: 'staff-admin-1',
      name: 'Lalrinchhana (Operations)',
      email: 'admin@ronpay.com',
      phone: '9862000002',
      role: 'ADMIN',
      designation: 'Operations & Finance Manager',
      assignedAt: '2026-02-15T00:00:00.000Z',
      assignedBy: 'superadmin@ronpay.com',
      isActive: true,
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
      lastLogin: new Date(Date.now() - 3600000 * 4).toISOString(),
      createdAt: '2026-02-15T00:00:00.000Z'
    },
    {
      id: 'staff-mod-1',
      name: 'Zonunmawii (KYC Desk)',
      email: 'moderator@ronpay.com',
      phone: '9862000003',
      role: 'MODERATOR',
      designation: 'Creator Verification & KYC Officer',
      assignedAt: '2026-03-01T00:00:00.000Z',
      assignedBy: 'admin@ronpay.com',
      isActive: true,
      avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80',
      lastLogin: new Date(Date.now() - 3600000 * 2).toISOString(),
      createdAt: '2026-03-01T00:00:00.000Z'
    }
  ];
};

export const saveStoredStaffAccounts = (staffList: StaffAccount[]): void => {
  try {
    localStorage.setItem(STAFF_ACCOUNTS_KEY, JSON.stringify(staffList));
  } catch (e) {
    console.error('Failed to save staff accounts to storage', e);
  }
};

export const saveStaffAccount = (staff: StaffAccount): void => {
  const current = getStoredStaffAccounts();
  const index = current.findIndex(s => s.id === staff.id);
  let updated: StaffAccount[];
  if (index >= 0) {
    updated = [...current];
    updated[index] = staff;
  } else {
    updated = [staff, ...current];
  }
  saveStoredStaffAccounts(updated);
  safeApiFetch('/api/admin/staff', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-user-role': 'SUPER_ADMIN' },
    body: JSON.stringify(staff)
  });
};

export const deleteStaffAccount = (staffId: string): void => {
  const current = getStoredStaffAccounts();
  const updated = current.filter(s => s.id !== staffId);
  saveStoredStaffAccounts(updated);
};

export const deleteStoredTransaction = (transactionId: string): void => {
  if (!transactionId) return;
  const cleanId = String(transactionId).trim();
  markTransactionAsDeleted(cleanId);
  
  const current = getStoredTransactions();
  const updated = current.filter(t => String(t.id).toLowerCase().trim() !== cleanId.toLowerCase());
  
  // Update local storage and broadcast
  try {
    localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(updated));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ronpay_transactions_updated', { detail: updated }));
    }
  } catch (e) {}

  // Delete from Firestore
  deleteTransactionFromFirestore(cleanId).catch(() => {});

  // Delete from Server immediately
  safeApiFetch(`/api/transactions/${encodeURIComponent(cleanId)}`, { method: 'DELETE' });
  safeApiFetch('/api/data/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deletedTransactionIds: [cleanId] })
  });
};

export const deleteMultipleTransactions = (transactionIds: string[]): void => {
  if (!transactionIds || transactionIds.length === 0) return;
  const cleanIds = transactionIds.map(id => String(id).trim()).filter(Boolean);
  const idSet = new Set(cleanIds.map(id => id.toLowerCase()));

  for (const id of cleanIds) {
    markTransactionAsDeleted(id);
  }

  const current = getStoredTransactions();
  const updated = current.filter(t => !idSet.has(String(t.id).toLowerCase().trim()));

  try {
    localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(updated));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ronpay_transactions_updated', { detail: updated }));
    }
  } catch (e) {}

  for (const id of cleanIds) {
    deleteTransactionFromFirestore(id).catch(() => {});
  }

  safeApiFetch('/api/transactions/delete-batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids: cleanIds })
  });

  safeApiFetch('/api/data/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deletedTransactionIds: cleanIds })
  });
};

export const deleteMembersOfCampaign = (campaignId: string): void => {
  if (!campaignId) return;
  const allMembers = getMembers();
  const filtered = allMembers.filter(m => m.campaignId !== campaignId);
  saveMembers(filtered);
};

export const canApproveCashPayment = (
  tx: Transaction,
  campaigns?: Campaign[],
  creatorProfile?: CreatorProfile | null
): { allowed: boolean; reason?: string } => {
  if (!tx) return { allowed: false, reason: 'Transaction a awm lo.' };
  if (tx.paymentMethod !== 'cash') return { allowed: false, reason: 'Cash payment a ni lo.' };
  if (!creatorProfile) return { allowed: false, reason: 'Log in a ngai.' };
  if (creatorProfile.isAdmin || creatorProfile.role === 'SUPER_ADMIN' || creatorProfile.role === 'ADMIN') {
    return { allowed: true };
  }
  const allCampaigns = campaigns || getStoredCampaigns();
  const camp = allCampaigns.find(c => c.id === tx.campaignId);
  if (camp && isCampaignCreator(camp, creatorProfile)) {
    return { allowed: true };
  }
  return { allowed: false, reason: 'He bawm hi i siam a nih loh avangin cash approve theihna i nei lo.' };
};

export const approveCashTransaction = (
  transactionId: string,
  verifierName: string,
  creatorProfile?: CreatorProfile | null,
  campaigns?: Campaign[]
): Transaction | null => {
  const current = getStoredTransactions();
  const targetIndex = current.findIndex(t => t.id === transactionId);
  if (targetIndex === -1) return null;
  const target = current[targetIndex];
  const auth = canApproveCashPayment(target, campaigns, creatorProfile);
  if (!auth.allowed) return null;

  const updatedTx: Transaction = {
    ...target,
    status: 'completed',
    verifiedBy: verifierName || 'Bawm Creator',
    verifiedAt: new Date().toISOString(),
  };

  current[targetIndex] = updatedTx;
  saveStoredTransactions(current);
  recordAuditLog(
    'Cash Approved',
    `Txn ${transactionId} (₹${target.amount}) chu ${verifierName}-in a pawm fel ta.`,
    'transaction',
    transactionId
  );
  return updatedTx;
};

export const rejectCashTransaction = (
  transactionId: string,
  verifierName: string,
  reason?: string,
  creatorProfile?: CreatorProfile | null,
  campaigns?: Campaign[]
): Transaction | null => {
  const current = getStoredTransactions();
  const targetIndex = current.findIndex(t => t.id === transactionId);
  if (targetIndex === -1) return null;
  const target = current[targetIndex];
  const auth = canApproveCashPayment(target, campaigns, creatorProfile);
  if (!auth.allowed) return null;

  const updatedTx: Transaction = {
    ...target,
    status: 'rejected',
    rejectionReason: reason || 'Cash pawisa dawn fel a ni lo.',
    rejectedAt: new Date().toISOString(),
    verifiedBy: verifierName || 'Bawm Creator',
  };

  current[targetIndex] = updatedTx;
  saveStoredTransactions(current);
  recordAuditLog(
    'Cash Rejected',
    `Txn ${transactionId} (₹${target.amount}) chu ${verifierName}-in a hnawl. Chhan: ${reason || 'Cash a thleng lo'}`,
    'transaction',
    transactionId
  );
  return updatedTx;
};

const PG_CONFIG_KEY = 'ronpay_pg_config_v1';

export const DEFAULT_PG_CONFIG: PaymentGatewayConfig = {
  mode: 'direct_upi',
  provider: 'phonepe_pg',
  environment: 'sandbox',
  merchantId: 'PGTEST_RONPAY_001',
  keyId: 'M2306160483220674079460',
  keySecret: '099eb0cd-02cf-4e2a-8aca-3e6c6aff0399',
  webhookEndpoint: 'https://ronpay.app/api/webhooks/phonepe',
  saltKey: '099eb0cd-02cf-4e2a-8aca-3e6c6aff0399',
  saltIndex: 1,
  webhookSecret: 'whsec_ronpay_live_secret_key',
  isEnabled: true,
  isAutoSplitEnabled: true,
  ronpaySplitPercent: 1.0,
  minTransactionAmount: 1,
  maxTransactionAmount: 100000,
};

export const getStoredPGConfig = (): PaymentGatewayConfig => {
  try {
    const raw = localStorage.getItem(PG_CONFIG_KEY);
    if (raw) {
      return { ...DEFAULT_PG_CONFIG, ...JSON.parse(raw) };
    }
  } catch (e) {
    console.error('Failed to parse stored PG config', e);
  }
  return DEFAULT_PG_CONFIG;
};

export const saveStoredPGConfig = (config: PaymentGatewayConfig): void => {
  try {
    localStorage.setItem(PG_CONFIG_KEY, JSON.stringify(config));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ronpay_pg_config_updated', { detail: config }));
    }
  } catch (e) {
    console.error('Failed to save PG config', e);
  }
};




