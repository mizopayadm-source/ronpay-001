import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Maximize2,
  Minimize2,
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
  EyeOff,
  ArrowLeft,
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
  ArrowRight,
  Camera,
  FileCheck,
  PhoneCall,
  MapPin,
  CreditCard,
  ShieldAlert,
  Zap,
  Palette,
  Type,
  AlignLeft,
  AlignCenter,
  AlignRight,
  SlidersHorizontal
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
  AnnouncementItem, 
  UserRole, 
  StaffAccount, 
  FeeOptionMode,
  SectionQuickPreset
} from '../types';
import { SectionPresetManagerModal } from './SectionPresetManagerModal';
import { formatDateDDMMYYYY, isCampaignExpired, getTodayDateTimeLocal } from '../utils/date';
import { BAWM_CONFIG, DEFAULT_PRICING_CONFIG } from '../data/initialData';
import { 
  exportFullDatabaseBackup, 
  restoreFullDatabaseBackup, 
  recordAuditLog,
  getStoredAuditLogs,
  getStoredAnnouncement,
  saveStoredAnnouncement,
  DEFAULT_ANNOUNCEMENT_ITEMS,
  isPrefixCodeTaken,
  suggestAlternativePrefixes,
  derivePrefixFromText,
  migrateCampaignMembersPrefix,
  getStoredCreatorsList,
  getStoredStaffAccounts,
  saveStaffAccount,
  deleteStaffAccount,
  isConfirmedTransaction,
  isStoredAdminAuthorized,
  saveAdminAuthState,
  clearAdminAuthState,
  getStoredSectionPresets,
  saveStoredSectionPresets,
  DEFAULT_SECTION_PRESETS
} from '../utils/storage';
import { 
  ROLE_DEFINITIONS, 
  ROLE_RANKS, 
  hasMinimumRole, 
  canManageStaffAccounts, 
  canManagePlatformConfigs, 
  canAccessFinancialReports, 
  canAccessCreatorVerification,
  getRoleBadgeInfo
} from '../utils/rbac';
import { StaffManagementTab } from './StaffManagementTab';
import { 
  pushAllLocalDataToFirestore,
  getFirestoreConnectionStatus,
  subscribeFirestoreStatus,
  FirestoreConnectionStatus
} from '../services/firestoreSync';
import { syncAllWithServer } from '../utils/syncEngine';
import { AnnouncementBannerCard } from './AnnouncementBannerCard';
import { 
  parseMediaUrl, 
  ANNOUNCEMENT_MEDIA_PRESETS,
  ANNOUNCEMENT_BG_THEMES,
  ANNOUNCEMENT_HEIGHT_PRESETS
} from '../utils/media';
import { compressImageFile } from '../utils/imageCompressor';

interface AdminDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaigns: Campaign[];
  transactions: Transaction[];
  creators: CreatorProfile[];
  pricingConfig: SystemPricingConfig;
  announcement?: AnnouncementBanner;
  auditLogs?: AuditLog[];
  userRole?: UserRole;
  onUpdatePricingConfig: (config: SystemPricingConfig) => void;
  onUpdateCampaign: (campaign: Campaign) => void;
  onDeleteCampaign?: (campaignId: string, reason?: string, force?: boolean) => void;
  onApproveCampaign: (campaign: Campaign) => void;
  onRejectCampaign?: (campaignId: string, remarks?: string) => void;
  onUpdateCreator: (creator: CreatorProfile) => void;
  onBlockCreator?: (creatorPhone: string, isBlocked: boolean) => void;
  onApproveCreatorRegistration?: (creator: CreatorProfile, categories: BawmCategory[], validityDays: number) => void;
  onRejectCreatorRegistration?: (creatorPhone: string, reason: string) => void;
  onUpdateAnnouncement?: (ann: AnnouncementBanner) => void;
  onRestoreDatabase?: (jsonString: string) => boolean;
  onResetData: () => void;
  currentProfile?: CreatorProfile | null;
  onViewReceipt?: (tx: any) => void;
  onUpdateTransaction?: (tx: Transaction) => void;
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
  userRole = 'SUPER_ADMIN',
  currentProfile,
  onViewReceipt,
  onUpdateTransaction,
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
  // Mandatory Login Gate: Check if current user profile has the `isAdmin: true` flag.
  // If not, redirect them or prompt for an admin password before allowing access.
  const isProfileAdmin = Boolean(currentProfile?.isAdmin === true);

  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    // If current profile has isAdmin: true or was authorized across tabs/windows, grant access
    if (isProfileAdmin) return true;
    return isStoredAdminAuthorized();
  });
  const [currentRole, setCurrentRole] = useState<UserRole>(userRole || 'SUPER_ADMIN');
  const [staffList, setStaffList] = useState<StaffAccount[]>(() => getStoredStaffAccounts());
  const [adminUserId, setAdminUserId] = useState<string>('');
  const [adminPassword, setAdminPassword] = useState<string>('');
  const [showAdminPassword, setShowAdminPassword] = useState<boolean>(false);
  const [loginError, setLoginError] = useState<string>('');
  const [isBiometricScanning, setIsBiometricScanning] = useState<boolean>(false);

  // Admin tabs
  const [activeTab, setActiveTab] = useState<'staff' | 'creators' | 'campaigns' | 'announcement' | 'audit' | 'backup' | 'rates' | 'finances' | 'gateway'>('campaigns');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Creators sub-filter
  const [creatorFilter, setCreatorFilter] = useState<'all' | 'pending' | 'upgrades' | 'approved' | 'blocked'>('all');
  
  // Campaigns sub-filter
  const [campaignFilter, setCampaignFilter] = useState<'all' | 'pending' | 'active' | 'expired' | 'rejected'>('all');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [deleteConfirmCamp, setDeleteConfirmCamp] = useState<{
    camp: Campaign;
    reason: string;
    force: boolean;
    collected: number;
    hasTxns: boolean;
  } | null>(null);
  const [campaignActionToast, setCampaignActionToast] = useState<string | null>(null);

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

  // Full Screen / Expanded Display Mode for Desktop & Web Browsers
  const [isFullScreen, setIsFullScreen] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('ronpay_admin_fullscreen');
      if (saved !== null) return saved === 'true';
      // Default to full screen on screens >= 768px (iPad / Laptop / Desktop PC)
      if (typeof window !== 'undefined') {
        return window.innerWidth >= 768;
      }
    } catch {
      // fallback
    }
    return true;
  });

  const toggleFullScreen = () => {
    setIsFullScreen(prev => {
      const next = !prev;
      try {
        localStorage.setItem('ronpay_admin_fullscreen', String(next));
      } catch {}
      return next;
    });
  };

  // Creator License, Profile, Photos & Custom Override Modal
  const [editingCreator, setEditingCreator] = useState<CreatorProfile | null>(null);
  const [creatorEditName, setCreatorEditName] = useState<string>('');
  const [creatorEditOrgName, setCreatorEditOrgName] = useState<string>('');
  const [creatorEditDesignation, setCreatorEditDesignation] = useState<string>('');
  const [creatorEditPhone, setCreatorEditPhone] = useState<string>('');
  const [creatorEditAvatarUrl, setCreatorEditAvatarUrl] = useState<string>('');
  const [creatorEditLogoUrl, setCreatorEditLogoUrl] = useState<string>('');
  const [creatorEditDocName, setCreatorEditDocName] = useState<string>('');
  const [creatorEditDocUrl, setCreatorEditDocUrl] = useState<string>('');
  const [creatorEditUpiId, setCreatorEditUpiId] = useState<string>('');
  const [creatorEditAddress, setCreatorEditAddress] = useState<string>('');
  const [creatorEditPassword, setCreatorEditPassword] = useState<string>('');
  const [isCreatorVerifiedCheck, setIsCreatorVerifiedCheck] = useState<boolean>(true);
  const [isCreatorTrialActiveToggle, setIsCreatorTrialActiveToggle] = useState<boolean>(true);
  const [licenseDuration, setLicenseDuration] = useState<number>(180); // days
  const [selectedCreatorCategories, setSelectedCreatorCategories] = useState<BawmCategory[]>(['ralna', 'khawlsak']);
  const [creatorFreePostsQuota, setCreatorFreePostsQuota] = useState<number>(10);
  const [customPlatformFee, setCustomPlatformFee] = useState<number | ''>('');
  const [isLifetimeFreeGranted, setIsLifetimeFreeGranted] = useState<boolean>(false);
  const [creatorDefaultFeeOptionRule, setCreatorDefaultFeeOptionRule] = useState<FeeOptionMode>('ADD_ON');
  // Per-category granular overrides for specific creator
  const [categoryOverridesMap, setCategoryOverridesMap] = useState<Partial<Record<BawmCategory, { isTrialActive?: boolean; platformFeePercent?: number; freePostsQuota?: number }>>>({});

  // Decline / Rejection Dialog state
  const [decliningCreator, setDecliningCreator] = useState<CreatorProfile | null>(null);
  const [declineReasonText, setDeclineReasonText] = useState<string>('In-verify-na lehkha / details a chiang tawk lo');
  const [isBlockCreatorOnDecline, setIsBlockCreatorOnDecline] = useState<boolean>(false);

  // Creator View Mode & Password Reset
  const [creatorViewMode, setCreatorViewMode] = useState<'list' | 'ranking'>('list');
  const [resettingPasswordCreator, setResettingPasswordCreator] = useState<CreatorProfile | null>(null);
  const [newCreatorPassword, setNewCreatorPassword] = useState<string>('');
  const [resetSuccessToast, setResetSuccessToast] = useState<string | null>(null);

  // Admin Campaign Edit Modal
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);

  // Section Presets Management State (Admin Quick Preset Setup)
  const [isSectionPresetModalOpen, setIsSectionPresetModalOpen] = useState<boolean>(false);
  const [sectionPresets, setSectionPresets] = useState<SectionQuickPreset[]>(() => getStoredSectionPresets());
  const [campaignEditNewSection, setCampaignEditNewSection] = useState<string>('');

  useEffect(() => {
    const handlePresetsUpdate = () => {
      setSectionPresets(getStoredSectionPresets());
    };
    window.addEventListener('ronpay_section_presets_updated', handlePresetsUpdate);
    return () => window.removeEventListener('ronpay_section_presets_updated', handlePresetsUpdate);
  }, []);

  // Restore file state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [restoreNotice, setRestoreNotice] = useState<{ message: string; isError?: boolean } | null>(null);

  // Firebase Cloud Sync State
  const [firebaseStatus, setFirebaseStatus] = useState<FirestoreConnectionStatus>(getFirestoreConnectionStatus);
  const [isSyncingToCloud, setIsSyncingToCloud] = useState<boolean>(false);
  const [cloudSyncMessage, setCloudSyncMessage] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeFirestoreStatus((status, msg) => {
      setFirebaseStatus(status);
      if (msg) setCloudSyncMessage(msg);
    });
    return () => unsub();
  }, []);

  const handlePushAllToCloud = async () => {
    setIsSyncingToCloud(true);
    setCloudSyncMessage(null);
    try {
      const result = await pushAllLocalDataToFirestore();
      if (result.success) {
        setRestoreNotice({
          message: `☁️ Realtime Cloud Synchronization Active! Successfully synced ${result.count} local records to Firebase Firestore (ronpay-7fc69).`
        });
        recordAuditLog('Cloud Database Sync Pushed', `Pushed ${result.count} records to Firebase Firestore.`, 'system');
        setLogsList(getStoredAuditLogs());
      } else {
        setRestoreNotice({
          message: '⚠️ Cloud sync deferred to offline queue.',
          isError: true
        });
      }
    } catch (err: any) {
      setRestoreNotice({
        message: `⚠️ Cloud sync notice: ${err?.message || 'Offline cache active'}`,
        isError: true
      });
    } finally {
      setIsSyncingToCloud(false);
    }
  };

  const handleForcePullCloud = async () => {
    setIsSyncingToCloud(true);
    try {
      await syncAllWithServer();
      setRestoreNotice({
        message: '🔄 Realtime sync refreshed across Web, App, and AI Studio!'
      });
    } catch (e: any) {
      setRestoreNotice({
        message: '⚠️ Sync fallback active.',
        isError: true
      });
    } finally {
      setIsSyncingToCloud(false);
    }
  };

  // Sync pricing & announcements when props change
  useEffect(() => {
    if (pricingConfig) setLocalPricing(pricingConfig);
  }, [pricingConfig]);

  useEffect(() => {
    if (announcement) setLocalAnnouncement(announcement);
  }, [announcement]);

  useEffect(() => {
    if (isOpen) {
      setLoginError('');
      if (currentProfile?.isAdmin === true || isStoredAdminAuthorized()) {
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(false);
      }
    }
  }, [isOpen, currentProfile?.isAdmin]);

  // Real-time synchronization across windows, tabs, and devices
  useEffect(() => {
    const handleRealtimeSync = () => {
      setStaffList(getStoredStaffAccounts());
      setLogsList(getStoredAuditLogs());
      if (!isProfileAdmin) {
        if (isStoredAdminAuthorized()) {
          setIsAuthenticated(true);
        }
      }
    };
    window.addEventListener('ronpay_staff_updated', handleRealtimeSync);
    window.addEventListener('ronpay_realtime_sync_event', handleRealtimeSync);
    window.addEventListener('ronpay_data_synced', handleRealtimeSync);
    window.addEventListener('storage', handleRealtimeSync);
    return () => {
      window.removeEventListener('ronpay_staff_updated', handleRealtimeSync);
      window.removeEventListener('ronpay_realtime_sync_event', handleRealtimeSync);
      window.removeEventListener('ronpay_data_synced', handleRealtimeSync);
      window.removeEventListener('storage', handleRealtimeSync);
    };
  }, [isProfileAdmin]);

  // Biometric Login handler for Admin - Restricted to enrolled administrators
  const handleAdminBiometricLogin = () => {
    setIsBiometricScanning(true);
    setLoginError('');
    
    setTimeout(() => {
      setIsBiometricScanning(false);
      const isEnrolledAdmin = currentProfile?.isAdmin === true && (currentProfile.role === 'SUPER_ADMIN' || currentProfile.role === 'ADMIN');
      const hasStoredAdminToken = localStorage.getItem('ronpay_admin_biometric_enrolled') === 'true';

      if (isEnrolledAdmin || hasStoredAdminToken) {
        setIsAuthenticated(true);
        const targetRole: UserRole = currentProfile?.role === 'ADMIN' ? 'ADMIN' : 'SUPER_ADMIN';
        setCurrentRole(targetRole);
        saveAdminAuthState(targetRole, currentProfile);
        recordAuditLog('Admin Biometric Login', 'Administrator authenticated via Biometrics.', 'system');
        setLogsList(getStoredAuditLogs());
      } else {
        setLoginError('Biometric admin verification is not enrolled on this device. Khawngaihin Master Admin Password chhuah rawh.');
      }
    }, 650);
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const uid = adminUserId.trim().toLowerCase();
    const pwd = adminPassword.trim();
    
    // Check master superadmin credentials
    if (
      (uid === 'admin' || uid === 'superadmin' || uid === 'admin@ronpay.com' || uid === 'superadmin@ronpay.com' || uid === 'admin@ronpay.mizoram.gov.in' || !uid || uid === currentProfile?.phone || uid === currentProfile?.name?.toLowerCase()) &&
      (pwd === 'admin' || pwd === 'ronpay2026' || pwd === 'ronpay@admin2026')
    ) {
      setCurrentRole('SUPER_ADMIN');
      setIsAuthenticated(true);
      setLoginError('');
      saveAdminAuthState('SUPER_ADMIN', currentProfile);
      recordAuditLog('Admin Password Verified', `Admin password verified for user ${currentProfile?.name || 'Guest'} (${currentProfile?.phone || 'Unknown'}).`, 'system');
      setLogsList(getStoredAuditLogs());
      return;
    }

    // Check pre-configured staff accounts
    const currentStaffList = getStoredStaffAccounts();
    const matchedStaff = currentStaffList.find(
      st => (st.name.toLowerCase() === uid || st.email.toLowerCase() === uid || st.phone === uid) && st.isActive
    );

    if (matchedStaff && (pwd === 'ronpay2026' || pwd === 'admin' || pwd === matchedStaff.phone)) {
      setCurrentRole(matchedStaff.role);
      setIsAuthenticated(true);
      setLoginError('');
      saveAdminAuthState(matchedStaff.role, currentProfile);
      recordAuditLog(`${matchedStaff.role} Login`, `Staff member "${matchedStaff.name}" (${matchedStaff.role}) authenticated via Password.`, 'system');
      setLogsList(getStoredAuditLogs());
      return;
    }

    setLoginError('Admin Password a dik lo. Khawngaihin password dik tak chhuah rawh le.');
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    clearAdminAuthState();
    setAdminUserId('');
    setAdminPassword('');
  };

  // Real-time synchronization of creators from prop + localStorage
  const activeCreatorsList = React.useMemo(() => {
    const fromStorage = getStoredCreatorsList();
    const map = new Map<string, CreatorProfile>();
    
    // First load from storage
    fromStorage.forEach(c => {
      if (c.phone) {
        map.set(c.phone, c);
      }
    });
    
    // Then merge with creators prop
    creators.forEach(c => {
      if (c.phone) {
        const existing = map.get(c.phone) || {};
        map.set(c.phone, { ...existing, ...c });
      }
    });
    
    return Array.from(map.values());
  }, [creators, isOpen]);

  // Pending counts
  const pendingCreators = activeCreatorsList.filter(c => !c.isApproved);
  const pendingUpgrades = activeCreatorsList.filter(c => !!c.pendingUpgrade);
  const pendingCampaigns = campaigns.filter(c => c.status === 'pending_approval');
  const activeCampaigns = campaigns.filter(c => c.status === 'active' && !isCampaignExpired(c.validityDate, c.status));
  const expiredCampaigns = campaigns.filter(c => c.status === 'expired' || (c.status !== 'pending_approval' && c.status !== 'rejected' && isCampaignExpired(c.validityDate, c.status)));
  const rejectedCampaigns = campaigns.filter(c => c.status === 'rejected');

  // Quick 1-Click Approve for pending creator applications
  const handleQuickApproveCreator = (creator: CreatorProfile) => {
    const trialDays = creator.customTrialDays !== undefined && creator.customTrialDays > 0 ? creator.customTrialDays : 180;
    const expiresAt = new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000);
    const approvedCats: BawmCategory[] = creator.approvedCategories && creator.approvedCategories.length > 0
      ? creator.approvedCategories
      : ['ralna', 'khawlsak', 'rikrum', 'kumtluang'];

    const updated: CreatorProfile = {
      ...creator,
      isApproved: true,
      isBlocked: false,
      isPhoneVerified: true,
      approvedCategories: approvedCats,
      trialExpiresAt: expiresAt.toISOString(),
      customTrialDays: trialDays,
      freePostsQuota: creator.freePostsQuota ?? 10,
    };

    onUpdateCreator(updated);
    recordAuditLog(
      'Creator Application Approved (Quick)',
      `Quick approved ${creator.name} (${creator.phone}) with ${trialDays}-day trial and categories: ${approvedCats.join(', ')}.`,
      'creator',
      creator.phone
    );
    setLogsList(getStoredAuditLogs());
    alert(`✅ ${creator.name} (${creator.phone}) creator account approve fel a ni ta!\nTrial: ${trialDays} Days active.`);
  };

  // Creator moderation helper (Opens Review & Inspection Studio)
  const handleOpenCreatorEditor = (creator: CreatorProfile) => {
    setEditingCreator(creator);
    setCreatorEditName(creator.name || '');
    setCreatorEditOrgName(creator.orgName || '');
    setCreatorEditDesignation(creator.designation || '');
    setCreatorEditPhone(creator.phone || '');
    setCreatorEditAvatarUrl(creator.avatarUrl || '');
    setCreatorEditLogoUrl(creator.logoUrl || '');
    setCreatorEditDocName(creator.authDocName || '');
    setCreatorEditDocUrl(creator.authDocUrl || '');
    setCreatorEditUpiId(creator.upiId || '');
    setCreatorEditAddress(creator.address || '');
    setCreatorEditPassword(creator.password || creator.pin || '');
    setIsCreatorVerifiedCheck(creator.isPhoneVerified !== false);
    setSelectedCreatorCategories(creator.approvedCategories?.length > 0 ? creator.approvedCategories : ['ralna', 'khawlsak', 'rikrum', 'kumtluang']);
    const isTrialExpired = creator.trialExpiresAt ? new Date(creator.trialExpiresAt).getTime() <= Date.now() : (creator.customTrialDays === 0);
    setIsCreatorTrialActiveToggle(!isTrialExpired);
    setLicenseDuration(creator.customTrialDays !== undefined ? creator.customTrialDays : 180);
    setCreatorFreePostsQuota(creator.freePostsQuota !== undefined ? creator.freePostsQuota : 10);
    setCustomPlatformFee(creator.customPlatformFeePercent !== undefined ? creator.customPlatformFeePercent : '');
    setIsLifetimeFreeGranted(!!creator.isFreeServiceGranted);
    setCreatorDefaultFeeOptionRule(creator.defaultFeeOptionRule || 'ADD_ON');
    setCategoryOverridesMap(creator.categoryCustomOverrides || {});
  };

  // Creator moderation - Save with Approval or Update
  const handleApproveCreator = (creator: CreatorProfile, keepPending: boolean = false) => {
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

    const willBeApproved = keepPending ? false : true;

    const updated: CreatorProfile = {
      ...creator,
      name: nextName,
      orgName: nextOrg,
      designation: nextDesignation,
      phone: nextPhone,
      avatarUrl: creatorEditAvatarUrl.trim() || undefined,
      logoUrl: creatorEditLogoUrl.trim() || undefined,
      authDocName: creatorEditDocName.trim() || creator.authDocName,
      authDocUrl: creatorEditDocUrl.trim() || creator.authDocUrl,
      upiId: creatorEditUpiId.trim() || undefined,
      address: creatorEditAddress.trim() || undefined,
      password: creatorEditPassword.trim() || creator.password,
      pin: creatorEditPassword.trim() || creator.pin,
      isApproved: willBeApproved,
      isBlocked: false,
      isPhoneVerified: isCreatorVerifiedCheck,
      rejectionReason: willBeApproved ? undefined : creator.rejectionReason,
      approvedCategories: selectedCreatorCategories.length > 0 ? selectedCreatorCategories : ['ralna', 'khawlsak', 'rikrum', 'kumtluang'],
      trialExpiresAt: expiresAt.toISOString(),
      customTrialDays: (!isCreatorTrialActiveToggle || licenseDuration === 0) ? 0 : licenseDuration,
      freePostsQuota: creatorFreePostsQuota,
      customPlatformFeePercent: customPlatformFee === '' ? undefined : Number(customPlatformFee),
      defaultFeeOptionRule: creatorDefaultFeeOptionRule,
      isFreeServiceGranted: isLifetimeFreeGranted,
      categoryCustomOverrides: categoryOverridesMap,
    };

    onUpdateCreator(updated);
    recordAuditLog(
      willBeApproved ? 'Creator Application Approved & Verified' : 'Creator Profile Updated (Pending)',
      `Updated profile & privileges for ${nextName} (${nextPhone}): Status: ${willBeApproved ? 'Approved' : 'Pending Review'}, Trial: ${isCreatorTrialActiveToggle && licenseDuration > 0 ? licenseDuration + ' days' : 'OFF (Paid Fee Active)'}, ${creatorFreePostsQuota} free posts quota, Photo/Logo updated.`,
      'creator',
      nextPhone
    );
    setLogsList(getStoredAuditLogs());
    setEditingCreator(null);
    setResetSuccessToast(willBeApproved 
      ? `✅ ${nextName} (${nextPhone}) creator account approve & activate fel a ni ta!` 
      : `✅ ${nextName} details & photos save fel a ni (Pending-ah a la awm e).`
    );
    setTimeout(() => setResetSuccessToast(null), 4000);
  };

  // Dedicated Decline & Reject Flow (No prompt dialog issues)
  const handleOpenDeclineModal = (creator: CreatorProfile) => {
    setDecliningCreator(creator);
    setDeclineReasonText('In-verify-na lehkha / details a chiang tawk lo');
    setIsBlockCreatorOnDecline(false);
  };

  const handleConfirmDeclineCreator = () => {
    if (!decliningCreator) return;
    const reason = declineReasonText.trim() || 'Application declined by administrator';

    const updated: CreatorProfile = {
      ...decliningCreator,
      isApproved: false,
      isBlocked: isBlockCreatorOnDecline,
      rejectionReason: reason
    };

    if (onRejectCreatorRegistration) {
      onRejectCreatorRegistration(decliningCreator.phone, reason);
    } else {
      onUpdateCreator(updated);
    }

    recordAuditLog(
      isBlockCreatorOnDecline ? 'Creator Application Declined & Blocked' : 'Creator Application Declined',
      `Declined application for ${decliningCreator.name} (${decliningCreator.phone}). Reason: ${reason}`,
      'creator',
      decliningCreator.phone
    );
    setLogsList(getStoredAuditLogs());
    const applicantName = decliningCreator.name;
    setDecliningCreator(null);
    if (editingCreator && editingCreator.phone === decliningCreator.phone) {
      setEditingCreator(null);
    }
    setResetSuccessToast(`❌ ${applicantName} creator application reject fel a ni.`);
    setTimeout(() => setResetSuccessToast(null), 4000);
  };

  const handleApproveUpgrade = (creator: CreatorProfile) => {
    if (!creator.pendingUpgrade) return;
    const req = creator.pendingUpgrade as any;
    const reqType = req.type || 'add';
    const catTarget = req.category as BawmCategory;
    const catName = BAWM_CONFIG[catTarget]?.name || catTarget;

    let updatedCategories: BawmCategory[];
    if (reqType === 'remove') {
      updatedCategories = (creator.approvedCategories || []).filter(c => c !== catTarget);
    } else {
      updatedCategories = Array.from(new Set([...(creator.approvedCategories || []), catTarget]));
    }

    const updated: CreatorProfile = {
      ...creator,
      approvedCategories: updatedCategories,
      pendingUpgrade: undefined,
    };
    onUpdateCreator(updated);
    recordAuditLog(
      reqType === 'remove' ? 'Creator Category Removed' : 'Creator Category Upgrade Approved',
      `Admin approved ${reqType === 'remove' ? 'removal of' : 'addition of'} category ${catName} for ${creator.name} (${creator.phone}). Reason: ${req.reason || 'N/A'}.`,
      'creator',
      creator.phone
    );
    setLogsList(getStoredAuditLogs());
    const msg = reqType === 'remove'
      ? `✅ CATEGORY PAIH FEL A NI!\n\n${creator.name} hnen atangin ${catName} category paih fel a ni ta.`
      : `✅ CATEGORY UPGRADE APPROVED!\n\n${creator.name} can now create posts in ${catName}.`;
    setResetSuccessToast(reqType === 'remove' ? `✅ Category ${catName} paih fel a ni ta.` : `✅ Category ${catName} approve a ni ta.`);
    setTimeout(() => setResetSuccessToast(null), 4000);
    alert(msg);
  };

  const handleRejectUpgrade = (creator: CreatorProfile) => {
    if (!creator.pendingUpgrade) return;
    const req = creator.pendingUpgrade as any;
    const reqType = req.type || 'add';
    const catTarget = req.category as BawmCategory;
    const catName = BAWM_CONFIG[catTarget]?.name || catTarget;

    const updated: CreatorProfile = {
      ...creator,
      pendingUpgrade: undefined,
    };
    onUpdateCreator(updated);
    recordAuditLog(
      reqType === 'remove' ? 'Creator Category Removal Declined' : 'Creator Upgrade Declined',
      `Admin declined ${reqType === 'remove' ? 'category removal of' : 'category upgrade to'} ${catName} for ${creator.name} (${creator.phone}).`,
      'creator',
      creator.phone
    );
    setLogsList(getStoredAuditLogs());
    const msg = reqType === 'remove'
      ? `ℹ️ Category ${catName} paih dilna hi decline/thulh a ni.`
      : `ℹ️ Upgrade request for ${catName} was declined.`;
    setResetSuccessToast(`ℹ️ Category ${reqType === 'remove' ? 'removal' : 'upgrade'} request declined.`);
    setTimeout(() => setResetSuccessToast(null), 4000);
    alert(msg);
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
    return activeCreatorsList.map(c => {
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
  }, [activeCreatorsList, campaigns, transactions]);

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

    const originalCamp = campaigns.find(c => c.id === editingCampaign.id);
    const oldPrefix = (originalCamp?.orgCode || '').trim().toUpperCase();
    let finalPrefix = (editingCampaign.orgCode || '').trim().toUpperCase() || oldPrefix || derivePrefixFromText(editingCampaign.orgName || editingCampaign.title);

    if (isPrefixCodeTaken(finalPrefix, editingCampaign.id)) {
      if (editingCampaign.category !== 'kumtluang') {
        const suggestions = suggestAlternativePrefixes(finalPrefix, editingCampaign.id);
        finalPrefix = suggestions[0] || `${finalPrefix.substring(0, 2)}${Math.floor(10 + Math.random() * 89)}`;
        editingCampaign.orgCode = finalPrefix;
      } else {
        const suggestions = suggestAlternativePrefixes(finalPrefix);
        alert(`⚠️ Prefix Code "${finalPrefix}" hi Bawm dangin an hmang tawh a ni!\n\nPrefix dang thlang rawh le:\n${suggestions.join(', ')}`);
        return;
      }
    }

    let migratedCount = 0;
    if (oldPrefix && finalPrefix && oldPrefix !== finalPrefix) {
      migratedCount = migrateCampaignMembersPrefix(editingCampaign.id, oldPrefix, finalPrefix);
    }

    let finalStatus = editingCampaign.status;
    const isDateInFuture = editingCampaign.validityDate && new Date(editingCampaign.validityDate).getTime() > Date.now();
    if (isDateInFuture && finalStatus === 'expired') {
      finalStatus = 'active';
    }

    const campaignToSave: Campaign = {
      ...editingCampaign,
      orgCode: finalPrefix,
      sectionLabel: editingCampaign.category === 'kumtluang' ? (editingCampaign.sectionLabel?.trim() || 'Bial / Section') : editingCampaign.sectionLabel,
      definedSections: editingCampaign.category === 'kumtluang' ? (editingCampaign.definedSections || []) : editingCampaign.definedSections,
      status: finalStatus,
      updatedAt: new Date().toISOString()
    };

    onUpdateCampaign(campaignToSave);
    recordAuditLog(
      'Admin Edited Campaign Post',
      `Admin updated details of post/campaign '${campaignToSave.title}' (${campaignToSave.id}). Category: ${campaignToSave.category}, Prefix: ${finalPrefix}, Status: ${campaignToSave.status}.`,
      'campaign',
      campaignToSave.id
    );
    setLogsList(getStoredAuditLogs());
    const campTitle = campaignToSave.title;
    setEditingCampaign(null);
    if (migratedCount > 0) {
      alert(`✅ CAMPAIGN POST UPDATED!\n\n'${campTitle}' has been updated. Prefix code changed to [${finalPrefix}] and ${migratedCount} registered members were automatically migrated to '${finalPrefix}-XXXX'.`);
    } else {
      alert(`✅ CAMPAIGN POST UPDATED!\n\n'${campTitle}' has been successfully updated.`);
    }
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
  const filteredCreators = activeCreatorsList.filter(c => {
    if (creatorFilter === 'pending' && c.isApproved) return false;
    if (creatorFilter === 'upgrades' && !c.pendingUpgrade) return false;
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
    if (campaignFilter === 'active' && (c.status !== 'active' || isCampaignExpired(c.validityDate, c.status))) return false;
    if (campaignFilter === 'expired' && !(c.status === 'expired' || isCampaignExpired(c.validityDate, c.status))) return false;
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
    <div className={`fixed inset-0 z-50 flex items-center justify-center backdrop-blur-xs animate-fadeIn text-slate-900 transition-all ${
      isFullScreen 
        ? 'p-0 bg-slate-950/85' 
        : 'p-0 sm:p-2 md:p-3 bg-slate-900/70'
    }`}>
      <div className={`bg-white relative flex flex-col shrink-0 overflow-hidden shadow-2xl transition-all duration-150 ${
        isFullScreen 
          ? 'w-full h-full max-w-none max-h-none rounded-none border-0' 
          : 'w-full max-w-[98vw] 2xl:max-w-[96vw] h-full sm:h-[97vh] max-h-[97vh] sm:rounded-3xl rounded-none border-0 sm:border border-slate-200'
      }`}>
        
        {/* Top Header */}
        <div className="bg-gradient-to-r from-indigo-900 via-indigo-850 to-slate-900 text-white p-4 sm:p-5 flex items-center justify-between border-b border-indigo-700/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center shadow-md font-black">
              <ShieldCheck className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-white tracking-wide">RonPay Admin Console</h2>
                <span className="text-[9.5px] font-black bg-amber-400 text-slate-950 px-2 py-0.5 rounded-full uppercase shadow-xs">
                  Master Console
                </span>
              </div>
              <p className="text-xs text-indigo-100 font-medium">Community Moderation, Biometric Security & Platform Config</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Full Screen / Window Size Toggle */}
            <button
              type="button"
              onClick={toggleFullScreen}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-black transition cursor-pointer border border-white/20 active:scale-95 shadow-2xs"
              title={isFullScreen ? "Restore Window Size (Window ah siam rawh)" : "Full Screen Mode (Screen lian puiin dah rawh)"}
            >
              {isFullScreen ? (
                <>
                  <Minimize2 className="w-3.5 h-3.5 text-amber-300" />
                  <span className="hidden md:inline">Window</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-3.5 h-3.5 text-amber-300" />
                  <span className="hidden md:inline">Full Screen</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black px-3.5 py-1.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
              title="Return to user app view"
            >
              <Smartphone className="w-3.5 h-3.5 text-slate-950" />
              <span>App En Rawh</span>
            </button>

            {isAuthenticated && (
              <button
                onClick={handleLogout}
                className="bg-white/10 hover:bg-rose-600 hover:text-white text-white text-xs font-bold px-3 py-1.5 rounded-xl border border-white/20 transition flex items-center gap-1.5 cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Logout</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 text-white hover:bg-white/20 flex items-center justify-center transition cursor-pointer"
              title="Close Admin Panel"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Auth Guard Screen - Mandatory Login Gate */}
        {!isAuthenticated ? (
          <div className="p-6 sm:p-10 flex-1 overflow-y-auto flex flex-col items-center justify-center text-center space-y-4">
            <div className={`w-16 h-16 rounded-3xl ${!isProfileAdmin ? 'bg-rose-50 border-2 border-rose-200 text-rose-600 shadow-rose-100' : 'bg-indigo-50 border-2 border-indigo-200 text-indigo-600 shadow-indigo-100'} flex items-center justify-center shadow-lg`}>
              {!isProfileAdmin ? <ShieldAlert className="w-8 h-8" /> : <KeyRound className="w-8 h-8" />}
            </div>

            <div className="space-y-1 max-w-md">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-100 border border-rose-200 text-rose-800 text-[10.5px] font-black uppercase tracking-wider mb-1">
                <Lock className="w-3 h-3" />
                <span>Mandatory Login Gate</span>
              </div>
              <h3 className="text-xl font-black text-slate-900 tracking-tight">
                {!isProfileAdmin ? 'Admin Clearance Required' : 'Administrator Session Locked'}
              </h3>
              <p className="text-xs text-slate-500">
                {!isProfileAdmin
                  ? 'Access restricted. Current user profile does not have administrator privileges.'
                  : `Welcome back, ${currentProfile?.name || 'Admin'}. Enter password to resume access.`}
              </p>
            </div>

            {/* Non-Admin Account Warning & Status Card */}
            {!isProfileAdmin && (
              <div className="w-full max-w-sm bg-amber-50/90 border border-amber-200/90 rounded-2xl p-3.5 text-left space-y-2 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-amber-900 font-extrabold text-xs">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Non-Admin Account Detected</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 font-mono text-[10px] font-black border border-rose-200">
                    isAdmin: false
                  </span>
                </div>
                <div className="text-[11px] text-slate-700 space-y-0.5 pt-0.5 border-t border-amber-200/60">
                  <div><b>Profile:</b> {currentProfile?.name || 'Guest User'} {currentProfile?.phone ? `(${currentProfile.phone})` : ''}</div>
                  <div><b>Status:</b> Regular Account • No Direct Clearance</div>
                </div>
                <p className="text-[11px] text-amber-950/90 leading-relaxed font-medium">
                  RonPay Admin Console luh nan hian Administrator nihna (<code>isAdmin: true</code>) neih a ngai. Admin Master Password chhuah la, a nih loh chuan App-ah kir leh rawh le.
                </p>
              </div>
            )}

            <div className="w-full max-w-sm space-y-3">
              {/* Option 1: Immediate Redirect Back to User App */}
              <button
                type="button"
                onClick={onClose}
                className="w-full py-3 px-4 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                title="Return to user app view"
              >
                <ArrowLeft className="w-4 h-4 text-amber-400 shrink-0" />
                <span>App-ah Kir Leh Rawh (Redirect to App)</span>
              </button>

              <div className="flex items-center gap-2 text-slate-300 my-1">
                <div className="h-px bg-slate-200 flex-1" />
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                  {!isProfileAdmin ? 'A Nih Loh Chuan Admin Password' : 'Or Verify Credentials'}
                </span>
                <div className="h-px bg-slate-200 flex-1" />
              </div>

              {/* Option 2: Admin Password Verification Form */}
              <form onSubmit={handleLogin} className="space-y-3 text-left">
                <div>
                  <label className="text-[10.5px] font-extrabold text-slate-600 uppercase flex items-center justify-between">
                    <span>Admin Username / Staff ID</span>
                    <span className="text-[9.5px] text-slate-400 font-normal">Optional</span>
                  </label>
                  <input
                    type="text"
                    value={adminUserId}
                    onChange={(e) => setAdminUserId(e.target.value)}
                    className="w-full mt-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:border-indigo-600 focus:outline-none"
                    placeholder="admin / superadmin / staff ID"
                  />
                </div>
                <div>
                  <label className="text-[10.5px] font-extrabold text-slate-600 uppercase flex items-center justify-between">
                    <span>Admin Master Password</span>
                    <span className="text-[9.5px] text-indigo-600 font-black">Mandatory</span>
                  </label>
                  <div className="relative mt-1">
                    <input
                      type={showAdminPassword ? 'text' : 'password'}
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      className="w-full p-2.5 pr-10 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:border-indigo-600 focus:outline-none"
                      placeholder="admin / ronpay2026 / ronpay@admin2026"
                      autoFocus={!isProfileAdmin}
                    />
                    <button
                      type="button"
                      onClick={() => setShowAdminPassword(!showAdminPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer p-1"
                      title={showAdminPassword ? 'Hide password' : 'Show password'}
                    >
                      {showAdminPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="bg-indigo-50/80 border border-indigo-100 p-2.5 rounded-xl text-[10.5px] text-indigo-900 leading-tight flex items-start gap-2">
                  <KeyRound className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">🔑 Master Passwords:</span> <b>admin</b>, <b>ronpay2026</b>, or <b>ronpay@admin2026</b> (Username: <b>admin</b>).
                  </div>
                </div>

                {loginError && (
                  <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-600 text-center flex items-center justify-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{loginError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs transition cursor-pointer shadow-md shadow-indigo-200 active:scale-98 flex items-center justify-center gap-2"
                >
                  <ShieldCheck className="w-4 h-4 text-amber-300" />
                  <span>Verify Admin Password & Unlock</span>
                </button>
              </form>

              {/* Quick Biometric Admin Unlock */}
              <button
                type="button"
                onClick={handleAdminBiometricLogin}
                disabled={isBiometricScanning}
                className="w-full py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition flex items-center justify-center gap-2 cursor-pointer active:scale-98"
              >
                <Fingerprint className={`w-4 h-4 text-indigo-600 ${isBiometricScanning ? 'animate-pulse text-amber-500' : ''}`} />
                <span>{isBiometricScanning ? 'Scanning Admin Biometrics...' : 'Admin Biometric Login (Enrolled Device)'}</span>
              </button>
            </div>
          </div>
        ) : (
          /* Authenticated Admin Workspace */
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* 6-Tier RBAC Role Desk Bar */}
            <div className="bg-slate-900 text-white px-3 sm:px-4 py-2 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-slate-800 border border-slate-700">
                  <span className="text-[10px] text-slate-400 font-bold">Active Clearance:</span>
                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                    currentRole === 'SUPER_ADMIN' ? 'bg-purple-600 text-white shadow-xs' :
                    currentRole === 'ADMIN' ? 'bg-blue-600 text-white shadow-xs' :
                    'bg-emerald-600 text-white shadow-xs'
                  }`}>
                    {currentRole.replace('_', ' ')}
                  </span>
                  <span className="text-[9px] text-amber-300 font-mono font-black">
                    Tier {ROLE_RANKS[currentRole] || 6}
                  </span>
                </div>
                <span className="text-[10px] text-slate-300 hidden md:inline truncate max-w-[280px]">
                  {ROLE_DEFINITIONS[currentRole]?.description || 'System Operator'}
                </span>
              </div>

              {/* 1-Click Role Switcher */}
              <div className="flex items-center gap-1">
                <span className="text-[9.5px] text-slate-400 font-bold uppercase mr-1 hidden sm:inline">Role View:</span>
                {(['SUPER_ADMIN', 'ADMIN', 'MODERATOR'] as UserRole[]).map((r) => {
                  const isCurrent = currentRole === r;
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => {
                        setCurrentRole(r);
                        if (r === 'MODERATOR' && ['staff', 'finances', 'announcement', 'audit', 'rates', 'backup', 'gateway'].includes(activeTab)) {
                          setActiveTab('creators');
                        } else if (r === 'ADMIN' && ['staff', 'rates', 'backup', 'gateway'].includes(activeTab)) {
                          setActiveTab('campaigns');
                        }
                      }}
                      className={`px-2 sm:px-2.5 py-1 rounded-lg text-[9.5px] font-black transition cursor-pointer flex items-center gap-1 ${
                        isCurrent
                          ? 'bg-amber-400 text-slate-950 shadow-xs ring-1 ring-amber-300'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700'
                      }`}
                    >
                      {r === 'SUPER_ADMIN' && <Crown className="w-3 h-3" />}
                      {r === 'ADMIN' && <ShieldCheck className="w-3 h-3" />}
                      {r === 'MODERATOR' && <Users className="w-3 h-3" />}
                      <span>{r === 'SUPER_ADMIN' ? 'Super Admin' : r === 'ADMIN' ? 'Admin' : 'Moderator'}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Tab Navigation Bar */}
            <div className="bg-slate-100/80 border-b border-slate-200/90 px-3 pt-2 flex gap-1.5 overflow-x-auto no-scrollbar shrink-0">
              {[
                { 
                  id: 'staff' as const, 
                  label: 'Staff & Roles', 
                  icon: Crown,
                  badge: staffList.length > 0 ? staffList.length : undefined,
                  badgeColor: 'bg-purple-600 text-white',
                  minRole: 'SUPER_ADMIN' as UserRole
                },
                { 
                  id: 'creators' as const, 
                  label: 'Creator KYC & Approval', 
                  icon: Users,
                  badge: pendingCreators.length > 0 ? pendingCreators.length : undefined,
                  badgeColor: pendingCreators.length > 0 ? 'bg-rose-600 text-white animate-pulse' : 'bg-indigo-600 text-white',
                  minRole: 'MODERATOR' as UserRole
                },
                { 
                  id: 'campaigns' as const, 
                  label: 'Campaigns & Moderation', 
                  icon: Layers,
                  badge: pendingCampaigns.length > 0 ? pendingCampaigns.length : undefined,
                  badgeColor: 'bg-amber-500 text-white',
                  minRole: 'MODERATOR' as UserRole
                },
                { 
                  id: 'finances' as const, 
                  label: 'Finances & Reports', 
                  icon: DollarSign,
                  minRole: 'ADMIN' as UserRole
                },
                { 
                  id: 'announcement' as const, 
                  label: 'Announcement Banner', 
                  icon: Megaphone,
                  badge: localAnnouncement.isActive ? 'Active' : undefined,
                  badgeColor: 'bg-emerald-600 text-white',
                  minRole: 'ADMIN' as UserRole
                },
                { 
                  id: 'audit' as const, 
                  label: 'Audit & Activity Log', 
                  icon: History,
                  minRole: 'ADMIN' as UserRole
                },
                { 
                  id: 'rates' as const, 
                  label: 'Platform Rates & Fees', 
                  icon: Percent,
                  minRole: 'SUPER_ADMIN' as UserRole
                },
                { 
                  id: 'backup' as const, 
                  label: 'Backup & Restore', 
                  icon: Database,
                  minRole: 'SUPER_ADMIN' as UserRole
                },
                { 
                  id: 'gateway' as const, 
                  label: 'PhonePe PG V2', 
                  icon: Smartphone,
                  minRole: 'SUPER_ADMIN' as UserRole
                },
              ]
              .filter(tab => hasMinimumRole(currentRole, tab.minRole))
              .map(tab => {
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
              
              {/* Top Alert Banner for Pending Creator Approvals */}
              {pendingCreators.length > 0 && activeTab !== 'creators' && (
                <div className="bg-gradient-to-r from-indigo-900 via-purple-900 to-indigo-950 text-white p-3.5 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shadow-md border border-indigo-700/80 animate-fadeIn">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-amber-400 text-slate-900 flex items-center justify-center font-black shrink-0 shadow-xs animate-pulse">
                      <Users className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-black text-white flex items-center gap-2 flex-wrap">
                        <span>🚨 Creator Application Thar ({pendingCreators.length}) Approve Nghak An Awm!</span>
                        <span className="text-[9px] bg-amber-400 text-slate-900 font-extrabold px-1.5 py-0.5 rounded-md uppercase">Action Required</span>
                      </h4>
                      <p className="text-[11px] text-indigo-200 mt-0.5 truncate">
                        Applicant: {pendingCreators.map(c => `${c.name || 'Applicant'} (${c.phone})`).slice(0, 2).join(', ')}{pendingCreators.length > 2 ? ` + ${pendingCreators.length - 2} more` : ''}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setActiveTab('creators');
                      setCreatorFilter('pending');
                    }}
                    className="bg-amber-400 hover:bg-amber-300 text-slate-900 font-black px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 transition cursor-pointer shadow-xs shrink-0 active:scale-98"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-800" />
                    <span>En & Approve Rawh ({pendingCreators.length})</span>
                  </button>
                </div>
              )}
              
              {/* ========================================================= */}
              {/* TAB 1: CAMPAIGN MODERATION & QR ACTIVATION (Request 7)   */}
              {/* ========================================================= */}
              {activeTab === 'campaigns' && (
                <div className="space-y-4">
                  {/* Toast Notification for Campaign Delete / Actions */}
                  {campaignActionToast && (
                    <div className="p-3 bg-emerald-600 text-white font-bold text-xs rounded-2xl shadow-md flex items-center justify-between animate-fadeIn">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-200 shrink-0" />
                        <span>{campaignActionToast}</span>
                      </div>
                      <button onClick={() => setCampaignActionToast(null)} className="text-white/80 hover:text-white cursor-pointer ml-2">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  {/* Top Filter and Search Bar */}
                  <div className="flex flex-col sm:flex-row gap-2 justify-between items-stretch sm:items-center">
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                      {[
                        { key: 'all', label: `All (${campaigns.length})` },
                        { key: 'pending', label: `Pending Review (${pendingCampaigns.length})` },
                        { key: 'active', label: `Active QRs (${activeCampaigns.length})` },
                        { key: 'expired', label: `Expired QRs (${expiredCampaigns.length})` },
                        { key: 'rejected', label: `Rejected (${rejectedCampaigns.length})` },
                      ].map(f => (
                        <button
                          key={f.key}
                          onClick={() => setCampaignFilter(f.key as any)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer whitespace-nowrap ${
                            campaignFilter === f.key
                              ? 'bg-slate-900 text-white shadow-xs'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="relative min-w-[180px] flex-1 sm:flex-initial">
                        <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Search campaign, creator, ID..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:border-indigo-500 focus:outline-none"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsSectionPresetModalOpen(true)}
                        className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-xl border border-indigo-200 text-xs flex items-center gap-1.5 transition cursor-pointer shrink-0 shadow-2xs"
                        title="Bial / Section Dropdown Quick Presets Setup & Management"
                      >
                        <Sliders className="w-3.5 h-3.5 text-indigo-600" />
                        <span className="hidden xs:inline">⚙️ Bial/Section Presets</span>
                        <span className="xs:hidden">Presets</span>
                      </button>
                    </div>
                  </div>

                  {/* Moderation Cards Queue */}
                  {filteredCampaigns.length === 0 ? (
                    <div className="text-center py-12 bg-slate-50 rounded-2xl border border-slate-200 text-slate-400 space-y-1">
                      <Layers className="w-10 h-10 mx-auto text-slate-300" />
                      <p className="font-bold text-sm text-slate-600">No campaigns found in this filter.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3.5">
                      {filteredCampaigns.map(camp => {
                        const isPending = camp.status === 'pending_approval';
                        const isExpired = camp.status === 'expired' || (!isPending && camp.status !== 'rejected' && isCampaignExpired(camp.validityDate, camp.status));
                        const isActive = camp.status === 'active' && !isExpired;
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
                                : isExpired
                                ? 'bg-rose-50/50 border-rose-200'
                                : isRejected
                                ? 'bg-rose-50/60 border-rose-200 opacity-90'
                                : 'bg-white border-slate-200 hover:border-indigo-300'
                            }`}
                          >
                            <div className="flex justify-between items-start gap-2">
                              <div>
                                <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                                  <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-900 border border-indigo-200">
                                    {catInfo?.name || camp.category}
                                  </span>
                                  {isPending && (
                                    <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-md bg-amber-500 text-white animate-pulse">
                                      ⚠️ PENDING REVIEW
                                    </span>
                                  )}
                                  {isExpired && (
                                    <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1">
                                      <Clock className="w-2.5 h-2.5 text-rose-600" /> EXPIRED QR
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
                              <p className="flex justify-between items-center">
                                <span><span className="text-slate-400 font-bold">UPI ID:</span> <span className="font-mono font-bold text-slate-700">{camp.upiId}</span></span>
                                {camp.validityDate && (
                                  <span className="text-[10.5px] text-slate-500">
                                    Validity: <strong className={isExpired ? 'text-rose-600' : 'text-slate-700'}>{formatDateDDMMYYYY(camp.validityDate)}</strong>
                                  </span>
                                )}
                              </p>
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

                              {isPending && (
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
                              )}

                              {isExpired && (
                                <button
                                  onClick={() => {
                                    const now = new Date();
                                    now.setDate(now.getDate() + 30);
                                    const updated: Campaign = {
                                      ...camp,
                                      status: 'active',
                                      isApproved: true,
                                      validityDate: now.toISOString(),
                                      approvalRemarks: 'Reactivated and approved by Admin (+30 Days)',
                                      updatedAt: new Date().toISOString()
                                    };
                                    if (onUpdateCampaign) onUpdateCampaign(updated);
                                    recordAuditLog('Campaign Reactivated', `Admin reactivated expired campaign '${camp.title}' (${camp.id}) with +30 days validity.`, 'campaign', camp.id);
                                    setLogsList(getStoredAuditLogs());
                                    alert(`⚡ "${camp.title}" chu Admin-in a reactivate a, +30 days validity pek a ni e!`);
                                  }}
                                  className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black py-1.5 rounded-xl text-xs transition flex items-center justify-center gap-1 cursor-pointer shadow-xs"
                                >
                                  <Zap className="w-3.5 h-3.5 text-amber-300" /> Reactivate (+30 Days)
                                </button>
                              )}

                              {isActive && (
                                <button
                                  onClick={() => {
                                    const updated: Campaign = {
                                      ...camp,
                                      status: 'expired',
                                      approvalRemarks: 'Marked as expired by Admin',
                                      updatedAt: new Date().toISOString()
                                    };
                                    if (onUpdateCampaign) onUpdateCampaign(updated);
                                    recordAuditLog('Campaign Expired', `Admin marked campaign '${camp.title}' as expired.`, 'campaign', camp.id);
                                    setLogsList(getStoredAuditLogs());
                                    alert(`⏸️ "${camp.title}" chu Expired a dah a ni e.`);
                                  }}
                                  className="px-2.5 bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold py-1.5 rounded-xl text-xs transition border border-amber-200 cursor-pointer"
                                  title="Mark as Expired (Close collections)"
                                >
                                  Mark Expired
                                </button>
                              )}

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
                                    const cleanId = String(camp.id).toLowerCase().trim();
                                    const campTxns = (transactions || []).filter(t => 
                                      String(t.campaignId).toLowerCase().trim() === cleanId ||
                                      (camp.title && String(t.campaignTitle).toLowerCase().trim() === String(camp.title).toLowerCase().trim())
                                    );
                                    const totalCollected = campTxns
                                      .filter(t => isConfirmedTransaction(t))
                                      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

                                    setDeleteConfirmCamp({
                                      camp,
                                      reason: 'Admin action / Delete bawm',
                                      force: totalCollected === 0,
                                      collected: totalCollected,
                                      hasTxns: campTxns.length > 0
                                    });
                                  }}
                                  className="px-3 bg-slate-100 hover:bg-rose-100 text-slate-600 hover:text-rose-700 font-bold py-1.5 rounded-xl text-xs transition cursor-pointer ml-auto flex items-center gap-1.5"
                                  title="Delete Campaign / Bawm Tihboral"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>Delete</span>
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

                  {/* Pending Category Upgrade / Removal Requests Alert Banner */}
                  {pendingUpgrades.length > 0 && creatorFilter !== 'upgrades' && (
                    <div className="p-3 bg-gradient-to-r from-amber-500/15 via-indigo-500/15 to-purple-500/15 border-2 border-amber-400/80 rounded-2xl text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-xs animate-fadeIn">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-amber-400 text-slate-950 font-black flex items-center justify-center shrink-0 shadow-xs">
                          <Sparkles className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="font-black text-slate-900">
                            Category Dilna {pendingUpgrades.length} a awm mek e!
                          </p>
                          <p className="text-[10.5px] text-slate-600">
                            Creator-te atangin Category Dah belh (Add) leh Paih (Remove) dilna enfiah tur a awm.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setCreatorViewMode('list');
                          setCreatorFilter('upgrades');
                        }}
                        className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-black px-3.5 py-1.5 rounded-xl text-xs transition cursor-pointer shrink-0 shadow-xs active:scale-95"
                      >
                        Enfiah Rawh ({pendingUpgrades.length})
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
                        { key: 'all', label: `All (${activeCreatorsList.length})` },
                        { key: 'pending', label: `New Applicants (${pendingCreators.length})` },
                        { key: 'upgrades', label: `Category Requests (${pendingUpgrades.length})` },
                        { key: 'approved', label: `Active (${activeCreatorsList.filter(c => c.isApproved && !c.isBlocked).length})` },
                        { key: 'blocked', label: `Blocked (${activeCreatorsList.filter(c => c.isBlocked).length})` },
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
                      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3.5">
                        {filteredCreators.map(creator => {
                          const isPending = !creator.isApproved;
                          const isBlocked = !!creator.isBlocked;

                          return (
                            <div
                              key={creator.phone || creator.name}
                              className={`p-4 rounded-2xl border transition space-y-3 shadow-2xs ${
                                isBlocked
                                  ? 'bg-rose-50/80 border-rose-300'
                                  : isPending
                                  ? 'bg-indigo-50/70 border-2 border-indigo-300'
                                  : 'bg-white border-slate-200 hover:border-slate-300'
                              }`}
                            >
                              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                                <div className="flex items-center gap-3 min-w-0">
                                  {/* Avatar or Logo Thumbnail */}
                                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center font-black text-sm shrink-0 overflow-hidden shadow-xs border border-indigo-200">
                                    {creator.avatarUrl ? (
                                      <img src={creator.avatarUrl} alt={creator.name} className="w-full h-full object-cover" />
                                    ) : creator.logoUrl ? (
                                      <img src={creator.logoUrl} alt={creator.orgName} className="w-full h-full object-cover" />
                                    ) : (
                                      <span>{(creator.name || 'CR').slice(0, 2).toUpperCase()}</span>
                                    )}
                                  </div>

                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <h4 className="text-sm font-black text-slate-900 truncate">{creator.name || 'Unnamed Applicant'}</h4>
                                      {isPending && !creator.rejectionReason && (
                                        <span className="text-[9px] font-black uppercase bg-amber-500 text-white px-2 py-0.5 rounded-full animate-pulse">
                                          Approve Pending
                                        </span>
                                      )}
                                      {isPending && creator.rejectionReason && (
                                        <span className="text-[9px] font-black uppercase bg-rose-600 text-white px-2 py-0.5 rounded-full flex items-center gap-1">
                                          <XCircle className="w-2.5 h-2.5" /> Declined / Rejected
                                        </span>
                                      )}
                                      {isBlocked && (
                                        <span className="text-[9px] font-black uppercase bg-rose-700 text-white px-2 py-0.5 rounded-full flex items-center gap-1">
                                          <Ban className="w-2.5 h-2.5" /> BLOCKED
                                        </span>
                                      )}
                                      {!isPending && !isBlocked && (
                                        <span className="text-[9px] font-black uppercase bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-300">
                                          Active Creator
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-xs text-slate-500 font-medium truncate mt-0.5">
                                      {creator.designation || 'Member'} • <strong className="text-slate-700">{creator.orgName || 'Community Member'}</strong> • Mobile: <span className="font-mono font-bold text-slate-800">{creator.phone}</span>
                                    </p>
                                    {creator.upiId && (
                                      <p className="text-[11px] text-indigo-700 font-mono font-semibold">
                                        UPI: {creator.upiId} {creator.address ? `• ${creator.address}` : ''}
                                      </p>
                                    )}
                                  </div>
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

                              {/* Rejection / Decline Banner if exists */}
                              {creator.rejectionReason && (
                                <div className="bg-rose-50 border border-rose-200 p-2.5 rounded-xl text-xs text-rose-900 flex items-start gap-2">
                                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                                  <div className="min-w-0">
                                    <span className="font-bold text-rose-950">Decline Reason: </span>
                                    <span>{creator.rejectionReason}</span>
                                  </div>
                                </div>
                              )}

                              {/* Document proof & metadata */}
                              {creator.authDocName && (
                                <div className="bg-slate-50 p-2 rounded-xl border border-slate-200 text-xs flex items-center gap-2 text-slate-600">
                                  <FileText className="w-3.5 h-3.5 text-indigo-600" />
                                  <span>Auth Document: <strong className="text-slate-800">{creator.authDocName}</strong></span>
                                  {creator.authDocUrl && (
                                    <span className="text-[10px] bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded font-bold">Attached URL</span>
                                  )}
                                </div>
                              )}

                              {/* Pending Category Upgrade / Removal Notice & Actions */}
                              {creator.pendingUpgrade && (() => {
                                const req = creator.pendingUpgrade as any;
                                const isRemove = req.type === 'remove';
                                const catName = BAWM_CONFIG[req.category as BawmCategory]?.name || req.category;

                                return (
                                  <div className={`p-3 rounded-2xl space-y-2 border-2 ${
                                    isRemove
                                      ? 'bg-rose-50/90 border-rose-300 text-rose-950'
                                      : 'bg-amber-50/90 border-amber-300 text-amber-950'
                                  }`}>
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
                                      <div className="flex items-center gap-1.5 font-black">
                                        <Sparkles className={`w-4 h-4 ${isRemove ? 'text-rose-600' : 'text-amber-600'} animate-pulse`} />
                                        <span>
                                          {isRemove ? 'Category Paih Dilna:' : 'Category Dah Belh Dilna:'}{' '}
                                          <b className={`px-2 py-0.5 rounded-md ${
                                            isRemove ? 'text-rose-900 bg-rose-200' : 'text-indigo-900 bg-indigo-100'
                                          }`}>
                                            {catName}
                                          </b>
                                        </span>
                                      </div>
                                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                                        isRemove ? 'bg-rose-200 text-rose-900' : 'bg-amber-200 text-amber-900'
                                      }`}>
                                        {isRemove ? '➖ REMOVAL REQUEST' : '➕ ADD UPGRADE'}
                                      </span>
                                    </div>

                                    {/* Details (Reason, Doc) */}
                                    <div className="bg-white/80 p-2 rounded-xl border border-slate-200 text-[11px] space-y-1">
                                      {req.reason && (
                                        <p className="text-slate-700">
                                          <strong className="text-slate-900">Reason / Chhan:</strong> <i>"{req.reason}"</i>
                                        </p>
                                      )}
                                      {req.authDocName && (
                                        <p className="text-slate-700 flex items-center gap-1">
                                          <FileText className="w-3 h-3 text-indigo-600" />
                                          <span>Document: <strong className="text-slate-900">{req.authDocName}</strong></span>
                                        </p>
                                      )}
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex items-center gap-2 pt-1 border-t border-slate-200">
                                      <button
                                        type="button"
                                        onClick={() => handleApproveUpgrade(creator)}
                                        className={`text-white font-black px-3.5 py-1.5 rounded-xl text-xs flex items-center gap-1 transition cursor-pointer shadow-xs active:scale-98 ${
                                          isRemove
                                            ? 'bg-rose-600 hover:bg-rose-700'
                                            : 'bg-emerald-600 hover:bg-emerald-700'
                                        }`}
                                      >
                                        <Check className="w-3.5 h-3.5" />
                                        <span>{isRemove ? 'Approve Removal' : 'Approve Upgrade'}</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleRejectUpgrade(creator)}
                                        className="bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold px-3 py-1.5 rounded-xl text-xs transition cursor-pointer"
                                      >
                                        Decline
                                      </button>
                                    </div>
                                  </div>
                                );
                              })()}

                              {/* Action Buttons */}
                              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
                                {isPending ? (
                                  <>
                                    <button
                                      onClick={() => handleOpenCreatorEditor(creator)}
                                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-black px-3.5 py-2 rounded-xl text-xs transition flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-98"
                                      title="Enfiahna & Siamthatna: View & Edit Photos, Org Details, Trial Duration, and Categories"
                                    >
                                      <Eye className="w-3.5 h-3.5" /> 🔍 Enfiah & Review (Details & Photos)
                                    </button>
                                    <button
                                      onClick={() => handleQuickApproveCreator(creator)}
                                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-3 py-2 rounded-xl text-xs transition flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-98"
                                      title="1-Click Quick Approve: 180 Days Fair Trial & Categories Activated"
                                    >
                                      <Check className="w-3.5 h-3.5" /> ⚡ Quick Approve
                                    </button>
                                    <button
                                      onClick={() => handleOpenDeclineModal(creator)}
                                      className="bg-rose-50 hover:bg-rose-100 text-rose-700 font-black px-3 py-2 rounded-xl text-xs transition border border-rose-200 flex items-center gap-1 cursor-pointer"
                                      title="Decline applicant with specific reason"
                                    >
                                      <X className="w-3.5 h-3.5" /> Decline
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      onClick={() => handleOpenCreatorEditor(creator)}
                                      className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold px-3.5 py-2 rounded-xl text-xs transition border border-indigo-200 flex items-center gap-1.5 cursor-pointer"
                                      title="Edit Profile, Photos, Categories, Quotas, and Fees"
                                    >
                                      <Edit3 className="w-3.5 h-3.5 text-indigo-600" /> Edit Profile & Photos
                                    </button>

                                    {/* Reset Password / PIN Button */}
                                    <button
                                      onClick={() => {
                                        setResettingPasswordCreator(creator);
                                        setNewCreatorPassword(creator.pin || creator.password || '123456');
                                      }}
                                      className="bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold px-3 py-2 rounded-xl text-xs transition border border-slate-200 flex items-center gap-1 cursor-pointer"
                                      title="Reset Password or Security PIN"
                                    >
                                      <KeyRound className="w-3.5 h-3.5" /> Reset PIN
                                    </button>

                                    {/* Block / Unblock Button (Request 6) */}
                                    <button
                                      onClick={() => handleToggleBlockCreator(creator)}
                                      className={`font-black px-3 py-2 rounded-xl text-xs transition flex items-center gap-1.5 cursor-pointer ${
                                        isBlocked
                                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                          : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200'
                                      }`}
                                    >
                                      {isBlocked ? <Unlock className="w-3.5 h-3.5" /> : <Ban className="w-3.5 h-3.5" />}
                                      {isBlocked ? 'Unblock Creator' : 'Block'}
                                    </button>

                                    <button
                                      onClick={() => handleOpenDeclineModal(creator)}
                                      className="bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold px-3 py-2 rounded-xl text-xs transition border border-rose-200 flex items-center gap-1 cursor-pointer ml-auto"
                                      title="Suspend / Decline Account"
                                    >
                                      <X className="w-3.5 h-3.5" /> Suspend
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
                        <div className="rounded-2xl overflow-hidden border border-slate-200">
                          <AnnouncementBannerCard
                            announcement={{
                              ...localAnnouncement,
                              items: currentItems
                            }}
                            isDismissible={false}
                          />
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

                      {/* GLOBAL HEIGHT & MEDIA FIT SETTINGS (SLIDE TINTE HEIGHT IN-AN TLLANG NAN) */}
                      <div className="pt-3 border-t border-slate-200 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <label className="text-[10.5px] font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                            <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-600" />
                            <span>1. Slide Tinte Height (Sang Zawng In-an tlangna)</span>
                          </label>
                          <span className="text-[9.5px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-mono">
                            {localAnnouncement.globalHeightPreset === 'custom'
                              ? `${localAnnouncement.globalCustomHeightPx || 240}px (Custom)`
                              : (ANNOUNCEMENT_HEIGHT_PRESETS[localAnnouncement.globalHeightPreset || 'auto']?.name || 'Auto')}
                          </span>
                        </div>

                        {/* Height Presets Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-6 gap-1.5">
                          {[
                            { key: 'auto', label: 'Auto (Mil zelin)', px: 'Auto' },
                            { key: 'compact', label: 'Compact (Tawi)', px: '180px' },
                            { key: 'medium', label: 'Standard (Ngaimawh)', px: '240px' },
                            { key: 'tall', label: 'Tall (Lian)', px: '320px' },
                            { key: 'extra_tall', label: 'Cinema (Lian Fal)', px: '400px' },
                            { key: 'custom', label: 'Custom Px...', px: 'Duh zat' }
                          ].map(hPreset => {
                            const isSelected = (localAnnouncement.globalHeightPreset || 'auto') === hPreset.key;
                            return (
                              <button
                                key={hPreset.key}
                                type="button"
                                onClick={() => setLocalAnnouncement(prev => ({
                                  ...prev,
                                  globalHeightPreset: hPreset.key as any,
                                  globalCustomHeightPx: prev.globalCustomHeightPx || 240
                                }))}
                                className={`p-2 rounded-xl text-center transition cursor-pointer border ${
                                  isSelected
                                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs font-black'
                                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100 font-bold'
                                }`}
                              >
                                <div className="text-[11px] leading-tight">{hPreset.label}</div>
                                <div className="text-[9px] opacity-75 font-mono mt-0.5">{hPreset.px}</div>
                              </button>
                            );
                          })}
                        </div>

                        {/* Custom Height Slider when Custom is selected */}
                        {localAnnouncement.globalHeightPreset === 'custom' && (
                          <div className="p-2.5 bg-white rounded-xl border border-indigo-200 flex items-center gap-3">
                            <label className="text-[10px] font-extrabold text-slate-600 uppercase shrink-0">Custom Height:</label>
                            <input
                              type="range"
                              min="140"
                              max="550"
                              step="10"
                              value={localAnnouncement.globalCustomHeightPx || 240}
                              onChange={(e) => setLocalAnnouncement(prev => ({ ...prev, globalCustomHeightPx: Number(e.target.value) }))}
                              className="flex-1 accent-indigo-600 cursor-pointer"
                            />
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                min="120"
                                max="600"
                                value={localAnnouncement.globalCustomHeightPx || 240}
                                onChange={(e) => setLocalAnnouncement(prev => ({ ...prev, globalCustomHeightPx: Number(e.target.value) }))}
                                className="w-16 p-1 text-center font-mono font-bold text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-800"
                              />
                              <span className="text-[10px] font-bold text-slate-500 font-mono">px</span>
                            </div>
                          </div>
                        )}

                        {/* Media Fit Setting */}
                        <div className="flex items-center justify-between pt-1">
                          <span className="text-[10px] font-bold text-slate-600">Canva / Image Fit (A lan dan):</span>
                          <div className="flex gap-1">
                            {[
                              { key: 'cover', label: 'Cover (Fill & Crop)' },
                              { key: 'contain', label: 'Contain (Full View)' },
                              { key: 'fill', label: 'Fill (Stretch)' }
                            ].map(fit => (
                              <button
                                key={fit.key}
                                type="button"
                                onClick={() => setLocalAnnouncement(prev => ({ ...prev, globalMediaFit: fit.key as any }))}
                                className={`px-2 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer border ${
                                  (localAnnouncement.globalMediaFit || 'cover') === fit.key
                                    ? 'bg-slate-900 text-white border-slate-900'
                                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                }`}
                              >
                                {fit.label}
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
                            Slide tinte text, background, leh media duh angin customize rawh le.
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
                      <div className="bg-slate-50 p-3.5 sm:p-4 rounded-2xl border border-slate-200 space-y-4">
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

                        {/* 2. BACKGROUND THLANNA & COLOR THEMES */}
                        <div className="p-3 bg-white rounded-2xl border border-slate-200 space-y-2.5">
                          <label className="text-[10.5px] font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                            <Palette className="w-3.5 h-3.5 text-indigo-600" />
                            <span>2. Background Thlanna & Color Theme</span>
                          </label>

                          {/* Theme Presets Grid */}
                          <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                            {Object.values(ANNOUNCEMENT_BG_THEMES).map(theme => {
                              const isSelected = (activeEditingItem.bgTheme || (
                                activeEditingItem.type === 'urgent' ? 'red_urgent' :
                                activeEditingItem.type === 'info' ? 'indigo_royal' :
                                activeEditingItem.type === 'notice' ? 'amber_gold' : 'emerald_forest'
                              )) === theme.id;
                              return (
                                <button
                                  key={theme.id}
                                  type="button"
                                  onClick={() => handleUpdateCurrentItem({ bgTheme: theme.id as any })}
                                  className={`p-2 rounded-xl text-left transition cursor-pointer border relative overflow-hidden ${
                                    isSelected
                                      ? 'border-indigo-600 shadow-xs ring-2 ring-indigo-300'
                                      : 'border-slate-200 hover:border-slate-300'
                                  }`}
                                >
                                  <div className="flex items-center gap-1.5 mb-1">
                                    <span 
                                      className="w-3.5 h-3.5 rounded-full shrink-0 shadow-2xs border border-white/40" 
                                      style={{ backgroundColor: theme.previewColor }}
                                    />
                                    <span className="text-[10px] font-bold text-slate-800 truncate">{theme.name.split('/')[0]}</span>
                                  </div>
                                  <div className="text-[9px] text-slate-500 truncate">{theme.nameMizo}</div>
                                </button>
                              );
                            })}

                            {/* Custom Gradient Option */}
                            <button
                              type="button"
                              onClick={() => handleUpdateCurrentItem({ bgTheme: 'custom' })}
                              className={`p-2 rounded-xl text-left transition cursor-pointer border relative overflow-hidden ${
                                activeEditingItem.bgTheme === 'custom'
                                  ? 'border-indigo-600 shadow-xs ring-2 ring-indigo-300 bg-indigo-50/50'
                                  : 'border-slate-200 hover:border-slate-300 bg-white'
                              }`}
                            >
                              <div className="flex items-center gap-1.5 mb-1">
                                <span className="w-3.5 h-3.5 rounded-full shrink-0 bg-gradient-to-tr from-pink-500 via-purple-500 to-cyan-400" />
                                <span className="text-[10px] font-bold text-slate-800">Custom...</span>
                              </div>
                              <div className="text-[9px] text-slate-500 truncate">Duh duha siam</div>
                            </button>
                          </div>

                          {/* Custom Color/Gradient Controls when 'custom' is active */}
                          {activeEditingItem.bgTheme === 'custom' && (
                            <div className="p-3 bg-slate-50 rounded-xl border border-indigo-200 space-y-2">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <div>
                                  <label className="text-[10px] font-bold text-slate-600 block mb-1">Gradient Start Color (From):</label>
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="color"
                                      value={activeEditingItem.customGradientFrom || '#4f46e5'}
                                      onChange={(e) => handleUpdateCurrentItem({ customGradientFrom: e.target.value })}
                                      className="w-8 h-8 rounded-lg border border-slate-300 cursor-pointer"
                                    />
                                    <input
                                      type="text"
                                      value={activeEditingItem.customGradientFrom || '#4f46e5'}
                                      onChange={(e) => handleUpdateCurrentItem({ customGradientFrom: e.target.value })}
                                      className="flex-1 p-1.5 text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg text-slate-800"
                                      placeholder="#4f46e5"
                                    />
                                  </div>
                                </div>

                                <div>
                                  <label className="text-[10px] font-bold text-slate-600 block mb-1">Gradient End Color (To):</label>
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="color"
                                      value={activeEditingItem.customGradientTo || '#7c3aed'}
                                      onChange={(e) => handleUpdateCurrentItem({ customGradientTo: e.target.value })}
                                      className="w-8 h-8 rounded-lg border border-slate-300 cursor-pointer"
                                    />
                                    <input
                                      type="text"
                                      value={activeEditingItem.customGradientTo || '#7c3aed'}
                                      onChange={(e) => handleUpdateCurrentItem({ customGradientTo: e.target.value })}
                                      className="flex-1 p-1.5 text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg text-slate-800"
                                      placeholder="#7c3aed"
                                    />
                                  </div>
                                </div>
                              </div>

                              {/* Quick Color Presets for Custom */}
                              <div className="flex items-center gap-1.5 flex-wrap pt-1">
                                <span className="text-[9px] font-bold text-slate-500">Quick Palette:</span>
                                {[
                                  { from: '#1e1b4b', to: '#4338ca', label: 'Dark Violet' },
                                  { from: '#064e3b', to: '#0d9488', label: 'Teal Forest' },
                                  { from: '#701a75', to: '#be185d', label: 'Magenta Pink' },
                                  { from: '#7c2d12', to: '#ea580c', label: 'Fiery Sunset' },
                                  { from: '#0284c7', to: '#6366f1', label: 'Sky Cyan' }
                                ].map(p => (
                                  <button
                                    key={p.label}
                                    type="button"
                                    onClick={() => handleUpdateCurrentItem({
                                      customGradientFrom: p.from,
                                      customGradientTo: p.to
                                    })}
                                    className="px-2 py-0.5 rounded-md text-[9.5px] font-bold bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                                  >
                                    {p.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* 3. TEXT CHHUT LUHNA & TYPOGRAPHY STYLING */}
                        <div className="p-3 bg-white rounded-2xl border border-slate-200 space-y-3">
                          <label className="text-[10.5px] font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                            <Type className="w-3.5 h-3.5 text-indigo-600" />
                            <span>3. Text Chhut Luhna & Formatting</span>
                          </label>

                          {/* Badge Tag & Title */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <div>
                              <label className="text-[10px] font-extrabold text-slate-600 uppercase">Badge / Tag Label</label>
                              <input
                                type="text"
                                value={activeEditingItem.badge || ''}
                                onChange={(e) => handleUpdateCurrentItem({ badge: e.target.value })}
                                placeholder="e.g. URGENT, BBPS LIVE, KOHHRAN"
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

                          {/* Announcement Message & Character Count */}
                          <div>
                            <div className="flex items-center justify-between">
                              <label className="text-[10px] font-extrabold text-slate-600 uppercase">Announcement Details (Message) *</label>
                              <span className="text-[9.5px] font-mono text-slate-400">
                                {activeEditingItem.message.length} chars
                              </span>
                            </div>
                            <textarea
                              value={activeEditingItem.message}
                              onChange={(e) => handleUpdateCurrentItem({ message: e.target.value })}
                              rows={2}
                              className="w-full mt-1 p-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:border-indigo-600 focus:outline-none"
                              placeholder="Type announcement message here..."
                              required
                            />
                          </div>

                          {/* Typography Formatting: Color, Alignment, Size */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-slate-100">
                            {/* Text Alignment */}
                            <div>
                              <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Text Alignment:</label>
                              <div className="flex items-center gap-1">
                                {[
                                  { key: 'left', icon: <AlignLeft className="w-3.5 h-3.5" />, label: 'Left' },
                                  { key: 'center', icon: <AlignCenter className="w-3.5 h-3.5" />, label: 'Center' },
                                  { key: 'right', icon: <AlignRight className="w-3.5 h-3.5" />, label: 'Right' }
                                ].map(align => (
                                  <button
                                    key={align.key}
                                    type="button"
                                    onClick={() => handleUpdateCurrentItem({ textAlignment: align.key as any })}
                                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition cursor-pointer border ${
                                      (activeEditingItem.textAlignment || 'left') === align.key
                                        ? 'bg-slate-900 text-white border-slate-900'
                                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                                    }`}
                                  >
                                    {align.icon}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Font Size Preset */}
                            <div>
                              <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Font Scale:</label>
                              <div className="flex items-center gap-1">
                                {[
                                  { key: 'small', label: 'Small' },
                                  { key: 'normal', label: 'Normal' },
                                  { key: 'large', label: 'Large' }
                                ].map(size => (
                                  <button
                                    key={size.key}
                                    type="button"
                                    onClick={() => handleUpdateCurrentItem({ fontSizePreset: size.key as any })}
                                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer border ${
                                      (activeEditingItem.fontSizePreset || 'normal') === size.key
                                        ? 'bg-slate-900 text-white border-slate-900'
                                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                                    }`}
                                  >
                                    {size.label}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Title & Body Text Custom Colors */}
                            <div>
                              <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">Custom Text Colors:</label>
                              <div className="flex items-center gap-2">
                                <div className="flex items-center gap-1" title="Title Color">
                                  <span className="text-[9px] font-bold text-slate-500">Title:</span>
                                  <input
                                    type="color"
                                    value={activeEditingItem.titleColor || '#ffffff'}
                                    onChange={(e) => handleUpdateCurrentItem({ titleColor: e.target.value })}
                                    className="w-6 h-6 rounded cursor-pointer border border-slate-300"
                                  />
                                </div>
                                <div className="flex items-center gap-1" title="Body Text Color">
                                  <span className="text-[9px] font-bold text-slate-500">Body:</span>
                                  <input
                                    type="color"
                                    value={activeEditingItem.textColor || '#ffffff'}
                                    onChange={(e) => handleUpdateCurrentItem({ textColor: e.target.value })}
                                    className="w-6 h-6 rounded cursor-pointer border border-slate-300"
                                  />
                                </div>
                                {(activeEditingItem.titleColor || activeEditingItem.textColor) && (
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateCurrentItem({ titleColor: undefined, textColor: undefined })}
                                    className="text-[9px] text-rose-600 underline font-bold"
                                  >
                                    Reset
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* CANVA / BANNER / ANIMATION MEDIA SECTION */}
                        <div className="p-3 bg-indigo-50/60 rounded-2xl border border-indigo-100 space-y-2.5">
                          <div className="flex items-center justify-between">
                            <label className="text-[10.5px] font-black text-indigo-950 uppercase tracking-wider flex items-center gap-1.5">
                              <ImageIcon className="w-3.5 h-3.5 text-indigo-600" />
                              <span>4. Banner Media, Canva Design & Animation</span>
                            </label>
                            {activeEditingItem.bannerMediaUrl && (
                              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 uppercase font-mono">
                                {parseMediaUrl(activeEditingItem.bannerMediaUrl).type.toUpperCase()}
                              </span>
                            )}
                          </div>

                          <div className="space-y-1.5">
                            <div className="flex gap-2 items-center">
                              <input
                                type="url"
                                value={activeEditingItem.bannerMediaUrl || ''}
                                onChange={(e) => {
                                  const url = e.target.value;
                                  const parsed = parseMediaUrl(url);
                                  handleUpdateCurrentItem({ 
                                    bannerMediaUrl: url,
                                    mediaType: parsed.type === 'unknown' ? undefined : (parsed.type as any)
                                  });
                                }}
                                placeholder="Paste Canva link (e.g. canva.com/design/...), Image URL, or GIF..."
                                className="flex-1 p-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:border-indigo-600 focus:outline-none placeholder:text-slate-400"
                              />

                              {/* Upload Image Button */}
                              <label className="cursor-pointer shrink-0 px-2.5 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center gap-1 shadow-xs transition active:scale-95" title="Upload poster/photo from device">
                                <Upload className="w-3.5 h-3.5 text-indigo-600" />
                                <span className="hidden sm:inline">Upload</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      try {
                                        const compressedBase64 = await compressImageFile(file, 900, 600, 0.82);
                                        handleUpdateCurrentItem({
                                          bannerMediaUrl: compressedBase64,
                                          mediaType: 'image',
                                          mediaLayout: activeEditingItem.mediaLayout || 'hero_top'
                                        });
                                      } catch (err) {
                                        console.error('Image compression failed', err);
                                      }
                                    }
                                  }}
                                />
                              </label>

                              {activeEditingItem.bannerMediaUrl && (
                                <button
                                  type="button"
                                  onClick={() => handleUpdateCurrentItem({ bannerMediaUrl: '', mediaType: undefined })}
                                  className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-xl text-xs font-bold transition cursor-pointer"
                                  title="Clear Banner Media"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>

                            {/* Canva detection badge */}
                            {activeEditingItem.bannerMediaUrl && parseMediaUrl(activeEditingItem.bannerMediaUrl).type === 'canva' && (
                              <div className="flex items-center gap-1.5 text-[10.5px] text-indigo-800 bg-white p-2 rounded-xl border border-indigo-200 shadow-2xs font-semibold">
                                <Sparkles className="w-3.5 h-3.5 text-indigo-600 shrink-0 animate-pulse" />
                                <span className="flex-1">
                                  ✨ <strong>Canva Design Embed Active:</strong> Live interactive Canva animation / presentation banner will be displayed directly inside the announcement!
                                </span>
                              </div>
                            )}

                            {/* Quick Presets for Canva and Popular Banners */}
                            <div className="pt-1 flex flex-wrap items-center gap-1.5">
                              <span className="text-[9.5px] font-bold text-slate-500 mr-1">Presets:</span>
                              <button
                                type="button"
                                onClick={() => {
                                  handleUpdateCurrentItem({
                                    bannerMediaUrl: 'https://www.canva.com/design/DAHTTgdvhsU/77qJSQZdradri_piWLrIzw/view?embed',
                                    mediaType: 'canva',
                                    mediaLayout: 'hero_top'
                                  });
                                }}
                                className="px-2 py-0.5 bg-white hover:bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold text-[10px] rounded-lg transition cursor-pointer flex items-center gap-1"
                              >
                                🎨 Canva Design
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  handleUpdateCurrentItem({
                                    bannerMediaUrl: 'https://images.unsplash.com/photo-1544427920-c49ccfb85579?q=80&w=800&auto=format&fit=crop',
                                    mediaType: 'image',
                                    mediaLayout: 'hero_top'
                                  });
                                }}
                                className="px-2 py-0.5 bg-white hover:bg-emerald-50 border border-slate-200 text-slate-700 font-bold text-[10px] rounded-lg transition cursor-pointer"
                              >
                                ⛪ Church / Event
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  handleUpdateCurrentItem({
                                    bannerMediaUrl: 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?q=80&w=800&auto=format&fit=crop',
                                    mediaType: 'image',
                                    mediaLayout: 'hero_top'
                                  });
                                }}
                                className="px-2 py-0.5 bg-white hover:bg-amber-50 border border-slate-200 text-slate-700 font-bold text-[10px] rounded-lg transition cursor-pointer"
                              >
                                💳 UPI & BBPS Tech
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  handleUpdateCurrentItem({
                                    bannerMediaUrl: 'https://images.unsplash.com/photo-1584433144859-1fc3ab64a957?q=80&w=800&auto=format&fit=crop',
                                    mediaType: 'image',
                                    mediaLayout: 'hero_top'
                                  });
                                }}
                                className="px-2 py-0.5 bg-white hover:bg-rose-50 border border-slate-200 text-slate-700 font-bold text-[10px] rounded-lg transition cursor-pointer"
                              >
                                🚨 Alert Poster
                              </button>
                            </div>

                            {/* Media Layout & Position options if media is present */}
                            {activeEditingItem.bannerMediaUrl && (
                              <div className="pt-1.5 flex items-center justify-between border-t border-indigo-100 flex-wrap gap-1">
                                <span className="text-[10px] font-bold text-slate-600">Banner Position & Layout:</span>
                                <div className="flex gap-1.5 flex-wrap">
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateCurrentItem({ mediaLayout: 'hero_top' })}
                                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer border ${
                                      (activeEditingItem.mediaLayout || 'hero_top') === 'hero_top'
                                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                    }`}
                                  >
                                    Top Banner (Hero)
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateCurrentItem({ mediaLayout: 'side_thumb' })}
                                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer border ${
                                      activeEditingItem.mediaLayout === 'side_thumb'
                                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                    }`}
                                  >
                                    Side Thumbnail
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateCurrentItem({ mediaLayout: 'background_overlay' })}
                                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer border ${
                                      activeEditingItem.mediaLayout === 'background_overlay'
                                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                    }`}
                                  >
                                    Background Blur Overlay
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Action Button Link Config */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-slate-200">
                          <div>
                            <label className="text-[10px] font-extrabold text-slate-600 uppercase">Action Button Label (Optional)</label>
                            <input
                              type="text"
                              value={activeEditingItem.linkText || ''}
                              onChange={(e) => handleUpdateCurrentItem({ linkText: e.target.value })}
                              placeholder="e.g. En Rawh, Lut Rawh, View Canva"
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
                              <option value="open_canva_design">Open Canva Design URL</option>
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

                  {/* Firebase Cloud Live Synchronization Section */}
                  <div className="bg-linear-to-br from-indigo-900 to-slate-900 text-white p-5 rounded-3xl shadow-md border border-indigo-700/50 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-amber-400/20 border border-amber-400/30 flex items-center justify-center shrink-0">
                          <Zap className="w-5 h-5 text-amber-400" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-xs font-black text-white tracking-wide">Firebase Cloud Live Sync</h4>
                            <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border uppercase ${
                              firebaseStatus === 'connected' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40' :
                              firebaseStatus === 'connecting' ? 'bg-amber-500/20 text-amber-300 border-amber-400/40' :
                              'bg-rose-500/20 text-rose-300 border-rose-400/40'
                            }`}>
                              {firebaseStatus === 'connected' ? '● Realtime Live' : firebaseStatus === 'connecting' ? 'Connecting...' : '○ Offline Cache'}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-300 mt-0.5">
                            Firestore ID: <span className="font-mono text-amber-300">ronpay-7fc69</span> (Realtime cross-sync between Web, Android App, & AI Studio)
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <button
                        type="button"
                        onClick={handlePushAllToCloud}
                        disabled={isSyncingToCloud}
                        className="py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-md transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        {isSyncingToCloud ? 'Syncing to Cloud...' : 'Push Local Data to Firestore'}
                      </button>

                      <button
                        type="button"
                        onClick={handleForcePullCloud}
                        disabled={isSyncingToCloud}
                        className="py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs border border-white/20 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isSyncingToCloud ? 'animate-spin' : ''}`} />
                        Refresh Realtime Connection
                      </button>
                    </div>

                    <p className="text-[10px] text-indigo-200/80 leading-relaxed">
                      * Android App emaw Web Link aṭanga post / transaction thun thar apiang realtime in a in-sync vek anga, AI Studio-ah script version thar kan deploy pawhin data a bo tawh lo vang.
                    </p>
                  </div>

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

                  {/* Global Split API Settlement Master Policy */}
                  <div className="bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-900 text-white p-4 sm:p-5 rounded-2xl shadow-md border border-indigo-700/50 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="p-2 bg-indigo-500/20 border border-indigo-400/30 rounded-xl">
                          <CreditCard className="w-5 h-5 text-indigo-300" />
                        </div>
                        <div>
                          <h4 className="text-sm font-black text-white flex items-center gap-2">
                            Split API Settlement Master Policy
                            <span className="text-[10px] bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 px-2 py-0.5 rounded-full font-bold">
                              Thuneihna Zau (Admin Control)
                            </span>
                          </h4>
                          <p className="text-[11px] text-indigo-200/80">
                            Bawm zawng zawng leh Creator-te tana system split fee kalphung bulpui (Add-on vs Deduct).
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          onUpdatePricingConfig(localPricing);
                          recordAuditLog('Master Fee Policy Updated', `Updated global fee policy to ${localPricing.defaultFeeOptionRule || 'ADD_ON'}.`, 'pricing');
                          setLogsList(getStoredAuditLogs());
                          setSaveSuccessNotice(true);
                          setTimeout(() => setSaveSuccessNotice(false), 2500);
                        }}
                        className="self-start sm:self-auto px-4 py-2 bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-black rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-xs shrink-0"
                      >
                        <Save className="w-3.5 h-3.5" /> Save Master Policy
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                      {/* 100+1 (ADD_ON) */}
                      <button
                        type="button"
                        onClick={() => setLocalPricing(prev => ({
                          ...prev,
                          defaultFeeOptionRule: 'ADD_ON'
                        }))}
                        className={`p-3 rounded-xl border text-left cursor-pointer transition flex flex-col justify-between ${
                          (localPricing.defaultFeeOptionRule === 'ADD_ON' || !localPricing.defaultFeeOptionRule)
                            ? 'bg-indigo-600/90 border-indigo-400 ring-2 ring-indigo-400/50 text-white'
                            : 'bg-indigo-950/40 border-indigo-800/60 text-indigo-200 hover:bg-indigo-900/50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black">100 + 1 (Add-On)</span>
                          {(localPricing.defaultFeeOptionRule === 'ADD_ON' || !localPricing.defaultFeeOptionRule) && (
                            <Check className="w-3.5 h-3.5 text-indigo-200" />
                          )}
                        </div>
                        <p className="text-[10px] mt-1.5 leading-snug opacity-80">
                          Thawh zat bakah fee a in-add a. <b>Bawm-in 100% full amount</b> a dawng tling ang.
                        </p>
                      </button>

                      {/* 99+1 (DEDUCT) */}
                      <button
                        type="button"
                        onClick={() => setLocalPricing(prev => ({
                          ...prev,
                          defaultFeeOptionRule: 'DEDUCT'
                        }))}
                        className={`p-3 rounded-xl border text-left cursor-pointer transition flex flex-col justify-between ${
                          localPricing.defaultFeeOptionRule === 'DEDUCT'
                            ? 'bg-indigo-600/90 border-indigo-400 ring-2 ring-indigo-400/50 text-white'
                            : 'bg-indigo-950/40 border-indigo-800/60 text-indigo-200 hover:bg-indigo-900/50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black">99 + 1 (Deduct)</span>
                          {localPricing.defaultFeeOptionRule === 'DEDUCT' && (
                            <Check className="w-3.5 h-3.5 text-indigo-200" />
                          )}
                        </div>
                        <p className="text-[10px] mt-1.5 leading-snug opacity-80">
                          Thawh zat atangin fee paih a ni a. <b>Bawm-in net amount</b> a dawng ang.
                        </p>
                      </button>

                      {/* DONOR_CHOICE */}
                      <button
                        type="button"
                        onClick={() => setLocalPricing(prev => ({
                          ...prev,
                          defaultFeeOptionRule: 'DONOR_CHOICE'
                        }))}
                        className={`p-3 rounded-xl border text-left cursor-pointer transition flex flex-col justify-between ${
                          localPricing.defaultFeeOptionRule === 'DONOR_CHOICE'
                            ? 'bg-indigo-600/90 border-indigo-400 ring-2 ring-indigo-400/50 text-white'
                            : 'bg-indigo-950/40 border-indigo-800/60 text-indigo-200 hover:bg-indigo-900/50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black">Donor Choice</span>
                          {localPricing.defaultFeeOptionRule === 'DONOR_CHOICE' && (
                            <Check className="w-3.5 h-3.5 text-indigo-200" />
                          )}
                        </div>
                        <p className="text-[10px] mt-1.5 leading-snug opacity-80">
                          Payment screen-ah donor-in 100+1 nge 99+1 a duh zawk a thlang ang.
                        </p>
                      </button>
                    </div>

                    <div className="pt-2 border-t border-indigo-800/60 flex items-center justify-between text-[11px] text-indigo-200">
                      <span>💡 <b>Admin Thuneihna:</b> He master default hi Bawm tin (Campaign post) leh Creator mal tin edit-naah engtiklai pawhin a hran theuhin a override kual vek theih e.</span>
                    </div>
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

                  {/* Bial / Section Dropdown Quick Presets Master Configuration (Admin Control) */}
                  <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shadow-xs">
                          <Users className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                            Bial / Section Dropdown Quick Presets Setup
                            <span className="text-[10px] bg-indigo-100 text-indigo-800 border border-indigo-200 px-2 py-0.5 rounded-full font-bold">
                              {sectionPresets.length} Presets Active
                            </span>
                          </h4>
                          <p className="text-[11px] text-slate-500">
                            Kohhran, Pawl, NGO leh Veng-te tana Kumtluang Bawm siam laia dropdown preset duansa (Admin Control).
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm('Quick Presets zawng zawng hi Default (System Default)-ah reset i duh em?')) {
                              setSectionPresets(DEFAULT_SECTION_PRESETS);
                              saveStoredSectionPresets(DEFAULT_SECTION_PRESETS);
                              alert('🔄 Default presets-ah reset fel a ni e.');
                            }
                          }}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer flex items-center gap-1.5"
                          title="Reset presets to default"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Reset</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsSectionPresetModalOpen(true)}
                          className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition cursor-pointer flex items-center gap-1.5 shadow-xs"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>+ Preset Thar / Setup</span>
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {sectionPresets.map((preset) => (
                        <div
                          key={preset.id}
                          className="bg-slate-50 hover:bg-indigo-50/30 p-3.5 rounded-2xl border border-slate-200 hover:border-indigo-200 transition space-y-2.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <h5 className="font-black text-slate-900 text-xs flex items-center gap-1.5">
                                <span>{preset.name}</span>
                                {preset.isSystem ? (
                                  <span className="text-[9px] bg-slate-200 text-slate-700 font-bold px-1.5 py-0.2 rounded">
                                    System Default
                                  </span>
                                ) : (
                                  <span className="text-[9px] bg-indigo-100 text-indigo-700 font-bold px-1.5 py-0.2 rounded">
                                    Custom Preset
                                  </span>
                                )}
                              </h5>
                              <p className="text-[10.5px] text-slate-500 font-medium">
                                Dropdown Label: <b className="text-slate-800">{preset.label}</b> • <b>{preset.sections.length} sections</b>
                              </p>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => setIsSectionPresetModalOpen(true)}
                                className="p-1.5 bg-white hover:bg-indigo-50 text-indigo-700 border border-slate-200 hover:border-indigo-300 rounded-lg text-xs font-bold transition cursor-pointer"
                                title="Edit this preset"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (confirm(`He preset "${preset.name}" hi i delete duh tak tak em?`)) {
                                    const updated = sectionPresets.filter(p => p.id !== preset.id);
                                    setSectionPresets(updated);
                                    saveStoredSectionPresets(updated);
                                  }
                                }}
                                className="p-1.5 bg-white hover:bg-rose-50 text-rose-600 border border-slate-200 hover:border-rose-300 rounded-lg text-xs font-bold transition cursor-pointer"
                                title="Delete preset"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Section Chips */}
                          <div className="flex flex-wrap gap-1">
                            {preset.sections.map((sec, sIdx) => (
                              <span
                                key={sIdx}
                                className="text-[9.5px] bg-white border border-slate-200 text-slate-700 font-semibold px-2 py-0.5 rounded-md shadow-2xs"
                              >
                                {sec}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-200 text-[11px] text-indigo-900 flex items-start gap-2">
                      <Sparkles className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                      <div>
                        <b>Admin Thuchak:</b> Heng Quick Presets te hi Admin-in a duh angin a siam (create), a edit, a delete emaw default-ah a reset thei a, Kumtluang Bawm thar siam leh edit na zawng zawngah 1-click in a hmang nghal thei a ni.
                      </div>
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
              {/* TAB 0: STAFF & RBAC MANAGEMENT (SUPER_ADMIN ONLY)          */}
              {/* ========================================================= */}
              {activeTab === 'staff' && hasMinimumRole(currentRole, 'SUPER_ADMIN') && (
                <StaffManagementTab
                  currentRole={currentRole}
                  staffList={staffList}
                  onSaveStaff={(staff) => {
                    saveStaffAccount(staff);
                    setStaffList(getStoredStaffAccounts());
                  }}
                  onDeleteStaff={(staffId) => {
                    deleteStaffAccount(staffId);
                    setStaffList(getStoredStaffAccounts());
                  }}
                />
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
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] font-extrabold text-slate-600 uppercase">Validity Date & Time</label>
                        <span className="text-[10px] text-slate-500 font-bold">
                          {editingCampaign.validityDate ? formatDateDDMMYYYY(editingCampaign.validityDate) : 'Not set'}
                        </span>
                      </div>
                      <input
                        type="datetime-local"
                        value={editingCampaign.validityDate ? editingCampaign.validityDate.substring(0, 16) : getTodayDateTimeLocal(23, 59, 0)}
                        onChange={(e) => setEditingCampaign({ ...editingCampaign, validityDate: e.target.value })}
                        className="w-full mt-1 p-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:border-indigo-600 focus:outline-none"
                      />
                      <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                        <span className="text-[9px] font-extrabold text-slate-400 uppercase mr-1">Quick:</span>
                        <button
                          type="button"
                          onClick={() => setEditingCampaign({ ...editingCampaign, validityDate: getTodayDateTimeLocal(23, 59, 0), status: 'active' })}
                          className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[9.5px] cursor-pointer"
                        >
                          Today
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingCampaign({ ...editingCampaign, validityDate: getTodayDateTimeLocal(23, 59, 7), status: 'active' })}
                          className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[9.5px] cursor-pointer"
                        >
                          +7 Days
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingCampaign({ ...editingCampaign, validityDate: getTodayDateTimeLocal(23, 59, 30), status: 'active' })}
                          className="px-2 py-0.5 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[9.5px] cursor-pointer border border-indigo-200"
                        >
                          +30 Days
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingCampaign({ ...editingCampaign, validityDate: getTodayDateTimeLocal(23, 59, 365), status: 'active' })}
                          className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[9.5px] cursor-pointer"
                        >
                          +1 Year
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-extrabold text-slate-600 uppercase">Campaign Status</label>
                      <select
                        value={editingCampaign.status || 'active'}
                        onChange={(e) => setEditingCampaign({ ...editingCampaign, status: e.target.value as any })}
                        className="w-full mt-1 p-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:border-indigo-600 focus:outline-none"
                      >
                        <option value="active">🟢 Active (Live & Accepting Donations)</option>
                        <option value="expired">⏸️ Expired (Closed)</option>
                        <option value="pending_approval">⏳ Pending Approval</option>
                        <option value="rejected">❌ Rejected</option>
                      </select>
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

                    {/* Prefix Code Editor */}
                    <div className="bg-white p-2.5 rounded-xl border border-indigo-200 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-black text-indigo-950 uppercase tracking-wider">
                          Bawm Prefix Code (System-wide Unique)
                        </label>
                        <span className="text-[9.5px] font-mono font-bold text-indigo-700">
                          Sample: {(editingCampaign.orgCode || 'EBE').toUpperCase()}-7890
                        </span>
                      </div>
                      <div className="flex gap-2 items-center">
                        <input
                          type="text"
                          maxLength={6}
                          value={editingCampaign.orgCode || ''}
                          onChange={(e) => setEditingCampaign({
                            ...editingCampaign,
                            orgCode: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')
                          })}
                          className={`w-24 bg-slate-50 border-2 rounded-xl p-1.5 font-mono font-black text-center text-xs tracking-wider uppercase focus:outline-none ${
                            editingCampaign.orgCode?.trim() && isPrefixCodeTaken(editingCampaign.orgCode.trim(), editingCampaign.id)
                              ? 'border-rose-500 text-rose-700 bg-rose-50'
                              : editingCampaign.orgCode?.trim()
                              ? 'border-emerald-500 text-emerald-700 bg-emerald-50'
                              : 'border-slate-300 text-slate-900 focus:border-indigo-500'
                          }`}
                        />
                        <div className="flex-1 text-[10px] leading-tight">
                          {editingCampaign.orgCode?.trim() && isPrefixCodeTaken(editingCampaign.orgCode.trim(), editingCampaign.id) ? (
                            <span className="text-rose-600 font-bold">⚠️ Already taken by another Bawm!</span>
                          ) : (
                            <span className="text-emerald-700 font-bold">✓ Unique Prefix</span>
                          )}
                        </div>
                      </div>

                      {/* Quick Sync with Org Name button */}
                      <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => {
                            const text = editingCampaign.orgName?.trim() || editingCampaign.title?.trim() || 'BAW';
                            const derived = derivePrefixFromText(text);
                            if (isPrefixCodeTaken(derived, editingCampaign.id)) {
                              const alts = suggestAlternativePrefixes(text);
                              setEditingCampaign({ ...editingCampaign, orgCode: alts[0] || derived });
                            } else {
                              setEditingCampaign({ ...editingCampaign, orgCode: derived });
                            }
                          }}
                          className="text-[9.5px] text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 transition cursor-pointer"
                        >
                          <RotateCcw className="w-2.5 h-2.5 text-indigo-600" />
                          <span>🔄 Org Name atangin Sync / Thlak Thung rawh</span>
                        </button>
                        <span className="text-[8.5px] text-slate-400 font-medium">Member te ID auto-update nghal ang</span>
                      </div>

                      {editingCampaign.orgCode?.trim() && isPrefixCodeTaken(editingCampaign.orgCode.trim(), editingCampaign.id) && (
                        <div className="bg-rose-50 p-2 rounded-lg border border-rose-200 space-y-1">
                          <div className="text-[9.5px] font-bold text-rose-900 flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-amber-600" />
                            <span>Available Suggestions:</span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {suggestAlternativePrefixes(editingCampaign.orgCode || editingCampaign.orgName || '').map((alt) => (
                              <button
                                key={alt}
                                type="button"
                                onClick={() => setEditingCampaign({ ...editingCampaign, orgCode: alt })}
                                className="bg-white hover:bg-rose-100 border border-rose-300 text-rose-900 font-mono font-black text-[10px] px-2 py-0.5 rounded shadow-2xs cursor-pointer"
                              >
                                {alt} (Free)
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
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

                    {/* Bial / Section / Veng Setup for Kumtluang */}
                    <div className="bg-white p-3 rounded-2xl border border-indigo-200 space-y-2.5 overflow-hidden">
                      <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-1">
                        <label className="text-[10.5px] font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                          <span>Bial / Section Dropdown Setup</span>
                        </label>
                        <span className="text-[9px] bg-indigo-100 text-indigo-800 font-bold px-2 py-0.5 rounded-md self-start xs:self-auto">
                          Pre-defined Dropdown
                        </span>
                      </div>

                      <p className="text-[10px] text-slate-500 font-medium leading-relaxed">
                        Member-ten register emaw sum thawh laia spelling error an neih loh nan leh report-a Bial/Section zela fel taka an in-sort theih nan.
                      </p>

                      {/* Preset Quick Chooser */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[9.5px] font-bold text-slate-500">Quick Presets:</span>
                        {sectionPresets.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => {
                              setEditingCampaign({
                                ...editingCampaign,
                                sectionLabel: p.label,
                                definedSections: [...p.sections]
                              });
                            }}
                            className="text-[9.5px] font-bold px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg border border-indigo-200 transition cursor-pointer"
                            title={`Apply preset: ${p.name}`}
                          >
                            {p.name}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => setIsSectionPresetModalOpen(true)}
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
                            value={editingCampaign.sectionLabel || 'Bial / Section'}
                            onChange={(e) => setEditingCampaign({ ...editingCampaign, sectionLabel: e.target.value })}
                            placeholder="e.g. Bial / Unit emaw Section / Veng"
                            className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 text-xs font-bold text-slate-900 focus:outline-none focus:bg-white focus:border-indigo-600"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-600 block mb-1">
                            Add New ({(editingCampaign.definedSections || []).length} sections)
                          </label>
                          <div className="flex gap-1">
                            <input
                              type="text"
                              value={campaignEditNewSection}
                              onChange={(e) => setCampaignEditNewSection(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  const trimmed = campaignEditNewSection.trim();
                                  if (trimmed) {
                                    const items = trimmed.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean);
                                    const currentSecs = editingCampaign.definedSections || [];
                                    const newItems = items.filter(s => !currentSecs.includes(s));
                                    if (newItems.length > 0) {
                                      setEditingCampaign({
                                        ...editingCampaign,
                                        definedSections: [...currentSecs, ...newItems]
                                      });
                                      setCampaignEditNewSection('');
                                    }
                                  }
                                }
                              }}
                              placeholder="+ Bial/Section (comma-in then theih)..."
                              className="flex-1 min-w-0 bg-slate-50 border border-slate-300 rounded-xl p-2 text-xs font-bold text-slate-900 focus:outline-none focus:bg-white focus:border-indigo-600"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const trimmed = campaignEditNewSection.trim();
                                if (trimmed) {
                                  const items = trimmed.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean);
                                  const currentSecs = editingCampaign.definedSections || [];
                                  const newItems = items.filter(s => !currentSecs.includes(s));
                                  if (newItems.length > 0) {
                                    setEditingCampaign({
                                      ...editingCampaign,
                                      definedSections: [...currentSecs, ...newItems]
                                    });
                                    setCampaignEditNewSection('');
                                  }
                                }
                              }}
                              className="px-2.5 py-1.5 shrink-0 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 cursor-pointer"
                            >
                              + Add
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Section List Tags */}
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {(!editingCampaign.definedSections || editingCampaign.definedSections.length === 0) ? (
                          <span className="text-[10.5px] text-slate-400 italic">
                            Section a la awm lo. A chunga Quick Presets thlang rawh emaw input-ah khian chhu lut rawh.
                          </span>
                        ) : (
                          editingCampaign.definedSections.map((sec, idx) => (
                            <span
                              key={idx}
                              className="bg-indigo-50 border border-indigo-200 text-indigo-900 font-bold px-2 py-1 rounded-lg text-[10.5px] flex items-center gap-1 shadow-2xs max-w-full"
                            >
                              <span className="truncate">{sec}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = (editingCampaign.definedSections || []).filter((_, i) => i !== idx);
                                  setEditingCampaign({ ...editingCampaign, definedSections: updated });
                                }}
                                className="text-rose-500 hover:text-rose-700 font-black cursor-pointer ml-1 shrink-0"
                              >
                                ✕
                              </button>
                            </span>
                          ))
                        )}
                      </div>

                      {editingCampaign.definedSections && editingCampaign.definedSections.length > 0 && (
                        <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                          <span className="text-[9.5px] text-slate-500 font-medium">
                            Bial/Section <b>{editingCampaign.definedSections.length}</b> dah a ni tawh
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                const defaultName = prompt('He Quick Preset thar hming tur hi chhu lut rawh:', `${editingCampaign.orgName || editingCampaign.sectionLabel || 'Custom'} Preset`);
                                if (!defaultName || !defaultName.trim()) return;
                                const newP: SectionQuickPreset = {
                                  id: `preset-${Date.now()}`,
                                  name: defaultName.trim(),
                                  label: editingCampaign.sectionLabel?.trim() || 'Bial / Section',
                                  sections: [...(editingCampaign.definedSections || [])],
                                  createdAt: new Date().toISOString()
                                };
                                const updated = [...sectionPresets, newP];
                                setSectionPresets(updated);
                                saveStoredSectionPresets(updated);
                                alert(`🎉 "${defaultName.trim()}" preset atan save fel a ni e!`);
                              }}
                              className="text-[10px] font-bold text-indigo-700 hover:text-indigo-900 flex items-center gap-1 hover:underline cursor-pointer"
                              title="Save these current sections as a quick preset for future bawms"
                            >
                              <Save className="w-3 h-3 text-indigo-600" />
                              <span>Save as Quick Preset</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (confirm('Bial / Section zawng zawng hi clear vek i duh tak tak em?')) {
                                  setEditingCampaign({ ...editingCampaign, definedSections: [] });
                                }
                              }}
                              className="text-[10px] font-bold text-rose-600 hover:text-rose-800 hover:underline cursor-pointer"
                            >
                              Clear All
                            </button>
                          </div>
                        </div>
                      )}
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

                {/* 4. Split API Settlement & Platform Fee Settings (He Bawm Bik Thuneihna) */}
                <div className="bg-gradient-to-br from-indigo-50/90 to-slate-50 p-4 rounded-2xl border border-indigo-200 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <CreditCard className="w-4 h-4 text-indigo-600" />
                      <h4 className="text-[11px] font-black uppercase text-indigo-950 tracking-wider">
                        Bawm Bik Split API & Platform Fee Control
                      </h4>
                    </div>
                    <span className="text-[9.5px] font-extrabold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-md">
                      Granular Admin Control
                    </span>
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-700 uppercase block mb-1.5">
                      Fee Settlement Policy (He Bawm Tan Bik)
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingCampaign({ ...editingCampaign, feeOptionRule: 'ADD_ON' })}
                        className={`p-2.5 rounded-xl border text-left cursor-pointer transition flex flex-col justify-between ${
                          (editingCampaign.feeOptionRule === 'ADD_ON' || (!editingCampaign.feeOptionRule && !editingCampaign.trxnFeeBearer))
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs ring-2 ring-indigo-300'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <div className="font-black text-xs">100 + 1 (Add-On)</div>
                        <div className={`text-[9.5px] mt-1 leading-tight ${
                          (editingCampaign.feeOptionRule === 'ADD_ON' || (!editingCampaign.feeOptionRule && !editingCampaign.trxnFeeBearer)) ? 'text-indigo-100' : 'text-slate-500'
                        }`}>
                          Donor-in fee pe belh se, Bawm-in 100% a pumhlumin dawng rawh se
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setEditingCampaign({ ...editingCampaign, feeOptionRule: 'DEDUCT' })}
                        className={`p-2.5 rounded-xl border text-left cursor-pointer transition flex flex-col justify-between ${
                          editingCampaign.feeOptionRule === 'DEDUCT'
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs ring-2 ring-indigo-300'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <div className="font-black text-xs">99 + 1 (Deduct)</div>
                        <div className={`text-[9.5px] mt-1 leading-tight ${
                          editingCampaign.feeOptionRule === 'DEDUCT' ? 'text-indigo-100' : 'text-slate-500'
                        }`}>
                          Thawhzat atangin fee paih se, Bawm-in net dawng rawh se
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setEditingCampaign({ ...editingCampaign, feeOptionRule: 'DONOR_CHOICE' })}
                        className={`p-2.5 rounded-xl border text-left cursor-pointer transition flex flex-col justify-between ${
                          editingCampaign.feeOptionRule === 'DONOR_CHOICE'
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs ring-2 ring-indigo-300'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <div className="font-black text-xs">Donor Choice</div>
                        <div className={`text-[9.5px] mt-1 leading-tight ${
                          editingCampaign.feeOptionRule === 'DONOR_CHOICE' ? 'text-indigo-100' : 'text-slate-500'
                        }`}>
                          Donor-in checkout-ah duh zawk thlang rawh se (100+1 nge 99+1)
                        </div>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-indigo-100/80">
                    <div>
                      <label className="text-[10px] font-extrabold text-slate-700 uppercase">
                        Platform Fee Rate (%) Override
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="10"
                        value={editingCampaign.customPlatformFeePercent !== undefined ? editingCampaign.customPlatformFeePercent : ''}
                        onChange={(e) => {
                          const val = e.target.value === '' ? undefined : parseFloat(e.target.value);
                          setEditingCampaign({ ...editingCampaign, customPlatformFeePercent: val });
                        }}
                        className="w-full mt-1 p-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-600"
                        placeholder="Default (1.0%)"
                      />
                      <p className="text-[9px] text-slate-500 mt-0.5">Empty dah chuan category/creator rate a hmang ang</p>
                    </div>

                    <div className="flex flex-col justify-center">
                      <label className="text-[10px] font-extrabold text-slate-700 uppercase mb-1">
                        Special 0% Free Exemption
                      </label>
                      <button
                        type="button"
                        onClick={() => setEditingCampaign({
                          ...editingCampaign,
                          customFreeTrialActive: !editingCampaign.customFreeTrialActive
                        })}
                        className={`p-2 rounded-xl border text-xs font-bold transition flex items-center justify-between cursor-pointer ${
                          editingCampaign.customFreeTrialActive
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <span>{editingCampaign.customFreeTrialActive ? '🎉 0% Free Active (A thlawn)' : 'Standard Fee Active'}</span>
                        <span className="text-[10px] uppercase font-black px-1.5 py-0.5 rounded bg-black/15">
                          {editingCampaign.customFreeTrialActive ? 'ON' : 'OFF'}
                        </span>
                      </button>
                      <p className="text-[9px] text-slate-500 mt-0.5">He Bawm bik tan fee chawi tir loh (0%) a nih chuan ON rawh</p>
                    </div>
                  </div>
                </div>

                {/* 5. Admin Approval Remarks */}
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

        {/* Creator Review, Photo Studio, Inspection & Rights Modal Sheet */}
        {editingCreator && (
          <div className="fixed inset-0 bg-slate-950/80 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-xs animate-fadeIn overflow-y-auto">
            <div className="bg-white w-full max-w-2xl rounded-3xl p-5 md:p-6 shadow-2xl border border-indigo-200 space-y-5 text-slate-800 my-auto max-h-[92vh] overflow-y-auto">
              
              {/* Modal Header */}
              <div className="flex justify-between items-start border-b border-slate-200 pb-3.5">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-black text-slate-900 text-lg flex items-center gap-2">
                      <UserCheck className="w-5 h-5 text-indigo-600" />
                      Creator Inspection & Photo Studio
                    </h3>
                    {!editingCreator.isApproved && !editingCreator.rejectionReason && (
                      <span className="text-[10px] font-black uppercase bg-amber-500 text-white px-2.5 py-0.5 rounded-full animate-pulse">
                        Pending Application
                      </span>
                    )}
                    {!editingCreator.isApproved && editingCreator.rejectionReason && (
                      <span className="text-[10px] font-black uppercase bg-rose-600 text-white px-2.5 py-0.5 rounded-full">
                        Declined
                      </span>
                    )}
                    {editingCreator.isApproved && (
                      <span className="text-[10px] font-black uppercase bg-emerald-600 text-white px-2.5 py-0.5 rounded-full">
                        Approved & Active
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Thlalak (Photos/Logos), Personal Details, KYC Documents leh Bawm Categories enfiahna & siamthatna.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingCreator(null)}
                  className="text-slate-400 hover:text-slate-700 transition p-1.5 rounded-xl hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* 1. THLALAK, AVATAR & LOGO SIAMTHATNA (Photo & Logo Studio) */}
              <div className="bg-gradient-to-br from-indigo-50/90 via-purple-50/60 to-white p-4 rounded-2xl border-2 border-indigo-200 shadow-2xs space-y-4">
                <div className="flex items-center justify-between border-b border-indigo-100 pb-2">
                  <span className="text-xs font-black uppercase text-indigo-950 tracking-wider flex items-center gap-1.5">
                    <Camera className="w-4 h-4 text-indigo-600" />
                    Thlalak & Logo Siamthatna (Photos & Branding)
                  </span>
                  <span className="text-[10px] font-extrabold text-indigo-700 bg-white px-2 py-0.5 rounded-md border border-indigo-200">
                    File Upload & URL Ready
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Avatar / Profile Photo Section */}
                  <div className="bg-white p-3.5 rounded-xl border border-indigo-100 space-y-2.5 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-extrabold text-slate-800 uppercase flex items-center gap-1">
                        <ImageIcon className="w-3.5 h-3.5 text-indigo-600" /> Creator Profile Photo / Avatar
                      </label>
                      {creatorEditAvatarUrl && (
                        <button
                          type="button"
                          onClick={() => setCreatorEditAvatarUrl('')}
                          className="text-[10px] font-bold text-rose-600 hover:underline"
                        >
                          Remove Photo
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="w-16 h-16 rounded-2xl bg-indigo-100 border-2 border-indigo-200 overflow-hidden flex items-center justify-center shrink-0 shadow-inner">
                        {creatorEditAvatarUrl ? (
                          <img 
                            src={creatorEditAvatarUrl} 
                            alt="Avatar Preview" 
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="text-indigo-400 font-bold text-xs flex flex-col items-center">
                            <Camera className="w-5 h-5 mb-0.5" />
                            <span>No Photo</span>
                          </div>
                        )}
                      </div>

                      <div className="flex-1 space-y-1.5">
                        <label className="block w-full">
                          <span className="sr-only">Choose profile photo</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onloadend = () => {
                                  if (typeof reader.result === 'string') {
                                    setCreatorEditAvatarUrl(reader.result);
                                  }
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                            className="block w-full text-[11px] text-slate-500 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-[10px] file:font-bold file:bg-indigo-600 file:text-white hover:file:bg-indigo-700 file:cursor-pointer cursor-pointer"
                          />
                        </label>
                        <input
                          type="url"
                          value={creatorEditAvatarUrl}
                          onChange={(e) => setCreatorEditAvatarUrl(e.target.value)}
                          placeholder="Or paste image URL (https://...)"
                          className="w-full p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-medium text-slate-800 focus:bg-white focus:border-indigo-600 focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* Quick Avatar Presets */}
                    <div className="flex flex-wrap gap-1 pt-1 border-t border-slate-100">
                      <span className="text-[9.5px] font-bold text-slate-500 self-center">Presets:</span>
                      {[
                        { label: '👤 Male', url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&auto=format&fit=crop&q=80' },
                        { label: '👩 Female', url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&auto=format&fit=crop&q=80' },
                        { label: '👔 Leader', url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80' }
                      ].map(p => (
                        <button
                          key={p.label}
                          type="button"
                          onClick={() => setCreatorEditAvatarUrl(p.url)}
                          className="px-2 py-0.5 bg-slate-100 hover:bg-indigo-100 hover:text-indigo-900 rounded text-[10px] font-bold text-slate-700 transition cursor-pointer"
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Organization / Kohhran Logo Section */}
                  <div className="bg-white p-3.5 rounded-xl border border-indigo-100 space-y-2.5 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-extrabold text-slate-800 uppercase flex items-center gap-1">
                        <Building className="w-3.5 h-3.5 text-purple-600" /> Organization / Kohhran Logo
                      </label>
                      {creatorEditLogoUrl && (
                        <button
                          type="button"
                          onClick={() => setCreatorEditLogoUrl('')}
                          className="text-[10px] font-bold text-rose-600 hover:underline"
                        >
                          Remove Logo
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="w-16 h-16 rounded-2xl bg-purple-100 border-2 border-purple-200 overflow-hidden flex items-center justify-center shrink-0 shadow-inner">
                        {creatorEditLogoUrl ? (
                          <img 
                            src={creatorEditLogoUrl} 
                            alt="Logo Preview" 
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="text-purple-400 font-bold text-xs flex flex-col items-center">
                            <Building className="w-5 h-5 mb-0.5" />
                            <span>No Logo</span>
                          </div>
                        )}
                      </div>

                      <div className="flex-1 space-y-1.5">
                        <label className="block w-full">
                          <span className="sr-only">Choose logo</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onloadend = () => {
                                  if (typeof reader.result === 'string') {
                                    setCreatorEditLogoUrl(reader.result);
                                  }
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                            className="block w-full text-[11px] text-slate-500 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-[10px] file:font-bold file:bg-purple-600 file:text-white hover:file:bg-purple-700 file:cursor-pointer cursor-pointer"
                          />
                        </label>
                        <input
                          type="url"
                          value={creatorEditLogoUrl}
                          onChange={(e) => setCreatorEditLogoUrl(e.target.value)}
                          placeholder="Or paste logo URL (https://...)"
                          className="w-full p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-medium text-slate-800 focus:bg-white focus:border-purple-600 focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* Quick Logo Presets */}
                    <div className="flex flex-wrap gap-1 pt-1 border-t border-slate-100">
                      <span className="text-[9.5px] font-bold text-slate-500 self-center">Presets:</span>
                      {[
                        { label: '⛪ Kohhran', url: 'https://images.unsplash.com/photo-1548625361-195fe5787680?w=200&auto=format&fit=crop&q=80' },
                        { label: '🤝 NGO/YMA', url: 'https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?w=200&auto=format&fit=crop&q=80' },
                        { label: '🎗️ Charity', url: 'https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?w=200&auto=format&fit=crop&q=80' }
                      ].map(p => (
                        <button
                          key={p.label}
                          type="button"
                          onClick={() => setCreatorEditLogoUrl(p.url)}
                          className="px-2 py-0.5 bg-slate-100 hover:bg-purple-100 hover:text-purple-900 rounded text-[10px] font-bold text-slate-700 transition cursor-pointer"
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. CREATOR PERSONAL & OFFICIAL DETAILS */}
              <div className="space-y-3 bg-slate-50/90 p-4 rounded-2xl border border-slate-200">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <span className="text-[11px] font-black uppercase text-slate-900 tracking-wider flex items-center gap-1.5">
                    <Edit3 className="w-3.5 h-3.5 text-indigo-600" />
                    Personal & Organization Details
                  </span>
                  <span className="text-[10px] font-bold text-slate-500">
                    Mobile: <strong className="font-mono text-slate-800">{editingCreator.phone}</strong>
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
                      className="w-full mt-1 p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:border-indigo-600 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-extrabold text-slate-700 uppercase">Organization / Kohhran / Pawl</label>
                    <input
                      type="text"
                      value={creatorEditOrgName}
                      onChange={(e) => setCreatorEditOrgName(e.target.value)}
                      placeholder="e.g. BCM Ebenezer / YMA Branch"
                      className="w-full mt-1 p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:border-indigo-600 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[10px] font-extrabold text-slate-700 uppercase">Nihna (Designation)</label>
                    <input
                      type="text"
                      value={creatorEditDesignation}
                      onChange={(e) => setCreatorEditDesignation(e.target.value)}
                      placeholder="e.g. Secretary / Treasurer"
                      className="w-full mt-1 p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:border-indigo-600 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-extrabold text-slate-700 uppercase">Mobile Phone Number</label>
                    <input
                      type="text"
                      value={creatorEditPhone}
                      onChange={(e) => setCreatorEditPhone(e.target.value)}
                      placeholder="9862300000"
                      className="w-full mt-1 p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:border-indigo-600 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-extrabold text-slate-700 uppercase">UPI ID (Direct Payout)</label>
                    <input
                      type="text"
                      value={creatorEditUpiId}
                      onChange={(e) => setCreatorEditUpiId(e.target.value)}
                      placeholder="e.g. name@okaxis"
                      className="w-full mt-1 p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-indigo-900 focus:border-indigo-600 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="text-[10px] font-extrabold text-slate-700 uppercase flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-slate-500" /> Location / Veng / Address
                    </label>
                    <input
                      type="text"
                      value={creatorEditAddress}
                      onChange={(e) => setCreatorEditAddress(e.target.value)}
                      placeholder="e.g. Khatla South, Aizawl"
                      className="w-full mt-1 p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:border-indigo-600 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-extrabold text-slate-700 uppercase flex items-center gap-1">
                      <KeyRound className="w-3 h-3 text-slate-500" /> Login Password / Security PIN
                    </label>
                    <input
                      type="text"
                      value={creatorEditPassword}
                      onChange={(e) => setCreatorEditPassword(e.target.value)}
                      placeholder="Enter 6-digit PIN or password"
                      className="w-full mt-1 p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:border-indigo-600 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* 3. KYC & AUTH DOCUMENTATION */}
              <div className="bg-slate-50/90 p-4 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <span className="text-[11px] font-black uppercase text-slate-900 tracking-wider flex items-center gap-1.5">
                    <FileCheck className="w-3.5 h-3.5 text-emerald-600" />
                    KYC & Authorization Document Verification
                  </span>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isCreatorVerifiedCheck}
                      onChange={(e) => setIsCreatorVerifiedCheck(e.target.checked)}
                      className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500 cursor-pointer"
                    />
                    <span className="text-[11px] font-bold text-slate-800">Phone & Identity Verified ✅</span>
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-extrabold text-slate-700 uppercase">Document Name / Title</label>
                    <input
                      type="text"
                      value={creatorEditDocName}
                      onChange={(e) => setCreatorEditDocName(e.target.value)}
                      placeholder="e.g. Kohhran In-hriattirna / Aadhaar / YMA Cert"
                      className="w-full mt-1 p-2 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:border-indigo-600 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-extrabold text-slate-700 uppercase">Document Image / File URL</label>
                    <div className="flex gap-2 mt-1">
                      <input
                        type="text"
                        value={creatorEditDocUrl}
                        onChange={(e) => setCreatorEditDocUrl(e.target.value)}
                        placeholder="Document URL (https://...)"
                        className="flex-1 p-2 bg-white border border-slate-300 rounded-xl text-xs font-mono text-slate-900 focus:border-indigo-600 focus:outline-none"
                      />
                      <label className="bg-slate-200 hover:bg-slate-300 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 cursor-pointer shrink-0 flex items-center gap-1">
                        <Upload className="w-3.5 h-3.5" /> File
                        <input
                          type="file"
                          accept="image/*,.pdf"
                          className="sr-only"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setCreatorEditDocName(file.name);
                              const reader = new FileReader();
                              reader.onloadend = () => {
                                if (typeof reader.result === 'string') {
                                  setCreatorEditDocUrl(reader.result);
                                }
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* 4. APPROVED BAWM CATEGORIES */}
              <div className="space-y-2">
                <label className="text-[11px] font-black text-slate-800 uppercase tracking-wider">
                  Approved Bawm Categories (Bawm Siam Theihna Rights)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
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
                        className={`p-2.5 rounded-xl text-xs font-bold border transition flex items-center justify-between cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-50 text-indigo-950 border-indigo-400 shadow-2xs ring-1 ring-indigo-300'
                            : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <span>{BAWM_CONFIG[cat]?.name}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 5. LICENSE / FREE TRIAL DURATION & TOGGLE */}
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
                </div>
              </div>

              {/* 6. FREE POSTS QUOTA & CUSTOM FEE OVERRIDES */}
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
                        className={`text-[10px] px-2 py-0.5 rounded-md font-bold border transition cursor-pointer ${
                          creatorFreePostsQuota === q
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        {q === 0 ? '0 (No Quota)' : `${q} Posts`}
                      </button>
                    ))}
                  </div>
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
                        className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold border transition cursor-pointer ${
                          customPlatformFee === item.val
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 7. PER-CATEGORY CUSTOM OVERRIDES MATRIX */}
              <div className="bg-indigo-50/60 p-3.5 rounded-2xl border border-indigo-200 space-y-2.5">
                <div className="flex justify-between items-center">
                  <label className="text-[11px] font-black text-indigo-950 uppercase tracking-wider flex items-center gap-1.5">
                    <Coins className="w-4 h-4 text-indigo-700" /> Bawm Tin Custom Offer & Rate Matrix
                  </label>
                  <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-md">
                    Optional Custom Rules
                  </span>
                </div>

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
                              <span className="text-[9px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded">Custom Rate</span>
                            ) : (
                              <span className="text-[9px] bg-slate-100 text-slate-500 font-semibold px-1.5 py-0.5 rounded">Global Default</span>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              if (isCustomized) {
                                const updated = { ...categoryOverridesMap };
                                delete updated[cat];
                                setCategoryOverridesMap(updated);
                              } else {
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
                            {isCustomized ? 'Reset to Global' : '+ Customize this Bawm'}
                          </button>
                        </div>

                        {isCustomized && (
                          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100 animate-fadeIn">
                            <div className="bg-slate-50 p-2 rounded-lg border border-slate-200 flex items-center justify-between">
                              <span className="text-[10px] font-bold text-slate-700">Free Offer:</span>
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

              {/* Creator Default Fee Settlement Policy */}
              <div className="bg-indigo-50/70 p-3.5 rounded-2xl border border-indigo-200 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-black text-indigo-950 text-xs">
                    <CreditCard className="w-4 h-4 text-indigo-600" />
                    Creator Default Fee Settlement Mode
                  </div>
                  <span className="text-[9.5px] font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-md">
                    Account Level Default
                  </span>
                </div>
                <p className="text-[10px] text-slate-500">
                  He Creator-in Bawm thar a siam apianga a default tura i duh thlang rawh (Bawm post edit-naah mal te tein a thlak theih tho bawk):
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {(['ADD_ON', 'DEDUCT', 'DONOR_CHOICE'] as FeeOptionMode[]).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setCreatorDefaultFeeOptionRule(mode)}
                      className={`p-2.5 rounded-xl text-center text-xs font-black border transition cursor-pointer flex flex-col items-center justify-center ${
                        creatorDefaultFeeOptionRule === mode
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <span>{mode === 'ADD_ON' ? '100+1 (Add-On)' : mode === 'DEDUCT' ? '99+1 (Deduct)' : 'Donor Choice'}</span>
                      <span className={`text-[9px] font-medium mt-0.5 ${creatorDefaultFeeOptionRule === mode ? 'text-indigo-200' : 'text-slate-400'}`}>
                        {mode === 'ADD_ON' ? 'Donor pe belh' : mode === 'DEDUCT' ? 'Thawhzat paih' : 'Donor thlang'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 8. LIFETIME VIP TOGGLE */}
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

              {/* MODAL ACTIONS FOOTER */}
              <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditingCreator(null)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={() => handleOpenDeclineModal(editingCreator)}
                  className="px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-black rounded-xl text-xs transition flex items-center gap-1 cursor-pointer"
                >
                  <X className="w-4 h-4" /> Decline / Reject
                </button>

                {!editingCreator.isApproved ? (
                  <>
                    <button
                      type="button"
                      onClick={() => handleApproveCreator(editingCreator, true)}
                      className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-black rounded-xl text-xs transition flex items-center gap-1 cursor-pointer ml-auto"
                      title="Save edits but keep status as Pending"
                    >
                      <Save className="w-4 h-4" /> Save (Keep Pending)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApproveCreator(editingCreator, false)}
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-xs transition shadow-md shadow-emerald-200 flex items-center gap-1.5 cursor-pointer"
                    >
                      <Check className="w-4 h-4" /> Approve & Activate Creator
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleApproveCreator(editingCreator, false)}
                    className="flex-1 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl text-xs transition shadow-md shadow-indigo-200 flex items-center justify-center gap-1.5 cursor-pointer ml-auto"
                  >
                    <Check className="w-4 h-4" /> Save Profile, Photos & Rights
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Dedicated Decline / Reject Creator Application Dialog */}
        {decliningCreator && (
          <div className="fixed inset-0 bg-slate-950/80 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-fadeIn">
            <div className="bg-white w-full max-w-md rounded-3xl p-5 sm:p-6 shadow-2xl border border-rose-200 space-y-4 text-slate-800 animate-scaleUp">
              <div className="flex justify-between items-start border-b border-rose-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold shrink-0 border border-rose-200">
                    <ShieldAlert className="w-5 h-5 text-rose-600" />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 text-base">Decline Creator Application</h3>
                    <p className="text-xs text-slate-500 font-medium">Applicant hnawlna chhan leh notification</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setDecliningCreator(null)}
                  className="text-slate-400 hover:text-slate-600 transition p-1 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Applicant Preview Card */}
              <div className="p-3 bg-rose-50/70 rounded-2xl border border-rose-200 text-xs text-rose-950 space-y-1">
                <div className="flex justify-between items-center">
                  <span className="font-black text-sm">{decliningCreator.name}</span>
                  <span className="font-mono font-bold text-rose-800">{decliningCreator.phone}</span>
                </div>
                <p className="text-[11px] text-slate-600 font-medium">
                  {decliningCreator.designation || 'Applicant'} • {decliningCreator.orgName || 'No Organization'}
                </p>
              </div>

              {/* Quick Preset Reasons */}
              <div className="space-y-1.5">
                <label className="text-[10.5px] font-extrabold text-slate-700 uppercase">Quick Decline Reasons (Hnawlna Chhan)</label>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    'ID / Document lehkha a fiah lo / a dik lo',
                    'Phone number biak tlang theih loh / fiah lo',
                    'Kohhran / Pawl authorization lehkha kim lo',
                    'UPI ID / Payment details a dik lo',
                    'Duplicate application / Account a awm sa'
                  ].map(reason => (
                    <button
                      key={reason}
                      type="button"
                      onClick={() => setDeclineReasonText(reason)}
                      className={`text-[10.5px] px-2.5 py-1 rounded-lg font-bold border transition text-left cursor-pointer ${
                        declineReasonText === reason
                          ? 'bg-rose-600 text-white border-rose-600'
                          : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-rose-50 hover:text-rose-900'
                      }`}
                    >
                      {reason}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Reason Textarea */}
              <div className="space-y-1">
                <label className="text-[10.5px] font-extrabold text-slate-700 uppercase">Reason Details (Mizo / English)</label>
                <textarea
                  rows={3}
                  value={declineReasonText}
                  onChange={(e) => setDeclineReasonText(e.target.value)}
                  placeholder="Applicant hnen a hriattir tur chhan ziak rawh..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:border-rose-600 focus:outline-none"
                />
              </div>

              {/* Block Option */}
              <label className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isBlockCreatorOnDecline}
                  onChange={(e) => setIsBlockCreatorOnDecline(e.target.checked)}
                  className="w-4 h-4 text-rose-600 rounded focus:ring-rose-500 cursor-pointer"
                />
                <span className="text-xs font-bold text-slate-700">He mobile number hi apply leh thei lo turin Block nghal rawh</span>
              </label>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setDecliningCreator(null)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeclineCreator}
                  className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-xl text-xs transition shadow-md shadow-rose-200 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <X className="w-4 h-4" /> Confirm Decline
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
                  onClick={() => resettingPasswordCreator && handleResetPasswordConfirm(resettingPasswordCreator, newCreatorPassword)}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-black py-2.5 rounded-xl text-xs transition shadow-md shadow-indigo-200 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-4 h-4" /> Save New Credentials
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Campaign Delete Confirmation Dialog */}
        {deleteConfirmCamp && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fadeIn">
            <div className="bg-white w-full max-w-md rounded-2xl p-5 shadow-2xl border border-slate-200 space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2 text-rose-600">
                  <div className="w-9 h-9 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center">
                    <Trash2 className="w-5 h-5 text-rose-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900">Campaign Tihboral / Delete Rawh</h3>
                    <p className="text-[11px] text-slate-500 font-mono">ID: {deleteConfirmCamp.camp.id}</p>
                  </div>
                </div>
                <button
                  onClick={() => setDeleteConfirmCamp(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Target Details */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                <div className="flex justify-between items-start">
                  <h4 className="text-xs font-black text-slate-900 line-clamp-2">{deleteConfirmCamp.camp.title}</h4>
                  <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 shrink-0 ml-2">
                    {deleteConfirmCamp.camp.category || 'Bawm'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600">
                  Creator: <strong>{deleteConfirmCamp.camp.orgName || deleteConfirmCamp.camp.createdBy || 'Admin'}</strong>
                </p>
              </div>

              {/* Financial Status Info */}
              {deleteConfirmCamp.collected > 0 || deleteConfirmCamp.hasTxns ? (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs space-y-2">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="font-extrabold text-amber-900">
                        Sum chhun luh: ₹{deleteConfirmCamp.collected.toLocaleString('en-IN')} awm tawh
                      </p>
                      <p className="text-[11px] text-amber-800 leading-relaxed">
                        He campaign hian transactions a neih tawh avangin financial audit trail him nan <strong>Archived / Cancelled</strong>-ah dah a ni ang a, ledger a him ang.
                      </p>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 pt-1 border-t border-amber-200/60 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={deleteConfirmCamp.force}
                      onChange={(e) => setDeleteConfirmCamp({ ...deleteConfirmCamp, force: e.target.checked })}
                      className="w-4 h-4 rounded text-rose-600 border-amber-300 focus:ring-rose-500"
                    />
                    <span className="text-[11px] font-bold text-rose-800">
                      Admin Force Hard Delete (Database atangin paih hlen rawh)
                    </span>
                  </label>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <p className="text-[11px]">
                    Pawisa chhun luh a la awm lo (₹0 collected). Database atangin hlum zui lovin <strong>a bo hlen nghal ang</strong>.
                  </p>
                </div>
              )}

              {/* Reason Input */}
              <div className="space-y-1">
                <label className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider">
                  Tihtawp / Delete chhan (Reason)
                </label>
                <input
                  type="text"
                  value={deleteConfirmCamp.reason}
                  onChange={(e) => setDeleteConfirmCamp({ ...deleteConfirmCamp, reason: e.target.value })}
                  placeholder="Entirnan: Siam sual palh / Creator ngenna / Test campaign..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:border-rose-500 focus:outline-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmCamp(null)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl text-xs transition cursor-pointer"
                >
                  Thulh Leh Rawh
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (onDeleteCampaign) {
                      const reason = deleteConfirmCamp.reason.trim() || 'Admin action';
                      const force = deleteConfirmCamp.force || deleteConfirmCamp.collected === 0;
                      onDeleteCampaign(deleteConfirmCamp.camp.id, reason, force);
                      setCampaignActionToast(`Campaign "${deleteConfirmCamp.camp.title}" chu hlawhtling takin delete a ni e.`);
                      setDeleteConfirmCamp(null);
                      setLogsList(getStoredAuditLogs());
                      setTimeout(() => setCampaignActionToast(null), 4000);
                    }
                  }}
                  className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-black py-2.5 rounded-xl text-xs transition shadow-md shadow-rose-200 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete Rawh</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* SECTION PRESET MANAGER MODAL (Admin Full Setup & Control) */}
        <SectionPresetManagerModal
          isOpen={isSectionPresetModalOpen}
          onClose={() => setIsSectionPresetModalOpen(false)}
          onApplyPreset={(preset) => {
            if (editingCampaign) {
              setEditingCampaign({
                ...editingCampaign,
                sectionLabel: preset.label,
                definedSections: [...preset.sections]
              });
            }
          }}
          currentSections={editingCampaign?.definedSections}
          currentLabel={editingCampaign?.sectionLabel}
          isAdmin={true}
        />

      </div>
    </div>
  );
};
