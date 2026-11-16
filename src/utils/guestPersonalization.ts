import { CreatorProfile } from '../types';

export interface VisitedCampaignSummary {
  id: string;
  title: string;
  category?: string;
  imageUrl?: string;
  targetAmount?: number;
  creatorName?: string;
  visitedAt: string;
}

export interface GuestActivity {
  visitCount: number;
  firstVisitedAt: string;
  lastVisitedAt: string;
  visitedCampaigns: VisitedCampaignSummary[];
  lastDonorPhone?: string;
  lastDonorName?: string;
  recentReceiptIds: string[];
  reengagementBannerDismissedAt?: string;
  pwaBannerDismissedAt?: string;
  pushPromptDismissedAt?: string;
}

const GUEST_ACTIVITY_KEY = 'ronpay_guest_activity_v1';

export const getGuestActivity = (): GuestActivity => {
  if (typeof window === 'undefined') {
    return {
      visitCount: 1,
      firstVisitedAt: new Date().toISOString(),
      lastVisitedAt: new Date().toISOString(),
      visitedCampaigns: [],
      recentReceiptIds: [],
    };
  }

  try {
    const raw = localStorage.getItem(GUEST_ACTIVITY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        let lastDonorPhone = parsed.lastDonorPhone || undefined;
        let lastDonorName = parsed.lastDonorName || undefined;

        // Prevent cross-user leakage: if a user is logged in with a verified phone that differs from lastDonorPhone, strip the stale donor identity
        try {
          const rawProfile = localStorage.getItem('ronpay_creator_profile');
          if (rawProfile) {
            const prof = JSON.parse(rawProfile);
            const profPhone = (prof?.phone || '').replace(/\D/g, '').slice(-10);
            const donorPhone10 = (lastDonorPhone || '').replace(/\D/g, '').slice(-10);
            if (profPhone && profPhone !== '9999999999' && donorPhone10 && donorPhone10 !== profPhone) {
              lastDonorPhone = undefined;
              lastDonorName = undefined;
              delete parsed.lastDonorPhone;
              delete parsed.lastDonorName;
              localStorage.setItem(GUEST_ACTIVITY_KEY, JSON.stringify(parsed));
            }
          }
        } catch {}

        return {
          visitCount: Number(parsed.visitCount) || 1,
          firstVisitedAt: parsed.firstVisitedAt || new Date().toISOString(),
          lastVisitedAt: parsed.lastVisitedAt || new Date().toISOString(),
          visitedCampaigns: Array.isArray(parsed.visitedCampaigns) ? parsed.visitedCampaigns : [],
          lastDonorPhone,
          lastDonorName,
          recentReceiptIds: Array.isArray(parsed.recentReceiptIds) ? parsed.recentReceiptIds : [],
          reengagementBannerDismissedAt: parsed.reengagementBannerDismissedAt,
          pwaBannerDismissedAt: parsed.pwaBannerDismissedAt,
          pushPromptDismissedAt: parsed.pushPromptDismissedAt,
        };
      }
    }
  } catch (e) {
    console.warn('[RonPay] Failed to parse guest activity:', e);
  }

  const initial: GuestActivity = {
    visitCount: 1,
    firstVisitedAt: new Date().toISOString(),
    lastVisitedAt: new Date().toISOString(),
    visitedCampaigns: [],
    recentReceiptIds: [],
  };
  try {
    localStorage.setItem(GUEST_ACTIVITY_KEY, JSON.stringify(initial));
  } catch {}
  return initial;
};

export const saveGuestActivity = (activity: GuestActivity): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(GUEST_ACTIVITY_KEY, JSON.stringify(activity));
    window.dispatchEvent(new CustomEvent('ronpay_guest_activity_updated', { detail: activity }));
  } catch (e) {
    console.warn('[RonPay] Failed to save guest activity:', e);
  }
};

/**
 * Records a page session visit. If last visited > 2 minutes ago, increments visitCount.
 */
export const recordGuestVisit = (): GuestActivity => {
  const current = getGuestActivity();
  const now = new Date();
  const lastTime = current.lastVisitedAt ? new Date(current.lastVisitedAt).getTime() : 0;
  const diffMinutes = (now.getTime() - lastTime) / (1000 * 60);

  // Consider it a distinct repeat visit if more than 2 minutes elapsed or first time
  let updatedVisitCount = current.visitCount;
  if (diffMinutes > 2) {
    updatedVisitCount += 1;
  }

  const updated: GuestActivity = {
    ...current,
    visitCount: updatedVisitCount,
    lastVisitedAt: now.toISOString(),
  };

  saveGuestActivity(updated);
  return updated;
};

/**
 * Caches recently visited campaign in browser LocalStorage
 */
export const recordGuestCampaignVisit = (campaign: {
  id: string;
  title: string;
  category?: string;
  imageUrl?: string;
  targetAmount?: number;
  creatorName?: string;
}): void => {
  if (!campaign || !campaign.id) return;
  const current = getGuestActivity();
  const now = new Date().toISOString();

  const newSummary: VisitedCampaignSummary = {
    id: campaign.id,
    title: campaign.title,
    category: campaign.category,
    imageUrl: campaign.imageUrl,
    targetAmount: campaign.targetAmount,
    creatorName: campaign.creatorName,
    visitedAt: now,
  };

  // Prepend & deduplicate (max 5 campaigns)
  const filtered = current.visitedCampaigns.filter(c => c.id !== campaign.id);
  const updatedCampaigns = [newSummary, ...filtered].slice(0, 5);

  const updated: GuestActivity = {
    ...current,
    visitedCampaigns: updatedCampaigns,
    lastVisitedAt: now,
  };

  saveGuestActivity(updated);
};

/**
 * Caches recent transaction details (phone number, name, receipt ID)
 * Only stores lastDonorPhone / lastDonorName when an unauthenticated Guest is transacting for themselves,
 * never when an Admin/Collector/Member/Auditor enters a Quick Entry or Cash transaction for another member.
 */
export const recordGuestTransactionActivity = (tx: {
  id: string;
  donorPhone?: string;
  donorName?: string;
  campaignId?: string;
}): void => {
  if (!tx || !tx.id) return;
  const current = getGuestActivity();

  let shouldRecordDonorIdentity = true;
  try {
    const rawProfile = typeof window !== 'undefined' ? localStorage.getItem('ronpay_creator_profile') : null;
    if (rawProfile) {
      const prof = JSON.parse(rawProfile);
      const profPhone = (prof?.phone || '').replace(/\D/g, '').slice(-10);
      const profRole = (prof?.role || '').toUpperCase();
      if (profPhone && profPhone !== '9999999999' && profRole !== 'GUEST') {
        // A logged-in non-guest user is active; do not pollute guest donor identity with third-party member entries
        shouldRecordDonorIdentity = false;
      }
    }
  } catch {}

  const receipts = current.recentReceiptIds.filter(id => id !== tx.id);
  const updatedReceipts = [tx.id, ...receipts].slice(0, 10);

  const updated: GuestActivity = {
    ...current,
    lastDonorPhone: shouldRecordDonorIdentity && tx.donorPhone ? tx.donorPhone.trim() : current.lastDonorPhone,
    lastDonorName: shouldRecordDonorIdentity && tx.donorName ? tx.donorName.trim() : current.lastDonorName,
    recentReceiptIds: updatedReceipts,
  };

  saveGuestActivity(updated);
};

/**
 * Checks whether the current user is a repeat guest visitor:
 * - Profile is genuinely an unauthenticated Guest (not a logged-in Creator, Admin, Auditor, or Member)
 * - Has visited 2 or more times, OR has cached campaigns/receipts from a prior session
 */
export const isRepeatGuestVisitor = (profile?: CreatorProfile): boolean => {
  if (typeof window === 'undefined') return false;

  // If user is logged in with a real phone number and non-GUEST role (Creator, Admin, Auditor, Member), they are NOT a guest
  if (profile && profile.phone && profile.phone !== '9999999999' && profile.role !== 'GUEST') {
    return false;
  }

  const activity = getGuestActivity();
  const hasHistory = (activity.visitedCampaigns && activity.visitedCampaigns.length > 0) ||
                     (activity.recentReceiptIds && activity.recentReceiptIds.length > 0) ||
                     Boolean(activity.lastDonorPhone);

  return activity.visitCount >= 2 || hasHistory;
};

/**
 * Dismiss a banner with a snooze timeout (default 12 hours)
 */
export const dismissGuestBanner = (type: 'reengagement' | 'pwa' | 'push'): void => {
  const current = getGuestActivity();
  const now = new Date().toISOString();

  if (type === 'reengagement') {
    current.reengagementBannerDismissedAt = now;
  } else if (type === 'pwa') {
    current.pwaBannerDismissedAt = now;
  } else if (type === 'push') {
    current.pushPromptDismissedAt = now;
  }

  saveGuestActivity(current);
};

/**
 * Checks if banner is currently snoozed/dismissed
 */
export const isGuestBannerDismissed = (type: 'reengagement' | 'pwa' | 'push', snoozeHours: number = 12): boolean => {
  const current = getGuestActivity();
  let dismissedAt: string | undefined;

  if (type === 'reengagement') {
    dismissedAt = current.reengagementBannerDismissedAt;
  } else if (type === 'pwa') {
    dismissedAt = current.pwaBannerDismissedAt;
  } else if (type === 'push') {
    dismissedAt = current.pushPromptDismissedAt;
  }

  if (!dismissedAt) return false;
  const time = new Date(dismissedAt).getTime();
  const now = Date.now();
  const diffHours = (now - time) / (1000 * 60 * 60);
  return diffHours < snoozeHours;
};
