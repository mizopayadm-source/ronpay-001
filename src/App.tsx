import React, { useState, useEffect, useCallback } from 'react';
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
} from './utils/storage';
import {
  initFirestoreRealtimeSync,
  pushAllLocalDataToFirestore,
  deleteCampaignFromFirestore,
  deleteTransactionFromFirestore,
  syncCampaignToFirestore,
  syncCreatorToFirestore,
  syncPricingConfigToFirestore,
  syncAnnouncementToFirestore,
  forceRefreshFirestore,
} from './services/firestoreSync';
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
import { getUrlRoute, updateBrowserUrl, updateBrowserView, isAndroidOrMobileApp } from './utils/urlRouting';

export default function App() {
  // Splash screen state for smooth UX
  const [showSplash, setShowSplash] = useState<boolean>(true);

  // Extract initial deep link routing parameters from URL (e.g. Google Lens, Camera, Web link)
  const initialRoute = typeof window !== 'undefined' ? getUrlRoute() : null;

  // View Mode: On Android Mobile App / WebViews, default directly to 'app' (Zero website detour). On Desktop, default to 'website'
  const [appView, setAppView] = useState<'website' | 'app'>(() => {
    if (initialRoute?.view) return initialRoute.view;
    return isAndroidOrMobileApp() ? 'app' : 'website';
  });

  // Navigation & View States
  const [currentScreen, setCurrentScreen] = useState<ScreenId>(() => initialRoute?.screen || 'home');
  const [selectedCategory, setSelectedCategory] = useState<BawmCategory>(() => initialRoute?.category || 'ralna');
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(() => initialRoute?.campaign || null);
  const [completedTransaction, setCompletedTransaction] = useState<Transaction | null>(() => {
    if (initialRoute?.receiptId && initialRoute?.screen === 'success') {
      const txs = getStoredTransactions();
      const found = txs.find(t => t.id.toLowerCase() === initialRoute.receiptId?.toLowerCase() && t.status === 'completed');
      if (found) return found;

      const pendingRaw = localStorage.getItem(`RONPAY_PENDING_TX_${initialRoute.receiptId}`) || sessionStorage.getItem(`RONPAY_PENDING_TX_${initialRoute.receiptId}`);
      if (pendingRaw) {
        try {
          const parsed = JSON.parse(pendingRaw);
          if (parsed && parsed.id && parsed.status !== 'failed') {
            return {
              ...parsed,
              status: 'completed',
              verifiedAt: new Date().toISOString()
            };
          }
        } catch (e) {}
      }

      if (initialRoute.receiptMeta) {
        const meta = initialRoute.receiptMeta;
        const total = meta.amount || (meta.baseAmount ? (meta.feeOption === 'ADD_ON' ? meta.baseAmount + (meta.platformFee || 1) : meta.baseAmount) : 0);
        if (total > 0) {
          const base = meta.baseAmount || (meta.feeOption === 'ADD_ON' ? Math.max(1, total - (meta.platformFee || 1)) : total);
          const fee = meta.platformFee !== undefined ? meta.platformFee : Math.max(0, total - base);
          const allCamps = getStoredCampaigns();
          const mCamp = allCamps.find(c => c.id === meta.campaignId);
          const resolvedTitle = (mCamp ? getCampaignCauseTitle(mCamp) : '') ||
            (meta.campaignTitle && meta.campaignTitle !== 'BCM Ebenezer' ? meta.campaignTitle : '') ||
            (meta.category === 'ralna' ? 'Lalrinpuii Ralna' : '') ||
            meta.campaignTitle ||
            'RonPay Community Bawm';

          return {
            id: initialRoute.receiptId,
            campaignId: meta.campaignId || 'cmp-custom',
            campaignTitle: resolvedTitle,
            category: meta.category || 'others',
            donorName: meta.isAnonymous ? 'Anonymous' : (meta.donorName || 'Valued Donor'),
            donorPhone: meta.donorPhone,
            isAnonymous: Boolean(meta.isAnonymous),
            amount: base,
            platformFee: fee,
            totalAmount: total,
            feeOption: meta.feeOption || 'ADD_ON',
            campaignNetReceived: base,
            paymentMethod: 'phonepe',
            status: 'completed',
            timestamp: new Date().toISOString(),
            referenceNo: `T${Date.now()}`,
            verifiedAt: new Date().toISOString(),
            utr: meta.utr || ('UTR' + Math.floor(100000000000 + Math.random() * 900000000000))
          };
        }
      }
    }
    return null;
  });

  const [failedTransaction, setFailedTransaction] = useState<Transaction | null>(() => {
    if (initialRoute?.screen === 'failed' && initialRoute?.receiptId) {
      const pendingRaw = localStorage.getItem(`RONPAY_PENDING_TX_${initialRoute.receiptId}`) || sessionStorage.getItem(`RONPAY_PENDING_TX_${initialRoute.receiptId}`);
      if (pendingRaw) {
        try {
          const parsed = JSON.parse(pendingRaw);
          if (parsed && parsed.id) {
            return {
              ...parsed,
              status: 'failed',
            };
          }
        } catch (e) {}
      }

      if (initialRoute.receiptMeta) {
        const meta = initialRoute.receiptMeta;
        const total = meta.amount || (meta.baseAmount ? (meta.feeOption === 'ADD_ON' ? meta.baseAmount + (meta.platformFee || 1) : meta.baseAmount) : 0);
        const base = meta.baseAmount || (meta.feeOption === 'ADD_ON' ? Math.max(1, total - (meta.platformFee || 1)) : total);
        const fee = meta.platformFee !== undefined ? meta.platformFee : Math.max(0, total - base);
        const allCamps = getStoredCampaigns();
        const mCamp = allCamps.find(c => c.id === meta.campaignId);
        const resolvedTitle = (mCamp ? getCampaignCauseTitle(mCamp) : '') ||
          (meta.campaignTitle && meta.campaignTitle !== 'BCM Ebenezer' ? meta.campaignTitle : '') ||
          (meta.category === 'ralna' ? 'Lalrinpuii Ralna' : '') ||
          meta.campaignTitle ||
          'RonPay Community Bawm';

        return {
          id: initialRoute.receiptId,
          campaignId: meta.campaignId || 'cmp-custom',
          campaignTitle: resolvedTitle,
          category: meta.category || 'others',
          donorName: meta.isAnonymous ? 'Anonymous' : (meta.donorName || 'Valued User'),
          donorPhone: meta.donorPhone,
          isAnonymous: Boolean(meta.isAnonymous),
          amount: base,
          platformFee: fee,
          totalAmount: total,
          feeOption: meta.feeOption || 'ADD_ON',
          campaignNetReceived: base,
          paymentMethod: 'phonepe',
          status: 'failed',
          timestamp: new Date().toISOString(),
          referenceNo: `T${Date.now()}`,
          utr: meta.utr
        };
      }
    }
    return null;
  });

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
  }>({ isOpen: false });

  // Biometric toggle state
  const [biometricEnabled, setBiometricEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem('ronpay_biometric_enabled') === 'true';
    } catch {
      return false;
    }
  });

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

    return () => {
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

    // Cross-tab real-time sync via BroadcastChannel
    let syncBroadcast: BroadcastChannel | null = null;
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        syncBroadcast = new BroadcastChannel('ronpay_realtime_sync');
        syncBroadcast.onmessage = () => {
          reloadLocalData();
        };
      }
    } catch (err) {
      console.warn('BroadcastChannel sync init:', err);
    }

    // Initial complete bi-directional sync on app startup (merges local transactions across windows)
    syncAllWithServer()
      .then(syncResult => {
        if (syncResult) {
          reloadLocalData();
        }
      })
      .catch(() => {});

    // Periodic background sync every 12 seconds so all windows, tabs and Android phones stay in lock-step
    const syncInterval = setInterval(() => {
      syncAllWithServer()
        .then(syncResult => {
          if (syncResult) {
            reloadLocalData();
          }
        })
        .catch(() => {});
    }, 12000);

    // Sync immediately when window/tab is focused or becomes visible
    const handleFocusSync = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        syncAllWithServer()
          .then(syncResult => {
            if (syncResult) {
              reloadLocalData();
            }
          })
          .catch(() => {});
      }
    };
    window.addEventListener('focus', handleFocusSync);
    document.addEventListener('visibilitychange', handleFocusSync);

    return () => {
      clearInterval(syncInterval);
      window.removeEventListener('focus', handleFocusSync);
      document.removeEventListener('visibilitychange', handleFocusSync);
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
      if (syncBroadcast) {
        try { syncBroadcast.close(); } catch (e) {}
      }
    };
  }, []);

  // Reload helper
  const reloadLocalData = useCallback(() => {
    setCampaigns(getStoredCampaigns());
    setTransactions(getStoredTransactions());
    setCreators(getStoredCreatorsList());
    setCreatorProfile(getStoredCreatorProfile());
    setPricingConfig(getStoredPricingConfig());
    setAnnouncement(getStoredAnnouncement());
    setAuditLogs(getStoredAuditLogs());
    setMembersState(getMembers());
    setUserPaidIds(getStoredUserPaidTxIds());
  }, []);

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
  const applyRouteFromUrl = useCallback(() => {
    const route = getUrlRoute();
    if (!route) return;

    if (route.view) {
      setAppView(route.view);
    }
    if (route.screen) {
      setCurrentScreen(route.screen);
    }
    if (route.campaign) {
      setSelectedCampaign(route.campaign);
      setSelectedCategory(route.category || route.campaign.category);
    }
    if (route.category && !route.campaign) {
      setSelectedCategory(route.category);
    }
    if (route.isPhonePeOpen && route.campaign?.customAmount) {
      setAutoOpenPhonePeCheckout(true);
      setPhonePeCheckoutAmount(route.campaign.customAmount);
    } else {
      setAutoOpenPhonePeCheckout(false);
      setPhonePeCheckoutAmount(route.campaign?.customAmount || 0);
    }
    if (route.receiptId) {
      const txs = getStoredTransactions();
      const found = txs.find(t => t.id.toLowerCase() === route.receiptId?.toLowerCase());

      const pendingRaw = localStorage.getItem(`RONPAY_PENDING_TX_${route.receiptId}`) || sessionStorage.getItem(`RONPAY_PENDING_TX_${route.receiptId}`);
      let parsedPending: Transaction | null = null;
      if (pendingRaw) {
        try {
          parsedPending = JSON.parse(pendingRaw);
        } catch (e) {}
      }

      // Authoritative status verification with server before trusting route
      fetch(`/api/phonepe/status/${encodeURIComponent(route.receiptId)}`)
        .then(r => r.json())
        .then(data => {
          const isConfirmedFailed =
            data?.code === 'PAYMENT_ERROR' ||
            data?.data?.state === 'FAILED' ||
            data?.data?.state === 'CANCELLED' ||
            data?.data?.state === 'EXPIRED' ||
            Boolean(data?.data?.errorCode) ||
            data?.data?.responseCode === 'PAYMENT_ERROR' ||
            data?.data?.responseCode === 'FAILED';

          const isConfirmedSuccess =
            data?.code === 'PAYMENT_SUCCESS' ||
            data?.data?.state === 'COMPLETED' ||
            data?.data?.responseCode === 'SUCCESS' ||
            data?.data?.status === 'SUCCESS' ||
            data?.data?.status === 'PAYMENT_SUCCESS';

          if (isConfirmedFailed) {
            // Remove any erroneously stored record
            deleteStoredTransaction(route.receiptId!);
            setCompletedTransaction(null);
            const resolvedReason = data?.data?.detailedErrorCode || data?.data?.errorCode || data?.message || 'PhonePe payment reported failed or cancelled';
            setFailureReason(resolvedReason);

            const meta = route.receiptMeta;
            const baseTx = found || parsedPending;
            const allCamps = [...campaigns, ...getStoredCampaigns()];
            const targetCampId = data?.data?.campaignId || meta?.campaignId || baseTx?.campaignId || '';
            const matchedCamp = allCamps.find(c => c.id === targetCampId);
            const total = data?.data?.amountRupees || (data?.data?.amount ? data.data.amount / 100 : null) || meta?.amount || baseTx?.totalAmount || 0;
            const base = data?.data?.baseAmountRupees || meta?.baseAmount || baseTx?.amount || (total > 1 ? total - 1 : total);
            const fee = data?.data?.platformFeeRupees !== undefined ? data.data.platformFeeRupees : (meta?.platformFee !== undefined ? meta.platformFee : (baseTx?.platformFee ?? Math.max(0, total - base)));

            const failedTx: Transaction = {
              id: route.receiptId!,
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
              referenceNo: data?.data?.transactionId || baseTx?.referenceNo || `T${Date.now()}`,
              feeOption: (baseTx?.feeOption || meta?.feeOption || 'ADD_ON') as any,
              campaignNetReceived: base
            };

            setFailedTransaction(failedTx);
            setCurrentScreen('failed');
            setAppView('app');
            try {
              if (typeof BroadcastChannel !== 'undefined') {
                const bc = new BroadcastChannel('ronpay_payment_channel');
                bc.postMessage({ type: 'PHONEPE_PAYMENT_FAILED', receiptId: route.receiptId, reason: resolvedReason });
              }
              localStorage.setItem('RONPAY_LAST_CONFIRMED_TXN', JSON.stringify({
                id: route.receiptId,
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
                bc.postMessage({ type: 'PHONEPE_PAYMENT_SUCCESS', receiptId: route.receiptId });
              }
              localStorage.setItem('RONPAY_LAST_CONFIRMED_TXN', JSON.stringify({
                id: route.receiptId,
                status: 'PAYMENT_SUCCESS',
                timestamp: Date.now()
              }));
              if (window.opener && !window.opener.closed) {
                window.opener.postMessage({ type: 'PHONEPE_PAYMENT_RESULT', status: 'PAYMENT_SUCCESS', receiptId: route.receiptId }, '*');
              }
            } catch (e) {}

            const sData = data?.data;
            const meta = route.receiptMeta;
            const baseTx = found || parsedPending;

            const allCamps = [...campaigns, ...getStoredCampaigns()];
            const targetCampId = sData?.campaignId || meta?.campaignId || baseTx?.campaignId || '';
            const matchedCamp = allCamps.find(c => c.id === targetCampId);

            const total = sData?.amountRupees || (sData?.amount ? sData.amount / 100 : null) || meta?.amount || baseTx?.totalAmount || 0;
            const base = sData?.baseAmountRupees || meta?.baseAmount || baseTx?.amount || (total > 1 ? total - 1 : total);
            const fee = sData?.platformFeeRupees !== undefined ? sData.platformFeeRupees : (meta?.platformFee !== undefined ? meta.platformFee : (baseTx?.platformFee ?? Math.max(0, total - base)));

            const resolvedCampTitle = (matchedCamp ? getCampaignCauseTitle(matchedCamp) : '') ||
              baseTx?.campaignTitle ||
              (sData?.campaignTitle && sData.campaignTitle !== 'BCM Ebenezer' ? sData.campaignTitle : '') ||
              (meta?.campaignTitle && meta.campaignTitle !== 'BCM Ebenezer' ? meta.campaignTitle : '') ||
              (sData?.category === 'ralna' || meta?.category === 'ralna' || matchedCamp?.category === 'ralna' ? 'Lalrinpuii Ralna' : '') ||
              'RonPay Community Bawm';

            const verifiedTx: Transaction = {
              id: route.receiptId!,
              campaignId: targetCampId || matchedCamp?.id || 'cmp-custom',
              campaignTitle: resolvedCampTitle,
              donorName: baseTx?.donorName || (sData?.isAnonymous || meta?.isAnonymous ? 'Anonymous' : (sData?.donorName || meta?.donorName || 'Valued Donor')),
              donorPhone: baseTx?.donorPhone || sData?.donorPhone || meta?.donorPhone,
              isAnonymous: Boolean(baseTx?.isAnonymous || sData?.isAnonymous || meta?.isAnonymous),
              amount: base,
              platformFee: fee,
              totalAmount: total,
              category: (baseTx?.category || sData?.category || meta?.category || matchedCamp?.category || 'others') as any,
              paymentMethod: 'phonepe',
              status: 'completed',
              timestamp: baseTx?.timestamp || new Date().toISOString(),
              referenceNo: sData?.transactionId || sData?.paymentInstrument?.utr || baseTx?.referenceNo || `T${Date.now()}`,
              verifiedAt: new Date().toISOString(),
              feeOption: (baseTx?.feeOption || sData?.feeOption || meta?.feeOption || 'ADD_ON') as any,
              campaignNetReceived: base,
              utr: sData?.paymentInstrument?.utr || baseTx?.utr || ('UTR' + Math.floor(100000000000 + Math.random() * 900000000000))
            };

            setCompletedTransaction(verifiedTx);
            saveTransaction(verifiedTx);
            recordUserPaidTxId(verifiedTx.id);
            setCurrentScreen('success');
            setAppView('app');
          }
        })
        .catch(() => {
          // If server query failed, only honor if previously recorded as completed
          if (found && found.status === 'completed') {
            setCompletedTransaction(found);
            recordUserPaidTxId(found.id);
            setCurrentScreen('success');
            setAppView('app');
          }
        });
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
    if (route.isPhonePeOpen) {
      const origin = typeof window !== 'undefined' && window.location.origin ? window.location.origin : 'https://ronpay.app';
      try {
        window.open(`/api/phonepe/launch-pay?amt=100&origin=${encodeURIComponent(origin)}`, '_blank');
      } catch (e) {}
      const stored = getStoredCampaigns();
      const targetCamp = campaigns[0] || stored[0];
      if (targetCamp) {
        setSelectedCampaign(targetCamp);
        setSelectedCategory(targetCamp.category);
      }
      setCurrentScreen('checkout');
      setAppView('app');
    }
  }, []);

  // Deep linking: Listen for popstate and hashchange to keep browser history synchronized
  useEffect(() => {
    const handlePopState = () => {
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
      if (matched && matched !== selectedCampaign) {
        setSelectedCampaign(matched);
      }
    }
  }, [campaigns, selectedCampaign?.id]);

  // Handlers for Navigation
  const handleNavigate = (screen: ScreenId) => {
    // Biometric Security Gate for Creator Studio
    if (screen === 'create_qr') {
      if (!creatorProfile.isApproved || !creatorProfile.phone) {
        handleNavigate('creator_reg');
        return;
      }

      if (!isCreatorStudioUnlocked) {
        setBiometricTarget('creator_studio');
        setBiometricTitle('Creator Studio Security Access');
        setBiometricSubtitle(`${creatorProfile.name || 'Creator'} Studio luh nan Fingerprint / Face ID emaw PIN hmangin verify rawh le.`);
        setBiometricCallback(() => () => {
          setIsCreatorStudioUnlocked(true);
          setCurrentScreen('create_qr');
          updateBrowserUrl('create_qr');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        });
        setIsBiometricModalOpen(true);
        return;
      }
    }

    setCurrentScreen(screen);
    if (screen === 'home') {
      setSelectedCampaign(null);
      updateBrowserUrl('home', null, null);
    } else if (screen === 'explorer') {
      updateBrowserUrl('explorer', null, selectedCategory);
    } else if (screen === 'checkout' && selectedCampaign) {
      updateBrowserUrl('checkout', selectedCampaign, selectedCampaign.category);
    } else {
      updateBrowserUrl(screen);
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
    handleNavigate('success');
  };

  const handlePaymentSuccess = (transaction: Transaction) => {
    saveTransaction(transaction);
    recordUserPaidTxId(transaction.id);
    setCompletedTransaction(transaction);
    reloadLocalData();
    handleNavigate('success');
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
    saveCampaign(campaign);
    setCampaigns(prev => {
      const idx = prev.findIndex(c => c.id === campaign.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = campaign;
        return copy;
      }
      return [campaign, ...prev];
    });
  };

  const handleDeleteCampaign = (campaignId: string) => {
    const cleanId = String(campaignId).toLowerCase().trim();
    deleteStoredCampaign(campaignId);
    setCampaigns(prev => prev.filter(c => String(c.id).toLowerCase().trim() !== cleanId));
    setTransactions(getStoredTransactions());
    if (selectedCampaign && String(selectedCampaign.id).toLowerCase().trim() === cleanId) {
      setSelectedCampaign(null);
    }
  };

  const handleApproveCampaign = (campaign: Campaign) => {
    const approvedCamp: Campaign = { ...campaign, status: 'active', isApproved: true };
    handleUpdateCampaign(approvedCamp);
    recordAuditLog('Campaign Approved', `Campaign "${campaign.title}" approved by Admin`, 'campaign', campaign.id);
  };

  const handleRejectCampaign = (campaignId: string, remarks?: string) => {
    const updated = campaigns.map(c => (c.id === campaignId ? { ...c, status: 'rejected', approvalRemarks: remarks } : c));
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
    const guest = logoutCreator();
    setCreatorProfile(guest);
    setIsCreatorStudioUnlocked(false);
    setIsProfileOpen(false);
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
    setAppView('app');
    updateBrowserView('app', (targetScreen as ScreenId) || 'home');
  };

  const handleSwitchToWebsite = () => {
    setAppView('website');
    updateBrowserView('website');
  };

  const handleOpenPhonePeCheckout = (amount: number = 100) => {
    const origin = typeof window !== 'undefined' && window.location.origin ? window.location.origin : 'https://ronpay.app';
    const launchUrl = `/api/phonepe/launch-pay?amt=${amount}&origin=${encodeURIComponent(origin)}`;
    try {
      window.open(launchUrl, '_blank');
    } catch (e) {
      window.location.href = launchUrl;
    }
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
          <SplashScreen onFinish={() => setShowSplash(false)} minDurationMs={400} />
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

  return (
    <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-slate-100 text-slate-900 font-sans antialiased flex flex-col items-center">
      {/* Animated Zero-White-Screen Splash Overlay */}
      {showSplash && (
        <SplashScreen onFinish={() => setShowSplash(false)} minDurationMs={600} />
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
                handleNavigate('explorer');
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
                  loginCreator(profile);
                  setCreatorProfile(profile);
                  setSelectedCategory(cat);
                  setIsCreatorStudioUnlocked(true);
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
                loginCreator(profile);
                setCreatorProfile(profile);
                setSelectedCategory(cat);
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
              onGoHome={() => handleNavigate('home')}
              onExploreMore={() => handleNavigate('explorer')}
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
                handleNavigate('checkout');
              }}
              onGoHome={() => handleNavigate('home')}
              onExploreMore={() => handleNavigate('explorer')}
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

