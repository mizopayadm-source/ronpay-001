import { Transaction } from '../types';

export const ALL_MONTH_NAMES_FULL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
] as const;

export const ALL_MONTH_NAMES_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
] as const;

/**
 * Returns current month full name (e.g. "September")
 */
export const getCurrentMonthName = (): string => {
  const monthIdx = new Date().getMonth();
  return ALL_MONTH_NAMES_FULL[monthIdx] || 'September';
};

/**
 * Returns current year as string (e.g. "2026")
 */
export const getCurrentYearString = (): string => {
  return String(new Date().getFullYear());
};

/**
 * Returns current quarter string (e.g. "Q3 (Jul - Sep)")
 */
export const getCurrentQuarterString = (): string => {
  const monthIdx = new Date().getMonth();
  if (monthIdx < 3) return 'Q1 (Jan - Mar)';
  if (monthIdx < 6) return 'Q2 (Apr - Jun)';
  if (monthIdx < 9) return 'Q3 (Jul - Sep)';
  return 'Q4 (Oct - Dec)';
};

/**
 * Returns current month and year string (e.g. "September 2026")
 */
export const getCurrentMonthYearString = (): string => {
  return `${getCurrentMonthName()} ${getCurrentYearString()}`;
};

/**
 * Generates rolling month list (e.g. for last 6 months + next 6 months)
 */
export const getRollingMonthYearList = (pastMonths = 6, futureMonths = 6): string[] => {
  const list: string[] = [];
  const now = new Date();
  for (let i = -pastMonths; i <= futureMonths; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const monthName = ALL_MONTH_NAMES_FULL[d.getMonth()];
    const year = d.getFullYear();
    list.push(`${monthName} ${year}`);
  }
  return list;
};

/**
 * Generates array of years centered around current year (e.g. ['2025', '2026', '2027', '2028'])
 */
export const getYearOptions = (pastYears = 1, futureYears = 3): string[] => {
  const currentYear = new Date().getFullYear();
  const years: string[] = [];
  for (let y = currentYear - pastYears; y <= currentYear + futureYears; y++) {
    years.push(String(y));
  }
  return years;
};

/**
 * Normalizes any month string (e.g. "March", "mar", "MAR", "03", "3") to index (0-11)
 */
export const getMonthIndex = (monthStr?: string | null): number => {
  if (!monthStr) return -1;
  const s = monthStr.trim().toLowerCase();

  // Check 1-12 numeric string
  const num = parseInt(s, 10);
  if (!isNaN(num) && num >= 1 && num <= 12 && String(num) === s) {
    return num - 1;
  }

  // Check full names
  const fullIdx = ALL_MONTH_NAMES_FULL.findIndex(m => m.toLowerCase() === s || s.startsWith(m.toLowerCase()));
  if (fullIdx !== -1) return fullIdx;

  // Check short names (3 letters)
  const shortIdx = ALL_MONTH_NAMES_SHORT.findIndex(m => m.toLowerCase() === s || s.startsWith(m.toLowerCase()));
  if (shortIdx !== -1) return shortIdx;

  return -1;
};

/**
 * Extracts normalized month information from a transaction:
 * Respects `periodMonth` first, then falls back to `timestamp`.
 */
export const getTransactionMonthInfo = (tx: Transaction): {
  monthIndex: number;
  shortMonth: string;
  fullMonth: string;
  year: string;
  periodLabel: string;
} => {
  let monthIdx = -1;
  let year = tx.periodYear || '';

  if (tx.periodMonth) {
    monthIdx = getMonthIndex(tx.periodMonth);
  }

  // Fallback to timestamp if month was not recognized
  if (monthIdx === -1) {
    try {
      const d = new Date(tx.timestamp);
      if (!isNaN(d.getTime())) {
        monthIdx = d.getMonth();
        if (!year) {
          year = String(d.getFullYear());
        }
      }
    } catch {
      monthIdx = new Date().getMonth();
    }
  }

  if (monthIdx === -1) {
    monthIdx = new Date().getMonth();
  }

  if (!year) {
    try {
      year = String(new Date(tx.timestamp).getFullYear() || new Date().getFullYear());
    } catch {
      year = String(new Date().getFullYear());
    }
  }

  const shortMonth = ALL_MONTH_NAMES_SHORT[monthIdx] || 'Jan';
  const fullMonth = ALL_MONTH_NAMES_FULL[monthIdx] || 'January';
  const periodLabel = tx.periodLabel || `${fullMonth} ${year}`;

  return {
    monthIndex: monthIdx,
    shortMonth,
    fullMonth,
    year,
    periodLabel,
  };
};

/**
 * Checks if a transaction belongs to a given month
 * Matches flexible inputs like 'Jan', 'January', 'March', 'Mar', etc.
 */
export const isTransactionInMonth = (tx: Transaction, targetMonth: string): boolean => {
  if (!targetMonth) return false;
  const targetIdx = getMonthIndex(targetMonth);
  if (targetIdx === -1) return false;

  const info = getTransactionMonthInfo(tx);
  return info.monthIndex === targetIdx;
};

/**
 * Checks if a transaction matches a period filter (e.g. 'all', 'March', 'March 2026', 'Q1', '2026')
 */
export const isTransactionInPeriodFilter = (tx: Transaction, filterStr: string): boolean => {
  if (!filterStr || filterStr === 'all') return true;

  const filterLower = filterStr.trim().toLowerCase();
  const info = getTransactionMonthInfo(tx);

  // 1. Direct match on month index / name
  const filterMonthIdx = getMonthIndex(filterLower);
  if (filterMonthIdx !== -1 && info.monthIndex === filterMonthIdx) {
    // If filter also specifies a year (e.g. "March 2026"), verify year as well
    const yearMatch = filterLower.match(/\b(202\d|203\d)\b/);
    if (yearMatch) {
      return info.year === yearMatch[1];
    }
    return true;
  }

  // 2. Quarter match (Q1: Jan-Mar, Q2: Apr-Jun, Q3: Jul-Sep, Q4: Oct-Dec)
  if (filterLower.includes('q1') || filterLower.includes('quarter 1')) {
    return info.monthIndex >= 0 && info.monthIndex <= 2;
  }
  if (filterLower.includes('q2') || filterLower.includes('quarter 2')) {
    return info.monthIndex >= 3 && info.monthIndex <= 5;
  }
  if (filterLower.includes('q3') || filterLower.includes('quarter 3')) {
    return info.monthIndex >= 6 && info.monthIndex <= 8;
  }
  if (filterLower.includes('q4') || filterLower.includes('quarter 4')) {
    return info.monthIndex >= 9 && info.monthIndex <= 11;
  }

  // 3. Year only match (e.g. "2026")
  if (/^202\d|203\d$/.test(filterLower.trim())) {
    return info.year === filterLower.trim();
  }

  // 4. Period label fuzzy match
  if (tx.periodLabel && tx.periodLabel.toLowerCase().includes(filterLower)) {
    return true;
  }

  if (tx.periodMonth && tx.periodMonth.toLowerCase().includes(filterLower)) {
    return true;
  }

  if (info.fullMonth.toLowerCase().includes(filterLower) || info.shortMonth.toLowerCase().includes(filterLower)) {
    return true;
  }

  return false;
};
