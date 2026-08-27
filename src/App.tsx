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
import {
  getStoredCampaigns,
  saveStoredCampaigns,
  saveCampaign,
  getStoredTransactions,
  saveStoredTransactions,
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
  recordUserPaidTxId,
  recordAuditLog,
  restoreFullDatabaseBackup,
  isUserPaidTransaction,
  getStoredUserPaidTxIds,
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
import { ExternalUPILandingModal } from './components/ExternalUPILandingModal';
import { ImagePreviewModal } from './components/ImagePreviewModal';
import { PrintPreviewModal } from './components/PrintPreviewModal';

export default function App() {
  // Navigation & View States
  const [currentScreen, setCurrentScreen] = useState<ScreenId>('home');
  const [selectedCategory, setSelectedCategory] = useState<BawmCategory>('ralna');
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [completedTransaction, setCompletedTransaction] = useState<Transaction | null>(null);
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
  const [isScannerOpen, setIsScannerOpen] = useState<boolean>(false);
  const [scannerCategory, setScannerCategory] = useState<BawmCategory | 'any'>('any');
  const [isShareModalOpen, setIsShareModalOpen] = useState<boolean>(false);
  const [shareCampaign, setShareCampaign] = useState<Campaign | null>(null);
  const [isGeneratedQROpen, setIsGeneratedQROpen] = useState<boolean>(false);
  const [generatedQRCampaign, setGeneratedQRCampaign] = useState<Campaign | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState<boolean>(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false);
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

  // Handlers for Navigation
  const handleNavigate = (screen: ScreenId) => {
    setCurrentScreen(screen);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectBawm = (category: BawmCategory) => {
    setSelectedCategory(category);
    handleNavigate('explorer');
  };

  const handleSelectCampaign = (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    setSelectedCategory(campaign.category);
    handleNavigate('checkout');
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
    setIsHistoryOpen(true);
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
    setCampaigns(prev => {
      const idx = prev.findIndex(c => c.id === campaign.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = campaign;
        return copy;
      }
      return [campaign, ...prev];
    });
    setGeneratedQRCampaign(campaign);
    setIsGeneratedQROpen(true);
    reloadLocalData();
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
    const updated = campaigns.map(c => (c.id === campaign.id ? campaign : c));
    setCampaigns(updated);
    saveStoredCampaigns(updated);
    syncCampaignToFirestore(campaign).catch(() => {});
  };

  const handleDeleteCampaign = (campaignId: string) => {
    const updated = campaigns.filter(c => c.id !== campaignId);
    setCampaigns(updated);
    saveStoredCampaigns(updated);
    deleteCampaignFromFirestore(campaignId).catch(() => {});
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
    const updated = transactions.map(t => (t.id === transaction.id ? transaction : t));
    setTransactions(updated);
    saveStoredTransactions(updated);
    saveTransaction(transaction);
  };

  const handleDeleteTransaction = (transactionId: string) => {
    const updated = transactions.filter(t => t.id !== transactionId);
    setTransactions(updated);
    saveStoredTransactions(updated);
    deleteTransactionFromFirestore(transactionId).catch(() => {});
  };

  const handleUpdateCreator = (creator: CreatorProfile) => {
    const updatedList = creators.map(cr => (cr.phone === creator.phone ? creator : cr));
    setCreators(updatedList);
    saveStoredCreatorsList(updatedList);
    if (creatorProfile.phone === creator.phone) {
      setCreatorProfile(creator);
      saveStoredCreatorProfile(creator);
    }
    syncCreatorToFirestore(creator).catch(() => {});
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
  const userVisibleTransactions = transactions.filter(t => isUserPaidTransaction(t, userPaidIds, creatorProfile));

  return (
    <div className="min-h-screen w-full max-w-[100vw] overflow-x-hidden bg-slate-100 text-slate-900 font-sans antialiased flex flex-col items-center">
      {/* Container with responsive boundary */}
      <div className={`w-full ${isDesktopView ? 'max-w-6xl' : 'max-w-md'} bg-white min-h-screen flex flex-col shadow-xl transition-all duration-300 relative overflow-x-hidden`}>
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
        />

        {/* Main Body Screen Router */}
        <main className="flex-1 w-full max-w-full px-3 sm:px-4 py-4 pb-20 overflow-y-auto overflow-x-hidden">
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
              onOpenBillService={handleOpenBillService}
              onOpenReports={handleOpenReports}
              onOpenMemberRoll={handleOpenMemberRoll}
              onShowBalance={() => setIsProfileOpen(true)}
              onShowBankTransfer={() => setIsPhonePeOpen(true)}
              onOpenAdminDashboard={() => setIsAdminDashboardOpen(true)}
              onOpenPhonePePortal={() => setIsPhonePeOpen(true)}
              onPreviewImage={handlePreviewImage}
              language={language}
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

          {currentScreen === 'checkout' && selectedCampaign && (
            <CheckoutScreen
              category={selectedCategory}
              campaign={selectedCampaign}
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
              onBack={() => handleNavigate('home')}
              onOpenLogin={() => handleNavigate('creator_reg')}
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
              onGoHome={() => handleNavigate('home')}
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
          onOpenPhonePePortal={() => setIsPhonePeOpen(true)}
          onLogout={handleLogout}
          onLoginClick={() => {
            setIsProfileOpen(false);
            handleNavigate('creator_reg');
          }}
          onOpenAdmin={() => {
            setIsProfileOpen(false);
            setIsAdminDashboardOpen(true);
          }}
          biometricEnabled={biometricEnabled}
          onToggleBiometric={handleToggleBiometric}
          onUpdateProfile={(p) => {
            setCreatorProfile(p);
            saveStoredCreatorProfile(p);
          }}
        />

        <PeknaSulhnuModal
          isOpen={isHistoryOpen}
          transactions={userVisibleTransactions}
          onClose={() => setIsHistoryOpen(false)}
          onOpenReceipt={(tx) => {
            setCompletedTransaction(tx);
            setIsHistoryOpen(false);
            handleNavigate('success');
          }}
        />

        <PhonePeModal
          isOpen={isPhonePeOpen}
          onClose={() => setIsPhonePeOpen(false)}
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
      </div>
    </div>
  );
}
