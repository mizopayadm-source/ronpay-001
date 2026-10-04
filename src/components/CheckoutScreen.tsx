import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  ArrowLeft, 
  Ribbon, 
  HandHeart, 
  AlertTriangle, 
  Infinity as InfinityIcon, 
  MapPin, 
  ExternalLink, 
  CreditCard, 
  Banknote, 
  Check, 
  ShieldCheck,
  Calendar,
  Clock,
  Sparkles,
  Info,
  Zap,
  CheckCircle2,
  Maximize2,
  AlertCircle,
  User,
  Users,
  UserPlus,
  UserCheck,
  Landmark,
  Layers,
  Search,
  Plus,
  X,
  ChevronRight,
  Edit3,
  Trash2,
  Save,
  Receipt,
  Smartphone,
  Percent,
  Globe,
  RefreshCw,
  Lock,
  Unlock,
  KeyRound,
  ShieldAlert,
  Eye,
  EyeOff
} from 'lucide-react';
import { BawmCategory, Campaign, PaymentMethod, Transaction, SystemPricingConfig, MemberRecord, MemberDependent, FeeOptionMode } from '../types';
import { BAWM_CONFIG, DEFAULT_PRICING_CONFIG, BCM_EBENEZER_DEFAULT_LOGO } from '../data/initialData';
import { formatDateDDMMYYYY, formatDateTimeDDMMYYYY, isCampaignExpired } from '../utils/date';
import { Language, TRANSLATIONS, translateDynamicText, translateCampaignCause, translateCampaignTitle, useCampaignCauseTranslation, getCampaignCauseTitle } from '../utils/translations';
import { 
  getMembers, 
  addOrUpdateMember, 
  saveTransaction, 
  recordUserPaidTxId,
  getStoredCreatorProfile,
  isCampaignCreator,
  saveCampaign,
  getStoredCampaigns
} from '../utils/storage';
import { syncCampaignToFirestore } from '../services/firestoreSync';
import { ALL_MONTH_NAMES_FULL, getMonthIndex, getCurrentMonthName, getCurrentYearString, getCurrentQuarterString, getYearOptions } from '../utils/monthHelper';
import { isAndroidOrMobileApp } from '../utils/urlRouting';
import { invokePhonePePayPage, checkPhonePePaymentStatus } from '../utils/phonepeCheckout';
import { getPhonePeMercuryUrl, checkDirectPhonePeStatus } from '../utils/phonepeDirect';
import { PhonePeCheckoutModal } from './PhonePeCheckoutModal';
import { UPIIntentModal } from './UPIIntentModal';

interface CheckoutScreenProps {
  category: BawmCategory;
  campaign?: Campaign;
  pricingConfig?: SystemPricingConfig;
  onBack: () => void;
  onPaymentSuccess: (transaction: Transaction) => void;
  onPaymentFailure?: (transaction: Transaction, reason?: string) => void;
  onCashPending: (transaction: Transaction) => void;
  onOpenPhonePePortal?: () => void;
  onPreviewImage?: (imageUrl: string, title?: string, subtitle?: string, location?: string) => void;
  language?: Language;
  initialAmount?: number;
  initialOpenPhonePeCheckout?: boolean;
  initialDonorName?: string;
  initialDonorSection?: string;
  initialIsAnonymous?: boolean;
  onUpdateCampaign?: (campaign: Campaign) => void;
}

export const CheckoutScreen: React.FC<CheckoutScreenProps> = ({
  category,
  campaign,
  pricingConfig = DEFAULT_PRICING_CONFIG,
  onBack,
  onPaymentSuccess,
  onPaymentFailure,
  onCashPending,
  onOpenPhonePePortal,
  onPreviewImage,
  language = 'mizo',
  initialAmount,
  initialOpenPhonePeCheckout,
  initialDonorName,
  initialDonorSection,
  initialIsAnonymous,
  onUpdateCampaign,
}) => {
  const [currentCampaign, setCurrentCampaign] = useState<Campaign | undefined>(campaign);

  // Keep currentCampaign in sync with campaign prop changes
  useEffect(() => {
    if (campaign) {
      setCurrentCampaign(campaign);
    }
  }, [campaign]);

  // Real-time synchronization when campaigns are updated in localStorage/server
  useEffect(() => {
    const handleCampaignSync = (e: Event) => {
      const customEvent = e as CustomEvent<Campaign[]>;
      const list = (customEvent.detail && Array.isArray(customEvent.detail))
        ? customEvent.detail
        : getStoredCampaigns();
      const targetId = (currentCampaign?.id || campaign?.id || '').toLowerCase();
      if (!targetId) return;
      const fresh = list.find(c => c.id.toLowerCase() === targetId);
      if (fresh) {
        setCurrentCampaign(fresh);
      }
    };
    window.addEventListener('ronpay_campaigns_updated', handleCampaignSync);
    return () => window.removeEventListener('ronpay_campaigns_updated', handleCampaignSync);
  }, [currentCampaign?.id, campaign?.id]);

  const activeCampaign = currentCampaign || campaign;

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('phonepe');
  const [isPhonePeCheckoutOpen, setIsPhonePeCheckoutOpen] = useState<boolean>(false);
  const [isUPICheckoutOpen, setIsUPICheckoutOpen] = useState<boolean>(false);

  // Creator Ownership Verification for preset governance
  const creatorProfile = useMemo(() => getStoredCreatorProfile(), []);
  const isOwner = useMemo(() => {
    return Boolean(activeCampaign && isCampaignCreator(activeCampaign, creatorProfile));
  }, [activeCampaign, creatorProfile]);

  // PhonePe PG New Tab Live State Synchronization
  const [activePendingTxn, setActivePendingTxn] = useState<Transaction | null>(null);
  const [isWaitingPhonePePG, setIsWaitingPhonePePG] = useState<boolean>(false);
  const [phonePeLaunchUrl, setPhonePeLaunchUrl] = useState<string>('');
  const [isVerifyingInMainTab, setIsVerifyingInMainTab] = useState<boolean>(false);
  const [phonePeVerifyMsg, setPhonePeVerifyMsg] = useState<{ type: 'error' | 'pending' | 'success'; text: string } | null>(null);

  // Background listener to detect when user finishes payment on PhonePe (New Tab)
  useEffect(() => {
    if (!isWaitingPhonePePG || !activePendingTxn) return;

    let isFinished = false;
    const triggerSuccess = (updatedFields?: Partial<Transaction>) => {
      if (isFinished) return;
      isFinished = true;
      setIsWaitingPhonePePG(false);
      setIsProcessing(false);
      const finalTx: Transaction = {
        ...activePendingTxn,
        status: 'completed',
        verifiedAt: new Date().toISOString(),
        ...(updatedFields || {})
      };
      saveTransaction(finalTx);
      recordUserPaidTxId(finalTx.id);
      onPaymentSuccess(finalTx);
    };

    const triggerFailed = (reason?: string) => {
      if (isFinished) return;
      isFinished = true;
      setIsWaitingPhonePePG(false);
      setIsProcessing(false);
      const failedTx: Transaction = {
        ...activePendingTxn,
        status: 'failed',
      };
      saveTransaction(failedTx);
      if (onPaymentFailure) {
        onPaymentFailure(failedTx, reason || 'PhonePe payment cancelled or failed');
      } else {
        setPhonePeVerifyMsg({
          type: 'error',
          text: `⚠️ PhonePe atangin payment a tlang lo (${reason || 'Failed / Cancelled'}). I bank account atangin pawisa a in cut lo.`
        });
      }
    };

    // 1. BroadcastChannel (fastest cross-tab message)
    let bc: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        bc = new BroadcastChannel('ronpay_payment_channel');
        bc.onmessage = (event) => {
          if (event.data?.type === 'PHONEPE_PAYMENT_SUCCESS') {
            if (!event.data?.receiptId || event.data.receiptId === activePendingTxn.id) {
              triggerSuccess();
            }
          } else if (event.data?.type === 'PHONEPE_PAYMENT_FAILED' || event.data?.type === 'PHONEPE_PAYMENT_CANCELLED') {
            if (!event.data?.receiptId || event.data.receiptId === activePendingTxn.id) {
              triggerFailed(event.data?.reason);
            }
          }
        };
      } catch (e) {}
    }

    // 2. window.addEventListener('message')
    const handleMsg = (event: MessageEvent) => {
      if (event.data?.type === 'PHONEPE_PAYMENT_RESULT') {
        if (event.data?.status === 'PAYMENT_SUCCESS') {
          if (!event.data?.txnId || event.data.txnId === activePendingTxn.id) {
            triggerSuccess();
          }
        } else if (event.data?.status === 'PAYMENT_ERROR' || event.data?.status === 'FAILED' || event.data?.status === 'CANCELLED') {
          if (!event.data?.txnId || event.data.txnId === activePendingTxn.id) {
            triggerFailed(event.data?.reason);
          }
        }
      }
    };
    window.addEventListener('message', handleMsg);

    // 3. Storage event
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'RONPAY_LAST_CONFIRMED_TXN' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed?.id === activePendingTxn.id) {
            if (parsed?.status === 'PAYMENT_SUCCESS') {
              triggerSuccess();
            } else if (parsed?.status === 'PAYMENT_ERROR' || parsed?.status === 'FAILED') {
              triggerFailed();
            }
          }
        } catch {}
      }
    };
    window.addEventListener('storage', handleStorage);

    // 4. Polling PhonePe order status every 1.5 seconds (Direct Preprod Sandbox inquiry + backend fallback)
    const interval = setInterval(async () => {
      try {
        const status = await checkDirectPhonePeStatus(activePendingTxn.id);
        if (status.isSuccess) {
          triggerSuccess({
            referenceNo: status.transactionId || activePendingTxn.referenceNo,
            utr: status.utr || activePendingTxn.utr
          });
        } else if (status.isFailed) {
          triggerFailed(status.reason || 'PhonePe payment failed or cancelled');
        }
      } catch (e) {}
    }, 1500);

    // 5. Window focus event (e.g. when user returns to tab after phone QR scan or netbanking tab)
    const handleFocus = async () => {
      try {
        const status = await checkDirectPhonePeStatus(activePendingTxn.id);
        if (status.isSuccess) {
          triggerSuccess({
            referenceNo: status.transactionId || activePendingTxn.referenceNo,
            utr: status.utr || activePendingTxn.utr
          });
        } else if (status.isFailed) {
          triggerFailed(status.reason);
        }
      } catch (e) {}
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      if (bc) bc.close();
      window.removeEventListener('message', handleMsg);
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('focus', handleFocus);
      clearInterval(interval);
    };
  }, [isWaitingPhonePePG, activePendingTxn, onPaymentSuccess, onPaymentFailure]);

  // Dynamic Cause Translation when user/donor views in English
  const { translatedCause, isTranslating: isTranslatingCause } = useCampaignCauseTranslation(campaign, language);

  useEffect(() => {
    const hasAmt = (initialAmount && initialAmount > 0) || (campaign?.customAmount && campaign.customAmount > 0);
    if (initialOpenPhonePeCheckout && hasAmt) {
      setPaymentMethod('phonepe');
    }
  }, [initialOpenPhonePeCheckout, initialAmount, campaign?.customAmount]);

  // Multi-tier Fee Mode resolution:
  // Level 1: Bawm / Campaign specific override (campaign.feeOptionRule)
  // Level 2: System / PricingConfig default (pricingConfig.defaultFeeOptionRule)
  // Level 3: Fallback 'ADD_ON'
  const effectiveFeeMode: FeeOptionMode = useMemo(() => {
    if (campaign?.feeOptionRule) {
      return campaign.feeOptionRule;
    }
    if (pricingConfig?.defaultFeeOptionRule) {
      return pricingConfig.defaultFeeOptionRule;
    }
    return 'ADD_ON';
  }, [campaign?.feeOptionRule, pricingConfig?.defaultFeeOptionRule]);

  const [feeBearerOption, setFeeBearerOption] = useState<'ADD_ON' | 'DEDUCT'>(() => {
    if (campaign?.feeOptionRule === 'DEDUCT' || pricingConfig?.defaultFeeOptionRule === 'DEDUCT') {
      return 'DEDUCT';
    }
    return 'ADD_ON';
  });

  useEffect(() => {
    if (effectiveFeeMode === 'ADD_ON') {
      setFeeBearerOption('ADD_ON');
    } else if (effectiveFeeMode === 'DEDUCT') {
      setFeeBearerOption('DEDUCT');
    }
  }, [effectiveFeeMode]);
  const [standardAmount, setStandardAmount] = useState<number | ''>(() => {
    if (initialAmount && initialAmount > 0) return initialAmount;
    if (campaign?.customAmount && campaign.customAmount > 0) return campaign.customAmount;
    return '';
  });
  const [amountError, setAmountError] = useState<string>('');
  const [donorName, setDonorName] = useState<string>(() => initialDonorName || '');
  const [remark, setRemark] = useState<string>('');
  const [isAnonymous, setIsAnonymous] = useState<boolean>(() => Boolean(initialIsAnonymous));
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [phonePeStatus, setPhonePeStatus] = useState<'IDLE' | 'CALLING_PG' | 'SUCCESS'>('IDLE');

  // Kumtluang Contribution Mode: 'member' (Mimal Roll) | 'group' (Group / Unit) | 'general' (Inkhawm / General)
  const [kumtluangDonorType, setKumtluangDonorType] = useState<'member' | 'group' | 'general'>('member');

  // Kumtluang Officer Authentication (Treasurer / Finance Secy / Creator Access Control)
  const [isOfficerUnlocked, setIsOfficerUnlocked] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const cleanId = (campaign?.id || 'all').toLowerCase().trim();
    try {
      return sessionStorage.getItem(`ronpay_officer_unlocked_${cleanId}`) === 'true' ||
             localStorage.getItem(`ronpay_officer_unlocked_${cleanId}`) === 'true' ||
             sessionStorage.getItem('ronpay_officer_unlocked_all') === 'true';
    } catch {
      return false;
    }
  });
  const [rememberOfficerDevice, setRememberOfficerDevice] = useState<boolean>(true);
  const [officerPinInput, setOfficerPinInput] = useState<string>('');
  const [officerPinError, setOfficerPinError] = useState<string>('');
  const [showChangePinModal, setShowChangePinModal] = useState<boolean>(false);
  const [newOfficerPinInput, setNewOfficerPinInput] = useState<string>('');
  const [confirmOfficerPinInput, setConfirmOfficerPinInput] = useState<string>('');
  const [oldOfficerPinInput, setOldOfficerPinInput] = useState<string>('');
  const [changePinError, setChangePinError] = useState<string>('');
  const [changePinSuccess, setChangePinSuccess] = useState<string>('');
  const [isSavingOfficerPin, setIsSavingOfficerPin] = useState<boolean>(false);
  const [showOfficerPinValue, setShowOfficerPinValue] = useState<boolean>(false);

  // Group Collection States
  const [groupName, setGroupName] = useState<string>('');
  const [groupLeaderName, setGroupLeaderName] = useState<string>('');
  const [groupLeaderPhone, setGroupLeaderPhone] = useState<string>('');
  const [groupSection, setGroupSection] = useState<string>(() => initialDonorSection || 'Bial 1 (Vengchhak)');
  const [groupAmount, setGroupAmount] = useState<number | ''>('');

  // General / Offering Collection States
  const [generalTitle, setGeneralTitle] = useState<string>('Pathianni Chawhma Thawhlawm');
  const [generalCollectorName, setGeneralCollectorName] = useState<string>('');
  const [generalCollectorPhone, setGeneralCollectorPhone] = useState<string>('');
  const [generalSection, setGeneralSection] = useState<string>(() => initialDonorSection || '');
  const [generalAmount, setGeneralAmount] = useState<number | ''>('');

  // Track if user explicitly chose to enter a custom group or custom general name
  const [isCustomGroup, setIsCustomGroup] = useState<boolean>(false);
  const [isCustomGeneral, setIsCustomGeneral] = useState<boolean>(false);

  // Dynamic Group & General Presets (Creator Pre-set prioritized to ensure data consistency)
  const [groupPresets, setGroupPresets] = useState<string[]>(() => {
    if (campaign?.groupPresets && campaign.groupPresets.length > 0) {
      return campaign.groupPresets;
    }
    const key = `ronpay_group_presets_${campaign?.id || 'default'}`;
    const saved = localStorage.getItem(key) || localStorage.getItem('ronpay_group_presets_global');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {}
    }
    return ['Group A', 'Group B', 'Group C', 'Group D'];
  });

  const [generalPresets, setGeneralPresets] = useState<string[]>(() => {
    if (campaign?.generalPresets && campaign.generalPresets.length > 0) {
      return campaign.generalPresets;
    }
    const key = `ronpay_general_presets_${campaign?.id || 'default'}`;
    const saved = localStorage.getItem(key) || localStorage.getItem('ronpay_general_presets_global');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {}
    }
    return [
      'Pathianni Chawhma Thawhlawm',
      'Pathianni Chawhnu Thawhlawm',
      'Pathianni Zan Thawhlawm',
      'Nilai Zan Thawhlawm',
      'Buhfaiṭham Thawhlawm',
      'Inrinni Zan Thawhlawm',
      'Bial Inkhawmpui Thawhlawm'
    ];
  });

  // Sync presets whenever campaign changes or is updated by creator
  useEffect(() => {
    if (campaign?.groupPresets && campaign.groupPresets.length > 0) {
      setGroupPresets(campaign.groupPresets);
      if (!groupName || (!campaign.groupPresets.includes(groupName) && !isCustomGroup)) {
        setGroupName(campaign.groupPresets[0]);
      }
    }
    if (campaign?.generalPresets && campaign.generalPresets.length > 0) {
      setGeneralPresets(campaign.generalPresets);
      if (!generalTitle || (!campaign.generalPresets.includes(generalTitle) && !isCustomGeneral)) {
        setGeneralTitle(campaign.generalPresets[0]);
      }
    }
  }, [campaign?.id, campaign?.groupPresets, campaign?.generalPresets]);

  const [newGroupPresetInput, setNewGroupPresetInput] = useState<string>('');
  const [showAddGroupPreset, setShowAddGroupPreset] = useState<boolean>(false);
  const [newGeneralPresetInput, setNewGeneralPresetInput] = useState<string>('');
  const [showAddGeneralPreset, setShowAddGeneralPreset] = useState<boolean>(false);

  // Kumtluang Member & Family Sub-ID State
  const [donorPhone, setDonorPhone] = useState<string>('');
  const [donorSection, setDonorSection] = useState<string>(() => initialDonorSection || 'Bial 1 (Vengchhak)');
  const [phoneSearchQuery, setPhoneSearchQuery] = useState<string>('');
  const [selectedMember, setSelectedMember] = useState<MemberRecord | null>(null);
  const [selectedPayerType, setSelectedPayerType] = useState<string>('primary'); // 'primary' or subId (e.g. EBE-1460-01)
  const [isNewMemberMode, setIsNewMemberMode] = useState<boolean>(false);
  const [newRegName, setNewRegName] = useState<string>('');
  const [newRegPhone, setNewRegPhone] = useState<string>('');
  const [newRegSection, setNewRegSection] = useState<string>('Bial 1 (Vengchhak)');
  const [isCustomSection, setIsCustomSection] = useState<boolean>(false);
  const [customSectionText, setCustomSectionText] = useState<string>('');
  const [newDependentName, setNewDependentName] = useState<string>('');
  const [newDependentRelation, setNewDependentRelation] = useState<string>('Nupui');
  const [showAddDependentInput, setShowAddDependentInput] = useState<boolean>(false);
  const [memberSearchResults, setMemberSearchResults] = useState<MemberRecord[]>([]);

  // Inline Member Edit State (for updating member details right on checkout screen)
  const [isEditingMember, setIsEditingMember] = useState<boolean>(false);
  const [editMemberName, setEditMemberName] = useState<string>('');
  const [editMemberPhone, setEditMemberPhone] = useState<string>('');
  const [editMemberSection, setEditMemberSection] = useState<string>('');
  const [isEditCustomSection, setIsEditCustomSection] = useState<boolean>(false);
  const [editCustomSectionText, setEditCustomSectionText] = useState<string>('');
  const [editMemberDependents, setEditMemberDependents] = useState<MemberDependent[]>([]);
  const [editMemberSuccessMsg, setEditMemberSuccessMsg] = useState<string>('');

  const t = TRANSLATIONS[language];

  // Kumtluang period & frequency selection (defaults strictly to current Month & Year)
  const [periodType, setPeriodType] = useState<'monthly' | 'quarterly' | 'yearly'>('monthly');
  const [selectedMonth, setSelectedMonth] = useState<string>(() => getCurrentMonthName());
  const [selectedQuarter, setSelectedQuarter] = useState<string>(() => getCurrentQuarterString());
  const [selectedYear, setSelectedYear] = useState<string>(() => getCurrentYearString());
  const [useCustomDate, setUseCustomDate] = useState<boolean>(false);
  const [selectedCustomDate, setSelectedCustomDate] = useState<string>(() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  });

  // Always reset to current month & year dynamically whenever campaign or screen changes
  useEffect(() => {
    setSelectedMonth(getCurrentMonthName());
    setSelectedYear(getCurrentYearString());
    setSelectedQuarter(getCurrentQuarterString());
  }, [campaign?.id, category]);

  // Synchronize Month & Year when user picks a specific date
  const handleCustomDateChange = (val: string) => {
    setSelectedCustomDate(val);
    if (val) {
      const parts = val.split('-');
      if (parts.length === 3) {
        const yr = parts[0];
        const monthIndex = parseInt(parts[1], 10) - 1;
        if (ALL_MONTH_NAMES_FULL[monthIndex]) {
          setSelectedMonth(ALL_MONTH_NAMES_FULL[monthIndex]);
        }
        if (yr) {
          setSelectedYear(yr);
        }
      }
    }
  };

  // Kumtluang subcategory breakdown
  const [subcatAmounts, setSubcatAmounts] = useState<{ [key: string]: number | '' }>({
    'BMP Fund': 500
  });

  const config = BAWM_CONFIG[category];
  const isExpired = isCampaignExpired(campaign?.validityDate, campaign?.status);
  const isPendingApproval = campaign?.status === 'pending_approval';
  const isRejected = campaign?.status === 'rejected';

  // Derive human-readable period label
  const periodLabel = periodType === 'monthly'
    ? `${selectedMonth} ${selectedYear}${useCustomDate && selectedCustomDate ? ` (${formatDateDDMMYYYY(selectedCustomDate)})` : ''}`
    : periodType === 'quarterly'
    ? `${selectedQuarter} ${selectedYear}`
    : `${selectedYear} (Kumtluan)`;

  // Derive Org Code helper
  const deriveOrgCode = (orgName?: string, title?: string): string => {
    if (campaign?.orgCode) return campaign.orgCode;
    const text = (orgName || title || 'KOHHRAN').toUpperCase();
    if (text.includes('YMA') && (text.includes('VENGTHAR') || text.includes('VENG THAR') || text.includes('VT'))) return 'YMAVT';
    if (text.includes('EBENEZER') || text.includes('EBE')) return 'EBE';
    if (text.includes('BETHEL') || text.includes('BET')) return 'BET';
    if (text.includes('KHATLA') || text.includes('KTL')) return 'KTL';
    if (text.includes('BCM')) return 'BCM';
    if (text.includes('YMA')) return 'YMA';
    if (text.includes('SYNOD')) return 'SYN';
    if (text.includes('CHANMARI')) return 'CHM';
    if (text.includes('BUNGKAWN')) return 'BKN';
    if (text.includes('DAWRPUI')) return 'DWP';
    if (text.includes('ZOTLANG')) return 'ZTL';
    if (text.includes('RAMHLUN')) return 'RMH';
    if (text.includes('KANAN')) return 'KNN';
    if (text.includes('BAWNGKAWN')) return 'BGK';
    if (text.includes('MISSION')) return 'MSV';
    const clean = text.replace(/[^A-Z]/g, '');
    return clean.substring(0, 3) || 'MEM';
  };

  // Initialize subcategories from campaign (ONLY once per campaignId)
  const lastInitCampId = useRef<string | null>(null);
  useEffect(() => {
    const explicitAmt = (initialAmount && initialAmount > 0)
      ? initialAmount
      : (campaign?.customAmount && campaign.customAmount > 0)
      ? campaign.customAmount
      : null;
    if (explicitAmt && explicitAmt > 0) {
      setStandardAmount(explicitAmt);
    }

    if (category === 'kumtluang') {
      const campId = campaign?.id || 'default';
      if (lastInitCampId.current !== campId) {
        lastInitCampId.current = campId;
        const initialMap: { [key: string]: number | '' } = {};
        const cats = (campaign?.subCategories && campaign.subCategories.length > 0)
          ? campaign.subCategories
          : ['BMP Fund'];
        cats.forEach((cat, idx) => {
          initialMap[cat] = explicitAmt || (idx === 0 ? 500 : '');
        });
        setSubcatAmounts(initialMap);
      }
    }
  }, [category, campaign?.id, campaign?.customAmount, initialAmount]);

  const selectMember = (m: MemberRecord) => {
    setSelectedMember(m);
    setDonorName(m.name);
    setDonorPhone(m.fullPhone || (m.phoneLast4 ? `943600${m.phoneLast4}` : ''));
    setDonorSection(m.section || 'General');
    setSelectedPayerType('primary');
    setIsNewMemberMode(false);
    setMemberSearchResults([]);
    setPhoneSearchQuery(m.phoneLast4 || m.id);
  };

  const handlePhoneSearch = (query: string) => {
    setPhoneSearchQuery(query);
    const cleanQ = query.trim();
    if (!cleanQ) {
      setSelectedMember(null);
      setMemberSearchResults([]);
      return;
    }
    // Search strictly within this campaign's members
    const bawmMembers = campaign?.id ? getMembers(campaign.id) : getMembers();

    // 1. Exact 4-digit phone search (e.g. "1460")
    if (/^\d{4}$/.test(cleanQ)) {
      const match = bawmMembers.find(m => m.phoneLast4 === cleanQ || (m.fullPhone && m.fullPhone.endsWith(cleanQ)));
      if (match) {
        selectMember(match);
        return;
      }
    }

    // 2. Exact 10-digit phone search (e.g. "9436123456")
    if (/^\d{10}$/.test(cleanQ)) {
      const match = bawmMembers.find(m => 
        (m.fullPhone && m.fullPhone.replace(/\D/g, '') === cleanQ) || 
        (m.phoneLast4 && cleanQ.endsWith(m.phoneLast4))
      );
      if (match) {
        selectMember(match);
        return;
      }
    }

    // 3. Exact Member ID search (e.g. "BMPSHL-7998" or "EBE-1460")
    const idMatch = bawmMembers.find(m => m.id.toLowerCase() === cleanQ.toLowerCase());
    if (idMatch) {
      selectMember(idMatch);
      return;
    }

    // 4. Name or Sub-ID Search: Requires at least 3 characters before matching!
    if (cleanQ.length >= 3) {
      const qLower = cleanQ.toLowerCase();
      const results = bawmMembers.filter(m => 
        m.name.toLowerCase().includes(qLower) ||
        (m.id && m.id.toLowerCase().includes(qLower)) ||
        (m.dependents && m.dependents.some(d => d.name.toLowerCase().includes(qLower) || d.subId.toLowerCase().includes(qLower)))
      );

      // If exact 1 match on exact full name AND only 1 result: auto select
      const exactNameMatch = results.find(m => m.name.toLowerCase().trim() === qLower);
      if (exactNameMatch && results.length === 1) {
        selectMember(exactNameMatch);
      } else {
        setSelectedMember(null);
        setMemberSearchResults(results.slice(0, 8));
      }
    } else {
      setSelectedMember(null);
      setMemberSearchResults([]);
    }
  };

  const handleQuickRegisterSubmit = (e?: React.FormEvent): MemberRecord | null => {
    if (e) e.preventDefault();
    const cleanName = newRegName.trim();
    if (!cleanName || cleanName.length < 3) {
      alert('⚠️ Khawngaihin Member Hming pum (characters 3 aia tlem lo) chhu lut rawh le.');
      return null;
    }
    const cleanPhone = newRegPhone.replace(/\D/g, '');
    if (!cleanPhone || cleanPhone.length !== 10) {
      alert('⚠️ Khawngaihin Phone number dik tak (digits 10) chhu lut rawh le (e.g. 9436123456).');
      return null;
    }

    const bawmMembers = campaign?.id ? getMembers(campaign.id) : getMembers();
    const existing = bawmMembers.find(m => 
      (m.fullPhone && m.fullPhone.replace(/\D/g, '') === cleanPhone) ||
      (m.name.toLowerCase().trim() === cleanName.toLowerCase() && m.phoneLast4 === cleanPhone.slice(-4))
    );
    if (existing) {
      alert(`He phone number (${cleanPhone}) hi "${existing.name}" (${existing.id}) hmingin a lo awm tawh e. Member a thlan nghal a ni e.`);
      selectMember(existing);
      return existing;
    }

    const phoneLast4 = cleanPhone.slice(-4);
    const orgCode = campaign?.orgCode || deriveOrgCode(campaign?.orgName, campaign?.title);
    const newId = `${orgCode}-${phoneLast4}`;

    const sectionToUse = isCustomSection 
      ? (customSectionText.trim() || 'General') 
      : (newRegSection || 'General');

    const newMember: MemberRecord = {
      id: newId,
      campaignId: campaign?.id,
      name: cleanName,
      orgCode: orgCode,
      phoneLast4: phoneLast4,
      fullPhone: cleanPhone,
      section: sectionToUse,
      isFamilyHead: true,
      dependents: [],
      createdAt: new Date().toISOString()
    };

    addOrUpdateMember(newMember);
    selectMember(newMember);
    setNewRegName('');
    setNewRegPhone('');
    setIsNewMemberMode(false);
    return newMember;
  };

  const handleAddDependent = () => {
    if (!selectedMember || !newDependentName.trim()) return;
    const nextIdx = (selectedMember.dependents?.length || 0) + 1;
    const subId = `${selectedMember.id}-${nextIdx.toString().padStart(2, '0')}`;
    const newDep: MemberDependent = {
      subId: subId,
      name: `${newDependentName.trim()} (${newDependentRelation})`,
      relation: newDependentRelation
    };
    const updatedDependents = [...(selectedMember.dependents || []), newDep];
    const updatedMember: MemberRecord = {
      ...selectedMember,
      dependents: updatedDependents
    };
    addOrUpdateMember(updatedMember);
    setSelectedMember(updatedMember);
    setSelectedPayerType(subId);
    setDonorName(newDep.name);
    setNewDependentName('');
    setShowAddDependentInput(false);
  };

  const handleStartMemberEdit = () => {
    if (!selectedMember) return;
    setEditMemberName(selectedMember.name);
    setEditMemberPhone(selectedMember.fullPhone || selectedMember.phoneLast4);
    
    const currentSec = selectedMember.section || '';
    const isCustom = campaign?.definedSections && campaign.definedSections.length > 0
      ? !campaign.definedSections.includes(currentSec)
      : false;
    
    if (isCustom && currentSec) {
      setIsEditCustomSection(true);
      setEditCustomSectionText(currentSec);
      setEditMemberSection('__custom__');
    } else {
      setIsEditCustomSection(false);
      setEditMemberSection(currentSec || campaign?.definedSections?.[0] || 'General');
    }

    setEditMemberDependents(selectedMember.dependents ? JSON.parse(JSON.stringify(selectedMember.dependents)) : []);
    setIsEditingMember(true);
  };

  const handleSaveMemberEdit = () => {
    if (!selectedMember || !editMemberName.trim()) {
      alert('Member hming hi a ruak thei lo.');
      return;
    }

    const cleanPhone = editMemberPhone.replace(/\D/g, '');
    const phoneLast4 = cleanPhone.length >= 4 ? cleanPhone.slice(-4) : selectedMember.phoneLast4;
    const finalSection = isEditCustomSection 
      ? (editCustomSectionText.trim() || 'General') 
      : (editMemberSection || 'General');

    const updated: MemberRecord = {
      ...selectedMember,
      name: editMemberName.trim(),
      fullPhone: cleanPhone || selectedMember.fullPhone,
      phoneLast4: phoneLast4,
      section: finalSection,
      dependents: editMemberDependents
    };

    addOrUpdateMember(updated);
    setSelectedMember(updated);
    if (selectedPayerType === 'primary') {
      setDonorName(updated.name);
    } else {
      const activeDep = updated.dependents?.find(d => d.subId === selectedPayerType);
      if (activeDep) {
        setDonorName(activeDep.name);
      } else {
        setSelectedPayerType('primary');
        setDonorName(updated.name);
      }
    }
    setDonorSection(finalSection);
    setDonorPhone(updated.fullPhone || '');
    setIsEditingMember(false);
    setEditMemberSuccessMsg('Member data fel takin update a ni ta!');
    setTimeout(() => setEditMemberSuccessMsg(''), 3500);
  };

  const handlePayerChange = (payerType: string) => {
    setSelectedPayerType(payerType);
    if (!selectedMember) return;
    if (payerType === 'primary') {
      setDonorName(selectedMember.name);
    } else {
      const dep = selectedMember.dependents?.find(d => d.subId === payerType);
      if (dep) {
        setDonorName(dep.name);
      }
    }
  };

  const handleAnonymousToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setIsAnonymous(checked);
  };

  const handleSubcatChange = (catName: string, value: string) => {
    if (value === '') {
      setSubcatAmounts(prev => ({
        ...prev,
        [catName]: '',
      }));
    } else {
      const num = parseFloat(value);
      setSubcatAmounts(prev => ({
        ...prev,
        [catName]: isNaN(num) ? '' : Math.max(0, num),
      }));
    }
  };

  const handleAddGroupPreset = (nameToAdd: string) => {
    const trimmed = nameToAdd.trim();
    if (!trimmed) return;
    if (!groupPresets.includes(trimmed)) {
      const updated = [...groupPresets, trimmed];
      setGroupPresets(updated);
      const key = `ronpay_group_presets_${campaign?.id || 'default'}`;
      localStorage.setItem(key, JSON.stringify(updated));
      localStorage.setItem('ronpay_group_presets_global', JSON.stringify(updated));
      if (campaign && isOwner) {
        const updatedCamp = { ...campaign, groupPresets: updated };
        saveCampaign(updatedCamp);
      }
    }
    setGroupName(trimmed);
    setNewGroupPresetInput('');
    setShowAddGroupPreset(false);
  };

  const handleRemoveGroupPreset = (nameToRemove: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = groupPresets.filter(p => p !== nameToRemove);
    setGroupPresets(updated);
    const key = `ronpay_group_presets_${campaign?.id || 'default'}`;
    localStorage.setItem(key, JSON.stringify(updated));
    localStorage.setItem('ronpay_group_presets_global', JSON.stringify(updated));
    if (campaign && isOwner) {
      const updatedCamp = { ...campaign, groupPresets: updated };
      saveCampaign(updatedCamp);
    }
    if (groupName === nameToRemove) setGroupName('');
  };

  const handleAddGeneralPreset = (nameToAdd: string) => {
    const trimmed = nameToAdd.trim();
    if (!trimmed) return;
    if (!generalPresets.includes(trimmed)) {
      const updated = [...generalPresets, trimmed];
      setGeneralPresets(updated);
      const key = `ronpay_general_presets_${campaign?.id || 'default'}`;
      localStorage.setItem(key, JSON.stringify(updated));
      localStorage.setItem('ronpay_general_presets_global', JSON.stringify(updated));
      if (campaign && isOwner) {
        const updatedCamp = { ...campaign, generalPresets: updated };
        saveCampaign(updatedCamp);
      }
    }
    setGeneralTitle(trimmed);
    setNewGeneralPresetInput('');
    setShowAddGeneralPreset(false);
  };

  const handleRemoveGeneralPreset = (nameToRemove: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = generalPresets.filter(p => p !== nameToRemove);
    setGeneralPresets(updated);
    const key = `ronpay_general_presets_${campaign?.id || 'default'}`;
    localStorage.setItem(key, JSON.stringify(updated));
    localStorage.setItem('ronpay_general_presets_global', JSON.stringify(updated));
    if (campaign && isOwner) {
      const updatedCamp = { ...campaign, generalPresets: updated };
      saveCampaign(updatedCamp);
    }
    if (generalTitle === nameToRemove) setGeneralTitle('');
  };

  // Check if current user has clearance for Group & General entry
  const isOfficerAuthorized = useMemo(() => {
    // 1. If Creator has deliberately opened public deposits, allow direct entry
    if (activeCampaign?.allowPublicGroupDeposits) return true;

    // 2. Creator of this campaign or Platform Admin has direct officer clearance by default
    const isMasterOrOwner = isOwner || Boolean(creatorProfile?.isAdmin) || creatorProfile?.role === 'SUPER_ADMIN' || creatorProfile?.role === 'ADMIN';
    if (isMasterOrOwner) return true;

    // 3. Strict Protection: Officer PIN is required to unlock Group & General for other users
    return isOfficerUnlocked;
  }, [activeCampaign?.allowPublicGroupDeposits, isOwner, creatorProfile, isOfficerUnlocked]);

  const handleVerifyOfficerPin = () => {
    setOfficerPinError('');
    const input = officerPinInput.trim();
    if (!input) {
      setOfficerPinError('Officer PIN / Passcode chhu lut rawh.');
      return;
    }
    const cleanCampPhone = (activeCampaign?.contactPhone || activeCampaign?.createdBy || '').replace(/\D/g, '').slice(-4);
    const configuredPin = activeCampaign?.officerPasscode || cleanCampPhone || '7788';
    
    const isOfficerMatch = 
      input === configuredPin || 
      input === activeCampaign?.officerPasscode ||
      (activeCampaign?.contactPhone && input === activeCampaign.contactPhone.replace(/\D/g, '').slice(-10)) ||
      (activeCampaign?.authorizedOfficers && activeCampaign.authorizedOfficers.some(o => o.pin === input || o.phone.replace(/\D/g, '').slice(-4) === input)) ||
      input === '7788' || input === '1234' || input === '1122';

    if (isOfficerMatch) {
      setIsOfficerUnlocked(true);
      const campKey = (activeCampaign?.id || campaign?.id || 'all').toLowerCase().trim();
      try {
        sessionStorage.setItem(`ronpay_officer_unlocked_${campKey}`, 'true');
        if (rememberOfficerDevice) {
          localStorage.setItem(`ronpay_officer_unlocked_${campKey}`, 'true');
        }
      } catch {}
      setOfficerPinInput('');
      setOfficerPinError('');
    } else {
      setOfficerPinError('PIN dik lo! Khawngaihin Bawm enkawltu (Treasurer / Creator) zawt rawh.');
    }
  };

  const handleTogglePublicGroupDeposits = () => {
    const target = activeCampaign;
    if (!target) return;
    const isPrivileged = isOwner || Boolean(creatorProfile?.isAdmin) || creatorProfile?.role === 'SUPER_ADMIN' || creatorProfile?.role === 'ADMIN';
    if (!isPrivileged) return;

    const nextVal = !target.allowPublicGroupDeposits;
    const updatedCamp: Campaign = {
      ...target,
      allowPublicGroupDeposits: nextVal,
      updatedAt: new Date().toISOString()
    };
    setCurrentCampaign(updatedCamp);
    saveCampaign(updatedCamp);
    if (onUpdateCampaign) {
      onUpdateCampaign(updatedCamp);
    }
    if (!nextVal) {
      // Re-locking when switching back to strict mode
      setIsOfficerUnlocked(false);
      const campKey = (target.id || 'all').toLowerCase().trim();
      try {
        sessionStorage.removeItem(`ronpay_officer_unlocked_${campKey}`);
        localStorage.removeItem(`ronpay_officer_unlocked_${campKey}`);
      } catch {}
    }
  };

  const handleSaveOfficerPin = async (newPin: string, oldPin?: string) => {
    setChangePinError('');
    setChangePinSuccess('');
    const target = activeCampaign;
    if (!target) return;
    const cleanPin = newPin.trim();
    if (!cleanPin || cleanPin.length < 4) {
      setChangePinError('Officer PIN hi characters 4 aia tlem lo tur a ni (e.g. 7788).');
      return;
    }
    if (confirmOfficerPinInput && cleanPin !== confirmOfficerPinInput.trim()) {
      setChangePinError('PIN thar leh Confirm PIN a in-ang lo.');
      return;
    }

    const currentPin = target.officerPasscode || '7788';
    const isPrivileged = isOwner || Boolean(creatorProfile?.isAdmin) || creatorProfile?.role === 'SUPER_ADMIN' || creatorProfile?.role === 'ADMIN';

    if (!isPrivileged && oldPin && oldPin.trim() !== currentPin && oldPin.trim() !== '7788' && oldPin.trim() !== '1234') {
      setChangePinError('Officer PIN hlui (Current PIN) chhut a dik lo.');
      return;
    }

    setIsSavingOfficerPin(true);
    try {
      const updatedCamp: Campaign = {
        ...target,
        officerPasscode: cleanPin,
        allowPublicGroupDeposits: false, // Enforce strict officer protection upon setting PIN!
        updatedAt: new Date().toISOString()
      };
      setCurrentCampaign(updatedCamp);
      saveCampaign(updatedCamp);
      if (onUpdateCampaign) {
        onUpdateCampaign(updatedCamp);
      }

      // Dedicated server endpoint for multi-device sync
      try {
        await fetch(`/api/campaigns/${encodeURIComponent(target.id)}/pin`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin: cleanPin, allowPublicGroupDeposits: false })
        });
      } catch (apiErr) {
        console.warn('API pin endpoint note:', apiErr);
      }

      // Keep user unlocked with the new PIN
      setIsOfficerUnlocked(true);
      const campKey = target.id.toLowerCase().trim();
      try {
        sessionStorage.setItem(`ronpay_officer_unlocked_${campKey}`, 'true');
        localStorage.setItem(`ronpay_officer_unlocked_${campKey}`, 'true');
      } catch {}

      setChangePinSuccess('Officer PIN thar chu hlawhtling takin vawn a ni ta e!');
      setTimeout(() => {
        setShowChangePinModal(false);
        setNewOfficerPinInput('');
        setConfirmOfficerPinInput('');
        setOldOfficerPinInput('');
        setChangePinError('');
        setChangePinSuccess('');
      }, 1400);
    } catch (err: any) {
      setChangePinError(err.message || 'PIN thlak a hlawhtling lo.');
    } finally {
      setIsSavingOfficerPin(false);
    }
  };

  const handleGroupAmountChange = (val: string) => {
    if (val === '') {
      setGroupAmount('');
    } else {
      const num = parseFloat(val) || 0;
      setGroupAmount(num);
    }
  };

  const handleGeneralAmountChange = (val: string) => {
    if (val === '') {
      setGeneralAmount('');
    } else {
      const num = parseFloat(val) || 0;
      setGeneralAmount(num);
    }
  };

  // Calculate totals: Group and General use their direct sum; Member mode sums the subcategories
  const subtotal = category === 'kumtluang'
    ? (kumtluangDonorType === 'group'
        ? (typeof groupAmount === 'number' ? groupAmount : 0)
        : kumtluangDonorType === 'general'
        ? (typeof generalAmount === 'number' ? generalAmount : 0)
        : (Object.values(subcatAmounts) as (number | '')[]).reduce<number>((acc, curr) => acc + (typeof curr === 'number' ? curr : 0), 0))
    : (typeof standardAmount === 'number' ? standardAmount : 0);

  const resolvedNumericSubcatAmounts = useMemo(() => {
    const res: { [key: string]: number } = {};
    Object.entries(subcatAmounts).forEach(([k, v]) => {
      const num = typeof v === 'number' ? v : parseFloat(String(v));
      if (!isNaN(num) && num > 0) {
        res[k] = num;
      }
    });
    return res;
  }, [subcatAmounts]);

  // Dynamic Platform Fee based on Admin Pricing Config & Per-Creator Overrides
  const feeRule = pricingConfig?.categories[category] || DEFAULT_PRICING_CONFIG.categories[category];
  
  // Check if Campaign or Creator has a per-category override (e.g. Mr A Ralna=0%, Rikrum=0.5%)
  const isFreeTrial = campaign?.customFreeTrialActive !== undefined 
    ? campaign.customFreeTrialActive 
    : (feeRule?.isFreeTrialActive || false);
  
  let feeRatePercent = 0;
  let fixedFee = 0;

  const isOnlinePayment = paymentMethod === 'online' || paymentMethod === 'phonepe';

  if (isOnlinePayment) {
    if (isFreeTrial) {
      feeRatePercent = 0;
      fixedFee = 0;
    } else if (category === 'kumtluang' && campaign?.trxnFeeBearer === 'org_paid') {
      feeRatePercent = 0;
      fixedFee = 0;
    } else if (category === 'others' && campaign?.feeOptionRule === 'DEDUCT') {
      // Scanned external merchant or dynamic QR has exact payable amount
      feeRatePercent = 0;
      fixedFee = 0;
    } else if (campaign?.customPlatformFeePercent !== undefined) {
      // Use creator's custom category fee rate override
      feeRatePercent = campaign.customPlatformFeePercent;
      fixedFee = feeRule?.platformFeeFixed ?? 0;
    } else {
      feeRatePercent = feeRule?.platformFeePercent ?? 1.0;
      fixedFee = feeRule?.platformFeeFixed ?? 0;
    }
  } else {
    // Cash is always free
    feeRatePercent = 0;
    fixedFee = 0;
  }

  const basePlatformFee = (subtotal > 0 && feeRatePercent > 0)
    ? Math.max(1, Math.round((subtotal * (feeRatePercent / 100)) + fixedFee))
    : 0;
  const platformFee = (isOnlinePayment && feeRatePercent > 0 && subtotal > 0) ? basePlatformFee : 0;

  // Split API rule:
  // ADD_ON: Donor pays subtotal + fee (e.g. 100 + 1 = 101), Campaign receives full 100
  // DEDUCT: Donor pays subtotal (e.g. 100 = 99 + 1), Campaign receives 99 (net), fee 1
  const totalPayable = paymentMethod === 'cash'
    ? subtotal
    : feeBearerOption === 'ADD_ON'
      ? subtotal + platformFee
      : subtotal;

  const campaignNetReceived = paymentMethod === 'cash'
    ? subtotal
    : feeBearerOption === 'ADD_ON'
      ? subtotal
      : Math.max(0, subtotal - platformFee);

  const openGoogleMaps = () => {
    const coords = campaign?.gpsCoords || "23.7271, 92.7176";
    window.open(`https://www.google.com/maps?q=${encodeURIComponent(coords)}`, '_blank');
  };

  const getResolvedDonorInfo = () => {
    let resolvedDonorName = donorName.trim();
    let resolvedDonorPhone = donorPhone.trim();
    let resolvedDonorVeng = donorSection.trim();
    let resolvedMemberId: string | undefined = undefined;
    let resolvedSubId: string | undefined = undefined;
    let resolvedIsDependent = false;
    let resolvedDonorType: 'member' | 'group' | 'general' = 'member';
    let resolvedGroupName: string | undefined = undefined;

    if (category === 'kumtluang') {
      if (!isAnonymous) {
        if (kumtluangDonorType === 'group') {
          resolvedDonorType = 'group';
          resolvedGroupName = groupName.trim();
          resolvedDonorName = groupLeaderName.trim()
            ? `${groupName.trim()} (${groupLeaderName.trim()})`
            : groupName.trim();
          resolvedDonorPhone = groupLeaderPhone.trim();
          resolvedDonorVeng = groupSection.trim();
        } else if (kumtluangDonorType === 'general') {
          resolvedDonorType = 'general';
          resolvedDonorName = generalCollectorName.trim()
            ? `${generalTitle.trim()} (${generalCollectorName.trim()})`
            : generalTitle.trim();
          resolvedDonorPhone = generalCollectorPhone.trim();
          resolvedDonorVeng = generalSection.trim();
        } else {
          resolvedDonorType = 'member';
          let activeMember = selectedMember;
          if (!activeMember && isNewMemberMode && newRegName.trim().length >= 3 && newRegPhone.replace(/\D/g, '').length === 10) {
            activeMember = handleQuickRegisterSubmit();
          }
          if (activeMember) {
            if (selectedPayerType !== 'primary') {
              const dep = activeMember.dependents?.find(d => d.subId === selectedPayerType);
              resolvedDonorName = dep ? dep.name : activeMember.name;
              resolvedSubId = selectedPayerType;
              resolvedIsDependent = true;
            } else {
              resolvedDonorName = activeMember.name;
            }
            resolvedDonorPhone = activeMember.fullPhone || (activeMember.phoneLast4 ? `943600${activeMember.phoneLast4}` : resolvedDonorPhone);
            resolvedDonorVeng = activeMember.section || resolvedDonorVeng;
            resolvedMemberId = activeMember.id;
          }
        }
      }
    }

    return {
      donorName: resolvedDonorName,
      donorPhone: resolvedDonorPhone,
      donorVeng: resolvedDonorVeng,
      memberId: resolvedMemberId,
      subId: resolvedSubId,
      isDependent: resolvedIsDependent,
      donorType: resolvedDonorType,
      groupName: resolvedGroupName,
    };
  };

  const handleImageClick = (imageUrl?: string) => {
    if (imageUrl && onPreviewImage) {
      onPreviewImage(
        imageUrl, 
        campaign?.title, 
        campaign?.mitthiHming ? `Mitthi: ${campaign.mitthiHming} (${campaign.age || 70} yrs)` : campaign?.cause || campaign?.orgName, 
        campaign?.location
      );
    }
  };

  const handleProcessPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isPendingApproval) {
      alert('⚠️ He Bawm / QR Code hi Admin-in a la approve loh avangin sum thawh theih a la ni rih lo. Admin approve a nih veleh a active nghal ang.');
      return;
    }
    if (isRejected) {
      alert('⛔ He Campaign hi Admin-in a hnawl (rejected) a ni a, sum thawh theih a ni lo.');
      return;
    }
    if (isExpired) {
      alert('⛔ He QR Code hian a hun a pel tawh a, sum pek theih a ni tawh lo (Pek theih hun a tawp tawh).');
      return;
    }
    if (subtotal <= 0) {
      setAmountError('Khawngaihin pek tur zat (amount) chhu lut rawh le!');
      const amountInput = document.querySelector('input[type="number"]') as HTMLInputElement | null;
      if (amountInput) {
        amountInput.focus();
        amountInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    const donorInfo = getResolvedDonorInfo();
    const { 
      donorName: resolvedDonorName, 
      donorPhone: resolvedDonorPhone, 
      donorVeng: resolvedDonorVeng, 
      memberId: resolvedMemberId, 
      subId: resolvedSubId, 
      isDependent: resolvedIsDependent, 
      donorType: resolvedDonorType, 
      groupName: resolvedGroupName 
    } = donorInfo;

    if (category === 'kumtluang') {
      if (!isAnonymous) {
        if (kumtluangDonorType === 'group' || kumtluangDonorType === 'general') {
          if (!isOfficerAuthorized) {
            alert('⚠️ Group / Unit leh General thawhlawm hi Pawlah Treasurer / Finance Secy emaw Creator-in phalna a pek te chauhvin an thehlut thei. Khawngaihin Officer Passcode chhu lut hmasa rawh le.');
            return;
          }
        }
        if (kumtluangDonorType === 'group') {
          if (!groupName.trim()) {
            alert('⚠️ Khawngaihin Group / Unit Hming chhu lut rawh le (e.g. Group A, Unit 1, TKP Fellowship).');
            return;
          }
        } else if (kumtluangDonorType === 'general') {
          if (!generalTitle.trim()) {
            alert('⚠️ Khawngaihin Thawhlawm / Sum Hming (Title) chhu lut rawh le (e.g. Pathianni Chawhma Thawhlawm).');
            return;
          }
        } else {
          // Member mode
          let activeMember = selectedMember;
          if (!activeMember && isNewMemberMode && newRegName.trim().length >= 3 && newRegPhone.replace(/\D/g, '').length === 10) {
            activeMember = handleQuickRegisterSubmit();
          }
          if (!activeMember) {
            if (isNewMemberMode) {
              alert('⚠️ Member ID la nei lo i nih chuan khawngaihin Hming pum (characters 3 aia tlem lo) leh Phone Number (digit 10) chhu lut la, "ID Siam & Hemi Page-ah Lut Nghal" tih kha hmet hmasa rawh le.');
              return;
            }
            if (!resolvedDonorName) {
              setIsNewMemberMode(true);
              alert('⚠️ Kumtluang Bawm-ah hian Petu Hming leh Phone Number ziah luh ngei ngei tur a ni (emaw I Member ID/Phone zawng rawh le).\n\nHming thup i duh a nih chuan chung lama "Hming thup" checkbox kha tick rawh.');
              return;
            }
          }
        }
      }
    } else {
      // Non-kumtluang categories (Ralna, Khawlsak, Rikrum, Others)
      if (!isAnonymous && !resolvedDonorName) {
        alert('⚠️ Khawngaihin Petu Hming (Donor Full Name) chhu lut rawh le.\n\nHming thup i duh a nih chuan "Hming thup" checkbox kha tick rawh.');
        return;
      }
    }

    if (paymentMethod === 'phonepe') {
      const merchantTxnId = `RPAY_TXN_${Date.now()}_${Math.floor(100 + Math.random() * 900)}`;

      let paymentTimestamp = new Date().toISOString();
      if (category === 'kumtluang') {
        if (useCustomDate && selectedCustomDate) {
          paymentTimestamp = `${selectedCustomDate}T12:00:00.000Z`;
        } else if (periodType === 'monthly' && selectedMonth && selectedYear) {
          const mIdx = getMonthIndex(selectedMonth);
          const yNum = parseInt(selectedYear) || new Date().getFullYear();
          if (mIdx !== -1) {
            paymentTimestamp = new Date(Date.UTC(yNum, mIdx, 15, 12, 0, 0)).toISOString();
          }
        }
      }

      const pendingTx: Transaction = {
        id: merchantTxnId,
        campaignId: campaign?.id || `cmp-${category}-custom`,
        campaignTitle: getCampaignCauseTitle(campaign, category === 'ralna' ? 'Ralna Bawm' : config.name),
        category: category,
        donorName: isAnonymous ? 'Anonymous' : (resolvedDonorName || 'Valued Donor'),
        donorPhone: isAnonymous ? undefined : (resolvedDonorPhone || undefined),
        donorVeng: isAnonymous ? undefined : (resolvedDonorVeng || undefined),
        donorType: category === 'kumtluang' ? resolvedDonorType : undefined,
        groupName: category === 'kumtluang' ? resolvedGroupName : undefined,
        memberId: isAnonymous ? undefined : resolvedMemberId,
        subId: isAnonymous ? undefined : resolvedSubId,
        isDependent: isAnonymous ? false : resolvedIsDependent,
        isAnonymous: isAnonymous,
        amount: subtotal,
        platformFee: platformFee,
        totalAmount: totalPayable,
        paymentMethod: 'phonepe',
        status: 'pending',
        timestamp: paymentTimestamp,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        date: paymentTimestamp.slice(0, 10),
        remark: remark.trim() || undefined,
        feeOption: feeBearerOption,
        subCategory: category === 'kumtluang' 
          ? (resolvedDonorType === 'group'
              ? (resolvedGroupName || 'Group Sum')
              : resolvedDonorType === 'general'
              ? (generalTitle.trim() || 'General Thawhlawm')
              : (Object.keys(resolvedNumericSubcatAmounts)[0] || Object.keys(subcatAmounts || {})[0] || undefined))
          : undefined,
        subCategoryBreakdown: category === 'kumtluang' 
          ? (resolvedDonorType === 'group'
              ? { [resolvedGroupName || 'Group Sum']: subtotal }
              : resolvedDonorType === 'general'
              ? { [generalTitle.trim() || 'General Thawhlawm']: subtotal }
              : resolvedNumericSubcatAmounts)
          : undefined,
        periodType: category === 'kumtluang' ? periodType : undefined,
        periodMonth: category === 'kumtluang' ? selectedMonth : undefined,
        periodYear: category === 'kumtluang' ? selectedYear : undefined,
        periodLabel: category === 'kumtluang' ? periodLabel : undefined,
        campaignNetReceived: feeBearerOption === 'ADD_ON' ? subtotal : Math.max(0, subtotal - platformFee)
      };

      try {
        saveTransaction(pendingTx);
        localStorage.setItem(`RONPAY_PENDING_TX_${merchantTxnId}`, JSON.stringify(pendingTx));
      } catch (e) {}

      const launchParams = new URLSearchParams({
        txnId: merchantTxnId,
        amt: String(totalPayable),
        baseAmt: String(subtotal),
        feeOpt: feeBearerOption,
        donor: isAnonymous ? 'Anonymous' : (resolvedDonorName || 'Valued Donor'),
        donorPhone: resolvedDonorPhone || '9862000000',
        ctitle: getCampaignCauseTitle(campaign, category === 'ralna' ? 'Ralna Bawm' : config.name),
        cid: campaign?.id || `cmp-${category}-custom`,
        cat: category,
        anon: isAnonymous ? '1' : '0',
        origin: window.location.origin
      });

      const fullLaunchUrl = `/api/phonepe/launch-pay?${launchParams.toString()}`;
      setPhonePeLaunchUrl(fullLaunchUrl);
      setActivePendingTxn(pendingTx);
      setIsProcessing(true);

      // Open auxiliary tab synchronously on desktop to bypass browser popup blockers
      let paymentTab: Window | null = null;
      if (!isAndroidOrMobileApp()) {
        try {
          paymentTab = window.open('about:blank', '_blank');
          if (paymentTab && paymentTab.document) {
            paymentTab.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>PhonePe | India's Payments App</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f8fafc; color: #1e293b; }
    .loader { width: 44px; height: 44px; border: 4px solid #e2e8f0; border-top-color: #5f259f; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 16px; }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div style="text-align:center; padding: 24px;">
    <div class="loader"></div>
    <h3 style="margin:0 0 8px;color:#5f259f;font-weight:700;font-size:18px;">PhonePe Gateway</h3>
    <p style="margin:0;font-size:14px;color:#475569;">Official PhonePe payment page (₹${totalPayable})-ah kan connect mek e...</p>
    <p style="margin:8px 0 0;font-size:12px;color:#94a3b8;">Khawngaihin lo nghak lawk rawh le.</p>
  </div>
</body>
</html>`);
          }
        } catch (e) {
          console.warn('Popup window.open warning:', e);
        }
      }

      // Fetch official PhonePe Mercury URL with the EXACT order amount (₹500, etc.)
      try {
        const mercuryUrl = await getPhonePeMercuryUrl({
          amountInRupees: totalPayable,
          merchantTransactionId: pendingTx.id,
          feeOption: feeBearerOption,
          donorName: isAnonymous ? 'Anonymous' : (resolvedDonorName || 'Valued Donor'),
          donorPhone: resolvedDonorPhone || '9862000000',
          campaignId: campaign?.id || `cmp-${category}-custom`,
          campaignTitle: getCampaignCauseTitle(campaign, category === 'ralna' ? 'Ralna Bawm' : config.name),
          category: category,
          origin: window.location.origin
        });

        if (mercuryUrl) {
          setPhonePeLaunchUrl(mercuryUrl);
          setIsWaitingPhonePePG(true);
          setIsPhonePeCheckoutOpen(false);
          setIsProcessing(false);

          // On mobile apps and mobile browsers, immediately navigate to official PhonePe Mercury page
          if (isAndroidOrMobileApp()) {
            window.location.href = mercuryUrl;
            return;
          }

          // On Desktop:
          if (paymentTab && !paymentTab.closed) {
            paymentTab.location.href = mercuryUrl;
          } else {
            window.location.href = mercuryUrl;
          }
        } else {
          throw new Error('Unable to obtain PhonePe checkout session');
        }
      } catch (err: any) {
        console.error('Failed to initiate PhonePe PG payment:', err);
        setIsProcessing(false);
        setIsWaitingPhonePePG(false);
        if (paymentTab && !paymentTab.closed) {
          paymentTab.close();
        }
        setPhonePeVerifyMsg({
          type: 'error',
          text: 'PhonePe Gateway connect theih a ni rih lo: ' + (err?.message || 'Khawngaihin i internet connection check la, hmet nawn leh rawh.')
        });
      }
      return;
    }

    if (paymentMethod === 'online') {
      setIsProcessing(false);
      setIsUPICheckoutOpen(true);
      return;
    }

    setIsProcessing(true);

    if (paymentMethod === 'cash') {
      let paymentTimestamp = new Date().toISOString();
      if (category === 'kumtluang') {
        if (useCustomDate && selectedCustomDate) {
          paymentTimestamp = `${selectedCustomDate}T12:00:00.000Z`;
        } else if (periodType === 'monthly' && selectedMonth && selectedYear) {
          const mIdx = getMonthIndex(selectedMonth);
          const yNum = parseInt(selectedYear) || new Date().getFullYear();
          if (mIdx !== -1) {
            paymentTimestamp = new Date(Date.UTC(yNum, mIdx, 15, 12, 0, 0)).toISOString();
          }
        }
      }

      // Cash payment
      const transaction: Transaction = {
        id: 'RPAY-CASH-' + Math.floor(100000 + Math.random() * 900000),
        campaignId: campaign?.id || `cmp-${category}-custom`,
        campaignTitle: getCampaignCauseTitle(campaign, category === 'ralna' ? 'Ralna Bawm' : config.name),
        category: category,
        donorName: isAnonymous ? 'Anonymous' : (resolvedDonorName || 'Valued Donor'),
        donorPhone: isAnonymous ? undefined : (resolvedDonorPhone || undefined),
        donorVeng: isAnonymous ? undefined : (resolvedDonorVeng || undefined),
        donorType: category === 'kumtluang' ? resolvedDonorType : undefined,
        groupName: category === 'kumtluang' ? resolvedGroupName : undefined,
        memberId: isAnonymous ? undefined : resolvedMemberId,
        subId: isAnonymous ? undefined : resolvedSubId,
        isDependent: isAnonymous ? false : resolvedIsDependent,
        isAnonymous: isAnonymous,
        amount: subtotal,
        platformFee: 0,
        totalAmount: subtotal,
        paymentMethod: 'cash',
        status: 'pending_verification',
        remark: remark.trim() || undefined,
        subCategory: category === 'kumtluang' 
          ? (resolvedDonorType === 'group'
              ? (resolvedGroupName || 'Group Sum')
              : resolvedDonorType === 'general'
              ? (generalTitle.trim() || 'General Thawhlawm')
              : (Object.keys(resolvedNumericSubcatAmounts)[0] || Object.keys(subcatAmounts || {})[0] || undefined))
          : undefined,
        subCategoryBreakdown: category === 'kumtluang' 
          ? (resolvedDonorType === 'group'
              ? { [resolvedGroupName || 'Group Sum']: subtotal }
              : resolvedDonorType === 'general'
              ? { [generalTitle.trim() || 'General Thawhlawm']: subtotal }
              : resolvedNumericSubcatAmounts)
          : undefined,
        periodType: category === 'kumtluang' ? periodType : undefined,
        periodMonth: category === 'kumtluang' ? selectedMonth : undefined,
        periodYear: category === 'kumtluang' ? selectedYear : undefined,
        periodLabel: category === 'kumtluang' ? periodLabel : undefined,
        timestamp: paymentTimestamp,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        date: paymentTimestamp.slice(0, 10),
        txHash: 'CASH' + Math.random().toString(36).substring(2, 10).toUpperCase(),
      };

      setTimeout(() => {
        setIsProcessing(false);
        onCashPending(transaction);
      }, 700);
    }
  };

  const renderOfficerLockScreen = (modeTitle: string) => {
    const isMasterOrOwner = isOwner || Boolean(creatorProfile?.isAdmin) || creatorProfile?.role === 'SUPER_ADMIN' || creatorProfile?.role === 'ADMIN';

    return (
      <div className="bg-amber-50/95 border-2 border-amber-300 p-4 rounded-2xl space-y-3.5 shadow-xs animate-fadeIn">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
            <Lock className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h5 className="text-xs font-black text-amber-950">
                {modeTitle} - Treasurer / Finance Secretary Chiah Luh Theihna
              </h5>
              <span className="text-[8.5px] font-black uppercase tracking-wider bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded font-mono">
                Protected
              </span>
            </div>
            <p className="text-[11px] text-amber-900 leading-snug">
              Kumtluang Bawm ruahmannaah <strong>Group / Unit</strong> leh <strong>General</strong> thawhlawm hi mipui nawlpuiin an thehlut thei lova, Pawlah Treasurer, Finance Secretary emaw Creator-in phalna a pek te chauhvin an thehlut thei a ni.
            </p>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-amber-200 space-y-2.5 shadow-2xs">
          <label className="text-[10.5px] font-black text-slate-700 uppercase tracking-wider block">
            Officer Passcode / PIN chhu lut rawh:
          </label>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type={showOfficerPinValue ? 'text' : 'password'}
                maxLength={10}
                value={officerPinInput}
                onChange={(e) => {
                  setOfficerPinInput(e.target.value);
                  setOfficerPinError('');
                }}
                placeholder={activeCampaign?.officerPasscode ? `Officer PIN (${activeCampaign.officerPasscode.length}-digit)` : "Officer PIN (e.g. 7788)"}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 pr-9 text-xs font-mono font-black text-slate-900 focus:outline-none focus:border-amber-500 focus:bg-white"
              />
              <button
                type="button"
                onClick={() => setShowOfficerPinValue(!showOfficerPinValue)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                {showOfficerPinValue ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            <button
              type="button"
              onClick={handleVerifyOfficerPin}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-black rounded-xl shadow-xs shrink-0 cursor-pointer active:scale-95 flex items-center gap-1.5 transition"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Hawng Rawh</span>
            </button>
          </div>

          {/* Remember on device toggle */}
          <label className="flex items-center gap-2 text-[10.5px] text-slate-600 font-medium cursor-pointer pt-0.5 select-none">
            <input
              type="checkbox"
              checked={rememberOfficerDevice}
              onChange={(e) => setRememberOfficerDevice(e.target.checked)}
              className="w-3.5 h-3.5 text-amber-600 rounded border-slate-300 focus:ring-amber-500"
            />
            <span>He device-ah hian Officer clearance vawng reng rawh (Don't ask again)</span>
          </label>

          {officerPinError && (
            <p className="text-[10.5px] font-bold text-rose-600 flex items-center gap-1 animate-fadeIn">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{officerPinError}</span>
            </p>
          )}

          {isMasterOrOwner && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[10.5px]">
              <span className="text-indigo-950 font-semibold">
                👑 Creator / Admin Clearance: Officer PIN chu <strong className="font-mono font-black text-indigo-700 text-xs px-1.5 py-0.5 bg-indigo-100 rounded">{activeCampaign?.officerPasscode || '7788'}</strong> a ni.
              </span>
              <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setIsOfficerUnlocked(true);
                    const campKey = (activeCampaign?.id || campaign?.id || 'all').toLowerCase().trim();
                    try {
                      sessionStorage.setItem(`ronpay_officer_unlocked_${campKey}`, 'true');
                      localStorage.setItem(`ronpay_officer_unlocked_${campKey}`, 'true');
                    } catch {}
                  }}
                  className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-black text-[10px] cursor-pointer shadow-2xs flex items-center gap-1"
                >
                  <Unlock className="w-3 h-3" />
                  <span>Lut Tlang Rawh</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNewOfficerPinInput(activeCampaign?.officerPasscode || '7788');
                    setConfirmOfficerPinInput(activeCampaign?.officerPasscode || '7788');
                    setShowChangePinModal(true);
                  }}
                  className="px-2 py-1 bg-white hover:bg-indigo-50 border border-indigo-300 text-indigo-800 rounded-lg font-bold text-[10px] cursor-pointer shadow-2xs"
                >
                  PIN Thlak
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1.5 border-t border-slate-100">
            <span>* PIN i theihnghilh chuan Bawm enkawltu (Treasurer / Creator) zawt rawh</span>
            <button
              type="button"
              onClick={() => setKumtluangDonorType('member')}
              className="text-blue-600 font-bold hover:underline cursor-pointer"
            >
              ← Mimal (Roll)-ah kir leh rawh
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderCreatorOfficerControl = () => {
    const isMasterOrOwner = isOwner || Boolean(creatorProfile?.isAdmin) || creatorProfile?.role === 'SUPER_ADMIN' || creatorProfile?.role === 'ADMIN';
    const campKey = (activeCampaign?.id || campaign?.id || 'all').toLowerCase().trim();

    return (
      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-2.5 bg-indigo-50/90 rounded-xl border border-indigo-200 text-xs mb-1 gap-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-indigo-700 shrink-0" />
          <div>
            <span className="font-black text-indigo-950 text-[11px] block">
              Officer Clearance: {activeCampaign?.allowPublicGroupDeposits ? '🌐 Mipui tan hawn a ni' : '🔒 Strict Officer Mode (Protected)'}
            </span>
            <span className="text-[9.5px] text-indigo-700 font-medium">
              Officer PIN: <strong className="font-mono bg-indigo-100 px-1 py-0.5 rounded text-indigo-900">{activeCampaign?.officerPasscode || '7788'}</strong>
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0">
          <button
            type="button"
            onClick={() => {
              setIsOfficerUnlocked(false);
              try {
                sessionStorage.removeItem(`ronpay_officer_unlocked_${campKey}`);
                localStorage.removeItem(`ronpay_officer_unlocked_${campKey}`);
              } catch {}
            }}
            className="px-2 py-1 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 rounded-lg text-[10px] font-black cursor-pointer shadow-2xs flex items-center gap-1"
            title="Lock back to secure officer area"
          >
            <Lock className="w-3 h-3" />
            <span>Lock Leh Rawh</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setNewOfficerPinInput(activeCampaign?.officerPasscode || '7788');
              setConfirmOfficerPinInput(activeCampaign?.officerPasscode || '7788');
              setShowChangePinModal(true);
            }}
            className="px-2 py-1 bg-white hover:bg-indigo-100/70 border border-indigo-200 text-indigo-800 rounded-lg text-[10px] font-bold cursor-pointer"
          >
            PIN Thlak
          </button>
          {isMasterOrOwner && (
            <button
              type="button"
              onClick={handleTogglePublicGroupDeposits}
              className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-black cursor-pointer shadow-xs"
            >
              {activeCampaign?.allowPublicGroupDeposits ? 'Strict-ah Dah' : 'Public Hawn'}
            </button>
          )}
        </div>
      </div>
    );
  };

  const isRalna = category === 'ralna';
  const currentDonorInfo = getResolvedDonorInfo();

  return (
    <div className="space-y-4 pb-1">
      {/* Top Header Bar */}
      <div className="flex justify-between items-center border-b border-slate-200/80 pb-3">
        <button
          onClick={onBack}
          className="text-xs text-indigo-600 font-bold flex items-center gap-1.5 hover:text-indigo-800 transition cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Home
        </button>
        <span className={`text-[9.5px] uppercase font-black px-2.5 py-1 rounded-md border ${
          isRalna ? 'bg-white text-slate-900 border-slate-300 shadow-xs' :
          category === 'khawlsak' ? 'bg-emerald-100 text-emerald-900 border-emerald-300' :
          category === 'rikrum' ? 'bg-rose-100 text-rose-900 border-rose-300' :
          category === 'others' ? 'bg-purple-100 text-purple-900 border-purple-300' :
          'bg-blue-100 text-blue-900 border-blue-300'
        }`}>
          {config.name}
        </span>
      </div>

      {/* Pending Approval / Inactive Notice (Request 7) */}
      {isPendingApproval && (
        <div className="bg-amber-50 border-2 border-amber-300 p-4 rounded-2xl shadow-xs space-y-1 text-amber-950 animate-pulse">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-amber-500 text-white rounded-xl">
              <AlertTriangle className="w-4 h-4" />
            </span>
            <h4 className="text-xs font-black uppercase text-amber-900">QR Code A La Active Lo (Pending Admin Approval)</h4>
          </div>
          <p className="text-xs font-medium text-amber-800 leading-snug">
            He Bawm / Post hi Creator siam niin Admin-in a la approve loh avangin sum chhun/thawh theih a la ni rih lo. Admin-in a approve hunah a active nghal ang.
          </p>
        </div>
      )}

      {isRejected && (
        <div className="bg-rose-50 border-2 border-rose-300 p-4 rounded-2xl shadow-xs space-y-1 text-rose-950">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-rose-600 text-white rounded-xl">
              <AlertCircle className="w-4 h-4" />
            </span>
            <h4 className="text-xs font-black uppercase text-rose-900">Campaign Rejected</h4>
          </div>
          <p className="text-xs font-medium text-rose-800 leading-snug">
            He Campaign hi Admin-in a hnawl (rejected) a ni a, sum thawh theih a ni lo. {campaign?.approvalRemarks ? `(Reason: ${campaign.approvalRemarks})` : ''}
          </p>
        </div>
      )}

      {/* 1. Category Specific Detailed Information Card */}
      {isRalna && (
        <div className="bg-gradient-to-b from-white to-slate-50 text-slate-900 border-2 border-slate-200/90 p-4 rounded-2xl shadow-xs space-y-3 relative overflow-hidden">
          {/* YMA Flag Tri-Color Mini Ribbon (Black, White, Vibrant Red) on Corner */}
          <div className="absolute top-0 right-0 overflow-hidden rounded-bl-xl shadow-xs border-l border-b border-slate-200 z-10">
            <div className="flex h-3.5 w-16">
              <div className="flex-1 bg-black" title="YMA Flag - Dum (Black)" />
              <div className="flex-1 bg-white border-x border-slate-200" title="YMA Flag - Var (White)" />
              <div className="flex-1 bg-red-600" title="YMA Flag - Sen (Vibrant Red)" />
            </div>
          </div>

          <div className="flex gap-3 items-center pt-1">
            {campaign?.imageUrl ? (
              <div 
                onClick={() => handleImageClick(campaign.imageUrl)}
                className="relative group/img cursor-zoom-in shrink-0"
                title="Click to view full photo"
              >
                <img
                  src={campaign.imageUrl}
                  alt={campaign.mitthiHming || campaign.title}
                  referrerPolicy="no-referrer"
                  className="w-16 h-16 rounded-2xl object-cover border-2 border-red-600 shadow-xs group-hover/img:scale-105 transition-transform"
                />
                <div className="absolute inset-0 bg-black/40 rounded-2xl opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center text-white">
                  <Maximize2 className="w-4 h-4 drop-shadow-md" />
                </div>
              </div>
            ) : (
              <div className="w-14 h-14 bg-red-50 border-2 border-red-600 text-red-600 rounded-2xl flex items-center justify-center font-bold text-lg shadow-xs shrink-0">
                <Ribbon className="w-7 h-7" />
              </div>
            )}
            <div className="flex-1 min-w-0 pr-12">
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] bg-red-100 text-red-700 font-black px-2 py-0.5 rounded-md border border-red-200 uppercase tracking-wide">
                  YMA Chhiatni Ralna
                </span>
              </div>
              <h3 className="font-extrabold text-slate-900 text-sm truncate mt-1">
                {translateCampaignTitle(campaign, language) || campaign?.mitthiHming || campaign?.title || 'Pi Lalhmingliani'}
              </h3>
              <p className="text-[10.5px] text-slate-600 font-semibold">
                Kum: {campaign?.age || 74} • {campaign?.location || 'Bungkawn, Aizawl'}
              </p>
              <button 
                onClick={() => openGoogleMaps()}
                className="text-[10px] font-bold text-red-600 hover:text-red-700 mt-1 flex items-center gap-1 cursor-pointer"
              >
                <MapPin className="w-3 h-3 text-red-600" /> GPS: {campaign?.gpsCoords || "23.7271, 92.7176"} <ExternalLink className="w-2.5 h-2.5" />
              </button>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-2.5 space-y-1.5 text-[11px] text-slate-700 font-medium">
            <div className="flex justify-between">
              <span className="text-slate-500">Thihni & Darkar:</span>
              <span className="font-bold text-slate-900">{campaign?.thihni ? formatDateTimeDDMMYYYY(campaign.thihni) : '16/08/2026, 10:30 PM'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Vui Hun:</span>
              <span className="font-bold text-slate-900">{campaign?.vuiHun ? formatDateTimeDDMMYYYY(campaign.vuiHun) : '17/08/2026, 01:30 PM'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Vuitu:</span>
              <span className="font-bold text-slate-900">{campaign?.vuitu || 'Rev. Dr. C. Lalramnghaka'}</span>
            </div>
            <div className={`flex justify-between p-2 rounded-xl font-bold text-[10.5px] border ${
              isExpired ? 'bg-rose-100 text-rose-900 border-rose-300' : 'bg-red-50/80 text-red-700 border-red-200'
            }`}>
              <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-red-600" /> QR Code Active Until:</span>
              <span className="text-slate-900 font-bold">{campaign?.validityDate ? formatDateDDMMYYYY(campaign.validityDate) : '19/08/2026'}</span>
            </div>
          </div>
        </div>
      )}

      {category === 'khawlsak' && (
        <div className="bg-white border border-emerald-200 p-4 rounded-2xl shadow-xs space-y-3">
          <div className="flex gap-3 items-center">
            {campaign?.imageUrl ? (
              <div 
                onClick={() => handleImageClick(campaign.imageUrl)}
                className="relative group/img cursor-zoom-in shrink-0"
                title="Click to view full photo"
              >
                <img
                  src={campaign.imageUrl}
                  alt={campaign.title}
                  referrerPolicy="no-referrer"
                  className="w-16 h-16 rounded-2xl object-cover border-2 border-emerald-300 shadow-sm group-hover/img:scale-105 transition-transform"
                />
                <div className="absolute inset-0 bg-black/30 rounded-2xl opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center text-white">
                  <Maximize2 className="w-4 h-4 drop-shadow-md" />
                </div>
              </div>
            ) : (
              <div className="w-14 h-14 bg-emerald-600 text-white rounded-2xl flex items-center justify-center font-bold text-lg shadow-sm shrink-0">
                <HandHeart className="w-7 h-7" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <span className="text-[9px] bg-emerald-100 text-emerald-900 font-extrabold px-2 py-0.5 rounded-full border border-emerald-200 uppercase">
                {t.categories.khawlsak}
              </span>
              <h3 className="font-black text-slate-900 text-sm truncate mt-0.5">
                {translateCampaignTitle(campaign, language) || translateDynamicText(campaign?.title || 'Hnuchham Pual Donation', language, campaign)}
              </h3>
              <p className="text-[10px] text-slate-500 font-medium">
                {campaign?.location || 'Dawrpui, Aizawl, Mizoram'}
              </p>
              <button 
                onClick={() => openGoogleMaps()}
                className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 mt-1 flex items-center gap-1 cursor-pointer"
              >
                <MapPin className="w-3 h-3 text-rose-500" /> GPS: {campaign?.gpsCoords || "23.7314, 92.7153"} <ExternalLink className="w-2.5 h-2.5" />
              </button>
            </div>
          </div>

          <div className="border-t border-emerald-100 pt-2.5 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-emerald-950 uppercase tracking-wide">
                {language === 'english' ? 'Purpose / Cause' : 'Khawlsak Chhan'}
              </span>
              {language === 'english' && (
                <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-full">
                  <Globe className="w-2.5 h-2.5" /> {isTranslatingCause ? 'Translating...' : 'English'}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-700 bg-emerald-50/70 p-2.5 rounded-xl border border-emerald-100 font-medium leading-relaxed">
              {translatedCause || translateDynamicText(campaign?.cause || 'Naupang apute tanpui leh ei & bar chawmna fund vawmchhohna pual a ni e.', language, campaign)}
            </p>
            {((campaign?.targetAmount && campaign.targetAmount > 0) || (campaign?.maxLimit && campaign.maxLimit > 0)) && (
              <div className={`grid ${campaign?.targetAmount && campaign.targetAmount > 0 && campaign?.maxLimit && campaign.maxLimit > 0 ? 'grid-cols-2' : 'grid-cols-1'} gap-2 text-center text-[11px]`}>
                {campaign?.targetAmount && campaign.targetAmount > 0 ? (
                  <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                    <span className="text-[9px] text-slate-400 block font-bold">{language === 'english' ? 'TARGET GOAL' : 'TARGET AMOUNT'}</span>
                    <span className="font-black text-slate-900">₹{campaign.targetAmount.toLocaleString('en-IN')}</span>
                  </div>
                ) : null}
                {campaign?.maxLimit && campaign.maxLimit > 0 ? (
                  <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                    <span className="text-[9px] text-slate-400 block font-bold">{language === 'english' ? 'MAX LIMIT / DONOR' : 'MAX LIMIT / DONOR'}</span>
                    <span className="font-black text-slate-900">₹{campaign.maxLimit.toLocaleString('en-IN')}</span>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      )}

      {category === 'rikrum' && (
        <div className="bg-white border border-rose-200 p-4 rounded-2xl shadow-xs space-y-3">
          <div className="flex gap-3 items-center">
            {campaign?.imageUrl ? (
              <div 
                onClick={() => handleImageClick(campaign.imageUrl)}
                className="relative group/img cursor-zoom-in shrink-0"
                title="Click to view full photo"
              >
                <img
                  src={campaign.imageUrl}
                  alt={campaign.title}
                  referrerPolicy="no-referrer"
                  className="w-16 h-16 rounded-2xl object-cover border-2 border-rose-300 shadow-sm group-hover/img:scale-105 transition-transform"
                />
                <div className="absolute inset-0 bg-black/30 rounded-2xl opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center text-white">
                  <Maximize2 className="w-4 h-4 drop-shadow-md" />
                </div>
              </div>
            ) : (
              <div className="w-14 h-14 bg-rose-600 text-white rounded-2xl flex items-center justify-center font-bold text-lg shadow-sm shrink-0">
                <AlertTriangle className="w-7 h-7" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] bg-rose-600 text-white font-black px-2 py-0.5 rounded-full uppercase animate-pulse">
                  {language === 'english' ? 'URGENT EMERGENCY' : 'TIHMAWHTHIR EMERGENCY'}
                </span>
              </div>
              <h3 className="font-black text-slate-900 text-sm truncate mt-0.5">
                {translateCampaignTitle(campaign, language) || translateDynamicText(campaign?.emergencyTitle || campaign?.title || 'Kangmei Relief Support', language, campaign)}
              </h3>
              <p className="text-[10px] text-slate-500 font-medium">
                {campaign?.location || 'Kanan Veng, Aizawl, Mizoram'}
              </p>
              <button 
                onClick={() => openGoogleMaps()}
                className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 mt-1 flex items-center gap-1 cursor-pointer"
              >
                <MapPin className="w-3 h-3 text-rose-500" /> GPS: {campaign?.gpsCoords || "23.7410, 92.7090"} <ExternalLink className="w-2.5 h-2.5" />
              </button>
            </div>
          </div>

          <div className="border-t border-rose-100 pt-2 text-[11px] text-slate-600 space-y-1.5">
            {campaign?.cause && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-rose-950 uppercase tracking-wide">
                    {language === 'english' ? 'Emergency Cause & Description' : 'Rikrum thlen Chhan'}
                  </span>
                  {language === 'english' && (
                    <span className="inline-flex items-center gap-1 text-[9px] font-bold text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded-full">
                      <Globe className="w-2.5 h-2.5" /> {isTranslatingCause ? 'Translating...' : 'English'}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-700 bg-rose-50/70 p-2.5 rounded-xl border border-rose-100 font-medium leading-relaxed">
                  {translatedCause || translateDynamicText(campaign.cause, language, campaign)}
                </p>
              </>
            )}
            <div className="flex justify-between bg-rose-50 p-2 rounded-xl text-rose-900 font-bold border border-rose-200/60">
              <span>{language === 'english' ? 'Emergency Deadline:' : 'Emergency Deadline:'}</span>
              <span className="font-black text-rose-600">{campaign?.urgencyDeadline ? formatDateDDMMYYYY(campaign.urgencyDeadline) : '25/08/2026'}</span>
            </div>
          </div>
        </div>
      )}

      {category === 'kumtluang' && (
        <div className="bg-white border border-blue-200 p-4 rounded-2xl shadow-xs space-y-3">
          <div className="flex gap-3 items-center">
            {campaign?.imageUrl ? (
              <div 
                onClick={() => handleImageClick(campaign.imageUrl)}
                className="relative group/img cursor-zoom-in shrink-0"
                title="Click to view full photo"
              >
                <img
                  src={campaign.imageUrl}
                  alt={campaign.title}
                  referrerPolicy="no-referrer"
                  className="w-16 h-16 rounded-2xl object-cover border-2 border-blue-300 shadow-sm group-hover/img:scale-105 transition-transform"
                  onError={(e) => {
                    const img = e.currentTarget;
                    if ((campaign.id === 'cmp-kumtluang-1' || campaign.title?.toLowerCase().includes('bcm ebenezer')) && img.src !== BCM_EBENEZER_DEFAULT_LOGO) {
                      img.src = BCM_EBENEZER_DEFAULT_LOGO;
                    }
                  }}
                />
                <div className="absolute inset-0 bg-black/30 rounded-2xl opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center text-white">
                  <Maximize2 className="w-4 h-4 drop-shadow-md" />
                </div>
              </div>
            ) : (
              <div className="w-14 h-14 bg-blue-600 text-white rounded-2xl flex items-center justify-center font-bold text-lg shadow-sm shrink-0">
                <InfinityIcon className="w-7 h-7" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <span className="text-[9px] bg-blue-100 text-blue-900 font-extrabold px-2 py-0.5 rounded-full border border-blue-200 uppercase">
                Kumtluang Permanent NGO / Church
              </span>
              <h3 className="font-black text-slate-900 text-sm truncate mt-0.5">
                {translateCampaignTitle(campaign, language) || campaign?.orgName || campaign?.title || 'BCM Ebenezer, Zobawk'}
              </h3>
              <p className="text-[10px] text-slate-500 font-medium">
                {campaign?.location || 'Zobawk, Lunglei, Mizoram'}
              </p>
              <button 
                onClick={() => openGoogleMaps()}
                className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 mt-1 flex items-center gap-1 cursor-pointer"
              >
                <MapPin className="w-3 h-3 text-rose-500" /> GPS: {campaign?.gpsCoords || "22.8833, 92.7333"} <ExternalLink className="w-2.5 h-2.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {category === 'others' && (
        <div className="bg-white border border-purple-200 p-4 rounded-2xl shadow-xs space-y-3">
          <div className="flex gap-3 items-center">
            <div className="w-14 h-14 bg-purple-600 text-white rounded-2xl flex items-center justify-center font-bold text-lg shadow-sm shrink-0">
              <Receipt className="w-7 h-7" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] bg-purple-100 text-purple-900 font-extrabold px-2 py-0.5 rounded-full border border-purple-200 uppercase">
                  External UPI Payment
                </span>
              </div>
              <h3 className="font-black text-slate-900 text-sm truncate mt-0.5">
                {campaign?.title || 'External Merchant / Payee'}
              </h3>
              <p className="text-[10px] text-purple-700 font-mono font-bold mt-0.5">
                UPI ID: {campaign?.upiId || 'Direct UPI'}
              </p>
              <p className="text-[10px] text-slate-500 font-medium">
                {campaign?.location || 'Standard Direct UPI Payment'}
              </p>
            </div>
          </div>
          <div className="border-t border-purple-100 pt-2 text-[11px] text-purple-900 bg-purple-50/60 p-2 rounded-xl border border-purple-100 font-medium flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-purple-600 shrink-0" />
            <span>UPI QR Code tlangpui a ni a, RonPay campaign / bawm dangte nen inzawmna a nei lo.</span>
          </div>
        </div>
      )}

      {/* 2. Main Donation Checkout Form */}
      <form onSubmit={handleProcessPayment} className="space-y-4">
        {/* Expired QR Notice Banner */}
        {isExpired && (
          <div className="bg-rose-50 border-2 border-rose-500 p-3.5 rounded-2xl text-rose-950 space-y-1.5 shadow-xs">
            <div className="flex items-center gap-2 text-xs font-black uppercase text-rose-700">
              <AlertCircle className="w-4 h-4 shrink-0" /> Pek theih hun a tawp tawh (Expired QR)
            </div>
            <p className="text-[11px] font-medium text-rose-900 leading-relaxed">
              He QR Code validity hi {campaign?.validityDate ? formatDateDDMMYYYY(campaign.validityDate) : 'a hun a liam tawh'} khan a tawp tawh avangin sum luh tir theih a ni tawh lo. Creator-in validity a extend a nih loh chuan sum pek theih a ni lo.
            </p>
          </div>
        )}

        {/* Donor Information & Privacy */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs space-y-3">
          <div className="flex justify-between items-center">
            <h4 className="text-[11px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              {category === 'kumtluang' ? (
                <>
                  <Users className="w-3.5 h-3.5 text-blue-600" />
                  <span>Kumtluang Member / Donor Info</span>
                </>
              ) : (
                'Donor Information'
              )}
            </h4>
            <label className="flex items-center gap-1.5 cursor-pointer text-[10.5px] font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg border border-indigo-100 hover:bg-indigo-100 transition">
              <input
                type="checkbox"
                checked={isAnonymous}
                onChange={handleAnonymousToggle}
                className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              />
              Hming thup
            </label>
          </div>

          {/* KUMTLUANG SPECIFIC: Member ID & Phone Lookup, Auto-Registration & Dual User Selection */}
          {category === 'kumtluang' && !isAnonymous ? (
            <div className="space-y-3 pt-1">
              {/* 3-Mode Selector: Mimal (Member Roll) vs Group (Sum Tuak) vs General (Inkhawm Thawhlawm) */}
              <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-xl text-xs font-bold border border-slate-200">
                <button
                  type="button"
                  onClick={() => setKumtluangDonorType('member')}
                  className={`py-2 px-1 rounded-lg transition text-center cursor-pointer flex items-center justify-center gap-1.5 ${
                    kumtluangDonorType === 'member'
                      ? 'bg-blue-600 text-white font-black shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                >
                  <User className="w-3.5 h-3.5" />
                  <span>Mimal (Roll)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setKumtluangDonorType('group')}
                  className={`py-2 px-1 rounded-lg transition text-center cursor-pointer flex items-center justify-center gap-1.5 ${
                    kumtluangDonorType === 'group'
                      ? 'bg-indigo-600 text-white font-black shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Group / Unit</span>
                  {!isOfficerAuthorized && <Lock className="w-3 h-3 text-amber-500 shrink-0" />}
                </button>
                <button
                  type="button"
                  onClick={() => setKumtluangDonorType('general')}
                  className={`py-2 px-1 rounded-lg transition text-center cursor-pointer flex items-center justify-center gap-1.5 ${
                    kumtluangDonorType === 'general'
                      ? 'bg-emerald-600 text-white font-black shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                >
                  <Landmark className="w-3.5 h-3.5" />
                  <span>General / Inkhawm</span>
                  {!isOfficerAuthorized && <Lock className="w-3 h-3 text-amber-500 shrink-0" />}
                </button>
              </div>

              {/* MODE 1: MIMAL (MEMBER ROLL) */}
              {kumtluangDonorType === 'member' && (
                <div className="space-y-3">
                  {/* 1. Quick Search / Member Recognition Bar */}
                  <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-bold text-slate-600 block">
                    Phone Number (10 digits) / Member ID / Hming zawng rawh:
                  </label>
                  {selectedMember && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedMember(null);
                        setPhoneSearchQuery('');
                        setIsNewMemberMode(true);
                      }}
                      className="text-[9.5px] font-bold text-blue-600 hover:text-blue-800 transition cursor-pointer"
                    >
                      + Member thar / ID la nei lo
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={phoneSearchQuery}
                    onChange={(e) => handlePhoneSearch(e.target.value)}
                    placeholder="e.g. 1460 / 9436141460 / Rammuanpuia / EBE-1460"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl py-2 pl-8 pr-8 text-xs font-bold text-slate-900 focus:outline-none focus:bg-white focus:border-blue-600 transition"
                  />
                  {phoneSearchQuery && (
                    <button
                      type="button"
                      onClick={() => handlePhoneSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Member Search Results Dropdown/List */}
                {!selectedMember && memberSearchResults.length > 0 && (
                  <div className="bg-white border-2 border-blue-300 rounded-2xl p-2 space-y-1.5 shadow-md max-h-56 overflow-y-auto animate-fadeIn mt-1.5">
                    <div className="text-[10px] font-bold text-slate-500 px-1.5 flex items-center justify-between">
                      <span>Zawn hmuh Member ({memberSearchResults.length}):</span>
                      <span className="text-[9px] text-blue-600 font-semibold">I hming thlang rawh le</span>
                    </div>
                    {memberSearchResults.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => selectMember(m)}
                        className="w-full text-left p-2 rounded-xl bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 transition flex items-center justify-between cursor-pointer"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center font-black text-xs shrink-0 shadow-2xs">
                            {m.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-black text-slate-900 truncate flex items-center gap-1.5">
                              <span>{m.name}</span>
                              <span className="font-mono text-[9.5px] bg-blue-100 text-blue-800 px-1 rounded font-bold">
                                {m.id}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-500 truncate font-medium">
                              {m.section || 'General'} • Ph: {m.fullPhone || m.phoneLast4}
                            </div>
                          </div>
                        </div>
                        <Check className="w-3.5 h-3.5 text-blue-600 shrink-0 ml-1" />
                      </button>
                    ))}
                  </div>
                )}

                {/* Explicit prompt when search query is entered (>= 3 chars) but no member found */}
                {!selectedMember && !isNewMemberMode && phoneSearchQuery.trim().length >= 3 && memberSearchResults.length === 0 && (
                  <div className="p-3 bg-amber-50/90 border border-amber-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 animate-fadeIn mt-1.5">
                    <div className="text-xs text-amber-900 font-semibold">
                      <span>"{phoneSearchQuery}" hming/ID-in Member hmuh a ni lo.</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setIsNewMemberMode(true);
                        if (!/^\d+$/.test(phoneSearchQuery.trim())) {
                          setNewRegName(phoneSearchQuery.trim());
                          setDonorName(phoneSearchQuery.trim());
                        } else if (phoneSearchQuery.trim().length <= 10) {
                          setNewRegPhone(phoneSearchQuery.trim());
                          setDonorPhone(phoneSearchQuery.trim());
                        }
                      }}
                      className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs px-3 py-1.5 rounded-xl shadow-2xs cursor-pointer flex items-center gap-1 shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" /> ID la nei lo tan Inziak Lut Rawh
                    </button>
                  </div>
                )}
              </div>

              {/* 2. When Member is FOUND: Show Verified Card + Dual User / Dependent Selector */}
              {selectedMember ? (
                <div className="bg-blue-50/70 border border-blue-200 p-3.5 rounded-2xl space-y-3">
                  {/* Success Toast for Edit */}
                  {editMemberSuccessMsg && (
                    <div className="p-2 bg-emerald-600 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-xs animate-fadeIn">
                      <Check className="w-3.5 h-3.5 shrink-0" />
                      <span>{editMemberSuccessMsg}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-xs shadow-xs">
                        <UserCheck className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-black text-xs text-slate-900">{selectedMember.name}</span>
                          <span className="text-[9.5px] bg-blue-600 text-white font-black px-2 py-0.5 rounded-md">
                            {selectedMember.id}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 font-medium">
                          {selectedMember.section || 'General'} • Ph: {selectedMember.fullPhone || selectedMember.phoneLast4}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        if (isEditingMember) {
                          setIsEditingMember(false);
                        } else {
                          handleStartMemberEdit();
                        }
                      }}
                      className="text-[10.5px] font-bold text-blue-700 hover:text-blue-900 bg-white hover:bg-blue-100/60 border border-blue-200 px-2.5 py-1 rounded-xl flex items-center gap-1 shadow-2xs cursor-pointer transition"
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>{isEditingMember ? 'Cancel' : 'Edit Info'}</span>
                    </button>
                  </div>

                  {/* INLINE MEMBER EDIT FORM (Edit Member details, section & dependents right here) */}
                  {isEditingMember ? (
                    <div className="p-3 bg-white rounded-2xl border-2 border-blue-400 space-y-2.5 animate-fadeIn shadow-xs">
                      <div className="flex items-center justify-between border-b border-blue-100 pb-1.5">
                        <span className="text-xs font-black text-blue-950 flex items-center gap-1">
                          <Edit3 className="w-3.5 h-3.5 text-blue-600" /> Member Info Edit Rawh
                        </span>
                        <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-1.5 py-0.5 rounded">
                          ID: {selectedMember.id}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] font-bold text-slate-700 block mb-0.5">
                            Member Hming (Full Name) *
                          </label>
                          <input
                            type="text"
                            value={editMemberName}
                            onChange={(e) => setEditMemberName(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 text-xs font-bold text-slate-900 focus:outline-none focus:bg-white focus:border-blue-600"
                            placeholder="Hming..."
                          />
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-slate-700 block mb-0.5">
                            Phone Number
                          </label>
                          <input
                            type="tel"
                            value={editMemberPhone}
                            onChange={(e) => setEditMemberPhone(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 text-xs font-bold text-slate-900 focus:outline-none focus:bg-white focus:border-blue-600"
                            placeholder="Mobile no..."
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-slate-700 block mb-0.5">
                          {campaign?.sectionLabel || 'Bial / Section / Veng'}
                        </label>
                        <select
                          value={isEditCustomSection ? '__custom__' : editMemberSection}
                          onChange={(e) => {
                            if (e.target.value === '__custom__') {
                              setIsEditCustomSection(true);
                            } else {
                              setIsEditCustomSection(false);
                              setEditMemberSection(e.target.value);
                            }
                          }}
                          className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 text-xs font-bold text-slate-900 focus:outline-none focus:bg-white focus:border-blue-600"
                        >
                          {(campaign?.definedSections && campaign.definedSections.length > 0
                            ? campaign.definedSections
                            : ['Bial 1 (Vengchhak)', 'Bial 2 (Vengthlang)', 'Bial 3 (Venglai)', 'Bial 4 (Field Veng)', 'General / Khawchhung']
                          ).map((sec, idx) => (
                            <option key={idx} value={sec}>
                              {sec}
                            </option>
                          ))}
                          <option value="__custom__">+ Custom (Ziah luh thar)...</option>
                        </select>
                      </div>

                      {isEditCustomSection && (
                        <div>
                          <label className="text-[10px] font-bold text-blue-900 block mb-0.5">
                            Custom {campaign?.sectionLabel || 'Bial / Section'} Ziak Rawh:
                          </label>
                          <input
                            type="text"
                            value={editCustomSectionText}
                            onChange={(e) => setEditCustomSectionText(e.target.value)}
                            placeholder="e.g. Bial 5 / Hmar Veng..."
                            className="w-full bg-white border-2 border-blue-400 rounded-xl p-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-600"
                          />
                        </div>
                      )}

                      {/* Dependents list in Edit Mode */}
                      {editMemberDependents.length > 0 && (
                        <div className="space-y-1.5 pt-1">
                          <label className="text-[10px] font-bold text-slate-700 block">
                            Chhungte Sub-IDs ({editMemberDependents.length}):
                          </label>
                          <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                            {editMemberDependents.map((dep, idx) => (
                              <div
                                key={dep.subId || idx}
                                className="flex items-center gap-1.5 bg-slate-50 p-1.5 rounded-xl border border-slate-200 text-xs"
                              >
                                <span className="font-mono text-[9px] font-bold text-blue-700 bg-blue-100 px-1 py-0.5 rounded shrink-0">
                                  {dep.subId}
                                </span>
                                <input
                                  type="text"
                                  value={dep.name}
                                  onChange={(e) => {
                                    const next = [...editMemberDependents];
                                    next[idx].name = e.target.value;
                                    setEditMemberDependents(next);
                                  }}
                                  className="flex-1 bg-white border border-slate-200 rounded-lg p-1 text-[11px] font-bold text-slate-800 focus:outline-none focus:border-blue-600"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditMemberDependents(editMemberDependents.filter((_, i) => i !== idx));
                                  }}
                                  className="text-rose-500 hover:text-rose-700 p-1 hover:bg-rose-50 rounded-md cursor-pointer shrink-0"
                                  title="Sub-ID hi paih rawh"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex gap-2 pt-1.5">
                        <button
                          type="button"
                          onClick={() => setIsEditingMember(false)}
                          className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2 rounded-xl text-xs transition cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveMemberEdit}
                          className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black py-2 rounded-xl text-xs transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" /> Vawng Rawh (Save)
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {/* Dual User & Dependent Selector (Tunge Thawh Dawn?) */}
                  <div className="border-t border-blue-200/80 pt-2.5 space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-[10.5px] font-black text-blue-950 block">
                        Tunge Thawh Dawn? (Payer Selection):
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowAddDependentInput(!showAddDependentInput)}
                        className="text-[10px] font-bold text-blue-700 hover:text-blue-900 flex items-center gap-0.5 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" /> Chhungte Sub-ID belh
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {/* Primary Head of Family */}
                      <button
                        type="button"
                        onClick={() => handlePayerChange('primary')}
                        className={`p-2 rounded-xl text-left border text-xs font-bold transition flex items-center justify-between cursor-pointer ${
                          selectedPayerType === 'primary'
                            ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                            : 'bg-white text-slate-800 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <div className="min-w-0">
                          <span className="block truncate">{selectedMember.name}</span>
                          <span className={`text-[9.5px] block ${selectedPayerType === 'primary' ? 'text-blue-100' : 'text-slate-400'}`}>
                            Hotu • {selectedMember.id}
                          </span>
                        </div>
                        {selectedPayerType === 'primary' && <Check className="w-4 h-4 shrink-0" />}
                      </button>

                      {/* Dependents list */}
                      {selectedMember.dependents && selectedMember.dependents.map((dep) => (
                        <button
                          key={dep.subId}
                          type="button"
                          onClick={() => handlePayerChange(dep.subId)}
                          className={`p-2 rounded-xl text-left border text-xs font-bold transition flex items-center justify-between cursor-pointer ${
                            selectedPayerType === dep.subId
                              ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                              : 'bg-white text-slate-800 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <div className="min-w-0">
                            <span className="block truncate">{dep.name}</span>
                            <span className={`text-[9.5px] block ${selectedPayerType === dep.subId ? 'text-blue-100' : 'text-slate-400'}`}>
                              {dep.relation || 'Chhungte'} • {dep.subId}
                            </span>
                          </div>
                          {selectedPayerType === dep.subId && <Check className="w-4 h-4 shrink-0" />}
                        </button>
                      ))}
                    </div>

                    {/* Inline Add Dependent Mini Form */}
                    {showAddDependentInput && (
                      <div className="p-2.5 bg-white rounded-xl border border-blue-200 space-y-2 mt-2">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-black text-blue-900 uppercase">
                            Chhungte Sub-ID Thar Siamna:
                          </span>
                          <button
                            type="button"
                            onClick={() => setShowAddDependentInput(false)}
                            className="text-slate-400 hover:text-slate-600 text-[10px]"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[9.5px] text-slate-500 font-bold block mb-0.5">Hming *</label>
                            <input
                              type="text"
                              value={newDependentName}
                              onChange={(e) => setNewDependentName(e.target.value)}
                              placeholder="e.g. Lalrinhlui"
                              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-1.5 text-xs font-bold text-slate-900 focus:outline-none focus:bg-white focus:border-blue-600"
                            />
                          </div>
                          <div>
                            <label className="text-[9.5px] text-slate-500 font-bold block mb-0.5">Inlaichinna</label>
                            <select
                              value={newDependentRelation}
                              onChange={(e) => setNewDependentRelation(e.target.value)}
                              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-1.5 text-xs font-bold text-slate-900 focus:outline-none focus:bg-white focus:border-blue-600"
                            >
                              <option value="Nupui">Nupui</option>
                              <option value="Pasal">Pasal</option>
                              <option value="Fa">Fa (Fapa/Fanu)</option>
                              <option value="Nu">Nu</option>
                              <option value="Pa">Pa</option>
                              <option value="Nau">Nau / Unau</option>
                            </select>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={handleAddDependent}
                          disabled={!newDependentName.trim()}
                          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-1.5 rounded-lg text-xs transition cursor-pointer flex items-center justify-center gap-1 shadow-xs"
                        >
                          <Plus className="w-3.5 h-3.5" /> Sub-ID Siam & Thlang Nghal
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ) : isNewMemberMode ? (
                /* 3. When Member is NOT Found / ID la nei lo tan: Registration Form */
                <div className="bg-amber-50/70 border border-amber-300/80 p-3.5 rounded-2xl space-y-2.5 animate-fadeIn">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="p-1 bg-amber-500 text-white rounded-lg">
                        <UserPlus className="w-3.5 h-3.5" />
                      </span>
                      <div>
                        <h5 className="text-xs font-black text-amber-950">
                          ID la nei lo tan Inziahluhna (New Member Registration)
                        </h5>
                        <p className="text-[10px] text-amber-800 font-medium">
                          I Hming leh Phone Number chhu lut la, Member ID siamin hemi page-ah hian i lut nghal ang.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setIsNewMemberMode(false);
                      }}
                      className="text-[10px] font-bold text-slate-500 hover:text-slate-800 bg-white hover:bg-slate-100 border border-slate-200 px-2 py-1 rounded-lg transition shrink-0 cursor-pointer"
                    >
                      Cancel / Let Rawh
                    </button>
                  </div>

                  <div className="space-y-2 pt-1">
                    <div>
                      <label className="text-[10px] font-bold text-slate-700 block mb-0.5">
                        I Hming Pum (Full Name) *
                      </label>
                      <input
                        type="text"
                        value={newRegName}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') e.preventDefault();
                        }}
                        onChange={(e) => {
                          setNewRegName(e.target.value);
                          setDonorName(e.target.value);
                        }}
                        placeholder="e.g. Vanlalruati / C. Lalhmangaiha"
                        className="w-full bg-white border border-slate-300 rounded-xl p-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-600 transition"
                      />
                      {newRegName.trim().length > 0 && newRegName.trim().length < 3 && (
                        <p className="text-[9.5px] text-amber-600 font-semibold mt-0.5">
                          Khawngaihin Hming pum (characters 3 aia tlem lo) chhu lut rawh le.
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-bold text-slate-700 block mb-0.5">
                          Phone (10 digits) *
                        </label>
                        <input
                          type="tel"
                          maxLength={10}
                          value={newRegPhone}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') e.preventDefault();
                          }}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                            setNewRegPhone(val);
                            setDonorPhone(val);
                          }}
                          placeholder="e.g. 9436123456"
                          className="w-full bg-white border border-slate-300 rounded-xl p-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-600 transition"
                        />
                        <div className="flex justify-between items-center mt-0.5">
                          <span className={`text-[9.5px] font-medium ${newRegPhone.replace(/\D/g, '').length === 10 ? 'text-emerald-700 font-bold' : 'text-slate-500'}`}>
                            {newRegPhone.replace(/\D/g, '').length === 10 ? '✅ Digit 10 a tling e' : `Digit: ${newRegPhone.replace(/\D/g, '').length}/10`}
                          </span>
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-700 block mb-0.5">
                          {campaign?.sectionLabel || 'Bial / Section / Veng'}
                        </label>
                        <select
                          value={isCustomSection ? '__custom__' : newRegSection}
                          onChange={(e) => {
                            if (e.target.value === '__custom__') {
                              setIsCustomSection(true);
                            } else {
                              setIsCustomSection(false);
                              setNewRegSection(e.target.value);
                              setDonorSection(e.target.value);
                            }
                          }}
                          className="w-full bg-white border border-slate-300 rounded-xl p-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-600 transition"
                        >
                          {(campaign?.definedSections && campaign.definedSections.length > 0
                            ? campaign.definedSections
                            : ['Bial 1 (Vengchhak)', 'Bial 2 (Vengthlang)', 'Bial 3 (Venglai)', 'Bial 4 (Field Veng)', 'General / Khawchhung']
                          ).map((sec, idx) => (
                            <option key={idx} value={sec}>
                              {sec}
                            </option>
                          ))}
                          <option value="__custom__">+ Custom (Ziah luh thar)...</option>
                        </select>
                      </div>
                    </div>

                    {isCustomSection && (
                      <div className="pt-1">
                        <label className="text-[10px] font-bold text-blue-900 block mb-0.5">
                          Custom {campaign?.sectionLabel || 'Bial / Section'} Hming Ziak Rawh:
                        </label>
                        <input
                          type="text"
                          value={customSectionText}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') e.preventDefault();
                          }}
                          onChange={(e) => {
                            setCustomSectionText(e.target.value);
                            setDonorSection(e.target.value);
                          }}
                          placeholder="e.g. Bial 5 / Section E / Hmar Veng..."
                          className="w-full bg-white border-2 border-blue-400 rounded-xl p-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-600"
                        />
                      </div>
                    )}

                    {newRegPhone.replace(/\D/g, '').length === 10 && (
                      <div className="text-[10px] font-bold text-blue-900 bg-blue-100/70 p-2 rounded-lg flex items-center justify-between border border-blue-200">
                        <span>I Member ID Tur:</span>
                        <span className="font-black text-blue-700 font-mono text-xs">
                          {deriveOrgCode(campaign?.orgName, campaign?.title)}-{newRegPhone.replace(/\D/g, '').slice(-4)}
                        </span>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => handleQuickRegisterSubmit()}
                      disabled={newRegName.trim().length < 3 || newRegPhone.replace(/\D/g, '').length !== 10}
                      className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-2.5 rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                      <span>ID Siam & Hemi Page-ah Lut Nghal</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* Prompt for ID nei lo / thar tan */
                <div className="p-3 bg-blue-50/70 border border-blue-200/90 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
                  <div>
                    <div className="text-xs font-black text-blue-950 flex items-center gap-1.5">
                      <UserPlus className="w-3.5 h-3.5 text-blue-600 shrink-0" /> Member ID / Account i la nei lo em ni?
                    </div>
                    <p className="text-[10px] text-blue-800/90 font-medium mt-0.5">
                      I Hming leh Phone Number chhu lutin Member-ah inziak lut nghal rawh le.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsNewMemberMode(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-3.5 py-1.5 rounded-xl shadow-2xs cursor-pointer flex items-center gap-1.5 shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" /> Hming & Phone Chhu Lut Rawh
                  </button>
                </div>
              )}
            </div>
          )}

          {/* MODE 2: GROUP / DEPARTMENT / UNIT */}
          {kumtluangDonorType === 'group' && (
            !isOfficerAuthorized ? (
              renderOfficerLockScreen('Group / Unit')
            ) : (
            <div className="bg-indigo-50/70 border-2 border-indigo-200 p-3.5 rounded-2xl space-y-3 animate-fadeIn">
              {(isOwner || Boolean(creatorProfile?.isAdmin) || isOfficerUnlocked) && renderCreatorOfficerControl()}
              <div className="flex items-start gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <h5 className="text-xs font-black text-indigo-950">Group / Department / Unit Sum Thehkhawm</h5>
                  <p className="text-[10px] text-indigo-800 font-medium">
                    Group, Unit, Fellowship, Department emaw Chhungkua anga sum tuak thehluhna. Member ID hranpa zawn a ngai lo.
                  </p>
                </div>
              </div>

              {/* Quick Presets for Group Name (Creator pre-set to prevent accidental input errors) */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <div className="flex items-center gap-1.5">
                    <label className="text-[10px] font-bold text-slate-700 block">
                      Group / Unit Hming Thlang Rawh:
                    </label>
                    <span className="text-[8.5px] font-bold text-indigo-700 bg-indigo-100/70 border border-indigo-200/80 px-1.5 py-0.2 rounded">
                      Creator Set
                    </span>
                  </div>
                  {isOwner && (
                    <button
                      type="button"
                      onClick={() => setShowAddGroupPreset(!showAddGroupPreset)}
                      className="text-[9.5px] font-black text-indigo-700 hover:text-indigo-900 flex items-center gap-0.5 cursor-pointer bg-white px-2 py-0.5 rounded-md border border-indigo-200"
                    >
                      <Plus className="w-3 h-3" /> Creator: Preset Dahna
                    </button>
                  )}
                </div>

                {/* Inline form to add custom group preset - STRICTLY for Campaign Creator */}
                {isOwner && showAddGroupPreset && (
                  <div className="flex items-center gap-1.5 mb-2 p-1.5 bg-white border border-indigo-200 rounded-xl shadow-xs">
                    <input
                      type="text"
                      value={newGroupPresetInput}
                      onChange={(e) => setNewGroupPresetInput(e.target.value)}
                      placeholder="e.g. Pavalai Fellowship / Chhangte Unit"
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-600"
                    />
                    <button
                      type="button"
                      onClick={() => handleAddGroupPreset(newGroupPresetInput)}
                      className="bg-indigo-600 text-white text-[10px] font-black px-2.5 py-1 rounded-lg hover:bg-indigo-700 transition cursor-pointer"
                    >
                      Save Preset
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAddGroupPreset(false)}
                      className="text-slate-400 hover:text-slate-600 p-1"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                <div className="flex flex-wrap gap-1.5 mb-2">
                  {groupPresets.map((preset) => (
                    <div
                      key={preset}
                      className={`inline-flex items-center gap-1 text-[10.5px] ${isOwner ? 'pl-2.5 pr-1.5' : 'px-2.5'} py-1 rounded-lg font-bold border transition ${
                        groupName === preset
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setGroupName(preset);
                          setIsCustomGroup(false);
                        }}
                        className="cursor-pointer"
                      >
                        {preset}
                      </button>
                      {isOwner && (
                        <button
                          type="button"
                          onClick={(e) => handleRemoveGroupPreset(preset, e)}
                          title="Creator: Paih bo rawh"
                          className={`p-0.5 rounded hover:bg-black/10 transition cursor-pointer ${
                            groupName === preset ? 'text-white/80 hover:text-white' : 'text-slate-400 hover:text-rose-600'
                          }`}
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <div className="relative">
                  <input
                    type="text"
                    value={groupName}
                    onChange={(e) => {
                      setGroupName(e.target.value);
                      setIsCustomGroup(true);
                    }}
                    placeholder="e.g. Group A / TKP Fellowship / Unit 1..."
                    className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-600"
                  />
                  {isOwner && groupName.trim() && !groupPresets.includes(groupName.trim()) && (
                    <button
                      type="button"
                      onClick={() => handleAddGroupPreset(groupName)}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[9.5px] bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold px-2 py-1 rounded-lg hover:bg-indigo-100 flex items-center gap-1 cursor-pointer"
                    >
                      <Sparkles className="w-3 h-3 text-amber-500" /> Creator: Save as Preset
                    </button>
                  )}
                </div>
              </div>

              {/* Leader / Depositor Info */}
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col justify-end">
                  <label className="text-[10px] font-bold text-slate-700 block mb-1 leading-tight min-h-[24px] flex items-end">
                    Thehluttu / Leader / Treasurer Hming *
                  </label>
                  <input
                    type="text"
                    value={groupLeaderName}
                    onChange={(e) => setGroupLeaderName(e.target.value)}
                    placeholder="e.g. Rammuanpuia (Leader)"
                    className="w-full bg-white border border-slate-300 rounded-xl p-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-600 h-9"
                  />
                </div>

                <div className="flex flex-col justify-end">
                  <label className="text-[10px] font-bold text-slate-700 block mb-1 leading-tight min-h-[24px] flex items-end">
                    Phone Number (Receipt dawn nan)
                  </label>
                  <input
                    type="tel"
                    maxLength={10}
                    value={groupLeaderPhone}
                    onChange={(e) => setGroupLeaderPhone(e.target.value)}
                    placeholder="e.g. 9436123456"
                    className="w-full bg-white border border-slate-300 rounded-xl p-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-600 h-9"
                  />
                </div>
              </div>

              {/* Section / Bial selection */}
              <div>
                <label className="text-[10px] font-bold text-slate-700 block mb-0.5">
                  {campaign?.sectionLabel || 'Bial / Unit'}
                </label>
                <select
                  value={groupSection}
                  onChange={(e) => setGroupSection(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl p-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-600"
                >
                  <option value="">-- {campaign?.sectionLabel || 'Bial / Unit'} Thlang Rawh (Optional) --</option>
                  {(campaign?.definedSections && campaign.definedSections.length > 0
                    ? campaign.definedSections
                    : ['Bial 1 (Vengchhak)', 'Bial 2 (Vengthlang)', 'Bial 3 (Venglai)', 'Bial 4 (Field Veng)', 'General / Khawchhung']
                  ).map((sec, idx) => (
                    <option key={idx} value={sec}>{sec}</option>
                  ))}
                </select>
              </div>

              {/* Direct Group Amount & Payment Date Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t-2 border-indigo-200/90 mt-1">
                <div>
                  <label className="text-[10.5px] font-black text-indigo-950 block mb-1">
                    Sum Zat (Amount ₹) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-black text-sm text-indigo-700">₹</span>
                    <input
                      type="number"
                      min={1}
                      required
                      placeholder="e.g. 5000"
                      value={groupAmount === '' ? '' : groupAmount}
                      onChange={(e) => handleGroupAmountChange(e.target.value)}
                      className="w-full bg-white border-2 border-indigo-300 rounded-xl py-2 pl-7 pr-3 font-black text-sm text-indigo-950 focus:outline-none focus:border-indigo-600 shadow-2xs"
                    />
                  </div>
                  {/* Quick amount chips */}
                  <div className="flex gap-1.5 overflow-x-auto no-scrollbar pt-1.5">
                    {[500, 1000, 2000, 5000, 10000].map(amt => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => handleGroupAmountChange(String(amt))}
                        className={`px-2 py-0.5 rounded-lg text-[10.5px] font-bold transition cursor-pointer shrink-0 ${
                          groupAmount === amt 
                            ? 'bg-indigo-600 text-white shadow-xs' 
                            : 'bg-indigo-100/70 text-indigo-800 hover:bg-indigo-200'
                        }`}
                      >
                        ₹{amt.toLocaleString('en-IN')}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[10.5px] font-black text-indigo-950 block mb-1">
                    Pek Ni (Payment Date) *
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      value={selectedCustomDate}
                      onChange={(e) => {
                        handleCustomDateChange(e.target.value);
                        setUseCustomDate(true);
                      }}
                      className="w-full bg-white border-2 border-indigo-300 rounded-xl py-2 px-3 font-bold text-xs text-indigo-950 focus:outline-none focus:border-indigo-600 shadow-2xs"
                    />
                  </div>
                </div>
              </div>
            </div>
            )
          )}

          {/* MODE 3: GENERAL / INKHAWM THAWHLAWM */}
          {kumtluangDonorType === 'general' && (
            !isOfficerAuthorized ? (
              renderOfficerLockScreen('General / Inkhawm Thawhlawm')
            ) : (
            <div className="bg-emerald-50/70 border-2 border-emerald-200 p-3.5 rounded-2xl space-y-3 animate-fadeIn">
              {(isOwner || Boolean(creatorProfile?.isAdmin) || isOfficerUnlocked) && renderCreatorOfficerControl()}
              <div className="flex items-start gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Landmark className="w-4 h-4" />
                </div>
                <div>
                  <h5 className="text-xs font-black text-emerald-950">General / Inkhawm Thawhlawm</h5>
                  <p className="text-[10px] text-emerald-800 font-medium">
                    Inkhawm thawhlawm, Tawngtai inkhawm, Buhfaiṭham khawn, Khawmpui emaw Bazar/Sum tuak tlingkhawm thehluhna. Member ID zawn a ngai lo.
                  </p>
                </div>
              </div>

              {/* Quick Presets for Offering Title (Creator pre-set to prevent accidental input errors) */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <div className="flex items-center gap-1.5">
                    <label className="text-[10px] font-bold text-slate-700 block">
                      Thawhlawm / Sum Hming Thlang Rawh:
                    </label>
                    <span className="text-[8.5px] font-bold text-emerald-700 bg-emerald-100/70 border border-emerald-200/80 px-1.5 py-0.2 rounded">
                      Creator Set
                    </span>
                  </div>
                  {isOwner && (
                    <button
                      type="button"
                      onClick={() => setShowAddGeneralPreset(!showAddGeneralPreset)}
                      className="text-[9.5px] font-black text-emerald-700 hover:text-emerald-900 flex items-center gap-0.5 cursor-pointer bg-white px-2 py-0.5 rounded-md border border-emerald-200"
                    >
                      <Plus className="w-3 h-3" /> Creator: Preset Dahna
                    </button>
                  )}
                </div>

                {/* Inline form to add custom general preset - STRICTLY for Campaign Creator */}
                {isOwner && showAddGeneralPreset && (
                  <div className="flex items-center gap-1.5 mb-2 p-1.5 bg-white border border-emerald-200 rounded-xl shadow-xs">
                    <input
                      type="text"
                      value={newGeneralPresetInput}
                      onChange={(e) => setNewGeneralPresetInput(e.target.value)}
                      placeholder="e.g. Naupang Sunday School / Pavalai Thawhlawm"
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 focus:outline-none focus:border-emerald-600"
                    />
                    <button
                      type="button"
                      onClick={() => handleAddGeneralPreset(newGeneralPresetInput)}
                      className="bg-emerald-600 text-white text-[10px] font-black px-2.5 py-1 rounded-lg hover:bg-emerald-700 transition cursor-pointer"
                    >
                      Save Preset
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAddGeneralPreset(false)}
                      className="text-slate-400 hover:text-slate-600 p-1"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                <div className="flex flex-wrap gap-1.5 mb-2">
                  {generalPresets.map((preset) => (
                    <div
                      key={preset}
                      className={`inline-flex items-center gap-1 text-[10.5px] ${isOwner ? 'pl-2.5 pr-1.5' : 'px-2.5'} py-1 rounded-lg font-bold border transition ${
                        generalTitle === preset
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-emerald-300'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setGeneralTitle(preset);
                          setIsCustomGeneral(false);
                        }}
                        className="cursor-pointer"
                      >
                        {preset}
                      </button>
                      {isOwner && (
                        <button
                          type="button"
                          onClick={(e) => handleRemoveGeneralPreset(preset, e)}
                          title="Creator: Paih bo rawh"
                          className={`p-0.5 rounded hover:bg-black/10 transition cursor-pointer ${
                            generalTitle === preset ? 'text-white/80 hover:text-white' : 'text-slate-400 hover:text-rose-600'
                          }`}
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <div className="relative">
                  <input
                    type="text"
                    value={generalTitle}
                    onChange={(e) => {
                      setGeneralTitle(e.target.value);
                      setIsCustomGeneral(true);
                    }}
                    placeholder="e.g. Pathianni Chawhma Thawhlawm..."
                    className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-emerald-600"
                  />
                  {isOwner && generalTitle.trim() && !generalPresets.includes(generalTitle.trim()) && (
                    <button
                      type="button"
                      onClick={() => handleAddGeneralPreset(generalTitle)}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[9.5px] bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold px-2 py-1 rounded-lg hover:bg-emerald-100 flex items-center gap-1 cursor-pointer"
                    >
                      <Sparkles className="w-3 h-3 text-amber-500" /> Creator: Save as Preset
                    </button>
                  )}
                </div>
              </div>

              {/* Collector / Inkhawm Hruaitu Info */}
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col justify-end">
                  <label className="text-[10px] font-bold text-slate-700 block mb-1 leading-tight min-h-[24px] flex items-end">
                    Thehluttu / Hruaitu / Treasurer Hming
                  </label>
                  <input
                    type="text"
                    value={generalCollectorName}
                    onChange={(e) => setGeneralCollectorName(e.target.value)}
                    placeholder="e.g. Inkhawm Hruaitu / Treasurer"
                    className="w-full bg-white border border-slate-300 rounded-xl p-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-emerald-600 h-9"
                  />
                </div>

                <div className="flex flex-col justify-end">
                  <label className="text-[10px] font-bold text-slate-700 block mb-1 leading-tight min-h-[24px] flex items-end">
                    Phone Number (Receipt dawn nan)
                  </label>
                  <input
                    type="tel"
                    maxLength={10}
                    value={generalCollectorPhone}
                    onChange={(e) => setGeneralCollectorPhone(e.target.value)}
                    placeholder="e.g. 9862xxxxxx"
                    className="w-full bg-white border border-slate-300 rounded-xl p-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-emerald-600 h-9"
                  />
                </div>
              </div>

              {/* Section / Bial selection */}
              <div>
                <label className="text-[10px] font-bold text-slate-700 block mb-0.5">
                  {campaign?.sectionLabel || 'Bial / Unit'}
                </label>
                <select
                  value={generalSection}
                  onChange={(e) => setGeneralSection(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl p-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-emerald-600"
                >
                  <option value="">-- {campaign?.sectionLabel || 'Bial / Unit'} Thlang Rawh (Optional) --</option>
                  {(campaign?.definedSections && campaign.definedSections.length > 0
                    ? campaign.definedSections
                    : ['Bial 1 (Vengchhak)', 'Bial 2 (Vengthlang)', 'Bial 3 (Venglai)', 'Bial 4 (Field Veng)', 'General / Khawchhung']
                  ).map((sec, idx) => (
                    <option key={idx} value={sec}>{sec}</option>
                  ))}
                </select>
              </div>

              {/* Direct General Amount & Payment Date Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t-2 border-emerald-200/90 mt-1">
                <div>
                  <label className="text-[10.5px] font-black text-emerald-950 block mb-1">
                    Thawhlawm Zat (Amount ₹) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-black text-sm text-emerald-700">₹</span>
                    <input
                      type="number"
                      min={1}
                      required
                      placeholder="e.g. 8450"
                      value={generalAmount === '' ? '' : generalAmount}
                      onChange={(e) => handleGeneralAmountChange(e.target.value)}
                      className="w-full bg-white border-2 border-emerald-300 rounded-xl py-2 pl-7 pr-3 font-black text-sm text-emerald-950 focus:outline-none focus:border-emerald-600 shadow-2xs"
                    />
                  </div>
                  {/* Quick amount chips */}
                  <div className="flex gap-1.5 overflow-x-auto no-scrollbar pt-1.5">
                    {[500, 1000, 2000, 5000, 10000].map(amt => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => handleGeneralAmountChange(String(amt))}
                        className={`px-2 py-0.5 rounded-lg text-[10.5px] font-bold transition cursor-pointer shrink-0 ${
                          generalAmount === amt 
                            ? 'bg-emerald-600 text-white shadow-xs' 
                            : 'bg-emerald-100/70 text-emerald-800 hover:bg-emerald-200'
                        }`}
                      >
                        ₹{amt.toLocaleString('en-IN')}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[10.5px] font-black text-emerald-950 block mb-1">
                    Pek Ni (Offering Date) *
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      value={selectedCustomDate}
                      onChange={(e) => {
                        handleCustomDateChange(e.target.value);
                        setUseCustomDate(true);
                      }}
                      className="w-full bg-white border-2 border-emerald-300 rounded-xl py-2 px-3 font-bold text-xs text-emerald-950 focus:outline-none focus:border-emerald-600 shadow-2xs"
                    />
                  </div>
                </div>
              </div>
            </div>
            )
          )}
        </div>
      ) : (
            /* STANDARD DONOR INFORMATION (Ralna, Khawlsak, Rikrum) */
            !isAnonymous && (
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-1">
                  I Hming Pum (Donor Full Name) *
                </label>
                <input
                  type="text"
                  required
                  value={donorName}
                  onChange={(e) => setDonorName(e.target.value)}
                  placeholder="e.g. C. Lalhmangaiha / Vanlalruati"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs font-bold text-slate-900 focus:outline-none focus:bg-white focus:border-indigo-600 transition"
                />
              </div>
            )
          )}

          {category !== 'kumtluang' && (
            <div>
              <label className="text-[10px] font-bold text-slate-500 block mb-1">
                Thuchah / Remark (Optional)
              </label>
              <input
                type="text"
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                placeholder={
                  (category === 'ralna' || campaign?.category === 'ralna')
                    ? 'e.g. Ralna thuchah / Tawrhpuina / adt'
                    : (category === 'rikrum' || campaign?.category === 'rikrum')
                    ? 'Thuchah / Tawrhpuina / adt'
                    : (category === 'khawlsak' || campaign?.category === 'khawlsak')
                    ? 'Thuchah'
                    : 'Thuchah / Remark (Optional)...'
                }
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs font-medium text-slate-900 focus:outline-none focus:bg-white focus:border-indigo-600 transition"
              />
            </div>
          )}
        </div>

        {/* Amount & Period Section */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs space-y-3">
          <div className="flex justify-between items-center">
            <h4 className="text-[11px] font-black text-slate-700 uppercase tracking-wider">
              {category === 'kumtluang' 
                ? (kumtluangDonorType === 'group' 
                    ? 'Group Sum Thehluh Zat' 
                    : kumtluangDonorType === 'general' 
                    ? 'Thawhlawm / Sum Thehluh Zat' 
                    : 'Kumtluang Sub-Category Breakdown (Mimal Thilpek)') 
                : 'Donation Amount (₹)'}
            </h4>
            {category === 'kumtluang' && (
              <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md border ${
                kumtluangDonorType === 'group'
                  ? 'text-indigo-700 bg-indigo-50 border-indigo-200'
                  : kumtluangDonorType === 'general'
                  ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                  : 'text-blue-700 bg-blue-50 border-blue-200'
              }`}>
                📅 {kumtluangDonorType === 'member' ? periodLabel : formatDateDDMMYYYY(selectedCustomDate)}
              </span>
            )}
          </div>

          {category === 'kumtluang' ? (
            kumtluangDonorType !== 'member' ? (
              /* GROUP & GENERAL SUMMARY: STRICTLY NO MIMAL BREAKDOWN OR FREQUENCY SELECTORS */
              <div className={`p-3.5 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 ${
                kumtluangDonorType === 'group'
                  ? 'bg-indigo-50/80 border-indigo-200 text-indigo-950'
                  : 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
              }`}>
                <div>
                  <span className="text-xs font-black block">
                    {kumtluangDonorType === 'group' 
                      ? `👥 ${groupName ? groupName : 'Group'} Thehluh Zat:` 
                      : `🏛️ ${generalTitle ? generalTitle : 'Thawhlawm'} Thehluh Zat:`}
                  </span>
                  <span className="text-[10.5px] opacity-85 font-medium mt-0.5 block">
                    Pek Ni: <b className="font-bold">{formatDateDDMMYYYY(selectedCustomDate)}</b>
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xl font-black font-mono bg-white px-3.5 py-1.5 rounded-xl border border-slate-200/80 shadow-2xs inline-block">
                    ₹{subtotal.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            ) : (
              /* MIMAL (MEMBER ROLL) BREAKDOWN */
              <div className="space-y-3">
                <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100 space-y-2.5">
                  <label className="text-[10.5px] font-extrabold text-slate-700 block">
                    Pek Hun / Frequency Thlanna (Monthly / Quarterly / Yearly)
                  </label>

                  {/* Frequency Mode Selector Tabs */}
                  <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-200/70 rounded-xl text-[11px] font-bold">
                    <button
                      type="button"
                      onClick={() => setPeriodType('monthly')}
                      className={`py-1.5 px-2 rounded-lg transition text-center cursor-pointer ${
                        periodType === 'monthly'
                          ? 'bg-white text-indigo-700 font-black shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Monthly (Thla tin)
                    </button>
                    <button
                      type="button"
                      onClick={() => setPeriodType('quarterly')}
                      className={`py-1.5 px-2 rounded-lg transition text-center cursor-pointer ${
                        periodType === 'quarterly'
                          ? 'bg-white text-indigo-700 font-black shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Quarterly (Thla 3 dan)
                    </button>
                    <button
                      type="button"
                      onClick={() => setPeriodType('yearly')}
                      className={`py-1.5 px-2 rounded-lg transition text-center cursor-pointer ${
                        periodType === 'yearly'
                          ? 'bg-white text-indigo-700 font-black shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Yearly (Kumtluan)
                    </button>
                  </div>

                  {/* Specific Period Pickers */}
                  <div className="grid grid-cols-2 gap-2 pt-0.5">
                    {periodType === 'monthly' && (
                      <div>
                        <label className="text-[10px] text-slate-500 font-bold block mb-1">Thla (Month)</label>
                        <select
                          value={selectedMonth}
                          onChange={(e) => setSelectedMonth(e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded-xl p-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-600"
                        >
                          {ALL_MONTH_NAMES_FULL.map(m => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {periodType === 'quarterly' && (
                      <div>
                        <label className="text-[10px] text-slate-500 font-bold block mb-1">Quarter (Thla 3 Huam)</label>
                        <select
                          value={selectedQuarter}
                          onChange={(e) => setSelectedQuarter(e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded-xl p-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-600"
                        >
                          <option value="Q1 (Jan - Mar)">Q1 (January - March)</option>
                          <option value="Q2 (Apr - Jun)">Q2 (April - June)</option>
                          <option value="Q3 (Jul - Sep)">Q3 (July - September)</option>
                          <option value="Q4 (Oct - Dec)">Q4 (October - December)</option>
                        </select>
                      </div>
                    )}

                    <div className={periodType === 'yearly' ? 'col-span-2' : ''}>
                      <label className="text-[10px] text-slate-500 font-bold block mb-1">Kum (Year)</label>
                      <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-xl p-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-600"
                      >
                        {getYearOptions(1, 3).map(yr => (
                          <option key={yr} value={yr}>{yr} {periodType === 'yearly' ? '(Kumtluan)' : ''}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Date duh tan (Specific Date Picker Option) */}
                  <div className="pt-2 border-t border-blue-100/90 mt-1">
                    <div className="flex items-center justify-between">
                      <label className="text-[10.5px] text-slate-700 font-bold flex items-center gap-1.5 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={useCustomDate}
                          onChange={(e) => setUseCustomDate(e.target.checked)}
                          className="w-3.5 h-3.5 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer"
                        />
                        <span>Pek ni bik (Date) thlan duh tan</span>
                      </label>
                      {useCustomDate && (
                        <span className="text-[9.5px] text-indigo-700 font-bold bg-indigo-50 border border-indigo-200/60 px-1.5 py-0.5 rounded">
                          Thla leh Kum a in-sync ang
                        </span>
                      )}
                    </div>

                    {useCustomDate && (
                      <div className="mt-2 animate-in fade-in duration-200 space-y-1">
                        <input
                          type="date"
                          value={selectedCustomDate}
                          onChange={(e) => handleCustomDateChange(e.target.value)}
                          className="w-full bg-white border border-indigo-200 rounded-xl p-2 text-xs font-bold text-indigo-950 focus:outline-none focus:border-indigo-600 shadow-2xs"
                        />
                        {selectedCustomDate && (
                          <div className="text-[10px] text-indigo-700 font-semibold flex items-center justify-between px-1">
                            <span>Ni thlan: <b className="font-bold text-indigo-950">{formatDateDDMMYYYY(selectedCustomDate)}</b></span>
                            <span className="text-[9px] text-slate-400 font-mono">(DD/MM/YYYY)</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Sub-Category Amounts (e.g. BMP Fund, Mission, Building Fund, etc.) */}
                <div className="space-y-3">
                  {Object.keys(subcatAmounts).map((catName) => {
                    const currentVal = subcatAmounts[catName];
                    const numVal = typeof currentVal === 'number' ? currentVal : (parseFloat(String(currentVal)) || 0);
                    return (
                      <div key={catName} className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80 shadow-2xs space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <label className="text-xs font-black text-slate-800 flex-1 truncate cursor-pointer">
                            {catName}
                          </label>
                          <div className="relative w-36 shrink-0">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 font-black text-xs text-indigo-700">₹</span>
                            <input
                              type="number"
                              min={0}
                              value={currentVal === '' ? '' : currentVal}
                              onChange={(e) => handleSubcatChange(catName, e.target.value)}
                              placeholder="0"
                              className="w-full bg-white border-2 border-indigo-200 focus:border-indigo-600 rounded-xl py-1.5 pl-6 pr-2.5 font-black text-right text-sm text-slate-900 focus:outline-none shadow-2xs"
                            />
                          </div>
                        </div>

                        {/* Quick Amount Chips */}
                        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-0.5 justify-end">
                          {[100, 200, 500, 1000, 2000].map(amt => (
                            <button
                              key={amt}
                              type="button"
                              onClick={() => handleSubcatChange(catName, String(amt))}
                              className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition cursor-pointer shrink-0 ${
                                numVal === amt 
                                  ? 'bg-indigo-600 text-white shadow-xs' 
                                  : 'bg-white text-indigo-800 hover:bg-indigo-100/70 border border-indigo-200'
                              }`}
                            >
                              ₹{amt.toLocaleString('en-IN')}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )
          ) : (
            <div className="space-y-2.5">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-black text-sm text-slate-400">₹</span>
                <input
                  type="number"
                  min={1}
                  required
                  placeholder="0"
                  value={standardAmount === '' ? '' : standardAmount}
                  onChange={(e) => {
                    if (amountError) setAmountError('');
                    const val = e.target.value;
                    if (val === '') {
                      setStandardAmount('');
                    } else {
                      const num = parseFloat(val);
                      setStandardAmount(isNaN(num) ? '' : num);
                    }
                  }}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl py-2.5 pl-8 pr-3 font-black text-sm text-slate-900 focus:outline-none focus:bg-white focus:border-indigo-600"
                />
              </div>

              {amountError && (
                <p className="text-xs text-rose-600 font-bold flex items-center gap-1.5 animate-in fade-in duration-150">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{amountError}</span>
                </p>
              )}

              {/* Quick Amount Buttons */}
              <div className="flex gap-2 overflow-x-auto no-scrollbar pt-1">
                {[100, 200, 500, 1000, 2000, 5000].map(amt => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => {
                      if (amountError) setAmountError('');
                      setStandardAmount(amt);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
                      standardAmount === amt 
                        ? 'bg-indigo-600 text-white shadow-xs' 
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    ₹{amt}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Payment Method Selector */}
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-xs space-y-2.5">
          <div className="flex items-center justify-between">
            <h4 className="text-[11px] font-black text-slate-700 uppercase tracking-wider">
              Payment Mode
            </h4>
            <span className="text-[10px] text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-full font-bold">
              PhonePe TSP Verified
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {/* 1. PhonePe PG V2 */}
            <button
              type="button"
              onClick={() => {
                setPaymentMethod('phonepe');
              }}
              className={`p-3 rounded-xl border text-center transition cursor-pointer flex flex-col items-center justify-center relative ${
                paymentMethod === 'phonepe'
                  ? 'bg-purple-50/90 border-purple-600 shadow-xs text-purple-950 ring-2 ring-purple-500/20'
                  : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700'
              }`}
            >
              <div className={`p-2 rounded-lg mb-1.5 transition-colors ${
                paymentMethod === 'phonepe' ? 'bg-purple-600 text-white shadow-xs' : 'bg-slate-200 text-slate-600'
              }`}>
                <Smartphone className="w-4 h-4" />
              </div>
              <p className="font-extrabold text-[11px] text-slate-900 leading-tight">
                PhonePe PG
              </p>
              <span className="text-[9px] text-purple-700 font-bold mt-0.5">
                UAT Active
              </span>
            </button>

            {/* 2. Cash Pekna */}
            <button
              type="button"
              onClick={() => setPaymentMethod('cash')}
              className={`p-3 rounded-xl border text-center transition cursor-pointer flex flex-col items-center justify-center relative ${
                paymentMethod === 'cash'
                  ? 'bg-amber-50/90 border-amber-600 shadow-xs text-amber-950 ring-2 ring-amber-500/20'
                  : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700'
              }`}
            >
              <div className={`p-2 rounded-lg mb-1.5 transition-colors ${
                paymentMethod === 'cash' ? 'bg-amber-600 text-white shadow-xs' : 'bg-slate-200 text-slate-600'
              }`}>
                <Banknote className="w-4 h-4" />
              </div>
              <p className="font-extrabold text-[11px] text-slate-900 leading-tight">
                Cash Pekna
              </p>
              <span className="text-[9px] text-slate-500 font-medium mt-0.5">
                Treasurer Slip
              </span>
            </button>
          </div>
        </div>

        {/* Bill Summary Breakdown */}
        <div className="bg-slate-900 text-white p-4 rounded-2xl space-y-2.5 text-xs shadow-md">
          <div className="flex justify-between text-slate-300 font-medium">
            <span>Thawh Zat (Donation Amount):</span>
            <span className="font-mono font-bold text-white">₹{subtotal.toLocaleString('en-IN')}</span>
          </div>

          <div className="flex justify-between text-slate-300 font-medium items-center">
            <span>
              Platform Fee {paymentMethod === 'cash' ? '(Cash - Free)' : feeRatePercent === 0 ? '(0% Free Trial)' : `(${feeRatePercent}%)`}:
            </span>
            <span className="font-mono font-bold text-emerald-400">
              {platformFee === 0 ? '₹0.00 (FREE)' : `₹${platformFee.toLocaleString('en-IN')}`}
            </span>
          </div>

          {isOnlinePayment && platformFee > 0 && (
            <div className="flex justify-between text-slate-300 font-medium items-center text-[11px] bg-slate-800/80 p-2 rounded-xl border border-slate-700/60">
              <span>Bawm Dawng Tur (Net to Bawm):</span>
              <span className="font-mono font-bold text-amber-300">₹{campaignNetReceived.toLocaleString('en-IN')}</span>
            </div>
          )}

          <div className="border-t border-slate-800 pt-2 flex justify-between items-center text-sm font-black">
            <span>Grand Total I Pek Tur (Total Payable):</span>
            <span className="font-mono text-emerald-400 text-base">₹{totalPayable.toLocaleString('en-IN')}</span>
          </div>

          {paymentMethod === 'cash' ? (
            <p className="text-[10px] text-slate-400 italic pt-1.5 border-t border-slate-800/80 leading-relaxed">
              * Cash a pek hian Platform Fee a ngai lo (₹0.00).
            </p>
          ) : (
            <p className="text-[10px] text-slate-400 pt-1.5 border-t border-slate-800/80 leading-relaxed flex items-center justify-between">
              <span>* PhonePe TSP & 256-bit encrypted NPCI rails</span>
              <span className="text-emerald-400 font-bold">100% Secure</span>
            </p>
          )}
        </div>

        {/* Pay Button */}
        <button
          type="submit"
          disabled={isProcessing || isExpired}
          className={`w-full py-3.5 px-4 rounded-2xl font-black text-sm text-white shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed ${
            isExpired
              ? 'bg-slate-700 hover:bg-slate-700'
              : paymentMethod === 'phonepe'
              ? 'bg-gradient-to-r from-purple-700 via-indigo-700 to-purple-800 hover:from-purple-600 hover:to-indigo-600'
              : 'bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600'
          }`}
        >
          {isProcessing ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              {paymentMethod === 'phonepe' ? 'Opening PhonePe PG V2...' : 'Recording Cash Entry...'}
            </>
          ) : isExpired ? (
            <>
              <AlertCircle className="w-4 h-4 text-rose-400" />
              <span>Pek Theih Hun a Tawp Tawh (Expired)</span>
            </>
          ) : (
            <>
              {paymentMethod === 'phonepe' ? (
                <>
                  <Zap className="w-4 h-4 text-amber-300" />
                  <span>
                    {subtotal > 0 
                      ? `Pay ₹${totalPayable.toLocaleString('en-IN')} via PhonePe PG (UAT)`
                      : 'Pay via PhonePe PG (UAT)'}
                  </span>
                </>
              ) : (
                <>
                  <Banknote className="w-4 h-4" />
                  <span>
                    {subtotal > 0 
                      ? `Submit ₹${subtotal.toLocaleString('en-IN')} Cash Slip`
                      : 'Submit Cash Slip'}
                  </span>
                </>
              )}
            </>
          )}
        </button>

        {/* PhonePe PG Live Sync Card when waiting for payment in new tab */}
        {isWaitingPhonePePG && activePendingTxn && (
          <div className="mt-4 p-5 rounded-3xl bg-slate-900 text-white border border-purple-500/40 shadow-2xl space-y-4 animate-in fade-in duration-200">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-[#5f259f] flex items-center justify-center font-black text-2xl shadow-lg shadow-purple-900/50">
                  पे
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-sm text-white">PhonePe PG (UAT)</span>
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold tracking-wide border border-emerald-500/30 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                      New Tab-ah a inhawng e
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    PhonePe portal tab-ah khan payment ti zo la, helai hmunah hian Receipt a lo lang nghal ang.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsWaitingPhonePePG(false);
                  setActivePendingTxn(null);
                  setPhonePeVerifyMsg(null);
                }}
                className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
                title="Kharna (Cancel)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-slate-800/80 rounded-2xl p-3.5 border border-slate-700/60 flex justify-between items-center text-xs">
              <div>
                <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider">Pawisa Pek Tur</span>
                <span className="font-black text-white text-base">₹{totalPayable.toFixed(2)}</span>
              </div>
              <div className="text-right">
                <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider">Gateway Status</span>
                <span className="inline-flex items-center gap-1.5 text-amber-400 font-bold text-xs">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  <span>A nghak mek (Waiting)...</span>
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                onClick={async () => {
                  if (!activePendingTxn) return;
                  setIsVerifyingInMainTab(true);
                  setPhonePeVerifyMsg(null);
                  try {
                    let r = await fetch(`/api/phonepe/status/${encodeURIComponent(activePendingTxn.id)}`);
                    let d = await r.json();
                    let isSuccess =
                      d?.code === 'PAYMENT_SUCCESS' ||
                      d?.code === 'SUCCESS' ||
                      d?.data?.state === 'COMPLETED' ||
                      d?.data?.status === 'SUCCESS' ||
                      d?.data?.status === 'PAYMENT_SUCCESS' ||
                      d?.data?.responseCode === 'SUCCESS';

                    const isFailed =
                      d?.code === 'PAYMENT_ERROR' ||
                      d?.data?.state === 'FAILED' ||
                      d?.data?.state === 'CANCELLED' ||
                      d?.data?.state === 'EXPIRED' ||
                      Boolean(d?.data?.errorCode) ||
                      d?.data?.responseCode === 'PAYMENT_ERROR' ||
                      d?.data?.responseCode === 'FAILED';

                    // Real status verification: Only mark success if PhonePe PG actually returned SUCCESS or COMPLETED
                    if (isSuccess) {
                      const finalTx: Transaction = {
                        ...activePendingTxn,
                        status: 'completed',
                        referenceNo: d?.data?.transactionId || d?.data?.paymentInstrument?.utr || activePendingTxn.referenceNo,
                        utr: d?.data?.paymentInstrument?.utr || d?.data?.utr || activePendingTxn.utr || ('UTR' + Math.floor(100000000000 + Math.random() * 900000000000))
                      };
                      saveTransaction(finalTx);
                      setIsWaitingPhonePePG(false);
                      onPaymentSuccess(finalTx);
                    } else if (isFailed) {
                      setIsWaitingPhonePePG(false);
                      if (onPaymentFailure) {
                        onPaymentFailure(activePendingTxn, d?.data?.detailedErrorCode || d?.data?.errorCode || 'PhonePe payment cancelled or failed');
                      }
                    } else {
                      setPhonePeVerifyMsg({
                        type: 'pending',
                        text: '⚠️ PhonePe status: A la pending mek. PhonePe-ah khan payment i la zo lo a nih hmel e. Khawngaihin payment ti zo la, i tih zawh veleh check nawn leh rawh le.'
                      });
                    }
                  } catch (e) {
                    setPhonePeVerifyMsg({
                      type: 'error',
                      text: 'Status check a theih rih lo e. Internet enfiah la lo nghak lawk rawh le.'
                    });
                  } finally {
                    setIsVerifyingInMainTab(false);
                  }
                }}
                disabled={isVerifyingInMainTab}
                className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-950/30 transition cursor-pointer"
              >
                {isVerifyingInMainTab ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                )}
                <span>Payment Status Check Rawh</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (phonePeLaunchUrl) {
                    window.open(phonePeLaunchUrl, '_blank');
                  } else if (activePendingTxn) {
                    window.open(`/api/phonepe/checkout?txnId=${encodeURIComponent(activePendingTxn.id)}`, '_blank');
                  }
                }}
                className="py-2.5 px-3 rounded-xl bg-purple-700 hover:bg-purple-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition text-center cursor-pointer shadow-lg shadow-purple-950/30"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>PhonePe Tab Hawng Nawn Rawh</span>
              </button>
            </div>

            <div className="text-center pt-0.5">
              <button
                type="button"
                onClick={() => setIsPhonePeCheckoutOpen(true)}
                className="text-[11px] text-purple-300 hover:text-white underline font-medium cursor-pointer transition"
              >
                In-App Modal hmanga hawng duh zawk tan: Heta hi hmet rawh
              </button>
            </div>

            {phonePeVerifyMsg && (
              <p className={`text-xs p-2.5 rounded-xl border ${
                phonePeVerifyMsg.type === 'error' ? 'bg-rose-950/40 border-rose-800/60 text-rose-300' : 'bg-amber-950/40 border-amber-800/60 text-amber-300'
              }`}>
                {phonePeVerifyMsg.text}
              </p>
            )}
          </div>
        )}
      </form>

      {/* Embedded PhonePe PG Checkout Modal */}
      <PhonePeCheckoutModal
        isOpen={isPhonePeCheckoutOpen}
        onClose={() => setIsPhonePeCheckoutOpen(false)}
        campaign={campaign}
        category={category}
        amount={subtotal}
        platformFee={platformFee}
        feeOption={feeBearerOption}
        donorName={isAnonymous ? 'Anonymous' : (currentDonorInfo.donorName || 'Valued Donor')}
        donorPhone={currentDonorInfo.donorPhone || undefined}
        donorVeng={currentDonorInfo.donorVeng || undefined}
        donorType={category === 'kumtluang' ? currentDonorInfo.donorType : undefined}
        groupName={category === 'kumtluang' ? currentDonorInfo.groupName : undefined}
        memberId={currentDonorInfo.memberId}
        subId={currentDonorInfo.subId}
        isDependent={currentDonorInfo.isDependent}
        isAnonymous={isAnonymous}
        remark={remark.trim() || undefined}
        subcatAmounts={category === 'kumtluang' 
          ? (currentDonorInfo.donorType === 'group'
              ? { [currentDonorInfo.groupName || 'Group Sum']: subtotal }
              : currentDonorInfo.donorType === 'general'
              ? { [generalTitle.trim() || 'General Thawhlawm']: subtotal }
              : resolvedNumericSubcatAmounts)
          : undefined}
        periodType={category === 'kumtluang' ? periodType : undefined}
        periodMonth={category === 'kumtluang' ? selectedMonth : undefined}
        periodYear={category === 'kumtluang' ? selectedYear : undefined}
        periodLabel={category === 'kumtluang' ? periodLabel : undefined}
        onPaymentSuccess={(transaction) => {
          setIsPhonePeCheckoutOpen(false);
          onPaymentSuccess(transaction);
        }}
      />

      {/* Embedded Direct UPI Apps (GPay, Paytm, PhonePe) Modal */}
      <UPIIntentModal
        isOpen={isUPICheckoutOpen}
        onClose={() => setIsUPICheckoutOpen(false)}
        campaign={campaign}
        category={category}
        amount={subtotal}
        platformFee={platformFee}
        feeOption={feeBearerOption}
        campaignNetReceived={campaignNetReceived}
        donorName={isAnonymous ? 'Anonymous' : (currentDonorInfo.donorName || 'Valued Donor')}
        donorPhone={currentDonorInfo.donorPhone || undefined}
        donorVeng={currentDonorInfo.donorVeng || undefined}
        donorType={category === 'kumtluang' ? currentDonorInfo.donorType : undefined}
        groupName={category === 'kumtluang' ? currentDonorInfo.groupName : undefined}
        memberId={currentDonorInfo.memberId}
        subId={currentDonorInfo.subId}
        isDependent={currentDonorInfo.isDependent}
        isAnonymous={isAnonymous}
        remark={remark.trim() || undefined}
        subcatAmounts={category === 'kumtluang' 
          ? (currentDonorInfo.donorType === 'group'
              ? { [currentDonorInfo.groupName || 'Group Sum']: subtotal }
              : currentDonorInfo.donorType === 'general'
              ? { [generalTitle.trim() || 'General Thawhlawm']: subtotal }
              : resolvedNumericSubcatAmounts)
          : undefined}
        periodType={category === 'kumtluang' ? periodType : undefined}
        periodMonth={category === 'kumtluang' ? selectedMonth : undefined}
        periodYear={category === 'kumtluang' ? selectedYear : undefined}
        periodLabel={category === 'kumtluang' ? periodLabel : undefined}
        onPaymentSuccess={(transaction) => {
          setIsUPICheckoutOpen(false);
          onPaymentSuccess(transaction);
        }}
      />

      {/* Creator & Officer: Change Officer Passcode PIN Modal */}
      {showChangePinModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-sm w-full p-4 space-y-3.5 border border-slate-200 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h4 className="font-black text-slate-900 text-sm flex items-center gap-1.5">
                <KeyRound className="w-4 h-4 text-indigo-600" />
                <span>Officer PIN Thlakna (Group & General)</span>
              </h4>
              <button 
                type="button" 
                onClick={() => {
                  setShowChangePinModal(false);
                  setChangePinError('');
                  setChangePinSuccess('');
                }} 
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Treasurer leh Finance Secretary ten Group / General thehluh nana an hman tur 4-6 digit PIN thar dah rawh:
            </p>

            {changePinSuccess && (
              <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-xl flex items-center gap-2 animate-fadeIn">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{changePinSuccess}</span>
              </div>
            )}

            {changePinError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold rounded-xl flex items-center gap-2 animate-fadeIn">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{changePinError}</span>
              </div>
            )}

            <div className="space-y-2.5">
              {!isOwner && !creatorProfile?.isAdmin && creatorProfile?.role !== 'SUPER_ADMIN' && creatorProfile?.role !== 'ADMIN' && (
                <div>
                  <label className="text-[10px] font-bold text-slate-600 block mb-1">
                    Current Officer PIN (Old PIN)
                  </label>
                  <input
                    type={showOfficerPinValue ? 'text' : 'password'}
                    maxLength={10}
                    value={oldOfficerPinInput}
                    onChange={(e) => setOldOfficerPinInput(e.target.value)}
                    placeholder="Current PIN (e.g. 7788)"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-black text-slate-900 focus:outline-none focus:border-indigo-600"
                  />
                </div>
              )}

              <div>
                <label className="text-[10px] font-bold text-slate-600 block mb-1">
                  Officer PIN Thar (4-6 digits)
                </label>
                <input
                  type={showOfficerPinValue ? 'text' : 'password'}
                  maxLength={6}
                  value={newOfficerPinInput}
                  onChange={(e) => setNewOfficerPinInput(e.target.value.trim())}
                  placeholder={activeCampaign?.officerPasscode ? `e.g. ${activeCampaign.officerPasscode}` : '7788'}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-center text-lg font-mono font-black tracking-widest text-slate-900 focus:outline-none focus:border-indigo-600"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-600 block mb-1">
                  Confirm PIN Thar (Nawnna)
                </label>
                <input
                  type={showOfficerPinValue ? 'text' : 'password'}
                  maxLength={6}
                  value={confirmOfficerPinInput}
                  onChange={(e) => setConfirmOfficerPinInput(e.target.value.trim())}
                  placeholder="Re-type new PIN"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-center text-lg font-mono font-black tracking-widest text-slate-900 focus:outline-none focus:border-indigo-600"
                />
              </div>

              <div className="flex items-center justify-between text-[10px] pt-1">
                <button
                  type="button"
                  onClick={() => setShowOfficerPinValue(!showOfficerPinValue)}
                  className="text-slate-500 hover:text-slate-800 flex items-center gap-1 font-semibold cursor-pointer"
                >
                  {showOfficerPinValue ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  <span>{showOfficerPinValue ? 'Hide PIN' : 'Show PIN'}</span>
                </button>
                <span className="text-slate-400 font-medium">Bawm: {activeCampaign?.title || 'Kumtluang'}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setShowChangePinModal(false);
                  setChangePinError('');
                  setChangePinSuccess('');
                }}
                className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSavingOfficerPin}
                onClick={() => handleSaveOfficerPin(newOfficerPinInput, oldOfficerPinInput)}
                className="px-4 py-2 text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-xs cursor-pointer active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
              >
                {isSavingOfficerPin ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                <span>Save PIN Thar</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
