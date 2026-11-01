import { UserGroupMembership, Campaign, CreatorProfile, MemberRecord, StaffAccount } from '../types';
import { 
  getStoredCampaigns, 
  getStoredCreatorsList, 
  getStoredStaffAccounts, 
  getMembers,
  saveMembers,
  getStoredCreatorProfile,
  saveStoredCreatorProfile,
  recordAuditLog,
  saveStoredCreatorsList,
  derivePrefixFromText,
  saveCampaign
} from '../utils/storage';

export const GROUP_MEMBERSHIPS_KEY = 'ronpay_group_memberships_v1';
export const ACTIVE_CAMPAIGN_CONTEXT_KEY = 'ronpay_active_campaign_context';

export interface ManagedUserAccount {
  id: string;
  name: string;
  phone: string;
  email?: string;
  accountType: 'developer' | 'tester' | 'creator' | 'staff' | 'user';
  role?: string;
  designation?: string;
  isAssigned: boolean;
  assignedCampaignIds: string[];
  memberships: UserGroupMembership[];
  source: 'creator' | 'staff' | 'member' | 'test_seed';
  createdAt?: string;
}

export const INITIAL_PRESET_TEST_ACCOUNTS: Array<{
  name: string;
  phone: string;
  email: string;
  accountType: 'developer' | 'tester' | 'user';
  designation: string;
}> = [
  {
    name: 'Rohluzuala (Backend Dev)',
    phone: '9862005566',
    email: 'rohluzuala.dev@ronpay.app',
    accountType: 'developer',
    designation: 'API & Microservices Engineer'
  },
  {
    name: 'Zoramliana (Mobile QA)',
    phone: '9862001122',
    email: 'zoramliana.qa@ronpay.app',
    accountType: 'tester',
    designation: 'Mobile App Beta Tester'
  },
  {
    name: 'Lalhmunsiama (Tester - Unassigned)',
    phone: '9862003344',
    email: 'lalhmunsiama.test@ronpay.app',
    accountType: 'tester',
    designation: 'Unassigned Quality Tester'
  },
  {
    name: 'Vanlalpeka (New User - Unassigned)',
    phone: '9862007788',
    email: 'vanlalpeka7788@gmail.com',
    accountType: 'user',
    designation: 'Unassigned Community User'
  },
  {
    name: 'Chawngthanmawia (Test User - Unassigned)',
    phone: '9862008899',
    email: 'chawnga.test@gmail.com',
    accountType: 'user',
    designation: 'Unassigned Test Account'
  }
];

export const INITIAL_GROUP_MEMBERSHIPS: UserGroupMembership[] = [
  // Super Admin / Master Developer: Many-to-Many memberships in Kumtluang groups
  {
    id: 'mem-9862000001-cmp-kumtluang-1',
    userPhone: '9862000001',
    userName: 'Super Admin (Master)',
    userEmail: 'admin@ronpay.app',
    accountType: 'developer',
    campaignId: 'cmp-kumtluang-1',
    campaignTitle: 'BCM Ebenezer Church',
    category: 'kumtluang',
    orgCode: 'EBE',
    orgName: 'BCM Ebenezer',
    memberId: 'EBE-0001',
    section: 'Bial 1 (Vengchhak)',
    role: 'Developer',
    status: 'active',
    joinedAt: '2025-01-01T00:00:00.000Z',
    isPrimary: true,
    notes: 'Platform Lead Developer & Admin'
  },
  {
    id: 'mem-9862000001-cmp-1788107291420',
    userPhone: '9862000001',
    userName: 'Super Admin (Master)',
    userEmail: 'admin@ronpay.app',
    accountType: 'developer',
    campaignId: 'cmp-1788107291420',
    campaignTitle: 'BMP Shillong Branch',
    category: 'kumtluang',
    orgCode: 'BMPSHL',
    orgName: 'Baptist Kohhran Mualpui',
    memberId: 'BMPSHL-0001',
    section: 'Shillong Unit',
    role: 'Developer',
    status: 'active',
    joinedAt: '2025-01-03T00:00:00.000Z',
    isPrimary: false,
    notes: 'Technical Integration'
  },

  // Creator Lalthianghlima: Member of BCM Ebenezer & BMP Shillong (Kumtluang Bawmte)
  {
    id: 'mem-9862300000-cmp-kumtluang-1',
    userPhone: '9862300000',
    userName: 'Lalthianghlima',
    userEmail: 'lalthianghlima@ronpay.app',
    accountType: 'creator',
    campaignId: 'cmp-kumtluang-1',
    campaignTitle: 'BCM Ebenezer Church',
    category: 'kumtluang',
    orgCode: 'EBE',
    orgName: 'BCM Ebenezer',
    memberId: 'EBE-1460',
    section: 'Bial 1 (Vengchhak)',
    role: 'Treasurer',
    status: 'active',
    joinedAt: '2025-01-02T00:00:00.000Z',
    isPrimary: true,
    notes: 'Church Treasurer & Executive Member'
  },
  {
    id: 'mem-9862300000-cmp-1788107291420',
    userPhone: '9862300000',
    userName: 'Lalthianghlima',
    userEmail: 'lalthianghlima@ronpay.app',
    accountType: 'creator',
    campaignId: 'cmp-1788107291420',
    campaignTitle: 'BMP Shillong Branch',
    category: 'kumtluang',
    orgCode: 'BMPSHL',
    orgName: 'Baptist Kohhran Mualpui',
    memberId: 'BMPSHL-1460',
    section: 'Shillong Unit',
    role: 'Committee',
    status: 'active',
    joinedAt: '2025-01-04T00:00:00.000Z',
    isPrimary: false,
    notes: 'Committee Member'
  },

  // Rohluzuala (Backend Dev): Assigned to BCM Ebenezer (Kumtluang)
  {
    id: 'mem-9862005566-cmp-kumtluang-1',
    userPhone: '9862005566',
    userName: 'Rohluzuala (Backend Dev)',
    userEmail: 'rohluzuala.dev@ronpay.app',
    accountType: 'developer',
    campaignId: 'cmp-kumtluang-1',
    campaignTitle: 'BCM Ebenezer Church',
    category: 'kumtluang',
    orgCode: 'EBE',
    orgName: 'BCM Ebenezer',
    memberId: 'EBE-5566',
    section: 'Bial 2 (Vengthlang)',
    role: 'Developer',
    status: 'active',
    joinedAt: '2025-02-01T00:00:00.000Z',
    isPrimary: true,
    notes: 'Database & API tester'
  },

  // Zoramliana (Mobile QA): Assigned to BCM Ebenezer (Kumtluang)
  {
    id: 'mem-9862001122-cmp-kumtluang-1',
    userPhone: '9862001122',
    userName: 'Zoramliana (Mobile QA)',
    userEmail: 'zoramliana.qa@ronpay.app',
    accountType: 'tester',
    campaignId: 'cmp-kumtluang-1',
    campaignTitle: 'BCM Ebenezer Church',
    category: 'kumtluang',
    orgCode: 'EBE',
    orgName: 'BCM Ebenezer',
    memberId: 'EBE-1122',
    section: 'Bial 3 (Venglai)',
    role: 'Tester',
    status: 'active',
    joinedAt: '2025-02-10T00:00:00.000Z',
    isPrimary: true,
    notes: 'Android & UPI flow tester'
  }
];

export function sanitizePhone(phone?: string): string {
  if (!phone) return '';
  return String(phone).replace(/\D/g, '').slice(-10);
}

export function getStoredGroupMemberships(): UserGroupMembership[] {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(GROUP_MEMBERSHIPS_KEY) : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Enforce strictly: Member Roll only exists for Kumtluang campaigns!
        const kumtluangOnly = parsed.filter((m: UserGroupMembership) => m.category === 'kumtluang');
        if (kumtluangOnly.length > 0) {
          return kumtluangOnly;
        }
      }
    }
  } catch (e) {
    console.warn('[GroupMembership] Failed to parse stored group memberships:', e);
  }

  // First time initialization: Seed with default Kumtluang memberships
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(GROUP_MEMBERSHIPS_KEY, JSON.stringify(INITIAL_GROUP_MEMBERSHIPS));
    } catch {}
  }
  return INITIAL_GROUP_MEMBERSHIPS;
}

export function saveStoredGroupMemberships(
  memberships: UserGroupMembership[],
  skipServerPush: boolean = false
): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(GROUP_MEMBERSHIPS_KEY, JSON.stringify(memberships));
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ronpay_group_memberships_updated', { detail: memberships }));
      window.dispatchEvent(new CustomEvent('ronpay-group-memberships-updated', { detail: memberships }));
    }

    if (!skipServerPush) {
      fetch('/api/data/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupMemberships: memberships })
      }).catch(() => {});
    }
  } catch (e) {
    console.error('[GroupMembership] Failed to save group memberships:', e);
  }
}

export function getUserGroupMemberships(userPhone: string): UserGroupMembership[] {
  const cleanPhone = sanitizePhone(userPhone);
  if (!cleanPhone) return [];

  const all = getStoredGroupMemberships();
  return all.filter(m => sanitizePhone(m.userPhone) === cleanPhone);
}

export function getActiveCampaignContext(userPhone?: string): string | null {
  try {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(ACTIVE_CAMPAIGN_CONTEXT_KEY);
      if (saved && saved.trim()) return saved.trim();
    }
  } catch {}

  // Fallback to primary membership of active user if available
  if (userPhone) {
    const memberships = getUserGroupMemberships(userPhone);
    const primary = memberships.find(m => m.isPrimary && m.status === 'active');
    if (primary) return primary.campaignId;
    if (memberships.length > 0 && memberships[0].status === 'active') return memberships[0].campaignId;
  }

  return 'cmp-kumtluang-1'; // Default canonical fallback
}

export function setActiveCampaignContext(campaignId: string, userPhone?: string): void {
  if (!campaignId) return;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(ACTIVE_CAMPAIGN_CONTEXT_KEY, campaignId);
    }

    // Update active creatorProfile if phone matches
    const activeProfile = getStoredCreatorProfile();
    const cleanUserPhone = sanitizePhone(userPhone || activeProfile?.phone);
    if (activeProfile && sanitizePhone(activeProfile.phone) === cleanUserPhone) {
      const campaigns = getStoredCampaigns();
      const matched = campaigns.find(c => c.id === campaignId);
      const updated: CreatorProfile = {
        ...activeProfile,
        activeCampaignId: campaignId,
        activeCampaignTitle: matched?.title || activeProfile.activeCampaignTitle
      };
      saveStoredCreatorProfile(updated);
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ronpay_active_campaign_context_changed', { detail: { campaignId } }));
    }
  } catch (e) {
    console.warn('[GroupMembership] Failed to set active campaign context:', e);
  }
}

export function getAllManagedUserAccounts(): ManagedUserAccount[] {
  const memberships = getStoredGroupMemberships();
  const creators = getStoredCreatorsList();
  const staff = getStoredStaffAccounts();
  const members = getMembers();
  const campaigns = getStoredCampaigns();

  const accountsMap = new Map<string, ManagedUserAccount>();

  // 1. Ingest preset tester and developer accounts
  for (const preset of INITIAL_PRESET_TEST_ACCOUNTS) {
    const phone = sanitizePhone(preset.phone);
    if (!accountsMap.has(phone)) {
      accountsMap.set(phone, {
        id: `user-${phone}`,
        name: preset.name,
        phone,
        email: preset.email,
        accountType: preset.accountType,
        designation: preset.designation,
        isAssigned: false,
        assignedCampaignIds: [],
        memberships: [],
        source: 'test_seed'
      });
    }
  }

  // 2. Ingest registered creators
  for (const c of creators) {
    const phone = sanitizePhone(c.phone);
    if (!phone) continue;
    const isDev = phone === '9862000001';
    const accType: ManagedUserAccount['accountType'] = isDev ? 'developer' : (c.role === 'ADMIN' || c.role === 'SUPER_ADMIN' ? 'staff' : 'creator');
    
    accountsMap.set(phone, {
      id: c.id || `creator-${phone}`,
      name: c.name || `User ${phone}`,
      phone,
      email: c.email,
      accountType: accType,
      role: c.role || 'CREATOR',
      designation: c.designation || c.orgName,
      isAssigned: false,
      assignedCampaignIds: [],
      memberships: [],
      source: 'creator',
      createdAt: c.createdAt || c.registeredAt
    });
  }

  // 3. Ingest staff accounts
  for (const s of staff) {
    const phone = sanitizePhone(s.phone);
    if (!phone) continue;
    const existing = accountsMap.get(phone);
    if (existing) {
      existing.role = s.role;
      existing.designation = s.designation || existing.designation;
    } else {
      accountsMap.set(phone, {
        id: s.id || `staff-${phone}`,
        name: s.name,
        phone,
        email: s.email,
        accountType: 'staff',
        role: s.role,
        designation: s.designation || 'Staff Officer',
        isAssigned: false,
        assignedCampaignIds: [],
        memberships: [],
        source: 'staff',
        createdAt: s.createdAt
      });
    }
  }

  // 4. Ingest registered MemberRecords that have phone numbers
  const kumtluangCampaignIds = new Set(campaigns.filter(c => c.category === 'kumtluang').map(c => c.id));
  for (const m of members) {
    const phone = sanitizePhone(m.fullPhone || m.phone);
    if (!phone) continue;
    const hasValidKumtluangCamp = Boolean(m.campaignId && kumtluangCampaignIds.has(m.campaignId));
    if (!accountsMap.has(phone)) {
      accountsMap.set(phone, {
        id: m.id,
        name: m.name,
        phone,
        accountType: (m.accountType as any) || 'user',
        designation: `Roll: ${m.id} (${m.section || 'General'})`,
        isAssigned: hasValidKumtluangCamp,
        assignedCampaignIds: hasValidKumtluangCamp && m.campaignId ? [m.campaignId] : [],
        memberships: [],
        source: 'member',
        createdAt: m.createdAt
      });
    }
  }

  // 5. Ingest existing Many-to-Many Group Memberships (strictly Kumtluang)
  for (const mem of memberships) {
    if (mem.category !== 'kumtluang') continue;
    const phone = sanitizePhone(mem.userPhone);
    if (!phone) continue;

    let userAcc = accountsMap.get(phone);
    if (!userAcc) {
      userAcc = {
        id: `user-${phone}`,
        name: mem.userName || `User ${phone}`,
        phone,
        email: mem.userEmail,
        accountType: (mem.accountType as any) || 'user',
        isAssigned: true,
        assignedCampaignIds: [],
        memberships: [],
        source: 'test_seed',
        createdAt: mem.joinedAt
      };
      accountsMap.set(phone, userAcc);
    }

    if (!userAcc.assignedCampaignIds.includes(mem.campaignId)) {
      userAcc.assignedCampaignIds.push(mem.campaignId);
    }
    userAcc.memberships.push(mem);
    userAcc.isAssigned = userAcc.assignedCampaignIds.length > 0;
  }

  // Return list sorted: Unassigned accounts first, then Developers & Testers, then others
  return Array.from(accountsMap.values()).sort((a, b) => {
    if (!a.isAssigned && b.isAssigned) return -1;
    if (a.isAssigned && !b.isAssigned) return 1;
    const priority = { developer: 1, tester: 2, staff: 3, creator: 4, user: 5 };
    const pA = priority[a.accountType] || 6;
    const pB = priority[b.accountType] || 6;
    if (pA !== pB) return pA - pB;
    return a.name.localeCompare(b.name);
  });
}

export function assignUserToCampaigns(
  user: {
    phone: string;
    name: string;
    email?: string;
    accountType?: 'developer' | 'tester' | 'creator' | 'staff' | 'user';
  },
  campaignIds: string[],
  role: string = 'Member',
  section?: string,
  performedBy: string = 'Admin'
): { added: number; updated: number; current: UserGroupMembership[] } {
  const cleanPhone = sanitizePhone(user.phone);
  if (!cleanPhone) {
    throw new Error('Valid 10-digit phone number is required');
  }

  const allMemberships = getStoredGroupMemberships();
  const campaigns = getStoredCampaigns();
  const campMap = new Map<string, Campaign>(campaigns.map(c => [c.id, c]));

  let added = 0;
  let updated = 0;

  const otherUsersMemberships = allMemberships.filter(m => sanitizePhone(m.userPhone) !== cleanPhone);
  const userExistingMemberships = allMemberships.filter(m => sanitizePhone(m.userPhone) === cleanPhone);

  const existingMap = new Map<string, UserGroupMembership>(userExistingMemberships.map(m => [m.campaignId, m]));

  // Enforce strictly: Member Roll only exists for Kumtluang campaigns!
  const validKumtluangCids = campaignIds.filter(cid => {
    const camp = campMap.get(cid);
    return camp && camp.category === 'kumtluang';
  });

  const updatedUserMemberships: UserGroupMembership[] = [];

  for (const cid of validKumtluangCids) {
    const camp = campMap.get(cid);
    const existing = existingMap.get(cid);

    if (existing) {
      const revised: UserGroupMembership = {
        ...existing,
        userName: user.name || existing.userName,
        userEmail: user.email || existing.userEmail,
        accountType: user.accountType || existing.accountType,
        role: role || existing.role,
        section: section || existing.section,
        status: 'active'
      };
      updatedUserMemberships.push(revised);
      updated++;
    } else {
      const orgCode = (camp?.orgCode || derivePrefixFromText(camp?.orgName || camp?.title)).toUpperCase();
      const phoneLast4 = cleanPhone.slice(-4);
      const generatedMemberId = `${orgCode}-${phoneLast4}`;

      const newMembership: UserGroupMembership = {
        id: `mem-${cleanPhone}-${cid}`,
        userPhone: cleanPhone,
        userName: user.name || `User ${cleanPhone}`,
        userEmail: user.email,
        accountType: user.accountType || 'user',
        campaignId: cid,
        campaignTitle: camp?.title || 'Kumtluang Bawm',
        category: 'kumtluang',
        orgCode: camp?.orgCode || orgCode,
        orgName: camp?.orgName,
        memberId: generatedMemberId,
        section: section || camp?.section || 'General',
        role: role || 'Member',
        status: 'active',
        joinedAt: new Date().toISOString(),
        isPrimary: updatedUserMemberships.length === 0
      };
      updatedUserMemberships.push(newMembership);
      added++;

      // Sync into MemberRecords list
      try {
        const existingMems = getMembers();
        const cleanId = generatedMemberId.toLowerCase().trim();
        if (!existingMems.some(m => m.id.toLowerCase().trim() === cleanId)) {
          const newMemberRecord: MemberRecord = {
            id: generatedMemberId,
            campaignId: cid,
            name: user.name || `User ${cleanPhone}`,
            userPhone: cleanPhone,
            accountType: user.accountType || 'user',
            orgCode: orgCode,
            phoneLast4: phoneLast4,
            fullPhone: cleanPhone,
            phone: cleanPhone,
            section: section || camp?.section || 'General',
            isFamilyHead: true,
            dependents: [],
            createdAt: new Date().toISOString(),
            status: 'paid'
          };
          saveMembers([newMemberRecord, ...existingMems]);
        }
      } catch (e) {
        console.warn('[GroupMembership] Member record sync notice:', e);
      }
    }
  }

  // Also retain any memberships in campaigns that were not modified
  for (const [existingCid, existingMem] of existingMap.entries()) {
    if (!campaignIds.includes(existingCid)) {
      updatedUserMemberships.push(existingMem);
    }
  }

  const finalMemberships = [...otherUsersMemberships, ...updatedUserMemberships];
  saveStoredGroupMemberships(finalMemberships);

  // Sync to CreatorProfile if this user is active
  const activeProfile = getStoredCreatorProfile();
  if (sanitizePhone(activeProfile?.phone) === cleanPhone) {
    const activeUpdated: CreatorProfile = {
      ...activeProfile,
      assignedCampaignIds: updatedUserMemberships.map(m => m.campaignId),
      groupMemberships: updatedUserMemberships,
      activeCampaignId: activeProfile.activeCampaignId || updatedUserMemberships[0]?.campaignId
    };
    saveStoredCreatorProfile(activeUpdated);
  }

  recordAuditLog(
    'Member Group Assigned',
    `User ${user.name} (${cleanPhone}) assigned to ${campaignIds.length} campaigns/groups with role "${role}".`,
    'member',
    cleanPhone,
    performedBy
  );

  return {
    added,
    updated,
    current: updatedUserMemberships
  };
}

export function bulkAssignUsersToCampaign(
  userPhones: string[],
  campaignId: string,
  role: string = 'Member',
  section?: string,
  performedBy: string = 'Admin'
): { successCount: number; message: string } {
  if (!campaignId) throw new Error('Target campaign/group is required');
  if (!userPhones || userPhones.length === 0) throw new Error('At least one user must be selected');

  const campaigns = getStoredCampaigns();
  const targetCamp = campaigns.find(c => c.id === campaignId);
  if (!targetCamp || targetCamp.category !== 'kumtluang') {
    throw new Error('Member Roll awmna Kumtluang bawmah chiah Member nih theih a ni.');
  }

  const managedUsers = getAllManagedUserAccounts();
  const userMap = new Map(managedUsers.map(u => [u.phone, u]));

  let count = 0;
  for (const phone of userPhones) {
    const clean = sanitizePhone(phone);
    const u = userMap.get(clean);
    if (u) {
      assignUserToCampaigns(
        {
          phone: clean,
          name: u.name,
          email: u.email,
          accountType: u.accountType
        },
        [campaignId],
        role,
        section,
        performedBy
      );
      count++;
    }
  }

  return {
    successCount: count,
    message: `Successfully assigned ${count} user(s) to "${targetCamp?.title || 'Group'}" as ${role}.`
  };
}

export function removeUserFromCampaign(
  userPhone: string,
  campaignId: string,
  performedBy: string = 'Admin'
): void {
  const cleanPhone = sanitizePhone(userPhone);
  if (!cleanPhone || !campaignId) return;

  const all = getStoredGroupMemberships();
  const updated = all.filter(m => !(sanitizePhone(m.userPhone) === cleanPhone && m.campaignId === campaignId));
  saveStoredGroupMemberships(updated);

  recordAuditLog(
    'Member Group Removed',
    `User (${cleanPhone}) removed from campaign ${campaignId}.`,
    'member',
    cleanPhone,
    performedBy
  );
}

export function requestToJoinCampaign(
  user: { phone: string; name: string; email?: string },
  campaignId: string,
  section?: string,
  notes?: string
): UserGroupMembership {
  const cleanPhone = sanitizePhone(user.phone);
  if (!cleanPhone) throw new Error('Phone number is required');

  const campaigns = getStoredCampaigns();
  const camp = campaigns.find(c => c.id === campaignId);
  if (!camp) throw new Error('Campaign not found');
  if (camp.category !== 'kumtluang') {
    throw new Error('Member Roll awmna Kumtluang bawmah chiah Member nih theih a ni.');
  }

  const all = getStoredGroupMemberships();
  const existing = all.find(m => sanitizePhone(m.userPhone) === cleanPhone && m.campaignId === campaignId);

  if (existing) {
    if (existing.status === 'active' || existing.status === 'pending_approval') {
      return existing;
    }
    // Re-request approval
    existing.status = 'pending_approval';
    existing.joinedAt = new Date().toISOString();
    saveStoredGroupMemberships(all);
    return existing;
  }

  const orgCode = (camp.orgCode || derivePrefixFromText(camp.orgName || camp.title)).toUpperCase();
  const phoneLast4 = cleanPhone.slice(-4);
  const generatedMemberId = `${orgCode}-${phoneLast4}`;

  const newMembership: UserGroupMembership = {
    id: `mem-${cleanPhone}-${campaignId}`,
    userPhone: cleanPhone,
    userName: user.name || `User ${cleanPhone}`,
    userEmail: user.email,
    accountType: 'user',
    campaignId: camp.id,
    campaignTitle: camp.title,
    category: camp.category,
    orgCode: camp.orgCode || orgCode,
    orgName: camp.orgName,
    memberId: generatedMemberId,
    section: section || camp.section || 'General',
    role: 'Member',
    status: 'pending_approval', // Enforce approval required by Creator / Admin!
    joinedAt: new Date().toISOString(),
    isPrimary: all.filter(m => sanitizePhone(m.userPhone) === cleanPhone).length === 0,
    notes: notes || 'Self requested to join from My Memberships / Explorer'
  };

  const updated = [newMembership, ...all];
  saveStoredGroupMemberships(updated);

  recordAuditLog(
    'Member Requested Group Join',
    `${user.name} (${cleanPhone}) requested to join campaign "${camp.title}" as Member (Pending Creator/Admin Approval).`,
    'member',
    cleanPhone,
    user.name
  );

  return newMembership;
}

export function approveMembershipRequest(membershipId: string, approvedBy: string = 'Admin'): void {
  const all = getStoredGroupMemberships();
  const matched = all.find(m => m.id === membershipId);
  if (matched) {
    matched.status = 'active';
    saveStoredGroupMemberships(all);

    // Instantly sync into MemberRecord list upon approval
    try {
      const cleanPhone = sanitizePhone(matched.userPhone);
      const orgCode = (matched.orgCode || derivePrefixFromText(matched.orgName || matched.campaignTitle)).toUpperCase();
      const phoneLast4 = cleanPhone.slice(-4);
      const memberId = matched.memberId || `${orgCode}-${phoneLast4}`;
      matched.memberId = memberId;

      const existingMems = getMembers();
      const cleanId = memberId.toLowerCase().trim();
      if (!existingMems.some(m => m.id.toLowerCase().trim() === cleanId)) {
        const newMemberRecord: MemberRecord = {
          id: memberId,
          campaignId: matched.campaignId,
          name: matched.userName || `Member ${cleanPhone}`,
          userPhone: cleanPhone,
          accountType: matched.accountType || 'user',
          orgCode: orgCode,
          phoneLast4: phoneLast4,
          fullPhone: cleanPhone,
          phone: cleanPhone,
          section: matched.section || 'General',
          isFamilyHead: true,
          dependents: [],
          createdAt: new Date().toISOString(),
          status: 'paid'
        };
        saveMembers([newMemberRecord, ...existingMems]);
      }
    } catch (e) {
      console.warn('[GroupMembership] Member sync notice on approval:', e);
    }

    recordAuditLog(
      'Membership Request Approved',
      `Approved ${matched.userName} (${matched.userPhone}) for group "${matched.campaignTitle}" by ${approvedBy}.`,
      'member',
      matched.userPhone,
      approvedBy
    );
  }
}

export function rejectMembershipRequest(membershipId: string, rejectedBy: string = 'Admin'): void {
  const all = getStoredGroupMemberships();
  const matched = all.find(m => m.id === membershipId);
  const updated = all.filter(m => m.id !== membershipId);
  saveStoredGroupMemberships(updated);

  if (matched) {
    recordAuditLog(
      'Membership Request Rejected',
      `Rejected ${matched.userName} (${matched.userPhone}) request for group "${matched.campaignTitle}" by ${rejectedBy}.`,
      'member',
      matched.userPhone,
      rejectedBy
    );
  }
}

export function requestCreatorRoleInCampaign(
  userPhone: string,
  campaignId: string,
  notes?: string
): UserGroupMembership {
  const cleanPhone = sanitizePhone(userPhone);
  if (!cleanPhone || !campaignId) throw new Error('Phone number leh Campaign ID a ngai e.');

  const all = getStoredGroupMemberships();
  const matched = all.find(m => sanitizePhone(m.userPhone) === cleanPhone && m.campaignId === campaignId);
  if (!matched) {
    throw new Error('He Pawl/Bawmah hian member i la ni lo. Member nih hmasak a ngai e.');
  }

  if (matched.role === 'Creator') {
    throw new Error('He Bawmah hian Creator i ni tawh sa e.');
  }

  matched.requestedRole = 'Creator';
  matched.roleRequestStatus = 'pending';
  matched.requestedRoleAt = new Date().toISOString();
  if (notes) matched.notes = notes;

  saveStoredGroupMemberships(all);

  recordAuditLog(
    'Creator Role Requested',
    `User ${matched.userName} (${cleanPhone}) requested Creator permissions for campaign "${matched.campaignTitle}".`,
    'member',
    cleanPhone,
    matched.userName
  );

  return matched;
}

export function approveCreatorRoleRequest(membershipId: string, approvedBy: string = 'Admin'): void {
  const all = getStoredGroupMemberships();
  const matched = all.find(m => m.id === membershipId);
  if (!matched) return;

  matched.role = 'Creator';
  matched.roleRequestStatus = 'approved';
  matched.requestedRole = undefined;
  saveStoredGroupMemberships(all);

  // Sync into campaign's authorizedOfficers
  try {
    const campaigns = getStoredCampaigns();
    const camp = campaigns.find(c => c.id === matched.campaignId);
    if (camp) {
      const cleanPhone = sanitizePhone(matched.userPhone);
      const existingOfficers = Array.isArray(camp.authorizedOfficers) ? [...camp.authorizedOfficers] : [];
      const officerIdx = existingOfficers.findIndex(o => sanitizePhone(o.phone) === cleanPhone);

      const newOfficerObj = {
        name: matched.userName,
        phone: cleanPhone,
        role: 'Creator' as const,
        section: matched.section || 'General',
        assignedAt: new Date().toISOString(),
        assignedBy: approvedBy,
        canClearCash: true,
        canRecordExpenses: true,
        canManageMembers: true
      };

      if (officerIdx >= 0) {
        existingOfficers[officerIdx] = { ...existingOfficers[officerIdx], ...newOfficerObj };
      } else {
        existingOfficers.push(newOfficerObj);
      }

      camp.authorizedOfficers = existingOfficers;
      saveCampaign(camp);
    }
  } catch (e) {
    console.warn('[GroupMembership] Failed to sync creator role into campaign authorizedOfficers:', e);
  }

  recordAuditLog(
    'Creator Role Approved',
    `Approved Creator role for ${matched.userName} (${matched.userPhone}) in "${matched.campaignTitle}" by ${approvedBy}.`,
    'creator',
    matched.userPhone,
    approvedBy
  );
}

export function rejectCreatorRoleRequest(membershipId: string, rejectedBy: string = 'Admin'): void {
  const all = getStoredGroupMemberships();
  const matched = all.find(m => m.id === membershipId);
  if (!matched) return;

  matched.roleRequestStatus = 'rejected';
  matched.requestedRole = undefined;
  saveStoredGroupMemberships(all);

  recordAuditLog(
    'Creator Role Request Rejected',
    `Rejected Creator role request for ${matched.userName} (${matched.userPhone}) in "${matched.campaignTitle}" by ${rejectedBy}. Retained as Member.`,
    'creator',
    matched.userPhone,
    rejectedBy
  );
}

