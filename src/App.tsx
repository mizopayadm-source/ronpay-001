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
import { Language } from './utils/translations';
import { canHardDeleteCampaign } from './utils/campaignSafety';
import { BILL_SERVICES } from './data/initialData';
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
} from './services/firestoreSync';

// Components
import { Header } from './components/Header';
import { HomeScreen } from './components/HomeScreen';
import { BawmExplorerScreen } from './components/BawmExplorerScreen';
import { CheckoutScreen } from './components/CheckoutScreen';
import { CreateQRScreen } from './components/CreateQRScreen';
import { CreatorRegScreen } from './components/CreatorRegScreen';
import { ReportsScreen } from './components/ReportsScreen';
import { SuccessScreen } from './components/SuccessScreen';
import { CashPendingScreen } from './components/CashPendingScreen';
import { OfflineStatusBanner } from './components/OfflineStatusBanner';
import { BottomNav } from './components/BottomNav';
import { RonPayWebsite } from './components/RonPayWebsite';

// Modals
import { QRScannerModal } from './components/QRScannerModal';
import { QRShareModal } from './components/QRShareModal';
import { GeneratedQRModal } from './components/GeneratedQRModal';
import { ProfileModal } from './components/ProfileModal';
import { PeknaSulhnuModal } from './components/PeknaSulhnuModal';
import { NotificationsModal } from './components/NotificationsModal';
import { PhonePeModal } from './components/PhonePeModal';
import { BillPaymentModal } from './components/BillPaymentModal';
import { AdminDashboardModal } from './components/AdminDashboardModal';
import { AdminApprovalModal } from './components/AdminApprovalModal';
import { KumtluangMemberManagerModal } from './components/KumtluangMemberManagerModal';
import { MemberRollPreviewModal, PreviewReportFormat } from './components/MemberRollPreviewModal';
import { MismatchModal } from './components/MismatchModal';
import { UpgradeModal } from './components/UpgradeModal';
import { BiometricAuthModal } from './components/BiometricAuthModal';
import { ExternalUPILandingModal } from './components/ExternalUPILandingModal';
import { ImagePreviewModal } from './components/ImagePreviewModal';
import { PrintPreviewModal } from './components/PrintPreviewModal';
import { AIHriatpuiModal } from './components/AIHriatpuiModal';
import { BankTransferModal } from './components/BankTransferModal';
import { RonPayWalletModal } from './components/RonPayWalletModal';
import { SmartLoginModal } from './components/SmartLoginModal';
import { SplashScreen } from './components/SplashScreen';
import { ErrorBoundary } from './components/ErrorBoundary';
import { getUrlRoute, updateBrowserUrl } from './utils/urlRouting';

export default function App() {
  // Extract initial deep link routing parameters from URL (e.g. Google Lens, Camera, Web link)
  const initialRoute = typeof window !== 'undefined' ? getUrlRoute() : null;

  // Navigation & View States: Default to website on root / main domain
  const [currentScreen, setCurrentScreen] = useState<ScreenId>(() => initialRoute?.screen || 'website');

  // Splash screen state for smooth UX - only display when opening the app directly
  const [showSplash, setShowSplash] = useState<boolean>(() => {
    return !!(initialRoute?.screen && initialRoute.screen !== 'website');
  });
  const [selectedCategory, setSelectedCategory] = useState<BawmCategory>(() => initialRoute?.category || 'ralna');
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(() => initialRoute?.campaign || null);
  const [completedTransaction, setCompletedTransaction] = useState<Transaction | null>(() => {
    if (initialRoute?.receiptId) {
      const txs = getStoredTransactions();
      const found = txs.find(t => t.id.toLowerCase() === initialRoute.receiptId?.toLowerCase());
      if (found) return found;
      return {
        id: initialRoute.receiptId,
        campaignId: 'scanned-receipt',
        campaignTitle: 'RonPay Contribution',
        category: 'others',
        donorName: 'RonPay Contributor',
        donorPhone: '9862300000',
        amount: 0,
        platformFee: 0,
        totalAmount: 0,
        paymentMethod: 'online',
        status: 'completed',
        timestamp: new Date().toISOString(),
        txHash: initialRoute.receiptId,
      };
    }
    return null;
  });
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
  const [biometricTarget, setBiometricTarget] = useState<'sulhnu' | 'profile' | 'general'>('general');
  const [biometricCallback, setBiometricCallback] = useState<(() => void) | null>(null);
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
      }
    };

    window.addEventListener('ronpay_campaigns_updated', handleCampaignsSync);
    window.addEventListener('ronpay-campaigns-updated', handleCampaignsSync);
    window.addEventListener('ronpay_transactions_updated', handleTransactionsSync);
    window.addEventListener('ronpay-transactions-updated', handleTransactionsSync);
    window.addEventListener('ronpay-creator-updated', handleCreatorSync);
    window.addEventListener('ronpay_creator_profile_updated', handleCreatorSync);
    window.addEventListener('ronpay_creators_updated', handleCreatorsListSync);
    window.addEventListener('ronpay-members-updated', handleMembersSync);
    window.addEventListener('ronpay_members_updated', handleMembersSync);
    window.addEventListener('ronpay_data_synced', reloadLocalData);
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('ronpay_campaigns_updated', handleCampaignsSync);
      window.removeEventListener('ronpay-campaigns-updated', handleCampaignsSync);
      window.removeEventListener('ronpay_transactions_updated', handleTransactionsSync);
      window.removeEventListener('ronpay-transactions-updated', handleTransactionsSync);
      window.removeEventListener('ronpay-creator-updated', handleCreatorSync);
      window.removeEventListener('ronpay_creator_profile_updated', handleCreatorSync);
      window.removeEventListener('ronpay_creators_updated', handleCreatorsListSync);
      window.removeEventListener('ronpay-members-updated', handleMembersSync);
      window.removeEventListener('ronpay_members_updated', handleMembersSync);
      window.removeEventListener('ronpay_data_synced', reloadLocalData);
      window.removeEventListener('storage', handleStorageChange);
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

  // Apply route from current browser URL (for Google Lens, QR scans, and browser Back/Forward navigation)
  const applyRouteFromUrl = useCallback(() => {
    const route = getUrlRoute();
    if (!route) return;

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
    if (route.receiptId) {
      const txs = getStoredTransactions();
      let found = txs.find(t => 
        t && (
          t.id.toLowerCase() === route.receiptId?.toLowerCase() || 
          (t.txHash && t.txHash.toLowerCase() === route.receiptId?.toLowerCase())
        )
      );

      if (found) {
        if (found.status !== 'completed') {
          found = { ...found, status: 'completed' as const };
          saveTransaction(found);
          recordUserPaidTxId(found.id);
          reloadLocalData();
        } else {
          recordUserPaidTxId(found.id);
        }
        setCompletedTransaction(found);
      } else {
        // Auto-create and record transaction in RonPay database with 'completed' status upon gateway callback
        const autoTx: Transaction = {
          id: route.receiptId,
          campaignId: route.campaignId || 'cmp-upi-direct',
          campaignTitle: route.campaign?.title || 'RonPay UPI Contribution',
          category: route.category || 'others',
          donorName: 'Valued Donor',
          amount: 500,
          platformFee: 0,
          totalAmount: 500,
          paymentMethod: 'online',
          status: 'completed',
          remark: 'UPI Gateway Payment Verified',
          timestamp: new Date().toISOString(),
          txHash: route.receiptId,
        };
        saveTransaction(autoTx);
        recordUserPaidTxId(autoTx.id);
        setCompletedTransaction(autoTx);
        reloadLocalData();
      }
      setCurrentScreen('success');
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

  const handleSelectCampaign = (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    setSelectedCategory(campaign.category);
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
    const camp = campaigns.find(c => String(c.id).toLowerCase().trim() === cleanId);
    if (camp && !canHardDeleteCampaign(camp, transactions)) {
      alert('⚠️ Harsatna: He Bawm (Campaign) hian transaction record a nei tawh a, delete theih a ni lo. Cancel & Void emaw Edit Details hmang rawh.');
      return;
    }
    deleteStoredCampaign(campaignId);
    setCampaigns(prev => prev.filter(c => String(c.id).toLowerCase().trim() !== cleanId));
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

  const handleApproveTransaction = (transaction: Transaction) => {
    const updated: Transaction = {
      ...transaction,
      status: 'completed',
      verifiedBy: creatorProfile.name || (creatorProfile.isAdmin ? 'Admin' : 'Creator'),
      verifiedAt: new Date().toISOString(),
    };
    saveTransaction(updated);
    setTransactions(getStoredTransactions());
    if (completedTransaction && completedTransaction.id === transaction.id) {
      setCompletedTransaction(updated);
    }
    window.dispatchEvent(new CustomEvent('ronpay_transactions_updated'));
  };

  const handleRejectTransaction = (transaction: Transaction) => {
    const updated: Transaction = {
      ...transaction,
      status: 'rejected',
      verifiedBy: creatorProfile.name || (creatorProfile.isAdmin ? 'Admin' : 'Creator'),
      verifiedAt: new Date().toISOString(),
    };
    saveTransaction(updated);
    setTransactions(getStoredTransactions());
    if (completedTransaction && completedTransaction.id === transaction.id) {
      setCompletedTransaction(updated);
    }
    window.dispatchEvent(new CustomEvent('ronpay_transactions_updated'));
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
    setIsProfileOpen(false);
    handleNavigate('home');
  };

  // Filter transactions for Sulhnu History
  const userVisibleTransactions = getUserOrCreatorVisibleTransactions(
    transactions,
    campaigns,
    creatorProfile,
    userPaidIds
  );

  return (
    <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-slate-100 text-slate-900 font-sans antialiased flex flex-col items-center">
      {/* Animated Zero-White-Screen Splash Overlay */}
      {showSplash && (
        <SplashScreen onFinish={() => setShowSplash(false)} minDurationMs={600} />
      )}

      {/* Container with responsive boundary */}
      <div className={`w-full ${currentScreen === 'website' ? 'max-w-none bg-slate-950 text-slate-100' : `${isDesktopView ? 'max-w-6xl' : 'max-w-md'} bg-white text-slate-900 shadow-xl`} min-h-screen flex flex-col transition-all duration-300 relative overflow-x-hidden`}>
        {currentScreen === 'website' ? (
          <RonPayWebsite
            onLaunchApp={() => {
              if (!creatorProfile.phone) {
                setCreatorProfile(GUEST_CREATOR_PROFILE);
              }
              handleNavigate('home');
            }}
            onOpenCreateQR={() => {
              if (creatorProfile.isApproved && creatorProfile.phone) {
                handleNavigate('create_qr');
              } else {
                handleNavigate('creator_reg');
              }
            }}
            onOpenRegister={() => handleNavigate('creator_reg')}
            onOpenBillPay={(serviceId) => {
              if (serviceId) {
                const found = BILL_SERVICES.find(s => s.id === serviceId);
                if (found) setSelectedBillService(found);
              }
              setIsBillModalOpen(true);
              handleNavigate('home');
            }}
            onOpenAIKhualchhawn={() => setIsAIHriatpuiOpen(true)}
            initialLanguage={language}
          />
        ) : (
          <>
            {/* Offline & Connection Status Banner */}
            <OfflineStatusBanner onRefreshCache={reloadLocalData} />

            {/* Global Header */}
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
            />

            {/* Main Body Screen Router */}
            <main className="flex-1 w-full max-w-full px-3 sm:px-4 pt-3.5 pb-3 overflow-y-auto overflow-x-hidden">
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
              onPreviewImage={handlePreviewImage}
              language={language}
              onOpenAIHriatpui={() => setIsAIHriatpuiOpen(true)}
              onOpenLogin={() => setIsLoginModalOpen(true)}
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
              category={selectedCategory}
              campaign={selectedCampaign || campaigns.find(c => c.category === selectedCategory) || campaigns[0]}
              pricingConfig={pricingConfig}
              onBack={() => handleNavigate('explorer')}
              onPaymentSuccess={handlePaymentSuccess}
              onCashPending={handleCashPending}
              onOpenPhonePePortal={() => setIsPhonePeOpen(true)}
              onPreviewImage={handlePreviewImage}
              language={language}
            />
          )}

          {currentScreen === 'create_qr' && (
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
              language={language}
              onBack={() => handleNavigate('home')}
              onOpenLogin={() => handleNavigate('creator_reg')}
              onOpenCreateQR={() => handleNavigate('create_qr')}
              onUpdateCampaign={handleUpdateCampaign}
              onUpdateTransaction={handleUpdateTransaction}
              onDeleteTransaction={handleDeleteTransaction}
              onOpenImagePreview={handlePreviewImage}
              onOpenMemberRoll={handleOpenMemberRoll}
            />
          )}

          {currentScreen === 'success' && (
            <SuccessScreen
              transaction={completedTransaction}
              onGoHome={() => handleNavigate('home')}
              onExploreMore={() => handleNavigate('explorer')}
            />
          )}

          {currentScreen === 'cash_pending' && (
            <CashPendingScreen
              transaction={completedTransaction}
              campaigns={campaigns}
              creatorProfile={creatorProfile}
              onGoHome={() => handleNavigate('home')}
              onApproveCash={handleApproveTransaction}
              onOpenSulhnu={() => {
                setIsHistoryOpen(true);
                handleNavigate('home');
              }}
            />
          )}
        </main>

        {/* Global Footer Navigation (Home, Roll, Studio, Report, Profile) */}
        {currentScreen !== 'checkout' && (
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
          </>
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
            onApproveTransaction={handleApproveTransaction}
            onRejectTransaction={handleRejectTransaction}
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
          />
        </ErrorBoundary>

        <ErrorBoundary name="NotificationsModal">
          <NotificationsModal
            isOpen={isNotificationsOpen}
            onClose={() => setIsNotificationsOpen(false)}
            transactions={userVisibleTransactions}
            campaigns={campaigns}
            creatorProfile={creatorProfile}
            onOpenReceipt={(tx) => {
              setCompletedTransaction(tx);
              setIsNotificationsOpen(false);
              handleNavigate('success');
            }}
            onNavigateToCampaign={(camp) => {
              setIsNotificationsOpen(false);
              handleSelectCampaign(camp);
            }}
            onOpenMemberRoll={() => {
              setIsNotificationsOpen(false);
              setIsKumtluangManagerOpen(true);
            }}
            onUnreadCountChange={(count) => setNotificationCount(count)}
          />
        </ErrorBoundary>

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
          onClose={() => setIsBiometricModalOpen(false)}
          onSuccess={() => {
            setIsBiometricModalOpen(false);
            if (biometricCallback) biometricCallback();
          }}
        />

        <ExternalUPILandingModal
          isOpen={isExternalUPIOpen}
          campaign={externalUPICampaign}
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

