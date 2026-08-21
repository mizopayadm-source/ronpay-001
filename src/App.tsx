/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  ScreenId, 
  BawmCategory, 
  Campaign, 
  Transaction, 
  CreatorProfile, 
  BillService,
  SystemPricingConfig,
  AnnouncementBanner
} from './types';
import { 
  getStoredCampaigns, 
  saveStoredCampaigns, 
  getStoredTransactions, 
  saveStoredTransactions, 
  getStoredCreatorProfile, 
  saveStoredCreatorProfile,
  getStoredCreatorsList,
  saveStoredCreatorsList,
  getStoredPricingConfig,
  saveStoredPricingConfig,
  getStoredUserPaidTxIds,
  recordUserPaidTxId,
  isUserPaidTransaction,
  syncWithGoogleScript,
  getStoredAnnouncement,
  saveStoredAnnouncement
} from './utils/storage';
import { INITIAL_CAMPAIGNS, INITIAL_TRANSACTIONS, BAWM_CONFIG } from './data/initialData';
import { Header } from './components/Header';
import { HomeScreen } from './components/HomeScreen';
import { BawmExplorerScreen } from './components/BawmExplorerScreen';
import { CheckoutScreen } from './components/CheckoutScreen';
import { CreatorRegScreen } from './components/CreatorRegScreen';
import { CreateQRScreen } from './components/CreateQRScreen';
import { ReportsScreen } from './components/ReportsScreen';
import { SuccessScreen } from './components/SuccessScreen';
import { CashPendingScreen } from './components/CashPendingScreen';
import { QRScannerModal } from './components/QRScannerModal';
import { GeneratedQRModal } from './components/GeneratedQRModal';
import { UpgradeModal } from './components/UpgradeModal';
import { MismatchModal } from './components/MismatchModal';
import { BillPaymentModal } from './components/BillPaymentModal';
import { ProfileModal } from './components/ProfileModal';
import { PhonePeModal } from './components/PhonePeModal';
import { ImagePreviewModal } from './components/ImagePreviewModal';
import { ExternalUPILandingModal } from './components/ExternalUPILandingModal';
import { AdminApprovalModal } from './components/AdminApprovalModal';
import { PeknaSulhnuModal } from './components/PeknaSulhnuModal';
import { AdminDashboardModal } from './components/AdminDashboardModal';
import { QRShareModal } from './components/QRShareModal';
import { OfflineStatusBanner } from './components/OfflineStatusBanner';
import { BiometricAuthModal } from './components/BiometricAuthModal';
import { KumtluangMemberManagerModal } from './components/KumtluangMemberManagerModal';
import { Language } from './utils/translations';
import { Home, QrCode, FileText, User, Zap } from 'lucide-react';

export default function App() {
  // Navigation State
  const [currentScreen, setCurrentScreen] = useState<ScreenId>('screen-home');
  const [currentCategory, setCurrentCategory] = useState<BawmCategory>('ralna');
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | undefined>(undefined);
  
  // Data State
  const [campaigns, setCampaigns] = useState<Campaign[]>(getStoredCampaigns);
  const [transactions, setTransactions] = useState<Transaction[]>(getStoredTransactions);
  const [userPaidTxIds, setUserPaidTxIds] = useState<string[]>(getStoredUserPaidTxIds);
  const [creatorProfile, setCreatorProfile] = useState<CreatorProfile>(getStoredCreatorProfile);
  const [creatorsList, setCreatorsList] = useState<CreatorProfile[]>(getStoredCreatorsList);
  const [pricingConfig, setPricingConfig] = useState<SystemPricingConfig>(getStoredPricingConfig);
  const [announcement, setAnnouncement] = useState<AnnouncementBanner>(getStoredAnnouncement);

  // Modals & Overlays
  const [isScannerOpen, setIsScannerOpen] = useState<boolean>(false);
  const [scannerTarget, setScannerTarget] = useState<BawmCategory | 'any'>('any');
  
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState<boolean>(false);
  const [isGeneratedQRModalOpen, setIsGeneratedQRModalOpen] = useState<boolean>(false);
  const [latestGeneratedCampaign, setLatestGeneratedCampaign] = useState<Campaign | null>(null);

  const [isMismatchModalOpen, setIsMismatchModalOpen] = useState<boolean>(false);
  const [mismatchIntended, setMismatchIntended] = useState<BawmCategory>('ralna');
  const [mismatchActual, setMismatchActual] = useState<BawmCategory>('khawlsak');

  const [activeBillService, setActiveBillService] = useState<BillService | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(false);
  const [isPhonePeModalOpen, setIsPhonePeModalOpen] = useState<boolean>(false);
  
  // External UPI & Admin Approval Modals
  const [isExternalUPIModalOpen, setIsExternalUPIModalOpen] = useState<boolean>(false);
  const [externalUPICampaign, setExternalUPICampaign] = useState<Campaign | null>(null);

  const [isAdminApprovalModalOpen, setIsAdminApprovalModalOpen] = useState<boolean>(false);
  const [pendingCampaignToReview, setPendingCampaignToReview] = useState<Campaign | null>(null);

  // Full-size image preview modal state
  const [previewImageData, setPreviewImageData] = useState<{
    url: string;
    title?: string;
    subtitle?: string;
    location?: string;
  } | null>(null);

  const [latestTransaction, setLatestTransaction] = useState<Transaction | null>(null);
  const [isDesktopView, setIsDesktopView] = useState<boolean>(false);

  // Localization & Extra Modals
  const [language, setLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem('ronpay_language');
    return (saved === 'english' || saved === 'mizo') ? saved : 'mizo';
  });
  const [isPeknaSulhnuOpen, setIsPeknaSulhnuOpen] = useState<boolean>(false);
  const [isAdminDashboardOpen, setIsAdminDashboardOpen] = useState<boolean>(false);
  const [isMemberRollOpen, setIsMemberRollOpen] = useState<boolean>(false);
  const [memberRollInitialTab, setMemberRollInitialTab] = useState<'quick_entry' | 'register_member' | 'members_list' | 'print_reports'>('quick_entry');
  const [isShareModalOpen, setIsShareModalOpen] = useState<boolean>(false);
  const [shareCampaign, setShareCampaign] = useState<Campaign | null>(null);

  // Biometric Security Layer State
  const [biometricEnabled, setBiometricEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('ronpay_biometric_enabled');
    return saved !== null ? saved === 'true' : true; // Enabled by default
  });
  const [isBiometricPromptOpen, setIsBiometricPromptOpen] = useState<boolean>(false);
  const [pendingSecureTarget, setPendingSecureTarget] = useState<'sulhnu' | 'profile' | null>(null);
  const [isBiometricSessionUnlocked, setIsBiometricSessionUnlocked] = useState<boolean>(false);

  const handleOpenSecureHistory = () => {
    if (biometricEnabled && !isBiometricSessionUnlocked) {
      setPendingSecureTarget('sulhnu');
      setIsBiometricPromptOpen(true);
    } else {
      setIsPeknaSulhnuOpen(true);
    }
  };

  const handleOpenSecureProfile = () => {
    if (biometricEnabled && !isBiometricSessionUnlocked) {
      setPendingSecureTarget('profile');
      setIsBiometricPromptOpen(true);
    } else {
      setIsProfileModalOpen(true);
    }
  };

  const handleBiometricSuccess = () => {
    setIsBiometricSessionUnlocked(true);
    setIsBiometricPromptOpen(false);
    if (pendingSecureTarget === 'sulhnu') {
      setIsPeknaSulhnuOpen(true);
    } else if (pendingSecureTarget === 'profile') {
      setIsProfileModalOpen(true);
    }
    setPendingSecureTarget(null);
  };

  const handleToggleBiometric = () => {
    const nextVal = !biometricEnabled;
    setBiometricEnabled(nextVal);
    localStorage.setItem('ronpay_biometric_enabled', String(nextVal));
  };

  const handleLockSessionNow = () => {
    setIsBiometricSessionUnlocked(false);
    setIsPeknaSulhnuOpen(false);
    setIsProfileModalOpen(false);
  };

  const handleToggleLanguage = (lang: Language) => {
    setLanguage(lang);
    localStorage.setItem('ronpay_language', lang);
  };

  const handleShareCampaign = (campaign: Campaign) => {
    setShareCampaign(campaign);
    setIsShareModalOpen(true);
  };

  // Sync to local storage
  useEffect(() => {
    saveStoredCampaigns(campaigns);
  }, [campaigns]);

  useEffect(() => {
    saveStoredTransactions(transactions);
  }, [transactions]);

  useEffect(() => {
    saveStoredCreatorProfile(creatorProfile);
  }, [creatorProfile]);

  useEffect(() => {
    saveStoredPricingConfig(pricingConfig);
  }, [pricingConfig]);

  // Handle shared campaign URL query parameters on startup
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const urlCampaignId = params.get('campaignId');
      if (urlCampaignId) {
        const found = campaigns.find(
          c => c.id === urlCampaignId || c.id.toLowerCase() === urlCampaignId.toLowerCase()
        );
        if (found) {
          setSelectedCampaign(found);
          setCurrentCategory(found.category);
          setCurrentScreen('screen-checkout');
        }
      }
    } catch (e) {
      console.error('Error handling campaign URL param:', e);
    }
  }, []);

  // Navigate to screen
  const navigateTo = (screen: ScreenId) => {
    setCurrentScreen(screen);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Select Bawm from Home -> Opens Bawm Explorer & Search Engine
  const handleSelectBawm = (cat: BawmCategory) => {
    setCurrentCategory(cat);
    navigateTo('screen-bawm-explorer');
  };

  // Select specific campaign from Bawm Explorer or Home
  const handleSelectCampaignFromExplorer = (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    setCurrentCategory(campaign.category);
    navigateTo('screen-checkout');
  };

  // Start Scanner
  const handleStartScanner = (category: BawmCategory | 'any' = 'any') => {
    setScannerTarget(category);
    setIsScannerOpen(true);
  };

  // Scan Result Triggered
  const handleScanResult = (payload: {
    type: BawmCategory | 'general-upi' | 'pending';
    campaign?: Campaign;
    rawText?: string;
  }) => {
    setIsScannerOpen(false);

    // 1. Pending Admin Approval QR
    if (payload.type === 'pending') {
      const camp = payload.campaign || campaigns.find(c => c.status === 'pending_approval') || {
        id: 'cmp-pending-detected',
        category: 'ralna',
        title: 'Community Bawm (Waiting for Approval)',
        location: 'Aizawl, Mizoram',
        gpsCoords: '23.7271, 92.7176',
        upiId: 'ronpay@axl',
        validityDate: '2026-12-31',
        status: 'pending_approval',
        createdAt: new Date().toISOString(),
      } as Campaign;

      setPendingCampaignToReview(camp);
      setIsAdminApprovalModalOpen(true);
      return;
    }

    // 2. External UPI QR Scan (GPay / PhonePe / Paytm)
    if (payload.type === 'general-upi') {
      // If a specific campaign was scanned or target is active, show the rich external UPI landing
      const matchedCamp = payload.campaign || (scannerTarget !== 'any' ? campaigns.find(c => c.category === scannerTarget) : campaigns[0]);
      if (matchedCamp) {
        setExternalUPICampaign(matchedCamp);
        setIsExternalUPIModalOpen(true);
      } else {
        alert('📱 External UPI QR detected!\n\nRedirecting to Customer UPI Apps (GPay / PhonePe / Paytm)...');
        window.location.href = 'upi://pay?pa=mizopay@axl&pn=RonPayCustomer';
      }
      return;
    }

    // 3. Bawm category scanned
    const actualCategory = payload.type;
    const camp = payload.campaign || campaigns.find(c => c.category === actualCategory && c.status === 'active');

    // Check mismatch if specific target was set
    if (scannerTarget !== 'any' && scannerTarget !== actualCategory) {
      setMismatchIntended(scannerTarget);
      setMismatchActual(actualCategory);
      setIsMismatchModalOpen(true);
    } else {
      setSelectedCampaign(camp);
      setCurrentCategory(actualCategory);
      navigateTo('screen-checkout');
    }
  };

  // Admin approves pending campaign
  const handleApproveCampaign = (campToApprove: Campaign) => {
    const updated: Campaign = {
      ...campToApprove,
      status: 'active',
    };

    setCampaigns(prev => {
      const exists = prev.some(c => c.id === updated.id);
      const list = exists ? prev.map(c => c.id === updated.id ? updated : c) : [updated, ...prev];
      saveStoredCampaigns(list);
      return list;
    });

    setIsAdminApprovalModalOpen(false);
    setSelectedCampaign(updated);
    setCurrentCategory(updated.category);
    alert(`✅ ADMIN APPROVAL SUCCESSFUL!\n\n"${updated.title}" hi active a ni ta e. Tunah hian sum pekte pawh pek nghal theih a ni e.`);
    navigateTo('screen-checkout');
  };

  // Mismatch redirect
  const handleMismatchRedirect = () => {
    setIsMismatchModalOpen(false);
    const found = campaigns.find(c => c.category === mismatchActual && c.status === 'active');
    setSelectedCampaign(found);
    setCurrentCategory(mismatchActual);
    navigateTo('screen-checkout');
  };

  // Create QR click navigation (Enforces User First flow, prompts registration/login if not logged in)
  const handleCreateQRNav = () => {
    if (!creatorProfile.isApproved) {
      navigateTo('screen-creator-reg');
    } else {
      navigateTo('screen-create-qr');
    }
  };

  // Logout Creator session (Resets to standard user)
  const handleCreatorLogout = () => {
    const unauthenticatedProfile: CreatorProfile = {
      name: '',
      orgName: '',
      designation: '',
      phone: '',
      isPhoneVerified: false,
      isApproved: false,
      approvedCategories: [],
      createdQRsCount: 0,
    };
    setCreatorProfile(unauthenticatedProfile);
    saveStoredCreatorProfile(unauthenticatedProfile);
    alert('🔒 Creator Account Logout hlawhtling ta!\nUser pangngai dinhmunah i let leh ta e.');
    navigateTo('screen-home');
  };

  // Registration/Login complete
  const handleRegistrationSuccess = (updatedProfile: CreatorProfile, selectedCat: BawmCategory) => {
    setCreatorProfile(updatedProfile);
    saveStoredCreatorProfile(updatedProfile);
    if (updatedProfile.isAdmin || updatedProfile.phone === 'admin') {
      setIsAdminDashboardOpen(true);
      navigateTo('screen-admin');
      return;
    }
    setCurrentCategory(selectedCat);
    navigateTo('screen-create-qr');
  };

  // Upgrade category approved
  const handleUpgradeCategory = (newCat: BawmCategory) => {
    const updatedApproved = Array.from(new Set([...creatorProfile.approvedCategories, newCat]));
    const updated: CreatorProfile = {
      ...creatorProfile,
      approvedCategories: updatedApproved,
    };
    setCreatorProfile(updated);
    setCurrentCategory(newCat);
  };

  // Creator Profile update (e.g. name edit, org name, designation)
  const handleUpdateCreatorProfile = (updated: CreatorProfile) => {
    setCreatorProfile(updated);
    saveStoredCreatorProfile(updated);
    setCreatorsList(prev => {
      const idx = prev.findIndex(c => c.phone === updated.phone);
      let nextList: CreatorProfile[];
      if (idx >= 0) {
        nextList = [...prev];
        nextList[idx] = updated;
      } else {
        nextList = [updated, ...prev];
      }
      saveStoredCreatorsList(nextList);
      return nextList;
    });
  };

  // Generate QR submitted
  const handleGenerateQR = (newCampaign: Campaign) => {
    setCampaigns(prev => [newCampaign, ...prev]);
    setLatestGeneratedCampaign(newCampaign);
    setIsGeneratedQRModalOpen(true);

    // Sync to webhook
    syncWithGoogleScript({
      action: 'create_qr',
      campaign: newCampaign,
      creator: creatorProfile.name,
      timestamp: new Date().toISOString()
    });
  };

  // Update existing campaign (Edit QR details)
  const handleUpdateCampaign = (updatedCampaign: Campaign) => {
    setCampaigns(prev => {
      const updated = prev.map(c => c.id === updatedCampaign.id ? updatedCampaign : c);
      saveStoredCampaigns(updated);
      return updated;
    });
    
    // Sync to webhook
    syncWithGoogleScript({
      action: 'update_qr',
      campaign: updatedCampaign,
      creator: creatorProfile.name,
      timestamp: new Date().toISOString()
    });
  };

  // Update existing transaction (e.g. category breakdown / amount / donor edit)
  const handleUpdateTransaction = (updatedTx: Transaction) => {
    setTransactions(prev => {
      const updated = prev.map(t => t.id === updatedTx.id ? updatedTx : t);
      saveStoredTransactions(updated);
      return updated;
    });

    // Sync to webhook
    syncWithGoogleScript({
      action: 'update_transaction',
      transaction: updatedTx,
      creator: creatorProfile.name,
      timestamp: new Date().toISOString()
    });
  };

  // Delete transaction
  const handleDeleteTransaction = (transactionId: string) => {
    setTransactions(prev => {
      const filtered = prev.filter(t => t.id !== transactionId);
      saveStoredTransactions(filtered);
      return filtered;
    });

    // Sync to webhook
    syncWithGoogleScript({
      action: 'delete_transaction',
      transactionId: transactionId,
      creator: creatorProfile.name,
      timestamp: new Date().toISOString()
    });
  };

  // Payment completed
  const handlePaymentSuccess = (transaction: Transaction) => {
    recordUserPaidTxId(transaction.id);
    setUserPaidTxIds(prev => [transaction.id, ...prev]);
    setTransactions(prev => {
      const updated = [transaction, ...prev];
      saveStoredTransactions(updated);
      return updated;
    });
    setLatestTransaction(transaction);
    navigateTo('screen-success');

    // Webhook sync
    syncWithGoogleScript({
      action: 'online_donation',
      transaction: transaction,
      timestamp: new Date().toISOString()
    });
  };

  // Cash pending submitted
  const handleCashPending = (transaction: Transaction) => {
    recordUserPaidTxId(transaction.id);
    setUserPaidTxIds(prev => [transaction.id, ...prev]);
    setTransactions(prev => {
      const updated = [transaction, ...prev];
      saveStoredTransactions(updated);
      return updated;
    });
    setLatestTransaction(transaction);
    navigateTo('screen-cash-pending');

    // Webhook sync
    syncWithGoogleScript({
      action: 'cash_entry',
      transaction: transaction,
      timestamp: new Date().toISOString()
    });
  };

  // Utility Bill payment
  const handleBillPaymentComplete = (amount: number, serviceName: string) => {
    const billTxn: Transaction = {
      id: 'BILL-' + Math.floor(100000 + Math.random() * 900000),
      campaignId: 'bill-' + serviceName.toLowerCase().replace(/\s+/g, '-'),
      campaignTitle: `${serviceName} Bill Payment`,
      category: 'kumtluang',
      donorName: creatorProfile.name || 'Consumer User',
      isAnonymous: false,
      amount: amount,
      platformFee: 0,
      totalAmount: amount,
      paymentMethod: 'online',
      status: 'completed',
      timestamp: new Date().toISOString(),
      txHash: 'BILL' + Math.random().toString(36).substring(2, 9).toUpperCase(),
    };
    recordUserPaidTxId(billTxn.id);
    setUserPaidTxIds(prev => [billTxn.id, ...prev]);
    setTransactions(prev => {
      const updated = [billTxn, ...prev];
      saveStoredTransactions(updated);
      return updated;
    });
  };

  // Reset Demo Data
  const handleResetData = () => {
    if (confirm('Demo data zawng zawng reset i duh tak tak em?')) {
      setCampaigns(INITIAL_CAMPAIGNS);
      setTransactions(INITIAL_TRANSACTIONS);
      setIsProfileModalOpen(false);
      alert('Data reset a ni ta.');
    }
  };

  const handleOpenImagePreview = (url: string, title?: string, subtitle?: string, location?: string) => {
    setPreviewImageData({ url, title, subtitle, location });
  };

  return (
    <div className="min-h-screen bg-slate-950 flex justify-center items-center p-0 sm:p-3 md:p-5 text-slate-800 antialiased font-sans">
      {/* Outer Shell: Adaptive Responsive Frame */}
      <div className={`w-full bg-slate-50 shadow-2xl flex flex-col justify-between overflow-hidden relative transition-all duration-300 ${
        isDesktopView 
          ? 'max-w-5xl min-h-[92vh] sm:rounded-3xl sm:border-4 sm:border-slate-800' 
          : 'max-w-md md:max-w-2xl lg:max-w-3xl h-full min-h-screen sm:min-h-[850px] sm:max-h-[95vh] sm:rounded-[36px] sm:border-[6px] sm:border-slate-800'
      }`}>
        
        {/* Top App Header */}
        <Header
          currentScreen={currentScreen}
          onNavigate={navigateTo}
          onOpenScanner={() => handleStartScanner('any')}
          onOpenReports={() => navigateTo('screen-export-reports')}
          isDesktopView={isDesktopView}
          onToggleDesktopView={() => setIsDesktopView(!isDesktopView)}
          notificationCount={1}
          onOpenNotifications={() => alert('🔔 RonPay Notifications:\n• Pi Lalhmingliani Ralna campaign is live.\n• BCM Ebenezer Zobawk collection active.')}
          language={language}
          onToggleLanguage={handleToggleLanguage}
          onOpenHistory={handleOpenSecureHistory}
        />

        {/* Scrollable Main Body */}
        <main className="p-3.5 sm:p-5 flex-1 overflow-y-auto no-scrollbar relative space-y-3.5">
          {/* Offline Status Check & Notification Banner */}
          <OfflineStatusBanner
            language={language}
            campaignsCount={campaigns.length}
            onRefreshCache={() => setCampaigns(getStoredCampaigns())}
          />

          {currentScreen === 'screen-home' && (
            <HomeScreen
              onStartScanner={handleStartScanner}
              onCreateQRClick={handleCreateQRNav}
              onSelectBawm={handleSelectBawm}
              onOpenBillService={(srv) => setActiveBillService(srv)}
              campaigns={campaigns}
              transactions={transactions}
              creatorProfile={creatorProfile}
              announcement={announcement}
              onOpenReports={() => navigateTo('screen-export-reports')}
              onOpenMemberRoll={() => setIsMemberRollOpen(true)}
              onShowBalance={() => alert('💰 RonPay Wallet Balance: ₹12,450.00\nLinked Bank: State Bank of India (Aizawl Main Branch)')}
              onShowBankTransfer={() => alert('🏦 Bank Settlement Transfer:\nInstant IMPS / NEFT settlement active.')}
              onOpenPhonePePortal={() => setIsPhonePeModalOpen(true)}
              onSelectCampaign={handleSelectCampaignFromExplorer}
              language={language}
              onOpenHistory={handleOpenSecureHistory}
              onShareCampaign={handleShareCampaign}
            />
          )}

          {currentScreen === 'screen-bawm-explorer' && (
            <BawmExplorerScreen
              category={currentCategory}
              campaigns={campaigns}
              transactions={transactions}
              creatorProfile={creatorProfile}
              onBack={() => navigateTo('screen-home')}
              onSelectCampaign={handleSelectCampaignFromExplorer}
              onStartScanner={handleStartScanner}
              onPreviewImage={handleOpenImagePreview}
              onShareCampaign={handleShareCampaign}
              onCategoryChange={(cat) => setCurrentCategory(cat)}
              language={language}
            />
          )}

          {currentScreen === 'screen-checkout' && (
            <CheckoutScreen
              category={currentCategory}
              campaign={selectedCampaign}
              pricingConfig={pricingConfig}
              onBack={() => navigateTo('screen-home')}
              onPaymentSuccess={handlePaymentSuccess}
              onCashPending={handleCashPending}
              onOpenPhonePePortal={() => setIsPhonePeModalOpen(true)}
              onPreviewImage={handleOpenImagePreview}
              language={language}
            />
          )}

          {currentScreen === 'screen-creator-reg' && (
            <CreatorRegScreen
              onBack={() => navigateTo('screen-home')}
              onSuccess={handleRegistrationSuccess}
              creatorProfile={creatorProfile}
              onOpenAdminDashboard={() => setIsAdminDashboardOpen(true)}
            />
          )}

          {currentScreen === 'screen-create-qr' && (
            <CreateQRScreen
              onBack={() => navigateTo('screen-home')}
              onOpenUpgradeModal={() => setIsUpgradeModalOpen(true)}
              creatorProfile={creatorProfile}
              pricingConfig={pricingConfig}
              announcement={announcement}
              onGenerateQR={handleGenerateQR}
              onLogout={handleCreatorLogout}
              campaigns={campaigns}
              transactions={transactions}
              onUpdateCampaign={handleUpdateCampaign}
              onSelectCampaign={handleSelectCampaignFromExplorer}
              onUpdateCreatorProfile={handleUpdateCreatorProfile}
              onOpenMemberRoll={(tab) => {
                if (tab) setMemberRollInitialTab(tab);
                setIsMemberRollOpen(true);
              }}
            />
          )}

          {currentScreen === 'screen-export-reports' && (
            <ReportsScreen
              transactions={transactions}
              campaigns={campaigns}
              creatorProfile={creatorProfile}
              onBack={() => navigateTo('screen-home')}
              onOpenLogin={() => navigateTo('screen-creator-reg')}
              onUpdateCampaign={handleUpdateCampaign}
              onUpdateTransaction={handleUpdateTransaction}
              onDeleteTransaction={handleDeleteTransaction}
              onOpenImagePreview={handleOpenImagePreview}
              onOpenMemberRoll={(tab) => {
                if (tab) setMemberRollInitialTab(tab);
                setIsMemberRollOpen(true);
              }}
            />
          )}

          {currentScreen === 'screen-success' && (
            <SuccessScreen
              transaction={latestTransaction}
              onGoHome={() => navigateTo('screen-home')}
            />
          )}

          {currentScreen === 'screen-cash-pending' && (
            <CashPendingScreen
              transaction={latestTransaction}
              onGoHome={() => navigateTo('screen-home')}
            />
          )}
        </main>

        {/* Bottom Persistent Navigation Bar */}
        <nav className="bg-white border-t border-slate-200/90 px-6 py-2.5 flex justify-between items-center text-slate-400 text-xs shadow-lg shrink-0">
          <button
            onClick={() => navigateTo('screen-home')}
            className={`flex flex-col items-center transition cursor-pointer ${
              currentScreen === 'screen-home' ? 'text-indigo-600 font-extrabold' : 'hover:text-indigo-600'
            }`}
          >
            <Home className="w-4 h-4" />
            <span className="text-[9px] mt-0.5">Home</span>
          </button>

          <button
            onClick={handleCreateQRNav}
            className={`flex flex-col items-center transition cursor-pointer ${
              currentScreen === 'screen-create-qr' || currentScreen === 'screen-creator-reg' 
                ? 'text-amber-600 font-extrabold' 
                : 'hover:text-amber-600'
            }`}
          >
            <QrCode className="w-4 h-4" />
            <span className="text-[9px] mt-0.5">Studio</span>
          </button>

          <button
            onClick={() => navigateTo('screen-export-reports')}
            className={`flex flex-col items-center transition cursor-pointer ${
              currentScreen === 'screen-export-reports' ? 'text-indigo-600 font-extrabold' : 'hover:text-indigo-600'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span className="text-[9px] mt-0.5">Reports</span>
          </button>

          <button
            onClick={handleOpenSecureProfile}
            className="flex flex-col items-center hover:text-indigo-600 transition cursor-pointer"
          >
            <User className="w-4 h-4" />
            <span className="text-[9px] mt-0.5">Profile</span>
          </button>
        </nav>

        {/* Modals & Overlays */}
        <QRScannerModal
          isOpen={isScannerOpen}
          targetCategory={scannerTarget}
          campaigns={campaigns}
          onClose={() => setIsScannerOpen(false)}
          onScanResult={handleScanResult}
          onApproveCampaign={(campId) => {
            const c = campaigns.find(i => i.id === campId);
            if (c) handleApproveCampaign(c);
          }}
        />

        <ExternalUPILandingModal
          isOpen={isExternalUPIModalOpen}
          campaign={externalUPICampaign}
          onClose={() => setIsExternalUPIModalOpen(false)}
          onProceedRonPay={(camp) => {
            setIsExternalUPIModalOpen(false);
            setSelectedCampaign(camp);
            setCurrentCategory(camp.category);
            navigateTo('screen-checkout');
          }}
        />

        <AdminApprovalModal
          isOpen={isAdminApprovalModalOpen}
          campaign={pendingCampaignToReview}
          onClose={() => setIsAdminApprovalModalOpen(false)}
          onApprove={handleApproveCampaign}
        />

        <GeneratedQRModal
          isOpen={isGeneratedQRModalOpen}
          campaign={latestGeneratedCampaign}
          onClose={() => setIsGeneratedQRModalOpen(false)}
          onGoHome={() => {
            setIsGeneratedQRModalOpen(false);
            navigateTo('screen-home');
          }}
        />

        <UpgradeModal
          isOpen={isUpgradeModalOpen}
          onClose={() => setIsUpgradeModalOpen(false)}
          creatorProfile={creatorProfile}
          pricingConfig={pricingConfig}
          onUpgradeApproved={handleUpgradeCategory}
        />

        <MismatchModal
          isOpen={isMismatchModalOpen}
          intendedCategory={mismatchIntended}
          actualCategory={mismatchActual}
          onRedirect={handleMismatchRedirect}
          onClose={() => setIsMismatchModalOpen(false)}
        />

        <BillPaymentModal
          service={activeBillService}
          onClose={() => setActiveBillService(null)}
          onPaymentComplete={handleBillPaymentComplete}
        />

        <ProfileModal
          isOpen={isProfileModalOpen}
          onClose={() => setIsProfileModalOpen(false)}
          creatorProfile={creatorProfile}
          onUpdateProfile={handleUpdateCreatorProfile}
          onResetData={handleResetData}
          onOpenPhonePePortal={() => setIsPhonePeModalOpen(true)}
          onLogout={handleCreatorLogout}
          onOpenAdmin={() => setIsAdminDashboardOpen(true)}
          biometricEnabled={biometricEnabled}
          onToggleBiometric={handleToggleBiometric}
          onLockNow={handleLockSessionNow}
          onLoginClick={() => {
            setIsProfileModalOpen(false);
            navigateTo('screen-creator-reg');
          }}
        />

        <PhonePeModal
          isOpen={isPhonePeModalOpen}
          onClose={() => setIsPhonePeModalOpen(false)}
        />

        <ImagePreviewModal
          imageUrl={previewImageData?.url || null}
          title={previewImageData?.title}
          subtitle={previewImageData?.subtitle}
          location={previewImageData?.location}
          onClose={() => setPreviewImageData(null)}
        />

        {/* User Donation History / Pekna Sulhnu Modal */}
        <PeknaSulhnuModal
          isOpen={isPeknaSulhnuOpen}
          onClose={() => setIsPeknaSulhnuOpen(false)}
          transactions={transactions.filter(t => isUserPaidTransaction(t, userPaidTxIds, creatorProfile))}
          campaigns={campaigns}
        />

        {/* Biometric Security Authentication Modal */}
        <BiometricAuthModal
          isOpen={isBiometricPromptOpen}
          target={pendingSecureTarget || 'general'}
          onClose={() => {
            setIsBiometricPromptOpen(false);
            setPendingSecureTarget(null);
          }}
          onSuccess={handleBiometricSuccess}
        />

        {/* Secure Admin Dashboard Modal */}
        <AdminDashboardModal
          isOpen={isAdminDashboardOpen || currentScreen === 'screen-admin'}
          onClose={() => {
            setIsAdminDashboardOpen(false);
            if (currentScreen === 'screen-admin') {
              navigateTo('screen-home');
            }
          }}
          campaigns={campaigns}
          transactions={transactions}
          creators={(() => {
            const list = [...creatorsList];
            if (creatorProfile.phone) {
              const existingIdx = list.findIndex(c => c.phone === creatorProfile.phone);
              if (existingIdx >= 0) {
                list[existingIdx] = creatorProfile;
              } else {
                list.unshift(creatorProfile);
              }
            }
            return list;
          })()}
          pricingConfig={pricingConfig}
          onUpdatePricingConfig={(updated) => {
            setPricingConfig(updated);
            saveStoredPricingConfig(updated);
          }}
          onUpdateCampaign={handleUpdateCampaign}
          onDeleteCampaign={(campId) => {
            setCampaigns(prev => prev.filter(c => c.id !== campId));
            saveStoredCampaigns(campaigns.filter(c => c.id !== campId));
          }}
          onApproveCampaign={handleApproveCampaign}
          onUpdateCreator={(updated) => {
            if (creatorProfile.phone === updated.phone || (!creatorProfile.phone && updated.name === creatorProfile.name)) {
              setCreatorProfile(updated);
              saveStoredCreatorProfile(updated);
            }
            setCreatorsList(prev => {
              const idx = prev.findIndex(c => c.phone === updated.phone);
              let nextList: CreatorProfile[];
              if (idx >= 0) {
                nextList = [...prev];
                nextList[idx] = updated;
              } else {
                nextList = [updated, ...prev];
              }
              saveStoredCreatorsList(nextList);
              return nextList;
            });
          }}
          onResetData={handleResetData}
        />

        {/* Link & QR Code Share Modal */}
        <QRShareModal
          isOpen={isShareModalOpen}
          campaign={shareCampaign}
          onClose={() => {
            setIsShareModalOpen(false);
            setShareCampaign(null);
          }}
        />

        {/* Kumtluang Member Roll & Quick Entry Modal */}
        <KumtluangMemberManagerModal
          isOpen={isMemberRollOpen}
          initialTab={memberRollInitialTab}
          onClose={() => {
            setIsMemberRollOpen(false);
            setTransactions(getStoredTransactions());
          }}
          language={language}
          creatorProfile={creatorProfile}
          campaigns={campaigns}
          transactions={transactions}
          onDataUpdated={() => {
            setTransactions(getStoredTransactions());
            setCampaigns(getStoredCampaigns());
          }}
        />

      </div>
    </div>
  );
}
