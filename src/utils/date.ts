/**
 * Date and Time utilities for RonPay adhering strictly to DD/MM/YYYY format.
 */

export const formatDateDDMMYYYY = (dateInput?: string | Date | number | null): string => {
  if (!dateInput) return '—';
  try {
    // If already in DD/MM/YYYY or DD-MM-YYYY format
    if (typeof dateInput === 'string') {
      const trimmed = dateInput.trim();
      if (!trimmed) return '—';

      const ddmmyyyyMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
      if (ddmmyyyyMatch) {
        const d = ddmmyyyyMatch[1].padStart(2, '0');
        const m = ddmmyyyyMatch[2].padStart(2, '0');
        const y = ddmmyyyyMatch[3];
        return `${d}/${m}/${y}`;
      }
    }

    const d = typeof dateInput === 'object' && dateInput instanceof Date 
      ? dateInput 
      : new Date(dateInput);
    if (isNaN(d.getTime())) return String(dateInput);
    
    // Format using Indian Standard Time (Asia/Kolkata)
    const formatter = new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
    const parts = formatter.formatToParts(d);
    const day = parts.find(p => p.type === 'day')?.value || String(d.getDate()).padStart(2, '0');
    const month = parts.find(p => p.type === 'month')?.value || String(d.getMonth() + 1).padStart(2, '0');
    const year = parts.find(p => p.type === 'year')?.value || String(d.getFullYear());
    return `${day}/${month}/${year}`;
  } catch {
    return String(dateInput);
  }
};

export const formatDateTimeDDMMYYYY = (dateInput?: string | Date | number | null): string => {
  if (!dateInput) return '—';
  try {
    // If string already formatted in DD/MM/YYYY, HH:mm AM/PM without ISO T
    if (typeof dateInput === 'string' && !dateInput.includes('T')) {
      const ddmmyyyyMatch = dateInput.trim().match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:[,\s]+(\d{1,2}):(\d{2})(?:\s*(AM|PM))?)?/i);
      if (ddmmyyyyMatch && ddmmyyyyMatch[4]) {
        const d = ddmmyyyyMatch[1].padStart(2, '0');
        const m = ddmmyyyyMatch[2].padStart(2, '0');
        const y = ddmmyyyyMatch[3];
        const hr = ddmmyyyyMatch[4].padStart(2, '0');
        const min = ddmmyyyyMatch[5].padStart(2, '0');
        const ampm = ddmmyyyyMatch[6] ? ddmmyyyyMatch[6].toUpperCase() : '';
        return `${d}/${m}/${y}, ${hr}:${min}${ampm ? ` ${ampm}` : ''}`;
      }
    }

    const d = typeof dateInput === 'object' && dateInput instanceof Date 
      ? dateInput 
      : new Date(dateInput);
    if (isNaN(d.getTime())) return String(dateInput);
    
    // Format in Indian Standard Time (Asia/Kolkata, UTC+5:30)
    const formatter = new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });

    const parts = formatter.formatToParts(d);
    const day = parts.find(p => p.type === 'day')?.value || String(d.getDate()).padStart(2, '0');
    const month = parts.find(p => p.type === 'month')?.value || String(d.getMonth() + 1).padStart(2, '0');
    const year = parts.find(p => p.type === 'year')?.value || String(d.getFullYear());
    const hour = parts.find(p => p.type === 'hour')?.value || '12';
    const minute = parts.find(p => p.type === 'minute')?.value || '00';
    const dayPeriod = (parts.find(p => p.type === 'dayPeriod')?.value || 'AM').toUpperCase();

    return `${day}/${month}/${year}, ${hour}:${minute} ${dayPeriod}`;
  } catch {
    return String(dateInput);
  }
};

export const isCampaignExpired = (validityDate?: string, status?: string): boolean => {
  if (status === 'expired' || status === 'cancelled' || status === 'archived' || status === 'rejected') return true;
  if (!validityDate) return false;
  try {
    const deadline = new Date(validityDate).getTime();
    const now = new Date().getTime();
    return now > deadline;
  } catch {
    return false;
  }
};

/**
 * Returns YYYY-MM-DD for current date (or with day offset).
 */
export const getCurrentDateString = (daysOffset = 0): string => {
  const d = new Date();
  if (daysOffset !== 0) {
    d.setDate(d.getDate() + daysOffset);
  }
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Returns YYYY-MM-01 for current month's start.
 */
export const getCurrentMonthStartString = (): string => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}-01`;
};

/**
 * Returns YYYY-MM-DD for current month's end.
 */
export const getCurrentMonthEndString = (): string => {
  const d = new Date();
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const lastDay = new Date(year, month, 0).getDate();
  const strMonth = String(month).padStart(2, '0');
  const strDay = String(lastDay).padStart(2, '0');
  return `${year}-${strMonth}-${strDay}`;
};

/**
 * Returns YYYY-MM-01 for last month's start.
 */
export const getLastMonthStartString = (): string => {
  const d = new Date();
  const year = d.getMonth() === 0 ? d.getFullYear() - 1 : d.getFullYear();
  const month = d.getMonth() === 0 ? 12 : d.getMonth();
  const strMonth = String(month).padStart(2, '0');
  return `${year}-${strMonth}-01`;
};

/**
 * Returns YYYY-MM-DD for last month's end.
 */
export const getLastMonthEndString = (): string => {
  const d = new Date();
  const year = d.getMonth() === 0 ? d.getFullYear() - 1 : d.getFullYear();
  const month = d.getMonth() === 0 ? 12 : d.getMonth();
  const lastDay = new Date(year, month, 0).getDate();
  const strMonth = String(month).padStart(2, '0');
  const strDay = String(lastDay).padStart(2, '0');
  return `${year}-${strMonth}-${strDay}`;
};

/**
 * Returns YYYY-01-01 for current year's start.
 */
export const getCurrentYearStartString = (): string => {
  const year = new Date().getFullYear();
  return `${year}-01-01`;
};

/**
 * Returns YYYY-12-31 for current year's end.
 */
export const getCurrentYearEndString = (): string => {
  const year = new Date().getFullYear();
  return `${year}-12-31`;
};

/**
 * Returns a local ISO string formatted for input[type="datetime-local"] (YYYY-MM-DDTHH:mm).
 * Defaults to Today's date with end of day time (23:59).
 */
export const getTodayDateTimeLocal = (hours = 23, minutes = 59, daysOffset = 0): string => {
  const d = new Date();
  if (daysOffset !== 0) {
    d.setDate(d.getDate() + daysOffset);
  }
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hr = String(hours).padStart(2, '0');
  const min = String(minutes).padStart(2, '0');
  return `${year}-${month}-${day}T${hr}:${min}`;
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
