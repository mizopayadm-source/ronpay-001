import { Campaign, Transaction, CreatorProfile, BawmCategory, SystemPricingConfig, AuditLog, AnnouncementBanner, AnnouncementItem, MemberRecord } from '../types';
import { INITIAL_CAMPAIGNS, INITIAL_TRANSACTIONS, DEFAULT_PRICING_CONFIG, INITIAL_REGISTERED_CREATORS } from '../data/initialData';

const CAMPAIGNS_KEY = 'ronpay_campaigns_v2';
const TRANSACTIONS_KEY = 'ronpay_transactions_v2';
const CREATOR_PROFILE_KEY = 'ronpay_creator_profile_v2';
const CREATORS_LIST_KEY = 'ronpay_creators_list_v2';
const MEMBERS_LIST_KEY = 'ronpay_kumtluang_members_v1';
const PRICING_CONFIG_KEY = 'ronpay_pricing_config_v1';
const CAMPAIGNS_LAST_SYNC_KEY = 'ronpay_campaigns_last_sync_v1';
const AUDIT_LOGS_KEY = 'ronpay_audit_logs_v1';
const ANNOUNCEMENT_KEY = 'ronpay_announcement_v1';

export const DEFAULT_ANNOUNCEMENT_ITEMS: AnnouncementItem[] = [
  {
    id: 'ann-1',
    isActive: true,
    type: 'urgent',
    title: 'Mizoram State-wide Community Notice',
    message: 'RonPay v2.5 live: Ralna, Khawlsak, Rikrum leh Kumtluang bawm zawng zawng QR Code verified-te chauh sum chhun nan hmang rawh le.',
    linkText: 'Bawm Explorer En Rawh',
    linkAction: 'explore_bawm',
    badge: 'URGENT'
  },
  {
    id: 'ann-2',
    isActive: true,
    type: 'info',
    title: 'Instant UPI & BBPS Live Integration',
    message: 'PhonePe, Paytm, Google Pay leh BBPS hmangin Electric, FASTag, Water Bill leh Fees te awlsam takin pek fel nghal zung zung theih a ni e.',
    linkText: 'Bill Payments En Rawh',
    linkAction: 'open_bill_service',
    badge: 'BBPS LIVE'
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
    badge: 'EVENT'
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
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Ensure every campaign has an orgCode populated
        let hasChanges = false;
        const normalized = parsed.map((camp: Campaign) => {
          if (!camp.orgCode) {
            const initialMatch = INITIAL_CAMPAIGNS.find(ic => ic.id === camp.id);
            const derived = initialMatch?.orgCode || derivePrefixFromText(camp.orgName || camp.title);
            hasChanges = true;
            return { ...camp, orgCode: derived };
          }
          return camp;
        });
        if (hasChanges) {
          localStorage.setItem(CAMPAIGNS_KEY, JSON.stringify(normalized));
        }
        return normalized;
      }
    }
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

    localStorage.setItem(CAMPAIGNS_KEY, JSON.stringify(sanitized));
    setLastSyncTime(new Date().toISOString());
  } catch (e) {
    console.error('Failed to save campaigns', e);
  }
};

export const getStoredTransactions = (): Transaction[] => {
  try {
    const raw = localStorage.getItem(TRANSACTIONS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        // Filter out legacy sample entries for Liana & Kunga
        const filtered = parsed.filter(t => t.donorName !== 'Liana' && t.donorName !== 'Kunga');
        if (filtered.length !== parsed.length) {
          saveStoredTransactions(filtered);
        }
        return filtered;
      }
    }
  } catch (e) {
    console.error('Failed to parse stored transactions', e);
  }
  return INITIAL_TRANSACTIONS;
};

export const saveStoredTransactions = (transactions: Transaction[]) => {
  try {
    localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(transactions));
  } catch (e) {
    console.error('Failed to save transactions', e);
  }
};

export const getStoredCreatorProfile = (): CreatorProfile => {
  try {
    const raw = localStorage.getItem(CREATOR_PROFILE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.orgName === 'RonPay HQ / Master Console') {
        parsed.orgName = 'BCM Ebenezer';
        saveStoredCreatorProfile(parsed);
      }
      if (parsed.name && parsed.phone) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to parse creator profile', e);
  }
  const defaultProfile: CreatorProfile = {
    name: 'Rev. Dr. R. Zothansanga',
    orgName: 'BCM Ebenezer, Zobawk Local Church',
    designation: 'Pastor / Secretary',
    phone: '9862599881',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
    isPhoneVerified: true,
    isApproved: true,
    approvedCategories: ['kumtluang', 'ralna'],
    createdQRsCount: 5,
  };
  saveStoredCreatorProfile(defaultProfile);
  return defaultProfile;
};

export const saveStoredCreatorProfile = (profile: CreatorProfile) => {
  try {
    localStorage.setItem(CREATOR_PROFILE_KEY, JSON.stringify(profile));
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
        return parsed;
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

const USER_PAID_TX_IDS_KEY = 'ronpay_user_paid_tx_ids_v2';

export const getStoredUserPaidTxIds = (): string[] => {
  try {
    const raw = localStorage.getItem(USER_PAID_TX_IDS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to parse user paid tx ids', e);
  }
  // Initialize with initial user demo donations so the user has an initial receipt on first load
  const initialIds = ['TXN-9011', 'TXN-9015'];
  saveStoredUserPaidTxIds(initialIds);
  return initialIds;
};

export const saveStoredUserPaidTxIds = (ids: string[]) => {
  try {
    localStorage.setItem(USER_PAID_TX_IDS_KEY, JSON.stringify(ids));
  } catch (e) {
    console.error('Failed to save user paid tx ids', e);
  }
};

export const recordUserPaidTxId = (id: string) => {
  try {
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
 * Checks if a transaction was paid by the current user/device.
 * Sulhnu Record must only show transactions made by the active user.
 */
export const isUserPaidTransaction = (
  tx: Transaction,
  userPaidIds: string[],
  creatorProfile?: CreatorProfile | null
): boolean => {
  if (userPaidIds.includes(tx.id)) return true;
  if (tx.id.startsWith('BILL-') || tx.id.startsWith('RPAY-')) return true;
  if (creatorProfile?.name && tx.donorName && tx.donorName.trim().toLowerCase() === creatorProfile.name.trim().toLowerCase()) {
    return true;
  }
  return false;
};

/**
 * Checks if the currently active user/creator is the verified owner/creator of a given campaign.
 * Target goals, progress, edit/delete privileges & member roll managers are strictly private
 * and exclusively accessible to the individual creator who created the campaign (or Admin).
 */
export const isCampaignCreator = (camp: Campaign, creatorProfile?: CreatorProfile | null): boolean => {
  if (!creatorProfile || !creatorProfile.isApproved) return false;
  if (creatorProfile.isAdmin) return true;
  if (!camp) return false;

  const creatorPhone = (creatorProfile.phone || '').trim().replace(/\D/g, '');
  const creatorName = (creatorProfile.name || '').trim().toLowerCase();
  const campCreatedBy = (camp.createdBy || '').trim();
  const campCreatedByDigits = campCreatedBy.replace(/\D/g, '');
  const campCreatedByLower = campCreatedBy.toLowerCase();

  // 1. Strict Phone Match (Exact or 10-digit match)
  if (creatorPhone && creatorPhone.length >= 6) {
    if (campCreatedByDigits === creatorPhone || campCreatedBy.includes(creatorProfile.phone?.trim() || '')) {
      return true;
    }
  }

  // 2. Strict Full Name Match
  if (creatorName && creatorName.length >= 3) {
    if (campCreatedByLower === creatorName) {
      return true;
    }
  }

  // 3. Strict Organization Match (for organization accounts)
  const creatorOrg = (creatorProfile.orgName || '').trim().toLowerCase();
  const campOrg = (camp.orgName || '').trim().toLowerCase();
  if (creatorOrg && campOrg && creatorOrg.length >= 5 && (creatorOrg === campOrg || campCreatedByLower === creatorOrg)) {
    return true;
  }

  return false;
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
    createdAt: new Date().toISOString()
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
    createdAt: new Date().toISOString()
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
    dependents: [],
    createdAt: new Date().toISOString()
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
    createdAt: new Date().toISOString()
  },
  {
    id: 'KTL-7234',
    campaignId: 'cmp-kumtluang-2',
    name: 'C. Lalmuanpuia',
    orgCode: 'KTL',
    phoneLast4: '7234',
    fullPhone: '9436127234',
    section: 'Bial II (Khatla North)',
    isFamilyHead: true,
    dependents: [
      { subId: 'KTL-7234-01', name: 'Zomuanpuii (Nupui)', relation: 'Nupui' }
    ],
    createdAt: new Date().toISOString()
  }
];

export const getMembers = (campaignId?: string): MemberRecord[] => {
  try {
    let allMembers: MemberRecord[] = [];
    const raw = localStorage.getItem(MEMBERS_LIST_KEY);
    if (!raw) {
      localStorage.setItem(MEMBERS_LIST_KEY, JSON.stringify(INITIAL_DEFAULT_MEMBERS));
      allMembers = INITIAL_DEFAULT_MEMBERS;
    } else {
      allMembers = JSON.parse(raw);
    }

    if (!campaignId || campaignId === 'all') {
      return allMembers;
    }

    // Filter strictly by campaignId or fallback to campaign orgCode
    const campaigns = getStoredCampaigns();
    const targetCampaign = campaigns.find(c => c.id === campaignId);

    return allMembers.filter(m => {
      if (m.campaignId) {
        return m.campaignId === campaignId;
      }
      // Backward compatibility: check orgCode matching
      if (targetCampaign && m.orgCode && targetCampaign.orgCode && m.orgCode.toUpperCase() === targetCampaign.orgCode.toUpperCase()) {
        return true;
      }
      if (m.orgCode === 'EBE' && campaignId === 'cmp-kumtluang-1') {
        return true;
      }
      if (m.orgCode === 'KTL' && campaignId === 'cmp-kumtluang-2') {
        return true;
      }
      return false;
    });
  } catch (e) {
    return campaignId && campaignId !== 'all' && campaignId !== 'cmp-kumtluang-1' ? [] : INITIAL_DEFAULT_MEMBERS;
  }
};

export const saveMembers = (members: MemberRecord[]): void => {
  try {
    localStorage.setItem(MEMBERS_LIST_KEY, JSON.stringify(members));
  } catch (e) {
    console.error('Failed to save members to localStorage', e);
  }
};

export const addOrUpdateMember = (member: MemberRecord): void => {
  const allList = getMembers(); // Load all members across all Bawms
  const idx = allList.findIndex(m => 
    m.id === member.id && 
    (!member.campaignId || !m.campaignId || m.campaignId === member.campaignId)
  );
  if (idx >= 0) {
    allList[idx] = member;
  } else {
    allList.unshift(member);
  }
  saveMembers(allList);
};

export const deleteMember = (memberId: string, campaignId?: string): void => {
  const allList = getMembers();
  const filtered = allList.filter(m => {
    if (m.id !== memberId) return true;
    if (campaignId && m.campaignId && m.campaignId !== campaignId) return true;
    return false;
  });
  saveMembers(filtered);
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
  const current = getStoredTransactions();
  const updated = [tx, ...current];
  saveStoredTransactions(updated);
};

