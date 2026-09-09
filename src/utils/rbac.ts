import { UserRole, PermissionKey, StaffAccount } from '../types';

/**
 * 6-Tier Role Hierarchy & Rank Matrix
 * Higher number = Greater clearance
 */
export const ROLE_RANKS: Record<UserRole, number> = {
  SUPER_ADMIN: 6,
  ADMIN: 5,
  MODERATOR: 4,
  CREATOR: 3,
  MEMBER: 2,
  GUEST: 1,
};

export interface RoleMetadata {
  role: UserRole;
  title: string;
  shortTitle?: string;
  mizoTitle: string;
  description: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  badgeColor?: string;
  badge?: string;
  accentColor: string;
  iconName: string;
  summaryMizo: string;
}

export const ROLE_DEFINITIONS: Record<UserRole, RoleMetadata> = {
  SUPER_ADMIN: {
    role: 'SUPER_ADMIN',
    title: 'Super Administrator',
    shortTitle: 'Super Admin',
    mizoTitle: 'Master / Super Admin',
    description: 'Full system access, platform settings, payout configs, database backups, and staff account management.',
    badgeBg: 'bg-purple-900',
    badgeText: 'text-amber-300',
    badgeBorder: 'border-purple-700',
    badgeColor: 'bg-purple-900 text-amber-300 border-purple-700',
    badge: '👑 SUPER ADMIN',
    accentColor: '#7c3aed',
    iconName: 'Crown',
    summaryMizo: 'Platform setting, Payout rates, Admin dang siam leh Database thunun theitu.',
  },
  ADMIN: {
    role: 'ADMIN',
    title: 'Platform Administrator',
    shortTitle: 'Admin',
    mizoTitle: 'System Operations Admin',
    description: 'Platform operations, financial reports, user management, dispute handling, and campaign approvals.',
    badgeBg: 'bg-blue-900',
    badgeText: 'text-blue-200',
    badgeBorder: 'border-blue-700',
    badgeColor: 'bg-blue-900 text-blue-200 border-blue-700',
    badge: '⚡ ADMIN',
    accentColor: '#2563eb',
    iconName: 'ShieldCheck',
    summaryMizo: 'Operations, Finance report, Campaign verify leh buaina (Dispute) chinfelna.',
  },
  MODERATOR: {
    role: 'MODERATOR',
    title: 'Content & KYC Moderator',
    shortTitle: 'Moderator',
    mizoTitle: 'KYC & Moderator',
    description: 'Specifically handles Creator KYC verification (approve/reject creators), review reports, and content moderation.',
    badgeBg: 'bg-emerald-900',
    badgeText: 'text-emerald-200',
    badgeBorder: 'border-emerald-700',
    badgeColor: 'bg-emerald-900 text-emerald-200 border-emerald-700',
    badge: '🛡️ MODERATOR',
    accentColor: '#059669',
    iconName: 'UserCheck',
    summaryMizo: 'Creator KYC lehkha verify, Approve/Reject leh content thalo endiktu.',
  },
  CREATOR: {
    role: 'CREATOR',
    title: 'Verified Creator',
    shortTitle: 'Creator',
    mizoTitle: 'QR & Bawm Creator',
    description: 'Verified content/service provider allowed to publish campaigns, create QRs, and manage member rolls.',
    badgeBg: 'bg-amber-900',
    badgeText: 'text-amber-200',
    badgeBorder: 'border-amber-700',
    badgeColor: 'bg-amber-900 text-amber-200 border-amber-700',
    badge: '🌟 CREATOR',
    accentColor: '#d97706',
    iconName: 'Sparkles',
    summaryMizo: 'Bawm siam, QR siam leh Thawhlawm/Member roll enkawltu.',
  },
  MEMBER: {
    role: 'MEMBER',
    title: 'Registered Member',
    shortTitle: 'Member',
    mizoTitle: 'Customer / Member',
    description: 'Standard registered end-user with donation history, pledge tracking, receipts, and profile tools.',
    badgeBg: 'bg-indigo-900',
    badgeText: 'text-indigo-200',
    badgeBorder: 'border-indigo-700',
    badgeColor: 'bg-indigo-900 text-indigo-200 border-indigo-700',
    badge: '👤 MEMBER',
    accentColor: '#4f46e5',
    iconName: 'User',
    summaryMizo: 'Bawm a sum chhunglut, receipt download leh thawhpek sulhnu vawngtu.',
  },
  GUEST: {
    role: 'GUEST',
    title: 'Guest Visitor',
    shortTitle: 'Guest',
    mizoTitle: 'Mikhual / Guest',
    description: 'Unauthenticated visitor exploring public campaigns and making one-off UPI contributions.',
    badgeBg: 'bg-slate-800',
    badgeText: 'text-slate-300',
    badgeBorder: 'border-slate-700',
    badgeColor: 'bg-slate-800 text-slate-300 border-slate-700',
    badge: '👁️ GUEST',
    accentColor: '#64748b',
    iconName: 'Eye',
    summaryMizo: 'App en kual leh direct QR scan a sum thawh zawk theitu.',
  },
};

export const ROLE_METAS = ROLE_DEFINITIONS;

/**
 * Granular Permission Matrix for each Role
 */
export const ROLE_PERMISSIONS_MAP: Record<UserRole, PermissionKey[]> = {
  SUPER_ADMIN: [
    'MANAGE_STAFF_ACCOUNTS',
    'MANAGE_PLATFORM_CONFIGS',
    'MANAGE_PAYOUT_RATES',
    'VIEW_FINANCIAL_REPORTS',
    'HANDLE_DISPUTES',
    'APPROVE_CAMPAIGNS',
    'DELETE_ANY_CAMPAIGN',
    'VERIFY_CREATOR_KYC',
    'MODERATE_CONTENT',
    'REVIEW_REPORTS',
    'CREATE_CAMPAIGNS',
    'MANAGE_MEMBER_ROLLS',
    'MAKE_DONATIONS',
    'VIEW_OWN_HISTORY',
    'BACKUP_RESTORE_DB',
  ],
  ADMIN: [
    'VIEW_FINANCIAL_REPORTS',
    'HANDLE_DISPUTES',
    'APPROVE_CAMPAIGNS',
    'DELETE_ANY_CAMPAIGN',
    'VERIFY_CREATOR_KYC',
    'MODERATE_CONTENT',
    'REVIEW_REPORTS',
    'CREATE_CAMPAIGNS',
    'MANAGE_MEMBER_ROLLS',
    'MAKE_DONATIONS',
    'VIEW_OWN_HISTORY',
  ],
  MODERATOR: [
    'VERIFY_CREATOR_KYC',
    'MODERATE_CONTENT',
    'REVIEW_REPORTS',
    'APPROVE_CAMPAIGNS',
    'MAKE_DONATIONS',
    'VIEW_OWN_HISTORY',
  ],
  CREATOR: [
    'CREATE_CAMPAIGNS',
    'MANAGE_MEMBER_ROLLS',
    'MAKE_DONATIONS',
    'VIEW_OWN_HISTORY',
  ],
  MEMBER: [
    'MAKE_DONATIONS',
    'VIEW_OWN_HISTORY',
  ],
  GUEST: [
    'MAKE_DONATIONS',
  ],
};

/**
 * Sample Staff Accounts for Initial RBAC Seeding & Quick Testing
 */
export const INITIAL_STAFF_ACCOUNTS: StaffAccount[] = [
  {
    id: 'staff-super-1',
    name: 'RonPay System Architect',
    email: 'superadmin@ronpay.com',
    phone: '9862000001',
    role: 'SUPER_ADMIN',
    designation: 'Chief Technology Officer (CTO)',
    assignedAt: '2026-01-01T00:00:00.000Z',
    assignedBy: 'System Root',
    isActive: true,
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
    lastLogin: new Date().toISOString(),
  },
  {
    id: 'staff-admin-1',
    name: 'Lalrinchhana (Finance & Ops)',
    email: 'admin@ronpay.com',
    phone: '9862000002',
    role: 'ADMIN',
    designation: 'Operations & Finance Manager',
    assignedAt: '2026-02-15T00:00:00.000Z',
    assignedBy: 'superadmin@ronpay.com',
    isActive: true,
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
    lastLogin: new Date(Date.now() - 3600000 * 4).toISOString(),
  },
  {
    id: 'staff-mod-1',
    name: 'Zonunmawii (Creator KYC Desk)',
    email: 'moderator@ronpay.com',
    phone: '9862000003',
    role: 'MODERATOR',
    designation: 'Creator Verification & KYC Officer',
    assignedAt: '2026-03-01T00:00:00.000Z',
    assignedBy: 'admin@ronpay.com',
    isActive: true,
    avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80',
    lastLogin: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
];

/**
 * Check if a role has a specific permission
 */
export function hasPermission(role: UserRole = 'GUEST', permission: PermissionKey): boolean {
  const permissions = ROLE_PERMISSIONS_MAP[role] || [];
  return permissions.includes(permission);
}

/**
 * Check if current role satisfies minimum required rank
 */
export function hasMinimumRole(currentRole: UserRole = 'GUEST', requiredRole: UserRole): boolean {
  return (ROLE_RANKS[currentRole] || 1) >= (ROLE_RANKS[requiredRole] || 1);
}

/**
 * Extracts UserRole from a profile, string, or role object safely
 */
export function getUserRole(profileOrRole?: any): UserRole {
  if (!profileOrRole) return 'GUEST';
  if (typeof profileOrRole === 'string') {
    if (['SUPER_ADMIN', 'ADMIN', 'MODERATOR', 'CREATOR', 'MEMBER', 'GUEST'].includes(profileOrRole)) {
      return profileOrRole as UserRole;
    }
    return 'GUEST';
  }
  if (typeof profileOrRole === 'object') {
    if (profileOrRole.role && ['SUPER_ADMIN', 'ADMIN', 'MODERATOR', 'CREATOR', 'MEMBER', 'GUEST'].includes(profileOrRole.role)) {
      return profileOrRole.role as UserRole;
    }
    if (profileOrRole.isAdmin) return 'ADMIN';
    if (profileOrRole.phone) return 'CREATOR';
  }
  return 'GUEST';
}

/**
 * Specific clearance checks required by the user prompt
 */

// 1. Allow SUPER_ADMIN, ADMIN, and MODERATOR to access Creator KYC Verification
export function canAccessCreatorVerification(roleOrProfile?: any): boolean {
  const role = typeof roleOrProfile === 'object' && roleOrProfile !== null
    ? getUserRole(roleOrProfile)
    : (roleOrProfile || 'GUEST');
  return role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'MODERATOR';
}

// 2. Allow SUPER_ADMIN and ADMIN to access Financial reports and dispute operations
export function canAccessFinancialReports(role: UserRole = 'GUEST'): boolean {
  return role === 'SUPER_ADMIN' || role === 'ADMIN';
}
export const canViewFinancialReports = canAccessFinancialReports;

// 3. Restrict platform financial configs, fee rates, and staff admin management solely to SUPER_ADMIN
export function canManagePlatformConfigs(role: UserRole = 'GUEST'): boolean {
  return role === 'SUPER_ADMIN';
}
export const canManagePlatformPricing = canManagePlatformConfigs;

export function canManageStaffAccounts(role: UserRole = 'GUEST'): boolean {
  return role === 'SUPER_ADMIN';
}

// 4. Content and campaign moderation
export function canModerateContent(role: UserRole = 'GUEST'): boolean {
  return role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'MODERATOR';
}

// 5. Creator Publishing permission
export function canCreateCampaign(role: UserRole = 'GUEST', isApproved: boolean = false): boolean {
  if (role === 'SUPER_ADMIN' || role === 'ADMIN') return true;
  if (role === 'CREATOR' && isApproved) return true;
  return false;
}

/**
 * Role badge and formatting helpers
 */
export function getRoleBadgeInfo(role: UserRole = 'GUEST') {
  const meta = ROLE_DEFINITIONS[role] || ROLE_DEFINITIONS.GUEST;
  return {
    role,
    name: meta.title,
    mizoName: meta.mizoTitle,
    rank: ROLE_RANKS[role] || 1,
    badgeBg: meta.badgeBg,
    badgeText: meta.badgeText,
    badgeBorder: meta.badgeBorder,
    badgeColor: `${meta.badgeBg} ${meta.badgeText} ${meta.badgeBorder}`,
    description: meta.description,
    summaryMizo: meta.summaryMizo,
    accentColor: meta.accentColor
  };
}

export function getRoleMetadata(role: UserRole = 'GUEST'): RoleMetadata {
  return ROLE_DEFINITIONS[role] || ROLE_DEFINITIONS.GUEST;
}

export function normalizeUserRole(rawRole?: string): UserRole {
  if (!rawRole) return 'GUEST';
  const upper = rawRole.toUpperCase();
  if (upper === 'SUPER_ADMIN' || upper === 'SUPERADMIN' || upper === 'ROOT') return 'SUPER_ADMIN';
  if (upper === 'ADMIN' || upper === 'ADMINISTRATOR') return 'ADMIN';
  if (upper === 'MODERATOR' || upper === 'MOD' || upper === 'KYC_MOD') return 'MODERATOR';
  if (upper === 'CREATOR' || upper === 'MERCHANT' || upper === 'PASTOR' || upper === 'SECRETARY') return 'CREATOR';
  if (upper === 'MEMBER' || upper === 'USER' || upper === 'DONOR') return 'MEMBER';
  return 'GUEST';
}
