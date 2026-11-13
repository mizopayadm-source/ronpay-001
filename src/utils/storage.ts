import { Campaign, Transaction, CreatorProfile, BawmCategory, SystemPricingConfig, SectionQuickPreset, AuditLog, AnnouncementBanner, AnnouncementItem, MemberRecord, RonPayWallet, WalletTransaction, StaffAccount, PaymentGatewayConfig, KumtluangExpense, AuditorAccessGrant, ModificationRequest } from '../types';
import { INITIAL_CAMPAIGNS, INITIAL_TRANSACTIONS, INITIAL_EXPENSES, DEFAULT_PRICING_CONFIG, INITIAL_REGISTERED_CREATORS, BMP_SHILLONG_DEFAULT_LOGO, YMA_DEFAULT_LOGO, BCM_EBENEZER_DEFAULT_LOGO } from '../data/initialData';
import { compressDataUrl } from './imageCompressor';
import {
  syncCreatorToFirestore,
  syncPricingConfigToFirestore,
  syncAnnouncementToFirestore,
  syncCampaignToFirestore,
  syncAuditLogToFirestore,
  syncMemberToFirestore,
  deleteMemberFromFirestore,
  syncTransactionToFirestore,
  syncAllLocalExpensesToFirestore,
  syncExpenseToFirestore,
  deleteExpenseFromFirestore,
} from '../services/firestoreSync';
import { broadcastStateChange, StateSyncTopic } from '../services/crossTabSync';
import { updateSupabaseMember, deleteSupabaseMember } from '../services/supabaseService';

const CAMPAIGNS_KEY = 'ronpay_campaigns_v3';
const TRANSACTIONS_KEY = 'ronpay_transactions_v4';
const CREATOR_PROFILE_KEY = 'ronpay_creator_profile_v2';
const CREATORS_LIST_KEY = 'ronpay_creators_list_v2';
const MEMBERS_LIST_KEY = 'ronpay_kumtluang_members_v1';
const PRICING_CONFIG_KEY = 'ronpay_pricing_config_v1';
const CAMPAIGNS_LAST_SYNC_KEY = 'ronpay_campaigns_last_sync_v1';
const AUDIT_LOGS_KEY = 'ronpay_audit_logs_v1';
const ANNOUNCEMENT_KEY = 'ronpay_announcement_v1';
const DELETED_CAMPAIGN_IDS_KEY = 'ronpay_deleted_campaign_ids_v1';

export const PERMANENTLY_PURGED_CAMPAIGN_IDS = new Set([
  'cmp-kumtluang-ymavt',
  'cmp-1787545326556',
  'cmp-chk-mu6on2s6',
  'cmp-chk-mu6ojr7t',
  'cmp-chhungkaw-2',
  'cmp-chhungkaw-1',
  'cmp-1790613933759',
  'cmp-1790611183923',
  'cmp-1790611018907',
  'cmp-1790610970360',
  'cmp-1794157985311'
]);

export const PROTECTED_NON_KUMTLUANG_CAMPAIGN_IDS = new Set([
  'cmp-1787917594696',
  'cmp-1788526889943',
  'cmp-1788262396368',
  'cmp-1792691263771',
  'cmp-1789722801941',
  'cmp-1789722668042',
  'cmp-1789722498375',
  'cmp-1789722358527',
  'cmp-custom',
  'cmp-khawlsak-3',
  'cmp-ralna-2',
  'cmp-ralna-1',
  'cmp-rikrum-1',
  'cmp-1787569484926',
  'cmp-khawlsak-2',
  'cmp-khawlsak-1'
]);

export const getDeletedCampaignIds = (): Set<string> => {
  const result = new Set<string>();
  for (const id of PERMANENTLY_PURGED_CAMPAIGN_IDS) {
    const clean = id ? id.toLowerCase().trim() : '';
    if (clean && !PROTECTED_NON_KUMTLUANG_CAMPAIGN_IDS.has(clean)) {
      result.add(clean);
    }
  }
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(DELETED_CAMPAIGN_IDS_KEY) : null;
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        let cleaned = false;
        arr.forEach(id => {
          const clean = String(id).toLowerCase().trim();
          if (PROTECTED_NON_KUMTLUANG_CAMPAIGN_IDS.has(clean)) {
            cleaned = true;
          } else if (clean) {
            result.add(clean);
          }
        });
        if (cleaned && typeof localStorage !== 'undefined') {
          const filtered = arr.filter(id => !PROTECTED_NON_KUMTLUANG_CAMPAIGN_IDS.has(String(id).toLowerCase().trim()));
          localStorage.setItem(DELETED_CAMPAIGN_IDS_KEY, JSON.stringify(filtered));
        }
      }
    }
  } catch (e) {}
  return result;
};

export const recordDeletedCampaignId = (campaignId: string): void => {
  if (!campaignId) return;
  try {
    const clean = String(campaignId).toLowerCase().trim();
    if (PROTECTED_NON_KUMTLUANG_CAMPAIGN_IDS.has(clean)) return;
    const set = getDeletedCampaignIds();
    if (set.has(clean)) return;
    set.add(clean);
    const arr = Array.from(set).slice(-500);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(DELETED_CAMPAIGN_IDS_KEY, JSON.stringify(arr));
    }
  } catch (e) {}
};

export const clearDeletedCampaignId = (campaignId: string): void => {
  if (!campaignId) return;
  try {
    const set = getDeletedCampaignIds();
    set.delete(String(campaignId).toLowerCase().trim());
    const arr = Array.from(set);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(DELETED_CAMPAIGN_IDS_KEY, JSON.stringify(arr));
    }
  } catch (e) {}
};

// -----------------------------------------------------------------
// TOMBSTONES: Members & Staff Deletion Protection Across Windows/Apps
// -----------------------------------------------------------------
const DELETED_MEMBER_IDS_KEY = 'ronpay_deleted_member_ids_v1';

export const getDeletedMemberIds = (): Set<string> => {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(DELETED_MEMBER_IDS_KEY) : null;
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        // Active BCM Ebenezer member suffixes should never be blocked by stale tombstones
        const activeEbeIds = new Set([
          'ebezbk-4998', 'ebezbk-8670', 'ebezbk-2862', 'ebezbk-0000', 'ebezbk-7788',
          'ebezbk-5566', 'ebezbk-8622', 'ebezbk-2233', 'ebezbk-4646', 'ebezbk-5544',
          'ebezbk-1122', 'ebezbk-0001', 'ebezbk-6677', 'ebezbk-9912', 'ebezbk-1460',
          'ebezbk-3120', 'ebezbk-4455', 'ebezbk-5634', 'ebezbk-9988',
          'zbkebe-4998', 'zbkebe-8670', 'zbkebe-2862', 'zbkebe-0000', 'zbkebe-7788',
          'zbkebe-5566', 'zbkebe-8622', 'zbkebe-2233', 'zbkebe-4646', 'zbkebe-5544',
          'zbkebe-1122', 'zbkebe-0001', 'zbkebe-6677', 'zbkebe-9912', 'zbkebe-1460',
          'zbkebe-3120', 'zbkebe-4455', 'zbkebe-5634', 'zbkebe-9988'
        ]);
        return new Set(arr.map(id => String(id).toLowerCase().trim()).filter(id => !activeEbeIds.has(id)));
      }
    }
  } catch (e) {}
  return new Set<string>();
};

export const markMemberAsDeleted = (memberId: string): void => {
  if (!memberId) return;
  try {
    const clean = String(memberId).toLowerCase().trim();
    const altClean = clean.startsWith('ebe-') ? 'bcm-' + clean.substring(4) : (clean.startsWith('bcm-') ? 'ebe-' + clean.substring(4) : clean);
    const set = getDeletedMemberIds();
    set.add(clean);
    set.add(altClean);
    const arr = Array.from(set).slice(-1000);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(DELETED_MEMBER_IDS_KEY, JSON.stringify(arr));
      try {
        const rawMems = localStorage.getItem(MEMBERS_LIST_KEY);
        if (rawMems) {
          const parsed = JSON.parse(rawMems);
          if (Array.isArray(parsed)) {
            const filtered = parsed.filter(m => {
              if (!m || !m.id) return false;
              const mClean = String(m.id).toLowerCase().trim();
              return mClean !== clean && mClean !== altClean;
            });
            if (filtered.length !== parsed.length) {
              localStorage.setItem(MEMBERS_LIST_KEY, JSON.stringify(filtered));
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('ronpay-members-updated', { detail: filtered }));
                window.dispatchEvent(new CustomEvent('ronpay_members_updated', { detail: filtered }));
              }
            }
          }
        }
      } catch {}
    }
  } catch (e) {}
};



export const clearDeletedMemberId = (memberId: string): void => {
  if (!memberId) return;
  try {
    const set = getDeletedMemberIds();
    set.delete(String(memberId).toLowerCase().trim());
    const arr = Array.from(set);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(DELETED_MEMBER_IDS_KEY, JSON.stringify(arr));
    }
  } catch (e) {}
};

const DELETED_STAFF_IDS_KEY = 'ronpay_deleted_staff_ids_v1';

export const getDeletedStaffIds = (): Set<string> => {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(DELETED_STAFF_IDS_KEY) : null;
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return new Set(arr.map(id => String(id).trim()));
    }
  } catch (e) {}
  return new Set<string>();
};

export const markStaffAsDeleted = (staffId: string): void => {
  if (!staffId) return;
  try {
    const set = getDeletedStaffIds();
    set.add(String(staffId).trim());
    const arr = Array.from(set).slice(-500);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(DELETED_STAFF_IDS_KEY, JSON.stringify(arr));
    }
  } catch (e) {}
};

// -----------------------------------------------------------------
// ADMIN AUTHENTICATION SYNC ACROSS WINDOWS, TABS & SESSIONS
// -----------------------------------------------------------------
export const ADMIN_AUTH_LOCAL_KEY = 'ronpay_admin_auth_v2';
export const ADMIN_PASSWORD_VERIFIED_KEY = 'ronpay_admin_password_verified';

export const isStoredAdminAuthorized = (): boolean => {
  try {
    if (typeof window !== 'undefined') {
      const rawProfile = localStorage.getItem(CREATOR_PROFILE_KEY);
      if (rawProfile) {
        const parsed = JSON.parse(rawProfile);
        if (parsed && !parsed.isAdmin && parsed.role !== 'SUPER_ADMIN' && parsed.role !== 'ADMIN') {
          return false;
        }
      }
      const localAuth = localStorage.getItem(ADMIN_AUTH_LOCAL_KEY) === 'true';
      const localPwd = localStorage.getItem(ADMIN_PASSWORD_VERIFIED_KEY) === 'true';
      const sessionAuth = sessionStorage.getItem('ronpay_admin_auth') === 'true';
      const sessionPwd = sessionStorage.getItem(ADMIN_PASSWORD_VERIFIED_KEY) === 'true';
      return (localAuth && localPwd) || (sessionAuth && sessionPwd) || localAuth || sessionAuth;
    }
  } catch (e) {}
  return false;
};

/**
 * Robust Super Admin / Admin check that works seamlessly across Phone App,
 * Android WebViews, PWAs, and Desktop Web browsers without relying on fragile sessionStorage.
 */
export const isSuperAdminOrAdminProfile = (creatorProfile?: CreatorProfile | null): boolean => {
  // 1. Direct profile checks
  if (creatorProfile) {
    if (creatorProfile.isAdmin === true || creatorProfile.role === 'SUPER_ADMIN' || creatorProfile.role === 'ADMIN') {
      return true;
    }
    if (creatorProfile.isAdmin === false && creatorProfile.role !== 'SUPER_ADMIN' && creatorProfile.role !== 'ADMIN') {
      return false;
    }
  }

  // 2. Active authorized admin session check
  if (typeof window !== 'undefined') {
    const isAuth = isStoredAdminAuthorized();
    const role = localStorage.getItem('ronpay_admin_role') || sessionStorage.getItem('ronpay_admin_role');
    if (isAuth && (role === 'SUPER_ADMIN' || role === 'ADMIN')) return true;
  }
  return false;
};

export const saveAdminAuthState = (role: string = 'SUPER_ADMIN', profile?: CreatorProfile | null): void => {
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(ADMIN_AUTH_LOCAL_KEY, 'true');
      localStorage.setItem(ADMIN_PASSWORD_VERIFIED_KEY, 'true');
      localStorage.setItem('ronpay_admin_role', role);
      sessionStorage.setItem('ronpay_admin_auth', 'true');
      sessionStorage.setItem(ADMIN_PASSWORD_VERIFIED_KEY, 'true');
      sessionStorage.setItem('ronpay_admin_role', role);
      const isSuperOrAdmin = role === 'SUPER_ADMIN' || role === 'ADMIN';
      const fallbackName = role === 'SUPER_ADMIN' ? 'Super Admin (Master)' : role === 'ADMIN' ? 'Admin' : 'Moderator';
      const fallbackPhone = role === 'SUPER_ADMIN' ? '9862000001' : '9862000002';
      const current = profile || getStoredCreatorProfile();
      const updatedProfile: CreatorProfile = {
        ...current,
        isAdmin: isSuperOrAdmin,
        role: role as any,
        name: current?.name && !current.name.toLowerCase().includes('guest') && !current.name.toLowerCase().includes('khualmi') ? current.name : fallbackName,
        phone: current?.phone && current.phone !== '9999999999' ? current.phone : fallbackPhone,
      };
      saveStoredCreatorProfile(updatedProfile);
      broadcastTabSync('admin_login', { role, profile: updatedProfile });
    }
  } catch (e) {}
};

export const clearAdminAuthState = (): void => {
  try {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(ADMIN_AUTH_LOCAL_KEY);
      localStorage.removeItem(ADMIN_PASSWORD_VERIFIED_KEY);
      localStorage.removeItem('ronpay_admin_role');
      sessionStorage.removeItem('ronpay_admin_auth');
      sessionStorage.removeItem(ADMIN_PASSWORD_VERIFIED_KEY);
      sessionStorage.removeItem('ronpay_admin_role');
      broadcastTabSync('admin_logout');
    }
  } catch (e) {}
};

export const broadcastTabSync = (type: string, data?: any) => {
  try {
    let topic: StateSyncTopic = 'all';
    const lowerType = (type || '').toLowerCase();
    if (lowerType.includes('campaign')) topic = 'campaigns';
    else if (lowerType.includes('transaction')) topic = 'transactions';
    else if (lowerType.includes('member')) topic = 'members';
    else if (lowerType.includes('creator') && !lowerType.includes('list')) topic = 'creator_profile';
    else if (lowerType.includes('creator') || lowerType.includes('staff')) topic = 'creators';
    else if (lowerType.includes('admin') || lowerType.includes('auth')) topic = 'auth';
    else if (lowerType.includes('pricing')) topic = 'pricing_config';
    else if (lowerType.includes('announcement')) topic = 'announcement';
    else if (lowerType.includes('audit')) topic = 'audit_logs';
    else if (lowerType.includes('wallet')) topic = 'wallet';
    else if (lowerType.includes('user_paid')) topic = 'user_paid';

    broadcastStateChange(topic, data);
  } catch (e) {}
};

import { resolveApiUrl } from './apiConfig';

/**
 * Resilient, offline-aware fetch wrapper that prevents connection reset crashes when offline or reconnecting.
 * Automatically injects verified user identity & role headers for query-level database enforcement.
 */
export const safeApiFetch = async (url: string, options?: RequestInit): Promise<Response | null> => {
  if (url.includes('/api/data/sync')) {
    // /api/data/sync endpoint has been completely removed in favor of Supabase SSOT
    return null;
  }
  if (typeof window !== 'undefined' && typeof navigator !== 'undefined' && !navigator.onLine) {
    return null;
  }
  try {
    const targetUrl = resolveApiUrl(url);
    const headers = new Headers(options?.headers || {});
    
    // Auto-inject role-based identity headers for secure API query enforcement
    if (typeof localStorage !== 'undefined') {
      try {
        const rawProfile = localStorage.getItem(CREATOR_PROFILE_KEY);
        if (rawProfile) {
          const profile = JSON.parse(rawProfile);
          if (profile) {
            if (!headers.has('x-user-role')) headers.set('x-user-role', profile.role || 'GUEST');
            if (profile.phone && !headers.has('x-user-phone')) headers.set('x-user-phone', profile.phone);
            if (profile.name && !headers.has('x-user-name')) headers.set('x-user-name', profile.name);
            if (profile.id && !headers.has('x-user-id')) headers.set('x-user-id', profile.id);
            if ((profile.isAdmin || profile.role === 'SUPER_ADMIN' || profile.role === 'ADMIN') && !headers.has('x-is-admin')) {
              headers.set('x-is-admin', 'true');
            }
          }
        }
        const userPaid = getStoredUserPaidTxIds();
        if (userPaid && userPaid.length > 0 && !headers.has('x-user-paid-ids')) {
          headers.set('x-user-paid-ids', JSON.stringify(userPaid.slice(-100)));
        }
      } catch {}
    }

    const res = await fetch(targetUrl, {
      ...options,
      headers
    });
    return res;
  } catch {
    return null;
  }
};

export const DEFAULT_ANNOUNCEMENT_ITEMS: AnnouncementItem[] = [
  {
    id: 'ann-4',
    isActive: true,
    type: 'event',
    title: 'Synod & Kohhran Khawmpui Pual',
    message: 'Kohhran Inkhawmpui, Fellowship leh Khawtlang thiltih hrang hrang pualin Kumtluang & Khawlsak Bawm siam a remchang e.',
    linkText: 'Kumtluang Bawm En Rawh',
    linkAction: 'kumtluang_bawm',
    badge: 'EVENT',
    bannerMediaUrl: 'https://images.unsplash.com/photo-1519817650390-64a93db51149?q=80&w=800&auto=format&fit=crop',
    mediaType: 'image',
    mediaLayout: 'side_thumb'
  },
  {
    id: 'ann-1',
    isActive: true,
    type: 'notice',
    title: 'Mizoram State-wide Community Notice',
    message: 'RonPay v2.5 live: Ralna, Khawlsak, Rikrum leh Kumtluang bawm verified QR-te chauh sum chhun nan hmang rawh le.',
    linkText: 'Bawm Explorer En Rawh',
    linkAction: 'explore_bawm',
    badge: 'COMMUNITY',
    bannerMediaUrl: 'https://images.unsplash.com/photo-1577495508048-b635879837f1?q=80&w=800&auto=format&fit=crop',
    mediaType: 'image',
    mediaLayout: 'side_thumb'
  },
  {
    id: 'ann-2',
    isActive: true,
    type: 'info',
    title: 'Instant UPI & BBPS Live Integration',
    message: 'PhonePe, Paytm, Google Pay leh BBPS hmangin Electric, FASTag, Water Bill leh Fees te awlsam takin pek theih a ni e.',
    linkText: 'Bill Payments En Rawh',
    linkAction: 'open_bill_service',
    badge: 'BBPS LIVE',
    bannerMediaUrl: 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?q=80&w=800&auto=format&fit=crop',
    mediaType: 'image',
    mediaLayout: 'side_thumb'
  },
  {
    id: 'ann-3',
    isActive: true,
    type: 'notice',
    title: 'YMA & Creator Verification Studio',
    message: 'Branch YMA, NGO leh Kohhran tan Creator Studio-ah registration tiin Free QR Code siam rawh le.',
    linkText: 'Creator Studio-ah Lut Rawh',
    linkAction: 'create_qr',
    badge: 'CREATOR HUB',
    bannerMediaUrl: 'https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?q=80&w=800&auto=format&fit=crop',
    mediaType: 'image',
    mediaLayout: 'side_thumb'
  }
];

export const DEFAULT_ANNOUNCEMENT: AnnouncementBanner = {
  id: 'ann-main-config',
  isActive: false, // Default to false so it stays hidden unless explicitly enabled
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
    const deletedCampIds = getDeletedCampaignIds();
    const raw = localStorage.getItem(CAMPAIGNS_KEY);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const mapped = parsed
          .filter((camp: Campaign) => {
            if (!camp || !camp.id) return false;
            const cleanId = String(camp.id).toLowerCase().trim();
            if (PERMANENTLY_PURGED_CAMPAIGN_IDS.has(cleanId) || deletedCampIds.has(cleanId)) {
              return false;
            }
            const titleLower = String(camp.title || '').toLowerCase();
            const orgLower = String(camp.orgName || '').toLowerCase();
            if (
              (titleLower.includes('tkp') && titleLower.includes('shillong')) ||
              (orgLower.includes('tkp') && orgLower.includes('shillong'))
            ) {
              return false;
            }
            return true;
          })
          .map((camp: Campaign) => {
            const updated = { ...camp };
            if (!updated.orgCode) {
              const initialMatch = INITIAL_CAMPAIGNS.find(ic => ic.id === updated.id);
              const derived = initialMatch?.orgCode || derivePrefixFromText(updated.orgName || updated.title);
              updated.orgCode = derived;
            }
            if (updated.id === 'cmp-1788107291420' || String(updated.title).toLowerCase().includes('bmp')) {
              updated.category = 'kumtluang';
              if (updated.title) {
                updated.title = updated.title.replace(/,+$/, '').trim();
              }
              if (!updated.subCategories || updated.subCategories.length === 0) {
                updated.subCategories = ['BMP Fund'];
              }
              if (!updated.imageUrl) {
                updated.imageUrl = BMP_SHILLONG_DEFAULT_LOGO;
              }
            }
            if (updated.id === 'cmp-kumtluang-1' || String(updated.title).toLowerCase().includes('bcm ebenezer')) {
              updated.category = 'kumtluang';
              if (!updated.orgCode) {
                updated.orgCode = 'ZBKEBE';
              }
              // If missing, or set to broken 404 unsplash URL, heal with authoritative church photo
              if (!updated.imageUrl || updated.imageUrl.includes('unsplash.com') || updated.imageUrl.includes('photo-1548625361-195feee10fce')) {
                updated.imageUrl = BCM_EBENEZER_DEFAULT_LOGO;
              }
            }
            if (updated.id === 'cmp-1787829303143' || String(updated.title).toLowerCase().includes('yma vengthar')) {
              updated.category = 'kumtluang';
              if (!updated.orgCode) updated.orgCode = 'YMAVT';
              // If previously contaminated with synthetic svg data URI or broken unsplash URL, restore to clean default
              if (!updated.imageUrl || updated.imageUrl.startsWith('data:image/svg+xml') || updated.imageUrl.includes('photo-1548625361-195feee10fce')) {
                updated.imageUrl = YMA_DEFAULT_LOGO;
              }
            }
            return updated;
          });

        // Smart merge: ensure all canonical initial campaigns exist, but NEVER overwrite live user-configured campaign fields (definedSections, orgCode, subCategories, generalPresets, etc.)
        const existingIds = new Set(mapped.map(c => String(c.id).toLowerCase().trim()));
        let hasNew = false;
        const merged = mapped.map(camp => {
          const initMatch = INITIAL_CAMPAIGNS.find(ic => String(ic.id).toLowerCase().trim() === String(camp.id).toLowerCase().trim());
          if (initMatch) {
            let changed = false;
            const updated = { ...camp };
            if (!updated.officerPasscode && initMatch.officerPasscode) {
              updated.officerPasscode = initMatch.officerPasscode;
              changed = true;
            }
            if (updated.allowPublicGroupDeposits === undefined && initMatch.allowPublicGroupDeposits !== undefined) {
              updated.allowPublicGroupDeposits = initMatch.allowPublicGroupDeposits;
              changed = true;
            }
            if ((!updated.definedSections || updated.definedSections.length === 0) && initMatch.definedSections && initMatch.definedSections.length > 0) {
              updated.definedSections = initMatch.definedSections;
              changed = true;
            }
            if (changed) {
              hasNew = true;
              return updated;
            }
          }
          return camp;
        });

        for (const initCamp of INITIAL_CAMPAIGNS) {
          const initCleanId = String(initCamp.id).toLowerCase().trim();
          if (deletedCampIds.has(initCleanId)) continue;
          if (!existingIds.has(initCleanId)) {
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
  // Canonical exception: cmp-kumtluang-1 is the official owner of prefix EBE
  if (clean === 'EBE' && excludeCampaignId === 'cmp-kumtluang-1') return false;
  const campaigns = getStoredCampaigns();
  return campaigns.some(c => {
    if (c.id === excludeCampaignId) return false;
    if (c.category && c.category !== 'kumtluang') return false;
    return (c.orgCode || '').trim().toUpperCase() === clean;
  });
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

export const saveStoredCampaigns = (campaigns: Campaign[], skipServerPush: boolean = false) => {
  try {
    const deletedCampIds = getDeletedCampaignIds();
    const mergedList = [...campaigns];
    const seenIds = new Set(mergedList.map(c => String(c?.id || '').toLowerCase().trim()));
    for (const initCamp of INITIAL_CAMPAIGNS) {
      const initCleanId = String(initCamp.id).toLowerCase().trim();
      if (!seenIds.has(initCleanId) && (!deletedCampIds.has(initCleanId) || PROTECTED_NON_KUMTLUANG_CAMPAIGN_IDS.has(initCleanId))) {
        mergedList.push(initCamp);
        seenIds.add(initCleanId);
      }
    }

    // Preserve campaign configuration and strip any deleted auditor grants from both c.auditorGrants and c.metadata.auditorGrants
    const delGrantSet = new Set(getStoredDeletedAuditorGrantIds());
    const sanitized = mergedList.map(c => {
      const code = c.orgCode ? String(c.orgCode).trim().toUpperCase() : derivePrefixFromText(c.orgName || c.title).trim().toUpperCase();
      const rawGrants = Array.isArray(c.auditorGrants)
        ? c.auditorGrants
        : (Array.isArray((c as any).metadata?.auditorGrants) ? (c as any).metadata.auditorGrants : undefined);
      const cleanGrants = Array.isArray(rawGrants)
        ? rawGrants.filter((g: any) => g && g.id && !delGrantSet.has(String(g.id).toLowerCase().trim()))
        : undefined;
      return {
        ...c,
        orgCode: code,
        ...(cleanGrants !== undefined ? { auditorGrants: cleanGrants } : {}),
        ...(c.metadata || cleanGrants !== undefined
          ? {
              metadata: {
                ...(c.metadata || {}),
                ...(cleanGrants !== undefined ? { auditorGrants: cleanGrants } : {}),
                ...(delGrantSet.size > 0 ? { deletedAuditorGrantIds: Array.from(delGrantSet) } : {})
              }
            }
          : {})
      };
    });

    // Auto-detect and cascade Pawl Code migration if any campaign orgCode has changed
    try {
      const rawPrev = typeof localStorage !== 'undefined' ? localStorage.getItem(CAMPAIGNS_KEY) : null;
      if (rawPrev) {
        const prevList = JSON.parse(rawPrev);
        if (Array.isArray(prevList)) {
          const prevMap = new Map<string, string>();
          prevList.forEach((c: any) => {
            if (c && c.id && c.orgCode) prevMap.set(String(c.id).toLowerCase().trim(), String(c.orgCode).trim().toUpperCase());
          });
          sanitized.forEach(c => {
            if (c && c.id && c.orgCode) {
              const oldC = prevMap.get(String(c.id).toLowerCase().trim());
              const newC = String(c.orgCode).trim().toUpperCase();
              if (oldC && oldC !== newC) {
                migrateCampaignMembersPrefix(c.id, oldC, newC);
              }
            }
          });
        }
      }
    } catch (migErr) {
      console.warn('saveStoredCampaigns auto-migration check:', migErr);
    }

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

    if (!skipServerPush) {
      // Asynchronously push to backend server for multi-device sync
      safeApiFetch('/api/data/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaigns: sortedSanitized })
      });
    }
  } catch (e) {
    console.error('Failed to save campaigns', e);
  }
};

export const saveCampaign = (camp: Campaign): void => {
  if (!camp || !camp.id) return;
  const delGrantSet = new Set(getStoredDeletedAuditorGrantIds());
  const rawCampGrants = Array.isArray(camp.auditorGrants)
    ? camp.auditorGrants
    : (Array.isArray((camp as any).metadata?.auditorGrants) ? (camp as any).metadata.auditorGrants : undefined);
  const cleanCampGrants = Array.isArray(rawCampGrants)
    ? rawCampGrants.filter((g: any) => g && g.id && !delGrantSet.has(String(g.id).toLowerCase().trim()))
    : undefined;
  const effectiveValidity = camp.validityDate || camp.expiry_date || camp.valid_until || (camp as any).validity_date || (camp as any).metadata?.validityDate || (camp as any).metadata?.expiry_date || (camp as any).metadata?.valid_until;
  const stamped: Campaign = {
    ...camp,
    ...(cleanCampGrants !== undefined ? { auditorGrants: cleanCampGrants } : {}),
    metadata: {
      ...(camp.metadata || {}),
      ...(cleanCampGrants !== undefined ? { auditorGrants: cleanCampGrants } : {}),
      ...(delGrantSet.size > 0 ? { deletedAuditorGrantIds: Array.from(delGrantSet) } : {})
    },
    validityDate: effectiveValidity || camp.validityDate,
    expiry_date: effectiveValidity || camp.expiry_date,
    valid_until: effectiveValidity || camp.valid_until,
    updatedAt: new Date().toISOString()
  };
  const current = getStoredCampaigns();
  const idx = current.findIndex(c => c.id === stamped.id);

  // Auto-cascade Pawl Code migration if orgCode has changed
  if (idx >= 0) {
    const existing = current[idx];
    const oldCode = existing?.orgCode ? String(existing.orgCode).trim().toUpperCase() : '';
    const newCode = stamped?.orgCode ? String(stamped.orgCode).trim().toUpperCase() : '';
    if (oldCode && newCode && oldCode !== newCode) {
      migrateCampaignMembersPrefix(stamped.id, oldCode, newCode);
    }
  }

  let updated: Campaign[];
  if (idx >= 0) {
    updated = [...current];
    updated[idx] = stamped;
  } else {
    updated = [stamped, ...current];
  }
  saveStoredCampaigns(updated);
  import('../services/supabaseService').then(({ upsertSupabaseCampaign }) => {
    upsertSupabaseCampaign(stamped).catch((err) => {
      console.warn('[Supabase] Live campaign direct insert note:', err);
    });
  }).catch(() => {});
  safeApiFetch('/api/campaigns', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(stamped)
  });
};

/**
 * Ensures all local campaign images are optimized (compressed data URLs)
 * and actively synced to Firebase Firestore and the backend server.
 * This guarantees custom logos for BMP Shillong, YMA Vengthar, etc.,
 * propagate instantaneously to mobile apps and other browsers.
 */
export const ensureCampaignImagesOptimizedAndSynced = async (): Promise<void> => {
  if (typeof window === 'undefined') return;
  try {
    const campaigns = getStoredCampaigns();
    let hasChanges = false;
    const optimizedList: Campaign[] = [];

    for (const c of campaigns) {
      const camp = { ...c };
      // 1. If it's a huge base64 DataURL, compress it down to lightweight mobile size
      if (camp.imageUrl && camp.imageUrl.startsWith('data:') && camp.imageUrl.length > 50000) {
        try {
          const compressed = await compressDataUrl(camp.imageUrl, 400, 400, 0.8);
          if (compressed && compressed !== camp.imageUrl) {
            camp.imageUrl = compressed;
            hasChanges = true;
          }
        } catch (e) {
          console.warn('[ImageSync] Failed to compress image for', camp.title, e);
        }
      }

      // 2. Only supply default image if image is completely missing
      if (!camp.imageUrl) {
        if (camp.id === 'cmp-1788107291420') {
          camp.imageUrl = BMP_SHILLONG_DEFAULT_LOGO;
          hasChanges = true;
        } else if (camp.id === 'cmp-kumtluang-1') {
          camp.imageUrl = BCM_EBENEZER_DEFAULT_LOGO;
          hasChanges = true;
        }
      }

      optimizedList.push(camp);
    }

    if (hasChanges) {
      saveStoredCampaigns(optimizedList, true);
      // Only push to cloud when an actual image repair or optimization occurred
      for (const camp of optimizedList) {
        const isCustomLogo = camp.imageUrl && !camp.imageUrl.includes('unsplash.com') && !camp.imageUrl.startsWith('data:image/svg+xml');
        if (isCustomLogo) {
          const stampedCamp = {
            ...camp,
            updatedAt: new Date().toISOString()
          };
          // Firebase removed
          syncCampaignToFirestore(stampedCamp).catch(() => {});
          safeApiFetch('/api/campaigns', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(stampedCamp)
          });
        }
      }
    }
  } catch (err) {
    console.warn('ensureCampaignImagesOptimizedAndSynced error:', err);
  }
};

export const deleteStoredCampaign = (
  campaignId: string,
  reason?: string,
  deletedBy?: string,
  forceHardDelete: boolean = false
): void => {
  if (!campaignId) return;
  const cleanId = String(campaignId).toLowerCase().trim();
  const current = getStoredCampaigns();
  const target = current.find(c => String(c.id).toLowerCase().trim() === cleanId);
  if (!target) {
    // Even if not in local memory, record as deleted to prevent resurrection
    recordDeletedCampaignId(cleanId);
    safeApiFetch(`/api/campaigns/${encodeURIComponent(campaignId)}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: reason || 'Admin deleted', performedBy: deletedBy || 'Admin', force: true })
    });
    safeApiFetch('/api/data/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deletedCampaignIds: [cleanId] })
    });
    return;
  }

  const allTxns = getStoredTransactions();
  const campTxns = allTxns.filter(t => 
    String(t.campaignId).toLowerCase().trim() === cleanId || 
    (target.title && String(t.campaignTitle).toLowerCase().trim() === String(target.title).toLowerCase().trim())
  );
  const totalCollected = campTxns
    .filter(t => isConfirmedTransaction(t))
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

  const hasPayments = campTxns.length > 0 && totalCollected > 0;

  // Always mark in deletedCampaignIds so sync cannot resurrect it
  recordDeletedCampaignId(cleanId);

  if (hasPayments && !forceHardDelete) {
    // Financial Safety Rule: Retain financial ledger & sulhnu history. Soft delete / Archive only!
    const updated = current.map(c => {
      if (String(c.id).toLowerCase().trim() === cleanId) {
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
    const updatedCamp = updated.find(c => String(c.id).toLowerCase().trim() === cleanId);
    if (updatedCamp) {
      import('../services/supabaseService').then(({ upsertSupabaseCampaign }) => {
        upsertSupabaseCampaign(updatedCamp).catch(() => {});
      }).catch(() => {});
    }
    recordAuditLog(
      'Campaign Cancelled & Archived',
      `Campaign "${target.title}" (${target.id}) with ₹${totalCollected} collected was cancelled and safely archived. Reason: ${reason || 'Admin cancelled'} (Ledger Retained)`,
      'campaign',
      campaignId
    );
  } else {
    // Zero collections or Admin force hard delete
    const updated = current.filter(c => String(c.id).toLowerCase().trim() !== cleanId);
    saveStoredCampaigns(updated);
    import('../services/supabaseService').then(({ deleteSupabaseCampaign }) => {
      deleteSupabaseCampaign(cleanId).catch(() => {});
    }).catch(() => {});
    recordAuditLog(
      'Campaign Deleted',
      `Campaign "${target.title}" (${target.id}) was deleted permanently. Reason: ${reason || 'Admin deleted'}. Performed by: ${deletedBy || 'Admin'}`,
      'campaign',
      campaignId
    );
  }

  safeApiFetch(`/api/campaigns/${encodeURIComponent(campaignId)}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      reason: reason || 'Admin deleted',
      performedBy: deletedBy || 'Admin',
      force: forceHardDelete || !hasPayments
    })
  });

  safeApiFetch('/api/data/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deletedCampaignIds: [cleanId] })
  });
};

export const isConfirmedTransaction = (tx?: Transaction | null): boolean => {
  if (!tx) return false;
  const status = (tx.status || '').toLowerCase().trim();
  if (status.includes('pending') || status === 'failed' || status === 'rejected' || status === 'cancelled') {
    return false;
  }
  return status === 'completed' || 
         status === 'success' || 
         status === 'verified' || 
         status === 'paid' || 
         status === 'payment_success' || 
         status === 'payment_completed' ||
         status === 'done' ||
         !status;
};

export const isTransactionForCampaign = (t?: Transaction | null, camp?: Campaign | null): boolean => {
  if (!t || !camp) return false;
  const cId = String(camp.id || '').trim().toLowerCase();
  const tCampId = String(t.campaignId || '').trim().toLowerCase();
  if (cId && tCampId && cId === tCampId) return true;

  const cTitle = String(camp.title || '').trim().toLowerCase();
  const tTitle = String(t.campaignTitle || '').trim().toLowerCase();
  if (cTitle && tTitle) {
    if (cTitle === tTitle) return true;
    if (cTitle.includes(tTitle) || tTitle.includes(cTitle)) return true;
  }

  // Authoritative alias matching
  if (cId === 'cmp-kumtluang-1' && (tTitle.includes('ebenezer') || tCampId === 'cmp-kumtluang-1')) return true;
  if (cId === 'cmp-1787829303143' && (tTitle.includes('vengthar') || tCampId === 'cmp-kumtluang-ymavt')) return true;
  if ((cId === 'cmp-1788107291420' || cTitle.includes('bmp') || cTitle.includes('shillong')) && (tCampId === 'cmp-1788107291420' || tTitle.includes('bmp') || tTitle.includes('shillong') || (t.memberId && String(t.memberId).startsWith('BMPSHL')))) return true;
  if (cId === 'cmp-1788526889943' && (tTitle.includes('lalrinpuii') || tCampId === 'cmp-1787545326556')) return true;
  return false;
};

const DELETED_TX_IDS_KEY = 'ronpay_deleted_tx_ids_v1';
export const PROTECTED_CANONICAL_TX_IDS = new Set<string>();

export const CANONICAL_BMP_RECEIPTS: Transaction[] = [];

export const clearDeletedTransactionId = (txId: string): void => {
  if (!txId) return;
  try {
    const clean = String(txId).toLowerCase().trim();
    const set = getDeletedTransactionIds();
    set.delete(clean);
    const arr = Array.from(set);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(DELETED_TX_IDS_KEY, JSON.stringify(arr));
      localStorage.setItem('ronpay_deleted_tx_ids', JSON.stringify(arr));
    }
  } catch (e) {}
};

export const PERMANENTLY_PURGED_TX_IDS = new Set<string>();

export const getDeletedTransactionIds = (): Set<string> => {
  const result = new Set<string>();
  for (const id of PERMANENTLY_PURGED_TX_IDS) {
    if (id) {
      result.add(id.toLowerCase().trim());
    }
  }
  try {
    const raw = localStorage.getItem(DELETED_TX_IDS_KEY) || localStorage.getItem('ronpay_deleted_tx_ids');
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        arr.forEach(id => {
          if (!id) return;
          result.add(String(id).toLowerCase().trim());
        });
      }
    }
  } catch (e) {}
  return result;
};

export const unpurgeTransactionIds = (ids: string[]): void => {
  if (!ids || ids.length === 0) return;
  try {
    const set = getDeletedTransactionIds();
    for (const id of ids) {
      if (!id) continue;
      const clean = String(id).toLowerCase().trim();
      set.delete(clean);
      PERMANENTLY_PURGED_TX_IDS.delete(clean);
    }
    const arr = Array.from(set);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(DELETED_TX_IDS_KEY, JSON.stringify(arr));
      localStorage.setItem('ronpay_deleted_tx_ids', JSON.stringify(arr));
      localStorage.setItem('ronpay_permanently_purged_tx_ids_v1', JSON.stringify(Array.from(PERMANENTLY_PURGED_TX_IDS)));
    }
  } catch (e) {}
};

export const findAllBrowserCachedTransactions = (): Transaction[] => {
  if (typeof localStorage === 'undefined') return [];
  const foundMap = new Map<string, Transaction>();

  const candidateKeys = [
    TRANSACTIONS_KEY,
    'ronpay_transactions_v4',
    'ronpay_transactions_v3',
    'ronpay_transactions_v2',
    'ronpay_transactions_v1',
    'ronpay_transactions',
    'ronpay_restored_cache_txs',
    'ronpay_supabase_pending_txs',
    'ronpay_offline_cache',
    'ronpay_db_backup_full',
    'ronpay_db_backup_v1',
    'ronpay_db_backup',
    'RONPAY_LAST_CASH_TXN',
  ];

  // 1. Direct candidate keys
  for (const k of candidateKeys) {
    try {
      const val = localStorage.getItem(k);
      if (val) {
        const parsed = JSON.parse(val);
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            if (item && item.id && Number(item.amount) > 0) {
              const cleanId = String(item.id).toLowerCase().trim();
              if (!foundMap.has(cleanId)) {
                foundMap.set(cleanId, item);
              }
            }
          }
        } else if (parsed && typeof parsed === 'object') {
          if (parsed.id && Number(parsed.amount) > 0) {
            const cleanId = String(parsed.id).toLowerCase().trim();
            if (!foundMap.has(cleanId)) {
              foundMap.set(cleanId, parsed);
            }
          } else if (Array.isArray(parsed.transactions)) {
            for (const item of parsed.transactions) {
              if (item && item.id && Number(item.amount) > 0) {
                const cleanId = String(item.id).toLowerCase().trim();
                if (!foundMap.has(cleanId)) {
                  foundMap.set(cleanId, item);
                }
              }
            }
          }
        }
      }
    } catch {}
  }

  // 2. Loop all keys in localStorage for any missed arrays containing transactions
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (candidateKeys.includes(k)) continue;
      try {
        const val = localStorage.getItem(k);
        if (val && val.startsWith('[') && val.includes('"amount"')) {
          const parsed = JSON.parse(val);
          if (Array.isArray(parsed)) {
            for (const item of parsed) {
              if (item && item.id && Number(item.amount) > 0 && (item.campaignId || item.campaignTitle || item.donorName)) {
                const cleanId = String(item.id).toLowerCase().trim();
                if (!foundMap.has(cleanId)) {
                  foundMap.set(cleanId, item);
                }
              }
            }
          }
        }
      } catch {}
    }
  } catch {}

  const result = Array.from(foundMap.values());
  result.sort((a, b) => {
    const timeA = new Date(a.updatedAt || a.createdAt || a.timestamp || 0).getTime();
    const timeB = new Date(b.updatedAt || b.createdAt || b.timestamp || 0).getTime();
    return timeB - timeA;
  });
  return result;
};

export const syncTombstonesFromFirestore = async (): Promise<void> => {
  return;
};

export const markTransactionAsDeleted = (txId: string, syncFirestore: boolean = true): void => {
  if (!txId) return;
  const clean = String(txId).toLowerCase().trim();
  try {
    PERMANENTLY_PURGED_TX_IDS.add(clean);
    const set = getDeletedTransactionIds();
    set.add(clean);
    const arr = Array.from(set).slice(-2000); // Retain recent deletions
    localStorage.setItem(DELETED_TX_IDS_KEY, JSON.stringify(arr));
    localStorage.setItem('ronpay_deleted_tx_ids', JSON.stringify(arr));
    localStorage.setItem('ronpay_permanently_purged_tx_ids_v1', JSON.stringify(Array.from(PERMANENTLY_PURGED_TX_IDS)));

    // Also notify Firestore tombstone in real-time if requested
    if (syncFirestore) {
      // Firebase removed
    }

    // Immediately remove from local transaction cache to instantly reflect deletion
    const raw = localStorage.getItem(TRANSACTIONS_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const filtered = parsed.filter(t => t && String(t.id).toLowerCase().trim() !== clean);
          if (filtered.length !== parsed.length) {
            localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(filtered));
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('ronpay_transactions_updated', { detail: filtered }));
            }
          }
        }
      } catch {}
    }
  } catch (e) {}
};

export const SYSTEM_HARD_PURGE_TIMESTAMP = 0;

export const getStoredTransactions = (): Transaction[] => {
  try {
    // One-time self-heal: recover any transactions that were falsely marked as deleted by background sync
    if (typeof localStorage !== 'undefined' && localStorage.getItem('ronpay_audit_tx_healed_v2') !== 'true') {
      try {
        const initIds = new Set(
          (Array.isArray(INITIAL_TRANSACTIONS) ? INITIAL_TRANSACTIONS : [])
            .map((t: any) => String(t?.id || '').toLowerCase().trim())
            .filter(Boolean)
        );
        const rawDel = localStorage.getItem(DELETED_TX_IDS_KEY) || localStorage.getItem('ronpay_deleted_tx_ids');
        if (rawDel) {
          const parsedDel = JSON.parse(rawDel);
          if (Array.isArray(parsedDel)) {
            const cleanedDel = parsedDel.filter((id: any) => !initIds.has(String(id || '').toLowerCase().trim()));
            localStorage.setItem(DELETED_TX_IDS_KEY, JSON.stringify(cleanedDel));
            localStorage.setItem('ronpay_deleted_tx_ids', JSON.stringify(cleanedDel));
          }
        }
        initIds.forEach(id => PERMANENTLY_PURGED_TX_IDS.delete(id));
        localStorage.setItem('ronpay_permanently_purged_tx_ids_v1', JSON.stringify(Array.from(PERMANENTLY_PURGED_TX_IDS)));
        localStorage.setItem('ronpay_audit_tx_healed_v2', 'true');
      } catch {}
    }

    const raw = typeof localStorage !== 'undefined' 
      ? (localStorage.getItem(TRANSACTIONS_KEY) || localStorage.getItem('ronpay_transactions_v2') || localStorage.getItem('ronpay_transactions'))
      : null;
    let parsed: any[] = [];
    if (raw) {
      try {
        const p = JSON.parse(raw);
        if (Array.isArray(p) && p.length > 0) parsed = p;
      } catch {}
    }

    // Merge cached transactions with INITIAL_TRANSACTIONS to guarantee full 103+ transactions are present
    if (Array.isArray(INITIAL_TRANSACTIONS) && INITIAL_TRANSACTIONS.length > 0) {
      const map = new Map<string, any>();
      for (const t of INITIAL_TRANSACTIONS) {
        if (t && t.id) map.set(String(t.id).toLowerCase().trim(), t);
      }
      for (const t of parsed) {
        if (t && t.id) {
          const k = String(t.id).toLowerCase().trim();
          const base = map.get(k);
          map.set(k, base ? { ...base, ...t } : t);
        }
      }
      parsed = Array.from(map.values());
      if (typeof localStorage !== 'undefined') {
        try {
          localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(parsed));
          localStorage.setItem('ronpay_transactions_v2', JSON.stringify(parsed));
          localStorage.setItem('ronpay_transactions', JSON.stringify(parsed));
        } catch {}
      }
    }

    if (parsed.length > 0) {
      const deletedIds = getDeletedTransactionIds();
      const seen = new Set<string>();
      const result: Transaction[] = [];
      for (const t of parsed) {
        if (!t || !t.id) continue;
        const rawId = String(t.id).trim();
        const cleanId = rawId.toLowerCase();
        if (
          rawId.startsWith('VCH-') ||
          rawId.startsWith('EXP-') ||
          t.status === 'approved' ||
          deletedIds.has(cleanId) || 
          PERMANENTLY_PURGED_TX_IDS.has(cleanId) || 
          seen.has(cleanId)
        ) continue;
        seen.add(cleanId);
        if (t.metadata && t.metadata.audit_mark === null) {
          t.audit_mark = undefined;
          t.audit_query = undefined;
          t.audit_marked_by = undefined;
          t.audit_marked_at = undefined;
          if (t.metadata.is_locked === false) {
            t.is_locked = false;
            t.locked_by = undefined;
            t.locked_at = undefined;
          }
        }
        result.push(t);
      }
      return result;
    }
    return [];
  } catch (e) {
    console.error('Failed to parse stored transactions', e);
  }
  return [];
};

let _syncServerTxTimer: any = null;

export const saveStoredTransactions = (transactions: Transaction[], skipServerPush: boolean = false) => {
  try {
    localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(transactions));
    localStorage.setItem('ronpay_transactions_v2', JSON.stringify(transactions));
    localStorage.setItem('ronpay_transactions', JSON.stringify(transactions));

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
          const newOrModifiedTxs = transactions.filter(t => t && t.id && (t.isSynced === false || (t as any).isOfflinePending));
          if (newOrModifiedTxs.length === 0 && deletedIds.length === 0) return;
          safeApiFetch('/api/data/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              transactions: newOrModifiedTxs,
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
              const deletedIdsSet = getDeletedTransactionIds();
              for (const st of serverTxs) {
                if (st && st.id) {
                  const k = String(st.id).toLowerCase().trim();
                  if (deletedIdsSet.has(k) || PERMANENTLY_PURGED_TX_IDS.has(k)) {
                    continue;
                  }
                  const existingLocal = localMap.get(k);
                  if (!existingLocal) {
                    localMap.set(k, st);
                    hasNewFromOtherWindow = true;
                  } else {
                    const localTime = new Date((existingLocal as any).updatedAt || existingLocal.createdAt || existingLocal.timestamp || 0).getTime();
                    const serverTime = new Date((st as any).updatedAt || st.createdAt || st.timestamp || 0).getTime();
                    if (serverTime > localTime) {
                      const mergedTx: Transaction = { ...existingLocal, ...st };
                      if (st.metadata && st.metadata.audit_mark === null) {
                        mergedTx.audit_mark = undefined;
                        mergedTx.audit_query = undefined;
                        mergedTx.audit_marked_by = undefined;
                        mergedTx.audit_marked_at = undefined;
                        if (st.metadata.is_locked === false) {
                          mergedTx.is_locked = false;
                          mergedTx.locked_by = undefined;
                          mergedTx.locked_at = undefined;
                        }
                      }
                      localMap.set(k, mergedTx);
                      hasNewFromOtherWindow = true;
                    }
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

export const isGuestUser = (profile?: CreatorProfile | null): boolean => {
  if (!profile) return true;
  if (profile.isAdmin === true) return false;
  if (profile.role === 'SUPER_ADMIN' || profile.role === 'ADMIN' || profile.role === 'MODERATOR') return false;
  const cleanName = (profile.name || '').trim().toLowerCase();
  const phone = (profile.phone || '').trim();
  if (!phone || phone === '9999999999' || profile.role === 'GUEST') return true;
  if (cleanName === 'khualmi' || cleanName === 'khualmi (guest user)' || cleanName === 'guest user' || cleanName === 'guest') return true;
  return false;
};

export const isAutoGeneratedFakeCreator = (c?: CreatorProfile | null): boolean => {
  if (!c) return false;
  if (c.isAdmin || c.role === 'SUPER_ADMIN' || c.role === 'ADMIN' || c.role === 'MODERATOR') return false;
  const name = (c.name || '').trim();
  const org = (c.orgName || '').trim();
  const desig = (c.designation || '').trim();
  if (
    name.startsWith('RonPay User (') ||
    org === 'Mizoram Community Member' ||
    org === 'RonPay Community Member' ||
    desig === 'Verified Member' ||
    desig === 'Verified Member (Google)'
  ) {
    return true;
  }
  return false;
};

export const isApprovedQRCreator = (profile?: CreatorProfile | null): boolean => {
  if (!profile) return false;
  if (isAutoGeneratedFakeCreator(profile) || isGuestUser(profile)) return false;
  if (profile.isAdmin === true || profile.role === 'SUPER_ADMIN' || profile.role === 'ADMIN' || profile.role === 'MODERATOR') return true;
  if (profile.isBlocked) return false;
  if (profile.role === 'AUDITOR' || profile.role === 'MEMBER' || profile.role === 'GUEST') return false;
  return Boolean(
    profile.isApproved &&
    profile.phone &&
    Array.isArray(profile.approvedCategories) &&
    profile.approvedCategories.length > 0
  );
};

export const getStoredCreatorProfile = (): CreatorProfile => {
  try {
    const raw = localStorage.getItem(CREATOR_PROFILE_KEY);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        // Purge any fake auto-created profile from previous unregistered login attempts
        if (isAutoGeneratedFakeCreator(parsed)) {
          localStorage.setItem(CREATOR_PROFILE_KEY, JSON.stringify(GUEST_CREATOR_PROFILE));
          return GUEST_CREATOR_PROFILE;
        }

        // Ensure Auditors and standard Members cannot masquerade as approved QR Creators
        if (parsed.role === 'AUDITOR' || parsed.role === 'MEMBER') {
          parsed.isApproved = false;
          parsed.approvedCategories = [];
        }

        if (parsed.orgName === 'RonPay HQ / Master Console') {
          parsed.orgName = 'BCM Ebenezer';
          localStorage.setItem(CREATOR_PROFILE_KEY, JSON.stringify(parsed));
        }

        // Explicitly non-admin profile check (e.g. TESTER, DEVELOPER, MEMBER, CREATOR, GUEST)
        const isNonAdminProfile = !parsed.isAdmin && parsed.role !== 'SUPER_ADMIN' && parsed.role !== 'ADMIN';
        if (isNonAdminProfile) {
          if (typeof window !== 'undefined') {
            localStorage.removeItem(ADMIN_AUTH_LOCAL_KEY);
            localStorage.removeItem(ADMIN_PASSWORD_VERIFIED_KEY);
            localStorage.removeItem('ronpay_admin_role');
            sessionStorage.removeItem('ronpay_admin_auth');
            sessionStorage.removeItem(ADMIN_PASSWORD_VERIFIED_KEY);
            sessionStorage.removeItem('ronpay_admin_role');
          }
          parsed.isAdmin = false;
          return parsed;
        }

        // 1. If an authorized admin/staff session is actively logged in on this device:
        const isAuthorizedAdminSession = isStoredAdminAuthorized();
        const storedAdminRole = typeof window !== 'undefined' 
          ? (localStorage.getItem('ronpay_admin_role') || sessionStorage.getItem('ronpay_admin_role'))
          : null;

        if (isAuthorizedAdminSession && (storedAdminRole === 'SUPER_ADMIN' || storedAdminRole === 'ADMIN' || storedAdminRole === 'MODERATOR')) {
          parsed.isAdmin = (storedAdminRole === 'SUPER_ADMIN' || storedAdminRole === 'ADMIN');
          parsed.role = storedAdminRole as any;
          if (!parsed.phone || parsed.phone === '9999999999' || !parsed.name || parsed.name === 'Khualmi (Guest User)') {
            parsed.name = storedAdminRole === 'SUPER_ADMIN' ? 'Super Admin (Master)' : storedAdminRole === 'ADMIN' ? 'Admin' : 'Moderator';
            parsed.phone = storedAdminRole === 'SUPER_ADMIN' ? '9862000001' : '9862000002';
          }
          return parsed;
        }

        // 2. Otherwise, check if user is a normal Guest
        const cleanName = (parsed.name || '').trim().toLowerCase();
        const isGuestProfile = parsed.role === 'GUEST' || !parsed.phone || parsed.phone === '9999999999' || cleanName === 'khualmi' || cleanName === 'khualmi (guest user)' || cleanName === 'guest user';
        if (isGuestProfile) {
          parsed.isAdmin = false;
          parsed.role = 'GUEST';
        }
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to parse creator profile', e);
  }
  // First time app launch: new user enters as Guest User (Khualmi)
  try {
    localStorage.setItem(CREATOR_PROFILE_KEY, JSON.stringify(GUEST_CREATOR_PROFILE));
  } catch {}
  return GUEST_CREATOR_PROFILE;
};

export const logoutCreator = (): CreatorProfile => {
  try {
    localStorage.setItem(CREATOR_PROFILE_KEY, JSON.stringify(GUEST_CREATOR_PROFILE));
    clearAdminAuthState();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ronpay-creator-updated', { detail: GUEST_CREATOR_PROFILE }));
      window.dispatchEvent(new CustomEvent('ronpay_creator_profile_updated', { detail: GUEST_CREATOR_PROFILE }));
      broadcastTabSync('creator_profile', GUEST_CREATOR_PROFILE);
      broadcastTabSync('auth', { reason: 'auth_logout' });
    }
  } catch (e) {
    console.error('Failed to log out creator', e);
  }
  return GUEST_CREATOR_PROFILE;
};

export const loginCreator = (profile: CreatorProfile): void => {
  try {
    localStorage.setItem(CREATOR_PROFILE_KEY, JSON.stringify(profile));
    if (profile.isAdmin || profile.role === 'SUPER_ADMIN' || profile.role === 'ADMIN') {
      sessionStorage.setItem('ronpay_admin_auth', 'true');
      localStorage.setItem(ADMIN_AUTH_LOCAL_KEY, 'true');
      localStorage.setItem(ADMIN_PASSWORD_VERIFIED_KEY, 'true');
      localStorage.setItem('ronpay_admin_role', profile.role || 'ADMIN');
    } else {
      clearAdminAuthState();
    }
    
    // Only update or insert into registered creators list if this is a real Creator (not Guest, Auditor, Member, or auto-generated)
    const currentList = getStoredCreatorsList();
    let updatedList = [...currentList];
    const isGenuineCreator = !isAutoGeneratedFakeCreator(profile) &&
      profile.role !== 'GUEST' &&
      profile.role !== 'MEMBER' &&
      profile.role !== 'AUDITOR';

    if (isGenuineCreator && profile.phone) {
      const idx = currentList.findIndex(c => c.phone === profile.phone);
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
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ronpay-creator-updated', { detail: profile }));
      window.dispatchEvent(new CustomEvent('ronpay_creator_profile_updated', { detail: profile }));
      window.dispatchEvent(new CustomEvent('ronpay_creators_updated', { detail: updatedList }));
      broadcastTabSync('creator_profile', profile);
      broadcastTabSync('creators', updatedList);
      broadcastTabSync('auth', { reason: 'auth_login', profile });
    }
  } catch (e) {
    console.error('Failed to login creator', e);
  }
};

export const saveStoredCreatorProfile = (profile: CreatorProfile, skipServerPush: boolean = false) => {
  try {
    localStorage.setItem(CREATOR_PROFILE_KEY, JSON.stringify(profile));

    // Only update in registered creators list if genuine Creator
    const currentList = getStoredCreatorsList();
    let updatedList = [...currentList];
    const isGenuineCreator = !isAutoGeneratedFakeCreator(profile) &&
      profile.role !== 'GUEST' &&
      profile.role !== 'MEMBER' &&
      profile.role !== 'AUDITOR';

    if (isGenuineCreator && profile.phone) {
      const idx = currentList.findIndex(c => c.phone === profile.phone);
      if (idx >= 0) {
        updatedList[idx] = { ...updatedList[idx], ...profile };
      } else {
        updatedList.push(profile);
      }
      localStorage.setItem(CREATORS_LIST_KEY, JSON.stringify(updatedList));

      if (!skipServerPush) {
        import('../services/supabaseService').then(({ upsertSupabaseUser }) => {
          upsertSupabaseUser(profile).catch(() => {});
        }).catch(() => {});

        safeApiFetch('/api/data/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ creators: updatedList })
        }).catch(() => {});
      }
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ronpay-creator-updated', { detail: profile }));
      window.dispatchEvent(new CustomEvent('ronpay_creator_profile_updated', { detail: profile }));
      window.dispatchEvent(new CustomEvent('ronpay_creators_updated', { detail: updatedList }));
      broadcastTabSync('creator_profile', profile);
      broadcastTabSync('creators', updatedList);
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
        // Filter out any auto-generated fake profiles or pure Auditor/Member profiles
        const cleaned = parsed.filter((c: CreatorProfile) => {
          if (!c || isAutoGeneratedFakeCreator(c)) return false;
          if (c.role === 'AUDITOR' || c.role === 'MEMBER' || c.role === 'GUEST') return false;
          return true;
        });
        let hasChanges = cleaned.length !== parsed.length;
        const existingPhones = new Set(cleaned.map((c: CreatorProfile) => (c.phone || '').trim().replace(/\D/g, '').slice(-10)));
        const merged = [...cleaned];
        for (const initC of INITIAL_REGISTERED_CREATORS) {
          const initPhoneDigits = (initC.phone || '').trim().replace(/\D/g, '').slice(-10);
          if (initPhoneDigits && !existingPhones.has(initPhoneDigits)) {
            merged.push(initC);
            hasChanges = true;
          }
        }
        if (hasChanges) {
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

export const saveStoredCreatorsList = (creators: CreatorProfile[], skipServerPush: boolean = false) => {
  try {
    const cleaned = creators.filter(c => c && !isAutoGeneratedFakeCreator(c) && c.role !== 'AUDITOR' && c.role !== 'MEMBER' && c.role !== 'GUEST');
    localStorage.setItem(CREATORS_LIST_KEY, JSON.stringify(cleaned));
    
    // Check if active profile is in the list
    const active = getStoredCreatorProfile();
    if (active && active.phone) {
      const matched = cleaned.find(c => c.phone === active.phone || c.phone.replace(/\D/g, '').slice(-10) === active.phone.replace(/\D/g, '').slice(-10));
      if (
        matched &&
        (matched.name !== active.name ||
          matched.orgName !== active.orgName ||
          matched.designation !== active.designation ||
          matched.isApproved !== active.isApproved ||
          matched.isBlocked !== active.isBlocked ||
          matched.avatarUrl !== active.avatarUrl ||
          matched.logoUrl !== active.logoUrl ||
          JSON.stringify(matched.approvedCategories) !== JSON.stringify(active.approvedCategories) ||
          JSON.stringify(matched.pendingUpgrade) !== JSON.stringify(active.pendingUpgrade))
      ) {
        const updatedActive = { ...active, ...matched };
        localStorage.setItem(CREATOR_PROFILE_KEY, JSON.stringify(updatedActive));
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('ronpay-creator-updated', { detail: updatedActive }));
          window.dispatchEvent(new CustomEvent('ronpay_creator_profile_updated', { detail: updatedActive }));
        }
      }
    }

    if (!skipServerPush) {
      safeApiFetch('/api/data/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creators })
      }).catch(() => {});
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ronpay_creators_updated', { detail: creators }));
      broadcastTabSync('creators', creators);
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

export const saveStoredPricingConfig = (config: SystemPricingConfig, skipServerPush: boolean = false) => {
  try {
    localStorage.setItem(PRICING_CONFIG_KEY, JSON.stringify(config));
    if (!skipServerPush) {
      if (config) {
        syncPricingConfigToFirestore(config).catch(() => {});
      }
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ronpay_pricing_config_updated', { detail: config }));
      broadcastTabSync('pricing_config', config);
    }
  } catch (e) {
    console.error('Failed to save pricing config', e);
  }
};

export const DEFAULT_SECTION_PRESETS: SectionQuickPreset[] = [
  {
    id: 'preset-kohhran',
    name: '⛪ Kohhran (Bial 1-4)',
    label: 'Bial / Unit',
    sections: ['Bial 1 (Vengchhak)', 'Bial 2 (Vengthlang)', 'Bial 3 (Venglai)', 'Bial 4 (Field Veng)', 'General / Khawchhung'],
    isSystem: true
  },
  {
    id: 'preset-yma',
    name: '🏛️ YMA / NGO (Section A-D)',
    label: 'Section / Veng',
    sections: ['Section A', 'Section B', 'Section C', 'Section D', 'General / Khawchhung'],
    isSystem: true
  },
  {
    id: 'preset-veng',
    name: '🏘️ Veng / Area',
    label: 'Veng / Area',
    sections: ['Veng Chhak', 'Veng Thlang', 'Veng Lai', 'Field Veng', 'General'],
    isSystem: true
  },
  {
    id: 'preset-group',
    name: '👥 Group / Branch (1-4)',
    label: 'Group / Branch',
    sections: ['Group 1', 'Group 2', 'Group 3', 'Group 4', 'General'],
    isSystem: true
  }
];

export const getStoredSectionPresets = (): SectionQuickPreset[] => {
  try {
    const pricing = getStoredPricingConfig();
    if (pricing?.sectionPresets && Array.isArray(pricing.sectionPresets) && pricing.sectionPresets.length > 0) {
      return pricing.sectionPresets;
    }

    if (typeof window !== 'undefined') {
      const raw = localStorage.getItem('ronpay_section_presets_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    }
  } catch (e) {
    console.warn('Error reading section presets:', e);
  }
  return DEFAULT_SECTION_PRESETS;
};

export const saveStoredSectionPresets = (presets: SectionQuickPreset[], skipServerPush: boolean = false) => {
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem('ronpay_section_presets_v1', JSON.stringify(presets));
      window.dispatchEvent(new CustomEvent('ronpay_section_presets_updated', { detail: presets }));
    }

    const currentPricing = getStoredPricingConfig();
    const updatedPricing: SystemPricingConfig = {
      ...currentPricing,
      sectionPresets: presets,
      updatedAt: new Date().toISOString()
    };
    saveStoredPricingConfig(updatedPricing, skipServerPush);
  } catch (e) {
    console.warn('Error saving section presets:', e);
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
      broadcastTabSync('user_paid', ids);
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
 * Checks if a user profile has an authorized administrative or campaign management role.
 * Authorized roles: 'SUPER_ADMIN', 'ADMIN', 'MODERATOR', 'CREATOR', 'TREASURER', 'ACCOUNTANT'
 */
export const isAuthorizedRole = (creatorProfile?: CreatorProfile | null): boolean => {
  if (!creatorProfile) return false;
  if (isSuperAdminOrAdminProfile(creatorProfile)) return true;
  const roleLower = String(creatorProfile.role || '').toLowerCase();
  const desigLower = String(creatorProfile.designation || '').toLowerCase();
  if (
    roleLower === 'admin' ||
    roleLower === 'super_admin' ||
    roleLower === 'creator' ||
    roleLower === 'treasurer' ||
    roleLower === 'accountant' ||
    roleLower === 'moderator'
  ) {
    return true;
  }
  if (desigLower.includes('treasurer') || desigLower.includes('accountant')) {
    return true;
  }
  return false;
};

/**
 * Checks if a user is an authorized officer or manager for a specific campaign
 * (Creator, Treasurer, Accountant, or assigned Officer).
 */
export const isCampaignManagerOrOfficer = (
  camp: Campaign,
  creatorProfile?: CreatorProfile | null
): boolean => {
  if (!creatorProfile || !camp) return false;
  if (isSuperAdminOrAdminProfile(creatorProfile)) return true;

  const uPhone = (creatorProfile.phone || '').trim().replace(/\D/g, '').slice(-10);
  const uName = (creatorProfile.name || '').trim().toLowerCase();

  // 1. Check assigned authorizedOfficers on this specific campaign
  if (Array.isArray(camp.authorizedOfficers) && camp.authorizedOfficers.length > 0) {
    const isAssigned = camp.authorizedOfficers.some((o: any) => {
      if (!o) return false;
      const oPhone = String(o.phone || '').replace(/\D/g, '').slice(-10);
      if (uPhone && uPhone.length >= 8 && oPhone && oPhone.length >= 8 && oPhone === uPhone) {
        return true;
      }
      if (uName && uName.length >= 3 && o.name && String(o.name).trim().toLowerCase() === uName) {
        return true;
      }
      return false;
    });
    if (isAssigned) return true;
  }

  // 2. Check UserGroupMembership for this specific campaign with approved Creator/Officer role
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('ronpay_group_memberships_v1') : null;
    if (raw) {
      const memberships = JSON.parse(raw);
      if (Array.isArray(memberships)) {
        const mem = memberships.find((m: any) => 
          m && 
          m.campaignId === camp.id && 
          String(m.userPhone || '').replace(/\D/g, '').slice(-10) === uPhone &&
          m.status === 'active'
        );
        if (mem) {
          const mRole = String(mem.role || '').toLowerCase();
          // If granted Creator or Officer role in THIS campaign
          if (mRole === 'creator' || mRole === 'admin' || mRole === 'officer' || mRole === 'treasurer' || mRole === 'accountant') {
            return true;
          }
        }
      }
    }
  } catch {}

  return isActualCampaignOwner(camp, creatorProfile);
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

  // 1. Transaction was explicitly paid in this active browser session/device (session token)
  if (userPaidIds && userPaidIds.length > 0 && userPaidIds.includes(tx.id)) {
    return true;
  }

  // 2. Strict Phone Match with currently logged-in user profile ("Ama sulhnu chiah")
  const userPhoneDigits = (creatorProfile?.phone || '').replace(/\D/g, '').slice(-10);
  const txPhoneDigits = (tx.donorPhone || '').replace(/\D/g, '').slice(-10);

  if (userPhoneDigits.length >= 8 && txPhoneDigits.length >= 8) {
    if (userPhoneDigits === txPhoneDigits) {
      return true;
    }
    // If both have phone numbers and they do NOT match, it belongs to a different person!
    return false;
  }

  // 3. User ID or Member ID match (e.g. Member Roll ID)
  if (creatorProfile?.id) {
    const cleanProfId = String(creatorProfile.id).toLowerCase().trim();
    if (tx.memberId && String(tx.memberId).toLowerCase().trim() === cleanProfId) return true;
    if ((tx as any).userId && String((tx as any).userId).toLowerCase().trim() === cleanProfId) return true;
    if (tx.subId && String(tx.subId).toLowerCase().trim() === cleanProfId) return true;
  }

  // 4. For Auditors and Guests: never match by name alone when phone/memberId is absent,
  // so they strictly never see another person's transaction in Sulhnu.
  if (!creatorProfile || creatorProfile.role === 'AUDITOR' || creatorProfile.role === 'GUEST') {
    return false;
  }

  // 5. Exact Full Name Match (only when transaction has no conflicting phone and name is distinctive)
  if (creatorProfile.name && tx.donorName && !tx.isAnonymous && !txPhoneDigits) {
    const uName = creatorProfile.name.trim().toLowerCase().replace(/\s*\([^)]*\)/g, '').trim();
    const dName = tx.donorName.trim().toLowerCase().replace(/\s*\([^)]*\)/g, '').trim();
    const isGeneric = ['ronpay user', 'guest user', 'user', 'valued donor', 'anonymous', 'donor', 'khualmi', 'khualmi (guest user)', 'auditor'].includes(uName);
    
    if (!isGeneric && uName.length >= 4 && uName === dName) {
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
export const isActualCampaignOwner = (camp: Campaign, creatorProfile?: CreatorProfile | null): boolean => {
  if (!creatorProfile || !camp) return false;
  // Guest users are strictly viewers and never own/manage campaigns
  if (creatorProfile.role === 'GUEST' || !creatorProfile.phone || creatorProfile.name === 'Khualmi (Guest User)') {
    return false;
  }

  const creatorPhone = (creatorProfile.phone || '').trim().replace(/\D/g, '').slice(-10);
  const creatorRawPhone = (creatorProfile.phone || '').trim();

  const campCreatedBy = (camp.createdBy || '').trim();
  const campCreatedByDigits = campCreatedBy.replace(/\D/g, '').slice(-10);

  const campCreatorPhone = ((camp as any).creatorPhone || (camp as any).contactPhone || '').trim().replace(/\D/g, '').slice(-10);

  // Strict Phone Match (last 10 digits or exact string) - "Ama Siam chauh"
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
    const campTransferredPhone = ((camp as any).transferredTo || '').trim().replace(/\D/g, '').slice(-10);
    if (campTransferredPhone && campTransferredPhone.length >= 8 && campTransferredPhone === creatorPhone) {
      return true;
    }
    if (Array.isArray((camp as any).authorizedOfficers)) {
      const isAuthOfficer = (camp as any).authorizedOfficers.some((o: any) => {
        const oPhone = (o?.phone || '').trim().replace(/\D/g, '').slice(-10);
        return oPhone && oPhone.length >= 8 && oPhone === creatorPhone;
      });
      if (isAuthOfficer) return true;
    }
  }

  // Name match if distinctly set and not a generic username
  if (creatorProfile.name && camp.createdBy) {
    const cName = creatorProfile.name.trim().toLowerCase();
    const isGeneric = ['ronpay user', 'guest user', 'user', 'valued donor', 'anonymous', 'donor', 'khualmi (guest user)'].includes(cName);
    if (!isGeneric && cName.length >= 4 && cName === camp.createdBy.trim().toLowerCase()) {
      return true;
    }
  }

  return false;
};

/**
 * Checks if the currently active user/creator is the verified owner/creator of a given campaign,
 * or an authorized staff member (Admin/Super Admin/Treasurer/Accountant/Moderator) with management privileges.
 */
export const isCampaignCreator = (camp: Campaign, creatorProfile?: CreatorProfile | null): boolean => {
  if (!creatorProfile || !camp) return false;
  // Guest users are strictly viewers and never own/manage campaigns
  if (creatorProfile.role === 'GUEST' || !creatorProfile.phone || creatorProfile.name === 'Khualmi (Guest User)') {
    return false;
  }
  // Authorized Staff
  if (creatorProfile.isAdmin || creatorProfile.role === 'SUPER_ADMIN' || creatorProfile.role === 'ADMIN' || creatorProfile.role === 'MODERATOR') {
    return true;
  }

  return isCampaignManagerOrOfficer(camp, creatorProfile);
};

/**
 * Determines whether a transaction is visible to the currently active user or creator in Sulhnu (History).
 * Role-Based Filtering Rules:
 * 1. Super Admin & Admin: Platform-wide access to monitor all transactions.
 * 2. Moderator: Moderation desk scope (assigned categories or created campaigns).
 * 3. Authorized Roles ('CREATOR', 'TREASURER', 'ACCOUNTANT'):
 *    - All incoming transactions donated to Campaigns they manage or are assigned to as officers.
 *    - Personal transactions paid by this user as a donor ("ama tih chin").
 *    - Other unauthorized campaigns are strictly excluded.
 * 4. Guest / Regular User View:
 *    - STRICT DONOR PRIVACY ("ama tih chin chiah"):
 *    - ONLY transactions paid by this user (matched by phone, user ID, or session token).
 *    - Other donors' transaction records are ENTIRELY HIDDEN.
 */
export const isUserOrCreatorTransaction = (
  tx: Transaction,
  campaigns: Campaign[],
  creatorProfile: CreatorProfile | null | undefined,
  userPaidIds: string[] = []
): boolean => {
  if (!tx) return false;

  // 1. Super Admin & Admin have unrestricted platform access to monitor all transactions
  if (isSuperAdminOrAdminProfile(creatorProfile)) {
    return true;
  }

  // 2. Moderator: Moderation desk scope (assigned categories or created campaigns)
  if (creatorProfile?.role === 'MODERATOR') {
    const allowedCategories = new Set<string>(
      (creatorProfile?.approvedCategories || (creatorProfile as any)?.allowedCategories || []).map((cat: string) => String(cat).toLowerCase())
    );
    const txCamp = (campaigns || []).find(c => c && (c.id === tx.campaignId || (tx.campaignTitle && c.title === tx.campaignTitle)));
    const txCategory = tx.category || (txCamp ? txCamp.category : '');
    if (allowedCategories.size === 0 || allowedCategories.has('all') || (txCategory && allowedCategories.has(txCategory.toLowerCase()))) {
      return true;
    }
    if (txCamp && isCampaignManagerOrOfficer(txCamp, creatorProfile)) {
      return true;
    }
    return false;
  }

  // 3. Check if user has an authorized role with campaign oversight
  // IMPORTANT: Auditors, Members, and Guests in Sulhnu (Pekna Sulhnu) must ONLY see their own personal transactions ("ama sulhnu chiah").
  // Auditors inspect campaign accounts inside the dedicated Auditor Portal, NEVER in personal Sulhnu!
  const cleanCreatorName = (creatorProfile?.name || '').trim().toLowerCase().replace(/\s*\([^)]*\)/g, '').trim();
  const isPersonalSulhnuOnlyRole =
    !creatorProfile ||
    creatorProfile.role === 'GUEST' ||
    creatorProfile.role === 'AUDITOR' ||
    creatorProfile.role === 'MEMBER' ||
    !creatorProfile.phone ||
    creatorProfile.phone === '9999999999' ||
    cleanCreatorName === 'khualmi' ||
    cleanCreatorName === 'khualmi (guest user)' ||
    cleanCreatorName === 'guest user';

  if (isPersonalSulhnuOnlyRole) {
    return isUserPaidTransaction(tx, userPaidIds, creatorProfile);
  }

  // Check if profile has any campaigns they manage (as Creator, Treasurer, or Accountant)
  const managesAnyCampaign = (campaigns || []).some(c => c && isCampaignManagerOrOfficer(c, creatorProfile));
  const isAuthorizedManager =
    creatorProfile?.role === 'CREATOR' ||
    creatorProfile?.role === 'TREASURER' ||
    creatorProfile?.role === 'ACCOUNTANT' ||
    managesAnyCampaign;

  // 4. Regular User / Guest View: STRICT DONOR PRIVACY
  // Only personal transactions; hide all other donors' records entirely!
  if (!isAuthorizedManager) {
    return isUserPaidTransaction(tx, userPaidIds, creatorProfile);
  }

  // 5. Authorized Role View (Creator / Treasurer / Accountant):
  // Check if this transaction belongs to a campaign they manage
  const txCampaignTitle = String(tx.campaignTitle || '').toLowerCase().trim();
  const parentCamp = (campaigns || []).find(c => 
    c && (
      c.id === tx.campaignId || 
      (txCampaignTitle && c.title && String(c.title).toLowerCase().trim() === txCampaignTitle)
    )
  );

  if (parentCamp && isCampaignManagerOrOfficer(parentCamp, creatorProfile)) {
    return true;
  }

  // 6. Personal payments made by this creator/officer as a donor to other campaigns
  return isUserPaidTransaction(tx, userPaidIds, creatorProfile);
};

/**
 * Returns all transactions accessible to the current logged-in Creator or User for Sulhnu History.
 * Enforces role-based query and visibility limits:
 * - Guest / Regular User: ONLY personal transactions (matched by phone, user ID, or session tokens).
 * - Creator / Treasurer / Accountant: All transactions under managed campaigns + personal transactions.
 * - Admin / Super Admin: All transactions platform-wide.
 */
export const getUserOrCreatorVisibleTransactions = (
  transactions: Transaction[],
  campaigns: Campaign[],
  creatorProfile: CreatorProfile | null | undefined,
  userPaidIds: string[] = []
): Transaction[] => {
  const safeTransactions = (transactions && Array.isArray(transactions) && transactions.length > 0)
    ? transactions
    : getStoredTransactions();

  // 1. Super Admin & Admin get all transactions
  if (isSuperAdminOrAdminProfile(creatorProfile)) {
    return safeTransactions.filter(Boolean);
  }

  if (!safeTransactions || safeTransactions.length === 0) return [];

  const safeCampaigns = Array.isArray(campaigns) && campaigns.length > 0
    ? campaigns
    : getStoredCampaigns();
  const safeUserPaidIds = Array.isArray(userPaidIds) ? userPaidIds : [];

  // 2. Moderator gets transactions within assigned categories or owned campaigns
  if (creatorProfile?.role === 'MODERATOR' || (typeof window !== 'undefined' && localStorage.getItem('ronpay_admin_role') === 'MODERATOR')) {
    return safeTransactions.filter(tx => tx && isUserOrCreatorTransaction(tx, safeCampaigns, creatorProfile, safeUserPaidIds));
  }

  // 3. Guest User or Regular Member: STRICT DONOR PRIVACY
  const cleanProfileName = (creatorProfile?.name || '').trim().toLowerCase().replace(/\s*\([^)]*\)/g, '').trim();
  const isGuest = !creatorProfile || creatorProfile?.role === 'GUEST' || !creatorProfile?.phone || creatorProfile?.phone === '9999999999' || cleanProfileName === 'khualmi' || cleanProfileName === 'khualmi (guest user)' || cleanProfileName === 'guest user';

  const managesAnyCampaign = !isGuest && safeCampaigns.some(c => c && isCampaignManagerOrOfficer(c, creatorProfile));
  const isAuthorizedManager = !isGuest && (
    creatorProfile?.role === 'CREATOR' ||
    creatorProfile?.role === 'TREASURER' ||
    creatorProfile?.role === 'ACCOUNTANT' ||
    managesAnyCampaign
  );

  if (!isAuthorizedManager) {
    return safeTransactions.filter(tx => tx && isUserPaidTransaction(tx, safeUserPaidIds, creatorProfile));
  }

  // 4. Authorized Creator / Treasurer / Accountant:
  // View transactions for managed campaigns plus personal contributions
  return safeTransactions.filter(tx => 
    tx && isUserOrCreatorTransaction(tx, safeCampaigns, creatorProfile, safeUserPaidIds)
  );
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

export const saveStoredAuditLogs = (logs: AuditLog[], skipServerPush: boolean = false) => {
  try {
    localStorage.setItem(AUDIT_LOGS_KEY, JSON.stringify(logs));
    if (!skipServerPush && Array.isArray(logs) && logs.length > 0) {
      safeApiFetch('/api/data/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auditLogs: logs })
      }).catch(() => {});
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ronpay_audit_logs_updated', { detail: logs }));
      broadcastTabSync('audit_logs', logs);
    }
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
    const updated = [newLog, ...current.filter(l => l.id !== newLog.id).slice(0, 499)]; // Keep latest 500 logs
    saveStoredAuditLogs(updated);
    syncAuditLogToFirestore(newLog).catch(() => {});
    // Direct sync to central backend so Phone App and Web sync instantly
    safeApiFetch('/api/data/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ auditLogs: [newLog] })
    }).catch(() => {});
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
      if (parsed && typeof parsed === 'object') {
        // Ensure default items exist if upgrading from older format
        const items = (Array.isArray(parsed.items) && parsed.items.length > 0)
          ? parsed.items
          : DEFAULT_ANNOUNCEMENT_ITEMS;
        return {
          ...DEFAULT_ANNOUNCEMENT,
          ...parsed,
          items,
          isActive: Boolean(parsed.isActive), // Strictly respect false if turned off!
          autoRotate: parsed.autoRotate !== undefined ? parsed.autoRotate : true,
          rotationSpeedSeconds: parsed.rotationSpeedSeconds || 4,
          animationStyle: parsed.animationStyle || 'slide'
        };
      }
    }
  } catch (e) {
    console.error('Failed to parse announcement banner', e);
  }
  return DEFAULT_ANNOUNCEMENT;
};

export const saveStoredAnnouncement = (ann: AnnouncementBanner, skipServerPush: boolean = false) => {
  try {
    localStorage.setItem(ANNOUNCEMENT_KEY, JSON.stringify(ann));
    if (!skipServerPush) {
      if (ann) {
        syncAnnouncementToFirestore(ann).catch(() => {});
      }
      safeApiFetch('/api/announcement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ann)
      }).catch(() => {});
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ronpay_announcement_updated', { detail: ann }));
      broadcastTabSync('announcement', ann);
    }
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
    members?: MemberRecord[];
    expenses?: KumtluangExpense[];
    staffAccounts?: StaffAccount[];
    creators?: CreatorProfile[];
  };
}

export const exportFullDatabaseBackup = (currentProfile?: CreatorProfile | null): string => {
  const profile = currentProfile || getStoredCreatorProfile();
  if (isGuestUser(profile)) {
    throw new Error('Khualmi (Guest user) tan backup siam theih a ni lo.');
  }

  const isSuperAdmin = Boolean(profile?.isAdmin || profile?.role === 'SUPER_ADMIN' || profile?.role === 'ADMIN');
  let campaigns = getStoredCampaigns();
  let transactions = getStoredTransactions();
  let members = getMembers();
  let expenses = getStoredExpenses();

  if (!isSuperAdmin) {
    // Creator scope: Filter strictly to campaigns created/owned by this creator ("Ama bawk siam chauh")
    campaigns = campaigns.filter(c => isCampaignCreator(c, profile));
    const myCampIds = new Set(campaigns.map(c => String(c.id).toLowerCase().trim()));
    transactions = transactions.filter(t => myCampIds.has(String(t.campaignId).toLowerCase().trim()));
    members = members.filter(m => myCampIds.has(String(m.campaignId).toLowerCase().trim()));
    expenses = expenses.filter(e => myCampIds.has(String(e.campaignId).toLowerCase().trim()));
  }

  const backup: RonPayBackupPackage & { scope?: string } = {
    version: '2.5.0',
    exportedAt: new Date().toISOString(),
    app: 'RonPay Community Platform',
    scope: isSuperAdmin ? 'full_system' : 'creator_only',
    data: {
      campaigns,
      transactions,
      creatorsList: isSuperAdmin ? getStoredCreatorsList() : [profile],
      creatorProfile: profile,
      pricingConfig: getStoredPricingConfig(),
      announcement: getStoredAnnouncement(),
      auditLogs: isSuperAdmin ? getStoredAuditLogs() : [],
      userPaidTxIds: getStoredUserPaidTxIds(),
      members,
      expenses,
      staffAccounts: isSuperAdmin ? getStoredStaffAccounts() : [],
    }
  };

  recordAuditLog(
    'Database Backup Exported',
    `Exported backup (${backup.scope}) containing ${campaigns.length} campaigns, ${transactions.length} transactions by ${profile.name}.`,
    'system'
  );

  return JSON.stringify(backup, null, 2);
};

export const restoreFullDatabaseBackup = (
  jsonString: string,
  currentProfile?: CreatorProfile | null
): { success: boolean; error?: string; counts?: { campaigns: number; transactions: number; creators: number; members?: number; expenses?: number } } => {
  try {
    const parsed: any = JSON.parse(jsonString);
    if (!parsed || !parsed.data) {
      return { success: false, error: 'Invalid backup file structure: missing data payload.' };
    }

    const { data } = parsed;
    const activeProfile = currentProfile || getStoredCreatorProfile();
    const isSuperAdmin = Boolean(activeProfile?.isAdmin || activeProfile?.role === 'SUPER_ADMIN' || activeProfile?.role === 'ADMIN');
    const isCreatorOnlyScope = !isSuperAdmin || parsed.scope === 'creator_only';

    let restoredCampaignsCount = 0;
    let restoredTxnCount = 0;
    let restoredMembersCount = 0;
    let restoredExpensesCount = 0;

    if (isCreatorOnlyScope) {
      // -------------------------------------------------------------
      // CREATOR-SCOPED RESTORE: PROTECT ALL OTHER CREATORS' DATA!
      // Merges only this creator's campaigns, transactions, members & expenses.
      // NEVER overwrites or wipes other creators' Bawms!
      // -------------------------------------------------------------
      const incomingCampaigns: Campaign[] = Array.isArray(data.campaigns) ? data.campaigns : [];
      const currentCampaigns = getStoredCampaigns();
      const incomingCampMap = new Map(incomingCampaigns.map(c => [String(c.id).toLowerCase().trim(), c]));

      // 1. Merge campaigns: update matching, keep all existing ones from other creators
      const mergedCampaigns = currentCampaigns.map(c => {
        const clean = String(c.id).toLowerCase().trim();
        if (incomingCampMap.has(clean)) {
          return incomingCampMap.get(clean)!;
        }
        return c;
      });
      const existingIds = new Set(currentCampaigns.map(c => String(c.id).toLowerCase().trim()));
      incomingCampaigns.forEach(c => {
        if (!existingIds.has(String(c.id).toLowerCase().trim())) {
          mergedCampaigns.push(c);
        }
      });
      saveStoredCampaigns(mergedCampaigns);
      restoredCampaignsCount = incomingCampaigns.length;

      // 2. Merge transactions: merge incoming into existing transactions without losing others
      const incomingTx: Transaction[] = Array.isArray(data.transactions) ? data.transactions : [];
      const existingTx = getStoredTransactions();
      const mergedTx = mergeTransactions(existingTx, incomingTx);
      saveStoredTransactions(mergedTx);
      restoredTxnCount = incomingTx.length;

      // 3. Merge members:
      const incomingMembers: MemberRecord[] = Array.isArray(data.members) ? data.members : [];
      const existingMembers = getMembers();
      const memMap = new Map(existingMembers.map(m => [String(m.id).toLowerCase().trim(), m]));
      incomingMembers.forEach(m => {
        if (m && m.id) memMap.set(String(m.id).toLowerCase().trim(), m);
      });
      const mergedMembers = Array.from(memMap.values());
      saveMembers(mergedMembers);
      restoredMembersCount = incomingMembers.length;

      // 4. Merge expenses:
      const incomingExpenses: KumtluangExpense[] = Array.isArray(data.expenses) ? data.expenses : [];
      const existingExpenses = getStoredExpenses();
      const expMap = new Map(existingExpenses.map(e => [String(e.id).toLowerCase().trim(), e]));
      incomingExpenses.forEach(e => {
        if (e && e.id) expMap.set(String(e.id).toLowerCase().trim(), e);
      });
      const mergedExpenses = Array.from(expMap.values());
      saveStoredExpenses(mergedExpenses);
      restoredExpensesCount = incomingExpenses.length;

      // Sync only the merged data to server
      safeApiFetch('/api/data/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaigns: incomingCampaigns,
          transactions: incomingTx,
          members: incomingMembers,
          expenses: incomingExpenses,
        })
      }).catch(() => {});

      recordAuditLog(
        'Creator Backup Restored',
        `Creator ${activeProfile?.name || 'User'} restored their personal backup: ${incomingTx.length} transactions, ${incomingCampaigns.length} campaigns. Other creators preserved intact.`,
        'system'
      );

      return {
        success: true,
        counts: {
          campaigns: restoredCampaignsCount,
          transactions: restoredTxnCount,
          members: restoredMembersCount,
          expenses: restoredExpensesCount,
          creators: 1,
        }
      };
    }

    // Full system restore for Super Admin
    if (Array.isArray(data.campaigns)) {
      saveStoredCampaigns(data.campaigns);
      restoredCampaignsCount = data.campaigns.length;
    }
    if (Array.isArray(data.transactions)) {
      saveStoredTransactions(data.transactions);
      restoredTxnCount = data.transactions.length;
    }
    if (Array.isArray(data.members)) {
      saveMembers(data.members);
      restoredMembersCount = data.members.length;
    }
    if (Array.isArray(data.expenses)) {
      saveStoredExpenses(data.expenses);
      restoredExpensesCount = data.expenses.length;
    }
    if (Array.isArray(data.staffAccounts)) {
      saveStoredStaffAccounts(data.staffAccounts);
    }
    if (Array.isArray(data.creatorsList)) {
      saveStoredCreatorsList(data.creatorsList);
    } else if (Array.isArray(data.creators)) {
      saveStoredCreatorsList(data.creators);
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

    // Sync restored payload to server
    safeApiFetch('/api/data/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        campaigns: data.campaigns,
        transactions: data.transactions,
        members: data.members,
        expenses: data.expenses,
        staffAccounts: data.staffAccounts,
        creators: data.creatorsList || data.creators
      })
    }).catch(() => {});

    recordAuditLog(
      'Database Restored from Backup',
      `Restored snapshot: ${restoredTxnCount} transactions, ${restoredCampaignsCount} campaigns, ${restoredMembersCount} members, ${restoredExpensesCount} expenses.`,
      'system'
    );

    return {
      success: true,
      counts: {
        campaigns: restoredCampaignsCount,
        transactions: restoredTxnCount,
        members: restoredMembersCount,
        expenses: restoredExpensesCount,
        creators: (data.creatorsList?.length || data.creators?.length) || 0,
      }
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'JSON parsing failure.' };
  }
};

export const INITIAL_DEFAULT_MEMBERS: MemberRecord[] = [
  {
    id: 'EBEZBK-4998',
    campaignId: 'cmp-kumtluang-1',
    name: 'Dr. Zoramthanga Fanai',
    orgCode: 'EBEZBK',
    phoneLast4: '4998',
    fullPhone: '6346664998',
    phone: '6346664998',
    section: 'Bial No I',
    isFamilyHead: true,
    dependents: [],
    createdAt: '2026-11-09T08:13:29.594Z'
  },
  {
    id: 'EBEZBK-8670',
    campaignId: 'cmp-kumtluang-1',
    name: 'Tholeha Chhakchhuak',
    orgCode: 'EBEZBK',
    phoneLast4: '8670',
    fullPhone: '8974908670',
    phone: '8974908670',
    section: 'Bial No I',
    isFamilyHead: true,
    dependents: [],
    createdAt: '2026-11-09T08:13:28.597Z'
  },
  {
    id: 'EBEZBK-2862',
    campaignId: 'cmp-kumtluang-1',
    name: 'Lalduhawma Fana',
    orgCode: 'EBEZBK',
    phoneLast4: '2862',
    fullPhone: '4332542862',
    phone: '4332542862',
    section: 'Bial No II',
    isFamilyHead: true,
    dependents: [],
    createdAt: '2026-11-01T17:28:22.457Z'
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
  {
    id: 'YMAVT-7654',
    campaignId: 'cmp-1787829303143',
    name: 'Kailiana Biakthuama',
    orgCode: 'YMAVT',
    phoneLast4: '7654',
    fullPhone: '9878987654',
    section: 'Zampuimanga',
    isFamilyHead: true,
    dependents: [],
    createdAt: '2026-08-26T00:00:00.000Z',
    status: 'paid'
  },
  {
    id: 'YMAVT-3933',
    campaignId: 'cmp-1787829303143',
    name: 'Rinmawia Lalsiama',
    orgCode: 'YMAVT',
    phoneLast4: '3933',
    fullPhone: '8768373933',
    section: 'Chawngbawla',
    isFamilyHead: true,
    dependents: [],
    createdAt: '2026-08-26T00:00:00.000Z',
    status: 'paid'
  },
  // --- BMP Shillong (cmp-1788107291420) Member Roll ---
  {
    id: 'BMPSHL-1718',
    campaignId: 'cmp-1788107291420',
    name: 'J Lalsangliana',
    orgCode: 'BMPSHL',
    phoneLast4: '1718',
    fullPhone: '',
    section: 'Shillong Unit',
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
    section: 'Shillong Unit',
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
    section: 'Shillong Unit',
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
    section: 'Shillong Unit',
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
    section: 'Shillong Unit',
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
    section: 'Shillong Unit',
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
    section: 'Shillong Unit',
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
    section: 'Shillong Unit',
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
    section: 'Shillong Unit',
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
    section: 'Shillong Unit',
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
    section: 'Shillong Unit',
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
    section: 'Shillong Unit',
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
    section: 'Shillong Unit',
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
    section: 'Shillong Unit',
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
    section: 'Shillong Unit',
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
    section: 'Shillong Unit',
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
    section: 'Shillong Unit',
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
    section: 'Shillong Unit',
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
    section: 'Shillong Unit',
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
    section: 'Shillong Unit',
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
    section: 'Shillong Unit',
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
    section: 'Shillong Unit',
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
    section: 'Shillong Unit',
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
    section: 'Shillong Unit',
    isFamilyHead: true,
    dependents: [],
    createdAt: '2026-08-31T11:33:22.166Z',
    status: 'paid'
  },
  {
    id: 'BMPSHL-6709',
    campaignId: 'cmp-1788107291420',
    name: 'Lalkhawmuana',
    orgCode: 'BMPSHL',
    phoneLast4: '6709',
    fullPhone: '',
    section: 'Shillong Unit',
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
    const deletedMemIds = getDeletedMemberIds();
    const PERMANENTLY_PURGED_MEMBERS = new Set(['bmpshl-1253', 'bmpshl-9000', 'bmpshl-9001']);
    const isExcluded = (id?: string, name?: string) => {
      if (!id) return true;
      const clean = String(id).toLowerCase().trim();
      const altClean = clean.startsWith('ebe-') ? 'bcm-' + clean.substring(4) : (clean.startsWith('bcm-') ? 'ebe-' + clean.substring(4) : clean);
      if (PERMANENTLY_PURGED_MEMBERS.has(clean) || PERMANENTLY_PURGED_MEMBERS.has(altClean) || deletedMemIds.has(clean) || deletedMemIds.has(altClean)) return true;
      if (name !== undefined) {
        const cleanName = String(name || '').trim();
        if (cleanName.length <= 1) return true;
      }
      return false;
    };

    let storedMembers: MemberRecord[] = [];
    const raw = localStorage.getItem(MEMBERS_LIST_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        storedMembers = parsed.filter(m => {
          if (!m || !m.id) return false;
          const cleanName = String(m.name || m.fullName || '').trim();
          if (cleanName.length <= 1) {
            markMemberAsDeleted(m.id);
            return false;
          }
          return !isExcluded(m.id, cleanName);
        });
      }
    }

    // Merge default initial members with stored members (excluding deleted)
    const map = new Map<string, MemberRecord>();
    // 1. First add stored members so user edits take absolute priority and are never overwritten by seed defaults
    for (const m of storedMembers) {
      if (m && m.id && !isExcluded(m.id, m.name)) {
        const k = m.id.toLowerCase().trim();
        const resolvedCampaignId = m.campaignId === 'cmp-kumtluang-ymavt' ? 'cmp-1787829303143' : (m.campaignId || '');
        map.set(k, { ...m, campaignId: resolvedCampaignId });
      }
    }
    // 2. Then add initial default members ONLY if storedMembers is empty
    if (storedMembers.length === 0) {
      for (const m of INITIAL_DEFAULT_MEMBERS) {
        if (m && m.id && !isExcluded(m.id, m.name)) {
          const k = m.id.toLowerCase().trim();
          if (!map.has(k)) {
            map.set(k, m);
          }
        }
      }
    }


    const campaignsForSync = getStoredCampaigns();
    const campOrgMap = new Map<string, Campaign>();
    campaignsForSync.forEach(c => {
      if (c && c.id) campOrgMap.set(c.id, c);
    });

    const allMembers = Array.from(map.values()).map(m => {
      if (!m || !m.id) return m;
      const rawId = String(m.id);

      // Auto-resolve legacy campaign aliases
      if (m.campaignId === 'cmp-kumtluang-ymavt') {
        m.campaignId = 'cmp-1787829303143';
      }

      // Dynamic campaign Pawl Code (orgCode) auto-alignment for ALL campaigns:
      if (m.campaignId && campOrgMap.has(m.campaignId)) {
        const camp = campOrgMap.get(m.campaignId);
        if (camp && camp.orgCode) {
          const campCode = String(camp.orgCode).trim().toUpperCase();
          m.orgCode = campCode;

          if (m.id && m.id.includes('-')) {
            const parts = m.id.split('-');
            const currentPrefix = parts[0].toUpperCase();
            if (currentPrefix !== campCode) {
              const suffix = parts.slice(1).join('-');
              m.id = `${campCode}-${suffix}`;
            }
          } else if (m.id) {
            const suffix = m.phoneLast4 || m.id.slice(-4);
            m.id = `${campCode}-${suffix}`;
          }

          if (m.primaryId && m.primaryId.includes('-')) {
            const parts = m.primaryId.split('-');
            const currentPrefix = parts[0].toUpperCase();
            if (currentPrefix !== campCode) {
              const suffix = parts.slice(1).join('-');
              m.primaryId = `${campCode}-${suffix}`;
            }
          }

          if (m.dependents && Array.isArray(m.dependents)) {
            m.dependents = m.dependents.map((dep, depIdx) => {
              if (!dep) return dep;
              if (dep.subId) {
                const subParts = dep.subId.split('-');
                if (subParts[0].toUpperCase() !== campCode) {
                  const depSuffix = subParts.slice(2).join('-') || subParts.slice(1).join('-') || `${depIdx + 1}`.padStart(2, '0');
                  return {
                    ...dep,
                    subId: `${m.id}-${depSuffix}`
                  };
                }
              }
              return dep;
            });
          }
        }
      }

      return m;
    }).filter(m => {
      if (!m || !m.id) return false;
      const cleanId = String(m.id).toLowerCase().trim();
      const cleanName = String(m.name || (m as any).fullName || '').trim();
      if (cleanName.length <= 1) return false;
      return !deletedMemIds.has(cleanId);
    });

    // Assign default section for BMP Shillong members only if completely unassigned
    allMembers.forEach(m => {
      if (m.campaignId === 'cmp-1788107291420' || m.orgCode === 'BMPSHL' || String(m.id).startsWith('BMPSHL-')) {
        if (!m.section || m.section.trim() === '') {
          m.section = 'Shillong Unit';
        }
      }
    });

    // Ensure strict deduplication and normalization of member IDs across all members
    // NEVER generate synthetic repeated suffixes like ${prefix}-${suffix}-${idx + 1}
    const uniqueMap = new Map<string, MemberRecord>();
    const seenPhonesByCampaign = new Map<string, string>(); // campaignKey -> canonicalId

    for (const m of allMembers) {
      if (!m || !m.id) continue;
      let rawId = String(m.id).trim();

      // Normalize any legacy multi-hyphen synthetic IDs (e.g. ZBKEBE-5544-1170 -> ZBKEBE-5544)
      const parts = rawId.split('-');
      if (parts.length > 2) {
        rawId = `${parts[0]}-${parts[1]}`;
        m.id = rawId;
      }

      const cleanId = rawId.toLowerCase().trim();
      const cleanPhone = (m.fullPhone || m.phone || '').replace(/\D/g, '').slice(-10);
      const campId = m.campaignId || 'default';
      const phoneDedupKey = cleanPhone.length >= 8 ? `${campId}_${cleanPhone}` : null;

      // Check if this member ID was already seen
      if (uniqueMap.has(cleanId)) {
        // Merge richer metadata into the existing canonical member, DO NOT create a new duplicate!
        const existing = uniqueMap.get(cleanId)!;
        uniqueMap.set(cleanId, {
          ...existing,
          fullPhone: existing.fullPhone || m.fullPhone || m.phone || '',
          phone: existing.phone || m.phone || m.fullPhone || '',
          phoneLast4: existing.phoneLast4 || m.phoneLast4 || existing.id.split('-')[1] || '',
          section: (existing.section && existing.section !== 'General' && existing.section !== 'Section A') ? existing.section : (m.section || existing.section),
          dependents: (existing.dependents && existing.dependents.length > 0) ? existing.dependents : (m.dependents || []),
          fatherName: existing.fatherName || m.fatherName,
          notes: existing.notes || m.notes,
        });
        continue;
      }

      // Check if phone was already seen in this campaign
      if (phoneDedupKey && seenPhonesByCampaign.has(phoneDedupKey)) {
        const canonicalExistingId = seenPhonesByCampaign.get(phoneDedupKey)!;
        const existing = uniqueMap.get(canonicalExistingId);
        if (existing) {
          // Merge into existing record with the same phone in this campaign
          uniqueMap.set(canonicalExistingId, {
            ...existing,
            dependents: (existing.dependents && existing.dependents.length > 0) ? existing.dependents : (m.dependents || []),
            section: (existing.section && existing.section !== 'General' && existing.section !== 'Section A') ? existing.section : (m.section || existing.section),
            notes: existing.notes || m.notes,
          });
          continue;
        }
      }

      if (phoneDedupKey) {
        seenPhonesByCampaign.set(phoneDedupKey, cleanId);
      }
      uniqueMap.set(cleanId, m);
    }
    const uniqueMembers = Array.from(uniqueMap.values());

    if (!campaignId || campaignId === 'all') {
      return uniqueMembers;
    }

    // Filter strictly by campaignId, orgCode, or prefix
    const campaigns = getStoredCampaigns();
    const targetCampaign = campaigns.find(c => c.id === campaignId);

    return uniqueMembers.filter(m => {
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
      if (['EBE', 'ZBKEBE', 'EBEZBK', 'BCM'].includes(m.orgCode || '') && campaignId === 'cmp-kumtluang-1') return true;
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

let memberSupabaseSyncTimer: any = null;
function debouncedSyncMembersToSupabase(): void {
  if (memberSupabaseSyncTimer) clearTimeout(memberSupabaseSyncTimer);
  memberSupabaseSyncTimer = setTimeout(() => {
    import('../services/supabaseService').then(({ syncAllMembersToSupabase }) => {
      syncAllMembersToSupabase().catch(() => {});
    }).catch(() => {});
  }, 400);
}

export const saveMembers = (members: MemberRecord[], skipServerPush: boolean = false): void => {
  try {
    localStorage.setItem(MEMBERS_LIST_KEY, JSON.stringify(members));
    
    // Broadcast instant sync events to all components & windows
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ronpay-members-updated', { detail: members }));
      window.dispatchEvent(new CustomEvent('ronpay_members_updated', { detail: members }));
      broadcastTabSync('members', members);
    }

    if (!skipServerPush) {
      safeApiFetch('/api/data/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ members })
      }).catch(() => {});

      // Only push to Supabase when locally modified (not when saving remote members from Supabase/Server)
      debouncedSyncMembersToSupabase();
    }
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

export const addOrUpdateMember = async (
  member: MemberRecord,
  oldId?: string,
  previousNameInput?: string,
  previousSectionInput?: string
): Promise<boolean> => {
  const campaigns = getStoredCampaigns();
  const ebeCamp = campaigns.find(c => c.id === 'cmp-kumtluang-1' || String(c.title).toLowerCase().includes('bcm ebenezer'));
  const currentEbeOrg = (ebeCamp && ebeCamp.orgCode) ? ebeCamp.orgCode.trim().toUpperCase() : 'ZBKEBE';

  const isEbe = (
    member.campaignId === 'cmp-kumtluang-1' ||
    member.orgCode === currentEbeOrg ||
    member.orgCode === 'EBE' ||
    member.orgCode === 'BCM' ||
    member.orgCode === 'ZBKEBE' ||
    member.orgCode === 'EBEZBK' ||
    (member.id && (
      member.id.toUpperCase().startsWith(currentEbeOrg + '-') ||
      member.id.toUpperCase().startsWith('ZBKEBE-') ||
      member.id.toUpperCase().startsWith('EBEZBK-') ||
      member.id.toUpperCase().startsWith('BCM-') ||
      member.id.toUpperCase().startsWith('EBE-')
    ))
  );

  const targetCampaignId = isEbe ? 'cmp-kumtluang-1' : (member.campaignId || 'cmp-kumtluang-1');
  const matchedCamp = campaigns.find(c => c.id === targetCampaignId);
  const targetOrg = member.orgCode || (isEbe ? currentEbeOrg : (matchedCamp?.orgCode || 'ZBKEBE'));

  const stamped: MemberRecord = {
    ...member,
    campaignId: targetCampaignId,
    orgCode: targetOrg,
    createdAt: member.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  if (stamped.id && stamped.id.split('-').length > 2) {
    const parts = stamped.id.split('-');
    stamped.id = `${parts[0]}-${parts[1]}`;
  }

  // Clear tombstone deletions for both oldId and new id to prevent deletion resurrection filters
  if (oldId) clearDeletedMemberId(oldId);
  if (stamped.id) clearDeletedMemberId(stamped.id);

  const allList = getMembers(); // Load all members across all Bawms
  const targetId = (oldId || stamped.id || '').trim().toLowerCase();
  const cleanNewId = (stamped.id || '').trim().toLowerCase();
  const cleanPhone = (stamped.fullPhone || stamped.phone || '').replace(/\D/g, '').slice(-10);

  const idx = allList.findIndex(m => {
    const mClean = (m.id || '').trim().toLowerCase();
    const mPhone = (m.fullPhone || m.phone || '').replace(/\D/g, '').slice(-10);
    const samePhone = cleanPhone.length >= 8 && mPhone === cleanPhone && (m.campaignId === stamped.campaignId || m.orgCode === stamped.orgCode);
    return mClean === targetId || mClean === cleanNewId || samePhone;
  });

  let previousName = (previousNameInput || '').trim().toLowerCase();
  let previousSection = (previousSectionInput || '').trim();
  if (idx >= 0) {
    if (!previousName) previousName = (allList[idx].name || '').trim().toLowerCase();
    if (!previousSection) previousSection = (allList[idx].section || '').trim();
    allList[idx] = { ...allList[idx], ...stamped };
  } else {
    allList.unshift(stamped);
  }
  saveMembers(allList);

  if (stamped && stamped.id) {
    syncMemberToFirestore(stamped).catch(() => {});
  }

  // 1. Immediately execute direct Supabase UPDATE / UPSERT
  let supabaseSuccess = false;
  try {
    const { updateSupabaseMember } = await import('../services/supabaseService');
    supabaseSuccess = await updateSupabaseMember(stamped, oldId);
  } catch (sbErr) {
    console.warn('[Supabase Direct Member Update Warning]:', sbErr);
  }

  // 2. Sync to backend API endpoints
  safeApiFetch('/api/members', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...stamped, oldId, _oldId: oldId })
  }).catch(() => {});

  safeApiFetch('/api/data/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ members: [{ ...stamped, oldId, _oldId: oldId }] })
  }).catch(() => {});

  // 3. Propagate updated member name / section to local transactions, backend, and Supabase
  try {
    const txs = getStoredTransactions();
    const changedTxs: Transaction[] = [];
    const matchId = (oldId || stamped.id).trim().toLowerCase();
    const altMatchId = matchId.startsWith('ebe-') ? 'bcm-' + matchId.slice(4) : (matchId.startsWith('bcm-') ? 'ebe-' + matchId.slice(4) : matchId);
    const targetCampId = (stamped.campaignId || '').trim().toLowerCase();
    const nowIso = new Date().toISOString();

    const newSectionVal = stamped.section !== undefined ? (stamped.section || '') : '';

    txs.forEach(t => {
      if (!t || !t.id) return;
      const tMid = (t.memberId || '').trim().toLowerCase();
      const tSubId = (t.subId || '').trim().toLowerCase();
      const tCamp = (t.campaignId || '').trim().toLowerCase();
      const tName = (t.donorName || '').trim().toLowerCase();
      const tPhone = (t.donorPhone || '').replace(/\D/g, '').slice(-10);

      // Match 1: Member ID exact or prefix match (including dependent subIds)
      const isIdMatch = Boolean(
        matchId && (
          tMid === matchId ||
          tMid === cleanNewId ||
          tMid === altMatchId ||
          tMid.startsWith(matchId + '-') ||
          tMid.startsWith(cleanNewId + '-') ||
          tSubId.startsWith(matchId) ||
          tSubId.startsWith(cleanNewId)
        )
      );

      // Match 2: Same campaign & donor name matches member's previous name or new name
      const isSameCampNameMatch = Boolean(
        targetCampId &&
        (!tCamp || tCamp === targetCampId) &&
        previousName &&
        (tName === previousName || (tMid && (tMid === matchId || tMid === cleanNewId)))
      );

      // Match 3: Same campaign & clean phone match
      const isSameCampPhoneMatch = Boolean(
        targetCampId &&
        (!tCamp || tCamp === targetCampId) &&
        cleanPhone.length >= 8 &&
        tPhone === cleanPhone &&
        (!previousName || tName === previousName || tName === stamped.name.toLowerCase().trim())
      );

      if (isIdMatch || isSameCampNameMatch || isSameCampPhoneMatch) {
        const updatedTx: Transaction = {
          ...t,
          memberId: stamped.id || t.memberId,
          donorName: stamped.name || t.donorName,
          donorVeng: newSectionVal || t.donorVeng || '',
          section: newSectionVal || (t as any).section || '',
          isSynced: false,
          updatedAt: nowIso,
          ...((t as any).metadata ? {
            metadata: {
              ...((t as any).metadata || {}),
              donorName: stamped.name || t.donorName,
              donorVeng: newSectionVal || t.donorVeng || '',
              section: newSectionVal || (t as any).section || ''
            }
          } : {})
        } as Transaction;
        changedTxs.push(updatedTx);
      }
    });

    if (changedTxs.length > 0) {
      saveMultipleTransactions(changedTxs);

      // Push updated transactions directly to Supabase
      import('../services/supabaseService').then(({ updateSupabaseTransactionsForMember }) => {
        updateSupabaseTransactionsForMember(
          stamped.id,
          oldId,
          stamped.name,
          stamped.section,
          changedTxs.map(t => t.id)
        ).catch(() => {});
      }).catch(() => {});
    }
  } catch (txPropErr) {
    console.warn('Transaction member info propagation note:', txPropErr);
  }

  // 4. Broadcast instant multi-device / multi-tab synchronization
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('ronpay-members-updated', { detail: allList }));
    window.dispatchEvent(new CustomEvent('ronpay_members_updated', { detail: allList }));
    window.dispatchEvent(new CustomEvent('ronpay_state_sync_event', { detail: { type: 'member_updated', member: stamped, previousName, previousSection } }));
    broadcastTabSync('members', allList);
  }

  return supabaseSuccess;
};

export const deleteMember = (memberId: string, campaignId?: string): void => {
  if (!memberId) return;
  const cleanMid = (memberId || '').trim();
  const lowerMid = cleanMid.toLowerCase();
  const upperMid = cleanMid.toUpperCase();
  const altLowerMid = lowerMid.startsWith('ebe-') ? 'bcm-' + lowerMid.substring(4) : (lowerMid.startsWith('bcm-') ? 'ebe-' + lowerMid.substring(4) : lowerMid);

  // 1. Mark as deleted in tombstones (both primary, lowercase, uppercase, and alternate prefixes)
  markMemberAsDeleted(cleanMid);
  markMemberAsDeleted(lowerMid);
  markMemberAsDeleted(upperMid);
  markMemberAsDeleted(altLowerMid);

  // 2. Filter local storage immediately (including dependents)
  const allList = getMembers();
  const filtered = allList.filter(m => {
    if (!m || !m.id) return false;
    const mClean = m.id.toLowerCase().trim();
    if (mClean === lowerMid || mClean === altLowerMid || mClean.startsWith(lowerMid + '-')) return false;
    return true;
  });
  saveMembers(filtered);

  // 3. Remove from Firestore & Supabase
  deleteMemberFromFirestore(cleanMid).catch(() => {});
  deleteMemberFromFirestore(altLowerMid).catch(() => {});
  import('../services/supabaseService').then(({ deleteSupabaseMember }) => {
    deleteSupabaseMember(cleanMid).catch(() => {});
    deleteSupabaseMember(lowerMid).catch(() => {});
    deleteSupabaseMember(upperMid).catch(() => {});
    deleteSupabaseMember(altLowerMid).catch(() => {});
  }).catch(() => {});

  // 4. Send DELETE request to backend API
  safeApiFetch(`/api/members/${encodeURIComponent(cleanMid)}`, {
    method: 'DELETE'
  }).catch(() => {});
  safeApiFetch(`/api/members/${encodeURIComponent(altLowerMid)}`, {
    method: 'DELETE'
  }).catch(() => {});
  safeApiFetch('/api/data/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deletedMemberIds: [cleanMid, lowerMid, upperMid, altLowerMid] })
  }).catch(() => {});

  // 5. Broadcast instant sync to all open tabs and components
  broadcastTabSync('members', { deletedId: cleanMid });
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('ronpay-members-updated', { detail: filtered }));
    window.dispatchEvent(new CustomEvent('ronpay_members_updated', { detail: filtered }));
  }
};

export function migrateCampaignMembersPrefix(campaignId: string, oldPrefix: string, newPrefix: string): number {
  if (!campaignId || !newPrefix) return 0;
  const cleanOld = (oldPrefix || '').trim().toUpperCase();
  const cleanNew = newPrefix.trim().toUpperCase();
  if (cleanOld && cleanOld === cleanNew) return 0;

  let allMembers: MemberRecord[] = [];
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(MEMBERS_LIST_KEY) : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) allMembers = parsed;
    }
  } catch {}
  if (allMembers.length === 0) {
    allMembers = [...INITIAL_DEFAULT_MEMBERS];
  }
  let migratedCount = 0;
  const oldToNewIdMap: Record<string, string> = {};

  const migrationRecords: Array<{ member: MemberRecord; oldId: string }> = [];

  const updatedMembers = allMembers.map(m => {
    if (!m) return m;
    const mIdUpper = String(m.id || '').toUpperCase();
    const mOrgUpper = String(m.orgCode || '').toUpperCase();
    const isThisCampaign =
      m.campaignId === campaignId ||
      (!m.campaignId && cleanOld && (mOrgUpper === cleanOld || mIdUpper.startsWith(cleanOld + '-'))) ||
      (cleanOld && mOrgUpper === cleanOld) ||
      (cleanOld && mIdUpper.startsWith(cleanOld + '-')) ||
      (campaignId === 'cmp-kumtluang-1' && (
        ['ZBKEBE', 'EBEZBK', 'BCM', 'EBE'].includes(mOrgUpper) ||
        ['ZBKEBE-', 'EBEZBK-', 'BCM-', 'EBE-'].some(pfx => mIdUpper.startsWith(pfx))
      ));

    if (isThisCampaign) {
      const oldId = m.id;
      let suffix = '';
      if (m.id && m.id.includes('-')) {
        const parts = m.id.split('-');
        suffix = parts.length > 2 ? parts[1] : parts.slice(1).join('-');
      } else if (m.phoneLast4) {
        suffix = m.phoneLast4;
      } else if (m.id) {
        suffix = m.id.slice(-4);
      } else {
        suffix = '0000';
      }

      const newId = `${cleanNew}-${suffix}`;
      if (oldId && oldId !== newId) {
        oldToNewIdMap[oldId.toLowerCase()] = newId;
        oldToNewIdMap[oldId] = newId;
        clearDeletedMemberId(oldId);
        clearDeletedMemberId(newId);
      }

      // Update dependents subIds to match new parent ID
      const updatedDependents = (m.dependents || []).map((dep, depIdx) => {
        if (!dep) return dep;
        const depOldSubId = dep.subId || '';
        let depSuffix = '';
        if (depOldSubId.includes('-')) {
          const parts = depOldSubId.split('-');
          depSuffix = parts.slice(2).join('-') || parts.slice(1).join('-') || `${(depIdx + 1).toString().padStart(2, '0')}`;
        } else {
          depSuffix = `${(depIdx + 1).toString().padStart(2, '0')}`;
        }
        const newSubId = `${newId}-${depSuffix}`;
        if (depOldSubId && depOldSubId !== newSubId) {
          oldToNewIdMap[depOldSubId.toLowerCase()] = newSubId;
          oldToNewIdMap[depOldSubId] = newSubId;
          clearDeletedMemberId(depOldSubId);
          clearDeletedMemberId(newSubId);
        }
        return {
          ...dep,
          subId: newSubId
        };
      });

      migratedCount++;
      const updatedMem: MemberRecord = {
        ...m,
        campaignId,
        orgCode: cleanNew,
        id: newId,
        primaryId: m.primaryId && oldToNewIdMap[m.primaryId] ? oldToNewIdMap[m.primaryId] : (m.primaryId ? `${cleanNew}-${m.primaryId.split('-').slice(1).join('-')}` : undefined),
        dependents: updatedDependents,
        updatedAt: new Date().toISOString()
      };
      if (oldId) {
        migrationRecords.push({ member: updatedMem, oldId });
      }
      return updatedMem;
    }
    return m;
  });

  if (migratedCount > 0) {
    saveMembers(updatedMembers);

    // Sync member updates and cleanup old ghost records in Supabase
    try {
      migrationRecords.forEach(({ member, oldId }) => {
        updateSupabaseMember(member, oldId).catch(() => {});
        if (oldId && oldId !== member.id) {
          deleteSupabaseMember(oldId).catch(() => {});
        }
      });
      import('../services/supabaseService').then(({ syncAllMembersToSupabase, purgeLegacySupabaseMembers }) => {
        syncAllMembersToSupabase().then(() => purgeLegacySupabaseMembers()).catch(() => {});
      }).catch(() => {});
    } catch (supErr) {
      console.warn('Supabase member prefix migration sync note:', supErr);
    }

    // 1. Update ronpay_group_memberships_v1
    try {
      const rawGMs = typeof localStorage !== 'undefined' ? localStorage.getItem('ronpay_group_memberships_v1') : null;
      if (rawGMs) {
        const parsedGMs = JSON.parse(rawGMs);
        if (Array.isArray(parsedGMs)) {
          let gmsChanged = false;
          const updatedGMs = parsedGMs.map((gm: any) => {
            if (!gm) return gm;
            const matchesCamp = gm.campaignId === campaignId || (cleanOld && gm.orgCode?.toUpperCase() === cleanOld);
            if (matchesCamp) {
              gmsChanged = true;
              let newGmMemberId = gm.memberId;
              if (gm.memberId && oldToNewIdMap[gm.memberId.toLowerCase()]) {
                newGmMemberId = oldToNewIdMap[gm.memberId.toLowerCase()];
              } else if (gm.memberId && gm.memberId.includes('-')) {
                const s = gm.memberId.split('-').slice(1).join('-');
                newGmMemberId = `${cleanNew}-${s}`;
              } else if (gm.userPhone) {
                newGmMemberId = `${cleanNew}-${gm.userPhone.slice(-4)}`;
              }
              return {
                ...gm,
                campaignId,
                orgCode: cleanNew,
                memberId: newGmMemberId,
                updatedAt: new Date().toISOString()
              };
            }
            return gm;
          });

          if (gmsChanged) {
            localStorage.setItem('ronpay_group_memberships_v1', JSON.stringify(updatedGMs));
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('ronpay_group_memberships_updated', { detail: updatedGMs }));
              window.dispatchEvent(new CustomEvent('ronpay-group-memberships-updated', { detail: updatedGMs }));
            }
          }
        }
      }
    } catch (gmErr) {
      console.warn('Group membership migration note:', gmErr);
    }

    // 2. Update ronpay_transactions_v4
    try {
      const txs = getStoredTransactions();
      let txsChanged = false;
      const updatedTxs = txs.map(tx => {
        if (!tx) return tx;
        const matchesCamp = tx.campaignId === campaignId;
        const oldMidLower = (tx.memberId || '').trim().toLowerCase();
        if (oldMidLower && oldToNewIdMap[oldMidLower]) {
          txsChanged = true;
          return {
            ...tx,
            memberId: oldToNewIdMap[oldMidLower],
            updatedAt: new Date().toISOString()
          };
        } else if (matchesCamp && tx.memberId && cleanOld && tx.memberId.toUpperCase().startsWith(cleanOld + '-')) {
          txsChanged = true;
          const s = tx.memberId.split('-').slice(1).join('-');
          return {
            ...tx,
            memberId: `${cleanNew}-${s}`,
            updatedAt: new Date().toISOString()
          };
        }
        return tx;
      });

      if (txsChanged) {
        saveStoredTransactions(updatedTxs, false);
      }
    } catch (txErr) {
      console.warn('Transaction memberId migration note:', txErr);
    }

    // 3. Log audit event
    recordAuditLog(
      'Pawl Code Auto-Migrated',
      `Campaign ${campaignId} Pawl Code changed from [${cleanOld || 'N/A'}] to [${cleanNew}]. Auto-migrated ${migratedCount} members, memberships, and transactions.`,
      'campaign',
      campaignId
    );
  }

  return migratedCount;
}

export const saveTransaction = (tx: Transaction): void => {
  if (!tx || !tx.id) return;
  const nowIso = new Date().toISOString();
  if (!tx.createdAt) tx.createdAt = nowIso;
  tx.updatedAt = nowIso;
  if (!tx.timestamp) tx.timestamp = nowIso;
  if (!tx.date) tx.date = nowIso.slice(0, 10);

  // Guarantee banking UTR and receipt hash for complete record validity
  if (!tx.utr) {
    tx.utr = 'UTR' + Math.floor(100000000000 + Math.random() * 900000000000);
  }
  if (!tx.referenceNo) {
    tx.referenceNo = tx.utr;
  }
  if (!tx.txHash) {
    tx.txHash = 'RPAY' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 6).toUpperCase();
  }
  if (!tx.paymentMethod) {
    tx.paymentMethod = 'online';
  }

  const isBill = Boolean(tx.billServiceType || tx.billConsumerNumber || tx.billOperator) ||
    String(tx.id || '').startsWith('BILL-') || 
    String(tx.id || '').startsWith('TXN-BILL-') || 
    String(tx.campaignId || '').startsWith('bill-');

  if (!isBill) {
    // Canonical member enrichment if memberId or donorPhone is set
    try {
      const mems = getMembers();
      let matchedMem = null;
      if (tx.memberId) {
        matchedMem = mems.find(m => m.id && m.id.toLowerCase().trim() === tx.memberId!.toLowerCase().trim());
      }
      if (!matchedMem && tx.donorPhone) {
        const cleanP = tx.donorPhone.replace(/\D/g, '').slice(-10);
        if (cleanP.length === 10) {
          matchedMem = mems.find(m => {
            const p = m.fullPhone || m.phone;
            return p && p.replace(/\D/g, '').slice(-10) === cleanP;
          });
        }
      }
      if (matchedMem) {
        if (!tx.memberId) {
          tx.memberId = matchedMem.id;
        }
        if (!tx.donorName || tx.donorName === 'Valued Donor' || tx.donorName === 'Anonymous') {
          if (!tx.isAnonymous) {
            tx.donorName = matchedMem.name;
          }
        }
        const memPhone = matchedMem.fullPhone || matchedMem.phone;
        if (!tx.donorPhone && memPhone) {
          tx.donorPhone = memPhone;
        }
        if (!tx.donorVeng && (matchedMem.section || (matchedMem as any).veng || (matchedMem as any).address)) {
          tx.donorVeng = matchedMem.section || (matchedMem as any).veng || (matchedMem as any).address;
        }
        if (!tx.donorType) {
          tx.donorType = 'member';
        }
      }
    } catch (e) {}

    // Resolve campaign title and category if needed from stored campaigns
    if (!tx.campaignTitle || tx.campaignTitle === 'RonPay Community Bawm' || !tx.category) {
      try {
        const camps = getStoredCampaigns();
        const camp = camps.find(c => c && String(c.id).toLowerCase().trim() === String(tx.campaignId).toLowerCase().trim());
        if (camp) {
          if (!tx.campaignTitle || tx.campaignTitle === 'RonPay Community Bawm') {
            tx.campaignTitle = camp.title;
          }
          if (!tx.category) {
            tx.category = camp.category;
          }
          if (!tx.donorVeng && camp.location) {
            tx.donorVeng = camp.location;
          }
        }
      } catch {}
    }

    // Ensure subCategory and subCategoryBreakdown consistency
    if (tx.subCategoryBreakdown && Object.keys(tx.subCategoryBreakdown).length > 0) {
      if (!tx.subCategory) {
        tx.subCategory = Object.keys(tx.subCategoryBreakdown)[0];
      }
    } else if (tx.subCategory) {
      tx.subCategoryBreakdown = { [tx.subCategory]: tx.amount };
    }

    const titleL = String(tx.campaignTitle || '').toLowerCase();
    const cleanTitle = titleL.replace(/,+$/, '').trim();
    const isBmp = tx.campaignId === 'cmp-1788107291420' || cleanTitle.includes('bmp') || cleanTitle.includes('shillong') || (tx.memberId && tx.memberId.startsWith('BMPSHL'));
    
    if (isBmp) {
      tx.category = 'kumtluang';
      tx.campaignId = 'cmp-1788107291420';
      tx.campaignTitle = 'BMP Shillong';
      if (!tx.donorVeng) {
        tx.donorVeng = 'Shillong Unit';
      }
      if (!tx.subCategory) {
        tx.subCategory = tx.donorType === 'general' ? (tx.remark || 'General Thawhlawm') : 'BMP Fund';
      }
      if (!tx.subCategoryBreakdown || Object.keys(tx.subCategoryBreakdown).length === 0) {
        const subKey = tx.subCategory || 'BMP Fund';
        tx.subCategoryBreakdown = { [subKey]: tx.amount };
      }
      if (tx.remark && tx.remark.includes('[Pathian Ram Zauna]')) {
        tx.remark = tx.remark.replace('[Pathian Ram Zauna]', '[BMP Fund]');
      }
    } else if (!tx.category || tx.category === 'others') {
      if (titleL.includes('ralna') || tx.campaignId === 'cmp-1788526889943') {
        tx.category = 'ralna';
      } else if (titleL.includes('rikrum') || tx.campaignId === 'cmp-1788528889947') {
        tx.category = 'rikrum';
      } else if (titleL.includes('kumtluang') || tx.campaignId === 'cmp-1788529889949' || tx.campaignId === 'cmp-1787829303143') {
        tx.category = 'kumtluang';
      } else {
        tx.category = 'khawlsak';
      }
    }
  }

  // Ensure donor name has polite fallback
  if (!tx.donorName) {
    tx.donorName = tx.isAnonymous ? 'Anonymous' : 'Valued Donor';
  }

  const cleanTxId = String(tx.id).toLowerCase().trim();

  // Normalize success status
  const rawStatus = (tx.status || '').toLowerCase().trim();
  if (rawStatus === 'payment_success' || rawStatus === 'success' || rawStatus === 'paid' || rawStatus === 'verified' || !rawStatus) {
    tx.status = 'completed';
  }

  // Preserve and accurately calculate fees and total amounts
  const numAmt = Number(tx.amount) || 0;
  const numFee = Number(tx.platformFee) || 0;
  if (tx.totalAmount === undefined || isNaN(Number(tx.totalAmount)) || Number(tx.totalAmount) <= 0) {
    tx.totalAmount = numAmt + numFee;
  }
  if (tx.campaignNetReceived === undefined || isNaN(Number(tx.campaignNetReceived))) {
    tx.campaignNetReceived = tx.feeOption === 'DEDUCT'
      ? Math.max(0, numAmt - numFee)
      : numAmt;
  }

  tx.isSynced = false;
  const current = getStoredTransactions();
  const existingTx = current.find(t => String(t.id).toLowerCase().trim() === cleanTxId);
  if (existingTx && existingTx.is_locked) {
    const isUnlocked = existingTx.unlock_expires_at && new Date(existingTx.unlock_expires_at).getTime() > Date.now();
    if (!isUnlocked && !tx.is_locked && !tx.unlock_expires_at) {
      console.warn(`[Audit Lock] Transaction ${tx.id} is locked by ${existingTx.locked_by || 'Auditor'}. Modification blocked.`);
      return;
    }
  }

  const updated = [tx, ...current.filter(t => String(t.id).toLowerCase().trim() !== cleanTxId)];
  saveStoredTransactions(updated, false);
  recordUserPaidTxId(tx.id);

  if (typeof window !== 'undefined') {
    broadcastTabSync('transactions');
    broadcastTabSync('user_paid');
    window.dispatchEvent(new CustomEvent('ronpay_transactions_updated', { detail: updated }));
    window.dispatchEvent(new CustomEvent('ronpay_user_paid_updated', { detail: getStoredUserPaidTxIds() }));
  }

  // Push to Supabase as Absolute Primary Store & mark synced
  import('../services/supabaseService').then(({ insertSupabaseTransaction }) => {
    insertSupabaseTransaction(tx).catch((err) => {
      console.warn('[Supabase] Live transaction direct insert note:', err);
    });
  }).catch(() => {});
  safeApiFetch('/api/transactions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(tx)
  }).then(async (res) => {
    if (res && res.ok) {
      tx.isSynced = true;
      try {
        const fresh = getStoredTransactions();
        const patched = fresh.map(t => String(t.id).toLowerCase().trim() === cleanTxId ? { ...t, isSynced: true } : t);
        localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(patched));
      } catch {}
    }
  }).catch(() => {});
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
    // Sync to Supabase as primary store
    import('../services/supabaseService').then(({ upsertSupabaseWallet }) => {
      upsertSupabaseWallet(wallet).catch(() => {});
    }).catch(() => {});
  } catch (e) {
    console.error('Failed to save wallet to storage', e);
  }
};

const STAFF_ACCOUNTS_KEY = 'ronpay_staff_accounts_v1';

export const getStoredStaffAccounts = (): StaffAccount[] => {
  const deletedStaffIds = getDeletedStaffIds();
  try {
    const raw = localStorage.getItem(STAFF_ACCOUNTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.filter(s => s && s.id && !deletedStaffIds.has(String(s.id).trim()));
      }
    }
  } catch (e) {
    console.error('Failed to read staff accounts from storage', e);
  }
  const defaultStaff: StaffAccount[] = [
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
  return defaultStaff.filter(s => !deletedStaffIds.has(String(s.id).trim()));
};

export const saveStoredStaffAccounts = (staffList: StaffAccount[]): void => {
  try {
    localStorage.setItem(STAFF_ACCOUNTS_KEY, JSON.stringify(staffList));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ronpay_staff_updated', { detail: staffList }));
      broadcastTabSync('staff', staffList);
    }
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
  safeApiFetch('/api/data/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ staffAccounts: updated })
  });
};

export const deleteStaffAccount = (staffId: string): void => {
  if (!staffId) return;
  const cleanId = String(staffId).trim();
  markStaffAsDeleted(cleanId);
  const current = getStoredStaffAccounts();
  const updated = current.filter(s => s.id !== cleanId);
  saveStoredStaffAccounts(updated);
  safeApiFetch(`/api/admin/staff/${encodeURIComponent(cleanId)}`, { method: 'DELETE' });
  safeApiFetch('/api/data/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deletedStaffIds: [cleanId] })
  });
  broadcastTabSync('staff', { deletedId: cleanId });
};

export const deleteStoredTransaction = (transactionId: string): void => {
  if (!transactionId) return;
  const cleanId = String(transactionId).trim();
  const current = getStoredTransactions();
  const targetTx = current.find(t => String(t.id).toLowerCase().trim() === cleanId.toLowerCase());
  if (targetTx && targetTx.is_locked) {
    const isUnlocked = targetTx.unlock_expires_at && new Date(targetTx.unlock_expires_at).getTime() > Date.now();
    if (!isUnlocked) {
      console.warn(`[Audit Lock] Cannot delete locked transaction ${transactionId}. Maker-Checker approval required.`);
      return;
    }
  }

  markTransactionAsDeleted(cleanId, false);
  
  const updated = current.filter(t => String(t.id).toLowerCase().trim() !== cleanId.toLowerCase());
  
  // Update local storage and broadcast
  try {
    localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(updated));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ronpay_transactions_updated', { detail: updated }));
    }
  } catch (e) {}

  // Delete from Supabase Primary Store & recalibrate fund pool
  import('../services/supabaseService').then(({ deleteSupabaseTransaction, recalibrateSupabaseFundPool }) => {
    deleteSupabaseTransaction(cleanId).then(() => {
      recalibrateSupabaseFundPool().catch(() => {});
    }).catch(() => {});
  }).catch(() => {});

  // Delete from Server immediately
  safeApiFetch(`/api/transactions/${encodeURIComponent(cleanId)}`, { method: 'DELETE' });
  safeApiFetch('/api/data/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deletedTransactionIds: [cleanId] })
  });
  broadcastTabSync('transactions', updated);
};

export const deleteMultipleTransactions = (transactionIds: string[]): void => {
  if (!transactionIds || transactionIds.length === 0) return;
  const cleanIds = transactionIds.map(id => String(id).trim()).filter(Boolean);
  const idSet = new Set(cleanIds.map(id => id.toLowerCase()));

  const current = getStoredTransactions();
  const targetTxs = current.filter(t => idSet.has(String(t.id).toLowerCase().trim()));

  for (const id of cleanIds) {
    markTransactionAsDeleted(id, false);
  }

  const updated = current.filter(t => !idSet.has(String(t.id).toLowerCase().trim()));

  try {
    localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(updated));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ronpay_transactions_updated', { detail: updated }));
    }
  } catch (e) {}

  // Delete from Supabase Primary Store & recalibrate fund pool
  import('../services/supabaseService').then(({ deleteMultipleSupabaseTransactions, recalibrateSupabaseFundPool }) => {
    deleteMultipleSupabaseTransactions(cleanIds).then(() => {
      recalibrateSupabaseFundPool().catch(() => {});
    }).catch(() => {});
  }).catch(() => {});

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
  broadcastTabSync('transactions', updated);
};

export const saveMultipleTransactions = (txs: Transaction[]): void => {
  if (!txs || txs.length === 0) return;
  const current = getStoredTransactions();
  const txMap = new Map<string, Transaction>();
  current.forEach(t => {
    if (t && t.id) txMap.set(String(t.id).toLowerCase().trim(), t);
  });
  
  const nowStamp = new Date().toISOString();
  txs.forEach(tx => {
    if (!tx || !tx.id) return;
    if (!tx.createdAt) tx.createdAt = nowStamp;
    tx.updatedAt = nowStamp;
    tx.isSynced = false;
    tx.totalAmount = Number(tx.amount) || 0;
    tx.campaignNetReceived = Number(tx.amount) || 0;
    
    const isBill = Boolean(tx.billServiceType || tx.billConsumerNumber || tx.billOperator) ||
      String(tx.id || '').startsWith('BILL-') || 
      String(tx.id || '').startsWith('TXN-BILL-') || 
      String(tx.campaignId || '').startsWith('bill-');

    if (!isBill) {
      if (tx.memberId && !tx.donorName) {
        try {
          const mems = getMembers(tx.campaignId);
          const mem = mems.find(m => m.id && m.id.toLowerCase().trim() === tx.memberId!.toLowerCase().trim());
          if (mem && mem.name) {
            tx.donorName = mem.name;
          }
        } catch (e) {}
      }

      const titleL = String(tx.campaignTitle || '').toLowerCase();
      const cleanTitle = titleL.replace(/,+$/, '').trim();
      const isBmp = tx.campaignId === 'cmp-1788107291420' || cleanTitle.includes('bmp') || cleanTitle.includes('shillong') || (tx.memberId && tx.memberId.startsWith('BMPSHL'));
      if (isBmp) {
        tx.category = 'kumtluang';
        tx.campaignId = 'cmp-1788107291420';
        tx.campaignTitle = 'BMP Shillong';
        if (!tx.donorVeng) {
          tx.donorVeng = 'General';
        }
        if (!tx.subCategory) {
          tx.subCategory = tx.donorType === 'general' ? 'General' : 'BMP Fund';
        }
        if (!tx.subCategoryBreakdown || Object.keys(tx.subCategoryBreakdown).length === 0) {
          const subKey = tx.subCategory || (tx.donorType === 'general' ? 'General' : 'BMP Fund');
          tx.subCategoryBreakdown = { [subKey]: tx.amount };
        }
      }
    }
    txMap.set(String(tx.id).toLowerCase().trim(), tx);
    recordUserPaidTxId(tx.id);
    syncTransactionToFirestore(tx).catch(() => {});
    import('../services/supabaseService')
      .then(({ insertSupabaseTransaction }) => {
        insertSupabaseTransaction(tx).catch(() => {});
      })
      .catch(() => {});
  });

  const updated = Array.from(txMap.values());
  saveStoredTransactions(updated);
  if (typeof window !== 'undefined') {
    broadcastTabSync('transactions');
    broadcastTabSync('user_paid');
    window.dispatchEvent(new CustomEvent('ronpay_transactions_updated', { detail: updated }));
    window.dispatchEvent(new CustomEvent('ronpay_user_paid_updated', { detail: getStoredUserPaidTxIds() }));
  }

  safeApiFetch('/api/transactions/batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transactions: txs })
  }).catch(() => {
    txs.forEach(t => {
      safeApiFetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(t)
      }).catch(() => {});
    });
  });

  safeApiFetch('/api/data/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transactions: txs })
  }).catch(() => {});
};

export const deleteMembersOfCampaign = (campaignId: string): void => {
  if (!campaignId) return;
  const allMembers = getMembers();
  const deletedMemberIds: string[] = [];
  const filtered = allMembers.filter(m => {
    if (m.campaignId === campaignId) {
      if (m.id) {
        markMemberAsDeleted(m.id);
        deletedMemberIds.push(m.id);
      }
      return false;
    }
    return true;
  });
  saveMembers(filtered);
  if (deletedMemberIds.length > 0) {
    safeApiFetch('/api/data/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deletedMemberIds })
    });
    broadcastTabSync('members', { deletedIds: deletedMemberIds });
  }
};

export const canApproveCashPayment = (
  tx: Transaction,
  campaigns?: Campaign[],
  creatorProfile?: CreatorProfile | null
): { allowed: boolean; reason?: string } => {
  if (!tx) return { allowed: false, reason: 'Transaction a awm lo.' };
  if (tx.paymentMethod !== 'cash') return { allowed: false, reason: 'Cash payment a ni lo.' };
  if (!creatorProfile) return { allowed: false, reason: 'Log in a ngai.' };
  if (creatorProfile.isAdmin || creatorProfile.role === 'SUPER_ADMIN' || creatorProfile.role === 'ADMIN' || isSuperAdminOrAdminProfile(creatorProfile)) {
    return { allowed: true };
  }
  const roleLower = (creatorProfile.role || '').toLowerCase();
  const desigLower = (creatorProfile.designation || '').toLowerCase();
  if (roleLower.includes('treasurer') || desigLower.includes('treasurer') || roleLower.includes('accountant') || desigLower.includes('accountant')) {
    return { allowed: true };
  }
  const allCampaigns = campaigns || getStoredCampaigns();
  const camp = allCampaigns.find(c => c.id === tx.campaignId);
  if (camp) {
    if (isCampaignCreator(camp, creatorProfile)) {
      return { allowed: true };
    }
    if (Array.isArray(camp.authorizedOfficers) && creatorProfile.phone) {
      const uPhone = creatorProfile.phone.replace(/\D/g, '').slice(-10);
      const isOfficer = camp.authorizedOfficers.some(o => (o.phone || '').replace(/\D/g, '').slice(-10) === uPhone);
      if (isOfficer) return { allowed: true };
    }
  }
  return { allowed: false, reason: 'He bawm hi i siam a nih loh emaw Treasurer / Officer i nih loh avangin cash approve theihna i nei lo.' };
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
  saveTransaction(updatedTx);
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
  saveTransaction(updatedTx);
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

// ==========================================
// KUMTLUANG NGO & PAWL EXPENDITURE (EXPENSES)
// ==========================================

export const DEFAULT_KUMTLUANG_EXPENSE_HEADS: string[] = [
  'Inhlangchhawnna / Maintenance',
  'Tlawmngaihna / Tanpuina (Relief & Welfare)',
  'Office & Stationery / Printing',
  'Programme & Refreshment / Thingpui',
  'Travelling & Conveyance / DA',
  'Electric & Tui Bill',
  'Sound & Light / Equipment',
  'Sports & Games / Puanchei',
  'Thil Dang / Miscellaneous'
];

export const INITIAL_KUMTLUANG_EXPENSES: KumtluangExpense[] = (INITIAL_EXPENSES || []) as KumtluangExpense[];

const KUMTLUANG_EXPENSES_KEY = 'ronpay_kumtluang_expenses_v2';
const EXPENSE_HEADS_PREFIX = 'ronpay_expense_heads_';
const DELETED_EXPENSES_KEY = 'ronpay_deleted_expenses_v1';

const KNOWN_DUMMY_EXPENSE_IDS = new Set([
  'exp-1791226950000',
  'exp-1792118935402',
  'exp-1789003',
  'exp-1789002',
  'exp-1789001',
  'exp-kt-2026-001',
  'exp-kt-2026-002',
  'exp-kt-2026-003'
]);

export const getDeletedExpenseIds = (): Set<string> => {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(DELETED_EXPENSES_KEY) : null;
    const list = raw ? JSON.parse(raw) : [];
    const set = new Set(Array.isArray(list) ? list.map((id: any) => String(id).toLowerCase().trim()) : []);
    KNOWN_DUMMY_EXPENSE_IDS.forEach(id => set.add(id));
    return set;
  } catch {
    return new Set(KNOWN_DUMMY_EXPENSE_IDS);
  }
};

export const markExpenseAsDeleted = (expenseId: string): void => {
  if (!expenseId) return;
  try {
    const set = getDeletedExpenseIds();
    set.add(String(expenseId).toLowerCase().trim());
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(DELETED_EXPENSES_KEY, JSON.stringify(Array.from(set)));
    }
  } catch (e) {
    console.warn('Failed to mark expense as deleted:', e);
  }
};

export const getStoredExpenses = (campaignId?: string): KumtluangExpense[] => {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KUMTLUANG_EXPENSES_KEY) : null;
    let list: KumtluangExpense[] = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list) || list.length === 0) {
      list = [...INITIAL_KUMTLUANG_EXPENSES];
      if (typeof localStorage !== 'undefined' && list.length > 0) {
        localStorage.setItem(KUMTLUANG_EXPENSES_KEY, JSON.stringify(list));
      }
    }
    const delSet = getDeletedExpenseIds();
    let cleanList = list.filter(e => {
      if (!e || !e.id) return false;
      const k = String(e.id).toLowerCase().trim();
      if (delSet.has(k) || KNOWN_DUMMY_EXPENSE_IDS.has(k)) return false;
      return true;
    });
    
    // Reconcile and ensure authoritative canonical expenses from INITIAL_KUMTLUANG_EXPENSES
    const canonicalMap = new Map<string, KumtluangExpense>();
    for (const initExp of INITIAL_KUMTLUANG_EXPENSES) {
      if (initExp && initExp.id) {
        canonicalMap.set(String(initExp.id).toLowerCase().trim(), initExp);
      }
    }

    let reconciled = false;
    // 1. Reconcile existing records against canonical definitions
    for (let i = 0; i < cleanList.length; i++) {
      const exp = cleanList[i];
      if (!exp || !exp.id) continue;
      const k = String(exp.id).toLowerCase().trim();
      const canonical = canonicalMap.get(k);
      if (canonical) {
        if (exp.amount !== canonical.amount || exp.voucherNo !== canonical.voucherNo) {
          cleanList[i] = { ...exp, ...canonical };
          reconciled = true;
        }
      }
    }

    // 2. Backfill any active canonical expenses from INITIAL_KUMTLUANG_EXPENSES that may be missing
    const seenIds = new Set(cleanList.map(e => String(e.id).toLowerCase().trim()));
    for (const initExp of INITIAL_KUMTLUANG_EXPENSES) {
      if (!initExp || !initExp.id) continue;
      const k = String(initExp.id).toLowerCase().trim();
      if (!delSet.has(k) && !KNOWN_DUMMY_EXPENSE_IDS.has(k) && !seenIds.has(k)) {
        cleanList.push(initExp);
        seenIds.add(k);
        reconciled = true;
      }
    }

    // Self-heal: If dirty dummy records existed or canonical records backfilled, persist to localStorage
    if ((reconciled || cleanList.length !== list.length) && typeof localStorage !== 'undefined') {
      localStorage.setItem(KUMTLUANG_EXPENSES_KEY, JSON.stringify(cleanList));
    }

    if (campaignId) {
      const cleanId = String(campaignId).toLowerCase().trim();
      return cleanList.filter(e => e && String(e.campaignId).toLowerCase().trim() === cleanId);
    }
    return cleanList;
  } catch (e) {
    console.error('Failed to get stored expenses', e);
    return [...INITIAL_KUMTLUANG_EXPENSES];
  }
};

export const saveStoredExpenses = (expenses: KumtluangExpense[], skipServer: boolean = false): void => {
  try {
    const delSet = getDeletedExpenseIds();
    const cleanExpenses = expenses.filter(e => e && e.id && !delSet.has(String(e.id).toLowerCase().trim()));

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(KUMTLUANG_EXPENSES_KEY, JSON.stringify(cleanExpenses));
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ronpay_expenses_updated', { detail: cleanExpenses }));
    }
    if (!skipServer) {
      safeApiFetch('/api/data/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          expenses: cleanExpenses,
          deletedExpenseIds: Array.from(delSet)
        })
      }).catch(() => {});
      // Sync to cloud Firestore for cross-domain & cross-device live sync
      syncAllLocalExpensesToFirestore().catch(() => {});
    }
  } catch (e) {
    console.error('Failed to save expenses', e);
  }
};

export const saveExpense = (expense: KumtluangExpense): void => {
  const current = getStoredExpenses();
  const idx = current.findIndex(e => String(e.id).toLowerCase().trim() === String(expense.id).toLowerCase().trim());
  let updated: KumtluangExpense[];
  if (idx >= 0) {
    updated = [...current];
    updated[idx] = expense;
  } else {
    updated = [expense, ...current];
  }
  saveStoredExpenses(updated);
  // Instant real-time Firestore sync
  syncExpenseToFirestore(expense).catch(() => {});
};

export const deleteStoredExpense = (expenseId: string): void => {
  const current = getStoredExpenses();
  const target = current.find(e => String(e.id).toLowerCase().trim() === String(expenseId).toLowerCase().trim());
  if (target && target.is_locked) {
    const isUnlocked = target.unlock_expires_at && new Date(target.unlock_expires_at).getTime() > Date.now();
    if (!isUnlocked) {
      console.warn(`[Audit Lock] Cannot delete locked expense ${expenseId}. Maker-Checker approval required.`);
      return;
    }
  }

  markExpenseAsDeleted(expenseId);
  const updated = current.filter(e => String(e.id).toLowerCase().trim() !== String(expenseId).toLowerCase().trim());
  saveStoredExpenses(updated);

  // Directly notify Supabase, Firestore, and server endpoint
  import('../services/SupabaseSync').then(({ deleteExpense }) => {
    deleteExpense(expenseId).catch(() => {});
  }).catch(() => {});
  deleteExpenseFromFirestore(expenseId).catch(() => {});
  safeApiFetch(`/api/expenses/${encodeURIComponent(expenseId)}`, {
    method: 'DELETE'
  }).catch(() => {});
};

export const deleteAllCampaignExpenses = (campaignId: string): void => {
  if (!campaignId) return;
  const cleanCampId = String(campaignId).toLowerCase().trim();
  const current = getStoredExpenses();
  const targetExpenses = current.filter(e => String(e.campaignId).toLowerCase().trim() === cleanCampId);
  targetExpenses.forEach(e => {
    markExpenseAsDeleted(e.id);
    import('../services/SupabaseSync').then(({ deleteExpense }) => {
      deleteExpense(e.id).catch(() => {});
    }).catch(() => {});
    deleteExpenseFromFirestore(e.id).catch(() => {});
  });
  const remaining = current.filter(e => String(e.campaignId).toLowerCase().trim() !== cleanCampId);
  saveStoredExpenses(remaining);
};

export const updateStoredExpense = (expense: KumtluangExpense): void => {
  const current = getStoredExpenses();
  const cleanId = String(expense.id).toLowerCase().trim();
  const existingExp = current.find(e => String(e.id).toLowerCase().trim() === cleanId);
  if (existingExp && existingExp.is_locked) {
    const isUnlocked = existingExp.unlock_expires_at && new Date(existingExp.unlock_expires_at).getTime() > Date.now();
    if (!isUnlocked && !expense.is_locked && !expense.unlock_expires_at) {
      console.warn(`[Audit Lock] Expense ${expense.id} is locked by ${existingExp.locked_by || 'Auditor'}. Modification blocked.`);
      return;
    }
  }

  const idx = current.findIndex(e => String(e.id).toLowerCase().trim() === cleanId);
  let updated: KumtluangExpense[];
  const stamp = new Date().toISOString();
  const expenseWithStamp = {
    ...expense,
    updatedAt: stamp
  };
  if (idx >= 0) {
    updated = [...current];
    updated[idx] = expenseWithStamp;
  } else {
    updated = [expenseWithStamp, ...current];
  }
  saveStoredExpenses(updated);
  syncExpenseToFirestore(expenseWithStamp).catch(() => {});
  import('../services/SupabaseSync').then(({ upsertExpense }) => {
    upsertExpense(expenseWithStamp).catch((err) => {
      console.warn('[Supabase] Live expense upsert note:', err);
    });
  }).catch(() => {});
  import('../services/crossTabSync').then(({ broadcastStateChange }) => {
    broadcastStateChange('expenses', expenseWithStamp);
  }).catch(() => {});
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('ronpay_expenses_updated', { detail: updated }));
  }
  safeApiFetch('/api/expenses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(expenseWithStamp)
  }).catch(() => {});
};

export const getCampaignExpenseHeads = (campaignId: string, customHeadsFromCampaign?: string[]): string[] => {
  // 1. If campaign has explicit custom heads configured, prioritize that list exactly
  if (customHeadsFromCampaign && Array.isArray(customHeadsFromCampaign) && customHeadsFromCampaign.length > 0) {
    return [...customHeadsFromCampaign];
  }
  try {
    // 2. Check localStorage for this specific campaign's saved heads
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(`${EXPENSE_HEADS_PREFIX}${campaignId}`) : null;
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return [...parsed];
      }
    }
  } catch {}
  // 3. Fallback to system defaults only for brand new unconfigured campaigns
  return [...DEFAULT_KUMTLUANG_EXPENSE_HEADS];
};

export const saveCampaignExpenseHeads = (campaignId: string, heads: string[]): void => {
  try {
    const cleanHeads = Array.from(new Set(heads.map(h => h.trim()).filter(Boolean)));
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(`${EXPENSE_HEADS_PREFIX}${campaignId}`, JSON.stringify(cleanHeads));
    }
    // Update matching campaign in stored campaigns list to persist across devices
    const storedCamps = getStoredCampaigns();
    const cleanCampId = String(campaignId).toLowerCase().trim();
    const campIdx = storedCamps.findIndex(c => String(c.id).toLowerCase().trim() === cleanCampId);
    if (campIdx >= 0) {
      storedCamps[campIdx] = {
        ...storedCamps[campIdx],
        expenseHeads: cleanHeads,
        updatedAt: new Date().toISOString()
      };
      saveStoredCampaigns(storedCamps, false);
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ronpay_expense_heads_updated', { detail: { campaignId, heads: cleanHeads } }));
    }
  } catch (e) {
    console.error('Failed to save expense heads', e);
  }
};

export const renameCampaignExpenseHead = (campaignId: string, oldHeadName: string, newHeadName: string): string[] => {
  const currentHeads = getCampaignExpenseHeads(campaignId);
  const trimmedNew = newHeadName.trim();
  if (!trimmedNew) return currentHeads;

  const updatedHeads = currentHeads.map(h => h === oldHeadName ? trimmedNew : h);
  saveCampaignExpenseHeads(campaignId, updatedHeads);

  // Update all existing expenses under this head to the new head name
  const allExpenses = getStoredExpenses();
  const cleanCampId = String(campaignId).toLowerCase().trim();
  let hasModified = false;
  const updatedExpenses = allExpenses.map(exp => {
    if (String(exp.campaignId).toLowerCase().trim() === cleanCampId && exp.head === oldHeadName) {
      hasModified = true;
      return { ...exp, head: trimmedNew, updatedAt: new Date().toISOString() };
    }
    return exp;
  });
  if (hasModified) {
    saveStoredExpenses(updatedExpenses);
  }
  return updatedHeads;
};

export const deleteCampaignExpenseHead = (campaignId: string, headToRemove: string): string[] => {
  const currentHeads = getCampaignExpenseHeads(campaignId);
  const updatedHeads = currentHeads.filter(h => h !== headToRemove);
  saveCampaignExpenseHeads(campaignId, updatedHeads);

  // If any expenses used this deleted head, safely migrate them to fallback head or 'Thil Dang / Miscellaneous'
  const fallbackHead = updatedHeads[0] || 'Thil Dang / Miscellaneous';
  const allExpenses = getStoredExpenses();
  const cleanCampId = String(campaignId).toLowerCase().trim();
  let hasModified = false;
  const updatedExpenses = allExpenses.map(exp => {
    if (String(exp.campaignId).toLowerCase().trim() === cleanCampId && exp.head === headToRemove) {
      hasModified = true;
      return { ...exp, head: fallbackHead, updatedAt: new Date().toISOString() };
    }
    return exp;
  });
  if (hasModified) {
    saveStoredExpenses(updatedExpenses);
  }
  return updatedHeads;
};

export const isCleanSlateModeActive = (): boolean => {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem('ronpay_clean_slate_mode_v1') === 'true';
  } catch {
    return false;
  }
};

export const wipeAllClientStorage = async (): Promise<void> => {
  try {
    if (typeof localStorage !== 'undefined') localStorage.clear();
    if (typeof sessionStorage !== 'undefined') sessionStorage.clear();
    
    // Clear all caches
    if (typeof caches !== 'undefined') {
      const keys = await caches.keys();
      await Promise.all(keys.map(key => caches.delete(key)));
    }
    console.log('[Storage] All client storage (local, session, caches) cleared.');
  } catch (e) {
    console.error('Failed to clear client storage:', e);
  }
};



export const resetCampaignExpenseHeadsToDefault = (campaignId: string): string[] => {
  const defaultList = [...DEFAULT_KUMTLUANG_EXPENSE_HEADS];
  saveCampaignExpenseHeads(campaignId, defaultList);
  return defaultList;
};






export function mergeTransactions(existing: Transaction[], incoming: Transaction[]): Transaction[] {
  const delIds = getDeletedTransactionIds();
  const map = new Map<string, Transaction>();
  
  const filterValid = (t: Transaction) => {
    if (!t || !t.id) return false;
    const cleanId = String(t.id).toLowerCase().trim();
    if (delIds.has(cleanId) || PERMANENTLY_PURGED_TX_IDS.has(cleanId)) return false;
    return true;
  };

  (existing || []).filter(filterValid).forEach(t => map.set(String(t.id).toLowerCase().trim(), t));
  (incoming || []).filter(filterValid).forEach(inc => {
    const k = String(inc.id).toLowerCase().trim();
    const prev = map.get(k);
    if (!prev) {
      map.set(k, inc);
    } else {
      const prevTime = new Date(prev.updatedAt || prev.audit_marked_at || prev.audit_date || prev.timestamp || 0).getTime();
      const incTime = new Date(inc.updatedAt || inc.audit_marked_at || inc.audit_date || inc.timestamp || 0).getTime();
      const newer = incTime >= prevTime ? inc : prev;
      const merged: Transaction = incTime >= prevTime ? { ...prev, ...inc } : { ...inc, ...prev };
      if (newer.metadata && newer.metadata.audit_mark === null) {
        merged.audit_mark = undefined;
        merged.audit_query = undefined;
        merged.audit_marked_by = undefined;
        merged.audit_marked_at = undefined;
        if (newer.metadata.is_locked === false) {
          merged.is_locked = false;
          merged.locked_by = undefined;
          merged.locked_at = undefined;
        }
      } else {
        // Preserve local audit verification marks & locks if incoming row lacks them and local was marked more recently
        if (prev.audit_mark !== undefined && inc.audit_mark === undefined && prevTime >= incTime) {
          merged.audit_mark = prev.audit_mark;
          merged.audit_query = prev.audit_query;
          merged.audit_marked_by = prev.audit_marked_by;
          merged.audit_marked_at = prev.audit_marked_at;
        }
        if (prev.is_locked !== undefined && inc.is_locked === undefined && prevTime >= incTime) {
          merged.is_locked = prev.is_locked;
          merged.locked_by = prev.locked_by;
          merged.audit_date = prev.audit_date;
          merged.audit_period = prev.audit_period;
          merged.audit_notes = prev.audit_notes;
        }
      }
      map.set(k, merged);
    }
  });
  return Array.from(map.values()).sort((a, b) => new Date(b.timestamp || b.createdAt || 0).getTime() - new Date(a.timestamp || a.createdAt || 0).getTime());
}
export const clearRonpayLocalStorage = (): void => {
  if (typeof localStorage === 'undefined') return;
  const keysToRemove = Object.keys(localStorage).filter(key => key.startsWith('ronpay_'));
  keysToRemove.forEach(key => localStorage.removeItem(key));
};

// ============================================================================
// FINANCIAL AUDIT LOCK, AUDITOR ACCESS GRANTS & MAKER-CHECKER WORKFLOW
// ============================================================================

export const AUDITOR_GRANTS_KEY = 'ronpay_auditor_grants_v1';
export const DELETED_AUDITOR_GRANTS_KEY = 'ronpay_deleted_auditor_grants_v1';
export const MODIFICATION_REQUESTS_KEY = 'ronpay_modification_requests_v1';

export const getStoredDeletedAuditorGrantIds = (): string[] => {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(DELETED_AUDITOR_GRANTS_KEY) : null;
    const base: string[] = raw ? JSON.parse(raw) : [];
    const set = new Set<string>(
      (Array.isArray(base) ? base : []).map(id => String(id || '').toLowerCase().trim()).filter(Boolean)
    );
    try {
      const rawCamps = typeof localStorage !== 'undefined' ? localStorage.getItem(CAMPAIGNS_KEY) : null;
      if (rawCamps) {
        const camps = JSON.parse(rawCamps);
        if (Array.isArray(camps)) {
          for (const c of camps) {
            const cDel = c?.deletedAuditorGrantIds || c?.metadata?.deletedAuditorGrantIds;
            if (Array.isArray(cDel)) {
              for (const dId of cDel) {
                const clean = String(dId || '').toLowerCase().trim();
                if (clean) set.add(clean);
              }
            }
          }
        }
      }
    } catch {}
    return Array.from(set);
  } catch {
    return [];
  }
};

export const saveStoredDeletedAuditorGrantIds = (ids: string[]): void => {
  try {
    if (typeof localStorage !== 'undefined') {
      const unique = Array.from(new Set(ids.map(id => String(id || '').toLowerCase().trim()).filter(Boolean)));
      localStorage.setItem(DELETED_AUDITOR_GRANTS_KEY, JSON.stringify(unique));
    }
  } catch {}
};

export const unpurgeAuditorGrantId = (grantId: string): void => {
  try {
    const clean = String(grantId).toLowerCase().trim();
    const current = getStoredDeletedAuditorGrantIds();
    const filtered = current.filter(id => id !== clean);
    saveStoredDeletedAuditorGrantIds(filtered);
  } catch {}
};

/**
 * Formats remaining Auditor Grant time in clear Mizo instead of confusing raw hours like "719h la awm".
 * E.g. "Ni 29 leh Darkar 23 la awm" or "Darkar 18 la awm".
 */
export const formatRemainingAuditTimeMizo = (expiresAt?: string | number | null): string => {
  if (!expiresAt) return 'Hun tiam chhung';
  const expMs = typeof expiresAt === 'number' ? expiresAt : new Date(expiresAt).getTime();
  if (isNaN(expMs)) return 'Hun tiam chhung';
  const diffMs = Math.max(0, expMs - Date.now());
  if (diffMs <= 0) return 'Hun a tawp tawh';

  const totalMinutes = Math.ceil(diffMs / (1000 * 60));
  if (totalMinutes < 60) {
    return `Minute ${totalMinutes} la awm`;
  }
  const totalHours = Math.floor(diffMs / (1000 * 60 * 60));
  const days = Math.floor(totalHours / 24);
  const remHours = totalHours % 24;

  if (days > 0) {
    if (remHours > 0) {
      return `Ni ${days} leh Darkar ${remHours} la awm`;
    }
    return `Ni ${days} la awm`;
  }
  return `Darkar ${Math.max(1, totalHours)} la awm`;
};

export const getStoredAuditorGrants = (campaignId?: string): AuditorAccessGrant[] => {
  try {
    const deletedSet = new Set(getStoredDeletedAuditorGrantIds());
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(AUDITOR_GRANTS_KEY) : null;
    let list: AuditorAccessGrant[] = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) list = [];

    // Filter out deleted grants
    list = list.filter(g => g && g.id && !deletedSet.has(String(g.id).toLowerCase().trim()));

    // Also merge any auditorGrants embedded inside stored campaigns (synced via Supabase campaigns table)
    const map = new Map<string, AuditorAccessGrant>();
    for (const g of list) {
      if (g && g.id && !deletedSet.has(String(g.id).toLowerCase().trim())) {
        map.set(String(g.id).trim(), g);
      }
    }

    try {
      const rawCamps = typeof localStorage !== 'undefined' ? localStorage.getItem(CAMPAIGNS_KEY) : null;
      const camps: Campaign[] = rawCamps ? JSON.parse(rawCamps) : [];
      if (Array.isArray(camps)) {
        for (const c of camps) {
          const cGrants = c?.auditorGrants || (c as any)?.metadata?.auditorGrants;
          if (Array.isArray(cGrants)) {
            for (const cg of cGrants) {
              if (!cg || !cg.id) continue;
              const k = String(cg.id).trim();
              if (deletedSet.has(k.toLowerCase())) continue;
              const existing = map.get(k);
              if (!existing) {
                map.set(k, cg);
              } else {
                const localT = new Date(existing.updatedAt || existing.updated_at || existing.createdAt || 0).getTime();
                const campT = new Date(cg.updatedAt || cg.updated_at || cg.createdAt || 0).getTime();
                if (campT >= localT) {
                  map.set(k, { ...existing, ...cg });
                }
              }
            }
          }
        }
      }
    } catch {}

    // Deduplicate by (campaignId + auditorPhone) keeping the most recently updated grant
    const byCampPhone = new Map<string, AuditorAccessGrant>();
    for (const g of map.values()) {
      const cid = String(g.campaignId || g.campaign_id || '').toLowerCase().trim();
      const ph = String(g.auditorPhone || g.auditor_phone || '').replace(/\D/g, '').slice(-10);
      const dedupKey = cid && ph ? `${cid}__${ph}` : String(g.id).trim();
      const prev = byCampPhone.get(dedupKey);
      if (!prev) {
        byCampPhone.set(dedupKey, g);
      } else {
        const tPrev = new Date(prev.updatedAt || prev.updated_at || prev.createdAt || 0).getTime();
        const tCurr = new Date(g.updatedAt || g.updated_at || g.createdAt || 0).getTime();
        byCampPhone.set(dedupKey, tCurr >= tPrev ? g : prev);
      }
    }

    const combined = Array.from(byCampPhone.values());
    const now = Date.now();
    let changed = combined.length !== list.length;
    // Auto-evaluate expired grants
    const updated = combined.map(g => {
      const expStr = g.expiresAt || g.expires_at || '';
      if (g.status === 'active' && expStr && new Date(expStr).getTime() <= now) {
        changed = true;
        return { ...g, status: 'expired' as const, updatedAt: new Date().toISOString() };
      }
      return g;
    });

    if (changed && typeof localStorage !== 'undefined') {
      localStorage.setItem(AUDITOR_GRANTS_KEY, JSON.stringify(updated));
    }

    if (campaignId) {
      const cleanId = String(campaignId).toLowerCase().trim();
      return updated.filter(g => {
        const gCampId = String(g.campaignId || g.campaign_id || '').toLowerCase().trim();
        return gCampId === cleanId;
      });
    }
    return updated;
  } catch (e) {
    console.error('Failed to get stored auditor grants:', e);
    return [];
  }
};

export const saveStoredAuditorGrants = (
  grants: AuditorAccessGrant[],
  fromServer: boolean = false,
  replaceAuthoritative: boolean = false
): void => {
  try {
    if (!Array.isArray(grants)) return;
    const deletedSet = new Set(getStoredDeletedAuditorGrantIds());
    const current = getStoredAuditorGrants();
    const map = new Map<string, AuditorAccessGrant>();
    const nowMs = Date.now();

    if (!replaceAuthoritative) {
      for (const g of current) {
        if (g && g.id && !deletedSet.has(String(g.id).toLowerCase().trim())) {
          map.set(String(g.id).trim(), g);
        }
      }
    } else {
      // In authoritative replacement mode, only keep a local grant if it was created < 15s ago (in-flight creation)
      for (const g of current) {
        if (!g || !g.id) continue;
        const cleanGid = String(g.id).toLowerCase().trim();
        if (deletedSet.has(cleanGid)) continue;
        const createdMs = new Date(g.createdAt || g.created_at || 0).getTime();
        if (createdMs > 0 && nowMs - createdMs < 15000) {
          map.set(String(g.id).trim(), g);
        }
      }
    }

    for (const sg of grants) {
      if (!sg || !sg.id) continue;
      const k = String(sg.id).trim();
      if (deletedSet.has(k.toLowerCase())) continue;
      const existing = map.get(k);
      if (!existing) {
        map.set(k, sg);
      } else {
        const localTime = new Date(existing.updatedAt || existing.updated_at || existing.createdAt || 0).getTime();
        const serverTime = new Date(sg.updatedAt || sg.updated_at || sg.createdAt || 0).getTime();
        if (serverTime >= localTime || fromServer) {
          map.set(k, { ...existing, ...sg });
        }
      }
    }

    // Deduplicate by (campaignId + auditorPhone)
    const dedupMap = new Map<string, AuditorAccessGrant>();
    for (const g of map.values()) {
      const cid = String(g.campaignId || g.campaign_id || '').toLowerCase().trim();
      const ph = String(g.auditorPhone || g.auditor_phone || '').replace(/\D/g, '').slice(-10);
      const dKey = cid && ph ? `${cid}__${ph}` : String(g.id).trim();
      const prev = dedupMap.get(dKey);
      if (!prev) {
        dedupMap.set(dKey, g);
      } else {
        const tPrev = new Date(prev.updatedAt || prev.updated_at || prev.createdAt || 0).getTime();
        const tCurr = new Date(g.updatedAt || g.updated_at || g.createdAt || 0).getTime();
        dedupMap.set(dKey, tCurr >= tPrev ? g : prev);
      }
    }

    const merged = Array.from(dedupMap.values());
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(AUDITOR_GRANTS_KEY, JSON.stringify(merged));
      // Also synchronize embedded auditorGrants inside stored campaigns so CAMPAIGNS_KEY never revives removed grants
      try {
        const rawCamps = localStorage.getItem(CAMPAIGNS_KEY);
        if (rawCamps) {
          const camps: Campaign[] = JSON.parse(rawCamps);
          if (Array.isArray(camps)) {
            let campsModified = false;
            const updatedCamps = camps.map(c => {
              if (!c || !c.id) return c;
              const cId = String(c.id).toLowerCase().trim();
              const campGrants = merged.filter(
                g => String(g.campaignId || g.campaign_id || '').toLowerCase().trim() === cId
              );
              const prevLen = Array.isArray(c.auditorGrants) ? c.auditorGrants.length : 0;
              if (replaceAuthoritative || prevLen !== campGrants.length) {
                campsModified = true;
                return {
                  ...c,
                  auditorGrants: campGrants,
                  metadata: {
                    ...(c.metadata || {}),
                    auditorGrants: campGrants,
                    deletedAuditorGrantIds: Array.from(deletedSet)
                  }
                };
              }
              return c;
            });
            if (campsModified) {
              localStorage.setItem(CAMPAIGNS_KEY, JSON.stringify(updatedCamps));
            }
          }
        }
      } catch {}
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ronpay_auditor_grants_updated', { detail: merged }));
    }
  } catch (e) {
    console.error('Failed to save stored auditor grants:', e);
  }
};

export const saveAuditorGrant = (grant: AuditorAccessGrant): void => {
  try {
    const cleanId = String(grant.id).trim();
    unpurgeAuditorGrantId(cleanId);
    const current = getStoredAuditorGrants();
    const nowIso = new Date().toISOString();
    const cleanPhone = String(grant.auditorPhone || grant.auditor_phone || '').replace(/\D/g, '').slice(-10);
    const cleanCampId = String(grant.campaignId || grant.campaign_id || '').toLowerCase().trim();

    const stampedGrant: AuditorAccessGrant = {
      ...grant,
      auditorName: grant.auditorName || grant.auditor_name || 'Auditor',
      auditor_name: grant.auditorName || grant.auditor_name || 'Auditor',
      auditorPhone: cleanPhone,
      auditor_phone: cleanPhone,
      campaignId: grant.campaignId || grant.campaign_id || '',
      campaign_id: grant.campaignId || grant.campaign_id || '',
      campaignTitle: grant.campaignTitle || grant.campaign_title || '',
      campaign_title: grant.campaignTitle || grant.campaign_title || '',
      expiresAt: grant.expiresAt || grant.expires_at || nowIso,
      expires_at: grant.expiresAt || grant.expires_at || nowIso,
      pin: grant.pin || '1234',
      createdAt: grant.createdAt || nowIso,
      created_at: grant.created_at || grant.createdAt || nowIso,
      updatedAt: nowIso,
      updated_at: nowIso,
    };

    // Retire any duplicate grant IDs for the same campaign + auditorPhone
    const duplicateIdsToRetire: string[] = [];
    const filteredCurrent = current.filter(g => {
      if (!g || !g.id) return false;
      if (g.id === cleanId) return true;
      const gCamp = String(g.campaignId || g.campaign_id || '').toLowerCase().trim();
      const gPhone = String(g.auditorPhone || g.auditor_phone || '').replace(/\D/g, '').slice(-10);
      if (cleanCampId && cleanPhone && gCamp === cleanCampId && gPhone === cleanPhone) {
        duplicateIdsToRetire.push(String(g.id).toLowerCase().trim());
        return false;
      }
      return true;
    });

    if (duplicateIdsToRetire.length > 0) {
      saveStoredDeletedAuditorGrantIds([...getStoredDeletedAuditorGrantIds(), ...duplicateIdsToRetire]);
    }

    const idx = filteredCurrent.findIndex(g => g.id === cleanId);
    let updated: AuditorAccessGrant[];
    if (idx >= 0) {
      updated = [...filteredCurrent];
      updated[idx] = stampedGrant;
    } else {
      updated = [stampedGrant, ...filteredCurrent];
    }

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(AUDITOR_GRANTS_KEY, JSON.stringify(updated));
    }

    // Also embed inside the target Campaign and save to Supabase so other browsers see it immediately
    if (cleanCampId) {
      const camps = getStoredCampaigns();
      const targetCamp = camps.find(c => String(c.id).toLowerCase().trim() === cleanCampId);
      if (targetCamp) {
        const campGrants = updated.filter(
          g => String(g.campaignId || g.campaign_id || '').toLowerCase().trim() === cleanCampId
        );
        saveCampaign({
          ...targetCamp,
          auditorGrants: campGrants,
          metadata: {
            ...(targetCamp.metadata || {}),
            auditorGrants: campGrants,
            deletedAuditorGrantIds: getStoredDeletedAuditorGrantIds()
          }
        });
      }
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ronpay_auditor_grants_updated', { detail: updated }));
      broadcastTabSync('auditor_grants');
    }

    // Push immediately to backend server for multi-device access
    safeApiFetch('/api/auditor-grants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(stampedGrant),
    }).catch(() => {});

    safeApiFetch('/api/data/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        auditorGrants: [stampedGrant],
        ...(duplicateIdsToRetire.length > 0 ? { deletedAuditorGrantIds: duplicateIdsToRetire } : {})
      }),
    }).catch(() => {});

    recordAuditLog(
      'Auditor Access Granted',
      `Auditor ${stampedGrant.auditorName} (${stampedGrant.auditorPhone}) granted access to campaign ${stampedGrant.campaignTitle || stampedGrant.campaignId} until ${stampedGrant.expiresAt}.`,
      'audit_grant',
      stampedGrant.id,
      stampedGrant.grantedByName || stampedGrant.grantedBy
    );
  } catch (e) {
    console.error('Failed to save auditor grant:', e);
  }
};

export const revokeAuditorGrant = (grantId: string, revokedBy: string = 'Creator'): void => {
  try {
    const nowIso = new Date().toISOString();
    const current = getStoredAuditorGrants();
    let targetCampId = '';
    const updated = current.map(g => {
      if (String(g.id).trim().toLowerCase() === String(grantId).trim().toLowerCase()) {
        targetCampId = String(g.campaignId || g.campaign_id || '').toLowerCase().trim();
        return { ...g, status: 'revoked' as const, updatedAt: nowIso, updated_at: nowIso };
      }
      return g;
    });

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(AUDITOR_GRANTS_KEY, JSON.stringify(updated));
    }

    if (targetCampId) {
      const camps = getStoredCampaigns();
      const targetCamp = camps.find(c => String(c.id).toLowerCase().trim() === targetCampId);
      if (targetCamp) {
        const campGrants = updated.filter(
          g => String(g.campaignId || g.campaign_id || '').toLowerCase().trim() === targetCampId
        );
        const activeCount = campGrants.filter(g => g.status === 'active').length;
        saveCampaign({
          ...targetCamp,
          auditorGrants: campGrants,
          ...(activeCount < 2 ? { requireDualAuditorConsensus: false } : {}),
          metadata: {
            ...(targetCamp.metadata || {}),
            auditorGrants: campGrants,
            ...(activeCount < 2 ? { requireDualAuditorConsensus: false } : {}),
            deletedAuditorGrantIds: getStoredDeletedAuditorGrantIds()
          }
        });
      }
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ronpay_auditor_grants_updated', { detail: updated }));
      broadcastTabSync('auditor_grants');
    }

    safeApiFetch(`/api/auditor-grants/${encodeURIComponent(grantId)}/revoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ revokedBy }),
    }).catch(() => {});

    recordAuditLog(
      'Auditor Access Revoked',
      `Auditor grant ${grantId} manually revoked by ${revokedBy}.`,
      'audit_grant',
      grantId,
      revokedBy
    );
  } catch (e) {
    console.error('Failed to revoke auditor grant:', e);
  }
};

/**
 * Permanently deletes an Auditor Grant from local storage, campaign metadata,
 * database, and Supabase across all browsers ("Paih Hlen").
 */
export const permanentlyDeleteAuditorGrant = async (grantId: string): Promise<void> => {
  try {
    const cleanId = String(grantId || '').trim();
    if (!cleanId) return;
    const cleanLowerId = cleanId.toLowerCase();

    const current = getStoredAuditorGrants();
    let targetGrant = current.find(g => String(g.id).trim().toLowerCase() === cleanLowerId);
    let targetCampId = String(targetGrant?.campaignId || targetGrant?.campaign_id || '').toLowerCase().trim();
    let targetPhone = String(targetGrant?.auditorPhone || targetGrant?.auditor_phone || '').replace(/\D/g, '').slice(-10);

    // Also inspect stored campaigns in case targetGrant was embedded in a campaign
    const camps = getStoredCampaigns();
    for (const c of camps) {
      const cId = String(c.id).toLowerCase().trim();
      const cGrants = [...(Array.isArray(c.auditorGrants) ? c.auditorGrants : []), ...(Array.isArray((c as any).metadata?.auditorGrants) ? (c as any).metadata.auditorGrants : [])];
      for (const g of cGrants) {
        if (g && String(g.id).trim().toLowerCase() === cleanLowerId) {
          if (!targetGrant) targetGrant = g;
          if (!targetCampId) targetCampId = cId;
          if (!targetPhone) targetPhone = String(g.auditorPhone || g.auditor_phone || '').replace(/\D/g, '').slice(-10);
        }
      }
    }

    // Collect all grant IDs for this same auditor on this same campaign (so any duplicate grants are also purged)
    const idsToDelete = new Set<string>([cleanLowerId]);
    for (const g of current) {
      if (!g || !g.id) continue;
      const gCamp = String(g.campaignId || g.campaign_id || '').toLowerCase().trim();
      const gPhone = String(g.auditorPhone || g.auditor_phone || '').replace(/\D/g, '').slice(-10);
      if (targetCampId && targetPhone && gCamp === targetCampId && gPhone === targetPhone) {
        idsToDelete.add(String(g.id).trim().toLowerCase());
      }
    }
    for (const c of camps) {
      const cId = String(c.id).toLowerCase().trim();
      if (targetCampId && cId !== targetCampId) continue;
      const cGrants = [...(Array.isArray(c.auditorGrants) ? c.auditorGrants : []), ...(Array.isArray((c as any).metadata?.auditorGrants) ? (c as any).metadata.auditorGrants : [])];
      for (const g of cGrants) {
        if (!g || !g.id) continue;
        const gPhone = String(g.auditorPhone || g.auditor_phone || '').replace(/\D/g, '').slice(-10);
        if (targetPhone && gPhone === targetPhone) {
          idsToDelete.add(String(g.id).trim().toLowerCase());
        }
      }
    }

    // 1. Record in deleted IDs list so it never revives from old local caches
    const deletedList = Array.from(new Set([...getStoredDeletedAuditorGrantIds(), ...Array.from(idsToDelete)]));
    saveStoredDeletedAuditorGrantIds(deletedList);
    const delSet = new Set(deletedList);

    // 2. Remove from local AUDITOR_GRANTS_KEY
    const updated = current.filter(g => g && g.id && !delSet.has(String(g.id).trim().toLowerCase()));
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(AUDITOR_GRANTS_KEY, JSON.stringify(updated));
    }

    // 3. Purge from associated campaigns in localStorage & Supabase
    for (const c of camps) {
      let campModified = false;
      const cId = String(c.id).toLowerCase().trim();
      if (Array.isArray(c.auditorGrants)) {
        const filtered = c.auditorGrants.filter(g => g && g.id && !delSet.has(String(g.id).trim().toLowerCase()));
        if (filtered.length !== c.auditorGrants.length) {
          c.auditorGrants = filtered;
          campModified = true;
        }
      }
      if (c.metadata && Array.isArray(c.metadata.auditorGrants)) {
        const filteredMeta = c.metadata.auditorGrants.filter(
          (g: any) => g && g.id && !delSet.has(String(g.id).trim().toLowerCase())
        );
        if (filteredMeta.length !== c.metadata.auditorGrants.length) {
          c.metadata.auditorGrants = filteredMeta;
          campModified = true;
        }
      }
      if (cId === targetCampId || campModified) {
        const cleanGrants = Array.isArray(c.auditorGrants) ? c.auditorGrants : [];
        const activeCount = cleanGrants.filter(g => g && g.status === 'active').length;
        if (activeCount < 2) {
          c.requireDualAuditorConsensus = false;
        }
        if (Array.isArray(c.auditSignOffs) && targetPhone) {
          c.auditSignOffs = c.auditSignOffs.filter(s => {
            const sPhone = String(s?.auditorPhone || '').replace(/\D/g, '').slice(-10);
            const sKey = String(s?.auditorKey || '').toLowerCase().trim();
            return sPhone !== targetPhone && sKey !== targetPhone;
          });
        }
        c.metadata = {
          ...(c.metadata || {}),
          auditorGrants: cleanGrants,
          deletedAuditorGrantIds: deletedList,
          auditSignOffs: c.auditSignOffs || [],
          requireDualAuditorConsensus: c.requireDualAuditorConsensus
        };
        saveCampaign(c);
      }
    }

    // 4. Dispatch local and tab events
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ronpay_auditor_grants_updated', { detail: updated }));
      window.dispatchEvent(new CustomEvent('ronpay_campaigns_updated', { detail: getStoredCampaigns() }));
      broadcastTabSync('auditor_grants');
    }

    // 5. Call backend endpoints for multi-device sync
    const queryParams = new URLSearchParams();
    if (targetCampId) queryParams.set('campaignId', targetCampId);
    if (targetPhone) queryParams.set('phone', targetPhone);
    const qs = queryParams.toString() ? `?${queryParams.toString()}` : '';

    await Promise.all([
      safeApiFetch(`/api/auditor-grants/${encodeURIComponent(cleanId)}${qs}`, {
        method: 'DELETE',
      }).catch(() => null),
      safeApiFetch('/api/data/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deletedAuditorGrantIds: Array.from(idsToDelete),
          auditorGrants: updated
        }),
      }).catch(() => null)
    ]);

    // 6. Audit log
    recordAuditLog(
      'Auditor Grant Permanently Deleted',
      `Auditor grant ${cleanId} (${targetGrant?.auditorName || 'Auditor'}) permanently deleted from the system.`,
      'audit_grant',
      cleanId,
      targetGrant?.grantedByName || 'Creator'
    );
  } catch (e) {
    console.error('Failed to permanently delete auditor grant:', e);
  }
};

/**
 * Pulls latest auditor grants from both Backend Server (/api/auditor-grants)
 * and Supabase Campaigns (campaigns.metadata.auditorGrants) so any browser
 * immediately sees newly appointed or revoked/deleted auditors.
 */
export const syncAuditorGrantsAcrossCloud = async (): Promise<AuditorAccessGrant[]> => {
  try {
    const apiRes = await safeApiFetch('/api/auditor-grants')
      .then(r => (r && r.ok ? r.json() : null))
      .catch(() => null);

    // 1. Merge deletedAuditorGrantIds from backend BEFORE reading Supabase campaigns
    if (Array.isArray(apiRes?.deletedAuditorGrantIds) && apiRes.deletedAuditorGrantIds.length > 0) {
      const mergedDel = [...getStoredDeletedAuditorGrantIds(), ...apiRes.deletedAuditorGrantIds];
      saveStoredDeletedAuditorGrantIds(mergedDel);
    }

    const supaCamps = await import('../services/supabaseService')
      .then(({ fetchSupabaseCampaigns }) => fetchSupabaseCampaigns())
      .catch(() => [] as Campaign[]);

    // 2. Also collect any deletedAuditorGrantIds embedded inside Supabase campaign metadata
    if (Array.isArray(supaCamps) && supaCamps.length > 0) {
      const extraDel: string[] = [];
      for (const sc of supaCamps) {
        const metaDel = (sc as any)?.deletedAuditorGrantIds || (sc as any)?.metadata?.deletedAuditorGrantIds;
        if (Array.isArray(metaDel)) {
          extraDel.push(...metaDel);
        }
      }
      if (extraDel.length > 0) {
        saveStoredDeletedAuditorGrantIds([...getStoredDeletedAuditorGrantIds(), ...extraDel]);
      }
    }

    const delSet = new Set(getStoredDeletedAuditorGrantIds());
    const combinedCloudMap = new Map<string, AuditorAccessGrant>();

    const serverGrants = apiRes?.auditorGrants || apiRes?.grants;
    if (Array.isArray(serverGrants)) {
      for (const g of serverGrants) {
        if (g && g.id && !delSet.has(String(g.id).toLowerCase().trim())) {
          combinedCloudMap.set(String(g.id).trim(), g);
        }
      }
    }

    if (Array.isArray(supaCamps) && supaCamps.length > 0) {
      for (const sc of supaCamps) {
        const cg = sc?.auditorGrants || (sc as any)?.metadata?.auditorGrants;
        if (Array.isArray(cg) && cg.length > 0) {
          for (const g of cg) {
            if (!g || !g.id) continue;
            const cleanGid = String(g.id).toLowerCase().trim();
            if (delSet.has(cleanGid)) continue;
            // If server responded authoritatively and didn't include this grant, only include it if created very recently
            const existing = combinedCloudMap.get(String(g.id).trim());
            if (!existing) {
              if (!Array.isArray(serverGrants)) {
                combinedCloudMap.set(String(g.id).trim(), g);
              } else {
                const createdMs = new Date(g.createdAt || g.created_at || 0).getTime();
                if (createdMs > 0 && Date.now() - createdMs < 60000) {
                  combinedCloudMap.set(String(g.id).trim(), g);
                }
              }
            } else {
              const tA = new Date(existing.updatedAt || existing.updated_at || 0).getTime();
              const tB = new Date(g.updatedAt || g.updated_at || 0).getTime();
              if (tB > tA) combinedCloudMap.set(String(g.id).trim(), { ...existing, ...g });
            }
          }
        }
      }
    }

    // If either backend or Supabase responded, authoritatively update local storage
    if (Array.isArray(serverGrants) || (Array.isArray(supaCamps) && supaCamps.length > 0)) {
      saveStoredAuditorGrants(Array.from(combinedCloudMap.values()), true, Array.isArray(serverGrants));
    }
  } catch (e) {
    console.warn('syncAuditorGrantsAcrossCloud warning:', e);
  }
  return getStoredAuditorGrants();
};

export const checkAuditorAccessForCampaign = (
  userPhone?: string | null,
  campaignId?: string | null
): { hasAccess: boolean; grant?: AuditorAccessGrant; remainingHours?: number; remainingLabel?: string } => {
  if (!userPhone || !campaignId) return { hasAccess: false };
  const cleanPhone = String(userPhone).replace(/\D/g, '').slice(-10);
  if (!cleanPhone) return { hasAccess: false };

  const cleanCampId = String(campaignId).toLowerCase().trim();
  const allGrants = getStoredAuditorGrants();
  const now = Date.now();

  const activeGrant = allGrants.find(g => {
    const gPhone = String(g.auditorPhone || g.auditor_phone || '').replace(/\D/g, '').slice(-10);
    const gCampId = String(g.campaignId || g.campaign_id || '').toLowerCase().trim();
    const expTime = new Date(g.expiresAt || g.expires_at || 0).getTime();
    return gPhone === cleanPhone && g.status === 'active' && expTime > now && (gCampId === cleanCampId || !gCampId);
  });

  if (activeGrant) {
    const expStr = activeGrant.expiresAt || activeGrant.expires_at || '';
    const expTime = new Date(expStr || 0).getTime();
    const remainingMs = expTime - now;
    const remainingHours = Math.max(0, Math.round(remainingMs / (1000 * 60 * 60)));
    const remainingLabel = formatRemainingAuditTimeMizo(expStr);
    return { hasAccess: true, grant: activeGrant, remainingHours, remainingLabel };
  }

  return { hasAccess: false };
};

export const getActiveAuditorGrantsForUser = (userPhone?: string | null): AuditorAccessGrant[] => {
  if (!userPhone) return [];
  const cleanPhone = String(userPhone).replace(/\D/g, '').slice(-10);
  if (!cleanPhone) return [];

  const grants = getStoredAuditorGrants();
  const now = Date.now();

  return grants.filter(g => {
    const gPhone = String(g.auditorPhone || g.auditor_phone || '').replace(/\D/g, '').slice(-10);
    const expTime = new Date(g.expiresAt || g.expires_at || 0).getTime();
    return gPhone === cleanPhone && g.status === 'active' && expTime > now;
  });
};

export const getStoredModificationRequests = (campaignId?: string): ModificationRequest[] => {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(MODIFICATION_REQUESTS_KEY) : null;
    let list: ModificationRequest[] = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) list = [];

    if (campaignId) {
      const cleanId = String(campaignId).toLowerCase().trim();
      return list.filter(r => String(r.campaignId).toLowerCase().trim() === cleanId);
    }
    return list;
  } catch (e) {
    console.error('Failed to get stored modification requests:', e);
    return [];
  }
};

export const saveModificationRequest = (req: ModificationRequest): void => {
  try {
    const current = getStoredModificationRequests();
    const cleanId = String(req.id).trim();
    const nowIso = new Date().toISOString();
    const stamped = { ...req, createdAt: req.createdAt || nowIso, updatedAt: nowIso };
    const idx = current.findIndex(r => r.id === cleanId);
    let updated: ModificationRequest[];
    if (idx >= 0) {
      updated = [...current];
      updated[idx] = stamped;
    } else {
      updated = [stamped, ...current];
    }

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(MODIFICATION_REQUESTS_KEY, JSON.stringify(updated));
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ronpay_modification_requests_updated', { detail: updated }));
    }

    safeApiFetch('/api/modification-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(stamped),
    }).catch(() => {});

    recordAuditLog(
      'Modification Requested',
      `Modification requested for ${req.recordType} ${req.recordId} by ${req.requestedByName || req.requestedBy}. Reason: "${req.reasonNote}".`,
      'modification_request',
      req.id,
      req.requestedByName || req.requestedBy
    );
  } catch (e) {
    console.error('Failed to save modification request:', e);
  }
};

export const reviewModificationRequest = (
  requestId: string,
  decision: 'approved' | 'rejected',
  reviewer: string | { name: string; phone?: string; notes?: string },
  unlockDurationMinutes: number = 120,
  adminNotes?: string
): boolean => {
  try {
    const reviewerName = typeof reviewer === 'string' ? reviewer : (reviewer?.name || 'Admin');
    const reviewerNote = adminNotes || (typeof reviewer === 'object' ? reviewer?.notes : '') || '';

    const requests = getStoredModificationRequests();
    const target = requests.find(r => r.id === requestId);
    if (!target) return false;

    const now = new Date();
    const unlockExpiresAt = decision === 'approved' 
      ? new Date(now.getTime() + unlockDurationMinutes * 60 * 1000).toISOString()
      : undefined;

    let reviewedRequest: ModificationRequest | null = null;
    const updatedRequests = requests.map(r => {
      if (r.id === requestId) {
        reviewedRequest = {
          ...r,
          status: decision,
          approvedBy: reviewerName,
          approvedByName: reviewerName,
          reviewedBy: reviewerName,
          reviewed_by: reviewerName,
          reviewedAt: now.toISOString(),
          reviewed_at: now.toISOString(),
          reviewNotes: reviewerNote,
          admin_notes: reviewerNote,
          unlockExpiresAt,
          unlock_expires_at: unlockExpiresAt,
          updatedAt: now.toISOString(),
          updated_at: now.toISOString()
        };
        return reviewedRequest;
      }
      return r;
    });

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(MODIFICATION_REQUESTS_KEY, JSON.stringify(updatedRequests));
    }

    if (reviewedRequest) {
      safeApiFetch('/api/modification-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reviewedRequest),
      }).catch(() => {});
    }

    // If approved, temporarily unlock the transaction or expense
    if (decision === 'approved' && unlockExpiresAt) {
      const recId = target.recordId || target.record_id || '';
      const recType = String(target.recordType || target.record_type || '').toLowerCase();

      if (recType === 'transaction') {
        const txs = getStoredTransactions();
        const patchedTxs = txs.map(t => {
          if (String(t.id).toLowerCase().trim() === String(recId).toLowerCase().trim()) {
            return {
              ...t,
              unlock_expires_at: unlockExpiresAt,
              updatedAt: now.toISOString()
            };
          }
          return t;
        });
        saveStoredTransactions(patchedTxs, false);
      } else {
        const exps = getStoredExpenses();
        const patchedExps = exps.map(e => {
          if (String(e.id).toLowerCase().trim() === String(recId).toLowerCase().trim()) {
            return {
              ...e,
              unlock_expires_at: unlockExpiresAt,
              updatedAt: now.toISOString()
            };
          }
          return e;
        });
        saveStoredExpenses(patchedExps, false);
      }
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ronpay_modification_requests_updated', { detail: updatedRequests }));
    }

    recordAuditLog(
      decision === 'approved' ? 'Modification Approved' : 'Modification Rejected',
      `Request ${requestId} for ${target.recordType || target.record_type} ${target.recordId || target.record_id} was ${decision} by ${reviewerName}. Unlock window: ${unlockDurationMinutes}m. Notes: ${reviewerNote || 'None'}.`,
      'modification_request',
      requestId,
      reviewerName
    );

    return true;
  } catch (e) {
    console.error('Failed to review modification request:', e);
    return false;
  }
};

export const normalizeAuditorKey = (auditorPhone?: string, auditorName?: string): string => {
  const cleanPhone = String(auditorPhone || '').replace(/\D/g, '').slice(-10);
  if (cleanPhone.length === 10) return cleanPhone;
  const slug = String(auditorName || 'auditor').toLowerCase().trim().replace(/\s+/g, '_');
  return slug || 'auditor';
};

export const markBatchRecordsAuditVerification = (
  recordIds: string[],
  recordType: 'transaction' | 'expense',
  mark: 'verified' | 'flagged' | undefined,
  auditorName: string,
  queryNote?: string,
  forceUnlock?: boolean,
  auditorPhone?: string
): number => {
  if (!Array.isArray(recordIds) || recordIds.length === 0) return 0;
  const targetSet = new Set(recordIds.map(id => String(id || '').toLowerCase().trim()).filter(Boolean));
  if (targetSet.size === 0) return 0;

  const nowIso = new Date().toISOString();
  const isClearing = mark === undefined;
  const profile = getStoredCreatorProfile();
  const effPhone = auditorPhone || profile?.phone || '';
  const effName = auditorName || profile?.name || 'Auditor';
  const aKey = normalizeAuditorKey(effPhone, effName);

  const computeMultiAuditorState = (rec: any) => {
    const existingMap: Record<string, any> = {
      ...(rec.metadata?.auditor_verifications || {}),
      ...(rec.auditor_verifications || {})
    };
    if (isClearing) {
      // Mark all existing keys as 'unchecked' so undoing a record or head reliably resets it to unaudited
      for (const existingKey of Object.keys(existingMap)) {
        const prevEntry = existingMap[existingKey] || {};
        existingMap[existingKey] = {
          ...prevEntry,
          auditorKey: existingKey,
          mark: 'unchecked',
          query: '',
          markedAt: nowIso
        };
      }
      existingMap[aKey] = {
        auditorKey: aKey,
        auditorPhone: effPhone,
        auditorName: effName,
        mark: 'unchecked',
        query: '',
        markedAt: nowIso
      };
    } else {
      existingMap[aKey] = {
        auditorKey: aKey,
        auditorPhone: effPhone,
        auditorName: effName,
        mark,
        query: mark === 'flagged' ? (queryNote !== undefined ? queryNote : (existingMap[aKey]?.query || rec.audit_query || '')) : '',
        markedAt: nowIso
      };
    }

    const activeEntries = Object.values(existingMap).filter((v: any) => v && (v.mark === 'verified' || v.mark === 'flagged'));
    const flaggedEntries = activeEntries.filter((v: any) => v.mark === 'flagged');
    const verifiedEntries = activeEntries.filter((v: any) => v.mark === 'verified');

    let resolvedMark: 'verified' | 'flagged' | undefined = undefined;
    let resolvedQuery: string | undefined = undefined;
    let resolvedMarkedBy: string | undefined = undefined;
    let resolvedMarkedAt: string | undefined = undefined;

    if (flaggedEntries.length > 0) {
      resolvedMark = 'flagged';
      resolvedQuery = flaggedEntries.map((f: any) => `${f.auditorName}: ${f.query || 'Query'}`).join(' | ');
      resolvedMarkedBy = flaggedEntries.map((f: any) => f.auditorName).join(', ');
      resolvedMarkedAt = nowIso;
    } else if (verifiedEntries.length > 0) {
      resolvedMark = 'verified';
      resolvedMarkedBy = verifiedEntries.map((v: any) => v.auditorName).join(', ');
      resolvedMarkedAt = nowIso;
    }

    return {
      existingMap,
      resolvedMark,
      resolvedQuery,
      resolvedMarkedBy,
      resolvedMarkedAt
    };
  };

  let modifiedCount = 0;
  const syncItems: Array<{
    recordId: string;
    recordType: 'transaction' | 'expense';
    auditorKey: string;
    auditorName: string;
    auditorPhone: string;
    mark: 'verified' | 'flagged' | 'unchecked';
    query?: string;
    forceUnlock: boolean;
  }> = [];

  try {
    if (recordType === 'transaction') {
      const txs = getStoredTransactions();
      const modifiedTxs: Transaction[] = [];
      const updated = txs.map(t => {
        const cleanId = String(t.id || '').toLowerCase().trim();
        if (targetSet.has(cleanId)) {
          const shouldUnlock = isClearing || forceUnlock;
          const { existingMap, resolvedMark, resolvedQuery, resolvedMarkedBy, resolvedMarkedAt } = computeMultiAuditorState(t);
          const nextMeta = {
            ...(t.metadata || {}),
            audit_mark: resolvedMark || null,
            audit_query: resolvedQuery || null,
            audit_marked_by: resolvedMarkedBy || null,
            audit_marked_at: resolvedMarkedAt || null,
            auditor_verifications: existingMap,
            is_locked: shouldUnlock ? false : Boolean(t.is_locked)
          };
          const modifiedTx: Transaction = {
            ...t,
            audit_mark: resolvedMark,
            audit_query: resolvedQuery,
            audit_marked_by: resolvedMarkedBy,
            audit_marked_at: resolvedMarkedAt,
            auditor_verifications: existingMap,
            is_locked: shouldUnlock ? false : Boolean(t.is_locked),
            locked_by: shouldUnlock ? undefined : t.locked_by,
            locked_at: shouldUnlock ? undefined : t.locked_at,
            audit_date: shouldUnlock ? undefined : t.audit_date,
            audit_period: shouldUnlock ? undefined : t.audit_period,
            isSynced: false,
            updatedAt: nowIso,
            metadata: nextMeta
          };
          modifiedCount++;
          modifiedTxs.push(modifiedTx);
          syncItems.push({
            recordId: cleanId,
            recordType: 'transaction',
            auditorKey: aKey,
            auditorName: effName,
            auditorPhone: effPhone,
            mark: isClearing ? 'unchecked' : mark!,
            query: queryNote,
            forceUnlock: Boolean(isClearing || forceUnlock)
          });
          return modifiedTx;
        }
        return t;
      });
      if (modifiedCount > 0) {
        saveStoredTransactions(updated, false);
        import('../services/SupabaseSync').then(({ upsertTransaction }) => {
          modifiedTxs.forEach(tx => upsertTransaction(tx).catch(() => {}));
        }).catch(() => {});
        safeApiFetch('/api/audit/sync-action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: syncItems })
        }).catch(() => {});
      }
    } else {
      const exps = getStoredExpenses();
      const modifiedExps: KumtluangExpense[] = [];
      const updated = exps.map(e => {
        const cleanId = String(e.id || '').toLowerCase().trim();
        if (targetSet.has(cleanId)) {
          const shouldUnlock = isClearing || forceUnlock;
          const { existingMap, resolvedMark, resolvedQuery, resolvedMarkedBy, resolvedMarkedAt } = computeMultiAuditorState(e);
          const nextMeta = {
            ...(e.metadata || {}),
            audit_mark: resolvedMark || null,
            audit_query: resolvedQuery || null,
            audit_marked_by: resolvedMarkedBy || null,
            audit_marked_at: resolvedMarkedAt || null,
            auditor_verifications: existingMap,
            is_locked: shouldUnlock ? false : Boolean(e.is_locked)
          };
          const modifiedExp: KumtluangExpense = {
            ...e,
            audit_mark: resolvedMark,
            audit_query: resolvedQuery,
            audit_marked_by: resolvedMarkedBy,
            audit_marked_at: resolvedMarkedAt,
            auditor_verifications: existingMap,
            is_locked: shouldUnlock ? false : Boolean(e.is_locked),
            locked_by: shouldUnlock ? undefined : e.locked_by,
            locked_at: shouldUnlock ? undefined : e.locked_at,
            audit_date: shouldUnlock ? undefined : e.audit_date,
            audit_period: shouldUnlock ? undefined : e.audit_period,
            updatedAt: nowIso,
            metadata: nextMeta
          };
          modifiedCount++;
          modifiedExps.push(modifiedExp);
          syncItems.push({
            recordId: cleanId,
            recordType: 'expense',
            auditorKey: aKey,
            auditorName: effName,
            auditorPhone: effPhone,
            mark: isClearing ? 'unchecked' : mark!,
            query: queryNote,
            forceUnlock: Boolean(isClearing || forceUnlock)
          });
          return modifiedExp;
        }
        return e;
      });
      if (modifiedCount > 0) {
        saveStoredExpenses(updated, false);
        import('../services/SupabaseSync').then(({ upsertExpense }) => {
          modifiedExps.forEach(exp => upsertExpense(exp).catch(() => {}));
        }).catch(() => {});
        safeApiFetch('/api/audit/sync-action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: syncItems })
        }).catch(() => {});
      }
    }
    return modifiedCount;
  } catch (e) {
    console.error('Failed to batch mark record audit verification:', e);
    return 0;
  }
};

export const markRecordAuditVerification = (
  recordId: string,
  recordType: 'transaction' | 'expense',
  mark: 'verified' | 'flagged' | undefined,
  auditorName: string,
  queryNote?: string,
  forceUnlock?: boolean,
  auditorPhone?: string
): boolean => {
  return markBatchRecordsAuditVerification(
    [recordId],
    recordType,
    mark,
    auditorName,
    queryNote,
    forceUnlock,
    auditorPhone
  ) > 0;
};

export const lockCampaignAuditPeriod = (
  campaignId: string,
  auditor: string | { name: string; phone?: string },
  periodLabel: string,
  notes?: string,
  options?: { isDualAuditMode?: boolean; totalActiveAuditors?: number; forceFinalLock?: boolean }
): {
  lockedCount: number;
  lockedTransactionsCount: number;
  lockedExpensesCount: number;
  isAwaitingCoAuditor?: boolean;
  requiredAuditors?: number;
  signedAuditors?: string[];
} => {
  let txCount = 0;
  let expCount = 0;
  const nowIso = new Date().toISOString();
  const cleanCampId = String(campaignId).toLowerCase().trim();
  const profile = getStoredCreatorProfile();
  const auditorName = typeof auditor === 'string' ? auditor : auditor.name;
  const auditorPhone = typeof auditor === 'string' ? (profile?.phone || '') : (auditor.phone || profile?.phone || '');
  const aKey = normalizeAuditorKey(auditorPhone, auditorName);

  const camps = getStoredCampaigns();
  const targetCamp = camps.find(c => String(c.id).toLowerCase().trim() === cleanCampId);

  // Determine active appointed auditors for this campaign
  const allGrants = getStoredAuditorGrants().filter(
    g => String(g.campaignId || g.campaign_id || '').toLowerCase().trim() === cleanCampId && g.status === 'active'
  );
  const uniqueGrantKeys = new Set(allGrants.map(g => normalizeAuditorKey(g.auditorPhone || g.auditor_phone, g.auditorName || g.auditor_name)));
  const totalAuditors = options?.totalActiveAuditors ?? Math.max(1, uniqueGrantKeys.size);
  const isDualMode = options?.isDualAuditMode ?? (totalAuditors >= 2 || Boolean(targetCamp?.requireDualAuditorConsensus));

  // Record this auditor's sign-off in campaign.auditSignOffs
  const prevSignOffs = Array.isArray(targetCamp?.auditSignOffs) ? [...targetCamp!.auditSignOffs!] : [];
  const signMap = new Map<string, any>();
  for (const s of prevSignOffs) {
    if (s && s.auditorKey) signMap.set(String(s.auditorKey), s);
  }
  signMap.set(aKey, {
    auditorKey: aKey,
    auditorPhone: auditorPhone || 'N/A',
    auditorName,
    auditPeriod: periodLabel,
    signedAt: nowIso,
    notes: notes || ''
  });
  const mergedSignOffs = Array.from(signMap.values());
  const signedAuditorNames = mergedSignOffs.map(s => s.auditorName);

  // If Dual Audit Mode is active and only 1 auditor has signed so far (unless Admin forces final lock),
  // save the 1st Auditor's sign-off without locking records away from the 2nd Co-Auditor!
  const shouldWaitForCoAuditor = isDualMode && mergedSignOffs.length < 2 && !options?.forceFinalLock;

  if (shouldWaitForCoAuditor && targetCamp) {
    const partialCamp: Campaign = {
      ...targetCamp,
      auditSignOffs: mergedSignOffs,
      lastAuditPeriod: periodLabel,
      lastAuditNotes: notes || targetCamp.lastAuditNotes,
      updatedAt: nowIso,
      metadata: {
        ...(targetCamp.metadata || {}),
        auditSignOffs: mergedSignOffs
      }
    };
    saveCampaign(partialCamp);
    safeApiFetch('/api/audit/sync-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campaign: partialCamp })
    }).catch(() => {});

    recordAuditLog(
      'Co-Auditor First Sign-Off Recorded (1/2)',
      `Auditor ${auditorName} (${auditorPhone || 'N/A'}) signed off period [${periodLabel}] in campaign ${campaignId}. Waiting for Co-Auditor sign-off to finalize lock.`,
      'campaign',
      campaignId,
      auditorName
    );

    return {
      lockedCount: 0,
      lockedTransactionsCount: 0,
      lockedExpensesCount: 0,
      isAwaitingCoAuditor: true,
      requiredAuditors: Math.max(2, totalAuditors),
      signedAuditors: signedAuditorNames
    };
  }

  const finalLockedByLabel = signedAuditorNames.length > 1 ? signedAuditorNames.join(' & ') : auditorName;

  // 1. Lock matching transactions
  try {
    const txs = getStoredTransactions();
    let txChanged = false;
    const lockedTxsToSync: Transaction[] = [];
    const syncActionItems: any[] = [];
    const updatedTxs = txs.map(t => {
      if (String(t.campaignId).toLowerCase().trim() === cleanCampId) {
        if (!t.is_locked) txCount++;
        txChanged = true;
        const existingMap: Record<string, any> = {
          ...(t.metadata?.auditor_verifications || {}),
          ...(t.auditor_verifications || {})
        };
        if (!existingMap[aKey] || existingMap[aKey].mark !== 'flagged') {
          existingMap[aKey] = {
            auditorKey: aKey,
            auditorPhone,
            auditorName,
            mark: 'verified',
            query: '',
            markedAt: nowIso
          };
        }
        const lockedItem: Transaction = {
          ...t,
          is_locked: true,
          audit_date: nowIso,
          locked_by: finalLockedByLabel,
          audit_period: periodLabel,
          audit_notes: notes || t.audit_notes,
          audit_mark: t.audit_mark || 'verified',
          auditor_verifications: existingMap,
          unlock_expires_at: undefined,
          isSynced: false,
          updatedAt: nowIso,
          metadata: {
            ...(t.metadata || {}),
            is_locked: true,
            audit_date: nowIso,
            locked_by: finalLockedByLabel,
            audit_period: periodLabel,
            audit_notes: notes || t.audit_notes,
            audit_mark: t.audit_mark || 'verified',
            auditor_verifications: existingMap
          }
        };
        lockedTxsToSync.push(lockedItem);
        syncActionItems.push({
          recordId: t.id,
          recordType: 'transaction',
          auditorKey: aKey,
          auditorName,
          auditorPhone,
          mark: t.audit_mark || 'verified'
        });
        return lockedItem;
      }
      return t;
    });
    if (txChanged) {
      saveStoredTransactions(updatedTxs, false);
      import('../services/SupabaseSync').then(({ upsertTransaction }) => {
        lockedTxsToSync.forEach(lt => upsertTransaction(lt).catch(() => {}));
      }).catch(() => {});
    }
  } catch (e) {
    console.error('Failed to lock transactions for audit:', e);
  }

  // 2. Lock matching expenses
  try {
    const exps = getStoredExpenses();
    let expChanged = false;
    const lockedExpsToSync: KumtluangExpense[] = [];
    const updatedExps = exps.map(e => {
      if (String(e.campaignId).toLowerCase().trim() === cleanCampId) {
        if (!e.is_locked) expCount++;
        expChanged = true;
        const existingMap: Record<string, any> = {
          ...(e.metadata?.auditor_verifications || {}),
          ...(e.auditor_verifications || {})
        };
        if (!existingMap[aKey] || existingMap[aKey].mark !== 'flagged') {
          existingMap[aKey] = {
            auditorKey: aKey,
            auditorPhone,
            auditorName,
            mark: 'verified',
            query: '',
            markedAt: nowIso
          };
        }
        const lockedExp: KumtluangExpense = {
          ...e,
          is_locked: true,
          audit_date: nowIso,
          locked_by: finalLockedByLabel,
          audit_period: periodLabel,
          audit_notes: notes || e.audit_notes,
          audit_mark: e.audit_mark || 'verified',
          auditor_verifications: existingMap,
          unlock_expires_at: undefined,
          updatedAt: nowIso,
          metadata: {
            ...(e.metadata || {}),
            is_locked: true,
            audit_date: nowIso,
            locked_by: finalLockedByLabel,
            audit_period: periodLabel,
            audit_notes: notes || e.audit_notes,
            audit_mark: e.audit_mark || 'verified',
            auditor_verifications: existingMap
          }
        };
        lockedExpsToSync.push(lockedExp);
        return lockedExp;
      }
      return e;
    });
    if (expChanged) {
      saveStoredExpenses(updatedExps, false);
      import('../services/SupabaseSync').then(({ upsertExpense }) => {
        lockedExpsToSync.forEach(le => upsertExpense(le).catch(() => {}));
      }).catch(() => {});
    }
  } catch (e) {
    console.error('Failed to lock expenses for audit:', e);
  }

  // 3. Update campaign metadata with audit timestamp, sign-offs, and auditor info
  try {
    if (targetCamp) {
      const updatedCamp: Campaign = {
        ...targetCamp,
        auditSignOffs: mergedSignOffs,
        lastAuditedAt: nowIso,
        lastAuditedBy: finalLockedByLabel,
        lastAuditPeriod: periodLabel,
        lastAuditNotes: notes || targetCamp.lastAuditNotes,
        updatedAt: nowIso,
        metadata: {
          ...(targetCamp.metadata || {}),
          auditSignOffs: mergedSignOffs,
          lastAuditedAt: nowIso,
          lastAuditedBy: finalLockedByLabel,
          lastAuditPeriod: periodLabel,
          lastAuditNotes: notes || targetCamp.lastAuditNotes
        }
      };
      saveCampaign(updatedCamp);
      safeApiFetch('/api/audit/sync-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaign: updatedCamp })
      }).catch(() => {});
    }
  } catch {}

  // 4. Record immutable audit log
  recordAuditLog(
    'Financial Audit Signed & Locked',
    `Auditor ${finalLockedByLabel} (${auditorPhone || 'N/A'}) signed off and locked ${txCount + expCount} financial records for period [${periodLabel}] in campaign ${campaignId}. Notes: ${notes || 'None'}.`,
    'campaign',
    campaignId,
    finalLockedByLabel
  );

  return { 
    lockedCount: txCount + expCount,
    lockedTransactionsCount: txCount,
    lockedExpensesCount: expCount,
    isAwaitingCoAuditor: false,
    requiredAuditors: totalAuditors,
    signedAuditors: signedAuditorNames
  };
};

export const unlockSingleRecord = (
  recordId: string,
  recordType: 'transaction' | 'expense',
  unlockedBy: string,
  reason: string
): boolean => {
  const nowIso = new Date().toISOString();
  const cleanId = String(recordId).toLowerCase().trim();

  try {
    if (recordType === 'transaction') {
      const txs = getStoredTransactions();
      let unlockedTx: Transaction | null = null;
      const updated = txs.map(t => {
        if (String(t.id).toLowerCase().trim() === cleanId) {
          unlockedTx = {
            ...t,
            is_locked: false,
            unlock_expires_at: undefined,
            isSynced: false,
            updatedAt: nowIso
          };
          return unlockedTx;
        }
        return t;
      });
      saveStoredTransactions(updated, false);
      if (unlockedTx) {
        const txToSync = unlockedTx;
        import('../services/SupabaseSync').then(({ upsertTransaction }) => {
          upsertTransaction(txToSync).catch(() => {});
        }).catch(() => {});
      }
    } else {
      const exps = getStoredExpenses();
      let unlockedExp: KumtluangExpense | null = null;
      const updated = exps.map(e => {
        if (String(e.id).toLowerCase().trim() === cleanId) {
          unlockedExp = {
            ...e,
            is_locked: false,
            unlock_expires_at: undefined,
            updatedAt: nowIso
          };
          return unlockedExp;
        }
        return e;
      });
      saveStoredExpenses(updated, false);
      if (unlockedExp) {
        const expToSync = unlockedExp;
        import('../services/SupabaseSync').then(({ upsertExpense }) => {
          upsertExpense(expToSync).catch(() => {});
        }).catch(() => {});
      }
    }

    recordAuditLog(
      'Record Unlocked',
      `Record ${recordType} ${recordId} was unlocked by ${unlockedBy}. Reason: "${reason}".`,
      recordType === 'transaction' ? 'transaction' : 'expense',
      recordId,
      unlockedBy
    );
    return true;
  } catch (e) {
    console.error('Failed to unlock record:', e);
    return false;
  }
};
