import React, { useState, useEffect, useMemo } from 'react';
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
  Users,
  UserPlus,
  UserCheck,
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
  RefreshCw
} from 'lucide-react';
import { BawmCategory, Campaign, PaymentMethod, Transaction, SystemPricingConfig, MemberRecord, MemberDependent, FeeOptionMode } from '../types';
import { BAWM_CONFIG, DEFAULT_PRICING_CONFIG } from '../data/initialData';
import { formatDateDDMMYYYY, formatDateTimeDDMMYYYY, isCampaignExpired } from '../utils/date';
import { Language, TRANSLATIONS, translateDynamicText, translateCampaignCause, translateCampaignTitle, useCampaignCauseTranslation, getCampaignCauseTitle } from '../utils/translations';
import { getMembers, addOrUpdateMember, saveTransaction } from '../utils/storage';
import { ALL_MONTH_NAMES_FULL, getCurrentMonthName, getCurrentYearString, getCurrentQuarterString, getYearOptions } from '../utils/monthHelper';
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
}) => {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('phonepe');
  const [isPhonePeCheckoutOpen, setIsPhonePeCheckoutOpen] = useState<boolean>(() => !!initialOpenPhonePeCheckout);
  const [isUPICheckoutOpen, setIsUPICheckoutOpen] = useState<boolean>(false);
  const [phonePeRedirectUrl, setPhonePeRedirectUrl] = useState<string>('');
  const [isRedirectingToPhonePe, setIsRedirectingToPhonePe] = useState<boolean>(false);
  const [activePendingTxn, setActivePendingTxn] = useState<Transaction | null>(null);
  const [isVerifyingInMainTab, setIsVerifyingInMainTab] = useState<boolean>(false);
  const [phonePeVerifyMsg, setPhonePeVerifyMsg] = useState<{ type: 'error' | 'pending' | 'success'; text: string } | null>(null);

  // Background listener to detect when user finishes payment in the New Tab
  useEffect(() => {
    if (!isRedirectingToPhonePe || !activePendingTxn) return;

    let isFinished = false;
    const triggerSuccess = (updatedFields?: Partial<Transaction>) => {
      if (isFinished) return;
      isFinished = true;
      setIsRedirectingToPhonePe(false);
      setIsProcessing(false);
      const finalTx: Transaction = {
        ...activePendingTxn,
        status: 'completed',
        ...(updatedFields || {})
      };
      saveTransaction(finalTx);
      onPaymentSuccess(finalTx);
    };

    const triggerFailed = (reason?: string) => {
      if (isFinished) return;
      isFinished = true;
      setIsRedirectingToPhonePe(false);
      setIsProcessing(false);
      if (activePendingTxn) {
        const failedTx: Transaction = {
          ...activePendingTxn,
          status: 'failed',
        };
        if (onPaymentFailure) {
          onPaymentFailure(failedTx, reason);
          return;
        }
      }
      setPhonePeVerifyMsg({
        type: 'error',
        text: `⚠️ PhonePe atangin payment a tlang lo (Failed / Cancelled). Pawisa i bank atangin a in cut lo e.${reason ? ` (${reason})` : ''} Khawngaihin i ti tha leh dawn nia.`
      });
    };

    // 1. BroadcastChannel (fastest across browser tabs on same origin)
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

    // 2. window.addEventListener('message') from window.opener
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

    // 3. Storage event (when another tab writes RONPAY_LAST_CONFIRMED_TXN)
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

    // 4. Polling backend status every 2 seconds
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/phonepe/status/${encodeURIComponent(activePendingTxn.id)}`);
        const json = await res.json();
        if (json?.data?.state === 'COMPLETED' || json?.data?.responseCode === 'SUCCESS' || json?.code === 'PAYMENT_SUCCESS' || json?.data?.status === 'PAYMENT_SUCCESS') {
          triggerSuccess({
            referenceNo: json.data?.transactionId || json.data?.paymentInstrument?.utr || activePendingTxn.referenceNo,
            utr: json.data?.paymentInstrument?.utr || activePendingTxn.utr
          });
        } else if (json?.data?.state === 'FAILED' || json?.data?.state === 'CANCELLED' || json?.data?.state === 'EXPIRED' || json?.code === 'PAYMENT_ERROR') {
          triggerFailed(json?.data?.detailedErrorCode || json?.data?.errorCode || 'Payment failed on PhonePe');
        }
      } catch (e) {}
    }, 2200);

    return () => {
      if (bc) bc.close();
      window.removeEventListener('message', handleMsg);
      window.removeEventListener('storage', handleStorage);
      clearInterval(interval);
    };
  }, [isRedirectingToPhonePe, activePendingTxn, onPaymentSuccess, onPaymentFailure]);

  // Dynamic Cause Translation when user/donor views in English
  const { translatedCause, isTranslating: isTranslatingCause } = useCampaignCauseTranslation(campaign, language);

  useEffect(() => {
    if (initialOpenPhonePeCheckout) {
      setPaymentMethod('phonepe');
      setIsPhonePeCheckoutOpen(true);
    }
  }, [initialOpenPhonePeCheckout]);

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
  const [standardAmount, setStandardAmount] = useState<number>(() => {
    if (initialAmount && initialAmount > 0) return initialAmount;
    if (campaign?.customAmount && campaign.customAmount > 0) return campaign.customAmount;
    if (campaign?.targetAmount && campaign.targetAmount > 0) return campaign.targetAmount;
    return 500;
  });
  const [donorName, setDonorName] = useState<string>(() => initialDonorName || '');
  const [remark, setRemark] = useState<string>('');
  const [isAnonymous, setIsAnonymous] = useState<boolean>(() => Boolean(initialIsAnonymous));
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [phonePeStatus, setPhonePeStatus] = useState<'IDLE' | 'CALLING_PG' | 'SUCCESS'>('IDLE');

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
  const [subcatAmounts, setSubcatAmounts] = useState<{ [key: string]: number }>({
    'Pathian Ram Zauna': 500,
    'Mission': 300,
    'Building Fund': 200,
  });

  const config = BAWM_CONFIG[category];
  const isExpired = isCampaignExpired(campaign?.validityDate, campaign?.status);
  const isPendingApproval = campaign?.status === 'pending_approval';
  const isRejected = campaign?.status === 'rejected';

  // Derive human-readable period label
  const periodLabel = periodType === 'monthly'
    ? `${selectedMonth} ${selectedYear}${useCustomDate && selectedCustomDate ? ` (${selectedCustomDate})` : ''}`
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

  // Initialize subcategories from campaign
  useEffect(() => {
    const explicitAmt = (initialAmount && initialAmount > 0)
      ? initialAmount
      : (campaign?.customAmount && campaign.customAmount > 0)
      ? campaign.customAmount
      : (campaign?.targetAmount && campaign.targetAmount > 0)
      ? campaign.targetAmount
      : null;
    if (explicitAmt && explicitAmt > 0) {
      setStandardAmount(explicitAmt);
    }

    if (category === 'kumtluang') {
      if (campaign?.subCategories && campaign.subCategories.length > 0) {
        const initialMap: { [key: string]: number } = {};
        campaign.subCategories.forEach((cat, idx) => {
          initialMap[cat] = (idx + 1) * 100;
        });
        setSubcatAmounts(initialMap);
      }
    }
  }, [category, campaign, initialAmount]);

  const handlePhoneSearch = (query: string) => {
    setPhoneSearchQuery(query);
    const cleanQ = query.trim();
    if (!cleanQ) {
      setSelectedMember(null);
      setIsNewMemberMode(false);
      return;
    }
    // Search strictly within this campaign's members
    const bawmMembers = campaign?.id ? getMembers(campaign.id) : getMembers();
    const match = bawmMembers.find(m => 
      m.phoneLast4 === cleanQ || 
      (m.fullPhone && m.fullPhone.endsWith(cleanQ)) ||
      m.id.toLowerCase() === cleanQ.toLowerCase() ||
      m.name.toLowerCase().includes(cleanQ.toLowerCase()) ||
      (m.dependents && m.dependents.some(d => d.subId.toLowerCase() === cleanQ.toLowerCase() || d.name.toLowerCase().includes(cleanQ.toLowerCase())))
    );

    if (match) {
      setSelectedMember(match);
      setDonorName(match.name);
      setDonorPhone(match.fullPhone || '');
      setDonorSection(match.section || 'Section A');
      setSelectedPayerType('primary');
      setIsNewMemberMode(false);
    } else {
      setSelectedMember(null);
      if (cleanQ.length >= 2) {
        setIsNewMemberMode(true);
        if (/^\d+$/.test(cleanQ)) {
          setNewRegPhone(cleanQ.length === 10 ? cleanQ : `943600${cleanQ}`);
        }
      }
    }
  };

  const handleQuickRegisterSubmit = (e?: React.FormEvent): MemberRecord | null => {
    if (e) e.preventDefault();
    if (!newRegName.trim()) {
      alert('Khawngaihin Member Hming chhu lut rawh le.');
      return null;
    }
    const cleanPhone = newRegPhone.replace(/\D/g, '');
    const phoneLast4 = cleanPhone.length >= 4 ? cleanPhone.slice(-4) : Math.floor(1000 + Math.random() * 9000).toString();
    const orgCode = campaign?.orgCode || deriveOrgCode(campaign?.orgName, campaign?.title);
    const newId = `${orgCode}-${phoneLast4}`;

    const sectionToUse = isCustomSection 
      ? (customSectionText.trim() || 'General') 
      : (newRegSection || 'General');

    const newMember: MemberRecord = {
      id: newId,
      campaignId: campaign?.id,
      name: newRegName.trim(),
      orgCode: orgCode,
      phoneLast4: phoneLast4,
      fullPhone: cleanPhone || (phoneLast4.length === 10 ? phoneLast4 : `943600${phoneLast4}`),
      section: sectionToUse,
      isFamilyHead: true,
      dependents: [],
      createdAt: new Date().toISOString()
    };

    addOrUpdateMember(newMember);
    setSelectedMember(newMember);
    setDonorName(newMember.name);
    setDonorPhone(newMember.fullPhone || '');
    setDonorSection(newMember.section || 'General');
    setPhoneSearchQuery(phoneLast4);
    setSelectedPayerType('primary');
    setIsNewMemberMode(false);
    setNewRegName('');
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
    const num = parseFloat(value) || 0;
    setSubcatAmounts(prev => ({
      ...prev,
      [catName]: num,
    }));
  };

  // Calculate totals
  const subtotal = category === 'kumtluang'
    ? (Object.values(subcatAmounts) as number[]).reduce((acc: number, curr: number) => acc + curr, 0)
    : standardAmount;

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

  const basePlatformFee = feeRatePercent > 0 
    ? Math.max(1, Math.round((subtotal * (feeRatePercent / 100)) + fixedFee))
    : 0;
  const platformFee = (isOnlinePayment && feeRatePercent > 0) ? basePlatformFee : 0;

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

  const handleProcessPayment = (e: React.FormEvent) => {
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
      alert('Khawngaihin pek tur zat (amount) chhu lut rawh!');
      return;
    }

    let resolvedDonorName = donorName.trim();
    let resolvedDonorPhone = donorPhone.trim();
    let resolvedDonorVeng = donorSection.trim();
    let resolvedMemberId: string | undefined = undefined;
    let resolvedSubId: string | undefined = undefined;
    let resolvedIsDependent = false;

    if (category === 'kumtluang') {
      if (!isAnonymous) {
        let activeMember = selectedMember;
        // If not selected yet, but user filled new registration inputs:
        if (!activeMember && newRegName.trim()) {
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
        } else if (!resolvedDonorName) {
          setIsNewMemberMode(true);
          alert('⚠️ Kumtluang Bawm-ah hian Petu Hming leh Phone Number ziah luh ngei ngei tur a ni (emaw I Member ID/Phone zawng rawh le).\n\nHming thup i duh a nih chuan chung lama "Hming thup" checkbox kha tick rawh.');
          return;
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
      setIsProcessing(true);
      const merchantTxnId = `RPAY_TXN_${Date.now()}_${Math.floor(100 + Math.random() * 900)}`;

      // Save pending transaction in localStorage so returning to RonPay shows instant verified receipt
      const pendingTx: Transaction = {
        id: merchantTxnId,
        campaignId: campaign?.id || `cmp-${category}-custom`,
        campaignTitle: getCampaignCauseTitle(campaign, category === 'ralna' ? 'Ralna Bawm' : config.name),
        category: category,
        donorName: isAnonymous ? 'Anonymous' : (resolvedDonorName || 'Valued Donor'),
        donorPhone: isAnonymous ? undefined : (resolvedDonorPhone || undefined),
        donorVeng: isAnonymous ? undefined : (resolvedDonorVeng || undefined),
        memberId: isAnonymous ? undefined : resolvedMemberId,
        subId: isAnonymous ? undefined : resolvedSubId,
        isDependent: isAnonymous ? false : resolvedIsDependent,
        isAnonymous: isAnonymous,
        amount: subtotal,
        platformFee: platformFee,
        totalAmount: totalPayable,
        paymentMethod: 'phonepe',
        status: 'pending',
        timestamp: new Date().toISOString(),
        remark: remark.trim() || undefined,
        feeOption: feeBearerOption,
        subCategoryBreakdown: category === 'kumtluang' ? subcatAmounts : undefined,
        periodType: category === 'kumtluang' ? periodType : undefined,
        periodMonth: category === 'kumtluang' ? selectedMonth : undefined,
        periodYear: category === 'kumtluang' ? selectedYear : undefined,
        periodLabel: category === 'kumtluang' ? periodLabel : undefined,
        campaignNetReceived: feeBearerOption === 'ADD_ON' ? subtotal : Math.max(0, subtotal - platformFee)
      };

      try {
        localStorage.setItem(`RONPAY_PENDING_TX_${merchantTxnId}`, JSON.stringify(pendingTx));
        // Note: We do NOT call saveTransaction(pendingTx) here so uncompleted or cancelled
        // gateway attempts do not pollute the Sulhnu transaction history.
      } catch (e) {}

      // Open new tab synchronously during user click action to bypass browser popup blockers
      let newTab: Window | null = null;
      try {
        newTab = window.open('about:blank', '_blank');
        if (newTab) {
          newTab.document.write(`<!DOCTYPE html>
<html lang="lus">
<head>
  <meta charset="utf-8">
  <title>PhonePe Payment Gateway</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0b0f19; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 24px; text-align: center; }
    .card { background: #161f33; border: 1px solid rgba(255,255,255,0.12); padding: 36px 28px; border-radius: 28px; max-width: 400px; width: 100%; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.6); }
    .logo { width: 68px; height: 68px; background: #5f259f; border-radius: 20px; display: flex; align-items: center; justify-content: center; font-size: 34px; font-weight: 900; color: #fff; margin: 0 auto 20px; box-shadow: 0 10px 25px -5px rgba(95,37,159,0.5); animation: pulse 1.6s infinite ease-in-out; }
    @keyframes pulse { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.06); opacity: 0.9; } }
    h2 { font-size: 19px; font-weight: 800; margin: 0 0 10px; color: #ffffff; }
    p { font-size: 13px; color: #94a3b8; line-height: 1.6; margin: 0 0 20px; }
    .spinner { border: 3px solid rgba(255,255,255,0.15); border-top-color: #a855f7; border-radius: 50%; width: 32px; height: 32px; animation: spin 0.9s linear infinite; margin: 0 auto; }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">पे</div>
    <h2>PhonePe Gateway Portal</h2>
    <p>Official PhonePe Mercury UAT checkout portal ah kan hruai lut mek che e. Khawngaihin lo nghak lawk rawh le...</p>
    <div class="spinner"></div>
  </div>
</body>
</html>`);
        }
      } catch (e) {}

      setActivePendingTxn(pendingTx);
      setIsRedirectingToPhonePe(true);

      fetch('/api/phonepe/initiate-pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchantTransactionId: merchantTxnId,
          amountInRupees: totalPayable,
          baseAmountInRupees: subtotal,
          feeOption: feeBearerOption,
          donorName: isAnonymous ? 'Anonymous' : (resolvedDonorName || 'Valued Donor'),
          customerPhone: resolvedDonorPhone || undefined,
          campaignTitle: getCampaignCauseTitle(campaign, category === 'ralna' ? 'Ralna Bawm' : config.name),
          campaignId: campaign?.id || `cmp-${category}-custom`,
          category: category,
          isAnonymous: isAnonymous,
          origin: window.location.origin,
          subcatAmounts: category === 'kumtluang' ? subcatAmounts : undefined,
          periodType: category === 'kumtluang' ? periodType : undefined,
          periodMonth: category === 'kumtluang' ? selectedMonth : undefined,
          periodYear: category === 'kumtluang' ? selectedYear : undefined,
          periodLabel: category === 'kumtluang' ? periodLabel : undefined,
          memberId: isAnonymous ? undefined : resolvedMemberId,
          subId: isAnonymous ? undefined : resolvedSubId,
          isDependent: isAnonymous ? false : resolvedIsDependent,
          remark: remark.trim() || undefined
        })
      })
        .then(r => r.json())
        .then(resData => {
          const targetUrl = resData?.data?.instrumentResponse?.redirectInfo?.mercuryUrl || 
                            resData?.data?.instrumentResponse?.redirectInfo?.url;
          setIsProcessing(false);
          if (targetUrl) {
            setPhonePeRedirectUrl(targetUrl);
            if (newTab && !newTab.closed) {
              try {
                newTab.location.href = targetUrl;
              } catch {
                window.open(targetUrl, '_blank');
              }
            } else {
              try {
                window.open(targetUrl, '_blank');
              } catch (e) {}
            }
          } else {
            if (newTab && !newTab.closed) {
              newTab.close();
            }
            setIsPhonePeCheckoutOpen(true);
            setIsRedirectingToPhonePe(false);
          }
        })
        .catch(err => {
          console.warn('Direct PhonePe PG redirect fallback:', err);
          if (newTab && !newTab.closed) {
            newTab.close();
          }
          setIsPhonePeCheckoutOpen(true);
          setIsRedirectingToPhonePe(false);
          setIsProcessing(false);
        });

      return;
    }

    if (paymentMethod === 'online') {
      setIsProcessing(false);
      setIsUPICheckoutOpen(true);
      return;
    }

    setIsProcessing(true);

    if (paymentMethod === 'cash') {
      // Cash payment
      const transaction: Transaction = {
        id: 'RPAY-CASH-' + Math.floor(100000 + Math.random() * 900000),
        campaignId: campaign?.id || `cmp-${category}-custom`,
        campaignTitle: getCampaignCauseTitle(campaign, category === 'ralna' ? 'Ralna Bawm' : config.name),
        category: category,
        donorName: isAnonymous ? 'Anonymous' : (resolvedDonorName || 'Valued Donor'),
        donorPhone: isAnonymous ? undefined : (resolvedDonorPhone || undefined),
        donorVeng: isAnonymous ? undefined : (resolvedDonorVeng || undefined),
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
        subCategoryBreakdown: category === 'kumtluang' ? subcatAmounts : undefined,
        periodType: category === 'kumtluang' ? periodType : undefined,
        periodLabel: category === 'kumtluang' ? periodLabel : undefined,
        timestamp: new Date().toISOString(),
        txHash: 'CASH' + Math.random().toString(36).substring(2, 10).toUpperCase(),
      };

      setTimeout(() => {
        setIsProcessing(false);
        onCashPending(transaction);
      }, 700);
    }
  };

  const isRalna = category === 'ralna';

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
            <div className="grid grid-cols-2 gap-2 text-center text-[11px]">
              <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                <span className="text-[9px] text-slate-400 block font-bold">{language === 'english' ? 'TARGET GOAL' : 'TARGET AMOUNT'}</span>
                <span className="font-black text-slate-900">₹{(campaign?.targetAmount || 50000).toLocaleString('en-IN')}</span>
              </div>
              <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                <span className="text-[9px] text-slate-400 block font-bold">{language === 'english' ? 'MAX LIMIT / DONOR' : 'MAX LIMIT / DONOR'}</span>
                <span className="font-black text-slate-900">₹{(campaign?.maxLimit || 100000).toLocaleString('en-IN')}</span>
              </div>
            </div>
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
              <span className="font-black text-rose-600">{campaign?.urgencyDeadline ? new Date(campaign.urgencyDeadline).toLocaleDateString() : '25 Aug 2026'}</span>
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
              ) : isNewMemberMode || phoneSearchQuery.length >= 2 ? (
                /* 3. When Member is NOT Found / ID la nei lo tan: Auto Instant Registration */
                <div className="bg-amber-50/70 border border-amber-300/80 p-3.5 rounded-2xl space-y-2.5">
                  <div className="flex items-center gap-2">
                    <span className="p-1 bg-amber-500 text-white rounded-lg">
                      <UserPlus className="w-3.5 h-3.5" />
                    </span>
                    <div>
                      <h5 className="text-xs font-black text-amber-950">
                        ID la nei lo tan (Instant Auto-Registration)
                      </h5>
                      <p className="text-[10px] text-amber-800 font-medium">
                        I hming leh phone i ziah zawh veleh Member ID auto-siam a ni ang a, hemi page-ah hian i lut nghal ang.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2 pt-1">
                    <div>
                      <label className="text-[10px] font-bold text-slate-700 block mb-0.5">
                        I Hming Pum (Full Name) *
                      </label>
                      <input
                        type="text"
                        value={newRegName}
                        onChange={(e) => {
                          setNewRegName(e.target.value);
                          setDonorName(e.target.value);
                        }}
                        placeholder="e.g. Vanlalruati / C. Lalhmangaiha"
                        className="w-full bg-white border border-slate-300 rounded-xl p-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-600 transition"
                      />
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
                          onChange={(e) => {
                            setNewRegPhone(e.target.value);
                            setDonorPhone(e.target.value);
                          }}
                          placeholder="e.g. 9436123456"
                          className="w-full bg-white border border-slate-300 rounded-xl p-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-600 transition"
                        />
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
                          onChange={(e) => {
                            setCustomSectionText(e.target.value);
                            setDonorSection(e.target.value);
                          }}
                          placeholder="e.g. Bial 5 / Section E / Hmar Veng..."
                          className="w-full bg-white border-2 border-blue-400 rounded-xl p-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-600"
                        />
                      </div>
                    )}

                    {newRegPhone.length >= 4 && (
                      <div className="text-[10px] font-bold text-blue-900 bg-blue-100/70 p-2 rounded-lg flex items-center justify-between border border-blue-200">
                        <span>I Member ID Tur:</span>
                        <span className="font-black text-blue-700 font-mono text-xs">
                          {deriveOrgCode(campaign?.orgName, campaign?.title)}-{newRegPhone.slice(-4)}
                        </span>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => handleQuickRegisterSubmit()}
                      disabled={!newRegName.trim() || newRegPhone.length < 4}
                      className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-2 rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
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
                placeholder="e.g. Ralna thuchah / Lawmthu sawina / Note..."
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs font-medium text-slate-900 focus:outline-none focus:bg-white focus:border-indigo-600 transition"
              />
            </div>
          )}
        </div>

        {/* Amount & Period Section */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs space-y-3">
          <div className="flex justify-between items-center">
            <h4 className="text-[11px] font-black text-slate-700 uppercase tracking-wider">
              {category === 'kumtluang' ? 'Kumtluang Sub-Category Breakdown' : 'Donation Amount (₹)'}
            </h4>
            {category === 'kumtluang' && (
              <span className="text-[10px] font-extrabold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md">
                📅 {periodLabel}
              </span>
            )}
          </div>

          {category === 'kumtluang' && (
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
                  <div className="mt-2 animate-in fade-in duration-200">
                    <input
                      type="date"
                      value={selectedCustomDate}
                      onChange={(e) => handleCustomDateChange(e.target.value)}
                      className="w-full bg-white border border-indigo-200 rounded-xl p-2 text-xs font-bold text-indigo-950 focus:outline-none focus:border-indigo-600 shadow-2xs"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {category === 'kumtluang' ? (
            <div className="space-y-2.5">
              {Object.keys(subcatAmounts).map((catName) => (
                <div key={catName} className="flex items-center justify-between gap-3 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
                  <span className="text-xs font-bold text-slate-800 flex-1 truncate">{catName}</span>
                  <div className="flex items-center gap-1 w-28 shrink-0">
                    <span className="text-xs font-bold text-slate-400">₹</span>
                    <input
                      type="number"
                      min={0}
                      value={subcatAmounts[catName] === 0 ? '' : subcatAmounts[catName]}
                      onChange={(e) => handleSubcatChange(catName, e.target.value)}
                      placeholder="0"
                      className="w-full bg-white border border-slate-300 rounded-lg p-1.5 font-black text-right text-xs text-slate-900 focus:outline-none focus:border-indigo-600"
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2.5">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-black text-sm text-slate-400">₹</span>
                <input
                  type="number"
                  min={1}
                  required
                  value={standardAmount}
                  onChange={(e) => setStandardAmount(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl py-2.5 pl-8 pr-3 font-black text-sm text-slate-900 focus:outline-none focus:bg-white focus:border-indigo-600"
                />
              </div>

              {/* Quick Amount Buttons */}
              <div className="flex gap-2 overflow-x-auto no-scrollbar pt-1">
                {[100, 200, 500, 1000, 2000, 5000].map(amt => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setStandardAmount(amt)}
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
          disabled={isProcessing || subtotal <= 0 || isExpired}
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
                  <span>Pay ₹{totalPayable.toLocaleString('en-IN')} via PhonePe PG (UAT)</span>
                </>
              ) : (
                <>
                  <Banknote className="w-4 h-4" />
                  <span>Submit ₹{subtotal.toLocaleString('en-IN')} Cash Slip</span>
                </>
              )}
            </>
          )}
        </button>
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
        donorName={isAnonymous ? 'Anonymous' : (donorName.trim() || 'Valued Donor')}
        donorPhone={donorPhone.trim() || undefined}
        donorVeng={donorSection.trim() || undefined}
        memberId={selectedMember?.id}
        subId={selectedPayerType !== 'primary' ? selectedPayerType : undefined}
        isDependent={selectedPayerType !== 'primary'}
        isAnonymous={isAnonymous}
        remark={remark.trim() || undefined}
        subcatAmounts={category === 'kumtluang' ? subcatAmounts : undefined}
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
        donorName={isAnonymous ? 'Anonymous' : (donorName.trim() || 'Valued Donor')}
        donorPhone={donorPhone.trim() || undefined}
        donorVeng={donorSection.trim() || undefined}
        memberId={selectedMember?.id}
        subId={selectedPayerType !== 'primary' ? selectedPayerType : undefined}
        isDependent={selectedPayerType !== 'primary'}
        isAnonymous={isAnonymous}
        remark={remark.trim() || undefined}
        subcatAmounts={category === 'kumtluang' ? subcatAmounts : undefined}
        periodType={category === 'kumtluang' ? periodType : undefined}
        periodMonth={category === 'kumtluang' ? selectedMonth : undefined}
        periodYear={category === 'kumtluang' ? selectedYear : undefined}
        periodLabel={category === 'kumtluang' ? periodLabel : undefined}
        onPaymentSuccess={(transaction) => {
          setIsUPICheckoutOpen(false);
          onPaymentSuccess(transaction);
        }}
      />

      {/* PhonePe PG New Tab Waiting Overlay with Live Sync */}
      {isRedirectingToPhonePe && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex flex-col items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-purple-100 flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-[#5f259f] text-white flex items-center justify-center font-black text-3xl shadow-lg mb-4 shadow-purple-900/25">
              पे
            </div>
            
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-100 text-purple-800 text-[11px] font-bold uppercase tracking-wider mb-2.5">
              <Zap className="w-3.5 h-3.5 text-purple-600" />
              <span>PhonePe PG (UAT) • New Tab</span>
            </div>
            
            <h3 className="text-xl font-black text-slate-900 mb-1.5">
              PhonePe Gateway New Tab-ah a inhawng e
            </h3>
            
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              New Tab-a PhonePe checkout portal ah khan payment ti zo la, i tih zawh veleh helai hmunah hian Official Receipt a lo lang nghal ang.
            </p>

            <div className="w-full bg-slate-50 rounded-2xl p-4 border border-slate-100 mb-5 text-left text-xs space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Pawisa Pek Tur (Total):</span>
                <span className="font-extrabold text-slate-900 text-sm">₹{totalPayable.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Transaction ID:</span>
                <span className="font-mono text-[11px] text-purple-700 font-semibold truncate max-w-[180px]">
                  {activePendingTxn?.id || 'RPAY_TXN_...'}
                </span>
              </div>
              <div className="flex justify-between items-center pt-1.5 border-t border-slate-200/70">
                <span className="text-slate-500">Gateway Status:</span>
                <span className="inline-flex items-center gap-1.5 text-amber-600 font-semibold text-[11px]">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  <span>A nghak mek (Waiting for payment)...</span>
                </span>
              </div>
            </div>

            <div className="w-full space-y-2.5">
              {phonePeRedirectUrl ? (
                <a
                  href={phonePeRedirectUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3.5 px-4 rounded-xl bg-[#5f259f] hover:bg-[#511e89] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-purple-900/20 transition cursor-pointer"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>New Tab-ah PhonePe Hawng Rawh (Re-open Tab)</span>
                </a>
              ) : (
                <div className="flex items-center justify-center gap-2 text-purple-700 font-semibold text-xs py-2 bg-purple-50 rounded-xl border border-purple-100">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>PhonePe Session a in-generate mek...</span>
                </div>
              )}

              {/* PhonePe verification feedback alert */}
              {phonePeVerifyMsg && (
                <div
                  className={`w-full p-3.5 rounded-2xl text-xs font-medium flex items-start gap-2.5 transition text-left animate-in fade-in duration-150 ${
                    phonePeVerifyMsg.type === 'error'
                      ? 'bg-rose-50 border border-rose-200 text-rose-800'
                      : phonePeVerifyMsg.type === 'pending'
                      ? 'bg-amber-50 border border-amber-200 text-amber-900'
                      : 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                  }`}
                >
                  <div className="shrink-0 mt-0.5">
                    {phonePeVerifyMsg.type === 'error' ? (
                      <AlertCircle className="w-4 h-4 text-rose-600" />
                    ) : phonePeVerifyMsg.type === 'pending' ? (
                      <Clock className="w-4 h-4 text-amber-600" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    )}
                  </div>
                  <div className="flex-1 leading-relaxed">
                    {phonePeVerifyMsg.text}
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={async () => {
                  if (!activePendingTxn) return;
                  setIsVerifyingInMainTab(true);
                  setPhonePeVerifyMsg(null);
                  try {
                    const r = await fetch(`/api/phonepe/status/${encodeURIComponent(activePendingTxn.id)}`);
                    const d = await r.json();

                    const isSuccess =
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

                    if (isSuccess) {
                      setPhonePeVerifyMsg({
                        type: 'success',
                        text: 'PhonePe Gateway atangin payment a hlawhtling e! Receipt kan buatsaih mek e...'
                      });
                      const finalTx: Transaction = {
                        ...activePendingTxn,
                        status: 'completed',
                        referenceNo: d?.data?.transactionId || d?.data?.paymentInstrument?.utr || activePendingTxn.referenceNo,
                        utr: d?.data?.paymentInstrument?.utr || activePendingTxn.utr
                      };
                      saveTransaction(finalTx);
                      setTimeout(() => {
                        setIsRedirectingToPhonePe(false);
                        setIsProcessing(false);
                        onPaymentSuccess(finalTx);
                      }, 600);
                    } else if (isFailed) {
                      setIsRedirectingToPhonePe(false);
                      setIsProcessing(false);
                      if (activePendingTxn) {
                        const failedTx: Transaction = {
                          ...activePendingTxn,
                          status: 'failed',
                        };
                        if (onPaymentFailure) {
                          onPaymentFailure(failedTx, d?.data?.detailedErrorCode || d?.data?.errorCode || 'PhonePe atangin payment a hlawhtling lo (Failed / Cancelled).');
                          return;
                        }
                      }
                      setPhonePeVerifyMsg({
                        type: 'error',
                        text: 'PhonePe atangin payment a hlawhtling lo (Failed / Cancelled). Khawngaihin a hnuai lamah "Kalsan rih rawh" hmetin i ti tha leh dawn nia.'
                      });
                    } else {
                      // Status is still PENDING: User has NOT completed payment on mercury-uat
                      setPhonePeVerifyMsg({
                        type: 'pending',
                        text: 'PhonePe atangin payment confirmation a la thleng lo (Status: A la pending mek). Khawngaihin New Tab-a PhonePe portal ah khan payment ti zo phawt la, chumi hnuah "Payment ka ti zo tawh e" hi hmet nawn leh rawh le.'
                      });
                    }
                  } catch (e) {
                    setPhonePeVerifyMsg({
                      type: 'error',
                      text: 'PhonePe status check a buai rih deuh. Internet connection enfiah la, PhonePe page ah khan payment a tlang tawh ngei em check nawn leh rawh le.'
                    });
                  } finally {
                    setIsVerifyingInMainTab(false);
                  }
                }}
                disabled={isVerifyingInMainTab}
                className="w-full py-3 px-4 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
              >
                {isVerifyingInMainTab ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                )}
                <span>Payment ka ti zo tawh e (Receipt En Rawh)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsRedirectingToPhonePe(false);
                  setIsProcessing(false);
                  setPhonePeVerifyMsg(null);
                }}
                className="w-full py-2 text-xs font-semibold text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                Kalsan rih rawh (Cancel)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
