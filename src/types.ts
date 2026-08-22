export type BawmCategory = 'ralna' | 'khawlsak' | 'rikrum' | 'kumtluang' | 'others';

export type PaymentMethod = 'online' | 'cash';

export type ScreenId = 
  | 'screen-home' 
  | 'screen-bawm-explorer'
  | 'screen-checkout' 
  | 'screen-create-qr' 
  | 'screen-creator-reg'
  | 'screen-export-reports'
  | 'screen-cash-pending' 
  | 'screen-success'
  | 'screen-admin';

export interface BawmInfo {
  key: BawmCategory;
  name: string;
  subtitle: string;
  icon: string;
  themeColor: 'purple' | 'emerald' | 'rose' | 'blue' | 'slate' | 'red';
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
  location: string;
  gpsCoords: string;
  upiId: string;
  imageUrl?: string;
  validityDate: string;
  status: 'active' | 'pending_approval' | 'rejected' | 'expired';
  createdAt: string;
  createdBy?: string; // Phone or Creator Name
  approvalRemarks?: string;
  approvedAt?: string;
  approvedBy?: string;
  
  // Ralna specific
  mitthiHming?: string;
  age?: number;
  thihni?: string;
  vuiHun?: string;
  vuitu?: string;
  
  // Khawlsak specific
  cause?: string;
  targetAmount?: number;
  targetPeriod?: 'monthly' | 'yearly' | 'total';
  maxLimit?: number;
  
  // Rikrum specific
  emergencyTitle?: string;
  urgencyLevel?: 'URGENT' | 'CRITICAL' | 'NORMAL';
  urgencyDeadline?: string;
  
  // Kumtluang specific
  orgName?: string;
  orgCode?: string; // System-wide UNIQUE Prefix Code e.g. BET, EBE, KTL, BCM
  subCategories?: string[];
  trxnFeeBearer?: 'user_paid' | 'org_paid';
  sectionLabel?: string; // e.g. "Bial / Unit", "Section / Veng", "Bial / Section"
  definedSections?: string[]; // Pre-defined dropdown list by Creator/Admin (e.g. ["Bial 1", "Bial 2", "Bial 3", "Bial 4", "General"])
  
  // Per-Campaign / Per-Creator Category Rate Overrides
  customPlatformFeePercent?: number;
  customFreeTrialActive?: boolean;
}

export interface Transaction {
  id: string;
  campaignId: string;
  campaignTitle: string;
  category: BawmCategory;
  donorName: string;
  donorPhone?: string;
  donorVeng?: string;
  memberId?: string;
  subId?: string;
  isDependent?: boolean;
  isAnonymous: boolean;
  amount: number;
  platformFee: number;
  totalAmount: number;
  paymentMethod: PaymentMethod;
  status: 'completed' | 'pending_verification';
  subCategoryBreakdown?: { [key: string]: number };
  subCategory?: string;
  periodType?: 'monthly' | 'quarterly' | 'yearly';
  periodMonth?: string;
  periodYear?: string;
  periodLabel?: string;
  remark?: string;
  referenceNo?: string;
  timestamp: string;
  txHash: string;
  isSynced?: boolean;
  createdAt?: string;
  platformFeeBearer?: 'user_paid' | 'org_paid';
}

export interface MemberDependent {
  subId: string; // e.g. EBE-1460-01
  name: string;
  relation?: string; // e.g. Fa, Nupui, Nu, Nau
}

export interface MemberRecord {
  id: string; // e.g. EBE-1460, BCM-8622, BET-7890
  campaignId?: string; // Isolated strictly to this specific Bawm / Campaign
  name: string;
  orgCode: string; // e.g. EBE, BCM, YMA, BET
  phoneLast4: string; // e.g. 1460
  fullPhone?: string;
  avatarUrl?: string;
  section?: string;
  familyHeadName?: string;
  isFamilyHead?: boolean;
  dependents?: MemberDependent[];
  createdAt: string;
}

export interface CreatorProfile {
  name: string;
  orgName: string;
  designation: string;
  phone: string;
  password?: string;
  pin?: string;
  isPhoneVerified: boolean;
  isApproved: boolean;
  isAdmin?: boolean;
  isBlocked?: boolean;
  rejectionReason?: string;
  avatarUrl?: string;
  approvedCategories: BawmCategory[];
  createdQRsCount: number;
  trialExpiresAt?: string;
  subscriptionExpiresAt?: string;
  subscriptionPlan?: 'free_trial' | 'monthly' | 'quarterly' | 'halfYearly' | 'yearly';
  registeredAt?: string;
  authDocName?: string;
  customDiscountPercent?: number;
  customPlatformFeePercent?: number; // Global creator platform fee %
  customTrialDays?: number;
  freePostsQuota?: number; // Total free QR posts quota allowed
  freePostsUsed?: number; // How many free QR posts used
  isFreeServiceGranted?: boolean;
  rankPoints?: number;
  // Per-Category Custom Overrides for this specific creator (e.g. Mr A can have 0% on Ralna and 0.5% on Rikrum)
  categoryCustomOverrides?: Partial<Record<BawmCategory, {
    isTrialActive?: boolean;
    platformFeePercent?: number; // custom % for this specific category
    qrCreationCharge?: number;
    freePostsQuota?: number;
    notes?: string;
  }>>;
}

export interface AuditLog {
  id: string;
  action: string;
  details: string;
  targetType: 'creator' | 'campaign' | 'pricing' | 'announcement' | 'system';
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
}

export interface AnnouncementBanner {
  id: string;
  isActive: boolean;
  type: 'urgent' | 'info' | 'notice' | 'event';
  title: string;
  message: string;
  linkText?: string;
  linkAction?: string;
  animationStyle?: 'marquee' | 'pulse' | 'static' | 'fade' | 'slide';
  rotationSpeedSeconds?: number;
  autoRotate?: boolean;
  items?: AnnouncementItem[];
  createdAt: string;
  updatedAt?: string;
}

export interface BawmFeeRule {
  category: BawmCategory;
  name: string;
  platformFeePercent: number; // e.g. 1.0 = 1%
  platformFeeFixed: number; // e.g. ₹0
  qrCreationCharge: number; // e.g. ₹99 or ₹0
  qrCreationPrice?: number; // alias for qrCreationCharge (e.g. ₹49)
  qrPrintProcessingCharge: number; // e.g. ₹49 or ₹0
  trialPeriodDays: number; // e.g. 30 days
  discountPercent: number; // e.g. 0 to 100%
  discountFlatAmount: number; // e.g. ₹0
  isFreeTrialActive: boolean; // 100% Free Trial toggle
  trialDescription: string;
  
  // Khawlsak & general recurring / subscription rates
  subscriptionRates?: {
    monthly: number; // e.g. ₹99
    quarterly: number; // e.g. ₹249
    halfYearly: number; // e.g. ₹449
    yearly: number; // e.g. ₹799
    customPromoDiscount: number; // %
  };
  
  // Volume tiered slab rates
  volumeSlabs?: {
    upToAmount: number;
    feePercent: number;
    label: string;
  }[];
}

export interface SystemPricingConfig {
  globalDiscountPercent: number;
  globalTrialDays: number;
  qrCreationPrice?: number; // global / default qr creation price if set
  categories: Record<BawmCategory, BawmFeeRule>;
  lastUpdated: string;
  updatedBy: string;
}

export interface BillService {
  id: string;
  name: string;
  icon: string;
  category: string;
  bgColor: string;
  textColor: string;
  fields: { name: string; label: string; placeholder: string; type: string }[];
}
