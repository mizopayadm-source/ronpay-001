/**
 * Date and Time utilities for RonPay adhering strictly to DD/MM/YYYY format.
 */

export const formatDateDDMMYYYY = (dateInput?: string | Date | number | null): string => {
  if (!dateInput) return '—';
  try {
    const d = typeof dateInput === 'object' && dateInput instanceof Date 
      ? dateInput 
      : new Date(dateInput);
    if (isNaN(d.getTime())) return String(dateInput);
    
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return String(dateInput);
  }
};

export const formatDateTimeDDMMYYYY = (dateInput?: string | Date | number | null): string => {
  if (!dateInput) return '—';
  try {
    const d = typeof dateInput === 'object' && dateInput instanceof Date 
      ? dateInput 
      : new Date(dateInput);
    if (isNaN(d.getTime())) return String(dateInput);
    
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // 0 should be 12
    const strHours = String(hours).padStart(2, '0');
    
    return `${day}/${month}/${year}, ${strHours}:${minutes} ${ampm}`;
  } catch {
    return String(dateInput);
  }
};

export const isCampaignExpired = (validityDate?: string, status?: string): boolean => {
  if (status === 'expired') return true;
  if (!validityDate) return false;
  try {
    const deadline = new Date(validityDate).getTime();
    const now = new Date().getTime();
    return now > deadline;
  } catch {
    return false;
  }
};

export interface CreatorExpiryInfo {
  expiresAt: string;
  daysRemaining: number;
  hoursRemaining: number;
  formattedExpiryDate: string;
  isExpiringSoon: boolean; // <= 7 days && >= 0
  isExpired: boolean; // <= 0
  isPermanentFree: boolean;
  planTypeLabel: string;
  urgencyLevel: 'vip' | 'safe' | 'warning' | 'urgent' | 'expired';
}

export const getCreatorExpiryStatus = (
  creator?: {
    trialExpiresAt?: string;
    subscriptionExpiresAt?: string;
    subscriptionPlan?: string;
    isFreeServiceGranted?: boolean;
    registeredAt?: string;
    customTrialDays?: number;
  } | null,
  globalTrialDays: number = 30
): CreatorExpiryInfo => {
  if (!creator) {
    return {
      expiresAt: '',
      daysRemaining: 30,
      hoursRemaining: 720,
      formattedExpiryDate: '—',
      isExpiringSoon: false,
      isExpired: false,
      isPermanentFree: false,
      planTypeLabel: 'Free Trial',
      urgencyLevel: 'safe',
    };
  }

  if (creator.isFreeServiceGranted) {
    return {
      expiresAt: 'Permanent',
      daysRemaining: 9999,
      hoursRemaining: 99999,
      formattedExpiryDate: 'Permanent (VIP Free)',
      isExpiringSoon: false,
      isExpired: false,
      isPermanentFree: true,
      planTypeLabel: 'Admin Granted (Lifetime Free)',
      urgencyLevel: 'vip',
    };
  }

  // Determine expiration date
  let expiryDateStr = creator.subscriptionExpiresAt || creator.trialExpiresAt;
  if (!expiryDateStr) {
    // If not set, derive from registeredAt or default 30 days from now
    const baseDate = creator.registeredAt ? new Date(creator.registeredAt) : new Date();
    const trialDays = creator.customTrialDays ?? globalTrialDays ?? 30;
    const defaultExpiry = new Date(baseDate.getTime() + trialDays * 24 * 60 * 60 * 1000);
    expiryDateStr = defaultExpiry.toISOString();
  }

  const expiryTime = new Date(expiryDateStr).getTime();
  const nowTime = Date.now();
  const diffMs = expiryTime - nowTime;
  const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const hoursRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60)));

  const isExpired = diffMs <= 0;
  const isExpiringSoon = !isExpired && daysRemaining <= 7;

  let urgencyLevel: 'vip' | 'safe' | 'warning' | 'urgent' | 'expired' = 'safe';
  if (isExpired) {
    urgencyLevel = 'expired';
  } else if (daysRemaining <= 2) {
    urgencyLevel = 'urgent';
  } else if (daysRemaining <= 7) {
    urgencyLevel = 'warning';
  }

  let planLabel = 'Free Trial';
  if (creator.subscriptionPlan === 'monthly') planLabel = 'Monthly Plan';
  else if (creator.subscriptionPlan === 'quarterly') planLabel = 'Quarterly Plan';
  else if (creator.subscriptionPlan === 'halfYearly') planLabel = 'Half-Yearly Plan';
  else if (creator.subscriptionPlan === 'yearly') planLabel = 'Yearly Plan';
  else if (creator.trialExpiresAt) planLabel = 'Free Trial Period';

  return {
    expiresAt: expiryDateStr,
    daysRemaining: isExpired ? 0 : daysRemaining,
    hoursRemaining,
    formattedExpiryDate: formatDateDDMMYYYY(expiryDateStr),
    isExpiringSoon,
    isExpired,
    isPermanentFree: false,
    planTypeLabel: planLabel,
    urgencyLevel,
  };
};
