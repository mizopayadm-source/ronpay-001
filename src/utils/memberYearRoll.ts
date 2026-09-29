import { MemberRecord } from '../types';

/**
 * Returns all active years for a member.
 * If not explicitly specified, defaults based on enrollmentYear or createdAt, with sensible fallbacks.
 */
export function getMemberActiveYears(member: MemberRecord): string[] {
  if (member.activeYears && member.activeYears.length > 0) {
    return [...member.activeYears].sort();
  }
  const createdYear = member.createdAt ? new Date(member.createdAt).getFullYear().toString() : '2026';
  const enrollYear = member.enrollmentYear ? String(member.enrollmentYear) : createdYear;
  // Fallback defaults to preserve historical continuity
  const defaults = new Set<string>([enrollYear, '2025', '2026']);
  return Array.from(defaults).sort();
}

/**
 * Determines whether a member is considered active in a specific year.
 */
export function isMemberActiveInYear(member: MemberRecord, targetYear: string): boolean {
  if (!targetYear || targetYear === 'all') return true;

  // 1. Explicit yearStatus record takes highest priority
  if (member.yearStatus && member.yearStatus[targetYear]) {
    return member.yearStatus[targetYear].status === 'active';
  }

  // 2. Global deactivated flag
  if (member.isDeactivated && (!member.yearStatus || !member.yearStatus[targetYear])) {
    return false;
  }

  // 3. activeYears array
  if (member.activeYears && member.activeYears.length > 0) {
    return member.activeYears.includes(targetYear);
  }

  // 4. Default: active if enrolled on or before target year
  const enrollYear = parseInt(
    String(member.enrollmentYear || (member.createdAt ? new Date(member.createdAt).getFullYear() : '2026')),
    10
  );
  const checkYear = parseInt(targetYear, 10);
  if (!isNaN(enrollYear) && !isNaN(checkYear)) {
    return checkYear >= enrollYear;
  }

  return true;
}

/**
 * Gets a human-readable badge text and color for member's status in a year
 */
export function getMemberYearStatusInfo(member: MemberRecord, year: string): {
  status: 'active' | 'transferred_out' | 'deceased' | 'inactive';
  label: string;
  badgeClass: string;
  reason?: string;
} {
  if (member.yearStatus && member.yearStatus[year]) {
    const s = member.yearStatus[year];
    if (s.status === 'transferred_out') {
      return {
        status: 'transferred_out',
        label: 'Pem Chhuak',
        badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
        reason: s.reason || 'Bial / Veng dangah a pem'
      };
    }
    if (s.status === 'deceased') {
      return {
        status: 'deceased',
        label: 'Boral',
        badgeClass: 'bg-slate-200 text-slate-800 border-slate-400',
        reason: s.reason || 'Chhiatna / Boral'
      };
    }
    if (s.status === 'inactive') {
      return {
        status: 'inactive',
        label: 'Chawl Lailawk',
        badgeClass: 'bg-rose-100 text-rose-800 border-rose-300',
        reason: s.reason || 'Roll-ah telh loh'
      };
    }
  }

  const isActive = isMemberActiveInYear(member, year);
  if (isActive) {
    return {
      status: 'active',
      label: 'Active (Inchhiar)',
      badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300'
    };
  }

  return {
    status: 'inactive',
    label: 'Inactive',
    badgeClass: 'bg-slate-100 text-slate-600 border-slate-200',
    reason: member.deactivatedReason || 'Kum bi roll-ah telh a ni lo'
  };
}

/**
 * Rolls over (copies forward) members from sourceYear to targetYear.
 * This does not erase past history; it simply enrolls active members into the new target year.
 */
export function rolloverMembersToNewYear(
  allMembers: MemberRecord[],
  sourceYear: string,
  targetYear: string,
  campaignId?: string
): {
  updatedMembers: MemberRecord[];
  rolledOverCount: number;
  skippedCount: number;
} {
  const now = new Date().toISOString();
  let rolledOverCount = 0;
  let skippedCount = 0;

  const updatedMembers = allMembers.map(m => {
    // If campaignId filter is provided, only rollover members of this campaign
    if (campaignId && campaignId !== 'all' && m.campaignId !== campaignId) {
      return m;
    }

    // Check if member was active in sourceYear
    const wasActiveInSource = isMemberActiveInYear(m, sourceYear);
    if (!wasActiveInSource) {
      skippedCount++;
      return m;
    }

    const currentYears = new Set(getMemberActiveYears(m));
    currentYears.add(targetYear);

    const updatedYearStatus = {
      ...(m.yearStatus || {}),
      [targetYear]: {
        status: 'active' as const,
        reason: `Kum ${sourceYear} atanga chhawm (Rollover)`,
        section: m.section,
        pledgeAmount: m.pledgeAmount,
        updatedAt: now
      }
    };

    rolledOverCount++;

    return {
      ...m,
      activeYears: Array.from(currentYears).sort(),
      yearStatus: updatedYearStatus
    };
  });

  return { updatedMembers, rolledOverCount, skippedCount };
}

/**
 * Marks a member's status for a specific year (e.g. Pem Chhuak, Boral, Chawl lailawk, Active)
 */
export function updateMemberYearStatus(
  member: MemberRecord,
  year: string,
  newStatus: 'active' | 'transferred_out' | 'deceased' | 'inactive',
  reason?: string
): MemberRecord {
  const now = new Date().toISOString();
  const currentYears = new Set(getMemberActiveYears(member));

  if (newStatus === 'active') {
    currentYears.add(year);
  } else {
    currentYears.delete(year);
  }

  const updatedYearStatus = {
    ...(member.yearStatus || {}),
    [year]: {
      status: newStatus,
      reason: reason || (newStatus === 'active' ? 'Re-activated in roll' : 'Removed from year roll'),
      updatedAt: now
    }
  };

  return {
    ...member,
    activeYears: Array.from(currentYears).sort(),
    yearStatus: updatedYearStatus
  };
}

/**
 * Returns sorted list of available years for UI selection (e.g. ['2027', '2026', '2025', '2024'])
 */
export function getAvailableRollYears(members: MemberRecord[] = []): string[] {
  const years = new Set<string>(['2024', '2025', '2026', '2027']);
  const curr = new Date().getFullYear();
  years.add(String(curr));
  years.add(String(curr + 1));

  members.forEach(m => {
    if (m.activeYears) {
      m.activeYears.forEach(y => years.add(y));
    }
    if (m.enrollmentYear) {
      years.add(String(m.enrollmentYear));
    }
    if (m.yearStatus) {
      Object.keys(m.yearStatus).forEach(y => years.add(y));
    }
  });

  return Array.from(years).sort().reverse();
}
