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
  saveStoredAnnouncement,
  getMembers
} from './utils/storage';
import { 
  startAutoSyncEngine, 
  fetchCampaignById, 
  saveCampaignToServer, 
  saveTransactionToServer,
  RONPAY_SYNC_EVENT,
  SyncDataState
} from './utils/syncEngine';
import { 
  initFCM, 
  onFCMNotification, 
  FCMNotificationPayload, 
  requestFCMNotificationPermission 
} from './services/fcmService';
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
import { PrintPreviewModal } from './components/PrintPreviewModal';
import { Language } from './utils/translations';
import { Home, QrCode, FileText, User, Zap, Users } from 'lucide-react';

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
  const [fcmToast, setFcmToast] = useState<FCMNotificationPayload | null>(null);

  // Initialize Firebase Cloud Messaging (FCM) on app mount
  useEffect(() => {
    initFCM().catch(console.warn);

    const unsubFCM = onFCMNotification((payload) => {
      setFcmToast(payload);
      setTimeout(() => setFcmToast(null), 7000);
    });

    return () => unsubFCM();
  }, []);

  // Localization & Extra Modals
  const [language, setLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem('ronpay_language');
    return (saved === 'english' || saved === 'mizo') ? saved : 'mizo';
  });
  const [isPeknaSulhnuOpen, setIsPeknaSulhnuOpen] = useState<boolean>(false);
  const [isAdminDashboardOpen, setIsAdminDashboardOpen] = useState<boolean>(false);
  const [isMemberRollOpen, setIsMemberRollOpen] = useState<boolean>(false);
  const [memberRollInitialTab, setMemberRollInitialTab] = useState<'quick_entry' | 'register_member' | 'members_list' | 'print_reports'>('members_list');
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

  const handleOpenMemberRoll = (tab?: 'quick_entry' | 'register_member' | 'members_list' | 'print_reports') => {
    setMemberRollInitialTab(tab || 'members_list');
    setIsMemberRollOpen(true);
  };

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

  // Continuous multi-device sync engine & event listener
  useEffect(() => {
    const stopSync = startAutoSyncEngine((serverData) => {
      if (serverData.campaigns && serverData.campaigns.length > 0) {
        setCampaigns(serverData.campaigns);
      }
      if (serverData.transactions) {
        setTransactions(serverData.transactions);
      }
      if (serverData.creators) {
        setCreatorsList(serverData.creators);
      }
      if (serverData.announcement) {
        setAnnouncement(serverData.announcement);
      }
      if (serverData.pricingConfig) {
        setPricingConfig(serverData.pricingConfig);
      }
    });

    const handleCustomSync = (e: any) => {
      const serverData = e.detail;
      if (serverData) {
        if (serverData.campaigns) setCampaigns(serverData.campaigns);
        if (serverData.transactions) setTransactions(serverData.transactions);
        if (serverData.creators) setCreatorsList(serverData.creators);
        if (serverData.announcement) setAnnouncement(serverData.announcement);
        if (serverData.pricingConfig) setPricingConfig(serverData.pricingConfig);
      }
    };

    window.addEventListener(RONPAY_SYNC_EVENT, handleCustomSync);

    return () => {
      stopSync();
      window.removeEventListener(RONPAY_SYNC_EVENT, handleCustomSync);
    };
  }, []);

  // Handle shared campaign URL query parameters on startup (Deep Linking & QR Web Portal)
  useEffect(() => {
    async function resolveUrlCampaign() {
      try {
        const params = new URLSearchParams(window.location.search);
        
        // 1. Digital Receipt Web Portal resolver (?receipt=RPAY-12345 or ?receiptId=... or ?verify=...)
        const urlReceiptId = params.get('receipt') || params.get('receiptId') || params.get('verify');
        if (urlReceiptId) {
          const allTx = getStoredTransactions();
          let foundTx = allTx.find(
            t => t.id === urlReceiptId || t.id.toLowerCase() === urlReceiptId.toLowerCase()
          );

          if (foundTx) {
            setLatestTransaction(foundTx);
            setCurrentScreen('screen-success');
            return;
          }
        }

        const urlCampaignId = params.get('campaign') || params.get('campaignId');
        if (urlCampaignId) {
          // 1. Check in local campaigns
          let found = campaigns.find(
            c => c.id === urlCampaignId || c.id.toLowerCase() === urlCampaignId.toLowerCase()
          );

          // 2. If not found locally, fetch from server database
          if (!found) {
            const remoteCamp = await fetchCampaignById(urlCampaignId);
            if (remoteCamp) {
              found = remoteCamp;
              setCampaigns(prev => [remoteCamp, ...prev.filter(c => c.id !== remoteCamp.id)]);
            }
          }

          // 3. If still not found, construct from URL search parameters if available
          if (!found && params.get('cat')) {
            const fallbackCamp: Campaign = {
              id: urlCampaignId,
              category: (params.get('cat') as BawmCategory) || 'ralna',
              title: params.get('title') || 'Community Campaign',
              upiId: params.get('upi') || 'ronpay@upi',
              location: params.get('loc') || 'Mizoram',
              gpsCoords: '23.7271, 92.7176',
              validityDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
              orgCode: params.get('org') || 'MEM',
              targetAmount: params.get('target') ? Number(params.get('target')) : undefined,
              status: 'active',
              createdAt: new Date().toISOString(),
              createdBy: 'QR Scanner Portal',
              imageUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80'
            };
            found = fallbackCamp;
            setCampaigns(prev => [fallbackCamp, ...prev]);
            saveStoredCampaigns([fallbackCamp, ...campaigns]);
            saveCampaignToServer(fallbackCamp);
          }

          if (found) {
            setSelectedCampaign(found);
            setCurrentCategory(found.category);
            setCurrentScreen('screen-checkout');
          }
        }
      } catch (e) {
        console.error('Error handling campaign URL param:', e);
      }
    }

    resolveUrlCampaign();
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
    const target = scannerTarget;
    setScannerTarget('any'); // Reset target so future scans are fresh

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

    // 2. External UPI QR Scan (GPay / PhonePe / Paytm / Direct payee)
    if (payload.type === 'general-upi') {
      let matchedCamp = payload.campaign;

      // If not yet structured into a Campaign object, construct one from rawText
      if (!matchedCamp && payload.rawText) {
        try {
          if (payload.rawText.startsWith('upi://pay')) {
            const queryString = payload.rawText.includes('?') ? payload.rawText.split('?')[1] : payload.rawText.replace('upi://pay', '');
            const params = new URLSearchParams(queryString);
            const pa = (params.get('pa') || '').trim();
            const pn = (params.get('pn') || '').trim();
            const am = params.get('am');

            if (pa) {
              matchedCamp = {
                id: `ext-${Date.now()}`,
                category: 'others',
                title: pn ? decodeURIComponent(pn) : pa.split('@')[0],
                location: 'Standard Direct UPI',
                gpsCoords: '23.7271, 92.7176',
                upiId: pa,
                validityDate: '2027-12-31',
                status: 'active',
                createdAt: new Date().toISOString(),
                targetAmount: am ? Number(am) : undefined,
              };
            }
          }
        } catch {
          // ignore
        }
      }

      if (matchedCamp) {
        setExternalUPICampaign(matchedCamp);
        setIsExternalUPIModalOpen(true);
      } else {
        const raw = payload.rawText?.trim() || '';
        const upiUri = raw.startsWith('upi://') ? raw : `upi://pay?pa=${encodeURIComponent(raw || 'mizopay@axl')}&pn=RonPayCustomer`;
        alert(`📱 Scanned UPI QR: ${raw}\n\nRedirecting to Customer UPI App...`);
        window.location.href = upiUri;
      }
      return;
    }

    // 3. Bawm category scanned
    const actualCategory = payload.type;
    const camp = payload.campaign || campaigns.find(c => c.category === actualCategory && c.status === 'active');

    // Check mismatch if specific target was set
    if (target !== 'any' && target !== actualCategory) {
      setMismatchIntended(target);
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
    setCreatorsList(prev => {
      const clean = updatedProfile.phone.replace(/\D/g, '');
      const idx = prev.findIndex(c => c.phone === updatedProfile.phone || (clean && c.phone.replace(/\D/g, '') === clean));
      let next: CreatorProfile[];
      if (idx >= 0) {
        next = [...prev];
        next[idx] = updatedProfile;
      } else {
        next = [updatedProfile, ...prev];
      }
      saveStoredCreatorsList(next);
      return next;
    });
    if (updatedProfile.isAdmin || updatedProfile.phone === 'admin') {
      setIsAdminDashboardOpen(true);
      navigateTo('screen-admin');
      return;
    }
    setCurrentCategory(selectedCat);
    navigateTo('screen-create-qr');
  };

  // New creator registration submitted (requires Admin Approval)
  const handleRegisterCreator = (newProfile: CreatorProfile) => {
    setCreatorProfile(newProfile);
    saveStoredCreatorProfile(newProfile);
    setCreatorsList(prev => {
      const cleanPhone = newProfile.phone.replace(/\D/g, '');
      const filtered = prev.filter(c => c.phone !== newProfile.phone && (!cleanPhone || c.phone.replace(/\D/g, '') !== cleanPhone));
      const nextList = [newProfile, ...filtered];
      saveStoredCreatorsList(nextList);
      return nextList;
    });
  };

  // Category Add / Remove request (requires Admin Approval)
  const handleRequestUpgradeCategory = (
    type: 'add' | 'remove',
    newCat: BawmCategory,
    docName?: string,
    reason?: string
  ) => {
    const updated: CreatorProfile = {
      ...creatorProfile,
      pendingUpgrade: {
        type,
        category: newCat,
        requestedAt: new Date().toISOString(),
        authDocName: docName || (type === 'add' ? 'Recommendation_Document.pdf' : undefined),
        reason: reason || undefined,
      },
    };
    setCreatorProfile(updated);
    saveStoredCreatorProfile(updated);
    setCreatorsList(prev => {
      const cleanUpdatedPhone = updated.phone.replace(/\D/g, '');
      const idx = prev.findIndex(c => c.phone === updated.phone || (cleanUpdatedPhone && c.phone.replace(/\D/g, '') === cleanUpdatedPhone));
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

  // Cancel pending upgrade / removal request
  const handleCancelUpgradeRequest = () => {
    const updated: CreatorProfile = {
      ...creatorProfile,
      pendingUpgrade: undefined,
    };
    setCreatorProfile(updated);
    saveStoredCreatorProfile(updated);
    setCreatorsList(prev => {
      const cleanUpdatedPhone = updated.phone.replace(/\D/g, '');
      const idx = prev.findIndex(c => c.phone === updated.phone || (cleanUpdatedPhone && c.phone.replace(/\D/g, '') === cleanUpdatedPhone));
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

  // Direct upgrade if called by Admin
  const handleUpgradeCategory = (newCat: BawmCategory) => {
    const updatedApproved = Array.from(new Set([...creatorProfile.approvedCategories, newCat]));
    const updated: CreatorProfile = {
      ...creatorProfile,
      approvedCategories: updatedApproved,
      pendingUpgrade: undefined,
    };
    setCreatorProfile(updated);
    setCurrentCategory(newCat);
    saveStoredCreatorProfile(updated);
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
    saveStoredCampaigns([newCampaign, ...campaigns]);
    saveCampaignToServer(newCampaign);
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
      saveCampaignToServer(updatedCampaign);
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
    saveTransactionToServer(transaction);
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
    saveTransactionToServer(transaction);
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
    saveTransactionToServer(billTxn);
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
          notificationCount={fcmToast ? 1 : 0}
          onOpenNotifications={() => {
            if (fcmToast) {
              if (fcmToast.transactionId) {
                const allTx = getStoredTransactions();
                const found = allTx.find(t => t.id === fcmToast.transactionId);
                if (found) {
                  setLatestTransaction(found);
                  setCurrentScreen('screen-success');
                }
              }
              setFcmToast(null);
            } else {
              alert('🔔 RonPay Notifications:\n• Real-Time Cloud Messaging (FCM) is Active.\n• Digital Receipts are automatically generated for all offline & online payments.');
            }
          }}
          language={language}
          onToggleLanguage={handleToggleLanguage}
          onOpenHistory={handleOpenSecureHistory}
        />

        {/* Real-Time FCM Notification Toast */}
        {fcmToast && (
          <div className="mx-3 mt-2 p-3 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl shadow-xl border border-indigo-500/60 flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-4 duration-300 z-50">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-amber-400/20 border border-amber-400/40 flex items-center justify-center shrink-0">
                <Zap className="w-4 h-4 text-amber-400" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h4 className="text-[11px] font-black text-white truncate">{fcmToast.title}</h4>
                  <span className="text-[9px] font-bold bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded border border-emerald-400/30">
                    FCM Push
                  </span>
                </div>
                <p className="text-[10px] text-slate-300 truncate">{fcmToast.body}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {fcmToast.transactionId && (
                <button
                  type="button"
                  onClick={() => {
                    const allTx = getStoredTransactions();
                    const found = allTx.find(t => t.id === fcmToast.transactionId);
                    if (found) {
                      setLatestTransaction(found);
                      setCurrentScreen('screen-success');
                    }
                    setFcmToast(null);
                  }}
                  className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold rounded-lg transition cursor-pointer"
                >
                  Open Receipt
                </button>
              )}
              <button
                type="button"
                onClick={() => setFcmToast(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg transition"
              >
                ✕
              </button>
            </div>
          </div>
        )}

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
              onOpenMemberRoll={handleOpenMemberRoll}
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
              onOpenMemberRoll={handleOpenMemberRoll}
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
              onRegisterCreator={handleRegisterCreator}
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
              onOpenMemberRoll={handleOpenMemberRoll}
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
              onOpenMemberRoll={handleOpenMemberRoll}
            />
          )}

          {currentScreen === 'screen-success' && (
            <SuccessScreen
              transaction={latestTransaction}
              onGoHome={() => navigateTo('screen-home')}
              onExploreMore={() => navigateTo('screen-bawm-explorer')}
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
        <nav className="bg-white border-t border-slate-200/90 px-3 sm:px-6 py-2.5 flex justify-around items-center text-slate-400 text-xs shadow-lg shrink-0">
          <button
            onClick={() => navigateTo('screen-home')}
            className={`flex flex-col items-center transition cursor-pointer px-1.5 ${
              currentScreen === 'screen-home' && !isMemberRollOpen ? 'text-indigo-600 font-extrabold' : 'hover:text-indigo-600'
            }`}
          >
            <Home className="w-4 h-4" />
            <span className="text-[9px] mt-0.5">Home</span>
          </button>

          <button
            onClick={() => handleOpenMemberRoll('members_list')}
            className={`flex flex-col items-center transition cursor-pointer px-1.5 ${
              isMemberRollOpen ? 'text-blue-600 font-black' : 'hover:text-blue-600 text-blue-700'
            }`}
          >
            <div className="relative">
              <Users className="w-4 h-4 text-blue-600" />
              <span className="w-1.5 h-1.5 bg-blue-600 rounded-full absolute -top-0.5 -right-1" />
            </div>
            <span className="text-[9px] mt-0.5 font-bold">Roll</span>
          </button>

          <button
            onClick={handleCreateQRNav}
            className={`flex flex-col items-center transition cursor-pointer px-1.5 ${
              (currentScreen === 'screen-create-qr' || currentScreen === 'screen-creator-reg') && !isMemberRollOpen
                ? 'text-amber-600 font-extrabold' 
                : 'hover:text-amber-600'
            }`}
          >
            <QrCode className="w-4 h-4" />
            <span className="text-[9px] mt-0.5">Studio</span>
          </button>

          <button
            onClick={() => navigateTo('screen-export-reports')}
            className={`flex flex-col items-center transition cursor-pointer px-1.5 ${
              currentScreen === 'screen-export-reports' && !isMemberRollOpen ? 'text-indigo-600 font-extrabold' : 'hover:text-indigo-600'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span className="text-[9px] mt-0.5">Reports</span>
          </button>

          <button
            onClick={handleOpenSecureProfile}
            className="flex flex-col items-center hover:text-indigo-600 transition cursor-pointer px-1.5"
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
          onRequestUpgrade={handleRequestUpgradeCategory}
          onCancelUpgradeRequest={handleCancelUpgradeRequest}
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
            const stored = getStoredCreatorsList();
            const list = [...stored];
            // Merge in-memory creatorsList if any items not in storage
            creatorsList.forEach(c => {
              const clean = c.phone ? c.phone.replace(/\D/g, '') : '';
              const exists = list.some(item => item.phone === c.phone || (clean && item.phone.replace(/\D/g, '') === clean));
              if (!exists) {
                list.unshift(c);
              }
            });
            if (creatorProfile.phone) {
              const clean = creatorProfile.phone.replace(/\D/g, '');
              const existingIdx = list.findIndex(c => c.phone === creatorProfile.phone || (clean && c.phone.replace(/\D/g, '') === clean));
              if (existingIdx >= 0) {
                list[existingIdx] = { ...list[existingIdx], ...creatorProfile };
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
            const cleanUpdatedPhone = updated.phone.replace(/\D/g, '');
            if (
              creatorProfile.phone === updated.phone ||
              (!creatorProfile.phone && updated.name === creatorProfile.name) ||
              (creatorProfile.phone && cleanUpdatedPhone && creatorProfile.phone.replace(/\D/g, '') === cleanUpdatedPhone)
            ) {
              setCreatorProfile(updated);
              saveStoredCreatorProfile(updated);
            }
            setCreatorsList(prev => {
              const idx = prev.findIndex(c => c.phone === updated.phone || (cleanUpdatedPhone && c.phone.replace(/\D/g, '') === cleanUpdatedPhone));
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
          onOpenCreateQR={() => {
            setIsMemberRollOpen(false);
            navigateTo('screen-create-qr');
          }}
          onDataUpdated={() => {
            setTransactions(getStoredTransactions());
            setCampaigns(getStoredCampaigns());
          }}
        />

        {/* Global Universal Print & PDF Statement Preview Modal */}
        <PrintPreviewModal />

      </div>
    </div>
  );
}
