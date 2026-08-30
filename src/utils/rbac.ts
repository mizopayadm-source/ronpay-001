import { UserRole, RolePermissions, CreatorProfile } from '../types';

/**
 * Role Hierarchy Numerical Weights
 * Higher value = higher privilege level
 */
export const ROLE_HIERARCHY_LEVEL: Record<UserRole, number> = {
  SUPER_ADMIN: 100,
  ADMIN: 80,
  MODERATOR: 60,
  CREATOR: 40,
  MEMBER: 20,
  GUEST: 0,
};

export interface RoleMeta {
  role: UserRole;
  title: string;
  shortTitle: string;
  badge: string;
  badgeColor: string;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
  iconName: string;
  description: string;
  responsibilities: string[];
}

export const ROLE_METAS: Record<UserRole, RoleMeta> = {
  SUPER_ADMIN: {
    role: 'SUPER_ADMIN',
    title: 'Super Administrator',
    shortTitle: 'Super Admin',
    badge: 'SUPER ADMIN',
    badgeColor: 'bg-purple-600 text-white',
    badgeBg: 'bg-purple-950/80',
    badgeBorder: 'border-purple-500/80',
    badgeText: 'text-purple-300',
    iconName: 'Crown',
    description: 'Full system access, platform financial settings, payout configs, and manages Admin/Moderator accounts.',
    responsibilities: [
      'Full platform control & disaster recovery backups',
      'Manage Admin & Moderator role assignments',
      'Platform pricing, transaction fee rates & payout gateways',
      'Creator verification & Bawm approvals',
      'Direct system audit oversight & emergency locks'
    ]
  },
  ADMIN: {
    role: 'ADMIN',
    title: 'Platform Administrator',
    shortTitle: 'Admin',
    badge: 'ADMIN',
    badgeColor: 'bg-indigo-600 text-white',
    badgeBg: 'bg-indigo-950/80',
    badgeBorder: 'border-indigo-500/80',
    badgeText: 'text-indigo-300',
    iconName: 'ShieldCheck',
    description: 'Platform operations, financial reports, user management, and dispute handling.',
    responsibilities: [
      'Platform operations & live transaction management',
      'Creator KYC verification & campaign approvals',
      'Financial collection reports & revenue analysis',
      'Broadcast announcements & alerts',
      'Dispute resolution & user support'
    ]
  },
  MODERATOR: {
    role: 'MODERATOR',
    title: 'Compliance Moderator',
    shortTitle: 'Moderator',
    badge: 'MODERATOR',
    badgeColor: 'bg-teal-600 text-white',
    badgeBg: 'bg-teal-950/80',
    badgeBorder: 'border-teal-500/80',
    badgeText: 'text-teal-300',
    iconName: 'UserCheck',
    description: 'Specifically handles Creator KYC verification (approve/reject creators), reviews reports, and moderates content.',
    responsibilities: [
      'Creator KYC verification & onboarding review',
      'Bawm/Campaign content moderation & compliance checks',
      'Review flagged transactions & user reports',
      'Approve/Reject pending creator applications'
    ]
  },
  CREATOR: {
    role: 'CREATOR',
    title: 'Verified Bawm Creator',
    shortTitle: 'Creator',
    badge: 'CREATOR',
    badgeColor: 'bg-emerald-600 text-white',
    badgeBg: 'bg-emerald-950/80',
    badgeBorder: 'border-emerald-500/80',
    badgeText: 'text-emerald-300',
    iconName: 'Sparkles',
    description: 'Content/service providers requiring verification to publish Bawm campaigns, manage member rolls, and receive collections.',
    responsibilities: [
      'Create and manage verified Bawm campaigns (Ralna, Kumtluang, etc.)',
      'Manage Kumtluang / Khawlsak member master rolls',
      'Track offline and online collection records',
      'Generate printable statements and QR standees'
    ]
  },
  MEMBER: {
    role: 'MEMBER',
    title: 'Community Member / Donor',
    shortTitle: 'Member',
    badge: 'MEMBER',
    badgeColor: 'bg-amber-500 text-slate-950 font-black',
    badgeBg: 'bg-amber-950/60',
    badgeBorder: 'border-amber-500/60',
    badgeText: 'text-amber-300',
    iconName: 'User',
    description: 'Standard registered end-user/customer. Can scan and pay, top up RonPay wallet, track giving history.',
    responsibilities: [
      'Scan & pay to any community Bawm QR',
      'Manage personal RonPay wallet & bank transfers',
      'View individual Sulhnu giving receipts',
      'Register for community member rolls'
    ]
  },
  GUEST: {
    role: 'GUEST',
    title: 'Guest Visitor',
    shortTitle: 'Guest',
    badge: 'GUEST',
    badgeColor: 'bg-slate-700 text-slate-200',
    badgeBg: 'bg-slate-900',
    badgeBorder: 'border-slate-700',
    badgeText: 'text-slate-400',
    iconName: 'Globe',
    description: 'Unauthenticated visitor. Can browse public explorer and view public campaigns.',
    responsibilities: [
      'Browse public Bawm explorer',
      'Scan campaign QR to make instant online payments',
      'View public announcement banners'
    ]
  }
};

/**
 * Definitive Permissions Matrix by Role
 */
export const ROLE_PERMISSIONS: Record<UserRole, RolePermissions> = {
  SUPER_ADMIN: {
    canAccessCreatorVerification: true,
    canModerateContent: true,
    canViewFinancialReports: true,
    canManagePlatformFinancials: true,
    canManagePayoutConfigs: true,
    canManageAdminAccounts: true,
    canManageSystemBackups: true,
    canManageAnnouncements: true,
    canCreateCampaigns: true,
    canAccessAdminConsole: true,
  },
  ADMIN: {
    canAccessCreatorVerification: true,
    canModerateContent: true,
    canViewFinancialReports: true,
    canManagePlatformFinancials: false, // Strictly SUPER_ADMIN
    canManagePayoutConfigs: false,      // Strictly SUPER_ADMIN
    canManageAdminAccounts: false,      // Strictly SUPER_ADMIN
    canManageSystemBackups: false,      // Strictly SUPER_ADMIN
    canManageAnnouncements: true,
    canCreateCampaigns: true,
    canAccessAdminConsole: true,
  },
  MODERATOR: {
    canAccessCreatorVerification: true,
    canModerateContent: true,
    canViewFinancialReports: false,
    canManagePlatformFinancials: false, // Strictly SUPER_ADMIN
    canManagePayoutConfigs: false,      // Strictly SUPER_ADMIN
    canManageAdminAccounts: false,      // Strictly SUPER_ADMIN
    canManageSystemBackups: false,      // Strictly SUPER_ADMIN
    canManageAnnouncements: false,
    canCreateCampaigns: false,
    canAccessAdminConsole: true,        // Restricted Moderation View
  },
  CREATOR: {
    canAccessCreatorVerification: false,
    canModerateContent: false,
    canViewFinancialReports: false,
    canManagePlatformFinancials: false,
    canManagePayoutConfigs: false,
    canManageAdminAccounts: false,
    canManageSystemBackups: false,
    canManageAnnouncements: false,
    canCreateCampaigns: true,
    canAccessAdminConsole: false,
  },
  MEMBER: {
    canAccessCreatorVerification: false,
    canModerateContent: false,
    canViewFinancialReports: false,
    canManagePlatformFinancials: false,
    canManagePayoutConfigs: false,
    canManageAdminAccounts: false,
    canManageSystemBackups: false,
    canManageAnnouncements: false,
    canCreateCampaigns: false,
    canAccessAdminConsole: false,
  },
  GUEST: {
    canAccessCreatorVerification: false,
    canModerateContent: false,
    canViewFinancialReports: false,
    canManagePlatformFinancials: false,
    canManagePayoutConfigs: false,
    canManageAdminAccounts: false,
    canManageSystemBackups: false,
    canManageAnnouncements: false,
    canCreateCampaigns: false,
    canAccessAdminConsole: false,
  },
};

/**
 * Determine a user's exact UserRole from their profile
 * with full backwards-compatibility for legacy flags (isAdmin, isApproved, etc.)
 */
export const getUserRole = (profile?: CreatorProfile | null): UserRole => {
  if (!profile) return 'GUEST';

  // Explicit role string check
  if (profile.role) {
    const r = profile.role.toString().toUpperCase().trim();
    if (r === 'SUPER_ADMIN' || r === 'SUPERADMIN' || r === 'SUPER ADMIN') return 'SUPER_ADMIN';
    if (r === 'ADMIN' || r === 'ADMINISTRATOR') return 'ADMIN';
    if (r === 'MODERATOR' || r === 'MOD') return 'MODERATOR';
    if (r === 'CREATOR' || r === 'TREASURER') return 'CREATOR';
    if (r === 'MEMBER' || r === 'USER') return 'MEMBER';
    if (r === 'GUEST') return 'GUEST';
  }

  // Fallback checks from legacy fields
  if (profile.isAdmin) {
    // If designated as Platform HQ or phone is system admin phone, consider SUPER_ADMIN
    if (profile.phone === '9436001234' || profile.orgName?.includes('HQ') || profile.orgName?.includes('Master Console')) {
      return 'SUPER_ADMIN';
    }
    return 'ADMIN';
  }

  if (profile.isApproved || (profile.approvedCategories && profile.approvedCategories.length > 0)) {
    return 'CREATOR';
  }

  if (profile.phone || profile.name) {
    return 'MEMBER';
  }

  return 'GUEST';
};

/**
 * Check if user profile has at least the minimum role level
 */
export const hasMinimumRole = (profile: CreatorProfile | null | undefined, minRole: UserRole): boolean => {
  const userRole = getUserRole(profile);
  return ROLE_HIERARCHY_LEVEL[userRole] >= ROLE_HIERARCHY_LEVEL[minRole];
};

/**
 * Check if user profile has one of the allowed roles
 */
export const hasAnyRole = (profile: CreatorProfile | null | undefined, allowedRoles: UserRole[]): boolean => {
  const userRole = getUserRole(profile);
  return allowedRoles.includes(userRole);
};

/**
 * Get the full permission set for a profile or role
 */
export const getRolePermissions = (roleOrProfile?: UserRole | CreatorProfile | null): RolePermissions => {
  if (!roleOrProfile) return ROLE_PERMISSIONS.GUEST;
  const role: UserRole = typeof roleOrProfile === 'string' ? (roleOrProfile as UserRole) : getUserRole(roleOrProfile);
  return ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.GUEST;
};

/**
 * 1. Allow SUPER_ADMIN, ADMIN, and MODERATOR to access Creator Verification & KYC Approval
 */
export const canAccessCreatorVerification = (profile?: CreatorProfile | null): boolean => {
  const role = getUserRole(profile);
  return role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'MODERATOR';
};

/**
 * 2. Restrict platform financial configs (fees, rates, payment gateways) solely to SUPER_ADMIN
 */
export const canManagePlatformFinancials = (profile?: CreatorProfile | null): boolean => {
  return getUserRole(profile) === 'SUPER_ADMIN';
};

/**
 * 3. Restrict Admin & Moderator account management solely to SUPER_ADMIN
 */
export const canManageAdminAccounts = (profile?: CreatorProfile | null): boolean => {
  return getUserRole(profile) === 'SUPER_ADMIN';
};

/**
 * 4. Content and campaign moderation (SUPER_ADMIN, ADMIN, MODERATOR)
 */
export const canModerateContent = (profile?: CreatorProfile | null): boolean => {
  const role = getUserRole(profile);
  return role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'MODERATOR';
};

/**
 * 5. View financial summaries and reports (SUPER_ADMIN, ADMIN)
 */
export const canViewFinancialReports = (profile?: CreatorProfile | null): boolean => {
  const role = getUserRole(profile);
  return role === 'SUPER_ADMIN' || role === 'ADMIN';
};

/**
 * 6. Access admin console (SUPER_ADMIN, ADMIN, MODERATOR)
 */
export const canAccessAdminConsole = (profile?: CreatorProfile | null): boolean => {
  const role = getUserRole(profile);
  return role === 'SUPER_ADMIN' || role === 'ADMIN' || role === 'MODERATOR';
};

/**
 * 7. Can create and publish new campaigns
 */
export const canCreateCampaigns = (profile?: CreatorProfile | null): boolean => {
  const role = getUserRole(profile);
  if (role === 'SUPER_ADMIN' || role === 'ADMIN') return true;
  if (role === 'CREATOR') return Boolean(profile?.isApproved);
  return false;
};

/**
 * Route protection validator
 */
export const validateRouteAccess = (
  profile: CreatorProfile | null | undefined, 
  route: 'admin_dashboard' | 'creator_verification' | 'financial_rates' | 'create_qr' | 'staff_management'
): { allowed: boolean; reason?: string } => {
  const role = getUserRole(profile);

  switch (route) {
    case 'admin_dashboard':
      if (canAccessAdminConsole(profile)) return { allowed: true };
      return { allowed: false, reason: 'Staff clearance level (Moderator, Admin, or Super Admin) is required to access the administrative console.' };
    
    case 'creator_verification':
      if (canAccessCreatorVerification(profile)) return { allowed: true };
      return { allowed: false, reason: 'Only Super Admin, Admin, and Compliance Moderators can perform Creator KYC verifications.' };

    case 'financial_rates':
    case 'staff_management':
      if (canManagePlatformFinancials(profile)) return { allowed: true };
      return { allowed: false, reason: 'Restricted Action: Only Super Administrator accounts have clearance to manage platform fees, payout configs, and staff accounts.' };

    case 'create_qr':
      if (canCreateCampaigns(profile)) return { allowed: true };
      return { allowed: false, reason: 'Creator verification required: Please complete Creator Registration and KYC approval before publishing campaigns.' };

    default:
      return { allowed: true };
  }
};
