import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  ShieldCheck, 
  KeyRound, 
  Users, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  FileText, 
  Settings, 
  Sparkles, 
  Award, 
  AlertTriangle,
  Lock,
  Unlock,
  Trash2,
  Edit,
  Edit3,
  Image as ImageIcon,
  Plus,
  RefreshCw,
  Search,
  ExternalLink,
  DollarSign,
  TrendingUp,
  Download,
  Upload,
  Building,
  Smartphone,
  Fingerprint,
  ScanFace,
  Megaphone,
  History,
  Database,
  Ban,
  Check,
  Percent,
  Calendar,
  Layers,
  Eye,
  Sliders,
  Save,
  RotateCcw,
  Tag,
  Coins,
  Receipt,
  AlertCircle,
  Trophy,
  Crown,
  Medal,
  UserCheck,
  ChevronLeft,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  Play,
  Pause,
  ArrowRight
} from 'lucide-react';
import { 
  Campaign, 
  CreatorProfile, 
  Transaction, 
  BawmCategory, 
  SystemPricingConfig, 
  BawmFeeRule, 
  AuditLog, 
  AnnouncementBanner,
  AnnouncementItem
} from '../types';
import { formatDateDDMMYYYY } from '../utils/date';
import { BAWM_CONFIG, DEFAULT_PRICING_CONFIG } from '../data/initialData';
import { 
  exportFullDatabaseBackup, 
  restoreFullDatabaseBackup, 
  recordAuditLog,
  getStoredAuditLogs,
  getStoredAnnouncement,
  saveStoredAnnouncement,
  DEFAULT_ANNOUNCEMENT_ITEMS
} from '../utils/storage';

interface AdminDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaigns: Campaign[];
  transactions: Transaction[];
  creators: CreatorProfile[];
  pricingConfig: SystemPricingConfig;
  announcement?: AnnouncementBanner;
  auditLogs?: AuditLog[];
  onUpdatePricingConfig: (config: SystemPricingConfig) => void;
  onUpdateCampaign: (campaign: Campaign) => void;
  onDeleteCampaign?: (campaignId: string) => void;
  onApproveCampaign: (campaign: Campaign) => void;
  onRejectCampaign?: (campaignId: string, remarks?: string) => void;
  onUpdateCreator: (creator: CreatorProfile) => void;
  onBlockCreator?: (creatorPhone: string, isBlocked: boolean) => void;
  onApproveCreatorRegistration?: (creator: CreatorProfile, categories: BawmCategory[], validityDays: number) => void;
  onRejectCreatorRegistration?: (creatorPhone: string, reason: string) => void;
  onUpdateAnnouncement?: (ann: AnnouncementBanner) => void;
  onRestoreDatabase?: (jsonString: string) => boolean;
  onResetData: () => void;
}

export const AdminDashboardModal: React.FC<AdminDashboardModalProps> = ({
  isOpen,
  onClose,
  campaigns,
  transactions,
  creators,
  pricingConfig,
  announcement,
  auditLogs,
  onUpdatePricingConfig,
  onUpdateCampaign,
  onDeleteCampaign,
  onApproveCampaign,
  onRejectCampaign,
  onUpdateCreator,
  onBlockCreator,
  onApproveCreatorRegistration,
  onRejectCreatorRegistration,
  onUpdateAnnouncement,
  onRestoreDatabase,
  onResetData,
}) => {
  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem('ronpay_admin_auth') === 'true';
    } catch (e) {
      return false;
    }
  });
  const [adminUserId, setAdminUserId] = useState<string>('admin');
  const [adminPassword, setAdminPassword] = useState<string>('ronpay2026');
  const [loginError, setLoginError] = useState<string>('');
  const [isBiometricScanning, setIsBiometricScanning] = useState<boolean>(false);

  // Admin tabs
  const [activeTab, setActiveTab] = useState<'creators' | 'campaigns' | 'announcement' | 'audit' | 'backup' | 'rates' | 'finances' | 'gateway'>('campaigns');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Creators sub-filter
  const [creatorFilter, setCreatorFilter] = useState<'all' | 'pending' | 'approved' | 'blocked'>('all');
  
  // Campaigns sub-filter
  const [campaignFilter, setCampaignFilter] = useState<'all' | 'pending' | 'active' | 'rejected'>('all');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');

  // Rates / Pricing state
  const [localPricing, setLocalPricing] = useState<SystemPricingConfig>(pricingConfig || DEFAULT_PRICING_CONFIG);
  const [activePricingCategory, setActivePricingCategory] = useState<BawmCategory>('khawlsak');
  const [saveSuccessNotice, setSaveSuccessNotice] = useState<boolean>(false);
  const [testAmount, setTestAmount] = useState<number>(1000);

  // Announcement state
  const [localAnnouncement, setLocalAnnouncement] = useState<AnnouncementBanner>(() => {
    const raw = announcement || getStoredAnnouncement();
    const items = raw.items && raw.items.length > 0 ? raw.items : DEFAULT_ANNOUNCEMENT_ITEMS;
    return {
      ...raw,
      items,
      animationStyle: raw.animationStyle || 'slide',
      autoRotate: raw.autoRotate !== false,
      rotationSpeedSeconds: raw.rotationSpeedSeconds || 4
    };
  });
  const [announcementSavedNotice, setAnnouncementSavedNotice] = useState<boolean>(false);
  const [previewAnnounceIdx, setPreviewAnnounceIdx] = useState<number>(0);
  const [isPreviewPaused, setIsPreviewPaused] = useState<boolean>(false);
  const [activeEditingItemId, setActiveEditingItemId] = useState<string>('ann-1');

  // Sync preview timer
  useEffect(() => {
    const items = localAnnouncement.items || [];
    if (!localAnnouncement.autoRotate || isPreviewPaused || items.length <= 1) return;
    const interval = setInterval(() => {
      setPreviewAnnounceIdx((prev) => (prev + 1) % items.length);
    }, Math.max(2, localAnnouncement.rotationSpeedSeconds || 4) * 1000);
    return () => clearInterval(interval);
  }, [localAnnouncement.autoRotate, isPreviewPaused, localAnnouncement.items, localAnnouncement.rotationSpeedSeconds]);

  // Audit Logs state
  const [logsList, setLogsList] = useState<AuditLog[]>(() => {
    return auditLogs || getStoredAuditLogs();
  });
  const [auditFilter, setAuditFilter] = useState<string>('all');

  // Creator License & Custom Override Modal
  const [editingCreator, setEditingCreator] = useState<CreatorProfile | null>(null);
  const [creatorEditName, setCreatorEditName] = useState<string>('');
  const [creatorEditOrgName, setCreatorEditOrgName] = useState<string>('');
  const [creatorEditDesignation, setCreatorEditDesignation] = useState<string>('');
  const [creatorEditPhone, setCreatorEditPhone] = useState<string>('');
  const [isCreatorTrialActiveToggle, setIsCreatorTrialActiveToggle] = useState<boolean>(true);
  const [licenseDuration, setLicenseDuration] = useState<number>(180); // days
  const [selectedCreatorCategories, setSelectedCreatorCategories] = useState<BawmCategory[]>(['ralna', 'khawlsak']);
  const [creatorFreePostsQuota, setCreatorFreePostsQuota] = useState<number>(10);
  const [customPlatformFee, setCustomPlatformFee] = useState<number | ''>('');
  const [isLifetimeFreeGranted, setIsLifetimeFreeGranted] = useState<boolean>(false);
  // Per-category granular overrides for specific creator
  const [categoryOverridesMap, setCategoryOverridesMap] = useState<Partial<Record<BawmCategory, { isTrialActive?: boolean; platformFeePercent?: number; freePostsQuota?: number }>>>({});

  // Creator View Mode & Password Reset
  const [creatorViewMode, setCreatorViewMode] = useState<'list' | 'ranking'>('list');
  const [resettingPasswordCreator, setResettingPasswordCreator] = useState<CreatorProfile | null>(null);
  const [newCreatorPassword, setNewCreatorPassword] = useState<string>('');
  const [resetSuccessToast, setResetSuccessToast] = useState<string | null>(null);

  // Admin Campaign Edit Modal
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);

  // Restore file state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [restoreNotice, setRestoreNotice] = useState<{ message: string; isError?: boolean } | null>(null);

  // Sync pricing & announcements when props change
  useEffect(() => {
    if (pricingConfig) setLocalPricing(pricingConfig);
  }, [pricingConfig]);

  useEffect(() => {
    if (announcement) setLocalAnnouncement(announcement);
  }, [announcement]);

  useEffect(() => {
    if (isOpen) {
      try {
        if (sessionStorage.getItem('ronpay_admin_auth') === 'true') {
          setIsAuthenticated(true);
        }
      } catch (e) {
        // ignore
      }
    }
  }, [isOpen]);

  // Biometric Login handler for Admin
  const handleAdminBiometricLogin = () => {
    setIsBiometricScanning(true);
    setLoginError('');
    
    // Simulate biometric check with feedback
    setTimeout(() => {
      setIsBiometricScanning(false);
      setIsAuthenticated(true);
      try {
        sessionStorage.setItem('ronpay_admin_auth', 'true');
      } catch (e) {
        // ignore
      }
      recordAuditLog('Admin Biometric Login', 'Administrator authenticated via Biometrics (Fingerprint/FaceID).', 'system');
      setLogsList(getStoredAuditLogs());
    }, 850);
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (
      (adminUserId.trim().toLowerCase() === 'admin' || adminUserId.trim().toLowerCase() === 'admin@ronpay.mizoram.gov.in') &&
      (adminPassword === 'admin' || adminPassword === 'ronpay2026' || adminPassword === 'ronpay@admin2026')
    ) {
      setIsAuthenticated(true);
      setLoginError('');
      try {
        sessionStorage.setItem('ronpay_admin_auth', 'true');
      } catch (e) {
        // ignore
      }
      recordAuditLog('Admin Password Login', 'Administrator authenticated via Master Credentials.', 'system');
      setLogsList(getStoredAuditLogs());
    } else {
      setLoginError('User ID emaw Password a dik lo. (Default: admin / ronpay2026)');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    try {
      sessionStorage.removeItem('ronpay_admin_auth');
    } catch (e) {
      // ignore
    }
    setAdminUserId('admin');
    setAdminPassword('');
  };

  // Pending counts
  const pendingCreators = creators.filter(c => !c.isApproved);
  const pendingCampaigns = campaigns.filter(c => c.status === 'pending_approval');
  const rejectedCampaigns = campaigns.filter(c => c.status === 'rejected');
  const activeCampaigns = campaigns.filter(c => c.status === 'active');

  // Creator moderation helper
  const handleOpenCreatorEditor = (creator: CreatorProfile) => {
    setEditingCreator(creator);
    setCreatorEditName(creator.name || '');
    setCreatorEditOrgName(creator.orgName || '');
    setCreatorEditDesignation(creator.designation || '');
    setCreatorEditPhone(creator.phone || '');
    setSelectedCreatorCategories(creator.approvedCategories?.length > 0 ? creator.approvedCategories : ['ralna', 'khawlsak', 'rikrum', 'kumtluang']);
    const isTrialExpired = creator.trialExpiresAt ? new Date(creator.trialExpiresAt).getTime() <= Date.now() : (creator.customTrialDays === 0);
    setIsCreatorTrialActiveToggle(!isTrialExpired);
    setLicenseDuration(creator.customTrialDays !== undefined ? creator.customTrialDays : 180);
    setCreatorFreePostsQuota(creator.freePostsQuota !== undefined ? creator.freePostsQuota : 10);
    setCustomPlatformFee(creator.customPlatformFeePercent !== undefined ? creator.customPlatformFeePercent : '');
    setIsLifetimeFreeGranted(!!creator.isFreeServiceGranted);
    setCategoryOverridesMap(creator.categoryCustomOverrides || {});
  };

  // Creator moderation
  const handleApproveCreator = (creator: CreatorProfile) => {
    let expiresAt: Date;
    if (!isCreatorTrialActiveToggle || licenseDuration === 0) {
      // Set expired date (in the past) so that paid platform fee takes effect immediately
      expiresAt = new Date(Date.now() - 24 * 60 * 60 * 1000);
    } else {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + licenseDuration);
    }

    const nextName = creatorEditName.trim() || creator.name;
    const nextOrg = creatorEditOrgName.trim();
    const nextDesignation = creatorEditDesignation.trim();
    const nextPhone = creatorEditPhone.trim() || creator.phone;

    const updated: CreatorProfile = {
      ...creator,
      name: nextName,
      orgName: nextOrg,
      designation: nextDesignation,
      phone: nextPhone,
      isApproved: true,
      isBlocked: false,
      isPhoneVerified: true,
      approvedCategories: selectedCreatorCategories.length > 0 ? selectedCreatorCategories : ['ralna', 'khawlsak', 'rikrum', 'kumtluang'],
      trialExpiresAt: expiresAt.toISOString(),
      customTrialDays: (!isCreatorTrialActiveToggle || licenseDuration === 0) ? 0 : licenseDuration,
      freePostsQuota: creatorFreePostsQuota,
      customPlatformFeePercent: customPlatformFee === '' ? undefined : Number(customPlatformFee),
      isFreeServiceGranted: isLifetimeFreeGranted,
      categoryCustomOverrides: categoryOverridesMap,
    };

    onUpdateCreator(updated);
    recordAuditLog(
      'Creator Profile & Rights Updated',
      `Updated profile & privileges for ${nextName} (${nextPhone}): Trial: ${isCreatorTrialActiveToggle && licenseDuration > 0 ? licenseDuration + ' days' : 'OFF (Paid Fee Active)'}, ${creatorFreePostsQuota} free posts quota, ${customPlatformFee !== '' ? customPlatformFee + '% fee' : 'default fee'}, Category Overrides: ${Object.keys(categoryOverridesMap).length} categories customized, Lifetime VIP: ${isLifetimeFreeGranted ? 'Yes' : 'No'}.`,
      'creator',
      nextPhone
    );
    setLogsList(getStoredAuditLogs());
    setEditingCreator(null);
    alert(`✅ CREATOR PROFILE & OFFER SAVED!\n\n${nextName} (${nextPhone}) tana Profile Details, Trial, Category-specific Rates, leh Free Quota update fel a ni e.`);
  };

  const handleRejectCreator = (creator: CreatorProfile) => {
    const reason = prompt('Rejection reason (Mizo/English):', 'In-verify-na lehkha a chiang tawk lo');
    if (reason === null) return;

    const updated: CreatorProfile = {
      ...creator,
      isApproved: false,
      rejectionReason: reason
    };

    if (onRejectCreatorRegistration) {
      onRejectCreatorRegistration(creator.phone, reason);
    } else {
      onUpdateCreator(updated);
    }

    recordAuditLog(
      'Creator Application Rejected',
      `Rejected registration for ${creator.name} (${creator.phone}). Reason: ${reason}`,
      'creator',
      creator.phone
    );
    setLogsList(getStoredAuditLogs());
  };

  const handleToggleBlockCreator = (creator: CreatorProfile) => {
    const isCurrentlyBlocked = !!creator.isBlocked;
    const nextBlocked = !isCurrentlyBlocked;

    const updated: CreatorProfile = {
      ...creator,
      isBlocked: nextBlocked
    };

    if (onBlockCreator) {
      onBlockCreator(creator.phone, nextBlocked);
    } else {
      onUpdateCreator(updated);
    }

    recordAuditLog(
      nextBlocked ? 'Creator Blocked' : 'Creator Unblocked',
      `${nextBlocked ? 'Blocked' : 'Unblocked'} creator account for ${creator.name} (${creator.phone}).`,
      'creator',
      creator.phone
    );
    setLogsList(getStoredAuditLogs());
  };

  // Password / PIN reset handler for Creator
  const handleResetPasswordConfirm = (creator: CreatorProfile, passwordToSet: string) => {
    if (!passwordToSet.trim()) {
      alert('Khawngaihin password/PIN thar dah rawh.');
      return;
    }

    const updated: CreatorProfile = {
      ...creator,
      password: passwordToSet.trim(),
      pin: passwordToSet.trim(),
      isPhoneVerified: true
    };

    onUpdateCreator(updated);
    recordAuditLog(
      'Creator Password Reset',
      `Admin successfully reset Password / Security PIN for ${creator.name} (${creator.phone}). New credentials assigned.`,
      'creator',
      creator.phone
    );
    setLogsList(getStoredAuditLogs());
    setResettingPasswordCreator(null);
    setNewCreatorPassword('');
    setResetSuccessToast(`✅ Password for ${creator.name} (${creator.phone}) has been reset to: ${passwordToSet.trim()}`);
    setTimeout(() => setResetSuccessToast(null), 8000);
  };

  const handleGenerateRandomPin = () => {
    const randomPin = Math.floor(100000 + Math.random() * 900000).toString();
    setNewCreatorPassword(randomPin);
  };

  // Creator Rankings Leaderboard calculation
  const creatorRankings = React.useMemo(() => {
    return creators.map(c => {
      const cCampaigns = campaigns.filter(
        camp => camp.createdBy === c.phone || camp.createdBy === c.name || (camp.orgName && camp.orgName === c.orgName)
      );
      const cCampIds = new Set(cCampaigns.map(camp => camp.id));
      const cTxns = transactions.filter(
        t => cCampIds.has(t.campaignId) || cCampaigns.some(camp => camp.title === t.campaignTitle)
      );
      const totalVolume = cTxns.reduce((sum, t) => sum + t.amount, 0);

      return {
        creator: c,
        campaignsCount: cCampaigns.length,
        transactionsCount: cTxns.length,
        totalVolume,
        verifiedStatus: c.isApproved && !c.isBlocked ? 'Verified' : c.isBlocked ? 'Blocked' : 'Pending'
      };
    }).sort((a, b) => b.totalVolume - a.totalVolume || b.campaignsCount - a.campaignsCount);
  }, [creators, campaigns, transactions]);

  // Campaign moderation
  const handleApproveCampaignClick = (camp: Campaign) => {
    const updated: Campaign = {
      ...camp,
      status: 'active',
      approvedAt: new Date().toISOString(),
      approvedBy: 'Admin'
    };
    onApproveCampaign(updated);
    recordAuditLog(
      'Campaign Approved & Activated',
      `Approved QR Campaign '${camp.title}' (${camp.id}) in category ${camp.category}. QR is now LIVE.`,
      'campaign',
      camp.id
    );
    setLogsList(getStoredAuditLogs());
    alert(`✅ CAMPAIGN APPROVED!\n\n'${camp.title}' is now ACTIVE and ready to receive donations.`);
  };

  const handleRejectCampaignClick = (camp: Campaign) => {
    const remarks = prompt('Rejection remarks / Reason:', 'Beneficiary details or UPI ID needs verification');
    if (remarks === null) return;

    const updated: Campaign = {
      ...camp,
      status: 'rejected',
      approvalRemarks: remarks
    };

    if (onRejectCampaign) {
      onRejectCampaign(camp.id, remarks);
    } else {
      onUpdateCampaign(updated);
    }

    recordAuditLog(
      'Campaign Rejected',
      `Rejected QR Campaign '${camp.title}' (${camp.id}). Remark: ${remarks}`,
      'campaign',
      camp.id
    );
    setLogsList(getStoredAuditLogs());
  };

  const handleSaveCampaignEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCampaign) return;

    onUpdateCampaign(editingCampaign);
    recordAuditLog(
      'Admin Edited Campaign Post',
      `Admin updated details of post/campaign '${editingCampaign.title}' (${editingCampaign.id}). Category: ${editingCampaign.category}, Status: ${editingCampaign.status}.`,
      'campaign',
      editingCampaign.id
    );
    setLogsList(getStoredAuditLogs());
    const campTitle = editingCampaign.title;
    setEditingCampaign(null);
    alert(`✅ CAMPAIGN POST UPDATED!\n\n'${campTitle}' has been successfully updated.`);
  };

  // Announcement Save
  const handleSaveAnnouncement = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: AnnouncementBanner = {
      ...localAnnouncement,
      updatedAt: new Date().toISOString()
    };
    saveStoredAnnouncement(updated);
    if (onUpdateAnnouncement) {
      onUpdateAnnouncement(updated);
    }
    recordAuditLog(
      'Announcement Updated',
      `Updated community announcement: "${updated.title}" (Active: ${updated.isActive})`,
      'announcement'
    );
    setLogsList(getStoredAuditLogs());
    setAnnouncementSavedNotice(true);
    setTimeout(() => setAnnouncementSavedNotice(false), 3000);
  };

  // Backup Export
  const handleExportBackup = () => {
    const jsonString = exportFullDatabaseBackup();
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ronpay_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setLogsList(getStoredAuditLogs());
  };

  // Backup Restore
  const handleFileRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result as string;
      if (!content) return;

      const result = restoreFullDatabaseBackup(content);
      if (result.success) {
        setRestoreNotice({
          message: `✅ Backup successfully restored! Loaded ${result.counts?.campaigns} campaigns, ${result.counts?.transactions} transactions, and ${result.counts?.creators} creators.`
        });
        if (onRestoreDatabase) {
          onRestoreDatabase(content);
        }
        setLogsList(getStoredAuditLogs());
        setTimeout(() => window.location.reload(), 1500);
      } else {
        setRestoreNotice({
          message: `❌ Failed to restore: ${result.error}`,
          isError: true
        });
      }
    };
    reader.readAsText(file);
  };

  // Filtered Creators list
  const filteredCreators = creators.filter(c => {
    if (creatorFilter === 'pending' && c.isApproved) return false;
    if (creatorFilter === 'approved' && (!c.isApproved || c.isBlocked)) return false;
    if (creatorFilter === 'blocked' && !c.isBlocked) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        c.name.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        (c.orgName && c.orgName.toLowerCase().includes(q))
      );
    }
    return true;
  });

  // Filtered Campaigns list
  const filteredCampaigns = campaigns.filter(c => {
    if (campaignFilter === 'pending' && c.status !== 'pending_approval') return false;
    if (campaignFilter === 'active' && c.status !== 'active') return false;
    if (campaignFilter === 'rejected' && c.status !== 'rejected') return false;
    if (selectedCategoryFilter !== 'all' && c.category !== selectedCategoryFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        c.title.toLowerCase().includes(q) ||
        c.location.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q) ||
        (c.mitthiHming && c.mitthiHming.toLowerCase().includes(q))
      );
    }
    return true;
  });

  // Financial Stats
  const totalVolume = transactions.reduce((acc, t) => acc + t.amount, 0);
  const totalPlatformFees = transactions.reduce((acc, t) => acc + (t.platformFee || Math.round(t.amount * 0.01)), 0);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/85 z-50 flex items-center justify-center p-2 sm:p-4 backdrop-blur-sm animate-fadeIn text-slate-800">
      <div className="bg-white w-full max-w-4xl max-h-[95vh] rounded-3xl shadow-2xl border border-indigo-200 relative flex flex-col overflow-hidden">
        
        {/* Top Header */}
        <div className="bg-slate-900 text-white p-4 sm:p-5 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center shadow-md border border-indigo-400/40">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-white tracking-wide">RonPay Admin Console</h2>
                <span className="text-[9.5px] font-extrabold bg-indigo-500/30 text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-400/40 uppercase">
                  v2.5 Master
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Community Moderation, Biometric Security & Core Platform Config</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-xs border border-indigo-400/40"
              title="Return to user app view"
            >
              <Smartphone className="w-3.5 h-3.5 text-amber-300" />
              <span>App En Rawh</span>
            </button>

            {isAuthenticated && (
              <button
                onClick={handleLogout}
                className="bg-slate-800 hover:bg-rose-900/60 hover:text-rose-200 text-slate-300 text-xs font-bold px-3 py-1.5 rounded-xl border border-slate-700 transition flex items-center gap-1.5 cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Logout</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 flex items-center justify-center transition cursor-pointer"
              title="Close Admin Panel"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Auth Guard Screen */}
        {!isAuthenticated ? (
          <div className="p-6 sm:p-10 flex-1 overflow-y-auto flex flex-col items-center justify-center text-center space-y-5">
            <div className="w-16 h-16 rounded-3xl bg-indigo-50 border-2 border-indigo-200 text-indigo-600 flex items-center justify-center shadow-lg">
              <KeyRound className="w-8 h-8" />
            </div>

            <div className="space-y-1 max-w-sm">
              <h3 className="text-lg font-black text-slate-900">Admin Authentication Required</h3>
              <p className="text-xs text-slate-500">
                Log in using Biometrics (Fingerprint / Face ID) or Master Credentials.
              </p>
            </div>

            {/* Quick Biometric Admin Unlock */}
            <div className="w-full max-w-xs space-y-3">
              <button
                type="button"
                onClick={handleAdminBiometricLogin}
                disabled={isBiometricScanning}
                className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-black text-xs shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
              >
                <Fingerprint className={`w-5 h-5 ${isBiometricScanning ? 'animate-pulse text-amber-300' : ''}`} />
                {isBiometricScanning ? 'Scanning Admin Biometrics...' : 'Admin Biometric Login (Instant)'}
              </button>

              <div className="flex items-center gap-2 text-slate-300 my-2">
                <div className="h-px bg-slate-200 flex-1" />
                <span className="text-[10px] font-bold text-slate-400 uppercase">Or Master Password</span>
                <div className="h-px bg-slate-200 flex-1" />
              </div>

              {/* Password Form */}
              <form onSubmit={handleLogin} className="space-y-3 text-left">
                <div>
                  <label className="text-[10.5px] font-extrabold text-slate-600 uppercase">Admin Username</label>
                  <input
                    type="text"
                    value={adminUserId}
                    onChange={(e) => setAdminUserId(e.target.value)}
                    className="w-full mt-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:border-indigo-600 focus:outline-none"
                    placeholder="admin"
                  />
                </div>
                <div>
                  <label className="text-[10.5px] font-extrabold text-slate-600 uppercase">Master Password</label>
                  <input
                    type="password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    className="w-full mt-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:border-indigo-600 focus:outline-none"
                    placeholder="ronpay2026"
                  />
                </div>

                {loginError && (
                  <p className="text-xs text-rose-600 font-bold bg-rose-50 p-2 rounded-xl border border-rose-200 text-center">
                    {loginError}
                  </p>
                )}

                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs transition cursor-pointer shadow-xs"
                >
                  Verify Master Password
                </button>
              </form>

              {/* Back to User App Button */}
              <div className="pt-2 border-t border-slate-200/80 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Smartphone className="w-3.5 h-3.5 text-indigo-600" />
                  <span>App-ah Kir Leh Rawh (Return to App)</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Authenticated Admin Workspace */
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* Tab Navigation Bar */}
            <div className="bg-slate-100/80 border-b border-slate-200/90 px-3 pt-2 flex gap-1.5 overflow-x-auto no-scrollbar shrink-0">
              {[
                { 
                  id: 'campaigns', 
                  label: 'Campaign Moderation', 
                  icon: Layers,
                  badge: pendingCampaigns.length > 0 ? pendingCampaigns.length : undefined,
                  badgeColor: 'bg-amber-500 text-white'
                },
                { 
                  id: 'creators', 
                  label: 'Creators & Approval', 
                  icon: Users,
                  badge: pendingCreators.length > 0 ? pendingCreators.length : undefined,
                  badgeColor: 'bg-indigo-600 text-white'
                },
                { 
                  id: 'announcement', 
                  label: 'Announcement Banner', 
                  icon: Megaphone,
                  badge: localAnnouncement.isActive ? 'Active' : undefined,
                  badgeColor: 'bg-emerald-600 text-white'
                },
                { id: 'audit', label: 'Audit & Activity Log', icon: History },
                { id: 'backup', label: 'Backup & Restore', icon: Database },
                { id: 'rates', label: 'Platform Rates & Fees', icon: Percent },
                { id: 'finances', label: 'Finances', icon: DollarSign },
                { id: 'gateway', label: 'PhonePe PG V2', icon: Smartphone },
              ].map(tab => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`px-3.5 py-2.5 rounded-t-2xl font-black text-xs transition-all flex items-center gap-2 shrink-0 cursor-pointer whitespace-nowrap ${
                      isActive
                        ? 'bg-white text-indigo-700 border-t-2 border-x border-slate-200/90 border-t-indigo-600 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                    {tab.badge !== undefined && (
                      <span className={`text-[9.5px] px-1.5 py-0.2 rounded-full font-extrabold ${tab.badgeColor}`}>
                        {tab.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Main Content Area */}
            <div className="p-4 sm:p-6 flex-1 overflow-y-auto space-y-4">
              
              {/* ========================================================= */}
              {/* TAB 1: CAMPAIGN MODERATION & QR ACTIVATION (Request 7)   */}
              {/* ========================================================= */}
              {activeTab === 'campaigns' && (
                <div className="space-y-4">
                  {/* Top Filter and Search Bar */}
                  <div className="flex flex-col sm:flex-row gap-2 justify-between items-stretch sm:items-center">
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                      {[
                        { key: 'all', label: `All (${campaigns.length})` },
                        { key: 'pending', label: `Pending Review (${pendingCampaigns.length})` },
                        { key: 'active', label: `Active QRs (${activeCampaigns.length})` },
                        { key: 'rejected', label: `Rejected (${rejectedCampaigns.length})` },
                      ].map(f => (
                        <button
                          key={f.key}
                          onClick={() => setCampaignFilter(f.key as any)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer ${
                            campaignFilter === f.key
                              ? 'bg-slate-900 text-white shadow-xs'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>

                    <div className="relative min-w-[200px]">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search campaign, creator, ID..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Moderation Cards Queue */}
                  {filteredCampaigns.length === 0 ? (
                    <div className="text-center py-12 bg-slate-50 rounded-2xl border border-slate-200 text-slate-400 space-y-1">
                      <Layers className="w-10 h-10 mx-auto text-slate-300" />
                      <p className="font-bold text-sm text-slate-600">No campaigns found in this filter.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      {filteredCampaigns.map(camp => {
                        const isPending = camp.status === 'pending_approval';
                        const isActive = camp.status === 'active';
                        const isRejected = camp.status === 'rejected';
                        const catInfo = BAWM_CONFIG[camp.category];

                        const creatorOfCamp = creators.find(
                          c => c.phone === camp.createdBy || c.name === camp.createdBy || (c.orgName && camp.orgName === c.orgName)
                        );

                        return (
                          <div
                            key={camp.id}
                            className={`p-4 rounded-2xl border transition shadow-2xs space-y-3 ${
                              isPending
                                ? 'bg-amber-50/70 border-2 border-amber-300 ring-2 ring-amber-100'
                                : isRejected
                                ? 'bg-rose-50/60 border-rose-200 opacity-90'
                                : 'bg-white border-slate-200 hover:border-indigo-300'
                            }`}
                          >
                            <div className="flex justify-between items-start gap-2">
                              <div>
                                <div className="flex items-center gap-1.5 mb-1">
                                  <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-900 border border-indigo-200">
                                    {catInfo?.name || camp.category}
                                  </span>
                                  {isPending && (
                                    <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-md bg-amber-500 text-white animate-pulse">
                                      ⚠️ PENDING REVIEW
                                    </span>
                                  )}
                                  {isActive && (
                                    <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                                      <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" /> ACTIVE QR
                                    </span>
                                  )}
                                  {isRejected && (
                                    <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 border border-rose-300">
                                      REJECTED
                                    </span>
                                  )}
                                </div>
                                <h4 className="text-sm font-black text-slate-900">{camp.title}</h4>
                                <p className="text-[10.5px] text-slate-500">{camp.location} • ID: <span className="font-mono font-bold text-slate-700">{camp.id}</span></p>
                              </div>

                              {camp.imageUrl && (
                                <img
                                  src={camp.imageUrl}
                                  alt={camp.title}
                                  className="w-12 h-12 rounded-xl object-cover border border-slate-200 shrink-0"
                                />
                              )}
                            </div>

                            {/* Prominent Creator Information Card */}
                            <div className="p-2 rounded-xl bg-indigo-50/70 border border-indigo-100 text-xs flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 font-black text-indigo-950 text-xs truncate">
                                  <UserCheck className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                                  <span className="truncate">{creatorOfCamp?.name || camp.createdBy || 'Creator'}</span>
                                  {creatorOfCamp?.isApproved && !creatorOfCamp.isBlocked && (
                                    <span className="text-[9px] font-bold px-1.5 py-0.2 bg-emerald-100 text-emerald-800 rounded border border-emerald-200 shrink-0">
                                      Verified
                                    </span>
                                  )}
                                </div>
                                <p className="text-[10px] text-indigo-700/80 font-medium truncate mt-0.5">
                                  {creatorOfCamp?.orgName || camp.orgName || 'Community'} • Phone: <span className="font-mono font-bold">{creatorOfCamp?.phone || camp.createdBy || 'N/A'}</span>
                                </p>
                              </div>
                            </div>

                            {/* Beneficiary & Specifics */}
                            <div className="bg-white/80 p-2.5 rounded-xl border border-slate-200 text-xs space-y-1">
                              {camp.mitthiHming && (
                                <p><span className="text-slate-400 font-bold">Mitthi:</span> <strong className="text-slate-800">{camp.mitthiHming}</strong> ({camp.age} yrs)</p>
                              )}
                              {camp.cause && (
                                <p><span className="text-slate-400 font-bold">Cause:</span> <strong className="text-slate-800">{camp.cause}</strong></p>
                              )}
                              {camp.targetAmount && (
                                <p><span className="text-slate-400 font-bold">Target Goal:</span> <strong className="text-indigo-600">₹{camp.targetAmount.toLocaleString()}</strong></p>
                              )}
                              <p><span className="text-slate-400 font-bold">UPI ID:</span> <span className="font-mono font-bold text-slate-700">{camp.upiId}</span></p>
                              {camp.approvalRemarks && (
                                <p className="text-rose-600 font-bold bg-rose-50 p-1.5 rounded-lg border border-rose-200">
                                  Remark: {camp.approvalRemarks}
                                </p>
                              )}
                            </div>

                            {/* Action Buttons */}
                            <div className="flex flex-wrap gap-2 pt-1">
                              <button
                                onClick={() => setEditingCampaign({ ...camp })}
                                className="px-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-black py-1.5 rounded-xl text-xs transition border border-indigo-200 flex items-center gap-1 cursor-pointer"
                                title="Edit post details"
                              >
                                <Edit3 className="w-3.5 h-3.5" /> Edit Post
                              </button>

                              {isPending ? (
                                <>
                                  <button
                                    onClick={() => handleApproveCampaignClick(camp)}
                                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black py-1.5 rounded-xl text-xs transition flex items-center justify-center gap-1 cursor-pointer shadow-xs"
                                  >
                                    <Check className="w-3.5 h-3.5" /> Approve & Activate
                                  </button>
                                  <button
                                    onClick={() => handleRejectCampaignClick(camp)}
                                    className="px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 font-black py-1.5 rounded-xl text-xs transition border border-rose-200 cursor-pointer"
                                  >
                                    Reject
                                  </button>
                                </>
                              ) : (
                                <>
                                  {isRejected && (
                                    <button
                                      onClick={() => handleApproveCampaignClick(camp)}
                                      className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-black py-1.5 rounded-xl text-xs transition cursor-pointer"
                                    >
                                      Re-Approve & Activate
                                    </button>
                                  )}
                                  {onDeleteCampaign && (
                                    <button
                                      onClick={() => {
                                        if (confirm(`Are you sure you want to delete campaign '${camp.title}'?`)) {
                                          onDeleteCampaign(camp.id);
                                          recordAuditLog('Campaign Deleted', `Deleted campaign '${camp.title}' (${camp.id}).`, 'campaign', camp.id);
                                          setLogsList(getStoredAuditLogs());
                                        }
                                      }}
                                      className="px-3 bg-slate-100 hover:bg-rose-100 text-slate-600 hover:text-rose-700 font-bold py-1.5 rounded-xl text-xs transition cursor-pointer ml-auto"
                                      title="Delete Campaign"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ========================================================= */}
              {/* TAB 2: CREATOR REGISTRATION APPROVAL & BLOCK (Req 5, 6)   */}
              {/* ========================================================= */}
              {activeTab === 'creators' && (
                <div className="space-y-4">
                  {/* Toast Notification for Password Reset / Actions */}
                  {resetSuccessToast && (
                    <div className="p-3 bg-emerald-600 text-white font-bold text-xs rounded-2xl shadow-md flex items-center justify-between animate-fadeIn">
                      <span>{resetSuccessToast}</span>
                      <button onClick={() => setResetSuccessToast(null)} className="text-white/80 hover:text-white cursor-pointer ml-2">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  {/* View Mode & Sub Filters */}
                  <div className="flex flex-col sm:flex-row gap-2 justify-between items-stretch sm:items-center">
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                      <div className="p-0.5 bg-slate-200/80 rounded-xl flex items-center shrink-0 mr-1.5">
                        <button
                          onClick={() => setCreatorViewMode('list')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-black transition flex items-center gap-1 cursor-pointer ${
                            creatorViewMode === 'list' ? 'bg-white text-indigo-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          <Users className="w-3.5 h-3.5" /> Profiles List
                        </button>
                        <button
                          onClick={() => setCreatorViewMode('ranking')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-black transition flex items-center gap-1 cursor-pointer ${
                            creatorViewMode === 'ranking' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          <Trophy className="w-3.5 h-3.5 text-amber-300" /> Creator Ranking
                        </button>
                      </div>

                      {creatorViewMode === 'list' && [
                        { key: 'all', label: `All (${creators.length})` },
                        { key: 'pending', label: `Pending (${pendingCreators.length})` },
                        { key: 'approved', label: `Active (${creators.filter(c => c.isApproved && !c.isBlocked).length})` },
                        { key: 'blocked', label: `Blocked (${creators.filter(c => c.isBlocked).length})` },
                      ].map(f => (
                        <button
                          key={f.key}
                          onClick={() => setCreatorFilter(f.key as any)}
                          className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                            creatorFilter === f.key
                              ? 'bg-slate-900 text-white shadow-xs'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>

                    <div className="relative min-w-[200px]">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search creator name or phone..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* RANKING LEADERBOARD VIEW */}
                  {creatorViewMode === 'ranking' ? (
                    <div className="space-y-3">
                      <div className="p-3 bg-indigo-50/70 rounded-2xl border border-indigo-200 text-xs text-indigo-900 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Trophy className="w-4 h-4 text-amber-500" />
                          <span className="font-bold">Creator Volume & Activity Leaderboard</span>
                        </div>
                        <span className="text-[10.5px] font-bold text-indigo-700">Ranked by total funds raised via QR</span>
                      </div>

                      <div className="space-y-2.5">
                        {creatorRankings.map((rankItem, index) => {
                          const rank = index + 1;
                          const creator = rankItem.creator;
                          const isTop3 = rank <= 3;

                          return (
                            <div
                              key={creator.phone || creator.name}
                              className={`p-3.5 rounded-2xl border transition shadow-2xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 ${
                                rank === 1
                                  ? 'bg-amber-50/80 border-2 border-amber-300 ring-2 ring-amber-100'
                                  : rank === 2
                                  ? 'bg-slate-100/90 border-2 border-slate-300'
                                  : rank === 3
                                  ? 'bg-orange-50/80 border-2 border-orange-300'
                                  : 'bg-white border-slate-200 hover:border-slate-300'
                              }`}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm shrink-0 ${
                                  rank === 1 ? 'bg-amber-500 text-white shadow-xs' :
                                  rank === 2 ? 'bg-slate-400 text-white' :
                                  rank === 3 ? 'bg-amber-700 text-white' :
                                  'bg-slate-100 text-slate-700 border border-slate-200 font-mono'
                                }`}>
                                  {rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <h4 className="text-sm font-black text-slate-900 truncate">{creator.name}</h4>
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 border border-indigo-200">
                                      {creator.orgName || 'Independent'}
                                    </span>
                                    {creator.isApproved && !creator.isBlocked && (
                                      <span className="text-[9px] font-black uppercase text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded">
                                        Verified
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[10.5px] text-slate-500 mt-0.5 font-medium">
                                    {creator.designation || 'Creator'} • Phone: <span className="font-mono font-bold text-slate-700">{creator.phone}</span>
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-200/60">
                                <div className="text-right">
                                  <p className="text-[10px] font-extrabold text-slate-400 uppercase">Total Collected</p>
                                  <p className="text-sm font-black text-indigo-950">₹{rankItem.totalVolume.toLocaleString()}</p>
                                  <p className="text-[10px] text-slate-500">{rankItem.campaignsCount} QRs • {rankItem.transactionsCount} txns</p>
                                </div>

                                <div className="flex items-center gap-1.5">
                                  <button
                                    onClick={() => {
                                      setResettingPasswordCreator(creator);
                                      setNewCreatorPassword(creator.pin || creator.password || '123456');
                                    }}
                                    className="p-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs transition border border-indigo-200 flex items-center gap-1 cursor-pointer"
                                    title="Reset Password / Security PIN"
                                  >
                                    <KeyRound className="w-3.5 h-3.5" />
                                    <span className="hidden sm:inline">Reset PIN</span>
                                  </button>
                                  <button
                                    onClick={() => handleOpenCreatorEditor(creator)}
                                    className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition border border-slate-200 cursor-pointer"
                                    title="Edit License & Custom Offer"
                                  >
                                    <Settings className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    /* REGULAR CREATOR LIST VIEW */
                    filteredCreators.length === 0 ? (
                      <div className="text-center py-12 bg-slate-50 rounded-2xl border border-slate-200 text-slate-400 space-y-1">
                        <Users className="w-10 h-10 mx-auto text-slate-300" />
                        <p className="font-bold text-sm text-slate-600">No creator profiles found in this category.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {filteredCreators.map(creator => {
                          const isPending = !creator.isApproved;
                          const isBlocked = !!creator.isBlocked;

                          return (
                            <div
                              key={creator.phone || creator.name}
                              className={`p-4 rounded-2xl border transition space-y-3 shadow-2xs ${
                                isPending
                                  ? 'bg-indigo-50/70 border-2 border-indigo-300'
                                  : isBlocked
                                  ? 'bg-rose-50 border-rose-300'
                                  : 'bg-white border-slate-200 hover:border-slate-300'
                              }`}
                            >
                              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <h4 className="text-sm font-black text-slate-900">{creator.name || 'Unnamed Applicant'}</h4>
                                    {isPending && (
                                      <span className="text-[9px] font-black uppercase bg-amber-500 text-white px-2 py-0.5 rounded-full animate-pulse">
                                        Registration Pending
                                      </span>
                                    )}
                                    {isBlocked && (
                                      <span className="text-[9px] font-black uppercase bg-rose-600 text-white px-2 py-0.5 rounded-full flex items-center gap-1">
                                        <Ban className="w-2.5 h-2.5" /> BLOCKED
                                      </span>
                                    )}
                                    {!isPending && !isBlocked && (
                                      <span className="text-[9px] font-black uppercase bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-300">
                                        Active Creator
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-slate-500 font-medium">
                                    {creator.designation || 'Member'} • <strong className="text-slate-700">{creator.orgName || 'Community Member'}</strong> • Mobile: <span className="font-mono font-bold text-slate-800">{creator.phone}</span>
                                  </p>
                                </div>

                                {/* Approved categories badges & Special Custom Overrides */}
                                <div className="flex flex-wrap items-center gap-1">
                                  {creator.approvedCategories?.map(cat => {
                                    const hasOverride = creator.categoryCustomOverrides?.[cat];
                                    const isOverrideTrial = hasOverride?.isTrialActive;
                                    return (
                                      <span 
                                        key={cat} 
                                        className={`text-[9.5px] font-bold px-2 py-0.5 rounded-md border flex items-center gap-1 ${
                                          hasOverride
                                            ? 'bg-indigo-50 text-indigo-900 border-indigo-300'
                                            : 'bg-slate-100 text-slate-700 border-slate-200'
                                        }`}
                                      >
                                        <span>{BAWM_CONFIG[cat]?.name}</span>
                                        {hasOverride && (
                                          <span className={`text-[8.5px] px-1 rounded font-black ${isOverrideTrial ? 'bg-emerald-200 text-emerald-900' : 'bg-amber-200 text-amber-900'}`}>
                                            {isOverrideTrial ? '0% Free' : `${hasOverride.platformFeePercent}% Fee`}
                                          </span>
                                        )}
                                      </span>
                                    );
                                  })}
                                </div>
                              </div>

                              {/* Document proof & metadata */}
                              {creator.authDocName && (
                                <div className="bg-slate-50 p-2 rounded-xl border border-slate-200 text-xs flex items-center gap-2 text-slate-600">
                                  <FileText className="w-3.5 h-3.5 text-indigo-600" />
                                  <span>Auth Document: <strong className="text-slate-800">{creator.authDocName}</strong></span>
                                </div>
                              )}

                              {/* Action Buttons */}
                              <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100">
                                {isPending ? (
                                  <>
                                    <button
                                      onClick={() => handleOpenCreatorEditor(creator)}
                                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-4 py-2 rounded-xl text-xs transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                                    >
                                      <Check className="w-3.5 h-3.5" /> Approve Registration
                                    </button>
                                    <button
                                      onClick={() => handleRejectCreator(creator)}
                                      className="bg-rose-50 hover:bg-rose-100 text-rose-700 font-black px-3 py-2 rounded-xl text-xs transition border border-rose-200 cursor-pointer"
                                    >
                                      Decline
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    {/* Reset Password / PIN Button */}
                                    <button
                                      onClick={() => {
                                        setResettingPasswordCreator(creator);
                                        setNewCreatorPassword(creator.pin || creator.password || '123456');
                                      }}
                                      className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold px-3 py-1.5 rounded-xl text-xs transition border border-indigo-200 flex items-center gap-1 cursor-pointer"
                                      title="Reset Password or Security PIN"
                                    >
                                      <KeyRound className="w-3.5 h-3.5" /> Reset Password / PIN
                                    </button>

                                    {/* Block / Unblock Button (Request 6) */}
                                    <button
                                      onClick={() => handleToggleBlockCreator(creator)}
                                      className={`font-black px-3 py-1.5 rounded-xl text-xs transition flex items-center gap-1.5 cursor-pointer ${
                                        isBlocked
                                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                          : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200'
                                      }`}
                                    >
                                      {isBlocked ? <Unlock className="w-3.5 h-3.5" /> : <Ban className="w-3.5 h-3.5" />}
                                      {isBlocked ? 'Unblock Creator' : 'Block Creator'}
                                    </button>

                                    <button
                                      onClick={() => handleOpenCreatorEditor(creator)}
                                      className="bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 font-bold px-3 py-1.5 rounded-xl text-xs transition border border-slate-200 flex items-center gap-1 cursor-pointer ml-auto"
                                    >
                                      <Settings className="w-3.5 h-3.5" /> Edit License & Offer
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )
                  )}
                </div>
              )}

              {/* ========================================================= */}
              {/* TAB 3: CUSTOM ANNOUNCEMENT BANNER & MULTI-ITEM ROTATION   */}
              {/* ========================================================= */}
              {activeTab === 'announcement' && (() => {
                const currentItems = localAnnouncement.items && localAnnouncement.items.length > 0
                  ? localAnnouncement.items
                  : DEFAULT_ANNOUNCEMENT_ITEMS;

                const activeEditingItem = currentItems.find(i => i.id === activeEditingItemId) || currentItems[0] || {
                  id: 'ann-1',
                  isActive: true,
                  type: 'urgent',
                  title: 'Notice',
                  message: '',
                  badge: 'NOTICE'
                };

                const previewItem = currentItems[previewAnnounceIdx] || currentItems[0] || activeEditingItem;

                const handleUpdateCurrentItem = (patch: Partial<AnnouncementItem>) => {
                  const updatedItems = currentItems.map(item => {
                    if (item.id === activeEditingItem.id) {
                      return { ...item, ...patch };
                    }
                    return item;
                  });
                  setLocalAnnouncement(prev => ({
                    ...prev,
                    items: updatedItems,
                    // If editing item 0, keep legacy fields in sync
                    title: updatedItems[0]?.title || prev.title,
                    message: updatedItems[0]?.message || prev.message,
                    type: updatedItems[0]?.type || prev.type
                  }));
                };

                const handleAddItem = () => {
                  const newId = `ann-${Date.now()}`;
                  const newItem: AnnouncementItem = {
                    id: newId,
                    isActive: true,
                    type: 'info',
                    title: 'Announcement Thar',
                    message: 'Mipuite hriattirna thar hetah hian ziak rawh...',
                    badge: 'NEW',
                    linkText: 'En Rawh',
                    linkAction: 'explore_bawm'
                  };
                  const updatedItems = [...currentItems, newItem];
                  setLocalAnnouncement(prev => ({
                    ...prev,
                    items: updatedItems
                  }));
                  setActiveEditingItemId(newId);
                  setPreviewAnnounceIdx(updatedItems.length - 1);
                };

                const handleDeleteItem = (idToDelete: string) => {
                  if (currentItems.length <= 1) {
                    alert('At least announcement item 1 tal a awm a ngai e.');
                    return;
                  }
                  const updatedItems = currentItems.filter(i => i.id !== idToDelete);
                  setLocalAnnouncement(prev => ({
                    ...prev,
                    items: updatedItems
                  }));
                  if (activeEditingItemId === idToDelete) {
                    setActiveEditingItemId(updatedItems[0].id);
                  }
                  setPreviewAnnounceIdx(0);
                };

                const handleMoveItem = (idx: number, direction: 'up' | 'down') => {
                  const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
                  if (targetIdx < 0 || targetIdx >= currentItems.length) return;
                  const newItems = [...currentItems];
                  const temp = newItems[idx];
                  newItems[idx] = newItems[targetIdx];
                  newItems[targetIdx] = temp;
                  setLocalAnnouncement(prev => ({
                    ...prev,
                    items: newItems
                  }));
                  setPreviewAnnounceIdx(targetIdx);
                };

                const handleResetDefaultItems = () => {
                  if (window.confirm('Announcement items 4 hi default dinhmunah reset i duh chiang maw?')) {
                    setLocalAnnouncement(prev => ({
                      ...prev,
                      items: DEFAULT_ANNOUNCEMENT_ITEMS,
                      autoRotate: true,
                      animationStyle: 'slide',
                      rotationSpeedSeconds: 4
                    }));
                    setActiveEditingItemId(DEFAULT_ANNOUNCEMENT_ITEMS[0].id);
                    setPreviewAnnounceIdx(0);
                  }
                };

                return (
                  <div className="space-y-5 max-w-2xl mx-auto">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="space-y-0.5">
                        <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                          <Megaphone className="w-4 h-4 text-indigo-600" />
                          Global Animated Announcement Banner
                        </h3>
                        <p className="text-xs text-slate-500">
                          Inthlak kual thei (Auto-rotating), che thei chi (animated), leh announcement 4+ duhtawka thlakna.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={handleResetDefaultItems}
                        className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-xl transition border border-indigo-200 cursor-pointer self-start sm:self-auto"
                      >
                        Reset to Default 4
                      </button>
                    </div>

                    {/* Interactive Live Banner Preview Card */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-[10.5px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                          <span>Live Banner Preview (HomeScreen Display)</span>
                          {localAnnouncement.autoRotate && (
                            <span className="text-[9px] font-mono bg-indigo-100 text-indigo-800 px-1.5 py-0.2 rounded-full font-bold">
                              Rotating ({localAnnouncement.rotationSpeedSeconds || 4}s)
                            </span>
                          )}
                        </label>

                        {/* Interactive Preview Controls */}
                        {currentItems.length > 1 && (
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] font-mono text-slate-500 font-bold mr-1">
                              Item {previewAnnounceIdx + 1}/{currentItems.length}
                            </span>
                            <button
                              type="button"
                              onClick={() => setPreviewAnnounceIdx(prev => (prev - 1 + currentItems.length) % currentItems.length)}
                              className="p-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition cursor-pointer"
                              title="Previous Announcement"
                            >
                              <ChevronLeft className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setIsPreviewPaused(!isPreviewPaused)}
                              className="p-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition cursor-pointer"
                              title={isPreviewPaused ? "Play" : "Pause"}
                            >
                              {isPreviewPaused ? <Play className="w-3.5 h-3.5 text-emerald-600" /> : <Pause className="w-3.5 h-3.5 text-amber-600" />}
                            </button>
                            <button
                              type="button"
                              onClick={() => setPreviewAnnounceIdx(prev => (prev + 1) % currentItems.length)}
                              className="p-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition cursor-pointer"
                              title="Next Announcement"
                            >
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>

                      {localAnnouncement.isActive ? (
                        <div className={`p-4 rounded-2xl border shadow-sm relative overflow-hidden transition-all text-white ${
                          previewItem.type === 'urgent'
                            ? 'bg-gradient-to-r from-red-600 via-rose-600 to-red-700 border-red-500'
                            : previewItem.type === 'info'
                            ? 'bg-gradient-to-r from-indigo-700 via-purple-700 to-indigo-800 border-indigo-500'
                            : previewItem.type === 'notice'
                            ? 'bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 border-amber-500'
                            : 'bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 border-emerald-500'
                        } ${localAnnouncement.animationStyle === 'pulse' ? 'animate-pulse' : ''}`}>
                          <div className="flex items-start justify-between gap-2.5">
                            <div className="flex items-start gap-2.5 flex-1 min-w-0">
                              <span className="p-1.5 bg-white/20 rounded-xl shrink-0 backdrop-blur-xs mt-0.5">
                                <Megaphone className="w-4 h-4 text-white" />
                              </span>
                              <div className="space-y-1 flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-[8.5px] font-black uppercase px-2 py-0.2 rounded-full bg-white/25 text-white tracking-wider">
                                    {previewItem.badge || previewItem.type?.toUpperCase() || 'NOTICE'}
                                  </span>
                                  <span className="text-[8.5px] font-mono bg-black/25 text-white/90 px-1.5 py-0.2 rounded-full">
                                    #{previewAnnounceIdx + 1}
                                  </span>
                                  {localAnnouncement.animationStyle === 'marquee' && (
                                    <span className="text-[8px] bg-amber-300 text-slate-950 font-black uppercase px-1 rounded-sm">
                                      Ticker
                                    </span>
                                  )}
                                </div>

                                {localAnnouncement.animationStyle === 'marquee' ? (
                                  <div className="overflow-hidden whitespace-nowrap py-0.5">
                                    <div className="inline-block animate-marquee font-bold text-xs">
                                      <span className="text-amber-200 mr-2">[{previewItem.title}]</span>
                                      <span>{previewItem.message}</span>
                                    </div>
                                  </div>
                                ) : (
                                  <div>
                                    <h4 className="text-xs sm:text-sm font-black leading-tight">{previewItem.title}</h4>
                                    <p className="text-[11px] text-white/95 leading-snug mt-0.5">{previewItem.message}</p>
                                  </div>
                                )}

                                {previewItem.linkText && (
                                  <div className="pt-1">
                                    <span className="inline-flex items-center gap-1 bg-white text-slate-900 font-black text-[10px] px-2.5 py-1 rounded-xl shadow-xs">
                                      {previewItem.linkText}
                                      <ArrowRight className="w-3 h-3 text-slate-700" />
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Dots */}
                          {currentItems.length > 1 && (
                            <div className="flex items-center justify-center gap-1.5 pt-2 mt-2 border-t border-white/20">
                              {currentItems.map((item, idx) => (
                                <button
                                  key={item.id}
                                  type="button"
                                  onClick={() => {
                                    setPreviewAnnounceIdx(idx);
                                    setActiveEditingItemId(item.id);
                                  }}
                                  className={`h-1.5 rounded-full transition-all cursor-pointer ${
                                    previewAnnounceIdx === idx ? 'w-5 bg-white' : 'w-1.5 bg-white/40 hover:bg-white/70'
                                  }`}
                                  title={`Switch to item ${idx + 1}`}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="p-4 rounded-2xl border border-dashed border-slate-300 text-center text-slate-400 text-xs">
                          Announcement banner is currently <strong>DISABLED</strong>.
                        </div>
                      )}
                    </div>

                    {/* GLOBAL BANNER & MOTION SETTINGS */}
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-4">
                      <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                        <div>
                          <label className="text-xs font-black text-slate-800 block">Banner Display Status</label>
                          <span className="text-[10px] text-slate-500">HomeScreen chunga banner lanna switch</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setLocalAnnouncement(prev => ({ ...prev, isActive: !prev.isActive }))}
                          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                            localAnnouncement.isActive ? 'bg-indigo-600' : 'bg-slate-300'
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                              localAnnouncement.isActive ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>

                      {/* Animation Style Selector (Che thei chi) */}
                      <div>
                        <label className="text-[10.5px] font-extrabold text-slate-700 uppercase tracking-wider block mb-1.5">
                          Motion / Animation Style (Che thei chi)
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                          {[
                            { key: 'slide', label: 'Slide Carousel', icon: '↔️' },
                            { key: 'marquee', label: 'Ticker / Marquee', icon: '📜' },
                            { key: 'pulse', label: 'Pulse Glow', icon: '✨' },
                            { key: 'fade', label: 'Smooth Fade', icon: '🌫️' },
                            { key: 'static', label: 'Static', icon: '⏹️' }
                          ].map(style => (
                            <button
                              key={style.key}
                              type="button"
                              onClick={() => setLocalAnnouncement(prev => ({ ...prev, animationStyle: style.key as any }))}
                              className={`p-2 rounded-xl text-center text-xs font-bold transition cursor-pointer border ${
                                localAnnouncement.animationStyle === style.key
                                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                              }`}
                            >
                              <div className="text-sm">{style.icon}</div>
                              <div className="text-[10.5px] mt-0.5 leading-tight">{style.label}</div>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Auto-Rotation Controls (Inthlak kual theihna) */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200/80">
                        <div>
                          <div className="flex items-center justify-between">
                            <label className="text-[10.5px] font-extrabold text-slate-700 uppercase">
                              Auto-Rotate (Inthlak Kual)
                            </label>
                            <input
                              type="checkbox"
                              checked={localAnnouncement.autoRotate !== false}
                              onChange={(e) => setLocalAnnouncement(prev => ({ ...prev, autoRotate: e.target.checked }))}
                              className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                            />
                          </div>
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            Announcement 4-te hi a hranpaa hmeh ngai lova anmahni a inthlak kual turin.
                          </p>
                        </div>

                        <div>
                          <label className="text-[10.5px] font-extrabold text-slate-700 uppercase block mb-1">
                            Rotation Speed (Second Zatin)
                          </label>
                          <div className="flex items-center gap-1.5">
                            {[2, 3, 4, 6, 8, 10].map(sec => (
                              <button
                                key={sec}
                                type="button"
                                onClick={() => setLocalAnnouncement(prev => ({ ...prev, rotationSpeedSeconds: sec }))}
                                className={`flex-1 py-1.5 rounded-lg text-xs font-mono font-bold transition cursor-pointer border ${
                                  (localAnnouncement.rotationSpeedSeconds || 4) === sec
                                    ? 'bg-slate-900 text-white border-slate-900'
                                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                                }`}
                              >
                                {sec}s
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* MULTI-ITEM MANAGER & EDITOR TABS */}
                    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                        <div>
                          <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                            Announcement Items ({currentItems.length})
                          </h4>
                          <p className="text-[10.5px] text-slate-500">
                            Tun mek a mi 4 te hi hmet la, i duh danin thlak danglam / belh rawh le.
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={handleAddItem}
                          className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs px-3 py-1.5 rounded-xl border border-indigo-200 transition cursor-pointer flex items-center gap-1 active:scale-95"
                        >
                          <Plus className="w-3.5 h-3.5" /> Item Belh
                        </button>
                      </div>

                      {/* Items Selector Tabs */}
                      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
                        {currentItems.map((item, idx) => {
                          const isSelected = item.id === activeEditingItem.id;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => {
                                setActiveEditingItemId(item.id);
                                setPreviewAnnounceIdx(idx);
                              }}
                              className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 shrink-0 border ${
                                isSelected
                                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs ring-2 ring-indigo-200'
                                  : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                              }`}
                            >
                              <span>#{idx + 1}</span>
                              <span className="truncate max-w-[110px]">{item.badge || item.title || `Item ${idx + 1}`}</span>
                              {!item.isActive && (
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" title="Hidden" />
                              )}
                            </button>
                          );
                        })}
                      </div>

                      {/* Editing Active Item Form */}
                      <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-3">
                        <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-slate-900">
                              Item #{currentItems.findIndex(i => i.id === activeEditingItem.id) + 1} Siamthatna
                            </span>
                            <label className="flex items-center gap-1 text-[11px] font-bold text-slate-600 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={activeEditingItem.isActive !== false}
                                onChange={(e) => handleUpdateCurrentItem({ isActive: e.target.checked })}
                                className="rounded text-indigo-600 focus:ring-indigo-500"
                              />
                              Active
                            </label>
                          </div>

                          <div className="flex items-center gap-1">
                            {/* Reorder Buttons */}
                            {currentItems.length > 1 && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleMoveItem(currentItems.findIndex(i => i.id === activeEditingItem.id), 'up')}
                                  disabled={currentItems.findIndex(i => i.id === activeEditingItem.id) === 0}
                                  className="p-1 rounded bg-white hover:bg-slate-200 border border-slate-200 text-slate-700 disabled:opacity-30 cursor-pointer"
                                  title="Move Left / Up"
                                >
                                  <ArrowUp className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleMoveItem(currentItems.findIndex(i => i.id === activeEditingItem.id), 'down')}
                                  disabled={currentItems.findIndex(i => i.id === activeEditingItem.id) === currentItems.length - 1}
                                  className="p-1 rounded bg-white hover:bg-slate-200 border border-slate-200 text-slate-700 disabled:opacity-30 cursor-pointer"
                                  title="Move Right / Down"
                                >
                                  <ArrowDown className="w-3 h-3" />
                                </button>
                              </>
                            )}

                            {currentItems.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleDeleteItem(activeEditingItem.id)}
                                className="p-1 rounded bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 transition cursor-pointer ml-1"
                                title="Delete this item"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Item Type */}
                        <div>
                          <label className="text-[10px] font-extrabold text-slate-600 uppercase block mb-1">Color Theme & Category</label>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                            {(['urgent', 'info', 'notice', 'event'] as const).map(type => (
                              <button
                                key={type}
                                type="button"
                                onClick={() => handleUpdateCurrentItem({ type })}
                                className={`py-1.5 px-2 rounded-xl text-xs font-black uppercase transition cursor-pointer border ${
                                  activeEditingItem.type === type
                                    ? type === 'urgent' ? 'bg-red-600 text-white border-red-600' :
                                      type === 'info' ? 'bg-indigo-600 text-white border-indigo-600' :
                                      type === 'notice' ? 'bg-amber-600 text-white border-amber-600' :
                                      'bg-emerald-600 text-white border-emerald-600'
                                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                                }`}
                              >
                                {type}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Badge / Tag & Title */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <div>
                            <label className="text-[10px] font-extrabold text-slate-600 uppercase">Badge / Tag Label</label>
                            <input
                              type="text"
                              value={activeEditingItem.badge || ''}
                              onChange={(e) => handleUpdateCurrentItem({ badge: e.target.value })}
                              placeholder="e.g. URGENT, BBPS LIVE"
                              className="w-full mt-1 p-2 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-800 focus:border-indigo-600 focus:outline-none"
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="text-[10px] font-extrabold text-slate-600 uppercase">Headline / Title *</label>
                            <input
                              type="text"
                              value={activeEditingItem.title}
                              onChange={(e) => handleUpdateCurrentItem({ title: e.target.value })}
                              placeholder="e.g. Mizoram State-wide Community Notice..."
                              className="w-full mt-1 p-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:border-indigo-600 focus:outline-none"
                              required
                            />
                          </div>
                        </div>

                        {/* Announcement Message */}
                        <div>
                          <label className="text-[10px] font-extrabold text-slate-600 uppercase">Announcement Details (Message) *</label>
                          <textarea
                            value={activeEditingItem.message}
                            onChange={(e) => handleUpdateCurrentItem({ message: e.target.value })}
                            rows={2}
                            className="w-full mt-1 p-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:border-indigo-600 focus:outline-none"
                            placeholder="Type announcement details here..."
                            required
                          />
                        </div>

                        {/* Action Button Link Config */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-slate-200">
                          <div>
                            <label className="text-[10px] font-extrabold text-slate-600 uppercase">Action Button Label (Optional)</label>
                            <input
                              type="text"
                              value={activeEditingItem.linkText || ''}
                              onChange={(e) => handleUpdateCurrentItem({ linkText: e.target.value })}
                              placeholder="e.g. En Rawh, Lut Rawh"
                              className="w-full mt-1 p-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:border-indigo-600 focus:outline-none"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] font-extrabold text-slate-600 uppercase">Button Action Target</label>
                            <select
                              value={activeEditingItem.linkAction || 'explore_bawm'}
                              onChange={(e) => handleUpdateCurrentItem({ linkAction: e.target.value })}
                              className="w-full mt-1 p-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:border-indigo-600 focus:outline-none"
                            >
                              <option value="explore_bawm">Explore Bawm (Ralna/Khawlsak)</option>
                              <option value="open_bill_service">BBPS Bill Payments</option>
                              <option value="create_qr">Creator Studio (Free QR)</option>
                              <option value="kumtluang_bawm">Kumtluang Church/NGO</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Announcement Save Notice */}
                    {announcementSavedNotice && (
                      <p className="text-xs text-emerald-700 font-bold bg-emerald-50 p-2.5 rounded-xl border border-emerald-200 text-center animate-fadeIn">
                        ✅ Announcement & Rotation Settings successfully saved and published!
                      </p>
                    )}

                    {/* Save Button */}
                    <button
                      type="button"
                      onClick={handleSaveAnnouncement}
                      className="w-full py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-black text-xs shadow-md transition cursor-pointer flex items-center justify-center gap-1.5 active:scale-98"
                    >
                      <Save className="w-4 h-4" /> Save & Broadcast Animated Announcements
                    </button>
                  </div>
                );
              })()}

              {/* ========================================================= */}
              {/* TAB 4: AUDIT & ACTIVITY LOG (Request 2)                   */}
              {/* ========================================================= */}
              {activeTab === 'audit' && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row gap-2 justify-between items-stretch sm:items-center">
                    <div className="space-y-0.5">
                      <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                        <History className="w-4 h-4 text-indigo-600" />
                        System Audit & Moderation Activity Log
                      </h3>
                      <p className="text-xs text-slate-500">Chronological history of approvals, changes, and admin operations.</p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          setLogsList(getStoredAuditLogs());
                        }}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-3 py-1.5 rounded-xl transition flex items-center gap-1 cursor-pointer"
                      >
                        <RefreshCw className="w-3 h-3" /> Refresh
                      </button>
                    </div>
                  </div>

                  {/* Logs list */}
                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 divide-y divide-slate-200/80 max-h-[500px] overflow-y-auto space-y-2">
                    {logsList.length === 0 ? (
                      <div className="text-center py-8 text-slate-400 text-xs font-bold">
                        No audit logs recorded yet.
                      </div>
                    ) : (
                      logsList.map(log => (
                        <div key={log.id} className="pt-2 first:pt-0 space-y-1">
                          <div className="flex justify-between items-center text-xs">
                            <span className="font-black text-slate-900 flex items-center gap-1.5">
                              <span className={`w-2 h-2 rounded-full ${
                                log.targetType === 'creator' ? 'bg-indigo-500' :
                                log.targetType === 'campaign' ? 'bg-emerald-500' :
                                log.targetType === 'pricing' ? 'bg-amber-500' : 'bg-purple-500'
                              }`} />
                              {log.action}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {formatDateDDMMYYYY(log.timestamp)}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600 leading-relaxed">{log.details}</p>
                          <div className="flex items-center gap-2 text-[10px] text-slate-400">
                            <span>By: <strong className="text-slate-600">{log.performedBy}</strong></span>
                            {log.targetId && <span>• Target: <code className="bg-slate-200/60 px-1 py-0.2 rounded text-slate-700">{log.targetId}</code></span>}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* ========================================================= */}
              {/* TAB 5: DATA BACKUP & RESTORE (JSON) (Request 4)          */}
              {/* ========================================================= */}
              {activeTab === 'backup' && (
                <div className="space-y-5 max-w-2xl mx-auto">
                  <div className="space-y-1">
                    <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                      <Database className="w-4 h-4 text-indigo-600" />
                      Database Backup & Restoration Subsystem
                    </h3>
                    <p className="text-xs text-slate-500">
                      Export full system data snapshots (campaigns, transactions, profiles, audit records) to JSON or restore existing backups.
                    </p>
                  </div>

                  {restoreNotice && (
                    <div className={`p-3.5 rounded-2xl text-xs font-bold border ${
                      restoreNotice.isError ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    }`}>
                      {restoreNotice.message}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Export Card */}
                    <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-3 text-center flex flex-col justify-between">
                      <div className="space-y-1">
                        <Download className="w-8 h-8 mx-auto text-indigo-600" />
                        <h4 className="text-xs font-black text-slate-900">Export Backup (JSON)</h4>
                        <p className="text-[11px] text-slate-500">Download complete snapshot including all active Bawms, QR records, and transactions.</p>
                      </div>
                      <button
                        type="button"
                        onClick={handleExportBackup}
                        className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" /> Download .JSON Backup
                      </button>
                    </div>

                    {/* Restore Card */}
                    <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-3 text-center flex flex-col justify-between">
                      <div className="space-y-1">
                        <Upload className="w-8 h-8 mx-auto text-purple-600" />
                        <h4 className="text-xs font-black text-slate-900">Restore Backup (JSON)</h4>
                        <p className="text-[11px] text-slate-500">Upload and restore a previous database file to instantly recover all records.</p>
                      </div>

                      <input
                        type="file"
                        accept=".json"
                        ref={fileInputRef}
                        onChange={handleFileRestore}
                        className="hidden"
                      />

                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-black text-xs shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Upload className="w-3.5 h-3.5" /> Select Backup File (.json)
                      </button>
                    </div>
                  </div>

                  {/* Reset Demo Data Button */}
                  <div className="p-4 rounded-2xl border border-amber-200 bg-amber-50/70 flex items-center justify-between gap-3">
                    <div>
                      <h4 className="text-xs font-black text-amber-900">Factory Demo Reset</h4>
                      <p className="text-[10.5px] text-amber-800/80">Re-initialize database with standard Mizoram sample campaigns & YMA Bawms.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm('Are you sure you want to reset demo data?')) {
                          onResetData();
                          recordAuditLog('Database Reset to Factory Defaults', 'Administrator triggered demo reset.', 'system');
                          setLogsList(getStoredAuditLogs());
                          alert('✅ Database reset to factory default!');
                        }
                      }}
                      className="bg-amber-600 hover:bg-amber-700 text-white font-black px-3.5 py-2 rounded-xl text-xs transition cursor-pointer shrink-0"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Reset Demo
                    </button>
                  </div>
                </div>
              )}

              {/* ========================================================= */}
              {/* TAB 6: RATES & PLATFORM FEES                             */}
              {/* ========================================================= */}
              {activeTab === 'rates' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <h3 className="text-sm font-black text-slate-900">Platform Fee & Subscription Rules</h3>
                      <p className="text-xs text-slate-500">Configure category-wise platform fee percentages and creator license fees.</p>
                    </div>
                    {saveSuccessNotice && (
                      <span className="text-xs text-emerald-600 font-bold bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                        ✅ Rates saved!
                      </span>
                    )}
                  </div>

                  {/* Category Selector */}
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {(['ralna', 'khawlsak', 'rikrum', 'kumtluang', 'others'] as BawmCategory[]).map(cat => {
                      const isActive = activePricingCategory === cat;
                      const catRule = localPricing.categories[cat];
                      const isFree = catRule?.isFreeTrialActive;
                      return (
                        <button
                          key={cat}
                          onClick={() => setActivePricingCategory(cat)}
                          className={`px-3.5 py-2.5 rounded-xl text-xs font-black transition flex flex-col items-start gap-0.5 shrink-0 cursor-pointer border ${
                            isActive
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-100'
                              : 'bg-white text-slate-700 hover:bg-slate-50 border-slate-200'
                          }`}
                        >
                          <div className="flex items-center gap-1.5">
                            <span>{BAWM_CONFIG[cat]?.name}</span>
                            <span className={`w-2 h-2 rounded-full ${isFree ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
                          </div>
                          <span className={`text-[10px] font-normal ${isActive ? 'text-indigo-100' : 'text-slate-500'}`}>
                            {isFree ? '0% Free Trial' : `${catRule?.platformFeePercent ?? 1.0}% Fee`}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Pricing Rule Editor */}
                  {localPricing.categories[activePricingCategory] && (
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-4">
                      {/* Free Trial Active Toggle */}
                      <div className="flex items-center justify-between p-3 rounded-xl bg-white border border-slate-200">
                        <div className="space-y-0.5">
                          <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                            Free Trial Offer (A thlawn)
                          </span>
                          <p className="text-[10px] text-slate-500">
                            He Bawm hi &quot;Free Trial&quot; angin a thlawnin Creator-ten an hmang thei ang (0% fee / free QR).
                          </p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={localPricing.categories[activePricingCategory].isFreeTrialActive}
                            onChange={(e) => {
                              const isChecked = e.target.checked;
                              setLocalPricing(prev => ({
                                ...prev,
                                categories: {
                                  ...prev.categories,
                                  [activePricingCategory]: {
                                    ...prev.categories[activePricingCategory],
                                    isFreeTrialActive: isChecked,
                                  }
                                }
                              }));
                            }}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                        </label>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="text-[10.5px] font-extrabold text-slate-600 uppercase">Platform Fee (%)</label>
                          <input
                            type="number"
                            step="0.1"
                            value={localPricing.categories[activePricingCategory].platformFeePercent}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              setLocalPricing(prev => ({
                                ...prev,
                                categories: {
                                  ...prev.categories,
                                  [activePricingCategory]: {
                                    ...prev.categories[activePricingCategory],
                                    platformFeePercent: val
                                  }
                                }
                              }));
                            }}
                            className="w-full mt-1 p-2 bg-white border border-slate-200 rounded-xl text-xs font-bold"
                          />
                          <p className="text-[9.5px] text-slate-400 mt-0.5">e.g. 1.0 (1% Fee)</p>
                        </div>
                        <div>
                          <label className="text-[10.5px] font-extrabold text-slate-600 uppercase">Fixed QR Charge (₹)</label>
                          <input
                            type="number"
                            value={localPricing.categories[activePricingCategory].qrCreationCharge}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              setLocalPricing(prev => ({
                                ...prev,
                                categories: {
                                  ...prev.categories,
                                  [activePricingCategory]: {
                                    ...prev.categories[activePricingCategory],
                                    qrCreationCharge: val
                                  }
                                }
                              }));
                            }}
                            className="w-full mt-1 p-2 bg-white border border-slate-200 rounded-xl text-xs font-bold"
                          />
                          <p className="text-[9.5px] text-slate-400 mt-0.5">₹0 = A thlawn</p>
                        </div>
                        <div>
                          <label className="text-[10.5px] font-extrabold text-slate-600 uppercase">Free Trial Period (Days)</label>
                          <input
                            type="number"
                            value={localPricing.categories[activePricingCategory].trialPeriodDays}
                            onChange={(e) => {
                              const val = parseInt(e.target.value) || 0;
                              setLocalPricing(prev => ({
                                ...prev,
                                categories: {
                                  ...prev.categories,
                                  [activePricingCategory]: {
                                    ...prev.categories[activePricingCategory],
                                    trialPeriodDays: val
                                  }
                                }
                              }));
                            }}
                            className="w-full mt-1 p-2 bg-white border border-slate-200 rounded-xl text-xs font-bold"
                          />
                          <p className="text-[9.5px] text-slate-400 mt-0.5">e.g. 30, 60, 90 days</p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          onUpdatePricingConfig(localPricing);
                          recordAuditLog('Platform Pricing Updated', `Updated platform fee rules for ${BAWM_CONFIG[activePricingCategory]?.name}.`, 'pricing');
                          setLogsList(getStoredAuditLogs());
                          setSaveSuccessNotice(true);
                          setTimeout(() => setSaveSuccessNotice(false), 2500);
                        }}
                        className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Save className="w-3.5 h-3.5" /> Save Category Rates & Trial
                      </button>
                    </div>
                  )}

                  {/* All Bawm Categories At-a-Glance Overview */}
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                        <Coins className="w-3.5 h-3.5 text-indigo-600" />
                        Bawm Tin Rates & Offers Summary (Side-by-Side)
                      </span>
                      <span className="text-[10.5px] text-slate-500 font-medium">Bawm tinte an in-ang lo thei</span>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-slate-200 text-[10.5px] text-slate-500 font-extrabold uppercase">
                            <th className="pb-2">Bawm Hming</th>
                            <th className="pb-2">Offer Status</th>
                            <th className="pb-2">Platform Fee %</th>
                            <th className="pb-2">QR Siam Man</th>
                            <th className="pb-2">Trial Days</th>
                            <th className="pb-2 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {(['ralna', 'khawlsak', 'rikrum', 'kumtluang', 'others'] as BawmCategory[]).map(cat => {
                            const rule = localPricing.categories[cat];
                            const isFree = rule?.isFreeTrialActive;
                            const isCurrent = activePricingCategory === cat;
                            return (
                              <tr key={cat} className={`hover:bg-slate-50 transition ${isCurrent ? 'bg-indigo-50/50' : ''}`}>
                                <td className="py-2.5 font-black text-slate-900 flex items-center gap-1.5">
                                  <span>{BAWM_CONFIG[cat]?.name}</span>
                                  {isCurrent && <span className="text-[9px] bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded font-bold">Active Edit</span>}
                                </td>
                                <td className="py-2.5">
                                  {isFree ? (
                                    <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md font-bold text-[10px] border border-emerald-200">
                                      <Sparkles className="w-2.5 h-2.5" /> Free Trial (0% Fee)
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md font-bold text-[10px] border border-slate-200">
                                      Paid Fee Active
                                    </span>
                                  )}
                                </td>
                                <td className="py-2.5 font-bold text-slate-800">
                                  {isFree ? '0% (Trial)' : `${rule?.platformFeePercent ?? 1.0}%`}
                                </td>
                                <td className="py-2.5 font-bold text-slate-800">
                                  {isFree ? '₹0 (Free)' : (rule?.qrCreationCharge ? `₹${rule.qrCreationCharge}` : '₹0')}
                                </td>
                                <td className="py-2.5 text-slate-600 font-medium">
                                  {rule?.trialPeriodDays || 30} Days
                                </td>
                                <td className="py-2.5 text-right">
                                  <button
                                    type="button"
                                    onClick={() => setActivePricingCategory(cat)}
                                    className="text-[10.5px] font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                                  >
                                    Edit Rate
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* ========================================================= */}
              {/* TAB 7: FINANCES & ANALYTICS                               */}
              {/* ========================================================= */}
              {activeTab === 'finances' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="bg-indigo-50/70 p-4 rounded-2xl border border-indigo-200">
                      <p className="text-[10.5px] font-extrabold text-indigo-700 uppercase">Total Platform Volume</p>
                      <h3 className="text-xl font-black text-indigo-950 mt-1">₹{totalVolume.toLocaleString()}</h3>
                      <p className="text-[10px] text-indigo-600/80">{transactions.length} Total Transactions</p>
                    </div>
                    <div className="bg-emerald-50/70 p-4 rounded-2xl border border-emerald-200">
                      <p className="text-[10.5px] font-extrabold text-emerald-700 uppercase">Total Platform Fees</p>
                      <h3 className="text-xl font-black text-emerald-950 mt-1">₹{totalPlatformFees.toLocaleString()}</h3>
                      <p className="text-[10px] text-emerald-600/80">Average ~1.0% community fee</p>
                    </div>
                    <div className="bg-purple-50/70 p-4 rounded-2xl border border-purple-200">
                      <p className="text-[10.5px] font-extrabold text-purple-700 uppercase">Net Settlement</p>
                      <h3 className="text-xl font-black text-purple-950 mt-1">₹{(totalVolume - totalPlatformFees).toLocaleString()}</h3>
                      <p className="text-[10px] text-purple-600/80">Direct to NGO & YMA accounts</p>
                    </div>
                  </div>
                </div>
              )}

              {/* ========================================================= */}
              {/* TAB 8: GATEWAY & TSP CONFIG                               */}
              {/* ========================================================= */}
              {activeTab === 'gateway' && (
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3 max-w-lg mx-auto text-xs">
                  <h4 className="font-black text-slate-900 flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-purple-600" /> PhonePe PG V2 / TSP Configuration
                  </h4>
                  <div className="space-y-2">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500">Merchant ID (MID)</label>
                      <input
                        type="text"
                        readOnly
                        value="PGTESTPAYUAT86"
                        className="w-full p-2 bg-white border border-slate-200 rounded-xl font-mono text-slate-700"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500">Salt Key Index</label>
                      <input
                        type="text"
                        readOnly
                        value="1"
                        className="w-full p-2 bg-white border border-slate-200 rounded-xl font-mono text-slate-700"
                      />
                    </div>
                    <div className="p-2.5 rounded-xl bg-purple-50 border border-purple-200 text-purple-900 font-medium">
                      Status: <strong className="text-emerald-700">ONLINE (UAT Mode)</strong> with instant UPI intent routing.
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>
        )}

        {/* Admin Campaign Post Editor Modal Sheet */}
        {editingCampaign && (
          <div className="fixed inset-0 bg-slate-950/75 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs animate-fadeIn">
            <div className="bg-white w-full max-w-xl max-h-[90vh] rounded-3xl shadow-2xl border border-indigo-200 flex flex-col overflow-hidden text-slate-800">
              {/* Modal Top Header */}
              <div className="p-4 bg-slate-900 text-white flex justify-between items-center shrink-0">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                    <Edit3 className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-black text-sm text-white truncate">Edit Campaign Post (Admin Override)</h3>
                    <p className="text-[10px] text-slate-400 font-mono truncate">ID: {editingCampaign.id} • Creator: {editingCampaign.createdBy || 'Unknown'}</p>
                  </div>
                </div>
                <button
                  onClick={() => setEditingCampaign(null)}
                  className="w-7 h-7 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Scrollable Form Body */}
              <form onSubmit={handleSaveCampaignEdit} className="p-4 sm:p-5 flex-1 overflow-y-auto space-y-4 text-xs">
                {/* 1. Core Post Details */}
                <div className="space-y-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                  <h4 className="text-[10.5px] font-black uppercase text-indigo-900 tracking-wider">General Information</h4>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-extrabold text-slate-600 uppercase">Bawm Category</label>
                      <select
                        value={editingCampaign.category}
                        onChange={(e) => setEditingCampaign({ ...editingCampaign, category: e.target.value as BawmCategory })}
                        className="w-full mt-1 p-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:border-indigo-600 focus:outline-none"
                      >
                        <option value="ralna">Ralna Bawm (Chhiatni)</option>
                        <option value="khawlsak">Khawlsak Bawm (Project/Tanpuina)</option>
                        <option value="rikrum">Rikrum Bawm (Emergency)</option>
                        <option value="kumtluang">Kumtluang Bawm (Kohhran/NGO)</option>
                        <option value="others">Others / Special</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-extrabold text-slate-600 uppercase">Post / QR Status</label>
                      <select
                        value={editingCampaign.status}
                        onChange={(e) => setEditingCampaign({ ...editingCampaign, status: e.target.value as any })}
                        className={`w-full mt-1 p-2 border rounded-xl text-xs font-black focus:outline-none ${
                          editingCampaign.status === 'active' ? 'bg-emerald-50 text-emerald-900 border-emerald-300' :
                          editingCampaign.status === 'pending_approval' ? 'bg-amber-50 text-amber-900 border-amber-300' :
                          editingCampaign.status === 'rejected' ? 'bg-rose-50 text-rose-900 border-rose-300' :
                          'bg-slate-100 text-slate-700 border-slate-300'
                        }`}
                      >
                        <option value="active">Active QR (Payment Enabled)</option>
                        <option value="pending_approval">Pending Approval (Inactive QR)</option>
                        <option value="rejected">Rejected (Payment Blocked)</option>
                        <option value="expired">Expired</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-extrabold text-slate-600 uppercase">Campaign Title / Hming</label>
                    <input
                      type="text"
                      required
                      value={editingCampaign.title}
                      onChange={(e) => setEditingCampaign({ ...editingCampaign, title: e.target.value })}
                      className="w-full mt-1 p-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:border-indigo-600 focus:outline-none"
                      placeholder="e.g. Pi Lalhmingliani Ralna"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-extrabold text-slate-600 uppercase">Settlement UPI ID</label>
                      <input
                        type="text"
                        required
                        value={editingCampaign.upiId}
                        onChange={(e) => setEditingCampaign({ ...editingCampaign, upiId: e.target.value })}
                        className="w-full mt-1 p-2 bg-white border border-slate-200 rounded-xl font-mono text-xs font-bold text-slate-800 focus:border-indigo-600 focus:outline-none"
                        placeholder="e.g. bungkawn.yma@okaxis"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-extrabold text-slate-600 uppercase">Validity Date & Time</label>
                      <input
                        type="text"
                        value={editingCampaign.validityDate || ''}
                        onChange={(e) => setEditingCampaign({ ...editingCampaign, validityDate: e.target.value })}
                        className="w-full mt-1 p-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:border-indigo-600 focus:outline-none"
                        placeholder="YYYY-MM-DDTHH:mm"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-extrabold text-slate-600 uppercase">Location / Veng</label>
                      <input
                        type="text"
                        value={editingCampaign.location || ''}
                        onChange={(e) => setEditingCampaign({ ...editingCampaign, location: e.target.value })}
                        className="w-full mt-1 p-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:border-indigo-600 focus:outline-none"
                        placeholder="e.g. Bungkawn, Aizawl"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-extrabold text-slate-600 uppercase">GPS Coordinates</label>
                      <input
                        type="text"
                        value={editingCampaign.gpsCoords || ''}
                        onChange={(e) => setEditingCampaign({ ...editingCampaign, gpsCoords: e.target.value })}
                        className="w-full mt-1 p-2 bg-white border border-slate-200 rounded-xl font-mono text-xs font-bold text-slate-800 focus:border-indigo-600 focus:outline-none"
                        placeholder="23.7271, 92.7176"
                      />
                    </div>
                  </div>
                </div>

                {/* 2. Category Specific Details */}
                {editingCampaign.category === 'ralna' && (
                  <div className="space-y-3 bg-rose-50/60 p-3.5 rounded-2xl border border-rose-200">
                    <h4 className="text-[10.5px] font-black uppercase text-rose-900 tracking-wider">Ralna Bawm Specifics</h4>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-extrabold text-rose-800 uppercase">Mitthi Hming</label>
                        <input
                          type="text"
                          value={editingCampaign.mitthiHming || ''}
                          onChange={(e) => setEditingCampaign({ ...editingCampaign, mitthiHming: e.target.value })}
                          className="w-full mt-1 p-2 bg-white border border-rose-200 rounded-xl text-xs font-bold text-slate-800"
                          placeholder="Mitthi hming"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-extrabold text-rose-800 uppercase">Kum (Age)</label>
                        <input
                          type="number"
                          value={editingCampaign.age || ''}
                          onChange={(e) => setEditingCampaign({ ...editingCampaign, age: parseInt(e.target.value) || undefined })}
                          className="w-full mt-1 p-2 bg-white border border-rose-200 rounded-xl text-xs font-bold text-slate-800"
                          placeholder="74"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div>
                        <label className="text-[9.5px] font-extrabold text-rose-800 uppercase">Thihni & Hun</label>
                        <input
                          type="text"
                          value={editingCampaign.thihni || ''}
                          onChange={(e) => setEditingCampaign({ ...editingCampaign, thihni: e.target.value })}
                          className="w-full mt-1 p-2 bg-white border border-rose-200 rounded-xl text-xs font-medium text-slate-800"
                          placeholder="2026-08-17 22:30"
                        />
                      </div>
                      <div>
                        <label className="text-[9.5px] font-extrabold text-rose-800 uppercase">Vui Hun</label>
                        <input
                          type="text"
                          value={editingCampaign.vuiHun || ''}
                          onChange={(e) => setEditingCampaign({ ...editingCampaign, vuiHun: e.target.value })}
                          className="w-full mt-1 p-2 bg-white border border-rose-200 rounded-xl text-xs font-medium text-slate-800"
                          placeholder="2026-08-18 13:30"
                        />
                      </div>
                      <div>
                        <label className="text-[9.5px] font-extrabold text-rose-800 uppercase">Vuitu</label>
                        <input
                          type="text"
                          value={editingCampaign.vuitu || ''}
                          onChange={(e) => setEditingCampaign({ ...editingCampaign, vuitu: e.target.value })}
                          className="w-full mt-1 p-2 bg-white border border-rose-200 rounded-xl text-xs font-medium text-slate-800"
                          placeholder="Rev. Dr. C. Lalramnghaka"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {(editingCampaign.category === 'khawlsak' || editingCampaign.category === 'rikrum') && (
                  <div className="space-y-3 bg-amber-50/60 p-3.5 rounded-2xl border border-amber-200">
                    <h4 className="text-[10.5px] font-black uppercase text-amber-900 tracking-wider">
                      {editingCampaign.category === 'khawlsak' ? 'Khawlsak Bawm Specifics' : 'Rikrum Bawm Specifics'}
                    </h4>

                    <div>
                      <label className="text-[10px] font-extrabold text-amber-800 uppercase">Chhan / Purpose / Cause</label>
                      <input
                        type="text"
                        value={editingCampaign.cause || ''}
                        onChange={(e) => setEditingCampaign({ ...editingCampaign, cause: e.target.value })}
                        className="w-full mt-1 p-2 bg-white border border-amber-200 rounded-xl text-xs font-bold text-slate-800"
                        placeholder="Damdawi In senso / Leimin chhiatna"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-extrabold text-amber-800 uppercase">Target Amount (₹)</label>
                        <input
                          type="number"
                          value={editingCampaign.targetAmount || ''}
                          onChange={(e) => setEditingCampaign({ ...editingCampaign, targetAmount: parseFloat(e.target.value) || undefined })}
                          className="w-full mt-1 p-2 bg-white border border-amber-200 rounded-xl text-xs font-bold text-slate-800"
                          placeholder="50000"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-extrabold text-amber-800 uppercase">Max Limit (₹)</label>
                        <input
                          type="number"
                          value={editingCampaign.maxLimit || ''}
                          onChange={(e) => setEditingCampaign({ ...editingCampaign, maxLimit: parseFloat(e.target.value) || undefined })}
                          className="w-full mt-1 p-2 bg-white border border-amber-200 rounded-xl text-xs font-bold text-slate-800"
                          placeholder="100000"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {editingCampaign.category === 'kumtluang' && (
                  <div className="space-y-3 bg-indigo-50/60 p-3.5 rounded-2xl border border-indigo-200">
                    <h4 className="text-[10.5px] font-black uppercase text-indigo-900 tracking-wider">Kumtluang Bawm Specifics</h4>

                    <div>
                      <label className="text-[10px] font-extrabold text-indigo-800 uppercase">Organization / Kohhran Hming</label>
                      <input
                        type="text"
                        value={editingCampaign.orgName || ''}
                        onChange={(e) => setEditingCampaign({ ...editingCampaign, orgName: e.target.value })}
                        className="w-full mt-1 p-2 bg-white border border-indigo-200 rounded-xl text-xs font-bold text-slate-800"
                        placeholder="BCM Ebenezer, Zobawk"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-extrabold text-indigo-800 uppercase">Subcategories (Comma separated)</label>
                      <input
                        type="text"
                        value={editingCampaign.subCategories ? editingCampaign.subCategories.join(', ') : ''}
                        onChange={(e) => {
                          const list = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                          setEditingCampaign({ ...editingCampaign, subCategories: list });
                        }}
                        className="w-full mt-1 p-2 bg-white border border-indigo-200 rounded-xl text-xs font-bold text-slate-800"
                        placeholder="Pathian Ram Zauna, Mission, Building Fund, Tualchhung"
                      />
                    </div>
                  </div>
                )}

                {/* 3. Image URL, File Upload & Presets */}
                <div className="space-y-2.5 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-extrabold text-slate-600 uppercase">Post Image / Banner</label>
                    {editingCampaign.imageUrl && (
                      <button
                        type="button"
                        onClick={() => setEditingCampaign({ ...editingCampaign, imageUrl: '' })}
                        className="text-[10px] font-bold text-rose-600 hover:text-rose-800 cursor-pointer"
                      >
                        Remove Photo
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    {editingCampaign.imageUrl ? (
                      <img
                        src={editingCampaign.imageUrl}
                        alt="Preview"
                        className="w-14 h-14 rounded-xl object-cover border border-slate-300 shrink-0 bg-white"
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-xl bg-slate-200 text-slate-400 flex items-center justify-center shrink-0">
                        <ImageIcon className="w-6 h-6" />
                      </div>
                    )}

                    <div className="flex-1 space-y-2">
                      <input
                        type="text"
                        value={editingCampaign.imageUrl || ''}
                        onChange={(e) => setEditingCampaign({ ...editingCampaign, imageUrl: e.target.value })}
                        className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:border-indigo-600 focus:outline-none"
                        placeholder="Paste image URL (https://...)"
                      />

                      <div className="flex items-center gap-2">
                        <label className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-xl text-[11px] border border-indigo-200 flex items-center gap-1.5 cursor-pointer transition">
                          <Upload className="w-3 h-3" />
                          <span>Upload Local Photo</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onload = (uploadEvent) => {
                                  if (uploadEvent.target?.result) {
                                    setEditingCampaign({
                                      ...editingCampaign,
                                      imageUrl: uploadEvent.target.result as string
                                    });
                                  }
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                          />
                        </label>

                        <div className="flex items-center gap-1 overflow-x-auto text-[10px]">
                          <button
                            type="button"
                            onClick={() => setEditingCampaign({ ...editingCampaign, imageUrl: 'https://images.unsplash.com/photo-1518895949257-7621c3c786d7?w=600&auto=format&fit=crop&q=80' })}
                            className="px-2 py-1 bg-white hover:bg-slate-100 rounded-lg border border-slate-200 text-slate-700 font-medium"
                          >
                            Ralna Preset
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingCampaign({ ...editingCampaign, imageUrl: 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=600&auto=format&fit=crop&q=80' })}
                            className="px-2 py-1 bg-white hover:bg-slate-100 rounded-lg border border-slate-200 text-slate-700 font-medium"
                          >
                            Charity Preset
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 4. Admin Approval Remarks */}
                <div className="space-y-1">
                  <label className="text-[10px] font-extrabold text-slate-600 uppercase">Admin Remarks / Moderation Notes</label>
                  <input
                    type="text"
                    value={editingCampaign.approvalRemarks || ''}
                    onChange={(e) => setEditingCampaign({ ...editingCampaign, approvalRemarks: e.target.value })}
                    className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:border-indigo-600 focus:outline-none"
                    placeholder="e.g. Verified by Admin on 19-Aug-2026"
                  />
                </div>

                {/* Submit Actions */}
                <div className="flex gap-2 pt-2 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setEditingCampaign(null)}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl text-xs transition shadow-md shadow-indigo-200 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Check className="w-4 h-4" /> Save & Update Post
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Creator License / Category Approval Modal Sheet */}
        {editingCreator && (
          <div className="fixed inset-0 bg-slate-950/75 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-fadeIn overflow-y-auto">
            <div className="bg-white w-full max-w-lg rounded-3xl p-5 md:p-6 shadow-2xl border border-indigo-200 space-y-4 text-slate-800 my-auto max-h-[92vh] overflow-y-auto">
              <div className="flex justify-between items-center border-b border-slate-200 pb-3">
                <div>
                  <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
                    <UserCheck className="w-5 h-5 text-indigo-600" />
                    Edit Creator Profile, Rights & Offers
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">Hming, Nihna, Category rights, quota leh rate thlak theihna</p>
                </div>
                <button
                  onClick={() => setEditingCreator(null)}
                  className="text-slate-400 hover:text-slate-600 transition p-1.5 rounded-xl hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Creator Basic Profile & Name Editing */}
              <div className="space-y-3 bg-gradient-to-br from-indigo-50/80 to-purple-50/60 p-4 rounded-2xl border border-indigo-200/90 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase text-indigo-950 tracking-wider flex items-center gap-1.5">
                    <Edit3 className="w-3.5 h-3.5 text-indigo-600" />
                    Creator Hming & Profile Details
                  </span>
                  <span className="text-[9.5px] font-bold text-indigo-700 bg-white px-2 py-0.5 rounded-md border border-indigo-200">
                    Editable
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-extrabold text-slate-700 uppercase">Creator Hming (Full Name)</label>
                    <input
                      type="text"
                      value={creatorEditName}
                      onChange={(e) => setCreatorEditName(e.target.value)}
                      required
                      placeholder="Creator hming..."
                      className="w-full mt-1 p-2.5 bg-white border border-indigo-200 rounded-xl text-xs font-bold text-slate-900 focus:border-indigo-600 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-extrabold text-slate-700 uppercase">Organization / Kohhran</label>
                    <input
                      type="text"
                      value={creatorEditOrgName}
                      onChange={(e) => setCreatorEditOrgName(e.target.value)}
                      placeholder="e.g. BCM Ebenezer / YMA"
                      className="w-full mt-1 p-2.5 bg-white border border-indigo-200 rounded-xl text-xs font-bold text-slate-900 focus:border-indigo-600 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-extrabold text-slate-700 uppercase">Nihna (Designation)</label>
                    <input
                      type="text"
                      value={creatorEditDesignation}
                      onChange={(e) => setCreatorEditDesignation(e.target.value)}
                      placeholder="e.g. Secretary / Treasurer"
                      className="w-full mt-1 p-2.5 bg-white border border-indigo-200 rounded-xl text-xs font-medium text-slate-900 focus:border-indigo-600 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-extrabold text-slate-700 uppercase">Mobile Phone Number</label>
                    <input
                      type="text"
                      value={creatorEditPhone}
                      onChange={(e) => setCreatorEditPhone(e.target.value)}
                      placeholder="9862300000"
                      className="w-full mt-1 p-2.5 bg-white border border-indigo-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:border-indigo-600 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* 1. Approved Bawm Categories */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider">Approved Bawm Categories</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {(['ralna', 'khawlsak', 'rikrum', 'kumtluang', 'others'] as BawmCategory[]).map(cat => {
                    const isSelected = selectedCreatorCategories.includes(cat);
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => {
                          setSelectedCreatorCategories(prev =>
                            isSelected ? prev.filter(c => c !== cat) : [...prev, cat]
                          );
                        }}
                        className={`p-2 rounded-xl text-xs font-bold border transition flex items-center justify-between cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-50 text-indigo-950 border-indigo-300 shadow-2xs'
                            : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <span>{BAWM_CONFIG[cat]?.name}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-indigo-600" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. License / Free Trial Duration & Toggle */}
              <div className="space-y-2 bg-slate-50/80 p-3.5 rounded-2xl border border-slate-200">
                <div className="flex justify-between items-center">
                  <div className="space-y-0.5">
                    <label className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-indigo-600" /> Free Trial Status & Period
                    </label>
                    <p className="text-[10px] text-slate-500">
                      {isCreatorTrialActiveToggle && licenseDuration > 0
                        ? '🟢 Free Trial is Active (0% fee / free trial)'
                        : '🔴 Free Trial is OFF / Expired (Paid Platform Fee Active)'}
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={isCreatorTrialActiveToggle && licenseDuration > 0}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setIsCreatorTrialActiveToggle(checked);
                        if (!checked) {
                          setLicenseDuration(0);
                        } else if (licenseDuration === 0) {
                          setLicenseDuration(180);
                        }
                      }}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                </div>

                <div className="space-y-1 pt-1">
                  <div className="flex justify-between text-[10px] font-bold text-slate-600">
                    <span>Trial Duration (Days)</span>
                    <span className="text-indigo-700">Dynamic from signup date</span>
                  </div>
                  <select
                    value={licenseDuration}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      setLicenseDuration(val);
                      if (val === 0) {
                        setIsCreatorTrialActiveToggle(false);
                      } else {
                        setIsCreatorTrialActiveToggle(true);
                      }
                    }}
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:border-indigo-600 focus:outline-none"
                  >
                    <option value={0}>🚫 0 Days (Turn OFF Trial / Test Paid Platform Fee)</option>
                    <option value={1}>⚡ 1 Day (Quick Testing Trial)</option>
                    <option value={7}>⚡ 7 Days (1 Week Trial)</option>
                    <option value={15}>15 Days (Half Month)</option>
                    <option value={30}>1 Month Trial (30 days)</option>
                    <option value={60}>2 Months (60 days)</option>
                    <option value={90}>3 Months (90 days)</option>
                    <option value={180}>6 Months (180 days - Recommended Fair Offer)</option>
                    <option value={365}>1 Year Full License (365 days)</option>
                    <option value={730}>2 Years License (730 days)</option>
                    <option value={1825}>5 Years Extended NGO License</option>
                  </select>
                  <p className="text-[10px] text-slate-500">
                    * Fee testing i duh chuan <b>&quot;0 Days&quot;</b> emaw Switch hi <b>OFF</b> la, Platform Fee (% leh QR fee) chu a nung nghal ang.
                  </p>
                </div>
              </div>

              {/* 3. Free Posts Quota & Custom Fee Overrides */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Free Posts Quota */}
                <div className="space-y-1.5 bg-slate-50/80 p-3 rounded-2xl border border-slate-200">
                  <label className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Free QR Posts Quota
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={1000}
                    value={creatorFreePostsQuota}
                    onChange={(e) => setCreatorFreePostsQuota(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-900 focus:border-indigo-600 focus:outline-none"
                    placeholder="e.g. 10"
                  />
                  <div className="flex flex-wrap gap-1 pt-1">
                    {[0, 5, 10, 20, 50].map(q => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => setCreatorFreePostsQuota(q)}
                        className={`text-[10px] px-2 py-0.5 rounded-md font-bold border transition ${
                          creatorFreePostsQuota === q
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        {q === 0 ? '0 (No Quota)' : `${q} Posts`}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-500">
                    A thlawn a QR siam theih zat (Used: {editingCreator.freePostsUsed ?? editingCreator.createdQRsCount ?? 0}).
                  </p>
                </div>

                {/* Custom Platform Fee Override */}
                <div className="space-y-1.5 bg-slate-50/80 p-3 rounded-2xl border border-slate-200">
                  <label className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                    <Percent className="w-3.5 h-3.5 text-emerald-600" /> Default Creator Fee %
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="10"
                    value={customPlatformFee}
                    onChange={(e) => setCustomPlatformFee(e.target.value === '' ? '' : parseFloat(e.target.value))}
                    className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-900 focus:border-indigo-600 focus:outline-none"
                    placeholder="Default (Leave blank for global rule)"
                  />
                  <div className="flex gap-1 pt-1">
                    {[
                      { label: '0% Free', val: 0 },
                      { label: '0.5%', val: 0.5 },
                      { label: '1.0%', val: 1.0 },
                      { label: 'Default', val: '' }
                    ].map(item => (
                      <button
                        key={item.label}
                        type="button"
                        onClick={() => setCustomPlatformFee(item.val as any)}
                        className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold border transition ${
                          customPlatformFee === item.val
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-500">
                    Bawm hrang tana set bik neih loh huna hman tur.
                  </p>
                </div>
              </div>

              {/* 4. PER-CATEGORY CUSTOM OVERRIDES MATRIX (Bawm hrang hrang bik tana Offer & Fee Customization) */}
              <div className="bg-indigo-50/60 p-3.5 rounded-2xl border border-indigo-200 space-y-2.5">
                <div className="flex justify-between items-center">
                  <label className="text-[11px] font-black text-indigo-950 uppercase tracking-wider flex items-center gap-1.5">
                    <Coins className="w-4 h-4 text-indigo-700" /> Bawm Tin Custom Offer & Rate (Per-Bawm Matrix)
                  </label>
                  <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-md">
                    Creator Special Rule
                  </span>
                </div>
                <p className="text-[10.5px] text-indigo-900/80 font-medium">
                  Entirnan: He creator tan hian <b>Ralna (0% Free)</b> ni laiin <b>Rikrum (1.0% emaw 0.5%)</b> lak a nih theih nan bawm tinte a mal malin set sak rawh:
                </p>

                <div className="space-y-2">
                  {(['ralna', 'khawlsak', 'rikrum', 'kumtluang', 'others'] as BawmCategory[]).map(cat => {
                    const override = categoryOverridesMap[cat] || {};
                    const globalRule = localPricing.categories[cat];
                    const isCustomized = categoryOverridesMap[cat] !== undefined;

                    return (
                      <div key={cat} className="bg-white p-2.5 rounded-xl border border-indigo-100 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-black text-slate-900">{BAWM_CONFIG[cat]?.name}</span>
                            {isCustomized ? (
                              <span className="text-[9px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded">Custom Rate Set</span>
                            ) : (
                              <span className="text-[9px] bg-slate-100 text-slate-500 font-semibold px-1.5 py-0.5 rounded">Using Global Rate</span>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              if (isCustomized) {
                                // Remove override
                                const updated = { ...categoryOverridesMap };
                                delete updated[cat];
                                setCategoryOverridesMap(updated);
                              } else {
                                // Set initial override
                                setCategoryOverridesMap(prev => ({
                                  ...prev,
                                  [cat]: {
                                    isTrialActive: globalRule?.isFreeTrialActive,
                                    platformFeePercent: globalRule?.platformFeePercent ?? 1.0,
                                  }
                                }));
                              }
                            }}
                            className={`text-[10.5px] font-bold px-2 py-0.5 rounded-lg border transition cursor-pointer ${
                              isCustomized
                                ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                                : 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
                            }`}
                          >
                            {isCustomized ? 'Reset to Global' : '+ Customize for this Creator'}
                          </button>
                        </div>

                        {isCustomized && (
                          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100 animate-fadeIn">
                            {/* Free Trial Toggle for this Bawm */}
                            <div className="bg-slate-50 p-2 rounded-lg border border-slate-200 flex items-center justify-between">
                              <span className="text-[10px] font-bold text-slate-700">Free Offer / Trial:</span>
                              <button
                                type="button"
                                onClick={() => {
                                  setCategoryOverridesMap(prev => ({
                                    ...prev,
                                    [cat]: {
                                      ...prev[cat],
                                      isTrialActive: !override.isTrialActive
                                    }
                                  }));
                                }}
                                className={`text-[10px] font-black px-2 py-0.5 rounded-md cursor-pointer transition ${
                                  override.isTrialActive
                                    ? 'bg-emerald-600 text-white shadow-xs'
                                    : 'bg-slate-200 text-slate-600'
                                }`}
                              >
                                {override.isTrialActive ? 'ON (0% Free)' : 'OFF (Paid Fee)'}
                              </button>
                            </div>

                            {/* Platform Fee % for this Bawm */}
                            <div className="bg-slate-50 p-2 rounded-lg border border-slate-200 flex items-center justify-between gap-1.5">
                              <span className="text-[10px] font-bold text-slate-700">Fee %:</span>
                              <input
                                type="number"
                                step="0.1"
                                min="0"
                                max="10"
                                disabled={override.isTrialActive}
                                value={override.isTrialActive ? 0 : (override.platformFeePercent ?? 1.0)}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 0;
                                  setCategoryOverridesMap(prev => ({
                                    ...prev,
                                    [cat]: {
                                      ...prev[cat],
                                      platformFeePercent: val
                                    }
                                  }));
                                }}
                                className="w-16 p-1 bg-white border border-slate-300 rounded text-center text-xs font-black text-slate-900 focus:outline-none focus:border-indigo-600 disabled:opacity-50"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 5. Lifetime VIP / Permanent Free Service Toggle */}
              <div className="bg-amber-50/80 p-3 rounded-2xl border border-amber-200 flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5 font-black text-amber-950 text-xs">
                    <Sparkles className="w-4 h-4 text-amber-600" /> Lifetime VIP Free Service (100% Free)
                  </div>
                  <p className="text-[10.5px] text-amber-900/80 font-medium">
                    He creator tan hian engtiklai pawhin QR siam leh donation zawng zawng 100% a thlawn vek a ni ang.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={isLifetimeFreeGranted}
                    onChange={(e) => setIsLifetimeFreeGranted(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
                </label>
              </div>

              {/* Submit / Cancel Buttons */}
              <div className="flex gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditingCreator(null)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl text-xs transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleApproveCreator(editingCreator)}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-black py-2.5 rounded-xl text-xs transition shadow-md shadow-indigo-200 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-4 h-4" /> Save Profile, Rights & Offers
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Creator Password / Security PIN Reset Modal Sheet */}
        {resettingPasswordCreator && (
          <div className="fixed inset-0 bg-slate-950/75 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-fadeIn">
            <div className="bg-white w-full max-w-md rounded-3xl p-5 shadow-2xl border border-indigo-200 space-y-4 text-slate-800">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 text-sm">Reset Creator Password / PIN</h3>
                    <p className="text-[10.5px] text-slate-500">{resettingPasswordCreator.name} ({resettingPasswordCreator.phone})</p>
                  </div>
                </div>
                <button
                  onClick={() => setResettingPasswordCreator(null)}
                  className="text-slate-400 hover:text-slate-600 transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-900 space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  Security PIN / Password Update
                </p>
                <p className="text-[11px] text-amber-800">
                  Creator-in an theihnghilh a nih chuan helai atang hian Password thar emaw 6-digit PIN thar i siamsak thei ang.
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[10.5px] font-extrabold text-slate-600 uppercase">New Password / 6-Digit PIN</label>
                    <button
                      type="button"
                      onClick={handleGenerateRandomPin}
                      className="text-[10.5px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                    >
                      <Sparkles className="w-3 h-3" /> Auto-generate PIN
                    </button>
                  </div>
                  <input
                    type="text"
                    value={newCreatorPassword}
                    onChange={(e) => setNewCreatorPassword(e.target.value)}
                    placeholder="Enter 4-8 digit PIN or password"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono font-bold text-slate-900 focus:bg-white focus:border-indigo-600 focus:outline-none tracking-wider"
                  />
                </div>

                <div className="text-[10.5px] text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  Creator Login ID: <strong className="font-mono text-slate-800">{resettingPasswordCreator.phone}</strong>
                </div>
              </div>

              <div className="flex gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setResettingPasswordCreator(null)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl text-xs transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleResetPasswordConfirm}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-black py-2.5 rounded-xl text-xs transition shadow-md shadow-indigo-200 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-4 h-4" /> Save New Credentials
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
