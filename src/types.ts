export type ScreenId = 
  | 'home' 
  | 'website'
  | 'explorer' 
  | 'checkout' 
  | 'create_qr' 
  | 'creator_reg' 
  | 'reports' 
  | 'success' 
  | 'cash_pending';

export type BawmCategory = 'ralna' | 'khawlsak' | 'rikrum' | 'kumtluang' | 'others';

export type PaymentStatus = 'paid' | 'pending' | 'pending_verification' | 'partial' | 'completed' | 'failed' | 'rejected';

export type PaymentMethod = 'online' | 'cash' | 'upi' | 'bank_transfer' | 'qr_scan' | 'phonepe';

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

export type FeeOptionMode = 'ADD_ON' | 'DEDUCT' | 'DONOR_CHOICE';

export interface Campaign {
  id: string;
  category: BawmCategory;
  title: string;
  titleEn?: string;
  titleMizo?: string;
  subTitle?: string;
  emergencyTitle?: string;
  emergencyTitleEn?: string;
  emergencyTitleMizo?: string;
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
  status?: 'active' | 'completed' | 'expired' | 'pending' | 'pending_approval' | 'rejected' | 'cancelled' | 'archived' | string;
  deletionReason?: string;
  cancelledAt?: string;
  createdAt?: string;
  createdBy?: string;
  creatorName?: string;
  cause?: string;
  causeEn?: string;
  causeMizo?: string;
  targetAmount?: number;
  customAmount?: number;
  maxLimit?: number;
  urgencyLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' | string;
  urgencyDeadline?: string;
  subCategories?: string[];
  trxnFeeBearer?: 'user_paid' | 'creator_paid' | string;
  kumtluangFeeBearer?: string;
  feeOptionRule?: FeeOptionMode;
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
  isVoided?: boolean;
  voidReason?: string;
  voidedAt?: string;
  voidedBy?: string;
  isDynamicGateway?: boolean;
  gatewaySessionExpiresAt?: string;
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
  feeOption?: 'ADD_ON' | 'DEDUCT' | string;
  campaignNetReceived?: number;
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
  utr?: string;
  rejectionReason?: string;
  rejectedAt?: string;
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

export interface CreatorProfile {
  phone: string;
  name: string;
  designation?: string;
  orgName?: string;
  location?: string;
  upiId?: string;
  role?: string;
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
  defaultFeeOptionRule?: FeeOptionMode;
}

export interface SystemPricingConfig {
  trialDurationDays?: number;
  globalTrialDays?: number;
  fixedFeePerTxn?: number;
  percentageFeePerTxn?: number;
  defaultFeeOptionRule?: FeeOptionMode;
  allowDonorFeeChoice?: boolean;
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
  targetType: 'system' | 'creator' | 'campaign' | 'transaction' | 'member' | 'pricing' | 'announcement' | 'staff' | 'report';
  targetId?: string;
  performedBy: string;
  timestamp: string;
}

export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'MODERATOR' | 'CREATOR' | 'MEMBER' | 'GUEST';

export type PermissionKey =
  | 'MANAGE_STAFF_ACCOUNTS'
  | 'MANAGE_PLATFORM_CONFIGS'
  | 'MANAGE_PAYOUT_RATES'
  | 'VIEW_FINANCIAL_REPORTS'
  | 'HANDLE_DISPUTES'
  | 'APPROVE_CAMPAIGNS'
  | 'DELETE_ANY_CAMPAIGN'
  | 'VERIFY_CREATOR_KYC'
  | 'MODERATE_CONTENT'
  | 'REVIEW_REPORTS'
  | 'CREATE_CAMPAIGNS'
  | 'MANAGE_MEMBER_ROLLS'
  | 'MAKE_DONATIONS'
  | 'VIEW_OWN_HISTORY'
  | 'BACKUP_RESTORE_DB'
  | 'system:full_control'
  | 'system:backup_restore'
  | 'pricing:manage'
  | 'staff:manage'
  | 'campaigns:manage'
  | 'campaigns:review_qr'
  | 'campaigns:approve'
  | 'campaigns:delete'
  | 'campaigns:suspend'
  | 'creators:verify_kyc'
  | 'creators:manage'
  | 'creators:assign_plan'
  | 'moderation:reports_desk'
  | 'moderation:ban_users'
  | 'finances:view_reports'
  | 'finances:export_data'
  | 'finances:manage_payouts'
  | 'announcements:manage'
  | 'audit:view_logs'
  | 'campaigns:create'
  | 'campaigns:manage_own'
  | 'members:manage_roll'
  | 'members:import_export'
  | 'payments:make'
  | 'history:view_own'
  | 'profile:manage_own'
  | 'public:browse_campaigns'
  | 'public:scan_qr';

export interface StaffAccount {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  designation?: string;
  isActive: boolean;
  assignedZone?: string;
  assignedAt?: string;
  assignedBy?: string;
  avatarUrl?: string;
  notes?: string;
  lastLogin?: string;
  lastLoginAt?: string;
  createdAt?: string;
  createdBy?: string;
}

export interface ContentReport {
  id: string;
  targetType: 'campaign' | 'creator' | 'member';
  targetId: string;
  targetTitle: string;
  reason: 'fraud' | 'misleading' | 'inappropriate' | 'unauthorized_collection' | 'offensive' | 'other';
  description: string;
  reporterName: string;
  reporterPhone: string;
  status: 'pending' | 'resolved' | 'dismissed';
  createdAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
  resolutionNotes?: string;
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

export type PGMode = 'direct_upi' | 'pg_merchant' | 'SANDBOX' | 'PRODUCTION';
export type PGProvider = 'phonepe_pg' | 'razorpay' | 'cashfree' | 'payu' | 'custom_upi' | 'PHONEPE';
export type PGEnvironment = 'sandbox' | 'production' | 'UAT' | 'SIMULATOR';

export interface PaymentGatewayConfig {
  mode: PGMode | string;
  provider: PGProvider | string;
  environment: PGEnvironment | string;
  merchantId: string;
  keyId: string;
  keySecret: string;
  webhookEndpoint: string;
  saltKey?: string;
  saltIndex?: number;
  webhookSecret?: string;
  isEnabled?: boolean;
  isAutoSplitEnabled?: boolean;
  ronpaySplitPercent?: number;
  minTransactionAmount?: number;
  maxTransactionAmount?: number;
  callbackUrl?: string;
  updatedAt?: string;
}


