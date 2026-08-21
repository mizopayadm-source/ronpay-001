import React, { useState, useEffect } from 'react';
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
  Save
} from 'lucide-react';
import { BawmCategory, Campaign, PaymentMethod, Transaction, SystemPricingConfig, MemberRecord, MemberDependent } from '../types';
import { BAWM_CONFIG, DEFAULT_PRICING_CONFIG } from '../data/initialData';
import { formatDateDDMMYYYY, formatDateTimeDDMMYYYY, isCampaignExpired } from '../utils/date';
import { Language, TRANSLATIONS, translateDynamicText } from '../utils/translations';
import { getMembers, addOrUpdateMember } from '../utils/storage';

interface CheckoutScreenProps {
  category: BawmCategory;
  campaign?: Campaign;
  pricingConfig?: SystemPricingConfig;
  onBack: () => void;
  onPaymentSuccess: (transaction: Transaction) => void;
  onCashPending: (transaction: Transaction) => void;
  onOpenPhonePePortal?: () => void;
  onPreviewImage?: (imageUrl: string, title?: string, subtitle?: string, location?: string) => void;
  language?: Language;
}

export const CheckoutScreen: React.FC<CheckoutScreenProps> = ({
  category,
  campaign,
  pricingConfig = DEFAULT_PRICING_CONFIG,
  onBack,
  onPaymentSuccess,
  onCashPending,
  onOpenPhonePePortal,
  onPreviewImage,
  language = 'mizo',
}) => {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('online');
  const [standardAmount, setStandardAmount] = useState<number>(500);
  const [donorName, setDonorName] = useState<string>('');
  const [remark, setRemark] = useState<string>('');
  const [isAnonymous, setIsAnonymous] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [phonePeStatus, setPhonePeStatus] = useState<'IDLE' | 'CALLING_PG' | 'SUCCESS'>('IDLE');

  // Kumtluang Member & Family Sub-ID State
  const [donorPhone, setDonorPhone] = useState<string>('');
  const [donorSection, setDonorSection] = useState<string>('Bial 1 (Vengchhak)');
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

  // Kumtluang period & frequency selection
  const [periodType, setPeriodType] = useState<'monthly' | 'quarterly' | 'yearly'>('monthly');
  const [selectedMonth, setSelectedMonth] = useState<string>('August');
  const [selectedQuarter, setSelectedQuarter] = useState<string>('Q3 (Jul - Sep)');
  const [selectedYear, setSelectedYear] = useState<string>('2026');

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
    ? `${selectedMonth} ${selectedYear}`
    : periodType === 'quarterly'
    ? `${selectedQuarter} ${selectedYear}`
    : `${selectedYear} (Kumtluan)`;

  // Derive Org Code helper
  const deriveOrgCode = (orgName?: string, title?: string): string => {
    const text = (orgName || title || 'KOHHRAN').toUpperCase();
    if (text.includes('EBENEZER') || text.includes('EBE')) return 'EBE';
    if (text.includes('BCM')) return 'BCM';
    if (text.includes('YMA')) return 'YMA';
    if (text.includes('SYNOD')) return 'SYN';
    if (text.includes('CHANMARI')) return 'CHM';
    if (text.includes('BUNGKAWN')) return 'BKN';
    if (text.includes('DAWRPUI')) return 'DWP';
    if (text.includes('ZOTLANG')) return 'ZTL';
    if (text.includes('RAMHLUN')) return 'RMH';
    const clean = text.replace(/[^A-Z]/g, '');
    return clean.substring(0, 3) || 'MEM';
  };

  // Initialize subcategories from campaign & Auto-load default member for Kumtluang
  useEffect(() => {
    if (category === 'kumtluang') {
      if (campaign?.subCategories && campaign.subCategories.length > 0) {
        const initialMap: { [key: string]: number } = {};
        campaign.subCategories.forEach((cat, idx) => {
          initialMap[cat] = (idx + 1) * 100;
        });
        setSubcatAmounts(initialMap);
      }

      // Auto-load member from local storage if available
      const allMembers = getMembers();
      if (allMembers.length > 0 && !selectedMember && !donorName) {
        const defaultM = allMembers[0];
        setSelectedMember(defaultM);
        setDonorName(defaultM.name);
        setDonorPhone(defaultM.fullPhone || `943614${defaultM.phoneLast4}`);
        setDonorSection(defaultM.section || 'Section A');
        setPhoneSearchQuery(defaultM.phoneLast4);
        setSelectedPayerType('primary');
      }
    }
  }, [category, campaign]);

  const handlePhoneSearch = (query: string) => {
    setPhoneSearchQuery(query);
    const cleanQ = query.trim();
    if (!cleanQ) {
      setSelectedMember(null);
      setIsNewMemberMode(false);
      return;
    }
    const allMembers = getMembers();
    const match = allMembers.find(m => 
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

  const handleQuickRegisterSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newRegName.trim()) {
      alert('Khawngaihin Member Hming chhu lut rawh le.');
      return;
    }
    const cleanPhone = newRegPhone.replace(/\D/g, '');
    const phoneLast4 = cleanPhone.length >= 4 ? cleanPhone.slice(-4) : Math.floor(1000 + Math.random() * 9000).toString();
    const orgCode = deriveOrgCode(campaign?.orgName, campaign?.title);
    const newId = `${orgCode}-${phoneLast4}`;

    const sectionToUse = isCustomSection 
      ? (customSectionText.trim() || 'General') 
      : (newRegSection || 'General');

    const newMember: MemberRecord = {
      id: newId,
      name: newRegName.trim(),
      orgCode: orgCode,
      phoneLast4: phoneLast4,
      fullPhone: cleanPhone || `943600${phoneLast4}`,
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

  if (paymentMethod === 'online') {
    if (isFreeTrial) {
      feeRatePercent = 0;
      fixedFee = 0;
    } else if (category === 'kumtluang' && campaign?.trxnFeeBearer === 'org_paid') {
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

  const platformFee = Math.round((subtotal * (feeRatePercent / 100)) + fixedFee);
  const totalPayable = subtotal + platformFee;

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

    setIsProcessing(true);

    if (paymentMethod === 'online') {
      setPhonePeStatus('CALLING_PG');

      setTimeout(() => {
        setPhonePeStatus('SUCCESS');

        setTimeout(() => {
          const transaction: Transaction = {
            id: 'RPAY-' + Math.floor(100000 + Math.random() * 900000),
            campaignId: campaign?.id || `cmp-${category}-custom`,
            campaignTitle: campaign?.title || (category === 'ralna' ? 'Ralna Bawm' : config.name),
            category: category,
            donorName: isAnonymous ? 'Anonymous' : (donorName.trim() || 'Valued Donor'),
            donorPhone: donorPhone.trim() || undefined,
            donorVeng: donorSection.trim() || undefined,
            memberId: category === 'kumtluang' && selectedMember ? selectedMember.id : undefined,
            subId: category === 'kumtluang' && selectedPayerType !== 'primary' ? selectedPayerType : undefined,
            isDependent: category === 'kumtluang' && selectedPayerType !== 'primary',
            isAnonymous: isAnonymous,
            amount: subtotal,
            platformFee: platformFee,
            totalAmount: totalPayable,
            paymentMethod: 'online',
            status: 'completed',
            remark: remark.trim() || undefined,
            subCategoryBreakdown: category === 'kumtluang' ? subcatAmounts : undefined,
            periodType: category === 'kumtluang' ? periodType : undefined,
            periodLabel: category === 'kumtluang' ? periodLabel : undefined,
            timestamp: new Date().toISOString(),
            txHash: 'UPI' + Math.random().toString(36).substring(2, 12).toUpperCase(),
          };

          setIsProcessing(false);
          onPaymentSuccess(transaction);
        }, 900);
      }, 1200);
    } else {
      // Cash payment
      const transaction: Transaction = {
        id: 'RPAY-CASH-' + Math.floor(100000 + Math.random() * 900000),
        campaignId: campaign?.id || `cmp-${category}-custom`,
        campaignTitle: campaign?.title || (category === 'ralna' ? 'Ralna Bawm' : config.name),
        category: category,
        donorName: isAnonymous ? 'Anonymous' : (donorName.trim() || 'Valued Donor'),
        donorPhone: donorPhone.trim() || undefined,
        donorVeng: donorSection.trim() || undefined,
        memberId: category === 'kumtluang' && selectedMember ? selectedMember.id : undefined,
        subId: category === 'kumtluang' && selectedPayerType !== 'primary' ? selectedPayerType : undefined,
        isDependent: category === 'kumtluang' && selectedPayerType !== 'primary',
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
    <div className="space-y-4 pb-6">
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
                {campaign?.mitthiHming || campaign?.title || 'Pi Lalhmingliani'}
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
                {translateDynamicText(campaign?.title || 'Hnuchham Pual Donation', language)}
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
            <p className="text-[11px] text-slate-600 bg-emerald-50/60 p-2.5 rounded-xl border border-emerald-100 font-medium">
              {translateDynamicText(campaign?.cause || 'Naupang apute tanpui leh ei & bar chawmna fund vawmchhohna pual a ni e.', language)}
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
                {translateDynamicText(campaign?.emergencyTitle || campaign?.title || 'Kangmei Relief Support', language)}
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
              <p className="text-[11px] text-slate-700 bg-rose-50/60 p-2.5 rounded-xl border border-rose-100 font-medium">
                {translateDynamicText(campaign.cause, language)}
              </p>
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
                {campaign?.orgName || campaign?.title || 'BCM Ebenezer, Zobawk'}
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
              ) : null}
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
                      {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map(m => (
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
                    {['2025', '2026', '2027', '2028'].map(yr => (
                      <option key={yr} value={yr}>{yr} {periodType === 'yearly' ? '(Kumtluan)' : ''}</option>
                    ))}
                  </select>
                </div>
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
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs space-y-3">
          <h4 className="text-[11px] font-black text-slate-700 uppercase tracking-wider">
            Payment Mode (Online UPI / Direct Cash)
          </h4>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => setPaymentMethod('online')}
              className={`p-3 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between ${
                paymentMethod === 'online'
                  ? 'bg-indigo-50/80 border-indigo-600 shadow-xs text-indigo-950'
                  : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700'
              }`}
            >
              <div className="flex justify-between items-center mb-2">
                <CreditCard className="w-5 h-5 text-indigo-600" />
                {paymentMethod === 'online' && <CheckCircle2 className="w-4 h-4 text-indigo-600" />}
              </div>
              <div>
                <p className="font-extrabold text-xs">Online UPI / PG</p>
                <p className="text-[9.5px] text-slate-500 mt-0.5">GPay, PhonePe, Paytm, Cards</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setPaymentMethod('cash')}
              className={`p-3 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between ${
                paymentMethod === 'cash'
                  ? 'bg-amber-50/80 border-amber-600 shadow-xs text-amber-950'
                  : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700'
              }`}
            >
              <div className="flex justify-between items-center mb-2">
                <Banknote className="w-5 h-5 text-amber-600" />
                {paymentMethod === 'cash' && <CheckCircle2 className="w-4 h-4 text-amber-600" />}
              </div>
              <div>
                <p className="font-extrabold text-xs">Cash Pekna</p>
                <p className="text-[9.5px] text-slate-500 mt-0.5">Treasurer hnenah pek tur (Slip)</p>
              </div>
            </button>
          </div>
        </div>

        {/* Bill Summary Breakdown */}
        <div className="bg-slate-900 text-white p-4 rounded-2xl space-y-2 text-xs shadow-md">
          <div className="flex justify-between text-slate-300 font-medium">
            <span>Donation Subtotal:</span>
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

          <div className="border-t border-slate-800 pt-2 flex justify-between items-center text-sm font-black">
            <span>Grand Total Payable:</span>
            <span className="font-mono text-emerald-400 text-base">₹{totalPayable.toLocaleString('en-IN')}</span>
          </div>

          {paymentMethod === 'cash' ? (
            <p className="text-[10px] text-slate-300 italic pt-1.5 border-t border-slate-800/80 leading-relaxed">
              * Cash a pek hian Platform Fee a ngai lo (₹0.00).
            </p>
          ) : (
            <p className="text-[10px] text-slate-300 italic pt-1.5 border-t border-slate-800/80 leading-relaxed">
              * Online payment (UPI/PG) ah hian Platform Settlement Fee (1%) chhut tel a ni.
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
              : paymentMethod === 'online'
              ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600'
              : 'bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600'
          }`}
        >
          {isProcessing ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              {paymentMethod === 'online' ? 'Connecting UPI Gateway...' : 'Recording Cash Entry...'}
            </>
          ) : isExpired ? (
            <>
              <AlertCircle className="w-4 h-4 text-rose-400" />
              <span>Pek Theih Hun a Tawp Tawh (Expired)</span>
            </>
          ) : (
            <>
              {paymentMethod === 'online' ? <Zap className="w-4 h-4 text-amber-300" /> : <Banknote className="w-4 h-4" />}
              {paymentMethod === 'online' ? `Pay ₹${totalPayable.toLocaleString('en-IN')} via UPI` : `Submit ₹${subtotal.toLocaleString('en-IN')} Cash Slip`}
            </>
          )}
        </button>
      </form>
    </div>
  );
};
