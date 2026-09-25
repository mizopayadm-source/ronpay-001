import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ScreenId,
  BawmCategory,
  Campaign,
  Transaction,
  CreatorProfile,
  SystemPricingConfig,
  AnnouncementBanner,
  AuditLog,
  MemberRecord,
  BillService,
} from './types';
import { Language, getCampaignCauseTitle } from './utils/translations';
import { canHardDeleteCampaign } from './utils/campaignSafety';
import {
  getStoredCampaigns,
  saveStoredCampaigns,
  saveCampaign,
  getStoredTransactions,
  saveStoredTransactions,
  deleteStoredCampaign,
  getStoredCreatorProfile,
  saveStoredCreatorProfile,
  logoutCreator,
  loginCreator,
  GUEST_CREATOR_PROFILE,
  getStoredCreatorsList,
  saveStoredCreatorsList,
  getStoredPricingConfig,
  saveStoredPricingConfig,
  getStoredAnnouncement,
  saveStoredAnnouncement,
  getStoredAuditLogs,
  saveStoredAuditLogs,
  getMembers,
  saveMembers,
  saveTransaction,
  deleteStoredTransaction,
  recordUserPaidTxId,
  recordAuditLog,
  restoreFullDatabaseBackup,
  isUserPaidTransaction,
  getUserOrCreatorVisibleTransactions,
  getStoredUserPaidTxIds,
  isCampaignCreator,
  ensureCampaignImagesOptimizedAndSynced,
} from './utils/storage';
import {
  initFirestoreRealtimeSync,
  stopAllFirestoreListeners,
  pushAllLocalDataToFirestore,
  deleteCampaignFromFirestore,
  deleteTransactionFromFirestore,
  syncCampaignToFirestore,
  syncCreatorToFirestore,
  syncPricingConfigToFirestore,
  syncAnnouncementToFirestore,
  forceRefreshFirestore,
} from './services/firestoreSync';
import {
  subscribeCrossTabSync,
  setupWindowFocusSync,
  invalidateCacheOnAuthOrBoot
} from './services/crossTabSync';
import { syncAllWithServer } from './utils/syncEngine';

// Components
import { Header } from './components/Header';
import { HomeScreen } from './components/HomeScreen';
import { BawmExplorerScreen } from './components/BawmExplorerScreen';
import { CheckoutScreen } from './components/CheckoutScreen';
import { CreateQRScreen } from './components/CreateQRScreen';
import { CreatorRegScreen } from './components/CreatorRegScreen';
import { ReportsScreen } from './components/ReportsScreen';
import { SuccessScreen } from './components/SuccessScreen';
import { FailedScreen } from './components/FailedScreen';
import { CashPendingScreen } from './components/CashPendingScreen';
import { PhonePeStandardCheckout } from './components/PhonePeStandardCheckout';
import { PhonePeLauncherScreen } from './components/PhonePeLauncherScreen';
import { OfflineStatusBanner } from './components/OfflineStatusBanner';
import { BottomNav } from './components/BottomNav';

// Modals
import { QRScannerModal } from './components/QRScannerModal';
import { QRShareModal } from './components/QRShareModal';
import { GeneratedQRModal } from './components/GeneratedQRModal';
import { ProfileModal } from './components/ProfileModal';
import { PeknaSulhnuModal } from './components/PeknaSulhnuModal';
import { PhonePeModal } from './components/PhonePeModal';
import { BillPaymentModal } from './components/BillPaymentModal';
import { AdminDashboardModal } from './components/AdminDashboardModal';
import { AdminApprovalModal } from './components/AdminApprovalModal';
import { KumtluangMemberManagerModal } from './components/KumtluangMemberManagerModal';
import { MemberRollPreviewModal, PreviewReportFormat } from './components/MemberRollPreviewModal';
import { MismatchModal } from './components/MismatchModal';
import { UpgradeModal } from './components/UpgradeModal';
import { BiometricAuthModal } from './components/BiometricAuthModal';
import { Fingerprint } from 'lucide-react';
import { ExternalUPILandingModal } from './components/ExternalUPILandingModal';
import { ImagePreviewModal } from './components/ImagePreviewModal';
import { PrintPreviewModal } from './components/PrintPreviewModal';
import { AIHriatpuiModal } from './components/AIHriatpuiModal';
import { BankTransferModal } from './components/BankTransferModal';
import { RonPayWalletModal } from './components/RonPayWalletModal';
import { SmartLoginModal } from './components/SmartLoginModal';
import { NotificationsModal } from './components/NotificationsModal';
import { SplashScreen } from './components/SplashScreen';
import { ErrorBoundary } from './components/ErrorBoundary';
import { RonPayWebsite } from './components/RonPayWebsite';
import { getUrlRoute, updateBrowserUrl, updateBrowserView, isAndroidOrMobileApp, cleanPaymentUrlParams, markReceiptAsConsumed, isReceiptConsumed } from './utils/urlRouting';
import { checkDirectPhonePeStatus, getPhonePeMercuryUrl } from './utils/phonepeDirect';

export default function App() {
  // Splash screen state for smooth UX
  const [showSplash, setShowSplash] = useState<boolean>(true);
  const handleFinishSplash = useCallback(() => {
    setShowSplash(false);
  }, []);

  // Extract initial deep link routing parameters from URL (e.g. Google Lens, Camera, Web link)
  const initialRoute = typeof window !== 'undefined' ? getUrlRoute() : null;

  // View Mode: On Android Mobile App / WebViews, default directly to 'app' (Zero website detour). On Desktop, default to 'website'
  const [appView, setAppView] = useState<'website' | 'app'>(() => {
    if (initialRoute?.view) return initialRoute.view;
    return isAndroidOrMobileApp() ? 'app' : 'website';
  });

  // Navigation & View States
  // When a receipt verification is in the URL, wait for authoritative backend status check in applyRouteFromUrl before switching screens
  const [currentScreen, setCurrentScreen] = useState<ScreenId>(() => {
    if (initialRoute?.receiptId) return 'home';
    return initialRoute?.screen || 'home';
  });
  const [selectedCategory, setSelectedCategory] = useState<BawmCategory>(() => initialRoute?.category || 'ralna');
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(() => initialRoute?.campaign || null);
  const [completedTransaction, setCompletedTransaction] = useState<Transaction | null>(null);
  const [failedTransaction, setFailedTransaction] = useState<Transaction | null>(null);

  const [failureReason, setFailureReason] = useState<string | undefined>(() => initialRoute?.failureReason);
  const [isDesktopView, setIsDesktopView] = useState<boolean>(false);
  const [language, setLanguage] = useState<Language>('mizo');
  const [notificationCount, setNotificationCount] = useState<number>(3);

  // App Core Data States
  const [campaigns, setCampaigns] = useState<Campaign[]>(() => getStoredCampaigns());
  const [transactions, setTransactions] = useState<Transaction[]>(() => getStoredTransactions());
  const [creators, setCreators] = useState<CreatorProfile[]>(() => getStoredCreatorsList());
  const [creatorProfile, setCreatorProfile] = useState<CreatorProfile>(() => getStoredCreatorProfile());
  const [pricingConfig, setPricingConfig] = useState<SystemPricingConfig>(() => getStoredPricingConfig());
  const [announcement, setAnnouncement] = useState<AnnouncementBanner>(() => getStoredAnnouncement());
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => getStoredAuditLogs());
  const [members, setMembersState] = useState<MemberRecord[]>(() => getMembers());
  const [userPaidIds, setUserPaidIds] = useState<string[]>(() => getStoredUserPaidTxIds());

  // Modals Visibility
  const [isAIHriatpuiOpen, setIsAIHriatpuiOpen] = useState<boolean>(false);
  const [isScannerOpen, setIsScannerOpen] = useState<boolean>(false);

  const [scannerCategory, setScannerCategory] = useState<BawmCategory | 'any'>('any');
  const [isShareModalOpen, setIsShareModalOpen] = useState<boolean>(false);
  const [shareCampaign, setShareCampaign] = useState<Campaign | null>(null);
  const [isGeneratedQROpen, setIsGeneratedQROpen] = useState<boolean>(false);
  const [generatedQRCampaign, setGeneratedQRCampaign] = useState<Campaign | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState<boolean>(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);
  const [isWalletOpen, setIsWalletOpen] = useState<boolean>(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState<boolean>(false);
  const [isBankTransferOpen, setIsBankTransferOpen] = useState<boolean>(false);
  const [isPhonePeOpen, setIsPhonePeOpen] = useState<boolean>(false);
  const [autoOpenPhonePeCheckout, setAutoOpenPhonePeCheckout] = useState<boolean>(() => Boolean(initialRoute?.isPhonePeOpen && initialRoute?.campaign?.customAmount));
  const [phonePeCheckoutAmount, setPhonePeCheckoutAmount] = useState<number>(() => {
    if (initialRoute?.campaign?.customAmount && initialRoute.campaign.customAmount > 0) {
      return initialRoute.campaign.customAmount;
    }
    return 0;
  });
  const [isBillModalOpen, setIsBillModalOpen] = useState<boolean>(false);
  const [selectedBillService, setSelectedBillService] = useState<BillService | null>(null);
  const [isAdminDashboardOpen, setIsAdminDashboardOpen] = useState<boolean>(false);
  const [isAdminApprovalOpen, setIsAdminApprovalOpen] = useState<boolean>(false);
  const [adminApprovalCampaign, setAdminApprovalCampaign] = useState<Campaign | null>(null);
  const [isKumtluangManagerOpen, setIsKumtluangManagerOpen] = useState<boolean>(false);
  const [kumtluangInitialTab, setKumtluangInitialTab] = useState<'quick_entry' | 'register_member' | 'members_list' | 'print_reports'>('members_list');
  const [kumtluangInitialCampaignId, setKumtluangInitialCampaignId] = useState<string | undefined>(undefined);
  const [isMemberRollPreviewOpen, setIsMemberRollPreviewOpen] = useState<boolean>(false);
  const [memberRollPreviewParams, setMemberRollPreviewParams] = useState<{
    format?: PreviewReportFormat;
    campaignId?: string;
    memberId?: string;
  }>({});
  const [isMismatchModalOpen, setIsMismatchModalOpen] = useState<boolean>(false);
  const [mismatchCategory, setMismatchCategory] = useState<BawmCategory | null>(null);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState<boolean>(false);
  const [isBiometricModalOpen, setIsBiometricModalOpen] = useState<boolean>(false);
  const [biometricTarget, setBiometricTarget] = useState<'sulhnu' | 'profile' | 'general' | 'creator_studio' | 'admin_action'>('general');
  const [biometricTitle, setBiometricTitle] = useState<string | undefined>(undefined);
  const [biometricSubtitle, setBiometricSubtitle] = useState<string | undefined>(undefined);
  const [biometricCallback, setBiometricCallback] = useState<(() => void) | null>(null);
  const [isCreatorStudioUnlocked, setIsCreatorStudioUnlocked] = useState<boolean>(false);
  const [isExternalUPIOpen, setIsExternalUPIOpen] = useState<boolean>(false);
  const [externalUPICampaign, setExternalUPICampaign] = useState<Campaign | null>(null);
  const [imagePreviewData, setImagePreviewData] = useState<{
    url: string | null;
    title?: string;
    subtitle?: string;
    location?: string;
  }>({ url: null });
  const [printPreviewData, setPrintPreviewData] = useState<{
    isOpen: boolean;
    html?: string;
    docTitle?: string;
    fileName?: string;
  }>({ isOpen: false });

  // Biometric toggle state
  const [biometricEnabled, setBiometricEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem('ronpay_biometric_enabled') === 'true';
    } catch {
      return false;
    }
  });

  // Maintain campaignsRef to stabilize URL routing without re-triggering popstate effects
  const campaignsRef = useRef<Campaign[]>(campaigns);
  useEffect(() => {
    campaignsRef.current = campaigns;
  }, [campaigns]);

  // Reload helper
  const reloadLocalData = useCallback(() => {
    const freshCampaigns = getStoredCampaigns();
    campaignsRef.current = freshCampaigns;
    setCampaigns(freshCampaigns);
    setTransactions(getStoredTransactions());
    setCreators(getStoredCreatorsList());
    setCreatorProfile(getStoredCreatorProfile());
    setPricingConfig(getStoredPricingConfig());
    setAnnouncement(getStoredAnnouncement());
    setAuditLogs(getStoredAuditLogs());
    setMembersState(getMembers());
    setUserPaidIds(getStoredUserPaidTxIds());
  }, []);

  // Cache Invalidation & Automatic Server Sync on Auth / Session Boot:
  // Cleanly purge stale in-memory session guards and ensure fresh initial state across all tabs
  useEffect(() => {
    invalidateCacheOnAuthOrBoot('session_boot');
    reloadLocalData();
    syncAllWithServer().then(() => {
      reloadLocalData();
    }).catch(() => {});
  }, [reloadLocalData]);

  // Real-time Firestore Sync initialization
  useEffect(() => {
    const unsub = initFirestoreRealtimeSync({
      onCampaignsUpdate: (updatedCampaigns) => {
        if (updatedCampaigns && updatedCampaigns.length > 0) {
          setCampaigns(updatedCampaigns);
        }
      },
      onTransactionsUpdate: (updatedTransactions) => {
        if (updatedTransactions && updatedTransactions.length > 0) {
          setTransactions(updatedTransactions);
        }
      },
      onMembersUpdate: (updatedMembers) => {
        if (updatedMembers && updatedMembers.length > 0) {
          setMembersState(updatedMembers);
        }
      },
      onCreatorsUpdate: (updatedCreators) => {
        if (updatedCreators && updatedCreators.length > 0) {
          setCreators(updatedCreators);
          const current = getStoredCreatorProfile();
          if (current && current.phone) {
            const matched = updatedCreators.find(c => c.phone === current.phone);
            if (matched) {
              setCreatorProfile(matched);
            }
          }
        }
      },
      onAnnouncementUpdate: (updatedAnn) => {
        if (updatedAnn) {
          setAnnouncement(updatedAnn);
        }
      },
      onPricingConfigUpdate: (updatedPricing) => {
        if (updatedPricing) {
          setPricingConfig(updatedPricing);
        }
      },
      onAuditLogsUpdate: (updatedLogs) => {
        if (updatedLogs && updatedLogs.length > 0) {
          setAuditLogs(updatedLogs);
        }
      },
    });

    const handleBeforeUnload = () => {
      stopAllFirestoreListeners();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      unsub();
    };
  }, []);

  // Real-time Local & Storage Live Sync across all components, preview and multi-tabs
  useEffect(() => {
    const handleCampaignsSync = (e: Event) => {
      const customEvent = e as CustomEvent<Campaign[]>;
      if (customEvent.detail && Array.isArray(customEvent.detail)) {
        setCampaigns(customEvent.detail);
      } else {
        setCampaigns(getStoredCampaigns());
      }
    };

    const handleTransactionsSync = (e: Event) => {
      const customEvent = e as CustomEvent<Transaction[]>;
      if (customEvent.detail && Array.isArray(customEvent.detail)) {
        setTransactions(customEvent.detail);
      } else {
        setTransactions(getStoredTransactions());
      }
    };

    const handleCreatorSync = (e: Event) => {
      const customEvent = e as CustomEvent<CreatorProfile>;
      if (customEvent.detail && typeof customEvent.detail === 'object') {
        setCreatorProfile(customEvent.detail);
      } else {
        setCreatorProfile(getStoredCreatorProfile());
      }
    };

    const handleCreatorsListSync = (e: Event) => {
      const customEvent = e as CustomEvent<CreatorProfile[]>;
      if (customEvent.detail && Array.isArray(customEvent.detail)) {
        setCreators(customEvent.detail);
      } else {
        setCreators(getStoredCreatorsList());
      }
    };

    const handleMembersSync = (e: Event) => {
      const customEvent = e as CustomEvent<MemberRecord[]>;
      if (customEvent.detail && Array.isArray(customEvent.detail)) {
        setMembersState(customEvent.detail);
      } else {
        setMembersState(getMembers());
      }
    };

    const handleUserPaidSync = (e: Event) => {
      const customEvent = e as CustomEvent<string[]>;
      if (customEvent.detail && Array.isArray(customEvent.detail)) {
        setUserPaidIds(customEvent.detail);
      } else {
        setUserPaidIds(getStoredUserPaidTxIds());
      }
    };

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'ronpay_campaigns' || e.key === 'ronpay_campaigns_v2') {
        setCampaigns(getStoredCampaigns());
      } else if (e.key === 'ronpay_transactions' || e.key === 'ronpay_transactions_v2') {
        setTransactions(getStoredTransactions());
      } else if (e.key === 'ronpay_creator_profile_v2' || e.key === 'ronpay_creator_profile') {
        setCreatorProfile(getStoredCreatorProfile());
      } else if (e.key === 'ronpay_creators_list_v2' || e.key === 'ronpay_registered_creators_v1') {
        setCreators(getStoredCreatorsList());
      } else if (e.key === 'ronpay_kumtluang_members_v1') {
        setMembersState(getMembers());
      } else if (e.key && e.key.includes('ronpay_user_paid_tx_ids')) {
        setUserPaidIds(getStoredUserPaidTxIds());
      }
    };

    window.addEventListener('ronpay_campaigns_updated', handleCampaignsSync);
    window.addEventListener('ronpay-campaigns-updated', handleCampaignsSync);
    window.addEventListener('ronpay_transactions_updated', handleTransactionsSync);
    window.addEventListener('ronpay-transactions-updated', handleTransactionsSync);
    window.addEventListener('ronpay_user_paid_updated', handleUserPaidSync);
    window.addEventListener('ronpay-creator-updated', handleCreatorSync);
    window.addEventListener('ronpay_creator_profile_updated', handleCreatorSync);
    window.addEventListener('ronpay_creators_updated', handleCreatorsListSync);
    window.addEventListener('ronpay-members-updated', handleMembersSync);
    window.addEventListener('ronpay_members_updated', handleMembersSync);
    window.addEventListener('ronpay_data_synced', reloadLocalData);
    window.addEventListener('storage', handleStorageChange);

    // Cross-tab real-time state synchronization via BroadcastChannel ('ronpay_state_sync')
    // Instantly syncs state across windows/tabs on write actions WITHOUT hitting Firestore
    const unsubCrossTab = subscribeCrossTabSync((msg) => {
      if (msg.topic === 'campaigns') {
        const fresh = getStoredCampaigns();
        campaignsRef.current = fresh;
        setCampaigns(fresh);
      } else if (msg.topic === 'transactions') {
        setTransactions(getStoredTransactions());
      } else if (msg.topic === 'creator_profile') {
        setCreatorProfile(getStoredCreatorProfile());
      } else if (msg.topic === 'creators') {
        setCreators(getStoredCreatorsList());
      } else if (msg.topic === 'members') {
        setMembersState(getMembers());
      } else if (msg.topic === 'pricing_config') {
        setPricingConfig(getStoredPricingConfig());
      } else if (msg.topic === 'announcement') {
        setAnnouncement(getStoredAnnouncement());
      } else if (msg.topic === 'audit_logs') {
        setAuditLogs(getStoredAuditLogs());
      } else if (msg.topic === 'user_paid') {
        setUserPaidIds(getStoredUserPaidTxIds());
      } else if (msg.topic === 'auth') {
        invalidateCacheOnAuthOrBoot(msg.action === 'auth_login' ? 'auth_login' : 'auth_logout');
        reloadLocalData();
      } else {
        reloadLocalData();
      }
    });

    // Window Focus / Tab Re-activation Refetch:
    // Performs a light check or invalidates stale localStorage/in-memory cache
    // to sync the latest state whenever the user switches back to the tab or opens a new window.
    const unsubFocus = setupWindowFocusSync(() => {
      reloadLocalData();
    });

    // Load local storage immediately on startup without background polling
    reloadLocalData();

    return () => {
      unsubCrossTab();
      unsubFocus();
      window.removeEventListener('ronpay_campaigns_updated', handleCampaignsSync);
      window.removeEventListener('ronpay-campaigns-updated', handleCampaignsSync);
      window.removeEventListener('ronpay_transactions_updated', handleTransactionsSync);
      window.removeEventListener('ronpay-transactions-updated', handleTransactionsSync);
      window.removeEventListener('ronpay_user_paid_updated', handleUserPaidSync);
      window.removeEventListener('ronpay-creator-updated', handleCreatorSync);
      window.removeEventListener('ronpay_creator_profile_updated', handleCreatorSync);
      window.removeEventListener('ronpay_creators_updated', handleCreatorsListSync);
      window.removeEventListener('ronpay-members-updated', handleMembersSync);
      window.removeEventListener('ronpay_members_updated', handleMembersSync);
      window.removeEventListener('ronpay_data_synced', reloadLocalData);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [reloadLocalData]);

  // Force cloud refresh across Firestore and Server Database
  const handleRefreshCloudData = useCallback(async () => {
    try {
      const firestoreTxs = await forceRefreshFirestore();
      if (firestoreTxs && firestoreTxs.length > 0) {
        setTransactions(firestoreTxs);
      }
      const syncResult = await syncAllWithServer();
      if (syncResult?.transactions && syncResult.transactions.length > 0) {
        setTransactions(syncResult.transactions);
      }
      if (syncResult?.campaigns && syncResult.campaigns.length > 0) {
        setCampaigns(syncResult.campaigns);
      }
      reloadLocalData();
    } catch (e) {
      console.warn('Cloud refresh note:', e);
    }
  }, [reloadLocalData]);

  // Apply route from current browser URL (for Google Lens, QR scans, and browser Back/Forward navigation)
  const applyRouteFromUrl = useCallback(async () => {
    const route = getUrlRoute();
    if (!route) return;

    if (route.view) {
      setAppView(route.view);
    }
    if (route.campaign) {
      setSelectedCampaign(route.campaign);
      setSelectedCategory(route.category || route.campaign.category);
    }
    if (route.category && !route.campaign) {
      setSelectedCategory(route.category);
    }
    if (route.isPhonePeOpen && route.campaign?.customAmount && currentScreenRef.current === 'checkout') {
      setAutoOpenPhonePeCheckout(true);
      setPhonePeCheckoutAmount(route.campaign.customAmount);
    } else {
      setAutoOpenPhonePeCheckout(false);
      setPhonePeCheckoutAmount(route.campaign?.customAmount || 0);
    }

    if (route.isMemberRollOpen) {
      setKumtluangInitialCampaignId(route.memberRollCampaignId);
      setKumtluangInitialTab('members_list');
      setIsKumtluangManagerOpen(true);
    }
    if (route.isSulhnuOpen) {
      setIsHistoryOpen(true);
    }
    if (route.isAdminOpen) {
      setIsAdminDashboardOpen(true);
    }
    if (route.isWalletOpen) {
      setIsWalletOpen(true);
    }
    if (route.isDirectPhonePeLaunch || route.screen === 'phonepe_launcher') {
      setCurrentScreen('phonepe_launcher');
      setAppView('app');
      setPhonePeCheckoutAmount(route.phonePeLaunchAmount || 100);
      return;
    }
    if (route.isPhonePeOpen && !route.receiptId) {
      // Direct payment link or /phonepe route: select campaign and show checkout (without popup auto-spawning)
      const stored = getStoredCampaigns();
      const targetCamp = route.campaign || campaignsRef.current[0] || stored[0];
      if (targetCamp) {
        setSelectedCampaign(targetCamp);
        setSelectedCategory(targetCamp.category);
      }
      setCurrentScreen('checkout');
      setAppView('app');
      return;
    }

    // If NO receiptId is present, we can apply route.screen directly
    if (!route.receiptId) {
      if (route.screen) {
        setCurrentScreen(route.screen);
      }
      return;
    }

    // Receipt verification flow:
    // IMPORTANT: Check if receipt was already consumed/acknowledged in this session
    const receiptId = route.receiptId;
    if (isReceiptConsumed(receiptId)) {
      // User has already viewed and navigated away from this receipt.
      // Clean payment parameters and do not reopen the receipt modal.
      if (currentScreenRef.current !== 'success') {
        cleanPaymentUrlParams();
        return;
      }
    }

    const txs = getStoredTransactions();
    const found = txs.find(t => t.id.toLowerCase() === receiptId.toLowerCase());

    const pendingRaw = localStorage.getItem(`RONPAY_PENDING_TX_${receiptId}`) || sessionStorage.getItem(`RONPAY_PENDING_TX_${receiptId}`);
    let parsedPending: Transaction | null = null;
    if (pendingRaw) {
      try {
        parsedPending = JSON.parse(pendingRaw);
      } catch (e) {}
    }

    try {
      const statusRes = await checkDirectPhonePeStatus(receiptId);

      const isConfirmedFailed =
        statusRes.isFailed ||
        route.screen === 'failed';

      const isConfirmedSuccess =
        statusRes.isSuccess ||
        (!statusRes.isFailed && (route.screen === 'success' || !route.screen || route.screen === 'home'));

      if (isConfirmedFailed) {
        deleteStoredTransaction(receiptId);
        setCompletedTransaction(null);
        const resolvedReason = statusRes.reason || route.failureReason || 'PhonePe payment reported failed or cancelled';
        setFailureReason(resolvedReason);

        const meta = route.receiptMeta;
        const baseTx = found || parsedPending;
        const allCamps = [...campaignsRef.current, ...getStoredCampaigns()];
        const targetCampId = meta?.campaignId || baseTx?.campaignId || '';
        const matchedCamp = allCamps.find(c => c.id === targetCampId);

        const feeOption = (meta?.feeOption || baseTx?.feeOption || 'ADD_ON') as 'ADD_ON' | 'DEDUCT';
        const total = meta?.amount || baseTx?.totalAmount || 0;
        const fee = meta?.platformFee ?? baseTx?.platformFee ?? (total > 1 ? Math.max(1, Math.round(total * 0.01)) : 0);
        const base = baseTx?.amount || (feeOption === 'ADD_ON' || fee > 0 ? Math.max(1, total - fee) : total);

        const failedTx: Transaction = {
          id: receiptId,
          campaignId: targetCampId || matchedCamp?.id || 'cmp-custom',
          campaignTitle: (matchedCamp ? getCampaignCauseTitle(matchedCamp) : '') || baseTx?.campaignTitle || 'RonPay Community Bawm',
          donorName: baseTx?.donorName || (meta?.isAnonymous ? 'Anonymous' : (meta?.donorName || 'Valued Donor')),
          donorPhone: baseTx?.donorPhone || meta?.donorPhone,
          isAnonymous: Boolean(baseTx?.isAnonymous || meta?.isAnonymous),
          amount: base,
          platformFee: fee,
          totalAmount: total,
          category: (baseTx?.category || meta?.category || matchedCamp?.category || 'others') as any,
          paymentMethod: 'phonepe',
          status: 'failed',
          timestamp: baseTx?.timestamp || new Date().toISOString(),
          referenceNo: statusRes.transactionId || baseTx?.referenceNo || `T${Date.now()}`,
          feeOption: feeOption,
          campaignNetReceived: base
        };

        saveTransaction(failedTx);
        setFailedTransaction(failedTx);
        setTransactions(prev => [failedTx, ...prev.filter(t => t.id !== receiptId)]);
        setCurrentScreen('failed');
        setAppView('app');
        updateBrowserUrl('failed', null, null, { replace: true });
        try {
          if (typeof BroadcastChannel !== 'undefined') {
            const bc = new BroadcastChannel('ronpay_payment_channel');
            bc.postMessage({ type: 'PHONEPE_PAYMENT_FAILED', receiptId: receiptId, reason: resolvedReason });
          }
          localStorage.setItem('RONPAY_LAST_CONFIRMED_TXN', JSON.stringify({
            id: receiptId,
            status: 'PAYMENT_ERROR',
            timestamp: Date.now(),
            reason: resolvedReason
          }));
        } catch (e) {}
        return;
      }

      if (isConfirmedSuccess) {
        try {
          if (typeof BroadcastChannel !== 'undefined') {
            const bc = new BroadcastChannel('ronpay_payment_channel');
            bc.postMessage({ type: 'PHONEPE_PAYMENT_SUCCESS', receiptId: receiptId });
          }
          localStorage.setItem('RONPAY_LAST_CONFIRMED_TXN', JSON.stringify({
            id: receiptId,
            status: 'PAYMENT_SUCCESS',
            timestamp: Date.now()
          }));
          if (window.opener && !window.opener.closed) {
            window.opener.postMessage({ type: 'PHONEPE_PAYMENT_RESULT', status: 'PAYMENT_SUCCESS', receiptId: receiptId }, '*');
          }
        } catch (e) {}

        const meta = route.receiptMeta;
        const baseTx = found || parsedPending;

        const allCamps = [...campaignsRef.current, ...getStoredCampaigns()];
        const targetCampId = meta?.campaignId || baseTx?.campaignId || '';
        const matchedCamp = allCamps.find(c => c.id === targetCampId);

        const feeOption = (meta?.feeOption || baseTx?.feeOption || 'ADD_ON') as 'ADD_ON' | 'DEDUCT';

        const total = statusRes.amount || meta?.amount || baseTx?.totalAmount || (baseTx?.amount ? baseTx.amount : 0);

        let fee = 0;
        if (meta?.platformFee !== undefined && meta?.platformFee !== null) {
          fee = Number(meta.platformFee);
        } else if (baseTx?.platformFee !== undefined && baseTx?.platformFee !== null) {
          fee = Number(baseTx.platformFee);
        } else {
          fee = total > 1 ? Math.max(1, Math.round(total * 0.01)) : 0;
        }

        let base = 0;
        if (meta?.baseAmount !== undefined && meta?.baseAmount !== null && Number(meta.baseAmount) > 0) {
          base = Number(meta.baseAmount);
        } else if (baseTx?.amount !== undefined && baseTx?.amount !== null && Number(baseTx.amount) > 0) {
          base = Number(baseTx.amount);
        } else if (baseTx?.campaignNetReceived !== undefined && baseTx?.campaignNetReceived !== null && Number(baseTx.campaignNetReceived) > 0) {
          base = Number(baseTx.campaignNetReceived);
        } else {
          base = feeOption === 'ADD_ON' || fee > 0 ? Math.max(1, total - fee) : total;
        }

        const resolvedCampTitle = (matchedCamp ? getCampaignCauseTitle(matchedCamp) : '') ||
          baseTx?.campaignTitle ||
          (meta?.campaignTitle && meta.campaignTitle !== 'BCM Ebenezer' ? meta.campaignTitle : '') ||
          (meta?.category === 'ralna' || matchedCamp?.category === 'ralna' ? 'Lalrinpuii Ralna' : '') ||
          'RonPay Community Bawm';

        const verifiedTx: Transaction = {
          id: receiptId,
          campaignId: targetCampId || matchedCamp?.id || 'cmp-custom',
          campaignTitle: resolvedCampTitle,
          donorName: baseTx?.donorName || (meta?.isAnonymous ? 'Anonymous' : (meta?.donorName || 'Valued Donor')),
          donorPhone: baseTx?.donorPhone || meta?.donorPhone,
          isAnonymous: Boolean(baseTx?.isAnonymous || meta?.isAnonymous),
          amount: base,
          platformFee: fee,
          totalAmount: total,
          category: (baseTx?.category || meta?.category || matchedCamp?.category || 'others') as any,
          paymentMethod: 'phonepe',
          status: 'completed',
          timestamp: baseTx?.timestamp || new Date().toISOString(),
          referenceNo: statusRes.transactionId || baseTx?.referenceNo || `T${Date.now()}`,
          verifiedAt: new Date().toISOString(),
          feeOption: feeOption,
          campaignNetReceived: base,
          utr: statusRes.utr || baseTx?.utr || ('UTR' + Math.floor(100000000000 + Math.random() * 900000000000))
        };

        // Update local and application states authoritatively
        setCompletedTransaction(verifiedTx);
        saveTransaction(verifiedTx);
        recordUserPaidTxId(verifiedTx.id);
        setTransactions(prev => [verifiedTx, ...prev.filter(t => t.id !== verifiedTx.id)]);
        setCampaigns(getStoredCampaigns());
        setCurrentScreen('success');
        setAppView('app');
        updateBrowserUrl('success', null, null, { replace: true });
      }
    } catch (err) {
      console.warn('Authoritative status check failed, falling back to local records:', err);
      const baseTx = found || parsedPending;
      if (baseTx) {
        const verifiedTx: Transaction = {
          ...baseTx,
          status: 'completed',
          verifiedAt: new Date().toISOString()
        };
        setCompletedTransaction(verifiedTx);
        saveTransaction(verifiedTx);
        recordUserPaidTxId(verifiedTx.id);
        setTransactions(prev => [verifiedTx, ...prev.filter(t => t.id !== verifiedTx.id)]);
        setCurrentScreen('success');
        setAppView('app');
        updateBrowserUrl('success', null, null, { replace: true });
      } else if (found && found.status === 'failed') {
        setFailedTransaction(found);
        setCurrentScreen('failed');
        setAppView('app');
        updateBrowserUrl('failed', null, null, { replace: true });
      }
    }
  }, []);

  const currentScreenRef = useRef<ScreenId>(currentScreen);
  useEffect(() => {
    currentScreenRef.current = currentScreen;
  }, [currentScreen]);

  // Deep linking: Listen for popstate and hashchange to keep browser history synchronized
  useEffect(() => {
    const handlePopState = () => {
      // 1. If user was on success or failed screen, popping back from mobile/browser should navigate to home cleanly
      if (currentScreenRef.current === 'success' || currentScreenRef.current === 'failed') {
        if (completedTransaction?.id) {
          markReceiptAsConsumed(completedTransaction.id);
        }
        setCompletedTransaction(null);
        setFailedTransaction(null);
        setSelectedCampaign(null);
        setAutoOpenPhonePeCheckout(false);
        cleanPaymentUrlParams();
        setCurrentScreen('home');
        updateBrowserUrl('home', null, null, { replace: true });
        return;
      }

      // 1b. If user was on checkout, popping back from mobile/browser should navigate to home cleanly
      if (currentScreenRef.current === 'checkout' || currentScreenRef.current === 'phonepe_checkout') {
        setSelectedCampaign(null);
        setAutoOpenPhonePeCheckout(false);
        cleanPaymentUrlParams();
        setCurrentScreen('home');
        updateBrowserUrl('home', null, null, { replace: true });
        return;
      }

      // 2. Check the route the browser is popping into
      const poppedRoute = getUrlRoute();
      if (!poppedRoute) {
        setCurrentScreen('home');
        setSelectedCampaign(null);
        setAutoOpenPhonePeCheckout(false);
        return;
      }

      // If the popped route points to an already consumed/completed receipt, prevent re-opening the receipt
      if (poppedRoute.receiptId && isReceiptConsumed(poppedRoute.receiptId)) {
        setCurrentScreen('home');
        setSelectedCampaign(null);
        setAutoOpenPhonePeCheckout(false);
        cleanPaymentUrlParams();
        updateBrowserUrl('home', null, null, { replace: true });
        return;
      }

      // If popped route was a payment checkout or simulator URL and user is navigating back, stay on home cleanly
      if (poppedRoute.isPhonePeOpen || (poppedRoute.screen === 'checkout' && currentScreenRef.current !== 'checkout')) {
        setAutoOpenPhonePeCheckout(false);
        cleanPaymentUrlParams();
        setCurrentScreen('home');
        updateBrowserUrl('home', null, null, { replace: true });
        return;
      }

      applyRouteFromUrl();
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('hashchange', handlePopState);

    // Run on initial mount
    applyRouteFromUrl();

    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('hashchange', handlePopState);
    };
  }, [applyRouteFromUrl]);

  // Keep selectedCampaign synchronized if campaign record updates via Firestore or local merge
  useEffect(() => {
    if (selectedCampaign && campaigns.length > 0) {
      const matched = campaigns.find(c => c.id.toLowerCase() === selectedCampaign.id.toLowerCase());
      if (matched && (
        matched.status !== selectedCampaign.status ||
        matched.title !== selectedCampaign.title ||
        matched.targetAmount !== selectedCampaign.targetAmount ||
        matched.upiId !== selectedCampaign.upiId
      )) {
        setSelectedCampaign(matched);
      }
    }
  }, [campaigns, selectedCampaign]);

  // Handlers for Navigation
  const handleNavigate = (screen: ScreenId, options: { replace?: boolean } = { replace: false }) => {
    // Biometric Security Gate for Creator Studio
    if (screen === 'create_qr') {
      if (!creatorProfile.isApproved || !creatorProfile.phone) {
        handleNavigate('creator_reg', options);
        return;
      }

      if (!isCreatorStudioUnlocked) {
        setBiometricTarget('creator_studio');
        setBiometricTitle('Creator Studio Security Access');
        setBiometricSubtitle(`${creatorProfile.name || 'Creator'} Studio luh nan Fingerprint / Face ID emaw PIN hmangin verify rawh le.`);
        setBiometricCallback(() => () => {
          setIsCreatorStudioUnlocked(true);
          setCurrentScreen('create_qr');
          updateBrowserUrl('create_qr', null, null, options);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        });
        setIsBiometricModalOpen(true);
        return;
      }
    }

    // Leaving checkout or receipt: always disarm auto checkout simulator
    if (screen !== 'checkout' && screen !== 'phonepe_checkout') {
      setAutoOpenPhonePeCheckout(false);
    }

    if (screen === 'home') {
      if (completedTransaction?.id) {
        markReceiptAsConsumed(completedTransaction.id);
      }
      setSelectedCampaign(null);
      setCompletedTransaction(null);
      setFailedTransaction(null);
      setAutoOpenPhonePeCheckout(false);
      cleanPaymentUrlParams();
      setCurrentScreen('home');
      updateBrowserUrl('home', null, null, { replace: true });
    } else if (screen === 'explorer') {
      if (completedTransaction?.id) {
        markReceiptAsConsumed(completedTransaction.id);
      }
      setCompletedTransaction(null);
      setFailedTransaction(null);
      setAutoOpenPhonePeCheckout(false);
      setCurrentScreen('explorer');
      updateBrowserUrl('explorer', null, selectedCategory, options);
    } else if (screen === 'checkout' && selectedCampaign) {
      setCurrentScreen('checkout');
      updateBrowserUrl('checkout', selectedCampaign, selectedCampaign.category, options);
    } else {
      if (screen !== 'success') {
        if (completedTransaction?.id) {
          markReceiptAsConsumed(completedTransaction.id);
        }
        setCompletedTransaction(null);
        setFailedTransaction(null);
        setAutoOpenPhonePeCheckout(false);
      }
      setCurrentScreen(screen);
      updateBrowserUrl(screen, null, null, options);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectBawm = (category: BawmCategory) => {
    setSelectedCategory(category);
    updateBrowserUrl('explorer', null, category);
    setCurrentScreen('explorer');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectCampaign = (campaign: Campaign, forceAutoOpenPayment: boolean = false) => {
    setSelectedCampaign(campaign);
    setSelectedCategory(campaign.category);
    const hasPresetAmount = Boolean(campaign.customAmount && campaign.customAmount > 0);
    if (forceAutoOpenPayment && hasPresetAmount) {
      setAutoOpenPhonePeCheckout(true);
      setPhonePeCheckoutAmount(campaign.customAmount || 0);
    } else {
      setAutoOpenPhonePeCheckout(false);
      setPhonePeCheckoutAmount(campaign.customAmount || 0);
    }
    updateBrowserUrl('checkout', campaign, campaign.category);
    setCurrentScreen('checkout');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleStartScanner = (category?: BawmCategory | 'any') => {
    setScannerCategory(category || 'any');
    setIsScannerOpen(true);
  };

  const handleOpenReports = () => {
    handleNavigate('reports');
  };

  const handleOpenNotifications = () => {
    setNotificationCount(0);
    setIsNotificationsOpen(true);
  };

  const handleOpenHistory = () => {
    setIsHistoryOpen(true);
  };

  const handleOpenBillService = (service: BillService) => {
    setSelectedBillService(service);
    setIsBillModalOpen(true);
  };

  const handleBillPaymentComplete = (amount: number, serviceName: string) => {
    const newTx: Transaction = {
      id: `BILL-${Date.now().toString().slice(-6)}`,
      campaignId: `bill-${serviceName.toLowerCase().replace(/\s+/g, '-')}`,
      campaignTitle: `${serviceName} Payment`,
      category: 'others',
      donorName: creatorProfile.name || 'RonPay User',
      donorPhone: creatorProfile.phone || '9862300000',
      amount,
      platformFee: 0,
      totalAmount: amount,
      paymentMethod: 'online',
      status: 'completed',
      remark: `Instant BBPS settlement for ${serviceName}`,
      timestamp: new Date().toISOString(),
      txHash: `RPAY${Date.now()}`,
    };
    saveTransaction(newTx);
    recordUserPaidTxId(newTx.id);
    setCompletedTransaction(newTx);
    reloadLocalData();
    setIsBillModalOpen(false);
    handleNavigate('success', { replace: true });
  };

  const handlePaymentSuccess = (transaction: Transaction) => {
    saveTransaction(transaction);
    recordUserPaidTxId(transaction.id);
    setCompletedTransaction(transaction);
    reloadLocalData();
    handleNavigate('success', { replace: true });
  };

  const handlePaymentFailure = (transaction: Transaction, reason?: string) => {
    setAutoOpenPhonePeCheckout(false);
    setFailedTransaction(transaction);
    setFailureReason(reason);
    setCurrentScreen('failed');
    updateBrowserUrl('failed', selectedCampaign, selectedCategory);
  };

  const handleCashPending = (transaction: Transaction) => {
    saveTransaction(transaction);
    recordUserPaidTxId(transaction.id);
    setCompletedTransaction(transaction);
    reloadLocalData();
    handleNavigate('cash_pending');
  };

  const handleGenerateQR = (campaign: Campaign) => {
    saveCampaign(campaign);
    setCampaigns(getStoredCampaigns());
    setGeneratedQRCampaign(campaign);
    setIsGeneratedQROpen(true);
  };

  const handleOpenMemberRoll = (tab?: 'quick_entry' | 'register_member' | 'members_list' | 'print_reports', campaignId?: string) => {
    setKumtluangInitialTab(tab || 'members_list');
    setKumtluangInitialCampaignId(campaignId);
    setIsKumtluangManagerOpen(true);
  };

  const handlePreviewImage = (url: string, title?: string, subtitle?: string, location?: string) => {
    setImagePreviewData({ url, title, subtitle, location });
  };

  const handleShareCampaign = (camp: Campaign) => {
    setShareCampaign(camp);
    setIsShareModalOpen(true);
  };

  const handleUpdateCampaign = (campaign: Campaign) => {
    const stamped: Campaign = {
      ...campaign,
      updatedAt: campaign.updatedAt || new Date().toISOString()
    };
    saveCampaign(stamped);
    setCampaigns(prev => {
      const idx = prev.findIndex(c => c.id === stamped.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = stamped;
        return copy;
      }
      return [stamped, ...prev];
    });
  };

  const handleDeleteCampaign = (campaignId: string, reason?: string, force?: boolean) => {
    const cleanId = String(campaignId).toLowerCase().trim();
    deleteStoredCampaign(campaignId, reason, 'Admin', force);
    setCampaigns(prev => prev.filter(c => String(c.id).toLowerCase().trim() !== cleanId));
    setTransactions(getStoredTransactions());
    if (selectedCampaign && String(selectedCampaign.id).toLowerCase().trim() === cleanId) {
      setSelectedCampaign(null);
    }
  };

  const handleApproveCampaign = (campaign: Campaign) => {
    const approvedCamp: Campaign = {
      ...campaign,
      status: 'active',
      isApproved: true,
      updatedAt: new Date().toISOString()
    };
    handleUpdateCampaign(approvedCamp);
    recordAuditLog('Campaign Approved', `Campaign "${campaign.title}" approved by Admin`, 'campaign', campaign.id);
  };

  const handleRejectCampaign = (campaignId: string, remarks?: string) => {
    const now = new Date().toISOString();
    const updated = campaigns.map(c => (c.id === campaignId ? { ...c, status: 'rejected', approvalRemarks: remarks, updatedAt: now } : c));
    setCampaigns(updated);
    saveStoredCampaigns(updated);
    recordAuditLog('Campaign Rejected', `Campaign ${campaignId} rejected with remark: ${remarks || 'None'}`, 'campaign', campaignId);
  };

  const handleUpdateTransaction = (transaction: Transaction) => {
    saveTransaction(transaction);
    setTransactions(getStoredTransactions());
  };

  const handleDeleteTransaction = (transactionId: string) => {
    deleteStoredTransaction(transactionId);
    setTransactions(getStoredTransactions());
  };

  const handleUpdateCreator = (creator: CreatorProfile) => {
    // 1. Update creators list
    const currentList = getStoredCreatorsList();
    const updatedList = currentList.map(cr => 
      cr.phone === creator.phone ? { ...cr, ...creator } : cr
    );
    if (!updatedList.some(cr => cr.phone === creator.phone) && creator.phone) {
      updatedList.push(creator);
    }
    setCreators(updatedList);
    saveStoredCreatorsList(updatedList);

    // 2. Update active creator profile
    setCreatorProfile(creator);
    saveStoredCreatorProfile(creator);
    syncCreatorToFirestore(creator).catch(() => {});

    // 3. Update existing campaigns created by this creator so name & org changes sync instantly to Preview and Mobile views
    const currentCampaigns = getStoredCampaigns();
    let hasCampaignUpdates = false;
    const updatedCampaigns = currentCampaigns.map(camp => {
      if (isCampaignCreator(camp, creator) || (creator.phone && camp.createdBy === creator.phone) || (creatorProfile.name && camp.createdBy === creatorProfile.name)) {
        hasCampaignUpdates = true;
        return {
          ...camp,
          creatorName: creator.name,
          createdBy: creator.phone || creator.name,
          orgName: camp.category === 'kumtluang' ? camp.orgName : (creator.orgName || camp.orgName),
        };
      }
      return camp;
    });

    if (hasCampaignUpdates) {
      setCampaigns(updatedCampaigns);
      saveStoredCampaigns(updatedCampaigns);
      for (const camp of updatedCampaigns) {
        if (isCampaignCreator(camp, creator) || (creator.phone && camp.createdBy === creator.phone)) {
          saveCampaign(camp);
        }
      }
    }
  };

  const handleUpdatePricingConfig = (config: SystemPricingConfig) => {
    setPricingConfig(config);
    saveStoredPricingConfig(config);
    syncPricingConfigToFirestore(config).catch(() => {});
  };

  const handleUpdateAnnouncement = (ann: AnnouncementBanner) => {
    setAnnouncement(ann);
    saveStoredAnnouncement(ann);
    syncAnnouncementToFirestore(ann).catch(() => {});
  };

  const handleResetData = () => {
    localStorage.clear();
    reloadLocalData();
    window.location.reload();
  };

  const handleRestoreDatabase = (jsonString: string): boolean => {
    const result = restoreFullDatabaseBackup(jsonString);
    if (result.success) {
      reloadLocalData();
      return true;
    }
    return false;
  };

  const handleToggleBiometric = () => {
    const next = !biometricEnabled;
    setBiometricEnabled(next);
    localStorage.setItem('ronpay_biometric_enabled', next ? 'true' : 'false');
  };

  const handleLogout = () => {
    invalidateCacheOnAuthOrBoot('auth_logout');
    const guest = logoutCreator();
    setCreatorProfile(guest);
    setIsCreatorStudioUnlocked(false);
    setIsProfileOpen(false);
    reloadLocalData();
    handleNavigate('home');
  };

  // Switch between Website view and App view
  const handleLaunchApp = (targetScreen?: string, targetCategory?: BawmCategory) => {
    // Default to Guest User (Khualmi) if not logged in
    if (!creatorProfile || !creatorProfile.phone) {
      setCreatorProfile(GUEST_CREATOR_PROFILE);
    }
    if (targetScreen) {
      const validScreens: ScreenId[] = ['home', 'explorer', 'checkout', 'create_qr', 'creator_reg', 'reports', 'success', 'failed', 'cash_pending'];
      const matched = validScreens.find(s => s === targetScreen);
      if (matched) {
        if (matched === 'create_qr') {
          handleNavigate('create_qr');
        } else {
          setCurrentScreen(matched);
        }
      }
    } else {
      setCurrentScreen('home');
    }
    if (targetCategory) {
      setSelectedCategory(targetCategory);
    }
    setShowSplash(false);
    setAppView('app');
    updateBrowserView('app', (targetScreen as ScreenId) || 'home');
  };

  const handleSwitchToWebsite = () => {
    setAppView('website');
    updateBrowserView('website');
  };

  const handleOpenPhonePeCheckout = async (amount: number = 100) => {
    const origin = typeof window !== 'undefined' && window.location.origin ? window.location.origin : 'https://ronpay.app';

    try {
      const mercuryUrl = await getPhonePeMercuryUrl({
        amountInRupees: amount,
        campaignTitle: 'RonPay Official Bawm',
        origin
      });
      if (mercuryUrl) {
        window.location.href = mercuryUrl;
        return;
      }
    } catch (e) {
      console.warn('Direct PhonePe session error, falling back:', e);
    }

    const launchUrl = `/api/phonepe/launch-pay?amt=${amount}&origin=${encodeURIComponent(origin)}`;
    window.location.href = launchUrl;
  };

  // Filter transactions for Sulhnu History
  const userVisibleTransactions = getUserOrCreatorVisibleTransactions(
    transactions,
    campaigns,
    creatorProfile,
    userPaidIds
  );

  // When in Marketing & Information Landing Page View:
  if (appView === 'website') {
    return (
      <div className="min-h-screen w-full bg-slate-50 text-slate-900 font-sans antialiased selection:bg-orange-500 selection:text-white">
        {showSplash && (
          <SplashScreen onFinish={handleFinishSplash} minDurationMs={350} />
        )}
        <RonPayWebsite
          onLaunchApp={handleLaunchApp}
          onOpenCreateQR={() => handleLaunchApp('create_qr')}
          onOpenRegister={() => handleLaunchApp('creator_reg')}
          onOpenBBPS={(serviceId) => {
            handleLaunchApp('home');
            setIsBillModalOpen(true);
          }}
          onOpenPhonePeCheckout={handleOpenPhonePeCheckout}
          onOpenPhonePePortal={() => {
            setAppView('app');
            updateBrowserView('app');
            setIsPhonePeOpen(true);
          }}
          initialLanguage={language}
        />
      </div>
    );
  }

  if (currentScreen === 'phonepe_launcher') {
    return (
      <PhonePeLauncherScreen
        amount={phonePeCheckoutAmount || 100}
        campaignTitle={selectedCampaign?.title}
        campaignId={selectedCampaign?.id}
        donorName={initialRoute?.donorName}
        donorPhone={initialRoute?.donorPhone}
        onBackToApp={() => {
          setCurrentScreen('home');
          setAppView('website');
          updateBrowserView('website');
        }}
      />
    );
  }

  return (
    <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-slate-100 text-slate-900 font-sans antialiased flex flex-col items-center">
      {/* Animated Zero-White-Screen Splash Overlay */}
      {showSplash && (
        <SplashScreen onFinish={handleFinishSplash} minDurationMs={400} />
      )}

      {/* Container with responsive boundary */}
      <div className={`w-full ${isDesktopView ? 'max-w-6xl' : 'max-w-md'} bg-white min-h-screen flex flex-col shadow-xl transition-all duration-300 relative overflow-x-hidden`}>
        {/* Offline & Connection Status Banner */}
        <OfflineStatusBanner onRefreshCache={reloadLocalData} />

        {/* Global Header */}
        {currentScreen !== 'phonepe_checkout' && (
          <Header
            currentScreen={currentScreen}
            onNavigate={handleNavigate}
            onOpenScanner={() => handleStartScanner('any')}
            onOpenReports={handleOpenReports}
            isDesktopView={isDesktopView}
            onToggleDesktopView={() => setIsDesktopView(!isDesktopView)}
            notificationCount={notificationCount}
            onOpenNotifications={handleOpenNotifications}
            language={language}
            onToggleLanguage={setLanguage}
            onOpenHistory={handleOpenHistory}
            onOpenAIHriatpui={() => setIsAIHriatpuiOpen(true)}
            onOpenLogin={() => setIsLoginModalOpen(true)}
            creatorProfile={creatorProfile}
            onSwitchToWebsite={handleSwitchToWebsite}
          />
        )}

        {/* Main Body Screen Router */}
        <main className={currentScreen === 'phonepe_checkout' ? "flex-1 w-full max-w-full p-0 overflow-y-auto overflow-x-hidden" : "flex-1 w-full max-w-full px-3 sm:px-4 pt-3.5 pb-3 overflow-y-auto overflow-x-hidden"}>
          {currentScreen === 'home' && (
            <HomeScreen
              campaigns={campaigns}
              transactions={transactions}
              creatorProfile={creatorProfile}
              announcement={announcement}
              onStartScanner={handleStartScanner}
              onCreateQRClick={() => {
                if (creatorProfile.isApproved && creatorProfile.phone) {
                  handleNavigate('create_qr');
                } else {
                  handleNavigate('creator_reg');
                }
              }}
              onSelectBawm={handleSelectBawm}
              onSelectCampaign={handleSelectCampaign}
              onShareCampaign={handleShareCampaign}
              onOpenHistory={handleOpenHistory}
              onOpenBillService={handleOpenBillService}
              onOpenReports={handleOpenReports}
              onOpenMemberRoll={handleOpenMemberRoll}
              onShowBalance={() => setIsWalletOpen(true)}
              onShowBankTransfer={() => setIsBankTransferOpen(true)}
              onOpenAdminDashboard={() => setIsAdminDashboardOpen(true)}
              onOpenPhonePePortal={() => setIsPhonePeOpen(true)}
              onOpenPhonePeCheckout={handleOpenPhonePeCheckout}
              onPreviewImage={handlePreviewImage}
              language={language}
              onOpenAIHriatpui={() => setIsAIHriatpuiOpen(true)}
              onOpenLogin={() => setIsLoginModalOpen(true)}
              onOpenWebsite={handleSwitchToWebsite}
            />
          )}


          {currentScreen === 'explorer' && (
            <BawmExplorerScreen
              category={selectedCategory}
              campaigns={campaigns}
              transactions={transactions}
              creatorProfile={creatorProfile}
              onBack={() => handleNavigate('home')}
              onSelectCampaign={handleSelectCampaign}
              onStartScanner={handleStartScanner}
              onPreviewImage={handlePreviewImage}
              onShareCampaign={handleShareCampaign}
              onCategoryChange={setSelectedCategory}
              onOpenMemberRoll={handleOpenMemberRoll}
              language={language}
            />
          )}

          {currentScreen === 'checkout' && (
            <CheckoutScreen
              category={selectedCategory || selectedCampaign?.category || 'others'}
              campaign={selectedCampaign || campaigns[0] || getStoredCampaigns()[0]}
              pricingConfig={pricingConfig}
              onBack={() => {
                setAutoOpenPhonePeCheckout(false);
                setSelectedCampaign(null);
                cleanPaymentUrlParams();
                handleNavigate('home', { replace: true });
              }}
              onPaymentSuccess={(tx) => {
                setAutoOpenPhonePeCheckout(false);
                handlePaymentSuccess(tx);
              }}
              onPaymentFailure={(tx, reason) => {
                handlePaymentFailure(tx, reason);
              }}
              onCashPending={handleCashPending}
              onOpenPhonePePortal={() => setIsPhonePeOpen(true)}
              onPreviewImage={handlePreviewImage}
              language={language}
              initialOpenPhonePeCheckout={autoOpenPhonePeCheckout}
              initialAmount={autoOpenPhonePeCheckout ? phonePeCheckoutAmount : selectedCampaign?.customAmount}
              initialDonorName={initialRoute?.donorName}
              initialDonorSection={initialRoute?.donorVeng}
              initialIsAnonymous={initialRoute?.isAnonymous}
            />
          )}

          {currentScreen === 'create_qr' && (
            (!creatorProfile.isApproved || !creatorProfile.phone) ? (
              <CreatorRegScreen
                creatorProfile={creatorProfile}
                onBack={() => handleNavigate('home')}
                onSuccess={(profile, cat) => {
                  invalidateCacheOnAuthOrBoot('auth_login');
                  loginCreator(profile);
                  setCreatorProfile(profile);
                  setSelectedCategory(cat);
                  setIsCreatorStudioUnlocked(true);
                  reloadLocalData();
                  handleNavigate('create_qr');
                }}
                onOpenAdminDashboard={() => setIsAdminDashboardOpen(true)}
                onRegisterCreator={(p) => {
                  handleUpdateCreator(p);
                }}
              />
            ) : !isCreatorStudioUnlocked ? (
              <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-6 space-y-4 animate-fadeIn">
                <div className="w-16 h-16 rounded-3xl bg-indigo-50 border-2 border-indigo-200 text-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-100 animate-pulse">
                  <Fingerprint className="w-8 h-8" />
                </div>
                <div className="space-y-1 max-w-sm">
                  <h3 className="text-base font-black text-slate-900">Creator Studio Security Lock</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Creator Studio luh nan WebAuthn Biometric verification (Fingerprint / Face ID) emaw PIN a ngai e.
                  </p>
                </div>
                <div className="flex gap-2 w-full max-w-xs pt-2">
                  <button
                    type="button"
                    onClick={() => handleNavigate('home')}
                    className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs cursor-pointer transition"
                  >
                    Hawng Rawh (Home)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setBiometricTarget('creator_studio');
                      setBiometricTitle('Creator Studio Security Access');
                      setBiometricSubtitle(`${creatorProfile.name || 'Creator'} Studio luh nan verify rawh le.`);
                      setBiometricCallback(() => () => {
                        setIsCreatorStudioUnlocked(true);
                      });
                      setIsBiometricModalOpen(true);
                    }}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-200 flex items-center justify-center gap-1.5 cursor-pointer transition"
                  >
                    <Fingerprint className="w-4 h-4" /> Verify Now
                  </button>
                </div>
              </div>
            ) : (
              <CreateQRScreen
                creatorProfile={creatorProfile}
                pricingConfig={pricingConfig}
                announcement={announcement}
                campaigns={campaigns}
                transactions={transactions}
                onBack={() => handleNavigate('home')}
                onOpenUpgradeModal={() => setIsUpgradeModalOpen(true)}
                onGenerateQR={handleGenerateQR}
                onLogout={handleLogout}
                onSwitchAccount={() => handleNavigate('creator_reg')}
                onUpdateCampaign={handleUpdateCampaign}
                onDeleteCampaign={handleDeleteCampaign}
                onOpenAdminDashboard={() => setIsAdminDashboardOpen(true)}
                onOpenMemberRoll={handleOpenMemberRoll}
                onPreviewImage={handlePreviewImage}
                language={language}
                onSelectCampaign={handleSelectCampaign}
                onUpdateCreatorProfile={handleUpdateCreator}
              />
            )
          )}

          {currentScreen === 'creator_reg' && (
            <CreatorRegScreen
              creatorProfile={creatorProfile}
              onBack={() => handleNavigate('home')}
              onSuccess={(profile, cat) => {
                invalidateCacheOnAuthOrBoot('auth_login');
                loginCreator(profile);
                setCreatorProfile(profile);
                setSelectedCategory(cat);
                reloadLocalData();
                handleNavigate('create_qr');
              }}
              onOpenAdminDashboard={() => setIsAdminDashboardOpen(true)}
              onRegisterCreator={(p) => {
                handleUpdateCreator(p);
              }}
            />
          )}

          {currentScreen === 'reports' && (
            <ReportsScreen
              transactions={transactions}
              campaigns={campaigns}
              creatorProfile={creatorProfile}
              onBack={() => handleNavigate('home')}
              onOpenLogin={() => handleNavigate('creator_reg')}
              onOpenCreateQR={() => handleNavigate('create_qr')}
              onUpdateCampaign={handleUpdateCampaign}
              onUpdateTransaction={handleUpdateTransaction}
              onDeleteTransaction={handleDeleteTransaction}
              onOpenImagePreview={handlePreviewImage}
              onOpenMemberRoll={handleOpenMemberRoll}
              onRefreshCloud={handleRefreshCloudData}
            />
          )}

          {currentScreen === 'success' && (
            <SuccessScreen
              transaction={completedTransaction}
              onGoHome={() => {
                if (completedTransaction?.id) {
                  markReceiptAsConsumed(completedTransaction.id);
                }
                setCompletedTransaction(null);
                setAutoOpenPhonePeCheckout(false);
                setSelectedCampaign(null);
                cleanPaymentUrlParams();
                handleNavigate('home', { replace: true });
              }}
              onExploreMore={() => {
                if (completedTransaction?.id) {
                  markReceiptAsConsumed(completedTransaction.id);
                }
                setCompletedTransaction(null);
                setAutoOpenPhonePeCheckout(false);
                cleanPaymentUrlParams();
                handleNavigate('explorer', { replace: true });
              }}
            />
          )}

          {currentScreen === 'failed' && (
            <FailedScreen
              transaction={failedTransaction}
              reason={failureReason}
              onRetry={() => {
                if (failedTransaction?.campaignId) {
                  const camp = campaigns.find(c => c.id === failedTransaction.campaignId) || selectedCampaign;
                  if (camp) setSelectedCampaign(camp);
                }
                handleNavigate('checkout', { replace: true });
              }}
              onGoHome={() => {
                setFailedTransaction(null);
                setAutoOpenPhonePeCheckout(false);
                cleanPaymentUrlParams();
                handleNavigate('home', { replace: true });
              }}
              onExploreMore={() => {
                setFailedTransaction(null);
                setAutoOpenPhonePeCheckout(false);
                cleanPaymentUrlParams();
                handleNavigate('explorer', { replace: true });
              }}
            />
          )}

          {currentScreen === 'cash_pending' && (
            <CashPendingScreen
              transaction={completedTransaction}
              creatorName={creatorProfile.name || 'Bawm Creator'}
              creatorProfile={creatorProfile}
              campaigns={campaigns}
              onGoHome={() => handleNavigate('home')}
              onApprove={(approvedTx) => {
                setTransactions(prev => prev.map(t => t.id === approvedTx.id ? approvedTx : t));
                setCompletedTransaction(approvedTx);
                setCurrentScreen('success');
              }}
              onReject={(rejectedTx) => {
                setTransactions(prev => prev.map(t => t.id === rejectedTx.id ? rejectedTx : t));
                setCompletedTransaction(rejectedTx);
              }}
            />
          )}
          {currentScreen === 'phonepe_checkout' && (
            <PhonePeStandardCheckout
              campaign={selectedCampaign || campaigns[0]}
              onBack={() => handleNavigate('checkout')}
              onSuccess={(tx) => {
                setTransactions(prev => [tx, ...prev.filter(t => t.id !== tx.id)]);
                setCompletedTransaction(tx);
                setCurrentScreen('success');
              }}
            />
          )}
        </main>

        {/* Global Footer Navigation (Home, Roll, Studio, Report, Profile) */}
        {currentScreen !== 'checkout' && currentScreen !== 'phonepe_checkout' && (
          <BottomNav
            currentScreen={currentScreen}
            onNavigate={(screen) => {
              if (screen === 'create_qr' && (!creatorProfile.isApproved || !creatorProfile.phone)) {
                handleNavigate('creator_reg');
              } else {
                handleNavigate(screen);
              }
            }}
            onOpenMemberRoll={handleOpenMemberRoll}
            onOpenProfile={() => setIsProfileOpen(true)}
            isProfileOpen={isProfileOpen}
            isKumtluangManagerOpen={isKumtluangManagerOpen}
            language={language}
          />
        )}

        {/* Global Floating Actions / Modals */}
        <QRScannerModal
          isOpen={isScannerOpen}
          categoryFilter={scannerCategory}
          campaigns={campaigns}
          onClose={() => setIsScannerOpen(false)}
          onSelectCampaign={handleSelectCampaign}
          onOpenExternalLanding={(camp) => {
            setExternalUPICampaign(camp);
            setIsExternalUPIOpen(true);
          }}
          onMismatchDetected={(cat) => {
            setMismatchCategory(cat);
            setIsMismatchModalOpen(true);
          }}
        />

        <QRShareModal
          isOpen={isShareModalOpen}
          campaign={shareCampaign}
          onClose={() => setIsShareModalOpen(false)}
        />

        <GeneratedQRModal
          isOpen={isGeneratedQROpen}
          campaign={generatedQRCampaign}
          onClose={() => setIsGeneratedQROpen(false)}
          onGoHome={() => handleNavigate('home')}
        />

        <ProfileModal
          isOpen={isProfileOpen}
          onClose={() => setIsProfileOpen(false)}
          creatorProfile={creatorProfile}
          onResetData={handleResetData}
          onOpenHistory={handleOpenHistory}
          onOpenPhonePePortal={() => setIsPhonePeOpen(true)}
          onLogout={handleLogout}
          onLoginClick={() => {
            setIsProfileOpen(false);
            setIsLoginModalOpen(true);
          }}
          onOpenAdmin={() => {
            setIsProfileOpen(false);
            setIsAdminDashboardOpen(true);
          }}
          biometricEnabled={biometricEnabled}
          onToggleBiometric={handleToggleBiometric}
          onUpdateProfile={handleUpdateCreator}
        />

        <ErrorBoundary name="PeknaSulhnuModal">
          <PeknaSulhnuModal
            isOpen={isHistoryOpen}
            transactions={userVisibleTransactions}
            campaigns={campaigns}
            creatorProfile={creatorProfile}
            userPaidIds={userPaidIds}
            onClose={() => setIsHistoryOpen(false)}
            onRefreshData={reloadLocalData}
            onOpenReceipt={(tx) => {
              setCompletedTransaction(tx);
              setIsHistoryOpen(false);
              handleNavigate('success');
            }}
            onNavigateToDonate={() => {
              setIsHistoryOpen(false);
              handleNavigate('home');
            }}
            onOpenScanner={() => {
              setIsHistoryOpen(false);
              handleStartScanner('any');
            }}
            onOpenLogin={() => {
              setIsHistoryOpen(false);
              handleNavigate('creator_reg');
            }}
          />
        </ErrorBoundary>

        <NotificationsModal
          isOpen={isNotificationsOpen}
          onClose={() => setIsNotificationsOpen(false)}
          transactions={transactions}
          campaigns={campaigns}
          creatorProfile={creatorProfile}
          onOpenReceipt={(tx) => {
            setIsNotificationsOpen(false);
            setCompletedTransaction(tx);
            setCurrentScreen('success');
          }}
          onNavigateToCampaign={(camp) => {
            setIsNotificationsOpen(false);
            handleSelectCampaign(camp);
          }}
          onOpenCampaignReview={(camp) => {
            setIsNotificationsOpen(false);
            setAdminApprovalCampaign(camp);
            setIsAdminApprovalOpen(true);
          }}
          onOpenMemberRoll={() => {
            setIsNotificationsOpen(false);
            setIsKumtluangManagerOpen(true);
          }}
          onUnreadCountChange={(cnt) => {
            setNotificationCount(cnt);
          }}
          onTransactionUpdated={(updatedTx) => {
            setTransactions(prev => prev.map(t => t.id === updatedTx.id ? updatedTx : t));
          }}
        />

        <PhonePeModal
          isOpen={isPhonePeOpen}
          onClose={() => setIsPhonePeOpen(false)}
        />

        <BankTransferModal
          isOpen={isBankTransferOpen}
          onClose={() => setIsBankTransferOpen(false)}
          creatorProfile={creatorProfile}
          onTransferSuccess={handlePaymentSuccess}
        />

        <BillPaymentModal
          service={selectedBillService}
          onClose={() => {
            setIsBillModalOpen(false);
            setSelectedBillService(null);
          }}
          onPaymentComplete={handleBillPaymentComplete}
          language={language}
        />

        <AdminDashboardModal
          isOpen={isAdminDashboardOpen}
          onClose={() => setIsAdminDashboardOpen(false)}
          campaigns={campaigns}
          transactions={transactions}
          creators={creators}
          currentProfile={creatorProfile}
          pricingConfig={pricingConfig}
          announcement={announcement}
          auditLogs={auditLogs}
          onUpdatePricingConfig={handleUpdatePricingConfig}
          onUpdateCampaign={handleUpdateCampaign}
          onDeleteCampaign={handleDeleteCampaign}
          onApproveCampaign={handleApproveCampaign}
          onRejectCampaign={handleRejectCampaign}
          onUpdateCreator={handleUpdateCreator}
          onUpdateAnnouncement={handleUpdateAnnouncement}
          onRestoreDatabase={handleRestoreDatabase}
          onResetData={handleResetData}
          onUpdateTransaction={(updatedTx) => {
            setTransactions(prev => prev.map(t => t.id === updatedTx.id ? updatedTx : t));
          }}
          onViewReceipt={(tx) => {
            setIsAdminDashboardOpen(false);
            setCompletedTransaction(tx);
            setCurrentScreen('success');
          }}
        />

        <AdminApprovalModal
          isOpen={isAdminApprovalOpen}
          campaign={adminApprovalCampaign}
          currentProfile={creatorProfile}
          onClose={() => {
            setIsAdminApprovalOpen(false);
            setAdminApprovalCampaign(null);
          }}
          onApprove={(c) => {
            handleApproveCampaign(c);
            setIsAdminApprovalOpen(false);
          }}
          onReject={(c) => {
            handleRejectCampaign(c.id);
            setIsAdminApprovalOpen(false);
          }}
        />

        <KumtluangMemberManagerModal
          isOpen={isKumtluangManagerOpen}
          onClose={() => {
            setIsKumtluangManagerOpen(false);
            setKumtluangInitialCampaignId(undefined);
          }}
          language={language}
          creatorProfile={creatorProfile}
          campaigns={campaigns}
          transactions={transactions}
          initialTab={kumtluangInitialTab}
          initialCampaignId={kumtluangInitialCampaignId}
          onDataUpdated={reloadLocalData}
          onOpenCreateQR={() => {
            setIsKumtluangManagerOpen(false);
            handleNavigate('create_qr');
          }}
        />

        <MemberRollPreviewModal
          isOpen={isMemberRollPreviewOpen}
          onClose={() => setIsMemberRollPreviewOpen(false)}
          campaigns={campaigns}
          members={members}
          transactions={transactions}
          creatorProfile={creatorProfile}
          initialFormat={memberRollPreviewParams.format}
          initialCampaignId={memberRollPreviewParams.campaignId}
          initialMemberId={memberRollPreviewParams.memberId}
        />

        <MismatchModal
          isOpen={isMismatchModalOpen}
          category={mismatchCategory || 'ralna'}
          onClose={() => setIsMismatchModalOpen(false)}
          onExploreCategory={(cat) => {
            setIsMismatchModalOpen(false);
            setSelectedCategory(cat);
            handleNavigate('explorer');
          }}
        />

        <UpgradeModal
          isOpen={isUpgradeModalOpen}
          onClose={() => setIsUpgradeModalOpen(false)}
          creatorProfile={creatorProfile}
          pricingConfig={pricingConfig}
          onUpgradeApproved={(newCat) => {
            const updated = {
              ...creatorProfile,
              allowedCategories: [...(creatorProfile.allowedCategories || []), newCat],
            };
            handleUpdateCreator(updated);
            setIsUpgradeModalOpen(false);
          }}
        />

        <BiometricAuthModal
          isOpen={isBiometricModalOpen}
          target={biometricTarget}
          title={biometricTitle}
          subtitle={biometricSubtitle}
          userName={creatorProfile.name}
          userPhone={creatorProfile.phone}
          expectedPin={creatorProfile.pin || creatorProfile.password}
          onClose={() => {
            setIsBiometricModalOpen(false);
            setBiometricCallback(null);
            if (currentScreen === 'create_qr' && !isCreatorStudioUnlocked) {
              handleNavigate('home');
            }
          }}
          onSuccess={() => {
            setIsBiometricModalOpen(false);
            if (biometricCallback) {
              const cb = biometricCallback;
              setBiometricCallback(null);
              cb();
            }
          }}
        />

        <ExternalUPILandingModal
          isOpen={isExternalUPIOpen}
          campaign={externalUPICampaign}
          language={language}
          onClose={() => {
            setIsExternalUPIOpen(false);
            setExternalUPICampaign(null);
          }}
          onProceedRonPay={(camp) => {
            setIsExternalUPIOpen(false);
            handleSelectCampaign(camp);
          }}
        />

        <ImagePreviewModal
          imageUrl={imagePreviewData.url}
          title={imagePreviewData.title}
          subtitle={imagePreviewData.subtitle}
          location={imagePreviewData.location}
          onClose={() => setImagePreviewData({ url: null })}
        />

        <PrintPreviewModal
          isOpen={printPreviewData.isOpen}
          html={printPreviewData.html}
          docTitle={printPreviewData.docTitle}
          fileName={printPreviewData.fileName}
          onClose={() => setPrintPreviewData({ isOpen: false })}
        />

        <AIHriatpuiModal
          isOpen={isAIHriatpuiOpen}
          onClose={() => setIsAIHriatpuiOpen(false)}
          creatorProfile={creatorProfile}
          onApplyLetterToRegistration={() => {
            setIsAIHriatpuiOpen(false);
            if (!creatorProfile.isApproved) {
              handleNavigate('creator_reg');
            }
          }}
        />

        <RonPayWalletModal
          isOpen={isWalletOpen}
          onClose={() => setIsWalletOpen(false)}
          creatorProfile={creatorProfile}
          campaigns={campaigns}
          onStartScanner={() => handleStartScanner('any')}
          onOpenBankTransfer={() => {
            setIsWalletOpen(false);
            setIsBankTransferOpen(true);
          }}
          onOpenHistory={() => {
            setIsWalletOpen(false);
            handleOpenHistory();
          }}
          language={language}
        />

        <SmartLoginModal
          isOpen={isLoginModalOpen}
          onClose={() => setIsLoginModalOpen(false)}
          currentProfile={creatorProfile}
          biometricEnabled={biometricEnabled}
          onToggleBiometric={handleToggleBiometric}
          onLoginSuccess={(newProfile) => {
            setCreatorProfile(newProfile);
            saveStoredCreatorProfile(newProfile);
            setIsLoginModalOpen(false);
          }}
        />
      </div>
    </div>
  );
}

