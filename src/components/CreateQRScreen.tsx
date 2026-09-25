import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  ArrowUpRight, 
  Ribbon, 
  HandHeart, 
  AlertTriangle,
  AlertCircle,
  Infinity as InfinityIcon, 
  Upload, 
  Image as ImageIcon, 
  MapPin, 
  Crosshair, 
  ExternalLink, 
  Receipt, 
  Lock, 
  QrCode,
  Plus,
  Trash2,
  CheckCircle2,
  Calendar,
  Sparkles,
  LogOut,
  Edit3,
  Check,
  X,
  Eye,
  SlidersHorizontal,
  FileSpreadsheet,
  Clock,
  CheckCircle,
  XCircle,
  HelpCircle,
  Megaphone,
  Target,
  TrendingUp,
  Users,
  UserPlus,
  CreditCard,
  Printer,
  RefreshCw,
  Globe,
  Loader2,
  Download,
  Save,
  Sliders
} from 'lucide-react';
import { BawmCategory, Campaign, CreatorProfile, SystemPricingConfig, Transaction, AnnouncementBanner, SectionQuickPreset } from '../types';
import { AnnouncementBannerCard } from './AnnouncementBannerCard';
import { BAWM_CONFIG, DEFAULT_PRICING_CONFIG } from '../data/initialData';
import { Language, translateTextViaApi, formatMizoTextToEnglish, translateCampaignTitle } from '../utils/translations';
import { formatDateDDMMYYYY, formatDateTimeDDMMYYYY, isCampaignExpired, getCreatorExpiryStatus, getTodayDateTimeLocal } from '../utils/date';
import { isPrefixCodeTaken, suggestAlternativePrefixes, derivePrefixFromText, migrateCampaignMembersPrefix, isCampaignCreator, isConfirmedTransaction, getStoredSectionPresets, saveStoredSectionPresets } from '../utils/storage';
import { downloadSampleExcelTemplate } from '../utils/excelMemberImporter';
import { getUserRole } from '../utils/rbac';
import { TrialWarningBanner } from './TrialWarningBanner';
import { compressImageFile } from '../utils/imageCompressor';
import { SectionPresetManagerModal } from './SectionPresetManagerModal';

interface CreateQRScreenProps {
  onBack: () => void;
  onOpenUpgradeModal: () => void;
  creatorProfile: CreatorProfile;
  pricingConfig?: SystemPricingConfig;
  announcement?: AnnouncementBanner;
  onGenerateQR: (campaign: Campaign) => void;
  onLogout?: () => void;
  onSwitchAccount?: () => void;
  campaigns?: Campaign[];
  transactions?: Transaction[];
  onUpdateCampaign?: (campaign: Campaign) => void;
  onDeleteCampaign?: (campaignId: string, reason?: string) => void;
  onSelectCampaign?: (campaign: Campaign) => void;
  onUpdateCreatorProfile?: (updated: CreatorProfile) => void;
  onOpenMemberRoll?: (tab?: 'quick_entry' | 'register_member' | 'members_list' | 'print_reports') => void;
  onOpenAdminDashboard?: () => void;
  onPreviewImage?: (url: string, title?: string) => void;
  language?: Language;
}

export const CreateQRScreen: React.FC<CreateQRScreenProps> = ({
  onBack,
  onOpenUpgradeModal,
  creatorProfile,
  pricingConfig = DEFAULT_PRICING_CONFIG,
  announcement,
  onGenerateQR,
  onLogout,
  onSwitchAccount,
  campaigns = [],
  transactions = [],
  onUpdateCampaign,
  onDeleteCampaign,
  onSelectCampaign,
  onUpdateCreatorProfile,
  onOpenMemberRoll,
}) => {
  // Creator Profile Editing State
  const [isEditingCreatorProfile, setIsEditingCreatorProfile] = useState<boolean>(false);
  const [editCreatorName, setEditCreatorName] = useState<string>(creatorProfile.name || '');
  const [editCreatorOrg, setEditCreatorOrg] = useState<string>(creatorProfile.orgName || '');
  const [editCreatorDesignation, setEditCreatorDesignation] = useState<string>(creatorProfile.designation || '');
  const [profileSuccessNotice, setProfileSuccessNotice] = useState<boolean>(false);

  useEffect(() => {
    setEditCreatorName(creatorProfile.name || '');
    setEditCreatorOrg(creatorProfile.orgName || '');
    setEditCreatorDesignation(creatorProfile.designation || '');
  }, [creatorProfile.name, creatorProfile.orgName, creatorProfile.designation]);

  // Navigation Tabs: Create New QR vs Manage Created QRs
  const [activeTab, setActiveTab] = useState<'create' | 'manage'>('create');
  const [manageFilter, setManageFilter] = useState<string>('all');
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [deletingCampaign, setDeletingCampaign] = useState<Campaign | null>(null);
  const [deleteReasonText, setDeleteReasonText] = useState<string>('');

  // Default to first approved category or ralna
  const [selectedCategory, setSelectedCategory] = useState<BawmCategory>(
    creatorProfile.approvedCategories[0] || 'ralna'
  );

  // Common fields
  const [upiId, setUpiId] = useState<string>('');
  const [gpsCoords, setGpsCoords] = useState<string>('');
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);

  // Ralna fields
  const [ralnaMitthiHming, setRalnaMitthiHming] = useState<string>('');
  const [ralnaAge, setRalnaAge] = useState<string>('');
  const [ralnaVeng, setRalnaVeng] = useState<string>('');
  const [ralnaThihni, setRalnaThihni] = useState<string>(() => getTodayDateTimeLocal(6, 0, 0));
  const [ralnaVuiHun, setRalnaVuiHun] = useState<string>(() => getTodayDateTimeLocal(13, 0, 0));
  const [ralnaVuitu, setRalnaVuitu] = useState<string>('');
  const [ralnaValidity, setRalnaValidity] = useState<string>(() => getTodayDateTimeLocal(23, 59, 0));

  // Khawlsak fields (Now includes Cause and Location)
  const [khawlsakTitle, setKhawlsakTitle] = useState<string>('');
  const [khawlsakLocation, setKhawlsakLocation] = useState<string>('');
  const [khawlsakCause, setKhawlsakCause] = useState<string>('');
  const [khawlsakTarget, setKhawlsakTarget] = useState<string>('');
  const [khawlsakMax, setKhawlsakMax] = useState<string>('');
  const [khawlsakValidity, setKhawlsakValidity] = useState<string>(() => getTodayDateTimeLocal(23, 59, 0));

  // Rikrum fields (Now includes Cause and Location)
  const [rikrumTitle, setRikrumTitle] = useState<string>('');
  const [rikrumLocation, setRikrumLocation] = useState<string>('');
  const [rikrumCause, setRikrumCause] = useState<string>('');
  const [rikrumTarget, setRikrumTarget] = useState<string>('');
  const [rikrumMax, setRikrumMax] = useState<string>('');
  const [rikrumDeadline, setRikrumDeadline] = useState<string>(() => getTodayDateTimeLocal(23, 59, 0));
  const [rikrumValidity, setRikrumValidity] = useState<string>(() => getTodayDateTimeLocal(23, 59, 0));

  // Kumtluang fields
  const [kumtluangOrg, setKumtluangOrg] = useState<string>('');
  const [kumtluangVeng, setKumtluangVeng] = useState<string>('');
  const [prefixCode, setPrefixCode] = useState<string>('');
  const [prefixUserEdited, setPrefixUserEdited] = useState<boolean>(false);
  const [kumtluangSubcats, setKumtluangSubcats] = useState<string[]>([]);
  const [newSubcatName, setNewSubcatName] = useState<string>('');
  const [kumtluangSectionLabel, setKumtluangSectionLabel] = useState<string>('Bial / Unit');
  const [kumtluangSections, setKumtluangSections] = useState<string[]>([
    'Bial 1 (Vengchhak)', 'Bial 2 (Vengthlang)', 'Bial 3 (Venglai)', 'Bial 4 (Field Veng)', 'General / Khawchhung'
  ]);
  const [newSectionName, setNewSectionName] = useState<string>('');
  const [kumtluangTarget, setKumtluangTarget] = useState<string>('');
  const [kumtluangTargetPeriod, setKumtluangTargetPeriod] = useState<'monthly' | 'yearly' | 'total'>('monthly');
  const [kumtluangValidity, setKumtluangValidity] = useState<string>(() => getTodayDateTimeLocal(23, 59, 0));
  const [kumtluangFeeBearer, setKumtluangFeeBearer] = useState<'user_paid' | 'org_paid'>('user_paid');

  // Quick Presets State & Synchronization
  const [sectionPresets, setSectionPresets] = useState<SectionQuickPreset[]>(() => getStoredSectionPresets());
  const [isPresetManagerOpen, setIsPresetManagerOpen] = useState<boolean>(false);

  useEffect(() => {
    const handlePresetsUpdate = () => {
      setSectionPresets(getStoredSectionPresets());
    };
    window.addEventListener('ronpay_section_presets_updated', handlePresetsUpdate);
    return () => window.removeEventListener('ronpay_section_presets_updated', handlePresetsUpdate);
  }, []);

  // Auto-suggest unique prefix when org name changes if user hasn't explicitly edited
  useEffect(() => {
    if (!prefixUserEdited && kumtluangOrg.trim().length >= 2) {
      const derived = derivePrefixFromText(kumtluangOrg);
      if (isPrefixCodeTaken(derived)) {
        const alts = suggestAlternativePrefixes(kumtluangOrg);
        if (alts.length > 0) {
          setPrefixCode(alts[0]);
        } else {
          setPrefixCode(derived);
        }
      } else {
        setPrefixCode(derived);
      }
    }
  }, [kumtluangOrg, prefixUserEdited]);

  const userRole = getUserRole(creatorProfile);
  const isPrivilegedUser = Boolean(
    creatorProfile?.isAdmin === true || 
    userRole === 'SUPER_ADMIN' || 
    userRole === 'ADMIN' || 
    userRole === 'MODERATOR'
  );

  // Filter creator's campaigns strictly to what THIS creator individually created (Privileged users see all)
  const myCampaigns = isPrivilegedUser
    ? campaigns.filter(c => c.id !== 'cmp-kumtluang-ymavt')
    : campaigns.filter(c => isCampaignCreator(c, creatorProfile));

  const displayedCampaigns = myCampaigns.filter(c => {
    if (manageFilter === 'all') return true;
    return c.category === manageFilter;
  });

  // Dynamic Pricing Calculation for Selected Category & Creator
  const currentFeeRule = pricingConfig?.categories?.[selectedCategory] || DEFAULT_PRICING_CONFIG.categories[selectedCategory];
  const rawCreationCharge = currentFeeRule?.qrCreationCharge ?? 0;

  // Check dynamic per-creator trial expiration
  const nowTime = Date.now();
  const trialExpTime = creatorProfile.trialExpiresAt ? new Date(creatorProfile.trialExpiresAt).getTime() : 0;
  const isTrialActiveByDate = creatorProfile.isFreeServiceGranted || (trialExpTime > nowTime);

  // Check per-creator post quota
  const totalQuota = creatorProfile.freePostsQuota ?? 10;
  const usedQuota = creatorProfile.freePostsUsed ?? creatorProfile.createdQRsCount ?? 0;
  const remainingQuota = Math.max(0, totalQuota - usedQuota);
  const hasRemainingQuota = remainingQuota > 0;

  // Check per-creator category override if present
  const categoryOverride = creatorProfile.categoryCustomOverrides?.[selectedCategory];
  const isCategoryOverriddenFree = categoryOverride?.isFree;

  const isFreeTrial = isCategoryOverriddenFree || currentFeeRule?.isFreeTrialActive || isTrialActiveByDate || hasRemainingQuota || creatorProfile.isFreeServiceGranted;
  const actualCreationCharge = isFreeTrial ? 0 : rawCreationCharge;

  const allCategories: { 
    key: BawmCategory; 
    name: string; 
    icon: any; 
    color: string;
    iconColor: string;
    iconBg: string;
    selectedBorder: string;
    selectedIconBg: string;
    selectedCheck: string;
  }[] = [
    { 
      key: 'ralna', 
      name: 'Ralna Bawm', 
      icon: Ribbon, 
      color: 'rose',
      iconColor: 'text-rose-600',
      iconBg: 'bg-rose-100 border border-rose-200',
      selectedBorder: 'border-rose-500 bg-rose-50/70 ring-2 ring-rose-400/30',
      selectedIconBg: 'bg-rose-600 text-white shadow-xs',
      selectedCheck: 'text-rose-600'
    },
    { 
      key: 'khawlsak', 
      name: 'Khawlsak Bawm', 
      icon: HandHeart, 
      color: 'emerald',
      iconColor: 'text-emerald-600',
      iconBg: 'bg-emerald-100 border border-emerald-200',
      selectedBorder: 'border-emerald-500 bg-emerald-50/70 ring-2 ring-emerald-400/30',
      selectedIconBg: 'bg-emerald-600 text-white shadow-xs',
      selectedCheck: 'text-emerald-600'
    },
    { 
      key: 'rikrum', 
      name: 'Rikrum Bawm', 
      icon: AlertTriangle, 
      color: 'amber',
      iconColor: 'text-amber-600',
      iconBg: 'bg-amber-100 border border-amber-200',
      selectedBorder: 'border-amber-500 bg-amber-50/70 ring-2 ring-amber-400/30',
      selectedIconBg: 'bg-amber-500 text-white shadow-xs',
      selectedCheck: 'text-amber-600'
    },
    { 
      key: 'kumtluang', 
      name: 'Kumtluang Bawm', 
      icon: InfinityIcon, 
      color: 'indigo',
      iconColor: 'text-indigo-600',
      iconBg: 'bg-indigo-100 border border-indigo-200',
      selectedBorder: 'border-indigo-600 bg-indigo-50/70 ring-2 ring-indigo-400/30',
      selectedIconBg: 'bg-indigo-600 text-white shadow-xs',
      selectedCheck: 'text-indigo-600'
    },
  ];

  const handleCategorySelect = (catKey: BawmCategory) => {
    if (!creatorProfile.approvedCategories.includes(catKey)) {
      alert(`⚠️ He bawm (${BAWM_CONFIG[catKey].name}) hi i Creator registration-ah a la tel ve lo. I category neih chin chauh hman theih a ni e. Upgrade Menu hmangin i belh thei ang.`);
      return;
    }
    setSelectedCategory(catKey);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      try {
        const compressed = await compressImageFile(file, 400, 400, 0.8);
        setImagePreviewUrl(compressed);
      } catch (err) {
        console.warn('Image compression fallback:', err);
        const reader = new FileReader();
        reader.onload = (event) => {
          setImagePreviewUrl(event.target?.result as string);
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const handleDetectGPS = () => {
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude.toFixed(6);
          const lng = pos.coords.longitude.toFixed(6);
          const accuracy = Math.round(pos.coords.accuracy || 0);
          setGpsCoords(`${lat}, ${lng}`);
          alert(`📍 Live GPS dik tak hmuh a ni ta!\nCoordinates: ${lat}, ${lng}\nAccuracy: ~${accuracy} meters.`);
        },
        (err) => {
          // Fallback if satellite GPS is slow indoors, try network location
          navigator.geolocation.getCurrentPosition(
            (pos2) => {
              const lat = pos2.coords.latitude.toFixed(5);
              const lng = pos2.coords.longitude.toFixed(5);
              setGpsCoords(`${lat}, ${lng}`);
              alert(`📍 Location hmuh a ni e (Network/Cell): ${lat}, ${lng}`);
            },
            () => {
              setGpsCoords("23.7271, 92.7176");
              alert("📍 GPS signal a hmuh theih rih loh avangin Aizawl standard coordinates (23.7271, 92.7176) a set rih a ni e. Manual-in i thlak thei e.");
            },
            { enableHighAccuracy: false, timeout: 8000, maximumAge: 30000 }
          );
        },
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
      );
    } else {
      alert("⚠️ Geolocation hi i browser/device-in a support lo.");
    }
  };

  const openGoogleMaps = () => {
    window.open(`https://www.google.com/maps?q=${encodeURIComponent(gpsCoords)}`, '_blank');
  };

  const handleAddSubcategory = () => {
    if (newSubcatName.trim()) {
      setKumtluangSubcats([...kumtluangSubcats, newSubcatName.trim()]);
      setNewSubcatName('');
    }
  };

  const handleRemoveSubcategory = (index: number) => {
    setKumtluangSubcats(kumtluangSubcats.filter((_, i) => i !== index));
  };

  const handleToggleStatus = (camp: Campaign) => {
    if (!onUpdateCampaign) return;
    const isCurrentlyExpired = camp.status === 'expired' || isCampaignExpired(camp.validityDate, camp.status);
    
    if (!isCurrentlyExpired && camp.status === 'active') {
      // 1. Creator marking active campaign as Expired (Allowed directly)
      const updated: Campaign = { ...camp, status: 'expired', updatedAt: new Date().toISOString() };
      onUpdateCampaign(updated);
      alert(`⏸️ "${camp.title}" chu Expired (Closed) a dah a ni ta e.\nSum chhunluh theih a ni tawh rih lo ang.`);
    } else {
      // 2. Reactivating an expired campaign requires Admin approval!
      const now = new Date();
      now.setDate(now.getDate() + 30);
      const updated: Campaign = {
        ...camp,
        status: 'pending_approval',
        validityDate: now.toISOString(),
        approvalRemarks: 'Reactivation requested by creator',
        updatedAt: new Date().toISOString()
      };
      onUpdateCampaign(updated);
      alert(`📩 Reactivation Request Admin hnenah thawn a ni e!\n\nPost hi Admin-in an approve hnuah chauh Active a ni leh ang.`);
    }
  };

  const handleGenerateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!creatorProfile.isApproved) {
      alert('⚠️ I Creator Account hi Admin Approval nghah mek a ni a. Admin-in an approve hma chuan Post leh QR Code thar siam theih a ni rih lo.');
      return;
    }

    if (creatorProfile.isBlocked) {
      alert('⚠️ I Creator Account hi Admin-in a block rih avangin Post/QR thar i siam thei rih lo.');
      return;
    }

    if (!upiId.trim()) {
      alert('Khawngaihin Settlement UPI ID chhu lut hmasa rawh!');
      return;
    }

    let title = '';
    let location = 'Aizawl, Mizoram';
    let cause: string | undefined = undefined;
    let causeEn: string | undefined = undefined;

    if (selectedCategory === 'ralna') {
      if (!ralnaMitthiHming.trim()) {
        alert('Khawngaihin Mitthi Hming chhu lut rawh!');
        return;
      }
      title = `${ralnaMitthiHming.trim()} Ralna`;
      location = ralnaVeng.trim() || 'Aizawl, Mizoram';
    } else if (selectedCategory === 'khawlsak') {
      if (!khawlsakTitle.trim()) {
        alert('Khawngaihin Campaign Title chhu lut rawh!');
        return;
      }
      if (!khawlsakCause.trim()) {
        alert('Khawngaihin Khawlsak Chhan / Causes chhu lut rawh!');
        return;
      }
      title = khawlsakTitle.trim();
      location = khawlsakLocation.trim() || 'Aizawl, Mizoram';
      cause = khawlsakCause.trim();
      try {
        causeEn = await translateTextViaApi(cause, 'khawlsak', 'english');
      } catch {
        // Handled dynamically on view
      }
    } else if (selectedCategory === 'rikrum') {
      if (!rikrumTitle.trim()) {
        alert('Khawngaihin Emergency Title chhu lut rawh!');
        return;
      }
      if (!rikrumCause.trim()) {
        alert('Khawngaihin Rikrum thlen Chhan ziak rawh!');
        return;
      }
      title = rikrumTitle.trim();
      location = rikrumLocation.trim() || 'Aizawl, Mizoram';
      cause = rikrumCause.trim();
      try {
        causeEn = await translateTextViaApi(cause, 'rikrum', 'english');
      } catch {
        // Handled dynamically on view
      }
    } else if (selectedCategory === 'kumtluang') {
      if (!kumtluangOrg.trim()) {
        alert('Khawngaihin Org / Kohhran Hming chhu lut rawh!');
        return;
      }
      title = `${kumtluangOrg.trim()}, ${kumtluangVeng.trim()}`;
      location = kumtluangVeng.trim() || 'Aizawl, Mizoram';
    }

    // System-wide Unique Prefix Code Enforcement
    const derivedPrefix = prefixCode.trim() 
      ? prefixCode.trim().toUpperCase() 
      : derivePrefixFromText(selectedCategory === 'kumtluang' ? kumtluangOrg : title);

    if (isPrefixCodeTaken(derivedPrefix)) {
      const suggestions = suggestAlternativePrefixes(derivedPrefix);
      alert(`⚠️ Prefix Code "${derivedPrefix}" hi Bawm dangin an hmang tawh a ni (Already Taken)!\n\nKhawngaihin prefix dang thlang rawh le:\n${suggestions.join(', ')}`);
      return;
    }

    // Derive bilingual title and cause representations
    const titleMizo = title;
    const titleEn = formatMizoTextToEnglish(title);

    let emergencyTitleMizo: string | undefined = undefined;
    let emergencyTitleEn: string | undefined = undefined;
    if (selectedCategory === 'rikrum' && rikrumTitle.trim()) {
      emergencyTitleMizo = rikrumTitle.trim();
      emergencyTitleEn = formatMizoTextToEnglish(rikrumTitle.trim());
    }

    const finalCauseEn = causeEn || (cause ? formatMizoTextToEnglish(cause) : undefined);

    const newCampaign: Campaign = {
      id: 'cmp-' + Date.now(),
      category: selectedCategory,
      title: title,
      titleMizo: titleMizo,
      titleEn: titleEn,
      location: location,
      gpsCoords: gpsCoords,
      upiId: upiId.trim(),
      imageUrl: imagePreviewUrl || undefined,
      validityDate: selectedCategory === 'ralna' ? ralnaValidity :
                    selectedCategory === 'khawlsak' ? khawlsakValidity :
                    selectedCategory === 'rikrum' ? rikrumValidity : kumtluangValidity,
      status: 'pending_approval',
      createdAt: new Date().toISOString(),
      createdBy: creatorProfile.phone || creatorProfile.name,
      orgCode: derivedPrefix,

      // Specifics
      mitthiHming: selectedCategory === 'ralna' ? ralnaMitthiHming : undefined,
      age: selectedCategory === 'ralna' ? parseInt(ralnaAge) || 74 : undefined,
      thihni: selectedCategory === 'ralna' ? ralnaThihni : undefined,
      vuiHun: selectedCategory === 'ralna' ? ralnaVuiHun : undefined,
      vuitu: selectedCategory === 'ralna' ? ralnaVuitu : undefined,
      
      cause: cause,
      causeEn: finalCauseEn,
      causeMizo: cause,
      targetAmount: selectedCategory === 'khawlsak' && khawlsakTarget ? parseFloat(khawlsakTarget) : 
                    selectedCategory === 'rikrum' && rikrumTarget ? parseFloat(rikrumTarget) : 
                    selectedCategory === 'kumtluang' && kumtluangTarget ? parseFloat(kumtluangTarget) : undefined,
      targetPeriod: selectedCategory === 'khawlsak' ? (khawlsakTarget ? 'total' : undefined) :
                    selectedCategory === 'rikrum' ? (rikrumTarget ? 'total' : undefined) :
                    selectedCategory === 'kumtluang' ? (kumtluangTarget ? kumtluangTargetPeriod : undefined) : undefined,
      maxLimit: selectedCategory === 'khawlsak' ? parseFloat(khawlsakMax) : (selectedCategory === 'rikrum' ? parseFloat(rikrumMax) : undefined),

      emergencyTitle: selectedCategory === 'rikrum' ? rikrumTitle : undefined,
      emergencyTitleMizo: emergencyTitleMizo,
      emergencyTitleEn: emergencyTitleEn,
      urgencyLevel: 'URGENT',
      urgencyDeadline: selectedCategory === 'rikrum' ? rikrumDeadline : undefined,

      orgName: selectedCategory === 'kumtluang' ? kumtluangOrg : undefined,
      subCategories: selectedCategory === 'kumtluang' ? kumtluangSubcats : undefined,
      trxnFeeBearer: selectedCategory === 'kumtluang' ? kumtluangFeeBearer : undefined,
      sectionLabel: selectedCategory === 'kumtluang' ? kumtluangSectionLabel : undefined,
      definedSections: selectedCategory === 'kumtluang' ? kumtluangSections : undefined,

      // Fee Option Policy: Inherit creator default, system default, or ADD_ON
      feeOptionRule: creatorProfile.defaultFeeOptionRule || pricingConfig?.defaultFeeOptionRule || 'ADD_ON',

      // Per-Creator Category Rate Overrides (e.g. Mr A Ralna=0%, Rikrum=0.5%)
      customPlatformFeePercent: creatorProfile.categoryCustomOverrides?.[selectedCategory]?.platformFeePercent !== undefined
        ? creatorProfile.categoryCustomOverrides[selectedCategory]?.platformFeePercent
        : creatorProfile.customPlatformFeePercent,
      customFreeTrialActive: creatorProfile.categoryCustomOverrides?.[selectedCategory]?.isTrialActive !== undefined
        ? creatorProfile.categoryCustomOverrides[selectedCategory]?.isTrialActive
        : undefined,
    };

    onGenerateQR(newCampaign);
  };

  return (
    <div className="space-y-4 pb-1 animate-fadeIn">
      {/* Top Header */}
      <div className="flex justify-between items-center border-b border-slate-200/80 pb-3">
        <button
          onClick={onBack}
          className="text-xs text-indigo-600 font-bold flex items-center gap-1.5 hover:text-indigo-800 transition cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Home
        </button>

        <div className="flex items-center gap-1.5 flex-wrap">
          {onSwitchAccount && (
            <button
              type="button"
              onClick={onSwitchAccount}
              className="text-[10px] bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold px-2 py-1 rounded-lg border border-indigo-200 transition cursor-pointer flex items-center gap-1 shadow-2xs"
              title="Test Creator dang thlang rawh"
            >
              <Sparkles className="w-3 h-3 text-indigo-600" /> Switch
            </button>
          )}
          <button
            type="button"
            onClick={onOpenUpgradeModal}
            className="text-[10px] font-bold px-2 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs flex items-center gap-1 transition cursor-pointer"
          >
            <ArrowUpRight className="w-3.5 h-3.5" /> Upgrade
          </button>
          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              className="text-[10px] bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-600 font-bold px-2 py-1 rounded-lg border border-slate-200 hover:border-rose-200 transition cursor-pointer flex items-center gap-1"
            >
              <LogOut className="w-3 h-3 text-rose-500" /> Logout
            </button>
          )}
        </div>
      </div>

      {/* Creator Logged-In Badge */}
      {(() => {
        const expiryInfo = getCreatorExpiryStatus(creatorProfile, pricingConfig.globalTrialDays);
        return (
          <div className="bg-slate-900 text-white p-3.5 rounded-2xl border border-slate-800 shadow-md space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-400 to-amber-500 text-slate-950 font-black flex items-center justify-center text-sm shadow-xs shrink-0">
                  {creatorProfile.name ? creatorProfile.name.charAt(0).toUpperCase() : 'C'}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-black text-xs text-white truncate">
                      {creatorProfile.name || 'Verified Creator'}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setEditCreatorName(creatorProfile.name || '');
                        setEditCreatorOrg(creatorProfile.orgName || '');
                        setEditCreatorDesignation(creatorProfile.designation || '');
                        setIsEditingCreatorProfile(true);
                      }}
                      className="p-1 rounded-md bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-400/30 text-[10px] font-bold flex items-center gap-1 cursor-pointer transition shadow-2xs"
                      title="Edit Creator Name & Details"
                    >
                      <Edit3 className="w-2.5 h-2.5" /> Hming Thlak
                    </button>
                    <span className="text-[8.5px] bg-emerald-500/20 text-emerald-300 font-extrabold px-1.5 py-0.5 rounded border border-emerald-500/40 uppercase">
                      {creatorProfile.designation || 'Creator'}
                    </span>
                    {creatorProfile.isFreeServiceGranted && (
                      <span className="text-[8.5px] bg-purple-500/30 text-purple-300 font-extrabold px-1.5 py-0.5 rounded border border-purple-400/40 uppercase">
                        VIP Free
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 truncate">
                    {creatorProfile.orgName || 'Mizoram Branch'} • {creatorProfile.phone || '9862300000'}
                  </p>
                </div>
              </div>

              <div className="text-right shrink-0">
                <span className="text-[9px] text-slate-400 block font-semibold">Approved</span>
                <span className="text-xs font-black text-amber-400">
                  {creatorProfile.approvedCategories.length} / 4 Bawm
                </span>
              </div>
            </div>

            {/* Plan / Trial Validity Status Pill */}
            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between flex-wrap gap-2 text-[10px]">
              <div className="flex items-center gap-1.5 text-slate-400">
                <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                <span>{expiryInfo.planTypeLabel}:</span>
                <b className="text-slate-200">{expiryInfo.formattedExpiryDate}</b>
              </div>

              <div>
                {expiryInfo.isPermanentFree ? (
                  <span className="bg-purple-950 text-purple-300 border border-purple-800/80 font-bold px-2 py-0.5 rounded-full text-[9.5px]">
                    Lifetime Active
                  </span>
                ) : expiryInfo.isExpired ? (
                  <span className="bg-rose-950 text-rose-300 border border-rose-800 font-black px-2 py-0.5 rounded-full text-[9.5px] animate-pulse">
                    🚫 Expired
                  </span>
                ) : expiryInfo.isExpiringSoon ? (
                  <span className="bg-amber-950 text-amber-300 border border-amber-700/90 font-black px-2 py-0.5 rounded-full text-[9.5px] animate-pulse flex items-center gap-1">
                    <Clock className="w-2.5 h-2.5" /> {expiryInfo.daysRemaining}d Left (Expiring)
                  </span>
                ) : (
                  <span className="bg-emerald-950 text-emerald-300 border border-emerald-800 font-bold px-2 py-0.5 rounded-full text-[9.5px]">
                    ✓ Active ({expiryInfo.daysRemaining}d left)
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Pending Registration Approval Alert Banner */}
      {!creatorProfile.isApproved && (
        <div className="bg-amber-50 border-2 border-amber-400 p-4 rounded-2xl shadow-xs space-y-1.5 text-amber-950 animate-pulse">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-amber-600 text-white rounded-xl">
              <Clock className="w-4 h-4" />
            </span>
            <h4 className="text-xs font-black uppercase text-amber-900">Creator Account Approval Nghah Mek A Ni</h4>
          </div>
          <p className="text-xs font-medium text-amber-900 leading-snug">
            I Creator Account registration hi Admin-in a check a, a approve hma chuan Post leh QR Code thar i siam thei rih lo ang. Admin approval a fel veleh hman theih a ni ang.
          </p>
        </div>
      )}

      {/* Blocked Creator Warning Alert Banner (Request 6) */}
      {creatorProfile.isBlocked && (
        <div className="bg-rose-50 border-2 border-rose-400 p-4 rounded-2xl shadow-xs space-y-1 text-rose-950">
          <div className="flex items-center gap-2">
            <span className="p-1.5 bg-rose-600 text-white rounded-xl">
              <AlertTriangle className="w-4 h-4" />
            </span>
            <h4 className="text-xs font-black uppercase text-rose-900">Creator Account Blocked</h4>
          </div>
          <p className="text-xs font-medium text-rose-800 leading-snug">
            I Creator Account hi Admin-in a block rih avangin Post leh QR Code thar siam theih a ni rih lo. Khawngaihin Admin be rawh.
          </p>
        </div>
      )}

      {/* Trial / Subscription Expiring Warning Notification Banner */}
      <TrialWarningBanner
        creatorProfile={creatorProfile}
        pricingConfig={pricingConfig}
        onOpenUpgradeModal={onOpenUpgradeModal}
      />

      {/* Segment Switcher: Create QR vs My Created QRs Manager */}
      <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-2xl border border-slate-200 text-xs font-bold">
        <button
          type="button"
          onClick={() => setActiveTab('create')}
          className={`py-2.5 px-3 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === 'create'
              ? 'bg-white text-indigo-950 shadow-sm font-black'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Plus className="w-4 h-4 text-indigo-600" />
          <span>Create QR Thar</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('manage')}
          className={`py-2.5 px-3 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer ${
            activeTab === 'manage'
              ? 'bg-white text-indigo-950 shadow-sm font-black'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Edit3 className="w-4 h-4 text-emerald-600" />
          <span>Ka QR Siam Te ({myCampaigns.length})</span>
        </button>
      </div>

      {/* TAB 1: CREATE NEW QR FORM */}
      {activeTab === 'create' && (
        <form onSubmit={handleGenerateSubmit} className="space-y-4">
          {/* 1. Category Selection Grid */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="text-[11px] font-extrabold text-slate-800 uppercase tracking-wider">
                1. Thlan Tur Bawm Category *
              </label>
              <span className="text-[10px] text-slate-500 font-medium">Click category to select</span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {allCategories.map((cat) => {
                const Icon = cat.icon;
                const isSelected = selectedCategory === cat.key;
                const isAllowed = creatorProfile.approvedCategories.includes(cat.key);

                return (
                  <button
                    key={cat.key}
                    type="button"
                    onClick={() => handleCategorySelect(cat.key)}
                    className={`relative p-3 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between min-h-[105px] h-auto gap-2 shadow-xs ${
                      isSelected
                        ? cat.selectedBorder
                        : isAllowed
                        ? 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
                        : 'border-slate-200/60 bg-slate-50/80 opacity-60'
                    }`}
                  >
                    <div className="flex justify-between items-start w-full">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
                        isSelected 
                          ? cat.selectedIconBg 
                          : isAllowed 
                          ? `${cat.iconBg} ${cat.iconColor}`
                          : 'bg-slate-200 text-slate-400'
                      }`}>
                        <Icon className="w-4.5 h-4.5" />
                      </div>
                      
                      {!isAllowed && (
                        <span className="text-[8.5px] bg-slate-200 text-slate-600 font-extrabold px-1.5 py-0.5 rounded flex items-center gap-0.5">
                          <Lock className="w-2.5 h-2.5" /> Locked
                        </span>
                      )}
                      {isSelected && (
                        <div className={`w-5 h-5 rounded-full ${cat.selectedIconBg} flex items-center justify-center text-white shadow-xs`}>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        </div>
                      )}
                    </div>

                    <div className="mt-1">
                      <span className="font-black text-xs text-slate-900 block leading-tight">
                        {cat.name}
                      </span>
                      <span className="text-[9.5px] text-slate-500 font-medium block leading-tight mt-0.5">
                        {BAWM_CONFIG[cat.key]?.subtitle || 'Standard Category'}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Dynamic Rate, Trial Period & Discount Info Banner */}
            {(() => {
              const rule = pricingConfig?.categories[selectedCategory] || DEFAULT_PRICING_CONFIG.categories[selectedCategory];
              if (!rule) return null;

              const isFreeTrial = rule.isFreeTrialActive || creatorProfile.isFreeServiceGranted;
              const hasCreatorDiscount = (creatorProfile.customDiscountPercent ?? 0) > 0;
              const discountPct = hasCreatorDiscount ? creatorProfile.customDiscountPercent! : rule.discountPercent;

              return (
                <div className="bg-slate-900 text-white p-3 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs border border-slate-800 shadow-xs mt-2">
                  <div className="flex items-center gap-2">
                    <span className="text-amber-400 font-black text-[11px] flex items-center gap-1 shrink-0">
                      <Sparkles className="w-3.5 h-3.5" /> Rate & Trial:
                    </span>
                    <span className="text-slate-300 text-[11px]">
                      {isFreeTrial ? (
                        <b className="text-emerald-400 font-black">100% Free Service Active (₹0 QR Charge • 0% Fee)</b>
                      ) : (
                        <>
                          TSP Fee: <b className="text-amber-300">{rule.platformFeePercent}%</b> • QR Siam: <b className="text-white">{rule.qrCreationCharge === 0 ? 'Free' : `₹${rule.qrCreationCharge}`}</b>
                          {discountPct > 0 && <span className="text-rose-300 ml-1 font-bold">({discountPct}% Discount Applied)</span>}
                        </>
                      )}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                    <span className="text-[10px] bg-slate-800 text-slate-300 font-bold px-2 py-0.5 rounded-full border border-slate-700">
                      📅 {rule.trialPeriodDays} Days Trial
                    </span>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* 2. Settlement Bank / UPI ID */}
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-xs space-y-1.5">
            <label className="text-[10.5px] font-extrabold text-slate-800 uppercase tracking-wider block">
              2. Settlement UPI ID (Pawisa Luhna Tur) *
            </label>
            <input
              type="text"
              required
              value={upiId}
              onChange={(e) => setUpiId(e.target.value)}
              placeholder="e.g. bungkawn.yma@okaxis / church.trust@sbi"
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold text-slate-900 text-xs focus:outline-none focus:bg-white focus:border-indigo-600"
            />
            <p className="text-[9.5px] text-slate-500 font-medium">
              Donation pawisa lut reng reng hi he UPI VPA / Account-ah hian direct-in a lut ang.
            </p>
          </div>

          {/* 3. Image Upload */}
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-xs space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-[10.5px] font-extrabold text-slate-800 uppercase tracking-wider">
                3. Thlalak / Official Poster (Optional)
              </label>
              {imagePreviewUrl && (
                <button
                  type="button"
                  onClick={() => setImagePreviewUrl(null)}
                  className="text-[10px] text-rose-600 font-bold hover:underline"
                >
                  Remove Photo
                </button>
              )}
            </div>

            <div className="flex gap-3 items-center">
              {imagePreviewUrl ? (
                <img
                  src={imagePreviewUrl}
                  alt="Preview"
                  className="w-14 h-14 rounded-xl object-cover border border-slate-200 shadow-xs"
                />
              ) : (
                <div className="w-14 h-14 rounded-xl bg-slate-100 border border-dashed border-slate-300 flex items-center justify-center text-slate-400">
                  <ImageIcon className="w-6 h-6" />
                </div>
              )}

              <label className="flex-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl p-2.5 text-center cursor-pointer transition">
                <span className="text-xs font-bold text-indigo-600 flex items-center justify-center gap-1.5">
                  <Upload className="w-3.5 h-3.5" /> Thlalak Thlang Rawh
                </span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* 4. Category-Specific Fields */}
          {selectedCategory === 'ralna' && (
            <div className="space-y-3 p-3.5 rounded-2xl bg-purple-50/50 border border-purple-200">
              <div className="flex items-center gap-1.5 text-purple-900 font-extrabold text-[11px] uppercase border-b border-purple-200 pb-1">
                <Ribbon className="w-3.5 h-3.5" /> Ralna Bawm (Chhiatni) Details
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="text-[10.5px] font-bold text-slate-700 block mb-1">Mitthi Hming *</label>
                  <input
                    type="text"
                    required
                    value={ralnaMitthiHming}
                    onChange={(e) => setRalnaMitthiHming(e.target.value)}
                    placeholder="e.g. Pi Lallianpuii"
                    className="w-full bg-white border border-slate-300 rounded-xl p-2 font-bold text-slate-900 focus:outline-none focus:border-purple-600 text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10.5px] font-bold text-slate-700 block mb-1">Kum (Age)</label>
                  <input
                    type="number"
                    value={ralnaAge}
                    onChange={(e) => setRalnaAge(e.target.value)}
                    placeholder="74"
                    className="w-full bg-white border border-slate-300 rounded-xl p-2 font-bold text-slate-900 focus:outline-none focus:border-purple-600 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10.5px] font-bold text-slate-700 block mb-1">Veng / Khua *</label>
                <input
                  type="text"
                  required
                  value={ralnaVeng}
                  onChange={(e) => setRalnaVeng(e.target.value)}
                  placeholder="e.g. Bungkawn, Aizawl"
                  className="w-full bg-white border border-slate-300 rounded-xl p-2 font-bold text-slate-900 focus:outline-none focus:border-purple-600 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[10.5px] font-bold text-slate-700">Thihni & Darkar *</label>
                    <span className="text-[9px] text-purple-700 font-extrabold bg-purple-50 px-1.5 py-0.2 rounded border border-purple-200">Vawiin</span>
                  </div>
                  <input
                    type="datetime-local"
                    value={ralnaThihni}
                    onChange={(e) => setRalnaThihni(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl p-2 font-bold text-slate-900 text-[10px] focus:outline-none focus:border-purple-600"
                  />
                  <div className="flex items-center gap-1 mt-1 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setRalnaThihni(getTodayDateTimeLocal(6, 0, 0))}
                      className="text-[8.5px] bg-purple-100 hover:bg-purple-200 text-purple-900 font-bold px-1.5 py-0.5 rounded cursor-pointer transition"
                    >
                      📅 Vawiin Zing (6 AM)
                    </button>
                    <button
                      type="button"
                      onClick={() => setRalnaThihni(getTodayDateTimeLocal(18, 0, 0))}
                      className="text-[8.5px] bg-purple-50 hover:bg-purple-100 text-purple-800 font-semibold px-1.5 py-0.5 rounded cursor-pointer transition"
                    >
                      Vawiin Tlai (6 PM)
                    </button>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[10.5px] font-bold text-slate-700">Vui Hun *</label>
                    <span className="text-[9px] text-purple-700 font-extrabold bg-purple-50 px-1.5 py-0.2 rounded border border-purple-200">Vawiin</span>
                  </div>
                  <input
                    type="datetime-local"
                    value={ralnaVuiHun}
                    onChange={(e) => setRalnaVuiHun(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl p-2 font-bold text-slate-900 text-[10px] focus:outline-none focus:border-purple-600"
                  />
                  <div className="flex items-center gap-1 mt-1 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setRalnaVuiHun(getTodayDateTimeLocal(13, 0, 0))}
                      className="text-[8.5px] bg-purple-100 hover:bg-purple-200 text-purple-900 font-bold px-1.5 py-0.5 rounded cursor-pointer transition"
                    >
                      📅 Vawiin (1 PM)
                    </button>
                    <button
                      type="button"
                      onClick={() => setRalnaVuiHun(getTodayDateTimeLocal(13, 0, 1))}
                      className="text-[8.5px] bg-purple-50 hover:bg-purple-100 text-purple-800 font-semibold px-1.5 py-0.5 rounded cursor-pointer transition"
                    >
                      Naktuk (1 PM)
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[10.5px] font-bold text-slate-700 block mb-1">Vuitu Pastor / Leader *</label>
                <input
                  type="text"
                  value={ralnaVuitu}
                  onChange={(e) => setRalnaVuitu(e.target.value)}
                  placeholder="e.g. Rev. Dr. C. Lalramnghaka"
                  className="w-full bg-white border border-slate-300 rounded-xl p-2 font-bold text-slate-900 focus:outline-none focus:border-purple-600 text-xs"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[10.5px] font-bold text-slate-700">
                    QR Hman Theih Hun (QR Validity Date/Time) *
                  </label>
                  <span className="text-[9.5px] text-purple-700 font-bold">Default: Vawiin (Today)</span>
                </div>
                <input
                  type="datetime-local"
                  value={ralnaValidity}
                  onChange={(e) => setRalnaValidity(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl p-2 font-bold text-slate-900 text-[10px] focus:outline-none focus:border-purple-600"
                />
                <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                  <span className="text-[9px] text-slate-400 font-bold">Quick Set:</span>
                  <button
                    type="button"
                    onClick={() => setRalnaValidity(getTodayDateTimeLocal(23, 59, 0))}
                    className="text-[9.5px] bg-purple-100 hover:bg-purple-200 text-purple-900 font-bold px-2 py-0.5 rounded-md cursor-pointer transition"
                  >
                    📅 Vawiin (Today)
                  </button>
                  <button
                    type="button"
                    onClick={() => setRalnaValidity(getTodayDateTimeLocal(23, 59, 7))}
                    className="text-[9.5px] bg-purple-50 hover:bg-purple-100 text-purple-800 font-semibold px-2 py-0.5 rounded-md cursor-pointer transition"
                  >
                    +7 Ni
                  </button>
                  <button
                    type="button"
                    onClick={() => setRalnaValidity(getTodayDateTimeLocal(23, 59, 30))}
                    className="text-[9.5px] bg-purple-50 hover:bg-purple-100 text-purple-800 font-semibold px-2 py-0.5 rounded-md cursor-pointer transition"
                  >
                    +30 Ni
                  </button>
                  <button
                    type="button"
                    onClick={() => setRalnaValidity(getTodayDateTimeLocal(23, 59, 365))}
                    className="text-[9.5px] bg-purple-50 hover:bg-purple-100 text-purple-800 font-semibold px-2 py-0.5 rounded-md cursor-pointer transition"
                  >
                    +1 Kum
                  </button>
                </div>
              </div>
            </div>
          )}

          {selectedCategory === 'khawlsak' && (
            <div className="space-y-3 p-3.5 rounded-2xl bg-emerald-50/50 border border-emerald-200">
              <div className="flex items-center gap-1.5 text-emerald-900 font-extrabold text-[11px] uppercase border-b border-emerald-200 pb-1">
                <HandHeart className="w-3.5 h-3.5" /> Khawlsak Bawm Details
              </div>

              <div>
                <label className="text-[10.5px] font-bold text-slate-700 block mb-1">
                  Campaign Title / Khawlsak Tur *
                </label>
                <input
                  type="text"
                  required
                  value={khawlsakTitle}
                  onChange={(e) => setKhawlsakTitle(e.target.value)}
                  placeholder="e.g. Hnuchham Naupang Zirna Leh Chawmna Pual"
                  className="w-full bg-white border border-slate-300 rounded-xl p-2 font-bold text-slate-900 focus:outline-none focus:border-emerald-600 text-xs"
                />
              </div>

              <div>
                <label className="text-[10.5px] font-bold text-slate-700 block mb-1">
                  Veng / Khua / Location *
                </label>
                <input
                  type="text"
                  required
                  value={khawlsakLocation}
                  onChange={(e) => setKhawlsakLocation(e.target.value)}
                  placeholder="e.g. Dawrpui, Aizawl, Mizoram"
                  className="w-full bg-white border border-slate-300 rounded-xl p-2 font-bold text-slate-900 focus:outline-none focus:border-emerald-600 text-xs"
                />
              </div>

              <div>
                <label className="text-[10.5px] font-bold text-slate-700 block mb-1">
                  Khawlsak Chhan / Causes (Detailed Purpose) *
                </label>
                <textarea
                  required
                  rows={2}
                  value={khawlsakCause}
                  onChange={(e) => setKhawlsakCause(e.target.value)}
                  placeholder="e.g. Hnuchham naupang lehkha zirna senso, damdawi leh nitin mamawh chawmna fund vawmchhohna pual a ni e."
                  className="w-full bg-white border border-slate-300 rounded-xl p-2 font-medium text-slate-900 focus:outline-none focus:border-emerald-600 text-xs leading-relaxed"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10.5px] font-bold text-slate-700 block mb-1">Target Amount (₹)</label>
                  <input
                    type="number"
                    value={khawlsakTarget}
                    onChange={(e) => setKhawlsakTarget(e.target.value)}
                    placeholder="50000"
                    className="w-full bg-white border border-slate-300 rounded-xl p-2 font-bold text-slate-900 focus:outline-none focus:border-emerald-600 text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10.5px] font-bold text-slate-700 block mb-1">Max Limit / Donor (₹)</label>
                  <input
                    type="number"
                    value={khawlsakMax}
                    onChange={(e) => setKhawlsakMax(e.target.value)}
                    placeholder="100000"
                    className="w-full bg-white border border-slate-300 rounded-xl p-2 font-bold text-slate-900 focus:outline-none focus:border-emerald-600 text-xs"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[10.5px] font-bold text-slate-700">
                    QR Hman Theih Hun (QR Validity Date/Time) *
                  </label>
                  <span className="text-[9.5px] text-emerald-700 font-bold">Default: Vawiin (Today)</span>
                </div>
                <input
                  type="datetime-local"
                  value={khawlsakValidity}
                  onChange={(e) => setKhawlsakValidity(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl p-2 font-bold text-slate-900 text-[10px] focus:outline-none focus:border-emerald-600"
                />
                <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                  <span className="text-[9px] text-slate-400 font-bold">Quick Set:</span>
                  <button
                    type="button"
                    onClick={() => setKhawlsakValidity(getTodayDateTimeLocal(23, 59, 0))}
                    className="text-[9.5px] bg-emerald-100 hover:bg-emerald-200 text-emerald-950 font-bold px-2 py-0.5 rounded-md cursor-pointer transition"
                  >
                    📅 Vawiin (Today)
                  </button>
                  <button
                    type="button"
                    onClick={() => setKhawlsakValidity(getTodayDateTimeLocal(23, 59, 7))}
                    className="text-[9.5px] bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded-md cursor-pointer transition"
                  >
                    +7 Ni
                  </button>
                  <button
                    type="button"
                    onClick={() => setKhawlsakValidity(getTodayDateTimeLocal(23, 59, 30))}
                    className="text-[9.5px] bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded-md cursor-pointer transition"
                  >
                    +30 Ni
                  </button>
                  <button
                    type="button"
                    onClick={() => setKhawlsakValidity(getTodayDateTimeLocal(23, 59, 365))}
                    className="text-[9.5px] bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded-md cursor-pointer transition"
                  >
                    +1 Kum
                  </button>
                </div>
              </div>
            </div>
          )}

          {selectedCategory === 'rikrum' && (
            <div className="space-y-3 p-3.5 rounded-2xl bg-rose-50/50 border border-rose-200">
              <div className="flex items-center gap-1.5 text-rose-900 font-extrabold text-[11px] uppercase border-b border-rose-200 pb-1">
                <AlertTriangle className="w-3.5 h-3.5" /> Rikrum Bawm (Emergency) Details
              </div>

              <div>
                <label className="text-[10.5px] font-bold text-slate-700 block mb-1">
                  Emergency Title / Rikrum Hming *
                </label>
                <input
                  type="text"
                  required
                  value={rikrumTitle}
                  onChange={(e) => setRikrumTitle(e.target.value)}
                  placeholder="e.g. Kangmei Chhiatna Tuartu Tanpuina / Leimin Chhiatna"
                  className="w-full bg-white border border-slate-300 rounded-xl p-2 font-bold text-slate-900 focus:outline-none focus:border-rose-600 text-xs"
                />
              </div>

              <div>
                <label className="text-[10.5px] font-bold text-slate-700 block mb-1">
                  Veng / Khua / Location *
                </label>
                <input
                  type="text"
                  required
                  value={rikrumLocation}
                  onChange={(e) => setRikrumLocation(e.target.value)}
                  placeholder="e.g. Laipuitlang, Aizawl, Mizoram"
                  className="w-full bg-white border border-slate-300 rounded-xl p-2 font-bold text-slate-900 focus:outline-none focus:border-rose-600 text-xs"
                />
              </div>

              <div>
                <label className="text-[10.5px] font-bold text-slate-700 block mb-1">
                  Rikrum thlen Chhan / Emergency Cause & Description *
                </label>
                <textarea
                  required
                  rows={2}
                  value={rikrumCause}
                  onChange={(e) => setRikrumCause(e.target.value)}
                  placeholder="e.g. Zankhuaa ruahtui tla nasa avangin in 4 a chim a, chhungkaw 18 chhiat tawk te tanpui nan."
                  className="w-full bg-white border border-slate-300 rounded-xl p-2 font-medium text-slate-900 focus:outline-none focus:border-rose-600 text-xs leading-relaxed"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10.5px] font-bold text-slate-700 block mb-1">Target Amount (₹)</label>
                  <input
                    type="number"
                    value={rikrumTarget}
                    onChange={(e) => setRikrumTarget(e.target.value)}
                    placeholder="100000"
                    className="w-full bg-white border border-slate-300 rounded-xl p-2 font-bold text-slate-900 focus:outline-none focus:border-rose-600 text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10.5px] font-bold text-slate-700 block mb-1">Max Limit (₹)</label>
                  <input
                    type="number"
                    value={rikrumMax}
                    onChange={(e) => setRikrumMax(e.target.value)}
                    placeholder="500000"
                    className="w-full bg-white border border-slate-300 rounded-xl p-2 font-bold text-slate-900 focus:outline-none focus:border-rose-600 text-xs"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[10.5px] font-bold text-slate-700">
                    Pek Theih Hun Chhung / Active Deadline & Validity *
                  </label>
                  <span className="text-[9.5px] text-rose-700 font-bold">Default: Vawiin (Today)</span>
                </div>
                <input
                  type="datetime-local"
                  required
                  value={rikrumValidity}
                  onChange={(e) => {
                    setRikrumValidity(e.target.value);
                    setRikrumDeadline(e.target.value);
                  }}
                  className="w-full bg-white border border-slate-300 rounded-xl p-2 font-bold text-slate-900 text-xs focus:outline-none focus:border-rose-600"
                />
                {rikrumValidity && (
                  <div className="flex items-center justify-between text-[9.5px] text-rose-700 font-semibold px-0.5 mt-0.5">
                    <span>Ni thlan: <b className="font-bold text-rose-950">{formatDateTimeDDMMYYYY(rikrumValidity)}</b></span>
                    <span className="text-[9px] text-slate-400 font-mono">(DD/MM/YYYY)</span>
                  </div>
                )}
                <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                  <span className="text-[9px] text-slate-400 font-bold">Quick Set:</span>
                  <button
                    type="button"
                    onClick={() => {
                      const todayStr = getTodayDateTimeLocal(23, 59, 0);
                      setRikrumValidity(todayStr);
                      setRikrumDeadline(todayStr);
                    }}
                    className="text-[9.5px] bg-rose-100 hover:bg-rose-200 text-rose-950 font-bold px-2 py-0.5 rounded-md cursor-pointer transition"
                  >
                    📅 Vawiin (Today)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const str = getTodayDateTimeLocal(23, 59, 3);
                      setRikrumValidity(str);
                      setRikrumDeadline(str);
                    }}
                    className="text-[9.5px] bg-rose-50 hover:bg-rose-100 text-rose-800 font-semibold px-2 py-0.5 rounded-md cursor-pointer transition"
                  >
                    +3 Ni
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const str = getTodayDateTimeLocal(23, 59, 7);
                      setRikrumValidity(str);
                      setRikrumDeadline(str);
                    }}
                    className="text-[9.5px] bg-rose-50 hover:bg-rose-100 text-rose-800 font-semibold px-2 py-0.5 rounded-md cursor-pointer transition"
                  >
                    +7 Ni
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const str = getTodayDateTimeLocal(23, 59, 30);
                      setRikrumValidity(str);
                      setRikrumDeadline(str);
                    }}
                    className="text-[9.5px] bg-rose-50 hover:bg-rose-100 text-rose-800 font-semibold px-2 py-0.5 rounded-md cursor-pointer transition"
                  >
                    +30 Ni
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  He deadline thlen hian QR hi automatic-in a expire ang a, sum pek theih a ni tawh lo ang.
                </p>
              </div>
            </div>
          )}

          {selectedCategory === 'kumtluang' && (
            <div className="space-y-3 p-3.5 rounded-2xl bg-blue-50/50 border border-blue-200">
              <div className="flex items-center justify-between border-b border-blue-200 pb-1.5 flex-wrap gap-2">
                <div className="flex items-center gap-1.5 text-blue-900 font-extrabold text-[11px] uppercase">
                  <InfinityIcon className="w-3.5 h-3.5" /> Kumtluang Bawm Details & Member Roll
                </div>
                {onOpenMemberRoll && (
                  <button
                    type="button"
                    onClick={() => onOpenMemberRoll('members_list')}
                    className="text-[10px] bg-blue-600 hover:bg-blue-700 text-white font-bold px-2 py-0.5 rounded-lg transition cursor-pointer flex items-center gap-1 shadow-xs"
                  >
                    <Users className="w-3 h-3" /> Open Member Roll
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10.5px] font-bold text-slate-700 block mb-1">Church / NGO Name *</label>
                  <input
                    type="text"
                    required
                    value={kumtluangOrg}
                    onChange={(e) => setKumtluangOrg(e.target.value)}
                    placeholder="e.g. BCM Ebenezer"
                    className="w-full bg-white border border-slate-300 rounded-xl p-2 font-bold text-slate-900 focus:outline-none focus:border-blue-600 text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10.5px] font-bold text-slate-700 block mb-1">Veng / Khua / Dist *</label>
                  <input
                    type="text"
                    value={kumtluangVeng}
                    onChange={(e) => setKumtluangVeng(e.target.value)}
                    placeholder="e.g. Zobawk, Lunglei"
                    className="w-full bg-white border border-slate-300 rounded-xl p-2 font-bold text-slate-900 focus:outline-none focus:border-blue-600 text-xs"
                  />
                </div>
              </div>

              {/* System-wide Unique Prefix Code Setting */}
              <div className="bg-white p-3 rounded-2xl border border-blue-200 space-y-2 overflow-hidden">
                <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-1">
                  <label className="text-[10.5px] font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <QrCode className="w-3.5 h-3.5 text-blue-600 shrink-0" /> 
                    <span>Bawm Prefix Code *</span>
                  </label>
                  <span className="text-[10px] font-bold text-slate-500 truncate">
                    Sample: <span className="font-mono text-blue-600 font-black">{(prefixCode || 'BET').toUpperCase()}-7890</span>
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                  <input
                    type="text"
                    maxLength={6}
                    value={prefixCode}
                    onChange={(e) => {
                      setPrefixUserEdited(true);
                      setPrefixCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''));
                    }}
                    placeholder="e.g. BET"
                    className={`w-full sm:w-28 bg-slate-50 border-2 rounded-xl p-2 font-mono font-black text-center text-xs tracking-wider uppercase focus:outline-none ${
                      prefixCode.trim() && isPrefixCodeTaken(prefixCode.trim())
                        ? 'border-rose-500 text-rose-700 bg-rose-50'
                        : prefixCode.trim()
                        ? 'border-emerald-500 text-emerald-700 bg-emerald-50'
                        : 'border-slate-300 text-slate-900 focus:border-blue-500'
                    }`}
                  />
                  <div className="flex-1 text-[11px] leading-tight">
                    {!prefixCode.trim() ? (
                      <span className="text-slate-500 font-medium">Bawm tana unique prefix code (hawrawp 3-4) chhu lut rawh le.</span>
                    ) : isPrefixCodeTaken(prefixCode.trim()) ? (
                      <div className="text-rose-600 font-bold flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>Already Taken! Bawm dangin he prefix hi an hmang tawh.</span>
                      </div>
                    ) : (
                      <div className="text-emerald-700 font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        <span>Unique & Available! Hemi Bawm pual liau liauvin a lock ang.</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Quick Sync / Re-derive from Org Name button */}
                <div className="flex flex-col xs:flex-row items-start xs:items-center justify-between gap-1.5 pt-1 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      const text = kumtluangOrg.trim() || 'BAW';
                      const derived = derivePrefixFromText(text);
                      setPrefixUserEdited(false);
                      if (isPrefixCodeTaken(derived)) {
                        const alts = suggestAlternativePrefixes(text);
                        setPrefixCode(alts[0] || derived);
                      } else {
                        setPrefixCode(derived);
                      }
                    }}
                    className="text-[10px] text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1.5 px-2 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 transition cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3 text-blue-600 shrink-0" />
                    <span>Org Name atangin Sync rawh</span>
                  </button>
                  <span className="text-[9px] text-slate-400 font-medium">Manual-in a thlak theih bawk</span>
                </div>

                {/* Dynamic Suggestions if Taken */}
                {prefixCode.trim() && isPrefixCodeTaken(prefixCode.trim()) && (
                  <div className="bg-rose-50/90 p-2.5 rounded-xl border border-rose-200 space-y-1.5 animate-fadeIn">
                    <div className="flex items-center gap-1.5 text-[10.5px] font-bold text-rose-900">
                      <Sparkles className="w-3 h-3 text-amber-600 shrink-0" />
                      <span>Rawtna / Alternative Suggestions (Hmet la i thlang nghal ang):</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {suggestAlternativePrefixes(prefixCode || kumtluangOrg).map((alt) => (
                        <button
                          key={alt}
                          type="button"
                          onClick={() => {
                            setPrefixUserEdited(true);
                            setPrefixCode(alt);
                          }}
                          className="bg-white hover:bg-rose-100 border border-rose-300 hover:border-rose-400 text-rose-900 font-mono font-black text-xs px-2.5 py-1 rounded-lg shadow-2xs transition cursor-pointer flex items-center gap-1"
                        >
                          <span>{alt}</span>
                          <span className="text-[9px] text-emerald-700 font-bold font-sans">✓ Free</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                
                <p className="text-[9.5px] text-slate-500 leading-tight">
                  He Prefix hi Bawm dang Member ID nen a in-overlap loh nan system-ah UNIQUE-a lock a ni ang. Phone number ngai hmang pawhin Bawm tharah registration thar a ngai zel ang.
                </p>
              </div>

              {/* Fund Heads / Sub-Categories */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[10.5px] font-bold text-slate-700">Sub-Categories / Fund Heads</label>
                </div>

                <div className="space-y-1.5">
                  {kumtluangSubcats.map((head, idx) => (
                    <div key={idx} className="flex gap-1.5 items-center">
                      <input
                        type="text"
                        value={head}
                        onChange={(e) => {
                          const updated = [...kumtluangSubcats];
                          updated[idx] = e.target.value;
                          setKumtluangSubcats(updated);
                        }}
                        className="flex-1 min-w-0 bg-white border border-slate-300 rounded-xl p-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-500"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveSubcategory(idx)}
                        className="w-7 h-7 shrink-0 bg-rose-100 text-rose-600 rounded-lg flex items-center justify-center text-xs hover:bg-rose-200 transition cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}

                  <div className="flex gap-1.5 items-center pt-1">
                    <input
                      type="text"
                      value={newSubcatName}
                      onChange={(e) => setNewSubcatName(e.target.value)}
                      placeholder="+ Sub-category hming thar..."
                      className="flex-1 min-w-0 bg-white border border-dashed border-slate-300 rounded-xl p-1.5 text-xs font-medium text-slate-800 focus:outline-none focus:border-blue-500"
                    />
                    <button
                      type="button"
                      onClick={handleAddSubcategory}
                      className="px-2.5 py-1.5 shrink-0 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition cursor-pointer"
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>

              {/* Bial / Section / Veng Structure Setup (Dropdown & Clean Data Sorting) */}
              <div className="bg-white p-3 rounded-2xl border border-blue-200 space-y-2.5 overflow-hidden">
                <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-1">
                  <label className="text-[10.5px] font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span>Bial / Section Dropdown Setup</span>
                  </label>
                  <span className="text-[9px] bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded-md self-start xs:self-auto">
                    Pre-defined Dropdown
                  </span>
                </div>

                <p className="text-[10px] text-slate-500 font-medium leading-relaxed">
                  Member-ten spelling error an neih loh nan leh data sorting a fel fai sa nan, dropdown a an thlan tur Bial / Section list duansa a ni.
                </p>

                {/* Preset Quick Chooser */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[9.5px] font-bold text-slate-500">Quick Presets:</span>
                  {sectionPresets.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setKumtluangSectionLabel(p.label);
                        setKumtluangSections([...p.sections]);
                      }}
                      className="text-[9.5px] font-bold px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg border border-blue-200 transition cursor-pointer"
                      title={`Apply preset: ${p.name}`}
                    >
                      {p.name}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setIsPresetManagerOpen(true)}
                    className="text-[9.5px] font-bold px-2 py-1 bg-slate-100 hover:bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-200 transition cursor-pointer flex items-center gap-1 shadow-2xs"
                    title="Admin Quick Presets Setup & Management"
                  >
                    <Sliders className="w-3 h-3 text-indigo-600" />
                    <span>⚙️ Setup Presets</span>
                  </button>
                </div>

                <div className="flex flex-col sm:grid sm:grid-cols-2 gap-2 pt-1">
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 block mb-1">
                      Label Hming (Dynamic Label)
                    </label>
                    <input
                      type="text"
                      value={kumtluangSectionLabel}
                      onChange={(e) => setKumtluangSectionLabel(e.target.value)}
                      placeholder="e.g. Bial / Unit emaw Section / Veng"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 text-xs font-bold text-slate-900 focus:outline-none focus:bg-white focus:border-blue-600"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 block mb-1">
                      Add New ({kumtluangSections.length} sections)
                    </label>
                    <div className="flex gap-1">
                      <input
                        type="text"
                        value={newSectionName}
                        onChange={(e) => setNewSectionName(e.target.value)}
                        placeholder="+ Bial/Section..."
                        className="flex-1 min-w-0 bg-slate-50 border border-slate-300 rounded-xl p-2 text-xs font-bold text-slate-900 focus:outline-none focus:bg-white focus:border-blue-600"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (newSectionName.trim() && !kumtluangSections.includes(newSectionName.trim())) {
                            setKumtluangSections([...kumtluangSections, newSectionName.trim()]);
                            setNewSectionName('');
                          }
                        }}
                        className="px-2.5 py-1.5 shrink-0 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>

                {/* Section List Tags */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {kumtluangSections.map((sec, idx) => (
                    <span
                      key={idx}
                      className="bg-blue-50 border border-blue-200 text-blue-900 font-bold px-2 py-1 rounded-lg text-[10.5px] flex items-center gap-1 shadow-2xs max-w-full"
                    >
                      <span className="truncate">{sec}</span>
                      <button
                        type="button"
                        onClick={() => setKumtluangSections(kumtluangSections.filter((_, i) => i !== idx))}
                        className="text-rose-500 hover:text-rose-700 font-black cursor-pointer ml-1 shrink-0"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>

                {kumtluangSections.length > 0 && (
                  <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                    <span className="text-[9.5px] text-slate-500 font-medium">
                      Bial/Section <b>{kumtluangSections.length}</b> dah a ni tawh
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsPresetManagerOpen(true)}
                      className="text-[10px] font-bold text-blue-700 hover:text-blue-900 flex items-center gap-1 hover:underline cursor-pointer"
                      title="Save these current sections as a quick preset for future bawms"
                    >
                      <Save className="w-3 h-3 text-blue-600" />
                      <span>Save as Quick Preset</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Optional Target (Per Month / Per Year / Overall) */}
              <div className="bg-white p-3 rounded-2xl border border-blue-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10.5px] font-bold text-slate-800 flex items-center gap-1.5">
                    <Target className="w-3.5 h-3.5 text-blue-600" />
                    Target Amount (Optional - Thla tin / Kum tin Target)
                  </label>
                  <span className="text-[9px] text-slate-400 font-medium">Dah loh theih</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 block mb-1">Target Amount (₹)</label>
                    <input
                      type="number"
                      value={kumtluangTarget}
                      onChange={(e) => setKumtluangTarget(e.target.value)}
                      placeholder="e.g. 100000 (Dah loh theih)"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 font-bold text-slate-900 focus:outline-none focus:bg-white focus:border-blue-600 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 block mb-1">Target Period (Hun Chhung)</label>
                    <select
                      value={kumtluangTargetPeriod}
                      onChange={(e) => setKumtluangTargetPeriod(e.target.value as 'monthly' | 'yearly' | 'total')}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 font-bold text-slate-900 focus:outline-none focus:bg-white focus:border-blue-600 text-xs"
                    >
                      <option value="monthly">Per Month (Thla Tin Target)</option>
                      <option value="yearly">Per Year (Kum Tin Target)</option>
                      <option value="total">Overall Goal (A Pumpui Target)</option>
                    </select>
                  </div>
                </div>
                <p className="text-[9.5px] text-slate-400">
                  Target i dah chuan Creator Page leh Result-ah target tlin zat a lang ang a, i dah loh chuan target tel lovin a lang ang.
                </p>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[10.5px] font-bold text-slate-700">
                    QR Hman Theih Hun (QR Validity Date/Time) *
                  </label>
                  <span className="text-[9.5px] text-blue-700 font-bold">Default: Vawiin (Today)</span>
                </div>
                <input
                  type="datetime-local"
                  value={kumtluangValidity}
                  onChange={(e) => setKumtluangValidity(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl p-2 font-bold text-slate-900 text-[10px] focus:outline-none focus:border-blue-600"
                />
                <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                  <span className="text-[9px] text-slate-400 font-bold">Quick Set:</span>
                  <button
                    type="button"
                    onClick={() => setKumtluangValidity(getTodayDateTimeLocal(23, 59, 0))}
                    className="text-[9.5px] bg-blue-100 hover:bg-blue-200 text-blue-950 font-bold px-2 py-0.5 rounded-md cursor-pointer transition"
                  >
                    📅 Vawiin (Today)
                  </button>
                  <button
                    type="button"
                    onClick={() => setKumtluangValidity(getTodayDateTimeLocal(23, 59, 30))}
                    className="text-[9.5px] bg-blue-50 hover:bg-blue-100 text-blue-800 font-semibold px-2 py-0.5 rounded-md cursor-pointer transition"
                  >
                    +30 Ni (1 Thla)
                  </button>
                  <button
                    type="button"
                    onClick={() => setKumtluangValidity(getTodayDateTimeLocal(23, 59, 180))}
                    className="text-[9.5px] bg-blue-50 hover:bg-blue-100 text-blue-800 font-semibold px-2 py-0.5 rounded-md cursor-pointer transition"
                  >
                    +6 Thla
                  </button>
                  <button
                    type="button"
                    onClick={() => setKumtluangValidity(getTodayDateTimeLocal(23, 59, 365))}
                    className="text-[9.5px] bg-blue-50 hover:bg-blue-100 text-blue-800 font-semibold px-2 py-0.5 rounded-md cursor-pointer transition"
                  >
                    +1 Kum
                  </button>
                  <button
                    type="button"
                    onClick={() => setKumtluangValidity(getTodayDateTimeLocal(23, 59, 730))}
                    className="text-[9.5px] bg-blue-50 hover:bg-blue-100 text-blue-800 font-semibold px-2 py-0.5 rounded-md cursor-pointer transition"
                  >
                    +2 Kum
                  </button>
                </div>
              </div>

              {/* Trxn Fee Bearer */}
              <div className="bg-blue-50/80 p-2.5 rounded-xl border border-blue-200 space-y-1">
                <label className="text-[10px] font-extrabold text-blue-950 uppercase tracking-wider block">
                  Post paid / Settlement (Trxn Fee Bearer) *
                </label>
                <select
                  value={kumtluangFeeBearer}
                  onChange={(e) => setKumtluangFeeBearer(e.target.value as 'user_paid' | 'org_paid')}
                  className="w-full bg-white border border-blue-300 rounded-xl p-2 font-bold text-slate-900 text-xs focus:outline-none"
                >
                  <option value="user_paid">Users Paid Trxn Fee (Petu'n a tum ang)</option>
                  <option value="org_paid">Org Paid Trxn Fee (Pawl/Org-in an tum ang)</option>
                </select>
              </div>

              {/* Excel / CSV Member List Template & Guide */}
              <div className="bg-gradient-to-r from-emerald-50 to-teal-50 p-3.5 rounded-2xl border border-emerald-300 space-y-2.5 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-emerald-600 text-white rounded-xl shadow-xs shrink-0">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-100" />
                    </div>
                    <div>
                      <span className="text-xs font-black text-emerald-950 block">Excel / CSV Member List Template & Format</span>
                      <span className="text-[10.5px] text-emerald-700 font-medium">Bawm i siam zawhah member tam tak vawi khatah i import thei ang.</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const prefix = prefixCode.trim() || 'BET';
                      downloadSampleExcelTemplate(prefix);
                    }}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer active:scale-95 shrink-0"
                    title="Download sample Excel (.xlsx) file with Pa Hming & Phone columns"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Sample Excel (.xlsx)</span>
                  </button>
                </div>

                {/* Visual Format Guide */}
                <div className="bg-white/95 p-3 rounded-xl border border-emerald-200 text-[11px] text-slate-700 space-y-2">
                  <div className="font-black text-[11px] text-emerald-900 flex items-center justify-between">
                    <span>📋 Excel Sheet Column Awm Dan Tur (Standard Format):</span>
                    <span className="text-[9.5px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-mono font-bold">.xlsx / .xls / .csv</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-[10px] border-collapse border border-slate-200 rounded-lg overflow-hidden">
                      <thead>
                        <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                          <th className="p-1.5 border-r border-slate-200">Name *</th>
                          <th className="p-1.5 border-r border-slate-200">Father Name (Pa Hming)</th>
                          <th className="p-1.5 border-r border-slate-200">Phone Number (10 digit)</th>
                          <th className="p-1.5 border-r border-slate-200">Section / Bial</th>
                          <th className="p-1.5">Address</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium text-slate-600">
                        <tr className="bg-emerald-50/40">
                          <td className="p-1.5 border-r border-slate-200 font-bold text-slate-900">Lalmuanpuia</td>
                          <td className="p-1.5 border-r border-slate-200">C. Lalthanga</td>
                          <td className="p-1.5 border-r border-slate-200 font-mono font-bold text-indigo-700">9862123456</td>
                          <td className="p-1.5 border-r border-slate-200">{kumtluangSections[0] || 'Bial 1 (Vengchhak)'}</td>
                          <td className="p-1.5">Vengchhak</td>
                        </tr>
                        <tr>
                          <td className="p-1.5 border-r border-slate-200 font-bold text-slate-900">Zothanmawia</td>
                          <td className="p-1.5 border-r border-slate-200">Lalrinzuala</td>
                          <td className="p-1.5 border-r border-slate-200 font-mono font-bold text-indigo-700">9436123789</td>
                          <td className="p-1.5 border-r border-slate-200">{kumtluangSections[1] || 'Bial 2 (Vengthlang)'}</td>
                          <td className="p-1.5">Vengthlang</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <p className="text-[10px] text-emerald-800 leading-relaxed pt-0.5">
                    💡 <strong>Tip:</strong> Phone number digit 10 i dah khan a tawp digit 4 hi Member ID-ah a in-generate nghal a, Pa Hming (Father Name) pawh duplicate hming awm theite hriat hran nan fel takin a vawng tel nghal bawk ang. Bawm i siam zawhah <strong>Member Manager</strong> aṭangin Excel sheet chu Drag &amp; Drop mai theih a ni.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 5. QR Creation Fee Notice / Admin Notification Box */}
          <div className="space-y-2">
            {/* Admin Announcement / Notification if active */}
            {announcement && announcement.isActive && (
              <AnnouncementBannerCard 
                announcement={announcement}
                isDismissible={false}
              />
            )}

            {/* QR Creation Fee & Per-Creator Quota Box */}
            <div className="bg-amber-50/90 p-3 rounded-2xl border border-amber-200 space-y-2 text-xs">
              <div className="flex justify-between items-center font-black text-amber-950">
                <span className="flex items-center gap-1.5">
                  <Receipt className="w-4 h-4 text-amber-600" /> QR Creation Charge ({BAWM_CONFIG[selectedCategory].name}):
                </span>
                <span className="text-amber-800 text-sm font-black">
                  {actualCreationCharge === 0 ? 'FREE (Trial / Offer)' : `₹${actualCreationCharge.toFixed(2)} / QR`}
                </span>
              </div>

              {/* Dynamic Creator Benefits Indicator */}
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-amber-200/70 text-[10.5px]">
                <div className="bg-white/80 p-2 rounded-xl border border-amber-200 flex flex-col">
                  <span className="text-slate-500 font-bold">Creator Trial Status</span>
                  <span className="font-black text-emerald-700 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-500" />
                    {creatorProfile.isFreeServiceGranted 
                      ? 'Lifetime Free VIP' 
                      : isTrialActiveByDate 
                      ? 'Active Dynamic Trial' 
                      : 'Trial Ended'}
                  </span>
                </div>

                <div className="bg-white/80 p-2 rounded-xl border border-amber-200 flex flex-col">
                  <span className="text-slate-500 font-bold">Free Post Quota</span>
                  <span className="font-black text-indigo-900">
                    {creatorProfile.isFreeServiceGranted ? 'Unlimited Posts' : `${remainingQuota} / ${totalQuota} Free Left`}
                  </span>
                </div>
              </div>

              <p className="text-[10px] text-amber-900/85 leading-relaxed font-medium">
                {actualCreationCharge === 0 
                  ? `* He QR hi i account trial / free quota (${remainingQuota} free left) a nih avangin a thlawnin a siam theih e.` 
                  : `* QR siam man hi Admin atanga set angin ₹${actualCreationCharge}/- a ni ang.`}
              </p>
            </div>
          </div>

          {/* 6. GPS Location Tagging */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10.5px] font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                <Crosshair className="w-3.5 h-3.5 text-indigo-600" /> GPS Location Tagging
              </span>
              <button
                type="button"
                onClick={handleDetectGPS}
                className="text-[10px] text-indigo-600 font-bold hover:underline cursor-pointer"
              >
                Detect GPS
              </button>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={gpsCoords}
                onChange={(e) => setGpsCoords(e.target.value)}
                placeholder="Latitude, Longitude"
                className="flex-1 bg-white border border-slate-300 rounded-xl p-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-600"
              />
              <button
                type="button"
                onClick={openGoogleMaps}
                title="View on Google Maps"
                className="px-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl border border-indigo-200 text-xs font-bold transition flex items-center justify-center cursor-pointer"
              >
                <MapPin className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="w-full bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 hover:from-indigo-700 hover:to-purple-700 text-white font-black py-3.5 rounded-xl transition text-xs shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
          >
            <QrCode className="w-4 h-4" /> Generate & Submit QR {actualCreationCharge === 0 ? '(Free Trial)' : `(₹${actualCreationCharge})`}
          </button>
        </form>
      )}

      {/* TAB 2: MY CREATED QRS (CREATOR DASHBOARD & EDIT) */}
      {activeTab === 'manage' && (
        <div className="space-y-4">
          {/* Header & Filter */}
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="font-black text-sm text-slate-900">Ka QR Siam Tawh Te</h3>
              <p className="text-[10px] text-slate-500 font-medium">
                QR information leh validity siamthat (edit) nan hman tur
              </p>
            </div>

            <select
              value={manageFilter}
              onChange={(e) => setManageFilter(e.target.value)}
              className="bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:outline-none"
            >
              <option value="all">All Categories ({myCampaigns.length})</option>
              <option value="ralna">Ralna Bawm</option>
              <option value="khawlsak">Khawlsak Bawm</option>
              <option value="rikrum">Rikrum Bawm</option>
              <option value="kumtluang">Kumtluang Bawm</option>
            </select>
          </div>

          {displayedCampaigns.length === 0 ? (
            <div className="bg-white border border-slate-200 p-8 rounded-3xl text-center space-y-2">
              <QrCode className="w-10 h-10 text-slate-300 mx-auto" />
              <h4 className="font-bold text-slate-800 text-xs">QR Siam a la awm lo</h4>
              <p className="text-[11px] text-slate-400">
                Create QR tab atangin QR thar i siam thei e.
              </p>
              <button
                type="button"
                onClick={() => setActiveTab('create')}
                className="mt-2 bg-indigo-600 text-white font-bold px-4 py-2 rounded-xl text-xs"
              >
                + Create QR Thar
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {displayedCampaigns.map((camp) => {
                const isRalna = camp.category === 'ralna';
                const isKhawlsak = camp.category === 'khawlsak';
                const isRikrum = camp.category === 'rikrum';
                const isKumtluang = camp.category === 'kumtluang';

                return (
                  <div
                    key={camp.id}
                    className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs space-y-3 hover:border-slate-300 transition"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        {camp.imageUrl ? (
                          <img
                            src={camp.imageUrl}
                            alt={camp.title}
                            className="w-12 h-12 rounded-xl object-cover border border-slate-200 shrink-0"
                          />
                        ) : (
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-white shrink-0 ${
                            isRalna ? 'bg-slate-900' : isKhawlsak ? 'bg-emerald-600' : isRikrum ? 'bg-rose-600' : 'bg-blue-600'
                          }`}>
                            {isRalna ? <Ribbon className="w-5 h-5" /> : isKhawlsak ? <HandHeart className="w-5 h-5" /> : isRikrum ? <AlertTriangle className="w-5 h-5" /> : <InfinityIcon className="w-5 h-5" />}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`text-[8.5px] font-black px-1.5 py-0.5 rounded-full uppercase border ${
                              isRalna ? 'bg-slate-100 text-slate-900 border-slate-300' :
                              isKhawlsak ? 'bg-emerald-100 text-emerald-900 border-emerald-200' :
                              isRikrum ? 'bg-rose-100 text-rose-900 border-rose-200' :
                              'bg-blue-100 text-blue-900 border-blue-200'
                            }`}>
                              {camp.category}
                            </span>
                            <span className={`text-[8.5px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-1 ${
                              camp.status === 'active' 
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : camp.status === 'pending_approval'
                                ? 'bg-amber-50 text-amber-800 border border-amber-300 font-black'
                                : 'bg-slate-100 text-slate-600 border border-slate-200'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${
                                camp.status === 'active' 
                                  ? 'bg-emerald-500 animate-pulse' 
                                  : camp.status === 'pending_approval' 
                                  ? 'bg-amber-500 animate-ping' 
                                  : 'bg-slate-400'
                              }`} />
                              {camp.status === 'active' 
                                ? 'ACTIVE' 
                                : camp.status === 'pending_approval'
                                ? 'PENDING APPROVAL'
                                : 'EXPIRED'}
                            </span>
                          </div>
                          <h4 className="font-black text-slate-900 text-xs truncate mt-0.5">
                            {camp.title}
                          </h4>
                          <p className="text-[10px] text-slate-500 flex items-center gap-1 truncate">
                            <MapPin className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                            {camp.location}
                          </p>
                        </div>
                      </div>

                      {/* Actions: Edit and Delete */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => setEditingCampaign(camp)}
                          className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold px-2.5 py-1.5 rounded-xl text-xs border border-indigo-200 transition cursor-pointer flex items-center gap-1"
                        >
                          <Edit3 className="w-3.5 h-3.5" /> Edit
                        </button>
                        {onDeleteCampaign && (
                          <button
                            type="button"
                            onClick={() => {
                              setDeletingCampaign(camp);
                              setDeleteReasonText('');
                            }}
                            className="bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold p-1.5 rounded-xl text-xs border border-rose-200 transition cursor-pointer flex items-center justify-center"
                            title="Delete / Cancel Campaign"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Details Snippet */}
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-[11px] space-y-1 text-slate-600">
                      {camp.cause && (
                        <p className="font-medium text-slate-700">
                          <span className="font-bold text-slate-900">Chhan / Cause:</span> {camp.cause}
                        </p>
                      )}
                      {camp.mitthiHming && (
                        <p className="font-medium text-slate-700">
                          <span className="font-bold text-slate-900">Mitthi:</span> {camp.mitthiHming} ({camp.age} yrs) • Vuitu: {camp.vuitu || 'N/A'}
                        </p>
                      )}
                      <div className="flex justify-between items-center text-[10px] text-slate-500 pt-0.5">
                        <span>UPI: <b className="text-slate-800">{camp.upiId}</b></span>
                        <span>Validity: <b className="text-slate-800">{formatDateDDMMYYYY(camp.validityDate)}</b></span>
                      </div>
                    </div>

                    {/* Total Raised & Stats (Creator Dashboard) */}
                    {(() => {
                      const campTxns = transactions.filter(t => (t.campaignId === camp.id || t.campaignTitle === camp.title) && isConfirmedTransaction(t));
                      const raised = campTxns.reduce((sum, t) => sum + t.amount, 0);

                      // For Ralna Bawm: strictly NO target and NO progress bar
                      if (isRalna) {
                        return (
                          <div className="bg-slate-900/5 p-2.5 rounded-xl border border-slate-200 space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <div className="flex items-center gap-1.5">
                                <span className="font-black text-slate-900 text-xs">₹{raised.toLocaleString('en-IN')}</span>
                                <span className="text-[10px] text-slate-500 font-medium">Pek tlingkhawm zat</span>
                                <span className="text-[7.5px] font-black uppercase text-slate-700 bg-slate-200 px-1 py-0.2 rounded">Creator Private</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[9.5px] font-bold text-slate-700 bg-white border border-slate-200 px-1.5 py-0.2 rounded">
                                  {campTxns.length} txn{campTxns.length === 1 ? '' : 's'}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      }

                      const hasTarget = camp.targetAmount && camp.targetAmount > 0;
                      const target = hasTarget ? camp.targetAmount! : 0;
                      const periodSuffix = camp.targetPeriod === 'monthly' ? '/m' : camp.targetPeriod === 'yearly' ? '/yr' : '';

                      if (!hasTarget) {
                        return (
                          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <div className="flex items-center gap-1.5">
                                <span className="font-black text-slate-900 text-xs">₹{raised.toLocaleString('en-IN')}</span>
                                <span className="text-[10px] text-slate-500 font-medium">Pek tlingkhawm</span>
                                <span className="text-[7.5px] font-black uppercase text-slate-700 bg-slate-200 px-1 py-0.2 rounded">Creator Private</span>
                              </div>
                              <span className="text-[9.5px] text-slate-500 font-bold bg-white border border-slate-200 px-2 py-0.5 rounded-md">
                                {campTxns.length} txn{campTxns.length === 1 ? '' : 's'}
                              </span>
                            </div>
                          </div>
                        );
                      }

                      const pct = target > 0 ? Math.round((raised / target) * 100) : 0;
                      const clampedPct = Math.min(pct, 100);

                      return (
                        <div className="bg-indigo-50/50 p-2.5 rounded-xl border border-indigo-100 space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-1.5">
                              <span className="font-black text-slate-900 text-xs">₹{raised.toLocaleString('en-IN')}</span>
                              <span className="text-[10px] text-slate-500 font-medium">/ Target: ₹{target.toLocaleString('en-IN')}{periodSuffix}</span>
                              <span className="text-[7.5px] font-black uppercase text-indigo-700 bg-indigo-100 px-1 py-0.2 rounded">Creator Private</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[9.5px] text-slate-400">{campTxns.length} txn{campTxns.length === 1 ? '' : 's'}</span>
                              <span className="text-[9.5px] font-black text-indigo-700 bg-white border border-indigo-200 px-1.5 py-0.2 rounded">
                                {pct}%
                              </span>
                            </div>
                          </div>
                          <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500 bg-indigo-600"
                              style={{ width: `${clampedPct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })()}

                    {/* Actions Bar */}
                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 flex-wrap">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(camp)}
                          className={`text-[10.5px] font-bold px-2.5 py-1 rounded-lg border transition cursor-pointer flex items-center gap-1 ${
                            camp.status === 'active'
                              ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                              : camp.status === 'pending_approval'
                              ? 'bg-amber-100 text-amber-900 border-amber-300'
                              : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                          }`}
                        >
                          <Clock className="w-3 h-3" />
                          {camp.status === 'active' 
                            ? 'Mark as Expired' 
                            : camp.status === 'pending_approval'
                            ? 'Approval Pending...'
                            : '⚡ Request Reactivation'}
                        </button>

                        {camp.category === 'kumtluang' && onOpenMemberRoll && (
                          <button
                            type="button"
                            onClick={() => onOpenMemberRoll()}
                            className="text-[10.5px] bg-blue-600 hover:bg-blue-700 text-white font-bold px-2.5 py-1 rounded-lg transition cursor-pointer flex items-center gap-1 shadow-xs"
                            title="Open Member Roll & Manual Entry Portal"
                          >
                            <Users className="w-3 h-3" /> Member Roll & Cash Entry
                          </button>
                        )}
                      </div>

                      {onSelectCampaign && (
                        <button
                          type="button"
                          onClick={() => onSelectCampaign(camp)}
                          className="text-[10.5px] bg-slate-900 hover:bg-slate-800 text-white font-bold px-3 py-1 rounded-lg transition cursor-pointer flex items-center gap-1"
                        >
                          <Eye className="w-3 h-3" /> Test & Scan View
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* EDIT CAMPAIGN MODAL */}
      {editingCampaign && (
        <EditCampaignModal
          campaign={editingCampaign}
          creatorProfile={creatorProfile}
          onClose={() => setEditingCampaign(null)}
          onSave={(updated) => {
            if (onUpdateCampaign) {
              onUpdateCampaign(updated);
            }
            setEditingCampaign(null);
            alert('✅ QR Campaign data siamthat (updated) hlawhtling ta e!');
          }}
        />
      )}

      {/* SECTION PRESET MANAGER MODAL (Creation View) */}
      <SectionPresetManagerModal
        isOpen={isPresetManagerOpen}
        onClose={() => setIsPresetManagerOpen(false)}
        onApplyPreset={(preset) => {
          setKumtluangSectionLabel(preset.label);
          setKumtluangSections([...preset.sections]);
        }}
        currentSections={kumtluangSections}
        currentLabel={kumtluangSectionLabel}
        isAdmin={isPrivilegedUser}
      />

      {/* DELETE / CANCEL CAMPAIGN MODAL (Siam Sual Paihna / Tihtawpna) */}
      {deletingCampaign && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 border border-slate-200 shadow-2xl space-y-4 my-auto">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="font-black text-slate-900 text-sm">Bawm Siam Sual / Delete Dilna</h3>
                <p className="text-[10px] text-slate-500 font-medium truncate">{deletingCampaign.title}</p>
              </div>
            </div>

            {(() => {
              const campTxns = transactions.filter(t => (t.campaignId === deletingCampaign.id || t.campaignTitle === deletingCampaign.title) && isConfirmedTransaction(t));
              const totalRaised = campTxns.reduce((sum, t) => sum + t.amount, 0);
              const hasPayments = campTxns.length > 0;

              return (
                <div className="space-y-3 text-xs">
                  {hasPayments ? (
                    <div className="bg-amber-50 border border-amber-300 p-3 rounded-2xl space-y-1.5 text-amber-950">
                      <div className="flex items-center gap-1.5 font-black text-xs text-amber-900">
                        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>Sum Lo Lut Tawh ({campTxns.length} Txns - ₹{totalRaised.toLocaleString('en-IN')})</span>
                      </div>
                      <p className="text-[11px] leading-relaxed text-amber-900">
                        He Bawm-ah hian thawhlawm/sum ₹{totalRaised.toLocaleString('en-IN')} a lo luh tawh avangin, donor-te Sulhnu leh Audit History him nan <strong>Paih bo hlen (Hard Delete) lovin Chhunzawm loh (Cancelled & Archived)</strong>-ah dah a ni ang a, QR a tawp nghal bawk ang.
                      </p>
                    </div>
                  ) : (
                    <div className="bg-rose-50 border border-rose-200 p-3 rounded-2xl space-y-1 text-rose-950">
                      <p className="font-bold text-rose-900 text-xs">Sum a la lut lo (₹0 Raised)</p>
                      <p className="text-[11px] text-rose-800 leading-relaxed">
                        He Bawm siam sual palh hi application pum leh database atangin a reh nghal vek ang.
                      </p>
                    </div>
                  )}

                  <div>
                    <label className="text-[10.5px] font-bold text-slate-700 block mb-1">
                      Tihtawp / Paih chhan (Reason) *
                    </label>
                    <input
                      type="text"
                      required
                      value={deleteReasonText}
                      onChange={(e) => setDeleteReasonText(e.target.value)}
                      placeholder="e.g. Account number/Hming ziah sual palh, duplicate siam..."
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold text-slate-900 text-xs focus:bg-white focus:border-rose-600 focus:outline-none"
                    />
                  </div>

                  <div className="flex gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => {
                        setDeletingCampaign(null);
                        setDeleteReasonText('');
                      }}
                      className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl transition cursor-pointer text-xs"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!deleteReasonText.trim()) {
                          alert('Khawngaihin Tihtawp / Paih chhan (Reason) ziak rawh le.');
                          return;
                        }
                        if (onDeleteCampaign) {
                          onDeleteCampaign(deletingCampaign.id, deleteReasonText.trim());
                        }
                        const wasArchived = hasPayments;
                        setDeletingCampaign(null);
                        setDeleteReasonText('');
                        alert(wasArchived 
                          ? `🔒 BAWM CANCELLED & ARCHIVED!\n\nSum lo lut tawh record him tlat siin he QR hi tihtawp a ni a, public list-ah a lang tawh lo ang.`
                          : `✅ BAWM DELETED!\n\nHe Bawm siam sual hi hlawhtling takin paih reh a ni e.`
                        );
                      }}
                      className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-black py-2.5 rounded-xl transition cursor-pointer text-xs shadow-md flex items-center justify-center gap-1.5"
                    >
                      <Trash2 className="w-4 h-4" /> {hasPayments ? 'Cancel & Archive' : 'Paih Bo / Delete'}
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* EDIT CREATOR PROFILE MODAL */}
      {isEditingCreatorProfile && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 border border-slate-200 shadow-2xl space-y-4 my-auto">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shadow-xs">
                  <Edit3 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-sm">Creator Profile Siamthatna</h3>
                  <p className="text-[10px] text-slate-500 font-medium">Hming, Kohhran/Pawl leh Nihna thlakna</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditingCreatorProfile(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {profileSuccessNotice && (
              <div className="bg-emerald-50 text-emerald-800 p-2.5 rounded-xl border border-emerald-200 text-xs font-bold flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600" />
                Profile thlak fel a ni e!
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const updated: CreatorProfile = {
                  ...creatorProfile,
                  name: editCreatorName.trim() || creatorProfile.name,
                  orgName: editCreatorOrg.trim(),
                  designation: editCreatorDesignation.trim(),
                };
                if (onUpdateCreatorProfile) {
                  onUpdateCreatorProfile(updated);
                }
                setProfileSuccessNotice(true);
                setTimeout(() => {
                  setProfileSuccessNotice(false);
                  setIsEditingCreatorProfile(false);
                }, 900);
              }}
              className="space-y-3.5 text-xs"
            >
              <div>
                <label className="text-[10.5px] font-bold text-slate-700 block mb-1">
                  Creator Hming (Full Name) *
                </label>
                <input
                  type="text"
                  required
                  value={editCreatorName}
                  onChange={(e) => setEditCreatorName(e.target.value)}
                  placeholder="I hming..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold text-slate-900 focus:outline-none focus:bg-white focus:border-indigo-600"
                />
              </div>

              <div>
                <label className="text-[10.5px] font-bold text-slate-700 block mb-1">
                  Organization / Kohhran / Branch
                </label>
                <input
                  type="text"
                  value={editCreatorOrg}
                  onChange={(e) => setEditCreatorOrg(e.target.value)}
                  placeholder="e.g. BCM Ebenezer / YMA"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-medium text-slate-900 focus:outline-none focus:bg-white focus:border-indigo-600"
                />
              </div>

              <div>
                <label className="text-[10.5px] font-bold text-slate-700 block mb-1">
                  Nihna (Designation)
                </label>
                <input
                  type="text"
                  value={editCreatorDesignation}
                  onChange={(e) => setEditCreatorDesignation(e.target.value)}
                  placeholder="e.g. Secretary / Treasurer / Member"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-medium text-slate-900 focus:outline-none focus:bg-white focus:border-indigo-600"
                />
              </div>

              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-[10.5px] text-slate-600 space-y-1">
                <p><strong>Mobile:</strong> {creatorProfile.phone}</p>
                <p><strong>Approved Categories:</strong> {creatorProfile.approvedCategories.join(', ')}</p>
              </div>

              <div className="flex gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditingCreatorProfile(false)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl transition cursor-pointer text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black py-2.5 rounded-xl transition cursor-pointer text-xs shadow-md flex items-center justify-center gap-1.5"
                >
                  <Check className="w-4 h-4" /> Vawng / Save Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

/* -------------------------------------------------------------
   SUB-COMPONENT: FULL CAMPAIGN EDIT MODAL (Siam thatna)
-------------------------------------------------------------- */
interface EditCampaignModalProps {
  campaign: Campaign;
  onClose: () => void;
  onSave: (updated: Campaign) => void;
  creatorProfile?: CreatorProfile;
}

const EditCampaignModal: React.FC<EditCampaignModalProps> = ({
  campaign,
  onClose,
  onSave,
  creatorProfile,
}) => {
  const [title, setTitle] = useState<string>(campaign.title || '');
  const [location, setLocation] = useState<string>(campaign.location || '');
  const [cause, setCause] = useState<string>(campaign.cause || '');
  const [upiId, setUpiId] = useState<string>(campaign.upiId || '');
  const [validityDate, setValidityDate] = useState<string>(() => campaign.validityDate || getTodayDateTimeLocal(23, 59, 0));
  const [status, setStatus] = useState<'active' | 'pending_approval' | 'expired'>((campaign.status as any) || 'active');
  const [gpsCoords, setGpsCoords] = useState<string>(campaign.gpsCoords || '23.7271, 92.7176');
  const [imageUrl, setImageUrl] = useState<string | undefined>(campaign.imageUrl);
  
  // Specifics
  const [mitthiHming, setMitthiHming] = useState<string>(campaign.mitthiHming || '');
  const [age, setAge] = useState<string>(campaign.age?.toString() || '');
  const [vuitu, setVuitu] = useState<string>(campaign.vuitu || '');
  const [thihni, setThihni] = useState<string>(() => campaign.thihni || getTodayDateTimeLocal(6, 0, 0));
  const [vuiHun, setVuiHun] = useState<string>(() => campaign.vuiHun || getTodayDateTimeLocal(13, 0, 0));
  
  const [targetAmount, setTargetAmount] = useState<string>(campaign.targetAmount?.toString() || '');
  const [targetPeriod, setTargetPeriod] = useState<'monthly' | 'yearly' | 'total'>((campaign.targetPeriod as any) || 'monthly');
  const [maxLimit, setMaxLimit] = useState<string>(campaign.maxLimit?.toString() || '');
  const [urgencyDeadline, setUrgencyDeadline] = useState<string>(() => campaign.urgencyDeadline || getTodayDateTimeLocal(23, 59, 7));
  const [urgencyLevel, setUrgencyLevel] = useState<'CRITICAL' | 'URGENT' | 'NORMAL'>((campaign.urgencyLevel as any) || 'URGENT');
  
  // Kumtluang specifics
  const [orgName, setOrgName] = useState<string>(campaign.orgName || '');
  const [editOrgCode, setEditOrgCode] = useState<string>(
    campaign.orgCode || derivePrefixFromText(campaign.orgName || campaign.title || 'BAW')
  );
  const [subCategories, setSubCategories] = useState<string[]>(
    campaign.subCategories && campaign.subCategories.length > 0 
      ? campaign.subCategories 
      : ['Pathian Ram', 'Mission', 'Building Fund']
  );
  const [newSubCatInput, setNewSubCatInput] = useState<string>('');
  const [kumtluangFeeBearer, setKumtluangFeeBearer] = useState<'user_paid' | 'org_paid'>(
    (campaign.kumtluangFeeBearer as any) || 'org_paid'
  );

  // Section / Bial setup for Kumtluang
  const [kumtluangSectionLabel, setKumtluangSectionLabel] = useState<string>(
    campaign.sectionLabel || 'Bial / Section'
  );
  const [kumtluangSections, setKumtluangSections] = useState<string[]>(
    campaign.definedSections && campaign.definedSections.length > 0
      ? campaign.definedSections
      : ['Bial 1 (Vengchhak)', 'Bial 2 (Vengthlang)', 'Bial 3 (Venglai)', 'Bial 4 (Field Veng)', 'General / Khawchhung']
  );
  const [newSectionName, setNewSectionName] = useState<string>('');
  const [isEditPresetManagerOpen, setIsEditPresetManagerOpen] = useState<boolean>(false);
  const [editSectionPresets, setEditSectionPresets] = useState<SectionQuickPreset[]>(() => getStoredSectionPresets());

  useEffect(() => {
    const handlePresetsUpdate = () => {
      setEditSectionPresets(getStoredSectionPresets());
    };
    window.addEventListener('ronpay_section_presets_updated', handlePresetsUpdate);
    return () => window.removeEventListener('ronpay_section_presets_updated', handlePresetsUpdate);
  }, []);

  const [isPhotoCompressing, setIsPhotoCompressing] = useState<boolean>(false);

  // Handle Photo Upload with Automatic Image Optimization for instant multi-device & cloud sync
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsPhotoCompressing(true);
      try {
        const compressed = await compressImageFile(file, 400, 400, 0.8);
        setImageUrl(compressed);
      } catch (err) {
        console.warn('Image compression fallback:', err);
        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result === 'string') {
            setImageUrl(reader.result);
          }
        };
        reader.readAsDataURL(file);
      } finally {
        setIsPhotoCompressing(false);
      }
    }
  };

  const handleAddSubCat = () => {
    if (newSubCatInput.trim() && !subCategories.includes(newSubCatInput.trim())) {
      setSubCategories([...subCategories, newSubCatInput.trim()]);
      setNewSubCatInput('');
    }
  };

  const handleRemoveSubCat = (indexToRemove: number) => {
    setSubCategories(subCategories.filter((_, idx) => idx !== indexToRemove));
  };

  const handleDetectGPS = () => {
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude.toFixed(6);
          const lng = pos.coords.longitude.toFixed(6);
          const accuracy = Math.round(pos.coords.accuracy || 0);
          setGpsCoords(`${lat}, ${lng}`);
          alert(`📍 Live GPS dik tak hmuh a ni e!\nCoordinates: ${lat}, ${lng}\nAccuracy: ~${accuracy} meters.`);
        },
        () => {
          navigator.geolocation.getCurrentPosition(
            (pos2) => {
              setGpsCoords(`${pos2.coords.latitude.toFixed(5)}, ${pos2.coords.longitude.toFixed(5)}`);
            },
            () => alert('Live GPS coordinates detect theih a ni lo. I phone/computer Location phalsak a nih leh nih loh enfiah la, emaw coordinates hi manual-in chhu lut mai rawh le.'),
            { enableHighAccuracy: false, timeout: 8000, maximumAge: 30000 }
          );
        },
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
      );
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const finalPrefix = editOrgCode.trim().toUpperCase() || campaign.orgCode || derivePrefixFromText(orgName || title);
    if (isPrefixCodeTaken(finalPrefix, campaign.id)) {
      const suggestions = suggestAlternativePrefixes(finalPrefix);
      alert(`⚠️ Prefix Code "${finalPrefix}" hi Bawm dangin an hmang tawh a ni!\n\nPrefix dang thlang rawh le:\n${suggestions.join(', ')}`);
      return;
    }

    const oldPrefix = (campaign.orgCode || '').trim().toUpperCase();
    let migratedCount = 0;
    if (oldPrefix && oldPrefix !== finalPrefix) {
      migratedCount = migrateCampaignMembersPrefix(campaign.id, oldPrefix, finalPrefix);
    }

    const wasExpired = campaign.status === 'expired' || isCampaignExpired(campaign.validityDate, campaign.status);
    let finalStatus = status;
    let remarks = campaign.approvalRemarks;

    if (wasExpired && status === 'active') {
      // Creator cannot reactivate directly to active without Admin Approval
      finalStatus = 'pending_approval';
      remarks = 'Reactivation requested by creator';
    }

    const trimmedCause = cause.trim();
    if (trimmedCause && trimmedCause !== campaign.cause) {
      translateTextViaApi(trimmedCause, campaign.category, 'english').catch(() => {});
    }

    const updated: Campaign = {
      ...campaign,
      title: title.trim(),
      titleEn: formatMizoTextToEnglish(title.trim()),
      titleMizo: title.trim(),
      location: location.trim(),
      cause: trimmedCause || undefined,
      causeEn: (trimmedCause === campaign.cause && campaign.causeEn) ? campaign.causeEn : (trimmedCause ? formatMizoTextToEnglish(trimmedCause) : undefined),
      causeMizo: trimmedCause || undefined,
      upiId: upiId.trim(),
      validityDate: validityDate,
      status: finalStatus,
      approvalRemarks: remarks,
      gpsCoords: gpsCoords.trim(),
      imageUrl: imageUrl || undefined,
      orgCode: finalPrefix,
      updatedAt: new Date().toISOString(),
      
      mitthiHming: campaign.category === 'ralna' ? mitthiHming.trim() : undefined,
      age: campaign.category === 'ralna' && age ? parseInt(age) : undefined,
      vuitu: campaign.category === 'ralna' ? vuitu.trim() : undefined,
      thihni: campaign.category === 'ralna' ? thihni : undefined,
      vuiHun: campaign.category === 'ralna' ? vuiHun : undefined,

      targetAmount: targetAmount && parseFloat(targetAmount) > 0 ? parseFloat(targetAmount) : undefined,
      targetPeriod: targetAmount && parseFloat(targetAmount) > 0 ? targetPeriod : undefined,
      maxLimit: maxLimit ? parseFloat(maxLimit) : undefined,
      urgencyDeadline: urgencyDeadline || undefined,
      urgencyLevel: campaign.category === 'rikrum' ? urgencyLevel : undefined,
      
      orgName: campaign.category === 'kumtluang' ? (orgName.trim() || undefined) : campaign.orgName,
      subCategories: campaign.category === 'kumtluang' ? subCategories : campaign.subCategories,
      kumtluangFeeBearer: campaign.category === 'kumtluang' ? kumtluangFeeBearer : undefined,
      sectionLabel: campaign.category === 'kumtluang' ? (kumtluangSectionLabel.trim() || 'Bial / Section') : campaign.sectionLabel,
      definedSections: campaign.category === 'kumtluang' ? kumtluangSections : campaign.definedSections,
    };

    onSave(updated);
    if (migratedCount > 0) {
      alert(`✅ BAWM DETAILS & PREFIX UPDATED!\n\nBawm Prefix chu [${finalPrefix}] ah thlak fel a ni a, he Bawm a member awmsa (${migratedCount}) te ID pawh '${finalPrefix}-XXXX' ah auto-migrate/update fel nghal a ni e!`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fadeIn">
      <div className="bg-white rounded-3xl max-w-lg w-full p-4 sm:p-5 border border-slate-200 shadow-2xl space-y-4 my-auto">
        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shadow-xs">
              <Edit3 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-sm">QR Siamthatna (Edit QR Details)</h3>
              <p className="text-[10px] text-slate-500 font-medium">
                Category: <span className="uppercase font-bold text-indigo-600">{campaign.category}</span> • ID: <span className="font-mono text-slate-400">{campaign.id}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs max-h-[72vh] overflow-y-auto pr-1">
          {/* Photo / Image Upload & Edit Section */}
          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-2">
            <label className="text-[10.5px] font-extrabold text-slate-800 flex items-center gap-1.5 uppercase tracking-wider">
              <ImageIcon className="w-3.5 h-3.5 text-indigo-600" /> Thlalak (Campaign / Profile Photo)
            </label>
            
            <div className="flex items-center gap-3">
              {imageUrl ? (
                <div className="relative w-16 h-16 rounded-xl overflow-hidden border-2 border-indigo-500 shadow-xs shrink-0 group">
                  <img src={imageUrl} alt="Campaign" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setImageUrl(undefined)}
                    className="absolute inset-0 bg-black/60 text-white flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition cursor-pointer"
                    title="Paih rawh"
                  >
                    <Trash2 className="w-4 h-4 text-rose-400" />
                    <span className="text-[8px] font-bold">Paih</span>
                  </button>
                </div>
              ) : (
                <div className="w-16 h-16 rounded-xl bg-slate-200 border border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 shrink-0">
                  {isPhotoCompressing ? (
                    <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" />
                  ) : (
                    <>
                      <ImageIcon className="w-5 h-5 mb-0.5" />
                      <span className="text-[8px] font-bold">No Photo</span>
                    </>
                  )}
                </div>
              )}

              <div className="flex-1 space-y-1.5">
                <label className="flex items-center justify-center gap-1.5 w-full bg-white hover:bg-indigo-50 text-indigo-700 font-bold px-3 py-2 rounded-xl border border-indigo-300 hover:border-indigo-400 transition cursor-pointer text-xs shadow-xs">
                  {isPhotoCompressing ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Optimizing Image...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-3.5 h-3.5" />
                      <span>{imageUrl ? 'Thlalak Thlak Rawh (Change Photo)' : 'Thlalak Dah Rawh (Upload Photo)'}</span>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    disabled={isPhotoCompressing}
                    className="hidden"
                  />
                </label>
                {imageUrl && (
                  <div className="flex items-center justify-between">
                    <span className="text-[9.5px] text-emerald-700 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Cloud Sync Ready
                    </span>
                    <button
                      type="button"
                      onClick={() => setImageUrl(undefined)}
                      className="text-[10px] text-rose-600 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" /> Paih rawh
                    </button>
                  </div>
                )}
              </div>
            </div>
            
            <div className="pt-1 border-t border-slate-200/60">
              <label className="text-[9.5px] text-slate-500 font-semibold block mb-0.5">Awm sa link / URL hmang duh tan (Optional Direct URL):</label>
              <input
                type="url"
                value={imageUrl && !imageUrl.startsWith('data:') ? imageUrl : ''}
                onChange={(e) => setImageUrl(e.target.value.trim() || undefined)}
                placeholder="https://example.com/logo.png"
                className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-[11px] focus:ring-1 focus:ring-indigo-500 outline-none"
              />
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="text-[10.5px] font-bold text-slate-700 block mb-1">Campaign / QR Title *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold text-slate-900 focus:outline-none focus:bg-white focus:border-indigo-600"
            />
          </div>

          {/* Location */}
          <div>
            <label className="text-[10.5px] font-bold text-slate-700 block mb-1">Veng / Khua / Location *</label>
            <input
              type="text"
              required
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold text-slate-900 focus:outline-none focus:bg-white focus:border-indigo-600"
            />
          </div>

          {/* Category specific fields: RALNA */}
          {campaign.category === 'ralna' && (
            <div className="bg-purple-50/70 p-3 rounded-2xl border border-purple-200 space-y-2.5">
              <div className="flex items-center gap-1 text-purple-950 font-black text-[11px] uppercase border-b border-purple-200 pb-1">
                <Ribbon className="w-3.5 h-3.5 text-purple-700" /> Ralna (Chhiatni) Details
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="text-[10px] font-bold text-purple-950 block mb-1">Mitthi Hming *</label>
                  <input
                    type="text"
                    required
                    value={mitthiHming}
                    onChange={(e) => setMitthiHming(e.target.value)}
                    className="w-full bg-white border border-purple-300 rounded-xl p-2 font-bold text-slate-900 focus:border-purple-600"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-purple-950 block mb-1">Kum (Age)</label>
                  <input
                    type="number"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    className="w-full bg-white border border-purple-300 rounded-xl p-2 font-bold text-slate-900 focus:border-purple-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[10px] font-bold text-purple-950">Thihni & Darkar</label>
                    <span className="text-[8.5px] text-purple-700 font-extrabold bg-purple-100 px-1 py-0.2 rounded">Vawiin</span>
                  </div>
                  <input
                    type="datetime-local"
                    value={thihni ? thihni.substring(0, 16) : getTodayDateTimeLocal(6, 0, 0)}
                    onChange={(e) => setThihni(e.target.value)}
                    className="w-full bg-white border border-purple-300 rounded-xl p-2 font-bold text-slate-900 text-[10px] focus:border-purple-600"
                  />
                  <div className="flex items-center gap-1 mt-1 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setThihni(getTodayDateTimeLocal(6, 0, 0))}
                      className="text-[8.5px] bg-purple-100 hover:bg-purple-200 text-purple-900 font-bold px-1.5 py-0.5 rounded cursor-pointer transition"
                    >
                      📅 Vawiin Zing
                    </button>
                    <button
                      type="button"
                      onClick={() => setThihni(getTodayDateTimeLocal(18, 0, 0))}
                      className="text-[8.5px] bg-purple-50 hover:bg-purple-100 text-purple-800 font-semibold px-1.5 py-0.5 rounded cursor-pointer transition"
                    >
                      Vawiin Tlai
                    </button>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[10px] font-bold text-purple-950">Vui Hun</label>
                    <span className="text-[8.5px] text-purple-700 font-extrabold bg-purple-100 px-1 py-0.2 rounded">Vawiin</span>
                  </div>
                  <input
                    type="datetime-local"
                    value={vuiHun ? vuiHun.substring(0, 16) : getTodayDateTimeLocal(13, 0, 0)}
                    onChange={(e) => setVuiHun(e.target.value)}
                    className="w-full bg-white border border-purple-300 rounded-xl p-2 font-bold text-slate-900 text-[10px] focus:border-purple-600"
                  />
                  {vuiHun && (
                    <p className="text-[9px] text-purple-700 font-semibold mt-0.5">
                      Format: {formatDateTimeDDMMYYYY(vuiHun)}
                    </p>
                  )}
                  <div className="flex items-center gap-1 mt-1 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setVuiHun(getTodayDateTimeLocal(13, 0, 0))}
                      className="text-[8.5px] bg-purple-100 hover:bg-purple-200 text-purple-900 font-bold px-1.5 py-0.5 rounded cursor-pointer transition"
                    >
                      📅 Vawiin Chhunchawhnu
                    </button>
                    <button
                      type="button"
                      onClick={() => setVuiHun(getTodayDateTimeLocal(13, 0, 1))}
                      className="text-[8.5px] bg-purple-50 hover:bg-purple-100 text-purple-800 font-semibold px-1.5 py-0.5 rounded cursor-pointer transition"
                    >
                      Naktuk
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-purple-950 block mb-1">Vuitu Pastor / Leader</label>
                <input
                  type="text"
                  value={vuitu}
                  onChange={(e) => setVuitu(e.target.value)}
                  className="w-full bg-white border border-purple-300 rounded-xl p-2 font-bold text-slate-900 focus:border-purple-600"
                />
              </div>
            </div>
          )}

          {/* Category specific fields: KHAWLSAK */}
          {campaign.category === 'khawlsak' && (
            <div className="bg-emerald-50/70 p-3 rounded-2xl border border-emerald-200 space-y-2.5">
              <div className="flex items-center gap-1 text-emerald-950 font-black text-[11px] uppercase border-b border-emerald-200 pb-1">
                <HandHeart className="w-3.5 h-3.5 text-emerald-700" /> Khawlsak Bawm Details
              </div>

              <div>
                <label className="text-[10px] font-bold text-emerald-950 block mb-1">
                  Khawlsak Chhan / Causes (Detailed Purpose) *
                </label>
                <textarea
                  rows={2}
                  required
                  value={cause}
                  onChange={(e) => setCause(e.target.value)}
                  className="w-full bg-white border border-emerald-300 rounded-xl p-2 font-medium text-slate-900 focus:outline-none focus:border-emerald-600 text-xs leading-relaxed"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-emerald-950 block mb-1">Target Amount (₹)</label>
                  <input
                    type="number"
                    value={targetAmount}
                    onChange={(e) => setTargetAmount(e.target.value)}
                    className="w-full bg-white border border-emerald-300 rounded-xl p-2 font-bold text-slate-900"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-emerald-950 block mb-1">Max Limit / Donor (₹)</label>
                  <input
                    type="number"
                    value={maxLimit}
                    onChange={(e) => setMaxLimit(e.target.value)}
                    className="w-full bg-white border border-emerald-300 rounded-xl p-2 font-bold text-slate-900"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Category specific fields: RIKRUM (Emergency) */}
          {campaign.category === 'rikrum' && (
            <div className="bg-rose-50/70 p-3 rounded-2xl border border-rose-200 space-y-2.5">
              <div className="flex items-center gap-1 text-rose-950 font-black text-[11px] uppercase border-b border-rose-200 pb-1">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600" /> Rikrum (Emergency) Details
              </div>

              <div>
                <label className="text-[10px] font-bold text-rose-950 block mb-1">
                  Rikrum thlen Chhan / Emergency Cause & Description *
                </label>
                <textarea
                  rows={2}
                  required
                  value={cause}
                  onChange={(e) => setCause(e.target.value)}
                  className="w-full bg-white border border-rose-300 rounded-xl p-2 font-medium text-slate-900 focus:outline-none focus:border-rose-600 text-xs leading-relaxed"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-rose-950 block mb-1">Emergency Urgency</label>
                  <select
                    value={urgencyLevel}
                    onChange={(e) => setUrgencyLevel(e.target.value as any)}
                    className="w-full bg-white border border-rose-300 rounded-xl p-2 font-bold text-slate-900 text-xs"
                  >
                    <option value="CRITICAL">CRITICAL (Hmanhmawh Thlak Tak)</option>
                    <option value="URGENT">URGENT (Hmanhmawh)</option>
                    <option value="NORMAL">NORMAL</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-rose-950 block mb-1">Urgency Deadline</label>
                  <input
                    type="datetime-local"
                    value={urgencyDeadline ? urgencyDeadline.substring(0, 16) : ''}
                    onChange={(e) => setUrgencyDeadline(e.target.value)}
                    className="w-full bg-white border border-rose-300 rounded-xl p-2 font-bold text-slate-900 text-[10px]"
                  />
                  {urgencyDeadline && (
                    <p className="text-[9px] text-rose-700 font-semibold mt-0.5">
                      Format: {formatDateTimeDDMMYYYY(urgencyDeadline)}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-rose-950 block mb-1">Target Amount (₹)</label>
                  <input
                    type="number"
                    value={targetAmount}
                    onChange={(e) => setTargetAmount(e.target.value)}
                    className="w-full bg-white border border-rose-300 rounded-xl p-2 font-bold text-slate-900"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-rose-950 block mb-1">Max Limit (₹)</label>
                  <input
                    type="number"
                    value={maxLimit}
                    onChange={(e) => setMaxLimit(e.target.value)}
                    className="w-full bg-white border border-rose-300 rounded-xl p-2 font-bold text-slate-900"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Category specific fields: KUMTLUANG (Multi-Category Heads) */}
          {campaign.category === 'kumtluang' && (
            <div className="bg-blue-50/70 p-3 rounded-2xl border border-blue-200 space-y-2.5">
              <div className="flex items-center gap-1 text-blue-950 font-black text-[11px] uppercase border-b border-blue-200 pb-1">
                <InfinityIcon className="w-3.5 h-3.5 text-blue-600" /> Kumtluang (Multi-Category) Settings
              </div>

              <div>
                <label className="text-[10px] font-bold text-blue-950 block mb-1">Organization / Kohhran Hming</label>
                <input
                  type="text"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="e.g. BCM Ebenezer, Zobawk"
                  className="w-full bg-white border border-blue-300 rounded-xl p-2 font-bold text-slate-900 focus:border-blue-600"
                />
              </div>

              {/* Unique Prefix Code Editor */}
              <div className="bg-white p-2.5 rounded-xl border border-blue-200 space-y-1.5 overflow-hidden">
                <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-1">
                  <label className="text-[10px] font-black text-blue-950 uppercase tracking-wider">
                    Bawm Prefix Code
                  </label>
                  <span className="text-[9.5px] font-mono font-bold text-blue-700 truncate">
                    Sample: {editOrgCode.trim().toUpperCase() || 'EBE'}-7890
                  </span>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                  <input
                    type="text"
                    maxLength={6}
                    value={editOrgCode}
                    onChange={(e) => setEditOrgCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                    className={`w-full sm:w-24 bg-slate-50 border-2 rounded-xl p-1.5 font-mono font-black text-center text-xs tracking-wider uppercase focus:outline-none ${
                      editOrgCode.trim() && isPrefixCodeTaken(editOrgCode.trim(), campaign.id)
                        ? 'border-rose-500 text-rose-700 bg-rose-50'
                        : editOrgCode.trim()
                        ? 'border-emerald-500 text-emerald-700 bg-emerald-50'
                        : 'border-slate-300 text-slate-900 focus:border-blue-500'
                    }`}
                  />
                  <div className="flex-1 text-[10px] leading-tight">
                    {editOrgCode.trim() && isPrefixCodeTaken(editOrgCode.trim(), campaign.id) ? (
                      <span className="text-rose-600 font-bold">⚠️ Already taken by another Bawm!</span>
                    ) : (
                      <span className="text-emerald-700 font-bold">✓ Unique Prefix locked</span>
                    )}
                  </div>
                </div>

                {/* Quick Sync with Org Name button */}
                <div className="flex flex-col xs:flex-row items-start xs:items-center justify-between gap-1 pt-1 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      const text = orgName.trim() || title.trim() || 'BAW';
                      const derived = derivePrefixFromText(text);
                      if (isPrefixCodeTaken(derived, campaign.id)) {
                        const alts = suggestAlternativePrefixes(text);
                        setEditOrgCode(alts[0] || derived);
                      } else {
                        setEditOrgCode(derived);
                      }
                    }}
                    className="text-[9.5px] text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-blue-50 hover:bg-blue-100 transition cursor-pointer"
                  >
                    <RefreshCw className="w-2.5 h-2.5 text-blue-600 shrink-0" />
                    <span>Org Name atangin Sync rawh</span>
                  </button>
                  <span className="text-[8.5px] text-slate-400 font-medium">Member ID auto-update nghal ang</span>
                </div>

                {editOrgCode.trim() && isPrefixCodeTaken(editOrgCode.trim(), campaign.id) && (
                  <div className="bg-rose-50 p-2 rounded-lg border border-rose-200 space-y-1">
                    <div className="text-[9.5px] font-bold text-rose-900 flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-amber-600" />
                      <span>Available Suggestions:</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {suggestAlternativePrefixes(editOrgCode || orgName).map((alt) => (
                        <button
                          key={alt}
                          type="button"
                          onClick={() => setEditOrgCode(alt)}
                          className="bg-white hover:bg-rose-100 border border-rose-300 text-rose-900 font-mono font-black text-[10px] px-2 py-0.5 rounded shadow-2xs cursor-pointer"
                        >
                          {alt} (Free)
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Fund Heads List */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-blue-950 block">
                  Category / Fund Heads ({subCategories.length})
                </label>
                
                <div className="flex flex-wrap gap-1.5">
                  {subCategories.map((head, idx) => (
                    <span 
                      key={idx}
                      className="bg-white border border-blue-300 text-blue-900 font-bold px-2.5 py-1 rounded-xl text-xs flex items-center gap-1 shadow-2xs"
                    >
                      <span>{head}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveSubCat(idx)}
                        className="text-rose-500 hover:text-rose-700 ml-1 font-black cursor-pointer"
                        title="Paih rawh"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>

                <div className="flex gap-1.5 pt-1">
                  <input
                    type="text"
                    value={newSubCatInput}
                    onChange={(e) => setNewSubCatInput(e.target.value)}
                    placeholder="Head thar hming (e.g. Relief Fund)..."
                    className="flex-1 bg-white border border-blue-300 rounded-xl px-2.5 py-1.5 font-medium text-slate-900 text-xs focus:outline-none focus:border-blue-600"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddSubCat();
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleAddSubCat}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-3 py-1.5 rounded-xl text-xs shadow-xs cursor-pointer flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Dah Belh
                  </button>
                </div>
              </div>

              {/* Bial / Section / Veng Structure Setup (Dropdown & Clean Data Sorting) */}
              <div className="bg-white p-3 rounded-2xl border border-blue-200 space-y-2.5 overflow-hidden">
                <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-1">
                  <label className="text-[10.5px] font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span>Bial / Section Dropdown Setup</span>
                  </label>
                  <span className="text-[9px] bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded-md self-start xs:self-auto">
                    Pre-defined Dropdown
                  </span>
                </div>

                <p className="text-[10px] text-slate-500 font-medium leading-relaxed">
                  Member-ten spelling error an neih loh nan leh data sorting a fel fai sa nan, dropdown a an thlan tur Bial / Section list duansa a ni.
                </p>

                {/* Preset Quick Chooser */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[9.5px] font-bold text-slate-500">Quick Presets:</span>
                  {editSectionPresets.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setKumtluangSectionLabel(p.label);
                        setKumtluangSections([...p.sections]);
                      }}
                      className="text-[9.5px] font-bold px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg border border-blue-200 transition cursor-pointer"
                      title={`Apply preset: ${p.name}`}
                    >
                      {p.name}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setIsEditPresetManagerOpen(true)}
                    className="text-[9.5px] font-bold px-2 py-1 bg-slate-100 hover:bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-200 transition cursor-pointer flex items-center gap-1 shadow-2xs"
                    title="Admin Quick Presets Setup & Management"
                  >
                    <Sliders className="w-3 h-3 text-indigo-600" />
                    <span>⚙️ Setup Presets</span>
                  </button>
                </div>

                <div className="flex flex-col sm:grid sm:grid-cols-2 gap-2 pt-1">
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 block mb-1">
                      Label Hming (Dynamic Label)
                    </label>
                    <input
                      type="text"
                      value={kumtluangSectionLabel}
                      onChange={(e) => setKumtluangSectionLabel(e.target.value)}
                      placeholder="e.g. Bial / Unit emaw Section / Veng"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 text-xs font-bold text-slate-900 focus:outline-none focus:bg-white focus:border-blue-600"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 block mb-1">
                      Add New ({kumtluangSections.length} sections)
                    </label>
                    <div className="flex gap-1">
                      <input
                        type="text"
                        value={newSectionName}
                        onChange={(e) => setNewSectionName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            if (newSectionName.trim() && !kumtluangSections.includes(newSectionName.trim())) {
                              setKumtluangSections([...kumtluangSections, newSectionName.trim()]);
                              setNewSectionName('');
                            }
                          }
                        }}
                        placeholder="+ Bial/Section..."
                        className="flex-1 min-w-0 bg-slate-50 border border-slate-300 rounded-xl p-2 text-xs font-bold text-slate-900 focus:outline-none focus:bg-white focus:border-blue-600"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (newSectionName.trim() && !kumtluangSections.includes(newSectionName.trim())) {
                            setKumtluangSections([...kumtluangSections, newSectionName.trim()]);
                            setNewSectionName('');
                          }
                        }}
                        className="px-2.5 py-1.5 shrink-0 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>

                {/* Section List Tags */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {kumtluangSections.map((sec, idx) => (
                    <span
                      key={idx}
                      className="bg-blue-50 border border-blue-200 text-blue-900 font-bold px-2 py-1 rounded-lg text-[10.5px] flex items-center gap-1 shadow-2xs max-w-full"
                    >
                      <span className="truncate">{sec}</span>
                      <button
                        type="button"
                        onClick={() => setKumtluangSections(kumtluangSections.filter((_, i) => i !== idx))}
                        className="text-rose-500 hover:text-rose-700 font-black cursor-pointer ml-1 shrink-0"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>

                {kumtluangSections.length > 0 && (
                  <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                    <span className="text-[9.5px] text-slate-500 font-medium">
                      Bial/Section <b>{kumtluangSections.length}</b> dah a ni tawh
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsEditPresetManagerOpen(true)}
                      className="text-[10px] font-bold text-blue-700 hover:text-blue-900 flex items-center gap-1 hover:underline cursor-pointer"
                      title="Save these current sections as a quick preset for future bawms"
                    >
                      <Save className="w-3 h-3 text-blue-600" />
                      <span>Save as Quick Preset</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Target (Per Month / Year / Total) for Kumtluang */}
              <div className="bg-white p-2.5 rounded-xl border border-blue-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-blue-950 flex items-center gap-1">
                    <Target className="w-3.5 h-3.5 text-blue-600" /> Target Goal (Optional)
                  </label>
                  <span className="text-[8.5px] text-slate-400">Dah loh theih</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[9.5px] font-bold text-slate-600 block mb-1">Target Amount (₹)</label>
                    <input
                      type="number"
                      value={targetAmount}
                      onChange={(e) => setTargetAmount(e.target.value)}
                      placeholder="e.g. 100000 (Dah loh theih)"
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 font-bold text-slate-900 focus:bg-white focus:border-blue-600 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[9.5px] font-bold text-slate-600 block mb-1">Target Period</label>
                    <select
                      value={targetPeriod}
                      onChange={(e) => setTargetPeriod(e.target.value as 'monthly' | 'yearly' | 'total')}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 font-bold text-slate-900 focus:bg-white focus:border-blue-600 text-xs"
                    >
                      <option value="monthly">Per Month (Thla tin)</option>
                      <option value="yearly">Per Year (Kum tin)</option>
                      <option value="total">Overall / Total Goal</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Fee Bearer for Kumtluang */}
              <div className="pt-1">
                <label className="text-[10px] font-bold text-blue-950 block mb-1">1% Platform Fee Tu Chawi Tur?</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setKumtluangFeeBearer('org_paid')}
                    className={`p-2 rounded-xl text-left border font-bold transition text-xs cursor-pointer ${
                      kumtluangFeeBearer === 'org_paid' 
                        ? 'bg-blue-600 text-white border-blue-700 shadow-xs' 
                        : 'bg-white text-slate-700 border-slate-200'
                    }`}
                  >
                    <p className="font-extrabold text-[10.5px]">Organization Chawi</p>
                    <p className="text-[8.5px] opacity-80">Donation atangin 1% paih a ni ang</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setKumtluangFeeBearer('user_paid')}
                    className={`p-2 rounded-xl text-left border font-bold transition text-xs cursor-pointer ${
                      kumtluangFeeBearer === 'user_paid' 
                        ? 'bg-blue-600 text-white border-blue-700 shadow-xs' 
                        : 'bg-white text-slate-700 border-slate-200'
                    }`}
                  >
                    <p className="font-extrabold text-[10.5px]">Petu Chawi</p>
                    <p className="text-[8.5px] opacity-80">Donor-in 1% extra a pe ang</p>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* GPS Coordinates Tag */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-[10.5px] font-bold text-slate-700">GPS Coordinates (Google Maps)</label>
              <button
                type="button"
                onClick={handleDetectGPS}
                className="text-[9.5px] text-indigo-600 font-bold hover:underline flex items-center gap-0.5 cursor-pointer"
              >
                <Crosshair className="w-3 h-3" /> Detect Live GPS
              </button>
            </div>
            <input
              type="text"
              value={gpsCoords}
              onChange={(e) => setGpsCoords(e.target.value)}
              placeholder="23.7271, 92.7176"
              className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 font-mono text-slate-900 text-xs focus:outline-none focus:bg-white focus:border-indigo-600"
            />
          </div>

          {/* UPI ID & Status */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10.5px] font-bold text-slate-700 block mb-1">Settlement UPI ID *</label>
              <input
                type="text"
                required
                value={upiId}
                onChange={(e) => setUpiId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 font-bold text-slate-900 focus:outline-none focus:bg-white focus:border-indigo-600"
              />
            </div>
            <div>
              <label className="text-[10.5px] font-bold text-slate-700 block mb-1">QR Status</label>
              <select
                value={status}
                onChange={(e) => {
                  const val = e.target.value as any;
                  setStatus(val);
                }}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 font-bold text-slate-900 focus:outline-none"
              >
                <option value="active">Active (Pawisa pek theih)</option>
                <option value="expired">Expired (Closed / A tawp tawh)</option>
                <option value="pending_approval">Reactivate (Admin Approval Required)</option>
              </select>
            </div>
          </div>

          {/* Admin Approval Notice if Reactivation is selected or previous was expired */}
          {(campaign.status === 'expired' || isCampaignExpired(campaign.validityDate, campaign.status)) && (status === 'active' || status === 'pending_approval') && (
            <div className="bg-amber-50 border border-amber-300 rounded-xl p-2.5 text-[11px] text-amber-900 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-black block">Admin Approval Required for Reactivation</span>
                <span>He Bawm hi Expired a nih tawh avangin, Reactivate i dilna hi Admin Approval hnuah chauh a active leh ang.</span>
              </div>
            </div>
          )}

          {/* Validity & Quick Extend */}
          <div className="space-y-1.5 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
            <div className="flex justify-between items-center">
              <label className="text-[10.5px] font-bold text-slate-700">QR Validity Date & Time *</label>
              <span className="text-[9.5px] font-bold text-indigo-600">
                {validityDate ? formatDateDDMMYYYY(validityDate) : 'Not set'}
              </span>
            </div>
            <input
              type="datetime-local"
              value={validityDate ? validityDate.substring(0, 16) : ''}
              onChange={(e) => setValidityDate(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-xl p-2 font-bold text-slate-900 text-[10.5px] focus:outline-none focus:border-indigo-600"
            />
            <div className="flex items-center gap-1.5 pt-1 flex-wrap">
              <span className="text-[9.5px] text-slate-500 font-bold">Quick Extend (from Today):</span>
              <button
                type="button"
                onClick={() => {
                  const now = new Date();
                  now.setDate(now.getDate() + 7);
                  setValidityDate(now.toISOString());
                  if (campaign.status === 'expired') {
                    setStatus('pending_approval');
                  }
                }}
                className="text-[9.5px] bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold px-2 py-0.5 rounded-lg border border-indigo-200 cursor-pointer"
              >
                +7 Ni
              </button>
              <button
                type="button"
                onClick={() => {
                  const now = new Date();
                  now.setDate(now.getDate() + 30);
                  setValidityDate(now.toISOString());
                  if (campaign.status === 'expired') {
                    setStatus('pending_approval');
                  }
                }}
                className="text-[9.5px] bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold px-2 py-0.5 rounded-lg border border-indigo-200 cursor-pointer"
              >
                +30 Ni
              </button>
              <button
                type="button"
                onClick={() => {
                  const now = new Date();
                  now.setFullYear(now.getFullYear() + 1);
                  setValidityDate(now.toISOString());
                  if (campaign.status === 'expired') {
                    setStatus('pending_approval');
                  }
                }}
                className="text-[9.5px] bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold px-2 py-0.5 rounded-lg border border-indigo-200 cursor-pointer"
              >
                +1 Kum
              </button>
              <button
                type="button"
                onClick={() => {
                  const now = new Date();
                  now.setDate(now.getDate() + 30);
                  setValidityDate(now.toISOString());
                  if (campaign.status === 'expired') {
                    setStatus('pending_approval');
                  }
                }}
                className="text-[9.5px] bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-black px-2 py-0.5 rounded-lg border border-emerald-300 cursor-pointer flex items-center gap-1"
              >
                ⚡ Request Reactivate (+30 Ni)
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl transition cursor-pointer text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-black py-2.5 rounded-xl transition cursor-pointer text-xs shadow-md flex items-center justify-center gap-1.5"
            >
              <Check className="w-4 h-4" /> Save Siamthatna
            </button>
          </div>
        </form>

        {/* SECTION PRESET MANAGER MODAL (Edit View) */}
        <SectionPresetManagerModal
          isOpen={isEditPresetManagerOpen}
          onClose={() => setIsEditPresetManagerOpen(false)}
          onApplyPreset={(preset) => {
            setKumtluangSectionLabel(preset.label);
            setKumtluangSections([...preset.sections]);
          }}
          currentSections={kumtluangSections}
          currentLabel={kumtluangSectionLabel}
          isAdmin={Boolean(creatorProfile?.isAdmin || (creatorProfile && getUserRole(creatorProfile) === 'SUPER_ADMIN') || (creatorProfile && getUserRole(creatorProfile) === 'ADMIN'))}
        />
      </div>
    </div>
  );
};
