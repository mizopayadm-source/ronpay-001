export type ScreenId = 
  | 'home' 
  | 'explorer' 
  | 'checkout' 
  | 'create_qr' 
  | 'creator_reg' 
  | 'reports' 
  | 'success' 
  | 'cash_pending';

export type BawmCategory = 'ralna' | 'khawlsak' | 'rikrum' | 'kumtluang' | 'others';

export type PaymentStatus = 'paid' | 'pending' | 'pending_verification' | 'partial' | 'completed' | 'failed' | 'rejected';

export type PaymentMethod = 'online' | 'cash' | 'upi' | 'bank_transfer' | 'qr_scan';

export interface BawmInfo {
  key: BawmCategory;
  name: string;
  subtitle: string;
  icon: string;
  themeColor: string;
  bgLight: string;
  borderLight: string;
  textDark: string;
  accent: string;
}

export interface Campaign {
  id: string;
  category: BawmCategory;
  title: string;
  subTitle?: string;
  orgName?: string;
  orgCode?: string;
  mitthiHming?: string;
  age?: number;
  location?: string;
  gpsCoords?: string;
  upiId: string;
  targetUpiId?: string;
  imageUrl?: string;
  thihni?: string;
  vuiHun?: string;
  vuitu?: string;
  validityDate?: string;
  status?: 'active' | 'completed' | 'expired' | 'pending' | 'pending_approval' | 'rejected' | 'voided' | 'cancelled' | string;
  createdAt?: string;
  createdBy?: string;
  creatorName?: string;
  cause?: string;
  targetAmount?: number;
  customAmount?: number;
  maxLimit?: number;
  emergencyTitle?: string;
  urgencyLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' | string;
  urgencyDeadline?: string;
  subCategories?: string[];
  trxnFeeBearer?: 'user_paid' | 'creator_paid' | string;
  kumtluangFeeBearer?: string;
  sectionLabel?: string;
  definedSections?: string[];
  contactPerson?: string;
  contactPhone?: string;
  description?: string;
  isVerified?: boolean;
  isApproved?: boolean;
  approvedAt?: string;
  approvedBy?: string;
  remarks?: string;
  approvalRemarks?: string;
  targetPeriod?: string;
  customPlatformFeePercent?: number;
  customFreeTrialActive?: boolean;
  // Safety Net & Audit fields
  isVoided?: boolean;
  voidedAt?: string;
  voidedBy?: string;
  voidReason?: string;
  updatedAt?: string;
  lastEditedBy?: string;
  lastEditReason?: string;
}

export interface Transaction {
  id: string;
  campaignId: string;
  campaignTitle?: string;
  category?: BawmCategory;
  donorName: string;
  donorPhone?: string;
  donorVeng?: string;
  memberId?: string;
  subId?: string;
  isAnonymous?: boolean;
  isDependent?: boolean;
  isSynced?: boolean;
  amount: number;
  platformFee?: number;
  platformFeeBearer?: string;
  totalAmount?: number;
  paymentMethod: PaymentMethod | string;
  status: 'completed' | 'pending' | 'pending_verification' | 'failed' | 'rejected' | string;
  remark?: string;
  subCategory?: string;
  periodType?: 'monthly' | 'one_time' | 'annual' | string;
  periodMonth?: string;
  periodYear?: string;
  periodLabel?: string;
  subCategoryBreakdown?: Record<string, number>;
  timestamp: string;
  createdAt?: string;
  txHash?: string;
  referenceNo?: string;
  utrRef?: string;
  payerUPI?: string;
  billServiceType?: string;
  billConsumerNumber?: string;
  billOperator?: string;
  verifiedBy?: string;
  verifiedAt?: string;
}

export interface CategoryRequest {
  type: 'add' | 'remove';
  category: BawmCategory;
  docName?: string;
  authDocName?: string;
  reason?: string;
  requestedAt?: string;
  status?: 'pending' | 'approved' | 'rejected';
}

export type UserRole = 
  | 'SUPER_ADMIN' 
  | 'ADMIN' 
  | 'MODERATOR' 
  | 'CREATOR' 
  | 'MEMBER' 
  | 'GUEST';

export interface RolePermissions {
  canAccessCreatorVerification: boolean;
  canModerateContent: boolean;
  canViewFinancialReports: boolean;
  canManagePlatformFinancials: boolean;
  canManagePayoutConfigs: boolean;
  canManageAdminAccounts: boolean;
  canManageSystemBackups: boolean;
  canManageAnnouncements: boolean;
  canCreateCampaigns: boolean;
  canAccessAdminConsole: boolean;
}

export interface CreatorProfile {
  phone: string;
  name: string;
  designation?: string;
  orgName?: string;
  location?: string;
  upiId?: string;
  role?: UserRole | string;
  isApproved?: boolean;
  isAdmin?: boolean;
  isPhoneVerified?: boolean;
  plan?: 'trial' | 'standard' | 'premium' | 'kumtluang' | string;
  subscriptionPlan?: string;
  subscriptionExpiresAt?: string;
  trialExpiresAt?: string;
  customTrialDays?: number;
  freePostsQuota?: number;
  freePostsUsed?: number;
  customPlatformFeePercent?: number;
  customDiscountPercent?: number;
  isFreeServiceGranted?: boolean;
  categoryCustomOverrides?: Record<string, any>;
  createdQRsCount?: number;
  registeredAt?: string;
  password?: string;
  pin?: string;
  rejectionReason?: string;
  allowedCategories?: BawmCategory[];
  approvedCategories?: BawmCategory[];
  panNumber?: string;
  address?: string;
  pendingUpgrade?: CategoryRequest | any;
  isBlocked?: boolean;
  regDocUrl?: string;
  authDocName?: string;
  authDocUrl?: string;
  logoUrl?: string;
  avatarUrl?: string;
}

export interface SystemPricingConfig {
  trialDurationDays?: number;
  globalTrialDays?: number;
  fixedFeePerTxn?: number;
  percentageFeePerTxn?: number;
  maxFreeCampaigns?: number;
  standardMonthlyCost?: number;
  premiumYearlyCost?: number;
  globalDiscountPercent?: number;
  qrCreationPrice?: number;
  lastUpdated?: string;
  categories?: Record<string, { price?: number; label?: string; allowed?: boolean } | any>;
  updatedAt?: string;
  updatedBy?: string;
}

export interface BawmFeeRule {
  category: BawmCategory;
  fixedFee: number;
  percentageFee: number;
  bearer: 'user_paid' | 'creator_paid';
}

export interface AuditLog {
  id: string;
  action: string;
  details: string;
  targetType: 'system' | 'creator' | 'campaign' | 'transaction' | 'member' | 'pricing' | 'announcement';
  targetId?: string;
  performedBy: string;
  timestamp: string;
}

export interface AnnouncementItem {
  id: string;
  isActive: boolean;
  type: 'urgent' | 'info' | 'notice' | 'event';
  title: string;
  message: string;
  linkText?: string;
  linkAction?: string;
  badge?: string;
  badgeBgColor?: string;
  badgeTextColor?: string;
  bannerMediaUrl?: string;
  mediaType?: 'image' | 'canva' | 'video';
  mediaLayout?: 'hero_top' | 'compact' | 'card_side' | 'full_card' | 'side_thumb' | string;
  bgTheme?: string;
  customGradientFrom?: string;
  customGradientTo?: string;
  customBgColor?: string;
  textAlignment?: 'left' | 'center' | 'right' | string;
  fontSizePreset?: 'small' | 'medium' | 'large' | string;
  titleColor?: string;
  textColor?: string;
  bannerHeightPreset?: string;
  bannerCustomHeightPx?: number;
  mediaFit?: 'cover' | 'contain' | string;
}

export interface AnnouncementBanner {
  id: string;
  isActive: boolean;
  type?: 'urgent' | 'info' | 'notice' | 'event';
  title?: string;
  message?: string;
  linkText?: string;
  linkAction?: string;
  animationStyle?: 'slide' | 'fade' | 'marquee';
  rotationSpeedSeconds?: number;
  autoRotate?: boolean;
  items?: AnnouncementItem[];
  createdAt?: string;
  updatedAt?: string;
  globalHeightPreset?: string;
  globalCustomHeightPx?: number;
  globalBgTheme?: string;
  globalCustomGradientFrom?: string;
  globalCustomGradientTo?: string;
  globalCustomBgColor?: string;
  globalMediaFit?: string;
  bannerMediaUrl?: string;
  mediaType?: string;
  mediaLayout?: string;
}

export interface MemberDependent {
  subId: string;
  name: string;
  relation: string;
}

export interface MemberRecord {
  id: string; // e.g. EBE-1460
  campaignId: string;
  name: string;
  orgCode?: string;
  phoneLast4?: string;
  fullPhone?: string;
  section?: string;
  isFamilyHead?: boolean;
  dependents?: MemberDependent[];
  createdAt?: string;
  notes?: string;
  avatarUrl?: string;
  pledgeAmount?: number;
  paidAmount?: number;
  status?: 'paid' | 'pending' | 'partial';
}

export interface WalletTransaction {
  id: string;
  type: 'credit' | 'debit';
  title: string;
  amount: number;
  fee?: number;
  status: 'completed' | 'pending' | 'failed';
  source: 'upi_topup' | 'card_topup' | 'campaign_collection' | 'bank_withdrawal' | 'qr_payment' | 'cashback' | 'fee_reimbursement';
  timestamp: string;
  referenceNo?: string;
  utrRef?: string;
  remark?: string;
  balanceAfter?: number;
}

export interface RonPayWallet {
  walletId: string;
  upiHandle: string;
  balance: number;
  pendingPayouts: number;
  totalCredited: number;
  totalWithdrawn: number;
  linkedBankName?: string;
  linkedAccountLast4?: string;
  linkedUpiId?: string;
  isKycVerified: boolean;
  history: WalletTransaction[];
}

export interface BillService {
  id: string;
  name: string;
  category: 'mobile' | 'dth' | 'electricity' | 'water' | 'fastag' | 'gas' | 'broadband' | 'other' | string;
  icon: string;
  bgColor?: string;
  textColor?: string;
  description?: string;
  minAmount?: number;
  maxAmount?: number;
  operators?: string[];
  fieldLabel?: string;
  fieldPlaceholder?: string;
  fields?: any[];
}

export interface AIHriatpuiLetterRequest {
  orgName: string; // e.g. YMA Chanmari Branch / Kohhran
  orgType: 'yma' | 'kohhran' | 'mup' | 'mhip' | 'local_council' | 'ngo' | 'custom';
  applicantName: string;
  applicantPhone: string;
  applicantRole: string; // e.g. Executive Member / Veng Chhung Mi
  category: BawmCategory;
  purpose: string;
  locality: string;
  signatoryTitle: string; // e.g. President / Secretary
  signatoryName: string;
}

export interface AIHriatpuiLetterResponse {
  refNo: string;
  date: string;
  orgHeader: string;
  subject: string;
  bodyText: string;
  signatoryText: string;
  fullLetterText: string;
  verificationHash: string;
  trustScore: number;
}

export interface AIHriatpuiVerificationReport {
  isAuthentic: boolean;
  trustScore: number; // 0 to 100
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  detectedOrg?: string;
  detectedName?: string;
  detectedSignatory?: string;
  detectedDate?: string;
  keyPoints: string[];
  recommendation: 'RECOMMENDED_APPROVE' | 'MANUAL_REVIEW_NEEDED' | 'SUSPICIOUS';
  remarksInMizo: string;
}

